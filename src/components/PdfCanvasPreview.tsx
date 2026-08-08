import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Search, X } from "lucide-react";
import { completePdfPresentation } from "@/lib/pdf-loading";
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
  // O PDF.js mantém simultaneamente a imagem decodificada da página e o canvas
  // de saída. Usar o limite teórico do Safari (16,7 MP) podia consumir mais de
  // 120 MB durante essa duplicação e matar a renderização mesmo em iPhones
  // novos. Estes limites consideram o pico real, não apenas o canvas final.
  if (gb <= 2) return 3_000_000;
  if (ios) return 5_000_000;
  return mobile ? 8_000_000 : 20_000_000;
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 1;
  canvas.height = 1;
  canvas.remove();
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
  const repaintRef = useRef<((zoom: number) => void) | null>(null);
  const lensCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);
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
    const clearStage = () => {
      const stage = stageRef.current;
      if (stage) {
        stage.querySelectorAll("canvas").forEach((c) => {
          releaseCanvas(c);
        });
        stage.remove();
        stageRef.current = null;
      }
    };

    let cancelled = false;
    let destroyLoadingTask: (() => Promise<void>) | null = null;

    /**
     * O Safari/WebKit pode levar alguns frames para promover um canvas grande
     * à camada visível. Revelar o stage e retirar o overlay no mesmo frame
     * mostrava por alguns segundos apenas o fundo preto e as marcas d'água.
     * Mantemos a troca atômica: o novo documento só aparece depois de composto.
     */
    const presentStage = async (stage: HTMLDivElement, host: HTMLDivElement) => {
      if (cancelled) return;
      stage.style.visibility = "hidden";
      host.appendChild(stage);
      void stage.offsetHeight;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      if (cancelled) {
        stage.remove();
        return;
      }
      stage.style.visibility = "visible";
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 180))),
      );
      if (cancelled) return;
      const previous = stageRef.current;
      stageRef.current = stage;
      previous?.querySelectorAll("canvas").forEach((canvas) => releaseCanvas(canvas));
      previous?.remove();
      setStatus("ready");
      completePdfPresentation();
    };

    const renderFromBands = async (): Promise<boolean> => {
      const { getPreviewPages } = await import("@/lib/canvas-pdf");
      const pages = getPreviewPages(pdfDataUrl);
      const host = hostRef.current;
      if (!pages || !host) return false;

      const stage = document.createElement("div");
      stage.className = "flex w-full flex-col items-center gap-3 py-1";
      const sideLimit = maxCanvasSide();

      // Decodifica cada faixa uma única vez. Com as imagens em memória o
      // preview pode ser repintado em resoluções maiores durante o zoom sem
      // reprocessar o PDF — é isso que eliminava o "borrão" seguido do nítido.
      const decoded: Array<{ page: (typeof pages)[number]; images: HTMLImageElement[] }> = [];
      for (const page of pages) {
        const images: HTMLImageElement[] = [];
        for (const band of page.bands) {
          const img = new Image();
          const ok = await new Promise<boolean>((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = band.url;
          });
          if (cancelled) return true;
          if (!ok) return false;
          images.push(img);
        }
        decoded.push({ page, images });
      }

      const canvases: HTMLCanvasElement[] = [];

      const paint = (zoom: number) => {
        const availableWidth = Math.max(280, host.clientWidth);
        const pixelRatio = Math.min((window.devicePixelRatio || 1) * zoom, 4);
        const budget = pixelBudget() / Math.max(1, decoded.length);

        decoded.forEach(({ page, images }, index) => {
          // Nunca acima da densidade real das faixas geradas: acima disso só
          // gastaria memória sem ganho visual.
          const nativeScale = (images[0]?.naturalWidth || page.width) / page.width;
          let scale = Math.min(nativeScale, ((availableWidth * pixelRatio) / page.width) * 1.15);
          const area = page.width * page.height * scale * scale;
          if (area > budget) scale *= Math.sqrt(budget / area);
          scale = Math.max(0.4, Math.min(scale, sideLimit / Math.max(page.width, page.height)));

          const canvas = canvases[index] ?? document.createElement("canvas");
          const width = Math.ceil(page.width * scale);
          if (canvases[index] && Math.abs(canvas.width - width) < canvas.width * 0.12) return;
          canvas.width = width;
          canvas.height = Math.ceil(page.height * scale);
          canvas.style.aspectRatio = `${page.width} / ${page.height}`;
          canvas.className = "block h-auto max-w-full bg-white shadow-sm";
          canvas.setAttribute("aria-label", title);
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) return;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          page.bands.forEach((band, bandIndex) => {
            const img = images[bandIndex];
            if (!img) return;
            ctx.drawImage(
              img,
              0,
              Math.round(band.top * scale),
              canvas.width,
              Math.ceil(band.height * scale),
            );
          });

          if (!canvases[index]) {
            canvases[index] = canvas;
            stage.appendChild(canvas);
          }
        });
      };

      paint(1);
      if (canvases.length === 0) return false;
      if (cancelled) return true;
      repaintRef.current = (zoom: number) => {
        if (!cancelled) paint(zoom);
      };
      await presentStage(stage, host);
      return true;
    };



    const render = async () => {
      setStatus("loading");
      try {
        // Caminho rápido: as faixas já rasterizadas na geração são exibidas
        // direto, sem o PDF.js redesenhar o documento inteiro outra vez.
        if (await renderFromBands()) return;

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
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        // Orçamento dividido entre as páginas para não estourar memória.
        const budget = pixelBudget() / Math.max(1, pageCount);
        const sideLimit = maxCanvasSide();
        let pagesRendered = 0;

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const base = page.getViewport({ scale: 1 });
          // Rasteriza ligeiramente acima da densidade física da tela. O fator
          // antigo de 2,25x criava outro bitmap de 14–18 MP em cima do PDF já
          // decodificado; isso era a causa da falha intermitente por aparelho.
          let scale = Math.min(4, ((availableWidth * pixelRatio) / base.width) * 1.25);
          const area = base.width * base.height * scale * scale;
          if (area > budget) scale *= Math.sqrt(budget / area);
          // Nenhum lado pode ultrapassar o limite físico de canvas do aparelho.
          const sideScale = sideLimit / Math.max(base.width, base.height);
          scale = Math.min(scale, sideScale);
          scale = Math.max(0.4, scale);

          // Escada de segurança: qualidade máxima primeiro; se o aparelho não
          // aguentar, cai degrau a degrau em vez de quebrar o preview.
          const ladder = [1, 0.72, 0.5, 0.34, 0.24].map((f) =>
            Math.max(0.3, Math.min(scale * f, sideScale)),
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
              candidate.width = Math.ceil(viewport.width);
              candidate.height = Math.ceil(viewport.height);
              const context = candidate.getContext("2d", { alpha: false });
              if (!context) throw new Error("Contexto 2D indisponível");
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
              releaseCanvas(candidate);
              console.warn(`Preview: página ${pageNumber} falhou em ${attemptScale.toFixed(2)}x`, err);
              // Dois frames + pausa dão ao WebKit tempo para desalocar o bitmap
              // que falhou antes de tentar um canvas menor.
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 180))),
              );
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
            await presentStage(stage, host);
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
  }, [pdfDataUrl, title, retryKey]);

  /**
   * Ao dar zoom (pinça ou zoom do navegador) o canvas antigo era apenas
   * esticado — daí o efeito de "borrão". Aqui o documento é repintado na
   * densidade do zoom atual, usando as faixas já decodificadas em memória.
   */
  useEffect(() => {
    if (status !== "ready") return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const zoom = window.visualViewport?.scale ?? 1;
        repaintRef.current?.(Math.min(Math.max(zoom, 1), 3));
      }, 220);
    };
    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(timer);
      vv?.removeEventListener("resize", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [status]);

  return (
    <div
      ref={hostRef}
      className={`relative isolate flex h-full w-full items-start justify-center overflow-auto bg-background ${
        // Enquanto carrega (ou em erro) o componente sobe acima das camadas
        // irmãs da página (marca d'água). Sem isso o usuário via o fundo escuro
        // do container com as marcas d'água por cima — o "quadro preto".
        status === "ready" ? "" : "z-40 "
      }${lensOn ? "touch-none select-none" : ""}`}
    >
      {status === "loading" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background">
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
          <button
            type="button"
            onClick={() => setRetryKey((v) => v + 1)}
            className="mt-1 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90"
          >
            Tentar novamente
          </button>
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


