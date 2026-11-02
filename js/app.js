import { openStore, T, put, putMany, remove, clearAll, uid } from './db.js';
import * as C from './calc.js';
import { SEED_VERSION, seedPlaces, seedFoods, sampleRecipe, homeRecipes } from './seed.js';
import * as H from './health.js';
import * as P from './picker.js';
import * as B from './barcode.js';
import * as I from './importer.js';
import * as N from './insights.js';

/* ---------- Constants ---------- */

const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snacks']];
const ORIGINS = [['home', 'Home-cooked'], ['dine_in', 'Dine-in'], ['takeout', 'Takeout'], ['delivery', 'Delivery']];
const PLACE_KINDS = [['fast_food', 'Fast food'], ['restaurant', 'Restaurant'], ['carinderia', 'Carinderia'], ['cafe', 'Café'], ['delivery_only', 'Delivery only']];
const CATEGORIES = [
  ['protein', 'Meat, fish and eggs'], ['grain', 'Rice, bread and grains'], ['vegetable', 'Vegetables'],
  ['fruit', 'Fruit'], ['dairy', 'Dairy'], ['oil', 'Oils and fats'], ['sauce', 'Sauces and condiments'],
  ['sweet', 'Sugar and sweets'], ['drink', 'Drinks'], ['dish', 'Dishes and menu items'], ['snack', 'Street food and merienda'], ['other', 'Other'],
];
const SHARES = [[1 / 8, '⅛'], [1 / 6, '⅙'], [1 / 5, '⅕'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [1, 'All of it']];

/* ---------- State and helpers ---------- */

const ui = {
  tab: 'today',
  date: C.localDate(),
  sheet: null,
  foodQuery: '',
  foodFilter: 'all',
  foodPlace: '',
};
let storageOk = true;
let lastBowlShift = null;
let dialog = null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-PH');
const fmtQty = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toLocaleString('en-PH', { maximumFractionDigits: 2 });
};
const peso = (n) => `₱${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const settings = () => T.meta.find((m) => m.id === 'settings') || { id: 'settings', hideNumbers: false };
const saveSettings = (patch) => put('meta', { ...settings(), ...patch });
const foodById = (id) => T.foods.find((f) => f.id === id);
const placeById = (id) => T.places.find((p) => p.id === id);
const recipeById = (id) => T.recipes.find((r) => r.id === id);
const batchById = (id) => T.batches.find((b) => b.id === id);
const mealLabel = (m) => (MEALS.find(([k]) => k === m) || [m, m])[1];
const originLabel = (o) => (ORIGINS.find(([k]) => k === o) || [o, o])[1];
const hide = () => !!settings().hideNumbers;

function defaultMeal() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

function dateLabel(d) {
  const today = C.localDate();
  if (d === today) return 'Today';
  if (d === C.dateAdd(today, -1)) return 'Yesterday';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' });
}

// "today", "yesterday" or "on Monday, Nov 2", for use mid-sentence.
function whenLabel(d) {
  const label = dateLabel(d);
  return label === 'Today' || label === 'Yesterday' ? label.toLowerCase() : `on ${label}`;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* In-page dialogs. Browser alert/confirm/prompt are unreliable inside
   embedded views, so every question is asked here instead.
   ask({ title, message, fields: [{ id, label, value, placeholder, options }], ok, danger, cancel })
   resolves with an object of field values (or true when there are no
   fields), or null when cancelled. */
function ask(opts) {
  return new Promise((resolve) => {
    dialog = { ok: 'OK', cancel: 'Cancel', fields: [], ...opts, resolve };
    renderDialog();
    ($('#dialog [data-autofocus]') || $('#dialog [data-action="dialog-ok"]'))?.focus();
  });
}

function renderDialog() {
  const wrap = $('#dialog');
  if (!dialog) { wrap.hidden = true; wrap.innerHTML = ''; return; }
  const d = dialog;
  wrap.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
    <h2 id="dialog-title">${esc(d.title)}</h2>
    ${d.message ? `<p>${esc(d.message)}</p>` : ''}
    ${d.fields.map((f, i) => `<label class="field"><span>${esc(f.label)}</span>${f.options
      ? `<select class="input" id="dialog-${f.id}" ${i === 0 ? 'data-autofocus' : ''}>${f.options.map(([v, l]) => `<option value="${esc(v)}" ${v === f.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
      : `<input class="input" id="dialog-${f.id}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" ${i === 0 ? 'data-autofocus' : ''}>`}</label>`).join('')}
    <div class="btn-row">
      ${d.cancel ? `<button type="button" class="btn" data-action="dialog-cancel">${esc(d.cancel)}</button>` : ''}
      <button type="button" class="btn ${d.danger ? 'danger-fill' : 'primary'}" data-action="dialog-ok">${esc(d.ok)}</button>
    </div></div>`;
  wrap.hidden = false;
}

function closeDialog(ok) {
  const d = dialog;
  if (!d) return;
  let result = null;
  if (ok) {
    if (!d.fields.length) result = true;
    else {
      result = {};
      for (const f of d.fields) result[f.id] = $(`#dialog-${f.id}`)?.value ?? '';
    }
  }
  dialog = null;
  renderDialog();
  d.resolve(result);
}

function matches(q, ...fields) {
  const hay = fields.flat().filter(Boolean).join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

const activeFoods = () => T.foods.filter((f) => !f.archived);
const activeRecipes = () => T.recipes.filter((r) => !r.archived);
const openBatches = () => T.batches
  .filter((b) => !b.finished && C.batchLeft(b, T.logs) > 0.03)
  .sort((a, b) => (a.cookedAt < b.cookedAt ? 1 : -1));

function foodPerLabel(f) {
  if (f.basis === 'per_serving') return `${fmt(f.kcal)} kcal per ${f.portions?.[0]?.label || 'serving'}`;
  return `${fmt(f.kcal)} kcal per 100 g`;
}

function recipeNumbers(r) {
  const totals = C.recipeTotals(r, foodById);
  return { totals, serving: C.perServing(totals, r.servings || 1) };
}

/* ---------- Startup ---------- */

async function init() {
  storageOk = await openStore();
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
  seedIfNeeded();
  bindEvents();
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function seedIfNeeded() {
  const s = settings();
  if ((s.seedVersion || 0) >= SEED_VERSION) return;
  putMany('places', seedPlaces);
  // Keep a person's choice to hide a seed food when the seed updates.
  putMany('foods', seedFoods.map((f) => {
    const old = foodById(f.id);
    return { ...f, archived: old?.archived || false, ...(old?.price ? { price: old.price } : {}) };
  }));
  const firstRun = !s.seedVersion;
  if (firstRun) {
    put('recipes', { ...sampleRecipe, createdAt: new Date().toISOString() });
    put('goals', { id: uid(), effectiveFrom: C.localDate(), kcal: 2000, protein: null, carbs: null, fat: null });
  }
  // Add starter recipes that aren't there yet. One you edited or removed
  // keeps its id, so it is never added back.
  const missing = homeRecipes.filter((r) => !recipeById(r.id));
  if (missing.length) putMany('recipes', missing.map((r) => ({ ...r, createdAt: new Date().toISOString() })));
  saveSettings({ seedVersion: SEED_VERSION });
  if (firstRun && !T.logs.length) loadSampleDay();
}

/* ---------- Rendering ---------- */

function render() {
  const views = { today: viewToday, recipes: viewRecipes, foods: viewFoods, me: viewMe };
  $('#view').innerHTML = (storageOk ? '' : `<p class="note">Your browser is blocking storage, so entries will be lost when you close this page.</p>`) + views[ui.tab]();
  document.querySelectorAll('.tabs [data-action="tab"]').forEach((b) => {
    b.setAttribute('aria-current', b.dataset.v === ui.tab ? 'page' : 'false');
  });
  animateBowl();
  renderSheet();
}

function animateBowl() {
  const c = document.querySelector('.bowl .contents');
  if (!c) return;
  const target = Number(c.dataset.shift);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    c.style.transform = `translateY(${target}px)`;
    lastBowlShift = target;
  }));
}

function bowl(ratio) {
  const top = 40;
  const bottom = 112;
  const depth = bottom - top;
  const level = Math.max(0, Math.min(ratio, 1));
  const shift = depth * (1 - level);
  const start = lastBowlShift == null ? depth : lastBowlShift;
  const over = Math.max(0, Math.min(ratio - 1, 0.6));
  const shape = 'M12 40 H188 C188 86 150 112 100 112 C50 112 12 86 12 40 Z';
  const dome = over > 0
    ? `<ellipse cx="100" cy="${top}" rx="${80 + over * 10}" ry="${Math.max(6, over * 55)}" fill="url(#rice)" clip-path="url(#above-rim)"/>`
    : '';
  return `
    <svg class="bowl" viewBox="0 0 200 124" role="img" aria-label="Bowl ${Math.round(ratio * 100)}% full">
      <defs>
        <pattern id="rice" width="10" height="8" patternUnits="userSpaceOnUse">
          <rect width="10" height="8" fill="var(--fill)"/>
          <ellipse cx="3" cy="3" rx="2.3" ry="1.1" fill="var(--grain)" transform="rotate(-20 3 3)"/>
          <ellipse cx="8" cy="6.4" rx="2.3" ry="1.1" fill="var(--grain)" transform="rotate(25 8 6.4)"/>
        </pattern>
        <clipPath id="inside"><path d="${shape}"/></clipPath>
        <clipPath id="above-rim"><rect x="0" y="-60" width="200" height="${top + 60}"/></clipPath>
      </defs>
      <g clip-path="url(#inside)">
        <rect class="contents" data-shift="${shift}" x="0" y="${top}" width="200" height="${depth + 4}" fill="url(#rice)" style="transform: translateY(${start}px)"/>
      </g>
      ${dome}
      <path d="${shape}" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>
      <path d="M78 111 L82 120 H118 L122 111" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>
      <line x1="5" y1="40" x2="195" y2="40" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
}

function monthLabel(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

function dayStrip() {
  const today = C.localDate();
  let end = C.dateAdd(ui.date, 3);
  if (end > today) end = today;
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(C.dateAdd(end, -i));
  return `<div class="day-strip" role="group" aria-label="Choose a day">${days.map((d) => {
    const [y, m, day] = d.split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    const logged = T.logs.some((l) => l.date === d);
    const guessed = !logged && dayMarks()[d]?.status === 'rough';
    return `<button type="button" class="day" data-action="go-day" data-v="${d}" aria-pressed="${d === ui.date}" aria-label="${esc(dt.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }))}">
      <span class="day-name">${esc(dt.toLocaleDateString('en-PH', { weekday: 'narrow' }))}</span>
      <span class="day-num">${day}</span>
      <span class="day-dot ${logged ? 'on' : guessed ? 'rough' : ''}"></span>
    </button>`;
  }).join('')}</div>`;
}

function recentForMeal(meal, limit = 3) {
  const seen = new Set();
  const out = [];
  for (const l of [...T.logs].sort((a, b) => (a.eatenAt < b.eatenAt ? 1 : -1))) {
    if (l.meal !== meal || l.date === ui.date) continue;
    let key; let kind; let id; let name;
    if (l.kind === 'food' && foodById(l.foodId) && !foodById(l.foodId).archived) { key = `f${l.foodId}`; kind = 'food'; id = l.foodId; name = foodById(l.foodId).name; }
    else if (l.kind === 'recipe' && recipeById(l.recipeId) && !recipeById(l.recipeId).archived) { key = `r${l.recipeId}`; kind = 'recipe'; id = l.recipeId; name = recipeById(l.recipeId).name; }
    else continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, id, name });
    if (out.length >= limit) break;
  }
  return out;
}

const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

const SODIUM_LIMIT = 2000; // WHO: less than 2,000 mg sodium a day for adults
const MEAL_TIMES = { breakfast: '07:30', lunch: '12:00', dinner: '19:00', snack: '15:30' };

const activitiesOn = (date) => T.activities.filter((a) => a.date === date);
const burnedOn = (date) => activitiesOn(date).reduce((s, a) => s + (a.kcal || 0), 0);

// The day's target, plus half of exercise calories when that setting is on.
function targetFor(date) {
  const goal = C.goalOn(T.goals, date) || { kcal: 2000 };
  const extra = settings().exerciseBack ? Math.round(burnedOn(date) / 2) : 0;
  return { ...goal, kcal: goal.kcal + extra, exerciseExtra: extra };
}

function plannedFor(date, meal) {
  const week = getWeek(weekStart(date));
  return (week.days[date]?.[meal] || []).filter((p) => recipeById(p.recipeId));
}

function mealTimePassed(meal) {
  const t = (settings().reminders || MEAL_TIMES)[meal] || MEAL_TIMES[meal];
  const [h, m] = t.split(':').map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m + 60;
}

// Several fully logged days in a row under 1,000 kcal.
function lowIntakeStreak() {
  const today = C.localDate();
  if (settings().lowIntakeDismissed === today) return false;
  for (let i = 1; i <= 3; i++) {
    const d = C.dateAdd(today, -i);
    const entries = T.logs.filter((l) => l.date === d && !l.isSample);
    if (entries.length < 2 || C.dayTotal(T.logs, d).kcal >= 1000) return false;
    if (['partial', 'rough'].includes(dayMarks()[d]?.status)) return false; // you told us you ate more
  }
  return true;
}

/* ---------- Missed and partly logged days ---------- */

const dayMarks = () => T.meta.find((m) => m.id === 'days')?.marks || {};
function setMark(date, mark) {
  const marks = { ...dayMarks() };
  if (mark) marks[date] = mark; else delete marks[date];
  put('meta', { id: 'days', marks });
}

// Your usual full day, for filling gaps. Falls back to your target.
const typicalKcal = () => N.typicalDay(T.logs, C.localDate(), dayMarks(), C.goalOn(T.goals, C.localDate())?.kcal || 2000);

function dayInfo(date) {
  return N.classifyDays({ logs: T.logs, marks: dayMarks(), from: date, to: date, typical: typicalKcal() }).get(date);
}

// Days in the last week that look missed or half-logged and haven't been
// answered yet. Only counts days after you started using Busog.
function missedDays(back = 7) {
  const today = C.localDate();
  const real = T.logs.filter((l) => !l.isSample || T.weights.some((w) => w.isSample));
  if (!real.length) return [];
  const first = real.reduce((m, l) => (l.date < m ? l.date : m), today);
  let from = C.dateAdd(today, -back);
  if (from < first) from = first;
  const to = C.dateAdd(today, -1);
  if (from > to) return [];
  const days = N.classifyDays({ logs: T.logs, marks: dayMarks(), from, to, typical: typicalKcal() });
  return [...days].filter(([, v]) => v.status === 'unlogged' || (v.status === 'partial' && v.auto)).map(([d]) => d).reverse();
}

const ROUGH_SHORT = { light: 'Lighter', usual: 'About usual', big: 'Bigger', feast: 'Party' };

// One day's answer row: used on past days and in the missed-days sheet.
function dayStatusRow(date, { title = true } = {}) {
  const v = dayInfo(date);
  const mark = dayMarks()[date];
  const typical = typicalKcal();
  const chip = (val, label, on) => `<button type="button" class="chip" data-action="mark-day" data-date="${date}" data-v="${val}" aria-pressed="${on}">${esc(label)}</button>`;
  const roughChips = N.ROUGH_LEVELS.map(([k]) => chip(k, ROUGH_SHORT[k], mark?.status === 'rough' && mark.level === k)).join('');
  let state;
  if (v.status === 'rough') state = `Rough guess: ${hide() ? (ROUGH_SHORT[mark.level] || '').toLowerCase() : `about ${fmt(v.kcal)} kcal`}`;
  else if (v.status === 'complete') state = mark?.status === 'complete' ? 'You said this was everything' : 'Looks fully logged';
  else if (v.status === 'partial') state = `Partly logged${hide() ? '' : `, ${fmt(v.logged)} kcal`}${v.auto ? '. Estimates leave it out for now' : ''}`;
  else if (v.status === 'skip') state = 'Left blank. That\'s fine';
  else state = 'Nothing logged';
  const q = v.status === 'rough' ? 'Tap another to change it, or the same one to undo.'
    : v.logged ? (v.status === 'complete' ? '' : 'How was the rest of the day?')
      : 'Want to give a rough guess for the whole day?';
  return `<div class="day-status">
    ${title ? `<p class="day-status-head"><b>${esc(dateLabel(date))}</b><span>${esc(state)}</span></p>` : `<p class="day-status-head"><span>${esc(state)}</span></p>`}
    ${q ? `<p class="small muted">${q}</p>` : ''}
    <div class="chips">
      ${v.logged ? chip('complete', 'That was everything', mark?.status === 'complete') : ''}
      ${v.logged && v.status === 'complete' ? chip('partial', 'Not everything', false) : ''}
      ${v.status !== 'complete' ? roughChips : ''}
      ${!v.logged ? chip('skip', 'Leave blank', mark?.status === 'skip') : ''}
    </div>
    ${v.status !== 'complete' && !hide() ? `<p class="small muted">"About usual" is ${fmt(typical)} kcal, ${N.typicalDay(T.logs, C.localDate(), dayMarks()) ? 'from your fully logged days' : 'your daily target, until you have a few fully logged days'}.</p>` : ''}
  </div>`;
}

function sheetMissed(st) {
  const dates = st.dates || []; // fixed when the sheet opens, so answered days stay put
  return sheetFrame('Fill in missed days', `
    <p class="muted">Forgetting to log, or just not feeling like it, is normal. Busog never counts a missed day as zero calories. A rough guess keeps your estimates honest, and leaving a day blank is fine too.</p>
    ${dates.length ? dates.map((d) => dayStatusRow(d)).join('') : '<p class="empty">Nothing to fill in. Every recent day is logged or answered.</p>'}`,
  '<button type="button" class="btn primary block" data-action="close">Done</button>');
}

function backupDue() {
  const s = settings();
  const real = T.logs.filter((l) => !l.isSample).length;
  if (real < 15) return false;
  if (!s.lastBackupAt) return true;
  return (Date.now() - Date.parse(s.lastBackupAt)) / 86400000 > 14;
}

function viewToday() {
  const s = settings();
  const today = C.localDate();
  const logs = T.logs.filter((l) => l.date === ui.date);
  const total = C.dayTotal(T.logs, ui.date);
  const goal = targetFor(ui.date);
  const ratio = goal.kcal ? total.kcal / goal.kcal : 0;
  const diff = goal.kcal - total.kcal;
  const withSodium = logs.filter((l) => l.sodium != null);
  const sodium = withSodium.reduce((n, l) => n + l.sodium, 0);
  const priced = logs.filter((l) => l.cost != null);
  const spent = priced.reduce((n, l) => n + l.cost, 0);

  let hero;
  if (hide()) {
    const words = ratio < 0.15 ? 'Plenty of room today' : ratio < 0.95 ? 'Filling up nicely' : ratio <= 1.05 ? 'Right about full' : 'Past your target today';
    hero = `<p class="hero-words">${words}</p>`;
  } else {
    hero = `
      <p class="hero-num">${fmt(Math.abs(diff))}</p>
      <p class="hero-unit">${diff >= 0 ? 'kcal left' : 'kcal above target'}</p>
      <div class="hero-stats">
        <div><span>Eaten</span><b>${fmt(total.kcal)}</b></div>
        <div><span>Target${goal.exerciseExtra ? ' with exercise' : ''}</span><b>${fmt(goal.kcal)}</b></div>
        ${priced.length ? `<div><span>Spent</span><b>${peso(spent)}</b></div>` : ''}
      </div>`;
  }

  const macros = [['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, label]) => {
    const target = goal[k];
    const pct = target ? Math.min(100, (total[k] / target) * 100) : null;
    if (hide() && pct == null) return '';
    return `<div class="macro macro-${k}"><span class="macro-label">${label}</span>
      ${hide() ? '' : `<span class="macro-val"><b>${fmt(total[k])}</b>${target ? ` / ${fmt(target)}` : ''} g</span>`}
      ${pct != null ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}</div>`;
  }).join('');
  const sodiumBar = withSodium.length && !hide() ? `<div class="sodium ${sodium > SODIUM_LIMIT ? 'over' : ''}">
      <div class="sodium-head"><span class="macro-label">Sodium</span><span class="macro-val"><b>${fmt(sodium)}</b> / ${fmt(SODIUM_LIMIT)} mg${withSodium.length < logs.length ? ', some foods have no data' : ''}</span></div>
      <div class="bar"><i style="width:${Math.min(100, (sodium / SODIUM_LIMIT) * 100)}%"></i></div>
      ${sodium > SODIUM_LIMIT ? '<p class="muted small">Above the daily guideline. Patis, toyo, instant noodles and processed meats are the usual sources.</p>' : ''}
    </div>` : '';

  const yesterday = C.dateAdd(ui.date, -1);
  const canCopy = !logs.length && T.logs.some((l) => l.date === yesterday && l.kind !== 'batch');

  const meals = MEALS.map(([key, label]) => {
    const entries = logs.filter((l) => l.meal === key).sort((a, b) => (a.eatenAt < b.eatenAt ? -1 : 1));
    const sub = C.add(...entries.map(C.entryTotal));
    const planned = plannedFor(ui.date, key).filter((p) => !entries.some((e) => e.recipeId === p.recipeId));
    const recent = entries.length || planned.length ? [] : recentForMeal(key);
    const chipRow = (items, cls, prefix) => `<div class="quick-chips">${items.map((r) => `<button type="button" class="quick-chip ${cls}" data-action="quick-pick" data-kind="${r.kind}" data-id="${r.id}" data-meal="${key}" ${r.servings ? `data-servings="${r.servings}"` : ''}>${PLUS}<span>${prefix}${esc(r.name)}</span></button>`).join('')}</div>`;
    const nudge = ui.date === today && key !== 'snack' && mealTimePassed(key);
    return `
      <section class="meal-card" aria-labelledby="meal-${key}">
        <div class="meal-head">
          <h2 id="meal-${key}">${label}</h2>
          ${entries.length && !hide() ? `<span class="meal-kcal">${fmt(sub.kcal)} kcal</span>` : ''}
          <button type="button" class="add-round" data-action="open-log" data-meal="${key}" aria-label="Add to ${label.toLowerCase()}">${PLUS}</button>
        </div>
        ${entries.length ? `<ul class="list">${entries.map(entryRow).join('')}</ul>` : ''}
        ${planned.length ? chipRow(planned.map((p) => ({ kind: 'recipe', id: p.recipeId, name: recipeById(p.recipeId).name, servings: p.servings })), 'planned', 'Planned: ') : ''}
        ${recent.length ? chipRow(recent, '', '') : ''}
        ${!entries.length && !planned.length && !recent.length ? `<p class="meal-empty">${nudge ? `Haven't logged ${label.toLowerCase()} yet.` : 'Nothing yet.'}</p>` : ''}
        ${!entries.length && (planned.length || recent.length) && nudge ? `<p class="meal-empty">Haven't logged ${label.toLowerCase()} yet.</p>` : ''}
        ${entries.length ? `<button type="button" class="link small meal-foot" data-action="save-usual" data-meal="${key}">Save as a usual meal</button>` : ''}
      </section>`;
  }).join('');

  const acts = activitiesOn(ui.date);
  const exercise = `
    <section class="meal-card" aria-labelledby="exercise-title">
      <div class="meal-head">
        <h2 id="exercise-title">Exercise</h2>
        ${acts.length && !hide() ? `<span class="meal-kcal">${fmt(burnedOn(ui.date))} kcal</span>` : ''}
        <button type="button" class="add-round" data-action="open-exercise" aria-label="Add exercise">${PLUS}</button>
      </div>
      ${acts.length ? `<ul class="list">${acts.map((a) => `<li><button type="button" class="row" data-action="edit-exercise" data-id="${a.id}">
        <span class="row-main"><span class="row-title">${esc(exerciseLabel(a.exercise))}</span><span class="row-sub">${fmt(a.minutes)} minutes</span></span>
        ${hide() ? '' : `<span class="row-num">${fmt(a.kcal)}</span>`}</button></li>`).join('')}</ul>`
        : '<p class="meal-empty">Walks to class count too.</p>'}
    </section>`;

  return `
    <header class="today-head">
      <div>
        <p class="eyebrow">${esc(monthLabel(ui.date))}</p>
        <h1>${esc(dateLabel(ui.date))}</h1>
      </div>
      ${ui.date !== today ? '<button type="button" class="btn small-btn" data-action="go-day" data-v="today">Back to today</button>' : ''}
    </header>
    ${dayStrip()}
    <div class="hero">
      ${bowl(ratio)}
      ${hero}
    </div>
    ${macros.trim() || sodiumBar ? `<div class="macros-wrap">${macros.trim() ? `<div class="macros">${macros}</div>` : ''}${sodiumBar}</div>` : ''}
    <div class="notes">
      ${ui.date === today && lowIntakeStreak() ? `<div class="note care"><div>
          <p><b>Your last few days were very low in calories.</b> If you ate more than you logged, no problem. If not, eating too little can leave you tired and make it hard to focus in class.</p>
          <p class="small" style="margin-top:6px">If food or your weight has been feeling stressful, talking to someone helps: your school clinic or guidance office, a doctor, or the NCMH crisis hotline at 1553.</p>
          <div class="btn-row" style="margin-top:8px"><button type="button" class="btn" data-action="open-missed" data-partial="1" data-dates="${[1, 2, 3].map((i) => C.dateAdd(today, -i)).join(',')}">I just didn't log everything</button>
          <button type="button" class="link small" data-action="dismiss-low">Hide for today</button></div></div></div>` : ''}
      ${(() => {
        if (ui.date !== today || s.missedSnooze === today) return '';
        const missed = missedDays();
        if (!missed.length) return '';
        return `<div class="note"><div><p>${missed.length === 1 ? `${esc(dateLabel(missed[0]))} isn't fully logged.` : `${missed.length} days this week aren't fully logged.`} That happens. A rough guess keeps your numbers honest.</p>
          <div class="btn-row" style="margin-top:8px"><button type="button" class="btn" data-action="open-missed">Fill in roughly</button><button type="button" class="btn quiet" data-action="leave-missed">Leave ${missed.length === 1 ? 'it' : 'them'} blank</button></div></div></div>`;
      })()}
      ${ui.date < today ? dayStatusRow(ui.date, { title: false }) : ''}
      ${T.logs.some((l) => l.isSample) ? `<div class="note"><span>This is a sample day so you can see how Busog works.</span><button type="button" class="btn" data-action="clear-sample">Clear sample</button></div>` : ''}
      ${!s.plan && !s.goalConfirmed ? `<div class="note leaf"><span>Get a daily target made for your body and goal.</span><button type="button" class="btn primary" data-action="setup">Set up my plan</button></div>` : ''}
      ${ui.date === today && backupDue() ? `<div class="note"><span>Your log only lives on this phone. Back it up so you don't lose it.</span><button type="button" class="btn" data-action="export-json">Back up</button></div>` : ''}
      ${canCopy ? `<div class="note"><span>Ate the same as yesterday?</span><button type="button" class="btn" data-action="copy-yesterday">Copy yesterday</button></div>` : ''}
    </div>
    ${ui.date === today ? `<button type="button" class="picker-cta" data-action="open-picker">
      <span class="picker-icon">${DICE}</span>
      <span class="picker-text"><b>Can't decide what to eat?</b><span>Pick from restaurants, your recipes and what's in your kitchen</span></span>
    </button>` : ''}
    <div class="meals">${meals}${exercise}</div>`;
}

function entryRow(e) {
  const tags = [];
  if (e.isSample) tags.push('<span class="tag">sample</span>');
  if (e.batchId) tags.push('<span class="tag pot">from the pot</span>');
  if (e.origin && e.origin !== 'home') tags.push(`<span class="tag">${esc(originLabel(e.origin))}</span>`);
  if (e.isEstimate) tags.push('<span class="tag est">estimate</span>');
  const extras = (e.extras || []).map((x) => `+ ${esc(x.name.toLowerCase())}`).join(', ');
  const place = e.placeId ? placeById(e.placeId)?.name : '';
  const sub = [e.amountLabel, place, extras].filter(Boolean).join(', ');
  return `<li><button type="button" class="row" data-action="edit-entry" data-id="${e.id}">
    <span class="row-main"><span class="row-title">${esc(e.name)}${tags.join('')}</span><span class="row-sub">${esc(sub)}</span></span>
    ${hide() ? '' : `<span class="row-num">${fmt(C.entryTotal(e).kcal)}</span>`}
  </button></li>`;
}

function recipeRow(r) {
  const { serving } = recipeNumbers(r);
  const bits = [];
  if (r.minutes) bits.push(`${r.minutes} min${r.tools?.length ? `, ${r.tools.join(' and ').toLowerCase()}` : ''}`);
  bits.push(`${fmtQty(r.servings)} serving${r.servings === 1 ? '' : 's'}`);
  if (!hide() && serving.protein >= 20) bits.push(`${fmt(serving.protein)} g protein each`);
  if (r.version > 1) bits.push(`version ${r.version}`);
  return `<li><button type="button" class="row" data-action="open-recipe" data-id="${r.id}">
    <span class="row-main"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(bits.join(', '))}</span></span>
    ${hide() ? '' : `<span class="row-num">${fmt(serving.kcal)} <span class="row-unit">kcal</span></span>`}
  </button></li>`;
}

function planCardHtml() {
  const start = weekStart(C.localDate());
  const w = getWeek(start);
  let n = 0;
  for (const day of Object.values(w.days)) for (const items of Object.values(day)) n += items.length;
  return `<section class="plan-cta">
    <div><b>This week's meal plan</b><span>${n ? `${n} meal${n === 1 ? '' : 's'} planned` : 'Plan your week and get one grocery list'}</span></div>
    <div class="btn-row"><button type="button" class="btn" data-action="open-planner">${n ? 'Open plan' : 'Plan my week'}</button>${n ? '<button type="button" class="btn" data-action="open-grocery">Grocery list</button>' : ''}</div>
  </section>`;
}

function recipeGroup(r) {
  if (r.collection) return r.collection;
  return r.owner === 'seed' ? 'filipino' : 'user';
}

function viewRecipes() {
  const pots = openBatches();
  const recipes = activeRecipes().sort((a, b) => a.name.localeCompare(b.name));
  const groups = [
    ['user', 'Your recipes', 'Add the dishes you cook often. Busog works out the calories per serving.'],
    ['student', 'Student meals', ''],
    ['simple', 'Simple and healthy', ''],
    ['filipino', 'Filipino home cooking', ''],
  ];
  return `
    <div class="page-head"><h1>Recipes</h1><button type="button" class="btn" data-action="open-picker">${DICE}<span>Pick for me</span></button></div>
    ${planCardHtml()}
    <section class="section">
      <div class="section-head"><h2>In the pot</h2></div>
      <ul class="list">
        ${pots.length ? pots.map(batchRow).join('') : `<li class="empty">When you cook a recipe, its leftovers show here so you can log them in one tap.</li>`}
      </ul>
    </section>
    ${groups.map(([key, title, empty]) => {
      const list = recipes.filter((r) => recipeGroup(r) === key);
      if (!list.length && !empty) return '';
      return `<section class="section">
        <div class="section-head"><h2>${title}</h2>${key === 'user' ? '<span><button type="button" class="btn quiet" data-action="open-import">Import</button><button type="button" class="btn quiet" data-action="new-recipe">New recipe</button></span>' : `<span class="muted">${list.length}</span>`}</div>
        <ul class="list">${list.length ? list.map(recipeRow).join('') : `<li class="empty">${empty}</li>`}</ul>
      </section>`;
    }).join('')}`;
}

function batchRow(b) {
  const left = C.batchLeft(b, T.logs);
  const servingsLeft = left * b.servingsMade;
  return `<li><button type="button" class="row" data-action="open-batch" data-id="${b.id}">
    <span class="row-main"><span class="row-title">${esc(b.recipeName)}</span>
    <span class="row-sub">Cooked ${esc(whenLabel(b.date))}, about ${fmtQty(Math.round(servingsLeft * 10) / 10)} servings left</span></span>
    <span class="row-num">${Math.round(left * 100)}%</span>
  </button></li>`;
}

function viewFoods() {
  const filters = [['all', 'All'], ['mine', 'Mine'], ['chains', 'Restaurants'], ['snacks', 'Merienda'], ['drinks', 'Drinks'], ['extras', 'Cooking extras']];
  return `
    <h1>Foods</h1>
    <div class="section stack">
      <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>
        <input class="input" type="search" placeholder="Search foods, aliases or places" value="${esc(ui.foodQuery)}" data-search="foods" aria-label="Search foods"></label>
      <div class="chips" role="group" aria-label="Filter foods">
        ${filters.map(([k, label]) => `<button type="button" class="chip" data-action="food-filter" data-v="${k}" aria-pressed="${ui.foodFilter === k}">${label}</button>`).join('')}
      </div>
      ${ui.foodFilter === 'chains' ? `<div class="chips place-chips" role="group" aria-label="Choose a restaurant">
        <button type="button" class="chip" data-action="food-place" data-v="" aria-pressed="${!ui.foodPlace}">All restaurants</button>
        ${chainPlaces().map((pl) => `<button type="button" class="chip" data-action="food-place" data-v="${pl.id}" aria-pressed="${ui.foodPlace === pl.id}">${esc(pl.name)}</button>`).join('')}
      </div>` : ''}
      <div class="btn-row"><button type="button" class="btn" data-action="new-food">Add a food</button><button type="button" class="btn" data-action="open-scan">Scan a barcode</button></div>
      <button type="button" class="link small" data-action="open-portions">No scale? How to estimate portions with your hand</button>
    </div>
    <ul class="list section" id="food-results">${foodResults()}</ul>`;
}

function foodResults() {
  let list = activeFoods();
  if (ui.foodFilter === 'mine') list = list.filter((f) => f.owner === 'user');
  if (ui.foodFilter === 'chains') list = list.filter((f) => f.placeId && !f.hidden && (!ui.foodPlace || f.placeId === ui.foodPlace));
  if (ui.foodFilter === 'extras') list = list.filter((f) => f.hidden);
  if (ui.foodFilter === 'snacks') list = list.filter((f) => f.category === 'snack');
  if (ui.foodFilter === 'drinks') list = list.filter((f) => f.category === 'drink');
  if (ui.foodQuery.trim()) list = list.filter((f) => matches(ui.foodQuery, f.name, f.aliases, placeById(f.placeId)?.name, f.brand));
  list.sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) return `<li class="empty">No foods match. Add it yourself with "Add a food".</li>`;
  const shown = list.slice(0, 80);
  return shown.map((f) => `<li><button type="button" class="row" data-action="open-food" data-id="${f.id}">
      <span class="row-main"><span class="row-title">${esc(f.name)}${f.defaultEstimate ? '<span class="tag est">estimate</span>' : ''}</span>
      <span class="row-sub">${esc([placeById(f.placeId)?.name || (CATEGORIES.find(([k]) => k === f.category) || ['', 'Other'])[1], ...(f.placeId ? foodTagLabels(f).slice(0, 3) : [])].join(', '))}</span></span>
      ${hide() ? '' : `<span class="row-num small">${esc(foodPerLabel(f))}</span>`}
    </button></li>`).join('') + (list.length > shown.length ? `<li class="empty">Showing ${shown.length} of ${list.length}. Search to narrow it down.</li>` : '');
}

/* ---------- Health profile and plan ---------- */

const weightsAsc = () => [...T.weights].sort((a, b) => (a.id < b.id ? -1 : 1));
const latestWeight = () => weightsAsc().at(-1) || null;

function longDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

/* ---------- Trend weight and learned maintenance ---------- */

// Smoothed weight for today, or null with fewer than two weigh-ins.
function trendNow() {
  if (T.weights.length < 2) return null;
  const s = N.trendSeries(T.weights, C.localDate());
  return s.length ? { kg: s.at(-1).trend, rate: N.trendRate(s), series: s } : null;
}

// The weight plans should use: the trend once there is one, so a single
// heavy morning doesn't move your target.
const planWeight = () => trendNow()?.kg ?? latestWeight()?.weightKg ?? null;

// Maintenance learned from logs and weight trend, blended with the formula.
function learnedMaintenance() {
  const s = settings();
  const w = planWeight();
  const formula = s.profile && w ? H.maintenance({ ...s.profile, weightKg: w }, w) : null;
  return N.adaptiveMaintenance({ logs: T.logs, weights: T.weights, today: C.localDate(), formula, marks: dayMarks() });
}

// Targets for the saved plan at the current trend weight.
function currentPlan() {
  const s = settings();
  if (!s.profile || !s.plan) return null;
  const w = Math.round((planWeight() ?? s.plan.startKg) * 10) / 10;
  const learned = s.useLearned ? learnedMaintenance() : null;
  return H.planTargets({
    ...s.profile, weightKg: w, ...s.plan, today: C.localDate(),
    maintenanceOverride: learned?.ready ? Math.round(learned.blended) : null,
  });
}

// Write today's goal from the plan, when targets follow the plan.
function applyPlan() {
  const s = settings();
  if (!s.plan || s.plan.auto === false) return null;
  const res = currentPlan();
  if (!res?.ok) return res;
  const today = C.localDate();
  const existing = T.goals.find((g) => g.effectiveFrom === today);
  put('goals', { id: existing?.id || uid(), effectiveFrom: today, kcal: res.kcal, protein: res.protein, carbs: res.carbs, fat: res.fat, fromPlan: true });
  return res;
}

function planHeadline(plan, res) {
  if (!res?.ok) return 'Your plan needs a look';
  if (res.goal === 'maintain') return `Keeping steady${latestWeight() ? ` at ${fmtQty(latestWeight().weightKg)} kg` : ''}`;
  return `${res.goal === 'lose' ? 'Losing' : 'Gaining'} ${H.fmtKg(res.rate)} kg a week`;
}

function viewMe() {
  const s = settings();
  const today = C.localDate();
  const w = C.weekStats(T.logs, today);
  const goal = C.goalOn(T.goals, today);
  const plan = s.plan;
  const res = currentPlan();
  const latest = latestWeight();
  const p = s.profile;

  let planCard;
  if (plan && res) {
    const target = plan.targetKg;
    const moving = res.ok && res.goal !== 'maintain';
    const cur = latest?.weightKg ?? plan.startKg;
    const span = moving ? Math.abs(plan.startKg - target) : 0;
    const done = moving && span ? Math.max(0, Math.min(1, Math.abs(plan.startKg - cur) / span)) : 0;
    const reached = moving && ((res.goal === 'lose' && cur <= target) || (res.goal === 'gain' && cur >= target));
    planCard = `
      <section class="plan-card" aria-labelledby="plan-title">
        <p class="plan-kicker">Your plan</p>
        <h2 id="plan-title">${reached ? 'You reached your goal weight' : esc(planHeadline(plan, res))}</h2>
        ${moving && !reached ? `
          <div class="plan-track" role="img" aria-label="${Math.round(done * 100)}% of the way from ${fmtQty(plan.startKg)} to ${fmtQty(target)} kg">
            <i style="width:${done * 100}%"></i><b style="left:${done * 100}%"></b>
          </div>
          <div class="plan-ends"><span>${fmtQty(plan.startKg)} kg</span><span>${fmtQty(cur)} kg now</span><span>${fmtQty(target)} kg</span></div>
          <p class="plan-eta">On pace to reach it around <b>${esc(longDate(res.eta))}</b></p>` : ''}
        ${reached ? '<p class="plan-eta">Switch to staying steady so your target matches your new weight.</p>' : ''}
        ${!res.ok ? `<p class="plan-eta">${esc(res.error)}</p>` : ''}
        <div class="plan-stats">
          <div><span>Daily target</span><b>${goal ? fmt(goal.kcal) : '—'} kcal</b></div>
          <div><span>${res.learned ? 'Maintenance, learned' : 'Maintenance'}</span><b>${res.maintenance ? fmt(res.maintenance) : '—'} kcal</b></div>
        </div>
        ${plan.auto === false ? '<p class="plan-note">You set your targets by hand, so they don\'t follow this plan. <button type="button" class="link" data-action="plan-auto">Use plan targets</button></p>' : ''}
        <div class="btn-row">
          ${reached ? '<button type="button" class="btn on-leaf" data-action="plan-maintain">Stay steady now</button>' : ''}
          <button type="button" class="btn on-leaf" data-action="setup" data-v="3">Change plan</button>
        </div>
      </section>`;
  } else {
    planCard = `
      <section class="plan-card" aria-labelledby="plan-title">
        <p class="plan-kicker">Your plan</p>
        <h2 id="plan-title">Make a plan that fits you</h2>
        <p class="plan-eta">Tell Busog your height, weight and how active you are. It works out your daily calories and how fast you can safely reach a goal weight.</p>
        <div class="btn-row"><button type="button" class="btn on-leaf" data-action="setup">Set up my plan</button></div>
      </section>`;
  }

  const weights = weightsAsc();
  const bmiInfo = p && latest ? (() => {
    const b = H.bmi(latest.weightKg, p.heightCm);
    const [lo, hi] = H.healthyRange(p.heightCm);
    return `<div class="stat-line"><span>BMI</span><b>${fmtQty(Math.round(b * 10) / 10)}</b></div>
      <div class="stat-line"><span>Healthy weight range for ${fmt(p.heightCm)} cm</span><b>${fmtQty(Math.round(lo * 10) / 10)} to ${fmtQty(Math.round(hi * 10) / 10)} kg</b></div>
      <div class="stat-line"><span>Calories your body burns at rest</span><b>${fmt(H.bmr({ ...p, weightKg: latest.weightKg }))} kcal</b></div>
      <div class="stat-line"><span>Activity</span><b>${esc((H.ACTIVITY.find(([k]) => k === p.activity) || H.ACTIVITY[0])[1])}</b></div>`;
  })() : '';

  return `
    <h1>Progress</h1>
    ${planCard}

    <section class="panel" aria-labelledby="weight-title">
      <div class="section-head"><h2 id="weight-title">Weight</h2>${latest ? `<span class="muted">${fmtQty(latest.weightKg)} kg, ${esc(dateLabel(latest.id).toLowerCase() === 'today' ? 'today' : dateLabel(latest.id))}</span>` : ''}</div>
      ${weights.length ? weightChart(weights, plan, res) : '<p class="muted">Log your weight to see your trend here. Weigh in at the same time of day, like after waking up, for a fair comparison.</p>'}
      ${trendLine()}
      <div class="weigh-in">
        <div class="stepper">
          <button type="button" class="step-btn" data-action="weight-step" data-v="-0.1" aria-label="Decrease by 0.1 kg">−</button>
          <label class="unit-input"><input class="input" id="weight-input" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${latest ? latest.weightKg : ''}" placeholder="kg" aria-label="Today's weight in kilograms"><span>kg</span></label>
          <button type="button" class="step-btn" data-action="weight-step" data-v="0.1" aria-label="Increase by 0.1 kg">+</button>
        </div>
        <button type="button" class="btn primary" data-action="save-weight">Save today's weight</button>
      </div>
    </section>

    ${maintenanceCard()}
    ${insightsPanel()}

    <section class="panel" aria-labelledby="week-title">
      <div class="section-head"><h2 id="week-title">Last 7 days</h2></div>
      ${weekChart(w, goal)}
      <div class="stat-line"><span>Days logged</span><b>${w.loggedDays} of 7</b></div>
      ${hide() ? '' : `<div class="stat-line"><span>Average on logged days</span><b>${fmt(w.average.kcal)} kcal</b></div>`}
      <div class="stat-line"><span>Calories from eating out</span><b>${Math.round(w.eatingOutShare * 100)}%</b></div>
      <div class="stat-line"><span>Calories logged as estimates</span><b>${Math.round(w.estimateShare * 100)}%</b></div>
      ${(() => {
        const since = C.dateAdd(today, -6);
        const wk = T.logs.filter((l) => l.date >= since && l.date <= today);
        const priced = wk.filter((l) => l.cost != null);
        const spent = priced.reduce((n, l) => n + l.cost, 0);
        const burned = T.activities.filter((a) => a.date >= since && a.date <= today).reduce((n, a) => n + a.kcal, 0);
        return `${priced.length ? `<div class="stat-line"><span>Food spending${priced.length < wk.length ? ', where prices are known' : ''}</span><b>${peso(spent)}</b></div>` : ''}
          ${burned && !hide() ? `<div class="stat-line"><span>Burned through exercise</span><b>${fmt(burned)} kcal</b></div>` : ''}`;
      })()}
    </section>

    <section class="panel" aria-labelledby="body-title">
      <div class="section-head"><h2 id="body-title">Your details</h2><button type="button" class="btn quiet" data-action="setup" data-v="1">${p ? 'Edit' : 'Add'}</button></div>
      ${bmiInfo || '<p class="muted">Add your height, weight, age and activity to see your body numbers.</p>'}
      ${p ? '<p class="muted small" style="margin-top:10px">BMI is a rough screening number. It doesn\'t account for muscle, and it isn\'t a diagnosis.</p>' : ''}
    </section>

    <section class="panel" aria-labelledby="settings-title">
      <div class="section-head"><h2 id="settings-title">Settings</h2></div>
      <button type="button" class="setting-row" data-action="goals"><span>Set targets by hand</span><span class="muted">${goal ? `${fmt(goal.kcal)} kcal` : ''}</span></button>
      <label class="setting-row check"><span>Hide calorie numbers and show only the bowl</span><input type="checkbox" data-action="toggle-hide" ${s.hideNumbers ? 'checked' : ''}></label>
      <label class="setting-row check"><span>Add half of exercise calories to my daily target</span><input type="checkbox" data-action="toggle-exercise-back" ${s.exerciseBack ? 'checked' : ''}></label>
      <button type="button" class="setting-row" data-action="open-reminders"><span>Meal reminders</span><span class="muted">${s.reminders ? 'Set' : ''}</span></button>
      <button type="button" class="setting-row" data-action="open-portions"><span>Portions without a scale</span></button>
      <button type="button" class="setting-row" data-action="export-json"><span>Back up everything</span></button>
      <button type="button" class="setting-row" data-action="import-json"><span>Restore a backup</span></button>
      <button type="button" class="setting-row" data-action="export-csv"><span>Export food log as CSV</span></button>
      <button type="button" class="setting-row danger" data-action="erase"><span>Erase everything</span></button>
      <p class="muted small" style="margin-top:12px">Everything stays on this device. Ingredient values are approximate, from USDA FoodData Central. McDonald's items come from McDonald's Philippines; Jollibee items come from its US menu, so Philippine portions may differ. Plans use the Mifflin-St Jeor equation and are estimates, not medical advice.</p>
    </section>`;
}

function weightChart(weights, plan, res) {
  const W = 340; const Hh = 170; const L = 34; const R = 12; const T0 = 14; const B = 140;
  const pts = weights.slice(-60);
  const first = plan?.startDate && plan.startDate < pts[0].id ? plan.startDate : pts[0].id;
  const last = C.localDate() > pts.at(-1).id ? C.localDate() : pts.at(-1).id;
  const span = Math.max(1, H.daysBetween(first, last));
  const vals = pts.map((p) => p.weightKg);
  if (plan?.startKg) vals.push(plan.startKg);
  if (plan?.targetKg && res?.goal !== 'maintain') vals.push(plan.targetKg);
  let lo = Math.min(...vals); let hi = Math.max(...vals);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  lo = Math.floor(lo); hi = Math.ceil(hi);
  const x = (d) => L + ((W - L - R) * H.daysBetween(first, d)) / span;
  const y = (v) => T0 + ((B - T0) * (hi - v)) / (hi - lo);
  const step = Math.max(1, Math.round((hi - lo) / 4));
  const ticks = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const grid = ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  let planLine = ''; let hasPlanLine = false;
  if (plan && res?.ok && res.goal !== 'maintain' && plan.startDate) {
    const daysIn = Math.max(0, H.daysBetween(plan.startDate, last));
    const sign = res.goal === 'lose' ? -1 : 1;
    const expected = plan.startKg + sign * Math.min(Math.abs(plan.startKg - plan.targetKg), (plan.rate || res.rate) * (daysIn / 7));
    hasPlanLine = plan.startDate < last;
    planLine = hasPlanLine ? `<line x1="${x(plan.startDate)}" y1="${y(plan.startKg)}" x2="${x(last)}" y2="${y(expected)}" stroke="var(--calamansi)" stroke-width="2" stroke-dasharray="5 4"/>` : '';
    planLine += `<line x1="${L}" x2="${W - R}" y1="${y(plan.targetKg)}" y2="${y(plan.targetKg)}" stroke="var(--leaf)" stroke-width="1.5" stroke-dasharray="2 4"/>
      <text x="${W - R}" y="${y(plan.targetKg) - 5}" text-anchor="end">goal ${fmtQty(plan.targetKg)} kg</text>`;
  }
  // With a few weigh-ins, the smoothed trend is the line and the raw
  // scale readings are faint dots around it.
  const series = pts.length >= 3 ? N.trendSeries(pts, last).filter((p) => p.date >= pts[0].id) : null;
  const line = series ? series.map((p) => ({ id: p.date, weightKg: p.trend })) : pts;
  const path = line.map((p, i) => `${i ? 'L' : 'M'}${x(p.id).toFixed(1)} ${y(p.weightKg).toFixed(1)}`).join(' ');
  const area = line.length > 1 ? `<path d="${path} L${x(line.at(-1).id).toFixed(1)} ${B} L${x(line[0].id).toFixed(1)} ${B} Z" fill="var(--leaf)" opacity="0.1"/>` : '';
  const end = line.at(-1);
  const dateTxt = (d) => { const [yy, mm, dd] = d.split('-').map(Number); return new Date(yy, mm - 1, dd).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }); };
  const dots = series
    ? pts.map((p) => `<circle cx="${x(p.id)}" cy="${y(p.weightKg)}" r="2.5" fill="var(--leaf)" opacity="0.35"/>`).join('')
    : pts.map((p) => `<circle cx="${x(p.id)}" cy="${y(p.weightKg)}" r="2.5" fill="var(--leaf)"/>`).join('');
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Weight over time, ${series ? 'trend' : 'latest'} ${fmtQty(Math.round(end.weightKg * 10) / 10)} kg">
    ${grid}${area}${planLine}${dots}
    <path d="${path}" fill="none" stroke="var(--leaf)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(end.id)}" cy="${y(end.weightKg)}" r="5" fill="var(--leaf)" stroke="var(--surface)" stroke-width="2"/>
    <text x="${L}" y="${Hh - 6}" text-anchor="start">${esc(dateTxt(first))}</text>
    ${first !== last ? `<text x="${W - R}" y="${Hh - 6}" text-anchor="end">${esc(dateTxt(last))}</text>` : ''}
  </svg></div>
  ${pts.length < 2 ? '<p class="muted small">Weigh in again in a few days to start seeing your trend.</p>' : ''}
  ${series || planLine ? `<p class="chart-key">${series ? '<span class="key-trend"></span> trend <span class="key-dot"></span> scale ' : ''}${hasPlanLine ? '<span class="key-plan"></span> plan ' : ''}${planLine ? '<span class="key-goal"></span> goal' : ''}</p>` : ''}`;
}

// "Trend 71.2 kg, losing 0.4 kg a week" under the weight chart.
function trendLine() {
  const t = trendNow();
  if (!t || T.weights.length < 3) return '';
  const r = t.rate;
  const move = r == null ? 'keep weighing in to see your weekly rate'
    : Math.abs(r) < 0.05 ? 'holding steady'
      : `${r < 0 ? 'losing' : 'gaining'} ${H.fmtKg(Math.abs(r))} kg a week`;
  return `<div class="trend-stat"><b>${fmtQty(Math.round(t.kg * 10) / 10)} kg</b><span>trend, ${esc(move)}</span></div>
    <p class="muted small">Your weight moves up and down with water, salt and timing. The trend line smooths that out, so it shows what's really happening.</p>`;
}

function maintenanceCard() {
  const s = settings();
  const a = learnedMaintenance();
  const hasSample = T.weights.some((w) => w.isSample);
  if (!a.ready) {
    const pr = a.progress;
    const item = (done, text) => `<li class="${done ? 'done' : ''}"><span class="tick" aria-hidden="true">${done ? '✓' : ''}</span>${esc(text)}</li>`;
    return `<section class="panel learn-card" aria-labelledby="learn-title">
      <div class="section-head"><h2 id="learn-title">Your real maintenance</h2></div>
      <p class="muted">Formulas can be off by 300 kcal or more for any one person. After two weeks of logging and weighing in, Busog works out what <i>your</i> body actually burns, from what you ate and how your trend moved.</p>
      <ul class="unlock">
        ${item(!pr.needLoggedDays, pr.needLoggedDays ? `${pr.needLoggedDays} more fully logged day${pr.needLoggedDays === 1 ? '' : 's'} (${pr.loggedDays} of ${N.NEEDS.loggedDays})` : `${pr.loggedDays} days logged`)}
        ${item(!pr.needWeighIns, pr.needWeighIns ? `Weigh in ${pr.needWeighIns} more time${pr.needWeighIns === 1 ? '' : 's'} (${pr.weighIns} of ${N.NEEDS.weighIns})` : `${pr.weighIns} weigh-ins`)}
        ${item(!pr.needSpanDays, pr.needSpanDays ? `Weigh-ins spread over ${N.NEEDS.spanDays} days (${pr.spanDays} so far)` : 'Two weeks between first and last weigh-in')}
      </ul>
      <p class="muted small">Days don't have to be in a row, and missing one never resets anything. Rough guesses for missed days count too.</p>
      ${hasSample ? '' : '<button type="button" class="btn quiet" data-action="load-demo">See it with 5 weeks of sample data</button>'}
    </section>`;
  }
  const kc = Math.round(a.blended / 10) * 10;
  const diff = a.formula ? kc - Math.round(a.formula / 10) * 10 : null;
  const levelTxt = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }[a.level];
  return `<section class="panel learn-card ready" aria-labelledby="learn-title">
    <div class="section-head"><h2 id="learn-title">Your real maintenance</h2><span class="conf conf-${a.level}">${levelTxt}</span></div>
    ${hide() ? '<p>Busog has learned how much you burn from your own logs and weight trend.</p>' : `
    <p class="learn-num"><b>${fmt(kc)}</b> kcal a day</p>
    <p class="muted">${diff == null ? 'Add your details in your plan to compare this with the formula.'
      : Math.abs(diff) < 50 ? 'Right in line with the formula estimate.'
        : `That's ${fmt(Math.abs(diff))} kcal ${diff > 0 ? 'more' : 'less'} than the formula guessed (${fmt(Math.round(a.formula / 10) * 10)}).`}</p>
    <div class="stat-line"><span>Average daily intake</span><b>${fmt(a.avgIntake)} kcal</b></div>
    <div class="stat-line"><span>Trend change over ${a.days} days</span><b>${a.trendChangeKg > 0 ? '+' : a.trendChangeKg < 0 ? '−' : ''}${fmtQty(Math.abs(Math.round(a.trendChangeKg * 10) / 10))} kg</b></div>
    ${(() => {
      const n = a.counts;
      const filled = n.partial + n.unlogged + n.skip;
      const used = [`${n.complete} fully logged day${n.complete === 1 ? '' : 's'}`];
      if (n.rough) used.push(`${n.rough} rough guess${n.rough === 1 ? '' : 'es'}`);
      return `<p class="muted small">Based on ${used.join(' and ')}.${filled ? ` ${filled} partly logged or missed day${filled === 1 ? ' was' : 's were'} filled in from your usual ${n.unlogged + n.skip ? 'weekdays and weekends' : 'days'}, never counted as zero.` : ''}</p>`;
    })()}
    ${a.level !== 'high' ? '<p class="muted small">Keep logging. The estimate gets steadier over 5 to 6 weeks.</p>' : ''}`}
    ${missedDays(14).length ? `<button type="button" class="btn quiet" data-action="open-missed" data-back="14">Add rough guesses for ${missedDays(14).length} missed day${missedDays(14).length === 1 ? '' : 's'}</button>` : ''}
    ${a.notes.map((n) => `<p class="note small"><span>${esc(n)}</span></p>`).join('')}
    ${s.plan ? `<label class="setting-row check"><span>Use this in my plan instead of the formula</span><input type="checkbox" data-action="toggle-learned" ${s.useLearned ? 'checked' : ''}></label>` : ''}
    ${hasSample ? '<button type="button" class="btn quiet" data-action="clear-sample">Clear sample data</button>' : ''}
  </section>`;
}

function insightsPanel() {
  const list = N.findInsights({ logs: T.logs, today: C.localDate(), marks: dayMarks(), typical: typicalKcal() }).filter((i) => !(hide() && ['weekend', 'drinks'].includes(i.id)));
  if (!list.length) return '';
  const shown = list.slice(0, 3);
  return `<section class="panel" aria-labelledby="ins-title">
    <div class="section-head"><h2 id="ins-title">What your logs show</h2><span class="muted small">last 4 weeks</span></div>
    <ul class="insights">${shown.map(insightItem).join('')}</ul>
    ${list.length > shown.length ? `<button type="button" class="btn quiet" data-action="open-insights">See all ${list.length}</button>` : ''}
  </section>`;
}

const insightItem = (i) => `<li><b>${esc(i.title)}</b><span>${esc(i.text)}</span></li>`;

function sheetInsights() {
  const list = N.findInsights({ logs: T.logs, today: C.localDate(), marks: dayMarks(), typical: typicalKcal() });
  return sheetFrame('What your logs show', `
    <p class="muted">From your last 4 weeks of logging. Each one only appears when there's enough data behind it.</p>
    <ul class="insights">${list.map(insightItem).join('')}</ul>`);
}

function weekChart(w, goal) {
  const W = 340; const Hh = 150; const base = 118; const top = 18;
  const maxVal = Math.max(goal?.kcal || 0, ...w.perDay.map((d) => d.total.kcal)) * 1.1 || 1;
  const y = (v) => base - ((base - top) * v) / maxVal;
  const bw = 30; const gap = (W - 7 * bw) / 8;
  const bars = w.perDay.map((d, i) => {
    const x = gap + i * (bw + gap);
    const h = base - y(d.total.kcal);
    const [yy, mm, dd] = d.date.split('-').map(Number);
    const day = new Date(yy, mm - 1, dd).toLocaleDateString('en-PH', { weekday: 'short' });
    const over = goal && d.total.kcal > goal.kcal * 1.05;
    return `<rect x="${x}" y="${base - h}" width="${bw}" height="${Math.max(h, d.count ? 3 : 0)}" rx="7" fill="${over ? 'var(--calamansi)' : 'var(--fill)'}"/>
      <text x="${x + bw / 2}" y="${base + 20}" text-anchor="middle">${esc(day)}</text>
      ${!hide() && d.count ? `<text x="${x + bw / 2}" y="${base - h - 6}" text-anchor="middle">${(Math.round(d.total.kcal / 100) / 10).toLocaleString('en-PH')}k</text>` : ''}`;
  }).join('');
  const goalLine = goal ? `<line x1="0" x2="${W}" y1="${y(goal.kcal)}" y2="${y(goal.kcal)}" stroke="var(--ink)" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="0" y="${y(goal.kcal) - 6}" text-anchor="start">target</text>` : '';
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Calories for each of the last 7 days">${goalLine}${bars}
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)"/></svg></div>`;
}

/* Guided plan setup, also used to edit details or the goal. */

function setupState(step = 1) {
  const s = settings();
  const p = s.profile || {};
  const plan = s.plan || {};
  const latest = latestWeight();
  return {
    type: 'setup', step,
    sex: p.sex || 'female', age: p.age ?? null, heightCm: p.heightCm ?? null,
    weightKg: latest?.weightKg ?? null, activity: p.activity || 'light',
    goal: plan.goal || 'lose', targetKg: plan.targetKg ?? null, mode: plan.mode || 'pace',
    pace: plan.pace ?? 0.5, targetDate: plan.targetDate || C.dateAdd(C.localDate(), 84),
  };
}

function setupInput(st) {
  return { sex: st.sex, age: st.age, heightCm: st.heightCm, weightKg: st.weightKg, activity: st.activity, goal: st.goal, targetKg: st.targetKg, mode: st.mode, pace: st.pace, targetDate: st.targetDate, today: C.localDate() };
}

function stepper(key, value, step, label, unit, min = 0) {
  return `<div class="stepper">
    <button type="button" class="step-btn" data-action="step" data-k="${key}" data-v="${-step}" data-min="${min}" aria-label="Decrease ${esc(label)}">−</button>
    <label class="unit-input"><input class="input" type="number" inputmode="decimal" step="any" min="${min}" value="${value ?? ''}" data-k="${key}" data-type="num" data-live="1" aria-label="${esc(label)}">${unit ? `<span>${esc(unit)}</span>` : ''}</label>
    <button type="button" class="step-btn" data-action="step" data-k="${key}" data-v="${step}" data-min="${min}" aria-label="Increase ${esc(label)}">+</button>
  </div>`;
}

function planLive(st) {
  const res = H.planTargets(setupInput(st));
  const minor = st.age != null && st.age < H.ADULT_AGE;
  const paces = st.goal === 'gain' ? H.GAIN_PACES : H.LOSS_PACES;
  let html = '';
  if (st.goal !== 'maintain' && !minor && st.mode === 'pace') {
    const maxRate = st.goal === 'lose' && st.weightKg ? H.maxLossRate(st.weightKg) : H.MAX_GAIN_KG_WEEK;
    html += `<div class="options">${paces.map(([v, name, desc]) => {
      const disabled = v > maxRate + 1e-9;
      const r = disabled ? null : H.planTargets({ ...setupInput(st), pace: v, mode: 'pace' });
      const meta = disabled ? 'Faster than a steady pace for your weight'
        : r?.ok ? `${hide() ? '' : `${fmt(r.kcal)} kcal a day, `}goal around ${longDate(r.eta)}` : desc;
      return `<button type="button" class="option" data-action="set" data-k="pace" data-v="${v}" data-type="num" aria-pressed="${st.pace === v}" ${disabled ? 'disabled' : ''}>
        <span class="option-title">${esc(name)} <span class="muted">${H.fmtKg(v)} kg a week</span></span>
        <span class="option-desc">${esc(meta)}</span></button>`;
    }).join('')}</div>`;
  }
  if (!res.ok) {
    html += `<div class="result bad" role="alert"><p>${esc(res.error)}${res.earliest ? ` The earliest steady date is ${esc(longDate(res.earliest))}.` : ''}</p>
      ${res.earliest ? `<button type="button" class="btn" data-action="set" data-k="targetDate" data-v="${res.earliest}">Use ${esc(longDate(res.earliest))}</button>` : ''}</div>`;
  } else {
    html += `<div class="result">
      ${hide() ? '' : `<p class="result-num">${fmt(res.kcal)} <span>kcal a day</span></p>`}
      <p>${res.goal === 'maintain' ? 'Enough to keep your weight steady.' : `${res.goal === 'lose' ? 'Losing' : 'Gaining'} about ${H.fmtKg(res.rate)} kg a week, reaching ${fmtQty(res.targetKg)} kg around ${esc(longDate(res.eta))}.`}</p>
      ${res.notes.filter((n) => !(minor && n.startsWith("Busog doesn't"))).map((n) => `<p class="muted small">${esc(n)}</p>`).join('')}
    </div>`;
  }
  return html;
}

function sheetSetup(st) {
  const titles = ['About you', 'How active are you?', 'Your goal', 'Your plan'];
  const minor = st.age != null && st.age < H.ADULT_AGE;
  let body = '';
  if (st.step === 1) {
    body = `
      <p class="muted">These set how many calories your body uses. They stay on this device.</p>
      <div><h3 class="label">Sex used for the calorie formula</h3>${chips('sex', H.SEXES, st.sex)}</div>
      <div class="field"><span>Age</span>${stepper('age', st.age, 1, 'Age', 'years', 13)}</div>
      <div class="field"><span>Height</span>${stepper('heightCm', st.heightCm, 1, 'Height', 'cm', 120)}</div>
      <div class="field"><span>Weight today</span>${stepper('weightKg', st.weightKg, 0.1, 'Weight', 'kg', 30)}</div>`;
  } else if (st.step === 2) {
    body = `<div class="options">${H.ACTIVITY.map(([k, label, , desc]) => `
      <button type="button" class="option" data-action="set" data-k="activity" data-v="${k}" aria-pressed="${st.activity === k}">
        <span class="option-title">${esc(label)}</span><span class="option-desc">${esc(desc)}</span></button>`).join('')}</div>
      <p class="muted small">Not sure? Pick the lower one. It's easier to eat a little more later than to wonder why progress is slow.</p>`;
  } else if (st.step === 3) {
    body = `
      ${minor ? '<div class="note"><span>Busog doesn\'t make weight-change plans for people under 18, so your plan will keep you steady. A doctor or school nurse can help with weight goals.</span></div>' : `<div>${chips('goal', H.GOALS, st.goal)}</div>`}
      ${!minor && st.goal !== 'maintain' ? `
        <div class="field"><span>Goal weight</span>${stepper('targetKg', st.targetKg, 0.5, 'Goal weight', 'kg', 30)}</div>
        ${st.heightCm && st.goal === 'lose' ? `<p class="muted small">The healthy range for your height is ${fmtQty(Math.round(H.healthyRange(st.heightCm)[0] * 10) / 10)} to ${fmtQty(Math.round(H.healthyRange(st.heightCm)[1] * 10) / 10)} kg.</p>` : ''}
        <div><h3 class="label">How do you want to get there?</h3>${chips('mode', [['pace', 'Choose a pace'], ['date', 'Choose a date']], st.mode)}</div>
        ${st.mode === 'date' ? `<label class="field"><span>Reach my goal by</span><input class="input" type="date" min="${C.dateAdd(C.localDate(), 7)}" value="${esc(st.targetDate)}" data-k="targetDate" data-live="1"></label>` : ''}` : ''}
      <div id="plan-live">${planLive(st)}</div>`;
  } else {
    const res = H.planTargets(setupInput(st));
    body = res.ok ? `
      <div class="result big">
        ${hide() ? '<p>Your plan is ready.</p>' : `<p class="result-num">${fmt(res.kcal)} <span>kcal a day</span></p>`}
        <p>${res.goal === 'maintain' ? 'Keeps your weight steady.' : `${res.goal === 'lose' ? 'Lose' : 'Gain'} about ${H.fmtKg(res.rate)} kg a week and reach ${fmtQty(res.targetKg)} kg around ${esc(longDate(res.eta))}.`}</p>
      </div>
      ${hide() ? '' : `<div class="macro-plan">
        <div><span>Protein</span><b>${fmt(res.protein)} g</b></div>
        <div><span>Carbs</span><b>${fmt(res.carbs)} g</b></div>
        <div><span>Fat</span><b>${fmt(res.fat)} g</b></div></div>
      <div class="stat-line"><span>Your maintenance calories</span><b>${fmt(res.maintenance)} kcal</b></div>
      <div class="stat-line"><span>Burned at rest</span><b>${fmt(res.bmr)} kcal</b></div>`}
      ${res.notes.map((n) => `<p class="muted small">${esc(n)}</p>`).join('')}
      <p class="muted small">Your target updates by itself when you log a new weight. These are estimates. Weigh in weekly and adjust if progress is much faster or slower than expected.</p>`
      : `<div class="result bad"><p>${esc(res.error)}</p></div>`;
  }
  const dots = [1, 2, 3, 4].map((n) => `<i class="${n === st.step ? 'on' : n < st.step ? 'done' : ''}"></i>`).join('');
  const back = st.step > 1 ? '<button type="button" class="btn" data-action="setup-back">Back</button>' : '';
  const next = st.step < 4
    ? '<button type="button" class="btn primary" data-action="setup-next">Next</button>'
    : '<button type="button" class="btn primary" data-action="save-plan">Save my plan</button>';
  return sheetFrame(titles[st.step - 1], `
    <div class="step-dots" aria-label="Step ${st.step} of 4">${dots}</div>
    ${body}
    ${st.error ? `<p class="error" role="alert">${esc(st.error)}</p>` : ''}`,
  `<div class="btn-row">${back}${next}</div>`);
}

function setupNext() {
  const st = ui.sheet;
  st.error = null;
  if (st.step === 1) {
    const problem = H.profileProblem(st);
    if (problem) { st.error = problem; renderSheet(); return; }
  }
  if (st.step === 3) {
    const res = H.planTargets(setupInput(st));
    if (!res.ok) { st.error = 'Fix the goal above to continue.'; renderSheet(); return; }
  }
  st.step += 1;
  st.keepScroll = false;
  renderSheet();
}

function savePlan() {
  const st = ui.sheet;
  const res = H.planTargets(setupInput(st));
  if (!res.ok) { st.error = res.error; renderSheet(); return; }
  const today = C.localDate();
  put('weights', { id: today, weightKg: st.weightKg });
  saveSettings({
    profile: { sex: st.sex, age: st.age, heightCm: st.heightCm, activity: st.activity },
    plan: {
      goal: res.goal, targetKg: res.goal === 'maintain' ? st.weightKg : st.targetKg, mode: st.mode, pace: st.pace,
      targetDate: st.targetDate, startKg: st.weightKg, startDate: today, rate: res.rate, auto: true,
    },
    goalConfirmed: true,
  });
  applyPlan();
  closeSheet();
  ui.tab = 'me';
  render();
  toast('Plan saved');
}

/* ---------- Sheets ---------- */

function openSheet(state) {
  ui.sheet = state;
  renderSheet();
  const first = $('#sheet [data-autofocus]') || $('#sheet .sheet-head button');
  first?.focus();
}

function closeSheet() {
  B.stopScan();
  ui.sheet = null;
  renderSheet();
}

function sheetFrame(title, body, foot = '') {
  return `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-head"><h2>${esc(title)}</h2>
      <button type="button" class="icon-btn" data-action="close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="sheet-body stack">${body}</div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}
  </div>`;
}

function renderSheet() {
  const wrap = $('#sheet');
  const st = ui.sheet;
  if (!st) { wrap.hidden = true; wrap.innerHTML = ''; return; }
  const renderers = {
    pick: sheetPick, entry: sheetEntry, recipe: sheetRecipe, 'recipe-form': sheetRecipeForm,
    'batch-form': sheetBatchForm, batch: sheetBatch, food: sheetFood, 'food-form': sheetFoodForm, goals: sheetGoals,
    export: sheetExport, setup: sheetSetup, random: sheetRandom, prices: sheetPrices,
    planner: sheetPlanner, 'plan-add': sheetPlanAdd, grocery: sheetGrocery, exercise: sheetExercise,
    scan: sheetScan, import: sheetImport, reminders: sheetReminders, portions: sheetPortionGuide, insights: sheetInsights, missed: sheetMissed,
  };
  const scroll = wrap.querySelector('.sheet-body')?.scrollTop || 0;
  const wasOpen = !wrap.hidden;
  wrap.innerHTML = renderers[st.type](st);
  if (!wasOpen) wrap.querySelector('.sheet')?.classList.add('opening');
  wrap.hidden = false;
  const body = wrap.querySelector('.sheet-body');
  if (body && st.keepScroll) body.scrollTop = scroll;
  st.keepScroll = true;
}

function chips(key, options, current, type = 'str') {
  return `<div class="chips" role="group">${options.map(([v, label]) =>
    `<button type="button" class="chip" data-action="set" data-k="${key}" data-v="${esc(String(v))}" data-type="${type}" aria-pressed="${String(current) === String(v)}">${esc(label)}</button>`).join('')}</div>`;
}

function placeSelect(current) {
  const places = [...T.places].sort((a, b) => a.name.localeCompare(b.name));
  return `<label class="field"><span>Place</span><select class="input" data-k="placeId" data-rerender="1">
    <option value="">Not set</option>
    ${places.map((p) => `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
    <option value="__new">Add a new place…</option>
  </select></label>`;
}

async function addPlace() {
  const res = await ask({
    title: 'Add a place',
    fields: [
      { id: 'name', label: 'Name', placeholder: "e.g. Aling Nena's carinderia" },
      { id: 'kind', label: 'Kind of place', options: PLACE_KINDS, value: 'carinderia' },
    ],
    ok: 'Add place',
  });
  const name = res?.name.trim();
  if (!name) return null;
  const existing = T.places.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  return put('places', { id: uid(), name, kind: res.kind, isChain: false, owner: 'user' }).id;
}

/* Pick what to log */

function sheetPick(st) {
  return sheetFrame(`Add to ${mealLabel(st.meal).toLowerCase()}`, `
    ${chips('meal', MEALS, st.meal)}
    <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>
      <input class="input" type="search" placeholder="Search food, recipe or restaurant" value="${esc(st.query)}" data-search="pick" data-autofocus aria-label="Search"></label>
    <div id="pick-results">${pickResults(st)}</div>`,
  `<div class="btn-row"><button type="button" class="btn" data-action="quick-add">Quick add calories</button><button type="button" class="btn" data-action="open-picker">${DICE}<span>Pick for me</span></button></div>`);
}

function pickRow(kind, id, title, sub, right = '') {
  return `<li><button type="button" class="row" data-action="pick" data-kind="${kind}" data-id="${id}">
    <span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub)}</span></span>
    ${right && !hide() ? `<span class="row-num small">${esc(right)}</span>` : ''}</button></li>`;
}

function pickResults(st) {
  const q = st.query.trim();
  const parts = [];
  if (!q) {
    const pots = openBatches();
    if (pots.length) {
      parts.push(`<h3>Leftovers</h3><ul class="list">${pots.map((b) => {
        const left = C.batchLeft(b, T.logs) * b.servingsMade;
        return pickRow('batch', b.id, b.recipeName, `About ${fmtQty(Math.round(left * 10) / 10)} servings left`, `${fmt(b.totals.kcal / b.servingsMade)} kcal per serving`);
      }).join('')}</ul>`);
    }
    if (T.savedMeals.length) {
      parts.push(`<h3>Usual meals</h3><ul class="list">${T.savedMeals.map((m) =>
        pickRow('saved', m.id, m.name, `${m.items.length} items`)).join('')}</ul>`);
    }
    const seen = new Set();
    const recent = [];
    for (const l of [...T.logs].sort((a, b) => (a.eatenAt < b.eatenAt ? 1 : -1))) {
      const key = l.kind === 'food' ? `food:${l.foodId}` : l.kind === 'recipe' ? `recipe:${l.recipeId}` : null;
      if (!key || seen.has(key)) continue;
      const ok = l.kind === 'food' ? foodById(l.foodId) && !foodById(l.foodId).archived : recipeById(l.recipeId) && !recipeById(l.recipeId).archived;
      if (!ok) continue;
      seen.add(key);
      recent.push(l);
      if (recent.length >= 10) break;
    }
    if (recent.length) {
      parts.push(`<h3>Recent</h3><ul class="list">${recent.map((l) => l.kind === 'food'
        ? pickRow('food', l.foodId, foodById(l.foodId).name, placeById(foodById(l.foodId).placeId)?.name || 'Food', foodPerLabel(foodById(l.foodId)))
        : pickRow('recipe', l.recipeId, recipeById(l.recipeId).name, 'Recipe', `${fmt(recipeNumbers(recipeById(l.recipeId)).serving.kcal)} kcal per serving`)).join('')}</ul>`);
    }
    const recipes = activeRecipes();
    if (recipes.length) {
      parts.push(`<h3>Recipes</h3><ul class="list">${recipes.map((r) =>
        pickRow('recipe', r.id, r.name, 'Recipe', `${fmt(recipeNumbers(r).serving.kcal)} kcal per serving`)).join('')}</ul>`);
    }
    parts.push(`<p class="muted small">Search ${activeFoods().length} foods, including McDonald's and Jollibee menus.</p>`);
    return parts.join('');
  }
  const meals = T.savedMeals.filter((m) => matches(q, m.name));
  const recipes = activeRecipes().filter((r) => matches(q, r.name));
  const foods = activeFoods().filter((f) => matches(q, f.name, f.aliases, placeById(f.placeId)?.name, f.brand)).slice(0, 40);
  const rows = [
    ...meals.map((m) => pickRow('saved', m.id, m.name, 'Usual meal')),
    ...recipes.map((r) => pickRow('recipe', r.id, r.name, 'Recipe', `${fmt(recipeNumbers(r).serving.kcal)} kcal per serving`)),
    ...foods.map((f) => pickRow('food', f.id, f.name, placeById(f.placeId)?.name || 'Food', foodPerLabel(f))),
  ];
  return rows.length ? `<ul class="list">${rows.join('')}</ul>`
    : `<p class="empty">Nothing called "${esc(q)}" yet. Use quick add, or add it as a food from the Foods tab.</p>`;
}

/* Log or edit an entry */

function newEntryForm(kind, refId, meal, date) {
  const f = {
    type: 'entry', mode: 'new', kind, refId, meal, date,
    quantity: 1, portionId: null, batchMode: 'servings', grams: null, servings: 1, share: 0.25,
    origin: 'home', placeId: null, isEstimate: false, extras: [], note: '',
    name: '', kcal: null, protein: null, carbs: null, fat: null, extraFood: 'seed-oil', extraGrams: 5, costPaid: null,
  };
  if (kind === 'food') {
    const food = foodById(refId);
    if (food.basis === 'per_serving') f.portionId = 'serving';
    else if (food.portions?.length) f.portionId = food.portions[0].id;
    else { f.portionId = 'g'; f.quantity = 100; }
    f.placeId = food.placeId || null;
    f.origin = food.placeId ? 'dine_in' : 'home';
    f.isEstimate = !!food.defaultEstimate;
  }
  if (kind === 'batch') {
    const b = batchById(refId);
    f.batchMode = b.cookedWeightG ? 'grams' : 'servings';
  }
  if (kind === 'quick') f.isEstimate = true;
  return f;
}

function entryForm(e) {
  const kind = e.kind;
  const refId = kind === 'food' ? e.foodId : kind === 'recipe' ? e.recipeId : kind === 'batch' ? e.batchId : null;
  return {
    type: 'entry', mode: 'edit', entryId: e.id, eatenAt: e.eatenAt, kind, refId, meal: e.meal, date: e.date,
    quantity: e.quantity ?? 1, portionId: e.portionId, batchMode: e.batchMode || 'servings',
    grams: e.grams, servings: e.servings ?? 1, share: e.share ?? e.batchFraction ?? 0.25,
    origin: e.origin || 'home', placeId: e.placeId || null, isEstimate: !!e.isEstimate,
    extras: (e.extras || []).map((x) => ({ foodId: x.foodId, grams: x.grams })), note: e.note || '',
    name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, extraFood: 'seed-oil', extraGrams: 5,
    costPaid: e.costPaid ?? null,
  };
}

function computeEntry(f) {
  let base = { ...C.ZERO }; let label = ''; let name = ''; let grams = null; let servings = null; let fraction = null;
  let sodium = null; let cost = null;
  if (f.kind === 'food') {
    const food = foodById(f.refId);
    name = food.name;
    if (food.basis === 'per_serving') {
      const p = food.portions?.[0];
      servings = f.quantity || 0;
      base = C.forFood(food, { servings });
      label = `${fmtQty(servings)} × ${p?.label || 'serving'}`;
      grams = p?.grams ? p.grams * servings : null;
    } else {
      grams = C.portionGrams(food, f.portionId, f.quantity) || 0;
      base = C.forFood(food, { grams });
      const p = food.portions?.find((x) => x.id === f.portionId) || C.handPortions(food).find((x) => x.id === f.portionId);
      label = f.portionId === 'g' ? `${fmt(f.quantity)} g` : `${fmtQty(f.quantity)} × ${p?.label.replace(/ \(.*\)$/, '')}`;
    }
    sodium = C.sodiumFor(food, { grams, servings });
    cost = C.costFor(food, { grams, servings });
  } else if (f.kind === 'recipe') {
    const r = recipeById(f.refId);
    name = r.name;
    servings = f.servings || 0;
    const k = servings / (r.servings || 1);
    base = C.scale(recipeNumbers(r).totals, k);
    label = `${fmtQty(servings)} serving${servings === 1 ? '' : 's'}`;
    sodium = C.recipeSodium(r, foodById) * k;
    const ci = recipeCostInfo(r);
    cost = ci.complete ? ci.value * servings : null;
  } else if (f.kind === 'batch') {
    const b = batchById(f.refId);
    name = b.recipeName;
    if (f.batchMode === 'grams' || f.batchMode === 'fist') {
      grams = f.batchMode === 'fist' ? (f.quantity || 0) * C.FIST_OF_DISH_G : f.grams || 0;
      fraction = b.cookedWeightG ? grams / b.cookedWeightG : 0;
      label = f.batchMode === 'fist' ? `${fmtQty(f.quantity)} fist${f.quantity === 1 ? '' : 's'}` : `${fmt(grams)} g`;
    } else if (f.batchMode === 'servings') {
      servings = f.servings || 0;
      fraction = servings / b.servingsMade;
      label = `${fmtQty(servings)} serving${servings === 1 ? '' : 's'}`;
    } else {
      fraction = f.share || 0;
      label = fraction >= 1 ? 'the whole pot' : `${(SHARES.find(([v]) => Math.abs(v - fraction) < 0.001) || [0, fmtQty(fraction)])[1]} of the pot`;
    }
    base = C.scale(b.totals, fraction);
    sodium = b.sodium != null ? b.sodium * fraction : null;
    cost = b.cost != null ? b.cost * fraction : null;
  } else {
    name = (f.name || '').trim() || 'Quick add';
    base = C.pick(f);
    label = 'quick add';
  }
  const extras = f.extras.map((x) => {
    const food = foodById(x.foodId);
    const na = C.sodiumFor(food, { grams: x.grams || 0 });
    return { foodId: x.foodId, name: food?.name || 'Extra', grams: x.grams, ...C.round1(C.forFood(food, { grams: x.grams || 0 })), sodium: na };
  });
  for (const x of extras) if (x.sodium != null) sodium = (sodium || 0) + x.sodium;
  if (f.costPaid > 0) cost = f.costPaid;
  return { base, extras, total: C.add(base, ...extras), label, name, grams, servings, fraction, sodium, cost };
}

function entryFromForm(f) {
  const c = computeEntry(f);
  const refs = { foodId: null, recipeId: null, batchId: null };
  if (f.kind === 'food') refs.foodId = f.refId;
  if (f.kind === 'recipe') refs.recipeId = f.refId;
  if (f.kind === 'batch') { refs.batchId = f.refId; refs.recipeId = batchById(f.refId).recipeId; }
  return {
    id: f.mode === 'edit' ? f.entryId : uid(),
    date: f.date,
    eatenAt: f.eatenAt || new Date().toISOString(),
    meal: f.meal,
    kind: f.kind,
    ...refs,
    name: c.name,
    amountLabel: c.label,
    quantity: f.quantity,
    portionId: f.portionId,
    grams: c.grams,
    servings: c.servings,
    batchMode: f.kind === 'batch' ? f.batchMode : null,
    share: f.kind === 'batch' && f.batchMode === 'share' ? f.share : null,
    batchFraction: c.fraction,
    ...C.round1(c.base),
    sodium: c.sodium != null ? Math.round(c.sodium) : null,
    cost: c.cost != null ? Math.round(c.cost * 100) / 100 : null,
    costPaid: f.costPaid > 0 ? f.costPaid : null,
    extras: c.extras,
    isEstimate: !!f.isEstimate,
    origin: f.origin,
    placeId: f.origin === 'home' ? null : f.placeId,
    note: f.note,
  };
}

function entryProblem(f) {
  if (f.kind === 'quick') return num(f.kcal) == null || f.kcal < 0 ? 'Enter the calories.' : null;
  if (f.kind === 'food' && !(f.quantity > 0)) return 'Enter how much you had.';
  if (f.kind === 'recipe' && !(f.servings > 0)) return 'Enter how many servings you had.';
  if (f.kind === 'batch') {
    if (f.batchMode === 'grams' && !(f.grams > 0)) return 'Enter the weight of your plate.';
    if (f.batchMode === 'fist' && !(f.quantity > 0)) return 'Enter how many fists you had.';
    if (f.batchMode === 'servings' && !(f.servings > 0)) return 'Enter how many servings you had.';
    const b = batchById(f.refId);
    const used = C.batchUsed(b, T.logs.filter((l) => l.id !== f.entryId));
    const c = computeEntry(f);
    if (used + c.fraction > 1.05) return `Only about ${Math.round((1 - used) * 100)}% of this pot is left.`;
  }
  return null;
}

function previewHtml(f) {
  if (hide()) return '<p class="muted">Numbers are hidden. Change this in Me.</p>';
  const c = computeEntry(f);
  return `<strong>${fmt(c.total.kcal)} kcal</strong>
    <span>${fmt(c.total.protein)} g protein, ${fmt(c.total.carbs)} g carbs, ${fmt(c.total.fat)} g fat${c.sodium != null ? `, ${fmt(c.sodium)} mg sodium` : ''}${c.cost != null ? `, ${peso(c.cost)}` : ''}</span>`;
}

function sheetEntry(f) {
  const parts = [];
  let title = 'Log it';
  if (f.kind === 'food') {
    const food = foodById(f.refId);
    title = food.name;
    parts.push(`<p class="muted">${esc([placeById(food.placeId)?.name, hide() ? '' : foodPerLabel(food)].filter(Boolean).join(', '))}</p>`);
    if (food.basis === 'per_serving') {
      parts.push(`<div class="field"><span>How many (${esc(food.portions?.[0]?.label || 'serving')})</span>
        ${stepper('quantity', f.quantity, 0.5, 'How many', '')}</div>`);
    } else {
      const opts = [...(food.portions || []).map((p) => [p.id, `${p.label} (${fmtQty(p.grams)} g)`]), ...C.handPortions(food).map((p) => [p.id, p.label]), ['g', 'grams']];
      parts.push(`<div class="field"><span>Amount</span>${stepper('quantity', f.quantity, f.portionId === 'g' ? 10 : 0.5, 'Amount', f.portionId === 'g' ? 'g' : '')}</div>
        <label class="field"><span>Unit</span><select class="input" data-k="portionId" data-rerender="1">
          ${opts.map(([v, l]) => `<option value="${v}" ${v === f.portionId ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`);
    }
    if (food.defaultEstimate) parts.push(`<p class="muted small">${esc(food.source)}</p>`);
  } else if (f.kind === 'recipe') {
    const r = recipeById(f.refId);
    title = r.name;
    parts.push(`<p class="muted">Not cooked as a batch, so this uses the recipe's planned ${fmtQty(r.servings)} servings.</p>
      <div class="field"><span>Servings</span>${stepper('servings', f.servings, 0.5, 'Servings', '')}</div>`);
  } else if (f.kind === 'batch') {
    const b = batchById(f.refId);
    title = b.recipeName;
    const leftPct = Math.round(C.batchLeft(b, T.logs.filter((l) => l.id !== f.entryId)) * 100);
    parts.push(`<p class="muted">From the pot you cooked ${esc(whenLabel(b.date))}. ${leftPct}% is left.</p>`);
    const modes = [...(b.cookedWeightG ? [['grams', 'Weigh my plate'], ['fist', 'Count fists']] : []), ['servings', 'Servings'], ['share', 'Share of the pot']];
    parts.push(chips('batchMode', modes, f.batchMode));
    if (f.batchMode === 'grams') {
      parts.push(`<label class="field"><span>Weight of the food on your plate (g)</span>
        <input class="input" type="number" inputmode="decimal" min="0" value="${f.grams ?? ''}" data-k="grams" data-type="num" data-live="1" data-autofocus></label>
        <p class="muted small">The whole pot weighed ${fmt(b.cookedWeightG)} g after cooking.</p>`);
    } else if (f.batchMode === 'fist') {
      parts.push(`<div class="field"><span>How many fist-sized portions</span>${stepper('quantity', f.quantity, 0.5, 'Fists', '')}</div>
        <p class="muted small">No scale? A closed fist is about 1 cup, roughly ${C.FIST_OF_DISH_G} g of a cooked dish.</p>`);
    } else if (f.batchMode === 'servings') {
      parts.push(`<div class="field"><span>Servings (the pot made ${fmtQty(b.servingsMade)})</span>
        ${stepper('servings', f.servings, 0.5, 'Servings', '')}</div>`);
    } else {
      parts.push(`<p class="muted small">For family-style meals: about how much of the pot was yours?</p>${chips('share', SHARES, f.share, 'num')}`);
    }
  } else {
    title = 'Quick add';
    parts.push(`<label class="field"><span>What was it</span><input class="input" value="${esc(f.name)}" data-k="name" placeholder="e.g. Halo-halo at the mall" data-autofocus></label>
      <div class="grid4">
        <label class="field"><span>kcal</span><input class="input" type="number" inputmode="decimal" min="0" value="${f.kcal ?? ''}" data-k="kcal" data-type="num" data-live="1"></label>
        <label class="field"><span>Protein g</span><input class="input" type="number" inputmode="decimal" min="0" value="${f.protein ?? ''}" data-k="protein" data-type="num" data-live="1"></label>
        <label class="field"><span>Carbs g</span><input class="input" type="number" inputmode="decimal" min="0" value="${f.carbs ?? ''}" data-k="carbs" data-type="num" data-live="1"></label>
        <label class="field"><span>Fat g</span><input class="input" type="number" inputmode="decimal" min="0" value="${f.fat ?? ''}" data-k="fat" data-type="num" data-live="1"></label>
      </div>`);
  }

  parts.push(`<div><h3 style="margin-bottom:8px">Meal</h3>${chips('meal', MEALS, f.meal)}</div>`);
  parts.push(`<div><h3 style="margin-bottom:8px">Where it's from</h3>${chips('origin', ORIGINS, f.origin)}</div>`);
  if (f.origin !== 'home') parts.push(placeSelect(f.placeId));

  // Hidden calories: restaurant cooking usually adds oil, unless the
  // numbers come from a chain's own published data.
  const food = f.kind === 'food' ? foodById(f.refId) : null;
  const chainItem = food && placeById(food.placeId)?.isChain;
  if (f.origin !== 'home' && !chainItem && f.kind !== 'quick') {
    parts.push(`<div class="note"><span>Restaurant cooking usually uses more oil than home cooking.</span></div>
      <div class="btn-row"><button type="button" class="btn" data-action="add-oil" data-v="4.5">Add 1 tsp oil</button>
      <button type="button" class="btn" data-action="add-oil" data-v="13.6">Add 1 tbsp oil</button></div>`);
  }
  const extraFoods = activeFoods().filter((x) => x.hidden && x.basis !== 'per_serving').sort((a, b) => a.name.localeCompare(b.name));
  parts.push(`<div><h3 style="margin-bottom:8px">Extras</h3>
    ${f.extras.map((x, i) => {
      const xf = foodById(x.foodId);
      return `<div class="stat-line"><span>${esc(xf?.name || 'Extra')}, ${fmtQty(x.grams)} g</span>
        <button type="button" class="link" data-action="remove-extra" data-v="${i}">Remove</button></div>`;
    }).join('')}
    <div class="extra-add">
      <select class="input" data-k="extraFood" aria-label="Extra food">${extraFoods.map((x) => `<option value="${x.id}" ${x.id === f.extraFood ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <label class="unit-input"><input class="input" type="number" inputmode="decimal" min="0" value="${f.extraGrams ?? ''}" data-k="extraGrams" data-type="num" aria-label="Grams of extra"><span>g</span></label>
      <button type="button" class="btn" data-action="add-extra">Add</button>
    </div></div>`);
  parts.push(`<label class="check"><input type="checkbox" data-k="isEstimate" data-type="bool" ${f.isEstimate ? 'checked' : ''}> Rough estimate</label>`);
  parts.push(`<label class="field"><span>Price paid (₱)</span><input class="input" type="number" inputmode="decimal" min="0" value="${f.costPaid ?? ''}" data-k="costPaid" data-type="num" data-live="1" placeholder="Optional, for tracking spending"></label>`);
  parts.push(`<label class="field"><span>Note</span><input class="input" value="${esc(f.note)}" data-k="note" placeholder="Optional"></label>`);
  parts.push(`<div class="preview" id="preview">${previewHtml(f)}</div>`);
  if (f.error) parts.push(`<p class="error" role="alert">${esc(f.error)}</p>`);

  const foot = f.mode === 'edit'
    ? `<div class="btn-row"><button type="button" class="btn danger" data-action="delete-entry">Delete</button><button type="button" class="btn primary" data-action="save-entry">Save changes</button></div>`
    : `<button type="button" class="btn primary block" data-action="save-entry">Log it</button>`;
  return sheetFrame(title, parts.join(''), foot);
}

function saveEntry() {
  const f = ui.sheet;
  const problem = entryProblem(f);
  if (problem) { f.error = problem; renderSheet(); return; }
  const entry = put('logs', entryFromForm(f));
  if (entry.batchId) {
    const b = batchById(entry.batchId);
    if (C.batchLeft(b, T.logs) < 0.05) put('batches', { ...b, finished: true });
  }
  const msg = f.mode === 'edit' ? 'Changes saved' : `Logged to ${mealLabel(f.meal).toLowerCase()}`;
  ui.date = f.date;
  ui.tab = 'today';
  closeSheet();
  render();
  toast(msg);
}

/* Recipes */

function sheetRecipe(st) {
  const r = recipeById(st.id);
  const { totals, serving } = recipeNumbers(r);
  const batches = T.batches.filter((b) => b.recipeId === r.id).sort((a, b) => (a.cookedAt < b.cookedAt ? 1 : -1));
  const hasHidden = r.ingredients.some((i) => foodById(i.foodId)?.hidden);
  return sheetFrame(r.name, `
    ${hide() ? '' : `<div class="preview"><strong>${fmt(serving.kcal)} kcal</strong><span>per serving, ${fmt(totals.kcal)} kcal for the whole recipe of ${fmtQty(r.servings)} servings</span></div>`}
    ${r.minutes ? `<div class="reasons"><span class="reason">${r.minutes} minutes</span>${(r.tools || []).map((t) => `<span class="reason">${esc(t)}</span>`).join('')}</div>` : ''}
    ${recipeExtrasLine(r)}
    ${r.version > 1 ? `<p class="muted small">Version ${r.version}. Earlier versions stay attached to the days you logged them.</p>` : ''}
    <h3>Ingredients</h3>
    <ul class="list">${r.ingredients.map((i) => {
      const food = foodById(i.foodId);
      const portion = food?.portions?.find((p) => p.id === i.portionId);
      const amount = i.portionId === 'g' || !portion ? `${fmtQty(i.grams)} g` : `${fmtQty(i.quantity)} × ${portion.label}`;
      return `<li class="stat-line"><span>${esc(food?.name || 'Missing food')}<br><span class="muted small">${esc(amount)}</span></span>${hide() ? '' : `<b>${fmt(food ? C.forFood(food, { grams: i.grams }).kcal : 0)} kcal</b>`}</li>`;
    }).join('')}</ul>
    ${!hasHidden ? `<p class="note">No oil, sugar or sauce listed. If you cooked with any, add it so the numbers stay honest.</p>` : ''}
    ${r.instructions ? `<h3>How to cook it</h3><p>${esc(r.instructions)}</p>` : ''}
    ${batches.length ? `<h3>Times you cooked it</h3><ul class="list">${batches.slice(0, 5).map(batchRow).join('')}</ul>` : ''}`,
  `<div class="btn-row">
    <button type="button" class="btn" data-action="edit-recipe" data-id="${r.id}">Edit</button>
    <button type="button" class="btn" data-action="log-recipe" data-id="${r.id}">Log a serving</button>
    <button type="button" class="btn primary" data-action="cook" data-id="${r.id}">I cooked this</button></div>`);
}

// Sodium and cost per serving for a recipe, with a prompt to add prices.
function recipeExtrasLine(r) {
  const k = 1 / (r.servings || 1);
  const na = C.recipeSodium(r, foodById) * k;
  const ci = recipeCostInfo(r);
  const bits = [];
  if (!hide()) bits.push(`<div><span>Sodium</span><b>${fmt(na)} mg</b></div>`);
  bits.push(`<div><span>Cost per serving</span><b>${ci.complete ? peso(ci.value) : ci.value != null ? `${peso(ci.value)} so far` : 'Add prices'}</b></div>`);
  return `<div class="mini-stats">${bits.join('')}</div>
    <button type="button" class="link small" data-action="recipe-prices" data-id="${r.id}">${ci.value != null ? (ci.missing.length ? `Add prices for ${ci.missing.length} more ingredient${ci.missing.length === 1 ? '' : 's'}` : 'Update ingredient prices') : 'Add ingredient prices to see the cost'}</button>`;
}

function sheetPrices(st) {
  const r = recipeById(st.recipeId);
  const ids = [...new Set(r.ingredients.map((i) => i.foodId))].filter((id) => foodById(id));
  return sheetFrame('Ingredient prices', `
    <p class="muted">Enter what you pay at your usual store. Each price is saved on the ingredient, so every recipe that uses it gets a cost.</p>
    ${ids.map((id) => {
      const f = foodById(id);
      const row = st.rows[id];
      const opts = [...(f.portions || []).filter((p) => p.grams).map((p) => [p.id, p.label]), ['g', 'grams']];
      return `<div class="price-item"><b>${esc(f.name)}</b>
        <div class="price-row">
          <label class="unit-input"><input class="input" type="number" inputmode="decimal" min="0" value="${row.priceAmount ?? ''}" data-price="${id}" data-f="priceAmount" aria-label="Price of ${esc(f.name)} in pesos" placeholder="Price"><span>₱</span></label>
          <span class="muted">for</span>
          <input class="input" type="number" inputmode="decimal" min="0" value="${row.priceQty ?? ''}" data-price="${id}" data-f="priceQty" aria-label="Amount">
          <select class="input" data-price="${id}" data-f="pricePortion" aria-label="Unit">${opts.map(([v, l]) => `<option value="${v}" ${v === row.pricePortion ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        </div></div>`;
    }).join('')}`,
  `<button type="button" class="btn primary block" data-action="save-prices">Save prices</button>`);
}

function recipeFormState(r) {
  return {
    type: 'recipe-form', id: r?.id || null,
    name: r?.name || '', servings: r?.servings ?? 4, expectedCookedG: r?.expectedCookedG ?? null,
    instructions: r?.instructions || '',
    ingredients: (r?.ingredients || []).map((i) => ({ ...i })),
    query: '',
  };
}

function sheetRecipeForm(st) {
  const fake = { ingredients: st.ingredients.map((i) => ({ ...i, grams: ingGrams(i) })) };
  const totals = C.recipeTotals(fake, foodById);
  const per = C.perServing(totals, st.servings || 1);
  const hasHidden = st.ingredients.some((i) => foodById(i.foodId)?.hidden);
  return sheetFrame(st.id ? 'Edit recipe' : 'New recipe', `
    <label class="field"><span>Name</span><input class="input" value="${esc(st.name)}" data-k="name" placeholder="e.g. Sinigang na baboy" ${st.id ? '' : 'data-autofocus'}></label>
    <div class="grid2">
      <label class="field"><span>Servings it makes</span><input class="input" type="number" inputmode="decimal" min="1" value="${st.servings ?? ''}" data-k="servings" data-type="num" data-live="1"></label>
      <label class="field"><span>Usual cooked weight (g)</span><input class="input" type="number" inputmode="decimal" min="0" value="${st.expectedCookedG ?? ''}" data-k="expectedCookedG" data-type="num" placeholder="Optional"></label>
    </div>
    <h3>Ingredients</h3>
    <div>${st.ingredients.map((ing, idx) => {
      const food = foodById(ing.foodId);
      const opts = [...(food?.portions || []).map((p) => [p.id, p.label]), ['g', 'g']];
      return `<div class="ing">
        <span class="ing-name">${esc(food?.name || 'Missing food')}<small>${fmtQty(ingGrams(ing))} g</small></span>
        <input class="input" type="number" inputmode="decimal" min="0" step="any" value="${ing.quantity ?? ''}" data-ing="${idx}" data-f="quantity" aria-label="Amount of ${esc(food?.name)}">
        <select class="input" data-ing="${idx}" data-f="portionId" aria-label="Unit">${opts.map(([v, l]) => `<option value="${v}" ${v === ing.portionId ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <button type="button" class="x-btn" data-action="remove-ing" data-v="${idx}" aria-label="Remove ${esc(food?.name)}">×</button>
      </div>`;
    }).join('') || '<p class="empty">No ingredients yet.</p>'}</div>
    <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>
      <input class="input" type="search" placeholder="Add an ingredient" value="${esc(st.query)}" data-search="ing" aria-label="Search ingredients"></label>
    <ul class="list" id="ing-results">${ingResults(st)}</ul>
    ${st.ingredients.length && !hasHidden ? '<p class="note">No oil, sugar or sauce yet. Did you cook with any?</p>' : ''}
    <label class="field"><span>How to cook it</span><textarea class="input" data-k="instructions" placeholder="Optional">${esc(st.instructions)}</textarea></label>
    <div class="preview" id="preview">${hide() ? '<p class="muted">Numbers are hidden.</p>' : `<strong>${fmt(per.kcal)} kcal</strong><span>per serving, ${fmt(totals.kcal)} kcal in total</span>`}</div>
    ${st.error ? `<p class="error" role="alert">${esc(st.error)}</p>` : ''}`,
  `<button type="button" class="btn primary block" data-action="save-recipe">Save recipe</button>`);
}

function ingGrams(ing) {
  const food = foodById(ing.foodId);
  return food ? C.portionGrams(food, ing.portionId, ing.quantity) || 0 : 0;
}

function ingResults(st) {
  if (!st.query.trim()) return '';
  const list = activeFoods().filter((f) => f.basis !== 'per_serving' && matches(st.query, f.name, f.aliases)).slice(0, 12);
  if (!list.length) return `<li class="empty">No ingredient called "${esc(st.query)}". Add it in the Foods tab first.</li>`;
  return list.map((f) => `<li><button type="button" class="row" data-action="add-ing" data-id="${f.id}">
    <span class="row-main"><span class="row-title">${esc(f.name)}</span><span class="row-sub">${esc(f.portions?.[0]?.label || '100 g')}</span></span>
    <span class="row-num">Add</span></button></li>`).join('');
}

function saveRecipe() {
  const st = ui.sheet;
  if (!st.name.trim()) { st.error = 'Give the recipe a name.'; renderSheet(); return; }
  if (!(st.servings > 0)) { st.error = 'Enter how many servings it makes.'; renderSheet(); return; }
  if (!st.ingredients.length) { st.error = 'Add at least one ingredient.'; renderSheet(); return; }
  const data = {
    name: st.name.trim(), servings: st.servings, expectedCookedG: st.expectedCookedG || null,
    instructions: st.instructions.trim(),
    ingredients: st.ingredients.map((i) => ({ foodId: i.foodId, quantity: i.quantity, portionId: i.portionId, grams: ingGrams(i) })),
  };
  let saved;
  const old = st.id ? recipeById(st.id) : null;
  const used = old && (T.batches.some((b) => b.recipeId === old.id) || T.logs.some((l) => l.recipeId === old.id));
  if (old && used) {
    // Tweaking a recipe you've already logged makes a new version, so past
    // days keep the numbers they were logged with.
    put('recipes', { ...old, archived: true });
    saved = put('recipes', { ...old, ...data, id: uid(), parentId: old.id, version: (old.version || 1) + 1, archived: false, owner: 'user', createdAt: new Date().toISOString() });
  } else if (old) {
    saved = put('recipes', { ...old, ...data });
  } else {
    saved = put('recipes', { ...data, id: uid(), parentId: null, version: 1, archived: false, owner: 'user', createdAt: new Date().toISOString() });
  }
  ui.tab = 'recipes';
  render();
  openSheet({ type: 'recipe', id: saved.id });
  toast(old && used ? `Saved as version ${saved.version}` : 'Recipe saved');
}

function sheetBatchForm(st) {
  const r = recipeById(st.recipeId);
  return sheetFrame(`Cooked ${r.name}`, `
    <p>Weighing the finished dish makes every plate you log accurate, because cooking boils off water.</p>
    <label class="field"><span>Weight of the cooked food, without the pot (g)</span>
      <input class="input" type="number" inputmode="decimal" min="0" value="${st.cookedWeightG ?? ''}" data-k="cookedWeightG" data-type="num" placeholder="Skip if you didn't weigh it" data-autofocus></label>
    ${r.expectedCookedG && st.cookedWeightG === r.expectedCookedG ? `<p class="muted small">This is a typical weight for this recipe. Weigh your own batch for the most accurate numbers.</p>` : ''}
    <p class="muted small">Tip: weigh the empty pot once and note it, then weigh the pot with food and subtract.</p>
    <label class="field"><span>Servings it made</span>
      <input class="input" type="number" inputmode="decimal" min="1" value="${st.servingsMade ?? ''}" data-k="servingsMade" data-type="num"></label>
    ${st.error ? `<p class="error" role="alert">${esc(st.error)}</p>` : ''}`,
  `<button type="button" class="btn primary block" data-action="save-batch">Save to the pot</button>`);
}

function saveBatch() {
  const st = ui.sheet;
  if (!(st.servingsMade > 0)) { st.error = 'Enter how many servings it made.'; renderSheet(); return; }
  const r = recipeById(st.recipeId);
  const b = put('batches', {
    id: uid(), recipeId: r.id, recipeName: r.name, cookedAt: new Date().toISOString(), date: C.localDate(),
    cookedWeightG: st.cookedWeightG > 0 ? st.cookedWeightG : null, servingsMade: st.servingsMade,
    totals: C.round1(recipeNumbers(r).totals), finished: false,
    sodium: Math.round(C.recipeSodium(r, foodById)),
    cost: (() => { const ci = recipeCostInfo(r); return ci.complete ? Math.round(ci.value * r.servings * 100) / 100 : null; })(),
  });
  ui.tab = 'recipes';
  render();
  openSheet({ type: 'batch', id: b.id });
  toast('Added to the pot');
}

function sheetBatch(st) {
  const b = batchById(st.id);
  const left = C.batchLeft(b, T.logs);
  const logs = T.logs.filter((l) => l.batchId === b.id).sort((a, c) => (a.eatenAt < c.eatenAt ? -1 : 1));
  const per100 = b.cookedWeightG ? (b.totals.kcal / b.cookedWeightG) * 100 : null;
  return sheetFrame(b.recipeName, `
    ${hide() ? '' : `<table class="facts"><tbody>
      <tr><td>Whole pot</td><td>${fmt(b.totals.kcal)} kcal</td></tr>
      ${per100 ? `<tr><td>Per 100 g cooked</td><td>${fmt(per100)} kcal</td></tr>` : ''}
      <tr><td>Per serving (${fmtQty(b.servingsMade)} made)</td><td>${fmt(b.totals.kcal / b.servingsMade)} kcal</td></tr>
    </tbody></table>`}
    <p>${b.finished ? 'Finished.' : `About ${Math.round(left * 100)}% left, roughly ${fmtQty(Math.round(left * b.servingsMade * 10) / 10)} servings.`}
    ${b.cookedWeightG ? ` The pot weighed ${fmt(b.cookedWeightG)} g cooked.` : ''}</p>
    ${logs.length ? `<h3>Eaten from this pot</h3><ul class="list">${logs.map((l) => `<li class="stat-line"><span>${esc(dateLabel(l.date))}, ${esc(mealLabel(l.meal).toLowerCase())}</span><b>${esc(l.amountLabel)}</b></li>`).join('')}</ul>` : ''}`,
  b.finished
    ? `<button type="button" class="btn block" data-action="unfinish-batch" data-id="${b.id}">There's still some left</button>`
    : `<div class="btn-row"><button type="button" class="btn" data-action="finish-batch" data-id="${b.id}">It's all gone</button>
       <button type="button" class="btn primary" data-action="log-batch" data-id="${b.id}">Log from this pot</button></div>`);
}

/* Foods */

function sheetFood(st) {
  const f = foodById(st.id);
  const place = placeById(f.placeId);
  const unit = f.basis === 'per_serving' ? `per ${f.portions?.[0]?.label || 'serving'}` : 'per 100 g';
  return sheetFrame(f.name, `
    ${place ? `<p class="muted">${esc(place.name)}</p>` : ''}
    <table class="facts"><tbody>
      <tr><td>Calories ${esc(unit)}</td><td>${fmt(f.kcal)} kcal</td></tr>
      <tr><td>Protein</td><td>${fmtQty(f.protein)} g</td></tr>
      <tr><td>Carbs</td><td>${fmtQty(f.carbs)} g</td></tr>
      <tr><td>Fat</td><td>${fmtQty(f.fat)} g</td></tr>
      ${f.sodium != null ? `<tr><td>Sodium</td><td>${fmt(f.sodium)} mg</td></tr>` : ''}
    </tbody></table>
    ${priceEditor(f, st)}
    ${f.basis !== 'per_serving' && f.portions?.length ? `<p class="muted small">Units: ${esc(f.portions.map((p) => `${p.label} = ${fmtQty(p.grams)} g`).join('; '))}</p>` : ''}
    ${foodTagLabels(f).length ? `<div class="reasons">${foodTagLabels(f).map((t) => `<span class="reason">${esc(t)}</span>`).join('')}</div>` : ''}
    ${f.isEstimateOnly ? '<p class="note"><span>This restaurant doesn\'t publish nutrition data, so these numbers are Busog\'s estimate from typical portions. They\'re logged as estimates.</span></p>' : ''}
    ${f.aliases?.length ? `<p class="muted small">Also called ${esc(f.aliases.join(', '))}</p>` : ''}
    ${f.hidden ? '<p class="muted small">Counted as a cooking extra, so it shows up in the extras list when you log.</p>' : ''}
    ${f.source ? `<p class="muted small">Source: ${f.sourceUrl ? `<a href="${esc(f.sourceUrl)}" target="_blank" rel="noopener">${esc(f.source)}</a>` : esc(f.source)}${f.verifiedOn ? `, checked ${esc(f.verifiedOn)}` : ''}</p>` : ''}`,
  `<div class="btn-row">
    ${f.owner === 'user'
      ? `<button type="button" class="btn danger" data-action="archive-food" data-id="${f.id}">Remove</button><button type="button" class="btn" data-action="edit-food" data-id="${f.id}">Edit</button>`
      : `<button type="button" class="btn" data-action="copy-food" data-id="${f.id}">Make my own copy</button>`}
    <button type="button" class="btn primary" data-action="log-food" data-id="${f.id}">Log this</button></div>`);
}

// Cost per serving for a recipe: { value, complete }. Complete means every
// ingredient except pantry basics has a price.
function recipeCostInfo(r) {
  const rc = C.recipeCost(r, foodById);
  const pantry = pantryIds();
  const missing = rc.unpriced.filter((id) => !pantry.has(id));
  return { value: rc.priced ? rc.total / (r.servings || 1) : null, complete: rc.priced > 0 && missing.length === 0, missing };
}

function priceState(f) {
  const p = f.price;
  if (f.basis === 'per_serving') return { priceAmount: p?.amount ?? null, priceQty: 1, pricePortion: 'serving' };
  const pkg = (f.portions || []).filter((x) => x.grams && /can|pack|head|block|bundle|bunch|piece|fillet|tablet|ear|belly|large|medium/.test(x.label))
    .sort((a, b) => b.grams - a.grams)[0];
  if (p?.grams) {
    if (pkg && Math.abs(p.grams / pkg.grams - Math.round(p.grams / pkg.grams)) < 0.01) return { priceAmount: p.amount, priceQty: Math.round(p.grams / pkg.grams), pricePortion: pkg.id };
    return { priceAmount: p.amount, priceQty: p.grams, pricePortion: 'g' };
  }
  return pkg ? { priceAmount: null, priceQty: 1, pricePortion: pkg.id } : { priceAmount: null, priceQty: 1000, pricePortion: 'g' };
}

function openFood(id) {
  const f = foodById(id);
  openSheet({ type: 'food', id, ...priceState(f) });
}

function priceEditor(f, st) {
  const per = f.basis === 'per_serving';
  const opts = per ? [] : [...(f.portions || []).filter((p) => p.grams).map((p) => [p.id, p.label]), ['g', 'grams']];
  const perServing = !per && f.price?.grams ? (f.price.amount / f.price.grams) * (f.portions?.[0]?.grams || 100) : null;
  return `<div class="price-box">
    <h3>Price</h3>
    ${f.price ? `<p class="muted small">${per ? `${peso(f.price.amount)} per ${esc(f.portions?.[0]?.label || 'serving')}` : `${peso((f.price.amount / f.price.grams) * 1000)} per kg${perServing != null ? `, about ${peso(perServing)} per ${esc(f.portions?.[0]?.label || '100 g')}` : ''}`}</p>` : '<p class="muted small">Add what you pay so Busog can show the cost of meals and recipes. Prices stay on this device.</p>'}
    <div class="price-row ${per ? 'per' : ''}">
      <label class="unit-input"><input class="input" type="number" inputmode="decimal" min="0" value="${st.priceAmount ?? ''}" data-k="priceAmount" data-type="num" aria-label="Price in pesos" placeholder="Price"><span>₱</span></label>
      ${per ? `<span class="muted">per ${esc(f.portions?.[0]?.label || 'serving')}</span>` : `<span class="muted">for</span>
        <input class="input" type="number" inputmode="decimal" min="0" value="${st.priceQty ?? ''}" data-k="priceQty" data-type="num" aria-label="Amount">
        <select class="input" data-k="pricePortion" aria-label="Unit">${opts.map(([v, l]) => `<option value="${v}" ${v === st.pricePortion ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`}
    </div>
    <button type="button" class="btn small-btn" data-action="save-price" data-id="${f.id}">Save price</button>
  </div>`;
}

function savePrice(food, st) {
  if (!(st.priceAmount > 0)) { put('foods', { ...food, price: null }); return true; }
  if (food.basis === 'per_serving') { put('foods', { ...food, price: { amount: st.priceAmount } }); return true; }
  const grams = C.portionGrams(food, st.pricePortion, st.priceQty);
  if (!(grams > 0)) return false;
  put('foods', { ...food, price: { amount: st.priceAmount, grams } });
  return true;
}

function foodFormState(f, copy = false) {
  return {
    type: 'food-form', id: f && !copy ? f.id : null,
    name: f ? `${f.name}${copy ? ' (mine)' : ''}` : '', aliases: (f?.aliases || []).join(', '),
    placeId: f?.placeId || null, category: f?.category || 'dish', basis: f?.basis || 'per_100g',
    kcal: f?.kcal ?? null, protein: f?.protein ?? null, carbs: f?.carbs ?? null, fat: f?.fat ?? null,
    hidden: !!f?.hidden,
    servingLabel: f?.basis === 'per_serving' ? f.portions?.[0]?.label || '1 serving' : '1 serving',
    servingG: f?.basis === 'per_serving' ? f.portions?.[0]?.grams ?? null : null,
    portions: f?.basis === 'per_serving' ? [] : (f?.portions || []).map((p) => ({ ...p })),
    source: f && !copy ? f.source || '' : '',
    sodium: f?.sodium ?? null, barcode: f?.barcode || '', sourceUrl: f?.sourceUrl || '',
  };
}

function sheetFoodForm(st) {
  const per = st.basis === 'per_serving';
  return sheetFrame(st.id ? 'Edit food' : 'Add a food', `
    ${st.note ? `<p class="note"><span>${esc(st.note)}</span></p>` : ''}
    <label class="field"><span>Name</span><input class="input" value="${esc(st.name)}" data-k="name" placeholder="e.g. Pandesal" data-autofocus></label>
    <label class="field"><span>Other names (comma-separated)</span><input class="input" value="${esc(st.aliases)}" data-k="aliases" placeholder="Helps search"></label>
    <div class="grid2">
      <label class="field"><span>Kind of food</span><select class="input" data-k="category">${CATEGORIES.map(([k, l]) => `<option value="${k}" ${k === st.category ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      ${placeSelect(st.placeId)}
    </div>
    <div><h3 style="margin-bottom:8px">Nutrition is for</h3>${chips('basis', [['per_100g', '100 grams'], ['per_serving', 'One serving']], st.basis)}</div>
    ${per ? `<div class="grid2">
      <label class="field"><span>Serving name</span><input class="input" value="${esc(st.servingLabel)}" data-k="servingLabel" placeholder="1 bowl"></label>
      <label class="field"><span>Serving weight (g)</span><input class="input" type="number" inputmode="decimal" min="0" value="${st.servingG ?? ''}" data-k="servingG" data-type="num" placeholder="If known"></label>
    </div>` : ''}
    <div class="grid4">
      <label class="field"><span>kcal</span><input class="input" type="number" inputmode="decimal" min="0" value="${st.kcal ?? ''}" data-k="kcal" data-type="num"></label>
      <label class="field"><span>Protein g</span><input class="input" type="number" inputmode="decimal" min="0" value="${st.protein ?? ''}" data-k="protein" data-type="num"></label>
      <label class="field"><span>Carbs g</span><input class="input" type="number" inputmode="decimal" min="0" value="${st.carbs ?? ''}" data-k="carbs" data-type="num"></label>
      <label class="field"><span>Fat g</span><input class="input" type="number" inputmode="decimal" min="0" value="${st.fat ?? ''}" data-k="fat" data-type="num"></label>
    </div>
    <div class="grid2">
      <label class="field"><span>Sodium mg</span><input class="input" type="number" inputmode="decimal" min="0" value="${st.sodium ?? ''}" data-k="sodium" data-type="num" placeholder="Optional"></label>
      <label class="field"><span>Barcode</span><input class="input" inputmode="numeric" value="${esc(st.barcode)}" data-k="barcode" placeholder="Optional"></label>
    </div>
    ${per ? '' : `<div><h3 style="margin-bottom:8px">Units</h3>
      ${st.portions.map((p, i) => `<div class="ing" style="grid-template-columns:1fr 96px 36px">
        <input class="input" value="${esc(p.label)}" data-portion="${i}" data-f="label" aria-label="Unit name" placeholder="1 piece">
        <input class="input" type="number" inputmode="decimal" min="0" value="${p.grams ?? ''}" data-portion="${i}" data-f="grams" aria-label="Grams" placeholder="g">
        <button type="button" class="x-btn" data-action="remove-portion" data-v="${i}" aria-label="Remove unit">×</button></div>`).join('')}
      <button type="button" class="link" data-action="add-portion" style="margin-top:8px">Add a unit, like "1 piece = 40 g"</button></div>`}
    <label class="check"><input type="checkbox" data-k="hidden" data-type="bool" ${st.hidden ? 'checked' : ''}> It's a cooking extra (oil, sugar, sauce)</label>
    <label class="field"><span>Where the numbers came from</span><input class="input" value="${esc(st.source)}" data-k="source" placeholder="e.g. Package label"></label>
    ${st.error ? `<p class="error" role="alert">${esc(st.error)}</p>` : ''}`,
  `<button type="button" class="btn primary block" data-action="save-food">Save food</button>`);
}

function saveFood() {
  const st = ui.sheet;
  if (!st.name.trim()) { st.error = 'Give the food a name.'; renderSheet(); return; }
  if (num(st.kcal) == null || st.kcal < 0) { st.error = 'Enter the calories.'; renderSheet(); return; }
  const per = st.basis === 'per_serving';
  const portions = per
    ? [{ id: 'serving', label: st.servingLabel.trim() || '1 serving', grams: st.servingG > 0 ? st.servingG : null }]
    : st.portions.filter((p) => p.label.trim() && p.grams > 0).map((p, i) => ({ id: p.id || `p${i + 1}-${uid().slice(0, 4)}`, label: p.label.trim(), grams: p.grams }));
  const old = st.id ? foodById(st.id) : null;
  const food = put('foods', {
    ...(old || {}),
    id: old?.id || uid(), owner: 'user', name: st.name.trim(),
    aliases: st.aliases.split(',').map((a) => a.trim()).filter(Boolean),
    placeId: st.placeId || null, category: st.category, basis: st.basis,
    kcal: st.kcal || 0, protein: st.protein || 0, carbs: st.carbs || 0, fat: st.fat || 0,
    hidden: !!st.hidden, portions, source: st.source.trim(), archived: false,
    sodium: st.sodium >= 0 && st.sodium != null ? st.sodium : null, barcode: (st.barcode || '').trim() || null,
    sourceUrl: st.sourceUrl || old?.sourceUrl || null,
  });
  ui.tab = 'foods';
  render();
  openFood(food.id);
  toast('Food saved');
}

/* Goals */

function sheetGoals(st) {
  return sheetFrame('Daily targets', `
    <label class="field"><span>Calories (kcal)</span><input class="input" type="number" inputmode="numeric" min="0" value="${st.kcal ?? ''}" data-k="kcal" data-type="num" data-autofocus></label>
    <div class="grid2">
      <label class="field"><span>Protein (g)</span><input class="input" type="number" inputmode="numeric" min="0" value="${st.protein ?? ''}" data-k="protein" data-type="num" placeholder="Optional"></label>
      <label class="field"><span>Carbs (g)</span><input class="input" type="number" inputmode="numeric" min="0" value="${st.carbs ?? ''}" data-k="carbs" data-type="num" placeholder="Optional"></label>
    </div>
    <label class="field"><span>Fat (g)</span><input class="input" type="number" inputmode="numeric" min="0" value="${st.fat ?? ''}" data-k="fat" data-type="num" placeholder="Optional"></label>
    <p class="muted small">New targets apply from today. Past days keep the targets they had.</p>
    ${st.error ? `<p class="error" role="alert">${esc(st.error)}</p>` : ''}`,
  `<button type="button" class="btn primary block" data-action="save-goals">Save targets</button>`);
}

function saveGoals() {
  const st = ui.sheet;
  if (!(st.kcal > 0)) { st.error = 'Enter a daily calorie target.'; renderSheet(); return; }
  if (st.kcal < C.KCAL_FLOOR) {
    st.error = `Busog doesn't set targets below ${fmt(C.KCAL_FLOOR)} kcal a day. Targets that low are best set with a doctor or dietitian.`;
    renderSheet();
    return;
  }
  const today = C.localDate();
  const existing = T.goals.find((g) => g.effectiveFrom === today);
  put('goals', { id: existing?.id || uid(), effectiveFrom: today, kcal: st.kcal, protein: st.protein || null, carbs: st.carbs || null, fat: st.fat || null });
  const s = settings();
  saveSettings({ goalConfirmed: true, plan: s.plan ? { ...s.plan, auto: false } : s.plan });
  closeSheet();
  render();
  toast('Targets saved');
}

/* ---------- Pick for me ---------- */

const DICE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/><circle cx="15.5" cy="8.5" r="1.3"/><circle cx="8.5" cy="15.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/></svg>';

const chainPlaces = () => T.places.filter((pl) => T.foods.some((f) => f.placeId === pl.id && !f.archived && !f.hidden)).sort((a, b) => a.name.localeCompare(b.name));

function foodTagLabels(f) {
  const n = f.basis === 'per_serving' ? C.pick(f) : C.forFood(f, { grams: f.portions?.[0]?.grams || 100 });
  const d = P.describe({ name: f.name, extraText: (f.aliases || []).join(' '), category: f.category, kcal: n.kcal, protein: n.protein });
  if (d.role === 'side' || d.role === 'drink') return [d.role === 'side' ? 'Side' : 'Drink'];
  const labels = [];
  for (const g of P.WANT_GROUPS) for (const [k, l] of g.options) if (d.tags.has(k)) labels.push(l);
  return labels;
}

const pantryIds = () => new Set([...activeFoods().filter((f) => f.hidden).map((f) => f.id), 'seed-garlic', 'seed-onion']);

function remainingToday() {
  const goal = C.goalOn(T.goals, ui.date);
  return goal ? goal.kcal - C.dayTotal(T.logs, ui.date).kcal : null;
}

function pickerCandidates() {
  const since = C.dateAdd(C.localDate(), -2);
  const recent = new Set(T.logs.filter((l) => l.date >= since).flatMap((l) => [l.foodId && `food:${l.foodId}`, l.recipeId && `recipe:${l.recipeId}`]).filter(Boolean));
  const pantry = pantryIds();
  const list = [];
  for (const f of activeFoods()) {
    if (f.hidden || !(f.placeId || (f.owner === 'user' && f.category === 'dish'))) continue;
    const n = f.basis === 'per_serving' ? C.pick(f) : C.forFood(f, { grams: f.portions?.[0]?.grams || 100 });
    const d = P.describe({ name: f.name, extraText: (f.aliases || []).join(' '), category: f.category, kcal: n.kcal, protein: n.protein });
    const fcost = f.basis === 'per_serving' ? C.costFor(f, { servings: 1 }) : C.costFor(f, { grams: f.portions?.[0]?.grams || 100 });
    list.push({ key: `food:${f.id}`, kind: 'food', id: f.id, placeId: f.placeId, cost: fcost, name: f.name, where: placeById(f.placeId)?.name || 'Eat out', estimate: !!f.defaultEstimate, estimateOnly: !!f.isEstimateOnly, ...n, ...d, eatenRecently: recent.has(`food:${f.id}`) });
  }
  const recipeCandidate = (r, extra) => {
    const { totals, serving } = recipeNumbers(r);
    const raw = C.recipeRawWeight(r) || 1;
    const vegShare = r.ingredients.filter((i) => foodById(i.foodId)?.category === 'vegetable').reduce((s, i) => s + i.grams, 0) / raw;
    const text = r.ingredients.map((i) => foodById(i.foodId)).filter((f) => f && !pantry.has(f.id)).map((f) => `${f.name} ${(f.aliases || []).join(' ')}`).join(' ');
    const d = P.describe({ name: r.name, extraText: text, kcal: serving.kcal, protein: serving.protein, ingredientCats: { vegShare }, presetTags: [...(r.tags || []), ...P.toolTags(r.minutes, r.tools)] });
    const ci = recipeCostInfo(r);
    return { ...serving, ...d, totals, cost: ci.complete ? ci.value : null, ingredientIds: r.ingredients.map((i) => i.foodId), ...extra };
  };
  for (const r of activeRecipes()) {
    list.push(recipeCandidate(r, { key: `recipe:${r.id}`, kind: 'recipe', id: r.id, name: r.name, where: 'Cook at home', eatenRecently: recent.has(`recipe:${r.id}`) }));
  }
  for (const b of openBatches()) {
    const r = recipeById(b.recipeId);
    const base = r ? recipeCandidate(r, {}) : { tags: new Set(), role: 'main' };
    const per = C.scale(b.totals, 1 / b.servingsMade);
    list.push({ ...base, ...per, cost: b.cost != null ? b.cost / b.servingsMade : null, key: `batch:${b.id}`, kind: 'batch', id: b.id, name: b.recipeName, where: 'Already cooked, in your pot', ingredientIds: [], eatenRecently: false });
  }
  return list;
}

function pickerOpts(st) {
  const left = remainingToday();
  return {
    source: st.source, wants: st.wants, haveIds: new Set(st.have), pantryIds: pantryIds(), basics: st.basics,
    budget: st.fit && left != null ? Math.max(0, left) : null,
    places: st.places || [],
    maxCost: st.maxCost || null,
  };
}

function haveOptions() {
  const pantry = pantryIds();
  const order = { protein: 0, vegetable: 1, grain: 2 };
  return activeFoods()
    .filter((f) => f.basis !== 'per_serving' && !pantry.has(f.id) && f.category in order)
    .sort((a, b) => order[a.category] - order[b.category] || a.name.localeCompare(b.name))
    .map((f) => [f.id, f.name.split(',')[0]]);
}

function toggleChips(key, options, selected) {
  return `<div class="chips" role="group">${options.map(([v, label]) =>
    `<button type="button" class="chip" data-action="toggle" data-k="${key}" data-v="${esc(v)}" aria-pressed="${selected.includes(v)}">${esc(label)}</button>`).join('')}</div>`;
}

function openPicker(meal) {
  const left = remainingToday();
  openSheet({ type: 'random', source: 'either', wants: [], have: [], places: [], basics: true, fit: left != null && left > 150, meal: meal || defaultMeal(), seen: [], result: null, alts: [] });
}

function sheetRandom(st) {
  const left = remainingToday();
  const groups = P.WANT_GROUPS.filter((g) => !(g.cookOnly && st.source === 'out'))
    .map((g) => `<div><h3 class="label">${esc(g.label)}</h3>${toggleChips('wants', g.options, st.wants)}</div>`).join('');
  return sheetFrame('Pick for me', `
    ${chips('source', [['either', 'Either'], ['cook', 'Cook at home'], ['out', 'Eat out']], st.source)}
    <p class="muted small">Tap anything you're craving, or nothing at all for a surprise.</p>
    ${groups}
    ${st.source !== 'cook' ? `<div><h3 class="label">Restaurants</h3>
      <p class="muted small" style="margin-bottom:8px">Leave empty for any of them.</p>
      ${toggleChips('places', chainPlaces().map((pl) => [pl.id, pl.name]), st.places)}</div>` : ''}
    ${st.source !== 'out' ? `<div><h3 class="label">What do you have at home?</h3>
      <p class="muted small" style="margin-bottom:8px">Recipes that use what you have come up first. Leave it empty to skip.</p>
      ${toggleChips('have', haveOptions(), st.have)}
      <label class="check"><input type="checkbox" data-k="basics" data-type="bool" ${st.basics ? 'checked' : ''}> I have the basics: oil, garlic, onion, soy sauce, vinegar, patis, sugar</label></div>` : ''}
    <div><h3 class="label">Budget per meal</h3>${chips('maxCost', [['', 'Any'], [50, '₱50'], [100, '₱100'], [150, '₱150'], [250, '₱250']], st.maxCost ?? '', 'num')}
      ${st.maxCost ? '<p class="muted small" style="margin-top:6px">Only meals with prices count. Add prices on any food or recipe.</p>' : ''}</div>
    ${left != null ? `<label class="check"><input type="checkbox" data-k="fit" data-type="bool" ${st.fit ? 'checked' : ''}> Only meals that fit ${hide() || left <= 0 ? 'what I have left today' : `the ${fmt(left)} kcal I have left`}</label>` : ''}
    <div id="rand-result">${randResult(st)}</div>`,
  `<button type="button" class="btn primary block spin-btn" data-action="rand-spin">${DICE}<span>${st.result ? 'Spin again' : 'Pick for me'}</span></button>`);
}

function wantLabel(k) {
  for (const g of P.WANT_GROUPS) for (const [v, l] of g.options) if (v === k) return l;
  return k;
}

function randResult(st) {
  const ranked = P.rank(pickerCandidates(), pickerOpts(st));
  if (!st.result) {
    return ranked.length
      ? `<p class="pick-count">${ranked.length} ${ranked.length === 1 ? 'option matches' : 'options match'}.</p>`
      : `<p class="result bad">Nothing fits all of that. Try fewer cravings${st.fit ? ', or turn off the calorie limit' : ''}${st.have.length ? ', or tap more of what you have' : ''}.</p>`;
  }
  const c = st.result;
  const left = remainingToday();
  const reasons = [];
  for (const w of st.wants) if (c.tags.has(w)) reasons.push(wantLabel(w));
  if (c.kind === 'batch') reasons.push('Already cooked');
  if (c.coverage && c.coverage.total) reasons.push(`You have ${c.coverage.have} of ${c.coverage.total} ingredients`);
  if (st.fit && left != null && !hide()) reasons.push(`Fits your ${fmt(left)} kcal left`);
  if (!c.eatenRecently && c.kind !== 'batch') reasons.push("Haven't had it lately");
  const missing = c.coverage?.missing?.map((id) => foodById(id)?.name.split(',')[0]).filter(Boolean) || [];
  return `
    <div class="pick-card" id="pick-card">
      <p class="pick-where">${esc(c.where)}</p>
      <p class="pick-name" id="pick-name">${esc(c.name)}</p>
      ${hide() ? '' : `<p class="pick-meta">${fmt(c.kcal)} kcal per serving, ${fmt(c.protein)} g protein${c.cost != null ? `, ${peso(c.cost)}` : ''}${c.estimateOnly ? ' (Busog estimate)' : c.estimate ? ' (US menu figures)' : ''}</p>`}
      ${reasons.length ? `<div class="reasons">${reasons.map((r) => `<span class="reason">${esc(r)}</span>`).join('')}</div>` : ''}
      ${missing.length ? `<p class="pick-missing">You'd still need ${esc(missing.join(', '))}.</p>` : ''}
      <div class="btn-row">
        ${c.kind === 'recipe' ? `<button type="button" class="btn" data-action="open-recipe" data-id="${c.id}">See recipe</button>` : ''}
        <button type="button" class="btn primary" data-action="rand-log">Log it</button>
      </div>
    </div>
    ${st.alts.length ? `<h3 class="label" style="margin-top:16px">Or maybe</h3><ul class="list alt-list">${st.alts.map((a) => `<li><button type="button" class="row" data-action="rand-alt" data-v="${esc(a.key)}">
      <span class="row-main"><span class="row-title">${esc(a.name)}</span><span class="row-sub">${esc(a.where)}</span></span>
      ${hide() ? '' : `<span class="row-num small">${fmt(a.kcal)} kcal</span>`}</button></li>`).join('')}</ul>` : ''}`;
}

function spin() {
  const st = ui.sheet;
  const ranked = P.rank(pickerCandidates(), pickerOpts(st));
  if (!ranked.length) { st.result = null; st.alts = []; renderSheet(); return; }
  const pick = P.draw(ranked, st.seen);
  st.seen.push(pick.key);
  st.result = pick;
  st.alts = ranked.filter((c) => c.key !== pick.key).sort(() => Math.random() - 0.5).slice(0, 2);
  renderSheet();
  document.querySelector('#rand-result')?.scrollIntoView({ block: 'nearest' });
  // A short shuffle through other options before landing on the pick.
  const name = $('#pick-name');
  const card = $('#pick-card');
  if (!name || ranked.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  card.classList.add('spinning');
  let n = 0;
  const timer = setInterval(() => {
    n += 1;
    if (n >= 9) {
      clearInterval(timer);
      name.textContent = pick.name;
      card.classList.remove('spinning');
      card.classList.add('landed');
      return;
    }
    name.textContent = ranked[Math.floor(Math.random() * ranked.length)].name;
  }, 70);
}

/* ---------- Weekly meal plan and grocery list ---------- */

function weekStart(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sunday
  return C.dateAdd(date, -((dow + 6) % 7));
}

function getWeek(start) {
  return T.meta.find((x) => x.id === `week:${start}`) || { id: `week:${start}`, days: {}, checked: {} };
}

const saveWeek = (w) => put('meta', w);
const PLAN_MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];

function sheetPlanner(st) {
  const w = getWeek(st.week);
  const days = Array.from({ length: 7 }, (_, i) => C.dateAdd(st.week, i));
  const count = days.reduce((n, d) => n + PLAN_MEALS.reduce((k, [m]) => k + (w.days[d]?.[m]?.length || 0), 0), 0);
  const label = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' }); };
  return sheetFrame('Meal plan', `
    <div class="week-nav">
      <button type="button" class="icon-btn" data-action="plan-week" data-v="-7" aria-label="Previous week"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <b>Week of ${esc(label(st.week).replace(/^\w+, /, ''))}</b>
      <button type="button" class="icon-btn" data-action="plan-week" data-v="7" aria-label="Next week"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
    </div>
    <div class="btn-row">
      <button type="button" class="btn" data-action="plan-suggest">${DICE}<span>Fill empty slots</span></button>
      <button type="button" class="btn" data-action="plan-grocery" ${count ? '' : 'disabled'}>Grocery list</button>
    </div>
    ${days.map((d) => `<section class="plan-day">
      <h3>${esc(label(d))}${d === C.localDate() ? ' <span class="tag">today</span>' : ''}</h3>
      ${PLAN_MEALS.map(([m, ml]) => {
        const items = (w.days[d]?.[m] || []).filter((p) => recipeById(p.recipeId));
        return `<div class="plan-slot"><span class="plan-meal">${ml}</span>
          <div class="plan-items">${items.map((p, i) => `<span class="plan-item">${esc(recipeById(p.recipeId).name)}${p.servings !== 1 ? `, ${fmtQty(p.servings)} servings` : ''}
            <button type="button" class="x-btn" data-action="plan-remove" data-date="${d}" data-meal="${m}" data-v="${i}" aria-label="Remove ${esc(recipeById(p.recipeId).name)}">×</button></span>`).join('')}
          <button type="button" class="link small" data-action="plan-add" data-date="${d}" data-meal="${m}">Add</button></div></div>`;
      }).join('')}
    </section>`).join('')}`);
}

function sheetPlanAdd(st) {
  const q = st.query.trim();
  const list = activeRecipes().filter((r) => !q || matches(q, r.name)).sort((a, b) => a.name.localeCompare(b.name));
  return sheetFrame(`Add to ${mealLabel(st.meal).toLowerCase()}`, `
    <div class="field"><span>Servings for you</span>${stepper('servings', st.servings, 0.5, 'Servings', '')}</div>
    <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>
      <input class="input" type="search" placeholder="Search recipes" value="${esc(q)}" data-search="plan" aria-label="Search recipes"></label>
    <ul class="list" id="plan-results">${planResults(st)}</ul>`);
}

function planResults(st) {
  const q = st.query.trim();
  const list = activeRecipes().filter((r) => !q || matches(q, r.name)).sort((a, b) => a.name.localeCompare(b.name));
  return list.map((r) => `<li><button type="button" class="row" data-action="plan-pick" data-id="${r.id}">
    <span class="row-main"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc({ user: 'Your recipe', student: 'Student meal', simple: 'Simple and healthy', filipino: 'Filipino home cooking' }[recipeGroup(r)] || '')}</span></span>
    ${hide() ? '' : `<span class="row-num small">${fmt(recipeNumbers(r).serving.kcal)} kcal</span>`}</button></li>`).join('') || '<li class="empty">No recipes match.</li>';
}

// Fill empty lunch and dinner slots with varied recipes that fit the target.
function suggestWeek(st) {
  const w = getWeek(st.week);
  const used = new Set();
  let added = 0;
  for (let i = 0; i < 7; i++) {
    const d = C.dateAdd(st.week, i);
    w.days[d] = w.days[d] || {};
    for (const m of ['lunch', 'dinner']) {
      if (w.days[d][m]?.length) continue;
      const goal = targetFor(d);
      const ranked = P.rank(pickerCandidates().filter((c) => c.kind === 'recipe' && !used.has(c.key)), {
        source: 'cook', wants: [], haveIds: new Set(), pantryIds: pantryIds(), basics: true, budget: goal.kcal * 0.45, places: [],
      });
      const pick = P.draw(ranked);
      if (!pick) continue;
      used.add(pick.key);
      w.days[d][m] = [{ recipeId: pick.id, servings: 1 }];
      added += 1;
    }
  }
  saveWeek(w);
  return added;
}

// By default each planned recipe is bought in full (rounded up to whole
// batches), since you cook a pot and eat the leftovers. "exact" buys only
// the planned servings.
function groceryItems(week, exact = false) {
  const w = getWeek(week);
  const servingsByRecipe = new Map();
  for (const day of Object.values(w.days)) {
    for (const items of Object.values(day)) {
      for (const p of items) if (recipeById(p.recipeId)) servingsByRecipe.set(p.recipeId, (servingsByRecipe.get(p.recipeId) || 0) + p.servings);
    }
  }
  const totals = new Map();
  for (const [rid, servings] of servingsByRecipe) {
    const r = recipeById(rid);
    const k = exact ? servings / (r.servings || 1) : Math.max(1, Math.ceil(servings / (r.servings || 1) - 1e-9));
    for (const i of r.ingredients) totals.set(i.foodId, (totals.get(i.foodId) || 0) + i.grams * k);
  }
  const pantry = pantryIds();
  return [...totals.entries()].map(([id, grams]) => ({ food: foodById(id), grams })).filter((x) => x.food)
    .map((x) => ({ ...x, pantry: pantry.has(x.food.id), cost: C.costFor(x.food, { grams: x.grams }) }));
}

function friendlyAmount(food, grams) {
  const p = (food.portions || []).find((x) => x.grams && grams / x.grams >= 0.75 && !/^1 (tsp|tbsp)/.test(x.label));
  if (p) {
    const n = Math.round((grams / p.grams) * 2) / 2;
    const base = p.label.replace(/^1 /, '');
    return `${fmtQty(n)} ${base} (${fmt(grams)} g)`;
  }
  return grams >= 1000 ? `${fmtQty(Math.round(grams / 100) / 10)} kg` : `${fmt(grams)} g`;
}

function sheetGrocery(st) {
  const w = getWeek(st.week);
  const items = groceryItems(st.week, st.exact);
  const order = ['protein', 'vegetable', 'fruit', 'grain', 'dairy', 'dish', 'snack', 'drink', 'other', 'sweet', 'sauce', 'oil'];
  const groups = {};
  for (const it of items) (groups[it.pantry ? 'pantry' : it.food.category] ||= []).push(it);
  const names = { ...Object.fromEntries(CATEGORIES), pantry: 'Check you have these basics' };
  const total = items.filter((x) => !x.pantry && x.cost != null).reduce((n, x) => n + x.cost, 0);
  const unpriced = items.filter((x) => !x.pantry && x.cost == null).length;
  const keys = [...order.filter((k) => groups[k]), ...(groups.pantry ? ['pantry'] : [])];
  return sheetFrame('Grocery list', `
    <p class="muted">For the meals planned this week. Tick things off as you shop.</p>
    ${chips('exact', [['', 'Cook full recipes'], ['1', 'Only what I planned']], st.exact ? '1' : '')}
    <p class="muted small">${st.exact ? 'Buys just enough for the servings in your plan.' : 'Buys enough to cook each recipe in full. Leftovers go in your pot for later.'}</p>
    ${total > 0 ? `<p><b>About ${peso(total)}</b>${unpriced ? ` <span class="muted">plus ${unpriced} item${unpriced === 1 ? '' : 's'} without a price</span>` : ''}</p>` : ''}
    ${keys.map((k) => `<div><h3 class="label">${esc(names[k] || 'Other')}</h3><ul class="list grocery">${groups[k].sort((a, b) => a.food.name.localeCompare(b.food.name)).map((it) => `
      <li><label class="check grocery-item ${w.checked[it.food.id] ? 'done' : ''}"><input type="checkbox" data-action="grocery-check" data-id="${it.food.id}" ${w.checked[it.food.id] ? 'checked' : ''}>
        <span class="row-main"><span class="row-title">${esc(it.food.name)}</span><span class="row-sub">${esc(friendlyAmount(it.food, it.grams))}${it.cost != null ? `, ${peso(it.cost)}` : ''}</span></span></label></li>`).join('')}</ul></div>`).join('')}
    <button type="button" class="btn block" data-action="copy-grocery">Copy list</button>`);
}

function groceryText(week, exact) {
  return groceryItems(week, exact).filter((x) => !x.pantry).map((x) => `- ${x.food.name}: ${friendlyAmount(x.food, x.grams)}`).join('\n');
}

/* ---------- Exercise ---------- */

const exerciseLabel = (id) => (H.EXERCISES.find(([k]) => k === id) || [id, 'Exercise'])[1];

function sheetExercise(st) {
  const w = latestWeight()?.weightKg;
  const kcal = H.exerciseKcal(st.exercise, st.minutes || 0, w || 60);
  return sheetFrame(st.id ? 'Edit exercise' : 'Add exercise', `
    <div class="chips" role="group">${H.EXERCISES.map(([k, l]) => `<button type="button" class="chip" data-action="set" data-k="exercise" data-v="${k}" aria-pressed="${st.exercise === k}">${esc(l)}</button>`).join('')}</div>
    <div class="field"><span>Minutes</span>${stepper('minutes', st.minutes, 5, 'Minutes', 'min', 0)}</div>
    <div class="preview" id="preview">${hide() ? '<p class="muted">Numbers are hidden.</p>' : `<strong>${fmt(kcal)} kcal</strong><span>above what you'd burn resting${w ? '' : ', using 60 kg until you log your weight'}</span>`}</div>
    <p class="muted small">${settings().exerciseBack ? 'Half of this is added to today\'s target.' : 'This doesn\'t change your target. You can turn that on in Progress.'} Estimates for exercise are rough, so Busog counts conservatively.</p>`,
  st.id
    ? `<div class="btn-row"><button type="button" class="btn danger" data-action="delete-exercise">Delete</button><button type="button" class="btn primary" data-action="save-exercise">Save changes</button></div>`
    : `<button type="button" class="btn primary block" data-action="save-exercise">Add exercise</button>`);
}

/* ---------- Barcode ---------- */

function sheetScan(st) {
  return sheetFrame('Scan a barcode', `
    ${B.canScan() ? `<div class="scan-box"><video id="scan-video" playsinline muted></video><p class="muted small">Point the camera at the barcode.</p></div>` : '<p class="muted">Your browser can\'t scan with the camera. Type the number under the barcode instead.</p>'}
    <label class="field"><span>Barcode number</span><input class="input" inputmode="numeric" value="${esc(st.code)}" data-k="code" placeholder="e.g. 4800016644290" ${B.canScan() ? '' : 'data-autofocus'}></label>
    <button type="button" class="btn primary block" data-action="lookup-code">Look it up</button>
    ${st.status ? `<p class="${st.statusBad ? 'error' : 'muted'}" role="status">${esc(st.status)}</p>` : ''}
    <p class="muted small">Busog checks your own foods first, then Open Food Facts, a free database. Philippine products are only partly covered, so you may need to copy the numbers from the label.</p>`);
}

async function lookupCode(code) {
  const st = ui.sheet;
  code = String(code || '').replace(/\D/g, '');
  if (code.length < 8) { st.status = 'Enter the full number under the barcode.'; st.statusBad = true; renderSheet(); return; }
  const local = T.foods.find((f) => f.barcode === code && !f.archived);
  if (local) { B.stopScan(); openFood(local.id); return; }
  st.code = code; st.status = 'Looking it up…'; st.statusBad = false; renderSheet();
  let draft = null;
  try {
    draft = await B.lookup(code);
  } catch {
    B.stopScan();
    const form = { ...foodFormState(null), barcode: code, basis: 'per_serving', source: 'Package label', category: 'snack' };
    openSheet({ ...form, note: "Couldn't reach Open Food Facts. Fill this in from the nutrition label on the package." });
    return;
  }
  B.stopScan();
  if (!draft) {
    const form = { ...foodFormState(null), barcode: code, basis: 'per_serving', source: 'Package label', category: 'snack' };
    openSheet({ ...form, note: 'This product isn\'t in the database yet. Copy the numbers from the nutrition label.' });
    return;
  }
  const form = foodFormState(null);
  Object.assign(form, {
    name: draft.name, basis: 'per_100g', kcal: draft.kcal, protein: draft.protein, carbs: draft.carbs, fat: draft.fat,
    sodium: draft.sodium, barcode: code, category: 'snack', source: draft.source, sourceUrl: draft.sourceUrl,
    portions: draft.servingG ? [{ label: draft.servingLabel ? `1 serving (${draft.servingLabel})` : '1 serving', grams: draft.servingG }] : [{ label: '1 pack', grams: null }],
    note: 'Found on Open Food Facts. Check the numbers against the label, then save.',
  });
  openSheet(form);
}

async function startCamera() {
  const v = $('#scan-video');
  if (!v || !B.canScan()) return;
  try {
    await B.startScan(v, (code) => lookupCode(code));
  } catch {
    const st = ui.sheet;
    if (st?.type === 'scan') { st.status = 'Camera access was blocked. Type the number instead.'; st.statusBad = true; renderSheet(); }
  }
}

/* ---------- Recipe import ---------- */

function sheetImport(st) {
  if (!st.parsed) {
    return sheetFrame('Import a recipe', `
      <p class="muted">Paste a recipe from a website, Facebook post or notes app. Busog reads the ingredient lines and matches them to its foods.</p>
      <label class="field"><span>Recipe text</span><textarea class="input import-text" data-k="text" placeholder="Chicken adobo&#10;Serves 4&#10;1 kg chicken thighs&#10;1/2 cup soy sauce&#10;1 head garlic">${esc(st.text)}</textarea></label>
      ${st.error ? `<p class="error" role="alert">${esc(st.error)}</p>` : ''}`,
    `<button type="button" class="btn primary block" data-action="import-read">Read recipe</button>`);
  }
  const foods = activeFoods().filter((f) => f.basis !== 'per_serving').sort((a, b) => a.name.localeCompare(b.name));
  const matched = st.parsed.lines.filter((l) => l.food && l.grams);
  return sheetFrame('Check the ingredients', `
    <p class="muted">${matched.length} of ${st.parsed.lines.length} lines matched. Fix any that are wrong, then continue to edit the recipe.</p>
    ${st.parsed.lines.map((l, i) => `<div class="import-line ${l.food && l.grams ? '' : 'warn'}">
      <p class="small">${esc(l.text)}</p>
      <div class="import-fix">
        <select class="input" data-imp="${i}" data-f="foodId" aria-label="Food for ${esc(l.text)}">
          <option value="">Skip this line</option>
          ${foods.map((f) => `<option value="${f.id}" ${l.food?.id === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
        </select>
        <label class="unit-input"><input class="input" type="number" inputmode="decimal" min="0" value="${l.grams != null ? Math.round(l.grams) : ''}" data-imp="${i}" data-f="grams" aria-label="Grams"><span>g</span></label>
      </div></div>`).join('')}`,
  `<div class="btn-row"><button type="button" class="btn" data-action="import-back">Back</button><button type="button" class="btn primary" data-action="import-continue">Continue</button></div>`);
}

/* ---------- Reminders and portion guide ---------- */

function sheetReminders(st) {
  return sheetFrame('Meal reminders', `
    <p class="muted">Busog runs in your browser, so it can't send notifications on its own. Add daily reminders to your phone's calendar instead, and Busog will also note any meal you haven't logged yet when you open it.</p>
    ${PLAN_MEALS.map(([m, l]) => `<label class="field"><span>${l}</span><input class="input" type="time" value="${esc(st.times[m])}" data-time="${m}"></label>`).join('')}
    <div class="btn-row"><button type="button" class="btn" data-action="copy-ics">Copy calendar file</button><button type="button" class="btn primary" data-action="download-ics">Add to calendar</button></div>
    <p class="muted small">"Add to calendar" downloads a file your phone's calendar can open. If nothing happens, copy it, save it as busog-reminders.ics and open that file.</p>`,
  `<button type="button" class="btn block" data-action="save-reminders">Save times</button>`);
}

function icsText(times) {
  const start = C.localDate().replace(/-/g, '');
  const ev = PLAN_MEALS.map(([m, l]) => {
    const [h, mm] = times[m].split(':');
    return ['BEGIN:VEVENT', `UID:busog-${m}@busog.app`, `DTSTAMP:${start}T000000Z`, `DTSTART:${start}T${h}${mm}00`,
      'DURATION:PT10M', 'RRULE:FREQ=DAILY', `SUMMARY:Log ${l.toLowerCase()} in Busog`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:Log ${l.toLowerCase()} in Busog`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Busog//Meal reminders//EN', ...ev, 'END:VCALENDAR'].join('\r\n');
}

function sheetPortionGuide() {
  const rows = [
    ['Closed fist', 'About 1 cup', 'Rice, pasta, cooked vegetables, a serving of ulam'],
    ['Palm', 'About 100 g', 'Meat, chicken or fish, the size and thickness of your palm'],
    ['Cupped hand', 'About ½ cup', 'Fruit, beans, a small snack'],
    ['Thumb', 'About 1 tablespoon', 'Oil, butter, peanut butter, mayo, sauces'],
    ['Thumb tip', 'About 1 teaspoon', 'Sugar, a dab of oil'],
  ];
  return sheetFrame('Portions without a scale', `
    <p class="muted">Your hand goes everywhere you eat. Use it to estimate when you can't weigh food. Busog offers these as units when you log.</p>
    <table class="facts"><tbody>${rows.map(([h, a, f]) => `<tr><td><b>${h}</b><br><span class="muted small">${f}</span></td><td>${a}</td></tr>`).join('')}</tbody></table>
    <p class="muted small">Hands vary, so these are rough. Mark entries as estimates when you're unsure.</p>`);
}

/* ---------- Other actions ---------- */

function copyYesterday() {
  const from = C.dateAdd(ui.date, -1);
  const src = T.logs.filter((l) => l.date === from && l.kind !== 'batch');
  const now = new Date().toISOString();
  putMany('logs', src.map((l) => ({ ...l, id: uid(), date: ui.date, eatenAt: now })));
  render();
  toast(`Copied ${src.length} item${src.length === 1 ? '' : 's'}`);
}

async function saveUsual(meal) {
  const entries = T.logs.filter((l) => l.date === ui.date && l.meal === meal);
  const res = await ask({
    title: 'Save as a usual meal',
    message: `Log these ${entries.length} items together in one tap next time.`,
    fields: [{ id: 'name', label: 'Name', value: `My usual ${mealLabel(meal).toLowerCase()}` }],
    ok: 'Save',
  });
  const name = res?.name.trim();
  if (!name) return;
  const items = entries.map((e) => {
    if (e.kind === 'food') return { kind: 'food', foodId: e.foodId, quantity: e.quantity, portionId: e.portionId };
    if (e.kind === 'recipe') return { kind: 'recipe', recipeId: e.recipeId, servings: e.servings };
    if (e.kind === 'batch') return { kind: 'recipe', recipeId: e.recipeId, servings: Math.round((e.batchFraction || 0) * (batchById(e.batchId)?.servingsMade || 1) * 10) / 10 || 1 };
    return { kind: 'quick', name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat };
  });
  const withPlace = entries.find((e) => e.placeId);
  put('savedMeals', { id: uid(), name, items, origin: withPlace?.origin || 'home', placeId: withPlace?.placeId || null });
  toast('Saved as a usual meal');
}

function logSaved(id, meal, date) {
  const m = T.savedMeals.find((x) => x.id === id);
  const made = [];
  for (const it of m.items) {
    if (it.kind === 'food' && (!foodById(it.foodId) || foodById(it.foodId).archived)) continue;
    if (it.kind === 'recipe' && !recipeById(it.recipeId)) continue;
    const ref = it.kind === 'food' ? it.foodId : it.kind === 'recipe' ? it.recipeId : null;
    const f = newEntryForm(it.kind, ref, meal, date);
    Object.assign(f, {
      quantity: it.quantity ?? f.quantity, portionId: it.portionId ?? f.portionId, servings: it.servings ?? f.servings,
      name: it.name ?? '', kcal: it.kcal ?? null, protein: it.protein ?? null, carbs: it.carbs ?? null, fat: it.fat ?? null,
      origin: m.origin || f.origin, placeId: m.placeId || f.placeId,
    });
    made.push(entryFromForm(f));
  }
  putMany('logs', made);
  ui.date = date;
  ui.tab = 'today';
  closeSheet();
  render();
  toast(`Logged ${m.name}`);
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Exports open a sheet with the text, a Copy button and a Download button.
// Download works when the app runs from its own site; Copy works everywhere.
function sheetExport(st) {
  return sheetFrame(st.title, `
    <p>${esc(st.help)}</p>
    <textarea class="input export-text" id="export-text" readonly aria-label="${esc(st.title)}">${esc(st.text)}</textarea>
    <p class="muted small">If Download does nothing on your device, use Copy and paste it into a file named ${esc(st.filename)}.</p>`,
  `<div class="btn-row"><button type="button" class="btn" data-action="copy-export">Copy</button>
    <button type="button" class="btn primary" data-action="download-export">Download</button></div>`);
}

async function copyExport() {
  const text = ui.sheet.text;
  try {
    await navigator.clipboard.writeText(text);
    if (ui.sheet.backup) saveSettings({ lastBackupAt: new Date().toISOString() });
    toast('Copied');
  } catch {
    const ta = $('#export-text');
    ta.focus();
    ta.select();
    toast('Selected. Copy it from here.');
  }
}

function exportJson() {
  const data = {};
  for (const k of Object.keys(T)) data[k] = T[k];
  openSheet({
    type: 'export', title: 'Back up', backup: true,
    help: 'This is everything in Busog: foods, recipes, pots, log and settings. Keep it somewhere safe and use Restore to bring it back.',
    filename: `busog-backup-${C.localDate()}.json`, mime: 'application/json',
    text: JSON.stringify({ app: 'busog', version: 1, exportedAt: new Date().toISOString(), data }, null, 2),
  });
}

function exportCsv() {
  const cols = ['date', 'meal', 'name', 'amount', 'kind', 'origin', 'place', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'extras_kcal', 'is_estimate', 'batch_fraction'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [...T.logs].sort((a, b) => (a.eatenAt < b.eatenAt ? -1 : 1)).map((l) => {
    const extrasKcal = (l.extras || []).reduce((s, x) => s + x.kcal, 0);
    return [l.date, l.meal, l.name, l.amountLabel, l.kind, l.origin, placeById(l.placeId)?.name || '', l.kcal, l.protein, l.carbs, l.fat, Math.round(extrasKcal * 10) / 10, l.isEstimate ? 1 : 0, l.batchFraction ?? ''].map(q).join(',');
  });
  openSheet({
    type: 'export', title: 'Export food log',
    help: `${T.logs.length} entries, one row each, ready for a spreadsheet, pandas or R.`,
    filename: `busog-log-${C.localDate()}.csv`, mime: 'text/csv',
    text: [cols.join(','), ...rows].join('\n'),
  });
}

async function importJson(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
    if (parsed.app !== 'busog' || !parsed.data) throw new Error('not a backup');
  } catch {
    await ask({ title: "Couldn't restore", message: 'That file is not a Busog backup. Choose the .json file made by Back up.', cancel: null });
    return;
  }
  const ok = await ask({ title: 'Restore this backup?', message: 'Restoring replaces everything in Busog on this device with the backup.', ok: 'Restore', danger: true });
  if (!ok) return;
  await clearAll();
  for (const [store, rows] of Object.entries(parsed.data)) if (T[store] && Array.isArray(rows)) putMany(store, rows);
  seedIfNeeded();
  lastBowlShift = null;
  render();
  toast('Backup restored');
}

/* A sample day, loaded on first run so the app opens showing what it does.
   Every sample row is marked and can be cleared in one tap. */
function loadSampleDay() {
  const date = C.localDate();
  const r = recipeById('seed-recipe-adobo');
  if (!r) return;
  const b = put('batches', {
    id: uid(), recipeId: r.id, recipeName: r.name, cookedAt: new Date().toISOString(), date,
    cookedWeightG: 950, servingsMade: 6, totals: C.round1(recipeNumbers(r).totals), finished: false, isSample: true,
  });
  const start = Date.now();
  const mk = (i, kind, ref, meal, patch = {}) => {
    const f = newEntryForm(kind, ref, meal, date);
    Object.assign(f, patch, { eatenAt: new Date(start + i * 1000).toISOString() });
    return { ...entryFromForm(f), isSample: true };
  };
  putMany('logs', [
    mk(0, 'food', 'seed-eggdesal', 'breakfast'),
    mk(1, 'food', 'seed-coffee', 'breakfast'),
    mk(2, 'batch', b.id, 'lunch', { batchMode: 'grams', grams: 180 }),
    mk(3, 'food', 'seed-rice', 'lunch'),
    mk(4, 'quick', null, 'snack', { name: 'Halo-halo', kcal: 350, origin: 'takeout' }),
  ]);
}

/* Five weeks of made-up but realistic logs and weigh-ins, so the trend,
   learned maintenance and insights can be seen before real data builds up.
   The sample person's true maintenance is 2,250 kcal; Busog has to find it.
   Never overwrites a real entry or weigh-in. */
function loadDemoWeeks() {
  const r = N.seeded(20261102);
  const today = C.localDate();
  const TRUE_MAINT = 2250;
  const M = (name, kcal, protein, carbs, fat, sodium, cost, origin = 'home') => ({ name, kcal, protein, carbs, fat, sodium, cost, origin });
  const menu = {
    breakfast: [M('Pandesal with egg', 330, 14, 42, 11, 520, 25), M('Tapsilog', 680, 32, 70, 28, 1250, 95, 'dine_in'), M('Oatmeal with banana', 300, 9, 55, 5, 80, 22), M('Champorado', 420, 9, 78, 8, 120, 30)],
    lunch: [M('Chicken adobo with rice', 640, 33, 70, 22, 980, 70), M('Jollibee Chickenjoy with rice', 610, 30, 52, 30, 1150, 120, 'dine_in'), M('Sinigang na baboy with rice', 560, 26, 68, 18, 1100, 75), M('Carinderia two-ulam meal', 720, 28, 85, 28, 1300, 90, 'takeout'), M('Pancit canton (instant)', 400, 8, 52, 18, 1250, 20)],
    dinner: [M('Tinola with rice', 480, 30, 60, 12, 850, 65), M('Ginisang monggo with rice', 520, 22, 82, 11, 700, 40), M('Mang Inasal Paa with rice', 650, 35, 66, 25, 1050, 140, 'dine_in'), M('Bangus with rice', 560, 30, 60, 20, 650, 80)],
    snack: [M('Milk tea, 50% sugar', 350, 3, 60, 10, 90, 110, 'takeout'), M('Banana', 105, 1, 27, 0, 1, 10), M('Turon', 280, 2, 45, 11, 30, 15, 'takeout'), M('Fishball, 10 pcs', 190, 7, 22, 8, 600, 20, 'takeout')],
  };
  const pickOne = (arr) => arr[Math.floor(r() * arr.length)];
  const haveW = new Set(T.weights.map((w) => w.id));
  const logs = []; const weights = [];
  let kg = planWeight() ?? 70;
  kg += 1.6; // start a little heavier so the trend has somewhere to go
  for (let i = 35; i >= 1; i--) {
    const date = C.dateAdd(today, -i);
    const [yy, mm, dd] = date.split('-').map(Number);
    const weekend = [0, 6].includes(new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay());
    const meals = ['breakfast', 'lunch', 'dinner'];
    if (weekend || r() < 0.5) meals.push('snack');
    if (weekend && r() < 0.6) meals.push('snack');
    let eaten = 0;
    const skipDay = r() < 0.12; // some days go unlogged
    const partDay = !skipDay && r() < 0.1; // and some only get lunch logged
    meals.forEach((meal, k) => {
      const m = pickOne(menu[meal]);
      eaten += m.kcal;
      if (!skipDay && (!partDay || meal === 'lunch')) {
        logs.push({
          id: uid(), date, eatenAt: `${date}T0${k + 7}:00:00.000Z`, meal, kind: 'quick', foodId: null, recipeId: null, batchId: null,
          name: m.name, amountLabel: '1 serving', quantity: 1, portionId: null, grams: null, servings: null, batchMode: null, share: null, batchFraction: null,
          kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, sodium: m.sodium, cost: m.cost, costPaid: null, extras: [],
          isEstimate: m.origin !== 'home', origin: m.origin, placeId: null, note: '', isSample: true,
        });
      }
    });
    kg += (eaten - TRUE_MAINT) / N.KCAL_PER_KG;
    if (r() < 0.75 && !haveW.has(date)) weights.push({ id: date, weightKg: Math.round((kg + N.gauss(r) * 0.5) * 10) / 10, isSample: true });
  }
  putMany('logs', logs);
  putMany('weights', weights);
}

function clearSample() {
  for (const l of T.logs.filter((x) => x.isSample)) remove('logs', l.id);
  for (const b of T.batches.filter((x) => x.isSample)) remove('batches', b.id);
  for (const w of T.weights.filter((x) => x.isSample)) remove('weights', w.id);
  if (settings().useLearned && !learnedMaintenance().ready) { saveSettings({ useLearned: false }); applyPlan(); }
  lastBowlShift = null;
  render();
  toast('Sample data cleared');
}

/* ---------- Events ---------- */

function setField(st, el) {
  const key = el.dataset.k;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.type === 'num') v = num(v);
  if (el.dataset.type === 'bool' && el.type !== 'checkbox') v = v === 'true';
  st[key] = v;
}

function bindEvents() {
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dialog) closeDialog(false);
      else if (ui.sheet) closeSheet();
    }
    if (e.key === 'Enter' && dialog && e.target.closest?.('#dialog') && e.target.tagName === 'INPUT') closeDialog(true);
  });
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importJson(file);
    e.target.value = '';
  });
}

function onInput(e) {
  const el = e.target;
  const st = ui.sheet;
  if (el.dataset.search === 'foods') { ui.foodQuery = el.value; $('#food-results').innerHTML = foodResults(); return; }
  if (el.dataset.search === 'pick' && st) { st.query = el.value; $('#pick-results').innerHTML = pickResults(st); return; }
  if (el.dataset.search === 'ing' && st) { st.query = el.value; $('#ing-results').innerHTML = ingResults(st); return; }
  if (el.dataset.search === 'plan' && st) { st.query = el.value; $('#plan-results').innerHTML = planResults(st); return; }
  if (el.dataset.imp != null && st?.parsed) {
    const line = st.parsed.lines[Number(el.dataset.imp)];
    if (el.dataset.f === 'foodId') line.food = el.value ? foodById(el.value) : null;
    else line.grams = num(el.value);
    el.closest('.import-line')?.classList.toggle('warn', !(line.food && line.grams > 0));
    return;
  }
  if (el.dataset.time && st) { st.times[el.dataset.time] = el.value; return; }
  if (!st) return;
  if (el.dataset.ing != null) {
    const ing = st.ingredients[Number(el.dataset.ing)];
    ing[el.dataset.f] = el.dataset.f === 'quantity' ? num(el.value) : el.value;
    const small = el.closest('.ing')?.querySelector('.ing-name small');
    if (small) small.textContent = `${fmtQty(ingGrams(ing))} g`;
    updateRecipePreview(st);
    return;
  }
  if (el.dataset.price != null) {
    const row = st.rows[el.dataset.price];
    row[el.dataset.f] = el.dataset.f === 'pricePortion' ? el.value : num(el.value);
    return;
  }
  if (el.dataset.portion != null) {
    const p = st.portions[Number(el.dataset.portion)];
    p[el.dataset.f] = el.dataset.f === 'grams' ? num(el.value) : el.value;
    return;
  }
  if (el.dataset.k && el.type !== 'checkbox' && el.tagName !== 'SELECT') {
    setField(st, el);
    if (el.dataset.live) liveUpdate(st);
  }
}

function liveUpdate(st) {
  if (st.type === 'entry' && $('#preview')) $('#preview').innerHTML = previewHtml(st);
  if (st.type === 'recipe-form') updateRecipePreview(st);
  if (st.type === 'setup' && $('#plan-live')) $('#plan-live').innerHTML = planLive(st);
}

function updateRecipePreview(st) {
  const p = $('#preview');
  if (!p || hide()) return;
  const fake = { ingredients: st.ingredients.map((i) => ({ ...i, grams: ingGrams(i) })) };
  const totals = C.recipeTotals(fake, foodById);
  const per = C.perServing(totals, st.servings || 1);
  p.innerHTML = `<strong>${fmt(per.kcal)} kcal</strong><span>per serving, ${fmt(totals.kcal)} kcal in total</span>`;
}

function onChange(e) {
  const el = e.target;
  const st = ui.sheet;
  if (el.dataset.action === 'grocery-check' && st) {
    const w = getWeek(st.week);
    w.checked[el.dataset.id] = el.checked;
    saveWeek(w);
    el.closest('.grocery-item')?.classList.toggle('done', el.checked);
    return;
  }
  if (el.dataset.action === 'toggle-learned') {
    saveSettings({ useLearned: el.checked });
    const res = applyPlan();
    render();
    toast(el.checked ? `Plan now uses your learned maintenance${res?.ok ? `: ${fmt(res.kcal)} kcal a day` : ''}` : 'Plan uses the formula again');
    return;
  }
  if (el.dataset.action === 'toggle-exercise-back') {
    saveSettings({ exerciseBack: el.checked });
    render();
    return;
  }
  if (el.dataset.action === 'toggle-hide') {
    saveSettings({ hideNumbers: el.checked });
    lastBowlShift = null;
    render();
    return;
  }
  if (!st) return;
  if (el.dataset.ing != null && el.tagName === 'SELECT') {
    st.ingredients[Number(el.dataset.ing)].portionId = el.value;
    renderSheet();
    return;
  }
  if (el.dataset.k && (el.tagName === 'SELECT' || el.type === 'checkbox')) {
    if (el.dataset.k === 'placeId' && el.value === '__new') {
      addPlace().then((id) => {
        st.placeId = id || st.placeId;
        renderSheet();
      });
      return;
    }
    setField(st, el);
    if (st.type === 'entry' && el.dataset.k === 'portionId') {
      const food = foodById(st.refId);
      if (el.value === 'g') st.quantity = 100; else if (food) st.quantity = 1;
    }
    if (st.type === 'random') { st.result = null; st.alts = []; st.seen = []; renderSheet(); return; }
    if (el.dataset.rerender || el.dataset.k === 'portionId') renderSheet();
    else if (st.type === 'entry' && $('#preview')) $('#preview').innerHTML = previewHtml(st);
  }
}

function onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.tagName === 'INPUT') return;
  const a = btn.dataset.action;
  const v = btn.dataset.v;
  const id = btn.dataset.id;
  const st = ui.sheet;

  switch (a) {
    case 'tab': ui.tab = v; if (v === 'today') lastBowlShift = null; render(); $('#view').focus(); window.scrollTo(0, 0); break;
    case 'day': ui.date = C.dateAdd(ui.date, Number(v)); render(); break;
    case 'go-day': ui.date = v === 'today' ? C.localDate() : v; render(); break;
    case 'quick-pick': {
      const f = newEntryForm(btn.dataset.kind, id, btn.dataset.meal, ui.date);
      if (btn.dataset.servings) f.servings = num(btn.dataset.servings);
      openSheet(f);
      break;
    }
    case 'dismiss-low': saveSettings({ lowIntakeDismissed: C.localDate() }); render(); break;
    case 'open-planner': openSheet({ type: 'planner', week: weekStart(C.localDate()) }); break;
    case 'open-grocery': openSheet({ type: 'grocery', week: weekStart(C.localDate()) }); break;
    case 'plan-week': st.week = C.dateAdd(st.week, Number(v)); st.keepScroll = false; renderSheet(); break;
    case 'plan-add': openSheet({ type: 'plan-add', week: st.week, date: btn.dataset.date, meal: btn.dataset.meal, servings: 1, query: '' }); break;
    case 'plan-pick': {
      const w = getWeek(st.week);
      w.days[st.date] = w.days[st.date] || {};
      (w.days[st.date][st.meal] ||= []).push({ recipeId: id, servings: st.servings || 1 });
      saveWeek(w);
      openSheet({ type: 'planner', week: st.week });
      render();
      toast('Added to your plan');
      break;
    }
    case 'plan-remove': {
      const w = getWeek(st.week);
      w.days[btn.dataset.date]?.[btn.dataset.meal]?.splice(Number(v), 1);
      saveWeek(w); renderSheet(); render();
      break;
    }
    case 'plan-suggest': {
      const n = suggestWeek(st);
      renderSheet(); render();
      toast(n ? `Added ${n} meal${n === 1 ? '' : 's'}` : 'No empty lunch or dinner slots');
      break;
    }
    case 'plan-grocery': openSheet({ type: 'grocery', week: st.week }); break;
    case 'copy-grocery':
      navigator.clipboard.writeText(groceryText(st.week, st.exact)).then(() => toast('List copied'), () => toast("Couldn't copy on this device"));
      break;
    case 'open-exercise': openSheet({ type: 'exercise', id: null, exercise: 'walk', minutes: 30, date: ui.date }); break;
    case 'edit-exercise': {
      const a = T.activities.find((x) => x.id === id);
      openSheet({ type: 'exercise', id, exercise: a.exercise, minutes: a.minutes, date: a.date });
      break;
    }
    case 'save-exercise': {
      if (!(st.minutes > 0)) { toast('Enter how many minutes'); break; }
      const kcal = Math.round(H.exerciseKcal(st.exercise, st.minutes, latestWeight()?.weightKg || 60));
      put('activities', { id: st.id || uid(), date: st.date || ui.date, exercise: st.exercise, minutes: st.minutes, kcal });
      closeSheet(); render(); toast(st.id ? 'Exercise updated' : 'Exercise added');
      break;
    }
    case 'delete-exercise': remove('activities', st.id); closeSheet(); render(); toast('Exercise deleted'); break;
    case 'open-scan': openSheet({ type: 'scan', code: '', status: '' }); startCamera(); break;
    case 'lookup-code': lookupCode(st.code); break;
    case 'open-import': openSheet({ type: 'import', text: '', parsed: null }); break;
    case 'import-read': {
      if (!st.text.trim()) { st.error = 'Paste a recipe first.'; renderSheet(); break; }
      const parsed = I.parseRecipe(st.text, activeFoods().filter((f) => f.basis !== 'per_serving'));
      if (!parsed.lines.length) { st.error = 'No ingredient lines found. Put each ingredient on its own line, like "2 cups rice".'; renderSheet(); break; }
      st.error = null; st.parsed = parsed; st.keepScroll = false; renderSheet();
      break;
    }
    case 'import-back': st.parsed = null; renderSheet(); break;
    case 'import-continue': {
      const ings = st.parsed.lines.filter((l) => l.food && l.grams > 0).map((l) => ({ foodId: l.food.id, quantity: Math.round(l.grams), portionId: 'g', grams: Math.round(l.grams) }));
      if (!ings.length) { toast('Match at least one ingredient'); break; }
      const form = recipeFormState(null);
      Object.assign(form, { name: st.parsed.name || 'Imported recipe', servings: st.parsed.servings || 4, ingredients: ings });
      openSheet(form);
      break;
    }
    case 'open-reminders': openSheet({ type: 'reminders', times: { ...MEAL_TIMES, ...(settings().reminders || {}) } }); break;
    case 'save-reminders': saveSettings({ reminders: st.times }); closeSheet(); render(); toast('Reminder times saved'); break;
    case 'copy-ics':
      saveSettings({ reminders: st.times });
      navigator.clipboard.writeText(icsText(st.times)).then(() => toast('Calendar file copied'), () => toast("Couldn't copy on this device"));
      break;
    case 'download-ics': saveSettings({ reminders: st.times }); download('busog-reminders.ics', icsText(st.times), 'text/calendar'); break;
    case 'open-portions': openSheet({ type: 'portions' }); break;
    case 'open-insights': openSheet({ type: 'insights' }); break;
    case 'open-missed':
      // "I just didn't log everything" is an answer in itself: mark those days.
      if (btn.dataset.partial) { for (const d of btn.dataset.dates.split(',')) if (!dayMarks()[d]) setMark(d, { status: 'partial' }); render(); }
      openSheet({ type: 'missed', dates: btn.dataset.dates ? btn.dataset.dates.split(',') : missedDays(Number(btn.dataset.back) || 7) }); break;
    case 'leave-missed': {
      for (const d of missedDays()) setMark(d, { status: dayInfo(d).logged ? 'partial' : 'skip' });
      render(); toast('Left blank. Busog fills them in from your usual days');
      break;
    }
    case 'mark-day': {
      const date = btn.dataset.date;
      const cur = dayMarks()[date];
      const v2 = btn.dataset.v;
      const info = dayInfo(date);
      if (N.ROUGH_LEVELS.some(([k]) => k === v2)) {
        if (cur?.status === 'rough' && cur.level === v2) setMark(date, null);
        else setMark(date, { status: 'rough', level: v2, kcal: N.roughKcal(v2, typicalKcal(), info.logged) });
      } else if (cur?.status === v2) setMark(date, null);
      else setMark(date, { status: v2 });
      if (ui.sheet) renderSheet();
      render();
      break;
    }
    case 'load-demo': loadDemoWeeks(); render(); toast('Sample weeks loaded. Clear them any time.'); break;
    case 'step': {
      const key = btn.dataset.k;
      const step = num(v);
      const min = num(btn.dataset.min) ?? 0;
      const decimals = Math.abs(step) < 1 ? 2 : 0;
      const cur = num(st[key]) ?? (key === 'targetKg' ? num(st.weightKg) : null) ?? (step > 0 ? min - step : min);
      const next = Math.max(min, Math.round((cur + step) * 10 ** decimals) / 10 ** decimals);
      st[key] = next;
      const input = btn.parentElement.querySelector('input');
      if (input) input.value = next;
      liveUpdate(st);
      break;
    }
    case 'weight-step': {
      const input = $('#weight-input');
      const cur = num(input.value) ?? latestWeight()?.weightKg ?? 60;
      input.value = Math.round((cur + num(v)) * 10) / 10;
      break;
    }
    case 'setup': {
      const step = Number(v) || 1;
      const state = setupState(step);
      if (step > 1 && H.profileProblem(state)) state.step = 1;
      openSheet(state);
      break;
    }
    case 'setup-next': setupNext(); break;
    case 'setup-back': st.step -= 1; st.error = null; st.keepScroll = false; renderSheet(); break;
    case 'save-plan': savePlan(); break;
    case 'plan-auto': {
      saveSettings({ plan: { ...settings().plan, auto: true } });
      applyPlan(); render(); toast('Targets follow your plan again');
      break;
    }
    case 'plan-maintain': {
      const cur = latestWeight()?.weightKg;
      saveSettings({ plan: { ...settings().plan, goal: 'maintain', targetKg: cur, startKg: cur, startDate: C.localDate(), rate: 0, auto: true } });
      applyPlan(); render(); toast('Now keeping steady');
      break;
    }
    case 'close': closeSheet(); break;
    case 'set': {
      let val = v;
      if (btn.dataset.type === 'num') val = num(v);
      st[btn.dataset.k] = val;
      if (st.type === 'entry' && btn.dataset.k === 'origin' && val !== 'home' && !st.placeId && st.kind === 'food') st.placeId = foodById(st.refId)?.placeId || null;
      st.error = null;
      if (st.type === 'random') {
        st.result = null; st.alts = []; st.seen = [];
        if (btn.dataset.k === 'source' && val === 'out') {
          const cookOnly = P.WANT_GROUPS.filter((g) => g.cookOnly).flatMap((g) => g.options.map(([k]) => k));
          st.wants = st.wants.filter((w) => !cookOnly.includes(w));
        }
      }
      renderSheet();
      break;
    }
    case 'toggle': {
      const arr = st[btn.dataset.k];
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1); else arr.push(v);
      st.result = null; st.alts = []; st.seen = [];
      renderSheet();
      break;
    }
    case 'open-picker': openPicker(st?.meal || btn.dataset.meal); break;
    case 'rand-spin': spin(); break;
    case 'rand-alt': {
      const alt = st.alts.find((a) => a.key === v);
      if (alt) { st.alts = [st.result, ...st.alts.filter((a) => a.key !== v)]; st.result = alt; renderSheet(); }
      break;
    }
    case 'rand-log': {
      const c = st.result;
      openSheet(newEntryForm(c.kind, c.id, st.meal, ui.tab === 'today' ? ui.date : C.localDate()));
      break;
    }
    case 'open-log': openSheet({ type: 'pick', meal: btn.dataset.meal || defaultMeal(), date: ui.tab === 'today' ? ui.date : C.localDate(), query: '' }); break;
    case 'pick': {
      if (btn.dataset.kind === 'saved') { logSaved(id, st.meal, st.date); break; }
      openSheet(newEntryForm(btn.dataset.kind, id, st.meal, st.date));
      break;
    }
    case 'quick-add': openSheet(newEntryForm('quick', null, st?.meal || defaultMeal(), st?.date || ui.date)); break;
    case 'edit-entry': openSheet(entryForm(T.logs.find((l) => l.id === id))); break;
    case 'save-entry': saveEntry(); break;
    case 'delete-entry':
      ask({ title: 'Delete this entry?', message: `${st.name || 'This entry'} will be removed from ${dateLabel(st.date).toLowerCase() === 'today' ? 'today' : dateLabel(st.date)}.`, ok: 'Delete', danger: true }).then((ok) => {
        if (!ok) return;
        const entry = T.logs.find((l) => l.id === st.entryId);
        remove('logs', st.entryId);
        if (entry?.batchId) {
          const b = batchById(entry.batchId);
          if (b?.finished && C.batchLeft(b, T.logs) >= 0.05) put('batches', { ...b, finished: false });
        }
        closeSheet(); render(); toast('Entry deleted');
      });
      break;
    case 'dialog-ok': closeDialog(true); break;
    case 'dialog-cancel': closeDialog(false); break;
    case 'copy-export': copyExport(); break;
    case 'download-export':
      download(st.filename, st.text, st.mime);
      if (st.backup) { saveSettings({ lastBackupAt: new Date().toISOString() }); render(); }
      break;
    case 'clear-sample': clearSample(); break;
    case 'add-oil': st.extras.push({ foodId: 'seed-oil', grams: num(v) }); renderSheet(); break;
    case 'add-extra':
      if (st.extraFood && st.extraGrams > 0) { st.extras.push({ foodId: st.extraFood, grams: st.extraGrams }); renderSheet(); }
      break;
    case 'remove-extra': st.extras.splice(Number(v), 1); renderSheet(); break;
    case 'copy-yesterday': copyYesterday(); break;
    case 'save-usual': saveUsual(btn.dataset.meal); break;

    case 'new-recipe': openSheet(recipeFormState(null)); break;
    case 'open-recipe': openSheet({ type: 'recipe', id }); break;
    case 'edit-recipe': openSheet(recipeFormState(recipeById(id))); break;
    case 'add-ing': {
      const food = foodById(id);
      const portionId = food.portions?.[0]?.id || 'g';
      st.ingredients.push({ foodId: id, quantity: portionId === 'g' ? 100 : 1, portionId });
      st.query = '';
      st.error = null;
      renderSheet();
      break;
    }
    case 'remove-ing': st.ingredients.splice(Number(v), 1); renderSheet(); break;
    case 'save-recipe': saveRecipe(); break;
    case 'log-recipe': openSheet(newEntryForm('recipe', id, defaultMeal(), C.localDate())); break;
    case 'cook': {
      const r = recipeById(id);
      openSheet({ type: 'batch-form', recipeId: id, cookedWeightG: r.expectedCookedG || null, servingsMade: r.servings });
      break;
    }
    case 'save-batch': saveBatch(); break;
    case 'open-batch': openSheet({ type: 'batch', id }); break;
    case 'log-batch': openSheet(newEntryForm('batch', id, defaultMeal(), C.localDate())); break;
    case 'finish-batch': put('batches', { ...batchById(id), finished: true }); closeSheet(); render(); toast('Marked as finished'); break;
    case 'unfinish-batch': put('batches', { ...batchById(id), finished: false }); renderSheet(); render(); break;

    case 'food-filter': ui.foodFilter = v; ui.foodPlace = ''; render(); break;
    case 'food-place': ui.foodPlace = v; render(); break;
    case 'open-food': openFood(id); break;
    case 'recipe-prices': {
      const r = recipeById(id);
      const rows = {};
      for (const i of r.ingredients) { const f = foodById(i.foodId); if (f) rows[f.id] = priceState(f); }
      openSheet({ type: 'prices', recipeId: id, rows });
      break;
    }
    case 'save-prices': {
      let n = 0;
      for (const [fid, row] of Object.entries(st.rows)) {
        const f = foodById(fid);
        if (row.priceAmount > 0 && savePrice(f, row)) n += 1;
      }
      const rid = st.recipeId;
      openSheet({ type: 'recipe', id: rid });
      render();
      toast(`Saved ${n} price${n === 1 ? '' : 's'}`);
      break;
    }
    case 'save-price': {
      const ok = savePrice(foodById(id), st);
      if (!ok) { toast('Enter how much the price is for'); break; }
      Object.assign(st, priceState(foodById(id)));
      renderSheet(); render(); toast(st.priceAmount ? 'Price saved' : 'Price removed');
      break;
    }
    case 'new-food': openSheet(foodFormState(null)); break;
    case 'edit-food': openSheet(foodFormState(foodById(id))); break;
    case 'copy-food': openSheet(foodFormState(foodById(id), true)); break;
    case 'log-food': openSheet(newEntryForm('food', id, defaultMeal(), C.localDate())); break;
    case 'add-portion': st.portions.push({ label: '', grams: null }); renderSheet(); break;
    case 'remove-portion': st.portions.splice(Number(v), 1); renderSheet(); break;
    case 'save-food': saveFood(); break;
    case 'archive-food': put('foods', { ...foodById(id), archived: true }); closeSheet(); render(); toast('Food removed'); break;

    case 'goals': {
      const g = C.goalOn(T.goals, C.localDate()) || {};
      openSheet({ type: 'goals', kcal: g.kcal ?? 2000, protein: g.protein, carbs: g.carbs, fat: g.fat });
      break;
    }
    case 'save-goals': saveGoals(); break;
    case 'save-weight': {
      const w = num($('#weight-input')?.value);
      if (!(w >= 30 && w <= 300)) { toast('Enter your weight in kg'); break; }
      put('weights', { id: C.localDate(), weightKg: w });
      const res = applyPlan();
      render();
      toast(res?.ok ? 'Weight saved, target updated' : 'Weight saved');
      break;
    }
    case 'export-json': exportJson(); break;
    case 'export-csv': exportCsv(); break;
    case 'import-json': $('#import-file').click(); break;
    case 'erase':
      ask({ title: 'Erase everything?', message: 'This deletes your foods, recipes, pots, log, weights and targets from this device. Back up first if you might want them.', ok: 'Erase everything', danger: true }).then((ok) => {
        if (!ok) return;
        clearAll().then(() => { seedIfNeeded(); clearSample(); toast('Everything erased'); });
      });
      break;
    default: break;
  }
}

init();

// Exposed for automated tests only.
window.__busog = { T, C, ui, render };
