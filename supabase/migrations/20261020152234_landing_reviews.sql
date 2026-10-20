begin;
create table public.landing_reviews (
 id text primary key default gen_random_uuid()::text,
 position bigint generated always as identity unique,
 author text not null check (length(btrim(author)) > 0 and length(author) <= 300),
 body text not null check (length(btrim(body)) > 0 and length(body) <= 300),
 image jsonb not null check (jsonb_typeof(image) = 'object' and image ?& array['src','width','height']),
 image_path text
);
alter table public.landing_reviews enable row level security;
revoke all on public.landing_reviews from public, anon, authenticated;
grant select on public.landing_reviews to anon, authenticated;
grant all on public.landing_reviews to service_role;
grant usage, select on sequence public.landing_reviews_position_seq to service_role;
create policy landing_reviews_read on public.landing_reviews for select to anon, authenticated using (true);
insert into public.landing_reviews (id,author,body,image) values
('figma-480-3089','@Feather_','정말 유익하네요 감사합니다','{"src":"/assets/landing/review-480-3089.png","width":354,"height":140,"crop":{"heightPercent":197.14,"topPercent":0}}'::jsonb),
('figma-480-3082','@주민2홍','오늘 시험에서 총 25점을 올렸습니다!!! 영상이 엄청난 도움이 된거 같아요. 여러 꿀팁 다 써먹으며 점수 잘 올렸습니다!! 😊','{"src":"/assets/landing/review-480-3082.png","width":454,"height":149,"crop":{"heightPercent":160.4,"topPercent":-60.4}}'::jsonb),
('figma-480-3079','@iamthegoat_ha','되게 유용하네 유튜브 수학중에 ㅇㅈ함','{"src":"/assets/landing/review-480-3079.png","width":478,"height":184,"crop":{"heightPercent":202.94,"topPercent":-102.94}}'::jsonb),
('figma-480-3084','@오이야묵아야','선생님 오늘 시험보고 온 학생입니다 ㅎㅎ 등차 등비 관련 영상들 다 보고 계속 연습했었는데,,, 연습한 보람이 있었어욕ㅠㅠㅠ 학원 끊고 독학으로 했는데 점수가 10점이 올랐습니다. 정말 감사해요ㅜㅜ','{"src":"/assets/landing/review-480-3084.png","width":362,"height":150}'::jsonb),
('figma-480-3078','@앤드류-t7k','와 진짜 미친풀이네요.. 수학 풀이 보면서 이렇게 감탄한적은 처음입니다 꼭 100점 맞겠습니다','{"src":"/assets/landing/review-480-3078.png","width":478,"height":129,"crop":{"heightPercent":197.52,"topPercent":-97.52}}'::jsonb),
('figma-480-3085','@화스-q2r','수학 뒤지게 잘하시네요 ㅋㅋ','{"src":"/assets/landing/review-480-3085.png","width":478,"height":135,"crop":{"heightPercent":341.48,"topPercent":0}}'::jsonb),
('figma-480-3087','@유자차-t5i','정말 잘봤습니다
진짜 유용하네요 👍👍👍👍👍
구독좋아요알람설정했어요~','{"src":"/assets/landing/review-480-3087.png","width":478,"height":178,"crop":{"heightPercent":258.99,"topPercent":-78.09}}'::jsonb),
('figma-480-3080','@가시광선-f6k','내가 이걸 왜 이제 봤을까....','{"src":"/assets/landing/review-480-3080.png","width":269,"height":109}'::jsonb),
('figma-480-3077','@myunnngg','10:09 지렸습니다','{"src":"/assets/landing/review-480-3077.png","width":478,"height":146,"crop":{"heightPercent":315.75,"topPercent":-215.75}}'::jsonb),
('figma-480-3081','@lysaeng.t','시험보고 왔습니다 선생님.
도움이 많이 됐습니다 앞으로도 열심히 챙겨 보겠습니다.','{"src":"/assets/landing/review-480-3081.png","width":375,"height":153}'::jsonb),
('figma-480-3076','@쉿-d4f','시험 전날에 보고 친 시험 대비 20점 올렸어요','{"src":"/assets/landing/review-480-3076.png","width":286,"height":121}'::jsonb),
('figma-480-3083','@user-bz2il2wv5o','대수는 안 해주시나요ㅠㅠㅠㅠ 빠른수학님 덕분에 작년에 수학 1등급 나왔는데,,ㅠㅠㅠㅠㅠㅠ','{"src":"/assets/landing/review-480-3083.png","width":387,"height":141}'::jsonb);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('landing-review-images','landing-review-images',true,20971520,array['image/webp']);
commit;
