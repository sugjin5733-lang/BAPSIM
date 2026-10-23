// 밥심 - 랭킹

// ==========================================
// 3. 밥키우기 랭킹 & 우측 실시간 랭킹 시스템
// ==========================================
let currentRankTab = 'points';

function openRankModal(tab = 'points') { 
  switchRankTab(tab); 
  document.getElementById('rankModal').classList.remove('hidden'); 
}
function closeRankModal() { document.getElementById('rankModal').classList.add('hidden'); }

function switchRankTab(tab) {
  currentRankTab = tab;
  const labels = {
    points: '<i data-lucide="crown" class="w-3.5 h-3.5 text-amber-500"></i><span>전체 포인트 부자 랭킹</span>',
    enhance: '<i data-lucide="award" class="w-3.5 h-3.5 text-orange-500"></i><span>전체 밥키우기 강화 랭킹</span>',
    season: '<i data-lucide="calendar" class="w-3.5 h-3.5 text-indigo-500"></i><span>이번 주 밥키우기 시즌</span>',
    black: '<span>🖤</span><span>프레스티지 블랙 랭킹 (자산 = 포인트+보류+예치금)</span>'
  };
  ['points', 'enhance', 'season', 'black'].forEach(t => {
    const btn = document.getElementById(`rankTab_${t}`);
    if (btn) btn.className = t === tab
      ? "py-2 rounded-xl bg-white shadow-xs text-slate-900 font-black"
      : "py-2 rounded-xl text-slate-500 hover:text-slate-900 font-bold";
  });
  const headerLabel = document.getElementById('rankListHeaderLabel');
  if (headerLabel) headerLabel.innerHTML = labels[tab] || labels.points;
  lucide.createIcons();
  renderRankingsData();
}

function renderRankingsData() {
  db.ref('user_points').once('value', (snap) => {
    const data = snap.val() || {};
    const userList = Object.values(data).filter(u => u && u.nickname && (u.status === 'approved' || u.approved === true));
    // 🖤 블랙 회원은 부자 랭킹에서 빠지고 블랙 랭킹으로 따로
    const rankNow = typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now();
    const isBlackU = u => (Number(u.blackUntil) || 0) > rankNow;
    const assetsOf = u => (Number(u.points) || 0) + (Number(u.owed) || 0) + (Number(u.deposit && u.deposit.amt) || 0);
    const sortedBlack = userList.filter(isBlackU).sort((a, b) => assetsOf(b) - assetsOf(a));

    // 1) 사이드바 부자 랭킹 (TOP 5) — 블랙 제외
    const sortedPoints = userList.filter(u => !isBlackU(u)).sort((a, b) => (b.points || 0) - (a.points || 0));
    const sideContainer = document.getElementById('sideRankListContainer');
    const sideRankEl = document.getElementById('sideMyRankText');
    const sidePointEl = document.getElementById('sideMyPointText');

    let myPointRankIndex = sortedPoints.findIndex(u => u.nickname === currentUser.nickname);
    if (sideRankEl && sidePointEl) {
      if (myPointRankIndex !== -1) {
        sideRankEl.textContent = `${myPointRankIndex + 1}위 (${currentUser.nickname})`;
        sidePointEl.textContent = `${(sortedPoints[myPointRankIndex].points || 0).toLocaleString()}P`;
      } else {
        sideRankEl.textContent = `${currentUser.nickname} (순위밖)`;
        sidePointEl.textContent = `${userPoints.toLocaleString()}P`;
      }
    }

    if (sideContainer) {
      sideContainer.innerHTML = '';
      if (sortedPoints.length === 0) {
        sideContainer.innerHTML = '<div class="text-center text-slate-400 py-3 text-xs">랭킹 데이터가 없습니다.</div>';
      } else {
        sortedPoints.slice(0, 5).forEach((user, index) => {
          let medal = `${index + 1}위`;
          if (index === 0) medal = '🥇';
          else if (index === 1) medal = '🥈';
          else if (index === 2) medal = '🥉';

          const item = document.createElement('div');
          item.className = `p-2 rounded-xl border flex items-center justify-between transition-all ${index < 3 ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200'}`;
          const badgeClass = user.badge || 'nb-none';
          const sym = user.symbol ? `${user.symbol} ` : '';
          const symEnd = user.symbol ? ` ${user.symbol}` : '';
          const colorStyle = user.color ? `color: ${user.color} !important;` : '';

          item.innerHTML = `
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="font-black text-xs shrink-0">${medal}</span>
              ${nickHTML(user, 'text-xs truncate')}
            </div>
            <span class="font-bold text-amber-700 bg-white border border-amber-100 px-2 py-0.5 rounded-md text-[11px] shrink-0">
              ${(user.points || 0).toLocaleString()}P
            </span>
          `;
          sideContainer.appendChild(item);
        });
      }
    }

    // 2) 사이드바 밥키우기 실시간 랭킹 (TOP 5)
    const sortedEnhance = [...userList].sort((a, b) => (b.enhanceLevel || 0) - (a.enhanceLevel || 0));
    const sideEnhanceContainer = document.getElementById('sideEnhanceRankListContainer');
    const sideMyBowlLevel = document.getElementById('sideMyBowlLevel');
    const sideMyBowlRank = document.getElementById('sideMyBowlRank');

    let myEnhanceRankIndex = sortedEnhance.findIndex(u => u.nickname === currentUser.nickname);
    const myBowlObj = BOWL_EVOLUTION[Math.min(currentEnhanceLevel, ENHANCE_MAX)];

    if (sideMyBowlLevel) {
      sideMyBowlLevel.textContent = `+${currentEnhanceLevel} ${myBowlObj?.name || '일반 밥'}`;
    }
    if (sideMyBowlRank) {
      sideMyBowlRank.textContent = myEnhanceRankIndex !== -1 ? `${myEnhanceRankIndex + 1}위` : `-위`;
    }

    if (sideEnhanceContainer) {
      sideEnhanceContainer.innerHTML = '';
      if (sortedEnhance.length === 0) {
        sideEnhanceContainer.innerHTML = '<div class="text-center text-slate-400 py-3 text-xs">밥키우기 기록이 없습니다.</div>';
      } else {
        sortedEnhance.slice(0, 5).forEach((user, index) => {
          let medal = `${index + 1}위`;
          if (index === 0) medal = '🥇';
          else if (index === 1) medal = '🥈';
          else if (index === 2) medal = '🥉';

          const eLvl = user.enhanceLevel || 0;
          const bObj = BOWL_EVOLUTION[Math.min(eLvl, ENHANCE_MAX)];
          const item = document.createElement('div');
          item.className = `p-2 rounded-xl border flex items-center justify-between transition-all ${index < 3 ? 'bg-orange-50/70 border-orange-200' : 'bg-slate-50 border-slate-200'}`;
          const badgeClass = user.badge || 'nb-none';
          const sym = user.symbol ? `${user.symbol} ` : '';
          const symEnd = user.symbol ? ` ${user.symbol}` : '';
          const colorStyle = user.color ? `color: ${user.color} !important;` : '';

          item.innerHTML = `
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="font-black text-xs shrink-0">${medal}</span>
              ${nickHTML(user, 'text-xs truncate')}
            </div>
            <span class="font-black text-orange-600 bg-white border border-orange-100 px-2 py-0.5 rounded-md text-[11px] shrink-0">
              ${bObj?.icon || '🍚'} +${eLvl}강
            </span>
          `;
          sideEnhanceContainer.appendChild(item);
        });
      }
    }

    // 3) 모달 내부 랭킹 렌더링
    const modalContainer = document.getElementById('rankListContainer');
    const summaryEl = document.getElementById('myRankSummary');
    const myPointEl = document.getElementById('myRankPointDisplay');

    if (modalContainer && currentRankTab === 'black') {
      modalContainer.innerHTML = '';
      const myIdx = sortedBlack.findIndex(u => u.nickname === currentUser.nickname);
      if (summaryEl) summaryEl.textContent = myIdx !== -1 ? `${currentUser.nickname} 님은 블랙 ${myIdx + 1}위입니다!` : '블랙 회원만 오를 수 있는 랭킹이에요';
      if (myPointEl) myPointEl.textContent = myIdx !== -1 ? `${assetsOf(sortedBlack[myIdx]).toLocaleString()}P` : '-';
      if (sortedBlack.length === 0) modalContainer.innerHTML = '<div class="text-center text-slate-400 py-6 text-xs">아직 프레스티지 블랙 회원이 없어요</div>';
      sortedBlack.forEach((user, index) => {
        const item = document.createElement('div');
        item.className = 'p-3 rounded-2xl border flex items-center justify-between bg-slate-950 border-amber-300/40 text-white';
        item.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-black text-xs ${index === 0 ? 'text-amber-300 text-sm' : 'text-slate-300'}">${index === 0 ? '🖤 1등' : `${index + 1}위`}</span>
            ${nickHTML(user, 'text-xs truncate')}
          </div>
          <div class="text-right shrink-0">
            <span class="font-extrabold text-amber-200 text-xs">${assetsOf(user).toLocaleString()}P</span>
            <span class="block text-[10px] text-slate-400">포인트 ${(Number(user.points) || 0).toLocaleString()}${Number(user.deposit && user.deposit.amt) ? ` · 예치 ${Number(user.deposit.amt).toLocaleString()}` : ''}</span>
          </div>`;
        modalContainer.appendChild(item);
      });
    } else if (modalContainer && currentRankTab === 'season') {
      renderSeasonRanking(modalContainer, summaryEl, myPointEl).catch(onDbError);
    } else if (modalContainer) {
      modalContainer.innerHTML = '';

      if (currentRankTab === 'points') {
        if (summaryEl) summaryEl.textContent = myPointRankIndex !== -1 ? `${currentUser.nickname} 님은 포인트 ${myPointRankIndex + 1}위입니다!` : `${currentUser.nickname} 님 (순위 밖)`;
        if (myPointEl) myPointEl.textContent = `${userPoints.toLocaleString()}P`;

        sortedPoints.forEach((user, index) => {
          let rankBadge = `${index + 1}위`;
          if (index === 0) rankBadge = '🥇 1등';
          else if (index === 1) rankBadge = '🥈 2등';
          else if (index === 2) rankBadge = '🥉 3등';

          const item = document.createElement('div');
          item.className = `p-3 rounded-2xl border flex items-center justify-between transition-all ${index < 3 ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200'}`;
          const badgeClass = user.badge || 'nb-none';
          const sym = user.symbol ? `${user.symbol} ` : '';
          const symEnd = user.symbol ? ` ${user.symbol}` : '';
          const colorStyle = user.color ? `color: ${user.color} !important;` : '';

          item.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="font-black text-xs ${index === 0 ? 'text-amber-600 text-sm' : 'text-slate-600'}">${rankBadge}</span>
              ${nickHTML(user, 'text-xs')}
            </div>
            <span class="font-extrabold text-amber-700 bg-white border border-amber-100 px-2.5 py-0.5 rounded-xl shadow-xs">
              ${(user.points || 0).toLocaleString()}P
            </span>
          `;
          modalContainer.appendChild(item);
        });
      } else {
        if (summaryEl) summaryEl.textContent = myEnhanceRankIndex !== -1 ? `${currentUser.nickname} 님은 밥키우기 ${myEnhanceRankIndex + 1}위입니다!` : `${currentUser.nickname} 님 (순위 밖)`;
        if (myPointEl) myPointEl.textContent = `+${currentEnhanceLevel}강`;

        sortedEnhance.forEach((user, index) => {
          let rankBadge = `${index + 1}위`;
          if (index === 0) rankBadge = '👑 1등';
          else if (index === 1) rankBadge = '🥈 2등';
          else if (index === 2) rankBadge = '🥉 3등';

          const eLvl = user.enhanceLevel || 0;
          const bObj = BOWL_EVOLUTION[Math.min(eLvl, ENHANCE_MAX)];
          const item = document.createElement('div');
          item.className = `p-3 rounded-2xl border flex items-center justify-between transition-all ${index < 3 ? 'bg-orange-50/80 border-orange-200' : 'bg-slate-50 border-slate-200'}`;
          const badgeClass = user.badge || 'nb-none';
          const sym = user.symbol ? `${user.symbol} ` : '';
          const symEnd = user.symbol ? ` ${user.symbol}` : '';
          const colorStyle = user.color ? `color: ${user.color} !important;` : '';

          item.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="font-black text-xs ${index === 0 ? 'text-orange-600 text-sm' : 'text-slate-600'}">${rankBadge}</span>
              ${nickHTML(user, 'text-xs')}
            </div>
            <div class="text-right">
              <span class="font-black text-orange-600 bg-white border border-orange-200 px-2.5 py-0.5 rounded-xl shadow-xs text-xs">
                ${bObj?.icon || '🍚'} +${eLvl}강
              </span>
              <span class="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[120px]">${bObj?.name || ''}</span>
            </div>
          `;
          modalContainer.appendChild(item);
        });
      }
    }
  });
}
