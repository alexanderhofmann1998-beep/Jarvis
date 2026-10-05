import { NAME } from "./config.ts";

// Kurze Befehle ohne Claude (spart Kosten)
export function kurzantwort(text: string): { antwort: string; ende: boolean } | null {
  const t = text.trim().toLowerCase().replace(/[.!?,]+$/g, "").replace(/\s+jarvis$/, "");
  if (/^(danke|dankeschön|vielen dank|danke schön)$/.test(t)) return { antwort: "Gern, " + NAME + ".", ende: true };
  if (/^(das war'?s|das wars|das war es|passt so|alles klar danke)$/.test(t)) return { antwort: "Okay, " + NAME + ".", ende: true };
  if (/^(tschüss|tschüs|tschuess|ciao|bis später|bis bald|auf wiedersehen)$/.test(t)) return { antwort: "Bis später, " + NAME + ".", ende: true };
  return null;
}
