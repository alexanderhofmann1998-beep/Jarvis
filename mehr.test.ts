import { test } from "node:test";
import assert from "node:assert/strict";
import { bereinigeErkennung } from "../src/whisper.ts";
import { bereinigeVerlauf } from "../src/verlauf.ts";
import { kurzantwort } from "../src/kurz.ts";
import { fehlerText, istModellFehler, pruefeSchluessel } from "../src/fehler.ts";
import { jetztText } from "../src/zeit.ts";
import { APP_HTML, MANIFEST } from "../src/app.ts";

test("Whisper-Halluzinationen gelten als nichts gesagt", () => {
  assert.equal(bereinigeErkennung("Untertitel von Amara.org"), "");
  assert.equal(bereinigeErkennung("Danke fürs Zuschauen!"), "");
  assert.equal(bereinigeErkennung("..."), "");
  assert.equal(bereinigeErkennung("Wie spät ist es?"), "Wie spät ist es?");
});
test("Verlauf wird bereinigt", () => {
  const v = bereinigeVerlauf([
    { role: "assistant", content: "x" },
    { role: "user", content: "Hauptstadt von Australien?" },
    { role: "assistant", content: "Canberra." },
    { role: "user", content: "offen" },
    { role: "kaputt", content: "y" },
  ]);
  assert.deepEqual(v, [
    { role: "user", content: "Hauptstadt von Australien?" },
    { role: "assistant", content: "Canberra." },
  ]);
});
test("Kurze Befehle", () => {
  assert.equal(kurzantwort("Danke!")?.ende, true);
  assert.equal(kurzantwort("Tschüss Jarvis")?.ende, true);
  assert.equal(kurzantwort("Wie spät ist es?"), null);
});
test("Fehlertexte", () => {
  assert.match(fehlerText({ status: 400, message: "Your credit balance is too low" }), /Guthaben/);
  assert.match(fehlerText({ status: 401, message: "x" }), /Schlüssel/);
  assert.match(fehlerText({ status: 429, message: "x" }), /ausgelastet/);
  assert.equal(istModellFehler({ status: 404, message: "model not found" }), true);
  assert.equal(istModellFehler({ status: 400, message: "credit balance too low" }), false);
  assert.equal(pruefeSchluessel("sk-ant-abc"), null);
  assert.match(pruefeSchluessel("abc") ?? "", /Länge 3/);
  assert.match(pruefeSchluessel("") ?? "", /fehlt/);
});
test("Uhrzeit in Berliner Zeit", () => {
  assert.match(jetztText(new Date("2026-10-05T12:30:00Z")), /14:30/);
});
test("App-Skript hat gültige Syntax, Manifest ist gültig", () => {
  const m = APP_HTML.match(/<script>([\s\S]*)<\/script>/);
  assert.ok(m);
  new Function(m![1]);
  assert.equal(JSON.parse(MANIFEST).name, "Jarvis");
});
