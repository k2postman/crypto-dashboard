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

function checkLeader(l) {
  const issues = [];
  const pnl = l.pnl == null || l.pnl === '' ? null : parseFloat(l.pnl);
  const mdd = l.mdd == null || l.mdd === '' ? null : parseFloat(l.mdd);
  if (pnl != null && pnl > 500) issues.push('수익률 과다 — 레버리지 과다 의심');
  if (pnl != null && pnl < 0) issues.push('누적 손실 상태');
  if (mdd != null && mdd < -25) issues.push('MDD 기준 초과');
  if (!issues.length) return { cls:'pos', label:'기준 통과' };
  return { cls:'neg', label:issues.join(' · ') };
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
