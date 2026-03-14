import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function uploadBase64ToPdfCo(
  apiKey: string,
  base64Data: string,
  fileName: string
): Promise<string | null> {
  if (!base64Data) return null;

  // Remove data URI prefix if present
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");

  // Get presigned URL for upload
  const presignRes = await fetch(
    "https://api.pdf.co/v1/file/upload/get-presigned-url",
    {
      method: "GET",
      headers: { "x-api-key": apiKey },
    }
  );

  if (!presignRes.ok) {
    const errText = await presignRes.text();
    console.error("Presign error:", errText);
    return null;
  }

  const presignData = await presignRes.json();
  if (!presignData.presignedUrl || !presignData.url) {
    console.error("No presigned URL returned:", presignData);
    return null;
  }

  // Decode base64 to binary
  const binaryStr = atob(cleanBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Upload to presigned URL
  const uploadRes = await fetch(presignData.presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error("Upload error:", errText);
    return null;
  }

  return presignData.url;
}

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
      foto_base64,
      assinatura_base64,
    } = body;

    // Upload images to PDF.co if provided
    const [fotoUrl, assinaturaUrl] = await Promise.all([
      foto_base64
        ? uploadBase64ToPdfCo(PDFCO_API_KEY, foto_base64, "foto.png")
        : Promise.resolve(null),
      assinatura_base64
        ? uploadBase64ToPdfCo(PDFCO_API_KEY, assinatura_base64, "assinatura.png")
        : Promise.resolve(null),
    ]);

    console.log("Uploaded foto URL:", fotoUrl);
    console.log("Uploaded assinatura URL:", assinaturaUrl);

    // Build text annotations
    const textAnnotations = [
      { text: nome_completo || "", x: 0, y: 0, size: 12, pages: "0", type: "TextField", id: "NOME_COMPLETO" },
      { text: cpf || "", x: 0, y: 0, size: 12, pages: "0", type: "TextField", id: "CPF" },
      { text: rg || "", x: 0, y: 0, size: 12, pages: "0", type: "TextField", id: "RG" },
      { text: data_nascimento || "", x: 0, y: 0, size: 12, pages: "0", type: "TextField", id: "DATA_NASCIMENTO" },
      { text: categoria || "", x: 0, y: 0, size: 12, pages: "0", type: "TextField", id: "CATEGORIA" },
      { text: renach || "", x: 0, y: 0, size: 12, pages: "0", type: "TextField", id: "RENACH" },
    ];

    // Build image annotations
    const imageAnnotations: any[] = [];

    if (fotoUrl) {
      imageAnnotations.push({
        url: fotoUrl,
        x: 0,
        y: 0,
        width: 100,
        height: 130,
        pages: "0",
        type: "image",
        id: "FOTO",
      });
    }

    if (assinaturaUrl) {
      imageAnnotations.push({
        url: assinaturaUrl,
        x: 0,
        y: 0,
        width: 180,
        height: 50,
        pages: "0",
        type: "image",
        id: "ASSINATURA",
      });
    }

    const allAnnotations = [...textAnnotations, ...imageAnnotations];

    // Build images array for the API
    const images: any[] = [];
    if (fotoUrl) {
      images.push({
        url: fotoUrl,
        x: 0,
        y: 0,
        width: 100,
        height: 130,
        pages: "0",
      });
    }
    if (assinaturaUrl) {
      images.push({
        url: assinaturaUrl,
        x: 0,
        y: 0,
        width: 180,
        height: 50,
        pages: "0",
      });
    }

    // Build the request body
    const requestBody: any = {
      url: "filetoken://2c190eb74ebbaee55d25c452481b44714335fe67cff15d128f",
      annotations: textAnnotations,
      async: false,
    };

    // Add images if available
    if (images.length > 0) {
      requestBody.images = images;
    }

    console.log("PDF.co request body:", JSON.stringify(requestBody));

    // Call PDF.co API
    const pdfcoResponse = await fetch(
      "https://api.pdf.co/v1/pdf/edit/add",
      {
        method: "POST",
        headers: {
          "x-api-key": PDFCO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!pdfcoResponse.ok) {
      const errorText = await pdfcoResponse.text();
      throw new Error(`PDF.co API error [${pdfcoResponse.status}]: ${errorText}`);
    }

    const pdfcoData = await pdfcoResponse.json();

    if (pdfcoData.error) {
      throw new Error(`PDF.co error: ${JSON.stringify(pdfcoData)}`);
    }

    const resultUrl = pdfcoData?.url;

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: resultUrl,
        fotoUrl,
        assinaturaUrl,
        raw: pdfcoData,
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
