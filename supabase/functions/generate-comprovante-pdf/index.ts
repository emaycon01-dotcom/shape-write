import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { qrSvg, itfBarcodeSvg } from "./validacao.ts";

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

/** Altura de uma folha A4 a 96 DPI — as páginas ficam empilhadas no editor. */
export const PAGE_H = 1123;

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultComprovanteFields
export const COMPROVANTE_DEFAULT_POSITIONS: Record<string, Pos> = {
  /* --- cabeçalho / identificação (página 1) --- */
  controle_topo: { x: 556, y: 35, fontSize: 9.6, w: 126 },
  classificacao: { x: 59.3, y: 111.6, fontSize: 7.4, w: 165 },
  fornecimento: { x: 293, y: 111.6, fontSize: 7.4, w: 45 },

  leitura_anterior: { x: 377, y: 114.6, fontSize: 7.4, w: 82 },
  leitura_atual: { x: 459, y: 114.6, fontSize: 7.4, w: 65 },
  dias_leitura: { x: 524, y: 114.6, fontSize: 7.4, w: 59 },
  proxima_leitura: { x: 583, y: 114.6, fontSize: 7.4, w: 80 },

  cliente_nome: { x: 59.3, y: 131, fontSize: 9.6, w: 285 },
  cliente_endereco: { x: 59.3, y: 144, fontSize: 8.4, w: 285 },
  cliente_documento: { x: 59.3, y: 186, fontSize: 8.4, w: 285 },

  instalacao: { x: 266, y: 158.4, fontSize: 12.6, w: 96 },
  cliente_numero: { x: 266, y: 195.4, fontSize: 12.6, w: 96 },

  chave_nf: { x: 374.3, y: 163.4, fontSize: 9.6, w: 224 },
  nota_fiscal_serie: { x: 374.3, y: 174.4, fontSize: 9.6, w: 224 },

  mes_ano: { x: 57, y: 229, fontSize: 9.6, w: 66 },
  vencimento: { x: 139, y: 229, fontSize: 9.6, w: 93 },
  total_pagar: { x: 234, y: 229, fontSize: 9.6, w: 131 },

  mensagens: { x: 57.1, y: 270, fontSize: 7.4, w: 625 },

  /* --- blocos calculados --- */
  faturamento: { x: 59.3, y: 444.5, fontSize: 7.4, w: 405 },
  tributos: { x: 466.9, y: 431.8, fontSize: 7.4, w: 130 },
  consumo_historico: { x: 600.2, y: 440.4, fontSize: 7.4, w: 140 },
  medicao: { x: 59.1, y: 761.6, fontSize: 7.4, w: 275 },

  debito_codigo: { x: 624.2, y: 883.7, fontSize: 9.2, w: 90 },

  /* --- ficha de compensação (rodapé) --- */
  linha_digitavel: { x: 65.9, y: 972.5, fontSize: 12.4, w: 300 },
  pagador: { x: 125, y: 987, fontSize: 9.2, w: 350 },
  data_emissao: { x: 65.9, y: 1027.7, fontSize: 12.4, w: 120 },
  nota_fiscal_rodape: { x: 188.3, y: 1027.7, fontSize: 12.4, w: 120 },
  referencia: { x: 313.4, y: 1027.7, fontSize: 12.4, w: 120 },
  vencimento_rodape: { x: 442.5, y: 1027.7, fontSize: 12.4, w: 118 },
  valor_documento: { x: 563.5, y: 1027.7, fontSize: 12.4, w: 118 },
  controle_rodape: { x: 64.5, y: 1051, fontSize: 12.4, w: 130 },

  barcode: { x: 215, y: 1076, fontSize: 7.4, w: 385, h: 38 },
  qrcode: { x: 664, y: 951, fontSize: 7.4, w: 104, h: 104 },

  /* --- página 2 --- */
  controle_p2: { x: 550, y: 1123.6, fontSize: 9.6, w: 126 },
  unidade_entrega: { x: 59.6, y: 1604, fontSize: 8.4, w: 70 },
  sequencia: { x: 136.1, y: 1604, fontSize: 8.4, w: 50 },
  medidor_p2: { x: 190.2, y: 1604, fontSize: 8.4, w: 70 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...COMPROVANTE_DEFAULT_POSITIONS };
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
function fitTextStyle(value: string, baseSize: number, maxWidth: number, minRatio = 0.62) {
  const len = (value || "").trim().length;
  if (!len || !maxWidth) return "";
  const charRatio = 0.52;
  const estimated = len * baseSize * charRatio;
  if (estimated <= maxWidth) return "";
  const fitted = maxWidth / (len * charRatio);
  const size = Math.max(fitted, baseSize * minRatio);
  return `font-size:${size.toFixed(2)}px;`;
}

/* ------------------------------------------------------------- números */

const MESES_ABR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function brl(n: number, casas = 2) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseNum(v: string, fallback: number) {
  const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n !== 0 ? n : fallback;
}

/** "03/2024" -> { mes: 3, ano: 2024 } */
function parseRef(ref: string) {
  const m = /^(\d{1,2})\/(\d{4})$/.exec((ref || "").trim());
  if (!m) return { mes: 1, ano: new Date().getFullYear() };
  return { mes: Number(m[1]), ano: Number(m[2]) };
}

/** Histórico determinístico de 13 meses girando em torno do consumo atual. */
function historicoConsumo(consumo: number, ref: string, dias: number, seed: string) {
  const { mes, ano } = parseRef(ref);
  let h = 2166136261;
  for (const ch of seed || "0") h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;

  const linhas: { rotulo: string; kwh: number; dias: number }[] = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    const rotulo = `${MESES_ABR[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
    if (i === 0) {
      linhas.push({ rotulo, kwh: consumo, dias });
      continue;
    }
    h = Math.imul(h ^ (i * 2654435761), 16777619) >>> 0;
    const variacao = ((h % 31) - 15) / 100; // -15% .. +15%
    const diasMes = 28 + ((h >>> 8) % 6);
    linhas.push({ rotulo, kwh: Math.max(1, Math.round(consumo * (1 + variacao))), dias: diasMes });
  }
  return linhas;
}

/* --------------------------------------------------------------- layout */

export function buildComprovanteHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const p = resolvePositions(fieldPositions);
  const bg1 = d.template_bg || "";
  const bg2 = d.template_bg_p2 || "";

  const CENTER = new Set([
    "leitura_anterior", "leitura_atual", "dias_leitura", "proxima_leitura",
    "instalacao", "cliente_numero", "mes_ano", "vencimento", "total_pagar",
  ]);
  const RIGHT = new Set(["controle_topo", "controle_p2"]);
  const BOLD = new Set([
    "cliente_nome", "instalacao", "cliente_numero", "chave_nf", "nota_fiscal_serie",
    "mes_ano", "vencimento", "total_pagar", "linha_digitavel",
    "data_emissao", "nota_fiscal_rodape", "referencia", "vencimento_rodape",
    "valor_documento", "controle_rodape",
  ]);
  const WRAP = new Set(["mensagens", "cliente_endereco"]);

  const field = (id: string, text: string, extra = "") => {
    const pos = p[id];
    if (!pos || !text) return "";
    const width = pos.w ?? 200;
    const fit = WRAP.has(id) ? "" : fitTextStyle(text, pos.fontSize, width);
    const align = CENTER.has(id) ? "center" : RIGHT.has(id) ? "right" : "left";
    const weight = BOLD.has(id) ? 700 : 400;
    const html = escapeHtml(text).replace(/\n/g, "<br/>");
    const top = pos.y >= PAGE_H ? pos.y - PAGE_H : pos.y;
    return `<div class="ov" style="top:${top}px;left:${pos.x}px;width:${width}px;font-size:${pos.fontSize}px;${fit}text-align:${align};font-weight:${weight};${extra}">${html}</div>`;
  };

  /** Bloco livre (tabelas calculadas) ancorado numa posição do editor. */
  const block = (id: string, inner: string) => {
    const pos = p[id];
    if (!pos) return "";
    const top = pos.y >= PAGE_H ? pos.y - PAGE_H : pos.y;
    return `<div class="ov" style="top:${top}px;left:${pos.x}px;width:${pos.w ?? 200}px;font-size:${pos.fontSize}px;">${inner}</div>`;
  };

  /** Célula posicionada relativamente ao bloco (dx a partir da origem). */
  const cell = (dx: number, dy: number, w: number, text: string, align: "left" | "right" | "center" = "left", bold = false) =>
    `<span style="position:absolute;left:${dx}px;top:${dy}px;width:${w}px;text-align:${align};${bold ? "font-weight:700;" : ""}white-space:nowrap">${escapeHtml(text)}</span>`;

  /* ---------------------------------------------------- cálculo da conta */

  const consumo = Math.max(1, Math.round(parseNum(d.consumo_kwh, 158)));
  const dias = Math.max(1, Math.round(parseNum(d.dias, 30)));
  const tarifaTusd = parseNum(d.tarifa_tusd, 0.43949);
  const tarifaTe = parseNum(d.tarifa_te, 0.33816);
  const aliqIcms = parseNum(d.aliquota_icms, 12);
  const cosip = r2(parseNum(d.cosip, 5.63));

  const valTusd = r2(consumo * tarifaTusd);
  const valTe = r2(consumo * tarifaTe);
  const subFat = r2(valTusd + valTe);
  const subOutros = cosip;
  const totalConta = r2(subFat + subOutros);

  const basePc = r2(subFat * 0.88);
  const valPis = r2(basePc * 0.0086);
  const valCofins = r2(basePc * 0.0395);
  const valIcms = r2(subFat * (aliqIcms / 100));
  const pcTusd = r2(valTusd * 0.0455);
  const pcTe = r2(valTe * 0.0455);
  const icmsTusd = r2(valTusd * (aliqIcms / 100));
  const icmsTe = r2(valTe * (aliqIcms / 100));

  const total = d.total_pagar?.trim() ? d.total_pagar.trim() : brl(totalConta);

  /* --------------------------------------------- descrição do faturamento */

  const linhas = [
    { desc: "USO SIST. DISTR. (TUSD)", unid: "KWH", quant: brl(consumo, 3), preco: tarifaTusd.toFixed(5).replace(".", ","), valor: brl(valTusd), pc: brl(pcTusd), base: brl(valTusd), aliq: `${Math.round(aliqIcms)}%`, icms: brl(icmsTusd), tarifa: (valTusd / consumo * 0.8347).toFixed(5).replace(".", ",") },
    { desc: "ENERGIA (TE)", unid: "KWH", quant: brl(consumo, 3), preco: tarifaTe.toFixed(5).replace(".", ","), valor: brl(valTe), pc: brl(pcTe), base: brl(valTe), aliq: `${Math.round(aliqIcms)}%`, icms: brl(icmsTe), tarifa: (valTe / consumo * 0.8347).toFixed(5).replace(".", ",") },
    { desc: `COSIP - ${(d.municipio || "SÃO PAULO").toUpperCase()} - MUNICIPAL`, unid: "", quant: "", preco: "", valor: brl(cosip), pc: "0,00", base: "0,00", aliq: "0%", icms: "0,00", tarifa: "" },
  ];

  const COL = { desc: 0, unid: 144.5, quant: 144, preco: 185.6, valor: 215.6, pc: 248.3, base: 278.6, aliq: 298.1, icms: 330, tarifa: 355.4 };
  const CW = 45;

  let faturamento = "";
  linhas.forEach((l, i) => {
    const dy = i * 7.6;
    faturamento += cell(COL.desc, dy, 140, l.desc);
    if (l.unid) faturamento += cell(COL.unid, dy, 20, l.unid);
    if (l.quant) faturamento += cell(COL.quant, dy, CW, l.quant, "right");
    if (l.preco) faturamento += cell(COL.preco, dy, CW, l.preco, "right");
    faturamento += cell(COL.valor, dy, CW, l.valor, "right");
    faturamento += cell(COL.pc, dy, CW, l.pc, "right");
    faturamento += cell(COL.base, dy, CW, l.base, "right");
    faturamento += cell(COL.aliq, dy, 18, l.aliq, "right");
    faturamento += cell(COL.icms, dy, CW, l.icms, "right");
    if (l.tarifa) faturamento += cell(COL.tarifa, dy, CW, l.tarifa, "right");
  });

  const ySubFat = 61.7;
  const ySubOut = 69.3;
  const yTotal = 84.4;
  faturamento += cell(COL.desc, ySubFat, 140, "Subtotal Faturamento");
  faturamento += cell(COL.valor, ySubFat, CW, brl(subFat), "right");
  faturamento += cell(COL.pc, ySubFat, CW, "0,00", "right");
  faturamento += cell(COL.base, ySubFat, CW, "0,00", "right");
  faturamento += cell(COL.icms, ySubFat, CW, "0,00", "right");
  faturamento += cell(COL.desc, ySubOut, 140, "Subtotal Outros");
  faturamento += cell(COL.valor, ySubOut, CW, brl(subOutros), "right");
  faturamento += cell(COL.pc, ySubOut, CW, "0,00", "right");
  faturamento += cell(COL.base, ySubOut, CW, "0,00", "right");
  faturamento += cell(COL.icms, ySubOut, CW, "0,00", "right");
  faturamento += cell(COL.desc, yTotal, 140, "TOTAL");
  faturamento += cell(COL.valor, yTotal, CW, brl(totalConta), "right");
  faturamento += cell(COL.pc, yTotal, CW, brl(r2(valPis + valCofins)), "right");
  faturamento += cell(COL.base, yTotal, CW, brl(subFat), "right");
  faturamento += cell(COL.icms, yTotal, CW, brl(valIcms), "right");

  /* ---------------------------------------------------------- tributos */

  const trib = [
    { base: brl(basePc), aliq: "0,86", valor: brl(valPis) },
    { base: brl(basePc), aliq: "3,95", valor: brl(valCofins) },
    { base: brl(subFat), aliq: brl(aliqIcms), valor: brl(valIcms) },
  ];
  let tributos = "";
  trib.forEach((t, i) => {
    const dy = 1.2 + i * 9.45;
    tributos += cell(47, dy, 45, t.base, "right");
    tributos += cell(79.2, dy, 45, t.aliq, "right");
    tributos += cell(109.4, dy, 45, t.valor, "right");
  });

  /* -------------------------------------------------- consumo histórico */

  const hist = historicoConsumo(consumo, d.referencia || "", dias, d.instalacao || "");
  const maxKwh = Math.max(...hist.map((h) => h.kwh), 1);
  let consumoHist = "";
  hist.forEach((l, i) => {
    const dy = 1.3 + i * 9.57;
    consumoHist += cell(0, dy, 26, l.rotulo);
    const barW = Math.max(3, Math.round((l.kwh / maxKwh) * 38));
    consumoHist += `<span style="position:absolute;left:${25 + (38 - barW)}px;top:${dy + 0.9}px;width:${barW}px;height:4.6px;background:#b3b3b3"></span>`;
    consumoHist += cell(42, dy, 45, brl(l.kwh, 3), "right");
    consumoHist += cell(90, dy, 16, String(l.dias), "center");
    consumoHist += cell(117.8, dy, 20, "LID");
  });

  /* ----------------------------------------------------------- medição */

  const leitAnt = (d.leitura_anterior_medidor || "").trim();
  const leitAtual = (d.leitura_atual_medidor || "").trim();
  const medicao =
    cell(0, 0, 60, d.medidor || "") +
    cell(66.1, 0, 40, "ENRG ATV") +
    cell(109.3, 0.5, 40, "ÚNICO") +
    cell(140.8, 0, 45, leitAnt, "right") +
    cell(167.3, 0, 45, leitAtual, "right") +
    cell(192.2, 0, 45, "1,00000", "right") +
    cell(221.5, 0, 45, brl(consumo, 3), "right");

  /* ---------------------------------------------------- linha digitável */

  const blocos = [d.cb1 || "", d.cb2 || "", d.cb3 || "", d.cb4 || ""].map((b) => b.replace(/\D/g, ""));
  const digitos = blocos.join("");
  const linhaDigitavel = blocos.filter(Boolean).join(" ");
  const posBar = p.barcode;
  const barcode = digitos.length >= 20 && posBar
    ? `<div class="ov" style="top:${posBar.y}px;left:${posBar.x}px;width:${posBar.w ?? 385}px;height:${posBar.h ?? 38}px;">${itfBarcodeSvg(digitos, posBar.w ?? 385, posBar.h ?? 38)}</div>`
    : "";

  const posQr = p.qrcode;
  const pixPayload = d.pix_payload?.trim() || `https://enel.com.br/2via?doc=${encodeURIComponent(d.instalacao || "")}&v=${encodeURIComponent(total)}`;
  const qr = posQr
    ? `<div class="ov" style="top:${posQr.y}px;left:${posQr.x}px;width:${posQr.w ?? 104}px;height:${posQr.h ?? 104}px;">${qrSvg(pixPayload, posQr.w ?? 104)}</div>`
    : "";

  /* ------------------------------------------------------------- página */

  const endereco = [d.endereco, d.complemento, `${d.bairro || ""}${d.cep ? ` - CEP: ${d.cep}` : ""}`, `${d.municipio || ""}${d.uf ? ` - ${d.uf}` : ""}`]
    .map((l) => (l || "").trim())
    .filter(Boolean)
    .join("\n");

  const head = `<meta charset="UTF-8">
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
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; }
  .bg { position: absolute; inset: 0; z-index: 0; }
  .bg img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .ov { position: absolute; z-index: 10; color: #111; line-height: 1.32; overflow: visible; white-space: pre-line; }
  .ov span { line-height: 1.1; }
</style>`;

  return `<!DOCTYPE html>
<html>
<head>${head}</head>
<body>
<div class="page">
  <div class="bg">${bg1 ? `<img src="${escapeHtml(bg1)}" />` : ""}</div>

  ${field("controle_topo", d.numero_conta ? `Nº ${d.numero_conta}` : "")}
  ${field("classificacao", d.classificacao || "B - B1 - CONVENCIONAL - Residencial - Residencial")}
  ${field("fornecimento", d.fornecimento || "Monofásico")}

  ${field("leitura_anterior", d.data_leitura_anterior || "")}
  ${field("leitura_atual", d.data_leitura_atual || "")}
  ${field("dias_leitura", String(dias))}
  ${field("proxima_leitura", d.proxima_leitura || "")}

  ${field("cliente_nome", (d.nome || "").toUpperCase())}
  ${field("cliente_endereco", endereco.toUpperCase())}
  ${field("cliente_documento", d.cpf ? `CPF/CNPJ: ${d.cpf}` : "")}

  ${field("instalacao", d.instalacao || "")}
  ${field("cliente_numero", d.numero_cliente || "")}

  ${field("chave_nf", d.chave_nf || "")}
  ${field("nota_fiscal_serie", d.nota_fiscal ? `NOTA FISCAL Nº ${d.nota_fiscal} - SÉRIE ${d.serie_nf || "B"}` : "")}

  ${field("mes_ano", d.referencia || "")}
  ${field("vencimento", d.vencimento || "")}
  ${field("total_pagar", `R$ ${total}`)}

  ${field("mensagens", d.mensagens || "")}

  ${block("faturamento", faturamento)}
  ${block("tributos", tributos)}
  ${block("consumo_historico", consumoHist)}
  ${block("medicao", medicao)}

  ${field("debito_codigo", d.codigo_debito || "")}

  ${field("linha_digitavel", linhaDigitavel)}
  ${field("pagador", `${(d.nome || "").toUpperCase()}${d.cpf ? ` - ${d.cpf}` : ""}`)}
  ${field("data_emissao", d.data_emissao || "")}
  ${field("nota_fiscal_rodape", d.nota_fiscal || "")}
  ${field("referencia", d.referencia || "")}
  ${field("vencimento_rodape", d.vencimento || "")}
  ${field("valor_documento", total)}
  ${field("controle_rodape", d.numero_conta || "")}

  ${barcode}
  ${qr}
</div>

<div class="page">
  <div class="bg">${bg2 ? `<img src="${escapeHtml(bg2)}" />` : ""}</div>
  ${field("controle_p2", d.numero_conta ? `Nº ${d.numero_conta}` : "")}
  ${field("unidade_entrega", d.unidade_entrega || "")}
  ${field("sequencia", d.sequencia || "")}
  ${field("medidor_p2", d.medidor || "")}
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
      "nome", "cpf", "endereco", "complemento", "bairro", "cep", "municipio", "uf",
      "numero_conta", "instalacao", "numero_cliente", "nota_fiscal", "serie_nf", "chave_nf",
      "classificacao", "fornecimento", "referencia", "vencimento", "total_pagar", "data_emissao",
      "data_leitura_anterior", "data_leitura_atual", "proxima_leitura", "dias",
      "consumo_kwh", "tarifa_tusd", "tarifa_te", "aliquota_icms", "cosip",
      "medidor", "leitura_anterior_medidor", "leitura_atual_medidor",
      "mensagens", "codigo_debito", "cb1", "cb2", "cb3", "cb4", "pix_payload",
      "unidade_entrega", "sequencia",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
      template_bg_p2: body.template_p2_base64 || "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : String(body[k] ?? "");

    const html = buildComprovanteHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Comprovante de Residência:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
