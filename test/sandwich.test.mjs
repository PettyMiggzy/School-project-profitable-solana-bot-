import test from 'node:test';
import assert from 'node:assert/strict';
import { planSandwich, minOutFromSlippage } from '../src/sandwich.mjs';
import { applySwap } from '../src/amm.mjs';

const L = 1e9;
const pool = { sol: 10_000 * L, token: 1e15, fee: 0.0025 };
const cost = 30_000;

test('no attack when victim allows zero slippage', () => {
  const victim = { solIn: 50 * L, minTokenOut: minOutFromSlippage(pool, 50 * L, 0) };
  assert.equal(planSandwich(pool, victim, 0.3 * L, cost), null);
});

test('victim always still receives at least minTokenOut', () => {
  const victim = { solIn: 200 * L, minTokenOut: minOutFromSlippage(pool, 200 * L, 100) };
  const p = planSandwich(pool, victim, 100 * L, cost);
  assert.ok(p && p.victimOut >= victim.minTokenOut - 1e-6);
});

test('front-run never exceeds capital', () => {
  const victim = { solIn: 500 * L, minTokenOut: minOutFromSlippage(pool, 500 * L, 500) };
  const p = planSandwich(pool, victim, 0.3 * L, cost);
  assert.ok(p.frontSol <= 0.3 * L + 1);
});

test('optimizer matches brute-force grid', () => {
  const victim = { solIn: 300 * L, minTokenOut: minOutFromSlippage(pool, 300 * L, 200) };
  const cap = 80 * L;
  const p = planSandwich(pool, victim, cap, cost);
  let best = -Infinity;
  for (let i = 1; i <= 4000; i++) {
    const a = (cap * i) / 4000;
    const f = applySwap(pool, 'buy', a), v = applySwap(f.next, 'buy', victim.solIn);
    if (v.out < victim.minTokenOut) break;
    best = Math.max(best, applySwap(v.next, 'sell', f.out).out - a - cost);
  }
  assert.ok(p.profit >= best - 1 && p.profit <= best * 1.001 + 1000);
});

test('profit is negative-or-null when costs exceed edge', () => {
  const victim = { solIn: 5 * L, minTokenOut: minOutFromSlippage(pool, 5 * L, 50) };
  assert.equal(planSandwich(pool, victim, 0.3 * L, 10 * L), null);
});

test('exactOut victim: max-in limit is honored and zero slack blocks attack', () => {
  const tokenOut = 5e12;
  const cost0 = (pool.sol * tokenOut) / ((pool.token - tokenOut) * (1 - pool.fee));
  assert.equal(planSandwich(pool, { kind: 'exactOut', tokenOut, maxSolIn: cost0 }, 0.3 * L, cost), null);
  const p = planSandwich(pool, { kind: 'exactOut', tokenOut, maxSolIn: cost0 * 1.5 }, 100 * L, cost);
  assert.ok(p && p.backSol > 0);
});
