# Corrección de los dos avisos de inicio

1. achSweep: G(guildId) ahora inicializa de forma compatible los campos ausentes de registros heredados de MongoDB sin borrar datos válidos.
2. vozbot: la reconexión automática solo intenta entrar a servidores donde el bot aún figura conectado. Los ajustes de servidores antiguos se conservan, sin avisos repetidos cada minuto.

**Importante:** si el bot debe volver al servidor del aviso, invítalo de nuevo y revisa la configuración del canal con `/vozbot`. Este arreglo no puede darle acceso a servidores a los que no pertenece.

Para actualizar tu instalación, reemplaza el código por esta versión, conserva tu propio `config.json` con credenciales y reinicia. No reemplaces tus credenciales con las del archivo de ejemplo.

Validaciones: `npm run check` — 7 tests superados. No se ha conectado a tu cuenta de Discord ni MongoDB.
