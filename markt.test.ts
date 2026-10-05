import { test } from "node:test";
import assert from "node:assert/strict";
import { atr, eventZeile, filtereEvents, fredSerie, fredZeile, normalisiereSymbol, preis, rsi, sma, tdFehlerText, zahl } from "../src/marktlib.ts";
import { WERKZEUGE } from "../src/tools.ts";

test("Symbole werden erkannt", () => {
  assert.equal(normalisiereSymbol("Gold"), "XAU/USD");
  assert.equal(normalisiereSymbol("Öl"), "WTI/USD");
  assert.equal(normalisiereSymbol("eurusd"), "EUR/USD");
  assert.equal(normalisiereSymbol("aapl"), "AAPL");
});
test("Zahlen im deutschen Format", () => {
  assert.equal(zahl(2650.341), "2.650,34");
  assert.equal(preis("1.0834"), "1,0834");
  assert.equal(zahl(undefined), "?");
});
test("Indikatoren", () => {
  const steigend = Array.from({ length: 30 }, (_, i) => i + 1);
  assert.equal(rsi(steigend), 100);
  assert.equal(rsi([...steigend].reverse()), 0);
  assert.equal(sma([1, 2, 3, 4, 5], 5), 3);
  assert.equal(sma([1, 2], 5), null);
  const c = Array.from({ length: 30 }, () => 10);
  assert.equal(atr(c.map((x) => x + 1), c.map((x) => x - 1), c), 2);
});
test("Twelve-Data-Fehler verständlich", () => {
  assert.match(tdFehlerText({ code: 429 }), /Abruflimit/);
  assert.match(tdFehlerText({ code: 401 }), /Schlüssel/);
  assert.match(tdFehlerText({ code: 400, message: "symbol not found" }), /symbol_suche/);
  assert.match(tdFehlerText({ code: 403, message: "available with Grow plan" }), /Tarif/);
});
test("Kalender filtern nach Wirkung, Währung und Tag", () => {
  const jetzt = new Date("2026-10-06T08:00:00Z");
  const ev = [
    { title: "CPI", country: "USD", date: "2026-10-06T08:30:00-04:00", impact: "High", forecast: "0.3%", previous: "0.2%" },
    { title: "Rede", country: "EUR", date: "2026-10-06T03:00:00-04:00", impact: "Low" },
    { title: "NFP", country: "USD", date: "2026-10-09T08:30:00-04:00", impact: "High" },
  ];
  assert.equal(filtereEvents(ev, { jetzt }).length, 2);
  assert.equal(filtereEvents(ev, { jetzt, wirkung: "alle" }).length, 3);
  assert.equal(filtereEvents(ev, { jetzt, tag: "heute" }).length, 1);
  assert.equal(filtereEvents(ev, { jetzt, wirkung: "alle", waehrung: "EUR" }).length, 1);
  assert.match(eventZeile(ev[0]), /14:30.*USD.*Wirkung hoch.*CPI.*Prognose 0\.3%.*Vorwert 0\.2%/);
});
test("FRED", () => {
  assert.equal(fredSerie("US10Y"), "DGS10");
  assert.equal(fredSerie("us 10y"), "DGS10");
  assert.equal(fredSerie("cpiaucsl"), "CPIAUCSL");
  assert.match(fredZeile("DGS10", [{ date: "2026-10-05", value: "." }, { date: "2026-10-02", value: "4.12" }, { date: "2026-10-01", value: "4.08" }]), /4,12.*davor 4,08/);
});
test("Markt-Werkzeuge sind registriert, nichts davon handelt", () => {
  const n = WERKZEUGE.map((w) => w.def.name);
  for (const x of ["kurs_abrufen", "indikatoren", "symbol_suche", "wirtschaftskalender", "zinsen_anleihen", "markt_lagebild"]) assert.ok(n.includes(x), x);
  assert.equal(new Set(n).size, n.length);
  assert.ok(!n.some((x) => /order|kaufen|verkaufen|trade/i.test(x)));
});
