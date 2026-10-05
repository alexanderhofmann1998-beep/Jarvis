import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./index.ts";
import { MODELL_ERSATZ, MODELL_GESPRAECH } from "./config.ts";
import { istModellFehler, pruefeSchluessel } from "./fehler.ts";
import { ladeRegeln, ladeWissenSicher } from "./gedaechtnis.ts";
import { grundregeln, wissenBlock } from "./prompt.ts";
import { createSatzTeiler } from "./saetze.ts";
import { WERKZEUGE, fuehreAus } from "./tools.ts";
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

  // Wissen und Regeln laden. Fehlt etwas, laeuft das Gespraech trotzdem.
  const [wissen, regeln] = await Promise.all([ladeWissenSicher(env), ladeRegeln(env)]);
  const system = [
    { type: "text" as const, text: grundregeln(), cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: wissenBlock(wissen.text, regeln, wissen.problem), cache_control: { type: "ephemeral" as const } },
  ];

  const messages: any[] = [
    ...verlauf,
    { role: "user", content: "Heute ist " + jetztText() + ". " + befehl },
  ];
  const eigene = WERKZEUGE.map((w) => w.def);

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
    let werkzeugGenutzt = false;
    const verlaufKopie = [...messages];
    const tools: any[] = [...(v.suche ? [WEBSUCHE] : []), ...eigene];
    try {
      for (let runde = 0; runde < MAX_RUNDEN; runde++) {
        const stream = client.messages.stream({
          model: v.modell,
          max_tokens: 1024,
          system,
          messages: verlaufKopie,
          tools,
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
        if (msg.stop_reason === "tool_use") {
          werkzeugGenutzt = true;
          const aufrufe = (msg.content as any[]).filter((b) => b.type === "tool_use");
          const ergebnisse = await Promise.all(
            aufrufe.map(async (b) => {
              try {
                return { type: "tool_result", tool_use_id: b.id, content: await fuehreAus(b.name, b.input, env) };
              } catch (err) {
                return {
                  type: "tool_result",
                  tool_use_id: b.id,
                  content: err instanceof Error ? err.message : String(err),
                  is_error: true,
                };
              }
            }),
          );
          verlaufKopie.push({ role: "assistant", content: msg.content });
          verlaufKopie.push({ role: "user", content: ergebnisse });
          continue;
        }
        break;
      }
      for (const s of teiler.flush()) onSatz(s);
      return gesamt.trim();
    } catch (err) {
      letzterFehler = err;
      if (gesamt.trim() || werkzeugGenutzt || !istModellFehler(err)) throw err;
    }
  }
  throw letzterFehler;
}
