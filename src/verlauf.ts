export type Msg = { role: "user" | "assistant"; content: string };

// Macht aus dem, was die App schickt, einen gültigen Verlauf (beginnt mit Nutzer, endet mit Jarvis)
export function bereinigeVerlauf(raw: unknown): Msg[] {
  if (!Array.isArray(raw)) return [];
  const out: Msg[] = [];
  for (const m of raw.slice(-12)) {
    const role = (m as { role?: unknown })?.role;
    const c = (m as { content?: unknown })?.content;
    const content = typeof c === "string" ? c.trim().slice(0, 600) : "";
    if ((role !== "user" && role !== "assistant") || !content) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = (last.content + " " + content).slice(0, 600);
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  while (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
}
