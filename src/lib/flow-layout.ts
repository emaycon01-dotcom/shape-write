import { supabase } from "@/integrations/supabase/client";

/**
 * Ajuste de layout para os serviços montados em FLUXO HTML (tabelas), que não
 * possuem coordenadas fixas. Em vez de X/Y por campo, o operador ajusta o
 * bloco inteiro: deslocamento, escala, tamanho de fonte e entrelinha.
 *
 * O ajuste é aplicado no cliente (injeção de CSS no HTML devolvido pela Edge
 * Function), então não depende de republicar nenhuma função.
 */

export interface FlowLayout {
  offsetX: number;
  offsetY: number;
  scale: number;
  fontScale: number;
  lineHeight: number;
}

export const FLOW_LAYOUT_DEFAULT: FlowLayout = {
  offsetX: 0,
  offsetY: 0,
  scale: 100,
  fontScale: 100,
  lineHeight: 100,
};

export interface FlowModule {
  key: string;
  title: string;
  fn: string;
}

export const FLOW_MODULES: FlowModule[] = [
  { key: "historico-eja", title: "Histórico/Certificado EJA", fn: "generate-historico-eja-pdf" },
  { key: "historico-medio-sp", title: "Histórico Ensino Médio (SP)", fn: "generate-historico-medio-sp-pdf" },
  { key: "historico-fundamental", title: "Histórico Ensino Fundamental", fn: "generate-historico-fundamental-pdf" },
  { key: "historico-superior", title: "Histórico Escolar Superior", fn: "generate-historico-superior-pdf" },
  { key: "certificado-medio", title: "Certificado + Histórico (Médio)", fn: "generate-certificado-medio-pdf" },
  { key: "ficha19", title: "Certificado + Histórico (Ficha 19)", fn: "generate-ficha19-pdf" },
  { key: "declaracao-escolaridade", title: "Declaração de Escolaridade", fn: "generate-declaracao-escolaridade-pdf" },
];

export const FLOW_MODULE_BY_FN: Record<string, FlowModule> = Object.fromEntries(
  FLOW_MODULES.map((m) => [m.fn, m]),
);

export const flowStorageKey = (key: string) => `flow-layout-${key}`;
export const flowDocType = (key: string) => `flow:${key}`;

export function loadFlowLayout(key: string): FlowLayout {
  try {
    const raw = localStorage.getItem(flowStorageKey(key));
    if (!raw) return { ...FLOW_LAYOUT_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<FlowLayout>;
    return { ...FLOW_LAYOUT_DEFAULT, ...parsed };
  } catch {
    return { ...FLOW_LAYOUT_DEFAULT };
  }
}

export function saveFlowLayoutLocal(key: string, layout: FlowLayout) {
  localStorage.setItem(flowStorageKey(key), JSON.stringify(layout));
}

export async function saveFlowLayoutToDb(key: string, layout: FlowLayout) {
  saveFlowLayoutLocal(key, layout);
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("template_alignments").upsert(
    {
      doc_type: flowDocType(key),
      positions: [layout] as never,
      updated_by: userData?.user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "doc_type" },
  );
  if (error) throw error;
}

export async function syncFlowLayoutsFromDb(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("template_alignments")
      .select("doc_type, positions");
    if (error || !data) return;
    for (const row of data) {
      const doc = String(row.doc_type ?? "");
      if (!doc.startsWith("flow:")) continue;
      const arr = row.positions as unknown;
      if (!Array.isArray(arr) || !arr[0]) continue;
      saveFlowLayoutLocal(doc.slice(5), { ...FLOW_LAYOUT_DEFAULT, ...(arr[0] as Partial<FlowLayout>) });
    }
  } catch {
    /* offline: mantém o cache local */
  }
}

function isDefault(l: FlowLayout) {
  return (
    l.offsetX === 0 && l.offsetY === 0 && l.scale === 100 && l.fontScale === 100 && l.lineHeight === 100
  );
}

/** Injeta o CSS de ajuste no HTML gerado pela Edge Function. */
export function applyFlowLayout(html: string, functionName: string): string {
  const mod = FLOW_MODULE_BY_FN[functionName];
  if (!mod || !html) return html;
  const l = loadFlowLayout(mod.key);
  if (isDefault(l)) return html;

  const css = `
<style id="flow-layout-adjust">
  .page, .pagina, body > .folha {
    transform: translate(${l.offsetX}px, ${l.offsetY}px) scale(${(l.scale / 100).toFixed(4)});
    transform-origin: top center;
  }
  .page, .pagina, body { font-size: ${(l.fontScale / 100).toFixed(4)}em; }
  .page *, .pagina * { line-height: ${(l.lineHeight / 100).toFixed(4)}em; }
</style>`;

  if (html.includes("</head>")) return html.replace("</head>", `${css}\n</head>`);
  return `${css}\n${html}`;
}
