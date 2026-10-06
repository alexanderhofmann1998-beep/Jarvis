import { test } from "node:test";
import assert from "node:assert/strict";
import { createSatzTeiler } from "./saetze.ts";

function alle(text: string, schritt = 1000): string[] {
  const t = createSatzTeiler();
  const out: string[] = [];
  for (let i = 0; i < text.length; i += schritt) out.push(...t.push(text.slice(i, i + schritt)));
  out.push(...t.flush());
  return out;
}

test("Datum und Zahlen beenden keinen Satz", () => {
  const r = alle("Moment, ich schau nach. Es ist der 15. Oktober und warm. Okay");
  assert.deepEqual(r, ["Moment, ich schau nach.", "Es ist der 15. Oktober und warm.", "Okay"]);
});
test("Tausenderpunkt und Abkürzungen", () => {
  assert.deepEqual(alle("Das kostet 1.250 Euro. Das geht z. B. so. Gut."), ["Das kostet 1.250 Euro.", "Das geht z. B. so.", "Gut."]);
});
test("Zeichenweises Streaming gibt dasselbe Ergebnis", () => {
  const text = "Kurz. Am 3. März kostet das 1.250 Euro. Ja!";
  assert.deepEqual(alle(text, 1), alle(text, 1000));
});
