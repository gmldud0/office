// 디자인 v2 「라벨 & 영수증」 (2026-11-27부터) — Yozmbom만의 디자인
// 참고한 계정들의 장점(큰 글씨·실제 사진·정리된 항목·숫자 강조·댓글 유도)만 가져오고 모양은 새로:
// - 표지: 실제 사진(또는 큰 이모지) + 제목을 "라벨기 테이프"처럼 한 줄씩 붙임 + 노란 메모지 말머리
// - photo: 꽉 찬 사진 + 라벨 테이프 이름표 + 말풍선 테이프 + 아래 설명
// - list: 「꿀팁 영수증」 — 톱니 모양 종이, 점선 구분, 번호 줄, 합계 줄, 바코드(@yozmbom)
//         숫자 강조는 ((형광펜)), **강조**는 강조색
// - image: 색 배경 위 앱 화면 + 마스킹테이프
// - end: 영수증 맨 아래("감사합니다") + 질문 상자 + 쿠폰처럼 생긴 저장·공유
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 3일마다 바뀌는 색. a=배경, b=점무늬, hl=강조(형광펜·테이프), ink=진한 글자/테이프, drop=보조
export const V2_COLORS = [
  { name: '코랄 · 먹색', a: '#ff8a65', b: '#ff7a52', hl: '#ffe066', drop: '#ffd0c2', ink: '#1e1e24' },
  { name: '세이지 · 노랑', a: '#9cc5a1', b: '#8ab990', hl: '#ffd23f', drop: '#e1f0e3', ink: '#1f2d24' },
  { name: '라일락 · 라임', a: '#b8a6ff', b: '#a894ff', hl: '#d4ff3a', drop: '#ece6ff', ink: '#211a3d' },
  { name: '하늘 · 오렌지', a: '#7cc4ff', b: '#68b8ff', hl: '#ffb020', drop: '#e3f2ff', ink: '#0f2236' },
];

const plain = (s) => String(s ?? '').replace(/\*\*/g, '').replace(/\(\(|\)\)/g, '');
function rich(s, c) {
  return esc(s)
    .replace(/\(\(([\s\S]+?)\)\)/g, `<mark style="background:linear-gradient(transparent 52%, ${c.hl} 52% 90%, transparent 90%)">$1</mark>`)
    .replace(/\*\*([\s\S]+?)\*\*/g, `<b style="color:${c.ink};background:linear-gradient(transparent 60%, ${c.hl} 60%)">$1</b>`)
    .replace(/\n/g, '<br>');
}
const width = (l) => [...plain(l)].reduce((a, ch) => a + (ch === ' ' ? 0.4 : /[A-Za-z0-9]/.test(ch) ? 0.6 : 1), 0);
const fit = (lines, max, room) => Math.min(max, Math.floor(room / Math.max(3, ...lines.map(width))));

// 라벨기 테이프 한 줄
function tape(text, size, c, { hl = false, rot = 0 } = {}) {
  const bg = hl ? c.hl : c.ink;
  const fg = hl ? c.ink : '#fff';
  return `<div class="tapewrap"><span class="tape" style="font-size:${size}px;background:${bg};color:${fg};transform:rotate(${rot}deg)">${esc(plain(text))}</span></div>`;
}
const logo = `<div class="logo">yozmbom<i>.</i></div>`;
const barcode = (c) => `<div class="barcode"><div class="bars"></div><div class="bc">@yozmbom · 2030 생활 꿀팁</div></div>`;

export function slideV2(slide, i, total, brand, c, here, fontUrl) {
  const src = (p) => pathToFileURL(path.resolve(here, '..', p)).href;
  const credit = slide.credit ? `<div class="credit">${esc(slide.credit)}</div>` : '';
  const pageNo = `<div class="pageno">${String(i + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}</div>`;
  let body = '';

  if (slide.type === 'cover') {
    const lines = String(slide.title).split('\n');
    const size = fit(lines, 128, 900);
    const visual = slide.src
      ? `<div class="full" style="background-image:url('${src(slide.src)}')"></div><div class="shade"></div>`
      : `<div class="dots"></div><div class="emo" style="font-size:400px;left:50%;top:170px;transform:translateX(-50%) rotate(-6deg)">${esc((slide.emoji ?? ['✨'])[0])}</div>`;
    body = `${visual}${logo}
      <div class="cover-txt">
        ${slide.kicker ? `<div class="memo">${esc(slide.kicker)}</div>` : ''}
        ${lines.map((l, k) => tape(l, size, c, { hl: /\*\*/.test(l) || (k === lines.length - 1 && !lines.some((x) => /\*\*/.test(x))), rot: k % 2 ? 1.5 : -1.5 })).join('')}
        ${slide.sub ? `<div class="csub">${esc(slide.sub)}</div>` : ''}
      </div>${credit}${pageNo}`;
  } else if (slide.type === 'photo') {
    const label = slide.label ?? slide.title ?? '';
    body = `<div class="full" style="background-image:url('${src(slide.src)}')"></div><div class="shade"></div>${logo}
      <div class="photo-txt">
        ${slide.num ? `<div class="memo small">${esc(slide.num)}</div>` : ''}
        ${tape(label, fit([label], 120, 760), c, { hl: true, rot: -2 })}
        ${slide.pill ? `<div class="bubble">${esc(slide.pill)}</div>` : ''}
        ${(slide.lines ?? []).map((l) => `<div class="pline">${esc(plain(l))}</div>`).join('')}
      </div>${credit}${pageNo}`;
  } else if (slide.type === 'image') {
    const tl = String(slide.title ?? '').split('\n');
    body = `<div class="dots"></div>${logo}
      <div class="img-head">
        ${slide.num ? `<div class="memo small">${esc(slide.num)}</div>` : ''}
        ${tl.map((l, k) => tape(l, fit(tl, 84, 900), c, { hl: /\*\*/.test(l), rot: k % 2 ? 1 : -1 })).join('')}
        ${slide.sub ? `<div class="isub">${esc(plain(slide.sub)).replace(/\n/g, '<br>')}</div>` : ''}
      </div>
      <div class="shotwrap"><img src="${src(slide.src)}"><span class="mt mt1"></span><span class="mt mt2"></span></div>${pageNo}`;
  } else {
    // list / end → 꿀팁 영수증
    const tl = String(slide.title ?? '').split('\n');
    const head = `<div class="r-head"><b>YOZMBOM</b> 꿀팁 영수증<span>No.${String(i + 1).padStart(3, '0')}</span></div><div class="dash"></div>`;
    const title = `${slide.num ? `<div class="r-num">${esc(slide.num)}</div>` : ''}
      <div class="r-title" style="font-size:${fit(tl, 84, 760)}px">${tl.map((l) => rich(l, c)).join('<br>')}</div>`;
    let inner;
    if (slide.type === 'end') {
      inner = `${head}${title}
        ${slide.sub ? `<div class="r-body">${rich(slide.sub, c)}</div>` : ''}
        ${slide.ask ? `<div class="r-ask">💬 ${rich(slide.ask, c)}</div>` : ''}
        ${slide.keyword ? `<div class="r-kw">댓글에 <b>${esc(slide.keyword)}</b> 남기면 ${esc(slide.reward ?? '정리본을 보내 드려요')}</div>` : ''}
        <div class="dash"></div>
        <div class="coupons"><span>📌 저장 쿠폰</span><span>📤 공유 쿠폰</span></div>
        <div class="r-thanks">${esc(brand.cta)}</div>
        ${barcode(c)}`;
    } else {
      const items = slide.items ?? [];
      inner = `${head}${title}
        ${slide.body ? `<div class="r-body">${rich(slide.body, c)}</div>` : ''}
        ${items.length ? `<div class="dash"></div>` : ''}
        ${items.map((t, k) => `<div class="r-row"><span class="r-i">${String(k + 1).padStart(2, '0')}</span><span class="r-t">${rich(String(t).replace(/^\d+\.\s*/, ''), c)}</span></div>`).join('')}
        ${slide.note ? `<div class="dash"></div><div class="r-note">${rich(slide.note, c)}</div>` : ''}
        ${slide.next ? `<div class="r-next">${esc(slide.next)} ▶</div>` : ''}
        ${barcode(c)}`;
    }
    body = `<div class="dots"></div>${logo}<div class="receipt">${inner}</div>${pageNo}`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:BHS;src:url(${fontUrl('BlackHanSans.woff2')})}
  @font-face{font-family:Jua;src:url(${fontUrl('Jua.woff2')})}
  *{margin:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden}
  body{position:relative;font-family:Jua,sans-serif;background:${c.a};color:${c.ink}}
  .dots{position:absolute;inset:0;background-color:${c.a};background-image:radial-gradient(${c.b} 6px, transparent 7px);background-size:44px 44px}
  .full{position:absolute;inset:0;background:center 35%/cover}
  .shade{position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,0) 30%,rgba(0,0,0,.55) 60%,rgba(0,0,0,.85))}
  .logo{position:absolute;left:48px;top:42px;font:44px BHS;color:#fff;background:${c.ink};padding:6px 20px 10px;border-radius:12px;letter-spacing:.5px;z-index:5}
  .logo i{color:${c.hl};font-style:normal}
  .pageno{position:absolute;right:48px;top:52px;font:30px Jua;color:#fff;background:rgba(0,0,0,.35);padding:4px 16px;border-radius:999px;z-index:5}
  .emo{position:absolute;font-family:'Noto Color Emoji';line-height:1;filter:drop-shadow(0 16px 0 rgba(0,0,0,.18))}
  .tapewrap{margin:10px 0}
  .tape{display:inline-block;font-family:BHS;line-height:1.1;padding:.14em .42em .2em;letter-spacing:.02em;
    clip-path:polygon(0 8%,2% 0,98% 0,100% 8%,100% 92%,98% 100%,2% 100%,0 92%);box-shadow:0 10px 0 rgba(0,0,0,.18)}
  .memo{display:inline-block;background:${c.hl};color:${c.ink};font-size:46px;padding:14px 30px 16px;transform:rotate(-3deg);box-shadow:0 8px 0 rgba(0,0,0,.15);margin-bottom:18px;position:relative}
  .memo::before{content:'';position:absolute;left:50%;top:-16px;width:110px;height:30px;transform:translateX(-50%) rotate(4deg);background:rgba(255,255,255,.65)}
  .memo.small{font-size:36px;padding:10px 24px 12px}
  .cover-txt{position:absolute;left:60px;right:60px;bottom:110px;text-align:left}
  .csub{margin-top:24px;font-size:44px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)}
  .photo-txt{position:absolute;left:60px;right:60px;bottom:90px}
  .bubble{display:inline-block;margin:26px 0 24px;background:#fff;color:${c.ink};font-size:54px;padding:22px 34px;border-radius:40px 40px 40px 8px}
  .pline{font-size:50px;line-height:1.5;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)}
  .img-head{position:absolute;left:60px;right:60px;top:140px;text-align:center}
  .isub{display:inline-block;margin-top:16px;background:#fff;padding:14px 28px;border-radius:20px;font-size:42px;line-height:1.4}
  .shotwrap{position:absolute;left:50%;bottom:70px;transform:translateX(-50%) rotate(-2deg)}
  .shotwrap img{display:block;height:780px;border-radius:40px;border:10px solid #fff;box-shadow:0 26px 60px rgba(0,0,0,.25)}
  .mt{position:absolute;width:160px;height:46px;background:rgba(255,255,255,.7)}
  .mt1{left:-50px;top:30px;transform:rotate(-35deg)}
  .mt2{right:-50px;bottom:40px;transform:rotate(-35deg)}
  .receipt{position:absolute;left:110px;right:110px;top:130px;bottom:90px;background:#fffdf7;padding:56px 56px 40px;display:flex;flex-direction:column;
    box-shadow:0 26px 50px rgba(0,0,0,.2);
    -webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/36px 100%, conic-gradient(from 135deg at top,#0000,#000 1deg 89deg,#0000 90deg) 50%/36px 100%;
    -webkit-mask-composite:source-in;mask-composite:intersect}
  .r-head{display:flex;justify-content:space-between;align-items:baseline;font-size:34px;color:#555;margin-top:8px}
  .r-head b{font-family:BHS;color:${c.ink};font-size:40px;margin-right:10px}
  .r-head span{font-size:28px;color:#999}
  .dash{border-top:5px dashed #cfcac0;margin:24px 0}
  .r-num{align-self:flex-start;background:${c.ink};color:#fff;font-size:32px;padding:6px 18px;border-radius:8px;margin-bottom:14px}
  .r-title{font-family:BHS;line-height:1.2;margin-bottom:18px}
  .r-title b{background:linear-gradient(transparent 60%, ${c.hl} 60%) !important}
  .r-body{font-size:46px;line-height:1.5;margin-bottom:6px}
  .r-row{display:flex;gap:22px;align-items:flex-start;font-size:46px;line-height:1.38;padding:16px 0;border-bottom:3px dotted #e2ddd3}
  .r-i{flex:none;font-family:BHS;color:#fff;background:${c.ink};border-radius:10px;padding:2px 12px;font-size:34px;margin-top:6px}
  .r-t{flex:1}
  .r-note{font-size:32px;color:#888;line-height:1.4}
  .r-next{margin-top:18px;align-self:flex-end;font-size:38px;background:${c.hl};padding:8px 22px;border-radius:8px}
  .r-ask{margin-top:24px;background:${c.ink};color:#fff;font-size:44px;line-height:1.45;padding:26px 30px;border-radius:24px}
  .r-ask b{color:${c.ink}}
  .r-kw{margin-top:20px;font-size:42px}
  .r-kw b{background:${c.hl};padding:0 10px}
  .coupons{display:flex;gap:18px}
  .coupons span{flex:1;text-align:center;font-size:38px;border:4px dashed ${c.ink};border-radius:16px;padding:18px 8px}
  .r-thanks{text-align:center;font-size:38px;margin-top:22px;color:#555}
  .barcode{margin-top:auto;padding-top:22px;text-align:center}
  .bars{height:80px;margin:0 60px;background:repeating-linear-gradient(90deg,${c.ink} 0 4px,transparent 4px 7px,${c.ink} 7px 9px,transparent 9px 14px,${c.ink} 14px 20px,transparent 20px 23px)}
  .bc{font-size:26px;color:#777;margin-top:8px;letter-spacing:2px}
  mark{color:inherit}
  .credit{position:absolute;right:28px;bottom:16px;font-size:22px;color:rgba(255,255,255,.7);text-shadow:0 1px 2px #000}
  </style></head><body>${body}</body></html>`;
}
