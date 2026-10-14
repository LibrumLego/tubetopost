begin;
alter table public.jobs add column attempt_id uuid, add column lease_expires_at timestamptz,
  add column error_stage text,
  add column reserved_cost_usd numeric(10,6) not null default 0 check (reserved_cost_usd >= 0);
alter table public.posts add column revision integer not null default 0;
create table public.job_attempts (
  id uuid primary key, job_id uuid not null references public.jobs(id), user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), reserved_cost_usd numeric(10,6) not null default 0
);
create index job_attempts_user_month on public.job_attempts(user_id,created_at);
alter table public.job_attempts enable row level security;
revoke all on public.job_attempts from public,anon,authenticated;
grant select on public.job_attempts to authenticated;
grant all on public.job_attempts to service_role;
create policy attempts_select_own on public.job_attempts for select to authenticated using (user_id=auth.uid());

create function public.recover_my_jobs() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using errcode='P0001', message='UNAUTHENTICATED'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  update public.jobs set status='failed', error_code='JOB_TIMEOUT',
    error_message='작업 응답이 없어 중단했습니다. 다시 시도해 주세요.', completed_at=now(), attempt_id=null, lease_expires_at=null
  where user_id=auth.uid() and (
    (status='queued' and coalesce(started_at,created_at) < now()-interval '1 minute') or
    (status in ('transcribing','generating','finalizing') and coalesce(lease_expires_at,started_at+interval '5 minutes',created_at+interval '5 minutes') < now()));
end $$;
revoke all on function public.recover_my_jobs() from public;
grant execute on function public.recover_my_jobs() to authenticated;

create function public.check_job_capacity(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.jobs where user_id=p_user and status in ('queued','transcribing','generating','finalizing')) then
    raise exception using errcode='P0030',message='CONCURRENT_LIMIT';
  end if;
  if (select count(*) from public.job_attempts where user_id=p_user and created_at>=date_trunc('month',now())) >=30
    or (select coalesce(sum(reserved_cost_usd),0) from public.job_attempts where user_id=p_user and created_at>=date_trunc('month',now())) >=1 then
    raise exception using errcode='P0031',message='MONTHLY_BUDGET';
  end if;
end $$;
revoke all on function public.check_job_capacity(uuid) from public;

alter function public.enqueue_job(text,text) rename to enqueue_job_legacy;
revoke all on function public.enqueue_job_legacy(text,text) from public,authenticated;
create function public.enqueue_job(p_youtube_url text,p_video_id text) returns public.jobs
language plpgsql security definer set search_path='' as $$
begin
  perform public.recover_my_jobs();
  perform public.check_job_capacity(auth.uid());
  return public.enqueue_job_legacy(p_youtube_url,p_video_id);
end $$;
revoke all on function public.enqueue_job(text,text) from public;
grant execute on function public.enqueue_job(text,text) to authenticated;

create function public.retry_job(p_job_id uuid) returns public.jobs
language plpgsql security definer set search_path='' as $$
declare j public.jobs; p public.profiles;
begin
  perform public.recover_my_jobs();
  select * into p from public.profiles where id=auth.uid() for update;
  select * into j from public.jobs where id=p_job_id and user_id=auth.uid() for update;
  if not found then raise exception using errcode='P0032',message='JOB_NOT_FOUND'; end if;
  if j.status<>'failed' or j.post_id is not null or j.retry_count>=3 then
    raise exception using errcode='P0033',message='RETRY_NOT_ALLOWED';
  end if;
  perform public.check_job_capacity(auth.uid());
  if p.quota_reset_at>now() and p.used_this_month>=p.monthly_quota then
    raise exception using errcode='P0003',message='QUOTA_EXCEEDED';
  end if;
  update public.jobs set status='queued',error_code=null,error_message=null,started_at=now(),completed_at=null,
    attempt_id=null,lease_expires_at=null,retry_count=retry_count+1 where id=j.id returning * into j;
  return j;
end $$;
revoke all on function public.retry_job(uuid) from public;
grant execute on function public.retry_job(uuid) to authenticated;

create function public.claim_job_by_id(p_job_id uuid,p_attempt uuid) returns setof public.jobs
language plpgsql security definer set search_path='' as $$
declare j public.jobs; owner_id uuid;
begin
  if p_attempt is null then raise exception 'ATTEMPT_REQUIRED'; end if;
  select user_id into owner_id from public.jobs where id=p_job_id;
  perform 1 from public.profiles where id=owner_id for update;
  if (select count(*) from public.job_attempts where user_id=owner_id and created_at>=date_trunc('month',now()))>=30 then
    raise exception using errcode='P0031',message='MONTHLY_BUDGET';
  end if;
  update public.jobs set status='transcribing',started_at=now(),attempt_id=p_attempt,
    lease_expires_at=now()+interval '5 minutes'
    where id=p_job_id and status='queued' returning * into j;
  if found then
    insert into public.job_attempts(id,job_id,user_id) values(p_attempt,j.id,j.user_id);
    return next j;
  end if;
end $$;
revoke all on function public.claim_job_by_id(uuid,uuid) from public;
grant execute on function public.claim_job_by_id(uuid,uuid) to service_role;
revoke all on function public.claim_job() from service_role;

create function public.reserve_job_cost(p_job_id uuid,p_attempt uuid,p_amount numeric) returns void
language plpgsql security definer set search_path='' as $$
declare j public.jobs; owner_id uuid; total numeric;
begin
  select user_id into owner_id from public.jobs where id=p_job_id;
  perform 1 from public.profiles where id=owner_id for update;
  select * into j from public.jobs where id=p_job_id for update;
  if p_attempt is null or j.attempt_id is null or j.attempt_id is distinct from p_attempt or j.lease_expires_at is null or j.lease_expires_at<now() or j.status not in ('generating','transcribing') then
    raise exception using errcode='P0034',message='STALE_ATTEMPT';
  end if;
  select coalesce(sum(reserved_cost_usd),0) into total from public.job_attempts where user_id=owner_id and created_at>=date_trunc('month',now());
  if p_amount is null or p_amount<=0 or p_amount>0.05 or j.reserved_cost_usd+p_amount>0.10 or total+p_amount>1
    or (select reserved_cost_usd from public.job_attempts where id=p_attempt)+p_amount>0.05 then
    raise exception using errcode='P0035',message='COST_LIMIT';
  end if;
  update public.jobs set reserved_cost_usd=reserved_cost_usd+p_amount where id=p_job_id;
  update public.job_attempts set reserved_cost_usd=reserved_cost_usd+p_amount where id=p_attempt;
end $$;
revoke all on function public.reserve_job_cost(uuid,uuid,numeric) from public;
grant execute on function public.reserve_job_cost(uuid,uuid,numeric) to service_role;

alter function public.finalize_job(uuid,jsonb) rename to finalize_job_legacy;
revoke all on function public.finalize_job_legacy(uuid,jsonb) from public,service_role;
create function public.finalize_job(p_job_id uuid,p_post jsonb,p_attempt uuid) returns public.posts
language plpgsql security definer set search_path='' as $$
declare j public.jobs; owner_id uuid;
begin
  select user_id into owner_id from public.jobs where id=p_job_id;
  perform 1 from public.profiles where id=owner_id for update;
  select * into j from public.jobs where id=p_job_id for update;
  if p_attempt is null or j.attempt_id is null or j.attempt_id is distinct from p_attempt or j.lease_expires_at is null or j.lease_expires_at<now() then
    raise exception using errcode='P0034',message='STALE_ATTEMPT';
  end if;
  return public.finalize_job_legacy(p_job_id,p_post);
end $$;
revoke all on function public.finalize_job(uuid,jsonb,uuid) from public;
grant execute on function public.finalize_job(uuid,jsonb,uuid) to service_role;

alter function public.update_post(uuid,jsonb) rename to update_post_legacy;
revoke all on function public.update_post_legacy(uuid,jsonb) from public,authenticated;
create function public.update_post(p_post_id uuid,p_patch jsonb) returns public.posts
language plpgsql security definer set search_path='' as $$
declare p public.posts;
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='UNAUTHENTICATED'; end if;
  select * into p from public.posts where id=p_post_id and user_id=auth.uid() for update;
  if not found then raise exception using errcode='P0020',message='POST_NOT_FOUND'; end if;
  if jsonb_typeof(p_patch->'expected_revision') is distinct from 'number' then
    raise exception using errcode='P0013',message='REVISION_REQUIRED';
  end if;
  if (p_patch->>'expected_revision')::numeric<>p.revision then
    raise exception using errcode='P0036',message='EDIT_CONFLICT';
  end if;
  perform public.update_post_legacy(p_post_id,p_patch);
  update public.posts set revision=revision+1 where id=p_post_id returning * into p;
  return p;
end $$;
revoke all on function public.update_post(uuid,jsonb) from public;
grant execute on function public.update_post(uuid,jsonb) to authenticated;
commit;
