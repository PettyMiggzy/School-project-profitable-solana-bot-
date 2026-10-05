import test from 'node:test';
import assert from 'node:assert/strict';
import { takerFee, planStake, openPosition, settlePosition, equity, halted, priceStillValid, marketCapReached } from '../src/pm/core.mjs';

test('taker fee follows rate*p*(1-p)', () => assert.ok(Math.abs(takerFee(0.05, 0.5) - 0.0125) < 1e-12));

test('stake respects pct cap and shares/cost are consistent', () => {
  const p = planStake({ cash: 50, openCost: 0, ask: 0.5, rate: 0.05, minShares: 5 });
  assert.ok(p.cost <= 50 * 0.04 + 1e-9 || p.shares === 5);
  assert.ok(Math.abs(p.cost - p.shares * (0.5 + takerFee(0.05, 0.5))) < 1e-9);
});

test('never exceeds cash or exposure cap', () => {
  assert.equal(planStake({ cash: 1, openCost: 49, ask: 0.5, rate: 0.05, minShares: 5 }), null);
  assert.equal(planStake({ cash: 20, openCost: 30, ask: 0.5, rate: 0.05, minShares: 5 }), null);
});

test('settlement pays shares*win and conserves money', () => {
  const l = { start: 50, cash: 50, positions: [] };
  const pos = { shares: 10, cost: 5.1 };
  openPosition(l, pos);
  const open = l.positions[0];
  assert.ok(Math.abs(equity(l) - 50) < 1e-9);
  settlePosition(l, open, 1);
  assert.ok(Math.abs(l.cash - (50 - 5.1 + 10)) < 1e-9 && open.pnl > 0);
  const l2 = { start: 50, cash: 50, positions: [] }; openPosition(l2, { shares: 10, cost: 5.1 }); settlePosition(l2, l2.positions[0], 0);
  assert.ok(Math.abs(l2.cash - 44.9) < 1e-9);
});

test('drawdown halt triggers below limit', () => {
  assert.equal(halted({ start: 50, cash: 29, positions: [] }), true);
  assert.equal(halted({ start: 50, cash: 35, positions: [] }), false);
});

test('compounding: stake grows with equity', () => {
  const a = planStake({ cash: 50, openCost: 0, ask: 0.5, rate: 0, minShares: 1 }), b = planStake({ cash: 100, openCost: 0, ask: 0.5, rate: 0, minShares: 1 });
  assert.ok(b.cost > a.cost);
});

test('price check is symmetric: skips both up and down moves', () => {
  assert.equal(priceStillValid(0.51, 0.06, 0.03), false);
  assert.equal(priceStillValid(0.40, 0.46, 0.03), false);
  assert.equal(priceStillValid(0.50, 0.52, 0.03), true);
});

test('per-market cap blocks piling into one market', () => {
  const l = { start: 50, cash: 46, positions: [{ status: 'open', cid: 'A', cost: 4 }] };
  assert.equal(marketCapReached(l, 'A'), true);
  assert.equal(marketCapReached(l, 'B'), false);
});
