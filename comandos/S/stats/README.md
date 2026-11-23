# Estadísticas de canales

Comando base: `/stats`

## 1. /stats crear

Crea un canal de estadística (o el paquete básico con "todos")

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| tipo | texto | Sí | Miembros, Personas (sin bots), Bots, Conectados en voz, Canales (total), Canales de texto, Canales de voz, Categorías, Roles, Emojis, Stickers, Boosts, Nivel de boost, Tickets abiertos, Meta (objetivo), Todos (paquete básico) |
| canal | canal | No | — |
| formato | texto | No | — |

## 2. /stats formato

Personaliza el texto. Variables: {count} {goal} {pct} {left} {server}. "restaurar" = por defecto

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| tipo | texto | Sí | Miembros, Personas (sin bots), Bots, Conectados en voz, Canales (total), Canales de texto, Canales de voz, Categorías, Roles, Emojis, Stickers, Boosts, Nivel de boost, Tickets abiertos, Meta (objetivo), Todos (paquete básico) |
| formato | texto | Sí | — |

## 3. /stats meta

Define la meta del canal de meta (qué contar y el objetivo)

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| objetivo | número entero | Sí | — |
| tipo | texto | No | Miembros, Personas (sin bots), Bots, Conectados en voz, Canales (total), Canales de texto, Canales de voz, Categorías, Roles, Emojis, Stickers, Boosts, Nivel de boost, Tickets abiertos, Meta (objetivo), Todos (paquete básico) |

## 4. /stats quitar

Quita una estadística (o todas). borrar:true también elimina el canal

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| tipo | texto | Sí | Miembros, Personas (sin bots), Bots, Conectados en voz, Canales (total), Canales de texto, Canales de voz, Categorías, Roles, Emojis, Stickers, Boosts, Nivel de boost, Tickets abiertos, Meta (objetivo), Todos (paquete básico) |
| borrar | sí/no | No | — |

## 5. /stats lista

Ver las estadísticas configuradas

Permiso: `ManageChannels`

Sin opciones.

## 6. /stats actualizar

Actualiza ahora todos los canales de estadísticas

Permiso: `ManageChannels`

Sin opciones.

## 7. /stats ajustes

Intervalo (5-120 min), abreviar números (1.2k) y categoría donde crear

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| intervalo | número entero | No | — |
| abreviar | sí/no | No | — |
| categoria | canal | No | — |
