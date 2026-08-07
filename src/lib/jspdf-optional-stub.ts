/**
 * O jsPDF importa html2canvas, canvg e dompurify dinamicamente APENAS dentro de
 * `doc.html()` e `addSvgAsImage()` — recursos que este sistema não usa (a
 * rasterização é feita pelo html2canvas-pro). Sem este stub o build embarcava
 * ~375 kB extras que nunca são executados, pesando no primeiro carregamento.
 */
const stub = {} as never;

export default stub;
export const Canvg = stub;
export const presets = stub;
export const sanitize = stub;
