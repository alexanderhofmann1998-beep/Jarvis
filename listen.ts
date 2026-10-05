// Definition der Notion-Listen. Jarvis legt sie beim ersten Gebrauch unter der Seite "Jarvis · Wissen" an.
export type ListenDef = {
  key: string;
  titel: string;
  properties: Record<string, unknown>;
  spalten: string; // Hinweis fuer die Werkzeug-Beschreibung
};

const opt = (...namen: string[]) => ({ select: { options: namen.map((name) => ({ name })) } });

export const PROTOKOLL: ListenDef = {
  key: "protokoll",
  titel: "Jarvis · Protokoll",
  properties: {
    Befehl: { title: {} },
    Antwort: { rich_text: {} },
    Quelle: opt("App", "Siri", "Hintergrund"),
    Erfolg: { checkbox: {} },
    Zeit: { date: {} },
  },
  spalten: "Befehl, Antwort, Quelle, Erfolg, Zeit",
};

export const OBJEKTE: ListenDef = {
  key: "objekte",
  titel: "Jarvis · Objekte",
  properties: {
    Name: { title: {} },
    Ort: { rich_text: {} },
    Preis: { number: { format: "euro" } },
    "Fläche": { number: { format: "number" } },
    "Rendite (%)": { number: { format: "number" } },
    Status: opt("Neu", "Prüfen", "Besichtigung", "Abgelehnt"),
    Link: { url: {} },
    Notiz: { rich_text: {} },
  },
  spalten: "Name, Ort, Preis (Euro), Fläche (m²), Rendite (%), Status (Neu, Prüfen, Besichtigung, Abgelehnt), Link, Notiz",
};

export const STANDORTE: ListenDef = {
  key: "standorte",
  titel: "Jarvis · Standorte",
  properties: {
    Ort: { title: {} },
    Bundesland: { rich_text: {} },
    Einwohner: { number: { format: "number" } },
    Bevölkerungstrend: opt("Wachsend", "Stabil", "Schrumpfend", "Unklar"),
    "Unis / Hochschulen": { rich_text: {} },
    Studierende: { number: { format: "number" } },
    Arbeitgeber: { rich_text: {} },
    Arbeitsmarkt: opt("Stark", "Mittel", "Schwach", "Unklar"),
    Bewertung: opt("Top", "Gut", "Mittel", "Schwach"),
    Notiz: { rich_text: {} },
    Quelle: { rich_text: {} },
  },
  spalten:
    "Ort, Bundesland, Einwohner, Bevölkerungstrend (Wachsend, Stabil, Schrumpfend, Unklar), Unis / Hochschulen, Studierende, Arbeitgeber (größte Arbeitgeber), Arbeitsmarkt (Stark, Mittel, Schwach, Unklar), Bewertung (Top, Gut, Mittel, Schwach), Notiz, Quelle",
};
