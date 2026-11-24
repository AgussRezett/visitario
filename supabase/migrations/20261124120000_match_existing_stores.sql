-- Adding several stores reuses the ones already in the directory more often: the same
-- customer number (also written with leading zeros), or the same street and number written
-- another way ("Callao 2000" is "Av. Callao 2000"). The review shows those rows as the store
-- they are (match_day_stores) before adding, and a store matched by address that had no
-- customer number keeps the one the list gave.

/** An address to compare: no accents or punctuation, and without the kind of street in front ("Av.", "Calle", "Pje."). */
create function private.street_key(t text) returns text
language sql immutable parallel safe strict set search_path = '' as $$
  select regexp_replace(private.normalize(t), '^(av|avda|avenida|calle|cl|pje|pasaje|bv|bvar|boulevard|bulevar|diag|diagonal) ', '');
$$;

/** The company's store a row means: by customer number first, then by address. `archived` when the number is an archived store's. */
create function private.match_store(p_company uuid, p_number text, p_address text)
returns table (store_id uuid, matched_by text, archived text)
language plpgsql stable security invoker set search_path = '' as $$
declare
  num text := nullif(ltrim(btrim(coalesce(p_number, '')), '0'), '');
  key text := private.street_key(coalesce(p_address, ''));
begin
  if num is not null then
    select s.id, 'customer' into store_id, matched_by from public.store s
    where s.company_id = p_company and s.deleted_at is null and ltrim(btrim(s.customer_number), '0') = num
    order by s.id limit 1;
    if store_id is not null then return next; return; end if;
    select s.address into archived from public.store s
    where s.company_id = p_company and ltrim(btrim(s.customer_number), '0') = num
    limit 1;
    if archived is not null then return next; return; end if;
  end if;
  if char_length(key) >= 3 then
    -- Not a store with another customer number: at the same address, that is another customer.
    select s.id, 'address' into store_id, matched_by from public.store s
    where s.company_id = p_company and s.deleted_at is null and private.street_key(s.address) = key
      and (num is null or s.customer_number is null or ltrim(btrim(s.customer_number), '0') = num)
    order by s.customer_number is null, s.id limit 1;
  end if;
  return next;
end $$;

/** For the review: which rows are already stores of the directory, and which one. */
create function public.match_day_stores(p_company uuid, p_rows jsonb)
returns table (idx integer, store_id uuid, matched_by text, name text, address text, area text, customer_number text, channel_id integer, seller_id integer)
language sql stable security invoker set search_path = '' as $$
  select (t.ord - 1)::integer, s.id, m.matched_by, s.name, s.address, s.area, s.customer_number, s.channel_id, s.seller_id
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) <= 300 then p_rows else '[]' end)
       with ordinality as t (item, ord)
  cross join lateral private.match_store(p_company, t.item ->> 'customer_number', t.item ->> 'address') m
  join public.store s on s.id = m.store_id
  where p_company in (select private.my_companies());
$$;
revoke all on function public.match_day_stores(uuid, jsonb) from public, anon;
grant execute on function public.match_day_stores(uuid, jsonb) to authenticated;

create or replace function public.add_visits(p_workday uuid, p_rows jsonb)
returns table (idx integer, visit_id uuid, store_id uuid, matched_by text, created boolean, error text, detail text)
language plpgsql security invoker set search_path = '' as $$
declare
  w     public.workday%rowtype;
  r     record;
  m     record;
  sid   uuid;
  num   text;
  addr  text;
  v_task text;
begin
  select * into w from public.workday where id = p_workday and deleted_at is null;
  if not found then raise exception 'Workday not found' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 300 then
    raise exception 'Between 0 and 300 rows' using errcode = '22023';
  end if;

  for r in select (t.ord - 1)::integer as i, t.item from jsonb_array_elements(p_rows) with ordinality as t (item, ord) loop
    idx := r.i; visit_id := null; store_id := null; matched_by := null; created := false; error := null; detail := null;
    num := nullif(btrim(r.item ->> 'customer_number'), '');
    addr := nullif(btrim(r.item ->> 'address'), '');
    v_task := left(nullif(btrim(r.item ->> 'task'), ''), 500);
    begin
      select * into m from private.match_store(w.company_id, num, addr);
      sid := m.store_id;
      matched_by := m.matched_by;
      if m.archived is not null then
        error := 'archived_customer'; detail := m.archived;
      elsif sid is null and char_length(coalesce(addr, '')) < 3 then
        error := 'no_address';
      end if;

      if error is null then
        created := sid is null or not exists (
          select 1 from public.visit v where v.workday_id = p_workday and v.store_id = sid and v.deleted_at is null);
        if sid is null then
          visit_id := public.add_visit(p_workday, p_address => addr, p_customer_number => num, p_area => r.item ->> 'area', p_task => v_task);
        else
          visit_id := public.add_visit(p_workday, p_store => sid, p_task => v_task);
          -- Found by its address and without a customer number: it keeps the one the list gave.
          -- (Only someone who may edit stores; for anyone else the store stays as it was.)
          if matched_by = 'address' and num is not null then
            begin
              update public.store s set customer_number = num
              where s.id = sid and s.customer_number is null
                and not exists (select 1 from public.store o where o.company_id = w.company_id and o.customer_number = num);
            exception when insufficient_privilege then null;
            end;
          end if;
        end if;
        select v.store_id into sid from public.visit v where v.id = visit_id;
        store_id := sid;
        perform public.tag_store(sid, nullif(r.item ->> 'channel', '')::integer, nullif(r.item ->> 'seller', '')::integer);
      end if;
    exception when others then
      visit_id := null; store_id := null; created := false;
      error := case sqlstate when '23505' then 'duplicate_customer' when 'P0002' then 'not_found' else 'failed' end;
      detail := sqlerrm;
    end;
    return next;
  end loop;
end $$;
comment on function public.add_visits is 'Adds pasted stores to a workday in order, each line on its own and with its task if any, reusing the directory''s stores (by customer number, then address); returns per line what happened or why it failed.';
