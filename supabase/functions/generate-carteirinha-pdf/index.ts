import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { PDFDocument, rgb, StandardFonts } = await import(
      "https://cdn.skypack.dev/pdf-lib@1.17.1?dts"
    );

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Load saved field positions or use defaults
    const storageKeys: Record<string, string> = {
      bombeiro: "carteirinha-bombeiro-field-positions",
      porteiro: "carteirinha-porteiro-field-positions",
      "agente-financeiro": "carteirinha-agente-field-positions",
    };

    // Default positions (will be overridden by alignment data if provided)
    const positions: Record<string, { x: number; y: number; fontSize: number }> = {
      numero_registro: { x: 150, y: height - 80, fontSize: 8 },
      nome: { x: 150, y: height - 100, fontSize: 8 },
      cpf: { x: 150, y: height - 120, fontSize: 8 },
      nascimento: { x: 150, y: height - 140, fontSize: 8 },
      cidade_uf: { x: 150, y: height - 160, fontSize: 8 },
      formacao: { x: 150, y: height - 180, fontSize: 8 },
      emergencia1: { x: 150, y: height - 200, fontSize: 7 },
      emergencia2: { x: 150, y: height - 220, fontSize: 7 },
    };

    // If alignment positions are provided in the body, use them
    if (body.field_positions) {
      try {
        const fp = typeof body.field_positions === "string" ? JSON.parse(body.field_positions) : body.field_positions;
        for (const [key, val] of Object.entries(fp)) {
          if (key === "photo") continue; // photo handled separately
          const v = val as { x: number; y: number; fontSize: number };
          positions[key] = {
            x: v.x,
            y: height - v.y - v.fontSize, // Convert from top-left to bottom-left coordinate
            fontSize: v.fontSize,
          };
        }
      } catch {
        // ignore parse errors, use defaults
      }
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

        const photoPos = body.field_positions?.photo || { x: 30, y: 80, w: 82, h: 110 };
        page.drawImage(image, {
          x: photoPos.x,
          y: height - photoPos.y - (photoPos.h || 110),
          width: photoPos.w || 82,
          height: photoPos.h || 110,
        });
      } catch (e) {
        console.error("Error embedding photo:", e);
      }
    }

    const pdfResultBytes = await pdfDoc.save();
    const resultBase64 = btoa(String.fromCharCode(...pdfResultBytes));
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
