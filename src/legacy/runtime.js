/* =====================================================================
   BOT DISCORD ALL-IN-ONE · 175 comandos · discord.js v14 · Node 22+
   Instalar:  npm i discord.js
   Ejecutar:  TOKEN=tu_token node index.js
   Intents a activar en el Developer Portal: Server Members, Message Content, Presence no necesario.
   Los 150 comandos van como subcomandos (Discord limita a 100 comandos raíz):
   /verif /seg /mod /log /nivel /eco /logro /anuncio /autorole /ticket /invite /util /bienvenida
   ===================================================================== */
const config = require('../config/load');
const { installEnvironment } = require('../config/legacyBridge');
installEnvironment(config);
const fs = require('fs');
const path = require('node:path');
const {
  Client, GatewayIntentBits: GI, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, PermissionFlagsBits: P,
  ChannelType, AttachmentBuilder, AuditLogEvent, UserSelectMenuBuilder, StringSelectMenuBuilder,
  ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, TextDisplayBuilder, SeparatorSpacingSize,
  SectionBuilder, ThumbnailBuilder, LabelBuilder, FileUploadBuilder, CheckboxBuilder,
} = require('discord.js');

const TOKEN = config.discord.token;
if (!TOKEN) { console.error('Falta discord.token en config.json'); process.exit(1); }
const client = new Client({
  intents: [GI.Guilds, GI.GuildMembers, GI.GuildMessages, GI.MessageContent, GI.GuildModeration,
    GI.GuildInvites, GI.GuildVoiceStates, GI.GuildMessageReactions, GI.DirectMessages, GI.GuildEmojisAndStickers, GI.GuildWebhooks, GI.GuildIntegrations, GI.GuildScheduledEvents, ...[GI.GuildMessagePolls].filter(Boolean)],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
const eventHandler = require('../handlers/eventHandler').createEventHandler(client);
const music = require('../music');
music.installMusic(client, {
  saveChannel(guildId, channelId) {
    const cf = C(guildId);
    if (channelId) { cf.musicChannelId = channelId; delete cf.musicChannelDisabled; }
    else { delete cf.musicChannelId; cf.musicChannelDisabled = true; }
    delete cf.c247;
    save();
  },
});
const { dashboardServer } = require('../dashboard/server');
const { buildMessage, validFormat } = require('../services/messageFormats');
let dashboard = null;
const START = Date.now();
let shutdownPromise = null;

/* ============================ BASE DE DATOS (MongoDB) ============================ */
// Toda la configuración y los datos (servidores, usuarios, XP, monedas, tickets, bienvenida...) se guardan en MongoDB.
// Al arrancar se carga todo a memoria, así los comandos siguen usando DB[servidorId] como antes.
// Cada cambio (save()) se escribe en MongoDB unos segundos después, solo en los servidores que cambiaron.
// En config.json: mongodb.uri (obligatorio) y mongodb.database (opcional).
const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGODB_URI;
const MONGO_NOMBRE = process.env.MONGODB_DB || 'club247';
let DB = {};                    // se rellena desde MongoDB antes de conectar con Discord (no reasignar: extras.js guarda esta referencia)
let mongo = null, mdb = null;   // cliente y base de MongoDB
let dbListo = false;            // true cuando la base ya está cargada y se puede escribir
let dirty = false;              // hay cambios pendientes de escribir
let ESTADO_FRASES = [];         // frases del "Jugando" del bot (/util estado)
const guardadoJSON = new Map(); // servidorId -> último JSON escrito en MongoDB (así solo se escribe lo que cambia)
let colaGuardado = Promise.resolve();

async function conectarMongo() {
  if (!MONGO_URI) throw new Error('Falta mongodb.uri en config.json');
  mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await mongo.connect();
  mdb = mongo.db(MONGO_NOMBRE);
  await mdb.collection('actividad').createIndex({ guildId: 1, fecha: -1 });
  await mdb.collection('actividad').createIndex({ userId: 1, fecha: -1 });
}

// Primera vez con MongoDB vacía: se importa el db.json que ya tenías, así no se pierde nada
function leerJSONViejo() {
  const projectRoot = path.resolve(__dirname, '../..');
  for (const r of [process.env.DB_PATH, './db.json', './data/db.json', '/data/db.json'].filter(Boolean)) {
    const base = path.isAbsolute(r) ? r : path.resolve(projectRoot, r);
    for (const f of [base, `${base}.bak`]) {
      try { if (fs.existsSync(f)) return { ruta: f, datos: JSON.parse(fs.readFileSync(f, 'utf8')) }; } catch {}
    }
  }
  return null;
}
async function cargarBase() {
  const docs = await mdb.collection('servidores').find({}).toArray();
  if (!docs.length) {
    const viejo = leerJSONViejo();
    if (viejo?.datos && typeof viejo.datos === 'object') {
      for (const [id, g] of Object.entries(viejo.datos)) DB[id] = g;
      dirty = true;
      console.log(`[db] MongoDB estaba vacía: importé ${Object.keys(DB).length} servidores desde ${viejo.ruta}`);
    }
  }
  for (const d of docs) { DB[d._id] = d.datos; guardadoJSON.set(d._id, JSON.stringify(d.datos)); }
  ESTADO_FRASES = (await mdb.collection('global').findOne({ _id: 'estado' }))?.frases ?? [];
  dbListo = true;
  console.log(`[db] MongoDB "${MONGO_NOMBRE}" lista · servidores guardados: ${Object.keys(DB).length}`);
}

async function hacerGuardado() { // escribe en MongoDB solo los servidores cuyo contenido cambió desde la última vez
  if (!dbListo) return;
  const ops = [], nuevos = new Map(), ahora = new Date();
  for (const id of Object.keys(DB)) {
    const json = JSON.stringify(DB[id]);
    if (guardadoJSON.get(id) === json) continue;
    ops.push({ replaceOne: { filter: { _id: id }, replacement: { _id: id, datos: DB[id], actualizado: ahora }, upsert: true } });
    nuevos.set(id, json);
  }
  if (!ops.length) return;
  try {
    await mdb.collection('servidores').bulkWrite(ops, { ordered: false });
    for (const [id, json] of nuevos) guardadoJSON.set(id, json);
  } catch (err) { console.error('[db] No pude guardar en MongoDB:', err.message); dirty = true; } // se reintenta en el siguiente ciclo
}
// Las escrituras van una detrás de otra, así nunca se pisan entre sí
const guardarAhora = () => (colaGuardado = colaGuardado.then(hacerGuardado, hacerGuardado));
setInterval(() => { if (dirty && dbListo) { dirty = false; guardarAhora(); } }, 1500); // guarda casi al instante cada cambio

async function apagar(codigo = 0, motivo = '') { // guarda y cierra dependencias antes de salir
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    if (motivo) console.error(`[shutdown] ${motivo}`);
    try { await dashboard?.close(); } catch (err) { console.error('[shutdown] dashboard:', err.message); }
    try { await music.shutdownMusic(); } catch (err) { console.error('[shutdown] música:', err.message); }
    try { client.destroy(); } catch (err) { console.error('[shutdown] Discord:', err.message); }
    try {
      if (dbListo) { dirty = true; await guardarAhora(); }
      await mongo?.close();
    } catch (err) { console.error('[shutdown] MongoDB:', err.message); }
    process.exit(codigo);
  })();
  return shutdownPromise;
}
process.once('SIGINT', () => { void apagar(0, 'Señal SIGINT recibida.'); });
process.once('SIGTERM', () => { void apagar(0, 'Señal SIGTERM recibida.'); });
const dbPronta = conectarMongo().then(cargarBase);
const IGN_ERR = new Set([10062, 40060, 10008, 10003]); // errores de Discord sin solución posible (interacción caducada, ya respondida, mensaje/canal borrado)
process.on('unhandledRejection', e => {
  if (IGN_ERR.has(e?.code) || shutdownPromise) return;
  console.error('[rechazo no controlado]', e);
});
process.on('uncaughtException', e => {
  if (shutdownPromise) return;
  console.error('[error no controlado]', e);
  void apagar(1, 'Excepción sin gestionar.');
});
const save = () => (dirty = true);
// Texto de "Jugando" del perfil del bot: se cambia con /util estado y se guarda en MongoDB (colección "global")
const estadoBot = () => ESTADO_FRASES;
const guardarEstado = frases => { ESTADO_FRASES = frases; return mdb.collection('global').updateOne({ _id: 'estado' }, { $set: { frases } }, { upsert: true }); };
/* ---- Registro de actividad: cada comando, botón o formulario que usas queda guardado en MongoDB (colección "actividad") ---- */
function registrarActividad(i, tipo, datos = {}) {
  if (!dbListo) return;
  mdb.collection('actividad').insertOne({ guildId: i.guildId ?? null, userId: i.user?.id ?? null, usuario: i.user?.username ?? null, tipo, ...datos, fecha: new Date() })
    .catch(err => console.error('[actividad] no pude guardar:', err.message));
}
const valorOpcion = v => v == null ? null : typeof v === 'object' ? (v.id ?? null) : typeof v === 'string' ? v.slice(0, 500) : v;
/* ---- Catálogo de logros: rareza, categoría, puntos, forma e icono de la tarjeta ---- */
const RAR = { comun: { n: 'Común', c: '#7c8cff', p: 5 }, poco: { n: 'Poco común', c: '#8b3dff', p: 10 }, raro: { n: 'Raro', c: '#8b3dff', p: 20 },
  epico: { n: 'Épico', c: '#d946ef', p: 40 }, legendario: { n: 'Legendario', c: '#ffb703', p: 75 } };
const ACAT = { chat: ['💬', 'Chat', 'circle', 'chat'], nivel: ['⭐', 'Nivel', 'shield', 'star'], eco: ['💰', 'Economía', 'circle', 'coin'], inv: ['📨', 'Invitaciones', 'hex', 'mail'],
  voz: ['🎙️', 'Voice', 'shield', 'mic'], cam: ['📷', 'Cámara', 'circle', 'camera'], stream: ['🖥️', 'Stream', 'hex', 'screen'], leal: ['🏅', 'Lealtad', 'shield', 'calendar'] };
const TYPE_CAT = { msgs: 'chat', lvl: 'nivel', coins: 'eco', invites: 'inv', vmin: 'voz', mic: 'voz', micon: 'voz', cam: 'cam', camon: 'cam', strm: 'stream', stron: 'stream', days: 'leal', acct: 'leal' };
const achMeta = a => {
  const cat = ACAT[a.cat] ? a.cat : TYPE_CAT[a.type] || 'chat', c = ACAT[cat], rar = RAR[a.rar] ? a.rar : 'comun';
  return { cat, ce: c[0], cl: c[1], shape: a.shape || c[2], icon: a.icon || c[3], rar, rn: RAR[rar].n, color: RAR[rar].c, pts: a.pts ?? RAR[rar].p };
};
const defAch = () => [
  // Chat
  { id: 'a1', name: 'Primer paso', desc: 'Envía tu primer mensaje', emoji: '👶', type: 'msgs', value: 1, rar: 'comun' },
  { id: 'a2', name: 'Charlatán', desc: 'Envía 500 mensajes', emoji: '💬', type: 'msgs', value: 500, rar: 'poco' },
  { id: 'msg3', name: 'Leyenda del chat', desc: 'Envía 5,000 mensajes', emoji: '🗣️', type: 'msgs', value: 5000, rar: 'epico' },
  // Nivel / economía / invitaciones
  { id: 'a3', name: 'Veterano', desc: 'Llega al nivel 10', emoji: '⭐', type: 'lvl', value: 10, rar: 'poco' },
  { id: 'lvl2', name: 'Élite', desc: 'Llega al nivel 25', emoji: '🌟', type: 'lvl', value: 25, rar: 'raro' },
  { id: 'lvl3', name: 'Inmortal', desc: 'Llega al nivel 50', emoji: '👑', type: 'lvl', value: 50, rar: 'legendario' },
  { id: 'a4', name: 'Millonario', desc: 'Acumula 10,000 monedas', emoji: '💰', type: 'coins', value: 10000, rar: 'poco' },
  { id: 'eco2', name: 'Magnate', desc: 'Acumula 100,000 monedas', emoji: '💎', type: 'coins', value: 100000, rar: 'epico' },
  { id: 'a5', name: 'Reclutador', desc: 'Invita a 5 personas', emoji: '📨', type: 'invites', value: 5, rar: 'poco' },
  { id: 'inv2', name: 'Embajador', desc: 'Invita a 25 personas', emoji: '🤝', type: 'invites', value: 25, rar: 'raro' },
  // Voice: tiempo conectado
  { id: 'vz1', name: 'Primera llamada', desc: 'Pasa 10 minutos en un canal de voz', emoji: '🎧', type: 'vmin', value: 10, rar: 'comun' },
  { id: 'vz2', name: 'Conversador', desc: 'Pasa 60 minutos en canales de voz', emoji: '🗨️', type: 'vmin', value: 60, rar: 'poco' },
  { id: 'vz3', name: 'Habitual de voz', desc: 'Pasa 600 minutos en canales de voz', emoji: '🔊', type: 'vmin', value: 600, rar: 'raro' },
  { id: 'vz4', name: 'Residente de voz', desc: 'Pasa 3,000 minutos en canales de voz', emoji: '🏠', type: 'vmin', value: 3000, rar: 'epico' },
  { id: 'vz5', name: 'Alma del servidor', desc: 'Pasa 12,000 minutos en canales de voz', emoji: '🔥', type: 'vmin', value: 12000, rar: 'legendario' },
  // Micrófono
  { id: 'mc1', name: 'Se escucha', desc: 'Enciende tu micrófono por primera vez', emoji: '🎤', type: 'micon', value: 1, rar: 'comun' },
  { id: 'mc2', name: 'Voz de oro', desc: 'Pasa 300 minutos con el micrófono encendido', emoji: '🥇', type: 'mic', value: 300, rar: 'raro' },
  // Cámara
  { id: 'cm1', name: 'Cara a cara', desc: 'Enciende tu cámara por primera vez', emoji: '📷', type: 'camon', value: 1, rar: 'poco' },
  { id: 'cm2', name: 'Frente a la cámara', desc: 'Pasa 60 minutos con la cámara encendida', emoji: '🎬', type: 'cam', value: 60, rar: 'raro' },
  { id: 'cm3', name: 'Estrella de cámara', desc: 'Pasa 600 minutos con la cámara encendida', emoji: '🌟', type: 'cam', value: 600, rar: 'epico' },
  // Transmisión
  { id: 'st1', name: 'Primer directo', desc: 'Transmite tu pantalla por primera vez', emoji: '📡', type: 'stron', value: 1, rar: 'comun' },
  { id: 'st2', name: 'Streamer', desc: 'Transmite 600 minutos en voz', emoji: '🎥', type: 'strm', value: 600, rar: 'poco', icon: 'camera', shape: 'hex' },
  { id: 'st3', name: 'Streamer pro', desc: 'Transmite 3,000 minutos en voz', emoji: '🏆', type: 'strm', value: 3000, rar: 'epico', icon: 'trophy', shape: 'hex' },
  // Lealtad: días en el servidor y antigüedad de la cuenta
  { id: 'lt1', name: 'Nuevo vecino', desc: 'Cumple 7 días en el servidor', emoji: '🏡', type: 'days', value: 7, rar: 'comun' },
  { id: 'lt2', name: 'Miembro del mes', desc: 'Cumple 30 días en el servidor', emoji: '📅', type: 'days', value: 30, rar: 'poco' },
  { id: 'lt3', name: 'Fiel al servidor', desc: 'Cumple 90 días en el servidor', emoji: '💜', type: 'days', value: 90, rar: 'raro' },
  { id: 'lt4', name: 'Un año juntos', desc: 'Cumple 365 días en el servidor', emoji: '🎂', type: 'days', value: 365, rar: 'epico' },
  { id: 'lt5', name: 'Dos años juntos', desc: 'Cumple 730 días en el servidor', emoji: '🏛️', type: 'days', value: 730, rar: 'legendario' },
  { id: 'dv', name: 'Discord Veteran', desc: 'Ten una cuenta de Discord de 1,825 días', emoji: '⏰', type: 'acct', value: 1825, rar: 'raro', icon: 'clock', shape: 'shield' },
];
function migAch(g) { // servidores ya existentes: conserva lo que había y añade el catálogo nuevo
  const base = defAch(), old = new Map(base.map(a => [a.id, a])), have = new Set((g.ach || []).map(a => a.id));
  g.ach = [...(g.ach || []).map(a => (old.has(a.id) ? { ...old.get(a.id), ...a } : a)), ...base.filter(a => !have.has(a.id))]; g.achv2 = true;
}
const G = id => {
  if (!DB[id]) DB[id] = { cfg: {}, users: {}, warns: {}, items: [], ach: defAch(), achv2: true, achfill: false, autoroles: [], levelroles: {},
    invrew: {}, wl: [], badwords: [], tickets: {}, invby: {} };
  const g = DB[id];
  // Los registros importados de MongoDB pueden carecer de campos añadidos en versiones nuevas.
  // Completar solo los campos ausentes; nunca sobrescribir los datos existentes.
  if (!g.users || typeof g.users !== 'object' || Array.isArray(g.users)) g.users = {};
  if (!g.cfg || typeof g.cfg !== 'object' || Array.isArray(g.cfg)) g.cfg = {};
  if (!g.warns || typeof g.warns !== 'object' || Array.isArray(g.warns)) g.warns = {};
  if (!Array.isArray(g.ach)) g.ach = defAch();
  if (!Array.isArray(g.items)) g.items = [];
  if (!Array.isArray(g.autoroles)) g.autoroles = [];
  if (!g.levelroles || typeof g.levelroles !== 'object') g.levelroles = {};
  if (!g.invrew || typeof g.invrew !== 'object') g.invrew = {};
  if (!Array.isArray(g.wl)) g.wl = [];
  if (!Array.isArray(g.badwords)) g.badwords = [];
  if (!g.tickets || typeof g.tickets !== 'object') g.tickets = {};
  if (!g.invby || typeof g.invby !== 'object') g.invby = {};
  if (!g.achv2) migAch(g);
  return g;
};
const LVL_MSG = '{user} Has subido a **nivel {level}** ¡sigue activo en el servidor! ✨';
const LVL_OLD = '🎉 {user} subió al **nivel {level}**!';
const C = id => {
  const g = G(id);
  g.cfg = { color: '#ff3159', cur: '🪙', xprate: 15, lvlon: true, lvlmsg: LVL_MSG,
    achcolor: '#8b3dff', achlabel: '¡LOGRO DESBLOQUEADO!', achhead: '🎉 ¡{user} ha desbloqueado **{achievement}**! (+{points} puntos)',
    warnlimit: 3, raidn: 5, raidsec: 10, sec: {}, logch: {}, logoff: [], tk: { max: 1, n: 0, emb: {} },
    v: {}, vemb: {}, inv: {}, wb: {}, bye: {}, ...g.cfg };
  if (g.cfg.lvlmsg === LVL_OLD) g.cfg.lvlmsg = LVL_MSG; // migra el mensaje antiguo al nuevo
  return g.cfg;
};
const U = (gid, uid) => (G(gid).users[uid] ??= { xp: 0, lvl: 0, coins: 0, bank: 0, msgs: 0, inv: 0, left: 0, fake: 0,
  bonus: 0, ach: [], items: {}, cd: {} });

/* ============================== HELPERS ============================== */
const R = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const fn = n => Number(n).toLocaleString('es');
const need = l => 40 + 20 * l; // MÁS FÁCIL: nivel 1 = 40 XP, nivel 2 = 60 XP, nivel 10 = 240 XP...
const bar = (p, l = 14) => '█'.repeat(Math.round(p * l)) + '░'.repeat(l - Math.round(p * l));
const hex = s => (s && /^#?[0-9a-f]{6}$/i.test(s) ? parseInt(s.replace('#', ''), 16) : null);
const url = s => (s && /^https?:\/\//i.test(s) ? s : null);
const nl = s => s?.replace(/\\n/g, '\n');
const cd = (u, k, ms) => { const r = (u.cd[k] || 0) + ms - Date.now(); if (r > 0) return r; u.cd[k] = Date.now(); return 0; };
const when = ms => `<t:${Math.floor((Date.now() + ms) / 1000)}:R>`;
const fmt = (s, v) => s.replace(/{(\w+)}/g, (_, k) => v[k] ?? `{${k}}`);
const M = (i, u) => i.guild.members.fetch(u.id).catch(() => null);
const dm = (u, e) => u.send({ embeds: [e] }).catch(() => {});
const E = (gid, t, d, img) => {
  const e = new EmbedBuilder().setColor(C(gid).color).setTimestamp();
  if (t) e.setTitle(t); if (d) e.setDescription(d); if (url(img)) e.setImage(img); return e;
};
const say = (i, t, d, eph) => i.reply({ embeds: [E(i.guildId, t, d)], flags: eph ? 64 : undefined });
const ok = (i, d) => say(i, '✅ Listo', d, true); // respuestas de configuración: solo las ve quien usó el comando (Discord le pone 'Descartar mensaje')
const no = (i, d) => say(i, '❌ Error', d, true);
const hasRole = (m, id) => m.roles.cache.has(id);
const canTarget = (i, m) => m && (i.guild.ownerId === i.user.id || m.roles.highest.position < i.member.roles.highest.position);
const LOGT = ['general', 'mod', 'seguridad', 'verif', 'tickets', 'logros', 'sugerencias', 'reportes', 'invitaciones',
  'voz_mover', 'voz_desconexion', 'voz_mute', 'voz_sordo']; // los 4 últimos: un canal aparte para cada acción de voz
const LOGE = ['mensajes', 'miembros', 'roles', 'canales', 'voz', 'bans', 'voz_mover', 'voz_desconexion', 'voz_mute', 'voz_sordo'];
// Cada tipo de evento va a su propio canal (creados con /log servidor). Si ese canal no existe, se usa el de siempre.
const LOG_EVT = { miembros: 'entradas', mensajes: 'mensajes', bans: 'baneos', roles: 'roles', canales: 'canales', voz: 'voz', voz_mover: 'voz_mover', voz_desconexion: 'voz_desconexion', voz_mute: 'voz_mute', voz_sordo: 'voz_sordo' };
const LOG_TYPE = { seguridad: 'automod', mod: 'moderacion_general', verif: 'verificacion_miembros', tickets: 'tickets', invitaciones: 'invitaciones' };
/* ---------- TARJETAS DE LOG (todas con el mismo diseño: título, campos con emoji, imagen y ID) ----------
   logCard(gid, título, filas, { user, actor, color, image })
   · filas: ['📨','Invitado por','valor'] → emoji + etiqueta en negrita + valor debajo (o un texto suelto)
   · user : la persona afectada → su foto a la derecha y su ID abajo
   · actor: quien hizo la acción (staff) → su foto y nombre arriba */
function logCard(gid, title, rows, o = {}) {
  const e = new EmbedBuilder().setColor(o.color ?? C(gid).color).setTimestamp().setTitle(String(title).slice(0, 256));
  const body = rows.filter(Boolean).map(r => Array.isArray(r) ? `${r[0]} **${r[1]}**\n${(r[2] === undefined || r[2] === null || r[2] === '') ? '—' : r[2]}` : r).join('\n');
  if (body) e.setDescription(body.slice(0, 4096));
  const u = o.user, thumb = u ? (u.displayAvatarURL ? u.displayAvatarURL({ size: 256 }) : u) : null; if (thumb) e.setThumbnail(thumb);
  const act = o.actor?.user || o.actor; if (act?.username) e.setAuthor({ name: `Acción de ${act.username}`, iconURL: act.displayAvatarURL({ size: 64 }) });
  if (o.image) e.setImage(o.image);
  const powered = `Powered by ${client.user?.username || 'Bot'}`;
  e.setFooter({ text: `${u?.id ? `ID: ${u.id} · ` : ''}${powered}` });
  e.lc = { title: String(title), body, thumb, image: o.image, id: u?.id, actor: act?.id ? `<@${act.id}>` : null, powered }; // para armar la tarjeta final (ver lcMsg)
  return e;
}
// Convierte un log en la tarjeta final: título grande, datos, foto a la derecha, línea de ID + tiempo y "Powered by"
function lcMsg(e) {
  const d = e.lc; if (!d || !ContainerBuilder || !SectionBuilder || !ThumbnailBuilder) return { embeds: [e] }; // discord.js viejo: embed normal
  const c = new ContainerBuilder().setAccentColor(typeof e.data.color === 'number' ? e.data.color : 0x9B30FF);
  const head = new TextDisplayBuilder().setContent(`# ${d.title}`.slice(0, 300)), body = d.body ? new TextDisplayBuilder().setContent(d.body.slice(0, 3800)) : null;
  if (d.thumb) c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(...[head, body].filter(Boolean)).setThumbnailAccessory(new ThumbnailBuilder().setURL(d.thumb)));
  else { c.addTextDisplayComponents(head); if (body) c.addTextDisplayComponents(body); }
  if (d.image) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(d.image)));
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${d.id ? `ID: ${d.id} · ` : ''}<t:${Math.floor(Date.now() / 1000)}:R>${d.actor ? ` · Acción de ${d.actor}` : ''}`), new TextDisplayBuilder().setContent(`-# ${d.powered}`));
  return { components: [c], flags: 1 << 15 }; // IsComponentsV2
}
// Busca en el registro de auditoría quién hizo algo y por qué (necesita el permiso "Ver registro de auditoría")
async function aud(guild, type, targetId, ms = 8000) {
  try {
    if (!guild.members.me?.permissions.has(P.ViewAuditLog)) return null;
    await new Promise(r => setTimeout(r, 1200));
    const l = await guild.fetchAuditLogs({ type, limit: 8 });
    return l.entries.find(x => (!targetId || x.targetId === targetId) && Date.now() - x.createdTimestamp < ms) || null;
  } catch { return null; }
}
const whoTxt = en => en?.executor ? `${en.executor}` : '❓ Desconocido';
const whyTxt = (en, alt) => en?.reason || alt || 'Sin razón';
// Los logs que no usan logCard() también salen con foto + ID: se toma la primera persona mencionada en el texto
function lgEnrich(guild, e) {
  if (e.lc) return e; const d = e.data; if (!guild) return e;
  const txt = d.description || '', id = /<@!?(\d{17,20})>/.exec(txt)?.[1] || /\((\d{17,20})\)/.exec(txt)?.[1];
  const u = id && (guild.members.cache.get(id)?.user || client.users.cache.get(id)), powered = `Powered by ${client.user?.username || 'Bot'}`;
  const body = [txt, ...(d.fields || []).map(f => `**${f.name}**\n${f.value}`)].filter(Boolean).join('\n');
  const thumb = d.thumbnail?.url || (u ? u.displayAvatarURL({ size: 256 }) : null);
  e.lc = { title: String(d.title || '').replace(/^#+\s*/, ''), body, thumb, image: d.image?.url, id: u?.id || id, actor: null, powered };
  return e;
}
function lgDest(gid, type, evt, key) { // id del canal al que irá un log
  const cf = C(gid); if (evt && cf.logoff.includes(evt)) return null;
  const k = key || (evt && LOG_EVT[evt]) || LOG_TYPE[type]; return (k && cf.logch[k]) || cf.logch[type] || cf.logch.general || null;
}
function lg(gid, type, e, evt, key) {
  const id = lgDest(gid, type, evt, key); if (!id) return;
  const guild = client.guilds.cache.get(gid); lgEnrich(guild, e);
  guild?.channels.cache.get(id)?.send({ ...lcMsg(e), allowedMentions: { parse: [] } }).catch(err => console.warn(`[logs:${type}] no pude escribir en ${id}: ${err.message}`));
}
async function gif(t) {
  try { const r = await fetch(`https://nekos.best/api/v2/${t}`); return (await r.json()).results[0].url; } catch { return null; }
}

/* ===================== REGISTRO DE COMANDOS (150) ===================== */
const CATS = {};
const { registerCommand } = require('../handlers/commandHandler');
function def(cat, name, desc, spec, perm, run) {
  registerCommand(CATS, cat, name, desc, spec, perm, run);
}
const OT = { s: 'addStringOption', i: 'addIntegerOption', u: 'addUserOption', c: 'addChannelOption', r: 'addRoleOption', b: 'addBooleanOption' };
const GET = { s: 'getString', i: 'getInteger', u: 'getUser', c: 'getChannel', r: 'getRole', b: 'getBoolean' };
const CHO = { // opciones con lista cerrada, por 'módulo.opción'
  'logro.tipo': [['Mensajes enviados', 'msgs'], ['Nivel', 'lvl'], ['Monedas', 'coins'], ['Invitaciones', 'invites'], ['Minutos en voz', 'vmin'], ['Minutos con micrófono encendido', 'mic'],
    ['Veces que enciende el micrófono', 'micon'], ['Minutos con cámara', 'cam'], ['Veces que enciende la cámara', 'camon'], ['Minutos transmitiendo', 'strm'],
    ['Veces que transmite', 'stron'], ['Días en el servidor', 'days'], ['Antigüedad de la cuenta (días)', 'acct']],
  'logro.rareza': [['Común', 'comun'], ['Poco común', 'poco'], ['Raro', 'raro'], ['Épico', 'epico'], ['Legendario', 'legendario']],
  'logro.icono': [['Reloj', 'clock'], ['Cámara', 'camera'], ['Micrófono', 'mic'], ['Pantalla', 'screen'], ['Calendario', 'calendar'], ['Chat', 'chat'], ['Estrella', 'star'], ['Moneda', 'coin'], ['Sobre', 'mail'], ['Trofeo', 'trophy']],
  'logro.forma': [['Escudo', 'shield'], ['Hexágono', 'hex'], ['Círculo', 'circle']],
  'bienvenida.evento': [['Bienvenida', 'bienvenida'], ['Despedida', 'despedida']],
  'limpiar.filtro': [['Todos los mensajes', 'todos'], ['Solo de bots', 'bots'], ['Solo de personas', 'humanos'], ['Con enlaces', 'enlaces'], ['Con archivos', 'archivos'], ['Con embeds', 'embeds']],
  'limpiar.modo': [['Borrar mensajes recientes (conserva el canal)', 'mensajes'], ['Reiniciar el canal (borra TODO)', 'canal']],
  'invite.suceso': [['Entrada de miembro', 'entrada'], ['Salida de miembro', 'salida'], ['Invitación creada', 'creada'], ['Invitación eliminada/agotada', 'borrada'], ['Recompensa de rol', 'recompensa'], ['Ajuste de admin', 'admin']],
  'verif.modo': [['Botón (instantáneo)', 'boton'], ['Código (modal)', 'codigo'], ['Captcha (operación matemática)', 'captcha']],
};
require('../../extras')({ client, DB, def, G, save });
const ROOT = new Set(['work', 'daily']); // comandos sin subcomando: /work y /daily
const build = () => Object.entries(CATS).map(([cat, subs]) => {
  if (ROOT.has(cat)) { const rb = new SlashCommandBuilder().setName(cat).setDescription(subs.run.desc.slice(0, 100));
    [...(subs.run.spec || [])].sort((a, b) => b.r - a.r).forEach(o => rb[OT[o.t]](x => { x.setName(o.n).setDescription(o.n).setRequired(o.r); if (o.t === 'c') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement); return x; }));
    return rb.toJSON(); }
  const b = new SlashCommandBuilder().setName(cat).setDescription(`Módulo ${cat}`);
  for (const [n, c] of Object.entries(subs)) b.addSubcommand(s => {
    s.setName(n).setDescription(c.desc.slice(0, 100));
    [...c.spec].sort((a, b) => b.r - a.r).forEach(o => s[OT[o.t]](x => {
      x.setName(o.n).setDescription(o.n).setRequired(o.r);
      if (cat === 'ticket' && o.n === 'categoria') x.addChannelTypes?.(ChannelType.GuildCategory);
      if (cat === 'verif' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement); // solo canales de texto
      if (cat === 'limpiar' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement);
      if (cat === 'stats' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildVoice);
      if (cat === 'stats' && o.n === 'categoria') x.addChannelTypes?.(ChannelType.GuildCategory);
      if (cat === 'estado' && o.n === 'categoria') x.addChannelTypes?.(ChannelType.GuildCategory);
      if (cat === 'estado' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildVoice, ChannelType.GuildStageVoice);
      if (cat === 'estado' && o.n === 'texto') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement);
      if (cat === 'voz' && o.n === 'disparador') x.addChannelTypes?.(ChannelType.GuildVoice);
      if (cat === 'voz' && o.n === 'categoria') x.addChannelTypes?.(ChannelType.GuildCategory);
      if (cat === 'voz' && o.n === 'panel') x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement);
      if (cat === 'vozbot' && o.n === 'canal') x.addChannelTypes?.(ChannelType.GuildVoice, ChannelType.GuildStageVoice);
      if (cat === 'application' && ['canal', 'canal_logs'].includes(o.n)) x.addChannelTypes?.(ChannelType.GuildText, ChannelType.GuildAnnouncement);
      const ch = CHO[`${cat}.${o.n}`]; if (ch) x.addChoices(...ch.map(([name, value]) => ({ name, value })));
      return x;
    }));
    return s;
  });
  return b.toJSON();
});

/* =========================== 1. VERIFICACIÓN (8) =========================== */
// Comprueba que el bot pueda publicar el panel en un canal (texto + permisos necesarios)
const chIssue = (guild, ch, format) => {
  if (!ch) return 'el canal ya no existe';
  if (!ch.isTextBased?.() || ch.isThread?.() || ch.isVoiceBased?.()) return 'no es un canal de texto';
  const need = [P.ViewChannel, P.SendMessages, P.EmbedLinks];
  if(format==='card')need.push(P.AttachFiles);
  const miss = need.filter(p => !ch.permissionsFor(guild.members.me)?.has(p));
  const names = { [P.ViewChannel]: 'Ver canal', [P.SendMessages]: 'Enviar mensajes', [P.EmbedLinks]: 'Insertar enlaces', [P.AttachFiles]: 'Adjuntar archivos' };
  return miss.length ? `al bot le falta en ese canal: **${miss.map(p => names[p]).join(', ')}**` : null;
};
def('verif', 'setup', 'Configura canal, rol y modo (boton|codigo|captcha)', 'canal:c!,rol:r!,modo:s', 'Administrator', (i, o, g, cf) => {
  const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo usar ${o.canal}: ${ci}.`);
  const ri = roleIssue(i.guild, o.rol); if (ri) return no(i, `No puedo dar ${o.rol}: ${ri}.`);
  cf.v = { ch: o.canal.id, role: o.rol.id, mode: ['codigo', 'captcha'].includes(o.modo) ? o.modo : 'boton' }; save();
  ok(i, `Canal: ${o.canal}\nRol: ${o.rol}\nModo: **${cf.v.mode}**\n\nAhora usa \`/verif panel\`.`);
});
def('verif', 'embed', 'Personaliza el panel: título, descripción, color, banner (arriba), imagen (abajo), miniatura, pie, botón', 'titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s,boton:s', 'Administrator', (i, o, g, cf) => {
  if (o.color && hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.');
  for (const k of ['banner', 'imagen', 'miniatura']) if (o[k] && !url(o[k]) && !/^(ninguna|quitar)$/i.test(o[k])) return no(i, `\`${k}\` debe ser un enlace \`http(s)\` (o \`ninguna\` para quitarla).`);
  cf.vemb = { ...cf.vemb, ...Object.fromEntries(Object.entries({ title: o.titulo, desc: nl(o.descripcion), color: hex(o.color), banner: url(o.banner), img: url(o.imagen), thumb: url(o.miniatura), footer: o.pie, btn: o.boton }).filter(([, v]) => v)) };
  for (const [k, key] of [['banner', 'banner'], ['imagen', 'img'], ['miniatura', 'thumb']]) if (/^(ninguna|quitar)$/i.test(o[k] || '')) delete cf.vemb[key];
  save(); ok(i, 'Embed de verificación actualizado. Usa `/verif panel` para publicarlo (los paneles ya publicados no cambian).');
});
// Botón de verificación personalizable: texto, color (Discord solo tiene 4: gris, verde, rojo, azul) e icono (emoji).
// Un botón no puede llevar una imagen suelta; el icono es un emoji. Con `foto` el bot crea un emoji del servidor a partir de la imagen.
CHO['verif.estilo'] = [['Gris (transparente)', 'gris'], ['Verde', 'verde'], ['Rojo', 'rojo'], ['Azul', 'azul']];
const VSTY = { gris: ButtonStyle.Secondary, verde: ButtonStyle.Success, rojo: ButtonStyle.Danger, azul: ButtonStyle.Primary };
const vBtn = v => {
  const b = new ButtonBuilder().setCustomId('verif').setStyle(VSTY[v.style] ?? ButtonStyle.Success);
  if (v.emoji) b.setEmoji(tkEmoji(v.emoji));
  if (v.btn !== '' || !v.emoji) b.setLabel(String(v.btn || 'Verificarme').slice(0, 80));
  return b;
};
def('verif', 'boton', 'Personaliza el botón: texto, color (gris/verde/rojo/azul) e icono (emoji o foto)', 'texto:s,estilo:s,emoji:s,foto:s,nombrefoto:s', 'Administrator', async (i, o, g, cf) => {
  const v = (cf.vemb ??= {}), NO = /^(ninguno|ninguna|quitar)$/i;
  if (o.emoji && !NO.test(o.emoji) && !tkEmojiOk(o.emoji)) return no(i, '`emoji` debe ser **un solo emoji** (o uno personalizado del servidor, como `<:nombre:123>`). Para usar una imagen tuya usa `foto`.');
  if (o.foto && !url(o.foto)) return no(i, '`foto` debe ser un enlace `http(s)` directo a una imagen (PNG, JPG o GIF de menos de 256 KB).');
  if (o.texto && NO.test(o.texto) && !o.emoji && !o.foto && !v.emoji) return no(i, 'Para dejar el botón sin texto necesita un icono: indica `emoji` o `foto`.');
  const dropOwn = async () => { if (v.own) { await i.guild.emojis.cache.get(v.own)?.delete('Icono del botón de verificación reemplazado').catch(() => {}); delete v.own; } };
  await i.deferReply({ flags: 64 });
  if (o.estilo) v.style = o.estilo;
  if (o.texto) v.btn = NO.test(o.texto) ? '' : o.texto.slice(0, 80);
  if (o.emoji) { await dropOwn(); if (NO.test(o.emoji)) delete v.emoji; else v.emoji = o.emoji.trim(); }
  if (o.foto) {
    if (!i.guild.members.me.permissions.has(P.ManageGuildExpressions ?? P.ManageEmojisAndStickers)) { save(); return i.editReply({ embeds: [E(i.guildId, '❌ Error', 'Para crear el icono el bot necesita el permiso **Gestionar emojis y stickers**. Dáselo, o sube tú la imagen como emoji del servidor y pásala en `emoji`.')] }); }
    const name = (o.nombrefoto || 'verificar').replace(/\W/g, '').slice(0, 32).padEnd(2, '_');
    try {
      const em = await i.guild.emojis.create({ attachment: o.foto, name, reason: `Icono del botón de verificación (${i.user.tag})` });
      await dropOwn(); v.emoji = `<${em.animated ? 'a' : ''}:${em.name}:${em.id}>`; v.own = em.id;
    } catch (err) { save(); return i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude crear el emoji con esa imagen: ${err.message}\nDebe ser PNG, JPG o GIF de menos de 256 KB y el servidor debe tener espacio para emojis.`)] }); }
  }
  save();
  let prev; try { prev = [new ActionRowBuilder().addComponents(vBtn(v).setDisabled(true))]; } catch { prev = []; }
  i.editReply({ embeds: [E(i.guildId, '✅ Botón actualizado', `🎨 Color: **${v.style || 'verde'}**\n🔤 Texto: **${v.btn === '' ? '(solo icono)' : v.btn || 'Verificarme'}**\n🖼️ Icono: ${v.emoji || '—'}\n\nAsí se verá ↓ Publícalo con \`/verif panel\` (los paneles ya enviados no cambian).`)], components: prev });
});
def('verif', 'panel', 'Envía el panel de verificación', '', 'Administrator', async (i, o, g, cf) => {
  if (!cf.v?.ch || !cf.v?.role) return no(i, 'Primero configura la verificación con `/verif setup`.');
  const ch = i.guild.channels.cache.get(cf.v.ch) ?? await i.guild.channels.fetch(cf.v.ch).catch(() => null);
  const ci = chIssue(i.guild, ch, validFormat(cf.messageFormats?.verif)); if (ci) return no(i, `No puedo enviar el panel: ${ci}.\nUsa \`/verif setup\` con un canal válido.`);
  const ri = roleIssue(i.guild, i.guild.roles.cache.get(cf.v.role)); if (ri) return no(i, `El rol de verificación no es válido: ${ri}.\nUsa \`/verif setup\` de nuevo.`);
  await i.deferReply({ flags: 64 });
  try {
    const v = cf.vemb || {};
    const e = E(i.guildId, v.title || '✅ Verificación', v.desc || 'Pulsa el botón para verificarte y acceder al servidor.', v.img);
    if (Number.isInteger(v.color)) e.setColor(v.color); if (url(v.thumb)) e.setThumbnail(v.thumb); if (v.footer) e.setFooter({ text: String(v.footer).slice(0, 2048) });
    const embeds = [e]; if (url(v.banner)) embeds.unshift(new EmbedBuilder().setColor(Number.isInteger(v.color) ? v.color : cf.color).setImage(v.banner)); // banner de arriba, aparte
    const btn = vBtn(v);
    const rows=[new ActionRowBuilder().addComponents(btn)];
    const format=validFormat(cf.messageFormats?.verif);
    const payload=format==='embed'?{embeds,components:rows}:await buildMessage({format,title:v.title||'✅ Verificación',description:v.desc||'Pulsa el botón para verificarte y acceder al servidor.',color:v.color??cf.color,banner:v.banner,image:v.img,thumbnail:v.thumb,footer:v.footer,components:rows});
    await ch.send(payload);
  } catch (err) {
    console.error('verif panel:', err);
    return i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude enviar el panel en ${ch}:\n\`${err.message}\``)] });
  }
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Panel enviado en ${ch}`)] });
});
// Puntaje de riesgo: solo señales públicas (antigüedad de cuenta, avatar por defecto, intentos fallidos,
// velocidad de respuesta). Nunca incluye IP ni ubicación: Discord no entrega esos datos a los bots, y aunque
// los entregara, registrar la IP de alguien sin su conocimiento real es doxxing y no se implementa aquí.
function riskScore(user, extra = {}) {
  const ageDays = (Date.now() - user.createdTimestamp) / 864e5;
  let score = 0; const reasons = [];
  if (ageDays < 1) { score += 40; reasons.push('🕒 Cuenta creada hace menos de 1 día'); }
  else if (ageDays < 7) { score += 25; reasons.push('🕒 Cuenta creada hace menos de 7 días'); }
  else if (ageDays < 30) { score += 10; reasons.push('🕒 Cuenta creada hace menos de 30 días'); }
  if (!user.avatar) { score += 15; reasons.push('🖼️ Usa el avatar por defecto'); }
  if (extra.fails) { score += Math.min(30, extra.fails * 15); reasons.push(`❌ ${extra.fails} intento(s) fallido(s)`); }
  if (extra.ms != null && extra.ms < 2000) { score += 20; reasons.push('⚡ Respondió en menos de 2s (posible bot)'); }
  return { score: Math.min(100, score), reasons };
}
// Log de verificación: quién, cómo, cuándo, antigüedad de la cuenta y puntaje de riesgo (sin datos privados
// como IP o ubicación, que Discord no entrega a los bots)
async function vlog(guild, user, title, method, extra, risk) {
  const cf = C(guild.id), id = cf.logch.verif || cf.logch.general;
  if (!id) return console.warn('[logs:verif] no hay canal de logs configurado (usa /log servidor)');
  const ch = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null), ci = chIssue(guild, ch);
  if (ci) return console.warn(`[logs:verif] canal ${id} inválido: ${ci}`);
  const mem = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
  const e = E(guild.id, title).setThumbnail(user.displayAvatarURL()).addFields(
    { name: '👤 Usuario', value: `${user} (\`${user.tag}\`)`, inline: true },
    { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
    { name: '🔐 Método', value: method, inline: true },
    { name: '📅 Cuenta creada', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
    { name: '📥 Entró al servidor', value: mem?.joinedTimestamp ? `<t:${Math.floor(mem.joinedTimestamp / 1000)}:R>` : '—', inline: true },
    { name: '🕒 Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true });
  if (extra) e.addFields({ name: 'ℹ️ Detalle', value: String(extra).slice(0, 1024) });
  if (risk) {
    e.addFields({ name: '⚠️ Riesgo', value: `**${risk.score}/100**\n${risk.reasons.join('\n') || 'Sin señales de riesgo'}` });
    if (risk.score >= 50) e.setColor('#ED4245'); else if (risk.score >= 25) e.setColor('#FEE75C');
  }
  await ch.send({ embeds: [e] }).catch(err => console.warn(`[logs:verif] error al enviar: ${err.message}`));
}
def('verif', 'estado', 'Ver configuración de verificación', '', 'Administrator', (i, o, g, cf) => {
  const v = cf.v; say(i, '📋 Verificación', v.ch ? `Canal: <#${v.ch}>\nRol: <@&${v.role}>\nModo: **${v.mode}**\nLogs: ${cf.logch.verif ? `<#${cf.logch.verif}>` : 'no configurado'}` : 'No configurada.');
});
def('verif', 'manual', 'Verifica manualmente a un usuario', 'usuario:u!', 'ManageRoles', async (i, o, g, cf) => {
  const m = await M(i, o.usuario); if (!m || !cf.v.role) return no(i, 'Usuario o rol no válido.');
  await m.roles.add(cf.v.role); await vlog(i.guild, o.usuario, '✅ Verificación manual', 'Manual', `Por ${i.user}`); ok(i, `${m} verificado.`);
});
def('verif', 'quitar', 'Quita la verificación a un usuario', 'usuario:u!', 'ManageRoles', async (i, o, g, cf) => {
  const m = await M(i, o.usuario); if (!m || !cf.v.role) return no(i, 'Usuario o rol no válido.');
  await m.roles.remove(cf.v.role); await vlog(i.guild, o.usuario, '🚫 Verificación quitada', 'Manual', `Por ${i.user}`); ok(i, `Verificación quitada a ${m}.`);
});
def('verif', 'desactivar', 'Desactiva el sistema de verificación', '', 'Administrator', (i, o, g, cf) => { cf.v = {}; save(); ok(i, 'Verificación desactivada.'); });

const VC = new Map(); // uid -> { code, attempts, start }  (modo código)
const CC = new Map(); // uid -> { ans, attempts, start }   (modo captcha)
async function verifButton(i) {
  const cf = C(i.guildId), v = cf.v; if (!v.role) return no(i, 'Verificación no configurada.');
  if (hasRole(i.member, v.role)) return no(i, 'Ya estás verificado.');
  const ri = roleIssue(i.guild, i.guild.roles.cache.get(v.role));
  if (ri) { await vlog(i.guild, i.user, '⚠️ Verificación con problemas', 'Botón', `No puedo dar <@&${v.role}>: ${ri}`); return no(i, 'La verificación está mal configurada. Avisa a un administrador.'); }
  if (v.mode === 'codigo') {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase(); VC.set(i.user.id, { code, attempts: 0, start: Date.now() });
    return i.reply({ flags: 64, embeds: [E(i.guildId, '🔐 Código de verificación', `Tu código es:\n\`\`\`${code}\`\`\`\nTienes **3 intentos** y **5 minutos**.`)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verif_enter').setLabel('Introducir código').setStyle(ButtonStyle.Primary))] });
  }
  if (v.mode === 'captcha') {
    const a = rnd(1, 9), b = rnd(1, 9), op = R(['+', '-']), ans = op === '+' ? a + b : a - b;
    CC.set(i.user.id, { ans, attempts: 0, start: Date.now() });
    return i.reply({ flags: 64, embeds: [E(i.guildId, '🧮 Verificación', `Resuelve la operación y pulsa el botón para responder:\n\n**${a} ${op} ${b} = ?**\n\nTienes **3 intentos** y **2 minutos**.`)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verif_captcha_enter').setLabel('Responder').setStyle(ButtonStyle.Primary))] });
  }
  await i.member.roles.add(v.role); await vlog(i.guild, i.user, '✅ Usuario verificado', 'Botón', null, riskScore(i.user));
  i.reply({ flags: 64, embeds: [E(i.guildId, '✅ Verificado', '¡Bienvenido al servidor!')] });
}

/* ============================ 2. SEGURIDAD (18) ============================ */
const SEC = [['antilink', 'link', 'Bloquea enlaces'], ['antiinvite', 'invite', 'Bloquea invitaciones de Discord'],
  ['antispam', 'spam', 'Anti-spam de mensajes'], ['anticaps', 'caps', 'Bloquea exceso de mayúsculas'],
  ['antimencion', 'mention', 'Bloquea menciones masivas'], ['antibadwords', 'badwords', 'Filtro de palabras prohibidas'],
  ['antibots', 'bots', 'Expulsa bots no permitidos'], ['antiraid', 'raid', 'Protección anti-raid'], ['antinuke', 'nuke', 'Protección anti-nuke']];
for (const [name, key, desc] of SEC) def('seg', name, desc, 'estado:b!', 'Administrator', (i, o, g, cf) => { cf.sec[key] = o.estado; save(); ok(i, `**${name}** ${o.estado ? 'activado ✅' : 'desactivado ❌'}`); });
def('seg', 'estado', 'Estado de toda la seguridad', '', 'Administrator', (i, o, g, cf) => {
  const s = cf.sec; say(i, '🛡️ Seguridad del servidor', SEC.map(([n, k]) => `${s[k] ? '🟢' : '🔴'} ${n}`).join('\n') +
    `\n\n🕒 Edad mínima de cuenta: **${cf.minage || 0}** días\n⚡ Raid: **${cf.raidn}** entradas en **${cf.raidsec}s**\n📃 Palabras prohibidas: **${g.badwords.length}**\n✅ Whitelist: **${g.wl.length}**`);
});
def('seg', 'badwordadd', 'Añade palabra prohibida', 'palabra:s!', 'Administrator', (i, o, g) => { g.badwords.push(o.palabra.toLowerCase()); save(); ok(i, 'Palabra añadida.'); });
def('seg', 'badwordremove', 'Quita palabra prohibida', 'palabra:s!', 'Administrator', (i, o, g) => { g.badwords = g.badwords.filter(w => w !== o.palabra.toLowerCase()); save(); ok(i, 'Palabra eliminada.'); });
def('seg', 'minage', 'Edad mínima de cuenta en días (0=off)', 'dias:i!', 'Administrator', (i, o, g, cf) => { cf.minage = o.dias; save(); ok(i, `Edad mínima: **${o.dias}** días.`); });
def('seg', 'wladd', 'Añade usuario o rol a la whitelist', 'usuario:u,rol:r', 'Administrator', (i, o, g) => { const id = o.usuario?.id || o.rol?.id; if (!id) return no(i, 'Indica usuario o rol.'); if (!g.wl.includes(id)) g.wl.push(id); save(); ok(i, 'Añadido a la whitelist.'); });
def('seg', 'wlremove', 'Quita usuario o rol de la whitelist', 'usuario:u,rol:r', 'Administrator', (i, o, g) => { const id = o.usuario?.id || o.rol?.id; g.wl = g.wl.filter(x => x !== id); save(); ok(i, 'Quitado de la whitelist.'); });
def('seg', 'raidconfig', 'Configura umbral anti-raid', 'entradas:i!,segundos:i!', 'Administrator', (i, o, g, cf) => { cf.raidn = o.entradas; cf.raidsec = o.segundos; save(); ok(i, `Raid si entran **${o.entradas}** en **${o.segundos}s**.`); });
async function lockAll(guild, state) {
  for (const ch of guild.channels.cache.filter(c => c.type === ChannelType.GuildText).values())
    await ch.permissionOverwrites.edit(guild.id, { SendMessages: state ? false : null }, { reason: 'Lockdown' }).catch(() => {});
}
def('seg', 'lockdown', 'Bloquea todos los canales del servidor', '', 'Administrator', async (i) => {
  await i.deferReply(); await lockAll(i.guild, true); lg(i.guildId, 'seguridad', E(i.guildId, '🔒 LOCKDOWN', `Activado por ${i.user}`));
  i.editReply({ embeds: [E(i.guildId, '🔒 Servidor en lockdown', 'Todos los canales de texto bloqueados.')] });
});
def('seg', 'unlockdown', 'Desbloquea todos los canales', '', 'Administrator', async (i) => {
  await i.deferReply(); await lockAll(i.guild, false); lg(i.guildId, 'seguridad', E(i.guildId, '🔓 Lockdown desactivado', `Por ${i.user}`));
  i.editReply({ embeds: [E(i.guildId, '🔓 Lockdown desactivado', 'Canales restaurados.')] });
});

const SP = new Map(), JN = new Map(), NK = new Map();
async function automod(m, cf, g) {
  const s = cf.sec, t = m.content;
  if (m.member.permissions.has(P.ManageMessages) || g.wl.includes(m.author.id) || m.member.roles.cache.some(r => g.wl.includes(r.id))) return false;
  let why = null;
  if (s.spam) {
    const k = m.guildId + m.author.id, a = (SP.get(k) || []).filter(x => Date.now() - x < 5000); a.push(Date.now()); SP.set(k, a);
    if (a.length >= 6) { why = 'Spam'; m.member.timeout(5 * 60000, 'AntiSpam').catch(() => {}); SP.delete(k); }
  }
  if (!why && s.invite && /(discord\.gg|discord(app)?\.com\/invite)\/\S+/i.test(t)) why = 'Invitaciones no permitidas';
  if (!why && s.link && /https?:\/\/\S+/i.test(t)) why = 'Enlaces no permitidos';
  if (!why && s.badwords && g.badwords.some(w => t.toLowerCase().includes(w))) why = 'Lenguaje prohibido';
  if (!why && s.caps) { const l = t.replace(/[^A-Za-z]/g, '').length; if (t.length >= 10 && l && t.replace(/[^A-Z]/g, '').length / l > 0.7) why = 'Exceso de mayúsculas'; }
  if (!why && s.mention && m.mentions.users.size + m.mentions.roles.size >= 5) why = 'Menciones masivas';
  if (!why) return false;
  m.delete().catch(() => {});
  m.channel.send({ embeds: [E(m.guildId, '🛡️ AutoMod', `${m.author}, tu mensaje fue eliminado: **${why}**`)] }).then(x => setTimeout(() => x.delete().catch(() => {}), 5000)).catch(() => {});
  lg(m.guildId, 'seguridad', E(m.guildId, '🛡️ AutoMod', `**Usuario:** ${m.author} (${m.author.id})\n**Canal:** ${m.channel}\n**Motivo:** ${why}\n**Mensaje:** ${t.slice(0, 500)}`));
  return true;
}
async function nuke(guild, type) {
  if (!C(guild.id).sec.nuke) return;
  const log = (await guild.fetchAuditLogs({ type, limit: 1 }).catch(() => null))?.entries.first();
  if (!log || Date.now() - log.createdTimestamp > 5000) return;
  const ex = log.executor; if (!ex || ex.id === client.user.id || ex.id === guild.ownerId || G(guild.id).wl.includes(ex.id)) return;
  const k = guild.id + ex.id, a = (NK.get(k) || []).filter(t => Date.now() - t < 10000); a.push(Date.now()); NK.set(k, a);
  if (a.length >= 3) {
    const m = await guild.members.fetch(ex.id).catch(() => null);
    if (m?.bannable) { await m.ban({ reason: 'AntiNuke: acciones destructivas masivas' }); lg(guild.id, 'seguridad', E(guild.id, '☢️ ANTI-NUKE', `**${ex.tag}** baneado por acciones destructivas masivas.`), null, 'defensa'); }
  }
}

/* ============================ 3. MODERACIÓN (21) ============================ */
function modlog(i, type, u, reason) {
  const _e = E(i.guildId, `🔨 ${type}`).addFields({ name: 'Usuario', value: `${u} (${u.id})`, inline: true }, { name: 'Moderador', value: `${i.user}`, inline: true }, { name: 'Razón', value: reason || 'Sin razón' });
  if (type === 'Warn') lg(i.guildId, 'mod', _e, null, 'advertencias');
  lg(i.guildId, 'mod', E(i.guildId, `🔨 ${type}`).addFields({ name: 'Usuario', value: `${u} (${u.id})`, inline: true },
    { name: 'Moderador', value: `${i.user}`, inline: true }, { name: 'Razón', value: reason || 'Sin razón' }));
}
def('mod', 'ban', 'Banea a un usuario', 'usuario:u!,razon:s,dias:i', 'BanMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (m && (!canTarget(i, m) || !m.bannable)) return no(i, 'No puedo o no puedes banear a ese usuario.');
  await dm(o.usuario, E(i.guildId, '🔨 Has sido baneado', `Servidor: **${i.guild.name}**\nRazón: ${o.razon || 'Sin razón'}`));
  await i.guild.members.ban(o.usuario, { reason: o.razon, deleteMessageSeconds: Math.min(o.dias || 0, 7) * 86400 });
  modlog(i, 'Ban', o.usuario, o.razon); ok(i, `**${o.usuario.tag}** baneado.`);
});
def('mod', 'unban', 'Desbanea por ID', 'id:s!,razon:s', 'BanMembers', async (i, o) => {
  const u = await i.guild.members.unban(o.id, o.razon).catch(() => null); if (!u) return no(i, 'ID no baneada.');
  modlog(i, 'Unban', u, o.razon); ok(i, `**${u.tag}** desbaneado.`);
});
def('mod', 'kick', 'Expulsa a un usuario', 'usuario:u!,razon:s', 'KickMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || !canTarget(i, m) || !m.kickable) return no(i, 'No se puede expulsar a ese usuario.');
  await dm(o.usuario, E(i.guildId, '👢 Expulsado', `Servidor: **${i.guild.name}**\nRazón: ${o.razon || 'Sin razón'}`));
  await m.kick(o.razon); modlog(i, 'Kick', o.usuario, o.razon); ok(i, `**${o.usuario.tag}** expulsado.`);
});
def('mod', 'softban', 'Ban + unban para borrar mensajes', 'usuario:u!,razon:s', 'BanMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || !canTarget(i, m) || !m.bannable) return no(i, 'No se puede.');
  await i.guild.members.ban(o.usuario, { reason: 'Softban: ' + (o.razon || ''), deleteMessageSeconds: 86400 }); await i.guild.members.unban(o.usuario.id);
  modlog(i, 'Softban', o.usuario, o.razon); ok(i, `**${o.usuario.tag}** softbaneado.`);
});
def('mod', 'timeout', 'Aísla temporalmente a un usuario', 'usuario:u!,minutos:i!,razon:s', 'ModerateMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || !canTarget(i, m) || !m.moderatable) return no(i, 'No se puede aislar a ese usuario.');
  await m.timeout(Math.min(o.minutos, 40320) * 60000, o.razon); modlog(i, `Timeout ${o.minutos}m`, o.usuario, o.razon); ok(i, `${o.usuario} aislado **${o.minutos}** min.`);
});
def('mod', 'untimeout', 'Quita el aislamiento', 'usuario:u!', 'ModerateMembers', async (i, o) => {
  const m = await M(i, o.usuario); if (!m) return no(i, 'Usuario no encontrado.'); await m.timeout(null); modlog(i, 'Untimeout', o.usuario); ok(i, `${o.usuario} ya puede hablar.`);
});
def('mod', 'warn', 'Advierte a un usuario', 'usuario:u!,razon:s!', 'ModerateMembers', async (i, o, g, cf) => {
  const w = (g.warns[o.usuario.id] ??= []); w.push({ mod: i.user.id, reason: o.razon, date: Date.now() }); save();
  await dm(o.usuario, E(i.guildId, '⚠️ Advertencia', `Servidor: **${i.guild.name}**\nRazón: ${o.razon}\nAdvertencias: **${w.length}/${cf.warnlimit}**`));
  modlog(i, 'Warn', o.usuario, o.razon);
  if (w.length >= cf.warnlimit) { const m = await M(i, o.usuario); m?.timeout(86400000, 'Límite de warns').catch(() => {}); }
  ok(i, `${o.usuario} advertido (**${w.length}/${cf.warnlimit}**).`);
});
def('mod', 'warns', 'Ver advertencias de un usuario', 'usuario:u!', 'ModerateMembers', (i, o, g) => {
  const w = g.warns[o.usuario.id] || []; say(i, `⚠️ Warns de ${o.usuario.tag}`, w.length ? w.map((x, n) => `**${n + 1}.** ${x.reason} — <@${x.mod}> <t:${Math.floor(x.date / 1000)}:d>`).join('\n') : 'Sin advertencias.');
});
def('mod', 'delwarn', 'Elimina una advertencia', 'usuario:u!,numero:i!', 'ModerateMembers', (i, o, g) => {
  const w = g.warns[o.usuario.id] || []; if (!w[o.numero - 1]) return no(i, 'Número inválido.'); w.splice(o.numero - 1, 1); save(); ok(i, 'Advertencia eliminada.');
});
def('mod', 'clearwarns', 'Borra todas las advertencias', 'usuario:u!', 'ModerateMembers', (i, o, g) => { delete g.warns[o.usuario.id]; save(); ok(i, 'Advertencias borradas.'); });
def('mod', 'purge', 'Borra mensajes (máx 100)', 'cantidad:i!,usuario:u', 'ManageMessages', async (i, o) => {
  await i.deferReply({ flags: 64 }); let ms = await i.channel.messages.fetch({ limit: 100 });
  if (o.usuario) ms = ms.filter(m => m.author.id === o.usuario.id); const d = await i.channel.bulkDelete([...ms.values()].slice(0, Math.min(o.cantidad, 100)), true);
  lg(i.guildId, 'mod', E(i.guildId, '🧹 Purge', `${i.user} borró **${d.size}** mensajes en ${i.channel}`)); i.editReply({ embeds: [E(i.guildId, '🧹 Listo', `**${d.size}** mensajes borrados.`)] });
});
def('mod', 'privado', 'Hace un canal privado: solo lo ve el rol que indiques', 'canal:c!,rol:r!', 'ManageChannels', async (i, o) => {
  try {
    await o.canal.permissionOverwrites.edit(i.guild.roles.everyone.id, { ViewChannel: false });
    await o.canal.permissionOverwrites.edit(o.rol.id, { ViewChannel: true });
    ok(i, `${o.canal} es privado: solo lo ven ${o.rol} y el staff.`);
  } catch (err) { no(i, `No pude cambiar ${o.canal}: ${err.message}`); }
});
def('mod', 'auditar', 'Lista canales con nombre sensible (staff, vip, privado...) que todos pueden ver', '', 'ManageChannels', (i) => {
  const malos = i.guild.channels.cache.filter(c => c.type === ChannelType.GuildText && /staff|vip|privad|admin|secreto|oculto/i.test(c.name)
    && c.permissionsFor(i.guild.roles.everyone)?.has(P.ViewChannel));
  say(i, '🔎 Auditoría de canales', malos.size ? `Estos se ven para @everyone, revísalos (\`/mod privado\`):\n${malos.map(c => `• ${c}`).join('\n')}`
    : 'No encontré canales sensibles visibles para todos. ✅', true);
});
def('mod', 'lock', 'Bloquea un canal', 'canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.permissionOverwrites.edit(i.guild.id, { SendMessages: false }); ok(i, `🔒 ${c} bloqueado.`); });
def('mod', 'unlock', 'Desbloquea un canal', 'canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.permissionOverwrites.edit(i.guild.id, { SendMessages: null }); ok(i, `🔓 ${c} desbloqueado.`); });
def('mod', 'slowmode', 'Modo lento (segundos)', 'segundos:i!,canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.setRateLimitPerUser(Math.min(o.segundos, 21600)); ok(i, `Modo lento de ${c}: **${o.segundos}s**`); });
def('mod', 'nick', 'Cambia el apodo de un usuario', 'usuario:u!,apodo:s', 'ManageNicknames', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || !m.manageable) return no(i, 'No puedo cambiar ese apodo.'); await m.setNickname(o.apodo || null); ok(i, `Apodo de ${m} actualizado.`);
});
def('mod', 'addrole', 'Da un rol a un usuario', 'usuario:u!,rol:r!', 'ManageRoles', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || o.rol.position >= i.member.roles.highest.position && i.guild.ownerId !== i.user.id) return no(i, 'Jerarquía insuficiente.'); await m.roles.add(o.rol); ok(i, `${o.rol} añadido a ${m}.`);
});
def('mod', 'removerole', 'Quita un rol a un usuario', 'usuario:u!,rol:r!', 'ManageRoles', async (i, o) => {
  const m = await M(i, o.usuario); if (!m || o.rol.position >= i.member.roles.highest.position && i.guild.ownerId !== i.user.id) return no(i, 'Jerarquía insuficiente.'); await m.roles.remove(o.rol); ok(i, `${o.rol} quitado a ${m}.`);
});
def('mod', 'hide', 'Oculta un canal', 'canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.permissionOverwrites.edit(i.guild.id, { ViewChannel: false }); ok(i, `${c.name} oculto.`); });
def('mod', 'unhide', 'Muestra un canal', 'canal:c', 'ManageChannels', async (i, o) => { const c = o.canal || i.channel; await c.permissionOverwrites.edit(i.guild.id, { ViewChannel: null }); ok(i, `${c} visible.`); });
def('mod', 'banlist', 'Lista de baneados', '', 'BanMembers', async (i) => {
  const b = await i.guild.bans.fetch(); say(i, `🔨 Baneados (${b.size})`, b.size ? b.first(25).map(x => `**${x.user.tag}** \`${x.user.id}\` — ${x.reason || 'Sin razón'}`).join('\n') : 'Nadie baneado.');
});
def('mod', 'warnlimit', 'Límite de warns antes de timeout', 'cantidad:i!', 'Administrator', (i, o, g, cf) => { cf.warnlimit = Math.max(1, o.cantidad); save(); ok(i, `Límite: **${cf.warnlimit}** warns (timeout de 24h).`); });

/* ============================== 4. LOG (1) · /log servidor ============================== */
// Un solo comando: crea TODOS los canales de log (uno por evento) y los configura solos.
// [categoría, [nombre, clave, descripción, publico?]]
const LOG_CANALES = [
  ['📜 LOGS', [
    ['Bienvenida', 'bienvenida', 'Bienvenidas enviadas a los nuevos miembros'],
    ['Entradas', 'entradas', 'Miembros que entran al servidor'], ['Salidas', 'salidas', 'Miembros que salen del servidor'],
    ['Perfil Acceso', 'perfil_acceso', 'Cambios de perfil y acceso de miembros'], ['Apodos', 'apodos', 'Cambios de apodo'],
    ['Roles', 'roles', 'Roles creados, eliminados o asignados'], ['Mensajes', 'mensajes', 'Mensajes borrados y editados'],
    ['Reacciones', 'reacciones', 'Reacciones a mensajes'], ['Encuestas', 'encuestas', 'Encuestas del servidor'],
    ['Hilos', 'hilos', 'Hilos creados y eliminados'], ['Voz', 'voz', 'Entradas y salidas de canales de voz'],
    ['Streams', 'streams', 'Transmisiones y cámara'], ['Eventos', 'eventos', 'Eventos programados'],
    ['Invitaciones', 'invitaciones', 'Invitaciones creadas y usadas'], ['Canales', 'canales', 'Canales creados y eliminados'],
    ['Permisos', 'permisos', 'Cambios de permisos'], ['Servidor', 'servidor', 'Cambios de configuración del servidor'],
    ['Webhooks', 'webhooks', 'Webhooks'], ['Integraciones', 'integraciones', 'Integraciones del servidor'],
    ['Emojis Y Stickers', 'emojis', 'Emojis y stickers'], ['Automod De Discord', 'automod', 'AutoMod y filtro de palabras'],
    ['Timeout', 'timeout', 'Timeouts de miembros'], ['Expulsiones', 'expulsiones', 'Expulsiones'],
    ['Baneos', 'baneos', 'Baneos y desbaneos'], ['Advertencias', 'advertencias', 'Advertencias de moderación'],
    ['Moderación General', 'moderacion_general', 'Acciones de moderación'], ['Defensa Mundial', 'defensa', 'Anti-raid y bloqueos de emergencia'],
    ['Tickets', 'tickets', 'Tickets abiertos y cerrados'], ['Solicitudes', 'solicitudes', 'Solicitudes y postulaciones'],
    ['Sentinel Config', 'sentinel', 'Cambios de configuración de seguridad'],
  ]],
  ['🛡️ SEGURIDAD', [
    ['Blacklist', 'blacklist', 'Usuarios en lista negra'], ['Blacklist Compartida', 'blacklist_compartida', 'Listas compartidas'],
    ['Anti Alt Señales', 'anti_alt', 'Cuentas nuevas o sospechosas'], ['Evasión', 'evasion', 'Intentos de evadir sanciones'],
    ['Alertas De Incorporate', 'alertas_incorporate', 'Alertas al entrar miembros'], ['Verificación De Miembros', 'verificacion_miembros', 'Verificación de nuevos miembros'],
    ['Captcha', 'captcha', 'Captchas de verificación'], ['Cuarentena', 'cuarentena', 'Miembros en cuarentena'],
    ['Apelaciones', 'apelaciones', 'Apelaciones de sanciones'],
  ]],
  ['🎙️ LOGS DE VOZ', [
    ['Mover De Canal', 'voz_mover', 'Staff que mueve a alguien de canal de voz'], ['Desconexiones', 'voz_desconexion', 'Staff que desconecta a alguien'],
    ['Mutes', 'voz_mute', 'Staff que mutea a alguien'], ['Ensordecidos', 'voz_sordo', 'Staff que ensordece a alguien'],
  ]],
  ['📌 EXTRA', [
    ['Logros', 'logros', 'Logros desbloqueados'], ['Reportes', 'reportes', 'Reportes de usuarios'],
    ['Sugerencias', 'sugerencias', 'Sugerencias del servidor', true],
  ]],
];
// Tipos "de siempre" que usa el bot internamente -> canal propio de cada uno (así todo queda enlazado solo)
const LOG_ALIAS = { general: 'servidor', mod: 'moderacion_general', seguridad: 'automod', verif: 'verificacion_miembros', tickets: 'tickets', invitaciones: 'invitaciones', logros: 'logros', reportes: 'reportes', sugerencias: 'sugerencias' };
def('log', 'servidor', 'Crea todos los canales de log (uno por evento) y los configura solos', '', 'Administrator', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 });
  const guild = i.guild, hechos = [], ya = [], fallos = [];
  for (const [catNombre, canales] of LOG_CANALES) {
    let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === catNombre);
    if (!cat) cat = await guild.channels.create({ name: catNombre, type: ChannelType.GuildCategory, permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
      { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageChannels] }] }).catch(e => { fallos.push(`${catNombre} (${e.message})`); return null; });
    if (!cat) continue;
    for (const [nombre, key, desc, publico] of canales) {
      const viejo = cf.logch[key] && guild.channels.cache.get(cf.logch[key]);
      if (viejo) { ya.push(nombre); continue; }
      const ch = await guild.channels.create({ name: `・${nombre}`, type: ChannelType.GuildText, parent: cat.id, topic: desc,
        ...(publico ? { permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [P.ViewChannel], deny: [P.SendMessages] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] }] } : {}) })
        .catch(e => { fallos.push(`${nombre} (${e.message})`); return null; });
      if (ch) { cf.logch[key] = ch.id; hechos.push(nombre); }
    }
  }
  for (const [tipo, key] of Object.entries(LOG_ALIAS)) if (cf.logch[key]) cf.logch[tipo] = cf.logch[key];
  save();
  const aviso = guild.members.me.permissions.has(P.ViewAuditLog) ? '' : '\n⚠️ Al bot le falta **Ver registro de auditoría**: sin él no puede saber quién hizo cada acción de staff.';
  await i.editReply({ content: (`📜 **Logs configurados automáticamente**\n✅ Creados: **${hechos.length}**\n↪️ Ya existían: **${ya.length}**${fallos.length ? `\n⚠️ Fallos: ${fallos.join(', ')}` : ''}\n\nCada evento ya escribe en su propio canal. Solo los administradores ven estos canales.${aviso}`).slice(0, 1900) });
});

/* ============================== 5. NIVELES (13) ============================== */
/* Tarjeta estilo "MC NIVEL": imagen arriba · línea · título · línea · texto · barra lateral de color */
function card(gid, title, text, img) {
  if (!ContainerBuilder) return { embeds: [E(gid, title, text, img)] }; // discord.js viejo: cae a embed normal
  const c = new ContainerBuilder().setAccentColor(0x9B30FF);
  const line = () => c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  if (url(img)) { c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(img))); line(); }
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`)); line();
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [c], flags: 1 << 15 }; // IsComponentsV2
}
async function addXp(mem, amt, ch) {
  const gid = mem.guild.id, u = U(gid, mem.id), cf = C(gid), g = G(gid); u.xp += amt; let up = false;
  while (u.xp >= need(u.lvl)) { u.xp -= need(u.lvl); u.lvl++; up = true; }
  while (u.xp < 0 && u.lvl > 0) { u.lvl--; u.xp += need(u.lvl); } if (u.xp < 0) u.xp = 0;
  if (up && amt > 0) {
    for (const [lv, rid] of Object.entries(g.levelroles)) if (u.lvl >= +lv) mem.roles.add(rid).catch(() => {});
    const c = (cf.lvlch && mem.guild.channels.cache.get(cf.lvlch)) || ch;
    const img = await nivelArchivo(gid, mem.user, u, true);
    c?.send(anuncioNivel(mem, u, cf, img)).catch(() => {});
  }
  save(); await checkAch(mem, ch);
}
/* XP por CUALQUIER actividad: mensajes, comandos, reacciones y voz */
const xpAmt = cf => rnd(Math.max(1, cf.xprate - 5), cf.xprate + 5);
async function actXp(mem, ch, key, ms) {
  if (!mem || mem.user?.bot) return;
  const cf = C(mem.guild.id); if (!cf.lvlon) return;
  const u = U(mem.guild.id, mem.id); if (cd(u, key, ms)) return;
  await addXp(mem, xpAmt(cf), ch);
}
const ranking = gid => Object.entries(G(gid).users).sort((a, b) => b[1].lvl - a[1].lvl || b[1].xp - a[1].xp);
// ---- Tarjeta de nivel (imagen). Se edita con /nivel fondo, /nivel marca y /nivel color ----
const NIV_FONDOS = new Map(), NIV_ICONOS = new Map();
async function nivelFondo(src) { // imagen o GIF (se usa el primer cuadro del GIF)
  if (!src || !CV) return null;
  if (NIV_FONDOS.has(src)) return NIV_FONDOS.get(src);
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8e6) return null;
    const img = await CV.loadImage(buf);
    if (NIV_FONDOS.size > 30) NIV_FONDOS.delete(NIV_FONDOS.keys().next().value);
    NIV_FONDOS.set(src, img); return img;
  } catch (e) { console.warn('[nivel] no pude cargar el fondo:', e.message); return null; }
}
const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const hexPath = (ctx, cx, cy, r) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2, px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); };
const starPath = (ctx, cx, cy, R, r) => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const rad = k % 2 ? r : R, a = Math.PI / 5 * k - Math.PI / 2, px = cx + rad * Math.cos(a), py = cy + rad * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); };
function dibujarNivel(ctx, d) {
  const W = 1000, H = 320, col = d.color, F = 'Bahnschrift, Arial, sans-serif';
  ctx.save(); roundRect(ctx, 2, 2, W - 4, H - 4, 26); ctx.clip();
  if (d.fondo) { const s = Math.max(W / d.fondo.width, H / d.fondo.height), w = d.fondo.width * s, h = d.fondo.height * s; ctx.drawImage(d.fondo, (W - w) / 2, (H - h) / 2, w, h); }
  else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b0d12'); g.addColorStop(1, '#1a2028'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(5,6,9,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  roundRect(ctx, 2, 2, W - 4, H - 4, 26); ctx.strokeStyle = 'rgba(255,255,255,0.30)'; ctx.lineWidth = 2; ctx.stroke();
  const soft = 'rgba(235,238,242,0.78)';
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = soft; ctx.font = `500 16px ${F}`;
  if (d.icono) { ctx.save(); ctx.beginPath(); ctx.arc(58, 44, 18, 0, Math.PI * 2); ctx.closePath(); ctx.clip(); ctx.drawImage(d.icono, 40, 26, 36, 36); ctx.restore(); ctx.beginPath(); ctx.arc(58, 44, 18, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = '#ffffff'; ctx.font = `600 20px ${F}`; ctx.fillText(d.izq || d.servidor || d.marca, d.icono ? 86 : 40, 51); ctx.fillStyle = soft; ctx.font = `500 16px ${F}`;
  ctx.textAlign = 'right'; ctx.fillText(d.der || `${d.marca} • GG`, W - 40, 52);
  hexPath(ctx, 135, 160, 82); ctx.fillStyle = 'rgba(18,20,26,0.9)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
  hexPath(ctx, 135, 160, 66); ctx.strokeStyle = 'rgba(240,242,245,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  starPath(ctx, 135, 160, 40, 17); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = `600 40px ${F}`;
  const nombre = String(d.nombre).slice(0, 22); ctx.fillText(nombre, 250, 118);
  ctx.fillStyle = col; ctx.font = `500 22px ${F}`; ctx.fillText(`#${d.puesto || '—'}`, 250 + ctx.measureText(nombre).width + 14, 112);
  ctx.fillStyle = soft; ctx.font = `500 16px ${F}`; ctx.fillText('CADA CONVERSACIÓN CUENTA', 250, 146);
  ctx.fillStyle = '#ffffff'; ctx.font = `500 28px ${F}`; ctx.fillText(`${fn(d.xpActual)} / ${fn(d.xpNecesario)} XP`, 250, 210);
  const bx = 250, by = 226, bw = 700, bh = 10, p = Math.max(0, Math.min(1, d.xpActual / d.xpNecesario)), fw = Math.max(bh, bw * p);
  roundRect(ctx, bx, by, bw, bh, 5); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  roundRect(ctx, bx, by, fw, bh, 5); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.arc(bx + fw, by + bh / 2, 9, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  if (d.nuevo && !d.sinnuevo) { // "NUEVO NIVEL" con degradado y brillo
    ctx.textAlign = 'center'; ctx.font = `italic 700 66px ${F}`;
    const g = ctx.createLinearGradient(440, 0, 960, 0); g.addColorStop(0, '#e9e9ee'); g.addColorStop(0.5, col); g.addColorStop(1, '#ffd166');
    ctx.fillStyle = g; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillText('NUEVO NIVEL', 700, 205); ctx.shadowBlur = 0;
  }
  ctx.textAlign = 'right'; ctx.fillStyle = soft; ctx.font = `500 16px ${F}`; ctx.fillText('NIVEL', W - 50, 92);
  ctx.fillStyle = '#ffffff'; ctx.font = `600 70px ${F}`; ctx.fillText(String(d.nivel).padStart(2, '0'), W - 50, 150);
  ctx.textAlign = 'left'; ctx.fillStyle = soft; ctx.font = `500 16px ${F}`; ctx.fillText(`${fn(d.total)} XP TOTALES`, 250, 292);
  ctx.textAlign = 'right'; ctx.fillText(`PUESTO ${d.puesto || '—'}`, W - 50, 292);
}
async function nivelArchivo(gid, user, u, nuevo = false) { // devuelve la imagen lista para Discord, o null si no se puede dibujar
  if (!CV) return null;
  try {
    const t = C(gid).tarjeta || {}, puesto = ranking(gid).findIndex(x => x[0] === user.id) + 1;
    const fondo = t.fondo ? await nivelFondo(t.fondo) : null;
    const total = u.xp + 40 * u.lvl + 10 * u.lvl * (u.lvl - 1); // XP acumulado desde el nivel 0
    const gu = client.guilds.cache.get(gid); let icono = null;
    try { const iu = gu?.iconURL({ extension: 'png', size: 128 }); if (iu) { if (!NIV_ICONOS.has(iu)) { const r = await fetch(iu, { signal: AbortSignal.timeout(6000) }); if (r.ok) NIV_ICONOS.set(iu, await CV.loadImage(Buffer.from(await r.arrayBuffer()))); } icono = NIV_ICONOS.get(iu) || null; } } catch {}
    const cv = CV.createCanvas(1000, 320);
    dibujarNivel(cv.getContext('2d'), { icono, servidor: gu?.name, sinnuevo: t.sinnuevo, izq: t.izq, der: t.der, fondo, marca: t.marca || 'Kuboq', color: t.color || '#22d3ee', nombre: user.displayName || user.username, puesto: puesto || null, nivel: u.lvl, xpActual: u.xp, xpNecesario: need(u.lvl), total, nuevo });
    return new AttachmentBuilder(await cv.encode('png'), { name: 'nivel.png' });
  } catch (e) { console.warn('[nivel] no pude dibujar la tarjeta:', e.message); return null; }
}
// Anuncio de subida de nivel: encabezado, texto, tarjeta con NUEVO NIVEL, avatar a la derecha y pie con el nombre de la marca
function anuncioNivel(mem, u, cf, img) {
  const t = cf.tarjeta || {}, marca = t.marca || 'Kuboq', col = /^#[0-9a-f]{6}$/i.test(t.color || '') ? parseInt(t.color.slice(1), 16) : 0x22d3ee;
  const custom = cf.lvlmsg && cf.lvlmsg !== LVL_MSG && cf.lvlmsg !== LVL_OLD;
  const texto = custom ? fmt(cf.lvlmsg, { user: `${mem}`, level: u.lvl, server: mem.guild.name })
    : `✨ ${mem} ha alcanzado el nivel **${u.lvl}** dentro de nuestra comunidad. Agradecemos tu participación, actividad y el tiempo que compartes con nosotros. ✨!`;
  const e = new EmbedBuilder().setColor(col).setAuthor({ name: mem.guild.name, iconURL: mem.guild.iconURL({ size: 64 }) || undefined })
    .setTitle(cf.lvltitle || '✨ Cada conversación deja huella').setDescription(texto)
    .setThumbnail(mem.user.displayAvatarURL({ size: 256 })).setFooter({ text: `${marca} · Tu comunidad, a tu ritmo` }).setTimestamp();
  if (img) e.setImage('attachment://nivel.png');
  else if (url(cf.lvlimg)) e.setImage(cf.lvlimg);
  return { embeds: [e], files: img ? [img] : [] };
}
def('nivel', 'rank', 'Ver tu tarjeta de nivel', 'usuario:u', null, async (i, o, g, cf) => {
  const t = o.usuario || i.user, u = U(i.guildId, t.id);
  if (!CV) { const pos = ranking(i.guildId).findIndex(x => x[0] === t.id) + 1; return i.reply(card(i.guildId, `📊 Rango de ${t.username}`, `**Nivel:** ${u.lvl}\n**XP:** ${fn(u.xp)}/${fn(need(u.lvl))}\n\`${bar(u.xp / need(u.lvl))}\`\n**Puesto:** #${pos || '—'}\n**Mensajes:** ${fn(u.msgs)}`, cf.rankimg)); }
  await i.deferReply();
  const f = await nivelArchivo(i.guildId, t, u);
  await i.editReply(f ? { files: [f] } : '⚠️ No pude dibujar la tarjeta. Revisa que esté instalado @napi-rs/canvas.');
});
def('nivel', 'vista', 'Vista previa de tu tarjeta, con el texto NUEVO NIVEL', '', 'Administrator', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 });
  const f = await nivelArchivo(i.guildId, i.user, U(i.guildId, i.user.id), true);
  await i.editReply(anuncioNivel(i.member, U(i.guildId, i.user.id), cf, f));
});
def('nivel', 'fondo', 'Imagen o GIF de fondo de la tarjeta (link https). Escribe "quitar" para quitarlo', 'url:s!', 'Administrator', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 }); cf.tarjeta ??= {};
  if (o.url.trim().toLowerCase() === 'quitar') { delete cf.tarjeta.fondo; save(); return i.editReply('🖼️ Listo: la tarjeta vuelve al degradado morado.'); }
  if (!url(o.url.trim())) return i.editReply('⚠️ El link tiene que empezar con https://');
  if (!CV) return i.editReply('⚠️ Falta instalar @napi-rs/canvas (npm install).');
  if (!(await nivelFondo(o.url.trim()))) return i.editReply('⚠️ No pude abrir esa imagen. Usa un link directo a un .png, .jpg o .gif de menos de 8 MB.');
  cf.tarjeta.fondo = o.url.trim(); save();
  i.editReply('🖼️ Fondo guardado. Usa `/nivel vista` para verlo. (Si es GIF, la tarjeta muestra el primer cuadro.)');
});
def('nivel', 'marca', 'Textos de arriba de la tarjeta: texto (marca), izquierda y derecha. "quitar" restaura', 'texto:s,izquierda:s,derecha:s', 'Administrator', (i, o, g, cf) => {
  cf.tarjeta ??= {}; const t = cf.tarjeta, rs = v => /^(quitar|reset)$/i.test(v.trim());
  if (o.texto) t.marca = o.texto.trim().slice(0, 30) || 'Kuboq';
  if (o.izquierda) { if (rs(o.izquierda)) delete t.izq; else t.izq = o.izquierda.trim().slice(0, 40); }
  if (o.derecha) { if (rs(o.derecha)) delete t.der; else t.der = o.derecha.trim().slice(0, 40); }
  save(); ok(i, `✅ Arriba a la izquierda: **${t.izq || `${t.marca || 'Kuboq'}  /  TU RECORRIDO`}**\nArriba a la derecha: **${t.der || `${t.marca || 'Kuboq'} • GG`}**`);
});
def('nivel', 'textonuevo', 'Muestra u oculta el texto "NUEVO NIVEL" de la tarjeta al subir de nivel', 'estado:b!', 'Administrator', (i, o, g, cf) => {
  cf.tarjeta ??= {}; cf.tarjeta.sinnuevo = !o.estado; save(); ok(i, o.estado ? '✅ El texto **NUEVO NIVEL** se mostrará al subir de nivel.' : '✅ El texto **NUEVO NIVEL** ya no aparecerá en la tarjeta.');
});
def('nivel', 'color', 'Color de la barra y del acento (ej. #a855f7)', 'color:s!', 'Administrator', (i, o, g, cf) => {
  if (!/^#[0-9a-f]{6}$/i.test(o.color.trim())) return no(i, 'Usa el formato #rrggbb, por ejemplo #a855f7.');
  cf.tarjeta ??= {}; cf.tarjeta.color = o.color.trim(); save(); ok(i, `✅ Color guardado: ${cf.tarjeta.color}`);
});
def('nivel', 'top', 'Top de niveles', '', null, (i) => {
  const r = ranking(i.guildId).slice(0, 10); say(i, '🏆 Top niveles', r.length ? r.map((x, n) => `**${n + 1}.** <@${x[0]}> — Nivel **${x[1].lvl}** (${fn(x[1].xp)} XP)`).join('\n') : 'Sin datos aún.');
});
def('nivel', 'set', 'Establece el nivel de un usuario', 'usuario:u!,nivel:i!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.lvl = Math.max(0, o.nivel); u.xp = 0; save(); ok(i, `${o.usuario} ahora es nivel **${u.lvl}**.`); });
def('nivel', 'xpadd', 'Da XP a un usuario', 'usuario:u!,cantidad:i!', 'Administrator', async (i, o) => { const m = await M(i, o.usuario); await addXp(m, o.cantidad, i.channel); ok(i, `+${fn(o.cantidad)} XP a ${m}.`); });
def('nivel', 'xpremove', 'Quita XP a un usuario', 'usuario:u!,cantidad:i!', 'Administrator', async (i, o) => { const m = await M(i, o.usuario); await addXp(m, -o.cantidad, i.channel); ok(i, `-${fn(o.cantidad)} XP a ${m}.`); });
def('nivel', 'rate', 'XP medio por mensaje (1-100)', 'cantidad:i!', 'Administrator', (i, o, g, cf) => { cf.xprate = Math.min(100, Math.max(1, o.cantidad)); save(); ok(i, `XP por mensaje ≈ **${cf.xprate}**.`); });
def('nivel', 'canal', 'Canal de avisos de nivel', 'canal:c', 'Administrator', (i, o, g, cf) => { cf.lvlch = o.canal?.id || null; save(); ok(i, o.canal ? `Avisos en ${o.canal}` : 'Avisos en el canal del mensaje.'); });
def('nivel', 'roladd', 'Rol de recompensa por nivel', 'nivel:i!,rol:r!', 'Administrator', (i, o, g) => { g.levelroles[o.nivel] = o.rol.id; save(); ok(i, `Nivel **${o.nivel}** → ${o.rol}`); });
def('nivel', 'rolremove', 'Quita rol de recompensa', 'nivel:i!', 'Administrator', (i, o, g) => { delete g.levelroles[o.nivel]; save(); ok(i, 'Recompensa eliminada.'); });
def('nivel', 'roles', 'Ver roles de recompensa', '', null, (i, o, g) => { const r = Object.entries(g.levelroles); say(i, '🎁 Recompensas', r.length ? r.map(([l, id]) => `Nivel **${l}** → <@&${id}>`).join('\n') : 'Ninguna.'); });
def('nivel', 'mensaje', 'Mensaje/imagen de subida. {user} {level} {server}', 'texto:s,imagen:s,titulo:s', 'Administrator', (i, o, g, cf) => { if (o.texto) cf.lvlmsg = nl(o.texto); if (o.titulo) cf.lvltitle = o.titulo; if (url(o.imagen)) cf.lvlimg = o.imagen; save(); ok(i, 'Personalización guardada.'); });
def('nivel', 'reset', 'Reinicia niveles de un usuario', 'usuario:u!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.xp = 0; u.lvl = 0; save(); ok(i, `Niveles de ${o.usuario} reiniciados.`); });
def('nivel', 'toggle', 'Activa/desactiva el sistema de niveles', 'estado:b!', 'Administrator', (i, o, g, cf) => { cf.lvlon = o.estado; save(); ok(i, `Niveles ${o.estado ? 'activados' : 'desactivados'}.`); });

/* ============================== 6. ECONOMÍA (25) ============================== */
const bal = (u, o2) => `💵 Cartera: **${fn(u.coins)}**\n🏦 Banco: **${fn(u.bank)}**\n📊 Total: **${fn(u.coins + u.bank)}**`;
const balFull = (u, cur) => `💵 **Cartera:** ${fn(u.coins)} ${cur}\n🏦 **Banco:** ${fn(u.bank)} ${cur}\n━━━━━━━━━━━━━━\n💰 **Total:** ${fn(u.coins + u.bank)} ${cur}`;
/* ---- Tarjetas de economía: las publica el BOT en el canal (sin "usó /comando"), mismo estilo del ejemplo ---- */
const bx = n => `\`${fn(n)}\``;
const ecoMult = u => 1 + Math.min(Math.floor((u.lvl || 0) / 10) * 0.1, 2); // +0.1x cada 10 niveles (máx. 3x)
const mx = m => `\`${+m.toFixed(1)}x\``;
function ecoStreak(u, key, win) { const s = ((u.streak ??= {})[key] ??= { n: 0, last: 0 }), now = Date.now(); s.n = s.last && now - s.last <= win ? s.n + 1 : 1; s.last = now; return s.n; }
async function ecoDone(i, u, { head, intro, amt = 0, xp = 0, body, foot = [], lvlfoot = false }) {
  const cf = C(i.guildId), mon = n => `${bx(n)} ${cf.cur} Monedas`;
  u.coins = Math.max(0, u.coins + amt); save();
  if (xp > 0) await addXp(i.member, xp, i.channel).catch(() => {});
  const lines = []; if (intro) lines.push(intro, '');
  lines.push(...body({ mon, lvl: u.lvl, xp }), '', `💵 **Nuevo saldo:** ${mon(u.coins)}`);
  const fl = [...foot]; if (lvlfoot && xp > 0) fl.push(`Lo siguiente: Llega al nivel ${u.lvl + 1} — ${fn(u.xp)}/${fn(need(u.lvl))} XP · \`/nivel rank\``);
  const small = fl.map(x => `-# ${x}`).join('\n'); let p;
  if (ContainerBuilder) {
    const c = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${head}`), new TextDisplayBuilder().setContent(lines.join('\n')));
    if (fl.length) c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)).addTextDisplayComponents(new TextDisplayBuilder().setContent(small));
    p = { components: [c], flags: 1 << 15, allowedMentions: { parse: [] } };
  } else p = { embeds: [E(i.guildId, head, `${lines.join('\n')}${small ? `\n\n${small}` : ''}`)], allowedMentions: { parse: [] } };
  await i.reply(p); // respuesta normal: aparece "usó /comando" arriba, como en el ejemplo
  checkAch(i.member, i.channel);
}
// Juegos y crimen: mismo estilo (sin XP ni multiplicador)
const reward = (i, u, amt, text) => ecoDone(i, u, { head: text, amt, body: c => [amt >= 0 ? `💰 **Monedas ganadas:** ${c.mon(amt)}` : `💸 **Monedas perdidas:** ${c.mon(-amt)}`] });
def('eco', 'balance', 'Ver tu dinero: cartera, banco y total', 'usuario:u', null, (i, o, g, cf) => { const t = o.usuario || i.user, u = U(i.guildId, t.id); i.reply(card(i.guildId, `${cf.cur} Balance de ${t.username}`, balFull(u, cf.cur), cf.ecoimg)); });
def('daily', 'run', 'Recibe tu recompensa diaria', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'daily', 864e5); if (r) return no(i, `Vuelve ${when(r)}`);
  const n = ecoStreak(u, 'daily', 1728e5), m = ecoMult(u), amt = Math.round(rnd(500, 800) * m) + Math.min(n - 1, 30) * 25;
  return ecoDone(i, u, { head: '💎 ¡Recompensa diaria recibida!', amt, xp: rnd(40, 70), foot: [`Mañana: +${fn(Math.min(n, 30) * 25)} Monedas por la racha ${n + 1}.`],
    body: c => [`💰 **Monedas recibidas:** ${c.mon(amt)}`, `⭐ **XP recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `🔥 **Racha:** ${bx(n)} Días`, `📈 **Bonificación por nivel:** ${mx(m)}`] });
});
def('eco', 'weekly', 'Recompensa semanal', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'weekly', 6048e5); if (r) return no(i, `Vuelve ${when(r)}`);
  const n = ecoStreak(u, 'weekly', 12096e5), m = ecoMult(u), amt = Math.round(rnd(3000, 5000) * m) + Math.min(n - 1, 20) * 100;
  return ecoDone(i, u, { head: '🎁 ¡Recompensa semanal recibida!', amt, xp: rnd(150, 250), foot: [`Próxima semana: +${fn(Math.min(n, 20) * 100)} Monedas por la racha ${n + 1}.`],
    body: c => [`💰 **Monedas recibidas:** ${c.mon(amt)}`, `⭐ **XP recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `🔥 **Racha:** ${bx(n)} Semanas`, `📈 **Bonificación por nivel:** ${mx(m)}`] });
});
def('work', 'run', 'Trabaja y gana monedas (1h)', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'work', 36e5); if (r) return no(i, `Descansa, vuelve ${when(r)}`);
  const [job, em] = R([['Fotógrafo', '📸'], ['Programador', '💻'], ['Barista', '☕'], ['Repartidor de pizzas', '🍕'], ['Diseñador gráfico', '🎨'], ['Streamer', '🎥'], ['Mecánico', '🔧']]);
  const n = ecoStreak(u, 'work', 108e5), m = ecoMult(u), amt = Math.round(rnd(100, 400) * m) + Math.min(n - 1, 20) * 5;
  return ecoDone(i, u, { head: `${em} ¡Trabajo completado!`, intro: `Trabajaste como **${job}**`, amt, xp: rnd(25, 50), lvlfoot: true, foot: [`Próximo trabajo: +${fn(Math.min(n, 20) * 5)} Monedas por la racha ${n + 1}.`],
    body: c => [`💰 **Ganancias:** ${c.mon(amt)}`, `⭐ **XP recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `🔥 **Racha de trabajo:** ${bx(n)} Jobs`, '🚀 **Multiplicadores:**', `📈 Level: ${mx(m)}`] });
});
def('eco', 'crime', 'Comete un crimen (2h)', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'crime', 72e5); if (r) return no(i, `Vuelve ${when(r)}`);
  if (Math.random() < 0.5) reward(i, u, rnd(300, 800), '🦹 ¡Crimen exitoso!'); else reward(i, u, -Math.min(u.coins, rnd(100, 300)), '🚔 Te atraparon');
});
def('eco', 'rob', 'Roba a un usuario (3h)', 'usuario:u!', null, (i, o) => {
  if (o.usuario.id === i.user.id || o.usuario.bot) return no(i, 'Objetivo inválido.');
  const u = U(i.guildId, i.user.id), t = U(i.guildId, o.usuario.id), r = cd(u, 'rob', 108e5); if (r) return no(i, `Vuelve ${when(r)}`);
  if (t.coins < 100) return no(i, 'Ese usuario no tiene suficiente en cartera.');
  if (Math.random() < 0.4) { const a = rnd(1, Math.floor(t.coins * 0.3)); t.coins -= a; reward(i, u, a, `🥷 Robaste a ${o.usuario.username}`); }
  else { const f = Math.min(u.coins, 200); t.coins += f; reward(i, u, -f, '🚔 Te pillaron robando'); }
});
def('eco', 'deposit', 'Deposita en el banco', 'cantidad:i', null, (i, o) => { const u = U(i.guildId, i.user.id), a = o.cantidad ?? u.coins; if (a <= 0 || a > u.coins) return no(i, 'Cantidad inválida.'); u.coins -= a; u.bank += a; save(); ok(i, `Depositaste **${fn(a)}**.\n${bal(u)}`); });
def('eco', 'withdraw', 'Retira del banco', 'cantidad:i', null, (i, o) => { const u = U(i.guildId, i.user.id), a = o.cantidad ?? u.bank; if (a <= 0 || a > u.bank) return no(i, 'Cantidad inválida.'); u.bank -= a; u.coins += a; save(); ok(i, `Retiraste **${fn(a)}**.\n${bal(u)}`); });
def('eco', 'pay', 'Paga a otro usuario', 'usuario:u!,cantidad:i!', null, (i, o) => {
  const u = U(i.guildId, i.user.id); if (o.usuario.bot || o.usuario.id === i.user.id || o.cantidad <= 0 || o.cantidad > u.coins) return no(i, 'Pago inválido.');
  u.coins -= o.cantidad; U(i.guildId, o.usuario.id).coins += o.cantidad; save(); ok(i, `Pagaste **${fn(o.cantidad)}** a ${o.usuario}.`);
});
def('eco', 'shop', 'Ver la tienda', '', null, (i, o, g, cf) => say(i, '🛒 Tienda', g.items.length ? g.items.map(x => `**${x.name}** — ${fn(x.price)} ${cf.cur}\n${x.desc || ''}${x.role ? ` (da <@&${x.role}>)` : ''}`).join('\n\n') : 'La tienda está vacía.'));
def('eco', 'buy', 'Compra un item', 'item:s!,cantidad:i', null, async (i, o, g, cf) => {
  const it = g.items.find(x => x.name.toLowerCase() === o.item.toLowerCase()); if (!it) return no(i, 'Ese item no existe.');
  const q = Math.max(1, o.cantidad || 1), u = U(i.guildId, i.user.id), tot = it.price * q; if (u.coins < tot) return no(i, `Necesitas **${fn(tot)}** en cartera.`);
  u.coins -= tot; u.items[it.name] = (u.items[it.name] || 0) + q; if (it.role) await i.member.roles.add(it.role).catch(() => {}); save(); ok(i, `Compraste **${q}x ${it.name}** por ${fn(tot)} ${cf.cur}.`);
});
def('eco', 'inventory', 'Ver tu inventario', 'usuario:u', null, (i, o) => { const t = o.usuario || i.user, it = Object.entries(U(i.guildId, t.id).items); say(i, `🎒 Inventario de ${t.username}`, it.length ? it.map(([n, q]) => `**${n}** x${q}`).join('\n') : 'Vacío.'); });
def('eco', 'itemadd', 'Añade un item a la tienda', 'nombre:s!,precio:i!,descripcion:s,rol:r', 'Administrator', (i, o, g) => { g.items.push({ name: o.nombre, price: o.precio, desc: o.descripcion, role: o.rol?.id }); save(); ok(i, `Item **${o.nombre}** añadido.`); });
def('eco', 'itemremove', 'Quita un item de la tienda', 'nombre:s!', 'Administrator', (i, o, g) => { g.items = g.items.filter(x => x.name.toLowerCase() !== o.nombre.toLowerCase()); save(); ok(i, 'Item eliminado.'); });
def('eco', 'top', 'Top de más ricos', '', null, (i, o, g) => { const r = Object.entries(g.users).sort((a, b) => b[1].coins + b[1].bank - a[1].coins - a[1].bank).slice(0, 10); say(i, '💰 Top ricos', r.map((x, n) => `**${n + 1}.** <@${x[0]}> — ${fn(x[1].coins + x[1].bank)}`).join('\n') || 'Sin datos.'); });
def('eco', 'coinflip', 'Apuesta cara o cruz', 'apuesta:i!,lado:s!', null, (i, o) => {
  const u = U(i.guildId, i.user.id), l = o.lado.toLowerCase(); if (!['cara', 'cruz'].includes(l) || o.apuesta <= 0 || o.apuesta > u.coins) return no(i, 'Apuesta o lado inválido (cara/cruz).');
  const res = R(['cara', 'cruz']); reward(i, u, res === l ? o.apuesta : -o.apuesta, `🪙 Salió **${res}** — ${res === l ? '¡Ganaste!' : 'Perdiste'}`);
});
def('eco', 'slots', 'Tragaperras', 'apuesta:i!', null, (i, o) => {
  const u = U(i.guildId, i.user.id); if (o.apuesta <= 0 || o.apuesta > u.coins) return no(i, 'Apuesta inválida.');
  const s = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'], r = [R(s), R(s), R(s)], n = new Set(r).size;
  const mult = n === 1 ? (r[0] === '7️⃣' ? 10 : 5) : n === 2 ? 1.5 : 0; reward(i, u, mult ? Math.floor(o.apuesta * mult) - o.apuesta + (mult === 1.5 ? 0 : 0) : -o.apuesta, `🎰 ${r.join(' ')}`);
});
def('eco', 'dados', 'Dados contra el bot', 'apuesta:i!', null, (i, o) => {
  const u = U(i.guildId, i.user.id); if (o.apuesta <= 0 || o.apuesta > u.coins) return no(i, 'Apuesta inválida.');
  const a = rnd(2, 12), b = rnd(2, 12); reward(i, u, a > b ? o.apuesta : a < b ? -o.apuesta : 0, `🎲 Tú: **${a}** · Bot: **${b}**`);
});
for (const [n, em, head, place, pe, coinL, finds, fe, lo, hi] of [
  ['mine', '⛏️', '¡Sesión de Minería Completa!', ['Mina Profunda', 'Cueva de Cristal', 'Montaña Rocosa', 'Veta Dorada'], '🏔️', 'Monedas Minadas', ['Hierro', 'Oro', 'Diamante', 'Esmeralda'], '💎', 80, 350],
  ['hunt', '🏹', '¡Cacería Completa!', ['Bosque Oscuro', 'Valle Verde', 'Colinas del Norte', 'Pantano Sombrío'], '🌲', 'Monedas Cazadas', ['Conejo', 'Ciervo', 'Jabalí', 'Faisán'], '🦌', 60, 300]])
  def('eco', n, `${n} (30 min)`, '', null, (i) => {
    const u = U(i.guildId, i.user.id), r = cd(u, n, 18e5); if (r) return no(i, `Vuelve ${when(r)}`);
    const m = ecoMult(u), amt = Math.round(rnd(lo, hi) * m), find = Math.random() < 0.3 ? R(finds) : null; if (find) u.items[find] = (u.items[find] || 0) + 1; // los hallazgos van al inventario
    return ecoDone(i, u, { head: `${em} ${head}`, intro: `${n === 'fish' ? 'Pescaste' : n === 'mine' ? 'Minaste' : 'Cazaste'} en ${pe} **${R(place)}**`, amt, xp: rnd(15, 35),
      body: c => [`💰 **${coinL}:** ${c.mon(amt)}`, `⭐ **XP Recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `📈 **Bonificación de Nivel:** ${mx(m)} Multiplicador`, ...(find ? ['', '🎁 **¡Hallazgos Especiales!:**', `${fe} ${find}`] : [])] });
  });
def('fishing', 'collect', 'Pesca y recoge tus ganancias (30 min)', '', null, (i) => {
  const u = U(i.guildId, i.user.id), r = cd(u, 'fish', 18e5); if (r) return no(i, `Vuelve ${when(r)}`);
  const m = ecoMult(u), amt = Math.round(rnd(50, 250) * m), find = Math.random() < 0.3 ? R(['Rainbow Trout', 'Salmón Dorado', 'Pez Espada', 'Carpa Koi']) : null;
  if (find) u.items[find] = (u.items[find] || 0) + 1; // los hallazgos van al inventario
  return ecoDone(i, u, { head: '🎣 ¡Sesión de Pesca Completa!', intro: `Pescaste en 🌊 **${R(['Forest River', 'Lago Cristal', 'Bahía Dorada', 'Río Esmeralda'])}**`, amt, xp: rnd(15, 35),
    body: c => [`💰 **Monedas Pescadas:** ${c.mon(amt)}`, `⭐ **XP Recibida:** ${bx(c.xp)} XP (Level ${c.lvl})`, `📈 **Bonificación de Nivel:** ${mx(m)} Multiplicador`, ...(find ? ['', '🎁 **¡Hallazgos Especiales!:**', `🐟 ${find}`] : [])] });
});
def('eco', 'add', 'Da monedas a un usuario', 'usuario:u!,cantidad:i!', 'Administrator', (i, o) => { U(i.guildId, o.usuario.id).coins += o.cantidad; save(); ok(i, `+${fn(o.cantidad)} a ${o.usuario}.`); });
def('eco', 'remove', 'Quita monedas a un usuario', 'usuario:u!,cantidad:i!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.coins = Math.max(0, u.coins - o.cantidad); save(); ok(i, `-${fn(o.cantidad)} a ${o.usuario}.`); });
def('eco', 'reset', 'Reinicia la economía de un usuario', 'usuario:u!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.coins = 0; u.bank = 0; u.items = {}; save(); ok(i, `Economía de ${o.usuario} reiniciada.`); });
def('eco', 'moneda', 'Cambia el símbolo de la moneda', 'simbolo:s!', 'Administrator', (i, o, g, cf) => { cf.cur = o.simbolo; save(); ok(i, `Moneda: ${o.simbolo}`); });
/* ============================== 7. LOGROS (tarjeta con imagen · voz · cámara · micro · stream · días) ============================== */
/* Para dibujar la tarjeta:  npm i @napi-rs/canvas   (si no está instalado, el logro sale igual pero sin la imagen grande)
   Si en tu hosting el texto sale como cuadritos, crea una carpeta ./fonts y mete ahí un .ttf (por ejemplo Inter o DejaVuSans). */
let CV = null; try { CV = require('@napi-rs/canvas'); } catch { console.warn('[logros] Falta @napi-rs/canvas -> ejecuta: npm i @napi-rs/canvas  (sin él no se dibuja la tarjeta)'); }
if (CV) { // registra las fuentes de ./fonts (ruta absoluta) para que el texto de la tarjeta SIEMPRE se vea
  try {
    const _fp = require('path'), _dir = _fp.join(__dirname, '../../fonts');
    if (fs.existsSync(_dir)) for (const f of fs.readdirSync(_dir)) if (/\.(ttf|otf|woff2?)$/i.test(f)) CV.GlobalFonts.registerFromPath(_fp.join(_dir, f));
    const _fam = (CV.GlobalFonts.families || []).map(x => x.family);
  } catch (e) { console.warn('[logros] error cargando fuentes:', e.message); }
}

/* Dibuja la tarjeta "¡LOGRO DESBLOQUEADO!" en un ctx 2D (compatible con @napi-rs/canvas y con el canvas del navegador) */
const achThemeColor = cf => /^#[0-9a-f]{6}$/i.test(cf?.achcolor || '') ? cf.achcolor : '#8b3dff';
const achShade = (color, factor) => {
  const n = parseInt(color.slice(1), 16), parts = [n >> 16, (n >> 8) & 255, n & 255];
  return '#' + parts.map(value => Math.max(0, Math.min(255, Math.round(value * factor))).toString(16).padStart(2, '0')).join('');
};
const achRgba = (color, alpha) => { const n = parseInt(color.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`; };
function drawAchCard(ctx, W, H, A) {
  const FONT = '"Poppins","Inter","Segoe UI","DejaVu Sans","Noto Sans","Liberation Sans",Arial,sans-serif';
  const PUR = /^#[0-9a-f]{6}$/i.test(A.theme || '') ? A.theme : '#8b3dff', PUR2 = achShade(PUR, .62), LIGHT = achShade(PUR, 1.35), DARK = '#1a1033';
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const spacing = v => { try { ctx.letterSpacing = v; } catch {} };

  // fondo
  ctx.clearRect(0, 0, W, H);
  rr(8, 8, W - 16, H - 16, 44);
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0a0a10'); bg.addColorStop(1, '#171024');
  ctx.fillStyle = bg; ctx.fill();
  // resplandor detrás de la insignia
  const gl = ctx.createRadialGradient(200, H / 2, 10, 200, H / 2, 260); gl.addColorStop(0, achRgba(PUR, .28)); gl.addColorStop(1, achRgba(PUR, 0));
  ctx.save(); rr(8, 8, W - 16, H - 16, 44); ctx.clip(); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  // destellos
  let s = 7; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 26; n++) { const x = 40 + rand() * 340, y = 30 + rand() * (H - 60), r = 1.5 + rand() * 3.5; ctx.globalAlpha = .25 + rand() * .6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
  // borde morado
  rr(8, 8, W - 16, H - 16, 44); const bd = ctx.createLinearGradient(0, 0, W, H); bd.addColorStop(0, LIGHT); bd.addColorStop(1, PUR2);
  ctx.lineWidth = 7; ctx.strokeStyle = bd; ctx.stroke();

  // ---------- insignia ----------
  const cx = 200, cy = H / 2, R = 118;
  const shape = () => {
    ctx.beginPath();
    if (A.shape === 'hex') { for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3 - Math.PI / 2 + Math.PI / 6; const px = cx + Math.cos(an) * R, py = cy + Math.sin(an) * R; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }
    else if (A.shape === 'circle') ctx.arc(cx, cy, R * .98, 0, Math.PI * 2);
    else { // escudo
      const w = R * 1.62, t = cy - R, b = cy + R * 1.05;
      ctx.moveTo(cx - w / 2, t + 6); ctx.quadraticCurveTo(cx - w / 2, t, cx - w / 2 + 14, t); ctx.lineTo(cx + w / 2 - 14, t); ctx.quadraticCurveTo(cx + w / 2, t, cx + w / 2, t + 6);
      ctx.lineTo(cx + w / 2, cy + R * .18); ctx.quadraticCurveTo(cx + w / 2, cy + R * .72, cx, b); ctx.quadraticCurveTo(cx - w / 2, cy + R * .72, cx - w / 2, cy + R * .18); ctx.closePath();
    }
  };
  ctx.save(); ctx.shadowColor = achRgba(PUR, .65); ctx.shadowBlur = 38; shape();
  const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, LIGHT); g.addColorStop(.55, PUR); g.addColorStop(1, PUR2);
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  shape(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
  // brillo
  ctx.save(); shape(); ctx.clip(); const sh = ctx.createLinearGradient(cx, cy - R, cx, cy); sh.addColorStop(0, 'rgba(255,255,255,.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, R * 2, R); ctx.restore();

  // ---------- icono (oscuro sobre morado) ----------
  ctx.save(); ctx.translate(cx, cy + (A.shape === 'shield' ? -4 : 0)); ctx.fillStyle = DARK; ctx.strokeStyle = DARK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ic = A.icon || 'star';
  if (ic === 'clock') { ctx.beginPath(); ctx.arc(0, 0, 52, 0, 7); ctx.fill(); ctx.strokeStyle = LIGHT; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 0); ctx.lineTo(24, 14); ctx.stroke(); }
  else if (ic === 'camera') { rr(-56, -34, 76, 68, 14); ctx.fill(); ctx.beginPath(); ctx.moveTo(30, -10); ctx.lineTo(62, -30); ctx.lineTo(62, 30); ctx.lineTo(30, 10); ctx.closePath(); ctx.fill(); }
  else if (ic === 'mic') { rr(-17, -56, 34, 62, 17); ctx.fill(); ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, -4, 34, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 54); ctx.moveTo(-20, 54); ctx.lineTo(20, 54); ctx.stroke(); }
  else if (ic === 'screen') { rr(-58, -42, 116, 76, 12); ctx.fill(); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-22, 52); ctx.lineTo(22, 52); ctx.moveTo(0, 34); ctx.lineTo(0, 52); ctx.stroke(); ctx.fillStyle = LIGHT; ctx.beginPath(); ctx.moveTo(-12, -22); ctx.lineTo(18, -4); ctx.lineTo(-12, 14); ctx.closePath(); ctx.fill(); }
  else if (ic === 'calendar') { rr(-52, -46, 104, 98, 14); ctx.fill(); ctx.fillStyle = LIGHT; rr(-52, -46, 104, 28, 14); ctx.fill(); ctx.fillRect(-52, -30, 104, 12); ctx.fillStyle = LIGHT; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) rr(-36 + c * 30, -2 + r * 28, 20, 18, 5), ctx.fill(); ctx.fillStyle = DARK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-26, -58); ctx.lineTo(-26, -36); ctx.moveTo(26, -58); ctx.lineTo(26, -36); ctx.stroke(); }
  else if (ic === 'chat') { rr(-58, -44, 116, 76, 22); ctx.fill(); ctx.beginPath(); ctx.moveTo(-26, 26); ctx.lineTo(-30, 56); ctx.lineTo(4, 30); ctx.closePath(); ctx.fill(); ctx.fillStyle = LIGHT; for (const x of [-26, 0, 26]) { ctx.beginPath(); ctx.arc(x, -6, 8, 0, 7); ctx.fill(); } }
  else if (ic === 'coin') { ctx.beginPath(); ctx.arc(0, 0, 56, 0, 7); ctx.fill(); ctx.strokeStyle = LIGHT; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 7); ctx.stroke(); ctx.fillStyle = LIGHT; rr(-8, -24, 16, 48, 6); ctx.fill(); }
  else if (ic === 'mail') { rr(-58, -40, 116, 80, 12); ctx.fill(); ctx.strokeStyle = LIGHT; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-50, -30); ctx.lineTo(0, 8); ctx.lineTo(50, -30); ctx.stroke(); }
  else if (ic === 'trophy') { ctx.beginPath(); ctx.moveTo(-34, -52); ctx.lineTo(34, -52); ctx.lineTo(30, -6); ctx.quadraticCurveTo(0, 30, -30, -6); ctx.closePath(); ctx.fill(); ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(-38, -30, 18, Math.PI * .5, Math.PI * 1.5); ctx.moveTo(38, -48); ctx.arc(38, -30, 18, Math.PI * 1.5, Math.PI * .5); ctx.stroke(); ctx.fillRect(-6, 20, 12, 22); rr(-28, 40, 56, 14, 5); ctx.fill(); }
  else { ctx.beginPath(); for (let k = 0; k < 10; k++) { const rad = k % 2 ? 26 : 58, an = -Math.PI / 2 + k * Math.PI / 5; k ? ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad) : ctx.moveTo(Math.cos(an) * rad, Math.sin(an) * rad); } ctx.closePath(); ctx.fill(); }
  ctx.restore();

  // ---------- textos ----------
  const X = 400, MAXW = W - X - 70; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const label = A.label || '¡LOGRO DESBLOQUEADO!'; let ls = 34; ctx.font = `700 ${ls}px ${FONT}`; while (ctx.measureText(label).width > MAXW && ls > 16) { ls -= 1; ctx.font = `700 ${ls}px ${FONT}`; }
  ctx.fillStyle = PUR; spacing('3px'); ctx.fillText(label, X, 112); spacing('0px');
  let fs = 96; ctx.font = `800 ${fs}px ${FONT}`; while (ctx.measureText(A.name).width > MAXW && fs > 40) { fs -= 4; ctx.font = `800 ${fs}px ${FONT}`; }
  ctx.fillStyle = '#fff'; ctx.fillText(A.name, X, 112 + 14 + fs * .9);
  let ds = 38; ctx.font = `400 ${ds}px ${FONT}`; while (ctx.measureText(A.desc).width > MAXW && ds > 22) { ds -= 2; ctx.font = `400 ${ds}px ${FONT}`; }
  ctx.fillStyle = '#9a9aa8'; ctx.fillText(A.desc, X, 112 + 14 + fs * .9 + 22 + ds);
  // rareza + puntos (abajo a la derecha)
  const right = W - 64, by = H - 52; ctx.textAlign = 'right'; ctx.font = `800 32px ${FONT}`; spacing('1px');
  const pts = `+${A.pts} PTS`, ptsW = ctx.measureText(pts).width; ctx.fillStyle = '#ffd23f'; ctx.fillText(pts, right, by);
  ctx.fillStyle = A.color || PUR; ctx.fillText(A.rarity.toUpperCase(), right - ptsW - 16, by); spacing('0px');
}

const ACARD = new Map();
async function achImage(a, cf) {
  if (!CV) return null; const m = achMeta(a), k = [a.name, a.desc, m.shape, m.icon, m.rar, m.pts].join('|');
  const theme = achThemeColor(cf), label = String(cf.achlabel || '¡LOGRO DESBLOQUEADO!').slice(0, 60), cacheKey = `${k}|${theme}|${label}`;
  if (ACARD.has(cacheKey)) return ACARD.get(cacheKey);
  try {
    const cv = CV.createCanvas(1200, 380);
    drawAchCard(cv.getContext('2d'), 1200, 380, { name: a.name, desc: a.desc, rarity: m.rn, pts: m.pts, shape: m.shape, icon: m.icon, color: m.color, theme, label });
    const buf = await cv.encode('png'); if (ACARD.size > 150) ACARD.delete(ACARD.keys().next().value); ACARD.set(cacheKey, buf); return buf;
  } catch (e) { console.warn('[logros] no pude dibujar la tarjeta:', e.message); return null; }
}
const achPts = (g, u) => g.ach.filter(a => u.ach.includes(a.id)).reduce((s, a) => s + achMeta(a).pts, 0);
const achPct = (g, gu, a) => {
  const n = Object.values(g.users).filter(u => u.ach?.includes(a.id)).length; if (!n) return '0';
  const p = n / Math.max(1, gu.memberCount, Object.keys(g.users).length) * 100; return p >= 10 ? String(Math.round(p)) : String(Math.max(0.1, Math.round(p * 10) / 10));
};
const achStats = (user, mem, u) => ({
  msgs: u.msgs, lvl: u.lvl, coins: u.coins + u.bank, invites: u.inv + u.bonus - u.left,
  vmin: u.vmin || 0, mic: u.mic || 0, micon: u.micon || 0, cam: u.cam || 0, camon: u.camon || 0, strm: u.strm || 0, stron: u.stron || 0,
  days: mem?.joinedTimestamp ? Math.floor((Date.now() - mem.joinedTimestamp) / 864e5) : 0, acct: Math.floor((Date.now() - user.createdTimestamp) / 864e5),
});

/* Mensaje del logro: mismo formato que la captura (contenedor morado, avatar, imagen grande y 2 botones) */
function achievementWebUrl(view) {
  const base = config.dashboard?.redirectUri || process.env.APP_URL;
  const origin = new URL(base).origin;
  const target = new URL('/logros', origin);
  target.searchParams.set('view', view);
  return target.href;
}
async function achPayload(gid, mem, a) {
  const g = G(gid), cf = C(gid), m = achMeta(a), pct = achPct(g, mem.guild, a);
  const format = validFormat(cf.messageFormats?.logro || 'components_v2');
  const theme = achThemeColor(cf), template = cf.achhead || '🎉 ¡{user} ha desbloqueado **{achievement}**! (+{points} puntos)';
  const head = fmt(template, { user: `<@${mem.id}>`, achievement: a.name, points: m.pts, emoji: a.emoji || '🏆', description: a.desc, rarity: m.rn });
  const sub = `-# ${m.ce} ${m.cl} · ${m.rn} · +${m.pts} · ${pct}% lo tienen`;
  const buf = url(a.img) ? null : await achImage(a, cf), files = buf ? [new AttachmentBuilder(buf, { name: 'logro.png' })] : [];
  const img = url(a.img) || (buf ? 'attachment://logro.png' : url(cf.achimg));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Mis logros').setEmoji('🏆').setStyle(ButtonStyle.Link).setURL(achievementWebUrl('me')),
    new ButtonBuilder().setLabel('Logros del servidor').setEmoji('📜').setStyle(ButtonStyle.Link).setURL(achievementWebUrl('server')),
  );
  const details = `${a.emoji || '🏆'} **${a.name}**\n${a.desc}\n${sub}`;
  if (format === 'text') return { content: `${head}\n${details}`, components: [row], allowedMentions: { parse: [] } };
  if (format === 'card') {
    const embeds = !buf && img ? [new EmbedBuilder().setColor(parseInt(theme.slice(1), 16)).setImage(img)] : [];
    return { content: `${head}\n${details}`, ...(embeds.length ? { embeds } : {}), files, components: [row], allowedMentions: { parse: [] } };
  }
  if (format === 'embed' || !ContainerBuilder || !SectionBuilder || !ThumbnailBuilder) {
    const embed = new EmbedBuilder().setColor(parseInt(theme.slice(1), 16)).setTitle(`${a.emoji || '🏆'} ${a.name}`).setDescription(`${a.desc}\n\n${sub}`).setThumbnail(mem.displayAvatarURL());
    if (img) embed.setImage(img);
    return { content: head, embeds: [embed], files, components: [row], allowedMentions: { parse: [] } };
  }
  const c = new ContainerBuilder().setAccentColor(parseInt(theme.slice(1), 16));
  c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(head),
    new TextDisplayBuilder().setContent(`**${a.emoji || '🏆'} ${a.name}**\n${a.desc}`),
    new TextDisplayBuilder().setContent(sub),
  ).setThumbnailAccessory(new ThumbnailBuilder().setURL(mem.displayAvatarURL({ extension: 'png', size: 256 }))));
  if (img) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(img)));
  c.addActionRowComponents(row);
  return { components: [c], files, flags: 1 << 15, allowedMentions: { parse: [] } };
}
// Canal de logros: 1) el que fijaste con /logro, 2) el de logros de /log servidor, 3) uno que se llame "logros" (automático)
const achCanal = (guild, cf) => [cf.achch, cf.logch?.logros].map(id => id && guild.channels.cache.get(id))
  .find(x => x && x.isTextBased?.()) || guild.channels.cache.find(c => c.type === ChannelType.GuildText && /logro/i.test(c.name) && c.isTextBased?.());
const achDest = (mem, ch, cf) => [achCanal(mem.guild, cf), ch, mem.voice?.channel, mem.guild.systemChannel]
  .find(x => x && x.isTextBased?.() && x.permissionsFor?.(mem.guild.members.me)?.has(['ViewChannel', 'SendMessages']));
async function sendAch(mem, a, ch) {
  const gid = mem.guild.id, cf = C(gid), dest = achDest(mem, ch, cf);
  if (dest) { try { await dest.send(await achPayload(gid, mem, a)); } catch (e) { console.warn(`[logros] no pude enviar en ${dest.id}: ${e.message}`); } }
  lg(gid, 'logros', E(gid, `${a.emoji || '🏆'} Logro desbloqueado`, `${mem} → **${a.name}** (+${achMeta(a).pts} pts)`).setThumbnail(mem.displayAvatarURL()));
}
async function checkAch(mem, ch) {
  if (!mem || mem.user?.bot) return;
  const gid = mem.guild.id, g = G(gid), cf = C(gid), u = U(gid, mem.id); if (cf.achoff) return;
  const st = achStats(mem.user, mem, u), won = [];
  for (const a of g.ach) { if (u.ach.includes(a.id) || !(a.type in st) || st[a.type] < a.value) continue; u.ach.push(a.id); won.push(a); }
  if (!won.length) return; save();
  for (const a of won) { await sendAch(mem, a, ch); if (won.length > 1) await new Promise(r => setTimeout(r, 1500)); } // si ganó varios, salen uno a uno
}

/* ---- Seguimiento: minutos en voz / micro / cámara / stream (cada 60 s) ---- */
function achVoiceTick() {
  client.guilds.cache.forEach(gu => {
    if (C(gu.id).achoff) return;
    gu.voiceStates.cache.forEach(vs => {
      const m = vs.member; if (!m || m.user.bot || !vs.channelId || vs.channelId === gu.afkChannelId) return;
      const u = U(gu.id, m.id);
      if (!(vs.selfDeaf || vs.serverDeaf)) u.vmin = (u.vmin || 0) + 1;
      if (vs.selfVideo) u.cam = (u.cam || 0) + 1;
      if (vs.streaming) u.strm = (u.strm || 0) + 1;
      if (!vs.selfMute && !vs.serverMute) u.mic = (u.mic || 0) + 1;
      save(); checkAch(m, null).catch(console.error);
    });
  });
}
/* ---- Seguimiento instantáneo: la primera vez que enciende micro / cámara / transmisión ---- */
function achVoiceEvt(a, b) {
  const m = b.member || a.member; if (!m || m.user.bot || !b.channelId) return;
  const u = U(m.guild.id, m.id), was = !!a.channelId; let hit = false;
  if (!b.selfMute && !b.serverMute && (!was || a.selfMute || a.serverMute)) { u.micon = (u.micon || 0) + 1; hit = true; }
  if (b.selfVideo && (!was || !a.selfVideo)) { u.camon = (u.camon || 0) + 1; hit = true; }
  if (b.streaming && (!was || !a.streaming)) { u.stron = (u.stron || 0) + 1; hit = true; }
  if (hit) { save(); checkAch(m, null).catch(console.error); }
}
/* ---- Cada 10 min: días en el servidor / antigüedad. La primera vez reparte en silencio lo que ya merecían (sin spam) ---- */
async function achSweep() {
  for (const gu of client.guilds.cache.values()) {
    const g = G(gu.id); if (C(gu.id).achoff) continue;
    if (!g.achfill) {
      await gu.members.fetch().catch(() => {});
      for (const m of gu.members.cache.values()) {
        const u = g.users[m.id]; if (m.user.bot || !u) continue; const st = achStats(m.user, m, u);
        for (const a of g.ach) if (!u.ach.includes(a.id) && a.type in st && st[a.type] >= a.value) u.ach.push(a.id);
      }
      g.achfill = true; save(); continue;
    }
    for (const uid of Object.keys(g.users)) { const m = gu.members.cache.get(uid); if (m && !m.user.bot) await checkAch(m, null); }
  }
}

/* ---- Listas (botones y comandos) ---- */
function achBoard(gu, user, mem, u, g) {
  const st = achStats(user, mem, u), by = {}; for (const a of g.ach) (by[achMeta(a).cat] ??= []).push(a);
  const done = g.ach.filter(a => u.ach.includes(a.id)).length;
  const e = E(gu.id, `🏆 Logros de ${user.username} (${done}/${g.ach.length})`, `✨ **${fn(achPts(g, u))}** puntos`).setThumbnail(user.displayAvatarURL());
  for (const [k, list] of Object.entries(by)) {
    const lines = list.map(a => { const m = achMeta(a); return u.ach.includes(a.id) ? `✅ ${a.emoji || '🏆'} **${a.name}** · ${m.rn} · +${m.pts}` : `🔒 ${a.emoji || '🏆'} ${a.name} — ${a.desc} \`${fn(Math.min(st[a.type] ?? 0, a.value))}/${fn(a.value)}\``; });
    let chunk = '', n = 0; const put = () => { if (e.length < 5400) e.addFields({ name: n++ ? '\u200b' : `${ACAT[k][0]} ${ACAT[k][1]}`, value: chunk }); chunk = ''; };
    for (const l of lines) { if ((chunk + l).length > 950) put(); chunk += l + '\n'; } if (chunk) put();
  }
  return e;
}
function achServer(gu, g) {
  const by = {}; for (const a of g.ach) (by[achMeta(a).cat] ??= []).push(a);
  const e = E(gu.id, `📜 Logros de ${gu.name}`, `**${g.ach.length}** logros disponibles`);
  for (const [k, list] of Object.entries(by)) {
    let chunk = '', n = 0; const put = () => { if (e.length < 5400) e.addFields({ name: n++ ? '\u200b' : `${ACAT[k][0]} ${ACAT[k][1]}`, value: chunk }); chunk = ''; };
    for (const a of list) { const m = achMeta(a), l = `${a.emoji || '🏆'} **${a.name}** · ${m.rn} · +${m.pts} · ${achPct(g, gu, a)}%\n-# ${a.desc} · ID \`${a.id}\`\n`; if ((chunk + l).length > 950) put(); chunk += l; } if (chunk) put();
  }
  return e;
}
async function achButton(i) {
  const g = G(i.guildId);
  if (i.customId === 'ach_me') return i.reply({ flags: 64, embeds: [achBoard(i.guild, i.user, i.member, U(i.guildId, i.user.id), g)] });
  if (i.customId === 'ach_all') return i.reply({ flags: 64, embeds: [achServer(i.guild, g)] });
}

/* ---- Comandos /logro ---- */
def('logro', 'logros', 'Ver tus logros con progreso y puntos', 'usuario:u', null, async (i, o, g) => {
  const t = o.usuario || i.user, mem = await M(i, t); i.reply({ embeds: [achBoard(i.guild, t, mem, U(i.guildId, t.id), g)] });
});
def('logro', 'servidor', 'Lista de todos los logros del servidor y qué % los tiene', '', null, (i, o, g) => i.reply({ embeds: [achServer(i.guild, g)] }));
def('logro', 'top', 'Ranking de puntos de logros', '', null, (i, o, g) => {
  const r = Object.entries(g.users).map(([id, u]) => [id, achPts(g, u), u.ach.length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  say(i, '🏆 Top de logros', r.map((x, n) => `**${n + 1}.** <@${x[0]}> — **${fn(x[1])}** pts · ${x[2]} logros`).join('\n') || 'Nadie tiene logros todavía.');
});
def('logro', 'crear', 'Crea un logro (el tipo incluye voz, cámara, micro, stream y días)', 'nombre:s!,descripcion:s!,tipo:s!,valor:i!,emoji:s,rareza:s,puntos:i,icono:s,forma:s,imagen:s', 'Administrator', (i, o, g) => {
  if (!Object.keys(TYPE_CAT).includes(o.tipo)) return no(i, `Tipo inválido. Usa uno de: ${Object.keys(TYPE_CAT).join(', ')}.`);
  const a = { id: 'a' + Date.now().toString(36), name: o.nombre, desc: o.descripcion, type: o.tipo, value: Math.max(1, o.valor), emoji: o.emoji, rar: RAR[o.rareza] ? o.rareza : 'comun',
    pts: o.puntos != null ? Math.max(0, o.puntos) : undefined, icon: o.icono, shape: o.forma, img: url(o.imagen) };
  g.ach.push(a); save(); ok(i, `Logro **${a.name}** creado (\`${a.id}\`) · ${achMeta(a).rn} · +${achMeta(a).pts} pts.`);
});
def('logro', 'eliminar', 'Elimina un logro por ID', 'id:s!', 'Administrator', (i, o, g) => { g.ach = g.ach.filter(a => a.id !== o.id); save(); ok(i, 'Logro eliminado.'); });
def('logro', 'dar', 'Da un logro a un usuario (se anuncia con la tarjeta)', 'usuario:u!,id:s!', 'Administrator', async (i, o, g) => {
  const a = g.ach.find(x => x.id === o.id); if (!a) return no(i, 'ID inválida. Los IDs aparecen en `/logro servidor`.'); const u = U(i.guildId, o.usuario.id); if (!u.ach.includes(a.id)) u.ach.push(a.id); save();
  const mem = await M(i, o.usuario); if (!mem) return ok(i, `${o.usuario} recibió **${a.name}**.`);
  i.reply(await achPayload(i.guildId, mem, a));
});
def('logro', 'probar', 'Vista previa de la tarjeta de un logro (no lo da a nadie)', 'id:s!', 'Administrator', async (i, o, g) => {
  const a = g.ach.find(x => x.id === o.id); if (!a) return no(i, 'ID inválida.'); i.reply(await achPayload(i.guildId, i.member, a));
});
def('logro', 'quitar', 'Quita un logro a un usuario', 'usuario:u!,id:s!', 'Administrator', (i, o) => { const u = U(i.guildId, o.usuario.id); u.ach = u.ach.filter(x => x !== o.id); save(); ok(i, 'Logro quitado.'); });
def('logro', 'canal', 'Canal de anuncios de logros', 'canal:c', 'Administrator', (i, o, g, cf) => { cf.achch = o.canal?.id || null; save(); ok(i, o.canal ? `Logros en ${o.canal}` : 'Logros en el canal donde ocurra (o el chat del canal de voz).'); });
def('logro', 'imagen', 'Imagen de respaldo si no se puede dibujar la tarjeta', 'url:s!', 'Administrator', (i, o, g, cf) => { if (!url(o.url)) return no(i, 'URL inválida.'); cf.achimg = o.url; save(); ok(i, 'Imagen de respaldo guardada.'); });
def('logro', 'toggle', 'Activa/desactiva logros', 'estado:b!', 'Administrator', (i, o, g, cf) => { cf.achoff = !o.estado; save(); ok(i, `Logros ${o.estado ? 'activados' : 'desactivados'}.`); });

/* ============================== 8. ANUNCIOS (6) ============================== */
const mkEmbed = (i, o) => {
  const e = E(i.guildId, o.titulo, nl(o.descripcion), o.imagen); if (hex(o.color)) e.setColor(hex(o.color));
  if (url(o.miniatura)) e.setThumbnail(o.miniatura); if (o.autor) e.setAuthor({ name: o.autor, iconURL: i.guild.iconURL() || undefined }); if (o.pie) e.setFooter({ text: o.pie }); return e;
};
def('anuncio', 'anunciar', 'Envía un anuncio con embed', 'canal:c!,titulo:s!,descripcion:s!,color:s,imagen:s,miniatura:s,mencion:r,everyone:b', 'ManageGuild', async (i, o) => {
  await o.canal.send({ content: o.everyone ? '@everyone' : o.mencion ? `${o.mencion}` : undefined, embeds: [mkEmbed(i, o)], allowedMentions: { parse: ['everyone', 'roles'] } }); ok(i, `Anuncio enviado en ${o.canal}`);
});
def('anuncio', 'embed', 'Envía un embed personalizado', 'descripcion:s!,canal:c,titulo:s,color:s,imagen:s,miniatura:s,autor:s,pie:s', 'ManageMessages', async (i, o) => { await (o.canal || i.channel).send({ embeds: [mkEmbed(i, o)] }); ok(i, 'Embed enviado.'); });
def('anuncio', 'say', 'El bot dice un mensaje', 'texto:s!,canal:c', 'ManageMessages', async (i, o) => { await (o.canal || i.channel).send({ content: nl(o.texto), allowedMentions: { parse: [] } }); ok(i, 'Enviado.'); });

/* ---- Editar / borrar mensajes que envió el bot (anuncios, bienvenidas, paneles, embeds...) ---- */
// Acepta el enlace del mensaje (clic derecho → Copiar enlace) o solo su ID (en el canal actual).
async function fetchBotMsg(i, ref) {
  const s = String(ref ?? '').trim(), m = s.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
  let ch = i.channel, id = s.match(/\d{15,25}/)?.[0];
  if (m) { ch = i.guild.channels.cache.get(m[2]) ?? client.channels.cache.get(m[2]) ?? null; id = m[3]; }
  if (!ch || !id || !ch.messages) return null;
  return ch.messages.fetch(id).catch(() => null);
}
// Cambia solo lo que se pida; lo demás del mensaje se queda igual
async function editBotMsg(i, msg, o) {
  if (!msg) return no(i, 'No encuentro ese mensaje. Pega su enlace (clic derecho → Copiar enlace del mensaje).');
  if (msg.author?.id !== client.user.id) return no(i, 'Solo puedo editar los mensajes que envió el bot.');
  const cambios = {};
  if (o.texto != null) cambios.content = NONE.test(o.texto.trim()) ? '' : nl(o.texto).slice(0, 2000);
  if (o.titulo != null || o.descripcion != null || o.color != null) {
    if (o.color && hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.');
    const e = msg.embeds[0] ? EmbedBuilder.from(msg.embeds[0]) : new EmbedBuilder().setColor(C(msg.guildId).color);
    if (o.titulo != null) e.setTitle(NONE.test(o.titulo.trim()) ? null : nl(o.titulo).slice(0, 256));
    if (o.descripcion != null) e.setDescription(NONE.test(o.descripcion.trim()) ? null : nl(o.descripcion).slice(0, 4096));
    if (o.color) e.setColor(hex(o.color));
    cambios.embeds = [e];
  }
  if (!Object.keys(cambios).length) return no(i, 'Dime qué cambiar: `texto`, `titulo`, `descripcion` o `color`.');
  try { await msg.edit(cambios); ok(i, 'Mensaje editado.'); }
  catch (err) { no(i, `No pude editarlo: ${err.message}`); }
}
def('anuncio', 'editar', 'Edita un mensaje que envió el bot (texto, título, descripción o color)', 'mensaje:s!,texto:s,titulo:s,descripcion:s,color:s', 'ManageMessages', async (i, o) => editBotMsg(i, await fetchBotMsg(i, o.mensaje), o));
def('anuncio', 'borrar', 'Borra un mensaje que envió el bot', 'mensaje:s!', 'ManageMessages', async (i, o) => {
  const msg = await fetchBotMsg(i, o.mensaje);
  if (!msg) return no(i, 'No encuentro ese mensaje. Pega su enlace.');
  if (msg.author?.id !== client.user.id) return no(i, 'Solo puedo borrar los mensajes que envió el bot.');
  await msg.delete().then(() => ok(i, 'Mensaje borrado.')).catch(err => no(i, `No pude borrarlo: ${err.message}`));
});
def('anuncio', 'encuesta', 'Crea una encuesta (hasta 4 opciones)', 'pregunta:s!,op1:s!,op2:s!,op3:s,op4:s', 'ManageMessages', async (i, o) => {
  const ops = [o.op1, o.op2, o.op3, o.op4].filter(Boolean), em = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
  const m = await i.reply({ embeds: [E(i.guildId, `📊 ${o.pregunta}`, ops.map((x, n) => `${em[n]} ${x}`).join('\n\n'))], withResponse: true }); const msg = m.resource.message; for (let n = 0; n < ops.length; n++) await msg.react(em[n]);
});
def('anuncio', 'sorteo', 'Crea un sorteo', 'premio:s!,minutos:i!,ganadores:i', 'ManageGuild', async (i, o) => {
  const ms = Math.min(o.minutos, 10080) * 60000, n = Math.max(1, o.ganadores || 1);
  const m = await i.reply({ embeds: [E(i.guildId, '🎉 SORTEO', `Premio: **${o.premio}**\nGanadores: **${n}**\nTermina ${when(ms)}\n\nReacciona con 🎉 para participar.`)], withResponse: true }); const msg = m.resource.message; await msg.react('🎉');
  setTimeout(async () => {
    const r = (await msg.fetch().catch(() => null))?.reactions.cache.get('🎉'); if (!r) return; const us = [...(await r.users.fetch()).filter(x => !x.bot).values()], w = [];
    while (w.length < n && us.length) w.push(us.splice(rnd(0, us.length - 1), 1)[0]);
    msg.reply({ embeds: [E(i.guildId, '🎉 Sorteo finalizado', w.length ? `Ganador(es) de **${o.premio}**: ${w.join(', ')}` : 'Nadie participó.')] });
  }, ms);
});
def('anuncio', 'recordatorio', 'Te recuerda algo (minutos)', 'minutos:i!,texto:s!', null, (i, o) => {
  const ms = Math.min(o.minutos, 1440) * 60000; ok(i, `Te recordaré ${when(ms)}`);
  setTimeout(() => i.channel.send({ content: `${i.user}`, embeds: [E(i.guildId, '⏰ Recordatorio', o.texto)] }).catch(() => {}), ms);
});

/* ============================== 9. AUTOROLES (7) ============================== */
// Por qué fallaban: el rol estaba por encima del rol del bot / el bot no tenía "Gestionar roles" / era un rol de bot,
// y el error se tragaba en silencio. Ahora se valida al configurar, se reintenta y se avisa en los logs.
const roleIssue = (guild, r) => {
  if (!r) return 'ya no existe';
  if (r.id === guild.id) return 'es @everyone';
  if (r.managed) return 'es un rol de bot/integración (Discord no permite asignarlo)';
  const me = guild.members.me;
  if (!me?.permissions.has(P.ManageRoles)) return 'el bot no tiene el permiso **Gestionar roles**';
  if (r.comparePositionTo(me.roles.highest) >= 0) return 'está por encima del rol del bot (arrastra el rol del bot más arriba en Ajustes → Roles)';
  return null;
};
async function giveRoles(m, ids, why = 'Autorol') {
  const g = G(m.guild.id), good = [], bad = [];
  for (const id of ids) {
    const r = m.guild.roles.cache.get(id), p = roleIssue(m.guild, r);
    if (!r) g.autoroles = g.autoroles.filter(x => x !== id);
    p ? bad.push(`${r ?? `\`${id}\``} — ${p}`) : good.push(id);
  }
  if (good.length) {
    try { await m.roles.add(good, why); } catch (e1) {
      if (e1.code === 10007) return; // el miembro ya se fue
      await new Promise(res => setTimeout(res, 2000));
      try { await m.roles.add(good, why); } catch (e2) { if (e2.code !== 10007) bad.push(`error de Discord: ${e2.message}`); }
    }
  }
  if (bad.length) lg(m.guild.id, 'general', E(m.guild.id, '⚠️ Autorol con problemas', `${m} (${m.user.tag})\n${bad.join('\n')}\n\nRevisa con \`/autorole revisar\`.`));
  save();
}
def('autorole', 'add', 'Rol(es) automático(s) al entrar (hasta 2 a la vez)', 'rol1:r!,rol2:r', 'Administrator', (i, o, g) => {
  const roles = [o.rol1, o.rol2].filter(Boolean), bad = roles.map(r => [r, roleIssue(i.guild, r)]).filter(([, p]) => p);
  if (bad.length) return no(i, bad.map(([r, p]) => `No puedo dar ${r}: ${p}.`).join('\n'));
  for (const r of roles) if (!g.autoroles.includes(r.id)) g.autoroles.push(r.id);
  save(); ok(i, `${roles.join(' y ')} se dará(n) al entrar.`);
});
def('autorole', 'remove', 'Quita un autorol', 'rol:r!', 'Administrator', (i, o, g) => { g.autoroles = g.autoroles.filter(x => x !== o.rol.id); save(); ok(i, 'Autorol eliminado.'); });
def('autorole', 'list', 'Lista de autoroles y su estado', '', null, (i, o, g, cf) => {
  const st = id => { const r = i.guild.roles.cache.get(id), p = roleIssue(i.guild, r); return `${p ? '⚠️' : '✅'} ${r ?? `\`${id}\``}${p ? ` — ${p}` : ''}`; };
  say(i, '🎭 Autoroles', (g.autoroles.map(st).join('\n') || 'Ninguno') + `\n\n🤖 Rol para bots: ${cf.botrole ? st(cf.botrole) : '—'}`);
});
def('autorole', 'bot', 'Rol automático para bots', 'rol:r', 'Administrator', (i, o, g, cf) => {
  if (o.rol) { const p = roleIssue(i.guild, o.rol); if (p) return no(i, `No puedo dar ${o.rol}: ${p}.`); }
  cf.botrole = o.rol?.id || null; save(); ok(i, o.rol ? `Bots recibirán ${o.rol}` : 'Rol de bots desactivado.');
});
def('autorole', 'revisar', 'Diagnostica por qué un autorol podría no funcionar', '', 'Administrator', (i, o, g, cf) => {
  const me = i.guild.members.me, L = [];
  L.push(me.permissions.has(P.ManageRoles) ? '✅ El bot tiene **Gestionar roles**' : '❌ Al bot le falta **Gestionar roles**');
  L.push(`📍 Rol más alto del bot: ${me.roles.highest} (los autoroles deben estar **debajo**)`);
  const ids = [...g.autoroles, ...(cf.botrole ? [cf.botrole] : [])];
  if (!ids.length) L.push('⚠️ No hay autoroles configurados. Usa `/autorole add`.');
  for (const id of ids) { const r = i.guild.roles.cache.get(id), p = roleIssue(i.guild, r); L.push(`${p ? '❌' : '✅'} ${r ?? `\`${id}\``}${p ? ` — ${p}` : ''}`); }
  L.push('\nSi todo está en ✅ y aun así no se asigna, activa **Server Members Intent** en el Developer Portal.');
  say(i, '🔎 Diagnóstico de autoroles', L.join('\n'), true);
});
def('autorole', 'aplicar', 'Da los autoroles a los miembros actuales que no los tengan', '', 'Administrator', async (i, o, g) => {
  if (!g.autoroles.length) return no(i, 'No hay autoroles configurados.');
  await i.deferReply({ flags: 64 });
  const good = g.autoroles.filter(id => !roleIssue(i.guild, i.guild.roles.cache.get(id)));
  if (!good.length) return i.editReply({ embeds: [E(i.guildId, '❌ Error', 'Ningún autorol es válido. Usa `/autorole revisar`.')] });
  const ms = await i.guild.members.fetch(); let n = 0;
  for (const m of ms.values()) {
    if (m.user.bot) continue; const miss = good.filter(id => !m.roles.cache.has(id)); if (!miss.length) continue;
    await m.roles.add(miss, 'Autorol (aplicar)').then(() => n++).catch(() => {}); await new Promise(res => setTimeout(res, 400));
  }
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Autoroles aplicados a **${n}** miembros.`)] });
});
def('autorole', 'panel', 'Panel de roles con botones (hasta 5)', 'canal:c!,titulo:s!,descripcion:s!,rol1:r!,rol2:r,rol3:r,rol4:r,rol5:r,imagen:s,color:s', 'Administrator', async (i, o) => {
  const rs = [o.rol1, o.rol2, o.rol3, o.rol4, o.rol5].filter(Boolean), bad = rs.map(r => [r, roleIssue(i.guild, r)]).filter(x => x[1]);
  if (bad.length) return no(i, bad.map(([r, p]) => `${r}: ${p}`).join('\n'));
  const e = E(i.guildId, o.titulo, nl(o.descripcion) + '\n\n' + rs.map(r => `• ${r}`).join('\n'), o.imagen); if (hex(o.color)) e.setColor(hex(o.color));
  try { await o.canal.send({ embeds: [e], components: [new ActionRowBuilder().addComponents(rs.map(r => new ButtonBuilder().setCustomId('rr_' + r.id).setLabel(r.name.slice(0, 80)).setStyle(ButtonStyle.Secondary)))] }); }
  catch (err) { return no(i, `No pude enviar el panel en ${o.canal}: ${err.message}`); }
  ok(i, `Panel enviado en ${o.canal}`);
});

/* ============================== 9b. PANELES DE ROLES (/rolpanel) ============================== */
// Panel con banner, título, descripción y botones (emoji + nombre) que dan o quitan un rol.
// Cada botón se configura por separado: nombre, rol y emoji (escribe "quitar" para dejarlo solo con el nombre).
// Con "exclusivo" activo el panel es un grupo: al pulsar un rol se quitan los demás roles de ESE panel.
const RP_FLAG = 1 << 15; // Components V2 (banner + texto + botones dentro de un contenedor)
const RP_MAX = 20;       // botones por panel: 4 por fila, máximo 5 filas
const RP_FOOT = 'Un rol por grupo · Elige otro para cambiar o pulsa el actual para quitarlo.';
const rpEmoji = s => { // "🔴" o "<:nombre:123>" → formato de discord.js; null si no es un emoji válido
  const t = String(s ?? '').trim(), m = t.match(/^<(a?):(\w+):(\d+)>$/);
  if (m) return { id: m[3], name: m[2], animated: !!m[1] };
  const seg = [...new Intl.Segmenter().segment(t)];
  return seg.length === 1 && !/^[\x00-\x7F]$/.test(t) ? t : null;
};
const rpPanel = (cf, key) => (cf.rp?.panels || []).find(p => p.id === String(key ?? '').trim().toLowerCase());
const rpBtn = (p, key) => { const k = String(key ?? '').trim().toLowerCase(); return p.btns.find(b => b.id === k || b.label.toLowerCase() === k); };
function rpPayload(gid, p) {
  const c = new ContainerBuilder();
  // p.color se guarda como número (hex() ya lo convirtió); hex() solo sirve con texto, así que se lee directo
  const pc = Number.isInteger(p.color) ? p.color : hex(p.color);
  const gc = Number.isInteger(C(gid).color) ? C(gid).color : hex(C(gid).color);
  const col = pc ?? gc; if (col != null) c.setAccentColor(col);
  if (p.banner) c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(p.banner)));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${p.title}\n${p.desc}`));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  if (!p.btns.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# Aún no hay roles. Usa `/rolpanel boton_add`.'));
  for (let k = 0; k < p.btns.length; k += 4) {
    c.addActionRowComponents(new ActionRowBuilder().addComponents(p.btns.slice(k, k + 4).map(b => {
      const bt = new ButtonBuilder().setCustomId(`rp_${p.id}_${b.id}`).setLabel(b.label.slice(0, 80)).setStyle(ButtonStyle.Secondary);
      const em = rpEmoji(b.emoji); if (em) bt.setEmoji(em);
      return bt;
    })));
  }
  const foot = p.footer ?? (p.excl ? RP_FOOT : 'Pulsa un botón para ponerte o quitarte ese rol.');
  if (foot) {
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${foot}`));
  }
  return { flags: RP_FLAG, components: [c] };
}
async function rpRefresh(guild, p) { // vuelve a dibujar el panel publicado; devuelve null o el motivo del fallo
  const ch = await guild.channels.fetch(p.ch).catch(() => null); if (!ch) return 'el canal del panel ya no existe';
  const m = await ch.messages.fetch(p.msg).catch(() => null); if (!m) return 'no encuentro el mensaje del panel (¿lo borraron?)';
  try { await m.edit(rpPayload(guild.id, p)); return null; } catch (err) { return `Discord rechazó la actualización: ${err.message}`; }
}
const rpPanelErr = i => no(i, 'No encuentro ese panel. Mira `/rolpanel lista`.');
const rpBtnErr = i => no(i, 'No encuentro ese botón. Mira `/rolpanel lista`.');
const rpSync = (i, p, okMsg) => rpRefresh(i.guild, p).then(err => (err ? no(i, `Cambio guardado, pero no pude actualizar el panel: ${err}`) : ok(i, okMsg)));

def('rolpanel', 'crear', 'Crea un panel de roles (banner, título y descripción) en un canal', 'canal:c!,titulo:s!,descripcion:s!,banner:s,color:s', 'Administrator', async (i, o, g, cf) => {
  const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo publicar en ${o.canal}: ${ci}.`);
  if (o.banner && !url(o.banner)) return no(i, '`banner` debe ser un enlace `http(s)`.');
  if (o.color && hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.');
  cf.rp ??= { n: 0, panels: [] };
  const p = { id: `p${++cf.rp.n}`, ch: o.canal.id, msg: null, title: o.titulo.slice(0, 100), desc: nl(o.descripcion).slice(0, 2000),
    banner: url(o.banner), color: hex(o.color), footer: null, excl: true, bn: 0, btns: [] };
  let m; try { m = await o.canal.send(rpPayload(i.guildId, p)); } catch (err) { return no(i, `No pude publicar el panel: ${err.message}`); }
  p.msg = m.id; cf.rp.panels.push(p); save();
  ok(i, `Panel \`${p.id}\` publicado en ${o.canal}.\nAhora añade roles con \`/rolpanel boton_add panel:${p.id}\`.`);
});
def('rolpanel', 'boton_add', 'Añade un botón (rol) a un panel', 'panel:s!,nombre:s!,rol:r!,emoji:s', 'Administrator', async (i, o, g, cf) => {
  const p = rpPanel(cf, o.panel); if (!p) return rpPanelErr(i);
  if (p.btns.length >= RP_MAX) return no(i, `Un panel admite máximo ${RP_MAX} botones.`);
  const pr = roleIssue(i.guild, o.rol); if (pr) return no(i, `No puedo dar ${o.rol}: ${pr}.`);
  if (p.btns.some(b => b.role === o.rol.id)) return no(i, `${o.rol} ya está en ese panel.`);
  if (rpBtn(p, o.nombre)) return no(i, 'Ya hay un botón con ese nombre en el panel.');
  if (o.emoji && !rpEmoji(o.emoji)) return no(i, 'Emoji inválido. Pon un emoji normal o uno del servidor con formato `<:nombre:id>`.');
  p.bn = (p.bn || 0) + 1;
  p.btns.push({ id: `b${p.bn}`, label: o.nombre.slice(0, 80), emoji: o.emoji?.trim() || null, role: o.rol.id });
  save(); await rpSync(i, p, `Botón **${o.nombre}** → ${o.rol} añadido al panel \`${p.id}\`.`);
});
def('rolpanel', 'boton_edit', 'Cambia nombre, rol o emoji de un botón (emoji "quitar" lo elimina)', 'panel:s!,boton:s!,nombre:s,emoji:s,rol:r', 'Administrator', async (i, o, g, cf) => {
  const p = rpPanel(cf, o.panel); if (!p) return rpPanelErr(i);
  const b = rpBtn(p, o.boton); if (!b) return rpBtnErr(i);
  if (o.rol) {
    const pr = roleIssue(i.guild, o.rol); if (pr) return no(i, `No puedo dar ${o.rol}: ${pr}.`);
    if (p.btns.some(x => x !== b && x.role === o.rol.id)) return no(i, `${o.rol} ya está en ese panel.`);
  }
  if (o.emoji && !/^quitar$/i.test(o.emoji.trim()) && !rpEmoji(o.emoji)) return no(i, 'Emoji inválido. Pon un emoji normal o `<:nombre:id>`, o `quitar`.');
  if (o.nombre) b.label = o.nombre.slice(0, 80);
  if (o.rol) b.role = o.rol.id;
  if (o.emoji) b.emoji = /^quitar$/i.test(o.emoji.trim()) ? null : o.emoji.trim();
  save(); await rpSync(i, p, `Botón **${b.label}** actualizado.`);
});
def('rolpanel', 'boton_del', 'Quita un botón de un panel', 'panel:s!,boton:s!', 'Administrator', async (i, o, g, cf) => {
  const p = rpPanel(cf, o.panel); if (!p) return rpPanelErr(i);
  const b = rpBtn(p, o.boton); if (!b) return rpBtnErr(i);
  p.btns = p.btns.filter(x => x !== b); save(); await rpSync(i, p, `Botón **${b.label}** quitado del panel \`${p.id}\`. El rol no se quita de quienes ya lo tienen.`);
});
def('rolpanel', 'editar', 'Cambia título, descripción, banner, color, pie o modo de un panel', 'panel:s!,titulo:s,descripcion:s,banner:s,color:s,pie:s,exclusivo:b', 'Administrator', async (i, o, g, cf) => {
  const p = rpPanel(cf, o.panel); if (!p) return rpPanelErr(i);
  const quitar = v => /^quitar$/i.test(String(v).trim());
  if (o.banner && !quitar(o.banner) && !url(o.banner)) return no(i, '`banner` debe ser un enlace `http(s)` o `quitar`.');
  if (o.color && !quitar(o.color) && hex(o.color) === null) return no(i, 'Color inválido. Usa `#RRGGBB` o `quitar`.');
  if (o.titulo) p.title = o.titulo.slice(0, 100);
  if (o.descripcion) p.desc = nl(o.descripcion).slice(0, 2000);
  if (o.banner) p.banner = quitar(o.banner) ? null : url(o.banner);
  if (o.color) p.color = quitar(o.color) ? null : hex(o.color);
  if (o.pie) p.footer = quitar(o.pie) ? '' : o.pie.slice(0, 200);
  if (o.exclusivo != null) p.excl = o.exclusivo;
  save(); await rpSync(i, p, `Panel \`${p.id}\` actualizado.`);
});
def('rolpanel', 'borrar', 'Borra un panel y su mensaje (los roles dados no se quitan)', 'panel:s!', 'Administrator', async (i, o, g, cf) => {
  const p = rpPanel(cf, o.panel); if (!p) return rpPanelErr(i);
  const ch = await i.guild.channels.fetch(p.ch).catch(() => null);
  const m = ch ? await ch.messages.fetch(p.msg).catch(() => null) : null; m?.delete().catch(() => {});
  cf.rp.panels = cf.rp.panels.filter(x => x !== p); save(); ok(i, `Panel \`${p.id}\` borrado.`);
});
def('rolpanel', 'lista', 'Lista los paneles de roles y sus botones', '', 'Administrator', (i, o, g, cf) => {
  const L = (cf.rp?.panels || []).map(p => {
    const btns = p.btns.map(b => { const r = i.guild.roles.cache.get(b.role), pr = roleIssue(i.guild, r); return `  ${pr ? '⚠️' : '✅'} ${b.emoji ? `${b.emoji} ` : ''}**${b.label}** → ${r ?? `\`${b.role}\``}${pr ? ` — ${pr}` : ''}`; }).join('\n') || '  _sin botones_';
    return `**\`${p.id}\`** · <#${p.ch}> · ${p.excl ? 'un rol por grupo' : 'roles libres'}\n${btns}`;
  });
  say(i, '🎭 Paneles de roles', L.join('\n\n').slice(0, 4000) || 'No hay paneles. Usa `/rolpanel crear`.', true);
});

// Pulsar un botón del panel: da el rol, o lo quita si ya lo tienes (y en modo exclusivo quita los demás del panel)
async function rpButton(i) {
  const [, pid, bid] = i.customId.split('_'), p = (C(i.guildId).rp?.panels || []).find(x => x.id === pid), b = p?.btns.find(x => x.id === bid);
  await i.deferReply({ flags: 64 });
  if (!b) { await i.editReply({ embeds: [E(i.guildId, '❌ Error', 'Este botón ya no existe. Pide al staff que actualice el panel.')] }); return true; }
  const pr = roleIssue(i.guild, i.guild.roles.cache.get(b.role));
  if (pr) { await i.editReply({ embeds: [E(i.guildId, '❌ Error', `No puedo gestionar <@&${b.role}>: ${pr}.`)] }); return true; }
  const has = hasRole(i.member, b.role);
  try {
    if (has) await i.member.roles.remove(b.role, 'Panel de roles');
    else {
      if (p.excl) {
        const quitar = p.btns.filter(x => x.role !== b.role && i.member.roles.cache.has(x.role) && !roleIssue(i.guild, i.guild.roles.cache.get(x.role))).map(x => x.role);
        if (quitar.length) await i.member.roles.remove(quitar, 'Panel de roles (un rol por grupo)');
      }
      await i.member.roles.add(b.role, 'Panel de roles');
    }
  } catch (err) { await i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude cambiar tu rol: ${err.message}`)] }); return true; }
  await i.editReply({ embeds: [E(i.guildId, has ? '➖ Rol quitado' : '➕ Rol añadido', `<@&${b.role}>`)] });
  return true;
}

/* ============================== 9c. BOT 24/7 EN VOZ (/vozbot) ============================== */
// El canal permanente de voz es compartido por Discord y la dashboard.
def('vozbot', 'activar', 'Conecta Kuboq al canal permanente de voz y lo mantiene conectado', 'canal:c!', 'Administrator', async (i, o, g, cf) => {
  if (!o.canal.isVoiceBased?.()) return no(i, `${o.canal} no es un canal de voz.`);
  const miss = [P.ViewChannel, P.Connect].filter(p => !o.canal.permissionsFor(i.guild.members.me)?.has(p));
  if (miss.length) return no(i, `Al bot le faltan permisos en ${o.canal}: **${miss.map(p => (p === P.Connect ? 'Conectar' : 'Ver canal')).join(', ')}**.`);
  try { await music.setGuildChannel(i.guildId, o.canal.id); }
  catch (error) {
    if (error.message.startsWith('Detén la sesión musical')) return no(i, error.message);
    cf.musicChannelId = o.canal.id; delete cf.musicChannelDisabled; delete cf.c247; save();
    return no(i, `Canal guardado (${o.canal}); Kuboq intentará conectar de nuevo automáticamente. Estado: ${error.message}`);
  }
  cf.musicChannelId = o.canal.id; delete cf.musicChannelDisabled; delete cf.c247; save();
  ok(i, `Kuboq está conectado a ${o.canal}. Puedes desconectarlo desde la dashboard o con /vozbot desactivar.`);
});
def('vozbot', 'desactivar', 'Desconecta Kuboq del canal permanente de voz', '', 'Administrator', async (i, o, g, cf) => {
  delete cf.musicChannelId; cf.musicChannelDisabled = true; delete cf.c247; save();
  await music.setGuildChannel(i.guildId, null);
  ok(i, 'Kuboq se desconectó de voz y ya no intentará volver a entrar.');
});
def('vozbot', 'estado', 'Ver en qué canal está el bot 24/7', '', 'Administrator', (i, o, g, cf) => {
  const voice = music.voiceStatus(i.guildId);
  const id = cf.musicChannelId || cf.c247?.ch || voice.channelId;
  if (!id) return say(i, '🔊 Bot 24/7', 'Kuboq está desconectado. Usa `/vozbot activar` o elige un canal en la dashboard.', true);
  say(i, '🔊 Bot 24/7', `Canal: <#${id}>\nEstado: ${voice.connected && voice.channelId === id ? '🟢 conectado' : '🟡 entrando o reconectando'}`, true);
});

/* ============================== 10. TICKETS (13) ============================== */
async function transcript(ch) {
  let all = [], last; for (let k = 0; k < 3; k++) { const b = await ch.messages.fetch({ limit: 100, before: last }); if (!b.size) break; all.push(...b.values()); last = b.last().id; }
  const t = all.reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString('es')}] ${m.author.tag}: ${m.content}${m.attachments.size ? ' ' + m.attachments.map(a => a.url).join(' ') : ''}`).join('\n');
  return new AttachmentBuilder(Buffer.from(t || 'Sin mensajes'), { name: `${ch.name}.txt` });
}
// ---- Tipos de ticket (apelación, VIP, compras...) -------------------------------------------------------------
// Cada tipo tiene su propia categoría, rol de soporte y mensaje de bienvenida. Si hay tipos, el panel muestra un MENÚ
// desplegable; si no, el botón clásico. SOLO un administrador o el rol de soporte (global o del tipo) puede cerrar,
// reclamar y gestionar un ticket: el miembro que lo abrió NO puede cerrarlo.
CHO['ticket.modo'] = [['Menú desplegable', 'menu'], ['Botón', 'boton']];
const TKT = cf => (cf.tk.types ??= {});
const tkSlug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
const tkEmojiOk = s => { const t = String(s).trim(); return /^<a?:\w+:\d+>$/.test(t) || ([...new Intl.Segmenter().segment(t)].length === 1 && /\p{Extended_Pictographic}/u.test(t)); };
const tkEmoji = s => { if (!s) return undefined; const m = String(s).trim().match(/^<(a?):(\w+):(\d+)>$/); return m ? { id: m[3], name: m[2], animated: !!m[1] } : String(s).trim(); };
const tkStaff = (member, gid, t) => {
  if (member.permissions.has(P.Administrator)) return true;
  const tk = C(gid).tk, ids = [tk.role, t?.type && TKT(C(gid))[t.type]?.role].filter(Boolean);
  return ids.some(id => member.roles.cache.has(id));
};
const tkDeny = i => no(i, 'Solo un **administrador** o el **equipo de soporte** puede hacer esto. Los miembros no pueden cerrar ni gestionar tickets.');
// Devuelve los datos del ticket si el canal es un ticket (y, con staff=true, si quien ejecuta es admin/soporte); si no, responde el error y devuelve null
const tkCtx = (i, g, staff = true) => {
  const t = g.tickets[i.channelId];
  if (!t) { no(i, 'Esto no es un ticket.'); return null; }
  if (staff && !tkStaff(i.member, i.guildId, t)) { tkDeny(i); return null; }
  return t;
};
async function closeTicket(ch, by) {
  const g = G(ch.guild.id), t = g.tickets[ch.id]; if (!t) return false; const cf = C(ch.guild.id), f = await transcript(ch), ty = t.type && TKT(cf)[t.type];
  const e = E(ch.guild.id, '🎫 Ticket cerrado', `**Ticket:** ${ch.name}${ty ? `\n**Tipo:** ${ty.emoji || ''} ${ty.name}` : ''}\n**Dueño:** <@${t.owner}>\n**Cerrado por:** ${by}\n**Reclamado por:** ${t.claimed ? `<@${t.claimed}>` : '—'}`);
  const lc = ch.guild.channels.cache.get(cf.tk.log || cf.logch.tickets); lc?.send({ embeds: [e], files: [f] }).catch(() => {});
  const ow = await client.users.fetch(t.owner).catch(() => null); ow?.send({ embeds: [e], files: [f] }).catch(() => {});
  delete g.tickets[ch.id]; save(); setTimeout(() => ch.delete().catch(() => {}), 5000); return true;
}
// La imagen "de arriba" (banner) va como un embed aparte encima del principal, igual que en la interfaz de voz
const tkBanner = (gid, cf) => (url(cf.tk.emb?.banner) ? [new EmbedBuilder().setColor(Number.isInteger(cf.tk.emb.color) ? cf.tk.emb.color : C(gid).color).setImage(cf.tk.emb.banner)] : []);
const tkPanelEmbeds = (gid, cf) => [...tkBanner(gid, cf), tkPanelEmbed(gid, cf)];
function tkPanelEmbed(gid, cf) {
  const v = cf.tk.emb || {}, e = E(gid, v.title || '🎫 Soporte', v.desc || 'Abre un ticket para ponerte en contacto con el equipo de staff.', v.img);
  if (Number.isInteger(v.color)) e.setColor(v.color); if (url(v.thumb)) e.setThumbnail(v.thumb);
  if (v.footer) e.setFooter({ text: v.footer.slice(0, 2048) });
  return e;
}
const tkRows = (cf, mode) => {
  const v = cf.tk.emb || {}, types = Object.entries(TKT(cf));
  if (mode === 'menu' && types.length) return [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('tk_menu')
    .setPlaceholder((v.menu || 'Selecciona el tipo de ticket').slice(0, 150))
    .addOptions(types.slice(0, 25).map(([k, x]) => ({ label: x.name.slice(0, 100), value: k, ...(x.desc ? { description: x.desc.slice(0, 100) } : {}), ...(x.emoji ? { emoji: tkEmoji(x.emoji) } : {}) }))))];
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_open').setLabel((v.btn || 'Abrir ticket').slice(0, 80)).setEmoji('🎫').setStyle(ButtonStyle.Primary))];
};
def('ticket', 'setup', 'Categoría por defecto, rol de soporte (cierra/gestiona tickets) y canal de logs', 'categoria:c,rol:r,logs:c', 'Administrator', (i, o, g, cf) => {
  if (o.categoria && o.categoria.type !== ChannelType.GuildCategory) return no(i, `${o.categoria} no es una **categoría** (la carpeta que agrupa canales). Elige una categoría.`);
  if (o.logs && !o.logs.isTextBased()) return no(i, 'El canal de logs debe ser un canal de texto.');
  if (o.categoria) cf.tk.cat = o.categoria.id; if (o.rol) cf.tk.role = o.rol.id; if (o.logs) cf.tk.log = o.logs.id; save();
  ok(i, `📁 Categoría por defecto: ${cf.tk.cat ? `<#${cf.tk.cat}>` : '—'}\n🛡️ Rol de soporte: ${cf.tk.role ? `<@&${cf.tk.role}>` : '—'} _(puede ver, reclamar y cerrar tickets; los administradores siempre pueden)_\n📜 Logs: ${cf.tk.log ? `<#${cf.tk.log}>` : '—'}\n\nCrea tipos con \`/ticket tipo\` y publica el panel con \`/ticket panel\`.`);
});
def('ticket', 'embed', 'Personaliza el panel: título, descripción, color, banner (arriba), imagen (abajo), miniatura, pie', 'titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s,boton:s,menu:s,bienvenida:s', 'Administrator', (i, o, g, cf) => {
  if (o.color && hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.');
  for (const k of ['banner', 'imagen', 'miniatura']) if (o[k] && !url(o[k]) && !/^(ninguna|quitar)$/i.test(o[k])) return no(i, `\`${k}\` debe ser un enlace \`http(s)\` (o \`ninguna\` para quitarla).`);
  cf.tk.emb = { ...cf.tk.emb, ...Object.fromEntries(Object.entries({ title: o.titulo, desc: nl(o.descripcion), color: hex(o.color), banner: url(o.banner), img: url(o.imagen), thumb: url(o.miniatura), footer: o.pie, btn: o.boton, menu: o.menu, welcome: nl(o.bienvenida) }).filter(([, v]) => v)) };
  for (const [k, key] of [['banner', 'banner'], ['imagen', 'img'], ['miniatura', 'thumb']]) if (/^(ninguna|quitar)$/i.test(o[k] || '')) delete cf.tk.emb[key];
  save(); ok(i, 'Panel de tickets actualizado. Usa `/ticket panel` para publicarlo (los paneles ya publicados no cambian).');
});
def('ticket', 'tipo', 'Crea o edita un tipo de ticket (con su categoría, rol de soporte y bienvenida)', 'nombre:s!,categoria:c,rol:r,emoji:s,descripcion:s,bienvenida:s', 'Administrator', (i, o, g, cf) => {
  const key = tkSlug(o.nombre), tp = TKT(cf);
  if (!key) return no(i, 'El nombre debe tener letras o números.');
  if (!tp[key] && Object.keys(tp).length >= 25) return no(i, 'Máximo 25 tipos de ticket.');
  if (o.categoria && o.categoria.type !== ChannelType.GuildCategory) return no(i, `${o.categoria} no es una **categoría**.`);
  if (o.emoji && !tkEmojiOk(o.emoji)) return no(i, '`emoji` debe ser **un solo emoji** (o un emoji personalizado del servidor).');
  const x = (tp[key] ??= { name: o.nombre.trim().slice(0, 100) });
  x.name = o.nombre.trim().slice(0, 100);
  if (o.categoria) x.cat = o.categoria.id; if (o.rol) x.role = o.rol.id; if (o.emoji) x.emoji = o.emoji.trim();
  if (o.descripcion) x.desc = o.descripcion.slice(0, 100); if (o.bienvenida) x.welcome = nl(o.bienvenida); save();
  ok(i, `${x.emoji || '🎫'} **${x.name}** guardado.\n📁 Categoría: ${x.cat ? `<#${x.cat}>` : 'la por defecto'}\n🛡️ Soporte: ${x.role ? `<@&${x.role}>` : 'el rol global'}\n\nRepublica el panel con \`/ticket panel\` para que aparezca en el menú.`);
});
def('ticket', 'tipoquitar', 'Elimina un tipo de ticket', 'nombre:s!', 'Administrator', (i, o, g, cf) => {
  const key = tkSlug(o.nombre); if (!TKT(cf)[key]) return no(i, 'Ese tipo no existe. Mira `/ticket tipos`.');
  delete TKT(cf)[key]; save(); ok(i, 'Tipo eliminado. Los tickets ya abiertos de ese tipo siguen funcionando.');
});
def('ticket', 'tipos', 'Lista los tipos de ticket', '', 'Administrator', (i, o, g, cf) => {
  const L = Object.values(TKT(cf)).map(x => `${x.emoji || '🎫'} **${x.name}** → ${x.cat ? `<#${x.cat}>` : 'categoría por defecto'} · ${x.role ? `<@&${x.role}>` : 'soporte global'}${x.desc ? `\n-# ${x.desc}` : ''}`);
  say(i, '🎫 Tipos de ticket', L.join('\n') || 'Ninguno. Crea uno con `/ticket tipo`.', true);
});
def('ticket', 'panel', 'Publica el panel (menú desplegable si hay tipos; si no, botón)', 'canal:c,modo:s', 'Administrator', async (i, o, g, cf) => {
  const dest = o.canal ?? i.channel, ci = chIssue(i.guild, dest, validFormat(cf.messageFormats?.ticket)); if (ci) return no(i, `No puedo publicar en ${dest}: ${ci}.`);
  const n = Object.keys(TKT(cf)).length, mode = o.modo || (n ? 'menu' : 'boton');
  if (mode === 'menu' && !n) return no(i, 'Para usar el menú crea antes al menos un tipo con `/ticket tipo`.');
  try {
    const v=cf.tk.emb||{},rows=tkRows(cf,mode),format=validFormat(cf.messageFormats?.ticket);
    const payload=format==='embed'?{embeds:tkPanelEmbeds(i.guildId,cf),components:rows}:
      await buildMessage({format,title:v.title||'🎫 Soporte',description:v.desc||'Abre un ticket para ponerte en contacto con el equipo de staff.',color:v.color??cf.color,banner:v.banner,image:v.img,thumbnail:v.thumb,footer:v.footer,components:rows});
    await dest.send(payload);
  }
  catch (err) { return no(i, `No pude publicar el panel: ${err.message}`); }
  ok(i, `Panel (${mode === 'menu' ? 'menú desplegable' : 'botón'}) enviado a ${dest}.`);
});
def('ticket', 'add', 'Añade un usuario al ticket (solo staff)', 'usuario:u!', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await i.channel.permissionOverwrites.edit(o.usuario.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); ok(i, `${o.usuario} añadido.`); });
def('ticket', 'remove', 'Quita un usuario del ticket (solo staff)', 'usuario:u!', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await i.channel.permissionOverwrites.delete(o.usuario.id); ok(i, `${o.usuario} quitado.`); });
def('ticket', 'close', 'Cierra el ticket (solo administradores o soporte)', '', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await ok(i, 'Cerrando ticket en 5 segundos...'); closeTicket(i.channel, i.user); });
def('ticket', 'rename', 'Renombra el ticket (solo staff)', 'nombre:s!', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await i.channel.setName(o.nombre.slice(0, 90)); ok(i, 'Ticket renombrado.'); });
def('ticket', 'claim', 'Reclama el ticket (solo staff)', '', null, (i, o, g) => { const t = tkCtx(i, g); if (!t) return; t.claimed = i.user.id; save(); i.reply({ embeds: [E(i.guildId, '🙋 Ticket reclamado', `${i.user} atenderá este ticket.`)] }); });
def('ticket', 'transcript', 'Genera la transcripción (solo staff)', '', null, async (i, o, g) => { if (!tkCtx(i, g)) return; await i.deferReply(); i.editReply({ files: [await transcript(i.channel)] }); });
def('ticket', 'limite', 'Máximo de tickets por usuario', 'cantidad:i!', 'Administrator', (i, o, g, cf) => { cf.tk.max = Math.max(1, o.cantidad); save(); ok(i, `Límite: **${cf.tk.max}** ticket(s) por usuario.`); });
async function openTicket(i, key) {
  const g = G(i.guildId), cf = C(i.guildId), t = cf.tk, ty = key ? TKT(cf)[key] : null;
  if (key && !ty) return no(i, 'Ese tipo de ticket ya no existe.');
  const mine = Object.entries(g.tickets).filter(([id, x]) => x.owner === i.user.id && i.guild.channels.cache.has(id));
  if (mine.length >= t.max) return no(i, `Ya tienes un ticket abierto: <#${mine[0][0]}>`);
  // categoría del tipo (o la por defecto); debe existir y ser de tipo categoría; si no, el ticket se crea sin ella
  const wantCat = ty?.cat || t.cat, cat = wantCat && i.guild.channels.cache.get(wantCat), parent = cat?.type === ChannelType.GuildCategory ? cat.id : null;
  if (wantCat && !parent) lg(i.guildId, 'tickets', E(i.guildId, '⚠️ Categoría de tickets inválida', `La categoría de ${ty ? `**${ty.name}**` : 'tickets'} ya no existe o no es una categoría, así que el ticket se creó sin categoría. Usa \`/ticket ${ty ? 'tipo' : 'setup'}\` y elige una **categoría**.`));
  const roles = [...new Set([t.role, ty?.role].filter(r => r && i.guild.roles.cache.has(r)))];
  t.n++; const allow = [P.ViewChannel, P.SendMessages, P.AttachFiles, P.ReadMessageHistory];
  let ch;
  try {
    ch = await i.guild.channels.create({ name: `${(ty && tkSlug(ty.name)) || 'ticket'}-${String(t.n).padStart(4, '0')}`, type: ChannelType.GuildText, parent,
      topic: `Ticket de ${i.user.tag}${ty ? ` · ${ty.name}` : ''}`,
      permissionOverwrites: [{ id: i.guild.id, deny: [P.ViewChannel] }, { id: i.user.id, allow }, { id: client.user.id, allow: [...allow, P.ManageChannels] }, ...roles.map(r => ({ id: r, allow }))] });
  } catch (err) { t.n--; return no(i, `No pude crear el ticket: ${err.message}\nAvisa a un administrador (¿categoría llena o falta el permiso Gestionar canales?).`); }
  g.tickets[ch.id] = { owner: i.user.id, created: Date.now(), ...(key ? { type: key } : {}) }; save();
  const e = E(i.guildId, `${ty?.emoji || '🎫'} ${ty ? ty.name : 'Ticket'} #${t.n}`, fmt(ty?.welcome || t.emb.welcome || 'Hola {user}, el staff te atenderá pronto. Describe tu problema.', { user: `${i.user}`, server: i.guild.name, tipo: ty?.name || 'General' }), t.emb.img);
  if (Number.isInteger(t.emb.color)) e.setColor(t.emb.color);
  await ch.send({ content: `${i.user}${roles.length ? ' ' + roles.map(r => `<@&${r}>`).join(' ') : ''}`, embeds: [...tkBanner(i.guildId, cf), e], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk_close').setLabel('Cerrar (staff)').setEmoji('🔒').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('tk_claim').setLabel('Reclamar').setEmoji('🙋').setStyle(ButtonStyle.Success))] });
  lg(i.guildId, 'tickets', E(i.guildId, '🎫 Ticket abierto', `${i.user} abrió ${ch}${ty ? ` · tipo **${ty.name}**` : ''}`)); i.reply({ flags: 64, embeds: [E(i.guildId, '🎫 Ticket creado', `${ch}`)] });
}
const tkOpen = (i, key) => openTicket(i, key).catch(err => { console.error('Ticket:', err.message); const p = { flags: 64, embeds: [E(i.guildId, '❌ Error', `No pude abrir el ticket: ${err.message}`)] }; return (i.replied || i.deferred ? i.followUp(p) : i.reply(p)).catch(() => {}); });

/* ============================== 11. INVITACIONES (19) ============================== */
// Detección: se compara el caché de invitaciones con las actuales en cada entrada (en cola por servidor para evitar
// carreras). Cubre invitaciones de último uso (se borran al agotarse) y URL personalizada. Requiere "Gestionar servidor".
const IC = new Map(), VU = new Map(), IQ = new Map();
const invSnap = inv => new Map(inv.map(x => [x.code, { uses: x.uses ?? 0, by: x.inviter?.id ?? null, max: x.maxUses || 0, exp: x.expiresTimestamp || 0 }]));
const loadInv = async g => {
  try { IC.set(g.id, invSnap(await g.invites.fetch())); } catch {}
  if (g.features.includes('VANITY_URL')) { try { VU.set(g.id, (await g.fetchVanityData()).uses); } catch {} }
};
const invQ = (gid, fn) => { const run = (IQ.get(gid) || Promise.resolve()).then(fn); IQ.set(gid, run.catch(() => {})); return run; };
const invTotal = u => u.inv + u.bonus - u.left;
const IO = cf => ({ fd: cf.inv.fd ?? 3, rejoin: cf.inv.rj ?? true, revoke: cf.inv.rv ?? false });
const INVT = { normal: 'invitación', fake: 'cuenta nueva (posible falsa)', rejoin: 'reingreso', vanity: 'link personalizado', unknown: 'desconocido' };
const INVC = { normal: '#57F287', fake: '#FEE75C', rejoin: '#5865F2', vanity: '#EB459E', unknown: '#99AAB5' };
const durTxt = ms => { const m = Math.floor(ms / 6e4); if (m < 1) return 'menos de 1 minuto'; if (m < 60) return `${m} min`; const h = Math.floor(m / 60); if (h < 24) return `${h} h`; const d = Math.floor(h / 24); return `${d} día${d > 1 ? 's' : ''}`; };
const INV_EV = {
  entrada: { title: '📥 Nueva entrada', color: '#57F287', desc: '{user} entró al servidor.\n👤 Invitado por: {inviter}\n🔗 Código: `{code}` · Tipo: **{type}**\n📊 Invitaciones de {inviter}: **{count}**\n🕒 Cuenta creada {created}' },
  salida: { title: '📤 Salida de miembro', color: '#ED4245', desc: '**{tag}** salió tras **{stay}**.\n👤 Lo había invitado: {inviter}\n📊 Invitaciones de {inviter}: **{count}**' },
  creada: { title: '🔗 Invitación creada', color: '#5865F2', desc: '{inviter} creó el código `{code}`.\n📍 Canal: {channel}\n🔢 Usos máximos: **{max}** · ⏳ Expira: {expires}' },
  borrada: { title: '🗑️ Invitación eliminada', color: '#99AAB5', desc: 'El código `{code}` de {inviter} fue eliminado o se agotó. (Usos: {uses})' },
  recompensa: { title: '🎁 Recompensa de invitaciones', color: '#F1C40F', desc: '{inviter} {action} {role} ({count} invitaciones).{note}' },
  admin: { title: '🛠️ Ajuste de invitaciones', color: '#E67E22', desc: '{admin} {action} a {user}. Total ahora: **{count}**' },

};
const dg = c => `discord.gg/${c}`;
// Tarjetas por defecto (si el admin personalizó el log con /invite logmsg se respeta su texto)
const INV_CARD = {
  entrada: (v, col, gid) => logCard(gid, `🎉 ${v.name || v.tag} se unió`, [
    ['📨', 'Invitado por', v.inviter],
    v.linkKind === 'vanity' ? ['🌟', 'Link personalizado', v.link] : v.linkKind === 'invite' ? ['🔗', 'Link normal', v.link] : ['🔗', 'Link usado', '❓ Desconocido'],
    v.inviterRaw ? ['📊', `Invitaciones de quien invitó`, `**${v.count}**`] : null,
    ['🕒', 'Cuenta creada', v.created], ['👥', 'Miembros ahora', `**${v.members}**`]], { color: col, user: v._user }),
  salida: (v, col, gid) => logCard(gid, `📤 ${v.tag} salió`, [['⏱️', 'Estuvo en el servidor', v.stay], ['📨', 'Lo había invitado', v.inviter], ['📊', 'Invitaciones de quien invitó', `**${v.count}**`]], { color: col, user: v._user }),
  creada: (v, col, gid) => logCard(gid, '🔗 Invitación creada', [['👤', 'Creada por', v.inviter], ['🔗', 'Link', `discord.gg/${v.code}`], ['📍', 'Canal', v.channel], ['🔢', 'Usos máximos', `**${v.max}**`], ['⏳', 'Expira', v.expires]], { color: col, user: v._user }),
  borrada: (v, col, gid) => logCard(gid, '🗑️ Invitación eliminada', [['🔗', 'Link', `discord.gg/${v.code}`], ['👤', 'Era de', v.inviter], ['📈', 'Usos', `**${v.uses}**`]], { color: col, user: v._user }),
  recompensa: (v, col, gid) => logCard(gid, '🎁 Recompensa de invitaciones', [['👤', 'Miembro', v.inviter], ['🎭', 'Rol', `${v.action} ${v.role}`], ['📊', 'Invitaciones', `**${v.count}**`], v.note ? ['⚠️', 'Nota', String(v.note).trim()] : null], { color: col, user: v._user }),
  admin: (v, col, gid) => logCard(gid, '🛠️ Ajuste de invitaciones', [['🛡️', 'Admin', v.admin], ['👤', 'Miembro', v.user], ['✏️', 'Acción', v.action], ['📊', 'Total ahora', `**${v.count}**`]], { color: col, user: v._user }),
};
function invEmbed(gid, ev, vars, col) {
  const c = C(gid).inv.lm?.[ev] || {}, D = INV_EV[ev];
  if (c.title == null && c.desc == null && INV_CARD[ev]) return INV_CARD[ev](vars, c.color ?? col ?? D.color, gid);
  const e = new EmbedBuilder().setColor(c.color ?? col ?? D.color).setTimestamp()
    .setTitle(fmt(c.title ?? D.title, vars).slice(0, 256) || null).setDescription(fmt(c.desc ?? D.desc, vars).slice(0, 4096) || null);
  if (vars._thumb) e.setThumbnail(vars._thumb);
  return e;
}
function invLog(gid, ev, vars, col) {
  if ((C(gid).inv.lo || []).includes(ev)) return;
  lg(gid, 'invitaciones', invEmbed(gid, ev, vars, col));
}
const invVars = (m, info, jr) => ({
  user: `${m}`, tag: m.user.tag, id: m.id, inviter: jr.inviter ? `<@${jr.inviter}>` : 'desconocido', code: info.code ?? '—', uses: info.uses || '—',
  count: jr.count, server: m.guild.name, members: m.guild.memberCount, created: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`,
  type: INVT[jr.type] + (info.ambiguous ? ' (ambigua)' : ''), _thumb: m.displayAvatarURL(), _user: m.user, name: m.displayName,
  inviterRaw: jr.inviter, link: info.code ? dg(info.code) : '—', linkKind: jr.type === 'vanity' || info.type === 'vanity' ? 'vanity' : info.code ? 'invite' : 'none',
});
const trackInvite = m => invQ(m.guild.id, async () => {
  const guild = m.guild, gid = guild.id, old = IC.get(gid), res = { by: null, code: null, type: 'unknown', ambiguous: false, uses: 0 };
  const vanity = async () => { // URL personalizada: sube su contador de usos cuando alguien entra por ella
    if (!guild.features.includes('VANITY_URL')) return null;
    try { const v = await guild.fetchVanityData(), pu = VU.get(gid); VU.set(gid, v.uses); if (pu !== undefined && v.uses > pu) return Object.assign(res, { type: 'vanity', code: v.code }); } catch {}
    return null;
  };
  let fresh = null; try { fresh = await guild.invites.fetch(); } catch {}
  if (!fresh) return (await vanity()) || res;
  const snap = invSnap(fresh); IC.set(gid, snap);
  const cand = [];
  if (old) {
    for (const [code, x] of snap) if (x.uses > (old.get(code)?.uses ?? 0)) cand.push({ code, by: x.by, uses: x.uses });
    if (!cand.length) for (const [code, o] of old) if (!snap.has(code) && o.max && o.uses + 1 >= o.max && !(o.exp && o.exp < Date.now())) cand.push({ code, by: o.by, uses: o.max }); // último uso: la invitación desaparece
  }
  if (cand.length) { await vanity(); return Object.assign(res, cand[0], { type: 'invite', ambiguous: cand.length > 1 }); } // se refresca el contador de la URL aunque se use una invitación normal
  return (await vanity()) || res;
});
function recordJoin(m, info) {
  const gid = m.guild.id, g = G(gid), o = IO(C(gid)), prev = g.invby[m.id], res = { type: info.type === 'vanity' ? 'vanity' : 'unknown', count: 0, inviter: null };
  if (info.type === 'invite' && info.by && info.by !== m.id) {
    const iu = U(gid, info.by), fake = Date.now() - m.user.createdTimestamp < o.fd * 864e5; res.inviter = info.by;
    if (prev?.left && o.rejoin && prev.by === info.by && !prev.fake) { iu.left = Math.max(0, iu.left - 1); g.invby[m.id] = { ...prev, left: false, code: info.code, at: Date.now() }; res.type = 'rejoin'; }
    else { fake ? iu.fake++ : iu.inv++; g.invby[m.id] = { by: info.by, fake, left: false, code: info.code, at: Date.now() }; res.type = fake ? 'fake' : 'normal'; }
    res.count = invTotal(iu);
  }
  save(); return res;
}
async function syncRewards(guild, uid) {
  const g = G(guild.id), ents = Object.entries(g.invrew); if (!ents.length) return;
  const mem = await guild.members.fetch(uid).catch(() => null); if (!mem) return;
  const tot = invTotal(U(guild.id, uid)), o = IO(C(guild.id));
  for (const [n, rid] of ents) {
    const has = mem.roles.cache.has(rid), r = guild.roles.cache.get(rid), v = { inviter: `${mem}`, count: tot, role: r ? `${r}` : `\`${rid}\``, note: '', _thumb: mem.displayAvatarURL() };
    if (tot >= +n && !has) {
      const p = roleIssue(guild, r);
      if (p) { invLog(guild.id, 'recompensa', { ...v, action: 'debía recibir el rol', note: `\n⚠️ No se pudo: ${p}` }, '#ED4245'); continue; }
      try { await mem.roles.add(rid, `Recompensa: ${n} invitaciones`); invLog(guild.id, 'recompensa', { ...v, action: 'recibió el rol' }); }
      catch (e) { invLog(guild.id, 'recompensa', { ...v, action: 'debía recibir el rol', note: `\n⚠️ Error: ${e.message}` }, '#ED4245'); }
    } else if (tot < +n && has && o.revoke && r && !roleIssue(guild, r)) {
      try { await mem.roles.remove(rid, `Bajó de ${n} invitaciones`); invLog(guild.id, 'recompensa', { ...v, action: 'perdió el rol', note: `\n(bajó de ${n})` }, '#E67E22'); } catch {}
    }
  }
}

def('invite', 'invites', 'Ver invitaciones', 'usuario:u', null, (i, o, g, cf) => {
  const t = o.usuario || i.user, u = U(i.guildId, t.id), by = g.invby[t.id];
  const rank = Object.entries(g.users).filter(([, x]) => invTotal(x) > 0).sort((a, b) => invTotal(b[1]) - invTotal(a[1])).findIndex(([id]) => id === t.id) + 1;
  i.reply({ embeds: [E(i.guildId, `📨 Invitaciones de ${t.username}`, `✅ Reales: **${u.inv}**\n🚪 Salieron: **${u.left}**\n🕵️ Falsas: **${u.fake}**\n🎁 Bonus: **${u.bonus}**\n\n📊 **Total: ${invTotal(u)}**${rank ? ` · 🏆 Puesto #${rank}` : ''}${by ? `\n👤 Lo invitó: <@${by.by}>` : ''}`, cf.inv.img).setThumbnail(t.displayAvatarURL())] });
});
def('invite', 'top', 'Top de invitadores', '', null, (i, o, g) => { const r = Object.entries(g.users).filter(([, u]) => invTotal(u) > 0).sort((a, b) => invTotal(b[1]) - invTotal(a[1])).slice(0, 10); say(i, '🏆 Top invitaciones', r.map((x, n) => `**${n + 1}.** <@${x[0]}> — ${invTotal(x[1])}`).join('\n') || 'Sin datos.'); });
def('invite', 'quien', 'Quién invitó a un usuario', 'usuario:u!', null, (i, o, g) => {
  const r = g.invby[o.usuario.id];
  say(i, `👤 ${o.usuario.username}`, r ? `Invitado por <@${r.by}>${r.code ? ` con el código \`${r.code}\`` : ''}${r.at ? `\n📅 Entró <t:${Math.floor(r.at / 1000)}:R>` : ''}${r.fake ? '\n🕵️ Marcado como cuenta nueva (falsa)' : ''}${r.left ? '\n🚪 Ya no está en el servidor' : ''}` : 'Sin registro (entró antes que el bot, por URL personalizada o no se pudo detectar).');
});
def('invite', 'invitados', 'Lista de personas que invitó un usuario', 'usuario:u', null, (i, o, g) => {
  const t = o.usuario || i.user, L = Object.entries(g.invby).filter(([, r]) => r.by === t.id).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  const rows = L.slice(0, 20).map(([id, r]) => `${r.fake ? '🕵️' : r.left ? '🚪' : '✅'} <@${id}>${r.at ? ` · <t:${Math.floor(r.at / 1000)}:R>` : ''}`);
  say(i, `📨 Invitados por ${t.username} (${L.length})`, (rows.join('\n') || 'Nadie todavía.') + (L.length > 20 ? `\n… y ${L.length - 20} más` : ''));
});
def('invite', 'config', 'Bienvenida simple antigua (recomendado: /bienvenida)', 'canal:c,mensaje:s,salida:s', 'Administrator', (i, o, g, cf) => {
  if (o.canal) cf.inv.ch = o.canal.id; if (o.mensaje) cf.inv.msg = nl(o.mensaje); if (o.salida) cf.inv.leave = nl(o.salida); save(); ok(i, 'Configuración guardada.');
});
def('invite', 'embed', 'Embed de la bienvenida simple antigua', 'titulo:s,color:s,imagen:s', 'Administrator', (i, o, g, cf) => { if (o.titulo) cf.inv.title = o.titulo; if (hex(o.color)) cf.inv.color = hex(o.color); if (url(o.imagen)) cf.inv.img = o.imagen; save(); ok(i, 'Embed actualizado.'); });
def('invite', 'ajustes', 'Días para cuentas falsas, reingresos y quitar roles al bajar', 'fakedias:i,reingreso:b,quitar:b', 'Administrator', (i, o, g, cf) => {
  const ic = cf.inv;
  if (o.fakedias != null) { if (o.fakedias < 0 || o.fakedias > 365) return no(i, '`fakedias` debe estar entre 0 y 365.'); ic.fd = o.fakedias; }
  if (o.reingreso != null) ic.rj = o.reingreso; if (o.quitar != null) ic.rv = o.quitar; save();
  const x = IO(cf); ok(i, `🕵️ Cuenta falsa si tiene menos de **${x.fd}** días (0 = nunca)\n🔁 Los reingresos no cuentan doble: **${x.rejoin ? 'sí' : 'no'}**\n➖ Quitar rol de recompensa al bajar del mínimo: **${x.revoke ? 'sí' : 'no'}**`);
});
def('invite', 'logs', 'Elige el canal donde llegan los logs de invitaciones (entradas, salidas, links)', 'canal:c!', 'Administrator', (i, o, g, cf) => {
  const p = chIssue(i.guild, o.canal); if (p) return no(i, `No puedo usar ${o.canal}: ${p}.`);
  cf.logch.invitaciones = o.canal.id; save();
  ok(i, `📨 Los logs de invitaciones ahora llegan a ${o.canal}.\nPrueba con \`/invite vista suceso:entrada\`.`);
});
def('canal', 'invitaciones', 'Canal donde llegan SOLO los avisos de invitaciones (quién invitó y por qué link entró)', 'canal:c', 'Administrator', (i, o, g, cf) => {
  if (!o.canal) { const cur = cf.logch.invitaciones; return say(i, '📨 Canal de invitaciones', cur ? `Ahora llegan a <#${cur}>.\nPara cambiarlo: \`/canal invitaciones canal:#otro-canal\`` : 'Todavía no hay un canal elegido (se usa el log general).\nElige uno con `/canal invitaciones canal:#canal`.', true); }
  const p = chIssue(i.guild, o.canal); if (p) return no(i, `No puedo usar ${o.canal}: ${p}.`);
  cf.logch.invitaciones = o.canal.id; save();
  ok(i, `📨 Las invitaciones (quién invitó y por qué link entró) ahora llegan solo a ${o.canal}.\nPrueba cómo se ve con \`/invite vista suceso:entrada\`.`);
});
def('invite', 'logevento', 'Activa/desactiva un tipo de log de invitaciones', 'suceso:s!,estado:b!', 'Administrator', (i, o, g, cf) => {
  const lo = new Set(cf.inv.lo || []); o.estado ? lo.delete(o.suceso) : lo.add(o.suceso); cf.inv.lo = [...lo]; save(); ok(i, `**${o.suceso}** ${o.estado ? '🟢 activado' : '🔴 desactivado'}.`);
});
def('invite', 'logmsg', 'Personaliza el embed de un log. Ver /invite variables', 'suceso:s!,titulo:s,descripcion:s,color:s,restaurar:b', 'Administrator', (i, o, g, cf) => {
  const ic = cf.inv; ic.lm ??= {};
  if (o.restaurar) { delete ic.lm[o.suceso]; save(); return ok(i, `Log **${o.suceso}** restaurado al diseño por defecto.`); }
  const c = { ...(ic.lm[o.suceso] || {}) };
  if (o.color) { if (hex(o.color) === null) return no(i, 'Color inválido. Usa `#RRGGBB`.'); c.color = hex(o.color); }
  if (o.titulo) c.title = o.titulo; if (o.descripcion) c.desc = nl(o.descripcion);
  ic.lm[o.suceso] = c; save(); ok(i, 'Log personalizado. Pruébalo con `/invite vista`.');
});
def('invite', 'vista', 'Previsualiza un log de invitaciones', 'suceso:s!', 'Administrator', (i, o) => {
  const v = { user: `${i.user}`, tag: i.user.tag, id: i.user.id, inviter: `${i.user}`, code: 'abc123', uses: 3, count: 5, server: i.guild.name, members: i.guild.memberCount,
    created: `<t:${Math.floor(i.user.createdTimestamp / 1000)}:R>`, type: INVT.normal, stay: '2 días', channel: `${i.channel}`, max: 10, expires: 'en 7 días',
    role: '@Rol', action: 'recibió el rol', note: '', admin: `${i.user}`, _thumb: i.user.displayAvatarURL() };
  { const em = invEmbed(i.guildId, o.suceso, v), m = lcMsg(em.lc ? em : lgEnrich(i.guild, em)); i.reply({ ...m, flags: (m.flags || 0) | 64, allowedMentions: { parse: [] } }); }
});
def('invite', 'variables', 'Variables para personalizar los logs', '', null, (i) => say(i, '🧩 Variables de logs',
  '**Entrada:** `{user}` `{tag}` `{id}` `{inviter}` `{code}` `{uses}` `{count}` `{type}` `{created}` `{server}` `{members}`\n**Salida:** `{user}` `{tag}` `{id}` `{inviter}` `{count}` `{stay}` `{server}` `{members}`\n**Creada:** `{inviter}` `{code}` `{channel}` `{max}` `{expires}`\n**Eliminada:** `{inviter}` `{code}` `{uses}`\n**Recompensa:** `{inviter}` `{action}` `{role}` `{count}` `{note}`\n**Ajuste:** `{admin}` `{action}` `{user}` `{count}`', true));
def('invite', 'ver', 'Ver la configuración de invitaciones', '', 'Administrator', (i, o, g, cf) => {
  const ic = cf.inv, x = IO(cf), lc = cf.logch.invitaciones || cf.logch.general;
  const rw = Object.entries(g.invrew).sort((a, b) => a[0] - b[0]).map(([n, r]) => `**${n}** → <@&${r}>`).join('\n') || 'Ninguna';
  i.reply({ flags: 64, embeds: [E(i.guildId, '📨 Configuración de invitaciones').addFields(
    { name: '📜 Canal de logs', value: lc ? `<#${lc}>${cf.logch.invitaciones ? '' : ' (log general)'}` : '⚠️ Sin canal. Usa `/canal invitaciones`' },
    { name: '🔔 Logs activos', value: Object.keys(INV_EV).map(k => `${(ic.lo || []).includes(k) ? '🔴' : '🟢'} ${k}`).join(' · ') },
    { name: '⚙️ Reglas', value: `🕵️ Falsa si cuenta < **${x.fd}** días\n🔁 Reingresos sin doble conteo: **${x.rejoin ? 'sí' : 'no'}**\n➖ Quitar rol al bajar: **${x.revoke ? 'sí' : 'no'}**` },
    { name: '🎁 Recompensas', value: rw.slice(0, 1024) })] });
});
def('invite', 'revisar', 'Diagnóstico del sistema de invitaciones', '', 'Administrator', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 });
  const me = i.guild.members.me, L = [];
  L.push(me.permissions.has(P.ManageGuild) ? '✅ El bot tiene **Gestionar servidor**' : '❌ Falta **Gestionar servidor**: sin él no se puede saber quién invitó');
  let n = null, err = null; try { n = (await i.guild.invites.fetch()).size; } catch (e) { err = e.message; }
  L.push(n != null ? `✅ Puedo leer las invitaciones (${n} activas, ${IC.get(i.guildId)?.size ?? 0} en caché)` : `❌ No puedo leer invitaciones: ${err}`);
  if (n != null && !IC.has(i.guildId)) { await loadInv(i.guild); L.push('🔄 Caché cargada ahora mismo'); }
  L.push(i.guild.features.includes('VANITY_URL') ? '✅ URL personalizada: también se detecta' : 'ℹ️ Sin URL personalizada');
  const lc = cf.logch.invitaciones || cf.logch.general, ch = lc && i.guild.channels.cache.get(lc);
  L.push(!ch ? '⚠️ Sin canal de logs: usa `/log servidor`' : ch.permissionsFor(me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]) ? `✅ Logs en ${ch}` : `❌ No puedo escribir en ${ch}`);
  for (const [k, rid] of Object.entries(g.invrew)) { const p = roleIssue(i.guild, i.guild.roles.cache.get(rid)); L.push(`${p ? '❌' : '✅'} Recompensa ${k}: <@&${rid}>${p ? ` — ${p}` : ''}`); }
  i.editReply({ embeds: [E(i.guildId, '🔎 Diagnóstico de invitaciones', L.join('\n'))] });
});
def('invite', 'reset', 'Reinicia invitaciones de un usuario', 'usuario:u!', 'Administrator', (i, o) => {
  Object.assign(U(i.guildId, o.usuario.id), { inv: 0, left: 0, fake: 0, bonus: 0 }); save();
  invLog(i.guildId, 'admin', { admin: `${i.user}`, action: 'reinició las invitaciones', user: `${o.usuario}`, count: 0 }); syncRewards(i.guild, o.usuario.id).catch(console.error);
  ok(i, `Invitaciones de ${o.usuario} reiniciadas.`);
});
def('invite', 'bonus', 'Da invitaciones bonus (negativo para quitar)', 'usuario:u!,cantidad:i!', 'Administrator', (i, o) => {
  const u = U(i.guildId, o.usuario.id); u.bonus += o.cantidad; save();
  invLog(i.guildId, 'admin', { admin: `${i.user}`, action: `${o.cantidad >= 0 ? 'dio' : 'quitó'} ${Math.abs(o.cantidad)} bonus`, user: `${o.usuario}`, count: invTotal(u) }); syncRewards(i.guild, o.usuario.id).catch(console.error);
  ok(i, `Bonus de ${o.cantidad} a ${o.usuario}. Total: **${invTotal(u)}**`);
});
def('invite', 'rewardadd', 'Rol al alcanzar N invitaciones', 'invitaciones:i!,rol:r!', 'Administrator', (i, o, g) => {
  const p = roleIssue(i.guild, o.rol); if (p) return no(i, `No puedo dar ${o.rol}: ${p}.`);
  g.invrew[o.invitaciones] = o.rol.id; save(); ok(i, `**${o.invitaciones}** invitaciones → ${o.rol}\nUsa \`/invite rewardaplicar\` para dárselo ya a quienes lo cumplan.`);
});
def('invite', 'rewardremove', 'Quita recompensa de invitaciones', 'invitaciones:i!', 'Administrator', (i, o, g) => { delete g.invrew[o.invitaciones]; save(); ok(i, 'Recompensa eliminada.'); });
def('invite', 'rewardaplicar', 'Aplica las recompensas a quienes ya cumplen el mínimo', '', 'Administrator', async (i, o, g) => {
  if (!Object.keys(g.invrew).length) return no(i, 'No hay recompensas. Usa `/invite rewardadd`.');
  await i.deferReply({ flags: 64 });
  const ids = Object.entries(g.users).filter(([, u]) => invTotal(u) > 0).map(x => x[0]);
  for (const id of ids) { await syncRewards(i.guild, id).catch(() => {}); await new Promise(r => setTimeout(r, 300)); }
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Recompensas revisadas para **${ids.length}** miembros.`)] });
});

/* ============================== 12. UTILIDAD (25) ============================== */
const info = (i, t, d) => i.reply({ embeds: [E(i.guildId, t, d)] });
def('util', 'ping', 'Latencia del bot', '', null, (i) => info(i, '🏓 Pong', `API: **${client.ws.ping}ms**`));
def('util', 'avatar', 'Avatar de un usuario', 'usuario:u', null, (i, o) => { const t = o.usuario || i.user; i.reply({ embeds: [E(i.guildId, `🖼️ Avatar de ${t.username}`).setImage(t.displayAvatarURL({ size: 1024 }))] }); });
def('util', 'banner', 'Banner de un usuario', 'usuario:u', null, async (i, o) => { const t = await client.users.fetch((o.usuario || i.user).id, { force: true }), b = t.bannerURL({ size: 1024 }); if (!b) return no(i, 'No tiene banner.'); i.reply({ embeds: [E(i.guildId, `🎨 Banner de ${t.username}`).setImage(b)] }); });
def('util', 'userinfo', 'Info de un usuario', 'usuario:u', null, async (i, o) => {
  const t = o.usuario || i.user, m = await M(i, t);
  i.reply({ embeds: [E(i.guildId, `👤 ${t.tag}`, `**ID:** ${t.id}\n**Cuenta creada:** <t:${Math.floor(t.createdTimestamp / 1000)}:R>\n**Se unió:** ${m ? `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>` : '—'}\n**Roles:** ${m ? m.roles.cache.filter(r => r.id !== i.guild.id).map(r => r).join(' ') || 'Ninguno' : '—'}`).setThumbnail(t.displayAvatarURL())] });
});
def('util', 'serverinfo', 'Info del servidor', '', null, (i) => { const g = i.guild; i.reply({ embeds: [E(i.guildId, `🏠 ${g.name}`, `**ID:** ${g.id}\n**Dueño:** <@${g.ownerId}>\n**Miembros:** ${g.memberCount}\n**Canales:** ${g.channels.cache.size}\n**Roles:** ${g.roles.cache.size}\n**Boosts:** ${g.premiumSubscriptionCount}\n**Creado:** <t:${Math.floor(g.createdTimestamp / 1000)}:R>`).setThumbnail(g.iconURL())] }); });
def('util', 'roleinfo', 'Info de un rol', 'rol:r!', null, (i, o) => info(i, `🎭 ${o.rol.name}`, `**ID:** ${o.rol.id}\n**Color:** ${o.rol.hexColor}\n**Miembros:** ${o.rol.members.size}\n**Mencionable:** ${o.rol.mentionable}\n**Posición:** ${o.rol.position}`));
def('util', 'channelinfo', 'Info de un canal', 'canal:c', null, (i, o) => { const c = o.canal || i.channel; info(i, `#️⃣ ${c.name}`, `**ID:** ${c.id}\n**Tipo:** ${ChannelType[c.type]}\n**Creado:** <t:${Math.floor(c.createdTimestamp / 1000)}:R>`); });
def('util', 'botinfo', 'Info del bot', '', null, (i) => info(i, '🤖 Bot', `**Servidores:** ${client.guilds.cache.size}\n**Usuarios:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}\n**Comandos:** ${Object.values(CATS).reduce((a, c) => a + Object.keys(c).length, 0)}\n**Node:** ${process.version}\n**RAM:** ${(process.memoryUsage().heapUsed / 1048576).toFixed(1)} MB`));
def('util', 'uptime', 'Tiempo encendido', '', null, (i) => info(i, '⏱️ Uptime', `Encendido desde <t:${Math.floor(START / 1000)}:R>`));
/* Ayuda con menús: un embed no admite más de 25 campos ni 6000 caracteres, y ya hay más de 25 módulos.
   Se ve la lista de módulos y, al elegir uno en el menú, sus comandos con su descripción. */
function helpPayload(gid, mod) {
  const mods = Object.keys(CATS), total = mods.reduce((a, c) => a + Object.keys(CATS[c]).length, 0), PER = 25; // un menú admite 25 opciones
  const num = c => Object.keys(CATS[c]).length;
  let e;
  if (mod && CATS[mod]) {
    const subs = Object.entries(CATS[mod]);
    const lines = ROOT.has(mod) ? [`\`/${mod}\` — ${subs[0][1].desc}`] : subs.map(([n, c]) => `\`/${mod} ${n}\` — ${c.desc}`);
    e = E(gid, `📚 /${mod} · ${subs.length} comando${subs.length === 1 ? '' : 's'}`, lines.join('\n').slice(0, 4000));
  } else e = E(gid, `📚 Ayuda · ${total} comandos`, `Elige un módulo en el menú de abajo para ver sus comandos.\n\n${mods.map(c => `**/${c}** · ${num(c)}`).join('\n')}`.slice(0, 4000));
  const rows = [], pages = Math.ceil(mods.length / PER);
  for (let k = 0; k < mods.length; k += PER) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`uh_sel_${k / PER}`)
    .setPlaceholder(pages > 1 ? `Módulos (${k / PER + 1}/${pages})` : 'Elige un módulo')
    .addOptions(mods.slice(k, k + PER).map(c => ({ label: `/${c}`, value: c, description: `${num(c)} comando${num(c) === 1 ? '' : 's'}`, default: c === mod })))));
  if (mod) rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('uh_home').setLabel('Inicio').setEmoji('🏠').setStyle(ButtonStyle.Secondary)));
  return { embeds: [e], components: rows };
}
def('util', 'help', 'Lista de módulos y comandos', '', null, (i) => i.reply(helpPayload(i.guildId)));
def('util', 'autocanales', 'Asigna solos los canales de logs, logros, bienvenida y despedida según sus nombres, y lo guarda', '', 'Administrator', (i, o, g, cf) => {
  const guild = i.guild, nm = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const textos = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
  const buscar = nombre => { const k = nm(nombre); return k.length < 3 ? null : textos.find(c => nm(c.name).includes(k)) || null; };
  const hechos = [];
  for (const [, canales] of LOG_CANALES) for (const [nombre, key] of canales) { // logs: mismos nombres que /log servidor
    if (cf.logch[key] && guild.channels.cache.get(cf.logch[key])) continue;
    const ch = buscar(nombre); if (ch) { cf.logch[key] = ch.id; hechos.push(`${nombre} → ${ch}`); }
  }
  for (const [tipo, key] of Object.entries(LOG_ALIAS)) if (cf.logch[key]) cf.logch[tipo] = cf.logch[key];
  if (!(cf.achch && guild.channels.cache.get(cf.achch))) { const ch = buscar('logros'); if (ch) { cf.achch = ch.id; hechos.push(`Logros → ${ch}`); } }
  for (const [t, nombres] of [['bienvenida', ['bienvenida', 'bienvenidas']], ['despedida', ['despedida', 'despedidas']]]) {
    const w = WBc(cf, t); if (w.ch && guild.channels.cache.get(w.ch)) continue;
    const ch = nombres.map(buscar).find(Boolean); if (ch) { w.ch = ch.id; hechos.push(`${t} → ${ch}`); }
  }
  save();
  ok(i, hechos.length ? `Canales asignados y guardados (${hechos.length}):\n${hechos.map(x => `• ${x}`).join('\n')}`
    : 'No encontré canales con esos nombres. Usa `/log servidor` o renombra tus canales (por ejemplo "logros", "bienvenida", "despedida").');
});
def('util', 'estado', 'Cambia el texto de "Jugando" del perfil. Varias frases separadas con | (rotan solas)', 'texto:s!', 'Administrator', async (i, o) => {
  const frases = o.texto.split('|').map(x => x.trim().slice(0, 128)).filter(Boolean).slice(0, 10);
  if (!frases.length) return no(i, 'Escribe al menos una frase.');
  try { await guardarEstado(frases); } catch (err) { return no(i, `No pude guardar el estado: ${err.message}`); }
  ok(i, `Frases del estado (rotan cada 15 s):\n${frases.map(f => `• ${f}`).join('\n')}`);
});
def('util', 'membercount', 'Cantidad de miembros', '', null, async (i) => { const m = await i.guild.members.fetch(); info(i, '👥 Miembros', `Total: **${i.guild.memberCount}**\nHumanos: **${m.filter(x => !x.user.bot).size}**\nBots: **${m.filter(x => x.user.bot).size}**`); });
def('util', 'emojis', 'Emojis del servidor', '', null, (i) => info(i, '😀 Emojis', i.guild.emojis.cache.map(e => `${e}`).join(' ').slice(0, 4000) || 'Sin emojis.'));
def('util', '8ball', 'Bola 8 mágica', 'pregunta:s!', null, (i, o) => info(i, '🎱 Bola 8', `**${o.pregunta}**\n${R(['Sí', 'No', 'Quizás', 'Definitivamente', 'Ni lo sueñes', 'Pregunta más tarde', 'Todo apunta a que sí', 'Mis fuentes dicen que no'])}`));
def('util', 'moneda', 'Lanza una moneda', '', null, (i) => info(i, '🪙 Moneda', `Salió **${R(['cara', 'cruz'])}**`));
def('util', 'dado', 'Lanza un dado', 'caras:i', null, (i, o) => info(i, '🎲 Dado', `Salió **${rnd(1, Math.max(2, o.caras || 6))}**`));
def('util', 'elegir', 'Elige entre opciones separadas por coma', 'opciones:s!', null, (i, o) => { const a = o.opciones.split(',').map(x => x.trim()).filter(Boolean); if (a.length < 2) return no(i, 'Da al menos 2 opciones.'); info(i, '🤔 Elijo...', `**${R(a)}**`); });
def('util', 'invertir', 'Invierte un texto', 'texto:s!', null, (i, o) => info(i, '🔄 Invertido', [...o.texto].reverse().join('')));
for (const [n, api, txt] of [['abrazar', 'hug', 'abrazó a'], ['golpear', 'punch', 'golpeó a'], ['besar', 'kiss', 'besó a']])
  def('social', n, `${n} a alguien`, 'usuario:u!', null, async (i, o) => { const e = E(i.guildId, null, `**${i.user.username}** ${txt} **${o.usuario.username}**`); const g = await gif(api); if (g) e.setImage(g); i.reply({ embeds: [e] }); });
def('util', 'chiste', 'Cuenta un chiste', '', null, (i) => info(i, '😂 Chiste', R(['¿Qué hace una abeja en el gimnasio? ¡Zum-ba!', '¿Cómo se despiden los químicos? Ácido un placer.', '¿Qué le dice un 0 a un 8? Bonito cinturón.', 'Un programador se va de casa... "¡Te dije que no usaras tabs!"'])));
def('util', 'ship', 'Compatibilidad entre usuarios', 'usuario:u!,usuario2:u', null, (i, o) => {
  const a = o.usuario, b = o.usuario2 || i.user, p = (Number(BigInt(a.id) + BigInt(b.id)) % 101); info(i, '💘 Ship', `${a} + ${b}\n**${p}%** \`${bar(p / 100)}\``);
});
def('util', 'calcular', 'Calculadora', 'expresion:s!', null, (i, o) => {
  if (!/^[\d+\-*/().%\s^]+$/.test(o.expresion)) return no(i, 'Solo números y + - * / ( ) % ^');
  try { info(i, '🧮 Resultado', `\`${o.expresion}\` = **${Function(`"use strict";return (${o.expresion.replace(/\^/g, '**')})`)()}**`); } catch { no(i, 'Expresión inválida.'); }
});
def('util', 'sugerencia', 'Envía una sugerencia', 'texto:s!', null, async (i, o, g, cf) => {
  const c = i.guild.channels.cache.get(cf.logch.sugerencias); if (!c) return no(i, 'No hay canal de sugerencias (`/log servidor`).');
  const m = await c.send({ embeds: [E(i.guildId, '💡 Sugerencia', o.texto).setAuthor({ name: i.user.tag, iconURL: i.user.displayAvatarURL() })] }); await m.react('👍'); await m.react('👎'); ok(i, 'Sugerencia enviada.');
});
def('util', 'reportar', 'Reporta a un usuario al staff', 'usuario:u!,razon:s!', null, (i, o, g, cf) => {
  if (!cf.logch.reportes && !cf.logch.general) return no(i, 'No hay canal de reportes configurado.'); lg(i.guildId, 'reportes', E(i.guildId, '🚨 Reporte', `**Reportado:** ${o.usuario}\n**Por:** ${i.user}\n**Razón:** ${o.razon}\n**Canal:** ${i.channel}`)); ok(i, 'Reporte enviado al staff.');
});

/* ===================== 13. BIENVENIDA Y DESPEDIDA (12) ===================== */
// Funciona sin configurar: si no hay canal fijo, el bot busca solo #bienvenida / canal del sistema / #general.
// Variables: {user} {tag} {name} {id} {server} {members} {created} {inviter} {count}
const WK = t => (t === 'despedida' ? 'bye' : 'wb');
const WBc = (cf, t) => (cf[WK(t)] ??= {});
const WBD = {
  bienvenida: { author: 'LLEGASTE A {server}', title: '👋 ¡Bienvenido/a!', desc: '¡Hola {user}! 🎉 Te damos la bienvenida a **{server}**.\nAhora somos **{members}** miembros.\n🕒 Cuenta creada {created}', content: '{user}', footer: 'Miembro n.º {members}' },
  despedida: { author: 'SE FUE DE {server}', title: '🚪 Hasta pronto', desc: '**{tag}** salió de **{server}**.\nAhora somos **{members}** miembros.', content: '', footer: '' },
};
const NONE = /^(ninguno|ninguna|none|quitar)$/i;
const IMGK = /^(avatar|servidor|ningun[oa]|none|quitar)$/i;
const okSpec = s => s.split('|').map(x => x.trim()).filter(Boolean).every(x => IMGK.test(x) || url(x));
// Sistema antiguo (/invite config) solo si el servidor ya lo usaba y no ha tocado /bienvenida
const wbLegacy = (cf, t) => !WBc(cf, t).ch && !WBc(cf, t).dm && !!cf.inv.ch && (t === 'bienvenida' || !!cf.inv.leave);
const wbVars = (m, extra) => ({
  user: `${m}`, tag: m.user.tag, name: m.displayName ?? m.user.username, id: m.id, server: m.guild.name,
  members: m.guild.memberCount, created: `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`,
  inviter: 'desconocido', count: 0, ...extra,
});
function wbChannel(guild, w, t) {
  const me = guild.members.me;
  const usable = c => !!c && c.isTextBased?.() && !c.isThread?.() && !!c.permissionsFor(me)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]);
  const pick = re => guild.channels.cache.filter(x => x.type === ChannelType.GuildText && re.test(x.name) && usable(x)).sort((a, b) => a.rawPosition - b.rawPosition).first();
  const fixed = guild.channels.cache.get(w.ch); if (usable(fixed)) return fixed;
  return pick(t === 'despedida' ? /despedid|salida|bye|goodbye|leave/i : /bienvenid|welcome|llegada|entrada/i)
    || (t === 'despedida' && pick(/bienvenid|welcome/i)) || (usable(guild.systemChannel) ? guild.systemChannel : null)
    || pick(/general|chat|principal|lobby/i) || null;
}
// spec: 'avatar' | 'servidor' | URL | URL1|URL2|... (elige una al azar) | 'ninguna'
function wbImg(m, spec, kind) {
  const opts = String(spec ?? '').split('|').map(s => s.trim()).filter(Boolean); if (!opts.length) return null;
  const x = R(opts), k = x.toLowerCase(); if (NONE.test(x)) return null;
  if (k === 'avatar') return m.displayAvatarURL?.({ size: 512 }) || m.user.displayAvatarURL({ size: 512 });
  if (k === 'servidor') return kind === 'thumb' ? m.guild.iconURL({ size: 256 }) : (m.guild.bannerURL({ size: 1024 }) || m.guild.splashURL({ size: 1024 }) || null);
  return url(x);
}
function wbEmbed(m, t, extra) {
  const cf = C(m.guild.id), w = WBc(cf, t), D = WBD[t], v = wbVars(m, extra);
  const av = m.displayAvatarURL?.({ size: 256 }) || m.user.displayAvatarURL({ size: 256 });
  const e = new EmbedBuilder().setColor(w.color ?? cf.color).setTimestamp()
    .setTitle(fmt(w.title ?? D.title, v).slice(0, 256) || null)
    .setDescription(fmt(w.desc ?? D.desc, v).slice(0, 4096) || null);
  const th = wbImg(m, w.thumb ?? 'avatar', 'thumb'), im = wbImg(m, w.img ?? 'servidor', 'img'), ft = fmt(w.footer ?? D.footer, v);
  if (th) e.setThumbnail(th); if (im) e.setImage(im);
  const au = fmt(w.author ?? D.author ?? '', v); if (au) e.setAuthor({ name: au.slice(0, 256), iconURL: av });
  if (ft) e.setFooter({ text: ft.slice(0, 2048), iconURL: m.guild.iconURL() || undefined });
  return { e, v };
}
async function sendWB(m, t, extra = {}) {
  const gid = m.guild.id, cf = C(gid), w = WBc(cf, t); if (w.on === false) return;
  const { e, v } = wbEmbed(m, t, extra);
  const format=validFormat(cf.messageFormats?.[t]);
  if (t === 'bienvenida' && w.dm) {
    if(format==='embed')dm(m.user, E(gid, `👋 ${m.guild.name}`, fmt(w.dm, v).slice(0, 4096), wbImg(m, w.img ?? 'servidor', 'img')).setThumbnail(m.guild.iconURL()));
    else buildMessage({format,title:`👋 ${m.guild.name}`,description:fmt(w.dm,v),image:wbImg(m,w.img??'servidor','img'),color:w.color??cf.color}).then(payload=>m.user.send(payload)).catch(()=>{});
  }
  const ch = wbChannel(m.guild, w, t);
  if (!ch) return lg(gid, 'general', E(gid, '⚠️ Sin canal de ' + t, 'No encontré un canal donde enviar el mensaje. Usa `/bienvenida autocanal` o `/bienvenida canal`.'));
  const txt = fmt(w.content ?? WBD[t].content, v).slice(0, 2000);
  const payload=format==='embed'?{content:txt||undefined,embeds:[e],allowedMentions:{users:[m.id]}}:
    await buildMessage({format,content:txt,title:fmt(w.title??WBD[t].title,v),description:fmt(w.desc??WBD[t].desc,v),image:wbImg(m,w.img??'servidor','img'),thumbnail:wbImg(m,w.thumb??'avatar','thumb'),footer:fmt(w.footer??WBD[t].footer,v),author:fmt(w.author??WBD[t].author,v),color:w.color??cf.color,allowedMentions:{users:[m.id]}});
  const sent = await ch.send(payload)
    .catch(err => { lg(gid, 'general', E(gid, '⚠️ No pude enviar la ' + t, `${ch}: ${err.message}`)); return null; });
  if (sent) { (cf.lastWB ??= {})[t] = { ch: ch.id, id: sent.id }; save(); } // recuerda el último para poder editarlo
}

def('bienvenida', 'autocanal', 'Crea los canales #bienvenida y #despedidas y los configura solo', '', 'Administrator', async (i, o, g, cf) => {
  const me = i.guild.members.me; if (!me.permissions.has(P.ManageChannels)) return no(i, 'Necesito el permiso **Gestionar canales**.');
  await i.deferReply({ flags: 64 });
  const mk = (name, topic) => i.guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name) ?? i.guild.channels.create({
    name, type: ChannelType.GuildText, topic, reason: 'Autocanal de bienvenida',
    permissionOverwrites: [
      { id: i.guild.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages] },
      { id: me.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles] },
    ],
  });
  try {
    const a = await mk('👋-bienvenida', 'Aquí damos la bienvenida a los nuevos miembros'), b = await mk('🚪-despedidas', 'Quienes se fueron del servidor');
    Object.assign(WBc(cf, 'bienvenida'), { ch: a.id, on: true }); Object.assign(WBc(cf, 'despedida'), { ch: b.id, on: true }); save();
    i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Bienvenida → ${a}\nDespedida → ${b}\n\nPruébalo con \`/bienvenida vista\`.`)] });
  } catch (err) { i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude crear los canales: ${err.message}`)] }); }
});
def('bienvenida', 'canal', 'Fija el canal (si no, se elige uno automático)', 'evento:s!,canal:c!', 'Administrator', (i, o, g, cf) => {
  if (!o.canal.isTextBased()) return no(i, 'Elige un canal de texto.');
  WBc(cf, o.evento).ch = o.canal.id; save(); ok(i, `**${o.evento}** → ${o.canal}`);
});
def('bienvenida', 'mensaje', 'Texto del embed. Usa \\n para saltos de línea. Ver /bienvenida variables', 'evento:s!,texto:s!', 'Administrator', (i, o, g, cf) => {
  WBc(cf, o.evento).desc = nl(o.texto); save(); ok(i, 'Mensaje actualizado. Pruébalo con `/bienvenida vista`.');
});
def('bienvenida', 'titulo', 'Título del embed (ninguno = sin título)', 'evento:s!,texto:s!', 'Administrator', (i, o, g, cf) => {
  WBc(cf, o.evento).title = NONE.test(o.texto) ? '' : o.texto; save(); ok(i, 'Título actualizado.');
});
def('bienvenida', 'embed', 'Color, imágenes y pie. imagen/miniatura: enlace(s) con |, avatar o servidor', 'evento:s!,color:s,imagen:s,miniatura:s,pie:s,autor:s', 'Administrator', (i, o, g, cf) => {
  const w = { ...WBc(cf, o.evento) };
  if (o.color) { if (hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.'); w.color = hex(o.color); }
  for (const [opt, key] of [['imagen', 'img'], ['miniatura', 'thumb']]) {
    const val = o[opt]; if (!val) continue;
    if (!okSpec(val)) return no(i, `**${opt}**: usa un enlace \`http(s)\`, varios separados por \`|\` (se elige uno al azar), \`avatar\`, \`servidor\` o \`ninguna\`.`);
    w[key] = NONE.test(val.trim()) ? 'ninguna' : val.trim();
  }
  if (o.pie) w.footer = NONE.test(o.pie) ? '' : nl(o.pie);
  if (o.autor) NONE.test(o.autor) ? delete w.author : (w.author = nl(o.autor));
  cf[WK(o.evento)] = w; save(); ok(i, 'Embed actualizado. Pruébalo con `/bienvenida vista`.');
});
def('bienvenida', 'texto', 'Texto sobre el embed (ej. {user} para mencionar). ninguno = vacío', 'evento:s!,texto:s!', 'Administrator', (i, o, g, cf) => {
  WBc(cf, o.evento).content = NONE.test(o.texto) ? '' : nl(o.texto); save(); ok(i, 'Texto superior actualizado.');
});
def('bienvenida', 'activar', 'Activa o desactiva bienvenida/despedida', 'evento:s!,estado:b!', 'Administrator', (i, o, g, cf) => {
  WBc(cf, o.evento).on = o.estado; save(); ok(i, `**${o.evento}** ${o.estado ? '🟢 activada' : '🔴 desactivada'}.`);
});
def('bienvenida', 'dm', 'Mensaje privado al nuevo miembro (ninguno = quitar)', 'mensaje:s!', 'Administrator', (i, o, g, cf) => {
  const w = WBc(cf, 'bienvenida'); NONE.test(o.mensaje) ? delete w.dm : (w.dm = nl(o.mensaje)); save(); ok(i, w.dm ? 'DM de bienvenida guardado.' : 'DM de bienvenida eliminado.');
});
def('bienvenida', 'vista', 'Previsualiza el mensaje con tu usuario', 'evento:s!', 'Administrator', async (i, o, g, cf) => {
  const m = await M(i, i.user); if (!m) return no(i, 'No pude cargar tu perfil de miembro.');
  const { e, v } = wbEmbed(m, o.evento, { inviter: `${i.user}`, count: 5 }), w = WBc(cf, o.evento), ch = wbChannel(i.guild, w, o.evento);
  const txt = fmt(w.content ?? WBD[o.evento].content, v).slice(0, 1800);
  const format=validFormat(cf.messageFormats?.[o.evento]);
  if(format==='embed')return i.reply({ content: `${txt ? txt + '\n' : ''}-# 📍 Se enviaría en: ${ch ?? 'ningún canal (usa /bienvenida autocanal)'}`, embeds: [e], flags: 64 });
  const payload=await buildMessage({format,content:txt,title:fmt(w.title??WBD[o.evento].title,v),description:fmt(w.desc??WBD[o.evento].desc,v),image:wbImg(m,w.img??'servidor','img'),thumbnail:wbImg(m,w.thumb??'avatar','thumb'),footer:fmt(w.footer??WBD[o.evento].footer,v),author:fmt(w.author??WBD[o.evento].author,v),color:w.color??cf.color,allowedMentions:{parse:[]}});
  i.reply({...payload,flags:(payload.flags||0)|64});
});
def('bienvenida', 'ver', 'Ver la configuración actual', '', 'Administrator', (i, o, g, cf) => {
  const e = E(i.guildId, '👋 Bienvenida y despedida');
  for (const t of ['bienvenida', 'despedida']) {
    const w = WBc(cf, t), D = WBD[t], ch = wbChannel(i.guild, w, t), st = w.on === false ? '🔴 off' : ch ? '🟢 on' : '⚪ sin canal';
    e.addFields({ name: `${t === 'bienvenida' ? '👋' : '🚪'} ${t} · ${st}`, value: [
      `Canal: ${ch ?? '—'}${w.ch ? '' : ' (automático)'}`, `Título: ${w.title ?? D.title}`, `Imagen: ${w.img ?? 'banner del servidor (si tiene)'}`, `Miniatura: ${w.thumb ?? 'avatar'}`,
      `Color: ${w.color != null ? '#' + Number(w.color).toString(16).padStart(6, '0') : 'por defecto'}`,
      ...(t === 'bienvenida' ? [`DM: ${w.dm ? 'sí' : 'no'}`] : []),
    ].join('\n').slice(0, 1024) });
  }
  i.reply({ embeds: [e], flags: 64 });
});
def('bienvenida', 'editar', 'Edita el último mensaje de bienvenida o despedida que envió el bot', 'evento:s!,texto:s,titulo:s,descripcion:s,color:s', 'Administrator', async (i, o, g, cf) => {
  const L = cf.lastWB?.[o.evento];
  if (!L) return no(i, 'Todavía no he enviado ese mensaje. Se podrá editar después de la próxima vez que alguien entre o salga.');
  const msg = await i.guild.channels.cache.get(L.ch)?.messages.fetch(L.id).catch(() => null);
  if (!msg) return no(i, 'No encuentro el último mensaje (¿lo borraron?). Usa `/anuncio editar` con su enlace.');
  await editBotMsg(i, msg, o);
});
def('bienvenida', 'variables', 'Lista de variables disponibles', '', null, (i) => say(i, '🧩 Variables',
  '`{user}` mención · `{tag}` usuario#tag · `{name}` nombre visible · `{id}` ID\n`{server}` nombre del servidor · `{members}` miembros totales\n`{created}` antigüedad de la cuenta · `{inviter}` quién invitó · `{count}` invitaciones del invitador\n\n`{count}` solo tiene datos reales al entrar. Imágenes: `avatar`, `servidor`, un enlace, o varios con `|` (uno al azar).', true));
def('bienvenida', 'reset', 'Restaura bienvenida o despedida a los valores por defecto', 'evento:s!', 'Administrator', (i, o, g, cf) => {
  cf[WK(o.evento)] = {}; save(); ok(i, `**${o.evento}** restaurada (canal automático y diseño por defecto).`);
});

/* ===================== 14. LIMPIEZA DE MENSAJES (6) ===================== */
// /limpiar mensajes  → borra N mensajes recientes (con filtros: usuario, bots, enlaces, archivos, texto)
// /limpiar desde     → borra todo lo posterior a un mensaje
// /limpiar canal     → reinicia el canal (lo recrea vacío; borra TODO, también lo de más de 14 días), con confirmación
// /limpiar auto      → limpieza automática cada X horas (mensajes recientes o reinicio completo)
// Discord solo permite borrar en bloque mensajes de menos de 14 días; los fijados se conservan siempre.
const CLEAN_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const cleanIssue = (guild, ch, wipe) => {
  if (!ch) return 'el canal no existe';
  if (!CLEAN_TYPES.includes(ch.type)) return 'solo funciona en canales de texto o de anuncios';
  const p = ch.permissionsFor(guild.members.me), names = { [P.ViewChannel]: 'Ver canal', [P.ReadMessageHistory]: 'Leer historial', [P.ManageMessages]: 'Gestionar mensajes', [P.ManageChannels]: 'Gestionar canales' };
  const miss = [P.ViewChannel, P.ReadMessageHistory, wipe ? P.ManageChannels : P.ManageMessages].filter(x => !p?.has(x));
  return miss.length ? `al bot le falta en ${ch}: **${miss.map(x => names[x]).join(', ')}**` : null;
};
const cleanTest = o => m => {
  if (o.usuario && m.author.id !== o.usuario.id) return false;
  if (o.filtro === 'bots' && !m.author.bot) return false;
  if (o.filtro === 'humanos' && m.author.bot) return false;
  if (o.filtro === 'enlaces' && !/https?:\/\/\S+/i.test(m.content)) return false;
  if (o.filtro === 'archivos' && !m.attachments.size) return false;
  if (o.filtro === 'embeds' && !m.embeds.length) return false;
  if (o.contiene && !m.content.toLowerCase().includes(o.contiene.toLowerCase())) return false;
  return true;
};
async function cleanMessages(ch, { limit = 100, test = () => true, after = null, keepPinned = true } = {}) {
  const lim14 = Date.now() - 14 * 864e5 + 120000; let deleted = 0, old = 0, scanned = 0, before;
  while (deleted < limit && scanned < 5000) {
    const batch = await ch.messages.fetch({ limit: 100, ...(before ? { before } : {}) }); if (!batch.size) break;
    scanned += batch.size; before = batch.last().id;
    let list = [...batch.values()]; if (after) list = list.filter(m => BigInt(m.id) > BigInt(after));
    const match = list.filter(m => (!keepPinned || !m.pinned) && test(m));
    old += match.filter(m => m.createdTimestamp < lim14).length;
    const sel = match.filter(m => m.createdTimestamp >= lim14).slice(0, limit - deleted);
    if (sel.length === 1) { if (await sel[0].delete().then(() => true).catch(() => false)) deleted++; }
    else if (sel.length) deleted += (await ch.bulkDelete(sel, true).catch(() => null))?.size ?? 0;
    if (batch.size < 100 || batch.last().createdTimestamp < lim14 || (after && BigInt(batch.last().id) <= BigInt(after))) break;
    await new Promise(r => setTimeout(r, 600));
  }
  return { deleted, old };
}
// cambia el ID de un canal en toda la configuración (para que bienvenida, logs, etc. sigan apuntando al canal nuevo)
function swapId(gid, a, b) {
  const walk = o => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (k === a) { o[b] = o[k]; delete o[k]; walk(o[b]); } else if (o[k] === a) o[k] = b; else walk(o[k]); } };
  walk(G(gid).cfg); save();
}
async function nukeChannel(ch, by) {
  const nc = await ch.clone({ reason: `Reinicio de canal por ${by.tag ?? by.username}` });
  await nc.setPosition(ch.position).catch(() => {});
  swapId(ch.guild.id, ch.id, nc.id);
  await ch.delete(`Reinicio de canal por ${by.tag ?? by.username}`);
  nc.send({ embeds: [E(ch.guild.id, '🧹 Canal reiniciado', `Reiniciado por ${by}.`)] }).then(x => setTimeout(() => x.delete().catch(() => {}), 10000)).catch(() => {});
  return nc;
}
const cleanLog = (i, title, ch, extra) => lg(i.guildId, 'mod', E(i.guildId, title, `**Moderador:** ${i.user}\n**Canal:** ${ch}\n${extra}`));
def('limpiar', 'mensajes', 'Borra mensajes recientes del canal (hasta 1000)', 'cantidad:i!,usuario:u,filtro:s,contiene:s,canal:c', 'ManageMessages', async (i, o) => {
  const ch = o.canal ?? i.channel, bad = cleanIssue(i.guild, ch); if (bad) return no(i, `No puedo limpiar: ${bad}.`);
  if (o.cantidad < 1) return no(i, 'La cantidad debe ser al menos 1.');
  await i.deferReply({ flags: 64 });
  const r = await cleanMessages(ch, { limit: Math.min(o.cantidad, 1000), test: cleanTest(o) });
  cleanLog(i, '🧹 Limpieza de mensajes', ch, `**Borrados:** ${r.deleted}${o.usuario ? `\n**Usuario:** ${o.usuario}` : ''}${o.filtro && o.filtro !== 'todos' ? `\n**Filtro:** ${o.filtro}` : ''}${o.contiene ? `\n**Contiene:** ${o.contiene}` : ''}`);
  i.editReply({ embeds: [E(i.guildId, '🧹 Listo', `**${r.deleted}** mensajes borrados en ${ch}.${r.old ? `\n⚠️ Hay **${r.old}+** mensajes con más de 14 días que Discord no permite borrar en bloque. Usa \`/limpiar canal\` para reiniciar el canal.` : ''}${!r.deleted && !r.old ? '\nNo encontré mensajes que coincidan.' : ''}`)] });
});
def('limpiar', 'desde', 'Borra todo lo posterior a un mensaje (ID o enlace del mensaje)', 'mensaje:s!,canal:c', 'ManageMessages', async (i, o) => {
  const ids = o.mensaje.match(/\d{17,20}/g); if (!ids) return no(i, 'Pega el **ID** o el **enlace** del mensaje.');
  let ch = o.canal ?? i.channel; if (ids.length >= 3) ch = i.guild.channels.cache.get(ids[ids.length - 2]) ?? ch;
  const bad = cleanIssue(i.guild, ch); if (bad) return no(i, `No puedo limpiar: ${bad}.`);
  await i.deferReply({ flags: 64 });
  const r = await cleanMessages(ch, { limit: 5000, after: (BigInt(ids[ids.length - 1]) - 1n).toString() });
  cleanLog(i, '🧹 Limpieza desde un mensaje', ch, `**Borrados:** ${r.deleted}`);
  i.editReply({ embeds: [E(i.guildId, '🧹 Listo', `**${r.deleted}** mensajes borrados en ${ch}, desde el mensaje indicado hasta ahora.${r.old ? `\n⚠️ **${r.old}+** eran de más de 14 días y no se pueden borrar en bloque.` : ''}`)] });
});
def('limpiar', 'canal', 'Reinicia el canal: lo recrea vacío (borra TODO, pide confirmación)', 'canal:c', 'ManageChannels', (i, o, g) => {
  const ch = o.canal ?? i.channel, bad = cleanIssue(i.guild, ch, true); if (bad) return no(i, `No puedo reiniciar: ${bad}.`);
  if (g.tickets[ch.id]) return no(i, 'Eso es un ticket. Ciérralo con `/ticket close`.');
  i.reply({ flags: 64, embeds: [E(i.guildId, '⚠️ ¿Reiniciar el canal?', `Se borrará **todo** el contenido de ${ch} (mensajes, fijados y adjuntos). El canal se recreará igual, con los mismos permisos y configuración.\n\nEsta acción **no se puede deshacer**.`)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cl_ok_${ch.id}_${i.user.id}`).setLabel('Sí, reiniciar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`cl_no_${ch.id}_${i.user.id}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary))] });
});
async function cleanButton(i) {
  const [, act, chId, uid] = i.customId.split('_');
  if (i.user.id !== uid) return no(i, 'Este botón no es tuyo.');
  if (act === 'no') return i.update({ embeds: [E(i.guildId, '❎ Cancelado', 'No se borró nada.')], components: [] });
  if (!i.member.permissions.has(P.ManageChannels)) return no(i, 'Necesitas el permiso **ManageChannels**.');
  const ch = i.guild.channels.cache.get(chId), bad = cleanIssue(i.guild, ch, true);
  if (bad) return i.update({ embeds: [E(i.guildId, '❌ Error', `No puedo reiniciar: ${bad}.`)], components: [] });
  await i.update({ embeds: [E(i.guildId, '⏳ Reiniciando canal...', 'Un momento.')], components: [] });
  try {
    const nc = await nukeChannel(ch, i.user);
    lg(i.guildId, 'mod', E(i.guildId, '🧹 Canal reiniciado', `**Moderador:** ${i.user}\n**Canal:** #${ch.name} → ${nc}`));
    await i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Canal reiniciado: ${nc}`)] }).catch(() => {});
  } catch (err) { await i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude reiniciar el canal: ${err.message}`)] }).catch(() => {}); }
}
def('limpiar', 'auto', 'Limpieza automática de un canal cada X horas', 'canal:c!,horas:i!,modo:s', 'ManageGuild', (i, o, g, cf) => {
  const mode = o.modo === 'canal' ? 'canal' : 'mensajes', bad = cleanIssue(i.guild, o.canal, mode === 'canal'); if (bad) return no(i, `No puedo limpiar: ${bad}.`);
  if (o.horas < 1 || o.horas > 720) return no(i, '`horas` debe estar entre 1 y 720.');
  if (g.tickets[o.canal.id]) return no(i, 'Eso es un ticket.');
  (cf.clean ??= {})[o.canal.id] = { hours: o.horas, mode, last: Date.now() }; save();
  ok(i, `${o.canal} se limpiará cada **${o.horas} h** (${mode === 'canal' ? 'reinicio completo del canal' : 'borrando mensajes recientes; los fijados se conservan'}).\nPróxima limpieza ${when(o.horas * 36e5)}.`);
});
def('limpiar', 'autoquitar', 'Quita la limpieza automática de un canal', 'canal:c!', 'ManageGuild', (i, o, g, cf) => {
  if (!cf.clean?.[o.canal.id]) return no(i, 'Ese canal no tiene limpieza automática.');
  delete cf.clean[o.canal.id]; save(); ok(i, `Limpieza automática de ${o.canal} desactivada.`);
});
def('limpiar', 'autolista', 'Lista las limpiezas automáticas', '', 'ManageGuild', (i, o, g, cf) => {
  const L = Object.entries(cf.clean || {}).map(([id, c]) => `<#${id}> — cada **${c.hours} h** · ${c.mode === 'canal' ? 'reinicio completo' : 'mensajes recientes'} · próxima ${when(Math.max(0, c.last + c.hours * 36e5 - Date.now()))}`);
  say(i, '🧹 Limpiezas automáticas', L.join('\n') || 'Ninguna. Usa `/limpiar auto`.', true);
});
let cleanBusy = false;
async function cleanTick() {
  if (cleanBusy) return; cleanBusy = true;
  try {
    for (const [gid, g] of Object.entries(DB)) {
      const guild = client.guilds.cache.get(gid), cl = g.cfg?.clean; if (!guild || !cl) continue;
      for (const [cid, c] of Object.entries(cl)) {
        if (Date.now() - c.last < c.hours * 36e5) continue;
        const ch = guild.channels.cache.get(cid); if (!ch) { delete cl[cid]; save(); continue; }
        c.last = Date.now(); save();
        const bad = cleanIssue(guild, ch, c.mode === 'canal');
        if (bad) { lg(gid, 'mod', E(gid, '⚠️ Limpieza automática fallida', bad)); continue; }
        try {
          if (c.mode === 'canal') { await nukeChannel(ch, client.user); lg(gid, 'mod', E(gid, '🧹 Limpieza automática', `Canal #${ch.name} reiniciado.`)); }
          else {
            const r = await cleanMessages(ch, { limit: 5000 }); lg(gid, 'mod', E(gid, '🧹 Limpieza automática', `${ch}: **${r.deleted}** mensajes borrados.`));
            if (r.deleted) ch.send({ embeds: [E(gid, '🧹 Limpieza automática', `**${r.deleted}** mensajes borrados.`)] }).then(x => setTimeout(() => x.delete().catch(() => {}), 8000)).catch(() => {});
          }
        } catch (err) { lg(gid, 'mod', E(gid, '⚠️ Limpieza automática fallida', `${ch}: ${err.message}`)); }
      }
    }
  } finally { cleanBusy = false; }
}

/* ============ 15. ESTADO DEL SERVIDOR · MIEMBROS EN VOZ (7) ============ */
// Un canal de voz bloqueado que se renombra solo ("🔊 En VC: 7"), un panel en vivo y /estado ver.
// Discord limita el renombrado de canales a 2 veces cada 10 min, así que el nombre se refresca como máximo cada ~5 min;
// el panel (mensaje) se edita en cuanto cambia algo (revisión cada 20 s).
// Variables del formato: {n} en voz · {humanos} · {bots} · {canales} canales con gente · {total} miembros del servidor
const VC_FMT = '🔊 En VC: {n}';
const vcStats = (guild, withBots) => {
  const per = new Map(); let humans = 0, bots = 0;
  for (const vs of guild.voiceStates.cache.values()) {
    if (!vs.channelId) continue;
    const isBot = vs.member?.user.bot ?? false; isBot ? bots++ : humans++;
    if (isBot && !withBots) continue;
    per.set(vs.channelId, (per.get(vs.channelId) || 0) + 1);
  }
  return { n: withBots ? humans + bots : humans, humans, bots, per };
};
const vcVars = (guild, st) => ({ n: st.n, humanos: st.humans, bots: st.bots, canales: st.per.size, total: guild.memberCount });
function vcEmbed(guild, s) {
  const st = vcStats(guild, !!s.bots);
  const rows = [...st.per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, c]) => `<#${id}> — **${c}**`);
  const e = E(guild.id, '📊 Estado del servidor').addFields(
    { name: '🔊 En voz ahora', value: `**${st.n}**`, inline: true }, { name: '🤖 Bots en voz', value: `${st.bots}`, inline: true },
    { name: '📡 Canales con gente', value: `${st.per.size}`, inline: true }, { name: '👥 Miembros', value: `${guild.memberCount}`, inline: true },
    { name: 'Quién está dónde', value: (rows.join('\n') || 'Nadie en canales de voz.').slice(0, 1024) }).setFooter({ text: 'Se actualiza automáticamente' });
  if (guild.iconURL()) e.setThumbnail(guild.iconURL());
  return e;
}
const vcSig = new Map();
async function vcUpdate(guild, force = false) {
  const s = C(guild.id).vcs; if (!s) return;
  const st = vcStats(guild, !!s.bots), now = Date.now();
  if (s.ch) {
    const ch = guild.channels.cache.get(s.ch);
    if (!ch) { s.ch = null; save(); }
    else {
      const name = fmt(s.fmt || VC_FMT, vcVars(guild, st)).slice(0, 100) || '🔊 En VC';
      if (name !== ch.name && (force || now - (s.lastRename || 0) > 310000)) {
        s.lastRename = now; save(); // se marca antes de pedir el cambio: si falla, no se insiste cada 20 s
        await ch.setName(name, 'Estado del servidor: miembros en voz').catch(err => console.warn(`[estado] no pude renombrar ${ch.id}: ${err.message}`));
      }
    }
  }
  if (s.panelCh && s.panelMsg) {
    const sig = `${st.n}|${st.bots}|${[...st.per].join(',')}|${guild.memberCount}`;
    if (force || vcSig.get(guild.id) !== sig) {
      vcSig.set(guild.id, sig);
      const pc = guild.channels.cache.get(s.panelCh), msg = pc ? await pc.messages.fetch(s.panelMsg).catch(() => null) : null;
      if (!msg) { s.panelCh = null; s.panelMsg = null; save(); }
      else await msg.edit({ embeds: [vcEmbed(guild, s)] }).catch(err => console.warn(`[estado] no pude editar el panel: ${err.message}`));
    }
  }
}
let vcBusy = false;
async function vcTick() {
  if (vcBusy) return; vcBusy = true;
  try { for (const guild of client.guilds.cache.values()) if (DB[guild.id]?.cfg?.vcs) await vcUpdate(guild).catch(err => console.warn('[estado]', err.message)); }
  finally { vcBusy = false; }
}
def('estado', 'setup', 'Crea el canal de voz contador de miembros en VC (se actualiza solo)', 'categoria:c,formato:s', 'ManageGuild', async (i, o, g, cf) => {
  const me = i.guild.members.me, s = (cf.vcs ??= {});
  if (s.ch && i.guild.channels.cache.has(s.ch)) return no(i, `Ya hay un contador: <#${s.ch}>. Quítalo antes con \`/estado quitar\`.`);
  if (!me.permissions.has(P.ManageChannels)) return no(i, 'Necesito el permiso **Gestionar canales**.');
  if (o.formato) s.fmt = nl(o.formato).slice(0, 100);
  await i.deferReply({ flags: 64 });
  try {
    const name = fmt(s.fmt || VC_FMT, vcVars(i.guild, vcStats(i.guild, !!s.bots))).slice(0, 100);
    const ch = await i.guild.channels.create({ name, type: ChannelType.GuildVoice, parent: o.categoria?.id ?? null, reason: 'Contador de miembros en voz',
      permissionOverwrites: [{ id: i.guild.id, allow: [P.ViewChannel], deny: [P.Connect] }, { id: me.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels] }] });
    if (!o.categoria) await ch.setPosition(0).catch(() => {});
    s.ch = ch.id; s.lastRename = Date.now(); save();
    i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Contador creado: ${ch}\nNadie puede entrar a ese canal; solo muestra cuánta gente hay en VC.\nSe actualiza solo (cada ~5 min por el límite de Discord). Para un panel en vivo usa \`/estado panel\`.`)] });
  } catch (err) { i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude crear el canal: ${err.message}`)] }); }
});
def('estado', 'canal', 'Usa un canal de voz que ya existe como contador', 'canal:c!', 'ManageGuild', async (i, o, g, cf) => {
  if (!o.canal.permissionsFor(i.guild.members.me)?.has(P.ManageChannels)) return no(i, `Al bot le falta **Gestionar canales** en ${o.canal}.`);
  const s = (cf.vcs ??= {}); s.ch = o.canal.id; s.lastRename = 0; save();
  await i.deferReply({ flags: 64 }); await vcUpdate(i.guild, true);
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `${o.canal} ahora muestra los miembros en VC.`)] });
});
def('estado', 'formato', 'Nombre del contador. Variables: {n} {humanos} {bots} {canales} {total}', 'formato:s!', 'ManageGuild', async (i, o, g, cf) => {
  const s = (cf.vcs ??= {}); s.fmt = nl(o.formato).slice(0, 100); save();
  const prev = fmt(s.fmt, vcVars(i.guild, vcStats(i.guild, !!s.bots)));
  await i.deferReply({ flags: 64 }); await vcUpdate(i.guild, true);
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Formato guardado. Se verá así: **${prev}**${s.ch ? '' : '\nAún no hay canal contador: usa `/estado setup`.'}`)] });
});
def('estado', 'contar', 'Incluir o no a los bots en el conteo de VC', 'bots:b!', 'ManageGuild', async (i, o, g, cf) => {
  const s = (cf.vcs ??= {}); s.bots = o.bots; save(); await i.deferReply({ flags: 64 }); await vcUpdate(i.guild, true);
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Los bots **${o.bots ? 'sí' : 'no'}** cuentan en el total de VC.`)] });
});
def('estado', 'panel', 'Publica un panel de estado que se actualiza solo', 'texto:c', 'ManageGuild', async (i, o, g, cf) => {
  const ch = o.texto ?? i.channel, ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar ahí: ${ci}.`);
  const s = (cf.vcs ??= {}); await i.deferReply({ flags: 64 });
  if (s.panelCh && s.panelMsg) await i.guild.channels.cache.get(s.panelCh)?.messages.delete(s.panelMsg).catch(() => {}); // solo un panel por servidor
  try { const m = await ch.send({ embeds: [vcEmbed(i.guild, s)] }); s.panelCh = ch.id; s.panelMsg = m.id; save(); }
  catch (err) { return i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude enviar el panel: ${err.message}`)] }); }
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Panel publicado en ${ch}. Se edita solo cuando alguien entra o sale de un VC.`)] });
});
def('estado', 'ver', 'Cuánta gente hay en canales de voz ahora mismo', '', null, (i, o, g, cf) => i.reply({ embeds: [vcEmbed(i.guild, cf.vcs || {})] }));
def('estado', 'quitar', 'Desactiva el estado de voz (borrar:true elimina también el canal y el panel)', 'borrar:b', 'ManageGuild', async (i, o, g, cf) => {
  const s = cf.vcs; if (!s) return no(i, 'No hay estado de voz configurado.');
  if (o.borrar) {
    if (s.ch) await i.guild.channels.cache.get(s.ch)?.delete('Estado de voz desactivado').catch(() => {});
    if (s.panelCh && s.panelMsg) await i.guild.channels.cache.get(s.panelCh)?.messages.delete(s.panelMsg).catch(() => {});
  }
  delete cf.vcs; vcSig.delete(i.guildId); save(); ok(i, `Estado de voz desactivado${o.borrar ? ' y canal/panel eliminados' : ' (el canal y el panel se quedan como están)'}.`);
});

/* ========================= 15. SERVERSTATS (7) ========================= */
// Canales de voz bloqueados cuyo nombre se actualiza solo: "👥 Miembros: 1234".
// Discord limita el renombrado de canales (2 cambios / 10 min por canal), por eso el intervalo mínimo es 5 min.
// Formato personalizable con variables: {count} {goal} {pct} {left} {server}
const STATS = { // clave: [nombre, formato por defecto, función que da el número]
  miembros: ['Miembros', '👥 Miembros: {count}', g => g.memberCount],
  humanos: ['Personas (sin bots)', '🙋 Personas: {count}', g => g.members.cache.filter(m => !m.user.bot).size],
  bots: ['Bots', '🤖 Bots: {count}', g => g.members.cache.filter(m => m.user.bot).size],
  envoz: ['Conectados en voz', '🔊 En voz: {count}', g => g.voiceStates.cache.filter(v => v.channelId).size],
  canales: ['Canales (total)', '📁 Canales: {count}', g => g.channels.cache.filter(c => c.type !== ChannelType.GuildCategory && !c.isThread?.()).size],
  texto: ['Canales de texto', '💬 Texto: {count}', g => g.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size],
  voz: ['Canales de voz', '🎙️ Voz: {count}', g => g.channels.cache.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size],
  categorias: ['Categorías', '🗂️ Categorías: {count}', g => g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size],
  roles: ['Roles', '🎭 Roles: {count}', g => Math.max(0, g.roles.cache.size - 1)],
  emojis: ['Emojis', '😀 Emojis: {count}', g => g.emojis.cache.size],
  stickers: ['Stickers', '🏷️ Stickers: {count}', g => g.stickers.cache.size],
  boosts: ['Boosts', '🚀 Boosts: {count}', g => g.premiumSubscriptionCount || 0],
  nivel: ['Nivel de boost', '💎 Nivel: {count}', g => Number(g.premiumTier) || 0],
  tickets: ['Tickets abiertos', '🎫 Tickets: {count}', g => Object.keys(G(g.id).tickets).length],
  meta: ['Meta (objetivo)', '🎯 Meta: {count}/{goal}', null],
};
CHO['stats.tipo'] = [...Object.entries(STATS).map(([k, v]) => [v[0], k]), ['Todos (paquete básico)', 'todos']];
const STATS_PACK = ['miembros', 'bots', 'canales', 'roles', 'emojis', 'boosts'];
const SC = cf => (cf.stats ??= { items: {}, every: 10, abbr: false });
const statNum = (g, key) => STATS[key][2](g);
const shortNum = (n, ab) => {
  if (!ab) return String(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
};
const okFmt = f => /\{(count|goal|pct|left)\}/.test(f);
function statName(guild, key, it, cf) {
  const st = SC(cf); let v;
  if (key === 'meta') {
    const gl = st.goal, c = gl ? statNum(guild, gl.of) : 0, t = gl?.target || 0;
    v = { count: shortNum(c, st.abbr), goal: shortNum(t, st.abbr), pct: t ? Math.min(100, Math.round(c / t * 100)) : 0, left: shortNum(Math.max(0, t - c), st.abbr) };
  } else v = { count: shortNum(statNum(guild, key), st.abbr) };
  return fmt(it.fmt ?? STATS[key][1], { ...v, server: guild.name }).slice(0, 100);
}
async function updateStats(guild) {
  const cf = C(guild.id), st = SC(cf), out = { renamed: 0, fail: [] }, me = guild.members.me;
  const needM = Object.keys(st.items).some(k => k === 'humanos' || k === 'bots' || (k === 'meta' && ['humanos', 'bots'].includes(st.goal?.of)));
  if (needM && guild.members.cache.size < guild.memberCount) await guild.members.fetch().catch(() => {});
  for (const [key, it] of Object.entries(st.items)) {
    const ch = guild.channels.cache.get(it.ch);
    if (!ch) { delete st.items[key]; save(); continue; } // el canal se borró a mano
    const name = statName(guild, key, it, cf); if (ch.name === name) continue;
    if (!ch.permissionsFor(me)?.has(P.ManageChannels)) { out.fail.push(`${ch}: falta **Gestionar canales**`); continue; }
    try { await Promise.race([ch.setName(name, 'ServerStats'), new Promise(r => setTimeout(r, 20000))]); out.renamed++; }
    catch (err) { out.fail.push(`${ch}: ${err.message}`); }
  }
  st.last = Date.now();
  if (out.fail.length && !st.warned) { st.warned = true; lg(guild.id, 'general', E(guild.id, '⚠️ ServerStats con problemas', out.fail.join('\n'))); }
  if (!out.fail.length) st.warned = false;
  save(); return out;
}
async function mkStatChannel(guild, st) {
  const me = guild.members.me, ow = [{ id: guild.id, allow: [P.ViewChannel], deny: [P.Connect] }, { id: me.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels] }];
  let cat = st.cat && guild.channels.cache.get(st.cat);
  if (cat?.type !== ChannelType.GuildCategory) {
    cat = await guild.channels.create({ name: '📊 ESTADÍSTICAS', type: ChannelType.GuildCategory, position: 0, permissionOverwrites: ow, reason: 'ServerStats' });
    st.cat = cat.id;
  }
  return guild.channels.create({ name: '📊 cargando...', type: ChannelType.GuildVoice, parent: cat.id, permissionOverwrites: ow, reason: 'ServerStats' });
}
const statsErr = (i, d) => i.editReply({ embeds: [E(i.guildId, '❌ Error', d)] });
def('stats', 'crear', 'Crea un canal de estadística (o el paquete básico con "todos")', 'tipo:s!,canal:c,formato:s', 'ManageChannels', async (i, o, g, cf) => {
  const st = SC(cf);
  if (!i.guild.members.me.permissions.has(P.ManageChannels)) return no(i, 'Necesito el permiso **Gestionar canales**.');
  if (o.formato && !okFmt(o.formato)) return no(i, 'El formato debe incluir `{count}` (en la meta también `{goal}`, `{pct}` o `{left}`).');
  if (o.tipo === 'meta' && !st.goal) return no(i, 'Primero define la meta con `/stats meta`.');
  if (o.canal && (!o.canal.permissionsFor(i.guild.members.me)?.has(P.ManageChannels) || Object.values(st.items).some(x => x.ch === o.canal.id))) return no(i, `No puedo usar ${o.canal}: el bot necesita **Gestionar canales** en él y no puede estar ya en uso.`);
  const types = o.tipo === 'todos' ? STATS_PACK.filter(k => !st.items[k]) : [o.tipo];
  if (types.length === 1 && st.items[types[0]] && i.guild.channels.cache.has(st.items[types[0]].ch)) return no(i, `Ya existe: <#${st.items[types[0]].ch}>. Usa \`/stats formato\` para cambiarlo o \`/stats quitar\`.`);
  if (!types.length) return no(i, 'El paquete básico ya está instalado.');
  await i.deferReply({ flags: 64 }); const made = [];
  for (const k of types) {
    if (st.items[k] && i.guild.channels.cache.has(st.items[k].ch)) continue;
    try {
      const ch = o.canal && types.length === 1 ? o.canal : await mkStatChannel(i.guild, st);
      st.items[k] = { ch: ch.id, ...(o.formato && types.length === 1 ? { fmt: o.formato } : {}) }; made.push(`${ch}`);
    } catch (err) { save(); return statsErr(i, `No pude crear el canal: ${err.message}`); }
  }
  save(); const r = await updateStats(i.guild);
  i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Creado: ${made.join(' ')}\nSe actualizan solos cada **${st.every} min**. Personaliza el texto con \`/stats formato\`.${r.fail.length ? `\n\n⚠️ ${r.fail.join('\n')}` : ''}`)] });
});
def('stats', 'formato', 'Personaliza el texto. Variables: {count} {goal} {pct} {left} {server}. "restaurar" = por defecto', 'tipo:s!,formato:s!', 'ManageChannels', async (i, o, g, cf) => {
  const st = SC(cf), it = st.items[o.tipo];
  if (o.tipo === 'todos') return no(i, 'Elige una estadística concreta.');
  if (!it) return no(i, 'Esa estadística no está creada. Usa `/stats crear`.');
  if (/^restaurar$/i.test(o.formato.trim())) delete it.fmt;
  else { if (!okFmt(o.formato)) return no(i, 'El formato debe incluir `{count}` (en la meta también `{goal}`, `{pct}` o `{left}`).'); it.fmt = o.formato; }
  save(); await i.deferReply({ flags: 64 }); const r = await updateStats(i.guild);
  i.editReply({ embeds: [E(i.guildId, '✅ Formato actualizado', `Quedará así: **${statName(i.guild, o.tipo, it, cf)}**${r.fail.length ? `\n\n⚠️ ${r.fail.join('\n')}` : ''}`)] });
});
def('stats', 'meta', 'Define la meta del canal de meta (qué contar y el objetivo)', 'objetivo:i!,tipo:s', 'ManageGuild', async (i, o, g, cf) => {
  const st = SC(cf), of = o.tipo || 'miembros';
  if (!STATS[of] || of === 'meta' || of === 'todos') return no(i, 'Elige una estadística concreta para medir (por ejemplo Miembros o Boosts).');
  if (o.objetivo < 1) return no(i, 'El objetivo debe ser mayor que 0.');
  st.goal = { target: o.objetivo, of }; save(); await i.deferReply({ flags: 64 });
  if (st.items.meta) await updateStats(i.guild);
  i.editReply({ embeds: [E(i.guildId, '🎯 Meta guardada', `Objetivo: **${o.objetivo}** (${STATS[of][0]}). Actual: **${statNum(i.guild, of)}**.${st.items.meta ? '' : '\nCrea el canal con `/stats crear tipo:Meta`.'}`)] });
});
def('stats', 'quitar', 'Quita una estadística (o todas). borrar:true también elimina el canal', 'tipo:s!,borrar:b', 'ManageChannels', async (i, o, g, cf) => {
  const st = SC(cf), ks = o.tipo === 'todos' ? Object.keys(st.items) : [o.tipo];
  if (!ks.some(k => st.items[k])) return no(i, 'No hay nada que quitar.');
  await i.deferReply({ flags: 64 }); let n = 0;
  for (const k of ks) {
    const it = st.items[k]; if (!it) continue;
    if (o.borrar) await i.guild.channels.cache.get(it.ch)?.delete('ServerStats: quitar').catch(() => {});
    delete st.items[k]; n++;
  }
  const cat = st.cat && i.guild.channels.cache.get(st.cat);
  if (o.borrar && cat && !Object.keys(st.items).length && !i.guild.channels.cache.some(c => c.parentId === cat.id)) { await cat.delete('ServerStats: sin canales').catch(() => {}); st.cat = null; }
  save(); i.editReply({ embeds: [E(i.guildId, '✅ Listo', `**${n}** estadística(s) quitada(s)${o.borrar ? ' y canal(es) eliminado(s)' : ' (los canales se conservan; bórralos a mano o usa `borrar:true`)'}.`)] });
});
def('stats', 'lista', 'Ver las estadísticas configuradas', '', 'ManageChannels', (i, o, g, cf) => {
  const st = SC(cf), L = Object.entries(st.items).map(([k, it]) => `<#${it.ch}> · **${STATS[k][0]}** → ${statName(i.guild, k, it, cf)}${it.fmt ? ' ✏️' : ''}`);
  const gl = st.goal ? `\n\n🎯 Meta: **${st.goal.target}** de ${STATS[st.goal.of][0]}` : '';
  say(i, '📊 ServerStats', (L.join('\n') || 'Ninguna. Usa `/stats crear`.') + gl + `\n\n⏱️ Actualiza cada **${st.every} min** · Abreviar números: **${st.abbr ? 'sí' : 'no'}**`, true);
});
def('stats', 'actualizar', 'Actualiza ahora todos los canales de estadísticas', '', 'ManageChannels', async (i) => {
  await i.deferReply({ flags: 64 }); const r = await updateStats(i.guild);
  i.editReply({ embeds: [E(i.guildId, '🔄 Actualizado', `**${r.renamed}** canal(es) renombrado(s).${r.fail.length ? `\n\n⚠️ ${r.fail.join('\n')}` : ''}\n-# Discord permite renombrar cada canal 2 veces cada 10 min.`)] });
});
def('stats', 'ajustes', 'Intervalo (5-120 min), abreviar números (1.2k) y categoría donde crear', 'intervalo:i,abreviar:b,categoria:c', 'ManageGuild', (i, o, g, cf) => {
  const st = SC(cf);
  if (o.intervalo != null) { if (o.intervalo < 5 || o.intervalo > 120) return no(i, '`intervalo` debe estar entre 5 y 120 minutos.'); st.every = o.intervalo; }
  if (o.abreviar != null) st.abbr = o.abreviar;
  if (o.categoria) st.cat = o.categoria.id;
  save(); updateStats(i.guild).catch(console.error);
  ok(i, `⏱️ Intervalo: **${st.every} min**\n🔢 Abreviar números: **${st.abbr ? 'sí' : 'no'}**\n🗂️ Categoría para nuevos canales: ${st.cat ? `<#${st.cat}>` : 'se crea automáticamente'}`);
});
let statsBusy = false;
async function statsTick() {
  if (statsBusy) return; statsBusy = true;
  try {
    for (const [gid, g] of Object.entries(DB)) {
      const guild = client.guilds.cache.get(gid), st = g.cfg?.stats;
      if (!guild || !st?.items || !Object.keys(st.items).length || Date.now() - (st.last || 0) < (st.every || 10) * 60000) continue;
      await updateStats(guild).catch(console.error);
    }
  } finally { statsBusy = false; }
}

/* ===================== 16. CREA TU VC · ESTILO TEMPVOICE (6) ===================== */
// Un canal de voz "disparador": al entrar ahí, el bot crea un canal de voz privado para esa persona
// (dentro de la categoría indicada) y la mueve adentro. En vez de un panel por canal, se publica UNA
// interfaz fija (embed personalizable: título, descripción, imagen y color) en el canal de texto que
// elijas; sus botones siempre actúan sobre el canal de voz temporal al que esté conectado quien los pulse.
// Incluye privacidad (público/privado/oculto), sala de espera con aprobación, chat del canal, confiar/
// bloquear usuarios, invitar, región de voz, reclamar, transferir dueño y eliminar.
const VCC = cf => (cf.vcc ??= {});
const VCR = g => (g.vcrooms ??= {});
const VCC_REGIONS = [['🌍 Automático', 'auto'], ['🇧🇷 Brasil', 'brazil'], ['🇭🇰 Hong Kong', 'hongkong'], ['🇮🇳 India', 'india'],
  ['🇯🇵 Japón', 'japan'], ['🇳🇱 Países Bajos', 'rotterdam'], ['🇷🇺 Rusia', 'russia'], ['🇸🇬 Singapur', 'singapore'],
  ['🇿🇦 Sudáfrica', 'southafrica'], ['🇦🇺 Sídney', 'sydney'], ['🇺🇸 EE.UU. Centro', 'us-central'],
  ['🇺🇸 EE.UU. Este', 'us-east'], ['🇺🇸 EE.UU. Sur', 'us-south'], ['🇺🇸 EE.UU. Oeste', 'us-west']];
// [nombre interno, emoji, etiqueta]. Mismo diseño que el panel de referencia (botones con texto).
const VCC_BTNS = [['name', '✏️', 'Nombre'], ['limit', '👥', 'Límite'], ['privacy', '🔒', 'Acceso'], ['hide', '👁️', 'Ocultar'], ['invite', '✉️', 'Invitar'],
  ['block', '🚫', 'Bloquear'], ['kick', '↗️', 'Retirar'], ['transfer', '🔄', 'Ceder'], ['claim', '👑', 'Reclamar'], ['banner', '🖼️', 'Banner']];
const VCC_LAYOUT = [3, 3, 2, 2];
const VCC_FONT = '"Poppins","Inter","Segoe UI","DejaVu Sans","Noto Sans","Liberation Sans",Arial,sans-serif';
// Banner del panel (imagen dibujada): fondo editable, textos editables y la imagen del servidor en el cuadro de la derecha.
// Se edita con /voz banner (titulo, lema, subtitulo, fondo).
async function vccBanner(guild, cf, room) {
  if (!CV) return null;
  try {
    const c = VCC(cf), b = { ...(c.bn || {}), ...(room?.bn || {}) }, W = 1000, H = 300, F = VCC_FONT;
    const cv = CV.createCanvas(W, H), ctx = cv.getContext('2d');
    ctx.save(); roundRect(ctx, 0, 0, W, H, 28); ctx.clip();
    const fondo = b.fondo ? await nivelFondo(b.fondo) : null;
    if (fondo) { const k = Math.max(W / fondo.width, H / fondo.height), w = fondo.width * k, h = fondo.height * k; ctx.drawImage(fondo, (W - w) / 2, (H - h) / 2, w, h); ctx.fillStyle = 'rgba(6,6,10,0.55)'; ctx.fillRect(0, 0, W, H); }
    else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#08090d'); g.addColorStop(1, '#12141c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    roundRect(ctx, 1, 1, W - 2, H - 2, 28); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `400 17px ${F}`;
    ctx.fillText(String(b.lema || 'TU COMUNIDAD, TU MUNDO').toUpperCase().slice(0, 40), 60, 80);
    ctx.fillStyle = '#f5f6fa'; let fs = 56; const titulo = String(b.titulo || `${c.brand || 'Kuboq'} VOICE`).toUpperCase().slice(0, 28);
    ctx.font = `300 ${fs}px ${F}`; while (ctx.measureText(titulo).width > 560 && fs > 26) { fs -= 2; ctx.font = `300 ${fs}px ${F}`; }
    ctx.fillText(titulo, 60, 160);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `300 22px ${F}`; ctx.fillText(String(b.subtitulo || 'Tu voz. Tu espacio.').slice(0, 40), 60, 215);
    const bx = 690, by = 40, bs = 220;
    roundRect(ctx, bx, by, bs, bs, 40); ctx.fillStyle = 'rgba(18,20,28,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2; ctx.stroke();
    let ic = null; const iu = guild.iconURL({ extension: 'png', size: 512 });
    if (iu) { try { const r = await fetch(iu, { signal: AbortSignal.timeout(8000) }); if (r.ok) ic = await CV.loadImage(Buffer.from(await r.arrayBuffer())); } catch {} }
    if (ic) { ctx.save(); roundRect(ctx, bx + 14, by + 14, bs - 28, bs - 28, 28); ctx.clip(); ctx.drawImage(ic, bx + 14, by + 14, bs - 28, bs - 28); ctx.restore(); }
    else { ctx.textAlign = 'center'; ctx.fillStyle = '#f5f6fa'; ctx.font = `300 78px ${F}`; ctx.fillText(guild.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(), bx + bs / 2, by + bs / 2 + 26); }
    return new AttachmentBuilder(cv.toBuffer('image/png'), { name: 'voz_banner.png' });
  } catch (e) { console.warn('[voz] no pude dibujar el banner:', e.message); return null; }
}
// Interfaz completa. Con `member` y `ch` es la del canal temporal; sin ellos es el panel fijo.
async function vccUi(guild, cf, member, ch, room) {
  const c = VCC(cf), v = c.emb || {}, brand = c.brand || 'Kuboq', col = Number.isInteger(v.color) ? v.color : 0x2b2d31;
  const trig = c.trig ? `<#${c.trig}>` : 'el canal disparador';
  const intro = fmt(v.desc || (member ? `Sala de ${member}. Gestiona tu canal con los botones de abajo.` : `Entra en ${trig} para abrir una sala nueva.`), { user: member ? `${member}` : 'tú', canal: ch ? `${ch}` : 'tu canal' });
  const foot = v.footer || `Ceder: transferir la sala · Reclamar: si falta su dueño.\n${brand} VOICE · Se elimina al quedar vacía.`;
  const title = v.title || 'Tu voz. Tu espacio.';
  const att = url(v.banner) ? null : await vccBanner(guild, cf, room), img = url(v.banner) || (att ? 'attachment://voz_banner.png' : null);
  const rows = []; let k = 0;
  for (const n of VCC_LAYOUT) { rows.push(new ActionRowBuilder().addComponents(VCC_BTNS.slice(k, k + n).map(([id, emoji, label]) => new ButtonBuilder().setCustomId(`vcc_${id}`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary)))); k += n; }
  const files = att ? [att] : [];
  if (!ContainerBuilder) { // discord.js viejo: embed normal
    const e = new EmbedBuilder().setColor(col).setTitle(title).setDescription(`${intro}\n\n-# ${foot.replace(/\n/g, ' ')}`); if (img) e.setImage(img);
    return { embeds: [e], components: rows, files };
  }
  const cont = new ContainerBuilder().setAccentColor(col);
  if (img) cont.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(img)));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**\n${intro}`));
  cont.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  for (const r of rows) cont.addActionRowComponents(r);
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(foot.split('\n').map(l => `-# ${l}`).join('\n')));
  return { components: [cont], flags: 1 << 15, files };
}
def('voz', 'setup', 'Canal disparador (voz) y categoría donde se crean los canales', 'disparador:c!,categoria:c!,nombre:s', 'ManageGuild', (i, o, g, cf) => {
  if (o.disparador.type !== ChannelType.GuildVoice) return no(i, `${o.disparador} debe ser un canal de **voz**.`);
  if (o.categoria.type !== ChannelType.GuildCategory) return no(i, `${o.categoria} debe ser una **categoría**.`);
  if (!i.guild.members.me.permissions.has(P.ManageChannels)) return no(i, 'Necesito el permiso **Gestionar canales**.');
  const c = VCC(cf); c.trig = o.disparador.id; c.cat = o.categoria.id; if (o.nombre) c.name = nl(o.nombre).slice(0, 90);
  save(); ok(i, `🔊 Disparador: ${o.disparador}\n📁 Categoría: ${o.categoria}\n📛 Nombre: **${c.name || '🔊 Canal de {user}'}**\n\nPersonaliza la interfaz con \`/voz embed\` y publícala con \`/voz panel\`.`);
});
def('voz', 'embed', 'Personaliza la interfaz: título, descripción, color (barra), banner (arriba), imagen (abajo), miniatura, pie', 'titulo:s,descripcion:s,color:s,banner:s,imagen:s,miniatura:s,pie:s', 'ManageGuild', (i, o, g, cf) => {
  const c = VCC(cf);
  if (o.color && hex(o.color) === null) return no(i, 'Color inválido. Usa el formato `#RRGGBB`.');
  for (const k of ['banner', 'imagen', 'miniatura']) if (o[k] && !url(o[k]) && !/^(ninguna|quitar)$/i.test(o[k])) return no(i, `\`${k}\` debe ser un enlace \`http(s)\` (o \`ninguna\` para quitarla).`);
  c.emb = { ...c.emb, ...Object.fromEntries(Object.entries({ title: o.titulo, desc: nl(o.descripcion), color: hex(o.color), banner: url(o.banner), img: url(o.imagen), thumb: url(o.miniatura), footer: o.pie }).filter(([, v]) => v)) };
  for (const [k, key] of [['banner', 'banner'], ['imagen', 'img'], ['miniatura', 'thumb']]) if (/^(ninguna|quitar)$/i.test(o[k] || '')) delete c.emb[key];
  save(); ok(i, 'Interfaz actualizada. Se usará en cada canal nuevo; usa `/voz panel` para republicar el panel fijo.');
});
def('voz', 'banner', 'Edita el banner del panel: textos y fondo (link de imagen). Escribe "quitar" en fondo para quitarlo', 'titulo:s,lema:s,subtitulo:s,fondo:s,nombre:s', 'ManageGuild', async (i, o, g, cf) => {
  await i.deferReply({ flags: 64 }); const c = VCC(cf); c.bn ??= {};
  if (o.nombre) c.brand = o.nombre.trim().slice(0, 30);
  if (o.titulo) c.bn.titulo = o.titulo.trim().slice(0, 28);
  if (o.lema) c.bn.lema = o.lema.trim().slice(0, 40);
  if (o.subtitulo) c.bn.subtitulo = o.subtitulo.trim().slice(0, 40);
  if (o.fondo) {
    if (/^(quitar|ninguna)$/i.test(o.fondo.trim())) delete c.bn.fondo;
    else { if (!url(o.fondo.trim())) return i.editReply('⚠️ El fondo debe ser un link que empiece con https://'); if (!CV) return i.editReply('⚠️ Falta instalar @napi-rs/canvas (npm install).');
      if (!(await nivelFondo(o.fondo.trim()))) return i.editReply('⚠️ No pude abrir esa imagen. Usa un link directo a .png, .jpg o .gif de menos de 8 MB.'); c.bn.fondo = o.fondo.trim(); }
  }
  save(); const p = await vccUi(i.guild, cf);
  await i.editReply({ ...p }).then(() => i.followUp({ flags: 64, content: '🖼️ Banner guardado. Arriba ves cómo queda; usa `/voz panel` para republicar el panel.' })).catch(() => i.editReply('🖼️ Banner guardado. Usa `/voz panel` para republicar el panel.').catch(() => {}));
});
def('voz', 'interfaz', 'Activa/desactiva enviar la interfaz de control al chat de cada canal nuevo', 'estado:b!', 'ManageGuild', (i, o, g, cf) => {
  VCC(cf).ui = o.estado; save(); ok(i, `Interfaz automática en cada canal: **${o.estado ? '🟢 activada' : '🔴 desactivada'}**.`);
});
def('voz', 'panel', 'Publica (o republica) la interfaz fija en un canal de texto', 'canal:c!', 'ManageGuild', async (i, o, g, cf) => {
  const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo publicar en ${o.canal}: ${ci}.`);
  if (!VCC(cf).trig) return no(i, 'Primero configura el disparador con `/voz setup`.');
  try { await o.canal.send(await vccUi(i.guild, cf)); }
  catch (err) { return no(i, `No pude publicar la interfaz: ${err.message}`); }
  ok(i, `Interfaz publicada en ${o.canal}.`);
});
def('voz', 'estado', 'Ver configuración de "Crea tu VC"', '', 'ManageGuild', (i, o, g, cf) => {
  const c = VCC(cf); if (!c.trig) return say(i, '🎚️ Crea tu VC', 'No configurado. Usa `/voz setup`.');
  say(i, '🎚️ Crea tu VC', `🔊 Disparador: <#${c.trig}>\n📁 Categoría: <#${c.cat}>\n📛 Nombre: **${c.name || '🔊 Canal de {user}'}**\n🔢 Canales activos: **${Object.keys(VCR(g)).length}**`);
});
def('voz', 'desactivar', 'Desactiva "Crea tu VC" (borrar:true también elimina los canales activos)', 'borrar:b', 'ManageGuild', async (i, o, g, cf) => {
  if (o.borrar) for (const id of Object.keys(VCR(g))) await i.guild.channels.cache.get(id)?.delete('Crea tu VC desactivado').catch(() => {});
  delete cf.vcc; g.vcrooms = {}; save(); ok(i, `Sistema desactivado${o.borrar ? ' y canales eliminados' : ' (los canales activos se quedan hasta vaciarse)'}.`);
});
// Recalcula TODOS los permisos del canal a partir del estado guardado (modo, confianza, bloqueados, chat).
async function vccApplyPerms(ch, room) {
  // Permisos según el modo del canal (público / privado / oculto) y el chat
  const base = { allow: [], deny: [] };
  if (room.mode === 'hidden') base.deny.push(P.ViewChannel, P.Connect);
  else if (room.mode === 'private') { base.allow.push(P.ViewChannel); room.waiting ? base.allow.push(P.Connect) : base.deny.push(P.Connect); } // con sala de espera deben poder conectarse para pasar por aprobación
  else base.allow.push(P.ViewChannel, P.Connect);
  room.chatOpen === false ? base.deny.push(P.SendMessages) : base.allow.push(P.SendMessages);
  // Si hay rol de verificación configurado (/verif setup), @everyone NO ve ningún VC creado: solo lo ven los verificados.
  const vr = C(ch.guild.id).v?.role, vRole = vr && vr !== ch.guild.id ? ch.guild.roles.cache.get(vr) : null;
  const gate = vRole
    ? [{ id: ch.guild.id, allow: [], deny: [P.ViewChannel, P.Connect, P.SendMessages] }, { id: vRole.id, ...base }]
    : [{ id: ch.guild.id, ...base }]; // sin verificación configurada: se comporta como antes
  const me = ch.guild.members.me.id;
  const ows = [...gate,
    { id: room.owner, allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages, P.ManageChannels, P.MoveMembers] },
    { id: me, allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages, P.ManageChannels, P.MoveMembers, P.EmbedLinks] },
    ...room.trust.filter(x => x !== room.owner).map(uid => ({ id: uid, allow: [P.ViewChannel, P.Connect, P.Speak, P.SendMessages] })),
    ...room.block.map(uid => ({ id: uid, deny: [P.ViewChannel, P.Connect] }))];
  await ch.permissionOverwrites.set(ows, 'Crea tu VC: actualización de permisos').catch(() => {});
}
// Reaplica los permisos a los VC ya creados (para que los que estaban abiertos también queden ocultos para no verificados)
async function vccResync() {
  for (const gu of client.guilds.cache.values()) {
    const g = G(gu.id);
    for (const [id, room] of Object.entries(VCR(g))) {
      const ch = gu.channels.cache.get(id); if (ch) await vccApplyPerms(ch, room);
    }
  }
}
async function vccWaitChannel(guild, cf) {
  const c = VCC(cf), cat = guild.channels.cache.get(c.cat);
  let ch = c.wait && guild.channels.cache.get(c.wait);
  if (ch) return ch;
  try {
    ch = await guild.channels.create({ name: '🕐 Sala de espera', type: ChannelType.GuildVoice, parent: cat?.id ?? null, reason: 'Crea tu VC: sala de espera',
      permissionOverwrites: [{ id: guild.id, deny: [P.ViewChannel] }, { id: guild.members.me.id, allow: [P.ViewChannel, P.Connect, P.MoveMembers, P.SendMessages] }] });
  } catch { return null; }
  c.wait = ch.id; save(); return ch;
}
async function vcCreateHandler(state) {
  if (!state.channelId) return;
  const guild = state.guild, cf = C(guild.id), c = cf.vcc; if (!c?.trig || state.channelId !== c.trig) return;
  const g = G(guild.id), me = guild.members.me; if (!me.permissions.has(P.ManageChannels)) return;
  const cat = guild.channels.cache.get(c.cat); if (cat?.type !== ChannelType.GuildCategory) return;
  const member = state.member; if (!member || member.user.bot) return;
  const name = fmt(c.name || '🔊 Canal de {user}', { user: member.displayName ?? member.user.username }).slice(0, 90);
  let ch; try { ch = await guild.channels.create({ name, type: ChannelType.GuildVoice, parent: cat.id, reason: 'Crea tu VC' }); }
  catch (err) { return console.warn('[crea-tu-vc] no pude crear el canal:', err.message); }
  // Primero se registra y se aplican permisos; después se mueve a la persona (así el canal nunca queda "huérfano")
  const room = { owner: member.id, mode: 'public', chatOpen: true, waiting: false, trust: [], block: [] };
  VCR(g)[ch.id] = room; save(); await vccApplyPerms(ch, room);
  const moved = await member.voice.setChannel(ch).then(() => true).catch(() => false);
  if (!moved) { await ch.delete('Crea tu VC: no se pudo mover al dueño').catch(() => {}); delete VCR(g)[ch.id]; save(); return; }
  if (c.ui !== false) {
    await ch.send({ ...(await vccUi(guild, cf, member, ch, room)), allowedMentions: { users: [member.id] } })
      .catch(err => console.warn(`[crea-tu-vc] no pude enviar la interfaz en ${ch.id}: ${err.message} (el bot necesita Ver canal, Enviar mensajes e Insertar enlaces)`));
  }
}
async function vcCleanupHandler(state) {
  if (!state.channelId) return;
  const guild = state.guild, g = G(guild.id), room = VCR(g)[state.channelId]; if (!room) return;
  const ch = guild.channels.cache.get(state.channelId); if (!ch) { delete VCR(g)[state.channelId]; save(); return; }
  if (ch.members.size > 0) return;
  await ch.delete('Crea tu VC: canal vacío').catch(() => {});
  delete VCR(g)[state.channelId]; save();
}
// Si "Sala de espera" está activa en el canal al que alguien se conecta, lo redirige a la sala de espera
// compartida y manda una solicitud (con botones Aceptar/Rechazar) al chat del canal del dueño.
async function vcGateHandler(state) {
  if (!state.channelId) return;
  const guild = state.guild, g = G(guild.id), room = VCR(g)[state.channelId]; if (!room || !room.waiting) return;
  const member = state.member; if (!member || member.id === room.owner || room.trust.includes(member.id) || member.permissions.has(P.ManageChannels)) return;
  const ch = guild.channels.cache.get(state.channelId); if (!ch) return;
  const cf = C(guild.id), wait = await vccWaitChannel(guild, cf); if (!wait) return;
  await member.voice.setChannel(wait).catch(() => {});
  try {
    await ch.send({ content: `<@${room.owner}>`, embeds: [E(guild.id, '🕐 Solicitud de entrada', `${member} quiere entrar a tu canal de voz.`)],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`vcc_wok_${ch.id}_${member.id}`).setLabel('Aceptar').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`vcc_wno_${ch.id}_${member.id}`).setLabel('Rechazar').setEmoji('❌').setStyle(ButtonStyle.Danger))] });
  } catch {}
}
function vccRoom(i) {
  const g = G(i.guildId), chid = i.member.voice.channelId, room = chid && VCR(g)[chid];
  return room ? { ch: i.guild.channels.cache.get(chid), room } : {};
}
async function vccButton(i) {
  if (!i.customId.startsWith('vcc_')) return false;
  const wm = i.customId.match(/^vcc_(wok|wno)_(\d+)_(\d+)$/);
  if (wm) {
    const [, act, chid, uid] = wm, g = G(i.guildId), room = VCR(g)[chid], ch = i.guild.channels.cache.get(chid);
    if (!room || !ch) { await no(i, 'Ese canal ya no existe.'); return true; }
    if (i.user.id !== room.owner && !i.member.permissions.has(P.ManageChannels)) { await no(i, 'Solo el dueño puede responder esta solicitud.'); return true; }
    const wait = guildWaitCh(i.guild, C(i.guildId)); const tm = wait && wait.members.get(uid);
    if (!tm) { await i.update({ embeds: [E(i.guildId, '⌛ Caducado', 'Ese usuario ya no está esperando.')], components: [] }).catch(() => {}); return true; }
    if (act === 'wok') { await tm.voice.setChannel(ch).catch(() => {}); if (!room.trust.includes(uid)) room.trust.push(uid); save(); await vccApplyPerms(ch, room); await i.update({ embeds: [E(i.guildId, '✅ Aceptado', `${tm} entró al canal.`)], components: [] }).catch(() => {}); }
    else { await tm.voice.disconnect('Entrada rechazada').catch(() => {}); await i.update({ embeds: [E(i.guildId, '❌ Rechazado', `${tm} fue rechazado.`)], components: [] }).catch(() => {}); }
    return true;
  }
  const act = i.customId.slice(4);
  if (!['name', 'limit', 'privacy', 'hide', 'banner', 'wait', 'chat', 'trust', 'untrust', 'invite', 'kick', 'region', 'block', 'unblock', 'claim', 'transfer', 'delete', 'bitrate', 'info', 'reset'].includes(act)) return false;
  const { ch, room } = vccRoom(i);
  if (!ch || !room) { await no(i, 'Debes estar conectado a un canal de voz **temporal** creado por este sistema.'); return true; }
  const isOwner = room.owner === i.user.id || i.member.permissions.has(P.ManageChannels);
  if (act === 'claim') {
    if (ch.members.has(room.owner)) { await no(i, `El dueño (<@${room.owner}>) sigue conectado.`); return true; }
    room.owner = i.user.id; save(); await vccApplyPerms(ch, room);
    await i.reply({ flags: 64, embeds: [E(i.guildId, '👑 Canal reclamado', 'Ahora eres el dueño de este canal.')] }); return true;
  }
  if (act === 'info') {
    const rg = ch.rtcRegion || 'automático', md = { public: '🌐 Público', private: '🔒 Privado', hidden: '👁️ Oculto' }[room.mode];
    await i.reply({ flags: 64, embeds: [E(i.guildId, `ℹ️ ${ch.name}`, `👑 Dueño: <@${room.owner}>\n🔒 Privacidad: **${md}**\n👥 Límite: **${ch.userLimit || 'sin límite'}**\n🕐 Sala de espera: **${room.waiting ? 'sí' : 'no'}**\n💬 Chat: **${room.chatOpen === false ? 'cerrado' : 'abierto'}**\n🔊 Audio: **${Math.round(ch.bitrate / 1000)} kbps**\n🌐 Región: **${rg}**\n🤝 De confianza: **${room.trust.length}** · ⛔ Bloqueados: **${room.block.length}**`)] });
    return true;
  }
  if (!isOwner) { await no(i, 'Solo el dueño de este canal puede usar ese botón.'); return true; }
  if (act === 'hide') { room.mode = room.mode === 'hidden' ? 'public' : 'hidden'; save(); await vccApplyPerms(ch, room); await i.reply({ flags: 64, embeds: [E(i.guildId, '👁️ Visibilidad', room.mode === 'hidden' ? 'Tu canal ahora está **oculto**.' : 'Tu canal vuelve a ser **visible**.')] }); return true; }
  if (act === 'banner') { await i.showModal(new ModalBuilder().setCustomId('vcc_banner_modal').setTitle('Banner de tu sala').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('Texto del banner (vacío = por defecto)').setStyle(TextInputStyle.Short).setMaxLength(28).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('f').setLabel('Fondo: link de imagen (vacío = por defecto)').setStyle(TextInputStyle.Short).setRequired(false)))); return true; }
  if (act === 'bitrate') {
    const max = Math.floor((i.guild.maximumBitrate || 96000) / 1000), opts = [8, 16, 32, 64, 96, 128, 256, 384].filter(k => k <= max);
    await i.reply({ flags: 64, content: 'Elige la calidad de audio:', components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('vcc_bitrate_sel').setPlaceholder('Calidad de audio').addOptions(opts.map(k => ({ label: `${k} kbps`, value: String(k) }))))] });
    return true;
  }
  if (act === 'reset') {
    Object.assign(room, { mode: 'public', chatOpen: true, waiting: false, trust: [], block: [] }); save(); await vccApplyPerms(ch, room);
    await ch.setUserLimit(0).catch(() => {}); await ch.setRTCRegion(null).catch(() => {});
    await i.reply({ flags: 64, embeds: [E(i.guildId, '⚙️ Restablecido', 'Tu canal volvió a ser público, sin límite, sin sala de espera y sin listas de confianza/bloqueo.')] });
    return true;
  }
  if (act === 'name') { await i.showModal(new ModalBuilder().setCustomId('vcc_name_modal').setTitle('Renombrar canal').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('Nuevo nombre').setStyle(TextInputStyle.Short).setMaxLength(90).setRequired(true)))); return true; }
  if (act === 'limit') { await i.showModal(new ModalBuilder().setCustomId('vcc_limit_modal').setTitle('Límite de usuarios').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('Límite (0 = sin límite, máx. 99)').setStyle(TextInputStyle.Short).setRequired(true)))); return true; }
  if (act === 'privacy') {
    await i.reply({ flags: 64, content: 'Elige la privacidad del canal:', components: [new ActionRowBuilder().addComponents(
      new (require('discord.js').StringSelectMenuBuilder)().setCustomId('vcc_privacy_sel').setPlaceholder('Privacidad').addOptions(
        { label: 'Público', value: 'public', emoji: '🌐', description: 'Cualquiera puede ver y entrar' },
        { label: 'Privado', value: 'private', emoji: '🔒', description: 'Se ve, pero no se puede entrar sin permiso' },
        { label: 'Oculto', value: 'hidden', emoji: '👁️', description: 'No aparece en la lista de canales' }))] });
    return true;
  }
  if (act === 'wait') { room.waiting = !room.waiting; save(); await vccApplyPerms(ch, room); await i.reply({ flags: 64, embeds: [E(i.guildId, '🕐 Sala de espera', room.waiting ? 'Activada: quien no sea de confianza pasará por aprobación.' : 'Desactivada.')] }); return true; }
  if (act === 'chat') { room.chatOpen = room.chatOpen === false ? true : false; save(); await vccApplyPerms(ch, room); await i.reply({ flags: 64, embeds: [E(i.guildId, '💬 Chat del canal', room.chatOpen ? 'Abierto para todos.' : 'Cerrado: solo el dueño y los de confianza pueden escribir.')] }); return true; }
  if (act === 'region') {
    await i.reply({ flags: 64, content: 'Elige la región de voz:', components: [new ActionRowBuilder().addComponents(
      new (require('discord.js').StringSelectMenuBuilder)().setCustomId('vcc_region_sel').setPlaceholder('Región').addOptions(VCC_REGIONS.map(([label, value]) => ({ label, value }))))] });
    return true;
  }
  if (act === 'delete') { await i.reply({ flags: 64, embeds: [E(i.guildId, '🗑️ Eliminando', 'Tu canal se eliminará en unos segundos.')] }); await ch.delete('Crea tu VC: eliminado por el dueño').catch(() => {}); delete VCR(G(i.guildId))[ch.id]; save(); return true; }
  const SEL = { trust: ['vcc_trust_sel', 'A quién confiar'], untrust: ['vcc_untrust_sel', 'A quién quitar la confianza'], invite: ['vcc_invite_sel', 'A quién invitar'],
    kick: ['vcc_kick_sel', 'A quién expulsar'], block: ['vcc_block_sel', 'A quién bloquear'], unblock: ['vcc_unblock_sel', 'A quién desbloquear'], transfer: ['vcc_transfer_sel', 'Nuevo dueño'] };
  if (SEL[act]) {
    const [cid, ph] = SEL[act];
    await i.reply({ flags: 64, content: ph + ':', components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(cid).setPlaceholder(ph).setMinValues(1).setMaxValues(1))] });
    return true;
  }
  return true;
}
async function vccSelectUser(i) {
  const act = { vcc_trust_sel: 'trust', vcc_untrust_sel: 'untrust', vcc_invite_sel: 'invite', vcc_kick_sel: 'kick', vcc_block_sel: 'block', vcc_unblock_sel: 'unblock', vcc_transfer_sel: 'transfer' }[i.customId];
  if (!act) return false;
  const { ch, room } = vccRoom(i);
  if (!ch || !room) { await i.update({ content: 'Ya no estás en un canal de voz temporal.', components: [] }).catch(() => {}); return true; }
  if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await i.update({ content: 'Solo el dueño puede hacer esto.', components: [] }).catch(() => {}); return true; }
  const target = i.users.first(); if (!target) { await i.update({ content: 'No elegiste a nadie.', components: [] }).catch(() => {}); return true; }
  if (target.id === room.owner && act !== 'transfer') { await i.update({ content: 'Ese es el dueño del canal.', components: [] }).catch(() => {}); return true; }
  if (act === 'trust') { if (!room.trust.includes(target.id)) room.trust.push(target.id); room.block = room.block.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); await i.update({ content: `🤝 ${target} ahora es de confianza.`, components: [] }); }
  else if (act === 'untrust') { room.trust = room.trust.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); await i.update({ content: `🚫 Se quitó la confianza a ${target}.`, components: [] }); }
  else if (act === 'invite') {
    if (!room.trust.includes(target.id)) room.trust.push(target.id); save(); await vccApplyPerms(ch, room);
    target.send({ embeds: [E(i.guildId, '✉️ Te invitaron a un canal de voz', `${i.user} te invitó a su canal: ${ch}`)] }).catch(() => {});
    await i.update({ content: `✉️ Invitación enviada a ${target} (ahora tiene acceso).`, components: [] });
  } else if (act === 'kick') { const tm = ch.members.get(target.id); if (!tm) { await i.update({ content: 'Ese usuario no está en tu canal.', components: [] }); } else { await tm.voice.disconnect('Expulsado del VC por el dueño').catch(() => {}); await i.update({ content: `👢 ${target} fue expulsado.`, components: [] }); } }
  else if (act === 'block' && room.block.includes(target.id)) { room.block = room.block.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); await i.update({ content: `♻️ ${target} fue desbloqueado.`, components: [] }); }
  else if (act === 'block') { if (!room.block.includes(target.id)) room.block.push(target.id); room.trust = room.trust.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); const tm = ch.members.get(target.id); if (tm) await tm.voice.disconnect('Bloqueado del VC').catch(() => {}); await i.update({ content: `⛔ ${target} fue bloqueado.`, components: [] }); }
  else if (act === 'unblock') { room.block = room.block.filter(x => x !== target.id); save(); await vccApplyPerms(ch, room); await i.update({ content: `♻️ ${target} fue desbloqueado.`, components: [] }); }
  else if (act === 'transfer') { const tm = ch.members.get(target.id); if (!tm) { await i.update({ content: 'Ese usuario debe estar conectado al canal para recibirlo.', components: [] }); } else { room.owner = target.id; save(); await vccApplyPerms(ch, room); await i.update({ content: `🔁 ${target} ahora es el dueño del canal.`, components: [] }); } }
  return true;
}
async function vccSelectString(i) {
  const { ch, room } = vccRoom(i);
  if (i.customId === 'vcc_privacy_sel') {
    if (!ch || !room) { await i.update({ content: 'Ya no estás en un canal de voz temporal.', components: [] }).catch(() => {}); return true; }
    if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await i.update({ content: 'Solo el dueño puede hacer esto.', components: [] }).catch(() => {}); return true; }
    room.mode = i.values[0]; save(); await vccApplyPerms(ch, room);
    const txt = { public: '🌐 Público', private: '🔒 Privado', hidden: '👁️ Oculto' }[room.mode];
    await i.update({ content: `Privacidad actualizada: **${txt}**`, components: [] }); return true;
  }
  if (i.customId === 'vcc_bitrate_sel') {
    if (!ch || !room) { await i.update({ content: 'Ya no estás en un canal de voz temporal.', components: [] }).catch(() => {}); return true; }
    if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await i.update({ content: 'Solo el dueño puede hacer esto.', components: [] }).catch(() => {}); return true; }
    const ok2 = await ch.setBitrate(+i.values[0] * 1000).then(() => true).catch(() => false);
    await i.update({ content: ok2 ? `🔊 Audio: **${i.values[0]} kbps**` : 'No pude cambiar la calidad de audio.', components: [] }); return true;
  }
  if (i.customId === 'vcc_region_sel') {
    if (!ch || !room) { await i.update({ content: 'Ya no estás en un canal de voz temporal.', components: [] }).catch(() => {}); return true; }
    if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await i.update({ content: 'Solo el dueño puede hacer esto.', components: [] }).catch(() => {}); return true; }
    await ch.setRTCRegion(i.values[0] === 'auto' ? null : i.values[0]).catch(() => {});
    await i.update({ content: `🌐 Región actualizada.`, components: [] }); return true;
  }
  return false;
}
async function vccModal(i) {
  if (!['vcc_name_modal', 'vcc_limit_modal', 'vcc_banner_modal'].includes(i.customId)) return false;
  const { ch, room } = vccRoom(i);
  if (!ch || !room) { await no(i, 'Ya no estás en un canal de voz temporal.'); return true; }
  if (room.owner !== i.user.id && !i.member.permissions.has(P.ManageChannels)) { await no(i, 'Solo el dueño puede hacer esto.'); return true; }
  if (i.customId === 'vcc_banner_modal') {
    await i.deferReply({ flags: 64 }); const t = i.fields.getTextInputValue('t').trim(), f = i.fields.getTextInputValue('f').trim();
    if (f && (!url(f) || !(await nivelFondo(f)))) return i.editReply('⚠️ No pude abrir esa imagen. Usa un link directo (https) a .png, .jpg o .gif.');
    room.bn = { ...(t ? { titulo: t } : {}), ...(f ? { fondo: f } : {}) }; save();
    const cf = C(i.guildId), p = await vccUi(i.guild, cf, i.member, ch, room);
    await ch.send({ ...p, allowedMentions: { parse: [] } }).catch(() => {});
    return i.editReply('🖼️ Banner actualizado en el chat de tu sala.');
  }
  if (i.customId === 'vcc_name_modal') {
    const name = i.fields.getTextInputValue('v').trim().slice(0, 90) || ch.name; await ch.setName(name).catch(() => {});
    await i.reply({ flags: 64, embeds: [E(i.guildId, '📛 Renombrado', `Nuevo nombre: **${name}**`)] });
  } else {
    const n = Math.max(0, Math.min(99, parseInt(i.fields.getTextInputValue('v'), 10) || 0)); await ch.setUserLimit(n).catch(() => {});
    await i.reply({ flags: 64, embeds: [E(i.guildId, '👥 Límite actualizado', n ? `Máximo **${n}** usuarios.` : 'Sin límite.')] });
  }
  return true;
}
function guildWaitCh(guild, cf) { return VCC(cf).wait && guild.channels.cache.get(VCC(cf).wait); }

/* ================================ EVENTOS ================================ */
let LISTO = false;
const alListo = async () => {
  if (LISTO) return; LISTO = true; // solo una vez
  console.log(`✅ ${client.user.tag} | ${Object.values(CATS).reduce((a, c) => a + Object.keys(c).length, 0)} comandos`);
  // limpia del registro de Discord los comandos eliminados (/cerrar-servidor, /abrir-servidor y /limpiar servidor) aunque hayan quedado registrados de versiones antiguas
  try {
    for (const c of (await client.application.commands.fetch()).values()) if (['cerrar-servidor', 'abrir-servidor'].includes(c.name)) await c.delete().catch(() => {});
    for (const gu of client.guilds.cache.values()) await gu.commands.set([]).catch(() => {}); // este bot solo registra comandos globales
  } catch (err) { console.warn('[comandos] no pude limpiar comandos antiguos:', err.message); }
  try { await client.application.commands.set([...build(), ...music.musicCommands()]); console.log('✅ Comandos registrados en Discord'); }
  catch (err) { console.error('[comandos] Discord rechazó el registro:', err.message, JSON.stringify(err.rawError?.errors || {}).slice(0, 1200)); }
  music.initMusic().catch(e => console.warn('[music]',e.message));
  client.guilds.cache.forEach(loadInv);
  vccResync().catch(err => console.warn('[crea-tu-vc] resync:', err.message)); // oculta a no verificados los VC que ya estaban creados
  setInterval(() => vcTick().catch(console.error), 20000); setTimeout(() => vcTick().catch(console.error), 10000); // estado de voz
  setInterval(() => cleanTick().catch(console.error), 60000); setTimeout(() => cleanTick().catch(console.error), 20000); // limpieza automática
  setInterval(() => statsTick().catch(console.error), 60000); setTimeout(() => statsTick().catch(console.error), 30000); // ServerStats
  setInterval(() => client.guilds.cache.forEach(gu => gu.voiceStates.cache.forEach(vs => { // estar en voz da XP cada minuto
    if (vs.member && !vs.member.user.bot && vs.channelId && !vs.selfDeaf && !vs.serverDeaf) { actXp(vs.member, null, 'xpvc', 55000).catch(() => {}); }
  })), 60000);
  setInterval(() => bumpTick().catch(console.error), 30000); setTimeout(() => bumpTick().catch(console.error), 8000); // aviso "es hora de realzar"
  setInterval(() => achVoiceTick(), 60000); // minutos en voz / micro / cámara / stream
  setTimeout(() => achSweep().catch(console.error), 15000); setInterval(() => achSweep().catch(console.error), 600000); // días en el servidor
  // Rota el texto de "Jugando" entre las frases guardadas (cada 15 s; identity.rotationSeconds en config.json lo cambia)
  let estIdx = 0; const rotarEstado = () => { const l = estadoBot(), lista = l.length ? l : config.identity.defaultStatus; client.user.setActivity(lista[estIdx++ % lista.length]); };
  rotarEstado(); setInterval(rotarEstado, (+process.env.BOT_ESTADO_SEG || 15) * 1000);
};
// discord.js 14.22+ usa 'clientReady'; las versiones anteriores solo emiten 'ready' (con 'clientReady' el bot nunca registraba los comandos)
const [vMa, vMi] = String(require('discord.js').version || '14.0').split('.').map(Number);
eventHandler.once(vMa > 14 || vMi >= 22 ? 'clientReady' : 'ready', alListo);
eventHandler.on('guildCreate', loadInv);
eventHandler.on('inviteCreate', i => {
  const gid = i.guild.id; IC.get(gid)?.set(i.code, { uses: i.uses ?? 0, by: i.inviter?.id ?? null, max: i.maxUses || 0, exp: i.expiresTimestamp || 0 });
  invLog(gid, 'creada', { inviter: i.inviter ? `<@${i.inviter.id}>` : 'desconocido', code: i.code, channel: i.channelId ? `<#${i.channelId}>` : '—', max: i.maxUses || '∞',
    expires: i.expiresTimestamp ? `<t:${Math.floor(i.expiresTimestamp / 1000)}:R>` : 'nunca', _thumb: i.inviter?.displayAvatarURL() });
});
eventHandler.on('inviteDelete', i => {
  const gid = i.guild.id, c = IC.get(gid)?.get(i.code);
  invLog(gid, 'borrada', { inviter: c?.by ? `<@${c.by}>` : 'desconocido', code: i.code, uses: c?.uses ?? '—' });
  setTimeout(() => IC.get(gid)?.delete(i.code), 15000); // se conserva unos segundos: si fue el último uso, sirve para detectar quién entró
});

eventHandler.on('interactionCreate', async i => {
  try {
    if (!i.guild) return;
    if (!i.isChatInputCommand()) registrarActividad(i, i.isButton() ? 'boton' : i.isModalSubmit() ? 'formulario' : 'interaccion', { nombre: i.customId ?? null });
    if (!i.isChatInputCommand() && await extraInteractions(i)) return; // confesiones, pinterest e IA (botones y modales)
    if (i.isChatInputCommand()) {
      const c = CATS[i.commandName]?.[i.options.getSubcommand(false) ?? 'run']; if (!c) return;
      // Discord solo da 3 segundos para responder. Si un comando tarda más, se "difiere" solo antes de que caduque,
      // y las respuestas normales (i.reply) pasan a editar ese mensaje en vez de fallar con "Unknown interaction".
      const reply0 = i.reply.bind(i), pub = o => (o && typeof o === 'object' && o.flags != null) ? { ...o, flags: (Number(o.flags) & ~64) || undefined } : o;
      i.reply = o => { if (i.replied) return i.followUp(o); if (i.deferred) return i.editReply(pub(o)); return reply0(o); };
      const wd = setTimeout(() => { if (!i.deferred && !i.replied) i.deferReply().catch(() => {}); }, 2200);
      actXp(i.member, i.channel, 'xpcmd', 10000).catch(() => {}); // usar comandos también da XP
      if (c.perm && !i.member.permissions.has(P[c.perm])) { clearTimeout(wd); return no(i, `Necesitas el permiso **${c.perm}**.`); }
      const o = {}; for (const x of c.spec) o[x.n] = i.options[GET[x.t]](x.n);
      registrarActividad(i, 'comando', { nombre: `${i.commandName} ${i.options.getSubcommand(false) ?? ''}`.trim(), opciones: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, valorOpcion(v)])) });
      if (i.commandName === 'seg') lg(i.guildId, 'general', E(i.guildId, '🛰️ Configuración de seguridad', `${i.user} usó \`/seg ${i.options.getSubcommand(false) ?? ''}\``), null, 'sentinel');
      try { return await c.run(i, o, G(i.guildId), C(i.guildId)); } finally { clearTimeout(wd); }
    }
    if (i.isButton()) {
      const id = i.customId;
      if (id === 'verif') return await verifButton(i);
      if (id.startsWith('ach_')) return await achButton(i);
      if (id.startsWith('cl_')) return await cleanButton(i);
      if (id === 'verif_enter') return i.showModal(new ModalBuilder().setCustomId('verif_modal').setTitle('Verificación').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel('Código').setStyle(TextInputStyle.Short).setRequired(true))));
      if (id === 'verif_captcha_enter') {
        if (!CC.get(i.user.id)) return no(i, 'No tienes una verificación pendiente o se acabó el tiempo. Pulsa el botón del panel de nuevo.');
        return i.showModal(new ModalBuilder().setCustomId('verif_captcha_modal').setTitle('Verificación').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('answer').setLabel('Resultado').setStyle(TextInputStyle.Short).setRequired(true))));
      }
      if (id === 'tk_open') return tkOpen(i);
      if (id === 'tk_close') { const t = G(i.guildId).tickets[i.channelId]; if (!t) return; if (!tkStaff(i.member, i.guildId, t)) return tkDeny(i); await i.reply({ embeds: [E(i.guildId, '🔒 Cerrando ticket', 'Se cerrará en 5 segundos...')] }); return closeTicket(i.channel, i.user); }
      if (id === 'tk_claim') { const t = G(i.guildId).tickets[i.channelId]; if (!t) return; if (!tkStaff(i.member, i.guildId, t)) return tkDeny(i); t.claimed = i.user.id; save(); return i.reply({ embeds: [E(i.guildId, '🙋 Ticket reclamado', `${i.user} atenderá este ticket.`)] }); }
      if (id.startsWith('rr_')) {
        const rid = id.slice(3), rl = i.guild.roles.cache.get(rid), has = hasRole(i.member, rid), pr = roleIssue(i.guild, rl);
        if (pr) return no(i, `No puedo gestionar ${rl ?? 'ese rol'}: ${pr}.`);
        try { await (has ? i.member.roles.remove(rid) : i.member.roles.add(rid)); } catch (err) { return no(i, `No pude cambiar tu rol: ${err.message}`); }
        return i.reply({ flags: 64, embeds: [E(i.guildId, has ? '➖ Rol quitado' : '➕ Rol añadido', `<@&${rid}>`)] });
      }
      if (id.startsWith('vcc_')) return await vccButton(i);
    }
    if (i.isStringSelectMenu() && i.customId === 'tk_menu') { i.message.edit({ components: tkRows(C(i.guildId), 'menu') }).catch(() => {}); return await tkOpen(i, i.values[0]); } // se reinicia el menú para poder elegir la misma opción otra vez
    if (i.isUserSelectMenu() && i.customId.startsWith('vcc_')) { if (await vccSelectUser(i)) return; }
    if (i.isStringSelectMenu() && i.customId.startsWith('vcc_')) { if (await vccSelectString(i)) return; }
    if (i.isModalSubmit() && i.customId.startsWith('vcc_')) { if (await vccModal(i)) return; }
    if (i.isModalSubmit() && i.customId === 'verif_modal') {
      const v = C(i.guildId).v, c = VC.get(i.user.id);
      if (!c) return no(i, 'No tienes una verificación pendiente. Pulsa el botón del panel de nuevo.');
      const elapsed = Date.now() - c.start;
      if (elapsed > 300000) { VC.delete(i.user.id); return no(i, 'Se acabó el tiempo. Pulsa el botón del panel de nuevo.'); }
      if (i.fields.getTextInputValue('code').trim().toUpperCase() !== c.code) {
        c.attempts++;
        if (c.attempts >= 3) {
          VC.delete(i.user.id);
          await vlog(i.guild, i.user, '❌ Verificación fallida (código)', 'Código', 'Demasiados intentos fallidos', riskScore(i.user, { fails: c.attempts, ms: elapsed }));
          return no(i, 'Demasiados intentos fallidos. Pulsa el botón del panel de nuevo para reintentar.');
        }
        return no(i, `Código incorrecto. Te quedan **${3 - c.attempts}** intento(s).`);
      }
      VC.delete(i.user.id);
      if (!v.role || roleIssue(i.guild, i.guild.roles.cache.get(v.role))) return no(i, 'La verificación está mal configurada. Avisa a un administrador.');
      await i.member.roles.add(v.role); await vlog(i.guild, i.user, '✅ Usuario verificado', 'Código', null, riskScore(i.user, { fails: c.attempts, ms: elapsed }));
      return i.reply({ flags: 64, embeds: [E(i.guildId, '✅ Verificado', '¡Bienvenido al servidor!')] });
    }
    if (i.isModalSubmit() && i.customId === 'verif_captcha_modal') {
      const v = C(i.guildId).v, c = CC.get(i.user.id);
      if (!c) return no(i, 'No tienes una verificación pendiente. Pulsa el botón del panel de nuevo.');
      const elapsed = Date.now() - c.start;
      if (elapsed > 120000) { CC.delete(i.user.id); return no(i, 'Se acabó el tiempo. Pulsa el botón del panel de nuevo.'); }
      if (Number(i.fields.getTextInputValue('answer').trim()) !== c.ans) {
        c.attempts++;
        if (c.attempts >= 3) {
          CC.delete(i.user.id);
          await vlog(i.guild, i.user, '❌ Verificación fallida (captcha)', 'Captcha', 'Demasiados intentos fallidos', riskScore(i.user, { fails: c.attempts, ms: elapsed }));
          return no(i, 'Demasiados intentos fallidos. Pulsa el botón del panel de nuevo para reintentar.');
        }
        return no(i, `Respuesta incorrecta. Te quedan **${3 - c.attempts}** intento(s).`);
      }
      CC.delete(i.user.id);
      if (!v.role || roleIssue(i.guild, i.guild.roles.cache.get(v.role))) return no(i, 'La verificación está mal configurada. Avisa a un administrador.');
      await i.member.roles.add(v.role); await vlog(i.guild, i.user, '✅ Usuario verificado', 'Captcha', null, riskScore(i.user, { fails: c.attempts, ms: elapsed }));
      return i.reply({ flags: 64, embeds: [E(i.guildId, '✅ Verificado', '¡Bienvenido al servidor!')] });
    }
  } catch (err) {
    if (IGN_ERR.has(err?.code)) return; // 10062 interacción caducada · 40060 ya respondida · 10008 mensaje borrado: no hay nada que hacer
    console.error(err); const p = { flags: 64, embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Ocurrió un error ejecutando el comando.')] };
    (i.deferred || i.replied ? i.followUp(p) : i.reply(p)).catch(() => {});
  }
});

eventHandler.on('messageCreate', async m => {
  if (m.guild && m.author.id === DISBOARD_ID) { disboardBump(m).catch(console.error); return; } // /bump de Disboard
  if (!m.guild || m.author.bot || !m.member) return;
  const cf = C(m.guildId), g = G(m.guildId);
  if (await automod(m, cf, g)) return;
  const u = U(m.guildId, m.author.id); u.msgs++;
  if (cf.lvlon && !cd(u, 'xp', 8000)) await addXp(m.member, xpAmt(cf) + (m.attachments.size ? 5 : 0), m.channel); else save();
});

eventHandler.on('messageReactionAdd', async (r, user) => { // reaccionar también da XP
  try {
    if (user.bot) return; if (r.partial) await r.fetch(); const gu = r.message.guild; if (!gu) return;
    actXp(await gu.members.fetch(user.id), r.message.channel, 'xprx', 10000).catch(() => {});
  } catch {}
});

eventHandler.on('guildMemberAdd', async m => {
  const gid = m.guild.id, g = G(gid), cf = C(gid), s = cf.sec;
  const tr = trackInvite(m); // se lanza ya: así el caché se actualiza aunque el miembro sea expulsado después
  if (m.user.bot && s.bots && !g.wl.includes(m.id)) { await m.kick('AntiBots').catch(() => {}); return lg(gid, 'seguridad', E(gid, '🤖 AntiBots', `Bot expulsado: **${m.user.tag}**`)); }
  if (cf.minage && Date.now() - m.user.createdTimestamp < cf.minage * 864e5) {
    await dm(m.user, E(gid, '🕒 Cuenta demasiado nueva', `Tu cuenta debe tener al menos ${cf.minage} días para entrar a **${m.guild.name}**.`)); await m.kick('Edad mínima de cuenta').catch(() => {});
    return lg(gid, 'seguridad', E(gid, '🕒 Cuenta nueva expulsada', `${m.user.tag} (${m.user.id})`));
  }
  if (s.raid) {
    const a = (JN.get(gid) || []).filter(t => Date.now() - t < cf.raidsec * 1000); a.push(Date.now()); JN.set(gid, a);
    if (a.length >= cf.raidn) { await m.kick('AntiRaid').catch(() => {}); return lg(gid, 'seguridad', E(gid, '🚨 ANTI-RAID', `**${m.user.tag}** expulsado (${a.length} entradas en ${cf.raidsec}s).`), null, 'defensa'); }
  }
  const ids = m.user.bot ? [cf.botrole].filter(Boolean) : g.autoroles; if (ids.length) giveRoles(m, ids).catch(console.error);
  // invitaciones (la detección ya está en marcha; aquí se espera el resultado y se registra)
  const info = await tr, jr = recordJoin(m, info), by = jr.inviter, count = jr.count;
  if (by) { syncRewards(m.guild, by).catch(console.error); const im = await m.guild.members.fetch(by).catch(() => null); if (im) checkAch(im, null); }
  invLog(gid, 'entrada', invVars(m, info, jr), INVC[jr.type]);
  const legacy = wbLegacy(cf, 'bienvenida');
  if (!legacy) await sendWB(m, 'bienvenida', { inviter: by ? `<@${by}>` : 'desconocido', count });
  const ic = cf.inv; const ch = legacy ? m.guild.channels.cache.get(ic.ch) : null; // sistema antiguo solo si no hay /bienvenida configurado
  if (ch) {
    const e = E(gid, ic.title || '👋 ¡Bienvenido!', fmt(ic.msg || '{user} se unió, invitado por {inviter} ({count} invitaciones). Ya somos **{members}**.', { user: `${m}`, inviter: by ? `<@${by}>` : 'desconocido', count, server: m.guild.name, members: m.guild.memberCount }), ic.img).setThumbnail(m.displayAvatarURL());
    if (ic.color) e.setColor(ic.color); ch.send({ content: `${m}`, embeds: [e] }).catch(() => {});
  }
  if (lgDest(gid, 'general', 'miembros', 'entradas') !== lgDest(gid, 'invitaciones')) { // si es el mismo canal que el log de invitaciones no se repite
    lg(gid, 'general', logCard(gid, `🎉 ${m.displayName} se unió`, [['📨', 'Invitado por', by ? `<@${by}>` : '❓ Desconocido'],
      info.type === 'vanity' ? ['🌟', 'Link personalizado', info.code ? dg(info.code) : '—'] : info.code ? ['🔗', 'Link normal', dg(info.code)] : ['🔗', 'Link usado', '❓ Desconocido'],
      ['🕒', 'Cuenta creada', `<t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`]], { user: m.user, color: INVC[jr.type] }), 'miembros', 'entradas');
  }
});
eventHandler.on('guildMemberRemove', async m => {
  const gid = m.guild.id, g = G(gid), cf = C(gid), r = g.invby[m.id];
  if (r && !r.left) { r.left = true; if (!r.fake) { U(gid, r.by).left++; syncRewards(m.guild, r.by).catch(console.error); } save(); }
  if (r) invLog(gid, 'salida', { user: `<@${m.id}>`, tag: m.user.tag, id: m.id, inviter: `<@${r.by}>`, count: invTotal(U(gid, r.by)),
    stay: durTxt(Date.now() - (m.joinedTimestamp ?? r.at ?? Date.now())), server: m.guild.name, members: m.guild.memberCount, _thumb: m.user.displayAvatarURL() });
  const legacy = wbLegacy(cf, 'despedida');
  if (!legacy) sendWB(m, 'despedida', { inviter: r ? `<@${r.by}>` : 'desconocido' });
  const ic = cf.inv, ch = legacy ? m.guild.channels.cache.get(ic.ch) : null;
  if (ch && ic.leave) ch.send({ embeds: [E(gid, '🚪 Adiós', fmt(ic.leave, { user: m.user.tag, inviter: r ? `<@${r.by}>` : 'desconocido', server: m.guild.name, members: m.guild.memberCount }), ic.img).setThumbnail(m.displayAvatarURL())] }).catch(() => {});
  lg(gid, 'general', logCard(gid, `📤 ${m.user.username} salió`, [['⏱️', 'Estuvo en el servidor', durTxt(Date.now() - (m.joinedTimestamp ?? Date.now()))], ['📨', 'Lo había invitado', r?.by ? `<@${r.by}>` : '❓ Desconocido'],
    ['🎭', 'Roles', m.roles?.cache?.filter(x => x.id !== m.guild.id).map(x => `${x}`).join(' ') || '—']], { user: m.user, color: '#ED4245' }), 'miembros', 'salidas');
});
const imgAtt = m => [...(m.attachments?.values?.() || [])].find(x => (x.contentType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(x.name || ''));
eventHandler.on('messageDelete', async m => {
  if (!m.guild || m.author?.bot) return;
  const au = m.author, files = [...(m.attachments?.values?.() || [])], img = imgAtt(m);
  const en = au ? await aud(m.guild, AuditLogEvent.MessageDelete, au.id, 6000) : null;
  lg(m.guildId, 'general', logCard(m.guildId, `🗑️ Mensaje de ${au?.username || 'alguien'} borrado`, [
    ['👤', 'Autor', au ? `${au}` : '❓ Desconocido'], ['🛡️', 'Borrado por', en?.executor ? `${en.executor}` : (au ? 'El propio autor (o no se pudo saber)' : '❓ Desconocido')],
    ['📍', 'Canal', `${m.channel}`], ['💬', 'Contenido', (m.content || '—').slice(0, 1000)],
    files.length ? ['📎', 'Archivos', files.map(x => `[${x.name}](${x.url})`).join('\n').slice(0, 900)] : null], { user: au, actor: en?.executor, color: '#ED4245', image: img?.url }), 'mensajes');
});
eventHandler.on('messageUpdate', (a, b) => {
  if (b.guild && (b.author?.id === DISBOARD_ID || a.author?.id === DISBOARD_ID)) { (b.partial ? b.fetch() : Promise.resolve(b)).then(disboardBump).catch(() => {}); return; }
  if (!a.guild || a.author?.bot || a.content === b.content) return;
  lg(a.guildId, 'general', logCard(a.guildId, `✏️ ${a.author?.username || 'Alguien'} editó un mensaje`, [['👤', 'Autor', `${a.author}`], ['📍', 'Canal', `${a.channel} · [Ir al mensaje](${b.url})`],
    ['⬅️', 'Antes', (a.content || '—').slice(0, 800)], ['➡️', 'Después', (b.content || '—').slice(0, 800)]], { user: a.author, color: '#F1C40F', image: imgAtt(b)?.url }), 'mensajes');
});
eventHandler.on('guildBanAdd', async b => {
  const en = await aud(b.guild, AuditLogEvent.MemberBanAdd, b.user.id);
  lg(b.guild.id, 'general', logCard(b.guild.id, `🔨 ${b.user.username} fue baneado`, [['🛡️', 'Baneado por', whoTxt(en)], ['📝', 'Razón', b.reason || whyTxt(en)], ['👤', 'Usuario', `${b.user}`]], { user: b.user, actor: en?.executor, color: '#ED4245' }), 'bans');
  nuke(b.guild, AuditLogEvent.MemberBanAdd);
});
eventHandler.on('guildBanRemove', async b => {
  const en = await aud(b.guild, AuditLogEvent.MemberBanRemove, b.user.id);
  lg(b.guild.id, 'general', logCard(b.guild.id, `♻️ ${b.user.username} fue desbaneado`, [['🛡️', 'Desbaneado por', whoTxt(en)], ['📝', 'Razón', whyTxt(en)], ['👤', 'Usuario', `${b.user}`]], { user: b.user, actor: en?.executor, color: '#57F287' }), 'bans');
});
eventHandler.on('roleCreate', async r => {
  const en = await aud(r.guild, AuditLogEvent.RoleCreate, r.id);
  lg(r.guild.id, 'general', logCard(r.guild.id, `🎭 Rol creado: ${r.name}`, [['🛡️', 'Creado por', whoTxt(en)], ['🎭', 'Rol', `${r}`], ['📝', 'Razón', whyTxt(en)]], { user: en?.executor, actor: en?.executor, color: '#57F287' }), 'roles');
});
eventHandler.on('roleDelete', async r => {
  const en = await aud(r.guild, AuditLogEvent.RoleDelete, r.id);
  lg(r.guild.id, 'general', logCard(r.guild.id, `🎭 Rol eliminado: ${r.name}`, [['🛡️', 'Eliminado por', whoTxt(en)], ['📝', 'Razón', whyTxt(en)]], { user: en?.executor, actor: en?.executor, color: '#ED4245' }), 'roles');
  nuke(r.guild, AuditLogEvent.RoleDelete);
});
eventHandler.on('channelCreate', async c => {
  if (!c.guild) return; const en = await aud(c.guild, AuditLogEvent.ChannelCreate, c.id);
  lg(c.guild.id, 'general', logCard(c.guild.id, `📁 Canal creado: ${c.name}`, [['🛡️', 'Creado por', whoTxt(en)], ['📍', 'Canal', `${c}`], ['📝', 'Razón', whyTxt(en)]], { user: en?.executor, actor: en?.executor, color: '#57F287' }), 'canales');
});
eventHandler.on('channelDelete', async c => {
  if (!c.guild) return; const en = await aud(c.guild, AuditLogEvent.ChannelDelete, c.id);
  lg(c.guild.id, 'general', logCard(c.guild.id, `📁 Canal eliminado: #${c.name}`, [['🛡️', 'Eliminado por', whoTxt(en)], ['📝', 'Razón', whyTxt(en)]], { user: en?.executor, actor: en?.executor, color: '#ED4245' }), 'canales');
  nuke(c.guild, AuditLogEvent.ChannelDelete);
});
eventHandler.on('guildMemberUpdate', async (a, b) => {
  const add = b.roles.cache.filter(r => !a.roles.cache.has(r.id)), rem = a.roles.cache.filter(r => !b.roles.cache.has(r.id));
  if (add.size || rem.size) {
    const en = await aud(b.guild, AuditLogEvent.MemberRoleUpdate, b.id);
    lg(b.guild.id, 'general', logCard(b.guild.id, `🎭 Roles de ${b.user.username} cambiaron`, [['🛡️', 'Cambiado por', whoTxt(en)], ['👤', 'Miembro', `${b}`],
      add.size ? ['➕', 'Roles añadidos', add.map(r => `${r}`).join(' ')] : null, rem.size ? ['➖', 'Roles quitados', rem.map(r => `${r}`).join(' ')] : null,
      ['📝', 'Razón', whyTxt(en)]], { user: b.user, actor: en?.executor, color: '#5865F2' }), 'roles');
  }
  if (a.nickname !== b.nickname) {
    const en = await aud(b.guild, AuditLogEvent.MemberUpdate, b.id);
    lg(b.guild.id, 'general', logCard(b.guild.id, `📝 Apodo de ${b.user.username} cambiado`, [['🛡️', 'Cambiado por', en?.executor ? `${en.executor}` : 'El propio usuario (o no se pudo saber)'], ['⬅️', 'Antes', a.nickname || '—'], ['➡️', 'Después', b.nickname || '—'],
      en?.reason ? ['📝', 'Razón', en.reason] : null], { user: b.user, actor: en?.executor, color: '#F1C40F' }), 'miembros', 'apodos');
  }
});
/* ---- LOGS DE VOZ: cada acción se manda a su propio canal ----
   voz_mover (cambió de canal) · voz_desconexion (salió de voz) · voz_mute (micrófono) · voz_sordo (audio)
   Si un tipo no tiene canal, cae al canal "general". SOLO se registran las acciones hechas por un staff/moderador
   (persona con rol y el permiso de esa acción): mover, desconectar, mutear y ensordecer a otro usuario.
   Lo que el usuario se hace a sí mismo (autodesconexión, automute, autosordo) ya NO se loguea.
   Para saber quién fue, el bot necesita el permiso "Ver registro de auditoría". */
const VAUD = new Map(); // por servidor+tipo: última entrada de auditoría vista (mover/desconectar no dicen a quién, se detecta por contador)
const espera = ms => new Promise(r => setTimeout(r, ms));
const vozActivo = (gid, tipo) => { const cf = C(gid); return !cf.logoff.includes(tipo) && !!(cf.logch[tipo] || cf.logch.general); };
// ¿el autor de la acción es un staff/moderador de verdad? Persona (no bot), distinta del afectado, con algún rol
// (o dueño) y con el permiso que exige la acción (Administrador siempre vale).
async function vozStaff(guild, user, permiso, afectadoId) {
  if (!user || user.bot || user.id === afectadoId) return null;
  const mem = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
  if (!mem) return null;
  const esDueno = guild.ownerId === mem.id;
  if (!esDueno && mem.roles.cache.size <= 1) return null; // solo @everyone = sin roles
  return esDueno || mem.permissions.has(P.Administrator) || mem.permissions.has(permiso) ? mem : null;
}
const vozRol = mem => mem.guild.ownerId === mem.id ? '👑 dueño' : `🛡️ ${mem.roles.highest.name}`;
async function vozModerador(guild, tipo, afectadoId) { // mover/desconectar: ¿lo hizo un staff?
  try {
    if (!guild.members.me?.permissions.has(P.ViewAuditLog)) return null;
    await espera(1200); // Discord tarda un instante en escribir la auditoría
    const e = (await guild.fetchAuditLogs({ type: tipo, limit: 1 })).entries.first(); if (!e) return null;
    const k = `${guild.id}:${tipo}`, now = Date.now(), n = Number(e.extra?.count) || 1;
    const s = VAUD.get(k) || { id: null, n: 0, credito: 0, ts: 0 };
    if (now - s.ts > 15000) s.credito = 0; // los créditos viejos caducan
    const nuevo = s.id === null ? (now - e.createdTimestamp < 10000 ? n : 0) : e.id !== s.id ? n : Math.max(0, n - s.n);
    s.id = e.id; s.n = n; s.credito += nuevo; s.ts = now;
    const por = s.credito > 0 ? e.executor : null; if (por) s.credito--; // un crédito por usuario afectado (sirve para mover a varios a la vez)
    VAUD.set(k, s); return await vozStaff(guild, por, P.MoveMembers, afectadoId);
  } catch { return null; }
}
async function vozModeradorEstado(guild, userId, clave, permiso) { // mute/sordo del servidor: la auditoría sí trae al afectado
  try {
    if (!guild.members.me?.permissions.has(P.ViewAuditLog)) return null;
    await espera(1200);
    const lg = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 10 });
    const por = lg.entries.find(x => x.target?.id === userId && Date.now() - x.createdTimestamp < 10000 && x.changes?.some(c => c.key === clave))?.executor || null;
    return await vozStaff(guild, por, permiso, userId);
  } catch { return null; }
}
function vozLog(m, tipo, titulo, color, lineas) {
  const e = E(m.guild.id, titulo, lineas.filter(Boolean).join('\n')).setColor(color)
    .setThumbnail(m.displayAvatarURL({ size: 128 })).setFooter({ text: `${m.user.tag} · ID ${m.id}` });
  lg(m.guild.id, tipo, e, tipo);
}
async function vozLogs(a, b) {
  const m = b.member || a.member; if (!m) return; const g = m.guild, u = `**Usuario:** ${m} (\`${m.user.tag}\`)`;
  if (a.channelId !== b.channelId) {
    if (!a.channelId) return lg(g.id, 'general', E(g.id, '🔊 Voz', `${m} entró a **${b.channel.name}**`), 'voz'); // entrar sigue yendo al canal general
    if (!b.channelId) { // 🔌 desconexión
      if (!vozActivo(g.id, 'voz_desconexion')) return;
      const por = await vozModerador(g, AuditLogEvent.MemberDisconnect, m.id);
      if (!por) return; // se salió él solo / se cayó / lo hizo un bot o alguien sin permisos → no se loguea
      return vozLog(m, 'voz_desconexion', '🔌 Usuario desconectado', 0xED4245, [u, `**Canal:** ${a.channel}`,
        `**Desconectado por:** ${por} (${vozRol(por)})`]);
    }
    if (!vozActivo(g.id, 'voz_mover')) return; // 🔀 mover de canal
    const por = await vozModerador(g, AuditLogEvent.MemberMove, m.id);
    if (!por) return; // se cambió él mismo → no se loguea
    return vozLog(m, 'voz_mover', '🔀 Cambio de canal de voz', 0x5865F2, [u, `**Desde:** ${a.channel}`, `**Hacia:** ${b.channel}`,
      `**Movido por:** ${por} (${vozRol(por)})`]);
  }
  if (!b.channelId) return; // mute y sordo solo cuentan si sigue dentro del mismo canal
  const ch = `**Canal:** ${b.channel}`;
  if (a.serverMute !== b.serverMute && vozActivo(g.id, 'voz_mute')) { // 🔇 mute del servidor
    const por = await vozModeradorEstado(g, m.id, 'mute', P.MuteMembers);
    if (por) vozLog(m, 'voz_mute', b.serverMute ? '🔇 Silenciado por el staff' : '🔈 Silencio quitado por el staff', b.serverMute ? 0xED4245 : 0x57F287,
      [u, ch, `**Por:** ${por} (${vozRol(por)})`]);
  }
  if (a.serverDeaf !== b.serverDeaf && vozActivo(g.id, 'voz_sordo')) { // 🙉 sordo del servidor
    const por = await vozModeradorEstado(g, m.id, 'deaf', P.DeafenMembers);
    if (por) vozLog(m, 'voz_sordo', b.serverDeaf ? '🙉 Ensordecido por el staff' : '🔊 Sordera quitada por el staff', b.serverDeaf ? 0xED4245 : 0x57F287,
      [u, ch, `**Por:** ${por} (${vozRol(por)})`]);
  }
}
eventHandler.on('voiceStateUpdate', async (a, b) => {
  try { achVoiceEvt(a, b); } catch (e) { console.warn('[logros]', e.message); } // micro / cámara / stream encendidos
  vozLogs(a, b).catch(err => console.warn('[logs-voz]', err.message)); // sin await: espera a la auditoría y no debe retrasar lo de abajo
  if (a.channelId === b.channelId) return;
  await vcCreateHandler(b).catch(err => console.warn('[crea-tu-vc]', err.message));
  await vcCleanupHandler(a).catch(err => console.warn('[crea-tu-vc]', err.message));
  await vcGateHandler(b).catch(err => console.warn('[crea-tu-vc]', err.message));
});


/* ---- LOGS NUEVOS: cada evento a su propio canal (se crean con /log servidor) ---- */
const lk = (guild, key, e) => guild && lg(guild.id, 'general', e, null, key);
eventHandler.on('messageReactionAdd', (r, u) => { if (!r.message.guildId || u.bot) return; lk(r.message.guild, 'reacciones', E(r.message.guildId, '😀 Reacción añadida', `${u} reaccionó con ${r.emoji} en ${r.message.channel ?? ''}\n[Ir al mensaje](${r.message.url})`)); });
eventHandler.on('messageReactionRemove', (r, u) => { if (!r.message.guildId || u.bot) return; lk(r.message.guild, 'reacciones', E(r.message.guildId, '😶 Reacción quitada', `${u} quitó ${r.emoji} en ${r.message.channel ?? ''}\n[Ir al mensaje](${r.message.url})`)); });
eventHandler.on('threadCreate', (t, nuevo) => nuevo && lk(t.guild, 'hilos', E(t.guild.id, '🧵 Hilo creado', `${t} en <#${t.parentId}>`)));
eventHandler.on('threadDelete', t => lk(t.guild, 'hilos', E(t.guild.id, '🧵 Hilo eliminado', `**${t.name}**`)));
eventHandler.on('messageCreate', m => { if (m.guild && m.poll) lk(m.guild, 'encuestas', E(m.guildId, '📊 Encuesta creada', `**${m.author}** en ${m.channel}\n**${m.poll.question?.text ?? ''}**\n[Ir al mensaje](${m.url})`)); });
eventHandler.on('voiceStateUpdate', (a, b) => {
  const m = b.member || a.member; if (!m || m.user.bot) return;
  if (a.streaming !== b.streaming) lk(m.guild, 'streams', E(m.guild.id, b.streaming ? '🖥️ Stream iniciado' : '🖥️ Stream terminado', `${m} en **${(b.channel || a.channel)?.name ?? '—'}**`));
  if (a.selfVideo !== b.selfVideo) lk(m.guild, 'streams', E(m.guild.id, b.selfVideo ? '📷 Cámara encendida' : '📷 Cámara apagada', `${m} en **${(b.channel || a.channel)?.name ?? '—'}**`));
});
eventHandler.on('guildScheduledEventCreate', ev => lk(ev.guild, 'eventos', E(ev.guildId, '📅 Evento creado', `**${ev.name}**\nInicia <t:${Math.floor((ev.scheduledStartTimestamp ?? Date.now()) / 1000)}:F>`)));
eventHandler.on('guildScheduledEventDelete', ev => lk(ev.guild, 'eventos', E(ev.guildId, '📅 Evento eliminado', `**${ev.name}**`)));
eventHandler.on('guildScheduledEventUpdate', (a, b) => a && b && a.status !== b.status && lk(b.guild, 'eventos', E(b.guildId, '📅 Evento actualizado', `**${b.name}** cambió de estado (${a.status} → ${b.status})`)));
eventHandler.on('roleUpdate', (a, b) => { if (a.permissions.bitfield !== b.permissions.bitfield) lk(b.guild, 'permisos', E(b.guild.id, '🔐 Permisos de rol cambiados', `${b} (${b.name})`)); });
const _ow = c => c.permissionOverwrites?.cache.map(o => `${o.id}:${o.allow.bitfield}:${o.deny.bitfield}`).sort().join('|');
eventHandler.on('channelUpdate', (a, b) => { if (b.guild && _ow(a) !== _ow(b)) lk(b.guild, 'permisos', E(b.guild.id, '🔐 Permisos de canal cambiados', `${b}`)); });
eventHandler.on('guildUpdate', (a, b) => {
  const ch = []; if (a.name !== b.name) ch.push(`**Nombre:** ${a.name} → ${b.name}`); if (a.icon !== b.icon) ch.push('**Icono** cambiado'); if (a.banner !== b.banner) ch.push('**Banner** cambiado');
  if (a.verificationLevel !== b.verificationLevel) ch.push('**Nivel de verificación** cambiado'); if (a.systemChannelId !== b.systemChannelId) ch.push('**Canal del sistema** cambiado');
  if (ch.length) lk(b, 'servidor', E(b.id, '⚙️ Servidor actualizado', ch.join('\n')));
});
eventHandler.on('webhooksUpdate', c => c.guild && lk(c.guild, 'webhooks', E(c.guild.id, '🪝 Webhooks actualizados', `En ${c}`)));
eventHandler.on('guildIntegrationsUpdate', gu => lk(gu, 'integraciones', E(gu.id, '🔌 Integraciones actualizadas', 'Se añadió, quitó o cambió una integración.')));
eventHandler.on('emojiCreate', e => lk(e.guild, 'emojis', E(e.guild.id, '😄 Emoji creado', `${e} \`:${e.name}:\``)));
eventHandler.on('emojiDelete', e => lk(e.guild, 'emojis', E(e.guild.id, '😄 Emoji eliminado', `\`:${e.name}:\``)));
eventHandler.on('emojiUpdate', (a, b) => a.name !== b.name && lk(b.guild, 'emojis', E(b.guild.id, '😄 Emoji renombrado', `\`:${a.name}:\` → ${b} \`:${b.name}:\``)));
eventHandler.on('stickerCreate', s => s.guild && lk(s.guild, 'emojis', E(s.guild.id, '🏷️ Sticker creado', `**${s.name}**`)));
eventHandler.on('stickerDelete', s => s.guild && lk(s.guild, 'emojis', E(s.guild.id, '🏷️ Sticker eliminado', `**${s.name}**`)));
eventHandler.on('guildMemberUpdate', (a, b) => {
  if (b.user.bot) return;
  if (a.communicationDisabledUntilTimestamp !== b.communicationDisabledUntilTimestamp) {
    const hasta = b.communicationDisabledUntilTimestamp, on = hasta && hasta > Date.now();
    aud(b.guild, AuditLogEvent.MemberUpdate, b.id).then(en => lk(b.guild, 'timeout', logCard(b.guild.id, on ? `⏳ ${b.user.username} recibió timeout` : `✅ Timeout de ${b.user.username} quitado`,
      [['🛡️', on ? 'Aplicado por' : 'Quitado por', whoTxt(en)], ['👤', 'Miembro', `${b}`], on ? ['⏰', 'Hasta', `<t:${Math.floor(hasta / 1000)}:F> (<t:${Math.floor(hasta / 1000)}:R>)`] : null, ['📝', 'Razón', whyTxt(en)]],
      { user: b.user, actor: en?.executor, color: on ? '#E67E22' : '#57F287' })));
  }
  const pf = []; if (a.avatar !== b.avatar) pf.push('Avatar del servidor cambiado'); if (a.pending && !b.pending) pf.push('Completó la pantalla de acceso (reglas)');
  if (pf.length) lk(b.guild, 'perfil_acceso', E(b.guild.id, '👤 Perfil / acceso', `${b}\n${pf.join('\n')}`).setThumbnail(b.displayAvatarURL()));
});
eventHandler.on('guildMemberRemove', async m => {
  const lgs = await m.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 3 }).catch(() => null);
  const e = lgs?.entries.find(x => x.target?.id === m.id && Date.now() - x.createdTimestamp < 8000);
  if (e) lk(m.guild, 'expulsiones', logCard(m.guild.id, `👢 ${m.user.username} fue expulsado`, [['🛡️', 'Expulsado por', `${e.executor}`], ['📝', 'Razón', e.reason || 'Sin razón'], ['👤', 'Usuario', `${m.user}`]], { user: m.user, actor: e.executor, color: '#ED4245' }));
});
eventHandler.on('guildMemberAdd', m => {
  const dias = Math.floor((Date.now() - m.user.createdTimestamp) / 864e5);
  lk(m.guild, 'bienvenida', E(m.guild.id, '👋 Bienvenida enviada', `${m} (${m.user.tag})\nMiembro número **${m.guild.memberCount}**`).setThumbnail(m.displayAvatarURL()));
  lk(m.guild, 'alertas_incorporate', E(m.guild.id, '🚪 Nuevo miembro', `${m} (${m.user.tag})\n**Cuenta creada:** <t:${Math.floor(m.user.createdTimestamp / 1000)}:R> (${dias} días)${m.user.bot ? '\n🤖 Es un bot' : ''}`));
  if (dias < 7 && !m.user.bot) lk(m.guild, 'anti_alt', E(m.guild.id, '🕵️ Cuenta nueva', `${m} (${m.user.tag})\nCuenta de solo **${dias}** día(s). Posible alt.`).setColor('#FEE75C'));
});

dbPronta.then(async () => {
  let migratedVoice = false;
  for (const [guildId, data] of Object.entries(DB)) {
    const cf = data?.cfg || {};
    if (cf.musicChannelDisabled) { music.setGuildChannel(guildId, null, false); continue; }
    const channelId = cf.musicChannelId || cf.c247?.ch;
    if (!channelId) continue;
    music.setGuildChannel(guildId, channelId, false);
    if (cf.musicChannelId !== channelId || cf.c247) { cf.musicChannelId = channelId; delete cf.c247; migratedVoice = true; }
  }
  if (migratedVoice) save();
  dashboard = dashboardServer({ client, config, DB, G, C, save, CATS, choices: CHO, permissions: P, extraInteractions, music, activityCollection: mdb.collection('actividad') });
  await client.login(TOKEN);
}).catch(err => { console.error(`[startup] No pude iniciar el bot: ${err.message}`); return apagar(1); }); // carga MongoDB, dashboard y Discord en orden
/* ======================================================================
   PEGAR ESTE BLOQUE justo ANTES del comentario que dice «EVENTOS» (cerca del final del archivo).
   Añade: 16. BUMP · 17. CONFESIONES · 18. PINTEREST / IMÁGENES · 19. IA
   Opcional (variables de entorno):
     PEXELS_KEY      → imágenes de cualquier tema con Pexels (gratis en pexels.com/api). Sin ella usa Openverse.
     OPENAI_API_KEY  → imágenes IA con OpenAI. Sin ella usa Pollinations (gratis, sin clave).
     IA_MODEL        → modelo de OpenAI (por defecto gpt-image-1; también vale dall-e-3).
   ====================================================================== */

/* ---------- utilidades compartidas ---------- */
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)' };
const keep = (map, k, v) => { map.set(k, v); if (map.size > 300) map.delete(map.keys().next().value); };
async function getText(u, opt = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(u, { redirect: 'follow', ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
const getJson = async (u, opt) => JSON.parse(await getText(u, opt));
const canSendElsewhere = (i, ch) => !ch || ch.id === i.channelId || i.member.permissions.has(P.ManageMessages);

/* ============================== 16. BUMP (5) ============================== */
// Bump interno: publica el anuncio del servidor en el canal de bump (borrando el anterior), da recompensa,
// lleva ranking y avisa con un ping cuando toca el siguiente. Además detecta el /bump de DISBOARD y
// reinicia el contador solo (un bot no puede hacer bump en Disboard por ti; eso lo hace una persona).
const DISBOARD_ID = '302050872383242240';
const BC = cf => (cf.bump ??= { every: 120, reward: 50, dis: true });
// ---- Tarjetas del bump (mismo estilo que el ejemplo: título grande, cita, recompensas, pie) ----
// Emojis del bump: campana animada (recordatorio) y flechita (título del realce y pie)
const BUMP_BELL = '<a:campana:1571142674038394890>', BUMP_ARROW = '<:1452312428262981753:1571142640399818904>';
const tx = t => new TextDisplayBuilder().setContent(t);
const bsep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const bumpFoot = () => `-# ${BUMP_ARROW} Desarrollado por ${client.user?.username || 'este bot'}`;
const bumpRw = b => ({ coins: b.reward ?? 0, gems: b.gems ?? 0, xp: b.xp ?? 5 });
function bumpDonePayload(guild, user, b, cf, rw) {
  const rewards = [rw.coins > 0 && `+${fn(rw.coins)} Monedas ${cf.cur}`, rw.gems > 0 && `+${fn(rw.gems)} Gemas 💎`, rw.xp > 0 && `+${fn(rw.xp)} XP ✨`].filter(Boolean).join(', ');
  const quote = `> ¡El servidor fue realzado con éxito!\n> Vuelve ${when(b.every * 60000)} para realzar el servidor de nuevo. ¡Gracias por tu apoyo ${user}!`;
  const foot = `-# Realzado por ${user} · <t:${Math.floor(Date.now() / 1000)}:R>`;
  if (!ContainerBuilder || !SectionBuilder || !ThumbnailBuilder) return { embeds: [E(guild.id, `# ${BUMP_ARROW} | ¡Realce Exitoso!`, `${quote.replace(/^> /gm, '')}${rewards ? `\n\n🎁 **Recompensas Recibidas**\n${rewards}` : ''}\n\n${foot}`)], allowedMentions: { parse: [] } };
  const c = new ContainerBuilder().addSectionComponents(new SectionBuilder().addTextDisplayComponents(tx(`# ${BUMP_ARROW} | ¡Realce Exitoso!`), tx(quote))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ extension: 'png', size: 256 }))));
  if (rewards) c.addSeparatorComponents(bsep()).addTextDisplayComponents(tx(`🎁 **Recompensas Recibidas**\n**${rewards}**`));
  c.addSeparatorComponents(bsep()).addTextDisplayComponents(tx(foot)).addSeparatorComponents(bsep()).addTextDisplayComponents(tx(bumpFoot()));
  return { components: [c], flags: 1 << 15, allowedMentions: { parse: [] } };
}
// ---- Campana animada: el bot sube solo el emoji "campana_nueva" (GIF) la primera vez y lo reutiliza ----
const bellEmoji = async () => BUMP_BELL;
function bumpDuePayload(guild, b, bell = '🔔') {
  const quote = `> ¡El servidor está listo para el próximo realce!\n> ${b.rt || `Usa /bump ahora${b.dis ? ' (o el /bump de Disboard)' : ''} para apoyar el servidor.`}`, icon = guild.iconURL?.({ extension: 'png', size: 256 });
  if (!ContainerBuilder) return { content: b.role ? `<@&${b.role}>` : undefined, allowedMentions: { roles: b.role ? [b.role] : [] }, embeds: [E(guild.id, `${bell} | ¡Es hora de realzar!`, quote.replace(/^> /gm, ''))] };
  const c = new ContainerBuilder();
  if (icon && SectionBuilder && ThumbnailBuilder) c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(tx(`## ${bell} | ¡Es hora de realzar!`), tx(quote)).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)));
  else c.addTextDisplayComponents(tx(`## ${bell} | ¡Es hora de realzar!`), tx(quote));
  c.addSeparatorComponents(bsep()).addTextDisplayComponents(tx(bumpFoot()));
  return { components: b.role ? [tx(`<@&${b.role}>`), c] : [c], flags: 1 << 15, allowedMentions: { roles: b.role ? [b.role] : [] } };
}
const bumpGive = (gid, user, b, rw) => { const u = U(gid, user.id); u.bumps = (u.bumps || 0) + 1; u.coins += rw.coins; u.gems = (u.gems || 0) + rw.gems; b.total = (b.total || 0) + 1; save(); };
async function bumpXp(guild, user, xp, ch) {
  if (!(xp > 0)) return; const mem = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null); if (mem) await addXp(mem, xp, ch).catch(() => {});
}
def('bump', 'ahora', 'Haz bump: apoya al servidor y recibe recompensas', '', null, async (i, o, g, cf) => {
  const b = BC(cf); if (!b.ch) return no(i, 'Un admin debe configurar el canal con `/bump config`.');
  const left = (b.next || 0) - Date.now(); if (left > 0) return no(i, `Todavía no se puede hacer bump. Disponible ${when(left)}.`);
  const ch = i.guild.channels.cache.get(b.ch), ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar el bump: ${ci}.`);
  const prev = { last: b.last, next: b.next, notified: b.notified }; b.last = Date.now(); b.next = b.last + b.every * 60000; b.notified = false; // se fija ya para que dos bumps a la vez no cuenten doble
  const rw = bumpRw(b), p = bumpDonePayload(i.guild, i.user, b, cf, rw);
  try {
    await ch.send(p); // lo publica el BOT como mensaje normal (no como respuesta al comando del usuario)
    await i.reply({ flags: 64, embeds: [E(i.guildId, '✅ Bump hecho', `Publicado en ${ch}.`)] }); // confirmación privada, solo la ve quien usó /bump
  } catch (err) { Object.assign(b, prev); return no(i, `No pude publicar: ${err.message}`); }
  bumpGive(i.guildId, i.user, b, rw); bumpXp(i.guild, i.user, rw.xp, i.channel).catch(() => {}); // los mensajes del bump se quedan (no se borra ninguno)
});
def('bump', 'config', 'Canal, rol a avisar, intervalo, premio y detección de Disboard', 'canal:c,rol:r,minutos:i,premio:i,gemas:i,xp:i,disboard:b,recordatorio:s', 'ManageGuild', (i, o, g, cf) => {
  const b = BC(cf);
  if (o.canal) { const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo usar ${o.canal}: ${ci}.`); b.ch = o.canal.id; }
  if (!b.ch) return no(i, 'Indica un `canal` la primera vez.');
  let warn = '';
  if (o.rol) { b.role = o.rol.id; if (!o.rol.mentionable && !i.guild.members.me.permissions.has(P.MentionEveryone)) warn = `\n⚠️ ${o.rol} no es mencionable: hazlo mencionable o dale al bot el permiso **Mencionar @everyone**.`; }
  if (o.minutos != null) { if (o.minutos < 10 || o.minutos > 1440) return no(i, '`minutos` debe estar entre 10 y 1440 (Disboard usa 120).'); b.every = o.minutos; }
  if (o.premio != null) b.reward = Math.max(0, o.premio);
  if (o.gemas != null) b.gems = Math.max(0, o.gemas);
  if (o.xp != null) b.xp = Math.max(0, o.xp);
  if (o.disboard != null) b.dis = o.disboard;
  if (o.recordatorio) b.rt = nl(o.recordatorio);
  save();
  ok(i, `📍 Canal: <#${b.ch}>\n🔔 Rol: ${b.role ? `<@&${b.role}>` : '—'}\n⏱️ Intervalo: **${b.every} min**\n🎁 Premio: **${b.reward}** ${cf.cur} · **${b.gems ?? 0}** gemas · **${b.xp ?? 5}** XP\n💜 Detectar /bump de Disboard: **${b.dis ? 'sí' : 'no'}**${warn}`);
});
def('bump', 'estado', 'Cuándo toca el próximo bump', '', null, (i, o, g, cf) => {
  const b = BC(cf); if (!b.ch) return say(i, '📈 Bump', 'No configurado. Un admin debe usar `/bump config`.', true);
  say(i, '📈 Bump', `Canal: <#${b.ch}>\nBumps totales: **${b.total || 0}**\n${(b.next || 0) > Date.now() ? `⏳ Próximo bump ${when(b.next - Date.now())}` : '✅ **¡Ya se puede hacer bump!** Usa `/bump ahora`'}`);
});
def('bump', 'top', 'Ranking de bumpers', '', null, (i, o, g) => {
  const r = Object.entries(g.users).filter(([, u]) => u.bumps > 0).sort((a, b) => b[1].bumps - a[1].bumps).slice(0, 10);
  say(i, '🏆 Top bumpers', r.map((x, n) => `**${n + 1}.** <@${x[0]}> — **${x[1].bumps}** bumps`).join('\n') || 'Nadie ha hecho bump todavía.');
});
def('bump', 'desactivar', 'Apaga el sistema de bump', '', 'ManageGuild', (i, o, g, cf) => { delete cf.bump; save(); ok(i, 'Sistema de bump desactivado.'); });

const DBH = new Set();
async function disboardBump(m) {
  const cf = C(m.guildId), b = BC(cf); if (b.dis === false) return;
  const t = m.embeds.map(e => `${e.title || ''} ${e.description || ''}`).join(' ') + ' ' + (m.content || '');
  const done = /bump\s+(done|hecho|realizad|efectuad|effectu|r[ée]ussi)/i.test(t) || (/disboard/i.test(t) && /👍|:thumbsup:/.test(t));
  if (!done || DBH.has(m.id)) return; DBH.add(m.id); if (DBH.size > 50) DBH.delete(DBH.values().next().value);
  const who = m.interactionMetadata?.user ?? m.interaction?.user;
  b.last = Date.now(); b.next = b.last + b.every * 60000; b.notified = false; b.ch ||= m.channelId;
  const rw = bumpRw(b); if (who) bumpGive(m.guildId, who, b, rw); else { b.total = (b.total || 0) + 1; save(); }
  const user = who || { toString: () => 'un miembro', displayAvatarURL: () => m.guild.iconURL({ extension: 'png', size: 256 }) || client.user.displayAvatarURL({ extension: 'png', size: 256 }) };
  await m.channel.send(bumpDonePayload(m.guild, user, b, cf, who ? rw : { coins: 0, gems: 0, xp: 0 })).catch(err => console.warn(`[bump] no pude publicar: ${err.message}`));
  if (who) bumpXp(m.guild, who, rw.xp, m.channel).catch(() => {});
}
let bumpBusy = false;
async function bumpTick() {
  if (bumpBusy) return; bumpBusy = true;
  try {
    for (const [gid, g] of Object.entries(DB)) {
      const b = g.cfg?.bump; if (!b?.ch || !b.next || b.notified || Date.now() < b.next) continue;
      const guild = client.guilds.cache.get(gid), ch = guild?.channels.cache.get(b.ch); if (!ch) continue;
      b.notified = true; save();
      await ch.send(bumpDuePayload(guild, b, await bellEmoji(guild))).catch(err => console.warn(`[bump] no pude avisar en ${b.ch}: ${err.message}`));
    }
  } finally { bumpBusy = false; }
}

/* ========================== 17. CONFESIONES (9) ========================== */
// Estilo Secretly: el BOT publica la confesión al instante en el canal (nadie ve quién la envía) y NADIE del staff la revisa.
// Panel con botón "Enviar" (se puede usar las veces que se quiera) · imagen opcional · color · permitir respuestas.
// El bot guarda el autor SOLO para moderar abusos (/confesion autor, solo admins y queda en logs). `/confesion guardar estado:false` = 100% anónimo.
const CFC = cf => (cf.conf ??= { store: true });
const CFD = g => (g.conf ??= { n: 0, items: {}, ban: [] });
const CF_COLORS = { rosa: 0xEB459E, rojo: 0xED4245, naranja: 0xE67E22, amarillo: 0xFEE75C, verde: 0x57F287, azul: 0x3498DB, morado: 0x9B59B6, blanco: 0xFFFFFF };
const CF_NAMES = { random: 'Random', rosa: 'Rosa', rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo', verde: 'Verde', azul: 'Azul', morado: 'Morado', blanco: 'Blanco' };
const cfColor = k => CF_COLORS[k] ?? 0x4f545c; // sin color elegido = gris, como en el diseño
// Botones: panel = [Dejar Confesión] · cada confesión = [Dejar Confesión] [Responder]
const cfRow = (n, likes = 0, noreply = false) => {
  const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cf_open').setLabel('· Dejar Confesión').setEmoji('🤔').setStyle(ButtonStyle.Secondary));
  if (n && !noreply) r.addComponents(new ButtonBuilder().setCustomId(`cf_re_${n}`).setLabel('· Responder').setEmoji('😒').setStyle(ButtonStyle.Secondary));
  return r;
};
const cfBrand = gid => CFC(C(gid)).brand || 'Kuboq';
const cfAuthor = gid => ({ name: `${cfBrand(gid)} · Anónimo` });
// Confesión: autor "Kuboq · Anónimo", título, texto, "Respuesta anónima" (si responde), imagen y pie
function cfPayload(gid, n, text, likes = 0, re = null, color = 0x4f545c, imgName = null, noreply = false) {
  const e = new EmbedBuilder().setColor(color).setAuthor(cfAuthor(gid)).setTitle(`Anónimo #${n}`).setDescription(text)
    .setFooter({ text: 'Pulsa Enviar para compartir sin mostrar tu nombre.' });
  if (re) e.addFields({ name: 'Respuesta anónima', value: `\`\`\`ansi\n\u001b[2;31mA la publicación #${re}\u001b[0m\n\`\`\`` });
  if (imgName) e.setImage(`attachment://${imgName}`);
  return { embeds: [e], components: [cfRow(n, likes, noreply)], allowedMentions: { parse: [] } };
}
async function publishConfession(guild, n, text, img) {
  const c = CFC(C(guild.id)), d = CFD(G(guild.id)), ch = guild.channels.cache.get(c.ch), ci = chIssue(guild, ch); if (ci) throw new Error(ci);
  const it = d.items[n], ref = it.re && d.items[it.re]?.msg;
  const m = await ch.send({ ...cfPayload(guild.id, n, text, 0, it.re, it.color, img?.name, it.noreply),
    ...(img ? { files: [new AttachmentBuilder(img.buf, { name: img.name })] } : {}),
    ...(ref ? { reply: { messageReference: ref, failIfNotExists: false } } : {}) });
  Object.assign(it, { msg: m.id, status: 'ok' }); delete it.text; save(); return m;
}
// Formulario "Enviar secretamente": mensaje, imagen (opcional), color y permitir respuestas. Si tu discord.js es antiguo, cae a un formulario solo de texto.
function cfModal(basic) {
  const m = new ModalBuilder().setCustomId('cf_modal').setTitle('Enviar secretamente');
  const txt = new TextInputBuilder().setCustomId('text').setPlaceholder('¿Qué quieres compartir?').setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1800).setRequired(true);
  const simple = () => m.addComponents(new ActionRowBuilder().addComponents(txt.setLabel('¿Qué quieres confesar?')));
  if (basic || !LabelBuilder || !FileUploadBuilder) return simple();
  try {
    const col = new StringSelectMenuBuilder().setCustomId('color').addOptions(Object.entries(CF_NAMES).map(([value, label]) => ({ label, value, default: value === 'random' })));
    const lb = [
      new LabelBuilder().setLabel('Escribe tu mensaje secreto').setTextInputComponent(txt),
      new LabelBuilder().setLabel('Imagen (opcional)').setFileUploadComponent(new FileUploadBuilder().setCustomId('image').setRequired(false).setMinValues(0).setMaxValues(1)),
      new LabelBuilder().setLabel('Color').setStringSelectMenuComponent(col),
    ];
    if (CheckboxBuilder && LabelBuilder.prototype.setCheckboxComponent) lb.push(new LabelBuilder().setLabel('Permitir respuestas').setCheckboxComponent(new CheckboxBuilder().setCustomId('replies').setDefault(true)));
    else lb.push(new LabelBuilder().setLabel('Permitir respuestas').setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('replies').addOptions({ label: 'Sí', value: 'si', default: true }, { label: 'No', value: 'no' })));
    return m.addLabelComponents(...lb);
  } catch { return simple(); }
}
const cfShowModal = async i => { try { await i.showModal(cfModal()); } catch (err) { console.warn('[confesiones] formulario avanzado no disponible:', err.message); await i.showModal(cfModal(true)); } };
function cfOpts(i) { // lee color, respuestas e imagen del formulario (todo opcional)
  const o = {}, f = k => { try { return i.fields.fields.get(k); } catch { return null; } };
  o.color = f('color')?.values?.[0];
  const r = f('replies'); if (r) o.noreply = typeof r.value === 'boolean' ? !r.value : r.values?.[0] === 'no';
  try { o.att = i.fields.getUploadedFiles('image', false)?.first() || null; } catch { o.att = null; }
  return o;
}
async function submitConfession(i, raw, re, o = {}) {
  const g = G(i.guildId), cf = C(i.guildId), c = CFC(cf), d = CFD(g);
  const fail = m => (i.deferred || i.replied) ? i.editReply({ embeds: [E(i.guildId, '❌ Error', m)] }) : no(i, m);
  if (!c.ch) return fail('Las confesiones no están configuradas. Un admin debe usar `/confesion setup`.');
  if (d.ban.includes(i.user.id)) return fail('No puedes enviar confesiones en este servidor.');
  const text = String(raw || '').replace(/@(everyone|here)/gi, '@\u200b$1').trim();
  if (text.length < 5 || text.length > 1800) return fail('La confesión debe tener entre 5 y 1800 caracteres.');
  if (/https?:\/\/|discord\.gg\/|www\./i.test(text)) return fail('Las confesiones no pueden incluir enlaces.');
  if (g.badwords.some(w => text.toLowerCase().includes(w))) return fail('Tu confesión contiene palabras no permitidas.');
  const ch = i.guild.channels.cache.get(c.ch), ci = chIssue(i.guild, ch);
  if (ci) { lg(i.guildId, 'general', E(i.guildId, '⚠️ Confesiones con problemas', `Canal de confesiones: ${ci}`)); return fail('No se puede publicar ahora mismo. Avisa a un administrador.'); }
  if (re && !d.items[re]?.msg) return fail('Esa confesión ya no existe, no puedes responderla.');
  if (re && d.items[re]?.noreply) return fail('Esa confesión no permite respuestas.');
  const u = U(i.guildId, i.user.id), r = cd(u, 'conf', 10000); if (r) return fail(`Espera un momento antes de enviar otra: ${when(r)}`);
  let img = null;
  if (o.att) { // el bot descarga la imagen y la vuelve a subir él mismo, así nadie ve quién la mandó
    const a = o.att;
    if (!String(a.contentType || '').startsWith('image/')) { u.cd.conf = 0; return fail('El archivo debe ser una imagen (png, jpg, gif, webp).'); }
    if (a.size > 8 * 1024 * 1024) { u.cd.conf = 0; return fail('La imagen pesa demasiado (máximo 8 MB).'); }
    await i.deferReply({ flags: 64 });
    try { const res = await fetch(a.url); if (!res.ok) throw new Error(`HTTP ${res.status}`); img = { buf: Buffer.from(await res.arrayBuffer()), name: `confesion.${(a.name?.split('.').pop() || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png'}` }; }
    catch (err) { u.cd.conf = 0; return fail(`No pude descargar la imagen: ${err.message}`); }
  }
  const n = ++d.n; d.items[n] = { uid: c.store === false ? null : i.user.id, status: 'ok', re: re || undefined, color: cfColor(o.color), noreply: o.noreply || undefined };
  const note = c.store === false ? '' : '\n-# Los administradores pueden consultar el autor solo en caso de abuso.';
  let pm; try { pm = await publishConfession(i.guild, n, text, img); } catch (err) { d.n--; delete d.items[n]; save(); u.cd.conf = 0; return fail(`No pude publicar: ${err.message}`); }
  const e = E(i.guildId, '🤫 Enviado', `Tu mensaje se publicó de forma anónima como **Anónimo #${n}**: ${pm.url}${note}`);
  return i.deferred ? i.editReply({ embeds: [e] }) : i.reply({ embeds: [e], flags: 64 });
}
const cfPanel = (gid, c) => {
  const e = new EmbedBuilder().setColor(0x4f545c).setAuthor(cfAuthor(gid)).setTitle('Confesiones')
    .setDescription('Para mandar una confesión solo tienes que pulsar el botón que dice **Dejar Confesión**.')
    .setFooter({ text: 'Pulsa Enviar para compartir sin mostrar tu nombre.' });
  if (url(c.img)) e.setImage(c.img);
  return { embeds: [e], components: [cfRow()] };
};
ROOT.add('confesiones');
def('confesiones', 'run', 'Publica el panel de confesiones anónimas y lo configura solo', 'canal:c,imagen:s,nombre:s,reportes:c', 'ManageGuild', async (i, o, g, cf) => {
  const c = CFC(cf), ch = o.canal ?? i.channel, ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar en ${ch}: ${ci}.`);
  if (o.reportes) { const ri = chIssue(i.guild, o.reportes); if (ri) return no(i, `No puedo usar ${o.reportes}: ${ri}.`); c.review = o.reportes.id; }
  if (o.nombre) c.brand = o.nombre.trim().slice(0, 30);
  if (o.imagen) { if (/^(quitar|ninguna)$/i.test(o.imagen.trim())) delete c.img; else if (url(o.imagen.trim())) c.img = o.imagen.trim(); else return no(i, 'La imagen debe ser un link que empiece con https://'); }
  c.ch = ch.id; save();
  try { await ch.send(cfPanel(i.guildId, c)); } catch (err) { return no(i, `No pude publicar el panel: ${err.message}`); }
  say(i, '✅ Listo', `Panel publicado en ${ch}. Las confesiones saldrán debajo, ya configuradas.\nNombre: **${cfBrand(i.guildId)} · Anónimo**${c.img ? '\nImagen del panel: guardada' : ''}`, true);
});
def('confesion', 'setup', 'Configura el canal de confesiones y publica el panel automáticamente', 'canal:c!,reportes:c', 'ManageGuild', async (i, o, g, cf) => {
  const c = CFC(cf), ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo usar ${o.canal}: ${ci}.`);
  if (o.reportes) { const ri = chIssue(i.guild, o.reportes); if (ri) return no(i, `No puedo usar ${o.reportes}: ${ri}.`); c.review = o.reportes.id; }
  c.ch = o.canal.id; save();
  try { await o.canal.send(cfPanel(i.guildId, c)); } catch (err) { return no(i, `Guardé el canal pero no pude publicar el panel: ${err.message}`); }
  ok(i, `Confesiones → ${o.canal} (panel publicado)\nPublicación: **instantánea, sin revisión del staff**\nReportes de usuarios: ${c.review ? `<#${c.review}>` : 'solo en los logs'}\nGuardar autor para moderar: **${c.store === false ? 'no (100% anónimo)' : 'sí'}**`);
});
def('confesion', 'panel', 'Vuelve a publicar el panel con el botón de confesar', 'canal:c', 'ManageGuild', async (i, o, g, cf) => {
  const c = CFC(cf), ch = o.canal ?? i.channel, ci = chIssue(i.guild, ch); if (ci) return no(i, `No puedo publicar ahí: ${ci}.`);
  await ch.send(cfPanel(i.guildId, c));
  ok(i, 'Panel enviado.');
});
def('confesion', 'enviar', 'Envía una confesión anónima', 'texto:s!', null, (i, o) => submitConfession(i, o.texto));
def('confesion', 'guardar', 'Guardar o no el autor (para moderar abusos)', 'estado:b!', 'Administrator', (i, o, g, cf) => {
  CFC(cf).store = o.estado; save(); ok(i, o.estado ? 'Se guarda el autor de las confesiones nuevas (solo consultable por admins con `/confesion autor`).' : 'Las confesiones nuevas **no** guardan autor: 100% anónimas, pero no podrás identificar abusos.');
});
def('confesion', 'autor', 'Revela el autor de una confesión (solo admins, queda en logs)', 'numero:i!', 'Administrator', (i, o, g) => {
  const it = CFD(g).items[o.numero]; if (!it) return no(i, 'No existe esa confesión.');
  if (!it.uid) return no(i, 'No se guardó el autor de esa confesión.');
  lg(i.guildId, 'mod', E(i.guildId, '🕵️ Autor de confesión consultado', `${i.user} consultó el autor de la confesión **#${o.numero}**.`));
  say(i, `🕵️ Confesión #${o.numero}`, `Autor: <@${it.uid}> (\`${it.uid}\`)\n-# Esta consulta quedó registrada en los logs de moderación.`, true);
});
def('confesion', 'borrar', 'Borra una confesión publicada', 'numero:i!', 'ManageMessages', async (i, o, g, cf) => {
  const it = CFD(g).items[o.numero]; if (!it || !it.msg) return no(i, 'No existe esa confesión publicada.');
  await i.guild.channels.cache.get(CFC(cf).ch)?.messages.delete(it.msg).catch(() => {}); it.status = 'deleted'; save(); ok(i, `Confesión #${o.numero} borrada.`);
});
def('confesion', 'bloquear', 'Impide que un usuario envíe confesiones', 'usuario:u!', 'ManageMessages', (i, o, g) => { const d = CFD(g); if (!d.ban.includes(o.usuario.id)) d.ban.push(o.usuario.id); save(); ok(i, `${o.usuario} ya no puede enviar confesiones.`); });
def('confesion', 'desbloquear', 'Permite de nuevo confesar a un usuario', 'usuario:u!', 'ManageMessages', (i, o, g) => { const d = CFD(g); d.ban = d.ban.filter(x => x !== o.usuario.id); save(); ok(i, `${o.usuario} puede confesar otra vez.`); });
def('confesion', 'estado', 'Ver la configuración de confesiones', '', 'ManageGuild', (i, o, g, cf) => {
  const c = CFC(cf), d = CFD(g);
  say(i, '🤫 Confesiones', `Canal: ${c.ch ? `<#${c.ch}>` : '—'}\nReportes: ${c.review ? `<#${c.review}>` : 'solo logs'} · Publicación: instantánea\nGuardar autor: **${c.store === false ? 'no' : 'sí'}**\nPublicadas: **${Object.values(d.items).filter(x => x.status === 'ok').length}**\nBloqueados: **${d.ban.length}**`, true);
});

/* ================== 18. PINTEREST E IMÁGENES DE TODO (8) ================== */
// - tablero/auto: lee tableros PÚBLICOS de Pinterest por su feed RSS oficial (Pinterest no tiene búsqueda pública gratuita).
// - pin: muestra la imagen de un pin concreto (enlace pinterest.com/pin/... o pin.it/...).
// - buscar: imágenes de CUALQUIER tema con Pexels (si defines PEXELS_KEY) u Openverse (sin clave).
const PN = cf => (cf.pin ??= { boards: {}, auto: {} });
const PSM = new Map(), PC = new Map();
function pinRss(s) {
  try {
    const u = new URL(String(s).trim()); if (!/(^|\.)pinterest\.[a-z.]+$/i.test(u.hostname)) return null;
    const p = u.pathname.replace(/\.rss$/i, '').split('/').filter(Boolean);
    if (!p.length || ['pin', 'search', 'ideas', 'today', 'business', 'settings'].includes(p[0])) return null;
    return p.length === 1 ? `https://www.pinterest.com/${p[0]}/feed.rss` : `https://www.pinterest.com/${p[0]}/${p[1]}.rss`;
  } catch { return null; }
}
async function pinItems(rss) {
  const c = PC.get(rss); if (c && Date.now() - c.t < 6e5) return c.items;
  const x = await getText(rss), items = [];
  for (const raw of x.split('<item>').slice(1)) {
    const it = raw.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const img = (it.match(/src=["'](https:\/\/i\.pinimg\.com\/[^"']+)["']/i) || [])[1]; if (!img) continue;
    items.push({ img: img.replace(/\/\d+x\d*\//, '/736x/'), link: (it.match(/<link>\s*([^<\s]+)\s*<\/link>/) || [])[1],
      title: ((it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '').trim() });
  }
  if (!items.length) throw new Error('el tablero está vacío, es privado, o Pinterest bloqueó la lectura');
  PC.set(rss, { t: Date.now(), items }); return items;
}
async function pinPage(u) {
  let h; try { h = new URL(u).hostname; } catch { throw new Error('enlace no válido'); }
  if (!/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/i.test(h)) throw new Error('el enlace no es de Pinterest');
  const html = await getText(u), meta = p => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i')) || [])[1];
  const img = meta('og:image'); if (!img) throw new Error('no pude leer la imagen de ese pin (¿es privado?)');
  return { img: img.replace(/&amp;/g, '&'), link: u, title: (meta('og:title') || '').replace(/&amp;/g, '&').slice(0, 200), src: 'Pinterest' };
}
async function stockImages(q) {
  if (process.env.PEXELS_KEY) {
    try {
      const r = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=40`, { headers: { Authorization: process.env.PEXELS_KEY } });
      const l = (r.photos || []).map(p => ({ img: p.src.large2x || p.src.large, link: p.url, title: p.alt, by: p.photographer, src: 'Pexels' }));
      if (l.length) return l;
    } catch (err) { console.warn('[pexels]', err.message); }
  }
  const r = await getJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=40&mature=false`);
  return (r.results || []).filter(x => url(x.url)).map(x => ({ img: x.url, link: x.foreign_landing_url, title: x.title, by: x.creator, src: 'Openverse' }));
}
const pinResolve = (cf, s) => PN(cf).boards[String(s).trim().toLowerCase()] ?? String(s).trim();
const pinKind = s => (pinRss(s) ? 'board' : 'topic');
async function pinFetch(kind, src) {
  if (kind === 'board') return (await pinItems(pinRss(src))).map(x => ({ ...x, src: 'Pinterest' }));
  if (kind === 'pin') return [await pinPage(src)];
  const l = await stockImages(src); if (!l.length) throw new Error('no encontré imágenes para ese tema'); return l;
}
function pinPayload(gid, items, more) {
  const es = items.map(it => {
    const e = new EmbedBuilder().setColor(it.src === 'Pinterest' ? '#E60023' : C(gid).color).setImage(it.img).setFooter({ text: [it.src, it.by].filter(Boolean).join(' · ').slice(0, 2048) });
    if (it.title) e.setTitle(String(it.title).slice(0, 250)); return e;
  });
  const row = new ActionRowBuilder();
  if (more) row.addComponents(new ButtonBuilder().setCustomId('pin_more').setLabel('Otra imagen').setEmoji('🔄').setStyle(ButtonStyle.Secondary));
  if (items.length === 1 && url(items[0].link)) row.addComponents(new ButtonBuilder().setLabel('Ver original').setStyle(ButtonStyle.Link).setURL(items[0].link));
  return { embeds: es, components: row.components.length ? [row] : [] };
}
async function pinSend(i, o, kind, src) {
  const dest = o.canal ?? i.channel;
  if (!canSendElsewhere(i, o.canal)) return no(i, 'Para enviar a otro canal necesitas **Gestionar mensajes**.');
  const ci = chIssue(i.guild, dest); if (ci) return no(i, `No puedo publicar en ${dest}: ${ci}.`);
  const here = dest.id === i.channelId; await i.deferReply({ flags: here ? undefined : 64 });
  let items; try { items = await pinFetch(kind, src); } catch (err) { return i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude obtener imágenes: ${err.message}`)] }); }
  const n = kind === 'pin' ? 1 : Math.min(6, Math.max(1, o.cantidad || 1)), pick = [...items].sort(() => Math.random() - 0.5).slice(0, n), more = kind !== 'pin' && n === 1;
  const p = pinPayload(i.guildId, pick, more);
  try {
    const m = here ? await i.editReply(p) : await dest.send(p); if (more) keep(PSM, m.id, { kind, src });
    if (!here) i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Imagen enviada a ${dest}`)] });
  } catch (err) { i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude publicar la imagen: ${err.message}`)] }).catch(() => {}); }
}
def('pinterest', 'buscar', 'Imagen de CUALQUIER tema (gatos, coches, anime, paisajes...)', 'tema:s!,cantidad:i,canal:c', null, (i, o) => pinSend(i, o, 'topic', o.tema));
def('pinterest', 'tablero', 'Imagen aleatoria de un tablero público de Pinterest (enlace o nombre guardado)', 'tablero:s!,cantidad:i,canal:c', null, (i, o, g, cf) => {
  const src = pinResolve(cf, o.tablero); if (!pinRss(src)) return no(i, 'Pega el enlace de un tablero **público** (pinterest.com/usuario/tablero) o un nombre guardado con `/pinterest guardar`.');
  return pinSend(i, o, 'board', src);
});
def('pinterest', 'pin', 'Muestra la imagen de un pin (enlace pinterest.com/pin/... o pin.it/...)', 'enlace:s!,canal:c', null, (i, o) => pinSend(i, o, 'pin', o.enlace.trim()));
def('pinterest', 'guardar', 'Guarda un tablero con un nombre corto', 'nombre:s!,enlace:s!', 'ManageGuild', (i, o, g, cf) => {
  if (!pinRss(o.enlace)) return no(i, 'Eso no parece un tablero público de Pinterest.');
  if (!/^[\w-]{1,30}$/.test(o.nombre)) return no(i, 'El nombre solo puede tener letras, números, `_` y `-` (máx. 30).');
  PN(cf).boards[o.nombre.toLowerCase()] = o.enlace.trim(); save(); ok(i, `Tablero guardado como **${o.nombre.toLowerCase()}**. Úsalo con \`/pinterest tablero tablero:${o.nombre.toLowerCase()}\`.`);
});
def('pinterest', 'quitar', 'Quita un tablero guardado', 'nombre:s!', 'ManageGuild', (i, o, g, cf) => { delete PN(cf).boards[o.nombre.toLowerCase()]; save(); ok(i, 'Tablero eliminado.'); });
def('pinterest', 'lista', 'Tableros guardados y publicaciones automáticas', '', null, (i, o, g, cf) => {
  const p = PN(cf), b = Object.entries(p.boards).map(([n, u]) => `**${n}** → ${u}`), a = Object.entries(p.auto).map(([id, x]) => `<#${id}> · cada **${x.hours} h** · ${x.kind === 'board' ? 'tablero' : 'tema'}: \`${String(x.src).slice(0, 60)}\``);
  say(i, '📌 Pinterest', `**Tableros guardados**\n${b.join('\n') || 'Ninguno'}\n\n**Automático**\n${a.join('\n') || 'Ninguno'}`, true);
});
def('pinterest', 'auto', 'Publica una imagen cada X horas (tablero, nombre guardado o tema)', 'canal:c!,fuente:s!,horas:i!', 'ManageGuild', (i, o, g, cf) => {
  const ci = chIssue(i.guild, o.canal); if (ci) return no(i, `No puedo publicar en ${o.canal}: ${ci}.`);
  if (o.horas < 1 || o.horas > 168) return no(i, '`horas` debe estar entre 1 y 168.');
  const src = pinResolve(cf, o.fuente), kind = pinKind(src); PN(cf).auto[o.canal.id] = { src, kind, hours: o.horas, last: 0 }; save();
  ok(i, `${o.canal} recibirá una imagen cada **${o.horas} h** (${kind === 'board' ? 'del tablero' : 'del tema'} \`${src.slice(0, 80)}\`).\nLa primera llega en menos de 1 minuto.`);
});
def('pinterest', 'autoquitar', 'Quita la publicación automática de un canal', 'canal:c!', 'ManageGuild', (i, o, g, cf) => {
  if (!PN(cf).auto[o.canal.id]) return no(i, 'Ese canal no tiene publicación automática.'); delete PN(cf).auto[o.canal.id]; save(); ok(i, `Automático desactivado en ${o.canal}.`);
});
let pinBusy = false;
async function pinTick() {
  if (pinBusy) return; pinBusy = true;
  try {
    for (const [gid, g] of Object.entries(DB)) {
      const guild = client.guilds.cache.get(gid), au = g.cfg?.pin?.auto; if (!guild || !au) continue;
      for (const [cid, a] of Object.entries(au)) {
        if (Date.now() - a.last < a.hours * 36e5) continue;
        const ch = guild.channels.cache.get(cid); if (!ch) { delete au[cid]; save(); continue; }
        a.last = Date.now(); save();
        const ci = chIssue(guild, ch); if (ci) { lg(gid, 'general', E(gid, '⚠️ Pinterest automático fallido', `${ch}: ${ci}`)); continue; }
        try { const m = await ch.send(pinPayload(gid, [R(await pinFetch(a.kind, a.src))], true)); keep(PSM, m.id, { kind: a.kind, src: a.src }); }
        catch (err) { lg(gid, 'general', E(gid, '⚠️ Pinterest automático fallido', `${ch}: ${err.message}`)); }
      }
    }
  } finally { pinBusy = false; }
}

/* ============================ 19. IMÁGENES CON IA (2) ============================ */
// Por defecto usa Pollinations (gratis, sin clave). Con OPENAI_API_KEY usa OpenAI (IA_MODEL, por defecto gpt-image-1).
const IA_RATIO = { cuadrado: [1024, 1024], horizontal: [1280, 720], vertical: [720, 1280] };
const IA_STYLE = { ninguno: '', anime: 'anime style, vibrant colors, detailed', realista: 'photorealistic, ultra detailed, natural lighting', pixel: 'pixel art, 16-bit', pintura: 'oil painting, textured brush strokes',
  '3d': '3D render, soft lighting, stylized', cyberpunk: 'cyberpunk, neon lights, futuristic city', fantasia: 'fantasy art, epic, magical, highly detailed', minimalista: 'minimalist flat illustration, clean shapes' };
CHO['ia.estilo'] = [['Sin estilo', 'ninguno'], ['Anime', 'anime'], ['Realista', 'realista'], ['Pixel art', 'pixel'], ['Pintura al óleo', 'pintura'], ['3D', '3d'], ['Cyberpunk', 'cyberpunk'], ['Fantasía', 'fantasia'], ['Minimalista', 'minimalista']];
CHO['ia.formato'] = [['Cuadrado', 'cuadrado'], ['Horizontal', 'horizontal'], ['Vertical', 'vertical']];
const IAC = cf => (cf.ia ??= { on: true, cool: 30 });
const IAP = new Map();
async function genImage({ prompt, style, ratio, seed }) {
  const full = [prompt, IA_STYLE[style]].filter(Boolean).join(', '), [w, h] = IA_RATIO[ratio] || IA_RATIO.cuadrado;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 90000);
  try {
    if (process.env.OPENAI_API_KEY) {
      const model = process.env.IA_MODEL || 'gpt-image-1', d3 = model === 'dall-e-3';
      const size = ratio === 'horizontal' ? (d3 ? '1792x1024' : '1536x1024') : ratio === 'vertical' ? (d3 ? '1024x1792' : '1024x1536') : '1024x1024';
      const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, prompt: full.slice(0, d3 ? 4000 : 32000), size, n: 1, ...(d3 ? { response_format: 'b64_json' } : {}) }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || `HTTP ${r.status}`);
      const x = d.data?.[0]; if (!x) throw new Error('respuesta vacía');
      return { buf: x.b64_json ? Buffer.from(x.b64_json, 'base64') : Buffer.from(await (await fetch(x.url, { signal: ctl.signal })).arrayBuffer()), ext: 'png' };
    }
    const q = new URLSearchParams({ width: w, height: h, nologo: 'true', safe: 'true', seed: String(seed ?? rnd(1, 999999)) });
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(full.slice(0, 1500))}?${q}`, { signal: ctl.signal, headers: UA });
    if (!r.ok) throw new Error(`el servicio de imágenes respondió ${r.status}`);
    const ct = r.headers.get('content-type') || ''; if (!ct.startsWith('image/')) throw new Error('el servicio no devolvió una imagen');
    return { buf: Buffer.from(await r.arrayBuffer()), ext: ct.includes('png') ? 'png' : 'jpg' };
  } finally { clearTimeout(t); }
}
// `i` debe estar ya con deferReply. dest = canal distinto donde publicar (o null para responder aquí)
async function iaSend(i, s, dest) {
  const { buf, ext } = await genImage(s), name = `ia-${Date.now()}.${ext}`;
  const e = new EmbedBuilder().setColor(C(i.guildId).color).setTitle('🎨 Imagen con IA').setDescription(`**${s.prompt.slice(0, 500)}**`)
    .setImage(`attachment://${name}`).setFooter({ text: `Pedida por ${i.user.tag} · ${s.style} · ${s.ratio}` }).setTimestamp();
  const p = { embeds: [e], files: [new AttachmentBuilder(buf, { name })],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ia_re').setLabel('Otra variación').setEmoji('🔄').setStyle(ButtonStyle.Secondary))] };
  const m = dest && dest.id !== i.channelId ? await dest.send(p) : await i.editReply(p);
  keep(IAP, m.id, { prompt: s.prompt, style: s.style, ratio: s.ratio, uid: i.user.id }); return m;
}
def('ia', 'imagen', 'Genera una imagen con IA a partir de un texto', 'prompt:s!,estilo:s,formato:s,semilla:i,canal:c', null, async (i, o, g, cf) => {
  const ia = IAC(cf); if (ia.on === false) return no(i, 'La generación de imágenes con IA está desactivada.');
  const mod = i.member.permissions.has(P.ManageMessages);
  if (ia.ch && i.channelId !== ia.ch && !mod) return no(i, `Las imágenes con IA solo se piden en <#${ia.ch}>.`);
  if (!canSendElsewhere(i, o.canal)) return no(i, 'Para enviar a otro canal necesitas **Gestionar mensajes**.');
  const prompt = o.prompt.trim(); if (prompt.length < 3 || prompt.length > 1000) return no(i, 'El texto debe tener entre 3 y 1000 caracteres.');
  if (g.badwords.some(w => prompt.toLowerCase().includes(w))) return no(i, 'Tu texto contiene palabras no permitidas.');
  const dest = o.canal ?? null; if (dest) { const ci = chIssue(i.guild, dest); if (ci) return no(i, `No puedo publicar en ${dest}: ${ci}.`); }
  const u = U(i.guildId, i.user.id), r = cd(u, 'ia', ia.cool * 1000); if (r) return no(i, `Espera ${when(r)} para pedir otra imagen.`);
  await i.deferReply({ flags: dest && dest.id !== i.channelId ? 64 : undefined });
  try {
    await iaSend(i, { prompt, style: o.estilo || 'ninguno', ratio: o.formato || 'cuadrado', seed: o.semilla ?? undefined }, dest);
    if (dest && dest.id !== i.channelId) i.editReply({ embeds: [E(i.guildId, '✅ Listo', `Imagen enviada a ${dest}`)] });
  } catch (err) { u.cd.ia = 0; i.editReply({ embeds: [E(i.guildId, '❌ Error', `No pude generar la imagen: ${err.message}`)] }); }
});
def('ia', 'config', 'Activa/desactiva la IA, cooldown y canal único (sin canal = cualquiera)', 'estado:b,cooldown:i,canal:c', 'ManageGuild', (i, o, g, cf) => {
  const ia = IAC(cf);
  if (o.estado != null) ia.on = o.estado;
  if (o.cooldown != null) { if (o.cooldown < 0 || o.cooldown > 3600) return no(i, '`cooldown` debe estar entre 0 y 3600 segundos.'); ia.cool = o.cooldown; }
  if (o.canal) ia.ch = o.canal.id;
  save(); ok(i, `🎨 IA: **${ia.on === false ? 'desactivada' : 'activada'}**\n⏱️ Cooldown: **${ia.cool}s**\n📍 Canal: ${ia.ch ? `<#${ia.ch}>` : 'cualquiera'}\n🧠 Motor: **${process.env.OPENAI_API_KEY ? `OpenAI (${process.env.IA_MODEL || 'gpt-image-1'})` : 'Pollinations (gratis)'}**`);
});

/* ============== BOTONES Y MODALES NUEVOS (se llama desde interactionCreate) ============== */
/* ========================== 20. POSTULACIONES ========================== */
// Panel público (como el ejemplo) → el usuario elige puesto y rellena un formulario → llega al canal de logs del staff
// con botones Aceptar / Rechazar → el bot avisa al usuario por DM, da el rol del puesto y descuenta el cupo.
const APQ = ['¿Edad y zona horaria?', '¿Por qué quieres ser staff?', '¿Qué experiencia tienes moderando?', '¿Cómo manejarías un conflicto?', '¿Cuánto tiempo puedes dedicar?'];
const AP = cf => (cf.app ??= { pos: [], q: [...APQ], cool: 24 });
const APD = g => (g.postu ??= { n: 0, items: {} });
const apSlug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'puesto';
const apIsStaff = (m, a) => m.permissions.has(P.ManageGuild) || (a.staff && m.roles.cache.has(a.staff));
const apOpen = a => a.pos.filter(p => p.open !== false && p.slots > 0);
const apSlots = a => apOpen(a).reduce((s, p) => s + p.slots, 0);
const apFind = (a, name) => a.pos.find(p => p.id === apSlug(name) || p.name.toLowerCase() === name.toLowerCase());
const AP_DESC = 'Para postularte, debes llenar el siguiente formulario con tus datos y respuestas a las preguntas de manera honesta y detallada. Queremos conocer tus habilidades, tu experiencia y cómo manejarías diferentes situaciones dentro del servidor.';
const AP_ST = { pending: ['🕓 Pendiente', 0xFEE75C], accepted: ['✅ Aceptada', 0x57F287], rejected: ['❌ Rechazada', 0xED4245], withdrawn: ['↩️ Retirada', 0x95A5A6] };

function apRow(a, n) {
  const webOnly = url(a.web) && a.solo_web !== false; // con web configurada → solo el botón de la web (como el ejemplo)
  const r = new ActionRowBuilder();
  if (!webOnly) r.addComponents(new ButtonBuilder().setCustomId('ap_open').setLabel('Postularme').setEmoji('📝').setStyle(ButtonStyle.Primary).setDisabled(n <= 0));
  if (url(a.web)) r.addComponents(new ButtonBuilder().setLabel('Postúlate en la web').setEmoji('🌐').setStyle(ButtonStyle.Link).setURL(a.web));
  return r;
}
async function apPanelPayload(guild, cf, selectedFormat) {
  const a = AP(cf), n = apSlots(a), title = a.title || '📋 Postulaciones', desc = a.desc || AP_DESC, ts = Math.floor(Date.now() / 1000);
  const foot = `💼 ${n > 0 ? `${n} puesto(s) disponible(s)` : 'Postulaciones cerradas'} • ${guild.name}`;
  const clean = String(desc).replace(/^[\s・·•]*¿\s*c[oó]mo postularse\s*\?\s*/i, '').replace(/^[\s・·•]+/, '');
  const how = `**¿ Cómo postularse ?**\n\n・ ${clean}`;
  const help = '📄 **¿Retirar solicitud?**\nUsa `/application withdraw` para eliminar tu solicitud actual.\n\nℹ️ **¿Verificar estado?**\nUsa `/application status` para ver todas tus solicitudes.';
  const web = '🌐 **Postúlate en nuestra web**\n¿Prefieres el navegador? El formulario completo está en nuestra web. Solo tarda unos minutos y puedes tomarte tu tiempo con cada respuesta.';
  const format=selectedFormat||cf.messageFormats?.application||'components_v2';
  if(format!=='components_v2')return buildMessage({format,title,description:`${how}\n\n${help}${url(a.web)?`\n\n${web}`:''}\n\n${foot}`,image:a.img,components:[apRow(a,n)],color:cf.color});
  if (!ContainerBuilder) return { embeds: [E(guild.id, title, `${how}\n\n${help}${url(a.web) ? `\n\n${web}` : ''}\n\n${foot}`, url(a.img))], components: [apRow(a, n)] };
  const c = new ContainerBuilder(), sep = () => c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)), t = s => c.addTextDisplayComponents(new TextDisplayBuilder().setContent(s));
  if (url(a.img)) { c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(a.img))); sep(); }
  t(`## ${title}`); sep(); t(how); sep(); t(help);
  if (url(a.web)) { sep(); t(web); }
  c.addActionRowComponents(apRow(a, n)); sep(); t(`${foot}\n-# <t:${ts}:F>`);
  return { components: [c], flags: 1 << 15, allowedMentions: { parse: [] } };
}
async function apRefreshPanel(guild) {
  const a = AP(C(guild.id)); if (!a.panel) return;
  const m = await guild.channels.cache.get(a.panel.ch)?.messages.fetch(a.panel.id).catch(() => null);
  if(m)await m.edit(await apPanelPayload(guild, C(guild.id), a.panel.format||'components_v2')).catch(() => {});
}
function apStaffPayload(guild, e) {
  const [lab, color] = AP_ST[e.status];
  const emb = new EmbedBuilder().setColor(color).setTitle(`📋 Postulación #${e.id} — ${e.posName}`).setTimestamp(e.at)
    .setDescription([`👤 <@${e.user}> (\`${e.tag}\`)`, `📅 Cuenta creada: <t:${Math.floor(e.created / 1000)}:R>`, e.joined ? `📥 Entró al servidor: <t:${Math.floor(e.joined / 1000)}:R>` : null,
      `**Estado:** ${lab}${e.by ? ` por <@${e.by}>` : ''}`, e.reason ? `**Motivo:** ${e.reason}` : null, e.note].filter(Boolean).join('\n'))
    .addFields(e.answers.map(x => ({ name: x.q.slice(0, 256), value: (x.a || '—').slice(0, 1024) })));
  if (e.avatar) emb.setThumbnail(e.avatar);
  const components = e.status === 'pending' ? [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ap_ok_${e.id}`).setLabel('Aceptar').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ap_no_${e.id}`).setLabel('Rechazar').setEmoji('❌').setStyle(ButtonStyle.Danger))] : [];
  return { embeds: [emb], components };
}
async function apEditStaff(guild, e) {
  const m = await guild.channels.cache.get(e.msg?.ch)?.messages.fetch(e.msg?.id).catch(() => null);
  await m?.edit({ ...apStaffPayload(guild, e), content: null }).catch(() => {});
}
function apBlock(g, a, uid) {
  const items = Object.values(APD(g).items).filter(x => x.user === uid), pend = items.find(x => x.status === 'pending');
  if (pend) return `Ya tienes la postulación **#${pend.id}** pendiente. Espera la respuesta o retírala con \`/application withdraw\`.`;
  const rej = items.filter(x => x.status === 'rejected').sort((x, y) => y.done - x.done)[0];
  if (rej && a.cool > 0 && Date.now() < rej.done + a.cool * 36e5) return `Tu última postulación fue rechazada. Podrás volver a postularte ${when(rej.done + a.cool * 36e5 - Date.now())}.`;
  return null;
}
const apModal = (a, pos) => new ModalBuilder().setCustomId(`ap_modal_${pos.id}`).setTitle(`Postulación: ${pos.name}`.slice(0, 45)).addComponents(
  ...a.q.slice(0, 5).map((q, k) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`q${k}`).setLabel(q.slice(0, 45)).setStyle(TextInputStyle.Paragraph).setMaxLength(800).setRequired(true))));

// ---- Botones, menú y formularios ----
async function appInteractions(i) {
  const id = i.customId; if (!id?.startsWith('ap_')) return false;
  const gid = i.guildId, g = G(gid), cf = C(gid), a = AP(cf), d = APD(g);
  const ready = () => (!a.logch || !i.guild.channels.cache.get(a.logch)) ? 'Las postulaciones no están configuradas todavía (falta el canal de logs del staff).' : null;
  if (i.isButton() && id === 'ap_open') {
    const bad = ready() || (!apOpen(a).length && 'No hay puestos disponibles ahora mismo.') || apBlock(g, a, i.user.id); if (bad) { await no(i, bad); return true; }
    const op = apOpen(a);
    if (op.length === 1) { await i.showModal(apModal(a, op[0])); return true; }
    await i.reply({ flags: 64, content: '📝 Elige el puesto al que quieres postularte:', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ap_pick').setPlaceholder('Selecciona un puesto')
      .addOptions(op.slice(0, 25).map(p => ({ label: p.name.slice(0, 100), value: p.id, description: `${p.slots} cupo(s) disponible(s)` }))))] });
    return true;
  }
  if (i.isStringSelectMenu() && id === 'ap_pick') {
    const pos = apOpen(a).find(p => p.id === i.values[0]), bad = ready() || (!pos && 'Ese puesto ya no está disponible.') || apBlock(g, a, i.user.id); if (bad) { await no(i, bad); return true; }
    await i.showModal(apModal(a, pos)); return true;
  }
  if (i.isModalSubmit() && id.startsWith('ap_modal_')) {
    const pos = apOpen(a).find(p => p.id === id.slice(9)), bad = ready() || (!pos && 'Ese puesto ya no está disponible.') || apBlock(g, a, i.user.id); if (bad) { await no(i, bad); return true; }
    await i.deferReply({ flags: 64 });
    const n = ++d.n, mem = i.member;
    const e = d.items[n] = { id: n, user: i.user.id, tag: i.user.username, avatar: i.user.displayAvatarURL({ extension: 'png', size: 256 }), created: i.user.createdTimestamp, joined: mem?.joinedTimestamp || 0,
      pos: pos.id, posName: pos.name, at: Date.now(), status: 'pending',
      answers: [...i.fields.fields.values()].map((f, k) => ({ q: a.q[k] ?? `Pregunta ${k + 1}`, a: (f.value || '').trim() })) };
    try {
      const m = await i.guild.channels.cache.get(a.logch).send({ ...apStaffPayload(i.guild, e), content: a.staff ? `<@&${a.staff}> nueva postulación` : undefined, allowedMentions: { roles: a.staff ? [a.staff] : [] } });
      e.msg = { ch: m.channelId, id: m.id };
    } catch (err) { delete d.items[n]; d.n--; await i.editReply({ embeds: [E(gid, '❌ Error', `No pude enviar tu postulación al staff: ${err.message}`)] }); return true; }
    save();
    await i.editReply({ embeds: [E(gid, '✅ Postulación enviada', `Tu postulación **#${n}** para **${pos.name}** llegó al staff. Te avisaré por mensaje privado cuando la revisen.\nPuedes ver su estado con \`/application status\`.`)] });
    return true;
  }
  const bt = id.match(/^ap_(ok|no)_(\d+)$/);
  if (i.isButton() && bt) {
    if (!apIsStaff(i.member, a)) { await no(i, 'Solo el staff puede revisar postulaciones.'); return true; }
    const e = d.items[+bt[2]]; if (!e) { await no(i, 'No encuentro esa postulación.'); return true; }
    if (e.status !== 'pending') { await i.update({ ...apStaffPayload(i.guild, e), content: null }); return true; } // ya la resolvió otra persona
    if (bt[1] === 'no') { await i.showModal(new ModalBuilder().setCustomId(`ap_rej_${e.id}`).setTitle(`Rechazar postulación #${e.id}`).addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Motivo (se le enviará al usuario)').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(false)))); return true; }
    e.status = 'accepted'; e.by = i.user.id; e.done = Date.now();
    const pos = a.pos.find(p => p.id === e.pos); if (pos) { pos.slots = Math.max(0, pos.slots - 1); if (pos.slots <= 0) pos.open = false; }
    if (pos?.role) {
      const mem = await i.guild.members.fetch(e.user).catch(() => null);
      if (!mem) e.note = '⚠️ El usuario ya no está en el servidor.';
      else await mem.roles.add(pos.role, `Postulación #${e.id} aceptada por ${i.user.username}`).then(() => { e.note = `🎖️ Rol asignado: <@&${pos.role}>`; }).catch(err => { e.note = `⚠️ No pude dar el rol <@&${pos.role}>: ${err.message}`; });
    }
    save(); await i.update({ ...apStaffPayload(i.guild, e), content: null });
    const u = await client.users.fetch(e.user).catch(() => null);
    if (u) dm(u, E(gid, '🎉 ¡Postulación aceptada!', `Tu postulación **#${e.id}** para **${e.posName}** en **${i.guild.name}** fue **aceptada**.${pos?.role ? `\nSe te asignó el rol **${i.guild.roles.cache.get(pos.role)?.name || 'del puesto'}**.` : ''}\n¡Bienvenido al equipo!`));
    apRefreshPanel(i.guild); return true;
  }
  const rj = id.match(/^ap_rej_(\d+)$/);
  if (i.isModalSubmit() && rj) {
    if (!apIsStaff(i.member, a)) { await no(i, 'Solo el staff puede revisar postulaciones.'); return true; }
    const e = d.items[+rj[1]]; if (!e) { await no(i, 'No encuentro esa postulación.'); return true; }
    if (e.status !== 'pending') { await no(i, 'Esa postulación ya fue resuelta.'); return true; }
    e.status = 'rejected'; e.by = i.user.id; e.done = Date.now(); e.reason = i.fields.getTextInputValue('reason').trim() || null; save();
    const p = { ...apStaffPayload(i.guild, e), content: null };
    if (i.isFromMessage()) await i.update(p); else { await apEditStaff(i.guild, e); await i.reply({ flags: 64, content: 'Postulación rechazada.' }); }
    const u = await client.users.fetch(e.user).catch(() => null);
    if (u) dm(u, E(gid, '❌ Postulación rechazada', `Tu postulación **#${e.id}** para **${e.posName}** en **${i.guild.name}** fue **rechazada**.${e.reason ? `\n\n**Motivo:** ${e.reason}` : ''}${a.cool > 0 ? `\n\nPodrás volver a postularte en ${a.cool} hora(s).` : ''}`));
    return true;
  }
  return false;
}

// ---- Comandos ----
def('application', 'status', 'Mira el estado de todas tus postulaciones', '', null, (i, o, g) => {
  const l = Object.values(APD(g).items).filter(x => x.user === i.user.id).sort((x, y) => y.id - x.id).slice(0, 10);
  if (!l.length) return say(i, '📋 Tus postulaciones', 'Todavía no has enviado ninguna postulación.', true);
  say(i, '📋 Tus postulaciones', l.map(x => `**#${x.id}** · ${x.posName} · ${AP_ST[x.status][0]} · <t:${Math.floor(x.at / 1000)}:R>${x.reason ? `\n> **Motivo:** ${x.reason}` : ''}`).join('\n'), true);
});
def('application', 'withdraw', 'Retira tu postulación pendiente', '', null, async (i, o, g) => {
  const e = Object.values(APD(g).items).filter(x => x.user === i.user.id && x.status === 'pending').sort((x, y) => y.id - x.id)[0];
  if (!e) return no(i, 'No tienes ninguna postulación pendiente.');
  e.status = 'withdrawn'; e.done = Date.now(); save(); await apEditStaff(i.guild, e);
  say(i, '↩️ Postulación retirada', `Tu postulación **#${e.id}** para **${e.posName}** fue retirada.`, true);
});
def('application', 'config', 'Canal de logs del staff, rol revisor, espera, textos e imagen del panel', 'canal_logs:c,rol_staff:r,espera:i,titulo:s,descripcion:s,imagen:s,web:s,solo_web:b', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf);
  if (o.canal_logs) { const ci = chIssue(i.guild, o.canal_logs); if (ci) return no(i, `No puedo usar ${o.canal_logs}: ${ci}.`); a.logch = o.canal_logs.id; }
  if (o.rol_staff) a.staff = o.rol_staff.id;
  if (o.espera != null) a.cool = Math.min(720, Math.max(0, o.espera));
  if (o.titulo) a.title = o.titulo.slice(0, 200);
  if (o.descripcion) a.desc = nl(o.descripcion).slice(0, 1500);
  if (o.imagen) { if (o.imagen === '-') delete a.img; else if (url(o.imagen)) a.img = o.imagen; else return no(i, 'La imagen debe ser un enlace http(s) (o `-` para quitarla).'); }
  if (o.solo_web != null) a.solo_web = o.solo_web;
  if (o.web) { if (o.web === '-') delete a.web; else if (url(o.web)) a.web = o.web; else return no(i, 'La web debe ser un enlace http(s) (o `-` para quitarla).'); }
  save(); apRefreshPanel(i.guild);
  ok(i, `📍 Logs del staff: ${a.logch ? `<#${a.logch}>` : '—'}\n🛡️ Rol revisor: ${a.staff ? `<@&${a.staff}>` : 'solo quienes tengan **Gestionar servidor**'}\n⏳ Espera tras rechazo: **${a.cool} h**\n🖼️ Imagen: ${a.img ? 'sí' : '—'} · 🌐 Web: ${a.web || '—'}\n❓ Preguntas: **${a.q.length}**`);
});
def('application', 'preguntas', 'Define las preguntas del formulario (máx. 5) separadas por |', 'texto:s!', 'ManageGuild', (i, o, g, cf) => {
  const q = o.texto.split('|').map(x => x.trim()).filter(Boolean);
  if (!q.length || q.length > 5) return no(i, 'Pon entre 1 y 5 preguntas separadas por `|`.');
  const long = q.find(x => x.length > 45); if (long) return no(i, `Discord limita cada pregunta a 45 caracteres: "${long.slice(0, 50)}…" (${long.length}).`);
  AP(cf).q = q; save(); ok(i, `Preguntas guardadas:\n${q.map((x, n) => `**${n + 1}.** ${x}`).join('\n')}`);
});
def('application', 'puesto_add', 'Añade un puesto abierto a las postulaciones', 'nombre:s!,cupos:i,rol:r', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf), id = apSlug(o.nombre); if (a.pos.some(p => p.id === id)) return no(i, 'Ya existe un puesto con ese nombre.'); if (a.pos.length >= 25) return no(i, 'Máximo 25 puestos.');
  a.pos.push({ id, name: o.nombre.slice(0, 80), slots: Math.max(1, o.cupos ?? 1), open: true, role: o.rol?.id }); save(); apRefreshPanel(i.guild);
  ok(i, `Puesto **${o.nombre}** añadido (${Math.max(1, o.cupos ?? 1)} cupo(s))${o.rol ? ` · rol al aceptar: ${o.rol}` : ''}.`);
});
def('application', 'puesto_edit', 'Cambia cupos, rol o abre/cierra un puesto', 'nombre:s!,cupos:i,rol:r,abierto:b', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf), p = apFind(a, o.nombre); if (!p) return no(i, 'No encuentro ese puesto. Mira `/application puestos`.');
  if (o.cupos != null) { p.slots = Math.max(0, o.cupos); if (p.slots > 0 && o.abierto == null) p.open = true; }
  if (o.rol) p.role = o.rol.id; if (o.abierto != null) p.open = o.abierto; save(); apRefreshPanel(i.guild);
  ok(i, `**${p.name}** · ${p.slots} cupo(s) · ${p.open !== false && p.slots > 0 ? '🟢 abierto' : '🔴 cerrado'}${p.role ? ` · rol: <@&${p.role}>` : ''}`);
});
def('application', 'puesto_del', 'Elimina un puesto', 'nombre:s!', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf), p = apFind(a, o.nombre); if (!p) return no(i, 'No encuentro ese puesto.');
  a.pos = a.pos.filter(x => x !== p); save(); apRefreshPanel(i.guild); ok(i, `Puesto **${p.name}** eliminado.`);
});
def('application', 'puestos', 'Lista los puestos y sus cupos', '', 'ManageGuild', (i, o, g, cf) => {
  const a = AP(cf); say(i, '💼 Puestos', a.pos.map(p => `${p.open !== false && p.slots > 0 ? '🟢' : '🔴'} **${p.name}** — ${p.slots} cupo(s)${p.role ? ` · <@&${p.role}>` : ''}`).join('\n') || 'No hay puestos. Usa `/application puesto_add`.', true);
});
def('application', 'pendientes', 'Lista las postulaciones pendientes de revisar', '', null, (i, o, g, cf) => {
  const a = AP(cf); if (!apIsStaff(i.member, a)) return no(i, 'Solo el staff puede ver esto.');
  const l = Object.values(APD(g).items).filter(x => x.status === 'pending');
  say(i, '🕓 Postulaciones pendientes', l.map(x => `**#${x.id}** · <@${x.user}> · ${x.posName}${x.msg ? ` · [ver](https://discord.com/channels/${i.guildId}/${x.msg.ch}/${x.msg.id})` : ''}`).join('\n') || 'No hay ninguna pendiente. 🎉', true);
});
def('application', 'panel', 'Publica el panel de postulaciones en un canal', 'canal:c!', 'ManageGuild', async (i, o, g, cf) => {
  const a = AP(cf);
  if (!a.logch) return no(i, 'Primero configura el canal de logs del staff: `/application config canal_logs:#canal`.');
  if (!a.pos.length) return no(i, 'Añade al menos un puesto con `/application puesto_add`.');
  const ci = chIssue(i.guild, o.canal, cf.messageFormats?.application||'components_v2'); if (ci) return no(i, `No puedo publicar en ${o.canal}: ${ci}.`);
  const old = a.panel && await i.guild.channels.cache.get(a.panel.ch)?.messages.fetch(a.panel.id).catch(() => null);
  let m; try { m = await o.canal.send(await apPanelPayload(i.guild, cf)); } catch (err) { return no(i, `No pude publicar el panel: ${err.message}`); }
  a.panel = { ch: o.canal.id, id: m.id, format:cf.messageFormats?.application||'components_v2' }; save(); old?.delete().catch(() => {}); ok(i, `Panel publicado en ${o.canal}.`);
});
def('application', 'desactivar', 'Borra la configuración de postulaciones (conserva el historial)', '', 'ManageGuild', (i, o, g, cf) => { delete cf.app; save(); ok(i, 'Configuración de postulaciones eliminada.'); });

async function extraInteractions(i) {
  const gid = i.guildId;
  if (i.isButton() && i.customId.startsWith('rp_')) return rpButton(i); // paneles de roles (/rolpanel)
  if ((i.isStringSelectMenu() && i.customId.startsWith('uh_sel_')) || (i.isButton() && i.customId === 'uh_home')) { // menú de /util help
    await i.update(helpPayload(gid, i.isButton() ? null : i.values[0])); return true;
  }
  if (await appInteractions(i)) return true; // postulaciones (botones, menú y formularios)
  if (i.isButton()) {
    const id = i.customId;
    if (id === 'cf_open') {
      if (!CFC(C(gid)).ch) { await no(i, 'Las confesiones no están configuradas.'); return true; }
      await cfShowModal(i); return true;
    }
    const lk = id.match(/^cf_(like|re|rep)_(\d+)$/);
    if (lk) {
      const n = +lk[2], it = CFD(G(gid)).items[n];
      if (!it) { await no(i, 'Ya no tengo registro de esa confesión.'); return true; }
      if (lk[1] === 'like') { // ❤ alterna tu "me gusta" y actualiza el contador del botón
        it.likes ??= []; const k = it.likes.indexOf(i.user.id); if (k < 0) it.likes.push(i.user.id); else it.likes.splice(k, 1); save();
        const old = i.message.components?.[0];
        if (ContainerBuilder && old?.toJSON) await i.update({ components: [old.toJSON(), cfRow(n, it.likes.length, it.noreply)], flags: 1 << 15 });
        else await i.update({ components: [cfRow(n, it.likes.length, it.noreply)] });
        return true;
      }
      if (lk[1] === 're') {
        if (it.noreply) { await no(i, 'Esa confesión no permite respuestas.'); return true; }
        if (!CFC(C(gid)).ch) { await no(i, 'Las confesiones no están configuradas.'); return true; }
        await i.showModal(new ModalBuilder().setCustomId(`cf_rmodal_${n}`).setTitle(`Responder a Anónimo #${n}`).addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('text').setLabel('Tu respuesta (anónima)').setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1800).setRequired(true))));
        return true;
      }
      it.rep ??= []; if (it.rep.includes(i.user.id)) { await no(i, 'Ya reportaste esta confesión.'); return true; } it.rep.push(i.user.id); save();
      const e = E(gid, '🚩 Confesión reportada', `**Anónimo #${n}** · [Ir al mensaje](https://discord.com/channels/${gid}/${i.channelId}/${i.message.id})\nReportes: **${it.rep.length}**`);
      lg(gid, 'reportes', e); const rc = CFC(C(gid)), rv = rc.review && i.guild.channels.cache.get(rc.review); rv?.send({ embeds: [e] }).catch(() => {});
      await say(i, '🚩 Reporte enviado', 'El staff revisará esta confesión. El reporte no se muestra al autor.', true); return true;
    }
    if (id === 'pin_more') {
      const s = PSM.get(i.message.id); if (!s) { await no(i, 'Ya no recuerdo de dónde salió esta imagen. Usa el comando otra vez.'); return true; }
      await i.deferUpdate();
      try { await i.editReply(pinPayload(gid, [R(await pinFetch(s.kind, s.src))], true)); }
      catch (err) { await i.followUp({ flags: 64, embeds: [E(gid, '❌ Error', `No pude cargar otra imagen: ${err.message}`)] }).catch(() => {}); }
      return true;
    }
    if (id === 'ia_re') {
      const s = IAP.get(i.message.id); if (!s) { await no(i, 'Ya no recuerdo ese texto. Usa `/ia imagen` otra vez.'); return true; }
      if (i.user.id !== s.uid) { await no(i, 'Solo quien pidió la imagen puede pedir otra variación.'); return true; }
      const ia = IAC(C(gid)), u = U(gid, i.user.id), r = cd(u, 'ia', ia.cool * 1000); if (r) { await no(i, `Espera ${when(r)}.`); return true; }
      await i.deferReply();
      try { await iaSend(i, { ...s, seed: undefined }, null); }
      catch (err) { u.cd.ia = 0; await i.editReply({ embeds: [E(gid, '❌ Error', `No pude generar la imagen: ${err.message}`)] }).catch(() => {}); }
      return true;
    }
  }
  if (i.isModalSubmit() && i.customId === 'cf_modal') { await submitConfession(i, i.fields.getTextInputValue('text'), null, cfOpts(i)); return true; }
  const rm = i.isModalSubmit() && i.customId.match(/^cf_rmodal_(\d+)$/);
  if (rm) { await submitConfession(i, i.fields.getTextInputValue('text'), +rm[1]); return true; }
  return false;
}
