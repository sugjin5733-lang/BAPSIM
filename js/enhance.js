// 밥심 - 밥키우기(강화)

// ==========================================
// 1 & 2. 밥키우기 단계별 고유 진화 테이블 & 차등 강화비용
// ==========================================
const BOWL_EVOLUTION = [
  { level: 0,  icon: "🍚", name: "따스한 햇쌀밥" },
  { level: 1,  icon: "🌾", name: "갓 도정한 햅쌀밥" },
  { level: 2,  icon: "🍙", name: "고소한 참기름 주먹밥" },
  { level: 3,  icon: "🍘", name: "바삭한 누룽지 튀밥" },
  { level: 4,  icon: "🍚", name: "찰진 영양 흑미밥" },
  { level: 5,  icon: "🍣", name: "신선한 초밥용 단촛물밥" },
  { level: 6,  icon: "🍛", name: "매콤달콤 카레 덮밥" },
  { level: 7,  icon: "🍳", name: "지글지글 김치볶음밥" },
  { level: 8,  icon: "🥣", name: "속 편한 전복 소라죽" },
  { level: 9,  icon: "🥢", name: "오색나물 전주비빔밥" },
  { level: 10, icon: "🧑‍🍳", name: "윤기 좔좔 가마솥 영양밥" },
  { level: 11, icon: "🍲", name: "얼큰 뚝배기 국밥" },
  { level: 12, icon: "🍱", name: "임금님 수라상 칠첩반상 밥" },
  { level: 13, icon: "🍖", name: "육즙 가득 대왕 규동 덮밥" },
  { level: 14, icon: "🦞", name: "황금 랍스터 해물 리조또" },
  { level: 15, icon: "🥟", name: "천하일미 만한전석 볶음밥" },
  { level: 16, icon: "🥘", name: "천년 묵은 태고의 돌솥 누룽지" },
  { level: 17, icon: "🌀", name: "우주 기운을 품은 오로라 밥" },
  { level: 18, icon: "✨", name: "차원을 초월한 다이아몬드 신선밥" },
  { level: 19, icon: "🪐", name: "무한 에너지를 머금은 성운의 밥" },
  { level: 20, icon: "👑", name: "태초의 천상 만다라 불멸 영생밥" },
  // ── 초월 구간 (+21~+30): 파괴 방지권 사용 불가 ──
  { level: 21, icon: "🌙", name: "달빛을 머금은 월광 은하밥" },
  { level: 22, icon: "☄️", name: "혜성의 꼬리를 두른 유성밥" },
  { level: 23, icon: "🐉", name: "청룡이 지키는 용궁 진수성찬" },
  { level: 24, icon: "🔥", name: "불사조 깃털로 지은 봉황밥" },
  { level: 25, icon: "🔱", name: "해신의 삼지창 심해 진주밥" },
  { level: 26, icon: "⚡", name: "천둥신의 뇌전 벼락밥" },
  { level: 27, icon: "🌈", name: "칠색 무지개 다리 너머 신선밥" },
  { level: 28, icon: "🌞", name: "태양신의 황금 일광밥" },
  { level: 29, icon: "🌌", name: "은하를 통째로 담은 우주의 밥" },
  { level: 30, icon: "💫", name: "만물의 근원, 창세의 밥" }
];
const ENHANCE_MAX = 30;
const NO_PROTECT_FROM = 20; // +20 → +21 시도부터 파괴 방지권 사용 불가
// 🌌 초월 방지권 (🖤 프레스티지 블랙 전용): +20강부터 시도하는 강화에서 파괴(0강 리셋)를 막아줌
//  - 보관 불가, 시도할 때마다 그 단계 가격으로 자동 결제 (싼 단계에서 사 두고 비싼 단계에서 쓰는 것 방지)
//  - 가격(시도 1회): +20~21 3만 · +22~23 5만 · +24~25 10만 · +26~27 20만 · +28~29 30만P
//    → +24강까지는 타도 다시 쌓는 게 싸서 안 쓰는 게 이득, +25강부터는 확실히 이득 (파괴 1번 = 수백만~수천만P)
//    → 축복+초월 방지권으로 +27강 약 1,300만P · +30강 약 4,700만P (방지권 없이는 +30강 평균 12억P)
//  - 가격의 10%는 은행 금고로(수수료), 나머지는 소각
let useTProtect = false;
// 분당 강화 한도: 기본 100 · 🥇 골드 300 · 🖤 블랙 1000
function enhancePerMinLimit() { const k = typeof myTierKey === 'function' ? myTierKey() : null; return k === 'black' ? 1000 : k === 'gold' ? 300 : 100; }
function tprotectPrice(L) { return L < 22 ? 30000 : L < 24 ? 50000 : L < 26 ? 100000 : L < 28 ? 200000 : 300000; }
function tprotectAvailable() { return typeof isBlack === 'function' && isBlack() && currentEnhanceLevel >= NO_PROTECT_FROM && currentEnhanceLevel < ENHANCE_MAX; }
function tprotectActive() { return useTProtect && tprotectAvailable() && !gambleMode; }
function toggleTProtect() {
  if (!tprotectAvailable()) return alert('🖤 프레스티지 블랙 회원만 +20강부터 쓸 수 있어요.');
  if (gambleMode) return alert('도박 모드에서는 쓸 수 없어요.');
  useTProtect = !useTProtect;
  renderEnhanceItems();
  updateEnhanceUI();
}

// 🧾 이 밥에 들인 돈·강화 횟수 (0강에서 시작해 판매할 때까지, 파괴돼도 계속 누적). 서버 user_points/bowl
let myBowl = { cost: 0, tries: 0 }, myBowlDirty = false, myBowlLoaded = false, lastSaleSummary = null;
function loadBowlFromUser(val) {
  if (myBowlLoaded) return; // 이 기기만 쓰는 값 → 처음 한 번만 읽음 (에코 덮어쓰기 방지)
  const b = val && val.bowl;
  myBowl = { cost: Math.max(0, Number(b && b.cost) || 0), tries: Math.max(0, Number(b && b.tries) || 0) };
  myBowlLoaded = true;
}
// 🌌 초월 강화 체크: +20강 이상에서 강화하려면 직접 체크해야 함 (실수 방지). 20강 아래로 내려가거나 팔면 자동 해제
let transcendOn = false;
function setTranscend(on) { transcendOn = !!on; updateEnhanceUI(); }
function renderTranscend() {
  const wrap = document.getElementById('transcendWrap');
  const cb = document.getElementById('transcendCheck');
  if (currentEnhanceLevel < 20 || currentEnhanceLevel >= ENHANCE_MAX) transcendOn = false;
  if (wrap) wrap.classList.toggle('hidden', !(currentEnhanceLevel >= 20 && currentEnhanceLevel < ENHANCE_MAX));
  if (cb) cb.checked = transcendOn;
}
function transcendBlocked() { return currentEnhanceLevel >= 20 && currentEnhanceLevel < ENHANCE_MAX && !transcendOn; }

// 판매가 기준: 축복서·방지권·도박 모드를 단계마다 가장 잘 골랐을 때의 '평균 강화 비용'(아이템 수수료 포함)
// 판매가 = 평균 비용 × 1.157 → 평균 시세(1.006)·대박 손님(+5%)·판매 수수료(10%)까지 반영하면
// 잘 하는 사람 기준 평균 회수율 약 110% (2026-10-23 조정, 열심히 하면 일주일 안에 프레스티지 가능)
const ENHANCE_PROBABILITIES = [
  { level: 1,  success: 100.0, keep: 0.0,  break: 0.0,  reward: 120 },
  { level: 2,  success: 90.6,  keep: 9.4,  break: 0.0,  reward: 240 },
  { level: 3,  success: 79.8,  keep: 20.2, break: 0.0,  reward: 390 },
  { level: 4,  success: 70.1,  keep: 27.9, break: 2.1,  reward: 560 },
  { level: 5,  success: 59.9,  keep: 35.0, break: 5.1,  reward: 810 },
  { level: 6,  success: 50.1,  keep: 39.7, break: 10.2, reward: 1200 },
  { level: 7,  success: 45.4,  keep: 44.1, break: 10.5, reward: 1600 },
  { level: 8,  success: 40.2,  keep: 49.6, break: 10.3, reward: 2200 },
  { level: 9,  success: 33.6,  keep: 56.6, break: 9.8,  reward: 3000 },
  { level: 10, success: 29.3,  keep: 61.4, break: 9.5,  reward: 4200 },
  { level: 11, success: 25.5,  keep: 64.5, break: 10.1, reward: 5300 },
  { level: 12, success: 23.6,  keep: 65.9, break: 10.6, reward: 7000 },
  { level: 13, success: 19.3,  keep: 70.2, break: 10.5, reward: 10000 },
  { level: 14, success: 18.1,  keep: 72.3, break: 9.7,  reward: 14000 },
  { level: 15, success: 14.8,  keep: 75.5, break: 9.9,  reward: 21000 },
  { level: 16, success: 13.1,  keep: 78.0, break: 9.8,  reward: 24000 },
  { level: 17, success: 10.9,  keep: 76.8, break: 12.6, reward: 32000 },
  { level: 18, success: 9.9,   keep: 79.9, break: 10.7, reward: 46000 },
  { level: 19, success: 4.7,   keep: 86.2, break: 10.6, reward: 75000 },
  { level: 20, success: 3.3,   keep: 90.3, break: 9.9,  reward: 120000 },
  // 초월 구간: 방지권 없이 축복·도박만. 여기서 타면 안전 구간 없이 +0강으로 리셋
  // 단계별 최적 플레이 기대 비용(0강부터): +25 약 56만 · +28 약 159만 · +30 약 270만P → 판매가는 그 약 90%
  { level: 21, success: 3.2,   keep: 94.3, break: 2.5,  reward: 160000 },
  { level: 22, success: 3.0,   keep: 94.0, break: 3.0,  reward: 230000 },
  { level: 23, success: 2.8,   keep: 93.7, break: 3.5,  reward: 390000 },
  { level: 24, success: 2.6,   keep: 93.4, break: 4.0,  reward: 450000 },
  { level: 25, success: 2.4,   keep: 93.1, break: 4.5,  reward: 640000 },
  { level: 26, success: 2.2,   keep: 92.8, break: 5.0,  reward: 1130000 },
  { level: 27, success: 2.0,   keep: 92.5, break: 5.5,  reward: 1290000 },
  { level: 28, success: 1.8,   keep: 92.2, break: 6.0,  reward: 1830000 },
  { level: 29, success: 1.6,   keep: 91.9, break: 6.5,  reward: 2070000 },
  { level: 30, success: 1.5,   keep: 91.5, break: 7.0,  reward: 3110000 }
];

// 안전 구간: 한 번 도달한 5/10/15강 아래로는 떨어지지 않음
// (예전엔 +19에서 타면 0강부터 다시 → +20 도달 기대 비용이 약 400만P라 사실상 불가능했음)
// 초월 구간(+20에서 시도하는 강화부터)은 타면 무조건 +0강으로
function enhanceCheckpoint(level) {
  if (level >= 20) return 0;
  return level >= 15 ? 15 : level >= 10 ? 10 : level >= 5 ? 5 : 0;
}

function getEnhanceCost(lvl) {
  if (lvl < 5) return 100;
  if (lvl < 10) return 150;
  if (lvl < 15) return 250;
  if (lvl < 17) return 400;
  if (lvl < 19) return 800;
  if (lvl < 20) return 1000;
  if (lvl < 22) return 1500;
  if (lvl < 24) return 2000;
  if (lvl < 26) return 3000;
  if (lvl < 28) return 4000;
  return 5000;
}

let currentEnhanceLevel = 0; // 서버 값으로 채워짐
let enhanceActionTimestamps = [];

function openEnhanceModal() {
  if (!checkApprovalGuard()) return;
  renderEnhanceItems();
  updateEnhanceUI();
  renderEnhanceTable();
  document.getElementById('enhanceModal').classList.remove('hidden');
}

function closeEnhanceModal() {
  doubleUp = null;
  const du = document.getElementById('doubleUpPanel');
  if (du) du.classList.add('hidden');
  document.getElementById('enhanceModal').classList.add('hidden');
}

function updateEnhanceUI() {
  // 두근두근 연출 중에는 결과가 미리 보이지 않도록 화면 갱신을 잠시 멈춤 (저장은 그대로)
  if (typeof enhanceRevealing !== 'undefined' && enhanceRevealing) { syncEnhanceToCloud(); return; }
  const levelBadge = document.getElementById('enhanceLevelBadge');
  const avatar = document.getElementById('enhanceBowlAvatar');
  const costText = document.getElementById('enhanceCostText');
  const sellText = document.getElementById('enhanceSellValueText');
  const probS = document.getElementById('probSuccess');
  const probK = document.getElementById('probKeep');
  const probB = document.getElementById('probBreak');
  const actionBtn = document.getElementById('enhanceActionBtn');

  const bowl = BOWL_EVOLUTION[Math.min(currentEnhanceLevel, ENHANCE_MAX)];
  const bowlName = bowl ? bowl.name : "일반 밥";
  const bowlIcon = bowl ? bowl.icon : "🍚";

  if (levelBadge) {
    levelBadge.innerHTML = `<span class="${currentEnhanceLevel >= 15 ? 'text-amber-300 font-black animate-pulse' : 'text-amber-400'}">+${currentEnhanceLevel} ${bowlName}</span>`;
  }
  if (avatar) avatar.textContent = bowlIcon;

  const hBadge = document.getElementById('headerEnhanceBadge');
  if (hBadge) hBadge.textContent = `+${currentEnhanceLevel}강`;

  const shopEnhanceTxt = document.getElementById('shopCurrentEnhanceLvl');
  if (shopEnhanceTxt) shopEnhanceTxt.textContent = `+${currentEnhanceLevel}강 (${bowlName})`;

  const mk = riceMarket();
  const baseSell = currentEnhanceLevel > 0 ? ENHANCE_PROBABILITIES[currentEnhanceLevel - 1].reward : 0;
  const bs = document.getElementById('enhanceBowlStats');
  if (bs) bs.innerHTML = currentEnhanceLevel > 0 || myBowl.tries > 0
    ? `🧾 이 밥: 0강부터 <strong class="text-slate-200">${myBowl.tries.toLocaleString()}회</strong> 강화 · 들인 돈 <strong class="text-amber-300">${myBowl.cost.toLocaleString()}P</strong>${baseSell > 0 && !mk.pending ? ` · 지금 팔면 ${(() => { const r = Math.round(baseSell * mk.mult); const n = r - Math.round(r * curSellFee()) - myBowl.cost; return `<strong class="${n >= 0 ? 'text-emerald-300' : 'text-rose-300'}">${n >= 0 ? '+' : ''}${n.toLocaleString()}P</strong>`; })()}` : ''}`
    : '🧾 새 밥: 강화를 시작하면 들인 돈과 횟수가 쌓여요';
  if (sellText) sellText.innerHTML = baseSell > 0
    ? `<span class="text-slate-500 text-[10px] font-bold">${baseSell.toLocaleString()} × ${mk.mult.toFixed(2)} − 수수료 ${Math.round(curSellFee() * 100)}% =</span> ${(Math.round(baseSell * mk.mult) - Math.round(Math.round(baseSell * mk.mult) * curSellFee())).toLocaleString()}P`
    : '0P';
  renderRiceMarket();
  renderEnhanceRecommend();

  renderTranscend();
  if (currentEnhanceLevel >= ENHANCE_MAX) {
    if (costText) costText.textContent = "최대 강화 달성";
    if (probS) probS.textContent = "-";
    if (probK) probK.textContent = "-";
    if (probB) probB.textContent = "-";
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = `${ENHANCE_MAX}강 최고등급 달성!`;
    }
  } else {
    applyAutoItems();
    const nextMeta = effectiveOdds(currentEnhanceLevel);
    const nextCost = currentAttemptCost();
    if (costText) costText.textContent = `강화비: ${nextCost}P`;
    if (probS) probS.textContent = `${nextMeta.success.toFixed(1)}%`;
    if (probK) probK.textContent = `${nextMeta.keep.toFixed(1)}%`;
    if (probB) probB.textContent = `${nextMeta.break.toFixed(1)}%`;
    if (actionBtn) {
      actionBtn.disabled = false;
      const extra = autoBuyExtraCost();
      actionBtn.textContent = `${gambleMode ? '🎲 ' : ''}+${currentEnhanceLevel + 1} 강화 시도 (${nextCost}P${extra ? ` + 🛒${extra}P` : ''})`;
      if (tprotectActive()) actionBtn.textContent = `${gambleMode ? '🎲 ' : ''}+${currentEnhanceLevel + 1} 강화 시도 (${nextCost}P + 🌌${tprotectPrice(currentEnhanceLevel).toLocaleString()}P)`;
      if (transcendBlocked()) { actionBtn.disabled = true; actionBtn.textContent = '🔒 초월 강화 체크 후 가능'; }
    }
  }

  const now = Date.now();
  enhanceActionTimestamps = enhanceActionTimestamps.filter(t => now - t < 60000);
  const cdEl = document.getElementById('enhanceCooldownText');
  if (cdEl) cdEl.textContent = `분당 강화: ${enhanceActionTimestamps.length} / ${enhancePerMinLimit()}회${typeof myTierKey === 'function' && myTierKey() ? ` (${myTierKey() === 'black' ? '🖤 블랙' : '🥇 골드'})` : ''}`;

  localStorage.setItem('bapsim_enhance_level', currentEnhanceLevel.toString());
  syncEnhanceToCloud();
}

function renderEnhanceTable() {
  const tbody = document.getElementById('enhanceProbTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  ENHANCE_PROBABILITIES.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = (currentEnhanceLevel === p.level - 1) ? 'bg-amber-500/10 font-bold' : '';
    const bowlInfo = BOWL_EVOLUTION[p.level] || { icon: '🍚', name: '' };
    tr.innerHTML = `
      <td class="py-1 text-slate-300">+${p.level}</td>
      <td class="py-1 text-left pl-2 text-slate-200 truncate max-w-[120px]">${bowlInfo.icon} ${bowlInfo.name}</td>
      <td class="py-1 text-emerald-400">${p.success.toFixed(1)}%</td>
      <td class="py-1 text-amber-400">${p.keep.toFixed(1)}%</td>
      <td class="py-1 text-rose-400">${Math.max(0, 100 - p.success - p.keep).toFixed(1)}%</td>
      <td class="py-1 text-amber-300">${p.reward.toLocaleString()}P</td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleEnhanceProbTable() {
  const c = document.getElementById('enhanceProbTableContainer');
  if (c) c.classList.toggle('hidden');
}

// ==========================================
// 강화 아이템 & 골든타임
// ==========================================
// 🏦 수수료 (전부 은행 금고로): 아이템 구매 10%, 밥 판매 10%
const ITEM_FEE_RATE = 0.1;
const SELL_FEE_RATE = 0.1; // 기본. 💎 골드 8% · 블랙 5% → sellFeeRate()
function curSellFee() { return typeof sellFeeRate === 'function' ? sellFeeRate() : SELL_FEE_RATE; }
function itemFee(kind) { return Math.round(ENHANCE_ITEMS[kind].price * ITEM_FEE_RATE); }
function itemTotal(kind) { return ENHANCE_ITEMS[kind].price + itemFee(kind); }
const ENHANCE_ITEMS = {
  protect: { name: '🛡️ 파괴 방지권', price: 600, desc: '이번 강화에서 밥이 타면 대신 유지돼요' },
  bless:   { name: '✨ 축복 주문서', price: 300, desc: '이번 강화 성공 확률 1.5배' }
};
// 평일 점심시간(11:30~13:00) 성공 확률 보너스
const GOLDEN_TIME = { start: 11 * 60 + 30, end: 13 * 60, mult: 1.5 };

let myItems = { protect: 0, bless: 0 };
let gambleMode = false; // 🎲 도박 강화: 비용 2배 · 성공 확률 2배(최대 95%) · 실패하면 무조건 파괴
const JUMP_CHANCE = 0.05; // +5강 이상에서 성공하면 5% 확률로 한 번에 +2 (대박 점프)

const ENHANCE_RECOMMEND = ['기본','기본','기본','기본','기본','기본','도박','도박','축복+도박','축복+도박',
  '도박','기본','기본','축복','축복+방지권','축복+도박','축복','축복+방지권','축복+방지권','축복+방지권',
  '축복+도박','축복','축복','축복+도박','축복','축복','축복+도박','축복','축복+도박','축복'];
function renderEnhanceRecommend() {
  const el = document.getElementById('enhanceRecommend');
  if (!el) return;
  if (currentEnhanceLevel >= ENHANCE_MAX) { el.textContent = ''; return; }
  const rec = ENHANCE_RECOMMEND[currentEnhanceLevel];
  const mine = [useItem.bless && myItems.bless > 0 ? '축복' : '', !gambleMode && useItem.protect && myItems.protect > 0 ? '방지권' : '', gambleMode ? '도박' : ''].filter(Boolean).join('+') || '기본';
  el.innerHTML = `💡 +${currentEnhanceLevel}→+${currentEnhanceLevel + 1} 추천: <strong class="text-amber-300">${rec}</strong>${mine === rec ? ' <span class="text-emerald-400">✓ 지금 설정과 같아요</span>' : ` <span class="text-slate-500">(지금: ${mine})</span>`}`;
}

function currentAttemptCost() {
  return getEnhanceCost(currentEnhanceLevel) * (gambleMode ? 2 : 1);
}
function toggleGambleMode() {
  gambleMode = !gambleMode;
  renderEnhanceItems();
  updateEnhanceUI();
}
let useItem = { protect: false, bless: false };

function loadItemsFromUser(val) {
  const it = (val && val.items) || {};
  myItems = { protect: Math.max(0, Number(it.protect) || 0), bless: Math.max(0, Number(it.bless) || 0) };
  if (myItems.protect === 0 && !autoUse.protect) useItem.protect = false;
  if (myItems.bless === 0 && !autoUse.bless) useItem.bless = false;
  renderEnhanceItems();
}

// 골든타임은 폐지 (언제 해도 같은 조건). 예전 코드 호환용으로 함수만 남김
function isGoldenTime() { return false; }

// 아이템/골든타임을 반영한 이번 강화의 실제 확률
function effectiveOdds(level) {
  const base = ENHANCE_PROBABILITIES[level];
  if (!base) return null;
  // 파괴 확률은 '성공·유지를 뺀 나머지' (예전부터 실제 판정 방식. 표의 숫자 합이 100이 아닌 단계가 있어 보정)
  // 소수점 오차(예: 100 - 79.8 - 20.2 = 0.0000000000000142) 때문에 파괴 0% 단계가 0이 아닌 것으로 계산되던 문제 방지
  let success = base.success, keep = base.keep, brk = Math.max(0, Math.round((100 - base.success - base.keep) * 1000) / 1000);
  let mult = 1;
  const successBeforeBless = success;
  if (isGoldenTime()) mult *= GOLDEN_TIME.mult;
  const blessOn = useItem.bless && (myItems.bless > 0 || autoWanted().bless);
  if (blessOn) mult *= 1.5;
  if (mult > 1) {
    // 늘어난 성공 확률은 '유지'에서 먼저, 모자라면 '파괴'에서 가져옴
    const want = Math.min(100, success * mult) - success;
    const fromKeep = Math.min(keep, want);
    keep -= fromKeep;
    const fromBreak = Math.min(brk, want - fromKeep);
    brk -= fromBreak;
    success += fromKeep + fromBreak;
  }
  if (gambleMode) {
    // 도박: 성공 2배, 유지 없음 (실패 = 파괴), 방지권 효과 없음
    success = Math.min(95, success * 2);
    keep = 0;
    brk = 100 - success;
  }
  const keepBase = keep; // 방지권 적용 전 '유지' 구간 (그 뒤 구간은 원래 '파괴')
  const tprot = level >= NO_PROTECT_FROM && tprotectActive() && brk > 0;
  const protectedNow = tprot || (level < NO_PROTECT_FROM && !gambleMode && useItem.protect && (myItems.protect > 0 || autoWanted().protect) && brk > 0);
  if (protectedNow) { keep += brk; brk = 0; }
  return { success, keep, keepBase, break: brk, golden: isGoldenTime(), blessed: blessOn, blessGain: Math.min(100, successBeforeBless * 1.5) - successBeforeBless, protected: protectedNow, tprotect: tprot, gamble: gambleMode };
}

function buyEnhanceItem(kind) {
  if (!checkApprovalGuard()) return;
  const it = ENHANCE_ITEMS[kind];
  const qty = 1;
  const total = itemTotal(kind) * qty, fee = itemFee(kind) * qty;
  if (userPoints < total) return alert(`❌ 포인트가 부족해요! (${it.name} ${total.toLocaleString()}P · 수수료 포함)`);
  addPoints(-total, `${it.name} 구매 (수수료 ${fee}P 포함)`);
  if (typeof payFee === 'function') payFee(fee);
  myItems[kind] += qty;
  db.ref(`user_points/${currentUser.nickname}/items/${kind}`).set(myItems[kind]);
  updatePointsUI();
  renderEnhanceItems();
  updateEnhanceUI();
}

function toggleEnhanceItem(kind) {
  if (kind === 'protect' && currentEnhanceLevel >= NO_PROTECT_FROM) return alert(`🚫 +${NO_PROTECT_FROM + 1}강부터는 파괴 방지권을 쓸 수 없어요! (+20강부터 타면 +0강으로 리셋)`);
  if (myItems[kind] <= 0) return buyEnhanceItem(kind);
  if (autoUse[kind]) { autoUse[kind] = false; saveAutoUse(); } // 직접 누르면 자동 적용은 해제
  useItem[kind] = !useItem[kind];
  renderEnhanceItems();
  updateEnhanceUI();
}

// ==========================================
// ✅ 아이템 자동 적용 (이 기기에 저장되는 개인 설정)
//  - 체크하면 강화할 때마다 보유 중인 아이템을 자동으로 사용
//  - '추천 단계에서만'을 켜면 💡 추천 조합에 포함된 단계에서만 사용
//  - 효과가 없는 단계(이미 100% 성공, 파괴 확률 0%)에서는 아이템을 아끼고 쓰지 않음
// ==========================================
let autoUse = { protect: false, bless: false, recOnly: false };
try { autoUse = Object.assign(autoUse, JSON.parse(localStorage.getItem('bapsim_auto_items') || '{}')); } catch (e) {}
function saveAutoUse() { try { localStorage.setItem('bapsim_auto_items', JSON.stringify(autoUse)); } catch (e) {} }

function setAutoUse(kind, on) {
  autoUse[kind] = !!on;
  saveAutoUse();
  applyAutoItems();
  renderEnhanceItems();
  updateEnhanceUI();
}

// 이번 단계에서 자동으로 쓰고 싶은 아이템 (보유 여부와 무관)
function autoWanted() {
  const want = { protect: false, bless: false };
  if (currentEnhanceLevel >= ENHANCE_MAX) return want;
  const rec = ENHANCE_RECOMMEND[currentEnhanceLevel] || '';
  const base = ENHANCE_PROBABILITIES[currentEnhanceLevel];
  if (!base) return want;
  const breakBase = Math.max(0, Math.round((100 - base.success - base.keep) * 1000) / 1000);
  want.bless = autoUse.bless && base.success < 100 && (!autoUse.recOnly || rec.includes('축복'));
  want.protect = autoUse.protect && !gambleMode && breakBase > 0 && currentEnhanceLevel < NO_PROTECT_FROM && (!autoUse.recOnly || rec.includes('방지권'));
  return want;
}

// 자동 적용: 확률 표시는 '자동 구매까지 해서 쓸 것'을 기준으로 보여줌
function applyAutoItems() {
  const want = autoWanted();
  if (autoUse.bless) useItem.bless = want.bless;
  if (autoUse.protect) useItem.protect = want.protect;
}

// 자동 구매: 쓰려는 아이템이 없으면 강화 직전에 1개 사서 바로 사용
// (강화비까지 낼 포인트가 있을 때만. 부족하면 아이템 없이 강화)
function autoBuyForAttempt(attemptCost) {
  const want = autoWanted();
  const bought = [];
  let budget = userPoints - attemptCost;
  ['bless', 'protect'].forEach(kind => {
    if (!want[kind] || myItems[kind] > 0) return;
    const price = itemTotal(kind);
    if (budget < price) { useItem[kind] = false; return; }
    budget -= price;
    addPoints(-price, `${ENHANCE_ITEMS[kind].name} 자동 구매 (수수료 포함)`);
    if (typeof payFee === 'function') payFee(itemFee(kind));
    myItems[kind] += 1;
    bought.push(kind);
  });
  if (bought.length && canSyncToCloud()) {
    const upd = {};
    bought.forEach(k => { upd[`items/${k}`] = myItems[k]; });
    db.ref(`user_points/${currentUser.nickname}`).update(upd);
  }
  return bought;
}

// 이번 시도에 자동 구매로 추가될 금액 (버튼 표시용)
function autoBuyExtraCost() {
  const want = autoWanted();
  return ['bless', 'protect'].reduce((a, k) => a + (want[k] && myItems[k] <= 0 ? itemTotal(k) : 0), 0);
}

function renderEnhanceItems() {
  ['protect', 'bless'].forEach(kind => {
    const btn = document.getElementById(`enhItem_${kind}`);
    if (!btn) return;
    const on = useItem[kind] && (myItems[kind] > 0 || (autoUse[kind] && autoWanted()[kind]));
    btn.className = `relative py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${on ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/60'}`;
    btn.innerHTML = `${ENHANCE_ITEMS[kind].name} <span class="font-black">x${myItems[kind]}</span>
      <span class="block text-[9px] font-medium ${on ? 'text-slate-800' : 'text-slate-500'}">${autoUse[kind] ? (on ? (myItems[kind] > 0 ? '🤖 자동 적용 중' : `🤖 자동 구매+적용 (${itemTotal(kind)}P)`) : '🤖 자동 (이번 단계는 아낌)') : myItems[kind] > 0 ? (on ? '사용 중 (1회 소모)' : '눌러서 사용') : `없음 · 눌러서 구매 ${itemTotal(kind).toLocaleString()}P`}</span>`;
    if (kind === 'protect' && tprotectAvailable()) {
      const on = tprotectActive();
      btn.className = `relative py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${on ? 'tprotect-on text-white border-amber-300' : 'bg-slate-950 text-slate-200 border-fuchsia-500/50 hover:border-amber-300/70'}`;
      btn.onclick = toggleTProtect;
      btn.innerHTML = `🌌 초월 방지권 <span class="text-[9px] font-black text-amber-300">BLACK</span><span class="block text-[9px] font-bold ${on ? 'text-amber-200' : 'text-slate-400'}">${on ? `사용 중 · 시도마다 ${tprotectPrice(currentEnhanceLevel).toLocaleString()}P` : `눌러서 사용 · 이번 ${tprotectPrice(currentEnhanceLevel).toLocaleString()}P`}</span>`;
      return;
    }
    if (kind === 'protect') btn.onclick = () => toggleEnhanceItem('protect');
    if (kind === 'protect' && currentEnhanceLevel >= NO_PROTECT_FROM) {
      btn.className = 'relative py-2 px-2 rounded-xl text-[11px] font-bold border bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed';
      btn.innerHTML = `${ENHANCE_ITEMS[kind].name} <span class="font-black">x${myItems[kind]}</span><span class="block text-[9px] font-bold text-rose-400/80">🚫 +21강부터 사용 불가</span>`;
    }
  });
  ['protect', 'bless', 'recOnly'].forEach(k => {
    const cb = document.getElementById(`autoUse_${k}`);
    if (cb) cb.checked = !!autoUse[k];
  });
  const recWrap = document.getElementById('autoUse_recOnly_wrap');
  if (recWrap) recWrap.classList.toggle('opacity-40', !(autoUse.protect || autoUse.bless));
  ['protect', 'bless'].forEach(kind => {
    const b = document.getElementById(`enhBuy_${kind}`);
    if (b) b.textContent = `+1 (${itemTotal(kind).toLocaleString()}P)`;
  });
  const g = document.getElementById('enhanceGoldenBanner');
  if (g) g.classList.toggle('hidden', !isGoldenTime());
  const gb = document.getElementById('enhGambleBtn');
  if (gb) {
    gb.className = `w-full py-2 px-2 rounded-xl text-[11px] font-black border transition-all ${gambleMode ? 'gamble-on text-white border-rose-300' : 'bg-slate-900 text-rose-300 border-rose-500/40 hover:border-rose-400'}`;
    gb.innerHTML = gambleMode
      ? '🎲 도박 강화 ON <span class="block text-[9px] font-bold text-rose-100">비용 2배 · 성공 확률 2배 · 실패하면 무조건 타버림</span>'
      : '🎲 도박 강화 OFF <span class="block text-[9px] font-medium text-slate-500">눌러서 켜기: 비용 2배, 성공 2배, 유지 없음</span>';
  }
}

function consumeUsedItems(odds) {
  const used = {};
  ['protect', 'bless'].forEach(kind => {
    if (kind === 'protect' && gambleMode) return;
    // 효과가 없었던 아이템은 소모하지 않음 (파괴 0% 단계의 방지권, 이미 100% 성공인 단계의 축복서)
    if (odds && kind === 'protect' && (!odds.protected || odds.tprotect)) return; // 초월 방지권은 따로 결제
    if (odds && kind === 'bless' && !(odds.blessed && odds.blessGain > 0)) return;
    if (useItem[kind] && myItems[kind] > 0) {
      myItems[kind]--;
      used[`items/${kind}`] = myItems[kind];
      if (myItems[kind] === 0 && !autoUse[kind]) useItem[kind] = false;
    }
  });
  applyAutoItems();
  if (Object.keys(used).length && canSyncToCloud()) db.ref(`user_points/${currentUser.nickname}`).update(used);
  renderEnhanceItems();
}

let enhanceRevealing = false;

function runEnhancement() {
  if (enhanceRevealing) return;
  if (currentEnhanceLevel >= ENHANCE_MAX) return alert(`이미 ${ENHANCE_MAX}강 최고 단계에 도달했습니다! 판매하여 정산하세요.`);
  if (transcendBlocked()) {
    const al = document.getElementById('enhanceStatusAlert');
    if (al) al.innerHTML = '<span class="text-fuchsia-300 font-black text-xs">🔒 +20강에서 더 강화하려면 위의 [🌌 초월 강화 도전]을 체크하세요. (팔려면 [밥 판매 및 정산])</span>';
    return;
  }

  const now = Date.now();
  enhanceActionTimestamps = enhanceActionTimestamps.filter(t => now - t < 60000);
  if (enhanceActionTimestamps.length >= enhancePerMinLimit()) {
    const oldest = enhanceActionTimestamps[0];
    const remSec = Math.ceil((60000 - (now - oldest)) / 1000);
    return alert(`⏳ 분당 강화 횟수(${enhancePerMinLimit()}회)를 초과했습니다!\n잠시 후 (${remSec}초 뒤) 다시 시도해주세요.`);
  }

  const cost = currentAttemptCost();
  const tpCost = tprotectActive() ? tprotectPrice(currentEnhanceLevel) : 0;
  if (tpCost && userPoints < cost + tpCost) return alert(`❌ 포인트가 부족해요! (강화 ${cost.toLocaleString()}P + 초월 방지권 ${tpCost.toLocaleString()}P)`);
  if (userPoints < cost) {
    return alert(`❌ 강화 비용이 부족합니다! (필요: ${cost}P / 보유: ${userPoints}P)`);
  }

  applyAutoItems();
  const autoBought = autoBuyForAttempt(cost);
  addPoints(-cost, `${gambleMode ? '도박 ' : ''}강화 시도 +${currentEnhanceLevel}→+${currentEnhanceLevel + 1}`);
  if (tpCost) {
    addPoints(-tpCost, `🌌 초월 방지권 (+${currentEnhanceLevel})`);
    if (typeof payFee === 'function') payFee(Math.round(tpCost * 0.1));
  }
  enhanceActionTimestamps.push(now);

  const odds = effectiveOdds(currentEnhanceLevel);
  const alertEl = document.getElementById('enhanceStatusAlert');
  const actionBtn = document.getElementById('enhanceActionBtn');
  const avatar = document.getElementById('enhanceBowlAvatar');
  const fromLevel = currentEnhanceLevel;
  const roll = Math.random() * 100;
  const tags = [autoBought.length ? '🛒자동구매' : '', odds.gamble ? '🎲도박' : '', odds.golden ? '🌞골든타임' : '', odds.blessed ? '✨축복' : '', odds.protected ? '🛡️방지권' : ''].filter(Boolean).join(' ');
  consumeUsedItems(odds);
  myBowl.tries += 1;
  myBowl.cost += cost + tpCost + (odds.protected && !odds.tprotect ? itemTotal('protect') : 0) + (odds.blessed && odds.blessGain > 0 ? itemTotal('bless') : 0);
  myBowlDirty = true;
  updatePointsUI(); // 포인트 차감 + 이 밥 기록을 한 번에 저장

  // 결과는 바로 확정·저장하고, 화면 공개만 연출로 늦춤 (창을 닫아도 결과는 그대로)
  let outcome, msg, jumped = false;
  if (roll < odds.success) {
    outcome = 'success';
    jumped = fromLevel >= 5 && fromLevel + 2 <= ENHANCE_MAX && Math.random() < JUMP_CHANCE;
    currentEnhanceLevel = fromLevel + (jumped ? 2 : 1);
    const evolvedBowl = BOWL_EVOLUTION[currentEnhanceLevel];
    msg = jumped
      ? `<span class="text-fuchsia-300 font-black text-xs">🌟 대박 점프!! +${fromLevel} → +${currentEnhanceLevel}강 [${esc(evolvedBowl.name)}] ${tags}</span>`
      : `<span class="text-emerald-400 font-extrabold text-xs">🎉 +${currentEnhanceLevel}강 [${esc(evolvedBowl.name)}] 성공! ${tags}</span>`;
  } else if (roll < (odds.success + odds.keep)) {
    outcome = odds.protected && roll >= (odds.success + odds.keepBase) ? 'saved' : 'keep';
    const near = roll - odds.success < 2 ? ` <span class="text-rose-300">😱 아깝다! (${(roll - odds.success).toFixed(1)}%p 차이)</span>` : '';
    msg = outcome === 'saved'
      ? `<span class="text-sky-300 font-black text-xs">🛡️ 방지권 발동! 밥이 탈 뻔했지만 지켜냈어요!</span>`
      : `<span class="text-amber-400 font-bold text-xs">⚠️ 강화 실패! 밥은 유지되었습니다. ${tags}${near}</span>`;
  } else {
    outcome = 'break';
    currentEnhanceLevel = enhanceCheckpoint(fromLevel);
    const near = roll - odds.success < 2 ? ' 😱 정말 아깝다!' : '';
    msg = `<span class="text-rose-500 font-black text-xs">💥 밥이 타버렸습니다!${near} ${currentEnhanceLevel > 0 ? `(안전 구간 +${currentEnhanceLevel}강으로 내려감)` : fromLevel >= 20 ? `(+${fromLevel}강 초월 밥이 재가 되어 +0강으로...)` : '(+0 따스한 햇쌀밥으로 리셋)'}</span>`;
  }
  syncEnhanceToCloud();
  if (outcome === 'success') recordSeasonProgress(currentEnhanceLevel);

  const reveal = () => {
    enhanceRevealing = false;
    alertEl.innerHTML = msg;
    if (avatar) {
      avatar.classList.remove('enh-success', 'enh-fail', 'enh-break', 'enh-suspense');
      void avatar.offsetWidth;
      avatar.classList.add(outcome === 'success' ? 'enh-success' : outcome === 'break' ? 'enh-break' : 'enh-fail');
    }
    if (outcome === 'success') {
      const evolvedBowl = BOWL_EVOLUTION[currentEnhanceLevel];
      if ((currentEnhanceLevel >= 15 || jumped) && window.confetti) confetti({ particleCount: jumped ? 220 : 150, spread: jumped ? 120 : 70 });
      if ([20, 25, 30].includes(currentEnhanceLevel) || (jumped && fromLevel < 25 && currentEnhanceLevel > 25)) postFeed('enhance', `${currentEnhanceLevel >= 30 ? '💫' : '👑'} +${currentEnhanceLevel}강 [${evolvedBowl.name}] 달성!! ${evolvedBowl.icon}`, 'legendary', true);
      if (jumped) postFeed('enhance', `🌟 대박 점프! +${fromLevel} → +${currentEnhanceLevel}강 [${evolvedBowl.name}] ${evolvedBowl.icon}`, currentEnhanceLevel >= 15 ? 'big' : 'normal');
      else if (currentEnhanceLevel >= 10) postFeed('enhance', `${odds.gamble ? '🎲 도박 강화로 ' : ''}+${currentEnhanceLevel}강 [${evolvedBowl.name}] 강화 성공! ${evolvedBowl.icon}`,
        currentEnhanceLevel >= 17 ? 'legendary' : currentEnhanceLevel >= 13 ? 'big' : 'normal');
      if (currentEnhanceLevel >= 10) maybeDropCard(`+${currentEnhanceLevel}강 성공`, 10 + (currentEnhanceLevel - 10) * 4, (currentEnhanceLevel - 10) * 1.5);
    } else if (outcome === 'break' && fromLevel >= 10) {
      postFeed('enhance', `${odds.gamble ? '🎲 도박 강화 실패! ' : ''}+${fromLevel}강 밥이 새까맣게 타버렸어요... 💥`, fromLevel >= 14 ? 'big' : 'normal');
    }
    updateEnhanceUI();
    renderEnhanceTable();
    if (actionBtn) actionBtn.disabled = currentEnhanceLevel >= ENHANCE_MAX;
  };

  // 딜레이 없이 결과 바로 공개 (예전 +12강 이상 0.9초 두근두근 연출 제거)
  reveal();
}

// ==========================================
// 📈 오늘의 밥 시세: 1분마다 바뀌는 판매가 배율 (모든 회원 동일)
// 평균은 약 1.0배. 상승·폭등 때 팔면 이득, 하락·폭락 때 팔면 손해 → 언제 팔지가 승부
// ==========================================
const MARKET_SLOT_MS = 60 * 1000; // 1분마다 시세 변동
function seeded01(seed) {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// 🔒 시세는 이제 미리 알 수 없음 (2026-10-23)
//  - 예전: 시각만으로 계산하는 공개 공식 → 콘솔로 미래 폭등 시각을 알 수 있었고,
//          serverTimeOffset 을 바꾸면 지금 당장 원하는 시세로 팔 수도 있었음
//  - 지금: 매분 그 분에 처음 시세를 본 사람이 market/{분} 에 '서버 시각(밀리초)'만 기록하고,
//          시세는 그 밀리초 값으로 정해짐 → 아무도 미리 모르고, 기록하는 사람도 고를 수 없음
//          (보안 규칙: 그 1분 안에만, 한 번만, at 은 서버 시각이어야 함)
//  - 시계는 ServerClock(잠긴 객체)만 사용 → 콘솔로 시차를 바꿔도 소용없음
const ServerClock = (() => {
  let off = 0;
  db.ref('.info/serverTimeOffset').on('value', s => { off = Number(s.val()) || 0; });
  return Object.freeze({ now: () => Date.now() + off });
})();
const marketCache = {};      // 분(slot) → { s, at }
const marketEnsuring = {};
let marketFeedOn = false;
function startMarketFeed() {
  if (marketFeedOn) return;
  marketFeedOn = true;
  db.ref('market').orderByKey().limitToLast(15).on('value', snap => {
    const v = snap.val() || {};
    Object.entries(v).forEach(([k, x]) => { if (x && typeof x.at === 'number') marketCache[k] = x; });
    if (typeof renderRiceMarket === 'function') renderRiceMarket();
  }, () => { marketFeedOn = false; });
}
function marketFromAt(slot, at) {
  const ms = Math.floor(Number(at) % 1000000007);
  const u = seeded01(ms * 7919 + 13), v = seeded01(ms * 104729 + slot % 100000 + 7);
  let mult, label, tone;
  if (u < 0.003)      { mult = 2.5;              label = '💥 초폭등'; tone = 'up3'; } // 0.3%
  else if (u < 0.015) { mult = 1.6 + 0.6 * v;    label = '🚀 폭등'; tone = 'up2'; }  // 1.2% (x1.6~2.2)
  else if (u < 0.12)  { mult = 1.15 + 0.15 * v;  label = '📈 상승'; tone = 'up'; }
  else if (u < 0.76)  { mult = 0.95 + 0.15 * v;  label = '➖ 보합'; tone = 'flat'; }
  else if (u < 0.94)  { mult = 0.8 + 0.1 * v;    label = '📉 하락'; tone = 'down'; }
  else                { mult = 0.65;             label = '💀 폭락'; tone = 'down2'; }
  return { mult: Math.round(mult * 100) / 100, label, tone };
}
async function ensureMarketSlot(slot) {
  if (marketEnsuring[slot] || marketCache[slot]) return;
  if (typeof authUser === 'undefined' || !authUser) return;
  marketEnsuring[slot] = true;
  try {
    const ref = db.ref(`market/${slot}`);
    const res = await ref.transaction(cur => (cur ? undefined : { s: slot, at: firebase.database.ServerValue.TIMESTAMP }));
    const val = res.snapshot && res.snapshot.val();
    if (val && typeof val.at === 'number') marketCache[slot] = val;
    else { const got = (await ref.once('value')).val(); if (got && typeof got.at === 'number') marketCache[slot] = got; }
    if (Math.random() < 0.05) pruneOldMarket(slot);
  } catch (e) { /* 다음 틱에 다시 */ }
  finally { marketEnsuring[slot] = false; if (typeof renderRiceMarket === 'function') renderRiceMarket(); }
}
function pruneOldMarket(slot) {
  db.ref('market').orderByKey().endAt(String(slot - 1500)).limitToFirst(100).once('value').then(snap => {
    const del = {}; snap.forEach(c => { del[c.key] = null; });
    if (Object.keys(del).length) db.ref('market').update(del).catch(() => {});
  }).catch(() => {});
}
function riceMarket(ts) {
  const nowTs = ServerClock.now();
  if (ts == null) ts = nowTs;
  const slot = Math.floor(ts / MARKET_SLOT_MS);
  const endsAt = (slot + 1) * MARKET_SLOT_MS;
  startMarketFeed();
  const rec = marketCache[slot];
  if (!rec) {
    if (slot === Math.floor(nowTs / MARKET_SLOT_MS)) ensureMarketSlot(slot);
    return { mult: 1, label: '⏳ 시세 확인 중', tone: 'flat', slot, endsAt, pending: true };
  }
  return Object.assign(marketFromAt(slot, rec.at), { slot, endsAt });
}

function renderRiceMarket() {
  const box = document.getElementById('riceMarketPanel');
  if (!box) return;
  const nowTs = ServerClock.now();
  const mk = riceMarket(nowTs);
  const left = Math.max(0, mk.endsAt - nowTs);
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  const hist = [];
  for (let i = 8; i >= 0; i--) hist.push(riceMarket(nowTs - i * MARKET_SLOT_MS));
  const color = { up3: 'text-amber-300', up2: 'text-fuchsia-300', up: 'text-emerald-300', flat: 'text-slate-300', down: 'text-sky-300', down2: 'text-rose-400' }[mk.tone];
  box.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="text-[11px] font-black text-slate-300">오늘의 밥 시세</span>
      <span class="text-[10px] text-slate-500">다음 변동 ${mm}:${String(ss).padStart(2, '0')}</span>
    </div>
    <div class="flex items-end justify-between gap-2 mt-1">
      <div class="${color} font-black text-lg leading-none ${mk.tone === 'up2' || mk.tone === 'up3' ? 'animate-pulse' : ''}">${mk.label} x${mk.mult.toFixed(2)}</div>
      <div class="flex items-end gap-0.5 h-7">
        ${hist.map((h, i) => h.pending ? `<div title="기록 없음" class="w-2 rounded-sm bg-slate-700 opacity-40" style="height:20%"></div>` : `<div title="x${h.mult.toFixed(2)}" class="w-2 rounded-sm ${h.mult >= 1.6 ? 'bg-fuchsia-400' : h.mult >= 1.15 ? 'bg-emerald-400' : h.mult >= 0.95 ? 'bg-slate-500' : 'bg-rose-400'} ${i === hist.length - 1 ? 'ring-1 ring-amber-300' : 'opacity-70'}" style="height:${Math.min(100, Math.round((h.mult - 0.5) / 2.0 * 100))}%"></div>`).join('')}
      </div>
    </div>`;
}
let lastSpikeAlertSlot = null;
function checkMarketSpikeAlert() {
  const mk = riceMarket();
  if (lastSpikeAlertSlot === null) { lastSpikeAlertSlot = mk.slot; return; } // 처음 접속한 순간은 알리지 않음
  if (mk.slot === lastSpikeAlertSlot || mk.pending) return;
  lastSpikeAlertSlot = mk.slot;
  if (mk.tone !== 'up3') return; // 알림은 초폭등(x2.5)만
  if (typeof canSyncToCloud === 'function' && !canSyncToCloud()) return;
  const box = document.getElementById('feedToastContainer');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `feed-toast ${mk.tone === 'up3' ? 'feed-toast-legendary' : 'feed-toast-big'}`;
  el.innerHTML = `<div class="text-[10px] font-black opacity-80">📈 밥 시세 알림</div>
    <div class="text-sm font-black">${mk.label}! 지금 1분 동안 판매가 x${mk.mult.toFixed(2)}</div>
    <div class="text-[11px] font-bold text-slate-600">${currentEnhanceLevel > 0 ? `내 +${currentEnhanceLevel}강 밥을 지금 팔면 약 ${Math.round(ENHANCE_PROBABILITIES[currentEnhanceLevel - 1].reward * mk.mult).toLocaleString()}P` : '밥키우기에서 확인하세요'}</div>`;
  el.style.cursor = 'pointer';
  el.onclick = () => { if (typeof openEnhanceModal === 'function') openEnhanceModal(); el.remove(); };
  box.appendChild(el);
  if (mk.tone === 'up3' && window.confetti) confetti({ particleCount: 150, spread: 120, origin: { y: 0.2 } });
  setTimeout(() => el.classList.add('feed-toast-out'), 9000);
  setTimeout(() => el.remove(), 9700);
}

setInterval(() => {
  checkMarketSpikeAlert();
  const m = document.getElementById('enhanceModal');
  if (m && !m.classList.contains('hidden')) {
    const prevSlot = renderRiceMarket.lastSlot;
    const slot = riceMarket().slot;
    if (prevSlot !== slot) { renderRiceMarket.lastSlot = slot; updateEnhanceUI(); } else renderRiceMarket();
  }
}, 1000);

function sellEnhancedBowl() {
  if (enhanceRevealing) return;
  if (currentEnhanceLevel <= 0) return alert("현재 +0단계 밥은 판매할 수 없습니다. 강화 후 판매하세요!");

  const mk = riceMarket();
  if (mk.pending) return alert('⏳ 이번 분 시세를 확인하는 중이에요. 1~2초 뒤에 다시 눌러주세요!');
  const base = ENHANCE_PROBABILITIES[currentEnhanceLevel - 1].reward;
  const reward = Math.round(base * mk.mult);
  const currentName = BOWL_EVOLUTION[currentEnhanceLevel]?.name || '밥';
  const fee0 = Math.round(reward * curSellFee());
  const inv = myBowl.cost, tries = myBowl.tries;
  if (!confirm(`+${currentEnhanceLevel}강 [${currentName}] 판매\n\n기본 ${base.toLocaleString()}P × 시세 ${mk.label} x${mk.mult.toFixed(2)} = ${reward.toLocaleString()}P\n🏦 판매 수수료 ${Math.round(curSellFee() * 100)}%: -${fee0.toLocaleString()}P (은행 금고로)\n받는 금액: ${(reward - fee0).toLocaleString()}P\n\n🧾 이 밥에 들인 돈: ${inv.toLocaleString()}P (강화 ${tries.toLocaleString()}회)\n예상 손익: ${(reward - fee0 - inv) >= 0 ? '+' : ''}${(reward - fee0 - inv).toLocaleString()}P (대박 손님 제외)\n\n판매 후 밥은 +0단계로 리셋됩니다. 판매할까요?`)) return;
  if (riceMarket().slot !== mk.slot) return alert('⏳ 그 사이 시세가 바뀌었어요! 새 시세를 확인하고 다시 눌러주세요.');

  // 🎉 대박 손님: 5% 확률로 판매금 2배
  const lucky = Math.random() < 0.05;
  const gross = lucky ? reward * 2 : reward;
  const sellFee = Math.round(gross * curSellFee());
  const paid = gross - sellFee;
  const owedBefore = myOwed;
  addPoints(paid, `+${currentEnhanceLevel}강 밥 판매 (시세 x${mk.mult.toFixed(2)}${lucky ? ' · 대박 손님 x2' : ''} · 수수료 ${sellFee.toLocaleString()}P 제외)`);
  if (typeof payFee === 'function') payFee(sellFee);
  const soldLvl = currentEnhanceLevel;
  currentEnhanceLevel = 0;
  lastSaleSummary = { invest: inv, tries, paid };
  myBowl = { cost: 0, tries: 0 };
  updatePointsUI();
  updateEnhanceUI();
  renderEnhanceTable();

  if (window.confetti) confetti({ particleCount: lucky ? 250 : 100, spread: lucky ? 130 : 70 });
  if (lucky && soldLvl >= 8) postFeed('sell', `🎉 대박 손님 등장! +${soldLvl}강 밥이 2배 값에 팔렸어요 → ${paid.toLocaleString()}P`, paid >= 50000 ? 'legendary' : 'big');
  else if (soldLvl >= 12) postFeed('sell', `+${soldLvl}강 밥을 ${mk.label} 시세(x${mk.mult.toFixed(2)})에 팔아 ${paid.toLocaleString()}P 💰`, mk.mult >= 2 ? 'legendary' : soldLvl >= 16 || mk.mult >= 1.5 ? 'big' : 'normal');
  startDoubleUp(paid, soldLvl, lucky, Math.max(0, myOwed - owedBefore));
}

// ==========================================
// 🎲 더블 오어 낫싱: 판매 대금을 걸고 2배 도전 (최대 3번 = 8배)
// 성공 확률은 단계마다 낮아짐 (50% → 40% → 30%)
// ==========================================
let doubleUp = null;
const DOUBLE_UP_MAX = 3;
// 단계가 올라갈수록 성공 확률 하락: 1단계 50% · 2단계 40% · 3단계 30% (3연속 성공 6%)
// 1단계는 본전 게임, 2·3단계는 손해 쪽 (기대값 80% · 60%)
const DOUBLE_UP_CHANCES = [0.5, 0.4, 0.3];
// 더블업에 걸 수 있는 금액은 판매금(수수료 뺀 받은 금액)의 50% (나머지 50%는 바로 챙김)
// 단, 한도 초과로 ⏳보류된 부분은 아직 손에 없으니 걸 수 없음 → 실제로 들어온 금액까지만
const DOUBLE_UP_STAKE_RATE = 0.5;

function startDoubleUp(amount, soldLvl, lucky = false, held = 0) {
  const stake = Math.max(0, Math.min(Math.floor(amount * DOUBLE_UP_STAKE_RATE), amount - held));
  doubleUp = { amount: stake, round: 0, soldLvl, original: stake, sale: amount, held };
  renderDoubleUp(lucky
    ? `🎉 <strong class="text-amber-300">대박 손님 등장!</strong> 2배 값으로 팔려서 <strong>${amount.toLocaleString()}P</strong>를 받았어요!`
    : `💰 +${soldLvl}강 밥을 팔아 <strong>${amount.toLocaleString()}P</strong>를 받았어요!`, lucky ? 'win' : 'normal');
  if (lastSaleSummary) {
    const box = document.getElementById('doubleUpPanel');
    const net = lastSaleSummary.paid - lastSaleSummary.invest;
    if (box) box.insertAdjacentHTML('afterbegin', `<div class="text-[10px] font-bold ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}">🧾 0강부터 ${lastSaleSummary.tries.toLocaleString()}회 강화 · 들인 돈 ${lastSaleSummary.invest.toLocaleString()}P → 손익 ${net >= 0 ? '+' : ''}${net.toLocaleString()}P${lastSaleSummary.invest > 0 ? ` (${Math.round(lastSaleSummary.paid / lastSaleSummary.invest * 100)}%)` : ''}</div>`);
  }
}

function renderDoubleUp(headline, tone = 'normal') {
  const box = document.getElementById('doubleUpPanel');
  if (!box) return;
  if (!doubleUp) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const canGo = doubleUp.round < DOUBLE_UP_MAX && doubleUp.amount >= 100;
  box.className = `p-3 rounded-2xl border-2 text-xs space-y-2 ${tone === 'win' ? 'border-emerald-400 bg-emerald-950/40' : 'border-fuchsia-500/70 bg-fuchsia-950/30'}`;
  box.innerHTML = `
    <div class="text-slate-200 font-bold">${headline}</div>
    ${doubleUp.held > 0 ? `<div class="text-[10px] text-amber-300 font-bold">⏳ 이 중 ${doubleUp.held.toLocaleString()}P는 최근 수입이 많아 '보류'로 들어갔어요 (사라진 게 아니에요${typeof owedEtaSeconds === 'function' ? ` · ${fmtEtaClock(owedEtaSeconds())}쯤 다 들어와요` : ''}). 보류된 금액은 아직 손에 없어서 더블업에 걸 수 없어요.</div>` : ''}
    ${canGo ? `
      ${doubleUp.round === 0 && doubleUp.sale > doubleUp.amount ? `<div class="text-[10px] text-slate-400">판매금의 최대 ${Math.round(DOUBLE_UP_STAKE_RATE * 100)}%(${doubleUp.amount.toLocaleString()}P)까지만 걸 수 있어요 (나머지 ${(doubleUp.sale - doubleUp.amount).toLocaleString()}P는 이미 내 것 · 실패해도 안전)</div>` : ''}
      <div class="text-[11px] text-fuchsia-200">🎲 <strong>더블 오어 낫싱?</strong> <strong class="text-amber-300">${Math.round(DOUBLE_UP_CHANCES[doubleUp.round] * 100)}%</strong> 확률로 건 돈이 <strong class="text-emerald-300">${(doubleUp.amount * 2).toLocaleString()}P</strong>로, 실패하면 건 <strong class="text-rose-300">${doubleUp.amount.toLocaleString()}P</strong>만 잃어요 (${doubleUp.round + 1}/${DOUBLE_UP_MAX}단계)</div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="stopDoubleUp()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl">✋ 여기서 챙기기</button>
        <button onclick="doDoubleUp()" class="gamble-on text-white font-black py-2 rounded-xl">🎲 더블 도전!</button>
      </div>` : doubleUp.round >= DOUBLE_UP_MAX ? `<div class="text-[11px] text-emerald-300 font-black">🏆 최대 단계 달성! 더 이상 걸 수 없어요.</div>` : `<div class="text-[11px] text-slate-400">이번 판매금은 대부분 보류라 더블 도전은 쉬어 갈게요.</div>`}`;
}

function doDoubleUp() {
  if (!doubleUp || doubleUp.round >= DOUBLE_UP_MAX || doubleUp.busy) return;
  if (userPoints < doubleUp.amount) {
    alert('보류 중인 포인트(⏳)가 섞여 있어서 이번 금액은 더블업에 걸 수 없어요.');
    return stopDoubleUp();
  }
  doubleUp.busy = true;
  const box = document.getElementById('doubleUpPanel');
  if (box) box.innerHTML = `<div class="text-center py-3 text-2xl font-black text-fuchsia-200 animate-pulse">🎲 ... 🎲</div>`;
  const win = Math.random() < DOUBLE_UP_CHANCES[doubleUp.round];
  // 결과는 바로 반영 (연출 중 창을 닫아도 동일)
  const stake = doubleUp.amount;
  if (win) addPoints(stake, `더블업 ${doubleUp.round + 1}단계 성공`);
  else addPoints(-stake, `더블업 ${doubleUp.round + 1}단계 실패`);
  updatePointsUI();
  setTimeout(() => {
    if (!doubleUp) return;
    doubleUp.busy = false;
    if (win) {
      doubleUp.amount = stake * 2;
      doubleUp.round++;
      if (window.confetti) confetti({ particleCount: 60 + doubleUp.round * 50 });
      if (doubleUp.round >= 2 && doubleUp.amount >= 20000) postFeed('doubleup', `🎲 더블업 ${doubleUp.round}연속 성공! 밥 판매금 ${doubleUp.original.toLocaleString()}P → ${doubleUp.amount.toLocaleString()}P`, doubleUp.round >= 3 ? 'legendary' : 'big');
      renderDoubleUp(`🎉 성공! 지금 <strong class="text-emerald-300">${doubleUp.amount.toLocaleString()}P</strong>`, 'win');
    } else {
      if (stake >= 30000) postFeed('doubleup', `🎲 더블업 실패... ${stake.toLocaleString()}P가 한순간에 사라졌어요 😭`, 'normal');
      const lost = stake;
      const safeRest = Math.max(0, (doubleUp.sale || 0) - (doubleUp.original || 0));
      doubleUp = null;
      const b = document.getElementById('doubleUpPanel');
      if (b) {
        b.className = 'p-3 rounded-2xl border-2 border-rose-500/70 bg-rose-950/40 text-xs';
        b.innerHTML = `<div class="text-rose-300 font-black">💸 실패! 건 ${lost.toLocaleString()}P를 잃었어요... 다음엔 꼭!</div>${safeRest > 0 ? `<div class="text-[10px] text-slate-400 mt-1">판매금 나머지 ${safeRest.toLocaleString()}P는 그대로 있어요</div>` : ''}`;
        setTimeout(() => { if (!doubleUp) b.classList.add('hidden'); }, 3500);
      }
    }
  }, 700);
}

function stopDoubleUp() {
  if (!doubleUp || doubleUp.busy) return;
  const got = doubleUp.amount;
  doubleUp = null;
  const b = document.getElementById('doubleUpPanel');
  if (b) {
    b.className = 'p-3 rounded-2xl border-2 border-amber-400/60 bg-amber-950/30 text-xs';
    b.innerHTML = `<div class="text-amber-200 font-black">✅ ${got.toLocaleString()}P 챙겼어요!</div>`;
    setTimeout(() => { if (!doubleUp) b.classList.add('hidden'); }, 2500);
  }
}

function syncEnhanceToCloud() {
  if (!canSyncToCloud()) return;
  // 서버 값과 같으면 저장하지 않음 (화면 갱신 → 저장 → 서버 응답 → 화면 갱신 ... 무한 반복 방지)
  if (currentEnhanceLevel === lastServerState.enhanceLevel) return;
  db.ref(`user_points/${currentUser.nickname}`).update({
    enhanceLevel: currentEnhanceLevel,
    enhanceUpdated: Date.now()
  });
}

// 밥키우기 스페이스바로 강화 시도
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    const enhanceModal = document.getElementById('enhanceModal');
    if (enhanceModal && !enhanceModal.classList.contains('hidden')) {
      const tag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      runEnhancement();
    }
  }
});
