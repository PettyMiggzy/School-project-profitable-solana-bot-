import { config } from './config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function jget(path, params = {}, tries = 4) {
  const url = new URL(path, config.jupApi);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url);
    if (res.status === 429 || res.status >= 500) { await sleep(500 * 2 ** i); continue; }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

export function quote(inputMint, outputMint, amount, dex) {
  return jget('/swap/v1/quote', {
    inputMint, outputMint, amount: String(amount),
    slippageBps: config.slippageBps, dexes: dex, onlyDirectRoutes: 'true',
  });
}

export async function topTokens(limit) {
  const d = await jget('/tokens/v2/toptraded/1h', { limit });
  if (!Array.isArray(d)) return null;
  return d.map((t) => t.id).filter(Boolean).slice(0, limit);
}
