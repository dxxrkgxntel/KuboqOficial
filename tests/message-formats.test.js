'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder,MessageFlags}=require('discord.js');
const {buildMessage}=require('../src/services/messageFormats');

const row=()=>new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verif').setLabel('Verificarme').setStyle(ButtonStyle.Success));
const data={title:'Bienvenido',description:'Hola a Kuboq',color:'#ff3159',components:[row()]};

test('los cuatro formatos producen mensajes válidos y conservan el botón',async()=>{
  const embed=await buildMessage({...data,format:'embed'});
  assert.equal(embed.embeds[0].toJSON().color,0xff3159);
  assert.equal(embed.components[0].toJSON().components[0].custom_id,'verif');

  const v2=await buildMessage({...data,format:'components_v2'});
  assert.equal(v2.flags,MessageFlags.IsComponentsV2);
  assert.equal(v2.content,undefined);assert.equal(v2.embeds,undefined);
  assert.ok(JSON.stringify(v2.components[0].toJSON()).includes('verif'));

  const card=await buildMessage({...data,format:'card'});
  assert.equal(card.files[0].name,'club247-card.png');
  assert.equal(card.files[0].attachment.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(card.components[0].toJSON().components[0].custom_id,'verif');

  const text=await buildMessage({...data,format:'text'});
  assert.match(text.content,/Bienvenido/);
  assert.equal(text.components[0].toJSON().components[0].custom_id,'verif');
});

test('Components V2 conserva un menú de tickets y las imágenes',async()=>{
  const menu=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('tk_menu').setPlaceholder('Elige el tipo').addOptions({label:'Soporte',value:'soporte'}));
  const payload=await buildMessage({format:'components_v2',title:'Soporte',description:'Elige una opción',banner:'https://example.com/banner.png',components:[menu]});
  const json=payload.components[0].toJSON();
  assert.equal(payload.flags,MessageFlags.IsComponentsV2);
  assert.ok(JSON.stringify(json).includes('tk_menu'));
  assert.ok(JSON.stringify(json).includes('https://example.com/banner.png'));
});
