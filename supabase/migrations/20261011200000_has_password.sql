-- Google users who set a password via updateUser get no 'email' identity,
-- so the client cannot tell from identities. Only answers for the caller.
create function public.has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.encrypted_password is not null and u.encrypted_password <> ''
                   from auth.users u where u.id = auth.uid()), false)
$$;

revoke all on function public.has_password() from public, anon;
grant execute on function public.has_password() to authenticated;
