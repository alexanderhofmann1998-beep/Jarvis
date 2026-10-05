import type { Env } from "./index.ts";
import { STANDARD_ABSENDER } from "./suchlib.ts";

export async function ladeAbsender(env: Env): Promise<string[]> {
  try {
    const raw = await env.SPEICHER?.get("suchagent:absender");
    const r = raw ? JSON.parse(raw) : null;
    if (Array.isArray(r) && r.length) return r.filter((x) => typeof x === "string");
  } catch { /* Standard */ }
  return STANDARD_ABSENDER;
}

export async function ladeProfil(env: Env): Promise<string> {
  return (await env.SPEICHER?.get("suchprofil")) ?? "";
}
