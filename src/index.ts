import { schluesselPasst } from "./auth.ts";
import { APP_HTML, MANIFEST } from "./app.ts";
import { ICON_192, ICON_512, base64ZuBytes } from "./icon.ts";
import { fehlerText } from "./fehler.ts";
import { jarvis } from "./jarvis.ts";
import { kurzantwort } from "./kurz.ts";
import { protokolliere } from "./notion.ts";
import { fehlversuch, istGesperrt } from "./ratelimit.ts";
import { bereinigeVerlauf } from "./verlauf.ts";
import { erkenne } from "./whisper.ts";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  JARVIS_SECRET?: string;
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  SPEICHER?: KVNamespace;
  NOTION_TOKEN?: string;
  NOTION_WISSEN_ID?: string;
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
      });
    }

    if (request.method === "POST" && pfad === "/gespraech") return gespraech(request, env, ctx);
    if (request.method === "POST" && pfad === "/befehl") return befehl(request, env, ctx);

    return new Response("Nicht gefunden.", { status: 404, headers: TEXT });
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
          if (datei && typeof datei !== "string") {
            text = await erkenne(env.AI, await datei.arrayBuffer());
          }
        }

        gesagt = text;
        sende({ t: "gehoert", text });
        if (!text) {
          sende({ t: "fertig", antwort: "" });
          return;
        }

        const kurz = kurzantwort(text);
        if (kurz) {
          sende({ t: "satz", text: kurz.antwort });
          sende({ t: "fertig", antwort: kurz.antwort, ende: kurz.ende });
          return;
        }

        const antwort = await jarvis(text, bereinigeVerlauf(verlauf), env, (satz) => sende({ t: "satz", text: satz }));
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
