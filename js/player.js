// =============================================
// PLAYER CLASS
// =============================================
import { RACES, JOBS, ARMOUR_TYPES, WEAPON_TYPES, SPELLS } from './data.js';
import { checkLevelUp, getXPForLevel } from './combat.js';
import { rng } from './rng.js';

export class Player {
  constructor(config) {
    const { name, raceId, jobId, playerIndex } = config;
    this.playerIndex = playerIndex; // 0 or 1
    this.name = name || (playerIndex === 0 ? 'Herói 1' : 'Herói 2');
    this.isPlayer = true;

    // Race + Job
    this.raceData = RACES[raceId] || RACES.human;
    this.jobData  = JOBS[jobId]   || JOBS.fighter;
    this.raceId   = raceId;
    this.jobId    = jobId;

    // Stats (race base)
    this.str = this.raceData.baseStats.str;
    this.int = this.raceData.baseStats.int;
    this.dex = this.raceData.baseStats.dex;

    // HP / MP
    this.maxHp = this.raceData.baseHP + Math.floor(this.str / 3);
    this.hp    = this.maxHp;
    this.maxMp = this.raceData.baseMP + (this.jobData.spells.length > 0 ? 4 : 0);
    this.mp    = this.maxMp;

    // Level / XP
    this.level = 1;
    this.xp = 0;
    this.gold = rng.int(0, 15);

    // Skills (from job starting skills)
    this.skills = {};
    for (const [sk, val] of Object.entries(this.jobData.startSkills || {})) {
      this.skills[sk] = val;
    }

    // AC / EV (recalculated)
    this.ac = 0;
    this.ev = 10 + Math.floor(this.dex / 3);

    // Equipment
    this.weapon = null;
    this.armour = null;
    this.shield = null;

    // Equip starting gear
    this._equipStartingGear();

    // Inventory (52 slots, a-Z)
    this.inventory = [];

    // Spells
    this.knownSpells = [];
    for (const sid of this.jobData.spells) {
      if (SPELLS[sid]) this.knownSpells.push({ ...SPELLS[sid] });
    }

    // Status effects (remaining turns)
    this.poison    = 0;
    this.confused  = 0;
    this.hasted    = 0;
    this.slowed    = 0;
    this.mighted   = 0;
    this.acidLevel = 0;
    this.branchDepth = 1;

    // Position (set by game)
    this.x = 0; this.y = 0;

    // Speed / AUT system
    this.baseSpeed = 10; // 10 AUT per turn (standard DCSS speed)
    this.nextTurn = 0;   // When this actor can act next (in AUT)

    // State
    this.isDead   = false;
    this.isGhost  = false; // spectator after death
    this.skillPoints = 0;

    // For rendering
    this.spriteImg = null;
    this.spriteLoaded = false;
    this._loadSprite();

    // Recalculate derived stats
    this.recalcStats();
  }

  _equipStartingGear() {
    const job = this.jobData;

    // Weapon
    if (job.startWeapon) {
      this.weapon = { ...job.startWeapon, enchant: 0, identified: true };
    }

    // Armour
    if (job.startArmour && ARMOUR_TYPES[job.startArmour]) {
      this.armour = { type: job.startArmour, ...ARMOUR_TYPES[job.startArmour], enchant: 0, identified: true };
    }

    // Starting ammo
    if (job.startMissiles) {
      this.inventory.push({
        type: 'arrows', name: 'Flechas', count: job.startMissiles,
        desc: `${job.startMissiles} flechas`
      });
    }
  }

  _loadSprite() {
    const img = new Image();
    img.onload  = () => { this.spriteImg = img; this.spriteLoaded = true; };
    img.onerror = () => { this.spriteLoaded = false; };
    const file = (this.playerIndex === 1 && this.raceData.spriteFileMale)
      ? this.raceData.spriteFileMale
      : this.raceData.spriteFile;
    img.src = file;
  }

  recalcStats() {
    // AC from armour + skill
    const armourAC  = this.armour ? this.armour.ac : 0;
    const armourSkill = this.skills?.armour || 0;
    const shieldAC  = this.shield ? 3 : 0;
    this.ac = armourAC + Math.floor(armourSkill / 3) + shieldAC;
    if (this.acidLevel > 0) this.ac = Math.max(0, this.ac - this.acidLevel * 2);

    // EV from dex + dodge skill
    const dodgeSkill = this.skills?.dodging || 0;
    this.ev = 10 + Math.floor(this.dex / 3) + Math.floor(dodgeSkill / 2);

    // Effective speed
    this.speed = this.baseSpeed;
    if (this.hasted > 0)  this.speed = Math.ceil(this.speed * 0.67);
    if (this.slowed > 0)  this.speed = Math.floor(this.speed * 1.5);
  }

  getActionCost(action = 'move') {
    // Returns AUT cost for the action
    switch (action) {
      case 'move':   return this.speed;
      case 'attack': return this.weapon ? (this.weapon.speed || 14) : 10;
      case 'spell':  return 10;
      case 'item':   return 10;
      case 'wait':   return this.speed;
      default:       return this.speed;
    }
  }

  takeDamage(amount, source = '') {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0 && !this.isDead) {
      this.isDead = true;
      this.isGhost = true;
      return true; // died
    }
    return false;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  restoreMp(amount) {
    this.mp = Math.min(this.maxMp, this.mp + amount);
  }

  gainXP(amount) {
    this.xp += amount;
    return checkLevelUp(this);
  }

  // Per-turn tick: decrement status effects, regen HP/MP
  tick() {
    // Poison damage
    if (this.poison > 0) {
      const dmg = Math.ceil(this.poison / 4);
      this.hp = Math.max(1, this.hp - dmg); // poison won't kill (DCSS behavior)
      this.poison = Math.max(0, this.poison - 1);
    }

    // Status countdowns
    if (this.confused > 0)  this.confused--;
    if (this.hasted  > 0)   this.hasted--;
    if (this.slowed  > 0)   this.slowed--;
    if (this.mighted > 0)   this.mighted--;
    if (this.acidLevel > 0) this.acidLevel = Math.max(0, this.acidLevel - 1);

    // Regen HP (slow, every ~10 turns for now)
    if (rng.int(0, 9) === 0 && this.hp < this.maxHp && !this.isDead) {
      this.hp++;
    }

    // Regen MP (even slower)
    if (rng.int(0, 19) === 0 && this.mp < this.maxMp) {
      this.mp++;
    }

    this.recalcStats();
  }

  getStatusEffects() {
    const fx = [];
    if (this.poison > 0)    fx.push({ name: `Veneno(${this.poison})`, type: 'bad' });
    if (this.confused > 0)  fx.push({ name: `Confuso(${this.confused})`, type: 'bad' });
    if (this.hasted > 0)    fx.push({ name: `Pressa(${this.hasted})`, type: 'good' });
    if (this.slowed > 0)    fx.push({ name: `Lento(${this.slowed})`, type: 'bad' });
    if (this.mighted > 0)   fx.push({ name: `Força+(${this.mighted})`, type: 'good' });
    if (this.acidLevel > 0) fx.push({ name: `Ácido(${this.acidLevel})`, type: 'bad' });
    return fx;
  }

  addToInventory(item) {
    const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // Stacking logic for stackable items
    if (item.type === 'potion' || item.type === 'scroll' || item.type === 'arrows') {
      const existing = this.inventory.find(i => 
        i.type === item.type && i.trueName === item.trueName && i.name === item.name
      );
      if (existing) {
        existing.count = (existing.count || 1) + (item.count || 1);
        return existing;
      }
    }

    if (this.inventory.length >= LETTERS.length) return false;
    
    item.count = item.count || 1;
    item.invKey = LETTERS[this.inventory.length];
    this.inventory.push(item);
    return item;
  }

  dropItem(invKey) {
    const idx = this.inventory.findIndex(i => i.invKey === invKey);
    if (idx === -1) return null;
    const item = this.inventory[idx];
    this.inventory.splice(idx, 1);
    this._reassignKeys();
    return item;
  }

  useItem(invKey) {
    const idx = this.inventory.findIndex(i => i.invKey === invKey);
    if (idx === -1) return null;
    const item = this.inventory[idx];
    let result = null;

    if (item.type === 'potion' || item.type === 'scroll') {
      if (item.type === 'potion') {
        result = this._usePotion(item);
      } else {
        result = { effect: item.effect, item };
      }
      
      if (item.count > 1) {
        item.count--;
      } else {
        this.inventory.splice(idx, 1);
        this._reassignKeys();
      }
    } else if (item.type === 'weapon' || item.type === 'armour') {
      result = this._equipItem(item, idx);
    }

    return result;
  }

  _usePotion(item) {
    switch (item.effect) {
      case 'heal':
        this.heal(item.power + rng.int(0, item.power));
        return { msg: `Você bebe ${item.name} e sente a cura.`, type: 'good' };
      case 'restore_mp':
        this.restoreMp(item.power + rng.int(0, 3));
        return { msg: `Você bebe ${item.name} e sente a magia fluir.`, type: 'good' };
      case 'might':
        this.mighted = (item.power || 3) * 10;
        this.str += 3;
        return { msg: `Você sente força sobrenatural!`, type: 'good' };
      case 'haste':
        this.hasted = (item.power || 5) * 10;
        return { msg: `Você se move em velocidade sobrenatural!`, type: 'good' };
      case 'poison':
        this.poison += item.power * 3;
        return { msg: `A poção queima sua garganta!`, type: 'bad' };
      default:
        return { msg: `Você bebe ${item.name}.`, type: 'info' };
    }
  }

  _equipItem(item, idx) {
    if (item.type === 'weapon') {
      const old = this.weapon;
      this.weapon = item;
      this.inventory.splice(idx, 1);
      if (old) this.inventory.push(old);
      this._reassignKeys();
      this.recalcStats();
      return { msg: `Você equipa ${item.name}.` };
    } else if (item.type === 'armour') {
      const old = this.armour;
      this.armour = item;
      this.inventory.splice(idx, 1);
      if (old) this.inventory.push(old);
      this._reassignKeys();
      this.recalcStats();
      return { msg: `Você veste ${item.name}.` };
    }
  }

  _reassignKeys() {
    const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.inventory.forEach((item, i) => { item.invKey = LETTERS[i]; });
  }

  getXPProgress() {
    const current = this.xp;
    const needed  = getXPForLevel(this.level);
    const prev    = getXPForLevel(this.level - 1);
    return Math.min(1, (current - prev) / Math.max(1, needed - prev));
  }

  toSummary() {
    return {
      name: this.name, race: this.raceData.name, job: this.jobData.name,
      level: this.level, hp: this.hp, maxHp: this.maxHp,
      mp: this.mp, maxMp: this.maxMp, str: this.str,
      int: this.int, dex: this.dex, ac: this.ac, ev: this.ev,
      gold: this.gold, isDead: this.isDead
    };
  }
}
