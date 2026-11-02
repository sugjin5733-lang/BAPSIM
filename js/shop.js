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
// 💸 프레스티지 배지 가격 10배 인상 (cost 는 등급 구분용 기준값으로 유지, 실제 결제가는 priceOf)
const PRESTIGE_PRICE_MULT = 10;
function priceOf(bg) {
  if (!bg) return 0;
  if (!isPrestigeItem(bg.cost)) return bg.cost;
  const s = String(bg.cost);
  // 777,777 → 7,777,777 처럼 같은 숫자가 반복되는 가격은 숫자 하나를 더 붙여서 (×10 하면 7,777,770 이라 어색함)
  if (/^(\d)\1+$/.test(s)) return Number(s + s[0]);
  return bg.cost * PRESTIGE_PRICE_MULT;
}

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
    // 일반 색상: 30만P대
    { id: "col_gold", name: "골드 옐로우", hex: "#f59e0b", cost: 300000 },
    { id: "col_violet", name: "네온 바이올렛", hex: "#a855f7", cost: 320000 },
    { id: "col_emerald", name: "에메랄드 그린", hex: "#10b981", cost: 330000 },
    { id: "col_red", name: "파이어 레드", hex: "#ef4444", cost: 350000 },
    { id: "col_cyan", name: "사이버 사이안", hex: "#06b6d4", cost: 360000 },
    { id: "col_rose", name: "핫핑크 로즈", hex: "#f43f5e", cost: 370000 },
    { id: "col_blue", name: "일렉트릭 블루", hex: "#2563eb", cost: 380000 },
    { id: "col_dark", name: "다크 나이트", hex: "#0f172a", cost: 390000 },
    // 👑 프레스티지 색상 (그라데이션·애니메이션 · 입장권 필요): 1천만P대
    { id: "pc_sunset", name: "🌅 선셋 그라데이션", hex: "pc-sunset", cost: 10000000, desc: "주황에서 분홍으로 물드는 노을빛" },
    { id: "pc_ocean", name: "🌊 딥 오션", hex: "pc-ocean", cost: 11000000, desc: "깊은 바다의 청록 물결이 천천히 흐름" },
    { id: "pc_aurora", name: "🌌 오로라", hex: "pc-aurora", cost: 12000000, desc: "초록·하늘·보라가 일렁이는 극광" },
    { id: "pc_sakura", name: "🌸 벚꽃 흩날림", hex: "pc-sakura", cost: 13000000, desc: "연분홍 꽃잎빛이 반짝이며 흐름" },
    { id: "pc_neon", name: "⚡ 네온 사이버", hex: "pc-neon", cost: 15000000, desc: "형광 시안·마젠타 + 네온 발광" },
    { id: "pc_ice", name: "🧊 빙하 크리스탈", hex: "pc-ice", cost: 17000000, desc: "얼음 결정 위로 하얀 빛이 스침" },
    { id: "pc_gold", name: "🥇 순금 메탈", hex: "pc-gold", cost: 19000000, desc: "금속 광택이 번쩍이는 24K 골드" },
    // 1억P 이상
    { id: "pc_rainbow", name: "🌈 프리즘 레인보우", hex: "pc-rainbow", cost: 100000000, desc: "일곱 빛깔이 쉬지 않고 흐르는 무지개" },
    { id: "pc_galaxy", name: "🪐 은하수", hex: "pc-galaxy", cost: 150000000, desc: "보랏빛 우주 사이로 별빛이 깜빡임" },
    { id: "pc_flame", name: "🔥 지옥불", hex: "pc-flame", cost: 200000000, desc: "타오르는 불꽃 그라데이션 + 이글거리는 열기" },
    { id: "pc_holy", name: "😇 신성", hex: "pc-holy", cost: 300000000, desc: "순백과 금빛 후광이 숨 쉬듯 빛나는 밥심 최고의 이름" }
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
  renderColorCards(colContainer, SHOP_DATA.colors.filter(c => !isPrestigeItem(c.cost)));
  renderColorCards(document.getElementById('prestigeColorList'), SHOP_DATA.colors.filter(c => isPrestigeItem(c.cost)));

  renderBadgeCards(document.getElementById('shopBadgeList'), SHOP_DATA.bgs.filter(b => !isPrestigeItem(b.cost)));
  renderPrestigeShop();
}

function renderColorCards(box, list) {
  if (!box) return;
  const me = esc(currentUser && currentUser.nickname || '닉네임');
  const sorted = [...list].sort((x, y) => y.cost - x.cost); // 비싼 것부터
  const premiumList = sorted.some(c => isPrestigeItem(c.cost));
  const card = col => {
    const isOwned = (myInventory.colors || []).includes(col.hex);
    const isEquipped = myNickColor === col.hex;
    const premium = isPrestigeItem(col.cost);
    const locked = premium && !myPrestigePass && !isOwned;
    const preview = premium ? `<span class="pcol ${col.hex} text-lg">${me}</span>` : `<span class="text-lg font-black" style="color:${col.hex}">${me}</span>`;
    const price = col.cost >= 100000000 ? `${(col.cost / 100000000).toLocaleString()}억P` : `${(col.cost / 10000).toLocaleString()}만P`;
    const btn = isEquipped
      ? `<button onclick="unequipColor()" class="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-1.5 rounded-xl text-[11px]">✓ 장착 중 · 해제</button>`
      : isOwned ? `<button onclick="equipColor('${col.hex}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-1.5 rounded-xl text-[11px]">장착하기</button>`
      : locked ? `<button disabled class="w-full bg-slate-800 text-slate-400 font-bold py-1.5 rounded-xl text-[11px] border border-slate-700">🔒 입장권 필요</button>`
      : `<button onclick="buyColor('${col.hex}', ${col.cost})" class="w-full ${premium ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950' : 'bg-slate-900 text-amber-300'} hover:brightness-105 font-black py-1.5 rounded-xl text-[11px]">${price} 구매</button>`;
    return `<div class="color-card ${premium ? 'color-card-premium' : ''} ${isEquipped ? 'color-card-on' : ''} rounded-2xl overflow-hidden flex flex-col">
      <div class="color-card-preview flex items-center justify-center h-14 px-2">${preview}</div>
      <div class="p-2.5 flex-1 flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-1"><span class="text-[11px] font-black ${premium ? 'text-amber-100' : 'text-slate-800'} truncate">${esc(col.name)}</span><span class="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full ${premium ? 'bg-amber-400/15 text-amber-200 border border-amber-400/30' : 'bg-slate-100 text-slate-600'}">${price}</span></div>
        ${col.desc ? `<p class="text-[10px] leading-snug ${premium ? 'text-slate-400' : 'text-slate-500'} flex-1">${esc(col.desc)}</p>` : '<div class="flex-1"></div>'}
        ${btn}
      </div>
    </div>`;
  };
  if (!premiumList) { box.innerHTML = sorted.map(card).join(''); return; }
  const groups = [['👑 1억P 이상', sorted.filter(c => c.cost >= 100000000)], ['💎 1천만P대', sorted.filter(c => c.cost < 100000000)]];
  box.innerHTML = groups.filter(g => g[1].length).map(([t, l]) => `<div class="col-span-full text-[11px] font-black text-amber-200 mt-1">${t}</div>${l.map(card).join('')}`).join('');
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
          <button onclick="buyBg('${bg.class}', ${priceOf(bg)}, '${bg.name}', ${reqLvl})" class="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-[11px] shadow-sm hover:brightness-105 active:scale-95 transition-all">
            ${priceOf(bg).toLocaleString()}P
          </button>
        `;
      }

      card.innerHTML = `
        <div class="pr-2">
          <div class="flex items-center gap-1.5">
            <span class="${bg.class} text-xs inline-block">${bg.name}</span>
            ${reqLvl > 0 && !isOwned ? `<span class="text-[9px] font-extrabold ${currentEnhanceLevel >= reqLvl ? 'text-emerald-400' : 'text-rose-400'}">(${reqLvl}강 달성 필수)</span>` : ''}
          </div>
          <p class="text-[10px] text-slate-400 mt-1">${bg.desc} (${priceOf(bg).toLocaleString()}P)</p>
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
  'nb-admin': '🛡️ 관리자', 'nb-angel': '😇 대천사의 날개', 'nb-richking': '💰 베타 시즌 부자왕', 'nb-bapking': '🍚 베타 시즌 밥신', 'nb-heaven': '🤍 프레스티지 화이트'
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
  return alert('닉네임 칭호는 폐지됐어요.');
  const sm = SHOP_DATA.symbols.find(x => x.char === char); if (sm) cost = sm.cost;
  if (userPoints < cost) return alert(`❌ 포인트가 부족합니다!`);
  if (!confirm(`${cost}P로 [${char}] 심볼을 구매하시겠습니까?`)) return;
  addPoints(-cost, '상점 구매');
  if (!myInventory.symbols) myInventory.symbols = [];
  myInventory.symbols.push(char);
  ledgerAdd('symbols', char, cost);
  myNickSymbol = char;
  updatePointsUI();
  renderShopUI();
}
function equipSymbol(char) { return; myNickSymbol = char; updatePointsUI(); renderShopUI(); }
function unequipSymbol() { myNickSymbol = ''; updatePointsUI(); renderShopUI(); }

function buyColor(hex, cost) {
  const cm = SHOP_DATA.colors.find(x => x.hex === hex); if (cm) cost = cm.cost;
  if (!cm) return;
  if (isPrestigeItem(cost) && !myPrestigePass) return alert('👑 프레스티지 상점 상품이에요!\n먼저 프레스티지 상점 입장권(1,000,000P)을 구매해야 살 수 있어요.');
  if (userPoints < cost) return alert(`❌ 포인트가 부족합니다!`);
  if (!confirm(`${cost.toLocaleString()}P로 [${cm.name}] 닉네임 색상을 구매하시겠습니까?`)) return;
  addPoints(-cost, '상점 구매');
  if (!myInventory.colors) myInventory.colors = [];
  myInventory.colors.push(hex);
  ledgerAdd('colors', hex, cost);
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
  if (meta) cost = priceOf(meta); // 화면에서 넘어온 값 대신 항상 실제 가격으로
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
  ledgerAdd('bgs', bgClass, cost);
  myNickBg = bgClass;
  updatePointsUI();
  renderShopUI();
  if (window.confetti) confetti({ particleCount: 120, spread: 80 });
  if (cost >= 100000000) postFeed('badge', `🐚 ${bgName} 배지를 손에 넣었어요!`, 'legendary', true);
}
function equipBg(bgClass) { if (bgClass === 'nb-heaven' && !(typeof isWhite === 'function' && isWhite())) return alert('🤍 프레스티지 화이트만 장착할 수 있어요.'); myNickBg = bgClass; updatePointsUI(); renderShopUI(); }
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
  renderColorCards(document.getElementById('prestigeColorList'), SHOP_DATA.colors.filter(c => isPrestigeItem(c.cost)));
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


// ==========================================
// 🧾 구매 장부: 상점 아이템은 '산 기록(purchases/{닉네임})'이 있어야만 가질 수 있음
//  - 콘솔로 인벤토리에 몰래 넣으면 → 1분 안에 자동으로 빼고 숙청
//  - 다른 기기에서 막 산 경우를 위해 1분 동안은 기다려 줌
//  - 산 적 없는 배지·색·칭호를 장착만 해둔 경우는 조용히 해제
// ==========================================
let myLedger = { bgs: {}, colors: {}, symbols: {} }, ledgerLoaded = false, ledgerRef = null, ledgerNick = '';
function ledgerKey(x) { return encodeURIComponent(String(x)).replace(/\./g, '%2E'); }
function ledgerAdd(kind, item, cost) {
  myLedger[kind][ledgerKey(item)] = true;
  if (typeof canSyncToCloud === 'function' && canSyncToCloud())
    db.ref(`bank/purchases/${currentUser.nickname}/${kind}/${ledgerKey(item)}`).set({ cost: Number(cost) || 0, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
}
function attachLedger() {
  if (typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  if (ledgerRef && ledgerNick === currentUser.nickname) return;
  if (ledgerRef) ledgerRef.off();
  ledgerNick = currentUser.nickname; ledgerLoaded = false;
  ledgerRef = db.ref(`bank/purchases/${ledgerNick}`);
  ledgerRef.on('value', snap => {
    const v = snap.val() || {};
    const local = myLedger;
    myLedger = { bgs: Object.assign({}, v.bgs || {}), colors: Object.assign({}, v.colors || {}), symbols: Object.assign({}, v.symbols || {}) };
    ['bgs', 'colors', 'symbols'].forEach(k => Object.keys(local[k] || {}).forEach(x => { myLedger[k][x] = true; })); // 방금 산 것(아직 서버 반영 전) 유지
    ledgerLoaded = true;
  }, () => { ledgerRef = null; });
}
const ledgerSuspect = {};
function checkInventoryIntegrity() {
  attachLedger();
  if (!ledgerLoaded || (typeof isAdmin !== 'undefined' && isAdmin) || typeof myInventory === 'undefined') return;
  const shop = { bgs: new Set(SHOP_DATA.bgs.map(b => b.class)), colors: new Set(SHOP_DATA.colors.map(c => c.hex)), symbols: new Set(SHOP_DATA.symbols.map(x => x.char)) };
  const now = Date.now(), bad = [];
  ['bgs', 'colors', 'symbols'].forEach(kind => {
    (myInventory[kind] || []).forEach(it => {
      const k = kind + '|' + it;
      if (!shop[kind].has(it) || myLedger[kind][ledgerKey(it)]) { delete ledgerSuspect[k]; return; }
      if (!ledgerSuspect[k]) ledgerSuspect[k] = now;
      if (now - ledgerSuspect[k] > 60000) bad.push([kind, it]);
    });
  });
  let changed = false;
  if (bad.length) {
    bad.forEach(([kind, it]) => { myInventory[kind] = (myInventory[kind] || []).filter(x => x !== it); delete ledgerSuspect[kind + '|' + it]; });
    changed = true;
  }
  // 갖고 있지 않은 걸 장착만 해둔 경우 해제
  if (myNickBg && myNickBg !== 'nb-none' && !(myInventory.bgs || []).includes(myNickBg)) { myNickBg = 'nb-none'; changed = true; }
  if (myNickColor && !(myInventory.colors || []).includes(myNickColor)) { myNickColor = ''; changed = true; }
  if (myNickSymbol && !(myInventory.symbols || []).includes(myNickSymbol)) { myNickSymbol = ''; changed = true; }
  if (changed) { updatePointsUI(); if (typeof renderShopUI === 'function') try { renderShopUI(); } catch (e) {} }
  if (bad.length) {
    try { if (typeof reportTamper === 'function') reportTamper('구매 기록 없는 상점 아이템'); } catch (e) {}
    // 관리자가 '이번만 봐주기'(purgeGraceUntil)를 걸어둔 회원은 아이템만 빼고 숙청은 안 함
    db.ref(`user_points/${currentUser.nickname}/purgeGraceUntil`).once('value').then(g => {
      if ((Number(g.val()) || 0) > Date.now()) return;
      if (typeof purgeTamperer === 'function') purgeTamperer(`구매 기록 없는 상점 아이템 ${bad.length}개`);
    }).catch(() => {});
  }
}
setInterval(checkInventoryIntegrity, 20000);
