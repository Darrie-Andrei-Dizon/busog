# Busog

A phone-first calorie and recipe logger built around how Filipinos actually eat: rice by the cup, one pot shared by the family, leftovers the next day, and a lot of fast food and carinderia meals.

Everything is saved on your phone. There is no account and no server.

## What it does

**Logging**
- **A bowl that fills up** as you log, instead of a red "over budget" number. You can hide the numbers entirely.
- **Portions without a scale.** Log by fist, palm or thumb, or count fists from a pot.
- **Sodium** for each day, against the 2,000 mg guideline.
- **Cost.** Add what you pay for ingredients once, and see the cost of recipes, meals and your week.
- **Barcode scanning** where the browser supports it, with Open Food Facts lookup and a quick form for copying a nutrition label.
- **Exercise**, counted conservatively, with an option to add half back to your target.
- **Honest estimates.** Mark rough guesses as estimates, so an imperfect day still counts.

**Food**
- **Filipino home cooking:** 32 recipes including sinigang, tinola, nilaga, misua, pastil, arroz caldo, kare-kare, sopas and the silogs.
- **Student meals and simple healthy meals,** with time and equipment (rice cooker, microwave, no stove, air fryer).
- **Street food, merienda and drinks:** fishball, kwek-kwek, isaw, turon, taho, pandesal, milk tea, 3-in-1 coffee and more.
- **11 restaurants,** tagged by ingredient and style. McDonald's numbers are official; the rest are labeled estimates.
- **Recipe import:** paste a recipe and Busog matches the ingredients.

**Planning**
- **Recipes with real cooked weights,** leftovers in the pot, and family-style sharing.
- **A meal picker** that chooses by craving, what's in your kitchen, calories left, budget, restaurant, time and equipment.
- **A weekly meal plan** with suggestions and one combined grocery list.
- **A personal plan** from your height, weight, age and activity, with safe paces and a goal date.

**Learning from you**
- **A smoothed weight trend.** Daily weight jumps around with water and salt. Busog draws a trend line through your weigh-ins and shows your real weekly rate.
- **Your real maintenance.** After two weeks of logging and weighing in, Busog works out how many calories *your* body burns from what you ate and how your trend moved, with a confidence level. Turn it on and your plan uses it instead of the formula.
- **What your logs show:** weekends vs weekdays, eating out vs home (calories and cost), protein by meal, your biggest calorie sources, drinks and sodium.
- **Missed days are normal.** A missed day never counts as zero, and a half-logged day never drags your averages down. Busog spots days that look partly logged, fills gaps from your usual weekdays or weekends, and lets you add a one-tap rough guess (lighter, about usual, bigger, party) or just leave a day blank. No streaks, nothing resets.
- **Sample weeks** you can load to see all of this before your own data builds up, and clear in one tap.

**Your data**
- Everything stays on your phone. Back up and restore as JSON, or export your log as CSV.
- Busog asks the browser to keep its storage, and reminds you to back up every two weeks.
- Meal reminders go into your phone's calendar as a daily event file.
- Works offline once loaded, and can be installed to your home screen.

**Safety**
- Targets never go below 1,200 kcal, and plans never aim below a healthy weight for your height or faster than a steady pace.
- No weight-change plans for people under 18.
- If several logged days in a row come in very low, Busog checks in and points to support.

## Put it on GitHub Pages

1. On GitHub, click **+** → **New repository**. Name it `busog`, make it **Public**, and create it.
2. **Add file → Upload files**, then drag in everything from this folder (keep the `css`, `js` and `icons` folders). **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute the app is live at `https://YOUR-USERNAME.github.io/busog/`.
5. On your phone, open that link and choose **Add to Home Screen** (Safari share menu, or Chrome's ⋮ menu).

## Run it on your computer

The app uses JavaScript modules, so it needs a local server rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## How it's built

Plain HTML, CSS and JavaScript with no build step.

| File | What it holds |
| --- | --- |
| `index.html` | Page shell and bottom navigation |
| `css/app.css` | All styles, light and dark |
| `js/app.js` | Screens, forms and actions |
| `js/calc.js` | Nutrition math (pure functions, testable in Node) |
| `js/db.js` | IndexedDB storage, mirrored in memory |
| `js/seed.js` | Starter foods, restaurant menus and recipes |
| `js/seed-ph.js` | Filipino dishes, street food, merienda and drinks |
| `js/health.js` | Calorie needs, weight plans and exercise |
| `js/picker.js` | Meal picker tags and ranking |
| `js/importer.js` | Recipe text parser |
| `js/barcode.js` | Barcode scanning and Open Food Facts lookup |
| `js/insights.js` | Weight trend, learned maintenance and insights (pure functions) |
| `tests/insights.test.mjs` | Checks the maintenance estimate against simulated people. Run `node tests/insights.test.mjs` |
| `sw.js` | Offline caching |

The data model follows the design doc, with one change for IndexedDB: child rows are stored inside their parent. Portions live inside each food, ingredients inside each recipe, extras inside each log entry, and items inside each saved meal.

Key rules from the design:

- Nutrition is stored per 100 g, or per serving for chain items published without a weight.
- Each log entry keeps a snapshot of its numbers, so editing a food later doesn't change past days.
- Editing a recipe you've already logged saves a new version.
- Daily totals are calculated from log entries, never stored.

### How the learned maintenance works

Maintenance ≈ average logged intake − (weight change × 7,700 kcal ÷ days). The weight change is the slope of a straight line fitted through every weigh-in in the last six weeks, so one heavy morning barely moves it. Until there are 14 logged days and 4 weigh-ins spread over 14 days, Busog shows a checklist instead of a number. After that the estimate is blended with the formula by a confidence score that grows with logged days, weigh-ins and time span. If the learned number is more than 700 kcal from the formula, confidence is halved and Busog explains that unlogged meals are the usual cause.

Days are sorted into fully logged, partly logged, rough guess or not logged. A day counts as partly logged when it's under half your usual full day, or has only one main meal and is well under it. You can always say "that was everything". Fully logged days and rough guesses are averaged as they are. Days with nothing logged are filled with your average for that kind of day (weekday or weekend), and partly logged days count as at least that average.

How much each fix matters, from the same simulations over six weeks (average error, negative meaning too low):

| How the person logged | Before | After |
| --- | --- | --- |
| 1 in 5 days only partly logged | −309 kcal | +13 kcal |
| Skipped days mostly weekends | −79 kcal | −43 kcal |
| Skipped days were bigger days (+600 kcal) | −137 kcal | −137 kcal, or −10 kcal with rough guesses |

Nothing can recover a big day nobody logged, which is why Busog asks for a rough guess instead of guessing silently.

In tests with 40 simulated people with known maintenance and realistic scale noise (±0.6 kg a day), the estimate had no meaningful bias. It landed within 150 kcal of the truth for 36 of 40 after five weeks, and 39 of 40 after seven.

### After changing files

Bump `CACHE` in `sw.js` (for example `busog-v2`) so phones pick up the new version. If you edit `js/seed.js`, also bump `SEED_VERSION` so existing installs get the new foods.

## Data sources

- Generic ingredients: approximate values in line with [USDA FoodData Central](https://fdc.nal.usda.gov/). Check any you rely on heavily.
- McDonald's: [McDonald's Philippines](https://www.mcdonalds.com.ph/our-food), checked November 2, 2026.
- Jollibee: [Jollibee USA Nutrition Facts, October 2025](https://www.jollibeefoods.com/nutrition). Philippine portions may differ, so these are logged as estimates by default.
- Street food, merienda and drinks are Busog estimates from typical recipes and serving sizes.
- Packaged foods from barcodes come from [Open Food Facts](https://world.openfoodfacts.org/), a community database. Check them against the label.
- Exercise uses approximate MET values from the Compendium of Physical Activities. Sodium guidance follows the WHO's limit of under 2,000 mg a day for adults.
- Mang Inasal, Chowking, KFC, Greenwich, Shakey's, Max's, Andok's, Bonchon and Tokyo Tokyo don't publish nutrition data for the Philippines. Their items are Busog estimates built from typical portions of known ingredients. Each item lists the portions it assumes, and they are always logged as estimates.

Nutrition figures are for general tracking, not medical advice.
