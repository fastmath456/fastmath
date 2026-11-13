begin;

-- Every refund request now waits for an admin: nothing is cancelled at the PG until it is approved.
create or replace function public.refund_quote(p_user uuid,p_order uuid) returns jsonb language plpgsql set search_path = '' as $$
declare o public.orders; used integer; amount integer;
begin
 select * into o from public.orders where id=p_order and user_id=p_user;
 if not found then raise exception 'not_found'; end if;
 if o.status<>'paid' then raise exception 'refund_conflict'; end if;
 if o.kind='vod' and not exists(select 1 from public.entitlements where order_id=o.id and expires_at>now()) then raise exception 'refund_expired'; end if;
 if o.kind='pdf' and exists(select 1 from public.download_events where order_id=o.id) then raise exception 'refund_downloaded'; end if;
 used := least(public.used_seconds(o.id),o.total_paid_seconds);
 if used>0 and used::bigint*2>=o.total_paid_seconds then raise exception 'refund_used_up'; end if;
 amount := case when used=0 then o.amount
                when used::bigint*3<o.total_paid_seconds then floor(o.amount::numeric*2/3)::integer
                else floor(o.amount::numeric/2)::integer end;
 return jsonb_build_object('orderId',o.id,'title',o.title,'kind',o.kind,'amount',amount,'paidAmount',o.amount,'usedSeconds',used,'totalSeconds',o.total_paid_seconds,'manual',true,'version',o.policy_version,'expiresAt',now()+interval '5 minutes');
end $$;

commit;
