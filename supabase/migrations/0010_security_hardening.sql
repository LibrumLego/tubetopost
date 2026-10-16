begin;
create table public.security_buckets (
  actor text not null, scope text not null,
  minute timestamptz not null default date_trunc('minute',now()),
  hits integer not null check(hits>0), primary key(actor,scope,minute)
);
alter table public.security_buckets enable row level security;
revoke all on public.security_buckets from public,anon,authenticated;
grant all on public.security_buckets to service_role;
create function public.consume_security_limit(p_actor text,p_scope text,p_max integer) returns void
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  insert into public.security_buckets(actor,scope,hits) values(p_actor,p_scope,1)
    on conflict(actor,scope,minute) do update set hits=public.security_buckets.hits+1 returning hits into n;
  if n>p_max then raise exception using errcode='P0042',message='RATE_LIMIT'; end if;
end $$;
revoke all on function public.consume_security_limit(text,text,integer) from public,anon,authenticated,service_role;

-- Users can call RPCs directly. Keep the stored HTML cache inert even when the
-- Next.js sanitizer is bypassed. Rendering regenerates sanitized Markdown.
create function public.guard_post_content() returns trigger
language plpgsql set search_path='' as $$
begin
  if length(new.title) not between 1 and 200 or length(new.content_markdown) not between 1 and 50000
    or length(new.description)>1000 or cardinality(new.keywords)>20
    or length(new.slug)>120 or new.slug!~'^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode='P0013',message='INVALID_PAYLOAD';
  end if;
  if tg_op='INSERT' or new.content_markdown is distinct from old.content_markdown or new.content_html is distinct from old.content_html then
    new.content_html:='<p>'||replace(replace(replace(new.content_markdown,'&','&amp;'),'<','&lt;'),'>','&gt;')||'</p>';
  end if;
  return new;
end $$;
revoke all on function public.guard_post_content() from public;
create trigger posts_guard_content before insert or update on public.posts for each row execute function public.guard_post_content();

-- Replace the last wrapper, rather than exposing an executable legacy bypass.
create or replace function public.update_post(p_post_id uuid,p_patch jsonb) returns public.posts
language plpgsql security definer set search_path='' as $$
declare p public.posts;
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='UNAUTHENTICATED'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or octet_length(p_patch::text)>510000 then
    raise exception using errcode='P0013',message='INVALID_PAYLOAD'; end if;
  select * into p from public.posts where id=p_post_id and user_id=auth.uid() for update;
  if not found then raise exception using errcode='P0020',message='POST_NOT_FOUND'; end if;
  if jsonb_typeof(p_patch->'expected_revision') is distinct from 'number' then raise exception using errcode='P0013',message='REVISION_REQUIRED'; end if;
  if (p_patch->>'expected_revision')::numeric<>p.revision then raise exception using errcode='P0036',message='EDIT_CONFLICT'; end if;
  perform public.consume_security_limit(auth.uid()::text,'post_edit',30);
  perform public.update_post_legacy(p_post_id,p_patch);
  update public.posts set revision=revision+1 where id=p_post_id returning * into p;
  return p;
end $$;

alter function public.enqueue_job(text,text) rename to enqueue_job_before_security;
revoke all on function public.enqueue_job_before_security(text,text) from public,authenticated;
create function public.enqueue_job(p_youtube_url text,p_video_id text) returns public.jobs
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='UNAUTHENTICATED'; end if;
  if p_video_id is null or p_video_id!~'^[A-Za-z0-9_-]{11}$' or p_youtube_url is distinct from 'https://www.youtube.com/watch?v='||p_video_id then
    raise exception using errcode='P0013',message='INVALID_URL'; end if;
  perform public.consume_security_limit(auth.uid()::text,'job_create',10);
  return public.enqueue_job_before_security(p_youtube_url,p_video_id);
end $$;
revoke all on function public.enqueue_job(text,text) from public;
grant execute on function public.enqueue_job(text,text) to authenticated;

alter function public.retry_job(uuid) rename to retry_job_before_security;
revoke all on function public.retry_job_before_security(uuid) from public,authenticated;
create function public.retry_job(p_job_id uuid) returns public.jobs
language plpgsql security definer set search_path='' as $$
declare capacity jsonb;
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='UNAUTHENTICATED'; end if;
  -- Verify ownership before reporting service capacity.
  if not exists(select 1 from public.jobs where id=p_job_id and user_id=auth.uid()) then raise exception using errcode='P0032',message='JOB_NOT_FOUND'; end if;
  capacity:=public.beta_status();
  if not (capacity->>'available')::boolean then raise exception using errcode='P0040',message='SERVICE_LIMIT'; end if;
  if (capacity->>'busy')::boolean then raise exception using errcode='P0041',message='SERVICE_BUSY'; end if;
  perform public.consume_security_limit(auth.uid()::text,'job_retry',5);
  return public.retry_job_before_security(p_job_id);
end $$;
revoke all on function public.retry_job(uuid) from public;
grant execute on function public.retry_job(uuid) to authenticated;

create or replace function public.request_beta_pack(p_use_case text,p_expected_monthly text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='UNAUTHENTICATED'; end if;
  if p_note is null or length(p_note)>500 then raise exception using errcode='P0013',message='INVALID_PAYLOAD'; end if;
  perform public.consume_security_limit(auth.uid()::text,'beta_request',3);
  insert into public.beta_requests(user_id,use_case,expected_monthly,note) values(auth.uid(),p_use_case,p_expected_monthly,trim(p_note))
    on conflict(user_id) do update set use_case=excluded.use_case,expected_monthly=excluded.expected_monthly,note=excluded.note,updated_at=now();
end $$;
create or replace function public.record_beta_visit(p_page text,p_source text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.consume_security_limit('global','beta_visit',120);
  insert into public.beta_daily_visits(page,source) values(p_page,p_source)
    on conflict(day,page,source) do update set views=public.beta_daily_visits.views+1;
end $$;
create or replace function public.increment_view_count(p_slug text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_slug is null or length(p_slug)>120 or p_slug!~'^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception using errcode='P0013',message='INVALID_SLUG'; end if;
  perform public.consume_security_limit('global','post_view',120);
  update public.posts set view_count=least(view_count::bigint+1,2147483647)::integer where slug=p_slug and is_public=true;
end $$;
revoke all on function public.increment_view_count(text) from public,anon,authenticated;
grant execute on function public.increment_view_count(text) to service_role;

-- Public rendering never needs ownership, job identifiers or raw HTML caches.
drop policy posts_select_own_or_public on public.posts;
create policy posts_select_own on public.posts for select to authenticated using(user_id=auth.uid());
create policy posts_select_public on public.posts for select to anon using(is_public);
revoke select on public.posts from anon;
grant select(id,slug,title,description,keywords,content_markdown,cover_image_url,is_public,view_count,created_at,updated_at) on public.posts to anon;

select cron.schedule('security-bucket-cleanup','17 3 * * *', $q$delete from public.security_buckets where minute<now()-interval '7 days'$q$);
commit;
