// 밥심 - 포인트 게임장

function switchGameTab(tabName) {
  ['clicker', 'speed', 'memory', 'slot', 'coin', 'dice', 'duel'].forEach(t => {
    const view = document.getElementById(`gameView_${t}`);
    const tab = document.getElementById(`tabBtn_${t}`);
    const span = t === 'duel' ? 'col-span-3 ' : '';
    if (view) view.classList.toggle('hidden', t !== tabName);
    if (tab) {
      tab.className = span + (t === tabName
        ? "py-2.5 px-2 rounded-xl bg-white shadow-xs text-slate-900 font-extrabold flex items-center justify-center gap-1.5 transition-all"
        : "py-2.5 px-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white/50 flex items-center justify-center gap-1.5 transition-all");
    }
  });
  if (tabName === 'duel') {
    document.getElementById('duelResultStage')?.classList.add('hidden');
    renderDuelArena();
  }
}

function openMiniGameModal() { 
  if (!checkApprovalGuard()) return;
  resetMiniGameState(); 
  switchGameTab('clicker');
  document.getElementById('miniGameModal').classList.remove('hidden'); 
}
function closeMiniGameModal() { 
  if (isGameRunning) clearInterval(gameInterval); 
  if (isSpeedRunning) clearInterval(speedInterval);
  document.getElementById('miniGameModal').classList.add('hidden'); 
}

function resetMiniGameState() {
  if (gameInterval) clearInterval(gameInterval);
  isGameRunning = false;
  gameTimeLeft = 10.0;
  gameClicks = 0;
  document.getElementById('gameTimer').textContent = "10.0";
  document.getElementById('gameScore').textContent = "0";
  document.getElementById('gameClickBtn').disabled = true;
  document.getElementById('gameStartBtn').disabled = false;
  document.getElementById('gameStartBtn').textContent = "게임 시작하기!";
}

function startMiniGame() {
  resetMiniGameState();
  isGameRunning = true;
  document.getElementById('gameClickBtn').disabled = false;
  document.getElementById('gameStartBtn').disabled = true;
  document.getElementById('gameStartBtn').textContent = "마구 클릭하세요!";

  const startTime = Date.now();
  gameInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    gameTimeLeft = Math.max(0, 10.0 - elapsed);
    document.getElementById('gameTimer').textContent = gameTimeLeft.toFixed(1);

    if (gameTimeLeft <= 0) {
      clearInterval(gameInterval);
      finishMiniGame();
    }
  }, 50);
}

function handleGameClick() {
  if (!isGameRunning) return;
  gameClicks++;
  document.getElementById('gameScore').textContent = gameClicks;
}

function finishMiniGame() {
  isGameRunning = false;
  document.getElementById('gameClickBtn').disabled = true;
  document.getElementById('gameStartBtn').disabled = false;
  document.getElementById('gameStartBtn').textContent = "다시 플레이하기";

  let earned = gameClicks * 2;
  let isCapped = false;
  if (earned > 500) {
    earned = 500;
    isCapped = true;
  }

  userPoints += earned;
  updatePointsUI();
  if (earned >= 200) maybeDropCard('밥알광클', 8);

  if (window.confetti) confetti({ particleCount: 80, spread: 60 });
  alert(`🍚 미니게임 종료!\n총 클릭 수: ${gameClicks}회\n🎉 +${earned.toLocaleString()}P 적립 완료! ${isCapped ? '(한판 최대 상한 500P 적용)' : ''}`);
}

function startSpeedGame() {
  if (speedInterval) clearInterval(speedInterval);
  isSpeedRunning = true;
  speedTimeLeft = 5.0;
  speedHits = 0;

  const hitBtn = document.getElementById('speedHitBtn');
  const startBtn = document.getElementById('speedStartBtn');
  hitBtn.disabled = false;
  startBtn.disabled = true;
  startBtn.textContent = "번개를 마구 연타하세요!!";

  document.getElementById('speedTimer').textContent = "5.0";
  document.getElementById('speedHits').textContent = "0";

  const startTime = Date.now();
  speedInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    speedTimeLeft = Math.max(0, 5.0 - elapsed);
    document.getElementById('speedTimer').textContent = speedTimeLeft.toFixed(1);

    if (speedTimeLeft <= 0) {
      clearInterval(speedInterval);
      isSpeedRunning = false;
      hitBtn.disabled = true;
      startBtn.disabled = false;
      startBtn.textContent = "다시 도전하기";

      let reward = 0;
      let isCapped = false;
      if (speedHits >= 30) {
        reward = 150 + (speedHits - 30) * 2;
        if (reward > 500) {
          reward = 500;
          isCapped = true;
        }
        userPoints += reward;
        updatePointsUI();
        maybeDropCard('스피드 연타', 10);
        if (speedHits >= 70) postFeed('game', `⚡ 스피드 연타 ${speedHits}타 신기록급!`, 'normal');
        if (window.confetti) confetti({ particleCount: 120 });
        alert(`⚡ 미션 성공!\n기록: ${speedHits}타!\n🎉 보너스 +${reward}P 지급 완료! ${isCapped ? '(한판 최대 상한 500P 적용)' : ''}`);
      } else {
        alert(`😢 아쉽습니다! ${speedHits}타 기록.\n30타 이상을 달성해야 150P 보너스를 획득할 수 있습니다.`);
      }
    }
  }, 50);
}

function handleSpeedHit() {
  if (!isSpeedRunning) return;
  speedHits++;
  document.getElementById('speedHits').textContent = speedHits;
}

function startMemoryGame() {
  memorySequence = [];
  memoryUserStep = 0;
  isMemoryGameActive = false;

  for (let i = 0; i < 4; i++) {
    memorySequence.push(MEMORY_OPTIONS[Math.floor(Math.random() * MEMORY_OPTIONS.length)]);
  }

  const display = document.getElementById('memoryDisplay');
  const btns = document.querySelectorAll('.mem-btn');
  const progText = document.getElementById('memoryProgressText');
  btns.forEach(b => b.disabled = true);
  progText.textContent = "순서를 잘 외우세요!";

  let flashIndex = 0;
  display.textContent = `준비...`;

  const flashTimer = setInterval(() => {
    if (flashIndex < memorySequence.length) {
      display.innerHTML = `<span class="text-amber-400 font-black text-lg">${flashIndex + 1}번째: ${memorySequence[flashIndex]}</span>`;
      flashIndex++;
    } else {
      clearInterval(flashTimer);
      display.textContent = "이제 외운 순서대로 4개를 누르세요!";
      btns.forEach(b => b.disabled = false);
      isMemoryGameActive = true;
      progText.textContent = `(0 / 4 선택 완료)`;
    }
  }, 900);
}

function pickMemoryMenu(menuName) {
  if (!isMemoryGameActive) return;
  const display = document.getElementById('memoryDisplay');
  const progText = document.getElementById('memoryProgressText');

  if (menuName === memorySequence[memoryUserStep]) {
    memoryUserStep++;
    progText.textContent = `(${memoryUserStep} / 4 정답 진행 중)`;

    if (memoryUserStep === memorySequence.length) {
      isMemoryGameActive = false;
      document.querySelectorAll('.mem-btn').forEach(b => b.disabled = true);
      userPoints += 80;
      updatePointsUI();
      maybeDropCard('식단암기', 12);
      if (window.confetti) confetti({ particleCount: 120 });
      display.innerHTML = `<span class="text-emerald-400 font-black">🎉 암기 완벽 성공! (+80P 지급)</span>`;
      progText.textContent = "축하합니다! 80P를 획득했습니다.";
    }
  } else {
    isMemoryGameActive = false;
    document.querySelectorAll('.mem-btn').forEach(b => b.disabled = true);
    display.innerHTML = `<span class="text-rose-400 font-bold">오답! [${menuName}] ❌</span>`;
    progText.textContent = `실패! 정답은: ${memorySequence.join(' → ')}`;
  }
}

function spinSlotMachine(times = 1) {
  if (isSlotSpinning) return;
  const totalCost = 50 * times;
  if (userPoints < totalCost) {
    return alert(`❌ 베팅할 포인트가 부족합니다!\n필요 포인트: ${totalCost.toLocaleString()}P (현재: ${userPoints.toLocaleString()}P)`);
  }

  userPoints -= totalCost;
  updatePointsUI();

  const resultText = document.getElementById('slotResultText');
  const spinBtn = document.getElementById('slotSpinBtn');

  if (times === 1) {
    isSlotSpinning = true;
    spinBtn.disabled = true;
    resultText.textContent = "슬롯 회전 중... 과연 1,000,000P 잭팟은?!";

    const slot1 = document.getElementById('slot1');
    const slot2 = document.getElementById('slot2');
    const slot3 = document.getElementById('slot3');

    const isMegaJackpot = Math.random() < 0.0000001;

    let counter = 0;
    const spinTimer = setInterval(() => {
      slot1.textContent = SLOT_ITEMS[Math.floor(Math.random() * SLOT_ITEMS.length)];
      slot2.textContent = SLOT_ITEMS[Math.floor(Math.random() * SLOT_ITEMS.length)];
      slot3.textContent = SLOT_ITEMS[Math.floor(Math.random() * SLOT_ITEMS.length)];
      counter++;

      if (counter >= 20) {
        clearInterval(spinTimer);
        isSlotSpinning = false;
        spinBtn.disabled = false;

        if (isMegaJackpot) {
          slot1.textContent = "💎";
          slot2.textContent = "💎";
          slot3.textContent = "💎";
          userPoints += 1000000;
          updatePointsUI();
          postFeed('slot', '💎💎💎 슬롯 초특급 잭팟!!! 1,000,000P 당첨!!!', 'legendary');
          addCardsToCollection([drawRandomCard(60)], '초특급 잭팟');
          if (window.confetti) confetti({ particleCount: 400, spread: 140 });
          resultText.innerHTML = `<span class="text-rose-500 font-black text-sm animate-bounce">🌟 0.00001% 초특급 잭팟! 1,000,000P 획득!! 🌟</span>`;
          return;
        }

        const r1 = slot1.textContent;
        const r2 = slot2.textContent;
        const r3 = slot3.textContent;

        if (r1 === r2 && r2 === r3) {
          userPoints += 500;
          updatePointsUI();
          maybeDropCard('슬롯 트리플', 25);
          if (r1 === '👑') postFeed('slot', `🎰 슬롯 ${r1}${r1}${r1} 트리플 잭팟!`, 'normal');
          if (window.confetti) confetti({ particleCount: 120 });
          resultText.innerHTML = `<span class="text-amber-500 font-black">🎉 ${r1}${r1}${r1} 트리플! (+500P 획득) · 초특급 잭팟은 💎💎💎</span>`;
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
          userPoints += 100;
          updatePointsUI();
          maybeDropCard('슬롯', 3);
          resultText.innerHTML = `<span class="text-indigo-600 font-black">👍 2개 일치! (+100P 획득)</span>`;
        } else {
          resultText.innerHTML = `<span class="text-slate-400">아쉽네요! 다음 기회에... (-50P)</span>`;
        }
      }
    }, 60);
  } else {
    let triples = 0;
    let doubles = 0;
    let megaJackpots = 0;
    let totalWon = 0;

    for (let i = 0; i < times; i++) {
      if (Math.random() < 0.0000001) {
        megaJackpots++;
        totalWon += 1000000;
        continue;
      }
      const r1 = SLOT_ITEMS[Math.floor(Math.random() * SLOT_ITEMS.length)];
      const r2 = SLOT_ITEMS[Math.floor(Math.random() * SLOT_ITEMS.length)];
      const r3 = SLOT_ITEMS[Math.floor(Math.random() * SLOT_ITEMS.length)];

      if (r1 === r2 && r2 === r3) {
        triples++;
        totalWon += 500;
      } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        doubles++;
        totalWon += 100;
      }
    }

    userPoints += totalWon;
    updatePointsUI();
    if (megaJackpots > 0) postFeed('slot', `💎💎💎 슬롯 ${times}연속 돌리다 초특급 잭팟!!! +${(megaJackpots * 1000000).toLocaleString()}P`, 'legendary');
    if (triples > 0) maybeDropCard(`슬롯 ${times}연속`, Math.min(60, triples * 15));
    if (times >= 100 && totalWon - totalCost >= 3000) postFeed('slot', `🎰 슬롯 100연속으로 +${(totalWon - totalCost).toLocaleString()}P 순이익!`, 'normal');

    const net = totalWon - totalCost;
    if (megaJackpots > 0 && window.confetti) confetti({ particleCount: 400 });
    else if (triples > 0 && window.confetti) confetti({ particleCount: 150 });

    resultText.innerHTML = `
      <span class="${net >= 0 ? 'text-amber-500' : 'text-rose-500'} font-bold">
        ${times}회 정산: ${megaJackpots > 0 ? `💎초특급 ${megaJackpots}회(+${(megaJackpots * 1000000).toLocaleString()}P)! ` : ''}트리플 ${triples}회 | 더블 ${doubles}회 (순수익: ${net >= 0 ? '+' : ''}${net.toLocaleString()}P)
      </span>
    `;
  }
}

function playCoinFlip(userChoice) {
  const betInput = parseInt(document.getElementById('coinBetInput').value, 10);
  const bet = Math.min(Math.max(betInput || 50, 50), 10000);

  if (userPoints < bet) return alert(`❌ 베팅할 포인트가 부족합니다! (필요: ${bet.toLocaleString()}P)`);
  userPoints -= bet;
  updatePointsUI();

  const coinEl = document.getElementById('coinDisplay');
  const resultEl = document.getElementById('coinResultText');
  resultEl.textContent = "동전이 공중에서 회전 중...";

  setTimeout(() => {
    const isFront = Math.random() < 0.5;
    const outcome = isFront ? 'front' : 'back';
    coinEl.textContent = isFront ? "🌕" : "🌑";

    if (userChoice === outcome) {
      const reward = bet * 2;
      userPoints += reward;
      updatePointsUI();
      maybeDropCard('동전던지기', 6);
      if (bet >= 5000) postFeed('coin', `💰 동전던지기 ${bet.toLocaleString()}P 올인 성공! +${reward.toLocaleString()}P`, 'big');
      if (window.confetti) confetti({ particleCount: 60 });
      resultEl.innerHTML = `<span class="text-amber-500 font-black">🎉 예측 적중! (${isFront ? '앞면' : '뒷면'}) +${reward.toLocaleString()}P 획득!</span>`;
    } else {
      resultEl.innerHTML = `<span class="text-rose-500 font-bold">빗나갔습니다! (${isFront ? '앞면' : '뒷면'}) -${bet.toLocaleString()}P</span>`;
    }
  }, 400);
}

const DICE_ICONS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
function playDiceBet(userChoice) {
  const rawBet = parseInt(document.getElementById('diceBetInput').value, 10) || 50;
  const isExactNumberBet = ['1', '2', '3', '4', '5', '6'].includes(userChoice);

  if (isExactNumberBet) {
    const now = Date.now();
    diceExactBetTimestamps = diceExactBetTimestamps.filter(t => now - t < 60000);

    if (diceExactBetTimestamps.length >= 10) {
      const oldest = diceExactBetTimestamps[0];
      const remainingSec = Math.ceil((60000 - (now - oldest)) / 1000);
      return alert(`⏳ 주사위 숫자 맞추기는 1분에 최대 10회까지만 가능합니다!\n잠시 후 (${remainingSec}초 뒤) 다시 시도해주세요.`);
    }
  }

  let bet = 50;
  if (isExactNumberBet) {
    bet = Math.min(Math.max(rawBet, 50), 500);
    if (rawBet > 500) {
      document.getElementById('diceBetInput').value = 500;
    }
  } else {
    bet = Math.min(Math.max(rawBet, 50), 10000);
  }

  if (userPoints < bet) return alert(`❌ 베팅할 포인트가 부족합니다! (필요: ${bet.toLocaleString()}P)`);

  userPoints -= bet;
  updatePointsUI();

  if (isExactNumberBet) {
    diceExactBetTimestamps.push(Date.now());
  }

  const diceEl = document.getElementById('diceDisplay');
  const resultEl = document.getElementById('diceResultText');
  resultEl.textContent = "주사위를 굴리는 중...";

  setTimeout(() => {
    const roll = Math.floor(Math.random() * 6) + 1;
    diceEl.textContent = DICE_ICONS[roll - 1];

    const isOdd = (roll % 2 !== 0);
    const rollStr = roll.toString();

    let won = false;
    let multiplier = 2;

    if (userChoice === 'odd' && isOdd) {
      won = true;
      multiplier = 2;
    } else if (userChoice === 'even' && !isOdd) {
      won = true;
      multiplier = 2;
    } else if (userChoice === rollStr) {
      won = true;
      multiplier = 8;
    }

    if (won) {
      const reward = bet * multiplier;
      userPoints += reward;
      updatePointsUI();
      maybeDropCard('주사위', multiplier === 8 ? 20 : 6);
      if (multiplier === 8 && bet >= 300) postFeed('dice', `🎲 주사위 숫자 [${roll}] 정확히 적중! x8 → +${reward.toLocaleString()}P`, 'normal');
      if (window.confetti) confetti({ particleCount: multiplier === 8 ? 200 : 80 });
      resultEl.innerHTML = `<span class="text-amber-500 font-black">🎉 대박 적중! [${roll}나옴] +${reward.toLocaleString()}P (${multiplier}배) 획득!</span>`;
    } else {
      resultEl.innerHTML = `<span class="text-rose-500 font-bold">낙첨! [${roll}나옴] -${bet.toLocaleString()}P</span>`;
    }
  }, 400);
}
