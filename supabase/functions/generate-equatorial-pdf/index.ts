// Comprovante de Residência — Equatorial Goiás (CELG D / DANF3E NF3e).
// O template já contém TODO o conteúdo original preservado pelo cliente.
// Aqui apenas recriamos os campos que foram removidos do documento.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

/** Dimensões reais da página desta fatura (em pontos) — as páginas ficam empilhadas no editor. */
export const PAGE_W = 909;
export const PAGE_H = 1211;

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultEquatorialFields
export const EQUATORIAL_DEFAULT_POSITIONS: Record<string, Pos> = {
  /* ---- endereço de entrega (topo direito) ---- */
  entrega_titulo: { x: 695.0, y: 37.0, fontSize: 6.0, w: 200 },
  entrega_l1: { x: 695.0, y: 50.0, fontSize: 6.0, w: 200 },
  entrega_l2: { x: 695.0, y: 57.0, fontSize: 6.0, w: 200 },
  entrega_l3: { x: 695.0, y: 64.0, fontSize: 6.0, w: 200 },

  /* ---- classificação / fornecimento ---- */
  classificacao: { x: 33.0, y: 88.0, fontSize: 8.0, w: 300 },
  tipo_fornecimento: { x: 336.8, y: 90.0, fontSize: 8.0, w: 200 },

  /* ---- identificação do cliente ---- */
  cliente_nome: { x: 33.0, y: 126.0, fontSize: 8.0, w: 290 },
  cliente_cpf: { x: 33.0, y: 135.0, fontSize: 8.0, w: 290 },
  cliente_endereco: { x: 33.0, y: 144.0, fontSize: 8.0, w: 290 },
  cliente_bairro: { x: 33.0, y: 154.0, fontSize: 8.0, w: 290 },
  cliente_cep: { x: 33.0, y: 163.0, fontSize: 8.0, w: 290 },
  cliente_perdas: { x: 33.0, y: 172.0, fontSize: 8.0, w: 290 },

  /* ---- datas das leituras ---- */
  val_leitura_anterior: { x: 562.4, y: 139.0, fontSize: 10.0, w: 60 },
  val_leitura_atual: { x: 647.7, y: 139.0, fontSize: 10.0, w: 60 },
  val_dias: { x: 745.0, y: 139.0, fontSize: 10.0, w: 32 },
  val_proxima: { x: 805.8, y: 139.0, fontSize: 10.0, w: 60 },

  /* ---- nota fiscal ---- */
  nf_linha: { x: 612.0, y: 176.0, fontSize: 7.0, w: 250 },

  /* ---- faixa conta mês / vencimento / total ---- */
  referencia_topo: { x: 74.5, y: 254.0, fontSize: 10.0, w: 80 },
  vencimento_topo: { x: 196.1, y: 254.0, fontSize: 10.0, w: 80 },
  total_topo: { x: 347.3, y: 254.0, fontSize: 10.0, w: 110 },

  /* ---- informações para o cliente ---- */
  info_l1: { x: 33.0, y: 304.0, fontSize: 6.0, w: 560 },
  info_l2: { x: 33.0, y: 312.0, fontSize: 6.0, w: 560 },
  info_l3: { x: 33.0, y: 320.0, fontSize: 6.0, w: 560 },
  info_l4: { x: 33.0, y: 328.0, fontSize: 6.0, w: 800 },

  /* ---- itens de fatura ---- */
  it_grupo: { x: 34.0, y: 408.6, fontSize: 5.0, w: 120 },
  it_consumo_desc: { x: 34.0, y: 418.7, fontSize: 5.0, w: 120 },
  it_consumo_unid: { x: 229.4, y: 418.7, fontSize: 5.0, w: 30 },
  it_consumo_qtd: { x: 236.6, y: 418.7, fontSize: 5.0, w: 50 },
  it_consumo_preco: { x: 290.5, y: 418.7, fontSize: 5.0, w: 50 },
  it_consumo_valor: { x: 347.4, y: 418.7, fontSize: 5.0, w: 50 },
  it_consumo_pis: { x: 411.2, y: 418.7, fontSize: 5.0, w: 40 },
  it_consumo_base: { x: 451.4, y: 418.7, fontSize: 5.0, w: 50 },
  it_consumo_aliq: { x: 508.7, y: 418.7, fontSize: 5.0, w: 40 },
  it_consumo_icms: { x: 555.2, y: 418.7, fontSize: 5.0, w: 40 },
  it_consumo_tarifa: { x: 590.7, y: 418.7, fontSize: 5.0, w: 50 },

  it_fin_titulo: { x: 34.0, y: 429.0, fontSize: 5.0, w: 120 },
  fin1_desc: { x: 34.0, y: 439.7, fontSize: 5.0, w: 220 },
  fin1_valor: { x: 346.1, y: 439.7, fontSize: 5.0, w: 50 },
  fin2_desc: { x: 34.0, y: 447.7, fontSize: 5.0, w: 220 },
  fin2_valor: { x: 346.2, y: 447.7, fontSize: 5.0, w: 50 },
  fin3_desc: { x: 34.0, y: 455.7, fontSize: 5.0, w: 220 },
  fin3_valor: { x: 345.1, y: 455.7, fontSize: 5.0, w: 50 },
  fin4_desc: { x: 34.0, y: 463.7, fontSize: 5.0, w: 220 },
  fin4_valor: { x: 345.4, y: 463.7, fontSize: 5.0, w: 50 },

  /* ---- resolução ANEEL / apresentação ---- */
  res_aneel: { x: 559.0, y: 728.8, fontSize: 8.0, w: 60 },
  res_apresentacao: { x: 642.2, y: 728.8, fontSize: 8.0, w: 70 },

  /* ---- ficha de compensação (rodapé) ---- */
  rod_vencimento: { x: 599.0, y: 943.3, fontSize: 8.0, w: 90 },
  rod_unidade: { x: 341.0, y: 961.3, fontSize: 8.0, w: 120 },
  rod_referencia: { x: 513.0, y: 961.3, fontSize: 8.0, w: 90 },
  rod_data_doc: { x: 50.0, y: 979.3, fontSize: 8.0, w: 90 },
  rod_num_ref: { x: 140.0, y: 979.3, fontSize: 8.0, w: 140 },
  rod_especie: { x: 311.0, y: 979.3, fontSize: 8.0, w: 50 },
  rod_data_proc: { x: 483.0, y: 979.3, fontSize: 8.0, w: 90 },
  rod_nosso_numero: { x: 599.0, y: 979.3, fontSize: 8.0, w: 110 },
  rod_carteira: { x: 204.0, y: 997.3, fontSize: 8.0, w: 50 },
  rod_moeda: { x: 311.0, y: 997.3, fontSize: 8.0, w: 40 },
  rod_valor_doc: { x: 614.1, y: 997.3, fontSize: 8.0, w: 60 },

  /* ---- página 2 ---- */
  p2_unid_entrega: { x: 88.7, y: 1712.0, fontSize: 10.0, w: 50 },
  p2_sequencia: { x: 155.0, y: 1712.0, fontSize: 10.0, w: 55 },
  p2_medidor: { x: 213.1, y: 1712.0, fontSize: 10.0, w: 80 },
  p2_nome: { x: 163.0, y: 1801.0, fontSize: 10.0, w: 300 },
  p2_endereco: { x: 163.0, y: 1837.0, fontSize: 10.0, w: 300 },
  p2_bairro: { x: 163.0, y: 1849.0, fontSize: 10.0, w: 300 },
  p2_cep: { x: 163.0, y: 1861.0, fontSize: 10.0, w: 300 },
  p2_data_emissao: { x: 178.9, y: 1963.0, fontSize: 10.0, w: 80 },
  p2_referencia: { x: 270.4, y: 1963.0, fontSize: 10.0, w: 80 },
  p2_vencimento: { x: 348.1, y: 1963.0, fontSize: 10.0, w: 80 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...EQUATORIAL_DEFAULT_POSITIONS };
  let parsed: Record<string, Partial<Pos>> | null = null;

  try {
    parsed = typeof overrides === "string"
      ? JSON.parse(overrides)
      : (overrides as Record<string, Partial<Pos>>);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === "object") {
    for (const [key, value] of Object.entries(parsed)) {
      const base = result[key];
      if (!base || !value || typeof value.x !== "number" || typeof value.y !== "number") continue;
      result[key] = {
        ...base,
        x: value.x,
        y: value.y,
        fontSize: typeof value.fontSize === "number" ? value.fontSize : base.fontSize,
        ...(typeof value.w === "number" ? { w: value.w } : {}),
        ...(typeof value.h === "number" ? { h: value.h } : {}),
      };
    }
  }

  return result;
}

/** Reduz a fonte quando o texto é longo demais — nunca corta com "…". */
function fitTextStyle(value: string, baseSize: number, maxWidth: number, minRatio = 0.55) {
  const len = (value || "").trim().length;
  if (!len || !maxWidth) return "";
  const charRatio = 0.52;
  const estimated = len * baseSize * charRatio;
  if (estimated <= maxWidth) return "";
  const fitted = maxWidth / (len * charRatio);
  const size = Math.max(fitted, baseSize * minRatio);
  return `font-size:${size.toFixed(2)}px;`;
}

/* --------------------------------------------------------------- layout */

export function buildEquatorialHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const p = resolvePositions(fieldPositions);
  const bg1 = d.template_bg || "";
  const bg2 = d.template_bg_p2 || "";

  const RIGHT = new Set([
    "it_consumo_qtd", "it_consumo_preco", "it_consumo_valor", "it_consumo_pis",
    "it_consumo_base", "it_consumo_aliq", "it_consumo_icms", "it_consumo_tarifa",
    "fin1_valor", "fin2_valor", "fin3_valor", "fin4_valor",
    "rod_valor_doc",
  ]);
  const BOLD = new Set([
    "cliente_nome",
    "val_leitura_anterior", "val_leitura_atual", "val_dias", "val_proxima",
    "referencia_topo", "vencimento_topo", "total_topo",
    "rod_vencimento", "rod_unidade", "rod_referencia", "rod_data_doc", "rod_num_ref",
    "rod_especie", "rod_data_proc", "rod_nosso_numero", "rod_carteira", "rod_moeda",
    "rod_valor_doc",
    "p2_nome",
  ]);

  const field = (id: string, text: string, extra = "") => {
    const pos = p[id];
    if (!pos || !text) return "";
    const width = pos.w ?? 200;
    const fit = fitTextStyle(text, pos.fontSize, width);
    const align = RIGHT.has(id) ? "right" : "left";
    const weight = BOLD.has(id) ? 700 : 400;
    const html = escapeHtml(text).replace(/\n/g, "<br/>");
    const top = pos.y >= PAGE_H ? pos.y - PAGE_H : pos.y;
    return `<div class="ov" style="top:${top}px;left:${pos.x}px;width:${width}px;font-size:${pos.fontSize}px;${fit}text-align:${align};font-weight:${weight};${extra}">${html}</div>`;
  };

  const up = (v: string) => (v || "").toUpperCase();

  const nome = up(d.nome);
  const endereco = up(d.endereco);
  const bairro = up(d.bairro);
  const cepLinha = ["CEP:", (d.cep || "").replace(/\D/g, ""), up(d.municipio), up(d.uf), "BRASIL"]
    .filter(Boolean)
    .join(" ");

  const nfLinha = d.nota_fiscal
    ? `NOTA FISCAL Nº ${d.nota_fiscal} - SÉRIE ${d.serie_nf || "0"} / DATA DE EMISSÃO: ${d.data_emissao || ""}${d.hora_emissao ? ` ${d.hora_emissao}` : ""}`
    : "";

  const totalTopo = d.total_pagar ? `R$*********${d.total_pagar}` : "";

  const head = `
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: ${PAGE_W}px;
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  }
  .page { width: ${PAGE_W}px; height: ${PAGE_H}px; position: relative; background: #fff; overflow: hidden; }
  .bg { position: absolute; inset: 0; z-index: 0; }
  .bg img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .ov { position: absolute; z-index: 10; color: #111; line-height: 1.15; overflow: visible; white-space: pre-line; }
</style>`;

  return `<!DOCTYPE html>
<html>
<head>${head}</head>
<body>
<div class="page">
  <div class="bg">${bg1 ? `<img src="${escapeHtml(bg1)}" />` : ""}</div>

  ${field("entrega_titulo", "ENDEREÇO DE ENTREGA:")}
  ${field("entrega_l1", endereco)}
  ${field("entrega_l2", bairro)}
  ${field("entrega_l3", cepLinha)}

  ${field("classificacao", d.classificacao ? `Classificação: ${d.classificacao}` : "")}
  ${field("tipo_fornecimento", d.tipo_fornecimento ? `Tipo de fornecimento: ${d.tipo_fornecimento}` : "")}

  ${field("cliente_nome", nome)}
  ${field("cliente_cpf", d.cpf ? `CNPJ/CPF: ${d.cpf}` : "")}
  ${field("cliente_endereco", endereco)}
  ${field("cliente_bairro", bairro)}
  ${field("cliente_cep", cepLinha)}
  ${field("cliente_perdas", `PERDAS DE TRANSFORMAÇÃO / RAMAL: ${d.perdas || "0%"}`)}

  ${field("val_leitura_anterior", d.leitura_anterior || "")}
  ${field("val_leitura_atual", d.leitura_atual || "")}
  ${field("val_dias", d.dias || "")}
  ${field("val_proxima", d.proxima_leitura || "")}

  ${field("nf_linha", nfLinha)}

  ${field("referencia_topo", d.referencia || "")}
  ${field("vencimento_topo", d.vencimento || "")}
  ${field("total_topo", totalTopo)}

  ${field("info_l1", d.info_l1 || "")}
  ${field("info_l2", d.info_l2 || "")}
  ${field("info_l3", d.info_l3 || "")}
  ${field("info_l4", d.info_l4 || "")}

  ${field("it_grupo", "FORNECIMENTO")}
  ${field("it_consumo_desc", "CONSUMO")}
  ${field("it_consumo_unid", d.it_unid || "kWh")}
  ${field("it_consumo_qtd", d.it_quant || "")}
  ${field("it_consumo_preco", d.it_preco_unit || "")}
  ${field("it_consumo_valor", d.it_valor || "")}
  ${field("it_consumo_pis", d.it_pis || "")}
  ${field("it_consumo_base", d.it_base_icms || "")}
  ${field("it_consumo_aliq", d.it_aliquota || "")}
  ${field("it_consumo_icms", d.it_icms || "")}
  ${field("it_consumo_tarifa", d.it_tarifa || "")}

  ${field("it_fin_titulo", "ITENS FINANCEIROS")}
  ${field("fin1_desc", d.fin1_desc || "")}
  ${field("fin1_valor", d.fin1_valor || "")}
  ${field("fin2_desc", d.fin2_desc || "")}
  ${field("fin2_valor", d.fin2_valor || "")}
  ${field("fin3_desc", d.fin3_desc || "")}
  ${field("fin3_valor", d.fin3_valor || "")}
  ${field("fin4_desc", d.fin4_desc || "")}
  ${field("fin4_valor", d.fin4_valor || "")}

  ${field("res_aneel", d.res_aneel || "")}
  ${field("res_apresentacao", d.res_apresentacao || d.data_emissao || "")}

  ${field("rod_vencimento", d.vencimento || "")}
  ${field("rod_unidade", d.unidade_consumidora || "")}
  ${field("rod_referencia", d.referencia || "")}
  ${field("rod_data_doc", d.data_documento || d.data_emissao || "")}
  ${field("rod_num_ref", d.numero_referencia || "")}
  ${field("rod_especie", d.especie_documento || "MN")}
  ${field("rod_data_proc", d.data_processamento || d.data_emissao || "")}
  ${field("rod_nosso_numero", d.nosso_numero || "")}
  ${field("rod_carteira", d.carteira || "109")}
  ${field("rod_moeda", d.especie_moeda || "R$")}
  ${field("rod_valor_doc", d.total_pagar || "")}
</div>

<div class="page">
  <div class="bg">${bg2 ? `<img src="${escapeHtml(bg2)}" />` : ""}</div>
  ${field("p2_unid_entrega", d.unidade_entrega || "")}
  ${field("p2_sequencia", d.sequencia || "")}
  ${field("p2_medidor", d.medidor || "")}
  ${field("p2_nome", nome)}
  ${field("p2_endereco", endereco)}
  ${field("p2_bairro", bairro)}
  ${field("p2_cep", cepLinha)}
  ${field("p2_data_emissao", d.data_documento || d.data_emissao || "")}
  ${field("p2_referencia", d.referencia || "")}
  ${field("p2_vencimento", d.vencimento || "")}
</div>
</body>
</html>`;
}

/* ---------------------------------------------------------------- serve */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    const keys = [
      "nome", "cpf", "endereco", "bairro", "cep", "municipio", "uf", "perdas",
      "classificacao", "tipo_fornecimento",
      "nota_fiscal", "serie_nf", "data_emissao", "hora_emissao",
      "referencia", "total_pagar", "vencimento",
      "leitura_anterior", "leitura_atual", "dias", "proxima_leitura",
      "info_l1", "info_l2", "info_l3", "info_l4",
      "it_unid", "it_quant", "it_preco_unit", "it_valor", "it_pis",
      "it_base_icms", "it_aliquota", "it_icms", "it_tarifa",
      "fin1_desc", "fin1_valor", "fin2_desc", "fin2_valor",
      "fin3_desc", "fin3_valor", "fin4_desc", "fin4_valor",
      "res_aneel", "res_apresentacao",
      "unidade_consumidora", "data_documento", "numero_referencia", "especie_documento",
      "data_processamento", "nosso_numero", "carteira", "especie_moeda",
      "unidade_entrega", "sequencia", "medidor",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
      template_bg_p2: body.template_p2_base64 || "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : String(body[k] ?? "");

    const html = buildEquatorialHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Comprovante Equatorial:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
