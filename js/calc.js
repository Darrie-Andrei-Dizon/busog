// Pure nutrition math. No DOM, no storage, so it can be tested in Node.

export const KEYS = ['kcal', 'protein', 'carbs', 'fat'];
export const ZERO = Object.freeze({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
export const KCAL_FLOOR = 1200;

export function pick(n) {
  return {
    kcal: Number(n?.kcal) || 0,
    protein: Number(n?.protein) || 0,
    carbs: Number(n?.carbs) || 0,
    fat: Number(n?.fat) || 0,
  };
}

export function scale(n, k) {
  const o = {};
  for (const key of KEYS) o[key] = (Number(n?.[key]) || 0) * k;
  return o;
}

export function add(...list) {
  const o = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const n of list) for (const k of KEYS) o[k] += Number(n?.[k]) || 0;
  return o;
}

export function round1(n) {
  const o = {};
  for (const k of KEYS) o[k] = Math.round((Number(n?.[k]) || 0) * 10) / 10;
  return o;
}

// Hand-size portions for people without a scale. A fist is about a cup,
// a palm of meat or fish is about 100 g, a thumb is about a tablespoon.
const findPortion = (food, rx) => (food.portions || []).find((p) => rx.test(p.label) && p.grams);
export function handPortions(food) {
  if (food.basis === 'per_serving') return [];
  const cup = findPortion(food, /^1 cup/);
  const tbsp = findPortion(food, /^1 tbsp/);
  switch (food.category) {
    case 'grain': return [{ id: 'h-fist', label: '1 fist (about 1 cup)', grams: cup?.grams ?? 150 }];
    case 'protein': return /egg/i.test(food.name) ? [] : [{ id: 'h-palm', label: '1 palm (about 100 g)', grams: 100 }];
    case 'vegetable':
    case 'fruit': return [{ id: 'h-fist', label: '1 fist (about 1 cup)', grams: cup?.grams ?? 90 }];
    case 'oil':
    case 'sauce':
    case 'sweet': return [{ id: 'h-thumb', label: '1 thumb (about 1 tbsp)', grams: tbsp?.grams ?? 14 }];
    case 'dish': return [{ id: 'h-fist', label: '1 fist (about 1 cup)', grams: 200 }];
    default: return food.name.toLowerCase().includes('peanut butter') ? [{ id: 'h-thumb', label: '1 thumb (about 1 tbsp)', grams: tbsp?.grams ?? 16 }] : [];
  }
}
export const FIST_OF_DISH_G = 200;

// Grams for a quantity of a named portion. 'g' means the quantity is grams.
export function portionGrams(food, portionId, quantity) {
  const q = Number(quantity) || 0;
  if (portionId === 'g') return q;
  const p = (food.portions || []).find((x) => x.id === portionId) || handPortions(food).find((x) => x.id === portionId);
  if (!p || p.grams == null) return null;
  return p.grams * q;
}

// Sodium (mg) for an amount of a food, or null when the food has no data.
export function sodiumFor(food, { grams = 0, servings = 0 } = {}) {
  if (food?.sodium == null) return null;
  return food.basis === 'per_serving' ? food.sodium * servings : (food.sodium * grams) / 100;
}

export function recipeSodium(recipe, foodById) {
  return (recipe.ingredients || []).reduce((s, i) => s + (sodiumFor(foodById(i.foodId), { grams: i.grams }) || 0), 0);
}

// Cost in pesos. A price is { amount, grams } for "amount for this many grams",
// or { amount } alone for a per-serving item.
export function costFor(food, { grams = 0, servings = 0 } = {}) {
  const p = food?.price;
  if (!p || !(p.amount > 0)) return null;
  if (food.basis === 'per_serving') return p.amount * servings;
  return p.grams > 0 ? (p.amount * grams) / p.grams : null;
}

// Recipe cost: { total, priced, unpriced: [foodIds] }. Pantry extras like
// salt don't block a cost, but they are listed as unpriced.
export function recipeCost(recipe, foodById) {
  let total = 0; let priced = 0; const unpriced = [];
  for (const i of recipe.ingredients || []) {
    const c = costFor(foodById(i.foodId), { grams: i.grams });
    if (c == null) unpriced.push(i.foodId); else { total += c; priced += 1; }
  }
  return { total, priced, unpriced };
}

// Nutrition for an amount of a food.
// per_100g foods scale by grams; per_serving foods (chain menu items
// published without a weight) scale by number of servings.
export function forFood(food, { grams = 0, servings = 0 } = {}) {
  if (food.basis === 'per_serving') return scale(pick(food), servings);
  return scale(pick(food), grams / 100);
}

export function recipeTotals(recipe, foodById) {
  return add(
    ...(recipe.ingredients || []).map((ing) => {
      const f = foodById(ing.foodId);
      return f ? forFood(f, { grams: ing.grams || 0 }) : ZERO;
    }),
  );
}

export function recipeRawWeight(recipe) {
  return (recipe.ingredients || []).reduce((s, i) => s + (Number(i.grams) || 0), 0);
}

export function perServing(totals, servings) {
  return servings > 0 ? scale(totals, 1 / servings) : { ...ZERO };
}

// Share of a batch already eaten, from batch_fraction on log entries.
export function batchUsed(batch, logs) {
  return logs
    .filter((l) => l.batchId === batch.id)
    .reduce((s, l) => s + (Number(l.batchFraction) || 0), 0);
}

export function batchLeft(batch, logs) {
  return Math.max(0, 1 - batchUsed(batch, logs));
}

export function entryTotal(e) {
  return add(pick(e), ...(e.extras || []).map(pick));
}

export function dayTotal(logs, date) {
  return add(...logs.filter((l) => l.date === date).map(entryTotal));
}

// The goal in force on a date: the latest one starting on or before it.
// Days before the first goal fall back to the earliest goal.
export function goalOn(goals, date) {
  if (!goals.length) return null;
  const sorted = [...goals].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
  let current = sorted[0];
  for (const g of sorted) if (g.effectiveFrom <= date) current = g;
  return current;
}

export function localDate(dt = new Date()) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateAdd(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// Last 7 days ending on endDate. Averages divide by days that have at
// least one entry, so a skipped day does not count as zero calories.
export function weekStats(logs, endDate) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(dateAdd(endDate, -i));
  const perDay = days.map((date) => {
    const entries = logs.filter((l) => l.date === date);
    return { date, total: add(...entries.map(entryTotal)), count: entries.length };
  });
  const logged = perDay.filter((d) => d.count > 0);
  const sum = add(...logged.map((d) => d.total));
  const weekEntries = logs.filter((l) => l.date >= days[0] && l.date <= endDate);
  const outKcal = weekEntries
    .filter((l) => l.origin && l.origin !== 'home')
    .reduce((s, l) => s + entryTotal(l).kcal, 0);
  const estKcal = weekEntries
    .filter((l) => l.isEstimate)
    .reduce((s, l) => s + entryTotal(l).kcal, 0);
  return {
    perDay,
    loggedDays: logged.length,
    average: logged.length ? scale(sum, 1 / logged.length) : { ...ZERO },
    eatingOutShare: sum.kcal > 0 ? outKcal / sum.kcal : 0,
    estimateShare: sum.kcal > 0 ? estKcal / sum.kcal : 0,
  };
}
