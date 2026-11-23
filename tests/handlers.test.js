const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createEventHandler } = require('../src/handlers/eventHandler');
const { registerCommand } = require('../src/handlers/commandHandler');
const { getIdentity, setIdentity } = require('../src/services/identity');
test('handler de eventos registra y emite', () => { const c = new EventEmitter(); const h = createEventHandler(c); let n=0; h.on('hello',()=>n++); h.once('once',()=>n++); c.emit('hello');c.emit('once');c.emit('once');assert.equal(n,2); });
test('comandos se registran y clasifican',()=>{const r={};registerCommand(r,'mod','ban','Banear','usuario:u!',null,()=>{});assert.equal(r.mod.ban.category,'moderacion');assert.equal(r.mod.ban.spec[0].r,true);});
test('identidad separada por guild',()=>{const db={a:{},b:{}};let saves=0;setIdentity(db,'a',{name:'A'},()=>saves++);assert.equal(getIdentity(db,'a').name,'A');assert.notEqual(getIdentity(db,'b').name,'A');assert.equal(saves,1);});
