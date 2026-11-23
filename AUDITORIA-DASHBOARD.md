# Auditoría de comandos y dashboard del Kuboq

Inspección del código incluido en este paquete. Cada fila identifica el registro del comando, sus opciones, el permiso declarado y su ruta de ejecución web. «Dashboard» indica que la ruta web invoca la función registrada del bot con una interacción adaptada. El resultado real depende de los permisos, de los canales, de servicios externos y de la configuración del servidor.

## Ejecución y seguridad

- El panel obtiene comandos de `CATS` en ejecución. Las categorías del menú provienen de ese registro y desaparecen si el bot no las registra.
- Bienvenidas y Salidas guardan en `wb` y `bye`. Autoroles guarda `autoroles` y `botrole`; Tickets guarda `tk`; Verificación guarda `v` y `vemb`. Son las estructuras leídas por los eventos del bot. Las herramientas adicionales siguen accesibles. Los paneles ya publicados en Discord requieren una nueva publicación para reflejar cambios de diseño.
- La ejecución solicita iniciar sesión con Discord, permisos actuales para administrar el servidor y el permiso específico del comando. El usuario escoge el canal de ejecución. La respuesta pública se publica en ese canal.
- Las acciones musicales usan `dashboardControl` y `dashboardStatus` directamente. Incluyen reproducir, pausar, saltar, detener, mezclar, limpiar cola, volumen, repetición, filtros, reproducción automática y selección del canal fijo.
- Los eventos del bot se ejecutan por Discord mediante sus propios handlers. La dashboard expone la configuración y los comandos relacionados, mientras los eventos siguen funcionando según su disparador original.
- Los comandos que necesitan una confirmación que solo existe en Discord, o entregas de imágenes y archivos que requieren una interfaz propia, no aparecen como ejecutables en la dashboard.

## Inventario de comandos

| Comando | Descripción | Opciones | Permiso | Ruta |
|---|---|---|---|---|
| `/verif setup` | Configura canal, rol y modo (boton\|codigo\|captcha) | `canal:c!,rol:r!,modo:s` | Administrator | Dashboard |
| `/verif embed` | Personaliza el panel: título, descripción, color, banner (arriba), imagen (abajo), miniatura, pie, botón | `titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s,boton:s` | Administrator | Dashboard |
| `/verif boton` | Personaliza el botón: texto, color (gris/verde/rojo/azul) e icono (emoji o foto) | `texto:s,estilo:s,emoji:s,foto:s,nombrefoto:s` | Administrator | Dashboard |
| `/verif panel` | Envía el panel de verificación | `—` | Administrator | Dashboard |
| `/verif estado` | Ver configuración de verificación | `—` | Administrator | Dashboard |
| `/verif manual` | Verifica manualmente a un usuario | `usuario:u!` | ManageRoles | Dashboard |
| `/verif quitar` | Quita la verificación a un usuario | `usuario:u!` | ManageRoles | Dashboard |
| `/verif desactivar` | Desactiva el sistema de verificación | `—` | Administrator | Dashboard |
| `/seg estado` | Estado de toda la seguridad | `—` | Administrator | Dashboard |
| `/seg badwordadd` | Añade palabra prohibida | `palabra:s!` | Administrator | Dashboard |
| `/seg badwordremove` | Quita palabra prohibida | `palabra:s!` | Administrator | Dashboard |
| `/seg minage` | Edad mínima de cuenta en días (0=off) | `dias:i!` | Administrator | Dashboard |
| `/seg wladd` | Añade usuario o rol a la whitelist | `usuario:u,rol:r` | Administrator | Dashboard |
| `/seg wlremove` | Quita usuario o rol de la whitelist | `usuario:u,rol:r` | Administrator | Dashboard |
| `/seg raidconfig` | Configura umbral anti-raid | `entradas:i!,segundos:i!` | Administrator | Dashboard |
| `/seg lockdown` | Bloquea todos los canales del servidor | `—` | Administrator | Dashboard |
| `/seg unlockdown` | Desbloquea todos los canales | `—` | Administrator | Dashboard |
| `/mod ban` | Banea a un usuario | `usuario:u!,razon:s,dias:i` | BanMembers | Dashboard |
| `/mod unban` | Desbanea por ID | `id:s!,razon:s` | BanMembers | Dashboard |
| `/mod kick` | Expulsa a un usuario | `usuario:u!,razon:s` | KickMembers | Dashboard |
| `/mod softban` | Ban + unban para borrar mensajes | `usuario:u!,razon:s` | BanMembers | Dashboard |
| `/mod timeout` | Aísla temporalmente a un usuario | `usuario:u!,minutos:i!,razon:s` | ModerateMembers | Dashboard |
| `/mod untimeout` | Quita el aislamiento | `usuario:u!` | ModerateMembers | Dashboard |
| `/mod warn` | Advierte a un usuario | `usuario:u!,razon:s!` | ModerateMembers | Dashboard |
| `/mod warns` | Ver advertencias de un usuario | `usuario:u!` | ModerateMembers | Dashboard |
| `/mod delwarn` | Elimina una advertencia | `usuario:u!,numero:i!` | ModerateMembers | Dashboard |
| `/mod clearwarns` | Borra todas las advertencias | `usuario:u!` | ModerateMembers | Dashboard |
| `/mod purge` | Borra mensajes (máx 100) | `cantidad:i!,usuario:u` | ManageMessages | Dashboard |
| `/mod privado` | Hace un canal privado: solo lo ve el rol que indiques | `canal:c!,rol:r!` | ManageChannels | Dashboard |
| `/mod auditar` | Lista canales con nombre sensible (staff, vip, privado...) que todos pueden ver | `—` | ManageChannels | Dashboard |
| `/mod lock` | Bloquea un canal | `canal:c` | ManageChannels | Dashboard |
| `/mod unlock` | Desbloquea un canal | `canal:c` | ManageChannels | Dashboard |
| `/mod slowmode` | Modo lento (segundos) | `segundos:i!,canal:c` | ManageChannels | Dashboard |
| `/mod nick` | Cambia el apodo de un usuario | `usuario:u!,apodo:s` | ManageNicknames | Dashboard |
| `/mod addrole` | Da un rol a un usuario | `usuario:u!,rol:r!` | ManageRoles | Dashboard |
| `/mod removerole` | Quita un rol a un usuario | `usuario:u!,rol:r!` | ManageRoles | Dashboard |
| `/mod hide` | Oculta un canal | `canal:c` | ManageChannels | Dashboard |
| `/mod unhide` | Muestra un canal | `canal:c` | ManageChannels | Dashboard |
| `/mod banlist` | Lista de baneados | `—` | BanMembers | Dashboard |
| `/mod warnlimit` | Límite de warns antes de timeout | `cantidad:i!` | Administrator | Dashboard |
| `/log servidor` | Crea todos los canales de log (uno por evento) y los configura solos | `—` | Administrator | Dashboard |
| `/nivel rank` | Ver tu tarjeta de nivel | `usuario:u` | Sin permiso adicional | Dashboard |
| `/nivel vista` | Vista previa de tu tarjeta, con el texto NUEVO NIVEL | `—` | Administrator | Dashboard |
| `/nivel fondo` | Imagen o GIF de fondo de la tarjeta (link https). Escribe "quitar" para quitarlo | `url:s!` | Administrator | Dashboard |
| `/nivel marca` | Textos de arriba de la tarjeta: texto (marca), izquierda y derecha. "quitar" restaura | `texto:s,izquierda:s,derecha:s` | Administrator | Dashboard |
| `/nivel textonuevo` | Muestra u oculta el texto "NUEVO NIVEL" de la tarjeta al subir de nivel | `estado:b!` | Administrator | Dashboard |
| `/nivel color` | Color de la barra y del acento (ej. #a855f7) | `color:s!` | Administrator | Dashboard |
| `/nivel top` | Top de niveles | `—` | Sin permiso adicional | Dashboard |
| `/nivel set` | Establece el nivel de un usuario | `usuario:u!,nivel:i!` | Administrator | Dashboard |
| `/nivel xpadd` | Da XP a un usuario | `usuario:u!,cantidad:i!` | Administrator | Dashboard |
| `/nivel xpremove` | Quita XP a un usuario | `usuario:u!,cantidad:i!` | Administrator | Dashboard |
| `/nivel rate` | XP medio por mensaje (1-100) | `cantidad:i!` | Administrator | Dashboard |
| `/nivel canal` | Canal de avisos de nivel | `canal:c` | Administrator | Dashboard |
| `/nivel roladd` | Rol de recompensa por nivel | `nivel:i!,rol:r!` | Administrator | Dashboard |
| `/nivel rolremove` | Quita rol de recompensa | `nivel:i!` | Administrator | Dashboard |
| `/nivel roles` | Ver roles de recompensa | `—` | Sin permiso adicional | Dashboard |
| `/nivel mensaje` | Mensaje/imagen de subida. {user} {level} {server} | `texto:s,imagen:s,titulo:s` | Administrator | Dashboard |
| `/nivel reset` | Reinicia niveles de un usuario | `usuario:u!` | Administrator | Dashboard |
| `/nivel toggle` | Activa/desactiva el sistema de niveles | `estado:b!` | Administrator | Dashboard |
| `/eco balance` | Ver tu dinero: cartera, banco y total | `usuario:u` | Sin permiso adicional | Dashboard |
| `/daily` | Recibe tu recompensa diaria | `—` | Sin permiso adicional | Dashboard |
| `/eco weekly` | Recompensa semanal | `—` | Sin permiso adicional | Dashboard |
| `/work` | Trabaja y gana monedas (1h) | `—` | Sin permiso adicional | Dashboard |
| `/eco crime` | Comete un crimen (2h) | `—` | Sin permiso adicional | Dashboard |
| `/eco rob` | Roba a un usuario (3h) | `usuario:u!` | Sin permiso adicional | Dashboard |
| `/eco deposit` | Deposita en el banco | `cantidad:i` | Sin permiso adicional | Dashboard |
| `/eco withdraw` | Retira del banco | `cantidad:i` | Sin permiso adicional | Dashboard |
| `/eco pay` | Paga a otro usuario | `usuario:u!,cantidad:i!` | Sin permiso adicional | Dashboard |
| `/eco shop` | Ver la tienda | `—` | Sin permiso adicional | Dashboard |
| `/eco buy` | Compra un item | `item:s!,cantidad:i` | Sin permiso adicional | Dashboard |
| `/eco inventory` | Ver tu inventario | `usuario:u` | Sin permiso adicional | Dashboard |
| `/eco itemadd` | Añade un item a la tienda | `nombre:s!,precio:i!,descripcion:s,rol:r` | Administrator | Dashboard |
| `/eco itemremove` | Quita un item de la tienda | `nombre:s!` | Administrator | Dashboard |
| `/eco top` | Top de más ricos | `—` | Sin permiso adicional | Dashboard |
| `/eco coinflip` | Apuesta cara o cruz | `apuesta:i!,lado:s!` | Sin permiso adicional | Dashboard |
| `/eco slots` | Tragaperras | `apuesta:i!` | Sin permiso adicional | Dashboard |
| `/eco dados` | Dados contra el bot | `apuesta:i!` | Sin permiso adicional | Dashboard |
| `/fishing collect` | Pesca y recoge tus ganancias (30 min) | `—` | Sin permiso adicional | Dashboard |
| `/eco add` | Da monedas a un usuario | `usuario:u!,cantidad:i!` | Administrator | Dashboard |
| `/eco remove` | Quita monedas a un usuario | `usuario:u!,cantidad:i!` | Administrator | Dashboard |
| `/eco reset` | Reinicia la economía de un usuario | `usuario:u!` | Administrator | Dashboard |
| `/eco moneda` | Cambia el símbolo de la moneda | `simbolo:s!` | Administrator | Dashboard |
| `/logro logros` | Ver tus logros con progreso y puntos | `usuario:u` | Sin permiso adicional | Dashboard |
| `/logro servidor` | Lista de todos los logros del servidor y qué % los tiene | `—` | Sin permiso adicional | Dashboard |
| `/logro top` | Ranking de puntos de logros | `—` | Sin permiso adicional | Dashboard |
| `/logro crear` | Crea un logro (el tipo incluye voz, cámara, micro, stream y días) | `nombre:s!,descripcion:s!,tipo:s!,valor:i!,emoji:s,rareza:s,puntos:i,icono:s,forma:s,imagen:s` | Administrator | Dashboard |
| `/logro eliminar` | Elimina un logro por ID | `id:s!` | Administrator | Dashboard |
| `/logro dar` | Da un logro a un usuario (se anuncia con la tarjeta) | `usuario:u!,id:s!` | Administrator | Dashboard |
| `/logro probar` | Vista previa de la tarjeta de un logro (no lo da a nadie) | `id:s!` | Administrator | Dashboard |
| `/logro quitar` | Quita un logro a un usuario | `usuario:u!,id:s!` | Administrator | Dashboard |
| `/logro canal` | Canal de anuncios de logros | `canal:c` | Administrator | Dashboard |
| `/logro imagen` | Imagen de respaldo si no se puede dibujar la tarjeta | `url:s!` | Administrator | Dashboard |
| `/logro toggle` | Activa/desactiva logros | `estado:b!` | Administrator | Dashboard |
| `/anuncio anunciar` | Envía un anuncio con embed | `canal:c!,titulo:s!,descripcion:s!,color:s,imagen:s,miniatura:s,mencion:r,everyone:b` | ManageGuild | Dashboard |
| `/anuncio embed` | Envía un embed personalizado | `descripcion:s!,canal:c,titulo:s,color:s,imagen:s,miniatura:s,autor:s,pie:s` | ManageMessages | Dashboard |
| `/anuncio say` | El bot dice un mensaje | `texto:s!,canal:c` | ManageMessages | Dashboard |
| `/anuncio editar` | Edita un mensaje que envió el bot (texto, título, descripción o color) | `mensaje:s!,texto:s,titulo:s,descripcion:s,color:s` | ManageMessages | Dashboard |
| `/anuncio borrar` | Borra un mensaje que envió el bot | `mensaje:s!` | ManageMessages | Dashboard |
| `/anuncio encuesta` | Crea una encuesta (hasta 4 opciones) | `pregunta:s!,op1:s!,op2:s!,op3:s,op4:s` | ManageMessages | Dashboard |
| `/anuncio sorteo` | Crea un sorteo | `premio:s!,minutos:i!,ganadores:i` | ManageGuild | Dashboard |
| `/anuncio recordatorio` | Te recuerda algo (minutos) | `minutos:i!,texto:s!` | Sin permiso adicional | Dashboard |
| `/autorole add` | Rol(es) automático(s) al entrar (hasta 2 a la vez) | `rol1:r!,rol2:r` | Administrator | Dashboard |
| `/autorole remove` | Quita un autorol | `rol:r!` | Administrator | Dashboard |
| `/autorole list` | Lista de autoroles y su estado | `—` | Sin permiso adicional | Dashboard |
| `/autorole bot` | Rol automático para bots | `rol:r` | Administrator | Dashboard |
| `/autorole revisar` | Diagnostica por qué un autorol podría no funcionar | `—` | Administrator | Dashboard |
| `/autorole aplicar` | Da los autoroles a los miembros actuales que no los tengan | `—` | Administrator | Dashboard |
| `/autorole panel` | Panel de roles con botones (hasta 5) | `canal:c!,titulo:s!,descripcion:s!,rol1:r!,rol2:r,rol3:r,rol4:r,rol5:r,imagen:s,color:s` | Administrator | Dashboard |
| `/rolpanel crear` | Crea un panel de roles (banner, título y descripción) en un canal | `canal:c!,titulo:s!,descripcion:s!,banner:s,color:s` | Administrator | Dashboard |
| `/rolpanel boton_add` | Añade un botón (rol) a un panel | `panel:s!,nombre:s!,rol:r!,emoji:s` | Administrator | Dashboard |
| `/rolpanel boton_edit` | Cambia nombre, rol o emoji de un botón (emoji "quitar" lo elimina) | `panel:s!,boton:s!,nombre:s,emoji:s,rol:r` | Administrator | Dashboard |
| `/rolpanel boton_del` | Quita un botón de un panel | `panel:s!,boton:s!` | Administrator | Dashboard |
| `/rolpanel editar` | Cambia título, descripción, banner, color, pie o modo de un panel | `panel:s!,titulo:s,descripcion:s,banner:s,color:s,pie:s,exclusivo:b` | Administrator | Dashboard |
| `/rolpanel borrar` | Borra un panel y su mensaje (los roles dados no se quitan) | `panel:s!` | Administrator | Dashboard |
| `/rolpanel lista` | Lista los paneles de roles y sus botones | `—` | Administrator | Dashboard |
| `/vozbot activar` | El bot entra a un canal de voz y se queda 24/7 (vuelve a entrar si lo sacan) | `canal:c!` | Administrator | Dashboard |
| `/vozbot desactivar` | El bot sale del canal de voz y deja de quedarse 24/7 | `—` | Administrator | Dashboard |
| `/vozbot estado` | Ver en qué canal está el bot 24/7 | `—` | Administrator | Dashboard |
| `/ticket setup` | Categoría por defecto, rol de soporte (cierra/gestiona tickets) y canal de logs | `categoria:c,rol:r,logs:c` | Administrator | Dashboard |
| `/ticket embed` | Personaliza el panel: título, descripción, color, banner (arriba), imagen (abajo), miniatura, pie | `titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s,boton:s,menu:s,bienvenida:s` | Administrator | Dashboard |
| `/ticket tipo` | Crea o edita un tipo de ticket (con su categoría, rol de soporte y bienvenida) | `nombre:s!,categoria:c,rol:r,emoji:s,descripcion:s,bienvenida:s` | Administrator | Dashboard |
| `/ticket tipoquitar` | Elimina un tipo de ticket | `nombre:s!` | Administrator | Dashboard |
| `/ticket tipos` | Lista los tipos de ticket | `—` | Administrator | Dashboard |
| `/ticket panel` | Publica el panel (menú desplegable si hay tipos; si no, botón) | `canal:c,modo:s` | Administrator | Dashboard |
| `/ticket add` | Añade un usuario al ticket (solo staff) | `usuario:u!` | Sin permiso adicional | Dashboard |
| `/ticket remove` | Quita un usuario del ticket (solo staff) | `usuario:u!` | Sin permiso adicional | Dashboard |
| `/ticket close` | Cierra el ticket (solo administradores o soporte) | `—` | Sin permiso adicional | Dashboard |
| `/ticket rename` | Renombra el ticket (solo staff) | `nombre:s!` | Sin permiso adicional | Dashboard |
| `/ticket claim` | Reclama el ticket (solo staff) | `—` | Sin permiso adicional | Dashboard |
| `/ticket transcript` | Genera la transcripción (solo staff) | `—` | Sin permiso adicional | Archivo de transcripción en Discord |
| `/ticket limite` | Máximo de tickets por usuario | `cantidad:i!` | Administrator | Dashboard |
| `/invite invites` | Ver invitaciones | `usuario:u` | Sin permiso adicional | Dashboard |
| `/invite top` | Top de invitadores | `—` | Sin permiso adicional | Dashboard |
| `/invite quien` | Quién invitó a un usuario | `usuario:u!` | Sin permiso adicional | Dashboard |
| `/invite invitados` | Lista de personas que invitó un usuario | `usuario:u` | Sin permiso adicional | Dashboard |
| `/invite config` | Bienvenida simple antigua (recomendado: /bienvenida) | `canal:c,mensaje:s,salida:s` | Administrator | Dashboard |
| `/invite embed` | Embed de la bienvenida simple antigua | `titulo:s,color:s,imagen:s` | Administrator | Dashboard |
| `/invite ajustes` | Días para cuentas falsas, reingresos y quitar roles al bajar | `fakedias:i,reingreso:b,quitar:b` | Administrator | Dashboard |
| `/invite logs` | Elige el canal donde llegan los logs de invitaciones (entradas, salidas, links) | `canal:c!` | Administrator | Dashboard |
| `/canal invitaciones` | Canal donde llegan SOLO los avisos de invitaciones (quién invitó y por qué link entró) | `canal:c` | Administrator | Dashboard |
| `/invite logevento` | Activa/desactiva un tipo de log de invitaciones | `suceso:s!,estado:b!` | Administrator | Dashboard |
| `/invite logmsg` | Personaliza el embed de un log. Ver /invite variables | `suceso:s!,titulo:s,descripcion:s,color:s,restaurar:b` | Administrator | Dashboard |
| `/invite vista` | Previsualiza un log de invitaciones | `suceso:s!` | Administrator | Dashboard |
| `/invite variables` | Variables para personalizar los logs | `—` | Sin permiso adicional | Dashboard |
| `/invite ver` | Ver la configuración de invitaciones | `—` | Administrator | Dashboard |
| `/invite revisar` | Diagnóstico del sistema de invitaciones | `—` | Administrator | Dashboard |
| `/invite reset` | Reinicia invitaciones de un usuario | `usuario:u!` | Administrator | Dashboard |
| `/invite bonus` | Da invitaciones bonus (negativo para quitar) | `usuario:u!,cantidad:i!` | Administrator | Dashboard |
| `/invite rewardadd` | Rol al alcanzar N invitaciones | `invitaciones:i!,rol:r!` | Administrator | Dashboard |
| `/invite rewardremove` | Quita recompensa de invitaciones | `invitaciones:i!` | Administrator | Dashboard |
| `/invite rewardaplicar` | Aplica las recompensas a quienes ya cumplen el mínimo | `—` | Administrator | Dashboard |
| `/util ping` | Latencia del bot | `—` | Sin permiso adicional | Dashboard |
| `/util avatar` | Avatar de un usuario | `usuario:u` | Sin permiso adicional | Dashboard |
| `/util banner` | Banner de un usuario | `usuario:u` | Sin permiso adicional | Dashboard |
| `/util userinfo` | Info de un usuario | `usuario:u` | Sin permiso adicional | Dashboard |
| `/util serverinfo` | Info del servidor | `—` | Sin permiso adicional | Dashboard |
| `/util roleinfo` | Info de un rol | `rol:r!` | Sin permiso adicional | Dashboard |
| `/util channelinfo` | Info de un canal | `canal:c` | Sin permiso adicional | Dashboard |
| `/util botinfo` | Info del bot | `—` | Sin permiso adicional | Dashboard |
| `/util uptime` | Tiempo encendido | `—` | Sin permiso adicional | Dashboard |
| `/util help` | Lista de módulos y comandos | `—` | Sin permiso adicional | Dashboard |
| `/util autocanales` | Asigna solos los canales de logs, logros, bienvenida y despedida según sus nombres, y lo guarda | `—` | Administrator | Dashboard |
| `/util estado` | Cambia el texto de "Jugando" del perfil. Varias frases separadas con \| (rotan solas) | `texto:s!` | Administrator | Dashboard |
| `/util membercount` | Cantidad de miembros | `—` | Sin permiso adicional | Dashboard |
| `/util emojis` | Emojis del servidor | `—` | Sin permiso adicional | Dashboard |
| `/util 8ball` | Bola 8 mágica | `pregunta:s!` | Sin permiso adicional | Dashboard |
| `/util moneda` | Lanza una moneda | `—` | Sin permiso adicional | Dashboard |
| `/util dado` | Lanza un dado | `caras:i` | Sin permiso adicional | Dashboard |
| `/util elegir` | Elige entre opciones separadas por coma | `opciones:s!` | Sin permiso adicional | Dashboard |
| `/util invertir` | Invierte un texto | `texto:s!` | Sin permiso adicional | Dashboard |
| `/util chiste` | Cuenta un chiste | `—` | Sin permiso adicional | Dashboard |
| `/util ship` | Compatibilidad entre usuarios | `usuario:u!,usuario2:u` | Sin permiso adicional | Dashboard |
| `/util calcular` | Calculadora | `expresion:s!` | Sin permiso adicional | Dashboard |
| `/util sugerencia` | Envía una sugerencia | `texto:s!` | Sin permiso adicional | Dashboard |
| `/util reportar` | Reporta a un usuario al staff | `usuario:u!,razon:s!` | Sin permiso adicional | Dashboard |
| `/bienvenida autocanal` | Crea los canales #bienvenida y #despedidas y los configura solo | `—` | Administrator | Dashboard |
| `/bienvenida canal` | Fija el canal (si no, se elige uno automático) | `evento:s!,canal:c!` | Administrator | Dashboard |
| `/bienvenida mensaje` | Texto del embed. Usa \\n para saltos de línea. Ver /bienvenida variables | `evento:s!,texto:s!` | Administrator | Dashboard |
| `/bienvenida titulo` | Título del embed (ninguno = sin título) | `evento:s!,texto:s!` | Administrator | Dashboard |
| `/bienvenida embed` | Color, imágenes y pie. imagen/miniatura: enlace(s) con \|, avatar o servidor | `evento:s!,color:s,imagen:s,miniatura:s,pie:s,autor:s` | Administrator | Dashboard |
| `/bienvenida texto` | Texto sobre el embed (ej. {user} para mencionar). ninguno = vacío | `evento:s!,texto:s!` | Administrator | Dashboard |
| `/bienvenida activar` | Activa o desactiva bienvenida/despedida | `evento:s!,estado:b!` | Administrator | Dashboard |
| `/bienvenida dm` | Mensaje privado al nuevo miembro (ninguno = quitar) | `mensaje:s!` | Administrator | Dashboard |
| `/bienvenida vista` | Previsualiza el mensaje con tu usuario | `evento:s!` | Administrator | Dashboard |
| `/bienvenida ver` | Ver la configuración actual | `—` | Administrator | Dashboard |
| `/bienvenida editar` | Edita el último mensaje de bienvenida o despedida que envió el bot | `evento:s!,texto:s,titulo:s,descripcion:s,color:s` | Administrator | Dashboard |
| `/bienvenida variables` | Lista de variables disponibles | `—` | Sin permiso adicional | Dashboard |
| `/bienvenida reset` | Restaura bienvenida o despedida a los valores por defecto | `evento:s!` | Administrator | Dashboard |
| `/limpiar mensajes` | Borra mensajes recientes del canal (hasta 1000) | `cantidad:i!,usuario:u,filtro:s,contiene:s,canal:c` | ManageMessages | Dashboard |
| `/limpiar desde` | Borra todo lo posterior a un mensaje (ID o enlace del mensaje) | `mensaje:s!,canal:c` | ManageMessages | Dashboard |
| `/limpiar canal` | Reinicia el canal: lo recrea vacío (borra TODO, pide confirmación) | `canal:c` | ManageChannels | Confirmación interactiva en Discord |
| `/limpiar auto` | Limpieza automática de un canal cada X horas | `canal:c!,horas:i!,modo:s` | ManageGuild | Dashboard |
| `/limpiar autoquitar` | Quita la limpieza automática de un canal | `canal:c!` | ManageGuild | Dashboard |
| `/limpiar autolista` | Lista las limpiezas automáticas | `—` | ManageGuild | Dashboard |
| `/estado setup` | Crea el canal de voz contador de miembros en VC (se actualiza solo) | `categoria:c,formato:s` | ManageGuild | Dashboard |
| `/estado canal` | Usa un canal de voz que ya existe como contador | `canal:c!` | ManageGuild | Dashboard |
| `/estado formato` | Nombre del contador. Variables: {n} {humanos} {bots} {canales} {total} | `formato:s!` | ManageGuild | Dashboard |
| `/estado contar` | Incluir o no a los bots en el conteo de VC | `bots:b!` | ManageGuild | Dashboard |
| `/estado panel` | Publica un panel de estado que se actualiza solo | `texto:c` | ManageGuild | Dashboard |
| `/estado ver` | Cuánta gente hay en canales de voz ahora mismo | `—` | Sin permiso adicional | Dashboard |
| `/estado quitar` | Desactiva el estado de voz (borrar:true elimina también el canal y el panel) | `borrar:b` | ManageGuild | Dashboard |
| `/stats crear` | Crea un canal de estadística (o el paquete básico con "todos") | `tipo:s!,canal:c,formato:s` | ManageChannels | Dashboard |
| `/stats formato` | Personaliza el texto. Variables: {count} {goal} {pct} {left} {server}. "restaurar" = por defecto | `tipo:s!,formato:s!` | ManageChannels | Dashboard |
| `/stats meta` | Define la meta del canal de meta (qué contar y el objetivo) | `objetivo:i!,tipo:s` | ManageGuild | Dashboard |
| `/stats quitar` | Quita una estadística (o todas). borrar:true también elimina el canal | `tipo:s!,borrar:b` | ManageChannels | Dashboard |
| `/stats lista` | Ver las estadísticas configuradas | `—` | ManageChannels | Dashboard |
| `/stats actualizar` | Actualiza ahora todos los canales de estadísticas | `—` | ManageChannels | Dashboard |
| `/stats ajustes` | Intervalo (5-120 min), abreviar números (1.2k) y categoría donde crear | `intervalo:i,abreviar:b,categoria:c` | ManageGuild | Dashboard |
| `/voz setup` | Canal disparador (voz) y categoría donde se crean los canales | `disparador:c!,categoria:c!,nombre:s` | ManageGuild | Dashboard |
| `/voz embed` | Personaliza la interfaz: título, descripción, color (barra), banner (arriba), imagen (abajo), miniatura, pie | `titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s` | ManageGuild | Dashboard |
| `/voz banner` | Edita el banner del panel: textos y fondo (link de imagen). Escribe "quitar" en fondo para quitarlo | `titulo:s,lema:s,subtitulo:s,fondo:s,nombre:s` | ManageGuild | Dashboard |
| `/voz interfaz` | Activa/desactiva enviar la interfaz de control al chat de cada canal nuevo | `estado:b!` | ManageGuild | Dashboard |
| `/voz panel` | Publica (o republica) la interfaz fija en un canal de texto | `canal:c!` | ManageGuild | Dashboard |
| `/voz estado` | Ver configuración de "Crea tu VC" | `—` | ManageGuild | Dashboard |
| `/voz desactivar` | Desactiva "Crea tu VC" (borrar:true también elimina los canales activos) | `borrar:b` | ManageGuild | Dashboard |
| `/bump ahora` | Haz bump: apoya al servidor y recibe recompensas | `—` | Sin permiso adicional | Dashboard |
| `/bump config` | Canal, rol a avisar, intervalo, premio y detección de Disboard | `canal:c,rol:r,minutos:i,premio:i,gemas:i,xp:i,disboard:b,recordatorio:s` | ManageGuild | Dashboard |
| `/bump estado` | Cuándo toca el próximo bump | `—` | Sin permiso adicional | Dashboard |
| `/bump top` | Ranking de bumpers | `—` | Sin permiso adicional | Dashboard |
| `/bump desactivar` | Apaga el sistema de bump | `—` | ManageGuild | Dashboard |
| `/confesiones` | Publica el panel de confesiones anónimas y lo configura solo | `canal:c,imagen:s,nombre:s,reportes:c` | ManageGuild | Dashboard |
| `/confesion setup` | Configura el canal de confesiones y publica el panel automáticamente | `canal:c!,reportes:c` | ManageGuild | Dashboard |
| `/confesion panel` | Vuelve a publicar el panel con el botón de confesar | `canal:c` | ManageGuild | Dashboard |
| `/confesion enviar` | Envía una confesión anónima | `texto:s!` | Sin permiso adicional | Dashboard |
| `/confesion guardar` | Guardar o no el autor (para moderar abusos) | `estado:b!` | Administrator | Dashboard |
| `/confesion autor` | Revela el autor de una confesión (solo admins, queda en logs) | `numero:i!` | Administrator | Dashboard |
| `/confesion borrar` | Borra una confesión publicada | `numero:i!` | ManageMessages | Dashboard |
| `/confesion bloquear` | Impide que un usuario envíe confesiones | `usuario:u!` | ManageMessages | Dashboard |
| `/confesion desbloquear` | Permite de nuevo confesar a un usuario | `usuario:u!` | ManageMessages | Dashboard |
| `/confesion estado` | Ver la configuración de confesiones | `—` | ManageGuild | Dashboard |
| `/pinterest buscar` | Imagen de CUALQUIER tema (gatos, coches, anime, paisajes...) | `tema:s!,cantidad:i,canal:c` | Sin permiso adicional | Imágenes y botones en Discord |
| `/pinterest tablero` | Imagen aleatoria de un tablero público de Pinterest (enlace o nombre guardado) | `tablero:s!,cantidad:i,canal:c` | Sin permiso adicional | Imágenes y botones en Discord |
| `/pinterest pin` | Muestra la imagen de un pin (enlace pinterest.com/pin/... o pin.it/...) | `enlace:s!,canal:c` | Sin permiso adicional | Imágenes y botones en Discord |
| `/pinterest guardar` | Guarda un tablero con un nombre corto | `nombre:s!,enlace:s!` | ManageGuild | Dashboard |
| `/pinterest quitar` | Quita un tablero guardado | `nombre:s!` | ManageGuild | Dashboard |
| `/pinterest lista` | Tableros guardados y publicaciones automáticas | `—` | Sin permiso adicional | Dashboard |
| `/pinterest auto` | Publica una imagen cada X horas (tablero, nombre guardado o tema) | `canal:c!,fuente:s!,horas:i!` | ManageGuild | Dashboard |
| `/pinterest autoquitar` | Quita la publicación automática de un canal | `canal:c!` | ManageGuild | Dashboard |
| `/ia imagen` | Genera una imagen con IA a partir de un texto | `prompt:s!,estilo:s,formato:s,semilla:i,canal:c` | Sin permiso adicional | Archivo de imagen en Discord |
| `/ia config` | Activa/desactiva la IA, cooldown y canal único (sin canal = cualquiera) | `estado:b,cooldown:i,canal:c` | ManageGuild | Dashboard |
| `/application status` | Mira el estado de todas tus postulaciones | `—` | Sin permiso adicional | Dashboard |
| `/application withdraw` | Retira tu postulación pendiente | `—` | Sin permiso adicional | Dashboard |
| `/application config` | Canal de logs del staff, rol revisor, espera, textos e imagen del panel | `canal_logs:c,rol_staff:r,espera:i,titulo:s,descripcion:s,imagen:s,web:s,solo_web:b` | ManageGuild | Dashboard |
| `/application preguntas` | Define las preguntas del formulario (máx. 5) separadas por \| | `texto:s!` | ManageGuild | Dashboard |
| `/application puesto_add` | Añade un puesto abierto a las postulaciones | `nombre:s!,cupos:i,rol:r` | ManageGuild | Dashboard |
| `/application puesto_edit` | Cambia cupos, rol o abre/cierra un puesto | `nombre:s!,cupos:i,rol:r,abierto:b` | ManageGuild | Dashboard |
| `/application puesto_del` | Elimina un puesto | `nombre:s!` | ManageGuild | Dashboard |
| `/application puestos` | Lista los puestos y sus cupos | `—` | ManageGuild | Dashboard |
| `/application pendientes` | Lista las postulaciones pendientes de revisar | `—` | Sin permiso adicional | Dashboard |
| `/application panel` | Publica el panel de postulaciones en un canal | `canal:c!` | ManageGuild | Dashboard |
| `/application desactivar` | Borra la configuración de postulaciones (conserva el historial) | `—` | ManageGuild | Dashboard |

Total de comandos registrados mediante `def`: 251. Comandos reservados a Discord: 6. Los cinco comandos musicales declarados con `SlashCommandBuilder` tienen controles equivalentes en la sección Música.

## Comandos musicales de Discord

| Comando | Control del panel |
|---|---|
| `/musicpanel` | Centro de música |
| `/play` | Buscar canción y agregar a la cola |
| `/skip` | Siguiente |
| `/stop` | Detener |
| `/musicvoice` | Canal de voz permanente |

## Eventos y ejecuciones automáticas

Los siguientes eventos están registrados en `src/legacy/runtime.js` y `extras.js`. Sus efectos dependen de los handlers y de la configuración por servidor. La dashboard configura los sistemas relacionados a través de comandos y ajustes persistidos.

| Evento | Handlers registrados |
|---|---:|
| `channelCreate` | 1 |
| `channelDelete` | 1 |
| `channelUpdate` | 1 |
| `emojiCreate` | 1 |
| `emojiDelete` | 1 |
| `emojiUpdate` | 1 |
| `guildBanAdd` | 1 |
| `guildBanRemove` | 1 |
| `guildCreate` | 1 |
| `guildIntegrationsUpdate` | 1 |
| `guildMemberAdd` | 2 |
| `guildMemberRemove` | 2 |
| `guildMemberUpdate` | 2 |
| `guildScheduledEventCreate` | 1 |
| `guildScheduledEventDelete` | 1 |
| `guildScheduledEventUpdate` | 1 |
| `guildUpdate` | 1 |
| `interactionCreate` | 1 |
| `inviteCreate` | 1 |
| `inviteDelete` | 1 |
| `messageCreate` | 3 |
| `messageDelete` | 1 |
| `messageReactionAdd` | 3 |
| `messageReactionRemove` | 1 |
| `messageUpdate` | 1 |
| `roleCreate` | 1 |
| `roleDelete` | 1 |
| `roleUpdate` | 1 |
| `stickerCreate` | 1 |
| `stickerDelete` | 1 |
| `threadCreate` | 1 |
| `threadDelete` | 1 |
| `voiceStateUpdate` | 2 |
| `webhooksUpdate` | 1 |

## Comprobaciones

`npm run check` pasó las siete pruebas del paquete y la comprobación de sintaxis. El inicio de sesión OAuth, los permisos efectivos y la publicación en Discord requieren un bot conectado y un servidor real para verificarse.
# Iteración de formatos de mensajes

Los mensajes configurables de bienvenida, despedida, panel de tickets, panel de verificación y panel público de postulaciones se enlazaron con cuatro formatos (Embed, Components V2, Card PNG, Texto normal). El formato queda en `cfg.messageFormats` por servidor y se usa tanto al publicar como en la vista previa de sus editores. Los controles interactivos siguen adjuntos. La card dibuja el texto, color y pie en PNG y no incrusta recursos remotos. Los paneles publicados antes de cambiar el formato requieren una nueva publicación. Los demás sistemas de mensajes conservan sus implementaciones actuales y no muestran un selector que no altere realmente el envío.

La revisión del video de uso mostró formularios genéricos que exigían un segundo canal y previews ficticias para ajustes. Se modificó la ejecución del dashboard para aceptar comandos de configuración sin canal de publicación y no enviar sus respuestas privadas a Discord. Las acciones que requieren contexto de canal lo solicitan; las funciones de ticket dentro del propio ticket se ocultan de la dashboard. Cumpleaños y Respuestas automáticas ahora tienen editores directos, formato por servidor y envío real en los cuatro formatos. Los canales de voz, categoría y texto se filtran por tipo en sus selectores. No se ha validado todavía la publicación contra la cuenta Discord real del usuario.

