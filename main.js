// ============ 메인 메뉴 & 루프 ============
const GAMES = [
  { key: 'Shooter', name: 'SKY STRIKE', sub: '종스크롤 슈팅', hue: 190, desc: ['적 편대·보스를 격추하는 탄막 슈팅', '회피 롤 · 폭탄 · 무기 강화'], ctl: 'WASD/방향키 · SHIFT 롤 · X 폭탄' },
  { key: 'Tunnel', name: 'TUNNEL RUN', sub: '3D 터널 레이싱', hue: 300, desc: ['굽이치는 네온 터널을 초고속 비행', '장애물 회피 · 링 연속 통과 · 부스트'], ctl: 'WASD/방향키 · SHIFT 롤 · SPACE 부스트' },
  { key: 'Dogfight', name: 'ACE DOGFIGHT', sub: '360° 공중전', hue: 20, desc: ['자유 비행하며 적기와 도그파이트', '락온 미사일 · 기관총 · 애프터버너'], ctl: 'A/D 선회 · W 가속 · S 감속 · SPACE 기총 · X 미사일 · SHIFT 롤' }
];
let menuMode = true, sel = 0, mt = 0, menuStars = [];
for (let i = 0; i < 120; i++) menuStars.push({ x: Math.random(), y: Math.random(), z: Math.random() * 0.9 + 0.1 });
let transT = 0;

function cardRect(i) {
  const n = 3, gap = 24, cw = Math.min(330, (W - 80 - gap * 2) / 3), narrow = W < 900;
  if (narrow) { const w = Math.min(W - 40, 420), h = 118; return { x: (W - w) / 2, y: H * 0.3 + i * (h + 14), w, h }; }
  const tw = cw * n + gap * 2, x0 = (W - tw) / 2;
  return { x: x0 + i * (cw + gap), y: H * 0.36, w: cw, h: Math.min(360, H * 0.46) };
}

function enter(i) {
  const g = window[GAMES[i].key];
  menuMode = false; cur = g; transT = 0.5; g.start();
}
function goMenu() {
  if (menuMode) return;
  menuMode = true; cur = menuHandler; mt = 0;
}

const menuHandler = {
  onKey(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') sel = (sel + 2) % 3;
    else if (code === 'ArrowRight' || code === 'KeyD') sel = (sel + 1) % 3;
    else if (code === 'Digit1') enter(0);
    else if (code === 'Digit2') enter(1);
    else if (code === 'Digit3') enter(2);
    else if (code === 'Enter' || code === 'Space') enter(sel);
    sfx.hit();
  },
  onPointer(e) {
    for (let i = 0; i < 3; i++) { const r = cardRect(i); if (e.clientX > r.x && e.clientX < r.x + r.w && e.clientY > r.y && e.clientY < r.y + r.h) { sel = i; enter(i); return; } }
  }
};
cur = menuHandler;
addEventListener('pointermove', e => {
  if (!menuMode) return;
  for (let i = 0; i < 3; i++) { const r = cardRect(i); if (e.clientX > r.x && e.clientX < r.x + r.w && e.clientY > r.y && e.clientY < r.y + r.h) sel = i; }
});

function drawMenu(dt) {
  mt += dt;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#02030c'); g.addColorStop(1, '#0c0b2a');
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const h0 = GAMES[sel].hue;
  glow(W / 2, H * 0.55, Math.max(W, H) * 0.6, h0, 0.18);
  for (const s of menuStars) {
    s.y += (0.04 + s.z * 0.3) * dt * 1.3; if (s.y > 1) { s.y = 0; s.x = Math.random(); }
    ctx.globalAlpha = 0.3 + s.z * 0.7; ctx.strokeStyle = '#bde'; ctx.lineWidth = s.z * 1.6;
    ctx.beginPath(); ctx.moveTo(s.x * W, s.y * H); ctx.lineTo(s.x * W, s.y * H - s.z * 14); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // title
  ctx.save(); ctx.translate(W / 2, H * 0.14); const sc = 1 + Math.sin(mt * 2) * 0.015; ctx.scale(sc, sc);
  ctx.letterSpacing = '14px'; glowText('SKY ARCADE', 0, 0, Math.min(W * 0.1, 90), h0); ctx.letterSpacing = '6px';
  glowText('3 FLIGHT GAMES', 0, Math.min(W * 0.065, 58), Math.min(W * 0.03, 22), 330, 0.9, '300'); ctx.restore(); ctx.letterSpacing = '0px';

  for (let i = 0; i < 3; i++) {
    const G = GAMES[i], r = cardRect(i), on = i === sel, lift = on ? -10 : 0, a = clamp(mt * 3 - i * 0.3, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(r.x, r.y + lift + (1 - a) * 40);
    ctx.fillStyle = on ? `hsla(${G.hue},60%,14%,.9)` : 'rgba(10,14,34,.8)'; ctx.fillRect(0, 0, r.w, r.h);
    ctx.strokeStyle = `hsl(${G.hue},100%,${on ? 65 : 38}%)`; ctx.lineWidth = on ? 3 : 1.5; ctx.strokeRect(0, 0, r.w, r.h);
    if (on) { ctx.globalCompositeOperation = 'lighter'; glow(r.w / 2, r.h / 2, r.w * 0.9, G.hue, 0.2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `hsl(${G.hue},100%,72%)`; ctx.font = 'bold 14px Segoe UI'; ctx.fillText(String(i + 1), 18, 18);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${r.w < 300 ? 22 : 28}px Segoe UI, sans-serif`; ctx.fillText(G.name, r.w / 2, r.h < 150 ? 24 : 46);
    ctx.fillStyle = `hsl(${G.hue},100%,70%)`; ctx.font = '16px Segoe UI'; ctx.fillText(G.sub, r.w / 2, r.h < 150 ? 46 : 78);
    if (r.h >= 150) {
      // little animated icon per game
      const cx = r.w / 2, cy = r.h * 0.5; ctx.save(); ctx.translate(cx, cy);
      drawIcon(i, G.hue, on);
      ctx.restore();
      ctx.fillStyle = '#bcd'; ctx.font = '14px Segoe UI'; G.desc.forEach((d, k) => ctx.fillText(d, r.w / 2, r.h - 78 + k * 20));
      ctx.fillStyle = '#789'; ctx.font = '11px Segoe UI'; ctx.fillText(G.ctl, r.w / 2, r.h - 22);
    } else { ctx.fillStyle = '#bcd'; ctx.font = '13px Segoe UI'; G.desc.forEach((d, k) => ctx.fillText(d, r.w / 2, 70 + k * 18)); }
    // hi-score
    const hs = window[G.key].hi(); ctx.fillStyle = '#fd6'; ctx.font = 'bold 12px Segoe UI'; ctx.textAlign = 'right'; ctx.fillText(hs ? 'HI ' + hs.toLocaleString() : '', r.w - 12, 18);
    ctx.restore();
  }
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(mt * 4); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('← →  선택  ·  ENTER / 클릭 시작  ·  1 2 3  바로 시작  ·  게임 중 ESC = 메뉴', W / 2, H - 28); ctx.globalAlpha = 1;
}

function drawIcon(i, hue, on) {
  const t = mt, s = on ? 1.15 : 1;
  ctx.scale(s, s); ctx.strokeStyle = `hsl(${hue},100%,65%)`; ctx.lineWidth = 2;
  if (i === 0) { // shooter: ship + bullets
    ctx.translate(0, Math.sin(t * 2) * 4);
    ctx.fillStyle = '#5ec8ff'; ctx.beginPath(); [[0, -26], [7, -8], [26, 12], [9, 10], [6, 20], [0, 16], [-6, 20], [-9, 10], [-26, 12], [-7, -8]].forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { const y = -40 - ((t * 120 + k * 30) % 90); glow(0, y, 12, 190, 0.9); } ctx.globalCompositeOperation = 'source-over';
  } else if (i === 1) { // tunnel: concentric polygons
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) { const p = ((k + t * 1.5) % 7) / 7, r = 6 + p * p * 70; ctx.globalAlpha = 0.2 + p * 0.7; ctx.beginPath(); for (let j = 0; j <= 8; j++) { const a = j / 8 * TAU + p; j ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  } else { // dogfight: orbiting planes
    for (let k = 0; k < 2; k++) {
      const a = t * (k ? -1.4 : 1.6) + k * 2, rad = 42 + k * 14, x = Math.cos(a) * rad, y = Math.sin(a) * rad * 0.6;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + (k ? -Math.PI / 2 : Math.PI / 2)); ctx.fillStyle = k ? '#e33' : '#5ec8ff'; ctx.beginPath();
      [[0, -14], [3, -4], [15, 4], [3, 3], [0, 11], [-3, 3], [-15, 4], [-3, -4]].forEach((p, q) => q ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
}

// ---------- 루프 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (menuMode) drawMenu(dt);
  else {
    cur.update(dt); cur.draw();
    if (transT > 0) { transT -= dt; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = clamp(transT / 0.5, 0, 1); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
