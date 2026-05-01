export type FodmapPortionSize = 'S' | 'M' | 'L'

export type FodmapGroup = { key: string; label: string }
export type FodmapFood = { key: string; group_key: string; label: string; emoji?: string }
export type FodmapPortion = { food_key: string; size: FodmapPortionSize; label: string }

export const GROUPS: FodmapGroup[] = [
  { key: 'fructanes_legumes', label: 'Fructanes (Légumes)' },
  { key: 'fructanes_fruits',  label: 'Fructanes (Fruits)' },
  { key: 'fructanes_pains',   label: 'Fructanes (Pains, céréales, grains)' },
  { key: 'gos',               label: 'GOS' },
  { key: 'fructose',          label: 'Fructose' },
  { key: 'lactose',           label: 'Lactose' },
  { key: 'polyols_sorbitol',  label: 'Polyols (sorbitol)' },
  { key: 'polyols_mannitol',  label: 'Polyols (mannitol)' },
]

export const FOODS: FodmapFood[] = [
  // Fructanes (Légumes)
  { key: 'ail',           group_key: 'fructanes_legumes', label: 'Ail',           emoji: '🧄' },
  { key: 'poireau_blanc', group_key: 'fructanes_legumes', label: 'Poireau blanc', emoji: '🥬' },
  { key: 'oignon',        group_key: 'fructanes_legumes', label: 'Oignon',        emoji: '🧅' },
  // Fructanes (Fruits)
  { key: 'mangue_sechee',  group_key: 'fructanes_fruits', label: 'Mangue séchée',     emoji: '🥭' },
  { key: 'papaye_sechee',  group_key: 'fructanes_fruits', label: 'Papaye séchée',     emoji: '🍈' },
  { key: 'fruit_passion',  group_key: 'fructanes_fruits', label: 'Fruit de la passion', emoji: '🍇' },
  // Fructanes (Pains, céréales, grains)
  { key: 'pain_ble',     group_key: 'fructanes_pains', label: 'Pain blé / pain blanc', emoji: '🍞' },
  { key: 'couscous_ble', group_key: 'fructanes_pains', label: 'Couscous (blé)',        emoji: '🍚' },
  { key: 'pates_ble',    group_key: 'fructanes_pains', label: 'Pâtes (blé)',           emoji: '🍝' },
  // GOS
  { key: 'amandes',         group_key: 'gos', label: 'Amandes',                  emoji: '🥜' },
  { key: 'haricots_rouges', group_key: 'gos', label: 'Haricots rouges (conserve)', emoji: '🫘' },
  { key: 'petits_pois',     group_key: 'gos', label: 'Petits pois (conserve)',   emoji: '🟢' },
  // Fructose
  { key: 'miel',      group_key: 'fructose', label: 'Miel',      emoji: '🍯' },
  { key: 'framboise', group_key: 'fructose', label: 'Framboise', emoji: '🍓' },
  { key: 'mure',      group_key: 'fructose', label: 'Mûre',      emoji: '🫐' },
  // Lactose
  { key: 'creme_sucree',  group_key: 'lactose', label: 'Crème sucrée',      emoji: '🥛' },
  { key: 'fromage_creme', group_key: 'lactose', label: 'Fromage à la crème', emoji: '🧀' },
  { key: 'lait',          group_key: 'lactose', label: 'Lait',              emoji: '🥛' },
  // Polyols (sorbitol)
  { key: 'avocat',       group_key: 'polyols_sorbitol', label: 'Avocat',           emoji: '🥑' },
  { key: 'chou_chinois', group_key: 'polyols_sorbitol', label: 'Chou chinois cru', emoji: '🥬' },
  { key: 'aubergine',    group_key: 'polyols_sorbitol', label: 'Aubergine',        emoji: '🍆' },
  // Polyols (mannitol)
  { key: 'choucroute',             group_key: 'polyols_mannitol', label: 'Choucroute / chou blanc', emoji: '🥬' },
  { key: 'champignon_paris',       group_key: 'polyols_mannitol', label: 'Champignon de Paris',     emoji: '🍄' },
  { key: 'champignon_portobello',  group_key: 'polyols_mannitol', label: 'Champignon portobello',   emoji: '🍄' },
]

export const PORTIONS: FodmapPortion[] = [
  // ail
  { food_key: 'ail', size: 'S', label: '1/4 gousse' },
  { food_key: 'ail', size: 'M', label: '1/2 gousse' },
  { food_key: 'ail', size: 'L', label: '1 gousse entière' },
  // poireau_blanc
  { food_key: 'poireau_blanc', size: 'S', label: '1/4 poireau' },
  { food_key: 'poireau_blanc', size: 'M', label: '1/2 poireau' },
  { food_key: 'poireau_blanc', size: 'L', label: '1 poireau entier' },
  // oignon
  { food_key: 'oignon', size: 'S', label: '1/4 oignon' },
  { food_key: 'oignon', size: 'M', label: '1/2 oignon' },
  { food_key: 'oignon', size: 'L', label: '1 oignon entier' },
  // mangue_sechee
  { food_key: 'mangue_sechee', size: 'S', label: '1 morceau (5g)' },
  { food_key: 'mangue_sechee', size: 'M', label: '2 morceaux' },
  { food_key: 'mangue_sechee', size: 'L', label: '4 morceaux' },
  // papaye_sechee
  { food_key: 'papaye_sechee', size: 'S', label: '5g' },
  { food_key: 'papaye_sechee', size: 'M', label: '10g' },
  { food_key: 'papaye_sechee', size: 'L', label: '15g' },
  // fruit_passion
  { food_key: 'fruit_passion', size: 'S', label: '50g' },
  { food_key: 'fruit_passion', size: 'M', label: '100g' },
  { food_key: 'fruit_passion', size: 'L', label: '150g' },
  // pain_ble
  { food_key: 'pain_ble', size: 'S', label: '25g' },
  { food_key: 'pain_ble', size: 'M', label: '40g' },
  { food_key: 'pain_ble', size: 'L', label: '60g' },
  // couscous_ble
  { food_key: 'couscous_ble', size: 'S', label: '50g' },
  { food_key: 'couscous_ble', size: 'M', label: '100g' },
  { food_key: 'couscous_ble', size: 'L', label: '150g' },
  // pates_ble
  { food_key: 'pates_ble', size: 'S', label: '75g' },
  { food_key: 'pates_ble', size: 'M', label: '90g' },
  { food_key: 'pates_ble', size: 'L', label: '160g' },
  // amandes
  { food_key: 'amandes', size: 'S', label: '15 noix' },
  { food_key: 'amandes', size: 'M', label: '20 noix' },
  { food_key: 'amandes', size: 'L', label: '25 noix' },
  // haricots_rouges
  { food_key: 'haricots_rouges', size: 'S', label: '85g' },
  { food_key: 'haricots_rouges', size: 'M', label: '100g' },
  { food_key: 'haricots_rouges', size: 'L', label: '200g' },
  // petits_pois
  { food_key: 'petits_pois', size: 'S', label: '55g' },
  { food_key: 'petits_pois', size: 'M', label: '70g' },
  { food_key: 'petits_pois', size: 'L', label: '75g' },
  // miel
  { food_key: 'miel', size: 'S', label: '1 c. à soupe' },
  { food_key: 'miel', size: 'M', label: '1 c. à soupe et demie' },
  { food_key: 'miel', size: 'L', label: '2 c. à soupe' },
  // framboise
  { food_key: 'framboise', size: 'S', label: '60g' },
  { food_key: 'framboise', size: 'M', label: '75g' },
  { food_key: 'framboise', size: 'L', label: '90g' },
  // mure
  { food_key: 'mure', size: 'S', label: '35g' },
  { food_key: 'mure', size: 'M', label: '50g' },
  { food_key: 'mure', size: 'L', label: '150g' },
  // creme_sucree
  { food_key: 'creme_sucree', size: 'S', label: '60ml' },
  { food_key: 'creme_sucree', size: 'M', label: '120ml' },
  { food_key: 'creme_sucree', size: 'L', label: '180ml' },
  // fromage_creme
  { food_key: 'fromage_creme', size: 'S', label: '40g' },
  { food_key: 'fromage_creme', size: 'M', label: '80g' },
  { food_key: 'fromage_creme', size: 'L', label: '120g' },
  // lait
  { food_key: 'lait', size: 'S', label: '125ml' },
  { food_key: 'lait', size: 'M', label: '250ml' },
  { food_key: 'lait', size: 'L', label: '375ml' },
  // avocat
  { food_key: 'avocat', size: 'S', label: '1/4 avocat' },
  { food_key: 'avocat', size: 'M', label: '1/2 avocat' },
  { food_key: 'avocat', size: 'L', label: '1 avocat entier' },
  // chou_chinois
  { food_key: 'chou_chinois', size: 'S', label: '75g' },
  { food_key: 'chou_chinois', size: 'M', label: '100g' },
  { food_key: 'chou_chinois', size: 'L', label: '150g' },
  // aubergine
  { food_key: 'aubergine', size: 'S', label: '75g' },
  { food_key: 'aubergine', size: 'M', label: '175g' },
  { food_key: 'aubergine', size: 'L', label: '270g' },
  // choucroute
  { food_key: 'choucroute', size: 'S', label: '25g' },
  { food_key: 'choucroute', size: 'M', label: '35g' },
  { food_key: 'choucroute', size: 'L', label: '75g' },
  // champignon_paris
  { food_key: 'champignon_paris', size: 'S', label: '75g' },
  { food_key: 'champignon_paris', size: 'M', label: '200g' },
  { food_key: 'champignon_paris', size: 'L', label: '300g' },
  // champignon_portobello
  { food_key: 'champignon_portobello', size: 'S', label: '10g' },
  { food_key: 'champignon_portobello', size: 'M', label: '15g' },
  { food_key: 'champignon_portobello', size: 'L', label: '75g' },
]

export function getFood(key: string): FodmapFood | undefined {
  return FOODS.find((f) => f.key === key)
}

export function getGroupFoods(groupKey: string): FodmapFood[] {
  return FOODS.filter((f) => f.group_key === groupKey)
}

export function getFoodPortions(foodKey: string): FodmapPortion[] {
  const order: Record<FodmapPortionSize, number> = { S: 0, M: 1, L: 2 }
  return PORTIONS.filter((p) => p.food_key === foodKey).sort((a, b) => order[a.size] - order[b.size])
}
