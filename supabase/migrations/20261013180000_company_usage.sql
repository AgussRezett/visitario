-- =============================================================================
-- Stage 5 · Admin: what the company uses (people, photos, visits, stores, AI),
-- for its admins on "Empresa y plan".
-- =============================================================================
create function public.company_usage(p_company uuid)
returns table (active_people integer, photo_bytes bigint, photos integer, visits_this_month integer,
               stores integer, ai_captures_this_month integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start date := date_trunc('month', (now() at time zone 'America/Argentina/Buenos_Aires'))::date;
begin
  if p_company not in (select private.companies_with_role('admin')) then
    raise exception 'Only a company admin can see its usage' using errcode = '42501';
  end if;
  return query select
    (select count(*)::integer from public.membership m where m.company_id = p_company and m.status = 'active'),
    (select coalesce(sum(f.bytes), 0)::bigint from public.photo f where f.company_id = p_company and f.deleted_at is null),
    (select count(*)::integer from public.photo f where f.company_id = p_company and f.deleted_at is null),
    (select count(*)::integer from public.visit v where v.company_id = p_company and v.deleted_at is null and v.work_date >= month_start),
    (select count(*)::integer from public.store s where s.company_id = p_company and s.deleted_at is null),
    (select coalesce(sum(a.captures), 0)::integer from public.ai_usage a where a.company_id = p_company and a.month = month_start);
end $$;

revoke all on function public.company_usage from public, anon;
grant execute on function public.company_usage to authenticated;
