create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null check (session_id ~ '^[0-9a-f-]{36}$'),
  event_name text not null check (event_name in (
    'page_view', 'cta_click', 'offer_selected', 'form_started',
    'form_field_reached', 'form_submitted', 'form_error'
  )),
  page_section text check (page_section is null or char_length(page_section) <= 80),
  offer text check (offer is null or offer in ('one', 'two')),
  last_field text check (last_field is null or char_length(last_field) <= 64),
  device text not null check (device in ('mobile', 'desktop')),
  referrer_source text check (referrer_source is null or char_length(referrer_source) <= 255),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 200)
);

create index events_created_at_idx on public.events (created_at desc);
create index events_session_created_at_idx on public.events (session_id, created_at desc);
create index events_name_created_at_idx on public.events (event_name, created_at desc);

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant insert (id, session_id, event_name, page_section, offer, last_field, device, referrer_source, utm_campaign)
  on public.events to anon;
grant select on public.events to authenticated;

create policy "visitors can insert analytics events" on public.events
  for insert to anon with check (true);
create policy "admins can read analytics events" on public.events
  for select to authenticated using ((select public.is_admin()));

create or replace function public.limit_analytics_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_events integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.session_id, 1));
  select count(*) into recent_events
    from public.events e
    where e.session_id = new.session_id
      and e.created_at > now() - interval '1 hour';
  if recent_events >= 100 then
    raise exception 'Analytics event rate limit exceeded';
  end if;
  return new;
end;
$$;

create trigger events_rate_limit_before_insert
  before insert on public.events
  for each row execute function public.limit_analytics_events();
revoke all on function public.limit_analytics_events() from public, anon, authenticated;

create or replace function public.analytics_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  summary jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  with filtered as (
    select e.*
    from public.events e
    where e.created_at >= p_from and e.created_at < p_to
  ),
  visitor_sessions as (
    select distinct session_id from filtered where event_name = 'page_view'
  ),
  started_sessions as (
    select distinct session_id from filtered where event_name = 'form_started'
  ),
  submitted_sessions as (
    select distinct session_id from filtered where event_name = 'form_submitted'
  ),
  abandoned_sessions as (
    select session_id from started_sessions
    except
    select session_id from submitted_sessions
  ),
  latest_fields as (
    select distinct on (f.session_id) f.last_field
    from filtered f
    join abandoned_sessions a using (session_id)
    where f.event_name = 'form_field_reached' and f.last_field is not null
    order by f.session_id, f.created_at desc
  ),
  cta_counts as (
    select page_section as label, count(*)::integer as amount
    from filtered where event_name = 'cta_click'
    group by page_section
  ),
  offer_counts as (
    select offer as label, count(*)::integer as amount
    from filtered where event_name = 'form_submitted' and offer is not null
    group by offer
  ),
  device_counts as (
    select device as label, count(distinct session_id)::integer as amount
    from filtered where event_name = 'page_view'
    group by device
  ),
  source_counts as (
    select referrer_source as label, count(distinct session_id)::integer as amount
    from filtered
    where event_name = 'page_view' and referrer_source is not null
    group by referrer_source
  ),
  field_counts as (
    select last_field as label, count(*)::integer as amount
    from latest_fields group by last_field
  ),
  daily_counts as (
    select
      created_at::date as day,
      count(distinct session_id) filter (where event_name = 'page_view')::integer as visitors,
      count(distinct session_id) filter (where event_name = 'cta_click')::integer as cta_clicks,
      count(distinct session_id) filter (where event_name = 'form_started')::integer as form_started,
      count(*) filter (where event_name = 'form_submitted')::integer as form_submitted
    from filtered
    group by created_at::date
  )
  select jsonb_build_object(
    'visitors', (select count(*)::integer from visitor_sessions),
    'cta_clicks', (select count(*)::integer from filtered where event_name = 'cta_click'),
    'cta_sessions', (select count(distinct session_id)::integer from filtered where event_name = 'cta_click'),
    'form_started', (select count(*)::integer from started_sessions),
    'form_submitted', (select count(*)::integer from filtered where event_name = 'form_submitted'),
    'submitted_sessions', (select count(*)::integer from submitted_sessions),
    'abandoned', (select count(*)::integer from abandoned_sessions),
    'conversion_rate', case when (select count(*) from visitor_sessions) = 0 then 0
      else round(100.0 * (select count(*) from submitted_sessions) / (select count(*) from visitor_sessions), 1) end,
    'last_fields', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', amount) order by amount desc) from field_counts), '[]'::jsonb),
    'cta_locations', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', amount) order by amount desc) from cta_counts), '[]'::jsonb),
    'offers', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', amount) order by amount desc) from offer_counts), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', amount) order by amount desc) from device_counts), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', amount) order by amount desc) from source_counts), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'day', to_char(day, 'YYYY-MM-DD'),
      'visitors', visitors,
      'cta_clicks', cta_clicks,
      'form_started', form_started,
      'form_submitted', form_submitted
    ) order by day) from daily_counts), '[]'::jsonb)
  ) into summary;

  return summary;
end;
$$;
revoke all on function public.analytics_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.analytics_summary(timestamptz, timestamptz) to authenticated;
