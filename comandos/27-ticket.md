# 27. Tickets

Comando base: `/ticket`

## 1. /ticket setup

Categoría por defecto, rol de soporte (cierra/gestiona tickets) y canal de logs

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| categoria | canal | No | — |
| rol | rol | No | — |
| logs | canal | No | — |

## 2. /ticket embed

Personaliza el panel: título, descripción, color, banner (arriba), imagen (abajo), miniatura, pie

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| titulo | texto | No | — |
| descripcion | texto | No | — |
| color | texto | No | — |
| banner | texto | No | — |
| imagen | texto | No | — |
| miniatura | texto | No | — |
| pie | texto | No | — |
| boton | texto | No | — |
| menu | texto | No | — |
| bienvenida | texto | No | — |

## 3. /ticket tipo

Crea o edita un tipo de ticket (con su categoría, rol de soporte y bienvenida)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |
| categoria | canal | No | — |
| rol | rol | No | — |
| emoji | texto | No | — |
| descripcion | texto | No | — |
| bienvenida | texto | No | — |

## 4. /ticket tipoquitar

Elimina un tipo de ticket

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |

## 5. /ticket tipos

Lista los tipos de ticket

Permiso: `Administrator`

Sin opciones.

## 6. /ticket panel

Publica el panel (menú desplegable si hay tipos; si no, botón)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |
| modo | texto | No | Menú desplegable, Botón |

## 7. /ticket add

Añade un usuario al ticket (solo staff)

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 8. /ticket remove

Quita un usuario del ticket (solo staff)

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 9. /ticket close

Cierra el ticket (solo administradores o soporte)

Permiso: Ninguno

Sin opciones.

## 10. /ticket rename

Renombra el ticket (solo staff)

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |

## 11. /ticket claim

Reclama el ticket (solo staff)

Permiso: Ninguno

Sin opciones.

## 12. /ticket transcript

Genera la transcripción (solo staff)

Permiso: Ninguno

Sin opciones.

## 13. /ticket limite

Máximo de tickets por usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| cantidad | número entero | Sí | — |
