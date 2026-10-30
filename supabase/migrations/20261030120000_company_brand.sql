-- =============================================================================
-- A company's look: its color and its logo, set by its admins, seen by all its members.
--   · company.brand_color: '#rrggbb'. The app derives from it the action and selection
--     colors for light and dark, with readable contrast; status colors never change.
--   · company.logo_path: "<company id>/<timestamp>.png" in the public "logos" bucket
--     (a public bucket like the avatars: a logo is not private, and a stable URL lets it
--     load fast and be cached). Only the company's admins upload or remove there.
-- my_identity returns both with each membership's company, so the app paints itself
-- for the company in use without another request.
-- =============================================================================

alter table public.company
  add column brand_color text check (brand_color ~ '^#[0-9a-f]{6}$'),
  add column logo_path text constraint company_logo_own_folder check (logo_path is null or split_part(logo_path, '/', 1) = id::text);
comment on column public.company.brand_color is 'The company''s color, #rrggbb in lowercase; null = Visitario''s own.';
comment on column public.company.logo_path is 'Logo in the public "logos" bucket: <company id>/<timestamp>.png; null = no logo.';
grant select, update (brand_color, logo_path) on public.company to authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('logos', 'logos', true, 1048576, array['image/png'])
    on conflict (id) do nothing;
    execute $p$create policy logos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'logos' and (storage.foldername(name))[1] in (select c::text from private.companies_with_role('admin') c))$p$;
    execute $p$create policy logos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'logos' and (storage.foldername(name))[1] in (select c::text from private.companies_with_role('admin') c))$p$;
  end if;
end $$;

-- Who I am, now with each company's color and logo.
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
        'company', case when c.id is null then null else jsonb_build_object('name', c.name, 'kind', c.kind,
          'brand_color', c.brand_color, 'logo_path', c.logo_path) end))
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
