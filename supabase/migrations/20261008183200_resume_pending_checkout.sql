begin;
create or replace function public.create_order(p_user uuid,p_product text,p_key uuid) returns public.orders language plpgsql set search_path = '' as $$
declare o public.orders; p public.products; seconds integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_product,0));
 select * into o from public.orders where user_id=p_user and request_key=p_key;
 if found then if o.product_id<>p_product then raise exception 'key_conflict'; end if; return o; end if;
 -- Closing the payment window must not lock the customer out of retrying checkout.
 select * into o from public.orders where user_id=p_user and product_id=p_product and status='pending';
 if found then return o; end if;
 select * into p from public.products where id=p_product and selling=true for share;
 if not found then raise exception 'not_selling'; end if;
 if exists(select 1 from public.orders where user_id=p_user and product_id=p_product and status<>'refunded') then raise exception 'already_owned'; end if;
 select coalesce(sum(duration_seconds),0) into seconds from public.lessons where product_id=p.id and not preview;
 insert into public.orders(user_id,product_id,title,kind,amount,total_paid_seconds,request_key) values(p_user,p.id,p.title,p.kind,p.price,seconds,p_key) returning * into o;
 insert into public.order_lessons(order_id,user_id,lesson_id,duration_seconds,preview) select o.id,p_user,id,duration_seconds,preview from public.lessons where product_id=p.id;
 return o;
end $$;
commit;
