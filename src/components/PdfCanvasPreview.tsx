import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

type PdfCanvasPreviewProps = {
  pdfDataUrl: string;
  title: string;
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const encoded = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Preview próprio para Android. Chrome/WebView não renderiza PDF dentro de
 * iframe e exibe apenas o cartão "Abrir". Aqui o PDF é desenhado num canvas
 * leve; o arquivo original permanece intacto para baixar/compartilhar.
 */
export function PdfCanvasPreview({ pdfDataUrl, title }: PdfCanvasPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;

    const render = async () => {
      setStatus("loading");
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        loadingTask = pdfjs.getDocument({ data: dataUrlToBytes(pdfDataUrl) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const host = hostRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !host || !context) throw new Error("Canvas indisponível");

        const base = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(280, host.clientWidth);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const scale = Math.min(2.25, (availableWidth * pixelRatio) / base.width);
        const viewport = page.getViewport({ scale });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: context, viewport }).promise;
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
      if (loadingTask) void loadingTask.destroy();
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [pdfDataUrl]);

  return (
    <div ref={hostRef} className="flex h-full w-full items-start justify-center overflow-auto bg-background">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">Não foi possível montar o preview</p>
          <p className="text-sm text-muted-foreground">Volte ao formulário e tente novamente.</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-label={title}
        className={status === "ready" ? "block h-auto max-w-full" : "invisible"}
      />
    </div>
  );
}