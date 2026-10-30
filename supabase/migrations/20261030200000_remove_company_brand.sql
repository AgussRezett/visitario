-- =============================================================================
-- Undoes 20261030120000_company_brand (reverted in #87): the company's color and logo.
-- Both columns were empty in every company. The "logos" bucket goes only if empty: its
-- files are removed from the dashboard first (deleting them by SQL would leave them
-- behind in the storage service).
-- =============================================================================

-- Who I am, as before: the companies without color nor logo.
create or replace function public.my_identity() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'has_password', public.has_password(),
    'person', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'avatar_path', p.avatar_path,
      'dni', pp.dni, 'phone', pp.phone, 'birth_date', pp.birth_date) end,
    'memberships', case when p.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'company_id', m.company_id, 'roles', m.roles, 'status', m.status, 'starts_on', m.starts_on,
        'company', case when c.id is null then null else jsonb_build_object('name', c.name, 'kind', c.kind) end))
      from public.membership m
      left join public.company c on c.id = m.company_id
      where m.person_id = p.id), '[]'::jsonb) end,
    'is_platform_admin', p.id is not null and exists (select 1 from public.platform_admin a where a.person_id = p.id),
    'invitations', case when p.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(i)) from public.my_invitations() i), '[]'::jsonb) end)
  from (select 1) one
  left join public.person p on p.auth_user_id = auth.uid()
  left join public.person_private pp on pp.person_id = p.id;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'drop policy if exists logos_insert on storage.objects';
    execute 'drop policy if exists logos_delete on storage.objects';
    if not exists (select 1 from storage.objects where bucket_id = 'logos') then
      delete from storage.buckets where id = 'logos';
    end if;
  end if;
end $$;

alter table public.company drop column if exists brand_color, drop column if exists logo_path;
