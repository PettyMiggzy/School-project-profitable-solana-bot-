import fs from 'node:fs';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
const GAMMA = 'https://gamma-api.polymarket.com', CLOB = 'https://clob.polymarket.com';
const SEASONS = (process.env.SEASONS ?? '2025:18,2026:4').split(',').map((s) => s.split(':').map(Number));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(url); if (r.status === 429 || r.status >= 500) { await sleep(600 * 2 ** i); continue; } return r.ok ? r.json() : null; } catch { await sleep(500); }
  }
  return null;
}
const probFromML = (ml) => (ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100));
const alias = { WSH: ['was', 'wsh'], JAX: ['jax', 'jac'], LAR: ['lar'], LV: ['lv', 'las'], NO: ['no', 'nor'], NE: ['ne', 'nwe'], SF: ['sf', 'sfo'], TB: ['tb', 'tam'], KC: ['kc', 'kan'], GB: ['gb', 'gnb'] };
const abbrs = (a) => alias[a] ?? [a.toLowerCase()];

const games = [];
for (const [year, weeks] of SEASONS) {
  for (let w = 1; w <= weeks; w++) {
    const d = await get(`${ESPN}?dates=${year}&seasontype=2&week=${w}`);
    for (const e of d?.events ?? []) {
      if (e.status.type.name !== 'STATUS_FINAL') continue;
      const c = e.competitions[0], home = c.competitors.find((t) => t.homeAway === 'home'), away = c.competitors.find((t) => t.homeAway === 'away');
      if (!home.winner && !away.winner) continue;
      games.push({ id: e.id, cid: c.id, date: e.date, week: w, year, home: home.team, away: away.team, homeWin: !!home.winner });
    }
  }
}
const seen = new Set(); for (let i = games.length - 1; i >= 0; i--) { if (seen.has(games[i].id)) games.splice(i, 1); else seen.add(games[i].id); }
console.log('finished unique games', games.length);

let idx = 0; const rows = []; const miss = { dk: 0, pm: 0, price: 0 };
await Promise.all(Array.from({ length: 4 }, async () => {
  while (idx < games.length) {
    const g = games[idx++];
    const odds = (await get(`${CORE}/events/${g.id}/competitions/${g.cid}/odds`))?.items?.[0];
    const hm = odds?.homeTeamOdds?.moneyLine, am = odds?.awayTeamOdds?.moneyLine;
    if (hm == null || am == null) { miss.dk++; continue; }
    const qh = probFromML(hm), qa = probFromML(am), dkHome = qh / (qh + qa);
    const day = Date.parse(g.date);
    let ev = null;
    for (const dd of [0, -1, 1]) {
      const ds = new Date(day + dd * 86400000).toISOString().slice(0, 10);
      for (const a of abbrs(g.away.abbreviation)) for (const h of abbrs(g.home.abbreviation)) for (const [x, y] of [[a, h], [h, a]]) {
        const r = await get(`${GAMMA}/events?slug=nfl-${x}-${y}-${ds}`);
        if (r?.length) { ev = r[0]; break; }
      }
      if (ev) break;
    }
    const mk = ev?.markets?.find((m) => m.sportsMarketType === 'moneyline');
    if (!mk) { miss.pm++; continue; }
    const outs = JSON.parse(mk.outcomes), toks = JSON.parse(mk.clobTokenIds), start = Date.parse(mk.gameStartTime.replace('+00', 'Z').replace(' ', 'T')) / 1000;
    const hi = outs.findIndex((o) => o === g.home.shortDisplayName), ai = outs.findIndex((o) => o === g.away.shortDisplayName);
    if (hi < 0 || ai < 0) { miss.pm++; continue; }
    const px = async (t) => { const h = (await get(`${CLOB}/prices-history?market=${toks[t]}&startTs=${start - 7200}&endTs=${start + 300}&fidelity=1`))?.history ?? []; return h.filter((x) => x.t <= start - 120).at(-1)?.p; };
    const pH = await px(hi), pA = await px(ai);
    if (pH == null || pA == null) { miss.price++; continue; }
    rows.push({ id: g.id, year: g.year, week: g.week, home: g.home.abbreviation, away: g.away.abbreviation, dkHome, pmHome: pH, pmAway: pA, homeWin: g.homeWin ? 1 : 0, fee: mk.feeSchedule?.rate ?? (mk.feesEnabled ? 0.05 : 0) });
  }
}));
fs.writeFileSync('data/sports-nfl.json', JSON.stringify(rows));
console.log(`matched ${rows.length} games (missing: no DK odds ${miss.dk}, no PM market ${miss.pm}, no pre-game price ${miss.price})`);
