import fs from 'node:fs';

const GAMMA = 'https://gamma-api.polymarket.com', CLOB = 'https://clob.polymarket.com';
const MODE = process.env.MODE ?? 'diverse'; // diverse | btc
const N = Number(process.env.N_MARKETS ?? 150), MIN_VOL = Number(process.env.MIN_VOL ?? 20000);
const OFFSETS = MODE === 'btc' ? (process.env.OFFSETS ?? '300,120,60,30').split(',').map(Number) : (process.env.HOURS ?? '1,6,24').split(',').map(Number).map((h) => h * 3600);
const WINDOW = MODE === 'btc' ? 2 * 3600 : 2 * 86400, FID = MODE === 'btc' ? 1 : 10, MAXGAP = MODE === 'btc' ? 90 : 3 * 3600;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url);
    if (r.status === 429 || r.status >= 500) { await sleep(500 * 2 ** i); continue; }
    return r.ok ? r.json() : null;
  }
  return null;
}
const ts = (s) => Date.parse(s.replace('+00', 'Z').replace(' ', 'T')) / 1000;

const markets = [];
for (let off = 0; markets.length < N && off < 8000; off += 100) {
  const page = await get(`${GAMMA}/markets?closed=true&limit=100&offset=${off}&order=closedTime&ascending=false&volume_num_min=${MIN_VOL}`);
  if (!page?.length) break;
  for (const m of page) {
    try {
      const isBtc = /Bitcoin Up or Down/.test(m.question), isUpDown = /Up or Down/.test(m.question);
      if (MODE === 'btc' ? !isBtc : isUpDown) continue;
      const prices = JSON.parse(m.outcomePrices).map(Number), toks = JSON.parse(m.clobTokenIds);
      if (toks.length !== 2 || !m.closedTime || !m.startDate) continue;
      if (!((prices[0] === 1 && prices[1] === 0) || (prices[0] === 0 && prices[1] === 1))) continue;
      const closed = ts(m.closedTime), start = Date.parse(m.startDate) / 1000;
      if (MODE === 'diverse' && closed - start < 3 * 86400) continue;
      markets.push({ q: m.question, closed, toks, fin: prices, fees: !!m.feesEnabled, rate: m.feeSchedule?.rate ?? (m.feesEnabled ? 0.05 : 0), type: m.feeType, vol: m.volumeNum });
    } catch {}
  }
}
markets.length = Math.min(markets.length, N);
const types = {}; for (const m of markets) types[m.type] = (types[m.type] ?? 0) + 1;
console.log(`MODE ${MODE}: markets ${markets.length}, closes ${new Date(markets.at(-1).closed * 1000).toISOString().slice(0, 10)} .. ${new Date(markets[0].closed * 1000).toISOString().slice(0, 10)}, fee types ${JSON.stringify(types)}`);

const rows = []; let idx = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (idx < markets.length) {
    const m = markets[idx++];
    for (let t = 0; t < 2; t++) {
      const h = await get(`${CLOB}/prices-history?market=${m.toks[t]}&startTs=${m.closed - WINDOW}&endTs=${m.closed}&fidelity=${FID}`);
      const hist = h?.history ?? [];
      if (hist.length < 10) continue;
      for (const off of OFFSETS) {
        const target = m.closed - off, pt = hist.filter((x) => x.t <= target).at(-1);
        if (!pt || target - pt.t > MAXGAP) continue;
        rows.push({ q: m.q.slice(0, 60), off, p: pt.p, win: m.fin[t] === 1 ? 1 : 0, fee: m.rate * pt.p * (1 - pt.p), closed: m.closed });
      }
    }
  }
}));
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(`data/pm-backtest-${MODE}.json`, JSON.stringify(rows));
const buckets = [[0.01, 0.1], [0.1, 0.3], [0.3, 0.5], [0.5, 0.7], [0.7, 0.9], [0.9, 0.97], [0.97, 1.01]];
for (const off of OFFSETS) {
  console.log(`\n--- price ${MODE === 'btc' ? off + 's' : off / 3600 + 'h'} before close; buy as taker (fee included), hold to resolution ---`);
  let tot = 0, nn = 0;
  for (const [lo, hi] of buckets) {
    const r = rows.filter((x) => x.off === off && x.p >= lo && x.p < hi);
    if (r.length < 8) continue;
    const avgP = r.reduce((s, x) => s + x.p, 0) / r.length, win = r.filter((x) => x.win).length / r.length;
    const ret = r.reduce((s, x) => s + (x.win - x.p - x.fee) / x.p, 0) / r.length;
    console.log(`p ${lo}-${hi}: n=${r.length} avg price ${avgP.toFixed(3)} win rate ${(100 * win).toFixed(1)}% (price implies ${(100 * avgP).toFixed(1)}%) -> avg return ${(100 * ret).toFixed(2)}%`);
  }
}
