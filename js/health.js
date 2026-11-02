// Health profile and weight-plan math. Pure functions, testable in Node.
//
// Energy needs use the Mifflin-St Jeor equation times an activity factor.
// About 7,700 kcal is treated as 1 kg of body weight. Plans are capped at
// a steady pace (1% of body weight a week, at most 1 kg) and never go below
// the 1,200 kcal floor or a goal weight under a BMI of 18.5. People under 18
// get maintenance targets only.

import { dateAdd, KCAL_FLOOR } from './calc.js';

export const KCAL_PER_KG = 7700;
export const MIN_BMI = 18.5;
export const MAX_BMI_HEALTHY = 24.9;
export const MAX_LOSS_KG_WEEK = 1;
export const MAX_GAIN_KG_WEEK = 0.5;
export const ADULT_AGE = 18;

export const SEXES = [
  ['female', 'Female'],
  ['male', 'Male'],
  ['unspecified', 'Prefer not to say'],
];

// [id, label, factor, description]
export const ACTIVITY = [
  ['sedentary', 'Mostly sitting', 1.2, 'Classes or desk work, little exercise'],
  ['light', 'Lightly active', 1.375, 'Walking a lot, or exercise 1 to 3 days a week'],
  ['moderate', 'Moderately active', 1.55, 'Exercise 3 to 5 days a week'],
  ['active', 'Very active', 1.725, 'Hard exercise 6 to 7 days a week'],
  ['athlete', 'Athlete', 1.9, 'Training twice a day, or a physical job'],
];

export const GOALS = [
  ['lose', 'Lose weight'],
  ['maintain', 'Stay where I am'],
  ['gain', 'Gain weight'],
];

export const LOSS_PACES = [
  [0.25, 'Gentle', 'Easiest to keep up'],
  [0.5, 'Steady', 'A common, sustainable pace'],
  [0.75, 'Faster', 'Needs more discipline'],
  [1, 'Fastest', 'Only for higher body weights'],
];
export const GAIN_PACES = [
  [0.25, 'Gentle', 'Less fat gained along the way'],
  [0.5, 'Steady', 'Faster, best with strength training'],
];

const r10 = (n) => Math.round(n / 10) * 10;

export function bmr({ sex, age, heightCm, weightKg }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // midpoint of the two
}

export function activityFactor(id) {
  return (ACTIVITY.find(([k]) => k === id) || ACTIVITY[0])[2];
}

export function maintenance(profile, weightKg) {
  return bmr({ ...profile, weightKg }) * activityFactor(profile.activity);
}

export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function healthyRange(heightCm) {
  const m2 = (heightCm / 100) ** 2;
  return [MIN_BMI * m2, MAX_BMI_HEALTHY * m2];
}

export function maxLossRate(weightKg) {
  return Math.min(MAX_LOSS_KG_WEEK, weightKg * 0.01);
}

export function profileProblem(p) {
  if (!p) return 'Add your details first.';
  if (!(p.age >= 13 && p.age <= 100)) return 'Enter an age between 13 and 100.';
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) return 'Enter your height in centimeters, between 120 and 230.';
  if (!(p.weightKg >= 30 && p.weightKg <= 300)) return 'Enter your weight in kilograms, between 30 and 300.';
  return null;
}

/* Turn a profile and goal into daily targets.
   input: { sex, age, heightCm, weightKg, activity, goal, targetKg, mode ('pace'|'date'), pace, targetDate, today }
   Returns { ok, error, notes[], bmr, maintenance, bmi, healthy, goal, rate, kcal, floorLimited, weeks, eta, protein, carbs, fat } */
export function planTargets(input) {
  const out = { ok: false, error: null, notes: [] };
  const problem = profileProblem(input);
  if (problem) return { ...out, error: problem };

  const { weightKg: w, heightCm: h, today } = input;
  const minor = input.age < ADULT_AGE;
  const goal = minor ? 'maintain' : input.goal;
  out.bmr = Math.round(bmr(input));
  out.formulaMaintenance = r10(maintenance(input, w));
  // A maintenance learned from the person's own logs and weight trend
  // replaces the formula when they choose it.
  const learned = Number(input.maintenanceOverride);
  out.learned = learned >= 1000 && learned <= 6000;
  out.maintenance = out.learned ? r10(learned) : out.formulaMaintenance;
  out.bmi = bmi(w, h);
  out.healthy = healthyRange(h);
  out.goal = goal;
  if (minor && input.goal !== 'maintain') {
    out.notes.push("Busog doesn't make weight-change plans for people under 18. Your body is still growing, so a doctor or school nurse is the right person to help with weight goals. These targets keep you steady.");
  }

  let rate = 0;
  if (goal === 'lose' || goal === 'gain') {
    const t = Number(input.targetKg);
    if (!(t >= 30 && t <= 300)) return { ...out, error: 'Enter your goal weight in kilograms.' };
    if (goal === 'lose' && t >= w) return { ...out, error: 'Your goal weight should be below your current weight.' };
    if (goal === 'gain' && t <= w) return { ...out, error: 'Your goal weight should be above your current weight.' };
    if (goal === 'lose' && t < out.healthy[0] - 0.05) {
      return { ...out, error: `${t} kg is below the healthy range for your height. The lowest goal Busog will plan for is ${Math.ceil(out.healthy[0] * 10) / 10} kg.` };
    }
    const maxRate = goal === 'lose' ? maxLossRate(w) : MAX_GAIN_KG_WEEK;
    const diff = Math.abs(w - t);
    if (input.mode === 'date') {
      const days = daysBetween(today, input.targetDate);
      if (!(days > 0)) return { ...out, error: 'Pick a date after today.' };
      rate = diff / (days / 7);
      if (rate > maxRate + 1e-9) {
        const earliest = dateAdd(today, Math.ceil((diff / maxRate) * 7));
        return {
          ...out,
          error: `That means ${goal === 'lose' ? 'losing' : 'gaining'} ${fmtKg(rate)} kg a week, faster than the steady limit of ${fmtKg(maxRate)} kg a week for you.`,
          earliest,
        };
      }
    } else {
      rate = Math.min(Number(input.pace) || 0.5, maxRate);
      if (rate < Number(input.pace)) out.notes.push(`Your pace is set to ${fmtKg(rate)} kg a week, the steady limit for your weight.`);
    }

    const daily = (rate * KCAL_PER_KG) / 7;
    let kcal = goal === 'lose' ? out.maintenance - daily : out.maintenance + daily;
    if (kcal < KCAL_FLOOR) {
      kcal = KCAL_FLOOR;
      out.floorLimited = true;
      rate = ((out.maintenance - KCAL_FLOOR) * 7) / KCAL_PER_KG;
      if (rate < 0.05) {
        return { ...out, error: `Your maintenance level is already close to the ${KCAL_FLOOR.toLocaleString('en-PH')} kcal minimum, so eating less isn't a safe way to lose weight. Moving more, or talking to a doctor or dietitian, will help more.` };
      }
      out.notes = out.notes.filter((n) => !n.startsWith('Your pace is set'));
      out.notes.push(`To stay above ${KCAL_FLOOR.toLocaleString('en-PH')} kcal a day, your pace is ${fmtKg(rate)} kg a week.`);
    }
    out.kcal = r10(kcal);
    out.rate = rate;
    out.weeks = diff / rate;
    out.eta = dateAdd(today, Math.ceil(out.weeks * 7));
    out.targetKg = t;
  } else {
    out.kcal = Math.max(KCAL_FLOOR, out.maintenance);
    out.rate = 0;
  }

  // Macro starting points: protein by body weight, fat at 25% of calories,
  // carbs fill the rest.
  const refKg = goal === 'lose' ? Math.max(out.targetKg, out.healthy[0]) : w;
  const perKg = goal === 'maintain' ? 1.2 : 1.6;
  out.protein = Math.round(refKg * perKg);
  out.fat = Math.round((out.kcal * 0.25) / 9);
  out.carbs = Math.max(0, Math.round((out.kcal - out.protein * 4 - out.fat * 9) / 4));
  out.ok = true;
  return out;
}

export function daysBetween(a, b) {
  if (!a || !b) return NaN;
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function fmtKg(n) {
  return (Math.round(n * 100) / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 });
}

// Exercise. MET values are approximate, from the Compendium of Physical
// Activities. Net calories subtract the 1 MET you'd burn at rest anyway,
// since maintenance calories already count resting energy.
export const EXERCISES = [
  ['walk', 'Walking', 3.5], ['brisk-walk', 'Brisk walking', 5], ['jog', 'Jogging', 7], ['run', 'Running', 9.8],
  ['bike', 'Cycling, leisure', 4], ['swim', 'Swimming', 6], ['basketball', 'Basketball', 6.5], ['volleyball', 'Volleyball', 4],
  ['badminton', 'Badminton', 5.5], ['dance', 'Dance or Zumba', 6.5], ['weights', 'Weight training', 3.5],
  ['home-workout', 'Home workout', 3.8], ['jump-rope', 'Jump rope', 11], ['hiking', 'Hiking', 6],
];
export function exerciseKcal(exerciseId, minutes, weightKg) {
  const met = (EXERCISES.find(([k]) => k === exerciseId) || [null, null, 3.5])[2];
  return Math.max(0, (met - 1) * weightKg * (minutes / 60));
}
