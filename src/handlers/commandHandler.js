'use strict';
const { categoryFor } = require('../commands/categories');
function registerCommand(registry, cat, name, desc, spec, perm, run) {
  if (typeof run !== 'function') throw new TypeError(`Comando inválido: ${cat}.${name}`);
  const parsed = spec ? spec.split(',').map(x => {
    const match = x.match(/^(\w+):(\w)(!?)$/);
    if (!match) throw new Error(`Opción inválida en ${cat}.${name}: ${x}`);
    return { n: match[1], t: match[2], r: Boolean(match[3]) };
  }) : [];
  (registry[cat] ??= {})[name] = { desc, perm, run, spec: parsed, category: categoryFor(cat) };
}
module.exports = { registerCommand };
