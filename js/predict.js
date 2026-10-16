// 밥심 - 오늘 점심 1위 예측 베팅 (그룹 전용)
//
// - 11:20(한국 시간)까지: 오늘 그룹 투표 1위가 될 식당에 포인트를 건다 (1인 1회)
//     groups/{그룹}/bets/{날짜}/{닉네임} = { rid, stake, uid, ts }
//     내 베팅 목록(정산용): user_points/{닉}/myBets/{그룹}__{날짜}
// - 11:30 투표 마감 후: 처음 확인한 사람이 결과를 한 번만 기록
//     groups/{그룹}/results/{날짜} = { winners: {식당ID: true}, tally, at }
// - 각자 자기 베팅을 정산: 맞힌 사람끼리 틀린 사람들의 판돈을 비율대로 나눠 갖고 +20% 보너스
//   (공동 1위면 모두 정답, 투표가 하나도 없으면 전원 환불)

const BET_CLOSE_MIN = 11 * 60 + 20;
const BET_MIN = 100, BET_MAX = 3000;
const BET_BONUS = 0.2;

let todayBets = {};
let todayResult = null;
let betsRef = null, resultRef = null;
let predictionGroup = null;
let mySettledBets = {};
let myPendingBets = {};
let settlingBets = false;

function loadBetsFromUser(val) {
  mySettledBets = Object.assign({}, (val && val.settledBets) || {});
  myPendingBets = Object.assign({}, (val && val.myBets) || {});
}

function isBettingClosed() { return kstMinutesOfDay() >= BET_CLOSE_MIN; }

function attachPredictionListener() {
  if (betsRef) betsRef.off();
  if (resultRef) resultRef.off();
  todayBets = {}; todayResult = null;
  predictionGroup = currentGroupId;
  const panel = document.getElementById('predictionPanel');
  if (currentGroupId === 'lobby') { if (panel) panel.classList.add('hidden'); return; }
  if (panel) panel.classList.remove('hidden');
  const date = todayKey();
  betsRef = db.ref(`groups/${currentGroupId}/bets/${date}`);
  betsRef.on('value', s => { todayBets = s.val() || {}; renderPredictionPanel(); }, onDbError);
  resultRef = db.ref(`groups/${currentGroupId}/results/${date}`);
  resultRef.on('value', s => { todayResult = s.val(); renderPredictionPanel(); }, onDbError);
}

function payoutFor(bets, winners) {
  // bets: { 닉: {rid, stake} }, winners: {rid:true} → { 닉: 지급액 }
  const list = Object.entries(bets || {}).filter(([, b]) => b && b.rid && b.stake > 0);
  const pool = list.reduce((a, [, b]) => a + b.stake, 0);
  const out = {};
  if (!winners || Object.keys(winners).length === 0) {
    list.forEach(([n, b]) => { out[n] = b.stake; }); // 투표 없음 → 전원 환불
    return out;
  }
  const winStake = list.filter(([, b]) => winners[b.rid]).reduce((a, [, b]) => a + b.stake, 0);
  const loserPool = pool - winStake;
  list.forEach(([n, b]) => {
    out[n] = winners[b.rid] ? b.stake + Math.floor(b.stake / winStake * loserPool) + Math.floor(b.stake * BET_BONUS) : 0;
  });
  return out;
}

// 화면에 보여줄 "지금 이 식당이 1위가 되면" 예상 배당
function projectedMultiplier(rid, extraStake = 0) {
  const list = Object.values(todayBets).filter(b => b && b.rid);
  const pool = list.reduce((a, b) => a + b.stake, 0) + extraStake;
  const winStake = list.filter(b => b.rid === rid).reduce((a, b) => a + b.stake, 0) + extraStake;
  if (winStake === 0) return null;
  return (pool / winStake) + BET_BONUS;
}

async function placeBet() {
  if (!checkApprovalGuard()) return;
  if (currentGroupId === 'lobby') return;
  if (isBettingClosed()) return alert('⏰ 오늘 예측은 11:20에 마감됐어요.');
  if (todayBets[currentUser.nickname]) return alert('오늘은 이미 예측했어요! (하루 1번)');
  const rid = document.getElementById('betRestaurantSelect').value;
  const stake = parseInt(document.getElementById('betStakeInput').value, 10) || 0;
  if (!rid || !restaurants[rid]) return alert('1위가 될 것 같은 식당을 골라주세요.');
  if (stake < BET_MIN || stake > BET_MAX) return alert(`판돈은 ${BET_MIN}~${BET_MAX.toLocaleString()}P 사이로 걸 수 있어요.`);
  if (userPoints < stake) return alert('❌ 포인트가 부족해요!');
  if (!confirm(`[${restaurants[rid].name}]이(가) 오늘 1위! 에 ${stake.toLocaleString()}P를 걸까요?\n(한 번 걸면 바꿀 수 없어요)`)) return;

  const date = todayKey(), gid = currentGroupId;
  try {
    await db.ref(`groups/${gid}/bets/${date}/${currentUser.nickname}`).set({
      rid, stake, uid: authUser.uid, ts: firebase.database.ServerValue.TIMESTAMP
    });
    myPendingBets[`${gid}__${date}`] = { gid, date, rid, stake };
    await db.ref(`user_points/${currentUser.nickname}/myBets/${gid}__${date}`).set({ gid, date, rid, stake });
    userPoints -= stake;
    updatePointsUI();
    postFeed('bet', `[${currentGroupName}] 오늘 1위는 ${restaurants[rid].name}! 에 ${stake.toLocaleString()}P 베팅 🔮`, 'normal');
  } catch (err) {
    alert('예측하지 못했어요: ' + err.message);
  }
}

// 마감 후 결과가 없으면 투표 기록으로 계산해서 한 번만 기록
async function ensureResult(gid, date) {
  const rRef = db.ref(`groups/${gid}/results/${date}`);
  let snap = await rRef.once('value');
  if (snap.exists()) return snap.val();
  const ballots = (await db.ref(`groups/${gid}/ballots/${date}`).once('value')).val() || {};
  const tally = {};
  Object.values(ballots).forEach(b => { if (b && b.rid) tally[b.rid] = (tally[b.rid] || 0) + 1; });
  const max = Math.max(0, ...Object.values(tally));
  const winners = {};
  if (max > 0) Object.entries(tally).forEach(([rid, n]) => { if (n === max) winners[rid] = true; });
  try {
    await rRef.set({ winners, tally, at: firebase.database.ServerValue.TIMESTAMP, by: currentUser.nickname });
  } catch (e) { /* 다른 사람이 먼저 기록함 → 그 결과를 사용 */ }
  snap = await rRef.once('value');
  return snap.val();
}

// 로그인 후, 그리고 1분마다: 결과가 나온 내 베팅을 정산
async function settleMyBets() {
  if (!canSyncToCloud() || settlingBets) return;
  const today = todayKey();
  const due = Object.entries(myPendingBets).filter(([key, b]) =>
    b && !mySettledBets[key] && (b.date < today || (b.date === today && kstMinutesOfDay() >= VOTE_CLOSE_MIN)));
  if (due.length === 0) return;
  settlingBets = true;
  try {
    for (const [key, b] of due) {
      const result = await ensureResult(b.gid, b.date);
      if (!result) continue;
      const bets = (await db.ref(`groups/${b.gid}/bets/${b.date}`).once('value')).val() || {};
      const pay = payoutFor(bets, result.winners || {})[currentUser.nickname] || 0;
      mySettledBets[key] = true;
      delete myPendingBets[key];
      await db.ref(`user_points/${currentUser.nickname}`).update({ [`settledBets/${key}`]: true, [`myBets/${key}`]: null });
      if (pay > 0) {
        userPoints += pay;
        updatePointsUI();
      }
      const winnerNames = Object.keys(result.winners || {}).map(id => restaurants[id]?.name || '?').join(', ') || '투표 없음';
      const profit = pay - b.stake;
      if (pay > b.stake) {
        postFeed('bet', `🔮 점심 1위 예측 적중! (${winnerNames}) +${profit.toLocaleString()}P`, profit >= 3000 ? 'big' : 'normal');
        maybeDropCard('예측 적중', 15);
        if (window.confetti) confetti({ particleCount: 120 });
      }
      showBetToast(b, winnerNames, pay);
    }
  } finally {
    settlingBets = false;
  }
}

function showBetToast(b, winnerNames, pay) {
  const box = document.getElementById('feedToastContainer');
  if (!box) return;
  const won = pay > b.stake, refund = pay === b.stake;
  const el = document.createElement('div');
  el.className = `feed-toast ${won ? 'feed-toast-big' : refund ? 'feed-toast-plain' : 'feed-toast-lose'}`;
  el.innerHTML = `<div class="text-[10px] font-black opacity-80">🔮 ${esc(b.date)} 점심 1위 예측 결과</div>
    <div class="text-xs font-bold">1위: ${esc(winnerNames)}</div>
    <div class="text-sm font-black">${won ? `적중! +${pay.toLocaleString()}P` : refund ? `환불 ${pay.toLocaleString()}P` : `빗나감 -${b.stake.toLocaleString()}P`}</div>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('feed-toast-out'), 6000);
  setTimeout(() => el.remove(), 6700);
}

function renderPredictionPanel() {
  const panel = document.getElementById('predictionPanel');
  if (!panel || currentGroupId === 'lobby') return;
  const list = Object.values(restaurants || {}).filter(r => r && r.id);
  const myBet = todayBets[currentUser.nickname];
  const allBets = Object.entries(todayBets).filter(([, b]) => b && b.rid);
  const pool = allBets.reduce((a, [, b]) => a + b.stake, 0);
  const byRid = {};
  allBets.forEach(([n, b]) => { (byRid[b.rid] = byRid[b.rid] || { stake: 0, names: [] }).stake += b.stake; byRid[b.rid].names.push(n); });

  const now = kstMinutesOfDay();
  let status;
  if (todayResult) status = 'result';
  else if (now >= VOTE_CLOSE_MIN) status = 'tallying';
  else if (now >= BET_CLOSE_MIN) status = 'closed';
  else status = 'open';

  const minsLeft = BET_CLOSE_MIN - now;
  const header = {
    open: `⏳ 예측 마감까지 <strong>${Math.floor(minsLeft / 60) > 0 ? Math.floor(minsLeft / 60) + '시간 ' : ''}${minsLeft % 60}분</strong>`,
    closed: '🔒 예측 마감 · 11:30 투표 마감 후 결과 발표',
    tallying: '📊 결과 집계 중...',
    result: '🏁 오늘의 결과'
  }[status];

  const winners = (todayResult && todayResult.winners) || {};
  const myPay = todayResult ? (payoutFor(todayBets, winners)[currentUser.nickname] || 0) : null;

  const rows = list.map(r => {
    const info = byRid[r.id] || { stake: 0, names: [] };
    const mult = projectedMultiplier(r.id, info.stake === 0 ? 100 : 0);
    const isWin = !!winners[r.id];
    return `
      <div class="flex items-center justify-between gap-2 py-1 ${isWin ? 'font-black text-amber-700' : ''}">
        <span class="truncate">${isWin ? '👑 ' : ''}${esc(r.name)} <span class="text-[10px] text-slate-400 font-normal">${groupVotesData[r.id] || 0}표</span></span>
        <span class="shrink-0 text-[10px] ${info.stake ? 'text-violet-700 font-bold' : 'text-slate-400'}">
          ${info.stake ? `${info.stake.toLocaleString()}P · ${info.names.length}명` : '베팅 없음'}${status === 'open' && mult ? ` · <span class="text-emerald-600">x${mult.toFixed(1)}</span>` : ''}
        </span>
      </div>`;
  }).join('');

  let action = '';
  if (myBet) {
    action = `<div class="p-2 rounded-xl bg-violet-100 text-violet-900 text-[11px] font-bold">내 예측: ${esc(restaurants[myBet.rid]?.name || '?')} · ${myBet.stake.toLocaleString()}P
      ${myPay !== null ? ` → ${myPay > myBet.stake ? `<span class="text-amber-600">적중! ${myPay.toLocaleString()}P</span>` : myPay === myBet.stake ? '환불' : '<span class="text-rose-600">빗나감</span>'}` : ''}</div>`;
  } else if (status === 'open') {
    action = `
      <div class="flex gap-1.5">
        <select id="betRestaurantSelect" class="flex-1 min-w-0 border rounded-xl p-2 text-xs font-bold bg-white">
          <option value="">1위 식당 선택</option>
          ${list.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}
        </select>
        <input id="betStakeInput" type="number" min="${BET_MIN}" max="${BET_MAX}" step="100" value="300" class="w-20 border rounded-xl p-2 text-xs font-black text-center bg-white" />
        <button onclick="placeBet()" class="shrink-0 bg-violet-600 hover:bg-violet-700 text-white font-black px-3 rounded-xl text-xs shadow-sm">걸기</button>
      </div>`;
  }

  panel.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-black text-violet-900">🔮 오늘 점심 1위 예측</span>
      <span class="text-[10px] font-bold text-violet-700 bg-white/70 px-2 py-0.5 rounded-full">판돈 합계 ${pool.toLocaleString()}P</span>
    </div>
    <div class="text-[11px] text-violet-800 mb-2">${header}</div>
    <div class="text-xs divide-y divide-violet-100 bg-white/70 rounded-xl px-2.5 py-1 mb-2 max-h-48 overflow-y-auto">${rows || '<div class="py-2 text-slate-400">등록된 식당이 없어요</div>'}</div>
    ${action}
    <div class="text-[10px] text-violet-500 mt-1.5">맞힌 사람끼리 틀린 사람들의 판돈을 나눠 갖고 +20% 보너스! 공동 1위는 모두 정답 · 투표가 없으면 전원 환불</div>`;
}

// 1분마다: 남은 시간 갱신 + 마감되면 결과 확정/정산
setInterval(() => {
  if (currentGroupId !== 'lobby') {
    if (predictionGroup !== currentGroupId || (betsRef && betsRef.toString().indexOf(todayKey()) === -1)) attachPredictionListener();
    else renderPredictionPanel();
    if (!todayResult && kstMinutesOfDay() >= VOTE_CLOSE_MIN && canSyncToCloud()) ensureResult(currentGroupId, todayKey()).catch(() => {});
  }
  settleMyBets();
}, 60000);
