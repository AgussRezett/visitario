-- =============================================================================
-- Tidy store text: only a word that starts with a digit stays as written (3526, 4B,
-- 2do). A word with a digit inside ("VALDENEGR0", a typo) is tidied like the rest.
-- Same function as 20261017160000_store_tidy_and_remove otherwise; stores retidied.
-- =============================================================================
create or replace function private.tidy_text(t text) returns text
language plpgsql immutable parallel safe set search_path = '' as $$
declare
  w    text;
  prev text := '';
  i    integer := 0;
  out text[] := '{}';
begin
  if t is null then return null; end if;
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
  if t = '' then return null; end if;
  foreach w in array string_to_array(t, ' ') loop
    i := i + 1;
    if w ~ '^[0-9]' then
      out := out || w;                                   -- 3526, 4B, 2do
    elsif w ~* '^([a-z]\.){2,}$' or w ~* '^[ivx]{1,6}$' then
      out := out || upper(w);                            -- S.A., XXIII
    elsif i > 1 and (lower(w) in ('de', 'del', 'y', 'e')
                     or (lower(w) in ('la', 'las', 'los', 'el') and lower(prev) in ('de', 'a'))) then
      out := out || lower(w);                            -- Soldado de la Independencia
    else
      out := out || initcap(w);                          -- also O'Higgins, Av., Almacén La Esquina
    end if;
    prev := w;
  end loop;
  return array_to_string(out, ' ');
end $$;

update public.store
set name = private.tidy_text(name), address = private.tidy_text(address), area = private.tidy_text(area)
where removed_at is null
  and (name is distinct from private.tidy_text(name)
       or address is distinct from private.tidy_text(address)
       or area is distinct from private.tidy_text(area));
