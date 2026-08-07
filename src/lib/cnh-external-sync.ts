import { getPdfJs } from "@/lib/pdfjs-loader";
import { supabase } from "@/integrations/supabase/client";

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

/** Renderiza a página inteira do PDF como JPEG base64 em ~300 DPI */
async function renderFullPageJpeg(pdfBytes: Uint8Array, pageIndex = 0): Promise<string> {
  // Reaproveita a instância única do app (worker local, já aquecido).
  const pdfjsLib = await getPdfJs();

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(pageIndex + 1);

  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(TARGET_WIDTH / base.width, MIN_WIDTH / base.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

function buildPayload(formData: Record<string, string>, imagem: string) {
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
    parte1: imagem,
    parte2: imagem,
    parte3: imagem,
    parte4: imagem,
  };
}

async function postWithRetry(registros: Record<string, string>[], attempts = 3): Promise<boolean> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const { data, error } = await supabase.functions.invoke("cnh-ingest-proxy", {
        body: { registros },
      });
      if (!error && data?.ok) return true;
      console.error(`CNH sync tentativa ${i} falhou:`, error?.message ?? data);
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
  try {
    if (onlyDigits(formData.cpf || "").length !== 11) {
      console.error("CNH external sync rejected: invalid CPF");
      return false;
    }
    const pdfBytes = base64ToBytes(pdfBase64);
    const imagem = await renderFullPageJpeg(pdfBytes, 0);
    if (!imagem.startsWith("data:image/jpeg;base64,")) return false;

    const payload = buildPayload(formData, imagem);
    const masked = payload.cpf;
    const digits = onlyDigits(formData.cpf || "");

    const registros = [payload];
    if (digits && digits !== masked) registros.push({ ...payload, cpf: digits });

    return await postWithRetry(registros);
  } catch (err) {
    console.error("CNH external sync failed:", err);
    return false;
  }
}


