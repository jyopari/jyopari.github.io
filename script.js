// Utilities
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rand = (min, max) => Math.random() * (max - min) + min;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI*2;
const lerp = (a,b,t) => a+(b-a)*t;

// Scene elements
const canvasWater = document.getElementById('water');
const canvasFish = document.getElementById('fish');
const padsLayer = document.getElementById('pads');
const ctxWater = canvasWater.getContext('2d');
const ctxFish = canvasFish.getContext('2d');

const DPR = Math.min(2, window.devicePixelRatio || 1);

function resizeCanvases() {
  const { innerWidth: w, innerHeight: h } = window;
  [canvasWater, canvasFish].forEach((c) => {
    c.width = Math.floor(w * DPR);
    c.height = Math.floor(h * DPR);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
  });
}

resizeCanvases();
window.addEventListener('resize', resizeCanvases);

// Water subtle movement
let waterT = 0;
function drawWater(t) {
  waterT += 0.0025;
  const w = canvasWater.width, h = canvasWater.height;
  ctxWater.clearRect(0,0,w,h);
  // Soft radial gradients drifting to mimic caustics
  for (let i = 0; i < 6; i++) {
    const gx = (Math.sin(waterT * 1.2 + i) * 0.35 + 0.5) * w;
    const gy = (Math.cos(waterT * 0.9 + i * 0.7) * 0.35 + 0.5) * h;
    const r = Math.max(w,h) * (0.35 + i*0.06);
    const g = ctxWater.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, 'rgba(0,60,80,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctxWater.fillStyle = g;
    ctxWater.beginPath();
    ctxWater.arc(gx, gy, r, 0, Math.PI*2);
    ctxWater.fill();
  }
}

// Pads
const PAD_IMAGES = [
  'assets/lilypad_1.png',
  'assets/lilypad_2.png',
  'assets/lilypad_3.png'
];

const pads = [];
function spawnPads() {
  padsLayer.innerHTML = '';
  pads.length = 0;
  const { innerWidth: w, innerHeight: h } = window;
  // Fixed anchor positions all on the right-hand side
  const anchors = [
    { fx: 0.68, fy: 0.20, size: 180 }, // top-right
    { fx: 0.88, fy: 0.50, size: 200 }, // center-right
    { fx: 0.62, fy: 0.78, size: 170 }, // lower-right
    { fx: 0.75, fy: 0.35, size: 160 }, // mid-right
    { fx: 0.85, fy: 0.15, size: 140 }  // upper-right
  ];

  anchors.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = 'pad';
    const img = document.createElement('img');
    img.src = PAD_IMAGES[i % PAD_IMAGES.length];
    el.appendChild(img);
    padsLayer.appendChild(el);
    const baseSize = a.size;
    const size = w < 680 ? Math.round(baseSize * 0.75) : baseSize;
    img.style.width = size + 'px';

    const pad = {
      el,
      ax: a.fx * w,
      ay: a.fy * h,
      x: 0,
      y: 0,
      r: size*0.5,
      baseAngle: rand(0, Math.PI*2),
      phaseX: rand(0, Math.PI*2),
      phaseY: rand(0, Math.PI*2),
      rotPhase: rand(0, Math.PI*2),
      ampX: rand(5, 10),
      ampY: rand(4, 8),
      rotAmp: rand(0.01, 0.025)
    };
    pads.push(pad);
  });
}

spawnPads();
window.addEventListener('resize', spawnPads);

function updatePads(dt) {
  for (const p of pads) {
    // Oscillate around the anchor with very small movements and rotation
    const ox = Math.sin(waterT * 1.2 + p.phaseX) * p.ampX + Math.sin(waterT * 0.6 + p.phaseX * 0.7) * 2;
    const oy = Math.cos(waterT * 1.0 + p.phaseY) * p.ampY + Math.sin(waterT * 0.8 + p.phaseY * 0.5) * 2;
    p.x = p.ax + ox;
    p.y = p.ay + oy;
    const angle = p.baseAngle + Math.sin(waterT * 0.9 + p.rotPhase) * p.rotAmp;
    p.el.style.transform = `translate(${p.x - p.r}px, ${p.y - p.r}px) rotate(${angle}rad)`;
  }
}

/* Smooth pseudo-noise turn signal (no external libs) */
function fbm(t, seed=0){
  // sum of a few sin/cos at incommensurate freqs for smooth wandering
  return 0.55*Math.sin(0.7*t + 1.1+seed)
       + 0.30*Math.sin(1.3*t + 2.4+seed)
       + 0.15*Math.cos(2.1*t + 0.6+seed);
}

/* ---------- Fish ---------- */
class Fish {
  /**
   * @param {number} x0 initial x
   * @param {number} y0 initial y
   * @param {number} L  body length (px)
   * @param {string} color fill color
   */
  constructor(x0, y0, L, color="#F6A04D"){
    this.len = L;
    this.segCount = 32;                // more segments = smoother bends
    this.segLen = this.len / (this.segCount-1);
    this.spine = Array.from({length:this.segCount}, (_,i)=>({x:x0 - i*this.segLen, y:y0}));
    this.theta = 0;                     // head heading
    this.baseSpeed = 1.1 + Math.random()*0.8;
    this.speed = this.baseSpeed;
    this.turnPower = 0.015;             // max turn per frame (radians) - reduced for calmer movement
    this.noiseSeed = Math.random()*1000;
    this.color = color;

    // gentle body undulation on top of turning (tailbeat)
    this.tailbeatFreq = lerp(0.025, 0.06, Math.random());
    this.tailbeatAmp  = lerp(0.6, 0.9, Math.random()); // scales with r(s)
  }

  /* thickness profile: rounded head, slender tail */
  radiusAt(i){
    const s = i/(this.segCount-1);          // 0 at head, 1 at tail
    // bell-ish body: max around 0.22, tapering to thin tail
    const body = Math.sin(Math.PI*(1 - Math.pow(s, 1)));
    const tailTaper = Math.pow(1 - s, 1.6); // extra thinning toward tail
    const r0 = 0.16 * this.len;             // base half-width ~ 16% of length
    const rMinHead = 0.02 * this.len;       // keep nose rounded (non-zero)
    return clamp(r0*body*tailTaper + rMinHead*(1 - s), 1, 999);
  }

  /* head steering: natural fish-like movement with banking and schooling */
  steer(t){
    // smooth wander with multiple frequency layers for more natural movement
    const wander = fbm(t*0.015, this.noiseSeed) * this.turnPower;
    
    // slight high-freq shimmy aligned to tailbeat
    const shimmy = 0.35*this.turnPower*Math.sin(t*this.tailbeatFreq*2.0 + this.noiseSeed);
    
    // banking behavior - fish naturally bank into turns
    const bankingFactor = Math.abs(wander) * 0.8; // bank more on sharper turns
    const banking = Math.sign(wander) * bankingFactor * 0.02;
    
    // occasional direction changes for more interesting paths
    const directionChange = Math.sin(t * 0.005 + this.noiseSeed * 3) * 
                           Math.sin(t * 0.003 + this.noiseSeed * 7) * this.turnPower * 0.8;
    
    // subtle attraction to center of screen (loose schooling behavior)
    const centerX = window.innerWidth * 0.5;
    const centerY = window.innerHeight * 0.5;
    const head = this.spine[0];
    const toCenterX = centerX - head.x;
    const toCenterY = centerY - head.y;
    const distToCenter = Math.hypot(toCenterX, toCenterY);
    const maxInfluenceDistance = Math.min(window.innerWidth, window.innerHeight) * 0.4;
    
    let centerAttraction = 0;
    if (distToCenter > maxInfluenceDistance) {
      const targetAngle = Math.atan2(toCenterY, toCenterX);
      const angleDiff = targetAngle - this.theta;
      // normalize angle difference to [-π, π]
      const normalizedDiff = ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
      centerAttraction = normalizedDiff * 0.009; // gentle pull toward center
    }
    
    return wander + shimmy + banking + directionChange + centerAttraction;
  }

  /* update spine by moving head, then enforcing fixed segment spacing (follow-the-leader) */
  update(t, W, H){
    // edge avoidance - check distance to boundaries and add steering force
    const head = this.spine[0];
    const edgeBuffer = 80; // distance from edge to start turning away
    let avoidanceForce = 0;
    
    // Check each edge and add turning force
    if (head.x < edgeBuffer) {
      // too close to left edge, turn right
      avoidanceForce += (edgeBuffer - head.x) / edgeBuffer * 0.08;
    }
    if (head.x > W - edgeBuffer) {
      // too close to right edge, turn left
      avoidanceForce -= (head.x - (W - edgeBuffer)) / edgeBuffer * 0.08;
    }
    if (head.y < edgeBuffer) {
      // too close to top edge, turn down
      const targetAngle = Math.PI / 2; // down
      const angleDiff = targetAngle - this.theta;
      avoidanceForce += Math.sin(angleDiff) * 0.06;
    }
    if (head.y > H - edgeBuffer) {
      // too close to bottom edge, turn up
      const targetAngle = -Math.PI / 2; // up
      const angleDiff = targetAngle - this.theta;
      avoidanceForce += Math.sin(angleDiff) * 0.06;
    }

    // dynamic speed variation for natural movement
    const speedVariation = Math.sin(t * 0.012 + this.noiseSeed) * 0.3 + 
                           Math.sin(t * 0.007 + this.noiseSeed * 2) * 0.2;
    this.speed = this.baseSpeed * (1 + 1.3*speedVariation);
    
    // steer & move head with natural trajectory improvements
    const baseSteer = this.steer(t);
    const naturalCurve = Math.sin(t * 0.008 + this.noiseSeed) * 0.015; // gentle long curves
    this.theta += baseSteer + avoidanceForce + naturalCurve;
    
    head.x += this.speed*Math.cos(this.theta);
    head.y += this.speed*Math.sin(this.theta);

    // only wrap if fish somehow gets past the buffer zone
    const pad = 20;
    if (head.x < -pad) head.x = W+pad;
    if (head.x >  W+pad) head.x = -pad;
    if (head.y < -pad) head.y = H+pad;
    if (head.y >  H+pad) head.y = -pad;

    // follow-the-leader: keep each segment at segLen from previous
    for (let i=1;i<this.segCount;i++){
      const prev = this.spine[i-1];
      const curr = this.spine[i];
      let dx = curr.x - prev.x, dy = curr.y - prev.y;
      const d = Math.hypot(dx,dy) || 1e-6;
      const want = this.segLen;
      const ux = dx/d, uy = dy/d;
      // place current point along the previous direction at exact spacing
      curr.x = prev.x + ux*want;
      curr.y = prev.y + uy*want;

      // add a small lateral wiggle increasing toward tail (tailbeat)
      const s = i/(this.segCount-1);
      const wig = this.tailbeatAmp * Math.sin(t*this.tailbeatFreq + s*10 + this.noiseSeed);
      // normal to segment (ux,uy) is (-uy, ux)
      curr.x += (-uy) * wig * s*s; // tiny near head, stronger toward tail
      curr.y += ( ux) * wig * s*s;
    }
  }

  /* build body polygon from spine using per-segment normals */
  draw(ctx){
    // compute normals & outline
    const top = [];
    const bot = [];

    for (let i=0;i<this.spine.length;i++){
      const p  = this.spine[i];
      const p1 = (i===0) ? this.spine[i]   : this.spine[i-1];
      const p2 = (i===this.spine.length-1) ? this.spine[i] : this.spine[i+1];
      // tangent by central difference
      let tx = p2.x - p1.x, ty = p2.y - p1.y;
      const tl = Math.hypot(tx,ty) || 1e-6;
      tx/=tl; ty/=tl;
      const nx = -ty, ny = tx;
      const r = this.radiusAt(i);
      top.push({x:p.x + nx*r, y:p.y + ny*r});
      bot.push({x:p.x - nx*r, y:p.y - ny*r});
    }
    bot.reverse();

    // body fill with rounded head cap (implicit from profile) and thin tail
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(top[0].x*DPR, top[0].y*DPR);
    for (let i=1;i<top.length;i++) ctx.lineTo(top[i].x*DPR, top[i].y*DPR);
    for (let i=0;i<bot.length;i++) ctx.lineTo(bot[i].x*DPR, bot[i].y*DPR);
    ctx.closePath();
    ctx.fill();

    // caudal (tail) fin — subtle, thin
    const tail = this.spine[this.spine.length-1];
    const prev = this.spine[this.spine.length-2];
    let dx = tail.x - prev.x, dy = tail.y - prev.y;
    const dl = Math.hypot(dx,dy) || 1e-6; dx/=dl; dy/=dl;
    const nx = -dy, ny = dx;
    const tailLen = 0.16*this.len;
    const tailSpan= 0.60*this.radiusAt(this.spine.length-1) + 3;

    ctx.beginPath();
    ctx.moveTo(tail.x*DPR, tail.y*DPR);
    ctx.lineTo((tail.x + dx*tailLen + nx*tailSpan)*DPR, (tail.y + dy*tailLen + ny*tailSpan)*DPR);
    ctx.lineTo((tail.x + dx*tailLen - nx*tailSpan)*DPR, (tail.y + dy*tailLen - ny*tailSpan)*DPR);
    ctx.closePath();
    ctx.fill();

    // 4 side fins: 2 dorsal (top) and 2 anal (bottom) fins
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = "#ffffff";

    // Dorsal fin 1 (front dorsal) - positioned at ~20% along spine
    const dorsalIndex1 = Math.floor(this.spine.length * 0.20);
    const dp1 = this.spine[dorsalIndex1];
    const dp1_next = this.spine[dorsalIndex1 + 1];
    let d1tx = dp1_next.x - dp1.x, d1ty = dp1_next.y - dp1.y;
    const d1l = Math.hypot(d1tx, d1ty) || 1e-6; d1tx /= d1l; d1ty /= d1l;
    const d1nx = -d1ty, d1ny = d1tx; // normal pointing up from spine
    const d1finLen = 0.14 * this.len, d1finSpan = 0.6 * this.radiusAt(dorsalIndex1);
    
    const dorsalFlap1 = Math.sin(perfTime * this.tailbeatFreq * 0.8 + this.noiseSeed) * 0.3;
    
    // ctx.beginPath();
    // ctx.moveTo(dp1.x*DPR, dp1.y*DPR);
    // ctx.lineTo((dp1.x + d1nx * (d1finSpan * (1 + dorsalFlap1)) - d1tx * d1finLen * 0.3)*DPR, 
    //            (dp1.y + d1ny * (d1finSpan * (1 + dorsalFlap1)) - d1ty * d1finLen * 0.3)*DPR);
    // ctx.lineTo((dp1.x + d1nx * d1finSpan * 0.3 + d1tx * d1finLen * 0.2)*DPR, 
    //            (dp1.y + d1ny * d1finSpan * 0.3 + d1ty * d1finLen * 0.2)*DPR);
    // ctx.closePath(); ctx.fill();

    // Dorsal fin 2 (rear dorsal) - positioned at ~55% along spine
    const dorsalIndex2 = Math.floor(this.spine.length * 0.55);
    const dp2 = this.spine[dorsalIndex2];
    const dp2_next = this.spine[dorsalIndex2 + 1];
    let d2tx = dp2_next.x - dp2.x, d2ty = dp2_next.y - dp2.y;
    const d2l = Math.hypot(d2tx, d2ty) || 1e-6; d2tx /= d2l; d2ty /= d2l;
    const d2nx = -d2ty, d2ny = d2tx;
    const d2finLen = 0.11 * this.len, d2finSpan = 0.5 * this.radiusAt(dorsalIndex2);
    
    const dorsalFlap2 = Math.sin(perfTime * this.tailbeatFreq * 0.9 + this.noiseSeed + 1) * 0.25;
    
    // ctx.beginPath();
    // ctx.moveTo(dp2.x*DPR, dp2.y*DPR);
    // ctx.lineTo((dp2.x + d2nx * (d2finSpan * (1 + dorsalFlap2)) - d2tx * d2finLen * 0.3)*DPR, 
    //            (dp2.y + d2ny * (d2finSpan * (1 + dorsalFlap2)) - d2ty * d2finLen * 0.3)*DPR);
    // ctx.lineTo((dp2.x + d2nx * d2finSpan * 0.3 + d2tx * d2finLen * 0.2)*DPR, 
    //            (dp2.y + d2ny * d2finSpan * 0.3 + d2ty * d2finLen * 0.2)*DPR);
    // ctx.closePath(); ctx.fill();

    // Anal fin 1 (front anal) - positioned at ~25% along spine
    const analIndex1 = Math.floor(this.spine.length * 0.25);
    const ap1 = this.spine[analIndex1];
    const ap1_next = this.spine[analIndex1 + 1];
    let a1tx = ap1_next.x - ap1.x, a1ty = ap1_next.y - ap1.y;
    const a1l = Math.hypot(a1tx, a1ty) || 1e-6; a1tx /= a1l; a1ty /= a1l;
    const a1nx = a1ty, a1ny = -a1tx; // normal pointing down from spine
    const a1finLen = 0.10 * this.len, a1finSpan = 0.45 * this.radiusAt(analIndex1);
    
    const analFlap1 = Math.sin(perfTime * this.tailbeatFreq * 0.7 + this.noiseSeed + 2) * 0.25;
    
    // ctx.beginPath();
    // ctx.moveTo(ap1.x*DPR, ap1.y*DPR);
    // ctx.lineTo((ap1.x + a1nx * (a1finSpan * (1 + analFlap1)) - a1tx * a1finLen * 0.3)*DPR, 
    //            (ap1.y + a1ny * (a1finSpan * (1 + analFlap1)) - a1ty * a1finLen * 0.3)*DPR);
    // ctx.lineTo((ap1.x + a1nx * a1finSpan * 0.3 + a1tx * a1finLen * 0.2)*DPR, 
    //            (ap1.y + a1ny * a1finSpan * 0.3 + a1ty * a1finLen * 0.2)*DPR);
    // ctx.closePath(); ctx.fill();

    // Anal fin 2 (rear anal) - positioned at ~60% along spine
    const analIndex2 = Math.floor(this.spine.length * 0.60);
    const ap2 = this.spine[analIndex2];
    const ap2_next = this.spine[analIndex2 + 1];
    let a2tx = ap2_next.x - ap2.x, a2ty = ap2_next.y - ap2.y;
    const a2l = Math.hypot(a2tx, a2ty) || 1e-6; a2tx /= a2l; a2ty /= a2l;
    const a2nx = a2ty, a2ny = -a2tx;
    const a2finLen = 0.08 * this.len, a2finSpan = 0.4 * this.radiusAt(analIndex2);
    
    const analFlap2 = Math.sin(perfTime * this.tailbeatFreq * 0.85 + this.noiseSeed + 3) * 0.2;
    
    // ctx.beginPath();
    // ctx.moveTo(ap2.x*DPR, ap2.y*DPR);
    // ctx.lineTo((ap2.x + a2nx * (a2finSpan * (1 + analFlap2)) - a2tx * a2finLen * 0.3)*DPR, 
    //            (ap2.y + a2ny * (a2finSpan * (1 + analFlap2)) - a2ty * a2finLen * 0.3)*DPR);
    // ctx.lineTo((ap2.x + a2nx * a2finSpan * 0.3 + a2tx * a2finLen * 0.2)*DPR, 
    //            (ap2.y + a2ny * a2finSpan * 0.3 + a2ty * a2finLen * 0.2)*DPR);
    // ctx.closePath(); ctx.fill();

    ctx.globalAlpha = 1;
  }
}

let fishes = [];
const palette = ["#C8D9FF","#EBCFA2","#B8DDD3","#F597A2"];

function spawnFishes() {
  const count = 4;
  fishes = [];
  for (let i = 0; i < count; i++) {
    const L = 50; // fish length between 80-120px
    fishes.push(new Fish(
      window.innerWidth * 0.5  + i*20 ,
      Math.random()* window.innerHeight  ,
      L,
      palette[i % palette.length]
    ));
  }
}

spawnFishes();
window.addEventListener('resize', spawnFishes);

// Animation loop
let last = performance.now();
let perfTime = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  perfTime = now * 0.001; // seconds for the new fish system
  
  drawWater(now);
  
  ctxFish.clearRect(0,0,canvasFish.width, canvasFish.height);
  for (const f of fishes) {
    f.update(now, canvasFish.width / DPR, canvasFish.height / DPR);
    f.draw(ctxFish);
  }
  
  // Update pads after drawing fish so they appear on top for natural occlusion
  updatePads(dt);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Ensure lily pads render beneath text but above fish: handled in CSS z-index


