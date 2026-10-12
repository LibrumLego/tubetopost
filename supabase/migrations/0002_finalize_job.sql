begin;

create function public.finalize_job(p_job_id uuid, p_post jsonb) returns public.posts
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
  v_post public.posts;
  v_owner uuid;
  v_slug text;
begin
  -- Match enqueue_job's lock order: profile first, then job. This avoids
  -- deadlocks against concurrent enqueues and serializes quota accounting.
  select user_id into v_owner from public.jobs where id = p_job_id;
  if not found then raise exception using errcode = 'P0010', message = 'JOB_NOT_FOUND'; end if;
  perform 1 from public.profiles where id = v_owner for update;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception using errcode = 'P0010', message = 'JOB_NOT_FOUND'; end if;
  if v_job.post_id is not null then raise exception using errcode = 'P0012', message = 'ALREADY_FINALIZED'; end if;
  if v_job.status <> 'finalizing' then raise exception using errcode = 'P0011', message = 'INVALID_STATE'; end if;

  if p_post is null or jsonb_typeof(p_post) <> 'object'
    or jsonb_typeof(p_post->'title') is distinct from 'string'
    or jsonb_typeof(p_post->'content_markdown') is distinct from 'string'
    or jsonb_typeof(p_post->'content_html') is distinct from 'string'
    or jsonb_typeof(p_post->'slug') is distinct from 'string'
    or length(trim(p_post->>'title')) = 0
    or length(trim(p_post->>'content_markdown')) = 0
    or length(trim(p_post->>'content_html')) = 0
    or (p_post->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or length(p_post->>'slug') > 80 then
    raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD';
  end if;
  if p_post ? 'keywords' then
    if jsonb_typeof(p_post->'keywords') <> 'array' then
      raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD';
    end if;
    if exists (select 1 from jsonb_array_elements(p_post->'keywords') item where jsonb_typeof(item) <> 'string') then
      raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD';
    end if;
  end if;
  -- ON CONFLICT handles concurrent slug collisions, unlike exists + insert.
  v_slug := p_post->>'slug';
  loop
    insert into public.posts(user_id, job_id, slug, title, description, keywords, content_markdown, content_html, cover_image_url, is_public)
    values (v_job.user_id, v_job.id, v_slug, p_post->>'title', coalesce(p_post->>'description', ''),
      array(select jsonb_array_elements_text(coalesce(p_post->'keywords', '[]'::jsonb))),
      p_post->>'content_markdown', p_post->>'content_html', p_post->>'cover_image_url', false)
    on conflict (slug) do nothing returning * into v_post;
    exit when found;
    v_slug := (p_post->>'slug') || '-' || substr(gen_random_uuid()::text, 1, 8);
  end loop;
  update public.jobs set post_id = v_post.id, status = 'done', completed_at = now(),
    error_code = null, error_message = null where id = v_job.id;
  update public.profiles set
    used_this_month = case when quota_reset_at <= now() then 1 else used_this_month + 1 end,
    quota_reset_at = case when quota_reset_at <= now()
      then date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' + interval '1 month'
      else quota_reset_at end
    where id = v_job.user_id;
  return v_post;
end;
$$;
revoke all on function public.finalize_job(uuid, jsonb) from public;
grant execute on function public.finalize_job(uuid, jsonb) to service_role;
commit;
