-- =============================================================================
-- Armar recorrido, part 2: a written request ("12 locales de Mirko en Palermo que reciban
-- bien") read by AI into a goal and filters. Each one is a use of AI like a capture: it
-- counts toward the same limits, logged with what it was for.
-- =============================================================================

alter table public.ai_event drop constraint ai_event_feature_check;
alter table public.ai_event add constraint ai_event_feature_check check (feature in ('capture', 'plan'));

drop function public.record_ai_usage(uuid, integer, uuid);
create function public.record_ai_usage(p_company uuid, p_cost_thousandths integer, p_person uuid default null, p_feature text default 'capture')
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.ai_event (company_id, person_id, feature, cost_usd_thousandths)
  values (p_company, p_person, coalesce(p_feature, 'capture'), greatest(p_cost_thousandths, 0));
  insert into public.ai_usage (company_id, month, captures, cost_usd_thousandths)
  values (p_company, date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date, 1, greatest(p_cost_thousandths, 0))
  on conflict (company_id, month) do update
    set captures = public.ai_usage.captures + 1,
        cost_usd_thousandths = public.ai_usage.cost_usd_thousandths + excluded.cost_usd_thousandths
  returning captures into n;
  return n;
end $$;
revoke all on function public.record_ai_usage(uuid, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, integer, uuid, text) to service_role;
