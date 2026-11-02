// Starter data. Bump SEED_VERSION when this file changes so existing
// installs pick up the new rows (seed rows are updated by their fixed ids).

import { phIngredients, phRecipes, snackFoods } from './seed-ph.js';

export const SEED_VERSION = 6;

export const seedPlaces = [
  { id: 'seed-place-mcdo', name: "McDonald's", kind: 'fast_food', isChain: true, owner: 'seed' },
  { id: 'seed-place-jollibee', name: 'Jollibee', kind: 'fast_food', isChain: true, owner: 'seed' },
  { id: 'seed-place-manginasal', name: 'Mang Inasal', kind: 'fast_food', isChain: true, owner: 'seed' },
  { id: 'seed-place-chowking', name: 'Chowking', kind: 'fast_food', isChain: true, owner: 'seed' },
  { id: 'seed-place-kfc', name: 'KFC', kind: 'fast_food', isChain: true, owner: 'seed' },
  { id: 'seed-place-greenwich', name: 'Greenwich', kind: 'fast_food', isChain: true, owner: 'seed' },
  { id: 'seed-place-shakeys', name: "Shakey's", kind: 'restaurant', isChain: true, owner: 'seed' },
  { id: 'seed-place-maxs', name: "Max's Restaurant", kind: 'restaurant', isChain: true, owner: 'seed' },
  { id: 'seed-place-andoks', name: "Andok's", kind: 'fast_food', isChain: true, owner: 'seed' },
  { id: 'seed-place-bonchon', name: 'Bonchon', kind: 'restaurant', isChain: true, owner: 'seed' },
  { id: 'seed-place-tokyotokyo', name: 'Tokyo Tokyo', kind: 'fast_food', isChain: true, owner: 'seed' },
];

const USDA = 'https://fdc.nal.usda.gov/';

// Generic ingredients, per 100 g. Approximate values in line with USDA
// FoodData Central; check any you rely on heavily.
function ingredient(id, name, aliases, category, kcal, protein, carbs, fat, portions, hidden = false) {
  return {
    id: `seed-${id}`,
    name,
    aliases,
    category,
    basis: 'per_100g',
    kcal, protein, carbs, fat,
    hidden,
    portions: portions.map(([label, grams], i) => ({ id: `p${i + 1}`, label, grams })),
    placeId: null,
    owner: 'seed',
    source: 'USDA FoodData Central (approximate)',
    sourceUrl: USDA,
  };
}

const ingredients = [
  ingredient('rice', 'White rice, cooked', ['kanin', 'rice'], 'grain', 130, 2.7, 28.2, 0.3, [['1 cup', 158], ['½ cup', 79]]),
  ingredient('bread', 'White bread', ['tinapay', 'loaf bread'], 'grain', 266, 7.6, 50.6, 3.3, [['1 slice', 28]]),
  ingredient('oats', 'Rolled oats, dry', ['oatmeal'], 'grain', 379, 13.2, 67.7, 6.5, [['½ cup', 40]]),
  ingredient('egg', 'Egg, whole', ['itlog'], 'protein', 143, 12.6, 0.7, 9.5, [['1 large', 50]]),
  ingredient('chicken-thigh', 'Chicken thigh, boneless, raw', ['manok', 'hita'], 'protein', 121, 19.7, 0, 4.1, [['1 kg', 1000]]),
  ingredient('chicken-breast', 'Chicken breast, skinless, raw', ['manok', 'pecho'], 'protein', 120, 22.5, 0, 2.6, [['1 kg', 1000]]),
  ingredient('pork-belly', 'Pork belly, raw', ['liempo', 'baboy'], 'protein', 518, 9.3, 0, 53, [['1 kg', 1000]]),
  ingredient('ground-pork', 'Ground pork, raw', ['giniling', 'baboy'], 'protein', 263, 16.9, 0, 21.2, [['½ kg', 500]]),
  ingredient('tilapia', 'Tilapia, raw', ['isda', 'fish'], 'protein', 96, 20.1, 0, 1.7, [['1 fillet', 87]]),
  ingredient('corned-beef', 'Corned beef, canned', ['carne norte'], 'protein', 250, 27.1, 0, 14.9, [['2 tbsp', 30]]),
  ingredient('garlic', 'Garlic', ['bawang'], 'vegetable', 149, 6.4, 33.1, 0.5, [['1 clove', 3], ['1 head', 40]]),
  ingredient('onion', 'Onion', ['sibuyas'], 'vegetable', 40, 1.1, 9.3, 0.1, [['1 medium', 110]]),
  ingredient('tomato', 'Tomato', ['kamatis'], 'vegetable', 18, 0.9, 3.9, 0.2, [['1 medium', 123]]),
  ingredient('kangkong', 'Kangkong (water spinach)', ['kangkong'], 'vegetable', 19, 2.6, 3.1, 0.2, [['1 cup', 56]]),
  ingredient('potato', 'Potato, raw', ['patatas'], 'vegetable', 77, 2, 17.5, 0.1, [['1 medium', 173]]),
  ingredient('kamote', 'Sweet potato, raw', ['kamote'], 'vegetable', 86, 1.6, 20.1, 0.1, [['1 medium', 130]]),
  ingredient('banana', 'Banana', ['saging'], 'fruit', 89, 1.1, 22.8, 0.3, [['1 medium', 118]]),
  ingredient('mango', 'Mango, ripe', ['mangga'], 'fruit', 60, 0.8, 15, 0.4, [['1 cup sliced', 165]]),
  ingredient('milk', 'Milk, whole', ['gatas'], 'dairy', 61, 3.2, 4.8, 3.3, [['1 cup', 244]]),
  ingredient('oil', 'Cooking oil', ['mantika', 'vegetable oil'], 'oil', 884, 0, 0, 100, [['1 tsp', 4.5], ['1 tbsp', 13.6]], true),
  ingredient('butter', 'Butter', ['mantikilya'], 'oil', 717, 0.9, 0.1, 81, [['1 tbsp', 14]], true),
  ingredient('mayo', 'Mayonnaise', ['mayo'], 'oil', 680, 1, 0.6, 75, [['1 tbsp', 14]], true),
  ingredient('soy-sauce', 'Soy sauce', ['toyo'], 'sauce', 53, 8.1, 4.9, 0.6, [['1 tbsp', 16], ['½ cup', 120]], true),
  ingredient('vinegar', 'Vinegar', ['suka'], 'sauce', 18, 0, 0, 0, [['1 tbsp', 15], ['½ cup', 120]], true),
  ingredient('fish-sauce', 'Fish sauce', ['patis'], 'sauce', 35, 5.1, 3.6, 0, [['1 tbsp', 18]], true),
  ingredient('brown-sugar', 'Brown sugar', ['asukal', 'sugar'], 'sweet', 380, 0.1, 98.1, 0, [['1 tsp', 4], ['1 tbsp', 12]], true),
  ingredient('white-sugar', 'White sugar', ['asukal', 'sugar'], 'sweet', 387, 0, 100, 0, [['1 tsp', 4.2], ['1 tbsp', 12.5]], true),
  ingredient('peanut-butter', 'Peanut butter', ['peanut butter'], 'other', 588, 25, 20, 50, [['1 tbsp', 16]]),
  ingredient('cola', 'Cola', ['softdrinks', 'coke'], 'drink', 42, 0, 10.6, 0, [['1 can (330 ml)', 330]], true),
  ingredient('coffee', 'Coffee, black', ['kape'], 'drink', 1, 0.1, 0, 0, [['1 cup', 240]]),
  ingredient('tuna', 'Tuna, canned in water, drained', ['tuna', 'isda'], 'protein', 116, 25.5, 0, 0.8, [['1 can, drained', 120]]),
  ingredient('ginger', 'Ginger', ['luya'], 'vegetable', 80, 1.8, 17.8, 0.8, [['1 thumb', 10]]),
  ingredient('sayote', 'Chayote (sayote)', ['sayote'], 'vegetable', 19, 0.8, 4.5, 0.1, [['1 medium', 200]]),
  ingredient('eggplant', 'Eggplant', ['talong'], 'vegetable', 25, 1, 5.9, 0.2, [['1 piece', 100]]),
  ingredient('squash', 'Squash (kalabasa)', ['kalabasa', 'pumpkin'], 'vegetable', 26, 1, 6.5, 0.1, [['1 cup cubed', 116]]),
  ingredient('radish', 'Radish (labanos)', ['labanos', 'daikon'], 'vegetable', 18, 0.6, 4.1, 0.1, [['1 piece', 200]]),
  ingredient('malunggay', 'Malunggay leaves', ['malunggay', 'moringa'], 'vegetable', 64, 9.4, 8.3, 1.4, [['1 cup', 21]]),
  ingredient('okra', 'Okra', ['okra'], 'vegetable', 33, 1.9, 7.5, 0.2, [['1 cup', 100]]),
  ingredient('sitaw', 'String beans (sitaw)', ['sitaw', 'yardlong beans'], 'vegetable', 47, 2.8, 8.4, 0.4, [['1 cup', 91]]),
  ingredient('ampalaya', 'Bitter melon (ampalaya)', ['ampalaya'], 'vegetable', 17, 1, 3.7, 0.2, [['1 medium', 124]]),
  ingredient('carrot', 'Carrot', ['karot'], 'vegetable', 41, 0.9, 9.6, 0.2, [['1 medium', 61]]),
  ingredient('monggo', 'Mung beans, dry', ['monggo', 'munggo'], 'protein', 347, 23.9, 62.6, 1.2, [['1 cup', 207]]),
  ingredient('tamarind', 'Tamarind', ['sampalok'], 'fruit', 239, 2.8, 62.5, 0.6, [['1 handful', 50]], true),
  ingredient('breadcrumbs', 'Breadcrumbs', ['panko', 'bread crumbs'], 'grain', 395, 13.4, 71.9, 5.3, [['¼ cup', 27]]),
  ingredient('broccoli', 'Broccoli', ['brokoli'], 'vegetable', 34, 2.8, 6.6, 0.4, [['1 cup chopped', 91]]),
  ingredient('tokwa', 'Firm tofu (tokwa)', ['tokwa', 'tofu'], 'protein', 144, 17.3, 2.8, 8.7, [['1 block', 150]]),
  ingredient('sardines', 'Sardines in tomato sauce, canned', ['sardinas', 'sardines'], 'protein', 186, 20.9, 0.7, 10.5, [['1 can', 155]]),
  ingredient('instant-noodles', 'Instant noodles, dry, with seasoning', ['instant noodles', 'pancit canton', 'mami'], 'grain', 440, 10, 62, 17, [['1 pack', 55]]),
  ingredient('cabbage', 'Cabbage (repolyo)', ['repolyo'], 'vegetable', 25, 1.3, 5.8, 0.1, [['1 cup chopped', 89]]),
  ingredient('rice-raw', 'White rice, uncooked', ['bigas', 'rice'], 'grain', 365, 7.1, 80, 0.7, [['1 cup', 185]]),
];

// Chain menu items, per serving. See the "Restaurant seed data" tab of the
// data model doc for how these were gathered and checked.
const MCDO = {
  breakfast: 'https://www.mcdonalds.com.ph/our-food/breakfast',
  burgers: 'https://www.mcdonalds.com.ph/our-food/burgers',
  chicken: 'https://www.mcdonalds.com.ph/our-food/chicken-platters',
};
const JB = 'https://jollibee-prod-media.s3.us-west-2.amazonaws.com/JB_USA_Nutrition_Facts_2025_101525_f94493117b.pdf';

// [slug, name, serving label, serving grams, kcal, protein, carbs, fat, source url]
const mcdoRows = [
  ['eggdesal', 'Cheesy Eggdesal', '1 sandwich', null, 248, 14, 31, 7, MCDO.breakfast],
  ['sausage-mcmuffin-egg', 'Sausage McMuffin with Egg', '1 sandwich', null, 409, 24, 37, 18, MCDO.breakfast],
  ['sausage-platter', 'Sausage Platter with Rice', '1 platter', null, 520, 25, 55, 22, MCDO.breakfast],
  ['hash-browns', 'Hash Browns', '1 piece', null, 135, 1, 10, 8, MCDO.breakfast],
  ['hotcakes-sausage', '2pc. Hotcakes with Sausage', '1 order', null, 392, 15, 58, 11, MCDO.breakfast],
  ['hotcakes', '2pc. Hotcakes', '1 order', null, 295, 7, 55, 5, MCDO.breakfast],
  ['burger-mcdo', 'Burger McDo', '1 burger', null, 354, 13, 43, 14, MCDO.burgers],
  ['qpc', 'Quarter Pounder with Cheese', '1 burger', null, 521, 31, 41, 25, MCDO.burgers],
  ['double-cheeseburger', 'Double Cheeseburger', '1 burger', null, 469, 27, 39, 22, MCDO.burgers],
  ['cheeseburger', 'Cheeseburger', '1 burger', null, 324, 16, 37, 12, MCDO.burgers],
  ['mcchicken', 'McChicken Sandwich', '1 sandwich', null, 358, 16, 40, 16, MCDO.burgers],
  ['crispy-chicken-sandwich', 'Crispy Chicken Sandwich', '1 sandwich', null, 387, 16, 42, 16, MCDO.burgers],
  ['big-mac', 'Big Mac', '1 burger', null, 752, 29, 59, 43, MCDO.burgers],
  ['mcdo-spaghetti', '1pc. Chicken McDo with McSpaghetti', '1 meal', null, 679, 34, 73, 28, MCDO.chicken],
  ['mcdo-2pc-rice', '2pc. Chicken McDo with Rice', '1 meal', null, 809, 47, 72, 36, MCDO.chicken],
  ['mcdo-1pc-rice', '1pc. Chicken McDo with Rice', '1 meal', null, 504, 26, 59, 18, MCDO.chicken],
  ['nuggets-fries', '6pc. Chicken McNuggets with Fries', '1 meal', null, 547, 37, 39, 27, MCDO.chicken],
  ['fillet-rice', 'Crispy Chicken Fillet with Rice', '1 meal', null, 363, 14, 57, 8, MCDO.chicken],
];

const jollibeeRows = [
  ['chickenjoy-drumstick', 'Chickenjoy Drumstick', '1 piece', 85, 220, 20, 3, 14],
  ['chickenjoy-thigh', 'Chickenjoy Thigh', '1 piece', 125, 380, 27, 5, 28],
  ['spicy-chickenjoy-drumstick', 'Spicy Chickenjoy Drumstick', '1 piece', 85, 240, 16, 10, 14],
  ['spicy-chickenjoy-thigh', 'Spicy Chickenjoy Thigh', '1 piece', 126, 350, 23, 15, 21],
  ['jb-gravy', 'Gravy', 'small', 77, 25, 1, 5, 0],
  ['jolly-spaghetti', 'Jollibee Spaghetti', '1 order', 411, 610, 23, 76, 23],
  ['palabok-fiesta', 'Palabok Fiesta', '1 order', 351, 410, 20, 49, 15],
  ['burgersteak-2pc', '2 pcs Burgersteak with Rice', '1 meal', 422, 570, 24, 56, 28],
  ['yum', 'Yum', '1 burger', 118, 360, 13, 30, 21],
  ['yum-cheese', 'Yum w/ Cheese', '1 burger', 132, 410, 16, 30, 25],
  ['jolly-fries', 'Jolly Crispy Fries', 'regular', 113, 340, 4, 41, 18],
  ['jb-mashed', 'Mashed Potato with Gravy', 'regular', 170, 170, 3, 33, 4.5],
  ['jb-rice', 'Steamed Rice', '1 order', 198, 190, 4, 44, 0],
  ['peach-mango-pie', 'Peach Mango Pie', '1 pie', 94, 270, 3, 40, 11],
  ['pineapple-quencher', 'Pineapple Quencher', '16 fl oz (473 ml)', 473, 180, 0, 46, 0],
];

function menuItem(slug, name, label, grams, kcal, protein, carbs, fat, placeId, extra) {
  return {
    id: `seed-${slug}`,
    name,
    aliases: [],
    category: 'dish',
    basis: 'per_serving',
    kcal, protein, carbs, fat,
    hidden: false,
    portions: [{ id: 'serving', label, grams }],
    placeId,
    owner: 'seed',
    verifiedOn: '2026-11-02',
    ...extra,
  };
}

const chainItems = [
  ...mcdoRows.map(([slug, name, label, grams, kcal, p, c, f, url]) =>
    menuItem(slug, name, label, grams, kcal, p, c, f, 'seed-place-mcdo', {
      source: "McDonald's Philippines official nutrition",
      sourceUrl: url,
    })),
  ...jollibeeRows.map(([slug, name, label, grams, kcal, p, c, f]) =>
    menuItem(slug, name, label, grams, kcal, p, c, f, 'seed-place-jollibee', {
      source: 'Jollibee US menu nutrition (Oct 2025). Philippine portions may differ.',
      sourceUrl: JB,
      defaultEstimate: true,
    })),
];

// Chains that publish no nutrition data for the Philippines. These are
// Busog's own estimates, built from typical portions of known ingredients
// (see the note on each item), and are always logged as estimates.
// [slug, place, name, serving label, serving grams, kcal, protein, carbs, fat, aliases, assumed portions]
const estimateRows = [
  ['mi-pm1-paa', 'manginasal', 'Chicken Inasal Paa with rice (PM1)', '1 meal', 305, 575, 41, 45, 24, ['chicken', 'inasal'], 'about 140 g chicken without the bone, 1 cup rice and a little chicken oil'],
  ['mi-pm2-pecho', 'manginasal', 'Chicken Inasal Pecho with rice (PM2)', '1 meal', 325, 565, 52, 45, 18, ['chicken', 'inasal'], 'about 160 g chicken without the bone, 1 cup rice and a little chicken oil'],
  ['mi-pork-bbq', 'manginasal', 'Pork BBQ with rice (2 sticks)', '1 meal', 280, 510, 28, 57, 17, ['pork', 'barbecue'], 'about 120 g grilled pork and 1 cup rice'],
  ['mi-extra-rice', 'manginasal', 'Extra rice (1 cup)', '1 cup', 160, 210, 4, 45, 0, ['unli rice'], '1 cup of rice, about 160 g'],
  ['ck-pork-chao-fan', 'chowking', 'Pork Chao Fan', '1 order', 300, 535, 20, 70, 20, ['pork', 'fried rice'], 'about 300 g of fried rice with pork'],
  ['ck-beef-mami', 'chowking', 'Beef Wonton Mami', '1 bowl', 600, 390, 27, 48, 12, ['beef', 'noodle soup'], 'a 600 g bowl with noodles, broth, beef and wontons'],
  ['ck-siomai', 'chowking', 'Pork Siomai (4 pcs)', '4 pieces', 100, 220, 12, 15, 12, ['pork', 'dimsum'], '4 pieces, about 25 g each'],
  ['ck-siopao', 'chowking', 'Asado Siopao', '1 piece', 150, 375, 15, 56, 10, ['pork', 'dimsum'], 'one 150 g bun'],
  ['ck-fried-chicken-rice', 'chowking', 'Chinese-style Fried Chicken with rice', '1 meal', 280, 540, 30, 56, 20, ['chicken'], 'about 120 g fried chicken without the bone and 1 cup rice'],
  ['ck-pancit-canton', 'chowking', 'Pancit Canton', '1 solo order', 250, 425, 18, 55, 15, ['noodles'], 'about 250 g of noodles with vegetables and meat'],
  ['ck-lumpia', 'chowking', 'Lumpiang Shanghai (3 pcs)', '3 pieces', 60, 180, 7, 13, 11, ['pork'], '3 pieces, about 20 g each'],
  ['kfc-1pc-rice', 'kfc', '1-pc Fried Chicken with rice', '1 meal', 290, 570, 32, 57, 22, ['chicken'], 'about 130 g fried chicken without the bone and 1 cup rice'],
  ['kfc-famous-bowl', 'kfc', 'Famous Bowl', '1 bowl', 325, 505, 23, 65, 16, ['chicken', 'rice bowl'], 'rice, about 60 g chicken bites, corn, gravy and cheese'],
  ['kfc-zinger', 'kfc', 'Zinger', '1 sandwich', 190, 570, 32, 41, 30, ['chicken', 'sandwich', 'burger'], 'a 120 g spicy chicken fillet on a bun with mayo'],
  ['kfc-mashed', 'kfc', 'Mashed Potato (regular)', '1 regular', 100, 90, 2, 14, 3, [], 'about 100 g with gravy'],
  ['gw-hawaiian-slice', 'greenwich', 'Hawaiian Overload pizza (1 slice)', '1 slice', 110, 295, 12, 33, 12, ['pizza', 'ham'], 'one 110 g pan-crust slice'],
  ['gw-lasagna', 'greenwich', 'Lasagna Supreme', '1 solo', 300, 420, 24, 42, 18, ['beef', 'pasta', 'noodles'], 'about 300 g'],
  ['sk-thin-slice', 'shakeys', "Manager's Choice thin crust pizza (1 slice)", '1 slice', 65, 195, 8, 20, 9, ['pizza', 'pork', 'beef'], 'one 65 g thin-crust slice'],
  ['sk-mojos', 'shakeys', 'Mojos (regular)', '1 regular', 120, 300, 4, 36, 16, ['potato'], 'about 120 g of battered potato slices'],
  ['mx-chicken-quarter', 'maxs', "Max's Fried Chicken (¼ chicken)", '¼ chicken', 200, 490, 52, 4, 30, ['chicken'], 'about 200 g chicken without the bone'],
  ['an-litson-quarter', 'andoks', 'Litson Manok (¼ chicken)', '¼ chicken', 200, 480, 55, 0, 27, ['chicken', 'roast'], 'about 200 g roast chicken without the bone, skin on'],
  ['bc-wings-6', 'bonchon', 'Soy Garlic Wings (6 pcs)', '6 pieces', 180, 540, 36, 22, 34, ['chicken'], '6 wings, about 30 g of meat and skin each'],
  ['bc-wings-rice', 'bonchon', 'Soy Garlic Wings with rice (2 pcs)', '1 meal', 220, 390, 16, 52, 12, ['chicken'], '2 wings and 1 cup rice'],
  ['tt-katsu-rice', 'tokyotokyo', 'Chicken Katsu with rice', '1 meal', 300, 535, 31, 65, 16, ['chicken', 'japanese'], 'about 120 g breaded chicken and a generous cup of rice'],
];

const estimatedItems = estimateRows.map(([slug, place, name, label, grams, kcal, p, c, f, aliases, note]) =>
  menuItem(slug, name, label, grams, kcal, p, c, f, `seed-place-${place}`, {
    aliases,
    source: `Busog estimate, not published by the restaurant. Assumes ${note}.`,
    defaultEstimate: true,
    isEstimateOnly: true,
    verifiedOn: null,
  }));

// Mang Inasal's chicken oil, so it can be added as an extra when logging.
const chickenOil = {
  ...ingredient('mi-chicken-oil', 'Chicken oil (Mang Inasal)', ['chicken oil', 'atsuete oil'], 'oil', 884, 0, 0, 100, [['1 tbsp', 13.6]], true),
  placeId: 'seed-place-manginasal',
  source: 'Busog estimate, treated like cooking oil.',
};

// Sodium in mg: per 100 g for ingredients, per serving for menu items.
// Approximate for ingredients; official for McDonald's and Jollibee.
const SODIUM = {
  rice: 1, bread: 491, oats: 6, egg: 142, 'chicken-thigh': 95, 'chicken-breast': 45, 'pork-belly': 32, 'ground-pork': 56,
  tilapia: 52, 'corned-beef': 1000, garlic: 17, onion: 4, tomato: 5, kangkong: 113, potato: 6, kamote: 55, banana: 1,
  mango: 1, milk: 43, oil: 0, butter: 643, mayo: 635, 'soy-sauce': 5490, vinegar: 2, 'fish-sauce': 7850, 'brown-sugar': 28,
  'white-sugar': 1, 'peanut-butter': 426, cola: 4, coffee: 2, tuna: 338, ginger: 13, sayote: 2, eggplant: 2, squash: 1,
  radish: 21, malunggay: 9, okra: 7, sitaw: 4, ampalaya: 5, carrot: 69, monggo: 15, tamarind: 28, breadcrumbs: 732,
  broccoli: 33, tokwa: 14, sardines: 414, 'instant-noodles': 1855, cabbage: 18, 'rice-raw': 5, 'mi-chicken-oil': 0,
  eggdesal: 402, 'sausage-mcmuffin-egg': 875, 'sausage-platter': 796, 'hash-browns': 271, 'hotcakes-sausage': 837,
  hotcakes: 487, 'burger-mcdo': 858, qpc: 1080, 'double-cheeseburger': 1087, cheeseburger: 715, mcchicken: 644,
  'crispy-chicken-sandwich': 1021, 'big-mac': 1452, 'mcdo-spaghetti': 1836, 'mcdo-2pc-rice': 2260, 'mcdo-1pc-rice': 1130,
  'nuggets-fries': 781, 'fillet-rice': 844,
  'chickenjoy-drumstick': 270, 'chickenjoy-thigh': 400, 'spicy-chickenjoy-drumstick': 540, 'spicy-chickenjoy-thigh': 790,
  'jb-gravy': 380, 'jolly-spaghetti': 1340, 'palabok-fiesta': 950, 'burgersteak-2pc': 1010, yum: 630, 'yum-cheese': 880,
  'jolly-fries': 560, 'jb-mashed': 730, 'jb-rice': 0, 'peach-mango-pie': 130, 'pineapple-quencher': 15,
};

export const seedFoods = [...ingredients, ...chainItems, ...estimatedItems, chickenOil, ...phIngredients, ...snackFoods].map((f) => {
  const na = SODIUM[f.id.replace('seed-', '')];
  return na != null && f.sodium == null ? { ...f, sodium: na } : f;
});

// Common Filipino home recipes. Amounts are typical home quantities in grams.
const g = (foodId, grams) => ({ foodId: `seed-${foodId}`, quantity: grams, portionId: 'g', grams });
function homeRecipe(id, name, servings, tags, ingredientsList, instructions, extra = {}) {
  return {
    id: `seed-recipe-${id}`, name, servings, expectedCookedG: null, version: 1, parentId: null,
    archived: false, owner: 'seed', collection: 'filipino', tags, instructions, ingredients: ingredientsList, ...extra,
  };
}
// Simple, healthy budget meals. cookedG is a typical finished weight, used to
// prefill "I cooked this"; weigh your own batch for the best accuracy.
const simple = (id, name, servings, tags, ingredientsList, instructions, cookedG = null) =>
  homeRecipe(id, name, servings, tags, ingredientsList, instructions, { collection: 'simple', expectedCookedG: cookedG });
// Cheap, quick meals for students: minutes to make and the equipment needed.
const student = (id, name, servings, minutes, tools, tags, ingredientsList, instructions) =>
  homeRecipe(id, name, servings, tags, ingredientsList, instructions, { collection: 'student', minutes, tools });

export const homeRecipes = [
  homeRecipe('sinigang', 'Sinigang na baboy', 6, ['soup', 'pork'], [
    g('pork-belly', 500), g('radish', 200), g('kangkong', 112), g('tomato', 246), g('onion', 110),
    g('sitaw', 91), g('tamarind', 50), g('fish-sauce', 18),
  ], 'Boil pork until tender. Add onion, tomato and tamarind, then radish and string beans. Add kangkong last and season with fish sauce.'),
  homeRecipe('tinola', 'Tinolang manok', 6, ['soup', 'chicken'], [
    g('chicken-thigh', 800), g('ginger', 20), g('onion', 110), g('garlic', 9), g('sayote', 400),
    g('malunggay', 21), g('fish-sauce', 36), g('oil', 13.6),
  ], 'Sauté garlic, onion and ginger. Brown the chicken, add water and simmer. Add sayote until tender, then malunggay.'),
  homeRecipe('pinakbet', 'Pinakbet', 4, ['veg', 'pork'], [
    g('pork-belly', 150), g('squash', 232), g('eggplant', 200), g('okra', 100), g('sitaw', 91),
    g('ampalaya', 124), g('tomato', 123), g('onion', 110), g('garlic', 9), g('fish-sauce', 18), g('oil', 13.6),
  ], 'Render the pork, sauté garlic, onion and tomato. Add squash first, then the other vegetables, and simmer until just tender.'),
  homeRecipe('monggo', 'Ginisang monggo', 6, ['veg', 'pork', 'soup'], [
    g('monggo', 207), g('ground-pork', 150), g('malunggay', 21), g('tomato', 123), g('onion', 110),
    g('garlic', 9), g('fish-sauce', 18), g('oil', 13.6),
  ], 'Boil mung beans until soft. Sauté garlic, onion, tomato and pork, add the beans and simmer. Stir in malunggay at the end.'),
  homeRecipe('tortang-talong', 'Tortang talong', 4, ['egg', 'veg'], [
    g('eggplant', 400), g('egg', 200), g('garlic', 3), g('oil', 27.2),
  ], 'Grill or boil eggplants, peel and flatten. Dip in beaten egg and pan-fry until golden on both sides.'),
  homeRecipe('giniling', 'Pork giniling', 4, ['pork'], [
    g('ground-pork', 500), g('potato', 173), g('carrot', 61), g('tomato', 123), g('onion', 110),
    g('garlic', 9), g('soy-sauce', 16), g('oil', 13.6),
  ], 'Sauté garlic, onion and tomato. Brown the pork, add diced potato and carrot with a little water, and simmer until soft.'),
  homeRecipe('sinangag', 'Sinangag (garlic fried rice)', 2, ['rice'], [
    g('rice', 316), g('garlic', 15), g('oil', 13.6),
  ], 'Fry minced garlic in oil until golden, add day-old rice and toss until heated through.'),
  homeRecipe('tuna-omelette', 'Tuna omelette', 2, ['egg', 'fish'], [
    g('tuna', 120), g('egg', 150), g('onion', 55), g('tomato', 62), g('oil', 13.6),
  ], 'Mix tuna, chopped onion and tomato into beaten eggs and pan-fry until set.'),

  simple('airfryer-chicken-breast', 'Air-fried chicken breast', 2, ['chicken', 'protein'], [
    g('chicken-breast', 500), g('oil', 4.5), g('garlic', 6),
  ], 'Pat dry, rub with oil, minced garlic, salt and pepper. Air fry at 200°C for 18 to 20 minutes, flipping halfway, until the center is no longer pink. Rest 5 minutes before slicing.', 375),
  simple('airfryer-nuggets', 'Air-fried chicken nuggets', 4, ['chicken', 'protein'], [
    g('chicken-breast', 500), g('egg', 50), g('breadcrumbs', 54), g('oil', 4.5),
  ], 'Cut chicken into bite-size pieces and season. Dip in beaten egg, then breadcrumbs. Spray or brush lightly with oil and air fry at 200°C for 10 to 12 minutes, turning once.', 450),
  simple('airfryer-potatoes', 'Air-fried potatoes', 3, ['veg'], [
    g('potato', 519), g('oil', 13.6), g('garlic', 6),
  ], 'Cut potatoes into wedges or cubes, toss with oil, garlic, salt and paprika. Air fry at 200°C for 20 minutes, shaking the basket halfway.', 380),
  simple('kamote-fries', 'Air-fried kamote fries', 3, ['veg'], [
    g('kamote', 390), g('oil', 9),
  ], 'Cut sweet potatoes into thin sticks, toss with oil and a pinch of salt. Air fry at 190°C for 15 to 18 minutes, shaking twice.', 300),
  simple('airfryer-tokwa', 'Air-fried tokwa', 2, ['protein'], [
    g('tokwa', 300), g('soy-sauce', 16), g('oil', 4.5),
  ], 'Press the tofu dry, cut into cubes and toss with soy sauce and oil. Air fry at 200°C for 12 to 15 minutes until crisp. Good with a vinegar and garlic dip.', 260),
  simple('garlic-butter-chicken', 'Garlic butter chicken bites', 3, ['chicken', 'protein'], [
    g('chicken-thigh', 500), g('butter', 14), g('garlic', 15), g('soy-sauce', 16),
  ], 'Brown bite-size chicken in a hot pan. Add butter, lots of garlic and a splash of soy sauce, and toss until glossy.', 400),
  simple('chicken-rice-bowls', 'Chicken and rice meal prep bowls', 4, ['chicken', 'rice', 'protein'], [
    g('chicken-breast', 600), g('rice', 632), g('broccoli', 364), g('soy-sauce', 32), g('garlic', 9), g('oil', 13.6),
  ], 'Cook seasoned chicken breast in the air fryer or a pan, then slice. Steam the broccoli. Divide rice, chicken and broccoli into 4 containers. Keeps 3 to 4 days in the fridge.'),
  simple('tuna-mayo-rice', 'Tuna mayo rice bowl', 1, ['fish', 'rice', 'egg', 'protein'], [
    g('tuna', 120), g('mayo', 14), g('rice', 158), g('egg', 50), g('soy-sauce', 8),
  ], 'Mix drained tuna with mayo. Serve on warm rice with a fried or soft-boiled egg and a drizzle of soy sauce.'),
  simple('egg-fried-rice', 'Egg fried rice', 2, ['egg', 'rice'], [
    g('rice', 316), g('egg', 100), g('carrot', 61), g('onion', 55), g('soy-sauce', 16), g('oil', 13.6),
  ], 'Scramble the eggs and set aside. Fry onion and diced carrot, add day-old rice and soy sauce, then fold the eggs back in.'),
  simple('overnight-oats', 'Overnight oats', 1, ['sweet'], [
    g('oats', 40), g('milk', 122), g('banana', 59), g('peanut-butter', 16),
  ], 'Mix oats and milk in a jar, top with sliced banana and peanut butter, and leave in the fridge overnight. Eat cold.'),
  simple('banana-oat-pancakes', 'Banana oat pancakes', 1, ['sweet', 'egg'], [
    g('banana', 118), g('egg', 100), g('oats', 40), g('oil', 4.5),
  ], 'Mash the banana, mix with eggs and oats. Cook small pancakes in a lightly oiled pan over medium heat, about 2 minutes a side.'),
  simple('tokwa-rice-bowl', 'Tokwa rice bowl', 1, ['rice', 'protein'], [
    g('tokwa', 150), g('rice', 158), g('soy-sauce', 16), g('oil', 4.5), g('garlic', 6),
  ], 'Air fry or pan-fry cubed tokwa until crisp, toss with soy sauce and garlic, and serve over rice.'),

  student('sardines-egg-rice', 'Sardines with egg and rice', 2, 10, ['One pan'], ['fish', 'egg', 'rice', 'protein'], [
    g('sardines', 155), g('egg', 100), g('onion', 55), g('garlic', 6), g('oil', 4.5), g('rice', 316),
  ], 'Sauté garlic and onion, add the sardines with their sauce and simmer 3 minutes. Push to one side, scramble 2 eggs in the pan, then serve over rice. One can feeds two.'),
  student('upgraded-noodles', 'Upgraded instant noodles', 1, 7, ['One pot'], ['noodles', 'egg', 'soup'], [
    g('instant-noodles', 55), g('egg', 50), g('kangkong', 56),
  ], 'Boil the noodles, then crack in an egg and add kangkong for the last 2 minutes. Use half the seasoning packet to cut the salt. The nutrition counts the whole packet, so it errs high.'),
  student('rice-cooker-chicken', 'Rice cooker chicken and rice', 3, 35, ['Rice cooker'], ['chicken', 'rice', 'protein'], [
    g('rice-raw', 185), g('chicken-thigh', 300), g('carrot', 61), g('cabbage', 89), g('garlic', 9), g('ginger', 10), g('soy-sauce', 16),
  ], 'Wash 1 cup rice and add water as usual. Lay seasoned chicken pieces, carrot, garlic and ginger on top and cook. Stir in cabbage and soy sauce, close the lid for 5 minutes, then fluff.'),
  student('rice-cooker-monggo', 'Rice cooker monggo with tokwa', 4, 50, ['Rice cooker'], ['veg', 'soup', 'protein'], [
    g('monggo', 207), g('tokwa', 150), g('kangkong', 112), g('tomato', 123), g('onion', 110), g('garlic', 9), g('fish-sauce', 18),
  ], 'Put washed mung beans, tomato, onion and garlic in the rice cooker with 5 cups water and cook twice through. Add cubed tokwa and kangkong, season with patis and keep warm 10 minutes.'),
  student('egg-tomato', 'Itlog at kamatis (egg and tomato)', 1, 10, ['One pan'], ['egg', 'veg'], [
    g('egg', 100), g('tomato', 246), g('onion', 55), g('oil', 9), g('fish-sauce', 9),
  ], 'Sauté onion and chopped tomato until soft, pour in beaten eggs and stir gently until just set. Season with a little patis. Good with rice.'),
  student('corned-beef-cabbage', 'Corned beef with cabbage', 2, 12, ['One pan'], ['beef'], [
    g('corned-beef', 150), g('cabbage', 178), g('onion', 55), g('garlic', 6), g('oil', 4.5),
  ], 'Sauté garlic and onion, add corned beef and break it up, then add shredded cabbage and cook until wilted. The cabbage stretches one can into two filling servings.'),
  student('adobong-kangkong-tokwa', 'Adobong kangkong with tokwa', 2, 15, ['One pan'], ['veg', 'protein'], [
    g('tokwa', 150), g('kangkong', 112), g('garlic', 9), g('soy-sauce', 16), g('vinegar', 15), g('oil', 9),
  ], 'Fry cubed tokwa until golden. Add garlic, then kangkong stems, then leaves, with soy sauce and vinegar. Cook until just wilted.'),
  student('savory-oats', 'Savory lugaw-style oats', 1, 7, ['Microwave'], ['egg', 'soup'], [
    g('oats', 40), g('egg', 50), g('garlic', 3), g('ginger', 5), g('fish-sauce', 6),
  ], 'Mix oats with 1 cup water, grated ginger and patis, and microwave 2 minutes. Stir in a beaten egg and microwave 1 more minute. Top with fried garlic if you have it.'),
  student('microwave-egg-rice', 'Microwave egg rice bowl', 1, 4, ['Microwave'], ['egg', 'rice'], [
    g('rice', 158), g('egg', 100), g('soy-sauce', 8),
  ], 'Put rice in a bowl, crack 2 eggs over it, and poke the yolks. Cover and microwave about 90 seconds until set. Drizzle with soy sauce.'),
  student('tuna-sandwich', 'Tuna sandwich', 1, 5, ['No stove'], ['fish', 'bread', 'protein'], [
    g('tuna', 120), g('mayo', 14), g('onion', 20), g('bread', 56),
  ], 'Mix drained tuna with mayo and chopped onion and spread between two slices of bread. Makes enough filling for a generous sandwich.'),
  student('pb-banana-toast', 'Peanut butter banana toast', 1, 3, ['No stove'], ['sweet', 'bread'], [
    g('bread', 56), g('peanut-butter', 16), g('banana', 118),
  ], 'Toast the bread if you can, spread with peanut butter and top with sliced banana.'),
];

// Time and equipment for the simple recipes too.
const SIMPLE_TIME = {
  'airfryer-chicken-breast': [25, ['Air fryer']], 'airfryer-nuggets': [25, ['Air fryer']], 'airfryer-potatoes': [25, ['Air fryer']],
  'kamote-fries': [22, ['Air fryer']], 'airfryer-tokwa': [20, ['Air fryer']], 'garlic-butter-chicken': [15, ['One pan']],
  'chicken-rice-bowls': [40, ['Air fryer', 'Rice cooker']], 'tuna-mayo-rice': [8, ['One pan']], 'egg-fried-rice': [15, ['One pan']],
  'overnight-oats': [5, ['No stove']], 'banana-oat-pancakes': [12, ['One pan']], 'tokwa-rice-bowl': [20, ['Air fryer']],
};
for (const r of homeRecipes) {
  const t = SIMPLE_TIME[r.id.replace('seed-recipe-', '')];
  if (t) { r.minutes = t[0]; r.tools = t[1]; }
}
homeRecipes.push(...phRecipes);

// The worked example from the data model doc.
export const sampleRecipe = {
  id: 'seed-recipe-adobo',
  name: 'Chicken adobo',
  servings: 6,
  expectedCookedG: 950,
  version: 1,
  parentId: null,
  archived: false,
  owner: 'seed',
  collection: 'filipino',
  tags: ['chicken'],
  instructions: 'Brown the chicken in oil. Add garlic, soy sauce, vinegar, sugar and bay leaves. Simmer until the sauce thickens.',
  ingredients: [
    { foodId: 'seed-chicken-thigh', quantity: 1, portionId: 'p1', grams: 1000 },
    { foodId: 'seed-oil', quantity: 2, portionId: 'p2', grams: 27.2 },
    { foodId: 'seed-soy-sauce', quantity: 1, portionId: 'p2', grams: 120 },
    { foodId: 'seed-garlic', quantity: 1, portionId: 'p2', grams: 40 },
    { foodId: 'seed-brown-sugar', quantity: 1, portionId: 'p2', grams: 12 },
    { foodId: 'seed-vinegar', quantity: 1, portionId: 'p2', grams: 120 },
  ],
};
