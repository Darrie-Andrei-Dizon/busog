// Filipino home cooking, street food, merienda and drinks.
// Ingredient values are approximate, in line with USDA FoodData Central where
// a match exists. Street food, merienda and drinks are Busog estimates from
// typical recipes and serving sizes, and are always logged as estimates.

const USDA = 'https://fdc.nal.usda.gov/';

// [id, name, aliases, category, kcal, protein, carbs, fat, sodium mg, portions, hidden]
const rows = [
  ['misua', 'Misua noodles, dry', ['misua', 'miswa', 'wheat vermicelli'], 'grain', 350, 11, 74, 1, 1000, [['1 bundle', 50]]],
  ['patola', 'Patola (sponge gourd)', ['patola', 'luffa'], 'vegetable', 20, 1.2, 4.4, 0.2, 3, [['1 medium', 200]]],
  ['beef-shank', 'Beef shank or brisket, raw', ['baka', 'beef', 'bulalo'], 'protein', 201, 20, 0, 13, 66, [['½ kg', 500]]],
  ['beef-sirloin', 'Beef sirloin, raw', ['baka', 'beef', 'tapa'], 'protein', 190, 21, 0, 11.5, 55, [['½ kg', 500]]],
  ['pork-shoulder', 'Pork shoulder (kasim), raw', ['kasim', 'baboy', 'pork'], 'protein', 190, 17.5, 0, 13, 65, [['½ kg', 500]]],
  ['pork-liver', 'Pork liver, raw', ['atay', 'liver'], 'protein', 134, 21, 2.5, 3.7, 87, [['100 g', 100]]],
  ['chicken-liver', 'Chicken liver, raw', ['atay ng manok', 'liver'], 'protein', 119, 16.9, 0.7, 4.8, 71, [['100 g', 100]]],
  ['bangus', 'Milkfish (bangus), raw', ['bangus', 'isda', 'fish'], 'protein', 148, 20.5, 0, 6.7, 72, [['1 belly', 150]]],
  ['shrimp', 'Shrimp (hipon), raw', ['hipon', 'shrimp'], 'protein', 85, 20, 0, 0.5, 119, [['½ kg', 500]]],
  ['longganisa', 'Longganisa', ['longganisa', 'sausage', 'pork'], 'protein', 350, 15, 15, 26, 900, [['1 piece', 40]]],
  ['hotdog', 'Hotdog', ['hotdog', 'sausage'], 'protein', 290, 10, 4, 26, 1000, [['1 piece', 40]]],
  ['corn', 'Corn on the cob', ['mais', 'corn'], 'vegetable', 86, 3.3, 19, 1.4, 15, [['1 ear', 100]]],
  ['saba', 'Saba banana', ['saba', 'plantain'], 'fruit', 122, 1.3, 32, 0.4, 4, [['1 piece', 90]]],
  ['pechay', 'Pechay (bok choy)', ['pechay', 'bok choy'], 'vegetable', 13, 1.5, 2.2, 0.2, 65, [['1 bunch', 200]]],
  ['taro-leaves', 'Taro leaves (dahon ng gabi)', ['gabi', 'laing'], 'vegetable', 42, 5, 6.7, 0.7, 3, [['1 pack', 100]]],
  ['bell-pepper', 'Bell pepper', ['siling pula', 'capsicum'], 'vegetable', 31, 1, 6, 0.3, 4, [['1 medium', 120]]],
  ['green-peas', 'Green peas', ['gisantes', 'peas'], 'vegetable', 81, 5.4, 14.5, 0.4, 5, [['½ cup', 72]]],
  ['bihon', 'Rice noodles (bihon), dry', ['bihon', 'pancit'], 'grain', 364, 6, 80, 0.6, 182, [['1 pack', 227]]],
  ['macaroni', 'Macaroni, dry', ['macaroni', 'pasta'], 'grain', 371, 13, 75, 1.5, 6, [['1 cup', 105]]],
  ['malagkit', 'Glutinous rice (malagkit), uncooked', ['malagkit', 'sticky rice'], 'grain', 370, 6.8, 81.7, 0.6, 7, [['1 cup', 185]]],
  ['coconut-milk', 'Coconut milk (gata)', ['gata', 'kakang gata'], 'oil', 197, 2, 2.8, 21, 13, [['1 cup', 240], ['1 can', 400]], true],
  ['evap', 'Evaporated milk', ['evap', 'evaporada'], 'dairy', 134, 6.8, 10, 7.6, 106, [['½ cup', 126], ['1 can', 390]]],
  ['tablea', 'Tablea (pure cacao)', ['tablea', 'cacao', 'chocolate'], 'sweet', 500, 9, 30, 52, 24, [['1 tablet', 20]]],
  ['bagoong', 'Shrimp paste (bagoong)', ['bagoong', 'alamang'], 'sauce', 160, 14, 6, 8, 7000, [['1 tbsp', 15]], true],
  ['salt', 'Salt', ['asin'], 'sauce', 0, 0, 0, 0, 38758, [['1 tsp', 6]], true],
];

export const phIngredients = rows.map(([id, name, aliases, category, kcal, protein, carbs, fat, sodium, portions, hidden = false]) => ({
  id: `seed-${id}`, name, aliases, category, basis: 'per_100g', kcal, protein, carbs, fat, sodium, hidden,
  portions: portions.map(([label, grams], i) => ({ id: `p${i + 1}`, label, grams })),
  placeId: null, owner: 'seed', source: 'USDA FoodData Central (approximate)', sourceUrl: USDA,
}));

const g = (foodId, grams) => ({ foodId: `seed-${foodId}`, quantity: grams, portionId: 'g', grams });
const dish = (id, name, servings, tags, ingredients, instructions, extra = {}) => ({
  id: `seed-recipe-${id}`, name, servings, expectedCookedG: null, version: 1, parentId: null,
  archived: false, owner: 'seed', collection: 'filipino', tags, instructions, ingredients, ...extra,
});

export const phRecipes = [
  dish('misua-patola', 'Misua with patola and meatballs', 3, ['soup', 'noodles', 'pork'], [
    g('misua', 50), g('patola', 200), g('ground-pork', 150), g('garlic', 6), g('onion', 55), g('oil', 4.5), g('fish-sauce', 18),
  ], 'Roll seasoned ground pork into small balls. Sauté garlic and onion, add 4 cups water and the meatballs, and simmer. Add sliced patola, then misua for the last 2 minutes. Season with patis.', { minutes: 25, tools: ['One pot'] }),
  dish('nilagang-baka', 'Nilagang baka', 5, ['soup', 'beef'], [
    g('beef-shank', 500), g('potato', 346), g('cabbage', 178), g('pechay', 200), g('corn', 200), g('onion', 110), g('fish-sauce', 18),
  ], 'Simmer beef with onion until tender, about 1½ hours. Add corn and potatoes, then cabbage and pechay at the end. Season with patis.'),
  dish('chicken-pastil', 'Chicken pastil', 4, ['chicken', 'rice'], [
    g('chicken-breast', 400), g('garlic', 9), g('onion', 55), g('soy-sauce', 16), g('oil', 27.2), g('rice', 632),
  ], 'Boil and shred the chicken. Sauté garlic and onion in oil, add the chicken and soy sauce, and cook until dry and slightly crisp. Wrap each cup of rice with chicken on top in banana leaf.'),
  dish('arroz-caldo', 'Arroz caldo', 5, ['soup', 'chicken', 'rice'], [
    g('malagkit', 185), g('chicken-thigh', 300), g('ginger', 20), g('garlic', 9), g('onion', 55), g('fish-sauce', 18), g('oil', 13.6), g('egg', 100),
  ], 'Sauté garlic, onion and ginger, brown the chicken, then add the rice and 8 cups water. Simmer, stirring, until thick. Season with patis and top with boiled egg and fried garlic.'),
  dish('lugaw', 'Lugaw with egg', 4, ['soup', 'egg', 'rice'], [
    g('rice-raw', 185), g('ginger', 15), g('garlic', 9), g('fish-sauce', 18), g('egg', 200),
  ], 'Simmer rice with ginger and 8 cups water until creamy. Season with patis and top each bowl with a boiled egg and fried garlic.', { minutes: 40, tools: ['One pot'] }),
  dish('champorado', 'Champorado', 4, ['sweet', 'rice'], [
    g('malagkit', 185), g('tablea', 60), g('white-sugar', 75), g('evap', 120),
  ], 'Boil glutinous rice in 5 cups water, add tablea and stir until melted and thick. Sweeten with sugar and drizzle with evaporated milk.', { minutes: 30, tools: ['One pot'] }),
  dish('sopas', 'Chicken sopas', 6, ['soup', 'chicken', 'noodles'], [
    g('macaroni', 210), g('chicken-breast', 300), g('hotdog', 80), g('carrot', 61), g('cabbage', 89), g('onion', 55), g('garlic', 6), g('evap', 390), g('butter', 14), g('fish-sauce', 18),
  ], 'Sauté garlic and onion in butter, add sliced chicken and hotdog, then 6 cups water. Add macaroni and carrot and cook until tender. Stir in cabbage and evaporated milk and season with patis.'),
  dish('menudo', 'Pork menudo', 5, ['pork'], [
    g('pork-shoulder', 500), g('pork-liver', 100), g('potato', 173), g('carrot', 61), g('bell-pepper', 120), g('tomato', 246), g('onion', 110), g('garlic', 9), g('soy-sauce', 32), g('oil', 13.6), g('green-peas', 72),
  ], 'Sauté garlic, onion and tomato, add diced pork and soy sauce, and simmer until tender. Add potato and carrot, then liver, bell pepper and peas for the last 10 minutes.'),
  dish('afritada', 'Chicken afritada', 6, ['chicken'], [
    g('chicken-thigh', 800), g('potato', 346), g('carrot', 122), g('bell-pepper', 120), g('tomato', 246), g('onion', 110), g('garlic', 9), g('fish-sauce', 18), g('oil', 13.6), g('green-peas', 72),
  ], 'Brown the chicken, sauté garlic, onion and tomato, then simmer together with a cup of water. Add potato and carrot, then bell pepper and peas until just cooked.'),
  dish('kare-kare', 'Kare-kare', 5, ['beef', 'veg'], [
    g('beef-shank', 500), g('peanut-butter', 96), g('eggplant', 200), g('sitaw', 91), g('pechay', 200), g('onion', 55), g('garlic', 6), g('oil', 13.6), g('bagoong', 30),
  ], 'Simmer beef until tender. Sauté garlic and onion, add beef and broth, and stir in peanut butter until thick. Cook the vegetables in it briefly. Serve with bagoong on the side.'),
  dish('bicol-express', 'Bicol express', 4, ['pork'], [
    g('pork-shoulder', 400), g('coconut-milk', 400), g('bagoong', 30), g('garlic', 9), g('onion', 55), g('oil', 4.5),
  ], 'Sauté garlic, onion and pork until browned. Add coconut milk, bagoong and sliced chilies, and simmer until the sauce is thick and oily.'),
  dish('laing', 'Laing', 4, ['veg', 'pork'], [
    g('taro-leaves', 100), g('coconut-milk', 400), g('pork-belly', 100), g('bagoong', 15), g('garlic', 9), g('onion', 55), g('ginger', 10),
  ], 'Simmer coconut milk with pork, garlic, onion, ginger and bagoong. Add the taro leaves without stirring and simmer until they soften and the sauce is thick.'),
  dish('ginataang-kalabasa', 'Ginataang kalabasa at sitaw', 4, ['veg', 'fish'], [
    g('squash', 464), g('sitaw', 182), g('coconut-milk', 240), g('shrimp', 150), g('garlic', 6), g('onion', 55), g('fish-sauce', 18),
  ], 'Sauté garlic and onion, add coconut milk and squash and simmer until soft. Add string beans and shrimp and cook a few minutes more. Season with patis.'),
  dish('chopsuey', 'Chopsuey', 4, ['veg', 'chicken'], [
    g('cabbage', 178), g('carrot', 61), g('broccoli', 182), g('bell-pepper', 120), g('sayote', 200), g('chicken-breast', 200), g('garlic', 9), g('onion', 55), g('soy-sauce', 16), g('oil', 13.6),
  ], 'Stir-fry chicken with garlic and onion, add the firmer vegetables first, then the rest with a splash of water and soy sauce. Keep the vegetables crisp.', { minutes: 25, tools: ['One pan'] }),
  dish('lechon-kawali', 'Lechon kawali', 8, ['pork', 'fried'], [
    g('pork-belly', 1000), g('oil', 30), g('salt', 6),
  ], 'Boil pork belly with salt until tender, dry well, then deep-fry until the skin is crisp. Slice and serve with a vinegar dip.'),
  dish('sisig', 'Pork sisig', 3, ['pork'], [
    g('pork-belly', 300), g('pork-liver', 50), g('onion', 110), g('mayo', 28), g('egg', 50), g('soy-sauce', 16), g('oil', 4.5),
  ], 'Boil then grill or fry the pork until crisp, and chop finely with the liver and onion. Toss on a hot pan with soy sauce and mayo, and top with an egg.'),
  dish('bistek', 'Bistek tagalog', 4, ['beef'], [
    g('beef-sirloin', 500), g('onion', 220), g('soy-sauce', 48), g('oil', 13.6),
  ], 'Marinate thin beef slices in soy sauce and calamansi. Fry onion rings and set aside, sear the beef, then simmer in the marinade and top with the onions.'),
  dish('paksiw-bangus', 'Paksiw na bangus', 4, ['fish', 'veg'], [
    g('bangus', 600), g('vinegar', 120), g('garlic', 9), g('ginger', 10), g('eggplant', 100), g('ampalaya', 124), g('salt', 3),
  ], 'Arrange fish, garlic, ginger and vegetables in a pot, add vinegar and a little water, and simmer without stirring until the fish is cooked.'),
  dish('daing-bangus', 'Daing na bangus', 2, ['fish', 'fried'], [
    g('bangus', 300), g('vinegar', 60), g('garlic', 9), g('oil', 27.2), g('salt', 2),
  ], 'Marinate butterflied bangus in vinegar, garlic and pepper overnight. Pan-fry until golden. Serve with rice and a vinegar dip.'),
  dish('tapsilog', 'Tapsilog', 1, ['beef', 'rice', 'egg'], [
    g('beef-sirloin', 100), g('soy-sauce', 16), g('white-sugar', 6), g('rice', 158), g('garlic', 5), g('oil', 9), g('egg', 50),
  ], 'Marinate thin beef in soy sauce, sugar and garlic, then pan-fry. Serve with garlic fried rice and a fried egg.', { minutes: 20, tools: ['One pan'] }),
  dish('longsilog', 'Longsilog', 1, ['pork', 'rice', 'egg'], [
    g('longganisa', 120), g('rice', 158), g('garlic', 5), g('oil', 9), g('egg', 50),
  ], 'Simmer longganisa in a little water until it dries, then fry in its own fat. Serve with garlic fried rice and a fried egg.', { minutes: 20, tools: ['One pan'] }),
  dish('pancit-bihon', 'Pancit bihon', 6, ['noodles', 'chicken'], [
    g('bihon', 227), g('chicken-breast', 200), g('cabbage', 178), g('carrot', 61), g('onion', 55), g('garlic', 9), g('soy-sauce', 48), g('oil', 13.6),
  ], 'Soak bihon. Sauté garlic, onion and sliced chicken, add vegetables and 2 cups water with soy sauce, then the noodles. Toss until the liquid is absorbed.'),
  dish('ginisang-ampalaya', 'Ginisang ampalaya with egg', 3, ['veg', 'egg'], [
    g('ampalaya', 248), g('egg', 100), g('tomato', 123), g('onion', 55), g('garlic', 6), g('oil', 9), g('fish-sauce', 9),
  ], 'Salt and squeeze sliced ampalaya to tame the bitterness. Sauté garlic, onion and tomato, add ampalaya, then stir in beaten eggs until set.', { minutes: 20, tools: ['One pan'] }),
  dish('sinigang-hipon', 'Sinigang na hipon', 5, ['soup', 'fish', 'veg'], [
    g('shrimp', 500), g('radish', 200), g('kangkong', 112), g('tomato', 246), g('onion', 110), g('sitaw', 91), g('tamarind', 50), g('fish-sauce', 18),
  ], 'Boil water with tomato, onion and tamarind. Add radish and string beans, then shrimp until pink, and kangkong last. Season with patis.'),
];

// Street food, merienda and drinks. Busog estimates per serving.
// [slug, name, category, serving label, kcal, protein, carbs, fat, sodium, aliases, note]
const snackRows = [
  ['fishball', 'Fishball with sauce (10 pcs)', 'snack', '10 pieces', 190, 8, 25, 7, 650, ['fish ball', 'street food'], '10 small fried fishballs with sweet sauce'],
  ['kikiam', 'Kikiam with sauce (5 pcs)', 'snack', '5 pieces', 220, 8, 22, 11, 700, ['street food'], '5 fried kikiam with sauce'],
  ['kwek-kwek', 'Kwek-kwek (5 pcs)', 'snack', '5 pieces', 200, 8, 17, 12, 300, ['quail egg', 'egg', 'street food'], '5 battered, fried quail eggs with vinegar'],
  ['isaw', 'Isaw (3 sticks)', 'snack', '3 sticks', 150, 13, 5, 9, 400, ['chicken', 'grilled', 'street food'], '3 sticks of grilled chicken intestine with sauce'],
  ['balut', 'Balut', 'snack', '1 piece', 188, 14, 1, 14, 120, ['egg', 'street food'], 'one duck egg'],
  ['banana-cue', 'Banana cue (1 stick)', 'snack', '1 stick', 360, 2, 80, 5, 5, ['saba', 'street food'], '2 saba bananas fried in caramelized sugar'],
  ['kamote-cue', 'Kamote cue (1 stick)', 'snack', '1 stick', 250, 2, 50, 5, 60, ['kamote', 'street food'], 'about 150 g sweet potato fried in caramelized sugar'],
  ['turon', 'Turon', 'snack', '1 piece', 285, 2, 50, 9, 40, ['saba', 'street food'], 'saba banana with sugar in a fried wrapper'],
  ['taho', 'Taho (regular cup)', 'snack', '1 regular cup', 220, 7, 40, 3, 15, ['tofu', 'street food'], 'silken tofu with arnibal syrup and sago'],
  ['pandesal', 'Pandesal', 'snack', '1 piece', 90, 2.7, 16, 1.4, 150, ['bread', 'tinapay'], 'one 30 g roll'],
  ['ensaymada', 'Ensaymada', 'snack', '1 piece', 265, 6, 33, 12, 220, ['bread', 'tinapay'], 'one 70 g roll with butter, sugar and cheese'],
  ['spanish-bread', 'Spanish bread', 'snack', '1 piece', 170, 4, 25, 6, 160, ['bread', 'tinapay'], 'one 45 g roll'],
  ['pan-de-coco', 'Pan de coco', 'snack', '1 piece', 200, 4, 32, 7, 150, ['bread', 'tinapay'], 'one 60 g roll'],
  ['hopia', 'Hopia', 'snack', '1 piece', 200, 3, 30, 8, 80, ['pastry'], 'one 50 g pastry'],
  ['puto', 'Puto', 'snack', '1 piece', 70, 1.5, 15, 0.5, 60, ['rice cake'], 'one 30 g steamed rice cake'],
  ['kutsinta', 'Kutsinta', 'snack', '1 piece', 70, 0.5, 17, 0.2, 20, ['rice cake'], 'one 35 g piece'],
  ['bibingka', 'Bibingka', 'snack', '1 piece', 330, 7, 50, 11, 300, ['rice cake'], 'one 120 g piece with egg and cheese'],
  ['maruya', 'Maruya', 'snack', '1 piece', 180, 2, 30, 6, 40, ['saba', 'banana fritter'], 'one battered, fried saba fritter'],
  ['halo-halo', 'Halo-halo (regular)', 'snack', '1 regular glass', 350, 6, 65, 8, 80, ['dessert'], 'a 16 oz glass with milk, sweet beans, leche flan and ube'],
  ['milk-tea', 'Milk tea with pearls (100% sugar)', 'drink', '16 oz', 380, 2, 70, 10, 80, ['milktea', 'boba'], 'a 16 oz cup at full sugar'],
  ['milk-tea-50', 'Milk tea with pearls (50% sugar)', 'drink', '16 oz', 280, 2, 45, 10, 80, ['milktea', 'boba'], 'a 16 oz cup at half sugar'],
  ['3in1-coffee', '3-in-1 coffee', 'drink', '1 sachet', 110, 1, 18, 4, 60, ['kape', 'coffee mix'], 'one 25 g sachet'],
  ['iced-coffee', 'Iced coffee, sweetened', 'drink', '16 oz', 200, 3, 35, 5, 70, ['kape', 'coffee'], 'a 16 oz cup with milk and syrup'],
  ['softdrinks-mismo', 'Softdrinks (mismo)', 'drink', '1 bottle (295 ml)', 125, 0, 31, 0, 10, ['coke', 'soda', 'cola'], 'a 295 ml bottle'],
  ['sago-gulaman', "Sago't gulaman", 'drink', '16 oz', 180, 0, 45, 0, 15, ['palamig'], 'a 16 oz cup'],
  ['buko-juice', 'Buko juice (unsweetened)', 'drink', '1 glass (250 ml)', 48, 0.5, 9, 0.5, 260, ['coconut water'], '250 ml fresh coconut water'],
  ['choco-malt', 'Chocolate malt drink', 'drink', '1 sachet', 95, 2, 16, 2, 40, ['milo', 'chocolate'], 'one sachet mixed with water'],
  ['calamansi-juice', 'Calamansi juice, sweetened', 'drink', '1 glass', 100, 0, 25, 0, 5, ['calamansi'], 'one glass with sugar'],
  ['mango-shake', 'Mango shake', 'drink', '16 oz', 300, 3, 60, 4, 50, ['fruit shake'], 'a 16 oz cup with mango, milk and sugar'],
  ['beer', 'Beer (1 bottle)', 'drink', '1 bottle (330 ml)', 145, 1, 13, 0, 10, ['serbesa'], 'a 330 ml bottle of pale lager'],
];

export const snackFoods = snackRows.map(([slug, name, category, label, kcal, protein, carbs, fat, sodium, aliases, note]) => ({
  id: `seed-${slug}`, name, aliases, category, basis: 'per_serving', kcal, protein, carbs, fat, sodium, hidden: false,
  portions: [{ id: 'serving', label, grams: null }], placeId: null, owner: 'seed',
  source: `Busog estimate from typical recipes and serving sizes. Assumes ${note}.`,
  defaultEstimate: true, isEstimateOnly: true,
}));
