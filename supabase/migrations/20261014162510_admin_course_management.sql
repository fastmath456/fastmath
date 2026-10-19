begin;

-- Course authoring is private until the explicit publish action.  The document
-- deliberately retains unfinished values, while public catalog tables only
-- receive a fully validated snapshot through publish_course_draft.
create table public.course_drafts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 course_id text references public.products(id),
 slug text,
 document jsonb not null check (jsonb_typeof(document)='object'),
 revision integer not null default 1 check (revision > 0),
 published boolean not null default false,
 saved_at timestamptz not null default now()
);
create index course_drafts_owner_saved on public.course_drafts(owner_id,saved_at desc);

create table public.admin_course_assets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 slot text not null check(slot in ('thumbnail','detailImage','material')),
 path text not null unique,
 name text not null check(length(name) between 1 and 255),
 size_bytes bigint not null check(size_bytes > 0),
 checksum text not null check(checksum ~ '^[0-9a-f]{64}$'),
 content_type text not null,
 width integer,
 height integer,
 created_at timestamptz not null default now()
);
create index admin_course_assets_owner on public.admin_course_assets(owner_id,created_at desc);
create unique index admin_course_material_checksum on public.admin_course_assets(owner_id,checksum) where slot='material';

create table public.verified_videos (
 owner_id uuid not null references auth.users(id),
 url text not null,
 embed_url text not null,
 duration_seconds integer not null check(duration_seconds > 0),
 verified_at timestamptz not null default now(),
 primary key(owner_id,url)
);

create table public.product_assets (
 product_id text not null references public.products(id),
 asset_id uuid not null references public.admin_course_assets(id),
 role text not null check(role in ('thumbnail','detailImage','material')),
 position integer not null default 0 check(position >= 0),
 primary key(product_id,asset_id),
 unique(product_id,role,position)
);
create index product_assets_asset on public.product_assets(asset_id);

alter table public.products drop constraint products_license_days_check;
alter table public.products add constraint products_license_days_check check(license_days > 0);
alter table public.chapters add column active boolean not null default true;
alter table public.lessons add column active boolean not null default true;
alter table public.lessons add column vimeo_url text;
create index chapters_product_active on public.chapters(product_id,position) where active;
create index lessons_product_active on public.lessons(product_id,chapter_id,position) where active;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('admin-course-assets','admin-course-assets',false,104857600,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

do $$ declare t text; begin
 foreach t in array array['course_drafts','admin_course_assets','verified_videos','product_assets'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create or replace function public.complete_payment(p_order uuid,p_payment text,p_amount integer,p_paid timestamptz) returns void language plpgsql set search_path = '' as $$
declare o public.orders; days integer;
begin
 select * into o from public.orders where id=p_order for update;
 if not found or o.amount<>p_amount or o.payment_key<>p_payment then raise exception 'payment_mismatch'; end if;
 if o.status='paid' then return; end if;
 if o.status<>'pending' then raise exception 'payment_conflict'; end if;
 select license_days into days from public.products where id=o.product_id;
 if days is null or days<=0 then raise exception 'not_found'; end if;
 update public.orders set status='paid',paid_at=p_paid where id=o.id;
 insert into public.entitlements(order_id,user_id,product_id,starts_at,expires_at) values(o.id,o.user_id,o.product_id,p_paid,p_paid+make_interval(days=>days));
end $$;

create or replace function public.save_course_draft(p_owner uuid,p_draft uuid,p_revision integer,p_document jsonb)
returns public.course_drafts
language plpgsql
set search_path = ''
as $$
declare d public.course_drafts;
begin
 if jsonb_typeof(p_document)<>'object' then raise exception 'invalid_draft'; end if;
 select * into d from public.course_drafts where id=p_draft and owner_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 if d.published then raise exception 'draft_published'; end if;
 if d.revision<>p_revision then raise exception 'draft_conflict'; end if;
 update public.course_drafts set document=p_document,revision=revision+1,published=false,saved_at=now() where id=d.id returning * into d;
 return d;
end $$;

create or replace function public.start_playback(p_user uuid,p_order uuid,p_lesson text) returns uuid language plpgsql set search_path = '' as $$
declare o public.orders; sid uuid;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found or o.status<>'paid' or not exists(select 1 from public.entitlements where order_id=o.id and not revoked and starts_at<=now() and expires_at>now()) or not exists(select 1 from public.lessons l where l.id=p_lesson and l.product_id=o.product_id and (l.active or exists(select 1 from public.order_lessons ol where ol.order_id=o.id and ol.lesson_id=l.id))) then raise exception 'no_access'; end if;
 insert into public.playback_sessions(user_id,order_id,lesson_id) values(p_user,o.id,p_lesson) returning id into sid; return sid;
end $$;

create or replace function public.create_order(p_user uuid,p_product text,p_key uuid) returns public.orders language plpgsql set search_path = '' as $$
declare o public.orders; p public.products; seconds integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_product,0));
 select * into o from public.orders where user_id=p_user and request_key=p_key;
 if found then if o.product_id<>p_product then raise exception 'key_conflict'; end if; return o; end if;
 select * into o from public.orders where user_id=p_user and product_id=p_product and status='pending';
 if found then return o; end if;
 select * into p from public.products where id=p_product and selling=true for share;
 if not found then raise exception 'not_selling'; end if;
 if exists(select 1 from public.orders where user_id=p_user and product_id=p_product and status<>'refunded') then raise exception 'already_owned'; end if;
 select coalesce(sum(duration_seconds),0) into seconds from public.lessons where product_id=p.id and active and not preview;
 insert into public.orders(user_id,product_id,title,kind,amount,total_paid_seconds,request_key) values(p_user,p.id,p.title,p.kind,p.price,seconds,p_key) returning * into o;
 insert into public.order_lessons(order_id,user_id,lesson_id,duration_seconds,preview) select o.id,p_user,id,duration_seconds,preview from public.lessons where product_id=p.id and active;
 return o;
end $$;

-- The server validates MIME, ownership and Vimeo lookups before invoking this
-- RPC. These checks keep the transaction safe if a caller bypasses its UI.
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
begin
 select * into d from public.course_drafts where id=p_draft and owner_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 if d.published then return query select d.course_id,d.slug; return; end if;
 if d.revision<>p_revision then raise exception 'draft_conflict'; end if;
 doc:=d.document; basic:=doc->'basic';
 if jsonb_typeof(basic)<>'object' or jsonb_typeof(doc->'chapters')<>'array' then raise exception 'invalid_draft'; end if;
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
 if jsonb_typeof(basic->'thumbnail')<>'object' or jsonb_typeof(basic->'detailImage')<>'object' then raise exception 'invalid_draft'; end if;
 if not exists(select 1 from public.admin_course_assets a where a.id=(basic->'thumbnail'->>'id')::uuid and a.slot='thumbnail' and (a.owner_id=p_owner or (d.course_id is not null and exists(select 1 from public.product_assets pa where pa.product_id=d.course_id and pa.asset_id=a.id)))) then raise exception 'invalid_asset'; end if;
 if not exists(select 1 from public.admin_course_assets a where a.id=(basic->'detailImage'->>'id')::uuid and a.slot='detailImage' and (a.owner_id=p_owner or (d.course_id is not null and exists(select 1 from public.product_assets pa where pa.product_id=d.course_id and pa.asset_id=a.id)))) then raise exception 'invalid_asset'; end if;
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
  insert into public.products(id,slug,kind,title,price,base_price,image,selling,license_days)
  values(new_course,new_slug,'vod',title,price,base_price,'/api/course-assets/'||(basic->'thumbnail'->>'id'),true,days);
 else
  new_course:=d.course_id;
  select p.slug into new_slug from public.products p where p.id=new_course for update;
  if not found then raise exception 'not_found'; end if;
  update public.products set title=btrim(basic->>'title'),price=(basic->>'price')::integer,base_price=(basic->>'basePrice')::integer,image='/api/course-assets/'||(basic->'thumbnail'->>'id'),selling=true,license_days=days where id=new_course;
 end if;
 idx:=0;
 for asset_id in select (value->>'id')::uuid from jsonb_array_elements(coalesce(basic->'materials','[]'::jsonb)) loop
  if not exists(select 1 from public.admin_course_assets a where a.id=asset_id and a.slot='material' and (a.owner_id=p_owner or (d.course_id is not null and exists(select 1 from public.product_assets pa where pa.product_id=d.course_id and pa.asset_id=a.id)))) then raise exception 'invalid_asset'; end if;
  idx:=idx+1;
 end loop;
 delete from public.product_assets where product_id=new_course;
 insert into public.product_assets(product_id,asset_id,role,position) values(new_course,(basic->'thumbnail'->>'id')::uuid,'thumbnail',0),(new_course,(basic->'detailImage'->>'id')::uuid,'detailImage',0);
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
 update public.course_drafts set course_id=new_course,slug=new_slug,published=true,saved_at=now() where id=d.id;
 return query select new_course,new_slug;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('complete_payment','save_course_draft','publish_course_draft','start_playback','create_order') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
