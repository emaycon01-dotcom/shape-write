export const ANHANGUERA_ALIGN_STORAGE_KEY = "anhanguera-field-positions";

export interface AnhangueraFieldPosition {
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
}

/**
 * Lê o alinhamento salvo pelo editor e converte para o formato consumido
 * pela edge function generate-anhanguera-pdf.
 *
 * Espaço de coordenadas: 1288 x 1938 px — a frente ocupa y 0–969 e o verso
 * y 969–1938 (o gerador subtrai 969).
 */
export function loadAnhangueraFieldPositions(): Record<string, AnhangueraFieldPosition> | null {
  try {
    const raw = localStorage.getItem(ANHANGUERA_ALIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const map: Record<string, AnhangueraFieldPosition> = {};
    for (const f of parsed) {
      if (!f?.id || typeof f.x !== "number" || typeof f.y !== "number") continue;
      map[f.id] = {
        x: f.x,
        y: f.y,
        fontSize: typeof f.fontSize === "number" ? f.fontSize : 15.5,
        ...(typeof f.w === "number" ? { w: f.w } : {}),
        ...(typeof f.h === "number" ? { h: f.h } : {}),
      };
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}
