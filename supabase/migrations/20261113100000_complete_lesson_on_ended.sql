begin;

-- A lesson counts as completed once the player reaches the end of the video (Vimeo "ended"),
-- in addition to the existing rule of 90% actually watched. Skipping to the end also completes it.
-- Refund amounts still use the watched seconds (used_seconds), so this does not change refunds.
drop function if exists public.record_progress(uuid,uuid,integer,integer,boolean);
create function public.record_progress(p_user uuid,p_session uuid,p_sequence integer,p_position integer,p_playing boolean,p_ended boolean default false) returns void language plpgsql set search_path = '' as $$
declare s public.playback_sessions; o public.orders; l public.lessons; delta integer; elapsed numeric; span int8multirange := '{}'; watched_seconds bigint;
begin
 select * into s from public.playback_sessions where id=p_session and user_id=p_user;
 if not found then raise exception 'no_access'; end if;
 select * into o from public.orders where id=s.order_id for update;
 select * into s from public.playback_sessions where id=p_session for update;
 if o.status<>'paid' or s.expires_at<=now() or not exists(select 1 from public.entitlements where order_id=o.id and not revoked and starts_at<=now() and expires_at>now()) then raise exception 'no_access'; end if;
 if p_sequence<=s.sequence then return; end if;
 if p_sequence<>s.sequence+1 then raise exception 'sequence_conflict'; end if;
 select * into l from public.lessons where id=s.lesson_id;
 -- The player's video length can be a second or two longer than duration_seconds; clamp at the end.
 if p_ended then p_position := least(p_position,l.duration_seconds); end if;
 if p_position<0 or p_position>l.duration_seconds then raise exception 'invalid_position'; end if;
 delta := p_position-s.position; elapsed := extract(epoch from clock_timestamp()-s.last_seen);
 if p_playing and delta>0 and delta<=30 and delta<=elapsed*2+2 then span := int8multirange(int8range(s.position,p_position,'[)')); end if;
 insert into public.lesson_progress as pr(user_id,order_id,lesson_id,position,watched) values(p_user,o.id,l.id,p_position,span)
 on conflict(order_id,lesson_id) do update set position=p_position,watched=pr.watched+span,updated_at=now();
 select coalesce(sum(upper(r)-lower(r)),0) into watched_seconds from public.lesson_progress pr cross join lateral unnest(pr.watched) r where pr.order_id=o.id and pr.lesson_id=l.id;
 update public.lesson_progress set completed=completed or p_ended or watched_seconds>=ceil(l.duration_seconds*0.9) where order_id=o.id and lesson_id=l.id;
 update public.playback_sessions set sequence=p_sequence,position=p_position,last_seen=clock_timestamp() where id=s.id;
end $$;
revoke all on function public.record_progress(uuid,uuid,integer,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.record_progress(uuid,uuid,integer,integer,boolean,boolean) to service_role;

commit;
