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

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(str) {
  let n = 0n; for (const c of str) n = n * 58n + BigInt(B58.indexOf(c));
  let h = n.toString(16); if (h.length % 2) h = '0' + h;
  let b = Buffer.from(h, 'hex');
  for (const c of str) { if (c === '1') b = Buffer.concat([Buffer.from([0]), b]); else break; }
  return b;
}
const DISC_BUY = '66063d1201daebea', DISC_BUY_EXACT_IN = 'c62e1552b4d9e870';

function pumpBuys(tx) {
  const m = tx.transaction.message;
  const keys = [...m.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const all = [...m.instructions, ...(tx.meta.innerInstructions ?? []).flatMap((i) => i.instructions)];
  const out = [];
  for (const ix of all) {
    if (keys[ix.programIdIndex] !== PROGRAM) continue;
    const d = b58(ix.data); if (d.length < 24) continue;
    const disc = d.subarray(0, 8).toString('hex');
    if (disc === DISC_BUY) out.push({ kind: 'exactOut', tokenOut: Number(d.readBigUInt64LE(8)), maxSolIn: Number(d.readBigUInt64LE(16)) });
    else if (disc === DISC_BUY_EXACT_IN) out.push({ kind: 'exactIn', solIn: Number(d.readBigUInt64LE(8)), minTokenOut: Number(d.readBigUInt64LE(16)) });
  }
  return out;
}

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

const SIG_RPC = process.env.SIG_RPC_URL ?? config.rpcUrl;
const sigs = (await rpc('getSignaturesForAddress', [PROGRAM, { limit: N }], 5, SIG_RPC)) ?? [];
const ok = sigs.filter((s) => !s.err);
console.log(`program ${PROGRAM.slice(0, 8)}…, ${sigs.length} sigs, ${ok.length} successful, RPC ${new URL(config.rpcUrl).host}`);
const txs = await pool(ok, 4, (s) => rpc('getTransaction', [s.signature, { encoding: 'json', maxSupportedTransactionVersion: 1, commitment: 'confirmed' }]));

fs.mkdirSync(config.dataDir, { recursive: true });
const out = fs.createWriteStream(`${config.dataDir}/backtest-decoded-${new Date().toISOString().slice(0, 10)}.jsonl`, { flags: 'w' });
let fetched = 0, buys = 0, sells = 0, skipped = 0, noIx = 0;
const out2 = out;
const cases = [];
const profits = [], depths = [], sizes = [], slack = [], ratios = [];
txs.forEach((tx, i) => {
  if (!tx) return; fetched++;
  const p = parseBuy(tx);
  if (!p) { skipped++; return; }
  if (p.side === 'sell') { sells++; return; }
  const dec = pumpBuys(tx);
  if (dec.length !== 1) { noIx++; return; }
  buys++;
  const v = dec[0];
  const poolState = { sol: Number(p.solPre), token: Number(p.tokPre), fee: FEE };
  const dS = Number(p.dS), dT = -Number(p.dT);
  ratios.push(v.kind === 'exactIn' ? v.solIn / dS : v.tokenOut / dT);
  depths.push(poolState.sol); sizes.push(dS);
  if (v.kind === 'exactIn') { const q = minOutFromSlippage(poolState, v.solIn, 0); slack.push(1 - v.minTokenOut / q); }
  else { const c = (poolState.sol * v.tokenOut) / ((poolState.token - v.tokenOut) * (1 - FEE)); slack.push(v.maxSolIn / c - 1); }
  if (v.kind === 'exactOut') {
    const payer = tx.transaction.message.accountKeys[0];
    const wsol = (tx.meta.preTokenBalances ?? []).filter((b) => b.owner === payer && b.mint === SOL).reduce((a, b) => a + Number(b.uiTokenAmount.amount), 0);
    v.maxSolIn = Math.min(v.maxSolIn, tx.meta.preBalances[0] + wsol);
  }
  cases.push({ sig: ok[i].signature, mint: p.mint, poolState, v, dS });
});
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const share = (a, f) => (a.length ? (100 * a.filter(f).length / a.length).toFixed(0) : 0);
console.log(`fetched ${fetched}; single-pool buys with one decodable buy ix: ${buys}; sells ${sells}; multi-hop/unparsed ${skipped}; buys not decodable/ambiguous ${noIx}`);
console.log(`decoder check, decoded amount / actual balance change: median ${med(ratios).toFixed(3)} (1.0 = exact; fees cause small gaps)`);
console.log(`median pool depth ${(med(depths) / 1e9).toFixed(1)} SOL, median victim buy ${(med(sizes) / 1e9).toFixed(4)} SOL`);
console.log(`victim slippage slack: median ${(100 * med(slack)).toFixed(1)}%; <=1%: ${share(slack, (x) => x <= 0.01)}% of buys; >=10%: ${share(slack, (x) => x >= 0.10)}%; >=50% (effectively unprotected): ${share(slack, (x) => x >= 0.5)}%`);
const CAPS = (process.env.CAPITAL_SOL_LIST ?? String(CAPITAL / 1e9)).split(',').map(Number);
for (const cap of CAPS) {
  const pr = [];
  for (const c of cases) {
    const plan = planSandwich(c.poolState, { ...c.v }, cap * 1e9, COST);
    if (plan && plan.profit >= config.minNetLamports) { pr.push(plan.profit); if (cap * 1e9 === CAPITAL) out2.write(JSON.stringify({ sig: c.sig, mint: c.mint, kind: c.v.kind, depthSol: c.poolState.sol / 1e9, victimSol: c.dS / 1e9, netLamports: plan.profit }) + '\n'); }
  }
  const sum = pr.reduce((a, b) => a + b, 0);
  console.log(`capital ${cap} SOL: ${pr.length}/${cases.length} buys clear costs; total ${(sum / 1e9).toFixed(4)} SOL (~$${(sum / 1e9 * 155).toFixed(2)}), median ${(med(pr) / 1e9).toFixed(5)} SOL, return on capital ${(100 * sum / 1e9 / cap).toFixed(2)}%`);
}
out.end();
