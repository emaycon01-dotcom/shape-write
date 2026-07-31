const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const siteKey = Deno.env.get("TURNSTILE_SITE_KEY") ?? "";
  const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";

  try {
    const body = await req.json().catch(() => ({}));
    const action = String((body as Record<string, unknown>).action ?? "verify");

    // Site key is public by design (rendered in the widget)
    if (action === "config") {
      return json({ siteKey, enabled: Boolean(siteKey && secretKey) });
    }

    // If captcha isn't configured yet, don't lock users out
    if (!siteKey || !secretKey) return json({ success: true, skipped: true });

    const token = String((body as Record<string, unknown>).token ?? "");
    if (!token || token.length > 4096) {
      return json({ success: false, error: "invalid_token" }, 400);
    }

    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";

    const form = new URLSearchParams();
    form.set("secret", secretKey);
    form.set("response", token);
    if (ip) form.set("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const result = await res.json();

    if (!result.success) {
      return json({ success: false, error: "captcha_failed" }, 403);
    }

    return json({ success: true });
  } catch {
    return json({ success: false, error: "internal_error" }, 500);
  }
});
