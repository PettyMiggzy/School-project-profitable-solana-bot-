import fs from 'node:fs';

const SPORT = process.env.SPORT ?? 'nhl';
const CFG = {
  nhl: { path: 'hockey/nhl', start: '2024-10-04', evalFrom: '2025-10-07', end: '2026-06-25', K: 7, HFA: 35, regress: 0.4 },
  nba: { path: 'basketball/nba', start: '2024-10-22', evalFrom: '2025-10-21', end: '2026-06-25', K: 20, HFA: 100, regress: 0.25 },
}[SPORT];
const EVERY = Number(process.env.EVERY ?? 3), MAXG = Number(process.env.MAXG ?? 450);
const ESPN = `https://site.api.espn.com/apis/site/v2/sports/${CFG.path}/scoreboard`, CORE = `https://sports.core.api.espn.com/v2/sports/${CFG.path.replace('/', '/leagues/')}`;
const GAMMA = 'https://gamma-api.polymarket.com', CLOB = 'https://clob.polymarket.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) { for (let i = 0; i < 5; i++) { try { const r = await fetch(url); if (r.status === 429 || r.status >= 500) { await sleep(500 * 2 ** i); continue; } return r.ok ? r.json() : null; } catch { await sleep(500); } } return null; }
const pML = (ml) => (ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100));
const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');

const resFile = `data/${SPORT}-results.json`;
let games;
if (fs.existsSync(resFile)) games = JSON.parse(fs.readFileSync(resFile, 'utf8'));
else {
  games = {}; const days = [];
  for (let d = new Date(CFG.start); d <= new Date(CFG.end); d = new Date(d.getTime() + 864e5)) days.push(new Date(d));
  let i = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (i < days.length) { const day = days[i++]; const j = await get(`${ESPN}?dates=${ymd(day)}&limit=100`); for (const e of j?.events ?? []) { if (e.status.type.name !== 'STATUS_FINAL') continue; const c = e.competitions[0], h = c.competitors.find((t) => t.homeAway === 'home'), a = c.competitors.find((t) => t.homeAway === 'away'); games[e.id] = { id: e.id, cid: c.id, date: e.date, home: h.team, away: a.team, hs: +h.score, as: +a.score }; } } }));
  fs.writeFileSync(resFile, JSON.stringify(games));
}
const gl = Object.values(games).sort((a, b) => a.date.localeCompare(b.date));
console.log(SPORT, 'finished games fetched', gl.length);

const elo = {}, pre = {}; let lastSeason = null;
for (const g of gl) {
  const season = g.date >= CFG.evalFrom ? 1 : 0;
  if (lastSeason !== null && season !== lastSeason) for (const t of Object.keys(elo)) elo[t] = 1500 + (1 - CFG.regress) * (elo[t] - 1500);
  lastSeason = season;
  const h = g.home.abbreviation, a = g.away.abbreviation, eh = elo[h] ?? 1500, ea = elo[a] ?? 1500;
  const p = 1 / (1 + 10 ** (-(eh - ea + CFG.HFA) / 400)); pre[g.id] = p;
  const res = g.hs > g.as ? 1 : 0, mult = Math.log(Math.abs(g.hs - g.as) + 1) + 1, d = CFG.K * mult * (res - p);
  elo[h] = eh + d; elo[a] = ea - d;
}

const days = [...new Set(gl.filter((g) => g.date >= CFG.evalFrom).map((g) => g.date.slice(0, 10)))].sort().filter((_, i) => i % EVERY === 0);
const todo = gl.filter((g) => days.includes(g.date.slice(0, 10))).slice(0, MAXG);
console.log('evaluation games to match', todo.length);
const LEADS = [['3d', 3 * 86400], ['1d', 86400]];
const rows = []; const miss = { dk: 0, pm: 0, px: 0 }; let idx = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (idx < todo.length) {
    const g = todo[idx++];
    const odds = (await get(`${CORE}/events/${g.id}/competitions/${g.cid}/odds`))?.items?.[0];
    const hm = odds?.homeTeamOdds?.moneyLine, am = odds?.awayTeamOdds?.moneyLine;
    if (hm == null || am == null) { miss.dk++; continue; }
    const qh = pML(hm), qa = pML(am), dkHome = qh / (qh + qa);
    const hA = g.home.abbreviation.toLowerCase(), aA = g.away.abbreviation.toLowerCase(); let ev = null;
    for (const dd of [0, -1, 1]) { const ds = new Date(Date.parse(g.date) + dd * 864e5).toISOString().slice(0, 10); for (const [x, y] of [[aA, hA], [hA, aA]]) { const r = await get(`${GAMMA}/events?slug=${SPORT}-${x}-${y}-${ds}`); if (r?.length) { ev = r[0]; break; } } if (ev) break; }
    const mk = ev?.markets?.find((m) => m.sportsMarketType === 'moneyline');
    if (!mk) { miss.pm++; continue; }
    const outs = JSON.parse(mk.outcomes), toks = JSON.parse(mk.clobTokenIds), start = Date.parse(mk.gameStartTime.replace('+00', 'Z').replace(' ', 'T')) / 1000;
    const hi = outs.findIndex((o) => o === g.home.shortDisplayName), ai = outs.findIndex((o) => o === g.away.shortDisplayName);
    if (hi < 0 || ai < 0) { miss.pm++; continue; }
    const pxAt = async (t, lead, win) => { const tgt = start - lead; const h = (await get(`${CLOB}/prices-history?market=${toks[t]}&startTs=${tgt - win}&endTs=${tgt + 60}&fidelity=30`))?.history ?? []; const pt = h.filter((x) => x.t <= tgt).at(-1); return pt && tgt - pt.t <= 4 * 3600 ? pt.p : null; };
    const pH = await pxAt(hi, 120, 7200), pA = await pxAt(ai, 120, 7200);
    if (pH == null || pA == null) { miss.px++; continue; }
    const early = {}; for (const [n, lead] of LEADS) early[n] = { h: await pxAt(hi, lead, 7200), a: await pxAt(ai, lead, 7200) };
    rows.push({ sport: SPORT, id: g.id, home: g.home.abbreviation, away: g.away.abbreviation, dkHome, pmHome: pH, pmAway: pA, homeWin: g.hs > g.as ? 1 : 0, elo: pre[g.id], early, fee: mk.feeSchedule?.rate ?? (mk.feesEnabled ? 0.05 : 0) });
  }
}));
fs.writeFileSync(`data/sports-${SPORT}.json`, JSON.stringify(rows));
console.log(`${SPORT}: matched ${rows.length} games (missing: DK ${miss.dk}, PM market ${miss.pm}, price ${miss.px})`);
