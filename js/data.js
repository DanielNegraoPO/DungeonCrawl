// =============================================
// DATA: RACES, CLASSES, MONSTERS, ITEMS
// All stats are faithful to DCSS 0.34
// =============================================
const BASE = 'Documentation/crawl-master/crawl-ref/source/rltiles';

// === RACES ===
export const RACES = {
  human: {
    id: 'human',
    name: 'Humano',
    desc: 'Versátil e equilibrado. Aprende habilidades rapidamente.',
    spriteFile: `${BASE}/player/base/human_f.png`,
    spriteFileMale: `${BASE}/player/base/human_m.png`,
    statBonuses: { str: 0, int: 0, dex: 0 },
    baseStats:   { str: 10, int: 10, dex: 10 },
    baseHP: 10, baseMP: 0,
    hpPerLevel: 10, mpPerLevel: 0,
    expBonus: 1.0, // 1.0 = no penalty
    skillAPT: { // all neutral
      fighting: 1, armour: 1, dodging: 1, shields: 1,
      swords: 1, axes: 1, maces: 1, spears: 1, staves: 1, bows: 1,
      throwing: 1,
      spellcasting: 1, conjurations: 1, hexes: 1, fire: 1, ice: 1, earth: 1,
      air: 1, poison: 1, necromancy: 1, summoning: 1, transmutation: 1
    }
  },
  minotaur: {
    id: 'minotaur',
    name: 'Minotauro',
    desc: 'Guerreiro brutal. Ataca inimigos que o acertam. Ruim em magia.',
    spriteFile: `${BASE}/player/base/minotaur_f.png`,
    spriteFileMale: `${BASE}/player/base/minotaur_m.png`,
    statBonuses: { str: 4, int: -4, dex: -1 },
    baseStats:   { str: 14, int: 6, dex: 9 },
    baseHP: 15, baseMP: 0,
    hpPerLevel: 15, mpPerLevel: 0,
    expBonus: 1.0,
    skillAPT: {
      fighting: 0.9, armour: 0.8, dodging: 0.8, shields: 0.9,
      swords: 0.7, axes: 0.7, maces: 0.7, spears: 0.8, staves: 0.9, bows: 1.2,
      throwing: 1.0,
      spellcasting: 1.7, conjurations: 1.5, hexes: 2.0, fire: 1.5, ice: 1.5,
      earth: 1.5, air: 1.5, poison: 1.5, necromancy: 2.0, summoning: 2.0, transmutation: 1.5
    }
  },
  merfolk: {
    id: 'merfolk',
    name: 'Sereio',
    desc: 'Ágil e habilidoso com lanças e magia de água. Muito veloz.',
    spriteFile: `${BASE}/player/base/merfolk_f.png`,
    spriteFileMale: `${BASE}/player/base/merfolk_m.png`,
    statBonuses: { str: 0, int: 1, dex: 3 },
    baseStats:   { str: 10, int: 11, dex: 13 },
    baseHP: 10, baseMP: 3,
    hpPerLevel: 10, mpPerLevel: 3,
    expBonus: 1.0,
    skillAPT: {
      fighting: 1.0, armour: 1.2, dodging: 0.7, shields: 0.9,
      swords: 1.0, axes: 1.2, maces: 1.2, spears: 0.7, staves: 1.0, bows: 1.2,
      throwing: 0.9,
      spellcasting: 1.0, conjurations: 1.0, hexes: 0.7, fire: 1.2, ice: 0.7,
      earth: 1.2, air: 1.2, poison: 0.7, necromancy: 1.0, summoning: 0.9, transmutation: 0.7
    }
  },
  orc: {
    id: 'orc',
    name: 'Orc da Colina',
    desc: 'Forte e resistente. Excelente com armas e armaduras pesadas.',
    spriteFile: `${BASE}/player/base/orc_f.png`,
    spriteFileMale: `${BASE}/player/base/orc_m.png`,
    statBonuses: { str: 3, int: -2, dex: 0 },
    baseStats:   { str: 13, int: 8, dex: 10 },
    baseHP: 12, baseMP: 0,
    hpPerLevel: 12, mpPerLevel: 0,
    expBonus: 1.0,
    skillAPT: {
      fighting: 0.8, armour: 0.7, dodging: 1.0, shields: 0.8,
      swords: 0.7, axes: 0.6, maces: 0.7, spears: 0.8, staves: 1.0, bows: 0.9,
      throwing: 0.9,
      spellcasting: 1.5, conjurations: 1.3, hexes: 1.5, fire: 1.2, ice: 1.2,
      earth: 1.0, air: 1.3, poison: 1.2, necromancy: 1.0, summoning: 1.2, transmutation: 1.3
    }
  }
};

// === CLASSES (Jobs) ===
export const JOBS = {
  fighter: {
    id: 'fighter',
    name: 'Guerreiro',
    desc: 'Combatente habilidoso com armas e armaduras. Muito resistente.',
    startWeapon: { type: 'long_sword', name: 'Espada Longa', dmg: '5d2', speed: 14 },
    startArmour: 'chain_mail',
    startSkills: { fighting: 3, swords: 3, armour: 2, shields: 2 },
    spells: []
  },
  wizard: {
    id: 'wizard',
    name: 'Mago',
    desc: 'Conjurador poderoso. Fraco no combate físico, mas magia letal.',
    startWeapon: { type: 'dagger', name: 'Adaga', dmg: '1d4', speed: 10 },
    startArmour: 'robe',
    startSkills: { spellcasting: 3, conjurations: 3, fire: 2 },
    spells: ['magic_dart', 'flame_tongue', 'blink']
  },
  rogue: {
    id: 'rogue',
    name: 'Ladino',
    desc: 'Furtivo e ágil. Ataques rápidos e habilidades de evasão.',
    startWeapon: { type: 'short_sword', name: 'Espada Curta', dmg: '3d2', speed: 11 },
    startArmour: 'leather',
    startSkills: { fighting: 2, swords: 3, dodging: 3, stealth: 2 },
    spells: []
  },
  hunter: {
    id: 'hunter',
    name: 'Caçador',
    desc: 'Arqueiro especialista. Combate à distância e armadilhas.',
    startWeapon: { type: 'short_bow', name: 'Arco Curto', dmg: '2d3', speed: 12 },
    startArmour: 'leather',
    startSkills: { fighting: 1, bows: 3, dodging: 2, throwing: 2 },
    spells: [],
    startMissiles: 20
  }
};

// === SPELLS ===
export const SPELLS = {
  magic_dart: {
    id: 'magic_dart',
    name: 'Dardo Mágico',
    school: 'Conjuração',
    level: 1, mpCost: 1,
    range: 6, damage: '1d4',
    desc: 'Um dardo de energia mágica. Nunca erra o alvo.',
    effect: 'ranged_auto_hit'
  },
  flame_tongue: {
    id: 'flame_tongue',
    name: 'Língua de Chama',
    school: 'Fogo',
    level: 1, mpCost: 2,
    range: 2, damage: '3d3',
    desc: 'Uma chama curta que queima inimigos adjacentes.',
    effect: 'ranged_fire'
  },
  blink: {
    id: 'blink',
    name: 'Teleporte Rápido',
    school: 'Translocation',
    level: 2, mpCost: 2,
    range: 0, damage: '0',
    desc: 'Teleporta o conjurador aleatoriamente próximo.',
    effect: 'blink'
  },
  throw_flame: {
    id: 'throw_flame',
    name: 'Lançar Chama',
    school: 'Fogo',
    level: 2, mpCost: 3,
    range: 5, damage: '3d5',
    desc: 'Atira uma bola de fogo em direção ao alvo.',
    effect: 'ranged_fire'
  }
};

// === ITEMS ===
export const ARMOUR_TYPES = {
  robe:       { name: 'Robe', ac: 2, evasion: 0, speed: 0 },
  leather:    { name: 'Armadura de Couro', ac: 4, evasion: -1, speed: 0 },
  ring_mail:  { name: 'Cota de Malha', ac: 7, evasion: -2, speed: 0 },
  chain_mail: { name: 'Camisola de Anéis', ac: 8, evasion: -3, speed: 0 },
  plate:      { name: 'Armadura de Prato', ac: 12, evasion: -5, speed: 0 }
};

export const WEAPON_TYPES = {
  dagger:      { name: 'Adaga',       dmg: '1d4', speed: 10, skill: 'swords' },
  short_sword: { name: 'Espada Curta', dmg: '3d2', speed: 11, skill: 'swords' },
  long_sword:  { name: 'Espada Longa', dmg: '5d2', speed: 14, skill: 'swords' },
  mace:        { name: 'Maça',         dmg: '2d4', speed: 13, skill: 'maces' },
  hand_axe:    { name: 'Machado',      dmg: '3d3', speed: 13, skill: 'axes' },
  spear:       { name: 'Lança',        dmg: '3d3', speed: 12, skill: 'spears' },
  short_bow:   { name: 'Arco Curto',   dmg: '2d3', speed: 12, skill: 'bows', ranged: true },
  arrow:       { name: 'Flecha',       dmg: '0d0', speed: 0 }
};

export const POTION_TYPES = {
  healing:      { name: 'Poção de Cura',       color: '#ff6060', effect: 'heal',       power: 10 },
  restore_mp:   { name: 'Poção de Mana',        color: '#6060ff', effect: 'restore_mp', power: 6 },
  might:        { name: 'Poção de Força',       color: '#ff8020', effect: 'might',      power: 3 },
  speed:        { name: 'Poção de Velocidade',  color: '#40e0a0', effect: 'haste',      power: 5 },
  confusion:    { name: 'Poção de Confusão',    color: '#a040a0', effect: 'confuse',    power: 5 },
  poison:       { name: 'Poção de Veneno',      color: '#40a020', effect: 'poison',     power: 3 }
};

export const SCROLL_TYPES = {
  identify:      { name: 'Pergaminho de Identificação', effect: 'identify' },
  teleportation: { name: 'Pergaminho de Teleporte',     effect: 'teleport' },
  fog:           { name: 'Pergaminho de Névoa',         effect: 'fog' },
  enchant_weapon:{ name: 'Pergaminho de Encantar Arma', effect: 'enchant_weapon' }
};

// === D:1 MONSTERS (faithful to DCSS) ===
export const MONSTER_DEFS = {
  // Very early D:1 (depth 1-3)
  kobold: {
    id: 'kobold', name: 'Kobold', glyph: 'k',
    spriteFile: `${BASE}/mon/humanoids/kobold.png`,
    hp: [4, 8], ac: 3, ev: 13, speed: 10,
    attacks: [{ type: 'melee', dmg: '1d4', verb: 'morde' }],
    xp: 8, gold: [0, 4],
    depth: [1, 5], threat: 1, color: '#8a5a30'
  },
  goblin: {
    id: 'goblin', name: 'Goblin', glyph: 'g',
    spriteFile: `${BASE}/mon/humanoids/goblin.png`,
    hp: [5, 9], ac: 2, ev: 12, speed: 10,
    attacks: [{ type: 'melee', dmg: '1d4', verb: 'ataca' }],
    xp: 10, gold: [0, 3],
    depth: [1, 5], threat: 1, color: '#708050'
  },
  rat: {
    id: 'rat', name: 'Rato', glyph: 'r',
    spriteFile: `${BASE}/mon/animals/rat.png`,
    hp: [3, 6], ac: 1, ev: 12, speed: 10,
    attacks: [{ type: 'melee', dmg: '1d3', verb: 'morde' }],
    xp: 4, gold: [0, 0],
    depth: [1, 4], threat: 0, color: '#806050'
  },
  bat: {
    id: 'bat', name: 'Morcego', glyph: 'b',
    spriteFile: `${BASE}/mon/animals/bat.png`,
    hp: [3, 5], ac: 1, ev: 17, speed: 15,
    attacks: [{ type: 'melee', dmg: '1d2', verb: 'arranha' }],
    xp: 3, gold: [0, 0],
    depth: [1, 5], threat: 0, color: '#604030'
  },
  jackal: {
    id: 'jackal', name: 'Chacal', glyph: 'h',
    spriteFile: `${BASE}/mon/animals/jackal.png`,
    hp: [5, 9], ac: 2, ev: 13, speed: 12,
    attacks: [{ type: 'melee', dmg: '1d4', verb: 'morde' }],
    xp: 8, gold: [0, 0],
    depth: [1, 4], threat: 0, color: '#b08040'
  },
  // Mid D:1
  hobgoblin: {
    id: 'hobgoblin', name: 'Hobgoblin', glyph: 'g',
    spriteFile: `${BASE}/mon/humanoids/hobgoblin.png`,
    hp: [9, 16], ac: 3, ev: 11, speed: 10,
    attacks: [{ type: 'melee', dmg: '2d3', verb: 'golpeia' }],
    xp: 20, gold: [0, 8],
    depth: [1, 7], threat: 2, color: '#607040'
  },
  adder: {
    id: 'adder', name: 'Víbora', glyph: 'S',
    spriteFile: `${BASE}/mon/animals/adder.png`,
    hp: [9, 15], ac: 1, ev: 14, speed: 12,
    attacks: [{ type: 'poison', dmg: '1d6', verb: 'morde', effect: 'poison', power: 1 }],
    xp: 22, gold: [0, 0],
    depth: [1, 6], threat: 2, color: '#508040'
  },
  gnoll: {
    id: 'gnoll', name: 'Gnoll', glyph: 'g',
    spriteFile: `${BASE}/mon/humanoids/gnoll.png`,
    hp: [11, 19], ac: 4, ev: 11, speed: 10,
    attacks: [
      { type: 'melee', dmg: '2d3', verb: 'golpeia' },
      { type: 'melee', dmg: '1d3', verb: 'chuta' }
    ],
    xp: 30, gold: [0, 12],
    depth: [2, 8], threat: 2, color: '#a08050'
  },
  orc: {
    id: 'orc', name: 'Orc', glyph: 'o',
    spriteFile: `${BASE}/mon/humanoids/orcs/orc.png`,
    hp: [12, 20], ac: 4, ev: 11, speed: 10,
    attacks: [{ type: 'melee', dmg: '3d3', verb: 'golpeia' }],
    xp: 35, gold: [0, 15],
    depth: [2, 8], threat: 2, color: '#809050'
  },
  jelly: {
    id: 'jelly', name: 'Geleia', glyph: 'J',
    spriteFile: `${BASE}/mon/amorphous/jelly.png`,
    hp: [15, 25], ac: 1, ev: 4, speed: 8,
    attacks: [{ type: 'acid', dmg: '1d4', verb: 'corrói', effect: 'acid', power: 1 }],
    xp: 25, gold: [0, 0],
    depth: [2, 7], threat: 2, color: '#80c040',
    isAmorphous: true
  },
  // Tougher D:1 (depth 3-5)
  gnoll_sergeant: {
    id: 'gnoll_sergeant', name: 'Sargento Gnoll', glyph: 'g',
    spriteFile: `${BASE}/mon/humanoids/gnoll_sergeant.png`,
    hp: [18, 28], ac: 6, ev: 11, speed: 10,
    attacks: [
      { type: 'melee', dmg: '3d3', verb: 'corta' },
      { type: 'melee', dmg: '2d2', verb: 'escuda' }
    ],
    xp: 55, gold: [5, 20],
    depth: [3, 9], threat: 3, color: '#c0a060'
  },
  orc_priest: {
    id: 'orc_priest', name: 'Padre Orc', glyph: 'o',
    spriteFile: `${BASE}/mon/humanoids/orcs/orc_priest.png`,
    hp: [16, 24], ac: 3, ev: 12, speed: 10,
    attacks: [{ type: 'melee', dmg: '2d3', verb: 'abençoa... ao atacar' }],
    canCast: true,
    spells: ['smite'], // pain for v1
    xp: 60, gold: [10, 25],
    depth: [3, 9], threat: 3, color: '#c08030'
  },
  orc_wizard: {
    id: 'orc_wizard', name: 'Mago Orc', glyph: 'o',
    spriteFile: `${BASE}/mon/humanoids/orcs/orc_wizard.png`,
    hp: [12, 20], ac: 2, ev: 13, speed: 10,
    attacks: [{ type: 'melee', dmg: '1d4', verb: 'usa bastão' }],
    canCast: true,
    spells: ['magic_dart', 'throw_flame'],
    xp: 55, gold: [5, 20],
    depth: [3, 9], threat: 3, color: '#4080c0'
  },
  scorpion: {
    id: 'scorpion', name: 'Escorpião', glyph: 's',
    spriteFile: `${BASE}/mon/animals/scorpion.png`,
    hp: [12, 20], ac: 5, ev: 11, speed: 10,
    attacks: [
      { type: 'poison', dmg: '1d6', verb: 'pica', effect: 'poison', power: 2 },
      { type: 'melee', dmg: '1d3', verb: 'agarra' }
    ],
    xp: 40, gold: [0, 0],
    depth: [3, 9], threat: 2, color: '#a06020'
  },
  worm: {
    id: 'worm', name: 'Verme de Fita', glyph: 'w',
    spriteFile: `${BASE}/mon/animals/ribbon_worm.png`,
    hp: [8, 14], ac: 1, ev: 7, speed: 8,
    attacks: [{ type: 'melee', dmg: '2d4', verb: 'envolve', effect: 'constrict', power: 1 }],
    xp: 28, gold: [0, 0],
    depth: [2, 7], threat: 1, color: '#e06060'
  },
  // Special: Sigmund (mini-boss of D:1)
  sigmund: {
    id: 'sigmund', name: 'Sigmund', glyph: '@',
    spriteFile: `${BASE}/mon/unique/sigmund.png`,
    hp: [20, 28], ac: 2, ev: 13, speed: 10,
    attacks: [{ type: 'melee', dmg: '3d4', verb: 'corta com foice' }],
    canCast: true, isUnique: true,
    spells: ['throw_flame'],
    xp: 200, gold: [10, 30],
    depth: [1, 5], threat: 5, color: '#e0e060',
    unique: true
  }
};

// Fallback sprite (colored rectangle) for missing images
export const FALLBACK_COLORS = {
  kobold: '#8a5a30', goblin: '#708050', rat: '#806050', bat: '#604030',
  jackal: '#b08040', hobgoblin: '#607040', adder: '#508040', gnoll: '#a08050',
  orc: '#809050', jelly: '#80c040', gnoll_sergeant: '#c0a060',
  orc_priest: '#c08030', orc_wizard: '#4080c0', scorpion: '#a06020',
  worm: '#e06060', sigmund: '#e0e060'
};

// D:1 spawn table (by depth 1-5, each array: [monster_id, weight])
export const D1_SPAWN_TABLE = [
  // Universal early
  ['rat',     20],
  ['bat',     15],
  ['kobold',  20],
  ['goblin',  18],
  ['jackal',  12],
  // Mid
  ['hobgoblin', 10],
  ['adder',     8],
  ['gnoll',     8],
  ['orc',       8],
  ['worm',      6],
  // Rarer / later
  ['jelly',         4],
  ['scorpion',      4],
  ['gnoll_sergeant', 2],
  ['orc_priest',    2],
  ['orc_wizard',    2],
  ['sigmund',       1]  // Special: unique, only once
];

// Feature tiles
export const FEATURES = {
  FLOOR:       0,
  WALL:        1,
  STAIR_DOWN:  2,
  STAIR_UP:    3,
  SHRINE:      4,  // Revival point
  DOOR:        5,
  DOOR_OPEN:   6,
  SHALLOW:     7
};
