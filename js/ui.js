// =============================================
// UI MANAGER — HUD, Messages, Modals
// =============================================

const MAX_MESSAGES = 100;

export class UIManager {
  constructor() {
    this.messages = [];
    this.messageEl = document.getElementById('message-content');
    this.turnQueueEl = document.getElementById('turn-queue');
    this.inventoryOpen = false;
    this.activeInventoryPlayer = null;
    this.activeInventoryCallback = null;
  }

  // === MESSAGES ===
  addMessage(text, type = 'normal', playerIdx = -1) {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.messages.push({ text, type, playerIdx, timestamp });
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();
    this._renderMessages();
  }

  _msgColor(type, playerIdx) {
    // Player-specific first
    if (playerIdx === 0) return '#ff9999';  // P1 red-ish
    if (playerIdx === 1) return '#99bbff';  // P2 blue-ish
    switch (type) {
      case 'hit':    return '#ff5555';  // Damage received (red)
      case 'kill':   return '#ffd700';  // Kill (gold)
      case 'good':   return '#55ff55';  // Good news (green)
      case 'warn':   return '#ff8800';  // Warning (orange)
      case 'system': return '#888888';  // System (gray)
      case 'info':   return '#aaaaaa';  // Info (light gray)
      default:       return '#cccccc';  // Normal (white-ish)
    }
  }

  _msgPrefix(type, playerIdx) {
    if (playerIdx === 0) return '[J1] ';
    if (playerIdx === 1) return '[J2] ';
    if (type === 'system') return '* ';
    if (type === 'kill')   return '✦ ';
    if (type === 'warn')   return '! ';
    if (type === 'good')   return '+ ';
    if (type === 'hit')    return '▼ ';
    return '';
  }

  _renderMessages() {
    if (!this.messageEl) return;
    const recent = this.messages.slice(-25);
    this.messageEl.innerHTML = recent.map((m, i) => {
      const isNew   = i === recent.length - 1;
      const color   = this._msgColor(m.type, m.playerIdx);
      const prefix  = this._msgPrefix(m.type, m.playerIdx);
      return `<div class="message-line${isNew ? ' msg-new' : ''}" style="color:${color}">${prefix}${m.text}</div>`;
    }).join('');
    // Auto-scroll to bottom
    if (this.messageEl.parentElement) {
      this.messageEl.parentElement.scrollTop = this.messageEl.parentElement.scrollHeight;
    }
  }

  // === HUD UPDATE ===
  updatePlayerHUD(player, idx) {
    const i = idx + 1; // 1 or 2

    const nameEl     = document.getElementById(`hud-name-p${i}`);
    const rcEl       = document.getElementById(`hud-race-class-p${i}`);
    const hpBar      = document.getElementById(`hp-bar-p${i}`);
    const hpText     = document.getElementById(`hp-text-p${i}`);
    const mpBar      = document.getElementById(`mp-bar-p${i}`);
    const mpText     = document.getElementById(`mp-text-p${i}`);
    const strEl      = document.getElementById(`str-p${i}`);
    const intEl      = document.getElementById(`int-p${i}`);
    const dexEl      = document.getElementById(`dex-p${i}`);
    const xlEl       = document.getElementById(`xl-p${i}`);
    const autEl      = document.getElementById(`aut-p${i}`);
    const acEl       = document.getElementById(`ac-p${i}`);
    const evEl       = document.getElementById(`ev-p${i}`);
    const goldEl     = document.getElementById(`gold-p${i}`);
    const statusEl   = document.getElementById(`status-effects-p${i}`);
    const spellsEl   = document.getElementById(`spell-list-p${i}`);

    if (nameEl)   nameEl.textContent = player.name;
    if (rcEl)     rcEl.textContent   = `${player.raceData.name} · ${player.jobData.name}`;

    if (hpBar) {
      const pct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
      hpBar.style.width = `${pct}%`;
      if (pct > 50)      hpBar.style.background = 'linear-gradient(90deg, #8b2020, #e05555)';
      else if (pct > 25) hpBar.style.background = 'linear-gradient(90deg, #8b5000, #e09020)';
      else               hpBar.style.background = 'linear-gradient(90deg, #600, #c00)';
    }
    if (hpText) hpText.textContent = `${player.hp}/${player.maxHp}`;
    if (mpBar)  mpBar.style.width  = `${Math.max(0, Math.min(100, (player.mp / Math.max(1, player.maxMp)) * 100))}%`;
    if (mpText) mpText.textContent = `${player.mp}/${player.maxMp}`;

    if (strEl)  strEl.textContent  = player.str;
    if (intEl)  intEl.textContent  = player.int;
    if (dexEl)  dexEl.textContent  = player.dex;
    if (xlEl)   xlEl.textContent   = `${player.level}`;
    if (acEl)   acEl.textContent   = player.ac;
    if (evEl)   evEl.textContent   = player.ev;
    if (goldEl) goldEl.textContent = player.gold;
    if (autEl)  autEl.textContent  = player.nextTurn || 0;

    // Status effects
    if (statusEl) {
      const fx = player.getStatusEffects();
      statusEl.innerHTML = fx.map(f =>
        `<span class="status-tag ${f.type}">${f.name}</span>`
      ).join('');
    }

    // Spells
    if (spellsEl) {
      spellsEl.innerHTML = (player.knownSpells || []).map(s =>
        `<div class="spell-entry">${s.name} (${s.mpCost}MP)</div>`
      ).join('') || '<div class="spell-entry" style="color:#555">Nenhum feitiço</div>';
    }

    // HUD Inventory List
    const invListEl = document.getElementById(`inventory-list-p${i}`);
    if (invListEl) {
      if (player.inventory.length === 0) {
        invListEl.innerHTML = '<div class="spell-entry" style="color:#555">Inventário vazio</div>';
      } else {
        invListEl.innerHTML = player.inventory.map(item => {
          const countStr = item.count > 1 ? `${item.count}x ` : '';
          const name = item.name;
          const isEquipped = (player.weapon && player.weapon.invKey === item.invKey) || 
                             (player.armour && player.armour.invKey === item.invKey) ||
                             (player.shield && player.shield.invKey === item.invKey);
          const eqStr = isEquipped ? ' <span style="color:var(--gold); font-size:9px">(E)</span>' : '';
          return `<div class="spell-entry inv-hud-item" data-key="${item.invKey}">
            <span style="color:var(--gold-dim); font-family:monospace; margin-right:4px">${item.invKey}</span>
            <span>${countStr}${name}${eqStr}</span>
          </div>`;
        }).join('');

        // Make HUD inventory items clickable!
        invListEl.querySelectorAll('.inv-hud-item').forEach(el => {
          el.addEventListener('click', () => {
            const key = el.dataset.key;
            if (window.engine && window.engine.turnMgr) {
              const active = window.engine.turnMgr.getActivePlayer();
              if (active && active.playerIndex === player.playerIndex && window.engine.waitingForInput) {
                window.engine._playerUseItem(player, key);
              } else {
                this.addMessage(`Não é o turno de ${player.name} para usar itens.`, 'info', player.playerIndex);
              }
            }
          });
        });
      }
    }

    // Render Ground Item Section
    const groundItemEl = document.getElementById(`ground-item-section-p${i}`);
    if (groundItemEl) {
      const itemOnGround = window.engine ? window.engine.items.find(item => item.x === player.x && item.y === player.y) : null;
      if (itemOnGround && !player.isDead) {
        const itemClass = itemOnGround.type === 'gold' ? 'gold' : '';
        groundItemEl.innerHTML = `
          <button class="hud-pickup-btn ${itemClass}" id="hud-pickup-btn-p${i}">
            📥 Pegar ${itemOnGround.name}
          </button>
        `;
        groundItemEl.classList.remove('hidden');

        const pickupBtn = document.getElementById(`hud-pickup-btn-p${i}`);
        if (pickupBtn) {
          pickupBtn.onclick = (e) => {
            e.stopPropagation();
            if (window.engine) {
              window.engine._playerPickup(player);
              window.engine._renderHUDs();
            }
          };
        }
      } else {
        groundItemEl.innerHTML = '';
        groundItemEl.classList.add('hidden');
      }
    }

    // Set up open inventory button click on HUD
    const openBtn = document.getElementById(`open-inv-btn-p${i}`);

    const onOpenClick = (e) => {
      e.stopPropagation();
      if (window.engine && window.engine.turnMgr) {
        const active = window.engine.turnMgr.getActivePlayer();
        const isTheirTurn = active && active.playerIndex === player.playerIndex;
        if (isTheirTurn && window.engine.waitingForInput) {
          this.openInventory(player, (key) => window.engine._playerUseItem(player, key), 'Usar/Equipar');
        } else {
          this.openInventory(player, null, 'Visualização');
        }
      }
    };

    if (openBtn) openBtn.onclick = onOpenClick;
  }

  setActivePlayer(playerIdx) {
    const actEl0 = document.getElementById('active-p1');
    const actEl1 = document.getElementById('active-p2');
    if (actEl0) actEl0.classList.toggle('showing', playerIdx === 0);
    if (actEl1) actEl1.classList.toggle('showing', playerIdx === 1);
  }

  updateTurnQueue(upcoming) {
    if (!this.turnQueueEl) return;
    const items = upcoming.slice(0, 6);
    this.turnQueueEl.innerHTML = items.map((entry, i) => {
      const a = entry.actor;
      let cls, label;
      if (a.isPlayer) {
        cls   = a.playerIndex === 0 ? 'player-token p1' : 'player-token p2';
        label = a.name.slice(0, 8);
      } else {
        cls   = 'monster-token';
        label = a.name.slice(0, 8);
      }
      const activeCls = i === 0 ? ' active-turn' : '';
      return `<span class="turn-token ${cls}${activeCls}">${label}</span>` +
             (i < items.length - 1 ? '<span class="turn-separator">→</span>' : '');
    }).join('');
  }

  showDeathOverlay(playerIdx, show) {
    const el = document.getElementById(`dead-overlay-p${playerIdx + 1}`);
    if (el) el.classList.toggle('visible', show);
  }

  // === INVENTORY MODAL ===
  closeInventory() {
    const modal = document.getElementById('inventory-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    this.inventoryOpen = false;
    this.activeInventoryPlayer = null;
    this.activeInventoryCallback = null;
  }

  openInventory(player, onUse, actionName = 'Usar/Equipar') {
    const modal = document.getElementById('inventory-modal');
    const title = document.getElementById('inventory-title');
    const eqEl  = document.getElementById('equipment-slots');
    const invEl = document.getElementById('inventory-list');

    if (!modal) return;

    this.inventoryOpen = true;
    this.activeInventoryPlayer = player;
    this.activeInventoryCallback = onUse;

    title.textContent = `Inventário — ${player.name} (${actionName})`;

    // Equipment slots
    const slots = [
      { label: 'Arma',    item: player.weapon },
      { label: 'Armadura', item: player.armour },
      { label: 'Escudo',   item: player.shield }
    ];
    eqEl.innerHTML = slots.map(s => `
      <div class="equip-slot">
        <span class="equip-slot-label">${s.label}:</span>
        <span class="equip-slot-item ${s.item ? '' : 'empty'}">${s.item ? s.item.name : 'Nenhum'}</span>
      </div>
    `).join('');

    // Render gold amount in inventory modal
    const goldDisplay = document.getElementById('inventory-gold-display');
    if (goldDisplay) {
      goldDisplay.innerHTML = `💰 Ouro: <span style="color:var(--text-white)">${player.gold}</span>`;
    }

    // Inventory list
    if (player.inventory.length === 0) {
      invEl.innerHTML = '<div style="color:#555;padding:8px">Inventário vazio</div>';
    } else {
      invEl.innerHTML = player.inventory.map(item => {
        const countStr = item.count > 1 ? `${item.count}x ` : '';
        const isEquipped = (player.weapon && player.weapon.invKey === item.invKey) || 
                           (player.armour && player.armour.invKey === item.invKey) ||
                           (player.shield && player.shield.invKey === item.invKey);
        const eqStr = isEquipped ? ' <span style="color:var(--gold); font-size:9px">(E)</span>' : '';
        return `
          <div class="inv-item" data-key="${item.invKey}">
            <span class="inv-item-key">${item.invKey}</span>
            <div>
              <div class="inv-item-name">${countStr}${item.name}${eqStr}</div>
              <div class="inv-item-desc">${item.desc || ''}</div>
            </div>
          </div>
        `;
      }).join('');

      // Click to use
      invEl.querySelectorAll('.inv-item').forEach(el => {
        el.addEventListener('click', () => {
          const key = el.dataset.key;
          this.closeInventory();
          if (onUse) onUse(key);
        });
      });
    }

    modal.classList.remove('hidden');

    // Close button
    document.getElementById('close-inventory').onclick = () => {
      this.closeInventory();
    };
  }

  openSpellMenu(player, onCast) {
    const modal = document.getElementById('spell-modal');
    const title = document.getElementById('spell-title');
    const listEl = document.getElementById('spell-cast-list');

    if (!modal) return;
    title.textContent = `Feitiços — ${player.name}`;

    if (!player.knownSpells || player.knownSpells.length === 0) {
      listEl.innerHTML = '<div style="color:#555;padding:8px">Nenhum feitiço conhecido</div>';
    } else {
      listEl.innerHTML = player.knownSpells.map((s, i) => {
        const canCast = player.mp >= s.mpCost;
        return `
          <div class="spell-cast-entry ${canCast ? '' : 'insufficient'}" data-idx="${i}">
            <div>
              <div class="spell-cast-name">${s.name}</div>
              <div class="spell-cast-school">${s.school} · Nível ${s.level} · ${s.desc}</div>
            </div>
            <div class="spell-cast-cost">${s.mpCost} MP</div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.spell-cast-entry').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          if (player.mp >= player.knownSpells[idx].mpCost) {
            modal.classList.add('hidden');
            if (onCast) onCast(player.knownSpells[idx]);
          }
        });
      });
    }

    modal.classList.remove('hidden');
    document.getElementById('close-spells').onclick = () => {
      modal.classList.add('hidden');
    };
  }

  showGameOver(title, message, onRestart, onTitle) {
    const modal = document.getElementById('gameover-modal');
    document.getElementById('gameover-title').textContent   = title;
    document.getElementById('gameover-message').innerHTML   = message;
    document.getElementById('btn-play-again').onclick       = () => { modal.classList.add('hidden'); onRestart(); };
    document.getElementById('btn-title-gameover').onclick   = () => { modal.classList.add('hidden'); onTitle(); };
    modal.classList.remove('hidden');
  }

  // Update HUD sprite canvas
  updateHUDSprite(player, idx) {
    const canvas = document.getElementById(`hud-sprite-p${idx + 1}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (player.spriteLoaded && player.spriteImg) {
      ctx.drawImage(player.spriteImg, 0, 0, canvas.width, canvas.height);
    }
  }
}
