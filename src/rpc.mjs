import { config } from './config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function rpc(method, params, tries = 5, url = config.rpcUrl) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    if (res.status === 429 || res.status >= 500) { await sleep(600 * 2 ** i); continue; }
    const j = await res.json();
    if (j.error) { if (/rate|limit|too many/i.test(j.error.message)) { await sleep(600 * 2 ** i); continue; } return null; }
    return j.result;
  }
  return null;
}
