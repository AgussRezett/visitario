-- =============================================================================
-- Visitario v2 · Initial schema (1/4): types, utilities and tables
-- Postgres 15+ (Supabase). Business data lives in `public` with forced RLS.
-- Permission helpers live in `private`, which the API does not expose.
--
-- Conventions
--   · Every business table carries company_id and references its parent by
--     (company_id, id): a row can never point to another company.
--   · UUID v7 ids. Rows created offline bring their id from the phone.
--   · updated_at / version are set by the server (delta sync).
--   · deleted_at = soft delete on synced tables.
--   · Every text column has a length limit.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.role                as enum ('merchandiser', 'supervisor', 'admin');
create type public.membership_status   as enum ('invited', 'active', 'declined', 'disabled');
create type public.company_kind        as enum ('distributor', 'brand', 'agency', 'personal');
create type public.geocoding_scope     as enum ('caba', 'argentina');
create type public.plan_kind           as enum ('free', 'pilot', 'team', 'internal');
create type public.subscription_status as enum ('active', 'expired', 'canceled');
create type public.location_status     as enum ('verified', 'approximate', 'unverified');
create type public.store_source        as enum ('imported', 'manual', 'merchandiser');
create type public.workday_status      as enum ('draft', 'published', 'closed');
create type public.visit_source        as enum ('assigned', 'added');
create type public.work_status         as enum ('pending', 'in_progress', 'done', 'refused', 'closed');
create type public.review_status       as enum ('unreviewed', 'approved', 'needs_fix');
create type public.consent_kind        as enum ('yes', 'with_objection', 'refused', 'closed');
create type public.display_source      as enum ('assigned', 'found');
create type public.photo_kind          as enum ('storefront', 'before', 'after');
create type public.comment_kind        as enum ('fix_request', 'reply', 'note');
create type public.template_kind       as enum ('before', 'after', 'daily_report', 'visit_report');
create type public.visit_event_kind    as enum ('created', 'work', 'review', 'reassigned', 'resumed', 'deleted');

-- -----------------------------------------------------------------------------
-- Utilities
-- -----------------------------------------------------------------------------

-- Server-side UUID v7 (Postgres < 18 has none). Clients generate their own.
create function private.uuid_v7() returns uuid
language sql volatile parallel safe set search_path = '' as $$
  select encode(
    set_bit(set_bit(
      overlay(uuid_send(gen_random_uuid())
              placing substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
              from 1 for 6),
    52, 1), 53, 1), 'hex')::uuid;
$$;

-- Normalizes text for search and dedupe: lowercase, no accents, single spaces.
create function private.normalize(t text) returns text
language sql immutable parallel safe strict set search_path = '' as $$
  select btrim(regexp_replace(
           translate(lower(t), 'áàäâãéèëêíìïîóòöôõúùüûñç.,;:', 'aaaaaeeeeiiiiooooouuuunc    '),
           '\s+', ' ', 'g'));
$$;

-- Server-owned timestamp and version on every write.
create function private.touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.created_at := old.created_at;
  else
    new.version := 1;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Identity
-- -----------------------------------------------------------------------------
create table public.person (
  id            uuid primary key default private.uuid_v7(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  first_name    text not null check (char_length(first_name) between 1 and 80),
  last_name     text not null check (char_length(last_name) between 1 and 80),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);
comment on table public.person is 'A person, unique across Visitario and identified by DNI (in person_private). Survives company changes.';

create table public.person_private (
  person_id          uuid primary key references public.person (id) on delete cascade,
  dni                text not null unique check (dni ~ '^[0-9]{7,8}$'),
  birth_date         date check (birth_date between '1900-01-01' and current_date),
  phone              text check (phone ~ '^\+?[0-9]{8,15}$'),
  phone_verified_at  timestamptz,
  updated_at         timestamptz not null default now()
);
comment on table public.person_private is 'Sensitive personal data. Only its owner can read it; companies search by DNI through find_person_by_dni().';

create table public.platform_admin (
  person_id   uuid primary key references public.person (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Companies, teams and memberships
-- -----------------------------------------------------------------------------
create table public.company (
  id                      uuid primary key default private.uuid_v7(),
  name                    text not null check (char_length(name) between 1 and 80),
  kind                    public.company_kind not null,
  owner_person_id         uuid references public.person (id) on delete restrict,
  timezone                text not null default 'America/Argentina/Buenos_Aires' check (char_length(timezone) <= 64),
  geocoding_scope         public.geocoding_scope not null default 'caba',
  logo_version            smallint check (logo_version > 0),
  require_before_after    boolean not null default true,
  require_shelf_facings   boolean not null default false,
  show_whatsapp           boolean not null default true,
  photo_retention_months  smallint not null default 12 check (photo_retention_months between 1 and 60),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  version                 integer not null default 1,
  check ((kind = 'personal') = (owner_person_id is not null))
);
create unique index company_personal_unique on public.company (owner_person_id) where kind = 'personal';
comment on column public.company.owner_person_id is 'Only for personal companies (self-employed mode).';
comment on column public.company.logo_version is 'Logo lives in R2: c/<company_id>/logo-v<logo_version>.png';

create table public.subscription (
  company_id              uuid primary key references public.company (id) on delete cascade,
  plan                    public.plan_kind not null default 'free',
  status                  public.subscription_status not null default 'active',
  ends_on                 date,
  next_billing_on         date,
  auto_debit              boolean not null default false,
  payment_method_summary  text check (char_length(payment_method_summary) <= 40),
  estimated_amount_cents  integer check (estimated_amount_cents >= 0),
  currency                char(3) not null default 'ARS',
  updated_at              timestamptz not null default now()
);
comment on column public.subscription.payment_method_summary is 'e.g. "Visa •••• 4821". Never the card number.';

create table public.team (
  id          uuid primary key default private.uuid_v7(),
  company_id  uuid not null references public.company (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  areas       text check (char_length(areas) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (company_id, id),
  unique (company_id, name)
);

create table public.membership (
  id          uuid primary key default private.uuid_v7(),
  company_id  uuid not null references public.company (id) on delete cascade,
  person_id   uuid not null references public.person (id) on delete restrict,
  roles       public.role[] not null check (cardinality(roles) between 1 and 3 and array_position(roles, null) is null),
  team_id     uuid,
  status      public.membership_status not null default 'invited',
  starts_on   date not null default current_date,
  invited_by  uuid references public.person (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  unique (company_id, person_id),
  foreign key (company_id, team_id) references public.team (company_id, id) on delete set null (team_id)
);
create index membership_person on public.membership (person_id) include (company_id, roles, status, team_id);
create index membership_team on public.membership (company_id, team_id) where status = 'active';
comment on column public.membership.team_id is 'Merchandiser: their team. Supervisor: the team they supervise.';

-- -----------------------------------------------------------------------------
-- Catalogs and settings (integer ids: only admins create them, online)
-- -----------------------------------------------------------------------------
create table public.brand (
  id          integer generated always as identity primary key,
  company_id  uuid not null references public.company (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  group_name  text check (char_length(group_name) <= 60),
  active      boolean not null default true,
  sort_order  smallint not null default 0,
  updated_at  timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name)
);

create table public.display_type (
  id          integer generated always as identity primary key,
  company_id  uuid not null references public.company (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  active      boolean not null default true,
  sort_order  smallint not null default 0,
  updated_at  timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name)
);

create table public.work_metric (
  id            integer generated always as identity primary key,
  company_id    uuid not null references public.company (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  report_label  text check (char_length(report_label) <= 80),
  active        boolean not null default true,
  sort_order    smallint not null default 0,
  updated_at    timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name)
);
comment on table public.work_metric is 'Countable work per visit (bag kits, groupings, end caps...). report_label is the line in the daily report.';

create table public.message_template (
  company_id  uuid not null references public.company (id) on delete cascade,
  kind        public.template_kind not null,
  body        text not null check (char_length(body) <= 4000),
  updated_by  uuid references public.person (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (company_id, kind)
);

create table public.import_format (
  id            uuid primary key default private.uuid_v7(),
  company_id    uuid not null references public.company (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  signature     text not null check (char_length(signature) <= 500),
  mapping       jsonb not null check (jsonb_typeof(mapping) = 'object' and pg_column_size(mapping) <= 4096),
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1,
  unique (company_id, signature)
);
comment on column public.import_format.signature is 'Normalized, joined column headers: recognizes the spreadsheet next time.';

-- -----------------------------------------------------------------------------
-- Operations
-- -----------------------------------------------------------------------------
create table public.store (
  id               uuid primary key default private.uuid_v7(),
  company_id       uuid not null references public.company (id) on delete cascade,
  customer_number  text check (char_length(customer_number) between 1 and 30),
  name             text check (char_length(name) between 1 and 120),
  address          text not null check (char_length(address) between 3 and 200),
  area             text check (char_length(area) <= 60),
  lat              double precision check (lat between -90 and 90),
  lng              double precision check (lng between -180 and 180),
  location_status  public.location_status not null default 'unverified',
  source           public.store_source not null default 'manual',
  created_by       uuid references public.person (id) on delete set null,
  merged_into      uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  deleted_at       timestamptz,
  unique (company_id, id),
  check ((lat is null) = (lng is null)),
  check (location_status = 'unverified' or lat is not null),
  check (merged_into is null or deleted_at is not null),
  foreign key (company_id, merged_into) references public.store (company_id, id)
);
create unique index store_customer_number on public.store (company_id, customer_number)
  where customer_number is not null and deleted_at is null;
create index store_address on public.store (company_id, private.normalize(address))
  where deleted_at is null;
create index store_search on public.store using gin
  (private.normalize(coalesce(name, '') || ' ' || address || ' ' || coalesce(customer_number, '')) extensions.gin_trgm_ops)
  where deleted_at is null;
create index store_delta on public.store (company_id, updated_at);
comment on table public.store is 'A company customer (the shop). What was done there is derived from visits.';

create table public.workday (
  id               uuid primary key default private.uuid_v7(),
  company_id       uuid not null references public.company (id) on delete cascade,
  merchandiser_id  uuid not null references public.person (id) on delete restrict,
  work_date        date not null,
  status           public.workday_status not null default 'draft',
  created_by       uuid not null references public.person (id) on delete restrict,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  deleted_at       timestamptz,
  unique (company_id, id),
  unique (company_id, merchandiser_id, work_date),
  check ((status = 'draft') = (published_at is null))
);
create index workday_date on public.workday (company_id, work_date);
create index workday_merchandiser_delta on public.workday (merchandiser_id, updated_at);

create table public.visit (
  id               uuid primary key default private.uuid_v7(),
  company_id       uuid not null references public.company (id) on delete cascade,
  workday_id       uuid not null,
  merchandiser_id  uuid not null references public.person (id) on delete restrict,
  work_date        date not null,
  store_id         uuid not null,
  sort_order       smallint not null default 0 check (sort_order >= 0),
  task             text check (char_length(task) <= 200),
  source           public.visit_source not null default 'assigned',
  added_by         uuid not null references public.person (id) on delete restrict,
  resumed_from     uuid,
  work_status      public.work_status not null default 'pending',
  review_status    public.review_status not null default 'unreviewed',
  arrived_at       timestamptz,
  consent          public.consent_kind,
  objection        text check (char_length(objection) <= 300),
  retry_after      timestamptz,
  finished_at      timestamptz,
  notes            text check (char_length(notes) <= 2000),
  reviewed_by      uuid references public.person (id) on delete set null,
  reviewed_at      timestamptz,
  updated_by       uuid references public.person (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  deleted_at       timestamptz,
  unique (company_id, id),
  foreign key (company_id, workday_id)   references public.workday (company_id, id) on delete cascade,
  foreign key (company_id, store_id)     references public.store (company_id, id),
  foreign key (company_id, resumed_from) references public.visit (company_id, id) on delete set null (resumed_from),
  check (work_status in ('pending', 'in_progress') or finished_at is not null),
  check (work_status <> 'refused' or consent = 'refused'),
  check (work_status <> 'closed' or consent = 'closed'),
  check (review_status = 'unreviewed' or work_status in ('done', 'refused', 'closed')),
  check ((review_status = 'unreviewed') = (reviewed_at is null))
);
create index visit_workday on public.visit (workday_id, sort_order);
create index visit_merchandiser_delta on public.visit (merchandiser_id, updated_at);
create index visit_company_delta on public.visit (company_id, updated_at);
create index visit_company_date on public.visit (company_id, work_date);
create index visit_store on public.visit (store_id, work_date desc);
create index visit_resumed on public.visit (resumed_from) where resumed_from is not null;
create index visit_to_review on public.visit (company_id, work_date)
  where review_status = 'unreviewed' and work_status in ('done', 'refused', 'closed') and deleted_at is null;
comment on column public.visit.merchandiser_id is 'Copied from the workday by trigger: saves a join in every policy and list.';
comment on column public.visit.work_date is 'Copied from the workday by trigger: store history and reports without a join.';

create table public.display (
  id               uuid primary key default private.uuid_v7(),
  company_id       uuid not null,
  visit_id         uuid not null,
  display_type_id  integer not null,
  reference        text check (char_length(reference) <= 120),
  source           public.display_source not null default 'assigned',
  sort_order       smallint not null default 0 check (sort_order >= 0),
  created_by       uuid references public.person (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  deleted_at       timestamptz,
  unique (company_id, visit_id, id),
  foreign key (company_id, visit_id)        references public.visit (company_id, id) on delete cascade,
  foreign key (company_id, display_type_id) references public.display_type (company_id, id)
);
create index display_visit on public.display (visit_id);
comment on table public.display is 'Arranged = has at least one non-deleted "after" photo. Derived, never stored.';

create table public.photo (
  id           uuid primary key,
  company_id   uuid not null,
  visit_id     uuid not null,
  display_id   uuid,
  kind         public.photo_kind not null,
  sort_order   smallint not null default 0 check (sort_order >= 0),
  taken_at     timestamptz not null,
  bytes        integer not null check (bytes between 1 and 3000000),
  width        smallint not null check (width between 1 and 4000),
  height       smallint not null check (height between 1 and 4000),
  uploaded_at  timestamptz,
  created_by   uuid not null references public.person (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  deleted_at   timestamptz,
  check ((kind = 'storefront') = (display_id is null)),
  foreign key (company_id, visit_id) references public.visit (company_id, id) on delete cascade,
  foreign key (company_id, visit_id, display_id) references public.display (company_id, visit_id, id) on delete cascade
);
create index photo_visit on public.photo (visit_id);
create index photo_after on public.photo (display_id) where kind = 'after' and deleted_at is null;
create index photo_pending_upload on public.photo (created_by) where uploaded_at is null and deleted_at is null;
create index photo_retention on public.photo (company_id, taken_at) where deleted_at is null;
comment on table public.photo is 'No location. The file lives in R2: c/<company_id>/v/<visit_id>/<id>.jpg';

create table public.visit_metric (
  company_id  uuid not null,
  visit_id    uuid not null,
  metric_id   integer not null,
  quantity    integer not null check (quantity between 0 and 100000),
  primary key (visit_id, metric_id),
  foreign key (company_id, visit_id)  references public.visit (company_id, id) on delete cascade,
  foreign key (company_id, metric_id) references public.work_metric (company_id, id)
);

create table public.visit_brand (
  company_id  uuid not null,
  visit_id    uuid not null,
  brand_id    integer not null,
  primary key (visit_id, brand_id),
  foreign key (company_id, visit_id) references public.visit (company_id, id) on delete cascade,
  foreign key (company_id, brand_id) references public.brand (company_id, id)
);
create index visit_brand_brand on public.visit_brand (brand_id);

-- -----------------------------------------------------------------------------
-- Review and history
-- -----------------------------------------------------------------------------
create table public.comment (
  id          uuid primary key default private.uuid_v7(),
  company_id  uuid not null,
  visit_id    uuid not null,
  display_id  uuid,
  author_id   uuid not null references public.person (id) on delete restrict,
  kind        public.comment_kind not null,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  foreign key (company_id, visit_id) references public.visit (company_id, id) on delete cascade,
  foreign key (company_id, visit_id, display_id) references public.display (company_id, visit_id, id) on delete set null (display_id)
);
create index comment_visit on public.comment (visit_id, created_at);

create table public.visit_event (
  id           bigint generated always as identity primary key,
  company_id   uuid not null,
  visit_id     uuid not null,
  actor_id     uuid references public.person (id) on delete set null,
  kind         public.visit_event_kind not null,
  from_value   text,
  to_value     text,
  occurred_at  timestamptz not null default now(),
  foreign key (company_id, visit_id) references public.visit (company_id, id) on delete cascade
);
create index visit_event_visit on public.visit_event (visit_id, occurred_at);
comment on table public.visit_event is 'Append-only history. Written by triggers only.';

-- -----------------------------------------------------------------------------
-- Platform: support access, DNI lookup audit, AI usage
-- -----------------------------------------------------------------------------
create table public.support_access (
  id          uuid primary key default private.uuid_v7(),
  company_id  uuid not null references public.company (id) on delete cascade,
  admin_id    uuid not null references public.person (id) on delete restrict,
  reason      text not null check (char_length(reason) between 10 and 300),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null default now() + interval '2 hours',
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);
create index support_access_company on public.support_access (company_id, starts_at desc);

create table public.dni_lookup (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.company (id) on delete cascade,
  searched_by  uuid not null references public.person (id) on delete cascade,
  dni_hash     bytea not null,
  found        boolean not null,
  searched_at  timestamptz not null default now()
);
create index dni_lookup_rate on public.dni_lookup (searched_by, searched_at);
comment on table public.dni_lookup is 'DNI lookup log. Stores the hash, never the DNI.';

create table public.ai_usage (
  company_id             uuid not null references public.company (id) on delete cascade,
  month                  date not null check (extract(day from month) = 1),
  captures               integer not null default 0 check (captures >= 0),
  cost_usd_thousandths   integer not null default 0 check (cost_usd_thousandths >= 0),
  primary key (company_id, month)
);

-- -----------------------------------------------------------------------------
-- Touch triggers (updated_at / version)
-- -----------------------------------------------------------------------------
create trigger touch before insert or update on public.person        for each row execute function private.touch();
create trigger touch before insert or update on public.company       for each row execute function private.touch();
create trigger touch before insert or update on public.team          for each row execute function private.touch();
create trigger touch before insert or update on public.membership    for each row execute function private.touch();
create trigger touch before insert or update on public.import_format for each row execute function private.touch();
create trigger touch before insert or update on public.store         for each row execute function private.touch();
create trigger touch before insert or update on public.workday       for each row execute function private.touch();
create trigger touch before insert or update on public.visit         for each row execute function private.touch();
create trigger touch before insert or update on public.display       for each row execute function private.touch();
create trigger touch before insert or update on public.photo         for each row execute function private.touch();

-- Locked down until part 3 defines the policies.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
