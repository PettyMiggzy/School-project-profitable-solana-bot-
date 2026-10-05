// Constant-product pool (Raydium CP, Pump.fun AMM style). Amounts are numbers in base units.
export function swapOut(reserveIn, reserveOut, amountIn, feeRate) {
  const eff = amountIn * (1 - feeRate);
  return (reserveOut * eff) / (reserveIn + eff);
}

// Returns new reserves after swapping; fee stays in the pool.
export function applySwap(pool, side, amountIn) {
  const [rin, rout] = side === 'buy' ? [pool.sol, pool.token] : [pool.token, pool.sol];
  const out = swapOut(rin, rout, amountIn, pool.fee);
  const next = side === 'buy'
    ? { ...pool, sol: pool.sol + amountIn, token: pool.token - out }
    : { ...pool, token: pool.token + amountIn, sol: pool.sol - out };
  return { out, next };
}
