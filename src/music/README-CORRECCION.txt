KUBOQ - Corrección del módulo de música

1. Copia el contenido de esta carpeta a Club 24-7/src/music/ y reemplaza index.js.
2. Mantén la estructura src/music/index.js, guide.png, panel-custom.png y yt-dlp.exe.
3. Ejecuta npm start desde la raíz de Club 24-7.

Correcciones:
- ensureYtDlp estaba declarada dentro de installMusic y no era visible desde initMusic.
- Se cerró installMusic antes de definir ensureYtDlp.
- Sin carpeta icons, el bot usa emojis Unicode de respaldo sin imprimir 15 errores.
- Se corrigió la referencia /panel en el texto de ayuda a /musicpanel.

NOTAS:
- No se han probado llamadas reales a Discord, YouTube o voz.
- Si el bot tiene otro comando /play, puede existir conflicto de nombres.
- yt-dlp.exe es un ejecutable suministrado por el usuario; verifica su procedencia antes de ejecutarlo.
