-- Initial data for the Panda pilot. Idempotent: safe to run twice.
-- Catalog names and message bodies are user-facing content, so they stay in Spanish.
do $$
declare
  panda uuid;
begin
  select id into panda from public.company where name = 'Panda' and kind = 'distributor';
  if panda is null then
    insert into public.company (name, kind, geocoding_scope) values ('Panda', 'distributor', 'caba') returning id into panda;
  end if;

  insert into public.subscription (company_id, plan, status) values (panda, 'pilot', 'active')
  on conflict (company_id) do nothing;

  insert into public.team (company_id, name, areas) values (panda, 'Norte', 'Belgrano, Paternal, Colegiales')
  on conflict (company_id, name) do nothing;

  insert into public.brand (company_id, name, group_name, sort_order) values
    (panda, 'Campari', 'Grupo Campari', 1), (panda, 'Aperol', 'Grupo Campari', 2),
    (panda, 'Cynar', 'Grupo Campari', 3), (panda, 'Cynar 70', 'Grupo Campari', 4),
    (panda, 'SKYY', 'Grupo Campari', 5)
  on conflict (company_id, name) do nothing;

  insert into public.display_type (company_id, name, sort_order) values
    (panda, 'Puntera', 1), (panda, 'Media puntera', 2), (panda, 'Góndola', 3),
    (panda, 'Isla', 4), (panda, 'Exhibidor de piso', 5), (panda, 'Otra', 9)
  on conflict (company_id, name) do nothing;

  insert into public.work_metric (company_id, name, report_label, sort_order) values
    (panda, 'Unidades repuestas', null, 1),
    (panda, 'Kits de bolsas', 'CUANTOS KIT DE BOLSAS ARME', 2),
    (panda, 'Agrupaciones', 'CUANTAS AGRUPACIONES ARME', 3),
    (panda, 'Punteras activadas', 'CUANTAS PUNTERAS ACTIVE', 4),
    (panda, 'Exhibidores armados', 'CUANTOS EXHIBIDORES ARME', 5)
  on conflict (company_id, name) do nothing;

  -- Placeholders are English keys the app fills in: {date} {address} {store_name}
  -- {customer_number} {area} {task} {notes} {merchandiser} {visited} {not_visited} {added} {metrics}
  insert into public.message_template (company_id, kind, body) values
    (panda, 'before', E'*ACTIVACIÓN DE GONDOLA ANTES\nFecha: {date}\nDireccion: {address}\nNum clte: {customer_number}\nZona: {area}'),
    (panda, 'after', E'*ACTIVACIÓN DE GONDOLA DESPUES\nFecha: {date}\nDireccion: {address}\nNum clte: {customer_number}\nZona: {area}\nObservación: {notes}'),
    (panda, 'daily_report', E'RESUMEN DEL DIA {date}\nCUANTOS CLIENTES VISITE: {visited_count}\n{metrics}\n\nVisitados:\n{visited}\n\nNo visitados:\n{not_visited}\n\nExtras:\n{added}'),
    (panda, 'visit_report', E'{store_name} · {address}\nFecha: {date}\nTarea: {task}\nObservación: {notes}')
  on conflict (company_id, kind) do nothing;
end $$;

select c.name, s.plan,
       (select count(*) from public.team t where t.company_id = c.id) teams,
       (select count(*) from public.brand b where b.company_id = c.id) brands,
       (select count(*) from public.display_type d where d.company_id = c.id) display_types,
       (select count(*) from public.work_metric m where m.company_id = c.id) metrics,
       (select count(*) from public.message_template t where t.company_id = c.id) templates
from public.company c join public.subscription s on s.company_id = c.id
where c.name = 'Panda';
