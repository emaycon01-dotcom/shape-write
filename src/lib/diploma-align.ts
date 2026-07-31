export const DIPLOMA_ALIGN_STORAGE_KEY = "diploma-field-positions";

export interface DiplomaFieldPosition {
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
  rotate?: number;
}

/**
 * Lê o alinhamento salvo pelo editor e converte para o formato consumido
 * pela edge function generate-diploma-pdf.
 *
 * O espaço de coordenadas tem 1288 x 1732 px: a página 1 ocupa y 0–866 e a
 * página 2 ocupa y 866–1732 (o gerador subtrai 866 nos campos da página 2).
 */
export function loadDiplomaFieldPositions(): Record<string, DiplomaFieldPosition> | null {
  try {
    const raw = localStorage.getItem(DIPLOMA_ALIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const map: Record<string, DiplomaFieldPosition> = {};
    for (const f of parsed) {
      if (!f?.id || typeof f.x !== "number" || typeof f.y !== "number") continue;
      map[f.id] = {
        x: f.x,
        y: f.y,
        fontSize: typeof f.fontSize === "number" ? f.fontSize : 11,
        ...(typeof f.w === "number" ? { w: f.w } : {}),
        ...(typeof f.h === "number" ? { h: f.h } : {}),
      };
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}
