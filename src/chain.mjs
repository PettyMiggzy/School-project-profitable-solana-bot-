import { config } from './config.mjs';

const PUBLIC_MAINNET_HOSTS = ['api.mainnet-beta.solana.com', 'solana-api.projectserum.com', 'rpc.ankr.com'];

export function chainInfo() {
  const host = new URL(config.rpcUrl).host;
  return { rpcUrl: config.rpcUrl, host, chainId: process.env.CHAIN_ID || null, publicMainnet: PUBLIC_MAINNET_HOSTS.includes(host) };
}

export function assertSandwichAllowed() {
  const c = chainInfo();
  if (process.env.ENABLE_SANDWICH !== '1') throw new Error('sandwich disabled: set ENABLE_SANDWICH=1');
  if (!c.chainId) throw new Error('sandwich needs CHAIN_ID (the fork id from test day)');
  if (c.publicMainnet) throw new Error(`sandwich refused: ${c.host} is a public mainnet endpoint`);
  return c;
}
