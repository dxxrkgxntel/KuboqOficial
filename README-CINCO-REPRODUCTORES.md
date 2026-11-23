# Kuboq — 5 reproductores de música

## Arquitectura

- `src/legacy/runtime.js`: cliente principal de Kuboq, comandos y MongoDB sin dashboard.
- `src/music/index.js`: panel, búsquedas, colas, filtros y reproducción mediante yt-dlp -> FFmpeg -> Discord.
- `src/music/playerPool.js`: inicia hasta cinco clientes Discord separados y reserva un reproductor por canal. Un reproductor solo atiende una sesión a la vez; si todos están ocupados, se informa el error.
- `src/music/mainVoice.js`: conecta al bot principal al canal configurado sin enviar audio. `/stop` libera al reproductor, pero no desconecta a Kuboq.

## Configuración privada

En `config.json`, completa `discord.token` (bot principal), `mongodb.uri`, y los cinco tokens en `music.players` (uno por aplicación). **No publiques config.json ni los tokens.** `config.json` está en `.gitignore`; el ZIP se entrega con valores vacíos.

Cada reproductor debe ser una **aplicación de bot distinta** creada por ti en Discord Developer Portal. Invita los cinco bots a los servidores donde quieras reproducir audio. Permisos: Ver canal, Conectar y Hablar; no requieren permisos de administrador. Los reproductores no registran comandos ni requieren intents privilegiados. El bot principal sí necesita los permisos/intents de sus módulos existentes.

`music.guildChannels` admite asignaciones persistentes: `"ID_SERVIDOR": "ID_CANAL_VOZ"`. En cada inicio Kuboq intentará conectarse a esos canales. Alternativamente, `/musicvoice canal:#voz` fija el canal en memoria hasta reiniciar. Para persistirlo, copia su ID a `config.json`. Si no hay canal configurado, se utiliza el canal de voz del usuario que solicita música.

## Requisitos de hosting

Node.js 22+, acceso saliente a Discord, MongoDB, YouTube y GitHub para la instalación inicial de yt-dlp, además de FFmpeg compatible con el sistema operativo. El ZIP contiene `yt-dlp.exe` para Windows: en Linux debes instalar `yt-dlp` y configurar `music.ytDlpPath` con su ruta o dejarlo en PATH. `ffmpeg-static` proporciona FFmpeg para plataformas soportadas. El plan de FadeHost debe permitir **seis sesiones de bot Discord dentro de un mismo proceso** y suficiente RAM/CPU. No se ha verificado el plan ni la ejecución real.

## Flujo de uso y comprobación futura

1. `npm ci` y `npm run check`.
2. Configura los seis tokens y MongoDB; invita los cinco reproductores a tu servidor.
3. `npm start`.
4. Ejecuta `/musicvoice` para fijar el canal y `/musicpanel` o `/play` para iniciar música.
5. Comprueba que Kuboq permanece conectado sin reproducir y que **solo un** bot Music reproduce en ese canal.
6. Prueba `/skip`, `/stop`, pausa, filtros y reproducción simultánea en diferentes servidores; verifica que al detener la música el reproductor queda libre y Kuboq permanece.

## Límites

- La exclusión mutua aplica a los cinco reproductores gestionados por **esta instancia**. No puede impedir que otros bots externos reproduzcan en el mismo canal ni coordinar múltiples copias del proyecto sin un bloqueo distribuido.
- Los estados de colas y reservas se mantienen en memoria; se pierden al reiniciar.
- La configuración por `/musicvoice` es temporal hasta guardarla en `config.json`.
- yt-dlp puede fallar por cambios o restricciones de YouTube; un inicio correcto no garantiza audio.
- No se han ejecutado conexiones reales ni pruebas en FadeHost.
