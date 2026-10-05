import fs from 'node:fs';

const LEAGUES = {
  nfl: { path: 'football/nfl', K: 20, HFA: 48, regress: 0.33, results: 'data/nfl-results.json' },
  nba: { path: 'basketball/nba', K: 20, HFA: 100, regress: 0.25, results: 'data/nba-results.json' },
  nhl: { path: 'hockey/nhl', K: 7, HFA: 35, regress: 0.4, results: 'data/nhl-results.json' },
};
const ON = (process.env.LEAGUES ?? 'nfl,nba,nhl').split(','), DAYS = Number(process.env.DAYS ?? 7), EDGE = Number(process.env.EDGE ?? 0.03);
const FILE = 'data/picks/snapshots.jsonl', CMD = process.argv[2] ?? 'snap';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) { for (let i = 0; i < 4; i++) { try { const r = await fetch(url); if (r.status === 429 || r.status >= 500) { await sleep(500 * 2 ** i); continue; } return r.ok ? r.json() : null; } catch { await sleep(400); } } return null; }
const pML = (ml) => (ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100));
const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');
const board = (lg, date) => get(`https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[lg].path}/scoreboard?dates=${date}&limit=100`);

function loadGames(lg) {
  const raw = Object.values(JSON.parse(fs.readFileSync(LEAGUES[lg].results, 'utf8')));
  return raw.map((g) => ({ id: g.id, date: g.date, home: g.home?.abbreviation ?? g.home, away: g.away?.abbreviation ?? g.away, hs: g.hs, as: g.as ?? g.as_, neutral: !!g.neutral })).sort((a, b) => a.date.localeCompare(b.date));
}
function eloNow(lg) {
  const C = LEAGUES[lg], elo = {}; let prevYear = null;
  for (const g of loadGames(lg)) {
    const yr = Number(g.date.slice(0, 4)) + (Number(g.date.slice(5, 7)) >= 8 ? 1 : 0);
    if (prevYear !== null && yr !== prevYear) for (const t of Object.keys(elo)) elo[t] = 1500 + (1 - C.regress) * (elo[t] - 1500);
    prevYear = yr;
    const eh = elo[g.home] ?? 1500, ea = elo[g.away] ?? 1500, p = 1 / (1 + 10 ** (-(eh - ea + (g.neutral ? 0 : C.HFA)) / 400));
    const d = C.K * (Math.log(Math.abs(g.hs - g.as) + 1) + 1) * ((g.hs > g.as ? 1 : 0) - p);
    elo[g.home] = eh + d; elo[g.away] = ea - d;
  }
  return { elo, C };
}

async function snap() {
  fs.mkdirSync('data/picks', { recursive: true }); let n = 0;
  for (const lg of ON) {
    const { elo, C } = eloNow(lg);
    for (let i = 0; i <= DAYS; i++) {
      const d = await board(lg, ymd(new Date(Date.now() + i * 864e5)));
      for (const e of d?.events ?? []) {
        if (e.status.type.name !== 'STATUS_SCHEDULED') continue;
        const c = e.competitions[0], h = c.competitors.find((t) => t.homeAway === 'home').team.abbreviation, a = c.competitors.find((t) => t.homeAway === 'away').team.abbreviation;
        const odds = (await get(`https://sports.core.api.espn.com/v2/sports/${C ? LEAGUES[lg].path.replace('/', '/leagues/') : ''}/events/${e.id}/competitions/${c.id}/odds`))?.items?.[0];
        const hm = odds?.homeTeamOdds?.moneyLine, am = odds?.awayTeamOdds?.moneyLine;
        if (hm == null || am == null) continue;
        const qh = pML(hm), qa = pML(am), dk = qh / (qh + qa), me = 1 / (1 + 10 ** (-((elo[h] ?? 1500) - (elo[a] ?? 1500) + (c.neutralSite ? 0 : C.HFA)) / 400));
        fs.appendFileSync(FILE, JSON.stringify({ ts: new Date().toISOString(), lg, id: e.id, start: e.date, home: h, away: a, hm, am, dk, model: me, edgeHome: me - dk }) + '\n'); n++;
      }
    }
  }
  console.log(`snapshots written: ${n}`);
}

async function settle() {
  const snaps = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  const byGame = new Map(); for (const s of snaps) (byGame.get(s.lg + s.id) ?? byGame.set(s.lg + s.id, []).get(s.lg + s.id)).push(s);
  const results = {}, cache = {}; let rows = [];
  for (const arr of byGame.values()) {
    arr.sort((x, y) => x.ts.localeCompare(y.ts)); const g = arr[0], start = Date.parse(g.start);
    if (start > Date.now() - 4 * 3600e3) continue;
    const key = g.lg + g.start.slice(0, 10).replaceAll('-', '');
    cache[key] ??= await board(g.lg, g.start.slice(0, 10).replaceAll('-', ''));
    const ev = cache[key]?.events?.find((e) => e.id === g.id);
    if (!ev || ev.status.type.name !== 'STATUS_FINAL') continue;
    const homeWin = ev.competitions[0].competitors.find((t) => t.homeAway === 'home').winner ? 1 : 0;
    const early = arr.find((s) => start - Date.parse(s.ts) >= 36 * 3600e3) ?? arr[0], close = [...arr].reverse().find((s) => Date.parse(s.ts) < start) ?? arr.at(-1);
    const side = early.edgeHome >= 0 ? 'H' : 'A', edge = Math.abs(early.edgeHome), ml = side === 'H' ? early.hm : early.am, win = side === 'H' ? homeWin : 1 - homeWin;
    const payout = ml > 0 ? ml / 100 : 100 / -ml, pickDk = (side === 'H' ? early.dk : 1 - early.dk), pickClose = (side === 'H' ? close.dk : 1 - close.dk);
    rows.push({ lg: g.lg, edge, win, ret: win ? payout : -1, clv: pickClose - pickDk, hoursBefore: (start - Date.parse(early.ts)) / 3600e3 });
  }
  const show = (name, r) => { if (!r.length) return; const mu = r.reduce((s, x) => s + x.ret, 0) / r.length, sd = Math.sqrt(r.reduce((s, x) => s + (x.ret - mu) ** 2, 0) / Math.max(r.length - 1, 1)), clv = r.reduce((s, x) => s + x.clv, 0) / r.length; console.log(`${name}: ${r.length} picks, win ${(100 * r.filter((x) => x.win).length / r.length).toFixed(0)}%, avg return per $1 ${(100 * mu).toFixed(1)}% (std err ${(100 * sd / Math.sqrt(r.length)).toFixed(1)}%), avg closing-line value ${(100 * clv).toFixed(2)} pts`); };
  console.log(`settled games: ${rows.length}`);
  for (const lg of ON) { show(`${lg} all picks`, rows.filter((x) => x.lg === lg)); show(`${lg} edge >= ${EDGE}`, rows.filter((x) => x.lg === lg && x.edge >= EDGE)); }
  show('ALL edge >= ' + EDGE, rows.filter((x) => x.edge >= EDGE));
}

if (CMD === 'snap') await snap(); else if (CMD === 'settle') await settle(); else console.log('usage: node src/picks/picks.mjs snap|settle');
