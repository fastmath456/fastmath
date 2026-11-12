-- Run against the migrated schema; all test changes are rolled back.
begin;
do $$
declare
 owner uuid; thumb uuid:=gen_random_uuid(); image_a uuid:=gen_random_uuid(); image_b uuid:=gen_random_uuid();
 draft_id uuid:=gen_random_uuid(); edit_id uuid:=gen_random_uuid(); review_a uuid:=gen_random_uuid(); review_b uuid:=gen_random_uuid();
 chapter_id text:=gen_random_uuid()::text; lesson_id text:=gen_random_uuid()::text;
 doc jsonb; edited jsonb; result record; original_date timestamptz; original_published timestamptz; bad text;
begin
 select user_id into owner from public.user_roles where role='admin' limit 1;
 if owner is null then raise exception 'authoring test requires an existing administrator'; end if;
 assert public.mask_course_review_author('김')='*';
 assert public.mask_course_review_author('김수')='김*';
 assert public.mask_course_review_author('김민수')='김*수';
 assert public.mask_course_review_author('김*수')='김*수';
 assert not has_table_privilege('anon','public.course_review_authors','select');
 assert not has_table_privilege('authenticated','public.course_review_authors','select');
 assert not has_function_privilege('anon','public.publish_course_draft(uuid,uuid,integer)','execute');
 insert into public.admin_course_assets(id,owner_id,slot,path,name,size_bytes,checksum,content_type) values
 (thumb,owner,'thumbnail','authoring-test/'||thumb,'thumb.png',1,repeat('a',64),'image/png'),
 (image_a,owner,'detailImage','authoring-test/'||image_a,'a.png',1,repeat('b',64),'image/png'),
 (image_b,owner,'detailImage','authoring-test/'||image_b,'b.png',1,repeat('c',64),'image/png');
 insert into public.verified_videos(owner_id,url,embed_url,duration_seconds) values(owner,'https://vimeo.com/123456789?test='||draft_id,'https://player.vimeo.com/video/123456789?autoplay=0',60);
 doc:=jsonb_build_object('basic',jsonb_build_object('title','authoring rollback test','basePrice','1000','price','900','licenseDays','60','displayOrder',' 007 ',
 'thumbnail',jsonb_build_object('id',thumb),'detailImages',jsonb_build_array(jsonb_build_object('id',image_a),jsonb_build_object('id',image_b)),'materials','[]'::jsonb,
 'reviews',jsonb_build_array(jsonb_build_object('id',review_a,'rating',2,'body',E'첫 줄\n둘째 줄 😊','author','김민수'),jsonb_build_object('id',review_b,'rating',5,'body','두번째','author','박수'),jsonb_build_object('id',gen_random_uuid(),'rating',null,'body','','author',''))),
 'step',2,'selectedLessonId',lesson_id,'chapters',jsonb_build_array(jsonb_build_object('id',chapter_id,'title','chapter','lessons',jsonb_build_array(jsonb_build_object('id',lesson_id,'title','lesson','inputUrl','https://vimeo.com/123456789?test='||draft_id,'video',jsonb_build_object('url','https://vimeo.com/123456789?test='||draft_id,'embedUrl','https://player.vimeo.com/video/123456789?autoplay=0','durationSeconds',60))))));
 insert into public.course_drafts(id,owner_id,document) values(draft_id,owner,doc);
 select * into result from public.publish_course_draft(owner,draft_id,1);
 assert (select display_order=7 from public.products where id=result.course_id);
 assert (select array_agg(asset_id order by position)=array[image_a,image_b] from public.product_assets where product_id=result.course_id and role='detailImage');
 assert (select count(*)=2 from public.reviews where product_id=result.course_id);
 assert (select author='김*수' and body=E'첫 줄\n둘째 줄 😊' and rating=2 and position=0 from public.reviews where id=review_a);
 assert (select author='김민수' and created_by=owner from public.course_review_authors where review_id=review_a);
 select created_at into original_date from public.reviews where id=review_a;
 select published_at into original_published from public.products where id=result.course_id;
 perform public.publish_course_draft(owner,draft_id,1);
 assert (select count(*)=2 from public.reviews where product_id=result.course_id);
 edited:=jsonb_set(doc,'{basic,detailImages}',jsonb_build_array(jsonb_build_object('id',image_b)));
 edited:=jsonb_set(edited,'{basic,displayOrder}','"0"');
 edited:=jsonb_set(edited,'{basic,reviews}',jsonb_build_array(jsonb_build_object('id',review_a,'rating',3,'body','수정한 후기','author','김민수')));
 insert into public.course_drafts(id,owner_id,course_id,document) values(edit_id,owner,result.course_id,edited);
 assert (select rating=2 from public.reviews where id=review_a);
 perform public.publish_course_draft(owner,edit_id,1);
 assert (select array_agg(asset_id)=array[image_b] from public.product_assets where product_id=result.course_id and role='detailImage');
 assert (select count(*)=1 from public.reviews where product_id=result.course_id);
 assert not exists(select 1 from public.course_review_authors where review_id=review_b);
 assert (select rating=3 and body='수정한 후기' and created_at=original_date from public.reviews where id=review_a);
 assert (select display_order=0 and published_at=original_published from public.products where id=result.course_id);
 foreach bad in array array['','-1','1.5','1e3','2147483648'] loop
  begin
   edit_id:=gen_random_uuid();
   insert into public.course_drafts(id,owner_id,course_id,document) values(edit_id,owner,result.course_id,jsonb_set(edited,'{basic,displayOrder}',to_jsonb(bad)));
   perform public.publish_course_draft(owner,edit_id,1);
   raise exception 'test accepted invalid order: %',bad;
  exception when others then if sqlerrm<>'invalid_draft' then raise; end if; end;
 end loop;
 begin
  edit_id:=gen_random_uuid();
  insert into public.course_drafts(id,owner_id,course_id,document) values(edit_id,owner,result.course_id,jsonb_set(edited,'{basic,reviews,0,rating}','6'));
  perform public.publish_course_draft(owner,edit_id,1);
  raise exception 'test accepted invalid review';
 exception when others then if sqlerrm<>'invalid_draft' then raise; end if; end;
 assert (select rating=3 from public.reviews where id=review_a);
end $$;
rollback;
