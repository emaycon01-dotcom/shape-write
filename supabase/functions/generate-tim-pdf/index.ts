// Comprovante de Residência — Fatura TIM S.A.
// O template já contém TODO o conteúdo original preservado pelo cliente
// (débito automático, "Mais detalhes da sua conta", impostos, autenticação
// mecânica, código de barras e rodapé). Aqui apenas recriamos os campos
// que foram removidos do documento.
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

/** Dimensões reais da página desta fatura (A4 em pontos). */
export const PAGE_W = 595;
export const PAGE_H = 842;

/** Linhas da tabela de mensalidades (topo de cada linha, em pt). */
export const TIM_ROW_YS = [353.85, 363.6, 373.5, 383.3, 393.2, 403.0, 412.8, 422.7];

/** Colunas da tabela — x / largura / alinhamento. */
export const TIM_COLS: Array<{ key: string; x: number; w: number }> = [
  { key: "desc", x: 52.2, w: 180 },
  { key: "fran", x: 214.0, w: 80 },
  { key: "cons", x: 264.0, w: 80 },
  { key: "qtd", x: 316.0, w: 80 },
  { key: "dias", x: 369.0, w: 80 },
  { key: "per", x: 419.0, w: 100 },
  { key: "val", x: 460.0, w: 90 },
];

function buildDefaults(): Record<string, Pos> {
  const base: Record<string, Pos> = {
    /* ---- cabeçalho da empresa (topo esquerdo) ---- */
    pagina: { x: 500.9, y: 20.1, fontSize: 8.0, w: 60 },
    emp_l1: { x: 45.1, y: 28.6, fontSize: 6.0, w: 200 },
    emp_l2: { x: 45.1, y: 35.9, fontSize: 6.0, w: 200 },
    emp_l3: { x: 45.1, y: 43.3, fontSize: 6.0, w: 200 },
    emp_l4: { x: 45.1, y: 50.7, fontSize: 6.0, w: 220 },
    emp_l5: { x: 45.1, y: 58.1, fontSize: 6.0, w: 220 },

    /* ---- bloco de valor / vencimento (topo direito) ---- */
    valor_topo: { x: 459.1, y: 37.1, fontSize: 20.0, w: 90 },
    venc_titulo: { x: 449.0, y: 62.4, fontSize: 14.0, w: 100 },
    venc_data: { x: 449.0, y: 78.3, fontSize: 14.0, w: 100 },
    emissao: { x: 399.0, y: 97.1, fontSize: 10.0, w: 150 },
    postagem: { x: 399.0, y: 110.6, fontSize: 10.0, w: 150 },
    fatura: { x: 399.0, y: 124.1, fontSize: 10.0, w: 150 },
    cliente_num: { x: 393.0, y: 143.8, fontSize: 8.0, w: 150 },
    cpf_topo: { x: 393.0, y: 164.8, fontSize: 8.0, w: 150 },
    acesso_topo: { x: 393.0, y: 185.5, fontSize: 8.0, w: 150 },

    /* ---- destinatário (janela do envelope) ---- */
    dest_nome: { x: 99.8, y: 145.4, fontSize: 8.0, w: 250 },
    dest_endereco: { x: 99.8, y: 155.1, fontSize: 8.0, w: 250 },
    dest_bairro: { x: 99.8, y: 164.9, fontSize: 8.0, w: 250 },
    dest_cep: { x: 99.8, y: 174.8, fontSize: 8.0, w: 250 },

    /* ---- resumo ---- */
    importante: { x: 91.4, y: 253.1, fontSize: 10.0, w: 240 },
    resumo_periodo: { x: 335.7, y: 253.3, fontSize: 9.0, w: 214 },
    res_h_serv: { x: 333.7, y: 275.7, fontSize: 8.0, w: 150 },
    res_h_valor: { x: 498.0, y: 275.7, fontSize: 8.0, w: 51 },
    res_plano: { x: 333.7, y: 295.5, fontSize: 8.0, w: 180 },
    res_valor: { x: 468.0, y: 295.5, fontSize: 8.0, w: 81 },

    /* ---- tabela de mensalidades ---- */
    veja_abaixo: { x: 45.1, y: 321.0, fontSize: 9.0, w: 400 },
    mensalidades: { x: 45.1, y: 331.9, fontSize: 9.0, w: 200 },
    vantagens: { x: 45.1, y: 343.7, fontSize: 7.0, w: 190 },
    h_franquia: { x: 214.0, y: 344.0, fontSize: 8.0, w: 80 },
    h_consumo: { x: 264.0, y: 344.0, fontSize: 8.0, w: 80 },
    h_qtd: { x: 316.0, y: 344.0, fontSize: 8.0, w: 80 },
    h_dias: { x: 369.0, y: 344.0, fontSize: 8.0, w: 80 },
    h_periodo: { x: 419.0, y: 344.0, fontSize: 8.0, w: 100 },
    h_valor: { x: 460.0, y: 344.0, fontSize: 8.0, w: 90 },
    total_label: { x: 380.0, y: 432.7, fontSize: 8.0, w: 125 },
    total_valor: { x: 460.0, y: 432.7, fontSize: 8.0, w: 90 },

    /* ---- ficha de pagamento (rodapé) ---- */
    stub_referencia: { x: 250.9, y: 734.5, fontSize: 8.0, w: 80 },
    stub_emissao: { x: 330.6, y: 734.5, fontSize: 8.0, w: 80 },
    stub_vencimento: { x: 416.2, y: 734.7, fontSize: 8.0, w: 80 },
    stub_valor: { x: 453.0, y: 734.7, fontSize: 8.0, w: 80 },
  };

  TIM_ROW_YS.forEach((y, i) => {
    const n = i + 1;
    for (const col of TIM_COLS) {
      base[`l${n}_${col.key}`] = {
        x: n === 1 && col.key === "desc" ? 45.1 : col.x,
        y,
        fontSize: 8.0,
        w: n === 1 && col.key === "desc" ? 190 : col.w,
      };
    }
  });

  return base;
}

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultTimFields
export const TIM_DEFAULT_POSITIONS: Record<string, Pos> = buildDefaults();

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...TIM_DEFAULT_POSITIONS };
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

export function buildTimHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const p = resolvePositions(fieldPositions);
  const bg1 = d.template_bg || "";

  const RIGHT = new Set([
    "valor_topo", "venc_titulo", "venc_data", "emissao", "postagem", "fatura",
    "cliente_num", "cpf_topo", "acesso_topo",
    "res_h_valor", "res_valor", "h_valor", "total_label", "total_valor", "stub_valor",
  ]);
  const CENTER = new Set(["h_franquia", "h_consumo", "h_qtd", "h_dias", "h_periodo"]);
  const BOLD = new Set([
    "valor_topo", "venc_titulo", "dest_nome", "importante", "res_plano", "res_valor",
    "veja_abaixo", "total_label", "total_valor", "stub_vencimento", "stub_valor",
  ]);

  for (let i = 1; i <= TIM_ROW_YS.length; i++) {
    RIGHT.add(`l${i}_val`);
    CENTER.add(`l${i}_fran`);
    CENTER.add(`l${i}_cons`);
    CENTER.add(`l${i}_qtd`);
    CENTER.add(`l${i}_dias`);
    CENTER.add(`l${i}_per`);
  }
  // A primeira linha (plano contratado) e o valor cheio são em negrito.
  BOLD.add("l1_desc");
  BOLD.add("l1_val");

  const field = (id: string, text: string, extra = "") => {
    const pos = p[id];
    if (!pos || !text) return "";
    const width = pos.w ?? 200;
    const fit = fitTextStyle(text, pos.fontSize, width);
    const align = RIGHT.has(id) ? "right" : CENTER.has(id) ? "center" : "left";
    const weight = BOLD.has(id) ? 700 : 400;
    const html = escapeHtml(text).replace(/\n/g, "<br/>");
    return `<div class="ov" style="top:${pos.y}px;left:${pos.x}px;width:${width}px;font-size:${pos.fontSize}px;${fit}text-align:${align};font-weight:${weight};${extra}">${html}</div>`;
  };

  const up = (v: string) => (v || "").toUpperCase();

  const nome = up(d.nome);
  const primeiroNome = nome.split(/\s+/)[0] || "";
  const cepLinha = [d.cep, "-", up(d.municipio), "-", up(d.uf)].filter(Boolean).join(" ");
  const valorFmt = d.total ? `R$ ${d.total}` : "";

  const rows: string[] = [];
  for (let i = 1; i <= TIM_ROW_YS.length; i++) {
    rows.push(field(`l${i}_desc`, d[`l${i}_desc`] || ""));
    rows.push(field(`l${i}_fran`, d[`l${i}_fran`] || ""));
    rows.push(field(`l${i}_cons`, d[`l${i}_cons`] || ""));
    rows.push(field(`l${i}_qtd`, d[`l${i}_qtd`] || ""));
    rows.push(field(`l${i}_dias`, d[`l${i}_dias`] || ""));
    rows.push(field(`l${i}_per`, d[`l${i}_per`] || ""));
    rows.push(field(`l${i}_val`, d[`l${i}_val`] || ""));
  }

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
  .ov { position: absolute; z-index: 10; color: #111; line-height: 1.15; overflow: visible; white-space: nowrap; }
</style>`;

  return `<!DOCTYPE html>
<html>
<head>${head}</head>
<body>
<div class="page">
  <div class="bg">${bg1 ? `<img src="${escapeHtml(bg1)}" />` : ""}</div>

  ${field("pagina", d.pagina || "Página 1 de 2")}
  ${field("emp_l1", d.emp_l1 || "TIM S.A.")}
  ${field("emp_l2", d.emp_l2 || "Av.Mato Grosso,4808")}
  ${field("emp_l3", d.emp_l3 || "Caranda Bosque-Campo Grande - MS")}
  ${field("emp_l4", d.emp_l4 || "CNPJ: 02.421.421/0018-60 - I.E.: 28.311.690-0")}
  ${field("emp_l5", d.emp_l5 || "CNPJ da Matriz: 02.421.421/0001-11")}

  ${field("valor_topo", valorFmt)}
  ${field("venc_titulo", "VENCIMENTO")}
  ${field("venc_data", d.vencimento || "")}
  ${field("emissao", d.data_emissao ? `EMISSÃO: ${d.data_emissao}` : "")}
  ${field("postagem", d.data_postagem ? `POSTAGEM: ${d.data_postagem}` : "")}
  ${field("fatura", d.num_fatura ? `FATURA: ${d.num_fatura}` : "")}
  ${field("cliente_num", d.cliente ? `CLIENTE: ${d.cliente}` : "")}
  ${field("cpf_topo", d.cpf ? `CPF/CNPJ: ${d.cpf}` : "")}
  ${field("acesso_topo", d.acesso ? `ACESSO: ${d.acesso}` : "")}

  ${field("dest_nome", nome)}
  ${field("dest_endereco", up(d.endereco))}
  ${field("dest_bairro", up(d.bairro))}
  ${field("dest_cep", up(cepLinha))}

  ${field("importante", primeiroNome ? `IMPORTANTE PARA ${primeiroNome}` : "")}
  ${field("resumo_periodo", d.periodo_conta ? `RESUMO DA SUA CONTA DE ${d.periodo_conta}` : "", "color:#fff;")}
  ${field("res_h_serv", "Serviços TIM S.A.")}
  ${field("res_h_valor", "VALOR")}
  ${field("res_plano", d.plano || "")}
  ${field("res_valor", valorFmt)}

  ${field("veja_abaixo", d.acesso ? `VEJA ABAIXO O RESUMO DA SUA CONTA PARA O NÚMERO: ${d.acesso}` : "")}
  ${field("mensalidades", "MENSALIDADES")}
  ${field("vantagens", "Vantagens que seu plano oferece")}
  ${field("h_franquia", "FRANQUIA")}
  ${field("h_consumo", "CONSUMO")}
  ${field("h_qtd", "QUANTIDADE")}
  ${field("h_dias", "N° DIAS")}
  ${field("h_periodo", "PERIODO")}
  ${field("h_valor", "VALOR")}

  ${rows.join("\n  ")}

  ${field("total_label", "Total de Mensalidades")}
  ${field("total_valor", d.total || "")}

  ${field("stub_referencia", d.referencia || "")}
  ${field("stub_emissao", d.data_emissao || "")}
  ${field("stub_vencimento", d.vencimento || "")}
  ${field("stub_valor", valorFmt)}
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
      "nome", "cpf", "endereco", "bairro", "cep", "municipio", "uf",
      "cliente", "acesso", "num_fatura",
      "data_emissao", "data_postagem", "vencimento", "referencia",
      "periodo_conta", "plano", "total",
      "pagina", "emp_l1", "emp_l2", "emp_l3", "emp_l4", "emp_l5",
    ];
    for (let i = 1; i <= TIM_ROW_YS.length; i++) {
      keys.push(`l${i}_desc`, `l${i}_fran`, `l${i}_cons`, `l${i}_qtd`, `l${i}_dias`, `l${i}_per`, `l${i}_val`);
    }

    const data: Record<string, string> = { template_bg: body.template_base64 || "" };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : String(body[k] ?? "");

    const html = buildTimHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Comprovante TIM:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
