// 밥심 - 실시간 대박 전광판
//
// 누군가 고강화 성공/파괴, 잭팟, 전설 카드, 결투 승리 등을 하면
// game_feed 에 기록 → 모든 접속자 화면 상단 전광판에 흐르고, 큰 사건은 토스트로 뜸

const FEED_LEVELS = { normal: 1, big: 2, legendary: 3 };
let feedStartedAt = Date.now();
let feedItems = [];
let feedTickerIdx = 0;

// 전광판에는 '중요한 소식'만 올림 (important = true 인 것만)
//  - +20강 달성, 반찬 도감 완성, 슬롯 초특급 잭팟, 1억 배지 구매
//  나머지 호출은 조용히 무시 (예전 코드 호환)
function postFeed(kind, text, level = 'normal', important = false) {
  if (!important) return;
  if (!canSyncToCloud()) return;
  db.ref('game_feed').push({
    uid: authUser.uid,
    nickname: currentUser.nickname,
    kind: kind,
    text: String(text).slice(0, 120),
    level: level,
    important: true,
    badge: myNickBg,
    color: myNickColor,
    symbol: myNickSymbol,
    ts: firebase.database.ServerValue.TIMESTAMP
  }).catch(err => console.warn('전광판 기록 실패:', err && err.message));
}

function attachFeedListener() {
  db.ref('game_feed').limitToLast(30).on('child_added', snap => {
    const f = snap.val();
    if (!f || !f.text || f.important !== true) return; // 예전 잡다한 소식은 표시 안 함
    feedItems.push(f);
    if (feedItems.length > 30) feedItems.shift();
    renderFeedTicker(f);
    // 접속 이후에 생긴 큰 사건만 토스트로 (지난 기록은 전광판에만)
    const isNew = (f.ts || 0) >= feedStartedAt - 5000;
    const isMine = authUser && f.uid === authUser.uid;
    if (isNew && !isMine && FEED_LEVELS[f.level] >= FEED_LEVELS.big) showFeedToast(f);
  }, onDbError);

  // 최근 소식을 5초마다 돌려가며 보여줌
  setInterval(() => {
    if (feedItems.length === 0) return;
    feedTickerIdx = (feedTickerIdx + 1) % feedItems.length;
    renderFeedTicker(feedItems[feedItems.length - 1 - feedTickerIdx], true);
  }, 5000);
}

function feedLine(f) {
  return `${nickHTML(f, 'text-[11px]')} <span class="ml-1">${esc(f.text)}</span>`;
}

function renderFeedTicker(f, rotating = false) {
  const el = document.getElementById('feedTickerText');
  if (!el || !f) return;
  if (!rotating) feedTickerIdx = 0;
  el.classList.remove('feed-pop');
  void el.offsetWidth; // 애니메이션 재시작
  el.innerHTML = feedLine(f);
  el.classList.add('feed-pop');
  const wrap = document.getElementById('feedTicker');
  if (wrap) {
    wrap.classList.remove('hidden');
    wrap.dataset.level = f.level || 'normal';
  }
}

function showFeedToast(f) {
  const box = document.getElementById('feedToastContainer');
  if (!box) return;
  const t = document.createElement('div');
  const legendary = f.level === 'legendary';
  t.className = `feed-toast ${legendary ? 'feed-toast-legendary' : 'feed-toast-big'}`;
  t.innerHTML = `<div class="text-[10px] font-black opacity-80">${legendary ? '🌟 전설의 순간' : '📢 대박 소식'}</div><div class="text-xs font-bold leading-snug">${feedLine(f)}</div>`;
  box.appendChild(t);
  if (legendary && window.confetti) confetti({ particleCount: 120, spread: 100, origin: { y: 0.2 } });
  setTimeout(() => t.classList.add('feed-toast-out'), 4500);
  setTimeout(() => t.remove(), 5200);
}

function openFeedHistory() {
  const box = document.getElementById('feedHistoryList');
  if (box) {
    box.innerHTML = feedItems.length === 0
      ? '<div class="text-center text-slate-400 py-6">아직 소식이 없어요</div>'
      : [...feedItems].reverse().map(f => `
        <div class="p-2.5 rounded-xl border ${f.level === 'legendary' ? 'bg-amber-50 border-amber-300' : f.level === 'big' ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}">
          <div class="text-xs">${feedLine(f)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${f.ts ? new Date(f.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
        </div>`).join('');
  }
  document.getElementById('feedHistoryModal').classList.remove('hidden');
}
function closeFeedHistory() { document.getElementById('feedHistoryModal').classList.add('hidden'); }
