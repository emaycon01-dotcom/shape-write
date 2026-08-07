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
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (gb <= 2) return 8_000_000;
  // Safari/iOS aborta o canvas acima de ~16,7 milhões de pixels: aí o preview
  // caía em "não foi possível montar" mesmo com o PDF perfeito.
  if (ios) return 14_000_000;
  return mobile ? 18_000_000 : 40_000_000;
}

/** Maior lado de canvas aceito pelo dispositivo (Safari antigo trava em 4096). */
let cachedMaxSide: number | null = null;
function maxCanvasSide(): number {
  if (cachedMaxSide !== null) return cachedMaxSide;
  for (const size of [16384, 11180, 8192, 4096]) {
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
        cachedMaxSide = size;
        return size;
      }
    } catch {
      /* tenta o próximo */
    }
  }
  cachedMaxSide = 4096;
  return 4096;
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
  const lensCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [generationActive, setGenerationActive] = useState(false);
  const [lensOn, setLensOn] = useState(false);
  const [lensPos, setLensPos] = useState<{ x: number; y: number } | null>(null);

  const LENS_SIZE = 172;
  const LENS_ZOOM = 3;

  /** Desenha na lupa o recorte do canvas da página que estiver sob o dedo/cursor. */
  const drawLens = useCallback((clientX: number, clientY: number) => {
    const host = hostRef.current;
    const lens = lensCanvasRef.current;
    if (!host || !lens) return;
    const hostRect = host.getBoundingClientRect();
    setLensPos({ x: clientX - hostRect.left, y: clientY - hostRect.top });

    const pages = stageRef.current?.querySelectorAll("canvas");
    let source: HTMLCanvasElement | null = null;
    let rect: DOMRect | null = null;
    pages?.forEach((c) => {
      const r = c.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        source = c as HTMLCanvasElement;
        rect = r;
      }
    });

    const ctx = lens.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (lens.width !== LENS_SIZE * dpr) {
      lens.width = LENS_SIZE * dpr;
      lens.height = LENS_SIZE * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LENS_SIZE, LENS_SIZE);
    if (!source || !rect) return;

    const src = source as HTMLCanvasElement;
    const r = rect as DOMRect;
    // Converte o ponto da tela para pixels reais do canvas renderizado.
    const ratioX = src.width / r.width;
    const ratioY = src.height / r.height;
    const cx = (clientX - r.left) * ratioX;
    const cy = (clientY - r.top) * ratioY;
    const sw = (LENS_SIZE / LENS_ZOOM) * ratioX;
    const sh = (LENS_SIZE / LENS_ZOOM) * ratioY;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, LENS_SIZE, LENS_SIZE);
  }, []);

  useEffect(() => {
    if (!lensOn) {
      setLensPos(null);
      return;
    }
    const host = hostRef.current;
    if (!host) return;
    const onMove = (event: PointerEvent) => {
      event.preventDefault();
      drawLens(event.clientX, event.clientY);
    };
    host.addEventListener("pointerdown", onMove, { passive: false });
    host.addEventListener("pointermove", onMove, { passive: false });
    return () => {
      host.removeEventListener("pointerdown", onMove);
      host.removeEventListener("pointermove", onMove);
    };
  }, [lensOn, drawLens, status]);


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
        const sideLimit = maxCanvasSide();
        let pagesRendered = 0;

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const base = page.getViewport({ scale: 1 });
          // Supersampling: rasteriza acima da densidade da tela para que textos
          // pequenos (MRZ, notas, campos) fiquem nítidos como no PDF final.
          let scale = Math.min(6, ((availableWidth * pixelRatio) / base.width) * 2.25);
          const area = base.width * base.height * scale * scale;
          if (area > budget) scale *= Math.sqrt(budget / area);
          // Nenhum lado pode ultrapassar o limite físico de canvas do aparelho.
          const sideScale = sideLimit / Math.max(base.width, base.height);
          scale = Math.min(scale, sideScale);
          scale = Math.max(0.4, scale);

          // Escada de segurança: qualidade máxima primeiro; se o aparelho não
          // aguentar, cai degrau a degrau em vez de quebrar o preview.
          const ladder = [1, 0.75, 0.55, 0.4, 0.28].map((f) =>
            Math.max(0.35, Math.min(scale * f, sideScale)),
          );

          let canvas: HTMLCanvasElement | null = null;
          for (const attemptScale of ladder) {
            // Canvas novo a cada tentativa: no WebKit um canvas que já falhou
            // na alocação continua inutilizável mesmo após redimensionar.
            const candidate = document.createElement("canvas");
            candidate.setAttribute("aria-label", `${title} — página ${pageNumber}`);
            candidate.className = "invisible";
            const viewport = page.getViewport({ scale: attemptScale });
            try {
              const context = candidate.getContext("2d", { alpha: false });
              if (!context) throw new Error("Contexto 2D indisponível");
              candidate.width = Math.ceil(viewport.width);
              candidate.height = Math.ceil(viewport.height);
              candidate.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
              context.setTransform(1, 0, 0, 1, 0, 0);
              context.fillStyle = "#ffffff";
              context.fillRect(0, 0, candidate.width, candidate.height);
              await page.render({ canvasContext: context, viewport }).promise;
              // Verifica se o canvas realmente recebeu pixels (iOS às vezes
              // devolve tudo em branco/preto sem lançar erro).
              const probe = context.getImageData(0, 0, 1, 1).data;
              if (probe[3] === 0) throw new Error("Rasterização vazia");
              canvas = candidate;
              break;
            } catch (err) {
              candidate.width = 0;
              candidate.height = 0;
              console.warn(`Preview: página ${pageNumber} falhou em ${attemptScale.toFixed(2)}x`, err);
              await new Promise((r) => setTimeout(r, 120));
            }
            if (cancelled) return;
          }

          if (cancelled) return;

          if (canvas) {
            canvas.className = "block h-auto max-w-full bg-white shadow-sm";
            stage.appendChild(canvas);
            pagesRendered += 1;
          }
          page.cleanup();

          if (pagesRendered === 1 && stageRef.current !== stage) {
            clearStage();
            stageRef.current = stage;
            host.appendChild(stage);
            setStatus("ready");
            requestAnimationFrame(() => requestAnimationFrame(completePdfPresentation));
          }
        }

        if (pagesRendered === 0) throw new Error("Nenhuma página pôde ser rasterizada");


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
      className={`relative flex h-full w-full items-start justify-center overflow-auto bg-muted ${
        lensOn ? "touch-none select-none" : ""
      }`}
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

      {status === "ready" && (
        <button
          type="button"
          onClick={() => setLensOn((v) => !v)}
          aria-label={lensOn ? "Desativar lupa" : "Ativar lupa"}
          className="absolute right-3 top-3 z-20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:bg-background data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"
          data-on={lensOn}
        >
          {lensOn ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>
      )}

      <div
        className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-2 border-primary bg-white shadow-2xl"
        style={{
          width: LENS_SIZE,
          height: LENS_SIZE,
          left: (lensPos?.x ?? 0) - LENS_SIZE / 2,
          top: (lensPos?.y ?? 0) - LENS_SIZE - 16,
          display: lensOn && lensPos ? "block" : "none",
        }}
      >
        <canvas ref={lensCanvasRef} className="h-full w-full" />
      </div>

      {lensOn && status === "ready" && !lensPos && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground/85 px-4 py-2 text-xs font-medium text-background">
          Arraste o dedo sobre o documento para ampliar
        </div>
      )}
    </div>
  );

}


