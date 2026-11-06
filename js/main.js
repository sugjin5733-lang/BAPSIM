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
  // (랭킹은 ranking.js 에서 변경 구독으로 자동 갱신)
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
    if (v > loadedAt - 5000) { try { alert('🌱 밥심이 처음으로 돌아갔어요. 화면을 새로고침할게요.'); } catch (e) {} location.reload(); }
  }, () => {});
  setTimeout(start, 3000);
})();

// 🌱 초기화 뒤 처음 접속하면 한 번만 보여주는 인사 ("돌아가자, 좋았던 때로")
(function watchResetWelcome() {
  const start = () => db.ref('meta/season').on('value', s => {
    const sz = s.val();
    const at = sz && Number(sz.startedAt);
    if (!at) return;
    let seen = '';
    try { seen = localStorage.getItem('bapsim_reset_welcome') || ''; } catch (e) {}
    if (seen === String(at)) return;
    try { localStorage.setItem('bapsim_reset_welcome', String(at)); } catch (e) {}
    if (Date.now() - at > 14 * 86400000) return; // 오래된 초기화는 생략
    showResetWelcome(sz);
  }, () => {});
  setTimeout(start, 3500);
})();
function showResetWelcome(sz) {
  document.getElementById('resetWelcome')?.remove();
  const el = document.createElement('div');
  el.id = 'resetWelcome';
  el.className = 'fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4';
  el.innerHTML = `<div class="reset-welcome bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center">
      <div class="px-6 pt-8 pb-5 space-y-3">
        <div class="text-5xl">🍚</div>
        <div class="text-[11px] font-black tracking-[0.3em] text-amber-600">BAPSIM · ${esc(sz.name || '새 시즌')}</div>
        <h3 class="text-2xl font-black text-slate-900 leading-snug">돌아가자,<br>좋았던 때로</h3>
        <p class="text-sm text-slate-500 leading-relaxed break-keep">밥심이 처음으로 돌아왔어요.<br>모두의 포인트·강화·아이템·멤버십·은행이<br><b class="text-slate-700">${Number(sz.startPoints) ? `${Number(sz.startPoints).toLocaleString()}P` : '0'}부터 다시 시작</b>해요.</p>
        <p class="text-xs text-slate-400 break-keep">계정과 닉네임, 식당·그룹·채팅은 그대로예요.<br>같은 출발선에서, 다시 즐겁게 🍀</p>
      </div>
      <button onclick="document.getElementById('resetWelcome').remove(); if (window.confetti) confetti({ particleCount: 140, spread: 100 });" class="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black py-4 text-sm">다시 시작하기</button>
    </div>`;
  document.body.appendChild(el);
}
