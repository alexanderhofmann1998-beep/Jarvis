// Zeitkonstanter Passwort-Vergleich (verhindert Timing-Angriffe)
export async function schluesselPasst(gegeben: string | null, erwartet: string | undefined): Promise<boolean> {
  if (!gegeben || !erwartet) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(gegeben)),
    crypto.subtle.digest("SHA-256", enc.encode(erwartet)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
