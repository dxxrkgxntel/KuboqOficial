(() => {
  'use strict';
  const preview = document.querySelector('#format-preview');
  const formats = {
    embed: '<div class="preview-embed"><h3>✨ ¡Bienvenido/a a la comunidad!</h3><p>Nos alegra tenerte aquí. Explora los canales y disfruta tu estancia.</p></div>',
    components: '<div class="preview-components"><b>✨ ¡Bienvenido/a a la comunidad!</b><p>Nos alegra tenerte aquí. Explora los canales y disfruta tu estancia.</p><button type="button" tabindex="-1">Conocer el servidor</button></div>',
    card: '<div class="preview-card"><small>KUBOQ · BIENVENIDAS</small><h3>¡BIENVENIDO/A!</h3><p>Tu nueva comunidad te espera.</p></div>',
    text: '<p class="preview-text">✨ ¡Bienvenido/a a la comunidad!<br>Nos alegra tenerte aquí. Explora los canales y disfruta tu estancia.</p>'
  };
  function selectFormat(key) {
    preview.innerHTML = formats[key];
    document.querySelectorAll('[data-format]').forEach(button => {
      const active = button.dataset.format === key;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => selectFormat(button.dataset.format)));
  selectFormat('embed');
  const loginError = new URLSearchParams(location.search).get('login');
  if (loginError) {
    const notice = document.querySelector('#login-notice');
    notice.textContent = loginError === 'expired' ? 'El inicio de sesión venció o fue cancelado. Vuelve a intentarlo.' : 'No se pudo completar el inicio de sesión. Inténtalo otra vez.';
    notice.hidden = false;
  }
  let oauthConfigured = null;
  let loginPopup = null;
  let authFlow = '';
  let checkingSession = false;
  const authChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('club247-auth') : null;
  const notify = message => {
    const notice = document.querySelector('#login-notice');
    notice.textContent = message;
    notice.hidden = false;
  };
  document.querySelectorAll('[data-login]').forEach(link => link.addEventListener('click', event => {
    if (link.getAttribute('href') !== '/auth/discord') return;
    event.preventDefault();
    if (oauthConfigured === false) return notify('El acceso con Discord todavía no está configurado en este alojamiento.');
    checkingSession = false;
    authFlow = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    const width = 520, height = 690;
    const left = Math.max(0, Math.round((screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((screen.availHeight - height) / 2));
    loginPopup = window.open('/auth/discord?popup=1&flow=' + encodeURIComponent(authFlow), 'club247-discord-login', `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if (!loginPopup) { location.href = '/auth/discord'; return; }
    loginPopup.focus();
  }));
  const handleAuthSignal = async data => {
    if (!authFlow || data?.flow !== authFlow) return;
    if (data.type === 'club247:login-error') {
      notify('No se completó el acceso con Discord. Revisa la ventana de inicio de sesión.');
    } else if (data.type === 'club247:login-complete' && !checkingSession) {
      checkingSession = true;
      try {
        const response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
        const session = await response.json();
        if (!session.authenticated) throw new Error('La sesión no está disponible.');
        const ready = { type: 'club247:login-ready', flow: authFlow };
        authChannel?.postMessage(ready);
        try { if (loginPopup && !loginPopup.closed) loginPopup.postMessage(ready, location.origin); } catch {}
        location.assign('/dashboard/servers');
      } catch {
        checkingSession = false;
        notify('No se pudo comprobar la sesión. Usa el botón de la ventana de Discord para continuar.');
      }
    }
  };
  window.addEventListener('message', event => {
    if (event.origin === location.origin && loginPopup && event.source === loginPopup) handleAuthSignal(event.data);
  });
  authChannel?.addEventListener('message', event => handleAuthSignal(event.data));
  window.addEventListener('pagehide', () => authChannel?.close());
  fetch('/api/session', { credentials: 'same-origin' }).then(response => response.json()).then(session => {
    oauthConfigured = session.configured;
    if (session.authenticated) {
      document.querySelectorAll('[data-login]').forEach(link => {
        link.href = '/dashboard/servers';
        link.innerHTML = link.classList.contains('header-login') ? 'Elegir servidor <span aria-hidden="true">↗</span>' : 'Elegir servidor ↗';
      });
    }
  }).catch(() => {});
})();
