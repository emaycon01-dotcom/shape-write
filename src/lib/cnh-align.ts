export const CNH_ALIGN_STORAGE_KEY = "cnh-field-positions";

export interface CnhFieldPosition {
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
  rotate?: number;
}

/**
 * Reads the alignment saved by the alignment editor and converts it to the
 * shape consumed by the generate-cnh-pdf edge function.
 */
export function loadCnhFieldPositions(): Record<string, CnhFieldPosition> | null {
  try {
    const raw = localStorage.getItem(CNH_ALIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const map: Record<string, CnhFieldPosition> = {};
    for (const f of parsed) {
      if (!f?.id || typeof f.x !== "number" || typeof f.y !== "number") continue;
      map[f.id] = {
        x: f.x,
        y: f.y,
        fontSize: typeof f.fontSize === "number" ? f.fontSize : 6.5,
        ...(typeof f.w === "number" ? { w: f.w } : {}),
        ...(typeof f.h === "number" ? { h: f.h } : {}),
        ...(typeof f.rotate === "number" ? { rotate: f.rotate } : {}),
      };
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}
