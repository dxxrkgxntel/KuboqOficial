'use strict';

const { EmbedBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  TextDisplayBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');

const FORMATS = Object.freeze(['embed', 'components_v2', 'card', 'text']);
const validFormat = value => FORMATS.includes(value) ? value : 'embed';
const colorValue = value => Number.isInteger(value) ? value : /^#[0-9a-f]{6}$/i.test(value || '') ? parseInt(value.slice(1), 16) : 0xff3159;
const safeImage = value => /^https?:\/\/[^\s"'<>]+$/i.test(value || '') ? value : null;

function drawCard(title, description, footer, color) {
  const canvas = createCanvas(1000, 540), ctx = canvas.getContext('2d');
  const hex = '#' + color.toString(16).padStart(6, '0');
  const background = ctx.createLinearGradient(0, 0, 1000, 540);
  background.addColorStop(0, '#100d13'); background.addColorStop(.65, '#231019'); background.addColorStop(1, '#08090d');
  ctx.fillStyle = background;ctx.fillRect(0, 0, 1000, 540);
  ctx.fillStyle = hex;ctx.fillRect(0, 0, 9, 540);
  ctx.globalAlpha = .16;ctx.beginPath();ctx.arc(840, 100, 210, 0, Math.PI * 2);ctx.fill();ctx.globalAlpha = 1;
  ctx.strokeStyle = '#5b3541';ctx.lineWidth = 2;ctx.strokeRect(25, 25, 950, 490);
  ctx.fillStyle = '#f8d8e2';ctx.font = '700 22px sans-serif';ctx.fillText('KUBOQ  ·  SERVIDOR', 57, 82);
  const wrap = (value, maxWidth, limit) => {
    const lines = [];
    for (const paragraph of String(value || '').replace(/\*\*/g, '').split('\n')) {
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        const trial = current ? current + ' ' + word : word;
        if (current && ctx.measureText(trial).width > maxWidth) { lines.push(current);current = word; } else current = trial;
      }
      lines.push(current);
      if (lines.length >= limit) break;
    }
    return lines.slice(0, limit);
  };
  ctx.fillStyle = '#fff';ctx.font = '800 43px sans-serif';
  const titleLines=wrap(title, 872, 2);titleLines.forEach((line,index)=>ctx.fillText(line, 57, 155 + index * 49));
  const bodyY=185 + titleLines.length * 49;
  ctx.font = '24px sans-serif';ctx.fillStyle = '#e1cbd1';
  wrap(description, 870, 7).forEach((line,index)=>ctx.fillText(line, 57, bodyY + index * 38));
  ctx.fillStyle = hex;ctx.fillRect(57, 474, 75, 4);
  ctx.font = '19px sans-serif';ctx.fillStyle = '#c9aeba';
  ctx.fillText(String(footer || 'KUBOQ').slice(0, 72), 57, 500);
  return canvas.toBuffer('image/png');
}

async function buildMessage(data) {
  const format=validFormat(data.format), color=colorValue(data.color), title=String(data.title||'').slice(0,256);
  const description=String(data.description||'').slice(0,4000), content=String(data.content||'').slice(0,1900);
  const banner=safeImage(data.banner), image=safeImage(data.image), thumb=safeImage(data.thumbnail);
  const footer=String(data.footer||'').slice(0,2048), author=String(data.author||'').slice(0,256);
  const rows=data.components||[], allowedMentions=data.allowedMentions||{parse:[]};
  if(format==='text') {
    const parts=[content,title&&`**${title}**`,description,banner,image,thumb,footer&&`— ${footer}`].filter(Boolean);
    return {content:parts.join('\n\n').slice(0,2000)||' ',components:rows,allowedMentions};
  }
  if(format==='components_v2') {
    const container=new ContainerBuilder().setAccentColor(color);
    const addText=value=>{if(value)container.addTextDisplayComponents(new TextDisplayBuilder().setContent(value.slice(0,4000)));};
    addText(content);if(banner)container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)));
    addText([author&&`-# ${author}`,title&&`## ${title}`,description].filter(Boolean).join('\n'));
    if(image)container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image)));
    if(thumb&&!image)container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(thumb)));
    addText(footer&&`-# ${footer}`);
    for(const row of rows)container.addActionRowComponents(row);
    return {components:[container],flags:MessageFlags.IsComponentsV2,allowedMentions};
  }
  if(format==='card') {
    const file=new AttachmentBuilder(drawCard(title,description,footer,color),{name:'club247-card.png'});
    return {content:content||undefined,files:[file],components:rows,allowedMentions};
  }
  const embed=new EmbedBuilder().setColor(color);
  if(title)embed.setTitle(title);if(description)embed.setDescription(description);
  if(image)embed.setImage(image);if(thumb)embed.setThumbnail(thumb);
  if(footer)embed.setFooter({text:footer});if(author)embed.setAuthor({name:author});
  const embeds=banner?[new EmbedBuilder().setColor(color).setImage(banner),embed]:[embed];
  return {content:content||undefined,embeds,components:rows,allowedMentions};
}

module.exports={FORMATS,validFormat,buildMessage};
