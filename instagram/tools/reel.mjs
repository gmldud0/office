// 릴스 전용 세로 영상(1080×1920)을 "카드 이어 붙이기"가 아니라 영상답게 만든다.
// - 위쪽에 게시물 제목이 계속 떠 있고(진짜 릴스처럼), 장면마다 글이 한 줄씩 천천히 나타난다.
// - 사진은 천천히 확대(켄 번스), 항목은 하나씩 톡톡 등장. 읽을 시간을 넉넉히 준다.
// 사용: node reel.mjs ../queue/<게시물 폴더> [...]   → <폴더>/reel.mp4
// post.json 의 slides 를 읽는다 (render.mjs 가 넣어 줌).
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { V2_COLORS } from './design-v2.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const W = 1080, H = 1920;
// 읽는 속도: 화면에 나온 글자 수에 맞춰 장면 길이를 정한다
const READ_CPS = 9;          // 1초에 읽는 글자 수(느긋하게)
const MIN_SCENE = 3.2, MAX_SCENE = 8;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/\(\(|\)\)/g, '');
const rich = (s, hl) => esc(s).replace(/\(\(([\s\S]+?)\)\)/g, `<b style="color:#e53935">$1</b>`)
  .replace(/\*\*([\s\S]+?)\*\*/g, `<b style="color:${hl}">$1</b>`).replace(/\n/g, '<br>');
function ring(r, color, step = 3) {
  const sh = [];
  for (let rr = 2; rr <= r; rr += step) {
    const n = Math.max(12, Math.round(rr * 1.4));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; sh.push(`${(Math.cos(a) * rr).toFixed(1)}px ${(Math.sin(a) * rr).toFixed(1)}px 0 ${color}`); }
  }
  return sh.join(',');
}
const font = (f) => pathToFileURL(path.join(here, 'fonts', f)).href;
const asset = (p) => pathToFileURL(path.resolve(here, '..', p)).href;

function colorsFor(name) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(name);
  const days = m ? Math.floor((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(2026, 10, 24)) / 86400000) : 0;
  const k = ((Math.floor(days / 3) % 4) + 4) % 4;
  return V2_COLORS[k];
}

// 장면 하나 = { html, dur }. 등장 요소에 class="in" + style="--d:초" (등장 시각)
function scenes(post, col) {
  const out = [];
  const title = plain(post.slides.find((s) => s.type === 'cover')?.title ?? post.caption.split('\n')[0]).replace(/\n/g, ' ');
  const dur = (chars, extra = 0) => Math.min(MAX_SCENE, Math.max(MIN_SCENE, 1.2 + chars / READ_CPS + extra));
  for (const s of post.slides) {
    if (s.type === 'cover') {
      const lines = String(s.title).split('\n');
      const visual = s.src
        ? `<div class="kb" style="background-image:url('${asset(s.src)}')"></div><div class="dim"></div>`
        : `<div class="burst"></div><div class="emo in pop" style="--d:.1s;font-size:420px;top:300px">${esc((s.emoji ?? ['✨'])[0])}</div>`;
      out.push({ dur: dur(plain(s.title).length + 6, 0.6), html: `${visual}
        <div class="center" style="top:${s.src ? 900 : 860}px">
          ${s.kicker ? `<div class="kick in" style="--d:.2s">${esc(s.kicker)}</div><br>` : ''}
          ${lines.map((l, i) => `<div class="big in pop${i === lines.length - 1 || /\*\*/.test(l) ? ' hl' : ''}" style="--d:${0.5 + i * 0.45}s">${esc(plain(l))}</div><br>`).join('')}
        </div>`, header: false });
    } else if (s.type === 'photo') {
      const lines = s.lines ?? [];
      out.push({ dur: dur(plain((s.pill ?? '') + lines.join('')).length, 1), html: `
        <div class="kb" style="background-image:url('${asset(s.src)}')"></div><div class="shade"></div>
        <div class="center" style="top:1080px">
          <div class="label in pop" style="--d:.3s">${esc(s.label ?? s.title ?? '')}</div>
          ${s.pill ? `<div class="pill in" style="--d:.9s">${esc(s.pill)}</div>` : ''}
          ${lines.map((l, i) => `<div class="line in" style="--d:${1.8 + i * 1.1}s">${rich(l, '#ffe066')}</div>`).join('')}
        </div>${s.credit ? `<div class="credit">${esc(s.credit)}</div>` : ''}` });
    } else if (s.type === 'image') {
      out.push({ dur: dur(plain((s.title ?? '') + (s.sub ?? '')).length, 1.5), html: `<div class="soft"></div>
        <div class="center" style="top:330px">
          ${s.num ? `<div class="num in" style="--d:.1s">${esc(s.num)}</div>` : ''}
          <div class="mid in pop" style="--d:.3s">${rich(s.title, col.hl)}</div>
          ${s.sub ? `<div class="sub in" style="--d:.9s">${rich(s.sub, col.hl)}</div>` : ''}
        </div>
        <img class="phone in rise" style="--d:.6s" src="${asset(s.src)}">` });
    } else if (s.type === 'end') {
      out.push({ dur: dur(plain((s.title ?? '') + (s.sub ?? '') + (s.ask ?? '')).length, 1.2), html: `<div class="burst"></div><div class="glow"></div>
        <div class="center" style="top:520px">
          ${String(s.title ?? '').split('\n').map((l, i) => `<div class="mid in pop" style="--d:${0.2 + i * 0.4}s;${/\*\*/.test(l) ? `color:${col.hl}` : ''}">${esc(plain(l))}</div>`).join('')}
          ${s.sub ? `<div class="sub in" style="--d:1.2s">${rich(s.sub, col.hl)}</div>` : ''}
          ${s.ask ? `<div class="ask in" style="--d:1.9s">💬 ${rich(s.ask, '#ffe066')}</div>` : ''}
          <div class="acts in" style="--d:2.6s"><span>📌 저장</span><span>📤 공유</span><span>➕ 팔로우</span></div>
        </div>` });
    } else {
      // list: 제목 → 본문 → 항목을 하나씩
      const items = s.items ?? [];
      const chars = plain((s.title ?? '') + (s.body ?? '') + items.join('')).length;
      out.push({ dur: dur(chars, 0.5 + items.length * 0.4), html: `<div class="soft"></div>
        <div class="center" style="top:${items.length > 3 ? 360 : 470}px">
          ${s.num ? `<div class="num in" style="--d:.1s">${esc(s.num)}</div>` : ''}
          <div class="mid in pop" style="--d:.3s">${rich(s.title ?? '', col.hl)}</div>
          ${s.body ? `<div class="sub in" style="--d:1s">${rich(s.body, col.hl)}</div>` : ''}
          ${items.map((t, i) => `<div class="item in" style="--d:${(s.body ? 2 : 1.2) + i * 1.0}s">${rich(t, col.hl)}</div>`).join('')}
          ${s.note ? `<div class="note in" style="--d:${(s.body ? 2 : 1.2) + items.length * 1.0}s">${rich(s.note, col.hl)}</div>` : ''}
        </div>` });
    }
  }
  return { list: out, title };
}

function page(sc, title, col, t0, tEnd, idx, total) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:BHS;src:url(${font('BlackHanSans.woff2')})}
  @font-face{font-family:Jua;src:url(${font('Jua.woff2')})}
  *{margin:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{position:relative;font-family:Jua,sans-serif;background:${col.a};color:#1b1b1b}
  .burst{position:absolute;inset:0;background-color:${col.a};background-image:radial-gradient(${col.b} 7px, transparent 8px);background-size:52px 52px}
  .glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#fff 0,rgba(255,255,255,0) 45%)}
  .soft{position:absolute;inset:0;background-color:${col.a};background-image:radial-gradient(${col.b} 7px, transparent 8px);background-size:52px 52px}
  .kb{position:absolute;inset:-4%;background:center/cover;animation:kb ${tEnd}s linear both}
  @keyframes kb{from{transform:scale(1.0)}to{transform:scale(1.12)}}
  .dim{position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.05) 30%,rgba(0,0,0,.75) 70%)}
  .shade{position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,0) 35%,rgba(0,0,0,.85) 62%)}
  .center{position:absolute;left:70px;right:150px;text-align:center}
  .in{opacity:0;animation:fade .5s ease-out both;animation-delay:var(--d)}
  .in.pop{animation-name:pop}
  .in.rise{animation-name:rise;animation-duration:.8s}
  @keyframes fade{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
  @keyframes pop{0%{opacity:0;transform:scale(.6)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
  @keyframes rise{from{opacity:0;transform:translate(-50%,160px)}to{opacity:1;transform:translate(-50%,0)}}
  .emo{position:absolute;left:0;right:0;text-align:center;font-family:'Noto Color Emoji';line-height:1}
  .kick{display:inline-block;background:${col.ink};color:#fff;font-size:52px;padding:14px 38px;border-radius:999px;margin-bottom:24px}
  .big{display:inline-block;font-family:BHS;font-size:130px;line-height:1.1;color:#fff;background:${col.ink};padding:.12em .4em .18em;margin:10px 0;clip-path:polygon(0 8%,2% 0,98% 0,100% 8%,100% 92%,98% 100%,2% 100%,0 92%)}
  .big.hl{background:${col.hl};color:${col.ink}}
  .mid{display:inline-block;font-family:BHS;font-size:96px;line-height:1.18;margin-bottom:30px;color:#fff;background:${col.ink};padding:.08em .4em .14em}
  .mid b{color:${col.hl} !important}
  .sub{font-size:56px;line-height:1.5;margin-bottom:40px;color:#1b1b1b;background:#fffdf7;padding:20px 28px;border-radius:20px}
  .item{background:#fffdf7;border-bottom:5px dashed #cfcac0;padding:30px 30px;margin:0;font-size:56px;line-height:1.35;text-align:left}
  .item:first-of-type{border-radius:20px 20px 0 0}
  .note{font-size:38px;color:#777;margin-top:10px}
  .num{display:inline-block;background:${col.ink};color:#fff;font-size:44px;padding:10px 30px;border-radius:999px;margin-bottom:24px}
  .label{display:inline-block;font-family:BHS;font-size:120px;color:${col.ink};background:${col.hl};padding:.1em .45em .16em;transform:rotate(-2deg);clip-path:polygon(0 8%,2% 0,98% 0,100% 8%,100% 92%,98% 100%,2% 100%,0 92%)}
  .pill{margin:40px 0 34px;background:#fff;border-radius:999px;padding:24px 30px;font-size:60px;color:#3b2a20}
  .line{font-size:60px;line-height:1.5;color:#fff;margin-bottom:10px}
  .phone{position:absolute;left:50%;bottom:120px;height:1000px;transform:translateX(-50%);border-radius:50px;border:12px solid #1b1b1b;box-shadow:0 30px 70px rgba(0,0,0,.25)}
  .ask{background:${col.ink};color:#fff;font-size:56px;line-height:1.45;padding:34px 40px;border-radius:40px 40px 40px 10px;margin:10px 0 40px}
  .acts{display:flex;justify-content:center;gap:20px;font-size:46px}
  .acts span{background:#fff;border:5px solid #1b1b1b;padding:14px 26px;border-radius:999px}
  .credit{position:absolute;left:40px;bottom:40px;font-size:26px;color:rgba(255,255,255,.7)}
  .hdr{position:absolute;left:0;right:0;top:0;padding:120px 70px 30px;background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,0));color:#fff;font-size:50px;text-align:center;z-index:5}
  .hdr small{display:block;font-size:32px;opacity:.85;margin-bottom:6px}
  .bar{position:absolute;left:70px;right:70px;top:80px;height:10px;border-radius:5px;background:rgba(255,255,255,.35);z-index:6;overflow:hidden}
  .bar i{display:block;height:100%;width:${(idx / total) * 100}%;background:#fff;animation:bar ${tEnd}s linear both}
  @keyframes bar{from{width:${(idx / total) * 100}%}to{width:${((idx + 1) / total) * 100}%}}
  </style></head><body>${sc.html}
  ${sc.header === false ? '' : `<div class="hdr"><small>Yozmbom · 2030 생활 꿀팁</small>${esc(title)}</div>`}
  <div class="bar"><i></i></div></body></html>`;
}

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  return createRequire(path.join(execSync('npm root -g').toString().trim(), 'x.js'))('playwright');
}

async function make(folder, browser) {
  const post = JSON.parse(fs.readFileSync(path.join(folder, 'post.json'), 'utf8'));
  if (!post.slides) { console.log(`slides 없음: ${folder} (render.mjs 로 다시 만들기)`); return; }
  const col = colorsFor(path.basename(folder));
  const { list, title } = scenes(post, col);
  const tmpDir = fs.mkdtempSync(path.join(folder, '.reel-'));
  const pageObj = await browser.newPage({ viewport: { width: W, height: H } });
  let frame = 0;
  for (const [i, sc] of list.entries()) {
    fs.writeFileSync(path.join(tmpDir, 's.html'), page(sc, title, col, 0, sc.dur, i, list.length));
    await pageObj.goto(pathToFileURL(path.join(tmpDir, 's.html')).href);
    await pageObj.evaluate(() => document.fonts.ready);
    await pageObj.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    const n = Math.round(sc.dur * FPS);
    for (let f = 0; f < n; f++) {
      const ms = (f / FPS) * 1000;
      await pageObj.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), ms);
      await pageObj.screenshot({ path: path.join(tmpDir, `f${String(frame++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 85 });
    }
  }
  await pageObj.close();
  const out = path.join(folder, 'reel.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmpDir, 'f%05d.jpg'),
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(String(r.stderr));
  const total = list.reduce((a, s) => a + s.dur, 0);
  console.log(`✓ ${path.basename(folder)}/reel.mp4 (${list.length}장면, ${total.toFixed(1)}초, ${(fs.statSync(out).size / 1e6).toFixed(1)}MB)`);
}

const folders = process.argv.slice(2);
if (!folders.length) { console.error('사용: node reel.mjs <게시물 폴더> [...]'); process.exit(1); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
for (const f of folders) await make(path.resolve(f), browser);
await browser.close();
