# Solana MEV/Arb Bot Reverse Engineering - Running Research Log

Course: Purdue online AI micro-credential (Machine 2). Assignment: pick a profitable bot on any chain, reverse engineer it, run it on the instructor's Solana fork on test day.
Log started: 2026-10-05. Entries are append-only. Every claim lists its source. "UNVERIFIED" means I have not confirmed it on-chain.

## Status
- [x] Phase 0: landscape search
- [ ] Phase 1: pick top 2 arb candidates and verify on-chain (Solscan / Jito explorer / Dune)
- [ ] Phase 2: decode transactions, extract strategy
- [ ] Phase 3: scaffold own bot
- [ ] Phase 4: fork test

## Entry 1 - Landscape (2026-10-05)

Market context (secondary sources, not independently verified):
- Jito detected 90,445,905 successful arbitrage txs in one year, $142.8M total profit, avg $1.58 per arb, largest single arb $3.7M, 88.7% SOL-denominated. Source: [Helius MEV report](https://www.helius.dev/blog/solana-mev-report)
- Jito processed 3B+ bundles, 3.75M SOL in tips over the year. Same source.
- Jito data excludes private mempools (e.g. DeezMempool), so true searcher profit is undercounted. Same source.
- Arb bots reportedly tip 50-60% of expected profit to win bundles. Source: [RPCFast setup guide](https://rpcfast.com/blog/solana-arbitrage-bot-setup)
- Claim that bot logic is commoditized and edge = data latency + bundle landing rate. Source: RPCFast, Dysnix ([blog](https://dysnix.com/blog/solana-mev-infrastructure)). Matters for fork test: latency edge disappears on a fork, so strategy logic quality is what gets graded.

## Entry 2 - Candidate A: EigenPhi triangular arb searcher (case study)

Source: [EigenPhi, "Solana's Triangular Arbitrage Explored: A Case Study on Jito"](https://eigenphi.substack.com/p/solanas-triangular-arbitrage-explored)
- Searcher: `D7K7GCCY76z15Za4hkRBPw7hwKfQXqKSobQFeaiL2Zu`
- Bot contract: `GzxwDvhbNcKTt4LBez3k9CuKZfuq5N3mZKYkBTKn1nKX`
- Example trade: 187.48 SOL -> 17,533.99 USDC -> 905,000,000 Bonk -> 1,382.26 SOL. Venues: Orca, Raydium, Whirlpool.
- Gross 1,194.78 SOL, Jito tip 1,099.19 SOL (92% of gross), net 95.59 SOL.
- Caveat: this is ONE trade from an older article, not a profitability ranking. Does not show the bot is top-2 by profit. UNVERIFIED as a current top earner. Need on-chain check of wallet history.
- Useful for report: shows the tip-to-profit ratio problem and the 3-leg cyclic structure.

## Entry 3 - Candidate B (lead): "Reverse Engineering a 4,500 SOL/m Solana Arbitrage Bot"

- Notion write-up: https://clumsy-geranium-e59.notion.site/Reverse-Engineering-a-4-500-Sol-m-Solana-Arbitrage-Bot-2aa6e851c31e802296f0f43621bad30b
- Search snippet claims: atomic arbitrage across four DEXs, about $700k/month. Title says 4,500 SOL/month. CORRECTION (Entry 10): the two figures are consistent (4,500 SOL x ~$155 = ~$700k).
- Initial fetch failed (Notion is JS-rendered). RESOLVED in Entry 10 via Notion's public page API. Action: user should open the link in a browser and paste the text or addresses into this log, or I retry with a headless browser (Playwright/Chromium is available in this container).

## Entry 4 - Excluded / noted

- Vpe sandwich program `vpeNALD89BZ4KxNUFjdLmFXBCwtyqBDQ85ouNoax38b`: roughly half of Solana sandwich attacks, ~1.55M sandwiches and $13.43M profit over 30 days (Dec 7 - Jan 5), 88.9% success. Source: Helius report above. This is a sandwich bot, not arbitrage. Recommend NOT choosing it: sandwiching works by harming other users' trades, and the assignment says arb. Keep it only as a contrast case in the report.
- Open-source "Solana-Arbitrage-Bot" GitHub repos (ChangeYourself0613, keidev-sol, mateosoul) are tutorial/marketing-style repos with no verified profit. Not valid targets. Several such repos are known vectors for wallet-draining malware, so do not run them with a real private key.

## Entry 5 - Candidate C: "2Fast" searcher (one-off event, weak target)

Source: [Jito blog, "MEV wif me"](https://jito.wtf/blog/mev-wif-me), also reported by [The Block](https://www.theblock.co/post/272079/zepd.design)
- Searcher wallet: `2Fast1RAxFtcXipCucpJhFQACiksuySKa8E9S9ckwVYY`
- Bundle: `7d2f02a0542fd3950d90c9bd8ca84d233e28f0298d9f002c7e3cc0959b72b24f`, validator Figment `CcaHc2L43ZWjwCHART3oZoJvHLAe9hzT2DJNUpBzoTN1`
- Event: a trader (`5qYuZ9ZLShLB1MuV83xHRcTgVA9A5pUajnQUUcPbk3bf`) swapped 86,739.1 SOL (~$8.6M) for 17,225,407 WIF in an illiquid pool, moving price from ~$0.14 to ~$3.99. 2Fast back-ran it atomically in the same block.
- Profit about $1.9M, tip 890.42 SOL (~$89k, only ~5% of profit, unlike Candidate A's 92%).
- Assessment: a single rare event-driven backrun, not a repeatable arb strategy. Big headline number, poor reverse engineering target because there is no steady strategy to copy. Good as a report anecdote about tip economics and illiquid-pool dislocations.

## Entry 6 - Concentration stat

- EigenPhi snippet: at one point the best Solana arb bot made $1,905,176.70 in 30 minutes, and the top 10 bots took 65% of arb profit; in other periods only ~$300k of arb profit was made in a whole week. Source: search snippet from EigenPhi/HackMD ([hackmd.io/@Extropy/ArbAnalysis](https://hackmd.io/@Extropy/ArbAnalysis)). The $1,905,176 figure closely matches the 2Fast event, so it is likely the same event, not an independent data point. UNVERIFIED, I did not read the HackMD page.

## Honest assessment so far (end of Entry 6)

I have NOT found a verified, ranked top-2 list of arb bots. Public sources give: one 2024 triangular-arb case study (A), one lead whose write-up I cannot read (B), one windfall event (C), and one sandwich bot (excluded). Profit rankings of searcher wallets live in on-chain data (Jito explorer, Dune, Solscan), which is where Phase 1 has to go. Recommended top 2 for now:
1. Candidate B (the 4-DEX atomic arb), pending retrieval of its write-up. It is the only one described as a sustained, repeatable arb with a reverse-engineering write-up already behind it.
2. Candidate A (`D7K7...`/`GzxwDv...`), pending on-chain check that the wallet is a sustained earner and not a one-off.

## Open questions
1. Which two wallets are actually top by arb profit? No public ranked list found yet. Next: Dune Jito dashboards, Jito bundle explorer, EigenPhi Solana leaderboard.
2. Retrieve Notion write-up contents (Entry 3).
3. Confirm test-day rules with instructor: starting capital, which DEXs are forked, whether Jito is available on the fork (likely not, which changes the tip logic).

## Entry 7 - User-supplied targets (2026-10-05), on-chain check

User handoff named two programs as the "top bots" (42% and 11.2% share; $1.6B and $433M 30-day trade volume). The handoff gave no source for the share/volume figures, so they are UNVERIFIED. It also describes both as SANDWICH bots, a change from the arb focus above.
- `E6YoRP3adE5XYneSseLee15wJshDxCsmyD2WtLvAmfLi`: mainnet getAccountInfo (slot 453587491) shows executable=true, owner BPFLoaderUpgradeab1e..., space 36. It is an upgradeable PROGRAM (the 36-byte account is the program pointer; bytecode is in the ProgramData account).
- `89Ny6a4mALkQgEVN8UbKSc9TdLi6t9rFYdtihrXZEpq6`: same, executable=true, upgradeable program.
- Implication: these are bot on-chain programs, not searcher wallets. Strategy has to be inferred from (a) transactions that invoke them and (b) the program bytecode. Identity of the operators and whether they sandwich is still UNVERIFIED.
- Scope decision: sandwiching on a local fork against classmates' bots is a simulation, fine for the assignment. A mainnet submission path will not be built, because on mainnet a sandwich profits from real users' losses.
- Technical correction to handoff: Solana has no public mempool. "Mempool listener" is not possible; detection comes from Jito/validator private orderflow, shred/gRPC streams, or on a fork, from the transactions the instructor's harness submits. Jito may not exist on the fork.

## Entry 8 - Test-day constraints (from user, relaying instructor)
- Starting capital: $50 USD.
- DEXs: same as Solana mainnet (instructor sets up for mainnet, then forks).
- Chain ID / RPC details: given on test day only. Bot must be config-driven (RPC URL, chain id, keys via env), nothing hardcoded.
- Implications: $50 capital caps any strategy to cents-to-dollars per trade, so fee/rent/priority-fee overhead dominates; latency edge is absent on a fork; the graded quality is likely correct execution and net-positive P&L, not raw speed.

## Entry 9 - Activity check of the two user-supplied programs (2026-10-05 13:06 UTC)
Method: mainnet getSignaturesForAddress, limit 1000, via api.mainnet-beta.solana.com.
| Program | Txs returned | Successful | Newest | Oldest |
|---|---|---|---|---|
| `E6YoRP3a...AmfLi` ("Bot #1") | 1000 | 953 | 2026-07-28 | 2025-12-17 |
| `89Ny6a4m...Epq6` ("Bot #2") | 1000 | 412 | 2025-09-24 | 2025-03-13 |

Findings:
- NEITHER program has any activity in the last 30 days. Bot #1 was last invoked ~10 weeks ago, Bot #2 over a year ago. The handoff's "30-day volume / actively profitable / market share" claims are contradicted by chain data.
- Bot #1 averaged only ~5 txs/day over Dec 2025-Jul 2026, far below what $1.6B/30d implies.
- Bot #2 had a 41% success rate, consistent with a spam-and-fail bot or an abandoned one.
- Bot #1's five newest txs all failed with ProgramFailedToComplete, so it may have died or broken in July 2026.
- Conclusion: these are poor targets for "profitable, currently active bot". Source of the handoff figures is unknown. Recommend not using them as the report's primary subjects unless profit can be shown from on-chain token balances over their active window.

## Entry 10 - Candidate B contents retrieved (primary source read in full)
Source: Notion write-up "Reverse-Engineering a 4,500 Sol/m Solana Arbitrage Bot" (author unnamed; screenshots dated 2025-11-13). Fetched via the public `/api/v3/loadPageChunk` endpoint (76 blocks).
Author's claims (self-reported; cross-checked against sandwiched.me and Flipside by the author, NOT by me):
- "Bot Address": `CroWg74XNDF8UMnAZVbXx49iVj7iJ7b4CsqTCVWF7aK`. Last 30 days: profit 4,500 SOL (~$700k), fees 27 SOL (~$4k).
- Volume: 1.24M successful txs, 152,550 failed. Author says only ~11% of successful txs generated the profit; a Flipside pass found 118,336 profitable txs worth ~3,628 SOL (~$550k) excluding USDC/USDT trades.
- Strategy: atomic arbitrage through a custom swap-router program (a private "mini-Jupiter") that executes multi-leg swaps in ONE transaction and reverts if it would lose money. 4 DEXs, 8 pools, 28+ routes. Shapes: 2-step (buy DEX1, sell DEX2) and 3-step (buy DEX1, swap on DEX2, sell DEX3).
- Main venues found: Pump.fun AMM, Meteora, Orca Whirlpools (the fourth DEX is not named).
- Capital: author says at least $100,000 for safe operation; largest single trade ~300 SOL (~$45k).
- Latency: opportunities last ~100ms; needs data in 10-40ms via Solana shred streams. Author's own implementation was still at 180ms avg and ~1% success, migrating JS to Rust.
- Author says writing the router program from scratch would take over a year.

On-chain verification by me (mainnet, 2026-10-05):
- `CroWg74...` is an executable upgradeable PROGRAM (the router), not a wallet. Newest tx 2026-07-28 13:43 UTC. 1000 most recent txs span 2026-06-30 to 2026-07-28, only 22 succeeded.
- RPC freshness confirmed (current slot blocktime 2026-10-05 13:12; Jupiter v6 and Orca active that second). So the silence is real.
- Notable: Bot #1 (`E6YoRP3a...`), and `CroWg74...` both have newest tx at 2026-07-28 ~13:41-13:43 UTC, within two minutes. Bot #2 stopped earlier (2025-09-24). A simultaneous stop suggests a shared cause (one operator rotating to new program addresses, or a venue/protocol change). UNVERIFIED which. A redeployed program under a new address would explain it, so "program silent" does not mean "operator stopped".

Assessment for the report: Candidate B is the best-documented, but (1) the exact strategy needs >=$100k capital and shred-stream latency, neither available at $50 on a fork; (2) its program is currently inactive at the address given; (3) profit figures are the author's. Still the right architecture to study and the right basis for a scaled-down cross-DEX arb.

## Entry 11 - Cross-DEX arb scan results (2026-10-05 13:13-13:22 UTC)
Method: `src/scan.mjs`. Buy 0.25 SOL of a token on DEX A (Jupiter quote, direct routes, DEX-restricted), sell the proceeds on DEX B, compare to input. DEXs: Whirlpool, Meteora DLMM, Meteora, Raydium CLMM, Raydium, Raydium CP, Pump.fun Amm. Top ~25 traded tokens per cycle. Quote-only, nothing executed. Fee model: 10,000 lamports base + 20,000 priority.
Results: 4 cycles (slow because of API rate limiting), 488 round-trip paths logged (`data/scan-2026-10-05.jsonl`).
- Paths with positive GROSS profit: 0. Paths clearing fees: 0.
- Best path: Meteora DLMM -> Whirlpool on token `98sMhv...`, gross -207,565 lamports (about -0.083% of the trade). Same best path repeated across cycles, so it is a stable spread, not noise.
- Median net was about -2.4M lamports (-1%), driven by thin pools.
Interpretation: at this size, with Jupiter's quotes, cross-DEX gaps are smaller than pool fees. Profitable bots in the Notion write-up win with (1) shred-stream data in 10-40ms, (2) a custom atomic router, (3) $100k+ capital, none of which a $50 quote-polling bot has. Limits of this test: Jupiter quotes lag on-chain state and polling takes seconds while real arb windows are ~100ms; one 10-minute sample; no 3-leg routes; no Pump.fun bonding-curve or brand-new-token paths. So "zero found" means this method does not work, not that no arbitrage exists.

## Entry 12 - Which strategies earn most on Solana mainnet (fact-based, 2026-10-05)
Evidence quality tags: [PAPER] peer-style measurement, [DATA] first-party stats, [BLOG] secondary/marketing, [GAP] could not find data.

SANDWICH [PAPER]: arXiv 2609.28115v1 "No Place to Hide" (https://arxiv.org/html/2609.28115v1), 3-year study 2023-07-01 to 2026-06-30. Solana: 28.0M sandwiches by 8,631 bots; gross profit $383.4M, net $345.2M; 88.0% of attacks profitable. Net per sandwich = 345.2M/28.0M = ~$12.3 (my calculation; the figure I first extracted labelled $12.30 as gross, but gross/28.0M = $13.7, so only the net figure is self-consistent). Only 16.5% of 5.02M sandwiches on Axiom victims carrying jitodontfront had a Jito tip, i.e. most bypass Jito's protection. Stated limitation: heuristics cannot always tell which tx in a multi-victim sandwich was targeted.
Other sandwich data: Vpe program ~1.55M sandwiches, $13.43M in 30 days (Dec 7-Jan 5), 88.9% success, ~$8.67 avg (Helius report). ACM measurement of Jito sandwiching: 500K+ attacks early 2025, $7.7M+ victim losses (search snippet; page returned 403, not read).

ARBITRAGE [DATA]: Jito detector, one year: 90,445,905 successful arbs, $142.8M profit, avg $1.58 per arb, max $3.7M, 88.7% SOL-denominated (Helius). Excludes private mempools.

Per-operation comparison (my arithmetic on the above): sandwich ~$12 net per success vs arb ~$1.58 average. Arb has ~3x the transactions but ~0.4x the total profit. Total: sandwich $345M net over 3 yrs vs arb $142.8M in ONE year, so annual totals are the same order of magnitude; the sandwich figure is a 3-year total, so per year arb is larger. Do not claim sandwiches earn more in total from this data.

LIQUIDATION [BLOG]: 2-8% collateral bonus when health factor < 1.0 on Kamino/MarginFi/Drift/Save; first tx to land wins (RPCFast). No aggregate profit figure found. [GAP]
JIT LIQUIDITY [GAP]: no Solana-specific profitability data found; only generic descriptions of concentrated-liquidity DEXs (Orca Whirlpool, Meteora DLMM, Raydium CLMM).
TOKEN SNIPING / LAUNCH ARB [GAP]: described but no measured profit data found.

Market-wide claims [BLOG, low confidence]: "$720M MEV revenue last year", "$847M in 2025", ">55% of MEV transactions revert or fail to land", "most participants lost money while a small share captured most profit". Origin sources not found; the one page that might support them (mevbotsolana.net) was unreachable and looks like vendor marketing. Do not cite these in the report without a primary source.

Implications for a $50 bot (REASONING, not measured): profit per sandwich depends on victim trade size and on how much capital you can put in the front-run leg, so $50 caps the per-trade take well below the $12 average; arb already measured as unprofitable at this size (Entry 11). Fork behaviour will differ from mainnet.

## Entry 13 - Sandwich sizing model and $50 profit sweep (2026-10-05)
Code: `src/amm.mjs` (constant-product swap, fee stays in pool), `src/sandwich.mjs` (`planSandwich`: finds front-run size that maximizes profit subject to (a) front-run <= capital and (b) victim still receives >= its minTokenOut), `src/sweep.mjs`. Tests: `npm test`, 5 passing (zero-slippage victim => no attack; victim min-out always honored; capital cap respected; optimizer matches a 4000-point brute-force grid; costs above edge => no trade).
Sweep (`npm run sweep`): capital 0.3 SOL (~$47 at an assumed $155/SOL), cost 30,000 lamports per bundle, constant-product pool, 0.25% fee.
- Front-run was capped by CAPITAL (0.300 SOL) in every profitable case, so the victim's slippage setting (1%, 5%, 15%) made no difference. At $50 the binding limit is our money, not the victim's tolerance.
- Profit depends on victim size relative to pool depth. 200-SOL pool: 1 SOL victim ~$0.23, 10 SOL ~$4.49, 50 SOL ~$25.68 net. 2,000-SOL pool: 10 SOL victim ~$0.23, 50 SOL ~$2.10. 20,000-SOL pool: nothing profitable. 2,000-SOL pool with a 1 SOL victim: nothing.
- So at $50 the targets are thin/new pools with comparatively big buys, not deep majors.
Limitations (important for the report): constant-product pools only (Raydium CP, Pump.fun AMM style); Orca Whirlpool/Meteora DLMM/Raydium CLMM need different math, not built. No competition modeled: real bots bid away profit (RPCFast: arb bots tip 50-60% of expected profit); the 30k-lamport cost excludes any such tip. Assumes our bundle lands directly around the victim, which is exactly what the fork's rules decide. Pump.fun bonding-curve phase is not constant-product in the same form. These are model outputs, not measured results.
Terminology note: the instructor's JIT description as relayed ("detects liquidity being added and front-runs it") is not the standard definition of JIT (add liquidity just before a big swap, remove right after). It may be LP sniping. UNRESOLVED; needs the instructor's wording.

## Entry 14 - Mainnet backtest of the sandwich model on Pump.fun AMM (2026-10-05)
Code: `src/backtest.mjs` (read-only; works on any RPC). Method: take the latest 300 signatures of the Pump.fun AMM program `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` (program ID confirmed against Jupiter's label map), fetch each tx, rebuild the pool's pre-trade reserves from the tx's pre/post token balances, treat each single-pool BUY as a hypothetical victim, run `planSandwich` with 0.3 SOL capital and 30,000-lamport cost. Victim slippage is ASSUMED (not decoded from instruction data): 1%, 3%, 10%.
Results (data in `data/backtest-2026-10-05.jsonl`):
- 300 sigs, 243 successful. Only 159 fetched (84 lost to RPC rate limiting). 64 clean single-pool buys, 18 sells, 77 skipped as multi-hop/unparseable.
- The 300 signatures spanned ~1 second of blockTime, i.e. this program handles on the order of hundreds of txs per second.
- Median pool depth ~203 SOL, median victim buy 0.007 SOL (tiny).
- 8 of 64 buys (12.5%) would have cleared costs at 0.3 SOL capital. Total net 0.0251 SOL (~$3.88 at an assumed $155/SOL), median 0.00313 SOL (~$0.49). Results identical for 1/3/10% assumed slippage, again because capital, not victim tolerance, is the binding limit.
- The 8 hits: depths 112-167 SOL, victim buys 0.43-2.56 SOL, nets 0.00014-0.01226 SOL. Five of the 8 were the same token (`6YuVyH...`), so opportunities cluster in a few hot pools.
Caveats, all material: (1) a ~1-second sample, so do NOT extrapolate to hourly/daily income; (2) assumes no competition, but real sandwich bots run constantly on this program and some of these "victims" were probably already sandwiched, or are bot legs themselves (a bot's own front-run buy looks like a victim buy here); (3) victim slippage is assumed; (4) fee model 0.25% flat, whereas Pump.fun AMM fees vary; (5) ignores that landing the bundle around the victim is the hard part; (6) 84 of 243 transactions were not retrieved; (7) multi-hop swaps (77) are excluded, so the buy count is understated.
What it does support: at $50 the model finds some opportunities in thin pools, they are small (cents to ~$2 each after costs), and they exist in volume because the venue is very busy. That matches the "smaller profit, many trades" approach and says nothing yet about winning them against other bots.

## Entry 15 - Backtest with decoded victim slippage (2026-10-05, Alchemy RPC)
Changes: `src/backtest.mjs` now decodes each victim's actual slippage limit from Pump.fun AMM instruction data (top-level and inner instructions) instead of assuming one. Discriminators observed on mainnet: `66063d1201daebea` = buy (base_amount_out, max_quote_amount_in), `c62e1552b4d9e870` = buy_exact_quote_in (spendable_quote_in, min_base_amount_out, track_volume); `33e685a4017f83ad` = sell; `e445a52e51cb9a1d` = event log (ignored). I identified buy/sell from instruction layouts and checked them against balance changes; the decoder check below is the validation. `src/sandwich.mjs` now supports exact-out victims (tokens fixed, SOL variable); 6 tests pass.
Infra note: Alchemy returns an empty list for `getSignaturesForAddress` on this very busy program, so the backtest finds signatures on the public RPC (`SIG_RPC_URL`) and fetches transactions through Alchemy (`RPC_URL`). The API key lives only in the git-ignored `.env`.
Bug found and fixed: first decoded run showed an impossible 8,110 SOL total. Cause: exact-out victims with a huge max-spend were modeled as paying inflated prices their wallets could never cover. Fix: cap each victim's spend at their wallet's SOL + wSOL balance. Run after the fix is the one reported here. Any earlier output that includes that total should be disregarded.
Results (one live sample of 1000 sigs, new each run; `data/backtest-decoded-2026-10-05.jsonl`):
- 617 successful sigs, 504 fetched, 66 usable single-pool buys with exactly one decodable buy instruction; 59 sells; 286 multi-hop/unparsed; 93 buys ambiguous (multiple buy instructions in one tx).
- Decoder validation: decoded amount / actual balance change, median 1.001.
- Victim slippage slack (how much worse than quoted price the victim tolerates): median 25.6%; 0% of buys <=1%; 71% >=10%; 29% >=50% (effectively unprotected). So victims in this sample almost never set tight slippage.
- With real limits, 10 of 66 buys (15%) clear costs at 0.3 SOL capital: total 0.0150 SOL (~$2.33 at assumed $155), median 0.00134 SOL (~$0.21). Largest single: 0.00443 SOL (~$0.69).
- Front-run was capital-capped (0.300 SOL) in all hits. Hits were victims buying 0.23-3.8 SOL in pools of 56-459 SOL.
Caveats: single ~second-scale sample, variance between runs is large (earlier assumed-slippage runs gave 8/64 and 38/266 hits); 93 ambiguous and 286 multi-hop txs excluded, so this understates opportunity count; no competition modeled; some "victims" may be bots' own legs; flat 0.25% fee assumption; hit totals are tiny in absolute terms. Treat as order-of-magnitude: cents to under a dollar per hit at $50 capital.
Earlier file `data/backtest-2026-10-05.jsonl` holds the assumed-slippage runs (Entry 14 and a 1000-sig rerun mixed together); the decoded file is the current one.

## Entry 16 - Which chain? Solana vs EVM (instructor allows Solana or any EVM chain; graded on profitability) (2026-10-05)
Evidence quality: [PAPER] arXiv 2609.28115v1; [DATA] Bitquery (vendor study, methodology disclosed); [THIRD-PARTY] GitHub mev-scout (unknown author, tool + README, observational only); [BLOG] search summaries.

SANDWICH per chain [PAPER], Jul 2023-Jun 2026 (https://arxiv.org/html/2609.28115v1):
| Chain | Sandwiches | Bots | Net profit | Per sandwich | Notes |
|---|---|---|---|---|---|
| Solana | 28,042,725 | 8,631 | $345.2M | $12.31 | 88.0% profitable |
| Ethereum | 30,607 | 7 | $254.6k | $20.33 | private RPC/OFA; one entity runs the 7 bots |
| Tron | 38,567 | 12 | $642.5k | $23.35 | FCFS public mempool |
| Base | 1,889 | 4 | $2.4k | $1.61 | centralized sequencer, private queue |
| Arbitrum | 0 | 0 | - | - | none observed |
| Monad | 0 | 0 | - | - | <1 year live |
Reading: sandwiching at scale exists only on Solana (~99.7% of all sandwiches in the table). Base/Arbitrum offer essentially no sandwich opportunity. Solana also has by far the most competing bots.

ARBITRAGE per chain [DATA] Bitquery, 12 months to 2026-08-29, EVM only (Solana excluded by Bitquery) (https://bitquery.io/investigations/crypto-arbitrage-69-cents): Ethereum 3.8M trades, $19.6M, $7.74 avg; BNB Chain 94.5M, $21.8M, $0.35; Base 21.2M, $6.0M, $0.43; Arbitrum 4.0M, $1.0M, $0.39; Polygon 4.5M, $565k, $0.22. Overall 139M trades, ~$0.69 avg; nearly half earned under one cent; BNB had ~25% of its year's profit in 3 days. Totals are stated as floors. Solana arb (different method, Jito detector): $1.58 avg (Entry 12).
[THIRD-PARTY] mev-scout (https://github.com/Am0MuK/mev-scout): Arbitrum same-chain atomic arb over 90 days = 28,482 arbs, $12,796 net total, median $0.00, p90 $0.08, ~70% of profit from 15 txs, none still profitable one block later. Aave V3 liquidations under $100 net negative on every chain; Arbitrum liquidation market ~EUR 68k/month outside crashes with top-1 share 27%. Its own verdict for newcomers: no.
Ordering rules [BLOG/PAPER snippets]: Base/Optimism use private mempools with priority-fee auctions; Arbitrum used Timeboost (a later snippet claims a switch to per-tx priority auctions in Sept 2026, UNVERIFIED); MEV bots on fast-finality rollups mostly spam duplicate transactions instead of bidding fees (arXiv 2506.01462). Arc (Circle EVM L1) describes private/encrypted mempools and TEE block building to block sandwiching (docs summary; primary docs not fully read).

Conclusion (my reading, not measured on a fork): for a sandwich-led strategy Solana is the only chain with real volume; for arbitrage no chain shows a small-capital edge (EVM per-trade averages are cents; Arbitrum same-chain arb is effectively dead; my own Solana scan found none, Entry 11). EVM gas also hits a $50 bank hard on Ethereum. Which chains the instructor actually forks is UNKNOWN and decides this; he has so far said "Solana".

## Entry 17 - Does compounding help? Profit vs capital (backtest, 2026-10-05)
Same live sample, `CAPITAL_SOL_LIST=0.3,1,3,10,30`: 107 usable buys, 11 clear costs at every level. Total profit: 0.3 SOL -> 0.0453; 1 -> 0.1508; 3 -> 0.4461; 10 -> 1.3257; 30 -> 2.7781 SOL. Return on capital: 15.1%, 15.1%, 14.9%, 13.3%, 9.3%.
Reading: profit scales roughly linearly with capital up to ~10 SOL, then flattens as victim size/pool depth/slippage start to bind. So in the model, compounding does let trade size grow usefully until about 10-30 SOL for these pools.
IMPORTANT CAVEAT: a 15% return on capital for a ~1-second window cannot be a real rate. It shows this model overstates absolute profit (no competition for the same victims, reserves taken from victim-tx pre-state that may already include other bots' front-runs, 'victims' that are really bot legs, perfect landing assumed). Use these runs ONLY for the shape (scaling with capital), never as income estimates. Absolute totals at 0.3 SOL varied $2.33-$24.57 across independent samples.

## Entry 18 - Is anyone sandwiching on Solana mainnet right now? (live-block measurement, 2026-10-05)
Context: the assignment's part 1 is to reverse engineer a PROFITABLE bot and measure it against real data. All five programs checked so far (Bot #1 `E6YoRP3a`, Bot #2 `89Ny6a4m`, router `CroWg74X`, Vpe `vpeNALD8`) are inactive; four of them have newest tx on 2026-07-28 between 13:34 and 13:43 UTC. Cause UNKNOWN (no source found for that date).
Reports: Cryptopolitan (published 2026-04-08, updated 04-23; data from a Dune dashboard) says sandwiching on Solana has largely faded: "In the past month, MEV attackers only paid 5 SOL for bot activity", most remaining attempts hit trades under $1, ~90% of transactions protected via Jito. (https://www.cryptopolitan.com/solana-no-longer-threatened-sandwich-attacks/). Jito banned 15 more validators for enabling sandwiches in late 2025 (cryptorank snippet). Secondary news, Dune dashboard not read by me.
My measurement: `src/detect.mjs`. Samples finalized blocks (50 blocks spaced 30 slots apart, ~8 min of chain time), parses every successful tx's pool-side wSOL/token balance changes, flags a sandwich pattern when one signer BUYS then SELLS the same pool within the block with another signer's BUY in between, then requires the bot's OWN SOL+wSOL balance to rise (verified profit).
Result: 50/50 blocks, 60,852 txs, 4,655 direct swap legs, 1 pattern match, 0 verified profitable. The single match (`6h71m4cs…`, slot 453600222) was a false positive: a routine round trip on the deep SOL/USDC pool with 8 unrelated swaps between, no Jito tip, and the signer's balance changed only by tx fees. Earlier 12-block run found the same single match.
Limits: only pools with a wSOL vault visible in balance changes (misses USDC-quoted pools and multi-hop); requires the same signer in front and back (misses bots splitting wallets); no Jito-tip evidence found anywhere (tip accounts list from memory, 8 addresses, not verified against a tip event); ~8 minutes of sampling in one session. So: no evidence of active, profitable sandwiching in this sample, consistent with the April reports. Not proof it is zero everywhere.
Tooling fix: Solana now has version-1 transactions. Fetches with maxSupportedTransactionVersion 0 fail on them (this explains part of the ~20% fetch failures in Entries 14-16, so those samples excluded v1 txs). Scripts now use version 1. Earlier results remain valid but undercount.

## Entry 19 - Vpe history is retrievable (best remaining "documented profitable" target)
- `vpeNALD89BZ4KxNUFjdLmFXBCwtyqBDQ85ouNoax38b`: executable upgradeable program. The newest 1000 signatures span 2025-12-17 to 2026-07-28; the next 1000 older span 2025-03-03 to 2025-12-17. So the program was nearly dormant from ~March 2025 onward (about 2,000 txs in 16 months).
- The Helius figures (1.55M sandwiches, $13.43M, 88.9% success over "Dec 7-Jan 5") therefore most likely describe Dec 7 2024 - Jan 5 2025 (the report also quotes 2024 annual totals). INFERRED from context, not confirmed against the report's publish date.
- Old transactions are fetchable on both Alchemy and public RPC (tested). So Vpe's behavior in its active window can be reverse engineered from the public ledger: reconstruct front/victim/back triples, profit per sandwich, tip share, pools targeted, success rate. Paginate `getSignaturesForAddress` with `before` or use `getBlock` at slots in that window (large; sample, do not scan fully).
- Consequence for the report: the "profitable bot" being reverse engineered would be historical (documented active Dec 2024 - early 2025), with the current-market finding (Entry 18) as an honest caveat that the strategy's mainnet opportunity has largely dried up.

## Entry 20 - Non-sandwich, non-arb options: what the data says (2026-10-05)
Requirement restated by user: instructor will run the bot's logic in SIMULATION against live mainnet (no trading) before using his fork; the bot must show profit there. Sandwich is dead on mainnet (Entry 18) and cross-DEX arb found nothing at $50 (Entry 11), so a simulation run today would show ~zero or negative for both.
Measured: passive LP fee yield on Orca Whirlpools, current API (`https://api.orca.so/v2/solana/pools`, updatedAt 2026-10-05T14:09Z, 100 busiest pools with TVL >= $200k): 24h fee yield over TVL median 0.022%/day, p75 0.119%, p90 0.538%, max 1.435% (SOL/ORCA, TVL $806k). Pools TVL $1M-$50M: median 0.010%/day. At the median a $50 position earns ~$0.011/day. Top-yield pools are volatile tokens (SOL/ORCA, SPCXx/USDC, DJT/USDC, SOL/PUMP); yield here is FEES ONLY, before impermanent loss, which on volatile pairs can exceed fees. Low-risk pairs (stablecoin / SOL-JitoSOL, TVL >= $1M, 4 pools): 0.0006%-0.0237%/day (PYUSD/USDG 0.0237%, others ~0.001-0.002%), i.e. $0.0003-$0.012/day on $50.
Data quality note: Orca's older v1 endpoint (`api.mainnet.orca.so/v1/whirlpool/list`) returned a stale March-2025 snapshot (SOL at $127), so it was discarded. Meteora's public DLMM API path I tried returned 404; Meteora not measured.
Not yet measured, no evidence either way: (a) backrun arbitrage after large swaps (price dislocation right after a big trade, vs. my earlier random-time quote scan); (b) liquidation of unhealthy lending positions on Kamino/Save/MarginFi (2-8% bonus per RPCFast, but mev-scout found sub-$100 EVM liquidations net negative, Solana unmeasured); (c) JIT / LP-sniping around large swaps (instructor mentioned; no Solana profitability data found); (d) directional/statistical trading (not MEV; backtests overfit easily).
Honest status: no strategy measured so far yields meaningful profit at $50 against current mainnet. Passive LP positive-carry exists but is cents/day.
Open question for the instructor (decides everything): how is "profitable in simulation" scored? (1) replay of historical blocks vs. a live read-only dry run; (2) absolute dollars or percent return on capital; (3) are fees and tips counted; (4) which pools/DEXs are in scope.

## Entry 21 - Back-run style scan on actively traded tokens + liquidation market size (2026-10-05)
Hot-token scan: `src/hotmints.mjs` collects the 40 most frequently seen non-stable mints with wSOL in 15 recent finalized blocks (`data/hot-mints.txt`), then `src/scan.mjs` (new `TOKENS` env) checks every ordered DEX pair for round-trip gaps. 17 of 40 had at least two DEX pools reachable via Jupiter's direct routes; 70 paths per cycle.
Results: at 0.1 SOL: 70 paths, 0 profitable, best gross -13,158 lamports (-0.013%). At 0.05 SOL (loop, `data/hot/`): best gross -10,700 lamports (-0.021%), 0 profitable. Spreads on long-tail active tokens are tighter than on top-traded ones (earlier best -0.083%) but still below the pool fees, even before costs. This is quote-based and sampled at random moments seconds after the fact, so it does not test true post-big-swap back-running at sub-second latency; it shows no standing gap.
Liquidations: Kamino lending program `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` confirmed executable on mainnet. In 400 transactions (about 6 minutes of activity) there were 0 liquidations (dominant instructions: RefreshReserve, RefreshObligation, rollovers, deposits). Published quarterly figures (Kamino Q2 token holder report via Blockworks, search snippet, not fully read): Q2 2026 liquidation fees $37.3K (down from $145.1K in Q1), collateral seized $6.78M (Q1 $44.3M), ~87% of Q2 activity in June's SOL drawdown. Liquidation is permissionless and contested by many bots with priority fees; penalty about 5% of the liquidated amount. Reading: liquidation income arrives in bursts during sell-offs and is near zero on calm days, so a simulation on a calm day would show nothing, and a $50 bot would be a minor competitor on any burst day.
Conclusion so far: nothing measured beats zero by more than cents. The only consistently positive strategy found is passive LP fee carry (Entry 20), at cents/day for $50.

## Entry 22 - Idea check: Polymarket prediction bot using Arbitrum Stylus (2026-10-05)
Evidence quality: mostly search summaries (not read in full); treat numbers as unverified unless noted.
- Bots do compete on Polymarket. A peer-reviewed analysis of 86M bids across 17,218 markets reports ~$40M of arbitrage profit extracted between April 2024 and April 2025 (cited in Yahoo Finance coverage, https://finance.yahoo.com/news/arbitrage-bots-dominate-polymarket-millions-100000888.html). Blog/vendor claims (LOW confidence): average arb window 2.7s (12.3s in 2024), 73% of arb profit taken by sub-100ms bots, simple both-sides arb no longer reliably profitable.
- Forecasting edge is hard: a blog claim (LOW confidence) says only 7.6% of Polymarket traders are profitable and 0.51% of wallets made over $1,000. Market-making claims of 1-3%/month come from low-quality sources.
- Architecture (Polymarket docs/arXiv summaries): off-chain central limit order book matched by an operator, settled on Polygon via the CTF Exchange with signed EIP-712 orders. Off-chain fills can still revert on-chain (arXiv 2606.16852, "The Ghosts of Polymarket"). So trading there needs the real API and real funds; it is not a state a chain fork can reproduce.
- Stylus: Arbitrum's second WASM VM for on-chain smart contracts written in Rust/C/C++ (https://docs.arbitrum.io/stylus/gentle-introduction). It speeds up on-chain compute. A prediction bot runs off-chain, and Polymarket lives on Polygon, so Stylus gives no advantage here.
- Fit to assignment: the test is on an instructor-run fork of a Solana/EVM chain against classmates' bots; Polymarket's order book cannot be forked into that. Would need explicit instructor approval; otherwise not usable for the graded test.

## Entry 23 - Polymarket: instructor rules, fees, measured calibration, and a leaderboard (2026-10-05)
Instructor rules (relayed by user): the end goal is a profitable bot, not necessarily the fork test. The fork is only for bots that could hurt other people (e.g., sandwich). Non-harmful bots are tested on mainnet with $50 of real funds provided by the instructor. A prediction-market bot therefore counts.
Primary facts (Polymarket docs/help center): off-chain CLOB, settlement on Polygon. Taker fee = shares x feeRate x p x (1-p), rates 0.04-0.07 by category (crypto 0.07); maker pays no fee and gets 20% (crypto/sports) or 25% (most others) of taker fees back as daily rebates; geopolitics fee-free; rebates only pay out once accrued >= $1 USDC (https://help.polymarket.com/en/articles/13364471-maker-rebates-program). Market metadata from the Gamma API shows per-market feeSchedule (example rate 0.05, rebateRate 0.15). Public endpoints reachable from this sandbox: gamma-api.polymarket.com, clob.polymarket.com (prices-history needs startTs/endTs windows, intervals over a few days rejected), data-api.polymarket.com.
Measurement: `src/pm_backtest.mjs` (MODE=diverse | btc). For resolved binary markets, takes the price of each outcome token a fixed time before close, assumes a taker buy held to resolution with the fee formula, and tabulates win rate vs implied probability and return by price bucket.
Results (data in `data/pm-backtest-*.json`):
- First run was INVALID: 136 of 150 sampled markets were 5-minute "Bitcoin Up or Down" markets, so a price "1h before close" was taken before those markets existed. Discard it.
- Diverse run (200 markets lasting >= 3 days, all closing on 2026-10-05) and BTC run (150 five-minute markets, same day): samples are tiny (buckets n=8-99) and clustered in one day, and both outcomes of a market land in opposite buckets, producing mirror-image returns (e.g. +56% vs -38%). No statistically reliable edge can be read from either. What can be read: prices >= 0.97 close to resolution won 100% in the diverse sample (n=173/107/81, avg return +0.1% to +0.3% per trade) but in the BTC set 1 of 18 at 300s and 1 of 121 at 60s lost, giving -5.1% and -0.36% averages: near-certain favorites carry rare but total losses. Treat as no demonstrated edge.
- Needed for a real test: many weeks of markets across categories, ideally with order-book (bid/ask) depth, not last-trade price.
Leaderboard: `https://data-api.polymarket.com/v1/leaderboard?timePeriod=MONTH&orderBy=PNL&limit=10` returns current rankings. Top monthly entries at time of query: #1 `00gringo00` (0x51698a47...) pnl $3.65M on $28.2M volume; #2 `BreakTheBank` (0xf0318c32...) $2.28M on $46.7M; #3 `mooseborzoii` (0x1f3a646c...) $2.02M on $33.4M; #4 `e46m3` (0x4f1d5ae2...) $2.01M on $2.5M volume; #5 `TheReturnOfDarthMaul` (0x3a8aa345...) $1.86M on $4.2M. Unknown whether any are bots; pnl is as reported by Polymarket and not independently verified. These are active, publicly traceable wallets, unlike the dead Solana programs, so they are candidates for part 1 (reverse engineer a profitable bot), with each wallet's trade history available from the data API and Polygon.

## Entry 24 - Do top Polymarket wallets have a copyable, persistent edge? (2026-10-05)
Scripts: `src/pm_wallets.mjs` (behavior of top-10 monthly leaderboard wallets, `data/pm-wallets-MONTH.json`), `src/pm_copy.mjs` (copy-with-delay backtest), `src/pm_persist.mjs` (in-sample vs out-of-sample, fees included). Data: public data-api trades + Gamma resolution + per-market fee schedule.
Behavior (newest up to 3000 trades): most top earners trade sports, BUY almost exclusively (94-100% buys), and several trade at bot speed (UpTheBlues 524 trades/h, mooseborzoii 148/h, wr0ngw4yb3tt0r 58/h, e46m3 34/h across 1,503 markets with 60% of buy $ at price >= 0.95). Median fills $11-$266. e46m3's monthly pnl ($2.01M) vs volume ($2.49M) is inconsistent with its near-certain-favorite trading, so its numbers are not interpretable.
Copy-with-delay (first pass, resolved buys only, NO fees, 118-120 tokens each): wr0ngw4yb3tt0r own fills +18.3%, copying 30s/120s/600s later at market price +20.2%/+20.9%/+23.8%; mooseborzoii +8.3% own, +8.7%/+8.4%/+7.7% copying; BreakTheBank -12.9% own (inconsistent with its +$2.28M month pnl, so the sample is unrepresentative); UpTheBlues only 5 resolved tokens. Late prices are last-trade, not the ask.
Persistence test (all buy fills held to resolution, return after market fees, resolved markets only; "selection window" = last 30 days, which is how I picked them, "out of sample" = days 30-90 ago):
| Wallet | Last 30d | Days 30-90 | Notes |
|---|---|---|---|
| Kch-Temp | +28.0% on $5.45M, 126 mkts, 56% winning, best mkt 18% of P&L | +14.7% on $0.83M, 29 mkts | most diversified, only wallet positive in both with real breadth |
| mooseborzoii | +10.3% on $3.77M, 229 mkts, 49% winning | none (history starts 2026-09-30) | positive but unproven |
| wr0ngw4yb3tt0r | +1.6% on $8.6M, 519 mkts | 4 fills only | first-pass +18% shrank to +1.6% with fees and the larger sample |
| BreakTheBank | +32.8% but one market = 124% of P&L | +1.5%, 36 mkts | not persistent |
| TheReturnOfDarthMaul | +25.5%, 9 mkts | +29.4%, 13 mkts | a few huge directional bets, one market > 100% of P&L |
| sainttroplay | +109.5%, 4 mkts | +74.3%, 10 mkts | a handful of huge bets |
| totoro3miyazaki | +11.2%, 19 mkts | +65.6%, 3 mkts | too few markets |
Limits: wallets were chosen because they topped the month's profit leaderboard (survivorship/selection bias; I examined 7 of the top 10); only BUY fills held to resolution are modeled (their sells and early exits are ignored, so this is not their real P&L); unresolved markets are excluded; fills are at their prices, copy fills would be at the ask plus fees; dollar-weighted returns are dominated by a few large markets; no confidence intervals computed; fee rates are the per-market schedule where present.
Reading: the evidence for a copyable edge is thin. At most one wallet (Kch-Temp, sports, ~1.5 trades/hour, so slow enough to copy) shows a diversified positive return in both periods, and its out-of-sample sample is only 29 markets. Everything else is either unproven, concentrated in a few bets, or shrinks after fees. Not enough to claim a profitable bot.

## Entry 25 - Sports betting scope: NFL, Polymarket vs DraftKings (2026-10-05)
Literature (search summaries, not read in full): NFL closing lines are generally efficient; some ML papers report 55-60% against the spread while others report ~50.9%, below the 52.4% break-even at -110 odds; line movement is attributed to sharp action rather than injury news, i.e. injuries are already priced in by close. Sources: arXiv 1211.4000, arXiv 2410.21484 (systematic review). No published Polymarket-vs-Pinnacle study found.
Data pipeline (new): `src/sports_nfl.mjs` pulls finished NFL games from ESPN (scoreboard + core odds API, DraftKings moneylines, de-vigged proportionally), finds the matching Polymarket moneyline market by event slug (`nfl-<away>-<home>-<date>`), and takes Polymarket's last price at least 2 minutes before kickoff. `src/sports_analyze.mjs` compares them. Data: `data/sports-nfl.json`.
Bug caught: ESPN's `year=` parameter is ignored (returns the current season), so my first run labelled the 2026 weeks 1-4 games as 2025 and double-counted them (118 rows = ~59 games). Fixed with `dates=<year>` and de-duplication by event id; discard any earlier NFL numbers.
Results (299 unique finished games: 240 from 2025, 59 from 2026; 334 finished, 14 lacked DK odds, 21 lacked a PM market):
- Polymarket and DraftKings agree almost exactly: Brier 0.2164 vs 0.2165, log loss 0.6190 vs 0.6193, accuracy 64.9% both; PM minus DK home probability: mean +0.19 pts, sd 1.4 pts, mean abs 1.1 pts, max 5.7 pts.
- Betting Polymarket when it is cheaper than DK's de-vigged probability, held to resolution, after fees: any gap +3.2% (std err 7.6%, n=299), gap > 1 pt +0.1% (std err 12.1%, n=128), gap > 2 pts -20.5% (std err 19.2%, n=44), gap > 3 pts -8.9% (std err 49.8%, n=11). No edge distinguishable from zero.
- Fees: most 2025 games' markets were fee-free (feesEnabled false), the 2026 ones carry rate 0.05 (about 2.5% of cost at p=0.5 for a taker), so the 2025 results flatter a fee-paying 2026 bot.
- DK favorite calibration is noisy (0.6-0.7 bucket implied 64.9% vs actual 56.0%, n=91; 0.8+ implied 85.3% vs actual 94.4%, n=36): no stable pattern at this sample size.
Reading: Polymarket NFL prices are effectively the sportsbook line; the price gap is ~1 point, comparable to or below fees. A bot would have to out-predict the sportsbook closing line itself, which this sample cannot test (a few percentage points of edge needs thousands of games to detect). Power note: with per-bet std dev near 1 (100%), detecting a 3% edge takes roughly 4,000+ bets.

## Entry 26 - Polymarket paper-trading copy bot built (2026-10-05)
Decision (user): reverse engineering is not required if the bot runs on mainnet; build our own. Instructor provides $50 real funds for mainnet bots; the fork is only for bots that could harm others.
Code: `src/pm/core.mjs` (pure logic), `src/pm/paper.mjs` (live loop), `src/pm/report.mjs` (CLI + `data/paper/report.html`), tests in `test/pm.test.mjs` (14 tests passing across the repo). Run: `WALLETS=0xabc,0xdef npm run paper` / `node src/pm/paper.mjs`, report: `node src/pm/report.mjs`. State persists in `data/paper/ledger.json`.
Behavior: polls `data-api` trades for tracked wallets; copies only BUYs made after startup; skips if their price is outside 0.05-0.95, if the market is closed/not accepting, if there is no ask, if the current best ask differs from their price by more than 3 points in EITHER direction, if the book is too thin, if the market already holds >= 8% of equity, or if the account is down 40% from start. Stake = min(4% of equity, cash, 60% exposure cap), raised to the market's minimum order size if affordable. Fills at the best ask with the market's taker fee. Settles from Gamma resolution. Stakes grow with equity (compounding). Paper-only: LIVE=1 aborts by design.
Bugs found by the replay test and fixed: (1) the price check only rejected price rises, so it paper-bought a 6-cent token because a wallet paid 51 cents earlier; now symmetric. (2) It stacked 10 positions in one market; now capped per market.
Finding that limits live copying: Polymarket's data-api trade feed is about 9 minutes behind (newest trade age 549s, all 20 samples within ~2s of each other, i.e. batch-indexed). A copy bot built on it is always ~9 minutes late. Entry 24's copy test covered delays up to 10 minutes (mooseborzoii 8.3% own vs 7.7% at 10 min; wr0ngw4yb3tt0r 18.3% vs 23.8%, pre-fee) but that used mid prices, not asks. Lower latency would need on-chain Polygon fill events or the CLOB websocket, neither built.
Not built / not verified: live order signing and funding (needs a wallet, Polymarket API credentials, and eligibility/KYC checks for a US user, none tested); any real P&L (a replay test only exercised the code path using arbitrary active wallets, not the strategy); a multi-day paper run (the cloud container is ephemeral, so that run needs a persistent host).
Test wallets used for the plumbing replay were arbitrary high-frequency BTC-up/down accounts; their paper trades are NOT evidence for or against the strategy.

## Entry 27 - Does a model add information beyond the sportsbook line? (2026-10-05)
Prompted by user pushback: Entry 25 only compared Polymarket to DraftKings, which cannot reveal an edge both share. Proper test: does an independent model add predictive information beyond the market price?
Method (`src/sports_elo.py`): fetched 2,029 finished NFL games (2019-2026, regular season and playoffs) from ESPN, built a sequential Elo model (K=20, home advantage 48, 33% season regression, margin-of-victory multiplier; no injuries, weather, QB or travel data), and evaluated on the 299 games that also have DraftKings and Polymarket prices (240 from 2025, 59 from 2026).
Results: log loss DraftKings 0.6193, Elo only 0.6423, coin flip 0.6931; Brier 0.2165 / 0.2260 / 0.2500; accuracy 64.9% / 63.9% / 45.8%. Logistic regression outcome ~ a + b*logit(DK) + c*(logit(Elo) - logit(DK)): b = +0.942 (std err 0.173), c = -0.110 (std err 0.323, z -0.34), intercept -0.030 (std err 0.132). So DraftKings' probabilities are well calibrated (b near 1) and the Elo model adds no detectable information.
Limits: only 299 evaluation games, so a small real improvement would be invisible (c's std err is 0.32); the model has no injury, weather, quarterback or rest information, and historical injury reports are not available from the free sources used; DraftKings line is a single book's recorded moneyline, not necessarily the close; one sport. This does NOT show that no model can beat the market, only that a standard team-strength model does not on this sample.

## Entry 28 - Early-week prices vs closing line (NFL, 299 games) (2026-10-05)
Prompted by the user: prices converge toward the true probability as kickoff nears, so the pre-kickoff comparison in Entries 25 and 27 tested the most efficient moment. New test: Polymarket moneyline price (last trade) 6 days, 3 days, 1 day and 6 hours before kickoff for the same 299 games (`src/sports_nfl.mjs` now stores `early`, `src/sports_early.py` analyzes; raw output `data/sports-early.out`; the previous close-only file is `data/sports-nfl-close-only.json`). Games with a price at the lead time: 287 (6d), 299 (3d, 1d, 6h).
Findings:
- The user's mechanism is real. Early price vs DK close, mean absolute difference: 3.5 pts (6d), 2.3 pts (3d), 1.8 pts (1d), 1.6 pts (6h). Log loss of the early PM price: 0.6253 (6d), 0.6216 (3d), 0.6201 (1d), 0.6197 (6h) vs DK close 0.6193-0.6196 on the same games: accuracy improves steadily toward kickoff, but the gap at 6 days is only ~0.006 log-loss.
- Does a model beat the early price? Elo adds nothing: regression of outcome on early PM and (Elo minus early PM), c = -0.09 +/- 0.37 (6d), -0.11 +/- 0.33 (3d), -0.13 +/- 0.33 (1d), -0.13 +/- 0.33 (6h). Does Elo predict which way the price will move toward the close? c = +0.46 +/- 0.37 (6d, z +1.27), +0.15 (3d), -0.23 (1d), -0.45 (6h): suggestive at 6 days only, not significant.
- Rule "buy when Elo exceeds early PM by > 3 pts", held to resolution, after fees: +5.9% (std err 10.2%, 192 bets) at 6d, +6.2% (10.2%, 205) at 3d, +8.7% (10.3%, 206) at 1d, +7.9% (10.2%, 207) at 6h; by > 5 pts: +6.5%, +3.4%, +1.7%, +6.1% (std errs 11-12%); by > 8 pts: -11.7%, -5.0%, -7.0%, -16.0% (std errs 12-13%). None distinguishable from zero.
- Favorite-longshot pattern in early prices: at 6 days, home sides priced under 35% moved up toward the close by +2.5 pts on average (n=47) and actually won 27.7% vs 26.0% implied; home sides over 65% moved down by -1.0 pt (n=95) and won 72.6% vs 76.0% implied. Same direction at all four lead times, shrinking toward kickoff. Per-bucket standard errors are 5-6 pts, so this is a lead, not a result.
Limits: prices are last trade, not bid/ask, so real early fills would cost spread (not measured); 299 games from two seasons, one sport; Elo model has no injuries, weather or quarterback data; in-sample.
Method note: closing line value (does the price move toward our view before kickoff?) has much lower variance than win/loss outcomes, so it needs far fewer games to detect an edge. Next steps with real power: add sports with many games (college football, NBA, MLB, soccer) and track CLV forward in the paper bot.
Tooling note: my waiting loop used pgrep -f on a string contained in its own command line, so it never exited and the background task hit its time limit; the data pull itself had finished.
