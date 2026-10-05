export const takerFee = (rate, p) => rate * p * (1 - p);

export function planStake({ cash, openCost, ask, rate, minShares, stakePct = 0.04, maxExposurePct = 0.6 }) {
  const equity = cash + openCost;
  const perShare = ask + takerFee(rate, ask);
  const cap = Math.min(equity * stakePct, cash, equity * maxExposurePct - openCost);
  if (cap <= 0) return null;
  let shares = cap / perShare;
  if (shares < minShares) {
    const minCost = minShares * perShare;
    if (minCost > cash || minCost > equity * maxExposurePct - openCost || minCost > equity * stakePct * 2.5) return null;
    shares = minShares;
  }
  return { shares, cost: shares * perShare };
}

export function openPosition(ledger, pos) {
  if (pos.cost > ledger.cash + 1e-9) throw new Error('insufficient cash');
  ledger.cash -= pos.cost;
  ledger.positions.push({ ...pos, status: 'open' });
}

export function settlePosition(ledger, pos, win) {
  const payout = pos.shares * win;
  ledger.cash += payout;
  pos.status = 'settled'; pos.win = win; pos.payout = payout; pos.pnl = payout - pos.cost;
}

export const equity = (ledger) => ledger.cash + ledger.positions.filter((p) => p.status === 'open').reduce((s, p) => s + p.cost, 0);

export function halted(ledger, maxDrawdown = 0.4) {
  return equity(ledger) < ledger.start * (1 - maxDrawdown);
}

export const priceStillValid = (theirPrice, ask, maxSlip) => Math.abs(ask - theirPrice) <= maxSlip;

export function marketCapReached(ledger, cid, maxMarketPct = 0.08) {
  const open = ledger.positions.filter((p) => p.status === 'open');
  const inMarket = open.filter((p) => p.cid === cid).reduce((s, p) => s + p.cost, 0);
  return inMarket >= equity(ledger) * maxMarketPct;
}
