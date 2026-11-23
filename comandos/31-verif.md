# 31. Verificación

Comando base: `/verif`

## 1. /verif setup

Configura canal, rol y modo (boton|codigo|captcha)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |
| rol | rol | Sí | — |
| modo | texto | No | Botón (instantáneo), Código (modal), Captcha (operación matemática) |

## 2. /verif embed

Personaliza el panel: título, descripción, color, banner (arriba), imagen (abajo), miniatura, pie, botón

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

## 3. /verif boton

Personaliza el botón: texto, color (gris/verde/rojo/azul) e icono (emoji o foto)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| texto | texto | No | — |
| estilo | texto | No | Gris (transparente), Verde, Rojo, Azul |
| emoji | texto | No | — |
| foto | texto | No | — |
| nombrefoto | texto | No | — |

## 4. /verif panel

Envía el panel de verificación

Permiso: `Administrator`

Sin opciones.

## 5. /verif logs

Canal de logs de verificación

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |

## 6. /verif estado

Ver configuración de verificación

Permiso: `Administrator`

Sin opciones.

## 7. /verif manual

Verifica manualmente a un usuario

Permiso: `ManageRoles`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 8. /verif quitar

Quita la verificación a un usuario

Permiso: `ManageRoles`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 9. /verif desactivar

Desactiva el sistema de verificación

Permiso: `Administrator`

Sin opciones.
