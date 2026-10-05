const ABK = new Set([
  "ca", "bzw", "usw", "etc", "ggf", "inkl", "evtl", "nr", "dr", "vs", "zb", "dh", "ua",
  "uvm", "max", "min", "mrd", "mio", "tsd", "str", "prof", "bzgl", "sog", "zzgl",
]);
const MONATE = /^(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)/i;

type Urteil = "ja" | "nein" | "warte";

function grenze(text: string, i: number, final: boolean): Urteil {
  if (text[i] !== ".") return "ja";
  let j = i - 1;
  while (j >= 0 && !/\s/.test(text[j])) j--;
  const wort = text.slice(j + 1, i);
  const klein = wort.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  if (klein.length === 1 && /\p{L}/u.test(klein)) return "nein"; // z. B.
  if (ABK.has(klein)) return "nein";
  if (/^\d+$/.test(klein)) {
    const rest = text.slice(i + 1).trimStart();
    if (rest.length < 10 && !final) return "warte";
    if (MONATE.test(rest) || /^[a-zäöüß]/.test(rest)) return "nein"; // 15. Oktober
  }
  return "ja";
}

export function createSatzTeiler() {
  let puffer = "";

  function extrahiere(final: boolean): string[] {
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < puffer.length; i++) {
      const c = puffer[i];
      if (c !== "." && c !== "!" && c !== "?") continue;
      let k = i + 1;
      while (k < puffer.length && /["'“”»«)]/.test(puffer[k])) k++;
      if (k >= puffer.length) break;
      if (!/\s/.test(puffer[k])) continue;
      const g = grenze(puffer, i, final);
      if (g === "warte") break;
      if (g === "nein") continue;
      const satz = puffer.slice(start, k).trim();
      if (satz) out.push(satz);
      start = k;
      i = k - 1;
    }
    puffer = puffer.slice(start);
    return out;
  }

  return {
    push(chunk: string): string[] {
      puffer += chunk;
      return extrahiere(false);
    },
    flush(): string[] {
      const out = extrahiere(true);
      const rest = puffer.trim();
      puffer = "";
      if (rest) out.push(rest);
      return out;
    },
  };
}
