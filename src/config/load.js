'use strict';
/** Configuración para Windows local y hosting.
 *  En local admite config.json; en FadeHost las credenciales pueden llegar por variables seguras.
 */
const fs = require('node:fs');
const path = require('node:path');
const projectRoot = path.resolve(__dirname, '../..');
const configPath = path.join(projectRoot, 'config.json');
let cfg = {};
if (fs.existsSync(configPath)) {
  try { cfg = require(configPath); }
  catch (error) { throw new Error(`No se pudo leer config.json: ${error.message}`); }
}
if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new Error('config.json debe contener un objeto JSON.');
const objectSetting = (key) => {
  if (cfg[key] == null) cfg[key] = {};
  if (typeof cfg[key] !== 'object' || Array.isArray(cfg[key])) throw new Error(`config.json: "${key}" debe ser un objeto.`);
  return cfg[key];
};
const stringSetting = (object, key, label) => {
  if (object[key] != null && typeof object[key] !== 'string') throw new Error(`config.json: "${label}" debe ser texto.`);
  return String(object[key] || '').trim();
};
const discord = objectSetting('discord');
const mongodb = objectSetting('mongodb');
const identity = objectSetting('identity');
const integrations = objectSetting('integrations');
const music = objectSetting('music');
const dashboard = objectSetting('dashboard');
const envString = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return undefined;
};
const envOverride = (object, property, ...names) => {
  const value = envString(...names);
  if (value !== undefined) object[property] = value;
};

envOverride(discord, 'token', 'DISCORD_TOKEN', 'BOT_TOKEN', 'TOKEN');
envOverride(discord, 'clientId', 'DISCORD_CLIENT_ID', 'CLIENT_ID');
envOverride(mongodb, 'uri', 'MONGODB_URI', 'MONGO_URI');
envOverride(mongodb, 'database', 'MONGODB_DATABASE', 'MONGODB_DB');
envOverride(dashboard, 'clientSecret', 'DASHBOARD_CLIENT_SECRET');
envOverride(dashboard, 'sessionSecret', 'DASHBOARD_SESSION_SECRET');
envOverride(dashboard, 'redirectUri', 'DASHBOARD_REDIRECT_URI');
envOverride(integrations, 'pexelsKey', 'PEXELS_API_KEY', 'PEXELS_KEY');
envOverride(integrations, 'openaiKey', 'OPENAI_API_KEY');
envOverride(integrations, 'imageModel', 'OPENAI_MODEL', 'IA_MODEL');

discord.token = stringSetting(discord, 'token', 'discord.token');
discord.clientId = stringSetting(discord, 'clientId', 'discord.clientId');
mongodb.uri = stringSetting(mongodb, 'uri', 'mongodb.uri');
mongodb.database = stringSetting(mongodb, 'database', 'mongodb.database') || 'club247';
mongodb.importPath = stringSetting(mongodb, 'importPath', 'mongodb.importPath') || './db.json';
identity.name = stringSetting(identity, 'name', 'identity.name') || 'Kuboq';
identity.color = stringSetting(identity, 'color', 'identity.color') || '#8B5CF6';
if (!/^#?[0-9a-f]{6}$/i.test(identity.color)) throw new Error('config.json: "identity.color" debe ser un color hexadecimal de 6 caracteres.');
identity.description = stringSetting(identity, 'description', 'identity.description');
identity.logoUrl = stringSetting(identity, 'logoUrl', 'identity.logoUrl');
if (identity.logoUrl && !/^https?:\/\//i.test(identity.logoUrl)) throw new Error('config.json: "identity.logoUrl" debe ser una URL http o https.');
identity.rotationSeconds = Number(identity.rotationSeconds || 15);
if (!Number.isInteger(identity.rotationSeconds) || identity.rotationSeconds < 1 || identity.rotationSeconds > 86400)
  throw new Error('config.json: "identity.rotationSeconds" debe ser un entero entre 1 y 86400.');
if (identity.defaultStatus != null && (!Array.isArray(identity.defaultStatus) || identity.defaultStatus.some(x => typeof x !== 'string')))
  throw new Error('config.json: "identity.defaultStatus" debe ser una lista de textos.');
const defaultStatus = identity.defaultStatus?.map(x => x.trim()).filter(Boolean) || [];
identity.defaultStatus = defaultStatus.length ? defaultStatus : ['Kuboq'];
integrations.imageModel = stringSetting(integrations, 'imageModel', 'integrations.imageModel') || 'gpt-image-1';
integrations.pexelsKey = stringSetting(integrations, 'pexelsKey', 'integrations.pexelsKey');
integrations.openaiKey = stringSetting(integrations, 'openaiKey', 'integrations.openaiKey');

if (music.players == null) music.players = [];
if (!Array.isArray(music.players)) throw new Error('config.json: "music.players" debe ser una lista.');
for (let i = 0; i < 5; i++) {
  if (music.players[i] == null) music.players[i] = { name: `Music ${i+1}`, token: '', enabled: false };
  const player = music.players[i];
  if (typeof player !== 'object' || Array.isArray(player)) throw new Error(`config.json: "music.players[${i}]" debe ser un objeto.`);
  player.name = stringSetting(player, 'name', `music.players[${i}].name`) || `Music ${i+1}`;
  player.token = stringSetting(player, 'token', `music.players[${i}].token`);
  if (player.enabled != null && typeof player.enabled !== 'boolean') throw new Error(`config.json: "music.players[${i}].enabled" debe ser true o false.`);
  player.enabled ??= false;
  const playerToken = envString(`MUSIC_${i+1}_TOKEN`, `MUSIC_PLAYER_${i+1}_TOKEN`);
  const playerEnabled = envString(`MUSIC_${i+1}_ENABLED`, `MUSIC_PLAYER_${i+1}_ENABLED`);
  if (playerToken !== undefined) { player.token = playerToken; if (playerEnabled === undefined) player.enabled = true; }
  if (playerEnabled !== undefined) {
    if (!['true','1','yes','on','false','0','no','off'].includes(playerEnabled.toLowerCase())) throw new Error(`MUSIC_${i+1}_ENABLED debe ser true o false.`);
    player.enabled = ['true','1','yes','on'].includes(playerEnabled.toLowerCase());
  }
}
if (music.guildChannels != null && (typeof music.guildChannels !== 'object' || Array.isArray(music.guildChannels)))
  throw new Error('config.json: "music.guildChannels" debe ser un objeto.');
music.guildChannels ??= {};
music.accentColor = stringSetting(music, 'accentColor', 'music.accentColor') || '#8B5CF6';
if (!/^#?[0-9a-f]{6}$/i.test(music.accentColor)) throw new Error('config.json: "music.accentColor" debe ser un color hexadecimal de 6 caracteres.');
music.panelImageUrl = stringSetting(music, 'panelImageUrl', 'music.panelImageUrl');
if (music.panelImageUrl) {
  try {
    const imageUrl = new URL(music.panelImageUrl);
    if (!['http:', 'https:'].includes(imageUrl.protocol)) throw new Error();
  } catch { throw new Error('config.json: "music.panelImageUrl" debe ser una URL http o https válida.'); }
}

const platform = process.platform;
const configuredYtdlp = stringSetting(music, 'ytDlpPath', 'music.ytDlpPath');
// La ruta Windows no sirve en FadeHost/Linux. En Linux buscar en el PATH por defecto.
if ((!configuredYtdlp || configuredYtdlp.toLowerCase() === 'auto') || (platform !== 'win32' && /(?:^|[/\\])yt-dlp\.exe$/i.test(configuredYtdlp))) {
  music.ytDlpPath = platform === 'win32' ? path.join(projectRoot, 'src/music/yt-dlp.exe') : 'yt-dlp';
} else if (configuredYtdlp.startsWith('./') || configuredYtdlp.startsWith('.\\')) {
  music.ytDlpPath = path.resolve(projectRoot, configuredYtdlp);
} else {
  music.ytDlpPath = configuredYtdlp;
}

// Solo excepciones necesarias para integrarse con un hosting que asigna puerto y dominio.
const assignedPort = Number(process.env.PORT);
dashboard.port = Number.isInteger(assignedPort) && assignedPort > 0 && assignedPort <= 65535
  ? assignedPort : Number(dashboard.port || 3000);
if (!Number.isInteger(dashboard.port) || dashboard.port < 1 || dashboard.port > 65535)
  throw new Error('dashboard.port debe ser un puerto válido entre 1 y 65535.');
dashboard.host = stringSetting(dashboard, 'host', 'dashboard.host') || '0.0.0.0';
const appUrl = String(process.env.APP_URL || '').trim();
const redirectSetting = stringSetting(dashboard, 'redirectUri', 'dashboard.redirectUri');
if (!redirectSetting || redirectSetting.toLowerCase() === 'auto') {
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Protocolo no permitido.');
      dashboard.redirectUri = new URL('/auth/callback', parsed).href;
    } catch { throw new Error('APP_URL del hosting debe ser una URL http o https válida.'); }
  } else {
    dashboard.redirectUri = `http://localhost:${dashboard.port}/auth/callback`;
  }
} else {
  try {
    const parsed = new URL(redirectSetting);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Protocolo no permitido.');
    dashboard.redirectUri = parsed.href;
  } catch { throw new Error('dashboard.redirectUri debe ser una URL http o https válida.'); }
}
dashboard.clientSecret = stringSetting(dashboard, 'clientSecret', 'dashboard.clientSecret');
dashboard.sessionSecret = stringSetting(dashboard, 'sessionSecret', 'dashboard.sessionSecret');
module.exports = cfg;
