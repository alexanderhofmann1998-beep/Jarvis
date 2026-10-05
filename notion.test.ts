import { test } from "node:test";
import assert from "node:assert/strict";
import { baueProps, blocksZuText, extrahiereId, leseWert, notionFehlerText, zuZahl } from "../src/notionlib.ts";
import { OBJEKTE, STANDORTE } from "../src/listen.ts";
import { WERKZEUGE } from "../src/tools.ts";
import { wissenBlock } from "../src/prompt.ts";

test("ID aus Notion-Link", () => {
  assert.equal(
    extrahiereId("https://app.notion.com/p/Jarvis-Wissen-3f064a58e23e80019e8ecb5356036f0c?source=copy_link"),
    "3f064a58e23e80019e8ecb5356036f0c",
  );
  assert.equal(extrahiereId("3f064a58-e23e-8001-9e8e-cb5356036f0c"), "3f064a58e23e80019e8ecb5356036f0c");
  assert.equal(extrahiereId("kein link"), null);
});
test("Zahlen aus Text", () => {
  assert.equal(zuZahl("1.250.000 €"), 1250000);
  assert.equal(zuZahl("4,5 %"), 4.5);
  assert.equal(zuZahl("3.5"), 3.5);
  assert.equal(zuZahl("abc"), undefined);
});
test("Spalten werden den echten Namen zugeordnet", () => {
  const schema = {
    Name: { type: "title" },
    Ort: { type: "rich_text" },
    Preis: { type: "number" },
    "Rendite (%)": { type: "number" },
    Status: { type: "select" },
  };
  const { props, unbekannt } = baueProps(schema, { name: "Altbau", ort: "Göttingen", preis: "350.000", rendite: "4,8", status: "Prüfen", farbe: "rot" });
  assert.deepEqual(Object.keys(props).sort(), ["Name", "Ort", "Preis", "Rendite (%)", "Status"]);
  assert.deepEqual(unbekannt, ["farbe"]);
  assert.deepEqual((props["Preis"] as any).number, 350000);
});
test("Notion-Blöcke zu Text, Datenbanken werden übersprungen", () => {
  const rt = (t: string) => [{ plain_text: t }];
  const text = blocksZuText([
    { type: "paragraph", paragraph: { rich_text: rt("Alex arbeitet in Immobilien.") } },
    { type: "bulleted_list_item", bulleted_list_item: { rich_text: rt("Kaffee schwarz") } },
    { type: "child_database", child_database: { title: "x" } },
  ]);
  assert.equal(text, "Alex arbeitet in Immobilien.\n- Kaffee schwarz");
});
test("Wert lesen und Fehlertexte", () => {
  assert.equal(leseWert({ type: "select", select: { name: "Neu" } }), "Neu");
  assert.equal(leseWert({ type: "number", number: 5 }), "5");
  assert.match(notionFehlerText(404, { code: "object_not_found" }), /Verbindungen/);
});
test("Listen haben genau eine Titel-Spalte, Werkzeuge sind sauber definiert", () => {
  for (const d of [OBJEKTE, STANDORTE]) {
    const titel = Object.values(d.properties).filter((p: any) => "title" in p);
    assert.equal(titel.length, 1);
  }
  const namen = WERKZEUGE.map((w) => w.def.name);
  assert.equal(new Set(namen).size, namen.length);
  for (const w of WERKZEUGE) assert.equal((w.def.input_schema as any).type, "object");
  for (const n of ["merken", "objekt_anlegen", "objekt_suchen", "objekt_aktualisieren", "standort_anlegen", "regel_lernen", "regel_vergessen"]) {
    assert.ok(namen.includes(n), n);
  }
});
test("Wissensblock enthält Regeln und Problemhinweis", () => {
  const b = wissenBlock("- Kaffee schwarz", ["Kürzer antworten"], "Notion nicht erreichbar");
  assert.match(b, /Kaffee schwarz/);
  assert.match(b, /1\. Kürzer antworten/);
  assert.match(b, /Notion nicht erreichbar/);
});
