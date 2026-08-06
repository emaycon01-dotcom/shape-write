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

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "01/12/2021" -> "01 de dezembro de 2021" */
export function dataPorExtenso(data: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((data || "").trim());
  if (!m) return (data || "").trim();
  return `${m[1]} de ${MESES[Number(m[2]) - 1] || ""} de ${m[3]}`;
}

/** Corpo padrão da declaração de escolaridade. */
export function buildCorpoEscolaridade(d: Record<string, string>): string {
  const b = (v: string) => `<b>${escapeHtml((v || "").trim())}</b>`;
  const t = (v: string) => escapeHtml((v || "").trim());

  return (
    `Declaramos, para os devidos fins de comprovação de escolaridade, que os documentos ` +
    `especificados neste formulário foram expedidos pela ${t(d.escola_curta || d.escola)}, e correspondem ao ` +
    `conteúdo programático que ${b(d.nome_aluno)}, portador (a) identidade n º – ${b(d.rg)} e do ` +
    `Cadastro de Pessoa Física do Ministério da Fazenda - CPF/MF sob o n º - ${b(d.cpf)}, ` +
    `cursou e concluiu o ${t(d.nivel_ensino)}, no ano de ${t(d.ano_conclusao)} nesta instituição de ensino.`
  );
}

export function buildDeclaracaoEscolaridadeHtml(d: Record<string, string>) {
  const brasao = d.brasao_base64 || "";
  const assinatura = d.assinatura_base64 || "";
  const dataLocal = `${(d.cidade || "").trim()}, ${dataPorExtenso(d.data_emissao || "")}`;

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
    font-family: 'Calibri', 'Carlito', 'Segoe UI', Arial, sans-serif;
    color: #000;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; padding: 90px 70px; }
  .cabecalho { display: flex; align-items: flex-start; gap: 20px; }
  .cabecalho img { width: 96px; height: 96px; object-fit: contain; }
  .cabecalho .linhas { font-size: 15.5px; font-weight: bold; line-height: 1.55; padding-top: 4px; }
  .titulo { text-align: center; font-size: 16px; font-weight: bold; text-decoration: underline; margin-top: 80px; }
  .corpo { margin-top: 60px; font-size: 16px; text-align: justify; line-height: 1.9; }
  .firmo { margin-top: 50px; text-align: center; font-size: 16px; }
  .data { margin-top: 60px; text-align: right; font-size: 16px; }
  .assinatura { position: absolute; left: 90px; bottom: 120px; width: 320px; height: 190px; }
  .assinatura img { width: 100%; height: 100%; object-fit: contain; object-position: left bottom; }
</style>
</head>
<body>
<div class="page">
  <div class="cabecalho">
    ${brasao ? `<img src="${escapeHtml(brasao)}" />` : `<div style="width:96px"></div>`}
    <div class="linhas">
      <div>GOVERNO DO ESTADO DE ${escapeHtml((d.estado_nome || "").toUpperCase())}</div>
      <div>SECRETARIA DE ESTADO DE EDUCAÇÃO</div>
      <div>${escapeHtml(d.escola || "")}</div>
      <div>${escapeHtml(d.endereco || "")}</div>
    </div>
  </div>

  <div class="titulo">DECLARACÃO</div>

  <div class="corpo">${buildCorpoEscolaridade(d)}</div>

  <div class="firmo">Por ser expressão de verdade, firmo o presente.</div>

  <div class="data">${escapeHtml(dataLocal)}</div>

  <div class="assinatura">${assinatura ? `<img src="${escapeHtml(assinatura)}" />` : ""}</div>
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    const keys = [
      "nome_aluno", "rg", "cpf", "nivel_ensino", "ano_conclusao",
      "escola", "escola_curta", "endereco", "estado", "estado_nome",
      "cidade", "data_emissao", "brasao_base64", "assinatura_base64",
    ];

    const data: Record<string, string> = {};
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildDeclaracaoEscolaridadeHtml(data);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Declaração de Escolaridade:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
