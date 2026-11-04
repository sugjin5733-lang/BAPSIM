// 밥심 - 📊 경제 대시보드 (관리자 전용)
//
//  - 지금 통화량: 모든 회원의 포인트 + 보류 + 예치금 (+ 상품권 · 은행 금고는 따로)
//  - 부의 집중: 상위 1명 / 10명이 전체 통화량의 몇 %를 갖고 있는지
//  - 일별 흐름 (내역 보관 기간 3일): 새로 생긴 돈 vs 사라진 돈을 종류별로, 순증가 = 인플레
//    · 보류 이동/송금/예치 입출금처럼 '돈이 옮겨가기만 하는 것'은 빼고 계산
//  - 일별 통화량 기록: 관리자가 대시보드를 열 때마다 그날 값을 bank/econ_daily/{날짜} 에 남겨서 추이를 봄
//  ※ 사라진 돈 중 수수료·부자세·기부는 은행 금고로 가고(시장 밖), 나머지는 완전히 사라짐

const ECON_CATS = [
  // [이름, 정규식, 종류] 종류: move(제외) · admin(관리자 조정) · both(부호로 판단) · src · sink
  ['보류·정산 이동', /보류|일시불/, 'move'],
  ['송금', /송금/, 'move'],
  ['예치 입출금', /은행 예치|예치금 출금|예치 이자 출금/, 'move'],
  ['관리자 조정', /관리자|숙청/, 'admin'],
  ['밥 판매', /밥 판매/, 'src'],
  ['더블업', /더블업|더블 도전 위로금/, 'both'],
  ['재난지원금', /재난지원금/, 'src'],
  ['환급·환불', /환급|환불/, 'src'],
  ['복권', /복권/, 'both'],
  ['강화', /강화 시도|방지권|주문서|초월|도박/, 'sink'],
  ['펫', /펫|알 /, 'sink'],
  ['동상', /동상/, 'sink'],
  ['명판', /명판/, 'sink'],
  ['클럽·의장·정책', /블랙|화이트|의장|정책|권능|도전장|골드/, 'sink'],
  ['상점·치장', /상점|입장권|변경권|배지|색상|닉네임/, 'sink'],
  ['은행(부자세·기부)', /부자세|기부|단축 수수료/, 'sink'],
  ['게임·카드', /채굴|클리커|스피드|기억|슬롯|동전|주사위|대결|예측|게임|카드|잭팟|출석|미션|룰렛|홀짝/, 'both']
];
function econCat(reason) {
  const r = String(reason || '');
  for (const [name, re, kind] of ECON_CATS) if (re.test(r)) return { name, kind };
  return { name: '기타', kind: 'both' };
}
const econFmt = n => `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString()}P`;
const econShort = n => { const a = Math.abs(n); const s = a >= 1e8 ? `${(a / 1e8).toFixed(1)}억` : a >= 1e4 ? `${Math.round(a / 1e4).toLocaleString()}만` : `${Math.round(a)}`; return (n < 0 ? '-' : '') + s; };

async function renderEconDashboard() {
  if (typeof requireAdmin === 'function' && !requireAdmin()) return;
  const box = document.getElementById('econDashboard');
  if (!box) return;
  box.innerHTML = '<div class="text-center text-slate-400 py-6 text-xs">📊 전체 내역을 모으는 중… (몇 초 걸려요)</div>';
  let users = {}, logs = {}, bankBal = 0, history = {};
  try {
    const [u, l, b, h] = await Promise.all([
      db.ref('user_points').once('value'), db.ref('point_logs').once('value'),
      db.ref('bank/balance').once('value'), db.ref('bank/econ_daily').orderByKey().limitToLast(14).once('value')
    ]);
    users = u.val() || {}; logs = l.val() || {}; bankBal = Number(b.val()) || 0; history = h.val() || {};
  } catch (e) { box.innerHTML = `<div class="text-rose-500 text-xs p-3">불러오기 실패: ${esc(e && e.message)}</div>`; return; }

  // 1) 지금 통화량
  const people = Object.values(users).filter(u => u && u.nickname && (u.status === 'approved' || u.approved === true));
  const assetOf = u => (Number(u.points) || 0) + (Number(u.owed) || 0) + (Number(u.deposit && u.deposit.amt) || 0);
  const sum = f => people.reduce((a, u) => a + f(u), 0);
  const pts = sum(u => Number(u.points) || 0), owed = sum(u => Number(u.owed) || 0), dep = sum(u => Number(u.deposit && u.deposit.amt) || 0), coupon = sum(u => Number(u.coupon) || 0);
  const supply = pts + owed + dep;
  const ranked = people.map(u => ({ nick: u.nickname, a: assetOf(u) })).sort((x, y) => y.a - x.a);
  const pos = ranked.filter(r => r.a > 0).reduce((a, r) => a + r.a, 0) || 1;
  const top1 = ranked[0] ? Math.max(0, ranked[0].a) / pos : 0;
  const top10 = ranked.slice(0, 10).reduce((a, r) => a + Math.max(0, r.a), 0) / pos;
  const today = todayKey();

  // 2) 오늘 값 기록 (하루 한 번 이상 열면 그날 마지막 값으로 갱신)
  const snap = { supply, pts, owed, dep, coupon, bank: bankBal, top1: Math.round(top1 * 1000) / 10, top10: Math.round(top10 * 1000) / 10, users: people.length, at: Date.now() };
  db.ref(`bank/econ_daily/${today}`).set(snap).catch(() => {});
  history[today] = snap;

  // 3) 일별 흐름
  const days = {}; // 날짜 → { src: {cat: P}, sink: {cat: P}, admin: P }
  const who = {};  // 날짜 → 닉 → 순증가 (상위 수입자)
  Object.entries(logs).forEach(([nick, rows]) => {
    Object.values(rows || {}).forEach(e => {
      if (!e || typeof e.d !== 'number' || !e.ts) return;
      const d = todayKey(e.ts), c = econCat(e.r);
      if (c.kind === 'move') return;
      const day = days[d] || (days[d] = { src: {}, sink: {}, admin: 0 });
      if (c.kind === 'admin') { day.admin += e.d; return; }
      const side = c.kind === 'src' ? 'src' : c.kind === 'sink' ? 'sink' : (e.d >= 0 ? 'src' : 'sink');
      day[side][c.name] = (day[side][c.name] || 0) + e.d;
      const w = who[d] || (who[d] = {}); w[nick] = (w[nick] || 0) + e.d;
    });
  });
  const dayKeys = Object.keys(days).sort().reverse().slice(0, 4);
  const tot = o => Object.values(o).reduce((a, b) => a + b, 0);

  const bar = (v, max, cls) => `<div class="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full ${cls}" style="width:${Math.min(100, Math.abs(v) / (max || 1) * 100)}%"></div></div>`;
  const dayHTML = dayKeys.map(d => {
    const x = days[d], s = tot(x.src), k = tot(x.sink), net = s + k;
    const max = Math.max(...Object.values(x.src).map(Math.abs), ...Object.values(x.sink).map(Math.abs), 1);
    const rows = (o, cls) => Object.entries(o).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([n, v]) => `<div><div class="flex justify-between text-[10px]"><span class="text-slate-600">${esc(n)}</span><b class="text-slate-800">${econShort(v)}</b></div>${bar(v, max, cls)}</div>`).join('') || '<div class="text-[10px] text-slate-300">없음</div>';
    const topEarn = Object.entries(who[d] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${esc(n)} ${econShort(v)}`).join(' · ');
    return `<div class="rounded-2xl border border-slate-200 p-3 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-slate-800">${d}${d === today ? ' <span class="text-[10px] text-indigo-500">(오늘 · 진행 중)</span>' : ''}</span>
        <span class="text-xs font-black ${net > 0 ? 'text-rose-600' : 'text-emerald-600'}">순증가 ${net > 0 ? '+' : ''}${econShort(net)} ${net > 0 ? '📈 인플레' : '📉 디플레'}</span>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5"><div class="text-[10px] font-black text-emerald-700">💰 생긴 돈 ${econShort(s)}</div>${rows(x.src, 'bg-emerald-400')}</div>
        <div class="space-y-1.5"><div class="text-[10px] font-black text-rose-700">🔥 사라진 돈 ${econShort(k)}</div>${rows(x.sink, 'bg-rose-400')}</div>
      </div>
      <div class="text-[10px] text-slate-400">${x.admin ? `🛡️ 관리자 조정 ${x.admin > 0 ? '+' : ''}${econShort(x.admin)} (흐름에서 제외) · ` : ''}가장 많이 번 사람: ${topEarn || '-'}</div>
    </div>`;
  }).join('');

  // 4) 통화량 추이
  const hk = Object.keys(history).sort();
  const hmax = Math.max(...hk.map(k => history[k].supply || 0), 1);
  const histHTML = hk.length ? `<div class="flex items-end gap-1 h-24">${hk.map((k, i) => {
      const v = history[k].supply || 0, prev = i ? history[hk[i - 1]].supply || 0 : v, up = v >= prev;
      return `<div class="flex-1 flex flex-col items-center justify-end gap-0.5" title="${k} · ${econFmt(v)}"><span class="text-[8px] text-slate-400">${econShort(v)}</span><div class="w-full rounded-t ${up ? 'bg-rose-300' : 'bg-emerald-300'}" style="height:${Math.max(4, v / hmax * 70)}px"></div><span class="text-[8px] text-slate-400">${k.slice(5)}</span></div>`;
    }).join('')}</div>` : '';

  const card = (label, val, sub = '') => `<div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2"><div class="text-[10px] font-bold text-slate-400">${label}</div><div class="text-sm font-black text-slate-900">${val}</div>${sub ? `<div class="text-[10px] text-slate-400">${sub}</div>` : ''}</div>`;
  box.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      ${card('총 통화량', econShort(supply), `포인트 ${econShort(pts)} · 보류 ${econShort(owed)} · 예치 ${econShort(dep)}`)}
      ${card('은행 금고', econShort(bankBal), '시장 밖에 묶인 돈')}
      ${card('🎫 상품권', econShort(coupon), '강화·펫 전용')}
      ${card('부의 집중', `상위 1명 ${(top1 * 100).toFixed(0)}%`, `상위 10명 ${(top10 * 100).toFixed(0)}% · ${ranked[0] ? esc(ranked[0].nick) : '-'} 1위`)}
    </div>
    ${histHTML ? `<div class="rounded-2xl border border-slate-200 p-3"><div class="text-[11px] font-black text-slate-700 mb-1">📈 총 통화량 추이 (관리자가 연 날 기준)</div>${histHTML}</div>` : ''}
    <div class="space-y-2">${dayHTML || '<div class="text-xs text-slate-400 text-center py-3">최근 내역이 없어요.</div>'}</div>
    <p class="text-[10px] text-slate-400">내역은 3일만 보관돼서 일별 흐름은 최근 3~4일만 보여요 · 보류 이동·송금·예치 입출금은 돈이 옮겨가기만 해서 제외 · 사라진 돈 중 수수료·부자세·기부는 은행 금고로 가요</p>`;
}
