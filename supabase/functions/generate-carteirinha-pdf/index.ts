import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const uint8ArrayToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      tipo,
      numero_registro,
      nome_completo,
      cpf,
      data_nascimento,
      cidade,
      uf,
      data_formacao,
      data_validade,
      contato_emergencia_1,
      contato_emergencia_2,
      foto_base64,
      template_pdf_base64,
    } = body;

    if (!template_pdf_base64) {
      return new Response(
        JSON.stringify({ error: "Template PDF base64 é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode the template PDF
    const pdfBase64Clean = template_pdf_base64.replace(/^data:application\/pdf;base64,/, "");
    const pdfBytes = Uint8Array.from(atob(pdfBase64Clean), (c) => c.charCodeAt(0));

    // Import pdf-lib
    const { PDFDocument, rgb, StandardFonts } = await import("npm:pdf-lib@1.17.1");

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { width, height } = page.getSize();

    // Alignment page dimensions (source coordinate system)
    const ALIGN_W = 794;
    const ALIGN_H = 1123;
    const scaleX = width / ALIGN_W;
    const scaleY = height / ALIGN_H;

    console.log(`PDF dimensions: ${width}x${height}, scale: ${scaleX}x${scaleY}`);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Load saved field positions or use defaults
    const storageKeys: Record<string, string> = {
      bombeiro: "carteirinha-bombeiro-field-positions",
      porteiro: "carteirinha-porteiro-field-positions",
      "agente-financeiro": "carteirinha-agente-field-positions",
    };

    // Default positions in alignment-page coordinates (top-left origin, 794x1123)
    const rawPositions: Record<string, { x: number; y: number; fontSize: number }> = {
      numero_registro: { x: 297, y: 141, fontSize: 25 },
      nome: { x: 72, y: 304, fontSize: 25 },
      cpf: { x: 72, y: 382, fontSize: 25 },
      nascimento: { x: 92, y: 455, fontSize: 25 },
      cidade_uf: { x: 238, y: 453, fontSize: 25 },
      formacao: { x: 71, y: 649, fontSize: 25 },
      validade: { x: 586, y: 218, fontSize: 25 },
      emergencia1: { x: 123, y: 807, fontSize: 25 },
      emergencia2: { x: 467, y: 807, fontSize: 25 },
    };

    // Default photo position in alignment-page coordinates
    let rawPhoto = { x: 52, y: 62, w: 155, h: 211 };

    // If alignment positions are provided in the body, use them
    if (body.field_positions) {
      try {
        const fp = typeof body.field_positions === "string" ? JSON.parse(body.field_positions) : body.field_positions;
        for (const [key, val] of Object.entries(fp)) {
          if (key === "photo") {
            const v = val as { x: number; y: number; w?: number; h?: number };
            rawPhoto = { x: v.x, y: v.y, w: v.w || 82, h: v.h || 110 };
            continue;
          }
          const v = val as { x: number; y: number; fontSize: number };
          rawPositions[key] = { x: v.x, y: v.y, fontSize: v.fontSize };
        }
      } catch {
        // ignore parse errors, use defaults
      }
    }

    // Convert from alignment-page coords (top-left) to PDF coords (bottom-left) with scaling
    const positions: Record<string, { x: number; y: number; fontSize: number }> = {};
    for (const [key, raw] of Object.entries(rawPositions)) {
      const scaledFontSize = raw.fontSize * scaleY;
      positions[key] = {
        x: raw.x * scaleX,
        y: height - (raw.y * scaleY) - scaledFontSize,
        fontSize: scaledFontSize,
      };
    }

    const black = rgb(0, 0, 0);

    // Draw text fields
    const drawText = (text: string, key: string) => {
      const pos = positions[key];
      if (!pos || !text) return;
      page.drawText(text, {
        x: pos.x,
        y: pos.y,
        size: pos.fontSize,
        font: fontBold,
        color: black,
      });
    };

    drawText(numero_registro || "", "numero_registro");
    drawText(nome_completo || "", "nome");
    drawText(cpf || "", "cpf");
    drawText(data_nascimento || "", "nascimento");
    drawText(`${cidade || ""}, ${uf || ""}`, "cidade_uf");
    drawText(data_formacao || "", "formacao");
    drawText(data_validade || "", "validade");
    drawText(contato_emergencia_1 || "", "emergencia1");
    drawText(contato_emergencia_2 || "", "emergencia2");

    // Embed photo if provided
    if (foto_base64) {
      try {
        const photoClean = foto_base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
        const photoBytes = Uint8Array.from(atob(photoClean), (c) => c.charCodeAt(0));

        let image;
        if (foto_base64.includes("image/png")) {
          image = await pdfDoc.embedPng(photoBytes);
        } else {
          image = await pdfDoc.embedJpg(photoBytes);
        }

        const scaledPhotoW = rawPhoto.w * scaleX;
        const scaledPhotoH = rawPhoto.h * scaleY;
        const scaledPhotoX = rawPhoto.x * scaleX;
        const scaledPhotoY = height - (rawPhoto.y * scaleY) - scaledPhotoH;

        page.drawImage(image, {
          x: scaledPhotoX,
          y: scaledPhotoY,
          width: scaledPhotoW,
          height: scaledPhotoH,
        });
      } catch (e) {
        console.error("Error embedding photo:", e);
      }
    }

    const pdfResultBytes = await pdfDoc.save();
    const resultBase64 = uint8ArrayToBase64(pdfResultBytes);
    const pdfDataUrl = `data:application/pdf;base64,${resultBase64}`;

    return new Response(
      JSON.stringify({ pdfBase64: pdfDataUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating carteirinha PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao gerar PDF" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
