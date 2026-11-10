'use strict';
// ============ SKY STRIKE ============
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize); resize();

const R = Math.random, TAU = Math.PI * 2;
const rr = (a, b) => a + R() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- Audio ----------
let AC = null, master = null, noiseBuf = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(f1, f2, dur, type = 'square', vol = 0.05) {
  if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, freq = 1200) {
  if (!AC) return;
  const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}
let lastShootSnd = 0;
const sfx = {
  shoot() { const n = performance.now(); if (n - lastShootSnd < 70) return; lastShootSnd = n; tone(880, 300, 0.07, 'square', 0.02); },
  hit() { tone(300, 120, 0.05, 'sawtooth', 0.03); },
  boom(big) { noise(big ? 0.9 : 0.35, big ? 0.5 : 0.22, big ? 2500 : 1500); tone(big ? 120 : 160, 30, big ? 0.7 : 0.3, 'sawtooth', 0.12); },
  pickup() { tone(500, 1200, 0.15, 'triangle', 0.08); setTimeout(() => tone(800, 1600, 0.15, 'triangle', 0.06), 70); },
  dash() { noise(0.3, 0.12, 5000); tone(200, 900, 0.25, 'sine', 0.06); },
  bomb() { noise(1.2, 0.5, 3000); tone(80, 20, 1.2, 'sine', 0.3); },
  hurt() { noise(0.4, 0.4, 900); tone(200, 40, 0.4, 'sawtooth', 0.1); },
  wave() { [0, 80, 160].forEach((d, i) => setTimeout(() => tone(300 + i * 200, 400 + i * 300, 0.2, 'triangle', 0.06), d)); },
  missile() { tone(200, 700, 0.2, 'sawtooth', 0.03); },
  alarm() { tone(500, 500, 0.15, 'square', 0.05); setTimeout(() => tone(400, 400, 0.15, 'square', 0.05), 200); }
};

// ---------- Input ----------
const keys = {};
let ptr = { x: 0, y: 0, down: false, active: false };
let cur = null; // active game module
addEventListener('keydown', e => {
  initAudio();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (!keys[e.code]) {
    if (e.code === 'Escape' && typeof goMenu === 'function') goMenu();
    else if (cur && cur.onKey) cur.onKey(e.code);
  }
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('pointerdown', e => {
  initAudio(); ptr.x = e.clientX; ptr.y = e.clientY; ptr.down = true; ptr.active = true;
  if (cur && cur.onPointer) cur.onPointer(e);
});
addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; if (e.pointerType === 'mouse') ptr.active = true; });
addEventListener('pointerup', () => { ptr.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Glow sprites ----------
const glowCache = {};
function glowSprite(h) {
  h = Math.round(h / 10) * 10;
  if (glowCache[h]) return glowCache[h];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `hsla(${h},100%,85%,1)`);
  gr.addColorStop(0.25, `hsla(${h},100%,60%,0.6)`);
  gr.addColorStop(1, `hsla(${h},100%,50%,0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return glowCache[h] = c;
}
function glow(x, y, r, h, a = 1) {
  ctx.globalAlpha = a; ctx.drawImage(glowSprite(h), x - r, y - r, r * 2, r * 2);
}

function glowText(s, x, y, size, hue, a = 1, weight = 'bold') {
  ctx.font = `${weight} ${size}px Segoe UI, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = a * 0.5; ctx.fillStyle = `hsl(${hue},100%,60%)`;
  ctx.fillText(s, x - 3, y); ctx.fillStyle = 'hsl(330,100%,60%)'; ctx.fillText(s, x + 3, y);
  ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillText(s, x, y);
  ctx.globalAlpha = 1;
}
