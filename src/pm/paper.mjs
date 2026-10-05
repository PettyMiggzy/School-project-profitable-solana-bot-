import fs from 'node:fs';
import { takerFee, planStake, openPosition, settlePosition, equity, halted, priceStillValid, marketCapReached } from './core.mjs';

const API = 'https://data-api.polymarket.com', GAMMA = 'https://gamma-api.polymarket.com', CLOB = 'https://clob.polymarket.com';
const START = Number(process.env.START_USD ?? 50), POLL = Number(process.env.POLL_SECONDS ?? 20), RUN = Number(process.env.RUN_SECONDS ?? 0);
const MAX_SLIP = Number(process.env.MAX_SLIP ?? 0.03), MIN_P = Number(process.env.MIN_PRICE ?? 0.05), MAX_P = Number(process.env.MAX_PRICE ?? 0.95);
const REPLAY = Number(process.env.REPLAY_SECONDS ?? 0);
const FILE = process.env.LEDGER ?? 'data/paper/ledger.json';
const WALLETS = (process.env.WALLETS ?? '0x924379a79c64b77ad5816ad362122a5f6228658e,0x1f3a646ce5cbe2c70270e7a46161d89b7c7b895d').split(',');
if (process.env.LIVE === '1') throw new Error('LIVE trading is not implemented: this bot is paper-only');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (r.status === 429 || r.status >= 500) { await sleep(500 * 2 ** i); continue; } return r.ok ? r.json() : null; } catch { await sleep(500); }
  }
  return null;
}

fs.mkdirSync('data/paper', { recursive: true });
const ledger = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { start: START, cash: START, positions: [], seen: {}, skipped: {}, log: [] };
const save = () => fs.writeFileSync(FILE, JSON.stringify(ledger, null, 1));
const note = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); ledger.log.push(l); if (ledger.log.length > 500) ledger.log.shift(); };
const skip = (why) => { ledger.skipped[why] = (ledger.skipped[why] ?? 0) + 1; };

async function marketInfo(cid) {
  const m = (await get(`${GAMMA}/markets?condition_ids=${cid}`))?.[0] ?? (await get(`${GAMMA}/markets?condition_ids=${cid}&closed=true`))?.[0];
  return m ? { rate: m.feesEnabled ? (m.feeSchedule?.rate ?? 0.05) : 0, minShares: Number(m.orderMinSize ?? 5), closed: !!m.closed, active: m.active, accepting: m.acceptingOrders, prices: m.outcomePrices, toks: m.clobTokenIds, q: m.question } : null;
}

async function bestAsk(token) {
  const b = await get(`${CLOB}/book?token_id=${token}`);
  const asks = (b?.asks ?? []).map((a) => ({ p: Number(a.price), s: Number(a.size) })).sort((x, y) => x.p - y.p);
  return asks[0] ?? null;
}

async function settleAll() {
  for (const pos of ledger.positions.filter((p) => p.status === 'open')) {
    const m = await marketInfo(pos.cid);
    if (!m?.closed) continue;
    try {
      const prices = JSON.parse(m.prices).map(Number), toks = JSON.parse(m.toks), i = toks.indexOf(pos.asset);
      if (i >= 0 && ((prices[0] === 1 && prices[1] === 0) || (prices[0] === 0 && prices[1] === 1))) { settlePosition(ledger, pos, prices[i]); note(`SETTLED ${pos.q} ${pos.outcome}: pnl ${pos.pnl.toFixed(2)}, cash ${ledger.cash.toFixed(2)}`); }
    } catch {}
  }
}

async function poll(wallet) {
  const trades = (await get(`${API}/trades?user=${wallet}&limit=30`)) ?? [];
  const first = ledger.seen[wallet] === undefined && !REPLAY;
  const lastTs = ledger.seen[wallet] ?? Math.floor(Date.now() / 1000) - REPLAY;
  let maxTs = lastTs;
  for (const t of trades.sort((a, b) => a.timestamp - b.timestamp)) {
    maxTs = Math.max(maxTs, t.timestamp);
    if (first || t.timestamp <= lastTs || t.side !== 'BUY') continue;
    if (halted(ledger)) { skip('halted by drawdown limit'); continue; }
    if (t.price < MIN_P || t.price > MAX_P) { skip('price outside range'); continue; }
    const m = await marketInfo(t.conditionId);
    if (!m || m.closed || !m.accepting) { skip('market closed/not accepting'); continue; }
    const ask = await bestAsk(t.asset);
    if (!ask) { skip('no ask'); continue; }
    if (!priceStillValid(t.price, ask.p, MAX_SLIP)) { skip('price moved away'); continue; }
    if (marketCapReached(ledger, t.conditionId)) { skip('per-market cap'); continue; }
    const openCost = ledger.positions.filter((p) => p.status === 'open').reduce((s, p) => s + p.cost, 0);
    const plan = planStake({ cash: ledger.cash, openCost, ask: ask.p, rate: m.rate, minShares: m.minShares });
    if (!plan) { skip('size/exposure limits'); continue; }
    if (plan.shares > ask.s) { skip('ask depth too thin'); continue; }
    openPosition(ledger, { wallet, cid: t.conditionId, asset: t.asset, q: m.q, outcome: t.outcome, theirPrice: t.price, entry: ask.p, fee: takerFee(m.rate, ask.p), shares: plan.shares, cost: plan.cost, ts: new Date().toISOString() });
    note(`PAPER BUY ${m.q} [${t.outcome}] ${plan.shares.toFixed(1)} sh @ ${ask.p} (they paid ${t.price}) cost $${plan.cost.toFixed(2)}`);
  }
  ledger.seen[wallet] = maxTs;
}

const t0 = Date.now();
note(`start: ${WALLETS.length} wallets, bankroll $${ledger.cash.toFixed(2)} (start $${ledger.start}), paper only`);
do {
  try { await settleAll(); for (const w of WALLETS) await poll(w); } catch (e) { note(`error ${e.message}`); }
  save();
  if (RUN && (Date.now() - t0) / 1000 >= RUN) break;
  await sleep(POLL * 1000);
} while (true);
note(`end: equity $${equity(ledger).toFixed(2)}, open ${ledger.positions.filter((p) => p.status === 'open').length}, skipped ${JSON.stringify(ledger.skipped)}`);
save();
