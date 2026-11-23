# 21. Pinterest

Comando base: `/pinterest`

## 1. /pinterest buscar

Imagen de CUALQUIER tema (gatos, coches, anime, paisajes...)

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| tema | texto | Sí | — |
| cantidad | número entero | No | — |
| canal | canal | No | — |

## 2. /pinterest tablero

Imagen aleatoria de un tablero público de Pinterest (enlace o nombre guardado)

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| tablero | texto | Sí | — |
| cantidad | número entero | No | — |
| canal | canal | No | — |

## 3. /pinterest pin

Muestra la imagen de un pin (enlace pinterest.com/pin/... o pin.it/...)

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| enlace | texto | Sí | — |
| canal | canal | No | — |

## 4. /pinterest guardar

Guarda un tablero con un nombre corto

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |
| enlace | texto | Sí | — |

## 5. /pinterest quitar

Quita un tablero guardado

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |

## 6. /pinterest lista

Tableros guardados y publicaciones automáticas

Permiso: Ninguno

Sin opciones.

## 7. /pinterest auto

Publica una imagen cada X horas (tablero, nombre guardado o tema)

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |
| fuente | texto | Sí | — |
| horas | número entero | Sí | — |

## 8. /pinterest autoquitar

Quita la publicación automática de un canal

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |
