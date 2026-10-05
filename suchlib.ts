import { htmlZuText } from "./gmaillib.ts";

export const STANDARD_ABSENDER = [
  "immobilienscout24.de", "immobilienscout24.at", "immowelt.de", "immowelt.at",
  "willhaben.at", "kleinanzeigen.de", "immonet.de",
];

export function baueQuery(absender: string[], tage = 3): string {
  const a = absender.map((x) => x.replace(/[^\w@.\-]/g, "")).filter(Boolean);
  if (!a.length) throw new Error("Keine Portal-Absender hinterlegt.");
  return "from:(" + a.join(" OR ") + ") -label:jarvis-verarbeitet newer_than:" + tage + "d";
}

// HTML als Text, Links bleiben als [URL] hinter dem Linktext erhalten
export function htmlMitLinks(html: string): string {
  const mitLinks = html.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => {
    const t = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return /^https?:/i.test(href) ? (t || "Link") + " [" + href.replace(/&amp;/g, "&") + "]" : t;
  });
  return htmlZuText(mitLinks);
}

export type Fund = {
  titel: string; ort: string; preis: number | null; flaeche: number | null; link: string | null;
  portal: string; bewertung: "Top" | "Gut" | "Prüfen" | "Verwerfen"; grund: string;
};

function zahlOderNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseFunde(antwort: string, ohneProfil: boolean): Fund[] {
  const a = antwort.indexOf("["), b = antwort.lastIndexOf("]");
  if (a < 0 || b <= a) return [];
  let roh: unknown;
  try { roh = JSON.parse(antwort.slice(a, b + 1)); } catch { return []; }
  if (!Array.isArray(roh)) return [];
  const out: Fund[] = [];
  for (const x of roh as any[]) {
    const titel = String(x?.titel ?? "").trim();
    if (!titel) continue;
    const bw = String(x?.bewertung ?? "");
    const bewertung = ohneProfil ? "Prüfen" : /verwerf/i.test(bw) ? "Verwerfen" : /top/i.test(bw) ? "Top" : /gut/i.test(bw) ? "Gut" : "Prüfen";
    const link = typeof x?.link === "string" && /^https?:/i.test(x.link) ? x.link : null;
    out.push({
      titel: titel.slice(0, 200), ort: String(x?.ort ?? "").slice(0, 100), preis: zahlOderNull(x?.preis), flaeche: zahlOderNull(x?.flaeche),
      link, portal: String(x?.portal ?? "").slice(0, 60), bewertung, grund: String(x?.grund ?? "").slice(0, 300),
    });
  }
  return out;
}

export async function fundId(f: Fund): Promise<string> {
  const basis = f.link ? f.link.split("?")[0].toLowerCase() : [f.titel, f.ort, f.preis].join("|").toLowerCase();
  const h = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(basis));
  return Array.from(new Uint8Array(h).slice(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function mergeGesehen(alt: string[], neu: string[], max = 500): string[] {
  return [...new Set([...alt, ...neu])].slice(-max);
}

export function fundZuFelder(f: Fund, datum: string): Record<string, unknown> {
  return { Titel: f.titel, Ort: f.ort, Preis: f.preis ?? "", Fläche: f.flaeche ?? "", Bewertung: f.bewertung, Grund: f.grund, Link: f.link ?? "", Portal: f.portal, Datum: datum };
}
