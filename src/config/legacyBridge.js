'use strict';
// Compatibilidad interna: integra los valores de config.json en el código legado; no carga .env.
function installEnvironment(config) {
  const values = {
    DISCORD_TOKEN: config.discord.token,
    TOKEN: config.discord.token,
    CLIENT_ID: config.discord.clientId,
    MONGODB_URI: config.mongodb.uri,
    MONGODB_DB: config.mongodb.database || 'club247',
    DB_PATH: config.mongodb.importPath || './db.json',
    BOT_ESTADO_SEG: config.identity?.rotationSeconds || 15,
    PEXELS_KEY: config.integrations?.pexelsKey || '',
    OPENAI_API_KEY: config.integrations?.openaiKey || '',
    IA_MODEL: config.integrations?.imageModel || 'gpt-image-1',
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) process.env[key] = String(value);
  }
}
module.exports = { installEnvironment };
