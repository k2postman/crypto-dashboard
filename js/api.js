/* api.js — Binance public market data + OKX (best-effort, proxy aware) */

const API = (() => {
  // Binance: data-api.binance.vision is the official public market-data mirror
  // that works without auth and without geo-blocked regions in many cases.
  const BINANCE_REST = 'https://data-api.binance.vision/api/v3';
  const BINANCE_WS   = 'wss://data-stream.binance.vision:9443/stream';
  // OKX direct endpoint; may be blocked depending on region. If it fails we
  // degrade gracefully and mark OKX columns unavailable.
  const OKX_REST = 'https://www.okx.com/api/v5';

  const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
  const OKX_INSTS = { BTCUSDT:'BTC-USDT', ETHUSDT:'ETH-USDT', SOLUSDT:'SOL-USDT', XRPUSDT:'XRP-USDT', DOGEUSDT:'DOGE-USDT' };

  let okxAvailable = true;

  async function jget(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function binance24h(symbol) {
    return jget(`${BINANCE_REST}/ticker/24hr?symbol=${symbol}`);
  }

  async function okxTicker(symbol) {
    if (!okxAvailable) return null;
    try {
      const inst = OKX_INSTS[symbol];
      const d = await jget(`${OKX_REST}/market/ticker?instId=${inst}`);
      return parseFloat(d.data[0].last);
    } catch (e) {
      okxAvailable = false;   // stop hammering a blocked endpoint
      return null;
    }
  }

  function openBinanceStream(onTick, onStatus) {
    const streams = SYMBOLS.map(s => `${s.toLowerCase()}@ticker`).join('/');
    let ws;
    function connect() {
      ws = new WebSocket(`${BINANCE_WS}?streams=${streams}`);
      ws.onopen = () => onStatus(true);
      ws.onmessage = ev => {
        const msg = JSON.parse(ev.data);
        if (msg.data && msg.data.s) {
          const t = msg.data;
          onTick({
            symbol: t.s,
            price: parseFloat(t.c),
            changePct: parseFloat(t.P),
            high: parseFloat(t.h),
            low: parseFloat(t.l),
          });
        }
      };
      ws.onclose = () => { onStatus(false); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { try { ws && ws.close(); } catch {} };
  }

  return { SYMBOLS, binance24h, okxTicker, openBinanceStream, isOkxAvailable: () => okxAvailable };
})();
