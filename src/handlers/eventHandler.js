'use strict';
function createEventHandler(client) {
  const listeners = [];
  function register(event, listener, once = false) {
    if (typeof listener !== 'function') throw new TypeError(`Listener inválido: ${event}`);
    listeners.push({ event, once });
    if (once) client.once(event, listener);
    else client.on(event, listener);
    return client;
  }
  return { on: (event, fn) => register(event, fn), once: (event, fn) => register(event, fn, true), listeners };
}
module.exports = { createEventHandler };
