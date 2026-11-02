// 밥심 - 🏷️ 명판 (Nameplate) 경매
//
//  - 분기마다 한 번 열리는 경매. 1등은 돈으로는 살 수 없는 「명판」 배지를 영구히 받음
//    · 첫 경매(2026 4분기)는 특별히 11/2(월) ~ 11/8(일) 자정까지
//    · 그 다음부터는 매 분기 첫 7일 (1/1 · 4/1 · 7/1 · 10/1 0시 ~ 7일 뒤 0시)
//  - 시작가 30만P · 다음 입찰은 현재 최고가의 +10% 이상
//  - 입찰 즉시 포인트를 맡김(차감) → 더 높은 입찰이 오면 앞사람 돈은 자동 환급(bank/refunds) → 낙찰금은 전액 소각
//  - 명판 주인 혜택(영구): 명판 배지 · 펫 알 10% 할인 · 시즌 도감 「명판 명예의 전당」 등재 · 왼쪽 명판 배너에 이름
//  데이터: bank/nameplate/{회차 id}/top { nick, uid, amount, msg, badge, color, at } · /log · /granted

const PLATE_START = 300000;
const PLATE_STEP = 0.1;
const PLATE_BADGE = 'nb-plate';
const PLATE_FIRST = { id: '2026Q4', start: Date.parse('2026-11-02T00:00:00+09:00'), end: Date.parse('2026-11-09T00:00:00+09:00') };
let plateState = {}, plateLoaded = false;
let plateWatching = false;
function plateNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }

// 회차 계산: 지금 열려 있는 회차(없으면 null)와 다음 회차
function quarterRound(y, q) {
  const start = Date.parse(`${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01T00:00:00+09:00`);
  return { id: `${y}Q${q}`, start, end: start + 7 * 86400000 };
}
function plateRounds(ts = plateNow()) {
  if (ts < PLATE_FIRST.end) return { open: ts >= PLATE_FIRST.start ? PLATE_FIRST : null, next: PLATE_FIRST };
  const p = kstParts(ts);
  let y = p.y, q = Math.floor((p.m - 1) / 3) + 1;
  const r = quarterRound(y, q);
  if (r.id !== PLATE_FIRST.id && ts >= r.start && ts < r.end) return { open: r, next: r };
  q += 1; if (q > 4) { q = 1; y += 1; }
  return { open: null, next: quarterRound(y, q) };
}
function plateOpenRound() { return plateRounds().open; }
function roundLabel(id) { const m = /^(\d{4})Q(\d)$/.exec(id || ''); return m ? `${m[1]}년 ${m[2]}분기` : id; }
function plateWinners() {
  const now = plateNow();
  return Object.entries(plateState).filter(([id, v]) => v && v.top && v.top.uid && v.end && v.end <= now).map(([id, v]) => Object.assign({ round: id, end: v.end }, v.top)).sort((a, b) => (b.end || 0) - (a.end || 0));
}
// 명판 주인(역대 낙찰자)인지 — 펫 알 할인 등에 사용
function isPlateHolder() { return typeof authUser !== 'undefined' && !!authUser && plateWinners().some(w => w.uid === authUser.uid); }
function plateMinBid() {
  const r = plateOpenRound();
  const top = r && (plateState[r.id] || {}).top;
  return top ? Math.ceil(top.amount * (1 + PLATE_STEP) / 10000) * 10000 : PLATE_START;
}
function plateLeftText(to) { const left = Math.max(0, to - plateNow()); const d = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), m = Math.floor(left % 3600000 / 60000); return `${d ? `${d}일 ` : ''}${h}시간 ${m}분`; }
const PLATE_PERKS = [['🏷️', '돈으로는 살 수 없는 「명판」 배지 (영구)'], ['🥚', '펫 알 영구 10% 할인'], ['🏅', '시즌 도감 「명판 명예의 전당」 등재']];

function watchPlate() {
  if (plateWatching || typeof db === 'undefined') return;
  plateWatching = true;
  db.ref('bank/nameplate').on('value', s => {
    plateState = s.val() || {};
    plateLoaded = true;
    renderPlateBanner(); if (typeof renderLottoHero === 'function') renderLottoHero();
    renderPlateModal();
    claimPlateBadge();
  }, () => { plateWatching = false; });
}
setTimeout(watchPlate, 2000);
setInterval(() => { renderPlateBanner(); renderPlateModal(); claimPlateBadge(); checkPlateBadgeIntegrity(); }, 30000);

async function bidNameplate() {
  if (!checkApprovalGuard()) return;
  const r = plateOpenRound();
  if (!r) return alert(`지금은 경매 기간이 아니에요. 다음 경매: ${new Date(plateRounds().next.start).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  const amtEl = document.getElementById('plateBidAmount'), msgEl = document.getElementById('plateBidMsg');
  const min = plateMinBid();
  const amount = Math.floor(Number(String(amtEl && amtEl.value || '').replace(/[,\s]/g, '')) || 0);
  const msg = (msgEl && msgEl.value || '').trim().slice(0, 30);
  if (amount < min) return alert(`최소 ${min.toLocaleString()}P 이상 불러야 해요.`);
  if (amount > userPoints) return alert(`❌ 포인트가 부족해요! (보유 ${userPoints.toLocaleString()}P)`);
  if (!confirm(`🏷️ ${amount.toLocaleString()}P에 입찰할까요?\n\n· 지금 바로 포인트가 맡겨져요 (더 높은 입찰이 오면 자동 환급)\n· ${roundLabel(r.id)} 경매 마감 때 1등이면 「명판」 배지를 영구히 받아요`)) return;
  let prev = null, ok = false;
  try {
    const res = await db.ref(`bank/nameplate/${r.id}`).transaction(cur => {
      cur = cur || {};
      const top = cur.top;
      const need = top ? Math.ceil(top.amount * (1 + PLATE_STEP) / 10000) * 10000 : PLATE_START;
      if (amount < need) return undefined;
      prev = top || null;
      cur.end = r.end;
      cur.top = { nick: currentUser.nickname, uid: authUser.uid, amount, msg, badge: myNickBg || 'nb-none', color: myNickColor || '', at: plateNow() };
      return cur;
    });
    ok = res.committed;
  } catch (e) {}
  if (!ok) return alert('그 사이 더 높은 입찰이 들어왔어요. 금액을 다시 확인해 주세요. (결제되지 않았어요)');
  addPoints(-amount, `🏷️ 명판 경매 입찰 (${roundLabel(r.id)})`);
  updatePointsUI();
  if (prev && prev.nick && prev.amount > 0) db.ref(`bank/refunds/${prev.nick}`).push({ amt: prev.amount, reason: '명판 경매 상위 입찰로 환급' }).catch(() => {});
  db.ref(`bank/nameplate/${r.id}/log`).push({ nick: currentUser.nickname, amount, at: plateNow() }).catch(() => {});
  if (typeof postFeed === 'function') postFeed('plate', `🏷️ [${currentUser.nickname}] 님이 명판 경매에 ${amount.toLocaleString()}P를 불렀어요!`, amount >= 10000000 ? 'legendary' : 'big', true);
  if (amtEl) amtEl.value = '';
}

// 경매가 끝나면 1등 본인 화면이 배지를 받아감 (회차마다 한 번)
let plateClaiming = false;
async function claimPlateBadge() {
  if (plateClaiming || !plateLoaded || typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  const mine = plateWinners().filter(w => w.uid === authUser.uid && !(plateState[w.round] || {}).granted);
  if (!mine.length) return;
  plateClaiming = true;
  try {
    for (const w of mine) {
      const r = await db.ref(`bank/nameplate/${w.round}/granted`).transaction(g => g ? undefined : true);
      if (!r.committed) continue;
      if (!myInventory.bgs) myInventory.bgs = ['nb-none'];
      if (!myInventory.bgs.includes(PLATE_BADGE)) myInventory.bgs.push(PLATE_BADGE);
      if (!(typeof isChair === 'function' && isChair())) myNickBg = PLATE_BADGE;
      updatePointsUI();
      if (typeof postFeed === 'function') postFeed('plate', `🏷️ [${currentUser.nickname}] 님이 ${roundLabel(w.round)} 명판의 주인이 되었습니다 (${Number(w.amount).toLocaleString()}P 낙찰)`, 'legendary', true);
      if (window.confetti) confetti({ particleCount: 220, spread: 120, colors: ['#e5e7eb', '#fef3c7', '#d4af37', '#ffffff'] });
      alert(`🏷️ 축하해요! ${roundLabel(w.round)} 명판 경매에서 낙찰됐어요.\n돈으로는 살 수 없는 「명판」 배지를 영구히 받았어요. (바로 장착됨)`);
    }
  } catch (e) {} finally { plateClaiming = false; }
}
// 낙찰 기록 없이 명판 배지를 가진 경우(콘솔 조작) → 회수 + 숙청
function checkPlateBadgeIntegrity() {
  if (!plateLoaded || typeof myInventory === 'undefined' || (typeof isAdmin !== 'undefined' && isAdmin) || typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  const has = (myInventory.bgs || []).includes(PLATE_BADGE) || myNickBg === PLATE_BADGE;
  if (!has || isPlateHolder()) return;
  myInventory.bgs = (myInventory.bgs || []).filter(c => c !== PLATE_BADGE);
  if (myNickBg === PLATE_BADGE) myNickBg = 'nb-none';
  updatePointsUI();
  try { if (typeof reportTamper === 'function') reportTamper('낙찰 기록 없는 명판 배지'); } catch (e) {}
  if (typeof purgeTamperer === 'function') purgeTamperer('낙찰 기록 없는 명판 배지');
}

// ------------------------------------------------------------------
// 화면: 왼쪽 블랙 배너 밑 (작은 화면은 본문 위쪽에 작게)
// ------------------------------------------------------------------
function plateStatusHTML() {
  const { open, next } = plateRounds();
  if (open) {
    const top = (plateState[open.id] || {}).top;
    return `<div class="plate-side-status"><span class="plate-live">● 경매 진행 중</span> ${top ? `최고 <b>${top.amount.toLocaleString()}P</b>` : `<b>${(PLATE_START / 10000)}만P</b>부터`} · ${plateLeftText(open.end)} 남음</div>`;
  }
  return `<div class="plate-side-status">다음 경매 · ${new Date(next.start).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' })} (${roundLabel(next.id)})</div>`;
}
function renderPlateBanner() {
  const winners = plateWinners();
  const list = winners.length
    ? winners.map(w => `<div class="flex items-center justify-between gap-2">${nickHTML({ nickname: w.nick, badge: PLATE_BADGE, color: w.color }, 'text-xs')}<span class="text-[9px] text-slate-500 font-bold">${roundLabel(w.round)}</span></div>`).join('')
    : '<div class="text-[11px] text-slate-400 leading-relaxed">아직 명판에 새겨진 이름이 없습니다.<br><span class="text-[#e9dcb8]">첫 번째 주인이 되어보세요.</span></div>';
  ['plateSideCard', 'plateMiniCard'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const body = el.querySelector('.plate-side-body');
    if (body) body.innerHTML = `<div class="space-y-1.5">${list}</div>${plateStatusHTML()}`;
  });
}
function openPlateModal() { document.getElementById('plateModal').classList.remove('hidden'); renderPlateModal(); }
function closePlateModal() { document.getElementById('plateModal').classList.add('hidden'); }
function renderPlateModal() {
  const m = document.getElementById('plateModal');
  if (!m || m.classList.contains('hidden')) return;
  const { open, next } = plateRounds();
  const top = open && (plateState[open.id] || {}).top, min = plateMinBid();
  const box = document.getElementById('plateAuctionBox');
  if (box) box.innerHTML = `
    <div class="rounded-2xl plate-explain p-3.5 space-y-2">
      <div class="text-center"><span class="nb-plate text-sm">명판</span></div>
      <p class="text-[11px] text-slate-300 leading-relaxed text-center">분기에 단 한 번 열리는 경매. 가장 높게 부른 단 한 사람만<br><b class="text-[#f3e7c3]">돈으로는 살 수 없는 「명판」 배지</b>를 영구히 가질 수 있어요.</p>
      <ul class="text-[11px] text-[#e9dcb8] space-y-0.5">${PLATE_PERKS.map(([i, t]) => `<li>${i} ${t}</li>`).join('')}</ul>
      <p class="text-[10px] text-slate-500 text-center">입찰금은 바로 맡겨지고, 누가 더 높게 부르면 자동으로 돌려받아요</p>
    </div>
    ${open ? `
    <div class="rounded-2xl plate-card p-4 text-center space-y-1">
      <div class="text-[10px] font-black tracking-[0.25em] text-amber-800">${roundLabel(open.id)} 명판 경매</div>
      ${top ? `<div class="text-xs text-slate-500">현재 최고 입찰</div><div class="text-2xl font-black text-slate-900">${top.amount.toLocaleString()}P</div><div>${nickHTML({ nickname: top.nick, badge: top.badge, color: top.color }, 'text-xs')}</div>${top.msg ? `<div class="text-[11px] text-slate-500 italic">“${esc(top.msg)}”</div>` : ''}`
        : `<div class="text-sm font-black text-slate-700">아직 아무도 부르지 않았어요</div><div class="text-[11px] text-slate-500">시작가 ${PLATE_START.toLocaleString()}P</div>`}
      <div class="text-[11px] font-bold text-rose-600">⏳ 마감까지 ${plateLeftText(open.end)}</div>
    </div>
    <div class="space-y-1.5">
      <input id="plateBidAmount" type="number" min="${min}" step="10000" placeholder="입찰 금액 (최소 ${min.toLocaleString()}P)" class="w-full border rounded-xl p-2.5 text-sm font-black">
      <input id="plateBidMsg" type="text" maxlength="30" placeholder="명예의 전당에 남길 한마디 (선택 · 30자)" class="w-full border rounded-xl p-2.5 text-xs">
      <button onclick="bidNameplate()" class="w-full bg-slate-900 hover:bg-black text-[#f3e7c3] font-black py-2.5 rounded-xl text-xs border border-[#d4af37]/50">🏷️ 입찰하기 · 최소 ${min.toLocaleString()}P</button>
    </div>` : `<div class="rounded-2xl bg-slate-50 border p-4 text-center text-xs text-slate-600">지금은 경매 기간이 아니에요.<br><b>다음 경매: ${new Date(next.start).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })} (${roundLabel(next.id)})</b></div>`}`;
  const hist = document.getElementById('plateHistory');
  if (hist) hist.innerHTML = plateWinners().map(w => `<div class="flex items-center justify-between text-[11px] py-1 border-b border-slate-100"><span class="text-slate-400">${roundLabel(w.round)}</span><span>${nickHTML({ nickname: w.nick, badge: PLATE_BADGE, color: w.color }, 'text-[11px]')} <b class="text-amber-700">${Number(w.amount).toLocaleString()}P</b></span></div>`).join('')
    || '<div class="text-[11px] text-slate-400 text-center py-2">아직 명판의 주인이 없어요</div>';
}
