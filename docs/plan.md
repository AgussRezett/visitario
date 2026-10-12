# Plan de construcción — Visitario v2

7 etapas; con 0 a 3 arranca el piloto en Panda. Cada etapa es una rama y un PR, con alcance, pantallas de referencia (códigos de los wireframes) y criterios de aceptación. Detalle completo en el documento vivo (ver `docs/README.md`).

**Definición de terminado:** lint, tipos y tests en verde en CI; RLS + test de aislamiento en cada tabla nueva; reglas en `src/domain` con tests; e2e Playwright en 390 y 1440 px; fiel a wireframes y tokens; estilo y lógica en commits separados; probado en un celular real.

| Etapa | Objetivo | Pantallas | Habilita |
| --- | --- | --- | --- |
| 0 · Base | Repo, base multiempresa, ingreso con DNI, email y Google, onboarding, autónomo, perfil, navegación por rol | A01, A02, AD01, AD02, A17, P01, P02 | Cualquiera entra y ve su perfil |
| 1 · Día del activador | Jornada, agregar dirección, retomar, ficha de visita, fotos a R2, informe, con conexión | A03–A05, A09–A11, A15, A16, AD03–AD06, AD09, AD10, AD12, AD13 | Agus trabaja un día real |
| 2 · Sin señal | Dexie, colas idempotentes de cambios y fotos, indicador de sync | A06, AD07 | Uso en la calle |
| 3 · Supervisor | Asignar a mano, tablero, revisión y corrección | S01–S03, S09, SM01–SM03, A14, AD11 | Piloto en Panda |
| 4 · Importar | Excel/CSV con mapeo guardado, pegar texto, revisión | S04, S05, SM04, SM05 | Martín deja de tipear |
| 5 · Admin | Usuarios y alta por DNI, catálogos, plantillas, empresa y plan, directorio | D01–D04, D06, DM01–DM05, S06, S07, SM06, SM07 | Panda se administra sola |
| 6 · Extras | Recorrido, informes del equipo, super admin, captura con IA | A07, A08, AD08, S08, SM08, D05, DM06 | Venta a otras empresas |

## Etapa 0 · criterios de aceptación
- [x] Un DNI no se puede registrar dos veces.
- [x] Una persona invitada completa su identidad y acepta la invitación desde su perfil.
- [x] Un usuario nuevo de Google completa su identidad y crea su contraseña.
- [x] Con dos empresas, ningún usuario ve filas de la otra (test de RLS).
- [x] La empresa no ve los datos de la persona en otras empresas.
- [x] El perfil funciona igual en 390 px y en 1440 px.
- [ ] La app se instala como PWA en Android y en iPhone (probar en dispositivos reales).

Fuera de esta versión: migración del MVP, exportar informes, reportes con diseño, push, cobro automático, acceso para marcas.
