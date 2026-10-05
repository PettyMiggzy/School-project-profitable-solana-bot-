import fs from 'node:fs';
import { config, SOL, FALLBACK_TOKENS } from './config.mjs';
import { quote, topTokens } from './jupiter.mjs';

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function scanToken(mint) {
  const buys = (await pool(config.dexes, config.maxConcurrent, async (dex) => {
    const q = await quote(SOL, mint, config.tradeLamports, dex);
    return q && q.outAmount ? { dex, out: BigInt(q.outAmount), pool: q.routePlan?.[0]?.swapInfo?.ammKey } : null;
  })).filter(Boolean);
  if (buys.length < 2) return { mint, buys: buys.length, rows: [] };

  const rows = [];
  for (const b of buys) {
    for (const s of buys) {
      if (s.dex === b.dex) continue;
      const q = await quote(mint, SOL, b.out, s.dex);
      if (!q || !q.outAmount) continue;
      const back = BigInt(q.outAmount);
      const gross = Number(back) - config.tradeLamports;
      const net = gross - config.baseFeeLamports - config.priorityFeeLamports;
      rows.push({ mint, buyDex: b.dex, sellDex: s.dex, buyPool: b.pool, sellPool: q.routePlan?.[0]?.swapInfo?.ammKey, inLamports: config.tradeLamports, backLamports: Number(back), gross, net });
    }
  }
  return { mint, buys: buys.length, rows };
}

export async function cycle(log) {
  const tokens = process.env.TOKENS ? process.env.TOKENS.split(',') : ((await topTokens(config.tokenLimit)) ?? FALLBACK_TOKENS);
  const results = [];
  for (const mint of tokens.filter((m) => m !== SOL)) results.push(await scanToken(mint));
  const rows = results.flatMap((r) => r.rows);
  for (const r of rows) log.write(JSON.stringify({ t: new Date().toISOString(), ...r }) + '\n');
  rows.sort((a, b) => b.net - a.net);
  const profitable = rows.filter((r) => r.net >= config.minNetLamports);
  console.log(`tokens=${tokens.length} usable=${results.filter((r) => r.rows.length).length} paths=${rows.length} profitable=${profitable.length}`);
  for (const r of rows.slice(0, 5)) console.log(`  best ${r.mint.slice(0, 6)} buy ${r.buyDex} -> sell ${r.sellDex} gross ${r.gross} net ${r.net} lamports`);
  return { rows, profitable };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const log = fs.createWriteStream(`${config.dataDir}/scan-${new Date().toISOString().slice(0, 10)}.jsonl`, { flags: 'a' });
  console.log(`scan: size ${config.tradeLamports / 1e9} SOL, dexes=${config.dexes.join('|')}`);
  do { await cycle(log); if (config.loopMs) await new Promise((r) => setTimeout(r, config.loopMs)); } while (config.loopMs);
  log.end();
}
