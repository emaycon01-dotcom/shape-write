import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENDPOINT = "https://unipbrdiploma.site/api/public/register-diploma-unip";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const apiKey = Deno.env.get("DIPLOMA_UNIP_API_KEY");
    if (!apiKey) throw new Error("DIPLOMA_UNIP_API_KEY não configurada");

    const body = await req.json();

    const documento_id = String(body.documento_id || "").trim();
    const nome_aluno = String(body.nome_aluno || "").trim();
    if (!documento_id || !nome_aluno) {
      return new Response(
        JSON.stringify({ success: false, error: "documento_id e nome_aluno são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Base64 puro — sem o prefixo data:application/pdf;base64,
    const pdf_base64 = String(body.pdf_base64 || "").replace(/^data:[^;]+;base64,/, "");

    const payload = {
      documento_id,
      nome_aluno,
      ra: body.ra || "",
      cpf_mascarado: body.cpf_mascarado || "",
      curso_nome: body.curso_nome || "",
      titulo_conferido: body.titulo_conferido || "",
      numero_registro: body.numero_registro || "",
      livro: body.livro || "",
      fls: body.fls || "",
      processo: body.processo || "",
      data_registro: body.data_registro || "",
      status: "ativo",
      dados_completos: body.dados_completos ?? {},
      pdf_base64,
    };

    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const text = await res.text();
        let json: Record<string, unknown> = {};
        try { json = JSON.parse(text); } catch { /* resposta não-JSON */ }

        if (res.ok) {
          return new Response(
            JSON.stringify({
              success: true,
              documento_id,
              validation_url:
                (json.validation_url as string) ||
                `https://unipbrdiploma.site/validar?id=${encodeURIComponent(documento_id)}`,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        lastError = `HTTP ${res.status}: ${text.slice(0, 300)}`;
        // 400/401 são erros definitivos — não adianta repetir
        if (res.status === 400 || res.status === 401) break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
      if (attempt < 3) await sleep(attempt * 800);
    }

    console.error(`[register-diploma-unip] falha ao registrar ${documento_id}: ${lastError}`);
    return new Response(
      JSON.stringify({ success: false, documento_id, error: lastError }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[register-diploma-unip]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
