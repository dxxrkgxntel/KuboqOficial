'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {MessageFlags}=require('discord.js');
const installExtras=require('../extras');

test('cumpleaños y respuestas automáticas envían el formato guardado',async()=>{
  const RealDate=Date,realInterval=global.setInterval,callbacks=[],handlers={},sent=[],replied=[];
  global.Date=class extends RealDate {constructor(...args){super(...(args.length?args:['2026-11-22T16:00:00Z']));}};
  global.setInterval=callback=>{callbacks.push(callback);return {unref(){}};};
  try{
    const db={g1:{birthdays:{u1:{dia:22,mes:11}},cumplech:'c1',autoresp:{hola:'Hola de vuelta'},cfg:{color:'#ff3159',birthdayMessage:'Felicidades {users} en {server}',messageFormats:{cumple:'components_v2',respondedor:'card'}}}};
    const client={on:(event,handler)=>{handlers[event]=handler;},users:{cache:new Map([['u1',{username:'Bryant'}]])},guilds:{cache:new Map([['g1',{name:'Family'}]])},channels:{cache:new Map([['c1',{send:payload=>{sent.push(payload);return Promise.resolve();}}]])}};
    installExtras({client,DB:db,def:()=>{},G:id=>db[id],save:()=>{}});
    callbacks[0]();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sent.length,1);
    assert.equal(sent[0].flags,MessageFlags.IsComponentsV2);
    assert.ok(JSON.stringify(sent[0].components[0].toJSON()).includes('Felicidades Bryant en Family'));
    handlers.messageCreate({guild:{id:'g1'},author:{bot:false},content:'hola',reply:payload=>{replied.push(payload);return Promise.resolve();}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(replied.length,1);
    assert.equal(replied[0].files[0].attachment.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.deepEqual(replied[0].allowedMentions,{parse:[],repliedUser:false});
  }finally{global.Date=RealDate;global.setInterval=realInterval;}
});
