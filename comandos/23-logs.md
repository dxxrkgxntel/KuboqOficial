# 23. Registros (logs)

Comando base: `/logs`

## 1. /logs canal

Canal de logs. tipo: general/mod/seguridad/verif/tickets/logros/sugerencias/reportes/invitaciones/voz_mover/voz_desconexion/voz_mute/voz_sordo

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| tipo | texto | Sí | — |
| canal | canal | Sí | — |

## 2. /logs voz_crear

Crea 4 canales de logs de voz (mover, desconexión, mute y sordo; solo acciones de staff) y los configura solos

Permiso: `Administrator`

Sin opciones.

## 3. /logs crear

Crea todos los canales de logs por tipo y los configura solos

Permiso: `Administrator`

Sin opciones.

## 4. /logs estado

Ver canales y eventos de logs

Permiso: `Administrator`

Sin opciones.

## 5. /logs toggle

Activa/desactiva eventos: mensajes/miembros/roles/canales/voz/bans/voz_mover/voz_desconexion/voz_mute/voz_sordo

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | — |
