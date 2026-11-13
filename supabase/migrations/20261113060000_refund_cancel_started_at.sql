begin;

-- When a refund cancel's response is lost, recovery needs to know when the cancel started:
-- once it has had time to settle, a payment that is still untouched proves the cancel never happened.
alter table public.refunds add column nicepay_cancel_started_at timestamptz;

commit;
