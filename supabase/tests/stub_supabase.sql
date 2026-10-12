-- Solo para probar fuera de Supabase: imita lo mínimo de auth y los roles.
create schema if not exists extensions;
create schema if not exists auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text, phone text, encrypted_password text);
-- Same as Supabase: PostgREST sets request.jwt.claims; older setups set request.jwt.claim.sub.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
