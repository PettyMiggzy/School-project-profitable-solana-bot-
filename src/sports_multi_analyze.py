import json, math, os, sys

def lg(p): p = min(max(p, 1e-4), 1 - 1e-4); return math.log(p / (1 - p))
def ll(p, y): p = min(max(p, 1e-4), 1 - 1e-4); return -(y * math.log(p) + (1 - y) * math.log(1 - p))
def sig(z): return 1 / (1 + math.exp(-z))
def irls(X, y, k):
    b = [0.0] * k
    for _ in range(60):
        g = [0.0] * k; H = [[0.0] * k for _ in range(k)]
        for xi, yi in zip(X, y):
            p = sig(sum(bi * xj for bi, xj in zip(b, xi))); w = p * (1 - p)
            for i in range(k):
                g[i] += (yi - p) * xi[i]
                for j in range(k): H[i][j] += w * xi[i] * xi[j]
        M = [H[i][:] + [1.0 if i == j else 0.0 for j in range(k)] + [g[i]] for i in range(k)]
        for i in range(k):
            piv = max(range(i, k), key=lambda r: abs(M[r][i])); M[i], M[piv] = M[piv], M[i]
            M[i] = [a / M[i][i] for a in M[i]]
            for r in range(k):
                if r != i: f = M[r][i]; M[r] = [a - f * c for a, c in zip(M[r], M[i])]
        d = [M[i][-1] for i in range(k)]; b = [bi + di for bi, di in zip(b, d)]
        if max(abs(x) for x in d) < 1e-9: break
    return b, [math.sqrt(max(M[i][k + i], 0)) for i in range(k)]

def report(name, rows):
    print(f"\n########## {name}: {len(rows)} games ##########")
    for lead in ("3d", "1d", "close"):
        G = []
        for r in rows:
            if lead == "close": h, a = r["pmHome"], r["pmAway"]
            else:
                e = r["early"].get(lead) or {}; h, a = e.get("h"), e.get("a")
            if h is None or a is None or h + a <= 0: continue
            G.append(dict(r=r, ph=h / (h + a), h=h, a=a))
        n = len(G)
        if n < 40: print(f"[{lead}] n={n} skipped"); continue
        absd = sum(abs(g["ph"] - g["r"]["dkHome"]) for g in G) / n
        print(f"\n=== {lead}: n={n}, PM vs DK close mean abs diff {absd:.4f}")
        for nm, f in (("PM@lead", lambda g: g["ph"]), ("DK close", lambda g: g["r"]["dkHome"]), ("Elo", lambda g: g["r"]["elo"])):
            print(f"   {nm:9} logloss {sum(ll(f(g), g['r']['homeWin']) for g in G)/n:.4f}")
        y = [g["r"]["homeWin"] for g in G]
        b, se = irls([[1.0, lg(g["ph"]), lg(g["r"]["elo"]) - lg(g["ph"])] for g in G], y, 3)
        print(f"   outcome ~ b*logit(PM) + c*(Elo-PM): b={b[1]:+.3f}±{se[1]:.3f}  c={b[2]:+.3f}±{se[2]:.3f} (z {b[2]/se[2]:+.2f})")
        if lead != "close":
            y2 = [1 if g["r"]["dkHome"] > g["ph"] else 0 for g in G]
            bm, sem = irls([[1.0, lg(g["ph"]), lg(g["r"]["elo"]) - lg(g["ph"])] for g in G], y2, 3)
            print(f"   P(price moves up toward DK close) ~ c*(Elo-PM): c={bm[2]:+.3f}±{sem[2]:.3f} (z {bm[2]/sem[2]:+.2f})")
        for delta in (0.03, 0.05):
            rets = []
            for g in G:
                r = g["r"]
                for p, q, win in ((g["h"], r["elo"], r["homeWin"]), (g["a"], 1 - r["elo"], 1 - r["homeWin"])):
                    if 0.03 < p < 0.97 and q - p > delta: c = p + r["fee"] * p * (1 - p); rets.append((win - c) / c)
            if len(rets) >= 15:
                mu = sum(rets) / len(rets); s = (sum((v - mu) ** 2 for v in rets) / (len(rets) - 1)) ** 0.5 / math.sqrt(len(rets))
                print(f"   buy when Elo - PM > {delta:.2f}: bets {len(rets)}, avg return after fees {100*mu:+.1f}% (std err {100*s:.1f}%)")
        for lo, hi in ((0, 0.35), (0.35, 0.5), (0.5, 0.65), (0.65, 1.01)):
            B = [g for g in G if lo <= g["ph"] < hi]
            if len(B) >= 20:
                se_ = math.sqrt(sum(g["ph"] * (1 - g["ph"]) for g in B)) / len(B)
                print(f"   home price {lo:.2f}-{hi:.2f}: n={len(B)} actual {sum(g['r']['homeWin'] for g in B)/len(B):.3f} vs implied {sum(g['ph'] for g in B)/len(B):.3f} (std err {se_:.3f}), mean(close-PM) {sum(g['r']['dkHome']-g['ph'] for g in B)/len(B):+.4f}")

allrows = []
for sp in ("nhl", "nba"):
    f = f"data/sports-{sp}.json"
    if os.path.exists(f):
        rows = [r for r in json.load(open(f)) if r.get("elo") is not None]
        report(sp.upper(), rows); allrows += rows
if len({r["sport"] for r in allrows}) > 1: report("POOLED NHL+NBA", allrows)
