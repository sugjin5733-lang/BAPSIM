// 밥심 - 출발 타이머 (사다리·룰렛·N빵은 이용자가 없어 삭제)

function updateCountdown() {
  const now = new Date();
  const target = new Date();
  target.setHours(11, 30, 0, 0);

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayDateEl = document.getElementById('todayFullDate');
  if (todayDateEl) todayDateEl.textContent = `${yyyy}년 ${mm}월 ${dd}일 식단`;

  const diff = target.getTime() - now.getTime();
  const timerEl = document.getElementById('timerCountdown');

  if (timerEl) {
    if (diff > 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      timerEl.textContent = `${hours > 0 ? hours + '시간 ' : ''}${minutes}분 ${seconds < 10 ? '0' : ''}${seconds}초 남음`;
      timerEl.className = "text-orange-400 font-mono underline decoration-orange-500/50 underline-offset-8 font-extrabold";
    } else {
      timerEl.textContent = "점심 투표 마감! 식사 맛있게 하세요 🍚";
      timerEl.className = "text-emerald-400 font-bold";
    }
  }
}
