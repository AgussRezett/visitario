# Visitario

Jornadas, visitas y activaciones de góndola para distribuidoras, marcas y agencias. Reemplaza el Excel por WhatsApp: el supervisor asigna, el activador registra cada visita desde el celular (también sin señal) y el supervisor revisa y aprueba.

## Empezar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Requiere Node 22. La app usa el proyecto de Supabase `visitario`; las claves públicas están en `.env.example`.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | App en modo desarrollo |
| `npm run lint` · `npm run typecheck` · `npm test` | Calidad y tests unitarios |
| `npm run test:db` | Corre las migraciones en Postgres (PGlite) y verifica permisos por rol |
| `npm run test:e2e` | Playwright en 390 y 1440 px |
| `npm run build` | Build de producción con PWA |
| `npm run db:types` | Regenera los tipos de la base (requiere Supabase CLI) |

## Despliegue

- **App**: Vercel publica `main` en cada push y cada PR en una URL de prueba (`vercel.json`). Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (públicas).
- **Base y Edge Functions**: Supabase (ver `supabase/README.md`). Las fotos van a Cloudflare R2 a través de la función `photos`.
- En Supabase → Authentication → URL Configuration, la URL de Vercel tiene que estar como Site URL y en Redirect URLs.

## Documentación

- `CLAUDE.md`: reglas del repo (código en inglés, interfaz en español).
- `docs/`: brief, arquitectura, plan por etapas y esquema de base.
- `supabase/README.md`: migraciones, datos iniciales y Edge Functions.

:)