# Esquema de base de datos — Visitario v2

Proyecto Supabase `visitario` (ref `mjpzawlyjjlmluozjwap`, São Paulo, Postgres 17). Migraciones, datos iniciales, tests y Edge Functions en `supabase/` (ver `supabase/README.md`).

## Regla de idioma
Tablas, columnas, enums, funciones y mensajes de error en inglés. Catálogos, plantillas y textos de la interfaz en español.

## Tablas (concepto → nombre)
Persona `person` · datos privados `person_private` · super admin `platform_admin` · empresa `company` · suscripción `subscription` · equipo `team` · membresía `membership` · marca `brand` · tipo de exhibición `display_type` · canal `channel` · vendedor `seller` · operativo `operation` · integrante `operation_member` · número de trabajo `work_metric` · plantilla `message_template` · formato de carga `import_format` · comercio `store` · jornada `workday` · recorrido guardado `route_plan` · visita `visit` · exhibición `display` · foto `photo` · trabajo de la visita `visit_metric` · marcas de la visita `visit_brand` · comentario `comment` · historial `visit_event` · acceso de soporte `support_access` · búsqueda por DNI `dni_lookup` · uso de IA `ai_usage`.

Enums: `role` (merchandiser, seller, supervisor, admin) · `work_status` (pending, in_progress, done, refused, closed) · `review_status` (unreviewed, approved, needs_fix) · `consent_kind` (yes, with_objection, refused, closed) · `photo_kind` (storefront, before, after) · `visit_source` (assigned, added) · `workday_status` (draft, published, closed).

## Principios
- Todo pertenece a una empresa (`company_id` + RLS forzado en 24 tablas, 55 políticas). Autónomo = `company.kind = 'personal'`.
- Claves foráneas compuestas `(company_id, id)`: imposible cruzar empresas, incluso con service_role.
- La base valida permisos, transiciones y quién cambia qué (triggers): el activador no aprueba; el supervisor no carga fotos ni trabajo; una visita aprobada se bloquea; pedir corrección exige comentario.
- DNI, nacimiento y celular en `person_private`, solo para su dueño. Búsqueda por DNI solo con `find_person_by_dni` (admin, 30 por hora, registrada con hash).
- UUID v7 generados en el teléfono para lo que nace sin señal; catálogos con ids enteros.
- Desnormalizado solo: `company_id` en hijos; `merchandiser_id` y `work_date` en `visit` (por trigger). Acomodada (`display_status.arranged`), totales (`daily_progress`, `daily_metrics`) e historial se derivan.

## Canales y vendedores
Cada comercio tiene un canal (`store.channel_id`, catálogo `channel`, su número es `sort_order`) y un vendedor (`store.seller_id`). Un vendedor es un nombre que carga el admin; cuando alguien entra a la empresa con el rol `seller` se le une por nombre (trigger `link_seller`) o se crea. `tag_store` los asigna (supervisor y admin cambian; quien agrega un comercio solo completa los vacíos). `seller_stores` le muestra a un vendedor sus clientes con la última activación. Plantillas: `{canal}`, `{vendedor}` (o `{responsable}`), `{fecha_corta}`, `{por_canal}`; en mayúsculas (`{CANAL}`) el dato sale en mayúsculas.

## Operativos
Un operativo es la jornada de quien lo arma, compartida (`operation.workday_id`). Cada integrante (`operation_member`) conserva su propia jornada y trabaja las visitas del operativo como propias (`visit_role` = merchandiser mientras no salió); el supervisor de cualquier integrante lo ve y revisa. Lo hecho cuenta en el día de cada integrante (`daily_progress`, `daily_metrics`, `team_day`); en los totales del equipo una visita compartida cuenta una vez (`day_operations` trae sus números). Presencia y ubicación viajan solo por el canal privado de Realtime `operation:<id>`: nunca se guardan.

## Recorrido guardado
El último recorrido calculado de cada jornada (`route_plan`, uno por `workday_id`): orden, km, minutos y la línea por calles. Lo guarda solo el activador dueño de la jornada con `save_route_plan`; lo leen él, su supervisor y el admin. Nunca guarda la ubicación: si se calculó desde el teléfono, la línea arranca en el primer local y solo queda `from_origin`.

## Tiempo real
Supabase Realtime publica visit, photo, display, workday, comment, operation y operation_member; cada persona recibe solo lo que su RLS le deja leer. La app escucha por empresa y recarga lo que está en pantalla; al volver de segundo plano recarga igual.

## Transiciones de trabajo
pending → in_progress | closed | refused · in_progress → done | refused | closed | pending · closed → in_progress · done → in_progress.

## Cierre de una visita
Terminar (terminada, no autorizada o cerrado) exige la foto de fachada; terminada exige además autorización (sí o con oposición). Lo valida el trigger `guard_finish`.

## RPC y vistas
`complete_identity`, `create_personal_company`, `find_person_by_dni`, `invite_person`, `respond_invitation`, `resume_visit` (agrega al final del día), `has_password`, `open_workday`, `add_visit`, `search_stores`, `resumable_visits`, `day_overlaps` (antes de sumar un local a una jornada: quién más lo tiene ese día en la empresa, por comercio, nro. de cliente o dirección; security definer que devuelve solo nombres y estado, y los borradores solo a supervisores y admins), `take_acceptance_notices` (solo service role: la función `invitation` toma una vez cada invitación aceptada, marca `invitation.accept_notified_at` y avisa por mail a quien invitó o, si no tiene email, a los admins activos de la empresa). Vistas con `security_invoker`: `display_status`, `daily_progress`, `daily_metrics`.

## Rendimiento y sync
Helpers en el schema `private` (security definer, `search_path` vacío); `visible_merchandisers()` se ejecuta una vez por consulta. Índices por pantalla. ~40 MB por año para Panda; fotos ~22 GB por año en R2. Sync: `updated_at`/`version` por trigger, borrado lógico (`deleted_at`) con purga a 30 días.

## Abierto
Supervisor de varios equipos, permisos en el JWT si escala, alcance del super admin en soporte, retención por defecto, SMS para verificar el celular.
