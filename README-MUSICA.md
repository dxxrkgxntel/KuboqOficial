# Kuboq + Wanasy Music — integración en un solo bot

El módulo de música comparte el **mismo cliente Discord** y el mismo token de Kuboq. No ejecutes el bot Wanasy por separado.

## Instalación
1. Conserva tu `config.json` privado del proyecto anterior, y agrega el bloque `music` de `config.example.json`. No compartas tokens ni URI de MongoDB.
2. `npm install` (se añadieron `ffmpeg-static` y `yt-search`).
3. `npm run check`
4. `npm start`.
5. En Discord: `/musicpanel`, `/play`, `/skip`, `/stop`. Los botones y menús de música llevan el prefijo `music:` para evitar conflictos con Kuboq.

## Requisitos y limitaciones
- Intents de GuildVoiceStates (ya habilitado en Kuboq).
- El ejecutable incluido `src/music/yt-dlp.exe` es para Windows. En Linux configura `music.ytDlpPath` con una instalación local de yt-dlp.
- YouTube y las fuentes externas pueden fallar por cambios de sus servicios; no se puede garantizar la reproducción sin pruebas reales.
- El módulo conserva el estado de colas en memoria por servidor.
- Los comandos globales se actualizan al arrancar; Discord puede tardar en mostrarlos.
- `config.json` debe permanecer privado.
