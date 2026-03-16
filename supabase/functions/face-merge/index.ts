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
    const { baseImage, referenceImage, intensity } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const hasReference = !!referenceImage;
    const pct = Math.round((intensity ?? 50));

    let prompt: string;
    if (hasReference) {
      prompt = `You are a face morphing expert. Merge these two face images together. The first image is the base face, and the second image is the reference face. Apply a ${pct}% blend intensity — at 0% keep the base face unchanged, at 100% make it look exactly like the reference face. At ${pct}%, smoothly blend the facial features (face shape, eyes, nose, mouth, jawline) proportionally. Keep the result photorealistic and natural-looking. Output ONLY the merged face image.`;
    } else {
      prompt = `You are a face adjustment expert. Take this face image and apply a ${pct}% facial structure adjustment. Subtly reshape the face proportions — adjust the jawline, cheekbones, and facial symmetry to create a more refined look. At 0% keep original, at 100% apply maximum reshaping. Currently at ${pct}%. Keep the result photorealistic and natural. Output ONLY the adjusted face image.`;
    }

    const content: any[] = [{ type: "text", text: prompt }];
    content.push({
      type: "image_url",
      image_url: { url: baseImage },
    });
    if (hasReference) {
      content.push({
        type: "image_url",
        image_url: { url: referenceImage },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
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
