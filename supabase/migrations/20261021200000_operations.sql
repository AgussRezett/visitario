-- =============================================================================
-- Operativos: activadores that go out together. An operativo is the workday of whoever
-- hosts it, shared: its stops are one visit per store, and every member works them as
-- their own (arrival, photos, work, finishing). Each member keeps their own workday, and
-- what is done in the operativo counts in each one's day (progress, metrics, team view).
-- Supervisors see it through any member of their team.
-- =============================================================================

create table public.operation (
  id          uuid primary key default private.uuid_v7(),
  company_id  uuid not null references public.company (id) on delete cascade,
  workday_id  uuid not null,
  host_id     uuid not null references public.person (id) on delete restrict,
  work_date   date not null,
  name        text check (char_length(name) <= 60),
  created_by  uuid not null references public.person (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  ended_at    timestamptz,
  unique (company_id, id),
  foreign key (company_id, workday_id) references public.workday (company_id, id) on delete cascade
);
create unique index operation_open_workday on public.operation (workday_id) where ended_at is null;
create index operation_day on public.operation (company_id, work_date);
comment on table public.operation is 'Operativo: the host''s workday shared with other merchandisers. Ending it keeps what was done.';

create table public.operation_member (
  operation_id  uuid not null,
  company_id    uuid not null,
  person_id     uuid not null references public.person (id) on delete restrict,
  workday_id    uuid not null,
  added_by      uuid references public.person (id) on delete set null,
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,
  primary key (operation_id, person_id),
  foreign key (company_id, operation_id) references public.operation (company_id, id) on delete cascade,
  foreign key (company_id, workday_id) references public.workday (company_id, id) on delete cascade
);
create index operation_member_person on public.operation_member (person_id);
comment on column public.operation_member.workday_id is 'The member''s own workday that date: the operativo adds to it.';

create trigger touch before insert or update on public.operation for each row execute function private.touch();

-- -----------------------------------------------------------------------------
-- Who sees and who works an operativo
-- -----------------------------------------------------------------------------
-- Operativos I can see: where I take or took part, that I created, or with a member in my scope.
create function private.visible_operations() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.operation_id from public.operation_member m where m.person_id = private.current_person_id()
  union
  select o.id from public.operation o where o.created_by = private.current_person_id()
  union
  select m.operation_id from public.operation_member m
  where m.person_id <> private.current_person_id()
    and (m.company_id, m.person_id) in (select * from private.visible_merchandisers());
$$;

-- Workdays shared with me through an operativo (a draft only to whoever is preparing it).
create function private.operation_workdays() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select o.workday_id from public.operation o join public.workday w on w.id = o.workday_id
  where o.id in (select private.visible_operations())
    and (w.status <> 'draft' or w.created_by = private.current_person_id());
$$;

-- Whether I work this workday's visits as a member of its operativo (not left).
create function private.works_operation(p_workday uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.operation o join public.operation_member m on m.operation_id = o.id
                 where o.workday_id = p_workday and m.person_id = private.current_person_id() and m.left_at is null);
$$;

-- How may I edit this visit? 'merchandiser' (mine, or an operativo I work), 'supervisor'
-- (in my scope, also through an operativo member of my team) or null.
create or replace function private.visit_role(p_visit uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
           when v.merchandiser_id = private.current_person_id() or private.works_operation(v.workday_id) then 'merchandiser'
           when (v.company_id, v.merchandiser_id) in (select * from private.visible_merchandisers()) then 'supervisor'
           when exists (select 1 from public.operation o join public.operation_member m on m.operation_id = o.id
                        where o.workday_id = v.workday_id and m.person_id <> private.current_person_id()
                          and (m.company_id, m.person_id) in (select * from private.visible_merchandisers())) then 'supervisor'
         end
  from public.visit v where v.id = p_visit;
$$;

-- A stop added by an operativo member is "added", like one added by the host.
create or replace function private.visit_on_create() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  w  public.workday%rowtype;
begin
  select * into w from public.workday where id = new.workday_id and company_id = new.company_id;
  if not found then raise exception 'Workday not found' using errcode = '23503'; end if;
  new.merchandiser_id := w.merchandiser_id;
  new.work_date := w.work_date;
  new.work_status := 'pending';
  new.review_status := 'unreviewed';
  new.reviewed_by := null; new.reviewed_at := null; new.finished_at := null;
  if me is not null then
    new.added_by := me;
    new.source := case when me = w.merchandiser_id or private.works_operation(w.id) then 'added' else 'assigned' end;
  end if;
  if new.resumed_from is not null then  -- resuming keeps the original source and author
    select o.source, o.added_by into new.source, new.added_by
    from public.visit o where o.id = new.resumed_from and o.company_id = new.company_id;
  end if;
  new.updated_by := me;
  return new;
end $$;

revoke all on function private.visible_operations, private.operation_workdays, private.works_operation from public, anon;
grant execute on function private.visible_operations, private.operation_workdays, private.works_operation to authenticated;

-- RLS: extra (permissive) policies; the existing ones stay as they are.
alter table public.operation enable row level security;
alter table public.operation force row level security;
alter table public.operation_member enable row level security;
alter table public.operation_member force row level security;
revoke all on public.operation, public.operation_member from anon, authenticated;
create policy operation_select on public.operation for select to authenticated
  using (id in (select private.visible_operations()));
create policy operation_member_select on public.operation_member for select to authenticated
  using (operation_id in (select private.visible_operations()));
grant select on public.operation, public.operation_member to authenticated;
-- Changes only through the functions below.

create policy workday_operation_select on public.workday for select to authenticated
  using (id in (select private.operation_workdays()));
create policy visit_operation_select on public.visit for select to authenticated
  using (workday_id in (select private.operation_workdays()));
create policy visit_operation_update on public.visit for update to authenticated
  using (workday_id in (select private.operation_workdays()))
  with check (workday_id in (select private.operation_workdays()));
