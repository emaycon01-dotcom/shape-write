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
      rg,
      tipo_sanguineo,
      data_nascimento,
      cidade,
      uf,
      data_formacao,
      data_validade,
      data_expedicao_1,
      data_expedicao_2,
      contato_emergencia_1,
      contato_emergencia_2,
      foto_base64,
      template_pdf_base64,
      // operador-maquinas specific fields
      rg_orgao_uf,
      categoria,
      filiacao,
      equipamento,
      nivel,
      data_emissao,
      // seguranca-escolar specific fields
      termino_curso,
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

    if (tipo === "bombeiro-militar" || tipo === "operador-maquinas" || tipo === "seguranca-escolar") {
      // For seguranca-escolar: page 0 = frente, page 1 = verso
      // For others: page 0 = verso, page 1 = frente
      const versoPage = tipo === "seguranca-escolar" ? (pages[1] ?? pages[0]) : pages[0];
      const frentePage = tipo === "seguranca-escolar" ? pages[0] : (pages[1] ?? pages[0]);

      // Default positions per tipo
      let defaultVersoPositions: Record<string, { x: number; y: number; fontSize: number }>;
      let defaultFrentePositions: Record<string, { x: number; y: number; fontSize: number }> = {};
      let rawPhoto = { x: 20, y: 79, w: 45, h: 50 };

      if (tipo === "seguranca-escolar") {
        defaultFrentePositions = {
          nome: { x: 70, y: 55, fontSize: 6 },
          cpf: { x: 70, y: 68, fontSize: 5 },
          numero_registro: { x: 70, y: 30, fontSize: 6 },
          data_expedicao: { x: 160, y: 30, fontSize: 5 },
          nascimento: { x: 70, y: 110, fontSize: 5 },
          termino_curso: { x: 160, y: 110, fontSize: 5 },
        };
        defaultVersoPositions = {
          rg: { x: 100, y: 70, fontSize: 8 },
        };
        rawPhoto = { x: 20, y: 30, w: 40, h: 50 };
      } else if (tipo === "operador-maquinas") {
        defaultVersoPositions = {
          nome: { x: 109, y: 46, fontSize: 8 },
          rg_orgao_uf: { x: 119, y: 62, fontSize: 7 },
          cpf: { x: 102, y: 77, fontSize: 7 },
          nascimento: { x: 167, y: 77, fontSize: 7 },
          categoria: { x: 200, y: 131, fontSize: 8 },
          filiacao: { x: 123, y: 99, fontSize: 7 },
          equipamento: { x: 108, y: 114, fontSize: 7 },
          nivel: { x: 204, y: 117, fontSize: 7 },
          emissao: { x: 96, y: 132, fontSize: 7 },
          validade: { x: 139, y: 132, fontSize: 7 },
        };
        rawPhoto = { x: 28, y: 46, w: 50, h: 60 };
      } else {
        defaultVersoPositions = {
          cpf: { x: 42, y: 20, fontSize: 8 },
          tipo_sanguineo: { x: 163, y: 25, fontSize: 8 },
          rg: { x: 42, y: 47, fontSize: 8 },
          data_expedicao_1: { x: 147, y: 51, fontSize: 8 },
        };
        defaultFrentePositions = {
          numero_registro: { x: 81, y: 37, fontSize: 8 },
          data_expedicao_2: { x: 161, y: 37, fontSize: 8 },
          validade: { x: 169, y: 53, fontSize: 5.2 },
          nome: { x: 97, y: 118, fontSize: 8 },
        };
      }

      let rawVersoPositions = { ...defaultVersoPositions };
      let rawFrentePositions = { ...defaultFrentePositions };

      const applyPositions = (
        source: Record<string, any> | null | undefined,
        target: Record<string, { x: number; y: number; fontSize: number }>,
      ) => {
        if (!source || typeof source !== "object") return;

        for (const [key, val] of Object.entries(source)) {
          if (key === "photo") {
            const photo = val as { x: number; y: number; w?: number; h?: number };
            if (typeof photo?.x === "number" && typeof photo?.y === "number") {
              rawPhoto = { x: photo.x, y: photo.y, w: photo.w || rawPhoto.w, h: photo.h || rawPhoto.h };
            }
            continue;
          }

          const field = val as { x: number; y: number; fontSize?: number };
          if (typeof field?.x === "number" && typeof field?.y === "number") {
            target[key] = {
              x: field.x,
              y: field.y,
              fontSize: typeof field.fontSize === "number" ? field.fontSize : target[key]?.fontSize || 5,
            };
          }
        }
      };

      if (body.field_positions) {
        try {
          const parsed = typeof body.field_positions === "string" ? JSON.parse(body.field_positions) : body.field_positions;
          applyPositions(parsed?.verso ?? parsed ?? null, rawVersoPositions);
          applyPositions(parsed?.frente ?? null, rawFrentePositions);
        } catch {
          // ignore parse errors
        }
      }

      const getPdfPositions = (
        targetPage: any,
        rawMap: Record<string, { x: number; y: number; fontSize: number }>,
      ) => {
        const { height: pageHeight } = targetPage.getSize();
        return Object.fromEntries(
          Object.entries(rawMap).map(([key, raw]) => [
            key,
            { x: raw.x, y: pageHeight - raw.y - raw.fontSize, fontSize: raw.fontSize },
          ]),
        ) as Record<string, { x: number; y: number; fontSize: number }>;
      };

      const versoPositions = getPdfPositions(versoPage, rawVersoPositions);
      const frentePositions = getPdfPositions(frentePage, rawFrentePositions);
      const black = rgb(0, 0, 0);

      const drawTextOnPage = (
        targetPage: any,
        pagePositions: Record<string, { x: number; y: number; fontSize: number }>,
        text: string,
        key: string,
      ) => {
        const pos = pagePositions[key];
        if (!pos || !text) return;
        targetPage.drawText(text, {
          x: pos.x,
          y: pos.y,
          size: pos.fontSize,
          font: fontBold,
          color: black,
        });
      };

      if (tipo === "seguranca-escolar") {
        // Frente: all fields except RG
        drawTextOnPage(frentePage, frentePositions, nome_completo || "", "nome");
        drawTextOnPage(frentePage, frentePositions, cpf || "", "cpf");
        drawTextOnPage(frentePage, frentePositions, numero_registro || "", "numero_registro");
        drawTextOnPage(frentePage, frentePositions, data_expedicao_1 || "", "data_expedicao");
        drawTextOnPage(frentePage, frentePositions, data_nascimento || "", "nascimento");
        drawTextOnPage(frentePage, frentePositions, termino_curso || "", "termino_curso");
        // Verso: only RG
        drawTextOnPage(versoPage, versoPositions, rg || "", "rg");
      } else if (tipo === "operador-maquinas") {
        drawTextOnPage(versoPage, versoPositions, nome_completo || "", "nome");
        drawTextOnPage(versoPage, versoPositions, rg_orgao_uf || "", "rg_orgao_uf");
        drawTextOnPage(versoPage, versoPositions, cpf || "", "cpf");
        drawTextOnPage(versoPage, versoPositions, data_nascimento || "", "nascimento");
        drawTextOnPage(versoPage, versoPositions, categoria || "", "categoria");
        drawTextOnPage(versoPage, versoPositions, filiacao || "", "filiacao");
        drawTextOnPage(versoPage, versoPositions, equipamento || "", "equipamento");
        drawTextOnPage(versoPage, versoPositions, nivel || "", "nivel");
        drawTextOnPage(versoPage, versoPositions, data_emissao || "", "emissao");
        drawTextOnPage(versoPage, versoPositions, data_validade || "", "validade");
      } else {
        // Bombeiro militar fields
        drawTextOnPage(versoPage, versoPositions, cpf || "", "cpf");
        drawTextOnPage(versoPage, versoPositions, tipo_sanguineo || "", "tipo_sanguineo");
        drawTextOnPage(versoPage, versoPositions, rg || "", "rg");
        drawTextOnPage(versoPage, versoPositions, data_expedicao_1 || "", "data_expedicao_1");
        drawTextOnPage(frentePage, frentePositions, numero_registro || "", "numero_registro");
        drawTextOnPage(frentePage, frentePositions, data_expedicao_2 || "", "data_expedicao_2");
        drawTextOnPage(frentePage, frentePositions, data_validade || "", "validade");
        drawTextOnPage(frentePage, frentePositions, nome_completo || "", "nome");
      }

      if (foto_base64) {
        try {
          const photoClean = foto_base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
          const photoBytes = Uint8Array.from(atob(photoClean), (c) => c.charCodeAt(0));
          const image = foto_base64.includes("image/png")
            ? await pdfDoc.embedPng(photoBytes)
            : await pdfDoc.embedJpg(photoBytes);
          const photoPage = tipo === "operador-maquinas" ? versoPage : frentePage;
          const { height: photoPageHeight } = photoPage.getSize();

          photoPage.drawImage(image, {
            x: rawPhoto.x,
            y: photoPageHeight - rawPhoto.y - rawPhoto.h,
            width: rawPhoto.w,
            height: rawPhoto.h,
          });
        } catch (e) {
          console.error("Error embedding photo:", e);
        }
      }

      const pdfResultBytes = await pdfDoc.save();
      const resultBase64 = uint8ArrayToBase64(pdfResultBytes);
      const pdfDataUrl = `data:application/pdf;base64,${resultBase64}`;

      return new Response(JSON.stringify({ pdfBase64: pdfDataUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load saved field positions or use defaults
    const storageKeys: Record<string, string> = {
      bombeiro: "carteirinha-bombeiro-field-positions",
      porteiro: "carteirinha-porteiro-field-positions",
      "agente-financeiro": "carteirinha-agente-field-positions",
    };

    // Default positions in alignment-page coordinates (top-left origin, 794x1123)
    const defaultTextPositions: Record<string, { x: number; y: number; fontSize: number }> = {
      numero_registro: { x: 287, y: 124, fontSize: 25 },
      nome: { x: 76, y: 281, fontSize: 25 },
      cpf: { x: 80, y: 357, fontSize: 25 },
      nascimento: { x: 77, y: 437, fontSize: 25 },
      cidade_uf: { x: 210, y: 436, fontSize: 25 },
      formacao: { x: 72, y: 630, fontSize: 25 },
      validade: { x: 580, y: 202, fontSize: 25 },
      emergencia1: { x: 78, y: 789, fontSize: 25 },
      emergencia2: { x: 429, y: 789, fontSize: 25 },
    };

    const agenteTextPositions: Record<string, { x: number; y: number; fontSize: number }> = {
      numero_registro: { x: 294, y: 112, fontSize: 25 },
      nome: { x: 76, y: 281, fontSize: 25 },
      cpf: { x: 134, y: 351, fontSize: 25 },
      nascimento: { x: 77, y: 437, fontSize: 25 },
      cidade_uf: { x: 210, y: 436, fontSize: 25 },
      formacao: { x: 72, y: 630, fontSize: 25 },
      validade: { x: 580, y: 202, fontSize: 25 },
      emergencia1: { x: 78, y: 789, fontSize: 25 },
      emergencia2: { x: 429, y: 789, fontSize: 25 },
    };

    const bombeiroMilitarTextPositions: Record<string, { x: number; y: number; fontSize: number }> = {
      nome: { x: 100, y: 50, fontSize: 14 },
      cpf: { x: 100, y: 120, fontSize: 14 },
      rg: { x: 100, y: 210, fontSize: 14 },
      tipo_sanguineo: { x: 450, y: 120, fontSize: 14 },
      data_expedicao_1: { x: 450, y: 210, fontSize: 14 },
      data_expedicao_2: { x: 100, y: 350, fontSize: 14 },
      numero_registro: { x: 100, y: 300, fontSize: 14 },
      validade: { x: 450, y: 300, fontSize: 14 },
    };

    let rawPositions: Record<string, { x: number; y: number; fontSize: number }>;
    if (tipo === "bombeiro-militar") {
      rawPositions = { ...bombeiroMilitarTextPositions };
    } else if (tipo === "agente-financeiro") {
      rawPositions = { ...agenteTextPositions };
    } else {
      rawPositions = { ...defaultTextPositions };
    }

    // Default photo position per tipo
    const photoDefaults: Record<string, { x: number; y: number; w: number; h: number }> = {
      bombeiro: { x: 54, y: 50, w: 142, h: 189 },
      porteiro: { x: 73, y: 38, w: 159, h: 189 },
      "agente-financeiro": { x: 68, y: 41, w: 159, h: 189 },
      "bombeiro-militar": { x: 300, y: 80, w: 120, h: 160 },
    };
    let rawPhoto = photoDefaults[tipo] || photoDefaults.bombeiro;

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

    if (tipo === "bombeiro-militar") {
      drawText(nome_completo || "", "nome");
      drawText(cpf || "", "cpf");
      drawText(rg || "", "rg");
      drawText(tipo_sanguineo || "", "tipo_sanguineo");
      drawText(data_expedicao_1 || "", "data_expedicao_1");
      drawText(data_expedicao_2 || "", "data_expedicao_2");
      drawText(numero_registro || "", "numero_registro");
      drawText(data_validade || "", "validade");
    } else {
      drawText(numero_registro || "", "numero_registro");
      drawText(nome_completo || "", "nome");
      drawText(cpf || "", "cpf");
      drawText(data_nascimento || "", "nascimento");
      drawText(`${cidade || ""}, ${uf || ""}`, "cidade_uf");
      drawText(data_formacao || "", "formacao");
      drawText(data_validade || "", "validade");
      drawText(contato_emergencia_1 || "", "emergencia1");
      drawText(contato_emergencia_2 || "", "emergencia2");
    }

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
