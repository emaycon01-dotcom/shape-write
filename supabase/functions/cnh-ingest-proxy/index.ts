// Proxy seguro: grava a CNH gerada na tabela `cnh` do app externo.
// A chave de escrita fica apenas no servidor, nunca no navegador.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateRequest } from "../_shared/auth.ts";

const EXTERNAL_URL = "https://mpiuedfqjtsrffdwwwfz.supabase.co";

// Chave de serviço do projeto externo (cofre). Nunca vai para o navegador.
const WRITE_KEY = Deno.env.get("CNH_EXTERNAL_SERVICE_KEY") ?? "";

// Token para sites parceiros que geram CNH e precisam gravar na mesma tabela.
const PARTNER_TOKEN = Deno.env.get("CNH_PARTNER_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!WRITE_KEY) return json({ error: "missing_service_key" }, 500);

  // Dois caminhos de acesso: token de parceiro (outros sites) ou sessão logada.
  const partner = req.headers.get("x-partner-token") ?? "";
  const isPartner = PARTNER_TOKEN.length > 0 && partner === PARTNER_TOKEN;

  if (!isPartner) {
    if (partner) return json({ error: "invalid_partner_token" }, 401);
    const auth = await authenticateRequest(req, corsHeaders);
    if (auth instanceof Response) return auth;
  }


  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const registros = Array.isArray(payload?.registros) ? payload.registros : null;
  const imagem = typeof payload?.imagem === "string" ? payload.imagem : "";
  if (!registros || registros.length === 0 || registros.length > 2) {
    return json({ error: "invalid_registros" }, 400);
  }
  if (!imagem.startsWith("data:image/jpeg;base64,") || imagem.length > 16_000_000) {
    return json({ error: "invalid_imagem" }, 400);
  }
  for (const r of registros) {
    if (!r || typeof r !== "object" || !(r as Record<string, unknown>).cpf) {
      return json({ error: "invalid_registro" }, 400);
    }
  }

  try {
    const headers = {
      "Content-Type": "application/json",
      apikey: WRITE_KEY,
      Authorization: `Bearer ${WRITE_KEY}`,
    };

    // Um CPF pode gerar uma renovação/segunda via. POST em lote criava linhas
    // duplicadas (ou falhava quando havia índice único), e o validador podia
    // encontrar a versão antiga com limit=1. Atualizamos quando já existe e
    // inserimos somente quando for realmente novo.
    for (const registro of registros as Record<string, unknown>[]) {
      const cpf = String(registro.cpf ?? "");
      const expandedRegistro = {
        ...registro,
        parte1: imagem,
        parte2: imagem,
        parte3: imagem,
        parte4: imagem,
      };
      const filter = `cpf=eq.${encodeURIComponent(cpf)}`;
      const lookup = await fetch(`${EXTERNAL_URL}/rest/v1/cnh?select=cpf&${filter}&limit=1`, {
        headers,
      });
      if (!lookup.ok) {
        const detail = (await lookup.text()).slice(0, 500);
        console.error(`cnh-ingest lookup [${lookup.status}]:`, detail);
        return json({ error: "upstream_lookup_error", status: lookup.status }, 502);
      }

      const existing = await lookup.json();
      const method = Array.isArray(existing) && existing.length > 0 ? "PATCH" : "POST";
      const url = method === "PATCH"
        ? `${EXTERNAL_URL}/rest/v1/cnh?${filter}`
        : `${EXTERNAL_URL}/rest/v1/cnh`;
      const upstream = await fetch(url, {
        method,
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(expandedRegistro),
      });

      if (!upstream.ok) {
        const detail = (await upstream.text()).slice(0, 500);
        console.error(`cnh-ingest ${method} [${upstream.status}]:`, detail);
        return json({ error: "upstream_write_error", status: upstream.status }, 502);
      }
    }
    return json({ ok: true, registros: registros.length });
  } catch (err) {
    console.error("cnh-ingest proxy failed:", err);
    return json({ error: String(err) }, 500);
  }
});
