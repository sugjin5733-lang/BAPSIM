// 밥심 - 설정, 공통 헬퍼, 전역 상태

// ==========================================
// Core Configuration & Database
// ==========================================
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxzRrg_ZZrdJGs6ps4ZRdgaNv3XG8g_CQT0376hbhV_oJt0AYe40Smkcl_0gIfwJM6WIQ/exec";

const firebaseConfig = {
  apiKey: "AIzaSyDYTK4MRGsxXWz_jzN7qlaFzrVhMVKgWxw",
  authDomain: "babsim-a3556.firebaseapp.com",
  databaseURL: "https://babsim-a3556-default-rtdb.firebaseio.com",
  projectId: "babsim-a3556",
  storageBucket: "babsim-a3556.firebasestorage.app",
  messagingSenderId: "791532866408",
  appId: "1:791532866408:web:891ef952af5e62386864dd",
  measurementId: "G-67HDKHR6WX"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// 보안/안정성 헬퍼
// ==========================================
// HTML 특수문자 이스케이프 (채팅/닉네임/식당명 등에 HTML·스크립트 삽입 차단)
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// onclick="fn(${jsArg(x)})" 형태로 안전하게 문자열 인자 전달
function jsArg(s) { return esc(JSON.stringify(String(s == null ? '' : s))); }
// 색상은 #hex 만 허용
function safeColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : ''; }
// CSS 클래스명은 영문/숫자/-/_ 만 허용
function safeClass(c) { return /^[a-zA-Z0-9_-]+$/.test(c || '') ? c : 'nb-none'; }
// URL 은 http(s) 만 허용
function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
// 배열/문자열 어느 쪽이 와도 배열로 정규화 (시트에서 "A, B" 문자열로 오는 경우 대비)
function toArr(v) {
  if (Array.isArray(v)) return v.map(String);
  if (v && typeof v === 'object') return Object.values(v).map(String);
  if (v == null || v === '') return [];
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}
// 닉네임 + 배지/색/칭호 렌더링 공통 함수
function nickHTML(u, extraClass = '') {
  const sym = u.symbol ? esc(u.symbol) : '';
  const color = safeColor(u.color);
  return `<span class="${safeClass(u.badge || u.bg)} ${extraClass} inline-block" style="${color ? `color:${color} !important;` : ''}">${sym ? sym + ' ' : ''}${esc(u.nickname)}${sym ? ' ' + sym : ''}</span>`;
}
// 비밀번호 해시 (DB에 평문 저장 방지)
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bapsim:' + text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 상태 관리
let restaurants = {};
let allGroups = {};
let currentGroupId = localStorage.getItem('bapsim_current_group_id') || 'lobby';
let currentGroupName = localStorage.getItem('bapsim_current_group_name') || '전체 공개 로비';
// 계정 관련 상태는 브라우저 저장소가 아니라 서버(user_points)에서만 받아옵니다.
// (같은 PC를 여러 사람이 써도 이전 사용자의 포인트/아이템이 섞이지 않도록)
const GUEST_NICK = "문정러";
let currentUser = { nickname: GUEST_NICK };
let myVotedId = localStorage.getItem(`bapsim_my_vote_${currentGroupId}`);
let targetJoinGroupId = null;

let userPoints = 0;
let myNickColor = '';
let myNickBg = 'nb-none';
let myNickSymbol = '';
let isUserApproved = false;
let myInventory = { colors: [], bgs: ['nb-none'], symbols: [] };

let isMenuExpanded = false;
let groupVotesRef = null;
let groupVotesData = {};
let chatRef = null;

// 미니게임 변수들
let gameInterval = null;
let gameTimeLeft = 10.0;
let gameClicks = 0;
let isGameRunning = false;

let speedInterval = null;
let speedTimeLeft = 5.0;
let speedHits = 0;
let isSpeedRunning = false;

const MEMORY_OPTIONS = ["제육볶음", "돈까스", "닭강정", "김치찜"];
let memorySequence = [];
let memoryUserStep = 0;
let isMemoryGameActive = false;

const SLOT_ITEMS = ["🍚", "🍗", "🥩", "🍕", "🍜", "👑", "💎"];
let isSlotSpinning = false;
let diceExactBetTimestamps = [];

function formatPrettyDate(dateRaw) {
  if (!dateRaw) return { text: "날짜미지정", isToday: false, iso: "" };
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  let parsed = dateRaw;
  if (dateRaw.includes("GMT") || dateRaw.length > 12) {
    const dObj = new Date(dateRaw);
    if (!isNaN(dObj.getTime())) {
      parsed = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
    }
  }

  const isToday = (parsed === todayISO);
  const parts = parsed.split('-');
  if (parts.length === 3) {
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return { text: `${m}/${d}${isToday ? ' (오늘)' : ''}`, isToday: isToday, iso: parsed };
  }
  return { text: parsed, isToday: isToday, iso: parsed };
}

// DB 접근 실패 시 조용히 멈추지 않고 화면에 원인을 표시
let dbErrorShown = false;
function onDbError(err) {
  console.error('Firebase DB 오류:', err);
  if (dbErrorShown) return;
  dbErrorShown = true;
  showFatalBanner(
    String(err && err.code || '').includes('PERMISSION_DENIED') || String(err && err.message || '').includes('permission')
      ? '데이터베이스 접근이 거부되었습니다 (보안 규칙 확인 필요). 잠시 후 다시 시도해주세요.'
      : '데이터베이스 연결에 문제가 발생했습니다: ' + (err && err.message || err)
  );
}
function showFatalBanner(text) {
  let el = document.getElementById('fatalErrorBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatalErrorBanner';
    el.className = 'bg-rose-600 text-white px-4 py-2.5 text-center text-xs font-black sticky top-0 z-50 shadow-md';
    document.body.prepend(el);
  }
  el.textContent = '⚠️ ' + text;
}
