'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
function load(env) {
 const stdout = execFileSync(process.execPath, ['-e', `const c=require('./src/config/load'); process.stdout.write(JSON.stringify({token:c.discord.token,id:c.discord.clientId,redirect:c.dashboard.redirectUri,port:c.dashboard.port,yt:c.music.ytDlpPath,db:c.mongodb.database}))`], {
  cwd:root, encoding:'utf8', env:{...process.env,PORT:'',APP_URL:'',...env}
 });
 return JSON.parse(stdout);
}
test('Local: config.json es fuente de credenciales y callback localhost', () => {
 const c=load({DISCORD_TOKEN:'injected_ignore',DASHBOARD_CLIENT_SECRET:'ignore'});
 assert.equal(c.token,'');
 assert.equal(c.redirect,'http://localhost:3000/auth/callback');
 assert.equal(c.port,3000);
 assert.equal(c.db,'club247');
 if(process.platform!=='win32') assert.equal(c.yt,'yt-dlp');
});
test('FadeHost: respeta exclusivamente PORT y APP_URL del proveedor', () => {
 const c=load({PORT:'4567',APP_URL:'https://club247.example.invalid/',MONGODB_URI:'ignore'});
 assert.equal(c.port,4567);
 assert.equal(c.redirect,'https://club247.example.invalid/auth/callback');
 assert.equal(c.token,'');
});
