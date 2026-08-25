/* charts.js — lightweight-charts candlestick charts fed by Binance klines */

const Charts = (() => {
  const BINANCE_REST = 'https://data-api.binance.vision/api/v3';
  const instances = {};

  function toChartRow(k) {
    return { time: Math.floor(k[0] / 1000), open:+k[1], high:+k[2], low:+k[3], close:+k[4] };
  }

  async function create(containerId, symbol, interval = '15m', bars = 300) {
    const el = document.getElementById(containerId);
    if (!el || !window.LightweightCharts) return null;

    const chart = LightweightCharts.createChart(el, {
      layout: { background:{ color:'#131824' }, textColor:'#8a94ab' },
      grid: { vertLines:{ color:'#1c2434' }, horzLines:{ color:'#1c2434' } },
      timeScale: { timeVisible:true, secondsVisible:false },
      autoSize: true,
    });
    const series = chart.addCandlestickSeries({
      upColor:'#2ecc8f', downColor:'#ff5c6c',
      borderUpColor:'#2ecc8f', borderDownColor:'#ff5c6c',
      wickUpColor:'#2ecc8f', wickDownColor:'#ff5c6c',
    });

    try {
      const r = await fetch(`${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${bars}`);
      const data = await r.json();
      series.setData(data.map(toChartRow));
    } catch (e) {
      console.error('kline load failed', e);
    }

    // live updates via shared ticker websocket price
    window.addEventListener('binance-tick', ev => {
      const t = ev.detail;
      if (t.symbol !== symbol) return;
      series.update({ time: Math.floor(Date.now()/1000), open:t.price, high:t.price, low:t.price, close:t.price });
    });

    instances[containerId] = chart;
    return chart;
  }

  return { create };
})();
