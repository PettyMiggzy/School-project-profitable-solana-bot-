import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.env.FILE ?? 'data/sports-nfl.json', 'utf8')), n = r.length;
const ll = (p, y) => { p = Math.min(Math.max(p, 1e-4), 1 - 1e-4); return -(y * Math.log(p) + (1 - y) * Math.log(1 - p)); };
for (const x of r) { const s = x.pmHome + x.pmAway; x.pmH = x.pmHome / s; x.over = s - 1; }
const byYear = {}; for (const x of r) byYear[x.year] = (byYear[x.year] ?? 0) + 1;
console.log(`games ${n} ${JSON.stringify(byYear)}, PM overround avg ${(r.reduce((s, x) => s + x.over, 0) / n).toFixed(4)}`);
for (const [name, f] of [['DraftKings de-vigged', (x) => x.dkHome], ['Polymarket normalized', (x) => x.pmH], ['coin flip', () => 0.5]])
  console.log(`${name.padEnd(24)} accuracy ${(r.filter((x) => (f(x) > 0.5) === !!x.homeWin).length / n).toFixed(3)}  brier ${(r.reduce((s, x) => s + (f(x) - x.homeWin) ** 2, 0) / n).toFixed(4)}  logloss ${(r.reduce((s, x) => s + ll(f(x), x.homeWin), 0) / n).toFixed(4)}`);
const d = r.map((x) => x.pmH - x.dkHome), m = d.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
console.log(`PM minus DK home prob: mean ${m.toFixed(4)}, sd ${sd.toFixed(4)}, mean abs ${(d.reduce((s, v) => s + Math.abs(v), 0) / n).toFixed(4)}, max abs ${Math.max(...d.map(Math.abs)).toFixed(3)}`);
const typicalFee = r.reduce((s, x) => s + x.fee * 0.25, 0) / n;
console.log(`typical taker fee at p=0.5 per share ${typicalFee.toFixed(4)} (= ${(100 * typicalFee / 0.5).toFixed(2)}% of cost)`);
for (const delta of [0, 0.01, 0.02, 0.03]) {
  const pn = [];
  for (const x of r) for (const [pm, dk, win] of [[x.pmHome, x.dkHome, x.homeWin], [x.pmAway, 1 - x.dkHome, 1 - x.homeWin]])
    if (pm < dk - delta && pm > 0.02 && pm < 0.98) { const c = pm + x.fee * pm * (1 - pm); pn.push((win - c) / c); }
  if (!pn.length) continue;
  const mu = pn.reduce((a, b) => a + b, 0) / pn.length, se = Math.sqrt(pn.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(pn.length - 1, 1)) / Math.sqrt(pn.length);
  console.log(`buy when PM < DK - ${delta.toFixed(2)}: bets ${pn.length}, avg return after fees ${(100 * mu).toFixed(1)}% (std err ${(100 * se).toFixed(1)}%)`);
}
const fav = r.map((x) => (x.dkHome >= 0.5 ? [x.dkHome, x.homeWin] : [1 - x.dkHome, 1 - x.homeWin]));
for (const [lo, hi] of [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 1]]) { const b = fav.filter(([p]) => p >= lo && p < hi); if (b.length >= 8) console.log(`DK favorites ${lo}-${hi}: n=${b.length} implied ${(100 * b.reduce((s, [p]) => s + p, 0) / b.length).toFixed(1)}% actual ${(100 * b.reduce((s, [, w]) => s + w, 0) / b.length).toFixed(1)}%`); }
