# Arquitectura — Visitario v2

## Stack
- **Frontend:** SPA con Vite + React + TypeScript estricto, TanStack Router y Query, React Hook Form + Zod, Sass con CSS Modules: cada componente o página es una carpeta con su `.module.scss`; tokens, mixins y breakpoints en `src/styles/abstracts`. Sin Next.js: SSR no aporta detrás de un login y complica el modo offline.
- **PWA:** vite-plugin-pwa (Workbox). Datos locales en IndexedDB con Dexie (etapa 2).
- **Backend:** Supabase (Postgres 17, Auth, Edge Functions), región São Paulo. Aislamiento por empresa con Row Level Security; cada tabla de negocio lleva `company_id`.
- **Fotos:** Cloudflare R2 (10 GB gratis, sin egress). Subida a través de la Edge Function `photos`, que guarda la fila con el token de la persona (RLS) y recién después marca la foto como subida; para verlas emite URLs firmadas de 1 h. Así el bucket no necesita CORS. Ruta `c/<company_id>/v/<visit_id>/<photo_id>.jpg`. Compresión en el cliente: 1400 px, JPEG 72 %, sin metadatos (sin ubicación).
- **Geocodificación y rutas:** LocationIQ desde Edge Functions; ruteo en el cliente (TSP exacto hasta 11 paradas, greedy + 2-opt arriba).
- **IA de capturas:** Gemini Flash en plan pago, detrás de una Edge Function con salida validada por Zod. Solo para empresas con plan pago.
- **Hosting:** Cloudflare Pages. **CI:** GitHub Actions.
- **Costo:** solo planes gratuitos con posibilidad de crecer pagando.

## Celular y escritorio
Los cuatro roles usan la misma app en celular y computadora. En celular: barra inferior y avatar arriba para el perfil. En escritorio: menú lateral con el perfil al pie. El perfil es el mismo para todos los roles. En escritorio las fotos se pueden subir desde archivos.

## Autenticación
- Email + contraseña y Google con Supabase Auth.
- Ingreso con DNI: la Edge Function `sign-in-with-dni` resuelve el email del DNI del lado del servidor y devuelve la sesión; ante cualquier error responde lo mismo, así no revela si el DNI existe.
- Onboarding: `complete_identity` crea la persona o reclama la que creó una empresa al invitar (exige el celular verificado igual al cargado).

## Sincronización sin señal (etapa 2)
- **Copia local** (Dexie/IndexedDB, `src/features/sync/db.ts`): la caché de pantallas (jornada, visitas, catálogos, perfil) se guarda y se restaura antes del primer guard de ruta, así la app abre sin señal. Se borra al cerrar sesión.
- **Cola única** (`outbox.ts`): cada cambio de la visita se escribe local primero y se envía en orden, de a uno (la foto de fachada siempre llega antes que el cierre). Reintentos con espera creciente y al volver la señal; un 4xx queda como fallido para reintentar o descartar. Fotos en la misma cola, con el archivo ya comprimido.
- **Idempotencia** (`ops.ts`): ids generados en el celular, upserts con `ignoreDuplicates` y borrados lógicos con `deleted_at is null`; reenviar no duplica.
- **Vista optimista** (`overlay.ts`): lo que se ve = servidor + cola, con las mismas reglas de la base (fachada → en curso; sin fachada → pendiente).
- **Necesitan señal**: abrir jornada, agregar direcciones y retomar (búsqueda y geocodificación).
- Pendiente: bajar solo lo cambiado desde un cursor (hoy se refresca la jornada completa al sincronizar).

## Ubicación
Opcional y solo para armar el recorrido. No se guarda en fotos ni al marcar llegada. Nunca en segundo plano.

## Repo
`CLAUDE.md` con reglas; `docs/`; `src/app`, `src/routes`, `src/features/<feature>/pages` y `components`, `src/domain` (reglas puras con tests), `src/ui` (primitivas), `src/styles` (abstracts y base), `src/lib`; `supabase/migrations`, `supabase/functions`, `supabase/tests`; `e2e/`.
