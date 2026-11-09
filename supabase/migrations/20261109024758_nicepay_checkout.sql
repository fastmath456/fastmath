begin;

create table public.nicepay_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'live')),
  status text not null default 'ready' check (status in ('ready', 'approving', 'voiding', 'paid', 'closed')),
  tid text unique,
  auth_token_hash text unique,
  claimed_at timestamptz,
  check (status in ('ready', 'closed') or (tid is not null and auth_token_hash is not null and claimed_at is not null))
);
create unique index one_current_nicepay_attempt on public.nicepay_attempts(order_id) where status <> 'closed';
alter table public.nicepay_attempts enable row level security;
revoke all on public.nicepay_attempts from public, anon, authenticated;
grant select, insert, update on public.nicepay_attempts to service_role;

alter table public.refunds add column nicepay_cancel_started boolean not null default false;
alter table public.refunds add column nicepay_cancel_tid text;

create function public.create_nicepay_attempt(p_user uuid, p_product text, p_key uuid, p_environment text)
returns table (attempt_id uuid, amount integer, title text)
language plpgsql set search_path = '' as $$
declare
  o public.orders;
  a public.nicepay_attempts;
begin
  o := public.create_order(p_user, p_product, p_key);
  select * into o from public.orders where id = o.id for update;
  if o.status <> 'pending' or o.payment_key is not null then
    raise exception 'payment_conflict';
  end if;

  select * into a from public.nicepay_attempts where order_id = o.id and status <> 'closed' for update;
  if not found then
    insert into public.nicepay_attempts(order_id, environment) values (o.id, p_environment) returning * into a;
  elsif a.environment <> p_environment then
    raise exception 'payment_conflict';
  elsif a.status <> 'ready' then
    raise exception 'payment_outcome_unknown';
  end if;
  return query select a.id, o.amount, o.title;
end $$;

create function public.complete_nicepay_payment(p_attempt uuid, p_tid text, p_amount integer, p_paid timestamptz)
returns boolean language plpgsql set search_path = '' as $$
declare
  o public.orders;
  a public.nicepay_attempts;
begin
  select * into o from public.orders
    where id = (select order_id from public.nicepay_attempts where id = p_attempt) for update;
  if not found or o.amount <> p_amount then raise exception 'payment_mismatch'; end if;
  select * into a from public.nicepay_attempts where id = p_attempt for update;
  if not found or a.tid is distinct from p_tid then raise exception 'payment_mismatch'; end if;
  if a.status = 'paid' then return o.status = 'paid'; end if;
  if a.status <> 'approving' or o.status <> 'pending' or o.payment_key is not null then
    raise exception 'payment_conflict';
  end if;

  update public.orders set payment_key = p_tid where id = o.id;
  perform public.complete_payment(o.id, p_tid, p_amount, p_paid);
  update public.nicepay_attempts set status = 'paid' where id = a.id;
  return true;
end $$;

-- An external event may race with a refund request after the server checked the order.
create or replace function public.external_cancellation(p_order uuid, p_amount integer)
returns void language plpgsql set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or p_amount <= 0 or p_amount > o.amount then raise exception 'refund_mismatch'; end if;
  if o.status = 'refunded' then return; end if;
  if o.status = 'pending' or exists (
    select 1 from public.refunds where order_id = o.id and status = 'processing'
  ) then raise exception 'refund_mismatch'; end if;

  insert into public.refunds(order_id,user_id,request_key,amount,used_seconds,status,reason)
  values(o.id,o.user_id,o.id,p_amount,public.used_seconds(o.id),case when p_amount=o.amount then 'completed' else 'review' end,'PG에서 확인한 외부 취소')
  on conflict(order_id) do update set amount=p_amount,status=excluded.status,reason=excluded.reason;
  update public.orders set status=case when p_amount=o.amount then 'refunded' else 'review' end where id=o.id;
  if p_amount=o.amount then update public.entitlements set revoked=true where order_id=o.id; end if;
end $$;

revoke all on function public.create_nicepay_attempt(uuid, text, uuid, text),
  public.complete_nicepay_payment(uuid, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.create_nicepay_attempt(uuid, text, uuid, text),
  public.complete_nicepay_payment(uuid, text, integer, timestamptz) to service_role;

commit;
