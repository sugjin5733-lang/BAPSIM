// 밥심 - 🎟️ 밥심 복권 (매주)
//
//  - 한 주 = 월요일 0시 ~ 다음 월요일 0시(한국 시각). 일요일 자정에 추첨
//  - 티켓 1장 1만P · 1인 주당 최대 100장
//  - 상금 = 티켓 판매액의 80% + 은행 보탬(최대 300만P, 금고에 1,000만P 이상 남을 때만)
//    판매액의 나머지 20%는 은행 금고로
//  - 당첨: 서로 다른 3명 · 1등 60% · 2등 25% · 3등 15% (티켓을 많이 살수록 확률↑)
//  - 참가자가 3명 미만이면 추첨 없이 전원 티켓값 환불
//  - 서버가 없으므로: 마감 뒤 처음 들어온 사람이 결과를 한 번만 만들고(트랜잭션),
//    당첨자/환불 대상은 각자 접속하면 자기 몫을 직접 받아감(claimed 로 중복 방지)
//  데이터: bank/lotto/{주 id}/tickets/{키} = { nick, uid, n, at } · /result · /claimed/{닉} · /bankDone

const LOTTO_PRICE = 10000;
const LOTTO_MAX_PER_WEEK = 100;
const LOTTO_POOL_RATE = 0.8;
const LOTTO_SEED_MAX = 3000000;
const LOTTO_RESERVE = 10000000;
const LOTTO_SPLIT = [0.6, 0.25, 0.15];
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
function lottoCur() { const s = lottoWeekStart(); return { id: lottoWeekId(s), start: s, end: s + WEEK_MS }; }

function lottoTickets(w) {
  const t = (w && w.tickets) || {};
  // 1인 주당 최대 장수까지만 인정
  const per = {};
  Object.keys(t).sort().forEach(k => {
    const v = t[k]; if (!v || !v.nick) return;
    const n = Math.max(0, Math.min(Math.floor(Number(v.n) || 0), LOTTO_MAX_PER_WEEK - (per[v.nick] || 0)));
    if (n > 0) per[v.nick] = (per[v.nick] || 0) + n;
  });
  return per;
}
function lottoSold(w) { return Object.values(lottoTickets(w)).reduce((a, b) => a + b, 0); }
function lottoPot(w, seed) { return Math.floor(lottoSold(w) * LOTTO_PRICE * LOTTO_POOL_RATE) + seed; }
function lottoSeedNow() { const bal = (typeof bankState !== 'undefined' && bankState.balance) || 0; return bal - LOTTO_SEED_MAX >= LOTTO_RESERVE ? LOTTO_SEED_MAX : 0; }

// 결과용 난수: 주 id + 모든 티켓 키로 만든 해시 (마감 뒤에는 누구도 바꿀 수 없음)
function lottoHash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
function lottoRng(seedStr) { let s = lottoHash(seedStr) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function watchLotto() {
  if (lottoWatching || typeof db === 'undefined') return;
  lottoWatching = true;
  db.ref('bank/lotto').orderByKey().limitToLast(3).on('value', s => {
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
  const price = n * LOTTO_PRICE;
  if (userPoints < price) return alert(`❌ 포인트가 부족해요! (${price.toLocaleString()}P)`);
  if (!confirm(`🎟️ 밥심 복권 ${n}장을 ${price.toLocaleString()}P에 살까요?\n\n· 일요일 자정 추첨 · 1등 60% · 2등 25% · 3등 15%\n· 많이 살수록 당첨 확률이 올라가요 (1인 주당 최대 ${LOTTO_MAX_PER_WEEK}장)`)) return;
  updatePointsUI();
  addPoints(-price, `🎟️ 밥심 복권 ${n}장 (${lottoWeekLabel(cur.id)})`);
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

// 마감된 주: 결과 만들기 → 은행 정산 → 내 몫 받기
async function settleLotto() {
  if (lottoBusy || !canSyncToCloud()) return;
  lottoBusy = true;
  try {
    const now = lottoNow();
    for (const [id, w] of Object.entries(lottoState)) {
      const start = Date.parse(`${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}T00:00:00+09:00`);
      if (!(start + WEEK_MS <= now) || !w || !w.tickets) continue;
      const ref = db.ref(`bank/lotto/${id}`);
      if (!w.result) {
        const per = lottoTickets(w);
        const people = Object.keys(per);
        const seed = people.length >= 3 ? lottoSeedNow() : 0;
        const pot = lottoPot(w, seed);
        let result;
        if (people.length < 3) result = { refund: true, sold: lottoSold(w), at: now };
        else {
          const rng = lottoRng(id + '|' + Object.keys(w.tickets).sort().join(','));
          const pool = Object.assign({}, per), winners = [];
          for (let r = 0; r < 3; r++) {
            const total = Object.values(pool).reduce((a, b) => a + b, 0);
            let x = rng() * total;
            const nick = Object.keys(pool).sort().find(k => (x -= pool[k]) < 0) || Object.keys(pool)[0];
            winners.push({ rank: r + 1, nick, amt: Math.floor(pot * LOTTO_SPLIT[r]), tickets: per[nick] });
            delete pool[nick];
          }
          result = { winners, pot, seed, sold: lottoSold(w), at: now };
        }
        const tx = await ref.child('result').transaction(c => (c ? undefined : result));
        if (tx.committed && !result.refund) {
          const w1 = result.winners[0];
          if (typeof postFeed === 'function') postFeed('lotto', `🎟️ 밥심 복권 ${lottoWeekLabel(id)} 1등! ${w1.nick}님 ${w1.amt.toLocaleString()}P 당첨 🎉`, 'legendary', true);
        }
        continue; // 다음 갱신 때 정산
      }
      const res = w.result;
      // 은행 정산 (한 번만): 판매액 20% 입금 · 보탬 출금
      if (!w.bankDone && !res.refund) {
        const tx = await ref.child('bankDone').transaction(c => (c ? undefined : true));
        if (tx.committed) {
          const delta = Math.floor((res.sold || 0) * LOTTO_PRICE * (1 - LOTTO_POOL_RATE)) - (res.seed || 0);
          if (delta) await db.ref('bank/balance').transaction(c => (Number(c) || 0) + delta);
        }
      }
      // 내 몫
      const me = currentUser.nickname;
      if (w.claimed && w.claimed[me]) continue;
      let amt = 0, label = '';
      if (res.refund) { const n = lottoTickets(w)[me] || 0; amt = n * LOTTO_PRICE; label = `🎟️ 복권 환불 (${lottoWeekLabel(id)} · 참가자 3명 미만)`; }
      else { const win = (res.winners || []).find(x => x.nick === me); if (win) { amt = win.amt; label = `🎟️ 밥심 복권 ${win.rank}등 당첨 (${lottoWeekLabel(id)})`; } }
      if (amt <= 0) continue;
      const tx = await ref.child(`claimed/${me}`).transaction(c => (c ? undefined : amt));
      if (!tx.committed) continue;
      addPoints(amt, label);
      updatePointsUI();
      if (typeof bankToast === 'function') bankToast('🎟️ 밥심 복권', `${esc(label)} · <strong>${amt.toLocaleString()}P</strong>`);
      if (!res.refund && window.confetti) confetti({ particleCount: 200, spread: 130 });
    }
  } catch (e) { console.warn('복권 정산 오류', e && e.message); }
  finally { lottoBusy = false; }
}

function openLottoModal() { document.getElementById('lottoModal').classList.remove('hidden'); renderLotto(); }
function closeLottoModal() { document.getElementById('lottoModal').classList.add('hidden'); }

function renderLotto() {
  const box = document.getElementById('lottoBox');
  if (!box) return;
  const cur = lottoCur();
  const w = lottoState[cur.id] || {};
  const per = lottoTickets(w);
  const people = Object.keys(per).length;
  const sold = lottoSold(w);
  const seed = lottoSeedNow();
  const mine = (typeof currentUser !== 'undefined' && per[currentUser.nickname]) || 0;
  const chance = sold > 0 && mine > 0 ? Math.min(100, mine / sold * 100 * (people >= 3 ? 3 : 1)) : 0;
  const left = Math.max(0, cur.end - lottoNow());
  const dd = Math.floor(left / 86400000), hh = Math.floor(left % 86400000 / 3600000), mm = Math.floor(left % 3600000 / 60000);
  const pot = lottoPot(w, seed);
  box.innerHTML = `
    <div class="lotto-pot rounded-2xl p-4 text-center space-y-1">
      <div class="text-[10px] font-black tracking-[0.25em] text-amber-200/80">${lottoWeekLabel(cur.id)} 예상 1등 상금</div>
      <div class="text-3xl font-black text-white tracking-tight">${Math.floor(pot * LOTTO_SPLIT[0]).toLocaleString()}<span class="text-lg">P</span></div>
      <div class="text-[11px] text-amber-100/80">총상금 ${pot.toLocaleString()}P${seed ? ` <span class="text-amber-200">(은행 보탬 ${(seed / 10000)}만P 포함)</span>` : ''}</div>
      <div class="text-[11px] text-white/70">추첨까지 <b class="text-white">${dd ? `${dd}일 ` : ''}${hh}시간 ${mm}분</b> · 참가 ${people}명 · ${sold.toLocaleString()}장</div>
    </div>
    <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
      <div class="rounded-xl bg-amber-50 border border-amber-200 py-2"><div class="font-black text-amber-700">🥇 1등</div><div class="text-slate-500">60%</div></div>
      <div class="rounded-xl bg-slate-50 border border-slate-200 py-2"><div class="font-black text-slate-600">🥈 2등</div><div class="text-slate-500">25%</div></div>
      <div class="rounded-xl bg-orange-50 border border-orange-200 py-2"><div class="font-black text-orange-700">🥉 3등</div><div class="text-slate-500">15%</div></div>
    </div>
    <div class="rounded-2xl border border-slate-200 p-3 space-y-2">
      <div class="flex items-center justify-between text-xs"><span class="font-black text-slate-700">내 티켓</span><span class="font-black text-indigo-600">${mine}장 / ${LOTTO_MAX_PER_WEEK}${mine ? ` <span class="text-[10px] text-slate-400 font-bold">(당첨 확률 약 ${chance.toFixed(chance < 10 ? 1 : 0)}%)</span>` : ''}</span></div>
      <div class="grid grid-cols-3 gap-2">
        <button onclick="buyLotto(1)" class="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2 rounded-xl text-xs whitespace-nowrap">1장 · 1만P</button>
        <button onclick="buyLotto(10)" class="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2 rounded-xl text-xs whitespace-nowrap">10장 · 10만P</button>
        <button onclick="buyLotto(50)" class="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black py-2 rounded-xl text-xs whitespace-nowrap">50장 · 50만P</button>
      </div>
      <p class="text-[10px] text-slate-400 leading-relaxed">매주 일요일 자정 추첨 · 서로 다른 3명이 당첨 · 상금은 판매액의 80% + 은행 보탬(최대 300만P) · 참가자가 3명 미만이면 전원 환불</p>
    </div>
    ${lottoHistoryHTML()}`;
}
function lottoHistoryHTML() {
  const past = Object.entries(lottoState).filter(([id, w]) => w && w.result).sort((a, b) => b[0].localeCompare(a[0]));
  if (!past.length) return '';
  return `<div class="space-y-1.5"><div class="text-[11px] font-black text-slate-700">📜 지난 추첨</div>${past.map(([id, w]) => {
    const r = w.result;
    if (r.refund) return `<div class="text-[11px] text-slate-400 rounded-xl bg-slate-50 px-3 py-2">${lottoWeekLabel(id)} · 참가자 부족으로 전원 환불</div>`;
    return `<div class="rounded-xl bg-slate-50 px-3 py-2 space-y-0.5"><div class="text-[10px] font-bold text-slate-400">${lottoWeekLabel(id)} · 총상금 ${(r.pot || 0).toLocaleString()}P</div>${(r.winners || []).map(x => `<div class="flex justify-between text-[11px]"><span class="font-bold text-slate-700">${['🥇', '🥈', '🥉'][x.rank - 1]} ${esc(x.nick)} <span class="text-slate-400 font-medium">(${x.tickets}장)</span></span><span class="font-black text-slate-800">${x.amt.toLocaleString()}P</span></div>`).join('')}</div>`;
  }).join('')}</div>`;
}
