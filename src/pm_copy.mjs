import fs from 'node:fs';

const API = 'https://data-api.polymarket.com', GAMMA = 'https://gamma-api.polymarket.com', CLOB = 'https://clob.polymarket.com';
const WALLETS = JSON.parse(fs.readFileSync('data/pm-wallets-MONTH.json', 'utf8')).filter((w) => (process.env.ONLY ?? 'UpTheBlues,mooseborzoii,wr0ngw4yb3tt0r,BreakTheBank,e46m3').split(',').includes(w.name));
const DELAYS = [0, 30, 120, 600];
const MAXTOK = Number(process.env.MAX_TOKENS ?? 120);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url);
    if (r.status === 429 || r.status >= 500) { await sleep(600 * 2 ** i); continue; }
    return r.ok ? r.json() : null;
  }
  return null;
}
const resCache = new Map();
async function resolution(cid) {
  if (resCache.has(cid)) return resCache.get(cid);
  const m = (await get(`${GAMMA}/markets?condition_ids=${cid}&closed=true`))?.[0];
  let r = null;
  if (m?.closed) { try { const p = JSON.parse(m.outcomePrices).map(Number), t = JSON.parse(m.clobTokenIds); if ((p[0] === 1 && p[1] === 0) || (p[0] === 0 && p[1] === 1)) r = Object.fromEntries(t.map((id, i) => [id, p[i]])); } catch {} }
  resCache.set(cid, r); return r;
}

for (const w of WALLETS) {
  const trades = [];
  for (let off = 0; off < 1500; off += 500) { const p = await get(`${API}/trades?user=${w.wallet}&limit=500&offset=${off}`); if (!p?.length) break; trades.push(...p); }
  const buys = trades.filter((t) => t.side === 'BUY' && t.asset && t.conditionId);
  const byTok = new Map(); for (const t of buys) (byTok.get(t.asset) ?? byTok.set(t.asset, []).get(t.asset)).push(t);
  const toks = [...byTok.entries()].slice(0, MAXTOK);
  const agg = Object.fromEntries(DELAYS.map((d) => [d, { cost: 0, pay: 0, n: 0 }]));
  let resolved = 0, unresolved = 0;
  for (const [asset, ts] of toks) {
    const res = await resolution(ts[0].conditionId);
    if (!res || res[asset] === undefined) { unresolved++; continue; }
    resolved++;
    const win = res[asset], t0 = Math.min(...ts.map((t) => t.timestamp)), t1 = Math.max(...ts.map((t) => t.timestamp));
    let hist = [];
    if (t1 - t0 < 40 * 3600) hist = (await get(`${CLOB}/prices-history?market=${asset}&startTs=${t0 - 300}&endTs=${t1 + 800}&fidelity=1`))?.history ?? [];
    for (const t of ts) {
      for (const d of DELAYS) {
        let p = t.price;
        if (d > 0) { const pt = hist.find((x) => x.t >= t.timestamp + d); if (!pt) continue; p = pt.p; }
        if (p <= 0.001 || p >= 0.999) continue;
        const a = agg[d]; a.cost += t.size * p; a.pay += t.size * win; a.n++;
      }
    }
  }
  const fmt = (a) => (a.cost ? `${(100 * (a.pay - a.cost) / a.cost).toFixed(2)}% on $${Math.round(a.cost).toLocaleString()} (n=${a.n})` : 'n/a');
  console.log(`\n${w.name}: tokens used ${resolved} resolved / ${unresolved} unresolved-or-skipped, pnl(month) $${w.monthPnl.toLocaleString()}`);
  console.log(`  wallet's own fills: ${fmt(agg[0])}`);
  for (const d of DELAYS.slice(1)) console.log(`  copying ${d}s later at market price: ${fmt(agg[d])}`);
}
