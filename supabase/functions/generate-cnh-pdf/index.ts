import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PDFCO_API_KEY = Deno.env.get("PDFCO_API_KEY");
    if (!PDFCO_API_KEY) {
      throw new Error("PDFCO_API_KEY is not configured");
    }

    const body = await req.json();
    const {
      nome_completo,
      cpf,
      rg,
      data_nascimento,
      categoria,
      renach,
    } = body;

    // Build the field mappings for PDF.co
    const fields = [
      { fieldName: "NOME_COMPLETO", text: nome_completo || "" },
      { fieldName: "CPF", text: cpf || "" },
      { fieldName: "RG", text: rg || "" },
      { fieldName: "DATA_NASCIMENTO", text: data_nascimento || "" },
      { fieldName: "CATEGORIA", text: categoria || "" },
      { fieldName: "RENACH", text: renach || "" },
    ];

    // Call PDF.co API to fill the PDF template
    const pdfcoResponse = await fetch(
      "https://api.pdf.co/v1/pdf/edit/add",
      {
        method: "POST",
        headers: {
          "x-api-key": PDFCO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "filetoken://2c190eb74ebbaee55d25c452481b44714335fe67cff15d128f",
          annotations: fields.map((f) => ({
            text: f.text,
            x: 0,
            y: 0,
            size: 12,
            pages: "0",
            type: "TextField",
            id: f.fieldName,
          })),
          async: false,
        }),
      }
    );

    if (!pdfcoResponse.ok) {
      const errorText = await pdfcoResponse.text();
      throw new Error(
        `PDF.co API error [${pdfcoResponse.status}]: ${errorText}`
      );
    }

    const pdfcoData = await pdfcoResponse.json();

    if (pdfcoData.error) {
      throw new Error(`PDF.co error: ${JSON.stringify(pdfcoData)}`);
    }

    // Try filling form fields approach
    const fillResponse = await fetch(
      "https://api.pdf.co/v1/pdf/edit/add",
      {
        method: "POST",
        headers: {
          "x-api-key": PDFCO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "filetoken://2c190eb74ebbaee55d25c452481b44714335fe67cff15d128f",
          fields: fields,
          async: false,
        }),
      }
    );

    const fillData = await fillResponse.json();

    // Return whichever worked
    const resultUrl = fillData?.url || pdfcoData?.url;

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: resultUrl,
        rawAnnotation: pdfcoData,
        rawFill: fillData,
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
