# 13. Halloween

Comando base: `/halloween`

## 1. /halloween setup

Personaliza la tienda: canal de pedidos, color, título, texto y pie

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| pedidos | canal | No | — |
| color | texto | No | — |
| titulo | texto | No | — |
| texto | texto | No | — |
| pie | texto | No | — |
| menu | texto | No | — |

## 2. /halloween agregar

Añade una recompensa a la tienda

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |
| precio | número entero | Sí | — |
| descripcion | texto | Sí | — |
| resumen | texto | No | — |
| emoji | texto | No | — |
| stock | número entero | No | — |
| limite | número entero | No | — |
| rol | rol | No | — |

## 3. /halloween editar

Edita una recompensa (stock -1 = ilimitado, límite 0 = sin límite)

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| numero | número entero | Sí | — |
| nombre | texto | No | — |
| precio | número entero | No | — |
| descripcion | texto | No | — |
| resumen | texto | No | — |
| emoji | texto | No | — |
| stock | número entero | No | — |
| limite | número entero | No | — |
| rol | rol | No | — |

## 4. /halloween quitar

Quita una recompensa de la tienda

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| numero | número entero | Sí | — |

## 5. /halloween lista

Lista las recompensas con su número

Permiso: `ManageGuild`

Sin opciones.

## 6. /halloween panel

Publica la tienda con su menú desplegable

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | No | — |

## 7. /halloween saldo

Mira tus monedas de dulce

Permiso: Ninguno

Sin opciones.

## 8. /halloween dar

Da (o quita con número negativo) monedas de dulce

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| cantidad | número entero | Sí | — |
