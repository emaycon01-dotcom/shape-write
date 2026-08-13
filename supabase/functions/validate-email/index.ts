import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Domínios descartáveis/temporários mais comuns — geram devolução garantida.
const DISPOSABLE = new Set([
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "guerrillamail.info", "sharklasers.com", "yopmail.com",
  "trashmail.com", "getnada.com", "dispostable.com", "fakeinbox.com",
  "maildrop.cc", "mailnesia.com", "throwawaymail.com", "moakt.com",
  "emailondeck.com", "spamgourmet.com", "mytemp.email", "tempr.email",
  "inboxkitten.com", "mail.tm", "minuteinbox.com", "temporary-mail.net",
]);

// Erros de digitação frequentes em provedores populares.
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gmails.com": "gmail.com", "gemail.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com",
  "yahho.com": "yahoo.com", "yaho.com": "yahoo.com",
  "icloud.con": "icloud.com", "bol.com": "bol.com.br", "uol.com": "uol.com.br",
};

const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

async function hasMx(domain: string): Promise<boolean> {
  const query = async (type: "MX" | "A") => {
    try {
      const res = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
        { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return null;
      const json = await res.json();
      return Array.isArray(json.Answer) && json.Answer.length > 0;
    } catch {
      return null;
    }
  };

  const mx = await query("MX");
  if (mx === true) return true;
  const a = await query("A");
  if (a === true) return true;
  // Indisponibilidade de DNS não pode bloquear cadastro legítimo.
  if (mx === null && a === null) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { email } = await req.json();
    const value = String(email || "").trim().toLowerCase();

    if (!EMAIL_RE.test(value)) {
      return json({ valid: false, reason: "E-mail inválido. Verifique o endereço digitado." });
    }

    const domain = value.split("@")[1];

    if (TYPOS[domain]) {
      return json({
        valid: false,
        reason: `Domínio inválido. Você quis dizer @${TYPOS[domain]}?`,
        suggestion: `${value.split("@")[0]}@${TYPOS[domain]}`,
      });
    }

    if (DISPOSABLE.has(domain)) {
      return json({ valid: false, reason: "E-mails temporários não são aceitos. Use um e-mail permanente." });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      const admin = createClient(url, key);
      const { data } = await admin
        .from("suppressed_emails")
        .select("email")
        .eq("email", value)
        .maybeSingle();
      if (data) {
        return json({
          valid: false,
          reason: "Este e-mail rejeitou nossas mensagens anteriormente. Use outro endereço.",
        });
      }
    }

    if (!(await hasMx(domain))) {
      return json({ valid: false, reason: "O domínio deste e-mail não recebe mensagens." });
    }

    return json({ valid: true });
  } catch {
    // Falha interna nunca bloqueia o cadastro.
    return json({ valid: true });
  }
});
