/**
 * Cache de templates em base64.
 * Evita reconverter (e realocar dezenas de MB) o mesmo template a cada geração,
 * o que fazia o navegador travar/fechar em dispositivos móveis.
 */
const cache = new Map<string, Promise<string>>();
const MAX_CACHED_TEMPLATES = 4;

function trimCache(activeUrl: string) {
  while (cache.size > MAX_CACHED_TEMPLATES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest || oldest === activeUrl) break;
    cache.delete(oldest);
  }
}

export function loadTemplateBase64(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit) return hit;

  const p = (async () => {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  })();

  p.catch(() => cache.delete(url));
  cache.set(url, p);
  trimCache(url);
  return p;
}
