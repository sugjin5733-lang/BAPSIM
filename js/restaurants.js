// 밥심 - 식단표, 투표, 그룹, 식당 등록

function toggleMenuAccordion(forceOpen = false) {
  const wrapper = document.getElementById('cardsWrapper');
  const btnText = document.getElementById('accordionBtnText');
  const btnIcon = document.getElementById('accordionBtnIcon');

  if (forceOpen) isMenuExpanded = true;
  else isMenuExpanded = !isMenuExpanded;

  if (isMenuExpanded) {
    if (wrapper) wrapper.classList.remove('hidden');
    if (btnText) btnText.textContent = "식단표 접기";
    if (btnIcon) btnIcon.classList.add('rotate-180');
    if (forceOpen) {
      const section = document.getElementById('restaurantSection');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    }
  } else {
    if (wrapper) wrapper.classList.add('hidden');
    if (btnText) btnText.textContent = "식단표 펼쳐보기";
    if (btnIcon) btnIcon.classList.remove('rotate-180');
  }
}

async function syncFromGoogleSheet(isManual = false) {
  if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL.includes("여기에")) {
    if (isManual) alert("Google Sheet API URL이 설정되지 않았습니다.");
    return;
  }
  // 식단 저장은 승인된 회원만 가능 (보안 규칙). 둘러보기 중에는 건너뜀
  if (!canSyncToCloud()) {
    if (isManual) checkApprovalGuard();
    return;
  }

  const syncIcon = document.getElementById('sheetSyncIcon');
  if (syncIcon) syncIcon.classList.add('animate-spin');

  try {
    const res = await fetch(GOOGLE_SHEET_API_URL);
    const sheetData = await res.json();

    if (sheetData && Object.keys(sheetData).length > 0) {
      let hidden = {}, current = {};
      try { hidden = (await db.ref('restaurants_hidden').once('value')).val() || {}; } catch (e) {}
      try { current = (await db.ref('restaurants').once('value')).val() || {}; } catch (e) {}
      // 시트 ID는 '몇 번째 줄'(sheet_rest_N)이라 시트에서 줄을 지우면 번호가 밀림
      //  → 숨김은 이름으로 판단, 시트에 더 이상 없는 번호의 옛 식당은 DB에서 정리
      const hiddenNames = new Set(Object.values(hidden).map(h => String((h && h.name) || '').trim()).filter(Boolean));
      const liveIds = new Set(Object.values(sheetData).map(r => r && r.id).filter(Boolean));
      const stale = {};
      Object.entries(current).forEach(([k, r]) => { if (r && r.fromSheet && !liveIds.has(k)) stale[`restaurants/${k}`] = null; });
      if (liveIds.size > 0 && Object.keys(stale).length) { try { await db.ref().update(stale); } catch (e) {} }
      for (const key of Object.keys(sheetData)) {
        const rest = sheetData[key];
        if (!rest || !rest.id) continue;
        if (hiddenNames.has(String(rest.name || '').trim())) { // 관리자가 삭제(숨김)한 식당은 다시 안 만듦
          if (current[rest.id] && current[rest.id].fromSheet) { try { await db.ref(`restaurants/${rest.id}`).remove(); } catch (e) {} }
          continue;
        }

        let cleanDate = rest.menuDate == null ? "" : String(rest.menuDate);
        if (cleanDate.includes("GMT") || cleanDate.length > 12) {
          const dObj = new Date(cleanDate);
          if (!isNaN(dObj.getTime())) {
            const yyyy = dObj.getFullYear();
            const mm = String(dObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dObj.getDate()).padStart(2, '0');
            cleanDate = `${yyyy}-${mm}-${dd}`;
          }
        }
        rest.menuDate = cleanDate;

        if (rest.price && !String(rest.price).includes("원") && !String(rest.price).includes("₩")) {
          const numPrice = parseInt(rest.price, 10);
          if (!isNaN(numPrice)) rest.price = `${numPrice.toLocaleString()}원`;
        }

        rest.fromSheet = true;
        await db.ref(`restaurants/${rest.id}`).update(rest);
      }
      if (isManual) alert("✅ 구글 스프레드시트 식단이 성공적으로 동기화되었습니다!");
    }
  } catch (err) {
    console.error("스프레드시트 동기화 실패:", err);
    if (isManual) alert("동기화 중 오류 발생: " + err.message);
  } finally {
    if (syncIcon) syncIcon.classList.remove('animate-spin');
  }
}

function renderCards() {
  const container = document.getElementById('restaurantCardsContainer');
  if (!container) return;
  container.innerHTML = '';
  const list = Object.values(restaurants || {});
  const badge = document.getElementById('restaurantCountBadge');
  if (badge) badge.textContent = `${list.length}곳`;

  const isLobby = (currentGroupId === 'lobby');
  let totalVotes = 0;
  let maxVote = -1;
  let topId = null;

  if (!isLobby) {
    list.forEach(r => {
      const v = groupVotesData[r.id] || 0;
      totalVotes += v;
      if (v > maxVote && v > 0) {
        maxVote = v;
        topId = r.id;
      }
    });
  }

  list.forEach(rRaw => {
    // 데이터 형식이 섞여 들어와도(숫자 가격, 문자열 메뉴 등) 화면이 통째로 멈추지 않도록 정규화
    const r = Object.assign({}, rRaw, {
      id: String(rRaw.id || ''),
      name: String(rRaw.name || '이름없음'),
      menuDate: rRaw.menuDate == null ? '' : String(rRaw.menuDate),
      mains: toArr(rRaw.mains)
    });
    const votesCount = groupVotesData[r.id] || 0;
    const isVoted = (myVotedId === r.id);
    const isTop = (topId === r.id);
    const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
    
    const dateInfo = formatPrettyDate(r.menuDate);
    const mapUrl = safeUrl(r.mapUrl) || `https://map.naver.com/p/search/${encodeURIComponent('문정동 ' + r.name)}`;

    let displayPrice = String(r.price || "가격미정");
    if (!displayPrice.includes("원") && !displayPrice.includes("₩") && !isNaN(parseInt(displayPrice, 10))) {
      displayPrice = parseInt(displayPrice, 10).toLocaleString() + "원";
    }

    const isSuspended = (r.mains || []).some(m => String(m).includes("ㅈ망") || String(m).includes("휴무") || String(m).includes("미운영"));
    const isNotToday = !dateInfo.isToday;

    const card = document.createElement('div');
    card.className = `group bg-white rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between shadow-xs hover:shadow-xl hover:-translate-y-1 ${isVoted ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200/80'}`;

    let bottomActionHTML = '';
    if (isLobby) {
      bottomActionHTML = `
        <div class="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <button onclick="openEditModal(${jsArg(r.id)})" class="text-[11px] text-slate-400 hover:text-orange-500 font-semibold flex items-center gap-1">
            <i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
            정보 수정
          </button>
          <button onclick="openGroupListModal()" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1">
            <i data-lucide="users" class="w-3.5 h-3.5"></i>
            <span>그룹 투표 참여</span>
          </button>
        </div>
      `;
    } else {
      bottomActionHTML = `
        <div class="mt-5 pt-4 border-t border-slate-100">
          <div class="flex items-center justify-between text-xs font-bold mb-1.5">
            <span class="text-slate-500">${votesCount}표 (${percent}%)</span>
            <button onclick="openEditModal(${jsArg(r.id)})" class="text-[11px] text-slate-400 hover:text-orange-500 font-semibold flex items-center gap-1">
              <i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
              수정
            </button>
          </div>
          <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
            <div class="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-500" style="width: ${percent}%"></div>
          </div>
          <button onclick="castVote(${jsArg(r.id)})" class="w-full py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${isVoted ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">
            <i data-lucide="${isVoted ? 'check' : 'thumbs-up'}" class="w-3.5 h-3.5"></i>
            <span>${isVotingClosed() ? (isVoted ? '내가 고른 곳 (투표 마감)' : '오늘 투표 마감') : isVoted ? '투표 완료됨 (다시 눌러 취소)' : '여기로 투표'}</span>
          </button>
        </div>
      `;
    }

    let menuBodyHTML = '';
    if (isNotToday) {
      menuBodyHTML = `
        <div class="my-5 py-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
          <div class="w-10 h-10 rounded-full bg-slate-200/70 text-slate-400 flex items-center justify-center">
            <i data-lucide="clock" class="w-5 h-5 animate-pulse"></i>
          </div>
          <div>
            <span class="text-slate-700 font-black text-sm tracking-tight block">식단 업데이트 예정</span>
            <span class="text-[10px] text-slate-400 font-medium">당일 메뉴가 아직 등록되지 않았습니다</span>
          </div>
        </div>
      `;
    } else if (isSuspended) {
      menuBodyHTML = `
        <div class="mt-4 space-y-2">
          <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">오늘의 메인 메뉴</span>
          <div class="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl text-center text-rose-600 font-extrabold text-xs">
            ⚠️ 오늘 식단 휴무 또는 미운영 상태입니다
          </div>
        </div>
      `;
    } else {
      menuBodyHTML = `
        <div class="mt-4 space-y-2">
          <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">오늘의 메인 메뉴</span>
          <div class="flex flex-wrap gap-1.5">
            ${(r.mains || []).map(m => `
              <span class="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-800 border border-slate-200/90 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs leading-snug">
                ${esc(m)}
              </span>
            `).join('')}
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
          <div class="flex items-center">
            <span class="shrink-0 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md mr-2">국/탕</span>
            <span class="text-slate-700 font-medium truncate">${esc(r.soup || '-')}</span>
          </div>
          <div class="flex items-center">
            <span class="shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md mr-2">서비스</span>
            <span class="text-slate-600 font-medium truncate">${esc(r.dessert || '-')}</span>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap mb-1">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${dateInfo.isToday ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}">
                <i data-lucide="calendar" class="w-3 h-3"></i>
                ${dateInfo.text}
              </span>
            </div>
            <h4 class="font-black text-slate-900 text-lg tracking-tight flex items-center gap-1.5">
              <span class="truncate">${esc(r.name)}</span>
              ${isTop ? '<span class="text-[10px] bg-amber-400 text-amber-950 font-black px-1.5 py-0.5 rounded-md shadow-xs shrink-0">👑 1위</span>' : ''}
            </h4>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span class="text-xs font-black text-slate-800 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200">${esc(displayPrice)}</span>
            <a href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 transition-colors">
              <span class="font-black">N</span> 지도
            </a>
          </div>
        </div>

        ${menuBodyHTML}
      </div>

      ${bottomActionHTML}
    `;
    container.appendChild(card);
  });

  lucide.createIcons();
}

// 투표는 날짜별 1인 1표: groups/{그룹}/ballots/{YYYY-MM-DD}/{닉네임} = { rid, uid, ts }
// 매일 자동으로 새로 시작되고, 11:30(한국 시간)에 그날 투표가 마감됨
const VOTE_CLOSE_MIN = 11 * 60 + 30;
let ballotsDate = todayKey();
let todayBallots = {};

function isVotingClosed() {
  return kstMinutesOfDay() >= VOTE_CLOSE_MIN;
}

async function castVote(id) {
  if (!checkApprovalGuard()) return;
  if (currentGroupId === 'lobby') {
    openGroupListModal();
    return;
  }
  if (isVotingClosed()) return alert('⏰ 오늘 점심 투표는 11:30에 마감됐어요. 내일 다시 투표해주세요!');

  const ballotRef = db.ref(`groups/${currentGroupId}/ballots/${todayKey()}/${currentUser.nickname}`);
  const chatPath = `groups/${currentGroupId}/messages`;
  try {
    if (myVotedId === id) {
      await ballotRef.remove();
    } else {
      await ballotRef.set({ rid: id, uid: authUser.uid, ts: firebase.database.ServerValue.TIMESTAMP });
      db.ref(chatPath).push({
        uid: authUser.uid,
        type: 'system',
        text: `🔔 ${currentUser.nickname}님이 [${restaurants[id]?.name || '식당'}]에 투표하셨습니다!`,
        timestamp: Date.now()
      });
    }
  } catch (err) {
    alert('투표하지 못했어요: ' + err.message);
  }
}

function enterGroup(gid, gname) {
  currentGroupId = gid;
  currentGroupName = gname;
  localStorage.setItem('bapsim_current_group_id', gid);
  localStorage.setItem('bapsim_current_group_name', gname);
  updateGroupUI();
}

function leaveGroupToLobby() {
  enterGroup('lobby', '전체 공개 로비');
}

function promptJoinGroup(gid) {
  targetJoinGroupId = gid;
  const g = allGroups[gid];
  if (g) {
    document.getElementById('joinModalGroupName').textContent = `[${g.name}] 입장`;
    document.getElementById('groupJoinModal').classList.remove('hidden');
  }
}

async function submitJoinGroup() {
  const pass = document.getElementById('joinGroupPassInput').value.trim();
  const g = allGroups[targetJoinGroupId];
  const passHash = await sha256(pass);
  // 그룹 비밀번호는 해시로 비교 (예전 평문 비밀번호는 관리자 대시보드를 열 때 자동으로 해시 전환됨)
  const ok = g && ((g.passwordHash && g.passwordHash === passHash) || (!g.passwordHash && g.password === pass));
  if (ok) {
    document.getElementById('joinGroupPassInput').value = '';
    enterGroup(g.id, g.name);
    closeGroupJoinModal();
    closeGroupModal();
  } else {
    alert('비밀번호가 일치하지 않습니다.');
  }
}

function openGroupListModal() { document.getElementById('groupModal').classList.remove('hidden'); }
function closeGroupModal() { document.getElementById('groupModal').classList.add('hidden'); }
function closeGroupJoinModal() { document.getElementById('groupJoinModal').classList.add('hidden'); }

async function handleCreateGroup(e) {
  e.preventDefault();
  if (!checkApprovalGuard()) return;
  const groupName = document.getElementById('createGroupName').value.trim();
  const password = document.getElementById('createGroupPass').value.trim();
  const gid = 'grp_' + Date.now();
  const passwordHash = await sha256(password);
  db.ref(`groups/${gid}`).set({ id: gid, name: groupName, passwordHash: passwordHash, leader: currentUser.nickname, leaderUid: authUser.uid, createdAt: Date.now() }, (err) => {
    if (err) return alert('그룹을 만들지 못했어요: ' + err.message);
    enterGroup(gid, groupName);
    closeGroupModal();
  });
}

function renderGroupList() {
  const listEl = document.getElementById('groupListContainer');
  const groups = Object.values(allGroups || {});
  if (!listEl) return;
  listEl.innerHTML = '';
  groups.forEach(g => {
    const isCurrent = (currentGroupId === g.id);
    const item = document.createElement('div');
    item.className = "p-3 rounded-2xl border flex items-center justify-between text-xs";
    item.innerHTML = `
      <div class="font-bold truncate max-w-[200px]">${esc(g.name)}</div>
      <div>${isCurrent ? '<span class="text-indigo-600 font-bold">참여중</span>' : `<button onclick="promptJoinGroup(${jsArg(g.id)})" class="bg-indigo-600 text-white px-2.5 py-1 rounded-lg font-bold">입장</button>`}</div>
    `;
    listEl.appendChild(item);
  });
}

function updateGroupUI() {
  const isLobby = (currentGroupId === 'lobby');

  const nameText = document.getElementById('currentGroupNameText');
  const badgeBtn = document.getElementById('currentGroupBadge');
  if (nameText) nameText.textContent = currentGroupName;
  if (badgeBtn) {
    badgeBtn.className = isLobby
      ? "inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-1 rounded-xl max-w-[140px] sm:max-w-[240px] md:max-w-[340px]"
      : "inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-2.5 py-1 rounded-xl max-w-[140px] sm:max-w-[240px] md:max-w-[340px]";
  }

  const statusInd = document.getElementById('groupStatusIndicator');
  const leaveWrapper = document.getElementById('leaveGroupWrapper');
  const chatHeader = document.getElementById('chatHeaderTitle');
  if (statusInd) statusInd.textContent = isLobby ? "🏢 전체 공개 로비" : `🔒 비밀 그룹 [${currentGroupName}]`;
  if (leaveWrapper) leaveWrapper.style.display = isLobby ? 'none' : 'block';
  if (chatHeader) chatHeader.textContent = isLobby ? "전체 로비 톡" : `🔒 ${currentGroupName} 비밀 톡`;

  const heroSection = document.getElementById('lobbyHeroSection');
  if (heroSection) heroSection.style.display = isLobby ? 'block' : 'none';

  const mainTitle = document.getElementById('sectionMainTitle');
  const subTitle = document.getElementById('sectionSubTitle');
  const activeBadge = document.getElementById('groupActiveBadge');
  const accordionBtn = document.getElementById('menuAccordionBtn');
  const cardsWrapper = document.getElementById('cardsWrapper');

  if (isLobby) {
    if (mainTitle) mainTitle.textContent = "오늘의 한식뷔페 식단표";
    if (subTitle) subTitle.textContent = "투표는 상단 '비밀 그룹 찾기 & 만들기'를 통해 그룹에 입장한 뒤 진행할 수 있습니다.";
    if (activeBadge) activeBadge.classList.add('hidden');
    if (accordionBtn) accordionBtn.classList.remove('hidden');
    if (!isMenuExpanded && cardsWrapper) {
      cardsWrapper.classList.add('hidden');
    }
  } else {
    if (mainTitle) mainTitle.textContent = `[${currentGroupName}] 점심 투표소`;
    if (subTitle) subTitle.textContent = "현재 그룹원들의 실시간 투표 집계 현황입니다. 원하는 식당에 소중한 한 표를 던지세요!";
    if (activeBadge) activeBadge.classList.remove('hidden');
    if (accordionBtn) accordionBtn.classList.add('hidden');
    if (cardsWrapper) cardsWrapper.classList.remove('hidden');
  }

  attachVotesListener();
  attachChatListener();
  attachPredictionListener();
  renderCards();
}

function attachVotesListener() {
  if (groupVotesRef) groupVotesRef.off();
  groupVotesData = {};
  todayBallots = {};
  myVotedId = null;
  if (currentGroupId === 'lobby') { renderCards(); return; }
  ballotsDate = todayKey();
  groupVotesRef = db.ref(`groups/${currentGroupId}/ballots/${ballotsDate}`);
  groupVotesRef.on('value', snap => {
    todayBallots = snap.val() || {};
    groupVotesData = {};
    Object.values(todayBallots).forEach(b => { if (b && b.rid) groupVotesData[b.rid] = (groupVotesData[b.rid] || 0) + 1; });
    const mine = todayBallots[currentUser.nickname];
    myVotedId = mine ? mine.rid : null;
    renderCards();
    if (typeof renderPredictionPanel === 'function') renderPredictionPanel();
  }, onDbError);
}

// 자정이 지나면 새 날짜의 투표로 자동 전환
setInterval(() => {
  if (currentGroupId !== 'lobby' && todayKey() !== ballotsDate) attachVotesListener();
}, 30000);

function attachGlobalListeners() {
  db.ref('groups').on('value', snap => { allGroups = snap.val() || {}; renderGroupList(); }, onDbError);
  db.ref('restaurants').on('value', snap => { restaurants = snap.val() || {}; renderCards(); }, onDbError);
}

function openAddModal() {
  if (!checkApprovalGuard()) return;
  document.getElementById('restaurantForm').reset();
  document.getElementById('editRestId').value = '';
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  document.getElementById('formRestDate').value = todayISO;
  document.getElementById('deleteActionWrapper').classList.add('hidden');
  document.getElementById('sheetRestNotice').classList.add('hidden');
  document.getElementById('modalTitle').textContent = "식당 등록 및 식단 업데이트";
  if (typeof resetOcrBox === 'function') resetOcrBox();
  document.getElementById('addModal').classList.remove('hidden');
}

function openEditModal(id) {
  if (!checkApprovalGuard()) return;
  const r = restaurants[id];
  if (!r) return;
  document.getElementById('editRestId').value = id;
  document.getElementById('formRestName').value = r.name || '';
  document.getElementById('formRestPrice').value = r.price || '';
  document.getElementById('formRestDate').value = r.menuDate || '';
  document.getElementById('formRestMapUrl').value = r.mapUrl || '';
  document.getElementById('formRestMains').value = toArr(r.mains).join(', ');
  document.getElementById('formRestSoup').value = r.soup || '';
  document.getElementById('formRestDessert').value = r.dessert || '';

  if (r.fromSheet) {
    document.getElementById('deleteActionWrapper').classList.add('hidden');
    document.getElementById('sheetRestNotice').classList.remove('hidden');
  } else {
    document.getElementById('deleteActionWrapper').classList.remove('hidden');
    document.getElementById('sheetRestNotice').classList.add('hidden');
  }
  document.getElementById('modalTitle').textContent = `[${r.name}] 식단 수정`;
  if (typeof resetOcrBox === 'function') resetOcrBox();
  document.getElementById('addModal').classList.remove('hidden');
}

function closeAddModal() { document.getElementById('addModal').classList.add('hidden'); }

function handleSaveRestaurant(e) {
  e.preventDefault();
  const editId = document.getElementById('editRestId').value;
  const id = editId || ('rest_' + Date.now());
  const mainsArr = document.getElementById('formRestMains').value.split(',').map(s => s.trim()).filter(Boolean);

  const restData = {
    id: id,
    name: document.getElementById('formRestName').value.trim(),
    price: document.getElementById('formRestPrice').value.trim() || '8,500원',
    mapUrl: document.getElementById('formRestMapUrl').value.trim() || '',
    menuDate: document.getElementById('formRestDate').value,
    mains: mainsArr,
    soup: document.getElementById('formRestSoup').value.trim() || '-',
    dessert: document.getElementById('formRestDessert').value.trim() || '-',
    updatedBy: currentUser.nickname
  };

  db.ref(`restaurants/${id}`).set(restData, (err) => {
    if (err) return alert('저장 오류: ' + err.message);
    db.ref('point_requests').push({
      uid: authUser.uid,
      nickname: currentUser.nickname,
      restaurantName: restData.name,
      date: restData.menuDate,
      amount: 50,
      timestamp: Date.now(),
      status: 'pending'
    });
    alert('식단 저장 완료 (관리자 승인 대기)');
    closeAddModal();
  });
}

function handleDeleteCurrentRestaurant() {
  const editId = document.getElementById('editRestId').value;
  if (!editId) return;
  if (!confirm('이 식당을 영구 삭제하시겠습니까?')) return;
  db.ref(`restaurants/${editId}`).remove(() => {
    alert('삭제 완료');
    closeAddModal();
  });
}

// ==========================================
// 📷 사진으로 자동 입력 (반자동): 인스타 메뉴 사진 → 글자 인식(브라우저 안에서, 무료) → 입력칸 채우기
// ==========================================
const OCR_LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let ocrWorkerPromise = null;
function loadOcrWorker() {
  if (ocrWorkerPromise) return ocrWorkerPromise;
  ocrWorkerPromise = new Promise((resolve, reject) => {
    const go = () => Tesseract.createWorker('kor', 1, {}).then(resolve, reject);
    if (window.Tesseract) return go();
    const s = document.createElement('script');
    s.src = OCR_LIB; s.onload = go; s.onerror = () => reject(new Error('인식 도구를 불러오지 못했어요'));
    document.head.appendChild(s);
  }).catch(e => { ocrWorkerPromise = null; throw e; });
  return ocrWorkerPromise;
}
function setOcrStatus(msg) {
  const el = document.getElementById('ocrStatus');
  if (!el) return;
  el.classList.toggle('hidden', !msg);
  el.textContent = msg || '';
}

// 사진 → 인식용 캔버스 여러 장 (흑백 / 이진화 / 반전) : 인스타 메뉴판은 배경·글씨색이 제각각이라 여러 번 읽고 제일 나은 걸 고름
function loadImg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 열 수 없어요'));
    img.src = URL.createObjectURL(file);
  });
}
function prepMenuVariants(img) {
  const scale = Math.min(3, Math.max(1, 2000 / Math.max(img.width, img.height)));
  const W = Math.round(img.width * scale), H = Math.round(img.height * scale);
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const bg = base.getContext('2d'); bg.imageSmoothingQuality = 'high'; bg.drawImage(img, 0, 0, W, H);
  const src = bg.getImageData(0, 0, W, H).data;
  const gray = new Uint8ClampedArray(W * H);
  const hist = new Array(256).fill(0);
  for (let i = 0, j = 0; i < src.length; i += 4, j++) { const y = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]; gray[j] = y; hist[y | 0]++; }
  // Otsu 임계값
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, th = 128; const total = W * H;
  for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = i; } }
  let dark = 0; for (let j = 0; j < gray.length; j++) if (gray[j] < th) dark++;
  const textIsLight = dark / gray.length > 0.5; // 어두운 면적이 더 많으면 배경이 어두운 것 → 글씨가 밝음
  const make = (fn) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); const d = g.createImageData(W, H); const p = d.data;
    for (let j = 0, i = 0; j < gray.length; j++, i += 4) { const v = fn(gray[j]); p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  };
  const flip = v => textIsLight ? 255 - v : v;
  return [
    make(v => flip(v)),                                         // 흑백
    make(v => flip(v < th ? 0 : 255)),                          // 이진화
    make(v => flip(Math.max(0, Math.min(255, (v - th) * 2.2 + 128)))) // 대비 강하게
  ];
}

// 한식뷔페 자주 나오는 반찬 사전: 글자가 살짝 틀리면 가장 비슷한 이름으로 고쳐줌
const DISH_DICT = ('돼지고기김치찜,김치찜,제육볶음,고추장불고기,소불고기,불고기,간장불고기,돼지불백,닭볶음탕,닭갈비,닭강정,양념치킨,후라이드치킨,치킨까스,돈까스,돈가스,생선까스,함박스테이크,떡갈비,동그랑땡,너비아니,미트볼,소세지야채볶음,비엔나볶음,햄볶음,스팸구이,계란말이,계란찜,계란후라이,두부조림,두부부침,마파두부,연두부,어묵볶음,오뎅볶음,감자조림,감자채볶음,메추리알장조림,장조림,멸치볶음,진미채볶음,오징어볶음,오징어채볶음,낙지볶음,쭈꾸미볶음,주꾸미볶음,제육쌈밥,보쌈,수육,족발,고등어구이,고등어조림,삼치구이,갈치조림,갈치구이,임연수구이,꽁치조림,코다리조림,가자미구이,연어구이,새우튀김,오징어튀김,야채튀김,고구마튀김,김말이튀김,김말이,탕수육,깐풍기,유린기,칠리새우,잡채,당면,떡볶이,라볶이,순대,찰순대,순대볶음,부침개,김치전,해물파전,부추전,호박전,동태전,감자전,녹두전,콩나물무침,숙주나물,시금치나물,고사리나물,도라지무침,무생채,오이무침,오이소박이,파래무침,미역줄기볶음,애호박볶음,가지볶음,버섯볶음,브로콜리,양배추쌈,상추쌈,쌈채소,샐러드,콘샐러드,마카로니샐러드,감자샐러드,단호박샐러드,코울슬로,떡갈비,카레라이스,카레,짜장,짜장밥,볶음밥,김치볶음밥,비빔밥,오므라이스,잔치국수,비빔국수,쫄면,우동,짬뽕,라면,한강라면,소고기무국,미역국,된장국,된장찌개,김치찌개,순두부찌개,부대찌개,육개장,설렁탕,갈비탕,콩나물국,북엇국,황태국,어묵국,떡국,만둣국,감자국,배추국,시래기국,아욱국,유부장국,계란국,순댓국,뼈해장국,감자탕,닭개장,곰탕,추어탕,청국장,식혜,수정과,요구르트,야쿠르트,아이스크림,과일,수박,귤,바나나,사과,요거트,푸딩,커피,아이스티,매실차,누룽지,숭늉,토스트,와플,떡,인절미,시리얼,흑미밥,잡곡밥,쌀밥,배추김치,깍두기,총각김치,열무김치').split(',');
function editDist(a, b) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
function snapDish(line) {
  const k = line.replace(/\s/g, '');
  if (DISH_DICT.includes(k)) return { text: line, known: true };
  if (k.length < 2) return { text: line, known: false };
  const lim = k.length >= 6 ? 2 : 1;
  let best = null, bd = 9;
  for (const d of DISH_DICT) {
    if (k.length === 2 && d.length !== 2) continue; // 두 글자는 같은 길이 단어로만 (잡재→잡채, 식해→식혜)
    const x = editDist(k, d); if (x < bd) { bd = x; best = d; }
  }
  return bd <= lim ? { text: best, known: true } : { text: line, known: false };
}

const OCR_SKIP = /^(백?미?밥|쌀밥|흰쌀밥|잡곡밥|흑미밥|공기밥|현미밥|배추김치|김치|포기김치|깍두기|총각김치|열무김치|맛김치|오늘의?메뉴|오늘의?식단|점심메뉴|메뉴|중식|석식|조식|런치|lunch|menu|today|월|화|수|목|금|토|일|월요일|화요일|수요일|목요일|금요일|토요일|일요일)$/i;
const OCR_NOISE = /(맛있게|드세요|감사|영업|오픈|마감|문의|예약|주차|가격|인분|매장|포장|배달|문정|송파|가든파이브|휴무|공지|안내|이벤트|팔로우|좋아요|댓글|게시물|사장님|손님|여러분|오늘도|든든|행복|하세요|합니다|입니다|있습니다|드립니다|무한리필|뷔페|식당|한식)/;
const OCR_SOUP = /(국|탕|찌개|전골|개장|스프|수프|짬뽕|우동|국수|미역국|곰탕)$/;
const OCR_DESSERT = /(음료|주스|쥬스|커피|식혜|수정과|요구르트|요거트|야쿠르트|아이스크림|아이스티|과일|후식|디저트|케이크|쿠키|빵|떡|라면|쿨피스|콜라|사이다|매실차|녹차|차$|푸딩|젤리|샐러드바|누룽지|숭늉|토스트|와플|시리얼)/;
const OCR_MAIN_HINT = /(떡갈비|떡볶이|라볶이|고기|돼지|소고기|불고기|제육|닭|치킨|오리|갈비|삼겹|목살|보쌈|족발|수육|장어|생선|고등어|삼치|갈치|연어|오징어|낙지|쭈꾸미|주꾸미|새우|떡갈비|함박|돈까스|돈가스|까스|커틀릿|탕수육|강정|볶음|찜|구이|조림|튀김|전$|잡채|순대|동그랑땡|너겟|소시지|햄|카레|짜장|덮밥|비빔|스테이크|미트볼)/;

function cleanOcrLine(s) {
  return String(s)
    .replace(/[#@][^\s]+/g, ' ')                                   // 해시태그·멘션
    .replace(/\d{1,2}\s*[\/.월]\s*\d{1,2}\s*(일)?\s*(\([^)]*\))?/g, ' ') // 날짜
    .replace(/[\d,]+\s*원/g, ' ')                                   // 가격
    .replace(/\(\s*[월화수목금토일]\s*\)|[월화수목금토일]요일/g, ' ')                // 요일
    .replace(/(오늘|금일|이번\s*주|내일)?\s*의?\s*(점심|중식|런치)?\s*(메뉴|식단|메뉴판)(입니다|이에요|예요)?/g, ' ')
    .replace(/[^가-힣a-zA-Z&\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function parseMenuText(text) {
  const out = { mains: [], soup: [], dessert: [], lines: [], known: 0, knownSet: new Set() };
  const seen = new Set();
  String(text).split(/\n|·|•|\||,|\/|ㆍ/).forEach(raw => {
    let line = cleanOcrLine(raw);
    let key = line.replace(/\s/g, '');
    if (key.length < 2 || key.length > 18 || seen.has(key)) return;
    if (!/[가-힣]{2,}/.test(key)) return;            // 한글 2자 이상 없는 줄은 잡음
    if (/[가-힣]\s[가-힣]\s[가-힣]\s[가-힣]/.test(line)) return; // 한 글자씩 흩어진 잡음
    const sn = snapDish(line);
    const sk = sn.text.replace(/\s/g, '');
    if (seen.has(sk)) return;
    seen.add(key); seen.add(sk);
    line = sn.text; key = sk;
    if (sn.known) out.known++;
    out.lines.push(line);
    if (OCR_SKIP.test(key)) return;
    if (!sn.known && OCR_NOISE.test(key)) return;
    if (sn.known) out.knownSet.add(line);
    if (OCR_DESSERT.test(key) && !OCR_MAIN_HINT.test(key)) out.dessert.push(line);
    else if (OCR_SOUP.test(key)) out.soup.push(line);
    else out.mains.push(line);
  });
  // 고기·튀김 같은 '메인스러운' 반찬을 앞으로
  const rank = x => (OCR_MAIN_HINT.test(x) ? 0 : 2) + (out.knownSet.has(x) ? 0 : 1);
  out.mains.sort((a, b) => rank(a) - rank(b));
  // 사전에도 없고 반찬 같지도 않은 줄(대개 잘못 읽은 글자)은 메인이 충분하면 빼고, 아래 '인식된 글자'에서 골라 넣게 함
  const sure = out.mains.filter(x => rank(x) < 3);
  if (sure.length >= 3) out.mains = sure;
  return out;
}

async function handleMenuPhoto(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const prev = document.getElementById('ocrPreview');
  prev.src = URL.createObjectURL(file); prev.classList.remove('hidden');
  setOcrStatus('⏳ 인식 도구 준비 중... (처음 한 번은 10초쯤 걸려요)');
  try {
    const [worker, img] = await Promise.all([loadOcrWorker(), loadImg(file)]);
    const variants = prepMenuVariants(img);
    URL.revokeObjectURL(img.src);
    // 여러 방식(사진 3종 × 읽기 모드 2종)으로 읽고, 사전에 있는 반찬이 가장 많이 나온 결과를 씀
    let r = null, bestScore = -1, n = 0;
    const total = variants.length * 2;
    for (const psm of ['11', '6']) {
      await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
      for (const cv of variants) {
        n++;
        setOcrStatus(`🔍 글자 읽는 중... (${n}/${total})`);
        const { data } = await worker.recognize(cv);
        // 확신도 낮은 줄(잡음)은 버림
        const lines = (data.lines && data.lines.length) ? data.lines.filter(l => (l.confidence || 0) >= 45).map(l => l.text).join('\n') : (data.text || '');
        const cand = parseMenuText(lines);
        const score = cand.known * 3 + cand.mains.length + cand.soup.length + cand.dessert.length - Math.max(0, cand.lines.length - cand.known - 8);
        if (score > bestScore) { bestScore = score; r = cand; }
        if (cand.known >= 8) break;
      }
      if (r && r.known >= 8) break;
    }
    r = r || parseMenuText('');
    if (!r.lines.length) { setOcrStatus('😢 글자를 못 찾았어요. 메뉴 부분만 크게 캡처해서 다시 올려주세요.'); return; }
    const set = (id, arr, n) => { if (arr.length) document.getElementById(id).value = arr.slice(0, n).join(', '); };
    set('formRestMains', r.mains, 6);
    set('formRestSoup', r.soup, 2);
    set('formRestDessert', r.dessert, 3);
    const now = new Date();
    document.getElementById('formRestDate').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const wrap = document.getElementById('ocrRawWrap'), box = document.getElementById('ocrLines');
    box.innerHTML = r.lines.map(l => `<button type="button" class="px-2 py-0.5 rounded-full bg-white border border-slate-200 hover:border-orange-400 text-slate-700" onclick="addOcrLineToMains(this.textContent)">${esc(l)}</button>`).join('');
    wrap.classList.remove('hidden');
    setOcrStatus(`✅ 메인 ${Math.min(6, r.mains.length)}개 · 국 ${Math.min(2, r.soup.length)}개 · 후식 ${Math.min(3, r.dessert.length)}개를 채웠어요. 틀린 글자는 고친 뒤 저장해 주세요!`);
  } catch (e) {
    setOcrStatus('⚠️ ' + (e && e.message ? e.message : '인식 실패') + ' — 다시 시도해 주세요');
  }
}
function addOcrLineToMains(line) {
  const el = document.getElementById('formRestMains');
  const cur = el.value.split(',').map(s => s.trim()).filter(Boolean);
  if (!cur.includes(line)) cur.push(line);
  el.value = cur.join(', ');
}
function resetOcrBox() {
  setOcrStatus('');
  ['ocrPreview', 'ocrRawWrap'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
}
// 식단 창이 열려 있을 때 Ctrl+V 로 사진 붙여넣기
document.addEventListener('paste', e => {
  const modal = document.getElementById('addModal');
  if (!modal || modal.classList.contains('hidden')) return;
  const item = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.type && i.type.startsWith('image/'));
  if (!item) return;
  e.preventDefault();
  handleMenuPhoto(item.getAsFile());
});
