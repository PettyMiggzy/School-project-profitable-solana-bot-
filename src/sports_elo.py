import json, math, urllib.request, gzip, sys, os, time

ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
def get(u):
    for i in range(4):
        try:
            req = urllib.request.Request(u, headers={"Accept-Encoding": "gzip"})
            raw = urllib.request.urlopen(req, timeout=30).read()
            try: raw = gzip.decompress(raw)
            except Exception: pass
            return json.loads(raw)
        except Exception: time.sleep(1 + i)
    return None

cache = "data/nfl-results.json"
if os.path.exists(cache): games = json.load(open(cache))
else:
    games = {}
    for year in range(2019, 2027):
        for st, weeks in ((2, 18), (3, 5)):
            for w in range(1, weeks + 1):
                d = get(f"{ESPN}?dates={year}&seasontype={st}&week={w}")
                for e in (d or {}).get("events", []):
                    if e["status"]["type"]["name"] != "STATUS_FINAL": continue
                    c = e["competitions"][0]
                    h = next(t for t in c["competitors"] if t["homeAway"] == "home"); a = next(t for t in c["competitors"] if t["homeAway"] == "away")
                    games[e["id"]] = dict(id=e["id"], date=e["date"], home=h["team"]["abbreviation"], away=a["team"]["abbreviation"], hs=int(h["score"]), as_=int(a["score"]), neutral=bool(c.get("neutralSite")), year=year)
    json.dump(games, open(cache, "w"))
gl = sorted(games.values(), key=lambda g: g["date"])
print("games", len(gl), "seasons", sorted({g['year'] for g in gl}))

K, HFA = 20.0, 48.0
elo, last_year, pre = {}, {}, {}
for g in gl:
    for t in (g["home"], g["away"]):
        if last_year.get(t) is not None and last_year[t] != g["year"]: elo[t] = 1505 + 0.67 * (elo.get(t, 1505) - 1505)
        last_year[t] = g["year"]
    eh, ea = elo.get(g["home"], 1505), elo.get(g["away"], 1505)
    diff = eh - ea + (0 if g["neutral"] else HFA)
    p = 1 / (1 + 10 ** (-diff / 400)); pre[g["id"]] = (p, diff)
    margin = g["hs"] - g["as_"]; res = 1.0 if margin > 0 else 0.0 if margin < 0 else 0.5
    mult = math.log(abs(margin) + 1) * (2.2 / ((diff if res == 1 else -diff) * 0.001 + 2.2)) if margin else 1
    delta = K * mult * (res - p)
    elo[g["home"]] = eh + delta; elo[g["away"]] = ea - delta

rows = json.load(open("data/sports-nfl.json")); rows = [r for r in rows if r["id"] in pre]
n = len(rows); print("evaluation games with DK + PM + Elo:", n)
def ll(p, y): p = min(max(p, 1e-4), 1 - 1e-4); return -(y * math.log(p) + (1 - y) * math.log(1 - p))
for name, f in (("DraftKings", lambda r: r["dkHome"]), ("Elo only", lambda r: pre[r["id"]][0]), ("coin flip", lambda r: 0.5)):
    print(f"{name:11} logloss {sum(ll(f(r), r['homeWin']) for r in rows)/n:.4f}  brier {sum((f(r)-r['homeWin'])**2 for r in rows)/n:.4f}  acc {sum((f(r)>0.5)==bool(r['homeWin']) for r in rows)/n:.3f}")

def logit(p): p = min(max(p, 1e-4), 1 - 1e-4); return math.log(p / (1 - p))
X = [[1.0, logit(r["dkHome"]), logit(pre[r["id"]][0]) - logit(r["dkHome"])] for r in rows]; y = [r["homeWin"] for r in rows]
b = [0.0, 1.0, 0.0]
for _ in range(50):
    g = [0.0] * 3; H = [[0.0] * 3 for _ in range(3)]
    for xi, yi in zip(X, y):
        p = 1 / (1 + math.exp(-sum(bi * xj for bi, xj in zip(b, xi)))); w = p * (1 - p)
        for i in range(3):
            g[i] += (yi - p) * xi[i]
            for j in range(3): H[i][j] += w * xi[i] * xi[j]
    # solve H d = g (3x3 gauss)
    M = [H[i][:] + [g[i]] for i in range(3)]
    for i in range(3):
        piv = max(range(i, 3), key=lambda r: abs(M[r][i])); M[i], M[piv] = M[piv], M[i]
        for r in range(3):
            if r != i:
                f = M[r][i] / M[i][i]; M[r] = [a - f * c for a, c in zip(M[r], M[i])]
    d = [M[i][3] / M[i][i] for i in range(3)]; b = [bi + di for bi, di in zip(b, d)]
    if max(abs(x) for x in d) < 1e-9: break
# covariance = inverse of H
def inv3(H):
    M = [H[i][:] + [1.0 if i == j else 0.0 for j in range(3)] for i in range(3)]
    for i in range(3):
        piv = max(range(i, 3), key=lambda r: abs(M[r][i])); M[i], M[piv] = M[piv], M[i]
        M[i] = [a / M[i][i] for a in M[i]]
        for r in range(3):
            if r != i: f = M[r][i]; M[r] = [a - f * c for a, c in zip(M[r], M[i])]
    return [row[3:] for row in M]
C = inv3(H); se = [math.sqrt(C[i][i]) for i in range(3)]
print("logistic fit: outcome ~ a + b*logit(DK) + c*(logit(Elo)-logit(DK))")
for nme, bi, si in zip(("a (intercept)", "b (weight on DK)", "c (extra weight on Elo-minus-DK)"), b, se): print(f"  {nme:34} {bi:+.3f}  (std err {si:.3f}, z {bi/si:+.2f})")
print("  interpretation: c near 0 => Elo adds no information beyond DK; b near 1 => DK well calibrated")
