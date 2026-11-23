'use strict';
const config = require('../config/load');
// Identidad por servidor: almacenada en el documento existente de MongoDB.
// No sobrescribe identidad ni datos de otros servidores.
function getIdentity(DB, guildId) {
  const custom = DB[guildId]?.identity || {};
  const storedName = String(custom.name || config.identity?.name || '').trim();
  return {
    name: !storedName || /^club\s*24\s*\/\s*7$/i.test(storedName) ? 'Kuboq' : storedName,
    color: custom.color || config.identity?.color || '#8B5CF6',
    description: custom.description || config.identity?.description || '',
    logoUrl: custom.logoUrl || config.identity?.logoUrl || null,
  };
}
function setIdentity(DB, guildId, patch, save) {
  if (!guildId || !DB[guildId]) throw new Error('Servidor no inicializado');
  const allowed = ['name','color','description','logoUrl'];
  const next = { ...(DB[guildId].identity || {}) };
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(patch, key)) {
    if (patch[key] !== null && typeof patch[key] !== 'string') throw new TypeError(`${key} debe ser texto o null`);
    next[key] = patch[key];
  }
  DB[guildId].identity = next;
  save();
  return getIdentity(DB, guildId);
}
module.exports = { getIdentity, setIdentity };
