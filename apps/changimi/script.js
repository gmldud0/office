'use strict';
// 챙김이 시제품 스크립트 (순수 JS, localStorage 사용)

const KEY = 'changimi-v1';
const NOTICE_KEY = 'changimi-notice-seen';
const KINDS = ['전체', '준비물', '장보기', '여행'];
const COLORS = { '준비물': 'var(--c-prep)', '장보기': 'var(--c-shop)', '여행': 'var(--c-trip)', '전체': 'var(--c-all)' };

let lists = [];
let filter = '전체';
let openId = null;
let saveFailed = false;
let noticeSeenMem = false; // 저장 실패 시 메모리용

const $ = (id) => document.getElementById(id);

// ---------- 샘플 데이터 ----------
function mk(texts, doneCount, group) {
  return texts.map((t, i) => ({ text: t, done: i < doneCount, group: group ? group(i) : '' }));
}
function sampleRemind() { // 내일 오전 7:30에 울리는 실제 알림
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(7, 30, 0, 0);
  const at = d.getTime();
  return { remindOn: true, remindAt: at, notified: false, alarm: fmtRemind(at) };
}
function sample() {
  const now = Date.now();
  const trip = ['여권(신분증)', '항공권', '숙소 예약 확인', '옷 2벌', '속옷·양말', '세면도구', '선크림',
    '휴대폰 충전기', '보조배터리', '이어폰', '카메라', '우산'];
  return [
    { id: 'a1', name: '제주 1박 2일 짐', kind: '여행', created: now - 1000, ...sampleRemind(),
      items: mk(trip, 3, (i) => (i < 3 ? '서류' : i < 7 ? '생활' : '전자기기')) },
    { id: 'a2', name: '이번 주 장보기', kind: '장보기', created: now - 2000, alarm: '',
      items: mk(['우유', '계란', '두부', '대파', '사과'], 5) },
    { id: 'a3', name: '내일 학교 준비물', kind: '준비물', created: now - 3000, alarm: '',
      items: mk(['교과서', '필통', '체육복', '실내화', '물통', '과제물'], 2) },
    { id: 'a4', name: '캠핑 준비', kind: '여행', created: now - 4000, alarm: '', items: [] }
  ];
}

// ---------- 저장/불러오기 ----------
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d)) return d;
    }
  } catch (e) { saveFailed = true; }
  const s = sample();
  return s;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(lists));
    saveFailed = false;
  } catch (e) { saveFailed = true; }
  $('saveError').hidden = !saveFailed;
}

// ---------- 유틸 ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; // 사용자 문자열은 textContent로만
  return e;
}
function counts(l) {
  return { done: l.items.filter((i) => i.done).length, total: l.items.length };
}
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}
// ---------- 화면 전환 ----------
const SCREENS = ['home', 'detail', 'create', 'templates', 'archive', 'settings'];
const TAB_SCREENS = ['home', 'templates', 'settings'];
function showScreen(name) {
  SCREENS.forEach((id) => { $(id).hidden = id !== name; });
  $('tabbar').hidden = !TAB_SCREENS.includes(name);
  document.querySelectorAll('#tabbar .tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  $(name).scrollTop = 0;
}
function goTab(name) {
  closeMenu(false);
  if (name === 'home') { showScreen('home'); renderHome(); }
  if (name === 'templates') { showScreen('templates'); renderTemplates(); }
  if (name === 'settings') { showScreen('settings'); renderSettings(); }
}

// ---------- 알림(리마인더) 유틸 ----------
// 필드: remindOn(boolean), remindAt(ms | null), notified(false | 발송 시각 ms | -1=조용히 처리)
// 이 필드가 없는 기존 리스트(alarm 문자열만 있음)는 알림 없이 문자열만 표시한다.
const CHECK_MS = 20000;               // 주기 확인 간격
const STALE_MS = 24 * 60 * 60 * 1000; // 이보다 오래 지난 알림은 조용히 처리
const MISSED_MS = 10 * 60 * 1000;     // 이보다 늦게 발견하면 '놓친 알림'으로 표시
const sentKeys = new Set();           // 저장 실패해도 같은 세션 중복 방지

const pad2 = (n) => String(n).padStart(2, '0');
function ymd(ts) { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function hm(ts) { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function fmtClock(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + pad2(d.getMinutes());
}
function fmtRemind(ts) { // 예: '11월 25일 오후 7:30' (다른 해면 연도 포함)
  const d = new Date(ts);
  const y = d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '년 ' : '';
  return y + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + fmtClock(ts);
}
function parseLocal(dateStr, timeStr) { // 'YYYY-MM-DD' + 'HH:MM' -> ms (잘못되면 null)
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const b = /^(\d{2}):(\d{2})/.exec(timeStr);
  if (!a || !b) return null;
  const [y, m, d, hh, mi] = [+a[1], +a[2], +a[3], +b[1], +b[2]];
  const dt = new Date(y, m - 1, d, hh, mi, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d || dt.getHours() !== hh) return null;
  return dt.getTime();
}
const hasRemind = (l) => !!l && l.remindOn === true && typeof l.remindAt === 'number' && isFinite(l.remindAt);

// 카드/상세에 표시할 알림 문구. 없으면 ''.
function reminderLabel(l, now) {
  now = typeof now === 'number' ? now : Date.now();
  if (hasRemind(l)) {
    let s = '🔔 ' + fmtRemind(l.remindAt);
    if (typeof l.notified === 'number' && l.notified > 0) s += ' · 발송됨';
    else if (l.notified || l.remindAt <= now) s += ' · 지남';
    return s;
  }
  // 레거시: alarm 문자열만 있는 기존 데이터(알림 기능 이전)는 그대로 표시
  if (typeof l.remindAt !== 'number' && l.remindOn !== true && typeof l.alarm === 'string' && l.alarm) return '🔔 ' + l.alarm;
  return '';
}
const reminderPast = (l, now) => hasRemind(l) && (l.notified || l.remindAt <= (now || Date.now()));

// ---------- 홈 ----------
function renderChips() {
  const box = $('chips');
  box.textContent = '';
  KINDS.forEach((k) => {
    const b = el('button', 'chip', k);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(k === filter));
    b.addEventListener('click', () => { filter = k; renderHome(); });
    box.appendChild(b);
  });
}

function renderHome() {
  closeMenu(false);
  renderChips();
  const box = $('cards');
  box.textContent = '';
  if (lists.length === 0) {
    const w = el('div', 'empty');
    w.appendChild(el('p', '', '아직 리스트가 없어요. + 버튼을 눌러 첫 리스트를 만들어 보세요.'));
    const b = el('button', 'primary', '첫 리스트 만들기');
    b.type = 'button';
    b.addEventListener('click', openCreate);
    w.appendChild(b);
    box.appendChild(w);
    return;
  }
  const active = lists.filter((l) => !l.archived);
  if (active.length === 0) {
    const w = el('div', 'empty');
    w.appendChild(el('p', '', '진행 중인 리스트가 없어요. 보관함에 ' + (lists.length) + '개가 있어요.'));
    const b = el('button', 'primary', '새 리스트 만들기');
    b.type = 'button';
    b.addEventListener('click', openCreate);
    w.appendChild(b);
    box.appendChild(w);
    return;
  }
  const shown = active.filter((l) => filter === '전체' || l.kind === filter)
    .sort((a, b) => b.created - a.created); // 최근 만든 순
  if (shown.length === 0) {
    box.appendChild(el('div', 'empty', '이 종류의 리스트가 아직 없어요.'));
    return;
  }
  shown.forEach((l) => {
    const { done, total } = counts(l);
    const wrap = el('div', 'card-wrap');
    const c = el('button', 'card');
    c.type = 'button';
    c.style.setProperty('--accent', COLORS[l.kind] || COLORS['전체']);
    const row = el('div', 'row');
    row.appendChild(el('span', 'name', l.name));
    const bellText = reminderLabel(l);
    if (bellText) row.appendChild(el('span', '', '🔔'));
    c.appendChild(row);
    const sub = el('div', 'sub');
    sub.appendChild(el('span', 'tag', l.kind));
    sub.appendChild(document.createTextNode(' · ' + done + '/' + total));
    c.appendChild(sub);
    if (total === 0) {
      c.appendChild(el('div', 'status', '항목 없음'));
    } else if (done === total) {
      c.appendChild(el('div', 'status done', '✓ 다 챙겼어요! (⋯ → 보관)'));
    }
    if (total > 0) {
      const bar = el('div', 'bar');
      const f = el('div', 'fill');
      f.style.width = Math.round((done / total) * 100) + '%';
      bar.appendChild(f);
      c.appendChild(bar);
    }
    if (bellText) c.appendChild(el('div', reminderPast(l) ? 'bell past' : 'bell', bellText));
    c.addEventListener('click', () => openDetail(l.id));
    wrap.appendChild(c);
    const more = el('button', 'more-btn', '⋯');
    more.type = 'button';
    more.dataset.id = l.id;
    more.setAttribute('aria-label', '더보기');
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', () => toggleMenu(l, more, wrap));
    wrap.appendChild(more);
    box.appendChild(wrap);
  });
}

// ---------- 더보기 메뉴 ----------
let menuEl = null;
let menuBtn = null;
function closeMenu(focusBtn) {
  if (menuEl) menuEl.remove();
  if (menuBtn) {
    menuBtn.setAttribute('aria-expanded', 'false');
    if (focusBtn && menuBtn.isConnected) menuBtn.focus();
  }
  menuEl = null;
  menuBtn = null;
}
function toggleMenu(l, btn, wrap) {
  const same = menuBtn === btn;
  closeMenu(false);
  if (same) return;
  const m = el('div', 'menu');
  m.setAttribute('role', 'menu');
  m.setAttribute('aria-label', l.name + ' 메뉴');
  const edit = el('button', 'menu-item', '수정');
  const arch = el('button', 'menu-item', '보관');
  const del = el('button', 'menu-item danger', '삭제');
  const items = [edit, arch, del];
  items.forEach((b) => { b.type = 'button'; b.setAttribute('role', 'menuitem'); m.appendChild(b); });
  edit.addEventListener('click', () => { closeMenu(false); openEdit(l.id); });
  arch.addEventListener('click', () => { closeMenu(false); archiveList(l.id); });
  del.addEventListener('click', () => { closeMenu(false); deleteList(l.id); });
  m.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
  });
  wrap.appendChild(m);
  btn.setAttribute('aria-expanded', 'true');
  menuEl = m;
  menuBtn = btn;
  // 아래쪽 공간이 부족하면(하단 탭바에 가려질 때) 위로 펼침
  const fr = document.querySelector('.frame').getBoundingClientRect();
  const r = m.getBoundingClientRect();
  if (r.height && r.bottom > fr.bottom - 70) m.classList.add('up');
  edit.focus();
}

function deleteList(id) {
  const idx = lists.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const l = lists[idx];
  if (typeof window.confirm !== 'function' || !window.confirm('정말 삭제하시겠습니까?\n\n“' + l.name + '”')) {
    const b = document.querySelector('.more-btn[data-id="' + id + '"]');
    if (b) b.focus();
    return;
  }
  lists.splice(idx, 1);
  save();
  if (saveFailed) {
    lists.splice(idx, 0, l); // 저장 실패: 되돌림
    toast('삭제하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.');
    return;
  }
  renderHome();
  toast('리스트를 삭제했어요.');
}

// ---------- 상세 ----------
function openDetail(id) {
  openId = id;
  showScreen('detail');
  renderDetail();
  $('backBtn').focus();
}
function closeDetail() {
  openId = null;
  showScreen('home');
  renderHome();
}

function renderDetail() {
  const l = lists.find((x) => x.id === openId);
  if (!l) return closeDetail();
  const accent = COLORS[l.kind] || COLORS['전체'];
  $('detailTitle').textContent = l.name;
  $('detailHead').style.setProperty('--accent', accent);
  updateProgress(l);

  const box = $('items');
  box.textContent = '';
  if (l.items.length === 0) {
    box.appendChild(el('div', 'empty', '항목 없음'));
    return;
  }
  let lastGroup = null;
  l.items.forEach((it, idx) => {
    if (it.group && it.group !== lastGroup) box.appendChild(el('h2', 'group-title', it.group));
    lastGroup = it.group;
    const b = el('button', 'item');
    b.type = 'button';
    b.setAttribute('role', 'checkbox');
    b.setAttribute('aria-checked', String(it.done));
    b.style.setProperty('--accent', accent);
    b.appendChild(el('span', 'box', it.done ? '✓' : ''));
    b.appendChild(el('span', 'label', it.text));
    b.addEventListener('click', () => {
      it.done = !it.done; // 완료/미완료 토글
      save();
      b.setAttribute('aria-checked', String(it.done));
      b.firstChild.textContent = it.done ? '✓' : '';
      updateProgress(l);
    });
    box.appendChild(b);
  });
}

function updateProgress(l) {
  const { done, total } = counts(l);
  let msg = l.kind + ' · ' + done + '/' + total;
  if (total > 0 && done === total) msg += ' · ✓ 다 챙겼어요!';
  const bt = reminderLabel(l);
  if (bt) msg += ' · ' + bt;
  $('detailMeta').textContent = msg;
  $('detailFill').style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
  $('detailFill').parentNode.style.display = total ? '' : 'none';
}

// ---------- 새 체크리스트 만들기 ----------
const CREATE_KINDS = ['준비물', '장보기', '여행'];
let draftKind = '준비물';
let draftItems = [];
let creating = false; // 만들기 화면이 열려 있는지
let editingId = null; // 수정 모드일 때 대상 리스트 id
let initialSig = ''; // 수정 시작 시점의 내용(변경 여부 판단)
// draftItems: [{ text, ref }] — ref는 수정 모드에서 원본 항목 객체(새 항목은 null)

function renderKindChips() {
  const box = $('kindChips');
  box.textContent = '';
  CREATE_KINDS.forEach((k) => {
    const b = el('button', 'chip', k);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(k === draftKind));
    b.tabIndex = k === draftKind ? 0 : -1;
    b.addEventListener('click', () => { draftKind = k; renderKindChips(); });
    b.addEventListener('keydown', (e) => {
      const i = CREATE_KINDS.indexOf(k);
      let n = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % CREATE_KINDS.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + CREATE_KINDS.length - 1) % CREATE_KINDS.length;
      if (n < 0) return;
      e.preventDefault();
      draftKind = CREATE_KINDS[n];
      renderKindChips();
      $('kindChips').children[n].focus();
    });
    box.appendChild(b);
  });
}

function renderDraft() {
  const ul = $('draftItems');
  ul.textContent = '';
  draftItems.forEach((it, i) => {
    const li = el('li');
    if (editingId) {
      const inp = el('input', 'edit-input');
      inp.type = 'text';
      inp.maxLength = 60;
      inp.value = it.text;
      inp.autocomplete = 'off';
      inp.setAttribute('aria-label', (i + 1) + '번째 항목 이름');
      inp.addEventListener('input', () => { it.text = inp.value; });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); $('itemInput').focus(); }
      });
      li.appendChild(inp);
    } else {
      li.appendChild(el('span', 'label', it.text));
    }
    const d = el('button', 'del', '✕');
    d.type = 'button';
    d.setAttribute('aria-label', (it.text || (i + 1) + '번째') + ' 항목 삭제');
    d.addEventListener('click', () => {
      draftItems.splice(i, 1);
      renderDraft();
      $('itemInput').focus();
    });
    li.appendChild(d);
    ul.appendChild(li);
  });
  $('itemCount').textContent = '(' + draftItems.length + '개)';
}

function setTitleError(msg) {
  $('titleErr').textContent = msg;
  if (msg) $('titleInput').setAttribute('aria-invalid', 'true');
  else $('titleInput').removeAttribute('aria-invalid');
}

function addDraftItem() {
  const inp = $('itemInput');
  const t = inp.value.trim();
  if (t) { draftItems.push({ text: t, ref: null }); renderDraft(); }
  inp.value = '';
  inp.focus();
  const box = document.querySelector('#create .form-body');
  if (t && box) box.scrollTop = box.scrollHeight;
}

function formSig() {
  return JSON.stringify([$('titleInput').value.trim(), draftKind, draftItems.map((d) => [d.text, d.ref ? 1 : 0]),
    draftRemindOn, $('remindDate').value, $('remindTime').value]);
}

// ---------- 폼의 알림 섹션 ----------
let draftRemindOn = false;
let remindReq = 0;        // 권한 요청 응답이 늦게 와도 폼이 바뀌었으면 무시하기 위한 토큰
let remindPending = false;
const notifSupported = () => typeof window.Notification === 'function';

function setRemindUI(on) {
  draftRemindOn = on;
  $('remindToggle').setAttribute('aria-checked', String(on));
  $('remindFields').hidden = !on;
  $('remindDate').disabled = !on;
  $('remindTime').disabled = !on;
}
function setRemindMsg(msg) { $('remindMsg').textContent = msg || ''; }
function setRemindError(msg, focusId) {
  $('remindErr').textContent = msg || '';
  ['remindDate', 'remindTime'].forEach((id) => {
    if (msg) $(id).setAttribute('aria-invalid', 'true'); else $(id).removeAttribute('aria-invalid');
  });
  if (msg && focusId) $(focusId).focus();
}
function permissionHint() {
  if (!notifSupported()) return '이 브라우저는 알림을 지원하지 않아요. 알림 시각은 저장되지만 알림은 오지 않아요.';
  if (window.Notification.permission === 'denied') return '브라우저에서 알림이 차단돼 있어요. 주소창의 사이트 설정에서 알림을 허용해 주세요.';
  return '';
}

function onRemindToggle() {
  if (remindPending) return;
  setRemindError('');
  if (draftRemindOn) { setRemindUI(false); setRemindMsg(''); return; }
  if (!notifSupported()) {
    setRemindUI(false);
    setRemindMsg('이 브라우저는 알림을 지원하지 않아 알림을 켤 수 없어요. 다른 기능은 그대로 쓸 수 있어요.');
    return;
  }
  const N = window.Notification;
  if (N.permission === 'granted') { setRemindUI(true); setRemindMsg(''); return; }
  if (N.permission === 'denied') {
    setRemindUI(false);
    setRemindMsg('브라우저에서 알림이 차단돼 있어요. 주소창의 사이트 설정에서 알림을 허용한 뒤 다시 켜 주세요.');
    return;
  }
  // 'default': 이 클릭 이벤트 안에서만 권한을 요청한다 (Promise/콜백 두 형태 모두 처리)
  const token = ++remindReq;
  remindPending = true;
  $('remindToggle').setAttribute('aria-busy', 'true');
  setRemindMsg('브라우저의 알림 허용 창에서 “허용”을 눌러 주세요.');
  let settled = false;
  const finish = (perm) => {
    if (settled) return;
    settled = true;
    remindPending = false;
    $('remindToggle').removeAttribute('aria-busy');
    if (token !== remindReq || !creating) return;
    const p = perm || N.permission;
    if (p === 'granted') { setRemindUI(true); setRemindMsg(''); return; }
    setRemindUI(false);
    setRemindMsg(p === 'denied'
      ? '알림이 차단됐어요. 주소창의 사이트 설정에서 알림을 허용하면 켤 수 있어요.'
      : '알림을 허용하지 않아 켜지 못했어요. 다시 켜면 허용 창이 한 번 더 나와요.');
  };
  try {
    const r = N.requestPermission(finish);
    if (r && typeof r.then === 'function') r.then(finish, () => finish('denied'));
  } catch (e) { finish('denied'); }
}

// 폼 값 검증. 문제 있으면 null(오류 표시), 아니면 { on, at }
function readRemind(l) {
  if (!draftRemindOn) { setRemindError(''); return { on: false }; }
  const d = $('remindDate').value;
  const t = $('remindTime').value;
  if (!d || !t) {
    setRemindError(!d && !t ? '알림 날짜와 시간을 입력해 주세요.' : !d ? '알림 날짜를 입력해 주세요.' : '알림 시간을 입력해 주세요.',
      !d ? 'remindDate' : 'remindTime');
    return null;
  }
  const at = parseLocal(d, t);
  if (at === null) { setRemindError('올바른 날짜와 시간을 입력해 주세요.', 'remindDate'); return null; }
  const unchanged = hasRemind(l) && l.remindAt === at; // 기존 값 그대로면 과거여도 다른 수정은 저장 가능
  if (!unchanged && at <= Date.now()) {
    setRemindError('지난 시각에는 알림을 만들 수 없어요. 앞으로의 날짜와 시간을 골라 주세요.', 'remindDate');
    return null;
  }
  setRemindError('');
  return { on: true, at };
}
function remindSnapshot(l) { return { alarm: l.alarm, remindOn: l.remindOn, remindAt: l.remindAt, notified: l.notified }; }
function applyRemind(l, r) {
  if (r.on) {
    if (!hasRemind(l) || l.remindAt !== r.at) l.notified = false; // 시각이 바뀌면 다시 발송 가능
    l.remindOn = true;
    l.remindAt = r.at;
    l.alarm = fmtRemind(r.at);
    if (l.notified === undefined) l.notified = false;
    return;
  }
  if (typeof l.remindAt === 'number') { // 새 방식 데이터: 끄기(시각은 보존, 발송 안 함)
    l.remindOn = false;
    l.alarm = '';
  } else if (l.remindOn === undefined && l.alarm === undefined) { // 신규 리스트
    l.remindOn = false; l.remindAt = null; l.notified = false; l.alarm = '';
  } else if (l.remindOn === undefined && !l.alarm) { // 알림 없는 기존 리스트
    l.remindOn = false; l.remindAt = null; l.notified = false;
  } // 그 외(레거시 alarm 문자열)는 건드리지 않음
}
function openCreate() { openForm(null); }
function openEdit(id) {
  const l = lists.find((x) => x.id === id);
  if (l) openForm(l);
}
function openForm(l) {
  closeMenu(false);
  editingId = l ? l.id : null;
  draftKind = l && CREATE_KINDS.includes(l.kind) ? l.kind : '준비물';
  draftItems = l ? l.items.map((it) => ({ text: it.text, ref: it })) : [];
  creating = true;
  $('createTitle').textContent = l ? '체크리스트 수정' : '새 체크리스트 만들기';
  $('saveBtn').textContent = l ? '수정 완료' : '저장';
  $('titleInput').value = l ? l.name : '';
  $('itemInput').value = '';
  $('titleCount').textContent = $('titleInput').value.length + '/30';
  setTitleError('');
  renderKindChips();
  renderDraft();
  remindReq++; // 이전 폼의 권한 응답 무효화
  remindPending = false;
  $('remindToggle').removeAttribute('aria-busy');
  $('remindDate').min = ymd(Date.now());
  const has = typeof (l && l.remindAt) === 'number';
  $('remindDate').value = has ? ymd(l.remindAt) : '';
  $('remindTime').value = has ? hm(l.remindAt) : '';
  setRemindUI(hasRemind(l));
  setRemindError('');
  setRemindMsg(draftRemindOn ? permissionHint() : '');
  showScreen('create');
  $('createForm').querySelector('.form-body').scrollTop = 0;
  $('titleInput').focus();
  initialSig = formSig();
}

function closeCreate(force) {
  const wasEdit = editingId;
  const dirty = $('itemInput').value.trim() ||
    (wasEdit ? formSig() !== initialSig : ($('titleInput').value.trim() || draftItems.length));
  if (!force && dirty && typeof window.confirm === 'function' &&
      !window.confirm('작성 중인 내용이 사라져요. 나갈까요?')) return;
  creating = false;
  editingId = null;
  showScreen('home');
  renderHome();
  const back = wasEdit && document.querySelector('.more-btn[data-id="' + wasEdit + '"]');
  (back || $('fab')).focus();
}

function newId() {
  let id;
  do { id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  while (lists.some((l) => l.id === id));
  return id;
}

function submitEdit() {
  const l = lists.find((x) => x.id === editingId);
  if (!l) { closeCreate(true); return; }
  const name = $('titleInput').value.trim();
  if (!name) {
    setTitleError($('titleInput').value ? '공백만으로는 이름을 만들 수 없어요.' : '리스트 이름을 입력해 주세요.');
    $('titleInput').focus();
    return;
  }
  const remind = readRemind(l);
  if (!remind) return;
  const pending = $('itemInput').value.trim();
  const drafts = pending ? draftItems.concat({ text: pending, ref: null }) : draftItems.slice();
  const emptyAt = drafts.findIndex((d) => !d.text.trim());
  if (emptyAt >= 0) {
    toast('비어 있는 항목이 있어요. 이름을 입력하거나 ✕로 지워 주세요.');
    const inp = $('draftItems').querySelectorAll('.edit-input')[emptyAt];
    if (inp) inp.focus();
    return;
  }
  const prev = { name: l.name, kind: l.kind, items: l.items };
  const prevRemind = remindSnapshot(l);
  // 원본 항목은 done/group 등 모든 속성을 유지하고 이름만 갱신, 새 항목은 done:false
  l.name = name;
  l.kind = draftKind;
  l.items = drafts.map((d) => (d.ref
    ? Object.assign({}, d.ref, { text: d.text.trim() })
    : { text: d.text.trim(), done: false, group: '' }));
  applyRemind(l, remind);
  save();
  if (saveFailed) {
    l.name = prev.name; l.kind = prev.kind; l.items = prev.items; // 저장 실패: 되돌림
    Object.assign(l, prevRemind);
    toast('수정하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.');
    return;
  }
  let msg = '수정했어요.';
  if (filter !== '전체' && filter !== l.kind) {
    filter = l.kind; // 종류가 바뀌어도 수정한 리스트가 사라지지 않게 해당 탭으로 이동
    msg = '수정했어요. 종류가 바뀌어 "' + l.kind + '" 탭으로 이동했어요.';
  }
  closeCreate(true);
  toast(msg);
}

function submitCreate() {
  if (editingId) { submitEdit(); return; }
  const name = $('titleInput').value.trim();
  if (!name) {
    setTitleError($('titleInput').value ? '공백만으로는 이름을 만들 수 없어요.' : '리스트 이름을 입력해 주세요.');
    $('titleInput').focus();
    return;
  }
  const remind = readRemind(null);
  if (!remind) return;
  const pending = $('itemInput').value.trim(); // 쓰다 만 항목도 포함
  const texts = draftItems.map((d) => d.text);
  if (pending) texts.push(pending);
  const maxCreated = lists.reduce((m, l) => Math.max(m, Number(l.created) || 0), 0);
  const list = {
    id: newId(), name, kind: draftKind,
    created: Math.max(Date.now(), maxCreated + 1), // 항상 최상단
    alarm: '', remindOn: false, remindAt: null, notified: false,
    items: texts.map((text) => ({ text, done: false, group: '' }))
  };
  applyRemind(list, remind);
  lists.push(list);
  save();
  if (saveFailed) {
    lists.pop(); // 저장 실패: 메모리에서도 되돌리고 화면 유지
    toast('리스트를 만들지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.');
    return;
  }
  filter = '전체'; // 새 리스트가 바로 보이도록
  closeCreate(true);
  toast('리스트를 만들었어요.');
}

// ---------- 알림 발송 ----------
const reminderKey = (l) => l.id + ':' + l.remindAt;
const isDue = (l, now) => hasRemind(l) && !l.archived && !l.notified && l.remindAt <= now;

// 여러 탭 대비: 발송 직전에 localStorage의 최신 상태를 읽어 이미 처리됐는지 확인
function syncFromStorage(l) {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    const s = Array.isArray(d) && d.find((x) => x && x.id === l.id);
    if (s) {
      l.remindOn = s.remindOn; l.remindAt = s.remindAt; l.notified = s.notified; l.alarm = s.alarm;
    }
  } catch (e) { /* 읽기 실패 시 메모리 값 사용 */ }
}

function showReminder(l, at, missed) {
  const { done, total } = counts(l);
  const progress = total ? done + '/' + total + ' 챙겼어요' : '아직 항목이 없어요';
  const title = missed ? '챙김이 · 놓친 알림' : '챙김이 알림';
  const body = l.name + ' · ' + progress + (missed ? ' (예정: ' + fmtRemind(at) + ')' : '');
  const id = l.id;
  try {
    const n = new window.Notification(title, { body, tag: 'changimi-' + id + '-' + at });
    n.onclick = () => {
      try { window.focus(); } catch (e) { /* 무시 */ }
      try { n.close(); } catch (e) { /* 무시 */ }
      openFromNotification(id);
    };
    return true;
  } catch (e) {
    toast('🔔 ' + (l.name.length > 14 ? l.name.slice(0, 14) + '…' : l.name) + ' 알림 시간이에요');
    return false;
  }
}
function openFromNotification(id) {
  if (!lists.some((x) => x.id === id)) return;
  if (creating) {
    closeCreate(false); // 작성 중이면 확인 후 나감
    if (creating) return;
  }
  closeMenu(false);
  openDetail(id);
}

// 시간이 된 알림을 확인해 발송. 발송한 개수를 반환. now는 테스트용으로 주입 가능.
function checkReminders(now) {
  if (typeof now !== 'number' || !isFinite(now)) now = Date.now();
  let sent = 0;
  let changed = false;
  lists.forEach((l) => {
    if (!isDue(l, now)) return;
    const key = reminderKey(l);
    if (sentKeys.has(key)) { l.notified = l.notified || now; return; }
    syncFromStorage(l);
    if (!isDue(l, now)) return; // 다른 탭이 이미 처리/수정함
    const late = now - l.remindAt;
    if (late > STALE_MS) { // 너무 오래된 알림: 조용히 처리(표시 안 함)
      sentKeys.add(key);
      l.notified = -1;
      save();
      changed = true;
      return;
    }
    const N = window.Notification;
    if (typeof N !== 'function' || N.permission !== 'granted') return; // 권한 없으면 보류
    sentKeys.add(key);   // 메모리 먼저(저장 실패 대비)
    l.notified = now;    // 저장을 먼저 하고
    save();
    showReminder(l, l.remindAt, late > MISSED_MS); // 그 다음 표시
    sent++;
    changed = true;
  });
  if (changed) {
    if (!creating && !$('home').hidden) renderHome();
    if (!$('archive').hidden) renderArchive();
    if (openId && !$('detail').hidden) {
      const cur = lists.find((x) => x.id === openId);
      if (cur) updateProgress(cur);
    }
  }
  return sent;
}

// ---------- 보관함 ----------
function archiveList(id) {
  const l = lists.find((x) => x.id === id);
  if (!l) return;
  l.archived = true;
  l.archivedAt = Date.now();
  save();
  if (saveFailed) { l.archived = false; toast('보관하지 못했어요. 저장 공간을 확인해 주세요.'); return; }
  renderHome();
  toast('보관함으로 옮겼어요. 오른쪽 위 📦에서 볼 수 있어요.');
}
function openArchive() { closeMenu(false); showScreen('archive'); renderArchive(); $('archiveBack').focus(); }
function renderArchive() {
  const box = $('archiveList');
  box.textContent = '';
  const arr = lists.filter((l) => l.archived).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  if (arr.length === 0) { box.appendChild(el('div', 'empty', '보관한 리스트가 없어요. 홈에서 ⋯ → 보관을 누르면 여기로 와요.')); return; }
  arr.forEach((l) => {
    const { done, total } = counts(l);
    const c = el('div', 'card');
    c.style.setProperty('--accent', COLORS[l.kind] || COLORS['전체']);
    c.appendChild(el('div', 'name', l.name));
    const sub = el('div', 'sub');
    sub.appendChild(el('span', 'tag', l.kind));
    sub.appendChild(document.createTextNode(' · ' + done + '/' + total + (l.archivedAt ? ' · ' + fmtRemind(l.archivedAt) + ' 보관' : '')));
    c.appendChild(sub);
    const row = el('div', 'card-actions');
    const reuse = el('button', 'ghost-btn small', '다시 쓰기');
    const del = el('button', 'ghost-btn small danger', '삭제');
    [reuse, del].forEach((b) => { b.type = 'button'; row.appendChild(b); });
    reuse.addEventListener('click', () => reuseList(l.id));
    del.addEventListener('click', () => {
      if (typeof window.confirm === 'function' && !window.confirm('정말 삭제하시겠습니까?\n\n“' + l.name + '”')) return;
      lists = lists.filter((x) => x.id !== l.id);
      save(); renderArchive(); toast('리스트를 삭제했어요.');
    });
    c.appendChild(row);
    box.appendChild(c);
  });
}
function reuseList(id) {
  const l = lists.find((x) => x.id === id);
  if (!l) return;
  l.archived = false;
  delete l.archivedAt;
  l.items.forEach((it) => { it.done = false; }); // 체크를 모두 풀고 다시 시작
  l.remindOn = false; l.remindAt = null; l.notified = false; l.alarm = '';
  l.created = Math.max(Date.now(), lists.reduce((m, x) => Math.max(m, Number(x.created) || 0), 0) + 1);
  save();
  filter = '전체';
  showScreen('home'); renderHome();
  toast('“' + l.name + '”을(를) 다시 꺼냈어요. 알림은 수정에서 새로 정해 주세요.');
}

// ---------- 템플릿 ----------
const TEMPLATES = [
  { icon: '🧳', name: '1박 2일 여행', kind: '여행', items: ['신분증', '휴대폰 충전기', '보조배터리', '지갑·카드', '갈아입을 옷', '속옷·양말', '잠옷', '세면도구', '화장품·선크림', '상비약', '우산'] },
  { icon: '✈️', name: '해외여행', kind: '여행', items: ['여권', '항공권(모바일)', '숙소 예약 확인', '환전·카드', '유심·eSIM', '멀티 어댑터', '휴대폰 충전기', '보조배터리', '상비약', '여행자 보험', '옷·속옷', '세면도구'] },
  { icon: '⛺', name: '캠핑', kind: '여행', items: ['텐트', '침낭', '매트', '랜턴', '의자·테이블', '버너·가스', '코펠·식기', '아이스박스', '장작·착화제', '물티슈', '쓰레기봉투', '모기 퇴치제'] },
  { icon: '💼', name: '출장', kind: '준비물', items: ['노트북', '노트북 충전기', '명함', '발표 자료', '신분증', '정장·셔츠', '구두', '휴대폰 충전기', '세면도구', '영수증 봉투'] },
  { icon: '🏋️', name: '운동 가방', kind: '준비물', items: ['운동복', '운동화', '수건', '물병', '이어폰', '샤워용품', '갈아입을 속옷', '로커 자물쇠'] },
  { icon: '🛒', name: '일주일 장보기', kind: '장보기', items: ['쌀', '계란', '우유', '두부', '양파', '대파', '고기', '과일', '라면', '휴지'] },
  { icon: '📦', name: '이사 준비', kind: '준비물', items: ['이삿짐센터 예약', '전입신고', '인터넷 이전 신청', '도시가스 정산', '관리비 정산', '우편물 주소 변경', '박스·테이프', '청소 도구'] }
];
function renderTemplates() {
  const box = $('tplList');
  box.textContent = '';
  TEMPLATES.forEach((t) => {
    const c = el('button', 'card');
    c.type = 'button';
    c.style.setProperty('--accent', COLORS[t.kind] || COLORS['전체']);
    const row = el('div', 'row');
    row.appendChild(el('span', 'name', t.icon + ' ' + t.name));
    c.appendChild(row);
    const sub = el('div', 'sub');
    sub.appendChild(el('span', 'tag', t.kind));
    sub.appendChild(document.createTextNode(' · 항목 ' + t.items.length + '개'));
    c.appendChild(sub);
    c.appendChild(el('div', 'status', t.items.slice(0, 4).join(', ') + ' …'));
    c.addEventListener('click', () => openTemplate(t));
    box.appendChild(c);
  });
}
function openTemplate(t) {
  openForm(null);
  $('titleInput').value = t.name;
  $('titleCount').textContent = t.name.length + '/30';
  draftKind = t.kind;
  draftItems = t.items.map((text) => ({ text, ref: null }));
  renderKindChips();
  renderDraft();
  initialSig = ''; // 템플릿에서 시작하면 닫을 때 확인 창을 띄움
  toast('템플릿 항목을 채웠어요. 필요 없는 건 ✕로 빼 주세요.');
}

// ---------- 설정 ----------
function permText() {
  if (!notifSupported()) return '지원 안 함';
  return { granted: '허용됨 ✅', denied: '차단됨 ⛔', default: '아직 안 정함' }[window.Notification.permission] || '알 수 없음';
}
function renderSettings() {
  $('permState').textContent = permText();
  $('permBtn').hidden = !notifSupported() || window.Notification.permission !== 'default';
  $('statLists').textContent = lists.filter((l) => !l.archived).length + '개';
  $('statArchived').textContent = lists.filter((l) => l.archived).length + '개';
  if (notifSupported() && window.Notification.permission === 'denied') {
    $('testMsg').textContent = '브라우저에서 알림이 차단돼 있어요. 주소창 왼쪽 아이콘 → 사이트 설정 → 알림을 "허용"으로 바꿔 주세요.';
  }
}
function requestPerm() {
  if (!notifSupported()) return;
  const done = () => renderSettings();
  try {
    const r = window.Notification.requestPermission(done);
    if (r && typeof r.then === 'function') r.then(done, done);
  } catch (e) { done(); }
}
let testTimer = null;
function testNotification() {
  if (!notifSupported()) { $('testMsg').textContent = '이 브라우저는 알림을 지원하지 않아요.'; return; }
  if (window.Notification.permission !== 'granted') {
    $('testMsg').textContent = '먼저 "알림 허용하기"를 눌러 알림을 허용해 주세요.';
    if (window.Notification.permission === 'default') requestPerm();
    return;
  }
  clearTimeout(testTimer);
  $('testMsg').textContent = '5초 뒤에 알림이 와요. 이 화면을 닫지 마세요.';
  testTimer = setTimeout(() => {
    try {
      new window.Notification('챙김이 알림 테스트', { body: '알림이 잘 와요! 정해 둔 시각에도 이렇게 알려 드려요.', tag: 'changimi-test' });
      $('testMsg').textContent = '알림을 보냈어요. 화면에 안 보였다면 기기의 방해 금지·집중 모드를 확인해 주세요.';
    } catch (e) {
      toast('🔔 챙김이 알림 테스트');
      $('testMsg').textContent = '이 환경에서는 시스템 알림을 띄울 수 없어 화면 안 알림으로 대신했어요.';
    }
  }, 5000);
}
function exportData() {
  const data = { app: 'changimi', version: 1, exportedAt: new Date().toISOString(), lists };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'changimi-backup-' + ymd(Date.now()) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('dataMsg').textContent = '백업 파일을 내려받았어요. 안전한 곳에 보관해 주세요.';
}
function cleanList(x) { // 불러온 데이터를 안전한 형태로 정리
  if (!x || typeof x !== 'object' || typeof x.name !== 'string' || !Array.isArray(x.items)) return null;
  const at = typeof x.remindAt === 'number' && isFinite(x.remindAt) ? x.remindAt : null;
  return {
    id: typeof x.id === 'string' && x.id ? x.id.slice(0, 40) : newId(),
    name: x.name.slice(0, 30) || '이름 없음',
    kind: CREATE_KINDS.includes(x.kind) ? x.kind : '준비물',
    created: Number(x.created) || Date.now(),
    alarm: typeof x.alarm === 'string' ? x.alarm.slice(0, 40) : '',
    remindOn: x.remindOn === true && at !== null, remindAt: at,
    notified: typeof x.notified === 'number' ? x.notified : false,
    archived: x.archived === true, archivedAt: Number(x.archivedAt) || undefined,
    items: x.items.filter((i) => i && typeof i.text === 'string').slice(0, 300)
      .map((i) => ({ text: i.text.slice(0, 60), done: i.done === true, group: typeof i.group === 'string' ? i.group.slice(0, 20) : '' }))
  };
}
function importData(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    let arr;
    try {
      const d = JSON.parse(r.result);
      arr = (Array.isArray(d) ? d : d && d.lists);
      if (!Array.isArray(arr)) throw new Error('bad');
    } catch (e) { $('dataMsg').textContent = '챙김이 백업 파일이 아니에요. 내보내기로 만든 .json 파일을 골라 주세요.'; return; }
    const cleaned = arr.map(cleanList).filter(Boolean);
    if (typeof window.confirm === 'function' &&
        !window.confirm('지금 데이터를 백업 파일(리스트 ' + cleaned.length + '개)로 바꿀까요?\n지금 있는 리스트는 사라져요.')) return;
    const prev = lists;
    lists = cleaned;
    save();
    if (saveFailed) { lists = prev; $('dataMsg').textContent = '불러오지 못했어요. 저장 공간을 확인해 주세요.'; return; }
    renderSettings();
    $('dataMsg').textContent = '백업을 불러왔어요. 리스트 ' + cleaned.length + '개.';
  };
  r.onerror = () => { $('dataMsg').textContent = '파일을 읽지 못했어요.'; };
  r.readAsText(file);
}
function resetData() {
  if (typeof window.confirm !== 'function' || !window.confirm('모든 리스트를 지울까요? 되돌릴 수 없어요.\n(필요하면 먼저 백업해 두세요)')) return;
  lists = [];
  save();
  renderSettings();
  $('dataMsg').textContent = '모든 데이터를 지웠어요.';
}

// ---------- 시작 ----------
function init() {
  lists = load();
  save();
  // 첫 실행 안내: 한 번만 표시
  let seen = noticeSeenMem;
  try { seen = localStorage.getItem(NOTICE_KEY) === '1'; } catch (e) { /* 메모리 사용 */ }
  $('notice').hidden = seen;
  $('noticeClose').addEventListener('click', () => {
    $('notice').hidden = true;
    noticeSeenMem = true;
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch (e) { /* 무시 */ }
  });
  $('backBtn').addEventListener('click', closeDetail);
  $('fab').addEventListener('click', openCreate);
  $('archiveBtn').addEventListener('click', openArchive);
  $('archiveBack').addEventListener('click', () => goTab('home'));
  document.querySelectorAll('#tabbar .tab').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.tab)));
  $('permBtn').addEventListener('click', requestPerm);
  $('testBtn').addEventListener('click', testNotification);
  $('exportBtn').addEventListener('click', exportData);
  $('importBtn').addEventListener('click', () => { $('importFile').value = ''; $('importFile').click(); });
  $('importFile').addEventListener('change', (e) => importData(e.target.files && e.target.files[0]));
  $('resetBtn').addEventListener('click', resetData);
  $('createClose').addEventListener('click', () => closeCreate(false));
  $('createForm').addEventListener('submit', (e) => { e.preventDefault(); submitCreate(); });
  $('titleInput').addEventListener('input', () => {
    $('titleCount').textContent = $('titleInput').value.length + '/30';
    if ($('titleInput').value.trim()) setTitleError('');
  });
  $('titleInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('itemInput').focus(); }
  });
  $('itemAdd').addEventListener('click', addDraftItem);
  $('itemInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addDraftItem(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (menuEl) { closeMenu(true); return; }
    if (creating) closeCreate(false);
    else if (openId) closeDetail();
    else if (!$('archive').hidden) goTab('home');
  });
  document.addEventListener('click', (e) => {
    if (menuEl && !menuEl.contains(e.target) && e.target !== menuBtn) closeMenu(false);
  });
  $('remindToggle').addEventListener('click', onRemindToggle);
  ['remindDate', 'remindTime'].forEach((id) => $(id).addEventListener('input', () => setRemindError('')));
  showScreen('home');
  renderHome();
  // 페이지가 열려 있는 동안만 동작 (권한 요청은 하지 않고 확인만 함)
  checkReminders();
  setInterval(() => checkReminders(), CHECK_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
  window.addEventListener('focus', () => checkReminders());
}
init();
