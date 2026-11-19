/* ==================================================================
   Dithered pond
   Lily pads, koi, shrimp, tadpoles and damselflies, rendered as 1-bit
   stipple on white. Everything is generated at load: no image assets.

   Each frame the whole scene is drawn in greyscale into a low-res
   "tone" canvas (one cell per PX css px), then thresholded against a
   fixed noise map into pure black-and-white pixels.

   Layers (back → front):
     #dither   the 1-bit scene (pixelated, scaled up)
     #overlay  crisp tracking hulls, ID tags, click reticles, HUD
     #app      text
   ================================================================== */
(() => {
'use strict';

/* ---------- utilities ---------- */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const rand = (a, b) => a + Math.random() * (b - a);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0, v = 0;
  while (!u) u = rng();
  while (!v) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

// Smooth 1D value noise in [-1, 1]
const NOISE = (() => { const r = mulberry32(7); return Float32Array.from({ length: 512 }, () => r() * 2 - 1); })();
function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(NOISE[i & 511], NOISE[(i + 1) & 511], u);
}
const fbm1 = (x) => noise1(x) * 0.6 + noise1(x * 2.13 + 17.3) * 0.28 + noise1(x * 4.71 + 41.1) * 0.12;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

const DPR = 1; // offscreen art is painted at css-pixel resolution, then dithered
const SCREEN_DPR = Math.min(2, window.devicePixelRatio || 1); // for the crisp overlay
const PX = 2; // size of one dither cell, in css px
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- palette ---------- */

const INK = [34, 35, 31];
// only luminance survives the dither, so creature palettes are greys tuned for dot density
const VERMILION = { main: [44, 44, 44], deep: [8, 8, 8], light: [120, 120, 120] };

// Fine grain used to granulate the watercolour washes
function makeGrainTile(size) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rng = mulberry32(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const dark = rng() < 0.55;
    const v = dark ? 20 : 250;
    img.data[i] = v; img.data[i + 1] = v - (dark ? 0 : 6); img.data[i + 2] = v - (dark ? 4 : 18);
    img.data[i + 3] = (rng() * rng()) * (dark ? 120 : 90);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ==================================================================
   Watercolour primitives (recursive polygon deformation, layered
   at low opacity — the classic generative watercolour technique)
   ================================================================== */

function deform(pts, iterations, rng, k = 0.42) {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const out = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i], b = cur[(i + 1) % cur.length];
      out.push(a);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const v = (a.v + b.v) * 0.5;
      out.push({
        x: (a.x + b.x) * 0.5 + gauss(rng) * len * v * k,
        y: (a.y + b.y) * 0.5 + gauss(rng) * len * v * k,
        v: v * (0.78 + rng() * 0.4),
      });
    }
    cur = out;
  }
  return cur;
}
function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
function blobBase(cx, cy, r, n, v, rng) {
  const pts = [];
  const a0 = rng() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU, rr = r * (0.82 + rng() * 0.36);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, v: v * (0.6 + rng() * 0.8) });
  }
  return pts;
}
function watercolor(ctx, base, { layers, alpha, color, rng, pre = 2, per = 3 }) {
  const shape = deform(base, pre, rng);
  ctx.fillStyle = rgba(color, alpha);
  for (let l = 0; l < layers; l++) {
    polyPath(ctx, deform(shape, per, rng));
    ctx.fill();
  }
}

// A filled, tapering brush stroke along a polyline
function ribbon(ctx, pts, w0, w1, wobble = null) {
  const n = pts.length;
  if (n < 2) return;
  const L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1e-6; tx /= tl; ty /= tl;
    const t = i / (n - 1);
    let w = lerp(w0, w1, t) * 0.5;
    if (wobble) w *= wobble(t);
    L.push(pts[i].x - ty * w, pts[i].y + tx * w);
    Rr.push(pts[i].x + ty * w, pts[i].y - tx * w);
  }
  ctx.beginPath();
  ctx.moveTo(L[0], L[1]);
  for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
  for (let i = Rr.length - 2; i >= 0; i -= 2) ctx.lineTo(Rr[i], Rr[i + 1]);
  ctx.closePath();
  ctx.fill();
}

// A soft wash for small creatures: a few ragged polygons stacked at low opacity.
// `jit` is a fixed noise table so the shape keeps its character from frame to frame.
function softBlob(ctx, x, y, rx, ry, rot, jit, layers, { egg = 0, off = 0, amt = 0.16 } = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  layers.forEach(([k, style], l) => {
    ctx.fillStyle = style;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * TAU, ct = Math.cos(t);
      const r = k * (1 + jit[(off + l * 16 + i) % jit.length] * amt);
      const px = ct * rx * r, py = Math.sin(t) * ry * r * (1 - egg * ct);
      const X = x + px * c - py * s, Y = y + px * s + py * c;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.closePath();
    ctx.fill();
  });
}
const jitTable = (n = 96) => Float32Array.from({ length: n }, () => clamp(gauss(Math.random) * 0.6, -1.4, 1.4));

/* ==================================================================
   Lotus leaf
   ================================================================== */

const LEAF_PAD = 1.2; // canvas size relative to leaf diameter (room for bleeding rim)
const LEAF_TONE = 0.72; // pads sit a little lighter than the creatures

function paintLeaf(R, seed, grainTile) {
  const rng = mulberry32(seed);
  const sizeCss = Math.ceil(R * 2 * LEAF_PAD);
  const canvas = makeCanvas(sizeCss * DPR, sizeCss * DPR);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const C = sizeCss / 2;

  const notch = rng() * TAU;
  const half = 0.17 + rng() * 0.1;
  const nx = Math.cos(notch), ny = Math.sin(notch);
  const rimSeed = rng() * 200;
  const span = TAU - 2 * half;
  const rimR = (a) => {
    const t = ((a - notch - half) % TAU + TAU) % TAU / span;
    return R * (1 + 0.04 * noise1(rimSeed + t * 22) + 0.015 * noise1(rimSeed * 3 + t * 70));
  };
  const inNotch = (a, extra = 0.08) => Math.abs(angDiff(a, notch)) < half + extra;

  // Leaf outline, with the notch running in to the centre
  const outline = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = notch + half + (i / n) * span;
    const r = rimR(a);
    outline.push({ x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, v: 0.2 });
  }
  const tip = { x: C + nx * R * 0.04, y: C + ny * R * 0.04, v: 0.03 };
  const first = outline[0], last = outline[outline.length - 1];
  for (let k = 1; k <= 4; k++) { const t = k / 5; outline.push({ x: lerp(last.x, tip.x, t), y: lerp(last.y, tip.y, t), v: 0.05 }); }
  outline.push(tip);
  for (let k = 1; k <= 4; k++) { const t = k / 5; outline.push({ x: lerp(tip.x, first.x, t), y: lerp(tip.y, first.y, t), v: 0.05 }); }

  const scaled = (pts, s) => pts.map(p => ({ x: C + (p.x - C) * s, y: C + (p.y - C) * s, v: p.v }));

  // 1. white underlayer: makes the pad (mostly) opaque so fish pass beneath it
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.92;
  polyPath(ctx, deform(scaled(outline, 0.955), 2, rng)); ctx.fill();
  ctx.globalAlpha = 1;

  // 2. base washes, multiplied like pigment on paper
  ctx.globalCompositeOperation = 'multiply';
  const body = deform(outline, 2, rng);
  const washes = [[176, 180, 138], [158, 168, 130], [168, 172, 128]];
  for (const col of washes) {
    ctx.fillStyle = rgba(col, 0.05);
    for (let l = 0; l < 8; l++) { polyPath(ctx, deform(body, 3, rng)); ctx.fill(); }
  }

  // 3. mottling, dark pools and lifted lights, held inside the leaf
  ctx.save();
  polyPath(ctx, scaled(body, 1.01)); ctx.clip();

  // olive, sage, ochre and blue-grey patches, each with blossoming edges
  const mottles = [[112, 126, 96], [136, 148, 104], [100, 112, 98], [170, 168, 112], [124, 136, 128], [150, 156, 110], [92, 104, 84]];
  for (let i = 0; i < 34; i++) {
    const a = rng() * TAU, rr = R * Math.sqrt(rng()) * 0.92;
    if (inNotch(a) && rr > R * 0.1) continue;
    const r = R * (0.09 + rng() * 0.2);
    watercolor(ctx, blobBase(C + Math.cos(a) * rr, C + Math.sin(a) * rr, r, 9, 0.65, rng), {
      layers: 7, alpha: 0.045 + rng() * 0.02, color: mottles[(rng() * mottles.length) | 0], rng,
    });
  }
  const darkSectors = [notch + Math.PI * (0.45 + rng() * 0.6) * (rng() < 0.5 ? 1 : -1)];
  darkSectors.push(darkSectors[0] + Math.PI * (0.7 + rng() * 0.5));
  darkSectors.forEach((sector, si) => {
    const count = si === 0 ? 10 : 5;
    for (let i = 0; i < count; i++) {
      const a = sector + gauss(rng) * 0.55;
      if (inNotch(a)) continue;
      const rr = R * (0.5 + rng() * 0.42), r = R * (0.08 + rng() * 0.15);
      watercolor(ctx, blobBase(C + Math.cos(a) * rr, C + Math.sin(a) * rr, r, 9, 0.7, rng), {
        layers: 9, alpha: si === 0 ? 0.06 : 0.045, color: [44, 48, 42], rng,
      });
    }
  });
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 9; i++) {
    const a = rng() * TAU, rr = R * (0.2 + rng() * 0.65), r = R * (0.06 + rng() * 0.13);
    watercolor(ctx, blobBase(C + Math.cos(a) * rr, C + Math.sin(a) * rr, r, 8, 0.7, rng), {
      layers: 6, alpha: 0.06, color: [244, 241, 228], rng,
    });
  }
  ctx.restore();

  // 4. granulation
  ctx.globalCompositeOperation = 'source-atop';
  const gp = ctx.createPattern(grainTile, 'repeat');
  gp.setTransform(new DOMMatrix().scaleSelf(1 / DPR));
  ctx.fillStyle = gp;
  ctx.fillRect(0, 0, sizeCss, sizeCss);

  // 5. dry-brush rim: broken hairs of ink around the edge
  ctx.globalCompositeOperation = 'multiply';
  ctx.lineCap = 'round';
  const steps = Math.round((TAU * R) / 2.6);
  for (let s = 0; s < steps; s++) {
    const t = s / steps;
    const a = notch + half * 1.03 + t * (TAU - 2.06 * half - 21 / R);
    const pressure = smoothstep(-0.25, 0.55, fbm1(rimSeed + t * 11));
    if (pressure < 0.03) continue;
    const hairs = 1 + ((rng() * 4) | 0);
    for (let h = 0; h < hairs; h++) {
      if (rng() > 0.35 + 0.6 * pressure) continue;
      const r = rimR(a) * (0.975 + gauss(rng) * 0.011 + h * 0.008);
      const arc = (3 + rng() * 17) / R;
      ctx.strokeStyle = rgba(INK, (0.18 + 0.62 * pressure) * (0.45 + 0.55 * rng()));
      ctx.lineWidth = 0.45 + rng() * 2.2 * pressure;
      ctx.beginPath(); ctx.arc(C, C, r, a, a + arc); ctx.stroke();
    }
  }
  // flicks of the brush just outside the rim
  for (let i = 0; i < 18; i++) {
    const a = rng() * TAU;
    if (inNotch(a, 0.04) || inNotch(a + 28 / R, 0.04)) continue;
    const r = rimR(a) * (1.0 + rng() * 0.05), arc = (6 + rng() * 22) / R;
    ctx.strokeStyle = rgba(INK, 0.12 + rng() * 0.3);
    ctx.lineWidth = 0.4 + rng() * 0.9;
    ctx.beginPath(); ctx.arc(C, C, r, a, a + arc); ctx.stroke();
  }
  // the notch edges
  for (const side of [-1, 1]) {
    const a = notch + side * half;
    for (let h = 0; h < 5; h++) {
      const r0 = R * (0.4 + rng() * 0.4), r1 = R * (0.95 + rng() * 0.04);
      const off = side * (h * 0.8 + gauss(rng) * 0.5);
      const px = -Math.sin(a) * off, py = Math.cos(a) * off;
      ctx.strokeStyle = rgba(INK, 0.12 + rng() * 0.35);
      ctx.lineWidth = 0.4 + rng() * 1.2;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(a) * r0 + px, C + Math.sin(a) * r0 + py);
      ctx.lineTo(C + Math.cos(a) * r1 + px, C + Math.sin(a) * r1 + py);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // 6. vein geometry (painted live during the bloom, then baked)
  const vc = { x: C - nx * R * 0.025, y: C - ny * R * 0.025 };
  const veins = [];
  const K = 11 + ((rng() * 3) | 0);
  for (let k = 0; k < K; k++) {
    const a = notch + half + ((k + 0.5) / K) * span + gauss(rng) * 0.05;
    const v = {
      a, len: R * (0.78 + rng() * 0.16), bend: gauss(rng) * 0.06 * R,
      w0: 2.2 + rng() * 1.3, w1: 0.35, seed: rng() * 100, branches: [],
    };
    if (rng() < 0.6) v.branches.push({ t0: 0.55 + rng() * 0.25, da: (rng() < 0.5 ? -1 : 1) * (0.2 + rng() * 0.22), len: R * (0.12 + rng() * 0.14) });
    if (rng() < 0.25) v.branches.push({ t0: 0.75 + rng() * 0.1, da: (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.2), len: R * (0.08 + rng() * 0.08) });
    veins.push(v);
  }

  posterizeForDither(canvas);
  return { canvas, sizeCss, C, R, vc, veins, notch };
}

// Squeeze a painted pad's tones for 1-bit: pale washes drop out to clean paper,
// mid-tones thin to a light stipple, and dark pools and rim go dense.
function posterizeForDither(canvas) {
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
  const curve = Uint8Array.from({ length: 256 }, (_, L) => 255 - Math.round(smoothstep(0.26, 0.9, 1 - L / 255) * 0.92 * 255));
  for (let i = 0; i < d.length; i += 4) {
    const v = curve[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
}

function veinPoint(v, vc, t) {
  const dx = Math.cos(v.a), dy = Math.sin(v.a);
  const ex = vc.x + dx * v.len, ey = vc.y + dy * v.len;
  const mx = (vc.x + ex) / 2 - dy * v.bend * 2, my = (vc.y + ey) / 2 + dx * v.bend * 2;
  const u = 1 - t;
  return {
    x: u * u * vc.x + 2 * u * t * mx + t * t * ex,
    y: u * u * vc.y + 2 * u * t * my + t * t * ey,
    tx: 2 * u * (mx - vc.x) + 2 * t * (ex - mx),
    ty: 2 * u * (my - vc.y) + 2 * t * (ey - my),
  };
}

function drawVeins(ctx, leaf, progress) {
  const { vc, veins } = leaf;
  if (progress.every(p => p <= 0)) return;
  ctx.fillStyle = rgba(INK, 0.82);
  ctx.beginPath(); ctx.arc(vc.x, vc.y, 2.6, 0, TAU); ctx.fill();

  veins.forEach((v, k) => {
    const p = progress[k];
    if (p <= 0) return;
    const pts = [];
    const N = 26;
    for (let i = 0; i <= N; i++) pts.push(veinPoint(v, vc, (i / N) * p));
    ctx.fillStyle = rgba(INK, 0.8);
    ribbon(ctx, pts, v.w0, lerp(v.w0, v.w1, Math.pow(p, 0.6)), (t) => 1 + 0.22 * noise1(v.seed + t * p * 7));

    // a thin dry hair beside the main stroke
    ctx.strokeStyle = rgba(INK, 0.22);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    for (let i = 3; i <= N * 0.85; i++) {
      const q = pts[i], tl = Math.hypot(q.tx, q.ty) || 1;
      const off = v.w0 * 0.9;
      const x = q.x - q.ty / tl * off, y = q.y + q.tx / tl * off;
      i === 3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (const b of v.branches) {
      if (p <= b.t0) continue;
      const bp = clamp((p - b.t0) / (1 - b.t0), 0, 1);
      const s = veinPoint(v, vc, b.t0);
      const base = Math.atan2(s.ty, s.tx) + b.da;
      const bpts = [];
      for (let i = 0; i <= 10; i++) {
        const t = (i / 10) * bp;
        const a = base - b.da * 0.35 * t;
        bpts.push({ x: s.x + Math.cos(a) * b.len * t, y: s.y + Math.sin(a) * b.len * t });
      }
      ctx.fillStyle = rgba(INK, 0.7);
      ribbon(ctx, bpts, lerp(v.w0, v.w1, b.t0) * 0.75, 0.3);
    }
  });
}

class Leaf {
  constructor(spec, painted) {
    this.spec = spec;
    this.p = painted;
    this.el = makeCanvas(painted.canvas.width, painted.canvas.height);
    this.alpha = spec.alpha ?? 1;
    this.ctx = this.el.getContext('2d');
    this.ax = spec.x; this.ay = spec.y;
    this.baseRot = spec.rot;
    this.ox = 0; this.oy = 0; this.vx = 0; this.vy = 0; this.rot = 0; this.vr = 0;
    this.ph = [rand(0, TAU), rand(0, TAU), rand(0, TAU)];
    this.bob = rand(3, 6);
    this.rotAmp = rand(0.015, 0.035);
    this.start = Infinity;
    this.done = false;
    this.maskPh = [rand(0, TAU), rand(0, TAU), rand(0, TAU)];
  }
  get R() { return this.p.R; }

  finish() {
    const { ctx, p } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.el.width, this.el.height);
    ctx.drawImage(p.canvas, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawVeins(ctx, p, p.veins.map(() => 1));
    this.done = true;
  }

  // Ink blooms outward from the stem, then the veins are drawn stroke by stroke
  bloom(T) {
    if (this.done) return;
    const e = T - this.start;
    if (e < 0) return;
    const { ctx, p } = this;
    const pw = clamp(e / 2.6, 0, 1);
    const pv = clamp((e - 1.0) / 1.7, 0, 1);
    if (pw >= 1 && pv >= 1) { this.finish(); return; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.el.width, this.el.height);
    ctx.globalAlpha = smoothstep(0, 0.5, e);
    ctx.drawImage(p.canvas, 0, 0);
    ctx.globalAlpha = 1;

    if (pw < 1) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      const r = (1 - Math.pow(1 - pw, 2.2)) * p.R * 1.45 + 2;
      const [a, b, c] = this.maskPh;
      const g = ctx.createRadialGradient(p.vc.x, p.vc.y, 0, p.vc.x, p.vc.y, r * 1.12);
      g.addColorStop(0, '#000');
      g.addColorStop(0.68, '#000');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const th = (i / 64) * TAU;
        const rr = r * (1 + 0.1 * Math.sin(3 * th + a + e) + 0.06 * Math.sin(5 * th + b - e * 0.7) + 0.04 * Math.sin(9 * th + c));
        const x = p.vc.x + Math.cos(th) * rr, y = p.vc.y + Math.sin(th) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const K = p.veins.length;
    drawVeins(ctx, p, p.veins.map((_, k) => {
      const d = ((k * 7) % K) / K * 0.4;
      return easeInOutCubic(clamp((pv - d) / 0.6, 0, 1));
    }));
  }

  impulse(fx, fy, torque) { this.vx += fx; this.vy += fy; this.vr += torque; }

  update(dt, T) {
    // damped springs pull the leaf back to rest after a nudge
    const k = 5.5, c = 2.1;
    this.vx += (-k * this.ox - c * this.vx) * dt;
    this.vy += (-k * this.oy - c * this.vy) * dt;
    this.vr += (-4.5 * this.rot - 1.8 * this.vr) * dt;
    this.ox += this.vx * dt; this.oy += this.vy * dt; this.rot += this.vr * dt;

    const [a, b, c2] = this.ph;
    const bx = Math.sin(T * 0.21 + a) * this.bob + Math.sin(T * 0.13 + b) * this.bob * 0.5;
    const by = Math.cos(T * 0.17 + b) * this.bob * 0.8 + Math.sin(T * 0.09 + c2) * this.bob * 0.5;
    const br = Math.sin(T * 0.11 + c2) * this.rotAmp + Math.sin(T * 0.07 + a) * this.rotAmp * 0.5;
    this.x = this.ax + bx + this.ox;
    this.y = this.ay + by + this.oy;
    this.angle = this.baseRot + br + this.rot;
  }

  draw(ctx) {
    if (!this.done && !(this.start <= world.T)) return;
    const half = this.p.sizeCss / 2;
    ctx.save();
    ctx.globalAlpha = this.alpha * LEAF_TONE;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.drawImage(this.el, -half, -half, this.p.sizeCss, this.p.sizeCss);
    ctx.restore();
  }
}

/* ==================================================================
   Ripples & food
   ================================================================== */

class Ripple {
  constructor(x, y, { maxR = 80, life = 2.6, strength = 1, rings = 3, delay = 0 } = {}, T) {
    Object.assign(this, { x, y, maxR, life, strength, rings, born: T + delay });
    this.hit = new Set();
    this.rings_ = Array.from({ length: rings }, () => {
      const segs = [];
      const a0 = Math.random() * TAU;
      let a = a0;
      while (a < a0 + TAU - 0.2) {
        const len = 0.25 + Math.random() * 1.3;
        segs.push([a, Math.min(a + len, a0 + TAU - 0.05), 0.5 + Math.random() * 0.5]);
        a += len + 0.06 + Math.random() * 0.4;
      }
      return segs;
    });
  }
  age(T) { return (T - this.born) / this.life; }
  radius(T, i = 0) { return easeOutCubic(clamp(this.age(T) - i * 0.13, 0, 1)) * this.maxR; }
  draw(ctx, T) {
    const p = this.age(T);
    if (p < 0 || p > 1) return;
    for (let i = 0; i < this.rings; i++) {
      const rp = p - i * 0.13;
      if (rp <= 0) continue;
      const r = this.radius(T, i);
      const alpha = this.strength * 0.5 * Math.pow(1 - p, 1.5) * (1 - i * 0.25);
      ctx.lineWidth = 2.4 * (1 - p) + 0.8;
      for (const [s, e, a] of this.rings_[i]) {
        ctx.strokeStyle = rgba([58, 62, 56], alpha * a);
        ctx.beginPath(); ctx.arc(this.x, this.y, r, s, e); ctx.stroke();
      }
    }
    // a faint darkening of the disturbed water at the very start
    if (p < 0.35) {
      const r = this.radius(T) * 0.9;
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, Math.max(1, r));
      g.addColorStop(0, rgba([70, 74, 66], 0.07 * this.strength * (1 - p / 0.35)));
      g.addColorStop(1, 'rgba(70,74,66,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(1, r), 0, TAU); ctx.fill();
    }
  }
}

class Food {
  constructor(x, y, T) {
    this.x = x; this.y = y; this.born = T; this.life = 16; this.eaten = false; this.landed = false;
    this.r = rand(1.5, 2.4); this.ph = rand(0, TAU);
  }
  alive(T) { return !this.eaten && T - this.born < this.life; }
  draw(ctx, T) {
    const e = T - this.born;
    const a = smoothstep(0, 0.3, e) * (1 - smoothstep(this.life - 3, this.life, e));
    const x = this.x + Math.sin(T * 0.6 + this.ph) * 1.2, y = this.y + Math.cos(T * 0.5 + this.ph) * 1.2;
    ctx.fillStyle = rgba([46, 38, 30], 0.16 * a);
    ctx.beginPath(); ctx.arc(x, y, this.r * 2.1, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba([40, 32, 26], 0.8 * a);
    ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.fill();
  }
}

/* ==================================================================
   Koi — vermilion, feathery fins, a long flowing tail
   ================================================================== */

class Koi {
  constructor({ x, y, heading, len, color, seed }) {
    this.L = len;
    this.seed = seed;
    this.col = color;
    this.x = x; this.y = y; this.h = heading;
    this.cruise = rand(24, 32) * (len / 58);
    this.speed = this.cruise;
    this.turn = 0;
    this.burst = 0;
    this.burstIn = rand(1, 4);
    this.phase = rand(0, TAU);
    this.finPhase = rand(0, TAU);
    this.amp = 0;
    this.thrust = 0.5;
    this.flee = 0; this.fleeX = 0; this.fleeY = 0;
    this.goal = null;          // food or cursor: overrides the mood below
    this.mood = 'wander';      // wander | school | greet | surface | rest
    this.moodUntil = rand(4, 9);
    this.partner = null;
    this.spot = null;
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.kissed = false;
    this.depth = 0.5;          // 0 = at the surface, 1 = deep
    this.depthGoal = 0.5;

    this.N = 16;
    this.seg = this.L / (this.N - 1);
    this.spine = [];
    this.drawn = [];
    for (let i = 0; i < this.N; i++) {
      this.spine.push({ x: x - Math.cos(heading) * this.seg * i, y: y - Math.sin(heading) * this.seg * i });
      this.drawn.push({ x: 0, y: 0 });
    }
    this.M = 10;
    this.tailLen = this.L * 0.48;
    this.tseg = this.tailLen / (this.M - 1);
    const end = this.spine[this.N - 1];
    this.tail = Array.from({ length: this.M }, (_, j) => {
      const px = end.x - Math.cos(heading) * this.tseg * j, py = end.y - Math.sin(heading) * this.tseg * j;
      return { x: px, y: py, px, py };
    });
    this.W = this.L * 0.145;

    // Fixed brush marks, so the texture belongs to the fish and doesn't flicker
    const tr = mulberry32(seed * 31);
    // ragged, bleeding edges for each wash layer (one smooth noise track per side)
    this.edge = Array.from({ length: 6 }, (_, l) => [0, 1].map(sd => {
      const o = tr() * 300;
      return Float32Array.from({ length: this.N }, (_, i) => noise1(o + i * 0.9) * 0.7 + noise1(o * 2 + i * 2.3) * 0.3);
    }));
    // hairs running nose-to-tail along the body; the central ones carry on down the thin stalk
    this.hairs = Array.from({ length: 30 }, () => {
      const u = clamp(gauss(tr) * 0.5, -1.15, 1.15);
      const reach = 1 - Math.abs(u) * 0.55;
      return {
        u, s0: tr() * 0.14, s1: clamp(reach * (0.7 + tr() * 0.35), 0.3, 1),
        w: 0.35 + tr() * 0.8, a: 0.06 + tr() * 0.16, tone: tr() < 0.5 ? 0 : 2, jit: tr() * TAU,
      };
    });
    // forked caudal fin: many fine hairs, outer ones longest, ragged ends
    this.tailHairs = Array.from({ length: 30 }, (_, k) => {
      const u = -1 + (2 * k) / 29 + gauss(tr) * 0.02;
      return {
        u, len: (0.45 + 0.55 * Math.pow(Math.abs(u), 0.7)) * (0.78 + tr() * 0.3),
        ph: tr() * TAU, lag: 0.6 + tr() * 0.8, w: 0.35 + tr() * 0.7, a: 0.16 + tr() * 0.26,
      };
    });
    // long feathered side fins
    this.finHairs = Array.from({ length: 18 }, (_, k) => ({
      t: k / 17, len: 0.8 + tr() * 0.22, w: 0.3 + tr() * 0.6, a: 0.16 + tr() * 0.24, ph: tr() * TAU,
    }));
  }

  // pointed-round head, full shoulders, then a long slender stalk to the tail
  width(s) {
    if (s < 0.2) return this.W * (0.5 + 0.5 * Math.sin((s / 0.2) * Math.PI / 2));
    if (s < 0.62) { const t = (s - 0.2) / 0.42; return this.W * (0.15 + 0.85 * Math.pow(1 - t, 1.5)); }
    return this.W * (0.15 - 0.05 * (s - 0.62) / 0.38);
  }

  scare(x, y, power = 1) {
    this.flee = Math.max(this.flee, 0.9 * power);
    this.fleeX = x; this.fleeY = y;
    this.burst = Math.max(this.burst, 1.2 * power);
    this.depthGoal = 0.85;
  }

  setMood(mood, T, dur, extra = {}) {
    this.mood = mood;
    this.moodUntil = T + dur;
    this.partner = extra.partner || null;
    this.spot = extra.spot || null;
    this.kissed = false;
  }

  // A small mood machine: every so often, decide what to feel like doing next
  think(T, world) {
    const others = world.koi.filter(o => o !== this);
    const near = others
      .map(o => ({ o, d: Math.hypot(o.x - this.x, o.y - this.y) }))
      .filter(e => e.d < 320)
      .sort((a, b) => a.d - b.d);
    const r = Math.random();

    if (near.length && r < 0.32) {
      // tag along behind a neighbour (never one that is already following us)
      const lead = near.find(e => !(e.o.mood === 'school' && e.o.partner === this));
      if (lead) {
        this.setMood('school', T, rand(7, 15), { partner: lead.o });
        this.side = Math.random() < 0.5 ? -1 : 1;
        return;
      }
    }
    if (near.length && r < 0.5) {
      const p = near[0].o;
      if (p.mood === 'wander' && !p.goal) {
        // the two of them meet and circle, nose to tail
        const dur = rand(4, 7);
        this.setMood('greet', T, dur, { partner: p });
        p.setMood('greet', T, dur, { partner: this });
        p.side = this.side;
        return;
      }
    }
    if (r < 0.64) { this.setMood('surface', T, rand(3.5, 5.5)); return; }
    if (r < 0.78 && world.leaves.length) {
      const l = world.leaves[(Math.random() * world.leaves.length) | 0];
      const a = Math.random() * TAU;
      const spot = { x: clamp(l.ax + Math.cos(a) * l.R * 0.55, 40, world.W - 40), y: clamp(l.ay + Math.sin(a) * l.R * 0.55, 40, world.H - 40) };
      this.setMood('rest', T, rand(5, 10), { spot });
      return;
    }
    this.setMood('wander', T, rand(5, 11));
  }

  update(dt, T, world) {
    const { W, H } = world;
    let target = 0; // desired angular velocity
    const steer = (dir, w) => { target += angDiff(this.h, dir) * w; };

    // wandering
    target += fbm1(T * 0.2 + this.seed) * 0.75;

    // soft walls
    const m = 110;
    let bx = 0, by = 0;
    if (this.x < m) bx += (m - this.x) / m;
    if (this.x > W - m) bx -= (this.x - (W - m)) / m;
    if (this.y < m) by += (m - this.y) / m;
    if (this.y > H - m) by -= (this.y - (H - m)) / m;
    const bl = Math.hypot(bx, by);
    if (bl > 0) steer(Math.atan2(by, bx), Math.min(2.2, bl) * 1.8);

    // prefer the open water to the right of the text
    if (!world.mobile && !this.goal && this.x < world.textRight) {
      steer(0, 0.45 * clamp((world.textRight - this.x) / 260, 0, 1));
    }

    // personal space (they crowd and jostle when there's food about)
    const space = this.goal && this.goal.kind === 'food' ? 36 : 85;
    for (const o of world.koi) {
      if (o === this) continue;
      const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy);
      if (d < space && d > 0) steer(Math.atan2(dy, dx), (1 - d / space) * 1.3);
    }

    let maxTurn = 1.5;
    let speedGoal = this.cruise * (0.8 + 0.3 * noise1(T * 0.13 + this.seed * 2));
    this.depthGoal = 0.5 + 0.22 * noise1(T * 0.07 + this.seed);

    if (T > this.moodUntil) this.think(T, world);
    if (this.partner && (this.partner.goal || this.partner.flee > 0) && this.mood === 'greet') this.setMood('wander', T, rand(3, 6));

    if (this.flee > 0) {
      this.flee -= dt;
      steer(Math.atan2(this.y - this.fleeY, this.x - this.fleeX), 4);
      maxTurn = 4.2;
      speedGoal = this.cruise * 4.2;
      this.depthGoal = 0.9;
    } else if (this.goal) {
      const dx = this.goal.x - this.x, dy = this.goal.y - this.y, d = Math.hypot(dx, dy);
      const dir = Math.atan2(dy, dx);
      if (this.goal.kind === 'food') {
        steer(dir, 2.8);
        maxTurn = 3.2;
        speedGoal = this.cruise * (d > 120 ? 2.4 : 1.4);
        this.depthGoal = 0;
      } else {
        // curious: drift up to the cursor, then hang about nearby
        const near = smoothstep(140, 50, d);
        steer(dir, 1.6 * (1 - near * 0.8));
        maxTurn = 2.2;
        speedGoal = this.cruise * lerp(1.3, 0.55, near);
        this.depthGoal = 0.15;
      }
    } else if (this.mood === 'school' && this.partner) {
      const p = this.partner;
      if (p.mood === 'school' && p.partner === this) this.setMood('wander', T, rand(3, 6));
      // hold station just behind and beside the leader
      const tx = p.x - Math.cos(p.h) * p.L * 1.25 - Math.sin(p.h) * p.W * 3.2 * this.side;
      const ty = p.y - Math.sin(p.h) * p.L * 1.25 + Math.cos(p.h) * p.W * 3.2 * this.side;
      const d = Math.hypot(tx - this.x, ty - this.y);
      steer(Math.atan2(ty - this.y, tx - this.x), 1.6 * smoothstep(10, 60, d));
      steer(p.h, 0.9 * (1 - smoothstep(20, 90, d)));
      maxTurn = 2.2;
      speedGoal = p.speed * clamp(0.75 + d / 90, 0.6, 2.4);
      this.depthGoal = p.depth;
    } else if (this.mood === 'greet' && this.partner) {
      const p = this.partner;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      const dir = Math.atan2(p.y - this.y, p.x - this.x);
      if (d > this.L * 1.2) {
        steer(dir, 2);
        speedGoal = this.cruise * 1.25;
      } else {
        // orbit: keep the partner off to one side
        steer(dir + this.side * Math.PI * 0.5, 2.2);
        steer(dir, 0.8 * smoothstep(this.L * 0.6, this.L * 1.2, d));
        speedGoal = this.cruise * 0.8;
      }
      maxTurn = 2.6;
      this.depthGoal = 0.3;
    } else if (this.mood === 'surface') {
      // rise, slow down, kiss the surface, sink again
      const left = this.moodUntil - T;
      this.depthGoal = left > 1.2 ? 0 : 0.6;
      speedGoal = this.cruise * 0.55;
      if (!this.kissed && this.depth < 0.12) {
        this.kissed = true;
        if (!world.underLeaf(this.x, this.y)) {
          world.addRipple(this.x + Math.cos(this.h) * this.W * 1.2, this.y + Math.sin(this.h) * this.W * 1.2, { maxR: 36, strength: 0.55, rings: 2, life: 2.4 });
        }
      }
    } else if (this.mood === 'rest' && this.spot) {
      // loiter in the shade beneath a leaf
      const d = Math.hypot(this.spot.x - this.x, this.spot.y - this.y);
      steer(Math.atan2(this.spot.y - this.y, this.spot.x - this.x), 1.4 * smoothstep(20, 90, d));
      speedGoal = this.cruise * lerp(0.35, 1, smoothstep(30, 140, d));
      this.depthGoal = 0.85;
    }

    // burst-and-glide rhythm
    this.burstIn -= dt;
    if (this.burstIn <= 0) { this.burst = Math.max(this.burst, rand(0.6, 1)); this.burstIn = rand(2.5, 7); }
    this.burst *= Math.exp(-1.7 * dt);
    speedGoal += this.burst * this.cruise * 1.5;
    speedGoal *= 1 - Math.min(0.35, Math.abs(this.turn) * 0.14);

    // turn smoothly, accelerate briskly, glide down slowly
    this.turn = lerp(this.turn, clamp(target, -maxTurn, maxTurn), 1 - Math.exp(-3.2 * dt));
    this.h += this.turn * dt;
    const accel = speedGoal > this.speed ? 3.5 : 0.8;
    this.speed = lerp(this.speed, speedGoal, 1 - Math.exp(-accel * dt));
    this.thrust = lerp(this.thrust, clamp((speedGoal - this.speed) / (this.cruise * 0.6) + 0.35 + Math.abs(this.turn) * 0.15, 0.1, 1), 1 - Math.exp(-5 * dt));

    this.x += Math.cos(this.h) * this.speed * dt;
    this.y += Math.sin(this.h) * this.speed * dt;

    // tail beat
    const freq = 0.9 + this.speed / (this.L * 0.38);
    this.phase += TAU * freq * dt * (0.35 + 0.65 * this.thrust);
    this.amp = lerp(this.amp, this.L * (0.018 + 0.07 * this.thrust), 1 - Math.exp(-4 * dt));
    this.finPhase += dt * TAU * lerp(1.6, 0.7, clamp(this.speed / (this.cruise * 2), 0, 1));

    this.depth = lerp(this.depth, this.depthGoal, 1 - Math.exp(-0.9 * dt));

    this.followSpine();
    this.undulate(T);
    this.flowTail(dt);
  }

  // follow-the-leader with a bend limit: stiff near the head, supple at the tail
  followSpine() {
    const S = this.spine;
    S[0].x = this.x; S[0].y = this.y;
    let prevA = this.h + Math.PI;
    for (let i = 1; i < this.N; i++) {
      const p = S[i - 1], c = S[i];
      let a = Math.atan2(c.y - p.y, c.x - p.x);
      const lim = lerp(0.05, 0.34, i / (this.N - 1));
      const d = angDiff(prevA, a);
      if (Math.abs(d) > lim) a = prevA + Math.sign(d) * lim;
      c.x = p.x + Math.cos(a) * this.seg;
      c.y = p.y + Math.sin(a) * this.seg;
      prevA = a;
    }
  }

  // a travelling wave down the body
  undulate() {
    const S = this.spine, D = this.drawn, N = this.N;
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const a = S[Math.max(0, i - 1)], b = S[Math.min(N - 1, i + 1)];
      let tx = a.x - b.x, ty = a.y - b.y;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const env = 0.14 + 0.86 * s * s;
      const off = this.amp * env * Math.sin(this.phase - s * 4.6);
      D[i].x = S[i].x - ty * off;
      D[i].y = S[i].y + tx * off;
    }
  }

  // the tail is a loose verlet chain hanging off the body: it lags, swings and flows
  flowTail(dt) {
    const D = this.drawn, N = this.N, Tl = this.tail;
    const root = D[N - 1], pre = D[N - 2];
    let bx = root.x - pre.x, by = root.y - pre.y;
    const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    Tl[0].x = Tl[0].px = root.x; Tl[0].y = Tl[0].py = root.y;
    const damp = Math.pow(0.84, dt * 60);
    const stiff = 1 - Math.pow(1 - 0.16, dt * 60);
    for (let j = 1; j < this.M; j++) {
      const p = Tl[j];
      const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy;
      const k = stiff * (1 - (j / this.M) * 0.65);
      p.x += (root.x + bx * this.tseg * j - p.x) * k;
      p.y += (root.y + by * this.tseg * j - p.y) * k;
    }
    for (let it = 0; it < 2; it++) {
      for (let j = 1; j < this.M; j++) {
        const a = Tl[j - 1], b = Tl[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
        b.x = a.x + dx / d * this.tseg; b.y = a.y + dy / d * this.tseg;
      }
    }
  }

  // a few points around the body, fins and tail, for the tracking hull
  hullPoints() {
    const D = this.drawn, N = this.N, M = this.M, Tl = this.tail, pts = [];
    const c = D[Math.round(N * 0.4)], s = lerp(1.08, 0.82, this.depth);
    const push = (x, y) => pts.push({ x: c.x + (x - c.x) * s, y: c.y + (y - c.y) * s });
    for (let i = 0; i < N; i += 3) {
      const a = D[Math.max(0, i - 1)], b = D[Math.min(N - 1, i + 1)];
      let fx = a.x - b.x, fy = a.y - b.y;
      const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
      const w = this.width(i / (N - 1)) + (i < N * 0.55 ? this.L * 0.24 : this.W * 0.5);
      push(D[i].x - fy * w, D[i].y + fx * w);
      push(D[i].x + fy * w, D[i].y - fx * w);
      if (i === 0) push(D[0].x + fx * this.L * 0.12, D[0].y + fy * this.L * 0.12);
    }
    for (const j of [M >> 1, M - 1]) {
      const a = Tl[j - 1], b = Tl[j];
      let tx = b.x - a.x, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = this.L * (j === M - 1 ? 0.28 : 0.13);
      push(b.x - ty * w, b.y + tx * w);
      push(b.x + ty * w, b.y - tx * w);
    }
    return pts;
  }

  // depth: near the surface a fish is larger and vivid; deeper it shrinks and fades into the water
  draw(ctx, T) {
    const c = this.drawn[Math.round(this.N * 0.4)];
    const s = lerp(1.08, 0.82, this.depth);
    ctx.save();
    ctx.globalAlpha = lerp(1, 0.6, this.depth);
    ctx.translate(c.x, c.y); ctx.scale(s, s); ctx.translate(-c.x, -c.y);
    this.paint(ctx, T);
    ctx.restore();
  }

  paint(ctx, T) {
    const D = this.drawn, N = this.N, col = this.col;
    const F = [], Nn = [], Wd = [];
    for (let i = 0; i < N; i++) {
      const a = D[Math.max(0, i - 1)], b = D[Math.min(N - 1, i + 1)];
      let fx = a.x - b.x, fy = a.y - b.y;
      const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
      F.push(fx, fy); Nn.push(-fy, fx); Wd.push(this.width(i / (N - 1)));
    }
    // one wash of the body: ragged edges, tapering off at `reach` along its length
    const wash = (scale, jit, layer, reach = 1) => {
      const [e0, e1] = this.edge[layer];
      const wAt = (i, e) => {
        const s = i / (N - 1);
        return Wd[i] * scale * (1 + jit * e[i]) * (reach < 1 ? 1 - smoothstep(reach * 0.5, reach, s) : 1);
      };
      ctx.beginPath();
      for (let i = N - 1; i >= 0; i--) { const w = wAt(i, e0); ctx.lineTo(D[i].x + Nn[i * 2] * w, D[i].y + Nn[i * 2 + 1] * w); }
      const th = Math.atan2(Nn[1], Nn[0]), r0 = wAt(0, e0), r1 = wAt(0, e1);
      for (let k = 1; k < 8; k++) {
        const a = th - Math.PI * (k / 8), r = lerp(r0, r1, k / 8) * (1 + jit * 0.5 * Math.sin(k * 2.1 + layer));
        ctx.lineTo(D[0].x + Math.cos(a) * r, D[0].y + Math.sin(a) * r);
      }
      for (let i = 0; i < N; i++) { const w = wAt(i, e1); ctx.lineTo(D[i].x - Nn[i * 2] * w, D[i].y - Nn[i * 2 + 1] * w); }
      ctx.closePath();
      ctx.fill();
    };

    // ---- tail: fine hairs over a membrane that fades out toward the tips
    const Tl = this.tail, M = this.M;
    const tn = [];
    for (let j = 0; j < M; j++) {
      const a = Tl[Math.max(0, j - 1)], b = Tl[Math.min(M - 1, j + 1)];
      let tx = b.x - a.x, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      tn.push(-ty / l, tx / l);
    }
    const sample = (jj) => {
      const j0 = Math.min(M - 2, Math.floor(jj)), f = jj - j0;
      return {
        x: lerp(Tl[j0].x, Tl[j0 + 1].x, f), y: lerp(Tl[j0].y, Tl[j0 + 1].y, f),
        nx: lerp(tn[j0 * 2], tn[(j0 + 1) * 2], f), ny: lerp(tn[j0 * 2 + 1], tn[(j0 + 1) * 2 + 1], f),
      };
    };
    const rootW = Wd[N - 1];
    const strand = ({ u, len, ph, lag }, fan = 1) => {
      const pts = [];
      for (let j = 0; j <= 12; j++) {
        const jj = (j / 12) * (M - 1) * len;
        const s = sample(jj), q = jj / (M - 1);
        const spread = rootW + Math.pow(q, 0.85) * this.L * 0.3 * fan * (1 + 0.1 * Math.sin(T * 1.3 + ph));
        const wave = Math.sin(this.phase * 0.85 - q * 3 * lag + ph) * q * q * this.L * 0.04;
        const off = u * spread * Math.min(1, q * 6 + 0.25) + wave;
        pts.push({ x: s.x + s.nx * off, y: s.y + s.ny * off });
      }
      return pts;
    };
    const strands = this.tailHairs.map(h => strand(h));
    const K = strands.length, half = K / 2;
    const tg = ctx.createLinearGradient(Tl[0].x, Tl[0].y, Tl[M - 1].x, Tl[M - 1].y);
    tg.addColorStop(0, rgba(col.main, 0.62));
    tg.addColorStop(0.55, rgba(col.main, 0.26));
    tg.addColorStop(1, rgba(col.light, 0));
    ctx.fillStyle = tg;
    for (const [a, b] of [[0, half - 1], [half, K - 1]]) {
      ctx.beginPath();
      strands[a].forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      for (let i = strands[b].length - 1; i >= 0; i--) ctx.lineTo(strands[b][i].x, strands[b][i].y);
      ctx.closePath(); ctx.fill();
    }
    strands.forEach((pts, k) => {
      const h = this.tailHairs[k];
      ctx.fillStyle = rgba(k % 4 ? col.main : col.deep, h.a);
      ribbon(ctx, pts, h.w * 1.6, 0.05);
    });

    // ---- side fins: a petal of fading membrane, combed with fine wavering hairs
    const fin = (s, side, len, spread, flap, alpha) => {
      const i = Math.round(s * (N - 1));
      const bkx = -F[i * 2], bky = -F[i * 2 + 1];
      const nx = Nn[i * 2] * side, ny = Nn[i * 2 + 1] * side;
      const bx0 = D[i].x + nx * Wd[i] * 0.7, by0 = D[i].y + ny * Wd[i] * 0.7;
      const dx = bkx * Math.cos(spread + flap) + nx * Math.sin(spread + flap);
      const dy = bky * Math.cos(spread + flap) + ny * Math.sin(spread + flap);
      const tipX = bx0 + dx * len, tipY = by0 + dy * len;
      const hairs = this.finHairs.map(h => {
        const rx = bx0 + bkx * h.t * len * 0.3 - nx * h.t * Wd[i] * 0.3;
        const ry = by0 + bky * h.t * len * 0.3 - ny * h.t * Wd[i] * 0.3;
        const k = h.t * 0.5, f = h.len;
        const ex = lerp(tipX, rx + bkx * len * 0.62, k), ey = lerp(tipY, ry + bky * len * 0.62, k);
        const x = rx + (ex - rx) * f, y = ry + (ey - ry) * f;
        const wv = Math.sin(T * 2.2 + h.ph + this.finPhase * 0.5) * len * 0.035;
        return { rx, ry, cx: (rx + x) / 2 + nx * (len * 0.05 + wv), cy: (ry + y) / 2 + ny * (len * 0.05 + wv), x, y, h };
      });
      const first = hairs[0], last = hairs[hairs.length - 1];
      const g = ctx.createLinearGradient(bx0, by0, tipX, tipY);
      g.addColorStop(0, rgba(col.main, 0.6 * alpha));
      g.addColorStop(0.6, rgba(col.main, 0.2 * alpha));
      g.addColorStop(1, rgba(col.light, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(first.rx, first.ry);
      ctx.quadraticCurveTo(first.cx, first.cy, first.x, first.y);
      for (let k = 1; k < hairs.length; k++) ctx.lineTo(hairs[k].x, hairs[k].y);
      ctx.quadraticCurveTo(last.cx, last.cy, last.rx, last.ry);
      ctx.closePath(); ctx.fill();
      hairs.forEach(t => {
        const pts = [];
        for (let q = 0; q <= 7; q++) {
          const v = q / 7, w = 1 - v;
          pts.push({ x: w * w * t.rx + 2 * w * v * t.cx + v * v * t.x, y: w * w * t.ry + 2 * w * v * t.cy + v * v * t.y });
        }
        ctx.fillStyle = rgba(col.main, t.h.a * alpha);
        ribbon(ctx, pts, t.h.w * 1.5, 0.05);
      });
    };
    const slow = clamp(1.25 - this.speed / (this.cruise * 1.8), 0.3, 1);
    for (const side of [1, -1]) {
      const fold = clamp(this.turn * side * 0.18, -0.22, 0.22);
      fin(0.4, side, this.L * 0.32, 0.26 - fold * 0.5, Math.sin(this.finPhase * 0.8 + 1.7 + side) * 0.08 * slow, 0.85);
      fin(0.14, side, this.L * 0.5, 0.34 - fold, Math.sin(this.finPhase + (side > 0 ? 0 : 0.9)) * 0.14 * slow, 1);
    }

    // ---- body: stacked translucent washes — pale and ragged at the edge, deep at the core
    ctx.fillStyle = rgba(col.light, 0.12); wash(1.22, 0.22, 0);
    ctx.fillStyle = rgba(col.main, 0.32); wash(1.06, 0.14, 1);
    ctx.fillStyle = rgba(col.main, 0.42); wash(0.92, 0.1, 2);
    ctx.fillStyle = rgba(col.main, 0.45); wash(0.74, 0.1, 3, 0.95);
    ctx.fillStyle = rgba(col.deep, 0.3);  wash(0.52, 0.12, 4, 0.8);
    ctx.fillStyle = rgba(col.deep, 0.26); wash(0.3, 0.15, 5, 0.62);

    // brush hairs: the drag of the bristles nose to tail
    ctx.lineCap = 'round';
    const tones = [col.deep, col.main, col.light];
    for (const h of this.hairs) {
      const i0 = Math.round(h.s0 * (N - 1)), i1 = Math.round(h.s1 * (N - 1));
      if (i1 - i0 < 2) continue;
      ctx.strokeStyle = rgba(tones[h.tone], h.a);
      ctx.lineWidth = h.w;
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const u = h.u * (1 + 0.06 * Math.sin(i * 1.7 + h.jit));
        const x = D[i].x + Nn[i * 2] * Wd[i] * u, y = D[i].y + Nn[i * 2 + 1] * Wd[i] * u;
        i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // a paler, wetter snout
    const fx = F[0], fy = F[1], nx = Nn[0], ny = Nn[1], w0 = Wd[0];
    const sg = ctx.createRadialGradient(D[0].x + fx * w0 * 0.4, D[0].y + fy * w0 * 0.4, 0, D[0].x, D[0].y, w0 * 1.2);
    sg.addColorStop(0, rgba(col.light, 0.4));
    sg.addColorStop(1, rgba(col.light, 0));
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(D[0].x, D[0].y, w0 * 1.2, 0, TAU); ctx.fill();

    // ---- barbels: two faint, weak streaks dangling from the snout
    for (const side of [1, -1]) {
      const sx = D[0].x + fx * w0 * 0.5 + nx * w0 * 0.4 * side, sy = D[0].y + fy * w0 * 0.5 + ny * w0 * 0.4 * side;
      const sway = Math.sin(T * 1.6 + side * 1.3 + this.seed) * 0.18 - this.turn * 0.12 * side;
      const l = this.L * 0.14;
      const pts = [];
      for (let q = 0; q <= 6; q++) {
        const v = q / 6;
        // out from the snout, then drooping back as the fish moves
        const a = 0.55 + v * (0.7 + sway);
        const dx = fx * Math.cos(a) + nx * side * Math.sin(a), dy = fy * Math.cos(a) + ny * side * Math.sin(a);
        const prev = pts[q - 1] || { x: sx, y: sy };
        pts.push(q ? { x: prev.x + dx * l / 6, y: prev.y + dy * l / 6 } : prev);
      }
      ctx.fillStyle = rgba(col.main, 0.28);
      ribbon(ctx, pts, 0.9, 0.08);
    }

    // ---- eyes, wide-set at the edge of the head
    const er = Math.max(1.1, this.L * 0.019);
    ctx.fillStyle = '#16110f';
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.arc(D[0].x + fx * w0 * 0.15 + nx * w0 * 1.0 * side, D[0].y + fy * w0 * 0.15 + ny * w0 * 1.0 * side, er, 0, TAU);
      ctx.fill();
    }
  }
}

/* ==================================================================
   Tadpoles — Qi Baishi's favourite: a blot of ink and a wriggle
   ================================================================== */

class Tadpole {
  constructor(x, y, heading, seed) {
    this.x = x; this.y = y; this.h = heading; this.seed = seed;
    this.r = rand(3.6, 5.2);
    this.speed = rand(14, 22); this.cruise = this.speed;
    this.turn = 0; this.phase = rand(0, TAU); this.flee = 0; this.fx = 0; this.fy = 0;
    this.N = 10; this.seg = (this.r * 5.8) / (this.N - 1);
    this.mottle = Array.from({ length: 4 }, () => [rand(-0.45, 0.3), rand(-0.35, 0.35), rand(0.22, 0.4)]);
    this.flecks = Array.from({ length: 5 }, () => { const a = rand(0, TAU); return [Math.cos(a) * rand(0.6, 0.9), Math.sin(a) * rand(0.6, 0.9)]; });
    this.jit = jitTable();
    this.spine = Array.from({ length: this.N }, (_, i) => ({ x: x - Math.cos(heading) * this.seg * i, y: y - Math.sin(heading) * this.seg * i }));
    this.pause = 0; this.pauseIn = rand(3, 9);
  }
  scare(x, y) { this.flee = 1.1; this.fx = x; this.fy = y; this.pause = 0; }
  update(dt, T, world) {
    let target = fbm1(T * 0.35 + this.seed) * 1.4;
    const steer = (dir, w) => { target += angDiff(this.h, dir) * w; };
    const { W, H } = world, m = 70;
    let bx = 0, by = 0;
    if (this.x < m) bx += (m - this.x) / m;
    if (this.x > W - m) bx -= (this.x - (W - m)) / m;
    if (this.y < m) by += (m - this.y) / m;
    if (this.y > H - m) by -= (this.y - (H - m)) / m;
    if (bx || by) steer(Math.atan2(by, bx), Math.min(2.5, Math.hypot(bx, by)) * 2);
    if (!world.mobile && this.x < world.textRight) steer(0, 0.5 * clamp((world.textRight - this.x) / 200, 0, 1));

    // loose schooling
    let cx = 0, cy = 0, ah = 0, ahs = 0, n = 0;
    for (const o of world.tadpoles) {
      if (o === this) continue;
      const dx = o.x - this.x, dy = o.y - this.y, d = Math.hypot(dx, dy);
      if (d < 160) { cx += o.x; cy += o.y; ah += Math.cos(o.h); ahs += Math.sin(o.h); n++; }
      if (d < 22 && d > 0) steer(Math.atan2(-dy, -dx), (1 - d / 22) * 2.2);
    }
    if (n) {
      steer(Math.atan2(cy / n - this.y, cx / n - this.x), 0.5);
      steer(Math.atan2(ahs, ah), 0.6);
    }

    let goal = this.cruise * (0.8 + 0.4 * noise1(T * 0.5 + this.seed));

    // keep clear of a koi heading this way
    for (const k of world.koi) {
      const dx = this.x - k.x, dy = this.y - k.y, d = Math.hypot(dx, dy);
      if (d < k.L * 0.9 && d > 0) { steer(Math.atan2(dy, dx), 2.4 * (1 - d / (k.L * 0.9))); goal = this.cruise * 2.4; this.pause = 0; }
    }

    // nibble at food that drifts close
    let food = null, best = 240;
    for (const f of world.food) {
      if (!f.alive(T) || T < f.born) continue;
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < best) { best = d; food = f; }
    }
    if (food) {
      steer(Math.atan2(food.y - this.y, food.x - this.x), 2.6);
      goal = this.cruise * 2.2;
      this.pause = 0;
      if (best < this.r + 3) { food.eaten = true; world.addRipple(food.x, food.y, { maxR: 12, strength: 0.4, rings: 1, life: 1.1 }); }
    }

    this.pauseIn -= dt;
    if (this.pauseIn <= 0) { this.pause = rand(0.6, 1.8); this.pauseIn = rand(4, 11); }
    if (this.pause > 0) { this.pause -= dt; goal *= 0.15; }
    let maxTurn = 2.4;
    if (this.flee > 0) {
      this.flee -= dt; maxTurn = 5;
      steer(Math.atan2(this.y - this.fy, this.x - this.fx), 4);
      goal = this.cruise * 4.5;
    }
    this.turn = lerp(this.turn, clamp(target, -maxTurn, maxTurn), 1 - Math.exp(-4 * dt));
    this.h += this.turn * dt;
    this.speed = lerp(this.speed, goal, 1 - Math.exp(-(goal > this.speed ? 4 : 1.5) * dt));
    this.x += Math.cos(this.h) * this.speed * dt;
    this.y += Math.sin(this.h) * this.speed * dt;
    this.phase += dt * TAU * (1.2 + this.speed / 5);

    const S = this.spine;
    S[0].x = this.x; S[0].y = this.y;
    for (let i = 1; i < this.N; i++) {
      const p = S[i - 1], c = S[i];
      const a = Math.atan2(c.y - p.y, c.x - p.x);
      c.x = p.x + Math.cos(a) * this.seg; c.y = p.y + Math.sin(a) * this.seg;
    }
  }
  draw(ctx) {
    const S = this.spine, N = this.N, r = this.r;
    const amp = r * (0.4 + Math.min(1, this.speed / 30) * 0.55);
    const pts = [], side = [];
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1);
      const a = S[Math.max(0, i - 1)], b = S[Math.min(N - 1, i + 1)];
      let tx = a.x - b.x, ty = a.y - b.y;
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const off = amp * s * s * Math.sin(this.phase - s * 4.5);
      pts.push({ x: S[i].x - ty * off, y: S[i].y + tx * off });
      side.push({ x: S[i].x - ty * (off + r * 0.16), y: S[i].y + tx * (off + r * 0.16) });
    }
    // the tail: a pale grey wash, a fainter halo, and a darker streak down one side
    ctx.fillStyle = rgba(INK, 0.14);
    ribbon(ctx, pts.slice(1), r * 1.5, 0.3);
    ctx.fillStyle = rgba(INK, 0.3);
    ribbon(ctx, pts.slice(1), r * 0.95, 0.06);
    ctx.fillStyle = rgba(INK, 0.5);
    ribbon(ctx, side.slice(1, Math.round(N * 0.82)), r * 0.34, 0.04);

    // the head: an egg of mottled ink — a bleeding halo, washes deepening to the core,
    // darker blots, and a few dry flecks where the paper shows through
    const rx = r * 1.3, ry = r * 1.06, j = this.jit, h = this.h;
    const hx = this.x - Math.cos(h) * rx * 0.1, hy = this.y - Math.sin(h) * rx * 0.1;
    softBlob(ctx, hx, hy, rx, ry, h, j, [
      [1.22, rgba(INK, 0.1)], [1.0, rgba([58, 58, 52], 0.5)], [0.86, rgba([34, 34, 30], 0.45)], [0.66, rgba([16, 16, 14], 0.55)],
    ], { egg: 0.17, amt: 0.07 });
    for (const [mx, my, mr] of this.mottle) {
      softBlob(ctx, hx + (Math.cos(h) * mx * rx - Math.sin(h) * my * ry), hy + (Math.sin(h) * mx * rx + Math.cos(h) * my * ry),
        mr * r, mr * r * 0.8, h + mx, j, [[1, rgba([8, 8, 7], 0.3)]], { off: 40, amt: 0.2 });
    }
    ctx.fillStyle = 'rgba(236,232,220,0.35)';
    for (const [fx, fy] of this.flecks) {
      const X = hx + (Math.cos(h) * fx * rx - Math.sin(h) * fy * ry), Y = hy + (Math.sin(h) * fx * rx + Math.cos(h) * fy * ry);
      ctx.beginPath(); ctx.arc(X, Y, 0.45, 0, TAU); ctx.fill();
    }
    const er = Math.max(0.75, r * 0.17);
    for (const sd of [1, -1]) {
      const ex = rx * 0.4, ey = sd * ry * 0.8 * (1 - 0.17 * 0.4);
      const X = hx + Math.cos(h) * ex - Math.sin(h) * ey, Y = hy + Math.sin(h) * ex + Math.cos(h) * ey;
      ctx.fillStyle = 'rgba(236,232,220,0.5)';
      ctx.beginPath(); ctx.arc(X, Y, er + 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0d0b0a';
      ctx.beginPath(); ctx.arc(X, Y, er, 0, TAU); ctx.fill();
    }
  }
}

/* ==================================================================
   Shrimp — translucent grey bodies, an inky core, long whiskers;
   they graze the bottom in small groups
   ================================================================== */

class ShrimpGroup {
  constructor(x, y) { this.x = x; this.y = y; this.tx = x; this.ty = y; this.next = rand(18, 34); }
  update(dt, T, world) {
    this.next -= dt;
    if (this.next <= 0) {
      // wander off to graze somewhere new: near a leaf's shade or the bottom of the pond
      this.next = rand(25, 45);
      const { W, H } = world;
      const left = world.mobile ? 50 : world.textRight + 40;
      const l = world.leaves.length && Math.random() < 0.6 ? world.leaves[(Math.random() * world.leaves.length) | 0] : null;
      const a = Math.random() * TAU;
      this.tx = clamp(l ? l.ax + Math.cos(a) * l.R * 1.1 : rand(left, W - 60), left, W - 60);
      this.ty = clamp(l ? l.ay + Math.sin(a) * l.R * 1.1 : rand(H * 0.4, H - 60), 60, H - 60);
    }
    const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
    if (d > 1) { const v = Math.min(d, 7 * dt); this.x += dx / d * v; this.y += dy / d * v; }
  }
}

class Shrimp {
  constructor(group, x, y, seed) {
    this.group = group;
    this.L = rand(26, 36);
    this.x = x; this.y = y; this.h = rand(0, TAU); this.seed = seed;
    this.N = 8; this.seg = this.L / (this.N - 1);
    this.spine = Array.from({ length: this.N }, (_, i) => ({ x: x - Math.cos(this.h) * this.seg * i, y: y - Math.sin(this.h) * this.seg * i }));
    this.mode = 'graze'; this.modeT = rand(1, 4);
    this.goal = null; this.speed = 0; this.turn = 0;
    this.flick = 0; this.fvx = 0; this.fvy = 0;
    this.peck = rand(0, TAU); this.legPh = rand(0, TAU); this.sway = rand(0, TAU);
    this.home = { a: rand(0, TAU), r: rand(10, 46) };
    this.jit = jitTable();
  }

  scare(x, y) {
    // the shrimp escape: a sharp flick of the tail shoots it backwards
    const d = Math.hypot(this.x - x, this.y - y) || 1;
    const v = rand(150, 210);
    this.fvx = (this.x - x) / d * v; this.fvy = (this.y - y) / d * v;
    this.flick = 0.6; this.mode = 'crawl'; this.modeT = rand(1, 2);
  }

  update(dt, T, world) {
    if (this.flick > 0) {
      this.flick -= dt;
      const k = Math.exp(-5.5 * dt);
      this.fvx *= k; this.fvy *= k;
      const mx = this.fvx * dt, my = this.fvy * dt;
      this.x += mx; this.y += my;
      for (const p of this.spine) { p.x += mx; p.y += my; } // the whole body jolts back as one
      return;
    }

    // a koi nosing too close sends it flicking away
    for (const k of world.koi) {
      if (k.depth > 0.35 && Math.hypot(k.x - this.x, k.y - this.y) < 42) { this.scare(k.x, k.y); return; }
    }

    // food that sinks nearby is worth crawling over for
    let food = null, best = 130;
    for (const f of world.food) {
      if (!f.alive(T) || T < f.born) continue;
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < best) { best = d; food = f; }
    }

    this.modeT -= dt;
    if (food) {
      this.goal = { x: food.x, y: food.y };
      this.mode = 'crawl';
      if (best < 6) { food.eaten = true; this.mode = 'graze'; this.modeT = rand(2, 4); }
    } else if (this.modeT <= 0) {
      if (this.mode === 'graze') {
        this.mode = 'crawl'; this.modeT = rand(1.5, 3.5);
        this.home.a += rand(-1.2, 1.2); this.home.r = rand(10, 50);
      } else {
        this.mode = 'graze'; this.modeT = rand(2.5, 6);
      }
    }
    if (!food) {
      this.goal = { x: this.group.x + Math.cos(this.home.a) * this.home.r, y: this.group.y + Math.sin(this.home.a) * this.home.r * 0.7 };
    }

    let target = 0, speedGoal = 0;
    const gx = this.goal.x - this.x, gy = this.goal.y - this.y, gd = Math.hypot(gx, gy);
    if (this.mode === 'crawl' && gd > 4) {
      target = angDiff(this.h, Math.atan2(gy, gx)) * 2.2;
      speedGoal = food ? 18 : 7 + 4 * noise1(T * 0.6 + this.seed);
    } else {
      // grazing: pick at the bottom, turning a little now and then
      target = noise1(T * 0.4 + this.seed) * 0.5;
      speedGoal = 0.6;
    }
    // keep a little room from the neighbours
    for (const o of world.shrimp) {
      if (o === this) continue;
      const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy);
      if (d < 18 && d > 0) { this.x += dx / d * (18 - d) * 0.5 * dt * 4; this.y += dy / d * (18 - d) * 0.5 * dt * 4; }
    }
    this.turn = lerp(this.turn, clamp(target, -1.6, 1.6), 1 - Math.exp(-3 * dt));
    this.h += this.turn * dt;
    this.speed = lerp(this.speed, speedGoal, 1 - Math.exp(-2.5 * dt));
    this.x += Math.cos(this.h) * this.speed * dt;
    this.y += Math.sin(this.h) * this.speed * dt;
    this.peck += dt * (this.mode === 'graze' ? 3.2 : 1.2);
    this.legPh += dt * (2 + this.speed * 0.9);
    this.sway += dt;

    const S = this.spine;
    S[0].x = this.x; S[0].y = this.y;
    let prevA = this.h + Math.PI;
    for (let i = 1; i < this.N; i++) {
      const p = S[i - 1], c = S[i];
      let a = Math.atan2(c.y - p.y, c.x - p.x);
      const lim = i < 3 ? 0.05 : 0.28;
      const d = angDiff(prevA, a);
      if (Math.abs(d) > lim) a = prevA + Math.sign(d) * lim;
      c.x = p.x + Math.cos(a) * this.seg; c.y = p.y + Math.sin(a) * this.seg;
      prevA = a;
    }
  }

  draw(ctx, T) {
    const S = this.spine, N = this.N, L = this.L, j = this.jit;
    const ang = (i) => { const a = S[Math.max(0, i - 1)], b = S[Math.min(N - 1, i + 1)]; return Math.atan2(a.y - b.y, a.x - b.x); };
    const at = (p, a, fwd, side) => ({ x: p.x + Math.cos(a) * fwd - Math.sin(a) * side, y: p.y + Math.sin(a) * fwd + Math.cos(a) * side });
    // every line is a brush stroke: pressed at the start, lifting off at the end
    const stroke = (pts, w0, w1, alpha) => { ctx.fillStyle = rgba(INK, alpha); ribbon(ctx, pts, w0, w1); };
    const curve = (p0, c, p1, n = 8) => {
      const out = [];
      for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push({ x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y }); }
      return out;
    };
    const a0 = ang(1), head = S[0];

    // long whiskers sweeping back past the tail, short feelers forward
    for (const s of [1, -1]) {
      const st = at(head, a0, L * 0.1, s * L * 0.03);
      const sw = Math.sin(T * 0.9 + this.sway * 0.3 + s) * 0.12;
      stroke(curve(st, at(st, a0 + s * (0.55 + sw), L * 0.7, 0), at(st, a0 + s * (2.55 + sw), L * 1.5, 0), 14), 0.9, 0.12, 0.42);
      stroke(curve(st, at(st, a0 + s * 0.2, L * 0.2, 0), at(st, a0 + s * (0.32 + sw * 0.5), L * 0.4, 0)), 0.7, 0.1, 0.4);
    }

    // walking legs: little flicks of the brush
    for (let k = 0; k < 4; k++) {
      const p = S[1 + Math.floor(k / 2)], a = ang(1 + Math.floor(k / 2));
      for (const s of [1, -1]) {
        const base = at(p, a, -L * 0.04 * (k % 2), s * L * 0.05);
        const la = a + s * (1.85 + 0.25 * Math.sin(this.legPh + k * 1.3 + (s > 0 ? 0 : Math.PI)));
        stroke([base, at(base, la + s * 0.15, L * 0.09, 0), at(base, la, L * 0.18, 0)], 0.9, 0.15, 0.32);
      }
    }

    // claws: jointed arms with darker knuckles and inky pincers, pecking while it grazes
    const reach = this.mode === 'graze' ? 0.18 * Math.max(0, Math.sin(this.peck)) : 0.05 * Math.sin(this.peck);
    for (const s of [1, -1]) {
      const sh = at(head, a0, -L * 0.02, s * L * 0.06);
      const el = at(sh, a0 + s * (0.62 - reach), L * 0.36, 0);
      const wr = at(el, a0 - s * (0.18 + reach * 1.5), L * 0.36, 0);
      stroke([sh, el], 1.1, 0.8, 0.45);
      stroke([el, wr], 0.9, 1.3, 0.48);
      softBlob(ctx, el.x, el.y, 1.1, 0.9, a0, j, [[1, rgba(INK, 0.5)]], { off: 7 });
      const palmEnd = at(wr, a0 - s * 0.08, L * 0.17, 0);
      softBlob(ctx, (wr.x + palmEnd.x) / 2, (wr.y + palmEnd.y) / 2, L * 0.095, L * 0.03, a0 - s * 0.08, j,
        [[1.3, rgba(INK, 0.18)], [1, rgba([20, 20, 18], 0.75)]], { off: 21 + (s > 0 ? 0 : 9) });
      stroke([palmEnd, at(palmEnd, a0 - s * 0.05, L * 0.12, 0)], 1.2, 0.15, 0.7);
      stroke([palmEnd, at(palmEnd, a0 + s * 0.42, L * 0.09, 0)], 1.0, 0.15, 0.6);
    }

    // abdomen: broad, overlapping strokes of grey wash, each with an inky rear edge
    for (let i = N - 1; i >= 2; i--) {
      const p = S[i], a = ang(i), k = (i - 2) / (N - 3);
      const rx = L * 0.085, ry = L * 0.13 * (1 - k * 0.45);
      softBlob(ctx, p.x, p.y, rx, ry, a, j, [
        [1.15, rgba([96, 96, 88], 0.12)], [1, rgba([92, 92, 84], 0.28)], [0.7, rgba([70, 70, 64], 0.22)],
      ], { off: i * 5 });
      const e0 = at(p, a, -rx * 0.55, -ry * 0.95), e1 = at(p, a, -rx * 0.85, 0), e2 = at(p, a, -rx * 0.55, ry * 0.95);
      ctx.fillStyle = rgba(INK, 0.5 - k * 0.12);
      ribbon(ctx, curve(e0, e1, e2, 6), 0.3, 0.3, (t) => 1 + 4.5 * Math.sin(t * Math.PI) * (1 - k * 0.4));
    }
    // tail fan: three soft petals
    const tp = S[N - 1], ta = ang(N - 1) + Math.PI;
    for (const da of [-0.45, 0, 0.45]) {
      const c = at(tp, ta + da, L * 0.09, 0);
      softBlob(ctx, c.x, c.y, L * 0.08, L * 0.035, ta + da, j, [[1, rgba([60, 60, 55], 0.4)], [0.55, rgba(INK, 0.35)]], { off: 50 + da * 10 });
    }

    // carapace: a translucent wash around a dark, inky core
    const cp = S[1], ca = ang(1);
    softBlob(ctx, cp.x, cp.y, L * 0.22, L * 0.115, ca, j, [
      [1.12, rgba([96, 96, 88], 0.12)], [1, rgba([90, 90, 82], 0.28)], [0.78, rgba([74, 74, 68], 0.2)],
    ], { egg: 0.15, off: 60 });
    const core = at(cp, ca, -L * 0.03, 0);
    softBlob(ctx, core.x, core.y, L * 0.1, L * 0.05, ca, j, [
      [1.35, rgba(INK, 0.2)], [1, rgba([14, 14, 12], 0.82)],
    ], { off: 75, amt: 0.22 });

    // rostrum and eyes
    stroke([at(head, a0, L * 0.06, 0), at(head, a0 + 0.05, L * 0.24, 0)], 1.1, 0.15, 0.6);
    ctx.fillStyle = '#0f0d0b';
    for (const s of [1, -1]) {
      const e = at(head, a0, L * 0.05, s * L * 0.06);
      ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0.8, L * 0.03), 0, TAU); ctx.fill();
    }
  }
}

/* ==================================================================
   Damselflies — a needle of ink with four glassy wings. They dart and
   hover over the water, inspect things, squabble with each other, dip
   to the surface, and settle on the lotus leaves (riding them as they
   drift).
   ================================================================== */

const DAMSEL_PALETTES = {
  indigo:    { body: [16, 16, 16], accent: [40, 40, 40], eye: [6, 6, 6], wing: [120, 120, 120], stigma: [10, 10, 10] },
  vermilion: { body: [28, 28, 28], accent: [70, 70, 70], eye: [8, 8, 8], wing: [140, 140, 140], stigma: [14, 14, 14] },
};

function leafToWorld(leaf, lx, ly) {
  const c = Math.cos(leaf.angle), s = Math.sin(leaf.angle);
  return { x: leaf.x + lx * c - ly * s, y: leaf.y + lx * s + ly * c };
}

class Damselfly {
  constructor({ palette, seed, delay, scale = 1 }) {
    this.pal = palette; this.seed = seed;
    this.L = 52 * scale;
    this.x = -999; this.y = -999; this.vx = 0; this.vy = 0;
    this.h = 0; this.look = 0;
    this.z = 1; this.zGoal = 1; this.zRate = 2.2;
    this.state = 'away'; this.timer = delay;
    this.target = { x: 0, y: 0 }; this.k = 24; this.hover = 0;
    this.perch = null; this.visits = 0;
    this.fold = 0; this.foldGoal = 0;
    this.wing = rand(0, TAU);
    this.head = 0; this.headGoal = 0; this.headIn = rand(1, 3);
    this.flickIn = rand(2, 6); this.flick = 0;
    this.flown = 0; this.energy = rand(5, 10);
    this.cool = rand(8, 14); this.curiousCool = rand(4, 8);
    this.dip = 0; this.dipped = false; this.dipHold = 0;
    this.prey = null;
    this.abd = Array.from({ length: 9 }, () => ({ x: 0, y: 0, a: 0 }));
    this.jit = jitTable();
  }

  get flying() { return this.state !== 'away' && this.state !== 'perched'; }

  bounds(world) {
    const { W, H } = world;
    return { x0: world.mobile ? 30 : world.textRight - 40, x1: W - 30, y0: 40, y1: H - 40 };
  }

  // a short dart to a nearby point, optionally away from something
  pickDart(world, minD = 50, maxD = 170, away = null) {
    const b = this.bounds(world);
    for (let i = 0; i < 16; i++) {
      const a = away ? Math.atan2(this.y - away.y, this.x - away.x) + rand(-0.9, 0.9) : rand(0, TAU);
      const d = rand(minD, maxD);
      const x = this.x + Math.cos(a) * d, y = this.y + Math.sin(a) * d;
      if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return { x, y };
    }
    return { x: rand(lerp(b.x0, b.x1, 0.3), lerp(b.x0, b.x1, 0.8)), y: rand(lerp(b.y0, b.y1, 0.2), lerp(b.y0, b.y1, 0.8)) };
  }

  pickPerch(world) {
    const b = this.bounds(world);
    for (let i = 0; i < 30 && world.leaves.length; i++) {
      const leaf = world.leaves[(Math.random() * world.leaves.length) | 0];
      const a = rand(0, TAU);
      if (Math.abs(angDiff(a, leaf.p.notch)) < 0.6) continue;
      const r = leaf.R * rand(0.28, 0.78);
      const lx = Math.cos(a) * r, ly = Math.sin(a) * r;
      const w = leafToWorld(leaf, lx, ly);
      if (w.x < b.x0 + 20 || w.x > b.x1 || w.y < b.y0 || w.y > b.y1) continue;
      if (world.damsels.some(o => o !== this && o.perch && Math.hypot(o.perch.wx - w.x, o.perch.wy - w.y) < 55)) continue;
      return { leaf, lx, ly, la: rand(0, TAU), wx: w.x, wy: w.y };
    }
    return null;
  }

  perchPose() {
    const p = this.perch, w = leafToWorld(p.leaf, p.lx, p.ly);
    p.wx = w.x; p.wy = w.y;
    return { x: w.x, y: w.y, h: p.leaf.angle + p.la };
  }

  dartTo(t, k, hover) { this.target = t; this.k = k; this.hover = hover; this.look = Math.atan2(t.y - this.y, t.x - this.x); }

  // something alarming: get airborne and away from it
  startle(fx, fy, world) {
    if (this.state === 'away' || this.state === 'leave') return;
    if (this.state === 'takeoff') return;
    if (this.perch) this.perch.leaf.impulse(0, 0, (Math.random() - 0.5) * 0.02);
    this.perch = null;
    this.state = 'takeoff';
    this.timer = 0.45;
    this.zGoal = 1; this.zRate = 3;
    this.foldGoal = 0;
    this.dip = 0;
    this.dartTo(this.pickDart(world, 100, 220, { x: fx, y: fy }), 34, rand(0.2, 0.5));
  }

  // choose what to do next after a hover
  decide(world, T) {
    const others = world.damsels.filter(o => o !== this && o.flying);
    const chaser = others.find(o => o.state === 'chase' && o.prey === this);
    if (chaser) { this.dartTo(this.pickDart(world, 60, 150, chaser), 36, rand(0.05, 0.2)); return; }

    const rival = others.find(o => Math.hypot(o.x - this.x, o.y - this.y) < 240 && o.state !== 'chase');
    if (rival && this.cool <= 0 && Math.random() < 0.55) {
      this.state = 'chase'; this.prey = rival; this.timer = rand(1.8, 3.2);
      return;
    }

    const still = pointer.active && T - pointer.last > 1.1;
    if (still && this.curiousCool <= 0 && Math.hypot(pointer.x - this.x, pointer.y - this.y) < 300 && Math.random() < 0.5) {
      this.state = 'inspect'; this.timer = rand(1.6, 3); this.curiousCool = rand(10, 18);
      return;
    }

    if (this.flown > this.energy) {
      const p = this.pickPerch(world);
      if (p) { this.perch = p; this.state = 'approach'; this.k = 14; return; }
    }

    if (this.visits >= 3 && Math.random() < 0.07) {
      this.state = 'leave';
      const out = Math.random() < 0.5 ? { x: world.W + 120, y: rand(0, world.H * 0.6) } : { x: rand(world.textRight, world.W), y: -120 };
      this.dartTo(out, 9, 0);
      return;
    }

    if (!world.underLeaf(this.x, this.y) && Math.random() < 0.14) {
      this.state = 'dip'; this.dipped = false; this.dipHold = 0;
      const t = this.pickDart(world, 20, 60);
      if (!world.underLeaf(t.x, t.y)) { this.dartTo(t, 16, 0); this.zGoal = 0.08; this.zRate = 1.6; return; }
      this.state = 'fly';
    }

    this.state = 'fly';
    this.zGoal = rand(0.72, 1); this.zRate = 2.2;
    // mostly short hops with long hovers; now and then a long, quick dash
    const long = Math.random() < 0.2;
    this.dartTo(this.pickDart(world, long ? 160 : 40, long ? 320 : 150), long ? rand(18, 24) : rand(24, 36), rand(0.3, 1.6));
  }

  update(dt, T, world) {
    if (this.state === 'away') {
      this.timer -= dt;
      if (this.timer > 0) return;
      // fly in from an edge
      const b = this.bounds(world);
      const fromTop = Math.random() < 0.4;
      this.x = fromTop ? rand(lerp(b.x0, b.x1, 0.4), b.x1) : world.W + 40;
      this.y = fromTop ? -40 : rand(world.H * 0.15, world.H * 0.6);
      this.h = Math.atan2(world.H * 0.5 - this.y, lerp(b.x0, b.x1, 0.6) - this.x);
      this.vx = Math.cos(this.h) * 120; this.vy = Math.sin(this.h) * 120;
      this.abd.forEach(p => { p.a = this.h + Math.PI; });
      this.z = 1; this.zGoal = 1;
      this.state = 'fly'; this.flown = 0; this.visits = 0;
      this.dartTo({ x: rand(lerp(b.x0, b.x1, 0.35), lerp(b.x0, b.x1, 0.85)), y: rand(lerp(b.y0, b.y1, 0.25), lerp(b.y0, b.y1, 0.75)) }, 10, rand(0.6, 1.2));
    }

    this.cool -= dt; this.curiousCool -= dt;

    // ---- alarms
    if (this.state !== 'leave' && this.state !== 'takeoff') {
      const ps = Math.hypot(pointer.vx, pointer.vy);
      if (pointer.active && T - pointer.last < 0.05 && ps > 380 && Math.hypot(pointer.x - this.x, pointer.y - this.y) < 95) {
        this.startle(pointer.x, pointer.y, world); 
      }
      for (const r of world.ripples) {
        if (T - r.born < 0 || T - r.born > 0.08 || r.strength < 0.3) continue;
        if (this.z < 0.6 && Math.hypot(r.x - this.x, r.y - this.y) < 90) { this.startle(r.x, r.y, world); break; }
      }
    }

    if (this.state === 'perched') this.updatePerched(dt, T, world);
    else this.updateFlight(dt, T, world);

    // wings fold shut at rest, with the odd flick open
    this.fold = lerp(this.fold, this.foldGoal, 1 - Math.exp(-(this.foldGoal > this.fold ? 5 : 12) * dt));
    this.z = lerp(this.z, this.zGoal, 1 - Math.exp(-this.zRate * dt));
    this.head = lerp(this.head, this.headGoal, 1 - Math.exp(-10 * dt));
    if (this.fold < 0.6) this.wing += dt * TAU * 15;

    this.updateAbdomen(dt, T);
  }

  updatePerched(dt, T, world) {
    if (!world.leaves.includes(this.perch.leaf)) { this.startle(this.x, this.y + 1, world); return; }
    const pose = this.perchPose();
    this.x = pose.x; this.y = pose.y; this.h = pose.h;
    this.vx = this.vy = 0;
    this.zGoal = 0; this.zRate = 3;
    // a leaf knocked hard by a ripple or a fish shakes it loose
    const l = this.perch.leaf;
    if (Math.hypot(l.vx, l.vy) > 7 || Math.abs(l.vr) > 0.1) { this.startle(this.x - l.vx, this.y - l.vy, world); return; }

    this.flickIn -= dt;
    if (this.flick > 0) { this.flick -= dt; this.foldGoal = 0.5; }
    else this.foldGoal = 1;
    if (this.flickIn <= 0) { this.flick = rand(0.25, 0.6); this.flickIn = rand(3, 9); }
    this.headIn -= dt;
    if (this.headIn <= 0) { this.headGoal = rand(-0.4, 0.4); this.headIn = rand(0.6, 2.5); }

    this.timer -= dt;
    if (this.timer <= 0) this.startle(this.x - Math.cos(this.h) * 10, this.y - Math.sin(this.h) * 10, world);
  }

  updateFlight(dt, T, world) {
    this.flown += dt;
    this.foldGoal = 0;
    this.headGoal = 0;
    const sp0 = Math.hypot(this.vx, this.vy);
    const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
    const arrived = dist < 6 && sp0 < 30;

    switch (this.state) {
      case 'takeoff':
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'fly';
        break;
      case 'fly':
        if (arrived) { this.hover -= dt; if (this.hover <= 0) this.decide(world, T); }
        break;
      case 'chase': {
        const p = this.prey;
        this.timer -= dt;
        if (!p || !p.flying || this.timer <= 0) {
          this.cool = rand(14, 24); if (p) p.cool = rand(10, 18);
          this.state = 'fly'; this.prey = null;
          this.dartTo(this.pickDart(world, 80, 180, p || null), 30, rand(0.4, 0.9));
          break;
        }
        // tail it closely, weaving
        const wv = Math.sin(T * 7 + this.seed) * 14;
        const ph = Math.atan2(p.vy, p.vx);
        this.target = { x: p.x + p.vx * 0.12 - Math.sin(ph) * wv - Math.cos(ph) * 22, y: p.y + p.vy * 0.12 + Math.cos(ph) * wv - Math.sin(ph) * 22 };
        this.k = 36;
        this.look = Math.atan2(p.y - this.y, p.x - this.x);
        if (p.state === 'fly' || p.state === 'perched' || p.state === 'approach') {
          if (p.state === 'perched' || p.state === 'approach') p.startle(this.x, this.y, world);
          else if (Math.hypot(p.target.x - p.x, p.target.y - p.y) < 10) p.decide(world, T);
        }
        break;
      }
      case 'inspect': {
        this.timer -= dt;
        const dx = this.x - pointer.x, dy = this.y - pointer.y, d = Math.hypot(dx, dy) || 1;
        this.target = { x: pointer.x + dx / d * 58, y: pointer.y + dy / d * 58 };
        this.k = 14;
        this.look = Math.atan2(-dy, -dx);
        this.zGoal = 0.85;
        if (this.timer <= 0 || !pointer.active) { this.state = 'fly'; this.dartTo(this.pickDart(world, 90, 200, pointer), 30, rand(0.3, 0.8)); }
        break;
      }
      case 'approach': {
        if (!world.leaves.includes(this.perch.leaf)) { this.perch = null; this.state = 'fly'; this.decide(world, T); break; }
        const pose = this.perchPose();
        this.target = { x: pose.x, y: pose.y };
        const d = Math.hypot(pose.x - this.x, pose.y - this.y);
        // come in high, hover over the spot, then settle straight down
        if (d > 24) { this.k = 15; this.zGoal = 0.5; this.zRate = 2; this.look = Math.atan2(pose.y - this.y, pose.x - this.x); }
        else { this.k = 22; this.zGoal = 0; this.zRate = 1.5; this.look = pose.h; }
        if (d < 2.5 && this.z < 0.05) {
          this.state = 'perched';
          this.timer = rand(7, 22);
          this.flown = 0; this.energy = rand(5, 12); this.visits++;
          this.perch.leaf.impulse(0, 0, (Math.random() - 0.5) * 0.014);
        }
        break;
      }
      case 'dip':
        if (arrived && this.z < 0.16) {
          // the tip of the tail curls down to touch the water
          this.dipHold += dt;
          if (this.dipHold > 0.15 && !this.dipped) {
            this.dipped = true;
            const tip = this.abd[this.abd.length - 1];
            world.addRipple(tip.x, tip.y, { maxR: 20, strength: 0.28, rings: 2, life: 1.6 }); // too faint to startle anyone
          }
          if (this.dipHold > 0.5) { this.state = 'fly'; this.zGoal = 1; this.zRate = 2.4; this.dartTo(this.pickDart(world, 40, 110), 26, rand(0.3, 0.8)); }
        }
        break;
      case 'leave':
        if (this.x < -80 || this.x > world.W + 80 || this.y < -80 || this.y > world.H + 80) {
          this.state = 'away'; this.timer = rand(18, 40); this.perch = null;
        }
        break;
    }

    this.dip = lerp(this.dip, this.state === 'dip' && this.z < 0.2 ? 1 : 0, 1 - Math.exp(-6 * dt));

    // springy darts toward the target, with the tiny wobble of a hovering insect
    const wob = (this.state === 'approach' ? 0.6 : 2.2) * (0.3 + this.z);
    const tx = this.target.x + noise1(T * 2.6 + this.seed) * wob;
    const ty = this.target.y + noise1(T * 2.9 + this.seed + 40) * wob;
    const k = this.k, c = 2 * Math.sqrt(k) * 0.82;
    this.vx += ((tx - this.x) * k - c * this.vx) * dt;
    this.vy += ((ty - this.y) * k - c * this.vy) * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 460) { this.vx *= 460 / sp; this.vy *= 460 / sp; }
    this.x += this.vx * dt; this.y += this.vy * dt;

    // face where it's going when it moves fast; otherwise hold its gaze, yawing slightly
    let want = sp > 40 && this.state !== 'inspect' ? Math.atan2(this.vy, this.vx) : this.look + noise1(T * 0.7 + this.seed * 3) * 0.2;
    if (this.state === 'approach' && Math.hypot(this.target.x - this.x, this.target.y - this.y) < 24) want = this.look;
    this.h += clamp(angDiff(this.h, want) * 7, -9, 9) * dt;
  }

  // a stiff, slightly lagging tail: it trails through quick turns and bobs at rest
  updateAbdomen(dt, T) {
    const back = this.h + Math.PI;
    const seg = (this.L * 0.68) / (this.abd.length - 1);
    let px = this.x + Math.cos(back) * this.L * 0.07, py = this.y + Math.sin(back) * this.L * 0.07, pa = back;
    const bob = this.state === 'perched' ? Math.sin(T * 1.2 + this.seed) * 0.012 : 0;
    this.abd.forEach((p, i) => {
      const s = i / (this.abd.length - 1);
      p.a += angDiff(p.a, pa + bob) * (1 - Math.exp(-(26 - i * 2) * dt));
      const fore = 1 - this.dip * 0.55 * Math.pow(s, 1.4); // curling down toward the water foreshortens it
      if (i === 0) { p.x = px; p.y = py; }
      else { p.x = px + Math.cos(p.a) * seg * fore; p.y = py + Math.sin(p.a) * seg * fore; }
      px = p.x; py = p.y; pa = p.a;
    });
  }

  hullPoints() {
    if (this.state === 'away') return null;
    const s = 1 + 0.18 * this.z, L = this.L, ch = Math.cos(this.h), sh = Math.sin(this.h);
    const pts = [];
    const push = (fwd, side) => pts.push({ x: this.x + (ch * fwd - sh * side) * s, y: this.y + (sh * fwd + ch * side) * s });
    push(L * 0.16, 0);
    const span = lerp(L * 0.48, L * 0.09, this.fold);
    for (const side of [1, -1]) { push(-L * 0.02, side * span); push(-L * 0.3, side * span * 0.8); }
    for (const q of [this.abd[4], this.abd[this.abd.length - 1]]) pts.push({ x: this.x + (q.x - this.x) * s, y: this.y + (q.y - this.y) * s });
    return pts;
  }

  drawShadow(ctx) {
    if (this.state === 'away') return;
    const o = 2 + 40 * this.z, alpha = 0.075 * (1 - this.z * 0.45);
    ctx.save();
    ctx.translate(o * 0.55, o);
    ctx.fillStyle = rgba([30, 36, 30], alpha);
    ribbon(ctx, this.abd, this.L * 0.06, this.L * 0.04);
    const spread = (1 - this.fold);
    for (const side of [1, -1]) {
      const a = this.h + side * lerp(Math.PI - 0.06, Math.PI / 2 + 0.25, spread);
      const cx = this.x + Math.cos(a) * this.L * 0.22, cy = this.y + Math.sin(a) * this.L * 0.22;
      ctx.fillStyle = rgba([30, 36, 30], alpha * 0.55);
      ctx.beginPath(); ctx.ellipse(cx, cy, this.L * 0.24, this.L * 0.06 * (1 + spread), a, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawWing(ctx, bx, by, a, len, wd, alpha, mirror) {
    const P = this.pal;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    ctx.scale(1, mirror);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.16, -wd * 0.16);
    ctx.quadraticCurveTo(len * 0.55, -wd * 1.05, len * 0.95, -wd * 0.48);
    ctx.quadraticCurveTo(len * 1.04, 0, len * 0.93, wd * 0.42);
    ctx.quadraticCurveTo(len * 0.55, wd * 0.86, len * 0.16, wd * 0.14);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, rgba(P.wing, 0.34 * alpha));
    g.addColorStop(1, rgba(P.wing, 0.12 * alpha));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.36 * alpha);
    ctx.lineWidth = 0.45;
    ctx.stroke();
    // veins
    ctx.strokeStyle = rgba(INK, 0.16 * alpha);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(len * 0.14, -wd * 0.05); ctx.quadraticCurveTo(len * 0.55, -wd * 0.62, len * 0.9, -wd * 0.32);
    ctx.moveTo(len * 0.18, wd * 0.05); ctx.quadraticCurveTo(len * 0.55, wd * 0.35, len * 0.9, wd * 0.18);
    for (let i = 1; i < 5; i++) { const x = len * (0.3 + i * 0.13); ctx.moveTo(x, -wd * 0.5); ctx.lineTo(x + len * 0.02, wd * 0.35); }
    ctx.stroke();
    // the dark pterostigma near the tip
    ctx.fillStyle = rgba(P.stigma, 0.78 * alpha);
    ctx.beginPath(); ctx.ellipse(len * 0.85, -wd * 0.36, len * 0.04, wd * 0.18, -0.15, 0, TAU); ctx.fill();
    ctx.restore();
  }

  draw(ctx, T) {
    if (this.state === 'away') return;
    const P = this.pal, L = this.L, j = this.jit;
    const s = 1 + 0.18 * this.z;
    const ch = Math.cos(this.h), sh = Math.sin(this.h);
    const at = (fwd, side) => ({ x: this.x + ch * fwd - sh * side, y: this.y + sh * fwd + ch * side });
    ctx.save();
    ctx.translate(this.x, this.y); ctx.scale(s, s); ctx.translate(-this.x, -this.y);

    // ---- abdomen: a needle of ink with pale rings and a coloured tip
    const thoraxRear = at(-L * 0.06, 0);
    const pts = [thoraxRear, ...this.abd.slice(1)];
    ctx.fillStyle = rgba(P.body, 0.16);
    ribbon(ctx, pts, L * 0.08, L * 0.05);
    ctx.fillStyle = rgba(P.body, 0.85);
    ribbon(ctx, pts, L * 0.05, L * 0.032);
    ctx.fillStyle = rgba(P.accent, 0.75);
    ribbon(ctx, pts.slice(-3), L * 0.04, L * 0.034);
    ctx.fillStyle = rgba(INK, 0.3);
    ribbon(ctx, pts.slice(0, -2), L * 0.014, L * 0.008);
    ctx.strokeStyle = 'rgba(242,238,226,0.38)';
    ctx.lineWidth = 0.45;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], a = this.abd[i].a, w = L * 0.026 * (1 - i * 0.03);
      ctx.beginPath();
      ctx.moveTo(p.x - Math.sin(a) * w, p.y + Math.cos(a) * w);
      ctx.lineTo(p.x + Math.sin(a) * w, p.y - Math.cos(a) * w);
      ctx.stroke();
    }
    const tip = pts[pts.length - 1], ta = this.abd[this.abd.length - 1].a;
    ctx.fillStyle = rgba(INK, 0.6);
    for (const d of [-0.45, 0.45]) ribbon(ctx, [tip, { x: tip.x + Math.cos(ta + d) * L * 0.04, y: tip.y + Math.sin(ta + d) * L * 0.04 }], 0.9, 0.2);

    // ---- legs, splayed when it rests on a leaf
    const legVis = smoothstep(0.4, 0.9, this.fold) * (1 - this.z);
    if (legVis > 0.02) {
      ctx.fillStyle = rgba(INK, 0.55 * legVis);
      for (const side of [1, -1]) {
        [0.75, 1.55, 2.3].forEach((la, k) => {
          const b = at(L * (0.03 - k * 0.025), side * L * 0.02);
          const a1 = this.h + side * la, a2 = a1 + side * (k === 0 ? -0.6 : 0.5);
          const knee = { x: b.x + Math.cos(a1) * L * 0.07, y: b.y + Math.sin(a1) * L * 0.07 };
          const foot = { x: knee.x + Math.cos(a2) * L * 0.07, y: knee.y + Math.sin(a2) * L * 0.07 };
          ribbon(ctx, [b, knee, foot], 0.8, 0.3);
        });
      }
    }

    // ---- wings: blurred into ghosts when beating, folded in a stack along the tail at rest
    const open = 1 - this.fold;
    const len = L * 0.44, wd = L * 0.062;
    const beating = open > 0.5 && this.state !== 'perched';
    const ghosts = beating ? [[0, 0.55], [0.7, 0.32], [1.4, 0.18]] : [[0, 1]];
    for (const hind of [true, false]) {
      for (const side of [1, -1]) {
        const base = at(hind ? -L * 0.035 : L * 0.025, side * L * 0.022);
        for (const [lag, ga] of ghosts) {
          const ph = this.wing - lag + (hind ? 2.3 : 0);
          const sweep = beating ? 0.32 * Math.sin(ph) : 0.05;
          const openA = Math.PI / 2 + (hind ? 0.28 : 0.1) + sweep;
          const foldA = Math.PI - (hind ? 0.03 : 0.07);
          const a = this.h + side * lerp(foldA, openA, open);
          const lk = beating ? 1 - 0.22 * (0.5 + 0.5 * Math.cos(ph)) : 1;
          this.drawWing(ctx, base.x, base.y, a, len * lk * (hind ? 0.97 : 1), wd, ga, side);
        }
      }
    }

    // ---- thorax, banded with ink
    const tc = at(L * 0.01, 0);
    softBlob(ctx, tc.x, tc.y, L * 0.085, L * 0.044, this.h, j, [
      [1.18, rgba(P.accent, 0.16)], [1, rgba(P.accent, 0.7)], [0.62, rgba(P.body, 0.5)],
    ], { amt: 0.06 });
    ctx.fillStyle = rgba(INK, 0.5);
    for (const side of [1, -1]) ribbon(ctx, [at(L * 0.07, side * L * 0.016), at(-L * 0.06, side * L * 0.02)], 0.9, 0.4);

    // ---- head: two big eyes like a dumbbell, turning a little as it looks about
    const hc = at(L * 0.11, 0), ha = this.h + this.head;
    softBlob(ctx, hc.x, hc.y, L * 0.028, L * 0.05, ha, j, [[1, rgba(P.body, 0.85)]], { amt: 0.05, off: 30 });
    for (const side of [1, -1]) {
      const ex = hc.x - Math.sin(ha) * side * L * 0.05, ey = hc.y + Math.cos(ha) * side * L * 0.05;
      softBlob(ctx, ex, ey, L * 0.034, L * 0.032, ha, j, [[1.25, rgba(P.eye, 0.22)], [1, rgba(P.eye, 0.92)]], { amt: 0.05, off: side > 0 ? 50 : 70 });
      ctx.fillStyle = 'rgba(250,248,240,0.7)';
      ctx.beginPath(); ctx.arc(ex + Math.cos(ha) * L * 0.01, ey + Math.sin(ha) * L * 0.01, L * 0.009, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

/* ==================================================================
   The pond
   ================================================================== */

const scene = document.getElementById('scene');
const ditherCanvas = document.getElementById('dither');
const overlayCanvas = document.getElementById('overlay');
const header = document.querySelector('.site-header');
const ditherCtx = ditherCanvas.getContext('2d');
const overlayCtx = overlayCanvas.getContext('2d');
const tone = makeCanvas(1, 1);
const toneCtx = tone.getContext('2d');
// creatures are drawn on their own transparent layer first, so we can lay a soft
// blurred copy beneath them: that halo dithers into the scattered dots at their edges
const creatures = makeCanvas(1, 1), creaturesCtx = creatures.getContext('2d');
const haloSmall = makeCanvas(1, 1), haloCtx = haloSmall.getContext('2d');
const HALO_DOWN = 4;

const world = {
  W: window.innerWidth, H: window.innerHeight, textRight: 0, mobile: false,
  koi: [], tadpoles: [], shrimp: [], shrimpGroups: [], damsels: [], ripples: [], food: [], leaves: [],
  T: 0,
  addRipple(x, y, opts) { this.ripples.push(new Ripple(x, y, opts, this.T)); },
  underLeaf(x, y) { return this.leaves.some(l => Math.hypot(l.x - x, l.y - y) < l.R * 0.95); },
};

const grainTile = makeGrainTile(160);

/* ---------- 1-bit dithering ---------- */

// A fixed field of random thresholds. Because it never changes, still things stay
// still; only what moves crawls with dots, like grain in old film.
const THR_SIZE = 128;
const THR = (() => {
  const r = mulberry32(2718);
  return Uint8Array.from({ length: THR_SIZE * THR_SIZE }, () => 1 + Math.floor(r() * 253));
})();
const INK_PX = 0xff0d0d0d;   // ABGR, little-endian: near-black
const PAPER_PX = 0xffffffff; // pure white

// tone curve: luminance → ink density, with a little extra contrast so cores go
// solid and soft edges scatter into loose dots
const TONE = Uint8Array.from({ length: 256 }, (_, L) => {
  const d = 1 - L / 255;
  return Math.round(Math.pow(clamp((d - 0.015) / 0.72, 0, 1), 0.8) * 255);
});
const toneLut = new Uint8Array(256);

let TW = 1, TH = 1, outImg = null, out32 = null;

function ditherInto(src, w, h, out, density = 1) {
  for (let i = 0; i < 256; i++) toneLut[i] = TONE[i] * density;
  for (let y = 0; y < h; y++) {
    const row = (y & (THR_SIZE - 1)) * THR_SIZE, o = y * w;
    for (let x = 0; x < w; x++) {
      const i = (o + x) << 2;
      const L = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
      out[o + x] = toneLut[L] > THR[row + (x & (THR_SIZE - 1))] ? INK_PX : PAPER_PX;
    }
  }
}

function sizeCanvases() {
  world.W = window.innerWidth;
  world.H = window.innerHeight;
  TW = Math.ceil(world.W / PX); TH = Math.ceil(world.H / PX);
  tone.width = TW; tone.height = TH;
  creatures.width = TW; creatures.height = TH;
  haloSmall.width = Math.ceil(TW / HALO_DOWN); haloSmall.height = Math.ceil(TH / HALO_DOWN);
  ditherCanvas.width = TW; ditherCanvas.height = TH;
  ditherCanvas.style.width = TW * PX + 'px';
  ditherCanvas.style.height = TH * PX + 'px';
  outImg = ditherCtx.createImageData(TW, TH);
  out32 = new Uint32Array(outImg.data.buffer);
  overlayCanvas.width = Math.round(world.W * SCREEN_DPR);
  overlayCanvas.height = Math.round(world.H * SCREEN_DPR);
  const r = header.getBoundingClientRect();
  world.textRight = r.right - parseFloat(getComputedStyle(header).paddingRight) + 12;
  world.mobile = world.W - world.textRight < 300;
}

/* ---------- leaf layout ---------- */

function leafSpecs() {
  const { W, H, textRight, mobile } = world;
  if (!mobile) {
    const avail = W - textRight;
    const R1 = clamp(Math.min(avail * 0.4, H * 0.27), 120, 300);
    return [
      { key: 'main', x: textRight + avail * 0.56, y: H * 0.6, R: R1, seed: 2024, rot: -0.3, delay: 0.35 },
      { key: 'corner', x: W - R1 * 0.22, y: R1 * 0.12, R: R1 * 1.08, seed: 777, rot: 2.1, delay: 0.75 },
      { key: 'low', x: textRight + avail * 0.27, y: H - R1 * 0.08, R: R1 * 0.5, seed: 4242, rot: 1.2, delay: 1.1 },
      { key: 'tiny', x: W - R1 * 0.32, y: H * 0.94, R: R1 * 0.34, seed: 909, rot: -1.4, delay: 1.35 },
    ];
  }
  const R1 = clamp(W * 0.34, 90, 170);
  return [
    { key: 'corner', x: W - R1 * 0.18, y: R1 * 0.08, R: R1, seed: 777, rot: 2.1, delay: 0.35, alpha: 0.5 },
    { key: 'main', x: W + R1 * 0.12, y: H * 0.64, R: R1 * 0.75, seed: 2024, rot: -0.3, delay: 0.7, alpha: 0.5 },
    { key: 'low', x: W * 0.12, y: H + R1 * 0.2, R: R1 * 0.7, seed: 4242, rot: 1.2, delay: 1.0, alpha: 0.5 },
  ];
}

let layoutSig = '';
function buildLeaves(animate, T) {
  const specs = leafSpecs();
  const sig = specs.map(s => s.key + Math.round(s.R / 12)).join('|');
  if (sig === layoutSig && world.leaves.length) {
    // same leaves, new anchors
    specs.forEach((s, i) => { world.leaves[i].ax = s.x; world.leaves[i].ay = s.y; world.leaves[i].alpha = s.alpha ?? 1; });
    return;
  }
  layoutSig = sig;
  world.leaves = specs.map(s => {
    const leaf = new Leaf(s, paintLeaf(s.R, s.seed, grainTile));
    if (animate) leaf.start = T + s.delay;
    else leaf.finish();
    leaf.update(0, T);
    return leaf;
  });
}

/* ---------- creatures ---------- */

function spawnCreatures() {
  const { W, H, mobile } = world;
  const inside = REDUCED;
  const koiSpecs = [
    { x: inside ? W * 0.62 : W + 70, y: H * 0.42, heading: Math.PI * 1.05, len: 68, color: VERMILION, seed: 11 },
    { x: inside ? W * 0.85 : W * 0.72, y: inside ? H * 0.3 : H + 70, heading: -Math.PI * 0.6, len: 58, color: { main: [58, 58, 58], deep: [14, 14, 14], light: [140, 140, 140] }, seed: 23 },
    { x: inside ? W * 0.7 : W + 120, y: H * 0.8, heading: Math.PI * 0.95, len: 50, color: { main: [36, 36, 36], deep: [6, 6, 6], light: [110, 110, 110] }, seed: 37 },
  ];
  world.koi = (mobile ? koiSpecs.slice(0, 2) : koiSpecs).map(s => new Koi(s));
  const gx = mobile ? W * 0.55 : lerp(world.textRight, W, 0.45), gy = inside ? H * 0.2 : -40;
  world.tadpoles = Array.from({ length: mobile ? 4 : 6 }, (_, i) =>
    new Tadpole(gx + rand(-40, 40), gy + rand(-30, 10) - i * 6, Math.PI * 0.5 + rand(-0.3, 0.3), 100 + i * 13));

  // shrimp graze the bottom in small groups
  const left = mobile ? W * 0.2 : world.textRight + 60;
  const groupSpots = mobile ? [[W * 0.6, H * 0.82]] : [[lerp(left, W, 0.3), H * 0.86], [lerp(left, W, 0.82), H * 0.38]];
  world.shrimpGroups = groupSpots.map(([x, y]) => new ShrimpGroup(x, y));
  world.shrimp = [];
  world.shrimpGroups.forEach((g, gi) => {
    for (let i = 0; i < (mobile ? 3 : 4); i++) world.shrimp.push(new Shrimp(g, g.x + rand(-40, 40), g.y + rand(-25, 25), 300 + gi * 17 + i * 5));
  });

  // damselflies arrive once the pads have developed
  world.damsels = [new Damselfly({ palette: DAMSEL_PALETTES.indigo, seed: 501, delay: 3.2, scale: mobile ? 0.85 : 1 })];
  if (!mobile) world.damsels.push(new Damselfly({ palette: DAMSEL_PALETTES.vermilion, seed: 777, delay: 24 }));

  world.tracks = makeTracks();
}

/* ---------- tracking: every creature gets a hull and an ID, like a detector's output ---------- */

function makeTracks() {
  const koiIds = ['#1', '#214', '#377'], flyIds = ['#856', '#902'], shrimpIds = ['#853', '#611'];
  const tracks = [];
  world.koi.forEach((k, i) => tracks.push({
    id: koiIds[i], kind: 'KOI', primary: i === 0, seed: i * 7.3,
    pts: () => k.hullPoints(),
    state: () => k.flee > 0 ? 'FLEE' : k.goal ? (k.goal.kind === 'food' ? 'FEED' : 'CURIOUS') : k.mood.toUpperCase(),
  }));
  world.damsels.forEach((d, i) => tracks.push({
    id: flyIds[i], kind: 'DAMSELFLY', seed: 20 + i * 5.1,
    pts: () => d.hullPoints(),
    state: () => d.state === 'perched' ? 'PERCHED' : d.state.toUpperCase(),
  }));
  world.shrimpGroups.forEach((g, i) => {
    const members = world.shrimp.filter(s => s.group === g);
    tracks.push({
      id: shrimpIds[i], kind: `SHRIMP ×${members.length}`, seed: 40 + i * 3.7,
      pts: () => {
        const pts = [];
        for (const m of members) {
          const S = m.spine, a = Math.atan2(S[0].y - S[2].y, S[0].x - S[2].x), L = m.L;
          const ca = Math.cos(a), sa = Math.sin(a);
          pts.push({ x: S[0].x + ca * L * 0.7, y: S[0].y + sa * L * 0.7 });
          pts.push({ x: S[0].x - sa * L * 0.22, y: S[0].y + ca * L * 0.22 });
          pts.push({ x: S[0].x + sa * L * 0.22, y: S[0].y - ca * L * 0.22 });
          pts.push({ x: S[S.length - 1].x, y: S[S.length - 1].y });
        }
        return pts;
      },
      state: () => members.some(m => m.flick > 0) ? 'ESCAPE'
        : members.filter(m => m.mode === 'graze').length * 2 >= members.length ? 'GRAZE' : 'FORAGE',
    });
  });
  tracks.push({
    id: '#40', kind: `TADPOLE ×${world.tadpoles.length}`, seed: 60,
    pts: () => {
      const pts = [];
      for (const t of world.tadpoles) {
        const r = t.r * 1.7, e = t.spine[t.spine.length - 1];
        pts.push({ x: t.x - r, y: t.y - r }, { x: t.x + r, y: t.y - r }, { x: t.x - r, y: t.y + r }, { x: t.x + r, y: t.y + r }, { x: e.x, y: e.y });
      }
      return pts;
    },
    state: () => world.tadpoles.some(t => t.flee > 0) ? 'SCATTER' : 'SCHOOL',
  });
  return tracks;
}

// monotone-chain convex hull
function convexHull(pts) {
  if (pts.length < 3) return pts;
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
function insidePoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

function tag(g, x, y, text, dark, alpha = 1) {
  g.font = `600 10px ${MONO}`;
  const w = Math.ceil(g.measureText(text).width) + 8;
  g.globalAlpha = alpha;
  g.fillStyle = dark ? '#0d0d0d' : 'rgba(13,13,13,0.45)';
  g.fillRect(Math.round(x), Math.round(y), w, 15);
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(text, Math.round(x) + 4, Math.round(y) + 8);
  g.globalAlpha = 1;
  return w;
}

let fps = 60;
function drawOverlay(T, dt) {
  const g = overlayCtx, { W, H } = world;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  g.setTransform(SCREEN_DPR, 0, 0, SCREEN_DPR, 0, 0);
  g.lineJoin = 'miter';

  let visible = 0;
  for (const tr of world.tracks || []) {
    const pts = tr.pts();
    if (!pts || pts.length < 3) continue;
    const hull = convexHull(pts);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, top = hull[0];
    for (const q of hull) {
      minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
      if (q.y < top.y) top = q;
    }
    if (maxX < 0 || minX > W || maxY < 0 || minY > H) continue;
    visible++;
    const hot = pointer.active && insidePoly(pointer.x, pointer.y, hull);

    g.strokeStyle = hot ? 'rgba(13,13,13,0.85)' : 'rgba(13,13,13,0.3)';
    g.lineWidth = hot ? 1 : 0.75;
    g.beginPath();
    hull.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y));
    g.closePath();
    g.stroke();
    if (hot) {
      // corner ticks on the hovered target's bounding box
      g.strokeStyle = '#0d0d0d'; g.lineWidth = 1.5;
      const c = 7, b = [[minX - 4, minY - 4, 1, 1], [maxX + 4, minY - 4, -1, 1], [minX - 4, maxY + 4, 1, -1], [maxX + 4, maxY + 4, -1, -1]];
      g.beginPath();
      for (const [x, y, sx, sy] of b) { g.moveTo(x, y + sy * c); g.lineTo(x, y); g.lineTo(x + sx * c, y); }
      g.stroke();
    }

    const conf = (0.94 + 0.05 * noise1(T * 0.4 + tr.seed)).toFixed(2);
    const text = hot ? `${tr.id}  ${tr.kind} ${conf}  ·  ${tr.state()}` : tr.id;
    tag(g, clamp(top.x - 6, 4, W - 60), clamp(top.y - 22, 4, H - 20), text, tr.primary || hot);
  }

  // click reticles: where the food went in
  world.reticles = (world.reticles || []).filter(r => T - r.t < 1.6);
  for (const r of world.reticles) {
    const e = (T - r.t) / 1.6, a = 1 - e * e;
    const k = 12 + 6 * easeOutCubic(Math.min(1, e * 3));
    g.strokeStyle = `rgba(13,13,13,${0.8 * a})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(r.x - k, r.y); g.lineTo(r.x - 4, r.y); g.moveTo(r.x + 4, r.y); g.lineTo(r.x + k, r.y);
    g.moveTo(r.x, r.y - k); g.lineTo(r.x, r.y - 4); g.moveTo(r.x, r.y + 4); g.lineTo(r.x, r.y + k);
    const b = k + 6, c = 5;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.moveTo(r.x + sx * b, r.y + sy * (b - c)); g.lineTo(r.x + sx * b, r.y + sy * b); g.lineTo(r.x + sx * (b - c), r.y + sy * b);
    }
    g.stroke();
    tag(g, r.x + b + 6, r.y - b, `FOOD ×${r.n}  (${Math.round(r.x)}, ${Math.round(r.y)})`, true, a);
  }

  // HUD
  if (dt > 0) fps = lerp(fps, 1 / dt, 0.05);
  g.font = `500 10px ${MONO}`;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'right';
  g.fillStyle = 'rgba(13,13,13,0.5)';
  g.fillText(`TRACKING ${String(visible).padStart(2, '0')} · ${Math.round(fps)} FPS · ${TW}×${TH} 1-BIT`, W - 14, H - 12);
  g.textAlign = 'left';
}

/* ---------- interaction ---------- */

const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, last: 0, active: false };

window.addEventListener('pointermove', (e) => {
  const now = performance.now() / 1000;
  const dt = Math.max(0.008, now - pointer.last);
  const vx = (e.clientX - pointer.x) / dt, vy = (e.clientY - pointer.y) / dt;
  if (pointer.active) { pointer.vx = lerp(pointer.vx, vx, 0.5); pointer.vy = lerp(pointer.vy, vy, 0.5); }
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.last = now; pointer.active = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { pointer.active = false; });

// Click to toss a pinch of food; keep the button down and drag to sprinkle a trail
const MAX_FOOD = 70;
function sprinkle(x, y, count, spread, T) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU, r = spread * Math.sqrt(Math.random());
    world.food.push(new Food(x + Math.cos(a) * r, y + Math.sin(a) * r, T + 0.08 + Math.random() * 0.35));
  }
  if (world.food.length > MAX_FOOD) world.food.splice(0, world.food.length - MAX_FOOD);
}
let sprinkling = null;
scene.addEventListener('pointerdown', (e) => {
  if (REDUCED) return;
  const x = e.clientX, y = e.clientY, T = world.T;
  world.addRipple(x, y, { maxR: 70, strength: 0.85, rings: 3, life: 2.6 });
  // only the fish right underneath bolt; they come straight back for the food
  for (const k of world.koi) { const d = Math.hypot(k.x - x, k.y - y); if (d < 70) k.scare(x, y, 0.5); }
  for (const t of world.tadpoles) if (Math.hypot(t.x - x, t.y - y) < 60) t.scare(x, y);
  for (const s of world.shrimp) if (Math.hypot(s.x - x, s.y - y) < 110) s.scare(x, y);
  for (const d of world.damsels) if (Math.hypot(d.x - x, d.y - y) < 150) d.startle(x, y, world);
  const n = 6 + ((Math.random() * 4) | 0);
  sprinkle(x, y, n, 34, T);
  (world.reticles = world.reticles || []).push({ x, y, t: T, n });
  sprinkling = { x, y, t: T };
});
window.addEventListener('pointermove', (e) => {
  if (!sprinkling || !(e.buttons & 1)) { sprinkling = null; return; }
  const T = world.T;
  const d = Math.hypot(e.clientX - sprinkling.x, e.clientY - sprinkling.y);
  if (d > 26 || T - sprinkling.t > 0.12) {
    sprinkle(e.clientX, e.clientY, 2, 14, T);
    sprinkling = { x: e.clientX, y: e.clientY, t: T };
  }
}, { passive: true });
window.addEventListener('pointerup', () => { sprinkling = null; });
window.addEventListener('pointercancel', () => { sprinkling = null; });

function interact(dt, T) {
  // fish choose: food first, otherwise a still cursor makes the nearest one curious
  const food = world.food.filter(f => f.alive(T) && T > f.born);
  const pointerStill = pointer.active && T - pointer.last > 0.7;
  let curious = null;
  if (pointerStill && !food.length) {
    let best = 320;
    for (const k of world.koi) { const d = Math.hypot(k.x - pointer.x, k.y - pointer.y); if (d < best) { best = d; curious = k; } }
  }
  for (const k of world.koi) {
    k.goal = null;
    let best = 560;
    for (const f of food) {
      const d = Math.hypot(f.x - k.x, f.y - k.y);
      if (d < best) { best = d; k.goal = { kind: 'food', x: f.x, y: f.y, f }; }
    }
    if (k.goal && best < k.W + 5) {
      k.goal.f.eaten = true;
      world.addRipple(k.goal.f.x, k.goal.f.y, { maxR: 24, strength: 0.6, rings: 2, life: 1.6 });
      k.burst = Math.max(k.burst, 0.5);
    }
    if (!k.goal && k === curious) k.goal = { kind: 'curious', x: pointer.x, y: pointer.y };

    // a quick swish of the cursor right over a fish startles it
    const ps = Math.hypot(pointer.vx, pointer.vy);
    if (pointer.active && T - pointer.last < 0.05 && ps > 900 && Math.hypot(k.x - pointer.x, k.y - pointer.y) < 90) k.scare(pointer.x, pointer.y, 0.8);
  }

  // ripples nudge leaves (once each) and drift away
  for (const r of world.ripples) {
    const front = r.radius(T);
    for (const l of world.leaves) {
      if (r.hit.has(l)) continue;
      const dx = l.x - r.x, dy = l.y - r.y, d = Math.hypot(dx, dy) || 1;
      if (front >= d - l.R * 0.85) {
        r.hit.add(l);
        const f = r.strength * 34 / (1 + d / 160);
        l.impulse(dx / d * f, dy / d * f, (Math.random() - 0.5) * 0.12 * r.strength);
      }
    }
  }

  // the cursor stirs the water under the leaves
  if (pointer.active && T - pointer.last < 0.05) {
    for (const l of world.leaves) {
      const d = Math.hypot(l.x - pointer.x, l.y - pointer.y);
      if (d < l.R) {
        const k = (1 - d / l.R) * 0.035;
        l.impulse(pointer.vx * k * dt, pointer.vy * k * dt, 0);
      }
    }
  }
}

/* ---------- loop ---------- */

let lastT = performance.now() / 1000;
let T0 = lastT;

// a soft cloud of stipple drifting in from the top-right corner
function drawHaze(g) {
  const { W, H, mobile } = world, r = Math.max(W, H) * (mobile ? 0.26 : 0.3);
  const hz = g.createRadialGradient(W, 0, 0, W, 0, r);
  hz.addColorStop(0, 'rgba(0,0,0,0.42)');
  hz.addColorStop(0.3, 'rgba(0,0,0,0.1)');
  hz.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hz;
  g.fillRect(W - r, 0, r, r);
}

// draw a group of creatures onto the tone canvas with a soft blurred shadow-halo
// beneath them (shrink to 1/HALO_DOWN and back up: a cheap blur that works everywhere)
function withHalo(g, strength, drawFn) {
  const c = creaturesCtx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, TW, TH);
  c.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  drawFn(c);
  haloCtx.clearRect(0, 0, haloSmall.width, haloSmall.height);
  haloCtx.imageSmoothingEnabled = true;
  haloCtx.drawImage(creatures, 0, 0, haloSmall.width, haloSmall.height);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.globalAlpha = strength;
  g.drawImage(haloSmall, 0, 0, haloSmall.width * HALO_DOWN, haloSmall.height * HALO_DOWN);
  g.globalAlpha = 1;
  g.drawImage(creatures, 0, 0);
  g.restore();
}

// draw the whole scene in greyscale, then threshold it to 1-bit
function render(T, dt) {
  const g = toneCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, TW, TH);
  g.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  drawHaze(g);
  withHalo(g, 0.6, (c) => {
    for (const s of world.shrimp) s.draw(c, T);
    for (const k of world.koi) if (k.depth > 0.55) k.draw(c, T);
    for (const t of world.tadpoles) t.draw(c);
    for (const k of [...world.koi].sort((a, b) => b.depth - a.depth)) if (k.depth <= 0.55) k.draw(c, T);
  });
  for (const f of world.food) if (T >= f.born) f.draw(g, T);
  for (const r of world.ripples) r.draw(g, T);
  for (const l of world.leaves) l.draw(g);
  for (const d of world.damsels) d.drawShadow(g);
  withHalo(g, 0.5, (c) => { for (const d of [...world.damsels].sort((a, b) => a.z - b.z)) d.draw(c, T); });

  // on load the whole frame "develops": density ramps up from blank paper
  const develop = REDUCED ? 1 : smoothstep(0, 1.6, T - T0);
  ditherInto(g.getImageData(0, 0, TW, TH).data, TW, TH, out32, develop);
  ditherCtx.putImageData(outImg, 0, 0);
  drawOverlay(T, dt);
}

function frame(now) {
  const T = now / 1000;
  const dt = Math.min(0.05, Math.max(0, T - lastT));
  lastT = T;
  world.T = T;

  interact(dt, T);
  for (const k of world.koi) k.update(dt, T, world);
  for (const t of world.tadpoles) t.update(dt, T, world);
  for (const g of world.shrimpGroups) g.update(dt, T, world);
  for (const s of world.shrimp) s.update(dt, T, world);
  world.food = world.food.filter(f => f.alive(T));
  for (const f of world.food) {
    if (!f.landed && T >= f.born) {
      f.landed = true; // each pellet lands with a tiny plink
      world.addRipple(f.x, f.y, { maxR: rand(9, 15), strength: 0.45, rings: 1, life: 1.2 });
    }
  }
  world.ripples = world.ripples.filter(r => r.age(T) <= 1);
  for (const l of world.leaves) { l.bloom(T); l.update(dt, T); }
  for (const d of world.damsels) d.update(dt, T, world);

  render(T, dt);
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */

document.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--i', i));

let booted = false;
function boot() {
  booted = true;
  sizeCanvases();
  T0 = performance.now() / 1000;
  world.T = lastT = T0;
  buildLeaves(!REDUCED, T0);
  spawnCreatures();
  document.documentElement.classList.add('ready');

  if (REDUCED) {
    // a still picture: settle the creatures into place and draw once
    for (let i = 0; i < 240; i++) {
      for (const k of world.koi) k.update(1 / 60, T0 + i / 60, world);
      for (const t of world.tadpoles) t.update(1 / 60, T0 + i / 60, world);
      for (const s of world.shrimp) s.update(1 / 60, T0 + i / 60, world);
    }
    const d = world.damsels[0], p = d.pickPerch(world);
    if (p) {
      d.perch = p; d.state = 'perched'; d.fold = d.foldGoal = 1; d.z = d.zGoal = 0;
      const pose = d.perchPose();
      d.x = pose.x; d.y = pose.y; d.h = pose.h;
      d.abd.forEach(q => { q.a = d.h + Math.PI; });
      d.updateAbdomen(0, T0);
    }
    render(T0, 0);
  } else {
    requestAnimationFrame(frame);
  }
}

// a page opened in a hidden or zero-sized frame waits until it has a size
if (window.innerWidth > 0 && window.innerHeight > 0) boot();

let resizeTimer = 0;
window.addEventListener('resize', () => {
  if (!booted) { if (window.innerWidth > 0 && window.innerHeight > 0) boot(); return; }
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    sizeCanvases();
    buildLeaves(false, world.T);
    if (REDUCED) render(world.T, 0);
  }, 150);
});

})();
