begin;
do $$
declare
  source_column smallint;
  constraint_names text[];
begin
  select attnum into source_column from pg_attribute
    where attrelid = 'public.jobs'::regclass and attname = 'transcript_source' and not attisdropped;
  select array_agg(conname) into constraint_names from pg_constraint
    where conrelid = 'public.jobs'::regclass and contype = 'c' and conkey = array[source_column];
  if coalesce(array_length(constraint_names, 1), 0) <> 1 then
    raise exception 'Expected exactly one transcript_source CHECK; inspect constraints before applying';
  end if;
  execute format('alter table public.jobs drop constraint %I', constraint_names[1]);
end $$;
alter table public.jobs add constraint jobs_transcript_source_check
  check (transcript_source in ('youtube_captions', 'whisper', 'supadata'));
commit;
