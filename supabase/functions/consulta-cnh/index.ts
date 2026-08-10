import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authUser) {
      return json({ error: "Não autorizado" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const cpfInput = String(body?.cpf || "").trim();
    const digits = onlyDigits(cpfInput);

    if (digits.length !== 11) {
      return json({ error: "CPF inválido" }, 400);
    }

    const externalUrl = Deno.env.get("CONSULTA_CNH_SUPABASE_URL") || "https://mpiuedfqjtsrffdwwwfz.supabase.co";
    const externalKey = Deno.env.get("CONSULTA_CNH_SUPABASE_KEY");

    if (!externalKey) {
      console.error("consulta-cnh: CONSULTA_CNH_SUPABASE_KEY não configurado");
      return json({ error: "Configuração incompleta no servidor" }, 500);
    }

    const fields = "nome_completo,cpf,rg,registro,categoria,data_nascimento,data_emissao,data_validade,renach,numero_espelho,cidade_estado,estado_extenso,parte1,parte2,parte3,parte4";
    const headers: HeadersInit = {
      apikey: externalKey,
      Authorization: `Bearer ${externalKey}`,
    };

    for (const cpf of [formatCpf(cpfInput), digits]) {
      const url = `${externalUrl}/rest/v1/cnh?select=${fields}&cpf=eq.${cpf}&limit=1`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0) {
          return json({ found: true, data: rows[0] });
        }
      }
    }

    return json({ found: false, data: null });
  } catch (err) {
    console.error("consulta-cnh error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
