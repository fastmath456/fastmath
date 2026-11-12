begin;

alter table public.reviews add column position integer check(position>=0);
create table public.course_review_authors (
 review_id uuid primary key references public.reviews(id) on delete cascade,
 product_id text not null references public.products(id),
 author text not null,
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create index course_review_authors_product on public.course_review_authors(product_id);
alter table public.course_review_authors enable row level security;
revoke all on public.course_review_authors from public,anon,authenticated;
grant all on public.course_review_authors to service_role;

create function public.mask_course_review_author(name text) returns text
language sql immutable strict set search_path = '' as $$
 select case when strpos(name,'*')>0 then name
  when length(name)=1 then '*'
  when length(name)=2 then left(name,1)||'*'
  else left(name,1)||repeat('*',greatest(length(name)-2,0))||right(name,1) end
$$;
revoke all on function public.mask_course_review_author(text) from public,anon,authenticated;
grant execute on function public.mask_course_review_author(text) to service_role;

-- Preserve original names privately before masking existing public reviews.
insert into public.course_review_authors(review_id,product_id,author)
 select id,product_id,author from public.reviews;
update public.reviews set author=public.mask_course_review_author(author);

create or replace function public.publish_course_draft(p_owner uuid,p_draft uuid,p_revision integer)
returns table(course_id text,slug text)
language plpgsql
set search_path = ''
as $$
declare
 d public.course_drafts;
 doc jsonb; basic jsonb; chapter jsonb; lesson jsonb; video jsonb;
 new_course text; new_slug text; base_slug text; title text; price integer; base_price integer; days integer;
 chapter_id text; lesson_id text; desired_chapters text[] := '{}'; desired_lessons text[] := '{}';
 asset_id uuid; idx integer; lesson_idx integer;
 details jsonb; review jsonb; review_id uuid; review_ids uuid[] := '{}';
 course_order integer; order_text text; review_author text;
begin
 select * into d from public.course_drafts where id=p_draft and owner_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 if d.published then return query select d.course_id,d.slug; return; end if;
 if d.revision<>p_revision then raise exception 'draft_conflict'; end if;
 doc:=d.document; basic:=doc->'basic';
 if jsonb_typeof(basic)<>'object' or jsonb_typeof(doc->'chapters')<>'array' then raise exception 'invalid_draft'; end if;
 if basic ? 'displayOrder' then
  order_text:=btrim(coalesce(basic->>'displayOrder',''));
  if order_text !~ '^[0-9]+$' or length(ltrim(order_text,'0'))>10 then raise exception 'invalid_draft'; end if;
  if order_text::numeric>2147483647 then raise exception 'invalid_draft'; end if;
  course_order:=order_text::integer;
 elsif d.course_id is not null then
  select p.display_order into course_order from public.products p where p.id=d.course_id;
 end if;
 title:=btrim(coalesce(basic->>'title',''));
 if length(title) not between 1 and 100 then raise exception 'invalid_draft'; end if;
 if coalesce(basic->>'price','') !~ '^[1-9][0-9]*$' or coalesce(basic->>'basePrice','') !~ '^[1-9][0-9]*$'
    or length(basic->>'price')>10 or length(basic->>'basePrice')>10
    or (length(basic->>'price')=10 and basic->>'price'>'2147483647')
    or (length(basic->>'basePrice')=10 and basic->>'basePrice'>'2147483647') then raise exception 'invalid_draft'; end if;
 price:=(basic->>'price')::integer; base_price:=(basic->>'basePrice')::integer;
 if base_price<price then raise exception 'invalid_draft'; end if;
 if coalesce(basic->>'licenseDays','')<>'' and (basic->>'licenseDays' !~ '^[1-9][0-9]*$' or length(basic->>'licenseDays')>10 or (length(basic->>'licenseDays')=10 and basic->>'licenseDays'>'2147483647')) then raise exception 'invalid_draft'; end if;
 days:=case when coalesce(basic->>'licenseDays','')='' then 60 else (basic->>'licenseDays')::integer end;
 if days<=0 then raise exception 'invalid_draft'; end if;
 if jsonb_typeof(basic->'thumbnail') is distinct from 'object' then raise exception 'invalid_draft'; end if;
 if not exists(select 1 from public.admin_course_assets a where a.id=(basic->'thumbnail'->>'id')::uuid and a.slot='thumbnail' and (a.owner_id=p_owner or (d.course_id is not null and exists(select 1 from public.product_assets pa where pa.product_id=d.course_id and pa.asset_id=a.id)))) then raise exception 'invalid_asset'; end if;
 -- Accept the previous single-image payload while rolling out the new UI.
 details:=case when basic ? 'detailImages' then basic->'detailImages' when jsonb_typeof(basic->'detailImage')='object' then jsonb_build_array(basic->'detailImage') else '[]'::jsonb end;
 if jsonb_typeof(details) is distinct from 'array' then raise exception 'invalid_draft'; end if;
 if jsonb_array_length(details)=0 then raise exception 'invalid_draft'; end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(details)) then raise exception 'duplicate_asset'; end if;
 for asset_id in select (value->>'id')::uuid from jsonb_array_elements(details) loop
  if not exists(select 1 from public.admin_course_assets a where a.id=asset_id and a.slot='detailImage' and (a.owner_id=p_owner or (d.course_id is not null and exists(select 1 from public.product_assets pa where pa.product_id=d.course_id and pa.asset_id=a.id)))) then raise exception 'invalid_asset'; end if;
 end loop;
 if basic ? 'reviews' then
  if jsonb_typeof(basic->'reviews') is distinct from 'array' then raise exception 'invalid_draft'; end if;
  for review in select value from jsonb_array_elements(basic->'reviews') loop
   if jsonb_typeof(review) is distinct from 'object' or jsonb_typeof(review->'body') is distinct from 'string' or jsonb_typeof(review->'author') is distinct from 'string' then raise exception 'invalid_draft'; end if;
   if coalesce(review->>'rating','')='' and btrim(review->>'body',E' \t\n\r')='' and btrim(review->>'author',E' \t\n\r')='' then continue; end if;
   if jsonb_typeof(review->'rating') is distinct from 'number' or coalesce(review->>'rating','') !~ '^[1-5]$' then raise exception 'invalid_draft'; end if;
   if length(btrim(review->>'body',E' \t\n\r'))=0 or length(review->>'body')>5000 or length(btrim(review->>'author',E' \t\n\r')) not between 1 and 50 then raise exception 'invalid_draft'; end if;
   if coalesce(review->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'invalid_draft'; end if;
   review_id:=(review->>'id')::uuid;
   if review_id=any(review_ids) then raise exception 'invalid_draft'; end if;
   review_ids:=array_append(review_ids,review_id);
  end loop;
 end if;
 if jsonb_array_length(doc->'chapters')=0 then raise exception 'invalid_draft'; end if;
 for chapter in select value from jsonb_array_elements(doc->'chapters') loop
  chapter_id:=coalesce(chapter->>'id','');
  if length(chapter_id)=0 or length(btrim(coalesce(chapter->>'title',''))) not between 1 and 100 or jsonb_typeof(chapter->'lessons')<>'array' or jsonb_array_length(chapter->'lessons')=0 then raise exception 'invalid_draft'; end if;
  if chapter_id=any(desired_chapters) then raise exception 'invalid_draft'; end if; desired_chapters:=array_append(desired_chapters,chapter_id);
  for lesson in select value from jsonb_array_elements(chapter->'lessons') loop
   lesson_id:=coalesce(lesson->>'id',''); video:=lesson->'video';
   if length(lesson_id)=0 or lesson_id=any(desired_lessons) or length(btrim(coalesce(lesson->>'title',''))) not between 1 and 100 or jsonb_typeof(video)<>'object' then raise exception 'invalid_draft'; end if;
   if coalesce(lesson->>'inputUrl','')<>coalesce(video->>'url','') then raise exception 'pending_video'; end if;
   if coalesce(video->>'durationSeconds','') !~ '^[1-9][0-9]*$' or length(video->>'durationSeconds')>10 or (length(video->>'durationSeconds')=10 and video->>'durationSeconds'>'2147483647') then raise exception 'invalid_video'; end if;
   if not exists(
    select 1 from public.verified_videos v
    where v.url=video->>'url'
      and v.embed_url=video->>'embedUrl'
      and v.duration_seconds=(video->>'durationSeconds')::integer
      and (v.owner_id=p_owner or (d.course_id is not null and exists(
        select 1 from public.lessons current_lesson
        where current_lesson.product_id=d.course_id
          and current_lesson.vimeo_url=v.url
          and current_lesson.duration_seconds=v.duration_seconds
      )))
   ) then raise exception 'invalid_video'; end if;
   desired_lessons:=array_append(desired_lessons,lesson_id);
  end loop;
 end loop;
 if d.course_id is null then
  new_course:='course-'||replace(d.id::text,'-','');
  base_slug:=regexp_replace(lower(title),'[^a-z0-9]+','-','g'); base_slug:=trim(both '-' from base_slug);
  if base_slug='' then base_slug:='course'; end if;
  new_slug:=left(base_slug,60)||'-'||replace(d.id::text,'-','');
  insert into public.products(id,slug,kind,title,price,base_price,image,selling,license_days,display_order)
  values(new_course,new_slug,'vod',title,price,base_price,'/api/course-assets/'||(basic->'thumbnail'->>'id'),true,days,course_order);
 else
  new_course:=d.course_id;
  select p.slug into new_slug from public.products p where p.id=new_course for update;
  if not found then raise exception 'not_found'; end if;
  update public.products set title=btrim(basic->>'title'),price=(basic->>'price')::integer,base_price=(basic->>'basePrice')::integer,image='/api/course-assets/'||(basic->'thumbnail'->>'id'),selling=true,license_days=days,display_order=course_order where id=new_course;
 end if;
 idx:=0;
 for asset_id in select (value->>'id')::uuid from jsonb_array_elements(coalesce(basic->'materials','[]'::jsonb)) loop
  if not exists(select 1 from public.admin_course_assets a where a.id=asset_id and a.slot='material' and (a.owner_id=p_owner or (d.course_id is not null and exists(select 1 from public.product_assets pa where pa.product_id=d.course_id and pa.asset_id=a.id)))) then raise exception 'invalid_asset'; end if;
  idx:=idx+1;
 end loop;
 delete from public.product_assets where product_id=new_course;
 insert into public.product_assets(product_id,asset_id,role,position) values(new_course,(basic->'thumbnail'->>'id')::uuid,'thumbnail',0);
 idx:=0;
 for asset_id in select (value->>'id')::uuid from jsonb_array_elements(details) loop
  insert into public.product_assets(product_id,asset_id,role,position) values(new_course,asset_id,'detailImage',idx); idx:=idx+1;
 end loop;
 idx:=0;
 for asset_id in select (value->>'id')::uuid from jsonb_array_elements(coalesce(basic->'materials','[]'::jsonb)) loop
  insert into public.product_assets(product_id,asset_id,role,position) values(new_course,asset_id,'material',idx); idx:=idx+1;
 end loop;
 -- Keep the previous purchase snapshot addressable.  Move only current active
 -- rows beyond every position already used in their parent before new rows take
 -- positions from zero, because the historical tables retain ordinary unique
 -- position constraints as well as their foreign-key references from orders.
 with numbered as (
  select current_lesson.id,max_position.max_position+row_number() over(partition by current_lesson.chapter_id order by current_lesson.position) as next_position
  from public.lessons current_lesson
  join (select archived_lesson.chapter_id,max(archived_lesson.position) as max_position from public.lessons archived_lesson where archived_lesson.product_id=new_course group by archived_lesson.chapter_id) max_position on max_position.chapter_id=current_lesson.chapter_id
  where current_lesson.product_id=new_course and current_lesson.active
 ) update public.lessons current_lesson set active=false,position=numbered.next_position from numbered where current_lesson.id=numbered.id;
 with numbered as (
  select current_chapter.id,max_position.max_position+row_number() over(order by current_chapter.position) as next_position
  from public.chapters current_chapter
  join (select product_id,max(position) as max_position from public.chapters where product_id=new_course group by product_id) max_position on max_position.product_id=current_chapter.product_id
  where current_chapter.product_id=new_course and current_chapter.active
 ) update public.chapters current_chapter set active=false,position=numbered.next_position from numbered where current_chapter.id=numbered.id;
 idx:=0;
 for chapter in select value from jsonb_array_elements(doc->'chapters') loop
  chapter_id:=chapter->>'id';
  update public.chapters as c set title=btrim(chapter->>'title'),position=idx,active=true where c.id=chapter_id and c.product_id=new_course;
  if not found then insert into public.chapters(id,product_id,title,position,active) values(chapter_id,new_course,btrim(chapter->>'title'),idx,true); end if;
  lesson_idx:=0;
  for lesson in select value from jsonb_array_elements(chapter->'lessons') loop
   lesson_id:=lesson->>'id'; video:=lesson->'video';
   update public.lessons as l set chapter_id=chapter->>'id',title=btrim(lesson->>'title'),position=lesson_idx,duration_seconds=(video->>'durationSeconds')::integer,vimeo_id=regexp_replace(video->>'embedUrl','^.*?/video/([0-9]+).*$','\1'),vimeo_url=video->>'url',active=true where l.id=lesson_id and l.product_id=new_course;
   if not found then insert into public.lessons(id,chapter_id,product_id,title,position,duration_seconds,vimeo_id,vimeo_url,active) values(lesson_id,chapter_id,new_course,btrim(lesson->>'title'),lesson_idx,(video->>'durationSeconds')::integer,regexp_replace(video->>'embedUrl','^.*?/video/([0-9]+).*$','\1'),video->>'url',true); end if;
   lesson_idx:=lesson_idx+1;
  end loop;
  idx:=idx+1;
 end loop;
 if basic ? 'reviews' then
  idx:=0;
  for review in select value from jsonb_array_elements(basic->'reviews') loop
   if coalesce(review->>'rating','')='' and btrim(review->>'body',E' \t\n\r')='' and btrim(review->>'author',E' \t\n\r')='' then continue; end if;
   review_id:=(review->>'id')::uuid; review_author:=btrim(review->>'author',E' \t\n\r');
   insert into public.reviews(id,product_id,rating,body,author,position)
    values(review_id,new_course,(review->>'rating')::numeric,review->>'body',public.mask_course_review_author(review_author),idx)
    on conflict(id) do update set rating=excluded.rating,body=excluded.body,author=excluded.author,position=excluded.position where reviews.product_id=new_course;
   if not found then raise exception 'invalid_draft'; end if;
   insert into public.course_review_authors(review_id,product_id,author,created_by,updated_by)
    values(review_id,new_course,review_author,p_owner,p_owner)
    on conflict on constraint course_review_authors_pkey do update set author=excluded.author,updated_by=p_owner,updated_at=now();
   idx:=idx+1;
  end loop;
  delete from public.reviews r where r.product_id=new_course and not (r.id=any(review_ids));
 end if;
 update public.course_drafts set course_id=new_course,slug=new_slug,published=true,saved_at=now() where id=d.id;
 return query select new_course,new_slug;
end $$;

revoke all on function public.publish_course_draft(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.publish_course_draft(uuid,uuid,integer) to service_role;
commit;
