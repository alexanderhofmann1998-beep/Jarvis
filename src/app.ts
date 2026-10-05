// Jarvis-Web-App. Wichtig: in diesem Text keine Backticks und kein Dollar-Klammer-Zeichen verwenden.
export const MANIFEST = JSON.stringify({
  name: "Jarvis",
  short_name: "Jarvis",
  start_url: "/app",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#0b0b0c",
  theme_color: "#0b0b0c",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
});

export const APP_HTML = String.raw`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#0b0b0c">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon-192.png">
<title>Jarvis</title>
<style>
:root{--lvl:0}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
[hidden]{display:none!important}
html,body{height:100%;margin:0;background:#0b0b0c;color:#ece8e1;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
main{height:100%;display:flex;flex-direction:column;align-items:center;padding:env(safe-area-inset-top,0px) 16px calc(env(safe-area-inset-bottom,0px) + 14px)}
.kopf{width:100%;display:flex;justify-content:space-between;align-items:center;padding-top:18px;color:#e07a2f;font-size:12px;font-weight:600;letter-spacing:.5em}
.kopf button{letter-spacing:normal}
.mitte{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;width:100%}
#kugelfeld{position:relative;width:min(74vw,330px);aspect-ratio:1;display:flex;align-items:center;justify-content:center}
#kugelfeld::before,#kugelfeld::after{content:"";position:absolute;border-radius:50%;pointer-events:none}
#kugelfeld::before{inset:3%;border:1px solid rgba(210,105,30,.4)}
#kugelfeld::after{inset:-9%;border:1px dashed rgba(210,105,30,.2)}
#kugel{width:76%;aspect-ratio:1;border-radius:50%;cursor:pointer;background:radial-gradient(circle at 38% 36%,#e8b98f 0%,#d2691e 34%,#8a3d10 72%,#3a1805 100%);box-shadow:0 0 60px rgba(210,105,30,.35);transform:scale(calc(1 + var(--lvl) * .22));transition:transform .08s linear,box-shadow .3s}
.ruhe #kugel{animation:atmen 5s ease-in-out infinite}
.zuhoeren #kugel{box-shadow:0 0 100px rgba(235,150,70,.65)}
.denken #kugelfeld::before{border-color:#e07a2f;border-top-color:transparent;animation:drehen 1.1s linear infinite}
.sprechen #kugel{animation:puls .9s ease-in-out infinite}
@keyframes atmen{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
@keyframes puls{0%,100%{transform:scale(1);box-shadow:0 0 60px rgba(210,105,30,.35)}50%{transform:scale(1.06);box-shadow:0 0 95px rgba(235,150,70,.6)}}
@keyframes drehen{to{transform:rotate(360deg)}}
#status{font-size:15px;color:#a9a39a;min-height:20px;text-align:center}
#fehler{font-size:13px;color:#e8665a;text-align:center;max-width:90%;min-height:16px}
.leiste{width:100%;max-width:520px;display:flex;gap:8px}
.leiste input{flex:1;min-width:0;background:#161617;border:1px solid #2a2a2c;border-radius:12px;color:#ece8e1;padding:12px 14px;font-size:16px;outline:none}
.leiste input:focus{border-color:#e07a2f}
button{background:#161617;border:1px solid #2a2a2c;border-radius:12px;color:#ece8e1;padding:0 14px;font-size:14px;cursor:pointer;min-height:44px}
button.kopfknopf{min-height:0;padding:6px 10px;border:none;background:none;color:#a9a39a;font-size:13px}
#tafel,#login{position:fixed;inset:0;background:#0b0b0c;z-index:10;display:flex;flex-direction:column;padding:env(safe-area-inset-top,0px) 16px calc(env(safe-area-inset-bottom,0px) + 16px)}
#tafel .oben{display:flex;justify-content:space-between;align-items:center;padding:16px 0}
#liste{flex:1;overflow-y:auto}
.msg{margin:0 0 14px;padding:10px 12px;border-radius:12px;background:#161617}
.msg.jarvis{border-left:3px solid #e07a2f}
.msg.hinweis{border-left:3px solid #e8665a}
.msg small{display:block;color:#8a847b;margin-bottom:4px}
.msg p{margin:0;line-height:1.45;white-space:pre-wrap}
#login{align-items:center;justify-content:center;gap:14px;text-align:center}
#login h1{margin:0;color:#e07a2f;letter-spacing:.5em;font-size:16px}
#login input{width:100%;max-width:320px;background:#161617;border:1px solid #2a2a2c;border-radius:12px;color:#ece8e1;padding:13px 14px;font-size:16px;outline:none}
#login .primaer{background:#d2691e;border-color:#d2691e;color:#fff;min-width:160px}
#lfehler{color:#e8665a;font-size:14px;min-height:18px}
</style>
</head>
<body>
<main id="haupt" class="ruhe">
  <div class="kopf"><span>JARVIS</span><button class="kopfknopf" id="tafelbtn">Tafel</button></div>
  <div class="mitte">
    <div id="kugelfeld"><div id="kugel"></div></div>
    <div id="status">Tippe auf die Kugel</div>
    <div id="fehler"></div>
  </div>
  <div class="leiste">
    <input id="eingabe" type="text" placeholder="Oder schreib Jarvis …" autocomplete="off" enterkeyhint="send">
    <button id="senden">Senden</button>
  </div>
</main>

<section id="tafel" hidden>
  <div class="oben"><strong>Tafel</strong><span><button class="kopfknopf" id="abmelden">Abmelden</button><button class="kopfknopf" id="zu">Schließen</button></span></div>
  <div id="liste"></div>
</section>

<section id="login" hidden>
  <h1>JARVIS</h1>
  <input id="pw" type="password" placeholder="Jarvis-Passwort" autocomplete="current-password">
  <div id="lfehler"></div>
  <button class="primaer" id="anmelden">Anmelden</button>
</section>

<script>
(function(){
"use strict";
var $ = function(i){ return document.getElementById(i); };
var haupt = $("haupt"), statusEl = $("status"), fehlerEl = $("fehler");
var SPEICHER = "jarvis_key";
var key = "";
try { key = localStorage.getItem(SPEICHER) || ""; } catch (e) {}
var verlauf = [];
var zustand = "ruhe";
var entsperrt = false;
var queue = [], spricht = false, serverFertig = true, dauerhoeren = false, beenden = false;
var stimme = null, aufnahme = null, aktuell = null, pendingNutzer = "";
var TEXTE = { ruhe: "Tippe auf die Kugel", zuhoeren: "Ich höre zu", denken: "Ich denke nach", sprechen: "Ich spreche" };

function setLevel(l){ $("kugel").style.setProperty("--lvl", String(Math.min(1, l))); }
function setZustand(z){
  zustand = z;
  haupt.className = z;
  statusEl.textContent = TEXTE[z];
  if (z !== "zuhoeren") setLevel(0);
}
function tafelAdd(wer, text){
  var d = document.createElement("div");
  d.className = "msg " + wer;
  var s = document.createElement("small");
  s.textContent = wer === "nutzer" ? "Du" : (wer === "jarvis" ? "Jarvis" : "Hinweis");
  var p = document.createElement("p");
  p.textContent = text;
  d.appendChild(s); d.appendChild(p);
  $("liste").appendChild(d);
  $("liste").scrollTop = $("liste").scrollHeight;
}
function zeigeFehler(t){ fehlerEl.textContent = t; tafelAdd("hinweis", t); }

/* ---------- Anmeldung ---------- */
function zeigeLogin(msg){ $("login").hidden = false; $("lfehler").textContent = msg || ""; }
async function anmelden(){
  var pw = $("pw").value.trim();
  if (!pw) return;
  try {
    var r = await fetch("/status", { headers: { "X-Jarvis-Key": pw } });
    if (r.ok) {
      key = pw;
      try { localStorage.setItem(SPEICHER, pw); } catch (e) {}
      $("pw").value = "";
      $("login").hidden = true;
    } else if (r.status === 429) {
      $("lfehler").textContent = "Zu viele Fehlversuche. Warte eine Viertelstunde.";
    } else {
      $("lfehler").textContent = "Nicht erlaubt.";
    }
  } catch (e) {
    $("lfehler").textContent = "Keine Verbindung.";
  }
}
function abmelden(){
  key = "";
  try { localStorage.removeItem(SPEICHER); } catch (e) {}
  $("tafel").hidden = true;
  zeigeLogin("");
}

/* ---------- Ton freischalten und Stimme ---------- */
function entsperren(){
  if (entsperrt) return;
  entsperrt = true;
  try {
    var a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    a.play().catch(function(){});
  } catch (e) {}
  try {
    var u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function waehleStimme(){
  var vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  var best = null, bestScore = -1;
  vs.forEach(function(v){
    if (!/^de/i.test(v.lang)) return;
    var s = 0;
    if (/premium|enhanced|erweitert|neural|natural/i.test(v.name)) s += 3;
    if (/google/i.test(v.name)) s += 2;
    if (/de[-_]DE/i.test(v.lang)) s += 1;
    if (s > bestScore) { best = v; bestScore = s; }
  });
  stimme = best;
}
if (window.speechSynthesis) {
  waehleStimme();
  speechSynthesis.onvoiceschanged = waehleStimme;
}

/* ---------- Sprechen ---------- */
function sprich(t){ queue.push(t); if (!spricht) naechster(); }
function naechster(){
  if (!queue.length) {
    spricht = false;
    if (serverFertig) gespraechEnde();
    return;
  }
  spricht = true;
  setZustand("sprechen");
  var u = new SpeechSynthesisUtterance(queue.shift());
  u.lang = "de-DE";
  if (stimme) u.voice = stimme;
  u.rate = 1;
  u.onend = naechster;
  u.onerror = naechster;
  speechSynthesis.speak(u);
}
function abbrechenSprechen(){
  queue = [];
  spricht = false;
  try { speechSynthesis.cancel(); } catch (e) {}
  if (aktuell) { try { aktuell.abort(); } catch (e) {} }
  serverFertig = true;
}
function gespraechEnde(){
  setZustand("ruhe");
  if (dauerhoeren && !beenden) setTimeout(aufnehmen, 300);
  else dauerhoeren = false;
}

/* ---------- Aufnehmen (16 kHz Mono WAV, Ende nach ca. 0,7 s Stille) ---------- */
async function aufnehmen(){
  if (zustand !== "ruhe") return;
  var stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    zeigeFehler("Mikrofon nicht erlaubt. Erlaube es in Chrome unter den Website-Einstellungen.");
    dauerhoeren = false;
    return;
  }
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = new AC();
  var sr = ctx.sampleRate;
  if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
  var src = ctx.createMediaStreamSource(stream);
  var proc = ctx.createScriptProcessor(4096, 1, 1);
  var chunks = [], sprach = false, fertig = false, kal = [];
  var t0 = performance.now(), letzte = 0, schwelle = 0.015;
  function aufraeumen(){
    try { proc.disconnect(); src.disconnect(); } catch (e) {}
    stream.getTracks().forEach(function(t){ t.stop(); });
    try { ctx.close(); } catch (e) {}
    aufnahme = null;
  }
  function stopp(senden){
    if (fertig) return;
    fertig = true;
    aufraeumen();
    if (senden && sprach) sendeAudio(chunks, sr);
    else { dauerhoeren = false; setZustand("ruhe"); }
  }
  proc.onaudioprocess = function(ev){
    if (fertig) return;
    var c = new Float32Array(ev.inputBuffer.getChannelData(0));
    chunks.push(c);
    var s = 0;
    for (var i = 0; i < c.length; i++) s += c[i] * c[i];
    var rms = Math.sqrt(s / c.length);
    setLevel(rms * 10);
    var t = performance.now();
    if (kal.length < 4) {
      kal.push(rms);
      if (kal.length === 4) {
        var m = kal.reduce(function(a, b){ return a + b; }, 0) / 4;
        schwelle = Math.min(0.03, Math.max(0.012, m * 3));
      }
      return;
    }
    if (rms > schwelle) { sprach = true; letzte = t; }
    if (sprach && t - letzte > 700) stopp(true);
    else if (!sprach && t - t0 > 8000) stopp(false);
    else if (t - t0 > 60000) stopp(true);
  };
  src.connect(proc);
  proc.connect(ctx.destination);
  aufnahme = { stopp: stopp };
  setZustand("zuhoeren");
}

function kodiereWav(chunks, sr){
  var n = 0;
  chunks.forEach(function(c){ n += c.length; });
  var all = new Float32Array(n), o = 0;
  chunks.forEach(function(c){ all.set(c, o); o += c.length; });
  var ziel = 16000, out;
  if (sr === ziel) { out = all; }
  else {
    var ratio = sr / ziel, len = Math.floor(all.length / ratio);
    out = new Float32Array(len);
    for (var i = 0; i < len; i++) {
      var p = i * ratio, i0 = Math.floor(p), i1 = Math.min(i0 + 1, all.length - 1), f = p - i0;
      out[i] = all[i0] * (1 - f) + all[i1] * f;
    }
  }
  var buf = new ArrayBuffer(44 + out.length * 2), v = new DataView(buf);
  function w(off, s){ for (var k = 0; k < s.length; k++) v.setUint8(off + k, s.charCodeAt(k)); }
  w(0, "RIFF"); v.setUint32(4, 36 + out.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, ziel, true); v.setUint32(28, ziel * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, out.length * 2, true);
  for (var j = 0; j < out.length; j++) {
    var s2 = Math.max(-1, Math.min(1, out[j]));
    v.setInt16(44 + j * 2, s2 < 0 ? s2 * 0x8000 : s2 * 0x7fff, true);
  }
  return buf;
}

/* ---------- Mit Jarvis reden ---------- */
function sendeAudio(chunks, sr){
  setZustand("denken");
  var fd = new FormData();
  fd.append("audio", new Blob([kodiereWav(chunks, sr)], { type: "audio/wav" }), "aufnahme.wav");
  fd.append("verlauf", JSON.stringify(verlauf));
  starte(fd, false);
}
function textSenden(){
  var t = $("eingabe").value.trim();
  if (!t || zustand === "denken") return;
  entsperren();
  $("eingabe").value = "";
  if (zustand === "sprechen") abbrechenSprechen();
  if (aufnahme) aufnahme.stopp(false);
  dauerhoeren = false;
  setZustand("denken");
  starte(JSON.stringify({ text: t, verlauf: verlauf }), true);
}
async function starte(body, json){
  var ctrl = new AbortController();
  aktuell = ctrl;
  queue = []; spricht = false; serverFertig = false; beenden = false; pendingNutzer = "";
  fehlerEl.textContent = "";
  try {
    var opt = { method: "POST", headers: { "X-Jarvis-Key": key }, body: body, signal: ctrl.signal };
    if (json) opt.headers["Content-Type"] = "application/json";
    var r = await fetch("/gespraech", opt);
    await lies(r);
  } catch (e) {
    if (e && e.name === "AbortError") return;
    zeigeFehler("Keine Verbindung zu Jarvis.");
    serverFertig = true; dauerhoeren = false;
    setZustand("ruhe");
  }
}
async function lies(r){
  if (!r.ok) {
    serverFertig = true; dauerhoeren = false;
    setZustand("ruhe");
    if (r.status === 401) { key = ""; try { localStorage.removeItem(SPEICHER); } catch (e) {} zeigeLogin("Passwort wird nicht akzeptiert."); }
    else if (r.status === 429) zeigeFehler("Zu viele Fehlversuche. Warte eine Viertelstunde.");
    else zeigeFehler("Fehler " + r.status + ": " + (await r.text()).slice(0, 200));
    return;
  }
  var reader = r.body.getReader(), dec = new TextDecoder(), puffer = "";
  while (true) {
    var res = await reader.read();
    if (res.done) break;
    puffer += dec.decode(res.value, { stream: true });
    var teile = puffer.split("\n");
    puffer = teile.pop();
    teile.forEach(verarbeite);
  }
  if (puffer.trim()) verarbeite(puffer);
  if (!serverFertig) { serverFertig = true; if (!spricht && !queue.length) gespraechEnde(); }
}
function verarbeite(zeile){
  if (!zeile.trim()) return;
  var o;
  try { o = JSON.parse(zeile); } catch (e) { return; }
  if (o.t === "gehoert") {
    pendingNutzer = o.text || "";
    if (pendingNutzer) tafelAdd("nutzer", pendingNutzer);
  } else if (o.t === "satz") {
    sprich(o.text);
  } else if (o.t === "fertig") {
    if (pendingNutzer) verlauf.push({ role: "user", content: pendingNutzer });
    if (o.antwort) { verlauf.push({ role: "assistant", content: o.antwort }); tafelAdd("jarvis", o.antwort); }
    verlauf = verlauf.slice(-12);
    if (o.ende) beenden = true;
    if (!pendingNutzer) dauerhoeren = false;
    serverFertig = true;
    if (!spricht && !queue.length) gespraechEnde();
  } else if (o.t === "fehler") {
    zeigeFehler(o.text);
    dauerhoeren = false;
    serverFertig = true;
    if (!spricht) setZustand("ruhe");
  }
}

/* ---------- Bedienung ---------- */
$("kugel").addEventListener("click", function(){
  entsperren();
  if (zustand === "ruhe") { dauerhoeren = true; aufnehmen(); }
  else if (zustand === "zuhoeren") { if (aufnahme) aufnahme.stopp(true); }
  else if (zustand === "sprechen") { abbrechenSprechen(); dauerhoeren = false; setZustand("ruhe"); }
});
$("senden").addEventListener("click", textSenden);
$("eingabe").addEventListener("keydown", function(e){ if (e.key === "Enter") textSenden(); });
$("tafelbtn").addEventListener("click", function(){ $("tafel").hidden = false; });
$("zu").addEventListener("click", function(){ $("tafel").hidden = true; });
$("abmelden").addEventListener("click", abmelden);
$("anmelden").addEventListener("click", anmelden);
$("pw").addEventListener("keydown", function(e){ if (e.key === "Enter") anmelden(); });
if (!key) zeigeLogin("");
})();
</script>
</body>
</html>`;
