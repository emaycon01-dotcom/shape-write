import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Backend principal do app (São Paulo). Quando esta função roda no backend
 * secundário (apenas montagem/validação de documento), o token do cliente é
 * emitido lá — então aceitamos os dois emissores.
 * A chave abaixo é a chave anônima pública do projeto, não um segredo.
 */
const PRIMARY_AUTH_URL = "https://tfelypvzmdokfcgupmls.supabase.co";
const PRIMARY_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZWx5cHZ6bWRva2ZjZ3VwbWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA0MTIsImV4cCI6MjEwMTk1NjQxMn0.Ipz2FoPU86qLbh9GMeh1Zt3H7qvJRCr5p6igv1-0rlk";

async function userFrom(url: string, key: string, authHeader: string): Promise<string | null> {
  try {
    const supabase = createClient(url, key, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

export async function authenticateRequest(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  const unauthorized = () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (!authHeader?.startsWith("Bearer ")) return unauthorized();

  const localUrl = Deno.env.get("SUPABASE_URL")!;
  const localKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let userId = await userFrom(localUrl, localKey, authHeader);

  if (!userId && localUrl !== PRIMARY_AUTH_URL) {
    userId = await userFrom(PRIMARY_AUTH_URL, PRIMARY_ANON_KEY, authHeader);
  }

  if (!userId) return unauthorized();
  return { userId };
}
