/**
 * Renderização de PDF 100% no navegador — sem serviço externo (PDFShift/PDF.co).
 *
 * As Edge Functions continuam montando exatamente o mesmo HTML (mesmos
 * templates, mesmas fontes e MESMAS COORDENADAS). A única mudança é onde o
 * HTML vira PDF: agora é o próprio navegador do cliente.
 */
import { supabase } from "@/integrations/supabase/client";

/** Escala de renderização: 794px (A4 @96dpi) * 3.75 ≈ 2978px ≈ 360 DPI. */
const RENDER_SCALE = 3.75;

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
  try {
    await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* ignora */
  }

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
 * Converte o HTML do documento (com uma ou mais `.page`) em um PDF base64.
 * Cada `.page` vira uma página do PDF com o tamanho exato em que foi montada,
 * preservando integralmente as coordenadas dos campos.
 */
export async function renderHtmlToPdfBase64(html: string): Promise<string> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const frame = await createHiddenFrame(html);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error("Não foi possível montar o documento.");
    await waitForAssets(doc);

    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".page"));
    const targets = pages.length > 0 ? pages : [doc.body];

    let pdf: import("jspdf").jsPDF | null = null;

    for (const target of targets) {
      const width = target.offsetWidth || 794;
      const height = target.offsetHeight || 1123;

      const canvas = await html2canvas(target, {
        scale: RENDER_SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        imageTimeout: 30_000,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const orientation = width > height ? "landscape" : "portrait";

      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: "px", format: [width, height], compress: true });
      } else {
        pdf.addPage([width, height], orientation);
      }

      pdf.addImage(imgData, "JPEG", 0, 0, width, height, undefined, "FAST");
      // Libera memória em dispositivos móveis
      canvas.width = 0;
      canvas.height = 0;
    }

    if (!pdf) throw new Error("Documento vazio.");
    const uri = pdf.output("datauristring");
    const base64 = uri.split(",").pop() || "";
    return `data:application/pdf;base64,${base64}`;
  } finally {
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
    const pdfBase64 = await renderHtmlToPdfBase64(payload.html);
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
