import { ZEITZONE } from "./config.ts";
import { formatTermin } from "./zeitlib.ts";

export const WATCHLIST = ["XAU/USD", "WTI/USD", "EUR/USD", "SPX", "DAX", "BTC/USD"];

const ALIAS: Record<string, string> = {
  gold: "XAU/USD", silber: "XAG/USD", "öl": "WTI/USD", oel: "WTI/USD", rohöl: "WTI/USD", rohoel: "WTI/USD",
  wti: "WTI/USD", brent: "XBR/USD", bitcoin: "BTC/USD", btc: "BTC/USD", ethereum: "ETH/USD", eth: "ETH/USD",
  dax: "DAX", sp500: "SPX", "s&p500": "SPX", "s&p 500": "SPX", spx: "SPX", dollar: "EUR/USD",
};

export function normalisiereSymbol(s: string): string {
  const t = String(s ?? "").trim();
  const a = ALIAS[t.toLowerCase()];
  if (a) return a;
  if (/^[A-Za-z]{6}$/.test(t)) return (t.slice(0, 3) + "/" + t.slice(3)).toUpperCase();
  return t.toUpperCase();
}

export function zahl(x: number | string | undefined | null, max = 2): string {
  const n = typeof x === "string" ? parseFloat(x) : x;
  if (n === undefined || n === null || !Number.isFinite(n)) return "?";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: max }).format(n);
}
export function preis(x: number | string | undefined | null): string {
  const n = typeof x === "string" ? parseFloat(x) : x;
  if (n === undefined || n === null || !Number.isFinite(n)) return "?";
  return zahl(n, Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 5);
}

/* ---------- Indikatoren (Reihen von alt nach neu) ---------- */
export function sma(werte: number[], n: number): number | null {
  if (werte.length < n) return null;
  return werte.slice(-n).reduce((a, b) => a + b, 0) / n;
}

export function rsi(closes: number[], n = 14): number | null {
  if (closes.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let ag = gain / n, al = loss / n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (n - 1) + Math.max(d, 0)) / n;
    al = (al * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

export function atr(h: number[], l: number[], c: number[], n = 14): number | null {
  if (c.length <= n) return null;
  const tr: number[] = [];
  for (let i = 1; i < c.length; i++) tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  let a = tr.slice(0, n).reduce((x, y) => x + y, 0) / n;
  for (let i = n; i < tr.length; i++) a = (a * (n - 1) + tr[i]) / n;
  return a;
}

/* ---------- Twelve Data ---------- */
export function tdFehlerText(d: any): string {
  const code = Number(d?.code);
  const msg = String(d?.message ?? "").slice(0, 200);
  if (code === 401) return "Der Twelve-Data-Schlüssel wird nicht akzeptiert. Prüfe TWELVEDATA_API_KEY in Cloudflare.";
  if (code === 429) return "Twelve Data: Abruflimit erreicht (im kostenlosen Tarif 8 pro Minute und 800 am Tag). Warte kurz.";
  if (code === 403 || /plan|upgrade|subscription/i.test(msg)) return "Dieser Wert gehört nicht zum Twelve-Data-Tarif: " + msg;
  if (code === 400 || code === 404) return "Twelve Data kennt das nicht (" + msg + "). Mit symbol_suche das richtige Symbol finden.";
  return "Twelve-Data-Fehler: " + (msg || "unbekannt");
}

/* ---------- Wirtschaftskalender (Forex-Factory-Feed) ---------- */
export type FFEvent = { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string };

export function wirkungText(i: string): string {
  const x = (i ?? "").toLowerCase();
  return x === "high" ? "hoch" : x === "medium" ? "mittel" : x === "low" ? "niedrig" : x === "holiday" ? "Feiertag" : i;
}

export function berlinTag(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZEITZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function filtereEvents(
  events: FFEvent[],
  o: { wirkung?: string; waehrung?: string; tag?: string; jetzt?: Date },
): FFEvent[] {
  const jetzt = o.jetzt ?? new Date();
  const w = (o.wirkung ?? "hoch").toLowerCase();
  const waehr = (o.waehrung ?? "").toUpperCase().split(/[,\s]+/).filter(Boolean);
  const heute = berlinTag(jetzt);
  const morgen = berlinTag(new Date(jetzt.getTime() + 24 * 3600 * 1000));
  return events
    .filter((e) => {
      const x = wirkungText(e.impact);
      if (w === "hoch" && x !== "hoch") return false;
      if (w === "mittel" && x !== "hoch" && x !== "mittel") return false;
      if (waehr.length && !waehr.includes(String(e.country).toUpperCase())) return false;
      const t = berlinTag(new Date(e.date));
      if (o.tag === "heute" && t !== heute) return false;
      if (o.tag === "morgen" && t !== morgen) return false;
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function eventZeile(e: FFEvent): string {
  const teile = [formatTermin({ dateTime: e.date }), e.country, "Wirkung " + wirkungText(e.impact), e.title];
  if (e.forecast) teile.push("Prognose " + e.forecast);
  if (e.previous) teile.push("Vorwert " + e.previous);
  return teile.join(" | ");
}

/* ---------- FRED ---------- */
export const FRED_ALIAS: Record<string, string> = {
  us10y: "DGS10", us2y: "DGS2", us30y: "DGS30", us10y2y: "T10Y2Y", spread: "T10Y2Y",
  leitzins: "FEDFUNDS", fedfunds: "FEDFUNDS", bund10y: "IRLTLT01DEM156N",
};
export function fredSerie(s: string): string {
  const t = String(s ?? "").trim();
  return FRED_ALIAS[t.toLowerCase().replace(/[\s-]/g, "")] ?? t.toUpperCase();
}
export function fredZeile(id: string, obs: { date: string; value: string }[]): string {
  const gueltig = obs.filter((o) => o.value !== "." && Number.isFinite(parseFloat(o.value)));
  if (!gueltig.length) return id + ": keine Werte.";
  const a = gueltig[0];
  const b = gueltig[1];
  return id + ": " + zahl(a.value, 3) + " (Stand " + a.date + ")" + (b ? ", davor " + zahl(b.value, 3) + " (" + b.date + ")" : "");
}
