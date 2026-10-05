# Jarvis · Baustand

## Fragebogen
- Nutzer: Alex (Du). Assistent: Jarvis. Ton: ruhig und sachlich, ehrlich statt Ja-Sager.
- Branche: Immobilien und Trading (Wohnungssuche, Chartanalyse)
- Geräte: Android (Chrome) + Windows
- Kalender: Google Kalender. Mail: Gmail; GMX per Weiterleitung nach Gmail
- Stimme: Handy-Stimme (kostenlos), ElevenLabs später optional
- Module: Such-Agent (Immobilien/Wohnungen), Chartanalyse, Finanzen (nur lesen)
- API-Grenze: ca. 30 $/Monat (Standard). Design: dunkel, leuchtende Kugel
- Technik-Erfahrung: 1. Arbeitsweise: Claude Code (Weg A)

## Anpassungen gegenüber dem Vorbild
- Google Kalender statt iCloud (Stufe 3, gleiche Google-Anmeldung wie Gmail)
- Chartanalyse neu: Screenshot-Upload und Marktdaten lesen, keine Orders
- Stufe 4 (ElevenLabs) vorerst übersprungen

## Stufen
- [x] Stufe 0: Konten, Worker mit GitHub verbunden, Secrets, KV-Speicher
- [x] Stufe 1: App mit Kugel läuft (getestet)
- [x] Stufe 2: Notion-Gedächtnis, Listen Objekte und Standorte, Protokoll, Regeln (getestet)
- [x] Stufe 3: Google Kalender und Gmail laufen (getestet), GMX per Filterregel an Gmail weitergeleitet. WhatsApp und Apps öffnen nicht gewählt.
- [~] Markt-Modul: Code geschrieben (Twelve Data Kurse und Indikatoren, Wirtschaftskalender per Forex-Factory-Feed, FRED-Zinsen, markt_lagebild), noch nicht live getestet
- [~] Such-Agent (Stufe 9) und Berichte (Teil von Stufe 5): Code geschrieben (stündlicher Cron, Gmail-Portal-Mails, Haiku-Bewertung, Notion Funde), noch nicht live getestet
- [~] Bild- und PDF-Upload (Chart-Screenshots, Exposés): Code geschrieben, noch nicht live getestet
- [ ] Stufe 5 Rest (Morgenbericht, Aufgaben, Lernrunde), 6, 7, 10

## Secrets (nur Namen)
ANTHROPIC_API_KEY, JARVIS_SECRET, NOTION_TOKEN, TWELVEDATA_API_KEY (Cloudflare, Typ Secret). Optional FRED_API_KEY (noch offen)
Variable (wrangler.toml): NOTION_WISSEN_ID
KV-Bindung: SPEICHER (ID in wrangler.toml)

## Worker-Adresse
https://jarvis.alexander-hofmann1998.workers.dev (App unter /app)

## Notion
- Seite Jarvis · Wissen (mit Integration Jarvis verbunden). Datenbanken Protokoll, Objekte und Standorte legt Jarvis beim ersten Gebrauch selbst darunter an.
- Standortkriterien: Unis, Bevölkerungswachstum, viele starke Arbeitgeber

## Google
- Zugang liegt im KV (google:client, google:refresh), nie im Repository. Einrichtung über /einrichten.
- GMX wird per Weiterleitung nach Gmail geleitet.

## Markt
- TradingView hat keine Daten-API. Geplant: Alerts per Webhook als Berichte, Chart-Screenshots analysieren (Bild-Upload in der App noch zu bauen), Live-Charts in der Zentrale.
- Wirtschaftskalender: inoffizieller Feed, nur Prognose und Vorwert.
- Offen: Such-Agent (Stufe 9), Hintergrund und Morgenbericht (Stufe 5), Zentrale (Stufe 6), Finanzen (Stufe 7)

## Such-Agent
- Cron: stündlich zur Viertelstunde (wrangler.toml). Manuell: Einrichten-Seite, Karte Such-Agent.
- Absender-Domains und Suchprofil liegen im KV (suchagent:absender, suchprofil). Portal-Suchaufträge mit Mail-Benachrichtigung an Gmail anlegen.
- Kostenbremse (Stufe 10) fehlt noch: Haiku-Aufrufe nur bei neuen Portal-Mails.
