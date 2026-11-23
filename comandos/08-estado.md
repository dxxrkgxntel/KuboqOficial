# 08. Contadores y estado

Comando base: `/estado`

## 1. /estado setup

Crea el canal de voz contador de miembros en VC (se actualiza solo)

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| categoria | canal | No | — |
| formato | texto | No | — |

## 2. /estado canal

Usa un canal de voz que ya existe como contador

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |

## 3. /estado formato

Nombre del contador. Variables: {n} {humanos} {bots} {canales} {total}

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| formato | texto | Sí | — |

## 4. /estado contar

Incluir o no a los bots en el conteo de VC

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| bots | sí/no | Sí | — |

## 5. /estado panel

Publica un panel de estado que se actualiza solo

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| texto | canal | No | — |

## 6. /estado ver

Cuánta gente hay en canales de voz ahora mismo

Permiso: Ninguno

Sin opciones.

## 7. /estado quitar

Desactiva el estado de voz (borrar:true elimina también el canal y el panel)

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| borrar | sí/no | No | — |
