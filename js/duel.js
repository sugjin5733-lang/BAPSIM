// 밥심 - 1:1 주사위 결투
//
// 1) 신청자가 판돈을 걸고 결투장을 연다 (판돈은 바로 차감) → duels/{id} status: open
// 2) 상대가 수락하면 같은 판돈 차감 → status: accepted, acceptedAt = 서버 시각
// 3) 결과는 sha256(결투ID + 서버 수락 시각)으로 정해져서 두 사람 화면에서 똑같이 나옴
//    (누구도 주사위를 다시 굴리거나 결과를 고를 수 없음)
// 4) 이긴 사람이 판돈 x2 를 받음. 각자 user_points/{닉}/settledDuels/{id} 로 정산 완료 표시
// 15분 동안 아무도 수락하지 않으면 신청자에게 자동 환불

const DUEL_MIN = 100, DUEL_MAX = 5000;
const DUEL_EXPIRE_MS = 15 * 60 * 1000;
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

let allDuels = {};
let mySettledDuels = {};
let duelSettling = {};

function loadDuelSettlementsFromUser(val) {
  mySettledDuels = Object.assign({}, (val && val.settledDuels) || {});
}

function attachDuelListener() {
  db.ref('duels').orderByChild('createdAt').limitToLast(40).on('value', snap => {
    allDuels = snap.val() || {};
    settleMyDuels();
    renderDuelArena();
    updateDuelBadge();
  }, onDbError);
}

async function duelResult(d, id) {
  const bytes = await seededBytes(`bapsim-duel:${id}:${d.acceptedAt}`);
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const a = (bytes[i] % 6) + 1, b = (bytes[i + 1] % 6) + 1;
    if (a !== b) return { fromRoll: a, accRoll: b, winner: a > b ? 'from' : 'acceptor' };
  }
  return { fromRoll: 6, accRoll: 1, winner: 'from' }; // 사실상 도달 불가
}

function isMyDuel(d) {
  return authUser && (d.fromUid === authUser.uid || d.acceptorUid === authUser.uid);
}

async function settleMyDuels() {
  if (!canSyncToCloud()) return;
  for (const [id, d] of Object.entries(allDuels)) {
    if (!d || mySettledDuels[id] || duelSettling[id] || !isMyDuel(d)) continue;

    // 수락 안 된 채 시간이 지난 내 결투 → 자동 취소 + 환불
    if (d.status === 'open' && d.fromUid === authUser.uid && Date.now() - (d.createdAt || 0) > DUEL_EXPIRE_MS) {
      cancelDuel(id, true);
      continue;
    }
    if (d.status !== 'accepted' || !d.acceptedAt) continue;

    duelSettling[id] = true;
    const r = await duelResult(d, id);
    const iAmFrom = d.fromUid === authUser.uid;
    const iWon = (r.winner === 'from') === iAmFrom;
    mySettledDuels[id] = true;
    const updates = { [`settledDuels/${id}`]: true };
    if (iWon) userPoints += d.bet * 2;
    await db.ref(`user_points/${currentUser.nickname}`).update(updates).catch(() => {});
    if (iWon) {
      updatePointsUI();
      const loser = iAmFrom ? d.acceptor : d.from;
      postFeed('duel', `⚔️ ${loser}님과의 결투 승리! ${DICE_FACES[(iAmFrom ? r.fromRoll : r.accRoll) - 1]} vs ${DICE_FACES[(iAmFrom ? r.accRoll : r.fromRoll) - 1]} → +${(d.bet * 2).toLocaleString()}P`, d.bet >= 2000 ? 'big' : 'normal');
      maybeDropCard('결투 승리', 12);
    }
    showDuelResult(d, r, iWon);
  }
}

function showDuelResult(d, r, iWon) {
  const iAmFrom = d.fromUid === authUser.uid;
  const myRoll = iAmFrom ? r.fromRoll : r.accRoll;
  const theirRoll = iAmFrom ? r.accRoll : r.fromRoll;
  const opp = iAmFrom ? d.acceptor : d.from;
  const box = document.getElementById('duelResultStage');
  const modalOpen = !document.getElementById('miniGameModal').classList.contains('hidden');
  if (box && modalOpen) {
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="text-[11px] font-bold text-slate-400">vs ${esc(opp)} · 판돈 ${d.bet.toLocaleString()}P</div>
      <div class="flex items-center justify-center gap-6 my-2">
        <div><div class="text-[10px] text-slate-400">나</div><div class="duel-die text-5xl">🎲</div></div>
        <div class="text-lg font-black text-slate-500">VS</div>
        <div><div class="text-[10px] text-slate-400">${esc(opp)}</div><div class="duel-die text-5xl">🎲</div></div>
      </div>
      <div class="duel-verdict text-sm font-black opacity-0"></div>`;
    const dice = box.querySelectorAll('.duel-die');
    let n = 0;
    const t = setInterval(() => {
      dice[0].textContent = DICE_FACES[Math.floor(Math.random() * 6)];
      dice[1].textContent = DICE_FACES[Math.floor(Math.random() * 6)];
      if (++n >= 14) {
        clearInterval(t);
        dice[0].textContent = DICE_FACES[myRoll - 1];
        dice[1].textContent = DICE_FACES[theirRoll - 1];
        const v = box.querySelector('.duel-verdict');
        v.className = `duel-verdict text-sm font-black ${iWon ? 'text-amber-500' : 'text-rose-500'}`;
        v.textContent = iWon ? `🏆 승리! +${(d.bet * 2).toLocaleString()}P` : `😭 패배... -${d.bet.toLocaleString()}P`;
        if (iWon && window.confetti) confetti({ particleCount: 120 });
      }
    }, 70);
  } else {
    const tbox = document.getElementById('feedToastContainer');
    if (!tbox) return;
    const el = document.createElement('div');
    el.className = `feed-toast ${iWon ? 'feed-toast-big' : 'feed-toast-lose'}`;
    el.innerHTML = `<div class="text-[10px] font-black opacity-80">⚔️ 결투 결과 · vs ${esc(opp)}</div>
      <div class="text-sm font-black">${DICE_FACES[myRoll - 1]} vs ${DICE_FACES[theirRoll - 1]} — ${iWon ? `승리! +${(d.bet * 2).toLocaleString()}P` : `패배 -${d.bet.toLocaleString()}P`}</div>`;
    tbox.appendChild(el);
    setTimeout(() => el.classList.add('feed-toast-out'), 5000);
    setTimeout(() => el.remove(), 5700);
  }
}

async function createDuel() {
  if (!checkApprovalGuard()) return;
  const bet = parseInt(document.getElementById('duelBetInput').value, 10) || 0;
  const target = (document.getElementById('duelTargetInput').value || '').trim();
  if (bet < DUEL_MIN || bet > DUEL_MAX) return alert(`판돈은 ${DUEL_MIN}~${DUEL_MAX.toLocaleString()}P 사이로 걸 수 있어요.`);
  if (userPoints < bet) return alert('❌ 포인트가 부족해요!');
  if (target === currentUser.nickname) return alert('자기 자신과는 결투할 수 없어요 😅');
  const openMine = Object.values(allDuels).filter(d => d.status === 'open' && d.fromUid === authUser.uid).length;
  if (openMine >= 3) return alert('열어둔 결투가 이미 3개예요. 기존 결투가 끝나거나 취소한 뒤 열어주세요.');

  try {
    await db.ref('duels').push({
      from: currentUser.nickname, fromUid: authUser.uid,
      to: target, bet: bet, status: 'open',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    userPoints -= bet;
    updatePointsUI();
    postFeed('duel', target ? `${target}님에게 ${bet.toLocaleString()}P 결투를 신청했어요! ⚔️` : `${bet.toLocaleString()}P 걸고 결투장을 열었어요! 누구든 덤벼라 ⚔️`, 'normal');
  } catch (err) {
    alert('결투를 열지 못했어요: ' + err.message);
  }
}

async function acceptDuel(id) {
  if (!checkApprovalGuard()) return;
  const d = allDuels[id];
  if (!d || d.status !== 'open') return alert('이미 끝난 결투예요.');
  if (userPoints < d.bet) return alert(`❌ 판돈 ${d.bet.toLocaleString()}P가 부족해요!`);
  if (!confirm(`${d.from}님의 결투를 받을까요?\n판돈 ${d.bet.toLocaleString()}P (이기면 ${(d.bet * 2).toLocaleString()}P)`)) return;
  try {
    await db.ref(`duels/${id}`).update({
      status: 'accepted', acceptor: currentUser.nickname, acceptorUid: authUser.uid,
      acceptedAt: firebase.database.ServerValue.TIMESTAMP
    });
    userPoints -= d.bet;
    updatePointsUI();
  } catch (err) {
    alert('한 발 늦었어요! 다른 사람이 먼저 결투를 받았어요.');
  }
}

async function cancelDuel(id, silent = false) {
  const d = allDuels[id];
  if (!d || d.status !== 'open' || d.fromUid !== authUser.uid || mySettledDuels[id]) return;
  if (!silent && !confirm('결투를 취소하고 판돈을 돌려받을까요?')) return;
  try {
    await db.ref(`duels/${id}`).update({ status: 'cancelled' });
    mySettledDuels[id] = true;
    userPoints += d.bet;
    await db.ref(`user_points/${currentUser.nickname}/settledDuels/${id}`).set(true);
    updatePointsUI();
  } catch (err) {
    // 취소 직전에 누가 수락했다면 실패 → 정상적으로 결투 진행
    console.warn('결투 취소 실패:', err && err.message);
  }
}

function updateDuelBadge() {
  const el = document.getElementById('duelOpenBadge');
  if (!el || !authUser) return;
  const forMe = Object.values(allDuels).filter(d => d.status === 'open' && d.fromUid !== authUser.uid && (!d.to || d.to === currentUser.nickname) && Date.now() - (d.createdAt || 0) < DUEL_EXPIRE_MS).length;
  el.textContent = forMe;
  el.classList.toggle('hidden', forMe === 0);
}

function renderDuelArena() {
  const list = document.getElementById('duelOpenList');
  if (!list) return;
  const now = Date.now();
  const entries = Object.entries(allDuels)
    .filter(([, d]) => d && d.status === 'open' && now - (d.createdAt || 0) < DUEL_EXPIRE_MS)
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

  list.innerHTML = entries.length === 0
    ? '<div class="text-center text-slate-400 py-4 text-xs">열린 결투가 없어요. 먼저 도전장을 던져보세요!</div>'
    : entries.map(([id, d]) => {
        const mine = authUser && d.fromUid === authUser.uid;
        const forOther = d.to && d.to !== currentUser.nickname && !mine;
        const mins = Math.max(0, Math.ceil((DUEL_EXPIRE_MS - (now - d.createdAt)) / 60000));
        return `
          <div class="p-2.5 rounded-xl border ${mine ? 'bg-slate-50 border-slate-200' : 'bg-rose-50/60 border-rose-200'} flex items-center justify-between gap-2">
            <div class="min-w-0 text-left">
              <div class="text-xs font-black text-slate-800 truncate">⚔️ ${esc(d.from)} ${d.to ? `→ ${esc(d.to)}` : '→ 누구나'}</div>
              <div class="text-[10px] text-slate-500">판돈 <strong class="text-rose-600">${d.bet.toLocaleString()}P</strong> · 승자 ${(d.bet * 2).toLocaleString()}P · ${mins}분 남음</div>
            </div>
            ${mine ? `<button onclick="cancelDuel(${jsArg(id)})" class="shrink-0 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg text-[11px]">취소</button>`
              : forOther ? '<span class="shrink-0 text-[10px] font-bold text-slate-400">지정 결투</span>'
              : `<button onclick="acceptDuel(${jsArg(id)})" class="shrink-0 bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-1.5 rounded-lg text-[11px] shadow-sm">수락!</button>`}
          </div>`;
      }).join('');

  const hist = document.getElementById('duelHistoryList');
  if (hist && authUser) {
    const done = Object.entries(allDuels).filter(([, d]) => d && d.status === 'accepted' && isMyDuel(d)).sort((a, b) => (b[1].acceptedAt || 0) - (a[1].acceptedAt || 0)).slice(0, 5);
    Promise.all(done.map(async ([id, d]) => {
      const r = await duelResult(d, id);
      const iAmFrom = d.fromUid === authUser.uid;
      const won = (r.winner === 'from') === iAmFrom;
      return `<div class="flex items-center justify-between text-[11px] px-1"><span class="truncate">vs ${esc(iAmFrom ? d.acceptor : d.from)} ${DICE_FACES[(iAmFrom ? r.fromRoll : r.accRoll) - 1]}:${DICE_FACES[(iAmFrom ? r.accRoll : r.fromRoll) - 1]}</span><span class="font-black ${won ? 'text-amber-600' : 'text-rose-500'}">${won ? '+' + (d.bet * 2).toLocaleString() : '-' + d.bet.toLocaleString()}P</span></div>`;
    })).then(rows => { hist.innerHTML = rows.join('') || '<div class="text-center text-slate-300 text-[11px] py-1">아직 결투 기록이 없어요</div>'; });
  }

  const dl = document.getElementById('duelTargetList');
  if (dl) {
    dl.innerHTML = [...new Set(onlineNicknames)].filter(n => n !== currentUser.nickname).map(n => `<option value="${esc(n)}"></option>`).join('');
  }
}
