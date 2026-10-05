import type { Env } from "./index.ts";

export type Bericht = { id: string; zeit: string; titel: string; kurz: string; text?: string; gelesen: boolean; dringend?: boolean };

const MAX = 30;
const ZWEI_WOCHEN = 14 * 24 * 3600 * 1000;

export async function ladeBerichte(env: Env): Promise<Bericht[]> {
  try {
    const raw = await env.SPEICHER?.get("berichte");
    const r = raw ? JSON.parse(raw) : [];
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

async function speichere(env: Env, liste: Bericht[]): Promise<void> {
  const frisch = liste.filter((b) => !b.gelesen || Date.now() - new Date(b.zeit).getTime() < ZWEI_WOCHEN);
  await env.SPEICHER?.put("berichte", JSON.stringify(frisch.slice(-MAX)));
}

export async function schreibeBericht(env: Env, b: { titel: string; kurz: string; text?: string; dringend?: boolean }): Promise<void> {
  const liste = await ladeBerichte(env);
  liste.push({
    id: crypto.randomUUID().slice(0, 8),
    zeit: new Date().toISOString(),
    titel: b.titel.slice(0, 120),
    kurz: b.kurz.slice(0, 300),
    text: b.text?.slice(0, 4000),
    gelesen: false,
    dringend: b.dringend,
  });
  await speichere(env, liste);
}

export async function ungelesene(env: Env): Promise<Bericht[]> {
  return (await ladeBerichte(env)).filter((b) => !b.gelesen);
}

export async function markiereGelesen(env: Env, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const liste = await ladeBerichte(env);
  for (const b of liste) if (ids.includes(b.id)) b.gelesen = true;
  await speichere(env, liste);
}

export function lageText(ungelesen: Bericht[]): string {
  if (!ungelesen.length) return "";
  const sortiert = [...ungelesen].sort((a, b) => Number(Boolean(b.dringend)) - Number(Boolean(a.dringend)));
  return (
    "Lage: Es liegen ungelesene Berichte von dir aus dem Hintergrund vor. Erwähne dringende zuerst und alle kurz, wenn es passt (zum Beispiel am Anfang oder auf Nachfrage). Details mit berichte_lesen.\n" +
    sortiert.map((b) => "- " + (b.dringend ? "DRINGEND " : "") + b.titel + ": " + b.kurz).join("\n")
  );
}
