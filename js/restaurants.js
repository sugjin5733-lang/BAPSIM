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

  const syncIcon = document.getElementById('sheetSyncIcon');
  if (syncIcon) syncIcon.classList.add('animate-spin');

  try {
    const res = await fetch(GOOGLE_SHEET_API_URL);
    const sheetData = await res.json();

    if (sheetData && Object.keys(sheetData).length > 0) {
      for (const key of Object.keys(sheetData)) {
        const rest = sheetData[key];

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
            <span>${isVoted ? '투표 완료됨 (다시 눌러 취소)' : '여기로 투표'}</span>
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

function castVote(id) {
  if (!checkApprovalGuard()) return;
  if (currentGroupId === 'lobby') {
    openGroupListModal();
    return;
  }

  const votePath = `groups/${currentGroupId}/votes`;
  const chatPath = `groups/${currentGroupId}/messages`;

  if (myVotedId === id) {
    db.ref(`${votePath}/${id}`).transaction(v => Math.max(0, (v || 1) - 1));
    myVotedId = null;
    localStorage.removeItem(`bapsim_my_vote_${currentGroupId}`);
  } else {
    if (myVotedId) {
      db.ref(`${votePath}/${myVotedId}`).transaction(v => Math.max(0, (v || 1) - 1));
    }
    db.ref(`${votePath}/${id}`).transaction(v => (v || 0) + 1);
    myVotedId = id;
    localStorage.setItem(`bapsim_my_vote_${currentGroupId}`, id);

    db.ref(chatPath).push({
      type: 'system',
      text: `🔔 ${currentUser.nickname}님이 [${restaurants[id]?.name || '식당'}]에 투표하셨습니다!`,
      timestamp: Date.now()
    });
  }
  renderCards();
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
  // 신규 그룹은 해시(passwordHash), 기존 그룹은 평문(password) 둘 다 지원
  const ok = g && ((g.passwordHash && g.passwordHash === passHash) || (!g.passwordHash && g.password === pass));
  if (ok) {
    // 기존 평문 비밀번호 그룹은 입장 성공 시 해시로 자동 전환
    if (!g.passwordHash) db.ref(`groups/${g.id}`).update({ passwordHash: passHash, password: null });
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
  db.ref(`groups/${gid}`).set({ id: gid, name: groupName, passwordHash: passwordHash, leader: currentUser.nickname }, () => {
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
  myVotedId = localStorage.getItem(`bapsim_my_vote_${currentGroupId}`);
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
  renderCards();
}

function attachVotesListener() {
  if (groupVotesRef) groupVotesRef.off();
  const votePath = currentGroupId === 'lobby' ? 'lobby_votes' : `groups/${currentGroupId}/votes`;
  groupVotesRef = db.ref(votePath);
  groupVotesRef.on('value', snap => {
    groupVotesData = snap.val() || {};
    renderCards();
  });
}

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
    if (err) return alert('저장 오류');
    db.ref('point_requests').push({
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
