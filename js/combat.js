// =============================================
// COMBAT SYSTEM — Faithful to DCSS formulas
// =============================================
import { rng, rollDmg } from './rng.js';

// =============================================
// DCSS To-Hit Formula (simplified faithful version)
// to_hit = skill * 2 + dex_bonus + weapon_bonus
// defender evades: ev = dex * 0.5 + dodge_skill * 1.5
// =============================================

export function meleeToHit(attacker, weapon = null) {
  const skill = attacker.skills ? (attacker.skills.fighting || 0) * 2 : 0;
  const weapSkill = attacker.skills ? (attacker.skills[weapon?.skill || 'fighting'] || 0) * 3 : 0;
  const dexBonus = Math.floor((attacker.dex - 10) / 2);
  const randBonus = rng.int(0, 10);
  return 10 + skill + weapSkill + dexBonus + randBonus;
}

export function evasionCheck(defender) {
  const dodgeSkill = defender.skills ? (defender.skills.dodging || 0) * 1.5 : 0;
  const dexBonus = Math.floor((defender.dex - 10) / 2);
  const ev = (defender.ev || 10) + dodgeSkill + dexBonus;
  return rng.int(1, Math.max(1, ev));
}

export function rollMeleeDamage(attacker, weapon = null) {
  const dmgStr = weapon ? weapon.dmg : '1d3';
  let dmg = rollDmg(dmgStr);
  const strBonus = Math.floor((attacker.str - 10) / 3);
  const skill = attacker.skills ? (attacker.skills.fighting || 0) : 0;
  const weapSkill = weapon && attacker.skills ? (attacker.skills[weapon.skill] || 0) : 0;
  const skillBonus = Math.floor((skill + weapSkill) / 4);
  dmg = Math.max(0, dmg + strBonus + skillBonus);
  return dmg;
}

export function applyAC(damage, ac) {
  if (ac <= 0) return damage;
  const reduction = rng.int(0, ac);
  return Math.max(0, damage - Math.floor(reduction * 0.5));
}

// Full melee attack resolution
// Returns { hit, damage, verb, effects[] }
export function resolveMelee(attacker, defender, weapon = null) {
  const toHit = meleeToHit(attacker, weapon);
  const ev    = evasionCheck(defender);

  if (toHit < ev) {
    return { hit: false, damage: 0, verb: 'erra', effects: [] };
  }

  let dmg = rollMeleeDamage(attacker, weapon);
  dmg = applyAC(dmg, defender.ac || 0);

  const effects = [];

  // Check weapon/attack effects
  const attack = weapon || null;
  if (attack?.effects) {
    for (const eff of attack.effects) {
      effects.push(eff);
    }
  }

  // Monster attack effects
  if (attacker.monsterDef?.attacks) {
    for (const atk of attacker.monsterDef.attacks) {
      if (atk.effect) effects.push({ type: atk.effect, power: atk.power || 1 });
    }
  }

  const verb = weapon ? `golpeia com ${weapon.name}` : 'ataca';
  return { hit: true, damage: Math.max(dmg, 1), verb, effects };
}

// Ranged (bow) attack
export function resolveRanged(attacker, defender, weapon) {
  // Ranged to-hit is slightly lower
  const bowSkill = attacker.skills ? (attacker.skills.bows || 0) * 3 : 0;
  const dexBonus = Math.floor((attacker.dex - 10) / 2) * 2;
  const toHit = 5 + bowSkill + dexBonus + rng.int(0, 8);
  const ev = evasionCheck(defender);

  if (toHit < ev) return { hit: false, damage: 0, verb: 'erra (flecha)' };

  let dmg = rollDmg(weapon.dmg) + rng.int(0, 2); // arrow bonus
  const skillBonus = Math.floor((attacker.skills?.bows || 0) / 5);
  dmg = applyAC(dmg + skillBonus, defender.ac || 0);

  return { hit: true, damage: Math.max(dmg, 1), verb: 'acerta com flecha' };
}

// Spell damage
export function resolveSpell(caster, target, spell) {
  const intBonus = Math.floor((caster.int - 10) / 2);
  const skillBonus = Math.floor((caster.skills?.spellcasting || 0) / 3);

  let dmg = 0;
  if (spell.damage && spell.damage !== '0') {
    dmg = rollDmg(spell.damage) + intBonus + skillBonus;
  }

  // Magic dart never misses
  if (spell.effect === 'ranged_auto_hit') {
    return { hit: true, damage: Math.max(dmg, 1), verb: 'acerta com dardo mágico', effects: [] };
  }

  // Other spells can miss (spell power check)
  const spellPower = 50 + intBonus * 5 + skillBonus * 10;
  const evasion = (target.ev || 10) * 2;
  if (rng.int(0, 100) > spellPower - evasion + 50) {
    return { hit: false, damage: 0, verb: 'resiste ao feitiço' };
  }

  return { hit: true, damage: Math.max(dmg, 1), verb: `é atingido por ${spell.name}`, effects: [] };
}

// Status effect application
export function applyStatusEffect(entity, effectType, power) {
  switch (effectType) {
    case 'poison':
      entity.poison = Math.max(entity.poison || 0, power * 3 + rng.int(1, 4));
      break;
    case 'confuse':
      entity.confused = Math.max(entity.confused || 0, power * 5 + rng.int(2, 6));
      break;
    case 'haste':
      entity.hasted = Math.max(entity.hasted || 0, power * 10 + rng.int(5, 15));
      break;
    case 'might':
      entity.mighted = Math.max(entity.mighted || 0, power * 10 + rng.int(5, 15));
      break;
    case 'slow':
      entity.slowed = Math.max(entity.slowed || 0, power * 10 + rng.int(5, 15));
      break;
    case 'acid':
      // Acid reduces AC temporarily
      entity.acidLevel = Math.max(entity.acidLevel || 0, power);
      break;
  }
}

// XP gain and level up
export const XP_TABLE = [
  0, 10, 35, 80, 150, 250, 400, 600, 900, 1300, 1800,
  2600, 3600, 5000, 6800, 9000, 12000, 16000, 21000, 27000, 35000
];

export function getXPForLevel(level) {
  return XP_TABLE[Math.min(level, XP_TABLE.length - 1)] || level * 2000;
}

export function checkLevelUp(player) {
  const target = getXPForLevel(player.level);
  if (player.xp >= target && player.level < 20) {
    player.level++;
    const hpGain = player.raceData.hpPerLevel + Math.floor((player.str - 10) / 3);
    player.maxHp += hpGain;
    player.hp = Math.min(player.hp + hpGain, player.maxHp);
    const mpGain = player.jobData.spells.length > 0 ? 2 : 0;
    player.maxMp += mpGain;
    player.mp = Math.min(player.mp + mpGain, player.maxMp);
    // Skill point gain
    player.skillPoints = (player.skillPoints || 0) + 10 + player.level;
    return true;
  }
  return false;
}

// Pathfinding: A* for monster movement
export function aStarPath(startX, startY, goalX, goalY, isPassableFn, maxDist = 20) {
  const key = (x, y) => `${x},${y}`;
  const h = (x, y) => Math.abs(x - goalX) + Math.abs(y - goalY);

  const open = [{ x: startX, y: startY, g: 0, f: h(startX, startY) }];
  const cameFrom = new Map();
  const gScore = new Map([[key(startX, startY), 0]]);

  while (open.length > 0) {
    // Get lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++)
      if (open[i].f < open[bestIdx].f) bestIdx = i;

    const curr = open[bestIdx];
    open.splice(bestIdx, 1);

    if (curr.x === goalX && curr.y === goalY) {
      // Reconstruct path
      const path = [];
      let c = key(goalX, goalY);
      while (cameFrom.has(c)) {
        const [px, py] = c.split(',').map(Number);
        path.unshift({ x: px, y: py });
        c = cameFrom.get(c);
      }
      return path.length > 0 ? path[0] : null; // Return next step only
    }

    if (curr.g > maxDist) continue;

    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx, ny = curr.y + dy;
      const nk = key(nx, ny);
      if (!isPassableFn(nx, ny)) continue;

      const ng = curr.g + (dx !== 0 && dy !== 0 ? 1.4 : 1);
      if (ng < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, key(curr.x, curr.y));
        gScore.set(nk, ng);
        open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny) });
      }
    }
  }
  return null; // No path found
}
