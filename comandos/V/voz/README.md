# Canales de voz (TempVoice)

Comando base: `/voz`

## 1. /voz setup

Canal disparador (voz) y categoría donde se crean los canales

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| disparador | canal | Sí | — |
| categoria | canal | Sí | — |
| nombre | texto | No | — |

## 2. /voz embed

Personaliza la interfaz: título, descripción, color (barra), banner (arriba), imagen (abajo), miniatura, pie

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| titulo | texto | No | — |
| descripcion | texto | No | — |
| color | texto | No | — |
| banner | texto | No | — |
| imagen | texto | No | — |
| miniatura | texto | No | — |
| pie | texto | No | — |

## 3. /voz interfaz

Activa/desactiva enviar la interfaz de control al chat de cada canal nuevo

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| estado | sí/no | Sí | — |

## 4. /voz panel

Publica (o republica) la interfaz fija en un canal de texto

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| canal | canal | Sí | — |

## 5. /voz estado

Ver configuración de "Crea tu VC"

Permiso: `ManageGuild`

Sin opciones.

## 6. /voz desactivar

Desactiva "Crea tu VC" (borrar:true también elimina los canales activos)

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| borrar | sí/no | No | — |

## 7. /voz banner

Edita el banner del panel: textos y fondo (link de imagen). Escribe "quitar" en fondo para quitarlo

Permiso: `ManageGuild`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| titulo | texto | No | — |
| lema | texto | No | — |
| subtitulo | texto | No | — |
| fondo | texto | No | — |
| nombre | texto | No | — |
