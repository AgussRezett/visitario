-- =============================================================================
-- Reputation with customers: how the store's buyer received the merchandiser, one
-- optional tap per visit. Only the merchandiser records it. A visit the store did not
-- authorize counts as 'unwilling' when nothing was marked.
--   welcoming    libre y con buena onda   (3 points)
--   restricted   con restricciones        (2)
--   indifferent  con indiferencia         (1)
--   unwilling    no quiso que activemos   (0)
-- =============================================================================
create type public.rapport_kind as enum ('welcoming', 'restricted', 'indifferent', 'unwilling');

alter table public.visit add column rapport public.rapport_kind;
comment on column public.visit.rapport is 'How the buyer received the merchandiser (optional, set by the merchandiser).';

grant update (rapport) on public.visit to authenticated;

-- The rating that counts: the one marked, or 'unwilling' for a refused visit.
create function private.rapport_points(p_rapport public.rapport_kind, p_consent public.consent_kind) returns integer
language sql immutable set search_path = '' as $$
  select case coalesce(p_rapport, case when p_consent = 'refused' then 'unwilling'::public.rapport_kind end)
    when 'welcoming' then 3 when 'restricted' then 2 when 'indifferent' then 1 when 'unwilling' then 0 end;
$$;

-- -----------------------------------------------------------------------------
-- A store's reputation for anyone in the company, merchandisers included: only numbers
-- (never who rated what). The last 6 rated visits of 180 days: the average of the last 3
-- and of the 3 before, and of the last 5 as the store's level.
-- -----------------------------------------------------------------------------
create function public.store_reputation(p_company uuid, p_stores uuid[])
returns table (store_id uuid, score numeric, recent numeric, previous numeric, rated integer, last_rated date)
language sql stable security definer set search_path = '' as $$
  with rated as (
    select v.store_id, v.work_date, private.rapport_points(v.rapport, v.consent) as p,
           row_number() over (partition by v.store_id order by v.work_date desc, v.finished_at desc nulls last) as rn
    from public.visit v
    where v.company_id = p_company
      and p_company in (select private.my_companies())
      and v.store_id = any (p_stores)
      and v.deleted_at is null
      and v.work_date >= current_date - 180
      and private.rapport_points(v.rapport, v.consent) is not null
  )
  select r.store_id,
         round(avg(r.p) filter (where r.rn <= 5), 2),
         round(avg(r.p) filter (where r.rn <= 3), 2),
         round(avg(r.p) filter (where r.rn between 4 and 6), 2),
         count(*) filter (where r.rn <= 5)::integer,
         max(r.work_date)
  from rated r
  group by r.store_id;
$$;

-- -----------------------------------------------------------------------------
-- The dashboard's facts: rated visits per week, store and merchandiser, under the
-- caller's RLS (a supervisor: their team; an admin: the company).
-- -----------------------------------------------------------------------------
create function public.rapport_facts(p_company uuid, p_from date, p_to date)
returns table (week date, store_id uuid, store_name text, address text, area text,
               merchandiser_id uuid, first_name text, last_name text, rapport public.rapport_kind, visits integer)
language sql stable security invoker set search_path = '' as $$
  select date_trunc('week', v.work_date)::date, s.id, s.name, s.address, s.area, p.id, p.first_name, p.last_name,
         coalesce(v.rapport, 'unwilling'::public.rapport_kind), count(*)::integer
  from public.visit v
  join public.store s on s.id = v.store_id
  join public.person p on p.id = v.merchandiser_id
  where v.company_id = p_company and v.deleted_at is null
    and v.work_date between p_from and p_to
    and (v.rapport is not null or v.consent = 'refused')
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9;
$$;

revoke all on function public.store_reputation(uuid, uuid[]), public.rapport_facts(uuid, date, date) from public, anon;
grant execute on function public.store_reputation(uuid, uuid[]), public.rapport_facts(uuid, date, date) to authenticated;
grant execute on function private.rapport_points(public.rapport_kind, public.consent_kind) to authenticated;

-- -----------------------------------------------------------------------------
-- Visit guard: the rating is part of the merchandiser's record of the visit, so a
-- supervisor cannot change it (same function as 20261013200000_directory otherwise).
-- -----------------------------------------------------------------------------
create or replace function private.visit_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me     uuid := private.current_person_id();
  acting text;
begin
  if (new.id, new.company_id, new.workday_id, new.merchandiser_id, new.work_date, new.source, new.added_by, new.resumed_from)
     is distinct from
     (old.id, old.company_id, old.workday_id, old.merchandiser_id, old.work_date, old.source, old.added_by, old.resumed_from) then
    raise exception 'Immutable visit fields' using errcode = '23514';
  end if;

  if coalesce(current_setting('visitario.merging', true), '') = 'on' then
    if (to_jsonb(new) - 'store_id' - 'updated_at' - 'version' - 'updated_by') <> (to_jsonb(old) - 'store_id' - 'updated_at' - 'version' - 'updated_by') then
      raise exception 'Merging only moves visits to another store' using errcode = '23514';
    end if;
    return new;
  end if;

  if not private.work_transition_is_valid(old.work_status, new.work_status) then
    raise exception 'Work status transition not allowed: % -> %', old.work_status, new.work_status using errcode = '23514';
  end if;

  if me is not null then
    acting := private.visit_role(old.id);
    if acting is null then
      raise exception 'No permission on this visit' using errcode = '42501';
    end if;

    if acting = 'merchandiser' then
      if old.review_status = 'approved' then
        raise exception 'An approved visit is locked' using errcode = '42501';
      end if;
      if new.review_status <> old.review_status
         and not (old.review_status = 'needs_fix' and new.review_status = 'unreviewed') then
        raise exception 'A merchandiser can only resubmit a fix' using errcode = '42501';
      end if;
      if (new.store_id, new.task) is distinct from (old.store_id, old.task) and old.source = 'assigned' then
        raise exception 'Only the supervisor changes the store or task of an assigned visit' using errcode = '42501';
      end if;
    else -- supervisor or admin acting on someone else's visit
      if (new.work_status, new.arrived_at, new.consent, new.objection, new.notes, new.finished_at, new.retry_after, new.rapport)
         is distinct from
         (old.work_status, old.arrived_at, old.consent, old.objection, old.notes, old.finished_at, old.retry_after, old.rapport) then
        raise exception 'Only the merchandiser records the visit work' using errcode = '42501';
      end if;
      if (new.store_id, new.task) is distinct from (old.store_id, old.task) and old.work_status <> 'pending' then
        raise exception 'Only a pending visit can be reassigned' using errcode = '23514';
      end if;
      if new.review_status = 'needs_fix' and old.review_status <> 'needs_fix'
         and not exists (select 1 from public.comment c
                         where c.visit_id = old.id and c.kind = 'fix_request' and c.author_id = me
                           and c.created_at >= old.updated_at) then
        raise exception 'Requesting a fix needs a comment' using errcode = '23514';
      end if;
    end if;
  end if;

  -- Derived stamps
  if new.work_status in ('done', 'refused', 'closed') and old.work_status not in ('done', 'refused', 'closed') then
    new.finished_at := coalesce(new.finished_at, now());
  elsif new.work_status in ('pending', 'in_progress') then
    new.finished_at := null;
    if new.review_status <> 'unreviewed' then new.review_status := 'unreviewed'; end if;
  end if;
  if new.review_status <> old.review_status then
    if new.review_status = 'unreviewed' then
      new.reviewed_by := null; new.reviewed_at := null;
    else
      new.reviewed_by := me; new.reviewed_at := now();
    end if;
  end if;
  new.updated_by := me;
  return new;
end $$;
