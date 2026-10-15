-- =============================================================================
-- Capture with AI: every capture read adds to the company's month (captures and an
-- estimated cost in thousandths of a dollar). Only the read-capture function writes it.
-- =============================================================================
create function public.record_ai_usage(p_company uuid, p_cost_thousandths integer)
returns integer
language sql security definer set search_path = '' as $$
  insert into public.ai_usage (company_id, month, captures, cost_usd_thousandths)
  values (p_company, date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date, 1, greatest(p_cost_thousandths, 0))
  on conflict (company_id, month) do update
    set captures = public.ai_usage.captures + 1,
        cost_usd_thousandths = public.ai_usage.cost_usd_thousandths + excluded.cost_usd_thousandths
  returning captures;
$$;

revoke all on function public.record_ai_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, integer) to service_role;
