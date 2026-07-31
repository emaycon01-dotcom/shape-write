import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PBKDF2-SHA256 com salt aleatório (KDF lento) — substitui o SHA-256 simples
const PBKDF2_ITER = 210_000;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function legacyHash(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + pin);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

async function pbkdf2(pin: string, saltHex: string, iter: number): Promise<string> {
  const salt = new Uint8Array((saltHex.match(/.{2}/g) || []).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  return toHex(bits);
}

async function hashPin(pin: string): Promise<string> {
  const saltHex = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await pbkdf2(pin, saltHex, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${saltHex}$${hash}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPin(pin: string, stored: string, userId: string): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (stored.startsWith("pbkdf2$")) {
    const [, iter, saltHex, hash] = stored.split("$");
    const calc = await pbkdf2(pin, saltHex, Number(iter));
    return { valid: timingSafeEqual(calc, hash), needsUpgrade: false };
  }
  const legacy = await legacyHash(pin, userId.slice(0, 8));
  return { valid: timingSafeEqual(legacy, stored), needsUpgrade: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, pin } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // "check" doesn't need PIN or rate limiting
    if (action === "check") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("pin_hash")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({ hasPin: !!profile?.pin_hash }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require a valid 4-digit PIN
    if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN deve ter exatamente 4 dígitos numéricos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 5 attempts per 15 minutes
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitId = `pin:${user.id}:${clientIp}`;

    await supabaseAdmin.rpc("cleanup_old_login_attempts");

    const { count } = await supabaseAdmin
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", rateLimitId)
      .eq("attempt_type", "pin")
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 15 minutos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("login_attempts").insert({
      identifier: rateLimitId,
      attempt_type: "pin",
    });


    if (action === "set") {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ pin_hash: await hashPin(pin) })
        .eq("user_id", user.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Falha ao salvar PIN" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("pin_hash")
        .eq("user_id", user.id)
        .single();

      if (!profile?.pin_hash) {
        return new Response(JSON.stringify({ error: "PIN não configurado", needsSetup: true }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { valid, needsUpgrade } = await verifyPin(pin, profile.pin_hash, user.id);
      if (valid && needsUpgrade) {
        // Migra hashes antigos (SHA-256) para PBKDF2 no primeiro acerto
        const upgraded = await hashPin(pin);
        await supabaseAdmin.from("profiles").update({ pin_hash: upgraded }).eq("user_id", user.id);
      }
      if (!valid) {
        return new Response(JSON.stringify({ error: "PIN incorreto", valid: false }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ valid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
