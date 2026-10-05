export function pruefeSchluessel(key: string | undefined): string | null {
  if (!key || key.trim() === "") {
    return "Der Anthropic-Schlüssel fehlt. Lege ihn in Cloudflare unter Variablen und Geheimnisse als ANTHROPIC_API_KEY an.";
  }
  if (!key.startsWith("sk-ant-")) {
    return "Der Anthropic-Schlüssel sieht falsch aus (Anfang: " + key.slice(0, 4) + ", Länge " + key.length + "). Er beginnt normalerweise mit sk-ant-.";
  }
  return null;
}

function statusVon(err: unknown): number | undefined {
  const s = (err as { status?: unknown })?.status;
  return typeof s === "number" ? s : undefined;
}
function textVon(err: unknown): string {
  const m = (err as { message?: unknown })?.message;
  return typeof m === "string" ? m : String(err ?? "");
}

export function fehlerText(err: unknown): string {
  const status = statusVon(err);
  const msg = textVon(err);
  if (/credit balance/i.test(msg)) {
    return "Jarvis' API-Guthaben ist leer. Das ist nicht dein Claude-Abo. Aufladen unter console.anthropic.com, Billing.";
  }
  if (/too many subrequests/i.test(msg)) return "Zu viele Daten auf einmal. Frag bitte enger.";
  if (status === 401) return "Der Anthropic-Schlüssel wird nicht akzeptiert.";
  if (status === 429) return "Claude ist gerade ausgelastet. Versuch es gleich noch mal.";
  if (status !== undefined && status >= 500) return "Claude ist gerade nicht erreichbar. Versuch es gleich noch mal.";
  return "Da ist etwas schiefgelaufen: " + msg.slice(0, 200);
}

// 400 oder 404, aber kein Guthabenfehler: dann lohnt sich das Ersatzmodell
export function istModellFehler(err: unknown): boolean {
  const status = statusVon(err);
  if (status !== 400 && status !== 404) return false;
  return !/credit balance/i.test(textVon(err));
}
