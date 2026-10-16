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
  { level: 16, icon: "🪨", name: "천년 묵은 태고의 돌솥 누룽지" },
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
    const nextMeta = ENHANCE_PROBABILITIES[currentEnhanceLevel];
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
      <td class="py-1 text-rose-400">${p.break.toFixed(1)}%</td>
      <td class="py-1 text-amber-300">${p.reward.toLocaleString()}P</td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleEnhanceProbTable() {
  const c = document.getElementById('enhanceProbTableContainer');
  if (c) c.classList.toggle('hidden');
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

  const nextMeta = ENHANCE_PROBABILITIES[currentEnhanceLevel];
  const alertEl = document.getElementById('enhanceStatusAlert');
  const actionBtn = document.getElementById('enhanceActionBtn');
  if (actionBtn) actionBtn.disabled = true;

  const roll = Math.random() * 100;

  if (roll < nextMeta.success) {
    currentEnhanceLevel++;
    const evolvedBowl = BOWL_EVOLUTION[currentEnhanceLevel];
    if (currentEnhanceLevel >= 15 && window.confetti) confetti({ particleCount: 150 });
    alertEl.innerHTML = `<span class="text-emerald-400 font-extrabold text-xs">🎉 +${currentEnhanceLevel}강 [${evolvedBowl.name}] 성공! 축하합니다!</span>`;
  } else if (roll < (nextMeta.success + nextMeta.keep)) {
    alertEl.innerHTML = `<span class="text-amber-400 font-bold text-xs">⚠️ 강화 실패! 다행히 밥이 타지 않고 유지되었습니다.</span>`;
  } else {
    currentEnhanceLevel = 0;
    alertEl.innerHTML = `<span class="text-rose-500 font-black text-xs">💥 밥이 타버렸습니다! (파괴되어 +0 따스한 햇쌀밥으로 리셋)</span>`;
  }

  updateEnhanceUI();
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
