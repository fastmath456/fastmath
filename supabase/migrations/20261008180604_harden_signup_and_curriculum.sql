begin;
create or replace function private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not coalesce(new.raw_user_meta_data->'agreements' @> '[true,true,true]'::jsonb,false) or jsonb_array_length(new.raw_user_meta_data->'agreements')<>4 then raise exception 'agreements_required'; end if;
 insert into public.profiles(user_id,name,birthday,phone,marketing)
 values(new.id,trim(new.raw_user_meta_data->>'name'),(new.raw_user_meta_data->>'birthday')::date,new.raw_user_meta_data->>'phone',coalesce((new.raw_user_meta_data->>'marketing')::boolean,false));
 insert into public.consent_events(user_id,kind,accepted) select new.id,k,true from unnest(array['terms','collection','privacy']) k;
 insert into public.consent_events(user_id,kind,accepted) values(new.id,'marketing',coalesce((new.raw_user_meta_data->>'marketing')::boolean,false)); return new;
end $$;
alter table public.chapters add unique(id,product_id);
alter table public.lessons add constraint lesson_same_product foreign key(chapter_id,product_id) references public.chapters(id,product_id);
create index chapters_product on public.chapters(product_id);
create index lessons_product on public.lessons(product_id);
create index reviews_product on public.reviews(product_id);
create index consents_user on public.consent_events(user_id);
create index playback_user on public.playback_sessions(user_id);
create index refunds_user on public.refunds(user_id);
create or replace function public.review_refund(p_order uuid,p_approve boolean,p_amount integer,p_reason text) returns public.refunds language plpgsql set search_path = '' as $$
declare o public.orders; r public.refunds;
begin
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'not_found'; end if;
 select * into r from public.refunds where order_id=p_order for update;
 if not found then raise exception 'not_found'; end if;
 if r.status='processing' and p_approve and r.amount=p_amount then return r; end if;
 if r.status<>'review' or p_amount<0 or p_amount>o.amount or length(trim(p_reason))<1 then raise exception 'refund_conflict'; end if;
 update public.refunds set status=case when p_approve then 'processing' else 'rejected' end,amount=case when p_approve then p_amount else amount end,reason=p_reason where order_id=p_order returning * into r;
 update public.orders set status=case when p_approve then 'refunding' else 'paid' end where id=p_order; return r;
end $$;
create or replace function public.complete_refund(p_order uuid,p_amount integer) returns void language plpgsql set search_path = '' as $$
declare o public.orders; r public.refunds;
begin
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'not_found'; end if;
 select * into r from public.refunds where order_id=p_order for update;
 if not found or r.amount<>p_amount then raise exception 'refund_mismatch'; end if;
 if r.status='completed' then return; end if;
 if r.status<>'processing' or o.status<>'refunding' then raise exception 'refund_conflict'; end if;
 update public.refunds set status='completed',completed_at=now() where order_id=p_order;
 update public.orders set status='refunded' where id=p_order;
 update public.entitlements set revoked=true where order_id=p_order;
end $$;
commit;
