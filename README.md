**NUEVO: LOCAL + FADEHOST con `config.json`**. Consulta [CONFIGURACION-LOCAL-Y-FADEHOST.md](CONFIGURACION-LOCAL-Y-FADEHOST.md).

# Kuboq — Bot de Discord con dashboard web

El proyecto conserva el bot y añade un dashboard web conectado a sus comandos y al reproductor de música. El dashboard usa inicio de sesión OAuth2 de Discord, guarda identidad y preferencias por servidor en MongoDB y comprueba los permisos del usuario antes de cada acción.

## Instalar y arrancar

1. Instala Node.js 22 o posterior.
2. Instala las dependencias con npm ci.
3. Completa en privado `config.json` con el token, la URI de MongoDB y las opciones del bot.
4. Configura OAuth2 como se explica abajo.
5. Inicia con npm start.

El dashboard escucha en el puerto 3000 por defecto y usa `PORT` si FadeHost asigna uno. Abre la raíz `/` del dominio para entrar en la portada de Kuboq. `APP_URL` puede definir automáticamente el callback OAuth2 cuando `dashboard.redirectUri` está en `auto`.

## Portada, login y elección de servidor

- `/` es la portada pública: explica las funciones del bot, enseña una demostración visual de los cuatro formatos de mensaje y ofrece **Conocer la dashboard** e **Iniciar sesión con Discord**.
- El inicio de sesión de la portada abre Discord en una ventana emergente. Tras autorizar, muestra el @usuario y avatar de Discord y se cierra en cuanto la pestaña principal comprueba la sesión (tras un mínimo de 400 ms, o en 900 ms como máximo). La pestaña original abre `/dashboard/servers`. Los errores permanecen visibles para permitir reintentar. Si el navegador bloquea ventanas emergentes, el acceso continúa en la misma pestaña.
- En `/dashboard/servers` aparecen los servidores administrables con el bot instalado. Puede buscarlos y elegir uno. Solo después se abre `/dashboard/ID_DEL_SERVIDOR` con sus módulos.
- **Cambiar servidor** vuelve a la pantalla de elección. La portada detecta una sesión existente y cambia su acceso por **Elegir servidor**. El cierre de sesión vuelve a la portada.
- El encabezado del panel y la elección de servidor muestran el avatar de Discord de la cuenta autenticada; si la imagen no está disponible, muestran la inicial del nombre.
- Dentro del panel, **Ctrl+K** (o ⌘K en Mac) abre la búsqueda rápida de secciones, módulos y comandos que existen en el registro del bot. Permite navegar con flechas y Enter. El buscador de la barra lateral también encuentra comandos por nombre o descripción y muestra un estado vacío claro cuando no hay resultados.
- La barra superior mantiene visible el servidor y la sección actuales; la carga del servidor muestra un estado de espera y el diseño adapta la búsqueda y la navegación a pantallas pequeñas.
- La demostración pública es ilustrativa; los valores reales se cargan mediante las API autenticadas del servidor seleccionado. Las rutas de la API conservan la comprobación de permisos antes de cada operación.

## Login de Discord para el dashboard

En Discord Developer Portal, usa la misma aplicación del bot y registra esta URL como OAuth2 Redirect URI:

https://TU-DOMINIO/auth/callback

En `config.json`, configura:

- `discord.clientId` — ID de la aplicación Discord.
- `dashboard.clientSecret` — OAuth2 Client Secret de esa aplicación.
- `dashboard.sessionSecret` — secreto aleatorio de al menos 32 caracteres.
- `dashboard.redirectUri` — callback exacto registrado, por ejemplo `https://TU-DOMINIO/auth/callback`; usa `auto` para localhost o para `APP_URL`.

En local, registra `http://localhost:3000/auth/callback` como Redirect URI. Solo `PORT` y `APP_URL` se leen del entorno de FadeHost; los tokens y demás ajustes se cargan de `config.json`. Mantén todos los secretos privados. No compartas `config.json` ni subas credenciales al repositorio.

Los usuarios inician sesión con su cuenta de Discord. Solo aparecen servidores donde el usuario tiene Administrar servidor o Administrador y donde el bot está instalado. Antes de cada operación, el bot vuelve a comprobar los permisos actuales.

## Funciones conectadas

- Secciones propias para cada categoría registrada por el bot, con pestañas para configurar, ejecutar acciones y consultar el estado; la pantalla Explorar funciones muestra el directorio de módulos.
- Formularios con las opciones reales de los comandos y vista previa en vivo. Bienvenidas, Salidas, Autoroles, Tickets y Verificación tienen editores directos que guardan en la configuración utilizada por los eventos del bot. Aplicaciones y Niveles cargan los valores existentes en sus herramientas de módulo.
- Ejecución de comandos a través de los handlers existentes, con su permiso declarado y respuestas mostradas en el dashboard. Los mensajes públicos opcionales se pueden enviar a un canal elegido.
- Formularios y modales de comandos compatibles, además de los paneles que el bot publica en Discord con botones interactivos.
- Música: búsqueda, reproducción, cola, pausa, siguiente, detener, mezclar, volumen, repetición, filtros, autoplay y canal de voz guardado en MongoDB.
- Personalización por servidor: nombre, descripción, logo, color, densidad y módulos visibles, con una vista previa de identidad y navegación.
- Configuración general del bot con vista previa: color de embeds, moneda, XP, mensajes de nivel, límite de advertencias y umbrales antiraid. Las demás funciones se administran desde su sección en el menú.

### Formatos de mensajes y vista previa

Los editores de Bienvenidas, Salidas, Tickets, Verificación y Postulaciones permiten elegir **Embed, Components V2, Card PNG o Texto normal** por servidor. La elección cambia el mensaje enviado por el bot y su vista previa en vivo. Los botones y menús interactivos de tickets, verificación y postulaciones se conservan. Las bienvenidas y salidas usan el formato al producirse el siguiente evento; los paneles se publican de nuevo para adoptar un formato distinto. La publicación de cards requiere el permiso **Adjuntar archivos** en el canal. La card dibuja título, descripción, color y pie; las URL de imágenes externas se muestran en Embed, Components V2 o Texto normal, pero no se incrustan en el PNG.

Otros mensajes del bot siguen usando su formato actual mientras se adaptan sus editores y envíos específicos. Los controles de roles, música, límites y permisos muestran una vista previa del efecto de su configuración, sin selector de formato de mensaje porque no publican ese contenido.

### Mejoras tras revisar el recorrido de la dashboard

- Cumpleaños y Respuestas automáticas tienen ahora editores visuales propios. Sus cuatro formatos se guardan por servidor y se usan en el envío real del bot. Cumpleaños permite configurar canal y texto con `{users}` y `{server}`; Respuestas automáticas permite añadir, editar y eliminar disparadores.
- Las pantallas de comandos muestran todas las funciones de la pestaña en una barra visible. El panel lateral distingue un mensaje de Discord de un ajuste del servidor. En configuración se muestran valores y efectos previstos; no se exige un canal adicional para guardar ajustes.
- Los selectores de canales filtran texto, voz o categoría según la opción. Las acciones que usan el canal actual aún lo solicitan cuando hace falta. Algunas acciones que dependen del contexto de un ticket solo pueden usarse dentro de Discord.
- Se corrigieron los resúmenes guardados de canales de voz, contador, estadísticas, paneles de roles y logs. El color por defecto de nuevos servidores es rojo; los colores elegidos anteriormente por cada servidor se conservan.

## Música

Se conservan hasta cinco reproductores; configura sus tokens y estados en `music.players` dentro de `config.json`. La voz y las fuentes de audio deben estar disponibles en el host. El archivo `yt-dlp.exe` incluido es para Windows; en Linux instala `yt-dlp` o establece `music.ytDlpPath` con la ruta del binario.

## Otras opciones

Las claves opcionales de Pexels y OpenAI están en `integrations`; el estado rotativo del bot se configura en `identity`; el color, imagen, ejecutable de yt-dlp y canales fijos de música están en `music`. Consulta `config.example.json` para ver la estructura completa.

## Notas del proyecto

- Los datos anteriores de db.json se importan a MongoDB cuando la base está vacía y el archivo está disponible.
- Las preferencias del dashboard y el canal de voz musical quedan en el documento del servidor existente.
- El HTML del dashboard está en src/dashboard/public/index.html y se sirve desde el mismo proceso del bot.
- El comando /links ver muestra el enlace de invitación del bot.
