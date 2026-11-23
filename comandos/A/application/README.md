# Aplicaciones

Comando base: `/application`

## 1. /application status

Mira el estado de todas tus postulaciones

Permiso: Ninguno

Sin opciones.

## 2. /application withdraw

Retira tu postulación pendiente

Permiso: Ninguno

Sin opciones.

## 3. /application config

Canal de logs del staff, rol revisor, espera, textos e imagen del panel

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal_logs | canal | No | — |
| rol_staff | rol | No | — |
| espera | número entero | No | — |
| titulo | texto | No | — |
| descripcion | texto | No | — |
| imagen | texto | No | — |
| web | texto | No | — |
| solo_web | sí/no | No | — |

## 4. /application preguntas

Define las preguntas del formulario (máx. 5) separadas por |

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| texto | texto | Sí | — |

## 5. /application puesto_add

Añade un puesto abierto a las postulaciones

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |
| cupos | número entero | No | — |
| rol | rol | No | — |

## 6. /application puesto_edit

Cambia cupos, rol o abre/cierra un puesto

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |
| cupos | número entero | No | — |
| rol | rol | No | — |
| abierto | sí/no | No | — |

## 7. /application puesto_del

Elimina un puesto

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |

## 8. /application puestos

Lista los puestos y sus cupos

Permiso: `ManageGuild`

Sin opciones.

## 9. /application pendientes

Lista las postulaciones pendientes de revisar

Permiso: Ninguno

Sin opciones.

## 10. /application panel

Publica el panel de postulaciones en un canal

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |

## 11. /application desactivar

Borra la configuración de postulaciones (conserva el historial)

Permiso: `ManageGuild`

Sin opciones.
