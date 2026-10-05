import { test } from "node:test";
import assert from "node:assert/strict";
import { addMinuten, formatTermin, lokalZuIso, normalisiereLokal, offsetFuer } from "../src/zeitlib.ts";
import { baueRohmail, base64UrlZuText, entferneZitate, extrahiereText, htmlZuText, kodiereBetreff, kopfWert, textZuBase64Url } from "../src/gmaillib.ts";
import { googleFehlerText } from "../src/google.ts";
import { EINRICHTEN_HTML } from "../src/einrichten.ts";
import { WERKZEUGE } from "../src/tools.ts";
import { APP_HTML } from "../src/app.ts";

test("Zeit: Sommer- und Winterzeit", () => {
  assert.equal(offsetFuer("2026-10-06T12:00"), "+02:00");
  assert.equal(offsetFuer("2026-12-01T12:00"), "+01:00");
  assert.equal(lokalZuIso("2026-10-06 12:00"), "2026-10-06T12:00:00+02:00");
  assert.equal(normalisiereLokal("2026-10-06"), "2026-10-06T00:00");
  assert.throws(() => normalisiereLokal("morgen um 12"));
  assert.equal(addMinuten("2026-10-06T23:30", 60), "2026-10-07T00:30");
});
test("Termin-Anzeige in Berliner Zeit", () => {
  const t = formatTermin({ dateTime: "2026-10-06T10:00:00Z" }, { dateTime: "2026-10-06T11:00:00Z" });
  assert.match(t, /12:00–13:00/);
  assert.match(formatTermin({ date: "2026-10-06" }), /ganztägig/);
});
test("Betreff mit Umlauten wird kodiert, Rohmail ist gültig aufgebaut", () => {
  assert.equal(kodiereBetreff("Hallo"), "Hallo");
  assert.match(kodiereBetreff("Möglichkeit"), /^=\?UTF-8\?B\?/);
  const raw = baueRohmail({ an: "a@b.de", betreff: "Re: Besichtigung für Größe", text: "Freitag passt, Grüße", inReplyTo: "<x@y>", references: "<w@y> <x@y>" });
  assert.match(raw, /^To: a@b\.de\r\n/);
  assert.match(raw, /In-Reply-To: <x@y>/);
  assert.match(raw, /Content-Transfer-Encoding: base64/);
  assert.equal(base64UrlZuText(textZuBase64Url("Grüße für Alex ✓")), "Grüße für Alex ✓");
});
test("Zitate und Signaturen werden entfernt", () => {
  const t = "Freitag passt.\n\n-- \nAlex\n";
  assert.equal(entferneZitate(t), "Freitag passt.");
  const t2 = "Ja gerne.\n\nAm 3. März 2026 um 10:00 schrieb Max <m@x.de>:\n> Passt dir Freitag?";
  assert.equal(entferneZitate(t2), "Ja gerne.");
});
test("Mail-Text aus HTML und aus Teilen", () => {
  assert.equal(htmlZuText("<p>Hallo&nbsp;Welt</p><script>x</script>"), "Hallo Welt");
  const b64 = textZuBase64Url("Nur Text");
  const payload = { mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: b64 } }] };
  assert.equal(extrahiereText(payload), "Nur Text");
  assert.equal(kopfWert([{ name: "Message-Id", value: "<a>" }], "Message-ID"), "<a>");
});
test("Google-Fehlertexte", () => {
  assert.match(googleFehlerText(403, { error: { message: "Gmail API has not been used in project" } }), /aktiviert/);
  assert.match(googleFehlerText(429, {}), /ausgelastet/);
});
test("Werkzeuge: keine Sende-Funktion, Namen eindeutig", () => {
  const namen = WERKZEUGE.map((w) => w.def.name);
  assert.equal(new Set(namen).size, namen.length);
  for (const n of ["termine_abrufen", "termin_eintragen", "termin_verschieben", "gmail_suchen", "gmail_entwurf", "gmail_sortieren"]) assert.ok(namen.includes(n), n);
  assert.ok(!namen.some((n) => /senden|send|loeschen|delete/i.test(n)));
});
test("Einrichten-Seite und App haben gültiges Skript", () => {
  for (const html of [EINRICHTEN_HTML, APP_HTML]) {
    const m = html.match(/<script>([\s\S]*)<\/script>/);
    assert.ok(m);
    new Function(m![1]);
  }
});

test("Datenschutz-Seite nennt Gmail, Kalender und das Nicht-Senden", async () => {
  const { DATENSCHUTZ_HTML } = await import("../src/datenschutz.ts");
  assert.match(DATENSCHUTZ_HTML, /Gmail/);
  assert.match(DATENSCHUTZ_HTML, /versendet keine E-Mails/);
});
