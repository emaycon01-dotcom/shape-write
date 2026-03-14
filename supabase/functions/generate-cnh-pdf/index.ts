import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_ID = "A1AC7D64-938D-4DD5-8375-1232F9BF6D67";
const PDFMONKEY_API_URL = "https://api.pdfmonkey.io/api/v1/documents";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PDFMONKEY_API_KEY = Deno.env.get("PDFMONKEY_API_KEY");
    if (!PDFMONKEY_API_KEY) {
      throw new Error("PDFMONKEY_API_KEY is not configured");
    }

    const body = await req.json();

    // Build payload matching template placeholders
    const payload: Record<string, any> = {
      nome_completo: body.nome_completo || "",
      cpf: body.cpf || "",
      rg: body.rg || "",
      data_nascimento: body.data_nascimento || "",
      genero: body.genero || "",
      nacionalidade: body.nacionalidade || "",
      registro: body.registro || "",
      categoria: body.categoria || "",
      data_primeira_habilitacao: body.data_primeira_habilitacao || "",
      data_emissao: body.data_emissao || "",
      data_validade: body.data_validade || "",
      renach: body.renach || "",
      codigo_seguranca: body.codigo_seguranca || "",
      numero_espelho: body.numero_espelho || "",
      cidade_estado: body.cidade_estado || "",
      estado_extenso: body.estado_extenso || "",
      nome_pai: body.nome_pai || "",
      nome_mae: body.nome_mae || "",
    };

    if (body.foto_base64) {
      payload.foto = body.foto_base64.startsWith("data:")
        ? body.foto_base64
        : `data:image/png;base64,${body.foto_base64}`;
    }
    if (body.assinatura_base64) {
      payload.assinatura = body.assinatura_base64.startsWith("data:")
        ? body.assinatura_base64
        : `data:image/png;base64,${body.assinatura_base64}`;
    }

    console.log("Creating PDFMonkey document with template:", TEMPLATE_ID);

    // Create document via PDFMonkey API
    const createRes = await fetch(PDFMONKEY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PDFMONKEY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document: {
          document_template_id: TEMPLATE_ID,
          payload,
          status: "pending",
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`PDFMonkey create error [${createRes.status}]: ${errText}`);
    }

    const createData = await createRes.json();
    const docId = createData?.document?.id;

    if (!docId) {
      throw new Error("No document ID returned from PDFMonkey");
    }

    console.log("PDFMonkey document created:", docId);

    // Poll for completion (max 60s)
    const maxAttempts = 30;
    let pdfUrl: string | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const statusRes = await fetch(`${PDFMONKEY_API_URL}/${docId}`, {
        headers: { Authorization: `Bearer ${PDFMONKEY_API_KEY}` },
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      const status = statusData?.document?.status;

      console.log(`Poll ${i + 1}: status=${status}`);

      if (status === "success") {
        pdfUrl = statusData.document.download_url;
        break;
      } else if (status === "failure") {
        throw new Error(
          `PDFMonkey generation failed: ${JSON.stringify(statusData.document.failure_cause)}`
        );
      }
    }

    if (!pdfUrl) {
      throw new Error("PDF generation timed out after 60 seconds");
    }

    return new Response(
      JSON.stringify({ success: true, pdfUrl }),
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
