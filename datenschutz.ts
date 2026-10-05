// Oeffentliche Datenschutz-Seite (Google verlangt sie fuer die Veroeffentlichung der OAuth-App)
export const DATENSCHUTZ_HTML = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jarvis · Datenschutz</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:680px;margin:0 auto;padding:24px 16px;line-height:1.6;color:#1b1b1b}h1{font-size:24px}h2{font-size:18px;margin-top:28px}</style></head>
<body>
<h1>Datenschutzerklärung für Jarvis</h1>
<p>Jarvis ist ein persönlicher KI-Assistent, den der Betreiber ausschließlich für den eigenen, privaten Gebrauch betreibt. Die App wird nicht öffentlich angeboten und hat keine weiteren Nutzer.</p>
<h2>Welche Google-Daten Jarvis nutzt</h2>
<p>Nach ausdrücklicher Zustimmung des Betreibers greift Jarvis auf dessen Gmail-Postfach und Google Kalender zu. Er liest und sortiert E-Mails, legt Antwort-Entwürfe an und verwaltet Kalendereinträge. Jarvis versendet keine E-Mails und löscht keine Termine.</p>
<h2>Speicherung</h2>
<p>Gespeichert wird nur der Zugangsschlüssel (Refresh-Token) zum Google-Konto, in einem privaten Speicher des Betreibers bei Cloudflare. E-Mail-Inhalte und Kalenderdaten werden nur für die jeweilige Anfrage verarbeitet und nicht dauerhaft gespeichert.</p>
<h2>Weitergabe</h2>
<p>Google-Daten werden nicht verkauft, nicht für Werbung genutzt und nicht an Dritte weitergegeben. Zur Beantwortung einer Anfrage werden relevante Textteile an die Claude-Schnittstelle von Anthropic übermittelt, um eine Antwort zu erzeugen. Die Nutzung der Google-Daten entspricht der Google API Services User Data Policy, einschließlich der Anforderungen zur eingeschränkten Nutzung.</p>
<h2>Widerruf</h2>
<p>Der Zugriff kann jederzeit unter myaccount.google.com/permissions entzogen oder in Jarvis auf der Einrichten-Seite getrennt werden.</p>
</body></html>`;
