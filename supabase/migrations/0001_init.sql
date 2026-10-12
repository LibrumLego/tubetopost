begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  monthly_quota integer not null default 3 check (monthly_quota >= 0),
  used_this_month integer not null default 0 check (used_this_month >= 0),
  quota_reset_at timestamptz not null default (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  youtube_url text not null,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_title text,
  video_duration_sec integer check (video_duration_sec >= 0),
  video_thumbnail_url text,
  status text not null default 'queued' check (status in ('queued', 'transcribing', 'generating', 'finalizing', 'done', 'failed')),
  error_code text,
  error_message text,
  transcript_source text check (transcript_source in ('youtube_captions', 'whisper')),
  transcript text,
  post_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  retry_count integer not null default 0 check (retry_count between 0 and 3),
  unique (id, user_id),
  check (status <> 'done' or (post_id is not null and completed_at is not null))
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null unique,
  slug text not null unique,
  title text not null,
  description text not null default '',
  keywords text[] not null default '{}',
  content_markdown text not null,
  content_html text not null,
  cover_image_url text,
  is_public boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, job_id, user_id),
  foreign key (job_id, user_id) references public.jobs(id, user_id) on delete cascade
);

-- Ensure a job cannot point at another job's or another user's post.
alter table public.jobs add constraint jobs_post_owner_fk
  foreign key (post_id, id, user_id) references public.posts(id, job_id, user_id)
  deferrable initially deferred;

create table public.usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid,
  provider text not null default 'openai',
  operation text not null check (operation in ('whisper', 'chat')),
  model text not null,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  audio_seconds integer check (audio_seconds >= 0),
  cost_usd numeric(10,6) not null check (cost_usd >= 0),
  created_at timestamptz not null default now(),
  foreign key (job_id, user_id) references public.jobs(id, user_id) on delete cascade
);

create index jobs_user_created_idx on public.jobs(user_id, created_at desc, id desc);
create index jobs_queue_idx on public.jobs(status, created_at);
create index jobs_video_idx on public.jobs(video_id);
create unique index jobs_active_video_idx on public.jobs(user_id, video_id)
  where status in ('queued', 'transcribing', 'generating', 'finalizing');
create index posts_user_created_idx on public.posts(user_id, created_at desc);
create index posts_public_views_idx on public.posts(view_count desc) where is_public;
create index usage_user_created_idx on public.usage_logs(user_id, created_at desc);
create index usage_job_idx on public.usage_logs(job_id);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.posts enable row level security;
alter table public.usage_logs enable row level security;

-- Mutations go through server-owned operations. RLS alone does not protect
-- quota, status, ownership, rendered HTML, or billing columns from modification.
revoke all on public.profiles, public.jobs, public.posts, public.usage_logs from anon, authenticated;
grant select on public.profiles, public.jobs, public.posts, public.usage_logs to authenticated;
grant select on public.posts to anon;
grant all on public.profiles, public.jobs, public.posts, public.usage_logs to service_role;
grant usage, select on sequence public.usage_logs_id_seq to service_role;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy jobs_select_own on public.jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy posts_select_own_or_public on public.posts for select to anon, authenticated
  using ((select auth.uid()) = user_id or is_public);
create policy usage_logs_select_own on public.usage_logs for select to authenticated using ((select auth.uid()) = user_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id, email) select id, email from auth.users on conflict (id) do nothing;

-- Lock the profile before checking quota so concurrent requests cannot exceed it.
-- Active jobs reserve capacity; failed jobs release it, done jobs consume it.
create function public.enqueue_job(p_youtube_url text, p_video_id text) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_job public.jobs;
  v_active integer;
begin
  if v_user is null then raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED'; end if;
  select * into v_profile from public.profiles where id = v_user for update;
  if not found then raise exception using errcode = 'P0004', message = 'PROFILE_NOT_FOUND'; end if;
  if v_profile.quota_reset_at <= now() then
    update public.profiles set used_this_month = 0,
      quota_reset_at = date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' + interval '1 month'
      where id = v_user returning * into v_profile;
  end if;
  if exists (select 1 from public.jobs where user_id = v_user and video_id = p_video_id
    and status in ('queued', 'transcribing', 'generating', 'finalizing')) then
    raise exception using errcode = 'P0002', message = 'ALREADY_PROCESSING';
  end if;
  select count(*) into v_active from public.jobs where user_id = v_user
    and status in ('queued', 'transcribing', 'generating', 'finalizing');
  if v_profile.used_this_month + v_active >= v_profile.monthly_quota then
    raise exception using errcode = 'P0003', message = 'QUOTA_EXCEEDED';
  end if;
  insert into public.jobs(user_id, youtube_url, video_id) values (v_user, p_youtube_url, p_video_id) returning * into v_job;
  return v_job;
end;
$$;
revoke all on function public.enqueue_job(text, text) from public;
grant execute on function public.enqueue_job(text, text) to authenticated;

create function public.claim_job() returns setof public.jobs
language plpgsql set search_path = '' as $$
declare v_job public.jobs;
begin
  select * into v_job from public.jobs where status = 'queued'
    order by created_at, id limit 1 for update skip locked;
  if not found then return; end if;
  update public.jobs set status = 'transcribing', started_at = now()
    where id = v_job.id returning * into v_job;
  return next v_job;
end;
$$;
revoke all on function public.claim_job() from public;
grant execute on function public.claim_job() to service_role;

commit;
