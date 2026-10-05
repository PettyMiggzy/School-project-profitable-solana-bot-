import fs from 'node:fs';
import { config, SOL } from './config.mjs';
import { rpc } from './rpc.mjs';

const TIPS = new Set(['96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5', 'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe', 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY', 'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49', 'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh', 'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt', 'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL', '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT']);
const SLOTS = Number(process.env.SLOTS ?? 12), STEP = Number(process.env.SLOT_STEP ?? 40);

function legs(tx) {
  const m = tx.meta; if (!m || m.err || !m.preTokenBalances) return [];
  const keys = [...tx.transaction.message.accountKeys, ...(m.loadedAddresses?.writable ?? []), ...(m.loadedAddresses?.readonly ?? [])];
  const signer = keys[0];
  let tip = 0; keys.forEach((k, i) => { if (TIPS.has(k)) tip += Math.max(0, m.postBalances[i] - m.preBalances[i]); });
  let wsolS = 0n;
  for (const b of m.postTokenBalances) if (b.owner === signer && b.mint === SOL) wsolS += BigInt(b.uiTokenAmount.amount);
  for (const b of m.preTokenBalances) if (b.owner === signer && b.mint === SOL) wsolS -= BigInt(b.uiTokenAmount.amount);
  const sNet = m.postBalances[0] - m.preBalances[0] + Number(wsolS);
  const by = new Map();
  const add = (l, f) => { for (const b of l) { const o = by.get(b.owner) ?? {}; (o[b.mint] ??= {})[f] = BigInt(b.uiTokenAmount.amount); by.set(b.owner, o); } };
  add(m.preTokenBalances, 'pre'); add(m.postTokenBalances, 'post');
  const out = [];
  for (const [owner, mints] of by) {
    const s = mints[SOL]; if (owner === signer || !s || s.pre === undefined || s.post === undefined) continue;
    for (const [mint, t] of Object.entries(mints)) {
      if (mint === SOL || t.pre === undefined || t.post === undefined) continue;
      const dS = s.post - s.pre, dT = t.post - t.pre;
      if ((dS > 0n && dT < 0n) || (dS < 0n && dT > 0n)) out.push({ pool: owner, mint, signer, buy: dS > 0n, sol: Number(dS), tip, sNet, sig: tx.transaction.signatures[0] });
    }
  }
  return out;
}

const head = await rpc('getSlot', [{ commitment: 'finalized' }]);
const found = []; let txCount = 0, swapLegs = 0, blocks = 0;
for (let i = 0; i < SLOTS; i++) {
  const slot = head - 20 - i * STEP;
  const b = await rpc('getBlock', [slot, { encoding: 'json', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 1 }]);
  if (!b) continue; blocks++; txCount += b.transactions.length;
  const seq = b.transactions.flatMap((tx, idx) => legs(tx).map((l) => ({ ...l, idx })));
  swapLegs += seq.length;
  const byPool = new Map();
  for (const l of seq) { const k = l.pool + l.mint; (byPool.get(k) ?? byPool.set(k, []).get(k)).push(l); }
  for (const arr of byPool.values()) {
    for (let a = 0; a < arr.length; a++) {
      if (!arr[a].buy) continue;
      for (let c = a + 1; c < arr.length; c++) {
        if (arr[c].signer !== arr[a].signer || arr[c].buy) continue;
        const victims = arr.slice(a + 1, c).filter((x) => x.signer !== arr[a].signer && x.buy);
        if (!victims.length) continue;
        const gross = -arr[c].sol - arr[a].sol, tip = arr[a].tip + arr[c].tip, signerNet = arr[a].sNet + arr[c].sNet;
        found.push({ slot, bot: arr[a].signer, pool: arr[a].pool, mint: arr[a].mint, frontSol: arr[a].sol, victims: victims.length, victimSol: victims.reduce((s, v) => s + v.sol, 0), gross, tip, signerNet, net: gross - tip - 10_000, sigs: [arr[a].sig, victims[0].sig, arr[c].sig] });
        break;
      }
    }
  }
}
const verified = found.filter((f) => f.signerNet > 0);
console.log(`blocks ${blocks}/${SLOTS}, txs ${txCount}, swap legs seen ${swapLegs}, pattern matches ${found.length}, VERIFIED profitable for the bot's own balance: ${verified.length}`);
for (const f of verified.slice(0, 10)) console.log(`  verified: slot ${f.slot} bot ${f.bot.slice(0, 8)} signerNet ${(f.signerNet / 1e9).toFixed(5)} SOL tip ${(f.tip / 1e9).toFixed(5)} victims ${f.victims}`);
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
if (found.length) {
  console.log(`gross median ${(med(found.map((f) => f.gross)) / 1e9).toFixed(5)} SOL, tip median ${(med(found.map((f) => f.tip)) / 1e9).toFixed(5)} SOL, net median ${(med(found.map((f) => f.net)) / 1e9).toFixed(5)} SOL, profitable ${found.filter((f) => f.net > 0).length}/${found.length}`);
  const bots = new Map(); for (const f of found) bots.set(f.bot, (bots.get(f.bot) ?? 0) + 1);
  console.log('distinct bot signers', bots.size, [...bots].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k.slice(0, 8)}x${v}`).join(' '));
}
fs.mkdirSync(config.dataDir, { recursive: true });
fs.writeFileSync(`${config.dataDir}/detect-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(found, null, 1));
