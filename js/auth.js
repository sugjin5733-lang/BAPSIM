// 밥심 - 로그인, 회원 상태, 포인트 동기화, 접속자
//
// 로그인 구조
//  - 처음 들어오면 익명 로그인 → 식단/랭킹/채팅 "보기"만 가능
//  - [구글로 로그인] → user_uids/{uid} 에 연결된 닉네임이 있으면 바로 회원으로 접속
//  - 연결된 닉네임이 없으면 가입(새 닉네임) 또는 기존 닉네임 연결을 "요청"
//    → signup_requests/{uid} 에 저장 → 관리자가 승인하면 닉네임과 구글 계정이 연결됨
//  - 관리자는 구글 계정으로 판별 (실제 권한은 Firebase 보안 규칙이 강제)

// 관리자 구글 계정 (공개 저장소에 메일 주소를 그대로 두지 않도록 해시로 보관)
const ADMIN_EMAIL_HASH = 'd3e12dd650d3b989a22a4d59f6ceb56a9cadfe3e7e3fd5583bc30544d37c8fa5';

let authUser = null;        // 현재 Firebase 사용자 (익명 또는 구글)
let isAdmin = false;
let cloudReady = false;     // 내 user_points 첫 값을 받아온 뒤에만 서버에 쓰기
let myPointsRef = null;
let myRequestRef = null;
let myRequest = null;       // 승인 대기 중인 내 가입/연결 요청
let presenceRefs = null;
let onlineNicknames = [];
let lastServerState = {};

function isGoogleUser() {
  return !!(authUser && !authUser.isAnonymous);
}

function canSyncToCloud() {
  return cloudReady && isUserApproved && currentUser.nickname !== GUEST_NICK;
}

function checkApprovalGuard() {
  if (!isGoogleUser()) {
    alert("구글 계정으로 로그인한 회원만 이용할 수 있어요.");
    openAuthModal();
    return false;
  }
  if (currentUser.nickname === GUEST_NICK) {
    if (myRequest) {
      alert(`🔒 [${myRequest.nickname}] 승인 대기 중입니다.\n관리자가 승인하면 바로 이용할 수 있어요.`);
    } else {
      alert("닉네임 가입(또는 기존 닉네임 연결) 요청을 먼저 보내주세요.");
      openAuthModal();
    }
    return false;
  }
  if (!isUserApproved) {
    alert("🔒 관리자 회원 승인 대기 중입니다.\n관리자가 승인한 후 이용하실 수 있습니다.");
    return false;
  }
  return true;
}

// ==========================================
// 로그인 / 로그아웃
// ==========================================
function isInAppBrowser() {
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|everytimeApp|DaumApps/i.test(navigator.userAgent);
}

async function signInWithGoogle() {
  if (isInAppBrowser()) {
    alert("카카오톡/네이버 등 앱 안의 브라우저에서는 구글이 로그인을 막아요.\n\n오른쪽 위 메뉴에서 [다른 브라우저로 열기](크롬/사파리)를 선택한 뒤 다시 로그인해주세요.");
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await firebase.auth().signInWithPopup(provider);
    closeAuthModal();
  } catch (err) {
    console.error('구글 로그인 실패:', err);
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
    if (err.code === 'auth/popup-blocked') {
      alert("팝업이 차단되었어요. 주소창 오른쪽의 팝업 차단 아이콘에서 [항상 허용]을 누른 뒤 다시 시도해주세요.");
    } else if (err.code === 'auth/unauthorized-domain') {
      alert("이 주소에서는 아직 구글 로그인이 허용되지 않았어요. (관리자: Firebase 승인된 도메인 설정 필요)");
    } else if (err.code === 'auth/operation-not-allowed') {
      alert("구글 로그인이 아직 켜져 있지 않아요. (관리자: Firebase 로그인 방법에서 Google 사용 설정 필요)");
    } else {
      alert("로그인 중 오류가 발생했어요: " + (err.message || err));
    }
  }
}

async function signOutUser() {
  if (!confirm("로그아웃 하시겠어요?")) return;
  await firebase.auth().signOut();
  closeAuthModal();
}

// 로그인 상태가 바뀔 때마다 호출 (main.js의 onAuthStateChanged)
async function handleAuthChange(user) {
  detachUserListeners();
  authUser = user;
  isAdmin = false;
  myRequest = null;
  resetToGuestState();

  if (!user || user.isAnonymous) {
    updateAccountUI();
    return;
  }

  isAdmin = !!(user.emailVerified && user.email && (await sha256(user.email.toLowerCase())) === ADMIN_EMAIL_HASH);

  try {
    const mapSnap = await db.ref(`user_uids/${user.uid}`).once('value');
    if (mapSnap.exists()) {
      bindNickname(String(mapSnap.val()));
      return;
    }
    // 아직 닉네임이 연결되지 않은 구글 계정 → 내 요청 상태를 실시간으로 지켜봄
    myRequestRef = db.ref(`signup_requests/${user.uid}`);
    myRequestRef.on('value', async (snap) => {
      myRequest = snap.val();
      if (!myRequest) {
        // 요청이 사라짐 = 승인(연결 생성) 또는 거절
        const again = await db.ref(`user_uids/${user.uid}`).once('value');
        if (again.exists()) {
          myRequestRef.off(); myRequestRef = null;
          bindNickname(String(again.val()));
          return;
        }
      }
      updateAccountUI();
    }, onDbError);
    updateAccountUI();
    openAuthModal(); // 처음 로그인한 사람에게 가입/연결 화면을 바로 보여줌
  } catch (err) {
    onDbError(err);
  }
}

function detachUserListeners() {
  if (myPointsRef) { myPointsRef.off(); myPointsRef = null; }
  if (myRequestRef) { myRequestRef.off(); myRequestRef = null; }
  if (typeof renameRef !== 'undefined' && renameRef) { renameRef.off(); renameRef = null; myRenameRequest = null; }
  if (presenceRefs) {
    presenceRefs.connected.off();
    presenceRefs.mine.onDisconnect().cancel();
    presenceRefs.mine.remove().catch(() => {});
    presenceRefs = null;
  }
}

function resetToGuestState() {
  cloudReady = false;
  lastServerState = {};
  currentUser = { nickname: GUEST_NICK };
  isUserApproved = false;
  userPoints = 0;
  serverPoints = 0;
  myOwed = 0;
  pendingLog = [];
  myMining = { date: '', earned: 0 };
  myBudget = 0;
  myBudgetAt = null;
  currentEnhanceLevel = 0;
  myNickBg = 'nb-none';
  myNickColor = '';
  myNickSymbol = '';
  myInventory = { colors: [], bgs: ['nb-none'], symbols: [] };
  loadGameStateFromUser({});
  updatePointsUI(false);
  if (typeof updateEnhanceUI === 'function') updateEnhanceUI();
}

// 게임 관련 내 데이터 (카드, 강화 아이템, 시즌 보상, 결투/예측 정산 기록)
function loadGameStateFromUser(val) {
  loadCardsFromUser(val);
  loadItemsFromUser(val);
  loadSeasonFromUser(val);
  loadDuelSettlementsFromUser(val);
  loadBetsFromUser(val);
  if (typeof loadJackpotFromUser === "function") loadJackpotFromUser(val);
}

function bindNickname(nick) {
  currentUser = { nickname: nick };
  attachUserPointListener();
  attachRenameRequestListener();
  updateAccountUI();
}

// ==========================================
// 가입 / 기존 닉네임 연결 요청
// ==========================================
function isValidNickname(nickname) {
  return /^[가-힣a-zA-Z0-9]{1,20}$/.test(nickname);
}

async function submitSignupRequest() {
  if (!isGoogleUser()) return signInWithGoogle();
  const nick = document.getElementById('signupNicknameInput').value.trim();
  const type = document.querySelector('input[name="signupType"]:checked')?.value || 'new';
  const btn = document.getElementById('signupSubmitBtn');

  if (!nick) return alert('닉네임을 입력해주세요.');
  if (!isValidNickname(nick)) return alert('⚠️ 닉네임은 한글, 영문, 숫자로 20자 이내만 가능해요.');
  if (nick === GUEST_NICK) return alert('사용할 수 없는 닉네임이에요.');

  btn.disabled = true;
  try {
    const [banSnap, userSnap] = await Promise.all([
      db.ref(`banned_users/${nick}`).once('value'),
      db.ref(`user_points/${nick}`).once('value')
    ]);
    if (banSnap.exists()) return alert(`⛔ [${nick}] 은(는) 운영자에 의해 차단된 닉네임입니다.`);

    if (type === 'new' && userSnap.exists()) {
      return alert(`[${nick}] 은(는) 이미 있는 닉네임이에요.\n본인 닉네임이라면 위에서 [기존 회원이에요]를 선택해주세요.`);
    }
    if (type === 'claim' && !userSnap.exists()) {
      return alert(`[${nick}] 닉네임을 찾을 수 없어요. 철자를 확인하거나 [처음 가입해요]를 선택해주세요.`);
    }

    await db.ref(`signup_requests/${authUser.uid}`).set({
      uid: authUser.uid,
      nickname: nick,
      type: type,
      email: authUser.email || '',
      displayName: authUser.displayName || '',
      createdAt: Date.now()
    });

    // 관리자 본인은 바로 승인
    if (isAdmin) {
      await adminApproveRequest(authUser.uid, true);
      return;
    }
    alert(type === 'claim'
      ? `✅ 기존 닉네임 [${nick}] 연결 요청을 보냈어요.\n관리자가 확인하면 기존 포인트·아이템 그대로 이용할 수 있어요.`
      : `✅ [${nick}] 가입 요청을 보냈어요.\n관리자가 승인하면 바로 이용할 수 있어요.`);
  } catch (err) {
    console.error('가입 요청 실패:', err);
    alert('요청 중 오류가 발생했어요: ' + (err.message || err));
  } finally {
    btn.disabled = false;
  }
}

async function cancelSignupRequest() {
  if (!authUser || !confirm('승인 요청을 취소할까요?')) return;
  await db.ref(`signup_requests/${authUser.uid}`).remove();
}

// ==========================================
// 계정 화면 (프로필 버튼)
// ==========================================
function openAuthModal() {
  updateAccountUI();
  document.getElementById('authModal').classList.remove('hidden');
}
function closeAuthModal() { document.getElementById('authModal').classList.add('hidden'); }

function updateAccountUI() {
  const views = ['authViewGuest', 'authViewSignup', 'authViewPending', 'authViewMember'];
  let show = 'authViewGuest';
  if (isGoogleUser()) {
    if (currentUser.nickname !== GUEST_NICK) show = 'authViewMember';
    else if (myRequest) show = 'authViewPending';
    else show = 'authViewSignup';
  }
  views.forEach(v => document.getElementById(v)?.classList.toggle('hidden', v !== show));

  const email = authUser && authUser.email ? authUser.email : '';
  document.querySelectorAll('.authEmailText').forEach(el => el.textContent = email);

  const pendNick = document.getElementById('authPendingNick');
  if (pendNick && myRequest) pendNick.textContent = myRequest.nickname;
  const pendType = document.getElementById('authPendingType');
  if (pendType && myRequest) pendType.textContent = myRequest.type === 'claim' ? '기존 닉네임 연결' : '신규 가입';

  const memberNick = document.getElementById('authMemberNick');
  if (memberNick) memberNick.textContent = currentUser.nickname;
  const memberStatus = document.getElementById('authMemberStatus');
  if (memberStatus) memberStatus.textContent = isUserApproved ? '승인된 회원' : '승인 대기 중';

  document.getElementById('authAdminBtn')?.classList.toggle('hidden', !isAdmin);

  // 헤더 프로필 버튼
  const pText = document.getElementById('userProfileText');
  if (pText) {
    if (!isGoogleUser()) pText.textContent = '로그인';
    else if (currentUser.nickname !== GUEST_NICK) pText.textContent = currentUser.nickname;
    else pText.textContent = myRequest ? '승인 대기' : '가입하기';
  }

  // 상단 승인 대기 배너
  const banner = document.getElementById('pendingApprovalBanner');
  const bannerNick = document.getElementById('pendingBannerNick');
  const pendingName = myRequest ? myRequest.nickname : (currentUser.nickname !== GUEST_NICK && cloudReady && !isUserApproved ? currentUser.nickname : null);
  if (banner) {
    banner.classList.toggle('hidden', !pendingName);
    if (bannerNick && pendingName) bannerNick.textContent = pendingName;
  }
}

// ==========================================
// 내 회원 정보 실시간 동기화
// ==========================================
// ==========================================
// 포인트 순이익 예산 (스크립트로 포인트를 찍어내는 것 방지)
//  - 예산은 초당 BUDGET_RATE 씩 차오르고 최대 BUDGET_CAP
//  - 포인트가 순수하게 늘면 그만큼 예산이 줄고, 잃으면 다시 늘어남
//  - 같은 계산을 Firebase 보안 규칙이 서버 시간으로 검사하므로 콘솔 조작으로 우회 불가
// ==========================================
const BUDGET_RATE = 20;        // 초당 P (시간당 72,000)
const BUDGET_CAP = 300000;     // 최대 예산 (세트 완성 20만P 같은 큰 보상도 통과)
const BUDGET_INIT = 50000;     // 처음 한 번 주어지는 예산
let serverPoints = 0;          // 서버에 저장된 마지막 포인트
let myBudget = 0, myBudgetAt = null;
let serverTimeOffset = 0;
db.ref('.info/serverTimeOffset').on('value', s => { serverTimeOffset = s.val() || 0; });

function availableBudget() {
  if (isAdmin) return Infinity; // 관리자는 규칙에서도 예외
  if (myBudgetAt == null) return 0;
  const estNow = Date.now() + serverTimeOffset - 2000; // 서버 시각보다 2초 보수적으로
  return Math.min(BUDGET_CAP, (myBudget || 0) + BUDGET_RATE * Math.max(0, estNow - myBudgetAt) / 1000);
}

// 예전엔 한도를 넘으면 보상을 통째로 되돌렸는데(= 미지급), 이제는 넘친 만큼 '보류 포인트'로
// 서버에 저장해두고 한도가 차는 대로 자동 지급하므로 항상 true
function canGainPoints(amount) { return true; }
function budgetWaitText(amount) { return ''; }

async function initBudgetIfNeeded() {
  if (myBudgetAt != null || !canSyncToCloud()) return;
  try {
    await db.ref(`user_points/${currentUser.nickname}`).update({
      points: serverPoints, budget: BUDGET_INIT, budgetAt: firebase.database.ServerValue.TIMESTAMP
    });
  } catch (err) {
    console.warn('예산 초기화 실패:', err && err.message);
  }
}

// ==========================================
// 포인트 변동은 전부 addPoints 로 → 내역(point_logs)에 기록되어
// "포인트 안 들어왔다" 같은 문의를 회원/관리자가 직접 확인할 수 있음
// ==========================================
let pendingLog = [];     // 아직 서버에 안 올라간 변동 [{d, r}]
let myOwed = 0;          // 보류 포인트 (한도 초과분, 자동 지급 대기)
let myMining = { date: '', earned: 0 };
const MINING_DAILY_CAP = 5000; // 무료 채굴 게임(광클/스피드/암기) 하루 최대

function addPoints(delta, reason) {
  delta = Math.round(Number(delta) || 0);
  if (!delta) return;
  userPoints += delta;
  pendingLog.push({ d: delta, r: String(reason || '기타').slice(0, 60) });
}

// 무료 채굴 게임 보상: 하루 한도 안에서만 지급, 실제 지급액을 돌려줌
function grantMining(amount, reason) {
  const today = todayKey();
  if (myMining.date !== today) myMining = { date: today, earned: 0 };
  const got = Math.max(0, Math.min(Math.round(amount), MINING_DAILY_CAP - myMining.earned));
  myMining.earned += got;
  if (got > 0) addPoints(got, reason);
  const ml = document.getElementById('miningLeftText');
  if (ml && ml.textContent) ml.textContent = `⛏️ 오늘 무료 채굴 남은 한도 ${miningLeftToday().toLocaleString()}P`;
  return got;
}
function miningLeftToday() {
  return myMining.date === todayKey() ? Math.max(0, MINING_DAILY_CAP - myMining.earned) : MINING_DAILY_CAP;
}
function miningNote(asked, got) {
  if (got >= asked) return '';
  return got === 0
    ? `\n⛏️ 오늘 무료 채굴 한도(${MINING_DAILY_CAP.toLocaleString()}P)를 다 채웠어요. 내일 다시 도전하세요!`
    : `\n⛏️ 오늘 채굴 한도(${MINING_DAILY_CAP.toLocaleString()}P)에 도달해서 ${got}P만 지급됐어요.`;
}

function syncUserPointToCloud() {
  if (!canSyncToCloud()) return;
  const nick = currentUser.nickname;
  const base = `user_points/${nick}`;
  const updates = {};
  const put = (k, v) => { updates[`${base}/${k}`] = v; };
  put('enhanceLevel', currentEnhanceLevel);
  put('badge', myNickBg);
  put('color', myNickColor);
  put('symbol', myNickSymbol);
  put('inventory', myInventory);
  put('mining', myMining);
  put('updatedAt', Date.now());

  if (userPoints !== serverPoints || myOwed !== (lastServerState.owed || 0)) {
    if (myBudgetAt == null && !isAdmin) { initBudgetIfNeeded(); return; }
    const avail = availableBudget();
    let delta = userPoints - serverPoints;
    if (delta > Math.floor(avail)) {
      // 한도 초과분은 버리지 않고 보류 → 자동 지급
      const excess = delta - Math.floor(avail);
      userPoints -= excess;
      myOwed += excess;
      pendingLog.push({ d: -excess, r: '⏳ 보류 (한도 초과분, 자동 지급 예정)' });
      showOwedToast(excess);
      delta = userPoints - serverPoints;
      updatePointsUI(false);
    }
    put('points', userPoints);
    put('budget', Math.floor(Math.min(BUDGET_CAP, avail - delta)));
    put('budgetAt', firebase.database.ServerValue.TIMESTAMP);
    put('owed', myOwed);
  }

  if (pendingLog.length) {
    // 같은 사유는 하나로 합쳐서 기록
    const merged = [];
    pendingLog.forEach(e => {
      const last = merged[merged.length - 1];
      if (last && last.r === e.r) last.d += e.d; else merged.push({ d: e.d, r: e.r });
    });
    merged.filter(e => e.d !== 0).forEach(e => {
      const key = db.ref(`point_logs/${nick}`).push().key;
      updates[`point_logs/${nick}/${key}`] = { d: e.d, r: e.r, bal: userPoints, ts: firebase.database.ServerValue.TIMESTAMP };
    });
    pendingLog = [];
    maybePruneLogs(nick);
  }
  db.ref().update(updates).catch(err => console.warn('포인트 저장 거부됨:', err && err.message));
}

// 2주 지난 내역은 가끔 정리 (DB 용량 관리)
let logWrites = 0;
function maybePruneLogs(nick) {
  if (++logWrites % 40 !== 1) return;
  const cutoff = Date.now() + serverTimeOffset - 15 * 86400000;
  db.ref(`point_logs/${nick}`).orderByChild('ts').endAt(cutoff).limitToFirst(100).once('value').then(snap => {
    const del = {};
    snap.forEach(c => { del[c.key] = null; });
    if (Object.keys(del).length) db.ref(`point_logs/${nick}`).update(del).catch(() => {});
  }).catch(() => {});
}

// 보류 포인트를 한도가 차는 대로 지급 (30초마다)
setInterval(() => {
  if (!canSyncToCloud() || myOwed <= 0 || (myBudgetAt == null && !isAdmin)) return;
  const room = Math.floor(availableBudget() - (userPoints - serverPoints));
  const pay = Math.min(myOwed, room);
  if (pay < Math.min(myOwed, 300)) return; // 너무 잘게 쪼개지 않기
  myOwed -= pay;
  addPoints(pay, '⏳ 보류 포인트 지급');
  updatePointsUI();
}, 30000);

function showOwedToast(excess) {
  const box = document.getElementById('feedToastContainer');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'feed-toast feed-toast-plain';
  const hours = excess / BUDGET_RATE / 3600;
  el.innerHTML = `<div class="text-[10px] font-black text-slate-500">⏳ 보류 포인트</div>
    <div class="text-xs font-bold">짧은 시간에 너무 많이 벌어서 <strong>${excess.toLocaleString()}P</strong>는 보류됐어요.<br>
    ${hours < 1 ? `약 ${Math.max(1, Math.ceil(hours * 60))}분` : `약 ${Math.ceil(hours)}시간`} 안에 자동으로 들어와요. (사라지지 않아요!)</div>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('feed-toast-out'), 7000);
  setTimeout(() => el.remove(), 7700);
}

// ==========================================
// 포인트 내역 보기 (회원: 자기 것 / 관리자: 아무나)
// ==========================================
async function openPointLog(nick) {
  nick = nick || currentUser.nickname;
  const modal = document.getElementById('pointLogModal');
  const list = document.getElementById('pointLogList');
  document.getElementById('pointLogTitle').textContent = `📜 ${nick} 포인트 내역`;
  list.innerHTML = '<div class="text-center text-slate-400 py-6">불러오는 중...</div>';
  modal.classList.remove('hidden');
  try {
    const [logSnap, userSnap] = await Promise.all([
      db.ref(`point_logs/${nick}`).limitToLast(80).once('value'),
      db.ref(`user_points/${nick}`).once('value')
    ]);
    const u = userSnap.val() || {};
    const rows = [];
    logSnap.forEach(c => { rows.push(c.val()); });
    rows.reverse();
    const owed = Number(u.owed) || 0;
    const mining = u.mining && u.mining.date === todayKey() ? u.mining.earned : 0;
    document.getElementById('pointLogSummary').innerHTML = `
      현재 <strong>${(u.points || 0).toLocaleString()}P</strong>
      ${owed > 0 ? ` · <span class="text-amber-600 font-black">⏳ 보류 ${owed.toLocaleString()}P (자동 지급 대기)</span>` : ''}
      · 오늘 무료 채굴 ${mining.toLocaleString()} / ${MINING_DAILY_CAP.toLocaleString()}P`;
    list.innerHTML = rows.length === 0
      ? '<div class="text-center text-slate-400 py-6">아직 기록된 내역이 없어요 (이번 업데이트 이후부터 기록돼요)</div>'
      : rows.map(e => `
        <div class="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 text-xs">
          <div class="min-w-0">
            <div class="font-bold text-slate-800 truncate">${esc(e.r)}</div>
            <div class="text-[10px] text-slate-400">${e.ts ? new Date(e.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-black ${e.d >= 0 ? 'text-emerald-600' : 'text-rose-500'}">${e.d >= 0 ? '+' : ''}${Number(e.d).toLocaleString()}P</div>
            <div class="text-[10px] text-slate-400">잔액 ${Number(e.bal || 0).toLocaleString()}</div>
          </div>
        </div>`).join('');
  } catch (err) {
    list.innerHTML = `<div class="text-center text-rose-500 py-6">내역을 불러오지 못했어요: ${esc(err.message)}</div>`;
  }
}
function closePointLog() { document.getElementById('pointLogModal').classList.add('hidden'); }

function attachUserPointListener() {
  if (myPointsRef) myPointsRef.off();
  const nick = currentUser.nickname;
  myPointsRef = db.ref(`user_points/${nick}`);

  myPointsRef.on('value', (snap) => {
    const val = snap.val();

    // 삭제/차단되었거나, 관리자가 다른 구글 계정으로 연결을 옮긴 경우
    if (!val || (val.uid && authUser && val.uid !== authUser.uid)) {
      if (myPointsRef) { myPointsRef.off(); myPointsRef = null; } // 같은 알림이 여러 번 처리되지 않도록 바로 끊음
      // 닉네임 변경 승인으로 데이터가 새 닉네임으로 옮겨진 경우면 그대로 다시 연결
      db.ref(`user_uids/${authUser.uid}`).once('value').then(m => {
        const newNick = m.val();
        if (!val && newNick && newNick !== nick) {
          detachUserListeners();
          cloudReady = false;
          lastServerState = {};
          bindNickname(String(newNick));
          attachRenameRequestListener();
          if (window.confetti) confetti({ particleCount: 120 });
          alert(`✏️ 닉네임이 [${nick}] → [${newNick}] 로 바뀌었어요!`);
        } else {
          alert("회원 정보가 삭제되었거나 운영자에 의해 연결이 해제되었습니다.");
          firebase.auth().signOut();
        }
      }).catch(() => firebase.auth().signOut());
      return;
    }

    if (val.resetInventory === true) {
      myInventory = { colors: [], bgs: ['nb-none'], symbols: [] };
      myNickBg = 'nb-none';
      myNickColor = '';
      myNickSymbol = '';
      updatePointsUI(false);
      renderShopUI();
      alert("⚠️ 관리자에 의해 보유 중인 모든 치장 아이템이 몰수 및 삭제 처리되었습니다.");
      db.ref(`user_points/${nick}/resetInventory`).remove();
      return;
    }

    // ⚠️ 서버 값으로 덮어쓰는 건 "서버에서 그 값이 실제로 바뀌었을 때"만.
    // (예: 포인트를 더한 직후 카드만 저장하면, 서버가 바뀌기 전 포인트를 다시 알려주는데
    //  그걸로 덮어쓰면 방금 더한 포인트가 사라지는 버그가 있었음)
    const firstLoad = !cloudReady;
    const srvInventory = {
      colors: toArr(val.inventory && val.inventory.colors),
      bgs: val.inventory && val.inventory.bgs ? toArr(val.inventory.bgs) : ['nb-none'],
      symbols: toArr(val.inventory && val.inventory.symbols)
    };
    const srv = {
      points: typeof val.points === 'number' ? val.points : 0,
      enhanceLevel: typeof val.enhanceLevel === 'number' ? val.enhanceLevel : 0,
      inventory: JSON.stringify(srvInventory),
      badge: val.badge || 'nb-none', color: val.color || '', symbol: val.symbol || '',
      owed: Math.max(0, Number(val.owed) || 0),
      mining: JSON.stringify(val.mining || {})
    };
    const changed = (k) => firstLoad || lastServerState[k] !== srv[k];
    if (changed('inventory')) myInventory = srvInventory;
    if (changed('points')) userPoints = srv.points;
    if (changed('enhanceLevel')) currentEnhanceLevel = srv.enhanceLevel;
    if (changed('badge')) myNickBg = srv.badge;
    if (changed('color')) myNickColor = srv.color;
    if (changed('symbol')) myNickSymbol = srv.symbol;
    if (changed('owed')) myOwed = srv.owed;
    if (changed('mining')) myMining = Object.assign({ date: '', earned: 0 }, val.mining || {});
    lastServerState = srv;

    const wasApproved = isUserApproved;
    isUserApproved = (val.status === 'approved' || val.approved === true);
    if (cloudReady && !wasApproved && isUserApproved) {
      if (window.confetti) confetti({ particleCount: 150 });
      alert(`🎉 [${nick}] 님의 계정이 승인되었습니다!\n이제 모든 서비스를 자유롭게 이용하실 수 있습니다.`);
    }

    serverPoints = srv.points;
    myBudget = typeof val.budget === 'number' ? val.budget : 0;
    myBudgetAt = typeof val.budgetAt === 'number' ? val.budgetAt : null;
    loadGameStateFromUser(val);
    restoreSetCosmetics(); // 놓친 세트 배지/칭호 복구 → 아래 pending 검사에서 자동 저장

    cloudReady = true;
    // 아직 서버에 안 올라간 내 변경(방금 얻은 포인트 등)이 있으면 이어서 저장
    const pending = userPoints !== srv.points || myOwed !== srv.owed || JSON.stringify(myInventory) !== srv.inventory
      || myNickBg !== srv.badge || myNickColor !== srv.color || myNickSymbol !== srv.symbol;
    updatePointsUI(pending);
    updateEnhanceUI();
    updateAccountUI();
    if (firstLoad) {
      initBudgetIfNeeded();
      initPresenceSystem();
      renderRankingsData();
      syncFromGoogleSheet(false);
      initSeason();
      checkWeeklyCardReset();
      settleMyDuels();
      settleMyBets();
      renderDuelArena();
    }
  }, onDbError);
}

function updatePointsUI(shouldPushToCloud = true) {
  const headerPoint = document.getElementById('headerPointDisplay');
  const chatPoint = document.getElementById('chatPointDisplay');
  const shopPoint = document.getElementById('shopCurrentPoints');

  if (headerPoint) headerPoint.textContent = myOwed > 0 ? `${userPoints.toLocaleString()}P ⏳+${myOwed.toLocaleString()}` : `${userPoints.toLocaleString()}P`;
  if (chatPoint) chatPoint.textContent = `보유: ${userPoints.toLocaleString()}P`;
  if (shopPoint) shopPoint.textContent = `${userPoints.toLocaleString()}P`;

  updatePreviewBox();
  if (shouldPushToCloud) syncUserPointToCloud();
}

function updatePreviewBox() {
  const prefixEl = document.getElementById('previewSymbolPrefix');
  const suffixEl = document.getElementById('previewSymbolSuffix');
  const textEl = document.getElementById('previewNicknameText');

  if (prefixEl && suffixEl && textEl) {
    prefixEl.textContent = myNickSymbol ? `${myNickSymbol} ` : '';
    suffixEl.textContent = myNickSymbol ? ` ${myNickSymbol}` : '';
    textEl.textContent = currentUser.nickname;
    textEl.className = `${safeClass(myNickBg)} text-xs inline-block`;
    textEl.style.color = safeColor(myNickColor);
  }
}

// ==========================================
// 실시간 접속자
// ==========================================
function initPresenceSystem() {
  if (!canSyncToCloud()) return;
  const mine = db.ref(`online_users/${currentUser.nickname}`);
  const connected = db.ref('.info/connected');
  presenceRefs = { mine, connected };

  connected.on('value', (snap) => {
    if (snap.val() === true) {
      mine.onDisconnect().remove();
      mine.set({
        nickname: currentUser.nickname,
        badge: myNickBg,
        symbol: myNickSymbol,
        color: myNickColor,
        lastSeen: Date.now()
      }).catch(() => {});
    }
  });
}

function attachOnlineUsersListener() {
  db.ref('online_users').on('value', (snap) => {
    const userList = Object.values(snap.val() || {});
    const count = userList.length;
    onlineNicknames = userList.map(u => u && u.nickname).filter(Boolean);

    const badge = document.getElementById('onlineCountBadge');
    if (badge) badge.textContent = `${count}명 접속 중`;
    const mobileBadge = document.getElementById('mobileOnlineBadge');
    if (mobileBadge) mobileBadge.textContent = `● ${count}명 접속 중`;

    const container = document.getElementById('onlineUserListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (count === 0) {
      container.innerHTML = '<div class="text-center text-slate-400 py-3 text-[11px]">접속자가 없습니다.</div>';
      return;
    }

    userList.forEach(u => {
      const item = document.createElement('div');
      item.className = "flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-50 border border-slate-100";
      item.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
        ${nickHTML(u, 'text-[11px] truncate')}
      `;
      container.appendChild(item);
    });
  }, onDbError);
}

// ==========================================
// ✏️ 닉네임 변경권 (1,000,000P)
// 구매 즉시 포인트 차감 → rename_requests/{uid} 에 요청 → 관리자 승인 시 데이터 전체 이전
// (거절되면 관리자 쪽에서 1,000,000P 환불)
// ==========================================
const RENAME_PRICE = 1000000;
let myRenameRequest = null;
let renameRef = null;

function attachRenameRequestListener() {
  if (renameRef) renameRef.off();
  if (!authUser || authUser.isAnonymous) return;
  renameRef = db.ref(`rename_requests/${authUser.uid}`);
  renameRef.on('value', s => { myRenameRequest = s.val(); renderRenameSection(); }, () => {});
}

function renderRenameSection() {
  const box = document.getElementById('renameSection');
  if (!box) return;
  if (myRenameRequest) {
    box.innerHTML = `<div class="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
      ⏳ <strong>${esc(myRenameRequest.from)} → ${esc(myRenameRequest.to)}</strong> 변경 요청이 관리자 승인 대기 중이에요.<br>
      <span class="text-[10px] text-amber-700">승인되면 포인트·아이템·기록이 모두 새 닉네임으로 옮겨져요. 거절되면 1,000,000P가 환불돼요.</span></div>`;
    return;
  }
  box.innerHTML = `
    <div class="flex gap-1.5">
      <input id="renameInput" type="text" maxlength="20" placeholder="새 닉네임 (한글·영문·숫자 20자 이내)" class="flex-1 min-w-0 border rounded-xl p-2 text-xs font-bold outline-none focus:border-indigo-500" />
      <button onclick="buyRenameTicket()" class="shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black px-3 py-2 rounded-xl text-[11px] shadow-sm">1,000,000P 구매</button>
    </div>
    <p class="text-[10px] text-slate-400">구매하면 관리자 승인 후 바뀌어요. 포인트·강화·아이템·카드·내역이 그대로 옮겨져요.</p>`;
}

async function buyRenameTicket() {
  if (!checkApprovalGuard()) return;
  if (myRenameRequest) return alert('이미 승인 대기 중인 변경 요청이 있어요.');
  const to = (document.getElementById('renameInput')?.value || '').trim();
  if (!to) return alert('새 닉네임을 입력해주세요.');
  if (!isValidNickname(to) || to === GUEST_NICK) return alert('⚠️ 닉네임은 한글, 영문, 숫자로 20자 이내만 가능해요.');
  if (to === currentUser.nickname) return alert('지금 닉네임과 같아요.');
  if (userPoints < RENAME_PRICE) return alert(`❌ 포인트가 부족해요! (닉네임 변경권 ${RENAME_PRICE.toLocaleString()}P)`);
  try {
    const [exist, banned] = await Promise.all([db.ref(`user_points/${to}`).once('value'), db.ref(`banned_users/${to}`).once('value')]);
    if (exist.exists()) return alert(`[${to}] 은(는) 이미 누군가 쓰고 있는 닉네임이에요.`);
    if (banned.exists()) return alert(`[${to}] 은(는) 사용할 수 없는 닉네임이에요.`);
  } catch (e) { /* 확인 실패 시에도 관리자가 승인 단계에서 다시 확인 */ }
  if (!confirm(`닉네임을 [${currentUser.nickname}] → [${to}] 로 바꿀까요?\n\n닉네임 변경권 ${RENAME_PRICE.toLocaleString()}P가 바로 차감되고, 관리자가 승인하면 바뀌어요.\n(거절되면 전액 환불)`)) return;
  addPoints(-RENAME_PRICE, `닉네임 변경권 구매 (→ ${to})`);
  updatePointsUI();
  try {
    await db.ref(`rename_requests/${authUser.uid}`).set({
      uid: authUser.uid, from: currentUser.nickname, to, paid: RENAME_PRICE, createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    alert('✅ 변경 요청을 보냈어요! 관리자 승인 후 새 닉네임으로 바뀌어요.');
  } catch (err) {
    addPoints(RENAME_PRICE, '닉네임 변경권 환불 (요청 실패)');
    updatePointsUI();
    alert('요청을 보내지 못했어요: ' + err.message);
  }
}
