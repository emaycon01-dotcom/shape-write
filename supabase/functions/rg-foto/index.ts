// Serve publicamente a foto 3x4 do RG (usada pelo portal de validação via <img src>)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").replace(/[^A-Za-z0-9\-_]/g, "");
  if (!id) return new Response("missing id", { status: 400, headers: cors });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await admin.storage.from("documents-pdf").download(`fotos-rg/${id}.png`);

  if (error || !data) {
    return new Response("not found", { status: 404, headers: cors });
  }

  return new Response(await data.arrayBuffer(), {
    headers: {
      ...cors,
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
