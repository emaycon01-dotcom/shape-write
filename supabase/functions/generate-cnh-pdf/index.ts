import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDFSHIFT_API_URL = "https://api.pdfshift.io/v3/convert/pdf";

function normalizeMrzText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim();
}

function toMrzToken(value: string) {
  return normalizeMrzText(value).replace(/\s+/g, "<");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toMrzDate(value: string) {
  const br = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy.slice(2)}${mm}${dd}`;
  }

  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return `${yyyy.slice(2)}${mm}${dd}`;
  }

  return "<<<<<<";
}

function mrzCharValue(char: string) {
  if (char === "<") return 0;
  if (/\d/.test(char)) return Number(char);
  return char.charCodeAt(0) - 55;
}

function mrzCheckDigit(value: string) {
  const weights = [7, 3, 1];
  let sum = 0;

  for (let i = 0; i < value.length; i++) {
    sum += mrzCharValue(value[i]) * weights[i % 3];
  }

  return String(sum % 10);
}

function buildMrz(d: Record<string, string>) {
  const registro = toMrzToken(d.registro || d.numero_espelho || "").replace(/[^A-Z0-9<]/g, "");
  const docNumber = registro.padEnd(9, "<").slice(0, 9);

  const optionalData = toMrzToken(d.renach || d.numero_espelho || "")
    .replace(/[^A-Z0-9<]/g, "")
    .padEnd(15, "<")
    .slice(0, 15);

  const birth = toMrzDate(d.data_nascimento || "");
  const expiry = toMrzDate(d.data_validade || "");
  const birthCheck = mrzCheckDigit(birth);
  const expiryCheck = mrzCheckDigit(expiry);

  const gender = normalizeMrzText(d.genero || "");
  const sex = gender.startsWith("F") ? "F" : gender.startsWith("M") ? "M" : "<";

  const personalNumber = "<<<<<<<<<<<";

  const docCheck = mrzCheckDigit(docNumber);
  const finalCheck = mrzCheckDigit(
    `${docNumber}${docCheck}${optionalData}${birth}${birthCheck}${expiry}${expiryCheck}${personalNumber}`
  );

  const fullName = toMrzToken(d.nome_completo || "NOME SOBRENOME")
    .replace(/<+/g, "<<")
    .padEnd(30, "<")
    .slice(0, 30);

  return {
    line1: escapeHtml(`I<BRA${docNumber}${docCheck}${optionalData}`),
    line2: escapeHtml(`${birth}${birthCheck}${sex}${expiry}${expiryCheck}BRA${personalNumber}${finalCheck}`),
    line3: escapeHtml(fullName),
  };
}

function cleanCode(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function parseActiveCategories(activeCategory: string) {
  const normalized = activeCategory.replace(/\s+/g, "").toUpperCase();
  const set = new Set<string>();
  if (!normalized) return set;
  for (const c of ["A", "B", "C", "D", "E"]) {
    if (normalized.includes(c)) set.add(c);
  }
  return set;
}

function getCatDate(cat: string, d: Record<string, string>): string {
  const key = `validade_cat_${cat.toLowerCase()}`;
  return d[key] || d.data_validade || "";
}

function buildCatDateOverlays(activeCategory: string, d: Record<string, string>) {
  const active = parseActiveCategories(activeCategory);
  const catPositions: Record<string, { x: number; y: number; fontSize: number }> = {
    A: { x: 171, y: 353, fontSize: 4.5 },
    B: { x: 171, y: 375, fontSize: 4.5 },
    C: { x: 171, y: 397, fontSize: 4.5 },
    D: { x: 275, y: 342, fontSize: 4.5 },
    E: { x: 274, y: 375, fontSize: 4.5 },
  };

  let html = "";
  for (const [cat, pos] of Object.entries(catPositions)) {
    if (active.has(cat)) {
      const date = getCatDate(cat, d);
      if (date) {
        html += `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;font-weight:bold;color:#111;">${date}</div>`;
      }
    }
  }
  return html;
}

function buildCnhHtml(d: Record<string, string>) {
  const mrz = buildMrz(d);
  const espelhoClean = cleanCode(d.numero_espelho || "");
  const renachClean = cleanCode(d.renach || "");
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
    top: 167px; left: 98px;
    width: 82px; height: 110px;
    overflow: hidden;
  }
  .photo-overlay img { width:100%; height:100%; object-fit:cover; }

  /* ========== SIGNATURE ========== */
  .sig-overlay {
    top: 276px; left: 93px;
    width: 95px; height: 32px;
    display: flex; align-items: center; justify-content: center;
  }
  .sig-overlay img { max-width:100%; max-height:100%; object-fit:contain; }

  /* ========== VERTICAL TEXT (left of card) ========== */
  .reg-vert-top {
    top: 315px; left: 65px;
    transform: rotate(-90deg);
    transform-origin: left top;
    font-size: 12px;
    letter-spacing: 1.2px;
    white-space: nowrap;
    color: #111;
    font-weight: bold;
  }

  /* ========== CARD FIELD VALUES ========== */
  .f-nome         { top: 149px; left: 100px; font-size: 6.5px; max-width: 210px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .f-primeira-hab { top: 149px; left: 308px; font-size: 6.5px; }

  .f-nascimento   { top: 168px; left: 192px; font-size: 6.5px; max-width: 300px; white-space: nowrap; overflow: hidden; }

  .f-emissao      { top: 187px; left: 191px; font-size: 6.5px; }
  .f-validade     { top: 187px; left: 253px; font-size: 6.5px; color: #c00; }
  .f-cat-big      { top: 184px; left: 338px; font-size: 11px; color: #111; }

  .f-rg           { top: 207px; left: 190px; font-size: 6.5px; max-width: 300px; white-space: nowrap; overflow: hidden; }

  .f-cpf          { top: 226px; left: 190px; font-size: 6.5px; }
  .f-registro     { top: 226px; left: 256px; font-size: 6.5px; color: #c00; }
  .f-cat-hab      { top: 224px; left: 320px; font-size: 7px; color: #c00; }

  .f-nacionalidade { top: 246px; left: 190px; font-size: 6.5px; }

  .f-pai          { top: 266px; left: 190px; font-size: 6.5px; max-width: 290px; white-space: nowrap; overflow: hidden; }
  .f-mae          { top: 286px; left: 190px; font-size: 6.5px; max-width: 290px; white-space: nowrap; overflow: hidden; }

  .f-obs          { top: 427px; left: 97px; font-size: 5.5px; max-width: 370px; }

  .f-espelho      { top: 495px; left: 281px; font-size: 6.5px; color: #111; white-space: nowrap; }
  .f-renach       { top: 509px; left: 280px; font-size: 6.5px; color: #111; white-space: nowrap; }
  .f-local        { top: 505px; left: 100px; font-size: 6px; }

  .reg-vert-bot {
    top: 558px; left: 64px;
    transform: rotate(-90deg);
    transform-origin: left top;
    font-size: 11.5px;
    letter-spacing: 1.2px;
    white-space: nowrap;
    color: #111;
    font-weight: bold;
  }

  .f-estado       { top: 531px; left: 163px; font-size: 15px; }

  .mrz-overlay {
    top: 694px; left: 80px;
    width: 420px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9.5px;
    color: #111;
    letter-spacing: 1.6px;
    line-height: 1.6;
    white-space: pre-line;
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
  ${buildCatDateOverlays(d.categoria || "", d)}

  <!-- OBSERVATIONS -->
  <div class="overlay f-obs">${d.observacoes || ""}</div>

  <!-- SIGNING INFO -->
  <div class="overlay f-espelho">${espelhoClean}</div>
  <div class="overlay f-renach">${renachClean}</div>
  <div class="overlay f-local">${d.cidade_estado || ""}</div>

  <!-- VERTICAL REGISTRATION (bottom) -->
  <div class="overlay reg-vert-bot">${d.registro || ""}</div>

  <!-- STATE NAME -->
  <div class="overlay f-estado">${d.estado_extenso || ""}</div>

  <!-- MRZ -->
  <div class="overlay mrz-overlay">${mrz.line1}<br>${mrz.line2}<br>${mrz.line3}</div>
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
      validade_cat_a: body.validade_cat_a || "",
      validade_cat_b: body.validade_cat_b || "",
      validade_cat_c: body.validade_cat_c || "",
      validade_cat_d: body.validade_cat_d || "",
      validade_cat_e: body.validade_cat_e || "",
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
