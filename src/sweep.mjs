import { planSandwich, minOutFromSlippage } from './sandwich.mjs';

const L = 1e9, USD_PER_SOL = 155;
const capital = Number(process.env.CAPITAL_SOL ?? 0.3) * L;
const cost = Number(process.env.COST_LAMPORTS ?? 30_000);
console.log(`capital ${capital / L} SOL (~$${(capital / L * USD_PER_SOL).toFixed(0)}), cost ${cost} lamports per bundle, SOL=$${USD_PER_SOL} (assumed)`);
console.log('pool SOL depth | victim SOL | slippage | front SOL | net profit (SOL) | net $');
for (const depth of [200, 2_000, 20_000]) {
  const pool = { sol: depth * L, token: 1e15, fee: 0.0025 };
  for (const victimSol of [1, 10, 50]) {
    for (const bps of [100, 500, 1500]) {
      const victim = { solIn: victimSol * L, minTokenOut: minOutFromSlippage(pool, victimSol * L, bps) };
      const p = planSandwich(pool, victim, capital, cost);
      console.log(`${String(depth).padStart(8)} | ${String(victimSol).padStart(8)} | ${String(bps / 100 + '%').padStart(6)} | ${p ? (p.frontSol / L).toFixed(3).padStart(8) : '    none'} | ${p ? (p.profit / L).toFixed(5).padStart(14) : '          none'} | ${p ? (p.profit / L * USD_PER_SOL).toFixed(3) : '-'}`);
    }
  }
}
