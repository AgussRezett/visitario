-- =============================================================================
-- Pedidos de activación: a seller asks to activate one of their clients (a launch, a new
-- display, a client that is dropping) and the supervisor schedules it in a merchandiser's
-- day from Asignar, or dismisses it with a reason. The seller sees how it went.
--   open → scheduled (a stop in someone's day) | dismissed
-- If that stop is taken out of the day, the request is open again.
-- =============================================================================

create type public.activation_request_status as enum ('open', 'scheduled', 'dismissed');

create table public.activation_request (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.company (id) on delete cascade,
  store_id                uuid not null,
  requested_by            uuid not null references public.person (id) on delete restrict,
  note                    text check (note is null or char_length(note) <= 300),
  status                  public.activation_request_status not null default 'open',
  visit_id                uuid references public.visit (id) on delete set null,
  scheduled_for           date,
  scheduled_merchandiser  uuid references public.person (id) on delete set null,
  answered_by             uuid references public.person (id) on delete set null,
  answered_at             timestamptz,
  answer                  text check (answer is null or char_length(answer) <= 300),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  version                 integer not null default 1,
  deleted_at              timestamptz,
  foreign key (company_id, store_id) references public.store (company_id, id)
);
comment on table public.activation_request is 'A seller asks to activate a client; the supervisor schedules or dismisses it.';
create unique index activation_request_one_open on public.activation_request (store_id) where status = 'open' and deleted_at is null;
create index activation_request_inbox on public.activation_request (company_id, status, created_at) where deleted_at is null;
create index activation_request_visit on public.activation_request (visit_id) where visit_id is not null;
create trigger touch before insert or update on public.activation_request for each row execute function private.touch();

-- A supervisor or admin of the company.
create function private.is_boss(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_company in (select private.companies_with_role('supervisor')) or p_company in (select private.companies_with_role('admin'))
$$;
revoke all on function private.is_boss(uuid) from public, anon;
grant execute on function private.is_boss(uuid) to authenticated;

alter table public.activation_request enable row level security;
alter table public.activation_request force row level security;
revoke all on public.activation_request from anon, authenticated;
create policy activation_request_select on public.activation_request for select to authenticated
  using (company_id in (select private.my_companies())
         and (private.is_boss(company_id) or requested_by = (select private.current_person_id()) or private.is_my_client(store_id)));
-- Changes only through the functions below.
grant select on public.activation_request to authenticated;

-- The seller asks (one open request per client: asking again updates its note).
create function public.request_activation(p_store uuid, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s    public.store%rowtype;
  rid  uuid;
  v_note text := left(nullif(btrim(p_note), ''), 300);
begin
  select * into s from public.store where id = p_store and deleted_at is null;
  if not found or not private.is_my_client(p_store) then
    raise exception 'Only the client''s seller asks for its activation' using errcode = '42501';
  end if;
  select id into rid from public.activation_request where store_id = p_store and status = 'open' and deleted_at is null;
  if rid is not null then
    update public.activation_request a set note = coalesce(v_note, a.note) where a.id = rid;
    return rid;
  end if;
  insert into public.activation_request (company_id, store_id, requested_by, note)
  values (s.company_id, p_store, private.current_person_id(), v_note)
  returning id into rid;
  return rid;
end $$;

-- Its seller takes it back while open.
create function public.cancel_activation_request(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.activation_request set deleted_at = now()
  where id = p_request and status = 'open' and deleted_at is null and requested_by = private.current_person_id();
end $$;

-- The supervisor's answers. Scheduling adds the store to the merchandiser's day with the
-- seller's note as the stop's task, with the supervisor's own permissions (invoker).
create function private.answer_activation_request(p_request uuid, p_status public.activation_request_status,
  p_visit uuid, p_date date, p_merchandiser uuid, p_answer text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.activation_request%rowtype;
begin
  select * into r from public.activation_request where id = p_request and deleted_at is null for update;
  if not found or not private.is_boss(r.company_id) then
    raise exception 'Only a supervisor or an admin answers an activation request' using errcode = '42501';
  end if;
  if r.status <> 'open' then
    raise exception 'The request was already answered' using errcode = '23514';
  end if;
  update public.activation_request set status = p_status, visit_id = p_visit, scheduled_for = p_date,
    scheduled_merchandiser = p_merchandiser, answered_by = private.current_person_id(), answered_at = now(),
    answer = left(nullif(btrim(p_answer), ''), 300)
  where id = p_request;
end $$;
revoke all on function private.answer_activation_request(uuid, public.activation_request_status, uuid, date, uuid, text) from public, anon;
grant execute on function private.answer_activation_request(uuid, public.activation_request_status, uuid, date, uuid, text) to authenticated;

create function public.schedule_activation_request(p_request uuid, p_merchandiser uuid, p_date date) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  r     record;
  wid   uuid;
  vid   uuid;
begin
  select a.id, a.company_id, a.store_id, a.note, a.status, p.first_name
  into r
  from public.activation_request a join public.person p on p.id = a.requested_by
  where a.id = p_request and a.deleted_at is null;
  if not found or not private.is_boss(r.company_id) then
    raise exception 'Only a supervisor or an admin answers an activation request' using errcode = '42501';
  end if;
  if r.status <> 'open' then
    raise exception 'The request was already answered' using errcode = '23514';
  end if;
  wid := public.plan_workday(r.company_id, p_merchandiser, p_date);
  vid := public.add_visit(wid, p_store => r.store_id,
                          p_task => left('Pedido de ' || r.first_name || coalesce(': ' || r.note, ''), 300));
  perform private.answer_activation_request(p_request, 'scheduled', vid, p_date, p_merchandiser, null);
  return vid;
end $$;

create function public.dismiss_activation_request(p_request uuid, p_answer text default null) returns void
language sql security invoker set search_path = '' as $$
  select private.answer_activation_request(p_request, 'dismissed', null, null, null, p_answer)
$$;

revoke all on function public.request_activation(uuid, text) from public, anon;
revoke all on function public.cancel_activation_request(uuid) from public, anon;
revoke all on function public.schedule_activation_request(uuid, uuid, date) from public, anon;
revoke all on function public.dismiss_activation_request(uuid, text) from public, anon;
grant execute on function public.request_activation(uuid, text) to authenticated;
grant execute on function public.cancel_activation_request(uuid) to authenticated;
grant execute on function public.schedule_activation_request(uuid, uuid, date) to authenticated;
grant execute on function public.dismiss_activation_request(uuid, text) to authenticated;

-- A scheduled stop taken out of the day: the request is open again (unless another one
-- for that client is already open).
create function private.reopen_activation_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.activation_request a set status = 'open', visit_id = null, scheduled_for = null, scheduled_merchandiser = null,
      answered_by = null, answered_at = null
    where a.visit_id = new.id and a.status = 'scheduled' and a.deleted_at is null
      and not exists (select 1 from public.activation_request o where o.store_id = a.store_id and o.status = 'open' and o.deleted_at is null);
  end if;
  return null;
end $$;
create trigger reopen_activation_request after update of deleted_at on public.visit
  for each row execute function private.reopen_activation_request();

-- Asignar updates by itself when a seller asks.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activation_request;
  end if;
end $$;
