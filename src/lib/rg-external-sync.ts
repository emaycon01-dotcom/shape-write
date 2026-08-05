import { supabase } from "@/integrations/supabase/client";
import { getPdfJs } from "@/lib/pdfjs-loader";


/**
 * Integração do RG Digital com o app externo de consulta (Site 2).
 * O render do PDF -> imagem base64 acontece NO NAVEGADOR e o envio é feito
 * pela edge function `doc-ingest-proxy` (o token de ingestão fica no servidor).
 */
const MIN_LONG_SIDE = 1500;
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

/** Renderiza TODAS as páginas do PDF, sem recorte e sem rotação, em alta resolução. */
async function renderPages(pdfBytes: Uint8Array): Promise<string[]> {
  // Reaproveita a instância única do app (worker local, já aquecido) em vez de
  // baixar um segundo pdf.js da CDN a cada envio.
  const pdfjsLib = await getPdfJs();

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
  pages: string[],
  documentoId: string,
) {
  const up = (v?: string) => (v || "").toUpperCase().trim();
  const p = (i: number) => pages[i] ?? pages[pages.length - 1] ?? "";

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
  attempts = 3,
): Promise<{ ok: boolean; error?: string }> {
  let lastError = "";
  for (let i = 1; i <= attempts; i++) {
    try {
      const { data, error } = await supabase.functions.invoke("doc-ingest-proxy", {
        body: { tabela: "rg", dados: payload },
      });
      if (error) throw new Error(error.message);
      if (data && (data as { error?: string }).error) throw new Error(JSON.stringify(data));
      return { ok: true };
    } catch (err) {
      lastError = String(err);
      console.error(`RG sync tentativa ${i} falhou:`, err);
    }

    if (i < attempts) await new Promise((r) => setTimeout(r, 1200 * i));
  }
  return { ok: false, error: lastError };
}


/** Renderiza o PDF final e grava/atualiza o registro no app externo de consulta. */
export async function syncRgToExternal(
  pdfBase64: string,
  formData: Record<string, string>,
): Promise<{ ok: boolean; documentoId: string; error?: string }> {
  const documentoId = buildRgDocumentoId(formData.cpf || "");
  try {
    const pages = await renderPages(base64ToBytes(pdfBase64));
    if (!pages.length) return { ok: false, documentoId, error: "PDF sem páginas" };

    const result = await upsertWithRetry(buildPayload(formData, pages, documentoId));
    return { ...result, documentoId };
  } catch (err) {
    console.error("RG external sync failed:", err);
    return { ok: false, documentoId, error: String(err) };
  }
}
