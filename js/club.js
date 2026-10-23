// 밥심 - 🖤 프레스티지 블랙 클럽
//
//  1) 블랙 혜택 관리: 입장 알림 on/off, 매일 축복권, 예치금, 초월 방지권, 관리자 핫라인
//  2) 정책 행사: 큰 돈을 내고 밥심 전체에 영향을 주는 정책을 발동 (모든 회원에게 적용)
//     - 같은 정책은 한 번에 하나만, 끝나도 쿨타임 동안 다시 못 씀
//     - 비용의 10%는 은행 금고, 90%는 소각 (인플레 방지)
//     - policies/{종류} = { by, from, until, ... }  · 발동 기록은 policy_log 에 (관리자 조작 검사용)

const BLACK_POLICIES = {
  market:  { icon: '💹', name: '시세 부양',  price: 3000000, mins: 3,  cooldownMin: 60,  desc: '3분 동안 밥 시세를 x2.00 으로 고정 (모든 회원)', mult: 2.0 },
  fest:    { icon: '🍀', name: '강화 축제',  price: 5000000, mins: 30, cooldownMin: 180, desc: '30분 동안 모든 회원 강화 성공 확률 ×1.1' },
  nofee:   { icon: '🆓', name: '수수료 휴일', price: 2000000, mins: 30, cooldownMin: 180, desc: '30분 동안 모든 회원 밥 판매 수수료 0%' },
  speaker: { icon: '📢', name: '블랙 확성기', price: 500000,  mins: 10, cooldownMin: 10,  desc: '내 메시지를 전광판 맨 위에 10분 동안 고정' },
  hammer:  { icon: '⚖️', name: '심판의 망치', price: 10000000, mins: 0, cooldownMin: 1440, desc: '블랙이 아닌 회원 1명의 포인트(보류 포함)를 0으로 (예치금 제외) · 블랙끼리는 안 통함 · 24시간에 한 번' },
  reset:   { icon: '⏱️', name: '쿨타임 초기화', price: 10000000, mins: 0, cooldownMin: 0, desc: '블랙 클럽의 모든 정책 쿨타임을 지금 바로 초기화 (진행 중인 정책은 그대로)' }
};
const FEST_MULT = 1.1;
let activePolicies = {};   // 종류 → { by, from, until, mult?, text? }
let policiesWatching = false;

function clubNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function policyActive(type) { const p = activePolicies[type]; return !!(p && typeof p.until === 'number' && p.until > clubNow() && (p.from || 0) <= clubNow()); }
function policyLeftText(type) {
  const p = activePolicies[type]; if (!p) return '';
  const s = Math.max(0, Math.ceil((p.until - clubNow()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function policyCooldownLeft(type) {
  const p = activePolicies[type]; const def = BLACK_POLICIES[type];
  if (!p || !def) return 0;
  return Math.max(0, (p.from || 0) + def.cooldownMin * 60000 - clubNow());
}
// 다른 파일에서 쓰는 효과들
function policyMarket() { return policyActive('market') ? { mult: activePolicies.market.mult || 2, by: activePolicies.market.by } : null; }
function policyFestMult() { return policyActive('fest') ? FEST_MULT : 1; }
function policyNoFee() { return policyActive('nofee'); }

function watchPolicies() {
  if (policiesWatching) return;
  policiesWatching = true;
  db.ref('policies').on('value', s => {
    activePolicies = s.val() || {};
    renderPolicyBanner();
    renderBlackClub();
    if (typeof updateEnhanceUI === 'function') { try { updateEnhanceUI(); } catch (e) {} }
  }, () => { policiesWatching = false; });
}
setTimeout(watchPolicies, 2500);
setInterval(() => { renderPolicyBanner(); const m = document.getElementById('blackClubModal'); if (m && !m.classList.contains('hidden')) renderBlackClubPolicies(); }, 1000);

async function activatePolicy(type) {
  if (!checkApprovalGuard()) return;
  const def = BLACK_POLICIES[type];
  if (!def) return;
  if (!(typeof isBlack === 'function' && isBlack())) return alert('🖤 프레스티지 블랙 회원만 정책을 행사할 수 있어요.');
  if (policyActive(type)) return alert(`이미 [${def.name}]이 진행 중이에요. (${policyLeftText(type)} 남음)`);
  const cd = policyCooldownLeft(type);
  if (cd > 0) return alert(`[${def.name}] 쿨타임: ${Math.ceil(cd / 60000)}분 뒤에 다시 쓸 수 있어요.`);
  if (userPoints < def.price) return alert(`❌ 포인트가 부족해요! (${def.price.toLocaleString()}P)`);
  if (type === 'reset' && !Object.keys(BLACK_POLICIES).some(t => t !== 'reset' && !policyActive(t) && policyCooldownLeft(t) > 0)) return alert('지금 쿨타임 중인 정책이 없어요. (결제되지 않았어요)');
  let text = '', target = '';
  if (type === 'hammer') {
    target = (prompt('⚖️ 심판의 망치를 내릴 회원의 닉네임:', '') || '').trim();
    if (!target) return;
    if (target === currentUser.nickname) return alert('자기 자신에게는 내릴 수 없어요.');
    let tu = null;
    try { tu = (await db.ref(`user_points/${target}`).once('value')).val(); } catch (e) {}
    if (!tu || !(tu.status === 'approved' || tu.approved === true)) return alert(`[${target}] 님을 찾을 수 없어요.`);
    if ((Number(tu.blackUntil) || 0) > clubNow()) return alert(`🖤 [${target}] 님은 프레스티지 블랙 회원이에요. 블랙끼리는 심판의 망치가 통하지 않아요.`);
    if (!confirm(`⚖️ 정말 [${target}] 님의 포인트 ${(Number(tu.points) || 0).toLocaleString()}P${Number(tu.owed) ? ` + 보류 ${Number(tu.owed).toLocaleString()}P` : ''}를 0으로 만들까요?\n(되돌릴 수 없어요)`)) return;
  }
  if (type === 'speaker') {
    text = (prompt('📢 전광판에 10분 동안 띄울 메시지 (40자):', '') || '').trim().slice(0, 40);
    if (!text) return;
  }
  if (!confirm(`${def.icon} [${def.name}] 발동\n\n${def.desc}\n비용: ${def.price.toLocaleString()}P (10%는 은행 금고, 나머지 소각)\n쿨타임: ${def.cooldownMin}분\n\n진행할까요?`)) return;

  const now = clubNow();
  const rec = { by: currentUser.nickname, uid: authUser.uid, from: now, until: now + def.mins * 60000, type };
  if (type === 'market') rec.mult = def.mult;
  if (type === 'speaker') rec.text = text;
  if (type === 'hammer') { rec.target = target; rec.until = now; }
  let claimed = false;
  try {
    const r = await db.ref(`policies/${type}`).transaction(cur => {
      const t = clubNow();
      if (cur && ((cur.until || 0) > t || (cur.from || 0) + def.cooldownMin * 60000 > t)) return; // 진행 중/쿨타임 → 취소
      return rec;
    });
    claimed = r.committed;
  } catch (e) { claimed = false; }
  if (!claimed) return alert('다른 블랙 회원이 방금 같은 정책을 먼저 발동했어요. 결제되지 않았어요.');

  updatePointsUI();
  addPoints(-def.price, `🖤 블랙 정책: ${def.name}`);
  if (typeof payFee === 'function') payFee(Math.round(def.price * 0.1));
  updatePointsUI();
  db.ref('policy_log').push(Object.assign({}, rec, { at: firebase.database.ServerValue.TIMESTAMP })).catch(() => {});
  if (type === 'reset') {
    // 진행이 끝난 정책 기록을 지워서 바로 다시 쓸 수 있게 (진행 중인 건 그대로)
    const cleared = [];
    for (const t of Object.keys(BLACK_POLICIES)) {
      if (t === 'reset') continue;
      try {
        const r = await db.ref(`policies/${t}`).transaction(cur => (cur && (cur.until || 0) <= clubNow() ? null : undefined));
        if (r.committed) cleared.push(BLACK_POLICIES[t].name);
      } catch (e) {}
    }
    if (typeof postFeed === 'function') postFeed('policy', '🖤 프레스티지 블랙 클럽이 밥심에 영향력을 행사했습니다', 'legendary', true);
    if (window.confetti) confetti({ particleCount: 140, spread: 110, colors: ['#0a0a0a', '#fde68a', '#ffffff'] });
    return;
  }
  if (type === 'hammer') {
    // 대상자 화면이 접속하는 즉시(또는 다음 접속 때) 스스로 0으로 만듦
    db.ref(`judgments/${target}`).push({ by: currentUser.nickname, uid: authUser.uid, type: 'hammer', at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    if (typeof postFeed === 'function') postFeed('policy', '⚖️ 프레스티지 블랙 클럽의 심판이 내려졌습니다', 'legendary', true);
    if (window.confetti) confetti({ particleCount: 160, spread: 120, colors: ['#0a0a0a', '#fde68a', '#ffffff'] });
    return;
  }
  // 대중에게는 무엇을 했는지 밝히지 않음 (확성기는 메시지 자체가 목적이라 그대로)
  if (typeof postFeed === 'function') postFeed('policy', type === 'speaker' ? `📢 ${text}` : '🖤 프레스티지 블랙 클럽이 밥심에 영향력을 행사했습니다', 'legendary', true);
  if (window.confetti) confetti({ particleCount: 160, spread: 120, colors: ['#0a0a0a', '#fde68a', '#ffffff'] });
}

// 화면 맨 위 '진행 중인 블랙 정책' 띠 (모든 방문자)
function renderPolicyBanner() {
  const bar = document.getElementById('policyBanner');
  if (!bar) return;
  const black = typeof isBlack === 'function' && isBlack();
  const live = Object.keys(BLACK_POLICIES).filter(t => t !== 'hammer' && t !== 'reset' && policyActive(t));
  let items;
  if (black) {
    items = live.map(t => {
      const p = activePolicies[t], d = BLACK_POLICIES[t];
      if (t === 'speaker') return `<span class="policy-chip">📢 <b>${esc(p.by)}</b>: ${esc(p.text || '')} <span class="opacity-70">${policyLeftText(t)}</span></span>`;
      return `<span class="policy-chip">${d.icon} <b>${esc(p.by)}</b>님의 ${d.name}${t === 'market' ? ` x${(p.mult || 2).toFixed(2)}` : ''} <span class="opacity-70">${policyLeftText(t)} 남음</span></span>`;
    });
  } else {
    // 일반 회원: 확성기 메시지만 보이고, 나머지는 무엇인지 밝히지 않음
    items = [];
    if (live.includes('speaker')) items.push(`<span class="policy-chip">📢 ${esc(activePolicies.speaker.text || '')}</span>`);
    const hidden = live.filter(t => t !== 'speaker');
    if (hidden.length) {
      const left = Math.max(...hidden.map(t => activePolicies[t].until)) - clubNow();
      const s = Math.max(0, Math.ceil(left / 1000));
      items.push(`<span class="policy-chip">🖤 블랙 클럽의 영향력이 행사되고 있습니다 <span class="opacity-70">${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span></span>`);
    }
  }
  bar.classList.toggle('hidden', items.length === 0);
  bar.innerHTML = items.join('');
}

// ------------------------------------------------------------------
// 클럽 화면
// ------------------------------------------------------------------
function openBlackClub() {
  document.getElementById('blackClubModal').classList.remove('hidden');
  if (typeof isBlack === 'function' && isBlack() && typeof attachHotline === 'function') attachHotline();
  renderBlackClub();
}
function closeBlackClub() { document.getElementById('blackClubModal').classList.add('hidden'); }

function setVipAlert(on) {
  if (!(typeof isBlack === 'function' && isBlack())) return;
  myTier.vipAlertOff = !on;
  db.ref(`user_points/${currentUser.nickname}/vipAlertOff`).set(!on).catch(() => {});
  renderBlackClub();
}

function renderBlackClub() {
  const m = document.getElementById('blackClubModal');
  if (!m || m.classList.contains('hidden')) return;
  const black = typeof isBlack === 'function' && isBlack();
  const head = document.getElementById('blackClubStatus');
  if (head) head.innerHTML = black
    ? `<span class="text-emerald-300 font-black">● 영구 회원</span>`
    : `<span class="text-slate-400">회원 전용 공간이에요.</span> <button onclick="closeBlackClub(); openPrestigeModal()" class="ml-2 bg-amber-300 text-slate-950 font-black px-2 py-0.5 rounded-lg text-[10px]">블랙 가입하러 가기</button>`;

  ['clubSecPolicies', 'clubSecRanking', 'clubSecPerks'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !black); });
  const teaser = document.getElementById('clubTeaser');
  if (teaser) teaser.classList.toggle('hidden', black);
  if (!black) return; // 비회원에게는 클럽 기능을 보여주지 않음
  const perks = document.getElementById('blackClubPerks');
  if (perks) {
    if (!black) { perks.innerHTML = '<div class="text-[11px] text-slate-400 text-center py-3">🔒 블랙 회원이 되면 여기서 모든 혜택을 관리할 수 있어요.</div>'; }
    else {
      const today = todayKey(tierNow());
      const vipOn = !myTier.vipAlertOff;
      const dep = depositInterestDue();
      perks.innerHTML = `
        <div class="club-row"><span>🔔 접속 시 전체 입장 알림</span>
          <label class="flex items-center gap-1.5 cursor-pointer"><span class="text-[10px] ${vipOn ? 'text-emerald-300' : 'text-slate-500'}">${vipOn ? 'ON' : 'OFF'}</span><input type="checkbox" ${vipOn ? 'checked' : ''} onchange="setVipAlert(this.checked)" class="accent-amber-400 w-4 h-4"></label></div>
        <div class="club-row"><span>✨ 매일 축복권 ${TIERS.black.bless}장</span><span class="text-[10px] ${myTier.blessDay === today ? 'text-emerald-300' : 'text-amber-200'}">${myTier.blessDay === today ? '오늘 받음' : '접속하면 지급'} · 보유 ${myItems.bless || 0}장</span></div>
        <div class="club-row"><span>🌌 초월 방지권</span><span class="text-[10px] text-slate-300">밥키우기 +20강부터 방지권 버튼에서 켜기</span></div>
        <div class="club-row"><span>💹 판매 수수료 5% · 시간당 한도 15만 · 분당 강화 1,000회</span><span class="text-[10px] text-emerald-300">적용 중</span></div>
        <div class="club-row"><span>🎰 슬롯 초특급 확률 ${BLACK_SLOT_MULT}배</span><span class="text-[10px] text-emerald-300">적용 중</span></div>
        <div class="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1.5">
          <div class="flex items-center justify-between text-xs"><span class="font-black">🏦 예치금</span><span class="font-black text-amber-200">${myDeposit.amt.toLocaleString()}P</span></div>
          <div class="text-[10px] text-slate-400">${myDeposit.amt > 0 ? `받을 이자 ${dep.amt.toLocaleString()}P (${dep.days}일)` : '24시간마다 3% (상한 없음) · 이자는 은행 금고에서'}</div>
          <div class="flex gap-1.5"><input id="tierDepositAmount" type="number" min="${DEPOSIT_MIN}" step="10000" placeholder="예치 금액" class="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"><button onclick="depositPoints().then(renderBlackClub)" class="bg-amber-400 text-slate-950 font-black px-3 rounded-lg text-[11px]">예치</button></div>
          ${myDeposit.amt > 0 ? `<div class="flex gap-1.5"><button onclick="claimDepositInterest().then(renderBlackClub)" class="flex-1 bg-white/10 font-bold py-1 rounded-lg text-[11px]">이자 받기</button><button onclick="withdrawDeposit().then(renderBlackClub)" class="flex-1 bg-white/10 text-rose-200 font-bold py-1 rounded-lg text-[11px]">전액 출금</button></div>` : ''}
        </div>
        <button onclick="openHotline()" class="w-full bg-white/10 hover:bg-white/15 border border-white/15 font-black py-2 rounded-xl text-xs">📞 관리자 핫라인 ${Object.values(hotlineItems || {}).filter(h => h && h.reply).length ? '<span class="text-amber-200">· 답변 있음</span>' : ''}</button>`;
    }
  }
  renderBlackClubPolicies();
  renderBlackClubRanking();
}

// 🖤 블랙 랭킹: 블랙 클럽 안, 블랙 회원에게만 (자산 = 포인트 + 보류 + 예치금)
async function renderBlackClubRanking() {
  const box = document.getElementById('blackClubRanking');
  if (!box) return;
  if (!(typeof isBlack === 'function' && isBlack())) { box.innerHTML = '<div class="text-[11px] text-slate-400 text-center py-3">🔒 블랙 회원만 볼 수 있어요.</div>'; return; }
  let users = {};
  try { users = (await db.ref('user_points').once('value')).val() || {}; } catch (e) {}
  const now = clubNow();
  const assets = u => (Number(u.points) || 0) + (Number(u.owed) || 0) + (Number(u.deposit && u.deposit.amt) || 0);
  const list = Object.values(users).filter(u => u && u.nickname && (Number(u.blackUntil) || 0) > now && (u.status === 'approved' || u.approved === true)).sort((a, b) => assets(b) - assets(a));
  box.innerHTML = list.map((u, i) => `<div class="club-row ${u.nickname === currentUser.nickname ? 'ring-1 ring-amber-300/60' : ''}">
      <span class="flex items-center gap-2 min-w-0"><span class="text-[11px] font-black ${i === 0 ? 'text-amber-300' : 'text-slate-400'} shrink-0">${i === 0 ? '🖤 1' : i + 1}</span>${nickHTML(u, 'text-xs truncate')}</span>
      <span class="text-right shrink-0"><span class="text-xs font-black text-amber-200">${assets(u).toLocaleString()}P</span>${Number(u.deposit && u.deposit.amt) ? `<span class="block text-[9px] text-slate-400">예치 ${Number(u.deposit.amt).toLocaleString()}</span>` : ''}</span>
    </div>`).join('') || '<div class="text-[11px] text-slate-400 text-center py-3">아직 블랙 회원이 없어요</div>';
}

function renderBlackClubPolicies() {
  const box = document.getElementById('blackClubPolicies');
  if (!box) return;
  const black = typeof isBlack === 'function' && isBlack();
  if (!black) { box.innerHTML = ''; return; } // 비회원 화면에는 정책 목록 자체를 만들지 않음
  box.innerHTML = Object.entries(BLACK_POLICIES).map(([t, d]) => {
    const on = policyActive(t), cd = policyCooldownLeft(t);
    const last = activePolicies[t];
    const state = t === 'reset' ? '<span class="text-amber-200">언제든 사용 가능</span>' : t === 'hammer' && last && cd > 0 ? `<span class="text-rose-300">최근 판결: ${esc(last.by)} → ${esc(last.target || '?')} · 쿨타임 ${Math.ceil(cd / 60000)}분</span>` : on ? `<span class="text-emerald-300">진행 중 · ${esc(activePolicies[t].by)} · ${policyLeftText(t)} 남음</span>`
      : cd > 0 ? `<span class="text-slate-400">쿨타임 ${Math.ceil(cd / 60000)}분</span>` : '<span class="text-amber-200">발동 가능</span>';
    return `<div class="rounded-xl border border-white/10 bg-white/5 p-2.5 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="text-xs font-black">${d.icon} ${d.name}</div>
        <div class="text-[10px] text-slate-400">${d.desc}</div>
        <div class="text-[10px] font-bold mt-0.5">${state}</div>
      </div>
      <button ${!black || on || cd > 0 ? 'disabled' : ''} onclick="activatePolicy('${t}')" class="shrink-0 bg-amber-300 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 font-black px-2.5 py-1.5 rounded-lg text-[11px]">${(d.price / 10000).toLocaleString()}만P</button>
    </div>`;
  }).join('');
}

// ⚖️ 심판의 망치 집행: 내가 대상이면 접속 중/다음 접속 때 내 포인트·보류를 0으로
let judgmentRef = null;
function watchMyJudgments() {
  if (judgmentRef || !canSyncToCloud()) return;
  judgmentRef = db.ref(`judgments/${currentUser.nickname}`);
  judgmentRef.on('child_added', snap => executeJudgment(snap.ref), () => { judgmentRef = null; });
}
async function executeJudgment(ref) {
  let got = null;
  try {
    const r = await ref.transaction(cur => { got = cur || null; return cur ? null : undefined; });
    if (!r.committed || !got) return;
  } catch (e) { return; }
  if (typeof isBlack === 'function' && isBlack()) { // 그 사이 블랙이 됐으면 무효
    if (typeof bankToast === 'function') bankToast('⚖️ 심판의 망치 무효', `[${esc(got.by)}] 님의 판결이 있었지만, 블랙 회원이라 통하지 않았어요.`);
    return;
  }
  const lostPts = userPoints, lostOwed = myOwed;
  if (lostPts > 0) addPoints(-lostPts, `⚖️ 심판의 망치 (${String(got.by || '?').slice(0, 20)})`);
  myOwed = 0;
  updatePointsUI();
  alert(`⚖️ 프레스티지 블랙 클럽의 심판이 내려졌습니다.\n포인트 ${lostPts.toLocaleString()}P${lostOwed ? ` + 보류 ${lostOwed.toLocaleString()}P` : ''}가 0이 되었습니다.`);

}
setInterval(watchMyJudgments, 5000);
