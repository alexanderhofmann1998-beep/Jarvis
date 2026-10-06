import { test } from "node:test";
import assert from "node:assert/strict";
import { schluesselPasst } from "./auth.ts";

test("richtiges Passwort wird akzeptiert", async () => {
  assert.equal(await schluesselPasst("geheim123", "geheim123"), true);
});
test("falsches oder leeres Passwort wird abgelehnt", async () => {
  assert.equal(await schluesselPasst("falsch", "geheim123"), false);
  assert.equal(await schluesselPasst(null, "geheim123"), false);
  assert.equal(await schluesselPasst("x", undefined), false);
});
