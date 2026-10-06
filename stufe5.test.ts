import { test } from "node:test";
import assert from "node:assert/strict";
import { baueQuery, fundId, fundZuFelder, htmlMitLinks, mergeGesehen, parseFunde, STANDARD_ABSENDER } from "./suchlib.ts";
import { baueAnhaenge } from "./dateien.ts";
import { lageText, ladeBerichte, markiereGelesen, schreibeBericht, ungelesene } from "./berichte.ts";
import { WERKZEUGE } from "./tools.ts";
import { APP_HTML } from "./app.ts";
import { EINRICHTEN_HTML } from "./einrichten.ts";

function fakeEnv(): any {
  const m = new Map<string, string>();
  return { SPEICHER: { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v), delete: async (k: string) => void m.delete(k) } };
}

test("Gmail-Suche für Portal-Mails", () => {
  const q = baueQuery(["immowelt.at", "willhaben.at"]);
  assert.match(q, /^from:\(immowelt\.at OR willhaben\.at\) -label:jarvis-verarbeitet newer_than:3d$/);
  assert.throws(() => baueQuery([]));
  assert.ok(STANDARD_ABSENDER.includes("willhaben.at"));
});
test("Links bleiben im Mailtext erhalten", () => {
  const t = htmlMitLinks('<p>Altbau Linz <a href="https://portal.at/expose/123?x=1&amp;y=2">Ansehen</a></p><a href="mailto:a@b.at">Mail</a>');
  assert.match(t, /Ansehen \[https:\/\/portal\.at\/expose\/123\?x=1&y=2\]/);
  assert.doesNotMatch(t, /mailto/);
});
test("Funde werden robust gelesen und bewertet", () => {
  const antwort = 'Hier: [{"titel":"MFH Linz","ort":"Linz","preis":"1.250.000","flaeche":300,"link":"https://p.at/1","portal":"P","bewertung":"Top","grund":"Nähe Uni"},{"titel":"","ort":"x"},{"titel":"Villa","bewertung":"verwerfen","link":"nix"}]';
  const f = parseFunde(antwort, false);
  assert.equal(f.length, 2);
  assert.equal(f[0].preis, 1250000);
  assert.equal(f[0].bewertung, "Top");
  assert.equal(f[1].bewertung, "Verwerfen");
  assert.equal(f[1].link, null);
  assert.equal(parseFunde(antwort, true)[0].bewertung, "Prüfen");
  assert.deepEqual(parseFunde("kein json", false), []);
});
test("Doppelte Funde werden erkannt, Tracking-Zusätze zählen nicht", async () => {
  const base = { titel: "A", ort: "L", preis: 1, flaeche: 1, portal: "P", bewertung: "Gut", grund: "" } as const;
  const a = await fundId({ ...base, link: "https://p.at/x?utm=1" });
  const b = await fundId({ ...base, link: "https://p.at/x?utm=2" });
  assert.equal(a, b);
  assert.deepEqual(mergeGesehen(["a"], ["b", "a"]), ["a", "b"]);
  assert.equal((fundZuFelder({ ...base, link: null }, "2026-10-06") as any).Bewertung, "Gut");
});
test("Anhänge: Bilder und PDF werden Blöcke, anderes wird abgelehnt", async () => {
  const bild = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
  const pdf = new Blob([new Uint8Array([4, 5])], { type: "application/pdf" });
  const exe = new Blob([new Uint8Array([6])], { type: "application/x-msdownload" });
  const r = await baueAnhaenge([bild, pdf, exe]);
  assert.equal(r.bloecke.length, 2);
  assert.equal(r.bloecke[0].type, "image");
  assert.equal(r.bloecke[1].type, "document");
  assert.equal(r.fehler.length, 1);
});
test("Berichte: schreiben, Lage, als gelesen markieren", async () => {
  const env = fakeEnv();
  await schreibeBericht(env, { titel: "2 neue Top-Funde", kurz: "MFH in Linz.", dringend: true });
  const u = await ungelesene(env);
  assert.equal(u.length, 1);
  assert.match(lageText(u), /DRINGEND 2 neue Top-Funde: MFH in Linz\./);
  await markiereGelesen(env, [u[0].id]);
  assert.equal((await ungelesene(env)).length, 0);
  assert.equal((await ladeBerichte(env)).length, 1);
  assert.equal(lageText([]), "");
});
test("Neue Werkzeuge sind registriert", () => {
  const n = WERKZEUGE.map((w) => w.def.name);
  for (const x of ["suchprofil_setzen", "suchprofil_zeigen", "suchagent_portale", "funde_zeigen", "berichte_lesen"]) assert.ok(n.includes(x), x);
  assert.equal(new Set(n).size, n.length);
});
test("App und Einrichten-Seite haben gültiges Skript und die neuen Bedienelemente", () => {
  for (const html of [APP_HTML, EINRICHTEN_HTML]) {
    const m = html.match(/<script>([\s\S]*)<\/script>/);
    assert.ok(m);
    new Function(m![1]);
  }
  assert.match(APP_HTML, /id="dateiwahl"/);
  assert.match(EINRICHTEN_HTML, /id="sstart"/);
});
