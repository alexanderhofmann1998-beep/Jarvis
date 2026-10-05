import type { Env } from "./index.ts";
import { ZEITZONE } from "./config.ts";
import { gfetch } from "./google.ts";
import { addMinuten, formatTermin, lokalZuIso, normalisiereLokal } from "./zeitlib.ts";

const C = "https://www.googleapis.com/calendar/v3";

type Kal = { id: string; name: string };

async function kalender(env: Env): Promise<Kal[]> {
  const d = await gfetch(env, C + "/users/me/calendarList?minAccessRole=reader&maxResults=20");
  return (d.items ?? [])
    .filter((i: any) => i.selected !== false && !i.deleted)
    .slice(0, 8)
    .map((i: any) => ({ id: i.id, name: i.summaryOverride ?? i.summary ?? i.id }));
}

function ereignisZeile(e: any, kal?: string): string {
  const teile = ["id " + e.id, formatTermin(e.start, e.end), e.summary ?? "(ohne Titel)"];
  if (e.location) teile.push("Ort: " + String(e.location).slice(0, 80));
  if (kal) teile.push("Kalender: " + kal);
  if (e.recurringEventId) teile.push("Serientermin");
  return teile.join(" | ");
}

async function ereignisse(env: Env, kalId: string, von: string, bis: string, q?: string): Promise<any[]> {
  const p = new URLSearchParams({ timeMin: lokalZuIso(von), timeMax: lokalZuIso(bis), singleEvents: "true", orderBy: "startTime", maxResults: "50" });
  if (q) p.set("q", q);
  const d = await gfetch(env, C + "/calendars/" + encodeURIComponent(kalId) + "/events?" + p.toString());
  return d.items ?? [];
}

export async function termineAbrufen(env: Env, von: string, bis?: string): Promise<string> {
  const v = normalisiereLokal(von);
  let b: string;
  if (!bis) b = addMinuten(v, 24 * 60);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(bis.trim())) b = normalisiereLokal(bis.trim() + "T23:59");
  else b = normalisiereLokal(bis);
  const kals = await kalender(env);
  const listen = await Promise.all(kals.map(async (k) => (await ereignisse(env, k.id, v, b)).map((e) => ({ e, k: k.name }))));
  const alle = listen.flat().sort((x, y) => (x.e.start?.dateTime ?? x.e.start?.date ?? "").localeCompare(y.e.start?.dateTime ?? y.e.start?.date ?? ""));
  if (!alle.length) return "Keine Termine in diesem Zeitraum.";
  return alle.slice(0, 30).map((x) => ereignisZeile(x.e, kals.length > 1 ? x.k : undefined)).join("\n");
}

export async function terminEintragen(
  env: Env,
  o: { titel: string; start: string; ende?: string; ort?: string; notiz?: string; erinnerung_min?: number },
): Promise<string> {
  const start = normalisiereLokal(o.start);
  const ende = o.ende ? normalisiereLokal(o.ende) : addMinuten(start, 60);
  // Nie doppelt eintragen
  const tagStart = start.slice(0, 10) + "T00:00";
  const vorhanden = await ereignisse(env, "primary", tagStart, addMinuten(tagStart, 24 * 60), o.titel);
  const gleich = vorhanden.find(
    (e) => e.start?.dateTime && new Date(e.start.dateTime).getTime() === new Date(lokalZuIso(start)).getTime() && String(e.summary ?? "").toLowerCase() === o.titel.trim().toLowerCase(),
  );
  if (gleich) return "Den Termin gibt es schon: " + ereignisZeile(gleich);
  const body: any = {
    summary: o.titel.trim(),
    start: { dateTime: start + ":00", timeZone: ZEITZONE },
    end: { dateTime: ende + ":00", timeZone: ZEITZONE },
  };
  if (o.ort) body.location = o.ort;
  if (o.notiz) body.description = o.notiz;
  if (o.erinnerung_min) body.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: Math.round(o.erinnerung_min) }] };
  const e = await gfetch(env, C + "/calendars/primary/events", { method: "POST", body });
  return "Eingetragen: " + ereignisZeile(e);
}

export async function terminVerschieben(
  env: Env,
  o: { suche?: string; tag?: string; id?: string; neuer_start: string; neues_ende?: string },
): Promise<string> {
  const neuStart = normalisiereLokal(o.neuer_start);
  let ziel: any;
  if (o.id) {
    ziel = await gfetch(env, C + "/calendars/primary/events/" + encodeURIComponent(o.id));
  } else {
    if (!o.suche) return "Sag mir, welchen Termin du meinst (Stichwort im Titel).";
    const von = o.tag ? normalisiereLokal(o.tag.slice(0, 10)) : normalisiereLokal(new Date().toISOString().slice(0, 10));
    const bis = o.tag ? addMinuten(von, 24 * 60) : addMinuten(von, 60 * 24 * 60);
    const treffer = (await ereignisse(env, "primary", von, bis, o.suche)).filter((e) => e.status !== "cancelled");
    if (!treffer.length) return "Keinen passenden Termin gefunden.";
    const einzel = treffer.filter((e) => !e.recurringEventId);
    if (!einzel.length) return "Das ist ein Serientermin. Den ändere bitte selbst im Kalender.";
    if (einzel.length > 1) return "Mehrere Termine passen, frag Alex welcher gemeint ist (dann mit id nochmal):\n" + einzel.slice(0, 6).map((e) => ereignisZeile(e)).join("\n");
    ziel = einzel[0];
  }
  if (ziel.recurringEventId || ziel.recurrence) return "Das ist ein Serientermin. Den ändere bitte selbst im Kalender.";
  if (!ziel.start?.dateTime) return "Das ist ein ganztägiger Termin. Den ändere bitte selbst.";
  const dauerMin = Math.max(15, Math.round((new Date(ziel.end.dateTime).getTime() - new Date(ziel.start.dateTime).getTime()) / 60000));
  const neuEnde = o.neues_ende ? normalisiereLokal(o.neues_ende) : addMinuten(neuStart, dauerMin);
  const e = await gfetch(env, C + "/calendars/primary/events/" + encodeURIComponent(ziel.id), {
    method: "PATCH",
    body: { start: { dateTime: neuStart + ":00", timeZone: ZEITZONE }, end: { dateTime: neuEnde + ":00", timeZone: ZEITZONE } },
  });
  return "Verschoben: " + ereignisZeile(e);
}
