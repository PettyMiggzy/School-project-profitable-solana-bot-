import json, math, importlib.util, sys

# reuse the Elo pre-game probabilities from sports_elo.py without re-running its report
src = open("src/sports_elo.py").read().split("rows = json.load")[0]
ns = {}; exec(compile(src, "sports_elo_head", "exec"), ns); pre = ns["pre"]

rows = [r for r in json.load(open("data/sports-nfl.json")) if r["id"] in pre and r.get("early")]
print("games with Elo + DK + early data:", len(rows))
def lg(p): p = min(max(p, 1e-4), 1 - 1e-4); return math.log(p / (1 - p))
def ll(p, y): p = min(max(p, 1e-4), 1 - 1e-4); return -(y * math.log(p) + (1 - y) * math.log(1 - p))
def sig(z): return 1 / (1 + math.exp(-z))

def irls(X, y, k):
    b = [0.0] * k; H = None
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
    C = [row[k:2 * k] for row in M]
    return b, [math.sqrt(max(C[i][i], 0)) for i in range(k)]

for lead in ("6d", "3d", "1d", "6h"):
    G = []
    for r in rows:
        e = r["early"].get(lead) or {}
        if e.get("h") is None or e.get("a") is None or e["h"] + e["a"] <= 0: continue
        ph = e["h"] / (e["h"] + e["a"])
        G.append(dict(r=r, ph=ph, pa=e["a"], pha=e["h"], elo=pre[r["id"]][0]))
    n = len(G)
    if n < 30: print(f"\n[{lead}] only {n} games, skipped"); continue
    absd = sum(abs(g["ph"] - g["r"]["dkHome"]) for g in G) / n; signed = sum(g["ph"] - g["r"]["dkHome"] for g in G) / n
    print(f"\n=== {lead} before kickoff: n={n} | early PM vs DK close: mean abs diff {absd:.4f}, mean signed {signed:+.4f}")
    for nm, f in (("early PM", lambda g: g["ph"]), ("DK close", lambda g: g["r"]["dkHome"]), ("Elo", lambda g: g["elo"])):
        print(f"   {nm:9} logloss {sum(ll(f(g), g['r']['homeWin']) for g in G)/n:.4f}  brier {sum((f(g)-g['r']['homeWin'])**2 for g in G)/n:.4f}")
    X = [[1.0, lg(g["ph"]), lg(g["elo"]) - lg(g["ph"])] for g in G]; y = [g["r"]["homeWin"] for g in G]
    b, se = irls(X, y, 3)
    print(f"   outcome ~ a + b*logit(early PM) + c*(logit(Elo)-logit(early PM)): b={b[1]:+.3f}±{se[1]:.3f}  c={b[2]:+.3f}±{se[2]:.3f} (z {b[2]/se[2]:+.2f})")
    X2 = [[1.0, lg(g["ph"]), lg(g["elo"]) - lg(g["ph"])] for g in G]; y2 = [1 if g["r"]["dkHome"] > g["ph"] else 0 for g in G]
    bm, sem = irls(X2, y2, 3)
    print(f"   P(price rises toward DK close) ~ ... + c*(Elo-early): c={bm[2]:+.3f}±{sem[2]:.3f} (z {bm[2]/sem[2]:+.2f})")
    for delta in (0.03, 0.05, 0.08):
        rets = []
        for g in G:
            r = g["r"]
            for side, p, q, win in (("H", g["pha"], g["elo"], r["homeWin"]), ("A", g["pa"], 1 - g["elo"], 1 - r["homeWin"])):
                if 0.03 < p < 0.97 and q - p > delta:
                    c = p + r["fee"] * p * (1 - p); rets.append((win - c) / c)
        if len(rets) >= 8:
            mu = sum(rets) / len(rets); se_ = (sum((v - mu) ** 2 for v in rets) / (len(rets) - 1)) ** 0.5 / math.sqrt(len(rets))
            print(f"   buy when Elo - early PM > {delta:.2f}: bets {len(rets)}, avg return after fees {100*mu:+.1f}% (std err {100*se_:.1f}%)")
    for lo, hi in ((0, 0.35), (0.35, 0.5), (0.5, 0.65), (0.65, 1.01)):
        B = [g for g in G if lo <= g["ph"] < hi]
        if len(B) >= 10: print(f"   early home price {lo:.2f}-{hi:.2f}: n={len(B)} mean(close - early) {sum(g['r']['dkHome'] - g['ph'] for g in B)/len(B):+.4f}, actual home win {sum(g['r']['homeWin'] for g in B)/len(B):.3f} vs early implied {sum(g['ph'] for g in B)/len(B):.3f}")
