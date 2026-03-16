import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseImage, referenceImage, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const hasReference = !!referenceImage;

    let prompt: string;
    if (hasReference && mode === "merge") {
      prompt = `You are a professional face swap expert. Take the face from the SECOND image (reference) and place it onto the FIRST image (base), replacing the base face completely. The output must:
- Use the reference face's eyes, nose, mouth, jawline, skin tone and all facial features
- Keep the base image's hair, body, clothing, background and pose
- Match lighting, shadows and skin color seamlessly
- Look completely photorealistic with no artifacts, seams or distortions
- The result should look like the reference person is in the base photo
Output ONLY the final face-swapped image, nothing else.`;
    } else {
      prompt = `You are a professional portrait retouching expert. Take this face photo and enhance it:
- Improve facial symmetry and proportions
- Smooth skin while keeping natural texture
- Enhance jawline definition
- Improve overall facial structure
- Keep the result looking natural and photorealistic
Output ONLY the enhanced face image.`;
    }

    const content: any[] = [{ type: "text", text: prompt }];
    content.push({ type: "image_url", image_url: { url: baseImage } });
    if (hasReference) {
      content.push({ type: "image_url", image_url: { url: referenceImage } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("AI gateway error:", response.status, txt);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("Nenhuma imagem gerada pelo modelo");
    }

    return new Response(JSON.stringify({ image: imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("face-merge error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
