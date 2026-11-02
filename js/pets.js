// 밥심 - 🐾 펫 (뽑기 + 강화)
//
//  - 🥚 펫 알 20만P (10연차 200만P) · 천장 없음 · 알값은 소각
//  - 데리고 다니는 펫 1마리 효과만 적용: 강화비 할인 · 판매가 증가 (+ 영웅 이상 특수 능력)
//  - 같은 펫이 또 나오면 별(★)이 올라가고, 별이 펫 강화 상한을 엶 (★1 +4 · ★2 +6 · ★3 +8 · ★4 +9 · ★5 +10)
//  - 펫 강화 +1~+10: 단계마다 효과 +8% (+10이면 1.8배) · 파괴 없음 · +6부터는 실패 시 50% 확률로 1단계 하락
//  - 하루 먹이를 줘야 효과가 켜짐 (일반은 무료) · 먹이값·강화비 10%는 은행 금고, 나머지 소각
//  데이터: user_points/{닉}/pets { owned:{id:{star,lv}}, active, fedDay, snacks, shieldDay, shieldUsed } · user_points/{닉}/petTag
//         bank/pet_ledger/{닉}/{id} { copies, lv }  ← 뽑기·강화 기록 (콘솔로 펫을 몰래 넣으면 회수 + 숙청)

const PET_EGG_PRICE = 200000;
const PET_GRADES = {
  common: { name: '일반', rate: 84.778, cost: 0.2, sale: 0.5, feed: 0,      up: 10000,    color: 'text-slate-500',  ring: 'pet-g-common' },
  rare:   { name: '희귀', rate: 15,     cost: 0.5, sale: 1,   feed: 1000,   up: 50000,    color: 'text-sky-500',    ring: 'pet-g-rare' },
  hero:   { name: '영웅', rate: 0.2,    cost: 2,   sale: 3,   feed: 10000,  up: 500000,   color: 'text-violet-500', ring: 'pet-g-hero' },
  legend: { name: '전설', rate: 0.02,   cost: 4,   sale: 6,   feed: 50000,  up: 3000000,  color: 'text-amber-500',  ring: 'pet-g-legend' },
  mythic: { name: '신화', rate: 0.002,  cost: 6,   sale: 9,   feed: 200000, up: 15000000, color: 'text-fuchsia-500', ring: 'pet-g-mythic' }
};
const PETS = {
  chick:   { g: 'common', icon: '🐣', name: '밥알 병아리' },
  snail:   { g: 'common', icon: '🐌', name: '숭늉 달팽이' },
  mouse:   { g: 'common', icon: '🐭', name: '쌀톨 생쥐' },
  hamster: { g: 'rare',   icon: '🐹', name: '누룽지 햄스터' },
  rabbit:  { g: 'rare',   icon: '🐰', name: '떡 토끼' },
  duck:    { g: 'rare',   icon: '🦆', name: '국자 오리' },
  fox:     { g: 'hero',   icon: '🦊', name: '숭늉 여우' },
  panda:   { g: 'hero',   icon: '🐼', name: '주먹밥 판다' },
  owl:     { g: 'hero',   icon: '🦉', name: '밥솥 부엉이' },
  dragon:  { g: 'legend', icon: '🐉', name: '솥뚜껑 용' },
  lion:    { g: 'legend', icon: '🦁', name: '뷔페 사자' },
  unicorn: { g: 'mythic', icon: '🦄', name: '천상의 밥솥 유니콘' },
  phoenix: { g: 'mythic', icon: '🔥', name: '불사조 가마솥' }
};
const PET_STAR_CAP = [0, 4, 6, 8, 9, 10];
const PET_UP_RATE = [90, 80, 70, 60, 50, 40, 30, 20, 12, 6]; // +0→+1 ... +9→+10
const PET_SNACK_PRICE = 20000;

let myPets = { owned: {}, active: '', fedDay: '', snacks: 0, shieldDay: '', shieldUsed: 0 };
let petsLoaded = false;
let petLedger = {}, petLedgerLoaded = false, petLedgerRef = null, petLedgerNick = '';

function petNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function petToday() { return todayKey(petNow()); }
function loadPetsFromUser(val) {
  const p = (val && val.pets) || {};
  myPets = {
    owned: p.owned && typeof p.owned === 'object' ? p.owned : {},
    active: String(p.active || ''), fedDay: String(p.fedDay || ''), snacks: Math.max(0, Number(p.snacks) || 0),
    shieldDay: String(p.shieldDay || ''), shieldUsed: Math.max(0, Number(p.shieldUsed) || 0)
  };
  petsLoaded = true;
  renderPetModal();
}
// 펫을 바꾼 직후 곧바로 저장해야 함 (포인트 저장이 먼저 일어나면 서버의 옛 펫 정보로 되돌려짐)
function savePets(extra) {
  if (typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  const upd = { pets: myPets, petTag: activePetTag() };
  Object.assign(upd, extra || {});
  db.ref(`user_points/${currentUser.nickname}`).update(upd).catch(e => console.warn('펫 저장 실패', e && e.message));
}
function petLedgerAdd(id, fields) {
  if (typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  petLedger[id] = Object.assign({}, petLedger[id] || {}, fields);
  db.ref(`bank/pet_ledger/${currentUser.nickname}/${id}`).update(fields).catch(() => {});
}

// ------------------------------------------------------------------
// 효과
// ------------------------------------------------------------------
function activePet() {
  const id = myPets.active, o = myPets.owned[id];
  if (!id || !o || !PETS[id]) return null;
  return Object.assign({ id, lv: Math.max(0, Number(o.lv) || 0), star: Math.max(1, Number(o.star) || 1) }, PETS[id]);
}
function petFedToday(p) { return !!p && (PET_GRADES[p.g].feed === 0 || myPets.fedDay === petToday()); }
function petPowered() { const p = activePet(); return p && petFedToday(p) ? p : null; }
function petMult(p) { return 1 + 0.08 * p.lv; }
function petTier(p) { return p.lv >= 10 ? 2 : p.lv >= 5 ? 1 : 0; }
function petCostPct(p) { return PET_GRADES[p.g].cost * petMult(p); }
function petSalePct(p) { return PET_GRADES[p.g].sale * petMult(p); }
function petCostMult() { const p = petPowered(); return p ? 1 - petCostPct(p) / 100 : 1; }
function petSaleMult() { const p = petPowered(); return p ? 1 + petSalePct(p) / 100 : 1; }
function petJumpChance() { const p = petPowered(); return p && p.g === 'hero' ? [0.055, 0.06, 0.065][petTier(p)] : JUMP_CHANCE; }
function petLuckyChance() { const p = petPowered(); return p && p.g === 'mythic' ? [0.06, 0.065, 0.07][petTier(p)] : 0.05; }
function petShieldMax(p) { return !p ? 0 : p.g === 'legend' ? [1, 1, 2][petTier(p)] : p.g === 'mythic' ? [2, 2, 3][petTier(p)] : 0; }
function petShieldLeft() { const p = petPowered(); const max = petShieldMax(p); return Math.max(0, max - (myPets.shieldDay === petToday() ? myPets.shieldUsed : 0)); }
// 밥키우기 파괴 직전 호출: +20강 미만이면 하루 정해진 횟수만큼 막아줌
function petShield(fromLevel) {
  if (fromLevel >= 20 || petShieldLeft() <= 0) return false;
  const today = petToday();
  if (myPets.shieldDay !== today) { myPets.shieldDay = today; myPets.shieldUsed = 0; }
  myPets.shieldUsed += 1;
  savePets();
  return true;
}
function petSpecialText(p, tier = petTier(p)) {
  if (p.g === 'hero') return `대박 점프 5% → ${[5.5, 6, 6.5][tier]}%`;
  if (p.g === 'legend') return `하루 ${[1, 1, 2][tier]}번 파괴 막기 (+20강 미만)`;
  if (p.g === 'mythic') return `하루 ${[2, 2, 3][tier]}번 파괴 막기 · 대박 손님 5% → ${[6, 6.5, 7][tier]}%`;
  return '';
}
function activePetTag() { const p = activePet(); return p ? `${p.icon}+${p.lv}★${p.star}` : ''; }
function fmtPct(x) { return (Math.round(x * 100) / 100).toString(); }

// ------------------------------------------------------------------
// 🥚 뽑기
// ------------------------------------------------------------------
function rollPet() {
  const r = Math.random() * 100;
  let acc = 0, grade = 'common';
  for (const g of ['mythic', 'legend', 'hero', 'rare', 'common']) { acc += PET_GRADES[g].rate; if (r < acc) { grade = g; break; } }
  const ids = Object.keys(PETS).filter(id => PETS[id].g === grade);
  return ids[Math.floor(Math.random() * ids.length)];
}
async function buyPetEggs(n) {
  if (!checkApprovalGuard()) return;
  attachPetLedger();
  if (!petsLoaded || !petLedgerLoaded) return alert('펫 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
  const price = PET_EGG_PRICE * n;
  if (userPoints < price) return alert(`❌ 포인트가 부족해요! (${price.toLocaleString()}P)`);
  if (!confirm(`🥚 펫 알 ${n}개를 ${price.toLocaleString()}P에 깔까요?\n(알값은 소각 · 천장 없음)`)) return;
  addPoints(-price, `🥚 펫 알 ${n}개 (소각)`);
  const got = [];
  for (let i = 0; i < n; i++) {
    const id = rollPet();
    const o = myPets.owned[id];
    let note = '';
    if (!o) { myPets.owned[id] = { star: 1, lv: 0 }; note = 'NEW'; }
    else if ((o.star || 1) < 5) { o.star = (o.star || 1) + 1; note = `★${o.star}`; }
    else { myPets.snacks += 3; note = '간식 +3'; }
    petLedgerAdd(id, { copies: ((petLedger[id] && petLedger[id].copies) || 0) + 1 });
    got.push({ id, note });
  }
  if (!myPets.active && got.length) myPets.active = got[0].id;
  savePets(); // ⚠️ 반드시 updatePointsUI 보다 먼저: 포인트 저장 시 서버 값으로 펫 정보가 되돌려져서 방금 뽑은 펫이 사라지던 버그
  updatePointsUI();
  got.filter(x => ['legend', 'mythic', 'hero'].includes(PETS[x.id].g)).forEach(x => {
    const p = PETS[x.id];
    if (typeof postFeed === 'function') postFeed('pet', `🥚 펫 알에서 ${PET_GRADES[p.g].name} 펫 ${p.icon} [${p.name}]이(가) 나왔어요!`, p.g === 'hero' ? 'big' : 'legendary', p.g !== 'hero');
  });
  showPetHatch(got);
  renderPetModal();
}
function showPetHatch(got) {
  const order = ['common', 'rare', 'hero', 'legend', 'mythic'];
  const best = got.reduce((a, x) => order.indexOf(PETS[x.id].g) > order.indexOf(a) ? PETS[x.id].g : a, 'common');
  const box = document.getElementById('petHatchResult');
  if (!box) return;
  box.className = `pet-hatch pet-hatch-${best} rounded-2xl p-3`;
  box.innerHTML = `<div class="text-[11px] font-black text-center mb-2">${best === 'mythic' ? '🌈 신 화 강 림 🌈' : best === 'legend' ? '✨ 전설의 펫! ✨' : best === 'hero' ? '💜 영웅 펫!' : '🥚 부화 결과'}</div>
    <div class="grid grid-cols-5 gap-1.5">${got.map(x => { const p = PETS[x.id]; return `<div class="pet-chip ${PET_GRADES[p.g].ring}"><div class="text-2xl">${p.icon}</div><div class="text-[9px] font-black ${PET_GRADES[p.g].color}">${PET_GRADES[p.g].name}</div><div class="text-[9px] text-slate-500">${x.note}</div></div>`; }).join('')}</div>`;
  if (best === 'mythic' || best === 'legend') { if (window.confetti) confetti({ particleCount: best === 'mythic' ? 300 : 160, spread: 130 }); }
}

// ------------------------------------------------------------------
// 데리고 다니기 · 먹이 · 간식
// ------------------------------------------------------------------
function setActivePet(id) {
  if (!myPets.owned[id]) return;
  myPets.active = id;
  savePets();
  renderPetModal();
  if (typeof updateEnhanceUI === 'function') try { updateEnhanceUI(); } catch (e) {}
}
function petFeedCost(p) { return Math.round(PET_GRADES[p.g].feed * (1 + 0.2 * p.lv)); }
function feedPet() {
  if (!checkApprovalGuard()) return;
  const p = activePet();
  if (!p) return alert('데리고 다니는 펫이 없어요.');
  if (petFedToday(p)) return alert('오늘은 이미 배불러요! 🍚');
  const c = petFeedCost(p);
  if (userPoints < c) return alert(`❌ 포인트가 부족해요! (먹이 ${c.toLocaleString()}P)`);
  addPoints(-c, `🍚 펫 먹이 (${p.name})`);
  if (typeof payFee === 'function') payFee(c);
  myPets.fedDay = petToday();
  savePets(); // ⚠️ 반드시 updatePointsUI 보다 먼저: 포인트 저장 시 서버 값으로 펫 정보가 되돌려져서 방금 뽑은 펫이 사라지던 버그
  updatePointsUI();
  renderPetModal();
}
function buyPetSnack() {
  if (!checkApprovalGuard()) return;
  if (userPoints < PET_SNACK_PRICE) return alert(`❌ 포인트가 부족해요! (${PET_SNACK_PRICE.toLocaleString()}P)`);
  addPoints(-PET_SNACK_PRICE, '🍖 펫 간식 구매');
  if (typeof payFee === 'function') payFee(Math.round(PET_SNACK_PRICE * 0.1));
  myPets.snacks += 1;
  savePets(); // ⚠️ 반드시 updatePointsUI 보다 먼저: 포인트 저장 시 서버 값으로 펫 정보가 되돌려져서 방금 뽑은 펫이 사라지던 버그
  updatePointsUI();
  renderPetModal();
}

// ------------------------------------------------------------------
// ⚒️ 펫 강화
// ------------------------------------------------------------------
let petUseSnack = false;
function petUpCost(id) { const o = myPets.owned[id], g = PET_GRADES[PETS[id].g]; return Math.round(g.up * (1 + (Number(o.lv) || 0) * 0.5)); }
function togglePetSnack() { petUseSnack = !petUseSnack; renderPetModal(); }
function enhancePet(id) {
  if (!checkApprovalGuard()) return;
  attachPetLedger();
  if (!petLedgerLoaded) return alert('펫 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
  const o = myPets.owned[id];
  if (!o) return;
  const lv = Number(o.lv) || 0, star = Math.max(1, Number(o.star) || 1);
  if (lv >= 10) return alert('이미 +10 최고 단계예요!');
  if (lv >= PET_STAR_CAP[star]) return alert(`★${star}는 +${PET_STAR_CAP[star]}까지만 강화할 수 있어요.\n같은 펫을 또 뽑으면 별이 올라가서 상한이 열려요.`);
  const cost = petUpCost(id);
  if (userPoints < cost) return alert(`❌ 포인트가 부족해요! (${cost.toLocaleString()}P)`);
  const snack = petUseSnack && myPets.snacks > 0;
  const rate = Math.min(100, PET_UP_RATE[lv] + (snack ? 10 : 0));
  addPoints(-cost, `⚒️ 펫 강화 ${PETS[id].icon} +${lv}→+${lv + 1}${snack ? ' (간식)' : ''}`);
  if (typeof payFee === 'function') payFee(Math.round(cost * 0.1));
  if (snack) myPets.snacks -= 1;
  const roll = Math.random() * 100;
  let msg;
  if (roll < rate) {
    o.lv = lv + 1;
    msg = `<span class="text-emerald-600 font-black">🎉 ${PETS[id].icon} +${o.lv} 성공!</span>`;
    if (o.lv >= 8 && typeof postFeed === 'function') postFeed('pet', `⚒️ ${PETS[id].icon} [${PETS[id].name}] 펫 강화 +${o.lv} 성공!`, o.lv >= 10 ? 'legendary' : 'big', o.lv >= 9);
  } else if (lv >= 5 && Math.random() < 0.5) {
    o.lv = lv - 1;
    msg = `<span class="text-rose-500 font-black">📉 실패… +${o.lv}로 한 단계 내려갔어요</span>`;
  } else {
    msg = `<span class="text-amber-600 font-bold">⚠️ 실패! +${lv} 유지</span>`;
  }
  petLedgerAdd(id, { lv: Math.max(o.lv, (petLedger[id] && petLedger[id].lv) || 0) });
  savePets(); // ⚠️ 반드시 updatePointsUI 보다 먼저: 포인트 저장 시 서버 값으로 펫 정보가 되돌려져서 방금 뽑은 펫이 사라지던 버그
  updatePointsUI();
  renderPetModal();
  const r = document.getElementById(`petUpMsg_${id}`);
  if (r) r.innerHTML = msg;
}

// ------------------------------------------------------------------
// 🧾 무결성: 뽑기 기록(bank/pet_ledger)보다 많은 펫/별/강화가 있으면 회수 + 숙청 (1분 유예)
// ------------------------------------------------------------------
function attachPetLedger() {
  if (typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  if (petLedgerRef && petLedgerNick === currentUser.nickname) return;
  if (petLedgerRef) petLedgerRef.off();
  petLedgerNick = currentUser.nickname; petLedgerLoaded = false;
  petLedgerRef = db.ref(`bank/pet_ledger/${petLedgerNick}`);
  petLedgerRef.on('value', s => { const v = s.val() || {}; Object.keys(petLedger).forEach(k => { if (!v[k]) v[k] = petLedger[k]; }); petLedger = v; petLedgerLoaded = true; }, () => { petLedgerRef = null; });
}
const petSuspect = {};
function checkPetIntegrity() {
  attachPetLedger();
  if (!petLedgerLoaded || !petsLoaded || (typeof isAdmin !== 'undefined' && isAdmin)) return;
  const now = Date.now(), bad = [];
  Object.entries(myPets.owned).forEach(([id, o]) => {
    const L = petLedger[id] || {};
    const ok = PETS[id] && (Number(L.copies) || 0) >= Math.min(5, Number(o.star) || 1) && (Number(L.lv) || 0) >= (Number(o.lv) || 0);
    if (ok) { delete petSuspect[id]; return; }
    if (!petSuspect[id]) petSuspect[id] = now;
    if (now - petSuspect[id] > 60000) bad.push(id);
  });
  if (!bad.length) return;
  bad.forEach(id => { delete myPets.owned[id]; delete petSuspect[id]; if (myPets.active === id) myPets.active = ''; });
  savePets();
  try { if (typeof reportTamper === 'function') reportTamper('기록 없는 펫'); } catch (e) {}
  if (typeof purgeTamperer === 'function') purgeTamperer(`기록 없는 펫 ${bad.length}마리`);
}
setInterval(checkPetIntegrity, 20000);

// ------------------------------------------------------------------
// 화면
// ------------------------------------------------------------------
let petTab = 'mine';
function openPetModal(tab) { if (!checkApprovalGuard()) return; if (tab) petTab = tab; document.getElementById('petModal').classList.remove('hidden'); renderPetModal(); }
function closePetModal() { document.getElementById('petModal').classList.add('hidden'); }
function setPetTab(t) { petTab = t; renderPetModal(); }
function renderPetModal() {
  const m = document.getElementById('petModal');
  if (!m || m.classList.contains('hidden')) return;
  ['mine', 'gacha', 'book'].forEach(t => {
    const b = document.getElementById(`petTab_${t}`);
    if (b) b.className = `flex-1 py-2 rounded-xl text-xs font-black ${petTab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`;
    const s = document.getElementById(`petSec_${t}`);
    if (s) s.classList.toggle('hidden', petTab !== t);
  });
  const pts = document.getElementById('petMyPoints'); if (pts) pts.textContent = `${userPoints.toLocaleString()}P`;
  // 데리고 다니는 펫
  const a = activePet(), head = document.getElementById('petActiveBox');
  if (head) head.innerHTML = a ? `<div class="pet-active ${PET_GRADES[a.g].ring} rounded-2xl p-3 flex items-center gap-3">
      <div class="text-4xl">${a.icon}</div>
      <div class="min-w-0 flex-1">
        <div class="text-xs font-black text-slate-800">${a.name} <span class="${PET_GRADES[a.g].color}">${PET_GRADES[a.g].name}</span> <span class="text-amber-500">+${a.lv} ★${a.star}</span></div>
        <div class="text-[11px] text-slate-600">강화비 −${fmtPct(petCostPct(a))}% · 판매가 +${fmtPct(petSalePct(a))}%${petSpecialText(a) ? ` · ${petSpecialText(a)}` : ''}</div>
        <div class="text-[10px] mt-0.5 ${petFedToday(a) ? 'text-emerald-600' : 'text-rose-500'} font-bold">${petFedToday(a) ? (PET_GRADES[a.g].feed === 0 ? '🍚 일반 펫은 먹이가 필요 없어요 · 효과 켜짐' : '🍚 오늘 먹이 먹음 · 효과 켜짐') : '😢 배고파요 · 효과 꺼짐'}${petShieldMax(a) ? ` · 🛡️ 오늘 파괴 막기 ${petShieldLeft()}회 남음` : ''}</div>
      </div>
      ${petFedToday(a) ? '' : `<button onclick="feedPet()" class="shrink-0 bg-emerald-500 text-white font-black px-2.5 py-1.5 rounded-xl text-[11px]">먹이<br>${petFeedCost(a).toLocaleString()}P</button>`}
    </div>` : '<div class="text-center text-[11px] text-slate-400 py-3">아직 펫이 없어요. 🥚 뽑기 탭에서 알을 까보세요!</div>';
  // 내 펫 목록 + 강화
  const list = document.getElementById('petMineList');
  if (list) {
    const ids = Object.keys(myPets.owned).filter(id => PETS[id]).sort((x, y) => ['mythic', 'legend', 'hero', 'rare', 'common'].indexOf(PETS[x].g) - ['mythic', 'legend', 'hero', 'rare', 'common'].indexOf(PETS[y].g));
    list.innerHTML = ids.length === 0 ? '' : `<div class="flex items-center justify-between text-[11px]"><span class="font-black text-slate-700">⚒️ 펫 강화</span>
        <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" ${petUseSnack ? 'checked' : ''} onchange="togglePetSnack()" class="accent-amber-500"> 🍖 간식 쓰기 (+10%p) · 보유 ${myPets.snacks}개</label></div>` +
      ids.map(id => {
        const o = myPets.owned[id], p = PETS[id], g = PET_GRADES[p.g], lv = Number(o.lv) || 0, star = Math.max(1, Number(o.star) || 1);
        const capped = lv >= PET_STAR_CAP[star];
        const rate = Math.min(100, (PET_UP_RATE[lv] || 0) + (petUseSnack && myPets.snacks > 0 ? 10 : 0));
        return `<div class="pet-row ${g.ring} rounded-xl p-2.5 flex items-center gap-2.5">
          <div class="text-2xl">${p.icon}</div>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] font-black text-slate-800">${p.name} <span class="${g.color}">${g.name}</span> <span class="text-amber-500">+${lv} ★${star}</span> ${myPets.active === id ? '<span class="text-[9px] bg-slate-900 text-white px-1.5 py-0.5 rounded">데리고 다니는 중</span>' : `<button onclick="setActivePet('${id}')" class="text-[9px] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded font-bold">데리고 다니기</button>`}</div>
            <div class="text-[10px] text-slate-500">${lv >= 10 ? '최고 단계!' : capped ? `★${star} 상한 +${PET_STAR_CAP[star]} · 같은 펫을 또 뽑으면 열려요` : `+${lv}→+${lv + 1} 성공 ${rate}%${lv >= 5 ? ' · 실패 시 50% 하락' : ''}`}</div>
            <div id="petUpMsg_${id}" class="text-[10px]"></div>
          </div>
          ${lv >= 10 || capped ? '' : `<button onclick="enhancePet('${id}')" class="shrink-0 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-2.5 py-1.5 rounded-xl text-[11px]">강화<br>${(petUpCost(id) / 10000).toLocaleString()}만P</button>`}
        </div>`;
      }).join('');
  }
  // 도감
  const book = document.getElementById('petBookList');
  if (book) book.innerHTML = ['mythic', 'legend', 'hero', 'rare', 'common'].map(gk => {
    const g = PET_GRADES[gk];
    const ex = { cost: g.cost, sale: g.sale };
    return `<div class="space-y-1"><div class="text-[11px] font-black ${g.color}">${g.name} · ${g.rate}% · 강화비 −${g.cost}% / 판매가 +${g.sale}% (+10이면 1.8배)${gk !== 'common' && gk !== 'rare' ? ` · ${petSpecialText({ g: gk, lv: 0 })}` : ''}</div>
      <div class="flex flex-wrap gap-1.5">${Object.entries(PETS).filter(([, p]) => p.g === gk).map(([id, p]) => `<span class="pet-chip ${g.ring} ${myPets.owned[id] ? '' : 'opacity-30 grayscale'}"><span class="text-xl">${p.icon}</span><span class="text-[9px] font-bold">${p.name}</span></span>`).join('')}</div></div>`;
  }).join('');
}
