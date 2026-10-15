begin;

-- Refresh the quota before rendering too, so an exhausted account can submit
-- again after month rollover without first passing the disabled form.
create or replace function public.recover_my_jobs() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='UNAUTHENTICATED'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  update public.profiles set used_this_month=0,
    quota_reset_at=(date_trunc('month',now() at time zone 'UTC')+interval '1 month') at time zone 'UTC'
    where id=auth.uid() and quota_reset_at<=now();
  update public.jobs set status='failed',error_code='JOB_TIMEOUT',
    error_message='작업 응답이 없어 중단했습니다. 다시 시도해 주세요.',completed_at=now(),attempt_id=null,lease_expires_at=null
    where user_id=auth.uid() and (
      (status='queued' and coalesce(started_at,created_at)<now()-interval '1 minute') or
      (status in ('transcribing','generating','finalizing') and coalesce(lease_expires_at,started_at+interval '5 minutes',created_at+interval '5 minutes')<now()));
end $$;

-- Conservative beta envelopes, not supplier invoices. No paid plan is enabled.
create table public.beta_limits (
  id boolean primary key default true check(id),
  enabled boolean not null default true,
  daily_openai_usd numeric not null default 0.10 check(daily_openai_usd>=0),
  monthly_openai_usd numeric not null default 1 check(monthly_openai_usd>=0),
  daily_supadata_credits integer not null default 10 check(daily_supadata_credits>=0),
  monthly_supadata_credits integer not null default 60 check(monthly_supadata_credits>=0),
  max_active integer not null default 1 check(max_active between 1 and 10)
);
insert into public.beta_limits(id) values(true);
create table public.provider_reservations (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.job_attempts(id),
  resource text not null check(resource in ('openai_usd','supadata_credit')),
  amount numeric not null check(amount>0),
  created_at timestamptz not null default clock_timestamp()
);
create index provider_reservations_resource_time on public.provider_reservations(resource,created_at);
alter table public.beta_limits enable row level security;
alter table public.provider_reservations enable row level security;
revoke all on public.beta_limits,public.provider_reservations from public,anon,authenticated;
grant all on public.beta_limits,public.provider_reservations to service_role;
grant usage,select on sequence public.provider_reservations_id_seq to service_role;

create function public.reserve_beta_provider(p_job_id uuid,p_attempt uuid,p_resource text,p_amount numeric) returns void
language plpgsql security definer set search_path='' as $$
declare j public.jobs; owner_id uuid; lim public.beta_limits; daily numeric; monthly numeric;
  t timestamptz:=clock_timestamp(); day_start timestamptz; month_start timestamptz;
begin
  select user_id into owner_id from public.jobs where id=p_job_id;
  perform 1 from public.profiles where id=owner_id for update;
  select * into j from public.jobs where id=p_job_id for update;
  if p_attempt is null or j.attempt_id is distinct from p_attempt or j.lease_expires_at is null
    or j.lease_expires_at<=t or j.status not in ('transcribing','generating') then
    raise exception using errcode='P0034',message='STALE_ATTEMPT';
  end if;
  if p_resource not in ('openai_usd','supadata_credit') or p_resource is null or p_amount is null
    or p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity')
    or (p_resource='supadata_credit' and p_amount<>1) then raise exception 'INVALID_RESERVATION'; end if;
  select * into lim from public.beta_limits where id=true for update;
  if not found or not lim.enabled then raise exception using errcode='P0040',message='SERVICE_LIMIT'; end if;
  t:=clock_timestamp();
  if j.lease_expires_at<=t then raise exception using errcode='P0034',message='STALE_ATTEMPT'; end if;
  day_start:=date_trunc('day',t at time zone 'UTC') at time zone 'UTC';
  month_start:=date_trunc('month',t at time zone 'UTC') at time zone 'UTC';
  select coalesce(sum(amount) filter(where created_at>=day_start),0),coalesce(sum(amount),0)
    into daily,monthly from public.provider_reservations where resource=p_resource and created_at>=month_start;
  if daily+p_amount>(case when p_resource='openai_usd' then lim.daily_openai_usd else lim.daily_supadata_credits end)
    or monthly+p_amount>(case when p_resource='openai_usd' then lim.monthly_openai_usd else lim.monthly_supadata_credits end) then
    raise exception using errcode='P0040',message='SERVICE_LIMIT';
  end if;
  insert into public.provider_reservations(attempt_id,resource,amount) values(p_attempt,p_resource,p_amount);
end $$;
revoke all on function public.reserve_beta_provider(uuid,uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_beta_provider(uuid,uuid,text,numeric) to service_role;

alter function public.reserve_job_cost(uuid,uuid,numeric) rename to reserve_job_cost_user_limit;
revoke all on function public.reserve_job_cost_user_limit(uuid,uuid,numeric) from public,service_role;
create function public.reserve_job_cost(p_job_id uuid,p_attempt uuid,p_amount numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.reserve_job_cost_user_limit(p_job_id,p_attempt,p_amount);
  perform public.reserve_beta_provider(p_job_id,p_attempt,'openai_usd',p_amount);
end $$;
revoke all on function public.reserve_job_cost(uuid,uuid,numeric) from public;
grant execute on function public.reserve_job_cost(uuid,uuid,numeric) to service_role;

alter function public.claim_job_by_id(uuid,uuid) rename to claim_job_by_id_user_limit;
revoke all on function public.claim_job_by_id_user_limit(uuid,uuid) from public,service_role;
create function public.claim_job_by_id(p_job_id uuid,p_attempt uuid) returns setof public.jobs
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; lim public.beta_limits;
begin
  select user_id into owner_id from public.jobs where id=p_job_id;
  perform 1 from public.profiles where id=owner_id for update;
  if not exists(select 1 from public.jobs where id=p_job_id and status='queued') then return; end if;
  select * into lim from public.beta_limits where id=true for update;
  if not found or not lim.enabled then raise exception using errcode='P0040',message='SERVICE_LIMIT'; end if;
  if (select count(*) from public.jobs where status in ('transcribing','generating','finalizing') and lease_expires_at>clock_timestamp())>=lim.max_active then
    raise exception using errcode='P0041',message='SERVICE_BUSY';
  end if;
  return query select * from public.claim_job_by_id_user_limit(p_job_id,p_attempt);
end $$;
revoke all on function public.claim_job_by_id(uuid,uuid) from public;
grant execute on function public.claim_job_by_id(uuid,uuid) to service_role;

create function public.beta_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare lim public.beta_limits; credits_day numeric; credits_month numeric; usd_day numeric; usd_month numeric;
  d timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  m timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='UNAUTHENTICATED'; end if;
  select * into lim from public.beta_limits where id=true;
  select coalesce(sum(amount) filter(where resource='supadata_credit' and created_at>=d),0),
    coalesce(sum(amount) filter(where resource='supadata_credit'),0),
    coalesce(sum(amount) filter(where resource='openai_usd' and created_at>=d),0),
    coalesce(sum(amount) filter(where resource='openai_usd'),0)
    into credits_day,credits_month,usd_day,usd_month from public.provider_reservations where created_at>=m;
  return jsonb_build_object('available',coalesce(lim.enabled and credits_day+2<=lim.daily_supadata_credits
    and credits_month+2<=lim.monthly_supadata_credits and usd_day<lim.daily_openai_usd and usd_month<lim.monthly_openai_usd,false),
    'busy',(select count(*) from public.jobs where status in ('transcribing','generating','finalizing') and lease_expires_at>clock_timestamp())>=lim.max_active);
end $$;
revoke all on function public.beta_status() from public;
grant execute on function public.beta_status() to authenticated;
create or replace function public.enqueue_job(p_youtube_url text,p_video_id text) returns public.jobs
language plpgsql security definer set search_path='' as $$
declare capacity jsonb;
begin
  perform public.recover_my_jobs();
  perform public.check_job_capacity(auth.uid());
  capacity:=public.beta_status();
  if not (capacity->>'available')::boolean then raise exception using errcode='P0040',message='SERVICE_LIMIT'; end if;
  if (capacity->>'busy')::boolean then raise exception using errcode='P0041',message='SERVICE_BUSY'; end if;
  return public.enqueue_job_legacy(p_youtube_url,p_video_id);
end $$;

create table public.beta_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  use_case text not null check(use_case in ('study','content','work','other')),
  expected_monthly text not null check(expected_monthly in ('4-10','11-30','31+')),
  note text not null default '' check(char_length(note)<=500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.beta_requests enable row level security;
revoke all on public.beta_requests from public,anon,authenticated;
grant select on public.beta_requests to authenticated;
grant all on public.beta_requests to service_role;
create policy beta_requests_own on public.beta_requests for select to authenticated using(user_id=auth.uid());
create function public.request_beta_pack(p_use_case text,p_expected_monthly text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='UNAUTHENTICATED'; end if;
  insert into public.beta_requests(user_id,use_case,expected_monthly,note) values(auth.uid(),p_use_case,p_expected_monthly,trim(p_note))
    on conflict(user_id) do update set use_case=excluded.use_case,expected_monthly=excluded.expected_monthly,note=excluded.note,updated_at=now();
end $$;
revoke all on function public.request_beta_pack(text,text,text) from public;
grant execute on function public.request_beta_pack(text,text,text) to authenticated;

-- Anonymous daily aggregates only: no IP, raw referrer, URL, cookie or visitor ID.
create table public.beta_daily_visits (
  day date not null default (now() at time zone 'UTC')::date,
  page text not null check(page in ('landing','login','app','public_post')),
  source text not null check(source in ('direct','search','social','other','internal')),
  views bigint not null default 1,
  primary key(day,page,source)
);
alter table public.beta_daily_visits enable row level security;
revoke all on public.beta_daily_visits from public,anon,authenticated;
grant all on public.beta_daily_visits to service_role;
create function public.record_beta_visit(p_page text,p_source text) returns void
language sql security definer set search_path='' as $$
  insert into public.beta_daily_visits(page,source) values(p_page,p_source)
    on conflict(day,page,source) do update set views=public.beta_daily_visits.views+1;
$$;
revoke all on function public.record_beta_visit(text,text) from public,anon,authenticated;
grant execute on function public.record_beta_visit(text,text) to service_role;
commit;
