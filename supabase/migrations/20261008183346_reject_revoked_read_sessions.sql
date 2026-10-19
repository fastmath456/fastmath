begin;
do $$ declare t text; begin
 foreach t in array array['profiles','consent_events','orders','entitlements','lesson_progress','download_events','refunds','order_lessons'] loop
  execute format('alter policy own_read on public.%I using ((select auth.uid())=user_id and (select public.session_active((auth.jwt()->>''session_id'')::uuid)))',t);
 end loop;
end $$;
commit;
