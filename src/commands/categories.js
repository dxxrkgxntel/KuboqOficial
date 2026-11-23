'use strict';
const groups = {
  administracion: ['anuncio','autorole','bienvenida','estado','logs','stats','seg','verif','application'],
  moderacion: ['mod','limpiar','ticket'],
  economia: ['eco','daily','work','fishing'],
  comunidad: ['cumple','confesion','logro','nivel','invite','bump','starboard','respondedor'],
  multimedia: ['pinterest','ia','voz','vozbot'],
  publicos: ['util','links','halloween','truco-trato'],
};
function categoryFor(cat) { return Object.entries(groups).find(([, names]) => names.includes(cat))?.[0] || 'otros'; }
module.exports = { groups, categoryFor };
