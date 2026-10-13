-- =============================================================================
-- Stage 4 · Import: the supervisor loads the team's day from a spreadsheet or
-- pasted text. Matching is read-only (nothing is created while reviewing); the
-- import itself is one transaction: stores, draft workdays, visits and the saved
-- column format all land together or not at all.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Which rows are already in the directory: by customer number first (the number
-- wins even if the spreadsheet spells the address differently), then by address.
--   p_rows: [{ customer_number?, address? }, …]  →  one row per match, idx from 0
-- -----------------------------------------------------------------------------
create function public.match_stores(p_company uuid, p_rows jsonb)
returns table (idx integer, store_id uuid, name text, address text, area text, customer_number text,
               location_status public.location_status, matched_by text)
language sql stable security invoker set search_path = '' as $$
  select (r.ord - 1)::integer, s.id, s.name, s.address, s.area, s.customer_number, s.location_status, m.by
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]' end) with ordinality as r (item, ord)
  cross join lateral (
    select x.id, x.by from (
      select c.id, 'customer'::text as by, 1 as rank from public.store c
      where c.company_id = p_company and c.deleted_at is null
        and c.customer_number = nullif(btrim(r.item ->> 'customer_number'), '')
      union all
      select a.id, 'address', 2 from public.store a
      where a.company_id = p_company and a.deleted_at is null
        and char_length(btrim(coalesce(r.item ->> 'address', ''))) >= 3
        and private.normalize(a.address) = private.normalize(r.item ->> 'address')
    ) x
    order by x.rank, x.id
    limit 1
  ) m
  join public.store s on s.id = m.id
  where r.ord <= 500;
$$;

-- -----------------------------------------------------------------------------
-- The import. Each row goes to a merchandiser's workday for p_date (an existing
-- one, or a new draft the supervisor publishes from Asignar).
--   p_rows: [{ merchandiser, store?, customer_number?, name?, address?, area?,
--              lat?, lng?, location_status?, task? }, …]  (1 to 500)
--   p_format: { name, signature, mapping } to remember the columns, or null
-- Returns { workdays, visits, stores }.
-- -----------------------------------------------------------------------------
create function public.import_workdays(p_company uuid, p_date date, p_rows jsonb, p_format jsonb default null)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  me        uuid := private.current_person_id();
  r         jsonb;
  sid       uuid;
  wid       uuid;
  cn        text;
  addr      text;
  plans     jsonb := '{}';
  n_visits  integer := 0;
  n_stores  integer := 0;
  before    integer;
  after     integer;
begin
  if p_company not in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')) then
    raise exception 'Only supervisors and admins can import' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'An import has 1 to 500 rows' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    sid  := nullif(r ->> 'store', '')::uuid;
    cn   := nullif(btrim(r ->> 'customer_number'), '');
    addr := nullif(btrim(r ->> 'address'), '');

    if sid is not null and not exists (select 1 from public.store s where s.id = sid and s.company_id = p_company and s.deleted_at is null) then
      raise exception 'Store not found' using errcode = 'P0002';
    end if;
    -- Looked up again here: two rows of the same file, or someone else, may have created it meanwhile.
    if sid is null and cn is not null then
      select s.id into sid from public.store s where s.company_id = p_company and s.customer_number = cn and s.deleted_at is null;
    end if;
    if sid is null and addr is not null then
      select s.id into sid from public.store s
      where s.company_id = p_company and s.deleted_at is null and private.normalize(s.address) = private.normalize(addr)
      order by s.id limit 1;
    end if;

    if sid is null then
      if addr is null then
        raise exception 'A new store needs an address' using errcode = '23502';
      end if;
      insert into public.store (company_id, customer_number, name, address, area, lat, lng, location_status, source, created_by)
      values (p_company, cn, nullif(btrim(r ->> 'name'), ''), addr, nullif(btrim(r ->> 'area'), ''),
              (r ->> 'lat')::double precision, (r ->> 'lng')::double precision,
              case when r ->> 'lat' is null then 'unverified'
                   else coalesce(nullif(r ->> 'location_status', ''), 'approximate') end::public.location_status,
              'imported', me)
      returning id into sid;
      n_stores := n_stores + 1;
    else
      -- What the spreadsheet knows and the directory does not yet (never overwrites).
      update public.store s
      set customer_number = coalesce(s.customer_number, cn),
          name = coalesce(s.name, nullif(btrim(r ->> 'name'), ''))
      where s.id = sid
        and ((s.customer_number is null and cn is not null
              and not exists (select 1 from public.store o where o.company_id = p_company and o.customer_number = cn and o.deleted_at is null))
             or (s.name is null and nullif(btrim(r ->> 'name'), '') is not null));
    end if;

    wid := (plans ->> (r ->> 'merchandiser'))::uuid;
    if wid is null then
      wid := public.plan_workday(p_company, (r ->> 'merchandiser')::uuid, p_date);
      plans := plans || jsonb_build_object(r ->> 'merchandiser', wid);
    end if;

    select count(*) into before from public.visit v where v.workday_id = wid and v.deleted_at is null;
    perform public.add_visit(wid, p_store => sid, p_task => r ->> 'task');
    select count(*) into after from public.visit v where v.workday_id = wid and v.deleted_at is null;
    n_visits := n_visits + (after - before);
  end loop;

  if p_format is not null then
    insert into public.import_format (company_id, name, signature, mapping, last_used_at)
    values (p_company, btrim(p_format ->> 'name'), p_format ->> 'signature', p_format -> 'mapping', now())
    on conflict (company_id, signature) do update
      set name = excluded.name, mapping = excluded.mapping, last_used_at = now();
  end if;

  return jsonb_build_object('workdays', (select count(*) from jsonb_object_keys(plans)), 'visits', n_visits, 'stores', n_stores);
end $$;

revoke all on function public.match_stores, public.import_workdays from public, anon;
grant execute on function public.match_stores, public.import_workdays to authenticated;
