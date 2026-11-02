// 밥심 - 🗿 밥심 동상
//
//  - 밥심에 단 하나뿐인 동상. 주인의 닉네임 옆에서 작고 귀여운 금동상이 이름을 응원해 줌
//  - 넓은 화면: 왼쪽 위(헤더 왼쪽 빈 곳) · 작은 화면: 본문 맨 위 작은 띠
//  - 첫 동상 100만P. 갈아끼우려면 '직전 가격 + 10만P'를 정확히 내야 함 (더도 덜도 없음)
//  - 낸 돈은 전부 사라짐 (누구에게도 가지 않음) · 앞 주인은 아무것도 돌려받지 않음
//  - 구매는 프레스티지 상점 맨 위에서
//  - 재질: 100~120만 청동 · 130~150만 은 · 160~190만 황금👑 · 200만~ 다이아몬드👑 (갈아끼울수록 화려해짐)
//  - 동상 주인은 어디서든 닉네임 옆에 작은 동상 표시 · 누구나 하루 한 번 박수👏 · 철거당하면 다음 접속 때 알림 + 되찾기
//  데이터: bank/statue = { nick, uid, shape, msg, price, at, badge, color, claps, prev, prevHeld } · bank/statue_best · bank/statue_log/{id}

const STATUE_FIRST = 1000000;
const STATUE_STEP = 100000;
const STATUE_SHAPES = {
  bear:    { icon: '🐻', name: '곰돌이', cheer: '최고야!' },
  cat:     { icon: '🐱', name: '냥이', cheer: '멋져냥!' },
  dog:     { icon: '🐶', name: '멍멍이', cheer: '짱이멍!' },
  rabbit:  { icon: '🐰', name: '토끼', cheer: '사랑해!' },
  penguin: { icon: '🐧', name: '펭귄', cheer: '파이팅!' },
  rice:    { icon: '🍙', name: '주먹밥', cheer: '밥심 왕!' },
  frog:    { icon: '🐸', name: '개구리', cheer: '개굴 최고!' },
  chick:   { icon: '🐥', name: '병아리', cheer: '삐약 짱!' }
};
// 💎 재질: 갈아끼울수록(가격이 오를수록) 더 화려한 동상이 됨
const STATUE_TIERS = [
  { min: 2000000, key: 'diamond', name: '다이아몬드', icon: '💎', crown: true },
  { min: 1600000, key: 'gold', name: '황금', icon: '🥇', crown: true },
  { min: 1300000, key: 'silver', name: '은', icon: '🥈', crown: false },
  { min: 0, key: 'bronze', name: '청동', icon: '🥉', crown: false }
];
let statueState = null, statueBest = null, statueWatching = false, statuePick = 'bear';
let statueLastSeen = null; // 직전에 본 동상 (철거 알림용)

function statueNextPrice() { return statueState && statueState.price ? statueState.price + STATUE_STEP : STATUE_FIRST; }
function statueShape(k) { return STATUE_SHAPES[k] || STATUE_SHAPES.bear; }
function statueTier(price) { return STATUE_TIERS.find(t => (price || 0) >= t.min) || STATUE_TIERS[STATUE_TIERS.length - 1]; }
function statueNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function statueDur(ms) {
  ms = Math.max(0, ms || 0);
  const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000);
  return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${m}분` : `${m}분`;
}
function isStatueOwner(nick) { return !!(statueState && statueState.nick && statueState.nick === nick); }

function watchStatue() {
  if (statueWatching || typeof db === 'undefined') return;
  statueWatching = true;
  db.ref('bank/statue').on('value', s => {
    statueState = s.val() || null;
    renderStatue();
    renderStatueShop();
    checkStatueToppled();
  }, () => { statueWatching = false; });
  db.ref('bank/statue_best').on('value', s => { statueBest = s.val() || null; renderStatueShop(); }, () => {});
}
setTimeout(watchStatue, 1500);
setInterval(() => { renderStatue(); }, 60000); // '○시간째' 갱신

// 작은 동상 하나 (재질 · 왕관 · 받침대 · 말풍선)
function statueFigureHTML(shapeKey, msg, size = 'sm', bubble = false, price = 0) {
  const sh = statueShape(shapeKey), t = statueTier(price);
  return `<span class="statue-fig statue-${size} statue-t-${t.key}">
    ${bubble ? `<span class="statue-bubble">${esc(msg || sh.cheer)}</span>` : ''}
    ${t.crown ? '<span class="statue-crown">👑</span>' : ''}
    ${t.key === 'diamond' ? '<span class="statue-spark s1">✦</span><span class="statue-spark s2">✧</span>' : ''}
    <span class="statue-body">${sh.icon}</span>
    <span class="statue-base"></span>
  </span>`;
}

function renderStatue() {
  const st = statueState;
  const html = st && st.nick
    ? `<span class="shrink-0 statue-clap-zone" onclick="event.stopPropagation(); clapStatue(this)" title="눌러서 박수 보내기 👏">${statueFigureHTML(st.shape, st.msg, 'sm', false, st.price)}</span>
       <span class="min-w-0 flex flex-col items-start gap-0.5" title="${esc(statueTier(st.price).name)} 동상 · ${statueDur(statueNow() - (st.at || 0))}째 · ${(st.price || 0).toLocaleString()}P">
         <span class="statue-name max-w-full truncate">${nickHTML({ nickname: st.nick, badge: st.badge, color: st.color, noStatueTag: true }, 'text-xs')}</span>
         <span class="flex items-center gap-1.5"><span class="statue-say">${esc(st.msg || statueShape(st.shape).cheer)}</span><span class="text-[9px] font-black text-amber-600/80 whitespace-nowrap">👏${(st.claps || 0).toLocaleString()}</span></span>
       </span>`
    : `<span class="shrink-0 statue-fig statue-sm statue-empty"><span class="statue-body">❔</span><span class="statue-base"></span></span>
       <span class="min-w-0 leading-tight">
         <span class="block text-[9px] font-black tracking-[0.2em] text-amber-600/80">🗿 밥심 동상</span>
         <span class="block text-[11px] font-black text-slate-500 truncate">비어 있음 · ${(STATUE_FIRST / 10000)}만P</span>
       </span>`;
  ['statueCorner', 'statueMini'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}

// 👏 박수: 동상 하나당 하루 한 번 (누구나)
async function clapStatue(el) {
  const st = statueState;
  if (!st || !st.nick) return openPrestigeModal();
  statueBurst(el, '👏');
  if (typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  const key = `bapsim_statue_clap_${st.at}_${todayKey()}`;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {}
  try {
    await db.ref('bank/statue').transaction(cur => (cur && cur.at === st.at ? Object.assign({}, cur, { claps: (Number(cur.claps) || 0) + 1 }) : undefined));
  } catch (e) {}
}
function statueBurst(el, ch) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const f = document.createElement('span');
    f.className = 'statue-float';
    f.textContent = i % 2 ? '💛' : ch;
    f.style.left = `${r.left + r.width / 2 + (Math.random() * 40 - 20)}px`;
    f.style.top = `${r.top + 6}px`;
    f.style.animationDelay = `${i * 70}ms`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }
  el.classList.remove('statue-jump'); void el.offsetWidth; el.classList.add('statue-jump');
}

// 😢 내 동상이 철거됐을 때 (접속해 있지 않았어도 다음 접속 때 한 번)
function checkStatueToppled() {
  const st = statueState;
  if (!st || typeof currentUser === 'undefined' || !currentUser || !st.prev || st.prev !== currentUser.nickname || st.nick === currentUser.nickname) return;
  const key = `bapsim_statue_toppled_${st.at}`;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {}
  document.getElementById('statueToppledPopup')?.remove();
  const el = document.createElement('div');
  el.id = 'statueToppledPopup';
  el.className = 'fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4';
  el.innerHTML = `<div class="bg-white rounded-3xl shadow-2xl p-5 w-full max-w-xs text-center space-y-3">
      <div class="flex justify-center">${statueFigureHTML(st.shape, st.msg, 'md', true, st.price)}</div>
      <div class="text-sm font-black text-slate-900">😢 내 동상이 철거됐어요</div>
      <div class="text-xs text-slate-600"><b>${esc(st.nick)}</b>님이 ${(st.price || 0).toLocaleString()}P를 내고<br>내 동상을 갈아끼웠어요.${st.prevHeld ? `<br><span class="text-slate-400">(내 동상은 ${statueDur(st.prevHeld)} 동안 서 있었어요)</span>` : ''}</div>
      <button onclick="document.getElementById('statueToppledPopup').remove(); openPrestigeModal()" class="w-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black py-2.5 rounded-xl text-xs">🗿 되찾기 · ${statueNextPrice().toLocaleString()}P</button>
      <button onclick="document.getElementById('statueToppledPopup').remove()" class="w-full text-slate-400 text-xs font-bold py-1">다음에</button>
    </div>`;
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
}

function pickStatueShape(k) { statuePick = k; renderStatueShop(); }

function renderStatueShop() {
  const box = document.getElementById('statueShopBox');
  if (!box) return;
  const st = statueState;
  const price = statueNextPrice();
  const nextTier = statueTier(price);
  const msgInput = document.getElementById('statueMsgInput');
  const keepMsg = msgInput ? msgInput.value : '';
  const curHeld = st && st.nick ? statueNow() - (st.at || 0) : 0;
  const best = statueBest && (!st || curHeld <= statueBest.ms) ? statueBest : (st && st.nick ? { nick: st.nick, ms: curHeld, live: true } : statueBest);
  const upTier = STATUE_TIERS.slice().reverse().find(t => t.min > price);
  box.innerHTML = `
    <div class="statue-shop rounded-2xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[10px] font-black tracking-[0.25em] text-amber-300">BAPSIM STATUE</div>
          <div class="text-sm font-black text-white">🗿 밥심 동상 <span class="text-[10px] text-slate-400 font-bold">· 밥심에 단 하나</span></div>
        </div>
        <div class="text-right">
          <div class="text-[10px] text-slate-400">${st && st.nick ? '갈아끼우기' : '첫 동상'}</div>
          <div class="text-base font-black text-amber-300">${price.toLocaleString()}P</div>
        </div>
      </div>
      <div class="rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 flex items-center gap-3">
        ${st && st.nick ? `<span class="pt-3">${statueFigureHTML(st.shape, st.msg, 'md', true, st.price)}</span>
          <div class="min-w-0 space-y-0.5"><div class="text-[10px] text-slate-400">지금 동상의 주인 · ${statueTier(st.price).icon} ${statueTier(st.price).name} 동상</div><div class="truncate">${nickHTML({ nickname: st.nick, badge: st.badge, color: st.color }, 'text-sm')}</div>
          <div class="text-[10px] text-slate-400">🕒 ${statueDur(curHeld)}째 · 👏 ${(st.claps || 0).toLocaleString()} · ${(st.price || 0).toLocaleString()}P</div></div>`
        : `<span class="statue-fig statue-md statue-empty"><span class="statue-body">❔</span><span class="statue-base"></span></span><div class="text-[11px] text-slate-300">아직 아무도 동상을 세우지 않았어요.<br><b class="text-amber-200">첫 번째 주인</b>이 되어보세요!</div>`}
      </div>
      <div class="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
        ${STATUE_TIERS.slice().reverse().map(t => `<div class="rounded-lg py-1 ${t.key === nextTier.key ? 'bg-amber-300/20 text-amber-200 ring-1 ring-amber-300/60' : 'bg-white/5 text-slate-400'}">${t.icon} ${t.name}<br><span class="opacity-70">${(t.min ? t.min : STATUE_FIRST) / 10000}만~${t.crown ? ' 👑' : ''}</span></div>`).join('')}
      </div>
      <div>
        <div class="text-[10px] font-black text-slate-300 mb-1.5">내 동상 모양 고르기 <span class="text-amber-200">· 이번엔 ${nextTier.icon} ${nextTier.name} 동상${nextTier.crown ? ' + 👑' : ''}</span>${upTier ? ` <span class="text-slate-500">(${upTier.min / 10000}만P부터 ${upTier.name})</span>` : ''}</div>
        <div class="grid grid-cols-4 gap-1.5">
          ${Object.entries(STATUE_SHAPES).map(([k, s]) => `<button onclick="pickStatueShape('${k}')" class="statue-pick ${statuePick === k ? 'on' : ''}"><span class="statue-pick-icon">${s.icon}</span><span class="text-[10px] font-bold">${s.name}</span></button>`).join('')}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="shrink-0 bg-white/5 rounded-xl px-2 pt-4 pb-1">${statueFigureHTML(statuePick, keepMsg.trim() || statueShape(statuePick).cheer, 'md', true, price)}</div>
        <input id="statueMsgInput" maxlength="8" value="${esc(keepMsg)}" oninput="renderStatuePreview()" placeholder="응원 한마디 (8자 · 비우면 '${statueShape(statuePick).cheer}')" class="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-xl px-2.5 py-2 text-xs text-white">
      </div>
      <button onclick="buyStatue()" class="w-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black py-2.5 rounded-xl text-xs shadow-lg hover:brightness-105 active:scale-95">🗿 ${price.toLocaleString()}P로 ${st && st.nick ? '동상 갈아끼우기' : '동상 세우기'}</button>
      ${best && best.nick ? `<div class="text-[10px] text-amber-100/90 text-center">🏆 최장 기록 <b>${esc(best.nick)}</b> · ${statueDur(best.ms)}${best.live ? ' (지금도 서 있는 중)' : ''}</div>` : ''}
      <ul class="text-[10px] text-slate-400 leading-relaxed list-disc pl-4">
        <li>왼쪽 위에서 동상이 내 닉네임을 응원해요 · 동상 주인은 어디서든 닉네임 옆에 작은 동상이 붙어요</li>
        <li>갈아끼울수록 동상이 화려해져요: 청동 → 은 → 황금👑 → 다이아몬드👑</li>
        <li>누구나 동상을 눌러 하루 한 번 박수👏를 보낼 수 있어요</li>
        <li>갈아끼우려면 직전 가격 + 10만P를 정확히 내야 해요 · 낸 포인트는 돌려받지 않아요</li>
      </ul>
    </div>`;
}
function renderStatuePreview() {
  const input = document.getElementById('statueMsgInput');
  const prev = input && input.parentElement.querySelector('.statue-bubble');
  if (prev) prev.textContent = (input.value || '').trim() || statueShape(statuePick).cheer;
}

async function buyStatue() {
  if (!checkApprovalGuard()) return;
  const price = statueNextPrice();
  const expectPrev = statueState && statueState.price ? statueState.price : 0;
  if (userPoints < price) return alert(`❌ 포인트가 부족해요! (${price.toLocaleString()}P)`);
  const sh = statueShape(statuePick), tier = statueTier(price);
  const msg = String((document.getElementById('statueMsgInput') || {}).value || '').trim().slice(0, 8) || sh.cheer;
  if (!confirm(`🗿 ${price.toLocaleString()}P로 밥심 동상을 ${expectPrev ? '갈아끼울까요?' : '세울까요?'}\n\n· ${tier.icon} ${tier.name} ${sh.icon} ${sh.name} 동상 · 응원: "${msg}"\n· 다음 사람이 ${(price + STATUE_STEP).toLocaleString()}P를 내면 바뀌어요\n· 낸 포인트는 돌려받지 않아요`)) return;
  const now = statueNow();
  let before = null;
  const rec = { nick: currentUser.nickname, uid: authUser.uid, shape: statuePick, msg, price, at: now, badge: myNickBg || 'nb-none', color: myNickColor || '', claps: 0 };
  let ok = false;
  try {
    const r = await db.ref('bank/statue').transaction(cur => {
      const curPrice = cur && cur.price ? cur.price : 0;
      if (curPrice !== expectPrev) return; // 그 사이 다른 사람이 먼저 바꿈 → 취소
      before = cur || null;
      return Object.assign({}, rec, before && before.nick ? { prev: before.nick, prevHeld: Math.max(0, now - (before.at || now)) } : {});
    });
    ok = r.committed;
  } catch (e) { ok = false; }
  if (!ok) return alert('방금 다른 사람이 먼저 동상을 바꿨어요. 결제되지 않았어요. 새 가격을 확인해 주세요.');
  updatePointsUI();
  addPoints(-price, `🗿 밥심 동상 ${expectPrev ? '갈아끼우기' : '건립'}`);
  updatePointsUI();
  // 🏆 최장 기록 갱신 (철거된 앞 동상 기준)
  if (before && before.nick) {
    const held = Math.max(0, now - (before.at || now));
    db.ref('bank/statue_best').transaction(b => (!b || held > (Number(b.ms) || 0) ? { nick: before.nick, ms: held, shape: before.shape || 'bear', price: before.price || 0 } : undefined)).catch(() => {});
  }
  db.ref('bank/statue_log').push(Object.assign({}, rec, { prev: before && before.nick || null, at: firebase.database.ServerValue.TIMESTAMP })).catch(() => {});
  if (typeof postFeed === 'function') postFeed('statue', before && before.nick ? `🗿 ${currentUser.nickname}님이 ${before.nick}님의 동상을 철거하고 ${tier.name} ${sh.icon} 동상을 세웠습니다! (${price.toLocaleString()}P)` : `🗿 ${currentUser.nickname}님의 ${sh.icon} 동상이 밥심에 세워졌습니다! (${price.toLocaleString()}P)`, 'legendary', true);
  if (window.confetti) confetti({ particleCount: 180, spread: 120, colors: ['#fbbf24', '#fde68a', '#ffffff'] });
}
setInterval(checkStatueToppled, 15000);
