import fs from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.status === 429 || r.status >= 500) { await sleep(500 * 2 ** i); continue; } return r.ok ? r.json() : null; } catch { await sleep(400); } } return null; }
const dec = (ml) => (ml > 0 ? 1 + ml / 100 : 1 + 100 / -ml);
const snaps = fs.readFileSync('data/picks/snapshots.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const out = [];
for (const s of snaps) {
  const sh = { home: s.home.toLowerCase(), away: s.away.toLowerCase() }, day = s.start.slice(0, 10); let ev = null;
  for (const dd of [0, -1, 1]) { const ds = new Date(Date.parse(s.start) + dd * 864e5).toISOString().slice(0, 10); for (const [x, y] of [[sh.away, sh.home], [sh.home, sh.away]]) { const r = await get(`https://gamma-api.polymarket.com/events?slug=${s.lg}-${x}-${y}-${ds}`); if (r?.length) { ev = r[0]; break; } } if (ev) break; }
  const mk = ev?.markets?.find((m) => m.sportsMarketType === 'moneyline'); if (!mk) continue;
  const outs = JSON.parse(mk.outcomes), toks = JSON.parse(mk.clobTokenIds);
  const ask = []; for (const t of toks) { const b = await get(`https://clob.polymarket.com/book?token_id=${t}`); const a = (b?.asks ?? []).map((x) => ({ p: +x.price, s: +x.size })).sort((x, y) => x.p - y.p)[0]; ask.push(a ?? null); }
  if (ask.some((a) => !a)) continue;
  const [a0, a1] = ask, d = [dec(s.hm), dec(s.am)];
  const m1 = Math.abs(a0.p - s.dk) + Math.abs(a1.p - (1 - s.dk)), m2 = Math.abs(a0.p - (1 - s.dk)) + Math.abs(a1.p - s.dk);
  const outcome0IsHome = m1 <= m2;
  for (const pmIdx of [0, 1]) {
    const pmIsHome = pmIdx === 0 ? outcome0IsHome : !outcome0IsHome, dkOpp = pmIsHome ? 1 : 0;
    const cost = ask[pmIdx].p + 1 / d[dkOpp];
    out.push({ lg: s.lg, game: `${s.away}@${s.home}`, pm: outs[pmIdx], pmAsk: ask[pmIdx].p, pmSize: ask[pmIdx].s, dkSide: dkOpp ? 'away' : 'home', dkDec: d[dkOpp], cost, margin: 1 - cost, mapGap: Math.min(m1, m2) });
  }
}
const valid = out.filter((o) => true);
valid.sort((a, b) => b.margin - a.margin);
console.log('PM-matched games:', new Set(valid.map((o) => o.game)).size);
console.log('Opposite-team pairs only (PM side + DK other side). margin = 1 - cost; positive means a locked profit before fees/limits:');
for (const o of valid.slice(0, 10)) console.log(`${o.lg} ${o.game}: PM '${o.pm}' ask ${o.pmAsk} (size ${o.pmSize}) + DK ${o.dkSide} dec ${o.dkDec.toFixed(2)} -> cost ${o.cost.toFixed(3)} margin ${(100 * o.margin).toFixed(1)}%`);
