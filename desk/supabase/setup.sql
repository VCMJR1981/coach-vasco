-- Concrete Surfers coach desk: database setup.
--
-- Paste this whole file into Supabase > SQL Editor and press Run.
-- It is safe to run again: nothing is deleted, existing tables are kept.
--
-- Who can do what:
--   * The public (the website) cannot touch any table. Enquiries arrive
--     through the `intake` Edge Function, which calls intake_submit() with
--     the server key.
--   * The one coach login (listed in public.coaches) can read and work on
--     everything. Being logged in is not enough: the user id must be in
--     public.coaches.
--   * A client opening a report link can call get_report(token), which
--     returns the published, client-facing copy only.

-- ---------------------------------------------------------------- coaches
create table if not exists public.coaches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.coaches where user_id = (select auth.uid())) $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------- clients
-- One row per person, matched by email.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and email like '%_@_%'),
  name text,
  phone text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------ submissions
-- The intake exactly as sent. Every website enquiry lands here, whatever
-- the product.
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  form text not null,
  product text not null check (product in
    ('snapshot','snapshot_skate','diagnostic','single','block','program','pro','classes','retreat','cert','workshop','unsure')),
  name text not null,
  email text not null,
  phone text,
  country text,
  level text,
  footage_link text check (footage_link is null or footage_link ~* '^https?://'),
  footage_note text,
  surf_frequency text,
  frustration text,
  newsletter boolean not null default false,
  age_confirmed boolean not null check (age_confirmed),
  details jsonb not null default '{}'::jsonb,
  source text,
  handled_at timestamptz,
  constraint snapshot_needs_link check (product not like 'snapshot%' or footage_link is not null)
);
create index if not exists submissions_created on public.submissions (created_at desc);
create index if not exists submissions_email on public.submissions (email, created_at desc);
create index if not exists submissions_client on public.submissions (client_id);

-- --------------------------------------------------------------- consents
-- A log, never overwritten: the latest row per client and kind is the
-- current state. The wording column keeps the exact text the person saw.
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete set null,
  kind text not null check (kind in ('footage_use','newsletter')),
  action text not null check (action in ('given','withdrawn')),
  credit_as text check (credit_as in ('first name','first name and instagram','anonymous')),
  wording text,
  recorded_by text not null check (recorded_by in ('client_form','coach')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists consents_client on public.consents (client_id, kind, created_at desc);

create or replace view public.consent_status with (security_invoker = true) as
  select distinct on (client_id, kind)
    client_id, kind, action, credit_as, created_at, recorded_by
  from public.consents
  order by client_id, kind, created_at desc;

-- ------------------------------------------------------------ assessments
-- One per piece of work: a Snapshot, a Diagnostic, a block reassessment.
-- coach_input holds what may reach the client. The internal
-- classification and private notes live in their own columns and are
-- never copied into a report.
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete set null,
  kind text not null check (kind in ('snapshot_surf','snapshot_skate','diagnostic','block_reassessment')),
  baseline_id uuid references public.assessments(id) on delete set null,
  block_week smallint check (block_week in (4, 8, 12)),
  status text not null default 'new' check (status in ('new','clip_received','in_review','sent')),
  clip_received_at timestamptz,
  review_started_at timestamptz,
  sent_at timestamptz,
  coach_input jsonb not null default '{}'::jsonb,
  internal_classification text,
  private_notes text,
  share_token text unique check (share_token is null or length(share_token) >= 32),
  share_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_input_has_no_internal_fields
    check (not (coach_input ?| array['internal_classification','private_notes'])),
  constraint reassessment_has_week
    check ((kind = 'block_reassessment') = (block_week is not null))
);
create index if not exists assessments_client on public.assessments (client_id);
create index if not exists assessments_clip on public.assessments (kind, clip_received_at);

-- Keep the step timestamps in line with the status, so the monthly
-- Snapshot count cannot drift from what the screen shows.
create or replace function public.assessment_status_stamps() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'new' then
    new.clip_received_at := null; new.review_started_at := null; new.sent_at := null;
  elsif new.status = 'clip_received' then
    new.clip_received_at := coalesce(new.clip_received_at, now());
    new.review_started_at := null; new.sent_at := null;
  elsif new.status = 'in_review' then
    new.clip_received_at := coalesce(new.clip_received_at, now());
    new.review_started_at := coalesce(new.review_started_at, now());
    new.sent_at := null;
  else
    new.clip_received_at := coalesce(new.clip_received_at, now());
    new.review_started_at := coalesce(new.review_started_at, now());
    new.sent_at := coalesce(new.sent_at, now());
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists assessments_stamps on public.assessments;
create trigger assessments_stamps before insert or update on public.assessments
  for each row execute function public.assessment_status_stamps();

-- ---------------------------------------------------------------- reports
-- Every publish is a new version; old versions are kept, never edited.
-- content is the client-facing copy, frozen at the moment of publishing.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  version int not null check (version > 0),
  template_key text not null,
  template_version int not null,
  content jsonb not null
    check (content::text !~ '"(internal_classification|private_notes)"'),
  created_at timestamptz not null default now(),
  unique (assessment_id, version)
);

-- ------------------------------------------------------ row level security
alter table public.coaches     enable row level security;
alter table public.clients     enable row level security;
alter table public.submissions enable row level security;
alter table public.consents    enable row level security;
alter table public.assessments enable row level security;
alter table public.reports     enable row level security;

-- Belt and braces: the public role gets no table rights at all.
revoke all on public.coaches, public.clients, public.submissions, public.consents,
              public.assessments, public.reports, public.consent_status from anon;

drop policy if exists coach_self on public.coaches;
create policy coach_self on public.coaches for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists coach_all on public.clients;
create policy coach_all on public.clients for all to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

drop policy if exists coach_read on public.submissions;
create policy coach_read on public.submissions for select to authenticated
  using ((select public.is_coach()));
-- The submission itself is never edited. The coach can only mark it handled.
drop policy if exists coach_mark on public.submissions;
create policy coach_mark on public.submissions for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
revoke insert, update, delete on public.submissions from authenticated;
grant update (handled_at) on public.submissions to authenticated;

-- consents: the coach can read and add (a withdrawal, or consent given by
-- email), never change or delete an existing row.
drop policy if exists coach_read on public.consents;
create policy coach_read on public.consents for select to authenticated
  using ((select public.is_coach()));
drop policy if exists coach_add on public.consents;
create policy coach_add on public.consents for insert to authenticated
  with check ((select public.is_coach()) and recorded_by = 'coach');

revoke update, delete on public.consents from authenticated;

drop policy if exists coach_all on public.assessments;
create policy coach_all on public.assessments for all to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

drop policy if exists coach_read on public.reports;
create policy coach_read on public.reports for select to authenticated
  using ((select public.is_coach()));
drop policy if exists coach_add on public.reports;
create policy coach_add on public.reports for insert to authenticated
  with check ((select public.is_coach()));
revoke update, delete on public.reports from authenticated;

-- ------------------------------------------------------- snapshot counter
-- Places used this calendar month (Lisbon time). A place counts from the
-- moment the clip is marked as received.
create or replace function public.snapshot_month_count() returns int
language sql stable set search_path = ''
as $$
  select count(*)::int from public.assessments
  where kind in ('snapshot_surf','snapshot_skate')
    and clip_received_at >= (date_trunc('month', now() at time zone 'Europe/Lisbon') at time zone 'Europe/Lisbon')
$$;
revoke all on function public.snapshot_month_count() from public, anon;
grant execute on function public.snapshot_month_count() to authenticated, service_role;

-- ----------------------------------------------------------------- intake
-- Called only by the Edge Function (server key). One transaction: find or
-- create the client, store the submission, log consents, open a Snapshot.
create or replace function public.intake_submit(p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email   text := lower(btrim(coalesce(p->>'email', '')));
  v_name    text := nullif(btrim(coalesce(p->>'name', '')), '');
  v_product text := coalesce(p->>'product', '');
  v_link    text := nullif(btrim(coalesce(p->>'footage_link', '')), '');
  v_footage boolean := coalesce((p->>'footage_consent')::boolean, false);
  v_news    boolean := coalesce((p->>'newsletter')::boolean, false);
  v_client  uuid;
  v_sub     uuid;
  v_assess  uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid: email'; end if;
  if v_name is null then raise exception 'invalid: name'; end if;
  if not coalesce((p->>'age_confirmed')::boolean, false) then raise exception 'invalid: age'; end if;
  if v_product like 'snapshot%' then
    if v_link is null then raise exception 'invalid: footage_link'; end if;
    if not v_footage then raise exception 'invalid: footage_consent'; end if;
  end if;

  -- Flood protection: three from one address in ten minutes, sixty in an hour overall.
  if (select count(*) from public.submissions
      where email = v_email and created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from public.submissions
      where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too_many';
  end if;

  insert into public.clients (email, name, phone, country)
  values (v_email, v_name, nullif(btrim(p->>'phone'), ''), nullif(btrim(p->>'country'), ''))
  on conflict (email) do update set
    name    = coalesce(excluded.name, public.clients.name),
    phone   = coalesce(excluded.phone, public.clients.phone),
    country = coalesce(excluded.country, public.clients.country)
  returning id into v_client;

  insert into public.submissions (client_id, form, product, name, email, phone, country, level,
    footage_link, footage_note, surf_frequency, frustration, newsletter, age_confirmed, details, source)
  values (v_client, coalesce(nullif(p->>'form', ''), 'work-with-us'), v_product, v_name, v_email,
    nullif(btrim(p->>'phone'), ''), nullif(btrim(p->>'country'), ''), nullif(p->>'level', ''),
    v_link, nullif(btrim(p->>'footage_note'), ''), nullif(btrim(p->>'surf_frequency'), ''),
    nullif(btrim(p->>'frustration'), ''), v_news, true,
    coalesce(p->'details', '{}'::jsonb), nullif(p->>'source', ''))
  returning id into v_sub;

  if v_footage then
    insert into public.consents (client_id, submission_id, kind, action, credit_as, wording, recorded_by)
    values (v_client, v_sub, 'footage_use', 'given',
      coalesce(nullif(p->>'credit_as', ''), 'first name'), p->>'footage_consent_wording', 'client_form');
  end if;
  if v_news then
    insert into public.consents (client_id, submission_id, kind, action, wording, recorded_by)
    values (v_client, v_sub, 'newsletter', 'given', p->>'newsletter_wording', 'client_form');
  end if;

  if v_product like 'snapshot%' then
    insert into public.assessments (client_id, submission_id, kind)
    values (v_client, v_sub, case when v_product = 'snapshot_skate' then 'snapshot_skate' else 'snapshot_surf' end)
    returning id into v_assess;
  end if;

  return jsonb_build_object('submission_id', v_sub, 'assessment_id', v_assess,
    'snapshots_this_month', public.snapshot_month_count());
end $$;
revoke all on function public.intake_submit(jsonb) from public, anon, authenticated;
grant execute on function public.intake_submit(jsonb) to service_role;

-- ---------------------------------------------------------- report links
-- The coach creates (or replaces) the link for an assessment.
create or replace function public.share_link(p_assessment uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text;
begin
  if not public.is_coach() then raise exception 'not allowed'; end if;
  v_token := translate(encode(extensions.gen_random_bytes(27), 'base64'), '+/', '-_');
  update public.assessments set share_token = v_token, share_revoked_at = null where id = p_assessment;
  if not found then raise exception 'no such assessment'; end if;
  return v_token;
end $$;
revoke all on function public.share_link(uuid) from public, anon;
grant execute on function public.share_link(uuid) to authenticated;

-- What a client sees: the latest published version, nothing else.
create or replace function public.get_report(p_token text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select r.content || jsonb_build_object('version', r.version, 'published_at', r.created_at)
  from public.assessments a
  join public.reports r on r.assessment_id = a.id
  where length(p_token) >= 32 and a.share_token = p_token and a.share_revoked_at is null
  order by r.version desc
  limit 1
$$;
revoke all on function public.get_report(text) from public;
grant execute on function public.get_report(text) to anon, authenticated;

-- ------------------------------------------------------------ coach login
-- Links the coach login. Create the user first (Authentication > Users >
-- Add user), then run this file. Running it again changes nothing.
insert into public.coaches (user_id)
  select id from auth.users where email = 'info@concrete-surfers.com'
  on conflict do nothing;

select case
  when exists (select 1 from public.coaches)
    then 'Ready. The coach login is linked.'
  else 'Tables are in place, but no login exists yet for info@concrete-surfers.com. Create it under Authentication > Users, then run this file again.'
end as result;
