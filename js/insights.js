// Learning from your own data: a smoothed weight trend, an estimate of your
// real maintenance calories, and plain-language insights. Pure functions,
// testable in Node (see tests/insights.test.mjs).

import { dateAdd, entryTotal } from './calc.js';

export const KCAL_PER_KG = 7700;
const ALPHA = 0.1; // daily smoothing, as in Hacker's Diet style trend weights

const daysBetween = (a, b) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

/* Exponentially smoothed weight, one value per day from the first weigh-in
   to `until`. Days without a weigh-in carry the trend forward; a weigh-in
   after a gap of d days gets the weight of d days of smoothing.
   weights: [{ id: 'YYYY-MM-DD', weightKg }] in any order. */
export function trendSeries(weights, until) {
  const pts = [...weights].filter((w) => w.weightKg > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!pts.length) return [];
  const byDate = new Map(pts.map((p) => [p.id, p.weightKg]));
  const end = until && until > pts.at(-1).id ? until : pts.at(-1).id;
  const out = [];
  let trend = pts[0].weightKg;
  let gap = 0;
  for (let d = pts[0].id; d <= end; d = dateAdd(d, 1)) {
    gap += 1;
    if (byDate.has(d)) {
      const a = 1 - (1 - ALPHA) ** gap;
      trend += a * (byDate.get(d) - trend);
      gap = 0;
    }
    out.push({ date: d, weight: byDate.get(d) ?? null, trend });
    if (out.length > 3700) break;
  }
  return out;
}

export function trendAt(series, date) {
  let v = null;
  for (const p of series) { if (p.date > date) break; v = p.trend; }
  return v;
}

// Least-squares slope of the trend over the last `days` days, in kg a week.
export function trendRate(series, days = 21) {
  const pts = series.slice(-days);
  if (pts.length < 7) return null;
  const n = pts.length;
  const xm = (n - 1) / 2;
  const ym = pts.reduce((s, p) => s + p.trend, 0) / n;
  let num = 0; let den = 0;
  pts.forEach((p, i) => { num += (i - xm) * (p.trend - ym); den += (i - xm) ** 2; });
  return den ? (num / den) * 7 : null;
}

export const NEEDS = { loggedDays: 14, weighIns: 4, spanDays: 14 };

/* ---------- Missed and partly logged days ----------
   People forget, or just don't feel like logging. Busog never counts a
   missed day as zero calories, and never lets a half-logged day drag the
   average down. Each day gets a status:
     complete  logged, and looks like a whole day (or you said it was)
     partial   logged, but looks like meals are missing (or you said so)
     rough     you gave a rough guess for a missed or partial day
     unlogged  nothing logged ('skip' marks it as fine to leave blank)
   marks: { 'YYYY-MM-DD': { status: 'complete'|'partial'|'rough'|'skip', level, kcal } } */

export const ROUGH_LEVELS = [
  ['light', 'Lighter than usual', 0.75],
  ['usual', 'About usual', 1],
  ['big', 'Bigger than usual', 1.35],
  ['feast', 'A party or big celebration', 1.8],
];
const MAINS = ['breakfast', 'lunch', 'dinner'];
const isWeekend = (d) => { const [y, m, dd] = d.split('-').map(Number); return [0, 6].includes(new Date(Date.UTC(y, m - 1, dd)).getUTCDay()); };
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

function byDate(logs) {
  const m = new Map();
  for (const l of logs) {
    const d = m.get(l.date) || { kcal: 0, mains: new Set(), n: 0 };
    d.kcal += entryTotal(l).kcal; d.n += 1;
    if (MAINS.includes(l.meal)) d.mains.add(l.meal);
    m.set(l.date, d);
  }
  return m;
}

// A usual full day: the median of days with at least two main meals logged.
export function typicalDay(logs, today, marks = {}, fallback = null, days = 42) {
  const start = dateAdd(today, -days);
  const days_ = byDate(logs.filter((l) => l.date >= start && l.date < today));
  const full = [...days_.entries()]
    .filter(([d, v]) => marks[d]?.status === 'complete' || (marks[d]?.status !== 'partial' && v.mains.size >= 2))
    .map(([, v]) => v.kcal);
  return full.length >= 3 ? median(full) : fallback;
}

// Calories for a rough guess, never less than what was actually logged.
export function roughKcal(level, typical, logged = 0) {
  const f = (ROUGH_LEVELS.find(([k]) => k === level) || ROUGH_LEVELS[1])[2];
  return Math.round(Math.max(logged, f * (typical || 2000)));
}

/* Status of each day from `from` to `to` (inclusive).
   Returns Map date → { status, kcal, logged, auto, mains }. */
export function classifyDays({ logs, marks = {}, from, to, typical = null }) {
  const days = byDate(logs.filter((l) => l.date >= from && l.date <= to));
  const out = new Map();
  for (let d = from; d <= to; d = dateAdd(d, 1)) {
    const v = days.get(d);
    const logged = v?.kcal || 0;
    const mark = marks[d];
    let status; let kcal = logged; let auto = false;
    if (mark?.status === 'rough') { status = 'rough'; kcal = Math.max(logged, mark.kcal || 0); }
    else if (mark?.status === 'complete' && v) status = 'complete';
    else if (mark?.status === 'partial' && v) status = 'partial';
    else if (!v) status = mark?.status === 'skip' ? 'skip' : 'unlogged';
    else {
      auto = true;
      const lowForYou = typical && logged < 0.5 * typical;
      const fewMeals = v.mains.size <= 1 && (!typical || logged < 0.75 * typical);
      status = lowForYou || fewMeals ? 'partial' : 'complete';
    }
    out.set(d, { status, kcal, logged, auto, mains: v ? v.mains.size : 0 });
    if (out.size > 400) break;
  }
  return out;
}

const USABLE = new Set(['complete', 'rough']);

/* Average daily intake over a stretch of days, filling the gaps honestly:
   complete and rough days count as they are; unlogged days are filled with
   your average for that kind of day (weekday or weekend), since skipped days
   are often weekends; partly logged days count as at least that average.
   Returns { avg, counts, usable }. */
export function averageIntake(days) {
  const usable = [...days.entries()].filter(([, v]) => USABLE.has(v.status));
  const mean = (arr) => (arr.length ? arr.reduce((s, [, v]) => s + v.kcal, 0) / arr.length : null);
  const all = mean(usable);
  const we = usable.filter(([d]) => isWeekend(d));
  const wd = usable.filter(([d]) => !isWeekend(d));
  const meanWe = we.length >= 2 ? mean(we) : all;
  const meanWd = wd.length >= 3 ? mean(wd) : all;
  const counts = { complete: 0, partial: 0, rough: 0, unlogged: 0, skip: 0 };
  let sum = 0;
  for (const [d, v] of days) {
    counts[v.status] += 1;
    const fill = isWeekend(d) ? meanWe : meanWd;
    if (USABLE.has(v.status)) sum += v.kcal;
    else if (v.status === 'partial') sum += Math.max(v.kcal, fill);
    else sum += fill;
  }
  return { avg: all == null ? null : sum / days.size, counts, usable: usable.length };
}

/* Estimate real maintenance from intake and the change in weight.
   maintenance ≈ average intake − (weight change × 7,700 kcal ÷ days).
   The result is blended toward the formula estimate when data is thin.
   Returns { ready, progress, observed, blended, formula, confidence, ... }. */
export function adaptiveMaintenance({ logs, weights, today, formula = null, marks = {}, windowDays = 42 }) {
  const end = dateAdd(today, -1); // today isn't finished
  const start = dateAdd(end, -(windowDays - 1));
  const inWindow = weights.filter((w) => w.id >= start && w.id <= end);
  const typical = typicalDay(logs, today, marks, formula);
  const windowDaysMap = classifyDays({ logs, marks, from: start, to: end, typical });
  const usableDays = [...windowDaysMap.values()].filter((v) => USABLE.has(v.status)).length;
  const weighIns = inWindow.length;
  const ids = inWindow.map((w) => w.id).sort();
  const firstW = ids[0];
  const lastW = ids.at(-1);
  const span = firstW ? daysBetween(firstW, lastW) : 0;
  const progress = {
    loggedDays: usableDays, weighIns, spanDays: span,
    needLoggedDays: Math.max(0, NEEDS.loggedDays - usableDays),
    needWeighIns: Math.max(0, NEEDS.weighIns - weighIns),
    needSpanDays: Math.max(0, NEEDS.spanDays - span),
  };
  const ready = !progress.needLoggedDays && !progress.needWeighIns && !progress.needSpanDays;
  if (!ready) return { ready, progress, formula };

  // Rate of change from a least-squares line through every weigh-in in the
  // window. Unlike first-vs-last, one heavy or light morning barely moves it.
  const xs = inWindow.map((w) => daysBetween(firstW, w.id));
  const ys = inWindow.map((w) => w.weightKg);
  const xm = xs.reduce((s, v) => s + v, 0) / xs.length;
  const ym = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0; let den = 0;
  xs.forEach((x, i) => { num += (x - xm) * (ys[i] - ym); den += (x - xm) ** 2; });
  const slope = den ? num / den : 0; // kg a day
  const days = Math.max(1, span);

  // Intake over the same days the weight line covers.
  const period = new Map([...windowDaysMap].filter(([d]) => d >= firstW && d < lastW));
  const intake = averageIntake(period);
  const avgIntake = intake.avg;
  const balance = slope * KCAL_PER_KG; // kcal a day stored (+) or burned (−)
  const t0 = ym - slope * xm; const t1 = t0 + slope * days;
  const observed = avgIntake - balance;

  // Confidence grows with usable days, weigh-ins, time span and how much of
  // the stretch was actually logged rather than filled in.
  const coverage = intake.usable / Math.max(1, period.size);
  let c = Math.min(1, intake.usable / 21) * Math.min(1, weighIns / 8) * Math.min(1, span / 35) * Math.min(1, 0.4 + coverage);
  const notes = [];
  const missing = intake.counts.unlogged + intake.counts.skip;
  if (formula && Math.abs(observed - formula) > 700) {
    c *= 0.5;
    notes.push('This is far from the formula estimate. Meals that went unlogged are the most common reason, since they make intake look lower than it was.');
  } else if (formula && observed < formula - 300 && (missing + intake.counts.partial) / period.size >= 0.2) {
    notes.push('This came out lower than the formula, and quite a few days weren\'t fully logged. If those were bigger days, your real number is higher. A rough guess for them fixes it.');
  }
  const blended = formula ? formula + c * (observed - formula) : observed;
  const level = c >= 0.7 ? 'high' : c >= 0.4 ? 'medium' : 'low';
  return {
    ready, progress, formula, observed, blended, confidence: c, level, notes, typical,
    avgIntake, trendChangeKg: t1 - t0, days, counts: intake.counts, periodDays: period.size, weighIns,
  };
}

/* Plain-language findings from the last `days` days. Each insight only
   appears when there's enough data behind it.
   Returns [{ id, title, text, value }]. */
export function findInsights({ logs, today, days = 28, marks = {}, typical = null, foodName = (l) => l.name }) {
  const start = dateAdd(today, -days);
  const recent = logs.filter((l) => l.date >= start && l.date < today);
  const status = classifyDays({ logs: recent, marks, from: start, to: dateAdd(today, -1), typical: typical ?? typicalDay(logs, today, marks) });
  // Day-level averages only use whole days, so a half-logged day doesn't
  // make a weekend look light. Rough guesses count for calories only.
  const dates = [...status].filter(([, v]) => v.status === 'complete').map(([d]) => d);
  const kcalDates = [...status].filter(([, v]) => USABLE.has(v.status)).map(([d]) => d);
  const dayKcal = (d) => status.get(d).kcal;
  const out = [];
  if (dates.length < 5) return out;

  const fmt = (n) => Math.round(n).toLocaleString('en-PH');
  const dow = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); };
  const avgOf = (ds) => ds.reduce((s, d) => s + dayKcal(d), 0) / ds.length;

  // Weekends vs weekdays
  const weekend = kcalDates.filter((d) => [0, 6].includes(dow(d)));
  const weekday = kcalDates.filter((d) => ![0, 6].includes(dow(d)));
  if (weekend.length >= 2 && weekday.length >= 4) {
    const diff = avgOf(weekend) - avgOf(weekday);
    if (Math.abs(diff) >= 150) {
      out.push({ id: 'weekend', title: diff > 0 ? 'Weekends run higher' : 'Weekends run lower',
        text: `You eat about ${fmt(Math.abs(diff))} kcal ${diff > 0 ? 'more' : 'less'} on weekend days than on weekdays.`, value: diff });
    }
  }

  // Eating out vs home: calories and cost per entry
  const out_ = recent.filter((l) => l.origin && l.origin !== 'home');
  const home = recent.filter((l) => !l.origin || l.origin === 'home');
  if (out_.length >= 3 && home.length >= 3) {
    const kOut = out_.reduce((s, l) => s + entryTotal(l).kcal, 0) / out_.length;
    const kHome = home.reduce((s, l) => s + entryTotal(l).kcal, 0) / home.length;
    const pOut = out_.filter((l) => l.cost != null); const pHome = home.filter((l) => l.cost != null);
    let costText = '';
    if (pOut.length >= 3 && pHome.length >= 3) {
      const cOut = pOut.reduce((s, l) => s + l.cost, 0) / pOut.length;
      const cHome = pHome.reduce((s, l) => s + l.cost, 0) / pHome.length;
      costText = ` They also cost about ₱${fmt(cOut)} each, versus ₱${fmt(cHome)} at home.`;
    }
    const share = out_.reduce((s, l) => s + entryTotal(l).kcal, 0) / recent.reduce((s, l) => s + entryTotal(l).kcal, 0);
    out.push({ id: 'eating-out', title: 'Eating out',
      text: `${Math.round(share * 100)}% of your calories came from eating out. Meals bought outside averaged ${fmt(kOut)} kcal, versus ${fmt(kHome)} kcal at home.${costText}`, value: share });
  }

  // Protein by meal
  const meals = ['breakfast', 'lunch', 'dinner'];
  const whole = new Set(dates);
  const per = meals.map((m) => {
    const ds = dates.filter((d) => recent.some((l) => l.date === d && l.meal === m));
    const tot = recent.filter((l) => l.meal === m && whole.has(l.date)).reduce((s, l) => s + entryTotal(l).protein, 0);
    return { m, n: ds.length, avg: ds.length ? tot / ds.length : 0 };
  }).filter((x) => x.n >= 4);
  if (per.length >= 2) {
    const low = per.reduce((a, b) => (b.avg < a.avg ? b : a));
    const high = per.reduce((a, b) => (b.avg > a.avg ? b : a));
    if (high.avg - low.avg >= 10) {
      out.push({ id: 'protein', title: `Protein is lowest at ${low.m}`,
        text: `${low.m[0].toUpperCase() + low.m.slice(1)} averages ${fmt(low.avg)} g of protein, versus ${fmt(high.avg)} g at ${high.m}. Adding an egg or some tokwa there evens out your day.`, value: low.avg });
    }
  }

  // Biggest calorie sources
  const byName = new Map();
  for (const l of recent) {
    const name = foodName(l);
    byName.set(name, (byName.get(name) || 0) + entryTotal(l).kcal);
  }
  const total = [...byName.values()].reduce((s, v) => s + v, 0);
  const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length && total > 0) {
    out.push({ id: 'sources', title: 'Your biggest calorie sources',
      text: `${top.map(([n, v]) => `${n} (${Math.round((v / total) * 100)}%)`).join(', ')}.`, value: top[0][1] / total });
  }

  // Drinks and sweets
  const drinks = recent.filter((l) => whole.has(l.date) && /milk tea|softdrink|cola|coffee|iced|shake|juice|quencher|sago|gulaman|beer|malt/i.test(l.name));
  const drinkKcal = drinks.reduce((s, l) => s + entryTotal(l).kcal, 0);
  if (drinks.length >= 3 && drinkKcal / dates.length >= 100) {
    out.push({ id: 'drinks', title: 'Calories from drinks',
      text: `Drinks add about ${fmt(drinkKcal / dates.length)} kcal on an average logged day. Going half sugar on milk tea is an easy cut.`, value: drinkKcal / dates.length });
  }

  // Sodium
  const naDays = dates.filter((d) => recent.some((l) => l.date === d && l.sodium != null));
  if (naDays.length >= 5) {
    const over = naDays.filter((d) => recent.filter((l) => l.date === d).reduce((s, l) => s + (l.sodium || 0), 0) > 2000);
    if (over.length >= 2) {
      out.push({ id: 'sodium', title: 'Sodium',
        text: `${over.length} of ${naDays.length} days went over 2,000 mg of sodium. Patis, toyo, instant noodles and processed meats are the usual sources.`, value: over.length / naDays.length });
    }
  }

  // Logging, without guilt: missed days are normal and never count as zero.
  const n = { complete: 0, partial: 0, rough: 0, unlogged: 0, skip: 0 };
  for (const v of status.values()) n[v.status] += 1;
  const parts = [`${n.complete} fully logged`];
  if (n.partial) parts.push(`${n.partial} partly logged`);
  if (n.rough) parts.push(`${n.rough} rough guess${n.rough === 1 ? '' : 'es'}`);
  const blank = n.unlogged + n.skip;
  if (blank) parts.push(`${blank} not logged`);
  const missedWe = [...status].filter(([d, v]) => (v.status === 'unlogged' || v.status === 'skip') && [0, 6].includes(dow(d))).length;
  let tip = 'Missed days never count as zero, and Busog fills them in from your usual days.';
  if (blank >= 4 && missedWe / blank >= 0.6) tip = 'Most of your missed days are weekends. Busog fills them in from your other weekends, but a quick rough guess for a big weekend keeps things honest.';
  else if (n.partial >= 3) tip = 'Partly logged days are left out of averages so they don\'t make you look like you ate less. Marking them, or adding a rough guess, helps.';
  out.push({ id: 'consistency', title: 'Logging',
    text: `Of the last ${days} days: ${parts.join(', ')}. ${tip}`, value: (n.complete + n.rough) / days });

  return out;
}

// Deterministic random numbers for demo data (mulberry32).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normal noise from a uniform source (Box-Muller).
export function gauss(rand) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
