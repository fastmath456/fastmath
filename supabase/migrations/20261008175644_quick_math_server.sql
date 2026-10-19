begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
 user_id uuid primary key references auth.users(id), name text not null check (length(name) between 1 and 80),
 birthday date not null, phone text not null check (phone ~ '^[0-9]{10,11}$'), image_path text not null default '',
 marketing boolean not null default false, updated_at timestamptz not null default now()
);
create table public.user_roles (user_id uuid primary key references auth.users(id), role text not null check (role = 'admin'));
create table public.consent_events (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id), kind text not null, accepted boolean not null, version text not null default 'v1', created_at timestamptz not null default now());
create table public.products (
 id text primary key, slug text not null unique, kind text not null check(kind in ('vod','pdf')), title text not null,
 tags text[] not null default '{}', price integer not null check(price > 0), base_price integer check(base_price >= price),
 image text not null, poster text not null default '/assets/viewer-imgRectangle3.png', published_at timestamptz not null default now(),
 selling boolean not null default false, license_days integer not null default 60 check(license_days = 60), pdf_path text
);
create table public.chapters (id text primary key, product_id text not null references public.products(id), title text not null, position integer not null check(position >= 0), unique(product_id,position));
create table public.lessons (
 id text primary key, chapter_id text not null references public.chapters(id), product_id text not null references public.products(id),
 title text not null, position integer not null check(position >= 0), duration_seconds integer not null check(duration_seconds > 0),
 preview boolean not null default false, vimeo_id text check(vimeo_id ~ '^[0-9]+$'), unique(chapter_id,position)
);
create table public.reviews (id uuid primary key default gen_random_uuid(), product_id text not null references public.products(id), author text not null, body text not null, rating numeric not null check(rating between 0 and 5), created_at timestamptz not null default now());
create table public.orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), product_id text not null references public.products(id),
 title text not null, kind text not null check(kind in ('vod','pdf')), amount integer not null check(amount > 0),
 total_paid_seconds integer not null check(total_paid_seconds >= 0), policy_version text not null default 'v1',
 status text not null default 'pending' check(status in ('pending','paid','review','refunding','refunded')),
 request_key uuid not null, payment_key text unique, paid_at timestamptz, created_at timestamptz not null default now(),
 unique(user_id,request_key)
);
create unique index one_open_purchase on public.orders(user_id,product_id) where status <> 'refunded';
create index orders_user_date on public.orders(user_id,created_at desc);
create table public.entitlements (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id), user_id uuid not null references auth.users(id),
 product_id text not null references public.products(id), starts_at timestamptz not null, expires_at timestamptz not null,
 hidden boolean not null default false, revoked boolean not null default false, check(expires_at > starts_at)
);
create index entitlement_user_product on public.entitlements(user_id,product_id);
create table public.playback_sessions (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), user_id uuid not null references auth.users(id), lesson_id text not null references public.lessons(id),
 sequence integer not null default 0, position integer not null default 0, last_seen timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '2 hours')
);
create table public.lesson_progress (
 user_id uuid not null references auth.users(id), order_id uuid not null references public.orders(id), lesson_id text not null references public.lessons(id),
 position integer not null default 0, watched int8multirange not null default '{}', completed boolean not null default false,
 updated_at timestamptz not null default now(), primary key(order_id,lesson_id)
);
create index progress_user on public.lesson_progress(user_id);
create table public.download_events (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), user_id uuid not null references auth.users(id), created_at timestamptz not null default now());
create index downloads_order on public.download_events(order_id);
create table public.refunds (
 order_id uuid primary key references public.orders(id), user_id uuid not null references auth.users(id), request_key uuid not null unique,
 amount integer not null check(amount >= 0), used_seconds integer not null, status text not null check(status in ('review','processing','completed','rejected')),
 reason text, requested_at timestamptz not null default now(), completed_at timestamptz
);
create table public.request_limits (key text primary key, window_start timestamptz not null, count integer not null);

create function private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(user_id,name,birthday,phone,marketing)
 values(new.id,trim(new.raw_user_meta_data->>'name'),(new.raw_user_meta_data->>'birthday')::date,new.raw_user_meta_data->>'phone',coalesce((new.raw_user_meta_data->>'marketing')::boolean,false));
 insert into public.consent_events(user_id,kind,accepted) select new.id,k,true from unnest(array['terms','collection','privacy']) k;
 insert into public.consent_events(user_id,kind,accepted) values(new.id,'marketing',coalesce((new.raw_user_meta_data->>'marketing')::boolean,false));
 return new;
end $$;
revoke all on function private.new_profile() from public;
create trigger quick_math_profile after insert on auth.users for each row execute function private.new_profile();

-- All financial functions are invoker functions, executable only by the trusted server role.
create function public.consume_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql set search_path = '' as $$
declare n integer;
begin
 insert into public.request_limits as r(key,window_start,count) values(p_key,now(),1)
 on conflict(key) do update set count = case when r.window_start < now()-make_interval(secs=>p_seconds) then 1 else r.count+1 end,
 window_start = case when r.window_start < now()-make_interval(secs=>p_seconds) then now() else r.window_start end returning count into n;
 return n <= p_limit;
end $$;
create function public.save_profile(p_user uuid,p_name text,p_birthday date,p_phone text,p_marketing boolean,p_image text) returns void language plpgsql set search_path = '' as $$
declare old_marketing boolean;
begin
 select marketing into old_marketing from public.profiles where user_id=p_user for update;
 if not found then raise exception 'profile_missing'; end if;
 update public.profiles set name=p_name,birthday=p_birthday,phone=p_phone,marketing=p_marketing,image_path=p_image,updated_at=now() where user_id=p_user;
 if old_marketing is distinct from p_marketing then insert into public.consent_events(user_id,kind,accepted) values(p_user,'marketing',p_marketing); end if;
end $$;
create function public.create_order(p_user uuid,p_product text,p_key uuid) returns public.orders language plpgsql set search_path = '' as $$
declare o public.orders; p public.products; seconds integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_product,0));
 select * into o from public.orders where user_id=p_user and request_key=p_key;
 if found then if o.product_id<>p_product then raise exception 'key_conflict'; end if; return o; end if;
 select * into p from public.products where id=p_product and selling=true for share;
 if not found then raise exception 'not_selling'; end if;
 if exists(select 1 from public.orders where user_id=p_user and product_id=p_product and status<>'refunded') then raise exception 'already_owned'; end if;
 select coalesce(sum(duration_seconds),0) into seconds from public.lessons where product_id=p.id and not preview;
 insert into public.orders(user_id,product_id,title,kind,amount,total_paid_seconds,request_key) values(p_user,p.id,p.title,p.kind,p.price,seconds,p_key) returning * into o;
 return o;
end $$;
create function public.prepare_payment(p_user uuid,p_order uuid,p_payment text) returns public.orders language plpgsql set search_path = '' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found then raise exception 'not_found'; end if;
 if o.status not in ('pending','paid') or (o.payment_key is not null and o.payment_key<>p_payment) then raise exception 'payment_conflict'; end if;
 update public.orders set payment_key=p_payment where id=o.id returning * into o; return o;
end $$;
create function public.complete_payment(p_order uuid,p_payment text,p_amount integer,p_paid timestamptz) returns void language plpgsql set search_path = '' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order for update;
 if not found or o.amount<>p_amount or o.payment_key<>p_payment then raise exception 'payment_mismatch'; end if;
 if o.status='paid' then return; end if;
 if o.status<>'pending' then raise exception 'payment_conflict'; end if;
 update public.orders set status='paid',paid_at=p_paid where id=o.id;
 insert into public.entitlements(order_id,user_id,product_id,starts_at,expires_at) values(o.id,o.user_id,o.product_id,p_paid,p_paid+interval '60 days');
end $$;
create function public.used_seconds(p_order uuid) returns integer language sql stable set search_path = '' as $$
 select coalesce(sum(upper(r)-lower(r)),0)::integer from public.lesson_progress pr join public.lessons l on l.id=pr.lesson_id cross join lateral unnest(pr.watched) r where pr.order_id=p_order and not l.preview;
$$;
create function public.start_playback(p_user uuid,p_order uuid,p_lesson text) returns uuid language plpgsql set search_path = '' as $$
declare o public.orders; sid uuid;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found or o.status<>'paid' or not exists(select 1 from public.entitlements where order_id=o.id and not revoked and starts_at<=now() and expires_at>now()) or not exists(select 1 from public.lessons where id=p_lesson and product_id=o.product_id) then raise exception 'no_access'; end if;
 insert into public.playback_sessions(user_id,order_id,lesson_id) values(p_user,o.id,p_lesson) returning id into sid; return sid;
end $$;
create function public.record_progress(p_user uuid,p_session uuid,p_sequence integer,p_position integer,p_playing boolean) returns void language plpgsql set search_path = '' as $$
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
 if p_position<0 or p_position>l.duration_seconds then raise exception 'invalid_position'; end if;
 delta := p_position-s.position; elapsed := extract(epoch from clock_timestamp()-s.last_seen);
 if p_playing and delta>0 and delta<=30 and delta<=elapsed*2+2 then span := int8multirange(int8range(s.position,p_position,'[)')); end if;
 insert into public.lesson_progress as pr(user_id,order_id,lesson_id,position,watched) values(p_user,o.id,l.id,p_position,span)
 on conflict(order_id,lesson_id) do update set position=p_position,watched=pr.watched+span,updated_at=now();
 select coalesce(sum(upper(r)-lower(r)),0) into watched_seconds from public.lesson_progress pr cross join lateral unnest(pr.watched) r where pr.order_id=o.id and pr.lesson_id=l.id;
 update public.lesson_progress set completed=watched_seconds>=ceil(l.duration_seconds*0.9) where order_id=o.id and lesson_id=l.id;
 update public.playback_sessions set sequence=p_sequence,position=p_position,last_seen=clock_timestamp() where id=s.id;
end $$;
create function public.record_download(p_user uuid,p_order uuid) returns text language plpgsql set search_path = '' as $$
declare o public.orders; path text;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found or o.status<>'paid' or not exists(select 1 from public.entitlements where order_id=o.id and not revoked and starts_at<=now() and expires_at>now()) then raise exception 'no_access'; end if;
 select pdf_path into path from public.products where id=o.product_id;
 if path is null then raise exception 'file_missing'; end if;
 insert into public.download_events(order_id,user_id) values(o.id,p_user); return path;
end $$;
create function public.refund_quote(p_user uuid,p_order uuid) returns jsonb language plpgsql set search_path = '' as $$
declare o public.orders; used integer; amount integer; manual boolean;
begin
 select * into o from public.orders where id=p_order and user_id=p_user;
 if not found then raise exception 'not_found'; end if;
 if o.status<>'paid' then raise exception 'refund_conflict'; end if;
 used := least(public.used_seconds(o.id),o.total_paid_seconds);
 amount := o.amount-case when o.total_paid_seconds>0 then ceil(o.amount::numeric*used/o.total_paid_seconds)::integer else 0 end;
 manual := used>0 or exists(select 1 from public.download_events where order_id=o.id) or (o.kind='pdf' and o.paid_at<now()-interval '7 days');
 return jsonb_build_object('orderId',o.id,'title',o.title,'amount',amount,'paidAmount',o.amount,'usedSeconds',used,'totalSeconds',o.total_paid_seconds,'manual',manual,'version',o.policy_version,'expiresAt',now()+interval '5 minutes');
end $$;
create function public.prepare_refund(p_user uuid,p_order uuid,p_key uuid,p_amount integer,p_used integer,p_expires timestamptz) returns public.refunds language plpgsql set search_path = '' as $$
declare o public.orders; r public.refunds; q jsonb;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found then raise exception 'not_found'; end if;
 select * into r from public.refunds where order_id=o.id;
 if found and r.status<>'rejected' then
  if r.request_key<>p_key then raise exception 'refund_conflict'; end if; return r;
 end if;
 if p_expires<now() or p_expires>now()+interval '5 minutes' then raise exception 'quote_expired'; end if;
 q := public.refund_quote(p_user,p_order);
 if (q->>'amount')::integer<>p_amount or (q->>'usedSeconds')::integer<>p_used then raise exception 'quote_changed'; end if;
 insert into public.refunds(order_id,user_id,request_key,amount,used_seconds,status) values(o.id,p_user,p_key,p_amount,p_used,case when (q->>'manual')::boolean then 'review' else 'processing' end)
 on conflict(order_id) do update set request_key=p_key,amount=p_amount,used_seconds=p_used,status=excluded.status,requested_at=now(),reason=null returning * into r;
 update public.orders set status=case when r.status='review' then 'review' else 'refunding' end where id=o.id; return r;
end $$;
create function public.review_refund(p_order uuid,p_approve boolean,p_amount integer,p_reason text) returns public.refunds language plpgsql set search_path = '' as $$
declare o public.orders; r public.refunds;
begin
 select * into o from public.orders where id=p_order for update;
 select * into r from public.refunds where order_id=p_order for update;
 if r.status='processing' and p_approve and r.amount=p_amount then return r; end if;
 if not found or r.status<>'review' or p_amount<0 or p_amount>o.amount or length(trim(p_reason))<1 then raise exception 'refund_conflict'; end if;
 update public.refunds set status=case when p_approve then 'processing' else 'rejected' end,amount=case when p_approve then p_amount else amount end,reason=p_reason where order_id=p_order returning * into r;
 update public.orders set status=case when p_approve then 'refunding' else 'paid' end where id=p_order; return r;
end $$;
create function public.complete_refund(p_order uuid,p_amount integer) returns void language plpgsql set search_path = '' as $$
declare o public.orders; r public.refunds;
begin
 select * into o from public.orders where id=p_order for update;
 select * into r from public.refunds where order_id=p_order for update;
 if not found or r.amount<>p_amount then raise exception 'refund_mismatch'; end if;
 if r.status='completed' then return; end if;
 if r.status<>'processing' or o.status<>'refunding' then raise exception 'refund_conflict'; end if;
 update public.refunds set status='completed',completed_at=now() where order_id=p_order;
 update public.orders set status='refunded' where id=p_order;
 update public.entitlements set revoked=true where order_id=p_order;
end $$;

do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','consent_events','products','chapters','lessons','reviews','orders','entitlements','playback_sessions','lesson_progress','download_events','refunds','request_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
-- Do not expose source file paths or private player identifiers through direct Data API reads.
grant select(id,slug,kind,title,tags,price,base_price,image,poster,published_at,selling,license_days) on public.products to anon,authenticated;
grant select on public.chapters,public.reviews to anon,authenticated;
grant select(id,chapter_id,product_id,title,position,duration_seconds,preview) on public.lessons to anon,authenticated;
create policy catalog_public on public.products for select to anon,authenticated using(true);
create policy chapters_public on public.chapters for select to anon,authenticated using(true);
create policy lessons_public on public.lessons for select to anon,authenticated using(true);
create policy reviews_public on public.reviews for select to anon,authenticated using(true);
do $$ declare t text; begin
 foreach t in array array['profiles','consent_events','orders','entitlements','lesson_progress','download_events','refunds'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 end loop;
end $$;
grant usage,select on all sequences in schema public to service_role;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('consume_limit','save_profile','create_order','prepare_payment','complete_payment','used_seconds','start_playback','record_progress','record_download','refund_quote','prepare_refund','review_refund','complete_refund') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('profile-images','profile-images',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('paid-files','paid-files',false,52428800,array['application/pdf']);
commit;
