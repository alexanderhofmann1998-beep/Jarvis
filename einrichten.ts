// Einrichten-Seite. Wichtig: in diesem Text keine Backticks und kein Dollar-Klammer-Zeichen verwenden.
export const EINRICHTEN_HTML = String.raw`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0b0c">
<title>Jarvis · Einrichten</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;background:#0b0b0c;color:#ece8e1;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
body{padding:env(safe-area-inset-top,0px) 16px calc(env(safe-area-inset-bottom,0px) + 24px);max-width:640px;margin:0 auto}
header{display:flex;justify-content:space-between;align-items:center;padding:18px 0}
header strong{color:#e07a2f;letter-spacing:.4em;font-size:13px}
a{color:#e8a46a}
.karte{background:#161617;border:1px solid #2a2a2c;border-radius:14px;padding:16px;margin-bottom:16px}
.karte h2{margin:0 0 6px;font-size:17px}
.status{display:inline-block;font-size:12px;padding:3px 9px;border-radius:99px;margin-bottom:10px;background:#2a2a2c;color:#a9a39a}
.status.ok{background:#1d3a24;color:#7fd491}
ol{padding-left:20px;line-height:1.5;color:#cfc9bf}
li{margin-bottom:8px}
code{background:#0b0b0c;border:1px solid #2a2a2c;border-radius:6px;padding:2px 6px;font-size:13px;word-break:break-all}
input[type=text],input[type=password],input[type=file]{width:100%;background:#0b0b0c;border:1px solid #2a2a2c;border-radius:10px;color:#ece8e1;padding:11px 12px;font-size:15px;margin:4px 0 10px}
button{background:#161617;border:1px solid #3a3a3c;border-radius:10px;color:#ece8e1;padding:11px 14px;font-size:15px;cursor:pointer;margin:4px 6px 4px 0}
button.primaer{background:#d2691e;border-color:#d2691e;color:#fff}
.meld{font-size:14px;min-height:20px;margin-top:6px;color:#a9a39a}
.meld.fehler{color:#e8665a}
.klein{font-size:13px;color:#8a847b}
</style>
</head>
<body>
<header><strong>JARVIS</strong><a href="/app">Zurück zur App</a></header>
<div id="sperre" class="karte" hidden>Bitte melde dich zuerst in der <a href="/app">App</a> mit deinem Jarvis-Passwort an. Danach kommst du hierher zurück.</div>

<div id="inhalt" hidden>
<div class="karte">
  <h2>Google: Kalender und Gmail</h2>
  <div id="gstatus" class="status">wird geprüft …</div>
  <p class="klein">Jarvis liest, sortiert und legt Entwürfe an. Er sendet nie selbst eine Mail.</p>
  <ol>
    <li>Öffne <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">console.cloud.google.com</a> und lege ein neues Projekt namens <code>Jarvis</code> an.</li>
    <li>Aktiviere dort die <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener">Gmail API</a> und die <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener">Google Calendar API</a>.</li>
    <li>Öffne <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener">Google Auth Platform</a> und richte den Anmeldebildschirm ein: App-Name <code>Jarvis</code>, Zielgruppe <strong>Extern</strong>, deine E-Mail als Kontakt. Füge unter <strong>Datenzugriff</strong> diese zwei Bereiche hinzu: <code>gmail.modify</code> und <code>calendar</code>.</li>
    <li>Erstelle unter <strong>Clients</strong> einen Client vom Typ <strong>Webanwendung</strong>. Trage als autorisierte Weiterleitungs-URI genau diese Adresse ein:<br><code id="redirect"></code> <button id="kopieren">Kopieren</button></li>
    <li>Lade die heruntergeladene Datei <code>client_secret_….json</code> hier hoch oder füge Client-ID und Secret ein.</li>
    <li>Stelle die App unter <strong>Zielgruppe</strong> auf <strong>In Produktion</strong> (App veröffentlichen). Im Testmodus verfällt die Anmeldung nach sieben Tagen.</li>
    <li>Klicke auf <strong>Mit Google verbinden</strong>. Google warnt "App nicht überprüft". Das ist normal, weil es deine eigene App ist: <strong>Erweitert</strong>, dann <strong>Weiter zu Jarvis</strong>.</li>
  </ol>
  <label class="klein">Client-Datei (JSON)</label>
  <input type="file" id="datei" accept=".json,application/json">
  <label class="klein">Client-ID</label>
  <input type="text" id="cid" autocomplete="off" placeholder="…apps.googleusercontent.com">
  <label class="klein">Client-Secret</label>
  <input type="password" id="csecret" autocomplete="off" placeholder="GOCSPX-…">
  <button id="speichern">Speichern</button>
  <button id="verbinden" class="primaer">Mit Google verbinden</button>
  <button id="trennen">Trennen</button>
  <div id="meld" class="meld"></div>
</div>

<div class="karte">
  <h2>GMX</h2>
  <p class="klein">Für GMX gibt es keine saubere Schnittstelle. Richte in GMX unter <strong>E-Mail, Einstellungen, Weiterleitung</strong> eine Weiterleitung an dein Gmail ein. Dann liest Jarvis alles an einer Stelle.</p>
</div>
</div>

<script>
(function(){
"use strict";
var $ = function(i){ return document.getElementById(i); };
var key = "";
try { key = localStorage.getItem("jarvis_key") || ""; } catch (e) {}
$("redirect").textContent = location.origin + "/google/zurueck";
function meld(t, fehler){ var m = $("meld"); m.textContent = t; m.className = "meld" + (fehler ? " fehler" : ""); }
async function api(pfad, opt){
  opt = opt || {};
  opt.headers = Object.assign({ "X-Jarvis-Key": key }, opt.headers || {});
  var r = await fetch(pfad, opt);
  var text = await r.text();
  var d = null;
  try { d = JSON.parse(text); } catch (e) {}
  if (!r.ok) throw new Error((d && d.fehler) || text || ("Fehler " + r.status));
  return d;
}
async function laden(){
  try {
    var s = await api("/einrichten/status");
    var g = s.google;
    var el = $("gstatus");
    if (g.verbunden) { el.textContent = "verbunden" + (g.email ? " (" + g.email + ")" : ""); el.className = "status ok"; }
    else if (g.client) { el.textContent = "Client gespeichert, noch nicht verbunden"; el.className = "status"; }
    else { el.textContent = "nicht verbunden"; el.className = "status"; }
  } catch (e) { meld(e.message, true); }
}
$("kopieren").addEventListener("click", function(){
  try { navigator.clipboard.writeText(location.origin + "/google/zurueck"); meld("Adresse kopiert."); } catch (e) { meld("Bitte von Hand kopieren.", true); }
});
$("datei").addEventListener("change", function(){
  var f = $("datei").files[0];
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    try {
      var j = JSON.parse(rd.result);
      var c = j.web || j.installed || j;
      if (!c.client_id || !c.client_secret) throw new Error("x");
      $("cid").value = c.client_id;
      $("csecret").value = c.client_secret;
      meld("Datei gelesen. Jetzt auf Speichern klicken.");
    } catch (e) { meld("Die Datei passt nicht. Nimm die client_secret-Datei aus Google.", true); }
  };
  rd.readAsText(f);
});
$("speichern").addEventListener("click", async function(){
  try {
    await api("/einrichten/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: $("cid").value, client_secret: $("csecret").value }) });
    $("csecret").value = "";
    meld("Gespeichert. Jetzt auf Mit Google verbinden klicken.");
    laden();
  } catch (e) { meld(e.message, true); }
});
$("verbinden").addEventListener("click", async function(){
  try {
    var d = await api("/google/start", { method: "POST" });
    location.href = d.url;
  } catch (e) { meld(e.message, true); }
});
$("trennen").addEventListener("click", async function(){
  try { await api("/einrichten/google/trennen", { method: "POST" }); meld("Getrennt."); laden(); } catch (e) { meld(e.message, true); }
});
if (!key) { $("sperre").hidden = false; }
else { $("inhalt").hidden = false; laden(); }
})();
</script>
</body>
</html>`;
