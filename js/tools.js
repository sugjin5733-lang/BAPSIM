// 밥심 - 사다리, 룰렛, N빵, 타이머

let ladderData = { lines: 4, rungs: [], names: [], results: [] };
function openLadderModal() {
  if (!checkApprovalGuard()) return;
  document.getElementById('ladderGameModal').classList.remove('hidden');
  const inputNames = document.getElementById('ladderInputNames');
  if (inputNames && inputNames.value.trim() === '') autoFillLadderWithRestaurants();
  else buildLadderCanvas();
}
function closeLadderModal() { document.getElementById('ladderGameModal').classList.add('hidden'); }

function autoFillLadderWithRestaurants() {
  const restNames = Object.values(restaurants || {}).map(r => String(r.name || '')).filter(Boolean).slice(0, 4);
  if (restNames.length >= 2) {
    document.getElementById('ladderInputNames').value = "나, 동료1, 동료2, 동료3".split(',').slice(0, restNames.length).join(', ');
    document.getElementById('ladderInputResults').value = restNames.join(', ');
  } else {
    document.getElementById('ladderInputNames').value = "김대리, 이과장, 박팀장, 최사원";
    document.getElementById('ladderInputResults').value = "당첨(커피쏘기), 통과, 통과, 통과";
  }
  buildLadderCanvas();
}

function buildLadderCanvas() {
  const nameInput = document.getElementById('ladderInputNames').value.trim();
  const resInput = document.getElementById('ladderInputResults').value.trim();
  const names = nameInput ? nameInput.split(',').map(s => s.trim()).filter(Boolean) : [];
  const results = resInput ? resInput.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (names.length < 2) return alert("참여자를 최소 2명 이상 입력하세요.");
  if (names.length !== results.length) {
    return alert(`참여자 수(${names.length}명)와 결과 수(${results.length}개)가 일치해야 합니다.`);
  }

  ladderData.names = names;
  ladderData.results = results;
  ladderData.lines = names.length;

  const rungCountPerGap = 3 + Math.floor(Math.random() * 3);
  ladderData.rungs = [];
  for (let i = 0; i < ladderData.lines - 1; i++) {
    for (let j = 0; j < rungCountPerGap; j++) {
      const yPos = 40 + Math.floor(Math.random() * 150);
      ladderData.rungs.push({ from: i, to: i + 1, y: yPos });
    }
  }

  drawLadder(null);
  document.getElementById('startLadderBtn').disabled = false;
  document.getElementById('ladderResultAnnounce').textContent = "사다리 준비 완료! [사다리 타기 시작!]을 눌러 추첨하세요.";
}

function drawLadder(activePath) {
  const canvas = document.getElementById('ladderCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const count = ladderData.lines;
  const gap = (canvas.width - 60) / (count - 1);
  const topY = 35;
  const botY = 205;

  ctx.textAlign = "center";
  ctx.font = "bold 12px Pretendard, sans-serif";

  for (let i = 0; i < count; i++) {
    const x = 30 + i * gap;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, botY);
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.fillText(ladderData.names[i] || '', x, topY - 12);

    ctx.fillStyle = "#facc15";
    ctx.fillText(ladderData.results[i] || '', x, botY + 20);
  }

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ladderData.rungs.forEach(rung => {
    const x1 = 30 + rung.from * gap;
    const x2 = 30 + rung.to * gap;
    ctx.beginPath();
    ctx.moveTo(x1, rung.y);
    ctx.lineTo(x2, rung.y);
    ctx.stroke();
  });

  if (activePath && activePath.length > 1) {
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(activePath[0].x, activePath[0].y);
    for (let p = 1; p < activePath.length; p++) {
      ctx.lineTo(activePath[p].x, activePath[p].y);
    }
    ctx.stroke();
  }
}

function runLadderAnimation() {
  const startBtn = document.getElementById('startLadderBtn');
  startBtn.disabled = true;

  const canvas = document.getElementById('ladderCanvas');
  const gap = (canvas.width - 60) / (ladderData.lines - 1);
  const sortedRungs = [...ladderData.rungs].sort((a, b) => a.y - b.y);

  let curCol = 0;
  let curY = 35;
  const pathPoints = [{ x: 30, y: curY }];

  sortedRungs.forEach(rung => {
    if (rung.from === curCol && rung.y > curY) {
      pathPoints.push({ x: 30 + curCol * gap, y: rung.y });
      curCol = rung.to;
      pathPoints.push({ x: 30 + curCol * gap, y: rung.y });
      curY = rung.y;
    } else if (rung.to === curCol && rung.y > curY) {
      pathPoints.push({ x: 30 + curCol * gap, y: rung.y });
      curCol = rung.from;
      pathPoints.push({ x: 30 + curCol * gap, y: rung.y });
      curY = rung.y;
    }
  });
  pathPoints.push({ x: 30 + curCol * gap, y: 205 });

  let step = 0;
  const animTimer = setInterval(() => {
    step++;
    drawLadder(pathPoints.slice(0, step));
    if (step >= pathPoints.length) {
      clearInterval(animTimer);
      const finalResult = ladderData.results[curCol];
      document.getElementById('ladderResultAnnounce').innerHTML = `
        🎉 [${ladderData.names[0]}] 님의 결과: <strong class="text-rose-600 underline text-sm ml-1">${finalResult}</strong>
      `;
      if (window.confetti) confetti({ particleCount: 70 });
      startBtn.disabled = false;
    }
  }, 120);
}

function openRouletteModal() { 
  if (!checkApprovalGuard()) return;
  document.getElementById('rouletteSlotText').textContent = "???"; 
  document.getElementById('rouletteModal').classList.remove('hidden'); 
}
function closeRouletteModal() { document.getElementById('rouletteModal').classList.add('hidden'); }

function spinRoulette() {
  const list = Object.values(restaurants || {});
  if (list.length === 0) return alert('등록된 식당이 없습니다.');
  const slot = document.getElementById('rouletteSlotText');
  let count = 0;
  const timer = setInterval(() => {
    slot.textContent = list[Math.floor(Math.random() * list.length)].name;
    count++;
    if (count >= 20) {
      clearInterval(timer);
      const chosen = list[Math.floor(Math.random() * list.length)];
      slot.textContent = chosen.name;
      document.getElementById('rouletteSubText').textContent = `🎉 [${chosen.name}] 낙점!`;
      if (window.confetti) confetti({ particleCount: 60 });
    }
  }, 70);
}

function openDutchModal() { document.getElementById('dutchModal').classList.remove('hidden'); }
function closeDutchModal() { document.getElementById('dutchModal').classList.add('hidden'); }

function calcDutchPay() {
  const total = parseInt(document.getElementById('nTotalAmount').value, 10);
  const people = parseInt(document.getElementById('nPeopleCount').value, 10);
  if (!total || !people) return alert('금액과 인원수를 올바르게 입력하세요.');
  const per = Math.ceil(total / people);
  const res = document.getElementById('dutchResultBox');
  res.innerHTML = `1인당 <strong>${per.toLocaleString()}원</strong>`;
  res.classList.remove('hidden');
}

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
