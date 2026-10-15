-- Single SELECT: the Management API returns only the final statement.
select jsonb_build_object(
  'limits', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select row_to_json(l) as beta_limits from public.beta_limits l) report_row),
  'provider_reservations', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select resource,
  coalesce(sum(amount) filter(where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),0) as reserved_today,
  coalesce(sum(amount),0) as reserved_this_utc_month
from public.provider_reservations
where created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'
group by resource) report_row),
  'visits_14d', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select day,page,source,views from public.beta_daily_visits
where day>=(now() at time zone 'UTC')::date-13 order by day,page,source) report_row),
  'accounts', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select count(*) filter(where created_at>=now()-interval '14 days') as new_non_developer_accounts_14d,
  count(*) filter(where quota_reset_at>now() and used_this_month>=monthly_quota) as accounts_at_monthly_quota
from public.profiles where plan<>'developer') report_row),
  'jobs_14d', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select count(*) as jobs_created_14d,count(*) filter(where j.status='done') as done,
  count(*) filter(where j.status='failed') as failed,
  count(*) filter(where j.status not in ('done','failed')) as pending,
  count(distinct j.user_id) as users_requesting_conversion,
  count(distinct j.user_id) filter(where j.status='done') as users_with_completed_conversion
from public.jobs j join public.profiles p on p.id=j.user_id
where p.plan<>'developer' and j.created_at>=now()-interval '14 days') report_row),
  'returning_users', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select count(*) as users_completed_on_multiple_utc_days_14d from (
  select j.user_id from public.jobs j join public.profiles p on p.id=j.user_id
  where p.plan<>'developer' and j.status='done' and j.completed_at>=now()-interval '14 days'
  group by j.user_id having count(distinct (j.completed_at at time zone 'UTC')::date)>=2
) r) report_row),
  'failures_14d', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select j.error_code,count(*) as failed_jobs from public.jobs j join public.profiles p on p.id=j.user_id
where p.plan<>'developer' and j.status='failed' and j.created_at>=now()-interval '14 days'
group by j.error_code) report_row),
  'model_usage_14d', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select provider,operation,count(*) as logged_calls,sum(cost_usd) as recorded_estimated_usd
from public.usage_logs where created_at>=now()-interval '14 days' group by provider,operation) report_row),
  'pack_interest', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select count(*) as non_developer_requests,use_case,expected_monthly from public.beta_requests b
join public.profiles p on p.id=b.user_id where p.plan<>'developer' group by use_case,expected_monthly) report_row),
  'posts', (select coalesce(jsonb_agg(to_jsonb(report_row)),'[]'::jsonb) from (select count(*) as non_developer_posts,count(*) filter(where is_public) as currently_public
from public.posts s join public.profiles p on p.id=s.user_id where p.plan<>'developer') report_row)
) as beta_report;
