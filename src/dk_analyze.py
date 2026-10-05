import json, math, os
exec(open('src/sports_multi_analyze.py').read().split("allrows = []")[0].split("def report")[0])
def pay(ml): return ml / 100 if ml > 0 else 100 / -ml
def stats(rets):
    n = len(rets); mu = sum(rets) / n; se = (sum((v - mu) ** 2 for v in rets) / max(n - 1, 1)) ** .5 / math.sqrt(n); return n, mu, se
def run(name, rows):
    n = len(rows); print(f"\n######## {name}: {n} games, avg vig {100*sum(r['vig'] for r in rows)/n:.2f}%")
    print(f"  logloss DK {sum(ll(r['dk'], r['homeWin']) for r in rows)/n:.4f} | Elo {sum(ll(r['elo'], r['homeWin']) for r in rows)/n:.4f} | home win rate {sum(r['homeWin'] for r in rows)/n:.3f}, DK avg home prob {sum(r['dk'] for r in rows)/n:.3f}")
    b, se = irls([[1.0, lg(r['dk']), lg(r['elo']) - lg(r['dk'])] for r in rows], [r['homeWin'] for r in rows], 3)
    print(f"  outcome ~ b*logit(DK) + c*(Elo-DK): b={b[1]:+.3f}±{se[1]:.3f}  c={b[2]:+.3f}±{se[2]:.3f} (z {b[2]/se[2]:+.2f})")
    def bet(r, side): return (pay(r['hm']) if r['homeWin'] else -1) if side == 'H' else (pay(r['am']) if not r['homeWin'] else -1)
    for lab, f in (("always home", lambda r: 'H'), ("always away", lambda r: 'A'), ("DK favorite", lambda r: 'H' if r['dk'] >= .5 else 'A'), ("DK underdog", lambda r: 'A' if r['dk'] >= .5 else 'H')):
        n_, mu, s = stats([bet(r, f(r)) for r in rows]); print(f"  baseline {lab:12}: {n_} bets, {100*mu:+.1f}% per $1 (se {100*s:.1f}%)")
    for lo, hi in ((0.02, 0.05), (0.05, 0.08), (0.08, 0.12), (0.12, 1)):
        S = [r for r in rows if lo <= abs(r['elo'] - r['dk']) < hi]
        if len(S) < 25: continue
        rets = [bet(r, 'H' if r['elo'] > r['dk'] else 'A') for r in S]; n_, mu, s = stats(rets)
        side_actual = sum((r['homeWin'] if r['elo'] > r['dk'] else 1 - r['homeWin']) for r in S) / len(S); side_dk = sum((r['dk'] if r['elo'] > r['dk'] else 1 - r['dk']) for r in S) / len(S)
        print(f"  bet model side when gap {lo:.2f}-{hi:.2f}: {n_} bets, {100*mu:+.1f}% per $1 (se {100*s:.1f}%), picked side won {side_actual:.3f} vs DK implied {side_dk:.3f}")
allr = []
for sp in ("nfl", "nba", "nhl"):
    f = f"data/dk-backtest-{sp}.json"
    if os.path.exists(f): rows = json.load(open(f)); run(sp.upper(), rows); allr += rows
run("POOLED", allr)
