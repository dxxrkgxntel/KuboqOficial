'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
test('La aplicación mantiene config.json como fuente de credenciales',()=>{
 const src=read('src/config/load.js');
 assert.match(src,/configPath/);
 assert.doesNotMatch(src,/process\.env\.DISCORD_TOKEN|env\.DISCORD_TOKEN/);
 assert.match(src,/process\.env\.PORT/);
});
test('El panel enlaza acciones reales, mantiene catálogo y no expone secretos en HTML',()=>{
  const integration=read('src/dashboard/public/assets/integration.js');
  const server=read('src/dashboard/server.js');
  const html=read('src/dashboard/public/index.html');
  assert.match(integration,/renderCatalogNav\(\)/);assert.doesNotMatch(integration,/function openLiveModule\(/);assert.doesNotMatch(html,/Luna Rivera|205 miembros|Canales más activos/);
  assert.match(integration,/function configPage\(/);assert.match(integration,/data-livecat/);
  assert.match(server,/\/api\/guild\/:id\/commands\/run/);
  assert.match(server,/\/api\/guild\/:id\/settings/);
  assert.match(server,/getAuthorizedGuild/);
  assert.doesNotMatch(html,/DASHBOARD_SESSION_SECRET\s*=.+[^\s]/);
});
