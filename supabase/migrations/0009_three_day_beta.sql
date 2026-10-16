begin;
alter table public.beta_limits
  add column starts_at timestamptz not null default clock_timestamp(),
  add column ends_at timestamptz not null default (clock_timestamp()+interval '72 hours'),
  add column total_openai_usd numeric not null default 0.30 check(total_openai_usd>=0),
  add column total_supadata_credits integer not null default 30 check(total_supadata_credits>=0),
  add constraint beta_window_order check(ends_at>starts_at);

-- Called from both reservation insertion and worker claim; locks serialize the
-- full campaign envelope even across UTC daily/monthly boundaries.
create function public.enforce_beta_campaign() returns trigger
language plpgsql security definer set search_path='' as $$
declare lim public.beta_limits; used numeric;
begin
  select * into lim from public.beta_limits where id=true for update;
  if not found or not lim.enabled or clock_timestamp()<lim.starts_at or clock_timestamp()>=lim.ends_at then
    raise exception using errcode='P0040',message='SERVICE_LIMIT';
  end if;
  if tg_table_name='provider_reservations' then
    select coalesce(sum(amount),0) into used from public.provider_reservations
      where resource=new.resource and created_at>=lim.starts_at;
    if used+new.amount>(case when new.resource='openai_usd' then lim.total_openai_usd else lim.total_supadata_credits end) then
      raise exception using errcode='P0040',message='SERVICE_LIMIT';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.enforce_beta_campaign() from public,anon,authenticated;
create trigger beta_campaign_reservation before insert on public.provider_reservations
  for each row execute function public.enforce_beta_campaign();
create trigger beta_campaign_claim before update of status on public.jobs
  for each row when(old.status='queued' and new.status='transcribing') execute function public.enforce_beta_campaign();

create function public.beta_public_status() returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('starts_at',starts_at,'ends_at',ends_at,
    'open',enabled and clock_timestamp()>=starts_at and clock_timestamp()<ends_at,
    'daily_credits',daily_supadata_credits,'total_credits',total_supadata_credits)
  from public.beta_limits where id=true;
$$;
revoke all on function public.beta_public_status() from public;
grant execute on function public.beta_public_status() to anon,authenticated;

alter function public.beta_status() rename to beta_status_daily_limits;
revoke all on function public.beta_status_daily_limits() from public,authenticated;
create function public.beta_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; lim public.beta_limits; usd numeric; credits numeric; window_open boolean;
begin
  result:=public.beta_status_daily_limits();
  select * into lim from public.beta_limits where id=true;
  select coalesce(sum(amount) filter(where resource='openai_usd'),0),
    coalesce(sum(amount) filter(where resource='supadata_credit'),0) into usd,credits
    from public.provider_reservations where created_at>=lim.starts_at;
  window_open:=lim.enabled and clock_timestamp()>=lim.starts_at and clock_timestamp()<lim.ends_at;
  return result||jsonb_build_object('available',coalesce((result->>'available')::boolean and window_open
    and usd<lim.total_openai_usd and credits+2<=lim.total_supadata_credits,false),
    'ends_at',lim.ends_at,'window_open',coalesce(window_open,false));
end $$;
revoke all on function public.beta_status() from public;
grant execute on function public.beta_status() to authenticated;
commit;
