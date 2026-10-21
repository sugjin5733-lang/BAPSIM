// 밥심 - 반찬 카드 수집 (도감, 카드팩, 세트 보상, 분해)
//
// 내 카드: user_points/{닉네임}/cards = { 카드ID: 장수 }
// 받은 세트 보상: user_points/{닉네임}/setsClaimed = { 세트ID: true }

const CARD_RARITY = {
  C: { name: '일반', color: 'text-slate-600', ring: 'border-slate-300 bg-white', chance: 68, dust: 20 },
  R: { name: '희귀', color: 'text-sky-600', ring: 'border-sky-400 bg-sky-50', chance: 24, dust: 60 },
  E: { name: '영웅', color: 'text-violet-600', ring: 'border-violet-500 bg-violet-50', chance: 7, dust: 250 },
  L: { name: '전설', color: 'text-amber-600', ring: 'border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-100', chance: 1, dust: 1500 }
};

const CARDS = [
  // 일반
  { id: 'kimchi', name: '김치', icon: '🥬', r: 'C' },
  { id: 'gyeran', name: '계란말이', icon: '🥚', r: 'C' },
  { id: 'kongnamul', name: '콩나물무침', icon: '🌱', r: 'C' },
  { id: 'eomuk', name: '어묵볶음', icon: '🍢', r: 'C' },
  { id: 'miyeok', name: '미역국', icon: '🥣', r: 'C' },
  { id: 'kkakdugi', name: '깍두기', icon: '🧊', r: 'C' },
  { id: 'sigeumchi', name: '시금치나물', icon: '🥗', r: 'C' },
  { id: 'gamja', name: '감자조림', icon: '🥔', r: 'C' },
  { id: 'myeolchi', name: '멸치볶음', icon: '🐟', r: 'C' },
  { id: 'dubu', name: '두부부침', icon: '🧈', r: 'C' },
  // 희귀
  { id: 'jeyuk', name: '제육볶음', icon: '🥓', r: 'R' },
  { id: 'donkkas', name: '돈까스', icon: '🍖', r: 'R' },
  { id: 'dakgang', name: '닭강정', icon: '🍗', r: 'R' },
  { id: 'japchae', name: '잡채', icon: '🍝', r: 'R' },
  { id: 'tteokbokki', name: '떡볶이', icon: '🌶️', r: 'R' },
  { id: 'kimchijjim', name: '김치찜', icon: '🍲', r: 'R' },
  { id: 'sundae', name: '찰순대', icon: '🌭', r: 'R' },
  // 영웅
  { id: 'galbijjim', name: '갈비찜', icon: '🥩', r: 'E' },
  { id: 'bossam', name: '보쌈', icon: '🐷', r: 'E' },
  { id: 'pajeon', name: '해물파전', icon: '🦐', r: 'E' },
  { id: 'jangeo', name: '장어구이', icon: '🔥', r: 'E' },
  // 전설
  { id: 'yukhoe', name: '한우 육회', icon: '🐂', r: 'L' },
  { id: 'gejang', name: '간장게장', icon: '🦀', r: 'L' },
  { id: 'sinseollo', name: '신선로', icon: '🏺', r: 'L' }
];
const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

const CARD_SETS = [
  { id: 'basic',  name: '🥢 기본 반찬 세트', cards: ['kimchi', 'gyeran', 'kongnamul', 'sigeumchi', 'myeolchi'], points: 1000, symbol: '🥢' },
  { id: 'bunsik', name: '🌶️ 분식 세트', cards: ['tteokbokki', 'sundae', 'eomuk'], points: 1500 },
  { id: 'buffet', name: '🍱 한식뷔페 메인 세트', cards: ['jeyuk', 'donkkas', 'dakgang', 'kimchijjim', 'japchae'], points: 4000, badge: 'nb-buffet' },
  { id: 'feast',  name: '🎊 잔칫상 세트', cards: ['galbijjim', 'bossam', 'pajeon', 'japchae'], points: 8000 },
  { id: 'royal',  name: '👑 임금님 수라상', cards: ['yukhoe', 'gejang', 'sinseollo'], points: 25000, badge: 'nb-royal' },
  { id: 'all',    name: '📒 반찬 도감 완성', cards: CARDS.map(c => c.id), points: 30000, badge: 'nb-collector' }
];

const CARD_PACK_PRICE = 500;
const CARD_PACK_SIZE = 3;

let myCards = {};
let mySetsClaimed = {};
let myCardsWeek = null; // 이 도감이 어느 주의 것인지 (weekKey)

// auth.js 의 회원 정보 리스너가 호출
function loadCardsFromUser(val) {
  myCards = {};
  Object.entries((val && val.cards) || {}).forEach(([k, v]) => { if (CARD_BY_ID[k] && v > 0) myCards[k] = Number(v) || 0; });
  mySetsClaimed = Object.assign({}, (val && val.setsClaimed) || {});
  myCardsWeek = (val && val.cardsWeek) || null;
  const cnt = document.getElementById('headerCardCount');
  if (cnt) cnt.textContent = `${ownedCardKinds()}/${CARDS.length}`;
  if (!document.getElementById('cardModal')?.classList.contains('hidden')) renderCardBook();
}

function ownedCardKinds() { return CARDS.filter(c => (myCards[c.id] || 0) > 0).length; }

function rollRarity(bonusLuck = 0) {
  // bonusLuck: 상위 등급 확률을 조금 올려줌 (예: 고강화 보상)
  let x = Math.random() * 100;
  x = Math.max(0, x - bonusLuck);
  if (x < CARD_RARITY.L.chance) return 'L';
  if (x < CARD_RARITY.L.chance + CARD_RARITY.E.chance) return 'E';
  if (x < CARD_RARITY.L.chance + CARD_RARITY.E.chance + CARD_RARITY.R.chance) return 'R';
  return 'C';
}

function drawRandomCard(bonusLuck = 0) {
  const r = rollRarity(bonusLuck);
  const pool = CARDS.filter(c => c.r === r);
  return pool[Math.floor(Math.random() * pool.length)];
}

// 카드를 얻었을 때: 서버 저장 + 전설은 전광판
function addCardsToCollection(cards, source) {
  if (!canSyncToCloud() || cards.length === 0) return;
  const updates = {};
  const next = Object.assign({}, myCards);
  cards.forEach(c => { next[c.id] = (next[c.id] || 0) + 1; });
  cards.forEach(c => { updates[`cards/${c.id}`] = next[c.id]; });
  myCards = next;
  db.ref(`user_points/${currentUser.nickname}`).update(updates).catch(err => console.warn('카드 저장 실패:', err && err.message));
  cards.filter(c => c.r === 'L').forEach(c => postFeed('card', `${source}에서 전설 카드 ${c.icon} [${c.name}]을(를) 뽑았어요!`, 'legendary'));
  cards.filter(c => c.r === 'E').forEach(c => postFeed('card', `${source}에서 영웅 카드 ${c.icon} [${c.name}] 획득!`, 'normal'));
  loadCardsFromUser({ cards: myCards, setsClaimed: mySetsClaimed });
}

// 게임에서 이겼을 때 일정 확률로 카드 1장 (games.js / enhance.js 에서 호출)
function maybeDropCard(source, chancePercent = 8, bonusLuck = 0) {
  if (!canSyncToCloud()) return null;
  if (Math.random() * 100 >= chancePercent) return null;
  const c = drawRandomCard(bonusLuck);
  addCardsToCollection([c], source);
  showCardDropToast(c, source);
  return c;
}

function showCardDropToast(c, source) {
  const box = document.getElementById('feedToastContainer');
  if (!box) return;
  const t = document.createElement('div');
  t.className = `feed-toast card-drop-toast card-r-${c.r}`;
  t.innerHTML = `<div class="text-3xl leading-none">${c.icon}</div>
    <div><div class="text-[10px] font-black ${CARD_RARITY[c.r].color}">🃏 ${CARD_RARITY[c.r].name} 카드 드롭! · ${esc(source)}</div>
    <div class="text-sm font-black text-slate-900">${esc(c.name)}</div></div>`;
  box.appendChild(t);
  if (c.r === 'L' && window.confetti) confetti({ particleCount: 200, spread: 120 });
  setTimeout(() => t.classList.add('feed-toast-out'), 3800);
  setTimeout(() => t.remove(), 4500);
}

// ==========================================
// 카드팩
// ==========================================
let packOpening = false;
async function buyCardPack() {
  if (!checkApprovalGuard() || packOpening) return;
  if (userPoints < CARD_PACK_PRICE) return alert(`❌ 포인트가 부족해요! (카드팩 ${CARD_PACK_PRICE}P)`);
  packOpening = true;
  addPoints(-CARD_PACK_PRICE, '카드팩 구매');
  updatePointsUI();

  const pulled = Array.from({ length: CARD_PACK_SIZE }, () => drawRandomCard());
  const stage = document.getElementById('cardPackStage');
  stage.classList.remove('hidden');
  stage.innerHTML = pulled.map((c, i) => `
    <div class="pack-card" style="animation-delay:${i * 0.35}s">
      <div class="pack-card-inner">
        <div class="pack-card-back">🍚</div>
        <div class="pack-card-front border-2 ${CARD_RARITY[c.r].ring} card-r-${c.r}">
          <div class="text-3xl">${c.icon}</div>
          <div class="text-[11px] font-black text-slate-900 mt-1">${esc(c.name)}</div>
          <div class="text-[9px] font-black ${CARD_RARITY[c.r].color}">${CARD_RARITY[c.r].name}${(myCards[c.id] || 0) === 0 ? ' · NEW' : ''}</div>
        </div>
      </div>
    </div>`).join('');

  const best = pulled.reduce((a, c) => ('CREL'.indexOf(c.r) > 'CREL'.indexOf(a.r) ? c : a), pulled[0]);
  setTimeout(() => {
    addCardsToCollection(pulled, '카드팩');
    if (best.r === 'L' && window.confetti) confetti({ particleCount: 250, spread: 140 });
    else if (best.r === 'E' && window.confetti) confetti({ particleCount: 90 });
    packOpening = false;
  }, CARD_PACK_SIZE * 350 + 700);
}

// ==========================================
// 세트 보상 / 분해
// ==========================================
function setProgress(set) {
  const have = set.cards.filter(id => (myCards[id] || 0) > 0).length;
  return { have, total: set.cards.length, done: have === set.cards.length };
}

function claimSetReward(setId) {
  if (!checkApprovalGuard()) return;
  const set = CARD_SETS.find(s => s.id === setId);
  if (!set || mySetsClaimed[setId] || !setProgress(set).done) return;
  if (!canGainPoints(set.points)) return alert('⏳ ' + budgetWaitText(set.points));

  addPoints(set.points, `세트 보상: ${set.name}`);
  mySetsClaimed[setId] = true;
  if (set.badge && !myInventory.bgs.includes(set.badge)) myInventory.bgs.push(set.badge);
  if (set.symbol && !myInventory.symbols.includes(set.symbol)) myInventory.symbols.push(set.symbol);
  db.ref(`user_points/${currentUser.nickname}/setsClaimed/${setId}`).set(true);
  updatePointsUI();
  if (set.id === 'all') postFeed('set', `📒 이번 주 반찬 도감을 모두 채웠어요! +${set.points.toLocaleString()}P`, 'legendary', true);
  if (window.confetti) confetti({ particleCount: 180, spread: 120 });
  alert(`🎉 ${set.name} 완성 보상!\n+${set.points.toLocaleString()}P${set.badge ? '\n+ 전용 배지 (상점 > 내 획득 배지에서 장착)' : ''}${set.symbol ? `\n+ 전용 칭호 ${set.symbol}` : ''}`);
  renderCardBook();
}

function dismantleDuplicates() {
  if (!checkApprovalGuard()) return;
  let gain = 0, count = 0;
  const next = {};
  Object.entries(myCards).forEach(([id, n]) => {
    const extra = Math.max(0, n - 1);
    if (extra > 0) { gain += extra * CARD_RARITY[CARD_BY_ID[id].r].dust; count += extra; }
    next[id] = Math.min(n, 1);
  });
  if (count === 0) return alert('분해할 중복 카드가 없어요. (각 카드 1장씩은 도감용으로 남겨둬요)');
  if (!canGainPoints(gain)) return alert('⏳ ' + budgetWaitText(gain));
  if (!confirm(`중복 카드 ${count}장을 분해해서 ${gain.toLocaleString()}P로 바꿀까요?\n(각 카드 1장씩은 남아요)`)) return;

  const updates = {};
  Object.entries(next).forEach(([id, n]) => { updates[`cards/${id}`] = n; });
  myCards = next;
  addPoints(gain, `중복 카드 분해 ${count}장`);
  db.ref(`user_points/${currentUser.nickname}`).update(updates);
  updatePointsUI();
  renderCardBook();
}

// ==========================================
// 도감 화면
// ==========================================
function openCardModal() {
  if (!checkApprovalGuard()) return;
  document.getElementById('cardPackStage').classList.add('hidden');
  renderCardBook();
  document.getElementById('cardModal').classList.remove('hidden');
}
function closeCardModal() { document.getElementById('cardModal').classList.add('hidden'); }

function renderCardBook() {
  const grid = document.getElementById('cardBookGrid');
  const prog = document.getElementById('cardBookProgress');
  const sets = document.getElementById('cardSetList');
  if (!grid) return;

  const owned = ownedCardKinds();
  if (prog) prog.innerHTML = `<span class="font-black">${owned}</span> / ${CARDS.length}종 수집 <span class="text-slate-400">(${Math.round(owned / CARDS.length * 100)}%)</span>`;
  const wk = document.getElementById('cardWeekInfo');
  if (wk) wk.textContent = `🗓️ 이번 주 도감 · 월요일 0시 초기화까지 ${seasonTimeLeftText()} · 세트 보상은 매주 다시 받을 수 있어요 (배지·칭호는 유지)`;
  const bar = document.getElementById('cardBookBar');
  if (bar) bar.style.width = `${owned / CARDS.length * 100}%`;

  grid.innerHTML = CARDS.map(c => {
    const n = myCards[c.id] || 0;
    const rar = CARD_RARITY[c.r];
    return n > 0 ? `
      <div class="relative rounded-xl border-2 ${rar.ring} card-r-${c.r} p-1.5 text-center" title="${esc(c.name)}">
        <div class="text-2xl leading-none">${c.icon}</div>
        <div class="text-[10px] font-bold text-slate-800 truncate mt-0.5">${esc(c.name)}</div>
        <div class="text-[9px] font-black ${rar.color}">${rar.name}</div>
        ${n > 1 ? `<span class="absolute -top-1.5 -right-1.5 bg-slate-900 text-white text-[9px] font-black rounded-full px-1.5">x${n}</span>` : ''}
      </div>` : `
      <div class="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-1.5 text-center">
        <div class="text-2xl leading-none grayscale opacity-20">${c.icon}</div>
        <div class="text-[10px] font-bold text-slate-300 mt-0.5">???</div>
        <div class="text-[9px] font-black ${rar.color} opacity-50">${rar.name}</div>
      </div>`;
  }).join('');

  if (sets) {
    sets.innerHTML = CARD_SETS.map(s => {
      const p = setProgress(s);
      const claimed = !!mySetsClaimed[s.id];
      return `
        <div class="p-2.5 rounded-xl border ${claimed ? 'bg-slate-50 border-slate-200 opacity-60' : p.done ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'} flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="font-black text-xs text-slate-800">${s.name}</div>
            <div class="text-[10px] text-slate-500">${p.have}/${p.total} · 보상 ${s.points.toLocaleString()}P${s.badge ? ' + 전용 배지' : ''}${s.symbol ? ' + 칭호 ' + s.symbol : ''}</div>
            <div class="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden"><div class="h-full bg-amber-400" style="width:${p.have / p.total * 100}%"></div></div>
          </div>
          ${claimed ? '<span class="text-[10px] font-black text-slate-400 shrink-0">받음 ✓</span>'
            : p.done ? `<button onclick="claimSetReward('${s.id}')" class="shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-black px-2.5 py-1.5 rounded-lg text-[11px] animate-pulse">보상 받기</button>`
            : '<span class="text-[10px] font-bold text-slate-300 shrink-0">진행 중</span>'}
        </div>`;
    }).join('');
  }

  const dupes = Object.entries(myCards).reduce((a, [id, n]) => a + Math.max(0, n - 1) * CARD_RARITY[CARD_BY_ID[id].r].dust, 0);
  const dBtn = document.getElementById('cardDismantleBtn');
  if (dBtn) dBtn.textContent = dupes > 0 ? `♻️ 중복 분해 (+${dupes.toLocaleString()}P)` : '♻️ 중복 분해';
}

// 받은 세트 보상의 배지/칭호가 인벤토리에 없으면 복구
// (보상 포인트·배지가 사라지던 버그 때문에 생긴 누락을 자동으로 메꿈)
function restoreSetCosmetics() {
  let fixed = false;
  CARD_SETS.forEach(s => {
    if (!mySetsClaimed[s.id]) return;
    if (s.badge && !myInventory.bgs.includes(s.badge)) { myInventory.bgs.push(s.badge); fixed = true; }
    if (s.symbol && !myInventory.symbols.includes(s.symbol)) { myInventory.symbols.push(s.symbol); fixed = true; }
  });
  return fixed;
}

// ==========================================
// 📒 반찬 도감 주간 초기화 (매주 월요일 0시, 한국 시간)
// - 카드와 '받은 세트 보상' 기록만 초기화 → 세트 보상은 매주 다시 받을 수 있음
// - 이미 받은 세트 배지·칭호(치장)는 계속 유지
// ==========================================
let cardResetRunning = false;
async function checkWeeklyCardReset() {
  if (!canSyncToCloud() || cardResetRunning) return;
  const wk = weekKey();
  if (myCardsWeek === wk) return;
  // 이 기능 도입 전부터 있던 도감은 '이번 주 것'으로 인정 (첫 초기화는 다음 월요일)
  if (!myCardsWeek) {
    myCardsWeek = wk;
    db.ref(`user_points/${currentUser.nickname}/cardsWeek`).set(wk).catch(() => {});
    return;
  }
  cardResetRunning = true;
  const hadAny = Object.keys(myCards).length > 0 || Object.keys(mySetsClaimed).length > 0;
  try {
    myCards = {}; mySetsClaimed = {}; myCardsWeek = wk;
    await db.ref(`user_points/${currentUser.nickname}`).update({ cards: null, setsClaimed: null, cardsWeek: wk });
    loadCardsFromUser({ cards: {}, setsClaimed: {}, cardsWeek: wk });
    if (hadAny) {
      const box = document.getElementById('feedToastContainer');
      if (box) {
        const el = document.createElement('div');
        el.className = 'feed-toast feed-toast-plain';
        el.innerHTML = '<div class="text-[10px] font-black text-slate-500">📒 새 주 시작</div><div class="text-xs font-bold">반찬 도감이 초기화됐어요! 이번 주에도 도감을 채워서 세트 보상을 받아보세요.<br><span class="text-slate-500">(지난번에 받은 세트 배지·칭호는 그대로예요)</span></div>';
        box.appendChild(el);
        setTimeout(() => el.classList.add('feed-toast-out'), 8000);
        setTimeout(() => el.remove(), 8700);
      }
    }
  } catch (err) {
    console.warn('도감 초기화 실패:', err && err.message);
  } finally {
    cardResetRunning = false;
  }
}
setInterval(checkWeeklyCardReset, 60000);
