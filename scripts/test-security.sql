begin;
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); j public.jobs; p public.posts;
  a uuid:=gen_random_uuid(); rejected boolean; n integer;
begin
  insert into auth.users(id,email) values(u,'security-'||u||'@example.invalid'),(v,'security-'||v||'@example.invalid');
  perform set_config('request.jwt.claim.sub',u::text,true);
  rejected:=false;
  begin perform public.enqueue_job('http://127.0.0.1/private','arj7oStGLkU'); exception when sqlstate 'P0013' then rejected:=true; end;
  if not rejected then raise exception 'Direct RPC accepts noncanonical URL'; end if;
  j:=public.enqueue_job('https://www.youtube.com/watch?v=arj7oStGLkU','arj7oStGLkU');
  perform public.claim_job_by_id(j.id,a);
  update public.jobs set status='finalizing' where id=j.id;
  p:=public.finalize_job(j.id,jsonb_build_object('title','Security test','content_markdown','Safe body','content_html','<script>stolen()</script>','slug','security-'||u::text),a);
  if p.content_html like '%<script%' then raise exception 'HTML insert bypass'; end if;
  p:=public.update_post(p.id,jsonb_build_object('expected_revision',0,'content_markdown','<img src=x onerror=stolen()>','content_html','<script>stolen()</script>','is_public',true));
  if p.content_html like '%<script%' or p.content_html like '%<img%' then raise exception 'Direct RPC stored active HTML'; end if;
  perform set_config('request.jwt.claim.sub',v::text,true);
  rejected:=false;
  begin perform public.update_post(p.id,jsonb_build_object('expected_revision',1,'title','Stolen')); exception when sqlstate 'P0020' then rejected:=true; end;
  if not rejected then raise exception 'Cross-owner mutation'; end if;
  set local role authenticated;
  if exists(select 1 from public.posts where id=p.id) then raise exception 'Other owner metadata leak'; end if;
  reset role;
  if has_column_privilege('anon','public.posts','user_id','SELECT') or has_column_privilege('anon','public.posts','content_html','SELECT')
    or not has_column_privilege('anon','public.posts','content_markdown','SELECT') then raise exception 'Public column permissions'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  for n in 1..3 loop perform public.request_beta_pack('study','4-10','Security fixture'); end loop;
  rejected:=false;
  begin perform public.request_beta_pack('study','4-10','Blocked'); exception when sqlstate 'P0042' then rejected:=true; end;
  if not rejected then raise exception 'Direct RPC request flood'; end if;
  if has_function_privilege('authenticated','public.consume_security_limit(text,text,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.enqueue_job_before_security(text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.retry_job_before_security(uuid)','EXECUTE')
    or has_function_privilege('anon','public.increment_view_count(text)','EXECUTE') then raise exception 'Internal RPC exposed'; end if;
end $$;
select 'stored HTML, ownership, public columns, URL validation, direct RPC limits and privileges passed' as result;
rollback;
