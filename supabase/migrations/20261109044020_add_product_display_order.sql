begin;

alter table public.products add column display_order integer;
grant select (display_order) on public.products to anon, authenticated;

commit;
