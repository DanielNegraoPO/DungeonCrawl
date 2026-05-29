// =============================================
// RENDERER — Canvas 2D with DCSS Tiles
// =============================================
import { FEATURES } from './data.js';
import { isVisible } from './los.js';

export const TILE_SIZE = 32;

const BASE = 'Documentation/crawl-master/crawl-ref/source/rltiles';

// Tile image cache
const tileCache = new Map();

function loadTile(path) {
  if (tileCache.has(path)) return tileCache.get(path);
  const img = new Image();
  img.src = path;
  tileCache.set(path, img);
  return img;
}

// Pre-load all dungeon tiles
const FLOOR_TILES = [
  `${BASE}/dngn/floor/pebble_brown0.png`,
  `${BASE}/dngn/floor/pebble_brown1.png`,
  `${BASE}/dngn/floor/pebble_brown2.png`,
  `${BASE}/dngn/floor/pebble_brown3.png`,
  `${BASE}/dngn/floor/pebble_brown4.png`,
  `${BASE}/dngn/floor/grey_dirt0.png`,
  `${BASE}/dngn/floor/grey_dirt1.png`,
  `${BASE}/dngn/floor/grey_dirt2.png`,
];

// Wall tiles — brick_dark_1_0 through brick_dark_1_11 are the main dungeon walls
const WALL_TILES = [];
for (let i = 0; i <= 11; i++) {
  WALL_TILES.push(`${BASE}/dngn/wall/brick_dark_1_${i}.png`);
}
// Extra stone variants
for (let i = 0; i <= 3; i++) {
  WALL_TILES.push(`${BASE}/dngn/wall/stone2_gray${i}.png`);
}

const FEAT_TILES = {
  stair_down: `${BASE}/dngn/gateways/stone_stairs_down.png`,
  stair_up:   `${BASE}/dngn/gateways/stone_stairs_up.png`,
  shrine:     `${BASE}/dngn/altars/elyvilon.png`,
  door:       `${BASE}/dngn/doors/closed_door.png`,
  door_open:  `${BASE}/dngn/doors/open_door.png`,
};

// Preload everything
[...FLOOR_TILES, ...WALL_TILES, ...Object.values(FEAT_TILES)].forEach(loadTile);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    // Viewport: how many tiles fit
    this.viewW = 0;
    this.viewH = 0;

    // Camera center (follows current active player)
    this.camX = 0;
    this.camY = 0;
    this.targetCamX = 0;
    this.targetCamY = 0;

    // Per-tile floor variation seed (deterministic per tile position)
    this.floorVar = {};

    // Animation
    this.animTick = 0;

    // Flash effects: [{x, y, color, alpha, duration}]
    this.flashEffects = [];

    this.resize();
  }

  resize() {
    const wrapper = this.canvas.parentElement;
    const w = wrapper.clientWidth  || 800;
    const h = wrapper.clientHeight || 600;
    this.canvas.width  = Math.floor(w / TILE_SIZE) * TILE_SIZE;
    this.canvas.height = Math.floor(h / TILE_SIZE) * TILE_SIZE;
    this.viewW = Math.floor(this.canvas.width  / TILE_SIZE);
    this.viewH = Math.floor(this.canvas.height / TILE_SIZE);
  }

  centerOn(x, y) {
    this.targetCamX = x - Math.floor(this.viewW / 2);
    this.targetCamY = y - Math.floor(this.viewH / 2);
  }

  smoothCamera() {
    const dx = this.targetCamX - this.camX;
    const dy = this.targetCamY - this.camY;
    this.camX += dx * 0.3;
    this.camY += dy * 0.3;
  }

  addFlash(x, y, color, duration = 8) {
    this.flashEffects.push({ x, y, color, alpha: 0.7, duration, maxDuration: duration });
  }

  _getFloorTile(x, y) {
    const key = `${x},${y}`;
    if (!this.floorVar[key]) {
      this.floorVar[key] = Math.floor(Math.abs(Math.sin(x * 7 + y * 13) * 1000)) % FLOOR_TILES.length;
    }
    return FLOOR_TILES[this.floorVar[key]];
  }

  _getWallTile(x, y) {
    const v = Math.floor(Math.abs(Math.sin(x * 3 + y * 7 + 42) * 1000)) % WALL_TILES.length;
    return WALL_TILES[v];
  }

  render(dungeon, players, monsters, items, losP1, losP2) {
    this.animTick++;
    this.smoothCamera();

    const ctx = this.ctx;
    const { width: mapW, height: mapH } = dungeon;
    const camX = Math.round(this.camX);
    const camY = Math.round(this.camY);

    // Clear to pitch black (unexplored)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const startX = Math.max(0, camX);
    const startY = Math.max(0, camY);
    const endX   = Math.min(mapW, camX + this.viewW + 2);
    const endY   = Math.min(mapH, camY + this.viewH + 2);

    // Pre-compute LOS key sets for fast lookup
    const combinedLOS = new Set([...losP1, ...losP2]);

    // === RENDER TILES ===
    // seen is already updated by engine._updateLOS() before this call
    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const key     = `${tx},${ty}`;
        const inLOS   = combinedLOS.has(key);
        const seenRow = dungeon.seen ? dungeon.seen[ty] : null;
        const seen    = seenRow ? seenRow[tx] : false;

        // Skip cells never seen by anyone
        if (!inLOS && !seen) continue;

        const screenX = (tx - camX) * TILE_SIZE;
        const screenY = (ty - camY) * TILE_SIZE;
        const cell    = dungeon.map[ty][tx];

        // Alpha: 1.0 = fully lit (in LOS), 0.4 = seen but in dark
        const alpha = inLOS ? 1.0 : 0.38;

        // Draw floor base
        this._drawTile(ctx, this._getFloorTile(tx, ty), screenX, screenY, alpha);

        // Draw cell feature on top
        switch (cell) {
          case FEATURES.WALL:
            this._drawTile(ctx, this._getWallTile(tx, ty), screenX, screenY, alpha);
            break;
          case FEATURES.STAIR_DOWN:
            this._drawTile(ctx, FEAT_TILES.stair_down, screenX, screenY, alpha);
            break;
          case FEATURES.STAIR_UP:
            this._drawTile(ctx, FEAT_TILES.stair_up, screenX, screenY, alpha);
            break;
          case FEATURES.SHRINE:
            this._drawShrine(ctx, screenX, screenY, inLOS);
            break;
          case FEATURES.DOOR:
            this._drawTile(ctx, FEAT_TILES.door, screenX, screenY, alpha);
            break;
          case FEATURES.DOOR_OPEN:
            this._drawTile(ctx, FEAT_TILES.door_open, screenX, screenY, alpha);
            break;
        }

        // Tint seen-but-dark cells slightly blue (DCSS fog of war look)
        if (!inLOS && seen) {
          ctx.fillStyle = 'rgba(0, 20, 60, 0.35)';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }

        // Subtle vision cone tint per player
        if (inLOS) {
          const visP1 = losP1.has(key);
          const visP2 = losP2.has(key);
          if (visP1 && !visP2) {
            ctx.fillStyle = 'rgba(220, 80, 80, 0.04)';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          } else if (visP2 && !visP1) {
            ctx.fillStyle = 'rgba(80, 140, 220, 0.04)';
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    // Draw items (only if in LOS)
    for (const item of items) {
      if (!combinedLOS.has(`${item.x},${item.y}`)) continue;
      const sx = (item.x - camX) * TILE_SIZE;
      const sy = (item.y - camY) * TILE_SIZE;
      if (sx < -TILE_SIZE || sy < -TILE_SIZE || sx > this.canvas.width || sy > this.canvas.height) continue;
      this._drawItem(ctx, item, sx, sy);
    }

    // Draw monsters (only if in combined LOS)
    for (const mon of monsters) {
      if (mon.isDead) continue;
      if (!combinedLOS.has(`${mon.x},${mon.y}`)) continue;
      const sx = (mon.x - camX) * TILE_SIZE;
      const sy = (mon.y - camY) * TILE_SIZE;
      if (sx < -TILE_SIZE || sy < -TILE_SIZE || sx > this.canvas.width || sy > this.canvas.height) continue;
      this._drawMonster(ctx, mon, sx, sy);
    }

    // Draw players
    for (const player of players) {
      const sx = (player.x - camX) * TILE_SIZE;
      const sy = (player.y - camY) * TILE_SIZE;
      if (sx < -TILE_SIZE || sy < -TILE_SIZE || sx > this.canvas.width || sy > this.canvas.height) continue;
      this._drawPlayer(ctx, player, sx, sy);
    }

    // Flash effects
    this._renderFlashes(ctx, camX, camY);

    // Draw player labels
    for (const player of players) {
      const sx = (player.x - camX) * TILE_SIZE;
      const sy = (player.y - camY) * TILE_SIZE;
      this._drawPlayerLabel(ctx, player, sx, sy);
    }
  }

  _drawTile(ctx, tilePath, sx, sy, alpha = 1) {
    const img = tileCache.get(tilePath);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, sx, sy, TILE_SIZE, TILE_SIZE);
      ctx.globalAlpha = 1;
    } else {
      // Fallback: colored rectangle
      ctx.globalAlpha = alpha;
      if (tilePath.includes('wall')) {
        ctx.fillStyle = '#3a3540';
      } else if (tilePath.includes('floor') || tilePath.includes('pebble') || tilePath.includes('dirt')) {
        ctx.fillStyle = '#2a2520';
      } else {
        ctx.fillStyle = '#2a2030';
      }
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      ctx.globalAlpha = 1;
    }
  }

  _drawShrine(ctx, sx, sy, inLOS) {
    const img = tileCache.get(FEAT_TILES.shrine);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.globalAlpha = inLOS ? 1.0 : 0.35;
      ctx.drawImage(img, sx, sy, TILE_SIZE, TILE_SIZE);
      ctx.globalAlpha = 1;
    } else {
      // Fallback shrine: golden star
      ctx.globalAlpha = inLOS ? 1.0 : 0.35;
      ctx.fillStyle = '#c9a84c';
      ctx.beginPath();
      ctx.arc(sx + TILE_SIZE/2, sy + TILE_SIZE/2, 10, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⛪', sx + TILE_SIZE/2, sy + TILE_SIZE/2 + 4);
      ctx.globalAlpha = 1;
    }

    // Shrine glow animation
    if (inLOS) {
      const pulse = Math.sin(this.animTick * 0.1) * 0.3 + 0.5;
      ctx.fillStyle = `rgba(201,168,76,${pulse * 0.2})`;
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    }
  }

  _drawMonster(ctx, mon, sx, sy) {
    if (mon.spriteLoaded && mon.spriteImg) {
      ctx.drawImage(mon.spriteImg, sx, sy, TILE_SIZE, TILE_SIZE);
    } else {
      // Fallback: colored glyph
      ctx.fillStyle = mon.monsterDef.color || '#808080';
      ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(mon.glyph, sx + TILE_SIZE/2, sy + TILE_SIZE/2 + 6);
    }

    // HP bar above monster
    if (mon.hp < mon.maxHp) {
      const pct = mon.hp / mon.maxHp;
      ctx.fillStyle = '#400';
      ctx.fillRect(sx, sy - 4, TILE_SIZE, 3);
      ctx.fillStyle = pct > 0.5 ? '#0c0' : pct > 0.25 ? '#cc0' : '#c00';
      ctx.fillRect(sx, sy - 4, Math.floor(TILE_SIZE * pct), 3);
    }

    // Sleeping indicator
    if (mon.sleeping) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'center';
      ctx.fillText('z', sx + TILE_SIZE - 4, sy + 8);
    }

    // Status indicators
    if (mon.poison > 0) {
      ctx.fillStyle = 'rgba(64,160,32,0.4)';
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    }
  }

  _drawPlayer(ctx, player, sx, sy) {
    if (player.isGhost) {
      // Draw ghost (semi-transparent)
      ctx.globalAlpha = 0.4;
    }

    if (player.spriteLoaded && player.spriteImg) {
      ctx.drawImage(player.spriteImg, sx, sy, TILE_SIZE, TILE_SIZE);
    } else {
      // Fallback: colored @ symbol
      const color = player.playerIndex === 0 ? '#e05555' : '#5590e0';
      ctx.fillStyle = color;
      ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('@', sx + TILE_SIZE/2, sy + TILE_SIZE/2 + 7);
    }

    ctx.globalAlpha = 1;

    // Player outline glow
    const color = player.playerIndex === 0 ? 'rgba(224,85,85,0.7)' : 'rgba(85,144,224,0.7)';
    ctx.strokeStyle = color;
    ctx.lineWidth = player.isDead ? 1 : 2;
    ctx.strokeRect(sx + 1, sy + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // Status overlays
    if (player.hasted > 0) {
      ctx.fillStyle = 'rgba(64,224,160,0.2)';
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    }
    if (player.poison > 0) {
      ctx.fillStyle = 'rgba(64,160,32,0.2)';
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    }
  }

  _drawPlayerLabel(ctx, player, sx, sy) {
    const name = player.name.length > 6 ? player.name.slice(0, 6) : player.name;
    const color = player.playerIndex === 0 ? '#ff8888' : '#88aaff';

    ctx.font = 'bold 9px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(sx, sy - 14, TILE_SIZE, 12);
    ctx.fillStyle = color;
    ctx.fillText(name, sx + TILE_SIZE/2, sy - 4);
  }

  _drawItem(ctx, item, sx, sy) {
    // Try to draw the DCSS sprite if available
    if (item.spritePath) {
      const img = loadTile(item.spritePath);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, sx, sy, TILE_SIZE, TILE_SIZE);
        return;
      }
    }

    // --- Fallback: draw colored shape ---
    const size = 12;
    const cx = sx + TILE_SIZE / 2;
    const cy = sy + TILE_SIZE / 2;

    if (item.type === 'potion') {
      // Rounded bottle
      ctx.fillStyle = item.color || '#8888ff';
      ctx.beginPath();
      ctx.arc(cx, cy + 2, size / 2 + 2, 0, Math.PI * 2);
      ctx.fill();
      // bottle neck
      ctx.fillRect(cx - 3, cy - size / 2 - 2, 6, 5);
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'scroll') {
      ctx.fillStyle = '#e8e0c0';
      ctx.fillRect(sx + 6, sy + 5, 20, 22);
      ctx.strokeStyle = '#808060';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 6, sy + 5, 20, 22);
      // lines to suggest text
      ctx.strokeStyle = '#c0b880';
      ctx.lineWidth = 0.5;
      for (let line = 0; line < 3; line++) {
        ctx.beginPath();
        ctx.moveTo(sx + 9, sy + 10 + line * 5);
        ctx.lineTo(sx + 23, sy + 10 + line * 5);
        ctx.stroke();
      }
    } else if (item.type === 'gold') {
      // Gold coin pile
      ctx.fillStyle = '#f0c020';
      ctx.beginPath();
      ctx.arc(cx, cy + 2, size / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c09010';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', cx, cy + 6);
    } else if (item.type === 'weapon') {
      // Diagonal sword
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx + 6, sy + 26);
      ctx.lineTo(sx + 26, sy + 6);
      ctx.stroke();
      // crossguard
      ctx.strokeStyle = '#a08040';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 11, sy + 11);
      ctx.lineTo(sx + 20, sy + 20);
      ctx.stroke();
    } else if (item.type === 'armour') {
      // Shield/armour shape
      ctx.fillStyle = item.color || '#a08040';
      ctx.beginPath();
      ctx.moveTo(cx, sy + 5);
      ctx.lineTo(sx + 26, sy + 12);
      ctx.lineTo(sx + 26, sy + 22);
      ctx.lineTo(cx, sy + 28);
      ctx.lineTo(sx + 6, sy + 22);
      ctx.lineTo(sx + 6, sy + 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c0a060';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }


  _renderFlashes(ctx, camX, camY) {
    for (let i = this.flashEffects.length - 1; i >= 0; i--) {
      const f = this.flashEffects[i];
      const sx = (f.x - camX) * TILE_SIZE;
      const sy = (f.y - camY) * TILE_SIZE;
      const alpha = (f.duration / f.maxDuration) * f.alpha;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      ctx.globalAlpha = 1;

      f.duration--;
      if (f.duration <= 0) this.flashEffects.splice(i, 1);
    }
  }

  // Render sprite to a small canvas (for HUD)
  renderSpriteToCanvas(canvas, spriteImg, spriteLoaded) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (spriteLoaded && spriteImg) {
      ctx.drawImage(spriteImg, 0, 0, canvas.width, canvas.height);
    }
  }

  // Show damage number popup
  showDamageNumber(screenX, screenY, damage, color = '#ff4444') {
    const wrapper = this.canvas.parentElement;
    const div = document.createElement('div');
    div.className = 'damage-number';
    div.textContent = damage > 0 ? `-${damage}` : 'MISS';
    div.style.left  = `${screenX + this.canvas.offsetLeft + 8}px`;
    div.style.top   = `${screenY + this.canvas.offsetTop}px`;
    div.style.color = damage > 0 ? color : '#aaa';
    wrapper.appendChild(div);
    setTimeout(() => div.remove(), 1000);
  }
}
