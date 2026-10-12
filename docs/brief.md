# Brief de producto — Visitario v2

## Qué es
SaaS multi-empresa para que distribuidoras, marcas y agencias coordinen activadores y supervisores de trade marketing en comercios, reemplazando WhatsApp y capturas de Excel. Piloto: Panda (distribuidora de Grupo Campari y SKYY), 1 supervisor + 6 activadores.

## Contexto
- Los comercios son clientes de la empresa; la activación es un servicio sin cargo para que vendan más y vuelvan a pedir.
- Hoy: el supervisor manda una captura de su Excel por WhatsApp entre las 20 y 23 h; un grupo de WhatsApp por activador; mensajes ANTES/DESPUÉS con formato definido por el supervisor; OK por visita; resumen diario.
- Activadores de Gancia, Quilmes, Sernova y Termal trabajan igual.

## Roles e identidad
Activador (celular, en la calle, poca señal) · Supervisor (asigna, revisa, aprueba) · Admin de empresa (usuarios, marcas, exhibiciones, formatos) · Super admin (Visitario). Las marcas no tienen acceso. Todos los roles usan celular y computadora con la misma cuenta.
- Cada persona se identifica por su DNI. Celular, email y fecha de nacimiento se cargan una vez y la acompañan si cambia de empresa.
- La empresa da de alta a la persona buscando por DNI. El activador nunca elige empresa: valida su identidad, da permisos y acepta invitaciones.
- Una empresa no ve el trabajo del activador con otras empresas.
- Modo autónomo: el activador puede usar Visitario sin empresa, con jornadas propias.
- Ingreso con DNI o email y contraseña, o con Google (un usuario nuevo de Google completa su identidad y crea contraseña).

## Alcance v1
Entra: cuentas y roles; alta por DNI; modo autónomo; empresa con equipos; directorio de comercios; asignación manual o importando la planilla de cada empresa con mapeo guardado; carga desde captura con IA (plan pago); el activador agrega direcciones a su jornada y cada visita registra quién la agregó; ficha de visita en una sola pantalla con secciones (llegada, autorización, exhibiciones, trabajo, mensajes); recorrido optimizado; offline con sincronización de fotos; bandeja del supervisor; informe del día; catálogos por empresa; mensajes ANTES/DESPUÉS para WhatsApp como puente.

No entra: importación/exportación de datos para el activador; push y chat; reportes con marca Visitario; exportación Excel/PDF; asignación automática; integraciones ERP; alta autoservicio de empresas; app nativa.

Criterio de éxito: el equipo de Panda trabaja una semana sin WhatsApp para asignar, reportar ni aprobar.

## Reglas
- Dos estados separados. Trabajo: pendiente, en curso, cerrado (reintento posible), no autorizada, terminada. Revisión: sin revisar, aprobada, con corrección.
- Toda visita con resultado (terminada, cerrada, no autorizada) cuenta como visitada.
- Autorización: sí / sí con oposición / no / cerrado.
- Cada exhibición cuenta una vez; indicada o encontrada; acomodada al subir la foto del después.
- Los pendientes pasan a otra jornada conservando comercio, tarea y exhibiciones pendientes.
- Mensajes e informes son plantillas por empresa.

## No funcionales
Offline completo; ninguna foto se borra antes de estar en el servidor; fotos de 100–300 KB; Android gama media e iPhone como PWA, mobile-first; uso con una mano; aislamiento entre empresas; ubicación opcional y solo para el recorrido (nunca en fotos); español rioplatense, hora de Argentina.
