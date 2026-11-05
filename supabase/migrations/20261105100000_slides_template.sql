-- =============================================================================
-- The company's look for the photo presentations (the "después" of each display, one
-- slide per visit): a cover background and a slide background, uploaded by an admin.
-- Visitario writes the total, the address, the customer number, the date and the photos
-- on top. The files live in the "slides" bucket, under the company's id.
-- Storage is guarded: the local test database has no storage schema.
-- =============================================================================
alter table public.company
  add column slides_cover_path text check (slides_cover_path is null or char_length(slides_cover_path) < 300),
  add column slides_page_path text check (slides_page_path is null or char_length(slides_page_path) < 300);
grant select (slides_cover_path, slides_page_path) on public.company to authenticated;
grant update (slides_cover_path, slides_page_path) on public.company to authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('slides', 'slides', true, 3145728, array['image/png', 'image/jpeg'])
    on conflict (id) do nothing;
    -- Only the company's admins put or take its backgrounds; anyone may view them (logos, no data).
    execute $p$create policy slides_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'slides' and (storage.foldername(name))[1] in (select c::text from private.companies_with_role('admin') c))$p$;
    execute $p$create policy slides_delete on storage.objects for delete to authenticated
      using (bucket_id = 'slides' and (storage.foldername(name))[1] in (select c::text from private.companies_with_role('admin') c))$p$;
  end if;
end $$;
