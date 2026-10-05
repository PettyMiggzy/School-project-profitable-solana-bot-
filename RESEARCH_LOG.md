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
- Search snippet claims: atomic arbitrage across four DEXs, about $700k/month. Title says 4,500 SOL/month. The two figures are inconsistent as given (4,500 SOL is far below $700k at any recent SOL price), so treat both as UNVERIFIED.
- FETCH FAILED: Notion is JS-rendered; WebFetch and the scour.ing mirror returned no content. Action: user should open the link in a browser and paste the text or addresses into this log, or I retry with a headless browser (Playwright/Chromium is available in this container).

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
