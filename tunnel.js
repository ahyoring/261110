// ============ TUNNEL RUN : 3D 터널 비행 ============
(function () {
'use strict';
const ZS = 3.2;            // distance of ship plane from camera
const FAR = 85, SEG = 2;   // draw distance, ring spacing
const SIDES = 16;
const ZONES = [190, 300, 130, 20, 255, 340];

let st = 'over', overT = 0, paused = false;
let z0, v, px, py, vx, vy, hp, inv, rollT, rollCd, boost, boostOn, boostSm, camRoll, score, rings, combo, bestCombo;
let obs, nextZ, fx, dust, shake, flash, flashH, hurtFx, glitch, banner, bannerT, zoneN, slow, time = 0, tmov = 0;
let hi = +(localStorage.getItem('tunnel_hi') || 0);

const Cx = z => Math.sin(z * 0.021) * 2.2 + Math.sin(z * 0.057 + 1) * 0.7;
const Cy = z => Math.cos(z * 0.017) * 1.5 + Math.sin(z * 0.043) * 0.5;
const relX = dz => Cx(z0 + dz) - Cx(z0);
const relY = dz => Cy(z0 + dz) - Cy(z0);
const zoneHue = () => ZONES[(zoneN - 1) % ZONES.length];

function start() {
  st = 'play'; paused = false; z0 = 0; v = 26; px = py = vx = vy = 0; hp = 3; inv = 0; rollT = 0; rollCd = 0;
  boost = 0.3; boostOn = false; boostSm = 0; camRoll = 0; score = 0; rings = 0; combo = 0; bestCombo = 0;
  obs = []; nextZ = 45; fx = []; shake = flash = hurtFx = glitch = 0; zoneN = 1; slow = 1;
  banner = 'ZONE 1'; bannerT = 2.2;
  dust = []; for (let i = 0; i < 90; i++) dust.push({ a: rr(0, TAU), r: rr(0.15, 0.97), dz: rr(1, FAR) });
}

function spawnObs() {
  const d = z0 + FAR + 20;
  while (nextZ < d) {
    const diff = Math.min(1, z0 / 3500), r = R();
    if (r < 0.5) {
      const a = rr(0, TAU), m = rr(0.2, 0.62);
      obs.push({ type: 'wall', z: nextZ, hx: Math.cos(a) * m, hy: Math.sin(a) * m, gr: 0.46 - diff * 0.12 + rr(-0.04, 0.04) });
      nextZ += Math.max(16, 34 - z0 / 220);
    } else if (r < 0.75) {
      obs.push({ type: 'spoke', z: nextZ, n: 2 + Math.floor(R() * 3), a0: rr(0, TAU), w: rr(0.8, 2.0) * (R() < 0.5 ? -1 : 1) * (1 + diff * 0.6) });
      nextZ += Math.max(16, 32 - z0 / 220);
    } else {
      let a = rr(0, TAU), m = rr(0.1, 0.6), da = rr(-0.5, 0.5);
      for (let i = 0; i < 5; i++) {
        obs.push({ type: 'ring', z: nextZ + i * 7, hx: Math.cos(a) * m, hy: Math.sin(a) * m });
        a += da; m = clamp(m + rr(-0.1, 0.1), 0.05, 0.65);
      }
      nextZ += 5 * 7 + 12;
    }
  }
}

function spokeAng(o) { return o.a0 + o.w * tmov; }

function shipOff() { return { x: relX(ZS) + px, y: relY(ZS) + py }; }
function F() { return H * 0.95 * (1 + boostSm * 0.22); }
function cyV() { return H * 0.46; }
function proj(x, y, dz) { const k = F() / dz; return { x: W / 2 + x * k, y: cyV() + y * k, k }; }
function shipScreen() { const o = shipOff(), p = proj(o.x, o.y, ZS); return p; }

function hit() {
  if (inv > 0 || rollT > 0 || st !== 'play') return;
  hp--; inv = 1.6; shake = 28; hurtFx = 1; glitch = 0.5; combo = 0; slow = 0.45; sfx.hurt();
  const s = shipScreen();
  for (let i = 0; i < 40; i++) { const a = rr(0, TAU), sp = rr(60, 500); fx.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rr(0.3, 0.9), max: 0.9, size: rr(8, 22), h: rr(0, 40) }); }
  if (hp <= 0) {
    st = 'over'; overT = 0; flash = 1; flashH = 20; shake = 40;
    for (let i = 0; i < 100; i++) { const a = rr(0, TAU), sp = rr(60, 800); fx.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rr(0.5, 1.6), max: 1.6, size: rr(10, 30), h: rr(0, 50) }); }
    sfx.boom(true);
    const total = Math.floor(score);
    if (total > hi) { hi = total; try { localStorage.setItem('tunnel_hi', hi); } catch (e) {} }
  }
}

function update(dt) {
  time += dt;
  if (paused) return;
  shake = Math.max(0, shake - dt * 45); flash = Math.max(0, flash - dt * 2.5);
  hurtFx = Math.max(0, hurtFx - dt * 1.6); glitch = Math.max(0, glitch - dt);
  if (bannerT > 0) bannerT -= dt;
  for (const p of fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; }
  fx = fx.filter(p => p.life > 0);
  if (st === 'over') { overT += dt; v = lerp(v, 6, 0.03); z0 += v * dt; tmov += dt; return; }

  tmov += dt;
  // input
  let ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let iy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  let tvx, tvy;
  if (!ix && !iy && ptr.active) {
    const sc = H * 0.3;
    tvx = clamp((ptr.x - W / 2) / sc - px, -1, 1) * 5; tvy = clamp((ptr.y - H * 0.62) / sc - py, -1, 1) * 5;
    if (ptr.down && ptr.y < H * 0.25) boostOn = true;
  } else { const l = Math.hypot(ix, iy) || 1; tvx = ix / l * 2.8; tvy = iy / l * 2.8; }
  const rollBoost = rollT > 0 ? 1.5 : 1;
  vx = lerp(vx, tvx * rollBoost, 1 - Math.exp(-14 * dt)); vy = lerp(vy, tvy * rollBoost, 1 - Math.exp(-14 * dt));
  px += vx * dt; py += vy * dt;
  const m = Math.hypot(px, py);
  if (m > 0.88) { px *= 0.88 / m; py *= 0.88 / m; }
  inv = Math.max(0, inv - dt); rollCd = Math.max(0, rollCd - dt);
  if (rollT > 0) rollT = Math.max(0, rollT - dt);
  boostOn = boostOn || keys.Space;
  const useBoost = boostOn && boost > 0;
  boostOn = false;
  if (useBoost) boost = Math.max(0, boost - dt * 0.28);
  boostSm = lerp(boostSm, useBoost ? 1 : 0, 1 - Math.exp(-6 * dt));
  slow = Math.min(1, slow + dt * 0.5);
  const base = Math.min(48, 26 + z0 / 160);
  v = base * slow * (1 + boostSm * 0.7);
  const dz = v * dt; z0 += dz;
  score += dz * (useBoost ? 0.6 : 0.3) * (1 + Math.min(combo, 20) * 0.05);

  // zone change
  const zn = 1 + Math.floor(z0 / 600);
  if (zn !== zoneN) { zoneN = zn; banner = 'ZONE ' + zn; bannerT = 2.2; sfx.wave(); flash = 0.5; flashH = zoneHue(); score += 500; }

  // obstacles
  spawnObs();
  for (const o of obs) {
    if (o.passed) continue;
    if (o.z - z0 <= ZS) {
      o.passed = true;
      if (o.type === 'ring') {
        if (Math.hypot(px - o.hx, py - o.hy) < 0.36) {
          rings++; combo++; bestCombo = Math.max(bestCombo, combo);
          const pts = 100 * Math.min(10, 1 + Math.floor(combo / 3)); score += pts;
          boost = Math.min(1, boost + 0.08); o.got = 0.35; sfx.pickup();
          flash = Math.max(flash, 0.15); flashH = zoneHue();
          const s = shipScreen();
          for (let i = 0; i < 14; i++) { const a = rr(0, TAU), sp = rr(100, 400); fx.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, size: rr(6, 14), h: 50 }); }
          fx.push({ x: s.x, y: s.y - 60, text: '+' + pts, life: 0.9, max: 0.9, size: 0, vx: 0, vy: -50, h: 50 });
        } else combo = 0;
      } else if (o.type === 'wall') {
        if (Math.hypot(px - o.hx, py - o.hy) > o.gr - 0.07) hit();
        else if (inv <= 0 && rollT <= 0) { score += 50; }
      } else if (o.type === 'spoke') {
        const a0 = spokeAng(o);
        for (let i = 0; i < o.n; i++) {
          const a = a0 + i * TAU / o.n, c = Math.cos(a), s = Math.sin(a), dot = px * c + py * s;
          const d = dot < 0 ? Math.hypot(px, py) : Math.abs(px * s - py * c);
          if (d < 0.1 + 0.07) { hit(); break; }
        }
      }
    }
  }
  obs = obs.filter(o => o.z - z0 > -2);

  // camera roll
  const rollAnim = rollT > 0 ? TAU * (1 - Math.pow(rollT / 0.4, 2)) * (vx >= 0 ? -1 : 1) : 0;
  const target = -px * 0.16 - relX(14) * 0.09 + rollAnim;
  camRoll = rollT > 0 ? target : lerp(camRoll % TAU, target, 0.1);

  // dust
  for (const d of dust) { d.dz -= dz; if (d.dz < 0.6) { d.dz = FAR * rr(0.7, 1); d.a = rr(0, TAU); d.r = rr(0.15, 0.97); } }
  // engine trail
  const s = shipScreen();
  for (const sx of [-1, 1]) fx.push({ x: s.x + sx * s.k * 0.06 * 1.0 + rr(-3, 3), y: s.y + rr(-3, 3), vx: sx * 20 + (W / 2 - s.x) * 0.8, vy: (cyV() - s.y) * 0.8, life: 0.3, max: 0.3, size: rr(5, 12), h: zoneHue() });
}

// --------- drawing ---------
function poly(cx, cy, r, ph) {
  ctx.beginPath();
  for (let i = 0; i <= SIDES; i++) { const a = i / SIDES * TAU + (ph || 0); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
}

function drawTube() {
  const hb = zoneHue();
  ctx.globalCompositeOperation = 'lighter';
  const base = Math.floor(z0 / SEG) * SEG;
  let prev = null;
  for (let k = Math.ceil(FAR / SEG); k >= 0; k--) {
    const zz = base + k * SEG, dz = zz - z0;
    if (dz < 0.4) { prev = null; continue; }
    const rx = relX(dz), ry = relY(dz), p = proj(rx, ry, dz), idx = Math.round(zz / SEG);
    const fog = Math.pow(clamp(1 - dz / FAR, 0, 1), 1.4) * clamp((dz - 0.4) / 3, 0, 1);
    const hue = hb + Math.sin(zz * 0.02) * 30 + (boostSm * 40);
    const bright = idx % 4 === 0;
    ctx.strokeStyle = `hsl(${hue},100%,${bright ? 75 : 52}%)`;
    ctx.globalAlpha = fog * (bright ? 1 : 0.65);
    ctx.lineWidth = Math.max(1, p.k * (bright ? 0.03 : 0.012));
    poly(p.x, p.y, p.k, zz * 0.012); ctx.stroke();
    if (prev) { // longitudinal lines to farther ring
      ctx.globalAlpha = fog * 0.45; ctx.lineWidth = Math.max(1, p.k * 0.008);
      ctx.beginPath();
      for (let i = 0; i < SIDES; i++) {
        const a1 = i / SIDES * TAU + zz * 0.012, a0 = i / SIDES * TAU + (zz + SEG) * 0.012;
        ctx.moveTo(p.x + Math.cos(a1) * p.k, p.y + Math.sin(a1) * p.k);
        ctx.lineTo(prev.x + Math.cos(a0) * prev.k, prev.y + Math.sin(a0) * prev.k);
      }
      ctx.stroke();
    }
    if (bright && fog > 0.05 && dz > 10) { glow(p.x, p.y, p.k * 1.15, hue, fog * 0.1); }
    prev = p;
  }
  // vanishing glow
  const vp = proj(relX(FAR), relY(FAR), FAR);
  glow(vp.x, vp.y, H * 0.4, hb, 0.22); glow(vp.x, vp.y, H * 0.1, hb + 20, 0.4);
  // dust streaks
  ctx.lineCap = 'round';
  for (const d of dust) {
    const x1 = relX(d.dz) + Math.cos(d.a) * d.r, y1 = relY(d.dz) + Math.sin(d.a) * d.r;
    const d2 = d.dz + 0.8 + v * 0.05, x2 = relX(d2) + Math.cos(d.a) * d.r, y2 = relY(d2) + Math.sin(d.a) * d.r;
    const a = proj(x1, y1, d.dz), b = proj(x2, y2, d2);
    ctx.globalAlpha = clamp(1 - d.dz / FAR, 0, 1) * 0.8; ctx.strokeStyle = '#cff'; ctx.lineWidth = Math.max(1, a.k * 0.01);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawObs() {
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i], dz = o.z - z0;
    if (dz < 0.5 || dz > FAR) continue;
    const c = proj(relX(dz), relY(dz), dz), fog = Math.pow(clamp(1 - dz / FAR, 0, 1), 1.2);
    if (o.type === 'wall') {
      const h = proj(relX(dz) + o.hx, relY(dz) + o.hy, dz);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = fog * 0.78; ctx.fillStyle = 'hsl(330,70%,10%)';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.k * 1.05, 0, TAU); ctx.arc(h.x, h.y, o.gr * c.k, 0, TAU, true); ctx.fill('evenodd');
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fog; ctx.strokeStyle = 'hsl(340,100%,62%)'; ctx.lineWidth = Math.max(2, c.k * 0.035);
      ctx.beginPath(); ctx.arc(h.x, h.y, o.gr * c.k, 0, TAU); ctx.stroke();
      glow(h.x, h.y, o.gr * c.k * 1.6, 340, fog * 0.5);
      ctx.lineWidth = Math.max(1, c.k * 0.012); ctx.globalAlpha = fog * 0.7;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.k * 1.05, 0, TAU); ctx.stroke();
    } else if (o.type === 'spoke') {
      const a0 = spokeAng(o); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let j = 0; j < o.n; j++) {
        const a = a0 + j * TAU / o.n, ex = c.x + Math.cos(a) * c.k, ey = c.y + Math.sin(a) * c.k;
        ctx.globalAlpha = fog * 0.5; ctx.strokeStyle = 'hsl(30,100%,50%)'; ctx.lineWidth = c.k * 0.3;
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = fog; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, c.k * 0.09);
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      glow(c.x, c.y, c.k * 0.35, 30, fog);
    } else if (o.type === 'ring') {
      if (o.passed && !o.got) continue;
      const h = proj(relX(dz) + o.hx, relY(dz) + o.hy, dz), pulse = 1 + Math.sin(time * 8 + o.z) * 0.08;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fog; ctx.strokeStyle = 'hsl(50,100%,65%)'; ctx.lineWidth = Math.max(2, h.k * 0.05);
      ctx.beginPath(); ctx.arc(h.x, h.y, 0.4 * h.k * pulse, 0, TAU); ctx.stroke();
      glow(h.x, h.y, 0.75 * h.k, 50, fog * 0.7);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawShip() {
  const s = shipScreen(), sz = s.k * 0.17, blink = inv > 0 && rollT <= 0 && Math.floor(time * 20) % 2;
  if (blink || (st === 'over' && overT < 3 && hp <= 0)) return;
  ctx.save(); ctx.translate(s.x, s.y);
  ctx.rotate(clamp(vx * 0.12, -0.5, 0.5) - camRoll * 0.0);
  ctx.scale(sz / 20, sz / 20);
  ctx.globalCompositeOperation = 'lighter';
  // engine glow (facing camera)
  const fl = 1 + boostSm * 0.8 + Math.random() * 0.2;
  glow(0, 6, 60 * fl, zoneHue() + 10, 0.7); glow(0, 6, 28 * fl, 40, 0.9);
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, -16, 0, 20); g.addColorStop(0, '#e8fbff'); g.addColorStop(1, '#2058c8');
  ctx.beginPath(); [[0, -16], [8, 4], [32, 14], [10, 11], [0, 20], [-10, 11], [-32, 14], [-8, 4]].forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#bff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#0a1a40'; ctx.beginPath(); ctx.ellipse(0, 0, 3, 7, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // motion-smear background
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.92 - boostSm * 0.3;
  ctx.fillStyle = '#02030c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(W / 2 + (shake ? rr(-shake, shake) * 0.5 : 0), cyV() + (shake ? rr(-shake, shake) * 0.5 : 0)); ctx.rotate(camRoll);
  ctx.translate(-W / 2, -cyV());
  drawTube(); drawObs();
  // glitch slices
  drawShip();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of fx) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.text) continue;
    glow(p.x, p.y, p.size * (0.5 + a) * 2, p.h, a);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of fx) if (p.text) { ctx.globalAlpha = p.life / p.max; ctx.font = 'bold 26px Segoe UI, sans-serif'; ctx.fillStyle = '#fd6'; ctx.fillText(p.text, p.x, p.y); }
  ctx.globalAlpha = 1;
  ctx.restore();

  // speed lines overlay when boosting
  if (boostSm > 0.05) {
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#8ef'; ctx.globalAlpha = boostSm * 0.5;
    for (let i = 0; i < 28; i++) {
      const a = (i * 2.399 + time * 0.3) % TAU, r0 = H * (0.35 + ((i * 37) % 10) / 40), r1 = r0 + H * (0.15 + boostSm * 0.2);
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, cyV() + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * r1, cyV() + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // chromatic glitch bands
  if (glitch > 0) {
    for (let i = 0; i < 6; i++) {
      const y = rr(0, H), h = rr(4, 40), ox = rr(-30, 30) * glitch * 2;
      ctx.drawImage(cv, 0, y * DPR, W * DPR, h * DPR, ox, y, W, h);
    }
  }
  if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash * 0.55; ctx.fillStyle = `hsl(${flashH},100%,65%)`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  if (hurtFx > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,20,40,${hurtFx * 0.75})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  drawHUD();
  if (st === 'over') drawOver();
  if (paused) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); ctx.letterSpacing = '12px'; glowText('PAUSED', W / 2, H / 2, 60, 190); ctx.letterSpacing = '0px'; }
}

function drawHUD() {
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Segoe UI, sans-serif';
  ctx.fillText(String(Math.floor(score)).padStart(7, '0'), 20, 44);
  ctx.font = '13px Segoe UI, sans-serif'; ctx.fillStyle = '#8ac';
  ctx.fillText(`HI ${Math.max(hi, Math.floor(score)).toLocaleString()}   ${Math.floor(z0)} m   ZONE ${zoneN}`, 22, 64);
  for (let i = 0; i < 3; i++) {
    const x = 24 + i * 26, y = 80, on = i < hp;
    ctx.globalAlpha = on ? 1 : 0.25; ctx.fillStyle = on ? (hp <= 1 ? '#f44' : '#4f9') : '#456';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.lineTo(x + 22, y + 6); ctx.lineTo(x + 18, y + 12); ctx.lineTo(x, y + 12); ctx.lineTo(x + 4, y + 6); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // boost meter
  const bw = 160; ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(24, 104, bw, 8);
  const g = ctx.createLinearGradient(24, 0, 24 + bw, 0); g.addColorStop(0, '#4af'); g.addColorStop(1, '#fd6');
  ctx.fillStyle = g; ctx.fillRect(24, 104, bw * boost, 8);
  ctx.fillStyle = '#9cf'; ctx.font = '11px Segoe UI, sans-serif'; ctx.fillText('BOOST [SPACE]', 24, 126);
  // roll cooldown
  ctx.fillStyle = rollCd > 0 ? '#678' : '#8f8'; ctx.fillText(rollCd > 0 ? 'ROLL ' + rollCd.toFixed(1) : 'ROLL READY [SHIFT]', 24, 142);
  // speed
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Segoe UI, sans-serif';
  ctx.fillText(Math.floor(v * 8) + ' km/h', W - 24, 44);
  if (combo > 1) {
    const m = Math.min(10, 1 + Math.floor(combo / 3));
    ctx.fillStyle = `hsl(${55 - m * 4},100%,${60 + m * 2}%)`; ctx.font = `bold ${30 + Math.sin(time * 12) * 2}px Segoe UI, sans-serif`;
    ctx.fillText(combo + ' RING CHAIN', W - 24, 80); ctx.font = 'bold 16px Segoe UI'; ctx.fillStyle = '#fff'; ctx.fillText('x' + m, W - 24, 102);
  }
  // banner
  if (bannerT > 0) {
    const t = 2.2 - bannerT, a = t < 0.3 ? t / 0.3 : bannerT < 0.5 ? bannerT / 0.5 : 1, e = 1 - Math.pow(1 - Math.min(1, t / 0.5), 3);
    ctx.letterSpacing = (30 - e * 18) + 'px'; glowText(banner, W / 2 + (1 - e) * 160, H * 0.3, 56, zoneHue(), a);
    ctx.letterSpacing = '0px';
  }
}

function drawOver() {
  const a = clamp(overT / 1.0, 0, 1);
  ctx.globalAlpha = a * 0.65; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  if (overT < 0.5) return;
  const k = clamp((overT - 0.5) / 0.5, 0, 1);
  ctx.save(); ctx.translate(W / 2, H * 0.34); ctx.scale(2 - k, 2 - k); ctx.letterSpacing = '10px'; glowText('CRASHED', 0, 0, Math.min(W * 0.1, 80), 0, k); ctx.restore(); ctx.letterSpacing = '0px';
  ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Segoe UI, sans-serif';
  ctx.fillText('SCORE  ' + Math.floor(score).toLocaleString(), W / 2, H * 0.5);
  ctx.font = '17px Segoe UI, sans-serif'; ctx.fillStyle = '#9bd';
  ctx.fillText(`DISTANCE ${Math.floor(z0)} m  ·  RINGS ${rings}  ·  BEST CHAIN ${bestCombo}`, W / 2, H * 0.5 + 34);
  if (Math.floor(score) >= hi && score > 0) { ctx.fillStyle = '#fd6'; ctx.font = 'bold 20px Segoe UI'; ctx.fillText('★ NEW HI-SCORE ★', W / 2, H * 0.5 + 66); }
  if (overT > 1) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 250); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Segoe UI'; ctx.fillText('ENTER : RETRY   ·   ESC : MENU', W / 2, H * 0.5 + 110); }
  ctx.globalAlpha = 1;
}

window.Tunnel = {
  start, update, draw, hi: () => hi,
  onKey(code) {
    if (st === 'over' && overT > 1 && (code === 'Enter' || code === 'Space')) { start(); return; }
    if (st !== 'play') return;
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      if (rollCd <= 0 && rollT <= 0) { rollT = 0.4; rollCd = 1.6; sfx.dash(); flash = Math.max(flash, 0.2); flashH = 190; }
    }
    if (code === 'KeyP') paused = !paused;
  },
  onPointer(e) {
    if (st === 'over' && overT > 1) { start(); return; }
    if (st === 'play' && (e.button === 2 || (e.pointerType !== 'mouse' && e.clientY > H * 0.7 && e.clientX > W * 0.6))) {
      if (rollCd <= 0 && rollT <= 0) { rollT = 0.4; rollCd = 1.6; sfx.dash(); }
    }
  }
};
})();
