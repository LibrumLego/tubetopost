-- Synthetic data and budget changes are rolled back. No supplier calls.
begin;
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); j public.jobs; k public.jobs;
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); rejected boolean; baseline numeric; n bigint;
begin
  insert into auth.users(id,email) values(u,'beta-'||u||'@example.invalid'),(v,'beta-'||v||'@example.invalid');
  perform set_config('request.jwt.claim.sub',u::text,true);
  update public.profiles set used_this_month=3,quota_reset_at=now()-interval '1 second' where id=u;
  perform public.recover_my_jobs();
  if (select used_this_month from public.profiles where id=u)<>0 then raise exception 'Quota rollover failed'; end if;
  j:=public.enqueue_job('https://www.youtube.com/watch?v=arj7oStGLkU','arj7oStGLkU');
  update public.beta_limits set enabled=true,max_active=1;
  perform set_config('request.jwt.claim.sub',v::text,true);
  k:=public.enqueue_job('https://www.youtube.com/watch?v=arj7oStGLkU','arj7oStGLkU');
  perform public.claim_job_by_id(j.id,a);
  rejected:=false;
  begin perform public.claim_job_by_id(k.id,b); exception when sqlstate 'P0041' then rejected:=true; end;
  if not rejected or exists(select 1 from public.job_attempts where id=b) then raise exception 'Global concurrency bypass'; end if;
  select coalesce(sum(amount),0) into baseline from public.provider_reservations where resource='supadata_credit'
    and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  update public.beta_limits set daily_supadata_credits=baseline+1,monthly_supadata_credits=100000;
  perform public.reserve_beta_provider(j.id,a,'supadata_credit',1);
  rejected:=false;
  begin perform public.reserve_beta_provider(j.id,a,'supadata_credit',1); exception when sqlstate 'P0040' then rejected:=true; end;
  if not rejected then raise exception 'Daily transcript cap bypass'; end if;
  select count(*) into n from public.provider_reservations where attempt_id=a;
  if n<>1 then raise exception 'Rejected credit reservation was retained'; end if;
  select coalesce(sum(amount),0) into baseline from public.provider_reservations where resource='supadata_credit'
    and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  update public.beta_limits set daily_supadata_credits=100000,monthly_supadata_credits=baseline;
  rejected:=false;
  begin perform public.reserve_beta_provider(j.id,a,'supadata_credit',1); exception when sqlstate 'P0040' then rejected:=true; end;
  if not rejected then raise exception 'Monthly transcript cap bypass'; end if;
  update public.jobs set status='generating' where id=j.id;
  update public.beta_limits set daily_openai_usd=0,monthly_openai_usd=0;
  rejected:=false;
  begin perform public.reserve_job_cost(j.id,a,0.001); exception when sqlstate 'P0040' then rejected:=true; end;
  if not rejected or (select reserved_cost_usd from public.job_attempts where id=a)<>0 then raise exception 'Atomic model reservation rollback failed'; end if;
  rejected:=false;
  begin perform public.reserve_beta_provider(j.id,b,'supadata_credit',1); exception when sqlstate 'P0034' then rejected:=true; end;
  if not rejected then raise exception 'Stale attempt reserved credit'; end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.request_beta_pack('study','4-10','Test feedback');
  perform public.request_beta_pack('work','11-30','Updated feedback');
  if (select count(*) from public.beta_requests where user_id=u)<>1 or (select use_case from public.beta_requests where user_id=u)<>'work' then raise exception 'Request upsert failed'; end if;
  if has_function_privilege('anon','public.record_beta_visit(text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.reserve_beta_provider(uuid,uuid,text,numeric)','EXECUTE')
    or has_function_privilege('service_role','public.reserve_job_cost_user_limit(uuid,uuid,numeric)','EXECUTE')
    or has_function_privilege('service_role','public.claim_job_by_id_user_limit(uuid,uuid)','EXECUTE') then raise exception 'Protected RPC bypass'; end if;
  perform set_config('request.jwt.claim.sub',v::text,true);
  set local role authenticated;
  if exists(select 1 from public.beta_requests where user_id=u) then raise exception 'Other user request leaked'; end if;
  reset role;
end $$;
select 'beta budget, concurrency, rollback, stale attempt, request and RLS assertions passed' as result;
rollback;
