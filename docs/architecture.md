# Arquitectura — Visitario v2

## Stack
- **Frontend:** SPA con Vite + React + TypeScript estricto, TanStack Router y Query, React Hook Form + Zod, Tailwind con los tokens del design system. Sin Next.js: SSR no aporta detrás de un login y complica el modo offline.
- **PWA:** vite-plugin-pwa (Workbox). Datos locales en IndexedDB con Dexie (etapa 2).
- **Backend:** Supabase (Postgres 17, Auth, Edge Functions), región São Paulo. Aislamiento por empresa con Row Level Security; cada tabla de negocio lleva `company_id`.
- **Fotos:** Cloudflare R2 (10 GB gratis, sin egress). Subida directa con URL firmada que emite una Edge Function. Ruta `c/<company_id>/v/<visit_id>/<photo_id>.jpg`. Compresión en el cliente: 1400 px, JPEG 72 %.
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
Cola propia: la jornada se descarga a IndexedDB; todo se escribe local primero y entra en una cola de cambios con id único (reenvío idempotente); cola separada de fotos que solo se liberan tras confirmar la subida a R2. Conflictos: un dueño por visita a la vez; el servidor sella `updated_at` y `version`; se baja todo lo cambiado desde el último cursor con un margen de 5 s.

## Ubicación
Opcional y solo para armar el recorrido. No se guarda en fotos ni al marcar llegada. Nunca en segundo plano.

## Repo
`CLAUDE.md` con reglas; `docs/`; `src/app`, `src/routes`, `src/features`, `src/domain` (reglas puras con tests), `src/ui`, `src/lib`; `supabase/migrations`, `supabase/functions`, `supabase/tests`; `e2e/`.
