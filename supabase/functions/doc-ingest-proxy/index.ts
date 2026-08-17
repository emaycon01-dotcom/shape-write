// Proxy seguro: encaminha documentos (rg/cha) para o app externo de consulta.
// O token de ingestão fica apenas no servidor, nunca no navegador.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateRequest } from "../_shared/auth.ts";

const TARGET_URL = "https://zxkbzmmctfznfxddnzlc.supabase.co/functions/v1/doc-ingest";
const INGEST_TOKEN = Deno.env.get("DOC_INGEST_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!INGEST_TOKEN) {
    console.error("doc-ingest: DOC_INGEST_TOKEN ausente neste backend");
    return json({ error: "missing_ingest_token" }, 500);
  }

  // Exige sessão válida: o token de ingestão nunca pode ser usado anonimamente.
  const auth = await authenticateRequest(req, corsHeaders);
  if (auth instanceof Response) return auth;

  let payload: { tabela?: string; dados?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const tabela = payload?.tabela;
  const dados = payload?.dados;
  if (tabela !== "rg" && tabela !== "cha") return json({ error: "invalid_tabela" }, 400);
  if (!dados || typeof dados !== "object" || !dados.documento_id) {
    return json({ error: "invalid_dados" }, 400);
  }

  // O portal de RG consome data URLs de imagem (PNG ou JPEG). Recusar imagens
  // incompletas aqui evita confirmar um registro com fotos quebradas depois.
  if (tabela === "rg") {
    const images = [dados.parte1, dados.parte2, dados.parte3, dados.parte4]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    // O portal só consegue produzir as quatro visualizações quando todas as
    // colunas chegam preenchidas. Não confirme registros parciais: foi isso que
    // anteriormente permitiu salvar apenas parte1 e ocultou a regressão.
    if (images.length !== 4) {
      return json({ error: "missing_rg_images", detail: "O RG exige parte1, parte2, parte3 e parte4 completas." }, 400);
    }
    if (images.some((value) => !/^data:image\/(png|jpeg);base64,/.test(value) || value.length < 1_000)) {
      return json({ error: "invalid_rg_image_format", detail: "As imagens do RG devem ser data URLs PNG/JPEG completas." }, 400);
    }
  }


  try {
    const upstream = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-token": INGEST_TOKEN,
      },
      body: JSON.stringify({ tabela, dados }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error(`doc-ingest upstream [${upstream.status}]:`, text.slice(0, 500));
      return json({ error: "upstream_error", status: upstream.status, detail: text.slice(0, 500) }, 502);
    }
    const imageSizes = [dados.parte1, dados.parte2, dados.parte3, dados.parte4]
      .map((value) => typeof value === "string" ? value.length : 0);
    console.log(`doc-ingest ok [${tabela}] ${String(dados.documento_id)} imagens=${imageSizes.join(",")}: ${text.slice(0, 200)}`);
    return json({ ok: true, upstream: text.slice(0, 500) });
  } catch (err) {
    console.error("doc-ingest proxy failed:", err);
    return json({ error: String(err) }, 500);
  }
});
