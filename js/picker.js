// "Pick for me": choose a meal from restaurant menus, recipes and leftovers
// based on cravings, ingredients on hand and calories left. Pure functions.

// Cravings come in groups. Within a group any match counts (chicken OR pork);
// across groups every group must match (chicken AND noodles AND light).
export const WANT_GROUPS = [
  { id: 'protein', label: 'Main ingredient', options: [['chicken', 'Chicken'], ['pork', 'Pork'], ['beef', 'Beef'], ['fish', 'Fish'], ['egg', 'Egg'], ['veg', 'Veggies']] },
  { id: 'style', label: 'Kind of meal', options: [['rice', 'Rice meal'], ['noodles', 'Noodles'], ['bread', 'Burger or sandwich'], ['pizza', 'Pizza'], ['soup', 'Soup'], ['fried', 'Fried'], ['grilled', 'Grilled or roasted'], ['sweet', 'Something sweet']] },
  { id: 'body', label: 'How it should feel', options: [['light', 'Light'], ['protein', 'High protein']] },
  { id: 'tools', label: 'Time and equipment', cookOnly: true, options: [['quick', '15 minutes or less'], ['nocook', 'No stove'], ['microwave', 'Microwave'], ['ricecooker', 'Rice cooker'], ['airfryer', 'Air fryer'], ['onepan', 'One pan or pot']] },
];

// Tags from a recipe's time and equipment.
export function toolTags(minutes, tools = []) {
  const t = [];
  if (minutes && minutes <= 15) t.push('quick');
  const map = { 'No stove': 'nocook', Microwave: 'microwave', 'Rice cooker': 'ricecooker', 'Air fryer': 'airfryer', 'One pan': 'onepan', 'One pot': 'onepan' };
  for (const tool of tools) if (map[tool]) t.push(map[tool]);
  return t;
}

const RX = {
  chicken: /chicken|manok|nugget|tinola/,
  pork: /pork|baboy|liempo|sausage|giniling|longganisa|sisig|tocino|sinigang|\bham\b|bacon/,
  beef: /beef|big mac|quarter pounder|cheeseburger|burger mcdo|\byum\b|burgersteak|tapa|bistek|bulalo|corned/,
  fish: /fish|filet|tilapia|bangus|tuna|isda|sardin|hipon|shrimp/,
  egg: /\beggs?\b|itlog|torta|silog|omelette|eggdesal/,
  veg: /pinakbet|gulay|vegetable|monggo|kangkong|talong|eggplant|ampalaya|chopsuey|laing|salad/,
  rice: /rice|platter|silog|kanin|sinangag|chao fan/,
  noodles: /spaghetti|palabok|pancit|noodle|mami|canton|bihon/,
  bread: /burger(?!steak)|pounder|sandwich|mcmuffin|eggdesal|pandesal|\byum\b|big mac|hotdog|toast/,
  soup: /soup|sinigang|tinola|bulalo|nilaga|mami|lomi|monggo/,
  pizza: /pizza/,
  fried: /fried|crispy|chickenjoy|nugget|katsu|wings|lumpia|shanghai|zinger|torta|fries|mojos|tokwa/,
  grilled: /inasal|grill|bbq|barbecue|litson|lechon|roast|inihaw/,
  sweet: /pie|sundae|mcflurry|hotcake|halo|leche|turon|cake|ice cream/,
};
const SIDE_RX = /^(steamed rice|extra rice|gravy|jolly crispy fries|french fries|fries|mashed potato|hash browns?|mojos|chicken oil)\b/;
const DESSERT_RX = /\bpie\b|sundae|mcflurry|halo-halo|ice cream|\bcake\b|leche flan/;
const DRINK_RX = /quencher|coke|cola|iced tea|coffee|juice|float|milk tea/;

export const PROTEIN_CATS = ['protein'];
export const VEG_CATS = ['vegetable'];

const has = (rx, text) => rx.test(text);

// Tags and role for one candidate, from its name, ingredients and numbers.
export function describe({ name, extraText = '', category, kcal, protein, ingredientCats = null, presetTags = [] }) {
  const text = `${name} ${extraText}`.toLowerCase();
  const tags = new Set(presetTags);
  for (const [tag, rx] of Object.entries(RX)) if (has(rx, text)) tags.add(tag);
  if (ingredientCats && ingredientCats.vegShare >= 0.35) tags.add('veg');
  if (kcal > 0 && kcal <= 400) tags.add('light');
  if (protein >= 20 && (protein * 4) / Math.max(kcal, 1) >= 0.25) tags.add('protein');
  const lower = name.toLowerCase();
  let role = 'main';
  if (category === 'drink' || has(DRINK_RX, lower)) role = 'drink';
  else if (has(SIDE_RX, lower)) role = 'side';
  else if (has(DESSERT_RX, lower)) role = 'dessert';
  if (role === 'dessert') tags.add('sweet');
  return { tags, role };
}

export function matchesWants(tags, wants) {
  for (const group of WANT_GROUPS) {
    const picked = group.options.map(([k]) => k).filter((k) => wants.includes(k));
    if (picked.length && !picked.some((k) => tags.has(k))) return false;
  }
  return true;
}

// Share of a recipe's ingredients you have. Pantry items count as on hand
// when "basics" is on.
export function coverage(recipeIngredientIds, haveIds, pantryIds, basics) {
  const required = recipeIngredientIds.filter((id) => !(basics && pantryIds.has(id)));
  if (!required.length) return { have: 0, total: 0, ratio: 1, missing: [] };
  const missing = required.filter((id) => !haveIds.has(id));
  return { have: required.length - missing.length, total: required.length, ratio: (required.length - missing.length) / required.length, missing };
}

/* Filter and weight candidates.
   candidates: [{ key, kind: 'food'|'recipe'|'batch', name, kcal, protein, tags:Set, role, ingredientIds?, eatenRecently }]
   opts: { source: 'cook'|'out'|'either', wants: [], haveIds: Set, pantryIds: Set, basics, budget (kcal or null), places: [] } */
export function rank(candidates, opts) {
  const out = [];
  const wantsSweet = opts.wants.includes('sweet');
  for (const c of candidates) {
    const isOut = c.kind === 'food';
    if (opts.source === 'cook' && isOut) continue;
    if (opts.source === 'out' && !isOut) continue;
    if (isOut && opts.places?.length && !opts.places.includes(c.placeId)) continue;
    if (c.role === 'drink' || c.role === 'side') continue;
    if (c.role === 'dessert' && !wantsSweet) continue;
    if (!matchesWants(c.tags, opts.wants)) continue;
    if (opts.budget != null && c.kcal > opts.budget * 1.05) continue;
    if (opts.maxCost && (c.cost == null || c.cost > opts.maxCost)) continue;
    let cov = null;
    if (c.kind === 'recipe' && opts.haveIds.size) {
      cov = coverage(c.ingredientIds, opts.haveIds, opts.pantryIds, opts.basics);
      if (cov.ratio < 0.5) continue;
    }
    let weight = 1;
    weight += opts.wants.filter((w) => c.tags.has(w)).length * 0.5;
    if (cov) weight += cov.ratio * 3;
    if (c.kind === 'batch') weight += 2.5; // finish the pot first
    if (c.eatenRecently) weight *= 0.35;
    out.push({ ...c, coverage: cov, weight });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

// Weighted random choice, skipping anything already shown this round.
export function draw(ranked, seen = [], rand = Math.random) {
  let pool = ranked.filter((c) => !seen.includes(c.key));
  if (!pool.length) pool = ranked;
  if (!pool.length) return null;
  const total = pool.reduce((s, c) => s + c.weight, 0);
  let r = rand() * total;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return pool.at(-1);
}
