(() => {
  'use strict';
  const q = s => document.querySelector(s), root = q('#content'), nav = q('#nav');
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brandName = value => {const name=String(value||'').trim();return !name||/^club\s*24\s*\/\s*7$/i.test(name)?'Kuboq':name;};
  const st = {moduleCommand:{},moduleChannels:{},moduleTab:'ajustes',welcomeEvent:'bienvenida',welcomeAdvanced:false,autoroleAdvanced:false,panelAdvanced:false,applicationAdvanced:false,birthdayAdvanced:false,replyAdvanced:false,achievementCommands:false,ready:false,user:null,guilds:[],guild:null,resources:{channels:[],roles:[],members:[]},settings:null,commands:[],active:'',query:'',category:'all',music:null};
  const toast = (s,bad) => { const e=document.createElement('div');e.className='toast'+(bad?' error':'');e.textContent=s;q('#toastStack').appendChild(e);setTimeout(()=>e.remove(),3500); };
  const api = async (url,opts) => { opts=opts||{};opts.credentials='same-origin';opts.headers=Object.assign({},opts.body?{'Content-Type':'application/json'}:{},opts.headers||{});const r=await fetch(url,opts),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('Error '+r.status));return d; };
  const selectText = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
  let selectSequence=0;
  function selectKind(select){const label=select.closest('.c247-field')?.querySelector('label')?.textContent||select.closest('label')?.querySelector('span')?.textContent||select.id||select.dataset.rewardRole||'';return /rol|role/i.test(label)?'role':/canal|voz|voice|channel|categor/i.test(label)?'channel':'option';}
  function selectIcon(kind,label,value){if(kind==='channel'){const channel=st.resources.channels.find(item=>item.id===value);if(channel){if(channel.type===2||channel.type===13)return '🔊';if(channel.type===4)return '▱';if(channel.type===5)return '▤';return '#';}if(/^\s*🔊/.test(label))return '🔊';if(/^\s*📁/.test(label))return '▱';if(/^\s*#/.test(label))return '#';return '◌';}if(kind==='role')return '✦';return '✧';}
  function selectHint(select,option,kind){if(!option.value)return kind==='role'?'Sin asignación':'Elige una opción';if(kind==='role'){const role=st.resources.roles.find(item=>item.id===option.value);return role?.hoist?'Rol destacado':'Rol del servidor';}if(kind==='channel'){const channel=st.resources.channels.find(item=>item.id===option.value);return channel?.parentName||({0:'Canal de texto',5:'Canal de anuncios',2:'Canal de voz',13:'Canal de escenario',4:'Categoría'}[channel?.type]||'Canal del servidor');}return 'Opción disponible';}
  function syncSelectDisplay(select){
    const wrapper=select?.closest('.k-select');if(!wrapper)return;
    const option=select.options[select.selectedIndex],trigger=wrapper.querySelector('.k-select-trigger');
    const label=option?.textContent||'Selecciona…';
    wrapper.querySelector('.k-select-current').textContent=wrapper.dataset.kind==='channel'?label.replace(/^\s*(?:🔊|📁|#|▤)\s*/, ''):label;
    wrapper.querySelector('.k-select-trigger-icon').textContent=selectIcon(wrapper.dataset.kind,label,option?.value);
    trigger.classList.toggle('is-placeholder',!select.value);
    trigger.setAttribute('aria-invalid',select.validity?.valid===false?'true':'false');
    wrapper.querySelectorAll('[role="option"]').forEach(row=>{const selected=row.dataset.value===select.value;row.setAttribute('aria-selected',String(selected));row.classList.toggle('selected',selected);});
  }
  function renderSelectOptions(select){
    const wrapper=select.closest('.k-select');if(!wrapper)return;
    const kind=wrapper.dataset.kind,list=wrapper.querySelector('.k-select-options');list.replaceChildren();
    for(const option of select.options){
      const row=document.createElement('button');row.type='button';row.className='k-select-option';row.tabIndex=-1;row.setAttribute('role','option');row.dataset.value=option.value;row.disabled=option.disabled;
      const icon=document.createElement('span');icon.className='k-select-option-icon';icon.textContent=selectIcon(kind,option.textContent,option.value);
      if(kind==='role'&&option.value){const role=st.resources.roles.find(item=>item.id===option.value);if(role?.color&&role.color!=='#000000')icon.style.setProperty('--role-color',role.color);}
      const copy=document.createElement('span');copy.className='k-select-option-copy';
      const title=document.createElement('strong');title.textContent=kind==='channel'?option.textContent.replace(/^\s*(?:🔊|📁|#|▤)\s*/, ''):option.textContent;
      const hint=document.createElement('small');hint.textContent=selectHint(select,option,kind);
      copy.append(title,hint);const check=document.createElement('span');check.className='k-select-check';check.textContent='✓';row.append(icon,copy,check);
      row.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));wrapper.classList.remove('open','open-up');wrapper.querySelector('.k-select-popover').hidden=true;wrapper.querySelector('.k-select-trigger').setAttribute('aria-expanded','false');wrapper.querySelector('.k-select-trigger').focus();});
      row.addEventListener('keydown',event=>{const rows=[...list.querySelectorAll('[role="option"]')].filter(item=>!item.hidden&&!item.disabled),index=rows.indexOf(row);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();rows[Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1))) ]?.focus();}else if(event.key==='Home'){event.preventDefault();rows[0]?.focus();}else if(event.key==='End'){event.preventDefault();rows.at(-1)?.focus();}else if(event.key==='Escape'){event.preventDefault();wrapper.querySelector('.k-select-trigger').click();}});
      list.appendChild(row);
    }
    wrapper.querySelector('.k-select-count').textContent=select.options.length+' '+(select.options.length===1?'opción':'opciones');
    syncSelectDisplay(select);
  }
  function closeSelects(except){document.querySelectorAll('.k-select.open').forEach(wrapper=>{if(wrapper===except)return;wrapper.classList.remove('open','open-up');wrapper.querySelector('.k-select-popover').hidden=true;wrapper.querySelector('.k-select-trigger').setAttribute('aria-expanded','false');});}
  function openSelect(wrapper,focusSearch=true){
    closeSelects(wrapper);const panel=wrapper.querySelector('.k-select-popover'),trigger=wrapper.querySelector('.k-select-trigger');
    const rect=trigger.getBoundingClientRect(),width=Math.min(Math.max(rect.width,360),Math.max(240,window.innerWidth-32));panel.style.width=width+'px';panel.style.left=rect.left+width>window.innerWidth-16?'auto':'0';panel.style.right=rect.left+width>window.innerWidth-16?'0':'auto';
    panel.hidden=false;wrapper.classList.add('open');wrapper.classList.toggle('open-up',window.innerHeight-trigger.getBoundingClientRect().bottom<330);trigger.setAttribute('aria-expanded','true');
    const search=wrapper.querySelector('.k-select-search input');if(search){search.value='';filterSelectOptions(wrapper);if(focusSearch)search.focus();}
    else wrapper.querySelector('[aria-selected="true"]')?.focus();
  }
  function filterSelectOptions(wrapper){const input=wrapper.querySelector('.k-select-search input'),term=selectText(input?.value),rows=[...wrapper.querySelectorAll('.k-select-option')];let count=0;for(const row of rows){row.hidden=Boolean(term&&!selectText(row.textContent).includes(term));if(!row.hidden)count++;}wrapper.querySelector('.k-select-empty').hidden=count>0;wrapper.querySelector('.k-select-count').textContent=term?`${count} ${count===1?'resultado':'resultados'}`:`${rows.length} ${rows.length===1?'opción':'opciones'}`;}
  function enhanceSelect(select){
    if(select.dataset.kEnhanced||select.multiple)return;
    select.dataset.kEnhanced='true';const kind=selectKind(select),id='kuboq-select-'+(++selectSequence),field=select.closest('.c247-field'),label=field?.querySelector('label');
    const wrapper=document.createElement('div');wrapper.className='k-select';wrapper.dataset.kind=kind;wrapper.dataset.selectId=id;
    select.classList.add('k-native-select');select.setAttribute('aria-hidden','true');select.tabIndex=-1;
    const trigger=document.createElement('button');trigger.type='button';trigger.className='k-select-trigger';trigger.id=id;trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',id+'-list');trigger.setAttribute('aria-label',label?.textContent||'Selecciona una opción');trigger.setAttribute('aria-required',String(select.required));
    const badge=document.createElement('span');badge.className='k-select-trigger-icon';badge.textContent=selectIcon(kind,select.options[select.selectedIndex]?.textContent||'',select.value);
    const current=document.createElement('span');current.className='k-select-current';const caret=document.createElement('span');caret.className='k-select-caret';caret.textContent='⌄';trigger.append(badge,current,caret);
    const panel=document.createElement('div');panel.className='k-select-popover';panel.hidden=true;panel.setAttribute('role','presentation');
    const header=document.createElement('div');header.className='k-select-heading';const title=document.createElement('strong');title.textContent=kind==='role'?'ROLES DEL SERVIDOR':kind==='channel'?'CANALES DEL SERVIDOR':'OPCIONES';const count=document.createElement('small');count.className='k-select-count';header.append(title,count);panel.append(header);
    const shouldSearch=kind!=='option'||select.options.length>7;
    if(shouldSearch){const searchWrap=document.createElement('label');searchWrap.className='k-select-search';const search=document.createElement('input');search.type='search';search.placeholder=kind==='role'?'Buscar un rol…':kind==='channel'?'Buscar un canal…':'Filtrar opciones…';search.setAttribute('aria-label',search.placeholder);search.autocomplete='off';searchWrap.append(search);panel.append(searchWrap);search.addEventListener('input',()=>filterSelectOptions(wrapper));search.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();trigger.click();}else if(event.key==='ArrowDown'){event.preventDefault();wrapper.querySelector('.k-select-option:not([hidden])')?.focus();}});}
    const list=document.createElement('div');list.className='k-select-options';list.id=id+'-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',title.textContent);panel.append(list);
    const empty=document.createElement('div');empty.className='k-select-empty';empty.textContent='No encontramos coincidencias.';empty.hidden=true;panel.append(empty);
    const footer=document.createElement('div');footer.className='k-select-footer';footer.textContent='↑ ↓ navegar · Enter seleccionar · Esc cerrar';panel.append(footer);
    const parent=select.parentNode;parent.insertBefore(wrapper,select);wrapper.append(select,trigger,panel);
    if(label){label.addEventListener('click',event=>{event.preventDefault();trigger.focus();trigger.click();});label.setAttribute('aria-controls',id);}
    trigger.addEventListener('click',()=>{if(wrapper.classList.contains('open')){wrapper.classList.remove('open','open-up');panel.hidden=true;trigger.setAttribute('aria-expanded','false');}else openSelect(wrapper);});
    trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){event.preventDefault();openSelect(wrapper,false);const rows=[...list.querySelectorAll('.k-select-option')].filter(row=>!row.disabled&&!row.hidden),selected=rows.find(row=>row.getAttribute('aria-selected')==='true');(selected||rows[0])?.focus();}else if(event.key==='Escape'&&wrapper.classList.contains('open')){trigger.click();}});
    select.addEventListener('change',()=>{syncSelectDisplay(select);});
    select.addEventListener('invalid',()=>{trigger.focus();openSelect(wrapper,false);trigger.setAttribute('aria-invalid','true');});
    renderSelectOptions(select);
  }
  function scanSelects(node){if(node?.matches?.('select'))enhanceSelect(node);node?.querySelectorAll?.('select').forEach(enhanceSelect);}
  document.addEventListener('click',event=>{if(!event.target.closest('.k-select')&&!event.target.closest('label[aria-controls]'))closeSelects();});
  const selectObserver=new MutationObserver(records=>records.forEach(record=>{const affected=record.target.matches?.('select.k-native-select')?record.target:record.target.closest?.('select.k-native-select')||record.target.parentElement?.closest?.('select.k-native-select');if(affected)renderSelectOptions(affected);record.addedNodes.forEach(scanSelects);}));
  selectObserver.observe(document.body,{childList:true,subtree:true});
  scanSelects(document.body);
  const gid = () => st.guild ? st.guild.id : '';
  function showSessionAvatar(element){
    if(!element)return;
    element.textContent=st.user?.username?.slice(0,1).toUpperCase()||'24';
    let url;
    try{url=new URL(st.user?.avatar||'');}catch{return;}
    if(url.protocol!=='https:'||url.hostname!=='cdn.discordapp.com'||!/^\/avatars\/\d+\/[a-zA-Z0-9_-]+\.(?:png|gif|webp)$/.test(url.pathname))return;
    const img=document.createElement('img');
    img.src=url.href;img.alt='';img.decoding='async';
    img.addEventListener('error',()=>img.remove(),{once:true});
    element.appendChild(img);
  }
  const normalize=v=>String(v||'').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function filterSidebarNav(){
    const term=normalize(q('#moduleSearch').value.trim());
    const hidden=new Set(st.settings?.dashboard?.hiddenModules||[]);
    let count=0;
    nav.querySelectorAll('.c247-nav').forEach(button=>{
      const category=button.dataset.livecat;
      const matches=!term||normalize(button.textContent).includes(term)||(category&&[...moduleCommands(category),...moduleDiscordCommands(category)].some(command=>normalize(command.name+' '+command.description).includes(term)));
      button.hidden=Boolean(category&&hidden.has(category))||!matches;
      if(!button.hidden)count++;
    });
    [...nav.querySelectorAll('.nav-group')].reverse().forEach(group=>{group.hidden=![...group.querySelectorAll('.c247-nav')].some(button=>!button.hidden);});
    let empty=q('#navEmpty');
    if(!empty){empty=document.createElement('div');empty.id='navEmpty';empty.className='nav-empty';nav.appendChild(empty);}
    empty.hidden=count>0;empty.textContent='No hay funciones para «'+q('#moduleSearch').value.trim()+'».';
  }
  q('#moduleSearch').addEventListener('input',filterSidebarNav);
  q('#mobileMenu').onclick=()=>{q('#sidebar').classList.toggle('open');q('#mobileOverlay').classList.toggle('show');};q('#mobileOverlay').onclick=()=>{q('#sidebar').classList.remove('open');q('#mobileOverlay').classList.remove('show');};
  const context=document.createElement('div');context.id='c247-context';context.className='c247-context';root.before(context);
  function addNav(){
    nav.innerHTML='<div class="nav-group"><div class="group-title">Principal</div><button class="c247-nav" data-c247="home"><span class="nav-symbol">⌂</span><span>Inicio</span></button><button class="c247-nav" data-c247="activity"><span class="nav-symbol">◷</span><span>Actividad</span></button><button class="c247-nav" data-c247="commands"><span class="nav-symbol">◫</span><span>Explorar funciones</span></button></div><div class="nav-group"><div class="group-title">Administración</div><button class="c247-nav" data-c247="config"><span class="nav-symbol">⚙</span><span>Configuración</span></button><button class="c247-nav" data-c247="personalize"><span class="nav-symbol">✧</span><span>Apariencia</span></button><button class="c247-nav" data-c247="music"><span class="nav-symbol">♫</span><span>Música</span></button></div>';
    renderCatalogNav();
  }
  function gate(msg,configured){let d=q('#c247-gate');if(!d){d=document.createElement('div');d.id='c247-gate';d.className='c247-auth';document.body.appendChild(d);}d.innerHTML='<section><div class="brand-mark"><img src="/assets/brand/kuboq-logo.png" alt=""></div><h1>Dashboard Kuboq</h1><p>'+esc(msg)+'</p>'+(configured?'<button id="c247-login" class="button primary">Iniciar sesión con Discord</button>':configured===false?'<small>Completa la configuración OAuth2 privada en config.json:</small><code>discord.clientId</code><code>dashboard.clientSecret</code><code>dashboard.sessionSecret (32+ caracteres)</code><code>dashboard.redirectUri</code><small>Registra esa URI en Discord Developer Portal.</small>':'')+'</section>';q('#c247-login')?.addEventListener('click',()=>location.href='/auth/discord');}
  function serverPath(){
    const match=location.pathname.match(/^\/dashboard\/([^/]+)\/?$/);
    return match&&match[1]!=='servers'?decodeURIComponent(match[1]):null;
  }
  function chooseServer(push=true){
    st.loadSerial=(st.loadSerial||0)+1;
    st.guild=null;
    st.active='';
    closeQuick();
    document.body.classList.add('server-selection');
    q('#sidebar').classList.remove('open');q('#mobileOverlay').classList.remove('show');
    if(push&&location.pathname!=='/dashboard/servers')history.pushState({},'','/dashboard/servers');
    document.title='Elige un servidor · Kuboq';
    const user=esc(st.user?.username||'tu cuenta');
    root.innerHTML='<div class="server-shell"><div class="server-head"><a href="/" class="server-brand"><span class="brand-mark"><img src="/assets/brand/kuboq-logo.png" alt=""></span><span><strong>Kuboq</strong><small>Panel de control</small></span></a><div class="server-profile"><span class="session-avatar" id="serverSessionAvatar"></span><span>'+user+'</span><button type="button" id="server-logout" aria-label="Cerrar sesión">Salir ↗</button></div></div><div class="server-hero"><span class="eyebrow">TU DASHBOARD · KUBOQ</span><h1>Elige un servidor<span>.</span></h1><p>Selecciona el espacio que quieres administrar. Cada servidor conserva sus propios ajustes y módulos.</p></div><div class="server-tools"><label class="server-search"><span aria-hidden="true">⌕</span><input id="server-filter" type="search" placeholder="Buscar servidores…" aria-label="Buscar servidores" autocomplete="off"></label><span class="server-count">'+st.guilds.length+' '+(st.guilds.length===1?'servidor disponible':'servidores disponibles')+'</span></div><div class="server-grid" id="server-grid">'+(st.guilds.length?st.guilds.map(g=>'<button type="button" class="server-card" data-server="'+esc(g.id)+'"><span class="server-icon">'+(g.icon&&/^https:\/\//i.test(g.icon)?'<img src="'+esc(g.icon)+'" alt="">':esc(g.name?.slice(0,2).toUpperCase()||'K'))+'</span><span class="server-card-copy"><strong>'+esc(g.name)+'</strong><small>'+Number(g.memberCount||0).toLocaleString('es-DO')+' miembros · Bot conectado</small></span><span class="server-arrow">↗</span></button>').join(''):'<div class="server-empty"><span>◇</span><h2>No hay servidores disponibles</h2><p>Entra con una cuenta que pueda administrar un servidor donde Kuboq esté instalado.</p><a href="/">Volver al inicio ↗</a></div>')+'</div><p class="server-no-results" id="server-no-results" hidden>No hay servidores que coincidan con esa búsqueda.</p><div class="server-bottom"><span><i></i> Sesión iniciada con Discord</span><a href="/">← Conocer Kuboq</a></div></div>';
    showSessionAvatar(q('#serverSessionAvatar'));
    q('#server-filter').addEventListener('input',e=>{
      const term=e.target.value.trim().toLocaleLowerCase('es');let visible=0;
      root.querySelectorAll('.server-card').forEach(card=>{card.hidden=!card.querySelector('strong').textContent.toLocaleLowerCase('es').includes(term);if(!card.hidden)visible++;});
      q('#server-no-results').hidden=!term||visible>0||!st.guilds.length;
    });
    root.querySelectorAll('[data-server]').forEach(card=>card.addEventListener('click',()=>loadGuild(card.dataset.server)));
    q('#server-logout').onclick=async()=>{try{await api('/auth/logout',{method:'POST'});location.href='/';}catch(e){toast(e.message,true);}};
  }
  function updateContext(){
    if(!st.ready)return;
    q('#activeServerName').textContent=st.guild?.name||'Selecciona un servidor';
    q('#topServerName').textContent=st.guild?'SERVIDOR · '+st.guild.name:'DASHBOARD';
    const icon=st.guild?.icon;
    q('#activeServerIcon').innerHTML=icon?'<img src="'+esc(icon)+'" alt="">':'24';
    q('#changeServer').onclick=()=>chooseServer();
    q('#sessionLogout').onclick=async()=>{try{await api('/auth/logout',{method:'POST'});location.href='/';}catch(e){toast(e.message,true);}};
  }
  async function loadGuild(id,push=true){
    const selected=st.guilds.find(g=>g.id===id);
    if(!selected){chooseServer(push);return;}
    const serial=st.loadSerial=(st.loadSerial||0)+1;
    root.innerHTML='<div class="server-loading" role="status"><div class="loading-emblem"><span class="brand-mark"><img src="/assets/brand/kuboq-logo.png" alt=""></span><span class="loading-orbit" aria-hidden="true"></span></div><h2>Abriendo tu servidor</h2><p>Cargando los módulos de '+esc(selected.name)+'…</p></div>';
    try{
      const b='/api/guild/'+encodeURIComponent(id),a=await Promise.all([api(b+'/summary'),api(b+'/resources'),api(b+'/settings'),api(b+'/commands')]);
      if(serial!==st.loadSerial)return;
      st.guild=selected;st.summary=a[0];st.resources=a[1];st.settings=a[2];st.commands=a[3].commands;st.music=null;
      document.body.classList.remove('server-selection');
      st.active='home';localStorage.setItem('club247-guild',id);
      if(push)history.pushState({},'','/dashboard/'+encodeURIComponent(id));
      document.title=selected.name+' · Kuboq';
      updateContext();renderCatalogNav();applyPrefs();render('home');
    }catch(e){if(serial!==st.loadSerial)return;toast(e.message,true);chooseServer(push);}
  }
  function applyPrefs(){const s=st.settings;if(!s)return;const d=s.dashboard||{},i=s.identity||{};document.documentElement.style.setProperty('--teal',/^#(?:a33ce2|8b5cf6)$/i.test(d.accent||'')?'#ff3159':d.accent||'#ff3159');document.body.classList.toggle('c247-compact',d.density==='compact');const n=q('.brand-name');if(n)n.textContent=brandName(i.name);const cap=q('.brand-caption');if(cap&&d.brandCaption)cap.textContent=d.brandCaption;const mark=q('.brand-mark');if(mark)mark.innerHTML='<img src="'+esc(i.logoUrl||'/assets/brand/kuboq-logo.png')+'" alt="">';filterSidebarNav();}
  function head(symbol,name,desc){return '<div class="c247-title"><div class="heading-icon">'+symbol+'</div><div><h1>'+esc(name)+'</h1><p>'+esc(desc)+'</p></div></div>';}
  function card(name,body,desc){return '<article class="c247-card"><h2>'+esc(name)+'</h2>'+(desc?'<p>'+esc(desc)+'</p>':'')+body+'</article>';}
  function homePage(refresh=true){
    st.active='home';
    q('#crumbPage').textContent='Resumen';
    const data=st.summary||{};
    const count=Number(data.commandCount||0);
    const uptime=Number(data.uptime||0);
    const online=uptime>=3600 ? Math.floor(uptime/3600)+' h' : Math.floor(uptime/60)+' min';
    const stat=(title,value,detail)=>'<article class="stat-card"><div class="stat-top">'+esc(title)+'</div><div class="stat-value">'+esc(value)+'</div><div class="stat-foot">'+esc(detail)+'</div></article>';
    const recent=(data.recentActivity||[]).map(activityRow).join('')||'<p class="c247-muted">Todavía no hay actividad registrada.</p>';
    root.innerHTML='<section class="hero"><div class="hero-copy"><span class="eyebrow">Kuboq · Panel del servidor</span><h1>'+esc(data.name||st.guild?.name||'Tu servidor')+'</h1><p>Controla las funciones activas y administra tu comunidad desde un solo lugar.</p><div class="hero-actions"><button type="button" class="button primary" data-c247="commands">Explorar comandos ↗</button><button type="button" class="quiet-button" data-c247="music">Abrir música ♫</button></div></div></section>'+
      '<div class="stats-grid">'+stat('Miembros',Number(data.memberCount||0).toLocaleString('es-DO'),'En el servidor')+stat('Canales',data.channels||0,'Disponibles')+stat('Roles',data.roles||0,'Configurados')+stat('Comandos',count,'Registrados en el bot')+'</div>'+
      '<div class="dashboard-grid"><div>'+card('Accesos directos','<div class="quick-actions"><button class="quiet-button" data-c247="commands">⌘ &nbsp;Comandos</button><button class="quiet-button" data-c247="activity">◷ &nbsp;Actividad</button><button class="quiet-button" data-c247="config">☷ &nbsp;Configuración</button><button class="quiet-button" data-c247="personalize">⚙ &nbsp;Apariencia</button></div>','Gestiona los sistemas del bot para este servidor.')+card('Actividad reciente','<div>'+recent+'</div><button class="quiet-button" data-c247="activity">Ver historial completo ↗</button>')+'</div><div class="dashboard-side">'+card('Estado del bot','<div class="c247-row"><b>'+esc(data.botUser||'Kuboq')+'</b><small>'+(data.botReady?'En línea':'Reconectando')+'</small></div><div class="c247-row"><b>Tiempo activo</b><small>'+esc(online)+'</small></div><div class="c247-row"><b>Actividad registrada</b><small>'+Number(data.activity||0).toLocaleString('es-DO')+'</small></div>')+'</div></div>';
    if(refresh){
      const guildId=gid(),serial=st.homeSummarySerial=(st.homeSummarySerial||0)+1;
      api('/api/guild/'+encodeURIComponent(guildId)+'/summary').then(summary=>{if(st.active==='home'&&gid()===guildId&&serial===st.homeSummarySerial){st.summary=summary;homePage(false);}}).catch(()=>{});
    }
  }
  function activityRow(item){
    const date=new Date(item.fecha),when=Number.isNaN(date.getTime())?'':date.toLocaleString('es-DO',{dateStyle:'medium',timeStyle:'short'});
    const types={comando:'Comando',boton:'Botón',formulario:'Formulario',interaccion:'Interacción',configuracion:'Configuración',musica:'Música'};
    return '<div class="c247-row"><b>'+esc(item.nombre||types[item.tipo]||item.tipo||'Actividad')+'</b><small>'+esc(item.usuario||'Usuario')+' · '+esc(when)+'</small></div>';
  }
  async function activityPage(){
    const guildId=gid();
    root.innerHTML=head('◷','Actividad del servidor','Un registro claro de lo que ocurre en este servidor.')+'<section class="activity-overview"><div class="activity-welcome"><div><span class="eyebrow">KUBOQ · REGISTRO DEL SERVIDOR</span><h2>Todo lo que pasa, en un solo lugar</h2><p>Explora comandos, cambios de configuración e interacciones recientes.</p></div><span class="activity-live-pill"><i></i> Registro disponible</span></div><div class="activity-metrics"><article class="activity-metric"><span>Total registrado</span><strong id="activity-total">'+Number(st.summary?.activity||0).toLocaleString('es-DO')+'</strong><small>Eventos almacenados</small></article><article class="activity-metric"><span>Eventos recientes</span><strong id="activity-recent-count">—</strong><small>En los últimos 50 registros</small></article><article class="activity-metric"><span>Último evento</span><strong id="activity-last">—</strong><small>Hora local del servidor</small></article></div></section><section class="activity-panel"><div class="activity-panel-head"><div><span class="eyebrow">HISTORIAL</span><h2>Registro reciente</h2><p>Busca por acción o persona y filtra por tipo o fecha.</p></div><button type="button" class="quiet-button" id="activity-refresh">↻ Actualizar</button></div><div class="activity-toolbar"><label class="activity-search"><span>⌕</span><input type="search" id="activity-search" placeholder="Buscar actividad o usuario…" aria-label="Buscar actividad o usuario"></label><select id="activity-type" aria-label="Filtrar por tipo"><option value="all">Todos los tipos</option><option value="comando">Comandos</option><option value="configuracion">Configuración</option><option value="musica">Música</option><option value="interaccion">Interacciones</option><option value="boton">Botones</option><option value="formulario">Formularios</option></select><select id="activity-period" aria-label="Filtrar por fecha"><option value="all">Cualquier fecha</option><option value="1">Últimas 24 horas</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select><span class="activity-result-count" id="activity-result-count">Cargando…</span></div><div id="activity-list" class="activity-list"><div class="activity-empty"><span>◷</span><strong>Cargando actividad</strong><small>Estamos reuniendo los eventos recientes.</small></div></div></section>';
    let items=[];
    const typeNames={comando:'Comando',boton:'Botón',formulario:'Formulario',interaccion:'Interacción',configuracion:'Configuración',musica:'Música'};
    const renderItems=()=>{
      const term=normalize(q('#activity-search').value.trim()),type=q('#activity-type').value,days=Number(q('#activity-period').value||0),since=days?Date.now()-days*86400000:0;
      const filtered=items.filter(item=>{const date=new Date(item.fecha),haystack=normalize([item.nombre,item.usuario,item.tipo].join(' '));return (!term||haystack.includes(term))&&(type==='all'||item.tipo===type)&&(!since||(!Number.isNaN(date.getTime())&&date.getTime()>=since));});
      q('#activity-result-count').textContent=filtered.length+' de '+items.length+' eventos';
      q('#activity-recent-count').textContent=items.length.toLocaleString('es-DO');
      const latest=items.length?new Date(items[0].fecha):null;
      q('#activity-last').textContent=latest&&!Number.isNaN(latest.getTime())?latest.toLocaleTimeString('es-DO',{hour:'2-digit',minute:'2-digit'}):'Sin eventos';
      q('#activity-list').innerHTML=filtered.length?filtered.map(item=>{const date=new Date(item.fecha),when=Number.isNaN(date.getTime())?'Fecha desconocida':date.toLocaleString('es-DO',{dateStyle:'medium',timeStyle:'short'}),kind=item.tipo||'actividad';return '<article class="activity-entry"><span class="activity-entry-icon" data-kind="'+esc(kind)+'">'+esc(({comando:'⌘',configuracion:'⚙',musica:'♫',interaccion:'✦',boton:'◉',formulario:'▤'})[kind]||'•')+'</span><div class="activity-entry-main"><div class="activity-entry-title"><strong>'+esc(item.nombre||typeNames[kind]||'Actividad del bot')+'</strong><span class="activity-kind" data-kind="'+esc(kind)+'">'+esc(typeNames[kind]||kind)+'</span></div><small>'+esc(item.usuario||'Kuboq')+'</small></div><time datetime="'+esc(date instanceof Date&&!Number.isNaN(date.getTime())?date.toISOString():'')+'">'+esc(when)+'</time></article>';}).join(''):'<div class="activity-empty"><span>⌕</span><strong>'+(items.length?'No encontramos resultados':'Aún no hay actividad')+'</strong><small>'+(items.length?'Prueba otra búsqueda o cambia los filtros.':'Cuando haya comandos e interacciones, aparecerán aquí.')+'</small>'+(items.length?'<button type="button" class="quiet-button" id="activity-clear-filters">Limpiar filtros</button>':'')+'</div>';
      q('#activity-clear-filters')?.addEventListener('click',()=>{q('#activity-search').value='';q('#activity-type').value='all';q('#activity-period').value='all';renderItems();});
    };
    const load=async()=>{
      const button=q('#activity-refresh');button.disabled=true;button.textContent='↻ Actualizando…';
      try{const [result,summary]=await Promise.all([api('/api/guild/'+encodeURIComponent(guildId)+'/activity'),api('/api/guild/'+encodeURIComponent(guildId)+'/summary').catch(()=>st.summary)]);if(st.active!=='activity'||gid()!==guildId)return;items=result.activity||[];if(summary)st.summary=summary;q('#activity-total').textContent=Number(summary?.activity??items.length).toLocaleString('es-DO');renderItems();}
      catch(error){if(st.active==='activity'&&gid()===guildId){q('#activity-list').innerHTML='<div class="activity-empty activity-error"><span>!</span><strong>No se pudo cargar el registro</strong><small>'+esc(error.message)+'</small><button type="button" class="quiet-button" id="activity-retry">Intentar de nuevo</button></div>';q('#activity-retry').onclick=load;}}
      finally{if(st.active==='activity'&&gid()===guildId){button.disabled=false;button.textContent='↻ Actualizar';}}
    };
    q('#activity-refresh').onclick=load;
    ['#activity-search','#activity-type','#activity-period'].forEach(selector=>q(selector).addEventListener('input',renderItems));
    q('#activity-type').addEventListener('change',renderItems);q('#activity-period').addEventListener('change',renderItems);
    await load();
  }
  function field(id,name,type,required,placeholder){return '<div class="c247-field"><label for="'+esc(id)+'">'+esc(name)+(required?' · requerido':'')+'</label><input id="'+esc(id)+'" type="'+(type==='integer'?'number':'text')+'" '+(type==='integer'?'step="1" ':'')+(required?'required ':'')+'placeholder="'+esc(placeholder||'')+'"></div>';}
  function choice(id,name,opts,required){return '<div class="c247-field"><label for="'+esc(id)+'">'+esc(name)+(required?' · requerido':'')+'</label><select id="'+esc(id)+'" '+(required?'required':'')+'><option value="">Selecciona…</option>'+opts.map(o=>'<option value="'+esc(o.value)+'">'+esc(o.label)+'</option>').join('')+'</select></div>';}
  function commandPage(){
    const categories=[...new Set(st.commands.filter(c=>c.category!=='musica').map(c=>categoryAlias[c.category]||c.category))].sort((a,b)=>(commandLabels[a]||a).localeCompare(commandLabels[b]||b,'es'));
    const cards=categories.map(category=>{
      const commands=moduleCommands(category);
      const discordCommands=moduleDiscordCommands(category);
      const title=commandLabels[category]||category;
      const count=[commands.length?commands.length+' desde el panel':'',discordCommands.length?discordCommands.length+' desde Discord':''].filter(Boolean).join(' · ');
      return '<button class="directory-card" data-open-module="'+esc(category)+'"><span class="directory-icon">'+esc(moduleIcon(category))+'</span><strong>'+esc(title)+'</strong><small>'+esc(count||'Sin comandos')+'</small><span class="directory-cta">Abrir ↗</span></button>';
    }).join('');
    root.innerHTML=head('◫','Funciones del bot','Abre cada sistema para configurar sus opciones y ver el resultado antes de guardar.')+
      '<div class="directory-intro"><div><span class="eyebrow">Sistemas disponibles</span><h2>Elige qué quieres administrar</h2><p>Cada sección usa los comandos y ajustes registrados en Kuboq.</p></div><strong>'+categories.length+'<small> módulos</small></strong></div>'+
      '<div class="c247-field directory-search"><label for="directoryFilter">Buscar función</label><input id="directoryFilter" type="search" placeholder="Por ejemplo: bienvenidas, tickets, niveles…"></div>'+
      '<div class="directory-grid" id="directoryGrid">'+cards+'</div>';
    q('#directoryFilter').oninput=e=>{const term=e.target.value.trim().toLocaleLowerCase('es');q('#directoryGrid').querySelectorAll('.directory-card').forEach(card=>{card.hidden=!card.textContent.toLocaleLowerCase('es').includes(term);});};
  }
  function responses(a){const lines=[];(a||[]).forEach(r=>{if(r.content)lines.push(r.content);(r.embeds||[]).forEach(e=>lines.push([e.title,e.description].filter(Boolean).join('\\n')));if(r.components?.length)lines.push('Los botones y menús del panel se utilizan en Discord.');if(r.files)lines.push('El comando generó '+r.files+' archivo(s) en Discord.');});(q('#module-result')||q('#c247-output')).innerHTML='<div class="c247-result">'+esc(lines.join('\\n\\n')||'Listo. El comando se ejecutó.')+'</div>';}
  function modalInputs(m){const out=[];const walk=x=>{if(!x)return;if(Array.isArray(x)){x.forEach(walk);return;}if(typeof x!=='object')return;if(x.type===4&&x.custom_id)out.push(x);Object.values(x).forEach(walk);};walk(m.components);return out;}
  function showModal(m){const fs=modalInputs(m);if(!fs.length)return toast('No pude mostrar este formulario.',true);const d=document.createElement('div');d.className='c247-modal';d.innerHTML='<section><h2>'+esc(m.title||'Formulario')+'</h2><form id="c247-modal-form">'+fs.map(f=>'<div class="c247-field"><label for="'+esc(f.custom_id)+'">'+esc(f.label||f.custom_id)+'</label>'+(f.style===2?'<textarea id="'+esc(f.custom_id)+'" '+(f.required?'required':'')+' maxlength="'+(f.max_length||4000)+'"></textarea>':'<input id="'+esc(f.custom_id)+'" '+(f.required?'required':'')+' maxlength="'+(f.max_length||4000)+'">')+'</div>').join('')+'<div class="c247-actions"><button class="button primary">Enviar formulario</button></div></form></section>';document.body.appendChild(d);d.querySelector('form').onsubmit=async e=>{e.preventDefault();const vals={};fs.forEach(f=>vals[f.custom_id]=d.querySelector('#'+CSS.escape(f.custom_id)).value);try{const r=await api('/api/guild/'+encodeURIComponent(gid())+'/commands/modal',{method:'POST',body:JSON.stringify({fields:vals})});d.remove();responses(r.responses);api('/api/guild/'+encodeURIComponent(gid())+'/summary').then(data=>{st.summary=data;}).catch(()=>{});toast('Formulario enviado.');}catch(err){toast(err.message,true);}};}
  async function musicFetch(guildId=gid()){const data=await api('/api/guild/'+encodeURIComponent(guildId)+'/music');if(gid()===guildId)st.music=data;return data;}
  function musicPoolMarkup(m){
    const total=Number(m.players||0),available=Number(m.availablePlayers||0),assigned=Number(m.assignedPlayers||0),ready=Number(m.readyPlayers||0);
    if(!total)return 'No hay bots reproductores configurados.';
    return available+' disponibles · '+assigned+' en uso · '+ready+'/'+total+' conectados';
  }
  function updateMusicLive(){
    const m=st.music||{};
    const state=q('#music-live-state'),track=q('#music-live-track'),author=q('#music-live-author'),queueNode=q('#music-queue'),poolNode=q('#music-pool-status'),voiceNode=q('#music-voice-status'),voiceSelect=q('#c247-voice');
    if(state)state.textContent=m.paused?'En pausa':m.playing?'Reproduciendo ahora':'Sin reproducción';
    if(track)track.textContent=m.current?.title||'Elige una canción';
    if(author)author.textContent=m.current?.author||'La música comienza cuando agregas una canción';
    if(queueNode)queueNode.innerHTML=(m.queue||[]).map((item,index)=>'<div class="c247-row"><b>'+(index+1)+'. '+esc(item.title)+'</b><small>'+esc(item.author||'')+'</small></div>').join('')||'<p>La cola está vacía.</p>';
    if(voiceNode)voiceNode.innerHTML='<b>'+(m.permanentConnected?'🟢 Conectado 24/7':m.permanentChannelId?'🟡 Canal guardado · reconectando':'⚪ Desconectado')+'</b><small>'+(m.permanentChannelId?'Canal: #'+esc(channelName(m.permanentChannelId)):'Elige un canal para mantener a Kuboq en voz.')+'</small>';
    if(voiceSelect&&!voiceSelect.closest('.k-select')?.classList.contains('open')&&voiceSelect.value!==(m.permanentChannelId||'')){voiceSelect.value=m.permanentChannelId||'';voiceSelect.dispatchEvent(new Event('change',{bubbles:true}));}
    const pause=q('[data-music="pause"]');if(pause)pause.textContent=m.paused?'▶ Reanudar':'⏸ Pausar';
    if(poolNode)poolNode.textContent=musicPoolMarkup(m);
    const overviewState=q('#music-overview-state'),overviewQueue=q('#music-overview-queue'),overviewPlayers=q('#music-overview-players'),overviewVoice=q('#music-overview-voice');
    if(overviewState)overviewState.textContent=m.paused?'En pausa':m.playing?'Reproduciendo':'En espera';
    if(overviewQueue)overviewQueue.textContent=String((m.queue||[]).length);
    if(overviewPlayers)overviewPlayers.textContent=Number(m.readyPlayers||0)+' / '+Number(m.players||0);
    if(overviewVoice)overviewVoice.textContent=m.permanentConnected?'Conectado':m.permanentChannelId?'Reconectando':'Desconectado';
  }
  async function refreshMusicLive(guildId=gid(),notify=false){
    try{await musicFetch(guildId);if(st.active==='music'&&gid()===guildId)updateMusicLive();}
    catch(error){if(notify&&st.active==='music'&&gid()===guildId)toast(error.message,true);}
  }
  async function musicPage(){const guildId=gid();root.innerHTML=head('♫','Centro de música','Cargando reproducción y controles…')+'<div class="music-loading"><span class="loading-orbit" aria-hidden="true"></span><p>Conectando con los reproductores del servidor…</p></div>';try{await musicFetch(guildId);}catch(e){toast(e.message,true);}if(st.active==='music'&&gid()===guildId){renderMusic();if(st.musicPoll)clearInterval(st.musicPoll);st.musicPoll=setInterval(()=>refreshMusicLive(guildId),15000);}}
  function renderMusic(){
    const m=st.music||{};
    const voices=st.resources.channels.filter(c=>[2,13].includes(c.type));
    const queue=(m.queue||[]).map((track,index)=>'<div class="c247-row"><b>'+(index+1)+'. '+esc(track.title)+'</b><small>'+esc(track.author||'')+'</small></div>').join('')||'<p>La cola está vacía.</p>';
    root.innerHTML=head('♫','Centro de música','Reproducción y ajustes de los reproductores del bot')+
      '<section class="music-overview"><div class="music-overview-heading"><div><span class="eyebrow">KUBOQ · AUDIO DEL SERVIDOR</span><h2>Tu música, bajo control</h2></div><button type="button" class="quiet-button" id="music-refresh">↻ Actualizar estado</button></div><div class="music-overview-grid"><article><span class="music-overview-icon">♫</span><div><small>REPRODUCCIÓN</small><strong id="music-overview-state">'+(m.paused?'En pausa':m.playing?'Reproduciendo':'En espera')+'</strong></div></article><article><span class="music-overview-icon">≡</span><div><small>EN LA COLA</small><strong><span id="music-overview-queue">'+(m.queue||[]).length+'</span> canciones</strong></div></article><article><span class="music-overview-icon">◉</span><div><small>REPRODUCTORES LISTOS</small><strong id="music-overview-players">'+Number(m.readyPlayers||0)+' / '+Number(m.players||0)+'</strong></div></article><article><span class="music-overview-icon">⌁</span><div><small>VOZ PERMANENTE</small><strong id="music-overview-voice">'+(m.permanentConnected?'Conectado':m.permanentChannelId?'Reconectando':'Desconectado')+'</strong></div></article></div><div class="music-pool-line"><span class="music-pool-dot"></span><span id="music-pool-status">'+esc(musicPoolMarkup(m))+'</span></div></section><div class="music-layout"><div><div class="track-panel"><div class="track-disc" aria-hidden="true"></div><div class="track-info"><span class="eyebrow" id="music-live-state">'+(m.paused?'En pausa':m.playing?'Reproduciendo ahora':'Sin reproducción')+'</span><h2 id="music-live-track">'+esc(m.current?.title||'Elige una canción')+'</h2><p id="music-live-author">'+esc(m.current?.author||'La música comienza cuando agregas una canción')+'</p><div class="track-controls"><button class="quiet-button" data-music="pause">'+(m.paused?'▶ Reanudar':'⏸ Pausar')+'</button><button class="quiet-button" data-music="skip">⏭ Siguiente</button><button class="quiet-button" data-music="stop">⏹ Detener</button></div></div></div>'+card('Añadir a la cola','<div class="c247-field"><label for="c247-song">Nombre, artista o enlace de YouTube</label><input id="c247-song" placeholder="Busca una canción o pega un enlace"></div><button class="button primary" id="c247-play">Añadir canción ↗</button>')+card('Cola de reproducción','<div id="music-queue">'+queue+'</div><div class="c247-actions"><button class="quiet-button" data-music="shuffle">Mezclar</button><button class="quiet-button" data-music="clear">Vaciar cola</button></div>')+'</div><div class="music-side">'+card('Volumen','<label for="c247-volume" class="c247-muted">Nivel actual · <span id="c247-volume-text">'+(m.volume??100)+'%</span></label><input id="c247-volume" class="c247-volume" type="range" min="0" max="100" value="'+(m.volume??100)+'">')+card('Canal permanente de voz','<div class="c247-row" id="music-voice-status"><b>'+(m.permanentConnected?'🟢 Conectado 24/7':m.permanentChannelId?'🟡 Canal guardado · reconectando':'⚪ Desconectado')+'</b><small>'+(m.permanentChannelId?'Canal: #'+esc(channelName(m.permanentChannelId)):'Elige un canal para mantener a Kuboq en voz.')+'</small></div>'+choice('c247-voice','Canal de voz',voices.map(c=>({value:c.id,label:c.name})),false)+'<div class="c247-actions"><button class="button primary" id="c247-channel-save">Conectar y guardar</button><button class="quiet-button" id="c247-voice-disconnect">Desconectar</button></div>')+card('Preferencias de reproducción',choice('c247-loop','Repetición',[{value:'off',label:'Desactivada'},{value:'track',label:'Canción'},{value:'queue',label:'Cola'}],false)+choice('c247-filter','Filtro',[{value:'none',label:'Normal'},{value:'bassboost',label:'Bassboost'},{value:'nightcore',label:'Nightcore'},{value:'vaporwave',label:'Vaporwave'}],false)+'<label class="c247-muted"><input id="c247-auto" type="checkbox" '+(m.autoplay?'checked':'')+'> Reproducción automática</label><div class="c247-actions"><button id="c247-music-save" class="button primary">Guardar preferencias</button></div>')+'</div></div>';
    q('#c247-voice').value=m.permanentChannelId||'';
    q('#c247-loop').value=m.loop||'off';
    q('#c247-filter').value=m.filter||'none';
    q('.music-side').insertAdjacentHTML('beforeend',card('Vista previa de ajustes','<div class="module-setting-preview" id="music-preview"></div>'));
    const updateMusicPreview=()=>{
      const selectLabel=id=>q(id).selectedOptions[0]?.textContent||'Sin seleccionar';
      const values=[['Volumen',q('#c247-volume').value+'%'],['Canal permanente',selectLabel('#c247-voice')],['Repetición',selectLabel('#c247-loop')],['Filtro',selectLabel('#c247-filter')],['Reproducción automática',q('#c247-auto').checked?'Activada':'Desactivada']];
      q('#music-preview').innerHTML=values.map(([label,value])=>'<div class="module-state-row"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('');
    };
    ['#c247-voice','#c247-loop','#c247-filter','#c247-auto','#c247-volume'].forEach(id=>q(id).addEventListener('input',updateMusicPreview));
    updateMusicPreview();
    const call=async(a,v)=>{try{st.music=(await api('/api/guild/'+encodeURIComponent(gid())+'/music',{method:'POST',body:JSON.stringify({action:a,value:v})})).status;renderMusic();toast('Control actualizado.');}catch(e){toast(e.message,true);}};root.querySelectorAll('[data-music]').forEach(b=>b.onclick=()=>call(b.dataset.music));q('#music-refresh').onclick=()=>refreshMusicLive(gid(),true);q('#c247-play').onclick=()=>call('play',q('#c247-song').value);q('#c247-channel-save').onclick=async()=>{try{const response=await api('/api/guild/'+encodeURIComponent(gid())+'/music',{method:'POST',body:JSON.stringify({action:'channel',channelId:q('#c247-voice').value})});st.music=response.status;renderMusic();toast(response.warning?'Canal guardado; Kuboq está reintentando la conexión.':'Kuboq está conectado al canal permanente.');}catch(e){toast(e.message,true);}};q('#c247-voice-disconnect').onclick=async()=>{const button=q('#c247-voice-disconnect');button.disabled=true;try{st.music=(await api('/api/guild/'+encodeURIComponent(gid())+'/music',{method:'POST',body:JSON.stringify({action:'voice-disconnect'})})).status;renderMusic();toast('Kuboq se desconectó y no volverá a entrar hasta que lo conectes.');}catch(e){toast(e.message,true);button.disabled=false;}};q('#c247-volume').oninput=e=>q('#c247-volume-text').textContent=e.target.value+'%';q('#c247-volume').onchange=e=>call('volume',Number(e.target.value));q('#c247-music-save').onclick=async()=>{try{for(const [action,value] of [['loop',q('#c247-loop').value],['filter',q('#c247-filter').value],['autoplay',q('#c247-auto').checked]])await api('/api/guild/'+encodeURIComponent(gid())+'/music',{method:'POST',body:JSON.stringify({action,value})});await musicFetch();renderMusic();toast('Música configurada.');}catch(e){toast(e.message,true);}};}

  const categoryAlias = { confesiones:'confesion' };
  const modulePaths = {
    bienvenida: ['wb','bye'], ticket:['tk'], verif:['v','vemb'], application:['app'],
    nivel:['xprate','lvlon','lvlmsg','lvlch','tarjeta'], seg:['sec','raidn','raidsec','minage'], mod:['warnlimit'],
    log:['logch','logoff'], invite:['inv','logch'], eco:['cur'], voz:['vcc'], vozbot:['c247'], estado:['vcs'], rolpanel:['rp'],
    stats:['stats'], autorole:['autorolebot'], logro:['achch','achoff'],
    bump:['bump'], ia:['ia'], confesion:['conf'], pinterest:['pin'],
  };
  const textNames = new Set(['texto','descripcion','mensaje','preguntas','bienvenida','pie','lema','subtitulo','recordatorio']);
  const messageCommands = new Set(['nivel.mensaje','voz.embed','rolpanel.crear','rolpanel.editar','anuncio.anunciar','anuncio.embed','anuncio.say','confesion.panel','ticket.panel','verif.panel']);
  const isMessageCommand=command=>command.category==='social'||messageCommands.has(command.category+'.'+command.name);
  const queryNames = /^(ver|vista|estado|lista|list|top|rank|ayuda|help|variables|tipos|puestos|pendientes|info|configuracion|revisar|auditar)$/i;
  const actionNames = /^(manual|quitar|ban|unban|kick|softban|timeout|untimeout|warn|purge|lock|unlock|slowmode|nick|addrole|removerole|hide|unhide|limpiar|enviar|retirar|withdraw|dar|reset|borrar|eliminar|close|claim|transcript|aplicar|ahora|crear|servidor|panel|publicar|probar|activar|desactivar|boton_add|boton_edit|boton_del|itemadd|itemremove|rewardadd|rewardremove|autoquitar|puesto_add|puesto_edit|puesto_del|pregunta_add|add|editar|set)$/i;

  function moduleKind(command){
    if(command.category==='nivel'){
      if(new Set(['rank','vista','top','roles']).has(command.name))return 'consultas';
      if(new Set(['set','xpadd','xpremove','reset']).has(command.name))return 'acciones';
      return 'ajustes';
    }
    if(queryNames.test(command.name))return 'consultas';
    if(command.category==='anuncio')return 'acciones';
    if(actionNames.test(command.name) || !command.permission)return 'acciones';
    return 'ajustes';
  }
  function moduleCommands(category){
    return st.commands.filter(c=>c.category!=='musica'&&c.dashboardAvailable!==false&&(categoryAlias[c.category]||c.category)===category);
  }
  function moduleDiscordCommands(category){
    return st.commands.filter(c=>c.category!=='musica'&&c.dashboardAvailable===false&&(categoryAlias[c.category]||c.category)===category);
  }
  function renderDiscordActions(category){
    const commands=moduleDiscordCommands(category);if(!commands.length)return;
    const selected=st.resources.channels.find(c=>c.id===st.moduleChannels?.[gid()]&&[0,5].includes(c.type))||st.resources.channels.find(c=>[0,5].includes(c.type));
    const rows=commands.map(command=>'<div class="c247-row"><div><b><code>/'+esc(command.category)+(command.root?'':' '+esc(command.name))+'</code></b><small>'+esc(command.description)+' · '+esc(command.dashboardReason||'Requiere una interacción dentro de Discord.')+'</small></div></div>').join('');
    const open=selected?'<a class="quiet-button" href="https://discord.com/channels/'+encodeURIComponent(gid())+'/'+encodeURIComponent(selected.id)+'" target="_blank" rel="noopener noreferrer">Abrir #'+esc(selected.name)+' en Discord ↗</a>':'<p class="c247-muted">No hay un canal de texto visible para abrir en este servidor.</p>';
    root.insertAdjacentHTML('beforeend',card('También en Discord',rows+open,'Estas funciones requieren interacciones de Discord que no se pueden reproducir desde el navegador.'));
  }
  function channelName(id){return st.resources.channels.find(c=>c.id===id)?.name||id;}
  function currentModuleState(category){
    const cfg=st.settings?.config||{};
    const paths=modulePaths[category]||[category];
    const details=[];
    for(const key of paths){
      const value=cfg[key];
      if(value==null || (typeof value==='object'&&!Object.keys(value).length))continue;
      if(key==='stats'){details.push({name:'Canales de estadísticas',count:Object.keys(value.items||{}).length},{name:'Intervalo',value:(value.every||10)+' min'});continue;}
      if(key==='rp'){details.push({name:'Paneles de roles',count:value.panels?.length||0});continue;}
      if(key==='c247'){details.push({name:'Canal 24/7',value:value.ch?'🔊 '+channelName(value.ch):'Sin configurar'});continue;}
      if(key==='vcs'){details.push({name:'Contador de voz',value:value.ch?'🔊 '+channelName(value.ch):'Sin canal'});continue;}
      if(typeof value==='object')details.push({name:key,count:Object.keys(value).length});
      else details.push({name:key,value:typeof value==='boolean'?(value?'Activado':'Desactivado'):String(value)});
    }
    const data=st.settings?.modules||{};
    if(category==='autorole')details.push({name:'Autoroles',count:data.autoroles?.length||0});
    if(category==='nivel')details.push({name:'Roles de nivel',count:Object.keys(data.levelroles||{}).length});
    if(category==='seg')details.push({name:'Palabras filtradas',count:data.badwords?.length||0});
    if(category==='logro')details.push({name:'Logros',count:data.achievements?.length||0});
    if(category==='eco')details.push({name:'Artículos',count:data.store?.length||0});
    if(category==='cumple'&&data.birthdayChannel)details.push({name:'Canal de cumpleaños',value:'#'+channelName(data.birthdayChannel)});
    if(category==='respondedor')details.push({name:'Respuestas automáticas',count:Object.keys(data.automaticReplies||{}).length});
    return details;
  }
  function moduleStateMarkup(category){
    const names={logch:'Canales de registros',logoff:'Registros desactivados',cur:'Moneda',warnlimit:'Límite de advertencias',raidn:'Umbral anti-raid',raidsec:'Intervalo anti-raid',minage:'Edad mínima de cuenta',xprate:'XP por mensaje',lvlon:'Niveles activos',lvlmsg:'Mensaje de nivel',lvlch:'Canal de avisos',achch:'Canal de logros',achoff:'Logros desactivados',vcc:'Canales temporales',ia:'Ajustes de IA',conf:'Confesiones',pin:'Pinterest',sec:'Seguridad',tk:'Tickets'};
    return currentModuleState(category).map(item=>'<div class="module-state-row"><span>'+esc(names[item.name]||item.name)+'</span><strong>'+esc(item.value??item.count)+'</strong></div>').join('')||'<p>Aún no hay ajustes guardados para este módulo.</p>';
  }
  function storedOptionValue(option,event=st.welcomeEvent,commandOverride=null){
    const category=st.category, command=commandOverride||st.moduleCommand?.[category], cfg=st.settings?.config||{};
    if(category==='bienvenida'){
      if(option.name==='evento')return st.welcomeEvent;
      const wb=(event==='despedida'?cfg.bye:cfg.wb)||{};
      if(command==='canal'&&option.name==='canal')return wb.ch;
      if(command==='activar'&&option.name==='estado')return wb.on!==false;
      if(command==='dm'&&option.name==='mensaje')return wb.dm;
      if(option.name==='texto')return ({titulo:'title',mensaje:'desc',texto:'content'})[command]?wb[({titulo:'title',mensaje:'desc',texto:'content'})[command]]:undefined;
      if(command==='embed')return wb[({imagen:'img',miniatura:'thumb',pie:'footer',autor:'author',color:'color'})[option.name]];
    }
    const embedBase=category==='ticket'&&command==='embed'?cfg.tk?.emb:category==='verif'&&command==='embed'?cfg.vemb:null;
    if(embedBase){const key=({titulo:'title',descripcion:'desc',imagen:'img',miniatura:'thumb',pie:'footer',boton:'btn'})[option.name]||option.name;return embedBase[key];}
    if(category==='ticket'&&command==='setup')return cfg.tk?.[({categoria:'cat',rol:'role',logs:'log'})[option.name]];
    if(category==='verif'&&command==='setup')return cfg.v?.[({canal:'ch',rol:'role',modo:'mode'})[option.name]];
    if(category==='verif'&&command==='boton')return cfg.vemb?.[({texto:'btn',estilo:'style',emoji:'emoji'})[option.name]];
    if(category==='application'&&command==='config')return cfg.app?.[({canal_logs:'logch',rol_staff:'staff',espera:'cool',titulo:'title',descripcion:'desc',imagen:'img',web:'web',solo_web:'solo_web'})[option.name]];
    if(category==='nivel'&&command==='mensaje')return cfg[({texto:'lvlmsg',imagen:'lvlimg',titulo:'lvltitle'})[option.name]];
    if(category==='nivel'&&command==='rate'&&option.name==='cantidad')return cfg.xprate;
    if(category==='nivel'&&command==='toggle'&&option.name==='estado')return cfg.lvlon;
    if(category==='cumple'&&command==='canal'&&option.name==='canal')return st.settings?.modules?.birthdayChannel;
    const pathMap={
      seg:{raidconfig:{entradas:['raidn'],segundos:['raidsec']},minage:{dias:['minage']}},
      mod:{warnlimit:{cantidad:['warnlimit']}},
      eco:{moneda:{simbolo:['cur']}},
      voz:{setup:{disparador:['vcc','trig'],categoria:['vcc','cat'],nombre:['vcc','name']},embed:{titulo:['vcc','emb','title'],descripcion:['vcc','emb','desc'],color:['vcc','emb','color'],banner:['vcc','emb','banner'],imagen:['vcc','emb','img'],miniatura:['vcc','emb','thumb'],pie:['vcc','emb','footer']},banner:{nombre:['vcc','brand'],titulo:['vcc','bn','titulo'],lema:['vcc','bn','lema'],subtitulo:['vcc','bn','subtitulo'],fondo:['vcc','bn','fondo']},interfaz:{estado:['vcc','ui']}},
      estado:{setup:{categoria:['vcs','cat'],formato:['vcs','fmt']},canal:{canal:['vcs','ch']},formato:{formato:['vcs','fmt']},contar:{bots:['vcs','bots']}},
      ia:{config:{estado:['ia','on'],cooldown:['ia','cool'],canal:['ia','ch']}},
      bump:{config:{canal:['bump','ch'],rol:['bump','role'],minutos:['bump','every'],premio:['bump','reward'],gemas:['bump','gems'],xp:['bump','xp'],disboard:['bump','dis'],recordatorio:['bump','rt']}},
      confesion:{setup:{canal:['conf','ch'],reportes:['conf','review']},guardar:{estado:['conf','store']}},
      logro:{canal:{canal:['achch']},imagen:{url:['achimg']},toggle:{estado:['achoff']}},
      stats:{ajustes:{intervalo:['stats','every'],abreviar:['stats','abbr'],categoria:['stats','cat']},meta:{objetivo:['stats','goal','target'],tipo:['stats','goal','of']}}
    };
    const getPath=path=>path.reduce((value,key)=>value?.[key],cfg);
    const mappedPath=pathMap[category]?.[command]?.[option.name];
    if(mappedPath){const value=getPath(mappedPath);if(value!==undefined)return category==='logro'&&command==='toggle'&&option.name==='estado'?!value:value;}
    if(category==='seg'&&option.name==='estado'){
      const securityKey={antilink:'link',antiinvite:'invite',antispam:'spam',anticaps:'caps',antimencion:'mention',antibadwords:'badwords',antibots:'bots',antiraid:'raid',antinuke:'nuke'}[command];
      if(securityKey)return cfg.sec?.[securityKey]??false;
    }
    const aliases={canal:['ch'],categoria:['cat'],disparador:['trig'],rol:['role'],titulo:['title'],descripcion:['desc'],imagen:['img'],miniatura:['thumb'],pie:['footer'],mensaje:['msg'],salida:['leave'],estado:['on','ui'],cantidad:['cantidad','limit'],nombre:['name'],texto:['text'],fondo:['background']};
    const optionKeys=[option.name,...(aliases[option.name]||[])];
    for(const key of modulePaths[category]||[]){
      const value=cfg[key];
      if(value==null)continue;
      if(typeof value!=='object'){if(optionKeys.includes(key))return value;continue;}
      for(const candidate of [value,value.emb,value.bn])if(candidate&&typeof candidate==='object')for(const optionKey of optionKeys)if(candidate[optionKey]!==undefined)return candidate[optionKey];
    }
    return undefined;
  }
  function optionControl(option,command=null,prefix='module-option-'){
    const id=prefix+option.name;
    const required=Boolean(option.required||(command?.targetChannelRequired&&option.name==='canal'));
    const friendly={titulo:'Título',descripcion:'Descripción',texto:'Texto',mensaje:'Mensaje',color:'Color hexadecimal',imagen:'URL de la imagen',banner:'URL del banner',miniatura:'URL de la miniatura',pie:'Pie del mensaje',boton:'Texto del botón',menu:'Texto del menú',bienvenida:'Mensaje de bienvenida',canal:'Canal',categoria:'Categoría',rol:'Rol',logs:'Canal de registros',rol_staff:'Rol del equipo',canal_logs:'Canal de registros',espera:'Tiempo de espera',nombre:'Nombre',emoji:'Emoji',fondo:'Imagen de fondo',estado:'Activo',rol1:'Primer rol',rol2:'Segundo rol',disparador:'Canal de voz disparador',respuesta:'Respuesta del bot',palabra:'Palabra o frase que activa la respuesta',cooldown:'Tiempo de espera (segundos)',formato:'Nombre con variables',tipo:'Tipo de estadística',precio:'Precio',cupos:'Cupos'};
    const label=esc(friendly[option.name]||option.name.replaceAll('_',' '))+(required?' <small>· requerido</small>':'');
    const stored=storedOptionValue(option,st.welcomeEvent,command?.name||null);
    const choices=option.choices?.length?option.choices.map(v=>Array.isArray(v)?{label:v[0],value:v[1]}:{label:v.name,value:v.value}):null;
    if(choices)return '<div class="c247-field"><label for="'+id+'">'+label+'</label><select id="'+id+'" '+(required?'required':'')+'><option value="">Selecciona…</option>'+choices.map(item=>'<option value="'+esc(item.value)+'" '+(String(item.value)===String(stored)?'selected':'')+'>'+esc(item.label)+'</option>').join('')+'</select></div>';
    if(option.name==='color'){
      const color=previewConfig(st.category,st.commands.find(c=>c.name===st.moduleCommand?.[st.category]&&c.category===st.category)||{},{});
      return '<div class="c247-field"><label for="'+id+'">'+label+'</label><input type="color" id="'+id+'" value="'+esc(validColor(stored??color.color))+'"></div>';
    }
    if(option.type==='boolean')return '<label class="module-switch"><span>'+label+'</span><input type="checkbox" id="'+id+'" '+(stored===true?'checked':'')+'></label>';
    if(option.type==='channel'){
      const onlyCategory=option.name==='categoria',onlyVoice=option.name==='disparador'||(option.name==='canal'&&['vozbot','estado'].includes(st.category))||(option.name==='canal'&&st.category==='stats');
      const channels=st.resources.channels.filter(c=>onlyCategory?c.type===4:onlyVoice?[2,13].includes(c.type):[0,5].includes(c.type));
      return '<div class="c247-field"><label for="'+id+'">'+label+'</label><select id="'+id+'" '+(required?'required':'')+'><option value="">Selecciona '+(onlyCategory?'una categoría':onlyVoice?'un canal de voz':'un canal de texto')+'…</option>'+channels.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===stored?'selected':'')+'>'+esc((onlyCategory?'📁 ':onlyVoice?'🔊 ':'# ')+c.name)+'</option>').join('')+'</select></div>';
    }
    if(option.type==='role')return '<div class="c247-field"><label for="'+id+'">'+label+'</label><select id="'+id+'" '+(required?'required':'')+'><option value="">Selecciona…</option>'+st.resources.roles.map(r=>'<option value="'+esc(r.id)+'" '+(r.id===stored?'selected':'')+'>'+esc(r.name)+'</option>').join('')+'</select></div>';
    if(option.type==='user')return '<div class="c247-field"><label for="'+id+'">'+label+'</label><input id="'+id+'" list="members-'+id+'" '+(required?'required':'')+' placeholder="Elige un miembro o escribe su ID"><datalist id="members-'+id+'">'+st.resources.members.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join('')+'</datalist></div>';
    if(textNames.has(option.name))return '<div class="c247-field"><label for="'+id+'">'+label+'</label><textarea id="'+id+'" '+(required?'required':'')+' placeholder="Escribe '+esc(option.name)+'...">'+esc(stored??'')+'</textarea></div>';
    return '<div class="c247-field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(option.type==='integer'?'number':'text')+'" value="'+esc(stored??'')+'" '+(option.type==='integer'?'step="1" ':'')+(required?'required ':'')+'placeholder="Escribe '+esc(option.name)+'..."></div>';
  }
  const outputFormats=[['embed','Embed'],['components_v2','Components V2'],['card','Card (imagen PNG)'],['text','Texto normal']];
  function formatSelector(id,current){return '<div class="c247-field format-field"><label for="'+id+'">Formato del mensaje</label><select id="'+id+'">'+outputFormats.map(([key,label])=>'<option value="'+key+'" '+(key===current?'selected':'')+'>'+label+'</option>').join('')+'</select><small>Se guardará para los próximos mensajes del bot.</small></div>';}
  function formattedPreview(data){
    const format=data.format||'embed';
    const photo=url=>/^https?:\/\/[^\s"'<>]+$/i.test(url||'')?'<img class="studio-image" src="'+esc(url)+'" alt="Imagen configurada">':'';
    const content=data.content?'<div class="studio-content">'+previewText(data.content)+'</div>':'';
    const button=data.menu?'<div class="module-select-preview">'+previewText(data.menu)+' ▾</div>':data.button?'<span class="module-button-preview">'+previewText(data.button)+'</span>':'';
    const heading=data.title?previewText(data.title):'',body=previewText(data.description||'');
    let message='';
    if(format==='components_v2')message='<div class="format-v2" style="--preview-color:'+esc(validColor(data.color))+'">'+content+photo(data.banner)+(data.author?'<small>'+previewText(data.author)+'</small>':'')+'<strong>'+heading+'</strong><p>'+body+'</p>'+photo(data.image)+(data.footer?'<small>'+previewText(data.footer)+'</small>':'')+button+'</div>';
    else if(format==='card')message=content+'<div class="format-card" style="--preview-color:'+esc(validColor(data.color))+'"><small>KUBOQ · SERVIDOR</small><strong>'+heading+'</strong><p>'+body+'</p><span>'+previewText(data.footer||'KUBOQ')+'</span></div>'+button+(data.image||data.banner||data.thumbnail?'<small class="format-note">La card PNG utiliza título, descripción, color y pie. Las imágenes externas se muestran en los otros formatos.</small>':'');
    else if(format==='text')message='<div class="format-text">'+content+(data.title?'<b>'+heading+'</b>':'')+'<p>'+body+'</p>'+[data.banner,data.image,data.thumbnail].filter(Boolean).map(url=>'<small>'+esc(url)+'</small>').join('')+(data.footer?'<small>— '+previewText(data.footer)+'</small>':'')+'</div>'+button;
    else message=content+photo(data.banner)+'<div class="studio-embed" style="--preview-color:'+esc(validColor(data.color))+'">'+(data.author?'<span class="studio-author">'+previewText(data.author)+'</span>':'')+(data.thumbnail?'<div class="studio-thumbnail">'+photo(data.thumbnail)+'</div>':'')+(data.title?'<strong>'+heading+'</strong>':'')+'<p>'+body+'</p>'+photo(data.image)+(data.footer?'<small>'+previewText(data.footer)+'</small>':'')+'</div>'+button;
    return '<div class="studio-discord"><div class="studio-discord-header"><span class="module-avatar"><img src="/assets/brand/kuboq-logo.png" alt=""></span><strong>'+esc(brandName(st.settings?.identity?.name))+'</strong><small>APP</small><em>ahora</em></div>'+message+'</div>';
  }
  const welcomeDefaults={
    bienvenida:{title:'👋 ¡Bienvenido/a!',desc:'¡Hola {user}! 🎉 Te damos la bienvenida a **{server}**.\nAhora somos **{members}** miembros.\n🕒 Cuenta creada {created}',content:'{user}',author:'LLEGASTE A {server}',footer:'Miembro n.º {members}'},
    despedida:{title:'🚪 Hasta pronto',desc:'**{tag}** salió de **{server}**.\nAhora somos **{members}** miembros.',content:'',author:'SE FUE DE {server}',footer:''}
  };
  function welcomePage(){
    const event=st.welcomeEvent, isWelcome=event==='bienvenida', key=isWelcome?'wb':'bye';
    const cfg=st.settings?.config||{},saved=cfg[key]||{},defaults=welcomeDefaults[event];
    const title=isWelcome?'Bienvenidas':'Salidas';
    const input=(name,label,value,placeholder='')=>'<div class="c247-field"><label for="welcome-'+name+'">'+label+'</label><input id="welcome-'+name+'" value="'+esc(value??'')+'" placeholder="'+esc(placeholder)+'"></div>';
    const area=(name,label,value)=>'<div class="c247-field"><label for="welcome-'+name+'">'+label+'</label><textarea id="welcome-'+name+'" rows="'+(name==='desc'?8:3)+'">'+esc(value??'')+'</textarea></div>';
    const channels=st.resources.channels.filter(c=>[0,5].includes(c.type)).map(c=>'<option value="'+esc(c.id)+'" '+(saved.ch===c.id?'selected':'')+'># '+esc(c.name)+'</option>').join('');
    const fields='<div class="studio-lead"><div><span class="eyebrow">COMUNIDAD</span><h2>'+title+'</h2></div><span class="status-badge">'+(saved.on===false?'Desactivado':Object.keys(saved).length?'Configurado':'Automático')+'</span></div>'+ 
      '<p class="studio-copy">Los cambios se guardan en la configuración del servidor y se aplican a las próximas entradas o salidas.</p>'+
      '<form id="welcome-form">'+formatSelector('welcome-format',cfg.messageFormats?.[event]||'embed')+'<div class="studio-row"><div class="c247-field"><label for="welcome-ch">Canal de '+(isWelcome?'bienvenida':'salida')+'</label><select id="welcome-ch"><option value="">Automático según los canales del servidor</option>'+channels+'</select></div><label class="studio-toggle"><strong>Mensaje activo</strong><small>Publicar cuando '+(isWelcome?'entra':'sale')+' un miembro</small><input id="welcome-on" type="checkbox" '+(saved.on===false?'':'checked')+'></label></div>'+ 
      '<div class="studio-section">Mensaje '+(isWelcome?'de bienvenida':'de despedida')+' en el servidor</div>'+
      '<div class="studio-fields">'+input('title','Título',saved.title??defaults.title,'Título del mensaje')+area('desc','Descripción',saved.desc??defaults.desc)+
      '<div class="studio-variables"><span>Insertar variable en la descripción</span><button type="button" data-variable="{user}">{user}</button><button type="button" data-variable="{server}">{server}</button><button type="button" data-variable="{members}">{members}</button></div>'+
      input('color','Color hexadecimal',validColor(saved.color??cfg.color??'#ff3159'),'#FF3159')+input('img','URL de la imagen',saved.img??'','https://… o avatar / servidor / ninguna')+
      input('thumb','URL de la miniatura',saved.thumb??'','https://… o avatar / servidor / ninguna')+input('author','Autor',saved.author??defaults.author)+input('footer','Pie del mensaje',saved.footer??defaults.footer)+
      area('content','Texto adicional',saved.content??defaults.content)+'</div>'+
      (isWelcome?'<div class="studio-section">Mensaje privado</div>'+area('dm','DM de bienvenida',saved.dm??''):'')+
      '<div class="studio-actions"><button class="button primary" type="submit">Guardar '+title.toLowerCase()+'</button><button class="quiet-button" type="button" id="welcomeAdvanced">Herramientas y comandos ↗</button></div><div id="studio-result" aria-live="polite"></div></form>';
    root.innerHTML='<section class="studio-shell"><div class="studio-edit">'+fields+'</div><aside class="studio-side"><div class="studio-preview-heading"><span class="eyebrow">VISTA PREVIA</span><small>Contenido configurado para Discord</small></div><div id="welcome-preview"></div><p class="preview-footnote">Muestra cómo se verá el próximo mensaje. Las variables usan datos de ejemplo.</p></aside></section>';
    const form=q('#welcome-form');
    const value=name=>q('#welcome-'+name).value;
    const imageUrl=spec=>{
      const v=String(spec||'').split('|')[0].trim();
      if(v==='servidor')return st.guild?.icon||'';
      if(v==='avatar')return st.user?.avatar||'';
      return /^https?:\/\/[^\s"'<>]+$/i.test(v)?v:'';
    };
    const refresh=()=>{
      q('.status-badge').textContent=q('#welcome-on').checked?'Activo':'Desactivado';
      const loc=value('ch')?'#'+channelName(value('ch')):'Canal automático';
      const format=value('format');
      const dm=isWelcome&&value('dm')?'<div class="studio-dm"><strong>Mensaje privado · '+esc(outputFormats.find(([key])=>key===format)?.[1]||'Embed')+'</strong>'+formattedPreview({format,title:'👋 '+(st.guild?.name||'Servidor'),description:value('dm'),image:imageUrl(value('img')||'servidor'),color:value('color')})+'</div>':'';
      q('#welcome-preview').innerHTML=formattedPreview({format,content:value('content'),title:value('title'),description:value('desc'),image:imageUrl(value('img')||'servidor'),thumbnail:imageUrl(value('thumb')||'avatar'),footer:value('footer'),author:value('author'),color:value('color')})+dm+
        '<div class="studio-destination"><span>Destino</span><strong>'+esc(loc)+'</strong><span>Estado</span><strong>'+(q('#welcome-on').checked?'Activo':'Desactivado')+'</strong></div>';
    };
    form.addEventListener('input',refresh);form.addEventListener('change',refresh);refresh();
    form.querySelectorAll('[data-variable]').forEach(button=>button.onclick=()=>{const field=q('#welcome-desc');const start=field.selectionStart,end=field.selectionEnd;field.setRangeText(button.dataset.variable,start,end,'end');field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();});
    q('#welcomeAdvanced').onclick=()=>{st.welcomeAdvanced=true;render('module');};
    form.onsubmit=async e=>{
      e.preventDefault();
      const names=['title','desc','color','img','thumb','author','footer','content'];
      const payload=Object.fromEntries(names.map(name=>[name,value(name)]));
      payload.ch=value('ch')||null;payload.on=q('#welcome-on').checked;payload.format=value('format');
      if(isWelcome)payload.dm=value('dm');
      if(!/^#[0-9a-f]{6}$/i.test(payload.color))return toast('Usa un color hexadecimal #RRGGBB.',true);
      const button=form.querySelector('button[type=submit]');button.disabled=true;
      try{
        await api('/api/guild/'+encodeURIComponent(gid())+'/welcome/'+event,{method:'PUT',body:JSON.stringify(payload)});
        st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings');
        q('#studio-result').innerHTML='<div class="c247-result">'+title+' guardadas en el servidor.</div>';
        toast('Configuración guardada.');
      }catch(error){q('#studio-result').innerHTML='<div class="c247-result">'+esc(error.message)+'</div>';toast(error.message,true);}
      finally{button.disabled=false;}
    };
  }
  function autorolePage(){
    const roles=[...(st.settings?.modules?.autoroles||[])];
    const cfg=st.settings?.config||{};
    const roleName=id=>st.resources.roles.find(r=>r.id===id)?.name||id;
    const options=st.resources.roles.filter(r=>r.id!==gid()).map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+'</option>').join('');
    root.innerHTML=head('♧','Autoroles','Define qué roles recibe cada miembro al entrar al servidor.')+'<section class="autorole-welcome"><div><span class="eyebrow">COMUNIDAD · INCORPORACIÓN</span><h2>Una bienvenida con los roles correctos</h2><p>Los cambios se aplican a los nuevos miembros después de guardar.</p></div><div class="autorole-welcome-stat"><strong id="autorole-count">'+roles.length+'</strong><span>roles automáticos</span></div></section><section class="studio-shell autorole-shell"><div class="studio-edit"><div class="studio-lead"><div><span class="eyebrow">ASIGNACIÓN AUTOMÁTICA</span><h2>Roles de entrada</h2></div><span class="status-badge" id="autorole-badge">'+roles.length+' roles</span></div><p class="studio-copy">Kuboq revisa su posición en la jerarquía y los permisos antes de entregar cada rol.</p>'+ 
      '<div class="autorole-summary"><span><i>✓</i> Para miembros nuevos</span><span><i>⌁</i> Se aplica al guardar</span><span><i>⌘</i> Requiere gestionar roles</span></div><div class="studio-section">Roles para nuevos miembros</div><div id="autorole-list" class="autorole-list"></div>'+ 
      '<div class="c247-field"><label for="autorole-add">Añadir rol</label><div class="autorole-add-row"><select id="autorole-add"><option value="">Selecciona un rol</option>'+options+'</select><button type="button" class="quiet-button" id="autorole-push">Añadir</button></div></div>'+ 
      '<div class="studio-section">Rol para bots</div><div class="c247-field"><label for="autorole-bot">Asignación opcional a bots nuevos</label><select id="autorole-bot"><option value="">Ninguno</option>'+options+'</select></div>'+ 
      '<div class="studio-actions"><button class="button primary" id="autorole-save">Guardar autoroles</button><button class="quiet-button" id="autorole-tools">Diagnóstico y acciones ↗</button></div><div id="autorole-result" aria-live="polite"></div></div>'+ 
      '<aside class="studio-side autorole-side"><div class="studio-preview-heading"><span class="eyebrow">VISTA PREVIA</span><small>Al entrar un miembro nuevo</small></div><div id="autorole-preview" class="module-discord"></div><div class="autorole-guidance"><span>✦</span><div><strong>Control de jerarquía</strong><p>Kuboq solo puede asignar roles que estén por debajo de su propio rol.</p></div></div><div class="module-current"><h3>Configuración guardada</h3><p>'+roles.length+' roles para miembros · '+(cfg.botrole?'rol para bots configurado':'sin rol para bots')+'</p></div></aside></section>';
    q('#autorole-bot').value=cfg.botrole||'';
    const update=()=>{
      q('#autorole-list').innerHTML=roles.length?roles.map(id=>{const role=st.resources.roles.find(r=>r.id===id),color=validColor(role?.color||'#ff6685');return '<div class="autorole-item"><span class="autorole-role-dot" style="--role-color:'+esc(color)+'"></span><span class="autorole-role-name"><strong>'+esc(roleName(id))+'</strong><small>'+esc(role?'Posición '+role.position:'Rol no disponible en la caché')+'</small></span><button type="button" data-remove-role="'+esc(id)+'" aria-label="Quitar '+esc(roleName(id))+'">×</button></div>';}).join(''):'<div class="autorole-empty"><span>✦</span><strong>Empieza con los roles de bienvenida</strong><small>Elige los roles que deben recibir los miembros nuevos y guárdalos para activarlos.</small></div>';
      q('#autorole-preview').innerHTML='<div class="module-discord-header"><span class="module-avatar">'+esc((st.user?.username||'U').slice(0,1).toUpperCase())+'</span><strong>Nuevo miembro</strong><small>ENTRADA</small></div><p>Al ingresar a <b>'+esc(st.guild?.name||'el servidor')+'</b>, recibirá:</p>'+ 
        (roles.length?'<div class="autorole-chips">'+roles.map(id=>'<span>'+esc(roleName(id))+'</span>').join('')+'</div>':'<small>Sin roles automáticos para miembros.</small>')+
        '<div class="module-preview-values"><div class="module-state-row"><span>Rol para bots</span><strong>'+esc(roleName(q('#autorole-bot').value)||'Ninguno')+'</strong></div></div>';
      q('#autorole-badge').textContent=roles.length+' roles';q('#autorole-count').textContent=roles.length;
      root.querySelectorAll('[data-remove-role]').forEach(button=>button.onclick=()=>{roles.splice(roles.indexOf(button.dataset.removeRole),1);update();});
    };
    q('#autorole-push').onclick=()=>{const id=q('#autorole-add').value;if(!id)return toast('Selecciona un rol.',true);if(!roles.includes(id))roles.push(id);q('#autorole-add').value='';syncSelectDisplay(q('#autorole-add'));update();};
    q('#autorole-bot').onchange=update;
    q('#autorole-tools').onclick=()=>{st.autoroleAdvanced=true;render('module');};
    q('#autorole-save').onclick=async()=>{
      const button=q('#autorole-save');button.disabled=true;
      try{
        await api('/api/guild/'+encodeURIComponent(gid())+'/autoroles',{method:'PUT',body:JSON.stringify({roles,botRole:q('#autorole-bot').value||null})});
        st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings');
        q('#autorole-result').innerHTML='<div class="c247-result">Autoroles guardados para este servidor.</div>';
        toast('Autoroles actualizados.');
      }catch(error){q('#autorole-result').innerHTML='<div class="c247-result">'+esc(error.message)+'</div>';toast(error.message,true);}
      finally{button.disabled=false;}
    };
    update();
  }
  function panelPage(system){
    const ticket=system==='ticket',title=ticket?'Tickets':'Verificación';
    const cfg=st.settings?.config||{},setup=ticket?cfg.tk||{}:cfg.v||{},saved=ticket?setup.emb||{}:cfg.vemb||{};
    const channels=st.resources.channels.filter(c=>[0,5].includes(c.type));
    const categories=st.resources.channels.filter(c=>c.type===4);
    const field=(key,label,value,kind='text')=>'<div class="c247-field"><label for="panel-'+key+'">'+label+'</label>'+(kind==='area'?'<textarea id="panel-'+key+'" rows="5">'+esc(value??'')+'</textarea>':'<input id="panel-'+key+'" '+(kind==='number'?'type="number" min="1" max="50"':'type="text"')+' value="'+esc(value??'')+'">')+'</div>';
    const pick=(key,label,items,current,blank)=>'<div class="c247-field"><label for="panel-'+key+'">'+label+'</label><select id="panel-'+key+'"><option value="">'+blank+'</option>'+items.map(item=>'<option value="'+esc(item.id)+'" '+(item.id===current?'selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select></div>';
    const setupFields=ticket?pick('cat','Categoría por defecto',categories,setup.cat,'Sin categoría')+pick('role','Rol de soporte',st.resources.roles,setup.role,'Solo administradores')+pick('log','Canal de registros',channels,setup.log,'Sin canal de registros')+field('max','Máximo de tickets por usuario',setup.max??1,'number'):
      pick('ch','Canal de verificación',channels,setup.ch,'Selecciona un canal')+pick('role','Rol verificado',st.resources.roles,setup.role,'Selecciona un rol')+
      '<div class="c247-field"><label for="panel-mode">Modo</label><select id="panel-mode">'+['boton','codigo','captcha'].map(mode=>'<option value="'+mode+'" '+((setup.mode||'boton')===mode?'selected':'')+'>'+mode+'</option>').join('')+'</select></div>';
    const design=field('title','Título',saved.title??(ticket?'Centro de ayuda':'Verifica tu cuenta'))+field('desc','Descripción',saved.desc??(ticket?'Abre un ticket para hablar con el equipo.':'Pulsa el botón para obtener acceso.'),'area')+
      field('color','Color hexadecimal',validColor(saved.color??cfg.color))+
      field('banner','URL del banner',saved.banner??'')+field('img','URL de la imagen',saved.img??'')+field('thumb','URL de la miniatura',saved.thumb??'')+
      field('footer','Pie del mensaje',saved.footer??'')+field('btn','Texto del botón',saved.btn??(ticket?'Abrir ticket':'Verificarme'))+
      (ticket?field('menu','Texto del menú',saved.menu??'')+field('welcome','Mensaje al abrir el ticket',saved.welcome??'','area'):'');
    root.innerHTML='<section class="studio-shell"><div class="studio-edit"><div class="studio-lead"><div><span class="eyebrow">'+(ticket?'SOPORTE':'SEGURIDAD')+'</span><h2>'+title+'</h2></div><span class="status-badge">'+(ticket?Object.keys(setup.types||{}).length+' tipos':setup.ch&&setup.role?'Configurado':'Pendiente')+'</span></div>'+ 
      '<p class="studio-copy">Configura el sistema y revisa cómo se verá el panel antes de publicarlo en Discord.</p><form id="panel-form">'+formatSelector('panel-format',cfg.messageFormats?.[system]||'embed')+'<div class="studio-section">Canales y permisos</div><div class="studio-fields">'+setupFields+'</div><div class="studio-section">Diseño del panel</div><div class="studio-fields">'+design+'</div>'+ 
      '<div class="studio-actions"><button class="button primary" type="submit">Guardar '+title.toLowerCase()+'</button><button class="quiet-button" type="button" id="panel-publish">Publicar panel ↗</button><button class="quiet-button" type="button" id="panel-tools">Tipos y otras acciones</button></div><p class="panel-note">Los paneles que ya están publicados se actualizan al publicarlos de nuevo.</p><div id="panel-result" aria-live="polite"></div></form></div>'+ 
      '<aside class="studio-side"><div class="studio-preview-heading"><span class="eyebrow">VISTA PREVIA</span><small>Panel que publicará el bot</small></div><div id="panel-preview"></div><div class="module-current"><h3>Configuración guardada</h3><div class="module-state-row"><span>'+ (ticket?'Tipos de tickets':'Modo de verificación')+'</span><strong>'+esc(ticket?Object.keys(setup.types||{}).length:(setup.mode||'boton'))+'</strong></div></div></aside></section>';
    const value=key=>q('#panel-'+key).value;
    const preview=()=>{
      const typeCount=ticket?Object.keys(setup.types||{}).length:0;
      q('#panel-preview').innerHTML=formattedPreview({format:value('format'),title:value('title'),description:value('desc'),color:value('color'),banner:value('banner'),image:value('img'),thumbnail:value('thumb'),footer:value('footer'),button:ticket&&typeCount?'':value('btn'),menu:ticket&&typeCount?value('menu')||'Selecciona un tipo':''})+
        '<div class="studio-destination"><span>Canal</span><strong>'+esc(ticket?'Se elige al publicar':value('ch')?'#'+channelName(value('ch')):'Sin seleccionar')+'</strong><span>Rol</span><strong>'+esc(st.resources.roles.find(r=>r.id===value('role'))?.name||'Sin seleccionar')+'</strong></div>'+
        (ticket&&value('welcome')?'<div class="studio-dm"><strong>Mensaje al abrir el ticket</strong><p>'+previewText(value('welcome'))+'</p></div>':'');
    };
    q('#panel-form').addEventListener('input',preview);q('#panel-form').addEventListener('change',preview);preview();
    const openTools=command=>{st.panelAdvanced=true;st.moduleCommand[system]=command;st.moduleTab=moduleKind({category:system,name:command,permission:'ManageGuild'});render('module');};
    q('#panel-publish').onclick=()=>openTools('panel');q('#panel-tools').onclick=()=>openTools(ticket?'tipo':'boton');
    q('#panel-form').onsubmit=async event=>{
      event.preventDefault();
      const names=['title','desc','color','banner','img','thumb','footer','btn',...(ticket?['menu','welcome']:[])];
      const embed=Object.fromEntries(names.map(key=>[key,value(key)]));
      const data=ticket?{cat:value('cat')||null,role:value('role')||null,log:value('log')||null,max:Number(value('max'))}:{ch:value('ch')||null,role:value('role')||null,mode:value('mode')};
      const button=q('#panel-form button[type=submit]');button.disabled=true;
      try{
        await api('/api/guild/'+encodeURIComponent(gid())+'/panel/'+system,{method:'PUT',body:JSON.stringify({embed,setup:data,format:value('format')})});
        st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings');
        q('#panel-result').innerHTML='<div class="c247-result">'+title+' guardados. Publica el panel para aplicar el nuevo diseño en Discord.</div>';toast('Panel guardado.');
      }catch(error){q('#panel-result').innerHTML='<div class="c247-result">'+esc(error.message)+'</div>';toast(error.message,true);}
      finally{button.disabled=false;}
    };
  }
  function applicationPage(){
    const cfg=st.settings?.config||{},app=cfg.app||{};
    const control=(id,label,value,area=false)=>'<div class="c247-field"><label for="app-'+id+'">'+label+'</label>'+(area?'<textarea id="app-'+id+'" rows="7">'+esc(value??'')+'</textarea>':'<input id="app-'+id+'" value="'+esc(value??'')+'">')+'</div>';
    root.innerHTML='<section class="studio-shell"><div class="studio-edit"><div class="studio-lead"><div><span class="eyebrow">COMUNIDAD</span><h2>Postulaciones</h2></div><span class="status-badge">'+(app.pos?.length||0)+' puestos</span></div><p class="studio-copy">Diseña el panel público de postulaciones. Los puestos, preguntas y revisiones conservan los comandos reales del bot.</p><form id="app-form">'+formatSelector('app-format',cfg.messageFormats?.application||'components_v2')+
      '<div class="studio-section">Mensaje del panel</div><div class="studio-fields">'+control('title','Título',app.title??'📋 Postulaciones')+control('desc','Descripción',app.desc??'Para postularte, llena el formulario y responde a las preguntas con honestidad.',true)+control('img','URL de la imagen',app.img??'')+control('web','URL de la página de postulaciones',app.web??'')+'</div><label class="studio-toggle"><strong>Solo mostrar el botón web</strong><small>Si hay un enlace configurado, oculta el formulario de Discord.</small><input id="app-solo_web" type="checkbox" '+(app.solo_web===false?'':'checked')+'></label><div class="studio-actions"><button type="submit" class="button primary">Guardar diseño</button><button type="button" class="quiet-button" id="app-publish">Publicar panel ↗</button><button type="button" class="quiet-button" id="app-tools">Puestos y preguntas ↗</button></div><p class="panel-note">Publica de nuevo el panel para aplicar el formato elegido al mensaje existente.</p><div id="app-result" aria-live="polite"></div></form></div><aside class="studio-side"><div class="studio-preview-heading"><span class="eyebrow">VISTA PREVIA</span><small>Panel público que enviará el bot</small></div><div id="app-preview"></div><div class="module-current"><h3>Estado del sistema</h3><p>'+esc((app.pos?.length||0)+' puestos · '+(app.q?.length||5)+' preguntas · '+(app.logch?'canal de revisión configurado':'configura el canal de revisión'))+'</p></div></aside></section>';
    const get=id=>q('#app-'+id).value;
    const preview=()=>{const hasWeb=/^https?:\/\//i.test(get('web'));q('#app-preview').innerHTML=formattedPreview({format:get('format'),title:get('title'),description:get('desc')+'\n\n📄 ¿Retirar solicitud? Usa /application withdraw.\nℹ️ ¿Verificar estado? Usa /application status.',image:get('img'),button:hasWeb&&q('#app-solo_web').checked?'Postúlate en la web':'Postularme',footer:(app.pos?.length||0)+' puestos · '+(st.guild?.name||'Servidor')})+(hasWeb&&!q('#app-solo_web').checked?'<p class="preview-footnote">El panel incluirá también el enlace para postularte en la web.</p>':'');};
    q('#app-form').addEventListener('input',preview);q('#app-form').addEventListener('change',preview);preview();
    const advanced=command=>{st.applicationAdvanced=true;st.moduleCommand.application=command;st.moduleTab=moduleKind({category:'application',name:command,permission:'ManageGuild'});render('module');};
    q('#app-publish').onclick=()=>advanced('panel');q('#app-tools').onclick=()=>advanced('puesto_add');
    q('#app-form').onsubmit=async event=>{event.preventDefault();const body={format:get('format'),title:get('title'),desc:get('desc'),img:get('img'),web:get('web'),solo_web:q('#app-solo_web').checked};const button=q('#app-form button[type=submit]');button.disabled=true;try{await api('/api/guild/'+encodeURIComponent(gid())+'/application',{method:'PUT',body:JSON.stringify(body)});st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings');q('#app-result').innerHTML='<div class="c247-result">Diseño guardado. Publica de nuevo el panel para aplicar el formato.</div>';toast('Postulaciones guardadas.');}catch(error){q('#app-result').innerHTML='<div class="c247-result">'+esc(error.message)+'</div>';toast(error.message,true);}finally{button.disabled=false;}};
  }
  function birthdayPage(){
    const cfg=st.settings?.config||{},saved=st.settings?.modules?.birthdayChannel||'',channels=st.resources.channels.filter(c=>[0,5].includes(c.type));
    root.innerHTML='<section class="studio-shell"><div class="studio-edit"><div class="studio-lead"><div><span class="eyebrow">COMUNIDAD</span><h2>Cumpleaños</h2></div><span class="status-badge">'+(saved?'Canal activo':'Sin canal')+'</span></div><p class="studio-copy">El bot felicita a los miembros que guardaron su fecha. Diseña aquí el mensaje que enviará al canal.</p><form id="birthday-form">'+formatSelector('birthday-format',cfg.messageFormats?.cumple||'text')+
      '<div class="studio-section">Publicación</div><div class="c247-field"><label for="birthday-channel">Canal de felicitaciones</label><select id="birthday-channel"><option value="">Sin canal de cumpleaños</option>'+channels.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===saved?'selected':'')+'># '+esc(c.name)+'</option>').join('')+'</select></div><div class="c247-field"><label for="birthday-message">Mensaje de cumpleaños</label><textarea id="birthday-message" rows="5" maxlength="1500">'+esc(cfg.birthdayMessage||'¡Feliz cumpleaños {users}! 🎉')+'</textarea><small>Variables: {users} y {server}.</small></div><div class="studio-actions"><button type="submit" class="button primary">Guardar cumpleaños</button><button type="button" id="birthday-tools" class="quiet-button">Fechas y consultas ↗</button></div><div id="birthday-result" aria-live="polite"></div></form></div><aside class="studio-side"><div class="studio-preview-heading"><span class="eyebrow">VISTA PREVIA</span><small>Felicitación de ejemplo</small></div><div id="birthday-preview"></div></aside></section>';
    const preview=()=>{const format=q('#birthday-format').value,body=q('#birthday-message').value.replaceAll('{users}','Bryant, Luna').replaceAll('{server}',st.guild?.name||'Servidor');q('#birthday-preview').innerHTML=formattedPreview(format==='text'?{format,content:'🎂 '+body}:{format,content:'@Bryant @Luna',title:'🎂 Cumpleaños',description:body,color:cfg.color})+'<div class="studio-destination"><span>Canal</span><strong>'+esc(q('#birthday-channel').value?'#'+channelName(q('#birthday-channel').value):'Sin configurar')+'</strong></div>';};
    q('#birthday-form').addEventListener('input',preview);q('#birthday-form').addEventListener('change',preview);preview();
    q('#birthday-tools').onclick=()=>{st.birthdayAdvanced=true;st.moduleTab='acciones';render('module');};
    q('#birthday-form').onsubmit=async e=>{e.preventDefault();const button=q('#birthday-form button[type=submit]');button.disabled=true;try{await api('/api/guild/'+encodeURIComponent(gid())+'/birthday',{method:'PUT',body:JSON.stringify({format:q('#birthday-format').value,message:q('#birthday-message').value,channelId:q('#birthday-channel').value||null})});st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings');q('#birthday-result').innerHTML='<div class="c247-result">Configuración guardada para los próximos cumpleaños.</div>';toast('Cumpleaños guardados.');}catch(error){q('#birthday-result').innerHTML='<div class="c247-result">'+esc(error.message)+'</div>';toast(error.message,true);}finally{button.disabled=false;}};
  }
  function automaticRepliesPage(){
    const cfg=st.settings?.config||{},entries=Object.entries(st.settings?.modules?.automaticReplies||{}).map(([key,value])=>({key,value}));let selected=0;
    root.innerHTML='<section class="studio-shell"><div class="studio-edit"><div class="studio-lead"><div><span class="eyebrow">COMUNIDAD</span><h2>Respuestas automáticas</h2></div><span class="status-badge" id="reply-count">'+entries.length+' respuestas</span></div><p class="studio-copy">Cuando un mensaje contiene una palabra configurada, el bot responde con el formato elegido.</p><form id="reply-form">'+formatSelector('reply-format',cfg.messageFormats?.respondedor||'text')+'<div class="studio-section">Disparadores y mensajes</div><div id="reply-list" class="reply-list"></div><div class="studio-actions"><button type="button" id="reply-add" class="quiet-button">+ Nueva respuesta</button><button type="submit" class="button primary">Guardar respuestas</button></div><div id="reply-result" aria-live="polite"></div></form></div><aside class="studio-side"><div class="studio-preview-heading"><span class="eyebrow">VISTA PREVIA</span><small>Respuesta al mensaje de ejemplo</small></div><div id="reply-preview"></div></aside></section>';
    const update=()=>{
      q('#reply-count').textContent=entries.length+' respuestas';
      q('#reply-list').innerHTML=entries.map((entry,index)=>'<div class="reply-entry '+(index===selected?'selected':'')+'" data-reply="'+index+'"><div class="c247-field"><label for="reply-key-'+index+'">Palabra o frase</label><input id="reply-key-'+index+'" data-field="key" data-index="'+index+'" maxlength="80" value="'+esc(entry.key)+'" placeholder="Ej.: hola"></div><div class="c247-field"><label for="reply-value-'+index+'">Respuesta</label><textarea id="reply-value-'+index+'" data-field="value" data-index="'+index+'" maxlength="1500" rows="3" placeholder="Mensaje del bot">'+esc(entry.value)+'</textarea></div><button type="button" class="quiet-button reply-remove" data-remove="'+index+'" aria-label="Eliminar respuesta">Eliminar</button></div>').join('')||'<p class="reply-empty">Aún no hay respuestas. Añade una palabra para comenzar.</p>';
      q('#reply-list').querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',()=>{const index=Number(input.dataset.index);entries[index][input.dataset.field]=input.value;selected=index;preview();}));
      q('#reply-list').querySelectorAll('[data-reply]').forEach(row=>row.addEventListener('focusin',()=>{selected=Number(row.dataset.reply);q('#reply-list').querySelectorAll('[data-reply]').forEach(item=>item.classList.toggle('selected',item===row));preview();}));
      q('#reply-list').querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{entries.splice(Number(button.dataset.remove),1);selected=Math.min(selected,entries.length-1);update();});
      preview();
    };
    const preview=()=>{const entry=entries[selected],format=q('#reply-format').value;q('#reply-preview').innerHTML='<div class="reply-trigger"><small>MENSAJE DE UN MIEMBRO</small><strong>'+previewText(entry?.key?'¿Alguien sabe sobre '+entry.key+'?':'Escribe una palabra o frase')+'</strong></div>'+formattedPreview(format==='text'?{format,content:entry?.value||'Tu respuesta aparecerá aquí.'}:{format,title:'Respuesta automática',description:entry?.value||'Tu respuesta aparecerá aquí.',color:cfg.color});};
    q('#reply-format').addEventListener('change',preview);q('#reply-add').onclick=()=>{entries.push({key:'',value:''});selected=entries.length-1;update();q('#reply-key-'+selected)?.focus();};update();
    q('#reply-form').onsubmit=async e=>{e.preventDefault();const values={};for(const entry of entries){const key=entry.key.trim().toLowerCase();if(!key||!entry.value.trim()||key in values)return toast('Completa cada palabra y respuesta; no repitas palabras.',true);values[key]=entry.value.trim();}const button=q('#reply-form button[type=submit]');button.disabled=true;try{await api('/api/guild/'+encodeURIComponent(gid())+'/automatic-replies',{method:'PUT',body:JSON.stringify({format:q('#reply-format').value,entries:values})});st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings');q('#reply-result').innerHTML='<div class="c247-result">Respuestas guardadas. Los próximos mensajes usarán este formato.</div>';toast('Respuestas guardadas.');}catch(error){q('#reply-result').innerHTML='<div class="c247-result">'+esc(error.message)+'</div>';toast(error.message,true);}finally{button.disabled=false;}};
  }
  function achievementsDesignPage(){
    const cfg=st.settings?.config||{},achievements=st.settings?.modules?.achievements||[];
    const color=validColor(cfg.achcolor||'#8b3dff'),label=cfg.achlabel??'¡LOGRO DESBLOQUEADO!',headline=cfg.achhead??'🎉 ¡{user} ha desbloqueado **{achievement}**! (+{points} puntos)';
    const format=cfg.messageFormats?.logro||'components_v2';
    const swatches=['#8b3dff','#ff3159','#22c55e','#f59e0b','#18a5be','#ec4899'];
    root.innerHTML='<section class="achievement-shell"><div class="achievement-main"><div class="achievement-intro"><div><span class="eyebrow">MÓDULO · LOGROS</span><h2>Tarjeta de logros</h2><p>Personaliza los anuncios que recibe la comunidad cuando desbloquea un logro.</p></div><span class="achievement-count">'+achievements.length+'<small>logros</small></span></div><form id="achievement-form">'+
      '<section class="achievement-section"><div class="achievement-section-title"><span>01</span><div><h3>Formato del anuncio</h3><p>Elige cómo se publican los nuevos logros en Discord.</p></div></div><div class="c247-field"><label for="achievement-format">Presentación</label><select id="achievement-format"><option value="card" '+(format==='card'?'selected':'')+'>Tarjeta de imagen</option><option value="components_v2" '+(format==='components_v2'?'selected':'')+'>Contenedor (Components V2)</option><option value="embed" '+(format==='embed'?'selected':'')+'>Embed</option><option value="text" '+(format==='text'?'selected':'')+'>Texto solo</option></select><small>La selección se aplica a los próximos anuncios automáticos y a las consultas de logros.</small></div></section>'+ 
      '<section class="achievement-section"><div class="achievement-section-title"><span>02</span><div><h3>Color de la tarjeta</h3><p>Se aplica al borde, la insignia y el acento del anuncio.</p></div></div><div class="achievement-color-row"><label class="achievement-color-picker" for="achievement-color"><input id="achievement-color" type="color" value="'+esc(color)+'"><span><strong>Color principal</strong><small>Elige un tono o usa un color sugerido.</small></span><b id="achievement-color-value">'+esc(color.toUpperCase())+'</b></label><div class="achievement-swatches">'+swatches.map(value=>'<button type="button" data-ach-color="'+value+'" style="--swatch:'+value+'" aria-label="Usar color '+value+'" title="'+value+'"></button>').join('')+'</div></div></section>'+ 
      '<section class="achievement-section"><div class="achievement-section-title"><span>03</span><div><h3>Texto dentro de la imagen</h3><p>Este título aparece sobre el nombre del logro, como “¡LOGRO DESBLOQUEADO!”.</p></div></div><div class="c247-field"><label for="achievement-label">Título de la tarjeta</label><input id="achievement-label" maxlength="60" value="'+esc(label)+'" placeholder="¡LOGRO DESBLOQUEADO!"><small>Hasta 60 caracteres. El tamaño se ajusta para que quepa en la imagen.</small></div></section>'+ 
      '<section class="achievement-section"><div class="achievement-section-title"><span>04</span><div><h3>Texto superior del anuncio</h3><p>Personaliza la frase que aparece encima de la tarjeta en Discord.</p></div></div><div class="c247-field"><label for="achievement-headline">Mensaje del anuncio</label><textarea id="achievement-headline" rows="3" maxlength="250" placeholder="🎉 ¡{user} ha desbloqueado **{achievement}**! (+{points} puntos)">'+esc(headline)+'</textarea><small>Usa variables para insertar los datos del logro:</small></div><div class="achievement-variables">'+[['{user}','Usuario'],['{achievement}','Logro'],['{points}','Puntos'],['{emoji}','Emoji'],['{description}','Descripción'],['{rarity}','Rareza']].map(([token,name])=>'<button type="button" data-ach-variable="'+token+'"><code>'+token+'</code><span>'+name+'</span></button>').join('')+'</div></section>'+ 
      '<div class="achievement-save-row"><button type="submit" class="button primary">Guardar diseño</button><span id="achievement-result" aria-live="polite"></span></div></form><button type="button" class="achievement-tools-link" id="achievement-tools">Ver acciones y consultas de logros ↗</button></div>'+ 
      '<aside class="achievement-side"><div class="achievement-preview-wrap"><div class="studio-preview-heading"><span class="eyebrow">VISTA PREVIA</span><small>Así se verá en Discord</small></div><div id="achievement-preview" class="achievement-discord-preview" data-format="'+esc(format)+'" style="--achievement-color:'+esc(color)+'"><div class="achievement-preview-bot"><span class="achievement-preview-avatar">K</span><span><strong>Kuboq</strong><small>APP · ahora</small></span></div><div id="achievement-preview-headline" class="achievement-preview-headline"></div><div class="achievement-preview-copy"><strong>🏡 Nuevo vecino</strong><p>Cumple 7 días en el servidor</p><small>🏅 Lealtad · Común · +5 · 30% lo tienen</small></div><div class="achievement-art-preview"><div class="achievement-art-stars">✦ · ˚　· ✧</div><span class="achievement-art-medal">🏡</span><div class="achievement-art-copy"><strong id="achievement-art-label"></strong><b>Nuevo vecino</b><small>Cumple 7 días en el servidor</small><div><span>COMÚN</span><em>+5 PTS</em></div></div></div><div class="achievement-preview-actions"><span>🏆 Mis logros</span><span>📜 Logros del servidor</span></div></div><p class="achievement-preview-note">Vista de ejemplo con el logro “Nuevo vecino”.</p></div><div class="module-current"><h3>Logros de este servidor</h3><div class="module-state-row"><span>Disponibles</span><strong>'+achievements.length+'</strong></div><div class="module-state-row"><span>Formato</span><strong>'+({card:'Imagen',components_v2:'Components V2',embed:'Embed',text:'Texto solo'}[format]||'Components V2')+'</strong></div></div></aside></section>';
    const updatePreview=()=>{
      const currentColor=validColor(q('#achievement-color').value),template=q('#achievement-headline').value||'',variables={user:'@Bryant',achievement:'**Nuevo vecino**',points:5,emoji:'🏡',description:'Cumple 7 días en el servidor',rarity:'Común'};
      const message=template.replace(/\{(\w+)\}/g,(_,key)=>variables[key]??'{'+key+'}');
      q('#achievement-preview').style.setProperty('--achievement-color',currentColor);q('#achievement-color-value').textContent=currentColor.toUpperCase();
      q('#achievement-preview').dataset.format=q('#achievement-format').value;
      q('#achievement-preview-headline').innerHTML=previewText(message);q('#achievement-art-label').textContent=q('#achievement-label').value||'¡LOGRO DESBLOQUEADO!';
    };
    q('#achievement-color').addEventListener('input',updatePreview);q('#achievement-label').addEventListener('input',updatePreview);q('#achievement-headline').addEventListener('input',updatePreview);q('#achievement-format').addEventListener('change',updatePreview);
    root.querySelectorAll('[data-ach-color]').forEach(button=>button.onclick=()=>{q('#achievement-color').value=button.dataset.achColor;updatePreview();});
    root.querySelectorAll('[data-ach-variable]').forEach(button=>button.onclick=()=>{const field=q('#achievement-headline'),token=button.dataset.achVariable;field.setRangeText(token,field.selectionStart,field.selectionEnd,'end');field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();});
    q('#achievement-tools').onclick=()=>{st.achievementCommands=true;st.moduleTab='acciones';render('module');};updatePreview();
    q('#achievement-form').onsubmit=async event=>{event.preventDefault();const button=q('#achievement-form button[type=submit]'),result=q('#achievement-result');button.disabled=true;result.textContent='Guardando…';try{const design=await api('/api/guild/'+encodeURIComponent(gid())+'/achievements/design',{method:'PUT',body:JSON.stringify({color:q('#achievement-color').value,label:q('#achievement-label').value,headline:q('#achievement-headline').value,format:q('#achievement-format').value})});Object.assign(st.settings.config,{achcolor:design.design.color,achlabel:design.design.label,achhead:design.design.headline});(st.settings.config.messageFormats??={}).logro=design.design.format;result.textContent='Diseño y formato guardados. Se aplicarán en los próximos logros.';toast('Ajustes de logros guardados.');updatePreview();}catch(error){result.textContent=error.message;toast(error.message,true);}finally{button.disabled=false;}};
  }
  function levelsPage(){
    const cfg=st.settings?.config||{},cardCfg=cfg.tarjeta||{},modules=st.settings?.modules||{},savedRewards=modules.levelroles||{};
    const channels=st.resources.channels.filter(c=>[0,5].includes(c.type));
    const channelOptions='<option value="">Usar el canal donde ocurrió el ascenso</option>'+channels.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===cfg.lvlch?'selected':'')+'># '+esc(c.name)+'</option>').join('');
    const roleOptions='<option value="">Selecciona un rol</option>'+st.resources.roles.filter(r=>r.id!==gid()).map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+'</option>').join('');
    const rewards=Object.entries(savedRewards).map(([level,roleId])=>({level:Number(level),roleId:String(roleId)})).sort((a,b)=>a.level-b.level);
    const title=cfg.lvltitle??'✨ Cada conversación deja huella',message=cfg.lvlmsg??'{user} Has subido a **nivel {level}** ¡sigue activo en el servidor! ✨';
    root.innerHTML='<section class="levels-shell"><div class="levels-main"><div class="levels-intro"><div><span class="eyebrow">MÓDULO · PROGRESIÓN</span><h2>Niveles y XP</h2><p>Todo el sistema de experiencia se administra aquí: progreso, avisos, tarjeta y recompensas.</p></div><span class="levels-count">'+Object.keys(savedRewards).length+'<small>recompensas</small></span></div><form id="levels-form">'+
      '<section class="levels-section"><div class="levels-section-title"><span>01</span><div><h3>Progresión</h3><p>Define cómo se gana experiencia y si el sistema está activo.</p></div></div><div class="levels-fields"><label class="studio-toggle"><strong>Sistema de niveles activo</strong><small>El bot seguirá registrando XP cuando esta opción esté activada.</small><input id="levels-enabled" type="checkbox" '+(cfg.lvlon?'checked':'')+'></label><div class="c247-field"><label for="levels-xp">XP por mensaje</label><input id="levels-xp" type="number" min="1" max="100" step="1" value="'+esc(cfg.xprate??15)+'"><small>Valor permitido: de 1 a 100 XP por mensaje.</small></div></div></section>'+
      '<section class="levels-section"><div class="levels-section-title"><span>02</span><div><h3>Avisos de nivel</h3><p>Elige el canal y prepara el mensaje que recibirá el miembro.</p></div></div><div class="c247-field"><label for="levels-channel">Canal de anuncios</label><select id="levels-channel">'+channelOptions+'</select><small>Si dejas el canal vacío, el aviso se envía en el canal donde subió de nivel.</small></div><div class="levels-fields"><div class="c247-field"><label for="levels-title">Título del aviso</label><input id="levels-title" maxlength="256" value="'+esc(title)+'"></div><div class="c247-field"><label for="levels-image">Imagen del aviso (HTTPS)</label><input id="levels-image" maxlength="1500" type="url" placeholder="https://…" value="'+esc(cfg.lvlimg||'')+'"></div></div><div class="c247-field"><label for="levels-message">Mensaje al subir de nivel</label><textarea id="levels-message" rows="4" maxlength="2000">'+esc(message)+'</textarea><small>Variables: {user}, {level} y {server}.</small></div></section>'+
      '<section class="levels-section"><div class="levels-section-title"><span>03</span><div><h3>Tarjeta de rango</h3><p>Personaliza la imagen que se muestra con /nivel rank.</p></div></div><div class="levels-fields"><div class="c247-field"><label for="levels-background">Imagen de fondo (HTTPS)</label><input id="levels-background" maxlength="1500" type="url" placeholder="https://…" value="'+esc(cardCfg.fondo||'')+'"></div><div class="c247-field"><label for="levels-brand">Marca</label><input id="levels-brand" maxlength="30" value="'+esc(cardCfg.marca||'Kuboq')+'"></div><div class="c247-field"><label for="levels-left">Texto superior izquierdo</label><input id="levels-left" maxlength="40" value="'+esc(cardCfg.izq||'')+'"></div><div class="c247-field"><label for="levels-right">Texto superior derecho</label><input id="levels-right" maxlength="40" value="'+esc(cardCfg.der||'')+'"></div></div><div class="levels-fields levels-card-options"><div class="c247-field"><label for="levels-color">Color de progreso</label><input id="levels-color" type="color" value="'+esc(validColor(cardCfg.color||'#22d3ee'))+'"></div><label class="studio-toggle"><strong>Ocultar la etiqueta NUEVO NIVEL</strong><small>La tarjeta de rango normal no mostrará esa etiqueta.</small><input id="levels-hide-new" type="checkbox" '+(cardCfg.sinnuevo?'checked':'')+'></label></div></section>'+
      '<section class="levels-section"><div class="levels-section-title"><span>04</span><div><h3>Roles de recompensa</h3><p>Entrega un rol automáticamente cuando un miembro alcance el nivel.</p></div></div><div id="levels-rewards" class="levels-rewards"></div><button type="button" class="quiet-button" id="levels-add-reward">＋ Añadir recompensa</button></section><div class="levels-save-row"><button type="submit" class="button primary">Guardar módulo de niveles</button><span id="levels-result" aria-live="polite"></span></div></form><button type="button" class="levels-tools-link" id="levels-tools">Ver acciones y consultas de Discord ↗</button></div>'+
      '<aside class="levels-side"><div class="levels-preview-wrap"><div class="studio-preview-heading"><span class="eyebrow">VISTA PREVIA</span><small>La tarjeta y el anuncio del bot</small></div><div id="levels-card-preview" class="levels-rank-preview"></div><div id="levels-message-preview" class="levels-message-preview"></div></div><div class="module-current"><h3>Configuración guardada</h3><div class="module-state-row"><span>Experiencia por mensaje</span><strong>'+esc(cfg.xprate??15)+' XP</strong></div><div class="module-state-row"><span>Niveles activos</span><strong>'+(cfg.lvlon?'Sí':'No')+'</strong></div><div class="module-state-row"><span>Canal de anuncios</span><strong>'+(cfg.lvlch?'#'+esc(channelName(cfg.lvlch)):'Canal del ascenso')+'</strong></div><div class="module-state-row"><span>Roles de recompensa</span><strong>'+Object.keys(savedRewards).length+'</strong></div></div></aside></section>';
    const rewardRoot=q('#levels-rewards');
    const renderRewards=()=>{
      rewardRoot.innerHTML=rewards.length?rewards.map((row,index)=>'<div class="levels-reward-row"><label><span>Nivel</span><input type="number" min="1" max="10000" step="1" data-reward-level="'+index+'" value="'+esc(row.level)+'"></label><label><span>Rol de recompensa</span><select data-reward-role="'+index+'">'+roleOptions.replace('value="'+esc(row.roleId)+'"','value="'+esc(row.roleId)+'" selected')+'</select></label><button class="levels-remove" type="button" data-remove-reward="'+index+'" aria-label="Quitar recompensa">×</button></div>').join(''):'<p class="levels-empty">Aún no hay recompensas. Añade un nivel y el rol que recibirá.</p>';
      rewardRoot.querySelectorAll('[data-reward-level]').forEach(input=>input.oninput=()=>{rewards[Number(input.dataset.rewardLevel)].level=Number(input.value);});
      rewardRoot.querySelectorAll('[data-reward-role]').forEach(select=>select.onchange=()=>{rewards[Number(select.dataset.rewardRole)].roleId=select.value;});
      rewardRoot.querySelectorAll('[data-remove-reward]').forEach(button=>button.onclick=()=>{rewards.splice(Number(button.dataset.removeReward),1);renderRewards();});
    };
    const updatePreview=()=>{
      const color=q('#levels-color').value,bg=q('#levels-background').value.trim(),brand=q('#levels-brand').value.trim()||'Kuboq',left=q('#levels-left').value.trim()||brand+' · TU RECORRIDO',right=q('#levels-right').value.trim()||brand+' · GG',safeBg=/^https:\/\/[^\s"'<>]+$/i.test(bg)?'<img src="'+esc(bg)+'" alt="">':'';
      q('#levels-card-preview').innerHTML=safeBg+'<div class="levels-preview-shade"></div><div class="levels-preview-head"><span>'+esc(left)+'</span><span>'+esc(right)+'</span></div><div class="levels-preview-user"><span class="levels-preview-avatar">K</span><div><strong>'+esc(st.user?.username||'Tu usuario')+'</strong><small>#PUESTO 01</small></div><b>NIVEL <i>10</i></b></div><div class="levels-preview-progress"><div><span>PROGRESO</span><strong>420 / 650 XP</strong></div><i style="--level-color:'+esc(color)+'"><b></b></i></div><div class="levels-preview-level"><strong>10</strong><span>NIVEL ACTUAL</span>'+(q('#levels-hide-new').checked?'':'<em>NUEVO NIVEL</em>')+'</div>';
      q('#levels-card-preview').style.setProperty('--level-color',color);
      const noticeTitle=q('#levels-title').value.trim()||'Subida de nivel',noticeMessage=q('#levels-message').value.trim()||'El miembro ha subido de nivel.';
      q('#levels-message-preview').innerHTML='<div class="levels-discord-head"><span class="levels-bot-mark"><img src="/assets/brand/kuboq-logo.png" alt=""></span><div><strong>Kuboq</strong><small>APP · ahora</small></div></div><div class="levels-discord-embed" style="--level-color:'+esc(color)+'"><strong>'+previewText(noticeTitle)+'</strong><p>'+previewText(noticeMessage)+'</p>'+( /^https:\/\/[^\s"'<>]+$/i.test(q('#levels-image').value.trim())?'<img src="'+esc(q('#levels-image').value.trim())+'" alt="Imagen del aviso">':'')+'</div><div class="studio-destination"><span>Canal</span><strong>'+esc(q('#levels-channel').value?'#'+channelName(q('#levels-channel').value):'Canal donde ocurre el ascenso')+'</strong></div>';
    };
    renderRewards();
    q('#levels-add-reward').onclick=()=>{if(rewards.length>=50)return toast('Puedes configurar hasta 50 recompensas.',true);rewards.push({level:rewards.length?Math.max(...rewards.map(r=>Number(r.level)||0))+1:5,roleId:''});renderRewards();};
    q('#levels-form').addEventListener('input',updatePreview);q('#levels-form').addEventListener('change',updatePreview);updatePreview();
    q('#levels-tools').onclick=()=>{st.levelsCommands=true;st.moduleTab='acciones';render('module');};
    q('#levels-form').onsubmit=async event=>{
      event.preventDefault();const xpPerMessage=Number(q('#levels-xp').value);
      if(!Number.isInteger(xpPerMessage)||xpPerMessage<1||xpPerMessage>100)return toast('La XP por mensaje debe estar entre 1 y 100.',true);
      const parsed=rewards.map(row=>({level:Number(row.level),roleId:String(row.roleId||'')}));
      if(parsed.some(row=>!Number.isInteger(row.level)||row.level<1||row.level>10000||!row.roleId))return toast('Completa un nivel válido y un rol para cada recompensa.',true);
      if(new Set(parsed.map(row=>row.level)).size!==parsed.length)return toast('No repitas el mismo nivel en las recompensas.',true);
      const body={enabled:q('#levels-enabled').checked,xpPerMessage,channelId:q('#levels-channel').value||null,announcement:{title:q('#levels-title').value,message:q('#levels-message').value,image:q('#levels-image').value.trim()},card:{background:q('#levels-background').value.trim(),brand:q('#levels-brand').value,leftText:q('#levels-left').value,rightText:q('#levels-right').value,hideNewLevel:q('#levels-hide-new').checked,color:q('#levels-color').value},rewards:parsed};
      const button=q('#levels-form button[type=submit]');button.disabled=true;
      try{await api('/api/guild/'+encodeURIComponent(gid())+'/levels',{method:'PUT',body:JSON.stringify(body)});st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings');toast('Módulo de Niveles y XP guardado.');levelsPage();}
      catch(error){q('#levels-result').textContent=error.message;toast(error.message,true);button.disabled=false;}
    };
  }

  function moduleSettingArea(command){
    const names=command.options.map(option=>option.name),name=command.name;
    if(/embed|mensaje|texto|titulo|descripcion|fondo|color|banner|imagen|miniatura|formato/.test(name)||names.some(key=>['titulo','descripcion','mensaje','texto','color','imagen','fondo','banner','miniatura','pie','formato'].includes(key)))return 'Mensajes y apariencia';
    if(names.includes('canal')||names.includes('categoria')||names.includes('logs')||names.includes('canal_logs'))return 'Canales y destinos';
    if(names.includes('rol')||names.includes('rol_staff')||names.some(key=>key.startsWith('rol')))return 'Roles y acceso';
    if(/activ|toggle|estado|rate|limite|config|setup|seguridad/.test(name)||names.some(key=>['estado','activo','cantidad','espera','cooldown'].includes(key)))return 'Comportamiento del sistema';
    return 'Ajustes adicionales';
  }

  function moduleSettingsHub(category,title,settings,counts){
    const areas=['Mensajes y apariencia','Canales y destinos','Roles y acceso','Comportamiento del sistema','Ajustes adicionales'];
    const groups=areas.map(area=>[area,settings.filter(command=>moduleSettingArea(command)===area)]).filter(([,items])=>items.length);
    const tabs=Object.entries(counts).filter(([,count])=>count).map(([key,count])=>'<button type="button" class="module-tab '+(key==='ajustes'?'active':'')+'" data-module-tab="'+key+'">'+({ajustes:'Configuración del módulo',acciones:'Acciones',consultas:'Consultas'})[key]+' <small>'+count+'</small></button>').join('');
    root.innerHTML='<div class="module-overview"><div><span class="eyebrow">CONFIGURACIÓN DEL MÓDULO</span><h2>'+esc(title)+'</h2><p>Los ajustes están organizados por función del sistema. Los comandos para operar el bot se encuentran en Acciones y Consultas.</p></div><div class="module-overview-stats"><strong>'+groups.length+'</strong><span>áreas de configuración</span></div></div><div class="module-tabs">'+tabs+'</div><div class="module-settings-grid">'+groups.map(([area,items],areaIndex)=>'<section class="module-settings-area"><header><h3>'+esc(area)+'</h3><span>'+items.length+'</span></header><form class="module-settings-form" data-hub-form="'+areaIndex+'" data-hub-commands="'+esc(items.map(command=>command.name).join(' '))+'"><div class="module-settings-cards">'+items.map(command=>{
      const prefix='hub-'+command.name+'-';
      return '<article class="module-setting-card"><h4>'+esc(command.description.split('(')[0].trim())+'</h4>'+command.options.map(option=>optionControl(option,command,prefix)).join('')+'</article>';
    }).join('')+'</div><div class="module-form-actions"><button class="button primary" type="submit">Guardar '+esc(area.toLowerCase())+'</button></div><div class="c247-result" data-hub-result hidden aria-live="polite"></div></form></section>').join('')+'</div><aside class="module-current module-settings-current"><h3>Estado actual del módulo</h3><div id="module-current-rows">'+moduleStateMarkup(category)+'</div></aside>';
    root.querySelectorAll('[data-module-tab]').forEach(button=>button.onclick=()=>{st.moduleTab=button.dataset.moduleTab;modulePage();});
    root.querySelectorAll('[data-hub-form]').forEach(form=>form.onsubmit=async event=>{
      event.preventDefault();const names=form.dataset.hubCommands.split(' ').filter(Boolean),commands=names.map(name=>moduleCommands(category).find(item=>item.name===name)).filter(Boolean),payloads=[];
      for(const command of commands){const prefix='hub-'+command.name+'-',options={};for(const option of command.options){const input=form.querySelector('#'+CSS.escape(prefix+option.name));if(!input)continue;if(option.type==='boolean')options[option.name]=input.checked;else if(input.value)options[option.name]=input.value;else if(option.required){toast('Completa '+option.name+'.',true);input.focus();return;}}payloads.push({category:command.category,name:command.name,options,publish:false});}
      if(!payloads.length)return;
      const button=form.querySelector('button[type=submit]'),result=form.querySelector('[data-hub-result]');button.disabled=true;
      try{for(const payload of payloads){const output=await api('/api/guild/'+encodeURIComponent(gid())+'/commands/run',{method:'POST',body:JSON.stringify(payload)});responses(output.responses);if(output.modal)showModal(output.modal);}st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings');q('#module-current-rows').innerHTML=moduleStateMarkup(category);result.hidden=false;result.textContent='Los ajustes de esta área se guardaron en '+title+'.';toast('Configuración guardada en '+title+'.');}
      catch(error){result.hidden=false;result.textContent=error.message;toast(error.message,true);}
      finally{button.disabled=false;}
    });
  }

  function modulePage(){
    const category=st.category;
    const list=moduleCommands(category);
    const title=commandLabels[category]||category;
    if(!list.length){root.innerHTML=head('◈','Función no disponible','No hay comandos registrados para esta sección.');return;}
    const counts={ajustes:0,acciones:0,consultas:0};
    for(const command of list)counts[moduleKind(command)]++;
    let tab=st.moduleTab||'ajustes';
    if(!counts[tab])tab=Object.keys(counts).find(key=>counts[key])||'ajustes';
    st.moduleTab=tab;
    const shown=list.filter(command=>moduleKind(command)===tab);
    if(tab==='ajustes'){moduleSettingsHub(category,title,shown,counts);return;}
    let selected=shown.find(command=>command.name===st.moduleCommand?.[category]);
    const featured={ticket:'embed',verif:'embed',application:'config',nivel:'mensaje',autorole:'add',rolpanel:'crear',seg:'raidconfig',anuncio:'embed',stats:'config'};
    if(!selected)selected=shown.find(command=>command.name===featured[category])||shown[0];
    st.moduleCommand??={};
    st.moduleCommand[category]=selected?.name;
    const tabs=Object.entries(counts).filter(([,n])=>n).map(([key,n])=>'<button type="button" class="module-tab '+(key===tab?'active':'')+'" data-module-tab="'+key+'">'+({ajustes:'Configurar',acciones:'Acciones',consultas:'Consultar'})[key]+' <small>'+n+'</small></button>').join('');
    const entries=shown.map(command=>'<button type="button" class="module-command '+(command===selected?'active':'')+'" data-module-command="'+esc(command.name)+'" title="'+esc(command.description)+'"><span class="module-command-name">'+esc(command.description.split('(')[0].slice(0,55))+'</span><small>/'+esc(command.category)+(command.root?'':' '+esc(command.name))+'</small></button>').join('');
    root.innerHTML='<div class="module-overview"><div><span class="eyebrow">'+(tab==='ajustes'?'CONFIGURACIÓN':tab==='acciones'?'ACCIONES':'CONSULTAS')+'</span><h2>'+esc(title)+'</h2><p>Selecciona una función para ver sus opciones y el efecto previsto en este servidor.</p></div><div class="module-overview-stats"><strong>'+list.length+'</strong><span>funciones disponibles</span></div></div>'+ 
      '<div class="module-tabs">'+tabs+'</div><div class="module-command-strip" aria-label="Funciones de '+esc(title)+'">'+entries+'</div><div class="module-layout"><div class="module-primary"><div class="module-workspace"><div id="module-editor"></div></div></div><aside class="module-preview-column"><div class="module-preview-sticky"><div class="module-preview-heading"><span class="eyebrow">'+(isMessageCommand(selected)?'VISTA DEL MENSAJE':'EFECTO PREVISTO')+'</span><h3>'+(isMessageCommand(selected)?'Cómo se verá en Discord':'Cambios en este servidor')+'</h3></div><div id="module-preview"></div><div class="module-current"><h3>Configuración guardada</h3><div id="module-current-rows">'+moduleStateMarkup(category)+'</div></div></div></aside></div>';
    root.querySelectorAll('[data-module-tab]').forEach(button=>button.onclick=()=>{st.moduleTab=button.dataset.moduleTab;modulePage();});
    root.querySelectorAll('[data-module-command]').forEach(button=>button.onclick=()=>{st.moduleCommand[category]=button.dataset.moduleCommand;modulePage();});
    renderModuleEditor(selected);
  }
  function renderModuleEditor(command){
    const container=q('#module-editor');
    const specialNames={'nivel.mensaje':'Mensaje de nivel','rolpanel.crear':'Crear panel de roles','stats.crear':'Crear canal de estadística','respondedor.add':'Nueva respuesta automática','log.servidor':'Canales de registros','vozbot.activar':'Conexión de voz permanente'};
    const names={embed:'Diseño del panel',setup:'Canal y rol',config:'Configuración del sistema',mensaje:'Mensaje de nivel',raidconfig:'Protección contra raids'};
    const id=command.category+'.'+command.name;
    const contextRequired=Boolean(command.contextChannelRequired)||command.category==='social'||command.category==='limpiar'||new Set(['anuncio.encuesta','anuncio.sorteo','anuncio.recordatorio','anuncio.editar','anuncio.borrar','estado.panel']).has(id);
    const targetRequired=Boolean(command.targetChannelRequired);
    const publishReply=command.category==='social'||new Set(['anuncio.encuesta','anuncio.sorteo']).has(id);
    const hasRequiredChannel=command.options.some(o=>['canal','texto'].includes(o.name)&&o.type==='channel'&&o.required);
    const channelControl=contextRequired&&!hasRequiredChannel?choice('module-channel','Canal de contexto',st.resources.channels.filter(c=>[0,5].includes(c.type)).map(c=>({value:c.id,label:'# '+c.name})),true):'';
    const form='<form id="module-form"><div class="module-editor-head"><span class="eyebrow">/'+esc(command.category)+(command.root?'':' '+esc(command.name))+'</span><h2>'+esc(specialNames[id]||names[command.name]||command.description)+'</h2><p>'+esc(command.description)+'</p></div>'+ 
      command.options.map(option=>optionControl(option,command)).join('')+
      channelControl+
      '<div class="module-form-actions"><button class="button primary" type="submit">'+(st.moduleTab==='ajustes'?'Aplicar configuración':'Ejecutar comando')+'</button></div><div id="module-result" aria-live="polite"></div></form>';
    container.innerHTML=form;
    const selectedChannel=st.moduleChannels?.[gid()];
    if(channelControl&&selectedChannel&&st.resources.channels.some(c=>c.id===selectedChannel))q('#module-channel').value=selectedChannel;
    q('#module-form').addEventListener('input',updateModulePreview);
    q('#module-form').addEventListener('change',event=>{
      if(st.category==='bienvenida'&&event.target.id==='module-option-evento'){
        for(const option of command.options.filter(o=>o.name!=='evento')){
          const input=q('#module-option-'+CSS.escape(option.name));
          const value=storedOptionValue(option,event.target.value);
          if(input?.type==='checkbox')input.checked=value===true;
          else if(input?.type==='color')input.value=validColor(value);
          else if(input)input.value=value??'';
        }
      }
      updateModulePreview();
    });
    q('#module-form').onsubmit=async e=>{
      e.preventDefault();
      const options={};
      for(const option of command.options){
        const input=q('#module-option-'+CSS.escape(option.name));
        if(option.type==='boolean')options[option.name]=input.checked;
        else if(input.value)options[option.name]=input.value;
        else if(option.required){toast('Completa '+option.name+'.',true);input.focus();return;}
      }
      const optionChannel=options.canal||options.texto;
      const channelId=q('#module-channel')?.value||([0,5].includes(st.resources.channels.find(c=>c.id===optionChannel)?.type)?optionChannel:null);
      if(contextRequired&&!channelId)return toast('Selecciona el canal de contexto para esta acción.',true);
      if(targetRequired&&!options.canal)return toast('Selecciona el canal donde se publicará.',true);
      if(new Set(['ticket.close','ticket.remove','anuncio.borrar','mod.purge','mod.ban','mod.kick','mod.softban','mod.timeout','mod.clearwarns','mod.lock','mod.unlock','mod.hide','mod.unhide','limpiar.mensajes','limpiar.desde','confesion.borrar']).has(id)&&!window.confirm('Esta acción puede borrar datos, moderar a un miembro o cambiar el acceso a un canal. ¿Quieres continuar?'))return;
      st.moduleChannels??={};
      if(channelId)st.moduleChannels[gid()]=channelId;
      try{
        const result=await api('/api/guild/'+encodeURIComponent(gid())+'/commands/run',{method:'POST',body:JSON.stringify({category:command.category,name:command.name,options,channelId,publish:publishReply})});
        responses(result.responses);
        if(result.modal)showModal(result.modal);
        [st.settings,st.summary]=await Promise.all([api('/api/guild/'+encodeURIComponent(gid())+'/settings'),api('/api/guild/'+encodeURIComponent(gid())+'/summary')]);
        q('#module-current-rows').innerHTML=moduleStateMarkup(st.category);
        updateModulePreview();
        toast('Acción completada.');
      }catch(error){q('#module-result').innerHTML='<div class="c247-result">'+esc(error.message)+'</div>';toast(error.message,true);}
    };
    updateModulePreview();
  }
  function previewValues(){
    const values={};
    q('#module-form')?.querySelectorAll('[id^="module-option-"]').forEach(input=>{
      const key=input.id.slice('module-option-'.length);
      values[key]=input.type==='checkbox'?input.checked:input.value;
    });
    return values;
  }
  function previewText(value){
    const sample={user:'@'+(st.user?.username||'usuario'),tag:st.user?.username||'usuario',name:st.user?.username||'usuario',id:st.user?.id||'123456789',server:st.guild?.name||'Servidor',members:st.summary?.memberCount||0,created:'hace 2 años',inviter:'@invitador',level:10,count:5};
    return esc(String(value||'').replace(/\\n/g,'\n').replace(/\{(\w+)\}/g,(_,key)=>sample[key]??'{'+key+'}')).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
  }
  function validColor(value){
    if(Number.isInteger(value))return '#'+value.toString(16).padStart(6,'0');
    return /^#[0-9a-f]{6}$/i.test(value||'')?value:'#ff3159';
  }
  function previewImage(value){
    const first=String(value||'').split('|')[0].trim();
    return /^https:\/\/[^\s"'<>]+$/i.test(first)?'<img class="module-embed-image" src="'+esc(first)+'" alt="Imagen de la vista previa">':'';
  }
  function previewConfig(category,command,values){
    const cf=st.settings?.config||{};
    const base=category==='bienvenida'?(values.evento==='despedida'?cf.bye:cf.wb)||{}:
      category==='ticket'?cf.tk?.emb||{}:category==='verif'?cf.vemb||{}:
      category==='application'?cf.app||{}:category==='nivel'?cf.tarjeta||{}:{};
    const isWelcome=category==='bienvenida';
    const welcomeTitle=isWelcome&&command.name==='titulo'?values.texto:null;
    const welcomeMessage=isWelcome&&command.name==='mensaje'?values.texto:null;
    const title=welcomeTitle||values.titulo||base.title||base.marca||commandLabels[category]||category;
    const description=welcomeMessage||values.descripcion||(category==='nivel'&&command.name==='mensaje'?values.texto:null)||base.desc||base.description||'';
    const content=isWelcome?(command.name==='texto'?values.texto:base.content):'';
    const color=validColor(values.color||base.color||cf.color);
    const banner=values.banner||base.banner;
    const image=values.imagen||values.fondo||base.img||base.fondo;
    const thumb=values.miniatura||base.thumb;
    const footer=values.pie||base.footer||'';
    const button=category==='verif'&&command.name==='boton'?values.texto||base.btn||'Verificarme':
      values.boton||base.btn||(category==='ticket'?'Abrir ticket':category==='verif'?'Verificarme':null);
    return {title,description,content,color,banner,image,thumb,footer,button,base};
  }
  function updateModulePreview(){
    const category=st.category;
    const command=moduleCommands(category).find(c=>c.name===st.moduleCommand?.[category]);
    const target=q('#module-preview');
    if(!command||!target)return;
    const values=previewValues();
    const data=previewConfig(category,command,values);
    const id=category+'.'+command.name,showMessage=isMessageCommand(command);
    const channel=q('#module-channel')?.value;
    const resource=(name,value)=>{
      const option=command.options.find(o=>o.name===name);
      if(option?.type==='channel')return st.resources.channels.find(c=>c.id===value)?.name||value;
      if(option?.type==='role')return st.resources.roles.find(r=>r.id===value)?.name||value;
      if(option?.type==='user')return st.resources.members.find(m=>m.id===value)?.name||value;
      return value===true?'Activado':value===false?'Desactivado':value;
    };
    if(showMessage){
      const format=id==='anuncio.say'?'text':'embed';
      const person=st.resources.members.find(m=>m.id===values.usuario)?.name||'un miembro';
      const socialText=category==='social'?(st.user?.username||'Bryant')+' '+command.name+' a '+person:null;
      target.innerHTML=formattedPreview({format,content:format==='text'?values.texto:data.content,title:category==='social'||format==='text'?'':data.title,description:category==='social'?socialText:format==='text'?'':data.description,image:data.image,banner:data.banner,thumbnail:data.thumb,footer:data.footer,color:data.color,button:['ticket.panel','verif.panel'].includes(id)?data.button:null});
      if(id==='nivel.mensaje')target.innerHTML+='<p class="preview-footnote">Este texto se enviará cuando un miembro suba de nivel; la tarjeta de nivel se configura por separado.</p>';
      if(category==='social')target.innerHTML+='<p class="preview-footnote">El GIF se obtiene al ejecutar el comando; su imagen concreta puede variar.</p>';
    }else if(id==='respondedor.add'){
      const existing=st.settings?.modules?.automaticReplies?.[String(values.palabra||'').toLowerCase()];
      target.innerHTML='<div class="effect-card"><small>DISPARADOR</small><strong>Cuando alguien escriba “'+previewText(values.palabra||'palabra')+'”</strong><small>RESPUESTA DEL BOT</small><p>'+previewText(values.respuesta||existing||'Escribe la respuesta que enviará el bot.')+'</p></div>';
    }else if(['stats.crear','stats.formato','estado.setup','estado.formato'].includes(id)){
      const pattern=values.formato||st.settings?.config?.vcs?.fmt||'{count} miembros';
      const sample=String(pattern).replace(/\{(count|n|humanos|total)\}/g,String(st.summary?.memberCount||128)).replace(/\{(goal|pct|left|bots|canales)\}/g,k=>({goal:'200',pct:'64%',left:'72',bots:'4',canales:'3'})[k.slice(1,-1)]);
      target.innerHTML='<div class="effect-card channel-effect"><small>CANAL DE '+(category==='stats'?'ESTADÍSTICA':'VOZ')+' · EJEMPLO</small><strong>◖ '+esc(values.tipo==='todos'?'Paquete de canales':sample)+'</strong><p>El nombre se actualizará con los datos del servidor.</p></div>';
    }else if(id==='log.servidor'){
      target.innerHTML='<div class="effect-card"><small>ESTRUCTURA DEL SERVIDOR</small><strong>Canales de registros por evento</strong><p>El bot creará las categorías y los canales que falten, y vinculará cada evento a su canal. Los canales ya configurados se conservarán.</p></div>';
    }else{
      const rows=Object.entries(values).filter(([,v])=>v!==''&&v!=null).map(([name,value])=>'<div class="module-state-row"><span>'+esc(({palabra:'Palabra que activa',respuesta:'Respuesta',disparador:'Canal disparador',categoria:'Categoría',canal:'Canal',rol:'Rol',formato:'Formato',estado:'Estado',cantidad:'Cantidad'})[name]||name.replaceAll('_',' '))+'</span><strong>'+previewText(resource(name,value))+'</strong></div>').join('');
      target.innerHTML='<div class="effect-card"><small>'+esc(moduleKind(command)==='consultas'?'CONSULTA':'CAMBIO PREVISTO')+'</small><strong>'+esc(command.description)+'</strong>'+(rows?'<div class="effect-rows">'+rows+'</div>':'<p>Esta acción utilizará los datos actuales del servidor. El resultado aparecerá aquí al ejecutarla.</p>')+'</div>';
    }
    const destination=values.canal||values.texto&&command.options.find(o=>o.name==='texto'&&o.type==='channel')&&values.texto||channel;
    if(destination&&st.resources.channels.some(c=>c.id===destination))target.innerHTML+='<div class="module-preview-channel">Canal seleccionado <strong>#'+esc(channelName(destination))+'</strong></div>';
  }

  const commandLabels={anuncio:'Anuncios',application:'Aplicaciones',autorole:'Autoroles',bienvenida:'Bienvenidas',bump:'Bump',canal:'Canales',confesion:'Confesiones',cumple:'Cumpleaños',daily:'Recompensa diaria',eco:'Economía',estado:'Estado',fishing:'Pesca',ia:'Inteligencia artificial',invite:'Invitaciones',limpiar:'Limpieza',links:'Enlaces',log:'Registros',logro:'Logros',mod:'Moderación',nivel:'Niveles y XP',pinterest:'Pinterest',respondedor:'Respuestas automáticas',rolpanel:'Paneles de roles',seg:'Seguridad',social:'Interacciones sociales',starboard:'Starboard',stats:'Estadísticas',ticket:'Tickets',util:'Utilidades',verif:'Verificación',voz:'Canales de voz',vozbot:'Bot de voz',work:'Trabajo'};
  function moduleIcon(category){return ({anuncio:'◈',application:'▤',autorole:'♧',bienvenida:'✥',bump:'✦',canal:'◫',confesion:'◉',cumple:'♙',daily:'✧',eco:'◇',estado:'◌',fishing:'♢',ia:'✳',invite:'↗',limpiar:'▥',links:'↗',log:'▤',logro:'★',mod:'♙',nivel:'✷',pinterest:'▣',respondedor:'☷',rolpanel:'◫',seg:'♢',social:'✦',starboard:'☆',stats:'▥',ticket:'▧',util:'⚙',verif:'◆',voz:'◖',vozbot:'♫',work:'✥'})[category]||'✦';}
  function renderCatalogNav(){
    if(!nav)return;
    let group=q('#c247-live-catalog');
    if(!group){group=document.createElement('div');group.className='nav-group';group.id='c247-live-catalog';nav.appendChild(group);}
    const categories=[...new Set(st.commands.filter(c=>c.category!=='musica').map(c=>categoryAlias[c.category]||c.category))];
    const sets=[['Comunidad',['autorole','bienvenida','salidas','bump','cumple','confesion','invite','nivel','rolpanel','starboard','stats','ticket','verif','voz','application','respondedor','social']],['Protección',['seg','mod','log','limpiar','canal','vozbot']],['Actividad',['anuncio','eco','daily','work','fishing','logro','ia','pinterest','links','estado','util']]];
    const known=new Set(sets.flatMap(([,items])=>items));
    const others=categories.filter(key=>!known.has(key));if(others.length)sets.push(['Otras funciones',others]);
    group.innerHTML=sets.map(([label,items])=>{
      const visible=items.filter(key=>categories.includes(key==='salidas'?'bienvenida':key));
      if(!visible.length)return '';
      return '<div class="nav-group"><div class="group-title">'+label+'<small>'+visible.length+'</small></div>'+visible.map(key=>{
        const category=key==='salidas'?'bienvenida':key;
        const name=key==='salidas'?'Salidas':commandLabels[category]||category;
        return '<button class="c247-nav" data-livecat="'+esc(category)+'"'+(key==='salidas'?' data-event="despedida"':'')+'><span class="nav-symbol">'+esc(moduleIcon(category))+'</span><span>'+esc(name)+'</span></button>';
      }).join('')+'</div>';
    }).join('');
    filterSidebarNav();
  }
  const configFields={
    color:['Color general de embeds','color'],
  };
  function configPage(){
    const cfg=st.settings?.config||{};
    const fields=Object.entries(configFields).map(([key,[label,type]])=>{
      const value=cfg[key];
      const control=type==='boolean'?'<input id="cfg-'+key+'" type="checkbox" data-cfg="'+key+'" '+(value?'checked':'')+'>':
        '<input id="cfg-'+key+'" data-cfg="'+key+'" type="'+(type==='color'?'color':type==='number'?'number':'text')+'" value="'+esc(value??(type==='color'?'#ff3159':''))+'">';
      return '<div class="c247-field"><label for="cfg-'+key+'">'+esc(label)+'</label>'+control+'</div>';
    }).join('');
    root.innerHTML=head('⚙','Configuración general','Define los valores compartidos que usan los módulos de Kuboq.')+
      '<section class="config-welcome"><div><span class="eyebrow">KUBOQ · PREFERENCIAS DEL SERVIDOR</span><h2>Una base visual para todos tus módulos</h2><p>El color general se usa como tono predeterminado cuando una función no tiene un color propio.</p></div><span class="config-scope"><i></i> Solo este servidor</span></section><div class="config-layout"><div class="config-main">'+card('Color general de embeds','<p>Elige un color para mensajes de bienvenida, registros y otras respuestas que usen el estilo predeterminado.</p><form id="c247-cfg-form"><div class="config-color-editor"><div class="config-color-current"><label for="cfg-color">Color elegido</label><div class="config-color-control"><input id="cfg-color" data-cfg="color" type="color" value="'+esc(validColor(cfg.color))+'"><code id="config-hex">'+esc(validColor(cfg.color).toUpperCase())+'</code></div></div><div><span class="config-palette-label">Paleta rápida</span><div class="config-swatches">'+[['#ff3159','Rosa Kuboq'],['#e54475','Fucsia'],['#8b5cf6','Violeta'],['#3b82f6','Azul'],['#14b8a6','Turquesa'],['#f59e0b','Ámbar']].map(([color,label])=>'<button type="button" class="config-swatch" data-config-color="'+color+'" style="--swatch:'+color+'" aria-label="'+label+'" title="'+label+'"></button>').join('')+'</div></div></div><div class="config-form-foot"><span>Los módulos con color propio conservan su personalización.</span><button class="button primary" type="submit">Guardar estilo</button></div></form>')+card('Accesos relacionados','<p>Abre un módulo para ajustar sus mensajes o comportamiento con más detalle.</p><div class="config-related-links"><button type="button" data-open-module="bienvenida"><span>✦</span><strong>Bienvenidas</strong><small>Mensajes de entrada</small><b>↗</b></button><button type="button" data-open-module="nivel"><span>✧</span><strong>Niveles y XP</strong><small>Progreso y recompensas</small><b>↗</b></button><button type="button" data-open-module="seg"><span>⬡</span><strong>Seguridad</strong><small>Protección del servidor</small><b>↗</b></button><button type="button" data-open-module="ticket"><span>▤</span><strong>Tickets</strong><small>Atención y soporte</small><b>↗</b></button></div>')+'</div><aside class="config-side">'+card('Vista previa en Discord','<div class="config-preview-wrap"><div class="module-discord-header"><span class="module-avatar"><img src="/assets/brand/kuboq-logo.png" alt=""></span><strong>Kuboq</strong><small>BOT</small><time>ahora</time></div><div id="general-preview" class="module-embed"></div></div><p class="config-preview-note">Una muestra del tono que usarán los mensajes sin un color específico.</p>')+card('Alcance del cambio','<div class="config-scope-list"><div><span>Servidor</span><strong>'+esc(st.guild?.name||'Servidor activo')+'</strong></div><div><span>Canales</span><strong>'+Number(st.summary?.channels||st.resources.channels.length).toLocaleString('es-DO')+'</strong></div><div><span>Roles</span><strong>'+Number(st.summary?.roles||st.resources.roles.length).toLocaleString('es-DO')+'</strong></div></div>')+'</aside></div>';
    const update=()=>{
      const color=root.querySelector('[data-cfg="color"]').value;
      q('#config-hex').textContent=validColor(color).toUpperCase();
      q('#general-preview').style.setProperty('--preview-color',validColor(color));
      q('#general-preview').innerHTML='<strong>Estilo general</strong><p>Este es el color predeterminado de los mensajes de Kuboq para este servidor.</p><small>Preferencias del servidor · Kuboq</small>';
      root.querySelectorAll('[data-config-color]').forEach(button=>button.classList.toggle('is-selected',button.dataset.configColor.toLowerCase()===color.toLowerCase()));
    };
    q('#c247-cfg-form').addEventListener('input',update);update();
    root.querySelectorAll('[data-config-color]').forEach(button=>button.onclick=()=>{q('#cfg-color').value=button.dataset.configColor;q('#cfg-color').dispatchEvent(new Event('input',{bubbles:true}));});
    q('#c247-cfg-form').onsubmit=async event=>{
      event.preventDefault();
      const data={};
      for(const [key,[label,type]] of Object.entries(configFields)){
        const input=root.querySelector('[data-cfg="'+key+'"]');
        const value=type==='boolean'?input.checked:type==='number'?Number(input.value):input.value;
        if(type==='number'&&(!input.value||!Number.isInteger(value)))return toast('Número inválido: '+label,true);
        data[key]=value;
      }
      await saveSettings({config:data});
    };
  }

  function customizePage(){
    const s=st.settings||{},d=s.dashboard||{},i=s.identity||{};
    const modules=[...document.querySelectorAll('#nav [data-livecat]')].map(x=>({id:x.dataset.livecat,name:x.querySelector('span:not(.nav-symbol)')?.textContent.trim()||x.dataset.livecat}));
    const hidden=new Set(Array.isArray(d.hiddenModules)?d.hiddenModules:[]),visibleCount=modules.filter(m=>!hidden.has(m.id)).length;
    const accent=/^#(?:a33ce2|8b5cf6)$/i.test(d.accent||'')?'#ff3159':d.accent||'#ff3159';
    const identity='<div class="appearance-identity-grid">'+
      '<div class="c247-field"><label for="c247-name">Nombre del bot</label><input id="c247-name" maxlength="80" value="'+esc(brandName(i.name))+'" placeholder="Kuboq"></div>'+ 
      '<div class="c247-field"><label for="c247-desc">Descripción</label><textarea id="c247-desc" maxlength="500" rows="3" placeholder="Describe brevemente tu bot">'+esc(i.description||'')+'</textarea></div>'+ 
      '<div class="c247-field"><label for="c247-logo">Logo del panel · HTTPS</label><input id="c247-logo" type="url" value="'+esc(i.logoUrl||'')+'" placeholder="https://…"><small>Usa un enlace directo a una imagen cuadrada.</small></div>'+ 
      '<div class="appearance-field-pair"><div class="c247-field"><label for="c247-accent">Color principal</label><div class="appearance-color-control"><input id="c247-accent" type="color" value="'+esc(accent)+'"><span>Marca el tono de botones, bordes y detalles.</span></div><div class="appearance-swatches" aria-label="Colores sugeridos">'+[['#ff3159','Kuboq'],['#e44b73','Rosa'],['#9b5de5','Violeta'],['#4f7cff','Azul'],['#14b8a6','Turquesa'],['#f59e0b','Ámbar']].map(([color,label])=>'<button type="button" data-appearance-color="'+color+'" style="--swatch:'+color+'" aria-label="'+label+'" title="'+label+'"></button>').join('')+'</div></div>'+ 
      '<div class="c247-field"><label for="c247-density">Espaciado del panel</label><select id="c247-density"><option value="comfortable">Cómodo</option><option value="compact" '+(d.density==='compact'?'selected':'')+'>Compacto</option></select></div></div>'+ 
      '<div class="appearance-form-actions"><span>Los cambios se aplican solo a este servidor.</span><button id="c247-save-appearance" class="button primary">Guardar identidad</button></div></div>';
    const moduleRows=modules.map(m=>'<label class="appearance-module-option" data-appearance-module="'+esc(m.id)+'" data-search="'+esc(normalize(m.name))+'"><input type="checkbox" data-hide="'+esc(m.id)+'" '+(hidden.has(m.id)?'':'checked')+'><span class="appearance-module-icon">'+esc(moduleIcon(m.id))+'</span><span class="appearance-module-copy"><strong class="appearance-module-name">'+esc(m.name)+'</strong><small>Acceso en la navegación del servidor</small></span><span class="appearance-module-state">'+(hidden.has(m.id)?'Oculto':'Visible')+'</span></label>').join('');
    const navigation='<p class="appearance-card-intro">Elige qué sistemas aparecen en la barra lateral. Ocultarlos aquí no desactiva sus funciones.</p>'+ 
      '<details class="appearance-module-picker" id="appearance-module-picker"><summary class="appearance-module-trigger" aria-expanded="false"><span class="appearance-module-trigger-icon">☷</span><span class="appearance-module-trigger-copy"><strong id="appearance-module-count">'+visibleCount+' de '+modules.length+' sistemas visibles</strong><small>Abrir selector de navegación</small></span><span class="appearance-module-caret">⌄</span></summary><div class="appearance-module-popover"><div class="appearance-module-toolbar"><label class="appearance-module-search"><span>Buscar un sistema</span><input id="appearance-module-search" type="search" placeholder="Ej. Niveles, Tickets, Música…"></label><div class="appearance-module-bulk"><button type="button" id="appearance-modules-all">Mostrar todos</button><button type="button" id="appearance-modules-none">Ocultar todos</button></div></div><div class="appearance-module-list" id="appearance-module-list">'+(moduleRows||'<p class="appearance-empty">No hay sistemas disponibles.</p>')+'</div><div class="appearance-module-foot">Los módulos ocultos siguen activos y se pueden abrir desde Explorar funciones.</div></div></details>'+ 
      '<div class="appearance-module-summary" id="appearance-module-summary"></div>'+ 
      '<div class="c247-field appearance-caption-field"><label for="c247-caption">Subtítulo de marca</label><input id="c247-caption" maxlength="80" value="'+esc(d.brandCaption||'Centro de administración')+'"></div>'+ 
      '<div class="appearance-form-actions"><span>Personaliza cómo se organiza este servidor.</span><button id="c247-save-layout" class="button primary">Guardar navegación</button></div>';
    root.innerHTML=head('✧','Apariencia','Define la identidad visual y organiza los accesos de este servidor.')+
      '<section class="appearance-welcome"><div><span class="eyebrow">KUBOQ · ESTILO DEL SERVIDOR</span><h2>Un panel a tu manera</h2><p>Personaliza la marca y mantén a mano los sistemas que más utilizas.</p></div><span class="appearance-live-pill"><i></i> Vista previa en vivo</span></section>'+ 
      '<div class="appearance-layout"><div class="appearance-main-column">'+card('Identidad del panel',identity,'Nombre, logo, color y espaciado')+card('Navegación del servidor',navigation,'Selecciona los sistemas que quieres tener a la vista.')+'</div><aside>'+card('Vista previa','<div class="appearance-preview" id="appearance-preview"></div><div class="appearance-nav-preview" id="appearance-nav-preview"></div>')+card('Configuración del bot','<p>Los ajustes funcionales se administran dentro de cada módulo del bot.</p><button class="quiet-button" data-c247="config">Abrir configuración ↗</button>')+'</aside></div>';
    const updateAppearancePreview=()=>{
      const name=q('#c247-name').value||'Kuboq';
      const caption=q('#c247-caption').value||'Centro de administración';
      const description=q('#c247-desc').value;
      const logo=q('#c247-logo').value;
      const mark=/^https:\/\/[^\s"'<>]+$/i.test(logo)?'<img src="'+esc(logo)+'" alt="">':'<img src="/assets/brand/kuboq-logo.png" alt="">';
      const color=q('#c247-accent').value;
      q('#appearance-preview').innerHTML='<div class="appearance-mark">'+mark+'</div><div><strong>'+esc(name)+'</strong><span>'+esc(caption)+'</span>'+(description?'<p>'+esc(description)+'</p>':'')+'</div>';
      q('#appearance-preview').style.setProperty('--preview-color',color);
      root.querySelectorAll('[data-appearance-color]').forEach(button=>button.classList.toggle('is-selected',button.dataset.appearanceColor.toLowerCase()===color.toLowerCase()));
      const selected=[...root.querySelectorAll('[data-hide]:checked')].map(x=>x.closest('[data-appearance-module]')?.querySelector('.appearance-module-name')?.textContent.trim()||x.dataset.hide);
      q('#appearance-nav-preview').innerHTML='<strong>Navegación · '+(q('#c247-density').value==='compact'?'compacta':'cómoda')+'</strong>'+
        (selected.length?selected.map(label=>'<span>'+esc(moduleIcon(modules.find(m=>m.name===label)?.id||''))+' &nbsp;'+esc(label)+'</span>').join(''):'<small>No hay sistemas visibles.</small>');
      q('#appearance-nav-preview').style.setProperty('--preview-color',color);
    };
    const updateModulePicker=()=>{
      const selected=[...root.querySelectorAll('[data-hide]:checked')],names=selected.map(input=>input.closest('[data-appearance-module]')?.querySelector('.appearance-module-name')?.textContent.trim()).filter(Boolean);
      q('#appearance-module-count').textContent=selected.length+' de '+modules.length+' sistemas visibles';
      q('#appearance-module-summary').innerHTML=names.length?names.slice(0,4).map(name=>'<span>'+esc(name)+'</span>').join('')+(names.length>4?'<small>+'+(names.length-4)+' más</small>':''):'<small>No hay sistemas visibles en la barra lateral.</small>';
      root.querySelectorAll('.appearance-module-option').forEach(option=>{const checkbox=option.querySelector('[data-hide]'),state=option.querySelector('.appearance-module-state');option.classList.toggle('is-hidden',!checkbox.checked);state.textContent=checkbox.checked?'Visible':'Oculto';});
      updateAppearancePreview();
    };
    root.querySelectorAll('input,textarea,select').forEach(input=>{
      input.addEventListener('input',updateAppearancePreview);
      input.addEventListener('change',updateAppearancePreview);
    });
    root.querySelectorAll('[data-appearance-color]').forEach(button=>button.onclick=()=>{q('#c247-accent').value=button.dataset.appearanceColor;q('#c247-accent').dispatchEvent(new Event('input',{bubbles:true}));});
    q('#appearance-module-search').addEventListener('input',event=>{const term=normalize(event.target.value.trim());root.querySelectorAll('.appearance-module-option').forEach(option=>option.hidden=Boolean(term&&!option.dataset.search.includes(term)));});
    q('#appearance-modules-all').onclick=()=>{root.querySelectorAll('[data-hide]').forEach(input=>input.checked=true);updateModulePicker();};
    q('#appearance-modules-none').onclick=()=>{root.querySelectorAll('[data-hide]').forEach(input=>input.checked=false);updateModulePicker();};
    root.querySelectorAll('[data-hide]').forEach(input=>{input.addEventListener('change',updateModulePicker);});
    q('#appearance-module-picker').addEventListener('toggle',event=>q('#appearance-module-picker summary').setAttribute('aria-expanded',String(event.currentTarget.open)));
    updateModulePicker();
    q('#c247-accent').oninput=e=>document.documentElement.style.setProperty('--teal',e.target.value);
    q('#c247-save-appearance').onclick=()=>saveSettings({identity:{name:q('#c247-name').value.trim(),description:q('#c247-desc').value,logoUrl:q('#c247-logo').value||null,color:q('#c247-accent').value},dashboard:{accent:q('#c247-accent').value,density:q('#c247-density').value}});
    q('#c247-save-layout').onclick=()=>saveSettings({dashboard:{hiddenModules:[...root.querySelectorAll('[data-hide]:not(:checked)')].map(x=>x.dataset.hide),brandCaption:q('#c247-caption').value}});
  }
  async function saveSettings(body){try{const modules=st.settings?.modules;st.settings=await api('/api/guild/'+encodeURIComponent(gid())+'/settings',{method:'PUT',body:JSON.stringify(body)});st.settings.modules=modules;applyPrefs();toast('Cambios guardados en este servidor.');}catch(e){toast(e.message,true);}}
  const quick=q('#quickSwitcher');
  let quickMatches=[],quickActive=0,quickRestore=null;
  function closeQuick(restore=true){
    if(quick.hidden)return;
    quick.hidden=true;document.body.classList.remove('quick-opened');
    if(restore&&quickRestore?.isConnected)quickRestore.focus();
  }
  function navigateModule(category,event='bienvenida',command=null){
    st.category=category;st.welcomeEvent=event;
    st.levelsCommands=false;
    st.welcomeAdvanced=false;st.autoroleAdvanced=false;st.panelAdvanced=false;st.applicationAdvanced=false;st.birthdayAdvanced=false;st.replyAdvanced=false;st.achievementCommands=false;
    st.moduleTab=command?moduleKind(command):'ajustes';
    if(command){
      st.moduleCommand[category]=command.name;
      if(category==='bienvenida')st.welcomeAdvanced=true;
      if(category==='autorole')st.autoroleAdvanced=true;
      if(['ticket','verif'].includes(category))st.panelAdvanced=true;
      if(category==='application')st.applicationAdvanced=true;
      if(category==='cumple')st.birthdayAdvanced=true;
      if(category==='respondedor')st.replyAdvanced=true;
      if(category==='logro')st.achievementCommands=true;
    }
    render('module');window.scrollTo(0,0);
  }
  function quickItems(){
    const core=[['home','Resumen','Estado y accesos directos del servidor','⌂'],['activity','Actividad','Comandos, botones y formularios recientes','◷'],['commands','Explorar funciones','Directorio de módulos disponibles','◫'],['music','Música','Reproductor, cola y controles de voz','♫'],['config','Configuración','Economía, niveles y seguridad','⚙'],['personalize','Apariencia','Identidad y navegación del panel','✧']].map(([key,title,detail,icon])=>({type:'section',key,title,detail,icon,search:title+' '+detail}));
    const allCommands=st.commands.filter(c=>c.category!=='musica');
    const commands=allCommands.filter(c=>c.dashboardAvailable!==false);
    const categories=[...new Set(allCommands.map(c=>categoryAlias[c.category]||c.category))];
    const modules=categories.map(category=>{
      const list=moduleCommands(category);
      const discord=moduleDiscordCommands(category);
      return {type:'module',category,title:commandLabels[category]||category,detail:list.length+' en panel · '+discord.length+' en Discord',icon:moduleIcon(category),search:(commandLabels[category]||category)+' '+[...list,...discord].map(c=>c.name+' '+c.description+' '+(c.dashboardReason||'')).join(' ')};
    });
    if(categories.includes('bienvenida'))modules.push({type:'module',category:'bienvenida',event:'despedida',title:'Salidas',detail:'Mensajes de despedida',icon:'✥',search:'salidas despedida goodbye'});
    const actions=commands.map(command=>({type:'command',category:categoryAlias[command.category]||command.category,command,title:'/'+command.category+(command.root?'':' '+command.name),detail:command.description,icon:moduleIcon(command.category),search:command.category+' '+command.name+' '+command.description}));
    return {core,modules,actions};
  }
  function renderQuick(){
    const term=normalize(q('#quickInput').value.trim());
    const {core,modules,actions}=quickItems();
    if(term){
      const score=item=>{
        const name=normalize(item.title),detail=normalize(item.detail);
        return name===term?0:name.startsWith(term)?1:name.includes(term)?2:detail.includes(term)?3:4;
      };
      quickMatches=[...core,...modules,...actions].filter(item=>normalize(item.search).includes(term)).sort((a,b)=>score(a)-score(b)||a.title.localeCompare(b.title,'es')).slice(0,10);
    }else{
      const featured=['bienvenida','ticket','verif','nivel','mod'];
      quickMatches=[...core,...featured.map(category=>modules.find(item=>item.category===category)).filter(Boolean)];
    }
    quickActive=0;
    q('#quickResults').innerHTML=quickMatches.length?quickMatches.map((item,index)=>'<button type="button" class="quick-result'+(index===0?' active':'')+'" id="quick-result-'+index+'" role="option" aria-selected="'+(index===0?'true':'false')+'" data-quick-index="'+index+'"><span class="quick-result-icon">'+esc(item.icon)+'</span><span class="quick-result-copy"><strong>'+esc(item.title)+'</strong><small>'+esc(item.detail)+'</small></span><span class="quick-result-arrow">↗</span></button>').join(''):'<div class="quick-empty"><strong>Sin resultados para «'+esc(q('#quickInput').value.trim())+'»</strong><span>Prueba con el nombre de un módulo o comando del bot.</span></div>';
    q('#quickInput').setAttribute('aria-activedescendant',quickMatches.length?'quick-result-0':'');
  }
  function moveQuick(direction){
    if(!quickMatches.length)return;
    quickActive=(quickActive+direction+quickMatches.length)%quickMatches.length;
    q('#quickResults').querySelectorAll('[data-quick-index]').forEach((button,index)=>{const active=index===quickActive;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));if(active)button.scrollIntoView({block:'nearest'});});
    q('#quickInput').setAttribute('aria-activedescendant','quick-result-'+quickActive);
  }
  function selectQuick(index){
    const item=quickMatches[index];if(!item||!st.guild)return;
    closeQuick(false);q('#sidebar').classList.remove('open');q('#mobileOverlay').classList.remove('show');
    if(item.type==='section'){render(item.key);window.scrollTo(0,0);}
    else navigateModule(item.category,item.event||'bienvenida',item.command||null);
  }
  function openQuick(){
    if(!st.guild){q('#server-filter')?.focus();return;}
    quickRestore=document.activeElement;
    q('#sidebar').classList.remove('open');q('#mobileOverlay').classList.remove('show');
    quick.hidden=false;document.body.classList.add('quick-opened');
    q('#quickInput').value='';renderQuick();q('#quickInput').focus();
  }
  q('#quickOpen').onclick=openQuick;
  q('#quickClose').onclick=()=>closeQuick();
  quick.addEventListener('pointerdown',event=>{if(event.target===quick)closeQuick();});
  q('#quickInput').addEventListener('input',renderQuick);
  q('#quickResults').addEventListener('click',event=>{const button=event.target.closest('[data-quick-index]');if(button)selectQuick(Number(button.dataset.quickIndex));});
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();quick.hidden?openQuick():closeQuick();return;}
    if(quick.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeQuick();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();moveQuick(event.key==='ArrowDown'?1:-1);return;}
    if(event.key==='Enter'&&document.activeElement===q('#quickInput')){event.preventDefault();selectQuick(quickActive);return;}
    if(event.key==='Tab'){
      const focusable=[q('#quickClose'),q('#quickInput'),...q('#quickResults').querySelectorAll('button')];
      if(event.shiftKey&&document.activeElement===focusable[0]){event.preventDefault();focusable.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0].focus();}
    }
  });
  function render(which){
    st.active=which;
    if(which!=='music'&&st.musicPoll){clearInterval(st.musicPoll);st.musicPoll=null;}
    const title=which==='module'&&st.category==='bienvenida'?(st.welcomeEvent==='despedida'?'Salidas':'Bienvenidas'):which==='module'?(commandLabels[st.category]||st.category):({home:'Inicio',activity:'Actividad',commands:'Funciones del bot',music:'Música',config:'Estilo general',personalize:'Apariencia'})[which]||'Panel';
    q('#crumbPage').textContent=title;
    nav?.querySelectorAll('[data-c247]').forEach(button=>button.classList.toggle('active',button.dataset.c247===which));
    nav?.querySelectorAll('[data-livecat]').forEach(button=>button.classList.toggle('active',which==='module'&&button.dataset.livecat===st.category&&(st.category!=='bienvenida'||(button.dataset.event||'bienvenida')===st.welcomeEvent)));
    if(which==='home')homePage();
    else if(which==='activity')activityPage();
    else if(which==='commands')commandPage();
    else if(which==='module'&&st.category==='bienvenida'&&!st.welcomeAdvanced)welcomePage();
    else if(which==='module'&&st.category==='autorole'&&!st.autoroleAdvanced)autorolePage();
    else if(which==='module'&&['ticket','verif'].includes(st.category)&&!st.panelAdvanced)panelPage(st.category);
    else if(which==='module'&&st.category==='application'&&!st.applicationAdvanced)applicationPage();
    else if(which==='module'&&st.category==='cumple'&&!st.birthdayAdvanced)birthdayPage();
    else if(which==='module'&&st.category==='respondedor'&&!st.replyAdvanced)automaticRepliesPage();
    else if(which==='module'&&st.category==='nivel'&&!st.levelsCommands)levelsPage();
    else if(which==='module'&&st.category==='logro'&&!st.achievementCommands)achievementsDesignPage();
    else if(which==='module'){
      modulePage();
      if(st.category==='nivel'&&st.levelsCommands)root.insertAdjacentHTML('afterbegin','<button type="button" class="quiet-button back-studio" id="backToLevels">← Volver a la configuración de Niveles y XP</button>');
      q('#backToLevels')?.addEventListener('click',()=>{st.levelsCommands=false;render('module');});
      if(st.category==='logro'&&st.achievementCommands)root.insertAdjacentHTML('afterbegin','<button type="button" class="quiet-button back-studio" id="backToAchievements">← Volver al diseño de logros</button>');
      q('#backToAchievements')?.addEventListener('click',()=>{st.achievementCommands=false;render('module');});
      if(st.category==='bienvenida')root.insertAdjacentHTML('afterbegin','<button type="button" class="quiet-button back-studio" id="backToWelcome">← Volver al editor de '+(st.welcomeEvent==='despedida'?'salidas':'bienvenidas')+'</button>');
      q('#backToWelcome')?.addEventListener('click',()=>{st.welcomeAdvanced=false;render('module');});
      if(st.category==='autorole')root.insertAdjacentHTML('afterbegin','<button type="button" class="quiet-button back-studio" id="backToAutoroles">← Volver a autoroles</button>');
      q('#backToAutoroles')?.addEventListener('click',()=>{st.autoroleAdvanced=false;render('module');});
      if(['ticket','verif'].includes(st.category))root.insertAdjacentHTML('afterbegin','<button type="button" class="quiet-button back-studio" id="backToPanel">← Volver al diseño del panel</button>');
      q('#backToPanel')?.addEventListener('click',()=>{st.panelAdvanced=false;render('module');});
      if(st.category==='application')root.insertAdjacentHTML('afterbegin','<button type="button" class="quiet-button back-studio" id="backToApplication">← Volver a postulaciones</button>');
      q('#backToApplication')?.addEventListener('click',()=>{st.applicationAdvanced=false;render('module');});
      if(st.category==='cumple')root.insertAdjacentHTML('afterbegin','<button type="button" class="quiet-button back-studio" id="backToBirthday">← Volver a cumpleaños</button>');
      q('#backToBirthday')?.addEventListener('click',()=>{st.birthdayAdvanced=false;render('module');});
      if(st.category==='respondedor')root.insertAdjacentHTML('afterbegin','<button type="button" class="quiet-button back-studio" id="backToReplies">← Volver a respuestas</button>');
      q('#backToReplies')?.addEventListener('click',()=>{st.replyAdvanced=false;render('module');});
    }
    else if(which==='music')musicPage();
    else if(which==='config')configPage();
    else customizePage();
    if(which==='module')renderDiscordActions(st.category);
  }
  document.addEventListener('click',event=>{
    const moduleLink=event.target.closest('[data-livecat],[data-open-module]');
    if(moduleLink){
      event.preventDefault();q('#sidebar').classList.remove('open');q('#mobileOverlay').classList.remove('show');
      navigateModule(moduleLink.dataset.livecat||moduleLink.dataset.openModule,moduleLink.dataset.event||'bienvenida');return;
    }
    const section=event.target.closest('[data-c247]');
    if(section){
      event.preventDefault();q('#sidebar').classList.remove('open');q('#mobileOverlay').classList.remove('show');
      if(!st.guild)return toast('No hay un servidor seleccionado.',true);
      render(section.dataset.c247);window.scrollTo(0,0);
    }
  },true);
  q('#motionToggle').onclick=()=>{const paused=document.body.classList.toggle('motion-paused');q('#motionToggle').setAttribute('aria-pressed',String(!paused));q('#motionToggle').innerHTML=paused?'✦ &nbsp;Animación pausada':'✦ &nbsp;Animación activa';};
  async function init(){try{const s=await api('/api/session');st.ready=true;if(!s.authenticated){location.replace('/');return;}st.user=s.user;q('#profileName').textContent=s.user.username;showSessionAvatar(q('#sessionAvatar'));const d=await api('/api/guilds');st.guilds=d.guilds||[];addNav();const selected=serverPath();if(selected&&st.guilds.some(g=>g.id===selected))await loadGuild(selected,false);else chooseServer(false);updateContext();}catch(e){gate('No se pudo cargar el panel: '+e.message,null);}}
  window.addEventListener('popstate',()=>{if(!st.ready||!st.user)return;const selected=serverPath();if(selected&&st.guilds.some(g=>g.id===selected))loadGuild(selected,false);else chooseServer(false);});
  init();
})();
