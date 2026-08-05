// Comprovante de Residência — Neoenergia Coelba (DANFE NF3e).
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

/** Altura de uma folha A4 a 96 DPI — as páginas ficam empilhadas no editor. */
export const PAGE_H = 1123;

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultCoelbaFields
export const COELBA_DEFAULT_POSITIONS: Record<string, Pos> = {
  /* ---- cabeçalho DANFE (estático, removido pelo cliente) ---- */
  danfe_titulo: { x: 216.2, y: 2.0, fontSize: 10.4, w: 500 },
  emissor_l1: { x: 216.2, y: 25.4, fontSize: 8.6, w: 330 },
  emissor_l2: { x: 216.2, y: 36.0, fontSize: 8.6, w: 330 },
  emissor_l3: { x: 216.2, y: 47.0, fontSize: 8.6, w: 330 },

  /* ---- identificação do cliente (página 1) ---- */
  cliente_nome: { x: 24.0, y: 96.5, fontSize: 9.8, w: 300 },
  cliente_cpf: { x: 24.0, y: 109.4, fontSize: 8.3, w: 300 },
  cliente_endereco: { x: 24.0, y: 120.6, fontSize: 8.3, w: 300 },
  cliente_bairro: { x: 24.0, y: 131.6, fontSize: 8.3, w: 300 },
  cliente_cep: { x: 22.7, y: 150.2, fontSize: 8.3, w: 300 },

  /* ---- bloco da nota fiscal eletrônica ---- */
  nf_linha: { x: 515.1, y: 116.6, fontSize: 6.6, w: 265 },
  nf_consulta_label: { x: 515.1, y: 128.8, fontSize: 6.6, w: 265 },
  nf_consulta_url: { x: 515.1, y: 140.6, fontSize: 6.6, w: 265 },
  nf_chave_label: { x: 515.1, y: 151.0, fontSize: 6.6, w: 265 },
  nf_chave: { x: 515.1, y: 163.4, fontSize: 6.6, w: 265 },
  nf_protocolo: { x: 515.1, y: 172.8, fontSize: 6.6, w: 265 },

  /* ---- faixa referência / total / vencimento ---- */
  referencia_topo: { x: 21.0, y: 184.0, fontSize: 15.0, w: 92 },
  total_topo: { x: 196.0, y: 185.5, fontSize: 14.5, w: 78 },
  vencimento_topo: { x: 281.0, y: 184.0, fontSize: 15.0, w: 112 },

  /* ---- faixa "DATAS DE LEITURAS" ---- */
  lbl_datas: { x: 56.0, y: 290.4, fontSize: 8.0, w: 110 },
  lbl_leitura_anterior: { x: 180.2, y: 290.4, fontSize: 8.0, w: 90 },
  val_leitura_anterior: { x: 270, y: 287.6, fontSize: 10.3, w: 80 },
  lbl_leitura_atual: { x: 338.9, y: 290.4, fontSize: 8.0, w: 70 },
  val_leitura_atual: { x: 415, y: 287.6, fontSize: 10.3, w: 80 },
  lbl_dias: { x: 519.1, y: 290.4, fontSize: 8.0, w: 60 },
  val_dias: { x: 578, y: 287.6, fontSize: 10.3, w: 40 },
  lbl_proxima: { x: 636.5, y: 290.4, fontSize: 8.0, w: 90 },
  val_proxima: { x: 722, y: 287.6, fontSize: 10.3, w: 80 },

  /* ---- linha do medidor ---- */
  med_postos: { x: 163.0, y: 638.5, fontSize: 6.6, w: 48 },
  med_leitura_anterior: { x: 217.0, y: 638.5, fontSize: 6.6, w: 51 },
  med_leitura_atual: { x: 274.0, y: 638.5, fontSize: 6.6, w: 50 },
  med_constante: { x: 330.0, y: 638.5, fontSize: 6.6, w: 56 },
  med_consumo: { x: 392.0, y: 638.5, fontSize: 6.6, w: 57 },

  /* ---- aviso e débitos anteriores ---- */
  aviso_suspensao: { x: 22.7, y: 689.0, fontSize: 9.6, w: 560 },
  deb_h1: { x: 26.7, y: 700.2, fontSize: 9.3, w: 60 },
  deb_h2: { x: 132.1, y: 700.2, fontSize: 9.3, w: 70 },
  deb_h3: { x: 250.9, y: 700.2, fontSize: 9.3, w: 50 },
  deb_h4: { x: 329.6, y: 700.2, fontSize: 9.3, w: 60 },
  deb_h5: { x: 427.0, y: 700.2, fontSize: 9.3, w: 70 },
  deb_h6: { x: 523.1, y: 700.2, fontSize: 9.3, w: 50 },
  deb_venc1: { x: 26.7, y: 712.2, fontSize: 8.6, w: 70 },
  deb_reaviso1: { x: 134.8, y: 712.2, fontSize: 8.6, w: 70 },
  deb_valor1: { x: 246.9, y: 712.2, fontSize: 8.6, w: 60 },
  deb_venc2: { x: 329.6, y: 712.2, fontSize: 8.6, w: 70 },
  deb_reaviso2: { x: 427.0, y: 712.2, fontSize: 8.6, w: 70 },
  deb_valor2: { x: 523.1, y: 712.2, fontSize: 8.6, w: 60 },

  /* ---- rodapé (ficha do boleto) ---- */
  rodape_referencia: { x: 47.0, y: 905.0, fontSize: 19.5, w: 100 },
  rodape_vencimento: { x: 452, y: 901.4, fontSize: 14.0, w: 80 },
  rodape_total: { x: 640.0, y: 903.6, fontSize: 17.0, w: 110 },

  /* ---- página 2 ---- */
  p2_nome: { x: 24.0, y: 1642.1, fontSize: 9.8, w: 300 },
  p2_endereco: { x: 24.0, y: 1656.0, fontSize: 8.3, w: 300 },
  p2_bairro: { x: 22.7, y: 1667.0, fontSize: 8.3, w: 300 },
  p2_cep: { x: 22.7, y: 1677.6, fontSize: 8.3, w: 300 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...COELBA_DEFAULT_POSITIONS };
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
function fitTextStyle(value: string, baseSize: number, maxWidth: number, minRatio = 0.6, bold = false) {
  const len = (value || "").trim().length;
  if (!len || !maxWidth) return "";
  const charRatio = bold ? 0.58 : 0.52;
  const estimated = len * baseSize * charRatio;
  if (estimated <= maxWidth) return "";
  const fitted = maxWidth / (len * charRatio);
  const size = Math.max(fitted, baseSize * minRatio);
  return `font-size:${size.toFixed(2)}px;`;
}

/** Agrupa a chave de acesso de 44 dígitos em blocos de 4. */
function formatChave(chave: string) {
  const digits = String(chave || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/* --------------------------------------------------------------- layout */

export function buildCoelbaHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const p = resolvePositions(fieldPositions);
  const bg1 = d.template_bg || "";
  const bg2 = d.template_bg_p2 || "";

  const RIGHT = new Set([
    "med_leitura_anterior", "med_leitura_atual", "med_constante", "med_consumo",
    "total_topo", "rodape_total",
  ]);
  const BOLD = new Set([
    "danfe_titulo", "emissor_l1",
    "cliente_nome",
    "referencia_topo", "total_topo", "vencimento_topo",
    "val_leitura_anterior", "val_leitura_atual", "val_dias", "val_proxima",
    "aviso_suspensao",
    "rodape_referencia", "rodape_vencimento", "rodape_total",
  ]);
  /** Campos que devem caber em uma única linha dentro da célula do template. */
  const NOWRAP = new Set([
    "danfe_titulo", "emissor_l1", "emissor_l2", "emissor_l3",
    "cliente_nome", "cliente_cpf", "cliente_endereco", "cliente_bairro", "cliente_cep",
    "referencia_topo", "total_topo", "vencimento_topo",
    "val_leitura_anterior", "val_leitura_atual", "val_dias", "val_proxima",
    "med_postos", "med_leitura_anterior", "med_leitura_atual", "med_constante", "med_consumo",
    "aviso_suspensao",
    "rodape_referencia", "rodape_vencimento", "rodape_total",
    "p2_nome", "p2_endereco", "p2_bairro", "p2_cep",
  ]);
  const CENTER = new Set(["referencia_topo", "vencimento_topo", "med_postos"]);

  const field = (id: string, text: string, extra = "") => {
    const pos = p[id];
    if (!pos || !text) return "";
    const width = pos.w ?? 200;
    const bold = BOLD.has(id);
    const fit = fitTextStyle(text, pos.fontSize, width, 0.55, bold);
    const align = RIGHT.has(id) ? "right" : CENTER.has(id) ? "center" : "left";
    const weight = bold ? 700 : 400;
    const wrap = NOWRAP.has(id) ? "white-space:nowrap;" : "";
    const html = escapeHtml(text).replace(/\n/g, "<br/>");
    const top = pos.y >= PAGE_H ? pos.y - PAGE_H : pos.y;
    return `<div class="ov" style="top:${top}px;left:${pos.x}px;width:${width}px;font-size:${pos.fontSize}px;${fit}text-align:${align};font-weight:${weight};${wrap}${extra}">${html}</div>`;
  };

  const up = (v: string) => (v || "").toUpperCase();

  const nome = up(d.nome);
  const endereco = up(d.endereco);
  const bairro = up(d.bairro);
  const cepLinha = [d.cep, up(d.municipio), up(d.uf)].filter(Boolean).join(" ");

  const nfLinha = d.nota_fiscal
    ? `NOTA FISCAL N° ${d.nota_fiscal}- SÉRIE ${d.serie_nf || "000"} / DATA DE EMISSÃO: ${d.data_emissao || ""}`
    : "";
  const protocolo = d.protocolo
    ? `Protocolo de autorização: ${d.protocolo}${d.protocolo_data ? ` - ${d.protocolo_data}` : ""}${d.protocolo_hora ? ` às ${d.protocolo_hora}` : ""}`
    : "";

  const aviso = d.aviso_data
    ? `ATENÇÃO! APÓS ${d.aviso_data}, DÉBITOS EXISTENTES CAUSARÃO SUSPENSÃO DO FORNECIMENTO.`
    : "";
  const temDebitos = Boolean(d.deb_venc1 || d.deb_venc2);

  const head = `
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: 794px;
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; }
  .bg { position: absolute; inset: 0; z-index: 0; }
  .bg img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .ov { position: absolute; z-index: 10; color: #111; line-height: 1.2; overflow: visible; white-space: pre-line; }
</style>`;

  return `<!DOCTYPE html>
<html>
<head>${head}</head>
<body>
<div class="page">
  <div class="bg">${bg1 ? `<img src="${escapeHtml(bg1)}" />` : ""}</div>

  ${field("danfe_titulo", "DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA")}
  ${field("emissor_l1", "COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA")}
  ${field("emissor_l2", "AV.EDGARD SANTOS, 300, CABULA VI, SALVADOR, BAHIA CEP 41181-900 CNPJ")}
  ${field("emissor_l3", "15.139.629/0001-94 INSCRIÇÃO ESTADUAL 00478696")}

  ${field("cliente_nome", nome)}
  ${field("cliente_cpf", d.cpf ? `CPF: ${d.cpf}` : "")}
  ${field("cliente_endereco", endereco ? `ENDEREÇO: ${endereco}` : "")}
  ${field("cliente_bairro", bairro)}
  ${field("cliente_cep", cepLinha)}

  ${field("nf_linha", nfLinha)}
  ${field("nf_consulta_label", nfLinha ? "Consulte pela Chave de Acesso em:" : "")}
  ${field("nf_consulta_url", nfLinha ? "https://dfe-portal.svrs.rs.gov.br/Nf3e/consulta" : "")}
  ${field("nf_chave_label", d.chave_acesso ? "chave de acesso:" : "")}
  ${field("nf_chave", formatChave(d.chave_acesso))}
  ${field("nf_protocolo", protocolo)}

  ${field("referencia_topo", d.referencia || "")}
  ${field("total_topo", d.total_pagar || "")}
  ${field("vencimento_topo", d.vencimento || "")}

  ${field("lbl_datas", "DATAS DE LEITURAS")}
  ${field("lbl_leitura_anterior", "LEITURA ANTERIOR")}
  ${field("val_leitura_anterior", d.leitura_anterior || "")}
  ${field("lbl_leitura_atual", "LEITURA ATUAL")}
  ${field("val_leitura_atual", d.leitura_atual || "")}
  ${field("lbl_dias", "N° DE DIAS")}
  ${field("val_dias", d.dias || "")}
  ${field("lbl_proxima", "PRÓXIMA LEITURA")}
  ${field("val_proxima", d.proxima_leitura || "")}

  ${field("med_postos", d.med_postos || "")}
  ${field("med_leitura_anterior", d.med_leitura_anterior || "")}
  ${field("med_leitura_atual", d.med_leitura_atual || "")}
  ${field("med_constante", d.med_constante || "")}
  ${field("med_consumo", d.med_consumo || "")}

  ${field("aviso_suspensao", aviso)}
  ${temDebitos ? field("deb_h1", "Vencto") : ""}
  ${temDebitos ? field("deb_h2", "Dt reaviso") : ""}
  ${temDebitos ? field("deb_h3", "Valor") : ""}
  ${temDebitos ? field("deb_h4", "Vencto") : ""}
  ${temDebitos ? field("deb_h5", "Dt reaviso") : ""}
  ${temDebitos ? field("deb_h6", "Valor") : ""}
  ${field("deb_venc1", d.deb_venc1 || "")}
  ${field("deb_reaviso1", d.deb_reaviso1 || "")}
  ${field("deb_valor1", d.deb_valor1 || "")}
  ${field("deb_venc2", d.deb_venc2 || "")}
  ${field("deb_reaviso2", d.deb_reaviso2 || "")}
  ${field("deb_valor2", d.deb_valor2 || "")}

  ${field("rodape_referencia", d.referencia || "")}
  ${field("rodape_vencimento", d.vencimento_rodape || d.vencimento || "")}
  ${field("rodape_total", d.total_pagar || "")}
</div>

<div class="page">
  <div class="bg">${bg2 ? `<img src="${escapeHtml(bg2)}" />` : ""}</div>
  ${field("p2_nome", nome)}
  ${field("p2_endereco", endereco)}
  ${field("p2_bairro", bairro)}
  ${field("p2_cep", cepLinha)}
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
      "nota_fiscal", "serie_nf", "data_emissao", "chave_acesso",
      "protocolo", "protocolo_data", "protocolo_hora",
      "referencia", "total_pagar", "vencimento", "vencimento_rodape",
      "leitura_anterior", "leitura_atual", "dias", "proxima_leitura",
      "med_postos", "med_leitura_anterior", "med_leitura_atual", "med_constante", "med_consumo",
      "aviso_data",
      "deb_venc1", "deb_reaviso1", "deb_valor1", "deb_venc2", "deb_reaviso2", "deb_valor2",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
      template_bg_p2: body.template_p2_base64 || "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : String(body[k] ?? "");

    const html = buildCoelbaHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Comprovante Coelba:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
