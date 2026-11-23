# 18. Moderación

Comando base: `/mod`

## 1. /mod ban

Banea a un usuario

Permiso: `BanMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| razon | texto | No | — |
| dias | número entero | No | — |

## 2. /mod unban

Desbanea por ID

Permiso: `BanMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| id | texto | Sí | — |
| razon | texto | No | — |

## 3. /mod kick

Expulsa a un usuario

Permiso: `KickMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| razon | texto | No | — |

## 4. /mod softban

Ban + unban para borrar mensajes

Permiso: `BanMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| razon | texto | No | — |

## 5. /mod timeout

Aísla temporalmente a un usuario

Permiso: `ModerateMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| minutos | número entero | Sí | — |
| razon | texto | No | — |

## 6. /mod untimeout

Quita el aislamiento

Permiso: `ModerateMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 7. /mod warn

Advierte a un usuario

Permiso: `ModerateMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| razon | texto | Sí | — |

## 8. /mod warns

Ver advertencias de un usuario

Permiso: `ModerateMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 9. /mod delwarn

Elimina una advertencia

Permiso: `ModerateMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| numero | número entero | Sí | — |

## 10. /mod clearwarns

Borra todas las advertencias

Permiso: `ModerateMembers`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 11. /mod purge

Borra mensajes (máx 100)

Permiso: `ManageMessages`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| cantidad | número entero | Sí | — |
| usuario | usuario | No | — |

## 12. /mod lock

Bloquea un canal

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 13. /mod unlock

Desbloquea un canal

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 14. /mod slowmode

Modo lento (segundos)

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| segundos | número entero | Sí | — |
| canal | canal | No | — |

## 15. /mod nick

Cambia el apodo de un usuario

Permiso: `ManageNicknames`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| apodo | texto | No | — |

## 16. /mod addrole

Da un rol a un usuario

Permiso: `ManageRoles`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| rol | rol | Sí | — |

## 17. /mod removerole

Quita un rol a un usuario

Permiso: `ManageRoles`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| rol | rol | Sí | — |

## 18. /mod hide

Oculta un canal

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 19. /mod unhide

Muestra un canal

Permiso: `ManageChannels`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 20. /mod banlist

Lista de baneados

Permiso: `BanMembers`

Sin opciones.

## 21. /mod warnlimit

Límite de warns antes de timeout

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| cantidad | número entero | Sí | — |
