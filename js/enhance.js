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
  { level: 3,  success: 79.8,  keep: 20.2, break: 0.0,  reward: 200 },
  { level: 4,  success: 70.1,  keep: 27.9, break: 2.1,  reward: 320 },
  { level: 5,  success: 59.9,  keep: 35.0, break: 5.1,  reward: 480 },
  { level: 6,  success: 50.1,  keep: 39.7, break: 10.2, reward: 700 },
  { level: 7,  success: 45.4,  keep: 44.1, break: 10.5, reward: 1000 },
  { level: 8,  success: 40.2,  keep: 49.6, break: 10.3, reward: 1450 },
  { level: 9,  success: 33.6,  keep: 56.6, break: 9.8,  reward: 2000 },
  { level: 10, success: 29.3,  keep: 61.4, break: 9.5,  reward: 3000 },
  { level: 11, success: 25.5,  keep: 64.5, break: 10.1, reward: 4200 },
  { level: 12, success: 23.6,  keep: 65.9, break: 10.6, reward: 5800 },
  { level: 13, success: 19.3,  keep: 70.2, break: 10.5, reward: 8000 },
  { level: 14, success: 18.1,  keep: 72.3, break: 9.7,  reward: 11000 },
  { level: 15, success: 14.8,  keep: 75.5, break: 9.9,  reward: 15000 },
  { level: 16, success: 13.1,  keep: 78.0, break: 9.8,  reward: 18500 },
  { level: 17, success: 10.9,  keep: 76.8, break: 12.6, reward: 22000 },
  { level: 18, success: 9.9,   keep: 79.9, break: 10.7, reward: 26000 },
  { level: 19, success: 4.7,   keep: 86.2, break: 10.6, reward: 30000 },
  { level: 20, success: 3.3,   keep: 90.3, break: 9.9,  reward: 100000 }
];

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
  document.getElementById('enhanceModal').classList.add('hidden');
}

function updateEnhanceUI() {
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

  let currentSellVal = 0;
  if (currentEnhanceLevel > 0) {
    currentSellVal = ENHANCE_PROBABILITIES[currentEnhanceLevel - 1].reward;
  }
  if (sellText) sellText.textContent = `${currentSellVal.toLocaleString()}P`;

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
    const nextCost = getEnhanceCost(currentEnhanceLevel);
    if (costText) costText.textContent = `강화비: ${nextCost}P`;
    if (probS) probS.textContent = `${nextMeta.success.toFixed(1)}%`;
    if (probK) probK.textContent = `${nextMeta.keep.toFixed(1)}%`;
    if (probB) probB.textContent = `${nextMeta.break.toFixed(1)}%`;
    if (actionBtn) {
      actionBtn.disabled = false;
      actionBtn.textContent = `+${currentEnhanceLevel + 1} 강화 시도 (${nextCost}P)`;
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
  const keepBase = keep; // 방지권 적용 전 '유지' 구간 (그 뒤 구간은 원래 '파괴')
  const protectedNow = useItem.protect && myItems.protect > 0 && brk > 0;
  if (protectedNow) { keep += brk; brk = 0; }
  return { success, keep, keepBase, break: brk, golden: isGoldenTime(), blessed: useItem.bless && myItems.bless > 0, protected: protectedNow };
}

function buyEnhanceItem(kind) {
  if (!checkApprovalGuard()) return;
  const it = ENHANCE_ITEMS[kind];
  const qty = 1;
  if (userPoints < it.price * qty) return alert(`❌ 포인트가 부족해요! (${it.name} ${it.price.toLocaleString()}P)`);
  userPoints -= it.price * qty;
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
}

function consumeUsedItems() {
  const used = {};
  ['protect', 'bless'].forEach(kind => {
    if (useItem[kind] && myItems[kind] > 0) {
      myItems[kind]--;
      used[`items/${kind}`] = myItems[kind];
      if (myItems[kind] === 0) useItem[kind] = false;
    }
  });
  if (Object.keys(used).length && canSyncToCloud()) db.ref(`user_points/${currentUser.nickname}`).update(used);
  renderEnhanceItems();
}

function runEnhancement() {
  if (currentEnhanceLevel >= 20) return alert("이미 20강 최고 단계에 도달했습니다! 판매하여 정산하세요.");

  const now = Date.now();
  enhanceActionTimestamps = enhanceActionTimestamps.filter(t => now - t < 60000);
  if (enhanceActionTimestamps.length >= 100) {
    const oldest = enhanceActionTimestamps[0];
    const remSec = Math.ceil((60000 - (now - oldest)) / 1000);
    return alert(`⏳ 분당 강화 횟수(100회)를 초과했습니다!\n잠시 후 (${remSec}초 뒤) 다시 시도해주세요.`);
  }

  const cost = getEnhanceCost(currentEnhanceLevel);
  if (userPoints < cost) {
    return alert(`❌ 강화 비용이 부족합니다! (필요: ${cost}P / 보유: ${userPoints}P)`);
  }

  userPoints -= cost;
  enhanceActionTimestamps.push(now);
  updatePointsUI();

  const odds = effectiveOdds(currentEnhanceLevel);
  const alertEl = document.getElementById('enhanceStatusAlert');
  const actionBtn = document.getElementById('enhanceActionBtn');
  const avatar = document.getElementById('enhanceBowlAvatar');
  if (actionBtn) actionBtn.disabled = true;

  const fromLevel = currentEnhanceLevel;
  const roll = Math.random() * 100;
  const tags = [odds.golden ? '🌞골든타임' : '', odds.blessed ? '✨축복' : '', odds.protected ? '🛡️방지권' : ''].filter(Boolean).join(' ');
  consumeUsedItems();

  let outcome;
  if (roll < odds.success) {
    outcome = 'success';
    currentEnhanceLevel++;
    const evolvedBowl = BOWL_EVOLUTION[currentEnhanceLevel];
    if (currentEnhanceLevel >= 15 && window.confetti) confetti({ particleCount: 150 });
    alertEl.innerHTML = `<span class="text-emerald-400 font-extrabold text-xs">🎉 +${currentEnhanceLevel}강 [${esc(evolvedBowl.name)}] 성공! ${tags}</span>`;
    if (currentEnhanceLevel >= 10) {
      postFeed('enhance', `+${currentEnhanceLevel}강 [${evolvedBowl.name}] 강화 성공! ${evolvedBowl.icon}`,
        currentEnhanceLevel >= 17 ? 'legendary' : currentEnhanceLevel >= 13 ? 'big' : 'normal');
      // 고강화 성공 시 카드 드롭 (높을수록 확률/등급 ↑)
      maybeDropCard(`+${currentEnhanceLevel}강 성공`, 10 + (currentEnhanceLevel - 10) * 4, (currentEnhanceLevel - 10) * 1.5);
    }
  } else if (roll < (odds.success + odds.keep)) {
    outcome = odds.protected && roll >= (odds.success + odds.keepBase) ? 'saved' : 'keep';
    alertEl.innerHTML = outcome === 'saved'
      ? `<span class="text-sky-300 font-black text-xs">🛡️ 방지권 발동! 밥이 탈 뻔했지만 지켜냈어요!</span>`
      : `<span class="text-amber-400 font-bold text-xs">⚠️ 강화 실패! 다행히 밥이 타지 않고 유지되었습니다. ${tags}</span>`;
  } else {
    outcome = 'break';
    currentEnhanceLevel = 0;
    alertEl.innerHTML = `<span class="text-rose-500 font-black text-xs">💥 밥이 타버렸습니다! (파괴되어 +0 따스한 햇쌀밥으로 리셋)</span>`;
    if (fromLevel >= 10) postFeed('enhance', `+${fromLevel}강 밥이 새까맣게 타버렸어요... 💥`, fromLevel >= 14 ? 'big' : 'normal');
  }

  if (avatar) {
    avatar.classList.remove('enh-success', 'enh-fail', 'enh-break');
    void avatar.offsetWidth;
    avatar.classList.add(outcome === 'success' ? 'enh-success' : outcome === 'break' ? 'enh-break' : 'enh-fail');
  }

  updateEnhanceUI(); // 새 강화 단계를 먼저 서버에 저장
  if (outcome === 'success') recordSeasonProgress(currentEnhanceLevel);
  renderEnhanceTable();
  setTimeout(() => { if (actionBtn && currentEnhanceLevel < 20) actionBtn.disabled = false; }, 150);
}

function sellEnhancedBowl() {
  if (currentEnhanceLevel <= 0) return alert("현재 +0단계 밥은 판매할 수 없습니다. 강화 후 판매하세요!");

  const reward = ENHANCE_PROBABILITIES[currentEnhanceLevel - 1].reward;
  const currentName = BOWL_EVOLUTION[currentEnhanceLevel]?.name || '밥';
  if (!confirm(`+${currentEnhanceLevel}강 [${currentName}]을(를) 판매하고 ${reward.toLocaleString()}P를 획득하시겠습니까?\n판매 후 밥은 +0단계로 리셋됩니다.`)) return;

  userPoints += reward;
  const soldLvl = currentEnhanceLevel;
  currentEnhanceLevel = 0;
  updatePointsUI();
  updateEnhanceUI();
  renderEnhanceTable();

  if (window.confetti) confetti({ particleCount: 100 });
  if (soldLvl >= 12) postFeed('sell', `+${soldLvl}강 밥을 팔아 ${reward.toLocaleString()}P를 챙겼어요 💰`, soldLvl >= 16 ? 'big' : 'normal');
  alert(`💰 +${soldLvl}강 밥을 판매하여 +${reward.toLocaleString()}P를 획득했습니다!`);
}

function syncEnhanceToCloud() {
  if (!canSyncToCloud()) return;
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
