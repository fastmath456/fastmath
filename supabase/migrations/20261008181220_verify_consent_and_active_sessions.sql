begin;
create or replace function private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not coalesce(jsonb_array_length(new.raw_user_meta_data->'agreements')=4 and new.raw_user_meta_data->'agreements'->0='true'::jsonb and new.raw_user_meta_data->'agreements'->1='true'::jsonb and new.raw_user_meta_data->'agreements'->2='true'::jsonb,false) then raise exception 'agreements_required'; end if;
 insert into public.profiles(user_id,name,birthday,phone,marketing)
 values(new.id,trim(new.raw_user_meta_data->>'name'),(new.raw_user_meta_data->>'birthday')::date,new.raw_user_meta_data->>'phone',coalesce((new.raw_user_meta_data->>'marketing')::boolean,false));
 insert into public.consent_events(user_id,kind,accepted) select new.id,k,true from unnest(array['terms','collection','privacy']) k;
 insert into public.consent_events(user_id,kind,accepted) values(new.id,'marketing',coalesce((new.raw_user_meta_data->>'marketing')::boolean,false)); return new;
end $$;
-- Auth sessions are not readable by authenticated. Expose only a boolean for the caller's own session.
create function public.session_active(p_session uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=(select auth.uid()) and (not_after is null or not_after>now()));
$$;
revoke all on function public.session_active(uuid) from public,anon,service_role;
grant execute on function public.session_active(uuid) to authenticated;
create function public.external_cancellation(p_order uuid,p_amount integer) returns void language plpgsql set search_path = '' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order for update;
 if not found or p_amount<=0 or p_amount>o.amount then raise exception 'refund_mismatch'; end if;
 if o.status='refunded' then return; end if;
 insert into public.refunds(order_id,user_id,request_key,amount,used_seconds,status,reason) values(o.id,o.user_id,o.id,p_amount,public.used_seconds(o.id),case when p_amount=o.amount then 'completed' else 'review' end,'PG에서 확인한 외부 취소')
 on conflict(order_id) do update set amount=p_amount,status=excluded.status,reason=excluded.reason;
 update public.orders set status=case when p_amount=o.amount then 'refunded' else 'review' end where id=o.id;
 if p_amount=o.amount then update public.entitlements set revoked=true where order_id=o.id; end if;
end $$;
revoke all on function public.external_cancellation(uuid,integer) from public,anon,authenticated;
grant execute on function public.external_cancellation(uuid,integer) to service_role;
commit;
