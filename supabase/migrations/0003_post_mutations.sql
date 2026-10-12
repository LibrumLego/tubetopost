begin;

-- Server-owned mutations: authenticated users invoke these RPCs instead of
-- holding direct UPDATE/DELETE grants on public.posts. This mirrors
-- enqueue_job / finalize_job and keeps RLS surface small.

create function public.update_post(p_post_id uuid, p_patch jsonb) returns public.posts
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_post public.posts;
  v_update jsonb := '{}'::jsonb;
  v_html text;
  v_markdown text;
  v_title text;
begin
  if v_user is null then raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD';
  end if;

  select * into v_post from public.posts where id = p_post_id for update;
  if not found then raise exception using errcode = 'P0020', message = 'POST_NOT_FOUND'; end if;
  if v_post.user_id <> v_user then raise exception using errcode = 'P0021', message = 'FORBIDDEN'; end if;

  if p_patch ? 'title' then
    if jsonb_typeof(p_patch->'title') <> 'string' then raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD'; end if;
    v_title := trim(p_patch->>'title');
    if length(v_title) = 0 or length(v_title) > 200 then raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD'; end if;
    v_update := v_update || jsonb_build_object('title', v_title);
  end if;

  if p_patch ? 'content_markdown' then
    if jsonb_typeof(p_patch->'content_markdown') <> 'string' or jsonb_typeof(coalesce(p_patch->'content_html', '""'::jsonb)) <> 'string' then
      raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD';
    end if;
    v_markdown := p_patch->>'content_markdown';
    v_html := p_patch->>'content_html';
    if length(trim(v_markdown)) = 0 or v_html is null or length(trim(v_html)) = 0 then
      raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD';
    end if;
    v_update := v_update || jsonb_build_object('content_markdown', v_markdown, 'content_html', v_html);
  end if;

  if p_patch ? 'is_public' then
    if jsonb_typeof(p_patch->'is_public') <> 'boolean' then raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD'; end if;
    v_update := v_update || jsonb_build_object('is_public', (p_patch->>'is_public')::boolean);
  end if;

  if v_update = '{}'::jsonb then raise exception using errcode = 'P0013', message = 'INVALID_PAYLOAD'; end if;

  update public.posts set
    title = coalesce(v_update->>'title', title),
    content_markdown = coalesce(v_update->>'content_markdown', content_markdown),
    content_html = coalesce(v_update->>'content_html', content_html),
    is_public = coalesce((v_update->>'is_public')::boolean, is_public)
  where id = p_post_id
  returning * into v_post;

  return v_post;
end;
$$;
revoke all on function public.update_post(uuid, jsonb) from public;
grant execute on function public.update_post(uuid, jsonb) to authenticated;

create function public.delete_post(p_post_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_post public.posts;
begin
  if v_user is null then raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED'; end if;
  select * into v_post from public.posts where id = p_post_id for update;
  if not found then return; end if;  -- idempotent delete
  if v_post.user_id <> v_user then raise exception using errcode = 'P0021', message = 'FORBIDDEN'; end if;
  -- Clear jobs.post_id first because the deferred FK validates at commit.
  update public.jobs set post_id = null where post_id = p_post_id;
  delete from public.posts where id = p_post_id;
end;
$$;
revoke all on function public.delete_post(uuid) from public;
grant execute on function public.delete_post(uuid) to authenticated;

-- Public viewers increment counters via a tightly scoped RPC. Only public posts
-- are affected and the function never leaks row data.
create function public.increment_view_count(p_slug text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.posts set view_count = view_count + 1 where slug = p_slug and is_public = true;
end;
$$;
revoke all on function public.increment_view_count(text) from public;
grant execute on function public.increment_view_count(text) to anon, authenticated;

commit;
