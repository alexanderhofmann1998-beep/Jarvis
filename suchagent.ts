import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./index.ts";
import { MODELL_SORTIEREN } from "./config.ts";
import { schreibeBericht } from "./berichte.ts";
import { gfetch, googleStatus } from "./google.ts";
import { labelId } from "./gmail.ts";
import { findeTeil, kopfWert } from "./gmaillib.ts";
import { zeilenAnlegen } from "./notion.ts";
import { FUNDE } from "./listen.ts";
import { ladeAbsender, ladeProfil } from "./suchprofil.ts";
import { baueQuery, fundId, fundZuFelder, htmlMitLinks, mergeGesehen, parseFunde, type Fund } from "./suchlib.ts";

const G = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_MAILS = 3; // wegen der 50-Abrufe-Grenze pro Lauf
const MAX_FUNDE = 12;

const SYSTEM = [
  "Du liest eine Benachrichtigungs-Mail eines Immobilienportals (Suchauftrag), holst die einzelnen Inserate heraus und bewertest jedes nach dem Suchprofil.",
  "Antworte ausschließlich mit einem JSON-Array, ohne Text davor oder danach. Eine Mail ohne Inserate ergibt [].",
  "Pro Inserat ein Objekt: {\"titel\": string, \"ort\": string, \"preis\": Zahl in Euro oder null, \"flaeche\": Zahl in m² oder null, \"link\": vollständige URL des Inserats oder null, \"portal\": string, \"bewertung\": \"Top\" | \"Gut\" | \"Prüfen\" | \"Verwerfen\", \"grund\": ein kurzer Satz}.",
  "Erfinde nichts. Fehlende Angaben sind null. Lage, Uni, Arbeitgeber oder Bevölkerungswachstum bewertest du nur, wenn Angaben im Text stehen.",
  "Ohne Suchprofil lautet jede Bewertung \"Prüfen\".",
].join("\n");

async function bewerte(client: Anthropic, mailText: string, profil: string): Promise<Fund[]> {
  const r = await client.messages.create({
    model: MODELL_SORTIEREN,
    max_tokens: 2500,
    system: SYSTEM,
    messages: [{ role: "user", content: "Suchprofil:\n" + (profil.trim() || "(keines)") + "\n\nMail:\n" + mailText.slice(0, 8000) }],
  });
  const text = (r.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("");
  return parseFunde(text, !profil.trim());
}

async function lauf(env: Env): Promise<string> {
  const g = await googleStatus(env);
  if (!g.verbunden) return "Google ist nicht verbunden.";
  if (!env.ANTHROPIC_API_KEY) return "Anthropic-Schlüssel fehlt.";

  const absender = await ladeAbsender(env);
  const liste = await gfetch(env, G + "/messages?maxResults=" + MAX_MAILS + "&q=" + encodeURIComponent(baueQuery(absender)));
  const ids: string[] = (liste.messages ?? []).map((m: any) => m.id);
  if (!ids.length) return "Keine neuen Portal-Mails.";

  const profil = await ladeProfil(env);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const gesehen: string[] = JSON.parse((await env.SPEICHER?.get("funde:gesehen")) ?? "[]");
  const neuGesehen: string[] = [];
  const verarbeitet: string[] = [];
  const schreiben: Fund[] = [];
  let verworfen = 0;

  for (const id of ids) {
    const m = await gfetch(env, G + "/messages/" + id + "?format=full");
    const html = findeTeil(m.payload, "text/html");
    const text = html ? htmlMitLinks(html) : findeTeil(m.payload, "text/plain");
    const kopf = "Von: " + kopfWert(m.payload?.headers, "From") + "\nBetreff: " + kopfWert(m.payload?.headers, "Subject") + "\n\n";
    const funde = await bewerte(client, kopf + text, profil);
    const neue: Fund[] = [];
    for (const f of funde) {
      const fid = await fundId(f);
      if (gesehen.includes(fid) || neuGesehen.includes(fid)) continue;
      if (f.bewertung === "Verwerfen") { neuGesehen.push(fid); verworfen++; continue; }
      neue.push(f);
    }
    const platz = MAX_FUNDE - schreiben.length;
    const nimm = neue.slice(0, Math.max(0, platz));
    for (const f of nimm) { schreiben.push(f); neuGesehen.push(await fundId(f)); }
    if (nimm.length < neue.length) break; // Rest beim nächsten Lauf, Mail bleibt unmarkiert
    verarbeitet.push(id);
  }

  // Erst in Notion ablegen, dann die Mails als verarbeitet markieren
  const datum = new Date().toISOString().slice(0, 10);
  const angelegt = await zeilenAnlegen(env, FUNDE, schreiben.map((f) => fundZuFelder(f, datum)));
  if (verarbeitet.length) {
    const lid = await labelId(env, "Jarvis/Verarbeitet");
    await gfetch(env, G + "/messages/batchModify", { method: "POST", body: { ids: verarbeitet, addLabelIds: [lid], removeLabelIds: [] } });
  }
  await env.SPEICHER?.put("funde:gesehen", JSON.stringify(mergeGesehen(gesehen, neuGesehen)));

  const tops = schreiben.filter((f) => f.bewertung === "Top");
  if (tops.length) {
    await schreibeBericht(env, {
      titel: tops.length + " neue Top-Funde",
      kurz: tops.slice(0, 3).map((f) => f.titel + (f.ort ? " in " + f.ort : "")).join(", ") + ".",
      text: tops.map((f) => f.titel + " | " + f.ort + " | " + (f.preis ?? "?") + " Euro | " + f.grund + " | " + (f.link ?? "")).join("\n"),
    });
  }
  return verarbeitet.length + " Mail(s) gelesen, " + angelegt + " Funde in Notion, " + verworfen + " verworfen, " + tops.length + " Top." +
    (profil.trim() ? "" : " (Kein Suchprofil: alles ist Prüfen.)");
}

export async function suchagentLauf(env: Env): Promise<string> {
  if (!env.SPEICHER) return "Kein Speicher.";
  if (await env.SPEICHER.get("lock:suchagent")) return "Der Such-Agent läuft gerade schon.";
  await env.SPEICHER.put("lock:suchagent", "1", { expirationTtl: 900 });
  let ergebnis: string;
  try {
    ergebnis = await lauf(env);
  } catch (e) {
    ergebnis = "Fehler: " + (e instanceof Error ? e.message : String(e)).slice(0, 300);
  } finally {
    await env.SPEICHER.delete("lock:suchagent");
  }
  await env.SPEICHER.put("suchagent:letzter", JSON.stringify({ zeit: new Date().toISOString(), ergebnis }));
  return ergebnis;
}
