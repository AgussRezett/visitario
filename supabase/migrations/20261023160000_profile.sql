-- =============================================================================
-- Profile for everyone: a profile photo, and the phone editable by its owner.
--   · person.avatar_path: "<auth user id>/<timestamp>.jpg" in the public "avatars"
--     bucket. Only its owner sets it, and only to a file of their own folder. Coworkers
--     read it with the name (person_select). The photo is re-encoded on the phone, so it
--     never carries location.
--   · person_private.phone: the owner can change it; a new number is not verified.
-- Storage is guarded: the local test database has no storage schema.
-- =============================================================================

alter table public.person
  add column avatar_path text check (char_length(avatar_path) <= 120),
  add constraint person_avatar_own_folder check (avatar_path is null or split_part(avatar_path, '/', 1) = auth_user_id::text);
grant update (avatar_path) on public.person to authenticated;
comment on column public.person.avatar_path is 'Profile photo in the public "avatars" bucket: <auth user id>/<timestamp>.jpg.';

grant update (phone) on public.person_private to authenticated;

create function private.phone_changed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.phone is distinct from old.phone then new.phone_verified_at := null; end if;
  return new;
end $$;
create trigger phone_changed before update of phone on public.person_private
for each row execute function private.phone_changed();

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 1048576, array['image/jpeg'])
    on conflict (id) do nothing;
    execute $p$create policy avatars_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy avatars_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  end if;
end $$;

-- Who I am, now with the photo.
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
