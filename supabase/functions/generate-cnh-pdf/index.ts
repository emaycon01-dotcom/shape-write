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

function buildCnhHtml(d: Record<string, string>) {
  const mrz = buildMrz(d);
  const cats = (d.categoria || "B").split("");
  const catRows = ["ACC","A","A1","B","B1","C","C1","D","D1","BE","CE","C1E","DE","D1E"];

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
    min-height: 1123px;
    position: relative;
    background: #fff;
    overflow: hidden;
  }

  /* === TOP HEADER BAR === */
  .top-header {
    background: linear-gradient(135deg, #1b3a4b 0%, #264653 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 20px;
    height: 42px;
  }
  .top-header .republic {
    font-size: 10px;
    font-weight: bold;
    line-height: 1.3;
  }
  .top-header .republic small {
    font-size: 7.5px;
    font-weight: normal;
    display: block;
  }
  .top-header .govbr {
    font-size: 14px;
    font-weight: bold;
    font-style: italic;
    color: #fff;
  }

  /* === MAIN CONTENT === */
  .main-content {
    display: flex;
    gap: 15px;
    padding: 12px 18px 8px 18px;
  }
  .left-col { flex: 0 0 420px; }
  .right-col { flex: 1; }

  /* === CNH CARD === */
  .cnh-card {
    border: 1.5px solid #666;
    border-radius: 3px;
    overflow: hidden;
    position: relative;
  }
  .card-header {
    background: linear-gradient(135deg, #c9b97a 0%, #d4c68a 50%, #c9b97a 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    min-height: 32px;
  }
  .card-header-text {
    font-size: 6.5px;
    font-weight: bold;
    color: #1a3a1a;
    text-transform: uppercase;
    line-height: 1.3;
    text-align: center;
    flex: 1;
  }
  .card-header .br-badge {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #009c3b;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: bold;
    font-size: 9px;
    border: 2px solid #ffdf00;
    flex-shrink: 0;
  }
  .card-subtitle {
    background: #e8e0c8;
    font-size: 6px;
    font-weight: bold;
    text-align: center;
    padding: 2px 4px;
    color: #333;
    letter-spacing: 0.3px;
    border-bottom: 1px solid #999;
  }

  /* Card body */
  .card-body {
    display: flex;
    min-height: 280px;
    position: relative;
  }

  /* Photo area */
  .photo-area {
    width: 105px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px 4px 4px;
    border-right: 1px solid #999;
    position: relative;
  }
  .photo-box {
    width: 92px;
    height: 120px;
    border: 1px solid #999;
    overflow: hidden;
    background: #f5f5f5;
  }
  .photo-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .valid-text {
    position: absolute;
    left: -12px;
    top: 50%;
    transform: rotate(-90deg) translateX(-50%);
    transform-origin: 0 0;
    font-size: 5.5px;
    color: #333;
    font-weight: bold;
    white-space: nowrap;
    letter-spacing: 1px;
  }
  .valid-number {
    position: absolute;
    left: 2px;
    top: 50%;
    transform: rotate(-90deg) translateX(-50%);
    transform-origin: 0 0;
    font-size: 9px;
    color: #333;
    font-weight: bold;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  .signature-area {
    margin-top: 6px;
    width: 92px;
    min-height: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .signature-area img {
    max-width: 90px;
    max-height: 40px;
    object-fit: contain;
  }
  .signature-label {
    font-size: 5px;
    color: #666;
    text-align: center;
    margin-top: 2px;
  }

  /* Fields area */
  .fields-area {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .field-row {
    display: flex;
    border-bottom: 1px solid #bbb;
    min-height: 26px;
  }
  .field-row:last-child { border-bottom: none; }
  .field {
    padding: 2px 6px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-right: 1px solid #bbb;
    overflow: hidden;
  }
  .field:last-child { border-right: none; }
  .field-label {
    font-size: 5px;
    color: #666;
    text-transform: uppercase;
    line-height: 1;
    margin-bottom: 1px;
  }
  .field-value {
    font-size: 9.5px;
    font-weight: bold;
    color: #111;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .field-value.small { font-size: 8px; }

  /* Dates row with category */
  .dates-row {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid #bbb;
    min-height: 28px;
  }
  .cat-display {
    width: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: bold;
    color: #111;
    border-left: 1px solid #bbb;
  }
  .acc-icons {
    width: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: 1px solid #bbb;
    gap: 1px;
    flex-wrap: wrap;
    padding: 2px;
  }
  .acc-icon {
    width: 12px;
    height: 8px;
    background: #333;
    border-radius: 1px;
    opacity: 0.3;
  }
  .acc-icon.active { opacity: 1; }

  /* === CATEGORIES TABLE === */
  .cat-table {
    border: 1.5px solid #666;
    border-top: none;
    border-collapse: collapse;
    width: 100%;
    font-size: 6.5px;
  }
  .cat-table td, .cat-table th {
    border: 0.5px solid #999;
    padding: 1px 3px;
    text-align: center;
    height: 14px;
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
  .cat-table .cat-date {
    font-size: 6px;
    color: #333;
  }
  .cat-table .cat-active {
    background: #f0f0e0;
  }

  /* === OBSERVATIONS === */
  .obs-section {
    border: 1.5px solid #666;
    border-top: none;
    padding: 4px 8px;
    min-height: 28px;
  }
  .obs-label {
    font-size: 5.5px;
    color: #666;
    font-weight: bold;
  }
  .obs-value {
    font-size: 8px;
    font-weight: bold;
    color: #111;
    margin-top: 1px;
  }

  /* === SIGNING INFO === */
  .signing-section {
    border: 1.5px solid #666;
    border-top: none;
    padding: 6px 8px;
    display: flex;
    position: relative;
    min-height: 95px;
  }
  .signing-left {
    flex: 1;
  }
  .signing-right {
    text-align: right;
    font-size: 7.5px;
    font-weight: bold;
    color: #333;
    line-height: 1.6;
  }
  .signed-text {
    font-size: 7px;
    color: #666;
    text-align: center;
    margin-top: 10px;
  }
  .signed-dept {
    font-size: 6px;
    color: #666;
    text-align: center;
  }
  .local-label {
    font-size: 5px;
    color: #666;
    margin-top: 6px;
  }
  .local-value {
    font-size: 8px;
    font-weight: bold;
    color: #111;
  }
  .signing-number {
    position: absolute;
    left: -14px;
    top: 50%;
    transform: rotate(-90deg) translateX(-50%);
    transform-origin: 0 0;
    font-size: 9px;
    font-weight: bold;
    color: #333;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  /* === STATE NAME === */
  .state-name {
    border: 1.5px solid #666;
    border-top: none;
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    color: #111;
    padding: 6px 8px;
  }

  /* === QR CODE SECTION === */
  .qr-section {
    border: 1.5px solid #666;
    padding: 8px;
    margin-bottom: 12px;
  }
  .qr-label {
    font-size: 8px;
    font-weight: bold;
    color: #333;
    margin-bottom: 6px;
    display: block;
  }
  .qr-placeholder {
    width: 200px;
    height: 200px;
    background: #f0f0f0;
    border: 1px solid #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    font-size: 10px;
    color: #999;
  }

  /* === LEGAL TEXT === */
  .legal-text {
    font-size: 7.5px;
    color: #333;
    line-height: 1.5;
    margin-top: 12px;
    text-align: justify;
  }
  .serpro {
    font-size: 11px;
    font-weight: bold;
    color: #333;
    text-align: right;
    margin-top: 16px;
    letter-spacing: 1px;
  }

  /* === LEGEND === */
  .legend {
    margin: 10px 18px;
    padding: 10px;
    border: 1px solid #ccc;
    font-size: 5px;
    color: #555;
    line-height: 1.5;
  }

  /* === MRZ === */
  .mrz {
    margin: 8px 18px;
    padding: 12px 18px;
    border: 1px solid #ccc;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    font-weight: bold;
    color: #111;
    letter-spacing: 2px;
    line-height: 1.8;
  }
</style>
</head>
<body>
<div class="page">

  <!-- TOP HEADER -->
  <div class="top-header">
    <div class="republic">
      REPÚBLICA FEDERATIVA DO BRASIL
      <small>MINISTÉRIO DA INFRAESTRUTURA</small>
      <small>SECRETARIA NACIONAL DE TRÂNSITO - SENATRAN</small>
    </div>
    <div class="govbr">gov.br</div>
  </div>

  <!-- MAIN CONTENT -->
  <div class="main-content">

    <!-- LEFT COLUMN -->
    <div class="left-col">

      <!-- CNH CARD -->
      <div class="cnh-card">
        <div class="card-header">
          <div class="card-header-text">
            REPÚBLICA FEDERATIVA DO BRASIL<br>
            MINISTÉRIO DA INFRAESTRUTURA<br>
            SECRETARIA NACIONAL DE TRÂNSITO
          </div>
          <div class="br-badge">BR</div>
        </div>
        <div class="card-subtitle">
          CARTEIRA NACIONAL DE HABILITAÇÃO / DRIVER LICENSE / PERMISO DE CONDUCCIÓN
        </div>

        <div class="card-body">
          <!-- Photo area -->
          <div class="photo-area">
            <div class="valid-text">VÁLIDA EM TODO O TERRITÓRIO NACIONAL</div>
            <div class="valid-number">${d.registro || ""}</div>
            <div class="photo-box">
              ${d.foto ? `<img src="${d.foto}" />` : ""}
            </div>
            <div class="signature-area">
              ${d.assinatura ? `<img src="${d.assinatura}" />` : ""}
            </div>
            <div class="signature-label">7 ASSINATURA DO PORTADOR</div>
          </div>

          <!-- Fields -->
          <div class="fields-area">
            <!-- Nome | 1ª Habilitação -->
            <div class="field-row">
              <div class="field" style="flex:2">
                <span class="field-label">2 e 1 NOME E SOBRENOME</span>
                <span class="field-value">${d.nome_completo || ""}</span>
              </div>
              <div class="field" style="flex:1">
                <span class="field-label">1ª HABILITAÇÃO</span>
                <span class="field-value">${d.data_primeira_hab || ""}</span>
              </div>
            </div>

            <!-- Data Nascimento -->
            <div class="field-row">
              <div class="field">
                <span class="field-label">3 DATA, LOCAL E UF DE NASCIMENTO</span>
                <span class="field-value small">${d.data_nascimento || ""}</span>
              </div>
            </div>

            <!-- Emissão | Validade | ACC | Cat -->
            <div class="dates-row">
              <div class="field" style="flex:1">
                <span class="field-label">4a DATA EMISSÃO</span>
                <span class="field-value">${d.data_emissao || ""}</span>
              </div>
              <div class="field" style="flex:1">
                <span class="field-label">4b VALIDADE</span>
                <span class="field-value">${d.data_validade || ""}</span>
              </div>
              <div class="acc-icons">
                <div class="acc-icon"></div>
                <div class="acc-icon"></div>
                <div class="acc-icon"></div>
                <div class="acc-icon"></div>
                <div class="acc-icon"></div>
              </div>
              <div class="cat-display">${d.categoria || ""}</div>
            </div>

            <!-- Doc Identidade -->
            <div class="field-row">
              <div class="field">
                <span class="field-label">4c DOC IDENTIDADE / ÓRG EMISSOR/UF</span>
                <span class="field-value">${d.rg || ""}</span>
              </div>
            </div>

            <!-- CPF | Nº Registro | Cat Hab -->
            <div class="field-row">
              <div class="field" style="flex:1">
                <span class="field-label">4d CPF</span>
                <span class="field-value">${d.cpf || ""}</span>
              </div>
              <div class="field" style="flex:1">
                <span class="field-label">5 Nº REGISTRO</span>
                <span class="field-value">${d.registro || ""}</span>
              </div>
              <div class="field" style="flex:0 0 45px">
                <span class="field-label">9 CAT HAB</span>
                <span class="field-value">${d.categoria || ""}</span>
              </div>
            </div>

            <!-- Nacionalidade -->
            <div class="field-row">
              <div class="field">
                <span class="field-label">NACIONALIDADE</span>
                <span class="field-value">${d.nacionalidade || ""}</span>
              </div>
            </div>

            <!-- Filiação Pai -->
            <div class="field-row">
              <div class="field">
                <span class="field-label">FILIAÇÃO</span>
                <span class="field-value">${d.nome_pai || ""}</span>
              </div>
            </div>

            <!-- Filiação Mãe -->
            <div class="field-row">
              <div class="field">
                <span class="field-value">${d.nome_mae || ""}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CATEGORIES TABLE -->
      <table class="cat-table">
        <tr>
          <th>9</th><th>10</th><th>11</th><th>12</th>
          <th>9</th><th>10</th><th>11</th><th>12</th>
        </tr>
        ${buildCatRows(catRows, d.categoria || "", d.data_validade || "")}
      </table>

      <!-- OBSERVATIONS -->
      <div class="obs-section">
        <span class="obs-label">12 OBSERVAÇÕES</span>
        <div class="obs-value">${d.observacoes || ""}</div>
      </div>

      <!-- SIGNING INFO -->
      <div class="signing-section">
        <div class="signing-number">${d.registro || ""}</div>
        <div class="signing-left">
          <div class="signed-text">ASSINADO DIGITALMENTE</div>
          <div class="signed-dept">DEPARTAMENTO ESTADUAL DE TRÂNSITO</div>
          <div class="local-label">LOCAL</div>
          <div class="local-value">${d.cidade_estado || ""}</div>
        </div>
        <div class="signing-right">
          ${d.numero_espelho || ""}<br>
          ${d.renach || ""}
        </div>
      </div>

      <!-- STATE NAME -->
      <div class="state-name">${d.estado_extenso || ""}</div>
    </div>

    <!-- RIGHT COLUMN -->
    <div class="right-col">
      <div class="qr-section">
        <span class="qr-label">QR-CODE</span>
        <div class="qr-placeholder">QR-CODE</div>
      </div>

      <div class="legal-text">
        Documento assinado com certificado digital em conformidade
        com a Medida Provisória nº 2200-2/2001. Sua validade poderá
        ser confirmada por meio do programa Assinador Serpro.
        <br><br>
        As orientações para instalar o Assinador Serpro e realizar a
        validação do documento digital estão disponíveis em:
        https://www.serpro.gov.br/assinador-digital.
      </div>

      <div class="serpro"><b>SERPRO</b> / SENATRAN</div>
    </div>
  </div>

  <!-- LEGEND -->
  <div class="legend">
    2 e 1. Nome e Sobrenome / Name and Surname / Nombre y Apellidos – Primeira Habilitação / First Driver License / Primera Licencia de Conducir – 3. Data e
    Local de Nascimento / Date and Place of Birth DD/MM/YYYY / Fecha y Lugar de Nacimiento – 4a. Data de Emissão / Issuing Date DD/MM/YYYY / Fecha de Emisión – 4b.
    Data de Validade / Expiration Date DD/MM/YYYY / Válido Hasta – ACC – 4c. Documento Identidade – Órgão emissor / Identity Document – Issuing Authority /
    Documento de Identificación – Autoridad Expedidora – 4d. CPF – 5. Número de registro da CNH / Driver License Number / Número de Permiso de Conducir – 9.
    Categoria de Veículos da Carteira de Habilitação / Driver License Class / Categoría de Permisos de Conducir – Nacionalidade / Nationality / Nacionalidad –
    Filiação / Filiation / Filiación – 12. Observações / Observations / Observaciones – Local / Place / Lugar
  </div>

  <!-- MRZ -->
  <div class="mrz">
    ${mrz.line1}<br>
    ${mrz.line2}<br>
    ${mrz.line3}
  </div>

</div>
</body>
</html>`;
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
