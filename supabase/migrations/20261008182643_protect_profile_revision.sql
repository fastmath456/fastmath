begin;
drop function public.save_profile(uuid,text,date,text,boolean,text);
create function public.save_profile(p_user uuid,p_name text,p_birthday date,p_phone text,p_marketing boolean,p_image text,p_revision timestamptz) returns void language plpgsql set search_path = '' as $$
declare old public.profiles;
begin
 select * into old from public.profiles where user_id=p_user for update;
 if not found then raise exception 'profile_missing'; end if;
 if old.updated_at is distinct from p_revision then raise exception 'profile_conflict'; end if;
 update public.profiles set name=p_name,birthday=p_birthday,phone=p_phone,marketing=p_marketing,image_path=p_image,updated_at=clock_timestamp() where user_id=p_user;
 if old.marketing is distinct from p_marketing then insert into public.consent_events(user_id,kind,accepted) values(p_user,'marketing',p_marketing); end if;
end $$;
revoke all on function public.save_profile(uuid,text,date,text,boolean,text,timestamptz) from public,anon,authenticated;
grant execute on function public.save_profile(uuid,text,date,text,boolean,text,timestamptz) to service_role;
commit;
