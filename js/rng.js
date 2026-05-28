// =============================================
// RANDOM NUMBER GENERATOR (Seeded - for determinism)
// =============================================
export class RNG {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
  }

  next() {
    // Xorshift32
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }

  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  roll(n, d) { let t = 0; for(let i=0;i<n;i++) t += this.int(1,d); return t; }
  bool(prob = 0.5) { return this.next() < prob; }
  choice(arr) { return arr[this.int(0, arr.length - 1)]; }
  weighted(options) { // [{item, w}]
    const total = options.reduce((s,o) => s + o.w, 0);
    let r = this.next() * total;
    for(const o of options) { r -= o.w; if(r <= 0) return o.item; }
    return options[options.length-1].item;
  }
}

export const rng = new RNG();

// Parse damage string e.g. "3d4" → roll
export function rollDmg(dmgStr, rngInst = rng) {
  if (!dmgStr || dmgStr === '0' || dmgStr === '0d0') return 0;
  const m = dmgStr.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return parseInt(dmgStr) || 0;
  const n = parseInt(m[1]), d = parseInt(m[2]), bonus = parseInt(m[3] || 0);
  return rngInst.roll(n, d) + bonus;
}
