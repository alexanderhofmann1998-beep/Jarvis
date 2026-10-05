import { schluesselPasst } from "./auth.ts";
import { APP_HTML, MANIFEST } from "./app.ts";
import { DATENSCHUTZ_HTML } from "./datenschutz.ts";
import { EINRICHTEN_HTML } from "./einrichten.ts";
import { abschluss, googleStatus, speichereClient, startUrl, trenne } from "./google.ts";
import { ICON_192, ICON_512, base64ZuBytes } from "./icon.ts";
import { fehlerText } from "./fehler.ts";
import { jarvis } from "./jarvis.ts";
import { kurzantwort } from "./kurz.ts";
import { protokolliere } from "./notion.ts";
import { fehlversuch, istGesperrt } from "./ratelimit.ts";
import { baueAnhaenge } from "./dateien.ts";
import { suchagentLauf } from "./suchagent.ts";
import { bereinigeVerlauf } from "./verlauf.ts";
import { erkenne } from "./whisper.ts";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  JARVIS_SECRET?: string;
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  SPEICHER?: KVNamespace;
  NOTION_TOKEN?: string;
  NOTION_WISSEN_ID?: string;
  TWELVEDATA_API_KEY?: string;
  FRED_API_KEY?: string;
}

const TEXT = { "content-type": "text/plain; charset=utf-8" };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pfad = url.pathname;
    const get = request.method === "GET";

    // Offene Adressen (die App-Hülle fragt das Passwort selbst ab)
    if (get && pfad === "/") return new Response("Jarvis läuft.", { headers: TEXT });
    if (get && pfad === "/app") {
      return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    if (get && pfad === "/manifest.webmanifest") {
      return new Response(MANIFEST, { headers: { "content-type": "application/manifest+json" } });
    }
    if (get && (pfad === "/icon.png" || pfad === "/icon-192.png")) {
      const bytes = base64ZuBytes(pfad === "/icon.png" ? ICON_512 : ICON_192);
      return new Response(bytes, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    }

    if (get && pfad === "/datenschutz") {
      return new Response(DATENSCHUTZ_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (get && pfad === "/einrichten") {
      return new Response(EINRICHTEN_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    if (get && pfad === "/google/zurueck") return googleZurueck(url, env);

    // Ab hier nur mit Passwort
    const ip = request.headers.get("CF-Connecting-IP") ?? "unbekannt";
    if (await istGesperrt(env, ip)) {
      return new Response("Zu viele Fehlversuche. Bitte warte eine Viertelstunde.", { status: 429, headers: TEXT });
    }
    const ok = await schluesselPasst(request.headers.get("X-Jarvis-Key"), env.JARVIS_SECRET);
    if (!ok) {
      ctx.waitUntil(fehlversuch(env, ip));
      return new Response("Nicht erlaubt.", { status: 401, headers: TEXT });
    }

    if (get && pfad === "/status") {
      // Nur ob etwas eingerichtet ist, nie die Werte
      return Response.json({
        anthropic: Boolean(env.ANTHROPIC_API_KEY),
        speicher: Boolean(env.SPEICHER),
        spracherkennung: Boolean(env.AI),
        notion: Boolean(env.NOTION_TOKEN),
        google: (await googleStatus(env)).verbunden,
      });
    }
    if (get && pfad === "/einrichten/status") {
      const letzter = await env.SPEICHER?.get("suchagent:letzter");
      return Response.json({ google: await googleStatus(env), suchagent: letzter ? JSON.parse(letzter) : null });
    }
    if (request.method === "POST" && pfad === "/einrichten/google") return googleSpeichern(request, env);
    if (request.method === "POST" && pfad === "/einrichten/google/trennen") {
      await trenne(env);
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && pfad === "/google/start") {
      try {
        return Response.json({ url: await startUrl(env, url.origin) });
      } catch (e) {
        return Response.json({ fehler: e instanceof Error ? e.message : String(e) }, { status: 400 });
      }
    }

    if (request.method === "POST" && pfad === "/gespraech") return gespraech(request, env, ctx);
    if (request.method === "POST" && pfad === "/befehl") return befehl(request, env, ctx);

    if (request.method === "POST" && pfad === "/hintergrund/start") {
      const b = (await request.json().catch(() => ({}))) as { runde?: string };
      if (b.runde !== "suchagent") return Response.json({ fehler: "Unbekannte Runde. Möglich: suchagent." }, { status: 400 });
      return Response.json({ ergebnis: await suchagentLauf(env) });
    }

    return new Response("Nicht gefunden.", { status: 404, headers: TEXT });
  },

  // Zeitplan (Cron): stündlich zur Viertelstunde läuft der Such-Agent
  async scheduled(_controller: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(suchagentLauf(env).then(() => undefined));
  },
};

async function gespraech(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  let kette: Promise<unknown> = Promise.resolve();
  const sende = (o: object) => {
    kette = kette.then(() => writer.write(enc.encode(JSON.stringify(o) + "\n"))).catch(() => {});
  };

  ctx.waitUntil(
    (async () => {
      let gesagt = "";
      let bloecke: any[] = [];
      try {
        let text = "";
        let verlauf: unknown = [];
        const typ = request.headers.get("content-type") ?? "";
        if (typ.includes("application/json")) {
          const b = (await request.json()) as { text?: string; verlauf?: unknown };
          text = (b.text ?? "").trim();
          verlauf = b.verlauf;
        } else {
          const form = await request.formData();
          const datei = form.get("audio");
          const v = form.get("verlauf");
          if (typeof v === "string") {
            try { verlauf = JSON.parse(v); } catch { verlauf = []; }
          }
          const t0 = form.get("text");
          if (typeof t0 === "string") text = t0.trim();
          if (datei && typeof datei !== "string" && datei.size > 0) {
            text = await erkenne(env.AI, await datei.arrayBuffer());
          }
          const anh = await baueAnhaenge(form.getAll("datei").filter((x): x is File => typeof x !== "string"));
          bloecke = anh.bloecke;
          if (anh.fehler.length) sende({ t: "hinweis", text: anh.fehler.join(" ") });
          if (!text && bloecke.length) text = "Schau dir den Anhang an und gib mir deine Einschätzung.";
        }

        gesagt = text;
        sende({ t: "gehoert", text });
        if (!text) {
          sende({ t: "fertig", antwort: "" });
          return;
        }

        const kurz = bloecke.length ? null : kurzantwort(text);
        if (kurz) {
          sende({ t: "satz", text: kurz.antwort });
          sende({ t: "fertig", antwort: kurz.antwort, ende: kurz.ende });
          return;
        }

        const antwort = await jarvis(text, bereinigeVerlauf(verlauf), env, (satz) => sende({ t: "satz", text: satz }), bloecke);
        sende({ t: "fertig", antwort });
        ctx.waitUntil(protokolliere(env, { befehl: text, antwort, quelle: "App", erfolg: true }));
      } catch (err) {
        const meldung = fehlerText(err);
        sende({ t: "fehler", text: meldung });
        if (gesagt) ctx.waitUntil(protokolliere(env, { befehl: gesagt, antwort: meldung, quelle: "App", erfolg: false }));
      } finally {
        await kette;
        await writer.close();
      }
    })(),
  );

  return new Response(readable, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

async function befehl(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const b = (await request.json()) as { text?: string };
    const text = (b.text ?? "").trim();
    if (!text) return new Response("", { headers: TEXT });
    const kurz = kurzantwort(text);
    if (kurz) return new Response(kurz.antwort, { headers: TEXT });
    const antwort = await jarvis(text, [], env, () => {});
    ctx.waitUntil(protokolliere(env, { befehl: text, antwort, quelle: "Siri", erfolg: true }));
    return new Response(antwort, { headers: TEXT });
  } catch (err) {
    return new Response(fehlerText(err), { status: 500, headers: TEXT });
  }
}

async function googleSpeichern(request: Request, env: Env): Promise<Response> {
  const b = (await request.json().catch(() => ({}))) as { client_id?: string; client_secret?: string };
  const id = (b.client_id ?? "").trim();
  const secret = (b.client_secret ?? "").trim();
  if (!id.endsWith(".apps.googleusercontent.com")) {
    return Response.json({ fehler: "Die Client-ID sieht falsch aus. Sie endet auf apps.googleusercontent.com." }, { status: 400 });
  }
  if (!secret) return Response.json({ fehler: "Das Client-Secret fehlt." }, { status: 400 });
  await speichereClient(env, id, secret);
  return Response.json({ ok: true });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function googleZurueck(url: URL, env: Env): Promise<Response> {
  const seite = (titel: string, text: string) =>
    new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><body style='background:#0b0b0c;color:#ece8e1;font-family:system-ui;padding:24px'><h2>" +
        esc(titel) + "</h2><p>" + esc(text) + "</p><p><a style='color:#e8a46a' href='/einrichten'>Zurück zu Einrichten</a></p>",
      { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
    );
  const fehler = url.searchParams.get("error");
  if (fehler) return seite("Nicht verbunden", "Google meldet: " + fehler);
  try {
    await abschluss(env, url.origin, url.searchParams.get("code") ?? "", url.searchParams.get("state") ?? "");
    return seite("Verbunden", "Google ist mit Jarvis verbunden. Du kannst dieses Fenster schließen.");
  } catch (e) {
    return seite("Nicht verbunden", e instanceof Error ? e.message : String(e));
  }
}
