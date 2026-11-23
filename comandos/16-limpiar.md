# 16. Limpieza

Comando base: `/limpiar`

## 1. /limpiar mensajes

Borra mensajes recientes del canal (hasta 1000)

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| cantidad | número entero | Sí | — |
| usuario | usuario | No | — |
| filtro | texto | No | Todos los mensajes, Solo de bots, Solo de personas, Con enlaces, Con archivos, Con embeds |
| contiene | texto | No | — |
| canal | canal | No | — |

## 2. /limpiar desde

Borra todo lo posterior a un mensaje (ID o enlace del mensaje)

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| mensaje | texto | Sí | — |
| canal | canal | No | — |

## 3. /limpiar canal

Reinicia el canal: lo recrea vacío (borra TODO, pide confirmación)

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 4. /limpiar auto

Limpieza automática de un canal cada X horas

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |
| horas | número entero | Sí | — |
| modo | texto | No | Borrar mensajes recientes (conserva el canal), Reiniciar el canal (borra TODO) |

## 5. /limpiar autoquitar

Quita la limpieza automática de un canal

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |

## 6. /limpiar autolista

Lista las limpiezas automáticas

Permiso: `ManageGuild`

Sin opciones.
