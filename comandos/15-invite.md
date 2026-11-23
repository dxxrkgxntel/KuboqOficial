# 15. Invitaciones

Comando base: `/invite`

## 1. /invite invites

Ver invitaciones

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | No | — |

## 2. /invite top

Top de invitadores

Permiso: Ninguno

Sin opciones.

## 3. /invite quien

Quién invitó a un usuario

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 4. /invite invitados

Lista de personas que invitó un usuario

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | No | — |

## 5. /invite config

Bienvenida simple antigua (recomendado: /bienvenida)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |
| mensaje | texto | No | — |
| salida | texto | No | — |

## 6. /invite embed

Embed de la bienvenida simple antigua

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| titulo | texto | No | — |
| color | texto | No | — |
| imagen | texto | No | — |

## 7. /invite ajustes

Días para cuentas falsas, reingresos y quitar roles al bajar

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| fakedias | número entero | No | — |
| reingreso | sí/no | No | — |
| quitar | sí/no | No | — |

## 8. /invite logs

Canal de logs de invitaciones (sin canal = log general)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 9. /invite logevento

Activa/desactiva un tipo de log de invitaciones

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| suceso | texto | Sí | Entrada de miembro, Salida de miembro, Invitación creada, Invitación eliminada/agotada, Recompensa de rol, Ajuste de admin |
| estado | sí/no | Sí | — |

## 10. /invite logmsg

Personaliza el embed de un log. Ver /invite variables

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| suceso | texto | Sí | Entrada de miembro, Salida de miembro, Invitación creada, Invitación eliminada/agotada, Recompensa de rol, Ajuste de admin |
| titulo | texto | No | — |
| descripcion | texto | No | — |
| color | texto | No | — |
| restaurar | sí/no | No | — |

## 11. /invite vista

Previsualiza un log de invitaciones

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| suceso | texto | Sí | Entrada de miembro, Salida de miembro, Invitación creada, Invitación eliminada/agotada, Recompensa de rol, Ajuste de admin |

## 12. /invite variables

Variables para personalizar los logs

Permiso: Ninguno

Sin opciones.

## 13. /invite ver

Ver la configuración de invitaciones

Permiso: `Administrator`

Sin opciones.

## 14. /invite revisar

Diagnóstico del sistema de invitaciones

Permiso: `Administrator`

Sin opciones.

## 15. /invite reset

Reinicia invitaciones de un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 16. /invite bonus

Da invitaciones bonus (negativo para quitar)

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| cantidad | número entero | Sí | — |

## 17. /invite rewardadd

Rol al alcanzar N invitaciones

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| invitaciones | número entero | Sí | — |
| rol | rol | Sí | — |

## 18. /invite rewardremove

Quita recompensa de invitaciones

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| invitaciones | número entero | Sí | — |

## 19. /invite rewardaplicar

Aplica las recompensas a quienes ya cumplen el mínimo

Permiso: `Administrator`

Sin opciones.
