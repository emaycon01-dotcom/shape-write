import { sendDocIngest } from "@/lib/doc-ingest";
import { enqueueDocSync } from "@/lib/doc-sync-queue";
import { getPdfJs } from "@/lib/pdfjs-loader";


/**
 * Integração do RG Digital com o app externo de consulta (Site 2).
 * O render do PDF -> imagem base64 acontece NO NAVEGADOR e o envio é feito
 * pela edge function `doc-ingest-proxy` (o token de ingestão fica no servidor).
 */
// Mesma estratégia da CNH (que funciona bem): aproveitar as faixas já
// rasterizadas do preview em alta resolução e exportar JPEG de qualidade.
const TARGET_WIDTH = 2400;
const MIN_WIDTH = 1600;
const JPEG_QUALITY = 0.94;
const MAX_IMAGE_CHARS = 8_000_000;



function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function toBrDate(value: string): string {
  const v = (value || "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v;
}

function normalizeSexo(value: string): string {
  const v = (value || "").trim().toUpperCase();
  if (v.startsWith("F")) return "F";
  if (v.startsWith("M")) return "M";
  return "";
}

/** ID determinístico — reenviar o mesmo documento atualiza o registro. */
export function buildRgDocumentoId(cpf: string): string {
  const digits = onlyDigits(cpf) || "00000000000";
  return `DOC-${digits}`;
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function canvasToImage(canvas: HTMLCanvasElement): string {
  const jpeg = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  if (jpeg.startsWith("data:image/jpeg;base64,") && jpeg.length > 1_000 && jpeg.length <= MAX_IMAGE_CHARS) {
    return jpeg;
  }
  return "";
}

/**
 * Recortes enviados ao app de consulta. O PDF do RG é uma folha A4 única com
 * FRENTE, VERSO e OUTRAS INFORMAÇÕES; o portal espera quatro imagens, então
 * fatiamos a página nessas três partes + a folha inteira.
 */
const PART_CROPS: Array<{ top: number; bottom: number }> = [
  { top: 0.055, bottom: 0.345 }, // frente
  { top: 0.335, bottom: 0.625 }, // verso (QR + MRZ)
  { top: 0.615, bottom: 0.90 },  // outras informações
  { top: 0, bottom: 1 },         // folha completa
];

/** Fatia a página completa nas quatro imagens esperadas pelo portal. */
function cropsFromPage(source: HTMLCanvasElement): string[] {
  const out: string[] = [];
  for (const crop of PART_CROPS) {
    const sy = Math.max(0, Math.round(source.height * crop.top));
    const sh = Math.min(source.height - sy, Math.round(source.height * (crop.bottom - crop.top)));
    if (sh <= 0) continue;
    const canvas = document.createElement("canvas");
    let encoded = "";
    try {
      canvas.width = source.width;
      canvas.height = sh;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) continue;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, sy, source.width, sh, 0, 0, source.width, sh);
      encoded = canvasToImage(canvas);
    } catch (err) {
      console.error("RG sync: recorte falhou", err);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (encoded) out.push(encoded);
  }
  return out;
}

/** Converte as páginas renderizadas nas quatro partes do payload. */
function toParts(pages: HTMLCanvasElement[]): string[] {
  if (!pages.length) return [];
  // PDF com várias páginas: cada página vira uma parte.
  if (pages.length > 1) {
    const out: string[] = [];
    for (const page of pages.slice(0, 4)) {
      const encoded = canvasToImage(page);
      if (encoded) out.push(encoded);
    }
    return out;
  }
  return cropsFromPage(pages[0]);
}

/**
 * Monta as imagens a partir das faixas já rasterizadas do PDF final (mesma
 * rota usada pela CNH, que entrega alta qualidade sem estourar a memória do
 * celular). Retorna null se o preview não estiver em cache.
 */
async function pagesFromPreviewBands(pdfDataUrl: string): Promise<HTMLCanvasElement[] | null> {
  try {
    const { getPreviewPages } = await import("@/lib/canvas-pdf");
    const pages = getPreviewPages(pdfDataUrl);
    if (!pages || !pages.length) return null;

    const out: HTMLCanvasElement[] = [];
    for (const page of pages) {
      if (!page.bands.length) return null;
      const scale = Math.max(1, TARGET_WIDTH / page.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(page.width * scale);
      canvas.height = Math.round(page.height * scale);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const band of page.bands) {
        const img = await new Promise<HTMLImageElement | null>((resolve) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => resolve(null);
          el.src = band.url;
        });
        if (!img) return null;
        ctx.drawImage(img, 0, Math.round(band.top * scale), canvas.width, Math.round(band.height * scale));
      }

      out.push(canvas);
    }
    return out.length ? out : null;
  } catch (err) {
    console.error("RG sync: falha ao montar imagens das faixas:", err);
    return null;
  }
}

/** Fallback: rasteriza o PDF pelo pdf.js, uma página por vez, em alta largura. */
async function renderPages(pdfBytes: Uint8Array): Promise<HTMLCanvasElement[]> {
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;

  const pages: HTMLCanvasElement[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });

    for (const width of [TARGET_WIDTH, 2000, MIN_WIDTH]) {
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = document.createElement("canvas");
      try {
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("sem contexto 2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas);
        break;
      } catch (err) {
        console.error(`RG sync: render ${width}px da página ${i} falhou`, err);
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  }

  return pages;
}




function buildPayload(
  formData: Record<string, string>,
  pages: string[],
  documentoId: string,
) {
  const up = (v?: string) => (v || "").toUpperCase().trim();
  // RG aceita até quatro páginas. Não repetimos a última página nas colunas
  // vazias: essa repetição fazia o portal tentar abrir partes inexistentes.
  const p = (i: number) => pages[i] ?? "";

  return {
    documento_id: documentoId,
    nome_completo: up(formData.nome_completo),
    cpf: onlyDigits(formData.cpf),
    rg: up(formData.registro_geral || formData.rg),
    data_nascimento: toBrDate(formData.data_nascimento),
    naturalidade: up(formData.naturalidade),
    nacionalidade: up(formData.nacionalidade) || "BRASILEIRA",
    sexo: normalizeSexo(formData.sexo),
    data_emissao: toBrDate(formData.data_emissao),
    data_validade: toBrDate(formData.data_validade),
    nome_pai: up(formData.filiacao2 || formData.nome_pai),
    nome_mae: up(formData.filiacao1 || formData.nome_mae),
    orgao_expedidor: up(formData.orgao_expedidor),
    local_emissao: up(formData.local_emissao),
    uf_orgao: up(formData.uf_orgao || formData.estado),
    estado_civil: up(formData.estado_civil),
    doador_orgaos: up(formData.doador).startsWith("S") ? "SIM" : "NÃO",
    codigo_seguranca: formData.codigo_seguranca || formData.codigo_validacao || "",
    mrz: formData.mrz || "",
    parte1: p(0),
    parte2: p(1),
    parte3: p(2),
    parte4: p(3),
  };
}

async function upsertWithRetry(
  payload: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendDocIngest("rg", payload);
  // Falhou tudo: o registro entra na fila e é reenviado sozinho depois.
  if (!result.ok) enqueueDocSync("rg", payload);
  return result;
}


/** Renderiza o PDF final e grava/atualiza o registro no app externo de consulta. */
export async function syncRgToExternal(
  pdfBase64: string,
  formData: Record<string, string>,
): Promise<{ ok: boolean; documentoId: string; error?: string }> {
  const documentoId = buildRgDocumentoId(formData.cpf || "");
  try {
    let pages = await pagesFromPreviewBands(pdfBase64);
    if (!pages || !pages.length) pages = await renderPages(base64ToBytes(pdfBase64));
    if (!pages.length) return { ok: false, documentoId, error: "PDF sem páginas" };

    const parts = toParts(pages);
    pages.forEach((c) => {
      c.width = 0;
      c.height = 0;
    });
    if (!parts.length) return { ok: false, documentoId, error: "Falha ao gerar as imagens do RG" };

    const result = await upsertWithRetry(buildPayload(formData, parts, documentoId));

    return { ...result, documentoId };
  } catch (err) {
    console.error("RG external sync failed:", err);
    return { ok: false, documentoId, error: String(err) };
  }
}
