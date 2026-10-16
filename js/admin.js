// 밥심 - 관리자 대시보드

function adminEquipSelf() {
  myNickBg = 'nb-admin';
  myNickColor = '#ffffff';
  myNickSymbol = '👑';
  if (!myInventory.bgs.includes('nb-admin')) myInventory.bgs.push('nb-admin');
  if (!myInventory.symbols.includes('👑')) myInventory.symbols.push('👑');
  if (!myInventory.colors.includes('#ffffff')) myInventory.colors.push('#ffffff');
  updatePointsUI();
  alert("👑 [관리자 전용] 애니메이션 배지, 순백색(#ffffff) 닉네임, 왕관 칭호가 즉시 장착되었습니다!");
}

function adminSendSpecialSticker(stickerType) {
  const chatPath = currentGroupId === 'lobby' ? 'lobby_messages' : `groups/${currentGroupId}/messages`;
  db.ref(chatPath).push({
    nickname: `[관리자] ${currentUser.nickname}`,
    sticker: stickerType,
    color: '#ffffff',
    bg: 'nb-admin',
    symbol: '👑',
    timestamp: Date.now()
  });
  alert("공권력 관리자 이모티콘이 채팅방에 전파되었습니다.");
}

function handleSaveNotice() {
  const text = document.getElementById('adminNoticeTextarea').value.trim();
  if (!text) return alert("공지 내용을 입력하세요.");

  const now = new Date();
  const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  db.ref('site_notice').set({
    text: text,
    date: dateStr,
    updatedBy: currentUser.nickname
  }, (err) => {
    if (err) return alert("공지 저장 실패: " + err.message);
    alert("✅ 공지사항이 전체 화면에 실시간 전파되었습니다!");
  });
}

// 관리자 키보드 단축키
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    openAdminAuthModal();
  }
});

function openAdminAuthModal() {
  document.getElementById('adminPassInput').value = '';
  document.getElementById('adminAuthModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('adminPassInput').focus(), 100);
}
function closeAdminAuthModal() { document.getElementById('adminAuthModal').classList.add('hidden'); }

// 관리자 비밀번호는 소스에 평문으로 두지 않고 해시로만 보관합니다.
// 비밀번호를 바꾸려면: 브라우저 콘솔에서 sha256('새비밀번호').then(console.log) 실행 후 나온 값을 아래에 붙여넣기
const ADMIN_PASS_HASH = '94aab701b8439ab72db15e01a954856850028c741b4a70874952bf3f9edfa0d7';
async function checkAdminPassword() {
  const h = await sha256(document.getElementById('adminPassInput').value.trim());
  if (h === ADMIN_PASS_HASH) {
    closeAdminAuthModal();
    openAdminDashboard();
  } else {
    alert('비밀번호 불일치');
  }
}

function openAdminDashboard() {
  document.getElementById('adminDashboardModal').classList.remove('hidden');
  if (window.__adminListenersAttached) return; // 열 때마다 리스너가 중복 등록되던 문제 방지
  window.__adminListenersAttached = true;
  loadPendingPointRequests();
  renderAdminUserList();
  renderAdminGroupList();
  renderAdminPendingUsers();
}
function closeAdminDashboard() { document.getElementById('adminDashboardModal').classList.add('hidden'); }

function renderAdminPendingUsers() {
  db.ref('user_points').on('value', (snap) => {
    const users = snap.val() || {};
    const container = document.getElementById('adminPendingUsersContainer');
    const pendingList = Object.values(users).filter(u => u.status === 'pending');
    const cntEl = document.getElementById('pendingUserCount');
    if (cntEl) cntEl.textContent = `${pendingList.length}명 대기`;
    if (!container) return;
    container.innerHTML = '';

    if (pendingList.length === 0) {
      container.innerHTML = '<div class="text-center text-slate-400 py-3">승인 대기 중인 회원이 없습니다.</div>';
      return;
    }

    pendingList.forEach(u => {
      const item = document.createElement('div');
      item.className = "p-2.5 bg-white border rounded-xl flex items-center justify-between";
      item.innerHTML = `
        <div class="min-w-0 pr-2">
          <span class="font-bold text-slate-900 truncate block">${esc(u.nickname)}</span>
          <span class="text-[10px] text-slate-400">가입신청: ${new Date(u.createdAt || Date.now()).toLocaleDateString()}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="adminApproveUser(${jsArg(u.nickname)})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-xs">
            승인
          </button>
          <button onclick="adminRejectUser(${jsArg(u.nickname)})" class="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-2.5 py-1 rounded-lg text-[11px]">
            거절
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  });
}

function adminApproveUser(nick) {
  db.ref(`user_points/${nick}`).update({ status: 'approved', approved: true }, (err) => {
    if (err) return alert("오류: " + err.message);
    alert(`✅ [${nick}] 회원의 가입을 승인했습니다.`);
  });
}

function adminRejectUser(nick) {
  if (!confirm(`[${nick}] 회원의 가입을 거절하고 삭제하시겠습니까?`)) return;
  db.ref(`user_points/${nick}`).remove(() => {
    db.ref(`online_users/${nick}`).remove();
    alert(`[${nick}] 회원의 가입 신청이 거절되었습니다.`);
  });
}

function renderAdminUserList() {
  db.ref('user_points').on('value', (snap) => {
    const users = snap.val() || {};
    const container = document.getElementById('adminUserListContainer');
    const list = Object.values(users).filter(u => u.status !== 'pending');
    const cntEl = document.getElementById('adminTotalUserCount');
    if (cntEl) cntEl.textContent = `${list.length}명`;
    if (!container) return;
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<div class="text-center text-slate-400 py-3">등록된 회원이 없습니다.</div>';
      return;
    }

    list.sort((a, b) => (b.points || 0) - (a.points || 0));

    list.forEach(u => {
      const item = document.createElement('div');
      item.className = "p-2 bg-white border rounded-xl flex items-center justify-between";
      const eLvl = u.enhanceLevel || 0;
      item.innerHTML = `
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-bold text-slate-800 truncate">${esc(u.nickname)}</span>
          <span class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-black shrink-0">
            ${(u.points || 0).toLocaleString()}P
          </span>
          <span class="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 px-1 py-0.2 rounded font-black shrink-0">
            +${eLvl}강
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="adminManageUserItems(${jsArg(u.nickname)})" class="bg-amber-50 text-amber-800 font-bold px-2 py-1 rounded-lg text-[10px]">
            아이템
          </button>
          <button onclick="adminQuickSetPoint(${jsArg(u.nickname)})" class="bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-lg text-[10px]">
            포인트
          </button>
          <button onclick="adminDeleteUser(${jsArg(u.nickname)})" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded-lg text-[10px]">
            삭제
          </button>
          <button onclick="adminBanUser(${jsArg(u.nickname)})" class="bg-rose-500 hover:bg-rose-600 text-white font-bold px-2 py-1 rounded-lg text-[10px]">
            차단
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  });
}

function adminDeleteUser(nick) {
  if (!confirm(`[${nick}] 회원을 삭제하시겠습니까?\n해당 회원의 데이터가 초기화됩니다.`)) return;
  db.ref(`user_points/${nick}`).remove((err) => {
    if (err) return alert("회원 삭제 실패: " + err.message);
    db.ref(`online_users/${nick}`).remove();
    alert(`✅ [${nick}] 회원이 삭제되었습니다.`);
  });
}

function adminBanUser(nick) {
  if (!confirm(`🚨 경고: [${nick}] 회원을 영구 차단하시겠습니까?\n차단된 닉네임은 다시는 사용할 수 없으며, 모든 계정 정보가 즉시 삭제됩니다.`)) return;

  db.ref(`banned_users/${nick}`).set({
    nickname: nick,
    bannedAt: Date.now()
  }, (err) => {
    if (err) return alert("차단 처리 오류: " + err.message);

    db.ref(`user_points/${nick}`).remove();
    db.ref(`online_users/${nick}`).remove();

    alert(`⛔ [${nick}] 회원이 영구 차단되었습니다.\n해당 닉네임으로는 앞으로 가입할 수 없습니다.`);
  });
}

function adminManageUserItems(nick) {
  const choice = prompt(`[${nick}] 회원의 아이템 관리\n1: 모든 아이템 몰수 및 인벤토리 영구 삭제\n2: 코스믹 레인보우 선물\n3: 태양의 겁화 선물\n4: 원하는 배지 클래스명 직접 입력\n\n번호를 입력하세요:`);
  if (!choice) return;

  if (choice === '1') {
    db.ref(`user_points/${nick}`).update({
      badge: 'nb-none',
      color: '',
      symbol: '',
      inventory: { colors: [], bgs: ['nb-none'], symbols: [] },
      resetInventory: true
    });
    alert(`[${nick}] 회원의 모든 치장 아이템이 완벽히 몰수 및 삭제되었습니다.`);
  } else if (choice === '2') {
    db.ref(`user_points/${nick}`).once('value', snap => {
      const u = snap.val() || {};
      const inv = u.inventory || { colors: [], bgs: ['nb-none'], symbols: [] };
      if (!inv.bgs) inv.bgs = ['nb-none'];
      if (!inv.bgs.includes('nb-cosmic')) inv.bgs.push('nb-cosmic');
      db.ref(`user_points/${nick}`).update({ badge: 'nb-cosmic', inventory: inv });
      alert(`[${nick}] 회원에게 코스믹 레인보우 배지를 지급 및 장착시켰습니다.`);
    });
  } else if (choice === '3') {
    db.ref(`user_points/${nick}`).once('value', snap => {
      const u = snap.val() || {};
      const inv = u.inventory || { colors: [], bgs: ['nb-none'], symbols: [] };
      if (!inv.bgs) inv.bgs = ['nb-none'];
      if (!inv.bgs.includes('nb-solar')) inv.bgs.push('nb-solar');
      db.ref(`user_points/${nick}`).update({ badge: 'nb-solar', inventory: inv });
      alert(`[${nick}] 회원에게 태양의 겁화 배지를 지급 및 장착시켰습니다.`);
    });
  } else if (choice === '4') {
    const bgName = prompt("배지 클래스명을 입력하세요 (예: nb-admin, nb-abyss, nb-cyberaurora, nb-infinity, nb-gold):");
    if (bgName) {
      db.ref(`user_points/${nick}`).once('value', snap => {
        const u = snap.val() || {};
        const inv = u.inventory || { colors: [], bgs: ['nb-none'], symbols: [] };
        if (!inv.bgs) inv.bgs = ['nb-none'];
        if (!inv.bgs.includes(bgName)) inv.bgs.push(bgName);
        db.ref(`user_points/${nick}`).update({ badge: bgName, inventory: inv });
        alert(`[${nick}] 회원에게 ${bgName} 배지를 지급 및 장착시켰습니다.`);
      });
    }
  }
}

function adminQuickSetPoint(nick) {
  const val = prompt(`[${nick}] 회원의 새 포인트 값을 입력하세요:`);
  if (val === null) return;
  const num = parseInt(val, 10);
  if (isNaN(num)) return alert("숫자만 입력 가능합니다.");

  db.ref(`user_points/${nick}/points`).set(num, (err) => {
    if (err) return alert("오류: " + err.message);
    if (currentUser.nickname === nick) {
      userPoints = num;
      updatePointsUI(false);
    }
    alert(`[${nick}] 님의 포인트가 ${num.toLocaleString()}P 로 변경되었습니다.`);
  });
}

function handleAdminResetAllItems() {
  const confirmCode = prompt("🚨 경고: 모든 회원의 보유 아이템 및 착용 치장이 전부 몰수 및 삭제됩니다!\n진행하시려면 '아이템삭제'를 입력하세요.");
  if (confirmCode !== "아이템삭제") return alert("아이템 몰수 작업이 취소되었습니다.");

  db.ref('user_points').once('value', (snap) => {
    const users = snap.val() || {};
    const updates = {};
    Object.keys(users).forEach(nick => {
      updates[`user_points/${nick}/badge`] = 'nb-none';
      updates[`user_points/${nick}/color`] = '';
      updates[`user_points/${nick}/symbol`] = '';
      updates[`user_points/${nick}/inventory`] = { colors: [], bgs: ['nb-none'], symbols: [] };
      updates[`user_points/${nick}/resetInventory`] = true;
    });

    db.ref().update(updates, (err) => {
      if (err) return alert("아이템 몰수 실패: " + err.message);
      myInventory = { colors: [], bgs: ['nb-none'], symbols: [] };
      myNickBg = 'nb-none';
      myNickColor = '';
      myNickSymbol = '';
      updatePointsUI(false);
      renderShopUI();
      alert("✅ 모든 회원의 보유 아이템 및 치장이 성공적으로 몰수/삭제되었습니다.");
    });
  });
}

function handleAdminResetAllPoints() {
  const confirmCode = prompt("경고: 모든 회원의 보유 포인트가 '0P'로 초기화됩니다!\n진행하시려면 '초기화'를 입력하세요.");
  if (confirmCode !== "초기화") return alert("초기화가 취소되었습니다.");

  db.ref('user_points').once('value', (snap) => {
    const users = snap.val() || {};
    const updates = {};
    Object.keys(users).forEach(nick => { updates[`user_points/${nick}/points`] = 0; });

    db.ref().update(updates, (err) => {
      if (err) return alert("초기화 실패: " + err.message);
      userPoints = 0;
      localStorage.setItem('bapsim_points', '0');
      updatePointsUI(false);
      alert("모든 회원의 포인트가 0P로 초기화되었습니다.");
    });
  });
}

function handleAdminResetAllVotes() {
  if (!confirm('전체 투표수를 리셋하시겠습니까?')) return;
  db.ref('lobby_votes').remove();
  db.ref('groups').once('value', snap => {
    const groups = snap.val() || {};
    Object.keys(groups).forEach(gid => db.ref(`groups/${gid}/votes`).remove());
  });
  alert('투표 리셋 완료');
}

function renderAdminGroupList() {
  db.ref('groups').on('value', (snap) => {
    const groups = snap.val() || {};
    const container = document.getElementById('adminGroupListContainer');
    const list = Object.values(groups);
    const cntEl = document.getElementById('adminGroupCount');
    if (cntEl) cntEl.textContent = `${list.length}개`;
    if (!container) return;
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<div class="text-center text-slate-400 py-3">개설된 그룹이 없습니다.</div>';
      return;
    }

    list.forEach(g => {
      const item = document.createElement('div');
      item.className = "p-2 bg-white border rounded-xl flex items-center justify-between";
      item.innerHTML = `
        <div class="min-w-0 pr-2">
          <span class="font-bold text-slate-800 truncate block">${esc(g.name)}</span>
          <span class="text-[10px] text-slate-400">방장: ${esc(g.leader)}</span>
        </div>
        <button onclick="adminDeleteGroup(${jsArg(g.id)}, ${jsArg(g.name)})" class="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-2 py-1 rounded-lg text-[10px] shrink-0">
          삭제
        </button>
      `;
      container.appendChild(item);
    });
  });
}

function adminDeleteGroup(gid, gname) {
  if (!confirm(`[${gname}] 그룹방을 완전히 삭제하시겠습니까?`)) return;
  db.ref(`groups/${gid}`).remove(() => {
    if (currentGroupId === gid) enterGroup('lobby', '전체 공개 로비');
    alert(`[${gname}] 그룹이 삭제되었습니다.`);
  });
}

function loadPendingPointRequests() {
  db.ref('point_requests').on('value', (snap) => {
    const data = snap.val() || {};
    const container = document.getElementById('adminPendingListContainer');
    const list = Object.entries(data).filter(([k, v]) => v.status === 'pending');
    const countEl = document.getElementById('pendingRequestCount');
    if (countEl) countEl.textContent = `${list.length}건 대기 중`;
    if (!container) return;
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<div class="text-center text-slate-400 py-4 text-xs">승인 대기 요청이 없습니다.</div>';
      return;
    }

    list.forEach(([reqId, req]) => {
      const item = document.createElement('div');
      item.className = "p-3 bg-slate-50 border rounded-2xl flex items-center justify-between text-xs";
      item.innerHTML = `
        <div>
          <div class="font-bold text-slate-800">[${esc(req.restaurantName)}] 식단 등록</div>
          <div class="text-[10px] text-slate-500">신청자: ${esc(req.nickname)} · ${esc(req.date)}</div>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="approvePointRequest(${jsArg(reqId)}, ${jsArg(req.nickname)}, ${Number(req.amount) || 50})" class="bg-emerald-600 text-white font-bold px-2.5 py-1.5 rounded-xl text-[11px]">승인 (+${Number(req.amount) || 50}P)</button>
          <button onclick="rejectPointRequest(${jsArg(reqId)})" class="bg-rose-100 text-rose-700 font-bold px-2.5 py-1.5 rounded-xl text-[11px]">반려</button>
        </div>
      `;
      container.appendChild(item);
    });
  });
}

function approvePointRequest(reqId, nickname, amount) {
  db.ref(`point_requests/${reqId}/status`).set('approved');
  db.ref(`user_points/${nickname}/points`).transaction((curr) => (curr || 0) + amount);
  alert('승인 완료');
}

function rejectPointRequest(reqId) {
  db.ref(`point_requests/${reqId}/status`).set('rejected');
  alert('반려 완료');
}
