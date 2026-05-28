// =============================================
// LINE OF SIGHT — Recursive Shadowcasting
// Faithful to DCSS LOS algorithm (radius 8)
// =============================================

const LOS_RADIUS = 8;

// Octant transformations for shadowcasting
const TRANSFORMS = [
  [1,0,0,-1], [-1,0,0,-1], [1,0,0,1], [-1,0,0,1],
  [0,1,-1,0], [0,-1,-1,0], [0,1,1,0], [0,-1,1,0]
];

function castLight(visible, map, cx, cy, row, startSlope, endSlope, xx, xy, yx, yy) {
  if (startSlope < endSlope) return;
  let nextStartSlope = startSlope;

  for (let i = row; i <= LOS_RADIUS; i++) {
    let dx = -i - 1, dy = -i;
    let blocked = false;

    while (dx <= 0) {
      dx++;
      const X = cx + dx * xx + dy * xy;
      const Y = cy + dx * yx + dy * yy;

      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);

      if (startSlope < rSlope) continue;
      if (endSlope > lSlope) break;

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= LOS_RADIUS) {
        const key = `${X},${Y}`;
        visible.add(key);
      }

      if (blocked) {
        if (map.isOpaque(X, Y)) {
          nextStartSlope = rSlope;
          continue;
        } else {
          blocked = false;
          startSlope = nextStartSlope;
        }
      } else {
        if (map.isOpaque(X, Y) && i < LOS_RADIUS) {
          blocked = true;
          castLight(visible, map, cx, cy, i + 1, startSlope, lSlope, xx, xy, yx, yy);
          nextStartSlope = rSlope;
        }
      }
    }
    if (blocked) break;
  }
}

export function computeLOS(cx, cy, mapObj) {
  const visible = new Set();
  visible.add(`${cx},${cy}`);

  for (const [xx, xy, yx, yy] of TRANSFORMS) {
    castLight(visible, mapObj, cx, cy, 1, 1.0, 0.0, xx, xy, yx, yy);
  }

  return visible;
}

export function isVisible(visSet, x, y) {
  return visSet.has(`${x},${y}`);
}
