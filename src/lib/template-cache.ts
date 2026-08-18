/**
 * Cache de templates de fundo.
 *
 * ANTES: cada template (3–6 MB) era convertido em uma string base64 (+33% de
 * tamanho) e essa string era copiada várias vezes — cache, estado do
 * formulário, corpo da requisição e HTML final. Um único documento chegava a
 * ocupar dezenas de MB só de texto, o que fechava a aba em iPhone/iPad.
 *
 * AGORA: o binário é baixado uma vez e exposto como `blob:` (URL de objeto).
 * O navegador aponta para o arquivo em vez de copiar texto. Os pixels são
 * exatamente os mesmos — muda apenas a forma de referenciar a imagem.
 *
 * `loadTemplateBase64` continua existindo para os fluxos que EXIGEM base64
 * (envio ao validador / ingestão externa).
 */

const base64Cache = new Map<string, Promise<string>>();
const objectUrlCache = new Map<string, Promise<string>>();

/** Base64 é pesado: mantemos no máximo 2 vivos ao mesmo tempo. */
const MAX_CACHED_BASE64 = 2;
/** `blob:` custa poucos bytes de JS (o binário fica fora do heap). */
const MAX_CACHED_OBJECT_URLS = 6;

function trimBase64(activeUrl: string) {
  while (base64Cache.size > MAX_CACHED_BASE64) {
    const oldest = base64Cache.keys().next().value as string | undefined;
    if (!oldest || oldest === activeUrl) break;
    base64Cache.delete(oldest);
  }
}

/**
 * URLs que saíram do cache mas NÃO podem ser revogadas agora: durante uma
 * geração o HTML do documento ainda aponta para elas. Revogar no meio do
 * caminho faria a imagem sumir do PDF final. Ficam na fila e são liberadas
 * quando a geração termina.
 */
const pendingRevoke = new Set<string>();

function revokeNow(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignora */
  }
}

/** Libera os `blob:` adiados (chamado ao final de cada geração). */
export function flushPendingTemplateRevokes() {
  if (isGenerationBusy()) return;
  for (const u of pendingRevoke) revokeNow(u);
  pendingRevoke.clear();
}

function trimObjectUrls(activeUrl: string) {
  while (objectUrlCache.size > MAX_CACHED_OBJECT_URLS) {
    const oldest = objectUrlCache.keys().next().value as string | undefined;
    if (!oldest || oldest === activeUrl) break;
    const stale = objectUrlCache.get(oldest);
    objectUrlCache.delete(oldest);
    void stale
      ?.then((u) => {
        if (isGenerationBusy()) pendingRevoke.add(u);
        else revokeNow(u);
      })
      .catch(() => undefined);
  }
}


/**
 * Caminho LEVE (padrão): devolve um `blob:` reaproveitável para o template.
 * Use em tudo que apenas EXIBE ou RENDERIZA a imagem.
 */
export function loadTemplateObjectUrl(url: string): Promise<string> {
  const hit = objectUrlCache.get(url);
  if (hit) return hit;

  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao carregar o template (${res.status}).`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  })();

  p.catch(() => objectUrlCache.delete(url));
  objectUrlCache.set(url, p);
  trimObjectUrls(url);
  return p;
}

/**
 * Caminho PESADO: só para quem precisa mesmo do texto base64
 * (sincronização com validadores externos).
 */
export function loadTemplateBase64(url: string): Promise<string> {
  const hit = base64Cache.get(url);
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

  p.catch(() => base64Cache.delete(url));
  base64Cache.set(url, p);
  trimBase64(url);
  return p;
}

/** Libera o texto base64 retido (chamado ao sair de uma tela de documento). */
export function releaseTemplateBase64Cache() {
  base64Cache.clear();
}
