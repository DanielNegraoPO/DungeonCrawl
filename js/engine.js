// =============================================
// GAME ENGINE — Main game loop + state
// FIXES: Fog of war, P2 turns, key mapping, messages
// =============================================
import { DungeonGenerator } from './dungeon.js';
import { Player } from './player.js';
import { Monster, spawnMonsters, resetSigmund } from './monster.js';
import { TurnManager } from './turnmanager.js';
import { Renderer, TILE_SIZE } from './renderer.js';
import { UIManager } from './ui.js';
import { computeLOS } from './los.js';
import { resolveMelee, resolveSpell, applyStatusEffect } from './combat.js';
import { placeItems, initItemSystem, identifyItem } from './items.js';
import { FEATURES } from './data.js';
import { rng } from './rng.js';

// =============================================
// DCSS-faithful key bindings (split by player)
// P1: WASD + QEZC diagonals + T=wait + G=pickup + I=inventory + Z=spell
// P2: Numpad 1-9 + arrow keys + 5=wait + 0=pickup + /=inventory + Enter=spell
// =============================================
const P1_MOVE_KEYS = {
  // Cardinal
  'KeyW': [0,-1], 'KeyS': [0,1], 'KeyA': [-1,0], 'KeyD': [1,0],
  // Diagonal
  'KeyQ': [-1,-1], 'KeyE': [1,-1], 'KeyZ': [-1,1], 'KeyC': [1,1],
  // VI keys (DCSS standard)
  'KeyH': [-1,0], 'KeyJ': [0,1], 'KeyK': [0,-1], 'KeyL': [1,0],
  'KeyY': [-1,-1], 'KeyU': [1,-1], 'KeyB': [-1,1], 'KeyN': [1,1],
  // Wait
  'KeyT': [0,0], 'Period': [0,0],
};
const P1_ACTION_KEYS = ['KeyG','KeyI','KeyZ','KeyV'];

const P2_MOVE_KEYS = {
  // Arrow keys
  'ArrowUp': [0,-1], 'ArrowDown': [0,1], 'ArrowLeft': [-1,0], 'ArrowRight': [1,0],
  // Numpad
  'Numpad8': [0,-1], 'Numpad2': [0,1], 'Numpad4': [-1,0], 'Numpad6': [1,0],
  'Numpad7': [-1,-1], 'Numpad9': [1,-1], 'Numpad1': [-1,1], 'Numpad3': [1,1],
  // Diagonals via Home/End/etc (some keyboards)
  'Home': [-1,-1], 'End': [-1,1], 'PageUp': [1,-1], 'PageDown': [1,1],
  // Wait
  'Numpad5': [0,0], 'Clear': [0,0],
};
const P2_ACTION_KEYS = ['Numpad0', 'NumpadDecimal', 'NumpadDivide', 'NumpadEnter', 'Slash'];

export class GameEngine {
  constructor() {
    this.players  = [];
    this.monsters = [];
    this.items    = [];
    this.dungeon  = null;   // DungeonGenerator (has isPassable/isOpaque)
    this.dungeonData = null; // Raw dungeon data (map, seen, etc)
    this.turnMgr  = null;
    this.renderer = null;
    this.ui       = null;

    this.losP1    = new Set();
    this.losP2    = new Set();

    this.running  = false;
    this.animId   = null;
    this.waitingForInput = false;
    this._lastAction = 'move';

    this.canvas = document.getElementById('game-canvas');
    this._boundKeyDown = this._onKeyDown.bind(this);
  }

  init(p1Config, p2Config) {
    window.engine = this;
    window.removeEventListener('keydown', this._boundKeyDown);

    // Generate dungeon
    const gen = new DungeonGenerator();
    const dungeon = gen.generate();
    dungeon.seen = {}; // fog of war memory: seen[y][x] = true
    this.dungeon = gen;
    this.dungeonData = dungeon;

    // Player starts
    const startP1 = dungeon.features.find(f => f.type === 'start_p1') || { x: 5, y: 5 };
    const startP2 = dungeon.features.find(f => f.type === 'start_p2') ||
                    { x: Math.min(startP1.x + 3, dungeon.width - 5), y: startP1.y };

    // Create players
    const p1 = new Player({ ...p1Config, playerIndex: 0 });
    p1.x = startP1.x; p1.y = startP1.y;
    p1.nextTurn = 0;

    const p2 = new Player({ ...p2Config, playerIndex: 1 });
    p2.x = startP2.x; p2.y = startP2.y;
    p2.nextTurn = 1; // small offset to prevent exact ties

    this.players = [p1, p2];

    // Spawn monsters
    resetSigmund();
    initItemSystem();
    this.monsters = spawnMonsters(gen, 28);

    // Keep monsters away from player starts
    this.monsters = this.monsters.filter(m =>
      !(Math.abs(m.x - p1.x) < 4 && Math.abs(m.y - p1.y) < 4) &&
      !(Math.abs(m.x - p2.x) < 4 && Math.abs(m.y - p2.y) < 4)
    );

    // Place items
    this.items = placeItems(gen, 35);

    // Turn manager
    this.turnMgr = new TurnManager([...this.players, ...this.monsters]);

    // Renderer
    if (!this.renderer) this.renderer = new Renderer(this.canvas);
    this.renderer.resize();

    // UI
    if (!this.ui) this.ui = new UIManager();

    // Compute initial LOS + mark seen
    this._updateLOS();

    // Start
    this.running = true;
    this.waitingForInput = true;
    window.addEventListener('keydown', this._boundKeyDown);

    this._gameLoop();

    // Welcome
    this.ui.addMessage('A aventura começa!', 'system');
    this.ui.addMessage(`${p1.name} entra pelo lado oeste.`, 'info', 0);
    this.ui.addMessage(`${p2.name} entra pelo lado leste.`, 'info', 1);
    this.ui.addMessage('Mova-se em direção a inimigos para atacar. Encontre o Santuário (dourado) para reviver aliados.', 'system');
    this.ui.addMessage('P1: WASD/QEZC ou vi-keys (hjklyubn). P2: Setas/Numpad.', 'system');

    // Kick first HUD update and center camera
    this._renderHUDs();
    this.renderer.centerOn(p1.x, p1.y);
    this.renderer.camX = this.renderer.targetCamX;
    this.renderer.camY = this.renderer.targetCamY;
    this.ui.setActivePlayer(0);
  }

  stop() {
    this.running = false;
    window.removeEventListener('keydown', this._boundKeyDown);
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  // =============================================
  // GAME LOOP
  // =============================================
  _gameLoop() {
    if (!this.running) return;
    this.animId = requestAnimationFrame(() => this._gameLoop());

    // Process all pending non-player turns
    this._processNonPlayerTurns();

    // Render every frame
    this._render();
    this._renderHUDs();
    this._renderTurnQueue();
    this._checkGameOver();
  }

  _processNonPlayerTurns() {
    // Process monster turns until it's a player's turn
    let safety = 0;
    while (safety++ < 300) {
      // Remove dead actors first
      this.turnMgr.cleanDead();

      const entry = this.turnMgr.peekNext();
      if (!entry) break;

      const actor = entry.actor;

      if (actor.isPlayer) {
        // Dead player: skip their turn (advance time, they'll be revived later)
        if (actor.isDead) {
          this.turnMgr.advance();
          this.turnMgr.actorDone(actor, 10);
          continue;
        }
        // Living player: wait for keyboard input
        this.waitingForInput = true;
        this.ui.setActivePlayer(actor.playerIndex);
        this.renderer.centerOn(actor.x, actor.y);
        break;
      } else {
        // Monster turn
        if (actor.isDead) {
          // Remove dead monster from queue entirely
          this.turnMgr.removeActor(actor);
          continue;
        }
        this.turnMgr.advance();
        this._processMonsterTurn(actor);
        this.turnMgr.actorDone(actor, actor.getActionCost());
      }
    }
  }

  _processMonsterTurn(mon) {
    const decision = mon.think(this.dungeon, this.players, this.monsters);
    switch (decision.action) {
      case 'move': {
        const nx = mon.x + decision.dx;
        const ny = mon.y + decision.dy;
        if (this._canMoveTo(nx, ny)) {
          mon.x = nx; mon.y = ny;
        }
        break;
      }
      case 'attack': {
        const result = mon.performAttack(decision.target);
        this._resolveHit(mon, decision.target, result);
        break;
      }
      case 'spell': {
        const result = mon.performSpell(decision.target);
        if (result) this._resolveHit(mon, decision.target, result, true);
        break;
      }
    }
  }

  // =============================================
  // COMBAT RESOLUTION
  // =============================================
  _resolveHit(attacker, defender, result, isSpell = false) {
    const atkName = attacker.name || '?';
    const defName = defender.name || '?';

    if (!result.hit) {
      // Show misses occasionally (not every time to avoid spam)
      if (rng.bool(0.4)) {
        const pIdx = defender.isPlayer ? defender.playerIndex : (attacker.isPlayer ? attacker.playerIndex : -1);
        this.ui.addMessage(`${atkName} ${result.verb || 'erra'} ${defName}.`, 'normal', pIdx);
      }
      return;
    }

    const dmg = result.damage || 0;
    const died = defender.takeDamage ? defender.takeDamage(dmg) : false;

    // Visual flash
    this.renderer.addFlash(defender.x, defender.y,
      defender.isPlayer ? '#ff3333' : '#ff8844', 6);

    // Damage number popup
    const camX = Math.round(this.renderer.camX);
    const camY = Math.round(this.renderer.camY);
    const sx = (defender.x - camX) * TILE_SIZE;
    const sy = (defender.y - camY) * TILE_SIZE;
    this.renderer.showDamageNumber(sx, sy, dmg, defender.isPlayer ? '#ff4444' : '#ff9900');

    // ---- COMBAT MESSAGE (detailed like DCSS) ----
    const verb = result.verb || 'ataca';
    const pIdx = defender.isPlayer
      ? defender.playerIndex
      : (attacker.isPlayer ? attacker.playerIndex : -1);

    if (dmg > 0) {
      const msgType = defender.isPlayer ? 'hit' : 'good';
      const hpInfo = defender.isPlayer
        ? ` [${defender.hp}/${defender.maxHp} HP]`
        : '';
      this.ui.addMessage(
        `${atkName} ${verb} ${defName} por ${dmg} de dano.${hpInfo}`,
        msgType, pIdx
      );
    } else {
      this.ui.addMessage(`${atkName} ${verb} ${defName} — bloqueado pela armadura!`, 'normal', pIdx);
    }

    // Status effects
    if (result.effects) {
      for (const eff of result.effects) {
        applyStatusEffect(defender, eff.type, eff.power);
        if (eff.type === 'poison') {
          this.ui.addMessage(`${defName} está envenenado!`, 'warn', pIdx);
        } else if (eff.type === 'acid') {
          this.ui.addMessage(`${defName} é corroído por ácido!`, 'warn', pIdx);
        }
      }
    }

    // Kill / Death handling
    if (died) {
      if (attacker.isPlayer) {
        // Player kills monster
        const xp = defender.xpValue || 0;
        const gold = defender.goldValue || 0;
        const leveled = attacker.gainXP(xp);
        if (gold > 0) {
          attacker.gold += gold;
          this.ui.addMessage(
            `Você pega ${gold} moeda${gold !== 1 ? 's' : ''} de ${defName}.`,
            'info', attacker.playerIndex
          );
        }
        this.ui.addMessage(
          `${defName} morre! (+${xp} XP)`,
          'kill', attacker.playerIndex
        );
        if (leveled) {
          this.ui.addMessage(
            `NÍVEL ${attacker.level}! ${attacker.name} sobe de nível! (${attacker.hp}/${attacker.maxHp} HP)`,
            'good', attacker.playerIndex
          );
          this.renderer.addFlash(attacker.x, attacker.y, '#ffffff', 15);
        }
        this.turnMgr.removeActor(defender);
      } else {
        // Monster kills player
        const pIdx2 = defender.playerIndex;
        this.ui.addMessage(
          `${defender.name} foi derrotado por ${atkName}! (0/${defender.maxHp} HP)`,
          'warn', pIdx2
        );
        this.ui.addMessage(
          `${defender.name} se torna um espectador. O aliado pode revivê-lo em um Santuário.`,
          'system'
        );
        this.ui.showDeathOverlay(pIdx2, true);
        this.turnMgr.removeActor(defender);
      }
    }
  }

  // =============================================
  // INPUT HANDLING
  // =============================================
  _onKeyDown(e) {
    if (!this.running) return;

    // Escape/modal check
    const inventoryModal = document.getElementById('inventory-modal');
    const spellModal = document.getElementById('spell-modal');

    if (inventoryModal && !inventoryModal.classList.contains('hidden')) {
      // Escape or KeyI (for P1) or NumpadDivide / Slash (for P2) closes inventory
      const isCloseKey = e.code === 'Escape' || 
                         (e.code === 'KeyI') || 
                         (e.code === 'Slash' || e.code === 'NumpadDivide');
      if (isCloseKey) {
        e.preventDefault();
        this.ui.closeInventory();
        return;
      }
      
      // If a single letter key is pressed, check if it selects an item in the active player's inventory
      if (this.ui.inventoryOpen && this.ui.activeInventoryPlayer && this.waitingForInput) {
        const player = this.ui.activeInventoryPlayer;
        const key = e.key; // e.g. 'a', 'b', 'A'
        const item = player.inventory.find(i => i.invKey === key);
        if (item) {
          e.preventDefault();
          const callback = this.ui.activeInventoryCallback;
          this.ui.closeInventory();
          if (callback) {
            callback(item.invKey);
          }
        }
      }
      return;
    }

    if (spellModal && !spellModal.classList.contains('hidden')) return;

    // --- FREE ACTION PICKUP: Intercept pickup keys at any time (even when not their turn to walk!) ---
    // P1: G or KeyG
    if (e.code === 'KeyG' || e.key.toLowerCase() === 'g') {
      const p1 = this.players[0];
      if (p1 && !p1.isDead) {
        const ok = this._playerPickup(p1);
        if (ok) {
          e.preventDefault();
          this._renderHUDs();
          return;
        }
      }
    }
    // P2: 0 or Numpad0 or Digit0
    if (e.code === 'Numpad0' || e.code === 'Digit0' || e.key === '0') {
      const p2 = this.players[1];
      if (p2 && !p2.isDead) {
        const ok = this._playerPickup(p2);
        if (ok) {
          e.preventDefault();
          this._renderHUDs();
          return;
        }
      }
    }

    if (!this.waitingForInput) return;

    // Get active player
    const active = this.turnMgr.getActivePlayer();
    if (!active) return;

    const p = active;
    const pIdx = p.playerIndex;

    // --- Determine which key set to use ---
    // P1 uses P1_MOVE_KEYS, P2 uses P2_MOVE_KEYS
    // BUT: allow any movement if the player is active
    let dir = null;
    let isP1Key = false;
    let isP2Key = false;

    if (pIdx === 0) {
      dir = P1_MOVE_KEYS[e.code];
      isP1Key = (dir !== undefined) || P1_ACTION_KEYS.includes(e.code) || ['g', 'i', 'z', 'v'].includes(e.key.toLowerCase());
    } else {
      dir = P2_MOVE_KEYS[e.code];
      isP2Key = (dir !== undefined) || P2_ACTION_KEYS.includes(e.code) || ['0', '/', '-', 'enter'].includes(e.key.toLowerCase());
    }

    // Also allow the other player's movement keys to work for fallback
    // (helpful if user plays solo or keys are confused)
    if (dir === null) {
      if (pIdx === 0) dir = P2_MOVE_KEYS[e.code]; // fallback P2 keys for P1
      else dir = P1_MOVE_KEYS[e.code];              // fallback P1 keys for P2
    }

    let handled = false;

    // Movement / attack
    if (dir !== null) {
      e.preventDefault();
      const [dx, dy] = dir;
      if (dx === 0 && dy === 0) {
        this._playerWait(p);
        handled = true;
      } else {
        handled = this._playerMoveOrAttack(p, dx, dy);
        if (!handled) {
          // Bump into wall - no turn consumed
          this.ui.addMessage('Bloqueado.', 'normal', pIdx);
        }
      }
    }

    // --- Action keys (P1) ---
    if (pIdx === 0) {
      // I = inventory
      if (e.code === 'KeyI' || e.key.toLowerCase() === 'i') {
        e.preventDefault();
        this.ui.openInventory(p, (key) => this._playerUseItem(p, key));
        return; // no turn consumed
      }
      // Z = cast spell
      else if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (p.knownSpells && p.knownSpells.length > 0) {
          this.ui.openSpellMenu(p, (spell) => this._playerCastSpell(p, spell));
        } else {
          this.ui.addMessage('Você não conhece nenhum feitiço.', 'warn', pIdx);
        }
        return;
      }
      // V = drop item
      else if (e.code === 'KeyV' || e.key.toLowerCase() === 'v') {
        e.preventDefault();
        this.ui.openInventory(p, (key) => this._playerDropItem(p, key), 'Soltar');
        return;
      }
    }

    // --- Action keys (P2) ---
    if (pIdx === 1) {
      // NumpadDivide or Slash or / = inventory
      if (e.code === 'NumpadDivide' || e.code === 'Slash' || e.key === '/') {
        e.preventDefault();
        this.ui.openInventory(p, (key) => this._playerUseItem(p, key));
        return;
      }
      // NumpadEnter or Enter = cast spell
      else if (e.code === 'NumpadEnter' || e.key === 'Enter') {
        e.preventDefault();
        if (p.knownSpells && p.knownSpells.length > 0) {
          this.ui.openSpellMenu(p, (spell) => this._playerCastSpell(p, spell));
        } else {
          this.ui.addMessage('Você não conhece nenhum feitiço.', 'warn', pIdx);
        }
        return;
      }
      // NumpadSubtract or - = drop item
      else if (e.code === 'NumpadSubtract' || e.key === '-') {
        e.preventDefault();
        this.ui.openInventory(p, (key) => this._playerDropItem(p, key), 'Soltar');
        return;
      }
    }

    if (handled) {
      // Consume turn
      const cost = p.getActionCost(this._lastAction || 'move');
      this.turnMgr.advance();
      this.turnMgr.actorDone(p, cost);
      this.waitingForInput = false;

      // Tick player status effects
      p.tick();
      this._updateLOS();
    }
  }


  _playerMoveOrAttack(player, dx, dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;

    // Check for monster
    const mon = this.monsters.find(m => !m.isDead && m.x === nx && m.y === ny);
    if (mon) {
      this._lastAction = 'attack';
      const result = resolveMelee(player, mon, player.weapon);
      this._resolveHit(player, mon, result);
      return true;
    }

    // Check for other player
    const otherP = this.players.find(p => p !== player && p.x === nx && p.y === ny);
    if (otherP) {
      this.ui.addMessage('Seu aliado está no caminho!', 'info', player.playerIndex);
      return false;
    }

    // Check for door
    if (this.dungeonData.map[ny] && this.dungeonData.map[ny][nx] === FEATURES.DOOR) {
      this.dungeonData.map[ny][nx] = FEATURES.DOOR_OPEN;
      this.ui.addMessage('Você abre a porta.', 'info', player.playerIndex);
      this._lastAction = 'move';
      return true;
    }

    // Move
    if (this._canMoveTo(nx, ny)) {
      player.x = nx; player.y = ny;
      this._lastAction = 'move';
      this._checkShrine(player, nx, ny);
      // Check for item on ground
      this._checkItemOnGround(player);
      return true;
    }

    return false;
  }

  _checkItemOnGround(player) {
    const item = this.items.find(i => i.x === player.x && i.y === player.y);
    if (item) {
      const pIdx = player.playerIndex;
      const keyHint = pIdx === 0 ? '(G para pegar)' : '(Num0 para pegar)';
      this.ui.addMessage(`${player.name} vê ${item.name} aqui. ${keyHint}`, 'info', pIdx);
    }
  }

  _playerWait(player) {
    this._lastAction = 'wait';
    this.ui.addMessage(`${player.name} descansa por um momento.`, 'info', player.playerIndex);
  }

  _playerPickup(player) {
    const itemIdx = this.items.findIndex(i => i.x === player.x && i.y === player.y);
    if (itemIdx === -1) {
      this.ui.addMessage('Não há nada aqui para pegar.', 'info', player.playerIndex);
      return false;
    }
    const item = this.items[itemIdx];
    if (item.type === 'gold') {
      player.gold += item.amount;
      this.ui.addMessage(
        `${player.name} pega ${item.amount} moeda${item.amount !== 1 ? 's' : ''} de ouro. (Total: ${player.gold})`,
        'good', player.playerIndex
      );
      this.items.splice(itemIdx, 1);
    } else {
      const addedItem = player.addToInventory({ ...item });
      if (addedItem) {
        this.ui.addMessage(
          `${player.name} pega ${item.name} (${addedItem.invKey}).`,
          'info', player.playerIndex
        );
        this.items.splice(itemIdx, 1);
      } else {
        this.ui.addMessage('Inventário cheio!', 'warn', player.playerIndex);
        return false;
      }
    }
    this._lastAction = 'item';
    return true;
  }

  _playerUseItem(player, key) {
    const result = player.useItem(key);
    if (result) {
      if (result.msg) this.ui.addMessage(result.msg, result.type || 'info', player.playerIndex);
      
      // Handle scroll / potion effects
      if (result.effect === 'teleport') {
        this._teleportPlayer(player);
      } else if (result.effect === 'enchant_weapon') {
        if (player.weapon) {
          player.weapon.enchant = (player.weapon.enchant || 0) + 1;
          const baseName = player.weapon.name.split(' +')[0].split(' (amaldi')[0];
          player.weapon.name = `${baseName} +${player.weapon.enchant}`;
          this.ui.addMessage(`Sua ${baseName} brilha intensamente! (+${player.weapon.enchant} de encantamento)`, 'good', player.playerIndex);
          this.renderer.addFlash(player.x, player.y, '#ffffff', 15);
          player.recalcStats();
        } else {
          this.ui.addMessage('Você sente magia em suas mãos, mas não tem nenhuma arma equipada para encantar.', 'info', player.playerIndex);
        }
      } else if (result.effect === 'fog') {
        this.ui.addMessage('Uma névoa espessa se espalha ao seu redor, obstruindo a visão!', 'system', player.playerIndex);
        // Visual fog flash effect
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) + Math.abs(dy) <= 3) {
              this.renderer.addFlash(player.x + dx, player.y + dy, '#e0e0e0', 8 + rng.int(0, 8));
            }
          }
        }
      } else if (result.effect === 'identify') {
        this.ui.addMessage('Selecione um item no inventário para identificar.', 'info', player.playerIndex);
        setTimeout(() => {
          this.ui.openInventory(player, (targetKey) => this._playerIdentifyItem(player, targetKey), 'Identificar');
        }, 100);
      }

      const cost = player.getActionCost('item');
      this.turnMgr.advance();
      this.turnMgr.actorDone(player, cost);
      this.waitingForInput = false;
      this._updateLOS();
    }
  }

  _playerIdentifyItem(player, targetKey) {
    const item = player.inventory.find(i => i.invKey === targetKey);
    if (item) {
      const oldUnidName = item.name;
      identifyItem(item);
      this.ui.addMessage(`Você identificou ${oldUnidName} como ${item.trueName || item.name}!`, 'good', player.playerIndex);
      player.recalcStats();
    }
  }

  _playerDropItem(player, key) {
    const item = player.dropItem(key);
    if (item) {
      // Place it on the ground
      item.x = player.x;
      item.y = player.y;
      this.items.push(item);

      const countStr = item.count > 1 ? `${item.count}x ` : '';
      this.ui.addMessage(`${player.name} soltou ${countStr}${item.name}.`, 'info', player.playerIndex);
      
      const cost = player.getActionCost('item');
      this.turnMgr.advance();
      this.turnMgr.actorDone(player, cost);
      this.waitingForInput = false;
      this._updateLOS();
    }
  }

  _playerCastSpell(player, spell) {
    if (player.mp < spell.mpCost) {
      this.ui.addMessage('Pontos de magia insuficientes!', 'warn', player.playerIndex);
      return;
    }

    const visSet = player.playerIndex === 0 ? this.losP1 : this.losP2;
    const visEnemies = this.monsters.filter(m =>
      !m.isDead && visSet.has(`${m.x},${m.y}`)
    );

    if (spell.effect === 'blink') {
      this._teleportPlayer(player, 6);
      player.mp -= spell.mpCost;
      this.ui.addMessage(`${player.name} pisca aleatoriamente!`, 'good', player.playerIndex);
    } else if (visEnemies.length === 0) {
      this.ui.addMessage('Nenhum inimigo visível para atacar!', 'warn', player.playerIndex);
      return;
    } else {
      let target = visEnemies.reduce((best, m) => {
        const d = Math.abs(m.x - player.x) + Math.abs(m.y - player.y);
        const bd = Math.abs(best.x - player.x) + Math.abs(best.y - player.y);
        return d < bd ? m : best;
      }, visEnemies[0]);

      const result = resolveSpell(player, target, spell);
      player.mp -= spell.mpCost;
      this.ui.addMessage(
        `${player.name} lança ${spell.name}!`,
        'info', player.playerIndex
      );
      if (result.hit) {
        this._resolveHit(player, target, result, true);
        const color = spell.school === 'Fogo' ? '#ff6622' : '#8888ff';
        this.renderer.addFlash(target.x, target.y, color, 10);
      } else {
        this.ui.addMessage(`${target.name} resiste ao feitiço.`, 'normal', player.playerIndex);
      }
    }

    const cost = player.getActionCost('spell');
    this.turnMgr.advance();
    this.turnMgr.actorDone(player, cost);
    this.waitingForInput = false;
    this._updateLOS();
  }

  _checkShrine(player, x, y) {
    if (this.dungeonData.map[y][x] !== FEATURES.SHRINE) return;
    const deadPlayer = this.players.find(p => p.isDead && p !== player);
    if (deadPlayer) {
      deadPlayer.isDead = false;
      deadPlayer.isGhost = false;
      deadPlayer.hp = Math.max(1, Math.floor(deadPlayer.maxHp * 0.5));
      // Find adjacent floor cell for revived player
      const adj = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
      for (const [adx, ady] of adj) {
        const nx = player.x + adx, ny = player.y + ady;
        if (this.dungeon.isPassable(nx, ny) &&
            !this.monsters.some(m => !m.isDead && m.x === nx && m.y === ny) &&
            !this.players.some(p => p !== deadPlayer && p.x === nx && p.y === ny)) {
          deadPlayer.x = nx; deadPlayer.y = ny;
          break;
        }
      }
      deadPlayer.nextTurn = this.turnMgr.globalTime + 10;
      this.turnMgr.addActor(deadPlayer);
      this.ui.showDeathOverlay(deadPlayer.playerIndex, false);
      this.ui.addMessage(`${deadPlayer.name} é revivido no Santuário! (${deadPlayer.hp}/${deadPlayer.maxHp} HP)`, 'good');
      this.renderer.addFlash(deadPlayer.x, deadPlayer.y, '#ffffff', 20);
      this.renderer.addFlash(x, y, '#c9a84c', 25);
    } else {
      this.ui.addMessage('Um Santuário sagrado. Aliados mortos podem ser revividos aqui.', 'system');
      this.renderer.addFlash(x, y, '#c9a84c', 12);
    }
  }

  _teleportPlayer(player, maxDist = 20) {
    const floors = this.dungeon.getFloorCells();
    const valid = floors.filter(c => {
      const d = Math.abs(c.x - player.x) + Math.abs(c.y - player.y);
      return d > 3 && d <= maxDist &&
             !this.monsters.some(m => !m.isDead && m.x === c.x && m.y === c.y) &&
             !this.players.some(p => p !== player && p.x === c.x && p.y === c.y) &&
             this.dungeon.isPassable(c.x, c.y);
    });
    if (valid.length > 0) {
      const dest = rng.choice(valid);
      this.ui.addMessage(`${player.name} teleporta para (${dest.x},${dest.y})!`, 'good', player.playerIndex);
      player.x = dest.x; player.y = dest.y;
    }
  }

  _canMoveTo(x, y) {
    if (!this.dungeon.isPassable(x, y)) return false;
    if (this.monsters.some(m => !m.isDead && m.x === x && m.y === y)) return false;
    return true;
  }

  // =============================================
  // LOS + FOG OF WAR
  // =============================================
  _updateLOS() {
    const p1 = this.players[0], p2 = this.players[1];

    // Compute LOS for each living player
    this.losP1 = (!p1 || p1.isDead) ? new Set() : computeLOS(p1.x, p1.y, this.dungeon);
    this.losP2 = (!p2 || p2.isDead) ? new Set() : computeLOS(p2.x, p2.y, this.dungeon);

    // === FIX: Mark seen cells immediately when LOS is computed ===
    // This ensures cells are visible on the SAME frame they enter LOS
    const seen = this.dungeonData.seen;
    for (const key of this.losP1) {
      const comma = key.indexOf(',');
      const x = parseInt(key.substring(0, comma));
      const y = parseInt(key.substring(comma + 1));
      if (!seen[y]) seen[y] = {};
      seen[y][x] = true;
    }
    for (const key of this.losP2) {
      const comma = key.indexOf(',');
      const x = parseInt(key.substring(0, comma));
      const y = parseInt(key.substring(comma + 1));
      if (!seen[y]) seen[y] = {};
      seen[y][x] = true;
    }
  }

  // =============================================
  // RENDER HELPERS
  // =============================================
  _render() {
    if (!this.renderer) return;
    this.renderer.render(
      {
        map:    this.dungeonData.map,
        width:  this.dungeonData.width,
        height: this.dungeonData.height,
        seen:   this.dungeonData.seen
      },
      this.players,
      this.monsters,
      this.items,
      this.losP1,
      this.losP2
    );
  }

  _renderHUDs() {
    if (!this.ui) return;
    for (const p of this.players) {
      this.ui.updatePlayerHUD(p, p.playerIndex);
      this.ui.updateHUDSprite(p, p.playerIndex);
    }
  }

  _renderTurnQueue() {
    if (!this.ui || !this.turnMgr) return;
    this.ui.updateTurnQueue(this.turnMgr.getUpcoming(8));
  }

  _checkGameOver() {
    if (!this.running) return;
    const allDead = this.players.every(p => p.isDead);
    if (allDead) {
      this.running = false;
      setTimeout(() => {
        this.ui.showGameOver(
          'Derrota...',
          'Ambos os heróis foram derrotados nas profundezas da dungeon.<br><br>Que seus fantasmas assombrem os corredores para sempre.',
          () => window.location.reload(),
          () => window.showScreen('title')
        );
      }, 1500);
    }
  }
}
