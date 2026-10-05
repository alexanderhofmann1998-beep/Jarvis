import type { Env } from "./index.ts";
import { ladeWissen } from "./notion.ts";

const MAX_REGELN = 40;

export async function ladeWissenSicher(env: Env): Promise<{ text: string; problem: string }> {
  try {
    return { text: await ladeWissen(env), problem: "" };
  } catch (e) {
    return { text: "", problem: e instanceof Error ? e.message : String(e) };
  }
}

export async function ladeRegeln(env: Env): Promise<string[]> {
  try {
    const raw = await env.SPEICHER?.get("regeln");
    const r = raw ? JSON.parse(raw) : [];
    return Array.isArray(r) ? r.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function regelLernen(env: Env, regel: string): Promise<string> {
  const r = await ladeRegeln(env);
  const neu = regel.trim().slice(0, 300);
  if (!neu) return "Leere Regel.";
  if (r.includes(neu)) return "Kenne ich schon.";
  if (r.length >= MAX_REGELN) return "Es gibt schon " + MAX_REGELN + " Regeln. Vergiss erst eine.";
  r.push(neu);
  await env.SPEICHER?.put("regeln", JSON.stringify(r));
  return "Regel gelernt (Nr. " + r.length + ").";
}

export async function regelVergessen(env: Env, nummer: number): Promise<string> {
  const r = await ladeRegeln(env);
  if (!Number.isInteger(nummer) || nummer < 1 || nummer > r.length) return "Diese Nummer gibt es nicht.";
  r.splice(nummer - 1, 1);
  await env.SPEICHER?.put("regeln", JSON.stringify(r));
  return "Regel vergessen.";
}
