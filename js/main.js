/* main.js — tabs, ticker board, portfolio, alerts, copybot demo feed */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ── Tabs ── */
$$('.tab').forEach(btn => btn.addEventListener('click', () => {
  $$('.tab').forEach(b => b.classList.remove('active'));
  $$('.panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  $('#tab-' + btn.dataset.tab).classList.add('active');
}));

/* ── Clock ── */
setInterval(() => {
  $('#clock').textContent = new Date().toLocaleTimeString('ko-KR', { hour12:false });
}, 1000);

/* ── Ticker board ── */
const prices = {};   // symbol -> {price, changePct, high, low, okx}

function buildTickerRows() {
  const tbody = $('#ticker-table tbody');
  tbody.innerHTML = '';
  for (const sym of API.SYMBOLS) {
    const tr = document.createElement('tr');
    tr.id = 'row-' + sym;
    tr.innerHTML = `
      <td><b>${sym}</b></td>
      <td class="c-price">—</td>
      <td class="c-chg">—</td>
      <td class="c-high">—</td>
      <td class="c-low">—</td>
      <td class="c-okx">—</td>
      <td class="c-kimp">—</td>`;
    tbody.appendChild(tr);
  }
}

function renderTickers() {
  for (const sym of API.SYMBOLS) {
    const row = document.getElementById('row-' + sym);
    if (!row) continue;
    const p = prices[sym];
    if (!p) continue;
    row.querySelector('.c-price').textContent = fmtPrice(p.price);
    row.querySelector('.c-price').className = 'c-price ' + (p.dir > 0 ? 'price-up' : p.dir < 0 ? 'price-down' : '');
    const chg = row.querySelector('.c-chg');
    chg.textContent = (p.changePct >= 0 ? '+' : '') + p.changePct.toFixed(2) + '%';
    chg.className = 'c-chg ' + (p.changePct >= 0 ? 'pos' : 'neg');
    row.querySelector('.c-high').textContent = fmtPrice(p.high);
    row.querySelector('.c-low').textContent = fmtPrice(p.low);
    if (p.okx != null) {
      row.querySelector('.c-okx').textContent = fmtPrice(p.okx);
      const kimp = ((p.price - p.okx) / p.okx * 100);
      const kEl = row.querySelector('.c-kimp');
      kEl.textContent = (kimp >= 0 ? '+' : '') + kimp.toFixed(3) + '%';
      kEl.className = 'c-kimp ' + (kimp >= 0 ? 'pos' : 'neg');
    } else {
      row.querySelector('.c-okx').textContent = API.isOkxAvailable() ? '…' : '차단됨';
      row.querySelector('.c-kimp').textContent = '-';
    }
  }
}

function fmtPrice(v) {
  if (v == null || isNaN(v)) return '—';
  return v >= 100 ? v.toLocaleString('en-US', { maximumFractionDigits:1 })
       : v >= 1   ? v.toFixed(3)
                  : v.toFixed(6).replace(/0+$/,'');
}

async function pollOkx() {
  for (const sym of API.SYMBOLS) {
    const px = await API.okxTicker(sym);
    if (px != null && prices[sym]) { prices[sym].okx = px; }
  }
  renderTickers();
}

/* ── Portfolio (demo holdings valued at live prices) ── */
const HOLDINGS = [
  { asset:'BTC',  qty: 0.15 },
  { asset:'ETH',  qty: 2.4 },
  { asset:'SOL',  qty: 30 },
  { asset:'XRP',  qty: 1500 },
  { asset:'DOGE', qty: 12000 },
];

function renderPortfolio() {
  let total = 0, dayPnl = 0;
  const rows = HOLDINGS.map(h => {
    const sym = h.asset + 'USDT';
    const p = prices[sym] || {};
    const price = p.price ?? 0;
    const value = price * h.qty;
    total += value;
    dayPnl += value * ((p.changePct ?? 0) / 100);
    return { ...h, price, value, changePct: p.changePct ?? 0 };
  });
  $('#pf-total').textContent = '$' + total.toLocaleString('en-US',{maximumFractionDigits:0});
  const d = $('#pf-day');
  d.textContent = (dayPnl>=0?'+':'') + '$' + Math.abs(dayPnl).toLocaleString('en-US',{maximumFractionDigits:0});
  d.style.color = dayPnl>=0 ? 'var(--green)' : 'var(--red)';
  $('#pf-count').textContent = rows.length;

  const tbody = $('#portfolio-table tbody');
  tbody.innerHTML = '';
  rows.sort((a,b)=>b.value-a.value).forEach(r => {
    const share = total ? (r.value/total*100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${r.asset}</b></td><td>${r.qty.toLocaleString()}</td>
      <td>${fmtPrice(r.price)}</td><td>$${r.value.toLocaleString('en-US',{maximumFractionDigits:0})}</td>
      <td class="${r.changePct>=0?'pos':'neg'}">${(r.changePct>=0?'+':'')+r.changePct.toFixed(2)}%</td>
      <td>${share.toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });
}

/* ── Alerts ── */
const alerts = [];
$('#alert-form').addEventListener('submit', e => {
  e.preventDefault();
  const sym = $('#alert-symbol').value;
  const cond = $('#alert-cond').value;
  const target = parseFloat($('#alert-price').value);
  if (!target) return;
  alerts.push({ sym, cond, target, hit:false });
  $('#alert-price').value = '';
  renderAlerts();
});
function renderAlerts() {
  const ul = $('#alert-list');
  ul.innerHTML = '';
  for (let i = 0; i < alerts.length; i++) {
    const a = alerts[i];
    const cur = prices[a.sym]?.price;
    const hit = !a.hit && cur != null &&
      ((a.cond === 'above' && cur >= a.target) || (a.cond === 'below' && cur <= a.target));
    if (hit) a.hit = true;
    const li = document.createElement('li');
    li.className = 'feed-item';
    li.innerHTML = `
      <div class="alert-row">
        <span>${a.sym} ${a.cond==='above'?'≥':'≤'} <b>${fmtPrice(a.target)}</b> — 현재 ${cur!=null?fmtPrice(cur):'…'}</span>
        <span class="${a.hit?'alert-hit':''}">${a.hit?'🔔 도달!':'대기'}</span>
      </div>`;
    ul.appendChild(li);
    if (hit && window.Notification && Notification.permission === 'granted') {
      new Notification(`${a.sym} 가격 알림`, { body:`목표 ${a.cond==='above'?'이상':'이하'} ${a.target} 도달 — 현재 ${cur}` });
    }
  }
}

/* ── Copybot signal feed (demo simulation) ── */
const LEADERS = [
  { name:'Momentum-X', ex:'Binance' },
  { name:'GridMaster', ex:'OKX' },
  { name:'DCA-Bot', ex:'Binance' },
];
const COINS = ['BTCUSDT','ETHUSDT','SOLUSDT'];
function pushDemoSignal() {
  const feed = $('#signal-feed');
  if (!feed) return;
  const l = LEADERS[Math.floor(Math.random()*LEADERS.length)];
  const c = COINS[Math.floor(Math.random()*COINS.length)];
  const side = Math.random() > .5
    ? '<span class="side long">롱 진입</span>'
    : '<span class="side short">숏 진입</span>';
  const px = prices[c]?.price;
  const li = document.createElement('li');
  li.className = 'feed-item';
  li.innerHTML = `<b>[${l.name}]</b> ${c} ${side} @ ${px!=null?fmtPrice(px):'시장가'} <span style="color:var(--muted)">· 방금</span>`;
  feed.prepend(li);
  while (feed.children.length > 12) feed.lastChild.remove();
}
setInterval(pushDemoSignal, 9000);

/* ── Settings (localStorage only) ── */
const LS_KEY = 'cryptodash_api_keys';
function loadKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    $('#binance-key').value = saved.binanceKey || '';
    $('#okx-key').value = saved.okxKey || '';
  } catch {}
}
$('#api-form').addEventListener('submit', e => {
  e.preventDefault();
  localStorage.setItem(LS_KEY, JSON.stringify({
    binanceKey: $('#binance-key').value.trim(),
    okxKey: $('#okx-key').value.trim(),
    // secrets intentionally NOT persisted in this demo; note shown in UI
  }));
  alert('저장되었습니다. (데모: secret은 저장하지 않음)');
});
$('#api-clear').addEventListener('click', () => {
  localStorage.removeItem(LS_KEY);
  loadKeys();
});

/* ── Leader tracking (추적 탭) ── */
const LS_LEADERS = 'cryptodash_leaders';
function loadLeaders() {
  try { return JSON.parse(localStorage.getItem(LS_LEADERS) || '[]'); }
  catch { return []; }
}
function saveLeaders(list) { localStorage.setItem(LS_LEADERS, JSON.stringify(list)); }

function evaluateLeader(r, rules = {}) {
  const minPnl = rules.minPnl ?? 50;
  const maxMdd = rules.maxMdd ?? -25;
  const minFol = rules.minFol ?? 100;
  const maxFol = rules.maxFol ?? 5000;
  const issues = [];
  const missing = [];
  const pnl = r.pnl == null || r.pnl === '' ? null : Number(r.pnl);
  const mdd = r.mdd == null || r.mdd === '' ? null : Number(r.mdd);
  const followers = r.followers == null || r.followers === '' ? null : Number(r.followers);
  if (pnl == null || Number.isNaN(pnl)) missing.push('수익률');
  else if (pnl < minPnl) issues.push(`수익률 미달 (${minPnl}% 미만)`);
  else if (pnl > 500) issues.push('수익률 과다 — 레버리지 의심');
  if (mdd == null || Number.isNaN(mdd)) missing.push('MDD');
  else if (mdd < maxMdd) issues.push(`MDD 한도 초과 (${maxMdd}%보다 나쁨)`);
  if (followers == null || Number.isNaN(followers)) missing.push('팔로워');
  else if (followers < minFol) issues.push('팔로워 부족');
  else if (followers > maxFol) issues.push('팔로워 과다 — 슬리피지');
  const completeness = 3 - missing.length;
  const score = Math.max(0, Math.round(
    (pnl != null && pnl >= minPnl && pnl <= 500 ? 35 : 0) +
    (mdd != null && mdd >= maxMdd ? 35 : 0) +
    (followers != null && followers >= minFol && followers <= maxFol ? 15 : 0) +
    completeness * 5
  ));
  if (missing.length) return { cls:'verdict-warn', label:'△ 확인 필요: ' + missing.join(', ') + (issues.length ? ' · ' + issues.join(' · ') : ''), score, pass:false };
  if (issues.length) return { cls:'verdict-fail', label:'✗ ' + issues.join(' · '), score, pass:false };
  return { cls:'verdict-pass', label:'✓ 기준 통과', score, pass:true };
}

function checkLeader(l) {
  const result = evaluateLeader({ pnl:l.pnl, mdd:l.mdd, followers:l.followers });
  return { cls: result.pass ? 'pos' : result.cls === 'verdict-warn' ? 'warn' : 'neg', label: result.label };
}

function renderLeaders() {
  const tbody = $('#tracking-table tbody');
  if (!tbody) return;
  const list = loadLeaders();
  tbody.innerHTML = '';
  list.forEach((l, i) => {
    const chk = checkLeader(l);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${l.name}</b></td>
      <td>${l.exchange}</td>
      <td>${l.strategy}</td>
      <td class="${l.pnl>=0?'pos':'neg'}">${l.pnl==null||l.pnl===''?'—':(l.pnl>=0?'+':'')+l.pnl+'%'}</td>
      <td>${l.mdd==null||l.mdd===''?'—':l.mdd+'%'}</td>
      <td class="${chk.cls}" style="font-size:12.5px">${chk.label}</td>
      <td><button data-del="${i}" class="pill idle" style="border:none;cursor:pointer">삭제</button></td>`;
    tbody.appendChild(tr);
  });
}

const leaderForm = $('#leader-form');
if (leaderForm) leaderForm.addEventListener('submit', e => {
  e.preventDefault();
  const list = loadLeaders();
  list.push({
    name: $('#leader-name').value.trim(),
    exchange: $('#leader-exchange').value,
    strategy: $('#leader-strategy').value,
    pnl: $('#leader-pnl').value,
    mdd: $('#leader-mdd').value,
    addedAt: Date.now(),
  });
  saveLeaders(list);
  leaderForm.reset();
  renderLeaders();
});

document.addEventListener('click', e => {
  if (e.target.dataset && e.target.dataset.del !== undefined) {
    const list = loadLeaders();
    list.splice(parseInt(e.target.dataset.del), 1);
    saveLeaders(list);
    renderLeaders();
  }
});
renderLeaders();

/* ── Paste-board auto filter (리더보드 붙여넣기 → 자동 판정) ── */
function parseNumber(tok) {
  if (tok == null) return null;
  let s = String(tok).trim().replace(/,/g, '');
  s = s.replace('%', '').trim();
  const m = s.match(/([-+]?[\d.]+)\s*(k|m|b|만|천|억)?/i);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (isNaN(v)) return null;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'k' || unit === '천') v *= 1e3;
  else if (unit === 'm' || unit === '만') v *= 1e4;
  else if (unit === 'b' || unit === '억') v *= 1e8;
  return v;
}

// Heuristic parser: per line, pull every "N%" token (ROI first, MDD second),
// every bare number (followers), and the first word-ish token as the name.
function parseBoard(text) {
  const rows = [];
  const PCT_RE = /[+\-]?\d[\d.,]*\s*%/g;
  const NUM_RE = /[+\-]?\d[\d.,]*\s*(?:k|m|b|만|천|억)?(?!\s*%)/gi;
  const HEADER_WORDS = /^(roi|mdd|pnl|pnl%|roi%|follower|followers|trader|leader|rank|no\.?|#|이름|트레이더|리더|팔로워|수익률|누적|랭킹|순위)$/i;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/\d/.test(line)) continue;

    // 1) all percentage values in order
    const pctVals = [];
    PCT_RE.lastIndex = 0;
    let mm;
    while ((mm = PCT_RE.exec(line)) !== null) {
      const v = parseNumber(mm[0]);
      if (v != null) pctVals.push(v);
    }

    // 2) strip % tokens, then collect bare numbers (skip tiny indices like rank 1..50)
    const rest = line.replace(PCT_RE, ' ');
    const nums = [];
    NUM_RE.lastIndex = 0;
    while ((mm = NUM_RE.exec(rest)) !== null) {
      const v = parseNumber(mm[0]);
      if (v != null && Math.abs(v) > 20) nums.push(v);   // ranks 1..20 ignored
    }
    const followers = nums.length ? nums.reduce((a,b)=>Math.abs(a)>=Math.abs(b)?a:b) : null;

    // 3) name: first segment containing letters/hangul that isn't a header word
    let name = null;
    const segs = line.split(/[\t]+|\s{2,}|\s*[|·]\s*/).map(s=>s.trim()).filter(Boolean);
    const pool = segs.length > 1 ? segs : line.split(/\s+/);
    for (const seg of pool) {
      if (HEADER_WORDS.test(seg)) continue;
      if (/^[-+]?[\d.,]+\s*%?$/.test(seg)) continue;
      if (/[A-Za-z가-힣]/.test(seg) && seg.length >= 2) { name = seg.replace(/^[\d.#.\-\s]+/, '').trim(); break; }
    }
    if (!name) continue;

    const roi  = pctVals.length ? pctVals[0] : null;
    const mdd  = pctVals.length > 1 ? pctVals.slice(1).reduce((a,b)=>a<b?a:b) : null;
    if (roi == null && followers == null) continue;
    rows.push({ name, roi, mdd, followers });
  }
  return rows;
}

let lastAnalysis = [];
function analyzeBoard() {
  const text = $('#paste-board').value;
  const minPnl = parseFloat($('#f-minpnl').value);
  const maxMdd = parseFloat($('#f-maxmdd').value);       // e.g. -25 means worse-than -25 fails
  const minFol = parseFloat($('#f-minfol').value);
  const maxFol = parseFloat($('#f-maxfol').value);

  const rows = parseBoard(text);
  lastAnalysis = [];
  const tbody = $('#filter-table tbody');
  tbody.innerHTML = '';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted)">붙여넣은 텍스트에서 리더 행을 찾지 못했습니다. 표 형식을 확인해주세요.</td></tr>';
    return;
  }

  const rules = { minPnl, maxMdd, minFol, maxFol };
  for (const r of rows) {
    const verdict = evaluateLeader({ pnl:r.roi, mdd:r.mdd, followers:r.followers }, rules);
    lastAnalysis.push({ ...r, pass: verdict.pass, score: verdict.score, source: $('#f-source').value, capturedAt: new Date().toISOString() });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${r.name}</b></td>
      <td class="${(r.roi??0)>=0?'pos':'neg'}">${r.roi==null?'—':(r.roi>=0?'+':'')+r.roi+'%'}</td>
      <td>${r.mdd==null?'—':r.mdd+'%'}</td>
      <td>${r.followers==null?'—':Math.round(r.followers).toLocaleString()}</td>
      <td><b>${verdict.score}/100</b></td>
      <td class="${verdict.cls}">${verdict.label}</td>
      <td>${verdict.pass?'<span class="pill on">대상</span>':'<span class="pill idle">제외</span>'}</td>`;
    tbody.appendChild(tr);
  }
}

$('#btn-analyze').addEventListener('click', analyzeBoard);

$('#btn-passall').addEventListener('click', () => {
  if (!lastAnalysis.length) analyzeBoard();
  const list = loadLeaders();
  let added = 0;
  for (const r of lastAnalysis) {
    if (!r.pass) continue;
    if (list.some(l => l.name === r.name)) continue;
    list.push({
      name: r.name, exchange: r.source || '—', strategy: '리더보드 발굴',
      pnl: r.roi == null ? '' : String(r.roi),
      mdd: r.mdd == null ? '' : String(r.mdd),
      followers: r.followers == null ? '' : String(r.followers),
      score: r.score == null ? '' : String(r.score),
      source: r.source || '', capturedAt: r.capturedAt || new Date().toISOString(),
      addedAt: Date.now(),
    });
    added++;
  }
  saveLeaders(list);
  renderLeaders();
  alert(`통과 리더 ${added}명을 추적 목록에 등록했습니다.`);
});

$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(loadLeaders(), null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cryptodash-leaders-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('#file-import').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported) || imported.some(x => !x || typeof x.name !== 'string')) throw new Error('형식 오류');
    const merged = [...loadLeaders()];
    for (const leader of imported) {
      if (!merged.some(x => x.name === leader.name && x.exchange === leader.exchange)) merged.push(leader);
    }
    saveLeaders(merged);
    renderLeaders();
    alert(`리더 ${imported.length}명을 확인했습니다. 중복은 제외하고 병합했습니다.`);
  } catch (err) {
    alert('가져오기 실패: 올바른 CryptoDash JSON 파일인지 확인해주세요.');
  } finally {
    e.target.value = '';
  }
});

/* ── Boot ── */
buildTickerRows();
loadKeys();

API.openBinanceStream(
  tick => {
    const prev = prices[tick.symbol]?.price;
    prices[tick.symbol] = { ...tick, dir: prev == null ? 0 : tick.price - prev };
    renderTickers();
    renderPortfolio();
    renderAlerts();
    window.dispatchEvent(new CustomEvent('binance-tick', { detail: tick }));
  },
  connected => {
    $('#ws-status').className = 'dot ' + (connected ? 'on' : 'off');
    $('#ws-label').textContent = connected ? '실시간 연결됨' : '재연결 중…';
  }
);

pollOkx();
setInterval(pollOkx, 15000);
renderPortfolio();

Charts.create('tv-chart-btc', 'BTCUSDT');
Charts.create('tv-chart-eth', 'ETHUSDT');

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission().catch(()=>{});
}
