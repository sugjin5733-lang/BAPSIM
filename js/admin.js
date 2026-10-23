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
    uid: authUser.uid,
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

// 관리자 화면 열기: Ctrl+Shift+A 또는 프로필 화면의 [관리자 대시보드] 버튼
// (관리자 여부는 구글 계정으로 판별하고, 실제 권한은 Firebase 보안 규칙이 막아줍니다)
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    openAdminDashboard();
  }
});

function openAdminDashboard() {
  if (!isAdmin) {
    alert('관리자 구글 계정으로 로그인해야 열 수 있어요.');
    return;
  }
  closeAuthModal();
  document.getElementById('adminDashboardModal').classList.remove('hidden');
  if (window.__adminListenersAttached) return; // 열 때마다 리스너가 중복 등록되던 문제 방지
  window.__adminListenersAttached = true;
  migrateLegacyData();
  renderAnomalyPanel();
  loadPendingPointRequests();
  renderAdminUserList();
  renderAdminGroupList();
  renderAdminSignupRequests();
  renderAdminRenameRequests();
}
function closeAdminDashboard() { document.getElementById('adminDashboardModal').classList.add('hidden'); }

// 예전 방식의 비밀번호 데이터를 정리 (한 번 돌면 이후엔 할 일이 없음)
//  - 회원의 4자리 비밀번호(평문/해시)는 구글 로그인으로 바뀌어 더 이상 필요 없으므로 삭제
//  - 그룹 입장 비밀번호 평문은 해시로 전환
async function migrateLegacyData() {
  try {
    const [usersSnap, groupsSnap] = await Promise.all([db.ref('user_points').once('value'), db.ref('groups').once('value')]);
    const updates = {};
    Object.entries(usersSnap.val() || {}).forEach(([nick, u]) => {
      if (u && u.password !== undefined) updates[`user_points/${nick}/password`] = null;
      if (u && u.passwordHash !== undefined) updates[`user_points/${nick}/passwordHash`] = null;
    });
    for (const [gid, g] of Object.entries(groupsSnap.val() || {})) {
      if (g && g.password !== undefined && g.password !== null) {
        if (!g.passwordHash) updates[`groups/${gid}/passwordHash`] = await sha256(String(g.password));
        updates[`groups/${gid}/password`] = null;
      }
    }
    const n = Object.keys(updates).length;
    if (n === 0) return;
    await db.ref().update(updates);
    console.log(`예전 비밀번호 데이터 ${n}건 정리 완료`);
  } catch (err) {
    console.error('예전 데이터 정리 실패:', err);
  }
}

// ==========================================
// 가입 / 기존 닉네임 연결 요청 승인
// ==========================================
let adminUsersCache = {};

function renderAdminSignupRequests() {
  const draw = (requests) => {
    const container = document.getElementById('adminPendingUsersContainer');
    const list = Object.values(requests || {}).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const cntEl = document.getElementById('pendingUserCount');
    if (cntEl) cntEl.textContent = `${list.length}명 대기`;
    if (!container) return;
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<div class="text-center text-slate-400 py-3">승인 대기 중인 요청이 없습니다.</div>';
      return;
    }

    list.forEach(r => {
      const existing = adminUsersCache[r.nickname];
      const isClaim = r.type === 'claim';
      let warn = '';
      if (isClaim && !existing) warn = '⚠️ 이 닉네임의 기존 회원 정보가 없어요';
      else if (!isClaim && existing) warn = '⚠️ 이미 있는 닉네임이에요';
      else if (isClaim && existing && existing.uid) warn = '⚠️ 이미 다른 구글 계정에 연결된 닉네임 (승인 시 이 계정으로 옮겨짐)';

      const item = document.createElement('div');
      item.className = "p-2.5 bg-white border rounded-xl flex items-center justify-between gap-2";
      item.innerHTML = `
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-black px-1.5 py-0.5 rounded ${isClaim ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}">${isClaim ? '기존 연결' : '신규 가입'}</span>
            <span class="font-bold text-slate-900 truncate">${esc(r.nickname)}</span>
            ${isClaim && existing ? `<span class="text-[10px] text-amber-700 font-bold">${(existing.points || 0).toLocaleString()}P · +${existing.enhanceLevel || 0}강</span>` : ''}
          </div>
          <span class="text-[10px] text-slate-500 block truncate">${esc(r.displayName || '')} · ${esc(r.email || '')}</span>
          ${warn ? `<span class="text-[10px] text-rose-600 font-bold block">${esc(warn)}</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="adminApproveRequest(${jsArg(r.uid)})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] shadow-xs">승인</button>
          <button onclick="adminRejectRequest(${jsArg(r.uid)})" class="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-2.5 py-1 rounded-lg text-[11px]">거절</button>
        </div>
      `;
      container.appendChild(item);
    });
  };
  let lastRequests = {};
  db.ref('signup_requests').on('value', snap => { lastRequests = snap.val() || {}; draw(lastRequests); }, onDbError);
  db.ref('user_points').on('value', snap => { adminUsersCache = snap.val() || {}; draw(lastRequests); });
}

async function adminApproveRequest(uid, silent = false) {
  try {
    const reqSnap = await db.ref(`signup_requests/${uid}`).once('value');
    const r = reqSnap.val();
    if (!r) return alert('요청을 찾을 수 없어요. (이미 처리되었을 수 있어요)');
    const nick = r.nickname;
    const userSnap = await db.ref(`user_points/${nick}`).once('value');
    const existing = userSnap.val();

    if (r.type === 'claim' && !existing) return alert(`[${nick}] 기존 회원 정보가 없어서 연결할 수 없어요. 거절 후 신규 가입으로 안내해주세요.`);
    if (r.type !== 'claim' && existing) return alert(`[${nick}] 은(는) 이미 있는 닉네임이라 신규 가입으로 승인할 수 없어요.`);
    if (!silent && !confirm(r.type === 'claim'
      ? `[${nick}] 기존 닉네임을 ${r.email} 계정에 연결할까요?\n(포인트 ${(existing.points || 0).toLocaleString()}P, +${existing.enhanceLevel || 0}강 유지)`
      : `[${nick}] 신규 가입을 승인할까요? (${r.email})`)) return;

    const updates = {};
    updates[`user_uids/${uid}`] = nick;
    updates[`signup_requests/${uid}`] = null;
    if (existing) {
      // 이 닉네임이 예전에 다른 구글 계정에 연결돼 있었다면 그 연결은 해제
      if (existing.uid && existing.uid !== uid) updates[`user_uids/${existing.uid}`] = null;
      updates[`user_points/${nick}/uid`] = uid;
      updates[`user_points/${nick}/status`] = 'approved';
      updates[`user_points/${nick}/approved`] = true;
      updates[`user_points/${nick}/password`] = null;
      updates[`user_points/${nick}/passwordHash`] = null;
    } else {
      updates[`user_points/${nick}`] = {
        nickname: nick, uid: uid, points: 30, enhanceLevel: 0,
        badge: 'nb-none', color: '', symbol: '',
        inventory: { colors: [], bgs: ['nb-none'], symbols: [] },
        status: 'approved', approved: true,
        createdAt: Date.now(), updatedAt: Date.now()
      };
    }
    await db.ref().update(updates);
    if (!silent) alert(`✅ [${nick}] 승인 완료!`);
  } catch (err) {
    alert('승인 중 오류: ' + (err.message || err));
  }
}

async function adminRejectRequest(uid) {
  const snap = await db.ref(`signup_requests/${uid}`).once('value');
  const r = snap.val();
  if (!r) return;
  if (!confirm(`[${r.nickname}] 요청을 거절할까요?`)) return;
  await db.ref(`signup_requests/${uid}`).remove();
}

function renderAdminUserList() {
  db.ref('user_points').on('value', (snap) => {
    const users = snap.val() || {};
    const container = document.getElementById('adminUserListContainer');
    const list = Object.values(users).filter(u => u && u.nickname);
    const cntEl = document.getElementById('adminTotalUserCount');
    const linked = list.filter(u => u.uid).length;
    if (cntEl) cntEl.textContent = `${list.length}명 · 구글 연결 ${linked}명`;
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
          <span class="text-[10px] ${u.uid ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-500 bg-slate-50 border-slate-200'} border px-1 py-0.2 rounded font-bold shrink-0">
            ${u.uid ? 'G 연결' : '미연결'}
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="openPointLog(${jsArg(u.nickname)})" class="bg-slate-50 text-slate-700 font-bold px-2 py-1 rounded-lg text-[10px]">
            내역
          </button>
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

// 회원 삭제/차단 시 닉네임, 구글 연결, 접속 표시를 한 번에 정리
async function removeUserRecords(nick, extra = {}) {
  const snap = await db.ref(`user_points/${nick}`).once('value');
  const u = snap.val() || {};
  const updates = Object.assign({
    [`user_points/${nick}`]: null,
    [`online_users/${nick}`]: null
  }, extra);
  if (u.uid) updates[`user_uids/${u.uid}`] = null;
  await db.ref().update(updates);
}

async function adminDeleteUser(nick) {
  if (!confirm(`[${nick}] 회원을 삭제하시겠습니까?\n해당 회원의 데이터가 초기화됩니다.`)) return;
  try {
    await removeUserRecords(nick);
    alert(`✅ [${nick}] 회원이 삭제되었습니다.`);
  } catch (err) {
    alert("회원 삭제 실패: " + err.message);
  }
}

async function adminBanUser(nick) {
  if (!confirm(`🚨 경고: [${nick}] 회원을 영구 차단하시겠습니까?\n차단된 닉네임은 다시는 사용할 수 없으며, 모든 계정 정보가 즉시 삭제됩니다.`)) return;
  try {
    await removeUserRecords(nick, { [`banned_users/${nick}`]: { nickname: nick, bannedAt: Date.now() } });
    alert(`⛔ [${nick}] 회원이 영구 차단되었습니다.\n해당 닉네임으로는 앞으로 가입할 수 없습니다.`);
  } catch (err) {
    alert("차단 처리 오류: " + err.message);
  }
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

async function handleAdminResetAllVotes() {
  if (!confirm('오늘 모든 그룹의 투표를 리셋하시겠습니까?\n(투표는 매일 자동으로 새로 시작되므로 보통은 필요 없어요)')) return;
  const snap = await db.ref('groups').once('value');
  const updates = { lobby_votes: null };
  Object.keys(snap.val() || {}).forEach(gid => {
    updates[`groups/${gid}/votes`] = null;                 // 예전 방식 투표수
    updates[`groups/${gid}/ballots/${todayKey()}`] = null; // 오늘 투표
  });
  await db.ref().update(updates);
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

// ==========================================
// 🚨 이상 감지 (스크립트 조작 의심 회원 찾기)
// - 관리자 대시보드를 열 때 하루 한 번 전체 회원 스냅샷 저장: admin_snapshots/{날짜}
// - 직전 스냅샷 대비 증가량 + 보유 현황으로 의심 점수 계산
// ==========================================
const ANOMALY = {
  gainSinceSnapshot: 150000, // 직전 스냅샷 이후 순증가
  points: 500000,
  legendCards: 4,
  totalCards: 150,
  items: 100,
  enhance: 18
};

function legendCount(u) {
  return Object.entries((u && u.cards) || {}).reduce((a, [id, n]) => a + ((CARD_BY_ID[id] && CARD_BY_ID[id].r === 'L') ? (Number(n) || 0) : 0), 0);
}
function cardTotal(u) {
  return Object.values((u && u.cards) || {}).reduce((a, n) => a + (Number(n) || 0), 0);
}

async function takeDailySnapshot(users) {
  const today = todayKey();
  const ref = db.ref(`admin_snapshots/${today}`);
  if ((await ref.once('value')).exists()) return;
  const snap = { at: firebase.database.ServerValue.TIMESTAMP, users: {} };
  Object.values(users).forEach(u => {
    if (!u || !u.nickname) return;
    snap.users[u.nickname] = { points: u.points || 0, enhanceLevel: u.enhanceLevel || 0, cards: cardTotal(u), legend: legendCount(u) };
  });
  await ref.set(snap);
}

// ==========================================
// 🎲 운 조작 검사: 포인트 내역으로 "이만큼 운이 좋을 확률"을 계산
//  - 대박 점프(5%), 대박 손님(5%), 더블업, 주사위·동전 적중률
//  - 회원에게 최대한 유리하게 계산 (더블업·주사위·동전은 모두 50%로, 강화는 축복+도박 가정)
//  - 우연일 확률이 100만 분의 1 아래면 🚨 조작 의심
// ==========================================
function luckTail(ps, k) {
  if (k <= 0) return 1;
  const dp = new Float64Array(ps.length + 2); dp[0] = 1;
  for (const p of ps) { for (let j = dp.length - 1; j > 0; j--) dp[j] = dp[j] * (1 - p) + dp[j - 1] * p; dp[0] *= (1 - p); }
  let s = 0; for (let j = k; j < dp.length; j++) s += dp[j];
  return Math.min(1, s);
}
// 새 시세(DB 기록) 적용 이후 판매만 검사 (예전 탭이 닫힐 시간 여유)
const MARKET_V2_FROM = Date.parse('2026-10-23T18:00:00+09:00');
function luckReport(logsObj, market) {
  const rows = Object.values(logsObj || {}).filter(r => r && typeof r.ts === 'number' && typeof r.r === 'string').sort((a, b) => a.ts - b.ts);
  const t = {};
  const sales = rows.filter(r => /밥 판매/.test(r.r)), lucky = sales.filter(r => /대박 손님/.test(r.r)).length;
  t['대박 손님'] = { n: sales.length, k: lucky, p: luckTail(sales.map(() => 0.05), lucky) };
  const du = rows.filter(r => /더블업/.test(r.r)), duW = du.filter(r => /성공/.test(r.r)).length;
  t['더블업'] = { n: du.length, k: duW, p: luckTail(du.map(() => 0.5), duW) };
  const dB = rows.filter(r => /주사위 베팅/.test(r.r)).length, dH = rows.filter(r => /주사위 적중/.test(r.r)).length;
  t['주사위'] = { n: dB, k: dH, p: luckTail(Array(dB).fill(0.5), dH) };
  const cB = rows.filter(r => /동전던지기 베팅/.test(r.r)).length, cH = rows.filter(r => /동전던지기 적중/.test(r.r)).length;
  t['동전'] = { n: cB, k: cH, p: luckTail(Array(cB).fill(0.5), cH) };
  // 대박 점프: 다음 강화 시도의 시작 단계로 결과 추정 (+5강 이상 성공 중 +2가 된 비율)
  const seq = rows.filter(r => /강화 시도 \+\d+→/.test(r.r));
  const jp = []; let jumps = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i], b = seq[i + 1];
    if (b.ts - a.ts > 3600e3) continue;
    const L = +a.r.match(/\+(\d+)→/)[1], N = +b.r.match(/\+(\d+)→/)[1];
    if (L >= 5 && (N === L + 1 || N === L + 2)) { jp.push(JUMP_CHANCE); if (N === L + 2) jumps++; }
  }
  t['대박 점프'] = { n: jp.length, k: jumps, p: luckTail(jp, jumps) };
  // 🧾 판매 시세 위조: 내역의 "시세 xN" 이 그 분(또는 직전 분)의 실제 DB 시세와 다르면
  let forged = 0, checked = 0;
  if (market) sales.filter(r => r.ts >= MARKET_V2_FROM).forEach(r => {
    const m = r.r.match(/시세 x([\d.]+)/); if (!m) return;
    const slot = Math.floor(r.ts / MARKET_SLOT_MS);
    const cands = [slot, slot - 1].map(s => market[s] ? marketFromAt(s, market[s].at).mult : null).filter(x => x != null);
    if (!cands.length) return;
    checked++;
    if (!cands.some(x => Math.abs(x - Number(m[1])) < 0.006)) forged++;
  });
  const sec = {};
  rows.filter(r => /베팅/.test(r.r)).forEach(r => { const k = Math.floor(r.ts / 1000); sec[k] = (sec[k] || 0) + 1; });
  const maxSec = Math.max(0, ...Object.values(sec));
  const minP = Math.min(...Object.values(t).map(x => x.p));
  const worst = Object.entries(t).sort((a, b) => a[1].p - b[1].p)[0];
  return { minP, maxSec, worst, tests: t, forged, checked };
}
function oneInText(p) {
  if (p <= 0) return '사실상 0';
  const n = 1 / p;
  if (n >= 1e16) return '1경 분의 1 미만 (사실상 불가능)';
  if (n >= 1e12) return `${(n / 1e12).toFixed(0)}조 분의 1`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(0)}억 분의 1`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)}만 분의 1`;
  return `${Math.round(n).toLocaleString()} 분의 1`;
}

async function renderAnomalyPanel() {
  const box = document.getElementById('adminAnomalyList');
  if (!box) return;
  box.innerHTML = '<div class="text-center text-slate-400 py-3">분석 중...</div>';
  try {
    const users = (await db.ref('user_points').once('value')).val() || {};
    await takeDailySnapshot(users);
    // 운 조작 검사용 포인트 내역 + 난수 조작 시도 기록
    let allLogs = {}, tamper = {}, market = {};
    try { market = (await db.ref('market').once('value')).val() || {}; } catch (e) {}
    try { allLogs = (await db.ref('point_logs').once('value')).val() || {}; } catch (e) {}
    try {
      const tr = (await db.ref('tamper_reports').limitToLast(300).once('value')).val() || {};
      Object.values(tr).forEach(x => { if (!x) return; const k = x.nickname || '?'; (tamper[k] = tamper[k] || []).push(x); });
    } catch (e) {}
    // 오늘 이전의 가장 최근 스냅샷과 비교
    const snaps = (await db.ref('admin_snapshots').orderByKey().limitToLast(8).once('value')).val() || {};
    const prevKey = Object.keys(snaps).filter(k => k < todayKey()).sort().pop();
    const prev = prevKey ? (snaps[prevKey].users || {}) : {};
    const baseLabel = prevKey ? `${prevKey} 대비` : '비교할 이전 기록 없음 (내일부터 증가량 비교)';

    const rows = Object.values(users).filter(u => u && u.nickname).map(u => {
      const flags = [];
      let score = 0;
      const p = prev[u.nickname];
      const gain = p ? (u.points || 0) - p.points : null;
      if (gain !== null && gain >= ANOMALY.gainSinceSnapshot) { flags.push(`📈 +${gain.toLocaleString()}P`); score += 3 + Math.floor(gain / ANOMALY.gainSinceSnapshot); }
      if ((u.points || 0) >= ANOMALY.points) { flags.push(`💰 ${(u.points).toLocaleString()}P 보유`); score += 3; }
      const lg = legendCount(u);
      if (lg >= ANOMALY.legendCards) { flags.push(`🌟 전설 카드 ${lg}장`); score += 2 + (lg - ANOMALY.legendCards); }
      const ct = cardTotal(u);
      if (ct >= ANOMALY.totalCards) { flags.push(`🃏 카드 ${ct}장`); score += 1; }
      const items = Object.values(u.items || {}).reduce((a, n) => a + (Number(n) || 0), 0);
      if (items >= ANOMALY.items) { flags.push(`🛡️ 아이템 ${items}개`); score += 1; }
      if ((u.enhanceLevel || 0) >= ANOMALY.enhance) { flags.push(`🍚 +${u.enhanceLevel}강`); score += 1; }
      if (p && (u.enhanceLevel || 0) >= 15 && p.enhanceLevel <= 5) { flags.push(`⚡ 하루 만에 +${p.enhanceLevel}→+${u.enhanceLevel}강`); score += 2; }
      if (typeof u.budget === 'number' && u.budget < 3000 && (u.points || 0) > 20000) { flags.push('⏳ 지금 포인트 한도까지 쓰는 중'); score += 1; }
      const luck = allLogs[u.nickname] ? luckReport(allLogs[u.nickname], market) : null;
      if (luck && luck.forged > 0) { flags.push(`🧾 판매 시세 위조 ${luck.forged}/${luck.checked}건 (실제 시세와 다름)`); score += 25; }
      if (luck && luck.minP < 1e-6) { const [name, x] = luck.worst; flags.push(`🚨 확률 조작 의심: ${name} ${x.k}/${x.n} (우연일 확률 ${oneInText(x.p)})`); score += 20; }
      else if (luck && luck.minP < 1e-3) { const [name, x] = luck.worst; flags.push(`🎲 운이 너무 좋음: ${name} ${x.k}/${x.n} (${oneInText(x.p)})`); score += 4; }
      if (luck && luck.maxSec >= 6) { flags.push(`🖐️ 1초에 베팅 ${luck.maxSec}번 (매크로 의심)`); score += 5; }
      const tp = tamper[u.nickname];
      if (tp && tp.length) { flags.push(`🔒 난수/시계 조작 시도 ${tp.length}회 (${[...new Set(tp.map(x => x.what))].join(', ')})`); score += 30; }
      return { u, flags, score, gain };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

    const head = `<div class="text-[10px] text-slate-500 mb-1">${esc(baseLabel)} · 의심 점수 순</div>`;
    box.innerHTML = head + (rows.length === 0
      ? '<div class="text-center text-emerald-600 font-bold py-3">✅ 이상 징후가 있는 회원이 없어요</div>'
      : rows.map(({ u, flags, score }) => `
        <div class="p-2.5 bg-white border ${score >= 5 ? 'border-rose-300' : 'border-amber-200'} rounded-xl space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <span class="font-black text-slate-900">${esc(u.nickname)}</span>
              <span class="text-[10px] font-black ${score >= 5 ? 'text-rose-600' : 'text-amber-600'}">의심 ${score}</span>
            </div>
            <div class="flex gap-1 shrink-0">
              <button onclick="openPointLog(${jsArg(u.nickname)})" class="bg-slate-50 text-slate-700 font-bold px-2 py-1 rounded-lg text-[10px]">내역</button>
              <button onclick="adminQuickSetPoint(${jsArg(u.nickname)})" class="bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-lg text-[10px]">포인트</button>
              <button onclick="adminConfiscateGameItems(${jsArg(u.nickname)})" class="bg-amber-50 text-amber-800 font-bold px-2 py-1 rounded-lg text-[10px]">카드·아이템 몰수</button>
              <button onclick="adminBanUser(${jsArg(u.nickname)})" class="bg-rose-500 text-white font-bold px-2 py-1 rounded-lg text-[10px]">차단</button>
            </div>
          </div>
          <div class="flex flex-wrap gap-1">${flags.map(f => `<span class="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">${esc(f)}</span>`).join('')}</div>
        </div>`).join(''));
  } catch (err) {
    box.innerHTML = `<div class="text-rose-600 py-2">분석 실패: ${esc(err.message)}</div>`;
  }
}

async function adminConfiscateGameItems(nick) {
  if (!confirm(`[${nick}] 회원의 반찬 카드, 강화 아이템, 받은 세트 보상 기록을 모두 몰수할까요?\n(포인트는 [포인트] 버튼으로 따로 조정하세요)`)) return;
  try {
    await db.ref(`user_points/${nick}`).update({ cards: null, items: null, setsClaimed: null });
    alert(`[${nick}] 카드·아이템 몰수 완료`);
    renderAnomalyPanel();
  } catch (err) {
    alert('몰수 실패: ' + err.message);
  }
}

// ==========================================
// ✏️ 닉네임 변경 요청 승인/거절
// 승인: user_points / user_uids / 포인트 내역 / 이번 주 시즌 기록을 새 닉네임으로 한 번에 이전
// 거절: 낸 금액 환불
// ==========================================
function renderAdminRenameRequests() {
  db.ref('rename_requests').on('value', snap => {
    const list = Object.values(snap.val() || {}).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const box = document.getElementById('adminRenameList');
    const cnt = document.getElementById('adminRenameCount');
    if (cnt) cnt.textContent = `${list.length}건 대기`;
    if (!box) return;
    box.innerHTML = list.length === 0 ? '<div class="text-center text-slate-400 py-2">대기 중인 요청이 없어요.</div>' : list.map(r => `
      <div class="p-2.5 bg-white border rounded-xl flex items-center justify-between gap-2">
        <div class="min-w-0"><span class="font-bold text-slate-800">${esc(r.from)}</span> → <span class="font-black text-indigo-700">${esc(r.to)}</span>
          <span class="block text-[10px] text-slate-400">${(r.paid || 0).toLocaleString()}P 결제 · ${r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR') : ''}</span></div>
        <div class="flex gap-1 shrink-0">
          <button onclick="adminApproveRename(${jsArg(r.uid)})" class="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-lg text-[11px]">승인</button>
          <button onclick="adminRejectRename(${jsArg(r.uid)})" class="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-lg text-[11px]">거절·환불</button>
        </div>
      </div>`).join('');
  }, onDbError);
}

async function adminApproveRename(uid) {
  try {
    const r = (await db.ref(`rename_requests/${uid}`).once('value')).val();
    if (!r) return alert('요청을 찾을 수 없어요.');
    const { from, to } = r;
    const [oldSnap, newSnap, banSnap, logSnap, seasonSnap] = await Promise.all([
      db.ref(`user_points/${from}`).once('value'), db.ref(`user_points/${to}`).once('value'),
      db.ref(`banned_users/${to}`).once('value'), db.ref(`point_logs/${from}`).once('value'),
      db.ref(`seasons/${weekKey()}/${from}`).once('value')
    ]);
    const u = oldSnap.val();
    if (!u || u.uid !== uid) return alert('기존 회원 정보가 없거나 계정이 달라요. 거절·환불로 처리해주세요.');
    if (newSnap.exists()) return alert(`[${to}] 은(는) 그 사이 다른 회원이 쓰고 있어요. 거절·환불로 처리해주세요.`);
    if (banSnap.exists()) return alert(`[${to}] 은(는) 차단된 닉네임이에요. 거절·환불로 처리해주세요.`);
    if (!confirm(`[${from}] → [${to}] 닉네임 변경을 승인할까요?`)) return;

    const updates = {};
    updates[`user_points/${to}`] = Object.assign({}, u, { nickname: to, updatedAt: Date.now() });
    updates[`user_points/${from}`] = null;
    updates[`user_uids/${uid}`] = to;
    updates[`online_users/${from}`] = null;
    updates[`rename_requests/${uid}`] = null;
    if (logSnap.exists()) { updates[`point_logs/${to}`] = logSnap.val(); updates[`point_logs/${from}`] = null; }
    if (seasonSnap.exists()) {
      updates[`seasons/${weekKey()}/${to}`] = Object.assign({}, seasonSnap.val(), { nickname: to });
      updates[`seasons/${weekKey()}/${from}`] = null;
    }
    const key = db.ref(`point_logs/${to}`).push().key;
    updates[`point_logs/${to}/${key}`] = { d: 0, r: `닉네임 변경: ${from} → ${to}`, bal: u.points || 0, ts: firebase.database.ServerValue.TIMESTAMP };
    await db.ref().update(updates);
    alert(`✅ [${from}] → [${to}] 변경 완료!`);
  } catch (err) {
    alert('변경 중 오류: ' + err.message);
  }
}

async function adminRejectRename(uid) {
  const r = (await db.ref(`rename_requests/${uid}`).once('value')).val();
  if (!r) return;
  if (!confirm(`[${r.from}] → [${r.to}] 요청을 거절하고 ${(r.paid || 0).toLocaleString()}P를 환불할까요?`)) return;
  try {
    const tx = await db.ref(`user_points/${r.from}/points`).transaction(v => (typeof v === 'number' ? v : 0) + (r.paid || 0));
    await db.ref().update({
      [`rename_requests/${uid}`]: null,
      [`point_logs/${r.from}/${db.ref(`point_logs/${r.from}`).push().key}`]: { d: r.paid || 0, r: `닉네임 변경 거절 환불 (→ ${r.to})`, bal: tx.snapshot.val(), ts: firebase.database.ServerValue.TIMESTAMP }
    });
    alert('환불 완료');
  } catch (err) {
    alert('환불 중 오류: ' + err.message);
  }
}
