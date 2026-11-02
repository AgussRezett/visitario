-- =============================================================================
-- Pasting several stores into a workday, in one call. Each line is added on its own:
-- one that fails does not stop the others, and comes back with the reason so the
-- merchandiser can fix it and try again.
--
-- Each line is matched as it goes, so two lines with the same customer number end up
-- in the same store (the second one finds the store the first one just created).
-- A customer number that belongs to an archived store is reported, not reused: that
-- store was removed on purpose, and the number cannot go to a new one.
-- Channel and seller follow tag_store: an activador fills them only when empty.
-- =============================================================================

create function public.add_visits(p_workday uuid, p_rows jsonb)
returns table (idx integer, visit_id uuid, store_id uuid, matched_by text, created boolean, error text, detail text)
language plpgsql security invoker set search_path = '' as $$
declare
  w     public.workday%rowtype;
  r     record;
  sid   uuid;
  num   text;
  addr  text;
  taken text;
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
    sid := null;
    begin
      if num is not null then
        select s.id into sid from public.store s
        where s.company_id = w.company_id and s.customer_number = num and s.deleted_at is null;
        if sid is not null then
          matched_by := 'customer';
        else
          select s.address into taken from public.store s
          where s.company_id = w.company_id and s.customer_number = num;
          if found then
            error := 'archived_customer'; detail := taken;
          end if;
        end if;
      end if;
      if error is null and sid is null and char_length(coalesce(addr, '')) >= 3 then
        select s.id into sid from public.store s
        where s.company_id = w.company_id and s.deleted_at is null
          and private.normalize(s.address) = private.normalize(addr)
        order by s.id limit 1;
        if sid is not null then matched_by := 'address'; end if;
      end if;
      if error is null and sid is null and char_length(coalesce(addr, '')) < 3 then
        error := 'no_address';
      end if;

      if error is null then
        created := sid is null or not exists (
          select 1 from public.visit v where v.workday_id = p_workday and v.store_id = sid and v.deleted_at is null);
        if sid is null then
          visit_id := public.add_visit(p_workday, p_address => addr, p_customer_number => num, p_area => r.item ->> 'area');
        else
          visit_id := public.add_visit(p_workday, p_store => sid);
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
comment on function public.add_visits is 'Adds pasted stores to a workday, each line on its own; returns per line what happened or why it failed.';
revoke all on function public.add_visits(uuid, jsonb) from public, anon;
grant execute on function public.add_visits(uuid, jsonb) to authenticated;
