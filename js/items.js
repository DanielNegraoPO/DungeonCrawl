// =============================================
// ITEM GENERATION FOR D:1
// =============================================
import { POTION_TYPES, SCROLL_TYPES, WEAPON_TYPES, ARMOUR_TYPES } from './data.js';
import { rng } from './rng.js';

const POTION_IDS  = Object.keys(POTION_TYPES);
const SCROLL_IDS  = Object.keys(SCROLL_TYPES);
const WEAPON_IDS  = ['dagger', 'short_sword', 'mace', 'hand_axe', 'spear', 'short_bow'];
const ARMOUR_IDS  = ['robe', 'leather', 'ring_mail', 'chain_mail'];

// Sprite paths for items (from main.png, but we use colored shapes as fallback)
const ITEM_COLORS = {
  potion:  { healing: '#ff4444', restore_mp: '#4488ff', might: '#ff8800', speed: '#44ffbb', confusion: '#aa44aa', poison: '#44aa22' },
  scroll:  '#e8e0c0',
  weapon:  '#c0c0c0',
  armour:  '#a08040',
  gold:    '#f0c020'
};

// Unidentified names for potions/scrolls
const UNID_POTION_NAMES = [
  'Poção Azul', 'Poção Vermelha', 'Poção Verde', 'Poção Roxa',
  'Poção Laranja', 'Poção Turquesa', 'Poção Amarela', 'Poção Branca',
  'Poção Fumegante', 'Poção Brilhante'
];

const UNID_SCROLL_NAMES = [
  'Pergaminho Manchado', 'Pergaminho Envelhecido', 'Pergaminho Doblado',
  'Pergaminho Dourado', 'Pergaminho Sujo', 'Pergaminho Brilhante'
];

// Per-game identification state (shared for both players)
const identifiedPotions  = new Set();
const identifiedScrolls  = new Set();
let potionNameMap  = {};
let scrollNameMap  = {};

export function initItemSystem() {
  identifiedPotions.clear();
  identifiedScrolls.clear();

  // Assign random unidentified names
  const shuffledPotionNames = [...UNID_POTION_NAMES].sort(() => rng.next() - 0.5);
  const shuffledScrollNames = [...UNID_SCROLL_NAMES].sort(() => rng.next() - 0.5);

  potionNameMap = {};
  POTION_IDS.forEach((id, i) => {
    potionNameMap[id] = shuffledPotionNames[i % shuffledPotionNames.length];
  });

  scrollNameMap = {};
  SCROLL_IDS.forEach((id, i) => {
    scrollNameMap[id] = shuffledScrollNames[i % shuffledScrollNames.length];
  });
}

export function identifyItem(item) {
  if (item.type === 'potion') identifiedPotions.add(item.effectId);
  if (item.type === 'scroll') identifiedScrolls.add(item.effectId);
  item.identified = true;
  item.name = item.trueName;
}

export function generateItem(type = null) {
  const roll = rng.int(0, 99);

  if (!type) {
    if (roll < 30)      type = 'potion';
    else if (roll < 50) type = 'scroll';
    else if (roll < 65) type = 'weapon';
    else if (roll < 75) type = 'armour';
    else                type = 'gold';
  }

  switch (type) {
    case 'potion':  return _genPotion();
    case 'scroll':  return _genScroll();
    case 'weapon':  return _genWeapon();
    case 'armour':  return _genArmour();
    case 'gold':    return _genGold();
    default:        return _genPotion();
  }
}

function _genPotion() {
  const effectId = rng.choice(POTION_IDS.filter(id => id !== 'confusion' || rng.bool(0.3)));
  const potDef   = POTION_TYPES[effectId];
  const identified = identifiedPotions.has(effectId);
  const unidName  = potionNameMap[effectId] || 'Poção Misteriosa';
  const color     = ITEM_COLORS.potion[effectId] || '#8888ff';

  return {
    type: 'potion',
    effectId,
    effect: potDef.effect,
    power: potDef.power,
    trueName: potDef.name,
    name: identified ? potDef.name : unidName,
    identified,
    color,
    desc: identified ? `Beber para ${potDef.name.toLowerCase()}` : '?',
    sprite: 'potion'
  };
}

function _genScroll() {
  const effectId = rng.choice(SCROLL_IDS);
  const scrDef   = SCROLL_TYPES[effectId];
  const identified = identifiedScrolls.has(effectId);
  const unidName   = scrollNameMap[effectId] || 'Pergaminho Misterioso';

  return {
    type: 'scroll',
    effectId,
    effect: scrDef.effect,
    trueName: scrDef.name,
    name: identified ? scrDef.name : unidName,
    identified,
    color: ITEM_COLORS.scroll,
    desc: identified ? scrDef.name : '?',
    sprite: 'scroll'
  };
}

function _genWeapon() {
  const typeId = rng.choice(WEAPON_IDS);
  const wDef   = WEAPON_TYPES[typeId];
  const enchant = rng.bool(0.2) ? rng.int(1, 3) : 0;
  const cursed  = rng.bool(0.1);

  let name = wDef.name;
  if (enchant > 0)  name = `${name} +${enchant}`;
  if (cursed)       name = `${name} (amaldiçoada)`;

  return {
    type: 'weapon',
    weaponType: typeId,
    name,
    dmg: wDef.dmg,
    speed: wDef.speed,
    skill: wDef.skill,
    ranged: wDef.ranged || false,
    enchant,
    cursed,
    identified: true,
    color: ITEM_COLORS.weapon,
    desc: `${wDef.dmg} dano, velocidade ${wDef.speed}`
  };
}

function _genArmour() {
  const typeId = rng.choice(ARMOUR_IDS);
  const aDef   = ARMOUR_TYPES[typeId];
  const enchant = rng.bool(0.2) ? rng.int(1, 3) : 0;

  let name = aDef.name;
  if (enchant > 0) name = `${name} +${enchant}`;

  return {
    type: 'armour',
    armourType: typeId,
    name,
    ac: aDef.ac + enchant,
    evasion: aDef.evasion,
    enchant,
    identified: true,
    color: ITEM_COLORS.armour,
    desc: `AC +${aDef.ac + enchant}`
  };
}

function _genGold() {
  const amount = rng.int(5, 50);
  return {
    type: 'gold',
    name: `${amount} moedas de ouro`,
    amount,
    color: ITEM_COLORS.gold,
    sprite: 'gold',
    identified: true,
    desc: 'Moedas brilhantes'
  };
}

// Scatter items on the dungeon floor
export function placeItems(dungeon, count = 40) {
  const items = [];
  const floorCells = dungeon.getFloorCells();

  for (let i = 0; i < count; i++) {
    if (floorCells.length === 0) break;
    const cell = rng.choice(floorCells);
    const item = generateItem();
    items.push({ ...item, x: cell.x, y: cell.y });
  }

  return items;
}
