# Paneles de roles (rolpanel)

Comando base: `/rolpanel`

## 1. /rolpanel crear

Crea un panel de roles (banner, título y descripción) en un canal

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |
| titulo | texto | Sí | — |
| descripcion | texto | Sí | — |
| banner | texto | No | — |
| color | texto | No | — |

## 2. /rolpanel boton_add

Añade un botón (rol) a un panel

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| panel | texto | Sí | — |
| nombre | texto | Sí | — |
| rol | rol | Sí | — |
| emoji | texto | No | — |

## 3. /rolpanel boton_edit

Cambia nombre, rol o emoji de un botón (emoji "quitar" lo elimina)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| panel | texto | Sí | — |
| boton | texto | Sí | — |
| nombre | texto | No | — |
| emoji | texto | No | — |
| rol | rol | No | — |

## 4. /rolpanel boton_del

Quita un botón de un panel

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| panel | texto | Sí | — |
| boton | texto | Sí | — |

## 5. /rolpanel editar

Cambia título, descripción, banner, color, pie o modo de un panel

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| panel | texto | Sí | — |
| titulo | texto | No | — |
| descripcion | texto | No | — |
| banner | texto | No | — |
| color | texto | No | — |
| pie | texto | No | — |
| exclusivo | sí/no | No | — |

## 6. /rolpanel borrar

Borra un panel y su mensaje (los roles dados no se quitan)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| panel | texto | Sí | — |

## 7. /rolpanel lista

Lista los paneles de roles y sus botones

Permiso: `Administrator`

Sin opciones.
