begin;

-- New purchases freeze the first active lesson as the sole free lesson.
-- Existing order snapshots retain their original refund weights.
create or replace function public.create_order(p_user uuid,p_product text,p_key uuid) returns public.orders language plpgsql set search_path = '' as $$
declare o public.orders; p public.products; seconds integer; first_lesson text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_product,0));
 select * into o from public.orders where user_id=p_user and request_key=p_key;
 if found then if o.product_id<>p_product then raise exception 'key_conflict'; end if; return o; end if;
 select * into o from public.orders where user_id=p_user and product_id=p_product and status='pending';
 if found then return o; end if;
 select * into p from public.products where id=p_product and selling=true for share;
 if not found then raise exception 'not_selling'; end if;
 if exists(select 1 from public.orders where user_id=p_user and product_id=p_product and status<>'refunded') then raise exception 'already_owned'; end if;
 select l.id into first_lesson from public.lessons l join public.chapters c on c.id=l.chapter_id
 where l.product_id=p.id and l.active and c.active order by c.position,l.position limit 1;
 select coalesce(sum(l.duration_seconds),0) into seconds from public.lessons l join public.chapters c on c.id=l.chapter_id
 where l.product_id=p.id and l.active and c.active and l.id is distinct from first_lesson;
 insert into public.orders(user_id,product_id,title,kind,amount,total_paid_seconds,request_key)
 values(p_user,p.id,p.title,p.kind,p.price,seconds,p_key) returning * into o;
 insert into public.order_lessons(order_id,user_id,lesson_id,duration_seconds,preview)
 select o.id,p_user,l.id,l.duration_seconds,l.id=first_lesson from public.lessons l join public.chapters c on c.id=l.chapter_id
 where l.product_id=p.id and l.active and c.active;
 return o;
end $$;

create function public.order_download(p_user uuid,p_order uuid) returns jsonb language plpgsql set search_path = '' as $$
declare o public.orders; files jsonb; legacy_path text;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found or o.status<>'paid' or not exists(
  select 1 from public.entitlements where order_id=o.id and not revoked and starts_at<=now() and expires_at>now()
 ) then raise exception 'no_access'; end if;
 select jsonb_agg(jsonb_build_object('bucket','admin-course-assets','path',a.path,'name',a.name,'size',a.size_bytes) order by pa.position)
 into files from public.product_assets pa join public.admin_course_assets a on a.id=pa.asset_id
 where pa.product_id=o.product_id and pa.role='material' and a.slot='material';
 if files is null then
  select pdf_path into legacy_path from public.products where id=o.product_id;
  if legacy_path is null then raise exception 'file_missing'; end if;
  files:=jsonb_build_array(jsonb_build_object('bucket','paid-files','path',legacy_path,'name',regexp_replace(legacy_path,'^.*/',''),'size',0));
 end if;
 insert into public.download_events(order_id,user_id) values(o.id,p_user);
 return files;
end $$;
revoke all on function public.order_download(uuid,uuid) from public,anon,authenticated;
grant execute on function public.order_download(uuid,uuid) to service_role;

-- Auth soft deletion and access revocation must commit together; no financial rows are deleted.
create function private.revoke_withdrawn_access() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 update public.entitlements set revoked=true where user_id=new.id;
 delete from public.user_roles where user_id=new.id;
 delete from public.profiles where user_id=new.id;
 return new;
end $$;
revoke all on function private.revoke_withdrawn_access() from public,anon,authenticated,service_role;
create trigger on_account_withdrawn after update of deleted_at on auth.users
for each row when (old.deleted_at is null and new.deleted_at is not null) execute function private.revoke_withdrawn_access();

-- A delayed payment/refund result must never restore access to a withdrawn account.
create function private.keep_withdrawn_access_revoked() returns trigger language plpgsql security definer set search_path = '' as $$
declare withdrawn timestamptz;
begin
 select deleted_at into withdrawn from auth.users where id=new.user_id for share;
 if withdrawn is not null then new.revoked:=true; end if;
 return new;
end $$;
revoke all on function private.keep_withdrawn_access_revoked() from public,anon,authenticated,service_role;
create trigger withdrawn_entitlement before insert or update on public.entitlements
for each row execute function private.keep_withdrawn_access_revoked();

-- Refuse Auth deletion when application code is deployed before these triggers.
create function public.withdrawal_ready() returns boolean language sql stable set search_path = '' as $$
 select exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and tgname='on_account_withdrawn' and tgenabled<>'D')
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.entitlements'::regclass and tgname='withdrawn_entitlement' and tgenabled<>'D');
$$;
revoke all on function public.withdrawal_ready() from public,anon,authenticated;
grant execute on function public.withdrawal_ready() to service_role;

create or replace function public.session_active(p_session uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.id=p_session and s.user_id=(select auth.uid()) and u.deleted_at is null and (s.not_after is null or s.not_after>now()));
$$;

commit;
