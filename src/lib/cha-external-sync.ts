import * as pdfjsLib from "pdfjs-dist";

/**
 * Integração da CNH Marítima (CHA) com o app externo de consulta.
 * Todo o processamento (render do PDF -> imagem base64) acontece NO NAVEGADOR.
 */
const EXTERNAL_SUPABASE_URL = "https://hfkckowhrjbpjgniaakl.supabase.co";
const EXTERNAL_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhma2Nrb3docmpicGpnbmlhYWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDAxNjMsImV4cCI6MjA5NDE3NjE2M30.mo2y4LjrPLYewR765h-Zaer9Y08r1M-OoNnB49QbMnQ";

const MIN_LONG_SIDE = 1600;
const TARGET_SCALE = 3;
const JPEG_QUALITY = 0.94;

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

/** ID determinístico — reenviar o mesmo documento atualiza o registro. */
export function buildChaDocumentoId(cpf: string): string {
  const digits = onlyDigits(cpf) || "00000000000";
  return `CHA-${digits}`;
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Renderiza a página completa do PDF, sem recorte e sem rotação, em alta resolução. */
async function renderPages(pdfBytes: Uint8Array): Promise<string[]> {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const longSide = Math.max(base.width, base.height);
    const scale = Math.max(TARGET_SCALE, MIN_LONG_SIDE / longSide);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY));

    canvas.width = 0;
    canvas.height = 0;
  }

  return pages;
}

function buildPayload(
  formData: Record<string, string>,
  imagemCompleta: string,
  documentoId: string,
) {
  const up = (v?: string) => (v || "").toUpperCase().trim();
  const categoria = [up(formData.categoria), up(formData.categoria_en)]
    .filter(Boolean)
    .join(" / ");

  return {
    documento_id: documentoId,
    nome_completo: up(formData.nome),
    cpf: onlyDigits(formData.cpf),
    data_nascimento: toBrDate(formData.nascimento),
    nacionalidade: up(formData.nacionalidade) || "BRASILEIRA",
    sexo: up(formData.sexo),
    categoria,
    numero_inscricao: up(formData.inscricao),
    data_emissao: toBrDate(formData.data_emissao),
    data_validade: toBrDate(formData.validade),
    orgao_emissao: up(formData.orgao) || "MARINHA DO BRASIL",
    limites_navegacao: up(formData.limites),
    requisitos: up(formData.requisitos),
    codigo_seguranca: formData.codigo_seguranca || "",
    observacoes: up(formData.observacoes),
    // As 4 partes recebem a MESMA imagem completa (recorte é feito no app de consulta).
    parte1: imagemCompleta,
    parte2: imagemCompleta,
    parte3: imagemCompleta,
    parte4: imagemCompleta,
  };
}

async function upsertWithRetry(
  payload: Record<string, string>,
  attempts = 3,
): Promise<{ ok: boolean; error?: string }> {
  let lastError = "";
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(
        `${EXTERNAL_SUPABASE_URL}/rest/v1/cha?on_conflict=documento_id`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EXTERNAL_SUPABASE_KEY,
            Authorization: `Bearer ${EXTERNAL_SUPABASE_KEY}`,
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) return { ok: true };

      lastError = await response.text();
      console.error(`CHA sync tentativa ${i} falhou [${response.status}]:`, lastError);
    } catch (err) {
      lastError = String(err);
      console.error(`CHA sync tentativa ${i} com erro de rede:`, err);
    }

    if (i < attempts) await new Promise((r) => setTimeout(r, 1200 * i));
  }
  return { ok: false, error: lastError };
}

/** Renderiza o PDF final e grava/atualiza o registro no app externo de consulta. */
export async function syncChaToExternal(
  pdfBase64: string,
  formData: Record<string, string>,
): Promise<{ ok: boolean; documentoId: string; error?: string }> {
  const documentoId = buildChaDocumentoId(formData.cpf || "");
  try {
    const pages = await renderPages(base64ToBytes(pdfBase64));
    if (!pages.length) return { ok: false, documentoId, error: "PDF sem páginas" };

    const result = await upsertWithRetry(buildPayload(formData, pages[0], documentoId));
    return { ...result, documentoId };
  } catch (err) {
    console.error("CHA external sync failed:", err);
    return { ok: false, documentoId, error: String(err) };
  }
}
