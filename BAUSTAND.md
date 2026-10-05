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
- [~] Stufe 2: Code geschrieben (Notion-Gedächtnis, Listen Objekte und Standorte, Protokoll, Regeln), noch nicht live getestet
- [ ] Stufe 3, 5, 6, 7, 9, 10

## Secrets (nur Namen)
ANTHROPIC_API_KEY, JARVIS_SECRET, NOTION_TOKEN (Cloudflare, Typ Secret)
Variable (wrangler.toml): NOTION_WISSEN_ID
KV-Bindung: SPEICHER (ID in wrangler.toml)

## Worker-Adresse
https://jarvis.alexander-hofmann1998.workers.dev (App unter /app)

## Notion
- Seite Jarvis · Wissen (mit Integration Jarvis verbunden). Datenbanken Protokoll, Objekte und Standorte legt Jarvis beim ersten Gebrauch selbst darunter an.
- Standortkriterien: Unis, Bevölkerungswachstum, viele starke Arbeitgeber
