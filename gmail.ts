import type { Env } from "./index.ts";
import { gfetch } from "./google.ts";
import { baueRohmail, entferneZitate, extrahiereText, kopfWert, textZuBase64Url } from "./gmaillib.ts";

const G = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX = 12; // wegen der 50-Abrufe-Grenze pro Anfrage

async function mailListe(env: Env, q: string, max: number): Promise<string> {
  const n = Math.max(1, Math.min(MAX, Math.round(max || 8)));
  const l = await gfetch(env, G + "/messages?maxResults=" + n + "&q=" + encodeURIComponent(q));
  const msgs: { id: string }[] = l.messages ?? [];
  if (!msgs.length) return "Keine Mails gefunden.";
  const meta = "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date";
  const details = await Promise.all(msgs.map((m) => gfetch(env, G + "/messages/" + m.id + meta)));
  return details
    .map((d) => {
      const h = d.payload?.headers;
      const ungelesen = (d.labelIds ?? []).includes("UNREAD") ? "ungelesen" : "gelesen";
      return [
        "thread " + d.threadId,
        "mail " + d.id,
        kopfWert(h, "Date").slice(0, 25),
        "Von: " + kopfWert(h, "From").slice(0, 80),
        "Betreff: " + kopfWert(h, "Subject").slice(0, 100),
        ungelesen,
        String(d.snippet ?? "").slice(0, 120),
      ].join(" | ");
    })
    .join("\n");
}

export const gmailWichtige = (env: Env, max?: number) =>
  mailListe(env, "in:inbox is:unread -category:promotions -category:social -category:updates -category:forums newer_than:14d", max ?? 8);
export const gmailNeue = (env: Env, max?: number) => mailListe(env, "in:inbox newer_than:1d", max ?? 8);
export function gmailSuchen(env: Env, suche: string, max?: number) {
  const hatZeit = /(newer_than|older_than|after|before):/i.test(suche);
  return mailListe(env, hatZeit ? suche : suche + " newer_than:30d", max ?? 8);
}

export async function gmailLesen(env: Env, threadId: string): Promise<string> {
  const t = await gfetch(env, G + "/threads/" + encodeURIComponent(threadId) + "?format=full");
  const msgs: any[] = (t.messages ?? []).slice(-4);
  if (!msgs.length) return "Verlauf ist leer.";
  return msgs
    .map((m) => {
      const h = m.payload?.headers;
      const text = entferneZitate(extrahiereText(m.payload)).slice(0, 1500);
      return ["Von: " + kopfWert(h, "From"), "Datum: " + kopfWert(h, "Date"), "Betreff: " + kopfWert(h, "Subject"), text || "(kein Text)"].join("\n");
    })
    .join("\n\n---\n\n");
}

export async function gmailEntwurf(env: Env, o: { thread_id?: string; text: string; an?: string; betreff?: string }): Promise<string> {
  if (!o.text?.trim()) return "Kein Text für den Entwurf.";
  let an = o.an ?? "";
  let betreff = o.betreff ?? "";
  let inReplyTo = "";
  let references = "";
  if (o.thread_id) {
    const t = await gfetch(
      env,
      G + "/threads/" + encodeURIComponent(o.thread_id) +
        "?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=References",
    );
    const letzte = (t.messages ?? []).slice(-1)[0];
    if (!letzte) return "Verlauf nicht gefunden.";
    const h = letzte.payload?.headers;
    const eigene = (await env.SPEICHER?.get("google:email")) ?? "";
    an = kopfWert(h, "Reply-To") || kopfWert(h, "From");
    if (eigene && an.toLowerCase().includes(eigene.toLowerCase())) an = kopfWert(h, "To");
    const s = kopfWert(h, "Subject");
    betreff = /^(re|aw):/i.test(s) ? s : "Re: " + s;
    inReplyTo = kopfWert(h, "Message-ID");
    references = (kopfWert(h, "References") + " " + inReplyTo).trim();
  }
  if (!an || !betreff) return "Für einen neuen Entwurf brauche ich Empfänger und Betreff.";
  const raw = textZuBase64Url(baueRohmail({ an, betreff, text: o.text, inReplyTo, references }));
  await gfetch(env, G + "/drafts", { method: "POST", body: { message: { raw, ...(o.thread_id ? { threadId: o.thread_id } : {}) } } });
  return "Entwurf liegt in Gmail unter Entwürfe (an " + an.slice(0, 80) + "). Nichts wurde gesendet.";
}

export async function labelId(env: Env, name: string): Promise<string> {
  const l = await gfetch(env, G + "/labels");
  const vorhanden = (l.labels ?? []).find((x: any) => x.name === name);
  if (vorhanden) return vorhanden.id;
  const neu = await gfetch(env, G + "/labels", { method: "POST", body: { name, labelListVisibility: "labelShow", messageListVisibility: "show" } });
  return neu.id;
}

export async function gmailSortieren(env: Env, o: { mail_ids: string[]; label?: string; archivieren?: boolean }): Promise<string> {
  const ids = (o.mail_ids ?? []).filter((x) => typeof x === "string" && x).slice(0, 25);
  if (!ids.length) return "Keine Mail-ids angegeben.";
  const add: string[] = [];
  if (o.label) add.push(await labelId(env, "Jarvis/" + o.label.replace(/^Jarvis\//, "").trim()));
  const remove = o.archivieren ? ["INBOX"] : [];
  if (!add.length && !remove.length) return "Weder Label noch Archivieren angegeben.";
  await gfetch(env, G + "/messages/batchModify", { method: "POST", body: { ids, addLabelIds: add, removeLabelIds: remove } });
  return ids.length + " Mail(s) sortiert" + (o.label ? " (Label Jarvis/" + o.label + ")" : "") + (o.archivieren ? ", archiviert" : "") + ".";
}
