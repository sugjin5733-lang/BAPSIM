// 밥심 - 🏦 밥심 은행
//
//  💸 송금: 다른 회원에게 포인트 보내기 (transfers/{받는사람}/{id} → 받는 사람 화면이 열리면 자동 수령)
//  🎗️ 기부: 은행 금고에 기부, 누적 999,999P 이상이면 '천사의 날개' 배지 (프레스티지 상점에서 수령)
//  🏛️ 부자세: 매일(KST) 자산 1·2·3위에게 30,000 / 20,000 / 10,000P
//  🆘 재난지원금: 매일 '자산 최하위'(최근 3일 활동자)와 '전날 가장 많이 잃은 사람'에게 20,000P씩 (금고에서)
//
//  서버가 없으므로: 그날 첫 접속자가 정산표(bank/days/{날짜})를 한 번만 만들고,
//  각자 접속하면 자기 몫(세금 납부 / 지원금 수령)을 자동 처리함.
//
//  ⏳ 보류 포인트 지급 예정 시각도 여기서 계산해 헤더에 표시.

const TRANSFER_MIN = 100;
const DONOR_BADGE_GOAL = 999999;
const DONOR_BADGE = 'nb-angel';
const TAX_TABLE = [30000, 20000, 10000];
const RELIEF_AMOUNT = 20000;
const RELIEF_ACTIVE_DAYS = 3;
// '잃은 금액' 계산에서 빼는 항목 (게임이 아닌 소비/이동)
const NET_EXCLUDE = /상점|입장권|변경권|송금|기부|부자세|재난지원금|보류|환불|관리자|배지/;

let myDayNet = { d: '', v: 0, pd: '', pv: 0 };
let dayNetLoaded = false;
let bankState = { balance: 0, donors: {}, days: {} };
let bankRefs = [];
let bankTimer = null;
let bankBusy = false;
let prestigeMembers = [];

function bankNow() { return Date.now() + (typeof serverTimeOffset === 'number' ? serverTimeOffset : 0); }
function bankToday() { return todayKey(bankNow()); }
function prevDayKey(day) { return todayKey(new Date(`${day}T12:00:00+09:00`).getTime() - 86400000); }
function fmtP(n) { return `${Math.round(Number(n) || 0).toLocaleString()}P`; }

// ------------------------------------------------------------------
// 하루 손익 기록 (재난지원금 '가장 많이 잃은 사람' 판정용)
// ------------------------------------------------------------------
function rollDayNet() {
  const t = bankToday();
  if (myDayNet.d === t) return;
  const y = prevDayKey(t);
  myDayNet = myDayNet.d === y
    ? { d: t, v: 0, pd: y, pv: myDayNet.v }
    : { d: t, v: 0, pd: '', pv: 0 };
}
function trackDayNet(delta, reason) {
  if (!dayNetLoaded || NET_EXCLUDE.test(String(reason || ''))) return;
  rollDayNet();
  myDayNet.v += delta;
}
function loadBankFromUser(val) {
  if (dayNetLoaded) return; // 이 기기만 쓰는 값이라 처음 한 번만 읽음 (에코로 덮어쓰기 방지)
  const dn = val && val.dayNet;
  if (dn && typeof dn === 'object') {
    myDayNet = { d: String(dn.d || ''), v: Number(dn.v) || 0, pd: String(dn.pd || ''), pv: Number(dn.pv) || 0 };
  }
  dayNetLoaded = true;
  rollDayNet();
}
function netOnDay(u, day) {
  const dn = u && u.dayNet;
  if (!dn) return 0;
  if (dn.d === day) return Number(dn.v) || 0;
  if (dn.pd === day) return Number(dn.pv) || 0;
  return 0;
}

// ------------------------------------------------------------------
// 시작/정지
// ------------------------------------------------------------------
function initBank() {
  stopBank();
  if (!canSyncToCloud()) return;
  const me = currentUser.nickname;
  const on = (ref, ev, fn) => { ref.on(ev, fn, onDbError); bankRefs.push([ref, ev, fn]); };

  on(db.ref('bank/balance'), 'value', s => {
    bankState.balance = Number(s.val()) || 0;
    renderBankModal();
    scheduleBankDues(1500); // 금고가 채워지면 밀린 지원금 다시 시도
  });
  on(db.ref('bank/donors'), 'value', s => { bankState.donors = s.val() || {}; renderBankModal(); renderDonorBadgeBox(); });
  on(db.ref('bank/days').limitToLast(7), 'value', s => { bankState.days = s.val() || {}; renderBankModal(); scheduleBankDues(800); });
  on(db.ref(`transfers/${me}`), 'child_added', s => claimTransfer(s.ref));

  ensureDailySettlement();
  bankTimer = setInterval(() => { ensureDailySettlement(); processMyBankDues(); }, 5 * 60 * 1000);
  loadPrestigeMembers();
}
function stopBank() {
  bankRefs.forEach(([ref, ev, fn]) => ref.off(ev, fn));
  bankRefs = [];
  if (bankTimer) { clearInterval(bankTimer); bankTimer = null; }
  dayNetLoaded = false;
  myDayNet = { d: '', v: 0, pd: '', pv: 0 };
}

// ------------------------------------------------------------------
// 💸 송금
// ------------------------------------------------------------------
async function sendPoints() {
  if (!checkApprovalGuard()) return;
  const me = currentUser.nickname;
  const to = (document.getElementById('bankSendTo').value || '').trim();
  const amount = Math.floor(Number(document.getElementById('bankSendAmount').value) || 0);
  const msg = (document.getElementById('bankSendMsg').value || '').trim().slice(0, 50);
  if (!to) return alert('받는 사람 닉네임을 입력해 주세요.');
  if (to === me) return alert('자기 자신에게는 보낼 수 없어요.');
  if (amount < TRANSFER_MIN) return alert(`최소 ${TRANSFER_MIN.toLocaleString()}P부터 보낼 수 있어요.`);
  if (amount > userPoints) return alert(`❌ 포인트가 부족해요! (보유 ${fmtP(userPoints)})`);
  let target;
  try { target = (await db.ref(`user_points/${to}`).once('value')).val(); } catch (e) { target = null; }
  if (!target || !(target.status === 'approved' || target.approved === true)) return alert(`[${to}] 님을 찾을 수 없어요. 닉네임을 정확히 입력해 주세요.`);
  if (!confirm(`💸 [${to}] 님에게 ${fmtP(amount)}를 보낼까요?${msg ? `\n메모: ${msg}` : ''}\n\n※ 받는 사람의 포인트 한도에 따라 일부는 '보류'로 천천히 들어갈 수 있어요.`)) return;
  if (amount > userPoints) return alert('❌ 포인트가 부족해요!');
  try {
    await db.ref(`transfers/${to}`).push({ from: me, fromUid: authUser.uid, amount, msg, ts: firebase.database.ServerValue.TIMESTAMP });
  } catch (err) {
    return alert('송금에 실패했어요: ' + (err && err.message));
  }
  addPoints(-amount, `💸 송금 → ${to}`);
  updatePointsUI();
  document.getElementById('bankSendAmount').value = '';
  document.getElementById('bankSendMsg').value = '';
  bankToast('💸 송금 완료', `[${esc(to)}] 님에게 <strong>${fmtP(amount)}</strong>를 보냈어요.`);
}

async function claimTransfer(ref) {
  let got = null;
  try {
    const res = await ref.transaction(cur => {
      got = cur || null;
      return cur ? null : undefined; // 있으면 가져가면서 지움 (두 탭이 동시에 받아도 한 번만)
    });
    if (!res.committed || !got) return;
  } catch (e) { return; }
  const amt = Math.floor(Number(got.amount) || 0);
  if (amt <= 0) return;
  addPoints(amt, `💸 송금 ← ${String(got.from || '?').slice(0, 20)}`);
  updatePointsUI();
  bankToast('💸 포인트 도착!', `[${esc(got.from)}] 님이 <strong>${fmtP(amt)}</strong>를 보냈어요.${got.msg ? `<br>“${esc(got.msg)}”` : ''}`);
  if (window.confetti) confetti({ particleCount: 70, spread: 70 });
}

// ------------------------------------------------------------------
// 🎗️ 기부
// ------------------------------------------------------------------
async function donatePoints(preset) {
  if (!checkApprovalGuard()) return;
  const me = currentUser.nickname;
  const input = document.getElementById('bankDonateAmount');
  const amount = Math.floor(Number(preset || (input && input.value)) || 0);
  if (amount < TRANSFER_MIN) return alert(`최소 ${TRANSFER_MIN.toLocaleString()}P부터 기부할 수 있어요.`);
  if (amount > userPoints) return alert(`❌ 포인트가 부족해요! (보유 ${fmtP(userPoints)})`);
  if (!confirm(`🎗️ 밥심 은행에 ${fmtP(amount)}를 기부할까요?\n기부금은 재난지원금으로 쓰여요.`)) return;
  const before = Number(bankState.donors[me]) || 0;
  addPoints(-amount, '🎗️ 은행 기부');
  updatePointsUI();
  if (input) input.value = '';
  try {
    await db.ref('bank/balance').transaction(c => (Number(c) || 0) + amount);
    await db.ref(`bank/donors/${me}`).transaction(c => (Number(c) || 0) + amount);
  } catch (err) {
    console.warn('기부 기록 실패:', err && err.message);
  }
  const after = before + amount;
  if (before < DONOR_BADGE_GOAL && after >= DONOR_BADGE_GOAL) {
    if (window.confetti) confetti({ particleCount: 200, spread: 120, colors: ['#ffffff', '#fde68a', '#bae6fd'] });
    alert('😇 누적 기부 999,999P 달성!\n프레스티지 상점에서 [천사의 날개] 배지를 받을 수 있어요.');
    if (typeof postFeed === 'function') postFeed('donate', '😇 누적 기부 999,999P를 넘겨 천사의 날개를 얻었어요!', 'legendary', true);
  } else {
    bankToast('🎗️ 기부 감사합니다', `${fmtP(amount)} 기부 · 누적 ${fmtP(after)}`);
  }
}

function myDonated() { return Number(bankState.donors[currentUser.nickname]) || 0; }

function renderDonorBadgeBox() {
  const box = document.getElementById('prestigeDonorBox');
  if (!box) return;
  const total = canSyncToCloud() ? myDonated() : 0;
  const owned = (myInventory.bgs || []).includes(DONOR_BADGE);
  const equipped = myNickBg === DONOR_BADGE;
  const pct = Math.min(100, total / DONOR_BADGE_GOAL * 100);
  box.innerHTML = `
    <div class="rounded-2xl border border-sky-200/40 bg-gradient-to-br from-sky-300/10 to-transparent p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <span class="${DONOR_BADGE} text-xs inline-block">😇 천사의 날개 (기부 천사)</span>
          <p class="text-[10px] text-slate-300 mt-1">돈으로는 살 수 없는 배지 · 은행 누적 기부 ${fmtP(DONOR_BADGE_GOAL)} 이상이면 무료 수령</p>
        </div>
        ${equipped
          ? `<button onclick="unequipBg(); renderDonorBadgeBox()" class="shrink-0 bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl text-[11px]">해제</button>`
          : owned
            ? `<button onclick="equipBg('${DONOR_BADGE}'); renderDonorBadgeBox()" class="shrink-0 bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-xl text-[11px]">장착</button>`
            : total >= DONOR_BADGE_GOAL
              ? `<button onclick="claimDonorBadge()" class="shrink-0 bg-sky-300 text-slate-950 font-black px-3 py-1.5 rounded-xl text-[11px]">받기</button>`
              : `<button onclick="openBankModal('donate')" class="shrink-0 bg-white/10 border border-white/20 text-sky-100 font-bold px-3 py-1.5 rounded-xl text-[11px]">기부하러 가기</button>`}
      </div>
      ${owned ? '' : `<div class="h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full bg-sky-300" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="text-[10px] text-sky-100/80 text-right">내 누적 기부 ${fmtP(total)} / ${fmtP(DONOR_BADGE_GOAL)}</div>`}
    </div>`;
}

function claimDonorBadge() {
  if (!checkApprovalGuard()) return;
  if (myDonated() < DONOR_BADGE_GOAL) return alert('아직 누적 기부가 부족해요.');
  if (!myInventory.bgs) myInventory.bgs = ['nb-none'];
  if (!myInventory.bgs.includes(DONOR_BADGE)) myInventory.bgs.push(DONOR_BADGE);
  myNickBg = DONOR_BADGE;
  updatePointsUI();
  renderShopUI();
  renderDonorBadgeBox();
  if (window.confetti) confetti({ particleCount: 180, spread: 120, colors: ['#ffffff', '#fde68a', '#bae6fd'] });
}

// ------------------------------------------------------------------
// 🏛️ 부자세 · 🆘 재난지원금 정산
// ------------------------------------------------------------------
function computeSettlement(users, day) {
  const yday = prevDayKey(day);
  const now = bankNow();
  const list = Object.values(users || {})
    .filter(u => u && u.nickname && (u.status === 'approved' || u.approved === true))
    .map(u => ({ nick: u.nickname, total: (Number(u.points) || 0) + (Number(u.owed) || 0), u }));

  const taxes = {};
  [...list].sort((a, b) => b.total - a.total).slice(0, TAX_TABLE.length).forEach((x, i) => {
    if (x.total >= TAX_TABLE[i]) taxes[x.nick] = TAX_TABLE[i];
  });

  const relief = {};
  const active = list.filter(x => !taxes[x.nick] && (Number(x.u.updatedAt) || 0) >= now - RELIEF_ACTIVE_DAYS * 86400000);
  const poorest = [...active].sort((a, b) => a.total - b.total)[0];
  if (poorest) relief[poorest.nick] = { amt: RELIEF_AMOUNT, why: 'poorest', v: poorest.total };
  const loser = active
    .filter(x => !relief[x.nick])
    .map(x => ({ nick: x.nick, net: netOnDay(x.u, yday) }))
    .filter(x => x.net < 0)
    .sort((a, b) => a.net - b.net)[0];
  if (loser) relief[loser.nick] = { amt: RELIEF_AMOUNT, why: 'loser', v: loser.net };

  return { createdAt: firebase.database.ServerValue.TIMESTAMP, by: currentUser.nickname, taxes, relief };
}

async function ensureDailySettlement() {
  if (!canSyncToCloud()) return;
  const day = bankToday();
  const ref = db.ref(`bank/days/${day}`);
  try {
    if ((await ref.child('createdAt').once('value')).exists()) return;
    const users = (await db.ref('user_points').once('value')).val() || {};
    const plan = computeSettlement(users, day);
    await ref.transaction(cur => (cur ? undefined : plan));
  } catch (err) {
    console.warn('정산표 생성 실패:', err && err.message);
  }
}

let bankDuesTimer = null;
function scheduleBankDues(ms) {
  clearTimeout(bankDuesTimer);
  bankDuesTimer = setTimeout(processMyBankDues, ms);
}

async function processMyBankDues() {
  if (!canSyncToCloud() || bankBusy) return;
  bankBusy = true;
  const me = currentUser.nickname;
  try {
    const days = Object.keys(bankState.days || {}).sort();
    for (const day of days) {
      const rec = bankState.days[day] || {};
      const base = db.ref(`bank/days/${day}`);

      // 🏛️ 부자세 납부
      const tax = rec.taxes && Number(rec.taxes[me]);
      if (tax > 0 && !(rec.paid && rec.paid[me] != null)) {
        const take = Math.max(0, Math.min(tax, userPoints));
        const r = await base.child(`paid/${me}`).transaction(c => (c == null ? take : undefined));
        if (r.committed) {
          if (take > 0) {
            addPoints(-take, `🏛️ 부자세 (${day})`);
            updatePointsUI();
            await db.ref('bank/balance').transaction(c => (Number(c) || 0) + take);
          }
          bankToast('🏛️ 부자세 납부', `자산 상위 회원이라 <strong>${fmtP(take)}</strong>가 밥심 은행에 납부됐어요. (재난지원금으로 쓰여요)`);
        }
      }

      // 🆘 재난지원금 수령
      const rel = rec.relief && rec.relief[me];
      const claimed = rec.claimed && rec.claimed[me];
      if (rel && (claimed == null)) {
        const amt = Math.floor(Number(rel.amt) || 0);
        if (amt <= 0) continue;
        const lock = await base.child(`claimed/${me}`).transaction(c => (c == null ? 'pending' : undefined));
        if (!lock.committed) continue;
        const pay = await db.ref('bank/balance').transaction(c => ((Number(c) || 0) >= amt ? (Number(c) || 0) - amt : undefined));
        if (!pay.committed) {
          await base.child(`claimed/${me}`).remove().catch(() => {}); // 금고 부족 → 나중에 다시
          continue;
        }
        await base.child(`claimed/${me}`).set(amt);
        addPoints(amt, `🆘 재난지원금 (${day})`);
        updatePointsUI();
        bankToast('🆘 재난지원금 도착', `${rel.why === 'loser' ? '어제 가장 많이 잃으셨네요.' : '자산이 가장 적은 회원이라'} <strong>${fmtP(amt)}</strong>를 받았어요. 힘내세요!`);
        if (window.confetti) confetti({ particleCount: 90, spread: 80 });
      }
    }
  } catch (err) {
    console.warn('은행 정산 처리 실패:', err && err.message);
  } finally {
    bankBusy = false;
  }
}

// ------------------------------------------------------------------
// 🏦 은행 화면
// ------------------------------------------------------------------
function openBankModal(focus) {
  if (!checkApprovalGuard()) return;
  document.getElementById('prestigeModal').classList.add('hidden');
  document.getElementById('bankModal').classList.remove('hidden');
  renderBankModal();
  fillBankNickList();
  if (focus === 'donate') setTimeout(() => { const el = document.getElementById('bankDonateAmount'); if (el) el.focus(); }, 50);
}
function closeBankModal() { document.getElementById('bankModal').classList.add('hidden'); }

async function fillBankNickList() {
  const dl = document.getElementById('bankNickList');
  if (!dl) return;
  try {
    const users = (await db.ref('user_points').once('value')).val() || {};
    dl.innerHTML = Object.values(users)
      .filter(u => u && u.nickname && u.nickname !== currentUser.nickname && (u.status === 'approved' || u.approved === true))
      .map(u => `<option value="${esc(u.nickname)}"></option>`).join('');
  } catch (e) { /* 목록 없이도 직접 입력 가능 */ }
}

function renderBankModal() {
  const modal = document.getElementById('bankModal');
  if (!modal || modal.classList.contains('hidden')) return;
  const me = currentUser.nickname;
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  set('bankBalance', fmtP(bankState.balance));
  set('bankMyPoints', fmtP(userPoints));
  const mine = myDonated();
  set('bankMyDonated', `내 누적 기부 <strong>${fmtP(mine)}</strong>${mine >= DONOR_BADGE_GOAL ? ' · 😇 천사의 날개 획득 가능' : ` · 천사의 날개까지 ${fmtP(DONOR_BADGE_GOAL - mine)}`}`);

  const donors = Object.entries(bankState.donors || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  set('bankDonorRank', donors.length === 0
    ? '<div class="text-center text-slate-400 py-2">아직 기부자가 없어요. 첫 번째 천사가 되어주세요!</div>'
    : donors.map(([n, v], i) => `<div class="flex justify-between py-1 border-b border-slate-100 last:border-0"><span class="font-bold text-slate-700">${['🥇', '🥈', '🥉', '4', '5'][i]} ${esc(n)}</span><span class="font-black text-sky-700">${fmtP(v)}</span></div>`).join(''));

  const day = bankToday();
  const rec = bankState.days[day];
  if (!rec) {
    set('bankToday', '<div class="text-center text-slate-400 py-2">오늘 정산표를 만드는 중...</div>');
  } else {
    const taxRows = Object.entries(rec.taxes || {}).sort((a, b) => b[1] - a[1]).map(([n, amt], i) => {
      const paid = rec.paid && rec.paid[n] != null;
      return `<div class="flex justify-between py-1"><span>🏛️ ${i + 1}위 <strong>${esc(n)}</strong>${n === me ? ' (나)' : ''}</span><span class="${paid ? 'text-emerald-600' : 'text-slate-400'} font-bold">-${fmtP(amt)} · ${paid ? '납부 완료' : '접속 시 납부'}</span></div>`;
    }).join('') || '<div class="text-slate-400">오늘 대상 없음</div>';
    const relRows = Object.entries(rec.relief || {}).map(([n, r]) => {
      const c = rec.claimed && rec.claimed[n];
      const st = typeof c === 'number' ? '<span class="text-emerald-600">지급 완료</span>'
        : bankState.balance < (r.amt || RELIEF_AMOUNT) ? '<span class="text-amber-600">금고 부족 · 대기</span>'
        : '<span class="text-slate-400">접속 시 지급</span>';
      const why = r.why === 'loser' ? `어제 ${fmtP(-r.v)} 잃음` : `자산 최하위 (${fmtP(r.v)})`;
      return `<div class="flex justify-between gap-2 py-1"><span class="min-w-0 truncate">🆘 <strong>${esc(n)}</strong>${n === me ? ' (나)' : ''} <span class="text-slate-400">${why}</span></span><span class="shrink-0 font-bold">+${fmtP(r.amt)} · ${st}</span></div>`;
    }).join('') || '<div class="text-slate-400">오늘 대상 없음 (어제 손실 기록은 오늘부터 쌓여요)</div>';
    set('bankToday', `<div class="space-y-0.5">${taxRows}</div><div class="border-t border-slate-200 my-1.5"></div><div class="space-y-0.5">${relRows}</div>`);
  }
}

function bankToast(title, html) {
  const box = document.getElementById('feedToastContainer');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'feed-toast feed-toast-plain';
  el.innerHTML = `<div class="text-[10px] font-black text-slate-500">${title}</div><div class="text-xs font-bold leading-snug">${html}</div>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('feed-toast-out'), 6000);
  setTimeout(() => el.remove(), 6700);
}

// ------------------------------------------------------------------
// 👑 프레스티지 회원 배너
// ------------------------------------------------------------------
async function loadPrestigeMembers() {
  try {
    const users = (await db.ref('user_points').once('value')).val() || {};
    prestigeMembers = Object.values(users)
      .filter(u => u && u.nickname && u.prestigePass === true && (u.status === 'approved' || u.approved === true))
      .sort((a, b) => ((Number(b.points) || 0) + (Number(b.owed) || 0)) - ((Number(a.points) || 0) + (Number(a.owed) || 0)));
  } catch (e) { /* 읽기 실패 시 이전 목록 유지 */ }
  renderPrestigeBanner();
}
function renderPrestigeBanner() {
  const wrap = document.getElementById('prestigeMemberBanner');
  const list = document.getElementById('prestigeMemberList');
  const count = document.getElementById('prestigeMemberCount');
  if (!wrap || !list) return;
  wrap.classList.remove('hidden');
  if (count) count.textContent = `${prestigeMembers.length}명`;
  list.innerHTML = prestigeMembers.length === 0
    ? '<span class="text-[11px] text-amber-100/70">아직 아무도 없어요 · 첫 번째 프레스티지 회원의 자리가 비어 있어요</span>'
    : prestigeMembers.map(u => `<span class="prestige-member-chip">${nickHTML(u, 'text-[11px]')}</span>`).join('');
}
// 로그인 안 한 사람도 배너는 볼 수 있게 (구경도 구매욕구!)
setTimeout(loadPrestigeMembers, 3000);
setInterval(loadPrestigeMembers, 5 * 60 * 1000);

// ------------------------------------------------------------------
// ⏳ 보류 포인트 지급 예정 시각
// ------------------------------------------------------------------
function owedEtaSeconds() {
  if (myOwed <= 0) return 0;
  const room = Math.max(0, availableBudget() - (userPoints - serverPoints));
  return Math.max(0, myOwed - room) / BUDGET_RATE + 30; // 30초마다 지급하므로 여유
}
function fmtEtaClock(sec) {
  const t = Date.now() + sec * 1000;
  const sameDay = todayKey(t) === todayKey();
  const p = new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return p;
  const d = new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
  return `${d} ${p}`;
}
function fmtDuration(sec) {
  if (sec < 90) return '1분 이내';
  const m = Math.ceil(sec / 60);
  if (m < 60) return `약 ${m}분`;
  const h = Math.floor(m / 60), mm = m % 60;
  return `약 ${h}시간${mm ? ` ${mm}분` : ''}`;
}
function updateOwedEta() {
  const btn = document.getElementById('headerOwedBtn');
  if (!btn) return;
  if (!(myOwed > 0) || !canSyncToCloud()) { btn.classList.add('hidden'); return; }
  const sec = owedEtaSeconds();
  btn.classList.remove('hidden');
  document.getElementById('headerOwedAmount').textContent = `+${myOwed.toLocaleString()}`;
  document.getElementById('headerOwedEta').textContent = `${fmtEtaClock(sec)} 완료`;
}
function owedEtaText() {
  if (!(myOwed > 0)) return '';
  const sec = owedEtaSeconds();
  return `⏳ 보류 ${myOwed.toLocaleString()}P → ${fmtEtaClock(sec)}쯤 전부 지급 (${fmtDuration(sec)})`;
}
function showOwedInfo() {
  if (!(myOwed > 0)) return;
  const sec = owedEtaSeconds();
  alert(`⏳ 보류 포인트 ${myOwed.toLocaleString()}P\n\n` +
    `예상 완료: ${fmtEtaClock(sec)} (${fmtDuration(sec)})\n` +
    `지급 속도: 시간당 ${(BUDGET_RATE * 3600).toLocaleString()}P, 30초마다 자동 지급\n\n` +
    `※ 사이트를 켜 둔 동안 지급돼요. 꺼져 있는 동안에도 한도는 최대 ${BUDGET_CAP.toLocaleString()}P까지 차올라서, 다시 접속하면 그만큼 한 번에 들어와요.\n` +
    `※ 그 사이에 또 크게 벌면 완료 시각이 뒤로 밀려요.`);
}
setInterval(updateOwedEta, 30000);
