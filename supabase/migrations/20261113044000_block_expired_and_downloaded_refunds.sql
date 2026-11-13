begin;

-- VOD: no refund once the access period has ended, even if nothing was watched.
-- PDF: no refund once the paid file has been downloaded.
create or replace function public.refund_quote(p_user uuid,p_order uuid) returns jsonb language plpgsql set search_path = '' as $$
declare o public.orders; used integer; amount integer; manual boolean;
begin
 select * into o from public.orders where id=p_order and user_id=p_user;
 if not found then raise exception 'not_found'; end if;
 if o.status<>'paid' then raise exception 'refund_conflict'; end if;
 if o.kind='vod' and not exists(select 1 from public.entitlements where order_id=o.id and expires_at>now()) then raise exception 'refund_expired'; end if;
 if o.kind='pdf' and exists(select 1 from public.download_events where order_id=o.id) then raise exception 'refund_downloaded'; end if;
 used := least(public.used_seconds(o.id),o.total_paid_seconds);
 amount := o.amount-case when o.total_paid_seconds>0 then ceil(o.amount::numeric*used/o.total_paid_seconds)::integer else 0 end;
 manual := used>0 or exists(select 1 from public.download_events where order_id=o.id) or (o.kind='pdf' and o.paid_at<now()-interval '7 days');
 return jsonb_build_object('orderId',o.id,'title',o.title,'kind',o.kind,'amount',amount,'paidAmount',o.amount,'usedSeconds',used,'totalSeconds',o.total_paid_seconds,'manual',manual,'version',o.policy_version,'expiresAt',now()+interval '5 minutes');
end $$;

-- Admin approval cannot bypass the PDF download rule; rejection stays available.
create or replace function public.review_refund(p_order uuid,p_approve boolean,p_amount integer,p_reason text) returns public.refunds language plpgsql set search_path = '' as $$
declare o public.orders; r public.refunds;
begin
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'not_found'; end if;
 select * into r from public.refunds where order_id=p_order for update;
 if not found then raise exception 'not_found'; end if;
 if r.status='processing' and p_approve and r.amount=p_amount then return r; end if;
 if r.status<>'review' or p_amount<0 or p_amount>o.amount or length(trim(p_reason))<1 then raise exception 'refund_conflict'; end if;
 if p_approve and o.kind='pdf' and exists(select 1 from public.download_events where order_id=o.id) then raise exception 'refund_downloaded'; end if;
 update public.refunds set status=case when p_approve then 'processing' else 'rejected' end,amount=case when p_approve then p_amount else amount end,reason=p_reason where order_id=p_order returning * into r;
 update public.orders set status=case when p_approve then 'refunding' else 'paid' end where id=p_order; return r;
end $$;

commit;
