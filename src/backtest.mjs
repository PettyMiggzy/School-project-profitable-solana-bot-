import fs from 'node:fs';
import { config, SOL } from './config.mjs';
import { rpc } from './rpc.mjs';
import { planSandwich, minOutFromSlippage } from './sandwich.mjs';

const PROGRAM = process.env.PROGRAM ?? 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const N = Number(process.env.N ?? 300);
const FEE = Number(process.env.POOL_FEE ?? 0.0025);
const CAPITAL = Number(process.env.CAPITAL_LAMPORTS ?? 300_000_000);
const COST = config.baseFeeLamports + config.priorityFeeLamports;
const SLIPPAGES = (process.env.SLIPPAGE_BPS_LIST ?? '100,300,1000').split(',').map(Number);

function parseBuy(tx) {
  const m = tx.meta;
  if (!m || m.err || !m.preTokenBalances || !m.postTokenBalances) return null;
  const payer = tx.transaction.message.accountKeys[0]?.pubkey ?? tx.transaction.message.accountKeys[0];
  const by = new Map();
  const add = (list, k) => { for (const b of list) { const o = by.get(b.owner) ?? {}; (o[b.mint] ??= {})[k] = BigInt(b.uiTokenAmount.amount); by.set(b.owner, o); } };
  add(m.preTokenBalances, 'pre'); add(m.postTokenBalances, 'post');
  const cands = [];
  for (const [owner, mints] of by) {
    if (owner === payer || !mints[SOL]) continue;
    const s = mints[SOL]; if (s.pre === undefined || s.post === undefined) continue;
    for (const [mint, t] of Object.entries(mints)) {
      if (mint === SOL || t.pre === undefined || t.post === undefined) continue;
      const dS = s.post - s.pre, dT = t.post - t.pre;
      if ((dS > 0n && dT < 0n) || (dS < 0n && dT > 0n)) cands.push({ owner, mint, solPre: s.pre, tokPre: t.pre, dS, dT });
    }
  }
  if (cands.length !== 1) return null;
  const c = cands[0];
  if (c.dS <= 0n) return { side: 'sell', ...c };
  return { side: 'buy', ...c };
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const sigs = (await rpc('getSignaturesForAddress', [PROGRAM, { limit: N }])) ?? [];
const ok = sigs.filter((s) => !s.err);
console.log(`program ${PROGRAM.slice(0, 8)}…, ${sigs.length} sigs, ${ok.length} successful, RPC ${new URL(config.rpcUrl).host}`);
const txs = await pool(ok, 4, (s) => rpc('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]));

fs.mkdirSync(config.dataDir, { recursive: true });
const out = fs.createWriteStream(`${config.dataDir}/backtest-${new Date().toISOString().slice(0, 10)}.jsonl`, { flags: 'a' });
let fetched = 0, buys = 0, sells = 0, skipped = 0;
const res = Object.fromEntries(SLIPPAGES.map((b) => [b, { hits: 0, total: 0, profits: [] }]));
const depths = [], sizes = [];
txs.forEach((tx, i) => {
  if (!tx) return; fetched++;
  const p = parseBuy(tx);
  if (!p) { skipped++; return; }
  if (p.side === 'sell') { sells++; return; }
  buys++;
  const poolState = { sol: Number(p.solPre), token: Number(p.tokPre), fee: FEE };
  const solIn = Number(p.dS);
  depths.push(poolState.sol); sizes.push(solIn);
  for (const bps of SLIPPAGES) {
    const victim = { solIn, minTokenOut: minOutFromSlippage(poolState, solIn, bps) };
    const plan = planSandwich(poolState, victim, CAPITAL, COST);
    res[bps].total++;
    if (plan && plan.profit >= config.minNetLamports) {
      res[bps].hits++; res[bps].profits.push(plan.profit);
      out.write(JSON.stringify({ sig: ok[i].signature, mint: p.mint, bps, depthSol: poolState.sol / 1e9, victimSol: solIn / 1e9, frontSol: plan.frontSol / 1e9, netLamports: plan.profit }) + '\n');
    }
  }
});
out.end();
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
console.log(`fetched ${fetched}, parsed single-pool: buys ${buys}, sells ${sells}, unparsed/multi-hop ${skipped}`);
console.log(`median pool depth ${(med(depths) / 1e9).toFixed(1)} SOL, median victim buy ${(med(sizes) / 1e9).toFixed(3)} SOL`);
for (const bps of SLIPPAGES) {
  const r = res[bps]; const sum = r.profits.reduce((a, b) => a + b, 0);
  console.log(`assumed victim slippage ${bps / 100}%: ${r.hits}/${r.total} buys clear costs; total ${(sum / 1e9).toFixed(4)} SOL (~$${(sum / 1e9 * 155).toFixed(2)}), median ${(med(r.profits) / 1e9).toFixed(5)} SOL`);
}
