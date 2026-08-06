export const PORTE_ALIGN_STORAGE_KEY = "porte-field-positions";

export interface PorteFieldPosition {
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
}

/**
 * Lê o alinhamento salvo pelo editor e converte para o formato consumido
 * pela edge function generate-porte-pdf.
 */
export function loadPorteFieldPositions(): Record<string, PorteFieldPosition> | null {
  try {
    const raw = localStorage.getItem(PORTE_ALIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const map: Record<string, PorteFieldPosition> = {};
    for (const f of parsed) {
      if (!f?.id || typeof f.x !== "number" || typeof f.y !== "number") continue;
      map[f.id] = {
        x: f.x,
        y: f.y,
        fontSize: typeof f.fontSize === "number" ? f.fontSize : 10,
        ...(typeof f.w === "number" ? { w: f.w } : {}),
        ...(typeof f.h === "number" ? { h: f.h } : {}),
      };
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}
