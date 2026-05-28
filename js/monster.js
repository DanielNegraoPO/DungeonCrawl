// =============================================
// MONSTER CLASS + AI
// =============================================
import { MONSTER_DEFS, FEATURES } from './data.js';
import { resolveMelee, aStarPath, applyStatusEffect } from './combat.js';
import { rng, rollDmg } from './rng.js';

export class Monster {
  constructor(defId, x, y) {
    this.defId = defId;
    const def = MONSTER_DEFS[defId];
    if (!def) throw new Error(`Unknown monster: ${defId}`);

    this.monsterDef = def;
    this.name = def.name;
    this.glyph = def.glyph;
    this.isPlayer = false;
    this.isMonster = true;

    this.x = x;
    this.y = y;

    // Stats
    this.maxHp = rng.int(def.hp[0], def.hp[1]);
    this.hp    = this.maxHp;
    this.ac    = def.ac;
    this.ev    = def.ev;
    this.str   = 10;
    this.int   = 10;
    this.dex   = def.ev - 8; // approximate
    this.skills = {}; // monsters use base AC/EV

    // Speed / AUT
    this.baseSpeed = def.speed;
    this.speed     = def.speed;
    this.nextTurn  = rng.int(0, def.speed); // stagger spawn turns

    // Status effects
    this.poison   = 0;
    this.confused = 0;
    this.slowed   = 0;
    this.hasted   = 0;

    // State
    this.isDead    = false;
    this.hostile   = true;
    this.seenPlayer = false;
    this.targetX   = -1;
    this.targetY   = -1;
    this.sleeping  = rng.bool(0.3); // 30% start sleeping

    // Unique flags
    this.isUnique = def.unique || false;

    // Sprite
    this.spriteImg    = null;
    this.spriteLoaded = false;
    this.spriteFile   = def.spriteFile;
    this._loadSprite();

    // XP / gold
    this.xpValue   = def.xp;
    this.goldValue  = def.gold ? rng.int(def.gold[0], def.gold[1]) : 0;
  }

  _loadSprite() {
    const img = new Image();
    img.onload  = () => { this.spriteImg = img; this.spriteLoaded = true; };
    img.onerror = () => { this.spriteLoaded = false; };
    img.src = this.spriteFile;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.sleeping = false; // wake on damage
    if (this.hp <= 0) { this.isDead = true; return true; }
    return false;
  }

  // Returns list of {x,y} moves or attack decision
  // Returns: { action: 'move'|'attack'|'wait'|'spell', dx?, dy?, target? }
  think(dungeon, players, allMonsters) {
    if (this.isDead) return { action: 'wait' };

    // Tick status
    this._tickStatus();

    // Find nearest living player
    const targets = players.filter(p => !p.isDead);
    if (targets.length === 0) return { action: 'wait' };

    let nearest = null, nearestDist = Infinity;
    for (const p of targets) {
      const d = Math.abs(p.x - this.x) + Math.abs(p.y - this.y);
      if (d < nearestDist) { nearestDist = d; nearest = p; }
    }

    // Check if can see player
    const dx = nearest.x - this.x, dy = nearest.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist <= 8 && this._hasLOS(this.x, this.y, nearest.x, nearest.y, dungeon)) {
      this.sleeping = false;
      this.seenPlayer = true;
      this.targetX = nearest.x;
      this.targetY = nearest.y;
    }

    if (this.sleeping || !this.seenPlayer) return { action: 'wait' };

    // Confused: random move
    if (this.confused > 0) {
      const dir = rng.choice([[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]);
      return { action: 'move', dx: dir[0], dy: dir[1] };
    }

    // Adjacent to target → attack
    if (Math.abs(nearest.x - this.x) <= 1 && Math.abs(nearest.y - this.y) <= 1) {
      // Check if can cast spell
      if (this.monsterDef.canCast && rng.bool(0.3)) {
        return { action: 'spell', target: nearest };
      }
      return { action: 'attack', target: nearest };
    }

    // Move toward target via A*
    const blockedByMonsters = new Set(allMonsters
      .filter(m => m !== this && !m.isDead)
      .map(m => `${m.x},${m.y}`));

    const nextStep = aStarPath(this.x, this.y, this.targetX, this.targetY,
      (x, y) => dungeon.isPassable(x, y) && !blockedByMonsters.has(`${x},${y}`),
      15
    );

    if (nextStep) {
      return { action: 'move', dx: nextStep.x - this.x, dy: nextStep.y - this.y };
    }

    return { action: 'wait' };
  }

  _hasLOS(x1, y1, x2, y2, dungeon) {
    // Simple Bresenham LOS check
    let dx = Math.abs(x2-x1), dy = Math.abs(y2-y1);
    let x = x1, y = y1;
    const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      if (x === x2 && y === y2) return true;
      if ((x !== x1 || y !== y1) && dungeon.isOpaque(x, y)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx)  { err += dx; y += sy; }
    }
  }

  _tickStatus() {
    if (this.poison > 0) {
      this.hp = Math.max(0, this.hp - Math.ceil(this.poison / 5));
      this.poison = Math.max(0, this.poison - 1);
      if (this.hp <= 0) { this.isDead = true; }
    }
    if (this.confused > 0) this.confused--;
    if (this.slowed   > 0) this.slowed--;
    if (this.hasted   > 0) this.hasted--;
  }

  getActionCost(action = 'move') {
    let spd = this.baseSpeed;
    if (this.hasted > 0) spd = Math.ceil(spd * 0.67);
    if (this.slowed > 0) spd = Math.floor(spd * 1.5);
    return spd;
  }

  performAttack(target) {
    const attackDef = this.monsterDef.attacks ? this.monsterDef.attacks[0] : null;
    const dmgStr = attackDef ? attackDef.dmg : '1d4';
    const verb   = attackDef ? attackDef.verb : 'ataca';

    // To-hit vs EV
    const toHit = 8 + rng.int(0, 10) + Math.floor(this.ev / 2);
    const ev = target.ev + rng.int(0, target.ev);

    if (toHit < ev) {
      return { hit: false, damage: 0, verb: `${verb} e erra` };
    }

    let dmg = rollDmg(dmgStr);
    const targetAC = target.ac || 0;
    const acRed = rng.int(0, targetAC);
    dmg = Math.max(0, dmg - Math.floor(acRed * 0.5));

    // Apply special effects
    const effects = [];
    if (attackDef?.effect) {
      effects.push({ type: attackDef.effect, power: attackDef.power || 1 });
    }

    return { hit: true, damage: Math.max(dmg, 1), verb, effects };
  }

  performSpell(target) {
    const spells = this.monsterDef.spells || [];
    const spellId = rng.choice(spells);

    switch (spellId) {
      case 'smite': {
        const dmg = rng.int(7, 14);
        return { hit: true, damage: dmg, verb: 'invoca força divina contra', spellName: 'Smite', effects: [] };
      }
      case 'magic_dart': {
        const dmg = rng.int(3, 8);
        return { hit: true, damage: dmg, verb: 'dispara um dardo mágico contra', spellName: 'Dardo Mágico', effects: [] };
      }
      case 'throw_flame': {
        const dist = Math.sqrt((target.x - this.x)**2 + (target.y - this.y)**2);
        if (dist > 5) return null; // too far
        const dmg = rng.int(8, 18);
        return { hit: true, damage: dmg, verb: 'lança chamas contra', spellName: 'Chama', effects: [] };
      }
      default:
        return null;
    }
  }
}

// =============================================
// MONSTER SPAWNER
// =============================================
import { D1_SPAWN_TABLE } from './data.js';

let sigmundSpawned = false;

export function spawnMonsters(dungeon, count = 25) {
  sigmundSpawned = false;
  const floorCells = dungeon.getFloorCells();
  const monsters = [];

  // Build weighted table
  const table = D1_SPAWN_TABLE.map(([id, w]) => ({ item: id, w }));

  for (let i = 0; i < count; i++) {
    if (floorCells.length === 0) break;

    // Pick spawn table entry
    let defId;
    let attempts = 0;
    do {
      defId = rng.weighted(table);
      attempts++;
    } while (
      (defId === 'sigmund' && sigmundSpawned) ||
      attempts > 20
    );

    if (defId === 'sigmund') sigmundSpawned = true;

    // Pick a random floor cell away from start positions
    const cell = rng.choice(floorCells.filter(c => {
      // Avoid spawning on existing monsters
      return !monsters.some(m => m.x === c.x && m.y === c.y);
    }));

    if (!cell) continue;

    try {
      const m = new Monster(defId, cell.x, cell.y);
      monsters.push(m);
    } catch (e) {
      // Skip invalid monster defs
    }
  }

  return monsters;
}

export function resetSigmund() { sigmundSpawned = false; }
