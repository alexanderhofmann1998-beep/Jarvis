import { schluesselPasst } from "./auth.ts";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  JARVIS_SECRET?: string;
  AI?: unknown;
  SPEICHER?: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Jarvis läuft.", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    // Alles ausser "/" verlangt das Jarvis-Passwort
    const ok = await schluesselPasst(request.headers.get("X-Jarvis-Key"), env.JARVIS_SECRET);
    if (!ok) return new Response("Nicht erlaubt.", { status: 401 });

    if (request.method === "GET" && url.pathname === "/status") {
      // Nur ob etwas eingerichtet ist, nie die Werte
      return Response.json({
        anthropic: Boolean(env.ANTHROPIC_API_KEY),
        speicher: Boolean(env.SPEICHER),
        spracherkennung: Boolean(env.AI),
      });
    }

    return new Response("Nicht gefunden.", { status: 404 });
  },
};
