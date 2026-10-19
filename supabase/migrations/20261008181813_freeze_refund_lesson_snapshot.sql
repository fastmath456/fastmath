begin;
create table public.order_lessons (
 order_id uuid not null references public.orders(id), user_id uuid not null references auth.users(id), lesson_id text not null references public.lessons(id),
 duration_seconds integer not null check(duration_seconds>0), preview boolean not null, primary key(order_id,lesson_id)
);
alter table public.order_lessons enable row level security;
revoke all on public.order_lessons from public,anon,authenticated;
grant all on public.order_lessons to service_role;
grant select on public.order_lessons to authenticated;
create policy own_read on public.order_lessons for select to authenticated using((select auth.uid())=user_id);
create index order_lessons_user on public.order_lessons(user_id);
insert into public.order_lessons(order_id,user_id,lesson_id,duration_seconds,preview) select o.id,o.user_id,l.id,l.duration_seconds,l.preview from public.orders o join public.lessons l on l.product_id=o.product_id;
create or replace function public.create_order(p_user uuid,p_product text,p_key uuid) returns public.orders language plpgsql set search_path = '' as $$
declare o public.orders; p public.products; seconds integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_product,0));
 select * into o from public.orders where user_id=p_user and request_key=p_key;
 if found then if o.product_id<>p_product then raise exception 'key_conflict'; end if; return o; end if;
 select * into p from public.products where id=p_product and selling=true for share;
 if not found then raise exception 'not_selling'; end if;
 if exists(select 1 from public.orders where user_id=p_user and product_id=p_product and status<>'refunded') then raise exception 'already_owned'; end if;
 select coalesce(sum(duration_seconds),0) into seconds from public.lessons where product_id=p.id and not preview;
 insert into public.orders(user_id,product_id,title,kind,amount,total_paid_seconds,request_key) values(p_user,p.id,p.title,p.kind,p.price,seconds,p_key) returning * into o;
 insert into public.order_lessons(order_id,user_id,lesson_id,duration_seconds,preview) select o.id,p_user,id,duration_seconds,preview from public.lessons where product_id=p.id;
 return o;
end $$;
create or replace function public.used_seconds(p_order uuid) returns integer language sql stable set search_path = '' as $$
 select coalesce(sum(upper(r)-lower(r)),0)::integer from public.lesson_progress pr join public.order_lessons l on l.order_id=pr.order_id and l.lesson_id=pr.lesson_id cross join lateral unnest(pr.watched) r where pr.order_id=p_order and not l.preview;
$$;
commit;
