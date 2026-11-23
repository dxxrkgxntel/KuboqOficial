(() => {
  const pathMatch = location.pathname.match(/^\/logros\/([^/]+)\/?$/);
  const fixedGuildId = pathMatch ? decodeURIComponent(pathMatch[1]) : '';
  let guildId = fixedGuildId;
  const params = new URLSearchParams(location.search);
  let view = params.get('view') === 'server' ? 'server' : 'me';
  let payload = null;
  let serverChoices = null;
  let loadSerial = 0;
  const $ = selector => document.querySelector(selector);
  const ui = {
    title:$('#pageTitle'), description:$('#pageDescription'), serverChip:$('#serverChip'), serverIcon:$('#serverIcon'), serverName:$('#serverName'),
    loginTop:$('#loginTop'), userChip:$('#userChip'), userAvatar:$('#userAvatar'), userName:$('#userName'), serverPicker:$('#serverPicker'), serverSelect:$('#serverSelect'), stats:$('#stats'), toolbar:$('#toolbar'),
    notice:$('#notice'), grid:$('#achievementGrid'), search:$('#search'), category:$('#category'), count:$('#resultCount'),
  };
  const categoryLabels = { chat:'Chat', nivel:'Nivel', eco:'Economía', inv:'Invitaciones', voz:'Voz', cam:'Cámara', stream:'Stream', leal:'Lealtad' };
  const rarityLabels = { comun:'Común', poco:'Poco común', raro:'Raro', epico:'Épico', legendario:'Legendario' };
  const units = { msgs:'mensajes', lvl:'nivel', coins:'monedas', invites:'invitaciones', vmin:'minutos', mic:'minutos', micon:'veces', cam:'minutos', camon:'veces', strm:'minutos', stron:'veces', days:'días', acct:'días' };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const number = value => new Intl.NumberFormat('es').format(Number(value) || 0);
  const loginUrl = () => `/auth/discord?returnTo=${encodeURIComponent(`${location.pathname}?view=${view}`)}`;
  const showLoginNotice = () => {
    ui.loginTop.href = loginUrl(); ui.loginTop.hidden = false;
    showNotice('Conecta tu Discord', 'Inicia sesión para elegir uno de tus servidores y consultar sus logros.', 'error');
    const link = document.createElement('a'); link.className = 'login-button'; link.href = loginUrl(); link.textContent = 'Continuar con Discord ↗'; ui.notice.append(link);
  };
  const loadServerChoices = async serial => {
    if (fixedGuildId) return true;
    if (!serverChoices) {
      const response = await fetch('/api/achievement-servers', { credentials:'same-origin', headers:{ Accept:'application/json' } });
      if (serial !== loadSerial) return false;
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { showLoginNotice(); return false; }
      if (!response.ok) { showNotice('No se pudieron cargar tus servidores', data.error || 'Vuelve a intentarlo en unos momentos.', 'error'); return false; }
      serverChoices = Array.isArray(data.guilds) ? data.guilds : [];
    }
    if (!serverChoices.length) {
      ui.serverPicker.hidden = true;
      showNotice('No hay servidores disponibles', 'Kuboq debe estar en un servidor al que pertenezca tu cuenta de Discord.', 'error');
      return false;
    }
    let savedId = guildId;
    if (!savedId) { try { savedId = localStorage.getItem('kuboq.achievements.server') || ''; } catch {} }
    guildId = serverChoices.some(server => server.id === savedId) ? savedId : serverChoices[0].id;
    ui.serverSelect.innerHTML = serverChoices.map(server => `<option value="${escapeHtml(server.id)}">${escapeHtml(server.name)}</option>`).join('');
    ui.serverSelect.value = guildId; ui.serverPicker.hidden = false;
    return true;
  };
  const setView = next => {
    view = next === 'server' ? 'server' : 'me';
    for (const tab of document.querySelectorAll('.view-tab')) tab.setAttribute('aria-pressed', String(tab.dataset.view === view));
    params.set('view', view); history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    ui.title.textContent = view === 'me' ? 'Tus logros, a tu ritmo.' : 'El progreso de todos.';
    ui.description.textContent = view === 'me' ? 'Cada mensaje, nivel y momento compartido suma a tu historia en el servidor.' : 'Descubre qué logros ya forman parte de la historia de esta comunidad.';
    payload = null;
    load();
  };
  const showNotice = (title, text, kind = '') => {
    ui.stats.hidden = true; ui.toolbar.hidden = true; ui.grid.innerHTML = '';
    ui.notice.hidden = false; ui.notice.className = `notice ${kind}`;
    ui.notice.innerHTML = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p>`;
  };
  const renderStats = data => {
    const items = view === 'me' ? [
      { label:'Logros obtenidos', value:`${number(data.unlocked)} / ${number(data.total)}`, detail:'Tu colección personal', icon:'🏆' },
      { label:'Puntos ganados', value:number(data.points), detail:'Según la rareza de cada logro', icon:'✦' },
      { label:'Progreso', value:`${data.total ? Math.round(data.unlocked / data.total * 100) : 0}%`, detail:'De los logros disponibles', icon:'↗' },
    ] : [
      { label:'Logros disponibles', value:number(data.total), detail:'En esta comunidad', icon:'🏅' },
      { label:'Miembros', value:number(data.guild.memberCount), detail:'En el servidor', icon:'♙' },
      { label:'Desbloqueos', value:number(data.unlocked), detail:'Sumados entre la comunidad', icon:'✦' },
    ];
    ui.stats.innerHTML = items.map(item => `<article class="stat-card" data-icon="${item.icon}"><span class="stat-label">${item.label}</span><strong class="stat-value">${item.value}</strong><span class="stat-detail">${item.detail}</span></article>`).join('');
    ui.stats.hidden = false;
  };
  const renderCategories = data => {
    const current = ui.category.value || 'all';
    const categories = [...new Set(data.achievements.map(item => item.category))];
    ui.category.innerHTML = '<option value="all">Todas las categorías</option>' + categories.map(key => `<option value="${escapeHtml(key)}">${escapeHtml(categoryLabels[key] || key)}</option>`).join('');
    if (categories.includes(current)) ui.category.value = current;
  };
  const filtered = () => {
    if (!payload) return [];
    const term = ui.search.value.trim().toLocaleLowerCase('es');
    const category = ui.category.value;
    return payload.achievements.filter(item => (category === 'all' || item.category === category) && (!term || `${item.name} ${item.description} ${item.categoryLabel}`.toLocaleLowerCase('es').includes(term)));
  };
  const renderCards = () => {
    const items = filtered();
    ui.count.textContent = `${items.length} ${items.length === 1 ? 'logro' : 'logros'}`;
    if (!items.length) {
      ui.grid.innerHTML = '<div class="empty-state">No encontramos logros con esos filtros. Prueba con otra búsqueda.</div>';
      return;
    }
    ui.grid.innerHTML = items.map(item => {
      const achieved = view === 'me' ? item.unlocked : item.current > 0;
      const progressText = view === 'me'
        ? (item.unlocked ? 'Desbloqueado' : `${number(item.current)} / ${number(item.target)} ${units[item.type] || ''}`)
        : `${number(item.current)} / ${number(item.total)} miembros`;
      const percent = Math.max(0, Math.min(100, Number(item.progress) || 0));
      return `<article class="achievement-card ${item.unlocked ? 'unlocked' : ''}">
        <div class="card-top"><div class="achievement-mark">${escapeHtml(item.emoji)}</div><span class="rarity" data-rarity="${escapeHtml(item.rarity)}">${escapeHtml(rarityLabels[item.rarity] || 'Común')} · +${number(item.points)} pts</span></div>
        <h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description)}</p>
        <div class="card-meta"><span class="state ${achieved ? 'done' : ''}">${view === 'me' ? (achieved ? 'Completado' : 'En progreso') : (achieved ? `${percent}% de la comunidad` : 'Aún sin desbloqueos')}</span><span>${escapeHtml(progressText)}</span></div>
        <div class="progress-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="points">${escapeHtml(item.categoryLabel)} <span aria-hidden="true">·</span> <strong>${view === 'me' && item.unlocked ? 'Logro en tu colección' : `${percent}% completado`}</strong></div>
      </article>`;
    }).join('');
  };
  function render(data) {
    payload = data; ui.notice.hidden = true; ui.serverChip.hidden = false;
    ui.serverName.textContent = data.guild.name;
    if (data.guild.icon) { ui.serverIcon.src = data.guild.icon; ui.serverIcon.hidden = false; }
    ui.loginTop.hidden = true;
    if (view === 'me' && data.user) {
      ui.userChip.hidden = false; ui.userName.textContent = data.user.name;
      if (data.user.avatar) ui.userAvatar.src = data.user.avatar;
    } else ui.userChip.hidden = true;
    renderStats(data); renderCategories(data); ui.toolbar.hidden = false; renderCards();
  }
  async function load() {
    const serial = ++loadSerial;
    const requestedView = view;
    showNotice('Cargando logros…', 'Estamos conectando con Kuboq y preparando los servidores disponibles.');
    try {
      if (!(await loadServerChoices(serial))) return;
      if (serial !== loadSerial) return;
      const response = await fetch(`/api/achievements/${encodeURIComponent(guildId)}?view=${requestedView}`, { credentials:'same-origin', headers:{ Accept:'application/json' } });
      if (serial !== loadSerial) return;
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { showLoginNotice(); return; }
      if (!response.ok) {
        showNotice(response.status === 403 ? 'Este perfil no pertenece al servidor' : 'No encontramos este servidor', response.error || data.error || 'Comprueba el enlace e inténtalo de nuevo.', 'error');
        return;
      }
      render(data);
    } catch {
      if (serial !== loadSerial) return;
      showNotice('No se pudo conectar con Kuboq', 'Revisa tu conexión y vuelve a cargar esta página.', 'error');
    }
  }
  document.querySelectorAll('.view-tab').forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view)));
  ui.serverSelect.addEventListener('change', () => {
    guildId = ui.serverSelect.value;
    try { localStorage.setItem('kuboq.achievements.server', guildId); } catch {}
    load();
  });
  ui.search.addEventListener('input', renderCards); ui.category.addEventListener('change', renderCards);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); ui.search.focus(); }
  });
  setView(view);
})();
