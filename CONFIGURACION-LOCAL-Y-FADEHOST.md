# Kuboq — configuración local y despliegue en FadeHost

En Windows puedes configurar el bot en `config.json`. En FadeHost puedes usar las variables privadas del panel; el cargador las acepta y mantiene `config.json` como alternativa. Si una variable y `config.json` tienen el mismo dato, la variable tiene prioridad. Nunca publiques tokens ni secretos en GitHub.

## Configuración local mediante `config.json`

Abre `config.json` y configura:

- `discord.token`: token del bot principal desde Discord Developer Portal.
- `discord.clientId`: Application ID del bot.
- `mongodb.uri`: conexión MongoDB Atlas o MongoDB accesible desde el equipo/hosting.
- `mongodb.database`: nombre de la base (`club247` por defecto).
- `dashboard.clientSecret`: Client Secret OAuth2 de Discord.
- `dashboard.sessionSecret`: cadena aleatoria privada de **al menos 32 caracteres**, distinta del token del bot.
- `dashboard.redirectUri`: usa `auto` para deducir localhost o el dominio de `APP_URL` (si FadeHost lo proporciona); o coloca la **URL exacta** del callback si tu hosting no proporciona `APP_URL`. Registra la URL en Discord Developer Portal → OAuth2 → Redirects.
- `dashboard.port`: puerto local; predeterminado `3000`.
- `dashboard.host`: por defecto `0.0.0.0` (útil para FadeHost). Puedes usar `127.0.0.1` en local para no exponerlo a la red.
- `music.players`: hasta cinco bots musicales; deja el `token` vacío para los que no uses.
- `music.ytDlpPath`: `auto` detecta Windows (`yt-dlp.exe` incluido) o Linux (`yt-dlp` en PATH); para Linux también puedes dar una ruta absoluta a un binario Linux.
- `integrations.pexelsKey` e `integrations.openaiKey`: opcionales.

La dashboard está protegida por OAuth2 de Discord. Para iniciar sesión, configura `clientSecret`, `sessionSecret` y la URL callback en `config.json` o mediante las variables de FadeHost indicadas abajo.

## Variables de entorno para FadeHost

Añade estas variables en FadeHost → bot → Settings → Environment variables. No incluyas comillas alrededor de los valores:

```text
DISCORD_TOKEN=token_del_bot
DISCORD_CLIENT_ID=application_id_de_discord
MONGODB_URI=mongodb+srv://usuario:clave@cluster/...
MONGODB_DATABASE=club247
DASHBOARD_CLIENT_SECRET=oauth_client_secret
DASHBOARD_SESSION_SECRET=secreto_aleatorio_de_32_caracteres_o_mas
DASHBOARD_REDIRECT_URI=auto
```

FadeHost asigna `PORT` automáticamente y, cuando activas una dirección web, también `APP_URL`; no añadas esas dos manualmente. Al crear un bot, FadeHost puede entregar el token como `DISCORD_TOKEN`. El proyecto también acepta `BOT_TOKEN` o `TOKEN`.

Opcionales:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-image-1
PEXELS_API_KEY=...
MUSIC_1_TOKEN=...
MUSIC_2_TOKEN=...
```

Los reproductores musicales aceptan `MUSIC_1_TOKEN` hasta `MUSIC_5_TOKEN`; se activan al añadir un token. También puedes usar `MUSIC_1_ENABLED=false` para desactivar uno. No declares variables de servicios que no usas.

## Iniciar en tu PC con Windows

1. Instala Node.js 22+ y asegúrate de disponer de una MongoDB accesible.
2. Descomprime el ZIP completo. Edita `config.json` y deja `dashboard.redirectUri` en `auto` (se resuelve a `http://localhost:3000/auth/callback` si el puerto es 3000).
3. En Discord Developer Portal → OAuth2, registra exactamente `http://localhost:3000/auth/callback`.
4. Haz doble clic en **INICIAR-LOCAL.bat** (instala dependencias si no están). Alternativamente, abre PowerShell en la carpeta y ejecuta `npm ci`, luego `npm start`.
5. Abre `http://localhost:3000/dashboard`.

Para escuchar desde otro dispositivo de tu red, configura el firewall y `dashboard.host=0.0.0.0`, teniendo en cuenta que el callback de OAuth2 sigue ligado a la URL que has registrado.

## Iniciar en FadeHost (Linux)

1. En FadeHost, crea un bot desde **Bots → Host a bot → Discord bot** y conecta el repositorio GitHub, o selecciona **Upload your code**. Activa una dirección web en el bot para publicar la dashboard. Puedes desplegar el repositorio sin `config.json` si añades las variables requeridas de arriba.
2. Selecciona **Node.js 22** y configura `node index.js` como comando de inicio. FadeHost instala las dependencias según `package-lock.json`; no subas `node_modules`.
3. Añade las variables requeridas en Settings → Environment variables. Genera el secreto de sesión localmente con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` y copia el resultado en `DASHBOARD_SESSION_SECRET`.
4. Activa la dirección web de FadeHost y registra `https://TU-DOMINIO.fadehost.app/auth/callback` en Discord Developer Portal → OAuth2 → Redirects. Con `DASHBOARD_REDIRECT_URI=auto`, el proyecto crea el callback a partir de `APP_URL`.
5. En MongoDB Atlas, permite la conexión desde FadeHost y verifica las credenciales de `MONGODB_URI`.
6. La música en Linux necesita el ejecutable Linux `yt-dlp`; `yt-dlp.exe` solo sirve para Windows. El resto del bot y la dashboard pueden funcionar sin reproductores configurados.
7. Abre `https://TU-DOMINIO.fadehost.app/dashboard`.

### Si cambias entre local y FadeHost

En local puedes seguir usando `config.json` y en FadeHost las variables privadas. Registra ambos callbacks de OAuth2 si utilizas la dashboard en los dos lugares. No ejecutes a la vez dos instancias del mismo bot con el mismo token.

### Pruebas y seguridad

- Ejecuta `npm run check` para la sintaxis y pruebas de integración sin servicios externos.
- Ruta `/health` para revisión básica del servidor web.
- No se incluyen credenciales reales. No expongas `config.json` desde un servidor de archivos estáticos; el servidor de esta dashboard solamente publica su subcarpeta `src/dashboard/public`.
- Los cambios por servidor desde la dashboard se guardan en MongoDB, no reescriben `config.json` (que contiene la configuración global).
- La prueba de bot real requiere tokens y una MongoDB operativa. No puede completarse en un entorno sin estas credenciales.
