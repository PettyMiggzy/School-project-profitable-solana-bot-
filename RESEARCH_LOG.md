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
