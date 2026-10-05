import { applySwap } from './amm.mjs';

// victim: { solIn, minTokenOut }. costLamports: fees + tip for the whole bundle.
function evaluate(pool, victim, a, costLamports) {
  const f = applySwap(pool, 'buy', a);
  const v = applySwap(f.next, 'buy', victim.solIn);
  if (v.out < victim.minTokenOut) return { feasible: false, profit: -Infinity };
  const b = applySwap(v.next, 'sell', f.out);
  return { feasible: true, profit: b.out - a - costLamports, victimOut: v.out, frontTokens: f.out, backSol: b.out };
}

export function planSandwich(pool, victim, capital, costLamports) {
  const baseline = evaluate(pool, victim, 0, 0);
  if (!baseline.feasible) return null;

  let lo = 0, hi = capital;
  if (!evaluate(pool, victim, hi, costLamports).feasible) {
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (evaluate(pool, victim, mid, costLamports).feasible) lo = mid; else hi = mid;
    }
    hi = lo;
  }
  let l = 0, r = hi;
  for (let i = 0; i < 120; i++) {
    const m1 = l + (r - l) / 3, m2 = r - (r - l) / 3;
    if (evaluate(pool, victim, m1, costLamports).profit < evaluate(pool, victim, m2, costLamports).profit) l = m1; else r = m2;
  }
  const a = (l + r) / 2;
  const e = evaluate(pool, victim, a, costLamports);
  if (!e.feasible || e.profit <= 0) return null;
  return { frontSol: a, ...e };
}

export const minOutFromSlippage = (pool, solIn, slippageBps) => {
  const { out } = applySwap(pool, 'buy', solIn);
  return out * (1 - slippageBps / 10_000);
};
