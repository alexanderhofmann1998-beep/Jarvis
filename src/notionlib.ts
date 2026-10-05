// Reine Hilfsfunktionen fuer Notion (ohne Netzwerk, gut testbar)

// Zieht die 32-stellige ID aus einem Notion-Link (oder nimmt eine ID unveraendert)
export function extrahiereId(s: string): string | null {
  const m = s.replace(/-/g, "").match(/[0-9a-f]{32}(?![0-9a-f])/i);
  return m ? m[0].toLowerCase() : null;
}

export function notionFehlerText(status: number, data: any): string {
  const code = data?.code;
  if (code === "object_not_found") {
    return "Jarvis darf diese Seite nicht sehen: in Notion unter ••• Verbindungen Jarvis hinzufügen.";
  }
  if (status === 401) return "Der Notion-Token wird nicht akzeptiert. Prüfe NOTION_TOKEN in Cloudflare.";
  if (status === 429) return "Notion ist gerade ausgelastet. Versuch es gleich noch mal.";
  if (code === "validation_error") return "Notion lehnt die Eingabe ab: " + String(data?.message ?? "").slice(0, 200);
  return "Notion-Fehler: " + String(data?.message ?? status).slice(0, 200);
}

export function richText(arr: any[] | undefined): string {
  return (arr ?? []).map((t) => t?.plain_text ?? "").join("");
}

export function blocksZuText(blocks: any[]): string {
  const zeilen: string[] = [];
  for (const b of blocks ?? []) {
    const typ = b?.type;
    if (!typ || typ === "child_database" || typ === "child_page") continue;
    const text = richText(b[typ]?.rich_text).trim();
    if (!text) continue;
    if (typ === "bulleted_list_item" || typ === "numbered_list_item") zeilen.push("- " + text);
    else if (typ === "to_do") zeilen.push((b[typ].checked ? "- [x] " : "- [ ] ") + text);
    else if (typ.startsWith("heading")) zeilen.push("## " + text);
    else zeilen.push(text);
  }
  return zeilen.join("\n");
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function zuZahl(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return undefined;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export function zuNotionWert(typ: string, v: unknown): unknown | undefined {
  const text = String(v ?? "");
  switch (typ) {
    case "title": return { title: [{ text: { content: text.slice(0, 2000) } }] };
    case "rich_text": return { rich_text: [{ text: { content: text.slice(0, 2000) } }] };
    case "number": { const n = zuZahl(v); return n === undefined ? undefined : { number: n }; }
    case "select": return text ? { select: { name: text.replace(/,/g, " ").slice(0, 100) } } : undefined;
    case "url": return text ? { url: text } : undefined;
    case "checkbox": return { checkbox: v === true || /^(ja|true|1)$/i.test(text) };
    case "date": return text ? { date: { start: text } } : undefined;
    default: return undefined;
  }
}

export function leseWert(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title": return richText(prop.title);
    case "rich_text": return richText(prop.rich_text);
    case "number": return prop.number === null || prop.number === undefined ? "" : String(prop.number);
    case "select": return prop.select?.name ?? "";
    case "url": return prop.url ?? "";
    case "checkbox": return prop.checkbox ? "ja" : "nein";
    case "date": return prop.date?.start ?? "";
    default: return "";
  }
}

// Ordnet die Spaltennamen des Nutzers den echten Spalten der Datenbank zu (nie raten)
export function baueProps(schema: Record<string, { type: string }>, felder: Record<string, unknown>) {
  const props: Record<string, unknown> = {};
  const unbekannt: string[] = [];
  const namen = Object.keys(schema);
  for (const [key, wert] of Object.entries(felder ?? {})) {
    const k = norm(key);
    let ziel = namen.find((n) => norm(n) === k);
    if (!ziel && k) {
      const treffer = namen.filter((n) => norm(n).startsWith(k));
      if (treffer.length === 1) ziel = treffer[0];
    }
    if (!ziel) { unbekannt.push(key); continue; }
    const v = zuNotionWert(schema[ziel].type, wert);
    if (v === undefined) { unbekannt.push(key + " (Wert passt nicht)"); continue; }
    props[ziel] = v;
  }
  return { props, unbekannt };
}
