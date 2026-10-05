import type { Env } from "./index.ts";
import { regelLernen, regelVergessen } from "./gedaechtnis.ts";
import { OBJEKTE, STANDORTE, type ListenDef } from "./listen.ts";
import { merke, zeileAendern, zeileAnlegen, zeilenSuchen } from "./notion.ts";

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
