/**
 * Instância única do PDF.js e do worker por sessão.
 * O carregamento começa ainda no formulário, em paralelo à geração, para que a
 * tela de resultado precise apenas pintar o PDF que já está em memória.
 */
let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfJs() {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfJsPromise;
}

export function warmPdfViewer() {
  return getPdfJs();
}