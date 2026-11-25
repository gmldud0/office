// 디자인 v2 (2026-11-27부터): 사용자가 고른 "확인용 예시" 스타일
// - 표지: 만화 집중선 배경 + 큰 사진(또는 큰 이모지) + 둥근 테두리 글씨, 마지막 줄 강조색
// - photo: 화면 꽉 찬 실제 사진 + 이름표 스티커 + 흰 말풍선 + 아래 2줄 설명 (공감 카드)
// - list/image: 모눈종이 노트 카드 + 점선 노란 상자 항목, 숫자 강조는 ((빨간 동그라미))
// - end: 모눈 노트 + 댓글 키워드/질문 + 공유·저장 유도
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 3일마다 바뀌는 색 (v2 전용). [집중선 밝은색, 집중선 진한색, 강조 글자색, 강조 그림자색]
export const V2_COLORS = [
  { name: '크림 · 하늘', a: '#fff7d6', b: '#ffe9a8', hl: '#7ec8e3', drop: '#7ec8e3', ink: '#3b2a20' },
  { name: '민트 · 주황', a: '#e3fff4', b: '#bff0dc', hl: '#ff8a3d', drop: '#ffb27a', ink: '#1f3a33' },
  { name: '분홍 · 보라', a: '#ffe8f1', b: '#ffcade', hl: '#8b6bff', drop: '#b9a6ff', ink: '#3a1f3a' },
  { name: '하늘 · 노랑', a: '#e6f3ff', b: '#c4e2ff', hl: '#ffc61a', drop: '#3b2a20', ink: '#1d2b53' },
];

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
function sticker(text, size, { fill = '#fff', stroke = '#3b2a20', outer = '#fff', font = 'Jua', drop = '#7ec8e3' } = {}) {
  const s = Math.max(5, Math.round(size * 0.06));
  const t = esc(text);
  return `<div class="ln" style="font-size:${size}px;font-family:${font}">
    <span class="l" style="color:${drop};text-shadow:${ring(s * 2 + 6, drop)};transform:translateY(${Math.round(size * 0.07)}px)">${t}</span>
    <span class="l" style="color:${outer};text-shadow:${ring(s * 2 + 6, outer)}">${t}</span>
    <span class="l" style="color:${stroke};text-shadow:${ring(s, stroke)}">${t}</span>
    <span class="l" style="color:${fill}">${t}</span></div>`;
}
// 본문용: **강조**(강조색), ((빨간 동그라미)), 줄바꿈
function richV2(s, hl) {
  return esc(s)
    .replace(/\(\(([\s\S]+?)\)\)/g, '<span class="circ">$1<svg viewBox="0 0 200 80" preserveAspectRatio="none"><path d="M10 45 C 10 10, 190 5, 192 40 S 40 82, 18 52" fill="none" stroke="#e53935" stroke-width="7" stroke-linecap="round"/></svg></span>')
    .replace(/\*\*([\s\S]+?)\*\*/g, `<b style="color:${hl}">$1</b>`)
    .replace(/\n/g, '<br>');
}
const plain = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/\(\(|\)\)/g, '');
const width = (l) => [...plain(l)].reduce((a, ch) => a + (ch === ' ' ? 0.4 : /[A-Za-z0-9]/.test(ch) ? 0.6 : 1), 0);
const fit = (lines, max, room = 940) => Math.min(max, Math.floor(room / Math.max(3, ...lines.map(width))));

export function slideV2(slide, i, total, brand, col, here, fontUrl) {
  const src = (p) => pathToFileURL(path.resolve(here, '..', p)).href;
  const logo = `<div class="logo">${sticker(brand.name, 38, { font: 'BHS', fill: '#5b8def', stroke: '#fff', outer: '#1d2b53', drop: 'transparent' })}</div>`;
  const credit = slide.credit ? `<div class="credit">${esc(slide.credit)}</div>` : '';
  const page = `<div class="page">${i + 1} / ${total}</div>`;
  let body = '';

  if (slide.type === 'cover') {
    const lines = String(slide.title).split('\n');
    const size = fit(lines, 170);
    const visual = slide.src
      ? `<div class="cphoto" style="background-image:url('${src(slide.src)}')"></div>`
      : `<div class="emo" style="font-size:380px;left:50%;top:150px;transform:translateX(-50%)">${esc((slide.emoji ?? ['✨'])[0])}</div>`;
    const side = (slide.emoji ?? []).slice(slide.src ? 0 : 1, slide.src ? 2 : 3)
      .map((e, k) => `<div class="emo" style="font-size:150px;${k ? 'left:70px;top:520px;transform:rotate(-12deg)' : 'right:80px;top:130px;transform:rotate(10deg)'}">${esc(e)}</div>`).join('');
    body = `<div class="burst" style="background:repeating-conic-gradient(from 0deg at 50% 42%, ${col.a} 0deg 4deg, ${col.b} 4deg 9deg)"></div>
      <div class="glow"></div>${visual}${side}${logo}
      <div class="ctxt">
        ${slide.kicker ? `<div class="kick" style="background:${col.ink}">${esc(slide.kicker)}</div>` : ''}
        ${lines.map((l, k) => sticker(plain(l), size, k === lines.length - 1 || /\*\*/.test(l)
          ? { fill: col.hl, stroke: col.ink, drop: col.ink === col.drop ? '#fff' : col.ink }
          : { fill: '#fff', stroke: col.ink, drop: col.drop })).join('')}
      </div>${credit}`;
  } else if (slide.type === 'photo') {
    const label = slide.label ?? slide.title ?? '';
    body = `<div class="full" style="background-image:url('${src(slide.src)}')"></div>
      <div class="shade"></div>${logo}
      <div class="ptxt">
        ${slide.num ? `<div class="pnum">${esc(slide.num)}</div>` : ''}
        <div style="display:inline-block;transform:rotate(-3deg)">${sticker(plain(label), fit([label], 140, 900), { font: 'BHS', fill: col.ink, stroke: '#fff', outer: '#fff', drop: col.drop })}</div>
        ${slide.pill ? `<div class="pill">${esc(slide.pill)}</div>` : ''}
        ${(slide.lines ?? []).map((l) => `<div class="pline">${richV2(l, '#ffe066')}</div>`).join('')}
      </div>${credit}`;
  } else {
    // 모눈 노트 카드 (list / image / end)
    const title = slide.title ?? '';
    const tl = String(title).split('\n');
    let inner = `${slide.num ? `<div class="num" style="background:${col.ink}">${esc(slide.num)}</div>` : ''}
      <div class="ntitle">${tl.map((l) => sticker(plain(l), fit(tl, 96, 860), { font: 'BHS', fill: /\*\*/.test(l) ? col.hl : '#1b1b1b', stroke: '#fff', outer: '#fff', drop: '#c9c9c9' })).join('')}</div>`;
    if (slide.type === 'image') {
      inner += `${slide.sub ? `<div class="nbody">${richV2(slide.sub, col.hl)}</div>` : ''}<div class="shot"><img src="${src(slide.src)}"></div>`;
    } else if (slide.type === 'end') {
      inner += `${slide.sub ? `<div class="nbody">${richV2(slide.sub, col.hl)}</div>` : ''}
        ${slide.keyword ? `<div class="kw">댓글에 <b>[${esc(slide.keyword)}]</b> 남기면<br>${esc(slide.reward ?? '정리본 보내 드려요!')}</div>` : ''}
        ${slide.ask ? `<div class="ask" style="background:${col.ink}">💬 ${richV2(slide.ask, '#ffe066')}</div>` : ''}
        <div class="acts"><span>📤 단톡방에 공유</span><span>📌 저장</span></div>
        <div class="cta">${esc(brand.cta)}</div>`;
    } else {
      inner += `${slide.body ? `<div class="nbody">${richV2(slide.body, col.hl)}</div>` : ''}
        ${(slide.items ?? []).map((t) => `<div class="box">${richV2(t, col.hl)}</div>`).join('')}
        ${slide.note ? `<div class="nnote">${richV2(slide.note, col.hl)}</div>` : ''}
        ${slide.next ? `<div class="next">${sticker(slide.next + ' ▶', 54, { fill: '#1b1b1b', stroke: '#fff', outer: '#fff', drop: '#c9c9c9' })}</div>` : ''}`;
    }
    body = `<div class="paper${slide.type === 'image' ? ' img' : ''}${slide.type === 'end' ? ' end' : ''}">${inner}</div>
      <div class="brand2">${esc(brand.name)}</div>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:BHS;src:url(${fontUrl('BlackHanSans.woff2')})}
  @font-face{font-family:Jua;src:url(${fontUrl('Jua.woff2')})}
  *{margin:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden}
  body{position:relative;font-family:Jua,sans-serif;background:#1b1b1b;color:#1b1b1b}
  .ln{position:relative;line-height:1.12;white-space:nowrap}
  .l{display:block;letter-spacing:-1px}
  .l + .l{position:absolute;inset:0}
  .logo{position:absolute;left:44px;top:40px;z-index:5}
  .emo{position:absolute;font-family:'Noto Color Emoji';line-height:1;filter:drop-shadow(0 12px 0 rgba(0,0,0,.15))}
  .burst{position:absolute;inset:0}
  .glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,#fff 0,rgba(255,255,255,0) 42%)}
  .cphoto{position:absolute;left:50%;top:120px;width:760px;height:600px;transform:translateX(-50%) rotate(-2deg);background:center/cover;border:14px solid #fff;border-radius:44px;box-shadow:0 26px 60px rgba(0,0,0,.25)}
  .ctxt{position:absolute;left:0;right:0;bottom:110px;text-align:center}
  .kick{display:inline-block;color:#fff;font-size:44px;padding:12px 34px;border-radius:999px;margin-bottom:18px}
  .full{position:absolute;inset:0;background:center 30%/cover}
  .shade{position:absolute;left:0;right:0;bottom:0;height:760px;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.78) 38%,rgba(0,0,0,.93))}
  .ptxt{position:absolute;left:0;right:0;bottom:80px;text-align:center}
  .pnum{display:inline-block;background:#fff;color:#1b1b1b;font-size:36px;padding:6px 22px;border-radius:999px;margin-bottom:12px}
  .pill{margin:22px 70px 26px;background:#fff;border-radius:999px;padding:20px 30px;font-size:56px;color:#3b2a20}
  .pline{font-size:52px;line-height:1.45;color:#fff;padding:0 50px}
  .paper{position:absolute;inset:60px 50px 80px;border-radius:60px;padding:80px 60px 60px;display:flex;flex-direction:column;align-items:stretch;
    background-color:#fff;background-image:linear-gradient(#e8e8e8 2px,transparent 2px),linear-gradient(90deg,#e8e8e8 2px,transparent 2px);background-size:44px 44px}
  .paper.end{justify-content:center}
  .num{align-self:center;color:#fff;font-size:36px;padding:8px 26px;border-radius:999px;margin-bottom:16px}
  .ntitle{text-align:center;margin-bottom:34px}
  .nbody{text-align:center;font-size:50px;line-height:1.5;margin-bottom:34px}
  .box{background:#fff6b3;border:5px dotted #1b1b1b;border-radius:12px;padding:24px 22px;margin:0 6px 24px;text-align:center;font-size:48px;line-height:1.35}
  .nnote{text-align:center;font-size:32px;color:#777;margin-top:8px}
  .next{text-align:center;margin-top:auto}
  .circ{position:relative;display:inline-block;padding:0 12px}
  .circ svg{position:absolute;left:-12px;top:-10px;width:calc(100% + 24px);height:calc(100% + 20px)}
  .shot{flex:1;min-height:0;display:flex;justify-content:center}
  .shot img{max-height:100%;max-width:100%;border-radius:36px;border:8px solid #1b1b1b;box-shadow:0 18px 40px rgba(0,0,0,.18)}
  .paper.img{padding-bottom:40px}
  .kw{text-align:center;font-size:62px;line-height:1.4;margin:10px 0 30px}
  .kw b{color:#e53935}
  .ask{color:#fff;font-size:44px;line-height:1.45;padding:26px 34px;border-radius:34px 34px 34px 8px;margin:0 10px 30px}
  .acts{display:flex;justify-content:center;gap:18px;font-size:36px;margin-bottom:26px}
  .acts span{border:4px solid #1b1b1b;padding:12px 24px;border-radius:999px}
  .cta{align-self:center;background:#1b1b1b;color:#fff;font-size:38px;padding:18px 34px;border-radius:20px}
  .brand2{position:absolute;left:0;right:0;bottom:26px;text-align:center;color:#888;font-size:28px}
  .credit{position:absolute;right:28px;bottom:16px;font-size:22px;color:rgba(255,255,255,.65);text-shadow:0 1px 2px #000}
  .page{position:absolute;right:28px;top:30px;font-size:24px;color:rgba(0,0,0,.35)}
  </style></head><body>${body}${slide.type === 'photo' || slide.type === 'cover' ? '' : page}</body></html>`;
}
