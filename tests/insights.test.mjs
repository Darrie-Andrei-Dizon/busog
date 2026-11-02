// Checks the weight trend and maintenance estimate against simulated people
// whose real maintenance is known. Run with: node tests/insights.test.mjs
import assert from 'node:assert/strict';
import { trendSeries, trendRate, adaptiveMaintenance, findInsights, classifyDays, roughKcal, typicalDay, seeded, gauss, KCAL_PER_KG } from '../js/insights.js';
import { dateAdd } from '../js/calc.js';

const TODAY = '2026-11-02';

/* One simulated person. Intake varies day to day with weekend spikes; the true
   weight moves by (intake − maintenance) ÷ 7,700; the scale adds water noise. */
/* Ways people actually log: skipLog days not logged at all (weekendSkip puts
   them on weekends; heavySkip makes skipped days bigger, like parties), and
   partial days where only lunch made it into the log. */
function simulate({ seed, maintenance, target, days = 35, startKg = 72, noiseKg = 0.6, skipLog = 0.1, weekendSkip = false, heavySkip = 0, partial = 0, weighEvery = 1, underReport = 0 }) {
  const r = seeded(seed);
  const logs = []; const weights = []; const skipped = [];
  let kg = startKg;
  for (let i = days; i >= 1; i--) {
    const date = dateAdd(TODAY, -i);
    const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    const skip = weekendSkip ? weekend && r() < skipLog * 3.5 : r() < skipLog;
    const intake = target + gauss(r) * 250 + (weekend ? 400 : 0) + (skip ? heavySkip : 0);
    const isPartial = !skip && r() < partial;
    if (skip) skipped.push(date);
    else {
      const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
      const split = [0.25, 0.35, 0.3, 0.1];
      meals.forEach((meal, k) => {
        if (isPartial && meal !== 'lunch') return;
        logs.push({ date, meal, name: meal, kcal: intake * split[k] * (1 - underReport), protein: 20, carbs: 50, fat: 15 });
      });
    }
    kg += (intake - maintenance) / KCAL_PER_KG;
    if (i % weighEvery === 0) weights.push({ id: date, weightKg: kg + gauss(r) * noiseKg });
  }
  return { logs, weights, skipped, finalKg: kg };
}

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok  ${name}`); };

test('trend smooths scale noise', () => {
  const { weights, finalKg } = simulate({ seed: 1, maintenance: 2300, target: 1800, noiseKg: 0.8 });
  const s = trendSeries(weights, dateAdd(TODAY, -1));
  const rawErr = Math.abs(weights.at(-1).weightKg - finalKg);
  const trendErr = Math.abs(s.at(-1).trend - finalKg);
  assert.ok(trendErr < 1.2, `trend error ${trendErr.toFixed(2)} kg`);
  // Day-to-day jumps in the trend are much smaller than in raw weights.
  const jump = (a) => a.slice(1).reduce((m, v, i) => m + Math.abs(v - a[i]), 0) / (a.length - 1);
  assert.ok(jump(s.map((p) => p.trend)) < jump(weights.map((w) => w.weightKg)) / 3);
  void rawErr;
});

test('trend rate shows a loss for a deficit', () => {
  const { weights } = simulate({ seed: 2, maintenance: 2300, target: 1700, days: 42 });
  const rate = trendRate(trendSeries(weights, dateAdd(TODAY, -1)));
  assert.ok(rate < 0, `rate ${rate}`);
});

test('not ready with thin data, with the right gaps', () => {
  const { logs, weights } = simulate({ seed: 3, maintenance: 2300, target: 2000, days: 6 });
  const res = adaptiveMaintenance({ logs, weights, today: TODAY, formula: 2200 });
  assert.equal(res.ready, false);
  assert.ok(res.progress.needLoggedDays > 0 && res.progress.needSpanDays > 0);
});

function accuracy(days, opts = {}, label = `${days} days`, markFor = null) {
  const errs = [];
  for (let seed = 10; seed < 50; seed++) {
    const r = seeded(seed * 7);
    const truth = 1800 + Math.round(r() * 1000);
    const target = truth - 600 + Math.round(r() * 900);
    const sim = simulate({ seed, maintenance: truth, target, days, skipLog: 0.1, weighEvery: 1 + Math.floor(r() * 2), ...opts });
    const marks = markFor ? markFor(sim) : {};
    const res = adaptiveMaintenance({ logs: sim.logs, weights: sim.weights, today: TODAY, formula: truth + 150, marks });
    assert.ok(res.ready, `seed ${seed} not ready`);
    errs.push(res.observed - truth);
  }
  const bias = errs.reduce((s, e) => s + e, 0) / errs.length;
  const mae = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length;
  const within = errs.filter((e) => Math.abs(e) <= 150).length;
  console.log(`    ${label}: bias ${bias.toFixed(0)}, mean abs error ${mae.toFixed(0)} kcal, ${within}/40 within ±150`);
  return { bias, mae, within };
}

test('six weeks: recovers true maintenance within ±150 kcal for nearly everyone', () => {
  const { bias, mae, within } = accuracy(49);
  assert.ok(Math.abs(bias) < 40 && mae < 80 && within >= 36);
});

test('four weeks: unbiased, noisier (so confidence stays below full)', () => {
  const { bias, mae } = accuracy(35);
  assert.ok(Math.abs(bias) < 60 && mae < 130);
});

test('blends toward the formula when confidence is low', () => {
  const { logs, weights } = simulate({ seed: 60, maintenance: 2300, target: 1900, days: 20, weighEvery: 3 });
  const res = adaptiveMaintenance({ logs, weights, today: TODAY, formula: 2000 });
  assert.ok(res.ready);
  assert.ok(res.confidence < 0.7);
  const lo = Math.min(res.formula, res.observed); const hi = Math.max(res.formula, res.observed);
  assert.ok(res.blended >= lo && res.blended <= hi);
});

test('under-logging is flagged by the formula check', () => {
  const { logs, weights } = simulate({ seed: 70, maintenance: 2400, target: 2400, underReport: 0.4 });
  const res = adaptiveMaintenance({ logs, weights, today: TODAY, formula: 2400 });
  assert.ok(res.ready);
  assert.ok(res.notes.length > 0);
  assert.ok(res.blended > res.observed);
});

/* ---------- Missed and partly logged days ---------- */

test('a missed day is never counted as zero', () => {
  const logs = [{ date: '2026-10-01', meal: 'lunch', kcal: 600 }, { date: '2026-10-01', meal: 'dinner', kcal: 700 }];
  const days = classifyDays({ logs, from: '2026-10-01', to: '2026-10-02', typical: 1800 });
  assert.equal(days.get('2026-10-01').status, 'complete');
  assert.equal(days.get('2026-10-02').status, 'unlogged');
});

test('a day with only one small meal is treated as partly logged', () => {
  const logs = [{ date: '2026-10-01', meal: 'breakfast', kcal: 350 }];
  assert.equal(classifyDays({ logs, from: '2026-10-01', to: '2026-10-01', typical: 1900 }).get('2026-10-01').status, 'partial');
  // ...unless you say that really was everything
  const marks = { '2026-10-01': { status: 'complete' } };
  assert.equal(classifyDays({ logs, marks, from: '2026-10-01', to: '2026-10-01', typical: 1900 }).get('2026-10-01').status, 'complete');
});

test('a rough guess never goes below what was logged', () => {
  assert.equal(roughKcal('light', 1000, 1400), 1400);
  assert.equal(roughKcal('big', 2000), 2700);
});

test('typical day ignores partly logged days', () => {
  const logs = [];
  for (let i = 1; i <= 6; i++) { const d = dateAdd(TODAY, -i); logs.push({ date: d, meal: 'lunch', kcal: 900 }, { date: d, meal: 'dinner', kcal: 900 }); }
  logs.push({ date: dateAdd(TODAY, -7), meal: 'lunch', kcal: 300 });
  assert.equal(typicalDay(logs, TODAY), 1800);
});

test('20% of days only partly logged: estimate stays unbiased', () => {
  const { bias, within } = accuracy(42, { skipLog: 0, partial: 0.2 }, '20% partly logged');
  assert.ok(Math.abs(bias) < 60 && within >= 36);
});

test('skipped days that fall on weekends are filled from other weekends', () => {
  // Here 70% of weekends go unlogged, so there's little weekend data to fill from.
  const { bias, within } = accuracy(42, { skipLog: 0.2, weekendSkip: true }, 'weekend skips');
  assert.ok(Math.abs(bias) < 60 && within >= 34);
});

test('skipped and partial days together', () => {
  const { bias, within } = accuracy(42, { skipLog: 0.2, partial: 0.2 }, 'skips + partial');
  assert.ok(Math.abs(bias) < 60 && within >= 35);
});

test('bigger skipped days bias the estimate low, and a rough guess fixes it', () => {
  const opts = { skipLog: 0.2, heavySkip: 600 };
  const without = accuracy(42, opts, 'big skipped days, no guesses');
  // The person taps "Bigger than usual" for most of their skipped days.
  const withGuess = accuracy(42, opts, 'big skipped days, rough guesses', (sim) => {
    const typical = typicalDay(sim.logs, TODAY);
    return Object.fromEntries(sim.skipped.filter((_, i) => i % 4 !== 3).map((d) => [d, { status: 'rough', level: 'big', kcal: roughKcal('big', typical) }]));
  });
  assert.ok(without.bias < -80, 'expected the unfixable bias to show up without guesses');
  assert.ok(Math.abs(withGuess.bias) < Math.abs(without.bias) / 2);
});

test('insights find a weekend difference and logging rate', () => {
  const { logs } = simulate({ seed: 80, maintenance: 2300, target: 1900 });
  const ins = findInsights({ logs, today: TODAY });
  assert.ok(ins.some((i) => i.id === 'weekend' && i.value > 0));
  assert.ok(ins.some((i) => i.id === 'consistency'));
});

console.log(`\n${passed} passed`);
