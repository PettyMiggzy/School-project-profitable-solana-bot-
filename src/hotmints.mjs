import { SOL } from './config.mjs';
import { rpc } from './rpc.mjs';

const SKIP = new Set([SOL, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB']);
const BLOCKS = Number(process.env.BLOCKS ?? 15), TOP = Number(process.env.TOP ?? 40);
const head = await rpc('getSlot', [{ commitment: 'finalized' }]);
const count = new Map();
for (let i = 0; i < BLOCKS; i++) {
  const b = await rpc('getBlock', [head - 20 - i * 25, { encoding: 'json', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 1 }]);
  if (!b) continue;
  for (const tx of b.transactions) {
    if (tx.meta?.err) continue;
    const mints = new Set((tx.meta.postTokenBalances ?? []).filter((x) => x.mint !== SOL).map((x) => x.mint));
    const hasSol = (tx.meta.postTokenBalances ?? []).some((x) => x.mint === SOL);
    if (!hasSol) continue;
    for (const m of mints) if (!SKIP.has(m)) count.set(m, (count.get(m) ?? 0) + 1);
  }
}
console.log([...count].sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([m]) => m).join(','));
