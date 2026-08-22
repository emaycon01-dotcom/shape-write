export const RECEITA_AZUL_ALIGN_STORAGE_KEY = "receita-azul-field-positions";

export interface ReceitaAzulFieldPosition {
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
  rotate?: number;
}

/**
 * Lê o alinhamento salvo pelo editor e converte para o formato consumido
 * pela edge function generate-receita-azul-pdf.
 */
export function loadReceitaAzulFieldPositions(): Record<string, ReceitaAzulFieldPosition> | null {
  try {
    const raw = localStorage.getItem(RECEITA_AZUL_ALIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const map: Record<string, ReceitaAzulFieldPosition> = {};
    for (const f of parsed) {
      if (!f?.id || typeof f.x !== "number" || typeof f.y !== "number") continue;
      map[f.id] = {
        x: f.x,
        y: f.y,
        fontSize: typeof f.fontSize === "number" ? f.fontSize : 12,
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
