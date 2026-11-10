(function(){
'use strict';
// ---------- State ----------
let state = 'menu', paused = false, overT = 0;
let score = 0, hi = +(localStorage.getItem('skystrike_hi') || 0);
let wave = 0, waveDelay = 0, spawnQ = [], bannerT = 0, bannerText = '', bannerSub = '';
let combo = 0, comboT = 0, maxCombo = 0, kills = 0;
let shake = 0, flash = 0, flashHue = 0, hurtFx = 0, ts = 1, slowT = 0, hitstop = 0, time = 0, warp = 0;
let P, bullets, ebullets, enemies, parts, rings, texts, pups, ghosts, bombWave;

const stars = [];
for (let i = 0; i < 160; i++) stars.push({ x: R(), y: R(), z: R() * 0.9 + 0.1 });
const blobs = [];
for (let i = 0; i < 6; i++) blobs.push({ x: R(), y: R(), r: rr(200, 420), h: rr(200, 320), s: rr(8, 22) });

function startGame() {
  state = 'play'; paused = false;
  score = 0; wave = 0; combo = 0; maxCombo = 0; kills = 0; comboT = 0;
  bullets = []; ebullets = []; enemies = []; parts = []; rings = []; texts = []; pups = []; ghosts = []; spawnQ = [];
  bombWave = null; shake = flash = hurtFx = 0; ts = 1; slowT = 0; hitstop = 0;
  P = { x: W / 2, y: H + 60, vx: 0, vy: 0, hp: 5, maxhp: 5, r: 12, shield: 0, dashT: 0, dashCd: 0, dx: 0, dy: -1,
    bombs: 2, wpn: 1, fire: 0, missile: 0, inv: 0, roll: 0, dead: false, intro: 1.2 };
  waveDelay = 1.2;
  burst(P.x, H - 80, 40, 190, 300, 3);
}

// ---------- Effects ----------
function burst(x, y, n, hue, spd, size, life = 0.8) {
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, s = R() * spd;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(0.3, 1) * life, max: life, size: rr(0.5, 1) * size,
      h: hue + rr(-20, 20), drag: 1.5 });
  }
}
function ring(x, y, hue, maxR, dur = 0.6, w = 4) { rings.push({ x, y, h: hue, r: 0, maxR, t: 0, dur, w }); }
function floatText(x, y, s, hue = 50, size = 18) { texts.push({ x, y, s, h: hue, t: 0, size }); }
function explode(x, y, size, hue) {
  const big = size > 30;
  burst(x, y, Math.floor(size * 1.6), hue, 120 + size * 6, size * 0.2, 0.9);
  burst(x, y, Math.floor(size * 0.8), 45, 80 + size * 4, size * 0.25, 0.6);
  // debris sparks
  for (let i = 0; i < size / 3; i++) {
    const a = R() * TAU, s = rr(100, 400);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(0.4, 1.1), max: 1, size: 1.5, h: 40, drag: 0.6, spark: true });
  }
  ring(x, y, hue, size * 3.5, 0.5, 5);
  if (big) ring(x, y, 45, size * 5, 0.8, 8);
  parts.push({ x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: size * 3.5, h: 45, drag: 0, flashy: true });
  shake = Math.max(shake, Math.min(30, size * 0.5));
  sfx.boom(big);
}

// ---------- Enemies ----------
const ET = {
  drone:   { hp: 2,  r: 15, score: 100, hue: 190 },
  fighter: { hp: 6,  r: 20, score: 250, hue: 320 },
  kamik:   { hp: 3,  r: 16, score: 200, hue: 28 },
  heavy:   { hp: 28, r: 34, score: 700, hue: 275 },
  boss:    { hp: 200, r: 70, score: 5000, hue: 355 }
};
function spawn(type, x, y, extra) {
  const t = ET[type];
  const e = Object.assign({ type, x, y, x0: x, vx: 0, vy: 0, hp: t.hp, max: t.hp, r: t.r, hue: t.hue, t: 0, hit: 0, cd: rr(0.5, 1.5),
    ph: rr(0, TAU), dir: R() < 0.5 ? -1 : 1, ty: rr(0.12, 0.3) * H, ang: Math.PI / 2 }, extra || {});
  if (type === 'boss') { e.hp = e.max = 180 + wave * 25; e.ty = H * 0.2; }
  enemies.push(e);
  return e;
}
function planWave() {
  wave++;
  spawnQ = [];
  const w = wave;
  if (w % 5 === 0) {
    bannerText = 'WARNING'; bannerSub = 'BOSS APPROACHING';
    spawnQ.push({ t: 2.2, f: () => spawn('boss', W / 2, -120) });
    sfx.alarm(); setTimeout(sfx.alarm, 500); setTimeout(sfx.alarm, 1000);
  } else {
    bannerText = 'WAVE ' + w; bannerSub = ['GET READY', 'ENGAGE', 'DESTROY THEM ALL', 'NO MERCY'][w % 4];
    sfx.wave();
    let t = 1.5;
    const groups = 1 + Math.floor(w / 2);
    for (let g = 0; g < groups; g++) {
      const gx = rr(0.2, 0.8) * W, mode = Math.floor(R() * 3);
      for (let i = 0; i < 5; i++) {
        const tt = t + i * 0.25;
        spawnQ.push({ t: tt, f: () => spawn('drone', mode === 0 ? gx : mode === 1 ? W * 0.15 : W * 0.85, -30, { amp: mode === 0 ? 0 : 0, pat: mode, gx }) });
      }
      t += rr(2, 3.5);
    }
    for (let i = 0; i < Math.floor(w / 2) + 1; i++) { spawnQ.push({ t: rr(2, t + 2), f: () => spawn('fighter', rr(0.15, 0.85) * W, -40) }); }
    for (let i = 0; i < Math.floor(w / 2); i++) { spawnQ.push({ t: rr(3, t + 4), f: () => spawn('kamik', rr(0.1, 0.9) * W, -40) }); }
    for (let i = 0; i < Math.floor(w / 3); i++) { spawnQ.push({ t: rr(4, t + 3), f: () => spawn('heavy', rr(0.25, 0.75) * W, -60) }); }
  }
  bannerT = 2.6;
  spawnQ.forEach(s => s.t += 0); spawnQ.sort((a, b) => a.t - b.t);
  waveClock = 0;
}
let waveClock = 0;

function ebullet(x, y, ang, spd, hue = 340, r = 6) {
  ebullets.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, h: hue, t: 0 });
}
function aimAt(e) { return Math.atan2(P.y - e.y, P.x - e.x); }

function killEnemy(e) {
  const t = ET[e.type];
  if (e.type === 'boss') { e.dying = 2.2; e.hit = 0; return; }
  e.dead = true;
  explode(e.x, e.y, e.r * 1.4, e.hue);
  addScore(t.score, e.x, e.y);
  kills++;
  const drop = e.type === 'heavy' ? 1 : e.type === 'fighter' ? 0.18 : 0.07;
  if (R() < drop) dropPup(e.x, e.y);
}
function addScore(base, x, y) {
  combo++; comboT = 2.2; maxCombo = Math.max(maxCombo, combo);
  const m = Math.min(10, 1 + Math.floor(combo / 5));
  const pts = base * m;
  score += pts;
  floatText(x, y, '+' + pts, m > 4 ? 30 : 50, 14 + m);
}
function dropPup(x, y, type) {
  const r = R();
  type = type || (r < 0.4 ? 'W' : r < 0.62 ? 'S' : r < 0.82 ? 'H' : 'B');
  pups.push({ x, y, type, t: 0, vy: 60 });
}
const PUP = { W: { h: 50, n: 'WEAPON' }, S: { h: 190, n: 'SHIELD' }, H: { h: 120, n: 'REPAIR' }, B: { h: 340, n: 'BOMB' } };

// ---------- Player actions ----------
function tryDash() {
  if (!P || P.dead || P.dashCd > 0 || P.dashT > 0 || P.intro > 0) return;
  let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let dy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  if (!dx && !dy && ptr.active) { dx = clamp(ptr.x - P.x, -1, 1); dy = 0; }
  if (!dx && !dy) dx = P.vx >= 0 ? 1 : -1;
  const l = Math.hypot(dx, dy); P.dx = dx / l; P.dy = dy / l;
  P.dashT = 0.32; P.dashCd = 1.4; P.roll = 0; P.inv = Math.max(P.inv, 0.4);
  warp = 1; sfx.dash();
  ring(P.x, P.y, 190, 120, 0.4, 3);
}
function tryBomb() {
  if (!P || P.dead || P.bombs <= 0 || bombWave || P.intro > 0) return;
  P.bombs--; bombWave = { x: P.x, y: P.y, r: 0 };
  flash = 1; flashHue = 190; shake = 35; slowT = 0.5; sfx.bomb();
  ring(P.x, P.y, 190, 900, 1, 14); ring(P.x, P.y, 300, 700, 0.8, 8);
  P.inv = Math.max(P.inv, 1);
}
function hurt() {
  if (P.inv > 0 || P.dead) return;
  if (P.shield > 0) { P.shield = 0; ring(P.x, P.y, 190, 100, 0.5, 6); burst(P.x, P.y, 30, 190, 300, 3); P.inv = 1; shake = 14; sfx.hurt(); return; }
  P.hp--; P.inv = 1.8; hurtFx = 1; shake = 28; combo = 0; hitstop = 0.12; slowT = 0.35; sfx.hurt();
  P.wpn = Math.max(1, P.wpn - 1);
  burst(P.x, P.y, 40, 20, 350, 3); ring(P.x, P.y, 20, 140, 0.5, 6);
  if (P.hp <= 0) {
    P.dead = true; state = 'over'; overT = 0;
    for (let i = 0; i < 6; i++) setTimeout(() => explode(P.x + rr(-30, 30), P.y + rr(-30, 30), rr(25, 50), rr(0, 60)), i * 90);
    slowT = 1.5; flash = 1; flashHue = 20;
    if (score > hi) { hi = score; try { localStorage.setItem('skystrike_hi', hi); } catch (e) {} }
  }
}

function playerFire() {
  const lv = P.wpn, y = P.y - 22;
  const shots = [];
  const add = (ox, ang, dmg = 1, hue = 190) => shots.push({ x: P.x + ox, y, vx: Math.sin(ang) * 1000, vy: -Math.cos(ang) * 1000, dmg, r: 5, h: hue });
  if (lv === 1) add(0, 0, 1.2);
  else if (lv === 2) { add(-9, 0); add(9, 0); }
  else if (lv === 3) { add(0, 0, 1.3); add(-12, -0.09); add(12, 0.09); }
  else if (lv === 4) { add(-8, 0); add(8, 0); add(-16, -0.13); add(16, 0.13); }
  else { add(0, 0, 1.5, 50); add(-10, -0.07); add(10, 0.07); add(-18, -0.17); add(18, 0.17); }
  bullets.push(...shots);
  sfx.shoot();
  parts.push({ x: P.x, y, vx: 0, vy: -50, life: 0.1, max: 0.1, size: 14, h: 190, drag: 0, flashy: true });
}
function fireMissiles() {
  for (const s of [-1, 1]) {
    bullets.push({ x: P.x + s * 20, y: P.y, vx: s * 150, vy: -150, dmg: 3, r: 7, h: 30, missile: true, t: 0 });
  }
  sfx.missile();
}

// ---------- Update ----------
function update(dt) {
  time += dt;
  // time scale
  if (slowT > 0) { slowT -= dt / Math.max(ts, 0.2); ts = lerp(ts, 0.25, 0.15); } else ts = lerp(ts, 1, 0.08);
  const wdt = dt * ts;

  shake = Math.max(0, shake - dt * 40);
  flash = Math.max(0, flash - dt * 2.5);
  hurtFx = Math.max(0, hurtFx - dt * 1.5);
  warp = Math.max(0, warp - dt * 2.5);
  if (bannerT > 0) bannerT -= dt;

  if (hitstop > 0) { hitstop -= dt; return; }
  if (state === 'over') overT += dt;
  if (comboT > 0) { comboT -= wdt; if (comboT <= 0) combo = 0; }

  // background (always)
  // player
  if (!P.dead) updatePlayer(wdt);

  // wave director
  if (state === 'play') {
    if (waveDelay > 0) { waveDelay -= wdt; if (waveDelay <= 0) planWave(); }
    else {
      waveClock += wdt;
      while (spawnQ.length && spawnQ[0].t <= waveClock) spawnQ.shift().f();
      if (!spawnQ.length && !enemies.length) {
        waveDelay = 2.2;
        if (wave % 5 === 0) { P.hp = Math.min(P.maxhp, P.hp + 1); P.bombs = Math.min(5, P.bombs + 1); }
      }
    }
  }

  // player bullets
  for (const b of bullets) {
    b.t = (b.t || 0) + wdt;
    if (b.missile) {
      let tgt = null, bd = 1e9;
      for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; tgt = e; } }
      let sp = Math.min(900, 250 + b.t * 1200), ang = Math.atan2(b.vy, b.vx);
      if (tgt) {
        let da = Math.atan2(tgt.y - b.y, tgt.x - b.x) - ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        ang += clamp(da, -7 * wdt, 7 * wdt);
      } else ang = lerp(ang, -Math.PI / 2, 0.1);
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
      if (R() < 0.8) parts.push({ x: b.x, y: b.y, vx: rr(-20, 20), vy: rr(-20, 20) + 40, life: 0.4, max: 0.4, size: 4, h: 30, drag: 2 });
    } else if (R() < 0.5) parts.push({ x: b.x, y: b.y + 10, vx: 0, vy: 60, life: 0.15, max: 0.15, size: 3, h: b.h, drag: 0 });
    b.x += b.vx * wdt; b.y += b.vy * wdt;
    if (b.y < -30 || b.x < -30 || b.x > W + 30 || b.y > H + 30) b.dead = true;
  }

  // enemies
  for (const e of enemies) updateEnemy(e, wdt);

  // bullet vs enemy
  for (const b of bullets) {
    if (b.dead) continue;
    for (const e of enemies) {
      if (e.dead || e.dying || e.y < -e.r) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
        b.dead = true; e.hp -= b.dmg; e.hit = 0.08;
        burst(b.x, b.y, b.missile ? 14 : 3, b.h, b.missile ? 250 : 150, 2, 0.3);
        if (b.missile) { explode(b.x, b.y, 18, 30); ring(b.x, b.y, 30, 70, 0.3, 3); }
        sfx.hit();
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
  }

  // enemy bullets
  for (const b of ebullets) {
    b.t += wdt; b.x += b.vx * wdt; b.y += b.vy * wdt;
    if (b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) b.dead = true;
    if (!P.dead && P.dashT <= 0 && Math.hypot(b.x - P.x, b.y - P.y) < b.r + P.r * 0.7) { b.dead = true; hurt(); }
  }

  // enemy contact
  if (!P.dead) for (const e of enemies) {
    if (e.dead || e.dying) continue;
    if (Math.hypot(e.x - P.x, e.y - P.y) < e.r + P.r) {
      if (P.dashT > 0) { // ramming during dash
        e.hp -= 8; e.hit = 0.1; shake = 10; burst(e.x, e.y, 10, 190, 300, 3);
        if (e.hp <= 0) killEnemy(e);
      } else if (P.inv <= 0) {
        e.hp -= 6; e.hit = 0.1; hurt();
        if (e.hp <= 0 && e.type !== 'boss') killEnemy(e);
      }
    }
  }

  // bomb shockwave
  if (bombWave) {
    bombWave.r += 1500 * wdt;
    for (const e of enemies) {
      if (e.dead || e.bombed) continue;
      if (Math.hypot(e.x - bombWave.x, e.y - bombWave.y) < bombWave.r) {
        e.bombed = true; e.hp -= 45; e.hit = 0.2;
        burst(e.x, e.y, 20, 190, 300, 3);
        if (e.hp <= 0 && !e.dying) killEnemy(e);
      }
    }
    for (const b of ebullets) {
      if (!b.dead && Math.hypot(b.x - bombWave.x, b.y - bombWave.y) < bombWave.r) {
        b.dead = true; burst(b.x, b.y, 4, 190, 120, 2, 0.5); score += 10;
      }
    }
    if (bombWave.r > Math.hypot(W, H)) bombWave = null;
  }

  // pickups
  for (const p of pups) {
    p.t += wdt;
    const d = Math.hypot(P.x - p.x, P.y - p.y);
    if (!P.dead && d < 170) { p.x += (P.x - p.x) * 5 * wdt; p.y += (P.y - p.y) * 5 * wdt; }
    else p.y += p.vy * wdt;
    if (p.y > H + 30) p.dead = true;
    if (!P.dead && d < 30) {
      p.dead = true; sfx.pickup(); const c = PUP[p.type];
      ring(p.x, p.y, c.h, 90, 0.5, 4); burst(p.x, p.y, 25, c.h, 250, 3);
      floatText(p.x, p.y - 20, c.n, c.h, 18);
      if (p.type === 'W') { if (P.wpn < 5) P.wpn++; else score += 500; }
      if (p.type === 'S') P.shield = 1;
      if (p.type === 'H') P.hp = Math.min(P.maxhp, P.hp + 1);
      if (p.type === 'B') P.bombs = Math.min(5, P.bombs + 1);
      flash = Math.max(flash, 0.2); flashHue = c.h;
    }
  }

  // particles
  for (const p of parts) {
    p.life -= wdt; if (p.life <= 0) { p.dead = true; continue; }
    const dr = Math.exp(-p.drag * wdt); p.vx *= dr; p.vy *= dr;
    p.x += p.vx * wdt; p.y += p.vy * wdt;
  }
  for (const r of rings) { r.t += wdt; r.r = r.maxR * (1 - Math.pow(1 - r.t / r.dur, 3)); if (r.t >= r.dur) r.dead = true; }
  for (const t of texts) { t.t += wdt; t.y -= 40 * wdt; if (t.t > 1.1) t.dead = true; }
  for (const g of ghosts) { g.life -= dt; if (g.life <= 0) g.dead = true; }

  bullets = bullets.filter(o => !o.dead); ebullets = ebullets.filter(o => !o.dead);
  enemies = enemies.filter(o => !o.dead); parts = parts.filter(o => !o.dead);
  rings = rings.filter(o => !o.dead); texts = texts.filter(o => !o.dead);
  pups = pups.filter(o => !o.dead); ghosts = ghosts.filter(o => !o.dead);
  if (parts.length > 1500) parts.splice(0, parts.length - 1500);
}

function updatePlayer(dt) {
  if (P.intro > 0) { // fly-in
    P.intro -= dt; P.y = lerp(P.y, H * 0.82, 0.07); P.vy = -300;
    engineTrail(); return;
  }
  const spd = 520;
  let ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let iy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  let tvx, tvy;
  if (P.dashT > 0) {
    P.dashT -= dt; tvx = P.dx * 1100; tvy = P.dy * 1100;
    P.roll += dt / 0.32 * TAU;
    if (R() < 1) ghosts.push({ x: P.x, y: P.y, life: 0.3, max: 0.3, roll: P.roll, vx: P.vx });
    P.vx = lerp(P.vx, tvx, 0.5); P.vy = lerp(P.vy, tvy, 0.5);
    if (P.dashT <= 0) { P.roll = 0; }
  } else {
    if (ptr.down || (ptr.active && !ix && !iy && !(keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD) && ptrMoved())) {
      tvx = clamp((ptr.x - P.x) * 9, -spd * 1.3, spd * 1.3);
      tvy = clamp((ptr.y - (ptr.down ? 70 : 0) - P.y) * 9, -spd * 1.3, spd * 1.3);
    } else {
      const l = Math.hypot(ix, iy) || 1; tvx = ix / l * spd; tvy = iy / l * spd;
    }
    P.vx = lerp(P.vx, tvx, 1 - Math.exp(-12 * dt)); P.vy = lerp(P.vy, tvy, 1 - Math.exp(-12 * dt));
  }
  P.x = clamp(P.x + P.vx * dt, 20, W - 20); P.y = clamp(P.y + P.vy * dt, 40, H - 30);
  P.dashCd = Math.max(0, P.dashCd - dt); P.inv = Math.max(0, P.inv - dt);
  engineTrail();
  // fire
  P.fire -= dt;
  if (P.fire <= 0 && P.dashT <= 0) { P.fire = P.wpn >= 4 ? 0.09 : 0.115; playerFire(); }
  if (P.wpn >= 4) { P.missile -= dt; if (P.missile <= 0) { P.missile = 0.9; fireMissiles(); } }
}
let lastPtr = { x: -1, y: -1 };
function ptrMoved() { const m = Math.abs(ptr.x - lastPtr.x) + Math.abs(ptr.y - lastPtr.y) > 0; if (m) { lastPtr.x = ptr.x; lastPtr.y = ptr.y; ptrTimer = 1.5; } return ptrTimer > 0; }
let ptrTimer = 0;
function engineTrail() {
  const boost = P.dashT > 0 ? 3 : 1;
  for (const s of [-6, 6]) {
    parts.push({ x: P.x + s, y: P.y + 18, vx: rr(-25, 25), vy: rr(150, 300) * boost, life: rr(0.15, 0.35), max: 0.35, size: rr(2, 4), h: P.dashT > 0 ? 190 : rr(15, 40), drag: 1 });
  }
}

function updateEnemy(e, dt) {
  e.t += dt; e.hit = Math.max(0, e.hit - dt); e.cd -= dt;
  if (e.dying) { // boss death
    e.dying -= dt; e.y += 10 * dt; e.x += Math.sin(e.t * 40) * 1.5;
    if (R() < 0.35) explode(e.x + rr(-e.r, e.r), e.y + rr(-e.r, e.r), rr(15, 40), rr(0, 50));
    if (e.dying <= 0) {
      e.dead = true; explode(e.x, e.y, 120, 45); flash = 1; flashHue = 45; slowT = 1.2; shake = 40;
      addScore(ET.boss.score + wave * 500, e.x, e.y); floatText(e.x, e.y - 40, 'BOSS DESTROYED', 50, 30);
      ebullets.forEach(b => { b.dead = true; burst(b.x, b.y, 3, 50, 120, 2); });
      dropPup(e.x - 40, e.y, 'W'); dropPup(e.x, e.y, 'B'); dropPup(e.x + 40, e.y, 'H');
      kills++;
    }
    return;
  }
  switch (e.type) {
    case 'drone': {
      e.y += 130 * dt;
      if (e.pat === 0) e.x = e.gx + Math.sin(e.t * 3) * 90;
      else if (e.pat === 1) e.x += 120 * dt * Math.cos(e.t * 1.5 + 0.4) + 60 * dt;
      else e.x -= 120 * dt * Math.cos(e.t * 1.5 + 0.4) + 60 * dt;
      e.ang = Math.PI / 2 + Math.sin(e.t * 3) * 0.3;
      if (e.t > 1 && e.cd <= 0 && R() < 0.02) { ebullet(e.x, e.y, aimAt(e), 220, 190, 5); e.cd = 2; }
      if (e.y > H + 40) e.dead = true; break;
    }
    case 'fighter': {
      if (e.y < e.ty && !e.arrived) e.y += 180 * dt; else e.arrived = true;
      if (e.arrived) {
        e.x += e.dir * 90 * dt; if (e.x < 60 || e.x > W - 60) e.dir *= -1;
        e.y += Math.sin(e.t * 2) * 20 * dt;
        if (e.cd <= 0) { e.cd = 1.5; const a = aimAt(e); for (const s of [-0.12, 0, 0.12]) ebullet(e.x, e.y + 14, a + s, 280, 320, 6); }
        if (e.t > 14) e.y -= 0, e.ty = -200, e.arrived = false;
      }
      e.ang = Math.PI / 2; if (e.y < -120 && e.t > 14) e.dead = true; break;
    }
    case 'kamik': {
      if (e.t < 0.8) { e.y += 60 * dt; e.ang = lerp(e.ang, aimAt(e), 0.15); }
      else {
        const want = aimAt(e); let da = want - e.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        e.ang += clamp(da, -2.2 * dt, 2.2 * dt);
        const sp = Math.min(520, 150 + (e.t - 0.8) * 400);
        e.x += Math.cos(e.ang) * sp * dt; e.y += Math.sin(e.ang) * sp * dt;
        if (R() < 0.7) parts.push({ x: e.x - Math.cos(e.ang) * 12, y: e.y - Math.sin(e.ang) * 12, vx: rr(-20, 20), vy: rr(-20, 20), life: 0.3, max: 0.3, size: 3, h: 25, drag: 1 });
      }
      if (e.y > H + 60 || e.x < -80 || e.x > W + 80) e.dead = true; break;
    }
    case 'heavy': {
      if (e.y < e.ty) e.y += 70 * dt;
      e.x += Math.sin(e.t * 0.8 + e.ph) * 60 * dt; e.x = clamp(e.x, 50, W - 50);
      e.ang = Math.PI / 2;
      if (e.cd <= 0 && e.y >= e.ty * 0.9) {
        e.cd = 2.2; const n = 9, o = rr(0, TAU);
        for (let i = 0; i < n; i++) ebullet(e.x, e.y, o + i / n * TAU, 170, 280, 7);
        ring(e.x, e.y, 280, 60, 0.4, 3);
        setTimeout(() => { if (!e.dead) { const a = aimAt(e); for (let i = -2; i <= 2; i++) ebullet(e.x, e.y, a + i * 0.16, 260, 300, 6); } }, 400);
      } break;
    }
    case 'boss': {
      if (e.y < e.ty) { e.y += 80 * dt; e.cd = 1.5; break; }
      const hpr = e.hp / e.max, phase = hpr > 0.66 ? 1 : hpr > 0.33 ? 2 : 3;
      if (phase !== e.phase) { e.phase = phase; if (phase > 1) { ring(e.x, e.y, 355, 400, 0.8, 10); shake = 25; flash = 0.6; flashHue = 355; sfx.alarm(); } }
      e.x = W / 2 + Math.sin(e.t * (0.5 + phase * 0.2)) * W * 0.32;
      e.y = e.ty + Math.sin(e.t * 1.3) * 25;
      e.spin = (e.spin || 0) + dt * (1 + phase);
      e.ang = Math.PI / 2;
      if (e.cd <= 0) {
        if (phase === 1) {
          e.cd = 1.8; const a = aimAt(e);
          for (let i = -3; i <= 3; i++) ebullet(e.x, e.y + 30, a + i * 0.14, 300, 340, 7);
          setTimeout(() => { if (!e.dead && !e.dying) for (let i = 0; i < 18; i++) ebullet(e.x, e.y, i / 18 * TAU + e.t, 190, 30, 7); }, 700);
        } else if (phase === 2) {
          e.cd = 0.09; e.sa = (e.sa || 0) + 0.28;
          for (let k = 0; k < 2; k++) ebullet(e.x, e.y, e.sa + k * Math.PI, 230, 280 + (e.sa * 20) % 80, 6);
          e.sc = (e.sc || 0) + 1;
          if (e.sc % 40 === 0) { const a = aimAt(e); for (let i = -4; i <= 4; i++) ebullet(e.x, e.y, a + i * 0.1, 330, 340, 7); }
        } else {
          e.cd = 0.11; e.sa = (e.sa || 0) + 0.31;
          for (let k = 0; k < 3; k++) ebullet(e.x, e.y, e.sa + k * TAU / 3, 240, 20 + k * 30, 6);
          e.sc = (e.sc || 0) + 1;
          if (e.sc % 28 === 0) { for (let i = 0; i < 24; i++) ebullet(e.x, e.y, i / 24 * TAU, 180, 190, 8); }
          if (e.sc % 70 === 0) { spawn('kamik', e.x - 60, e.y), spawn('kamik', e.x + 60, e.y); }
        }
      }
      break;
    }
  }
}

// ---------- Drawing ----------
function polyPath(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
const SHIP = [[0, -26], [7, -8], [26, 12], [24, 18], [9, 10], [6, 20], [0, 16], [-6, 20], [-9, 10], [-24, 18], [-26, 12], [-7, -8]];
function drawShip(x, y, roll, vx, alpha, tint) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(clamp(vx / 1200, -0.5, 0.5)); ctx.scale(Math.cos(roll) || 0.02, 1);
  ctx.globalAlpha = alpha;
  glow(0, 4, 50, tint === undefined ? 200 : tint, 0.35 * alpha);
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, -26, 0, 20);
  g.addColorStop(0, '#e8fbff'); g.addColorStop(0.5, '#5ec8ff'); g.addColorStop(1, '#2058c8');
  polyPath(SHIP); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#bff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#0a1a40'; ctx.beginPath(); ctx.ellipse(0, -4, 3.5, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(120,230,255,.8)'; ctx.beginPath(); ctx.ellipse(0, -6, 2, 4, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang - Math.PI / 2 + Math.PI);
  const r = e.r, h = e.hue, hit = e.hit > 0;
  ctx.globalAlpha = 1; glow(0, 0, r * 2.2, h, 0.35);
  ctx.globalAlpha = 1;
  const fill = hit ? '#fff' : `hsl(${h},60%,18%)`, stroke = hit ? '#fff' : `hsl(${h},100%,65%)`;
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
  if (e.type === 'drone') {
    polyPath([[0, -r], [r, r * 0.3], [r * 0.4, r], [-r * 0.4, r], [-r, r * 0.3]]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = stroke; ctx.beginPath(); ctx.arc(0, 0, 3 + Math.sin(e.t * 10), 0, TAU); ctx.fill();
  } else if (e.type === 'fighter') {
    polyPath([[0, -r], [r * 0.3, -r * 0.3], [r * 1.2, r * 0.2], [r * 0.9, r * 0.8], [r * 0.3, r * 0.4], [0, r * 0.8], [-r * 0.3, r * 0.4], [-r * 0.9, r * 0.8], [-r * 1.2, r * 0.2], [-r * 0.3, -r * 0.3]]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = stroke; ctx.fillRect(-3, -4, 6, 10);
  } else if (e.type === 'kamik') {
    polyPath([[0, -r * 1.3], [r * 0.7, r * 0.5], [0, r * 0.2], [-r * 0.7, r * 0.5]]); ctx.fill(); ctx.stroke();
    if (e.t < 0.8 && Math.floor(e.t * 14) % 2) { ctx.strokeStyle = '#f33'; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.stroke(); }
  } else if (e.type === 'heavy') {
    ctx.rotate(Math.PI);
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(e.t * 1.5); ctx.strokeStyle = stroke; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); } ctx.closePath(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = stroke; ctx.beginPath(); ctx.arc(0, 0, 6 + Math.sin(e.t * 6) * 2, 0, TAU); ctx.fill();
  } else if (e.type === 'boss') {
    ctx.rotate(Math.PI);
    const dy = e.dying ? 1 : 0;
    polyPath([[0, -r * 0.9], [r * 0.5, -r * 0.5], [r * 1.5, -r * 0.1], [r * 1.7, r * 0.5], [r * 0.8, r * 0.4], [r * 0.4, r * 0.9], [-r * 0.4, r * 0.9], [-r * 0.8, r * 0.4], [-r * 1.7, r * 0.5], [-r * 1.5, -r * 0.1], [-r * 0.5, -r * 0.5]]);
    ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(e.spin || 0); ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.5 + k * 0.25), k, k + Math.PI * 1.2); ctx.stroke(); }
    ctx.restore();
    const pulse = 0.5 + 0.5 * Math.sin(e.t * (4 + (e.phase || 1) * 3));
    glow(0, 0, r * 1.2, h, 0.6 + pulse * 0.4);
    ctx.globalAlpha = 1; ctx.fillStyle = hit ? '#fff' : `hsl(${h},100%,${60 + pulse * 25}%)`;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawBackground() {
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#02030c'); g.addColorStop(1, '#0a0c24');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const sp = 1 + warp * 4;
  for (const b of blobs) {
    b.y += b.s * ts * sp / 600; if (b.y > 1.5) { b.y = -0.5; b.x = R(); }
    ctx.globalAlpha = 0.16; glow(b.x * W, b.y * H, b.r, b.h);
  }
  for (const s of stars) {
    s.y += (0.05 + s.z * 0.35) * ts * sp * 0.004 * 60 / 60 * 3;
    if (s.y > 1) { s.y = 0; s.x = R(); }
    const x = s.x * W, y = s.y * H, len = (s.z * 6) * (1 + warp * 12 + (state === 'menu' ? 2 : 0));
    ctx.globalAlpha = 0.3 + s.z * 0.7; ctx.strokeStyle = s.z > 0.7 ? '#cfe' : '#89b'; ctx.lineWidth = s.z * 1.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - len); ctx.stroke();
  }
  // moving grid horizon lines for speed feel
  ctx.globalAlpha = 0.05; ctx.strokeStyle = '#4af'; ctx.lineWidth = 1;
  const off = (time * 120 * sp) % 80;
  for (let y = -80 + off; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground();
  ctx.save();
  if (shake > 0) ctx.translate(rr(-shake, shake) * 0.5, rr(-shake, shake) * 0.5);
  ctx.globalAlpha = 1;

  if (state !== 'menu') {
    // pickups
    for (const p of pups) {
      const c = PUP[p.type], bob = Math.sin(p.t * 5) * 3;
      ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y + bob, 32, c.h, 0.8 + Math.sin(p.t * 8) * 0.2);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(p.t * 2);
      ctx.strokeStyle = `hsl(${c.h},100%,70%)`; ctx.lineWidth = 2; ctx.strokeRect(-11, -11, 22, 22); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.type, p.x, p.y + bob + 1);
    }
    // enemies
    for (const e of enemies) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; drawEnemy(e); }

    // ghosts + player
    ctx.globalCompositeOperation = 'lighter';
    for (const g of ghosts) drawShip(g.x, g.y, g.roll, g.vx, g.life / g.max * 0.35, 190);
    ctx.globalCompositeOperation = 'source-over';
    if (!P.dead) {
      const blink = P.inv > 0 && P.dashT <= 0 && Math.floor(time * 20) % 2 === 0;
      if (!blink) drawShip(P.x, P.y, P.roll, P.vx, 1);
      if (P.shield > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 + Math.sin(time * 8) * 0.2; ctx.strokeStyle = '#6ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(P.x, P.y, 34, 0, TAU); ctx.stroke();
        glow(P.x, P.y, 50, 190, 0.35);
        ctx.globalCompositeOperation = 'source-over';
      }
      // dash cooldown arc
      if (P.dashCd > 0) {
        ctx.globalAlpha = 0.6; ctx.strokeStyle = '#4af'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(P.x, P.y, 40, -Math.PI / 2, -Math.PI / 2 + (1 - P.dashCd / 1.4) * TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }

    // additive layer: bullets, particles, rings
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      glow(b.x, b.y, b.missile ? 22 : 18, b.h, 0.9);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff';
      if (b.missile) { ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, TAU); ctx.fill(); }
      else ctx.fillRect(b.x - 1.5, b.y - 9, 3, 18);
    }
    for (const b of ebullets) {
      glow(b.x, b.y, b.r * 3.2, b.h, 0.9);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); ctx.fill();
    }
    for (const p of parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.flashy) { glow(p.x, p.y, p.size * (1 + (1 - a)), p.h, a); continue; }
      if (p.spark) {
        ctx.globalAlpha = a; ctx.strokeStyle = `hsl(${p.h},100%,70%)`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); continue;
      }
      glow(p.x, p.y, p.size * (0.6 + a) * 2.2, p.h, a * 0.9);
    }
    for (const r of rings) {
      const a = 1 - r.t / r.dur;
      ctx.globalAlpha = a; ctx.strokeStyle = `hsl(${r.h},100%,65%)`; ctx.lineWidth = r.w * a + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    }
    if (bombWave) {
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#9ff'; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.arc(bombWave.x, bombWave.y, bombWave.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#7cf'; ctx.lineWidth = 50; ctx.strokeStyle = '#38f';
      ctx.beginPath(); ctx.arc(bombWave.x, bombWave.y, bombWave.r - 20, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

    // floating texts
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of texts) {
      const a = 1 - t.t / 1.1, sc = 1 + Math.max(0, 0.3 - t.t) * 3;
      ctx.globalAlpha = a; ctx.font = `bold ${t.size * sc}px Segoe UI, sans-serif`;
      ctx.fillStyle = `hsl(${t.h},100%,70%)`; ctx.fillText(t.s, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // screen flash / hurt vignette
  if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flash * 0.6; ctx.fillStyle = `hsl(${flashHue},100%,70%)`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  if (hurtFx > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,20,40,${hurtFx * 0.7})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // slow-mo vignette
  if (ts < 0.8) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,10,40,${(1 - ts) * 0.6})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  if (state !== 'menu') { drawHUD(); drawBanner(); if (state === 'over') drawOver(); if (paused) drawPause(); }
}

function drawHUD() {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.font = 'bold 30px Segoe UI, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText(String(Math.floor(score)).padStart(8, '0'), 20, 44);
  ctx.font = '13px Segoe UI, sans-serif'; ctx.fillStyle = '#8ac';
  ctx.fillText('HI ' + Math.max(hi, score).toLocaleString() + '   WAVE ' + Math.max(1, wave), 22, 64);
  // hp
  for (let i = 0; i < P.maxhp; i++) {
    const x = 24 + i * 26, y = 80, on = i < P.hp;
    ctx.globalAlpha = on ? 1 : 0.25; ctx.fillStyle = on ? (P.hp <= 1 ? '#f44' : '#4f9') : '#456';
    polyPath([[x, y], [x + 18, y], [x + 22, y + 6], [x + 18, y + 12], [x, y + 12], [x + 4, y + 6]]); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // bombs
  for (let i = 0; i < P.bombs; i++) {
    const x = 34 + i * 26, y = 112;
    ctx.fillStyle = '#f48'; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('B', x, y + 4);
  }
  // weapon level
  ctx.textAlign = 'left'; ctx.fillStyle = '#fd6'; ctx.font = 'bold 13px Segoe UI, sans-serif';
  ctx.fillText('WEAPON ' + '▮'.repeat(P.wpn) + '▯'.repeat(5 - P.wpn), 24, 140);
  // combo
  if (combo > 1) {
    const m = Math.min(10, 1 + Math.floor(combo / 5)), pulse = 1 + Math.max(0, Math.sin(time * 10)) * 0.05;
    ctx.save(); ctx.translate(W - 24, 50); ctx.scale(pulse, pulse); ctx.textAlign = 'right';
    ctx.font = 'bold 36px Segoe UI, sans-serif'; ctx.fillStyle = `hsl(${50 - m * 4},100%,${60 + m * 2}%)`; ctx.fillText(combo + ' COMBO', 0, 0);
    ctx.font = 'bold 18px Segoe UI, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('x' + m + ' MULTIPLIER', 0, 24);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-150, 32, 150, 4);
    ctx.fillStyle = '#fd6'; ctx.fillRect(-150, 32, 150 * clamp(comboT / 2.2, 0, 1), 4);
    ctx.restore();
  }
  // boss bar
  const boss = enemies.find(e => e.type === 'boss' && !e.dying);
  if (boss) {
    const w = Math.min(W * 0.6, 600), x = (W - w) / 2, y = 22;
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, w, 12);
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#f24'); g.addColorStop(1, '#fa4');
    ctx.fillStyle = g; ctx.fillRect(x, y, w * clamp(boss.hp / boss.max, 0, 1), 12);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, 12);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fcc'; ctx.font = 'bold 12px Segoe UI'; ctx.fillText('BOSS', W / 2, y + 28);
  }
}

function drawBanner() {
  if (bannerT <= 0) return;
  const t = 2.6 - bannerT, a = t < 0.3 ? t / 0.3 : bannerT < 0.5 ? bannerT / 0.5 : 1;
  const ease = 1 - Math.pow(1 - Math.min(1, t / 0.5), 3);
  const warn = bannerText === 'WARNING';
  const hue = warn ? 0 : 190;
  ctx.save();
  ctx.globalAlpha = a * 0.6; ctx.fillStyle = warn ? '#400' : '#012';
  ctx.fillRect(0, H * 0.34, W, 110 * ease);
  ctx.globalAlpha = a; ctx.fillStyle = `hsl(${hue},100%,60%)`;
  ctx.fillRect(0, H * 0.34, W * ease, 3); ctx.fillRect(W * (1 - ease), H * 0.34 + 110 * ease, W * ease, 3);
  ctx.letterSpacing = (30 - ease * 20) + 'px';
  const flick = warn ? (Math.floor(time * 8) % 2 ? 1 : 0.5) : 1;
  glowText(bannerText, W / 2 + (1 - ease) * 200, H * 0.34 + 45, 54, hue, a * flick);
  ctx.letterSpacing = '8px';
  glowText(bannerSub, W / 2 - (1 - ease) * 200, H * 0.34 + 90, 18, hue, a * 0.9, '300');
  ctx.letterSpacing = '0px'; ctx.restore();
}

function drawOver() {
  const a = clamp(overT / 1.2, 0, 1);
  ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  if (overT < 0.6) return;
  const k = clamp((overT - 0.6) / 0.5, 0, 1);
  ctx.save(); ctx.translate(W / 2, H * 0.35); ctx.scale(2 - k, 2 - k); ctx.letterSpacing = '10px';
  glowText('GAME OVER', 0, 0, Math.min(W * 0.1, 80), 0, k); ctx.restore(); ctx.letterSpacing = '0px';
  ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Segoe UI, sans-serif';
  ctx.fillText('SCORE  ' + Math.floor(score).toLocaleString(), W / 2, H * 0.5);
  ctx.font = '17px Segoe UI, sans-serif'; ctx.fillStyle = '#9bd';
  ctx.fillText(`WAVE ${wave}  ·  KILLS ${kills}  ·  MAX COMBO ${maxCombo}`, W / 2, H * 0.5 + 34);
  if (score >= hi && score > 0) { ctx.fillStyle = '#fd6'; ctx.font = 'bold 20px Segoe UI'; ctx.fillText('★ NEW HI-SCORE ★', W / 2, H * 0.5 + 66); }
  if (overT > 1) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 250); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Segoe UI'; ctx.fillText('PRESS ENTER TO RETRY', W / 2, H * 0.5 + 110); }
  ctx.globalAlpha = 1;
}
function drawPause() {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
  ctx.letterSpacing = '12px'; glowText('PAUSED', W / 2, H / 2, 60, 190); ctx.letterSpacing = '0px';
}

window.Shooter = {
  start() { startGame(); },
  update(dt) { ptrTimer = Math.max(0, ptrTimer - dt); if (!paused) update(dt); },
  draw() { draw(); },
  hi() { return hi; },
  onKey(code) {
    if (state === 'over' && overT > 1 && (code === 'Enter' || code === 'Space')) startGame();
    else if (state === 'play') {
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') tryDash();
      if (code === 'KeyX' || code === 'KeyB' || code === 'KeyZ') tryBomb();
      if (code === 'KeyP') paused = !paused;
    }
  },
  onPointer(e) {
    if (state === 'over' && overT > 1) startGame();
    else if (state === 'play' && e.pointerType === 'mouse' && e.button === 2) tryBomb();
    else if (state === 'play' && e.pointerType !== 'mouse' && e.clientY < H * 0.5) tryDash();
  }
};
// empty arrays so draw() is safe before start
bullets = []; ebullets = []; enemies = []; parts = []; rings = []; texts = []; pups = []; ghosts = [];
})();
