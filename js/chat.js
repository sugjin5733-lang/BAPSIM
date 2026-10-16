// 밥심 - 실시간 채팅

function toggleChatWindow() {
  const chatWin = document.getElementById('chatWindow');
  const unread = document.getElementById('chatUnreadPulse');
  if (!chatWin) return;
  const isClosed = chatWin.classList.toggle('hidden');
  if (!isClosed && unread) {
    unread.classList.add('hidden');
  }
}

function handleSendChat(e) {
  e.preventDefault();
  if (!checkApprovalGuard()) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const chatPath = currentGroupId === 'lobby' ? 'lobby_messages' : `groups/${currentGroupId}/messages`;
  db.ref(chatPath).push({
    nickname: currentUser.nickname,
    text: text,
    color: myNickColor,
    bg: myNickBg,
    symbol: myNickSymbol,
    timestamp: Date.now()
  });
  input.value = '';
}

function sendSticker(stickerType) {
  if (!checkApprovalGuard()) return;
  if (userPoints < 10) return alert("❌ 이모티콘 전송에는 10P가 필요합니다!");
  userPoints -= 10;
  updatePointsUI();

  const chatPath = currentGroupId === 'lobby' ? 'lobby_messages' : `groups/${currentGroupId}/messages`;
  db.ref(chatPath).push({
    nickname: currentUser.nickname,
    sticker: stickerType,
    color: myNickColor,
    bg: myNickBg,
    symbol: myNickSymbol,
    timestamp: Date.now()
  });
}

function quickChat(text) {
  if (!checkApprovalGuard()) return;
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = text;
    input.focus();
  }
}

function appendChatMessage(msg) {
  const container = document.getElementById('chatMessages');
  if (!container || !msg) return;

  const isMe = (msg.nickname === currentUser.nickname || msg.nickname === `[관리자] ${currentUser.nickname}`);
  const msgEl = document.createElement('div');
  msgEl.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 mb-2.5`;

  let bodyContent = '';
  if (msg.sticker) {
    let label = "스티커";
    if (msg.sticker === 'sticker-agree') label = "찬성! 👍";
    else if (msg.sticker === 'sticker-reject') label = "탈락 ❌";
    else if (msg.sticker === 'sticker-dismiss') label = "반려 ⚡";
    else if (msg.sticker === 'sticker_admin_exec') label = "⚡ 처벌 집행 ⚡";
    else if (msg.sticker === 'sticker_admin_ok') label = "🛡️ 관리자 승인 🛡️";
    else if (msg.sticker === 'sticker_admin_warn') label = "⚠️ 운영 경고 ⚠️";

    bodyContent = `<div class="${safeClass(msg.sticker)} my-1">${esc(label)}</div>`;
  } else if (msg.type === 'system') {
    bodyContent = `<div class="bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl font-bold text-[11px]">${esc(msg.text)}</div>`;
  } else {
    bodyContent = `<div class="p-2.5 rounded-2xl max-w-[80%] leading-relaxed ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'}">
      ${esc(msg.text)}
    </div>`;
  }

  const nickPart = msg.type === 'system' ? '' : nickHTML(msg);
  msgEl.innerHTML = `
    <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
      ${nickPart}
    </div>
    ${bodyContent}
  `;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

function attachChatListener() {
  if (chatRef) chatRef.off();
  const c = document.getElementById('chatMessages');
  if (c) c.innerHTML = '';
  const chatPath = currentGroupId === 'lobby' ? 'lobby_messages' : `groups/${currentGroupId}/messages`;
  chatRef = db.ref(chatPath).limitToLast(50);
  chatRef.on('child_added', snap => appendChatMessage(snap.val()));
}
