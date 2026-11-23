# Logros

Comando base: `/logro`

## 1. /logro logros

Ver tus logros con progreso y puntos

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | No | — |

## 2. /logro servidor

Lista de todos los logros del servidor y qué % los tiene

Permiso: Ninguno

Sin opciones.

## 3. /logro top

Ranking de puntos de logros

Permiso: Ninguno

Sin opciones.

## 4. /logro crear

Crea un logro (el tipo incluye voz, cámara, micro, stream y días)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |
| descripcion | texto | Sí | — |
| tipo | texto | Sí | Mensajes enviados, Nivel, Monedas, Invitaciones, Minutos en voz, Minutos con micrófono encendido, Veces que enciende el micrófono, Minutos con cámara, Veces que enciende la cámara, Minutos transmitiendo, Veces que transmite, Días en el servidor, Antigüedad de la cuenta (días) |
| valor | número entero | Sí | — |
| emoji | texto | No | — |
| rareza | texto | No | Común, Poco común, Raro, Épico, Legendario |
| puntos | número entero | No | — |
| icono | texto | No | Reloj, Cámara, Micrófono, Pantalla, Calendario, Chat, Estrella, Moneda, Sobre, Trofeo |
| forma | texto | No | Escudo, Hexágono, Círculo |
| imagen | texto | No | — |

## 5. /logro eliminar

Elimina un logro por ID

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| id | texto | Sí | — |

## 6. /logro dar

Da un logro a un usuario (se anuncia con la tarjeta)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| id | texto | Sí | — |

## 7. /logro probar

Vista previa de la tarjeta de un logro (no lo da a nadie)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| id | texto | Sí | — |

## 8. /logro quitar

Quita un logro a un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| id | texto | Sí | — |

## 9. /logro canal

Canal de anuncios de logros

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 10. /logro imagen

Imagen de respaldo si no se puede dibujar la tarjeta

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| url | texto | Sí | — |

## 11. /logro toggle

Activa/desactiva logros

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| estado | sí/no | Sí | — |
