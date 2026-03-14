import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDFSHIFT_API_URL = "https://api.pdfshift.io/v3/convert/pdf";

function buildCnhHtml(data: Record<string, string>) {
  const templateUrl = data.template_url || "/assets/template-cnh.png";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 1123px;
    height: 794px;
    position: relative;
    overflow: hidden;
    background: #fff;
  }
  .template-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 1123px;
    height: 794px;
    object-fit: contain;
    z-index: 0;
  }
  .field {
    position: absolute;
    font-size: 11px;
    font-weight: bold;
    color: #1a1a1a;
    z-index: 1;
    white-space: nowrap;
    letter-spacing: 0.3px;
    font-family: Arial, Helvetica, sans-serif;
  }
  .field-small {
    position: absolute;
    font-size: 9px;
    font-weight: bold;
    color: #1a1a1a;
    z-index: 1;
    white-space: nowrap;
    font-family: Arial, Helvetica, sans-serif;
  }
  .foto {
    position: absolute;
    z-index: 1;
    object-fit: cover;
    border: none;
  }
  .assinatura {
    position: absolute;
    z-index: 1;
    object-fit: contain;
  }
</style>
</head>
<body>
<div class="page">
  <img class="template-bg" src="${templateUrl}" />

  ${data.foto ? `<img class="foto" src="${data.foto}" style="top:155px; left:68px; width:140px; height:168px;" />` : ""}

  <!-- DADOS PESSOAIS - Coluna esquerda do cartão CNH -->
  <div class="field" style="top:118px; left:228px; max-width:220px; overflow:hidden;">${data.nome_completo || ""}</div>
  <div class="field" style="top:148px; left:228px;">${data.cpf || ""}</div>
  <div class="field" style="top:178px; left:228px;">${data.rg || ""}</div>
  <div class="field" style="top:208px; left:228px; max-width:220px; font-size:10px;">${data.data_nascimento || ""}</div>
  <div class="field" style="top:238px; left:228px;">${data.genero || ""}</div>
  <div class="field" style="top:305px; left:228px;">${data.nacionalidade || ""}</div>
  <div class="field" style="top:335px; left:228px;">${data.nome_pai || ""}</div>
  <div class="field" style="top:365px; left:228px;">${data.nome_mae || ""}</div>

  <!-- DADOS DO DOCUMENTO - Coluna direita -->
  <div class="field" style="top:118px; left:620px;">${data.registro || ""}</div>
  <div class="field" style="top:148px; left:620px;">${data.categoria || ""}</div>
  <div class="field" style="top:178px; left:620px;">${data.data_primeira_hab || ""}</div>
  <div class="field" style="top:208px; left:620px;">${data.data_emissao || ""}</div>
  <div class="field" style="top:238px; left:620px;">${data.data_validade || ""}</div>
  <div class="field" style="top:305px; left:620px;">${data.renach || ""}</div>
  <div class="field" style="top:335px; left:620px;">${data.codigo_seguranca || ""}</div>
  <div class="field" style="top:365px; left:620px;">${data.numero_espelho || ""}</div>
  <div class="field" style="top:395px; left:620px;">${data.cidade_estado || ""}</div>

  ${data.assinatura ? `<img class="assinatura" src="${data.assinatura}" style="top:430px; left:90px; width:220px; height:55px;" />` : ""}
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");
    if (!PDFSHIFT_API_KEY) {
      throw new Error("PDFSHIFT_API_KEY is not configured");
    }

    const body = await req.json();

    const data: Record<string, string> = {
      nome_completo: body.nome_completo || "",
      cpf: body.cpf || "",
      rg: body.rg || "",
      data_nascimento: body.data_nascimento || "",
      genero: body.genero || "",
      nacionalidade: body.nacionalidade || "",
      registro: body.registro || "",
      categoria: body.categoria || "",
      data_primeira_hab: body.data_primeira_habilitacao || "",
      data_emissao: body.data_emissao || "",
      data_validade: body.data_validade || "",
      renach: body.renach || "",
      codigo_seguranca: body.codigo_seguranca || "",
      numero_espelho: body.numero_espelho || "",
      cidade_estado: body.cidade_estado || "",
      nome_pai: body.nome_pai || "",
      nome_mae: body.nome_mae || "",
      template_url: body.template_url || "",
    };

    if (body.foto_base64) {
      data.foto = body.foto_base64.startsWith("data:")
        ? body.foto_base64
        : `data:image/png;base64,${body.foto_base64}`;
    }
    if (body.assinatura_base64) {
      data.assinatura = body.assinatura_base64.startsWith("data:")
        ? body.assinatura_base64
        : `data:image/png;base64,${body.assinatura_base64}`;
    }

    const html = buildCnhHtml(data);

    console.log("Sending HTML to PDFShift...");

    const pdfRes = await fetch(PDFSHIFT_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${PDFSHIFT_API_KEY}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: html,
        landscape: true,
        use_print: false,
        format: "A4",
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      }),
    });

    if (!pdfRes.ok) {
      const errText = await pdfRes.text();
      throw new Error(`PDFShift error [${pdfRes.status}]: ${errText}`);
    }

    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer());
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < pdfBuffer.length; i += chunkSize) {
      binary += String.fromCharCode(...pdfBuffer.subarray(i, i + chunkSize));
    }
    const pdfBase64 = btoa(binary);

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: `data:application/pdf;base64,${pdfBase64}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error generating PDF:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
