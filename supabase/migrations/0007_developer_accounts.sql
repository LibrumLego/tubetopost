begin;
-- Developer is a server-assigned plan, never a client-provided signup property.
alter table public.profiles drop constraint profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free','pro','developer'));
comment on column public.profiles.plan is 'Server-managed plan. Developer accounts use an explicit monthly_quota; worker cost and concurrency limits still apply.';
commit;
