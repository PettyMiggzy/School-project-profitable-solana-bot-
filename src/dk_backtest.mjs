import fs from 'node:fs';

const LEAGUES = {
  nfl: { path: 'football/nfl', K: 20, HFA: 48, regress: 0.33, results: 'data/nfl-results.json' },
  nba: { path: 'basketball/nba', K: 20, HFA: 100, regress: 0.25, results: 'data/nba-results.json' },
  nhl: { path: 'hockey/nhl', K: 7, HFA: 35, regress: 0.4, results: 'data/nhl-results.json' },
};
const ON = (process.env.LEAGUES ?? 'nfl,nba,nhl').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) { for (let i = 0; i < 4; i++) { try { const r = await fetch(url); if (r.status === 429 || r.status >= 500) { await sleep(500 * 2 ** i); continue; } return r.ok ? r.json() : null; } catch { await sleep(400); } } return null; }
const pML = (ml) => (ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100));

for (const lg of ON) {
  const C = LEAGUES[lg];
  const games = Object.values(JSON.parse(fs.readFileSync(C.results, 'utf8'))).map((g) => ({ id: g.id, cid: g.cid, date: g.date, home: g.home?.abbreviation ?? g.home, away: g.away?.abbreviation ?? g.away, hs: g.hs, as: g.as ?? g.as_, neutral: !!g.neutral })).sort((a, b) => a.date.localeCompare(b.date));
  const elo = {}; let prev = null;
  for (const g of games) {
    const yr = Number(g.date.slice(0, 4)) + (Number(g.date.slice(5, 7)) >= 8 ? 1 : 0);
    if (prev !== null && yr !== prev) for (const t of Object.keys(elo)) elo[t] = 1500 + (1 - C.regress) * (elo[t] - 1500);
    prev = yr;
    const eh = elo[g.home] ?? 1500, ea = elo[g.away] ?? 1500, p = 1 / (1 + 10 ** (-(eh - ea + (g.neutral ? 0 : C.HFA)) / 400)); g.elo = p;
    const d = C.K * (Math.log(Math.abs(g.hs - g.as) + 1) + 1) * ((g.hs > g.as ? 1 : 0) - p);
    elo[g.home] = eh + d; elo[g.away] = ea - d;
  }
  const todo = games.filter((g) => g.hs !== g.as), rows = []; let i = 0, nodk = 0;
  const cidOf = async (g) => g.cid ?? (await get(`https://site.api.espn.com/apis/site/v2/sports/${C.path}/summary?event=${g.id}`))?.header?.competitions?.[0]?.id ?? g.id;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < todo.length) {
      const g = todo[i++];
      const cid = await cidOf(g);
      const it = (await get(`https://sports.core.api.espn.com/v2/sports/${C.path.replace('/', '/leagues/')}/events/${g.id}/competitions/${cid}/odds`))?.items?.[0];
      const hm = it?.homeTeamOdds?.moneyLine, am = it?.awayTeamOdds?.moneyLine;
      if (hm == null || am == null) { nodk++; continue; }
      const qh = pML(hm), qa = pML(am);
      rows.push({ lg, date: g.date.slice(0, 10), home: g.home, away: g.away, hm, am, dk: qh / (qh + qa), vig: qh + qa - 1, elo: g.elo, homeWin: g.hs > g.as ? 1 : 0, provider: it.provider?.name });
    }
  }));
  fs.writeFileSync(`data/dk-backtest-${lg}.json`, JSON.stringify(rows));
  console.log(`${lg}: games ${todo.length}, with odds ${rows.length}, no odds ${nodk}, providers ${JSON.stringify(rows.reduce((o, r) => (o[r.provider] = (o[r.provider] ?? 0) + 1, o), {}))}`);
}
