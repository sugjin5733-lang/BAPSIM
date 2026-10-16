// 밥심 - 앱 시작

function initNoticeListener() {
  db.ref('site_notice').on('value', (snap) => {
    const notice = snap.val();
    const contentEl = document.getElementById('noticeContentDisplay');
    const mobileContentEl = document.getElementById('mobileNoticeContent');
    const dateEl = document.getElementById('noticeDateDisplay');
    const adminTextarea = document.getElementById('adminNoticeTextarea');

    const defaultNotice = "📢 [공지] 오늘 점심 식단이 업데이트되었습니다!\n팀원들과 그룹을 만들어 투표를 시작해보세요.";
    const text = (notice && notice.text) ? notice.text : defaultNotice;
    const dateStr = (notice && notice.date) ? `최근 업데이트: ${notice.date}` : "최근 업데이트: 오늘";

    if (contentEl) contentEl.textContent = text;
    if (mobileContentEl) mobileContentEl.textContent = text;
    if (dateEl) dateEl.textContent = dateStr;
    if (adminTextarea) adminTextarea.value = text;
  });
}

if (currentUser.nickname && currentUser.nickname !== "문정러") {
  const pText = document.getElementById('userProfileText');
  if (pText) pText.textContent = currentUser.nickname;
}

setInterval(updateCountdown, 1000);
updateCountdown();
lucide.createIcons();

// 화면은 먼저 그려두고, Firebase 익명 로그인이 끝난 뒤에 DB에 접근합니다.
// (보안 규칙이 "로그인한 사용자만 읽기/쓰기"로 바뀌었기 때문)
let appStarted = false;
function startApp() {
  if (appStarted) return;
  appStarted = true;
  attachGlobalListeners();
  initPresenceSystem();
  initNoticeListener();
  renderRankingsData();
  attachUserPointListener();
  updatePointsUI(false); // 시작 시 로컬 값으로 서버 포인트를 덮어쓰지 않도록 (서버 값을 받아옴)
  updateEnhanceUI();
  updateGroupUI();
  syncFromGoogleSheet(false);
  setInterval(() => syncFromGoogleSheet(false), 1000 * 60 * 3);
  setInterval(() => renderRankingsData(), 1000 * 10);
  lucide.createIcons();
}

firebase.auth().onAuthStateChanged(user => {
  if (user) startApp();
});
firebase.auth().signInAnonymously().catch(err => {
  console.error('익명 로그인 실패:', err);
  showFatalBanner(
    err && err.code === 'auth/operation-not-allowed'
      ? '서버 설정 오류: Firebase 콘솔에서 익명 로그인(Anonymous)을 사용 설정해야 합니다.'
      : '서버 로그인에 실패했습니다: ' + (err && err.message || err)
  );
});
