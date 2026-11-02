// 밥심 - 🏷️ 닉네임 명판 경매
//
//  - 매주(월~일) 경매 → 가장 높게 부른 사람이 '다음 주' 1주일 동안 메인 화면 맨 위 명판에 이름과 한마디를 걸어둠
//  - 시작가 30만P · 다음 입찰은 현재 최고가의 +10% 이상
//  - 명판 주인 혜택: 1주일 메인 맨 위 노출 · 🥚 펫 알 10% 할인 · 시즌 도감 '명판 명예의 전당' 영구 등재
//  - 입찰하는 순간 포인트를 맡김(차감). 더 높은 입찰이 들어오면 앞사람 돈은 자동 환급(bank/refunds)
//  - 경매가 끝나면 낙찰금은 전액 소각 (인플레 억제)
//  데이터: bank/nameplate/{주 시작일}/top { nick, uid, amount, msg, badge, color, at } · bank/nameplate/{주}/log

const PLATE_START = 300000;
const PLATE_STEP = 0.1;
let plateState = {};
let plateWatching = false;
function plateNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function plateWeek() { return weekKey(plateNow()); }
function platePrevWeek() { return prevWeekKey(plateNow()); }
function plateWeekEnd() { return Date.parse(`${plateWeek()}T00:00:00+09:00`) + 7 * 86400000; }
function plateHolder() { return (plateState[platePrevWeek()] || {}).top || null; }
function isPlateHolder() { const h = plateHolder(); return !!(h && typeof authUser !== 'undefined' && authUser && h.uid === authUser.uid); }
function plateLeftText() { const left = Math.max(0, plateWeekEnd() - plateNow()); const d = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), m = Math.floor(left % 3600000 / 60000); return `${d ? `${d}일 ` : ''}${h}시간 ${m}분`; }
const PLATE_PERKS = [['📣', '1주일 동안 밥심 맨 위에 내 이름과 한마디'], ['🥚', '펫 알 10% 할인'], ['🏅', '시즌 도감 「명판 명예의 전당」 영구 등재']];
function plateMinBid() {
  const top = (plateState[plateWeek()] || {}).top;
  return top ? Math.ceil(top.amount * (1 + PLATE_STEP) / 10000) * 10000 : PLATE_START;
}

function watchPlate() {
  if (plateWatching || typeof db === 'undefined') return;
  plateWatching = true;
  db.ref('bank/nameplate').orderByKey().limitToLast(6).on('value', s => {
    plateState = s.val() || {};
    renderPlateBanner();
    renderPlateModal();
  }, () => { plateWatching = false; });
}
setTimeout(watchPlate, 2000);
setInterval(() => { renderPlateBanner(); renderPlateModal(); }, 60000);

async function bidNameplate() {
  if (!checkApprovalGuard()) return;
  const amtEl = document.getElementById('plateBidAmount'), msgEl = document.getElementById('plateBidMsg');
  const min = plateMinBid();
  const amount = Math.floor(Number(String(amtEl && amtEl.value || '').replace(/[,\s]/g, '')) || 0);
  const msg = (msgEl && msgEl.value || '').trim().slice(0, 30);
  if (amount < min) return alert(`최소 ${min.toLocaleString()}P 이상 불러야 해요.`);
  if (amount > userPoints) return alert(`❌ 포인트가 부족해요! (보유 ${userPoints.toLocaleString()}P)`);
  const wk = plateWeek();
  if (!confirm(`🏷️ ${amount.toLocaleString()}P에 입찰할까요?\n\n· 지금 바로 포인트가 맡겨져요 (더 높은 입찰이 오면 자동 환급)\n· 이번 주 일요일 자정에 1등이면 다음 주 1주일 동안 메인 명판에 이름이 걸려요\n· 낙찰되면 금액은 전부 소각돼요`)) return;
  let prev = null, ok = false;
  try {
    const r = await db.ref(`bank/nameplate/${wk}/top`).transaction(cur => {
      const need = cur ? Math.ceil(cur.amount * (1 + PLATE_STEP) / 10000) * 10000 : PLATE_START;
      if (amount < need) return undefined;
      prev = cur || null;
      return { nick: currentUser.nickname, uid: authUser.uid, amount, msg, badge: myNickBg || 'nb-none', color: myNickColor || '', at: plateNow() };
    });
    ok = r.committed;
  } catch (e) {}
  if (!ok) return alert('그 사이 더 높은 입찰이 들어왔어요. 금액을 다시 확인해 주세요. (결제되지 않았어요)');
  addPoints(-amount, `🏷️ 명판 경매 입찰 (${wk} 주)`);
  updatePointsUI();
  if (prev && prev.nick && prev.amount > 0) {
    db.ref(`bank/refunds/${prev.nick}`).push({ amt: prev.amount, reason: '명판 경매 상위 입찰로 환급' }).catch(() => {});
  }
  db.ref(`bank/nameplate/${wk}/log`).push({ nick: currentUser.nickname, amount, at: plateNow() }).catch(() => {});
  if (typeof postFeed === 'function') postFeed('plate', `🏷️ [${currentUser.nickname}] 님이 다음 주 명판 경매에 ${amount.toLocaleString()}P를 불렀어요!`, amount >= 10000000 ? 'legendary' : 'big', true);
  if (amtEl) amtEl.value = '';
}

// ------------------------------------------------------------------
// 화면
// ------------------------------------------------------------------
function renderPlateBanner() {
  const el = document.getElementById('nameplateBanner');
  if (!el) return;
  const holder = plateHolder();
  const cur = (plateState[plateWeek()] || {}).top;
  el.innerHTML = `
    <div class="plate-plaque">
      <div class="plate-label">🏷️ THIS WEEK'S NAMEPLATE</div>
      ${holder
        ? `<div class="plate-name">${nickHTML({ nickname: holder.nick, badge: holder.badge, color: holder.color }, 'text-base')}</div>${holder.msg ? `<div class="plate-msg">“${esc(holder.msg)}”</div>` : ''}`
        : `<div class="plate-empty">당신의 이름이 걸릴 자리</div><div class="plate-msg">다음 주, 밥심 맨 위에 이름을 새겨보세요</div>`}
    </div>
    <div class="plate-perks">${PLATE_PERKS.map(([i, t]) => `<span>${i} ${t}</span>`).join('')}</div>
    <div class="plate-auction">
      <div class="plate-a-title">다음 주 명판 경매</div>
      <div class="plate-a-bid">${cur ? `${cur.amount.toLocaleString()}P` : `${(PLATE_START / 10000)}만P부터`}</div>
      <div class="plate-a-sub">${cur ? `현재 1위 ${esc(cur.nick)}` : '아직 아무도 안 불렀어요 · 지금이 기회!'} · ⏳ ${plateLeftText()}</div>
      <span class="plate-cta">입찰하기 →</span>
    </div>`;
}
function openPlateModal() { document.getElementById('plateModal').classList.remove('hidden'); renderPlateModal(); }
function closePlateModal() { document.getElementById('plateModal').classList.add('hidden'); }
function renderPlateModal() {
  const m = document.getElementById('plateModal');
  if (!m || m.classList.contains('hidden')) return;
  const wk = plateWeek(), cur = (plateState[wk] || {}).top, min = plateMinBid();
  const left = Math.max(0, plateWeekEnd() - plateNow());
  const d = Math.floor(left / 86400000), h = Math.floor(left % 86400000 / 3600000), mi = Math.floor(left % 3600000 / 60000);
  const box = document.getElementById('plateAuctionBox');
  if (box) box.innerHTML = `
    <div class="rounded-2xl bg-slate-900 text-white p-3 space-y-1.5">
      <div class="text-xs font-black text-amber-300">🏷️ 명판이 뭐예요?</div>
      <p class="text-[11px] text-slate-300 leading-relaxed">매주 단 한 명만 가질 수 있는 밥심의 <b class="text-white">간판 자리</b>예요. 이번 주 경매에서 가장 높게 부른 사람이 <b class="text-white">다음 주 월요일부터 1주일 동안</b> 명판의 주인이 돼요.</p>
      <ul class="text-[11px] text-amber-100 space-y-0.5">${PLATE_PERKS.map(([i, t]) => `<li>${i} ${t}</li>`).join('')}</ul>
      <p class="text-[10px] text-slate-400">입찰금은 바로 맡겨지고, 누가 더 높게 부르면 자동으로 돌려받아요. 1등 낙찰금만 소각돼요.</p>
    </div>
    <div class="rounded-2xl plate-card p-4 text-center space-y-1">
      <div class="text-[10px] font-black tracking-[0.3em] text-amber-700">NEXT WEEK'S NAMEPLATE</div>
      ${cur ? `<div class="text-xs text-slate-500">현재 최고 입찰</div><div class="text-2xl font-black text-slate-900">${cur.amount.toLocaleString()}P</div><div>${nickHTML({ nickname: cur.nick, badge: cur.badge, color: cur.color }, 'text-xs')}</div>${cur.msg ? `<div class="text-[11px] text-slate-500 italic">“${esc(cur.msg)}”</div>` : ''}`
        : `<div class="text-sm font-black text-slate-700">아직 입찰이 없어요</div><div class="text-[11px] text-slate-500">시작가 ${PLATE_START.toLocaleString()}P</div>`}
      <div class="text-[11px] font-bold text-rose-500">⏳ 마감까지 ${d ? `${d}일 ` : ''}${h}시간 ${mi}분 (일요일 자정)</div>
    </div>
    <div class="space-y-1.5">
      <input id="plateBidAmount" type="number" min="${min}" step="10000" placeholder="입찰 금액 (최소 ${min.toLocaleString()}P)" class="w-full border rounded-xl p-2.5 text-sm font-black">
      <input id="plateBidMsg" type="text" maxlength="30" placeholder="명판에 새길 한마디 (선택 · 30자)" class="w-full border rounded-xl p-2.5 text-xs">
      <button onclick="bidNameplate()" class="w-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black py-2.5 rounded-xl text-xs">🏷️ 입찰하기 · 최소 ${min.toLocaleString()}P</button>
      <p class="text-[10px] text-slate-400 text-center">입찰 즉시 포인트가 맡겨지고, 더 높은 입찰이 오면 자동 환급 · 낙찰금은 전액 소각</p>
    </div>`;
  const hist = document.getElementById('plateHistory');
  if (hist) hist.innerHTML = Object.entries(plateState).filter(([w, v]) => w < wk && v && v.top).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5)
    .map(([w, v]) => `<div class="flex items-center justify-between text-[11px] py-1 border-b border-slate-100"><span class="text-slate-400">${w} 주 경매</span><span>${nickHTML({ nickname: v.top.nick, badge: v.top.badge, color: v.top.color }, 'text-[11px]')} <b class="text-amber-600">${v.top.amount.toLocaleString()}P</b></span></div>`).join('')
    || '<div class="text-[11px] text-slate-400 text-center py-2">아직 낙찰 기록이 없어요</div>';
}
