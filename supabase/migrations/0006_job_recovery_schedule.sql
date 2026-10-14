begin;
create extension if not exists pg_cron with schema pg_catalog;
create function public.recover_stale_jobs() returns integer
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; recovered integer:=0; affected integer;
begin
  for owner_id in select p.id from public.profiles p where exists (
    select 1 from public.jobs j where j.user_id=p.id and (
      (j.status='queued' and coalesce(j.started_at,j.created_at)<now()-interval '1 minute') or
      (j.status in ('transcribing','generating','finalizing') and coalesce(j.lease_expires_at,j.started_at+interval '5 minutes',j.created_at+interval '5 minutes')<now())))
    order by p.id limit 200 for update skip locked
  loop
    update public.jobs set status='failed',error_code='JOB_TIMEOUT',error_message='작업 응답이 없어 중단했습니다. 다시 시도해 주세요.',
      completed_at=now(),attempt_id=null,lease_expires_at=null
      where user_id=owner_id and (
        (status='queued' and coalesce(started_at,created_at)<now()-interval '1 minute') or
        (status in ('transcribing','generating','finalizing') and coalesce(lease_expires_at,started_at+interval '5 minutes',created_at+interval '5 minutes')<now()));
    get diagnostics affected=row_count;
    recovered:=recovered+affected;
  end loop;
  return recovered;
end $$;
revoke all on function public.recover_stale_jobs() from public;
grant execute on function public.recover_stale_jobs() to service_role;
select cron.schedule('tubetopost-recover-stale','* * * * *','select public.recover_stale_jobs()');
commit;
