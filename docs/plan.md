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

## Etapa 1 · criterios de aceptación
- [x] Agus abre una jornada propia, agrega 5 direcciones y las ve en orden (e2e).
- [x] Una visita no se puede terminar sin foto de fachada y autorización (base de datos + e2e).
- [x] Cargar el después de una exhibición la marca como acomodada (derivado de la foto).
- [x] Terminar con exhibiciones sin acomodar avisa y las deja para retomar.
- [x] Cerrado y no autorizada cuentan como visitada en el informe (test de dominio).
- [x] El texto del informe coincide con el formato de WhatsApp (test de dominio).
- [x] Una foto de 4 MB llega en menos de 400 KB (e2e).
- [x] Ninguna foto guarda ubicación: se re-codifica sin metadatos (e2e).
- [ ] Probado con fotos reales en R2 y en un celular real (falta cargar las claves de R2).

## Etapa 2 · criterios de aceptación
- [x] Sin señal se marca la llegada, se cargan fotos, autorización, exhibiciones, trabajo y se termina la visita (e2e).
- [x] Al volver la señal todo llega al servidor en orden: la foto de fachada antes que el cierre de la visita (e2e).
- [x] Los cambios pendientes sobreviven a cerrar la app y salen al volver a abrirla (e2e).
- [x] Reenviar un cambio no duplica nada: ids del celular y upserts (test contra PostgREST real).
- [x] Un cambio rechazado por el servidor queda marcado y se puede reintentar o descartar (e2e).
- [x] El indicador muestra sin señal, enviando, sin guardar y todo guardado (A06 / AD07).
- [x] Abrir jornada, agregar direcciones y retomar avisan que necesitan señal.
- [ ] Probado en la calle con un celular real (modo avión a mitad de una visita).

## Etapa 3 · criterios de aceptación
- [x] El supervisor arma la jornada de cada activador sin publicar, la publica y el activador la ve al abrir la app (base + e2e).
- [x] El activador puede agregar direcciones a una jornada asignada y el supervisor ve que las agregó él (base).
- [x] Pedir corrección sin comentario no se permite (base + dominio + e2e).
- [x] Una corrección reenviada vuelve a la bandeja del supervisor (base + e2e).
- [x] Un supervisor no ve activadores de otro equipo: tablero, pendientes, sincronización y conversación (test de RLS).
- [x] Tablero con avance, última actividad, sincronización de cada celular y alertas (sin actividad, fotos sin subir, correcciones).
- [x] El activador ve el aviso de corrección, responde y reenvía, también sin señal (e2e).
- [ ] Revisar 15 visitas desde el celular lleva menos de 10 minutos (prueba con Martín).

## Etapa 4 · criterios de aceptación
- [x] Una planilla de 78 filas se importa en menos de 2 minutos, mapeo incluido (e2e con una planilla armada como la de Panda).
- [ ] Lo mismo con la planilla real de Panda (falta conseguirla).
- [x] La segunda planilla con las mismas columnas no pide mapeo: el formato guardado la reconoce y va directo a la revisión (e2e).
- [x] Un comercio ya cargado se reconoce por número de cliente aunque la dirección venga distinta (base + API + e2e).
- [x] Descartar la importación no deja nada creado; si una fila falla al guardar, no se guarda ninguna (base + e2e).
- [x] Nombres aproximados en la columna de activador ("Agus", "Nico F.") se reconocen o se confirman una vez y quedan en el formato (dominio + e2e).
- [x] Pegar texto: una dirección por línea, o columnas copiadas del Excel (dominio + e2e).
- [x] Las filas sin ubicación exacta se guardan igual y quedan para verificar (base + e2e).

Cómo quedó: Asignar → "Importar planilla" (.xlsx o .csv, o texto pegado) → columnas → revisión. Todo se agrega a borradores de cada activador para esa fecha y se publica desde Asignar, como siempre. La búsqueda en el directorio (`match_stores`) no crea nada; `import_workdays` guarda comercios, jornadas, visitas y el formato en una sola transacción. Las direcciones nuevas se ubican de a una (LocationIQ permite unas 2 por segundo); si se agrega antes de que terminen, esas quedan sin ubicar.

## Etapa 5 · criterios de aceptación
- [x] Dar de alta a alguien que ya usa Visitario no le pide datos de nuevo, y la empresa no ve su historial con otras empresas (base + e2e).
- [x] Cambiar el texto de una plantilla cambia los mensajes desde la próxima visita; los ya enviados quedan como estaban (dominio + e2e).
- [x] Desactivar un número de trabajo lo saca de la ficha y del informe; los ítems no se borran (base + e2e).
- [x] Fusionar dos comercios conserva todas sus visitas, también las aprobadas (base + e2e).
- [x] La facturación se muestra aunque el cobro todavía sea manual (e2e).
- [ ] Probado en el celular real.

Cómo quedó: Usuarios y equipos (alta por DNI; la invitación se manda por WhatsApp porque todavía no hay SMS), Catálogos (con formatos de carga guardados), Plantillas (datos en castellano, vista previa con una visita real, las líneas con datos vacíos no salen, interruptor de WhatsApp), Empresa y plan (uso, facturación, búsqueda de direcciones, retención de fotos, exportar a CSV) y Directorio (para supervisores y admins: búsqueda, filtros, ficha con historial, verificar dirección, editar, fusionar). Quedan para después: logo de la empresa, captura con IA, "pedir antes y después" y "pisos y frentes" en la ficha, alta manual de comercios desde el directorio.

## Etapa 6 · criterios de aceptación
Cada punto sale en su propio PR.

**Recorrido**
- [x] El recorrido de 14 locales se calcula en menos de 3 segundos en el celular (dominio: exacto hasta 11 locales, vecino más cercano + 2-opt arriba; e2e < 3 s).
- [x] Sin permiso de ubicación, el recorrido arranca desde el primer local (dominio + e2e).
- [x] Aplicar el orden reordena la jornada, también sin señal; las visitas terminadas o aprobadas no se mueven (dominio + e2e).
- [ ] Probado en el celular real.

Cómo quedó: Recorrido (auto o a pie, ubicación opcional que no se guarda, primer y último local —un local cerrado va último por defecto—, locales a incluir). El orden se calcula en el celular en línea recta y, si hay señal y `LOCATIONIQ_KEY`, se reemplaza por el orden por calles con km y minutos (función `route`). Google Maps en tramos de 3 paradas intermedias en el celular y completo en la computadora. En la computadora se ve un croquis del recorrido sin mapa de fondo.

**Informes del equipo**
- [x] Tabla por activador (visitados, no visitados, extras, no autorizadas, cada número de trabajo y revisión) con los totales del equipo (dominio + e2e).
- [x] El informe de cada activador es el mismo que manda él, con la plantilla de la empresa; se copia o se comparte (dominio + e2e).
- [x] "Copiar informe del equipo" junta todos, cada uno bajo su nombre (dominio + e2e).

Cómo quedó: sección Informes del supervisor (también en la barra del celular), con fecha elegible. Solo aparecen quienes tienen visitas ese día. Excel/PDF y reportes con diseño quedan como "próximamente".

**Captura con IA**
- [x] En Importar, "Desde una captura": la foto o captura del Excel o del mensaje se lee con Claude y va directo a la revisión, repartida por activador (dominio + e2e).
- [x] Solo supervisores y administradores, de planes piloto o pagos, con un tope de capturas por mes; cada una suma al uso de la empresa (base).
- [ ] La IA acierta al menos 9 de cada 10 direcciones en 10 capturas reales (pendiente: las capturas).
 migración del MVP, exportar informes, reportes con diseño, push, cobro automático, acceso para marcas.