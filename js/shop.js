// 밥심 - 상점 & 치장 (+ 👑 프레스티지 상점)
//
// 👑 프레스티지 상점: 500,000P 이상 상품 전용 (입장권 1,000,000P, 영구)
//  - 입장권이 없어도 구경은 가능, 구매만 막힘
//  - 이미 가진 프레스티지 배지는 입장권 없이도 장착/해제 가능
const PRESTIGE_MIN = 500000;
const PRESTIGE_PASS_PRICE = 1000000;
let myPrestigePass = false;
function loadPrestigeFromUser(val) { myPrestigePass = !!(val && val.prestigePass); }
function isPrestigeItem(cost) { return cost >= PRESTIGE_MIN; }

// ==========================================
// 4. 상점 메타데이터 및 밥키우기 레벨 제한 (5000P 이상은 12강부터)
// ==========================================
const SHOP_DATA = {
  symbols: [
    { id: "sym_star", name: "별빛 칭호", char: "★", cost: 150 },
    { id: "sym_crown", name: "왕관 칭호", char: "👑", cost: 150 },
    { id: "sym_fire", name: "불꽃 칭호", char: "🔥", cost: 150 },
    { id: "sym_sparkle", name: "반짝 칭호", char: "✨", cost: 150 },
    { id: "sym_cross", name: "검객 칭호", char: "⚔️", cost: 150 },
    { id: "sym_heart", name: "러블리 칭호", char: "💖", cost: 150 },
    { id: "sym_thunder", name: "번개 칭호", char: "⚡", cost: 150 },
    { id: "sym_skull", name: "해골 칭호", char: "💀", cost: 150 },
    { id: "sym_gem", name: "보석 칭호", char: "💎", cost: 150 },
    { id: "sym_target", name: "명사수 칭호", char: "🎯", cost: 150 }
  ],
  colors: [
    { id: "col_gold", name: "골드 옐로우", hex: "#f59e0b", cost: 300 },
    { id: "col_violet", name: "네온 바이올렛", hex: "#a855f7", cost: 300 },
    { id: "col_emerald", name: "에메랄드 그린", hex: "#10b981", cost: 300 },
    { id: "col_red", name: "파이어 레드", hex: "#ef4444", cost: 300 },
    { id: "col_cyan", name: "사이버 사이안", hex: "#06b6d4", cost: 300 },
    { id: "col_rose", name: "핫핑크 로즈", hex: "#f43f5e", cost: 300 },
    { id: "col_blue", name: "일렉트릭 블루", hex: "#2563eb", cost: 300 },
    { id: "col_dark", name: "다크 나이트", hex: "#0f172a", cost: 300 }
  ],
  bgs: [
    { id: "nb-jackpot", name: "🎰 잭팟 777 (전설의 손)", class: "nb-jackpot", cost: 777777, unlock: 'jackpot', desc: "카지노 전광 전구가 질주하고 금빛 릴이 돌아가는 배지 · 💎💎💎 슬롯 초특급 잭팟을 터뜨린 사람만 구매 가능" },
    { id: "nb-najeon", name: "🐚 나전칠기 (명장)", class: "nb-najeon", cost: 100000000, reqLvl: 27, desc: "황금 섬광이 섞인 무지개 고리가 질주하고, 색이 흐르는 자개판 위로 금박 빛줄기와 별가루가 쏟아지는 밥심 최후의 전설 [27강 필요]" },
    { id: "nb-ricegod", name: "🍚 천상의 밥신 (창세)", class: "nb-ricegod", cost: 10000000, reqLvl: 24, desc: "금빛 고리가 천천히 돌고 쌀알 별빛이 은은하게 빛나는 밥심의 상징 [24강 필요]" },
    { id: "nb-cosmic", name: "🌌 코스믹 레인보우 (태초 신화)", class: "nb-cosmic", cost: 999999, reqLvl: 22, desc: "흐르는 무지개 홀로그램 위로 빛줄기가 스치는 오라 [22강 필요]" },
    { id: "nb-solar", name: "☀️ 태양의 겁화 (솔라 플레어)", class: "nb-solar", cost: 999999, reqLvl: 22, desc: "아래에서 솟구치는 불꽃과 흩날리는 불티 [22강 필요]" },
    { id: "nb-abyss", name: "🌋 심연의 지옥염화 (헬파이어)", class: "nb-abyss", cost: 999999, reqLvl: 22, desc: "갈라진 땅 사이로 흐르는 용암과 숨 쉬는 핏빛 열기 [22강 필요]" },
    { id: "nb-cyberaurora", name: "💎 사이버 네온 프리즘 (환상)", class: "nb-cyberaurora", cost: 999999, reqLvl: 22, desc: "레이저 스캔과 주사선, 색이 갈라지는 네온 글자 [22강 필요]" },
    { id: "nb-infinity", name: "♾️ 영겁의 인피니티 (절대자)", class: "nb-infinity", cost: 999999, reqLvl: 22, desc: "회전하는 황금 고리 안의 보랏빛 차원문 [22강 필요]" },
    { id: "nb-blackhole", name: "🕳️ 심연의 블랙홀 (시공 왜곡)", class: "nb-blackhole", cost: 888888, reqLvl: 12, desc: "빙글빙글 도는 강착 원반과 칠흑의 사건 지평선 [12강 필요]" },
    { id: "nb-matrix", name: "🟢 사이버 매트릭스 (디지털 네오)", class: "nb-matrix", cost: 777777, reqLvl: 12, desc: "쏟아지는 초록 코드 비와 발광 터미널 글자 [12강 필요]" },
    { id: "nb-universe", name: "🪐 다크 유니버스 (신화)", class: "nb-universe", cost: 500000, reqLvl: 12, desc: "반짝이는 별과 천천히 도는 성운 [12강 필요]" },
    { id: "nb-gold", name: "👑 황금빛 골드 배지 (10만P 이상)", class: "nb-gold", cost: 100000, reqLvl: 12, desc: "럭셔리 쉬머 반사광이 감도는 최상위 부자의 상징 [12강 필요]" },
    { id: "nb-darkvip", name: "💳 블랙 VIP 카드 배지", class: "nb-darkvip", cost: 50000, reqLvl: 12, desc: "문정 VVIP 전용 블랙 플레이트 [12강 필요]" },
    { id: "nb-aurora", name: "🌠 에메랄드 오로라 배지", class: "nb-aurora", cost: 35000, reqLvl: 12, desc: "북극광처럼 일렁이는 청록빛 섬광 [12강 필요]" },
    { id: "nb-diamond", name: "💎 다이아몬드 아이스", class: "nb-diamond", cost: 25000, reqLvl: 12, desc: "차가운 블루 크리스탈 발광 [12강 필요]" },
    { id: "nb-galaxy", name: "🌌 심연의 갤럭시", class: "nb-galaxy", cost: 10000, reqLvl: 12, desc: "보랏빛 우주와 성운 그라데이션 [12강 필요]" },
    { id: "nb-cyberpunk", name: "⚡ 사이버펑크 2077", class: "nb-cyberpunk", cost: 5000, reqLvl: 12, desc: "사이안 & 핫핑크 글리치 테두리 [12강 필요]" },
    { id: "nb-neon", name: "🟢 사이버 네온 글로우", class: "nb-neon", cost: 2500, reqLvl: 0, desc: "초록빛 야간 네온 라이트" },
    { id: "nb-fire", name: "🔥 불타는 밥심", class: "nb-fire", cost: 1000, reqLvl: 0, desc: "열정적인 오렌지 플레임" },
    { id: "nb-cherry", name: "🍒 체리 블라썸", class: "nb-cherry", cost: 800, reqLvl: 0, desc: "화사하고 산뜻한 핑크빛 플레이트" },
    { id: "nb-sunset", name: "🌅 문정 선셋", class: "nb-sunset", cost: 500, reqLvl: 0, desc: "퇴근길 따뜻한 노을빛" },
    { id: "nb-mint", name: "🌿 프레시 민트", class: "nb-mint", cost: 300, reqLvl: 0, desc: "상쾌하고 깔끔한 민트 그린" },
    { id: "nb-lavender", name: "🌸 소프트 라벤더", class: "nb-lavender", cost: 200, reqLvl: 0, desc: "부드러운 파스텔 보랏빛" }
  ]
};

// 상점 및 치장 렌더링 (5000P 이상은 12강 이상 필수 적용)
function renderShopUI() {
  renderOwnedSpecialBadges();
  renderRenameSection();
  const symContainer = document.getElementById('shopSymbolList');
  if (symContainer) {
    symContainer.innerHTML = '';
    SHOP_DATA.symbols.forEach(sym => {
      const isOwned = (myInventory.symbols || []).includes(sym.char);
      const isEquipped = myNickSymbol === sym.char;
      const card = document.createElement('div');
      card.className = "p-3 border rounded-2xl flex items-center justify-between bg-slate-50";
      card.innerHTML = `
        <div>
          <span class="font-extrabold text-orange-600 text-xs">${sym.char} ${sym.name} ${sym.char}</span>
          <p class="text-[10px] text-slate-400 mt-0.5">${sym.cost}P</p>
        </div>
        <div>
          ${isEquipped 
            ? `<button onclick="unequipSymbol()" class="bg-rose-500 text-white font-bold px-2.5 py-1 rounded-xl text-[11px]">해제</button>`
            : isOwned 
              ? `<button onclick="equipSymbol('${sym.char}')" class="bg-indigo-600 text-white font-bold px-2.5 py-1 rounded-xl text-[11px]">장착</button>`
              : `<button onclick="buySymbol('${sym.char}', ${sym.cost})" class="bg-slate-900 text-amber-300 font-bold px-2.5 py-1 rounded-xl text-[11px]">구매</button>`
          }
        </div>
      `;
      symContainer.appendChild(card);
    });
  }

  const colContainer = document.getElementById('shopColorList');
  if (colContainer) {
    colContainer.innerHTML = '';
    SHOP_DATA.colors.forEach(col => {
      const isOwned = (myInventory.colors || []).includes(col.hex);
      const isEquipped = myNickColor === col.hex;
      const card = document.createElement('div');
      card.className = "p-3 border rounded-2xl flex items-center justify-between bg-slate-50";
      card.innerHTML = `
        <div>
          <span class="font-extrabold text-xs" style="color: ${col.hex}">${col.name}</span>
          <p class="text-[10px] text-slate-400 mt-0.5">${col.cost}P</p>
        </div>
        <div>
          ${isEquipped 
            ? `<button onclick="unequipColor()" class="bg-rose-500 text-white font-bold px-2.5 py-1 rounded-xl text-[11px]">해제</button>`
            : isOwned 
              ? `<button onclick="equipColor('${col.hex}')" class="bg-indigo-600 text-white font-bold px-2.5 py-1 rounded-xl text-[11px]">장착</button>`
              : `<button onclick="buyColor('${col.hex}', ${col.cost})" class="bg-slate-900 text-amber-300 font-bold px-2.5 py-1 rounded-xl text-[11px]">구매</button>`
          }
        </div>
      `;
      colContainer.appendChild(card);
    });
  }

  renderBadgeCards(document.getElementById('shopBadgeList'), SHOP_DATA.bgs.filter(b => !isPrestigeItem(b.cost)));
  renderPrestigeShop();
}

function renderBadgeCards(bgContainer, list) {
  if (bgContainer) {
    bgContainer.innerHTML = '';
    list.forEach(bg => {
      const isOwned = (myInventory.bgs || []).includes(bg.class);
      const isEquipped = myNickBg === bg.class;
      const isMythic = bg.cost >= 500000;
      const isGold = bg.cost >= 100000 && !isMythic;

      // 잭팟 전용 배지는 강화 단계 대신 '슬롯 초특급 잭팟 달성' 조건
      const reqLvl = bg.unlock ? 0 : Math.max(bg.reqLvl || 0, bg.cost >= 999999 ? 22 : bg.cost >= 5000 ? 12 : 0);
      const unlockMissing = bg.unlock === 'jackpot' && !myJackpotUnlocked;
      const isUltimate = bg.cost >= 10000000;

      const needPass = isPrestigeItem(bg.cost) && !myPrestigePass && !isOwned;
      const isLocked = ((currentEnhanceLevel < reqLvl) || unlockMissing || needPass) && !isOwned;

      const card = document.createElement('div');
      card.className = `p-3.5 border rounded-2xl flex items-center justify-between transition-all ${
        bg.unlock ? 'ultimate-card ultra text-white shadow-2xl' :
        isUltimate ? `ultimate-card ${bg.cost >= 100000000 ? 'ultra' : ''} text-white shadow-2xl` :
        isMythic ? 'border-2 border-purple-500 bg-slate-950 text-white shadow-xl' :
        isGold ? 'border-2 border-amber-400 bg-amber-50/50 shadow-md' : 'bg-slate-50'
      }`;

      let actionBtnHTML = '';
      if (isEquipped) {
        actionBtnHTML = `<button onclick="unequipBg()" class="bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl text-[11px]">해제</button>`;
      } else if (isOwned) {
        actionBtnHTML = `<button onclick="equipBg('${bg.class}')" class="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-xl text-[11px]">장착</button>`;
      } else if (isLocked) {
        actionBtnHTML = `
          <button disabled class="bg-slate-800 text-slate-400 font-bold px-3 py-1.5 rounded-xl text-[11px] border border-slate-700 cursor-not-allowed opacity-75">
            ${needPass ? '🔒 입장권 필요' : unlockMissing ? '🔒 잭팟 달성자 전용' : `🔒 ${reqLvl}강 이상`}
          </button>
        `;
      } else {
        actionBtnHTML = `
          <button onclick="buyBg('${bg.class}', ${bg.cost}, '${bg.name}', ${reqLvl})" class="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-[11px] shadow-sm hover:brightness-105 active:scale-95 transition-all">
            ${bg.cost.toLocaleString()}P
          </button>
        `;
      }

      card.innerHTML = `
        <div class="pr-2">
          <div class="flex items-center gap-1.5">
            <span class="${bg.class} text-xs inline-block">${bg.name}</span>
            ${reqLvl > 0 && !isOwned ? `<span class="text-[9px] font-extrabold ${currentEnhanceLevel >= reqLvl ? 'text-emerald-400' : 'text-rose-400'}">(${reqLvl}강 달성 필수)</span>` : ''}
          </div>
          <p class="text-[10px] text-slate-400 mt-1">${bg.desc} (${bg.cost.toLocaleString()}P)</p>
        </div>
        <div class="shrink-0">
          ${actionBtnHTML}
        </div>
      `;
      bgContainer.appendChild(card);
    });
  }
}

// 상점에서 팔지 않는 특별 배지 (세트 완성, 시즌 보상, 관리자 지급 등)
const SPECIAL_BADGE_NAMES = {
  'nb-buffet': '🍱 한식뷔페 마스터', 'nb-royal': '👑 수라상 미식가', 'nb-collector': '📒 반찬 도감 완성자',
  'nb-admin': '🛡️ 관리자', 'nb-angel': '😇 대천사의 날개', 'nb-richking': '💰 베타 시즌 부자왕'
};

function renderOwnedSpecialBadges() {
  const box = document.getElementById('shopOwnedSpecialList');
  if (!box) return;
  const shopClasses = new Set(SHOP_DATA.bgs.map(b => b.class));
  const special = (myInventory.bgs || []).filter(c => c !== 'nb-none' && !shopClasses.has(c));
  const wrap = document.getElementById('shopOwnedSpecialWrap');
  if (wrap) wrap.classList.toggle('hidden', special.length === 0);
  box.innerHTML = [...new Set(special)].map(c => `
    <div class="p-3 border rounded-2xl flex items-center justify-between bg-slate-50">
      <span class="${safeClass(c)} text-xs inline-block">${esc(SPECIAL_BADGE_NAMES[c] || c)}</span>
      ${myNickBg === c
        ? `<button onclick="unequipBg()" class="bg-rose-500 text-white font-bold px-3 py-1.5 rounded-xl text-[11px]">해제</button>`
        : `<button onclick="equipBg(${jsArg(c)})" class="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-xl text-[11px]">장착</button>`}
    </div>`).join('');
}

function openShopModal() { 
  if (!checkApprovalGuard()) return;
  try {
    renderShopUI(); 
    updatePointsUI(); 
  } catch (err) {
    console.error("Shop render error:", err);
  }
  document.getElementById('shopModal').classList.remove('hidden'); 
}
function closeShopModal() { document.getElementById('shopModal').classList.add('hidden'); }

function buySymbol(char, cost) {
  if (userPoints < cost) return alert(`❌ 포인트가 부족합니다!`);
  if (!confirm(`${cost}P로 [${char}] 심볼을 구매하시겠습니까?`)) return;
  addPoints(-cost, '상점 구매');
  if (!myInventory.symbols) myInventory.symbols = [];
  myInventory.symbols.push(char);
  myNickSymbol = char;
  updatePointsUI();
  renderShopUI();
}
function equipSymbol(char) { myNickSymbol = char; updatePointsUI(); renderShopUI(); }
function unequipSymbol() { myNickSymbol = ''; updatePointsUI(); renderShopUI(); }

function buyColor(hex, cost) {
  if (userPoints < cost) return alert(`❌ 포인트가 부족합니다!`);
  if (!confirm(`${cost}P로 해당 색상을 구매하시겠습니까?`)) return;
  addPoints(-cost, '상점 구매');
  if (!myInventory.colors) myInventory.colors = [];
  myInventory.colors.push(hex);
  myNickColor = hex;
  updatePointsUI();
  renderShopUI();
}
function equipColor(hex) { myNickColor = hex; updatePointsUI(); renderShopUI(); }
function unequipColor() { myNickColor = ''; updatePointsUI(); renderShopUI(); }

function buyBg(bgClass, cost, bgName, reqLvl = 0) {
  if (isPrestigeItem(cost) && !myPrestigePass) {
    return alert('👑 프레스티지 상점 상품이에요!\n먼저 프레스티지 상점 입장권(1,000,000P)을 구매해야 살 수 있어요.');
  }
  const meta = SHOP_DATA.bgs.find(b => b.class === bgClass);
  if (meta && meta.unlock === 'jackpot' && !myJackpotUnlocked) {
    return alert('🔒 이 배지는 💎💎💎 슬롯 초특급 잭팟을 터뜨린 사람만 살 수 있어요!');
  }
  if (reqLvl > 0 && currentEnhanceLevel < reqLvl) {
    return alert(`🔒 구매 불가!\n이 배지는 [밥키우기 ${reqLvl}강] 이상을 달성해야만 구매할 수 있습니다.\n(현재 내 강화 레벨: +${currentEnhanceLevel}강)`);
  }
  if (userPoints < cost) return alert(`❌ 포인트가 부족합니다!`);
  if (!confirm(`정말로 ${cost.toLocaleString()}P로 [${bgName}] 배지를 구매하시겠습니까?`)) return;
  addPoints(-cost, '상점 구매');
  if (!myInventory.bgs) myInventory.bgs = ['nb-none'];
  myInventory.bgs.push(bgClass);
  myNickBg = bgClass;
  updatePointsUI();
  renderShopUI();
  if (window.confetti) confetti({ particleCount: 120, spread: 80 });
  if (cost >= 100000000) postFeed('badge', `🐚 ${bgName} 배지를 손에 넣었어요!`, 'legendary', true);
}
function equipBg(bgClass) { myNickBg = bgClass; updatePointsUI(); renderShopUI(); }
function unequipBg() { myNickBg = 'nb-none'; updatePointsUI(); renderShopUI(); }

function unequipAll() {
  myNickColor = '';
  myNickBg = 'nb-none';
  myNickSymbol = '';
  updatePointsUI();
  renderShopUI();
}

// ==========================================
// 👑 프레스티지 상점
// ==========================================
function openPrestigeModal() {
  if (!checkApprovalGuard()) return;
  renderPrestigeShop();
  updatePointsUI();
  document.getElementById('shopModal').classList.add('hidden');
  document.getElementById('prestigeModal').classList.remove('hidden');
}
function closePrestigeModal() { document.getElementById('prestigeModal').classList.add('hidden'); }

function renderPrestigeShop() {
  const pass = document.getElementById('prestigePassBox');
  if (pass) {
    pass.innerHTML = myPrestigePass
      ? `<div class="prestige-pass-owned rounded-2xl px-4 py-3 text-center">
           <div class="text-[11px] font-black tracking-widest text-amber-200">PRESTIGE MEMBER</div>
           <div class="text-sm font-black text-white mt-0.5">👑 입장권 보유 중 · 모든 상품 구매 가능</div>
         </div>`
      : `<div class="rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-transparent px-4 py-3 flex items-center justify-between gap-3">
           <div>
             <div class="text-xs font-black text-amber-200">👑 프레스티지 상점 입장권</div>
             <div class="text-[10px] text-slate-400">한 번 사면 영구 · 50만P 이상 배지와 닉네임 변경권을 살 수 있어요</div>
           </div>
           <button onclick="buyPrestigePass()" class="shrink-0 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black px-3 py-2 rounded-xl text-xs shadow-lg hover:brightness-105 active:scale-95">${PRESTIGE_PASS_PRICE.toLocaleString()}P</button>
         </div>`;
  }
  const pts = document.getElementById('prestigeCurrentPoints');
  if (pts) pts.textContent = `${userPoints.toLocaleString()}P`;
  renderBadgeCards(document.getElementById('prestigeBadgeList'), SHOP_DATA.bgs.filter(b => isPrestigeItem(b.cost)));
  renderRenameSection();
  if (typeof renderDonorBadgeBox === 'function') renderDonorBadgeBox();
  if (typeof renderTierBox === 'function') renderTierBox();
}

function buyPrestigePass() {
  if (!checkApprovalGuard()) return;
  if (myPrestigePass) return;
  if (userPoints < PRESTIGE_PASS_PRICE) return alert(`❌ 포인트가 부족해요! (입장권 ${PRESTIGE_PASS_PRICE.toLocaleString()}P)`);
  if (!confirm(`👑 프레스티지 상점 입장권을 ${PRESTIGE_PASS_PRICE.toLocaleString()}P에 구매할까요?\n(한 번 사면 영구로 입장할 수 있어요)`)) return;
  addPoints(-PRESTIGE_PASS_PRICE, '👑 프레스티지 상점 입장권');
  myPrestigePass = true;
  db.ref(`user_points/${currentUser.nickname}/prestigePass`).set(true);
  updatePointsUI();
  renderPrestigeShop();
  if (typeof loadPrestigeMembers === 'function') setTimeout(loadPrestigeMembers, 2000);
  if (window.confetti) confetti({ particleCount: 160, spread: 110, colors: ['#fde047', '#f59e0b', '#ffffff'] });
}
