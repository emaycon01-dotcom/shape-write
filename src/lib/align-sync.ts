import { supabase } from "@/integrations/supabase/client";
import { CNH_ALIGN_STORAGE_KEY } from "@/lib/cnh-align";
import { RG_ALIGN_STORAGE_KEY } from "@/lib/rg-align";
import { ATESTADO_ALIGN_STORAGE_KEY } from "@/lib/atestado-align";
import { CRLV_ALIGN_STORAGE_KEY } from "@/lib/crlv-align";
import { CHA_ALIGN_STORAGE_KEY } from "@/lib/cha-align";

/** Mapeia o tipo de documento para a chave usada no cache local. */
export const ALIGN_STORAGE_BY_DOC: Record<string, string> = {
  cnh: CNH_ALIGN_STORAGE_KEY,
  rg: RG_ALIGN_STORAGE_KEY,
  atestado: ATESTADO_ALIGN_STORAGE_KEY,
  crlv: CRLV_ALIGN_STORAGE_KEY,
  cha: CHA_ALIGN_STORAGE_KEY,
};

/**
 * Salva o alinhamento de um documento no banco (global, vale para todos os
 * dispositivos) e também no cache local para efeito imediato.
 */
export async function saveAlignmentToDb(docType: string, fields: unknown[]) {
  const key = ALIGN_STORAGE_BY_DOC[docType];
  if (key) localStorage.setItem(key, JSON.stringify(fields));

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("template_alignments")
    .upsert(
      {
        doc_type: docType,
        positions: fields as never,
        updated_by: userData?.user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doc_type" }
    );

  if (error) throw error;
}

/**
 * Baixa os alinhamentos salvos no banco e atualiza o cache local, para que o
 * editor e a geração de PDF usem sempre as coordenadas oficiais.
 */
export async function syncAlignmentsFromDb(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("template_alignments")
      .select("doc_type, positions");
    if (error || !data) return;

    for (const row of data) {
      const key = ALIGN_STORAGE_BY_DOC[row.doc_type as string];
      if (!key || !Array.isArray(row.positions)) continue;
      localStorage.setItem(key, JSON.stringify(row.positions));
      window.dispatchEvent(new CustomEvent(`${row.doc_type}-align-updated`));
    }
  } catch {
    /* offline: mantém o cache local */
  }
}
