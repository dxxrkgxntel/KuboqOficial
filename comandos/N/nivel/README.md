# Niveles y XP

Comando base: `/nivel`

## 1. /nivel rank

Ver tu tarjeta de nivel

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | No | — |

## 2. /nivel vista

Vista previa de tu tarjeta, con el texto NUEVO NIVEL

Permiso: `Administrator`

Sin opciones.

## 3. /nivel fondo

Imagen o GIF de fondo de la tarjeta (link https). Escribe "quitar" para quitarlo

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| url | texto | Sí | — |

## 4. /nivel marca

Texto de la tarjeta (ej. Kuboq)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| texto | texto | Sí | — |

## 5. /nivel color

Color de la barra y del acento (ej. #a855f7)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| color | texto | Sí | — |

## 6. /nivel top

Top de niveles

Permiso: Ninguno

Sin opciones.

## 7. /nivel set

Establece el nivel de un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| nivel | número entero | Sí | — |

## 8. /nivel xpadd

Da XP a un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| cantidad | número entero | Sí | — |

## 9. /nivel xpremove

Quita XP a un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| cantidad | número entero | Sí | — |

## 10. /nivel rate

XP medio por mensaje (1-100)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| cantidad | número entero | Sí | — |

## 11. /nivel canal

Canal de avisos de nivel

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 12. /nivel roladd

Rol de recompensa por nivel

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nivel | número entero | Sí | — |
| rol | rol | Sí | — |

## 13. /nivel rolremove

Quita rol de recompensa

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nivel | número entero | Sí | — |

## 14. /nivel roles

Ver roles de recompensa

Permiso: Ninguno

Sin opciones.

## 15. /nivel mensaje

Mensaje/imagen de subida. {user} {level} {server}

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| texto | texto | No | — |
| imagen | texto | No | — |
| titulo | texto | No | — |

## 16. /nivel reset

Reinicia niveles de un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 17. /nivel toggle

Activa/desactiva el sistema de niveles

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| estado | sí/no | Sí | — |

## 18. /nivel textonuevo

Muestra u oculta el texto "NUEVO NIVEL" de la tarjeta al subir de nivel

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| estado | sí/no | Sí | — |
