import * as pdfjsLib from "pdfjs-dist";

// External Supabase config for CNH sync
const EXTERNAL_SUPABASE_URL = "https://mpiuedfqjtsrffdwwwfz.supabase.co";
const EXTERNAL_SUPABASE_KEY = "sb_publishable_XSJ4xk-8AUAzcjmkWP7A1A_Nz3U5EpV";

// Crop regions for CNH Digital (based on 794x1123 page)
// Part 1: Header + photo + personal data
// Part 2: Categories + obs + local + estado
// Part 3: Description text + MRZ
// Part 4: QR code (generated from data)
const CROP_REGIONS_DIGITAL = [
  { name: "parte1", x: 0, y: 0, w: 794, h: 310 },
  { name: "parte2", x: 0, y: 310, w: 794, h: 260 },
  { name: "parte3", x: 0, y: 570, w: 794, h: 230 },
];

// For Física (2 pages) - front page gets 2 parts, verso gets 1 + QR
const CROP_REGIONS_FISICA = [
  { name: "parte1", x: 0, y: 0, w: 794, h: 260 },
  { name: "parte2", x: 0, y: 260, w: 794, h: 260 },
];

const CROP_REGIONS_FISICA_VERSO = [
  { name: "parte3", x: 0, y: 300, w: 794, h: 350 },
];

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length !== 11) {
    return value.trim();
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Render a PDF page to a high-res canvas
 */
async function renderPdfPageToCanvas(
  pdfData: Uint8Array,
  pageIndex: number,
  scale: number = 3
): Promise<HTMLCanvasElement> {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/**
 * Crop a region from a canvas and return as high-quality base64 JPEG
 */
function cropCanvasToBase64(
  source: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
  scale: number = 3
): string {
  const sx = region.x * scale;
  const sy = region.y * scale;
  const sw = region.w * scale;
  const sh = region.h * scale;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = sw;
  cropCanvas.height = sh;
  const ctx = cropCanvas.getContext("2d")!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

  // High quality JPEG
  return cropCanvas.toDataURL("image/jpeg", 0.95);
}

/**
 * Generate QR code as base64 from data using canvas
 */
async function generateQrCodeBase64(data: string): Promise<string> {
  try {
    const { QRCodeCanvas } = await import("qrcode.react");
    const { createRoot } = await import("react-dom/client");
    const { createElement, createRef } = await import("react");

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    document.body.appendChild(container);

    return new Promise<string>((resolve) => {
      const root = createRoot(container);
      
      // We'll use a wrapper that grabs the canvas after render
      const Wrapper = () => {
        return createElement(QRCodeCanvas, {
          value: data,
          size: 600,
          level: "M" as const,
          includeMargin: true,
        });
      };
      
      root.render(createElement(Wrapper));
      
      // Wait for render, then grab canvas
      setTimeout(() => {
        const canvasEl = container.querySelector("canvas");
        if (canvasEl) {
          const dataUrl = canvasEl.toDataURL("image/jpeg", 0.95);
          root.unmount();
          document.body.removeChild(container);
          resolve(dataUrl);
        } else {
          root.unmount();
          document.body.removeChild(container);
          resolve("");
        }
      }, 300);
      
      // Fallback timeout
      setTimeout(() => {
        try { root.unmount(); } catch {}
        try { document.body.removeChild(container); } catch {}
        resolve("");
      }, 3000);
    });
  } catch (err) {
    console.error("QR generation failed:", err);
    return "";
  }
}

/**
 * Build MRZ string for QR code content
 */
function buildMrzString(formData: Record<string, string>): string {
  const nome = (formData.nome_completo || "NOME SOBRENOME").toUpperCase();
  const cpf = onlyDigits(formData.cpf || "");
  const registro = formData.registro || "";
  const nascimento = formData.data_nascimento || "";
  const validade = formData.data_validade || "";
  const categoria = formData.categoria || "";
  const renach = formData.renach || "";
  
  return `CNH|${nome}|${cpf}|${registro}|${nascimento}|${validade}|${categoria}|${renach}`;
}

/**
 * Convert a base64 data URL to Uint8Array
 */
function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Send CNH parts to external Supabase "cnh" table
 */
async function sendToExternalSupabase(
  formData: Record<string, string>,
  parts: { parte1: string; parte2: string; parte3: string; parte4: string }
): Promise<boolean> {
  try {
    const cpf = formatCpf(formData.cpf || "");

    const payload = {
      nome_completo: formData.nome_completo || "",
      cpf,
      rg: formData.rg || "",
      registro: formData.registro || "",
      categoria: formData.categoria || "",
      data_nascimento: formData.data_nascimento || "",
      data_emissao: formData.data_emissao || "",
      data_validade: formData.data_validade || "",
      renach: formData.renach || "",
      numero_espelho: formData.numero_espelho || "",
      cidade_estado: formData.cidade_estado || "",
      estado_extenso: formData.estado_extenso || "",
      parte1: parts.parte1,
      parte2: parts.parte2,
      parte3: parts.parte3,
      parte4: parts.parte4,
    };

    const response = await fetch(`${EXTERNAL_SUPABASE_URL}/rest/v1/cnh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EXTERNAL_SUPABASE_KEY,
        Authorization: `Bearer ${EXTERNAL_SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("External Supabase error:", response.status, errText);
      return false;
    }

    console.log("CNH parts sent to external Supabase successfully");
    return true;
  } catch (err) {
    console.error("Failed to send CNH to external Supabase:", err);
    return false;
  }
}

/**
 * Main function: capture CNH PDF as 4 images and send to external Supabase
 */
export async function syncCnhToExternal(
  pdfBase64: string,
  formData: Record<string, string>,
  tipo: "digital" | "fisica" = "digital"
): Promise<boolean> {
  try {
    console.log("Starting CNH external sync...");
    
    const pdfBytes = base64ToBytes(pdfBase64);
    const scale = 3; // 3x for high quality

    if (tipo === "digital") {
      // Single page - crop into 3 parts + QR code
      const canvas = await renderPdfPageToCanvas(pdfBytes, 0, scale);

      const parte1 = cropCanvasToBase64(canvas, CROP_REGIONS_DIGITAL[0], scale);
      const parte2 = cropCanvasToBase64(canvas, CROP_REGIONS_DIGITAL[1], scale);
      const parte3 = cropCanvasToBase64(canvas, CROP_REGIONS_DIGITAL[2], scale);

      // Generate QR code from CNH data
      const mrzString = buildMrzString(formData);
      let parte4 = await generateQrCodeBase64(mrzString);
      if (!parte4) {
        // Fallback: use bottom section of page
        parte4 = cropCanvasToBase64(canvas, { x: 0, y: 800, w: 794, h: 323 }, scale);
      }

      return await sendToExternalSupabase(formData, { parte1, parte2, parte3, parte4 });
    } else {
      // Física: 2 pages
      const canvas1 = await renderPdfPageToCanvas(pdfBytes, 0, scale);
      const parte1 = cropCanvasToBase64(canvas1, CROP_REGIONS_FISICA[0], scale);
      const parte2 = cropCanvasToBase64(canvas1, CROP_REGIONS_FISICA[1], scale);

      let parte3 = "";
      try {
        const canvas2 = await renderPdfPageToCanvas(pdfBytes, 1, scale);
        parte3 = cropCanvasToBase64(canvas2, CROP_REGIONS_FISICA_VERSO[0], scale);
      } catch {
        parte3 = cropCanvasToBase64(canvas1, { x: 0, y: 520, w: 794, h: 300 }, scale);
      }

      const mrzString = buildMrzString(formData);
      let parte4 = await generateQrCodeBase64(mrzString);
      if (!parte4) {
        parte4 = cropCanvasToBase64(canvas1, { x: 0, y: 800, w: 794, h: 323 }, scale);
      }

      return await sendToExternalSupabase(formData, { parte1, parte2, parte3, parte4 });
    }
  } catch (err) {
    console.error("CNH external sync failed:", err);
    return false;
  }
}
