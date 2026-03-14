import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDFSHIFT_API_URL = "https://api.pdfshift.io/v3/convert/pdf";

function buildMrz(d: Record<string, string>) {
  const clean = (s: string) => s.replace(/[^A-Z0-9 ]/g, "").trim().toUpperCase();
  const reg = clean(d.registro || d.numero_espelho || "00000000000");
  const nameParts = clean(d.nome_completo || "NOME SOBRENOME").split(" ").filter(Boolean);
  const surname = nameParts[0] || "NOME";
  const given = nameParts.slice(1).join("<") || "SOBRENOME";

  return {
    line1: `I ${reg} BRA`,
    line2: `${surname}<${given}`.slice(0, 30),
  };
}

function formatRenachLines(value: string) {
  const clean = value.replace(/\s+/g, "").toUpperCase();
  if (!clean) return { line1: "", line2: "" };
  if (clean.length <= 8) return { line1: clean, line2: "" };

  const splitAt = Math.ceil(clean.length / 2);
  return {
    line1: clean.slice(0, splitAt),
    line2: clean.slice(splitAt),
  };
}

function parseActiveCategories(activeCategory: string) {
  const normalized = activeCategory.replace(/\s+/g, "").toUpperCase();
  const set = new Set<string>();

  if (!normalized) return set;
  if (normalized === "AB") {
    set.add("A");
    set.add("B");
    return set;
  }

  set.add(normalized);
  return set;
}

function buildCatDateOverlays(activeCategory: string, validDate: string) {
  const active = parseActiveCategories(activeCategory);
  const catRows = ["ACC", "A", "A1", "B", "B1", "C", "C1"];
  const catRowsRight = ["D", "D1", "BE", "CE", "C1E", "DE", "D1E"];
  let html = "";

  const baseY = 404;
  const rowH = 16.5;
  const leftDateX = 168;
  const rightDateX = 360;

  for (let i = 0; i < Math.max(catRows.length, catRowsRight.length); i++) {
    const lCat = catRows[i] || "";
    const rCat = catRowsRight[i] || "";
    const lActive = lCat && active.has(lCat);
    const rActive = rCat && active.has(rCat);
    const y = baseY + i * rowH;

    if (lActive) {
      html += `<div class="overlay" style="top:${y}px;left:${leftDateX}px;font-size:6.5px;font-weight:bold;color:#111;">${validDate}</div>`;
    }
    if (rActive) {
      html += `<div class="overlay" style="top:${y}px;left:${rightDateX}px;font-size:6.5px;font-weight:bold;color:#111;">${validDate}</div>`;
    }
  }
  return html;
}

function buildCnhHtml(d: Record<string, string>) {
  const mrz = buildMrz(d);
  const templateBg = d.template_bg || "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: #fff;
  }
  .page {
    width: 794px;
    height: 1123px;
    position: relative;
    background: #fff;
    overflow: hidden;
  }
  .bg-template {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 0;
  }
  .bg-template img {
    width: 100%; height: 100%;
    object-fit: fill;
  }
  .overlay {
    position: absolute;
    z-index: 10;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-weight: bold;
  }

  /* ========== PHOTO ========== */
  .photo-overlay {
    top: 130px; left: 72px;
    width: 82px; height: 110px;
    overflow: hidden;
  }
  .photo-overlay img { width:100%; height:100%; object-fit:cover; }

  /* ========== SIGNATURE ========== */
  .sig-overlay {
    top: 275px; left: 68px;
    width: 95px; height: 32px;
    display: flex; align-items: center; justify-content: center;
  }
  .sig-overlay img { max-width:100%; max-height:100%; object-fit:contain; }

  /* ========== VERTICAL TEXT (left of card) ========== */
  .reg-vert-top {
    top: 310px; left: 52px;
    transform: rotate(-90deg);
    transform-origin: left top;
    font-size: 7px;
    letter-spacing: 1.2px;
    white-space: nowrap;
    color: #c00;
    font-weight: bold;
  }

  /* ========== CARD FIELD VALUES ========== */
  /* Row 1: Nome + 1ª Habilitação */
  .f-nome         { top: 118px; left: 164px; font-size: 8.5px; max-width: 210px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .f-primeira-hab { top: 118px; left: 400px; font-size: 7.5px; }

  /* Row 2: Data nascimento, local, UF */
  .f-nascimento   { top: 145px; left: 164px; font-size: 7px; max-width: 300px; white-space: nowrap; overflow: hidden; }

  /* Row 3: Emissão + Validade + ACC + Categoria */
  .f-emissao      { top: 170px; left: 164px; font-size: 7.5px; }
  .f-validade     { top: 170px; left: 280px; font-size: 7.5px; color: #c00; }
  .f-cat-big      { top: 162px; left: 430px; font-size: 16px; }

  /* Row 4: Doc Identidade / RG */
  .f-rg           { top: 195px; left: 164px; font-size: 7px; max-width: 300px; white-space: nowrap; overflow: hidden; }

  /* Row 5: CPF + Registro + Cat Hab */
  .f-cpf          { top: 220px; left: 164px; font-size: 7.5px; }
  .f-registro     { top: 220px; left: 300px; font-size: 7.5px; color: #c00; }
  .f-cat-hab      { top: 220px; left: 418px; font-size: 8px; color: #c00; }

  /* Row 6: Nacionalidade */
  .f-nacionalidade { top: 245px; left: 164px; font-size: 7.5px; }

  /* Row 7: Filiação (pai) */
  .f-pai          { top: 265px; left: 164px; font-size: 7.5px; max-width: 290px; white-space: nowrap; overflow: hidden; }

  /* Row 8: Filiação (mãe) */
  .f-mae          { top: 280px; left: 164px; font-size: 7.5px; max-width: 290px; white-space: nowrap; overflow: hidden; }

  /* ========== OBSERVATIONS ========== */
  .f-obs          { top: 520px; left: 72px; font-size: 7px; max-width: 370px; }

  /* ========== SIGNING SECTION ========== */
  .f-espelho      { top: 570px; left: 350px; font-size: 6.5px; text-align: right; width: 110px; }
  .f-renach       { top: 582px; left: 350px; font-size: 6.5px; text-align: right; width: 110px; }
  .f-local        { top: 600px; left: 72px; font-size: 7px; }

  /* ========== VERTICAL REG (bottom) ========== */
  .reg-vert-bot {
    top: 620px; left: 52px;
    transform: rotate(-90deg);
    transform-origin: left top;
    font-size: 7px;
    letter-spacing: 1.2px;
    white-space: nowrap;
    color: #c00;
    font-weight: bold;
  }

  /* ========== STATE NAME ========== */
  .f-estado       { top: 635px; left: 60px; width: 410px; text-align: center; font-size: 15px; }

  /* ========== MRZ ========== */
  .mrz-overlay {
    top: 750px; left: 58px;
    width: 410px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    color: #111;
    letter-spacing: 2px;
    line-height: 1.8;
  }
</style>
</head>
<body>
<div class="page">
  <!-- BACKGROUND TEMPLATE -->
  <div class="bg-template">
    ${templateBg ? `<img src="${templateBg}" />` : ""}
  </div>

  <!-- PHOTO -->
  <div class="overlay photo-overlay">${d.foto ? `<img src="${d.foto}" />` : ""}</div>

  <!-- SIGNATURE -->
  <div class="overlay sig-overlay">${d.assinatura ? `<img src="${d.assinatura}" />` : ""}</div>

  <!-- VERTICAL REGISTRATION (top) -->
  <div class="overlay reg-vert-top">${d.registro || ""}</div>

  <!-- CARD FIELD VALUES -->
  <div class="overlay f-nome">${d.nome_completo || ""}</div>
  <div class="overlay f-primeira-hab">${d.data_primeira_hab || ""}</div>
  <div class="overlay f-nascimento">${d.data_nascimento || ""}</div>
  <div class="overlay f-emissao">${d.data_emissao || ""}</div>
  <div class="overlay f-validade">${d.data_validade || ""}</div>
  <div class="overlay f-cat-big">${d.categoria || ""}</div>
  <div class="overlay f-rg">${d.rg || ""}</div>
  <div class="overlay f-cpf">${d.cpf || ""}</div>
  <div class="overlay f-registro">${d.registro || ""}</div>
  <div class="overlay f-cat-hab">${d.categoria || ""}</div>
  <div class="overlay f-nacionalidade">${d.nacionalidade || ""}</div>
  <div class="overlay f-pai">${d.nome_pai || ""}</div>
  <div class="overlay f-mae">${d.nome_mae || ""}</div>

  <!-- CATEGORY DATE VALUES -->
  ${buildCatDateOverlays(d.categoria || "", d.data_validade || "")}

  <!-- OBSERVATIONS -->
  <div class="overlay f-obs">${d.observacoes || ""}</div>

  <!-- SIGNING INFO -->
  <div class="overlay f-espelho">${d.numero_espelho || ""}</div>
  <div class="overlay f-renach">${d.renach || ""}</div>
  <div class="overlay f-local">${d.cidade_estado || ""}</div>

  <!-- VERTICAL REGISTRATION (bottom) -->
  <div class="overlay reg-vert-bot">${d.registro || ""}</div>

  <!-- STATE NAME -->
  <div class="overlay f-estado">${d.estado_extenso || ""}</div>

  <!-- MRZ -->
  <div class="overlay mrz-overlay">
    ${mrz.line1}<br>
    ${mrz.line2}<br>
    ${mrz.line3}
  </div>
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
      estado_extenso: body.estado_extenso || "",
      nome_pai: body.nome_pai || "",
      nome_mae: body.nome_mae || "",
      observacoes: body.observacoes || "",
      template_bg: body.template_base64 || "",
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
        landscape: false,
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
