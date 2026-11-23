# Confesiones

Comando base: `/confesion`

## 1. /confesion setup

Configura el canal de confesiones y publica el panel automáticamente

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |
| reportes | canal | No | — |

## 2. /confesion panel

Vuelve a publicar el panel con el botón de confesar

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 3. /confesion enviar

Envía una confesión anónima

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| texto | texto | Sí | — |

## 4. /confesion guardar

Guardar o no el autor (para moderar abusos)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| estado | sí/no | Sí | — |

## 5. /confesion autor

Revela el autor de una confesión (solo admins, queda en logs)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| numero | número entero | Sí | — |

## 6. /confesion borrar

Borra una confesión publicada

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| numero | número entero | Sí | — |

## 7. /confesion bloquear

Impide que un usuario envíe confesiones

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 8. /confesion desbloquear

Permite de nuevo confesar a un usuario

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 9. /confesion estado

Ver la configuración de confesiones

Permiso: `ManageGuild`

Sin opciones.

## 10. /confesiones

Publica el panel de confesiones anónimas y lo configura solo

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |
| imagen | texto | No | — |
| nombre | texto | No | — |
| reportes | canal | No | — |
