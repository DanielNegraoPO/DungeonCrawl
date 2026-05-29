// =============================================
// ITEM GENERATION FOR D:1
// =============================================
import { POTION_TYPES, SCROLL_TYPES, WEAPON_TYPES, ARMOUR_TYPES } from './data.js';
import { rng } from './rng.js';

const BASE = 'Documentation/crawl-master/crawl-ref/source/rltiles/item';

// DCSS sprite paths for each item type
const ITEM_SPRITES = {
  // Weapons
  weapon: {
    dagger:      `${BASE}/weapon/dagger.png`,
    short_sword: `${BASE}/weapon/short_sword1.png`,
    long_sword:  `${BASE}/weapon/long_sword1.png`,
    mace:        `${BASE}/weapon/mace1.png`,
    hand_axe:    `${BASE}/weapon/hand_axe1.png`,
    spear:       `${BASE}/weapon/spear1.png`,
    short_bow:   `${BASE}/weapon/ranged/shortbow1.png`,
  },
  // Armour
  armour: {
    robe:       `${BASE}/armour/robe1.png`,
    leather:    `${BASE}/armour/leather_armour1.png`,
    ring_mail:  `${BASE}/armour/ring_mail1.png`,
    chain_mail: `${BASE}/armour/chain_mail1.png`,
    plate:      `${BASE}/armour/chain_mail3.png`,
  },
  // Potions (coloured bottles for unid, specific for id)
  potion: {
    healing:    `${BASE}/potion/i-heal-wounds.png`,
    restore_mp: `${BASE}/potion/i-magic.png`,
    might:      `${BASE}/potion/i-might.png`,
    speed:      `${BASE}/potion/i-haste.png`,
    confusion:  `${BASE}/potion/i-confusion.png`,
    poison:     `${BASE}/potion/i-poison.png`,
    // unidentified variants (visible colour)
    unid_red:   `${BASE}/potion/ruby.png`,
    unid_blue:  `${BASE}/potion/brilliant_blue.png`,
    unid_green: `${BASE}/potion/emerald.png`,
    unid_purple:`${BASE}/potion/magenta.png`,
    unid_orange:`${BASE}/potion/orange.png`,
    unid_cyan:  `${BASE}/potion/cyan.png`,
    unid_yellow:`${BASE}/potion/yellow.png`,
    unid_white: `${BASE}/potion/white.png`,
    unid_dark:  `${BASE}/potion/dark.png`,
    unid_gold:  `${BASE}/potion/golden.png`,
  },
  // Scrolls (coloured parchment)
  scroll: {
    identify:       `${BASE}/scroll/i-identify.png`,
    teleportation:  `${BASE}/scroll/i-teleportation.png`,
    fog:            `${BASE}/scroll/i-fog.png`,
    enchant_weapon: `${BASE}/scroll/i-enchant-weapon.png`,
    unid_blue:      `${BASE}/scroll/scroll-blue.png`,
    unid_brown:     `${BASE}/scroll/scroll-brown.png`,
    unid_cyan:      `${BASE}/scroll/scroll-cyan.png`,
    unid_green:     `${BASE}/scroll/scroll-green.png`,
    unid_grey:      `${BASE}/scroll/scroll-grey.png`,
    unid_purple:    `${BASE}/scroll/scroll-purple.png`,
    unid_red:       `${BASE}/scroll/scroll-red.png`,
    unid_yellow:    `${BASE}/scroll/scroll-yellow.png`,
  },
  // Gold
  gold: [
    `${BASE}/gold/01.png`,
    `${BASE}/gold/02.png`,
    `${BASE}/gold/03.png`,
    `${BASE}/gold/04.png`,
    `${BASE}/gold/05.png`,
    `${BASE}/gold/06.png`,
    `${BASE}/gold/07.png`,
  ]
};

// Fallback colors (used if sprite fails to load)
const ITEM_COLORS = {
  potion: { healing: '#ff4444', restore_mp: '#4488ff', might: '#ff8800', speed: '#44ffbb', confusion: '#aa44aa', poison: '#44aa22' },
  scroll: '#e8e0c0',
  weapon: '#c0c0c0',
  armour:  '#a08040',
  gold:    '#f0c020'
};

// Unidentified potion names and their corresponding sprite keys
const UNID_POTION_SPRITES = [
  'unid_red','unid_blue','unid_green','unid_purple',
  'unid_orange','unid_cyan','unid_yellow','unid_white','unid_dark','unid_gold'
];

// Unidentified scroll sprites
const UNID_SCROLL_SPRITES = [
  'unid_blue','unid_brown','unid_cyan','unid_green',
  'unid_grey','unid_purple','unid_red','unid_yellow'
];

// Unidentified names for potions/scrolls
const UNID_POTION_NAMES = [
  'Poção Vermelha', 'Poção Azul', 'Poção Verde', 'Poção Roxa',
  'Poção Laranja', 'Poção Turquesa', 'Poção Amarela', 'Poção Branca',
  'Poção Escura', 'Poção Dourada'
];

const UNID_SCROLL_NAMES = [
  'Pergaminho Azul', 'Pergaminho Marrom', 'Pergaminho Ciano',
  'Pergaminho Verde', 'Pergaminho Cinza', 'Pergaminho Roxo',
  'Pergaminho Vermelho', 'Pergaminho Amarelo'
];

// === Item ID lists (derived from imported data) ===
const POTION_IDS = Object.keys(POTION_TYPES);
const SCROLL_IDS = Object.keys(SCROLL_TYPES);
const WEAPON_IDS = ['dagger', 'short_sword', 'mace', 'hand_axe', 'spear', 'short_bow'];
const ARMOUR_IDS = ['robe', 'leather', 'ring_mail', 'chain_mail'];

// Per-game identification state (shared for both players)
const identifiedPotions  = new Set();
const identifiedScrolls  = new Set();
let potionNameMap  = {};
let potionSpriteMap = {};
let scrollNameMap  = {};
let scrollSpriteMap = {};


export function initItemSystem() {
  identifiedPotions.clear();
  identifiedScrolls.clear();

  // Assign random unidentified names and sprites
  const shuffledPotionNames   = [...UNID_POTION_NAMES].sort(() => rng.next() - 0.5);
  const shuffledPotionSprites = [...UNID_POTION_SPRITES].sort(() => rng.next() - 0.5);
  const shuffledScrollNames   = [...UNID_SCROLL_NAMES].sort(() => rng.next() - 0.5);
  const shuffledScrollSprites = [...UNID_SCROLL_SPRITES].sort(() => rng.next() - 0.5);

  potionNameMap   = {};
  potionSpriteMap = {};
  POTION_IDS.forEach((id, i) => {
    potionNameMap[id]   = shuffledPotionNames[i % shuffledPotionNames.length];
    potionSpriteMap[id] = shuffledPotionSprites[i % shuffledPotionSprites.length];
  });

  scrollNameMap   = {};
  scrollSpriteMap = {};
  SCROLL_IDS.forEach((id, i) => {
    scrollNameMap[id]   = shuffledScrollNames[i % shuffledScrollNames.length];
    scrollSpriteMap[id] = shuffledScrollSprites[i % shuffledScrollSprites.length];
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
  const unidName   = potionNameMap[effectId] || 'Poção Misteriosa';
  const unidSprKey = potionSpriteMap[effectId] || 'unid_blue';
  const color      = ITEM_COLORS.potion[effectId] || '#8888ff';

  // Use identified sprite when known, unidentified coloured bottle otherwise
  const spritePath = identified
    ? ITEM_SPRITES.potion[effectId]
    : ITEM_SPRITES.potion[unidSprKey];

  return {
    type: 'potion',
    effectId,
    effect: potDef.effect,
    power: potDef.power,
    trueName: potDef.name,
    name: identified ? potDef.name : unidName,
    identified,
    color,
    spritePath,
    desc: identified ? `Beber para ${potDef.name.toLowerCase()}` : '?',
  };
}

function _genScroll() {
  const effectId = rng.choice(SCROLL_IDS);
  const scrDef   = SCROLL_TYPES[effectId];
  const identified = identifiedScrolls.has(effectId);
  const unidName   = scrollNameMap[effectId] || 'Pergaminho Misterioso';
  const unidSprKey = scrollSpriteMap[effectId] || 'unid_brown';

  const spritePath = identified
    ? (ITEM_SPRITES.scroll[effectId] || ITEM_SPRITES.scroll[unidSprKey])
    : ITEM_SPRITES.scroll[unidSprKey];

  return {
    type: 'scroll',
    effectId,
    effect: scrDef.effect,
    trueName: scrDef.name,
    name: identified ? scrDef.name : unidName,
    identified,
    color: ITEM_COLORS.scroll,
    spritePath,
    desc: identified ? scrDef.name : '?',
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
    spritePath: ITEM_SPRITES.weapon[typeId] || ITEM_SPRITES.weapon.dagger,
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
    spritePath: ITEM_SPRITES.armour[typeId] || ITEM_SPRITES.armour.robe,
    desc: `AC +${aDef.ac + enchant}`
  };
}

function _genGold() {
  const amount = rng.int(5, 50);
  // Pick gold sprite based on amount
  const goldSprites = ITEM_SPRITES.gold;
  let sprIdx = 0;
  if (amount >= 20) sprIdx = 4;
  else if (amount >= 15) sprIdx = 3;
  else if (amount >= 10) sprIdx = 2;
  else if (amount >= 7)  sprIdx = 1;
  return {
    type: 'gold',
    name: `${amount} moedas de ouro`,
    amount,
    color: ITEM_COLORS.gold,
    spritePath: goldSprites[sprIdx],
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
