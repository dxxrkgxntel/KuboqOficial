# Kuboq — Windows local + FadeHost usando config.json

El bot, la dashboard y los reproductores se configuran **exclusivamente en `config.json`**. No usa archivos `.env` ni necesita declarar tokens en las variables del panel de FadeHost. `config.json` está incluido con campos vacíos; **rellénalo de forma privada** antes de usarlo y **nunca lo publiques en GitHub o enlaces abiertos**. El `.gitignore` excluye `config.json`.

## Configuración común (obligatoria)

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

La dashboard está protegida por OAuth2 de Discord. Sin `clientSecret`, `sessionSecret` y URL callback configurados no permitirá el inicio de sesión, aunque el bot pueda arrancar.

## Iniciar en tu PC con Windows

1. Instala Node.js 22+ y asegúrate de disponer de una MongoDB accesible.
2. Descomprime el ZIP completo. Edita `config.json` y deja `dashboard.redirectUri` en `auto` (se resuelve a `http://localhost:3000/auth/callback` si el puerto es 3000).
3. En Discord Developer Portal → OAuth2, registra exactamente `http://localhost:3000/auth/callback`.
4. Haz doble clic en **INICIAR-LOCAL.bat** (instala dependencias si no están). Alternativamente, abre PowerShell en la carpeta y ejecuta `npm ci`, luego `npm start`.
5. Abre `http://localhost:3000/dashboard`.

Para escuchar desde otro dispositivo de tu red, configura el firewall y `dashboard.host=0.0.0.0`, teniendo en cuenta que el callback de OAuth2 sigue ligado a la URL que has registrado.

## Iniciar en FadeHost (Linux)

1. Crea una aplicación Node.js **22+** con servicio web; sube el contenido del proyecto y edita su **`config.json`** usando el gestor de archivos de FadeHost. No subas la configuración privada a repositorios públicos.
2. Deja `dashboard.redirectUri` en `auto` **si FadeHost proporciona `APP_URL`**; de lo contrario, coloca `https://TU-DOMINIO/auth/callback` en `dashboard.redirectUri`. Registra esa URL en Discord Developer Portal → OAuth2.
3. FadeHost suele asignar el puerto mediante `PORT`; se admite **solo esa variable automática de infraestructura** aunque todos los tokens y demás ajustes se lean de `config.json`. Si FadeHost entrega `APP_URL`, se utiliza únicamente como callback automático cuando `dashboard.redirectUri` se deja vacío.
4. Instala dependencias con `npm ci` e inicia con `npm start` (o `sh INICIAR-LINUX.sh`).
5. Para reproducir música en un Linux sin `yt-dlp`, instala el binario Linux o colócalo en una ruta accesible y establece `music.ytDlpPath` a esa ruta. **El `.exe` incluido solo sirve para Windows**. `ffmpeg-static` aporta FFmpeg como dependencia.
6. Abre `https://TU-DOMINIO/dashboard`.

### Si cambias entre local y FadeHost

Ambos pueden utilizar **el mismo `config.json`** si `dashboard.redirectUri` es `auto` y FadeHost proporciona `APP_URL`; registra **ambos callbacks** en Discord Developer Portal. Si FadeHost no proporciona `APP_URL`, configura manualmente la URL de FadeHost y utiliza copias privadas separadas de `config.json`. No debes utilizar a la vez el mismo token de Discord en dos instancias activas del mismo bot.

### Pruebas y seguridad

- Ejecuta `npm run check` para la sintaxis y pruebas de integración sin servicios externos.
- Ruta `/health` para revisión básica del servidor web.
- No se incluyen credenciales reales. No expongas `config.json` desde un servidor de archivos estáticos; el servidor de esta dashboard solamente publica su subcarpeta `src/dashboard/public`.
- Los cambios por servidor desde la dashboard se guardan en MongoDB, no reescriben `config.json` (que contiene la configuración global).
- La prueba de bot real requiere tokens y una MongoDB operativa. No puede completarse en un entorno sin estas credenciales.
