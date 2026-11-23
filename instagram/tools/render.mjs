// 게시물 묶음(JSON)을 읽어 카드 이미지(JPEG 1080×1350)와 post.json을 게시 대기열에 만든다.
// 사용법: node render.mjs ../content/2026-W48.json
// 인스타그램 API는 JPEG만 받기 때문에 JPEG로 저장한다.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const queueDir = path.resolve(here, '..', 'queue');

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(path.join(globalRoot, 'x.js'))('playwright');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **강조** → 강조색
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>').replace(/\n/g, '<br>');

const fontCss = (w) => pathToFileURL(path.join(here, 'node_modules/@fontsource/noto-sans-kr', `${w}.css`)).href;

function slideHtml(slide, i, total, brand) {
  let inner = '';
  if (slide.type === 'cover') {
    inner = `
      <div class="kicker">${esc(slide.kicker ?? '')}</div>
      <h1 class="cover">${rich(slide.title)}</h1>
      ${slide.sub ? `<p class="sub">${rich(slide.sub)}</p>` : ''}
      <div class="swipe">옆으로 넘겨 보기 →</div>`;
  } else if (slide.type === 'end') {
    inner = `
      <h2 class="end">${rich(slide.title ?? '도움이 됐다면\n저장해 두세요')}</h2>
      <p class="sub">${rich(slide.sub ?? '필요할 때 바로 꺼내 볼 수 있어요.')}</p>
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
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1350px; }
  body { font-family: 'Noto Sans KR', sans-serif; background: ${slide.type === 'cover' ? '#1F2A44' : '#FFF6EC'};
         color: ${slide.type === 'cover' ? '#FFF6EC' : '#1F2A44'}; position: relative; overflow: hidden; }
  .wrap { position: absolute; inset: 110px 96px 150px; display: flex; flex-direction: column; justify-content: center; }
  .top { position: absolute; top: 56px; left: 96px; right: 96px; display: flex; justify-content: space-between;
         font-size: 30px; font-weight: 700; opacity: .75; }
  .brand::before { content: ''; display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: #FF7A59; margin-right: 12px; vertical-align: 2px; }
  .kicker { display: inline-block; align-self: flex-start; background: #FF7A59; color: #fff; font-weight: 700; font-size: 36px;
            padding: 10px 26px; border-radius: 999px; margin-bottom: 44px; }
  h1.cover { font-size: 104px; line-height: 1.22; font-weight: 900; letter-spacing: -2px; }
  h2 { font-size: 72px; line-height: 1.28; font-weight: 900; letter-spacing: -1.5px; margin-bottom: 44px; }
  h2.end { font-size: 88px; }
  .num { font-size: 40px; font-weight: 900; color: #FF7A59; margin-bottom: 18px; }
  .sub { font-size: 42px; line-height: 1.55; margin-top: 40px; opacity: .85; }
  .body { font-size: 44px; line-height: 1.6; margin-bottom: 30px; }
  ul { list-style: none; }
  li { font-size: 44px; line-height: 1.5; padding: 22px 0 22px 64px; position: relative; border-top: 3px solid rgba(31,42,68,.1); }
  li:first-child { border-top: none; }
  li::before { content: ''; position: absolute; left: 6px; top: 40px; width: 26px; height: 26px; border-radius: 8px; background: #FF7A59; }
  .note { font-size: 32px; line-height: 1.5; margin-top: 30px; opacity: .65; }
  .hl { color: #FF7A59; }
  .swipe { margin-top: 80px; font-size: 36px; font-weight: 700; opacity: .7; }
  .cta { margin-top: 70px; align-self: flex-start; background: #1F2A44; color: #FFF6EC; font-size: 40px; font-weight: 700; padding: 22px 40px; border-radius: 22px; }
  .page { position: absolute; bottom: 60px; right: 96px; font-size: 30px; font-weight: 700; opacity: .5; }
</style></head><body>
  <div class="top"><span class="brand">${esc(brand.name)}</span><span>${esc(brand.topic ?? '')}</span></div>
  <div class="wrap">${inner}</div>
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
  for (const [i, slide] of post.slides.entries()) {
    writeFileSync(tmp, slideHtml(slide, i, post.slides.length, brand));
    await page.goto(pathToFileURL(tmp).href);
    await page.evaluate(() => document.fonts.ready);
    const name = `${String(i + 1).padStart(2, '0')}.jpg`;
    await page.screenshot({ path: path.join(dir, name), type: 'jpeg', quality: 90 });
    images.push(name);
  }
  writeFileSync(path.join(dir, 'post.json'), JSON.stringify({ caption: post.caption, images }, null, 2) + '\n');
  console.log(`✓ ${post.id} (${images.length}장)`);
}
rmSync(tmp, { force: true });
await browser.close();
