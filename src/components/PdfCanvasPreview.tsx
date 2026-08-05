import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { subscribePdfLoading } from "@/lib/pdf-loading";

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
  if (gb <= 2) return 3_000_000;
  return mobile ? 6_000_000 : 12_000_000;
}

/**
 * Preview próprio para Android/iOS. Chrome/WebView não renderiza PDF dentro de
 * iframe e exibe apenas o cartão "Abrir". Aqui o PDF é desenhado num canvas
 * leve; o arquivo original permanece intacto para baixar/compartilhar.
 */
export function PdfCanvasPreview({ pdfDataUrl, title }: PdfCanvasPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resumeTimerRef = useRef<number>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [generationActive, setGenerationActive] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribePdfLoading((state) => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      if (state.active) {
        setGenerationActive(true);
      } else {
        // `invokeGeneratePdf` encerra o loading imediatamente antes de entregar
        // o PDF final à página. Este pequeno atraso evita remontar primeiro o
        // preview antigo e, logo depois, o final (duas renderizações seguidas).
        resumeTimerRef.current = window.setTimeout(() => setGenerationActive(false), 120);
      }
    });
    return () => {
      unsubscribe();
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Durante a geração final o canvas do preview concorria com os canvases de
    // 576 DPI. Liberá-lo temporariamente reduz o pico de memória; ao concluir,
    // o preview é montado novamente com o PDF final recebido pela página.
    if (generationActive) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      setStatus("loading");
      return;
    }
    let cancelled = false;
    let destroyLoadingTask: (() => Promise<void>) | null = null;

    const render = async () => {
      setStatus("loading");
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        const loadingTask = pdfjs.getDocument({ data: dataUrlToBytes(pdfDataUrl) });
        destroyLoadingTask = () => loadingTask.destroy();
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const host = hostRef.current;
        if (!canvas || !host) throw new Error("Canvas indisponível");

        const base = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(280, host.clientWidth);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        let scale = Math.min(2.25, (availableWidth * pixelRatio) / base.width);

        // Nunca ultrapassa o orçamento de pixels do aparelho — acima disso o
        // navegador descarta o bitmap e a tela sai preta/vazia.
        const budget = pixelBudget();
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
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: context, viewport }).promise;

            rendered = true;
          } catch (err) {
            if (attempt === 2) throw err;
            await new Promise((r) => setTimeout(r, 120));
          }
        }

        if (!cancelled) setStatus("ready");
        page.cleanup();
        await pdf.destroy();
      } catch (error) {
        console.error("Falha ao renderizar preview do PDF:", error);
        if (!cancelled) setStatus("error");
      }
    };

    void render();
    return () => {
      cancelled = true;
      if (destroyLoadingTask) void destroyLoadingTask();
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [pdfDataUrl, generationActive]);

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
      <canvas
        ref={canvasRef}
        aria-label={title}
        className={status === "ready" ? "block h-auto max-w-full bg-white" : "invisible"}
      />
    </div>
  );
}
