// 밥심 - 밥키우기 주간 시즌
//
// 매주 월요일 0시(한국 시간)에 새 시즌 시작.
// 이번 주에 도달한 "최고 강화 단계"로 순위를 매기고 (같으면 먼저 도달한 사람이 위)
// 다음 주에 접속하면 지난 시즌 1~3위가 보상(포인트 + 시즌 배지)을 직접 받아감.
//
// seasons/{주차}/{닉네임} = { maxLevel, at, uid, nickname, badge, color, symbol }
// 받은 보상: user_points/{닉네임}/seasonClaims/{주차} = true

const SEASON_REWARDS = [
  { rank: 1, points: 30000, label: '🥇 시즌 챔피언' },
  { rank: 2, points: 15000, label: '🥈 시즌 준우승' },
  { rank: 3, points: 7000,  label: '🥉 시즌 3위' }
];

let mySeasonBest = 0;
let mySeasonClaims = {};

function loadSeasonFromUser(val) {
  mySeasonClaims = Object.assign({}, (val && val.seasonClaims) || {});
}

// 강화 성공 시 호출: 이번 주 최고 기록이면 시즌 기록 갱신
function recordSeasonProgress(level) {
  if (!canSyncToCloud() || level <= mySeasonBest) return;
  mySeasonBest = level;
  db.ref(`seasons/${weekKey()}/${currentUser.nickname}`).set({
    uid: authUser.uid,
    nickname: currentUser.nickname,
    maxLevel: level,
    at: firebase.database.ServerValue.TIMESTAMP,
    badge: myNickBg, color: myNickColor, symbol: myNickSymbol
  }).catch(err => console.warn('시즌 기록 실패:', err && err.message));
}

function sortSeason(entries) {
  return Object.values(entries || {})
    .filter(e => e && e.nickname && typeof e.maxLevel === 'number')
    .sort((a, b) => (b.maxLevel - a.maxLevel) || ((a.at || 0) - (b.at || 0)));
}

// 로그인 후 1회: 이번 주 내 기록 불러오기 + 지난 시즌 보상 확인
async function initSeason() {
  if (!canSyncToCloud()) return;
  try {
    const mine = await db.ref(`seasons/${weekKey()}/${currentUser.nickname}`).once('value');
    mySeasonBest = (mine.val() && mine.val().maxLevel) || 0;
    if (currentEnhanceLevel > mySeasonBest) recordSeasonProgress(currentEnhanceLevel);

    const lastWeek = prevWeekKey();
    if (mySeasonClaims[lastWeek]) return;
    const snap = await db.ref(`seasons/${lastWeek}`).once('value');
    const ranked = sortSeason(snap.val());
    const myRank = ranked.findIndex(e => e.nickname === currentUser.nickname) + 1;
    const reward = SEASON_REWARDS.find(r => r.rank === myRank);
    if (!reward || ranked[myRank - 1].maxLevel <= 0) return;
    if (!canGainPoints(reward.points)) return; // 예산이 찰 때 다음 접속에서 지급

    mySeasonClaims[lastWeek] = true;
    await db.ref(`user_points/${currentUser.nickname}/seasonClaims/${lastWeek}`).set(true);
    addPoints(reward.points, `주간 시즌 ${reward.label}`);
    updatePointsUI();
    postFeed('season', `지난주 밥키우기 시즌 ${reward.label}! (+${ranked[myRank - 1].maxLevel}강) +${reward.points.toLocaleString()}P`, reward.rank === 1 ? 'legendary' : 'big');
    if (window.confetti) confetti({ particleCount: 250, spread: 140 });
    alert(`🏆 지난주 밥키우기 시즌 결과: ${reward.label}!\n최고 기록 +${ranked[myRank - 1].maxLevel}강\n\n보상: +${reward.points.toLocaleString()}P`);
  } catch (err) {
    console.warn('시즌 확인 실패:', err);
  }
}

function seasonTimeLeftText() {
  const nextMonday = new Date(weekKey() + 'T00:00:00+09:00').getTime() + 7 * 86400000;
  const ms = nextMonday - Date.now();
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}일 ${h}시간 남음` : `${h}시간 ${Math.floor((ms % 3600000) / 60000)}분 남음`;
}

// 랭킹 모달의 '주간 시즌' 탭
async function renderSeasonRanking(container, summaryEl, myPointEl) {
  const snap = await db.ref(`seasons/${weekKey()}`).once('value');
  const ranked = sortSeason(snap.val());
  const myIdx = ranked.findIndex(e => e.nickname === currentUser.nickname);
  if (summaryEl) summaryEl.textContent = myIdx >= 0 ? `이번 주 시즌 ${myIdx + 1}위 (최고 +${ranked[myIdx].maxLevel}강)` : '이번 주 기록 없음 — 강화에 도전해보세요!';
  if (myPointEl) myPointEl.textContent = seasonTimeLeftText();

  container.innerHTML = `
    <div class="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
      🗓️ <strong>${esc(weekKey())} 주 시즌</strong> · 이번 주 도달한 최고 강화 단계로 경쟁!<br>
      🏆 1위 30,000P · 2위 15,000P · 3위 7,000P + 전용 시즌 배지 (다음 주 접속 시 자동 지급)
    </div>` + (ranked.length === 0
      ? '<div class="text-center text-slate-400 py-6">아직 이번 주 기록이 없어요. 첫 주인공이 되어보세요!</div>'
      : ranked.map((e, i) => {
          const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}위`;
          const bowl = BOWL_EVOLUTION[Math.min(e.maxLevel, ENHANCE_MAX)];
          return `
            <div class="p-3 rounded-2xl border flex items-center justify-between ${i < 3 ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50 border-slate-200'}">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-black text-xs shrink-0">${medal}</span>
                ${nickHTML(e, 'text-xs truncate')}
              </div>
              <span class="font-black text-indigo-700 bg-white border border-indigo-200 px-2.5 py-0.5 rounded-xl text-xs shrink-0">${bowl ? bowl.icon : '🍚'} +${e.maxLevel}강</span>
            </div>`;
        }).join(''));
}

// ==========================================
// 🏅 시즌 배지 도감: 시즌마다 한정 배지가 생기면 여기에 등록
//  { id, cls, name, season, desc } — 지금은 아직 없음
// ==========================================
const SEASON_BADGE_BOOK = [];
function openSeasonBadgeBook() {
  const box = document.getElementById('seasonBadgeBookList');
  const owned = new Set((myInventory && myInventory.bgs) || []);
  const got = SEASON_BADGE_BOOK.filter(b => owned.has(b.cls)).length;
  const cnt = document.getElementById('seasonBadgeBookCount');
  if (cnt) cnt.textContent = `${got} / ${SEASON_BADGE_BOOK.length}`;
  if (box) box.innerHTML = SEASON_BADGE_BOOK.length === 0
    ? `<div class="col-span-full text-center py-10 space-y-2">
         <div class="text-4xl opacity-40">🏅</div>
         <div class="text-sm font-black text-slate-500">아직 등록된 시즌 배지가 없어요</div>
         <div class="text-[11px] text-slate-400">새 시즌이 열리면 그 시즌에만 얻을 수 있는 한정 배지가 이곳에 채워져요</div>
       </div>`
    : SEASON_BADGE_BOOK.map(b => {
        const has = owned.has(b.cls);
        return `<div class="p-3 rounded-2xl border ${has ? 'bg-white border-amber-300' : 'bg-slate-50 border-slate-200'} text-center space-y-1.5">
          <div class="text-[10px] font-black text-slate-400">${esc(b.season)}</div>
          <span class="${has ? safeClass(b.cls) : ''} text-xs inline-block ${has ? '' : 'text-slate-300 font-black'}">${has ? esc(b.name) : '???'}</span>
          <div class="text-[10px] text-slate-400">${esc(b.desc || '')}</div>
        </div>`;
      }).join('');
  document.getElementById('seasonBadgeBookModal').classList.remove('hidden');
}
function closeSeasonBadgeBook() { document.getElementById('seasonBadgeBookModal').classList.add('hidden'); }
