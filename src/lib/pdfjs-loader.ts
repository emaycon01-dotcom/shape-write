/**
 * Instância única do PDF.js e do worker por sessão.
 * O carregamento começa ainda no formulário, em paralelo à geração, para que a
 * tela de resultado precise apenas pintar o PDF que já está em memória.
 */
let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  try {
    // O worker é um chunk separado: em rede instável ou após um deploy novo o
    // arquivo pode falhar. Nesse caso seguimos sem worker (main thread) em vez
    // de quebrar o preview inteiro.
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  } catch (error) {
    console.warn("Worker do PDF.js indisponível, usando main thread:", error);
    (pdfjs.GlobalWorkerOptions as { workerSrc?: string }).workerSrc = "";
    (pdfjs as unknown as { disableWorker?: boolean }).disableWorker = true;
  }
  return pdfjs;
}

export function getPdfJs() {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = loadPdfJs().catch((error) => {
    // Não deixa a promessa rejeitada em cache: a próxima tentativa recarrega.
    pdfJsPromise = null;
    throw error;
  });
  return pdfJsPromise;
}

export function warmPdfViewer() {
  return getPdfJs().catch(() => undefined);
}
