import type { Env } from "./index.ts";
import {
  WATCHLIST, atr, eventZeile, filtereEvents, fredSerie, fredZeile, normalisiereSymbol, preis, rsi, sma, tdFehlerText, zahl, type FFEvent,
} from "./marktlib.ts";

export class MarktFehler extends Error {}

/* ---------- Twelve Data ---------- */
async function td(env: Env, pfad: string, params: Record<string, string>): Promise<any> {
  if (!env.TWELVEDATA_API_KEY) throw new MarktFehler("Twelve Data ist nicht eingerichtet. Lege TWELVEDATA_API_KEY in Cloudflare an.");
  const r = await fetch("https://api.twelvedata.com/" + pfad + "?" + new URLSearchParams({ ...params, apikey: env.TWELVEDATA_API_KEY }).toString());
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok || d?.status === "error" || d?.code) throw new MarktFehler(tdFehlerText(d));
  return d;
}

export async function kursAbrufen(env: Env, symbole: string[]): Promise<string> {
  const liste = [...new Set((symbole ?? []).map(normalisiereSymbol))].slice(0, 6);
  if (!liste.length) return "Kein Symbol angegeben.";
  const zeilen = await Promise.all(
    liste.map(async (s) => {
      try {
        const q = await td(env, "quote", { symbol: s });
        const pct = parseFloat(q.percent_change);
        return [
          s + (q.name ? " (" + q.name + ")" : ""),
          "Kurs " + preis(q.close),
          "Veränderung " + (pct >= 0 ? "+" : "") + zahl(pct, 2) + " Prozent",
          "Hoch " + preis(q.high),
          "Tief " + preis(q.low),
          "Stand " + String(q.datetime ?? "?") + (q.is_market_open === false ? " (Markt geschlossen)" : ""),
        ].join(" | ");
      } catch (e) {
        return s + ": " + (e instanceof Error ? e.message : String(e));
      }
    }),
  );
  return zeilen.join("\n");
}

export async function indikatoren(env: Env, symbol: string, intervall?: string): Promise<string> {
  const s = normalisiereSymbol(symbol);
  const iv = ["15min", "30min", "1h", "4h", "1day", "1week"].includes(intervall ?? "") ? intervall! : "1day";
  const d = await td(env, "time_series", { symbol: s, interval: iv, outputsize: "260" });
  const v: any[] = [...(d.values ?? [])].reverse(); // alt nach neu
  if (v.length < 20) return s + ": zu wenig Kursdaten für Indikatoren.";
  const c = v.map((x) => parseFloat(x.close));
  const h = v.map((x) => parseFloat(x.high));
  const l = v.map((x) => parseFloat(x.low));
  const letzte = c[c.length - 1];
  const aenderung = (n: number) => (c.length > n ? ((letzte / c[c.length - 1 - n] - 1) * 100) : null);
  const teil = (name: string, x: number | null, f: (n: number) => string = (n) => preis(n)) => (x === null ? name + " ?" : name + " " + f(x));
  const sma20 = sma(c, 20), sma50 = sma(c, 50), sma200 = sma(c, 200);
  const r = rsi(c, 14);
  const a = atr(h, l, c, 14);
  const fenster = c.slice(-20);
  const hoch20 = Math.max(...h.slice(-20)), tief20 = Math.min(...l.slice(-20));
  const trend =
    sma50 !== null && sma200 !== null ? (letzte > sma50 && sma50 > sma200 ? "Aufwärtstrend (Kurs über SMA 50 über SMA 200)" : letzte < sma50 && sma50 < sma200 ? "Abwärtstrend (Kurs unter SMA 50 unter SMA 200)" : "gemischt") : "Trend unklar (zu wenig Daten für SMA 200)";
  void fenster;
  return [
    s + " (" + iv + ", " + c.length + " Kerzen bis " + v[v.length - 1].datetime + ")",
    "Letzter Kurs " + preis(letzte),
    teil("Veränderung 1 Kerze Prozent", aenderung(1), (n) => zahl(n, 2)) + " | " + teil("5 Kerzen Prozent", aenderung(5), (n) => zahl(n, 2)) + " | " + teil("20 Kerzen Prozent", aenderung(20), (n) => zahl(n, 2)),
    teil("RSI 14", r, (n) => zahl(n, 1)) + (r !== null ? (r >= 70 ? " (überkauft)" : r <= 30 ? " (überverkauft)" : " (neutral)") : ""),
    teil("SMA 20", sma20) + " | " + teil("SMA 50", sma50) + " | " + teil("SMA 200", sma200),
    teil("ATR 14", a) + " | Spanne letzte 20 Kerzen: Tief " + preis(tief20) + " bis Hoch " + preis(hoch20),
    "Trend: " + trend,
  ].join("\n");
}

export async function symbolSuche(env: Env, suche: string): Promise<string> {
  const d = await td(env, "symbol_search", { symbol: suche, outputsize: "8" });
  const z = (d.data ?? []).slice(0, 8).map((x: any) => [x.symbol, x.instrument_name, x.instrument_type, x.exchange].filter(Boolean).join(" | "));
  return z.length ? z.join("\n") : "Nichts gefunden.";
}

/* ---------- Wirtschaftskalender (inoffizieller Forex-Factory-Feed) ---------- */
async function ffLaden(env: Env, woche: "diese" | "naechste"): Promise<FFEvent[]> {
  const k = "ff:" + woche;
  const cached = await env.SPEICHER?.get(k);
  if (cached) {
    try { return JSON.parse(cached) as FFEvent[]; } catch { /* neu laden */ }
  }
  const url = "https://nfs.faireconomy.media/ff_calendar_" + (woche === "diese" ? "thisweek" : "nextweek") + ".json";
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Jarvis)" } });
  if (!r.ok) throw new MarktFehler("Der Wirtschaftskalender ist gerade nicht erreichbar (inoffizielle Quelle, Status " + r.status + ").");
  const d = (await r.json().catch(() => null)) as FFEvent[] | null;
  if (!Array.isArray(d)) throw new MarktFehler("Der Wirtschaftskalender lieferte unerwartete Daten.");
  await env.SPEICHER?.put(k, JSON.stringify(d), { expirationTtl: 3600 });
  return d;
}

export async function wirtschaftskalender(
  env: Env,
  o: { wirkung?: string; waehrung?: string; tag?: string; woche?: string },
): Promise<string> {
  const woche = o.woche === "naechste" ? "naechste" : "diese";
  const ev = filtereEvents(await ffLaden(env, woche), { wirkung: o.wirkung, waehrung: o.waehrung, tag: o.tag });
  if (!ev.length) return "Keine passenden Termine.";
  return ev.slice(0, 25).map(eventZeile).join("\n") + "\n(Quelle: inoffizieller Forex-Factory-Feed, nur Prognose und Vorwert, keine Ist-Werte)";
}

/* ---------- FRED ---------- */
export async function zinsen(env: Env, serien: string[]): Promise<string> {
  if (!env.FRED_API_KEY) return "FRED ist nicht eingerichtet. Kostenlosen Schlüssel auf fred.stlouisfed.org holen und als FRED_API_KEY in Cloudflare anlegen.";
  const ids = [...new Set((serien ?? []).map(fredSerie))].slice(0, 5);
  if (!ids.length) return "Keine Serie angegeben.";
  const z = await Promise.all(
    ids.map(async (id) => {
      try {
        const p = new URLSearchParams({ series_id: id, api_key: env.FRED_API_KEY!, file_type: "json", sort_order: "desc", limit: "6" });
        const r = await fetch("https://api.stlouisfed.org/fred/series/observations?" + p.toString());
        const d: any = await r.json().catch(() => ({}));
        if (!r.ok) return id + ": FRED-Fehler " + r.status + " " + String(d?.error_message ?? "").slice(0, 100);
        return fredZeile(id, d.observations ?? []);
      } catch {
        return id + ": nicht erreichbar.";
      }
    }),
  );
  return z.join("\n");
}

/* ---------- Lagebild ---------- */
export async function lagebildDaten(env: Env): Promise<string> {
  const [k, c, z] = await Promise.allSettled([
    kursAbrufen(env, WATCHLIST),
    wirtschaftskalender(env, { wirkung: "hoch", tag: "heute" }),
    zinsen(env, ["us10y", "us2y", "us10y2y"]),
  ]);
  const t = (x: PromiseSettledResult<string>) => (x.status === "fulfilled" ? x.value : "Fehler: " + (x.reason instanceof Error ? x.reason.message : String(x.reason)));
  return ["KURSE", t(k), "", "WICHTIGE TERMINE HEUTE", t(c), "", "ZINSEN USA", t(z)].join("\n");
}
