import { ZEITZONE } from "./config.ts";

// "2026-10-06", "2026-10-06 12:00" oder "2026-10-06T12:00" -> "2026-10-06T12:00"
export function normalisiereLokal(s: string): string {
  const t = String(s ?? "").trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t + "T00:00";
  const m = t.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?/);
  if (!m) throw new Error("Zeit bitte im Format JJJJ-MM-TTTHH:MM angeben, zum Beispiel 2026-10-06T12:00.");
  return m[1];
}

export function offsetFuer(lokal: string, tz: string = ZEITZONE): string {
  const d = new Date(normalisiereLokal(lokal) + ":00Z");
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset", hour: "2-digit" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return "+00:00";
  return m[1] + m[2].padStart(2, "0") + ":" + (m[3] ?? "00");
}

export function lokalZuIso(lokal: string): string {
  const l = normalisiereLokal(lokal);
  return l + ":00" + offsetFuer(l);
}

export function addMinuten(lokal: string, minuten: number): string {
  const l = normalisiereLokal(lokal);
  const d = new Date(l + ":00Z");
  d.setUTCMinutes(d.getUTCMinutes() + minuten);
  return d.toISOString().slice(0, 16);
}

const tag = new Intl.DateTimeFormat("de-DE", { timeZone: ZEITZONE, weekday: "short", day: "2-digit", month: "2-digit" });
const uhr = new Intl.DateTimeFormat("de-DE", { timeZone: ZEITZONE, hour: "2-digit", minute: "2-digit" });

export function formatTermin(start: { dateTime?: string; date?: string }, end?: { dateTime?: string; date?: string }): string {
  if (start?.date) return tag.format(new Date(start.date + "T12:00:00Z")) + " ganztägig";
  if (!start?.dateTime) return "?";
  const s = new Date(start.dateTime);
  let t = tag.format(s) + " " + uhr.format(s);
  if (end?.dateTime) t += "–" + uhr.format(new Date(end.dateTime));
  return t;
}
