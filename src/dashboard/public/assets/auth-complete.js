(() => {
  'use strict';
  const q = selector => document.querySelector(selector);
  const params = new URLSearchParams(location.search);
  const status = params.get('status'), flow = params.get('flow') || '';
  const targetOrigin = location.origin;
  const authChannel = flow && typeof BroadcastChannel === 'function' ? new BroadcastChannel('club247-auth') : null;
  let successSince = 0, closeTimer = null;
  const finishClosing = () => {
    window.close();
    setTimeout(() => { if (!window.closed) q('#close-note').textContent = 'Si el navegador no la cerró, puedes cerrar esta ventana.'; }, 300);
  };
  const closeAfterConfirmation = () => {
    if (!successSince) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(finishClosing, Math.max(0, 400 - (performance.now() - successSince)));
  };
  const isReadyMessage = data => Boolean(flow) && data?.type === 'club247:login-ready' && data.flow === flow;
  authChannel?.addEventListener('message', event => { if (isReadyMessage(event.data)) closeAfterConfirmation(); });
  window.addEventListener('message', event => {
    if (event.origin === targetOrigin && event.source === window.opener && isReadyMessage(event.data)) closeAfterConfirmation();
  });
  window.addEventListener('pagehide', () => authChannel?.close());
  if (flow) q('#auth-error a').href = '/auth/discord?popup=1&flow=' + encodeURIComponent(flow);
  const signal = type => {
    const message = { type, flow };
    if (window.opener && !window.opener.closed) window.opener.postMessage(message, targetOrigin);
    authChannel?.postMessage(message);
  };
  const showError = message => {
    q('#auth-loading').hidden = true;
    q('#auth-success').hidden = true;
    q('#auth-error').hidden = false;
    q('#auth-error-text').textContent = message;
    signal('club247:login-error');
  };
  q('#close-button').addEventListener('click', () => window.close());
  if (status) {
    showError(status === 'expired' ? 'El acceso venció o fue cancelado. Puedes intentarlo de nuevo.' : 'Discord no pudo completar el acceso. Puedes intentarlo de nuevo.');
    return;
  }
  fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.json()).then(session => {
    if (!session.authenticated || !session.user) throw new Error('La sesión no está disponible. Inténtalo de nuevo.');
    const user = session.user;
    q('#account-handle').textContent = '@' + (user.handle || user.username);
    q('#account-display').textContent = user.username !== user.handle ? user.username : 'Cuenta verificada';
    q('#avatar-fallback').textContent = (user.username || '24').slice(0, 2).toUpperCase();
    if (user.avatar && /^https:\/\/cdn\.discordapp\.com\/avatars\//.test(user.avatar)) {
      q('#avatar-image').src = user.avatar;
      q('#avatar-image').hidden = false;
      q('#avatar-fallback').hidden = true;
      q('#avatar-image').onerror = () => { q('#avatar-image').hidden = true; q('#avatar-fallback').hidden = false; };
    }
    q('#auth-loading').hidden = true;
    q('#auth-success').hidden = false;
    successSince = performance.now();
    const hasOpener = Boolean(window.opener && !window.opener.closed);
    const hasChannel = Boolean(authChannel);
    q('#continue-button').onclick = () => {
      if (hasOpener && !window.opener.closed) { window.opener.location.assign('/dashboard/servers'); window.opener.focus(); window.close(); }
      else if (hasChannel) { window.close(); setTimeout(() => { if (!window.closed) location.href = '/dashboard/servers'; }, 300); }
      else location.href = '/dashboard/servers';
    };
    signal('club247:login-complete');
    if (hasOpener || hasChannel) {
      closeTimer = setTimeout(finishClosing, 900);
    } else q('#close-note').textContent = 'Pulsa Elegir servidor para continuar.';
  }).catch(error => showError(error.message));
})();
