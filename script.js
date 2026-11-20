/* ==================================================================
   A branch, a few leaves, a few insects.

   Pixel art drawn straight into a low-res buffer (one cell = PX css
   px) and scaled up. The branch is laid out once per resize; leaves
   and insects are redrawn over it every frame. No image assets.

   The picture follows the visitor's calendar and clock: blossom in
   spring, green in summer, turning leaves in autumn, a bare snowy
   branch in winter; after dark a moth and a firefly come out.
   (?season=spring|summer|autumn|winter and ?time=day|night preview
   the others.)
   ================================================================== */
(() => {
'use strict';

/* ---------- utilities ---------- */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => t * t * (3 - 2 * t);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const PX = 3; // one pixel-art cell, in css px
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const bandQuery = window.matchMedia('(max-width: 1000px)'); // matches the stylesheet

/* ---------- season and time of day, where the visitor is ---------- */

const query = new URLSearchParams(location.search);
const SEASON = (() => {
  const q = query.get('season');
  if (['spring', 'summer', 'autumn', 'winter'].includes(q)) return q;
  const m = new Date().getMonth(); // northern-hemisphere seasons
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
})();
const NIGHT = (() => {
  const q = query.get('time');
  if (q === 'night' || q === 'day') return q === 'night';
  const h = new Date().getHours();
  return h >= 20 || h < 6;
})();

/* ---------- palette: ink, and a few muted colours ---------- */

// '#rrggbb' → the ABGR word an ImageData buffer wants
const col = (hex) => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0; };

const PAPER = col('#ffffff');
const INK = col('#2a2623');
const BARK = col('#958b80');
const VERMILION = col('#b8452f');
const BLOSSOM = col('#d9a09a');
const UMBER = col('#7d4429');
const TEAL = col('#3f6f78');
const MUSTARD = col('#d0a443');
const WING = col('#b9b2a8');
const MOTH = col('#a89f92');
const PETAL = col('#e0a6a0');
const HEART = col('#c57f7c');
const SNOW = col('#c3ced9');
const FROST = col('#dbe3ea');
const DIM = col('#9a8a45');
const AMBER = col('#e3a52a');
const GLOW = col('#f5e7a9');
const LEAF = { // [main, shade]
  sage: [col('#95a585'), col('#6e8262')],
  moss: [col('#a9b297'), col('#808c71')],
  ochre: [col('#c9a35c'), col('#a47f3f')],
  rust: [col('#b8704a'), col('#93512f')],
  fresh: [col('#aec58a'), col('#86a364')],
};

/* ---------- the branch, in units of its own length ----------
   The origin is where it enters from the right edge; x runs left
   (negative), y runs down. Twigs are offsets from where they leave
   their parent. Leaf angles are screen degrees: 0 right, 90 down. */

const DESIGN = {
  main: [[0.06, 0.02], [-0.14, 0.0], [-0.3, 0.05], [-0.46, 0.03], [-0.62, 0.1], [-0.78, 0.12], [-0.93, 0.21], [-1.0, 0.31]],
  twigs: [
    { name: 'a', parent: 'main', at: 0.34, pts: [[-0.03, -0.1], [-0.1, -0.17], [-0.12, -0.27]] },
    { name: 'a2', parent: 'a', at: 0.42, pts: [[0.06, -0.06], [0.08, -0.13]] },
    { name: 'b', parent: 'main', at: 0.62, pts: [[-0.05, -0.08], [-0.13, -0.13], [-0.2, -0.14]] },
    { name: 'c', parent: 'main', at: 0.2, pts: [[-0.03, 0.09], [-0.08, 0.17], [-0.09, 0.26]] },
    { name: 'd', parent: 'main', at: 0.8, pts: [[-0.02, 0.07], [-0.06, 0.13]] },
    { name: 'e', parent: 'main', at: 0.5, pts: [[-0.01, -0.06]], fade: true },
  ],
  // each leaf's colour in summer and in autumn; `last` is the one still hanging on in winter
  leaves: [
    { seg: 'a', at: 1, ang: 248, len: 0.06, summer: 'sage', autumn: 'ochre' },
    { seg: 'a', at: 1, ang: 178, len: 0.05, summer: 'moss', autumn: 'moss' },
    { seg: 'a2', at: 1, ang: 300, len: 0.05, summer: 'moss', autumn: 'rust' },
    { seg: 'b', at: 1, ang: 188, len: 0.06, summer: 'sage', autumn: 'sage' },
    { seg: 'b', at: 0.6, ang: 262, len: 0.045, summer: 'ochre', autumn: 'ochre' },
    { seg: 'c', at: 1, ang: 104, len: 0.06, summer: 'sage', autumn: 'ochre' },
    { seg: 'c', at: 0.6, ang: 158, len: 0.05, summer: 'moss', autumn: 'rust', last: true },
    { seg: 'd', at: 1, ang: 122, len: 0.05, summer: 'sage', autumn: 'sage', bite: true },
    { seg: 'main', at: 1, ang: 112, len: 0.055, summer: 'moss', autumn: 'rust' },
  ],
  buds: [{ seg: 'e', at: 1 }, { seg: 'main', at: 0.71 }],
  blossoms: [
    { seg: 'e', at: 1 }, { seg: 'main', at: 0.71 }, { seg: 'a', at: 0.7 }, { seg: 'a2', at: 0.55 },
    { seg: 'b', at: 0.32 }, { seg: 'c', at: 0.3 }, { seg: 'd', at: 0.55 }, { seg: 'main', at: 0.9 },
  ],
};


/* ---------- scene state ---------- */

const scene = document.getElementById('scene');
const canvas = document.getElementById('branch');
const header = document.querySelector('.site-header');
const ctx = canvas.getContext('2d');

let Wc = 1, Hc = 1;          // buffer size, in cells
let img = null, frame = null; // what is shown
let base = null;              // the branch alone, drawn once
let grain = null;             // per-cell noise for the dissolve-in
let segs = [], root = null, leaves = [], bugs = [];
let falling = [], nextFall = Infinity; // leaves on their way down
let flakes = [], flakeX0 = 0;        // winter snowfall
let T0 = 0;

const put = (buf, x, y, c) => { if (x >= 0 && y >= 0 && x < Wc && y < Hc) buf[y * Wc + x] = c; };
const get = (buf, x, y) => (x >= 0 && y >= 0 && x < Wc && y < Hc ? buf[y * Wc + x] : 0);
let snowRng = Math.random;

/* ---------- geometry ---------- */

// Catmull-Rom through the control points, sampled every ~step cells
function spline(ctrl, step) {
  const out = [];
  const P = (i) => ctrl[clamp(i, 0, ctrl.length - 1)];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const n = Math.max(1, Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

// A walkable polyline on whole cells. Slightly irregular on purpose: a branch has kinks.
function makeSeg(name, ctrl, widthAt, fade, rng) {
  const raw = spline(ctrl, 5);
  const pts = [];
  raw.forEach((p, i) => {
    const j = i === 0 || i === raw.length - 1 ? 0 : 1.2;
    const q = { x: Math.round(p.x + (rng() - 0.5) * j), y: Math.round(p.y + (rng() - 0.5) * j) };
    const last = pts[pts.length - 1];
    if (!last || last.x !== q.x || last.y !== q.y) pts.push(q);
  });
  if (pts.length < 2) pts.push({ x: pts[0].x, y: pts[0].y - 1 });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { name, pts, cum, len: cum[cum.length - 1], widthAt, fade, parent: null, parentS: 0, children: [], visS: 0 };
}

// position and tangent at arc length s along a segment
function segPoint(seg, s) {
  s = clamp(s, 0, seg.len);
  let i = 0;
  while (i < seg.pts.length - 2 && seg.cum[i + 1] < s) i++;
  const a = seg.pts[i], b = seg.pts[i + 1], l = seg.cum[i + 1] - seg.cum[i] || 1, t = (s - seg.cum[i]) / l;
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), tx: (b.x - a.x) / l, ty: (b.y - a.y) / l };
}

/* ---------- building and drawing the branch ---------- */

function drawSeg(seg) {
  const cells = [];
  for (let i = 0; i < seg.pts.length - 1; i++) {
    const a = seg.pts[i], b = seg.pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let k = i ? 1 : 0; k <= n; k++) {
      cells.push({
        x: Math.round(a.x + dx * k / n), y: Math.round(a.y + dy * k / n),
        s: seg.cum[i] + (seg.cum[i + 1] - seg.cum[i]) * k / n, horiz: Math.abs(dx) >= Math.abs(dy),
      });
    }
  }
  cells.forEach((c, j) => {
    const fromEnd = cells.length - 1 - j;
    if (seg.fade && fromEnd < 6 && (fromEnd & 1)) return; // the tip dissolves into dots
    const w = seg.widthAt(c.s / seg.len);
    const ex = c.horiz ? 0 : 1, ey = c.horiz ? 1 : 0;
    put(base, c.x, c.y, INK);
    if (w >= 2) put(base, c.x + ex, c.y + ey, (c.x + c.y) & 1 ? INK : BARK); // dithered underside
    if (w >= 3) put(base, c.x - ex, c.y - ey, INK);
    // winter: snow lies along the top of whatever is level enough to hold it
    if (SEASON === 'winter' && c.horiz && snowRng() < 0.8) {
      const top = c.y - (w >= 3 ? 2 : 1);
      if (get(base, c.x, top) === PAPER) put(base, c.x, top, SNOW);
      if (snowRng() < 0.25 && get(base, c.x, top - 1) === PAPER) put(base, c.x, top - 1, FROST);
    }
  });
}

function build() {
  Wc = Math.max(1, Math.ceil(scene.clientWidth / PX));
  Hc = Math.max(1, Math.ceil(scene.clientHeight / PX));
  canvas.width = Wc; canvas.height = Hc;
  canvas.style.width = Wc * PX + 'px';
  canvas.style.height = Hc * PX + 'px';
  img = ctx.createImageData(Wc, Hc);
  frame = new Uint32Array(img.data.buffer);
  base = new Uint32Array(Wc * Hc).fill(PAPER);
  const g = mulberry32(5);
  grain = Float32Array.from({ length: Wc * Hc }, () => g());

  // where the branch goes: beside the text, or in the band above it
  const band = bandQuery.matches;
  let scale, ey;
  if (band) {
    scale = Math.min(Wc * 0.9, (Hc - 6) / 0.78);
    ey = Math.round(scale * 0.36) + 2;
  } else {
    const r = header.getBoundingClientRect();
    const x0 = (r.right - parseFloat(getComputedStyle(header).paddingRight) + 24) / PX;
    scale = clamp(Math.min((Wc - x0) * 0.95, Hc * 1.05), 60, 220);
    ey = Math.max(Math.round(Hc * 0.3), Math.round(scale * 0.34) + 3);
  }
  const origin = { x: Wc + 1, y: ey };
  const U = (p, o) => ({ x: o.x + p[0] * scale, y: o.y + p[1] * scale });

  const rng = mulberry32(11);
  snowRng = mulberry32(3);
  const mainWidth = scale > 110
    ? (f) => f < 0.45 ? 2 : 1
    : (f) => f < 0.25 ? 2 : 1;
  const byName = {};
  root = byName.main = makeSeg('main', DESIGN.main.map(p => U(p, origin)), mainWidth, false, rng);
  segs = [root];
  for (const t of DESIGN.twigs) {
    const parent = byName[t.parent];
    // leave the parent from one of its own vertices, so the join is exact
    let vi = 1;
    for (let i = 1; i < parent.pts.length - 1; i++) if (Math.abs(parent.cum[i] - t.at * parent.len) < Math.abs(parent.cum[vi] - t.at * parent.len)) vi = i;
    const o = parent.pts[vi];
    const seg = makeSeg(t.name, [o, ...t.pts.map(p => U(p, o))], () => 1, !!t.fade, rng);
    seg.parent = parent; seg.parentS = parent.cum[vi];
    parent.children.push(seg);
    byName[t.name] = seg;
    segs.push(seg);
  }
  root.visS = root.len;
  for (let i = 0; i < root.pts.length; i++) if (root.pts[i].x <= Wc - 5) { root.visS = root.cum[i]; break; }

  for (const seg of segs) drawSeg(seg);

  if (SEASON === 'spring') {
    // five-petalled blossom, in four pixels and a heart
    for (const b of DESIGN.blossoms) {
      const p = segPoint(byName[b.seg], b.at * byName[b.seg].len), x = Math.round(p.x), y = Math.round(p.y) - 2;
      put(base, x - 1, y, PETAL); put(base, x + 1, y, PETAL); put(base, x, y - 1, PETAL); put(base, x, y + 1, PETAL);
      put(base, x, y, HEART);
    }
  } else {
    for (const b of DESIGN.buds) {
      const p = segPoint(byName[b.seg], b.at * byName[b.seg].len), x = Math.round(p.x), y = Math.round(p.y);
      put(base, x, y - 1, BLOSSOM); put(base, x + 1, y - 1, BLOSSOM); put(base, x, y - 2, BLOSSOM);
    }
  }

  leaves = [];
  DESIGN.leaves.forEach((l, i) => {
    const tone = SEASON === 'spring' ? (i % 3 === 1 ? 'moss' : 'fresh')
      : SEASON === 'winter' ? (l.last ? 'rust' : null)
      : l[SEASON];
    if (!tone) return;
    const p = segPoint(byName[l.seg], l.at * byName[l.seg].len);
    const len = Math.max(SEASON === 'spring' ? 4 : 5, l.len * scale * (SEASON === 'spring' ? 0.8 : 1.15));
    leaves.push({
      x: p.x, y: p.y, ang: l.ang * Math.PI / 180, len, hw: Math.max(1.2, len * 0.24),
      tone: LEAF[tone], bite: !!l.bite, ph: rng() * TAU, kick: 0, kickV: 0, cool: 0,
      grow: 1, gone: false, back: 0,
    });
  });
  falling = [];

  flakeX0 = band ? 0 : Wc - scale * 1.15;
  flakes = SEASON === 'winter' && !REDUCED
    ? Array.from({ length: band ? 4 : 7 }, () => ({ x: rand(flakeX0, Wc), y: rand(0, Hc), v: rand(3.5, 6), ph: rand(0, TAU) }))
    : [];
}

/* ---------- leaves ---------- */

function paintLeaf(x0, y0, ang, len, hw, tone, bite, fade) {
  const ax = Math.cos(ang), ay = Math.sin(ang);
  const bx = x0 + ax, by = y0 + ay; // one cell of stalk, then the blade
  const tipX = bx + ax * len, tipY = by + ay * len, pad = hw + 1;
  const xa = Math.floor(Math.min(bx, tipX) - pad), xb = Math.ceil(Math.max(bx, tipX) + pad);
  const ya = Math.floor(Math.min(by, tipY) - pad), yb = Math.ceil(Math.max(by, tipY) + pad);
  const low = ax >= 0 ? 1 : -1; // which side of the midrib faces down
  const [main, shade] = tone;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const dx = x - bx, dy = y - by;
      const u = (dx * ax + dy * ay) / len;
      if (u < 0 || u > 1) continue;
      const v = -dx * ay + dy * ax;
      // widest a third of the way along, coming to a point
      const half = Math.max(0.5, hw * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.8));
      if (Math.abs(v) > half) continue;
      if (bite && Math.hypot(u * len - len * 0.55, v + low * hw) < hw * 0.75) continue; // something has been eating this one
      if (fade && y > Hc - 12 && ((x + y) & 1)) continue; // a falling leaf thins out as it leaves the picture
      const rib = hw >= 1.8 && Math.abs(v) < 0.5 && u < 0.82;
      const dither = v * low > 0.5 && ((x + y) & 1);
      put(frame, x, y, rib || dither ? shade : main);
    }
  }
}

function drawLeaf(lf, T) {
  if (lf.gone) return;
  const g = ease(clamp(lf.grow, 0, 1)), len = lf.len * g;
  if (len < 2.5) { // just a bud so far
    put(frame, Math.round(lf.x + Math.cos(lf.ang)), Math.round(lf.y + Math.sin(lf.ang)), lf.tone[0]);
    return;
  }
  const sway = REDUCED ? 0 : 0.045 * Math.sin(T * 0.6 + lf.ph) + 0.02 * Math.sin(T * 1.7 + lf.ph * 2);
  paintLeaf(lf.x, lf.y, lf.ang + sway + lf.kick, len, Math.max(1, lf.hw * g), lf.tone, lf.bite && g > 0.9, false);
}

// Now and then a leaf lets go and drifts down; a new one grows in its place.
// (The last leaf of winter stays where it is.)
const FALL_EVERY = SEASON === 'autumn' ? [25, 50] : [80, 160];
const REGROW_AFTER = SEASON === 'autumn' ? [45, 75] : [12, 22];

function updateFalling(dt, T) {
  if (SEASON !== 'winter' && T >= nextFall) {
    nextFall = T + rand(...FALL_EVERY);
    const ready = leaves.filter(l => !l.gone && l.grow >= 1);
    if (ready.length && leaves.length - ready.length < 2) {
      const lf = ready[(Math.random() * ready.length) | 0];
      lf.gone = true; lf.back = T + rand(...REGROW_AFTER);
      falling.push({ x: lf.x, y: lf.y, ang: lf.ang, len: lf.len, hw: lf.hw, tone: lf.tone, bite: lf.bite, ph: rand(0, TAU), t: 0 });
      nudgeLeaves(lf.x, lf.y, 0.5);
    }
  }
  for (const f of falling) {
    f.t += dt;
    f.y += (8 + 2 * Math.sin(f.t * 2.1 + f.ph)) * Math.min(1, f.t * 2) * dt;
    f.x += (Math.cos(f.t * 1.4 + f.ph) * 5 - 1.2) * Math.min(1, f.t) * dt;
  }
  falling = falling.filter(f => f.y - f.len < Hc + 2);

  for (const k of flakes) {
    k.y += k.v * dt;
    k.x += Math.sin(T * 0.7 + k.ph) * 1.2 * dt;
    if (k.y > Hc) { k.y = -1; k.x = rand(flakeX0, Wc); }
  }
}

function updateLeaves(dt, T, moving) {
  for (const lf of leaves) {
    lf.kickV += (-30 * lf.kick - 4 * lf.kickV) * dt;
    lf.kick += lf.kickV * dt;
    lf.cool -= dt;
    if (lf.gone) { if (T >= lf.back) { lf.gone = false; lf.grow = 0; } continue; }
    if (lf.grow < 1) lf.grow = Math.min(1, lf.grow + dt / 14);
    // brushing past a leaf with the cursor sets it swinging
    if (moving && lf.cool <= 0) {
      const cx = lf.x + Math.cos(lf.ang) * lf.len * 0.5, cy = lf.y + Math.sin(lf.ang) * lf.len * 0.5;
      if (Math.hypot(pointer.x - cx, pointer.y - cy) < lf.len * 0.6) {
        lf.kickV += clamp(pointer.speed * 0.004, 0.3, 1.1) * (Math.random() < 0.5 ? -1 : 1);
        lf.cool = 0.5;
      }
    }
  }
}
function nudgeLeaves(x, y, power) {
  for (const lf of leaves) if (Math.hypot(lf.x - x, lf.y - y) < 10) lf.kickV += power * (Math.random() < 0.5 ? -1 : 1);
}

/* ---------- insects ----------
   On the branch a sprite is a list of [f, u, colour]: f cells toward
   the head, u cells out from the bark (row 0 is the legs). In the air
   it is [x, y, colour], drawn upright. */

const I = INK, V = VERMILION, Tl = TEAL, M = MUSTARD, W = WING, A = UMBER, Mo = MOTH;
const lookup = (cells) => new Map(cells.map(([f, u, c]) => [(f + 8) * 32 + u + 8, c]));

const KINDS = {
  ant: {
    speed: 7, flies: false, stride: 1.3, restEvery: [3, 9], restFor: [0.4, 1.4],
    body: lookup([[-2, 1, A], [-1, 1, A], [0, 1, A], [1, 1, A], [-2, 2, A], [2, 2, A]]),
    legs: [lookup([[-1, 0, A], [1, 0, A]]), lookup([[-2, 0, A], [0, 0, A]])],
  },
  ladybird: {
    speed: 2.6, flies: true, stride: 1, restEvery: [4, 10], restFor: [2, 6], flyChance: 0.45, flySpeed: 50, flapHz: 14,
    body: lookup([[-1, 1, V], [0, 1, V], [1, 1, V], [-1, 2, V], [0, 2, V], [2, 1, I]]),
    legs: [lookup([[-1, 0, I], [1, 0, I]]), lookup([[0, 0, I], [2, 0, I]])],
    flyBody: [[0, 0, V], [1, 0, V], [2, 0, I]],
    wings: [[[0, -1, W], [1, -1, W]], [[0, 1, W], [1, 1, W]]],
  },
  beetle: {
    speed: 2, flies: true, stride: 1, restEvery: [5, 12], restFor: [3, 8], flyChance: 0.3, flySpeed: 42, flapHz: 14,
    body: lookup([[-2, 1, Tl], [-1, 1, Tl], [0, 1, Tl], [-1, 2, Tl], [1, 1, I]]),
    legs: [lookup([[-2, 0, I], [0, 0, I]]), lookup([[-1, 0, I], [1, 0, I]])],
    flyBody: [[-1, 0, Tl], [0, 0, Tl], [1, 0, Tl], [2, 0, I]],
    wings: [[[0, -1, W], [1, -1, W]], [[0, 1, W], [1, 1, W]]],
  },
  butterfly: {
    speed: 0.9, flies: true, stride: 1, restEvery: [2, 5], restFor: [5, 14], flyChance: 0.8, flySpeed: 22, flapHz: 7, flutter: true, tips: true,
    body: lookup([[-1, 1, I], [0, 1, I], [1, 1, I], [0, 0, I], [-1, 2, M], [0, 2, M], [-1, 3, M], [0, 3, M], [-1, 4, M]]), // wings closed
    open: lookup([[-1, 1, I], [0, 1, I], [1, 1, I], [0, 0, I], [-2, 2, M], [-1, 2, M], [0, 2, M], [1, 2, M]]),          // basking
    flyBody: [[0, 0, I]],
    wings: [
      [[-1, -1, M], [1, -1, M], [-1, -2, M], [1, -2, M]],
      [[-2, 0, M], [-1, 0, M], [1, 0, M], [2, 0, M]],
      [[-1, 1, M], [1, 1, M]],
      [[-2, 0, M], [-1, 0, M], [1, 0, M], [2, 0, M]],
    ],
  },
  // after dark
  moth: {
    speed: 0.9, flies: true, stride: 1, restEvery: [2, 5], restFor: [5, 14], flyChance: 0.8, flySpeed: 22, flapHz: 8, flutter: true, tips: true,
    body: lookup([[-1, 1, I], [0, 1, I], [1, 1, I], [0, 0, I], [-2, 2, Mo], [-1, 2, Mo], [0, 2, Mo], [1, 2, Mo], [-1, 3, Mo], [0, 3, Mo]]), // wings held like a tent
    flyBody: [[0, 0, I]],
    wings: [
      [[-1, -1, Mo], [1, -1, Mo], [-1, -2, Mo], [1, -2, Mo]],
      [[-2, 0, Mo], [-1, 0, Mo], [1, 0, Mo], [2, 0, Mo]],
      [[-1, 1, Mo], [1, 1, Mo]],
      [[-2, 0, Mo], [-1, 0, Mo], [1, 0, Mo], [2, 0, Mo]],
    ],
  },
  firefly: {
    speed: 2.2, flies: true, stride: 1, restEvery: [3, 7], restFor: [2, 6], flyChance: 0.75, flySpeed: 15, flapHz: 14, flutter: true, glow: true,
    body: lookup([[-2, 1, DIM], [-1, 1, I], [0, 1, I], [1, 1, I]]),
    legs: [lookup([[-1, 0, I], [1, 0, I]]), lookup([[0, 0, I]])],
    lit: lookup([[-2, 1, AMBER], [-3, 1, GLOW], [-2, 2, GLOW], [-2, 0, GLOW]]), // the tail lamp and its halo
    flyBody: [[-1, 0, DIM], [0, 0, I], [1, 0, I]],
    flyLit: [[-1, 0, AMBER], [-2, 0, GLOW], [-1, -1, GLOW], [-1, 1, GLOW]],
    wings: [[[0, -1, W], [1, -1, W]], [[0, 1, W], [1, 1, W]]],
  },
};

function stamp(map, ax, ay, dx, dy, nx, ny) {
  const x0 = Math.floor(ax) - 6, y0 = Math.floor(ay) - 6;
  for (let y = y0; y <= y0 + 12; y++) {
    for (let x = x0; x <= x0 + 12; x++) {
      const rx = x - ax, ry = y - ay;
      const c = map.get((Math.round(rx * dx + ry * dy) + 8) * 32 + Math.round(rx * nx + ry * ny) + 8);
      if (c !== undefined) put(frame, x, y, c);
    }
  }
}

// somewhere to land: preferably another twig, away from the cursor, not on top of anyone
function perch(bug, { away = null, notSeg = null } = {}) {
  let best = null, bestScore = -Infinity;
  const total = segs.reduce((a, s) => a + s.len, 0);
  for (let i = 0; i < 12; i++) {
    let r = Math.random() * total, seg = segs[0];
    for (const s of segs) { if (r < s.len) { seg = s; break; } r -= s.len; }
    const lo = seg === root ? Math.max(root.visS + 4, seg.len * 0.2) : seg.len * (bug.spec.tips ? 0.8 : 0.3);
    const s = rand(Math.min(lo, seg.len), seg.len);
    const p = segPoint(seg, s);
    if (p.x < 3 || p.x > Wc - 4 || p.y < 4 || p.y > Hc - 3) continue;
    let score = Math.random() * 10;
    if (seg === notSeg) score -= 30;
    if (away) score += Math.min(60, Math.hypot(p.x - away.x, p.y - away.y));
    for (const o of bugs) if (o !== bug && o.state !== 'away' && Math.hypot(o.x - p.x, o.y - p.y) < 7) score -= 20;
    if (score > bestScore) { bestScore = score; best = { seg, s, x: p.x, y: p.y - 2 }; }
  }
  return best;
}

class Bug {
  constructor(kind, delay) {
    this.kind = kind; this.spec = KINDS[kind];
    this.state = 'away'; this.timer = delay; // away | walk | rest | fly
    this.seg = null; this.s = 0; this.dir = 1; this.side = -1;
    this.x = -99; this.y = -99; this.dx = 1; this.dy = 0; this.nx = 0; this.ny = -1;
    this.odo = 0; this.nextRest = rand(...this.spec.restEvery);
    this.calm = 0; this.boost = 0; this.meet = 0; this.called = false;
    this.ph = rand(0, TAU); this.heading = -1; this.fly = null;
  }
  get onBranch() { return this.state === 'walk' || this.state === 'rest'; }

  // ants walk in along the branch; the others fly in from beyond the edge
  arrive() {
    if (!this.spec.flies) { this.seg = root; this.s = 0; this.dir = 1; this.state = 'walk'; this.place(); return; }
    if (Math.random() < 0.5) { this.x = Wc + 4; this.y = rand(Hc * 0.05, Hc * 0.5); }
    else { this.x = rand(Wc * 0.6, Wc); this.y = -4; }
    if (!this.flyTo(perch(this))) this.timer = 2;
  }

  sit(seg, s, restFor) {
    this.seg = seg; this.s = s; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.state = 'rest'; this.timer = restFor;
    this.place();
  }

  flyTo(t) {
    if (!t) return false;
    const d = Math.hypot(t.x - this.x, t.y - this.y);
    this.fly = {
      ax: this.x, ay: this.y, bx: t.x, by: t.y,
      cx: (this.x + t.x) / 2 + rand(-0.15, 0.15) * d, cy: Math.min(this.y, t.y) - 4 - d * rand(0.15, 0.3),
      t: 0, dur: Math.max(0.5, d / this.spec.flySpeed), seg: t.seg, s: t.s,
    };
    this.state = 'fly';
    return true;
  }

  // the cursor came too close: fliers leave for another twig, ants run
  startle(from) {
    if (this.spec.flies) {
      nudgeLeaves(this.x, this.y, 0.4);
      this.called = false;
      this.flyTo(perch(this, { away: from, notSeg: this.seg }));
    } else {
      const a = segPoint(this.seg, this.s + 2), b = segPoint(this.seg, this.s - 2);
      this.dir = Math.hypot(a.x - from.x, a.y - from.y) >= Math.hypot(b.x - from.x, b.y - from.y) ? 1 : -1;
      this.boost = 1.4; this.state = 'walk';
    }
  }

  update(dt, T, moving) {
    const k = this.spec;
    if (this.state === 'away') { this.timer -= dt; if (this.timer <= 0) this.arrive(); return; }

    if (this.state === 'fly') {
      const f = this.fly;
      f.t += dt / f.dur;
      if (f.t >= 1) {
        // touch down; a called insect stays put while the cursor keeps still
        this.sit(f.seg, f.s, this.called ? rand(3, 6) : rand(1.2, 3));
        this.calm = this.called ? 3 : 0.6;
        this.called = false;
        nudgeLeaves(this.x, this.y, 0.7);
        return;
      }
      const e = ease(f.t), u = 1 - e;
      let x = u * u * f.ax + 2 * u * e * f.cx + e * e * f.bx;
      let y = u * u * f.ay + 2 * u * e * f.cy + e * e * f.by;
      if (k.flutter) {
        const w = Math.sin(Math.PI * e);
        x += Math.sin(T * 5.1 + this.ph) * 1.4 * w;
        y += Math.sin(T * 8.3 + this.ph) * 1.8 * w;
      }
      if (Math.abs(f.bx - f.ax) > 1) this.heading = f.bx > f.ax ? 1 : -1;
      this.x = x; this.y = y;
      return;
    }

    this.calm -= dt; this.boost -= dt; this.meet -= dt;
    if (moving && this.calm <= 0 && Math.hypot(pointer.x - this.x, pointer.y - this.y) < 9) {
      this.startle(pointer);
      if (this.state === 'fly') return;
    }

    if (this.state === 'rest') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (k.flies && Math.random() < k.flyChance && this.flyTo(perch(this, { notSeg: this.seg }))) return;
        this.state = 'walk';
        if (Math.random() < 0.3) this.dir = -this.dir;
      }
    } else {
      this.walk(dt);
    }
    if (this.onBranch) this.place();
  }

  walk(dt) {
    const k = this.spec, seg = this.seg;
    const v = k.speed * (this.boost > 0 ? 3.2 : 1);
    const prev = this.s;
    this.s += this.dir * v * dt;
    this.odo += v * dt;

    // turn off onto a twig we are passing
    if (this.boost <= 0) {
      for (const c of seg.children) {
        if (((prev < c.parentS && this.s >= c.parentS) || (prev > c.parentS && this.s <= c.parentS)) && Math.random() < 0.45) {
          this.seg = c; this.s = 0.01; this.dir = 1;
          return;
        }
      }
    }

    if (this.s >= seg.len) {
      // the tip: have a look, then turn back
      this.s = seg.len; this.dir = -1;
      this.state = 'rest'; this.timer = rand(0.5, 1.5) * (this.boost > 0 ? 0.2 : 1);
    } else if (seg.parent && this.s <= 0) {
      this.seg = seg.parent; this.s = seg.parentS;
      this.dir = Math.random() < 0.5 ? -1 : 1;
    } else if (seg === root && k.flies && this.s <= root.visS + 3) {
      this.s = root.visS + 3; this.dir = 1;
    } else if (seg === root && this.s <= 0) {
      // ants wander off toward the trunk and come back later
      this.state = 'away'; this.timer = rand(6, 20); this.x = this.y = -99;
      return;
    }

    if (this.boost <= 0 && (this.nextRest -= dt) <= 0) {
      this.state = 'rest'; this.timer = rand(...k.restFor);
      this.nextRest = rand(...k.restEvery);
    }

    // two ants that meet stop to touch antennae
    if (!k.flies && this.meet <= 0) {
      for (const o of bugs) {
        if (o !== this && !o.spec.flies && o.state === 'walk' && o.meet <= 0 && o.seg === this.seg && Math.abs(o.s - this.s) < 4) {
          for (const b of [this, o]) { b.state = 'rest'; b.timer = rand(0.7, 1.2); b.meet = 8; }
          this.dir = o.s > this.s ? 1 : -1; o.dir = -this.dir;
        }
      }
    }
  }

  // stand on the bark: find the upper side of the branch here and face along it
  place() {
    const p = segPoint(this.seg, this.s);
    const a = Math.round(Math.atan2(p.ty, p.tx) / (Math.PI / 8)) * (Math.PI / 8);
    const c = Math.cos(a), s = Math.sin(a);
    let nx = s * this.side, ny = -c * this.side;
    if (ny > 0.35) { this.side = -this.side; nx = -nx; ny = -ny; }
    const w = this.seg.widthAt(this.s / this.seg.len);
    const horiz = Math.abs(p.tx) >= Math.abs(p.ty);
    const extra = w >= 3 ? 1 : w === 2 && (horiz ? ny > 0 : nx > 0) ? 1 : 0;
    this.x = p.x + nx * (extra + 1); this.y = p.y + ny * (extra + 1);
    this.dx = c * this.dir; this.dy = s * this.dir; this.nx = nx; this.ny = ny;
  }

  draw(T) {
    const k = this.spec;
    const lit = k.glow && (REDUCED || (T * 0.4 + this.ph) % 1 < 0.24); // a firefly's slow blink
    if (this.state === 'fly') {
      const x = Math.round(this.x), y = Math.round(this.y), h = this.heading;
      for (const [cx, cy, c] of k.flyBody) put(frame, x + cx * h, y + cy, c);
      for (const [cx, cy, c] of k.wings[Math.floor(T * k.flapHz + this.ph) % k.wings.length]) put(frame, x + cx * h, y + cy, c);
      if (lit) for (const [cx, cy, c] of k.flyLit) put(frame, x + cx * h, y + cy, c);
      return;
    }
    // a resting butterfly opens its wings now and then
    const body = k.open && this.state === 'rest' && (T * 0.5 + this.ph) % 6 < 0.5 ? k.open : k.body;
    stamp(body, this.x, this.y, this.dx, this.dy, this.nx, this.ny);
    if (k.legs) stamp(k.legs[this.state === 'walk' ? Math.floor(this.odo / k.stride) & 1 : 0], this.x, this.y, this.dx, this.dy, this.nx, this.ny);
    if (lit) stamp(k.lit, this.x, this.y, this.dx, this.dy, this.nx, this.ny);
  }
}

// who is about depends on the season and the hour
function makeBugs() {
  const band = bandQuery.matches;
  const drifter = NIGHT ? 'moth' : 'butterfly', other = NIGHT ? 'firefly' : 'beetle';
  if (SEASON === 'winter') {
    return band
      ? [new Bug('ant', 1.4), new Bug('ladybird', 2)]
      : [new Bug('ant', 1.4), new Bug('ladybird', 2), new Bug(NIGHT ? 'moth' : 'beetle', 4)];
  }
  return band
    ? [new Bug('ant', 1.4), new Bug(NIGHT ? 'firefly' : 'ladybird', 2), new Bug(drifter, 3.2)]
    : [new Bug('ant', 1.4), new Bug('ant', 7), new Bug('ladybird', 2), new Bug(drifter, 3.2), new Bug(other, 5)];
}

// put everyone straight onto the branch (after a resize, or for a still picture)
function settle() {
  bugs.forEach((b, i) => {
    if (b.spec.flies) { const p = perch(b); if (p) b.sit(p.seg, p.s, rand(1, 5)); }
    else if (i === 0) { b.seg = root; b.s = rand(root.visS, root.len * 0.7); b.dir = 1; b.state = 'walk'; b.place(); }
  });
}

/* ---------- interaction ----------
   Move the cursor close and they take off (ants run). Click a twig
   and the nearest flier comes over to land there; it stays as long
   as the cursor keeps still. */

const pointer = { x: -999, y: -999, speed: 0, last: -9 };
const toCell = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / PX, y: (e.clientY - r.top) / PX }; };

window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return; // a scrolling finger is not a cursor
  const p = toCell(e), now = performance.now() / 1000, dt = Math.max(0.008, now - pointer.last);
  const v = Math.hypot(p.x - pointer.x, p.y - pointer.y) / dt;
  pointer.speed = dt > 0.3 ? 0 : lerp(pointer.speed, v, 0.5);
  pointer.x = p.x; pointer.y = p.y; pointer.last = now;
}, { passive: true });

window.addEventListener('pointerdown', (e) => {
  if (REDUCED || (e.target.closest && e.target.closest('a'))) return;
  const p = toCell(e);
  let startled = false;
  for (const b of bugs) if (b.onBranch && Math.hypot(b.x - p.x, b.y - p.y) < 9) { b.startle(p); startled = true; }
  if (startled) return;

  // the nearest spot on the branch, if the click was close to it
  let spot = null, near = 14;
  for (const seg of segs) {
    for (let s = seg === root ? root.visS : 0; s <= seg.len; s += 1) {
      const q = segPoint(seg, s), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < near) { near = d; spot = { seg, s, x: q.x, y: q.y - 2 }; }
    }
  }
  if (!spot) return;
  const fliers = bugs.filter(b => b.spec.flies);
  const here = fliers.filter(b => b.state !== 'away');
  let who = null;
  if (here.length) who = here.reduce((a, b) => Math.hypot(a.x - p.x, a.y - p.y) <= Math.hypot(b.x - p.x, b.y - p.y) ? a : b);
  else if (fliers.length) { who = fliers[0]; who.x = Wc + 4; who.y = rand(Hc * 0.05, Hc * 0.5); } // nobody has arrived yet: one comes early
  if (who) { who.called = true; who.flyTo(spot); }
});

/* ---------- loop ---------- */

function render(T) {
  frame.set(base);
  for (const k of flakes) { const x = Math.round(k.x), y = Math.round(k.y); if (get(frame, x, y) === PAPER) put(frame, x, y, SNOW); }
  for (const lf of leaves) drawLeaf(lf, T);
  for (const f of falling) paintLeaf(f.x, f.y, f.ang + 0.9 * Math.min(1, f.t) * Math.sin(f.t * 1.4 + f.ph), f.len, f.hw, f.tone, f.bite, true);
  for (const b of bugs) if (b.onBranch) b.draw(T);
  for (const b of bugs) if (b.state === 'fly') b.draw(T);
  // on load the picture settles in out of scattered dots
  const p = REDUCED ? 1 : (T - T0) / 1.1;
  if (p < 1) for (let i = 0; i < frame.length; i++) if (frame[i] !== PAPER && grain[i] > p) frame[i] = PAPER;
  ctx.putImageData(img, 0, 0);
}

let lastT = 0;
function tick(now) {
  const T = now / 1000, dt = Math.min(0.05, Math.max(0, T - lastT));
  lastT = T;
  const moving = T - pointer.last < 0.15 && pointer.speed > 10;
  updateLeaves(dt, T, moving);
  updateFalling(dt, T);
  for (const b of bugs) b.update(dt, T, moving);
  render(T);
  requestAnimationFrame(tick);
}

let booted = false;
function boot() {
  booted = true;
  build();
  bugs = makeBugs();
  T0 = lastT = performance.now() / 1000;
  nextFall = T0 + (SEASON === 'autumn' ? rand(8, 18) : rand(30, 60));
  if (REDUCED) { settle(); render(T0); }
  else requestAnimationFrame(tick);
}

// a page opened in a hidden or zero-sized frame waits until it has a size
const sized = () => scene.clientWidth > 0 && scene.clientHeight > 0;
if (sized()) boot();

let resizeTimer = 0;
window.addEventListener('resize', () => {
  if (!booted) { if (sized()) boot(); return; }
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!sized()) return;
    build();
    bugs = makeBugs();
    settle();
    if (REDUCED) render(performance.now() / 1000);
  }, 150);
});

})();
