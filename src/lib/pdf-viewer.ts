/**
 * Carregamento único do pdf.js usado pelo preview em canvas.
 *
 * Fica num módulo próprio para poder ser "aquecido" enquanto o usuário ainda
 * preenche o formulário — assim, quando o preview abre, o pdf.js e o worker já
 * estão em memória e a tela de carregamento praticamente não aparece.
 */
let viewerPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function warmPdfViewer() {
  if (viewerPromise) return viewerPromise;
  viewerPromise = Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return viewerPromise;
}
