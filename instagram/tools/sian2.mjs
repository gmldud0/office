// 참고 디자인(공감 시리즈 / 모눈 노트 / 만화 집중선 표지)을 섞은 "확인용" 예시 게시물. 대기열에 넣지 않음.
// 사용: node sian2.mjs → instagram/시안/예시-게시물/*.jpg
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', '시안', '예시-게시물');
fs.mkdirSync(out, { recursive: true });
const font = (f) => pathToFileURL(path.join(here, 'fonts', f)).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function ring(r, color) {
  const sh = [];
  for (let rr = 2; rr <= r; rr += 3) {
    const n = Math.max(12, Math.round(rr * 1.6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      sh.push(`${(Math.cos(a) * rr).toFixed(1)}px ${(Math.sin(a) * rr).toFixed(1)}px 0 ${color}`);
    }
  }
  return sh.join(',');
}
// 테두리 글씨 한 줄: fill(글자) / stroke(안쪽) / outer(바깥) / 아래로 살짝 밀린 그림자색
function sticker(text, size, { fill = '#fff', stroke = '#3b2a20', outer = '#fff', font: f = 'Jua', drop = '#7ec8e3' } = {}) {
  const s = Math.max(5, Math.round(size * 0.06));
  const t = esc(text);
  return `<div class="ln" style="font-size:${size}px;font-family:${f}">
    <span class="l" style="color:${drop};text-shadow:${ring(s * 2 + 6, drop)};transform:translateY(${Math.round(size * 0.07)}px)">${t}</span>
    <span class="l" style="color:${outer};text-shadow:${ring(s * 2 + 6, outer)}">${t}</span>
    <span class="l" style="color:${stroke};text-shadow:${ring(s, stroke)}">${t}</span>
    <span class="l" style="color:${fill}">${t}</span></div>`;
}

const base = `
  @font-face{font-family:BHS;src:url(${font('BlackHanSans.woff2')})}
  @font-face{font-family:Jua;src:url(${font('Jua.woff2')})}
  @font-face{font-family:Gaegu;src:url(${font('Gaegu.woff2')})}
  *{margin:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden}
  body{position:relative;font-family:Jua,sans-serif}
  .ln{position:relative;line-height:1.1;white-space:nowrap}
  .l{display:block;letter-spacing:-1px}
  .l + .l{position:absolute;inset:0}
  .logo{position:absolute;left:44px;top:44px;z-index:5}
  .emo{position:absolute;font-family:'Noto Color Emoji';line-height:1}
  .grid{background-color:#fff;background-image:linear-gradient(#e6e6e6 2px,transparent 2px),linear-gradient(90deg,#e6e6e6 2px,transparent 2px);background-size:44px 44px}
`;
const logo = `<div class="logo">${sticker('Yozmbom', 40, { font: 'BHS', fill: '#5b8def', stroke: '#fff', outer: '#1d2b53', drop: 'transparent' })}</div>`;

// 집중선(만화) 배경
const speed = (c1, c2) => `repeating-conic-gradient(from 0deg at 50% 45%, ${c1} 0deg 4deg, ${c2} 4deg 9deg)`;

const slides = [
  // 1. 표지: 집중선 + 큰 그림 + 테두리 글씨
  `<style>body{background:${speed('#fff7d6', '#ffe9a8')}}</style>
   <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,#fff 0,rgba(255,255,255,0) 45%)"></div>
   ${logo}
   <div class="emo" style="font-size:380px;left:50%;top:150px;transform:translateX(-50%)">🏠</div>
   <div class="emo" style="font-size:170px;right:110px;top:140px;transform:rotate(10deg)">💭</div>
   <div style="position:absolute;left:0;right:0;bottom:120px;text-align:center">
     ${sticker('자취생들이', 150)}
     ${sticker('스스로 하는', 150)}
     ${sticker('흔한 착각', 170, { fill: '#7ec8e3', drop: '#3b2a20' })}
   </div>`,
];

// 2~4. 공감 카드: 위는 "장면"(배경 + 여러 그림을 겹쳐 상황이 보이게), 아래는 이름표 + 흰 말풍선 + 검은 띠 설명
const E = (e, x, y, size, rot = 0, extra = '') =>
  `<div class="emo" style="left:${x}px;top:${y}px;font-size:${size}px;transform:rotate(${rot}deg);${extra}">${e}</div>`;
const scenes = {
  // 주방: 타일 벽 + 나무 조리대, 요리사 + 프라이팬(불) + 라면 + 계란 + 땀
  cook: `<div style="position:absolute;inset:0 0 auto 0;height:900px;background-color:#e8f6f3;background-image:linear-gradient(#c9e6e0 4px,transparent 4px),linear-gradient(90deg,#c9e6e0 4px,transparent 4px);background-size:120px 90px"></div>
    <div style="position:absolute;left:0;right:0;top:640px;height:260px;background:linear-gradient(#c98b55,#a86a3a);border-top:14px solid #e0a873"></div>
    ${E('🧑‍🍳', 90, 170, 400, -4)}
    ${E('🔥', 610, 520, 150)}${E('🍳', 560, 400, 230, 8)}
    ${E('🍜', 800, 540, 170)}${E('🥚', 470, 560, 110, -20)}${E('🥚', 900, 400, 90, 15)}
    ${E('💦', 410, 160, 110, 10)}${E('✨', 820, 200, 120)}
    <div style="position:absolute;left:640px;top:250px;background:#fff;border:6px solid #3b2a20;border-radius:30px;padding:10px 26px;font:56px Jua;color:#3b2a20;transform:rotate(6deg)">셰프 데뷔?!</div>`,
  // 빨래: 빨랫줄에 걸린 옷 + 쌓인 빨래 바구니 + 거품 + 지친 얼굴
  laundry: `<div style="position:absolute;inset:0 0 auto 0;height:900px;background:radial-gradient(circle at 50% 30%,#eaf5ff 0,#bfe0ff 80%)"></div>
    <svg style="position:absolute;left:0;top:120px" width="1080" height="200"><path d="M-20 40 Q 540 170 1100 40" stroke="#6b7a8f" stroke-width="8" fill="none"/></svg>
    ${E('👕', 90, 150, 170, -8)}${E('🧦', 330, 205, 130, 6)}${E('👖', 520, 210, 170, 0)}${E('🧦', 740, 190, 120, -10)}${E('👚', 880, 140, 150, 8)}
    ${E('🧺', 120, 470, 330)}${E('👕', 170, 410, 140, -25)}${E('🧦', 330, 420, 110, 20)}
    ${E('😵‍💫', 620, 450, 300)}
    ${E('🫧', 520, 380, 90)}${E('🫧', 940, 420, 110)}${E('🫧', 880, 640, 80)}
    <div style="position:absolute;left:560px;top:360px;background:#fff;border:6px solid #3b2a20;border-radius:30px;padding:10px 26px;font:56px Jua;color:#3b2a20;transform:rotate(-5deg)">빨래 산 실화?</div>`,
  // 배달: 밤 방 + 창문 달 + 휴대폰 + 배달 오토바이 + 치킨·피자
  delivery: `<div style="position:absolute;inset:0 0 auto 0;height:900px;background:linear-gradient(#2a2350,#4b3b8f)"></div>
    <div style="position:absolute;left:640px;top:120px;width:340px;height:300px;background:#1b1640;border:14px solid #c9b8ff;border-radius:16px"></div>
    ${E('🌙', 720, 150, 160)}${E('⭐', 900, 330, 50)}
    ${E('🛵', 560, 420, 300, -6)}${E('💨', 880, 520, 120)}
    ${E('📱', 90, 200, 300, -12)}${E('😋', 300, 470, 260)}
    ${E('🍗', 90, 560, 170, 10)}${E('🍕', 520, 160, 120, 20)}${E('🧾', 380, 150, 120, -8)}
    <div style="position:absolute;left:120px;top:100px;background:#ffeb3b;border:6px solid #3b2a20;border-radius:30px;padding:10px 26px;font:56px Jua;color:#3b2a20;transform:rotate(-6deg)">주문 완료!</div>`,
};
// 실제 사진(무료 라이선스, assets/photos). CC BY는 카드 안에 작게 출처 표시.
const credits = JSON.parse(fs.readFileSync(path.resolve(here, '..', 'assets/photos/credits.json'), 'utf8'));
const photo = (name) => pathToFileURL(path.resolve(here, '..', 'assets/photos', `${name}.jpg`)).href;
const relate = [
  ['ramen-egg', '요리', '나는 요리를 잘한다고 생각함', ['라면에 계란 넣으면 요리라고 믿음', '설거지는 내일의 내가 함']],
  ['clothes-bed', '빨래', '나는 빨래를 자주 한다고 생각함', ['건조대에서 바로 꺼내 입는 게 국룰', '침대 위 옷 산은 "정리 중"']],
  ['fried-chicken-takeout', '배달', '나는 배달을 줄였다고 생각함', ['최소 주문 금액 맞추다 2인분 시킴', '"이번 주만"이 4주째']],
];
for (const [ph, name, pill, lines] of relate) {
  const c = credits[ph];
  const credit = c.license === 'pdm' || c.license === 'cc0' ? '' : `사진: ${c.creator} / CC ${c.license.toUpperCase()} ${c.license_version}`;
  slides.push(`<style>body{background:#111}</style>
    <div style="position:absolute;inset:0;background:url('${photo(ph)}') center 30%/cover"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:720px;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.78) 38%,rgba(0,0,0,.92))"></div>
    ${logo}
    <div style="position:absolute;left:0;right:0;bottom:70px;text-align:center">
      <div style="display:inline-block;transform:rotate(-3deg)">${sticker(name, 150, { font: 'BHS', fill: '#3b2a20', stroke: '#fff', outer: '#fff', drop: '#7ec8e3' })}</div>
      <div style="margin:24px 70px 28px;background:#fff;border-radius:999px;padding:20px 30px;font:60px Jua;color:#3b2a20">${esc(pill)}</div>
      ${lines.map((l) => `<div style="font:56px/1.45 Jua;color:#fff">${esc(l)}</div>`).join('')}
    </div>
    ${credit ? `<div style="position:absolute;right:30px;bottom:18px;font:22px Jua;color:rgba(255,255,255,.6)">${esc(credit)}</div>` : ''}`);
}

// 5. 모눈 노트 카드: 점선 노란 상자 + 숫자에 빨간 동그라미
slides.push(`<style>body{background:#1b1b1b}</style>
  <div class="grid" style="position:absolute;inset:60px 50px;border-radius:60px;padding:80px 60px">
    <div style="text-align:center;margin-bottom:40px">${sticker('착각 탈출 꿀팁', 110, { font: 'BHS', fill: '#1b1b1b', stroke: '#fff', outer: '#fff', drop: '#bdbdbd' })}</div>
    <div style="text-align:center;font:60px/1.5 Jua;color:#1b1b1b;margin-bottom:46px">
      배달비만 아껴도 한 달에
      <span style="position:relative;display:inline-block;padding:0 14px">약 6만 원<svg style="position:absolute;left:-14px;top:-10px;width:calc(100% + 28px);height:calc(100% + 20px)" viewBox="0 0 200 80" preserveAspectRatio="none"><path d="M10 45 C 10 10, 190 5, 192 40 S 40 82, 18 52" fill="none" stroke="#e53935" stroke-width="7" stroke-linecap="round"/></svg></span>
    </div>
    ${['1. 장보기 전 냉장고 사진 찍기', '2. 빨래는 요일 정해서 한 번에', '3. 배달은 주 1회로 약속'].map((t) =>
      `<div style="background:#fff6b3;border:5px dotted #1b1b1b;border-radius:10px;padding:26px 20px;margin:0 10px 26px;text-align:center;font:56px Jua;color:#1b1b1b">${t}</div>`).join('')}
    <div style="text-align:center;margin-top:20px">${sticker('다음 장에 계속 ▶', 64, { font: 'Jua', fill: '#1b1b1b', stroke: '#fff', outer: '#fff', drop: '#bdbdbd' })}</div>
    <div style="position:absolute;right:40px;bottom:30px;font:22px Jua;color:#999">※ 예시용 숫자(배달비 3천 원 × 주 5회 × 4주)</div>
  </div>`);

// 6. 마지막: 댓글 키워드 유도
slides.push(`<style>body{background:#1b1b1b}</style>
  <div class="grid" style="position:absolute;inset:60px 50px;border-radius:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
    ${sticker('팔로우하고', 110, { font: 'Jua', fill: '#1b1b1b', stroke: '#fff', outer: '#fff', drop: '#bdbdbd' })}
    <div style="display:flex;gap:16px;align-items:center">${sticker('댓글에', 110, { font: 'Jua', fill: '#1b1b1b', stroke: '#fff', outer: '#fff', drop: '#bdbdbd' })}${sticker('[자취]', 110, { font: 'Jua', fill: '#e53935', stroke: '#fff', outer: '#fff', drop: '#bdbdbd' })}</div>
    ${sticker('남기면', 110, { font: 'Jua', fill: '#1b1b1b', stroke: '#fff', outer: '#fff', drop: '#bdbdbd' })}
    ${sticker('자취 체크리스트 드려요!', 96, { font: 'Jua', fill: '#1b1b1b', stroke: '#fff', outer: '#fff', drop: '#bdbdbd' })}
    <div class="emo" style="font-size:150px;position:static;margin-top:30px">📋</div>
  </div>`);

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  return createRequire(path.join(execSync('npm root -g').toString().trim(), 'x.js'))('playwright');
}
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
const tmp = path.join(out, '.tmp.html');
for (const [i, body] of slides.entries()) {
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${base}</style></head><body>${body}</body></html>`);
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 90 });
}
fs.rmSync(tmp);
await browser.close();
console.log(`✓ ${slides.length}장 → ${out}`);
