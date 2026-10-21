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
  { level: 20, icon: "👑", name: "태초의 천상 만다라 불멸 영생밥" }
];

const ENHANCE_PROBABILITIES = [
  { level: 1,  success: 100.0, keep: 0.0,  break: 0.0,  reward: 50 },
  { level: 2,  success: 90.6,  keep: 9.4,  break: 0.0,  reward: 120 },
  { level: 3,  success: 79.8,  keep: 20.2, break: 0.0,  reward: 220 },
  { level: 4,  success: 70.1,  keep: 27.9, break: 2.1,  reward: 300 },
  { level: 5,  success: 59.9,  keep: 35.0, break: 5.1,  reward: 420 },
  { level: 6,  success: 50.1,  keep: 39.7, break: 10.2, reward: 590 },
  { level: 7,  success: 45.4,  keep: 44.1, break: 10.5, reward: 790 },
  { level: 8,  success: 40.2,  keep: 49.6, break: 10.3, reward: 1040 },
  { level: 9,  success: 33.6,  keep: 56.6, break: 9.8,  reward: 1320 },
  { level: 10, success: 29.3,  keep: 61.4, break: 9.5,  reward: 1700 },
  { level: 11, success: 25.5,  keep: 64.5, break: 10.1, reward: 2200 },
  { level: 12, success: 23.6,  keep: 65.9, break: 10.6, reward: 2900 },
  { level: 13, success: 19.3,  keep: 70.2, break: 10.5, reward: 3950 },
  { level: 14, success: 18.1,  keep: 72.3, break: 9.7,  reward: 5400 },
  { level: 15, success: 14.8,  keep: 75.5, break: 9.9,  reward: 7800 },
  { level: 16, success: 13.1,  keep: 78.0, break: 9.8,  reward: 9400 },
  { level: 17, success: 10.9,  keep: 76.8, break: 12.6, reward: 12400 },
  { level: 18, success: 9.9,   keep: 79.9, break: 10.7, reward: 19500 },
  { level: 19, success: 4.7,   keep: 86.2, break: 10.6, reward: 40000 },
  { level: 20, success: 3.3,   keep: 90.3, break: 9.9,  reward: 75000 }
];

// 안전 구간: 한 번 도달한 5/10/15강 아래로는 떨어지지 않음
// (예전엔 +19에서 타면 0강부터 다시 → +20 도달 기대 비용이 약 400만P라 사실상 불가능했음)
function enhanceCheckpoint(level) {
  return level >= 15 ? 15 : level >= 10 ? 10 : level >= 5 ? 5 : 0;
}

function getEnhanceCost(lvl) {
  if (lvl < 5) return 100;
  if (lvl < 10) return 150;
  if (lvl < 15) return 250;
  if (lvl < 17) return 400;
  if (lvl < 19) return 800;
  return 1000;
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

  const bowl = BOWL_EVOLUTION[Math.min(currentEnhanceLevel, 20)];
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
  if (sellText) sellText.innerHTML = baseSell > 0
    ? `<span class="text-slate-500 text-[10px] font-bold">${baseSell.toLocaleString()} × ${mk.mult.toFixed(2)} =</span> ${Math.round(baseSell * mk.mult).toLocaleString()}P`
    : '0P';
  renderRiceMarket();

  if (currentEnhanceLevel >= 20) {
    if (costText) costText.textContent = "최대 강화 달성";
    if (probS) probS.textContent = "-";
    if (probK) probK.textContent = "-";
    if (probB) probB.textContent = "-";
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = "20강 최고등급 달성!";
    }
  } else {
    const nextMeta = effectiveOdds(currentEnhanceLevel);
    const nextCost = currentAttemptCost();
    if (costText) costText.textContent = `강화비: ${nextCost}P`;
    if (probS) probS.textContent = `${nextMeta.success.toFixed(1)}%`;
    if (probK) probK.textContent = `${nextMeta.keep.toFixed(1)}%`;
    if (probB) probB.textContent = `${nextMeta.break.toFixed(1)}%`;
    if (actionBtn) {
      actionBtn.disabled = false;
      actionBtn.textContent = `${gambleMode ? '🎲 ' : ''}+${currentEnhanceLevel + 1} 강화 시도 (${nextCost}P)`;
    }
  }

  const now = Date.now();
  enhanceActionTimestamps = enhanceActionTimestamps.filter(t => now - t < 60000);
  const cdEl = document.getElementById('enhanceCooldownText');
  if (cdEl) cdEl.textContent = `분당 강화: ${enhanceActionTimestamps.length} / 100회`;

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
const ENHANCE_ITEMS = {
  protect: { name: '🛡️ 파괴 방지권', price: 1500, desc: '이번 강화에서 밥이 타면 대신 유지돼요' },
  bless:   { name: '✨ 축복 주문서', price: 800,  desc: '이번 강화 성공 확률 1.5배' }
};
// 평일 점심시간(11:30~13:00) 성공 확률 보너스
const GOLDEN_TIME = { start: 11 * 60 + 30, end: 13 * 60, mult: 1.5 };

let myItems = { protect: 0, bless: 0 };
let gambleMode = false; // 🎲 도박 강화: 비용 2배 · 성공 확률 2배(최대 95%) · 실패하면 무조건 파괴
const JUMP_CHANCE = 0.05; // +5강 이상에서 성공하면 5% 확률로 한 번에 +2 (대박 점프)

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
  if (myItems.protect === 0) useItem.protect = false;
  if (myItems.bless === 0) useItem.bless = false;
  renderEnhanceItems();
}

function isGoldenTime() {
  const m = kstMinutesOfDay();
  return isWeekdayKST() && m >= GOLDEN_TIME.start && m < GOLDEN_TIME.end;
}

// 아이템/골든타임을 반영한 이번 강화의 실제 확률
function effectiveOdds(level) {
  const base = ENHANCE_PROBABILITIES[level];
  if (!base) return null;
  // 파괴 확률은 '성공·유지를 뺀 나머지' (예전부터 실제 판정 방식. 표의 숫자 합이 100이 아닌 단계가 있어 보정)
  let success = base.success, keep = base.keep, brk = Math.max(0, 100 - base.success - base.keep);
  let mult = 1;
  if (isGoldenTime()) mult *= GOLDEN_TIME.mult;
  if (useItem.bless && myItems.bless > 0) mult *= 1.5;
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
  const protectedNow = !gambleMode && useItem.protect && myItems.protect > 0 && brk > 0;
  if (protectedNow) { keep += brk; brk = 0; }
  return { success, keep, keepBase, break: brk, golden: isGoldenTime(), blessed: useItem.bless && myItems.bless > 0, protected: protectedNow, gamble: gambleMode };
}

function buyEnhanceItem(kind) {
  if (!checkApprovalGuard()) return;
  const it = ENHANCE_ITEMS[kind];
  const qty = 1;
  if (userPoints < it.price * qty) return alert(`❌ 포인트가 부족해요! (${it.name} ${it.price.toLocaleString()}P)`);
  addPoints(-it.price * qty, `${it.name} 구매`);
  myItems[kind] += qty;
  db.ref(`user_points/${currentUser.nickname}/items/${kind}`).set(myItems[kind]);
  updatePointsUI();
  renderEnhanceItems();
  updateEnhanceUI();
}

function toggleEnhanceItem(kind) {
  if (myItems[kind] <= 0) return buyEnhanceItem(kind);
  useItem[kind] = !useItem[kind];
  renderEnhanceItems();
  updateEnhanceUI();
}

function renderEnhanceItems() {
  ['protect', 'bless'].forEach(kind => {
    const btn = document.getElementById(`enhItem_${kind}`);
    if (!btn) return;
    const on = useItem[kind] && myItems[kind] > 0;
    btn.className = `relative py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${on ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/60'}`;
    btn.innerHTML = `${ENHANCE_ITEMS[kind].name} <span class="font-black">x${myItems[kind]}</span>
      <span class="block text-[9px] font-medium ${on ? 'text-slate-800' : 'text-slate-500'}">${myItems[kind] > 0 ? (on ? '사용 중 (1회 소모)' : '눌러서 사용') : `없음 · 눌러서 구매 ${ENHANCE_ITEMS[kind].price.toLocaleString()}P`}</span>`;
  });
  ['protect', 'bless'].forEach(kind => {
    const b = document.getElementById(`enhBuy_${kind}`);
    if (b) b.textContent = `+1 (${ENHANCE_ITEMS[kind].price.toLocaleString()}P)`;
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

function consumeUsedItems() {
  const used = {};
  ['protect', 'bless'].forEach(kind => {
    if (kind === 'protect' && gambleMode) return;
    if (useItem[kind] && myItems[kind] > 0) {
      myItems[kind]--;
      used[`items/${kind}`] = myItems[kind];
      if (myItems[kind] === 0) useItem[kind] = false;
    }
  });
  if (Object.keys(used).length && canSyncToCloud()) db.ref(`user_points/${currentUser.nickname}`).update(used);
  renderEnhanceItems();
}

let enhanceRevealing = false;

function runEnhancement() {
  if (enhanceRevealing) return;
  if (currentEnhanceLevel >= 20) return alert("이미 20강 최고 단계에 도달했습니다! 판매하여 정산하세요.");

  const now = Date.now();
  enhanceActionTimestamps = enhanceActionTimestamps.filter(t => now - t < 60000);
  if (enhanceActionTimestamps.length >= 100) {
    const oldest = enhanceActionTimestamps[0];
    const remSec = Math.ceil((60000 - (now - oldest)) / 1000);
    return alert(`⏳ 분당 강화 횟수(100회)를 초과했습니다!\n잠시 후 (${remSec}초 뒤) 다시 시도해주세요.`);
  }

  const cost = currentAttemptCost();
  if (userPoints < cost) {
    return alert(`❌ 강화 비용이 부족합니다! (필요: ${cost}P / 보유: ${userPoints}P)`);
  }

  addPoints(-cost, `${gambleMode ? '도박 ' : ''}강화 시도 +${currentEnhanceLevel}→+${currentEnhanceLevel + 1}`);
  enhanceActionTimestamps.push(now);
  updatePointsUI();

  const odds = effectiveOdds(currentEnhanceLevel);
  const alertEl = document.getElementById('enhanceStatusAlert');
  const actionBtn = document.getElementById('enhanceActionBtn');
  const avatar = document.getElementById('enhanceBowlAvatar');
  if (actionBtn) actionBtn.disabled = true;

  const fromLevel = currentEnhanceLevel;
  const roll = Math.random() * 100;
  const tags = [odds.gamble ? '🎲도박' : '', odds.golden ? '🌞골든타임' : '', odds.blessed ? '✨축복' : '', odds.protected ? '🛡️방지권' : ''].filter(Boolean).join(' ');
  consumeUsedItems();

  // 결과는 바로 확정·저장하고, 화면 공개만 연출로 늦춤 (창을 닫아도 결과는 그대로)
  let outcome, msg, jumped = false;
  if (roll < odds.success) {
    outcome = 'success';
    jumped = fromLevel >= 5 && fromLevel + 2 <= 20 && Math.random() < JUMP_CHANCE;
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
    msg = `<span class="text-rose-500 font-black text-xs">💥 밥이 타버렸습니다!${near} ${currentEnhanceLevel > 0 ? `(안전 구간 +${currentEnhanceLevel}강으로 내려감)` : '(+0 따스한 햇쌀밥으로 리셋)'}</span>`;
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
      if (jumped) postFeed('enhance', `🌟 대박 점프! +${fromLevel} → +${currentEnhanceLevel}강 [${evolvedBowl.name}] ${evolvedBowl.icon}`, currentEnhanceLevel >= 15 ? 'big' : 'normal');
      else if (currentEnhanceLevel >= 10) postFeed('enhance', `${odds.gamble ? '🎲 도박 강화로 ' : ''}+${currentEnhanceLevel}강 [${evolvedBowl.name}] 강화 성공! ${evolvedBowl.icon}`,
        currentEnhanceLevel >= 17 ? 'legendary' : currentEnhanceLevel >= 13 ? 'big' : 'normal');
      if (currentEnhanceLevel >= 10) maybeDropCard(`+${currentEnhanceLevel}강 성공`, 10 + (currentEnhanceLevel - 10) * 4, (currentEnhanceLevel - 10) * 1.5);
    } else if (outcome === 'break' && fromLevel >= 10) {
      postFeed('enhance', `${odds.gamble ? '🎲 도박 강화 실패! ' : ''}+${fromLevel}강 밥이 새까맣게 타버렸어요... 💥`, fromLevel >= 14 ? 'big' : 'normal');
    }
    updateEnhanceUI();
    renderEnhanceTable();
    setTimeout(() => { if (actionBtn && currentEnhanceLevel < 20) actionBtn.disabled = false; }, 150);
  };

  // +12강 이상 시도는 두근두근 연출 (0.9초)
  if (fromLevel >= 12) {
    enhanceRevealing = true;
    alertEl.innerHTML = `<span class="text-amber-200 font-black text-xs animate-pulse">🔥 두근두근... +${fromLevel + 1}강 운명의 순간!</span>`;
    if (avatar) { avatar.classList.remove('enh-success', 'enh-fail', 'enh-break'); void avatar.offsetWidth; avatar.classList.add('enh-suspense'); }
    setTimeout(reveal, 900);
  } else {
    reveal();
  }
}

// ==========================================
// 📈 오늘의 밥 시세: 20분마다 바뀌는 판매가 배율 (모든 회원 동일)
// 평균은 약 1.0배. 상승·폭등 때 팔면 이득, 하락·폭락 때 팔면 손해 → 언제 팔지가 승부
// ==========================================
const MARKET_SLOT_MS = 20 * 60 * 1000;
function seeded01(seed) {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function riceMarket(ts) {
  if (ts == null) ts = Date.now() + (typeof serverTimeOffset === 'number' ? serverTimeOffset : 0);
  const slot = Math.floor(ts / MARKET_SLOT_MS);
  const u = seeded01(slot * 7919 + 13), v = seeded01(slot * 104729 + 7);
  let mult, label, tone;
  if (u < 0.04)      { mult = 1.5;              label = '🚀 폭등'; tone = 'up2'; }
  else if (u < 0.14) { mult = 1.2 + 0.1 * v;    label = '📈 상승'; tone = 'up'; }
  else if (u < 0.76) { mult = 0.95 + 0.15 * v;  label = '➖ 보합'; tone = 'flat'; }
  else if (u < 0.94) { mult = 0.8 + 0.1 * v;    label = '📉 하락'; tone = 'down'; }
  else               { mult = 0.65;             label = '💀 폭락'; tone = 'down2'; }
  mult = Math.round(mult * 100) / 100;
  return { mult, label, tone, slot, endsAt: (slot + 1) * MARKET_SLOT_MS };
}

function renderRiceMarket() {
  const box = document.getElementById('riceMarketPanel');
  if (!box) return;
  const nowTs = Date.now() + (typeof serverTimeOffset === 'number' ? serverTimeOffset : 0);
  const mk = riceMarket(nowTs);
  const left = Math.max(0, mk.endsAt - nowTs);
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  const hist = [];
  for (let i = 8; i >= 0; i--) hist.push(riceMarket(nowTs - i * MARKET_SLOT_MS));
  const color = { up2: 'text-fuchsia-300', up: 'text-emerald-300', flat: 'text-slate-300', down: 'text-sky-300', down2: 'text-rose-400' }[mk.tone];
  box.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="text-[11px] font-black text-slate-300">오늘의 밥 시세</span>
      <span class="text-[10px] text-slate-500">다음 변동 ${mm}:${String(ss).padStart(2, '0')}</span>
    </div>
    <div class="flex items-end justify-between gap-2 mt-1">
      <div class="${color} font-black text-lg leading-none ${mk.tone === 'up2' ? 'animate-pulse' : ''}">${mk.label} x${mk.mult.toFixed(2)}</div>
      <div class="flex items-end gap-0.5 h-7">
        ${hist.map((h, i) => `<div title="x${h.mult.toFixed(2)}" class="w-2 rounded-sm ${h.mult >= 1.2 ? 'bg-emerald-400' : h.mult >= 0.95 ? 'bg-slate-500' : 'bg-rose-400'} ${i === hist.length - 1 ? 'ring-1 ring-amber-300' : 'opacity-70'}" style="height:${Math.round((h.mult - 0.5) / 1.0 * 100)}%"></div>`).join('')}
      </div>
    </div>`;
}
setInterval(() => {
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
  const base = ENHANCE_PROBABILITIES[currentEnhanceLevel - 1].reward;
  const reward = Math.round(base * mk.mult);
  const currentName = BOWL_EVOLUTION[currentEnhanceLevel]?.name || '밥';
  if (!confirm(`+${currentEnhanceLevel}강 [${currentName}] 판매\n\n기본 ${base.toLocaleString()}P × 시세 ${mk.label} x${mk.mult.toFixed(2)} = ${reward.toLocaleString()}P\n\n판매 후 밥은 +0단계로 리셋됩니다. 판매할까요?`)) return;

  addPoints(reward, `+${currentEnhanceLevel}강 밥 판매 (시세 x${mk.mult.toFixed(2)})`);
  const soldLvl = currentEnhanceLevel;
  currentEnhanceLevel = 0;
  updatePointsUI();
  updateEnhanceUI();
  renderEnhanceTable();

  if (window.confetti) confetti({ particleCount: 100 });
  if (soldLvl >= 12) postFeed('sell', `+${soldLvl}강 밥을 ${mk.label} 시세(x${mk.mult.toFixed(2)})에 팔아 ${reward.toLocaleString()}P 💰`, soldLvl >= 16 || mk.mult >= 1.5 ? 'big' : 'normal');
  startDoubleUp(reward, soldLvl);
}

// ==========================================
// 🎲 더블 오어 낫싱: 판매 대금을 걸고 50% 확률로 2배 (최대 3번 = 8배)
// 기대값은 정확히 본전. 순수한 배짱 승부
// ==========================================
let doubleUp = null;
const DOUBLE_UP_MAX = 3;

function startDoubleUp(amount, soldLvl) {
  doubleUp = { amount, round: 0, soldLvl, original: amount };
  renderDoubleUp(`💰 +${soldLvl}강 밥을 팔아 <strong>${amount.toLocaleString()}P</strong>를 받았어요!`);
}

function renderDoubleUp(headline, tone = 'normal') {
  const box = document.getElementById('doubleUpPanel');
  if (!box) return;
  if (!doubleUp) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const canGo = doubleUp.round < DOUBLE_UP_MAX;
  box.className = `p-3 rounded-2xl border-2 text-xs space-y-2 ${tone === 'win' ? 'border-emerald-400 bg-emerald-950/40' : 'border-fuchsia-500/70 bg-fuchsia-950/30'}`;
  box.innerHTML = `
    <div class="text-slate-200 font-bold">${headline}</div>
    ${canGo ? `
      <div class="text-[11px] text-fuchsia-200">🎲 <strong>더블 오어 낫싱?</strong> 50% 확률로 <strong class="text-emerald-300">${(doubleUp.amount * 2).toLocaleString()}P</strong>, 실패하면 <strong class="text-rose-300">0P</strong> (${doubleUp.round + 1}/${DOUBLE_UP_MAX}단계)</div>
      <div class="grid grid-cols-2 gap-2">
        <button onclick="stopDoubleUp()" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl">✋ 여기서 챙기기</button>
        <button onclick="doDoubleUp()" class="gamble-on text-white font-black py-2 rounded-xl">🎲 더블 도전!</button>
      </div>` : `<div class="text-[11px] text-emerald-300 font-black">🏆 최대 단계 달성! 더 이상 걸 수 없어요.</div>`}`;
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
  const win = Math.random() < 0.5;
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
      doubleUp = null;
      const b = document.getElementById('doubleUpPanel');
      if (b) {
        b.className = 'p-3 rounded-2xl border-2 border-rose-500/70 bg-rose-950/40 text-xs';
        b.innerHTML = `<div class="text-rose-300 font-black">💸 실패! ${lost.toLocaleString()}P를 잃었어요... 다음엔 꼭!</div>`;
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
