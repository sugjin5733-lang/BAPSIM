// 밥심 - 🖤 프레스티지 블랙 클럽
//
//  1) 블랙 혜택 관리: 입장 알림 on/off, 매일 축복권, 예치금, 초월 방지권, 관리자 핫라인, 멤버십 연장
//  2) 정책 행사: 큰 돈을 내고 밥심 전체에 영향을 주는 정책을 발동 (모든 회원에게 적용)
//     - 같은 정책은 한 번에 하나만, 끝나도 쿨타임 동안 다시 못 씀
//     - 비용의 10%는 은행 금고, 90%는 소각 (인플레 방지)
//     - policies/{종류} = { by, from, until, ... }  · 발동 기록은 policy_log 에 (관리자 조작 검사용)

const BLACK_POLICIES = {
  market:  { icon: '💹', name: '시세 부양',  price: 3000000, mins: 3,  cooldownMin: 60,  desc: '3분 동안 밥 시세를 x2.00 으로 고정 (모든 회원)', mult: 2.0 },
  fest:    { icon: '🍀', name: '강화 축제',  price: 5000000, mins: 30, cooldownMin: 180, desc: '30분 동안 모든 회원 강화 성공 확률 ×1.1' },
  nofee:   { icon: '🆓', name: '수수료 휴일', price: 2000000, mins: 30, cooldownMin: 180, desc: '30분 동안 모든 회원 밥 판매 수수료 0%' },
  speaker: { icon: '📢', name: '블랙 확성기', price: 500000,  mins: 10, cooldownMin: 10,  desc: '내 메시지를 전광판 맨 위에 10분 동안 고정' }
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
  let text = '';
  if (type === 'speaker') {
    text = (prompt('📢 전광판에 10분 동안 띄울 메시지 (40자):', '') || '').trim().slice(0, 40);
    if (!text) return;
  }
  if (!confirm(`${def.icon} [${def.name}] 발동\n\n${def.desc}\n비용: ${def.price.toLocaleString()}P (10%는 은행 금고, 나머지 소각)\n쿨타임: ${def.cooldownMin}분\n\n진행할까요?`)) return;

  const now = clubNow();
  const rec = { by: currentUser.nickname, uid: authUser.uid, from: now, until: now + def.mins * 60000, type };
  if (type === 'market') rec.mult = def.mult;
  if (type === 'speaker') rec.text = text;
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
  if (typeof postFeed === 'function') postFeed('policy', type === 'speaker' ? `📢 ${text}` : `🖤 [${def.name}] 발동! ${def.desc}`, 'legendary', true);
  if (window.confetti) confetti({ particleCount: 160, spread: 120, colors: ['#0a0a0a', '#fde68a', '#ffffff'] });
}

// 화면 맨 위 '진행 중인 블랙 정책' 띠 (모든 방문자)
function renderPolicyBanner() {
  const bar = document.getElementById('policyBanner');
  if (!bar) return;
  const items = Object.keys(BLACK_POLICIES).filter(policyActive).map(t => {
    const p = activePolicies[t], d = BLACK_POLICIES[t];
    if (t === 'speaker') return `<span class="policy-chip">📢 <b>${esc(p.by)}</b>: ${esc(p.text || '')} <span class="opacity-70">${policyLeftText(t)}</span></span>`;
    return `<span class="policy-chip">${d.icon} <b>${esc(p.by)}</b>님의 ${d.name}${t === 'market' ? ` x${(p.mult || 2).toFixed(2)}` : ''} <span class="opacity-70">${policyLeftText(t)} 남음</span></span>`;
  });
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
    ? `<span class="text-emerald-300 font-black">● 회원</span> · ${tierDaysLeft(myTier.blackUntil).toFixed(1)}일 남음 <button onclick="buyTier('black')" class="ml-2 bg-white/10 border border-white/20 text-white font-bold px-2 py-0.5 rounded-lg text-[10px]">7일 연장</button>`
    : `<span class="text-slate-400">회원 전용 공간이에요.</span> <button onclick="closeBlackClub(); openPrestigeModal()" class="ml-2 bg-amber-300 text-slate-950 font-black px-2 py-0.5 rounded-lg text-[10px]">블랙 가입하러 가기</button>`;

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
          <div class="text-[10px] text-slate-400">${myDeposit.amt > 0 ? `받을 이자 ${dep.amt.toLocaleString()}P (${dep.days}일)` : '24시간마다 1% (하루 최대 3만P) · 이자는 은행 금고에서'}</div>
          <div class="flex gap-1.5"><input id="tierDepositAmount" type="number" min="${DEPOSIT_MIN}" step="10000" placeholder="예치 금액" class="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"><button onclick="depositPoints().then(renderBlackClub)" class="bg-amber-400 text-slate-950 font-black px-3 rounded-lg text-[11px]">예치</button></div>
          ${myDeposit.amt > 0 ? `<div class="flex gap-1.5"><button onclick="claimDepositInterest().then(renderBlackClub)" class="flex-1 bg-white/10 font-bold py-1 rounded-lg text-[11px]">이자 받기</button><button onclick="withdrawDeposit().then(renderBlackClub)" class="flex-1 bg-white/10 text-rose-200 font-bold py-1 rounded-lg text-[11px]">전액 출금</button></div>` : ''}
        </div>
        <button onclick="openHotline()" class="w-full bg-white/10 hover:bg-white/15 border border-white/15 font-black py-2 rounded-xl text-xs">📞 관리자 핫라인 ${Object.values(hotlineItems || {}).filter(h => h && h.reply).length ? '<span class="text-amber-200">· 답변 있음</span>' : ''}</button>`;
    }
  }
  renderBlackClubPolicies();
}

function renderBlackClubPolicies() {
  const box = document.getElementById('blackClubPolicies');
  if (!box) return;
  const black = typeof isBlack === 'function' && isBlack();
  box.innerHTML = Object.entries(BLACK_POLICIES).map(([t, d]) => {
    const on = policyActive(t), cd = policyCooldownLeft(t);
    const state = on ? `<span class="text-emerald-300">진행 중 · ${esc(activePolicies[t].by)} · ${policyLeftText(t)} 남음</span>`
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
