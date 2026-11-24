-- Crown Consulting client upload portal: core schema.
-- All tables are service-role only. RLS is enabled with NO policies so the
-- anon/authenticated API roles (used by the browser) can never touch them.
-- Every read and write goes through Netlify functions using the service key.
-- Everything is prefixed portal_ so it can live alongside another app's schema.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Staff allow-list. A Supabase Auth user may use the staff console only if a
-- row exists here with is_active = true. Enrolment is a manual SQL step (see
-- docs/PORTAL_RUNBOOK.md). MFA (aal2) is enforced in the functions.
-- ---------------------------------------------------------------------------
create table if not exists portal_staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Editable checklist templates (seeded in 0002).
-- checklist = [{ "group": "...", "items": [{ "label": "...", "note": "..." }] }]
-- ---------------------------------------------------------------------------
create table if not exists portal_templates (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  purpose      text not null,
  instructions text not null default '',
  checklist    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- File requests. One request = one organization + one authorized recipient.
-- invite_token_hash is sha256(raw token); the raw token is shown to staff once.
-- ---------------------------------------------------------------------------
create table if not exists portal_requests (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique,
  org_name           text not null,
  purpose            text not null,
  recipient_email    text not null,
  instructions       text not null default '',
  checklist          jsonb not null default '[]'::jsonb,
  status             text not null default 'draft'
                     check (status in ('draft','open','closed','revoked','expired')),
  invite_token_hash  text unique,
  issued_at          timestamptz,
  expires_at         timestamptz not null,
  max_file_bytes     bigint not null default 26214400,   -- 25 MB
  max_total_bytes    bigint not null default 262144000,  -- 250 MB
  allowed_types      text[] not null default array['pdf','jpg','png'],
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  closed_at          timestamptz,
  closed_by          uuid references auth.users(id),
  close_reason       text,
  receipt_file_count integer not null default 0,
  last_receipt_at    timestamptz,
  retention_delete_after timestamptz
);
create index if not exists portal_requests_status_idx on portal_requests(status, expires_at);

-- ---------------------------------------------------------------------------
-- One-time codes. Only the hash is stored. Single use, short expiry,
-- attempt-limited.
-- ---------------------------------------------------------------------------
create table if not exists portal_otp_codes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references portal_requests(id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    integer not null default 0,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists portal_otp_codes_request_idx on portal_otp_codes(request_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Request-scoped client sessions (cookie token hash + CSRF secret hash).
-- ---------------------------------------------------------------------------
create table if not exists portal_sessions (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references portal_requests(id) on delete cascade,
  token_hash   text not null unique,
  csrf_hash    text not null,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  ip_hash      text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists portal_sessions_request_idx on portal_sessions(request_id);

-- ---------------------------------------------------------------------------
-- Files. object_key is reserved server-side before any upload grant is issued.
-- Status flow:
--   reserved -> uploaded -> pending_scan -> clean | infected | scan_failed
--   reserved/uploaded -> rejected (type, size, quota, late, encrypted)
--   any -> deleted (staff or retention)
-- ---------------------------------------------------------------------------
create table if not exists portal_files (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references portal_requests(id) on delete cascade,
  session_id       uuid references portal_sessions(id) on delete set null,
  object_key       text not null unique,
  original_name    text not null,
  extension        text not null,
  declared_size    bigint not null,
  declared_mime    text,
  actual_size      bigint,
  detected_type    text,
  status           text not null default 'reserved'
                   check (status in ('reserved','uploaded','pending_scan','clean',
                                     'infected','scan_failed','rejected','deleted')),
  rejection_reason text,
  scan_provider    text,
  scan_result      jsonb,
  scan_attempts    integer not null default 0,
  grant_expires_at timestamptz not null,
  uploaded_at      timestamptz,
  scanned_at       timestamptz,
  deleted_at       timestamptz,
  deleted_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists portal_files_request_idx on portal_files(request_id, created_at);
create index if not exists portal_files_status_idx on portal_files(status, created_at);

-- ---------------------------------------------------------------------------
-- Minimal audit trail. Never store client document filenames, codes, tokens
-- or email bodies here; only ids, events and coarse detail.
-- ---------------------------------------------------------------------------
create table if not exists portal_audit (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor_type text not null check (actor_type in ('staff','client','system')),
  actor_id   text,
  request_id uuid,
  file_id    uuid,
  event      text not null,
  detail     jsonb
);
create index if not exists portal_audit_request_idx on portal_audit(request_id, at desc);

-- ---------------------------------------------------------------------------
-- Fixed-window rate limiting done atomically in Postgres.
-- ---------------------------------------------------------------------------
create table if not exists portal_rate_limits (
  scope        text not null,
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (scope, key, window_start)
);

create or replace function portal_rate_limit(
  p_scope text, p_key text, p_limit integer, p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into portal_rate_limits(scope, key, window_start, count)
  values (p_scope, p_key, v_window, 1)
  on conflict (scope, key, window_start)
  do update set count = portal_rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

-- Bytes already committed against a request. Live reserved grants count too,
-- so a client cannot over-reserve the quota with parallel grant calls.
create or replace function portal_request_used_bytes(p_request_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(
    case
      when status in ('uploaded','pending_scan','clean','infected','scan_failed')
        then coalesce(actual_size, declared_size)
      when status = 'reserved' and grant_expires_at > now()
        then declared_size
      else 0
    end), 0)::bigint
  from portal_files
  where request_id = p_request_id;
$$;

-- updated_at maintenance
create or replace function portal_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists portal_requests_touch on portal_requests;
create trigger portal_requests_touch before update on portal_requests
  for each row execute function portal_touch_updated_at();
drop trigger if exists portal_files_touch on portal_files;
create trigger portal_files_touch before update on portal_files
  for each row execute function portal_touch_updated_at();
drop trigger if exists portal_templates_touch on portal_templates;
create trigger portal_templates_touch before update on portal_templates
  for each row execute function portal_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Lock everything down. Service role bypasses RLS; nobody else gets in.
-- ---------------------------------------------------------------------------
alter table portal_staff        enable row level security;
alter table portal_templates    enable row level security;
alter table portal_requests     enable row level security;
alter table portal_otp_codes    enable row level security;
alter table portal_sessions     enable row level security;
alter table portal_files        enable row level security;
alter table portal_audit        enable row level security;
alter table portal_rate_limits  enable row level security;

revoke all on portal_staff, portal_templates, portal_requests, portal_otp_codes,
  portal_sessions, portal_files, portal_audit, portal_rate_limits
  from anon, authenticated;
revoke all on function portal_rate_limit(text, text, integer, integer) from anon, authenticated, public;
revoke all on function portal_request_used_bytes(uuid) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Private quarantine bucket. No storage.objects policies are created for it,
-- so the anon/authenticated roles cannot list, read, write or delete anything.
-- Uploads happen only through presigned upload tokens minted server-side;
-- downloads only through very short-lived signed URLs minted server-side.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-uploads', 'client-uploads', false, 26214400,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
