import fs from 'node:fs';

const API = 'https://data-api.polymarket.com', GAMMA = 'https://gamma-api.polymarket.com';
const NAMES = (process.env.ONLY ?? 'wr0ngw4yb3tt0r,mooseborzoii,BreakTheBank,Kch-Temp,TheReturnOfDarthMaul,totoro3miyazaki,sainttroplay').split(',');
const WALLETS = JSON.parse(fs.readFileSync('data/pm-wallets-MONTH.json', 'utf8')).filter((w) => NAMES.includes(w.name));
const MAXPAGES = Number(process.env.MAXPAGES ?? 24), MAXMKT = Number(process.env.MAXMKT ?? 250);
const NOW = Math.floor(Date.now() / 1000), D30 = NOW - 30 * 86400, D90 = NOW - 90 * 86400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url);
    if (r.status === 429 || r.status >= 500) { await sleep(600 * 2 ** i); continue; }
    return r.ok ? r.json() : null;
  }
  return null;
}
const cache = new Map();
async function market(cid) {
  if (cache.has(cid)) return cache.get(cid);
  const m = (await get(`${GAMMA}/markets?condition_ids=${cid}&closed=true`))?.[0];
  let r = null;
  if (m?.closed) { try { const p = JSON.parse(m.outcomePrices).map(Number), t = JSON.parse(m.clobTokenIds); if ((p[0] === 1 && p[1] === 0) || (p[0] === 0 && p[1] === 1)) r = { win: Object.fromEntries(t.map((id, i) => [id, p[i]])), rate: m.feesEnabled ? (m.feeSchedule?.rate ?? 0.05) : 0 }; } catch {} }
  cache.set(cid, r); return r;
}

for (const w of WALLETS) {
  const trades = [];
  for (let pg = 0; pg < MAXPAGES; pg++) { const p = await get(`${API}/trades?user=${w.wallet}&limit=500&offset=${pg * 500}`); if (!p?.length) break; trades.push(...p); if (p.length < 500) break; }
  const buys = trades.filter((t) => t.side === 'BUY' && t.asset && t.conditionId && t.timestamp >= D90);
  const cids = [...new Set(buys.map((t) => t.conditionId))].slice(0, MAXMKT * 2);
  let k = 0; await Promise.all(Array.from({ length: 4 }, async () => { while (k < cids.length) await market(cids[k++]); }));
  const oldest = trades.length ? new Date(Math.min(...trades.map((t) => t.timestamp)) * 1000).toISOString().slice(0, 10) : 'n/a';
  console.log(`\n${w.name}: fetched ${trades.length} trades back to ${oldest}`);
  for (const [label, lo, hi] of [['last 30d (selection window)', D30, NOW + 1], ['days 30-90 ago (OUT OF SAMPLE)', D90, D30]]) {
    const per = new Map(); let cost = 0, pay = 0, n = 0;
    for (const t of buys) {
      if (t.timestamp < lo || t.timestamp >= hi) continue;
      const m = cache.get(t.conditionId); if (!m || m.win[t.asset] === undefined) continue;
      const fee = m.rate * t.price * (1 - t.price), c = t.size * (t.price + fee), pv = t.size * m.win[t.asset];
      cost += c; pay += pv; n++; per.set(t.conditionId, (per.get(t.conditionId) ?? 0) + pv - c);
    }
    if (!cost) { console.log(`  ${label}: no resolved buys`); continue; }
    const pn = [...per.values()], tot = pn.reduce((a, b) => a + b, 0), top = Math.max(...pn);
    console.log(`  ${label}: return after fees ${(100 * (pay - cost) / cost).toFixed(2)}% on $${Math.round(cost).toLocaleString()} | fills ${n}, markets ${per.size}, winning markets ${(100 * pn.filter((x) => x > 0).length / pn.length).toFixed(0)}%, best single market = ${(100 * top / (tot || 1)).toFixed(0)}% of net P&L ($${Math.round(tot).toLocaleString()})`);
  }
}
