-- Publish the course and its chosen catalog positions in one transaction.
create or replace function public.publish_ordered_course_draft(p_owner uuid,p_draft uuid,p_revision integer)
returns table(course_id text,slug text)
language plpgsql
set search_path = ''
as $$
declare
 d public.course_drafts;
 ordering jsonb;
 baseline text[];
 desired text[];
 expected text[];
 actual text[];
 published record;
begin
 select * into d from public.course_drafts where id=p_draft and owner_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 if d.published then return query select d.course_id,d.slug; return; end if;
 if d.revision<>p_revision then raise exception 'draft_conflict'; end if;
 ordering:=d.document->'productOrder';
 if ordering is null then
  return query select * from public.publish_course_draft(p_owner,p_draft,p_revision);
  return;
 end if;
 if jsonb_typeof(ordering) is distinct from 'object'
    or jsonb_typeof(ordering->'baseline') is distinct from 'array'
    or jsonb_typeof(ordering->'ids') is distinct from 'array' then raise exception 'invalid_draft'; end if;
 if jsonb_array_length(ordering->'baseline')>1000 or jsonb_array_length(ordering->'ids')>1001
    or exists(select 1 from jsonb_array_elements(ordering->'baseline') v where jsonb_typeof(v)<>'string')
    or exists(select 1 from jsonb_array_elements(ordering->'ids') v where jsonb_typeof(v) not in ('string','null'))
    or (select count(*) from jsonb_array_elements(ordering->'ids') v where v='null'::jsonb)<>1 then raise exception 'invalid_draft'; end if;
 baseline:=array(select jsonb_array_elements_text(ordering->'baseline'));
 desired:=array(select jsonb_array_elements_text(ordering->'ids'));
 if cardinality(baseline)<>(select count(distinct v) from unnest(baseline) v)
    or cardinality(desired)-1<>(select count(distinct v) from unnest(desired) v) then raise exception 'invalid_draft'; end if;

 -- Serialize catalog writers; reject a stale snapshot rather than overwrite another edit.
 lock table public.products in share row exclusive mode;
 -- Match the public catalog's existing QA exclusion and default sort exactly.
 actual:=array(select p.id from public.products p where p.id<>'course-9664ad3b74f94f7a834a53cff0d16188'
   order by p.display_order asc nulls last,p.published_at desc,p.id);
 if baseline is distinct from actual then raise exception 'order_conflict'; end if;
 if d.course_id is not null and not (d.course_id=any(baseline)) then raise exception 'invalid_draft'; end if;
 expected:=array(select v from unnest(baseline) v where v is distinct from d.course_id order by v);
 if expected is distinct from array(select v from unnest(desired) v where v is not null order by v) then raise exception 'invalid_draft'; end if;
 if d.document#>>'{basic,displayOrder}' is distinct from (array_position(desired,null)-1)::text then raise exception 'invalid_draft'; end if;

 select * into published from public.publish_course_draft(p_owner,p_draft,p_revision);
 update public.products p set display_order=(chosen.position-1)::integer
 from unnest(desired) with ordinality as chosen(id,position)
 where p.id=coalesce(chosen.id,published.course_id);
 return query select published.course_id::text,published.slug::text;
end;
$$;
revoke all on function public.publish_ordered_course_draft(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.publish_ordered_course_draft(uuid,uuid,integer) to service_role;
