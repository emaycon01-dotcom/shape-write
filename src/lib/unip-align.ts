export const UNIP_ALIGN_STORAGE_KEY = "unip-field-positions";

export interface UnipFieldPosition {
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
}

/**
 * Lê o alinhamento salvo pelo editor e converte para o formato consumido
 * pela edge function generate-unip-pdf.
 *
 * O espaço de coordenadas tem 1288 x 1822 px: a página 1 (frente) ocupa
 * y 0–911 e a página 2 (verso) ocupa y 911–1822 (o gerador subtrai 911).
 */
export function loadUnipFieldPositions(): Record<string, UnipFieldPosition> | null {
  try {
    const raw = localStorage.getItem(UNIP_ALIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const map: Record<string, UnipFieldPosition> = {};
    for (const f of parsed) {
      if (!f?.id || typeof f.x !== "number" || typeof f.y !== "number") continue;
      map[f.id] = {
        x: f.x,
        y: f.y,
        fontSize: typeof f.fontSize === "number" ? f.fontSize : 17,
        ...(typeof f.w === "number" ? { w: f.w } : {}),
        ...(typeof f.h === "number" ? { h: f.h } : {}),
      };
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}
