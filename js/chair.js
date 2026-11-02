// 밥심 - 🏛️ 블랙 클럽 의장
//
//  - 블랙 회원이 3명 이상일 때만 선거가 열림. 매주(월~일) 선거 → 다음 주 월요일 0시부터 1주일 임기
//  - 출마 100만P(소각) · 투표는 블랙 회원만, 1표 10만P(소각) · 가장 많이 받은 후보가 의장 (동점이면 먼저 출마한 사람)
//  - 의장 혜택: 밥키우기 강화비 −5% · 판매가 +10% · 의장 배지/닉네임 색상 강제 착용(임기 끝나면 자동 원복)
//  - 의장 권한: 🏦 클럽 금고(블랙 정책 비용의 1%가 쌓임) 전액 인출 · 🚪 블랙 회원 추방(3,000만P)
//              · 📈 블랙 회원권 가격 인상(하루 최대 5%) · 📜 의장 제안(관리자는 2시간 안에 답변)
//  - 클럽 금고 금액은 관리자와 의장만 볼 수 있음
//  데이터(보안 규칙상 bank 아래): bank/chair { term, elections/{주}, vault, blackPrice, raiseDay, proposals }

const CHAIR_MIN_BLACK = 3;
const CHAIR_RUN_FEE = 1000000;
const CHAIR_VOTE_PRICE = 100000;
const CHAIR_EXPEL_PRICE = 30000000;
const CHAIR_RAISE_MAX = 5;
const CHAIR_VAULT_RATE = 0.01;
const CHAIR_COST_MULT = 0.95;
const CHAIR_SALE_MULT = 1.10;
const CHAIR_ANSWER_MS = 2 * 3600000;
const BLACK_BASE_PRICE = 5000000;

let chairState = { term: null, elections: {}, vault: 0, blackPrice: BLACK_BASE_PRICE, raiseDay: '', proposals: {} };
let chairWatching = false;
function chairNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function weekStartTs(ts) { return Date.parse(`${weekKey(ts)}T00:00:00+09:00`); }
function weekEndTs(ts) { return weekStartTs(ts) + 7 * 86400000; }
function chairTermActive() { const t = chairState.term; return !!(t && t.until > chairNow() && (t.since || 0) <= chairNow()); }
function isChair() { return chairTermActive() && typeof authUser !== 'undefined' && authUser && chairState.term.uid === authUser.uid; }
function chairCanSeeVault() { return isChair() || (typeof isAdmin !== 'undefined' && isAdmin); }
function blackMemberCount() { return typeof prestigeMembers !== 'undefined' && Array.isArray(prestigeMembers) ? prestigeMembers.length : 0; }
function chairCostMult() { return isChair() ? CHAIR_COST_MULT : 1; }
function chairSaleMult() { return isChair() ? CHAIR_SALE_MULT : 1; }

// 블랙 회원권 가격은 의장이 올린 값을 따름
try { Object.defineProperty(TIERS.black, 'price', { get: () => Math.max(BLACK_BASE_PRICE, Number(chairState.blackPrice) || BLACK_BASE_PRICE), configurable: true }); } catch (e) {}

function watchChair() {
  if (chairWatching || typeof db === 'undefined') return;
  chairWatching = true;
  db.ref('bank/chair').on('value', s => {
    const v = s.val() || {};
    const wasChair = isChair();
    chairState = { term: v.term || null, elections: v.elections || {}, vault: Number(v.vault) || 0, blackPrice: Number(v.blackPrice) || BLACK_BASE_PRICE, raiseDay: String(v.raiseDay || ''), proposals: v.proposals || {} };
    if (wasChair !== isChair()) applyChairRegalia();
    maybeResolveElection();
    renderChairSection();
    if (typeof renderTierBox === 'function') try { renderTierBox(); } catch (e) {}
    if (typeof renderAdminChair === 'function') try { renderAdminChair(); } catch (e) {}
  }, () => { chairWatching = false; });
}
setTimeout(watchChair, 2500);
setInterval(() => { maybeResolveElection(); applyChairRegalia(); renderChairSection(); }, 30000);

// ------------------------------------------------------------------
// 👑 의장 배지·색상 강제 착용 (임기 끝나면 원래대로)
// ------------------------------------------------------------------
let regaliaBusy = false;
async function applyChairRegalia() {
  if (regaliaBusy || typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  regaliaBusy = true;
  try {
    const ref = db.ref(`user_points/${currentUser.nickname}/preChair`);
    if (isChair()) {
      if (myNickBg === 'nb-chair' && myNickColor === 'pc-chair') return;
      const prev = (await ref.once('value')).val();
      if (!prev) await ref.set({ bg: myNickBg === 'nb-chair' ? 'nb-none' : (myNickBg || 'nb-none'), color: myNickColor === 'pc-chair' ? '' : (myNickColor || '') });
      myNickBg = 'nb-chair'; myNickColor = 'pc-chair';
      updatePointsUI();
      if (typeof renderShopUI === 'function') try { renderShopUI(); } catch (e) {}
    } else if (myNickBg === 'nb-chair' || myNickColor === 'pc-chair') {
      const prev = (await ref.once('value')).val() || {};
      myNickBg = prev.bg && prev.bg !== 'nb-chair' ? prev.bg : 'nb-none';
      myNickColor = prev.color && prev.color !== 'pc-chair' ? prev.color : '';
      await ref.remove();
      updatePointsUI();
      if (typeof renderShopUI === 'function') try { renderShopUI(); } catch (e) {}
    }
  } catch (e) {} finally { regaliaBusy = false; }
}
function chairBlocksEquip() {
  if (!isChair()) return false;
  alert('🏛️ 블랙 클럽 의장 임기 중에는 의장 배지와 의장 색상을 벗을 수 없어요. (임기가 끝나면 자동으로 원래대로 돌아가요)');
  return true;
}

// ------------------------------------------------------------------
// 🗳️ 선거
// ------------------------------------------------------------------
function curElection() { return (chairState.elections || {})[weekKey(chairNow())] || {}; }
async function runForChair() {
  if (!checkApprovalGuard()) return;
  if (!(typeof isBlack === 'function' && isBlack())) return alert('🖤 블랙 회원만 출마할 수 있어요.');
  if (blackMemberCount() < CHAIR_MIN_BLACK) return alert(`블랙 회원이 ${CHAIR_MIN_BLACK}명 이상일 때부터 의장 선거가 열려요. (지금 ${blackMemberCount()}명)`);
  const wk = weekKey(chairNow());
  if ((curElection().candidates || {})[authUser.uid]) return alert('이미 이번 주 선거에 출마했어요.');
  if (userPoints < CHAIR_RUN_FEE) return alert(`❌ 포인트가 부족해요! (출마 ${CHAIR_RUN_FEE.toLocaleString()}P)`);
  if (!confirm(`🏛️ 이번 주 블랙 클럽 의장 선거에 출마할까요?\n\n· 출마비 ${CHAIR_RUN_FEE.toLocaleString()}P (소각, 돌려받지 못함)\n· 일요일 자정까지 표를 가장 많이 받으면 다음 주 1주일 동안 의장\n· 의장이 되면 의장 배지·색상이 강제로 착용돼요`)) return;
  let ok = false;
  try {
    const r = await db.ref(`bank/chair/elections/${wk}/candidates/${authUser.uid}`).transaction(cur => cur ? undefined : { nick: currentUser.nickname, at: chairNow(), votes: 0 });
    ok = r.committed;
  } catch (e) {}
  if (!ok) return alert('출마 등록에 실패했어요. (결제되지 않았어요)');
  addPoints(-CHAIR_RUN_FEE, '🏛️ 블랙 의장 출마 (소각)');
  updatePointsUI();
  renderChairSection();
}
async function voteChair(uid) {
  if (!checkApprovalGuard()) return;
  if (!(typeof isBlack === 'function' && isBlack())) return alert('🖤 블랙 회원만 투표할 수 있어요.');
  const c = (curElection().candidates || {})[uid];
  if (!c) return;
  const n = Math.floor(Number(prompt(`🗳️ [${c.nick}] 님에게 몇 표를 줄까요? (1표 ${CHAIR_VOTE_PRICE.toLocaleString()}P · 소각)`, '1')) || 0);
  if (n <= 0) return;
  const cost = n * CHAIR_VOTE_PRICE;
  if (userPoints < cost) return alert(`❌ 포인트가 부족해요! (${cost.toLocaleString()}P)`);
  if (!confirm(`[${c.nick}] 님에게 ${n}표 (${cost.toLocaleString()}P) 를 줄까요?`)) return;
  let ok = false;
  try {
    const r = await db.ref(`bank/chair/elections/${weekKey(chairNow())}/candidates/${uid}/votes`).transaction(v => (Number(v) || 0) + n);
    ok = r.committed;
  } catch (e) {}
  if (!ok) return alert('투표에 실패했어요. (결제되지 않았어요)');
  addPoints(-cost, `🗳️ 블랙 의장 투표 → ${c.nick} ${n}표 (소각)`);
  updatePointsUI();
}
let electionResolving = false;
async function maybeResolveElection() {
  if (electionResolving || typeof canSyncToCloud !== 'function' || !canSyncToCloud()) return;
  const cw = weekKey(chairNow());
  const pending = Object.entries(chairState.elections || {}).filter(([w, e]) => w < cw && e && !e.resolved);
  if (!pending.length) return;
  electionResolving = true;
  try {
    const latest = pending.map(p => p[0]).sort().pop();
    let winner = null;
    await db.ref('bank/chair').transaction(cur => {
      if (!cur || !cur.elections) return undefined;
      let changed = false;
      Object.keys(cur.elections).forEach(w => {
        const e = cur.elections[w];
        if (w >= cw || !e || e.resolved) return;
        e.resolved = true; changed = true;
        if (w !== latest) return;
        const cands = Object.entries(e.candidates || {}).map(([uid, c]) => ({ uid, nick: c.nick, votes: Number(c.votes) || 0, at: Number(c.at) || 0 }));
        cands.sort((a, b) => b.votes - a.votes || a.at - b.at);
        if (cands.length) {
          winner = cands[0];
          e.winner = winner.nick;
          cur.term = { nick: winner.nick, uid: winner.uid, week: cw, since: weekStartTs(chairNow()), until: weekEndTs(chairNow()), votes: winner.votes };
        }
      });
      return changed ? cur : undefined;
    });
    if (winner && typeof postFeed === 'function') postFeed('chair', `🏛️ 블랙 클럽 새 의장 선출: [${winner.nick}] 님 (${winner.votes}표) · 1주일 임기 시작`, 'legendary', true);
  } catch (e) {} finally { electionResolving = false; }
}

// ------------------------------------------------------------------
// 🏛️ 의장 권한
// ------------------------------------------------------------------
// 블랙 정책 비용의 1% → 클럽 금고 (club.js 의 activatePolicy 에서 호출)
function addToChairVault(amount) {
  const a = Math.round(Number(amount) || 0);
  if (a <= 0) return;
  db.ref('bank/chair/vault').transaction(v => (Number(v) || 0) + a).catch(() => {});
}
async function chairWithdrawVault() {
  if (!isChair()) return alert('의장만 인출할 수 있어요.');
  let got = 0;
  try {
    const r = await db.ref('bank/chair/vault').transaction(v => { got = Number(v) || 0; return got > 0 ? 0 : undefined; });
    if (!r.committed) got = 0;
  } catch (e) { got = 0; }
  if (got <= 0) return alert('금고가 비어 있어요.');
  addPoints(got, '🏦 블랙 클럽 금고 인출 (의장)');
  updatePointsUI();
  alert(`🏦 클럽 금고에서 ${got.toLocaleString()}P를 꺼냈어요. (큰 금액은 시간당 한도에 따라 보류로 들어와요)`);
}
async function chairExpel() {
  if (!isChair()) return alert('의장만 쓸 수 있어요.');
  const target = (prompt(`🚪 블랙 클럽에서 추방할 회원 닉네임 (${CHAIR_EXPEL_PRICE.toLocaleString()}P · 소각):`, '') || '').trim();
  if (!target) return;
  if (target === currentUser.nickname) return alert('자기 자신은 추방할 수 없어요.');
  let tu = null;
  try { tu = (await db.ref(`user_points/${target}`).once('value')).val(); } catch (e) {}
  if (!tu || !((Number(tu.blackUntil) || 0) > chairNow())) return alert(`[${target}] 님은 블랙 회원이 아니에요.`);
  if (userPoints < CHAIR_EXPEL_PRICE) return alert(`❌ 포인트가 부족해요! (${CHAIR_EXPEL_PRICE.toLocaleString()}P)`);
  if (!confirm(`🚪 정말 [${target}] 님을 블랙 클럽에서 추방할까요?\n${CHAIR_EXPEL_PRICE.toLocaleString()}P가 소각되고 되돌릴 수 없어요.`)) return;
  addPoints(-CHAIR_EXPEL_PRICE, `🚪 의장 추방 → ${target} (소각)`);
  updatePointsUI();
  await db.ref(`judgments/${target}`).push({ type: 'chair_expel', by: currentUser.nickname, uid: authUser.uid, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
  db.ref('policy_log').push({ type: 'chair_expel', by: currentUser.nickname, target, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
  alert(`🚪 [${target}] 님에게 추방 명령을 내렸어요. (접속하는 즉시 적용)`);
}
// 추방당한 쪽 집행 (club.js executeJudgment 에서 호출)
function executeChairExpel(got) {
  if (typeof isWhite === 'function' && isWhite()) return; // 화이트에게는 통하지 않음
  if (!(typeof isBlack === 'function' && isBlack())) return;
  myTier.blackUntil = 0; tierDirty = true;
  updatePointsUI();
  if (typeof refreshTierUI === 'function') refreshTierUI();
  alert('🚪 블랙 클럽 의장의 명으로 프레스티지 블랙 클럽에서 추방되었습니다.\n(포인트는 그대로예요)');
}
async function chairRaisePrice() {
  if (!isChair()) return alert('의장만 쓸 수 있어요.');
  const today = todayKey(chairNow());
  if (chairState.raiseDay === today) return alert('오늘은 이미 회원권 가격을 올렸어요. 내일 다시 올릴 수 있어요.');
  const cur = TIERS.black.price;
  const pct = Number(prompt(`📈 블랙 회원권 가격을 몇 % 올릴까요? (0.1 ~ ${CHAIR_RAISE_MAX}%)\n지금 ${cur.toLocaleString()}P`, String(CHAIR_RAISE_MAX)));
  if (!(pct > 0) || pct > CHAIR_RAISE_MAX) return;
  const next = Math.round(cur * (1 + pct / 100) / 1000) * 1000;
  if (!confirm(`블랙 회원권 ${cur.toLocaleString()}P → ${next.toLocaleString()}P (+${pct}%) 로 올릴까요?`)) return;
  let ok = false;
  try {
    const r = await db.ref('bank/chair').transaction(c => {
      c = c || {};
      if (c.raiseDay === today) return undefined;
      c.blackPrice = Math.round(Math.max(BLACK_BASE_PRICE, Number(c.blackPrice) || BLACK_BASE_PRICE) * (1 + pct / 100) / 1000) * 1000;
      c.raiseDay = today;
      return c;
    });
    ok = r.committed;
  } catch (e) {}
  if (!ok) return alert('오늘은 이미 올렸어요.');
  db.ref('policy_log').push({ type: 'chair_raise', by: currentUser.nickname, pct, price: next, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
}
async function chairPropose() {
  if (!isChair()) return alert('의장만 제안할 수 있어요.');
  const el = document.getElementById('chairProposalText');
  const text = (el && el.value || '').trim().slice(0, 500);
  if (text.length < 5) return alert('제안 내용을 5자 이상 적어주세요.');
  if (!confirm('📜 이 제안을 관리자에게 보낼까요?\n(블랙 클럽 맨 위에 공지되고, 관리자는 2시간 안에 답변해야 해요)')) return;
  const now = chairNow();
  await db.ref('bank/chair/proposals').push({ text, nick: currentUser.nickname, uid: authUser.uid, at: now, deadline: now + CHAIR_ANSWER_MS }).catch(e => alert('보내지 못했어요: ' + e.message));
  if (el) el.value = '';
}

// ------------------------------------------------------------------
// 화면 (블랙 클럽 맨 위)
// ------------------------------------------------------------------
function fmtLeftMs(ms) { if (ms <= 0) return '0분'; const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000); return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${m}분` : `${m}분`; }
function proposalRowsHTML(limit = 5, dark = true) {
  const rows = Object.entries(chairState.proposals || {}).map(([id, p]) => Object.assign({ id }, p)).sort((a, b) => b.at - a.at).slice(0, limit);
  if (!rows.length) return '';
  const now = chairNow();
  return rows.map(p => {
    const late = !p.answer && now > p.deadline;
    return `<div class="rounded-xl ${dark ? 'bg-amber-300/10 border border-amber-300/30' : 'bg-white border'} p-2.5 space-y-1">
      <div class="flex justify-between gap-2 text-[10px] ${dark ? 'text-amber-200' : 'text-slate-500'} font-black"><span>📜 의장 제안 · ${esc(p.nick)}</span><span>${new Date(p.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span></div>
      <div class="text-xs ${dark ? 'text-white' : 'text-slate-800'} whitespace-pre-line">${esc(p.text)}</div>
      ${p.answer ? `<div class="text-[11px] rounded-lg p-2 ${dark ? 'bg-white/10 text-sky-100' : 'bg-sky-50 text-sky-900'} whitespace-pre-line">🛡️ 관리자 답변: ${esc(p.answer)}</div>`
        : `<div class="text-[10px] font-bold ${late ? 'text-rose-400' : dark ? 'text-slate-400' : 'text-slate-500'}">${late ? `⏰ 답변 기한 ${fmtLeftMs(now - p.deadline)} 지남` : `⏳ 관리자 답변 대기 · 기한까지 ${fmtLeftMs(p.deadline - now)}`}</div>`}
    </div>`;
  }).join('');
}
function renderChairSection() {
  const box = document.getElementById('clubChairBox');
  if (!box) return;
  const m = document.getElementById('blackClubModal');
  const canView = typeof clubCanView === 'function' ? clubCanView() : false;
  box.classList.toggle('hidden', !canView);
  if (!canView || !m || m.classList.contains('hidden')) return;
  const now = chairNow(), t = chairState.term, active = chairTermActive();
  const el = curElection(), cands = Object.entries(el.candidates || {}).map(([uid, c]) => Object.assign({ uid }, c)).sort((a, b) => (b.votes || 0) - (a.votes || 0) || a.at - b.at);
  const count = blackMemberCount(), open = count >= CHAIR_MIN_BLACK, me = isChair();
  const black = typeof isBlack === 'function' && isBlack();
  box.innerHTML = `
    ${proposalRowsHTML(3)}
    <div class="rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 to-transparent p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-extrabold text-amber-100">🏛️ 블랙 클럽 의장</span>
        <span class="text-[10px] text-slate-400">블랙 회원권 지금 ${TIERS.black.price.toLocaleString()}P</span>
      </div>
      ${active ? `<div class="flex items-center justify-between gap-2"><span>${nickHTML({ nickname: t.nick, badge: 'nb-chair', color: 'pc-chair' }, 'text-xs')}</span><span class="text-[10px] text-slate-400">임기 ${fmtLeftMs(t.until - now)} 남음 · ${t.votes || 0}표</span></div>`
        : '<div class="text-[11px] text-slate-400">지금은 의장이 없어요.</div>'}
      ${me ? `<div class="rounded-xl bg-black/30 border border-amber-300/30 p-2.5 space-y-2">
        <div class="text-[11px] font-black text-amber-200">👑 의장 집무실 <span class="text-slate-400 font-bold">· 강화비 −5% · 판매가 +10% 적용 중</span></div>
        <div class="flex items-center justify-between gap-2 text-xs"><span>🏦 클럽 금고 <span class="text-[10px] text-slate-500">(의장·관리자만 보임)</span></span><span class="font-black text-amber-200">${chairState.vault.toLocaleString()}P</span></div>
        <div class="grid grid-cols-3 gap-1.5">
          <button onclick="chairWithdrawVault()" class="bg-amber-300 text-slate-950 font-black py-1.5 rounded-lg text-[10px]">금고 인출</button>
          <button onclick="chairExpel()" class="bg-rose-500/80 text-white font-black py-1.5 rounded-lg text-[10px]">추방 3천만P</button>
          <button onclick="chairRaisePrice()" ${chairState.raiseDay === todayKey(now) ? 'disabled' : ''} class="bg-white/10 disabled:opacity-40 text-white font-black py-1.5 rounded-lg text-[10px]">회원권 인상</button>
        </div>
        <textarea id="chairProposalText" rows="2" maxlength="500" placeholder="관리자에게 보낼 정책 제안 (블랙 클럽 맨 위에 공지돼요)" class="w-full bg-black/40 border border-white/15 rounded-lg p-2 text-xs text-white"></textarea>
        <button onclick="chairPropose()" class="w-full bg-white/10 hover:bg-white/15 text-amber-100 font-black py-1.5 rounded-lg text-[11px]">📜 의장 제안 보내기</button>
      </div>` : (typeof isAdmin !== 'undefined' && isAdmin) ? `<div class="text-[11px] text-slate-400">🛡️ 관리자 열람 · 클럽 금고 <b class="text-amber-200">${chairState.vault.toLocaleString()}P</b></div>` : ''}
      <div class="border-t border-white/10 pt-2 space-y-1.5">
        <div class="text-[11px] font-black text-white">🗳️ 이번 주 의장 선거 <span class="text-slate-400 font-bold">· 일요일 자정 마감 (${fmtLeftMs(weekEndTs(now) - now)} 남음)</span></div>
        ${!open ? `<div class="text-[11px] text-slate-400">블랙 회원이 ${CHAIR_MIN_BLACK}명 이상일 때부터 선거가 열려요. (지금 ${count}명)</div>` : `
          ${cands.length ? cands.map(c => `<div class="flex items-center justify-between gap-2 text-xs"><span class="font-bold text-white">${esc(c.nick)}</span><span class="flex items-center gap-1.5"><b class="text-amber-200">${(c.votes || 0).toLocaleString()}표</b>${black ? `<button onclick="voteChair('${esc(c.uid)}')" class="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-[10px] font-black">투표</button>` : ''}</span></div>`).join('') : '<div class="text-[11px] text-slate-400">아직 출마한 사람이 없어요.</div>'}
          ${black && !(el.candidates || {})[authUser && authUser.uid] ? `<button onclick="runForChair()" class="w-full bg-amber-300 text-slate-950 font-black py-1.5 rounded-lg text-[11px]">🏛️ 출마하기 · ${(CHAIR_RUN_FEE / 10000).toLocaleString()}만P</button>` : ''}
          <div class="text-[10px] text-slate-500">1표 ${(CHAIR_VOTE_PRICE / 10000)}만P · 출마비·투표비 전액 소각 · 의장 혜택: 강화비 −5% · 판매가 +10% · 금고 · 추방 · 회원권 인상 · 제안권</div>`}
      </div>
    </div>`;
}
