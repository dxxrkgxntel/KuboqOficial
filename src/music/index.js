// Integrado en el cliente principal de Kuboq; no usa dotenv.

// ╔══════════════════════════════════════════════════════════════╗
// ║  PEGA AQUÍ EL LINK DE LA IMAGEN DEL PANEL (entre las comillas) ║
// ║  Ejemplo: 'https://cdn.discordapp.com/attachments/.../panel.png' ║
// ║  Si lo dejas vacío, el bot usa la imagen que trae incluida.    ║
// ╚══════════════════════════════════════════════════════════════╝
const PANEL_IMAGE_URL = require('../config/load').music?.panelImageUrl || '';
// Color de la raya del lado izquierdo del panel (un solo color). Naranja: 0xff6a00 · Morado: 0x8a00ff
const BAR_COLOR = parseInt((require('../config/load').music?.accentColor || '#8B5CF6').replace('#',''), 16);
const HAS_URL = /^https?:\/\//.test(PANEL_IMAGE_URL.trim());

const { PlayerPool } = require('./playerPool');
const { MainVoice } = require('./mainVoice');
const musicSettings = require('../config/load').music || {};
const channelSettings = new Map(Object.entries(musicSettings.guildChannels || {}));
let pool, mainVoice, channelPersistence = null;
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);
const ffmpegPath = require('ffmpeg-static');
const yts = require('yt-search');
const fs = require('fs');
const https = require('https');
const path = require('path');
let YTDLP = require('../config/load').music?.ytDlpPath || (process.platform === 'win32' ? path.join(__dirname, 'yt-dlp.exe') : 'yt-dlp');
process.on('unhandledRejection', (e) => console.error('Error no atrapado:', e?.message || e));
const {
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, SlashCommandBuilder, MessageFlags, AttachmentBuilder, PermissionFlagsBits,
} = require('discord.js');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  StreamType, VoiceConnectionStatus, entersState,
} = require('@discordjs/voice');

let client; // inyectado por Kuboq
const EPHEMERAL = MessageFlags.Ephemeral;


const FILTERS = {
  none: null,
  bassboost: 'bass=g=12',
  nightcore: 'asetrate=48000*1.25,aresample=48000',
  vaporwave: 'asetrate=48000*0.8,aresample=48000',
};
const VOLUMES = [0.5, 0.75, 1, 1.5];

// ---------- estado por servidor ----------
const states = new Map();
const liked = new Map(); // userId -> [track]
function S(guildId) {
  if (!states.has(guildId)) {
    const player = createAudioPlayer();
    const g = {
      id: guildId, player, connection: null, queue: [], history: [], current: null,
      loop: 'off', autoplay: false, volume: 1, filter: 'none',
      seekBase: 0, resource: null, proc: null, downloader: null, skipIdle: false, playbackGeneration: 0, assigned: null, channelId: null, connectPromise: null,
    };
    player.on(AudioPlayerStatus.Playing, () => console.log(`[music:${guildId}] Reproductor: Playing`));
    player.on(AudioPlayerStatus.Buffering, () => console.log(`[music:${guildId}] Reproductor: Buffering`));
    player.on('stateChange', (oldState, newState) => console.log(`[music:${guildId}] Player ${oldState.status} -> ${newState.status}`));
    player.on(AudioPlayerStatus.Idle, () => {
      if (g.skipIdle) return;
      next(g, false).catch(console.error);
    });
    player.on('error', (e) => { console.error('player error', e.message); next(g, true).catch(() => {}); });
    states.set(guildId, g);
  }
  return states.get(guildId);
}

// ---------- reproducción: yt-dlp -> FFmpeg -> Discord ----------
function stopPipeline(g) {
  for (const key of ['downloader', 'proc']) {
    const child = g[key];
    g[key] = null;
    if (child && child.exitCode === null && !child.killed) {
      try { child.kill(); } catch (_) {}
    }
  }
}

async function startTrack(g, seek = 0) {
  if (!g.current) return;
  const generation = ++g.playbackGeneration;
  g.skipIdle = true;
  // Detener los procesos anteriores antes de crear los nuevos.
  stopPipeline(g);
  const url = g.current.url;
  const ytdlpArgs = [
    '--no-playlist', '--no-progress', '--no-warnings',
    '--js-runtimes', 'node', '-f', 'bestaudio/best',
    '-o', '-', url,
  ];
  const downloader = spawn(YTDLP, ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  g.downloader = downloader;
  const args = ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0'];
  if (seek > 0) args.push('-ss', String(Math.max(0, seek)));
  args.push('-vn');
  if (FILTERS[g.filter]) args.push('-af', FILTERS[g.filter]);
  args.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
  const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  g.proc = proc;
  downloader.stdout.pipe(proc.stdin);
  // EPIPE es normal si FFmpeg se cierra mientras yt-dlp sigue descargando.
  proc.stdin.on('error', err => {
    if (err.code !== 'EPIPE' && generation === g.playbackGeneration)
      console.error(`[music:${g.id}] FFmpeg stdin: ${err.message}`);
  });
  let dlError = '', ffError = '';
  downloader.stderr.on('data', chunk => {
    dlError = (dlError + chunk.toString()).slice(-3000);
  });
  proc.stderr.on('data', chunk => {
    ffError = (ffError + chunk.toString()).slice(-3000);
  });
  let failed = false;
  const fail = (source, message) => {
    if (failed || generation !== g.playbackGeneration) return;
    failed = true;
    console.error(`[music:${g.id}] ${source}: ${message.slice(-1000)}`);
    stopPipeline(g);
    g.skipIdle = false;
    // Evita informar que está sonando si la fuente falló.
    g.player.stop(true);
  };
  downloader.on('error', err => fail('yt-dlp no pudo iniciarse', err.message));
  proc.on('error', err => fail('FFmpeg no pudo iniciarse', err.message));
  downloader.on('close', (code, signal) => {
    if (generation !== g.playbackGeneration) return;
    if (code !== 0 && !signal) fail('yt-dlp terminó con error', dlError || `Código ${code}`);
    else console.log(`[music:${g.id}] yt-dlp terminó: ${code} (${signal || 'normal'})`);
  });
  proc.on('close', (code, signal) => {
    if (generation !== g.playbackGeneration) return;
    if (code !== 0 && !signal) fail('FFmpeg terminó con error', ffError || `Código ${code}`);
    else console.log(`[music:${g.id}] FFmpeg terminó: ${code} (${signal || 'normal'})`);
  });
  const resource = createAudioResource(proc.stdout, { inputType: StreamType.Raw, inlineVolume: true });
  resource.volume.setVolume(g.volume);
  g.resource = resource;
  g.seekBase = seek;
  g.player.play(resource);
  // No mantener Idle bloqueado si la fuente termina inmediatamente.
  setTimeout(() => { if (generation === g.playbackGeneration) g.skipIdle = false; }, 500);
  console.log(`[music:${g.id}] Fuente iniciada: yt-dlp -> FFmpeg -> Discord`);
}

const position = (g) => (g.seekBase + (g.resource ? g.resource.playbackDuration / 1000 : 0));

async function next(g, manual) {
  const prev = g.current;
  if (prev && !(g.loop === 'track' && !manual)) g.history.push(prev);
  if (prev && g.loop === 'track' && !manual) { return startTrack(g, 0); }
  if (prev && g.loop === 'queue') g.queue.push(prev);
  g.current = g.queue.shift() || null;
  if (!g.current && g.autoplay && prev) {
    const r = await yts(`${prev.author} ${prev.title}`);
    const pick = r.videos.slice(1, 6)[Math.floor(Math.random() * 5)];
    if (pick) g.current = toTrack(pick, 'autoplay');
  }
  if (!g.current) { ++g.playbackGeneration; stopPipeline(g); g.player.stop(); return; }
  await startTrack(g, 0);
}

function toTrack(v, by) {
  return { title: v.title, url: v.url, author: v.author?.name || '?', duration: v.timestamp, seconds: v.seconds, by };
}

async function connect(interaction) {
  const configured = channelSettings.get(interaction.guildId);
  const vc = configured
    ? await interaction.guild.channels.fetch(configured).catch(() => null)
    : interaction.member.voice.channel;
  if (!vc || !vc.isVoiceBased()) return null;
  const g = S(interaction.guildId);
  if (g.channelId && g.channelId !== vc.id) throw new Error('Este servidor ya tiene una sesión musical en otro canal. Usa /stop antes de cambiarla.');
  await mainVoice.join(interaction.guildId, vc.id);
  if (!g.assigned) {
    if (!g.connectPromise) {
      g.connectPromise = (async () => {
        const assigned = await pool.acquire(interaction.guildId, vc.id);
        g.assigned = assigned; g.channelId = vc.id;
        g.connection = assigned.connection;
        assigned.connection.subscribe(g.player);
      })().finally(() => { g.connectPromise = null; });
    }
    await g.connectPromise;
  }
  return g;
}
function stopSession(g) {
  g.queue = []; g.current = null;
  ++g.playbackGeneration; stopPipeline(g); g.player.stop(true);
  if (g.assigned) pool.release(g.assigned);
  g.assigned = null; g.connection = null; g.channelId = null;
  // Kuboq permanece conectado al canal configurado.
}

async function enqueue(interaction, video) {
  const g = await connect(interaction);
  if (!g) return interaction.editReply({ content: '🔊 Entra en un canal de voz o configura /musicvoice.', components: [] });
  const track = toTrack(video, interaction.user.username);
  if (!g.current) {
    g.current = track;
    try { await startTrack(g, 0); }
    catch (e) {
      g.current = null;
      console.error('yt-dlp falló:', e.message);
      return interaction.editReply({ content: `⚠️ No pude sacar el audio.\n\`\`\`${String(e.stderr || e.message).slice(0, 500)}\`\`\``, components: [] });
    }
  } else g.queue.push(track);
  return interaction.editReply({
    content: g.current === track ? `⏳ Preparando audio: **${track.title}**` : `➕ Agregada a la cola: **${track.title}**`,
    components: [],
  });
}

// ---------- UI ----------
const FALLBACK = { play: '▶️', prev: '⏮️', pause: '⏯️', next: '⏭️', queue: '📜', repeat: '🔁', rewind: '⏪', like: '❤️', forward: '⏩', volume: '🔊', playlists: '📂', shuffle: '🔀', stop: '⏹️', filters: '🎛️', help: '❓' };
const ICONS = {};
const btn = (id, key, style = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId('music:' + id).setEmoji(ICONS[key] || FALLBACK[key]).setStyle(style);

const ICON_PREFIX = 'mutsi3_';
const HAS_CUSTOM_ICONS = fs.existsSync(path.join(__dirname, 'icons')); 
async function loadIcons() {
  if (!HAS_CUSTOM_ICONS) { console.log('[music] Iconos PNG no incluidos; se usarán los 15 emojis de respaldo.'); return; }
  let ok = 0;
  try {
    const existing = await client.application.emojis.fetch();
    // borra versiones viejas de los iconos (azules / anteriores)
    for (const old of existing.filter(x => /^mutsi\d*_/.test(x.name) && !x.name.startsWith(ICON_PREFIX)).values()) {
      await client.application.emojis.delete(old.id).catch(() => {});
    }
    for (const key of Object.keys(FALLBACK)) {
      const name = `${ICON_PREFIX}${key}`;
      let e = existing.find(x => x.name === name);
      if (!e) {
        const file = path.join(__dirname, 'icons', `${key}.png`);
        if (!fs.existsSync(file)) { console.error(`Falta el archivo icons/${key}.png`); continue; }
        for (let t = 1; t <= 3 && !e; t++) {
          try { e = await client.application.emojis.create({ attachment: file, name }); }
          catch (err) {
            console.error(`Icono ${key} falló (intento ${t}/3): ${err.message}`);
            await new Promise(r => setTimeout(r, 1500));
          }
        }
      }
      if (e) { ICONS[key] = { id: e.id, name: e.name }; ok++; }
    }
  } catch (e) { console.error('No pude cargar los iconos:', e.message); }
  console.log(`Iconos de Mutsi: ${ok}/${Object.keys(FALLBACK).length} cargados` + (ok < 15 ? ' (los que faltan usan emoji normal)' : ''));
}

function setVol(g, pct) {
  pct = Math.min(100, Math.max(0, Math.round(pct)));
  g.volume = pct / 100;
  g.resource?.volume?.setVolume(g.volume);
}
function volUI(g) {
  const pct = Math.round(g.volume * 100);
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
  return {
    content: `Volumen: **${pct}%**\n\`${bar}\``,
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music:vol_down').setLabel('−10').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:vol_up').setLabel('+10').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music:vol_set').setLabel('Escribir número').setStyle(ButtonStyle.Primary),
    )],
  };
}

function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      btn('play', 'play'), btn('prev', 'prev'), btn('pause', 'pause'), btn('next', 'next'), btn('queue', 'queue')),
    new ActionRowBuilder().addComponents(
      btn('repeat', 'repeat'), btn('rewind', 'rewind'), btn('like', 'like'), btn('forward', 'forward'), btn('volume', 'volume')),
    new ActionRowBuilder().addComponents(
      btn('playlists', 'playlists'), btn('shuffle', 'shuffle'), btn('stop', 'stop'),
      btn('filters', 'filters'), btn('help', 'help')),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('music:more').setPlaceholder('Más funciones...').addOptions(
        { label: 'Lyrics', description: 'Busca la letra de la canción', value: 'lyrics', emoji: '🎤' },
        { label: 'History', description: 'Canciones recientes, agrégalas de nuevo', value: 'history', emoji: '🕘' },
        { label: 'Seek Panel', description: 'Adelantar / atrasar / ir a un tiempo', value: 'seek', emoji: '⏱️' },
        { label: 'Toggle AutoPlay', description: 'Activa o desactiva el autoplay', value: 'autoplay', emoji: '♾️' },
        { label: 'Repeat Panel', description: 'Repetir canción / cola / apagado', value: 'repeatpanel', emoji: '🔁' },
      )),
  ];
}

// ---------- panel ----------
function panelPayload(withImage = true) {
  const embed = new EmbedBuilder()
    .setColor(BAR_COLOR)
    .setTitle('Panel de Control')
    .setDescription('¡Dale clic a un botón y el bot se unirá a tu canal!')
    .setFooter({ text: 'Panel de Control Avanzado' });
  const payload = { embeds: [embed], components: panelComponents() };
  if (withImage && HAS_URL) {
    embed.setImage(PANEL_IMAGE_URL.trim());
  } else if (withImage) {
    embed.setImage('attachment://panel.png');
    payload.files = [new AttachmentBuilder(Buffer.from(GUIDE_B64, 'base64'), { name: 'panel.png' })];
  }
  return payload;
}

// Sube el panel con imagen usando https nativo (IPv4 + Content-Length),
// porque la subida de archivos de discord.js se corta en algunas redes / Node 24.
function patchOriginalWithImage(i, payload) {
  return new Promise((resolve, reject) => {
    const boundary = '----mutsi' + Date.now();
    const json = JSON.stringify({
      embeds: payload.embeds.map(e => e.toJSON()),
      components: payload.components.map(c => c.toJSON()),
      attachments: [{ id: 0, filename: 'panel.png' }],
    });
    const img = Buffer.from(GUIDE_B64, 'base64');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${json}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="panel.png"\r\nContent-Type: image/png\r\n\r\n`),
      img,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const req = https.request({
      hostname: 'discord.com', family: 4, method: 'PATCH',
      path: `/api/v10/webhooks/${i.applicationId}/${i.token}/messages/@original`,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300
        ? resolve(d) : reject(new Error(`HTTP ${res.statusCode} ${d.slice(0, 200)}`))));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
    req.end(body);
  });
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- comandos ----------
async function initMusic() {
  await loadIcons();
  await ensureYtDlp();
  await pool.start();
  console.log('[music] Pool de reproductores preparado');
  // Evita enviar muchas solicitudes de voz a la misma shard al arrancar.
  for (const [guildId, channelId] of channelSettings) {
    try { await mainVoice.join(guildId, channelId); }
    catch (error) { console.warn(`[music-main:${guildId}] ${error.code || ''} ${error.message}`.trim()); }
  }
}
function musicCommands() {
 return [
  new SlashCommandBuilder().setName('musicpanel').setDescription('Muestra el panel de música de Kuboq'),
  new SlashCommandBuilder().setName('play').setDescription('Busca y reproduce una canción').addStringOption(o => o.setName('cancion').setDescription('Nombre o artista').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Salta la canción'),
  new SlashCommandBuilder().setName('stop').setDescription('Detiene la música y limpia la cola'),
   new SlashCommandBuilder().setName('musicvoice').setDescription('Fija el canal de voz para Kuboq y los reproductores').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addChannelOption(o => o.setName('canal').setDescription('Canal de voz de Kuboq').setRequired(true))
 ];
}

async function searchReply(interaction, query) {
  const r = await yts(query);
  const vids = r.videos.slice(0, 10);
  if (!vids.length) return interaction.editReply('No encontré nada 😕');
  const menu = new StringSelectMenuBuilder().setCustomId('music:pick').setPlaceholder('Escoge la canción...')
    .addOptions(vids.map(v => ({
      label: v.title.slice(0, 100),
      description: `${v.author?.name || '?'} • ${v.timestamp}`.slice(0, 100),
      value: v.videoId,
    })));
  return interaction.editReply({
    content: `Resultados para **${query}**:`,
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

async function resolveVideo(id) {
  const v = await yts({ videoId: id });
  return { ...v, url: v.url || `https://youtu.be/${id}`, author: v.author };
}

function installMusic(botClient, persistence = null) {
 client = botClient;
 channelPersistence = persistence;
 pool = new PlayerPool(musicSettings.players || []);
 mainVoice = new MainVoice(client);
 client.on('interactionCreate', async (i) => {
  try {
    if (!i.guildId) return;
    if (i.isChatInputCommand() && !['musicpanel','play','skip','stop','musicvoice'].includes(i.commandName)) return;
    if (!i.isChatInputCommand() && !String(i.customId || '').startsWith('music:')) return;
    // ----- slash -----
    if (i.isChatInputCommand()) {
      const g = S(i.guildId);
      if (i.commandName === 'musicpanel') {
        await i.deferReply();
        try {
          return await (HAS_URL ? i.editReply(panelPayload(true)) : patchOriginalWithImage(i, panelPayload(true)));
        } catch (e) {
          console.error('Panel con imagen falló:', e.code || '', e.message);
          try {
            return await i.editReply(panelPayload(false));
          } catch (e2) {
            console.error('Panel sin imagen también falló:', e2.code || '', e2.message);
            return i.editReply({ content: `⚠️ No pude enviar el panel en este canal.\n\`${e2.code || ''} ${e2.message}\`\nRevisa que el bot tenga permisos: Ver canal, Enviar mensajes, Insertar enlaces y Adjuntar archivos.` }).catch(() => {});
          }
        }
      }
      if (i.commandName === 'play') {
        await i.deferReply({ flags: EPHEMERAL });
        return searchReply(i, i.options.getString('cancion'));
      }
      if (i.commandName === 'musicvoice') {
        const channel = i.options.getChannel('canal');
        if (!channel.isVoiceBased()) return i.reply({ content: 'Selecciona un canal de voz.', flags: EPHEMERAL });
        if (g.channelId && g.channelId !== channel.id) return i.reply({ content: 'Detén la sesión musical antes de cambiar el canal.', flags: EPHEMERAL });
        try { await mainVoice.join(i.guildId, channel.id); }
        catch (error) {
          channelSettings.set(i.guildId, channel.id);
          channelPersistence?.saveChannel?.(i.guildId, channel.id);
          return i.reply({ content: `Canal guardado. Kuboq intentará conectar de nuevo automáticamente: ${error.message}`, flags: EPHEMERAL });
        }
        channelSettings.set(i.guildId, channel.id);
        channelPersistence?.saveChannel?.(i.guildId, channel.id);
        return i.reply({ content: `🔊 Kuboq permanecerá en ${channel}. Puedes desconectarlo con /vozbot desactivar o desde la dashboard.`, flags: EPHEMERAL });
      }
      if (i.commandName === 'skip') { await next(g, true); return i.reply({ content: '⏭️ Saltada', flags: EPHEMERAL }); }
      if (i.commandName === 'stop') {
        stopSession(g);
        return i.reply({ content: '⏹️ Detenido', flags: EPHEMERAL });
      }
    }

    // ----- botones -----
    if (i.isButton()) {
      const g = S(i.guildId);
      switch (i.customId) {
        case 'music:play':
          return i.reply({
            content: '¿De dónde quieres la música?', flags: EPHEMERAL,
            components: [new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder().setCustomId('music:src').setPlaceholder('Escoge la fuente').addOptions(
                { label: 'Spotify', value: 'spotify', emoji: '🟢', description: 'Nombre o link de Spotify' },
                { label: 'YouTube', value: 'youtube', emoji: '🔴', description: 'Nombre del artista o canción' },
                { label: 'YouTube Music', value: 'ytmusic', emoji: '🎵', description: 'Versión de audio / música' },
              ))],
          });
        case 'music:pause':
          g.player.state.status === AudioPlayerStatus.Paused ? g.player.unpause() : g.player.pause();
          return i.deferUpdate();
        case 'music:next': await i.deferUpdate(); return next(g, true);
        case 'music:prev': {
          await i.deferUpdate();
          const last = g.history.pop();
          if (!last) return;
          if (g.current) g.queue.unshift(g.current);
          g.current = last; return startTrack(g, 0);
        }
        case 'music:stop':
          stopSession(g);
          return i.deferUpdate();
        case 'music:shuffle':
          g.queue.sort(() => Math.random() - 0.5);
          return i.reply({ content: '🔀 Cola mezclada', flags: EPHEMERAL });
        case 'music:repeat': case 'music:repeatpanel':
          g.loop = { off: 'track', track: 'queue', queue: 'off' }[g.loop];
          return i.reply({ content: `🔁 Repetir: **${{ off: 'apagado', track: 'canción', queue: 'cola' }[g.loop]}**`, flags: EPHEMERAL });
        case 'music:rewind': case 'music:forward': {
          if (!g.current) return i.deferUpdate();
          await i.deferUpdate();
          const t = position(g) + (i.customId === 'music:forward' ? 10 : -10);
          return startTrack(g, Math.min(Math.max(t, 0), g.current.seconds - 1));
        }
        case 'music:volume':
          return i.reply({ ...volUI(g), flags: EPHEMERAL });
        case 'music:vol_down': case 'music:vol_up':
          setVol(g, Math.round(g.volume * 100) + (i.customId === 'music:vol_up' ? 10 : -10));
          return i.update(volUI(g));
        case 'music:vol_set':
          return i.showModal(new ModalBuilder().setCustomId('music:volmodal').setTitle('Volumen')
            .addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('v').setLabel('Número del 0 al 100')
                .setStyle(TextInputStyle.Short).setValue(String(Math.round(g.volume * 100))).setRequired(true))));
        case 'music:like': {
          if (!g.current) return i.reply({ content: 'No hay nada sonando.', flags: EPHEMERAL });
          const l = liked.get(i.user.id) || [];
          if (!l.find(t => t.url === g.current.url)) l.push(g.current);
          liked.set(i.user.id, l);
          return i.reply({ content: `❤️ Guardada: **${g.current.title}**`, flags: EPHEMERAL });
        }
        case 'music:playlists': {
          const l = liked.get(i.user.id) || [];
          if (!l.length) return i.reply({ content: 'Aún no tienes canciones con ❤️.', flags: EPHEMERAL });
          return i.reply({
            content: '❤️ **Tus canciones favoritas** (escoge para agregar a la cola):', flags: EPHEMERAL,
            components: [new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder().setCustomId('music:favpick').setPlaceholder('Favoritas').addOptions(
                l.slice(-25).map((t, n) => ({ label: t.title.slice(0, 100), value: String(n + Math.max(0, l.length - 25)) }))))],
          });
        }
        case 'music:queue': {
          const lines = g.queue.slice(0, 15).map((t, n) => `**${n + 1}.** ${t.title} \`${t.duration}\``);
          return i.reply({
            flags: EPHEMERAL,
            embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Cola')
              .setDescription(`**Ahora:** ${g.current ? g.current.title : 'nada'}\n\n${lines.join('\n') || 'Cola vacía'}`)],
          });
        }
        case 'music:filters':
          return i.reply({
            content: '🎛️ Escoge un filtro:', flags: EPHEMERAL,
            components: [new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder().setCustomId('music:filterpick').addOptions(
                Object.keys(FILTERS).map(f => ({ label: f, value: f, default: g.filter === f }))))],
          });
        case 'music:help':
          return i.reply({
            flags: EPHEMERAL,
            content: '**Mutsi**\n▶️ Play: busca en Spotify/YouTube/YT Music\n⏯️ Pausa/continúa · ⏭️/⏮️ siguiente/anterior\n🔁 repetir · ⏪/⏩ ±10s · 🔊 volumen · 🔀 mezclar\n📜 cola · ❤️ favorita · 📂 favoritas · 🎛️ filtros\nComandos: `/musicpanel` `/play` `/skip` `/stop`',
          });
      }
    }

    // ----- menús -----
    if (i.isStringSelectMenu()) {
      const g = S(i.guildId);
      if (i.customId === 'music:src') {
        const modal = new ModalBuilder().setCustomId(`music:q:${i.values[0]}`).setTitle('¿Qué quieres escuchar?')
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('query').setLabel('Artista o canción')
              .setStyle(TextInputStyle.Short).setRequired(true)));
        return i.showModal(modal);
      }
      if (i.customId === 'music:pick') {
        await i.deferUpdate();
        return await enqueue(i, await resolveVideo(i.values[0]));
      }
      if (i.customId === 'music:favpick') {
        await i.deferUpdate();
        const t = liked.get(i.user.id)?.[Number(i.values[0])];
        if (!t) return;
        const gg = await connect(i);
        if (!gg) return i.editReply({ content: '🔊 Métete en un canal de voz.', components: [] });
        if (!gg.current) { gg.current = t; await startTrack(gg, 0); } else gg.queue.push(t);
        return i.editReply({ content: `➕ **${t.title}**`, components: [] });
      }
      if (i.customId === 'music:filterpick') {
        await i.deferUpdate();
        g.filter = i.values[0];
        return g.current ? startTrack(g, position(g)) : null;
      }
      if (i.customId === 'music:histpick') {
        await i.deferUpdate();
        const t = g.history[Number(i.values[0])];
        if (!t) return;
        const gg = await connect(i);
        if (!gg) return i.editReply({ content: '🔊 Métete en un canal de voz.', components: [] });
        if (!gg.current) { gg.current = t; await startTrack(gg, 0); } else gg.queue.push(t);
        return i.editReply({ content: `➕ **${t.title}**`, components: [] });
      }
      if (i.customId === 'music:more') {
        switch (i.values[0]) {
          case 'lyrics': {
            if (!g.current) return i.reply({ content: 'No hay nada sonando.', flags: EPHEMERAL });
            await i.deferReply({ flags: EPHEMERAL });
            const q = g.current.title.replace(/\(.*?\)|\[.*?\]|official|video|lyrics|audio/gi, '').trim();
            const res = await (await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`)).json();
            const text = res?.[0]?.plainLyrics;
            return i.editReply(text ? `🎤 **${res[0].trackName}** — ${res[0].artistName}\n\n${text.slice(0, 1800)}` : 'No encontré la letra 😕');
          }
          case 'history': {
            if (!g.history.length) return i.reply({ content: 'Historial vacío.', flags: EPHEMERAL });
            const h = g.history.slice(-25);
            const off = g.history.length - h.length;
            return i.reply({
              content: '🕘 **Recientes:**', flags: EPHEMERAL,
              components: [new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('music:histpick').setPlaceholder('Agregar a la cola').addOptions(
                  h.map((t, n) => ({ label: t.title.slice(0, 100), value: String(n + off) }))))],
            });
          }
          case 'seek':
            return i.reply({
              flags: EPHEMERAL,
              content: g.current ? `⏱️ Posición: **${fmt(position(g))} / ${g.current.duration}**\nUsa ⏪ y ⏩ del panel (±10s).` : 'No hay nada sonando.',
            });
          case 'autoplay':
            g.autoplay = !g.autoplay;
            return i.reply({ content: `♾️ AutoPlay: **${g.autoplay ? 'activado' : 'desactivado'}**`, flags: EPHEMERAL });
          case 'repeatpanel':
            g.loop = { off: 'track', track: 'queue', queue: 'off' }[g.loop];
            return i.reply({ content: `🔁 Repetir: **${{ off: 'apagado', track: 'canción', queue: 'cola' }[g.loop]}**`, flags: EPHEMERAL });
        }
      }
    }

    if (i.isModalSubmit() && i.customId === 'music:volmodal') {
      const g = S(i.guildId);
      const n = parseInt(i.fields.getTextInputValue('v'), 10);
      if (isNaN(n)) return i.reply({ content: 'Escribe un número del 0 al 100.', flags: EPHEMERAL });
      setVol(g, n);
      return i.isFromMessage() ? i.update(volUI(g)) : i.reply({ ...volUI(g), flags: EPHEMERAL });
    }

    // ----- modal de búsqueda -----
    if (i.isModalSubmit() && i.customId.startsWith('music:q:')) {
      await i.deferReply({ flags: EPHEMERAL });
      const source = i.customId.slice(8);
      let query = i.fields.getTextInputValue('query');
      if (source === 'spotify' && query.includes('open.spotify.com')) {
        try {
          const o = await (await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(query)}`)).json();
          query = o.title;
        } catch {}
      }
      if (source === 'ytmusic') query += ' audio';
      return searchReply(i, query);
    }
  } catch (e) {
    console.error(e);
    const msg = { content: '⚠️ Hubo un error, intenta de nuevo.', flags: EPHEMERAL };
    if (i.deferred || i.replied) i.followUp(msg).catch(() => {}); else i.reply(msg).catch(() => {});
  }
});

} // installMusic

async function ensureYtDlp() {
  try { await execFileP(YTDLP, ['--version']); console.log('yt-dlp OK'); return; }
  catch (e) { if (e.code !== 'ENOENT') { console.error('yt-dlp no pudo iniciarse:', e.message); return; } }
  if (process.platform !== 'win32') { console.error('Falta yt-dlp para Linux: instala el ejecutable y configura music.ytDlpPath en config.json o utiliza uno disponible en PATH.'); return; }
  console.log('yt-dlp no encontrado. Descargando yt-dlp.exe (una sola vez)...');
  try {
    const r = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const file = path.join(__dirname, 'yt-dlp.exe');
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    YTDLP = file;
    console.log('yt-dlp.exe descargado.');
  } catch (e) { console.error('No pude descargar yt-dlp:', e.message); }
}

function dashboardStatus(guildId, savedChannel = null) {
  const g = S(guildId);
  const voice = mainVoice?.status(guildId) || { channelId:null, connected:false, connecting:false, state:'disconnected' };
  const permanentChannelId = savedChannel || channelSettings.get(guildId) || null;
  const playerStatus = (pool?.status(guildId) || []).map(({ name, ready, available, assigned }) => ({ name, ready, available, assigned }));
  return {
    current: g.current ? { title:g.current.title, author:g.current.author, duration:g.current.duration } : null,
    queue: g.queue.slice(0,50).map(t=>({title:t.title,author:t.author,duration:t.duration})),
    history: g.history.slice(-20).reverse().map(t=>({title:t.title,author:t.author,duration:t.duration})),
    paused: g.player.state.status === AudioPlayerStatus.Paused,
    playing: g.player.state.status === AudioPlayerStatus.Playing,
    volume: Math.round(g.volume*100), loop:g.loop, filter:g.filter, autoplay:g.autoplay,
    channelId:permanentChannelId || g.channelId || null,
    permanentChannelId,
    permanentConnected:voice.connected && voice.channelId === permanentChannelId,
    permanentConnecting:Boolean(permanentChannelId && !voice.connected),
    voiceState:voice.state,
    players: playerStatus.length,
    readyPlayers: playerStatus.filter(p=>p.ready).length,
    availablePlayers: playerStatus.filter(p=>p.available).length,
    assignedPlayers: playerStatus.filter(p=>p.assigned).length,
    playerStatus,
  };
}

async function setGuildChannel(guildId, channelId, join = true) {
  if (!guildId) return;
  const g = states.get(guildId);
  if (channelId && g?.channelId && g.channelId !== channelId)
    throw new Error('Detén la sesión musical antes de cambiar el canal de voz.');
  if (channelId) {
    channelSettings.set(guildId, channelId);
    if (join && mainVoice) await mainVoice.join(guildId, channelId);
  }
  else {
    channelSettings.delete(guildId);
    mainVoice?.leave(guildId);
  }
}

function voiceStatus(guildId) {
  return mainVoice?.status(guildId) || { channelId:null, connected:false, connecting:false, state:'disconnected' };
}

async function dashboardControl(guild, member, user, action, value) {
  const interaction = { guild, guildId:guild.id, member, user };
  const g=S(guild.id);
  switch(action) {
    case 'play': {
      const query=String(value || '').trim().slice(0,300);
      if (!query) throw new Error('Escribe el nombre o el enlace de una canción.');
      const found=await yts(query);
      const video=found.videos?.[0];
      if (!video) throw new Error('No encontré canciones para esa búsqueda.');
      const connected=await connect(interaction);
      if (!connected) throw new Error('Entra en un canal de voz o configura el canal fijo de Música.');
      const track=toTrack(video,user.username);
      if (!g.current) { g.current=track; await startTrack(g,0); } else g.queue.push(track);
      break;
    }
    case 'pause': if (g.player.state.status===AudioPlayerStatus.Paused) g.player.unpause(); else if(g.player.state.status===AudioPlayerStatus.Playing) g.player.pause(); else throw new Error('No hay una canción sonando.'); break;
    case 'skip': if(!g.current) throw new Error('No hay una canción para saltar.'); await next(g,true); break;
    case 'stop': stopSession(g); break;
    case 'shuffle': for(let i=g.queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[g.queue[i],g.queue[j]]=[g.queue[j],g.queue[i]];} break;
    case 'clear': g.queue=[]; break;
    case 'volume': { const n=Number(value); if(!Number.isFinite(n)) throw new Error('El volumen debe ser un número.'); setVol(g,n); break; }
    case 'filter': { const f=String(value || 'none'); if(!Object.hasOwn(FILTERS,f)) throw new Error('Filtro desconocido.'); g.filter=f; if(g.current) await startTrack(g,position(g)); break; }
    case 'loop': { const mode=String(value || 'off'); if(!['off','track','queue'].includes(mode)) throw new Error('Modo de repetición desconocido.'); g.loop=mode; break; }
    case 'autoplay': g.autoplay=Boolean(value); break;
    default: throw new Error('Control musical desconocido.');
  }
  return dashboardStatus(guild.id,channelSettings.get(guild.id));
}


// Imagen de guía del panel (PNG en base64)
const GUIDE_B64 = fs.readFileSync(path.join(__dirname, 'guide.png')).toString('base64');
module.exports = { installMusic, musicCommands, initMusic, dashboardStatus, dashboardControl, setGuildChannel, voiceStatus, shutdownMusic: async () => { for (const g of states.values()) stopSession(g); mainVoice?.close(); await pool?.close(); } };
