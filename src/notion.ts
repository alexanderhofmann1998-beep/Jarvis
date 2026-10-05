import type { Env } from "./index.ts";
import type { ListenDef } from "./listen.ts";
import { baueProps, blocksZuText, extrahiereId, leseWert, notionFehlerText } from "./notionlib.ts";

const VERSION = "2022-06-28";

export class NotionFehler extends Error {}

async function api(env: Env, method: string, pfad: string, body?: unknown): Promise<any> {
  if (!env.NOTION_TOKEN) throw new NotionFehler("Notion ist nicht eingerichtet. Lege NOTION_TOKEN in Cloudflare an.");
  const r = await fetch("https://api.notion.com/v1" + pfad, {
    method,
    headers: {
      Authorization: "Bearer " + env.NOTION_TOKEN,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new NotionFehler(notionFehlerText(r.status, data));
  return data;
}

export function wissenSeitenId(env: Env): string {
  const id = extrahiereId(env.NOTION_WISSEN_ID ?? "");
  if (!id) throw new NotionFehler("NOTION_WISSEN_ID fehlt oder ist ungültig.");
  return id;
}

/* ---------- Wissen ---------- */
export async function ladeWissen(env: Env): Promise<string> {
  const cached = await env.SPEICHER?.get("wissen:text");
  if (cached !== null && cached !== undefined) return cached;
  const id = wissenSeitenId(env);
  let blocks: any[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 3; i++) {
    const d = await api(env, "GET", "/blocks/" + id + "/children?page_size=100" + (cursor ? "&start_cursor=" + cursor : ""));
    blocks = blocks.concat(d.results ?? []);
    if (!d.has_more) break;
    cursor = d.next_cursor;
  }
  const text = blocksZuText(blocks).slice(0, 6000);
  await env.SPEICHER?.put("wissen:text", text, { expirationTtl: 3600 });
  return text;
}

export async function merke(env: Env, fakt: string): Promise<void> {
  await api(env, "PATCH", "/blocks/" + wissenSeitenId(env) + "/children", {
    children: [{ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: fakt.slice(0, 1900) } }] } }],
  });
  await env.SPEICHER?.delete("wissen:text");
}

/* ---------- Datenbanken ---------- */
export async function datenbankId(env: Env, def: ListenDef): Promise<string> {
  const k = "notion:db:" + def.key;
  const vorhanden = await env.SPEICHER?.get(k);
  if (vorhanden) return vorhanden;
  const d = await api(env, "POST", "/databases", {
    parent: { type: "page_id", page_id: wissenSeitenId(env) },
    title: [{ type: "text", text: { content: def.titel } }],
    properties: def.properties,
  });
  await env.SPEICHER?.put(k, d.id);
  return d.id;
}

async function schemaVon(env: Env, id: string): Promise<{ schema: Record<string, { type: string }>; titel: string }> {
  const d = await api(env, "GET", "/databases/" + id);
  const schema: Record<string, { type: string }> = {};
  let titel = "";
  for (const [name, p] of Object.entries<any>(d.properties ?? {})) {
    schema[name] = { type: p.type };
    if (p.type === "title") titel = name;
  }
  return { schema, titel };
}

export async function zeileAnlegen(env: Env, def: ListenDef, felder: Record<string, unknown>): Promise<string> {
  const id = await datenbankId(env, def);
  const { schema } = await schemaVon(env, id);
  const { props, unbekannt } = baueProps(schema, felder);
  if (!Object.keys(props).length) {
    return "Nichts angelegt: keine passende Spalte. Gültige Spalten: " + Object.keys(schema).join(", ");
  }
  const seite = await api(env, "POST", "/pages", { parent: { database_id: id }, properties: props });
  return "Angelegt (id " + seite.id + ")." + (unbekannt.length ? " Nicht übernommen: " + unbekannt.join(", ") + "." : "");
}

export async function zeilenSuchen(
  env: Env,
  def: ListenDef,
  opts: { text?: string; spalte?: string; wert?: string },
): Promise<string> {
  const id = await datenbankId(env, def);
  const { schema, titel } = await schemaVon(env, id);
  let filter: unknown;
  if (opts.spalte && opts.wert) {
    const { props } = baueProps(schema, { [opts.spalte]: opts.wert });
    const name = Object.keys(props)[0];
    if (name) {
      const typ = schema[name].type;
      if (typ === "select") filter = { property: name, select: { equals: opts.wert } };
      else if (typ === "rich_text") filter = { property: name, rich_text: { contains: opts.wert } };
      else if (typ === "title") filter = { property: name, title: { contains: opts.wert } };
    }
  } else if (opts.text) {
    filter = { property: titel, title: { contains: opts.text } };
  }
  const d = await api(env, "POST", "/databases/" + id + "/query", { page_size: 10, ...(filter ? { filter } : {}) });
  const zeilen: string[] = [];
  for (const p of d.results ?? []) {
    const teile: string[] = [];
    for (const [name, prop] of Object.entries<any>(p.properties ?? {})) {
      const w = leseWert(prop);
      if (w) teile.push(name + ": " + w.slice(0, 120));
    }
    zeilen.push("id " + p.id + " | " + teile.join(" | "));
  }
  return zeilen.length ? zeilen.join("\n") : "Keine Einträge gefunden.";
}

export async function zeileAendern(env: Env, def: ListenDef, idOderLink: string, felder: Record<string, unknown>): Promise<string> {
  const seitenId = extrahiereId(idOderLink);
  if (!seitenId) return "Ungültige id. Erst suchen, dann ändern.";
  const dbId = await datenbankId(env, def);
  const { schema } = await schemaVon(env, dbId);
  const { props, unbekannt } = baueProps(schema, felder);
  if (!Object.keys(props).length) return "Nichts geändert: keine passende Spalte. Gültige Spalten: " + Object.keys(schema).join(", ");
  await api(env, "PATCH", "/pages/" + seitenId, { properties: props });
  return "Geändert." + (unbekannt.length ? " Nicht übernommen: " + unbekannt.join(", ") + "." : "");
}

/* ---------- Protokoll (laeuft im Hintergrund, darf nie das Gespraech stoeren) ---------- */
export async function protokolliere(
  env: Env,
  e: { befehl: string; antwort: string; quelle: "App" | "Siri" | "Hintergrund"; erfolg: boolean },
): Promise<void> {
  try {
    const { PROTOKOLL } = await import("./listen.ts");
    const id = await datenbankId(env, PROTOKOLL);
    await api(env, "POST", "/pages", {
      parent: { database_id: id },
      properties: {
        Befehl: { title: [{ text: { content: e.befehl.slice(0, 300) } }] },
        Antwort: { rich_text: [{ text: { content: e.antwort.slice(0, 1900) } }] },
        Quelle: { select: { name: e.quelle } },
        Erfolg: { checkbox: e.erfolg },
        Zeit: { date: { start: new Date().toISOString() } },
      },
    });
  } catch {
    // Protokoll ist Zusatz, Fehler hier bleiben still
  }
}
