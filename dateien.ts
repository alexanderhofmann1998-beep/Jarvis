import { bytesZuBase64 } from "./gmaillib.ts";

export const MAX_DATEIEN = 3;
export const MAX_BYTES = 8 * 1024 * 1024;
const BILDER = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Wandelt hochgeladene Dateien in Inhaltsblöcke für Claude um (Bilder und PDFs)
export async function baueAnhaenge(dateien: Blob[]): Promise<{ bloecke: any[]; fehler: string[] }> {
  const bloecke: any[] = [];
  const fehler: string[] = [];
  for (const d of dateien.slice(0, MAX_DATEIEN)) {
    if (d.size === 0) continue;
    if (d.size > MAX_BYTES) { fehler.push("Eine Datei ist größer als 8 MB."); continue; }
    const typ = (d.type || "").toLowerCase();
    const data = bytesZuBase64(new Uint8Array(await d.arrayBuffer()));
    if (BILDER.includes(typ)) bloecke.push({ type: "image", source: { type: "base64", media_type: typ, data } });
    else if (typ === "application/pdf") bloecke.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    else fehler.push("Dateityp " + (typ || "unbekannt") + " wird nicht unterstützt. Erlaubt sind Bilder und PDF.");
  }
  if (dateien.length > MAX_DATEIEN) fehler.push("Es werden höchstens " + MAX_DATEIEN + " Dateien gelesen.");
  return { bloecke, fehler };
}
