import type { Env } from "./index.ts";

export class GoogleFehler extends Error {}

export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
];

export type GoogleClient = { id: string; secret: string };

export async function ladeClient(env: Env): Promise<GoogleClient | null> {
  const raw = await env.SPEICHER?.get("google:client");
  if (!raw) return null;
  try { return JSON.parse(raw) as GoogleClient; } catch { return null; }
}

export async function speichereClient(env: Env, id: string, secret: string): Promise<void> {
  await env.SPEICHER?.put("google:client", JSON.stringify({ id: id.trim(), secret: secret.trim() }));
}

export async function googleStatus(env: Env): Promise<{ client: boolean; verbunden: boolean; email: string }> {
  const [c, r, e] = await Promise.all([ladeClient(env), env.SPEICHER?.get("google:refresh"), env.SPEICHER?.get("google:email")]);
  return { client: Boolean(c), verbunden: Boolean(r), email: e ?? "" };
}

export async function trenne(env: Env): Promise<void> {
  for (const k of ["google:refresh", "google:at", "google:email"]) await env.SPEICHER?.delete(k);
}

function zufall(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function startUrl(env: Env, origin: string): Promise<string> {
  const c = await ladeClient(env);
  if (!c) throw new GoogleFehler("Erst Client-ID und Client-Secret speichern.");
  const state = zufall();
  await env.SPEICHER?.put("google:state:" + state, "1", { expirationTtl: 600 });
  const p = new URLSearchParams({
    client_id: c.id,
    redirect_uri: origin + "/google/zurueck",
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}

export async function abschluss(env: Env, origin: string, code: string, state: string): Promise<string> {
  const k = "google:state:" + state;
  if (!state || !(await env.SPEICHER?.get(k))) throw new GoogleFehler("Die Anmeldung ist abgelaufen oder ungültig. Starte sie auf der Einrichten-Seite neu.");
  await env.SPEICHER?.delete(k);
  const c = await ladeClient(env);
  if (!c) throw new GoogleFehler("Client-ID fehlt.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: c.id, client_secret: c.secret, redirect_uri: origin + "/google/zurueck", grant_type: "authorization_code" }),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d?.error === "redirect_uri_mismatch") throw new GoogleFehler("redirect_uri_mismatch: Die Weiterleitungsadresse in Google stimmt nicht exakt. Kopiere sie von der Einrichten-Seite.");
    throw new GoogleFehler("Google lehnt die Anmeldung ab: " + String(d?.error_description ?? d?.error ?? r.status).slice(0, 200));
  }
  if (!d.refresh_token) throw new GoogleFehler("Google hat keinen dauerhaften Zugang geliefert. Entferne Jarvis unter myaccount.google.com/permissions und verbinde neu.");
  await env.SPEICHER?.put("google:refresh", d.refresh_token);
  await env.SPEICHER?.put("google:at", JSON.stringify({ token: d.access_token, exp: Date.now() + (d.expires_in ?? 3600) * 1000 }), { expirationTtl: 3000 });
  try {
    const p = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: "Bearer " + d.access_token } });
    const pj: any = await p.json();
    if (pj?.emailAddress) await env.SPEICHER?.put("google:email", pj.emailAddress);
  } catch { /* E-Mail-Adresse ist nur ein Zusatz */ }
  return "ok";
}

async function accessToken(env: Env, erzwingen = false): Promise<string> {
  if (!erzwingen) {
    const c = await env.SPEICHER?.get("google:at");
    if (c) {
      try { const o = JSON.parse(c); if (o.exp > Date.now() + 60000) return o.token; } catch { /* neu holen */ }
    }
  }
  const [cfg, refresh] = await Promise.all([ladeClient(env), env.SPEICHER?.get("google:refresh")]);
  if (!cfg || !refresh) throw new GoogleFehler("Google ist nicht verbunden. Öffne in der App die Einrichten-Seite.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.id, client_secret: cfg.secret, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d?.error === "invalid_grant") {
      throw new GoogleFehler("Die Google-Anmeldung ist abgelaufen. Verbinde Google auf der Einrichten-Seite neu. Passiert das nach sieben Tagen, ist die Google-App noch im Testmodus: in Google auf In Produktion stellen.");
    }
    throw new GoogleFehler("Google-Anmeldung fehlgeschlagen: " + String(d?.error_description ?? d?.error ?? r.status).slice(0, 200));
  }
  await env.SPEICHER?.put("google:at", JSON.stringify({ token: d.access_token, exp: Date.now() + (d.expires_in ?? 3600) * 1000 }), { expirationTtl: 3000 });
  return d.access_token;
}

export function googleFehlerText(status: number, data: any): string {
  const msg = String(data?.error?.message ?? "");
  if (status === 403 && /has not been used|disabled|accessNotConfigured/i.test(msg + JSON.stringify(data?.error?.errors ?? ""))) {
    return "Die Gmail- oder Kalender-API ist in der Google Cloud Console noch nicht aktiviert.";
  }
  if (status === 403) return "Google verweigert den Zugriff (" + msg.slice(0, 120) + "). Verbinde Google neu und erlaube beide Bereiche.";
  if (status === 404) return "Google findet das nicht (" + msg.slice(0, 120) + ").";
  if (status === 429) return "Google ist gerade ausgelastet. Versuch es gleich noch mal.";
  return "Google-Fehler " + status + ": " + msg.slice(0, 200);
}

export async function gfetch(env: Env, url: string, init: { method?: string; body?: unknown } = {}, zweiter = false): Promise<any> {
  const token = await accessToken(env, zweiter);
  const r = await fetch(url, {
    method: init.method ?? "GET",
    headers: { Authorization: "Bearer " + token, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (r.status === 401 && !zweiter) return gfetch(env, url, init, true);
  if (r.status === 204) return null;
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new GoogleFehler(googleFehlerText(r.status, d));
  return d;
}
