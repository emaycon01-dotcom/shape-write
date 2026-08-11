import { getPdfJs } from "@/lib/pdfjs-loader";
import { supabase } from "@/integrations/supabase/client";
import { enqueueCnhSync, dequeueCnhSync } from "@/lib/cnh-sync-queue";
import { invokeSecondaryFunction } from "@/lib/pdf-fallback";

/**
 * Integração com o app "CNH do Brasil" (Site 2 — fotos).
 * Grava um registro na tabela `cnh` do projeto externo via Edge Function
 * `cnh-ingest-proxy` (a chave de escrita nunca vai para o navegador).
 * Todo o processamento (render do PDF -> JPEG base64) acontece NO NAVEGADOR,
 * para não consumir recursos do backend.
 */

/** largura mínima exigida pelo app (px) */
const MIN_WIDTH = 2400;
const TARGET_WIDTH = 3176; // ~300 DPI em A4
const JPEG_QUALITY = 0.92;

function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length !== 11) return "";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function toBrDate(value: string): string {
  const v = (value || "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return v;
}

function normalizeSexo(value: string): string {
  const v = (value || "").trim().toUpperCase();
  if (v.startsWith("F")) return "FEMININO";
  return "MASCULINO";
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Monta o JPEG a partir das faixas já rasterizadas do PDF final.
 * Evita rodar o PDF.js de novo (principal causa de falha/OOM em celulares,
 * que fazia a CNH nunca chegar ao banco do validador).
 */
async function jpegFromPreviewBands(pdfDataUrl: string): Promise<string | null> {
  try {
    const { getPreviewPages } = await import("@/lib/canvas-pdf");
    const pages = getPreviewPages(pdfDataUrl);
    const page = pages?.[0];
    if (!page || !page.bands.length) return null;

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

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl.startsWith("data:image/jpeg;base64,") ? dataUrl : null;
  } catch (err) {
    console.error("CNH sync: falhou montar JPEG das faixas:", err);
    return null;
  }
}

/** Renderiza a página inteira do PDF como JPEG base64 em ~300 DPI */
async function renderFullPageJpeg(pdfBytes: Uint8Array, pageIndex = 0): Promise<string> {
  // Reaproveita a instância única do app (worker local, já aquecido).
  const pdfjsLib = await getPdfJs();

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(pageIndex + 1);

  const base = page.getViewport({ scale: 1 });
  // Escada de segurança: se a largura alvo estourar a memória do aparelho,
  // tenta resoluções menores em vez de abortar o envio ao validador.
  const widths = [TARGET_WIDTH, 2800, MIN_WIDTH, 1800];
  let lastError: unknown = null;

  for (const width of widths) {
    const scale = width / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    try {
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("sem contexto 2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      if (!dataUrl.startsWith("data:image/jpeg;base64,")) throw new Error("jpeg inválido");
      return dataUrl;
    } catch (err) {
      lastError = err;
      console.error(`CNH sync: render ${width}px falhou`, err);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("render_falhou");
}


function buildPayload(formData: Record<string, string>) {
  const cpf = formatCpf(formData.cpf || "");
  const nascimento = toBrDate(formData.data_nascimento || "");
  const cidadeEstado = (formData.cidade_estado || "").toUpperCase();
  const estadoExtenso = (formData.estado_extenso || "").toUpperCase();

  const nascimentoCompleto = [nascimento, formData.naturalidade, cidadeEstado]
    .filter(Boolean)
    .join(", ");

  return {
    nome_completo: (formData.nome_completo || "").toUpperCase(),
    cpf,
    rg: formData.rg || "",
    registro: onlyDigits(formData.registro || ""),
    categoria: (formData.categoria || "").toUpperCase(),
    data_nascimento: nascimentoCompleto || nascimento,
    data_emissao: toBrDate(formData.data_emissao || ""),
    data_validade: toBrDate(formData.data_validade || ""),
    renach: (formData.renach || "").toUpperCase(),
    numero_espelho: formData.numero_espelho || "",
    cidade_estado: cidadeEstado,
    estado_extenso: estadoExtenso,
    sexo: normalizeSexo(formData.genero || formData.sexo || ""),
    origem: "MONKEYLAB",
  };
}

async function postWithRetry(
  registros: Record<string, string>[],
  imagem: string | null,
  attempts = 3,
): Promise<boolean> {
  for (let i = 1; i <= attempts; i++) {
    try {
      // A ponte secundária preserva a credencial da base consultada por CPF
      // que existia antes da migração. O backend novo fica como contingência.
      const body = imagem ? { registros, imagem } : { registros };
      const stable = await invokeSecondaryFunction("cnh-ingest-proxy", body);
      if (stable && !stable.error && (stable.data as { ok?: boolean } | null)?.ok) return true;

      const { data, error } = await supabase.functions.invoke("cnh-ingest-proxy", { body });
      if (!error && data?.ok) return true;
      console.error(`CNH sync tentativa ${i} falhou nas duas pontes:`, error?.message ?? data);
    } catch (err) {
      console.error(`CNH sync tentativa ${i} com erro de rede:`, err);
    }

    if (i < attempts) await new Promise((r) => setTimeout(r, 1200 * i));
  }
  return false;
}

/**
 * Renderiza o PDF gerado como imagem de página inteira e grava no app externo.
 * O envio passa pela Edge Function `cnh-ingest-proxy`, que exige sessão válida
 * e guarda a chave de escrita apenas no servidor.
 * O registro é gravado em DUAS variações de CPF (com máscara e só dígitos),
 * porque o site e o APK consultam em formatos diferentes.
 */
export async function syncCnhToExternal(
  pdfBase64: string,
  formData: Record<string, string>,
  _tipo: "digital" | "fisica" = "digital"
): Promise<boolean> {
  if (onlyDigits(formData.cpf || "").length !== 11) {
    console.error("CNH external sync rejected: invalid CPF");
    return false;
  }

  // Entra na fila ANTES de tentar: se o aparelho travar, fechar o app ou a
  // rede cair, o registro continua pendente e é reenviado em segundo plano.
  const queueId = enqueueCnhSync(formData);
  const registros = buildRegistros(formData);

  let imagem: string | null = null;
  try {
    imagem = await jpegFromPreviewBands(pdfBase64);
    if (!imagem) {
      const pdfBytes = base64ToBytes(pdfBase64);
      imagem = await renderFullPageJpeg(pdfBytes, 0);
    }
    if (imagem && !imagem.startsWith("data:image/jpeg;base64,")) imagem = null;
  } catch (err) {
    console.error("CNH sync: falha ao preparar a imagem:", err);
    imagem = null;
  }

  // Com foto quando der; sem foto se a rasterização falhar — o essencial é o
  // CPF existir na base para o validador encontrar.
  let ok = await postWithRetry(registros, imagem);
  if (!ok && imagem) ok = await postWithRetry(registros, null, 2);

  if (ok) dequeueCnhSync(queueId);
  return ok;
}

/** Reenvio apenas dos dados (usado pela fila em segundo plano). */
export async function syncCnhDataOnly(formData: Record<string, string>): Promise<boolean> {
  if (onlyDigits(formData.cpf || "").length !== 11) return false;
  return postWithRetry(buildRegistros(formData), null, 1);
}

function buildRegistros(formData: Record<string, string>): Record<string, string>[] {
  const payload = buildPayload(formData);
  const masked = payload.cpf;
  const digits = onlyDigits(formData.cpf || "");
  const registros = [payload];
  if (digits && digits !== masked) registros.push({ ...payload, cpf: digits });
  return registros;
}
