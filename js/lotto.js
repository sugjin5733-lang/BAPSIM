// 밥심 - 🎟️ 밥심 복권 (매주 · 1등 잭팟 이월)
//
//  - 한 주 = 월요일 0시 ~ 다음 월요일 0시(한국 시각). 일요일 자정에 추첨
//  - 티켓 1장 1만P + 수수료 10%(1,000P, 그대로 사라짐) · 1인 주당 최대 100장
//  - 🎫 당첨금은 전부 '밥심 상품권'으로 지급 → 밥키우기 강화비 · 펫 비용에만 사용 (현금으로 못 뺌)
//  - 🥇 1등 잭팟 = max(1,000만P, 지난주 이월금 + 은행 보탬(최대 300만P)×2) + 판매액 50%×2 (티켓 1장마다 +1만P)
//    · 1등은 매주 나오는 게 아님: 당첨 확률 = 판매 장수 ÷ 300 (최대 80%) → 안 나오면 잭팟 전액 다음 주로 이월
//  - 🥈 2등 = 판매액 30% × 2 · 🥉 3등 = 판매액 20% × 2 (참가자 3명 이상이면 매주 나옴)
//  - 당첨자는 서로 다른 사람 · 티켓을 많이 살수록 확률↑
//  - 참가자가 3명 미만이면 추첨 없이 티켓값 환불 (수수료 제외) · 잭팟은 그대로 이월
//  - 티켓값·수수료·은행 보탬은 모두 시장에서 사라지는 돈 (상품권은 강화비·펫 비용으로만 소멸) → 인플레 억제
//  - 서버가 없으므로: 마감 뒤 처음 들어온 사람이 결과를 한 번만 만들고(트랜잭션),
//    당첨자/환불 대상은 각자 접속하면 자기 몫을 직접 받아감(claimed 로 중복 방지)
//  데이터: bank/lotto/{주 id}/tickets/{키} = { nick, uid, n, at } · /result { winners, jackpot, carryOut, hit, ... } · /claimed/{닉} · /bankDone
//    user_points/{닉}/coupon = 남은 상품권

const LOTTO_PRICE = 10000;
const LOTTO_FEE = 0.1;
const LOTTO_MAX_PER_WEEK = 100;
const LOTTO_SEED_MAX = 3000000;
const LOTTO_RESERVE = 10000000;
const LOTTO_COUPON_MULT = 2;
const LOTTO_JACKPOT_MIN = 10000000;
const LOTTO_JACKPOT_RATE = 0.5, LOTTO_2ND_RATE = 0.3, LOTTO_3RD_RATE = 0.2;
const LOTTO_HIT_TICKETS = 300, LOTTO_HIT_MAX = 0.8;
const WEEK_MS = 7 * 86400000;
let lottoState = {}, lottoWatching = false, lottoBusy = false;

function lottoNow() { return typeof ServerClock !== 'undefined' ? ServerClock.now() : Date.now(); }
function lottoWeekStart(ts = lottoNow()) {
  const p = kstParts(ts);
  const midnight = Date.parse(`${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T00:00:00+09:00`);
  return midnight - ((p.dow + 6) % 7) * 86400000;
}
function lottoWeekId(start) { const p = kstParts(start); return `${p.y}${String(p.m).padStart(2, '0')}${String(p.d).padStart(2, '0')}`; }
function lottoWeekLabel(id) { const m = /^(\d{4})(\d{2})(\d{2})$/.exec(id || ''); return m ? `${+m[2]}/${+m[3]} 주` : id; }
function lottoIdStart(id) { return Date.parse(`${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}T00:00:00+09:00`); }
function lottoCur() { const s = lottoWeekStart(); return { id: lottoWeekId(s), start: s, end: s + WEEK_MS }; }

function lottoTickets(w) {
  const t = (w && w.tickets) || {};
  const per = {}; // 1인 주당 최대 장수까지만 인정
  Object.keys(t).sort().forEach(k => {
    const v = t[k]; if (!v || !v.nick) return;
    const n = Math.max(0, Math.min(Math.floor(Number(v.n) || 0), LOTTO_MAX_PER_WEEK - (per[v.nick] || 0)));
    if (n > 0) per[v.nick] = (per[v.nick] || 0) + n;
  });
  return per;
}
function lottoSold(w) { return Object.values(lottoTickets(w)).reduce((a, b) => a + b, 0); }
function lottoSeedNow() { const bal = (typeof bankState !== 'undefined' && bankState.balance) || 0; return bal - LOTTO_SEED_MAX >= LOTTO_RESERVE ? LOTTO_SEED_MAX : 0; }
// 이 주 이전에 마지막으로 추첨된 회차의 이월금
function lottoCarryBefore(id) {
  const prev = Object.keys(lottoState).filter(k => k < id && lottoState[k] && lottoState[k].result).sort().pop();
  return prev ? Math.max(0, Number(lottoState[prev].result.carryOut) || 0) : 0;
}
function lottoPrizes(id, w, seed) {
  const sales = lottoSold(w) * LOTTO_PRICE;
  // 바닥(최소 1,000만 또는 이월금+은행 보탬) 위에 티켓이 팔릴 때마다 바로 쌓임 → 살 때마다 잭팟이 오르는 게 보임
  const jackpot = Math.max(LOTTO_JACKPOT_MIN, lottoCarryBefore(id) + seed * LOTTO_COUPON_MULT) + Math.floor(sales * LOTTO_JACKPOT_RATE * LOTTO_COUPON_MULT);
  return { jackpot, second: Math.floor(sales * LOTTO_2ND_RATE * LOTTO_COUPON_MULT), third: Math.floor(sales * LOTTO_3RD_RATE * LOTTO_COUPON_MULT) };
}
function lottoHitChance(w) { return Math.min(LOTTO_HIT_MAX, lottoSold(w) / LOTTO_HIT_TICKETS); }

// 결과용 난수: 주 id + 모든 티켓 키로 만든 해시 (마감 뒤에는 누구도 바꿀 수 없음)
function lottoHash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
function lottoRng(seedStr) { let s = lottoHash(seedStr) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function watchLotto() {
  if (lottoWatching || typeof db === 'undefined') return;
  lottoWatching = true;
  db.ref('bank/lotto').orderByKey().limitToLast(6).on('value', s => {
    lottoState = s.val() || {};
    renderLotto();
    settleLotto();
  }, () => { lottoWatching = false; });
}
setTimeout(watchLotto, 2500);
setInterval(() => { settleLotto(); const m = document.getElementById('lottoModal'); if (m && !m.classList.contains('hidden')) renderLotto(); }, 30000);

async function buyLotto(n) {
  if (!checkApprovalGuard()) return;
  const cur = lottoCur();
  const mine = lottoTickets(lottoState[cur.id])[currentUser.nickname] || 0;
  n = Math.min(n, LOTTO_MAX_PER_WEEK - mine);
  if (n <= 0) return alert(`🎟️ 이번 주는 최대 ${LOTTO_MAX_PER_WEEK}장까지 살 수 있어요.`);
  const base = n * LOTTO_PRICE, fee = Math.round(base * LOTTO_FEE), price = base + fee;
  if (userPoints < price) return alert(`❌ 포인트가 부족해요! (${price.toLocaleString()}P · 수수료 포함)`);
  if (!confirm(`🎟️ 밥심 복권 ${n}장을 살까요?\n\n· ${base.toLocaleString()}P + 수수료 ${fee.toLocaleString()}P = ${price.toLocaleString()}P\n· 일요일 자정 추첨 · 당첨금은 🎫 상품권 (강화비 · 펫 비용 전용)\n· 1등이 안 나오면 잭팟은 다음 주로 이월돼요`)) return;
  updatePointsUI();
  addPoints(-price, `🎟️ 밥심 복권 ${n}장 (${lottoWeekLabel(cur.id)} · 수수료 포함)`);
  updatePointsUI();
  try {
    await db.ref(`bank/lotto/${cur.id}/tickets`).push({ nick: currentUser.nickname, uid: authUser.uid, n, at: firebase.database.ServerValue.TIMESTAMP });
  } catch (e) {
    addPoints(price, '🎟️ 복권 구매 실패 환불');
    updatePointsUI();
    return alert('구매에 실패해서 환불했어요. 잠시 뒤 다시 시도해 주세요.');
  }
  if (window.confetti) confetti({ particleCount: 40 + n * 4, spread: 70 });
}

// 마감된 주(오래된 순): 결과 만들기 → 은행 보탬 정산 → 내 몫 받기
async function settleLotto() {
  if (lottoBusy || !canSyncToCloud()) return;
  lottoBusy = true;
  try {
    const now = lottoNow();
    for (const id of Object.keys(lottoState).sort()) {
      const w = lottoState[id];
      if (!(lottoIdStart(id) + WEEK_MS <= now) || !w || !w.tickets) continue;
      const ref = db.ref(`bank/lotto/${id}`);
      if (!w.result) {
        // 앞 회차가 아직 추첨 전이면 이월금을 모르니 기다림
        if (Object.keys(lottoState).some(k => k < id && lottoState[k] && lottoState[k].tickets && !lottoState[k].result)) break;
        const per = lottoTickets(w);
        const people = Object.keys(per);
        let result;
        if (people.length < 3) result = { refund: true, sold: lottoSold(w), carryOut: lottoCarryBefore(id), at: now };
        else {
          const seed = lottoSeedNow();
          const pz = lottoPrizes(id, w, seed);
          const rng = lottoRng(id + '|' + Object.keys(w.tickets).sort().join(','));
          const hit = rng() < lottoHitChance(w);
          const pool = Object.assign({}, per), winners = [];
          const pick = () => { const total = Object.values(pool).reduce((a, b) => a + b, 0); let x = rng() * total; const nick = Object.keys(pool).sort().find(k => (x -= pool[k]) < 0) || Object.keys(pool)[0]; delete pool[nick]; return nick; };
          if (hit) { const nick = pick(); winners.push({ rank: 1, nick, amt: pz.jackpot, tickets: per[nick] }); }
          let nick = pick(); winners.push({ rank: 2, nick, amt: pz.second, tickets: per[nick] });
          nick = pick(); winners.push({ rank: 3, nick, amt: pz.third, tickets: per[nick] });
          result = { winners, hit, jackpot: pz.jackpot, carryOut: hit ? 0 : pz.jackpot, seed, sold: lottoSold(w), at: now };
        }
        const tx = await ref.child('result').transaction(c => (c ? undefined : result));
        if (tx.committed && !result.refund && typeof postFeed === 'function') {
          const w1 = result.winners[0];
          postFeed('lotto', result.hit ? `🎟️ 밥심 복권 ${lottoWeekLabel(id)} 1등 잭팟! ${w1.nick}님 🎫 ${w1.amt.toLocaleString()}P 🎉` : `🎟️ 밥심 복권 ${lottoWeekLabel(id)} 1등 없음 → 잭팟 ${result.carryOut.toLocaleString()}P 다음 주로 이월!`, 'legendary', true);
        }
        break; // 갱신된 상태로 다음 회차 진행
      }
      const res = w.result;
      // 은행 보탬은 한 번만 출금 (티켓값·수수료는 은행에 안 들어감 = 시장에서 사라짐)
      if (!w.bankDone && !res.refund && res.seed > 0) {
        const tx = await ref.child('bankDone').transaction(c => (c ? undefined : true));
        if (tx.committed) await db.ref('bank/balance').transaction(c => Math.max(0, (Number(c) || 0) - res.seed));
      }
      // 내 몫
      const me = currentUser.nickname;
      if (w.claimed && w.claimed[me]) continue;
      let amt = 0, label = '';
      if (res.refund) { const n = lottoTickets(w)[me] || 0; amt = n * LOTTO_PRICE; label = `🎟️ 복권 환불 (${lottoWeekLabel(id)} · 참가자 3명 미만)`; }
      else { const win = (res.winners || []).find(x => x.nick === me); if (win && win.amt > 0) { amt = win.amt; label = `🎟️ 밥심 복권 ${win.rank}등 당첨 (${lottoWeekLabel(id)})`; } }
      if (amt <= 0) continue;
      const tx = await ref.child(`claimed/${me}`).transaction(c => (c ? undefined : amt));
      if (!tx.committed) continue;
      if (res.refund) addPoints(amt, label);
      else { myCoupon += amt; couponDirty = true; renderCouponBalance(); }
      updatePointsUI();
      if (typeof bankToast === 'function') bankToast('🎟️ 밥심 복권', res.refund ? `${esc(label)} · <strong>${amt.toLocaleString()}P</strong>` : `${esc(label)} · 🎫 상품권 <strong>${amt.toLocaleString()}P</strong><br><span class="text-[11px]">밥키우기 강화비 · 펫 비용에 자동으로 먼저 쓰여요</span>`);
      if (!res.refund && window.confetti) confetti({ particleCount: 200, spread: 130 });
    }
  } catch (e) { console.warn('복권 정산 오류', e && e.message); }
  finally { lottoBusy = false; }
}

function openLottoModal() { document.getElementById('lottoModal').classList.remove('hidden'); renderLotto(); }
function closeLottoModal() { document.getElementById('lottoModal').classList.add('hidden'); }

function renderLotto() {
  renderLottoHero();
  const box = document.getElementById('lottoBox');
  if (!box) return;
  const cur = lottoCur();
  const w = lottoState[cur.id] || {};
  const per = lottoTickets(w);
  const people = Object.keys(per).length;
  const sold = lottoSold(w);
  const seed = lottoSeedNow();
  const pz = lottoPrizes(cur.id, w, seed);
  const carry = lottoCarryBefore(cur.id);
  const hitPct = Math.round(lottoHitChance(w) * 100);
  const mine = (typeof currentUser !== 'undefined' && per[currentUser.nickname]) || 0;
  const left = Math.max(0, cur.end - lottoNow());
  const dd = Math.floor(left / 86400000), hh = Math.floor(left % 86400000 / 3600000), mm = Math.floor(left % 3600000 / 60000);
  box.innerHTML = `
    <div class="lotto-pot rounded-2xl p-4 text-center space-y-1">
      <div class="text-[10px] font-black tracking-[0.25em] text-amber-200/90">${lottoWeekLabel(cur.id)} · 1등 잭팟</div>
      <div class="text-3xl font-black text-white tracking-tight">🎫 ${pz.jackpot.toLocaleString()}<span class="text-lg">P</span></div>
      ${carry > 0 ? `<div class="inline-block text-[10px] font-black text-amber-950 bg-amber-300 rounded-full px-2 py-0.5">🔥 이월 ${carry.toLocaleString()}P 포함</div>` : ''}
      <div class="text-[11px] text-white/80">이번 주 1등이 나올 확률 <b class="text-white">${hitPct}%</b> <span class="text-white/60">(티켓이 많이 팔릴수록 ↑ · 최대 80%)</span></div>
      <div class="text-[11px] text-white/70">추첨까지 <b class="text-white">${dd ? `${dd}일 ` : ''}${hh}시간 ${mm}분</b> · 참가 ${people}명 · ${sold.toLocaleString()}장</div>
    </div>
    <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
      <div class="rounded-xl bg-amber-50 border border-amber-200 py-2"><div class="font-black text-amber-700">🥇 1등</div><div class="text-slate-500 font-bold">잭팟 · 이월</div></div>
      <div class="rounded-xl bg-slate-50 border border-slate-200 py-2"><div class="font-black text-slate-600">🥈 2등</div><div class="text-slate-700 font-black">${pz.second.toLocaleString()}</div></div>
      <div class="rounded-xl bg-orange-50 border border-orange-200 py-2"><div class="font-black text-orange-700">🥉 3등</div><div class="text-slate-700 font-black">${pz.third.toLocaleString()}</div></div>
    </div>
    <div class="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between text-xs"><span class="font-black text-amber-800">🎫 내 상품권</span><span class="font-black text-amber-700">${myCoupon.toLocaleString()}P</span></div>
    <div class="rounded-2xl border border-slate-200 p-3 space-y-2">
      <div class="flex items-center justify-between text-xs"><span class="font-black text-slate-700">내 티켓</span><span class="font-black text-indigo-600">${mine}장 / ${LOTTO_MAX_PER_WEEK}</span></div>
      <div class="grid grid-cols-3 gap-2">
        <button onclick="buyLotto(1)" class="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2 rounded-xl text-xs whitespace-nowrap">1장</button>
        <button onclick="buyLotto(10)" class="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2 rounded-xl text-xs whitespace-nowrap">10장</button>
        <button onclick="buyLotto(50)" class="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black py-2 rounded-xl text-xs whitespace-nowrap">50장</button>
      </div>
      <div class="text-[10px] text-slate-500 text-center font-bold">1장 = 1만P + 수수료 1,000P</div>
      <ul class="text-[10px] text-slate-400 leading-relaxed list-disc pl-4">
        <li>매주 일요일 자정 추첨 · 서로 다른 사람이 당첨 · 많이 살수록 확률↑</li>
        <li>당첨금은 🎫 <b>밥심 상품권</b> (밥키우기 강화비 · 펫 비용에 먼저 자동 사용)</li>
        <li>티켓 1장 팔릴 때마다 잭팟 +1만P · 1등이 안 나오면 통째로 다음 주로 이월 (최소 1,000만P)</li>
        <li>참가자가 3명 미만이면 티켓값 환불 (수수료 제외)</li>
      </ul>
    </div>
    ${lottoHistoryHTML()}`;
}
function lottoHistoryHTML() {
  const past = Object.entries(lottoState).filter(([id, w]) => w && w.result).sort((a, b) => b[0].localeCompare(a[0]));
  if (!past.length) return '';
  return `<div class="space-y-1.5"><div class="text-[11px] font-black text-slate-700">📜 지난 추첨</div>${past.map(([id, w]) => {
    const r = w.result;
    if (r.refund) return `<div class="text-[11px] text-slate-400 rounded-xl bg-slate-50 px-3 py-2">${lottoWeekLabel(id)} · 참가자 부족으로 환불</div>`;
    return `<div class="rounded-xl bg-slate-50 px-3 py-2 space-y-0.5"><div class="text-[10px] font-bold text-slate-400">${lottoWeekLabel(id)} · ${r.hit ? `1등 잭팟 ${(r.jackpot || 0).toLocaleString()}P` : `1등 없음 → ${(r.carryOut || 0).toLocaleString()}P 이월`}</div>${(r.winners || []).map(x => `<div class="flex justify-between text-[11px]"><span class="font-bold text-slate-700">${['🥇', '🥈', '🥉'][x.rank - 1]} ${esc(x.nick)} <span class="text-slate-400 font-medium">(${x.tickets}장)</span></span><span class="font-black text-slate-800">🎫 ${x.amt.toLocaleString()}P</span></div>`).join('')}</div>`;
  }).join('')}</div>`;
}

// ------------------------------------------------------------------
// 🎫 밥심 상품권: 강화비 · 펫 비용에 포인트보다 먼저 자동 사용
// ------------------------------------------------------------------
let myCoupon = 0, couponDirty = false;
function loadCouponFromUser(val) {
  if (!couponDirty) myCoupon = Math.max(0, Math.floor(Number(val && val.coupon) || 0));
  renderCouponBalance();
}
function couponSyncFields(put) {
  if (couponDirty) { put('coupon', myCoupon); couponDirty = false; }
}
function canPayWithCoupon(cost) { return userPoints + myCoupon >= cost; }
// cost 만큼 결제: 상품권 먼저, 모자라면 포인트. 상품권으로 낸 금액을 돌려줌
function payWithCoupon(cost, reason) {
  const use = Math.min(myCoupon, Math.max(0, Math.floor(cost)));
  if (use > 0) { myCoupon -= use; couponDirty = true; }
  if (cost - use > 0) addPoints(-(cost - use), use > 0 ? `${reason} · 🎫${use.toLocaleString()}` : reason);
  renderCouponBalance();
  return use;
}
function renderCouponBalance() {
  document.querySelectorAll('.coupon-balance').forEach(el => {
    el.textContent = `🎫 상품권 ${myCoupon.toLocaleString()}P`;
    el.classList.toggle('hidden', !(myCoupon > 0));
  });
}

// ------------------------------------------------------------------
// 🏠 메인 카드: 이번 주 복권 잭팟 + 명판 경매 현황
// ------------------------------------------------------------------
function renderLottoHero() {
  const box = document.getElementById('lottoHeroBox');
  if (!box) return;
  const cur = lottoCur();
  const w = lottoState[cur.id] || {};
  const pz = lottoPrizes(cur.id, w, lottoSeedNow());
  const carry = lottoCarryBefore(cur.id);
  const rolls = (() => { let n = 0; const ids = Object.keys(lottoState).filter(k => k < cur.id && lottoState[k].result).sort().reverse(); for (const k of ids) { const r = lottoState[k].result; if (r.refund) continue; if (r.hit) break; n++; } return n; })();
  const left = Math.max(0, cur.end - lottoNow());
  const dd = Math.floor(left / 86400000), hh = Math.floor(left % 86400000 / 3600000), mm = Math.floor(left % 3600000 / 60000);
  const people = Object.keys(lottoTickets(w)).length, sold = lottoSold(w);
  // 명판 (오른쪽 칸)
  let plate = '';
  if (typeof plateRounds === 'function') {
    const { open, next } = plateRounds();
    const top = open && (plateState[open.id] || {}).top;
    const pl = typeof plateLeftText === 'function' ? plateLeftText : () => '';
    const holders = typeof plateWinners === 'function' ? plateWinners() : [];
    plate = open
      ? `<div class="text-xs font-bold text-white/80">🏷️ 명판 경매 · ${roundLabel(open.id)}</div>
         <div class="text-2xl sm:text-3xl font-black tracking-tight leading-none">${top ? top.amount.toLocaleString() : (PLATE_START).toLocaleString()}<span class="text-base font-bold">P</span></div>
         <div class="text-[11px] text-white/75 truncate">${top ? `최고 입찰 ${esc(top.nick)}` : '시작가 · 아직 입찰 없음'}</div>
         <div class="text-[11px] text-white/75">마감까지 ${pl(open.end)}</div>`
      : `<div class="text-xs font-bold text-white/80">🏷️ 명판</div>
         <div class="text-sm font-black truncate">${holders[0] ? esc(holders[0].nick) : '아직 주인 없음'}</div>
         <div class="text-[11px] text-white/75">다음 경매 ${new Date(next.start).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' })}</div>`;
  }
  box.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 h-full">
      <div onclick="openLottoModal()" class="hero-half group cursor-pointer rounded-2xl p-4 flex flex-col justify-between gap-2">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-white/80">🎟️ 이번 주 복권 1등</span>
            ${carry > 0 ? `<span class="text-[10px] font-black text-indigo-700 bg-white rounded-full px-2 py-0.5 whitespace-nowrap">${rolls ? `${rolls}주 ` : ''}이월</span>` : ''}
          </div>
          <div class="text-2xl sm:text-3xl font-black tracking-tight leading-none">${pz.jackpot.toLocaleString()}<span class="text-base font-bold">P</span></div>
          <div class="text-[11px] text-white/75">참가 ${people}명 · ${sold}장 · 1등 확률 ${Math.round(lottoHitChance(w) * 100)}%</div>
          <div class="text-[11px] text-white/75">추첨까지 ${dd ? `${dd}일 ` : ''}${hh}시간 ${mm}분</div>
        </div>
        <div class="flex items-center justify-between"><span class="text-xs font-bold group-hover:underline">복권 사기</span><span class="w-7 h-7 rounded-full bg-white text-indigo-700 flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform">→</span></div>
      </div>
      <div onclick="openPlateModal()" class="hero-half group cursor-pointer rounded-2xl p-4 flex flex-col justify-between gap-2">
        <div class="space-y-1.5">${plate}</div>
        <div class="flex items-center justify-between"><span class="text-xs font-bold group-hover:underline">입찰하러 가기</span><span class="w-7 h-7 rounded-full bg-white text-indigo-700 flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform">→</span></div>
      </div>
    </div>`;
}
setInterval(renderLottoHero, 30000);
setTimeout(renderLottoHero, 3000);
