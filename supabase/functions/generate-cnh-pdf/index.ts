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
body { margin: 0; font-family: Arial; }
.documento { position: relative; width: 900px; height: 550px; }
.background { position: absolute; width: 900px; height: 550px; top: 0; left: 0; }
.campo { position: absolute; font-size: 16px; font-weight: bold; color: #000; }
.foto { position: absolute; top: 140px; left: 60px; width: 120px; height: 140px; object-fit: cover; }
.assinatura { position: absolute; top: 420px; left: 200px; width: 200px; }
</style>
</head>
<body>
<div class="documento">
  <img class="background" src="${templateUrl}">
  ${data.foto ? `<img class="foto" src="${data.foto}">` : ""}
  <div class="campo" style="top:150px; left:220px;">${data.nome_completo || ""}</div>
  <div class="campo" style="top:180px; left:220px;">${data.cpf || ""}</div>
  <div class="campo" style="top:210px; left:220px;">${data.rg || ""}</div>
  <div class="campo" style="top:240px; left:220px;">${data.data_nascimento || ""}</div>
  <div class="campo" style="top:270px; left:220px;">${data.genero || ""}</div>
  <div class="campo" style="top:300px; left:220px;">${data.nacionalidade || ""}</div>
  <div class="campo" style="top:330px; left:220px;">${data.nome_pai || ""}</div>
  <div class="campo" style="top:360px; left:220px;">${data.nome_mae || ""}</div>
  <div class="campo" style="top:150px; left:520px;">${data.registro || ""}</div>
  <div class="campo" style="top:180px; left:520px;">${data.categoria || ""}</div>
  <div class="campo" style="top:210px; left:520px;">${data.data_primeira_hab || ""}</div>
  <div class="campo" style="top:240px; left:520px;">${data.data_emissao || ""}</div>
  <div class="campo" style="top:270px; left:520px;">${data.data_validade || ""}</div>
  <div class="campo" style="top:300px; left:520px;">${data.renach || ""}</div>
  <div class="campo" style="top:330px; left:520px;">${data.codigo_seguranca || ""}</div>
  <div class="campo" style="top:360px; left:520px;">${data.numero_espelho || ""}</div>
  <div class="campo" style="top:390px; left:520px;">${data.cidade_estado || ""}</div>
  ${data.assinatura ? `<img class="assinatura" src="${data.assinatura}">` : ""}
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

    const pdfBuffer = await pdfRes.arrayBuffer();
    const pdfBase64 = btoa(
      String.fromCharCode(...new Uint8Array(pdfBuffer))
    );

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
