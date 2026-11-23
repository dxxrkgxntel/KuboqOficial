# 01. Anuncios

Comando base: `/anuncio`

## 1. /anuncio anunciar

Envía un anuncio con embed

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |
| titulo | texto | Sí | — |
| descripcion | texto | Sí | — |
| color | texto | No | — |
| imagen | texto | No | — |
| miniatura | texto | No | — |
| mencion | rol | No | — |
| everyone | sí/no | No | — |

## 2. /anuncio embed

Envía un embed personalizado

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| descripcion | texto | Sí | — |
| canal | canal | No | — |
| titulo | texto | No | — |
| color | texto | No | — |
| imagen | texto | No | — |
| miniatura | texto | No | — |
| autor | texto | No | — |
| pie | texto | No | — |

## 3. /anuncio say

El bot dice un mensaje

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| texto | texto | Sí | — |
| canal | canal | No | — |

## 4. /anuncio encuesta

Crea una encuesta (hasta 4 opciones)

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| pregunta | texto | Sí | — |
| op1 | texto | Sí | — |
| op2 | texto | Sí | — |
| op3 | texto | No | — |
| op4 | texto | No | — |

## 5. /anuncio sorteo

Crea un sorteo

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| premio | texto | Sí | — |
| minutos | número entero | Sí | — |
| ganadores | número entero | No | — |

## 6. /anuncio recordatorio

Te recuerda algo (minutos)

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| minutos | número entero | Sí | — |
| texto | texto | Sí | — |
