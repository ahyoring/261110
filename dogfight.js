// ============ ACE DOGFIGHT : 360도 공중전 ============
(function () {
'use strict';
const PLANE = [[0, -24], [4, -10], [26, 6], [26, 12], [4, 6], [3, 16], [10, 22], [10, 25], [0, 22], [-10, 25], [-10, 22], [-3, 16], [-4, 6], [-26, 12], [-26, 6], [-4, -10]];
const TYPES = {
  fighter: { hp: 5, r: 17, spd: 250, turn: 2.0, score: 200, hue: 0 },
  ace: { hp: 9, r: 18, spd: 310, turn: 2.9, score: 500, hue: 280 },
  bomber: { hp: 30, r: 36, spd: 120, turn: 0.8, score: 1200, hue: 40 }
};
const hash = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };

let st = 'over', overT = 0, paused = false, time = 0;
let P, en, bl, eb, ms, pt, pu, tx, cam, zoom;
let score, wave, waveDelay, spawnQ, waveClock, banner, bannerT, kills, streak, streakT, bestStreak, shake, flash, flashH, hurtFx, slow, slowT;
let hi = +(localStorage.getItem('dogfight_hi') || 0);

function start() {
  st = 'play'; paused = false; score = 0; wave = 0; waveDelay = 1; spawnQ = []; waveClock = 0; kills = 0; streak = 0; streakT = 0; bestStreak = 0;
  shake = flash = hurtFx = 0; slow = 1; slowT = 0; bannerT = 0;
  en = []; bl = []; eb = []; ms = []; pt = []; pu = []; tx = [];
  P = { x: 0, y: 0, ang: -Math.PI / 2, spd: 260, hp: 100, missiles: 6, mcd: 0, boost: 1, gun: 0, inv: 0, roll: 0, rollCd: 0, rdx: 0, rdy: 0, turn: 0, lockT: 0, lock: null, mReg: 0, dead: false, trail: 0 };
  cam = { x: 0, y: -100 }; zoom = 1;
}

function planWave() {
  wave++; spawnQ = []; waveClock = 0;
  const n = wave;
  banner = 'WAVE ' + n; bannerT = 2.4; sfx.wave();
  let t = 0.5;
  for (let i = 0; i < 2 + n; i++) { spawnQ.push({ t, type: 'fighter' }); t += 0.5; }
  for (let i = 0; i < Math.floor((n - 1) / 2); i++) { spawnQ.push({ t, type: 'ace' }); t += 0.9; }
  for (let i = 0; i < Math.floor(n / 3); i++) { spawnQ.push({ t, type: 'bomber' }); t += 1.2; }
  if (n > 1) { P.hp = Math.min(100, P.hp + 25); P.missiles = Math.min(8, P.missiles + 2); }
}
function spawnEnemy(type) {
  const T = TYPES[type], a = rr(0, TAU), d = Math.max(W, H) * 0.75 + 300;
  const x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
  en.push({ type, x, y, ang: Math.atan2(P.y - y, P.x - x) + rr(-0.5, 0.5), spd: T.spd, hp: T.hp, max: T.hp, r: T.r, cd: rr(1, 2.5), t: 0, hit: 0, brk: 0, brkDir: 1, bank: 0, tr: 0, dying: 0 });
}

function emit(p) { pt.push(p); }
function burst(x, y, n, h, spd, size, life) {
  for (let i = 0; i < n; i++) { const a = rr(0, TAU), s = R() * spd; emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(0.3, 1) * life, max: life, size: rr(0.5, 1) * size, h: h + rr(-20, 20), drag: 1.5, k: 'g' }); }
}
function explode(x, y, size, h = 20) {
  burst(x, y, size * 1.5, h, 150 + size * 5, size * 0.3, 0.9); burst(x, y, size * 0.7, 45, 80 + size * 3, size * 0.35, 0.6);
  for (let i = 0; i < size / 2; i++) { const a = rr(0, TAU), s = rr(100, 450); emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(0.4, 1), max: 1, size: 1.5, h: 40, drag: 0.7, k: 's' }); }
  for (let i = 0; i < size / 4; i++) { const a = rr(0, TAU), s = rr(20, 120); emit({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(1, 2), max: 2, size: rr(10, 25), h: 0, drag: 1, k: 'smoke' }); }
  emit({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: size * 3, h: 45, drag: 0, k: 'ring' });
  emit({ x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: size * 3.5, h: 45, drag: 0, k: 'flash' });
  shake = Math.max(shake, Math.min(26, size * 0.45)); sfx.boom(size > 30);
}
function floatText(x, y, s, h = 50, size = 20) { tx.push({ x, y, s, h, size, t: 0 }); }

function addScore(base, x, y) {
  streak++; streakT = 3; bestStreak = Math.max(bestStreak, streak);
  const m = Math.min(8, 1 + Math.floor(streak / 2)), pts = base * m; score += pts;
  floatText(x, y - 20, '+' + pts, m > 3 ? 25 : 50, 16 + m * 2);
}
function killEnemy(e, byMissile) {
  if (e.dying) return;
  e.dying = 1.1; e.spin = rr(5, 9) * (R() < 0.5 ? 1 : -1);
  kills++; addScore(TYPES[e.type].score, e.x, e.y);
  if (e.type === 'bomber' || R() < 0.18) { const r = R(); pu.push({ x: e.x, y: e.y, type: r < 0.4 ? 'H' : r < 0.75 ? 'M' : 'B', t: 0 }); }
  if (byMissile || e.type !== 'fighter') { slowT = 0.35; }
}
function hurtPlayer(d) {
  if (P.inv > 0 || P.roll > 0 || P.dead) return;
  P.hp -= d; P.inv = 0.12; hurtFx = Math.min(1, hurtFx + d / 20); shake = Math.max(shake, d > 15 ? 24 : 7); sfx.hit();
  if (P.hp <= 0) {
    P.dead = true; st = 'over'; overT = 0; slowT = 1.2; flash = 1; flashH = 20; streak = 0;
    for (let i = 0; i < 6; i++) setTimeout(() => explode(P.x + rr(-30, 30), P.y + rr(-30, 30), rr(25, 50)), i * 100);
    if (score > hi) { hi = score; try { localStorage.setItem('dogfight_hi', hi); } catch (e) {} }
  }
}
const angDiff = (a, b) => { let d = b - a; return Math.atan2(Math.sin(d), Math.cos(d)); };

function shootP() {
  for (const s of [-9, 9]) {
    const c = Math.cos(P.ang), sn = Math.sin(P.ang);
    bl.push({ x: P.x + c * 20 - sn * s, y: P.y + sn * 20 + c * s, vx: c * 1000 + rr(-25, 25), vy: sn * 1000 + rr(-25, 25), life: 0.85 });
  }
  sfx.shoot();
  emit({ x: P.x + Math.cos(P.ang) * 28, y: P.y + Math.sin(P.ang) * 28, vx: 0, vy: 0, life: 0.08, max: 0.08, size: 16, h: 50, drag: 0, k: 'flash' });
}
function fireMissile() {
  if (P.missiles <= 0 || P.mcd > 0 || P.dead || st !== 'play') return;
  P.missiles--; P.mcd = 0.35;
  const tg = P.lock && !P.lock.dying && P.lockT >= 1 ? P.lock : null;
  ms.push({ x: P.x, y: P.y, ang: P.ang, spd: P.spd + 120, t: 0, tg, own: true });
  sfx.missile();
  emit({ x: P.x, y: P.y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 36, h: 30, drag: 0, k: 'flash' });
}
function roll() {
  if (P.rollCd > 0 || P.roll > 0 || P.dead || st !== 'play') return;
  let dir = (keys.ArrowRight || keys.KeyD) ? 1 : (keys.ArrowLeft || keys.KeyA) ? -1 : (P.turn >= 0 ? 1 : -1);
  P.roll = 0.45; P.rollCd = 1.6; P.rdx = -Math.sin(P.ang) * dir * 380; P.rdy = Math.cos(P.ang) * dir * 380; P.rdir = dir;
  sfx.dash(); flash = Math.max(flash, 0.2); flashH = 190;
}

function update(dt) {
  time += dt;
  if (paused) return;
  if (slowT > 0) { slowT -= dt; slow = lerp(slow, 0.3, 0.2); } else slow = lerp(slow, 1, 0.08);
  const wdt = dt * slow;
  shake = Math.max(0, shake - dt * 40); flash = Math.max(0, flash - dt * 2.5); hurtFx = Math.max(0, hurtFx - dt * 1.5);
  if (bannerT > 0) bannerT -= dt;
  if (st === 'over') overT += dt;
  if (streakT > 0) { streakT -= wdt; if (streakT <= 0) streak = 0; }

  if (!P.dead) updatePlayer(wdt);

  // waves
  if (st === 'play') {
    if (waveDelay > 0) { waveDelay -= wdt; if (waveDelay <= 0) planWave(); }
    else {
      waveClock += wdt;
      while (spawnQ.length && spawnQ[0].t <= waveClock) spawnEnemy(spawnQ.shift().type);
      if (!spawnQ.length && !en.length) { waveDelay = 2.5; }
    }
  }

  // enemies
  for (const e of en) updateEnemy(e, wdt);

  // player bullets
  for (const b of bl) {
    b.x += b.vx * wdt; b.y += b.vy * wdt; b.life -= wdt;
    if (b.life <= 0) { b.dead = true; continue; }
    for (const e of en) {
      if (e.dying) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
        b.dead = true; e.hp -= 1; e.hit = 0.06; burst(b.x, b.y, 3, 40, 160, 2, 0.3); sfx.hit();
        if (e.hp <= 0) killEnemy(e, false);
        break;
      }
    }
  }
  // enemy bullets
  for (const b of eb) {
    b.x += b.vx * wdt; b.y += b.vy * wdt; b.life -= wdt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (!P.dead && Math.hypot(P.x - b.x, P.y - b.y) < 17) { b.dead = true; burst(b.x, b.y, 4, 0, 150, 2, 0.3); hurtPlayer(8); }
  }
  // missiles
  for (const m of ms) {
    m.t += wdt;
    if (m.tg && m.tg.dying) m.tg = null;
    if (!m.tg && m.t > 0.25) { let bd = 900; for (const e of en) if (!e.dying) { const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd && Math.abs(angDiff(m.ang, Math.atan2(e.y - m.y, e.x - m.x))) < 0.9) { bd = d; m.tg = e; } } }
    if (m.tg) m.ang += clamp(angDiff(m.ang, Math.atan2(m.tg.y - m.y, m.tg.x - m.x)), -4.5 * wdt, 4.5 * wdt);
    m.spd = Math.min(620, m.spd + 500 * wdt);
    m.x += Math.cos(m.ang) * m.spd * wdt; m.y += Math.sin(m.ang) * m.spd * wdt;
    emit({ x: m.x - Math.cos(m.ang) * 10, y: m.y - Math.sin(m.ang) * 10, vx: rr(-15, 15), vy: rr(-15, 15), life: 0.9, max: 0.9, size: 7, h: 0, drag: 1, k: 'smoke' });
    emit({ x: m.x - Math.cos(m.ang) * 8, y: m.y - Math.sin(m.ang) * 8, vx: 0, vy: 0, life: 0.15, max: 0.15, size: 7, h: 30, drag: 0, k: 'g' });
    let boom = m.t > 3.2;
    for (const e of en) if (!e.dying && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 8) boom = true;
    if (boom) {
      m.dead = true; explode(m.x, m.y, 26, 25);
      for (const e of en) if (!e.dying && Math.hypot(e.x - m.x, e.y - m.y) < 110 + e.r) { e.hp -= 7; e.hit = 0.15; if (e.hp <= 0) killEnemy(e, true); }
    }
  }
  // pickups
  for (const p of pu) {
    p.t += wdt;
    const d = Math.hypot(P.x - p.x, P.y - p.y);
    if (!P.dead && d < 220) { p.x += (P.x - p.x) * 3 * wdt; p.y += (P.y - p.y) * 3 * wdt; }
    if (!P.dead && d < 34) {
      p.dead = true; sfx.pickup();
      if (p.type === 'H') { P.hp = Math.min(100, P.hp + 30); floatText(p.x, p.y, 'REPAIR', 120); }
      if (p.type === 'M') { P.missiles = Math.min(10, P.missiles + 3); floatText(p.x, p.y, '+3 MISSILES', 30); }
      if (p.type === 'B') { P.boost = 1; floatText(p.x, p.y, 'AFTERBURNER', 190); }
      burst(p.x, p.y, 20, 50, 250, 3, 0.6); flash = Math.max(flash, 0.15); flashH = 120;
    }
    if (p.t > 14) p.dead = true;
  }
  // particles
  for (const p of pt) {
    p.life -= wdt; if (p.life <= 0) { p.dead = true; continue; }
    const d = Math.exp(-p.drag * wdt); p.vx *= d; p.vy *= d; p.x += p.vx * wdt; p.y += p.vy * wdt;
  }
  for (const t of tx) { t.t += wdt; t.y -= 40 * wdt; }
  bl = bl.filter(o => !o.dead); eb = eb.filter(o => !o.dead); ms = ms.filter(o => !o.dead);
  pt = pt.filter(o => !o.dead); pu = pu.filter(o => !o.dead); tx = tx.filter(o => o.t < 1.1);
  en = en.filter(o => !o.gone);
  if (pt.length > 1800) pt.splice(0, pt.length - 1800);

  // camera
  const tx_ = P.x + Math.cos(P.ang) * P.spd * 0.45, ty_ = P.y + Math.sin(P.ang) * P.spd * 0.45;
  cam.x = lerp(cam.x, tx_, 1 - Math.exp(-4 * dt)); cam.y = lerp(cam.y, ty_, 1 - Math.exp(-4 * dt));
  zoom = lerp(zoom, 1 - (P.spd - 260) / 900 - 0.05, 1 - Math.exp(-3 * dt));
}

function updatePlayer(dt) {
  // turning
  let tin = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const boosting = (keys.ArrowUp || keys.KeyW) && P.boost > 0, braking = keys.ArrowDown || keys.KeyS;
  let rate = braking ? 4.2 : boosting ? 2.0 : 3.0, turn = 0;
  if (tin) turn = tin * rate;
  else if (ptr.active || ptr.down) {
    const d = angDiff(P.ang, Math.atan2(ptr.y - H / 2, ptr.x - W / 2));
    turn = clamp(d * 5, -rate, rate);
    if (Math.hypot(ptr.x - W / 2, ptr.y - H / 2) < 40) turn = 0;
  }
  P.turn = lerp(P.turn, turn, 1 - Math.exp(-10 * dt));
  P.ang += P.turn * dt;
  const tspd = boosting ? 460 : braking ? 150 : 270;
  P.spd = lerp(P.spd, tspd, 1 - Math.exp(-3 * dt));
  if (boosting) P.boost = Math.max(0, P.boost - dt * 0.22); else P.boost = Math.min(1, P.boost + dt * 0.05);
  P.inv = Math.max(0, P.inv - dt); P.rollCd = Math.max(0, P.rollCd - dt); P.mcd = Math.max(0, P.mcd - dt);
  let ox = 0, oy = 0;
  if (P.roll > 0) { P.roll = Math.max(0, P.roll - dt); const f = 2.2 * (P.roll / 0.45); ox = P.rdx * f; oy = P.rdy * f; }
  P.x += (Math.cos(P.ang) * P.spd + ox) * dt; P.y += (Math.sin(P.ang) * P.spd + oy) * dt;
  // missile regen
  if (P.missiles < 6) { P.mReg += dt; if (P.mReg > 7) { P.mReg = 0; P.missiles++; } }
  // lock-on
  let cand = null, bd = 1e9;
  for (const e of en) {
    if (e.dying) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy), a = Math.abs(angDiff(P.ang, Math.atan2(dy, dx)));
    if (d < 1000 && a < 0.5 && a * 600 + d < bd) { bd = a * 600 + d; cand = e; }
  }
  if (cand && cand === P.lock) P.lockT = Math.min(1, P.lockT + dt / 0.7);
  else { P.lock = cand; P.lockT = 0; }
  // guns: manual or assist
  P.gun -= dt;
  let assist = false;
  for (const e of en) if (!e.dying) { const dx = e.x - P.x, dy = e.y - P.y; if (Math.hypot(dx, dy) < 650 && Math.abs(angDiff(P.ang, Math.atan2(dy, dx))) < 0.12) assist = true; }
  if (P.gun <= 0 && (keys.Space || ptr.down || assist)) { P.gun = 0.085; shootP(); }
  // contrail + engine
  P.trail -= dt;
  if (P.trail <= 0) {
    P.trail = 0.02;
    for (const s of [-1, 1]) {
      const c = Math.cos(P.ang), sn = Math.sin(P.ang);
      emit({ x: P.x - c * 22 - sn * s * 22 * 0.6, y: P.y - sn * 22 + c * s * 22 * 0.6, vx: 0, vy: 0, life: 1.1, max: 1.1, size: boosting ? 6 : 4, h: boosting ? 190 : 0, drag: 0, k: 'trail' });
    }
    emit({ x: P.x - Math.cos(P.ang) * 24, y: P.y - Math.sin(P.ang) * 24, vx: rr(-20, 20), vy: rr(-20, 20), life: 0.2, max: 0.2, size: boosting ? 9 : 5, h: boosting ? 190 : 30, drag: 1, k: 'g' });
  }
  if (P.hp < 35 && R() < 0.5) emit({ x: P.x, y: P.y, vx: rr(-30, 30), vy: rr(-30, 30), life: 1.2, max: 1.2, size: 12, h: 0, drag: 1, k: 'smoke' });
}

function updateEnemy(e, dt) {
  const T = TYPES[e.type];
  e.t += dt; e.hit = Math.max(0, e.hit - dt); e.cd -= dt; e.tr -= dt;
  if (e.dying) {
    e.dying -= dt; e.ang += e.spin * dt; e.x += Math.cos(e.ang) * e.spd * 0.5 * dt; e.y += Math.sin(e.ang) * e.spd * 0.5 * dt;
    if (R() < 0.6) emit({ x: e.x, y: e.y, vx: rr(-30, 30), vy: rr(-30, 30), life: 0.8, max: 0.8, size: rr(8, 16), h: rr(0, 40), drag: 1, k: R() < 0.5 ? 'smoke' : 'g' });
    if (e.dying <= 0) { e.gone = true; explode(e.x, e.y, e.r * 1.5, 20); }
    return;
  }
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy);
  let want;
  const lead = d / 700;
  const lx = P.x + Math.cos(P.ang) * P.spd * lead * 0.6, ly = P.y + Math.sin(P.ang) * P.spd * lead * 0.6;
  want = Math.atan2(ly - e.y, lx - e.x);
  if (e.type !== 'bomber') {
    if (e.brk > 0) { e.brk -= dt; want = e.brkAng; }
    else if (d < 230 && Math.abs(angDiff(e.ang, Math.atan2(dy, dx))) < 0.6) { e.brk = rr(0.8, 1.4); e.brkAng = e.ang + e.brkDir * 1.4; e.brkDir = R() < 0.5 ? 1 : -1; }
    if (d > 1500) want = Math.atan2(dy, dx);
  }
  const da = angDiff(e.ang, want), turn = clamp(da, -T.turn * dt, T.turn * dt);
  e.ang += turn; e.bank = lerp(e.bank, turn / dt / T.turn, 0.1);
  e.x += Math.cos(e.ang) * e.spd * dt; e.y += Math.sin(e.ang) * e.spd * dt;
  // contrail
  if (e.tr <= 0) { e.tr = 0.04; emit({ x: e.x - Math.cos(e.ang) * e.r, y: e.y - Math.sin(e.ang) * e.r, vx: 0, vy: 0, life: 0.9, max: 0.9, size: e.r * 0.2, h: 0, drag: 0, k: 'trail' }); }
  if (e.hp < e.max * 0.4 && R() < 0.4) emit({ x: e.x, y: e.y, vx: rr(-20, 20), vy: rr(-20, 20), life: 1, max: 1, size: 10, h: 0, drag: 1, k: 'smoke' });
  // shooting
  if (e.type === 'bomber') {
    if (e.cd <= 0 && d < 900) {
      e.cd = 2.4; for (let i = 0; i < 10; i++) { const a = e.t * 2 + i / 10 * TAU; eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, life: 3 }); }
      const a = Math.atan2(dy, dx); for (let i = -1; i <= 1; i++) eb.push({ x: e.x, y: e.y, vx: Math.cos(a + i * 0.15) * 420, vy: Math.sin(a + i * 0.15) * 420, life: 2.5 });
    }
  } else if (e.cd <= 0 && d < 560 && Math.abs(angDiff(e.ang, Math.atan2(dy, dx))) < 0.2) {
    e.cd = e.type === 'ace' ? 1.0 : 1.7;
    const n = e.type === 'ace' ? 4 : 3;
    for (let i = 0; i < n; i++) setTimeout(() => { if (e.dying || e.gone || st !== 'play') return; eb.push({ x: e.x, y: e.y, vx: Math.cos(e.ang) * 560, vy: Math.sin(e.ang) * 560, life: 1.8 }); }, i * 90);
  }
  // collide with player
  if (!P.dead && d < e.r + 16) {
    if (P.roll > 0) return;
    hurtPlayer(28); e.hp -= 99; killEnemy(e, false);
  }
}

// ------------- drawing -------------
function polyPath(pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }

function drawGround() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#06203a'); g.addColorStop(1, '#0a3050');
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);
  const hw = W / 2 / zoom + 300, hh = H / 2 / zoom + 300;
  // waves/grid
  const gs = 160; ctx.strokeStyle = 'rgba(120,200,255,.06)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = Math.floor((cam.x - hw) / gs) * gs; x < cam.x + hw; x += gs) { ctx.moveTo(x, cam.y - hh); ctx.lineTo(x, cam.y + hh); }
  for (let y = Math.floor((cam.y - hh) / gs) * gs; y < cam.y + hh; y += gs) { ctx.moveTo(cam.x - hw, y); ctx.lineTo(cam.x + hw, y); }
  ctx.stroke();
  // islands
  const cs = 520;
  for (let i = Math.floor((cam.x - hw) / cs) - 1; i <= Math.ceil((cam.x + hw) / cs); i++) {
    for (let j = Math.floor((cam.y - hh) / cs) - 1; j <= Math.ceil((cam.y + hh) / cs); j++) {
      if (hash(i, j) < 0.55) continue;
      const cx = i * cs + hash(i + 9, j) * cs * 0.6, cy = j * cs + hash(i, j + 4) * cs * 0.6, r = 70 + hash(i + 2, j + 2) * 150;
      const layers = [[1.35, 'hsla(190,60%,30%,.45)'], [1.05, 'hsl(42,45%,42%)'], [0.86, 'hsl(130,38%,22%)'], [0.45, 'hsl(120,32%,30%)']];
      for (const [s, c] of layers) {
        ctx.fillStyle = c; ctx.beginPath();
        for (let k = 0; k <= 10; k++) { const a = k / 10 * TAU, rr_ = r * s * (0.72 + 0.4 * hash(i * 3 + (k % 10), j * 5 + 1)); const x = cx + Math.cos(a) * rr_, y = cy + Math.sin(a) * rr_; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath(); ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawClouds() {
  const sc = 1.45;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(zoom * sc, zoom * sc); ctx.translate(-cam.x, -cam.y);
  const hw = W / 2 / zoom / sc + 300, hh = H / 2 / zoom / sc + 300, cs = 700;
  for (let i = Math.floor((cam.x - hw) / cs); i <= Math.ceil((cam.x + hw) / cs); i++) {
    for (let j = Math.floor((cam.y - hh) / cs); j <= Math.ceil((cam.y + hh) / cs); j++) {
      if (hash(i + 50, j + 50) < 0.62) continue;
      const cx = i * cs + hash(i, j + 70) * cs, cy = j * cs + hash(i + 70, j) * cs;
      for (let k = 0; k < 6; k++) {
        const x = cx + (hash(i + k, j) - 0.5) * 220, y = cy + (hash(i, j + k) - 0.5) * 110, r = 50 + hash(i + k, j + k) * 70;
        ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.arc(x - 6, y - 6, r * 0.7, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawPlane(x, y, ang, scale, bank, fill, stroke, hit, shadow) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); ctx.scale(scale * Math.cos(bank), scale);
  if (shadow) { ctx.translate(-14 / scale, 22 / scale); ctx.rotate(-(ang + Math.PI / 2) + 0.0); }
  polyPath(PLANE);
  if (shadow) { ctx.restore(); return; }
  ctx.fillStyle = hit ? '#fff' : fill; ctx.fill(); ctx.strokeStyle = hit ? '#fff' : stroke; ctx.lineWidth = 1.6 / scale; ctx.stroke();
  ctx.restore();
}
function drawShadow(x, y, ang, scale, bank, a) {
  ctx.save(); ctx.translate(x + 26, y + 40); ctx.rotate(ang + Math.PI / 2); ctx.scale(scale * 0.9 * Math.cos(bank), scale * 0.9);
  polyPath(PLANE); ctx.fillStyle = `rgba(0,10,25,${a})`; ctx.fill(); ctx.restore();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawGround();
  ctx.save();
  if (shake > 0) ctx.translate(rr(-shake, shake) * 0.5, rr(-shake, shake) * 0.5);
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);
  // shadows
  for (const e of en) drawShadow(e.x, e.y, e.ang, e.r / 24 * 1.0, e.bank * 0.4, 0.28);
  if (!P.dead) drawShadow(P.x, P.y, P.ang, 1, P.roll > 0 ? 0 : P.turn * 0.1, 0.3);
  // trails (normal blend)
  for (const p of pt) {
    if (p.k !== 'trail' && p.k !== 'smoke') continue;
    const a = p.life / p.max;
    ctx.globalAlpha = p.k === 'trail' ? a * 0.55 : a * 0.35;
    ctx.fillStyle = p.k === 'trail' ? (p.h ? '#8ef' : '#fff') : '#556';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.k === 'smoke' ? 1.6 - a * 0.6 : 0.5 + a * 0.5), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // pickups
  for (const p of pu) {
    const h = p.type === 'H' ? 120 : p.type === 'M' ? 30 : 190;
    ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y, 38, h, 0.8 + Math.sin(p.t * 8) * 0.2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 2); ctx.strokeStyle = `hsl(${h},100%,70%)`; ctx.lineWidth = 2; ctx.strokeRect(-12, -12, 24, 24); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.type, p.x, p.y + 1);
  }
  // enemies
  for (const e of en) {
    const T = TYPES[e.type], sc = e.r / 24 * (e.type === 'bomber' ? 1.0 : 1.0);
    ctx.globalCompositeOperation = 'lighter'; glow(e.x, e.y, e.r * 2.5, T.hue, 0.2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    drawPlane(e.x, e.y, e.ang, sc * 1.1, e.bank * 0.5, `hsl(${T.hue},50%,20%)`, `hsl(${T.hue},100%,62%)`, e.hit > 0);
    if (e.type === 'bomber') { ctx.save(); ctx.translate(e.x, e.y); ctx.strokeStyle = 'hsl(40,100%,60%)'; ctx.lineWidth = 2; ctx.rotate(e.t * 2); ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU * 0.75); ctx.stroke(); ctx.restore(); }
    if (e.hp < e.max && !e.dying) { // hp bar
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - 18, e.y - e.r - 14, 36, 4);
      ctx.fillStyle = `hsl(${T.hue},100%,60%)`; ctx.fillRect(e.x - 18, e.y - e.r - 14, 36 * clamp(e.hp / e.max, 0, 1), 4);
    }
  }
  // player
  if (!P.dead) {
    const blink = P.inv > 0 && Math.floor(time * 30) % 2;
    if (!blink) {
      ctx.globalCompositeOperation = 'lighter'; glow(P.x, P.y, 60, 190, 0.3); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const bank = P.roll > 0 ? (1 - P.roll / 0.45) * TAU * (P.rdir || 1) : P.turn * 0.12;
      drawPlane(P.x, P.y, P.ang, 1.15, bank, '#2058c8', '#bff', false);
    }
    // forward guide
    ctx.setLineDash([4, 10]); ctx.strokeStyle = 'rgba(150,230,255,.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(P.x + Math.cos(P.ang) * 40, P.y + Math.sin(P.ang) * 40); ctx.lineTo(P.x + Math.cos(P.ang) * 520, P.y + Math.sin(P.ang) * 520); ctx.stroke(); ctx.setLineDash([]);
  }
  // missiles + additive
  ctx.globalCompositeOperation = 'lighter';
  for (const m of ms) { glow(m.x, m.y, 26, 30, 0.9); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x, m.y, 3.5, 0, TAU); ctx.fill(); }
  for (const b of bl) {
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); ctx.stroke();
    glow(b.x, b.y, 14, 50, 0.7);
  }
  for (const b of eb) { glow(b.x, b.y, 18, 350, 0.9); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill(); }
  for (const p of pt) {
    if (p.k === 'trail' || p.k === 'smoke') continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === 'flash') { glow(p.x, p.y, p.size * (1 + (1 - a)), p.h, a); continue; }
    if (p.k === 'ring') { ctx.globalAlpha = a; ctx.strokeStyle = `hsl(${p.h},100%,65%)`; ctx.lineWidth = 5 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - a * a), 0, TAU); ctx.stroke(); continue; }
    if (p.k === 's') { ctx.globalAlpha = a; ctx.strokeStyle = '#fd8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); continue; }
    glow(p.x, p.y, p.size * (0.6 + a) * 2.2, p.h, a * 0.9);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // lock-on reticle
  if (P.lock && !P.lock.dying && !P.dead) {
    const e = P.lock, r = e.r + 26 - P.lockT * 8, locked = P.lockT >= 1;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(time * (locked ? 0 : 2)); ctx.strokeStyle = locked ? '#f44' : '#ff6'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.arc(0, 0, r, -0.35, 0.35); ctx.stroke(); }
    ctx.restore();
    if (locked) { ctx.fillStyle = '#f66'; ctx.font = 'bold 13px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('LOCK', e.x, e.y + e.r + 34); }
  }
  // floating texts
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of tx) { ctx.globalAlpha = 1 - t.t / 1.1; ctx.font = `bold ${t.size}px Segoe UI, sans-serif`; ctx.fillStyle = `hsl(${t.h},100%,70%)`; ctx.fillText(t.s, t.x, t.y); }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawClouds();

  // off-screen arrows
  if (!P.dead) for (const e of en) {
    if (e.dying) continue;
    const sx = W / 2 + (e.x - cam.x) * zoom, sy = H / 2 + (e.y - cam.y) * zoom;
    if (sx > 20 && sx < W - 20 && sy > 20 && sy < H - 20) continue;
    const a = Math.atan2(sy - H / 2, sx - W / 2), mx = W / 2 - 40, my = H / 2 - 40;
    const k = Math.min(mx / Math.abs(Math.cos(a) || 1e-6), my / Math.abs(Math.sin(a) || 1e-6));
    const ax = W / 2 + Math.cos(a) * k, ay = H / 2 + Math.sin(a) * k, h = TYPES[e.type].hue;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = `hsl(${h},100%,60%)`; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash * 0.5; ctx.fillStyle = `hsl(${flashH},100%,65%)`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  if (hurtFx > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,20,40,${hurtFx * 0.7})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (slow < 0.8) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,10,40,${(1 - slow) * 0.6})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // speed streaks when boosting
  if (P.spd > 330 && !P.dead) {
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#bef'; ctx.globalAlpha = clamp((P.spd - 330) / 150, 0, 1) * 0.35;
    const ux = -Math.cos(P.ang), uy = -Math.sin(P.ang);
    for (let i = 0; i < 18; i++) {
      const x = ((i * 977 + time * 600 * -ux) % (W + 200)) - 100, y = ((i * 613 + time * 600 * -uy) % (H + 200)) - 100, l = 80 + (i % 5) * 30;
      ctx.lineWidth = 1 + i % 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ux * l, y + uy * l); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  drawHUD();
  if (st === 'over') drawOver();
  if (paused) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); ctx.letterSpacing = '12px'; glowText('PAUSED', W / 2, H / 2, 60, 190); ctx.letterSpacing = '0px'; }
}

function drawHUD() {
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Segoe UI, sans-serif';
  ctx.fillText(String(Math.floor(score)).padStart(7, '0'), 20, 44);
  ctx.font = '13px Segoe UI, sans-serif'; ctx.fillStyle = '#8ac'; ctx.fillText(`HI ${Math.max(hi, score).toLocaleString()}   WAVE ${Math.max(1, wave)}   KILLS ${kills}`, 22, 64);
  // hull bar
  const bw = 200; ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(24, 76, bw, 10);
  const g = ctx.createLinearGradient(24, 0, 24 + bw, 0); g.addColorStop(0, P.hp < 35 ? '#f33' : '#4f9'); g.addColorStop(1, P.hp < 35 ? '#f84' : '#8fd');
  ctx.fillStyle = g; ctx.fillRect(24, 76, bw * clamp(P.hp / 100, 0, 1), 10); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(24, 76, bw, 10);
  ctx.fillStyle = '#9cf'; ctx.font = '11px Segoe UI'; ctx.fillText('HULL', 24, 102);
  // boost
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(24, 110, bw * 0.6, 6); ctx.fillStyle = '#4af'; ctx.fillRect(24, 110, bw * 0.6 * P.boost, 6);
  ctx.fillStyle = '#9cf'; ctx.fillText('AFTERBURNER [W]', 24, 130);
  // missiles
  for (let i = 0; i < P.missiles; i++) { const x = 28 + i * 18, y = 144; ctx.fillStyle = '#fa4'; ctx.fillRect(x, y, 6, 16); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 6); ctx.lineTo(x + 6, y); ctx.fill(); }
  ctx.fillStyle = P.rollCd > 0 ? '#678' : '#8f8'; ctx.fillText(P.rollCd > 0 ? 'ROLL ' + P.rollCd.toFixed(1) : 'ROLL READY [SHIFT]', 24, 178);
  // streak
  if (streak > 1) {
    const m = Math.min(8, 1 + Math.floor(streak / 2));
    ctx.textAlign = 'right'; ctx.font = `bold ${34 + Math.sin(time * 12) * 2}px Segoe UI, sans-serif`; ctx.fillStyle = `hsl(${55 - m * 5},100%,${60 + m * 2}%)`; ctx.fillText(streak + ' KILL STREAK', W - 24, 50);
    ctx.font = 'bold 18px Segoe UI'; ctx.fillStyle = '#fff'; ctx.fillText('x' + m, W - 24, 74);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(W - 174, 82, 150, 4); ctx.fillStyle = '#fd6'; ctx.fillRect(W - 174, 82, 150 * clamp(streakT / 3, 0, 1), 4);
  }
  // radar
  const rx = W - 90, ry = H - 90, rr_ = 70, range = 1600;
  ctx.fillStyle = 'rgba(0,30,50,.6)'; ctx.beginPath(); ctx.arc(rx, ry, rr_, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,230,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(rx, ry, rr_ / 2, 0, TAU); ctx.globalAlpha = 0.25; ctx.stroke(); ctx.globalAlpha = 1;
  const sw = time * 2.5; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(120,255,200,.4)'; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(sw) * rr_, ry + Math.sin(sw) * rr_); ctx.stroke(); ctx.restore();
  for (const e of en) {
    if (e.dying) continue; const dx = (e.x - P.x) / range * rr_, dy = (e.y - P.y) / range * rr_, d = Math.hypot(dx, dy), k = d > rr_ - 4 ? (rr_ - 4) / d : 1;
    ctx.fillStyle = `hsl(${TYPES[e.type].hue},100%,60%)`; ctx.beginPath(); ctx.arc(rx + dx * k, ry + dy * k, e.type === 'bomber' ? 4 : 3, 0, TAU); ctx.fill();
  }
  ctx.save(); ctx.translate(rx, ry); ctx.rotate(P.ang + Math.PI / 2); ctx.fillStyle = '#9ff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.fill(); ctx.restore();
  // banner
  if (bannerT > 0) {
    const t = 2.4 - bannerT, a = t < 0.3 ? t / 0.3 : bannerT < 0.5 ? bannerT / 0.5 : 1, e = 1 - Math.pow(1 - Math.min(1, t / 0.5), 3);
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#012'; ctx.fillRect(0, H * 0.3, W, 100 * e);
    ctx.globalAlpha = a; ctx.fillStyle = '#4cf'; ctx.fillRect(0, H * 0.3, W * e, 3);
    ctx.letterSpacing = (30 - e * 20) + 'px'; glowText(banner, W / 2 + (1 - e) * 200, H * 0.3 + 42, 52, 190, a);
    ctx.letterSpacing = '8px'; glowText(['SCRAMBLE', 'ENGAGE', 'HUNT THEM DOWN', 'ACE PILOT'][wave % 4], W / 2 - (1 - e) * 200, H * 0.3 + 82, 17, 190, a * 0.9, '300');
    ctx.letterSpacing = '0px'; ctx.globalAlpha = 1;
  }
}

function drawOver() {
  const a = clamp(overT / 1.2, 0, 1);
  ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  if (overT < 0.6) return;
  const k = clamp((overT - 0.6) / 0.5, 0, 1);
  ctx.save(); ctx.translate(W / 2, H * 0.35); ctx.scale(2 - k, 2 - k); ctx.letterSpacing = '10px'; glowText('SHOT DOWN', 0, 0, Math.min(W * 0.1, 80), 0, k); ctx.restore(); ctx.letterSpacing = '0px';
  ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Segoe UI, sans-serif'; ctx.fillText('SCORE  ' + Math.floor(score).toLocaleString(), W / 2, H * 0.5);
  ctx.font = '17px Segoe UI, sans-serif'; ctx.fillStyle = '#9bd'; ctx.fillText(`WAVE ${wave}  ·  KILLS ${kills}  ·  BEST STREAK ${bestStreak}`, W / 2, H * 0.5 + 34);
  if (score >= hi && score > 0) { ctx.fillStyle = '#fd6'; ctx.font = 'bold 20px Segoe UI'; ctx.fillText('★ NEW HI-SCORE ★', W / 2, H * 0.5 + 66); }
  if (overT > 1) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 250); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Segoe UI'; ctx.fillText('ENTER : RETRY   ·   ESC : MENU', W / 2, H * 0.5 + 110); }
  ctx.globalAlpha = 1;
}

window.Dogfight = {
  start, update, draw, hi: () => hi,
  onKey(code) {
    if (st === 'over' && overT > 1 && (code === 'Enter' || code === 'Space')) { start(); return; }
    if (st !== 'play') return;
    if (code === 'ShiftLeft' || code === 'ShiftRight') roll();
    if (code === 'KeyX' || code === 'KeyB' || code === 'KeyZ' || code === 'KeyM') fireMissile();
    if (code === 'KeyP') paused = !paused;
  },
  onPointer(e) {
    if (st === 'over' && overT > 1) { start(); return; }
    if (st === 'play' && e.button === 2) fireMissile();
  }
};
})();
