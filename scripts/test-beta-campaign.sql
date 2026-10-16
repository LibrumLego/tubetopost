begin;
do $$
declare u uuid:=gen_random_uuid(); j public.jobs; a uuid:=gen_random_uuid(); rejected boolean;
begin
  insert into auth.users(id,email) values(u,'campaign-'||u||'@example.invalid');
  perform set_config('request.jwt.claim.sub',u::text,true);
  update public.beta_limits set enabled=true,starts_at=clock_timestamp()-interval '1 minute',ends_at=clock_timestamp()+interval '1 day',
    daily_supadata_credits=100000,monthly_supadata_credits=100000,total_supadata_credits=1,
    daily_openai_usd=1,monthly_openai_usd=1,total_openai_usd=0.001;
  -- A one-credit campaign cannot advertise capacity for a two-call conversion.
  if (public.beta_status()->>'available')::boolean then raise exception 'Insufficient total capacity advertised'; end if;
  update public.beta_limits set total_supadata_credits=2;
  j:=public.enqueue_job('https://www.youtube.com/watch?v=arj7oStGLkU','arj7oStGLkU');
  update public.beta_limits set starts_at=clock_timestamp()-interval '2 days',ends_at=clock_timestamp()-interval '1 day';
  rejected:=false;
  begin perform public.claim_job_by_id(j.id,a); exception when sqlstate 'P0040' then rejected:=true; end;
  if not rejected or (select status from public.jobs where id=j.id)<>'queued' then raise exception 'Expired campaign claim accepted'; end if;
  update public.beta_limits set starts_at=clock_timestamp()-interval '1 minute',ends_at=clock_timestamp()+interval '1 day';
  perform public.claim_job_by_id(j.id,a);
  perform public.reserve_beta_provider(j.id,a,'supadata_credit',1);
  perform public.reserve_beta_provider(j.id,a,'supadata_credit',1);
  rejected:=false;
  begin perform public.reserve_beta_provider(j.id,a,'supadata_credit',1); exception when sqlstate 'P0040' then rejected:=true; end;
  if not rejected then raise exception 'Campaign credit cap bypass'; end if;
  update public.jobs set status='generating' where id=j.id;
  perform public.reserve_job_cost(j.id,a,0.0006);
  rejected:=false;
  begin perform public.reserve_job_cost(j.id,a,0.0006); exception when sqlstate 'P0040' then rejected:=true; end;
  if not rejected or (select reserved_cost_usd from public.job_attempts where id=a)<>0.0006 then raise exception 'Campaign USD atomic cap failed'; end if;
  update public.beta_limits set starts_at=clock_timestamp()-interval '2 days',ends_at=clock_timestamp()-interval '1 day';
  rejected:=false;
  begin perform public.reserve_beta_provider(j.id,a,'supadata_credit',1); exception when sqlstate 'P0040' then rejected:=true; end;
  if not rejected or (public.beta_status()->>'available')::boolean or (public.beta_public_status()->>'open')::boolean then raise exception 'Expiry guard failed'; end if;
  if has_function_privilege('authenticated','public.beta_status_daily_limits()','EXECUTE') then raise exception 'Window wrapper bypass'; end if;
end $$;
select 'campaign expiry, claim, total credits, atomic USD and public status assertions passed' as result;
rollback;
