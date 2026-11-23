# 10. Economía

Comando base: `/eco`

## 1. /eco balance

Ver tu dinero: cartera, banco y total

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | No | — |

## 2. /eco weekly

Recompensa semanal

Permiso: Ninguno

Sin opciones.

## 3. /eco crime

Comete un crimen (2h)

Permiso: Ninguno

Sin opciones.

## 4. /eco rob

Roba a un usuario (3h)

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 5. /eco deposit

Deposita en el banco

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| cantidad | número entero | No | — |

## 6. /eco withdraw

Retira del banco

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| cantidad | número entero | No | — |

## 7. /eco pay

Paga a otro usuario

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| cantidad | número entero | Sí | — |

## 8. /eco shop

Ver la tienda

Permiso: Ninguno

Sin opciones.

## 9. /eco buy

Compra un item

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| item | texto | Sí | — |
| cantidad | número entero | No | — |

## 10. /eco inventory

Ver tu inventario

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | No | — |

## 11. /eco itemadd

Añade un item a la tienda

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |
| precio | número entero | Sí | — |
| descripcion | texto | No | — |
| rol | rol | No | — |

## 12. /eco itemremove

Quita un item de la tienda

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| nombre | texto | Sí | — |

## 13. /eco top

Top de más ricos

Permiso: Ninguno

Sin opciones.

## 14. /eco coinflip

Apuesta cara o cruz

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| apuesta | número entero | Sí | — |
| lado | texto | Sí | — |

## 15. /eco slots

Tragaperras

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| apuesta | número entero | Sí | — |

## 16. /eco dados

Dados contra el bot

Permiso: Ninguno

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| apuesta | número entero | Sí | — |

## 17. /eco mine

mine (30 min)

Permiso: Ninguno

Sin opciones.

## 18. /eco hunt

hunt (30 min)

Permiso: Ninguno

Sin opciones.

## 19. /eco add

Da monedas a un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| cantidad | número entero | Sí | — |

## 20. /eco remove

Quita monedas a un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |
| cantidad | número entero | Sí | — |

## 21. /eco reset

Reinicia la economía de un usuario

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| usuario | usuario | Sí | — |

## 22. /eco moneda

Cambia el símbolo de la moneda

Permiso: `Administrator`

| Opción | Tipo | Obligatoria | Opciones fijas |
|---|---|---|---|
| simbolo | texto | Sí | — |
