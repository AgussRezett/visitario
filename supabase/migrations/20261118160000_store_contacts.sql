-- Known names of a store: who to ask for when you arrive (the owner, the manager). Saying a
-- name they know is often the difference between activating and being sent away. Anyone in
-- the company who works with stores can add, fix or remove one; nothing is really deleted.

create table public.store_contact (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  store_id    uuid not null,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  -- "Dueño", "Encargada", "Repositor de la tarde"
  role        text check (role is null or char_length(role) <= 40),
  note        text check (note is null or char_length(note) <= 200),
  created_by  uuid not null references public.person (id) on delete restrict,
  updated_by  uuid references public.person (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  deleted_at  timestamptz,
  foreign key (company_id, store_id) references public.store (company_id, id)
);
comment on table public.store_contact is 'Known names of a store (owner, manager) to ask for when arriving; anyone in the company can keep them.';
create index store_contact_store on public.store_contact (store_id) where deleted_at is null;
create trigger touch before insert or update on public.store_contact for each row execute function private.touch();

-- Who added or changed it, and its company, come from the server.
create function private.store_contact_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
begin
  if me is null then return new; end if;
  if tg_op = 'INSERT' then
    select s.company_id into new.company_id from public.store s where s.id = new.store_id and s.deleted_at is null;
    if new.company_id is null then raise exception 'Store not found' using errcode = 'P0002'; end if;
    new.created_by := me;
    new.deleted_at := null;
  else
    new.updated_by := me;
  end if;
  new.name := btrim(new.name);
  new.role := nullif(btrim(new.role), '');
  new.note := nullif(btrim(new.note), '');
  return new;
end $$;
create trigger stamp before insert or update on public.store_contact for each row execute function private.store_contact_stamp();

alter table public.store_contact enable row level security;
alter table public.store_contact force row level security;
revoke all on public.store_contact from anon, authenticated;
create policy store_contact_select on public.store_contact for select to authenticated
  using (company_id in (select private.my_companies()));
create policy store_contact_insert on public.store_contact for insert to authenticated
  with check (company_id in (select private.my_companies()));
create policy store_contact_update on public.store_contact for update to authenticated
  using (company_id in (select private.my_companies()) and deleted_at is null)
  with check (company_id in (select private.my_companies()));
-- Removing is setting deleted_at.
grant select, insert (store_id, name, role, note), update (name, role, note, deleted_at) on public.store_contact to authenticated;

-- Merging two stores keeps the names of both.
create or replace function public.merge_stores(p_keep uuid, p_drop uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  k public.store%rowtype;
  d public.store%rowtype;
  moved integer;
begin
  select * into k from public.store where id = p_keep and deleted_at is null;
  select * into d from public.store where id = p_drop and deleted_at is null;
  if k.id is null or d.id is null or k.company_id <> d.company_id or k.id = d.id then
    raise exception 'Store not found' using errcode = 'P0002';
  end if;
  if k.company_id not in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')) then
    raise exception 'Only supervisors and admins merge stores' using errcode = '42501';
  end if;

  update public.store set deleted_at = now(), merged_into = k.id,
         customer_number = case when k.customer_number is null then null else customer_number end
  where id = d.id;
  update public.store set
    customer_number = coalesce(k.customer_number, d.customer_number),
    name = coalesce(k.name, d.name),
    area = coalesce(k.area, d.area),
    lat = case when k.location_status = 'verified' or d.lat is null then k.lat else d.lat end,
    lng = case when k.location_status = 'verified' or d.lat is null then k.lng else d.lng end,
    location_status = case when k.location_status = 'verified' or d.lat is null then k.location_status else d.location_status end
  where id = k.id;
  update public.store_contact set store_id = k.id where store_id = d.id;

  perform set_config('visitario.merging', 'on', true);
  update public.visit set store_id = k.id where store_id = d.id;
  get diagnostics moved = row_count;
  perform set_config('visitario.merging', '', true);
  return moved;
end $$;
