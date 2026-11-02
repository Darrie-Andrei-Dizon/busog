// Turn pasted recipe text into ingredients matched to foods. Pure functions.

const FRACTIONS = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };
const UNIT_ALIASES = [
  ['kg', /^(kg|kgs|kilo|kilos|kilogram|kilograms)$/],
  ['g', /^(g|gm|gms|gram|grams|grm)$/],
  ['ml', /^(ml|mls|milliliter|milliliters)$/],
  ['l', /^(l|liter|liters|litre|litres)$/],
  ['cup', /^(cup|cups|c)$/],
  ['tbsp', /^(tbsp|tbsps|tablespoon|tablespoons|tbs|tbl|kutsara)$/],
  ['tsp', /^(tsp|tsps|teaspoon|teaspoons|kutsarita)$/],
  ['clove', /^(clove|cloves|butil)$/],
  ['head', /^(head|heads|ulo)$/],
  ['can', /^(can|cans|lata)$/],
  ['pack', /^(pack|packs|pouch|pouches|sachet|sachets|bundle|bundles)$/],
  ['piece', /^(pc|pcs|piece|pieces|whole|medium|large|small|thumb|stalk|stalks|bunch|bunches|slice|slices|ear|ears|block|blocks)$/],
];

function parseQuantity(text) {
  let t = text.trim();
  for (const [ch, v] of Object.entries(FRACTIONS)) t = t.replace(new RegExp(`(\\d)\\s*${ch}`), (_, d) => `${Number(d) + v}`).replace(ch, String(v));
  const m = t.match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+)|\/(\d+))?(?:\s*(?:-|to)\s*(\d+(?:\.\d+)?))?/);
  if (!m) return { qty: null, rest: text.trim() };
  let qty = Number(m[1]);
  if (m[2]) qty += Number(m[2]) / Number(m[3]);
  if (m[4]) qty /= Number(m[4]);
  if (m[5]) qty = (qty + Number(m[5])) / 2; // "2-3" becomes 2.5
  return { qty, rest: t.slice(m[0].length).trim() };
}

const singular = (w) => (w.length > 3 && w.endsWith('es') && /(oes|ches|shes)$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (s) => s.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-zñ\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1).map(singular);
const STOP = new Set(['of', 'and', 'or', 'to', 'the', 'a', 'an', 'for', 'into', 'cut', 'sliced', 'chopped', 'minced', 'diced', 'fresh', 'raw', 'cooked', 'about', 'optional', 'taste', 'peeled', 'ng', 'na', 'at', 'pcs', 'pc', 'cups', 'cup', 'tbsp', 'tsp', 'g', 'kg', 'grams']);

// Score how well a food's name and aliases match the line's words.
export function matchFood(text, foods) {
  const lineWords = words(text).filter((w) => !STOP.has(w));
  if (!lineWords.length) return null;
  let best = null;
  for (const f of foods) {
    const names = [f.name, ...(f.aliases || [])];
    let score = 0;
    for (const n of names) {
      const nw = words(n.split(',')[0]).filter((w) => !STOP.has(w));
      if (!nw.length) continue;
      const hits = nw.filter((w) => lineWords.some((lw) => lw === w || (w.length > 3 && (lw.startsWith(w) || w.startsWith(lw))))).length;
      const covered = hits && lineWords.every((lw) => nw.some((w) => w === lw || (w.length > 3 && (lw.startsWith(w) || w.startsWith(lw)))));
      const s = hits / nw.length + (hits === nw.length ? 0.5 : 0) + hits * 0.1 + (covered ? 0.3 : 0) - (f.placeId ? 0.2 : 0);
      if (s > score) score = s;
    }
    if (score > 0.6 && (!best || score > best.score)) best = { food: f, score };
  }
  return best?.food || null;
}

// Grams for a quantity and unit of a food, using its named portions.
export function toGrams(food, qty, unit) {
  if (qty == null) qty = 1;
  if (unit === 'g' || unit === 'ml') return qty;
  if (unit === 'kg' || unit === 'l') return qty * 1000;
  const portions = food.portions || [];
  const find = (rx) => portions.find((p) => rx.test(p.label) && p.grams);
  const byUnit = {
    cup: /cup/, tbsp: /tbsp/, tsp: /tsp/, clove: /clove/, head: /head/, can: /can/, pack: /pack|bundle|sachet/,
    piece: /piece|medium|large|small|thumb|fillet|ear|block|bunch|slice|belly|handful/,
  };
  if (unit && byUnit[unit]) {
    const p = find(byUnit[unit]);
    if (p) {
      const n = Number((p.label.match(/^([\d.½¼¾⅓]+)/) || [])[1]?.replace('½', '0.5').replace('¼', '0.25').replace('¾', '0.75')) || 1;
      return (qty * p.grams) / n;
    }
    // Common fallbacks when the food has no matching unit.
    const fallback = { cup: 240, tbsp: 15, tsp: 5 };
    if (fallback[unit]) return qty * fallback[unit];
    return null;
  }
  // No unit: use the food's first named portion ("2 eggs" = 2 × 1 large).
  const first = portions.find((p) => p.grams);
  return first ? qty * first.grams : null;
}

/* Parse recipe text. Returns { name, servings, lines: [{ text, food, grams, qty, unit }] }. */
export function parseRecipe(text, foods) {
  const raw = text.split(/\r?\n/).map((l) => l.replace(/^[\s\-*•·▪◦–]+|\s+$/g, '')).filter(Boolean);
  let name = '';
  let servings = null;
  const lines = [];
  for (const line of raw) {
    const serv = line.match(/(?:serves|servings?|makes|good for)\s*:?\s*(\d+)/i) || line.match(/(\d+)\s*(?:servings|serving|portions)/i);
    if (serv && !servings) { servings = Number(serv[1]); if (line.length < 30) continue; }
    if (/^(ingredients|procedure|instructions|directions|method|steps)\s*:?$/i.test(line)) continue;
    const { qty, rest } = parseQuantity(line);
    if (qty == null && !name && lines.length === 0 && line.length < 60 && !/\d/.test(line)) { name = line; continue; }
    if (/^\d+[.)]\s/.test(line) && qty != null && rest.split(' ').length > 6) continue; // numbered instruction step
    let unit = null; let body = rest;
    const firstWord = (rest.split(/\s+/)[0] || '').toLowerCase().replace(/[.,]$/, '');
    for (const [u, rx] of UNIT_ALIASES) if (rx.test(firstWord)) { unit = u; body = rest.slice(rest.indexOf(' ') + 1 || rest.length); break; }
    if (qty == null && !unit) {
      // A line without an amount: only keep it if it names a food.
      const food = matchFood(line, foods);
      if (food && line.split(/\s+/).length <= 6) lines.push({ text: line, food, qty: null, unit: null, grams: null });
      continue;
    }
    const food = matchFood(body, foods);
    lines.push({ text: line, food, qty, unit, grams: food ? toGrams(food, qty, unit) : null });
  }
  return { name, servings, lines };
}
