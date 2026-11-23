'use strict';
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

class PlayerPool {
  constructor(definitions = []) {
    this.players = definitions.filter(x => x.enabled !== false && x.token).map((x, i) => ({
      name: x.name || `Music ${i + 1}`, client: new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] }),
      token: x.token, guildId: null, channelId: null, connection: null, reserved: false,
    }));
    this.pending = new Map();
  }
  async start() {
    for (const p of this.players) {
      try {
        await p.client.login(p.token);
        if (!p.client.isReady()) await new Promise((resolve, reject) => {
          const onReady = () => { clearTimeout(timer); resolve(); };
          const timer = setTimeout(() => { p.client.off('clientReady', onReady); reject(new Error('Tiempo de espera agotado')); }, 30000);
          p.client.once('clientReady', onReady);
        });
        console.log(`[music-pool] ${p.name} conectado (${p.client.user.id})`);
      } catch (error) {
        console.error(`[music-pool] ${p.name}: ${error.message}`);
        p.client.destroy();
      }
    }
  }
  async acquire(guildId, channelId) {
    const key = `${guildId}:${channelId}`;
    if (this.pending.has(key)) return this.pending.get(key);
    const task = this._acquire(guildId, channelId);
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); }
  }
  async _acquire(guildId, channelId) {
    const existing = this.players.find(p => p.guildId === guildId && p.channelId === channelId && p.connection?.state.status !== VoiceConnectionStatus.Destroyed);
    if (existing) return existing;
    const occupied = this.players.find(p => p.guildId === guildId && p.channelId === channelId);
    if (occupied) throw new Error('Ya hay un reproductor reservado para este canal.');
    const p = this.players.find(p => !p.reserved && !p.guildId && p.client.isReady() && p.client.guilds.cache.has(guildId));
    if (!p) throw new Error('No hay reproductores disponibles en este servidor. Invita los bots musicales y comprueba sus tokens.');
    p.reserved = true;
    try {
      const guild = await p.client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel?.isVoiceBased()) throw new Error('El canal configurado no es de voz.');
      const me = await guild.members.fetchMe();
      const perms = channel.permissionsFor(me);
      if (!perms?.has('Connect') || !perms?.has('Speak')) throw new Error(`${p.name} necesita Conectar y Hablar en el canal.`);
      const connection = joinVoiceChannel({ guildId, channelId, adapterCreator: guild.voiceAdapterCreator, group: p.client.user.id, selfDeaf: true });
      p.guildId = guildId; p.channelId = channelId; p.connection = connection;
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      connection.on('error', e => console.error(`[music-pool:${p.name}] ${e.message}`));
      connection.on('stateChange', (_, state) => {
        if (state.status === VoiceConnectionStatus.Destroyed) this.release(p);
      });
      console.log(`[music-pool] ${p.name} asignado a ${guildId}/${channelId}`);
      return p;
    } catch (e) { if (p.connection) this.release(p); throw e; }
    finally { p.reserved = false; }
  }
  release(p) {
    if (!p) return;
    const conn = p.connection;
    p.connection = null; p.guildId = null; p.channelId = null;
    if (conn && conn.state.status !== VoiceConnectionStatus.Destroyed) conn.destroy();
  }
  async close() { for (const p of this.players) { this.release(p); p.client.destroy(); } }
  status(guildId = null) {
    return this.players.map(p => ({
      name: p.name,
      ready: p.client.isReady(),
      available: p.client.isReady() && (!guildId || p.client.guilds.cache.has(guildId)) && !p.reserved && !p.guildId,
      assigned: p.guildId === guildId,
      guildId: p.guildId,
      channelId: p.channelId,
    }));
  }
}
module.exports = { PlayerPool };
