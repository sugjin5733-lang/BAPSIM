// 밥심 - 💎 프레스티지 멤버십 (골드 · 블랙)
//
//  - 둘 다 프레스티지 상점 입장권이 있어야 가입 가능, 한 번 사면 영구 (2026-10-23 변경: 7일 → 영구)
//    → 한 번 사면 영원히 이득 보는 구조가 아니라 매주 포인트를 태우는 구조 (인플레 방지)
//  - 가입비는 사라짐(소각). 예치 이자는 은행 금고에서 나감 → 새 포인트를 찍어내지 않음
//  - 블랙은 골드 혜택을 모두 포함
//  - 보안 규칙: goldUntil/blackUntil 은 같은 저장에서 포인트가 가입비만큼 줄어야만 늘릴 수 있고,
//    시간당 한도(예산) 공식도 등급에 맞춰 검사함
//
//  골드: 영구 150만P · 판매 수수료 8% · 시간당 한도 10만P · 매일 축복권 1장
//  블랙: 영구 500만P · 판매 수수료 5% · 시간당 한도 30만P · 매일 축복권 10장
//        · 은행 예치(24시간마다 3%, 상한 없음, 금고에서 지급 → 금고가 비면 못 받음) · 슬롯 초특급 확률 5배
//        · 접속 시 전체 알림(하루 1번) · 관리자 핫라인 · 배너 명단

const TIERS = {
  gold:  { key: 'gold',  name: '프레스티지 골드', icon: '🥇', price: 1500000,  days: 7, fee: 0.08, perHour: 100000, bless: 1 },
  black: { key: 'black', name: '프레스티지 블랙', icon: '🖤', price: 5000000, days: 7, fee: 0.05, perHour: 300000, bless: 10 }
};
const TIER_MAX_DAYS = 28;
const TIER_PERMANENT = 4102444800000; // 2100-01-01 = 영구
function tierIsPermanent(until) { return until >= TIER_PERMANENT - 86400000; }
const DEPOSIT_MIN = 10000;
const DEPOSIT_RATE = 0.03;          // 24시간마다 3% (상한 없음, 은행 금고에서 지급)
const BLACK_SLOT_MULT = 5;          // 슬롯 초특급 확률 배수 (10배면 슬롯이 이득이 돼서 5배)

let myTier = { goldUntil: 0, blackUntil: 0, blessDay: '', vipDay: '' };
let myDeposit = { amt: 0, since: 0 };
let tierDirty = false, depositDirty = false;

function tierNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function isBlack() { return myTier.blackUntil > tierNow(); }
function isGold() { return isBlack() || myTier.goldUntil > tierNow(); }
function myTierKey() { return isBlack() ? 'black' : myTier.goldUntil > tierNow() ? 'gold' : null; }
function sellFeeRate() { if (typeof isWhite === 'function' && isWhite()) return 0; const k = myTierKey(); return k ? TIERS[k].fee : 0.1; }
function budgetRate() { if (typeof isWhite === 'function' && isWhite()) return WHITE_PER_HOUR / 3600; const k = myTierKey(); return k ? TIERS[k].perHour / 3600 : BUDGET_RATE; } // 초당 P
function slotMegaChance() { return SLOT_MEGA_CHANCE * (isBlack() ? BLACK_SLOT_MULT : 1); }
function tierDaysLeft(until) { return Math.max(0, (until - tierNow()) / 86400000); }

function loadTierFromUser(val) {
  if (!tierDirty) {
    myTier = {
      goldUntil: Number(val && val.goldUntil) || 0,
      blackUntil: Number(val && val.blackUntil) || 0,
      blessDay: String((val && val.tierBlessDay) || ''),
      vipDay: String((val && val.vipDay) || ''),
      vipAt: Number(val && val.vipAt) || 0,
      vipAlertOff: !!(val && val.vipAlertOff)
    };
  }
  refreshTierUI();
  if (!depositDirty) {
    const d = val && val.deposit;
    myDeposit = { amt: Math.max(0, Number(d && d.amt) || 0), since: Number(d && d.since) || 0, int: Math.max(0, Number(d && d.int) || 0), fresh: Math.max(0, Number(d && d.fresh) || 0), freshAt: Number(d && d.freshAt) || 0 };
    // 예전 형식(fresh 없음): 원금 전체가 'since' 시각에 새로 들어온 것으로 취급 (예전 규칙과 같은 결과)
    if (d && d.fresh === undefined && myDeposit.amt > 0) { myDeposit.fresh = myDeposit.amt; myDeposit.freshAt = myDeposit.since; }
    myDeposit.fresh = Math.min(myDeposit.fresh, myDeposit.amt);
    if (myDeposit.amt > 0) setTimeout(() => accrueDeposit(), 3000);
  }
}
// syncUserPointToCloud 에서 호출: 등급/예치금은 포인트와 같은 저장에 실어야 규칙 검사 통과
function tierSyncFields(put) {
  if (tierDirty) {
    put('goldUntil', myTier.goldUntil || 0);
    put('blackUntil', myTier.blackUntil || 0);
    tierDirty = false;
  }
  if (depositDirty) {
    put('deposit', myDeposit.amt > 0 ? { amt: myDeposit.amt, since: myDeposit.since, int: Math.min(myDeposit.int || 0, myDeposit.amt), fresh: Math.min(myDeposit.fresh || 0, myDeposit.amt), freshAt: myDeposit.freshAt || 0 } : null);
    depositDirty = false;
  }
}

// ------------------------------------------------------------------
// 가입 / 연장
// ------------------------------------------------------------------
function buyTier(key) {
  if (!checkApprovalGuard()) return;
  const t = TIERS[key];
  if (!t) return;
  if (!myPrestigePass) return alert('👑 프레스티지 상점 입장권이 있어야 가입할 수 있어요.');
  const now = tierNow();
  const cur = key === 'black' ? myTier.blackUntil : myTier.goldUntil;
  if (tierIsPermanent(cur)) return alert(`이미 ${t.name} 영구 회원이에요.`);
  const next = TIER_PERMANENT;
  if (userPoints < t.price) return alert(`❌ 포인트가 부족해요! (${t.name} ${t.days}일 ${t.price.toLocaleString()}P)`);
  if (key === 'gold' && isBlack()) return alert('이미 블랙 회원이에요. 블랙에는 골드 혜택이 모두 들어 있어요.');
  if (!confirm(`${t.icon} ${t.name} 가입\n\n영구 회원 · ${t.price.toLocaleString()}P (한 번만 내면 끝)\n\n진행할까요?`)) return;
  updatePointsUI(); // 쌓인 변경을 먼저 저장 → 가입 저장에서는 포인트가 정확히 가입비만큼만 줄어야 규칙 통과
  addPoints(-t.price, `${t.icon} ${t.name} (영구)`);
  if (key === 'black') myTier.blackUntil = next; else myTier.goldUntil = next;
  tierDirty = true;
  updatePointsUI();
  if (window.confetti) confetti({ particleCount: 180, spread: 120, colors: key === 'black' ? ['#0f0f0f', '#fde68a', '#ffffff'] : ['#fde047', '#f59e0b', '#ffffff'] });
  setTimeout(() => { tierDailyPerks(); if (key === 'black') { announceBlackEntrance(true); attachHotline(); } refreshTierUI(); if (typeof loadPrestigeMembers === 'function') loadPrestigeMembers(); }, 1500);
  renderTierBox();
}

// 매일 축복권 + 블랙 입장 알림 (접속 시, 그리고 10분마다 날짜 확인)
function tierDailyPerks() {
  if (!canSyncToCloud() || !isGold()) return;
  // 7일제 시절 가입자 → 영구로 전환 (같은 가격을 냈으므로)
  let upg = false;
  if (myTier.blackUntil > tierNow() && !tierIsPermanent(myTier.blackUntil)) { myTier.blackUntil = TIER_PERMANENT; upg = true; }
  if (myTier.goldUntil > tierNow() && !tierIsPermanent(myTier.goldUntil)) { myTier.goldUntil = TIER_PERMANENT; upg = true; }
  if (upg) { tierDirty = true; updatePointsUI(); if (typeof bankToast === 'function') bankToast('💎 멤버십 영구 전환', '골드·블랙이 영구 회원제로 바뀌어서 내 멤버십도 영구가 됐어요!'); }
  const today = todayKey(tierNow());
  const me = currentUser.nickname;
  if (myTier.blessDay !== today) {
    const n = isBlack() ? TIERS.black.bless : TIERS.gold.bless;
    myTier.blessDay = today;
    myItems.bless = (myItems.bless || 0) + n;
    db.ref(`user_points/${me}`).update({ [`items/bless`]: myItems.bless, tierBlessDay: today }).catch(() => {});
    if (typeof renderEnhanceItems === 'function') renderEnhanceItems();
    if (typeof bankToast === 'function') bankToast(`${isBlack() ? '🖤' : '🥇'} 멤버십 혜택`, `오늘의 축복 주문서 <strong>${n}장</strong>이 들어왔어요.`);
  }
}
setInterval(() => tierDailyPerks(), 10 * 60 * 1000);

// 🖤 블랙 입장 알림: 사이트를 열 때마다 전체 알림 (새로고침 연타 방지로 10분에 한 번)
let vipAnnouncedAt = 0;
function announceBlackEntrance(justJoined = false) {
  if (!canSyncToCloud() || !isBlack()) return;
  if (myTier.vipAlertOff && !justJoined) return; // 블랙 클럽에서 입장 알림을 끈 경우
  const now = tierNow();
  const last = Math.max(vipAnnouncedAt, Number(myTier.vipAt) || 0);
  if (!justJoined && now - last < 10 * 60 * 1000) return;
  vipAnnouncedAt = now;
  myTier.vipAt = now;
  db.ref(`user_points/${currentUser.nickname}/vipAt`).set(now).catch(() => {});
  if (typeof postFeed === 'function') postFeed('vip', justJoined ? '🖤 프레스티지 블랙 회원이 탄생했습니다!' : '🖤 프레스티지 블랙 회원님이 입장하셨습니다', 'legendary', true);
}

// 등급에 따라 보이는 버튼 (📞 핫라인은 블랙만)
function refreshTierUI() {
  const hb = document.getElementById('hotlineToolbarBtn');
  if (hb) hb.classList.toggle('hidden', !(isBlack() || (typeof isAdmin !== 'undefined' && isAdmin)));
  const wb = document.getElementById('whiteToolbarBtn');
  if (wb) wb.classList.toggle('hidden', !(isBlack() || (typeof isWhite === 'function' && isWhite()) || (typeof isAdmin !== 'undefined' && isAdmin)));
}
setInterval(refreshTierUI, 60 * 1000);

// ------------------------------------------------------------------
// 🏦 블랙 전용 은행 예치 (이자는 금고에서)
// ------------------------------------------------------------------
// 매일 오전 8시(한국 시각)마다 3% 복리. 이자는 원금에 붙고(복리), 붙은 이자만큼은 따로 꺼낼 수 있음
//  deposit = { amt: 원금+붙은 이자, since: 마지막으로 이자 계산한 8시 시각, int: 꺼낼 수 있는 이자 }
const DAY_MS = 86400000, KST8_SHIFT = 3600000; // KST 08:00 = UTC 23:00 → (t + 1h) 가 하루 단위로 떨어지는 순간
function lastKst8(t) { return Math.floor((t + KST8_SHIFT) / DAY_MS) * DAY_MS - KST8_SHIFT; }
function nextKst8(t) { return lastKst8(t) + DAY_MS; }
// 이자 계산: 이미 이자를 받던 원금(amt - fresh)은 매일 8시에 바로 3%,
// 새로 넣은 돈(fresh)은 넣고 12시간 이상 지난 8시부터 원금에 합쳐져서 이자를 받음
// (추가로 넣어도 기존 원금의 이자 시계는 그대로)
function depositSimulate() {
  const out = { days: 0, amt: 0, eligible: 0, fresh: 0, steps: [] };
  if (!(myDeposit.amt > 0)) return out;
  let el = Math.max(0, myDeposit.amt - (myDeposit.fresh || 0)), fr = Math.max(0, myDeposit.fresh || 0);
  const fa = myDeposit.freshAt || myDeposit.since || 0;
  const last = lastKst8(tierNow());
  for (let t = nextKst8(myDeposit.since || fa); t <= last; t += DAY_MS) {
    if (fr > 0 && t - fa >= 12 * 3600000) { el += fr; fr = 0; }
    const add = Math.floor(el * DEPOSIT_RATE);
    if (el > 0) { el += add; out.amt += add; out.days++; out.steps.push({ at: t, add, bal: el + fr }); }
  }
  out.eligible = el; out.fresh = fr;
  return out;
}
function depositInterestDue() { const r = depositSimulate(); return { days: r.days, amt: r.amt }; }
// 새로 넣은 돈이 이자를 받기 시작하는 8시
function depositFreshStart() {
  if (!(myDeposit.fresh > 0)) return 0;
  let t = nextKst8(myDeposit.freshAt);
  if (t - myDeposit.freshAt < 12 * 3600000) t += DAY_MS;
  return t;
}
let depositAccruing = false;
async function accrueDeposit() {
  if (depositAccruing || !canSyncToCloud() || !(myDeposit.amt > 0)) return 0;
  const sim = depositSimulate();
  const lastB = lastKst8(tierNow());
  if (sim.days <= 0) {
    // 이자는 없지만 새 돈이 원금에 합쳐졌으면 반영
    if (myDeposit.fresh > 0 && sim.fresh === 0) { myDeposit.fresh = 0; myDeposit.since = lastB; depositDirty = true; updatePointsUI(); }
    return 0;
  }
  depositAccruing = true;
  try {
    let paid = 0;
    if (isBlack() && sim.amt > 0) {
      try {
        const r = await db.ref('bank/balance').transaction(c => { const b = Number(c) || 0; paid = Math.min(b, sim.amt); return paid > 0 ? b - paid : undefined; });
        if (!r.committed) paid = 0;
      } catch (e) { paid = 0; }
    }
    const ratio = sim.amt > 0 ? paid / sim.amt : 0;
    const nick = currentUser.nickname;
    let given = 0;
    sim.steps.forEach(st => {
      const add = Math.floor(st.add * ratio);
      given += add;
      db.ref(`bank/deposit_log/${nick}`).push({ at: st.at, interest: add, bal: myDeposit.amt + given, rate: DEPOSIT_RATE, note: isBlack() ? (ratio < 1 ? '금고 부족으로 일부만' : '') : '블랙 아님 · 이자 없음' }).catch(() => {});
    });
    myDeposit.amt += given;
    myDeposit.fresh = sim.fresh;
    myDeposit.since = lastB; // 이자 시계를 오늘 8시로 (원금 쪽)
    myDeposit.int = (myDeposit.int || 0) + given;
    depositDirty = true;
    updatePointsUI();
    renderTierBox();
    if (given > 0 && typeof bankToast === 'function') bankToast('🏦 예치 이자', `오전 8시 이자 <strong>${given.toLocaleString()}P</strong>가 예치금에 붙었어요 (복리). 꺼낼 수 있는 이자 ${myDeposit.int.toLocaleString()}P`);
    return given;
  } finally { depositAccruing = false; }
}
setInterval(() => { accrueDeposit(); }, 5 * 60 * 1000);
// 예전 버튼 호환
async function claimDepositInterest() { const p = await accrueDeposit(); if (!p) alert(`이자는 매일 오전 8시에 예치금에 자동으로 붙어요 (복리).\n다음 이자: ${new Date(nextKst8(tierNow())).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`); return p; }
async function withdrawInterest() {
  if (!checkApprovalGuard()) return;
  await accrueDeposit();
  const max = Math.min(myDeposit.int || 0, myDeposit.amt);
  if (!(max > 0)) return alert('아직 꺼낼 수 있는 이자가 없어요. 이자는 매일 오전 8시에 붙어요.');
  const v = prompt(`💰 꺼낼 이자 금액 (최대 ${max.toLocaleString()}P):`, String(max));
  if (v === null) return;
  const amt = Math.floor(Number(String(v).replace(/[,\s]/g, '')) || 0);
  if (amt <= 0 || amt > max) return alert(`1 ~ ${max.toLocaleString()}P 사이로 입력해 주세요.`);
  myDeposit.amt -= amt;
  myDeposit.int -= amt;
  depositDirty = true;
  addPoints(amt, '🏦 예치 이자 출금');
  db.ref(`bank/deposit_log/${currentUser.nickname}`).push({ at: firebase.database.ServerValue.TIMESTAMP, withdraw: amt, bal: myDeposit.amt }).catch(() => {});
  updatePointsUI();
  renderTierBox();
  if (typeof renderBlackClub === 'function') renderBlackClub();
}
async function openDepositHistory(boxId = 'tierDepositHistory') {
  let rows = [];
  try { const s = await db.ref(`bank/deposit_log/${currentUser.nickname}`).limitToLast(30).once('value'); s.forEach(c => { rows.push(c.val()); }); } catch (e) {}
  rows.reverse();
  const fmt = t => new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const box = document.getElementById(boxId);
  if (!box) return;
  box.classList.toggle('hidden');
  box.innerHTML = rows.length === 0 ? '<div class="text-[10px] text-slate-400 text-center py-2">아직 내역이 없어요. 첫 이자는 다음 오전 8시에 붙어요.</div>'
    : rows.map(r => r.withdraw ? `<div class="flex justify-between text-[10px] py-0.5"><span class="text-slate-400">${fmt(r.at)} 이자 출금</span><span class="text-rose-300 font-bold">-${r.withdraw.toLocaleString()}P</span></div>`
      : `<div class="flex justify-between text-[10px] py-0.5"><span class="text-slate-400">${fmt(r.at)} 이자 ${Math.round((r.rate || DEPOSIT_RATE) * 100)}%${r.note ? ` · ${esc(r.note)}` : ''}</span><span class="text-emerald-300 font-bold">+${(r.interest || 0).toLocaleString()}P <span class="text-slate-500">→ ${(r.bal || 0).toLocaleString()}</span></span></div>`).join('');
}
function depositPanelHTML(pfx = 'tier') {
  const dep = depositInterestDue();
  const nextAt = new Date(nextKst8(tierNow())).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `
      <div class="text-[10px] text-slate-400">${myDeposit.amt > 0 ? `매일 오전 8시 3% 복리 · 다음 이자 ${nextAt}${dep.days > 0 ? ` (곧 +${dep.amt.toLocaleString()}P)` : ''}<br>꺼낼 수 있는 이자 <b class="text-emerald-300">${(myDeposit.int || 0).toLocaleString()}P</b>${myDeposit.fresh > 0 ? `<br>이자 받는 원금 ${(myDeposit.amt - myDeposit.fresh).toLocaleString()}P · 새로 넣은 ${myDeposit.fresh.toLocaleString()}P는 <b class="text-amber-200">${new Date(depositFreshStart()).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</b>부터 이자` : ''}` : '매일 오전 8시 3% 복리 (상한 없음) · 이자는 은행 금고에서'}</div>
      ${isBlack() ? `<div class="flex gap-1.5"><input id="${pfx}DepositAmount" type="number" min="${DEPOSIT_MIN}" step="10000" placeholder="예치 금액" class="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white">
        <button onclick="depositPoints('${pfx}DepositAmount')" class="bg-amber-400 text-slate-950 font-black px-3 rounded-xl text-[11px]">예치</button></div>` : ''}
      ${myDeposit.amt > 0 ? `<div class="flex gap-1.5"><button onclick="withdrawInterest()" class="flex-1 bg-emerald-500/20 text-emerald-200 font-bold py-1.5 rounded-xl text-[11px]">이자 출금</button><button onclick="openDepositHistory('${pfx}DepositHistory')" class="flex-1 bg-white/10 text-white font-bold py-1.5 rounded-xl text-[11px]">이자 내역</button><button onclick="withdrawDeposit()" class="flex-1 bg-white/10 text-rose-200 font-bold py-1.5 rounded-xl text-[11px]">전액 출금</button></div>
      <div id="${pfx}DepositHistory" class="hidden max-h-40 overflow-y-auto rounded-xl bg-black/30 px-2 py-1"></div>` : ''}`;
}
async function depositPoints(inputId = 'tierDepositAmount') {
  if (!checkApprovalGuard()) return;
  if (!isBlack()) return alert('🖤 프레스티지 블랙 회원만 예치할 수 있어요.');
  const input = document.getElementById(inputId);
  const amount = Math.floor(Number(input && input.value) || 0);
  if (amount < DEPOSIT_MIN) return alert(`최소 ${DEPOSIT_MIN.toLocaleString()}P부터 예치할 수 있어요.`);
  if (amount > userPoints) return alert('❌ 포인트가 부족해요!');
  if (!confirm(`🏦 ${amount.toLocaleString()}P를 예치할까요?\n\n· 매일 오전 8시에 3% 이자가 예치금에 붙어요 (복리 · 은행 금고에서 지급)\n· 새로 넣은 돈은 넣고 12시간 이상 지난 오전 8시부터 이자 · 이미 넣어둔 돈의 이자는 그대로 계속 붙어요\n· 붙은 이자만큼은 언제든 따로 꺼낼 수 있어요\n· 꺼낼 때 큰 금액은 시간당 한도에 따라 ⏳보류로 천천히 들어와요`)) return;
  if (myDeposit.amt > 0) await accrueDeposit();
  updatePointsUI();
  addPoints(-amount, '🏦 은행 예치');
  // 새로 넣은 돈만 따로 '대기'로 (기존 원금의 이자 시계는 그대로)
  const nowT = tierNow();
  myDeposit = { amt: myDeposit.amt + amount, since: myDeposit.amt > 0 && myDeposit.since ? myDeposit.since : nowT, int: myDeposit.int || 0, fresh: (myDeposit.fresh || 0) + amount, freshAt: nowT };
  depositDirty = true;
  updatePointsUI();
  if (input) input.value = '';
  renderTierBox();
  if (typeof renderBlackClub === 'function') renderBlackClub();
}
async function withdrawDeposit() {
  if (!checkApprovalGuard()) return;
  if (!(myDeposit.amt > 0)) return alert('예치금이 없어요.');
  let amt = myDeposit.amt;
  if (!confirm(`🏦 예치금 ${amt.toLocaleString()}P를 모두 꺼낼까요?\n(붙은 이자도 함께 받아요. 큰 금액은 ⏳보류로 천천히 들어와요)`)) return;
  await accrueDeposit();
  updatePointsUI();
  amt = myDeposit.amt;
  myDeposit = { amt: 0, since: 0, int: 0, fresh: 0, freshAt: 0 };
  depositDirty = true;
  addPoints(amt, '🏦 예치금 출금');
  updatePointsUI();
  renderTierBox();
}

// ------------------------------------------------------------------
// 📞 블랙 전용 관리자 핫라인 (hotline/{uid}/{id})
// ------------------------------------------------------------------
let hotlineRef = null, hotlineItems = {};
function attachHotline() {
  if (hotlineRef || !authUser) return;
  hotlineRef = db.ref(`hotline/${authUser.uid}`);
  let first = true;
  hotlineRef.on('value', s => {
    const prev = hotlineItems;
    hotlineItems = s.val() || {};
    if (!first) Object.entries(hotlineItems).forEach(([id, h]) => {
      if (h && h.reply && !(prev[id] && prev[id].reply) && typeof bankToast === 'function') bankToast('📞 관리자 답변 도착', esc(String(h.reply).slice(0, 80)));
    });
    first = false;
    renderHotline();
  }, () => { hotlineRef = null; });
}
function openHotline() {
  if (!checkApprovalGuard()) return;
  if (!isBlack()) return alert('🖤 프레스티지 블랙 회원 전용이에요.');
  attachHotline();
  document.getElementById('hotlineModal').classList.remove('hidden');
  renderHotline();
}
function closeHotline() { document.getElementById('hotlineModal').classList.add('hidden'); }
function renderHotline() {
  const box = document.getElementById('hotlineList');
  if (!box) return;
  const rows = Object.entries(hotlineItems).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
  box.innerHTML = rows.length === 0 ? '<div class="text-center text-slate-400 py-4">아직 보낸 민원이 없어요</div>'
    : rows.map(([, h]) => `<div class="p-2.5 rounded-xl border border-slate-200 bg-white space-y-1">
        <div class="text-xs text-slate-800 whitespace-pre-line">${esc(h.text)}</div>
        <div class="text-[10px] text-slate-400">${h.ts ? new Date(h.ts).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : ''}</div>
        ${h.reply ? `<div class="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-900"><strong>🛡️ 관리자:</strong> ${esc(h.reply)}</div>` : '<div class="text-[10px] font-bold text-slate-400">⏳ 답변 대기 중</div>'}
      </div>`).join('');
}
async function sendHotline() {
  if (!isBlack()) return alert('🖤 프레스티지 블랙 회원 전용이에요.');
  const el = document.getElementById('hotlineText');
  const text = (el.value || '').trim().slice(0, 500);
  if (text.length < 2) return alert('내용을 적어주세요.');
  try {
    await db.ref(`hotline/${authUser.uid}`).push({ nick: currentUser.nickname, text, ts: firebase.database.ServerValue.TIMESTAMP });
    el.value = '';
    alert('📞 관리자에게 전달했어요. 답변이 오면 알려드릴게요!');
  } catch (err) { alert('전송 실패: ' + (err && err.message)); }
}

// ------------------------------------------------------------------
// 화면: 프레스티지 상점 안 멤버십 카드
// ------------------------------------------------------------------
function renderTierBox() {
  const box = document.getElementById('prestigeTierBox');
  if (!box) return;
  const now = tierNow();
  const card = (t) => {
    const until = t.key === 'black' ? myTier.blackUntil : myTier.goldUntil;
    const active = until > now;
    const perks = t.key === 'black'
      ? ['판매 수수료 10% → <b>5%</b>', '밥 판매가 <b>×2</b>', `시간당 한도 7.2만 → <b>${(t.perHour / 10000)}만P</b>`, `매일 축복권 <b>${t.bless}장</b>`, `은행 예치 <b>24시간마다 3%</b> (상한 없음)`, `슬롯 초특급 확률 <b>${BLACK_SLOT_MULT}배</b>`, '🌌 <b>초월 방지권</b> (+20강부터 파괴 방지)', '접속할 때마다 전체 입장 알림 · 배너 명단', '📞 관리자 핫라인']
      : ['판매 수수료 10% → <b>8%</b>', '밥 판매가 <b>+5%</b>', `시간당 한도 7.2만 → <b>${(t.perHour / 10000)}만P</b>`, `매일 축복권 <b>${t.bless}장</b>`];
    return `<div class="tier-card tier-${t.key} rounded-2xl p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-[9px] font-black tracking-[0.25em] ${t.key === 'black' ? 'text-slate-300' : 'text-amber-900/70'}">PRESTIGE ${t.key.toUpperCase()}</div>
          <div class="text-sm font-black">${t.icon} ${t.name}</div>
        </div>
        <div class="text-right">
          ${active ? `<div class="text-[11px] font-black ${t.key === 'black' ? 'text-emerald-300' : 'text-emerald-800'}">✓ 영구 회원</div>` : `<button onclick="buyTier('${t.key}')" class="mt-0.5 ${t.key === 'black' ? 'bg-white text-slate-950' : 'bg-slate-950 text-amber-200'} font-black px-3 py-1.5 rounded-xl text-[11px]">영구 가입 · ${(t.price / 10000).toLocaleString()}만P</button>`}
        </div>
      </div>
      <ul class="text-[10px] leading-relaxed space-y-0.5 ${t.key === 'black' ? 'text-slate-300' : 'text-amber-950/80'}">${perks.map(p => `<li>· ${p}</li>`).join('')}</ul>
    </div>`;
  };
  box.innerHTML = `${card(TIERS.gold)}${card(TIERS.black)}
    ${isBlack() || myDeposit.amt > 0 ? `<div class="rounded-2xl border border-white/15 bg-white/5 p-3 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-white">🏦 블랙 예치금</span>
        <span class="text-xs font-black text-amber-200">${myDeposit.amt.toLocaleString()}P</span>
      </div>
${depositPanelHTML()}
    </div>` : ''}
    ${isBlack() ? `<button onclick="openHotline()" class="w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black py-2 rounded-xl text-xs">📞 관리자 핫라인</button>` : ''}`;
}
