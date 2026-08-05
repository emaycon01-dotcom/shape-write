/**
 * Evita trafegar imagens pesadas (templates em base64, fotos, assinaturas) até
 * a Edge Function e de volta dentro do HTML.
 *
 * Antes, cada preview E cada geração final subiam ~2 MB de template e baixavam
 * os mesmos ~2 MB embutidos no HTML — em rede móvel isso sozinho custava vários
 * segundos e um pico de memória enorme (3 cópias da mesma string).
 *
 * Agora enviamos apenas um marcador curto; a Edge Function monta o HTML igual
 * (mesmas coordenadas, mesmo layout) e o navegador recoloca a imagem original,
 * que já está na memória local, antes de rasterizar.
 */

const MIN_INLINE_BYTES = 20_000;

export type AssetTransport = {
  body: Record<string, unknown>;
  restore: (html: string) => string;
};

function isHeavyDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:") && value.length > MIN_INLINE_BYTES;
}

/**
 * Substitui data URLs grandes do corpo por marcadores (também válidos como
 * data URL, para não quebrar validações do tipo `startsWith("data:")`).
 */
export function stripHeavyAssets(body: Record<string, unknown>): AssetTransport {
  const map = new Map<string, string>();

  const swap = (value: unknown): unknown => {
    if (isHeavyDataUrl(value)) {
      const token = `data:image/jpeg;base64,LVASSET${map.size}TOKEN`;
      map.set(token, value);
      return token;
    }
    if (Array.isArray(value)) return value.map(swap);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = swap(v);
      return out;
    }
    return value;
  };

  const light = swap(body) as Record<string, unknown>;

  const restore = (html: string): string => {
    if (map.size === 0) return html;
    let out = html;
    for (const [token, original] of map) {
      if (out.includes(token)) out = out.split(token).join(original);
    }
    return out;
  };

  return { body: light, restore };
}

/**
 * Converte data URLs grandes do documento em `blob:` URLs.
 *
 * O html2canvas CLONA o documento inteiro a cada faixa rasterizada. Com o
 * template como data URL, cada clone duplicava megabytes de texto — a maior
 * causa de travamento/estouro de memória em Android e iPad. Com `blob:` o
 * clone copia apenas uma URL curta e o bitmap decodificado é compartilhado.
 */
export async function inlineImagesToBlobUrls(doc: Document): Promise<() => void> {
  const urls: string[] = [];
  const images = Array.from(doc.images).filter((img) => isHeavyDataUrl(img.getAttribute("src")));

  await Promise.all(
    images.map(async (img) => {
      try {
        const res = await fetch(img.src);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        urls.push(url);
        img.src = url;
      } catch {
        /* mantém o data URL original */
      }
    }),
  );

  return () => {
    for (const url of urls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignora */
      }
    }
  };
}
