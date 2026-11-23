# 03. Autoroles

Comando base: `/autorole`

## 1. /autorole add

Rol(es) automático(s) al entrar (hasta 2 a la vez)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| rol1 | rol | Sí | — |
| rol2 | rol | No | — |

## 2. /autorole remove

Quita un autorol

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| rol | rol | Sí | — |

## 3. /autorole list

Lista de autoroles y su estado

Permiso: Ninguno

Sin opciones.

## 4. /autorole bot

Rol automático para bots

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| rol | rol | No | — |

## 5. /autorole revisar

Diagnostica por qué un autorol podría no funcionar

Permiso: `Administrator`

Sin opciones.

## 6. /autorole aplicar

Da los autoroles a los miembros actuales que no los tengan

Permiso: `Administrator`

Sin opciones.

## 7. /autorole panel

Panel de roles con botones (hasta 5)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |
| titulo | texto | Sí | — |
| descripcion | texto | Sí | — |
| rol1 | rol | Sí | — |
| rol2 | rol | No | — |
| rol3 | rol | No | — |
| rol4 | rol | No | — |
| rol5 | rol | No | — |
| imagen | texto | No | — |
| color | texto | No | — |
