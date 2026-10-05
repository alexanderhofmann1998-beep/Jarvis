import type { Env } from "./index.ts";
import { regelLernen, regelVergessen } from "./gedaechtnis.ts";
import { OBJEKTE, STANDORTE, type ListenDef } from "./listen.ts";
import { merke, zeileAendern, zeileAnlegen, zeilenSuchen } from "./notion.ts";
import { indikatoren, kursAbrufen, lagebildDaten, symbolSuche, wirtschaftskalender, zinsen } from "./markt.ts";
import { termineAbrufen, terminEintragen, terminVerschieben } from "./kalender.ts";
import { gmailEntwurf, gmailLesen, gmailNeue, gmailSortieren, gmailSuchen, gmailWichtige } from "./gmail.ts";

type Eingabe = Record<string, any>;
export type Werkzeug = {
  def: { name: string; description: string; input_schema: Record<string, unknown> };
  run: (input: Eingabe, env: Env) => Promise<string>;
};

const felder = (beschr: string) => ({ type: "object", description: beschr, additionalProperties: true });

function listenWerkzeuge(prefix: string, label: string, def: ListenDef): Werkzeug[] {
  return [
    {
      def: {
        name: prefix + "_anlegen",
        description: "Legt einen neuen Eintrag in der Notion-Liste " + label + " an. Sofort anlegen, auch wenn Angaben fehlen, und fehlende danach nennen. Spalten: " + def.spalten + ".",
        input_schema: { type: "object", properties: { felder: felder("Spaltenname zu Wert, z. B. die Titel-Spalte plus weitere") }, required: ["felder"] },
      },
      run: (i, env) => zeileAnlegen(env, def, i.felder ?? {}),
    },
    {
      def: {
        name: prefix + "_suchen",
        description: "Sucht Einträge in der Liste " + label + ". Liefert ids. Ohne Angabe die letzten Einträge. Optional Textsuche im Titel oder Filter über eine Spalte (spalte und wert).",
        input_schema: { type: "object", properties: { text: { type: "string" }, spalte: { type: "string" }, wert: { type: "string" } } },
      },
      run: (i, env) => zeilenSuchen(env, def, { text: i.text, spalte: i.spalte, wert: i.wert }),
    },
    {
      def: {
        name: prefix + "_aktualisieren",
        description: "Ändert einen bestehenden Eintrag in der Liste " + label + " anhand seiner id (erst suchen). Passen mehrere Einträge, frag nach. Spalten: " + def.spalten + ".",
        input_schema: { type: "object", properties: { id: { type: "string" }, felder: felder("Spaltenname zu neuem Wert") }, required: ["id", "felder"] },
      },
      run: (i, env) => zeileAendern(env, def, String(i.id ?? ""), i.felder ?? {}),
    },
  ];
}

export const WERKZEUGE: Werkzeug[] = [
  {
    def: {
      name: "merken",
      description: "Merkt dir einen knappen, dauerhaften Fakt über Alex (Ziele, Firmen, Ansprechpartner, Vorlieben, Kriterien). Wichtige Dinge ungefragt merken.",
      input_schema: { type: "object", properties: { fakt: { type: "string", description: "Ein knapper Satz" } }, required: ["fakt"] },
    },
    run: async (i, env) => {
      const f = String(i.fakt ?? "").trim();
      if (!f) return "Kein Fakt angegeben.";
      await merke(env, f);
      return "Gemerkt.";
    },
  },
  ...listenWerkzeuge("objekt", "Objekte (Wohnungen, Immobilien)", OBJEKTE),
  ...listenWerkzeuge("standort", "Standorte (Orte mit Unis, Bevölkerungswachstum, Arbeitgebern)", STANDORTE),
  {
    def: {
      name: "termine_abrufen",
      description: "Liest Termine aus allen Google-Kalendern. von und bis als Datum JJJJ-MM-TT oder JJJJ-MM-TTTHH:MM in Berliner Zeit. Ohne bis gilt ein Tag. Bei mehreren Tagen bis angeben (Datum bis einschließlich).",
      input_schema: { type: "object", properties: { von: { type: "string" }, bis: { type: "string" } }, required: ["von"] },
    },
    run: (i, env) => termineAbrufen(env, String(i.von ?? ""), i.bis ? String(i.bis) : undefined),
  },
  {
    def: {
      name: "termin_eintragen",
      description: "Trägt einen Termin in den Google-Kalender ein. start als JJJJ-MM-TTTHH:MM in Berliner Zeit. Ohne ende dauert er eine Stunde. Doppelte Einträge werden erkannt. Trage nie doppelt ein: steht im Verlauf schon, dass er eingetragen ist, sag das.",
      input_schema: {
        type: "object",
        properties: { titel: { type: "string" }, start: { type: "string" }, ende: { type: "string" }, ort: { type: "string" }, notiz: { type: "string" }, erinnerung_min: { type: "integer", description: "Erinnerung in Minuten vorher" } },
        required: ["titel", "start"],
      },
    },
    run: (i, env) => terminEintragen(env, { titel: String(i.titel ?? ""), start: String(i.start ?? ""), ende: i.ende, ort: i.ort, notiz: i.notiz, erinnerung_min: i.erinnerung_min }),
  },
  {
    def: {
      name: "termin_verschieben",
      description: "Verschiebt einen bestehenden Termin, findet ihn per Stichwort im Titel (suche) und optional dem bisherigen Tag (JJJJ-MM-TT). Es bleibt derselbe Termin. Ohne neues_ende bleibt die Dauer. Serientermine und Löschen gibt es nicht, das macht Alex selbst.",
      input_schema: {
        type: "object",
        properties: { suche: { type: "string" }, tag: { type: "string" }, id: { type: "string", description: "Nur wenn mehrere passen" }, neuer_start: { type: "string" }, neues_ende: { type: "string" } },
        required: ["neuer_start"],
      },
    },
    run: (i, env) => terminVerschieben(env, { suche: i.suche, tag: i.tag, id: i.id, neuer_start: String(i.neuer_start ?? ""), neues_ende: i.neues_ende }),
  },
  {
    def: {
      name: "gmail_wichtige",
      description: "Zeigt ungelesene, wahrscheinlich wichtige Mails im Posteingang (ohne Werbung, Social, Updates) der letzten 14 Tage.",
      input_schema: { type: "object", properties: { max: { type: "integer" } } },
    },
    run: (i, env) => gmailWichtige(env, i.max),
  },
  {
    def: {
      name: "gmail_neue",
      description: "Zeigt neue Mails im Posteingang der letzten 24 Stunden.",
      input_schema: { type: "object", properties: { max: { type: "integer" } } },
    },
    run: (i, env) => gmailNeue(env, i.max),
  },
  {
    def: {
      name: "gmail_suchen",
      description: "Sucht Mails mit Gmail-Suchsyntax (from:, subject:, has:attachment …). Ohne Zeitangabe die letzten 30 Tage, auch archivierte. Fragt Alex nach einer Mail, suche zuerst selbst, bevor du nachfragst. Liefert thread- und mail-ids.",
      input_schema: { type: "object", properties: { suche: { type: "string" }, max: { type: "integer" } }, required: ["suche"] },
    },
    run: (i, env) => gmailSuchen(env, String(i.suche ?? ""), i.max),
  },
  {
    def: {
      name: "gmail_lesen",
      description: "Liest den Verlauf (thread) einer Mail ohne alte Zitate und Signaturen. thread_id aus einer Suche.",
      input_schema: { type: "object", properties: { thread_id: { type: "string" } }, required: ["thread_id"] },
    },
    run: (i, env) => gmailLesen(env, String(i.thread_id ?? "")),
  },
  {
    def: {
      name: "gmail_entwurf",
      description: "Legt einen Antwort-Entwurf im selben Verlauf in Gmail an (thread_id). Für eine neue Mail stattdessen an und betreff angeben. SENDET NIE. Schreib den Text im Stil von Alex, kurz und höflich, und sag nie etwas zu, was Alex entscheiden muss (Preise, Termine, Geld).",
      input_schema: { type: "object", properties: { thread_id: { type: "string" }, text: { type: "string" }, an: { type: "string" }, betreff: { type: "string" } }, required: ["text"] },
    },
    run: (i, env) => gmailEntwurf(env, { thread_id: i.thread_id, text: String(i.text ?? ""), an: i.an, betreff: i.betreff }),
  },
  {
    def: {
      name: "gmail_sortieren",
      description: "Sortiert Mails: optional ein eigenes Label unter Jarvis/ vergeben und/oder archivieren (nimmt sie aus dem Posteingang). Nur mit mail-ids aus einer Suche. Im Zweifel nie archivieren.",
      input_schema: { type: "object", properties: { mail_ids: { type: "array", items: { type: "string" } }, label: { type: "string" }, archivieren: { type: "boolean" } }, required: ["mail_ids"] },
    },
    run: (i, env) => gmailSortieren(env, { mail_ids: i.mail_ids ?? [], label: i.label, archivieren: i.archivieren }),
  },
  {
    def: {
      name: "kurs_abrufen",
      description: "Holt aktuelle Kurse (Twelve Data), bis zu 6 Symbole. Namen wie Gold, Öl, Bitcoin, DAX, SP500 oder EURUSD werden erkannt, sonst das Twelve-Data-Symbol (z. B. XAU/USD) angeben. Nenne Stand und Quelle. Bei unbekanntem Symbol symbol_suche nutzen.",
      input_schema: { type: "object", properties: { symbole: { type: "array", items: { type: "string" } } }, required: ["symbole"] },
    },
    run: (i, env) => kursAbrufen(env, i.symbole ?? []),
  },
  {
    def: {
      name: "indikatoren",
      description: "Technische Kennzahlen für ein Symbol: Veränderung, RSI 14, SMA 20/50/200, ATR 14, Spanne der letzten 20 Kerzen und Trend. intervall: 15min, 30min, 1h, 4h, 1day (Standard) oder 1week. Grundlage für Chartanalyse, keine Anlageberatung.",
      input_schema: { type: "object", properties: { symbol: { type: "string" }, intervall: { type: "string" } }, required: ["symbol"] },
    },
    run: (i, env) => indikatoren(env, String(i.symbol ?? ""), i.intervall),
  },
  {
    def: {
      name: "symbol_suche",
      description: "Sucht das richtige Twelve-Data-Symbol zu einem Namen (z. B. Brent, Nasdaq).",
      input_schema: { type: "object", properties: { suche: { type: "string" } }, required: ["suche"] },
    },
    run: (i, env) => symbolSuche(env, String(i.suche ?? "")),
  },
  {
    def: {
      name: "wirtschaftskalender",
      description: "Wirtschaftstermine der Woche (inoffizieller Forex-Factory-Feed) mit Wirkung, Prognose und Vorwert, ohne Ist-Werte. wirkung: hoch (Standard), mittel oder alle. waehrung z. B. USD oder USD,EUR. tag: heute, morgen oder leer für die ganze Woche. woche: diese oder naechste.",
      input_schema: { type: "object", properties: { wirkung: { type: "string" }, waehrung: { type: "string" }, tag: { type: "string" }, woche: { type: "string" } } },
    },
    run: (i, env) => wirtschaftskalender(env, { wirkung: i.wirkung, waehrung: i.waehrung, tag: i.tag, woche: i.woche }),
  },
  {
    def: {
      name: "zinsen_anleihen",
      description: "Zinsen und Anleihenrenditen von FRED (tagesaktuell, nicht in Echtzeit). Namen: us10y, us2y, us30y, us10y2y (Zinsstruktur), leitzins (Fed), bund10y (monatlich) oder eine FRED-Serien-id.",
      input_schema: { type: "object", properties: { serien: { type: "array", items: { type: "string" } } }, required: ["serien"] },
    },
    run: (i, env) => zinsen(env, i.serien ?? []),
  },
  {
    def: {
      name: "markt_lagebild",
      description: "Holt auf einmal Kurse (Gold, Öl, EUR/USD, S&P 500, DAX, Bitcoin), die wichtigen Termine von heute und US-Zinsen. Danach ergänzt du per Websuche die wichtigsten Wirtschaftsnachrichten und ordnest alles kurz ein. Nutze es bei Fragen nach Lagebild, Weltwirtschaft oder Marktüberblick.",
      input_schema: { type: "object", properties: {} },
    },
    run: (_i, env) => lagebildDaten(env),
  },
  {
    def: {
      name: "regel_lernen",
      description: "Speichert eine Verhaltensregel für dich selbst. Nutze es, wenn Alex dich korrigiert, genervt ist oder etwas lobt. Höchstens 40 Regeln.",
      input_schema: { type: "object", properties: { regel: { type: "string", description: "Kurze Anweisung an dich selbst" } }, required: ["regel"] },
    },
    run: (i, env) => regelLernen(env, String(i.regel ?? "")),
  },
  {
    def: {
      name: "regel_vergessen",
      description: "Löscht eine gelernte Regel anhand ihrer Nummer.",
      input_schema: { type: "object", properties: { nummer: { type: "integer" } }, required: ["nummer"] },
    },
    run: (i, env) => regelVergessen(env, Number(i.nummer)),
  },
];

export async function fuehreAus(name: string, input: Eingabe, env: Env): Promise<string> {
  const w = WERKZEUGE.find((x) => x.def.name === name);
  if (!w) return "Unbekanntes Werkzeug: " + name;
  return w.run(input ?? {}, env);
}
