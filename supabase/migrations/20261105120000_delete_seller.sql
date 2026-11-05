-- =============================================================================
-- An admin deletes a seller loaded by mistake: only one nobody depends on, with no
-- Visitario user and no stores (not even archived ones). Pending invitations that
-- named it just lose the link (the foreign key sets it to null).
-- A seller with stores is merged into another (merge_sellers) or deactivated instead.
-- =============================================================================
create function public.delete_seller(p_seller integer)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.seller%rowtype;
  stores integer;
begin
  select * into s from public.seller where id = p_seller;
  if not found or s.company_id not in (select private.companies_with_role('admin')) then
    raise exception 'Only an admin deletes sellers' using errcode = '42501';
  end if;
  if s.person_id is not null then
    raise exception 'The seller has a Visitario user' using errcode = '23503';
  end if;
  select count(*) into stores from public.store where company_id = s.company_id and seller_id = s.id;
  if stores > 0 then
    raise exception 'The seller has % stores', stores using errcode = '23503';
  end if;
  delete from public.seller where id = s.id;
end $$;
revoke all on function public.delete_seller(integer) from public, anon;
grant execute on function public.delete_seller(integer) to authenticated;
