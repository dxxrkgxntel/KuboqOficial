# Bienvenida

Comando base: `/bienvenida`

## 1. /bienvenida autocanal

Crea los canales #bienvenida y #despedidas y los configura solo

Permiso: `Administrator`

Sin opciones.

## 2. /bienvenida canal

Fija el canal (si no, se elige uno automático)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | Bienvenida, Despedida |
| canal | canal | Sí | — |

## 3. /bienvenida mensaje

Texto del embed. Usa \n para saltos de línea. Ver /bienvenida variables

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | Bienvenida, Despedida |
| texto | texto | Sí | — |

## 4. /bienvenida titulo

Título del embed (ninguno = sin título)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | Bienvenida, Despedida |
| texto | texto | Sí | — |

## 5. /bienvenida embed

Color, imágenes y pie. imagen/miniatura: enlace(s) con |, avatar o servidor

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | Bienvenida, Despedida |
| color | texto | No | — |
| imagen | texto | No | — |
| miniatura | texto | No | — |
| pie | texto | No | — |
| autor | texto | No | — |

## 6. /bienvenida texto

Texto sobre el embed (ej. {user} para mencionar). ninguno = vacío

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | Bienvenida, Despedida |
| texto | texto | Sí | — |

## 7. /bienvenida activar

Activa o desactiva bienvenida/despedida

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | Bienvenida, Despedida |
| estado | sí/no | Sí | — |

## 8. /bienvenida dm

Mensaje privado al nuevo miembro (ninguno = quitar)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| mensaje | texto | Sí | — |

## 9. /bienvenida vista

Previsualiza el mensaje con tu usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | Bienvenida, Despedida |

## 10. /bienvenida ver

Ver la configuración actual

Permiso: `Administrator`

Sin opciones.

## 11. /bienvenida variables

Lista de variables disponibles

Permiso: Ninguno

Sin opciones.

## 12. /bienvenida reset

Restaura bienvenida o despedida a los valores por defecto

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| evento | texto | Sí | Bienvenida, Despedida |
