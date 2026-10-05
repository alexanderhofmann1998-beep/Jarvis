// Reine Hilfsfunktionen fuer Gmail (ohne Netzwerk, gut testbar)

export function bytesZuBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function textZuBase64Url(text: string): string {
  return bytesZuBase64(new TextEncoder().encode(text)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function base64UrlZuText(s: string): string {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function kodiereBetreff(s: string): string {
  const einzeilig = s.replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7e]*$/.test(einzeilig)) return einzeilig;
  return "=?UTF-8?B?" + bytesZuBase64(new TextEncoder().encode(einzeilig)) + "?=";
}

export function baueRohmail(o: { an: string; betreff: string; text: string; inReplyTo?: string; references?: string }): string {
  const body = bytesZuBase64(new TextEncoder().encode(o.text)).replace(/(.{76})/g, "$1\r\n");
  const kopf = [
    "To: " + o.an.replace(/[\r\n]+/g, " "),
    "Subject: " + kodiereBetreff(o.betreff),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  if (o.inReplyTo) kopf.push("In-Reply-To: " + o.inReplyTo.replace(/[\r\n]+/g, " "));
  if (o.references) kopf.push("References: " + o.references.replace(/[\r\n]+/g, " "));
  return kopf.join("\r\n") + "\r\n\r\n" + body;
}

export function kopfWert(headers: { name: string; value: string }[] | undefined, name: string): string {
  const h = (headers ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

export function htmlZuText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Entfernt alte Zitate und Signaturen
export function entferneZitate(text: string): string {
  const zeilen = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const z of zeilen) {
    if (/^(Am .{5,120} schrieb .*:?|On .{5,120} wrote:?|-----\s?(Original|Ursprüngliche)|Von: .*|From: .*)$/i.test(z.trim()) && out.length) break;
    if (z.trim() === "--" || z === "-- ") break;
    if (z.trim().startsWith(">")) continue;
    out.push(z);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function extrahiereText(payload: any): string {
  if (!payload) return "";
  const finde = (p: any, typ: string): string => {
    if (p?.mimeType === typ && p.body?.data) return base64UrlZuText(p.body.data);
    for (const teil of p?.parts ?? []) {
      const r = finde(teil, typ);
      if (r) return r;
    }
    return "";
  };
  const plain = finde(payload, "text/plain");
  if (plain.trim()) return plain;
  const html = finde(payload, "text/html");
  return html ? htmlZuText(html) : "";
}

// Sucht in einer Gmail-Nachricht den ersten Teil mit dem gewünschten Typ (text/plain oder text/html)
export function findeTeil(payload: any, typ: string): string {
  if (payload?.mimeType === typ && payload.body?.data) return base64UrlZuText(payload.body.data);
  for (const t of payload?.parts ?? []) {
    const r = findeTeil(t, typ);
    if (r) return r;
  }
  return "";
}
