'use strict';
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

class MainVoice {
  constructor(client) {
    this.client = client;
    this.connections = new Map();
    this.pending = new Map();
    this.desired = new Map();
    this.retryTimers = new Map();
    this.retryAttempts = new Map();
    this.closed = false;
  }

  async join(guildId, channelId) {
    if (this.closed) throw new Error('El servicio de voz está cerrado.');
    const previousChannel = this.desired.get(guildId);
    if (previousChannel && previousChannel !== channelId) {
      this.cancelRetry(guildId);
      this.retryAttempts.delete(guildId);
      this.dropConnection(guildId);
    }
    this.desired.set(guildId, channelId);

    const pending = this.pending.get(guildId);
    if (pending) {
      if (pending.channelId === channelId) return pending.promise;
      await pending.promise.catch(() => {});
      if (this.desired.get(guildId) !== channelId) throw new Error('La configuración del canal de voz cambió.');
      return this.join(guildId, channelId);
    }

    const current = this.connections.get(guildId);
    if (current?.channelId === channelId && current.connection.state.status === VoiceConnectionStatus.Ready) return;
    this.dropConnection(guildId);

    const entry = { channelId, promise: null };
    entry.promise = this.connect(guildId, channelId);
    this.pending.set(guildId, entry);
    try {
      await entry.promise;
      this.retryAttempts.delete(guildId);
    } catch (error) {
      if (this.desired.get(guildId) === channelId) {
        if (Number(error?.code) === 10004) {
          this.desired.delete(guildId);
          this.retryAttempts.delete(guildId);
          console.warn(`[music-main:${guildId}] Se cancela la reconexión: Discord no reconoce este servidor (10004).`);
        } else {
          this.scheduleReconnect(guildId, channelId, error);
        }
      }
      throw error;
    } finally {
      if (this.pending.get(guildId) === entry) this.pending.delete(guildId);
    }
  }

  async connect(guildId, channelId) {
    const guild = await this.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isVoiceBased()) throw new Error('Debes elegir un canal de voz.');
    const me = await guild.members.fetchMe();
    if (!channel.permissionsFor(me)?.has('Connect')) throw new Error('Kuboq necesita permiso Conectar.');
    if (this.desired.get(guildId) !== channelId) return;

    const connection = joinVoiceChannel({ guildId, channelId, adapterCreator: guild.voiceAdapterCreator, group: this.client.user.id, selfDeaf: true });
    this.connections.set(guildId, { connection, channelId });
    connection.on('error', error => {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      this.scheduleReconnect(guildId, channelId, error);
    });
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch {
        if (this.connections.get(guildId)?.connection !== connection || this.desired.get(guildId) !== channelId) return;
        this.dropConnection(guildId);
        this.scheduleReconnect(guildId, channelId, new Error('La conexión permanente de voz se perdió.'));
      }
    });
    connection.on('stateChange', (_, state) => {
      if (state.status === VoiceConnectionStatus.Destroyed && this.connections.get(guildId)?.connection === connection) {
        this.connections.delete(guildId);
        this.scheduleReconnect(guildId, channelId, new Error('La conexión de voz se cerró.'));
      }
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      if (this.desired.get(guildId) !== channelId) this.dropConnection(guildId);
    } catch (error) {
      if (this.connections.get(guildId)?.connection === connection) this.connections.delete(guildId);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      throw error;
    }
  }

  scheduleReconnect(guildId, channelId, error) {
    if (this.closed || this.desired.get(guildId) !== channelId || this.retryTimers.has(guildId)) return;
    const attempt = (this.retryAttempts.get(guildId) || 0) + 1;
    this.retryAttempts.set(guildId, attempt);
    const delay = Math.min(60000, 5000 * (2 ** Math.min(attempt - 1, 4)));
    const details = error?.code ? `${error.code}: ${error.message}` : error?.message || 'error de conexión';
    console.warn(`[music-main:${guildId}] Reintentando voz en ${Math.round(delay / 1000)} s (${details}).`);
    const timer = setTimeout(() => {
      this.retryTimers.delete(guildId);
      if (this.desired.get(guildId) === channelId) this.join(guildId, channelId).catch(() => {});
    }, delay);
    timer.unref?.();
    this.retryTimers.set(guildId, timer);
  }

  cancelRetry(guildId) {
    const timer = this.retryTimers.get(guildId);
    if (timer) clearTimeout(timer);
    this.retryTimers.delete(guildId);
  }

  dropConnection(guildId) {
    const item = this.connections.get(guildId);
    this.connections.delete(guildId);
    if (item && item.connection.state.status !== VoiceConnectionStatus.Destroyed) item.connection.destroy();
  }

  leave(guildId) {
    this.desired.delete(guildId);
    this.cancelRetry(guildId);
    this.retryAttempts.delete(guildId);
    this.dropConnection(guildId);
  }

  status(guildId) {
    const desiredChannelId = this.desired.get(guildId) || null;
    const entry = this.connections.get(guildId);
    const connection = entry?.connection;
    const connected = Boolean(desiredChannelId && entry?.channelId === desiredChannelId && connection?.state.status === VoiceConnectionStatus.Ready);
    return {
      channelId: desiredChannelId,
      connected,
      connecting: Boolean(desiredChannelId && !connected),
      state: connection?.state.status || (this.retryTimers.has(guildId) ? 'reconnecting' : 'disconnected'),
    };
  }

  close() {
    this.closed = true;
    for (const guildId of this.retryTimers.keys()) this.cancelRetry(guildId);
    for (const guildId of this.connections.keys()) this.leave(guildId);
    this.desired.clear();
  }
}

module.exports = { MainVoice };
