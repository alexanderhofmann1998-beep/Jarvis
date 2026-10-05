type AiBinding = { run(model: string, input: unknown): Promise<unknown> };

const HALLUZINATIONEN = [
  "untertitel von", "untertitel der", "untertitelung", "untertitel im auftrag",
  "danke fürs zuschauen", "danke für's zuschauen", "vielen dank fürs zuschauen",
  "vielen dank für ihre aufmerksamkeit", "bis zum nächsten mal", "amara.org",
  "thanks for watching", "thank you for watching",
];

// Whisper erfindet bei Stille Texte. Die gelten als "nichts gesagt".
export function bereinigeErkennung(text: string): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const norm = t.toLowerCase().replace(/[.!?,…"]+/g, " ").replace(/\s+/g, " ").trim();
  if (!norm || !/[\p{L}\p{N}]/u.test(norm)) return "";
  if (norm.length < 80 && HALLUZINATIONEN.some((h) => norm.includes(h))) return "";
  return t;
}

export function bytesZuBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export async function erkenne(ai: AiBinding | undefined, audio: ArrayBuffer): Promise<string> {
  if (!ai) throw new Error("Spracherkennung ist nicht eingerichtet (Workers-AI-Bindung AI fehlt).");
  const bytes = new Uint8Array(audio);
  let text = "";
  try {
    const r = (await ai.run("@cf/openai/whisper-large-v3-turbo", {
      audio: bytesZuBase64(bytes),
      language: "de",
    })) as { text?: string };
    text = r?.text ?? "";
  } catch {
    const r = (await ai.run("@cf/openai/whisper", { audio: Array.from(bytes) })) as { text?: string };
    text = r?.text ?? "";
  }
  return bereinigeErkennung(text);
}
