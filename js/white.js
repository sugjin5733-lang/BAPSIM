// 밥심 - ☁️ 프레스티지 화이트 (천외천)
//
//  - 블랙 위의 단 한 자리. 블랙 회원 + 지금 밥 +25강 이상 + 7,777만P(소각)로 즉위
//  - 자리가 차 있으면 조건을 갖춘 블랙이 도전장(5,000만P, 소각) → 24시간 동안 자산이 더 많이 늘어난 쪽이 화이트
//  - 혜택: 시간당 한도 30만P · 판매 수수료 0% · 분당 강화 1,000회 · 하루 1번 초월 보험 · 전용 배지 · 강림 연출
//  - 권능: 천명(블랙 정책 중단+1시간 금지) · 천벌(블랙에게도 통하는 망치+블랙 박탈) · 추방(블랙 탈퇴)
//          · 축복의 비(1시간 강화 확률 ×1.2) · 칙령(1시간 맨 위 고정 문구)
//  데이터: white/throne {nick, uid, since} · white/challenge · white/cool/{power} · white/history
//          policies/rain · policies/edict (기존 정책 감시에 같이 실림) · policy_ban/{블랙정책} · judgments/{nick}

const WHITE_PRICE = 77770000;
const WHITE_MIN_LVL = 25;
const WHITE_CHALLENGE_PRICE = 50000000;
const WHITE_CHALLENGE_MS = 24 * 3600000;
const WHITE_PER_HOUR = 300000;
const WHITE_RAIN_MULT = 1.2;
const WHITE_POWERS = {
  decree: { icon: '🕊️', name: '천명',     price: 5000000,  mins: 0,  cooldownMin: 60,   desc: '진행 중인 블랙 정책 하나를 즉시 끝내고, 1시간 동안 같은 정책 발동 금지' },
  smite:  { icon: '⚡', name: '천벌',     price: 20000000, mins: 0,  cooldownMin: 1440, desc: '블랙에게도 통하는 망치 · 대상의 포인트·보류를 0으로, 블랙이면 블랙 자격까지 박탈' },
  expel:  { icon: '🚪', name: '추방',     price: 10000000, mins: 0,  cooldownMin: 720,  desc: '블랙 회원 1명을 블랙 클럽에서 탈퇴시킴 (포인트는 그대로)' },
  rain:   { icon: '🌤️', name: '축복의 비', price: 10000000, mins: 60, cooldownMin: 360,  desc: '1시간 동안 모든 회원 강화 성공 확률 ×1.2' },
  edict:  { icon: '👑', name: '칙령',     price: 3000000,  mins: 60, cooldownMin: 60,   desc: '1시간 동안 사이트 맨 위에 내 문구 고정 + 음성 안내' }
};

let whiteState = { throne: null, challenge: null, cool: {} };
let whiteWatching = false, whiteWasMe = false;
function whiteNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function isWhite() { return !!(whiteState.throne && typeof authUser !== 'undefined' && authUser && whiteState.throne.uid === authUser.uid); }
function whiteCanView() { return isWhite() || (typeof isAdmin !== 'undefined' && isAdmin); }
function assetsOf(u) { return (Number(u && u.points) || 0) + (Number(u && u.owed) || 0) + (Number(u && u.deposit && u.deposit.amt) || 0); }

function watchWhite() {
  if (whiteWatching || typeof db === 'undefined') return;
  whiteWatching = true;
  db.ref('white').on('value', s => {
    const v = s.val() || {};
    whiteState = { throne: v.throne || null, challenge: v.challenge || null, cool: v.cool || {} };
    const me = isWhite();
    if (whiteWasMe && !me) onLostWhite();
    if (me && !whiteWasMe) setTimeout(() => announceWhite(false), 1500);
    whiteWasMe = me;
    renderWhiteBanner();
    renderWhiteClub();
    if (typeof refreshTierUI === 'function') refreshTierUI();
    maybeResolveChallenge();
  }, () => { whiteWatching = false; });
}
setTimeout(watchWhite, 2500);
setInterval(() => { maybeResolveChallenge(); renderWhiteClub(); renderEdict(); }, 30000);

// ☁️ 강림 연출 + 전광판 (10분에 한 번)
let whiteAnnouncedAt = 0;
function announceWhite(justCrowned) {
  if (!isWhite() || typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  const now = whiteNow();
  if (!justCrowned && now - whiteAnnouncedAt < 10 * 60 * 1000) return;
  whiteAnnouncedAt = now;
  whiteFlash();
  if (typeof postFeed === 'function') postFeed('white', justCrowned ? '☁️ 천외천이 열렸습니다. 프레스티지 화이트가 즉위했습니다!' : '☁️ 천외천, 프레스티지 화이트께서 강림하셨습니다', 'legendary', true);
}
function whiteFlash() {
  const el = document.createElement('div');
  el.className = 'white-flash';
  el.innerHTML = '<div class="white-flash-text">☁️ 天 外 天<small>PRESTIGE WHITE</small></div>';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function onLostWhite() {
  if (typeof myNickBg !== 'undefined' && myNickBg === 'nb-heaven') { myNickBg = 'nb-none'; if (typeof updatePointsUI === 'function') updatePointsUI(); }
  if (typeof bankToast === 'function') bankToast('☁️ 천외천을 잃었습니다', '프레스티지 화이트의 자리가 다른 사람에게 넘어갔어요.');
}

// ------------------------------------------------------------------
// 즉위 / 도전
// ------------------------------------------------------------------
function whiteEligible() {
  if (!(typeof isBlack === 'function' && isBlack())) return '🖤 프레스티지 블랙 회원만 오를 수 있어요.';
  if (currentEnhanceLevel < WHITE_MIN_LVL) return `🍚 지금 밥이 +${WHITE_MIN_LVL}강 이상이어야 해요. (지금 +${currentEnhanceLevel}강)`;
  return '';
}
async function joinWhite() {
  if (!checkApprovalGuard()) return;
  if (whiteState.throne) return alert('이미 천외천의 주인이 있어요. 도전장을 내야 해요.');
  const why = whiteEligible(); if (why) return alert(why);
  if (userPoints < WHITE_PRICE) return alert(`❌ 포인트가 부족해요! (${WHITE_PRICE.toLocaleString()}P)`);
  if (!confirm(`☁️ ${WHITE_PRICE.toLocaleString()}P를 바치고 천외천, 프레스티지 화이트에 오를까요?\n(가입비는 전부 소각 · 자리는 단 하나 · 도전에 지면 잃을 수 있어요)`)) return;
  let ok = false;
  try {
    const r = await db.ref('white/throne').transaction(cur => cur ? undefined : { nick: currentUser.nickname, uid: authUser.uid, since: firebase.database.ServerValue.TIMESTAMP });
    ok = r.committed;
  } catch (e) {}
  if (!ok) return alert('한 발 늦었어요! 방금 다른 사람이 천외천에 올랐어요. (결제되지 않았어요)');
  addPoints(-WHITE_PRICE, '☁️ 프레스티지 화이트 즉위 (소각)');
  grantHeavenBadge();
  db.ref('white/history').push({ type: 'crown', nick: currentUser.nickname, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
  updatePointsUI();
  announceWhite(true);
  renderWhiteClub();
}
function grantHeavenBadge() {
  if (!myInventory.bgs) myInventory.bgs = ['nb-none'];
  if (!myInventory.bgs.includes('nb-heaven')) myInventory.bgs.push('nb-heaven');
  myNickBg = 'nb-heaven';
}
async function challengeWhite() {
  if (!checkApprovalGuard()) return;
  const t = whiteState.throne;
  if (!t) return joinWhite();
  if (isWhite()) return;
  if (whiteState.challenge) return alert('이미 진행 중인 도전이 있어요.');
  const why = whiteEligible(); if (why) return alert(why);
  if (userPoints < WHITE_CHALLENGE_PRICE) return alert(`❌ 포인트가 부족해요! (도전장 ${WHITE_CHALLENGE_PRICE.toLocaleString()}P)`);
  if (!confirm(`⚔️ 천외천 [${t.nick}] 님에게 도전장을 낼까요?\n\n· 도전장 ${WHITE_CHALLENGE_PRICE.toLocaleString()}P (소각, 이기든 지든 돌려받지 못함)\n· 24시간 동안 자산(포인트+보류+예치금)이 더 많이 늘어난 쪽이 천외천\n· 비기면 지금 주인이 지켜요`)) return;
  let holder = {};
  try { holder = (await db.ref(`user_points/${t.nick}`).once('value')).val() || {}; } catch (e) {}
  // 내 자산은 도전장 값을 낸 뒤 기준
  const baseC = userPoints - WHITE_CHALLENGE_PRICE + myOwed + ((typeof myDeposit !== 'undefined' && myDeposit.amt) || 0);
  const now = whiteNow();
  let ok = false;
  try {
    const r = await db.ref('white/challenge').transaction(cur => cur ? undefined : {
      challenger: currentUser.nickname, cuid: authUser.uid, holder: t.nick, huid: t.uid,
      startAt: now, endAt: now + WHITE_CHALLENGE_MS, baseC, baseH: assetsOf(holder)
    });
    ok = r.committed;
  } catch (e) {}
  if (!ok) return alert('한 발 늦었어요! 다른 도전이 먼저 시작됐어요. (결제되지 않았어요)');
  addPoints(-WHITE_CHALLENGE_PRICE, `⚔️ 천외천 도전장 (→ ${t.nick}, 소각)`);
  updatePointsUI();
  if (typeof postFeed === 'function') postFeed('white', `⚔️ [${currentUser.nickname}] 님이 천외천 [${t.nick}] 님에게 도전장을 던졌습니다! 24시간 승부 시작`, 'legendary', true);
  renderWhiteClub();
}
function challengeGains(users) {
  const c = whiteState.challenge;
  if (!c) return null;
  return { c: assetsOf(users[c.challenger]) - (c.baseC || 0), h: assetsOf(users[c.holder]) - (c.baseH || 0) };
}
let resolving = false;
async function maybeResolveChallenge() {
  const c = whiteState.challenge;
  if (!c || resolving || whiteNow() < c.endAt) return;
  if (typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  resolving = true;
  try {
    const [cu, hu] = await Promise.all([db.ref(`user_points/${c.challenger}`).once('value'), db.ref(`user_points/${c.holder}`).once('value')]);
    const gc = assetsOf(cu.val()) - (c.baseC || 0), gh = assetsOf(hu.val()) - (c.baseH || 0);
    const challengerWins = gc > gh && !!cu.val();
    let done = false;
    await db.ref('white').transaction(cur => {
      if (!cur || !cur.challenge || cur.challenge.startAt !== c.startAt) return undefined;
      cur.challenge = null;
      if (challengerWins) cur.throne = { nick: c.challenger, uid: c.cuid, since: whiteNow() };
      done = true;
      return cur;
    });
    if (done) {
      db.ref('white/history').push({ type: 'duel', challenger: c.challenger, holder: c.holder, gc, gh, winner: challengerWins ? c.challenger : c.holder, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
      if (typeof postFeed === 'function') postFeed('white', challengerWins
        ? `☁️ 천외천의 주인이 바뀌었습니다! [${c.challenger}] 님이 [${c.holder}] 님을 꺾었습니다 (+${gc.toLocaleString()} vs +${gh.toLocaleString()})`
        : `☁️ [${c.holder}] 님이 천외천을 지켜냈습니다! (+${gh.toLocaleString()} vs 도전자 +${gc.toLocaleString()})`, 'legendary', true);
    }
  } catch (e) {} finally { resolving = false; }
}

// ------------------------------------------------------------------
// 권능
// ------------------------------------------------------------------
function whiteCooldownLeft(type) {
  const last = Number(whiteState.cool && whiteState.cool[type]) || 0;
  return Math.max(0, last + WHITE_POWERS[type].cooldownMin * 60000 - whiteNow());
}
async function useWhitePower(type) {
  if (!checkApprovalGuard()) return;
  const d = WHITE_POWERS[type];
  if (!d) return;
  if (!isWhite()) return alert('☁️ 천외천, 프레스티지 화이트만 쓸 수 있어요.');
  const cd = whiteCooldownLeft(type);
  if (cd > 0) return alert(`[${d.name}] 쿨타임: ${Math.ceil(cd / 60000)}분 뒤에 다시 쓸 수 있어요.`);
  if (userPoints < d.price) return alert(`❌ 포인트가 부족해요! (${d.price.toLocaleString()}P)`);
  const now = whiteNow();
  const updates = {};
  let feed = '', targetNick = '', polType = '', text = '';

  if (type === 'decree') {
    const live = Object.keys(typeof BLACK_POLICIES !== 'undefined' ? BLACK_POLICIES : {}).filter(t => t !== 'hammer' && t !== 'reset' && policyActive(t));
    if (!live.length) return alert('지금 진행 중인 블랙 정책이 없어요. (결제되지 않았어요)');
    const pick = live.length === 1 ? live[0] : (prompt(`끝낼 블랙 정책을 고르세요:\n${live.map((t, i) => `${i + 1}. ${BLACK_POLICIES[t].icon} ${BLACK_POLICIES[t].name} (${activePolicies[t].by})`).join('\n')}`, '1') || '');
    polType = live.length === 1 ? pick : live[(parseInt(pick, 10) || 0) - 1];
    if (!polType) return;
    updates[`policies/${polType}/until`] = now;
    updates[`policy_ban/${polType}`] = now + 3600000;
    feed = `🕊️ 천명이 내려졌습니다. 블랙의 [${BLACK_POLICIES[polType].name}]이 멈추고 1시간 동안 금지됩니다`;
  } else if (type === 'smite' || type === 'expel') {
    targetNick = (prompt(`${d.icon} [${d.name}]을 내릴 회원의 닉네임:`, '') || '').trim();
    if (!targetNick) return;
    if (targetNick === currentUser.nickname) return alert('자기 자신에게는 내릴 수 없어요.');
    let tu = null;
    try { tu = (await db.ref(`user_points/${targetNick}`).once('value')).val(); } catch (e) {}
    if (!tu || !(tu.status === 'approved' || tu.approved === true)) return alert(`[${targetNick}] 님을 찾을 수 없어요.`);
    const tBlack = (Number(tu.blackUntil) || 0) > now;
    if (type === 'expel' && !tBlack) return alert(`[${targetNick}] 님은 블랙 회원이 아니에요. (결제되지 않았어요)`);
    if (!confirm(type === 'smite'
      ? `⚡ 정말 [${targetNick}] 님에게 천벌을 내릴까요?\n포인트 ${(Number(tu.points) || 0).toLocaleString()}P + 보류 ${(Number(tu.owed) || 0).toLocaleString()}P → 0${tBlack ? '\n🖤 블랙 자격도 박탈돼요' : ''}\n(되돌릴 수 없어요)`
      : `🚪 정말 [${targetNick}] 님을 블랙 클럽에서 추방할까요?\n(포인트는 그대로, 블랙 자격만 사라져요 · 되돌릴 수 없어요)`)) return;
    feed = type === 'smite' ? `⚡ 천외천의 천벌이 [${targetNick}] 님에게 내려졌습니다` : `🚪 [${targetNick}] 님이 천외천의 명으로 블랙 클럽에서 추방되었습니다`;
  } else if (type === 'rain' || type === 'edict') {
    if (type === 'edict') {
      text = (prompt('👑 1시간 동안 맨 위에 걸어둘 칙령 (60자):', '') || '').trim().slice(0, 60);
      if (!text) return;
    }
    polType = type;
    const rec = { by: currentUser.nickname, from: now, until: now + d.mins * 60000 };
    if (text) rec.text = text;
    updates[`policies/${type}`] = rec;
    feed = type === 'rain' ? '🌤️ 천외천이 축복의 비를 내립니다. 1시간 동안 모든 강화 성공 확률 ×1.2' : `👑 천외천의 칙령: ${text}`;
  }
  if (!confirm(`${d.icon} [${d.name}] — ${d.price.toLocaleString()}P (소각)\n${d.desc}\n\n발동할까요?`)) return;
  // 쿨타임 선점 (동시에 두 번 못 쓰게)
  let ok = false;
  try {
    const r = await db.ref(`white/cool/${type}`).transaction(cur => (Number(cur) || 0) + d.cooldownMin * 60000 > now ? undefined : now);
    ok = r.committed;
  } catch (e) {}
  if (!ok) return alert('쿨타임 중이에요. (결제되지 않았어요)');
  addPoints(-d.price, `${d.icon} 천외천 권능: ${d.name}${targetNick ? ` → ${targetNick}` : ''} (소각)`);
  updatePointsUI();
  try { if (Object.keys(updates).length) await db.ref().update(updates); } catch (e) { console.warn('권능 기록 실패', e && e.message); }
  if (targetNick) db.ref(`judgments/${targetNick}`).push({ by: currentUser.nickname, uid: authUser.uid, type, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
  db.ref('white/history').push({ type: 'power', power: type, by: currentUser.nickname, target: targetNick || null, policy: polType || null, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
  if (typeof postFeed === 'function') postFeed('white', feed, 'legendary', true);
  if (type === 'edict') showEdictPopup(currentUser.nickname, text);
  renderWhiteClub();
}
// 천명으로 막힌 블랙 정책인지
let policyBans = {};
setTimeout(() => { if (typeof db !== 'undefined') db.ref('policy_ban').on('value', s => { policyBans = s.val() || {}; }, () => {}); }, 3000);
function policyBannedLeft(type) { return Math.max(0, (Number(policyBans[type]) || 0) - whiteNow()); }
function whiteRainMult() { return typeof policyActive === 'function' && policyActive('rain') ? WHITE_RAIN_MULT : 1; }

// 천벌·추방을 맞은 회원 쪽 집행 (executeJudgment 에서 호출)
function executeWhiteJudgment(got) {
  if (isWhite()) return; // 천외천에게는 통하지 않음
  const wasBlack = typeof isBlack === 'function' && isBlack();
  if (got.type === 'smite') {
    const lostPts = userPoints, lostOwed = myOwed;
    if (lostPts > 0) addPoints(-lostPts, `⚡ 천외천의 천벌 (${String(got.by || '?').slice(0, 20)})`);
    myOwed = 0;
    if (wasBlack) { myTier.blackUntil = 0; tierDirty = true; }
    updatePointsUI();
    alert(`⚡ 천외천의 천벌이 내려졌습니다.\n포인트 ${lostPts.toLocaleString()}P${lostOwed ? ` + 보류 ${lostOwed.toLocaleString()}P` : ''}가 0이 되었습니다.${wasBlack ? '\n🖤 프레스티지 블랙 자격도 박탈되었습니다.' : ''}`);
  } else if (got.type === 'expel') {
    if (!wasBlack) return;
    myTier.blackUntil = 0; tierDirty = true;
    updatePointsUI();
    alert(`🚪 천외천의 명으로 프레스티지 블랙 클럽에서 추방되었습니다.\n(포인트는 그대로예요)`);
  }
  if (typeof refreshTierUI === 'function') refreshTierUI();
}

// ------------------------------------------------------------------
// 👑 칙령: 맨 위 고정 띠 + 처음 한 번 팝업·음성
// ------------------------------------------------------------------
let edictShownKey = '';
function renderEdict() {
  let bar = document.getElementById('whiteEdictBar');
  const on = typeof policyActive === 'function' && policyActive('edict');
  const rain = typeof policyActive === 'function' && policyActive('rain');
  if (!on && !rain) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'whiteEdictBar';
    bar.className = 'white-edict-bar';
    document.body.prepend(bar);
  }
  const rainHTML = rain ? `<span class="font-black">🌤️ 천외천의 축복의 비</span><span class="ml-1 text-[10px] opacity-70">모든 강화 성공 확률 ×${WHITE_RAIN_MULT} · ${Math.max(0, Math.ceil((activePolicies.rain.until - whiteNow()) / 60000))}분 남음</span>` : '';
  if (!on) { bar.innerHTML = rainHTML; return; }
  const p = activePolicies.edict;
  const left = Math.max(0, Math.ceil((p.until - whiteNow()) / 60000));
  bar.innerHTML = `<span class="font-black">👑 천외천의 칙령</span><span class="mx-2 opacity-60">|</span><span class="font-bold">${esc(p.text || '')}</span><span class="ml-2 text-[10px] opacity-60">— ${esc(p.by)} · ${left}분 남음</span>${rainHTML ? `<span class="mx-3 opacity-40">·</span>${rainHTML}` : ''}`;
  const key = `${p.by}|${p.from}`;
  if (edictShownKey !== key) {
    edictShownKey = key;
    let seen = ''; try { seen = localStorage.getItem('bapsim_edict_seen') || ''; } catch (e) {}
    if (seen !== key) { try { localStorage.setItem('bapsim_edict_seen', key); } catch (e) {} showEdictPopup(p.by, p.text || ''); }
  }
}
function showEdictPopup(by, text) {
  if (typeof showSpeakerPopup !== 'function') return;
  showSpeakerPopup(by, text);
  const card = document.querySelector('#speakerPopup .speaker-card');
  if (card) {
    card.classList.add('white-edict-card');
    const t = card.querySelector('span'); if (t) t.textContent = '👑 천외천의 칙령';
    const b = card.querySelector('.text-slate-400:last-of-type'); if (b) b.textContent = `— ☁️ ${by}`;
  }
}

// ------------------------------------------------------------------
// 화면
// ------------------------------------------------------------------
function renderWhiteBanner() {
  const el = document.getElementById('whiteThroneBanner');
  if (!el) return;
  const t = whiteState.throne, c = whiteState.challenge;
  el.classList.remove('hidden');
  el.innerHTML = t
    ? `<span class="white-banner-label">☁️ 天外天 · PRESTIGE WHITE</span><span class="nb-heaven text-xs">${esc(t.nick)}</span>${c ? `<span class="text-[10px] font-black text-rose-500">⚔️ ${esc(c.challenger)} 님 도전 중</span>` : ''}`
    : `<span class="white-banner-label">☁️ 天外天 · PRESTIGE WHITE</span><span class="text-[11px] font-bold text-slate-400">천외천의 자리가 비어 있습니다</span>`;
}
function openWhiteClub() {
  document.getElementById('whiteClubModal').classList.remove('hidden');
  renderWhiteClub();
}
function closeWhiteClub() { document.getElementById('whiteClubModal').classList.add('hidden'); }
async function renderWhiteClub() {
  const m = document.getElementById('whiteClubModal');
  if (!m || m.classList.contains('hidden')) return;
  const t = whiteState.throne, c = whiteState.challenge, me = isWhite();
  const st = document.getElementById('whiteClubStatus');
  if (st) st.innerHTML = me ? '<span class="text-amber-600 font-black">☁️ 당신이 천외천입니다</span>'
    : (typeof isAdmin !== 'undefined' && isAdmin) ? '<span class="text-sky-600 font-black">🛡️ 관리자 열람 모드</span> <span class="text-slate-400 text-[10px]">(권능은 화이트만)</span>'
    : t ? `<span class="text-slate-500">지금 천외천: <b class="nb-heaven text-[11px]">${esc(t.nick)}</b></span>` : '<span class="text-slate-500">천외천의 자리가 비어 있어요</span>';
  // 즉위·도전
  const join = document.getElementById('whiteJoinBox');
  if (join) {
    const why = whiteEligible();
    const fmtLeft = ms => { const h = Math.floor(ms / 3600000), mm = Math.floor((ms % 3600000) / 60000); return `${h}시간 ${mm}분`; };
    let duel = '';
    if (c) {
      let users = {};
      try { const [a, b] = await Promise.all([db.ref(`user_points/${c.challenger}`).once('value'), db.ref(`user_points/${c.holder}`).once('value')]); users = { [c.challenger]: a.val(), [c.holder]: b.val() }; } catch (e) {}
      const g = challengeGains(users) || { c: 0, h: 0 };
      duel = `<div class="white-card p-3 space-y-1.5">
        <div class="text-xs font-black text-slate-800">⚔️ 왕좌 쟁탈전 · 남은 시간 ${fmtLeft(Math.max(0, c.endAt - whiteNow()))}</div>
        <div class="grid grid-cols-2 gap-2 text-center">
          <div class="rounded-xl bg-white/70 p-2"><div class="text-[10px] text-slate-400">☁️ 주인</div><div class="text-xs font-black">${esc(c.holder)}</div><div class="text-[11px] font-black ${g.h >= 0 ? 'text-emerald-600' : 'text-rose-500'}">${g.h >= 0 ? '+' : ''}${g.h.toLocaleString()}P</div></div>
          <div class="rounded-xl bg-white/70 p-2"><div class="text-[10px] text-slate-400">⚔️ 도전자</div><div class="text-xs font-black">${esc(c.challenger)}</div><div class="text-[11px] font-black ${g.c >= 0 ? 'text-emerald-600' : 'text-rose-500'}">${g.c >= 0 ? '+' : ''}${g.c.toLocaleString()}P</div></div>
        </div>
        <div class="text-[10px] text-slate-400 text-center">자산(포인트+보류+예치금)이 더 많이 늘어난 쪽이 천외천 · 비기면 주인이 지켜요</div>
      </div>`;
    }
    const cond = `<ul class="text-[11px] text-slate-600 space-y-0.5">
        <li>${typeof isBlack === 'function' && isBlack() ? '✅' : '⬜'} 프레스티지 블랙 회원</li>
        <li>${currentEnhanceLevel >= WHITE_MIN_LVL ? '✅' : '⬜'} 지금 밥 +${WHITE_MIN_LVL}강 이상 <span class="text-slate-400">(지금 +${currentEnhanceLevel}강)</span></li>
        <li>${userPoints >= (t ? WHITE_CHALLENGE_PRICE : WHITE_PRICE) ? '✅' : '⬜'} ${t ? `도전장 ${WHITE_CHALLENGE_PRICE.toLocaleString()}P` : `즉위 ${WHITE_PRICE.toLocaleString()}P`} <span class="text-slate-400">(소각)</span></li>
      </ul>`;
    join.innerHTML = me ? duel : `${duel}
      <div class="white-card p-3 space-y-2">
        <div class="text-xs font-black text-slate-800">${t ? '⚔️ 천외천에 도전하기' : '☁️ 천외천에 오르기'}</div>
        ${cond}
        <button ${why || c ? 'disabled' : ''} onclick="${t ? 'challengeWhite()' : 'joinWhite()'}" class="w-full white-btn disabled:opacity-40 font-black py-2 rounded-xl text-xs">${c ? '이미 쟁탈전이 진행 중이에요' : t ? `⚔️ 도전장 던지기 · ${(WHITE_CHALLENGE_PRICE / 10000).toLocaleString()}만P` : `☁️ 즉위하기 · ${(WHITE_PRICE / 10000).toLocaleString()}만P`}</button>
      </div>`;
  }
  // 권능 (화이트·관리자만 목록이 보임)
  const pw = document.getElementById('whitePowers');
  const sec = document.getElementById('whiteSecPowers');
  if (sec) sec.classList.toggle('hidden', !whiteCanView());
  if (pw && whiteCanView()) {
    pw.innerHTML = Object.entries(WHITE_POWERS).map(([k, d]) => {
      const cd = whiteCooldownLeft(k);
      const on = (k === 'rain' || k === 'edict') && policyActive(k);
      const state = on ? `<span class="text-emerald-600">진행 중 · ${policyLeftText(k)} 남음</span>` : cd > 0 ? `<span class="text-slate-400">쿨타임 ${Math.ceil(cd / 60000)}분</span>` : '<span class="text-amber-600">발동 가능</span>';
      return `<div class="white-card p-2.5 flex items-center justify-between gap-2">
        <div class="min-w-0"><div class="text-xs font-black text-slate-800">${d.icon} ${d.name}</div><div class="text-[10px] text-slate-500">${d.desc}</div><div class="text-[10px] font-bold mt-0.5">${state}</div></div>
        <button ${!me || on || cd > 0 ? 'disabled' : ''} onclick="useWhitePower('${k}')" class="shrink-0 white-btn disabled:opacity-40 font-black px-2.5 py-1.5 rounded-lg text-[11px]">${(d.price / 10000).toLocaleString()}만P</button>
      </div>`;
    }).join('');
  }
  const perks = document.getElementById('whitePerks');
  if (perks) perks.innerHTML = [
    '💧 시간당 한도 30만P · 판매 수수료 0% · 분당 강화 1,000회',
    '🔥 초월 보험: 하루 1번, +20강 이상에서 밥이 타면 +20강으로 복구',
    '🛡️ 심판의 망치·천벌·추방이 통하지 않음',
    '☁️ 접속하면 강림 연출 + 전광판 알림 · 전용 배지 「천외천」',
    '🖤 블랙 혜택(축복권·예치·핫라인 등) 전부 포함'
  ].map(x => `<li>${x}</li>`).join('');
}

// 🔥 초월 보험: 하루 1번, +20강 이상에서 타면 +20강으로 (enhance.js 의 파괴 처리에서 호출)
function whiteInsurance(fromLevel) {
  if (!isWhite() || fromLevel < 20) return null;
  const today = todayKey(whiteNow());
  if (whiteInsDay === today) return null;
  whiteInsDay = today;
  db.ref(`user_points/${currentUser.nickname}/whiteInsDay`).set(today).catch(() => {});
  return 20;
}
let whiteInsDay = '';
function loadWhiteFromUser(val) { if (val && typeof val.whiteInsDay === 'string' && val.whiteInsDay > whiteInsDay) whiteInsDay = val.whiteInsDay; }
