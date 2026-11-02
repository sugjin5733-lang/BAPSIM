// 밥심 - 🗿 밥심 동상
//
//  - 밥심에 단 하나뿐인 동상. 주인의 닉네임 옆에서 작고 귀여운 금동상이 이름을 응원해 줌
//  - 넓은 화면: 왼쪽 위(헤더 왼쪽 빈 곳) · 작은 화면: 본문 맨 위 작은 띠
//  - 첫 동상 100만P. 갈아끼우려면 '직전 가격 + 10만P'를 정확히 내야 함 (더도 덜도 없음)
//  - 낸 돈은 전부 사라짐 (누구에게도 가지 않음) · 앞 주인은 아무것도 돌려받지 않음
//  - 구매는 프레스티지 상점 맨 위에서
//  데이터: bank/statue = { nick, uid, shape, msg, price, at, badge, color } · bank/statue_log/{id}

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
let statueState = null, statueWatching = false, statuePick = 'bear';

function statueNextPrice() { return statueState && statueState.price ? statueState.price + STATUE_STEP : STATUE_FIRST; }
function statueShape(k) { return STATUE_SHAPES[k] || STATUE_SHAPES.bear; }

function watchStatue() {
  if (statueWatching || typeof db === 'undefined') return;
  statueWatching = true;
  db.ref('bank/statue').on('value', s => {
    statueState = s.val() || null;
    renderStatue();
    renderStatueShop();
  }, () => { statueWatching = false; });
}
setTimeout(watchStatue, 1500);

// 작은 금동상 하나 (받침대 + 동물 + 응원 말풍선)
function statueFigureHTML(shapeKey, msg, size = 'sm') {
  const sh = statueShape(shapeKey);
  return `<span class="statue-fig statue-${size}">
    <span class="statue-bubble">${esc(msg || sh.cheer)}</span>
    <span class="statue-body">${sh.icon}</span>
    <span class="statue-base"></span>
  </span>`;
}

function renderStatue() {
  const st = statueState;
  const html = st && st.nick
    ? `<span class="shrink-0">${statueFigureHTML(st.shape, st.msg)}</span>
       <span class="min-w-0 leading-tight">
         <span class="block text-[9px] font-black tracking-[0.2em] text-amber-600/80">🗿 밥심 동상</span>
         <span class="statue-name block truncate">${nickHTML({ nickname: st.nick, badge: st.badge, color: st.color }, 'text-xs')}</span>
       </span>`
    : `<span class="shrink-0 statue-fig statue-sm statue-empty"><span class="statue-body">❔</span><span class="statue-base"></span></span>
       <span class="min-w-0 leading-tight">
         <span class="block text-[9px] font-black tracking-[0.2em] text-amber-600/80">🗿 밥심 동상</span>
         <span class="block text-[11px] font-black text-slate-500 truncate">비어 있음 · ${(STATUE_FIRST / 10000)}만P</span>
       </span>`;
  ['statueCorner', 'statueMini'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = html; });
}

function pickStatueShape(k) { statuePick = k; renderStatueShop(); }

function renderStatueShop() {
  const box = document.getElementById('statueShopBox');
  if (!box) return;
  const st = statueState;
  const price = statueNextPrice();
  const msgInput = document.getElementById('statueMsgInput');
  const keepMsg = msgInput ? msgInput.value : '';
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
        ${st && st.nick ? `${statueFigureHTML(st.shape, st.msg, 'md')}
          <div class="min-w-0"><div class="text-[10px] text-slate-400">지금 동상의 주인</div><div class="truncate">${nickHTML({ nickname: st.nick, badge: st.badge, color: st.color }, 'text-sm')}</div>
          <div class="text-[10px] text-slate-500">${(st.price || 0).toLocaleString()}P에 세워짐</div></div>`
        : `<span class="statue-fig statue-md statue-empty"><span class="statue-body">❔</span><span class="statue-base"></span></span><div class="text-[11px] text-slate-300">아직 아무도 동상을 세우지 않았어요.<br><b class="text-amber-200">첫 번째 주인</b>이 되어보세요!</div>`}
      </div>
      <div>
        <div class="text-[10px] font-black text-slate-300 mb-1.5">내 동상 모양 고르기</div>
        <div class="grid grid-cols-4 gap-1.5">
          ${Object.entries(STATUE_SHAPES).map(([k, s]) => `<button onclick="pickStatueShape('${k}')" class="statue-pick ${statuePick === k ? 'on' : ''}"><span class="statue-pick-icon">${s.icon}</span><span class="text-[10px] font-bold">${s.name}</span></button>`).join('')}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="shrink-0 bg-white/5 rounded-xl px-2 py-1">${statueFigureHTML(statuePick, keepMsg.trim() || statueShape(statuePick).cheer, 'md')}</div>
        <input id="statueMsgInput" maxlength="8" value="${esc(keepMsg)}" oninput="renderStatuePreview()" placeholder="응원 한마디 (8자 · 비우면 '${statueShape(statuePick).cheer}')" class="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-xl px-2.5 py-2 text-xs text-white">
      </div>
      <button onclick="buyStatue()" class="w-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black py-2.5 rounded-xl text-xs shadow-lg hover:brightness-105 active:scale-95">🗿 ${price.toLocaleString()}P로 ${st && st.nick ? '동상 갈아끼우기' : '동상 세우기'}</button>
      <p class="text-[10px] text-slate-400 leading-relaxed">왼쪽 위에서 귀여운 금동상이 내 닉네임을 응원해요 · 누가 갈아끼우려면 직전 가격 + 10만P를 정확히 내야 해요 · 낸 포인트는 돌려받지 않아요</p>
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
  const sh = statueShape(statuePick);
  const msg = String((document.getElementById('statueMsgInput') || {}).value || '').trim().slice(0, 8) || sh.cheer;
  if (!confirm(`🗿 ${price.toLocaleString()}P로 밥심 동상을 ${expectPrev ? '갈아끼울까요?' : '세울까요?'}\n\n· 모양: ${sh.icon} ${sh.name} · 응원: "${msg}"\n· 다음 사람이 ${(price + STATUE_STEP).toLocaleString()}P를 내면 바뀌어요\n· 낸 포인트는 돌려받지 않아요`)) return;
  const rec = { nick: currentUser.nickname, uid: authUser.uid, shape: statuePick, msg, price, at: Date.now(), badge: myNickBg || 'nb-none', color: myNickColor || '' };
  let ok = false;
  try {
    const r = await db.ref('bank/statue').transaction(cur => {
      const curPrice = cur && cur.price ? cur.price : 0;
      if (curPrice !== expectPrev) return; // 그 사이 다른 사람이 먼저 바꿈 → 취소
      return rec;
    });
    ok = r.committed;
  } catch (e) { ok = false; }
  if (!ok) return alert('방금 다른 사람이 먼저 동상을 바꿨어요. 결제되지 않았어요. 새 가격을 확인해 주세요.');
  updatePointsUI();
  addPoints(-price, `🗿 밥심 동상 ${expectPrev ? '갈아끼우기' : '건립'}`);
  updatePointsUI();
  db.ref('bank/statue_log').push(Object.assign({}, rec, { prev: statueState && statueState.nick || null, at: firebase.database.ServerValue.TIMESTAMP })).catch(() => {});
  if (typeof postFeed === 'function') postFeed('statue', `🗿 ${currentUser.nickname}님의 ${sh.icon} 동상이 밥심에 세워졌습니다! (${price.toLocaleString()}P)`, 'legendary', true);
  if (window.confetti) confetti({ particleCount: 180, spread: 120, colors: ['#fbbf24', '#fde68a', '#ffffff'] });
}
