import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./index.ts";
import { MODELL_ERSATZ, MODELL_GESPRAECH } from "./config.ts";
import { istModellFehler, pruefeSchluessel } from "./fehler.ts";
import { grundregeln } from "./prompt.ts";
import { createSatzTeiler } from "./saetze.ts";
import type { Msg } from "./verlauf.ts";
import { jetztText } from "./zeit.ts";

const MAX_RUNDEN = 6;

const WEBSUCHE = { type: "web_search_20250305", name: "web_search", max_uses: 3 };

export async function jarvis(
  befehl: string,
  verlauf: Msg[],
  env: Env,
  onSatz: (satz: string) => void,
): Promise<string> {
  const keyProblem = pruefeSchluessel(env.ANTHROPIC_API_KEY);
  if (keyProblem) throw new Error(keyProblem);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const system = [{ type: "text" as const, text: grundregeln(), cache_control: { type: "ephemeral" as const } }];

  // Aufbau: Verlauf der letzten Minuten, dann der neue Befehl mit Datum und Uhrzeit
  const messages: any[] = [
    ...verlauf,
    { role: "user", content: "Heute ist " + jetztText() + ". " + befehl },
  ];

  // Erst Sonnet mit Websuche, dann ohne Websuche, dann Haiku. Weiter nur bei 400/404 (kein Guthabenfehler).
  const versuche = [
    { modell: MODELL_GESPRAECH, suche: true },
    { modell: MODELL_GESPRAECH, suche: false },
    { modell: MODELL_ERSATZ, suche: false },
  ];

  let letzterFehler: unknown;
  for (const v of versuche) {
    const teiler = createSatzTeiler();
    let gesamt = "";
    const verlaufKopie = [...messages];
    try {
      for (let runde = 0; runde < MAX_RUNDEN; runde++) {
        const stream = client.messages.stream({
          model: v.modell,
          max_tokens: 1024,
          system,
          messages: verlaufKopie,
          ...(v.suche ? { tools: [WEBSUCHE] as any } : {}),
        });
        stream.on("streamEvent", (e: any) => {
          let text = "";
          if (e.type === "content_block_start" && e.content_block?.type === "text") text = "\n";
          if (e.type === "content_block_delta" && e.delta?.type === "text_delta") text = e.delta.text;
          if (!text) return;
          gesamt += text;
          for (const s of teiler.push(text)) onSatz(s);
        });
        const msg = await stream.finalMessage();
        if (msg.stop_reason === "pause_turn") {
          verlaufKopie.push({ role: "assistant", content: msg.content });
          continue;
        }
        break;
      }
      for (const s of teiler.flush()) onSatz(s);
      return gesamt.trim();
    } catch (err) {
      letzterFehler = err;
      if (gesamt.trim() || !istModellFehler(err)) throw err;
    }
  }
  throw letzterFehler;
}
