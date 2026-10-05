const env = (k, d) => process.env[k] ?? d;

export const SOL = 'So11111111111111111111111111111111111111112';

export const config = {
  rpcUrl: env('RPC_URL', 'https://api.mainnet-beta.solana.com'),
  jupApi: env('JUP_API', 'https://lite-api.jup.ag'),
  tradeLamports: Number(env('TRADE_LAMPORTS', 250_000_000)),
  dexes: env('DEXES', 'Whirlpool,Meteora DLMM,Meteora,Raydium CLMM,Raydium,Raydium CP,Pump.fun Amm').split(','),
  tokenLimit: Number(env('TOKEN_LIMIT', 25)),
  maxConcurrent: Number(env('MAX_CONCURRENT', 4)),
  slippageBps: Number(env('SLIPPAGE_BPS', 30)),
  baseFeeLamports: 5000 * 2,
  priorityFeeLamports: Number(env('PRIORITY_FEE_LAMPORTS', 20_000)),
  minNetLamports: Number(env('MIN_NET_LAMPORTS', 10_000)),
  loopMs: Number(env('LOOP_MS', 0)),
  dataDir: env('DATA_DIR', 'data'),
};

export const FALLBACK_TOKENS = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
];
