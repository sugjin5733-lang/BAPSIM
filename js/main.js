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

setInterval(updateCountdown, 1000);
updateCountdown();
updateAccountUI();
lucide.createIcons();

// 공용 데이터(식단, 그룹, 공지, 접속자, 랭킹)는 로그인 종류와 관계없이 한 번만 연결
let appStarted = false;
function startApp() {
  if (appStarted) return;
  appStarted = true;
  attachGlobalListeners();
  attachOnlineUsersListener();
  attachFeedListener();
  attachDuelListener();
  initNoticeListener();
  renderRankingsData();
  updateEnhanceUI();
  updateGroupUI();
  setInterval(() => syncFromGoogleSheet(false), 1000 * 60 * 3);
  setInterval(() => renderRankingsData(), 1000 * 10);
  lucide.createIcons();
}

// 저장된 구글 로그인이 있으면 그대로 쓰고, 없을 때만 익명으로 "둘러보기" 로그인
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    firebase.auth().signInAnonymously().catch(err => {
      console.error('익명 로그인 실패:', err);
      showFatalBanner(
        err && err.code === 'auth/operation-not-allowed'
          ? '서버 설정 오류: Firebase 콘솔에서 익명 로그인(Anonymous)을 사용 설정해야 합니다.'
          : '서버 연결에 실패했습니다: ' + (err && err.message || err)
      );
    });
    return;
  }
  startApp();
  await handleAuthChange(user);
  updateGroupUI();
});

// 🔄 시즌 초기화 감지: 관리자가 초기화하면 열려 있는 화면을 새로고침 (예전 값이 다시 저장되지 않게)
(function watchSeasonReset() {
  const loadedAt = Date.now();
  let first = true;
  const start = () => db.ref('meta/resetAt').on('value', s => {
    const v = Number(s.val()) || 0;
    if (first) { first = false; if (!(v > loadedAt)) return; }
    if (v > loadedAt - 5000) { try { alert('🔄 새 시즌이 시작됐어요! 화면을 새로고침할게요.'); } catch (e) {} location.reload(); }
  }, () => {});
  setTimeout(start, 3000);
})();
