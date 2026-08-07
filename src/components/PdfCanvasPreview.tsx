import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Search, X } from "lucide-react";
import { completePdfPresentation, subscribePdfLoading } from "@/lib/pdf-loading";
import { getPdfJs } from "@/lib/pdfjs-loader";

type PdfCanvasPreviewProps = {
  pdfDataUrl: string;
  title: string;
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const start = comma >= 0 ? comma + 1 : 0;
  const encodedLength = dataUrl.length - start;
  const padding = dataUrl.endsWith("==") ? 2 : dataUrl.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array(Math.floor((encodedLength * 3) / 4) - padding);
  let offset = 0;

  // Decodifica em blocos alinhados a 4 caracteres. O atob anterior criava uma
  // string binária do PDF inteiro ao mesmo tempo que o Uint8Array, duplicando o
  // uso de memória justamente ao abrir o preview.
  const chunkSize = 32_768;
  for (let index = start; index < dataUrl.length; index += chunkSize) {
    const end = Math.min(dataUrl.length, index + chunkSize);
    const binary = atob(dataUrl.substring(index, end));
    for (let byteIndex = 0; byteIndex < binary.length; byteIndex += 1) {
      bytes[offset] = binary.charCodeAt(byteIndex);
      offset += 1;
    }
  }
  return bytes;
}

/** Orçamento de pixels do canvas por dispositivo (evita tela preta em iOS/Android). */
function pixelBudget(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const gb = typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 ? nav.deviceMemory : 4;
  const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent) || gb <= 4;
  if (gb <= 2) return 8_000_000;
  return mobile ? 18_000_000 : 40_000_000;
}


/**
 * Preview próprio para Android/iOS. Chrome/WebView não renderiza PDF dentro de
 * iframe e exibe apenas o cartão "Abrir". Aqui o PDF é desenhado num canvas
 * leve; o arquivo original permanece intacto para baixar/compartilhar.
 */
export function PdfCanvasPreview({ pdfDataUrl, title }: PdfCanvasPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const resumeTimerRef = useRef<number>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [generationActive, setGenerationActive] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribePdfLoading((state) => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      if (state.generating) {
        setGenerationActive(true);
      } else {
        resumeTimerRef.current = window.setTimeout(() => setGenerationActive(false), 120);
      }
    });
    return () => {
      unsubscribe();
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const clearStage = () => {
      const stage = stageRef.current;
      if (stage) {
        stage.querySelectorAll("canvas").forEach((c) => {
          c.width = 0;
          c.height = 0;
        });
        stage.remove();
        stageRef.current = null;
      }
    };

    if (generationActive) {
      clearStage();
      setStatus("loading");
      return;
    }
    let cancelled = false;
    let destroyLoadingTask: (() => Promise<void>) | null = null;

    const render = async () => {
      setStatus("loading");
      try {
        const pdfjs = await getPdfJs();

        const loadingTask = pdfjs.getDocument({ data: dataUrlToBytes(pdfDataUrl) });
        destroyLoadingTask = () => loadingTask.destroy();
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const host = hostRef.current;
        if (!host) throw new Error("Canvas indisponível");

        // Um container NOVO a cada documento. Reaproveitar elementos existentes
        // fazia o WebKit/iOS desenhar com transform inválido.
        const stage = document.createElement("div");
        stage.className = "flex w-full flex-col items-center gap-3 py-1";

        const pageCount = pdf.numPages;
        const availableWidth = Math.max(280, host.clientWidth);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
        // Orçamento dividido entre as páginas para não estourar memória.
        const budget = pixelBudget() / Math.max(1, pageCount);

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const canvas = document.createElement("canvas");
          canvas.setAttribute("aria-label", `${title} — página ${pageNumber}`);
          canvas.className = "invisible";

          const base = page.getViewport({ scale: 1 });
          // Supersampling: rasteriza acima da densidade da tela para que textos
          // pequenos (MRZ, notas, campos) fiquem nítidos como no PDF final.
          let scale = Math.min(6, ((availableWidth * pixelRatio) / base.width) * 2.25);
          const area = base.width * base.height * scale * scale;
          if (area > budget) scale *= Math.sqrt(budget / area);
          scale = Math.max(0.4, scale);

          let rendered = false;
          for (let attempt = 0; attempt < 3 && !rendered; attempt += 1) {
            const viewport = page.getViewport({ scale: scale / (attempt === 0 ? 1 : attempt * 2) });
            try {
              const context = canvas.getContext("2d", { alpha: false });
              if (!context) throw new Error("Contexto 2D indisponível");
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
              context.setTransform(1, 0, 0, 1, 0, 0);
              context.fillStyle = "#ffffff";
              context.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({ canvasContext: context, viewport }).promise;
              rendered = true;
            } catch (err) {
              if (attempt === 2) throw err;
              await new Promise((r) => setTimeout(r, 120));
            }
          }

          if (cancelled) return;
          canvas.className = "block h-auto max-w-full bg-white shadow-sm";
          stage.appendChild(canvas);
          page.cleanup();

          if (pageNumber === 1) {
            clearStage();
            stageRef.current = stage;
            host.appendChild(stage);
            setStatus("ready");
            requestAnimationFrame(() => requestAnimationFrame(completePdfPresentation));
          }
        }

        await pdf.destroy();
      } catch (error) {
        console.error("Falha ao renderizar preview do PDF:", error);
        if (!cancelled) {
          setStatus("error");
          completePdfPresentation();
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
      if (destroyLoadingTask) void destroyLoadingTask();
      clearStage();
    };
  }, [pdfDataUrl, generationActive, title]);

  return (
    <div
      ref={hostRef}
      className="relative flex h-full w-full items-start justify-center overflow-auto bg-muted"
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">Não foi possível montar o preview</p>
          <p className="text-sm text-muted-foreground">
            O documento continua válido — use Baixar ou Compartilhar.
          </p>
        </div>
      )}
    </div>
  );
}


