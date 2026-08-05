import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import {
  qrSvg,
  gerarToken,
  gerarCodigoAcesso,
  linkValidacao,
  registerReceita,
  attachPdf,
} from "./validacao.ts";

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

/* ------------------------------------------------------------- posições */

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultReceitaFields
export const RECEITA_DEFAULT_POSITIONS: Record<string, Pos> = {
  unidade_cidade: { x: 45, y: 76.5, fontSize: 9.5, w: 170 },
  lbl_paciente: { x: 35.5, y: 112, fontSize: 9.5 },
  paciente: { x: 35.5, y: 126, fontSize: 15.3, w: 470 },
  lbl_cpf: { x: 35.5, y: 158.5, fontSize: 9.5 },
  cpf: { x: 35.5, y: 173, fontSize: 9.5 },
  lbl_nascimento: { x: 225, y: 158.5, fontSize: 9.5 },
  nascimento: { x: 225, y: 173, fontSize: 9.5 },
  lbl_emissao: { x: 386, y: 158.5, fontSize: 9.5 },
  emissao: { x: 386, y: 173, fontSize: 9.5 },
  lbl_endereco: { x: 35.5, y: 198.5, fontSize: 9.5 },
  endereco: { x: 35.5, y: 213, fontSize: 9.5, w: 470 },
  qr: { x: 530, y: 161, fontSize: 8, w: 88, h: 88 },
  lbl_token: { x: 631, y: 174, fontSize: 8.3 },
  token: { x: 631, y: 188, fontSize: 8.8 },
  lbl_codigo: { x: 631, y: 211, fontSize: 8.3 },
  codigo: { x: 631, y: 225, fontSize: 8.8 },
  medicamentos: { x: 35.5, y: 305, fontSize: 11.5, w: 722 },
  medico: { x: 97, y: 1024, fontSize: 10.5, w: 600 },
  endereco_clinica: { x: 47, y: 1049, fontSize: 9.6, w: 700 },
  telefone: { x: 47, y: 1061, fontSize: 9.6, w: 700 },
  farmaceutico: { x: 47, y: 1075, fontSize: 9, w: 700 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...RECEITA_DEFAULT_POSITIONS };
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

/* ------------------------------------------------------------ auto-fit */

/**
 * Reduz o tamanho da fonte quando o texto é longo demais para a caixa,
 * garantindo que nomes completos nunca sejam cortados com reticências.
 */
function fitTextStyle(text: string, boxWidth: number, fontSize: number, factor = 0.52) {
  const len = (text || "").length;
  if (!len || !boxWidth) return `font-size:${fontSize}px;`;
  const max = boxWidth / (fontSize * factor);
  const size = len > max ? Math.max(fontSize * (max / len), fontSize * 0.55) : fontSize;
  return `font-size:${size.toFixed(2)}px;`;
}

/* ---------------------------------------------------------- medicamentos */

export interface Medicamento {
  nome: string;
  posologia: string;
  quantidade: string;
  farmaciaPopular?: boolean;
}

function parseMedicamentos(raw: unknown): Medicamento[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      return {
        nome: typeof o.nome === "string" ? o.nome : "",
        posologia: typeof o.posologia === "string" ? o.posologia : "",
        quantidade: typeof o.quantidade === "string" ? o.quantidade : "",
        farmaciaPopular: Boolean(o.farmaciaPopular),
      };
    })
    .filter((m) => m.nome.trim().length > 0);
}

function medicamentosHtml(meds: Medicamento[], width: number, fontSize: number): string {
  return meds
    .map((m) => {
      const badge = m.farmaciaPopular
        ? `<div class="fp">Farmácia Popular</div>`
        : "";
      return `<div class="med">
  <div class="med-head">
    <span class="med-nome" style="${fitTextStyle(m.nome, width - 110, fontSize)}">${escapeHtml(m.nome)}</span>
    <span class="med-qtd">${escapeHtml(m.quantidade)}</span>
  </div>
  ${m.posologia ? `<div class="med-pos">${escapeHtml(m.posologia)}</div>` : ""}
  ${badge}
</div>`;
    })
    .join("");
}

/* --------------------------------------------------------------- layout */

export function buildReceitaHtml(
  d: Record<string, string>,
  medicamentos: Medicamento[],
  fieldPositions?: unknown,
  qrValue?: string,
) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const block = (id: string, html: string, extra = "") => {
    const pos = p[id];
    if (!pos || !html) return "";
    const width = pos.w ? `width:${pos.w}px;` : "";
    return `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;${width}font-size:${pos.fontSize}px;${extra}">${html}</div>`;
  };

  const label = (id: string, text: string) => block(id, escapeHtml(text), "font-weight:bold;");

  const pm = p.medicamentos;
  const medsWidth = pm.w ?? 722;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: 794px;
    margin: 0;
    padding: 0;
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; }
  .bg-template { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
  .bg-template img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .overlay { position: absolute; z-index: 10; color: #111; line-height: 1.2; white-space: normal; overflow: visible; }
  .cidade { color: #fff; font-weight: bold; text-align: center; z-index: 14; }
  .qr-overlay { background: #fff; z-index: 12; overflow: hidden; }
  .qr-overlay svg { width: 100%; height: 100%; display: block; }
  .med { margin-bottom: 12px; }
  .med-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
  .med-nome { font-weight: bold; }
  .med-qtd { font-weight: bold; white-space: nowrap; }
  .med-pos { margin-top: 6px; font-weight: normal; }
  .fp {
    display: inline-block;
    margin-top: 7px;
    padding: 3px 9px 4px;
    border-radius: 10px;
    background: #fde3e3;
    color: #c0392b;
    font-weight: normal;
  }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  ${block("unidade_cidade", escapeHtml(d.cidade_unidade || ""), "text-align:center;color:#fff;font-weight:bold;z-index:14;")}

  ${label("lbl_paciente", "Paciente:")}
  ${block("paciente", escapeHtml(d.paciente || ""), `font-weight:bold;white-space:nowrap;${fitTextStyle(d.paciente || "", p.paciente.w ?? 470, p.paciente.fontSize)}`)}

  ${label("lbl_cpf", "CPF do Paciente:")}
  ${block("cpf", escapeHtml(d.cpf || ""))}
  ${label("lbl_nascimento", "Nascimento:")}
  ${block("nascimento", escapeHtml(d.nascimento || ""))}
  ${label("lbl_emissao", "Emissão:")}
  ${block("emissao", escapeHtml(d.emissao || ""))}

  ${label("lbl_endereco", "Endereço:")}
  ${block("endereco", escapeHtml(d.endereco || ""), `white-space:nowrap;${fitTextStyle(d.endereco || "", p.endereco.w ?? 470, p.endereco.fontSize)}`)}

  ${qrValue ? `<div class="overlay qr-overlay" style="top:${p.qr.y}px;left:${p.qr.x}px;width:${p.qr.w ?? 88}px;height:${p.qr.h ?? 88}px;">${qrSvg(qrValue, p.qr.w ?? 88)}</div>` : ""}

  ${label("lbl_token", "Token da receita:")}
  ${block("token", escapeHtml(d.token || ""), "font-weight:bold;")}
  ${label("lbl_codigo", "Código de acesso:")}
  ${block("codigo", escapeHtml(d.codigo_acesso || ""), "font-weight:bold;")}

  <div class="overlay" style="top:${pm.y}px;left:${pm.x}px;width:${medsWidth}px;font-size:${pm.fontSize}px;">
    ${medicamentosHtml(medicamentos, medsWidth, pm.fontSize)}
  </div>

  ${block("medico", `${escapeHtml(d.medico || "")}${d.crm ? `&nbsp;&nbsp;|&nbsp;&nbsp;${escapeHtml(d.crm)}` : ""}`, "text-align:center;font-weight:bold;")}
  ${block("endereco_clinica", escapeHtml(d.endereco_clinica || ""), "text-align:center;")}
  ${block("telefone", `Telefone: ${escapeHtml(d.telefone || "")}`, "text-align:center;")}
  ${block(
    "farmaceutico",
    `<b>Farmacêutico</b>, valide a receita digital em <span style="text-decoration:underline;">${escapeHtml(d.link_farmacia || "https://farmacias.mevosaude.com.br")}</span>`,
    "text-align:center;",
  )}
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

    // Anexa ao registro de validação o PDF gerado no navegador.
    if (body?.attach_pdf && body?.token) {
      const raw = String(body.attach_pdf).split(",").pop() || "";
      const bin = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const url = await attachPdf(String(body.token), bin);
      return new Response(
        JSON.stringify({ success: true, pdf_url: url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keys = [
      "cidade_unidade", "paciente", "cpf", "nascimento", "emissao", "endereco",
      "medico", "crm", "endereco_clinica", "telefone", "link_farmacia",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const isPreview = body.preview === true;
    let token = typeof body.token === "string" && body.token ? body.token : gerarToken();
    let codigo = typeof body.codigo_acesso === "string" && body.codigo_acesso
      ? body.codigo_acesso
      : gerarCodigoAcesso();

    const medicamentos = parseMedicamentos(body.medicamentos);

    // Só grava no validador na geração final (preview não consome token).
    if (!isPreview) {
      let rawMeds: unknown = body.medicamentos;
      if (typeof rawMeds === "string") {
        try { rawMeds = JSON.parse(rawMeds); } catch { rawMeds = []; }
      }
      const reg = await registerReceita(
        data,
        Array.isArray(rawMeds) ? rawMeds : [],
        { token, codigo_acesso: codigo },
      );
      token = reg.token;
      codigo = reg.codigo_acesso;
      if (!reg.registered) console.error("Receita não registrada no validador:", reg.error);
    }

    data.token = token;
    data.codigo_acesso = codigo;

    const qrValue = linkValidacao(token, codigo);

    const html = buildReceitaHtml(data, medicamentos, body.field_positions, qrValue);


    return new Response(
      JSON.stringify({
        success: true,
        render: "browser",
        html,
        token,
        codigo_acesso: codigo,
        qr_code_url: isPreview ? undefined : qrValue,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Receita Médica:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
