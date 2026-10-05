import fs from 'node:fs';

const API = 'https://data-api.polymarket.com';
const TOP = Number(process.env.TOP ?? 10), PERIOD = process.env.PERIOD ?? 'MONTH', MAXT = Number(process.env.MAX_TRADES ?? 3000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url);
    if (r.status === 429 || r.status >= 500) { await sleep(600 * 2 ** i); continue; }
    return r.ok ? r.json() : null;
  }
  return null;
}
const lb = await get(`${API}/v1/leaderboard?timePeriod=${PERIOD}&orderBy=PNL&limit=${TOP}`);
const out = [];
for (const w of lb) {
  const trades = [];
  for (let off = 0; off < MAXT; off += 500) {
    const page = await get(`${API}/trades?user=${w.proxyWallet}&limit=500&offset=${off}&takerOnly=false`);
    if (!page?.length) break;
    trades.push(...page);
    if (page.length < 500) break;
  }
  if (!trades.length) { console.log(w.userName, 'no trades returned'); continue; }
  const ts = trades.map((t) => t.timestamp), spanH = (Math.max(...ts) - Math.min(...ts)) / 3600;
  const buys = trades.filter((t) => t.side === 'BUY'), usd = (t) => t.size * t.price;
  const bUsd = buys.reduce((s, t) => s + usd(t), 0), allUsd = trades.reduce((s, t) => s + usd(t), 0);
  const share = (f) => (100 * buys.filter(f).reduce((s, t) => s + usd(t), 0) / bUsd).toFixed(0);
  const cats = {};
  for (const t of trades) { const k = /Up or Down/.test(t.title) ? 'crypto-updown' : /vs\.?\s|Spread|O\/U|Winner/i.test(t.title) ? 'sports' : 'other'; cats[k] = (cats[k] ?? 0) + usd(t); }
  const catS = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / allUsd).toFixed(0)}%`).join(', ');
  const markets = new Set(trades.map((t) => t.conditionId)).size;
  const row = { name: w.userName, wallet: w.proxyWallet, monthPnl: Math.round(w.pnl), monthVol: Math.round(w.vol), trades: trades.length, spanHours: +spanH.toFixed(1), tradesPerHour: +(trades.length / Math.max(spanH, 0.1)).toFixed(1), medianTradeUsd: +trades.map(usd).sort((a, b) => a - b)[Math.floor(trades.length / 2)].toFixed(2), buyPct: +(100 * buys.length / trades.length).toFixed(0), buyUsdAtP95plus: +share((t) => t.price >= 0.95), buyUsdAtP05minus: +share((t) => t.price <= 0.05), markets, cats: catS };
  out.push(row);
  console.log(`${row.name}: pnl $${row.monthPnl.toLocaleString()} | ${row.trades} trades over ${row.spanHours}h (${row.tradesPerHour}/h), median $${row.medianTradeUsd}, buys ${row.buyPct}%, buy$ at >=0.95: ${row.buyUsdAtP95plus}%, <=0.05: ${row.buyUsdAtP05minus}%, ${row.markets} markets | ${row.cats}`);
}
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(`data/pm-wallets-${PERIOD}.json`, JSON.stringify(out, null, 1));
