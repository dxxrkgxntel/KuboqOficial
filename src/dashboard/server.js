'use strict';

const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const { PermissionFlagsBits } = require('discord.js');
const { getIdentity, setIdentity } = require('../services/identity');

const ROOT = new Set(['work', 'daily', 'confesiones']);
const DISCORD_ONLY = new Map([
  ['limpiar.canal', 'La confirmación para reiniciar un canal se realiza en Discord.'],
  ['pinterest.buscar', 'Las imágenes y sus botones interactivos se publican desde Discord.'],
  ['pinterest.tablero', 'Las imágenes y sus botones interactivos se publican desde Discord.'],
  ['pinterest.pin', 'Las imágenes y sus botones interactivos se publican desde Discord.'],
  ['ia.imagen', 'La generación de imágenes y sus archivos se reciben en Discord.'],
  ['ticket.transcript', 'La transcripción se entrega como archivo desde Discord.'],
]);
const CONTEXT_CHANNEL_COMMANDS = new Set([
  'mod.purge','mod.lock','mod.unlock','mod.slowmode','mod.hide','mod.unhide','util.channelinfo','util.reportar','bump.ahora',
  'ticket.add','ticket.remove','ticket.close','ticket.rename','ticket.claim','confesion.panel','confesiones.run',
  'limpiar.mensajes','limpiar.desde','limpiar.canal',
  'anuncio.recordatorio','anuncio.editar','anuncio.borrar','estado.panel',
  'daily.run','work.run','fishing.collect','eco.weekly','eco.crime','eco.rob','eco.coinflip','eco.slots','eco.dados','eco.mine','eco.hunt',
  'nivel.xpadd','nivel.xpremove',
]);
const BOT_CHANNEL_PERMISSIONS = new Map([
  ['mod.purge',['ReadMessageHistory','ManageMessages']],
  ['mod.lock',['ManageChannels']],['mod.unlock',['ManageChannels']],['mod.slowmode',['ManageChannels']],['mod.hide',['ManageChannels']],['mod.unhide',['ManageChannels']],
  ['ticket.add',['ManageChannels']],['ticket.remove',['ManageChannels']],['ticket.rename',['ManageChannels']],['ticket.close',['ManageChannels','ReadMessageHistory']],
  ['limpiar.mensajes',['ReadMessageHistory','ManageMessages']],['limpiar.desde',['ReadMessageHistory','ManageMessages']],['limpiar.canal',['ManageChannels','ManageMessages']],
  ['anuncio.embed',['SendMessages','EmbedLinks']],['anuncio.say',['SendMessages']],['anuncio.recordatorio',['SendMessages','EmbedLinks']],
  ['confesiones.run',['SendMessages','EmbedLinks']],['confesion.panel',['SendMessages','EmbedLinks']],['estado.panel',['SendMessages','EmbedLinks']],
]);
const REQUIRED_TARGET_CHANNEL_OPTIONS = new Map([
  ['anuncio.embed','canal'],['anuncio.say','canal'],['ticket.panel','canal'],
]);
const ALLOWED_CFG = new Set(['color']);
const OUTPUT_FORMATS = new Set(['embed','components_v2','card','text']);
const TYPES = { s: 'string', i: 'integer', u: 'user', c: 'channel', r: 'role', b: 'boolean' };
const MAX_BODY = 64 * 1024;
const ACH_CATEGORIES = {
  chat: { label: 'Chat', emoji: '💬' }, nivel: { label: 'Nivel', emoji: '⭐' }, eco: { label: 'Economía', emoji: '🪙' },
  inv: { label: 'Invitaciones', emoji: '📨' }, voz: { label: 'Voz', emoji: '🎙️' }, cam: { label: 'Cámara', emoji: '📷' },
  stream: { label: 'Stream', emoji: '🖥️' }, leal: { label: 'Lealtad', emoji: '🏅' },
};
const ACH_TYPE_CATEGORY = { msgs:'chat', lvl:'nivel', coins:'eco', invites:'inv', vmin:'voz', mic:'voz', micon:'voz', cam:'cam', camon:'cam', strm:'stream', stron:'stream', days:'leal', acct:'leal' };
const ACH_RARITY_POINTS = { comun:5, poco:10, raro:20, epico:40, legendario:75 };

function dashboardServer({ client, config, DB, G, C, save, CATS, choices = {}, permissions = PermissionFlagsBits, extraInteractions, music, activityCollection = null }) {
  const app = express();
  const sessions = new Map();
  const states = new Map();
  const rate = new Map();
  const port = Number(config.dashboard?.port || 3000);
  const clientId = String(config.discord?.clientId || '').trim();
  const clientSecret = String(config.dashboard?.clientSecret || '').trim();
  const redirectUri = String(config.dashboard?.redirectUri || '').trim();
  const sessionSecret = String(config.dashboard?.sessionSecret || '').trim();
  const configured = Boolean(clientId && clientSecret && redirectUri && sessionSecret.length >= 32);
  const origin = (() => { try { return new URL(redirectUri).origin; } catch { return ''; } })();
  const secureCookie = redirectUri.startsWith('https://');
  const publicDir = path.join(__dirname, 'public');

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: MAX_BODY, strict: true }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const cookie = (res, value, maxAge) => res.cookie('club247_sid', value, {
    httpOnly: true, sameSite: 'lax', secure: secureCookie, path: '/', maxAge,
  });
  const signedCookie = id => `${id}.${crypto.createHmac('sha256', sessionSecret).update(id).digest('base64url')}`;
  const sid = req => {
    const raw = req.cookies?.club247_sid || parseCookie(req.headers.cookie || '').club247_sid || '';
    const split = raw.lastIndexOf('.'); if (split < 1) return null;
    const id = raw.slice(0, split), signature = raw.slice(split + 1);
    const expected = crypto.createHmac('sha256', sessionSecret).update(id).digest();
    let actual; try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? id : null;
  };
  const parseCookie = raw => {
    const result = {};
    for (const part of raw.split(';')) {
      const split = part.indexOf('=');
      if (split < 1) continue;
      try { result[part.slice(0, split).trim()] = decodeURIComponent(part.slice(split + 1).trim()); } catch {}
    }
    return result;
  };
  const getSession = req => { const id = sid(req), session = id && sessions.get(id); if (!session) return null; if (session.expires < Date.now()) { sessions.delete(id); return null; } session.expires = Date.now() + 12 * 60 * 60 * 1000; return session; };
  const auth = (req, res, next) => { const session = getSession(req); if (!session) return res.status(401).json({ error: 'Inicia sesión con Discord para continuar.' }); req.session = session; req.sessionId = sid(req); next(); };
  const csrf = (req, res, next) => {
    if (!origin || req.get('origin') !== origin) return res.status(403).json({ error: 'Origen no permitido.' });
    if (req.get('sec-fetch-site') && !['same-origin','none'].includes(req.get('sec-fetch-site'))) return res.status(403).json({ error: 'Solicitud externa bloqueada.' });
    next();
  };
  const oauthFetch = async (url, options = {}) => {
    const r = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(15_000) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error_description || data.message || `Discord respondió ${r.status}`);
    return data;
  };
  const discordRequest = (token, url) => oauthFetch(`https://discord.com/api/v10${url}`, { headers: { Authorization: `Bearer ${token}` } });
  const hasManageGuild = bits => { try { const n = BigInt(bits || 0); return (n & 8n) !== 0n || (n & 32n) !== 0n; } catch { return false; } };
  const guildsFor = session => session.guilds || [];
  const getAuthorizedGuild = async (req, guildId, requiredPermission = null) => {
    const oauthGuild = guildsFor(req.session).find(g => g.id === guildId && hasManageGuild(g.permissions));
    if (!oauthGuild) throw Object.assign(new Error('No tienes permiso para administrar este servidor.'), { status: 403 });
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw Object.assign(new Error('El bot no está en ese servidor.'), { status: 404 });
    if (!guild.members.me) {
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember) throw Object.assign(new Error('No pude verificar los permisos del bot en ese servidor.'), {status:503});
    }
    const member = await guild.members.fetch(req.session.user.id).catch(() => null);
    if (!member || !(guild.ownerId === member.id || member.permissions.has(permissions.Administrator) || member.permissions.has(permissions.ManageGuild))) {
      throw Object.assign(new Error('Tu usuario ya no tiene permisos de administración en ese servidor.'), { status: 403 });
    }
    if (requiredPermission && !member.permissions.has(permissions[requiredPermission])) {
      throw Object.assign(new Error(`Este comando requiere el permiso ${requiredPermission}.`), { status: 403 });
    }
    return { guild, member, db: G(guildId), cfg: C(guildId) };
  };
  const limiter = (session, guildId) => {
    const key = `${session.user.id}:${guildId}`, now = Date.now();
    const recent = (rate.get(key) || []).filter(t => now - t < 60_000);
    if (recent.length >= 24) throw Object.assign(new Error('Llegaste al límite de acciones. Espera un minuto.'), { status: 429 });
    recent.push(now); rate.set(key, recent);
  };
  const getAchievementGuild = async (req, guildId) => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw Object.assign(new Error('Kuboq no está instalado en este servidor.'), { status:404 });
    const member = await guild.members.fetch(req.session.user.id).catch(() => null);
    if (!member) throw Object.assign(new Error('Inicia sesión con una cuenta que pertenezca a este servidor.'), { status:403 });
    return { guild, member };
  };
  const recordDashboardActivity = async (guildId, user, tipo, nombre) => {
    if (!activityCollection) return;
    try { await activityCollection.insertOne({ guildId, userId:user.id, usuario:user.username, tipo, nombre, fecha:new Date() }); }
    catch (error) { console.error('[dashboard/activity]', error.message); }
  };
  const recordRequestActivity = (req, guildId, tipo, nombre) => recordDashboardActivity(guildId, {
    id:req.session.user.id,
    username:req.session.user.global_name || req.session.user.username,
  }, tipo, nombre);
  const serial = (value, depth = 0) => {
    if (depth > 8 || value == null || ['string','number','boolean'].includes(typeof value)) return value;
    if (typeof value === 'function') return undefined;
    if (Buffer.isBuffer(value)) return undefined;
    if (Array.isArray(value)) return value.slice(0, 40).map(v => serial(v, depth + 1));
    if (typeof value.toJSON === 'function') { try { return serial(value.toJSON(), depth + 1); } catch {} }
    if (typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value).slice(0, 80)) if (!['guild','client','channel','member','user','message','author','attachment','attachments','webhook','token'].includes(k)) {
        const next = serial(v, depth + 1); if (next !== undefined) out[k] = next;
      }
      return out;
    }
    return String(value);
  };
  const responseText = payload => {
    const data = serial(typeof payload === 'string' ? { content: payload } : payload) || {};
    return { content: data.content || '', embeds: data.embeds || [], components: data.components || [], ephemeral: Boolean(Number(data.flags || 0) & 64), files: (data.files || []).length };
  };
  function commandCatalog() {
    const result = [];
    for (const [category, subs] of Object.entries(CATS)) for (const [name, cmd] of Object.entries(subs)) {
      result.push({ category, name: name === 'run' && ROOT.has(category) ? category : name, root: ROOT.has(category), description: cmd.desc, permission: cmd.perm || null,
        dashboardAvailable: !DISCORD_ONLY.has(`${category}.${name}`), dashboardReason: DISCORD_ONLY.get(`${category}.${name}`) || null,
        contextChannelRequired: CONTEXT_CHANNEL_COMMANDS.has(`${category}.${name}`),
        targetChannelRequired: REQUIRED_TARGET_CHANNEL_OPTIONS.has(`${category}.${name}`),
        options: (cmd.spec || []).map(o => ({ name: o.n, type: TYPES[o.t], required: Boolean(o.r), choices: choices[`${category}.${o.n}`] || [] })) });
    }
    for (const command of music.musicCommands()) {
      const json = command.toJSON();
      result.push({ category: 'musica', name: json.name, root: true, description: json.description, permission: json.default_member_permissions ? 'ManageGuild' : null,
        options: (json.options || []).map(o => ({ name: o.name, type: ({3:'string',4:'integer',5:'boolean',6:'user',7:'channel',8:'role'})[o.type] || 'string', required: Boolean(o.required), choices: o.choices || [] })) });
    }
    return result;
  }
  const validateTree = (value, depth = 0) => {
    if (depth > 5) throw Object.assign(new Error('La configuración es demasiado profunda.'), { status: 400 });
    if (value == null || ['string','number','boolean'].includes(typeof value)) {
      if (typeof value === 'string' && value.length > 4000) throw Object.assign(new Error('Texto demasiado largo.'), { status: 400 });
      if (typeof value === 'number' && !Number.isFinite(value)) throw Object.assign(new Error('Número inválido.'), { status: 400 });
      return value;
    }
    if (Array.isArray(value)) { if (value.length > 100) throw Object.assign(new Error('Lista demasiado larga.'), { status: 400 }); return value.map(x => validateTree(x, depth + 1)); }
    if (typeof value !== 'object') throw Object.assign(new Error('Valor de configuración inválido.'), { status: 400 });
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__','prototype','constructor'].includes(key) || key.length > 80) throw Object.assign(new Error('Clave no válida.'), { status: 400 });
      out[key] = validateTree(child, depth + 1);
    }
    return out;
  };
  const merge = (target, source) => { for (const [k, v] of Object.entries(source)) { if (v && typeof v === 'object' && !Array.isArray(v)) { if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {}; merge(target[k], v); } else target[k] = v; } return target; };

  app.get('/auth/discord', (req, res) => {
    if (!configured) return res.status(503).send('Falta configurar CLIENT_ID, DASHBOARD_CLIENT_SECRET, DASHBOARD_SESSION_SECRET (32+ caracteres) y DASHBOARD_REDIRECT_URI.');
    const state = crypto.randomBytes(24).toString('hex');
    const flow = String(req.query.flow || '');
    const requestedReturnTo = String(req.query.returnTo || '');
    const returnTo = requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//') && !/[\\\r\n]/.test(requestedReturnTo) ? requestedReturnTo : '';
    states.set(state, { expires: Date.now() + 10 * 60 * 1000, popup: req.query.popup === '1', flow: /^[a-zA-Z0-9_-]{8,100}$/.test(flow) ? flow : '', returnTo });
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'identify guilds', state });
    res.redirect(`https://discord.com/oauth2/authorize?${query}`);
  });
  app.get('/auth/callback', async (req, res) => {
    let popup = false, flow = '', returnTo = '';
    const complete = status => {
      const params = new URLSearchParams();
      if (flow) params.set('flow', flow);
      if (status) params.set('status', status);
      return '/auth/complete' + (params.size ? `?${params}` : '');
    };
    try {
      const state = String(req.query.state || '');
      const attempt = states.get(state); states.delete(state);
      popup = Boolean(attempt?.popup); flow = attempt?.flow || '';
      returnTo = attempt?.returnTo || '';
      if (!attempt || attempt.expires < Date.now() || !req.query.code) return res.redirect(popup ? complete('expired') : '/?login=expired');
      const token = await oauthFetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: redirectUri }) });
      const [user, guilds] = await Promise.all([discordRequest(token.access_token, '/users/@me'), discordRequest(token.access_token, '/users/@me/guilds')]);
      const sidValue = crypto.randomBytes(32).toString('base64url');
      sessions.set(sidValue, { accessToken: token.access_token, user, guilds, expires: Date.now() + 12 * 60 * 60 * 1000 });
      cookie(res, signedCookie(sidValue), 12 * 60 * 60 * 1000); res.redirect(popup ? complete() : returnTo || '/dashboard/servers');
    } catch (error) { console.error('[dashboard/oauth]', error.message); res.redirect(popup ? complete('failed') : '/?login=failed'); }
  });
  app.get('/auth/complete', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!getSession(req) && !['expired','failed'].includes(req.query.status)) return res.redirect('/');
    res.sendFile(path.join(publicDir, 'auth-complete.html'));
  });
  app.post('/auth/logout', csrf, auth, (req, res) => { sessions.delete(req.sessionId); res.clearCookie('club247_sid', { httpOnly: true, sameSite: 'lax', secure: secureCookie, path: '/' }); res.json({ ok: true }); });
  app.get('/api/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const s = getSession(req);
    res.json({ configured, authenticated: Boolean(s), user: s ? { id: s.user.id, username: s.user.global_name || s.user.username, handle: s.user.username, avatar: s.user.avatar ? `https://cdn.discordapp.com/avatars/${s.user.id}/${s.user.avatar}.png` : null } : null, loginUrl: '/auth/discord' });
  });
  app.get('/api/achievements/:guildId', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const view = req.query.view === 'server' ? 'server' : 'me';
      let guild, member = null;
      if (view === 'server') {
        guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) throw Object.assign(new Error('Kuboq no está instalado en este servidor.'), { status:404 });
      } else {
        const session = getSession(req);
        if (!session) throw Object.assign(new Error('Inicia sesión con Discord para consultar tus logros.'), { status:401 });
        req.session = session;
        ({ guild, member } = await getAchievementGuild(req, req.params.guildId));
      }
      const db = G(guild.id), achievements = Array.isArray(db.ach) ? db.ach.filter(item => item && typeof item === 'object') : [];
      const categoryFor = achievement => ACH_CATEGORIES[achievement.cat] ? achievement.cat : ACH_TYPE_CATEGORY[achievement.type] || 'chat';
      const describe = achievement => {
        const category = categoryFor(achievement), rarity = ACH_RARITY_POINTS[achievement.rar] ? achievement.rar : 'comun';
        return {
          id: String(achievement.id || ''), name: String(achievement.name || 'Logro'), description: String(achievement.desc || ''), type:String(achievement.type || ''),
          emoji: String(achievement.emoji || '🏆'), category, categoryLabel: ACH_CATEGORIES[category].label,
          rarity, points: Math.max(0, Number(achievement.pts ?? ACH_RARITY_POINTS[rarity]) || 0), target: Math.max(1, Number(achievement.value) || 1),
        };
      };
      const userData = db.users?.[member.id] || {};
      const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
      const joinedAt = member.joinedTimestamp || Date.now();
      const createdAt = member.user.createdTimestamp || Date.now();
      const stats = {
        msgs:safeNumber(userData.msgs), lvl:safeNumber(userData.lvl), coins:safeNumber(userData.coins) + safeNumber(userData.bank),
        invites:safeNumber(userData.inv) + safeNumber(userData.bonus) - safeNumber(userData.left), vmin:safeNumber(userData.vmin),
        mic:safeNumber(userData.mic), micon:safeNumber(userData.micon), cam:safeNumber(userData.cam), camon:safeNumber(userData.camon),
        strm:safeNumber(userData.strm), stron:safeNumber(userData.stron), days:Math.max(0, Math.floor((Date.now() - joinedAt) / 86400000)),
        acct:Math.max(0, Math.floor((Date.now() - createdAt) / 86400000)),
      };
      const unlocked = new Set(Array.isArray(userData.ach) ? userData.ach.map(String) : []);
      const decorated = achievements.map(raw => {
        const achievement = describe(raw), current = Math.max(0, safeNumber(stats[raw.type]));
        const isUnlocked = unlocked.has(achievement.id);
        return { ...achievement, unlocked:isUnlocked, current:Math.min(current, achievement.target), progress:isUnlocked ? 100 : Math.min(100, Math.round(current / achievement.target * 100)) };
      });
      res.setHeader('Cache-Control', 'no-store');
      if (view === 'server') {
        const users = Object.values(db.users || {});
        const denominator = Math.max(1, Number(guild.memberCount) || 0, users.length);
        const counts = new Map();
        for (const user of users) if (Array.isArray(user?.ach)) for (const id of user.ach) counts.set(String(id), (counts.get(String(id)) || 0) + 1);
        const results = decorated.map(({ unlocked, ...achievement }) => {
          const count = counts.get(achievement.id) || 0;
          return { ...achievement, current:count, total:denominator, progress:Math.min(100, Math.round(count / denominator * 100)) };
        });
        return res.json({ view, guild:{ id:guild.id, name:guild.name, icon:guild.iconURL({ size:128 }), memberCount:guild.memberCount }, achievements:results, total:results.length, unlocked:results.reduce((sum, item) => sum + item.current, 0) });
      }
      const done = decorated.filter(achievement => achievement.unlocked);
      res.json({ view, guild:{ id:guild.id, name:guild.name, icon:guild.iconURL({ size:128 }), memberCount:guild.memberCount }, user:{ id:member.id, name:member.displayName || member.user.globalName || member.user.username, avatar:member.displayAvatarURL({ size:128, extension:'png' }) }, achievements:decorated, total:decorated.length, unlocked:done.length, points:done.reduce((sum, item) => sum + item.points, 0) });
    } catch (error) { res.status(error.status || 500).json({ error:error.message || 'No se pudieron cargar los logros.' }); }
  });
  app.get('/api/guilds', auth, async (req, res) => {
    const result = [];
    for (const g of guildsFor(req.session)) {
      if (!hasManageGuild(g.permissions)) continue;
      const botGuild = client.guilds.cache.get(g.id); if (!botGuild) continue;
      result.push({ id: g.id, name: botGuild.name, icon: botGuild.iconURL({ size: 64 }), memberCount: botGuild.memberCount, bot: true });
    }
    res.json({ guilds: result });
  });
  app.get('/api/achievement-servers', auth, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const result = [];
    for (const oauthGuild of guildsFor(req.session)) {
      const guild = client.guilds.cache.get(oauthGuild.id);
      if (!guild) continue;
      result.push({ id:guild.id, name:guild.name, icon:guild.iconURL({ size:64 }), memberCount:guild.memberCount });
    }
    res.json({ guilds:result });
  });
  app.get('/api/guild/:id/summary', auth, async (req, res) => {
    try {
      const { guild } = await getAuthorizedGuild(req, req.params.id);
      const activity = activityCollection ? await activityCollection.countDocuments({ guildId: guild.id }) : 0;
      const recentActivity = activityCollection ? await activityCollection.find({ guildId: guild.id }, { projection: { userId: 1, usuario: 1, tipo: 1, nombre: 1, fecha: 1 } }).sort({ fecha: -1 }).limit(6).toArray() : [];
      res.setHeader('Cache-Control', 'no-store');
      res.json({ id: guild.id, name: guild.name, icon: guild.iconURL({ size: 64 }), memberCount: guild.memberCount, channels: guild.channels.cache.size, roles: guild.roles.cache.size, botUser: 'Kuboq', discordBotUsername: client.user?.username || null, botReady: Boolean(client.isReady?.()), user: { id: req.session.user.id, name: req.session.user.global_name || req.session.user.username }, commandCount: commandCatalog().length, uptime: process.uptime(), activity, recentActivity });
    }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get('/api/guild/:id/resources', auth, async (req, res) => {
    try {
      const { guild, member } = await getAuthorizedGuild(req, req.params.id);
      const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
      const [channels, roles, members] = await Promise.all([
        guild.channels.fetch().catch(() => guild.channels.cache), guild.roles.fetch().catch(() => guild.roles.cache), guild.members.fetch({ limit: 100 }).catch(() => guild.members.cache),
      ]);
      res.json({ channels: [...channels.values()].filter(x => x && botMember && !x.isThread?.() && x.permissionsFor(member)?.has(permissions.ViewChannel) && x.permissionsFor(botMember)?.has(permissions.ViewChannel)).map(x => ({ id:x.id,name:x.name,type:x.type,parentId:x.parentId,parentName:x.parent?.name||null,position:x.position })), roles:[...roles.values()].filter(x=>x).map(x=>({id:x.id,name:x.name,color:x.hexColor,position:x.position,hoist:x.hoist})), members:[...members.values()].filter(x=>x && !x.user.bot).slice(0,100).map(x=>({id:x.id,name:x.displayName})) });
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.get('/api/guild/:id/settings', auth, async (req, res) => {
    try {
      const { cfg, db } = await getAuthorizedGuild(req, req.params.id);
      res.json({
        identity: getIdentity(DB, req.params.id), dashboard: db.dashboard || {}, config: cfg,
        modules: {
          autoroles: db.autoroles || [], levelroles: db.levelroles || {},
          badwords: db.badwords || [], inviteRewards: db.invrew || {},
          achievements: (db.ach || []).map(a => ({ id:a.id, name:a.name, emoji:a.emoji, desc:a.desc, rar:a.rar })),
          store: (db.items || []).map(x => ({ name:x.name, price:x.price, type:x.type })),
          birthdayChannel: db.cumplech || null,
          automaticReplies: db.autoresp || {},
        },
      });
    }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.put('/api/guild/:id/welcome/:event', auth, csrf, async (req, res) => {
    try {
      const event = req.params.event;
      if (!['bienvenida','despedida'].includes(event)) throw Object.assign(new Error('Evento desconocido.'), {status:400});
      const {guild, member, cfg} = await getAuthorizedGuild(req, req.params.id, 'Administrator');
      limiter(req.session, guild.id);
      const body = req.body || {};
      const limits = {title:256,desc:4096,content:2000,author:256,footer:2048,img:1500,thumb:1500,dm:4096};
      const allowed = new Set(['ch','on','color','format',...Object.keys(limits)]);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key=>!allowed.has(key))) throw Object.assign(new Error('Opciones de bienvenida inválidas.'), {status:400});
      const clean = {};
      for (const [key,limit] of Object.entries(limits)) if (key in body) {
        if (typeof body[key] !== 'string' || body[key].length > limit) throw Object.assign(new Error(`El campo ${key} supera el límite permitido.`), {status:400});
        clean[key] = body[key];
      }
      if ('on' in body) { if (typeof body.on !== 'boolean') throw Object.assign(new Error('Estado inválido.'), {status:400}); clean.on=body.on; }
      if ('color' in body) { if (typeof body.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(body.color)) throw Object.assign(new Error('Usa un color hexadecimal #RRGGBB.'), {status:400}); clean.color=body.color; }
      if ('format' in body && !OUTPUT_FORMATS.has(body.format)) throw Object.assign(new Error('Formato de mensaje inválido.'),{status:400});
      for (const key of ['img','thumb']) if (key in clean && clean[key] && !clean[key].split('|').every(value=>/^(avatar|servidor|ningun[oa]|none|quitar)$/i.test(value.trim()) || /^https?:\/\/[^\s<>"']+$/i.test(value.trim()))) throw Object.assign(new Error(`La imagen ${key} debe ser una URL o avatar/servidor/ninguna.`), {status:400});
      if ('ch' in body) {
        if (body.ch !== null && typeof body.ch !== 'string') throw Object.assign(new Error('Canal inválido.'), {status:400});
        const channel=body.ch ? await guild.channels.fetch(body.ch).catch(()=>null) : null;
        if (body.ch && (!channel?.isTextBased?.() || channel.isThread?.())) throw Object.assign(new Error('Selecciona un canal de texto del servidor.'), {status:400});
        if (channel) {
          const bot=guild.members.me || await guild.members.fetchMe();
          const needed=[permissions.ViewChannel,permissions.SendMessages,permissions.EmbedLinks];
          if(body.format==='card')needed.push(permissions.AttachFiles);
          if (!channel.permissionsFor(member)?.has(permissions.ViewChannel) || !channel.permissionsFor(bot)?.has(needed)) throw Object.assign(new Error('Faltan permisos para publicar en ese canal (las cards necesitan Adjuntar archivos).'), {status:403});
        }
        clean.ch=channel?.id||null;
      }
      Object.assign(cfg[event==='bienvenida'?'wb':'bye']??={},clean);
      if('format' in body)(cfg.messageFormats??={})[event]=body.format;
      save();
      await recordRequestActivity(req,guild.id,'configuracion',`${event==='bienvenida'?'Bienvenida':'Despedida'} actualizada`);
      res.json({ok:true,config:cfg[event==='bienvenida'?'wb':'bye'],format:cfg.messageFormats?.[event]||'embed'});
    } catch(e) { res.status(e.status||400).json({error:e.message||'No se pudo guardar.'}); }
  });
  app.put('/api/guild/:id/autoroles', auth, csrf, async (req, res) => {
    try {
      const {guild, db, cfg}=await getAuthorizedGuild(req,req.params.id,'Administrator');
      limiter(req.session,guild.id);
      const {roles,botRole}=req.body||{};
      if(!Array.isArray(roles)||roles.length>25||roles.some(id=>typeof id!=='string')||!(botRole===null||typeof botRole==='string')) throw Object.assign(new Error('Selecciona roles válidos.'),{status:400});
      if(new Set(roles).size!==roles.length) throw Object.assign(new Error('Hay roles repetidos.'),{status:400});
      const me=guild.members.me||await guild.members.fetchMe();
      if(!me.permissions.has(permissions.ManageRoles)) throw Object.assign(new Error('El bot necesita Gestionar roles.'),{status:403});
      for(const id of [...roles,...(botRole?[botRole]:[])]){
        const role=await guild.roles.fetch(id).catch(()=>null);
        if(!role||role.id===guild.id||role.managed||role.comparePositionTo(me.roles.highest)>=0) throw Object.assign(new Error('Un rol no se puede asignar: revisa su posición y si lo administra una integración.'),{status:400});
      }
      db.autoroles=roles;
      cfg.botrole=botRole||null;
      save();
      await recordRequestActivity(req,guild.id,'configuracion','Autoroles actualizados');
      res.json({ok:true,roles:db.autoroles,botRole:cfg.botrole});
    }catch(e){res.status(e.status||400).json({error:e.message||'No se pudieron guardar los autoroles.'});}
  });
  app.put('/api/guild/:id/panel/:system', auth, csrf, async (req,res) => {
    try {
      const system=req.params.system;
      if(!['ticket','verif'].includes(system)) throw Object.assign(new Error('Sistema desconocido.'),{status:400});
      const {guild,member,cfg}=await getAuthorizedGuild(req,req.params.id,'Administrator');
      limiter(req.session,guild.id);
      const {embed,setup,format}=req.body||{};
      if(!embed||typeof embed!=='object'||Array.isArray(embed)||!setup||typeof setup!=='object'||Array.isArray(setup)) throw Object.assign(new Error('Configuración inválida.'),{status:400});
      if(!OUTPUT_FORMATS.has(format))throw Object.assign(new Error('Selecciona un formato de mensaje válido.'),{status:400});
      const textLimits={title:256,desc:4096,banner:500,img:500,thumb:500,footer:2048,btn:80,menu:100,welcome:2000};
      const embedKeys=new Set([...Object.keys(textLimits),'color']);
      const setupKeys=new Set(system==='ticket'?['cat','role','log','max']:['ch','role','mode']);
      if(Object.keys(embed).some(k=>!embedKeys.has(k))||Object.keys(setup).some(k=>!setupKeys.has(k))) throw Object.assign(new Error('Campos desconocidos.'),{status:400});
      const clean={};
      for(const [key,limit] of Object.entries(textLimits)) if(key in embed){
        if(typeof embed[key]!=='string'||embed[key].length>limit) throw Object.assign(new Error(`El campo ${key} es demasiado largo.`),{status:400});
        clean[key]=embed[key];
      }
      if('color' in embed){if(typeof embed.color!=='string'||!/^#[0-9a-f]{6}$/i.test(embed.color)) throw Object.assign(new Error('Color inválido: usa #RRGGBB.'),{status:400});clean.color=parseInt(embed.color.slice(1),16);}
      for(const key of ['banner','img','thumb']) if(clean[key]&&!/^https?:\/\/[^\s"'<>]+$/i.test(clean[key])) throw Object.assign(new Error(`La imagen ${key} debe ser una URL HTTP(S).`),{status:400});
      const resolveChannel=async(id,type)=>{
        if(id===null||id==='')return null;
        if(typeof id!=='string')throw Object.assign(new Error('Canal inválido.'),{status:400});
        const channel=await guild.channels.fetch(id).catch(()=>null);
        if(!channel||(type==='category'?channel.type!==4:!channel.isTextBased?.()||channel.isThread?.())) throw Object.assign(new Error('Selecciona un canal del tipo correcto.'),{status:400});
        if(!channel.permissionsFor(member)?.has(permissions.ViewChannel)) throw Object.assign(new Error('No puedes acceder a ese canal.'),{status:403});
        return channel;
      };
      const resolveRole=async id=>{
        if(id===null||id==='')return null;
        if(typeof id!=='string')throw Object.assign(new Error('Rol inválido.'),{status:400});
        const role=await guild.roles.fetch(id).catch(()=>null);
        if(!role||role.id===guild.id)throw Object.assign(new Error('Selecciona un rol del servidor.'),{status:400});
        return role;
      };
      if(system==='ticket'){
        const tk=cfg.tk??={max:1,n:0,emb:{}};
        const next={};
        if('cat' in setup)next.cat=(await resolveChannel(setup.cat,'category'))?.id||null;
        if('log' in setup)next.log=(await resolveChannel(setup.log,'text'))?.id||null;
        if('role' in setup)next.role=(await resolveRole(setup.role))?.id||null;
        if('max' in setup){if(!Number.isInteger(setup.max)||setup.max<1||setup.max>50)throw Object.assign(new Error('El límite debe estar entre 1 y 50.'),{status:400});next.max=setup.max;}
        Object.assign(tk,next);
        Object.assign(tk.emb??={},clean);
      }else{
        const ch='ch' in setup?await resolveChannel(setup.ch,'text'):null;
        const role='role' in setup?await resolveRole(setup.role):null;
        if((ch&&!role)||(!ch&&role))throw Object.assign(new Error('Verificación necesita canal y rol.'),{status:400});
        if(ch&&role){
          const bot=guild.members.me||await guild.members.fetchMe();
          const needed=[permissions.ViewChannel,permissions.SendMessages,permissions.EmbedLinks];
          if(format==='card')needed.push(permissions.AttachFiles);
          if(!ch.permissionsFor(bot)?.has(needed)||!bot.permissions.has(permissions.ManageRoles)||role.managed||role.comparePositionTo(bot.roles.highest)>=0)throw Object.assign(new Error('El bot necesita permisos para publicar y asignar ese rol (las cards requieren Adjuntar archivos).'),{status:403});
          cfg.v={ch:ch.id,role:role.id,mode:['boton','codigo','captcha'].includes(setup.mode)?setup.mode:'boton'};
        }
        Object.assign(cfg.vemb??={},clean);
      }
      (cfg.messageFormats??={})[system]=format;
      save();await recordRequestActivity(req,guild.id,'configuracion',`Panel de ${system==='ticket'?'tickets':'verificación'} actualizado`);res.json({ok:true,format,config:system==='ticket'?cfg.tk:{v:cfg.v,vemb:cfg.vemb}});
    }catch(e){res.status(e.status||400).json({error:e.message||'No se pudo guardar el panel.'});}
  });
  app.put('/api/guild/:id/application', auth, csrf, async(req,res)=>{
    try{
      const {guild,cfg}=await getAuthorizedGuild(req,req.params.id,'Administrator');
      limiter(req.session,guild.id);
      const body=req.body||{},keys=new Set(['format','title','desc','img','web','solo_web']);
      if(typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!keys.has(key)))throw Object.assign(new Error('Campos desconocidos.'),{status:400});
      if(!OUTPUT_FORMATS.has(body.format))throw Object.assign(new Error('Formato inválido.'),{status:400});
      const limits={title:200,desc:1500,img:500,web:500},clean={};
      for(const [key,max] of Object.entries(limits)){
        if(typeof body[key]!=='string'||body[key].length>max)throw Object.assign(new Error(`Valor inválido: ${key}.`),{status:400});
        clean[key]=body[key].trim();
      }
      for(const key of ['img','web'])if(clean[key]&&!/^https?:\/\/[^\s"'<>]+$/i.test(clean[key]))throw Object.assign(new Error(`La URL de ${key} debe ser HTTP(S).`),{status:400});
      if(typeof body.solo_web!=='boolean')throw Object.assign(new Error('Estado del botón web inválido.'),{status:400});
      clean.solo_web=body.solo_web;
      Object.assign(cfg.app??={pos:[],q:['¿Edad y zona horaria?','¿Por qué quieres ser staff?','¿Qué experiencia tienes moderando?','¿Cómo manejarías un conflicto?','¿Cuánto tiempo puedes dedicar?'],cool:24},clean);
      (cfg.messageFormats??={}).application=body.format;
      save();await recordRequestActivity(req,guild.id,'configuracion','Postulaciones actualizadas');res.json({ok:true,config:cfg.app,format:body.format});
    }catch(e){res.status(e.status||400).json({error:e.message||'No se pudieron guardar las postulaciones.'});}
  });
  app.put('/api/guild/:id/birthday',auth,csrf,async(req,res)=>{
    try{
      const {guild,db,cfg}=await getAuthorizedGuild(req,req.params.id,'ManageGuild');limiter(req.session,guild.id);
      const body=req.body||{};
      if(Object.keys(body).some(k=>!['channelId','message','format'].includes(k))||!OUTPUT_FORMATS.has(body.format)||typeof body.message!=='string'||body.message.length>1500||!body.message.trim())throw Object.assign(new Error('Configuración de cumpleaños inválida.'),{status:400});
      if(body.channelId!==null&&typeof body.channelId!=='string')throw Object.assign(new Error('Canal inválido.'),{status:400});
      const channel=body.channelId?await guild.channels.fetch(body.channelId).catch(()=>null):null;
      if(body.channelId&&(!channel||![0,5].includes(channel.type)))throw Object.assign(new Error('Selecciona un canal de texto.'),{status:400});
      if(channel){const needed=[permissions.ViewChannel,permissions.SendMessages,permissions.EmbedLinks];if(body.format==='card')needed.push(permissions.AttachFiles);if(!channel.permissionsFor(guild.members.me)?.has(needed))throw Object.assign(new Error('El bot necesita publicar mensajes y, para cards, adjuntar archivos.'),{status:403});}
      db.cumplech=channel?.id||null;cfg.birthdayMessage=body.message;(cfg.messageFormats??={}).cumple=body.format;save();
      await recordRequestActivity(req,guild.id,'configuracion','Cumpleaños actualizados');
      res.json({ok:true,channelId:db.cumplech,format:body.format,message:cfg.birthdayMessage});
    }catch(e){res.status(e.status||400).json({error:e.message||'No se pudo guardar cumpleaños.'});}
  });
  app.put('/api/guild/:id/automatic-replies',auth,csrf,async(req,res)=>{
    try{
      const {guild,db,cfg}=await getAuthorizedGuild(req,req.params.id,'ManageMessages');limiter(req.session,guild.id);
      const body=req.body||{},entries=body.entries;
      if(Object.keys(body).some(k=>!['format','entries'].includes(k))||!OUTPUT_FORMATS.has(body.format)||!entries||typeof entries!=='object'||Array.isArray(entries)||Object.keys(entries).length>100)throw Object.assign(new Error('Configuración de respuestas inválida.'),{status:400});
      const clean={};
      for(const [raw,value] of Object.entries(entries)){
        const key=raw.trim().toLowerCase();
        if(!key||key.length>80||typeof value!=='string'||!value.trim()||value.length>1500||key in clean)throw Object.assign(new Error('Cada palabra necesita una respuesta válida (máximo 1500 caracteres).'),{status:400});
        clean[key]=value.trim();
      }
      db.autoresp=clean;(cfg.messageFormats??={}).respondedor=body.format;save();await recordRequestActivity(req,guild.id,'configuracion','Respuestas automáticas actualizadas');res.json({ok:true,entries:clean,format:body.format});
    }catch(e){res.status(e.status||400).json({error:e.message||'No se pudieron guardar las respuestas.'});}
  });
  app.put('/api/guild/:id/settings', auth, csrf, async (req, res) => {
    try {
      const { guild, db } = await getAuthorizedGuild(req, req.params.id); limiter(req.session, req.params.id);
      const body = validateTree(req.body || {});
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('La configuración debe ser un objeto.'), {status:400});
      if (body.identity) {
        const p = body.identity;
        if (p.name !== undefined && (typeof p.name !== 'string' || p.name.length < 1 || p.name.length > 80)) throw Object.assign(new Error('El nombre debe tener de 1 a 80 caracteres.'), { status: 400 });
        if (p.color !== undefined && !/^#[0-9a-f]{6}$/i.test(p.color)) throw Object.assign(new Error('Usa un color hexadecimal, por ejemplo #39c7b1.'), { status: 400 });
        if (p.logoUrl !== undefined && p.logoUrl && (!/^https:\/\//i.test(p.logoUrl) || p.logoUrl.length > 500)) throw Object.assign(new Error('El logo debe ser un enlace HTTPS.'), { status: 400 });
        if (p.description !== undefined && p.description.length > 500) throw Object.assign(new Error('La descripción puede tener hasta 500 caracteres.'), { status: 400 });
        setIdentity(DB, req.params.id, p, save);
      }
      if (body.dashboard) {
        const allowed = ['accent','density','hiddenModules','brandCaption','layout'];
        const clean = Object.fromEntries(Object.entries(body.dashboard).filter(([k]) => allowed.includes(k)));
        if (clean.accent && !/^#[0-9a-f]{6}$/i.test(clean.accent)) throw Object.assign(new Error('El color del panel no es válido.'), { status: 400 });
        if (clean.density && !['comfortable','compact'].includes(clean.density)) throw Object.assign(new Error('La densidad del panel no es válida.'), { status: 400 });
        if (clean.hiddenModules && (!Array.isArray(clean.hiddenModules) || clean.hiddenModules.length > 100 || clean.hiddenModules.some(x => typeof x !== 'string'))) throw Object.assign(new Error('Módulos ocultos inválidos.'), { status: 400 });
        db.dashboard = { ...(db.dashboard || {}), ...clean }; save();
      }
      if (body.config) {
        const cfgPatch = body.config;
        for (const key of Object.keys(cfgPatch)) if (!ALLOWED_CFG.has(key)) throw Object.assign(new Error(`El ajuste ${key} no se puede cambiar desde el panel.`), { status: 400 });
        for (const [key,value] of Object.entries(cfgPatch)) {
          if (key==='color' && (typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))) throw Object.assign(new Error('Color hexadecimal inválido.'),{status:400});
        }
        merge(C(req.params.id), cfgPatch); save();
      }
      if (Object.keys(body).length) await recordRequestActivity(req,guild.id,'configuracion','Ajustes generales del panel actualizados');
      res.json({ ok:true, identity:getIdentity(DB,req.params.id), dashboard:db.dashboard || {}, config:C(req.params.id) });
    } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  app.get('/api/guild/:id/commands', auth, async (req, res) => {
    try { await getAuthorizedGuild(req, req.params.id); res.json({ commands:commandCatalog() }); }
    catch (e) { res.status(e.status || 500).json({ error:e.message }); }
  });
  app.put('/api/guild/:id/achievements/design', auth, csrf, async (req,res) => {
    try {
      const { guild, cfg } = await getAuthorizedGuild(req, req.params.id, 'Administrator');
      limiter(req.session, guild.id);
      const body = validateTree(req.body || {}), keys = new Set(['color','label','headline','format']);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.has(key))) throw Object.assign(new Error('La configuración de la tarjeta de logros no es válida.'), {status:400});
      if (typeof body.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(body.color)) throw Object.assign(new Error('El color debe ser hexadecimal, por ejemplo #8b3dff.'), {status:400});
      if (typeof body.label !== 'string' || !body.label.trim() || body.label.trim().length > 60) throw Object.assign(new Error('El título de la tarjeta debe tener entre 1 y 60 caracteres.'), {status:400});
      if (typeof body.headline !== 'string' || !body.headline.trim() || body.headline.trim().length > 250) throw Object.assign(new Error('El mensaje superior debe tener entre 1 y 250 caracteres.'), {status:400});
      if (!OUTPUT_FORMATS.has(body.format)) throw Object.assign(new Error('Elige tarjeta de imagen, Components V2, embed o solo texto.'), {status:400});
      cfg.achcolor = body.color;
      cfg.achlabel = body.label.trim();
      cfg.achhead = body.headline.trim();
      (cfg.messageFormats ??= {}).logro = body.format;
      save();
      await recordRequestActivity(req, guild.id, 'configuracion', 'Diseño de logros actualizado');
      res.json({ok:true,design:{color:cfg.achcolor,label:cfg.achlabel,headline:cfg.achhead,format:cfg.messageFormats.logro}});
    } catch (error) { res.status(error.status || 400).json({error:error.message || 'No se pudo guardar el diseño de logros.'}); }
  });
  app.put('/api/guild/:id/levels', auth, csrf, async (req,res) => {
    try {
      const { guild, member, db, cfg } = await getAuthorizedGuild(req,req.params.id,'Administrator');
      limiter(req.session,guild.id);
      const body=validateTree(req.body||{});
      const keys=new Set(['enabled','xpPerMessage','channelId','announcement','card','rewards']);
      if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!keys.has(key))) throw Object.assign(new Error('La configuración de niveles no es válida.'),{status:400});
      if(typeof body.enabled!=='boolean') throw Object.assign(new Error('El estado de niveles debe ser activado o desactivado.'),{status:400});
      if(!Number.isInteger(body.xpPerMessage)||body.xpPerMessage<1||body.xpPerMessage>100) throw Object.assign(new Error('La XP por mensaje debe estar entre 1 y 100.'),{status:400});
      if(!(body.channelId===null||typeof body.channelId==='string')) throw Object.assign(new Error('El canal de avisos no es válido.'),{status:400});
      const textChannel=body.channelId?await guild.channels.fetch(body.channelId).catch(()=>null):null;
      if(body.channelId&&(!textChannel||![0,5].includes(textChannel.type)||textChannel.isThread?.())) throw Object.assign(new Error('Selecciona un canal de texto para los avisos de nivel.'),{status:400});
      if(textChannel){
        const needed=[permissions.ViewChannel,permissions.SendMessages,permissions.EmbedLinks];
        if(!textChannel.permissionsFor(member)?.has(permissions.ViewChannel)||!textChannel.permissionsFor(guild.members.me)?.has(needed)) throw Object.assign(new Error('El miembro y el bot necesitan acceso al canal; el bot también debe poder enviar mensajes e insertar enlaces.'),{status:403});
      }
      const announcement=body.announcement,announcementKeys=new Set(['title','message','image']);
      if(!announcement||typeof announcement!=='object'||Array.isArray(announcement)||Object.keys(announcement).some(key=>!announcementKeys.has(key))) throw Object.assign(new Error('Los avisos de nivel no son válidos.'),{status:400});
      for(const [key,max] of Object.entries({title:256,message:2000,image:1500})) if(typeof announcement[key]!=='string'||announcement[key].length>max) throw Object.assign(new Error(`El campo de aviso ${key} no es válido.`),{status:400});
      if(announcement.image&&!/^https:\/\/[^\s"'<>]+$/i.test(announcement.image)) throw Object.assign(new Error('La imagen del aviso debe ser una URL HTTPS.'),{status:400});
      const card=body.card,cardKeys=new Set(['background','brand','leftText','rightText','hideNewLevel','color']);
      if(!card||typeof card!=='object'||Array.isArray(card)||Object.keys(card).some(key=>!cardKeys.has(key))) throw Object.assign(new Error('El diseño de la tarjeta no es válido.'),{status:400});
      for(const [key,max] of Object.entries({background:1500,brand:30,leftText:40,rightText:40})) if(typeof card[key]!=='string'||card[key].length>max) throw Object.assign(new Error(`El campo de tarjeta ${key} no es válido.`),{status:400});
      if(card.background&&!/^https:\/\/[^\s"'<>]+$/i.test(card.background)) throw Object.assign(new Error('El fondo debe ser una URL HTTPS.'),{status:400});
      if(typeof card.hideNewLevel!=='boolean'||typeof card.color!=='string'||!/^#[0-9a-f]{6}$/i.test(card.color)) throw Object.assign(new Error('El color o la opción NUEVO NIVEL no son válidos.'),{status:400});
      if(!Array.isArray(body.rewards)||body.rewards.length>50) throw Object.assign(new Error('Configura hasta 50 recompensas de nivel.'),{status:400});
      const nextRewards={},levels=new Set();
      const bot=guild.members.me;
      if(body.rewards.length&&!bot.permissions.has(permissions.ManageRoles)) throw Object.assign(new Error('El bot necesita Gestionar roles para asignar recompensas de nivel.'),{status:403});
      for(const row of body.rewards){
        if(!row||typeof row!=='object'||Array.isArray(row)||!Number.isInteger(row.level)||row.level<1||row.level>10000||typeof row.roleId!=='string') throw Object.assign(new Error('Cada recompensa necesita un nivel válido y un rol.'),{status:400});
        if(levels.has(row.level)) throw Object.assign(new Error(`El nivel ${row.level} aparece más de una vez.`),{status:400});
        levels.add(row.level);
        const role=await guild.roles.fetch(row.roleId).catch(()=>null);
        if(!role||role.id===guild.id||role.managed||role.comparePositionTo(bot.roles.highest)>=0) throw Object.assign(new Error('Uno de los roles no existe, lo administra una integración o está por encima del rol del bot.'),{status:400});
        nextRewards[row.level]=role.id;
      }
      cfg.lvlon=body.enabled;
      cfg.xprate=body.xpPerMessage;
      cfg.lvlch=textChannel?.id||null;
      cfg.lvlmsg=announcement.message;
      cfg.lvltitle=announcement.title;
      cfg.lvlimg=announcement.image;
      cfg.tarjeta={...(cfg.tarjeta||{}),fondo:card.background||undefined,marca:card.brand,izq:card.leftText,der:card.rightText,sinnuevo:card.hideNewLevel,color:card.color};
      for(const key of ['fondo']) if(!cfg.tarjeta[key]) delete cfg.tarjeta[key];
      db.levelroles=nextRewards;
      save();
      await recordRequestActivity(req,guild.id,'configuracion','Configuración de Niveles y XP actualizada');
      res.json({ok:true,config:cfg,levelroles:db.levelroles});
    }catch(e){res.status(e.status||400).json({error:e.message||'No se pudo guardar Niveles y XP.'});}
  });
  app.get('/api/guild/:id/activity', auth, async (req, res) => {
    try {
      const { guild } = await getAuthorizedGuild(req, req.params.id);
      if (!activityCollection) return res.json({ activity: [] });
      const items = await activityCollection.find({ guildId: guild.id }, { projection: { userId: 1, usuario: 1, tipo: 1, nombre: 1, fecha: 1 } }).sort({ fecha: -1 }).limit(50).toArray();
      res.setHeader('Cache-Control', 'no-store');
      res.json({ activity: items });
    } catch (e) { res.status(e.status || 500).json({ error:e.message }); }
  });

  async function resolveOptions(guild, spec, provided) {
    const result = {};
    for (const o of spec || []) {
      const raw = provided?.[o.n];
      if ((raw === undefined || raw === null || raw === '') && o.r) throw Object.assign(new Error(`Falta completar ${o.n}.`), { status:400 });
      if (raw === undefined || raw === null || raw === '') { result[o.n] = null; continue; }
      if (o.t === 's') result[o.n] = String(raw).slice(0, 4000);
      else if (o.t === 'i') { const n = Number(raw); if (!Number.isInteger(n)) throw Object.assign(new Error(`${o.n} debe ser un número entero.`), { status:400 }); result[o.n] = n; }
      else if (o.t === 'b') result[o.n] = raw === true || raw === 'true';
      else if (o.t === 'c') { const v = String(raw).replace(/[<#>]/g,''); result[o.n] = await guild.channels.fetch(v).catch(()=>null); if (!result[o.n]) throw Object.assign(new Error(`No encontré el canal de ${o.n}.`), { status:400 }); }
      else if (o.t === 'r') { const v = String(raw).replace(/[<@&>]/g,''); result[o.n] = await guild.roles.fetch(v).catch(()=>null); if (!result[o.n]) throw Object.assign(new Error(`No encontré el rol de ${o.n}.`), { status:400 }); }
      else if (o.t === 'u') { const v = String(raw).replace(/[<@!>]/g,''); result[o.n] = await guild.members.fetch(v).then(m=>m.user).catch(()=>null); if (!result[o.n]) throw Object.assign(new Error(`No encontré el miembro de ${o.n}.`), { status:400 }); }
    }
    return result;
  }
  function syntheticInteraction({ guild, member, channel, sendChannel = null, user, responses, modalRef, pendingReplies = [], modalFields = null, commandName, subcommand, customId = null }) {
    let deferredEphemeral = false;
    const respond = payload => {
      const result = (async () => {
        const response = responseText(payload);
        const message = typeof payload === 'string' ? { content: payload } : payload;
        if (sendChannel && !response.ephemeral) {
          const sent = await sendChannel.send({ ...message, allowedMentions: { parse: [] } });
          responses.push(response);
          return payload?.withResponse ? { resource: { message: sent } } : sent;
        }
        responses.push(response);
        return { id:'dashboard-response', ...response };
      })();
      pendingReplies.push(result);
      return result;
    };
    const i = {
      guild, guildId:guild.id, member, user, channel, channelId:channel?.id, client, commandName, customId, createdTimestamp:Date.now(), replied:false, deferred:false,
      isModalSubmit:()=>Boolean(modalFields), isButton:()=>false, isStringSelectMenu:()=>false, isChatInputCommand:()=>Boolean(commandName), isFromMessage:()=>false,
      fields:{ fields:new Map(Object.entries(modalFields || {}).map(([id,value])=>[id,{customId:id,value:String(value)}])), getTextInputValue:id=>{ if (!(id in (modalFields || {}))) throw new Error(`Falta el campo ${id}.`); return String(modalFields[id]); } },
      options:{ getSubcommand:()=>subcommand || null },
      reply:payload=>{ i.replied=true; return respond(payload); },
      followUp:payload=>respond(payload),
      deferReply:async payload=>{ i.deferred=true; deferredEphemeral=Boolean(Number(payload?.flags || 0) & 64); return { id:'dashboard-deferred' }; },
      editReply:payload=>respond(deferredEphemeral ? { ...(typeof payload === 'string' ? { content:payload } : payload), flags:64 } : payload),
      fetchReply:async()=>({id:'dashboard-response'}),
      showModal:async modal=>{ modalRef.value = serial(modal); return { modal:modalRef.value }; },
      deferUpdate:async()=>({}), update:async payload=>{ const r=responseText(payload); responses.push(r); return r; },
    };
    return i;
  }
  app.post('/api/guild/:id/commands/run', auth, csrf, async (req, res) => {
    try {
      limiter(req.session, req.params.id);
      const { guild, member } = await getAuthorizedGuild(req, req.params.id);
      const { category, name, options = {}, channelId, publish = false } = req.body || {};
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw Object.assign(new Error('Solicitud inválida.'), {status:400});
      if (category === 'musica') return res.status(400).json({ error:'Usa los controles del módulo Música.' });
      const command = CATS[category]?.[ROOT.has(category) ? 'run' : name];
      if (DISCORD_ONLY.has(`${category}.${ROOT.has(category) ? 'run' : name}`)) return res.status(400).json({ error: DISCORD_ONLY.get(`${category}.${ROOT.has(category) ? 'run' : name}`) });
      if (!command) return res.status(404).json({ error:'Ese comando ya no está registrado.' });
      if (command.perm && !member.permissions.has(permissions[command.perm])) throw Object.assign(new Error(`Este comando requiere el permiso ${command.perm}.`), { status:403 });
      if (!options || typeof options !== 'object' || Array.isArray(options)) throw Object.assign(new Error('Opciones inválidas.'), { status:400 });
      if (channelId != null && (typeof channelId !== 'string' || !/^\d{15,25}$/.test(channelId))) throw Object.assign(new Error('El canal seleccionado no es válido.'), {status:400});
      const sendChannel = channelId ? await guild.channels.fetch(channelId).catch(()=>null) : null;
      if (channelId && !sendChannel?.isTextBased?.()) throw Object.assign(new Error('Selecciona un canal de texto para ejecutar el comando.'), { status:400 });
      if (publish !== true && publish !== false) throw Object.assign(new Error('Publicación inválida.'), {status:400});
      if (publish && !sendChannel) throw Object.assign(new Error('Selecciona el canal de publicación.'), {status:400});
      if (sendChannel && !sendChannel.permissionsFor(member)?.has(permissions.ViewChannel)) throw Object.assign(new Error('No puedes acceder a ese canal.'), { status:403 });
      if (sendChannel && !sendChannel.permissionsFor(guild.members.me)?.has(permissions.ViewChannel)) throw Object.assign(new Error('El bot no puede ver ese canal.'), {status:403});
      if(publish&&!sendChannel.permissionsFor(guild.members.me)?.has([permissions.ViewChannel,permissions.SendMessages,permissions.EmbedLinks]))throw Object.assign(new Error('El bot necesita Ver canal, Enviar mensajes e Insertar enlaces para publicar ahí.'),{status:403});
      const values = await resolveOptions(guild, command.spec, options);
      const commandId = `${category}.${ROOT.has(category) ? 'run' : name}`;
      const requiredTargetOption = REQUIRED_TARGET_CHANNEL_OPTIONS.get(commandId);
      if (requiredTargetOption && !values[requiredTargetOption]) throw Object.assign(new Error(`Selecciona el canal de destino en ${requiredTargetOption}.`), {status:400});
      const channelOptions = Object.values(values).filter(value => typeof value?.permissionsFor === 'function');
      for (const optionChannel of channelOptions) {
        if (!optionChannel.permissionsFor(member)?.has(permissions.ViewChannel)) throw Object.assign(new Error('No puedes acceder a uno de los canales seleccionados.'), {status:403});
        if (!optionChannel.permissionsFor(guild.members.me)?.has(permissions.ViewChannel)) throw Object.assign(new Error('El bot no puede ver uno de los canales seleccionados.'), {status:403});
      }
      const contextRequired = CONTEXT_CHANNEL_COMMANDS.has(`${category}.${ROOT.has(category) ? 'run' : name}`);
      const optionChannel = [values.canal, values.texto].find(value => value?.isTextBased?.() && !value.isThread?.()) || null;
      const contextChannel = (channelId ? sendChannel : null) || optionChannel || sendChannel;
      if (contextRequired && !contextChannel) throw Object.assign(new Error('Selecciona un canal de texto visible para tu usuario y para el bot. Así la acción se ejecuta en el lugar correcto.'), {status:400});
      const fallback = contextRequired ? null : [guild.systemChannel,...guild.channels.cache.values()].find(ch=>ch?.isTextBased?.()&&!ch.isThread?.()&&ch.permissionsFor(member)?.has(permissions.ViewChannel)&&ch.permissionsFor(guild.members.me)?.has(permissions.ViewChannel));
      const channel = contextChannel || fallback;
      if (!channel) throw Object.assign(new Error('Selecciona el canal donde se realizará la acción.'), {status:400});
      if (!channel.permissionsFor(member)?.has(permissions.ViewChannel)) throw Object.assign(new Error('No puedes acceder a ese canal.'), {status:403});
      if (!channel.permissionsFor(guild.members.me)?.has(permissions.ViewChannel)) throw Object.assign(new Error('El bot no puede ver ese canal.'), {status:403});
      const targetChannel = [values.canal,values.texto].find(value => typeof value?.permissionsFor === 'function') || channel;
      const botChannelPermissions = targetChannel.permissionsFor(guild.members.me);
      const requiredBotPermissions = BOT_CHANNEL_PERMISSIONS.get(commandId) || [];
      const missingBotPermissions = requiredBotPermissions.filter(permission => !botChannelPermissions?.has(permissions[permission]));
      if (missingBotPermissions.length) {
        const labels = {ReadMessageHistory:'Leer el historial',ManageMessages:'Gestionar mensajes',ManageChannels:'Gestionar canales',SendMessages:'Enviar mensajes',EmbedLinks:'Insertar enlaces'};
        throw Object.assign(new Error(`Al bot le faltan permisos en #${targetChannel.name}: ${missingBotPermissions.map(permission => labels[permission] || permission).join(', ')}.`), {status:403});
      }
      const user = await client.users.fetch(req.session.user.id);
      const responses = [], modalRef = { value:null }, pendingReplies = [], subcommand = ROOT.has(category) ? null : name;
      const i = syntheticInteraction({ guild, member, channel, sendChannel:publish?sendChannel:null, user, responses, modalRef, pendingReplies, commandName:category, subcommand });
      req.session.pendingModal = null;
      await command.run(i, values, G(guild.id), C(guild.id));
      await Promise.all(pendingReplies);
      await recordDashboardActivity(guild.id, user, 'comando', `/${category}${ROOT.has(category) ? '' : ` ${name}`}`);
      if (modalRef.value) req.session.pendingModal = { guildId:guild.id, modal:modalRef.value, category, name, permission:command.perm || null, channelId:channel?.id, responseChannelId:sendChannel?.id || null };
      res.json({ ok:true, responses, modal:modalRef.value, note:responses.length ? undefined : 'El comando se ejecutó.' });
    } catch (e) { console.error('[dashboard/command]', e.message); res.status(e.status || 500).json({ error:e.message || 'No se pudo ejecutar el comando.' }); }
  });
  app.post('/api/guild/:id/commands/modal', auth, csrf, async (req, res) => {
    try {
      limiter(req.session, req.params.id);
      const pending = req.session.pendingModal;
      if (!pending || pending.guildId !== req.params.id) throw Object.assign(new Error('No hay un formulario pendiente. Abre el comando otra vez.'), { status:400 });
      const { guild, member } = await getAuthorizedGuild(req, pending.guildId, pending.permission);
      const channel = pending.channelId ? await guild.channels.fetch(pending.channelId).catch(()=>null) : null;
      if (!channel?.permissionsFor(member)?.has(permissions.ViewChannel)) throw Object.assign(new Error('Ya no puedes acceder a ese canal.'), { status:403 });
      if (!channel.permissionsFor(guild.members.me)?.has(permissions.ViewChannel)) throw Object.assign(new Error('El bot ya no puede ver el canal de contexto.'), {status:403});
      const sendChannel = pending.responseChannelId ? await guild.channels.fetch(pending.responseChannelId).catch(()=>null) : null;
      if (pending.responseChannelId && !sendChannel?.isTextBased?.()) throw Object.assign(new Error('El canal de respuesta ya no está disponible.'), {status:400});
      if (sendChannel && !sendChannel.permissionsFor(member)?.has(permissions.ViewChannel)) throw Object.assign(new Error('Ya no puedes acceder al canal de respuesta.'), {status:403});
      if (sendChannel && !sendChannel.permissionsFor(guild.members.me)?.has([permissions.ViewChannel,permissions.SendMessages,permissions.EmbedLinks])) throw Object.assign(new Error('El bot ya no tiene permisos para responder en ese canal.'), {status:403});
      const user = await client.users.fetch(req.session.user.id);
      const responses=[], modalRef={value:null}, pendingReplies=[];
      const values=req.body?.fields || {};
      if (!values || typeof values !== 'object' || Object.keys(values).length > 20) throw Object.assign(new Error('Formulario inválido.'), { status:400 });
      for (const value of Object.values(values)) if (typeof value !== 'string' || value.length > 4000) throw Object.assign(new Error('Texto del formulario inválido.'), { status:400 });
      const i=syntheticInteraction({guild,member,channel,sendChannel,user,responses,modalRef,pendingReplies,modalFields:values,customId:pending.modal?.custom_id || null});
      req.session.pendingModal=null;
      await extraInteractions(i);
      await Promise.all(pendingReplies);
      await recordDashboardActivity(guild.id, user, 'formulario', `/${pending.category}${ROOT.has(pending.category) ? '' : ` ${pending.name}`}`);
      res.json({ok:true,responses});
    } catch(e) { res.status(e.status || 500).json({error:e.message || 'No se pudo enviar el formulario.'}); }
  });
  app.get('/api/guild/:id/music', auth, async (req,res) => {
    try { const {guild,db}=await getAuthorizedGuild(req,req.params.id); res.json(music.dashboardStatus(guild.id, db.cfg.musicChannelId)); }
    catch(e) { res.status(e.status || 500).json({error:e.message}); }
  });
  app.post('/api/guild/:id/music', auth, csrf, async (req,res) => {
    try {
      const {guild,member,db}=await getAuthorizedGuild(req,req.params.id); limiter(req.session,guild.id);
      const body=validateTree(req.body || {});
      if (body.action === 'channel') {
        if (!member.permissions.has(permissions.ManageGuild)) throw Object.assign(new Error('Necesitas Administrar servidor para cambiar el canal musical.'),{status:403});
        const channel=await guild.channels.fetch(String(body.channelId || '')).catch(()=>null);
        if (!channel?.isVoiceBased?.()) throw Object.assign(new Error('Selecciona un canal de voz.'),{status:400});
        let warning=null;
        try { await music.setGuildChannel(guild.id, channel.id); }
        catch (error) {
          if (error.message.startsWith('Detén la sesión musical')) throw error;
          warning=error.message;
        }
        db.cfg.musicChannelId=channel.id; delete db.cfg.musicChannelDisabled; delete db.cfg.c247; save();
        await recordRequestActivity(req,guild.id,'musica','Canal permanente de música actualizado');
        return res.json({ok:true,status:music.dashboardStatus(guild.id,channel.id),warning});
      }
      if (body.action === 'voice-disconnect') {
        if (!member.permissions.has(permissions.ManageGuild)) throw Object.assign(new Error('Necesitas Administrar servidor para desconectar a Kuboq de voz.'),{status:403});
        await music.setGuildChannel(guild.id,null);
        delete db.cfg.musicChannelId; delete db.cfg.c247; db.cfg.musicChannelDisabled=true; save();
        await recordRequestActivity(req,guild.id,'musica','Kuboq desconectado del canal permanente de voz');
        return res.json({ok:true,status:music.dashboardStatus(guild.id,null)});
      }
      const user=await client.users.fetch(req.session.user.id);
      const status=await music.dashboardControl(guild,member,user,body.action,body.value);
      const actionNames={play:'Canción añadida a la cola',pause:'Reproducción pausada o reanudada',skip:'Canción saltada',stop:'Reproducción detenida',shuffle:'Cola mezclada',clear:'Cola vaciada',volume:'Volumen ajustado',filter:'Filtro musical actualizado',loop:'Repetición musical actualizada',autoplay:'Reproducción automática actualizada'};
      await recordRequestActivity(req,guild.id,'musica',actionNames[body.action]||'Control de música actualizado');
      res.json({ok:true,status});
    } catch(e) { res.status(e.status || 400).json({error:e.message || 'No se pudo controlar la música.'}); }
  });

  app.get('/health', (req,res) => res.json({ok:true,service:'club247-dashboard',discordReady:client.isReady?.()||false,oauthConfigured:configured}));

  app.get('/', (req,res)=>res.sendFile(path.join(publicDir,'lobby.html')));
  app.get(['/logros','/logros/:guildId'], (req,res)=>res.sendFile(path.join(publicDir,'achievements.html')));
  app.get(['/dashboard','/dashboard/','/dashboard/servers','/dashboard/:guildId'], (req,res)=>res.sendFile(path.join(publicDir,'index.html')));
  app.use('/assets', express.static(path.join(publicDir,'assets'), { fallthrough:false, maxAge:0 }));
  app.use((err,req,res,next)=>{ if (res.headersSent) return next(err); console.error('[dashboard]',err.message); res.status(err.status || 400).json({error:err.message || 'Solicitud inválida.'}); });

  const server = app.listen(port, config.dashboard?.host || '0.0.0.0', () => console.log(`[dashboard] escuchando en el puerto ${port}${configured ? '' : ' · falta configurar OAuth2'}`));
  const interval=setInterval(()=>{
    const now=Date.now();
    for(const [id,s] of sessions) if(s.expires<now) sessions.delete(id);
    for(const [state,t] of states) if(t.expires<now) states.delete(state);
    for(const [key,times] of rate) {
      const recent=times.filter(t=>now-t<60_000);
      if(recent.length) rate.set(key,recent); else rate.delete(key);
    }
  }, 60_000); interval.unref?.();
  return { close:()=>new Promise(resolve=>{clearInterval(interval);server.close(()=>resolve());}), port, configured };
}

module.exports = { dashboardServer };
