import type { Env } from "./index.ts";

const MAX = 20;
const FENSTER_SEKUNDEN = 15 * 60;

export async function istGesperrt(env: Env, ip: string): Promise<boolean> {
  if (!env.SPEICHER) return false;
  const n = parseInt((await env.SPEICHER.get("rl:" + ip)) ?? "0", 10);
  return n >= MAX;
}

export async function fehlversuch(env: Env, ip: string): Promise<void> {
  if (!env.SPEICHER) return;
  const n = parseInt((await env.SPEICHER.get("rl:" + ip)) ?? "0", 10);
  await env.SPEICHER.put("rl:" + ip, String(n + 1), { expirationTtl: FENSTER_SEKUNDEN });
}
