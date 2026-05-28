// =============================================
// DUNGEON GENERATOR — BSP Room-based Algorithm
// Faithful to DCSS D:1 layout style
// =============================================
import { rng } from './rng.js';
import { FEATURES } from './data.js';

export const MAP_W = 80;
export const MAP_H = 50;

export class DungeonGenerator {
  constructor() {
    this.map = null;
    this.rooms = [];
    this.features = []; // {x, y, type, data}
  }

  generate() {
    this.map = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W).fill(FEATURES.WALL));
    this.rooms = [];
    this.features = [];

    this._bspSplit({ x: 1, y: 1, w: MAP_W - 2, h: MAP_H - 2 }, 0);
    this._connectRooms();
    this._placeDoors();
    this._placeFeatures();

    return {
      map: this.map,
      rooms: this.rooms,
      features: this.features,
      width: MAP_W,
      height: MAP_H
    };
  }

  _bspSplit(rect, depth) {
    const MIN_SIZE = 5, MAX_DEPTH = 5;

    if (depth >= MAX_DEPTH || (rect.w < MIN_SIZE * 2 && rect.h < MIN_SIZE * 2)) {
      this._carveRoom(rect);
      return;
    }

    const canSplitH = rect.h >= MIN_SIZE * 2 + 2;
    const canSplitV = rect.w >= MIN_SIZE * 2 + 2;

    if (!canSplitH && !canSplitV) {
      this._carveRoom(rect);
      return;
    }

    let splitH = canSplitH && canSplitV ? rng.bool() : canSplitH;

    if (splitH) {
      const splitY = rng.int(Math.floor(rect.h * 0.35), Math.floor(rect.h * 0.65));
      this._bspSplit({ x: rect.x, y: rect.y, w: rect.w, h: splitY }, depth + 1);
      this._bspSplit({ x: rect.x, y: rect.y + splitY, w: rect.w, h: rect.h - splitY }, depth + 1);
    } else {
      const splitX = rng.int(Math.floor(rect.w * 0.35), Math.floor(rect.w * 0.65));
      this._bspSplit({ x: rect.x, y: rect.y, w: splitX, h: rect.h }, depth + 1);
      this._bspSplit({ x: rect.x + splitX, y: rect.y, w: rect.w - splitX, h: rect.h }, depth + 1);
    }
  }

  _carveRoom(rect) {
    const minRW = 4, minRH = 4, maxRW = Math.min(rect.w - 2, 12), maxRH = Math.min(rect.h - 2, 10);
    if (maxRW < minRW || maxRH < minRH) return;

    const rw = rng.int(minRW, maxRW);
    const rh = rng.int(minRH, maxRH);
    const rx = rect.x + rng.int(1, rect.w - rw - 1);
    const ry = rect.y + rng.int(1, rect.h - rh - 1);

    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++)
        this.map[y][x] = FEATURES.FLOOR;

    this.rooms.push({
      x: rx, y: ry, w: rw, h: rh,
      cx: Math.floor(rx + rw / 2),
      cy: Math.floor(ry + rh / 2)
    });
  }

  _connectRooms() {
    if (this.rooms.length < 2) return;

    // Sort rooms by x to create a spanning tree
    const sorted = [...this.rooms].sort((a, b) => a.cx - b.cx);

    for (let i = 1; i < sorted.length; i++) {
      this._corridor(sorted[i-1].cx, sorted[i-1].cy, sorted[i].cx, sorted[i].cy);
    }

    // Add a few extra corridors for loops
    for (let k = 0; k < Math.floor(this.rooms.length / 4); k++) {
      const a = rng.choice(this.rooms);
      const b = rng.choice(this.rooms);
      if (a !== b) this._corridor(a.cx, a.cy, b.cx, b.cy);
    }
  }

  _corridor(x1, y1, x2, y2) {
    // L-shaped corridor
    let x = x1, y = y1;

    // Random choice: go horizontal first or vertical first
    if (rng.bool()) {
      while (x !== x2) { this._setFloor(x, y); x += x < x2 ? 1 : -1; }
      while (y !== y2) { this._setFloor(x, y); y += y < y2 ? 1 : -1; }
    } else {
      while (y !== y2) { this._setFloor(x, y); y += y < y2 ? 1 : -1; }
      while (x !== x2) { this._setFloor(x, y); x += x < x2 ? 1 : -1; }
    }
    this._setFloor(x, y);
  }

  _setFloor(x, y) {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H)
      this.map[y][x] = FEATURES.FLOOR;
  }

  _placeDoors() {
    // Place doors at corridor-to-room transitions
    for (const room of this.rooms) {
      const edges = this._getRoomEdgeCells(room);
      for (const {x, y} of edges) {
        const adj = this._getAdjFloor(x, y);
        // If cell is floor with wall on one side and corridor on other → door
        if (adj.length >= 2 && rng.bool(0.35)) {
          this.map[y][x] = FEATURES.DOOR;
          this.features.push({x, y, type: 'door'});
        }
      }
    }
  }

  _getRoomEdgeCells(room) {
    const cells = [];
    for (let x = room.x - 1; x <= room.x + room.w; x++) {
      cells.push({x, y: room.y - 1});
      cells.push({x, y: room.y + room.h});
    }
    for (let y = room.y; y < room.y + room.h; y++) {
      cells.push({x: room.x - 1, y});
      cells.push({x: room.x + room.w, y});
    }
    return cells.filter(c => c.x > 0 && c.x < MAP_W-1 && c.y > 0 && c.y < MAP_H-1 && this.map[c.y][c.x] === FEATURES.FLOOR);
  }

  _getAdjFloor(x, y) {
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    return dirs.filter(([dx,dy]) => {
      const nx = x+dx, ny = y+dy;
      return nx>=0 && nx<MAP_W && ny>=0 && ny<MAP_H && this.map[ny][nx] === FEATURES.FLOOR;
    });
  }

  _placeFeatures() {
    if (this.rooms.length === 0) return;

    const usedRooms = new Set();

    // Player 1 start: room 0 center
    const startRoom = this.rooms[0];
    usedRooms.add(0);
    this.features.push({x: startRoom.cx, y: startRoom.cy, type: 'start_p1'});

    // Player 2 start: last room center (or close to it)
    const p2Idx = this.rooms.length - 1;
    const p2Room = this.rooms[p2Idx];
    usedRooms.add(p2Idx);
    this.features.push({x: p2Room.cx, y: p2Room.cy, type: 'start_p2'});

    // Shrine (revival point) - a mid room
    const shrineIdx = Math.floor(this.rooms.length / 2);
    const shrineRoom = this.rooms[shrineIdx];
    usedRooms.add(shrineIdx);
    this.map[shrineRoom.cy][shrineRoom.cx] = FEATURES.SHRINE;
    this.features.push({x: shrineRoom.cx, y: shrineRoom.cy, type: 'shrine'});

    // Stairs down (near the end)
    const stairRoom = this.rooms[Math.max(0, this.rooms.length - 2)];
    const sx = stairRoom.cx + rng.int(-1, 1);
    const sy = stairRoom.cy + rng.int(-1, 1);
    this.map[sy][sx] = FEATURES.STAIR_DOWN;
    this.features.push({x: sx, y: sy, type: 'stair_down'});

    // Stairs up (near start)
    const upRoom = this.rooms[Math.min(1, this.rooms.length-1)];
    this.map[upRoom.cy][upRoom.cx] = FEATURES.STAIR_UP;
    this.features.push({x: upRoom.cx, y: upRoom.cy, type: 'stair_up'});
  }

  // Returns all floor cells that are walkable
  getFloorCells() {
    const cells = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (this.map[y][x] === FEATURES.FLOOR)
          cells.push({x, y});
    return cells;
  }

  isPassable(x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
    const cell = this.map[y][x];
    return cell === FEATURES.FLOOR || cell === FEATURES.SHRINE ||
           cell === FEATURES.STAIR_DOWN || cell === FEATURES.STAIR_UP ||
           cell === FEATURES.DOOR_OPEN;
  }

  isOpaque(x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return true;
    const cell = this.map[y][x];
    return cell === FEATURES.WALL || cell === FEATURES.DOOR;
  }
}
