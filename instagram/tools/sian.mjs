// 눈에 띄는 "큰 글씨 스티커" 스타일 표지 시안을 만든다. (대기열에는 넣지 않음)
// 사용: node sian.mjs   → instagram/시안/*.jpg
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', '시안');
fs.mkdirSync(out, { recursive: true });
const font = (f) => pathToFileURL(path.join(here, 'fonts', f)).href;
const asset = (f) => pathToFileURL(path.resolve(here, '..', f)).href;

// line: [글자, 채움색(또는 그라데이션), 테두리색, 크기px, 글꼴]
const covers = [
  {
    id: '1-ai-black',
    bg: '#111',
    deco: `<div class="emo" style="right:70px;top:250px;font-size:150px;transform:rotate(12deg)">🤖</div>`,
    kicker: ['복붙만 하면 끝★', '#fff', '#111'],
    lines: [
      ['AI한테', '#fff', '#111', 190],
      ['이렇게', 'linear-gradient(#ffe45c,#ffb800)', '#111', 220],
      ['물어봐', 'linear-gradient(#7cf0ff,#3aa0ff)', '#111', 220],
    ],
    outer: '#fff',
  },
  {
    id: '2-desk-pastel',
    bg: 'radial-gradient(circle at 30% 20%,#fff6d6 0,#ffd9e6 55%,#ffc2d6 100%)',
    deco: `
      <div class="emo" style="left:60px;top:170px;font-size:170px;transform:rotate(-12deg)">🐢</div>
      <div class="emo" style="right:70px;top:210px;font-size:120px;transform:rotate(10deg)">💻</div>
      <div class="emo" style="left:90px;bottom:170px;font-size:110px">🪑</div>
      <div class="emo" style="right:90px;bottom:180px;font-size:110px;transform:rotate(8deg)">🚶</div>`,
    kicker: ['하루 종일 앉아 있다면', '#fff', '#ff5c8a'],
    lines: [
      ['거북목', 'linear-gradient(#ff8fb1,#ff3d7f)', '#fff', 250],
      ['탈출 습관', 'linear-gradient(#a98bff,#6b4dff)', '#fff', 200],
    ],
    outer: '#5a2340',
  },
  {
    id: '3-changimi-app',
    bg: '#cfe8ff',
    deco: `<img class="phone" src="${asset('assets/changimi/home.png')}">
      <div class="emo" style="left:70px;top:190px;font-size:130px;transform:rotate(-10deg)">🧳</div>
      <div class="emo" style="right:80px;top:200px;font-size:120px;transform:rotate(12deg)">✅</div>`,
    kicker: ['직접 만든 무료 앱★', '#fff', '#2b6cff'],
    lines: [
      ['짐 쌀 때', '#fff', '#1d3f8f', 170],
      ['맨날 빠뜨림', 'linear-gradient(#ffe45c,#ffa800)', '#1d3f8f', 170],
    ],
    textTop: 880,
  },
  {
    id: '4-money-yellow',
    bg: 'repeating-linear-gradient(45deg,#ffe14d 0 60px,#ffd426 60px 120px)',
    deco: `
      <div class="emo" style="left:70px;top:200px;font-size:150px;transform:rotate(-14deg)">💸</div>
      <div class="emo" style="right:70px;bottom:190px;font-size:150px;transform:rotate(10deg)">🐷</div>`,
    kicker: ['모르면 나만 손해', '#fff', '#111'],
    lines: [
      ['이번 달', '#fff', '#111', 180],
      ['꼭 챙길 돈', 'linear-gradient(#5cff9d,#00c36b)', '#111', 210],
    ],
  },
];

// 둥근 스티커 테두리: text-shadow를 원 모양으로 여러 겹 깔아 만든다.
function ring(r, color, drop = '') {
  const sh = [];
  for (let rr = 2; rr <= r; rr += 3) {
    const n = Math.max(12, Math.round(rr * 1.6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      sh.push(`${(Math.cos(a) * rr).toFixed(1)}px ${(Math.sin(a) * rr).toFixed(1)}px 0 ${color}`);
    }
  }
  if (drop) sh.push(drop);
  return sh.join(',');
}

function stack(text, fill, stroke, size, fontName, outer) {
  const t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const grad = fill.startsWith('linear') || fill.startsWith('radial');
  const fillCss = grad ? `background:${fill};-webkit-background-clip:text;background-clip:text;color:transparent` : `color:${fill}`;
  const s = Math.max(6, Math.round(size * 0.07));
  return `<div class="ln" style="font-size:${size}px;font-family:'${fontName}'">
    <span class="l o" style="color:${outer || stroke};text-shadow:${ring(s * 2 + 4, outer || stroke)}">${t}</span>
    <span class="l" style="color:${stroke};text-shadow:${ring(s, stroke)}">${t}</span>
    <span class="l f" style="${fillCss}">${t}</span>
  </div>`;
}

function html(c) {
  const k = c.kicker;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:BHS;src:url(${font('BlackHanSans.woff2')})}
  @font-face{font-family:Jua;src:url(${font('Jua.woff2')})}
  @font-face{font-family:Gaegu;src:url(${font('Gaegu.woff2')})}
  *{margin:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden}
  body{background:${c.bg};position:relative;font-family:Jua,sans-serif}
  .logo{position:absolute;left:40px;top:40px;background:#111;color:#fff;font:26px/1 Jua;padding:12px 16px;border-radius:14px;border:3px solid #fff;letter-spacing:.5px}
  .emo{position:absolute;font-family:'Noto Color Emoji';filter:drop-shadow(0 8px 0 rgba(0,0,0,.18))}
  .phone{position:absolute;left:50%;top:150px;width:430px;transform:translateX(-50%) rotate(-4deg);border-radius:46px;border:10px solid #fff;box-shadow:0 30px 60px rgba(0,0,0,.25)}
  .txt{position:absolute;left:0;right:0;top:${c.textTop ? c.textTop + 'px' : '50%'};${c.textTop ? '' : 'transform:translateY(-50%);'}text-align:center}
  .ln{position:relative;line-height:1.08;white-space:nowrap}
  .ln + .ln{margin-top:-6px}
  .l{display:block;letter-spacing:-2px}
  .l.o{filter:drop-shadow(0 14px 0 rgba(0,0,0,.22))}
  .l + .l{position:absolute;inset:0}
  .kick{margin-bottom:6px}
  </style></head><body>
  ${c.deco || ''}
  <div class="logo">Yozmbom</div>
  <div class="txt">
    <div class="kick">${stack(k[0], k[1], k[2], 78, 'Gaegu')}</div>
    ${c.lines.map(([t, f, s, z]) => stack(t, f, s, z, 'BHS', c.outer)).join('')}
  </div>
  </body></html>`;
}

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(path.join(globalRoot, 'x.js'))('playwright');
}
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (const c of covers) {
  const tmp = path.join(out, '.tmp.html');
  fs.writeFileSync(tmp, html(c));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(out, `${c.id}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
  console.log('✓', file);
}
await browser.close();
fs.rmSync(path.join(out, '.tmp.html'), { force: true });
