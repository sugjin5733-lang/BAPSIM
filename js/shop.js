// 밥심 - 명품 상점 & 치장

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
    { id: "nb-cosmic", name: "🌌 코스믹 레인보우 (태초 신화)", class: "nb-cosmic", cost: 999999, reqLvl: 17, desc: "찬란하게 요동치는 무지개 홀로그램 오라 [17강 필요]" },
    { id: "nb-solar", name: "☀️ 태양의 겁화 (솔라 플레어)", class: "nb-solar", cost: 999999, reqLvl: 17, desc: "타오르는 붉은 태양 홍염 애니메이션 [17강 필요]" },
    { id: "nb-abyss", name: "🌋 심연의 지옥염화 (헬파이어)", class: "nb-abyss", cost: 999999, reqLvl: 17, desc: "심연의 마그마와 핏빛 불길이 일렁이는 궁극의 배지 [17강 필요]" },
    { id: "nb-cyberaurora", name: "💎 사이버 네온 프리즘 (환상)", class: "nb-cyberaurora", cost: 999999, reqLvl: 17, desc: "초고주파 프리즘 레이저와 청록빛 오로라 발광 [17강 필요]" },
    { id: "nb-infinity", name: "♾️ 영겁의 인피니티 (절대자)", class: "nb-infinity", cost: 999999, reqLvl: 17, desc: "황금빛 차원문과 시공간 왜곡 절대자의 상징 [17강 필요]" },
    { id: "nb-blackhole", name: "🕳️ 심연의 블랙홀 (시공 왜곡)", class: "nb-blackhole", cost: 888888, reqLvl: 12, desc: "보랏빛 중력장과 암흑 물질 발광 [12강 필요]" },
    { id: "nb-matrix", name: "🟢 사이버 매트릭스 (디지털 네오)", class: "nb-matrix", cost: 777777, reqLvl: 12, desc: "초록빛 디지털 비가 흐르는 해커 플레이트 [12강 필요]" },
    { id: "nb-universe", name: "🪐 다크 유니버스 (신화)", class: "nb-universe", cost: 500000, reqLvl: 12, desc: "심오하고 묵직한 심우주 성운 워프 오라 [12강 필요]" },
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

  const bgContainer = document.getElementById('shopBadgeList');
  if (bgContainer) {
    bgContainer.innerHTML = '';
    SHOP_DATA.bgs.forEach(bg => {
      const isOwned = (myInventory.bgs || []).includes(bg.class);
      const isEquipped = myNickBg === bg.class;
      const isMythic = bg.cost >= 500000;
      const isGold = bg.cost >= 100000 && !isMythic;

      let reqLvl = bg.reqLvl || 0;
      if (bg.cost >= 999999) reqLvl = 17;
      else if (bg.cost >= 5000) reqLvl = 12;

      const isLocked = (currentEnhanceLevel < reqLvl) && !isOwned;

      const card = document.createElement('div');
      card.className = `p-3.5 border rounded-2xl flex items-center justify-between transition-all ${
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
            🔒 ${reqLvl}강 이상
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
  'nb-season-1': '🥇 시즌 챔피언', 'nb-season-2': '🥈 시즌 준우승', 'nb-season-3': '🥉 시즌 3위',
  'nb-admin': '🛡️ 관리자'
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
  userPoints -= cost;
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
  userPoints -= cost;
  if (!myInventory.colors) myInventory.colors = [];
  myInventory.colors.push(hex);
  myNickColor = hex;
  updatePointsUI();
  renderShopUI();
}
function equipColor(hex) { myNickColor = hex; updatePointsUI(); renderShopUI(); }
function unequipColor() { myNickColor = ''; updatePointsUI(); renderShopUI(); }

function buyBg(bgClass, cost, bgName, reqLvl = 0) {
  if (reqLvl > 0 && currentEnhanceLevel < reqLvl) {
    return alert(`🔒 구매 불가!\n이 배지는 [밥키우기 ${reqLvl}강] 이상을 달성해야만 구매할 수 있습니다.\n(현재 내 강화 레벨: +${currentEnhanceLevel}강)`);
  }
  if (userPoints < cost) return alert(`❌ 포인트가 부족합니다!`);
  if (!confirm(`정말로 ${cost.toLocaleString()}P로 [${bgName}] 배지를 구매하시겠습니까?`)) return;
  userPoints -= cost;
  if (!myInventory.bgs) myInventory.bgs = ['nb-none'];
  myInventory.bgs.push(bgClass);
  myNickBg = bgClass;
  updatePointsUI();
  renderShopUI();
  if (window.confetti) confetti({ particleCount: 120, spread: 80 });
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
