import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDFSHIFT_API_URL = "https://api.pdfshift.io/v3/convert/pdf";

function buildMrz(d: Record<string, string>) {
  const pad = (s: string, len: number) => (s + "<".repeat(len)).slice(0, len);
  const clean = (s: string) => s.replace(/[^A-Z0-9<]/g, "").toUpperCase();

  const reg = clean(d.registro || "00000000000");
  const nameParts = (d.nome_completo || "NOME<<SOBRENOME").toUpperCase().split(" ");
  const surname = nameParts[0] || "NOME";
  const given = nameParts.slice(1).join("<") || "SOBRENOME";

  const birthParts = (d.data_nascimento || "").split(",")[0]?.split("/") || [];
  const birthYY = birthParts[2]?.slice(2) || "00";
  const birthMM = birthParts[1] || "01";
  const birthDD = birthParts[0] || "01";

  const expParts = (d.data_validade || "").split("/") || [];
  const expYY = expParts[2]?.slice(2) || "00";
  const expMM = expParts[1] || "01";
  const expDD = expParts[0] || "01";

  const gender = (d.genero || "M").charAt(0).toUpperCase();

  const line1 = pad(`I<BRA${pad(reg, 15)}`, 30);
  const line2 = pad(`${birthYY}${birthMM}${birthDD}${gender}${expYY}${expMM}${expDD}BRA`, 30);
  const line3 = pad(`${surname}<<${given}`, 30);

  return { line1, line2, line3 };
}

function buildCatRows(catRows: string[], activeCategory: string, validDate: string) {
  const half = Math.ceil(catRows.length / 2);
  const left = catRows.slice(0, half);
  const right = catRows.slice(half);
  let html = "";

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const lCat = left[i] || "";
    const rCat = right[i] || "";
    const lActive = lCat && activeCategory.includes(lCat.replace("1", ""));
    const rActive = rCat && activeCategory.includes(rCat.replace("1", ""));
    const lClass = lActive ? ' class="cat-active"' : "";
    const rClass = rActive ? ' class="cat-active"' : "";

    html += `<tr>
      <td class="cat-name">${lCat}</td>
      <td${lClass}></td>
      <td${lClass}>${lActive ? validDate : ""}</td>
      <td${lClass}></td>
      <td class="cat-name">${rCat}</td>
      <td${rClass}></td>
      <td${rClass}>${rActive ? validDate : ""}</td>
      <td${rClass}></td>
    </tr>`;
  }
  return html;
}

function buildCnhHtml(d: Record<string, string>) {
  const mrz = buildMrz(d);
  const catRows = ["ACC","A","A1","B","B1","C","C1","D","D1","BE","CE","C1E","DE","D1E"];
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
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }
  .bg-template img {
    width: 100%;
    height: 100%;
    object-fit: fill;
  }

  /* === ALL OVERLAYS === */
  .overlay {
    position: absolute;
    z-index: 10;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-weight: bold;
  }

  /* Photo overlay */
  .photo-overlay {
    top: 148px;
    left: 42px;
    width: 88px;
    height: 115px;
    overflow: hidden;
  }
  .photo-overlay img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Signature overlay */
  .signature-overlay {
    top: 285px;
    left: 35px;
    width: 100px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .signature-overlay img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  /* Vertical registration number (left of photo) */
  .reg-vertical {
    top: 330px;
    left: 10px;
    transform: rotate(-90deg);
    transform-origin: left top;
    font-size: 7px;
    letter-spacing: 1px;
    white-space: nowrap;
    color: #333;
  }

  /* === CARD FIELD VALUES === */
  .f-nome {
    top: 133px;
    left: 148px;
    font-size: 9px;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .f-primeira-hab {
    top: 133px;
    left: 365px;
    font-size: 8.5px;
  }
  .f-nascimento {
    top: 162px;
    left: 148px;
    font-size: 8px;
    max-width: 280px;
    white-space: nowrap;
    overflow: hidden;
  }
  .f-emissao {
    top: 195px;
    left: 148px;
    font-size: 8.5px;
  }
  .f-validade {
    top: 195px;
    left: 260px;
    font-size: 8.5px;
  }
  .f-cat-big {
    top: 186px;
    left: 396px;
    font-size: 20px;
    font-weight: bold;
  }
  .f-rg {
    top: 228px;
    left: 148px;
    font-size: 8px;
    max-width: 280px;
    white-space: nowrap;
    overflow: hidden;
  }
  .f-cpf {
    top: 260px;
    left: 148px;
    font-size: 8.5px;
  }
  .f-registro {
    top: 260px;
    left: 268px;
    font-size: 8.5px;
  }
  .f-cat-hab {
    top: 260px;
    left: 394px;
    font-size: 9px;
  }
  .f-nacionalidade {
    top: 290px;
    left: 148px;
    font-size: 8.5px;
  }
  .f-pai {
    top: 318px;
    left: 148px;
    font-size: 8.5px;
    max-width: 280px;
    white-space: nowrap;
    overflow: hidden;
  }
  .f-mae {
    top: 343px;
    left: 148px;
    font-size: 8.5px;
    max-width: 280px;
    white-space: nowrap;
    overflow: hidden;
  }

  /* === RIGHT COLUMN === */
  .qr-overlay {
    top: 90px;
    left: 480px;
    width: 170px;
    height: 170px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #999;
  }

  .legal-overlay {
    top: 310px;
    left: 455px;
    width: 310px;
    font-size: 7.5px;
    font-weight: normal;
    color: #333;
    line-height: 1.5;
    text-align: justify;
  }

  .serpro-overlay {
    top: 410px;
    left: 640px;
    font-size: 10px;
    font-weight: bold;
    color: #333;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  /* === CATEGORIES TABLE === */
  .cat-table-overlay {
    top: 395px;
    left: 18px;
    width: 420px;
    z-index: 10;
  }
  .cat-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 6.5px;
  }
  .cat-table td, .cat-table th {
    border: 0.5px solid #999;
    padding: 1px 3px;
    text-align: center;
    height: 13px;
  }
  .cat-table th {
    background: #e8e8e8;
    font-weight: bold;
    font-size: 6px;
  }
  .cat-table .cat-name {
    font-weight: bold;
    width: 28px;
    text-align: left;
    padding-left: 4px;
  }
  .cat-table .cat-active {
    background: #f0f0e0;
  }

  /* === OBSERVATIONS === */
  .f-obs-value {
    top: 540px;
    left: 30px;
    font-size: 8px;
    max-width: 400px;
  }

  /* === SIGNING SECTION === */
  .f-espelho {
    top: 580px;
    left: 340px;
    font-size: 7.5px;
    text-align: right;
  }
  .f-renach {
    top: 593px;
    left: 340px;
    font-size: 7.5px;
    text-align: right;
  }
  .f-local {
    top: 608px;
    left: 30px;
    font-size: 8px;
  }
  .f-reg-vertical-bottom {
    top: 640px;
    left: 10px;
    transform: rotate(-90deg);
    transform-origin: left top;
    font-size: 7px;
    letter-spacing: 1px;
    white-space: nowrap;
    color: #333;
  }

  /* === STATE NAME === */
  .f-estado {
    top: 640px;
    left: 18px;
    width: 420px;
    text-align: center;
    font-size: 18px;
    font-weight: bold;
  }

  /* === LEGEND === */
  .legend-overlay {
    top: 690px;
    left: 18px;
    width: 758px;
    font-size: 5px;
    font-weight: normal;
    color: #555;
    line-height: 1.5;
  }

  /* === MRZ === */
  .mrz-overlay {
    top: 760px;
    left: 18px;
    width: 758px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    font-weight: bold;
    color: #111;
    letter-spacing: 2px;
    line-height: 1.8;
    padding: 12px 18px;
    border: 1px solid #ccc;
  }
</style>
</head>
<body>
<div class="page">

  <!-- TEMPLATE BACKGROUND -->
  <div class="bg-template">
    ${templateBg ? `<img src="${templateBg}" />` : ""}
  </div>

  <!-- PHOTO -->
  <div class="overlay photo-overlay">
    ${d.foto ? `<img src="${d.foto}" />` : ""}
  </div>

  <!-- SIGNATURE -->
  <div class="overlay signature-overlay">
    ${d.assinatura ? `<img src="${d.assinatura}" />` : ""}
  </div>

  <!-- VERTICAL REGISTRATION -->
  <div class="overlay reg-vertical">${d.registro || ""}</div>

  <!-- FIELD VALUES -->
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

  <!-- QR CODE -->
  <div class="overlay qr-overlay">QR-CODE</div>

  <!-- LEGAL TEXT -->
  <div class="overlay legal-overlay">
    Documento assinado com certificado digital em conformidade
    com a Medida Provisória nº 2200-2/2001. Sua validade poderá
    ser confirmada por meio do programa Assinador Serpro.
    <br><br>
    As orientações para instalar o Assinador Serpro e realizar a
    validação do documento digital estão disponíveis em:
    https://www.serpro.gov.br/assinador-digital.
  </div>

  <div class="overlay serpro-overlay"><b>SERPRO</b> / SENATRAN</div>

  <!-- CATEGORIES TABLE -->
  <div class="cat-table-overlay overlay">
    <table class="cat-table">
      <tr>
        <th>9</th><th>10</th><th>11</th><th>12</th>
        <th>9</th><th>10</th><th>11</th><th>12</th>
      </tr>
      ${buildCatRows(catRows, d.categoria || "", d.data_validade || "")}
    </table>
  </div>

  <!-- OBSERVATIONS -->
  <div class="overlay f-obs-value">${d.observacoes || ""}</div>

  <!-- SIGNING INFO -->
  <div class="overlay f-espelho">${d.numero_espelho || ""}</div>
  <div class="overlay f-renach">${d.renach || ""}</div>
  <div class="overlay f-local">${d.cidade_estado || ""}</div>

  <!-- STATE NAME -->
  <div class="overlay f-estado">${d.estado_extenso || ""}</div>

  <!-- LEGEND -->
  <div class="overlay legend-overlay">
    2 e 1. Nome e Sobrenome / Name and Surname / Nombre y Apellidos – Primeira Habilitação / First Driver License / Primera Licencia de Conducir – 3. Data e
    Local de Nascimento / Date and Place of Birth DD/MM/YYYY / Fecha y Lugar de Nacimiento – 4a. Data de Emissão / Issuing Date DD/MM/YYYY / Fecha de Emisión – 4b.
    Data de Validade / Expiration Date DD/MM/YYYY / Válido Hasta – ACC – 4c. Documento Identidade – Órgão emissor / Identity Document – Issuing Authority /
    Documento de Identificación – Autoridad Expedidora – 4d. CPF – 5. Número de registro da CNH / Driver License Number / Número de Permiso de Conducir – 9.
    Categoria de Veículos da Carteira de Habilitação / Driver License Class / Categoría de Permisos de Conducir – Nacionalidade / Nationality / Nacionalidad –
    Filiação / Filiation / Filiación – 12. Observações / Observations / Observaciones – Local / Place / Lugar
  </div>

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
