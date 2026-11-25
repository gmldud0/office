// 게시물 묶음(JSON)을 읽어 카드 이미지(JPEG 1080×1350)와 post.json을 게시 대기열에 만든다.
// 사용법: node render.mjs ../content/2026-W48.json
// 인스타그램 API는 JPEG만 받기 때문에 JPEG로 저장한다.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const queueDir = process.env.QUEUE_DIR ? path.resolve(process.env.QUEUE_DIR) : path.resolve(here, '..', 'queue');

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(path.join(globalRoot, 'x.js'))('playwright');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **강조** → 강조색
const rich = (s) => esc(s).replace(/\*\*([\s\S]+?)\*\*/g, '<b class="hl">$1</b>').replace(/\n/g, '<br>');

const fontCss = (w) => pathToFileURL(path.join(here, 'node_modules/@fontsource/noto-sans-kr', `${w}.css`)).href;

// 3일마다 바뀌는 디자인. 게시물 id 앞의 날짜(YYYY-MM-DD)로 고른다.
// 2026-11-24~26 → 0번, 27~29 → 1번, 11-30~12-02 → 2번, 12-03~05 → 3번, 그다음 다시 0번.
const THEME_START = Date.UTC(2026, 10, 24);
const THEME_DAYS = 3;
export const THEMES = [
  { name: '남색 · 주황', coverBg: '#1F2A44', coverFg: '#FFF6EC', coverHl: '#FF7A59', kickerFg: '#FFFFFF', bodyBg: '#FFF6EC', bodyFg: '#1F2A44',
    accent: '#FF7A59', accentFg: '#FFFFFF', hl: '#FF7A59', ctaBg: '#1F2A44', ctaFg: '#FFF6EC', bullet: '8px', line: 'rgba(31,42,68,.1)' },
  { name: '노랑 · 파랑', coverBg: '#FFD84D', coverFg: '#1B1B1B', coverHl: '#2F5BEA', kickerFg: '#FFFFFF', bodyBg: '#FFFFFF', bodyFg: '#1B1B1B',
    accent: '#2F5BEA', accentFg: '#FFFFFF', hl: '#2F5BEA', ctaBg: '#FFD84D', ctaFg: '#1B1B1B', bullet: '50%', line: 'rgba(0,0,0,.08)' },
  { name: '보라 · 분홍', coverBg: '#5B4BDB', coverFg: '#FFFFFF', coverHl: '#FFC2DD', kickerFg: '#26205A', bodyBg: '#F4F1FF', bodyFg: '#26205A',
    accent: '#5B4BDB', accentFg: '#FFFFFF', hl: '#D6336C', ctaBg: '#5B4BDB', ctaFg: '#FFFFFF', bullet: '50%', line: 'rgba(91,75,219,.15)' },
  { name: '검정 · 라임', coverBg: '#141414', coverFg: '#FFFFFF', coverHl: '#C6F432', kickerFg: '#141414', bodyBg: '#F5F5EF', bodyFg: '#141414',
    accent: '#141414', accentFg: '#C6F432', hl: '#4D7C0F', ctaBg: '#141414', ctaFg: '#C6F432', bullet: '0', line: 'rgba(0,0,0,.1)' },
];
// 표지(스티커 스타일)용 색. THEMES와 같은 순서.
const STICKERS = [
  { bg: 'radial-gradient(circle at 50% 35%,#2f3f66 0,#1F2A44 70%)', fill: '#FFFFFF', hl: 'linear-gradient(#FFE08A,#FF9A3D)', stroke: '#0E1426', outer: '#FF7A59', kick: '#FF7A59', popBg: '#FF7A59', popHl: 'linear-gradient(#FFF27A,#FFD400)' },
  { bg: 'repeating-linear-gradient(45deg,#FFDF5E 0 60px,#FFD84D 60px 120px)', fill: '#FFFFFF', hl: 'linear-gradient(#8DB5FF,#2F5BEA)', stroke: '#1B1B1B', outer: '#1B1B1B', kick: '#2F5BEA', popBg: '#2F5BEA', popHl: 'linear-gradient(#FFF27A,#FFD400)' },
  { bg: 'radial-gradient(circle at 50% 30%,#7a6cf0 0,#5B4BDB 70%)', fill: '#FFFFFF', hl: 'linear-gradient(#FFE0EE,#FF7AB6)', stroke: '#26205A', outer: '#FFFFFF', kick: '#FF7AB6', popBg: '#FF7AB6', popHl: 'linear-gradient(#FFF27A,#FFD400)' },
  { bg: '#141414', fill: '#FFFFFF', hl: 'linear-gradient(#EFFF8A,#A5E000)', stroke: '#141414', outer: '#FFFFFF', kick: '#4D7C0F', popBg: '#C6F432', popHl: 'linear-gradient(#8B7BFF,#5B4BDB)' },
];

// 둥근 스티커 테두리: text-shadow를 원 모양으로 여러 겹 깔아 만든다.
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
const grad = (f) => /gradient/.test(f) ? `background:${f};-webkit-background-clip:text;background-clip:text;color:transparent` : `color:${f}`;
// 한 줄을 3겹(바깥 테두리 / 안쪽 테두리 / 글자)으로. **강조**는 hl 색.
function stickerLine(line, size, font, c, plainFill = c.fill) {
  const s = Math.max(6, Math.round(size * 0.07));
  const parts = [];
  esc(line).replace(/\*\*([\s\S]+?)\*\*|([^*]+|\*)/g, (_, b, p) => { parts.push(b != null ? [b, true] : [p, false]); return ''; });
  const fillSpans = parts.map(([x, b]) => `<span style="${grad(b ? c.hl : plainFill)}">${x}</span>`).join('');
  const raw = parts.map(([x]) => x).join('');
  return `<div class="ln" style="font-size:${size}px;font-family:${font}">
    <span class="l o" style="color:${c.outer};text-shadow:${ring(s * 2 + 4, c.outer)}">${raw}</span>
    <span class="l" style="color:${c.stroke};text-shadow:${ring(s, c.stroke)}">${raw}</span>
    <span class="l">${fillSpans}</span></div>`;
}
const EMOJI_SPOTS = [
  'left:50px;top:120px;transform:rotate(-12deg)', 'right:60px;top:130px;transform:rotate(10deg)',
  'left:80px;bottom:200px;transform:rotate(8deg)', 'right:80px;bottom:190px;transform:rotate(-8deg)',
];
function stickerCover(slide, n, c0) {
  const st = slide.style ?? 'big';
  if (st === 'big') {
    // big: 위쪽 절반에 큰 그림(이모지 여러 개), 아래쪽에 굵은 테두리 글씨. 참고: 정보 계정들의 "사진+큰 글씨" 표지
    const c = { ...c0, fill: '#FFFFFF', hl: c0.popHl, stroke: '#141414', outer: '#FFFFFF' };
    const lines = String(slide.title).split('\n');
    const w = (l) => [...l.replace(/\*\*/g, '')].reduce((a, ch) => a + (ch === ' ' ? 0.4 : /[A-Za-z0-9]/.test(ch) ? 0.62 : 1), 0);
    const size = Math.min(230, Math.floor(960 / Math.max(Math.max(...lines.map(w)), 3)));
    const em = slide.emoji ?? [];
    const art = slide.src
      ? `<img class="bigimg" src="${pathToFileURL(path.resolve(here, '..', slide.src)).href}">`
      : `<div class="art">${em[0] ? `<span class="e0">${esc(em[0])}</span>` : ''}${em.slice(1, 4).map((e, i) => `<span class="e e${i + 1}">${esc(e)}</span>`).join('')}</div>`;
    const kick = slide.kicker ? stickerLine(slide.kicker, 64, 'BHS', { ...c, fill: '#141414', hl: '#141414', stroke: '#FFFFFF', outer: '#FFFFFF' }, '#141414') : '';
    return `<style>body{background:${c0.popBg} !important}</style>${art}
      <div class="btxt">${kick}${lines.map((l) => stickerLine(l, size, 'BHS', c)).join('')}</div>`;
  }
  // clean: 테두리 한 겹, 이모지 하나 크게, 작은 말머리 / pop: 강조색 배경 / sticker: 처음 시안(두 겹 테두리, 이모지 4개)
  const c = st === 'sticker' ? c0 : st === 'pop'
    ? { ...c0, bg: c0.popBg, fill: '#FFFFFF', hl: c0.popHl, stroke: '#141414', outer: '#141414' }
    : { ...c0, outer: c0.stroke };
  if (st !== 'sticker') {
    const lines = String(slide.title).split('\n');
    const w = (l) => [...l.replace(/\*\*/g, '')].reduce((a, ch) => a + (ch === ' ' ? 0.4 : /[A-Za-z0-9]/.test(ch) ? 0.62 : 1), 0);
    const size = Math.min(250, Math.floor(940 / Math.max(Math.max(...lines.map(w)), 3)));
    const emo = slide.emoji?.[0] ? `<div class="emo1">${esc(slide.emoji[0])}</div>` : '';
    const kick = slide.kicker ? `<div class="pill" style="background:${c.stroke};color:#fff">${esc(slide.kicker)}</div>` : '';
    const sub = slide.sub ? `<div class="csub" style="color:${st === 'pop' ? '#141414' : c.fill}">${esc(slide.sub).replace(/\n/g, ' ')}</div>` : '';
    return `<style>body{background:${c.bg} !important}</style>
      <div class="stxt">${emo}${kick}${lines.map((l) => stickerLine(l, size, 'BHS', c)).join('')}${sub}</div>`;
  }
  const lines = String(slide.title).split('\n');
  // 글자 수로 크기 맞추기 (빈칸은 0.4자, 이모지는 1자)
  const w = (l) => [...l.replace(/\*\*/g, '')].reduce((a, ch) => a + (ch === ' ' ? 0.4 : /[A-Za-z0-9]/.test(ch) ? 0.62 : 1), 0);
  const longest = Math.max(...lines.map(w));
  const size = Math.min(260, Math.floor(960 / Math.max(longest, 3)));
  const emo = (slide.emoji ?? []).slice(0, 4).map((e, i) =>
    `<div class="emo" style="${EMOJI_SPOTS[i]};font-size:${i < 2 ? 170 : 140}px">${esc(e)}</div>`).join('');
  const img = slide.src ? `<img class="phone" src="${pathToFileURL(path.resolve(here, '..', slide.src)).href}">` : '';
  const kick = slide.kicker ? stickerLine(slide.kicker, 80, 'Gaegu', { ...c, fill: '#fff', hl: '#fff', stroke: c.kick, outer: c.kick }, '#fff') : '';
  const sub = slide.sub ? `<div class="ssub" style="background:${c.stroke};color:#fff">${esc(slide.sub).replace(/\n/g, ' ')}</div>` : '';
  return `${emo}${img}
    <div class="stxt${slide.src ? ' low' : ''}">${kick}${lines.map((l) => stickerLine(l, size, 'BHS', c)).join('')}${sub}</div>`;
}

function themeFor(id) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(id);
  if (!m) return { ...THEMES[0], sticker: STICKERS[0] };
  const days = Math.floor((Date.UTC(+m[1], +m[2] - 1, +m[3]) - THEME_START) / 86400000);
  const n = Math.floor(days / THEME_DAYS);
  const k = ((n % THEMES.length) + THEMES.length) % THEMES.length;
  return { ...THEMES[k], sticker: STICKERS[k] };
}

function slideHtml(slide, i, total, brand, t, c) {
  const sticker = slide.type === 'cover' && slide.style !== 'plain';
  const cover = slide.type === 'cover';
  let inner = '';
  if (sticker) {
    inner = stickerCover(slide, i, c);
  } else if (slide.type === 'cover') {
    inner = `
      <div class="kicker">${esc(slide.kicker ?? '')}</div>
      <h1 class="cover">${rich(slide.title)}</h1>
      ${slide.sub ? `<p class="sub">${rich(slide.sub)}</p>` : ''}
      <div class="swipe">옆으로 넘겨 보기 →</div>`;
  } else if (slide.type === 'image') {
    // 앱 화면 같은 이미지를 크게 보여 주는 카드. src는 instagram/ 폴더 기준 경로.
    const src = pathToFileURL(path.resolve(here, '..', slide.src)).href;
    inner = `
      ${slide.num ? `<div class="num">${esc(slide.num)}</div>` : ''}
      <h2 class="img-title">${rich(slide.title)}</h2>
      ${slide.sub ? `<p class="img-sub">${rich(slide.sub)}</p>` : ''}
      <div class="shot"><img src="${src}"></div>`;
  } else if (slide.type === 'end') {
    inner = `
      <h2 class="end">${rich(slide.title ?? '도움이 됐다면\n저장해 두세요')}</h2>
      <p class="sub">${rich(slide.sub ?? '필요할 때 바로 꺼내 볼 수 있어요.')}</p>
      ${slide.ask ? `<div class="ask">💬 ${rich(slide.ask)}</div>` : ''}
      <div class="acts"><span>📤 단톡방에 공유</span><span>📌 저장</span></div>
      <div class="cta">${esc(brand.cta)}</div>`;
  } else {
    const items = (slide.items ?? []).map((t) => `<li>${rich(t)}</li>`).join('');
    inner = `
      ${slide.num ? `<div class="num">${esc(slide.num)}</div>` : ''}
      <h2>${rich(slide.title)}</h2>
      ${slide.body ? `<p class="body">${rich(slide.body)}</p>` : ''}
      ${items ? `<ul>${items}</ul>` : ''}
      ${slide.note ? `<p class="note">${rich(slide.note)}</p>` : ''}`;
  }
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${fontCss(400)}"><link rel="stylesheet" href="${fontCss(700)}"><link rel="stylesheet" href="${fontCss(900)}">
<style>
  @font-face { font-family: BHS; src: url(${pathToFileURL(path.join(here, 'fonts/BlackHanSans.woff2')).href}); }
  @font-face { font-family: Gaegu; src: url(${pathToFileURL(path.join(here, 'fonts/Gaegu.woff2')).href}); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1350px; }
  body { font-family: 'Noto Sans KR', sans-serif; background: ${sticker ? c.bg : cover ? t.coverBg : t.bodyBg};
         color: ${cover ? t.coverFg : t.bodyFg}; position: relative; overflow: hidden; }
  .wrap { position: absolute; inset: 110px 96px 150px; display: flex; flex-direction: column; justify-content: center; }
  .top { position: absolute; top: 56px; left: 96px; right: 96px; display: flex; justify-content: space-between;
         font-size: 30px; font-weight: 700; opacity: .75; }
  .brand::before { content: ''; display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: ${cover ? t.coverHl : t.accent}; margin-right: 12px; vertical-align: 2px; }
  .kicker { display: inline-block; align-self: flex-start; background: ${t.coverHl}; color: ${t.kickerFg}; font-weight: 700; font-size: 36px;
            padding: 10px 26px; border-radius: 999px; margin-bottom: 44px; }
  h1.cover { font-size: 104px; line-height: 1.22; font-weight: 900; letter-spacing: -2px; }
  h2 { font-size: 72px; line-height: 1.28; font-weight: 900; letter-spacing: -1.5px; margin-bottom: 44px; }
  h2.end { font-size: 88px; }
  .num { font-size: 40px; font-weight: 900; color: ${t.hl}; margin-bottom: 18px; }
  .sub { font-size: 42px; line-height: 1.55; margin-top: 40px; opacity: .85; }
  .body { font-size: 44px; line-height: 1.6; margin-bottom: 30px; }
  ul { list-style: none; }
  li { font-size: 44px; line-height: 1.5; padding: 22px 0 22px 64px; position: relative; border-top: 3px solid ${t.line}; }
  li:first-child { border-top: none; }
  li::before { content: ''; position: absolute; left: 6px; top: 40px; width: 26px; height: 26px; border-radius: ${t.bullet}; background: ${t.accent}; }
  .note { font-size: 32px; line-height: 1.5; margin-top: 30px; opacity: .65; }
  .hl { color: ${cover ? t.coverHl : t.hl}; }
  .swipe { margin-top: 80px; font-size: 36px; font-weight: 700; opacity: .7; }
  .cta { margin-top: 70px; align-self: flex-start; background: ${t.ctaBg}; color: ${t.ctaFg}; font-size: 40px; font-weight: 700; padding: 22px 40px; border-radius: 22px; }
  .wrap.img { inset: 120px 96px 110px; justify-content: flex-start; }
  h2.img-title { font-size: 64px; margin-bottom: 14px; }
  .img-sub { font-size: 36px; line-height: 1.45; opacity: .8; margin-bottom: 30px; }
  .shot { flex: 1; min-height: 0; display: flex; justify-content: center; align-items: flex-start; }
  .shot img { max-height: 100%; max-width: 100%; border-radius: 40px; border: 8px solid #fff; box-shadow: 0 24px 60px rgba(0,0,0,.18); }
  .ask { margin-top: 50px; font-size: 44px; font-weight: 700; line-height: 1.45; background: ${t.accent}; color: ${t.accentFg}; padding: 30px 40px; border-radius: 34px 34px 34px 8px; }
  .acts { margin-top: 36px; display: flex; gap: 20px; font-size: 36px; font-weight: 700; }
  .acts span { border: 3px solid currentColor; padding: 14px 26px; border-radius: 999px; opacity: .8; }
  .acts + .cta { margin-top: 36px; }
  .emo { position: absolute; font-family: 'Noto Color Emoji'; filter: drop-shadow(0 8px 0 rgba(0,0,0,.18)); }
  .phone { position: absolute; left: 50%; top: 150px; width: 430px; transform: translateX(-50%) rotate(-4deg); border-radius: 46px; border: 10px solid #fff; box-shadow: 0 30px 60px rgba(0,0,0,.25); }
  .stxt { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; }
  .stxt.low { top: auto; bottom: 120px; transform: none; }
  .ln { position: relative; line-height: 1.1; white-space: nowrap; }
  .ln + .ln { margin-top: -4px; }
  .l { display: block; letter-spacing: -2px; }
  .l.o { filter: drop-shadow(0 14px 0 rgba(0,0,0,.22)); }
  .l + .l { position: absolute; inset: 0; }
  .art { position: absolute; left: 0; right: 0; top: 0; height: 760px; background: radial-gradient(circle at 50% 55%, rgba(255,255,255,.55) 0, rgba(255,255,255,0) 62%); }
  .art span { position: absolute; font-family: 'Noto Color Emoji'; line-height: 1; filter: drop-shadow(0 18px 0 rgba(0,0,0,.18)); }
  .art .e0 { font-size: 400px; left: 50%; top: 170px; transform: translateX(-50%); }
  .art .e1 { font-size: 170px; left: 70px; top: 150px; transform: rotate(-14deg); }
  .art .e2 { font-size: 170px; right: 70px; top: 190px; transform: rotate(12deg); }
  .art .e3 { font-size: 140px; right: 140px; top: 520px; transform: rotate(-8deg); }
  .bigimg { position: absolute; left: 50%; top: 110px; height: 640px; transform: translateX(-50%) rotate(-3deg); border-radius: 40px; border: 10px solid #fff; box-shadow: 0 30px 60px rgba(0,0,0,.25); }
  .btxt { position: absolute; left: 0; right: 0; bottom: 110px; text-align: center; }
  .btxt .ln:first-child { margin-bottom: 6px; }
  .emo1 { font-family: 'Noto Color Emoji'; font-size: 190px; line-height: 1; margin-bottom: 30px; filter: drop-shadow(0 10px 0 rgba(0,0,0,.2)); }
  .pill { display: inline-block; font-size: 44px; font-weight: 900; padding: 14px 34px; border-radius: 999px; margin-bottom: 26px; }
  .csub { margin-top: 40px; font-size: 46px; font-weight: 700; opacity: .9; }
  .ssub { display: inline-block; margin-top: 34px; font-size: 40px; font-weight: 700; padding: 14px 30px; border-radius: 999px; }
  .page { position: absolute; bottom: 60px; right: 96px; font-size: 30px; font-weight: 700; opacity: .5; }
</style></head><body>
  <div class="top"><span class="brand">${esc(brand.name)}</span><span>${esc(brand.topic ?? '')}</span></div>
  ${sticker ? inner : `<div class="wrap${slide.type === 'image' ? ' img' : ''}">${inner}</div>`}
  <div class="page">${i + 1} / ${total}</div>
</body></html>`;
}

const file = process.argv[2];
if (!file) { console.error('사용법: node render.mjs <게시물 묶음.json>'); process.exit(1); }
const pack = JSON.parse(readFileSync(file, 'utf8'));
const brand = pack.brand;

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
const tmp = path.join(here, '.tmp-slide.html');

for (const post of pack.posts) {
  if (!/^[0-9a-z-]+$/.test(post.id)) throw new Error(`id는 소문자·숫자·하이픈만: ${post.id}`);
  if (post.slides.length < 1 || post.slides.length > 10) throw new Error(`${post.id}: 슬라이드는 1~10장`);
  if (post.caption.length > 2200) throw new Error(`${post.id}: 캡션은 2200자 이하`);
  const tags = (post.caption.match(/#\S+/g) ?? []).length;
  if (tags > 30) throw new Error(`${post.id}: 해시태그는 30개 이하`);

  const dir = path.join(queueDir, post.id);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const images = [];
  const theme = themeFor(post.id);
  for (const [i, slide] of post.slides.entries()) {
    writeFileSync(tmp, slideHtml(slide, i, post.slides.length, brand, theme, theme.sticker));
    await page.goto(pathToFileURL(tmp).href);
    await page.evaluate(() => document.fonts.ready);
    const name = `${String(i + 1).padStart(2, '0')}.jpg`;
    await page.screenshot({ path: path.join(dir, name), type: 'jpeg', quality: 90 });
    images.push(name);
  }
  writeFileSync(path.join(dir, 'post.json'), JSON.stringify({ caption: post.caption, images }, null, 2) + '\n');
  console.log(`✓ ${post.id} (${images.length}장, 디자인: ${theme.name})`);
}
rmSync(tmp, { force: true });
await browser.close();
