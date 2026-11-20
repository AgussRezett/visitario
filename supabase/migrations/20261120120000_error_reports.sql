-- Problems people report from the app: a screen that broke (kind 'crash', sent from the error
-- screen) or anything they want to tell (kind 'manual', from their profile). The report-error
-- function stores them here and emails them to Visitario (ERROR_REPORT_TO).
-- Nobody reads them from the app but Visitario's admins; nobody writes them but that function
-- (record_error_report runs only with the service role).

create table public.error_report (
  id          uuid primary key default private.uuid_v7(),
  -- The company the person was working in, when there was one (a crash at sign-in has none).
  company_id  uuid references public.company (id) on delete set null,
  person_id   uuid references public.person (id) on delete set null,
  kind        text not null check (kind in ('crash', 'manual')),
  message     text not null check (char_length(message) between 1 and 500),
  detail      text check (char_length(detail) <= 4000),
  comment     text check (char_length(comment) <= 1000),
  url         text check (char_length(url) <= 500),
  app_version text check (char_length(app_version) <= 40),
  user_agent  text check (char_length(user_agent) <= 300),
  emailed     boolean not null default false,
  created_at  timestamptz not null default now()
);
comment on table public.error_report is 'Problems reported from the app (crashes and manual reports), emailed to Visitario.';
create index error_report_recent on public.error_report (created_at desc);
create index error_report_person on public.error_report (person_id, created_at desc);

alter table public.error_report enable row level security;
alter table public.error_report force row level security;
create policy error_report_platform on public.error_report for select to authenticated
  using ((select private.is_platform_admin()));
revoke all on public.error_report from anon, authenticated;
grant select on public.error_report to authenticated;

/**
 * Stores a report and says whether to email it. Not emailed (only stored): the same message
 * from the same person in the last 10 minutes, more than 10 from one person in an hour, or
 * more than 5 without a session in an hour. More than 50 without a session in an hour are
 * not even stored. Returns the report id, or null when it was dropped.
 */
create function public.record_error_report(
  p_person uuid, p_company uuid, p_kind text, p_message text, p_detail text, p_comment text,
  p_url text, p_app_version text, p_user_agent text
) returns table (id uuid, email boolean)
language plpgsql security definer set search_path = '' as $$
declare
  msg text := left(coalesce(nullif(btrim(p_message), ''), 'Sin mensaje'), 500);
  recent integer;
  same boolean;
  new_id uuid;
  send boolean;
begin
  select count(*)::int,
         coalesce(bool_or(r.message = msg and r.created_at > now() - interval '10 minutes'), false)
    into recent, same
  from public.error_report r
  where r.person_id is not distinct from p_person and r.created_at > now() - interval '1 hour';

  if p_person is null and recent >= 50 then
    return;
  end if;
  send := not same and recent < (case when p_person is null then 5 else 10 end);

  insert into public.error_report (company_id, person_id, kind, message, detail, comment, url, app_version, user_agent, emailed)
  values (
    -- Only a company the person belongs to (or did).
    (select m.company_id from public.membership m where m.company_id = p_company and m.person_id = p_person limit 1),
    p_person, p_kind, msg, left(p_detail, 4000), nullif(btrim(left(p_comment, 1000)), ''),
    left(p_url, 500), left(p_app_version, 40), left(p_user_agent, 300), send)
  returning error_report.id into new_id;
  return query select new_id, send;
end $$;
revoke all on function public.record_error_report(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_error_report(uuid, uuid, text, text, text, text, text, text, text) to service_role;
