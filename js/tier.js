// 밥심 - 💎 프레스티지 멤버십 (골드 · 블랙)
//
//  - 둘 다 프레스티지 상점 입장권이 있어야 가입 가능, 7일 단위 (최대 28일까지 미리 연장)
//    → 한 번 사면 영원히 이득 보는 구조가 아니라 매주 포인트를 태우는 구조 (인플레 방지)
//  - 가입비는 사라짐(소각). 예치 이자는 은행 금고에서 나감 → 새 포인트를 찍어내지 않음
//  - 블랙은 골드 혜택을 모두 포함
//  - 보안 규칙: goldUntil/blackUntil 은 같은 저장에서 포인트가 가입비만큼 줄어야만 늘릴 수 있고,
//    시간당 한도(예산) 공식도 등급에 맞춰 검사함
//
//  골드: 7일 150만P · 판매 수수료 8% · 시간당 한도 10만P · 매일 축복권 1장
//  블랙: 7일 500만P · 판매 수수료 5% · 시간당 한도 15만P · 매일 축복권 10장
//        · 은행 예치(24시간마다 1%, 하루 최대 3만P, 금고에서 지급) · 슬롯 초특급 확률 5배
//        · 접속 시 전체 알림(하루 1번) · 관리자 핫라인 · 배너 명단

const TIERS = {
  gold:  { key: 'gold',  name: '프레스티지 골드', icon: '🥇', price: 1500000,  days: 7, fee: 0.08, perHour: 100000, bless: 1 },
  black: { key: 'black', name: '프레스티지 블랙', icon: '🖤', price: 5000000, days: 7, fee: 0.05, perHour: 150000, bless: 10 }
};
const TIER_MAX_DAYS = 28;
const DEPOSIT_MIN = 10000;
const DEPOSIT_RATE = 0.01;          // 24시간마다 1%
const DEPOSIT_DAILY_CAP = 30000;    // 하루 이자 최대
const BLACK_SLOT_MULT = 5;          // 슬롯 초특급 확률 배수 (10배면 슬롯이 이득이 돼서 5배)

let myTier = { goldUntil: 0, blackUntil: 0, blessDay: '', vipDay: '' };
let myDeposit = { amt: 0, since: 0 };
let tierDirty = false, depositDirty = false;

function tierNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function isBlack() { return myTier.blackUntil > tierNow(); }
function isGold() { return isBlack() || myTier.goldUntil > tierNow(); }
function myTierKey() { return isBlack() ? 'black' : myTier.goldUntil > tierNow() ? 'gold' : null; }
function sellFeeRate() { const k = myTierKey(); return k ? TIERS[k].fee : 0.1; }
function budgetRate() { const k = myTierKey(); return k ? TIERS[k].perHour / 3600 : BUDGET_RATE; } // 초당 P
function slotMegaChance() { return SLOT_MEGA_CHANCE * (isBlack() ? BLACK_SLOT_MULT : 1); }
function tierDaysLeft(until) { return Math.max(0, (until - tierNow()) / 86400000); }

function loadTierFromUser(val) {
  if (!tierDirty) {
    myTier = {
      goldUntil: Number(val && val.goldUntil) || 0,
      blackUntil: Number(val && val.blackUntil) || 0,
      blessDay: String((val && val.tierBlessDay) || ''),
      vipDay: String((val && val.vipDay) || '')
    };
  }
  if (!depositDirty) {
    const d = val && val.deposit;
    myDeposit = { amt: Math.max(0, Number(d && d.amt) || 0), since: Number(d && d.since) || 0 };
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
    put('deposit', myDeposit.amt > 0 ? { amt: myDeposit.amt, since: myDeposit.since } : null);
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
  const base = Math.max(now, cur);
  const next = base + t.days * 86400000;
  if (next - now > TIER_MAX_DAYS * 86400000 + 60000) return alert(`최대 ${TIER_MAX_DAYS}일까지만 미리 연장할 수 있어요.`);
  if (userPoints < t.price) return alert(`❌ 포인트가 부족해요! (${t.name} ${t.days}일 ${t.price.toLocaleString()}P)`);
  if (key === 'gold' && isBlack()) return alert('이미 블랙 회원이에요. 블랙에는 골드 혜택이 모두 들어 있어요.');
  if (!confirm(`${t.icon} ${t.name} ${cur > now ? '연장' : '가입'}\n\n${t.days}일 · ${t.price.toLocaleString()}P\n만료: ${new Date(next).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}\n\n진행할까요?`)) return;
  updatePointsUI(); // 쌓인 변경을 먼저 저장 → 가입 저장에서는 포인트가 정확히 가입비만큼만 줄어야 규칙 통과
  addPoints(-t.price, `${t.icon} ${t.name} ${t.days}일`);
  if (key === 'black') myTier.blackUntil = next; else myTier.goldUntil = next;
  tierDirty = true;
  updatePointsUI();
  if (window.confetti) confetti({ particleCount: 180, spread: 120, colors: key === 'black' ? ['#0f0f0f', '#fde68a', '#ffffff'] : ['#fde047', '#f59e0b', '#ffffff'] });
  setTimeout(() => { tierDailyPerks(true); if (typeof loadPrestigeMembers === 'function') loadPrestigeMembers(); }, 1500);
  renderTierBox();
}

// 매일 축복권 + 블랙 입장 알림 (접속 시, 그리고 10분마다 날짜 확인)
function tierDailyPerks(justJoined = false) {
  if (!canSyncToCloud() || !isGold()) return;
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
  if (isBlack() && myTier.vipDay !== today) {
    myTier.vipDay = today;
    db.ref(`user_points/${me}/vipDay`).set(today).catch(() => {});
    if (typeof postFeed === 'function') postFeed('vip', `🖤 프레스티지 블랙 회원님이 ${justJoined ? '탄생했습니다' : '입장하셨습니다'}`, 'big', true);
  }
}
setInterval(() => tierDailyPerks(), 10 * 60 * 1000);

// ------------------------------------------------------------------
// 🏦 블랙 전용 은행 예치 (이자는 금고에서)
// ------------------------------------------------------------------
function depositInterestDue() {
  if (!(myDeposit.amt > 0) || !myDeposit.since) return { days: 0, amt: 0 };
  const days = Math.floor((tierNow() - myDeposit.since) / 86400000);
  if (days <= 0) return { days: 0, amt: 0 };
  return { days, amt: Math.min(DEPOSIT_DAILY_CAP * days, Math.floor(myDeposit.amt * DEPOSIT_RATE * days)) };
}
async function claimDepositInterest(silent = false) {
  const due = depositInterestDue();
  if (due.days <= 0) { if (!silent) alert('아직 24시간이 안 됐어요. 예치 후 24시간마다 이자가 붙어요.'); return 0; }
  myDeposit.since += due.days * 86400000; // 이자 시계 이동 (블랙이 아니면 이자 없이 시계만 이동)
  depositDirty = true;
  let paid = 0;
  if (isBlack() && due.amt > 0) {
    try {
      const r = await db.ref('bank/balance').transaction(c => { const b = Number(c) || 0; paid = Math.min(b, due.amt); return paid > 0 ? b - paid : undefined; });
      if (!r.committed) paid = 0;
    } catch (e) { paid = 0; }
    if (paid > 0) addPoints(paid, `🏦 예치 이자 (${due.days}일)`);
  }
  updatePointsUI();
  if (!silent) alert(paid > 0 ? `💰 예치 이자 ${paid.toLocaleString()}P를 받았어요!${paid < due.amt ? '\n(금고가 부족해서 일부만 지급됐어요)' : ''}` : isBlack() ? '금고가 비어 있어서 이자를 못 받았어요. 금고가 채워지면 다음에 받아요.' : '블랙 회원 기간이 아니라 이자가 없어요.');
  renderTierBox();
  return paid;
}
async function depositPoints() {
  if (!checkApprovalGuard()) return;
  if (!isBlack()) return alert('🖤 프레스티지 블랙 회원만 예치할 수 있어요.');
  const input = document.getElementById('tierDepositAmount');
  const amount = Math.floor(Number(input && input.value) || 0);
  if (amount < DEPOSIT_MIN) return alert(`최소 ${DEPOSIT_MIN.toLocaleString()}P부터 예치할 수 있어요.`);
  if (amount > userPoints) return alert('❌ 포인트가 부족해요!');
  if (!confirm(`🏦 ${amount.toLocaleString()}P를 예치할까요?\n\n· 24시간마다 1% 이자 (하루 최대 ${DEPOSIT_DAILY_CAP.toLocaleString()}P, 은행 금고에서 지급)\n· 추가로 넣으면 지금까지 붙은 이자를 먼저 받고 이자 시계가 다시 시작돼요\n· 꺼낼 때 큰 금액은 시간당 한도에 따라 ⏳보류로 천천히 들어와요`)) return;
  if (myDeposit.amt > 0) await claimDepositInterest(true);
  updatePointsUI();
  addPoints(-amount, '🏦 은행 예치');
  myDeposit = { amt: myDeposit.amt + amount, since: tierNow() };
  depositDirty = true;
  updatePointsUI();
  if (input) input.value = '';
  renderTierBox();
}
async function withdrawDeposit() {
  if (!checkApprovalGuard()) return;
  if (!(myDeposit.amt > 0)) return alert('예치금이 없어요.');
  const amt = myDeposit.amt;
  if (!confirm(`🏦 예치금 ${amt.toLocaleString()}P를 모두 꺼낼까요?\n(붙은 이자도 함께 받아요. 큰 금액은 ⏳보류로 천천히 들어와요)`)) return;
  await claimDepositInterest(true);
  updatePointsUI();
  myDeposit = { amt: 0, since: 0 };
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
      ? ['판매 수수료 10% → <b>5%</b>', `시간당 한도 7.2만 → <b>${(t.perHour / 10000)}만P</b>`, `매일 축복권 <b>${t.bless}장</b>`, `은행 예치 <b>24시간마다 1%</b> (하루 최대 3만)`, `슬롯 초특급 확률 <b>${BLACK_SLOT_MULT}배</b>`, '접속하면 전체 알림 · 배너 명단', '📞 관리자 핫라인']
      : ['판매 수수료 10% → <b>8%</b>', `시간당 한도 7.2만 → <b>${(t.perHour / 10000)}만P</b>`, `매일 축복권 <b>${t.bless}장</b>`];
    return `<div class="tier-card tier-${t.key} rounded-2xl p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-[9px] font-black tracking-[0.25em] ${t.key === 'black' ? 'text-slate-300' : 'text-amber-900/70'}">PRESTIGE ${t.key.toUpperCase()}</div>
          <div class="text-sm font-black">${t.icon} ${t.name}</div>
        </div>
        <div class="text-right">
          ${active ? `<div class="text-[10px] font-black ${t.key === 'black' ? 'text-emerald-300' : 'text-emerald-800'}">이용 중 · ${tierDaysLeft(until).toFixed(1)}일 남음</div>` : ''}
          <button onclick="buyTier('${t.key}')" class="mt-0.5 ${t.key === 'black' ? 'bg-white text-slate-950' : 'bg-slate-950 text-amber-200'} font-black px-3 py-1.5 rounded-xl text-[11px]">${active ? '7일 연장' : '가입'} · ${(t.price / 10000).toLocaleString()}만P</button>
        </div>
      </div>
      <ul class="text-[10px] leading-relaxed space-y-0.5 ${t.key === 'black' ? 'text-slate-300' : 'text-amber-950/80'}">${perks.map(p => `<li>· ${p}</li>`).join('')}</ul>
    </div>`;
  };
  const dep = depositInterestDue();
  box.innerHTML = `${card(TIERS.gold)}${card(TIERS.black)}
    ${isBlack() || myDeposit.amt > 0 ? `<div class="rounded-2xl border border-white/15 bg-white/5 p-3 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-white">🏦 블랙 예치금</span>
        <span class="text-xs font-black text-amber-200">${myDeposit.amt.toLocaleString()}P</span>
      </div>
      <div class="text-[10px] text-slate-400">${myDeposit.amt > 0 ? `받을 이자 ${dep.amt.toLocaleString()}P (${dep.days}일) · 다음 이자까지 ${Math.max(0, Math.ceil(((myDeposit.since + (dep.days + 1) * 86400000) - now) / 3600000))}시간` : '24시간마다 1% (하루 최대 3만P) · 이자는 은행 금고에서 지급'}</div>
      ${isBlack() ? `<div class="flex gap-1.5"><input id="tierDepositAmount" type="number" min="${DEPOSIT_MIN}" step="10000" placeholder="예치 금액" class="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white">
        <button onclick="depositPoints()" class="bg-amber-400 text-slate-950 font-black px-3 rounded-xl text-[11px]">예치</button></div>` : ''}
      ${myDeposit.amt > 0 ? `<div class="flex gap-1.5"><button onclick="claimDepositInterest()" class="flex-1 bg-white/10 text-white font-bold py-1.5 rounded-xl text-[11px]">이자 받기</button><button onclick="withdrawDeposit()" class="flex-1 bg-white/10 text-rose-200 font-bold py-1.5 rounded-xl text-[11px]">전액 출금</button></div>` : ''}
    </div>` : ''}
    ${isBlack() ? `<button onclick="openHotline()" class="w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black py-2 rounded-xl text-xs">📞 관리자 핫라인</button>` : ''}`;
}
