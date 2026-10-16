// 밥심 - 로그인, 회원 상태, 포인트 동기화, 접속자

function checkApprovalGuard() {
  if (currentUser.nickname === "문정러") {
    alert("닉네임을 설정(회원가입)하고 관리자 승인을 받은 후 이용하실 수 있습니다.");
    openAuthModal();
    return false;
  }
  if (!isUserApproved) {
    alert("🔒 관리자 회원 승인 대기 중입니다.\n관리자가 승인한 후 이용하실 수 있습니다.");
    return false;
  }
  return true;
}

function syncUserPointToCloud() {
  if (!currentUser.nickname || currentUser.nickname === "문정러") return;
  db.ref(`user_points/${currentUser.nickname}`).update({
    nickname: currentUser.nickname,
    points: userPoints,
    enhanceLevel: currentEnhanceLevel,
    badge: myNickBg,
    color: myNickColor,
    symbol: myNickSymbol,
    inventory: myInventory,
    updatedAt: Date.now()
  });
}

function attachUserPointListener() {
  if (!currentUser.nickname || currentUser.nickname === "문정러") {
    isUserApproved = true;
    const banner = document.getElementById('pendingApprovalBanner');
    if (banner) banner.classList.add('hidden');
    return;
  }

  db.ref(`user_points/${currentUser.nickname}`).on('value', (snap) => {
    const val = snap.val();
    const banner = document.getElementById('pendingApprovalBanner');
    const pendingNick = document.getElementById('pendingBannerNick');

    if (val) {
      if (val.resetInventory === true) {
        myInventory = { colors: [], bgs: ['nb-none'], symbols: [] };
        myNickBg = 'nb-none';
        myNickColor = '';
        myNickSymbol = '';
        localStorage.setItem('bapsim_inventory', JSON.stringify(myInventory));
        localStorage.setItem('bapsim_custom_bg', 'nb-none');
        localStorage.setItem('bapsim_custom_color', '');
        localStorage.setItem('bapsim_custom_symbol', '');
        updatePointsUI(false);
        renderShopUI();
        alert("⚠️ 관리자에 의해 보유 중인 모든 치장 아이템이 몰수 및 삭제 처리되었습니다.");
        db.ref(`user_points/${currentUser.nickname}/resetInventory`).remove();
        return;
      }

      if (val.inventory) {
        myInventory = {
          colors: Array.isArray(val.inventory.colors) ? val.inventory.colors : [],
          bgs: Array.isArray(val.inventory.bgs) ? val.inventory.bgs : ['nb-none'],
          symbols: Array.isArray(val.inventory.symbols) ? val.inventory.symbols : []
        };
        localStorage.setItem('bapsim_inventory', JSON.stringify(myInventory));
      }

      isUserApproved = (val.status === 'approved' || val.approved === true);

      if (!isUserApproved) {
        if (banner) {
          if (pendingNick) pendingNick.textContent = currentUser.nickname;
          banner.classList.remove('hidden');
        }
      } else {
        if (banner) banner.classList.add('hidden');

        const notifyKey = `bapsim_approved_notified_${currentUser.nickname}`;
        const hasNotified = localStorage.getItem(notifyKey);

        if (!hasNotified && val.status === 'approved') {
          localStorage.setItem(notifyKey, 'true');
          if (window.confetti) confetti({ particleCount: 150 });
          alert(`🎉 [${currentUser.nickname}] 님의 계정이 관리자로부터 최종 승인되었습니다!\n이제 모든 서비스를 자유롭게 이용하실 수 있습니다.`);
        }
      }

      if (typeof val.points === 'number' && val.points !== userPoints) {
        userPoints = val.points;
        localStorage.setItem('bapsim_points', userPoints.toString());
        updatePointsUI(false);
      }
      if (typeof val.enhanceLevel === 'number' && val.enhanceLevel !== currentEnhanceLevel) {
        currentEnhanceLevel = val.enhanceLevel;
        localStorage.setItem('bapsim_enhance_level', currentEnhanceLevel.toString());
        updateEnhanceUI();
      }
      if (val.badge && val.badge !== myNickBg) {
        myNickBg = val.badge;
        localStorage.setItem('bapsim_custom_bg', myNickBg);
        updatePreviewBox();
      }
      if (val.color !== undefined && val.color !== myNickColor) {
        myNickColor = val.color;
        localStorage.setItem('bapsim_custom_color', myNickColor);
        updatePreviewBox();
      }
      if (val.symbol !== undefined && val.symbol !== myNickSymbol) {
        myNickSymbol = val.symbol;
        localStorage.setItem('bapsim_custom_symbol', myNickSymbol);
        updatePreviewBox();
      }
    } else {
      alert("회원 정보가 삭제되었거나 운영자에 의해 차단되었습니다.");
      localStorage.removeItem('bapsim_user');
      currentUser = { nickname: "문정러" };
      isUserApproved = true;
      if (banner) banner.classList.add('hidden');
      location.reload();
    }
  });
}

function updatePointsUI(shouldPushToCloud = true) {
  const headerPoint = document.getElementById('headerPointDisplay');
  const chatPoint = document.getElementById('chatPointDisplay');
  const shopPoint = document.getElementById('shopCurrentPoints');

  if (headerPoint) headerPoint.textContent = `${userPoints.toLocaleString()}P`;
  if (chatPoint) chatPoint.textContent = `보유: ${userPoints.toLocaleString()}P`;
  if (shopPoint) shopPoint.textContent = `${userPoints.toLocaleString()}P`;

  localStorage.setItem('bapsim_points', userPoints.toString());
  localStorage.setItem('bapsim_inventory', JSON.stringify(myInventory));
  localStorage.setItem('bapsim_custom_color', myNickColor);
  localStorage.setItem('bapsim_custom_bg', myNickBg);
  localStorage.setItem('bapsim_custom_symbol', myNickSymbol);

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
    textEl.className = `${myNickBg || 'nb-none'} text-xs inline-block`;
    textEl.style.color = myNickColor || '';
  }
}

function initPresenceSystem() {
  if (!currentUser.nickname || currentUser.nickname === "문정러") return;
  const myPresenceRef = db.ref(`online_users/${currentUser.nickname}`);
  const connectedRef = db.ref('.info/connected');

  connectedRef.on('value', (snap) => {
    if (snap.val() === true) {
      myPresenceRef.onDisconnect().remove();
      myPresenceRef.set({
        nickname: currentUser.nickname,
        badge: myNickBg,
        symbol: myNickSymbol,
        color: myNickColor,
        lastSeen: Date.now()
      });
    }
  });

  db.ref('online_users').on('value', (snap) => {
    const users = snap.val() || {};
    const userList = Object.values(users);
    const count = userList.length;

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
  });
}

function openAuthModal() {
  document.getElementById('authNicknameInput').value = (currentUser.nickname !== "문정러" ? currentUser.nickname : '');
  document.getElementById('authPasswordInput').value = '';
  document.getElementById('authModal').classList.remove('hidden');
}
function closeAuthModal() { document.getElementById('authModal').classList.add('hidden'); }

async function saveUserProfile() {
  const input = document.getElementById('authNicknameInput').value.trim();
  const pass = document.getElementById('authPasswordInput').value.trim();
  const saveBtn = document.getElementById('saveUserBtn');

  if (!input) return alert('닉네임을 입력해주세요.');
  if (!isValidNickname(input)) return alert('⚠️ 닉네임에는 특수문자를 사용할 수 없습니다! (한글, 영문, 숫자만)');
  if (!/^\d{4}$/.test(pass)) return alert('⚠️ 비밀번호는 반드시 숫자 4자리로 입력해주세요!');

  saveBtn.disabled = true;
  saveBtn.textContent = "확인 중...";

  try {
    const banSnap = await db.ref(`banned_users/${input}`).once('value');
    if (banSnap.exists()) {
      alert(`⛔ [${input}] 은(는) 운영자에 의해 영구 차단된 닉네임입니다.\n다른 닉네임으로 신청해주세요.`);
      saveBtn.disabled = false;
      saveBtn.textContent = "가입 및 승인 요청";
      return;
    }

    const snap = await db.ref(`user_points/${input}`).once('value');
    const existingData = snap.val();

    if (snap.exists()) {
      const passHash = await sha256(pass);
      const wrongPass = existingData.passwordHash
        ? existingData.passwordHash !== passHash
        : (existingData.password && String(existingData.password) !== pass);
      if (wrongPass) {
        alert("❌ 비밀번호가 일치하지 않습니다. 해당 닉네임의 본인 비밀번호를 입력해주세요.");
        saveBtn.disabled = false;
        saveBtn.textContent = "가입 및 승인 요청";
        return;
      }

      // 기존 회원의 평문 비밀번호를 해시로 자동 전환 (평문은 DB에서 삭제)
      if (!existingData.passwordHash) {
        await db.ref(`user_points/${input}`).update({ passwordHash: passHash, password: null });
      }

      currentUser = { nickname: input };
      localStorage.setItem('bapsim_user', JSON.stringify(currentUser));
      document.getElementById('userProfileText').textContent = input;
      userPoints = existingData.points || 30;
      currentEnhanceLevel = existingData.enhanceLevel || 0;
      localStorage.setItem('bapsim_enhance_level', currentEnhanceLevel.toString());

      myNickBg = existingData.badge || 'nb-none';
      myNickColor = existingData.color || '';
      myNickSymbol = existingData.symbol || '';
      myInventory = existingData.inventory || { colors: [], bgs: ['nb-none'], symbols: [] };
      isUserApproved = (existingData.status === 'approved' || existingData.approved === true);

      updatePointsUI(false);
      updateEnhanceUI();
      attachUserPointListener();
      initPresenceSystem();
      closeAuthModal();
      alert(`🔑 [${input}] 님으로 로그인되었습니다.`);
      return;
    }

    const oldNick = currentUser.nickname;
    currentUser = { nickname: input };
    localStorage.setItem('bapsim_user', JSON.stringify(currentUser));
    document.getElementById('userProfileText').textContent = input;

    await db.ref(`user_points/${input}`).set({
      nickname: input,
      passwordHash: await sha256(pass),
      points: 30,
      enhanceLevel: currentEnhanceLevel,
      badge: 'nb-none',
      color: '',
      symbol: '',
      inventory: { colors: [], bgs: ['nb-none'], symbols: [] },
      status: 'pending',
      approved: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    if (oldNick && oldNick !== "문정러" && oldNick !== input) {
      db.ref(`user_points/${oldNick}`).remove().catch(()=>{});
      db.ref(`online_users/${oldNick}`).remove().catch(()=>{});
    }

    isUserApproved = false;
    userPoints = 30;
    myInventory = { colors: [], bgs: ['nb-none'], symbols: [] };
    myNickBg = 'nb-none';
    myNickColor = '';
    myNickSymbol = '';
    updatePointsUI(false);
    updateEnhanceUI();
    attachUserPointListener();
    initPresenceSystem();
    closeAuthModal();

    alert(`🎉 [${input}] 님, 회원가입 신청이 성공적으로 접수되었습니다!\n\n설정하신 비밀번호를 꼭 기억해주세요. 운영진 승인 후 모든 기능이 활성화됩니다.`);
  } catch (err) {
    console.error("회원가입 에러:", err);
    alert("가입 처리 중 오류가 발생했습니다: " + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "가입 및 승인 요청";
  }
}
