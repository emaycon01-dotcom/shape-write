/**
 * Renderização de PDF 100% no navegador — sem serviço externo (PDFShift/PDF.co).
 *
 * As Edge Functions continuam montando exatamente o mesmo HTML (mesmos
 * templates, mesmas fontes e MESMAS COORDENADAS). A única mudança é onde o
 * HTML vira PDF: agora é o próprio navegador do cliente.
 */
import { supabase } from "@/integrations/supabase/client";

/** Escala de renderização: 794px (A4 @96dpi) * 3.75 ≈ 2978px ≈ 360 DPI. */
/** Escala desejada: 794px (A4 @96dpi) * 6 ≈ 4764px ≈ 576 DPI. */
const RENDER_SCALE = 6;

/** Limite de dimensão de canvas do dispositivo (Safari/iOS é o mais restrito). */
let cachedMaxDim: number | null = null;
function detectMaxCanvasDimension(): number {
  if (cachedMaxDim !== null) return cachedMaxDim;
  const candidates = [16384, 11180, 8192, 4096];
  for (const size of candidates) {
    try {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = 32;
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(size - 2, 0, 2, 2);
      const ok = ctx.getImageData(size - 1, 1, 1, 1).data[0] === 255;
      c.width = 0;
      c.height = 0;
      if (ok) {
        cachedMaxDim = size;
        return size;
      }
    } catch {
      /* tenta o próximo */
    }
  }
  cachedMaxDim = 4096;
  return 4096;
}

/** Memória aproximada do aparelho (GB). Android antigo costuma reportar 2–4. */
function deviceMemoryGb(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 ? nav.deviceMemory : 4;
}

/** Fator de banda: aparelhos fracos processam faixas menores por vez. */
function memoryAreaFactor(): number {
  const gb = deviceMemoryGb();
  if (gb <= 2) return 0.25;
  if (gb <= 4) return 0.5;
  return 1;
}

/**
 * Maior escala segura para a página. Como a rasterização é feita em FAIXAS
 * horizontais, apenas a LARGURA precisa caber no limite do dispositivo — a
 * altura é fatiada. Isso mantém ~576 DPI também no iOS.
 */
function safeScale(width: number): number {
  const maxDim = detectMaxCanvasDimension();
  return Math.max(2, Math.min(RENDER_SCALE, maxDim / width));
}

/** Altura (em px CSS) de cada faixa, respeitando dimensão e área máximas. */
function bandCssHeight(width: number, scale: number): number {
  const maxDim = detectMaxCanvasDimension();
  const baseArea = maxDim >= 8192 ? 268_000_000 : 16_700_000; // iOS ~16.7 MP
  const maxArea = Math.max(4_000_000, Math.floor(baseArea * memoryAreaFactor()));
  const maxPxByArea = Math.floor(maxArea / (width * scale));
  const maxPx = Math.min(maxDim, maxPxByArea);
  return Math.max(64, Math.floor(maxPx / scale));
}

/** Dá tempo ao navegador de liberar memória entre faixas (crítico no Android). */
function breathe(ms = 16): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}



/** Famílias embutidas (@font-face base64) usadas pelos geradores. */
const EMBEDDED_FAMILIES = ["CNHDigital", "RGDigital", "RGOcrb", "CRLVFont", "OCRB"];

/** Garante que as @font-face (base64) estejam carregadas antes de rasterizar. */
async function ensureFontsLoaded(doc: Document) {
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const q = (family: string) => `16px ${/\s/.test(family) ? `"${family}"` : family}`;
  try {
    // Espera as folhas de estilo do clone serem processadas (o FontFaceSet
    // pode estar vazio logo após o clone).
    for (let i = 0; i < 20 && fonts.size === 0; i++) {
      await new Promise((r) => setTimeout(r, 25));
    }

    const families = new Set<string>(EMBEDDED_FAMILIES);
    fonts.forEach((f) => families.add(f.family.replace(/^['"]|['"]$/g, "")));

    await Promise.all(
      Array.from(families).map((family) => fonts.load(q(family)).catch(() => undefined)),
    );
    await fonts.ready;

    // Confirma de fato o carregamento das famílias declaradas no documento.
    const declared: string[] = [];
    fonts.forEach((f) => declared.push(f.family.replace(/^['"]|['"]$/g, "")));
    for (let i = 0; i < 40; i++) {
      const pending = declared.filter((f) => {
        try {
          return !fonts.check(q(f));
        } catch {
          return false;
        }
      });
      if (pending.length === 0) break;
      await Promise.all(pending.map((f) => fonts.load(q(f)).catch(() => undefined)));
      await new Promise((r) => setTimeout(r, 50));
    }
  } catch {
    /* ignora */
  }
}


function createHiddenFrame(html: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.width = "1400px";
    frame.style.height = "2000px";
    frame.style.border = "0";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";

    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) {
      frame.remove();
      reject(new Error("Não foi possível preparar o documento."));
      return;
    }

    // document.write mantém o mesmo Document/Window do iframe já anexado,
    // evitando o descolamento de contexto que ocorre com `srcdoc`.
    doc.open();
    doc.write(html);
    doc.close();

    const start = Date.now();
    const check = () => {
      const d = frame.contentDocument;
      if (d && d.defaultView && d.readyState === "complete") {
        resolve(frame);
        return;
      }
      if (Date.now() - start > 60_000) {
        frame.remove();
        reject(new Error("Tempo esgotado ao preparar o documento."));
        return;
      }
      window.setTimeout(check, 60);
    };
    check();
  });
}


async function waitForAssets(doc: Document) {
  // Fontes embutidas (@font-face base64)
  await ensureFontsLoaded(doc);


  // Imagens (templates em alta resolução, fotos, assinaturas)
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(
      (img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((done) => {
              img.addEventListener("load", () => done(), { once: true });
              img.addEventListener("error", () => done(), { once: true });
              window.setTimeout(done, 20_000);
            }),
    ),
  );

  // Dois frames para garantir layout final
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/**
 * O html2canvas desenha o texto num canvas do documento PRINCIPAL — as
 * @font-face declaradas apenas dentro do iframe não existem lá e o texto sai
 * com a fonte de fallback. Copiamos as regras para o documento principal.
 */
async function adoptFontFaces(doc: Document): Promise<() => void> {
  let css = "";
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRule[] = [];
    try {
      rules = Array.from(sheet.cssRules || []);
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule.cssText.trim().startsWith("@font-face")) css += rule.cssText + "\n";
    }
  }
  if (!css) return () => undefined;

  const style = document.createElement("style");
  style.setAttribute("data-pdf-fonts", "1");
  style.textContent = css;
  document.head.appendChild(style);
  await ensureFontsLoaded(document);
  return () => style.remove();
}

/**
 * Converte o HTML do documento (com uma ou mais `.page`) em um PDF base64.
 * Cada `.page` vira uma página do PDF com o tamanho exato em que foi montada,
 * preservando integralmente as coordenadas dos campos.
 */
export async function renderHtmlToPdfBase64(html: string): Promise<string> {
  return renderHtmlToDocument(html);
}

/**
 * Tenta em qualidade máxima e, se o aparelho não der conta (Android/celular
 * com pouca memória: canvas em branco, OOM, aba recarregando), repete com
 * escala menor em vez de falhar.
 */
async function renderHtmlToDocument(html: string): Promise<string> {
  const attempts = [RENDER_SCALE, 4, 3, 2];
  let lastError: unknown = null;
  for (const cap of attempts) {
    try {
      return await renderOnce(html, cap);
    } catch (e) {
      lastError = e;
      await breathe(300);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao gerar o PDF no navegador.");
}

async function renderOnce(html: string, scaleCap: number): Promise<string> {

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const frame = await createHiddenFrame(html);
  let releaseFonts: () => void = () => undefined;
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("Não foi possível montar o documento.");
    await waitForAssets(doc);
    releaseFonts = await adoptFontFaces(doc);


    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".page"));
    const targets = pages.length > 0 ? pages : [doc.body];

    let pdf: import("jspdf").jsPDF | null = null;

    for (const target of targets) {
      const width = target.offsetWidth || 794;

      const height = target.offsetHeight || 1123;

      const scale = safeScale(width);
      const band = Math.min(height, bandCssHeight(width, scale));
      const orientation = width > height ? "landscape" : "portrait";

      // 1px CSS (96dpi) = 0.75pt — mantém o tamanho físico exato do papel.
      const wPt = width * 0.75;
      const hPt = height * 0.75;

      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: "pt", format: [wPt, hPt], compress: true });
      } else {
        pdf.addPage([wPt, hPt], orientation);
      }

      for (let top = 0; top < height; top += band) {
        const sliceH = Math.min(band, height - top);

        const canvas = await html2canvas(target, {
          scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          width,
          height: sliceH,
          y: top,
          windowWidth: width,
          windowHeight: height,
          imageTimeout: 30_000,
          // O html2canvas rasteriza um clone em outro documento: sem isto as
          // @font-face embutidas (CNHDigital/RGOcrb) ainda não estão prontas
          // e o texto sai com a fonte de fallback.
          onclone: (cloned: Document) => ensureFontsLoaded(cloned),
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.98);
        // +0.05pt evita fio branco entre faixas por arredondamento.
        const yPt = top * 0.75;
        const hSlicePt = Math.min(sliceH * 0.75 + 0.05, hPt - yPt);
        pdf.addImage(imgData, "JPEG", 0, yPt, wPt, hSlicePt, undefined, "NONE");

        // Libera memória em dispositivos móveis
        canvas.width = 0;
        canvas.height = 0;
      }

    }


    if (!pdf) throw new Error("Documento vazio.");
    const uri = pdf.output("datauristring");
    const base64 = uri.split(",").pop() || "";
    return `data:application/pdf;base64,${base64}`;

  } finally {
    releaseFonts();
    frame.remove();
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type InvokeResult = { data: any; error: Error | null };

/**
 * Substitui `supabase.functions.invoke("generate-*-pdf", { body })`.
 * Pede o HTML à Edge Function e renderiza o PDF localmente.
 * Se a função devolver um PDF pronto (modos legados/ações), apenas repassa.
 */
export async function invokeGeneratePdf(
  functionName: string,
  options: { body: Record<string, unknown> },
): Promise<InvokeResult> {
  const body = options?.body ?? {};
  const isAction = typeof (body as { action?: unknown }).action === "string";

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: isAction ? body : { ...body, render: "html" },
  });

  if (error) return { data, error: error as Error };
  if (!data || typeof data !== "object") return { data, error: null };

  const payload = data as Record<string, unknown>;
  if (typeof payload.html !== "string") return { data: payload, error: null };

  try {
    const pdfBase64 = await renderHtmlToDocument(payload.html);
    const result: Record<string, unknown> = { ...payload, pdfBase64 };
    delete result.html;


    // Unimed: o portal de validação precisa do arquivo hospedado.
    if (functionName === "generate-unimed-pdf" && payload.token && body.preview !== true) {
      try {
        const { data: attached } = await supabase.functions.invoke(functionName, {
          body: { token: payload.token, attach_pdf: pdfBase64 },
        });
        if (attached && typeof attached === "object" && "pdf_url" in attached) {
          result.pdf_url = (attached as Record<string, unknown>).pdf_url;
        }
      } catch (e) {
        console.warn("Falha ao anexar PDF na validação:", e);
      }
    }

    return { data: result, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error("Falha ao gerar o PDF no navegador.") };
  }
}
