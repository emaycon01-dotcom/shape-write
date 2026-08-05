/**
 * Renderização de PDF 100% no navegador — sem serviço externo (PDFShift/PDF.co).
 *
 * As Edge Functions continuam montando exatamente o mesmo HTML (mesmos
 * templates, mesmas fontes e MESMAS COORDENADAS). A única mudança é onde o
 * HTML vira PDF: agora é o próprio navegador do cliente.
 */
import { supabase } from "@/integrations/supabase/client";
import { beginPdfLoading, endPdfLoading } from "@/lib/pdf-loading";

/** Escala de renderização: 794px (A4 @96dpi) * 3.75 ≈ 2978px ≈ 360 DPI. */
/** Escala desejada: 794px (A4 @96dpi) * 6 ≈ 4764px ≈ 576 DPI. */
const RENDER_SCALE = 6;

/**
 * Motor (html2canvas-pro + jsPDF) carregado UMA vez por sessão e reaproveitado.
 * O download/parse desses módulos era repetido a cada tentativa de render, o
 * que pesava bastante em Android.
 */
let enginePromise: Promise<{
  html2canvas: typeof import("html2canvas-pro").default;
  jsPDF: typeof import("jspdf").jsPDF;
}> | null = null;

export function warmPdfEngine() {
  if (enginePromise) return enginePromise;
  enginePromise = Promise.all([import("html2canvas-pro"), import("jspdf")]).then(
    ([h2c, jspdf]) => ({ html2canvas: h2c.default, jsPDF: jspdf.jsPDF }),
  );
  return enginePromise;
}

// Pré-aquece o motor assim que um formulário importa este módulo: o usuário
// ainda está preenchendo os campos, então o custo fica invisível.
if (typeof window !== "undefined") {
  window.setTimeout(() => void warmPdfEngine().catch(() => undefined), 1200);
}


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

/** Android (celular, tablet ou PC) — onde o canvas grande é mais frágil/lento. */
let cachedAndroid: boolean | null = null;
function isAndroid(): boolean {
  if (cachedAndroid !== null) return cachedAndroid;
  cachedAndroid = /android/i.test(navigator.userAgent);
  return cachedAndroid;
}

/** Fator de banda: aparelhos fracos processam faixas menores por vez. */
function memoryAreaFactor(): number {
  const gb = deviceMemoryGb();
  const cores = navigator.hardwareConcurrency || 4;
  if (gb <= 2 || cores <= 2) return 0.4;
  if (gb <= 4) return 0.75;
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

/**
 * Altura (em px CSS) de cada faixa.
 *
 * O ponto crítico não é o limite teórico do canvas, e sim o PICO de memória:
 * cada faixa vive como bitmap RGBA (4 bytes/px) + o JPEG gerado. Em Android o
 * navegador descarta canvases grandes silenciosamente (tela branca/erro), por
 * isso limitamos a ÁREA por faixa em vez de tentar a página inteira de uma vez.
 * A resolução (576 DPI) permanece intacta — só o tamanho do pedaço muda.
 */
function bandCssHeight(width: number, scale: number): number {
  const maxDim = detectMaxCanvasDimension();
  const mobile = isAndroid() || maxDim < 8192;
  // O bitmap RGBA é apenas parte do pico: durante html2canvas também coexistem
  // clone, template decodificado e encoder JPEG. 16 MP ainda chegava a mais de
  // 100 MB reais e fazia WebKit/Android devolver canvas branco ou preto.
  // A faixa menor NÃO reduz DPI: apenas divide a mesma página em mais pedaços.
  const baseArea = mobile ? 5_000_000 : 10_000_000;

  const maxArea = Math.max(2_000_000, Math.floor(baseArea * memoryAreaFactor()));
  const maxPxByArea = Math.floor(maxArea / (width * scale));
  const maxPx = Math.min(maxDim, maxPxByArea);
  return Math.max(64, Math.floor(maxPx / scale));
}

/** Dá tempo ao navegador de liberar memória entre faixas (crítico no Android). */
function breathe(ms = 16): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Codifica a faixa em JPEG.
 *
 * `toDataURL` é síncrono e cria uma cópia base64 ~33% maior que o JPEG. Mantemos
 * cada faixa como bytes até o jsPDF incorporá-la. Assim não coexistem canvas,
 * string binária e base64 durante a etapa mais pesada da geração.
 */
function encodeJpeg(canvas: HTMLCanvasElement, quality = 0.95): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== "function") {
      try {
        const encoded = canvas.toDataURL("image/jpeg", quality);
        const comma = encoded.indexOf(",");
        const binary = atob(comma >= 0 ? encoded.slice(comma + 1) : encoded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        resolve(bytes);
      } catch (e) {
        reject(e as Error);
      }
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao codificar a faixa."));
          return;
        }
        blob.arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(() => reject(new Error("Falha ao ler a faixa.")));
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Converte o Blob final uma única vez, sem criar e dividir uma Data URI gigante. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao finalizar o PDF."));
    reader.readAsDataURL(blob);
  });
}


/**
 * Detecta canvas "preto" (falha silenciosa de memória em iPadOS/Android).
 * Amostra alguns pontos; se todos forem quase pretos, a faixa é inválida.
 */
function isCanvasBlack(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width < 2 || canvas.height < 2) return false;
    const points: Array<[number, number]> = [
      [0.5, 0.5],
      [0.15, 0.2],
      [0.85, 0.8],
      [0.5, 0.05],
      [0.5, 0.95],
    ];
    for (const [px, py] of points) {
      const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(canvas.width * px)));
      const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(canvas.height * py)));
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[0] > 16 || d[1] > 16 || d[2] > 16) return false;
    }
    return true;
  } catch {
    return false;
  }
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


export function createHiddenFrame(html: string): Promise<HTMLIFrameElement> {
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


export async function waitForAssets(doc: Document) {
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

  const failedImage = images.find((img) => !img.complete || img.naturalWidth < 1 || img.naturalHeight < 1);
  if (failedImage) throw new Error("Uma imagem do documento não pôde ser carregada.");

  // Decodifica os bitmaps UMA vez (o html2canvas clona o documento a cada
  // faixa; sem o decode prévio o Android redecodifica o template pesado em
  // todas elas, que é a maior perda de tempo na geração).
  await Promise.all(
    Array.from(doc.images).map((img) =>
      typeof img.decode === "function" ? img.decode().catch(() => undefined) : Promise.resolve(),
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
let adoptedFontCss: string | null = null;

export async function adoptFontFaces(doc: Document): Promise<() => void> {
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

  // As @font-face são base64 pesadas: reaproveitamos a mesma injeção entre
  // tentativas e gerações, em vez de reprocessar as fontes toda vez.
  if (adoptedFontCss === css && document.head.querySelector("style[data-pdf-fonts]")) {
    return () => undefined;
  }

  document.head.querySelectorAll("style[data-pdf-fonts]").forEach((el) => el.remove());
  const style = document.createElement("style");
  style.setAttribute("data-pdf-fonts", "1");
  style.textContent = css;
  document.head.appendChild(style);
  adoptedFontCss = css;
  await ensureFontsLoaded(document);
  return () => undefined;
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
 * Sempre tenta manter a QUALIDADE MÁXIMA (576 DPI). Se o aparelho não der
 * conta, primeiro reduzimos apenas o TAMANHO DAS FAIXAS (mesma resolução
 * final, só que rasterizada em pedaços menores) — isso resolve a maioria dos
 * casos em Android/iOS sem perder nitidez. Só depois de esgotar as faixas
 * menores é que a escala cai, como último recurso para não travar a tela.
 */
async function renderHtmlToDocument(html: string, preview = false): Promise<string> {
  // Preview não precisa carregar um PDF de 576 DPI no iframe do Android. O
  // documento final continua sempre na escala máxima; em aparelhos fracos
  // reduzimos somente a altura das faixas, nunca a resolução.
  const attempts: Array<{ cap: number; bandDivisor: number }> = preview
    ? [
        { cap: 2, bandDivisor: 1 },
        { cap: 2, bandDivisor: 2 },
        { cap: 2, bandDivisor: 4 },
      ]
    : [
        // Começa conservador em vez de provocar OOM e repetir com a memória já
        // pressionada. As duas tentativas preservam integralmente os 576 DPI.
        { cap: RENDER_SCALE, bandDivisor: 1 },
        { cap: RENDER_SCALE, bandDivisor: 2 },
      ];
  let lastError: unknown = null;
  for (const { cap, bandDivisor } of attempts) {
    try {
      return await renderOnce(html, cap, bandDivisor);
    } catch (e) {
      lastError = e;
      // Pausa maior a cada tentativa: dá tempo do navegador liberar memória.
      await breathe(800);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao gerar o PDF no navegador.");
}

async function renderOnce(html: string, scaleCap: number, bandDivisor = 1): Promise<string> {

  const { html2canvas, jsPDF } = await warmPdfEngine();


  const frame = await createHiddenFrame(html);
  let releaseFonts: () => void = () => undefined;
  let fontsWarm = false;

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

      const scale = Math.min(safeScale(width), scaleCap);
      const band = Math.max(
        32,
        Math.min(height, Math.floor(bandCssHeight(width, scale) / bandDivisor)),
      );


      const orientation = width > height ? "landscape" : "portrait";

      // 1px CSS (96dpi) = 0.75pt — mantém o tamanho físico exato do papel.
      const wPt = width * 0.75;
      const hPt = height * 0.75;

      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: "pt", format: [wPt, hPt], compress: true });
      } else {
        pdf.addPage([wPt, hPt], orientation);
      }

      // ---------------------------------------------------------------
      // Fatiamento por JANELA REAL em vez das opções `y`/`windowHeight`
      // do html2canvas. Aquelas dependem do scroll do documento clonado e,
      // em Android/iOS, produziam faixas deslocadas (documento "espremido"
      // num canto) ou páginas em branco. Aqui a própria página é deslocada
      // dentro de um contêiner que recorta exatamente a faixa desejada —
      // determinístico em qualquer navegador e sem perda de resolução.
      // ---------------------------------------------------------------
      const parent = target.parentNode;
      const anchor = doc.createComment("band-anchor");
      const viewport = doc.createElement("div");
      const inlineStyle = target.getAttribute("style") || "";

      if (parent) {
        parent.insertBefore(anchor, target);
        viewport.style.cssText = [
          `width:${width}px`,
          "overflow:hidden",
          "position:relative",
          "background:#ffffff",
          "margin:0",
          "padding:0",
        ].join(";");
        viewport.appendChild(target);
        parent.insertBefore(viewport, anchor);
      }

      try {
        for (let top = 0; top < height; top += band) {
          const sliceH = Math.min(band, height - top);

          if (parent) {
            viewport.style.height = `${sliceH}px`;
            target.style.marginTop = `${-top}px`;
          }

          const canvas = await html2canvas(parent ? viewport : target, {
            scale,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            logging: false,
            width,
            height: sliceH,
            windowWidth: width,
            windowHeight: sliceH,
            scrollX: 0,
            scrollY: 0,
            imageTimeout: 30_000,
            // O html2canvas rasteriza um clone em outro documento: sem isto as
            // @font-face embutidas (CNHDigital/RGOcrb) ainda não estão prontas
            // e o texto sai com a fonte de fallback. Depois da primeira faixa as
            // famílias já estão quentes no documento principal — repetir a
            // verificação completa custava segundos por faixa no Android.
            onclone: async (cloned: Document) => {
              if (fontsWarm) {
                await (cloned as Document & { fonts?: FontFaceSet }).fonts?.ready;
                return;
              }
              await ensureFontsLoaded(cloned);
              fontsWarm = true;
            },
          });

          // Quando falta memória (iPad/Android), o navegador devolve um canvas
          // totalmente preto em vez de erro — o PDF final saía todo preto.
          // Detectamos aqui e a tentativa seguinte usa faixas menores.
          if (isCanvasBlack(canvas)) {
            canvas.width = 0;
            canvas.height = 0;
            throw new Error("Rasterização vazia (memória insuficiente).");
          }

          // 0.95 é visualmente idêntico a 0.98 em 576 DPI e corta ~35% do tempo
          // de codificação/memória do JPEG — o gargalo em Android.
          // Codificação assíncrona (toBlob): não congela a interface por faixa.
          const imgData = await encodeJpeg(canvas, 0.95);


          if (imgData.byteLength < 1024) throw new Error("Falha ao rasterizar a página.");
          // +0.05pt evita fio branco entre faixas por arredondamento.
          const yPt = top * 0.75;
          const hSlicePt = Math.min(sliceH * 0.75 + 0.05, hPt - yPt);
          pdf.addImage(imgData, "JPEG", 0, yPt, wPt, hSlicePt, undefined, "NONE");

          // Libera memória em dispositivos móveis
          canvas.width = 0;
          canvas.height = 0;
          await breathe();
        }
      } finally {
        // Restaura o DOM original da página (importante para páginas seguintes).
        if (parent) {
          if (inlineStyle) target.setAttribute("style", inlineStyle);
          else target.removeAttribute("style");
          parent.insertBefore(target, anchor);
          viewport.remove();
          anchor.remove();
        }
      }




    }


    if (!pdf) throw new Error("Documento vazio.");
    // `datauristring` + `split` mantinha duas cópias enormes do PDF na memória.
    // Blob preserva o binário e só cria a Data URL única exigida pelo restante
    // do app no último instante, reduzindo fortemente o pico em Android/iOS.
    return await blobToDataUrl(pdf.output("blob"));

  } finally {
    releaseFonts();
    frame.remove();
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type InvokeResult = { data: any; error: Error | null };

/**
 * Módulos já migrados para o motor VETORIAL (pdf-lib).
 * Nesses documentos o PDF deixa de ser uma foto do HTML: o texto vira texto
 * de verdade, o QR vira vetor e o template entra como imagem única — sem
 * canvas gigante, sem tela preta/branca e sem perda de nitidez.
 */
const VECTOR_FUNCTIONS = new Set([
  "generate-diploma-pdf",
  "generate-unip-pdf",
  "generate-anhanguera-pdf",
]);


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
  const isPreview = body.preview === true;

  beginPdfLoading(isPreview ? "Preparando a pré-visualização..." : "Gerando documento...");
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: isAction ? body : { ...body, render: "html" },
    });

    if (error) return { data, error: error as Error };
    if (!data || typeof data !== "object") return { data, error: null };

    const payload = data as Record<string, unknown>;
    if (typeof payload.html !== "string") return { data: payload, error: null };

    try {
      const pdfBase64 = await renderHtmlToDocument(payload.html, isPreview);
      const result: Record<string, unknown> = { ...payload, pdfBase64 };
      delete result.html;

      // Unimed / Receita: o portal de validação precisa do arquivo hospedado.
      if (
        (functionName === "generate-unimed-pdf" || functionName === "generate-receita-pdf") &&
        payload.token && !isPreview
      ) {
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
  } finally {
    endPdfLoading();
  }
}

