// Espelha o Atestado HapVida (PDF + código do QR) no banco lido pelo portal
// de validação (https://api-hapvida.xyz), que resolve o código através da
// função get-hapvida-download-url deste projeto.
//
// Depois da migração do backend principal, os códigos passaram a ser gravados
// somente lá — e o validador, que lê daqui, respondia "não encontrado".
// Esta função recebe o MESMO código gerado na emissão e replica o registro,
// de forma idempotente. Exige sessão válida do usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authenticateRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const CODE_RE = /^[A-Za-z0-9_-]{8,128}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ success: false, error: "invalid_request" }, 400);

  const auth = await authenticateRequest(req, corsHeaders);
  if (auth instanceof Response) return auth;
  const userId = auth.userId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  const code = s(body.code).trim();
  const docId = s(body.doc_id).trim() || code;
  const docType = (s(body.doc_type).trim() || "hapvida").slice(0, 40);
  const pdfBase64 = s(body.pdf_base64);

  if (!CODE_RE.test(code)) return json({ success: false, error: "invalid_code" }, 400);
  if (!pdfBase64) return json({ success: false, error: "missing_pdf_base64" }, 400);

  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(pdfBase64);
  } catch {
    return json({ success: false, error: "invalid_pdf_base64" }, 400);
  }
  if (bytes.length < 100 || bytes.length > 20 * 1024 * 1024) {
    return json({ success: false, error: "invalid_pdf_size" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Mesmo caminho usado pelo backend principal, para o QR resolver igual.
  const storagePath = `${userId}/${docId}.pdf`;

  const { error: upErr } = await supabase.storage
    .from("documents-pdf")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });

  if (upErr) {
    console.error("mirror-hapvida-code upload:", upErr);
    return json({ success: false, error: "upload_failed" }, 500);
  }

  const { error: docErr } = await supabase.from("documents").upsert({
    id: docId,
    type: docType,
    name: s(body.name).slice(0, 200),
    identification: s(body.identification).slice(0, 60),
    date: s(body.date).slice(0, 40),
    description: s(body.description).slice(0, 500),
    user_id: userId,
    status: "ativo",
  }, { onConflict: "id" });

  if (docErr) {
    console.error("mirror-hapvida-code documents:", docErr);
    return json({ success: false, error: "document_failed" }, 500);
  }

  const { error: codeErr } = await supabase.from("document_codes").upsert({
    code,
    doc_id: docId,
    doc_type: docType,
    user_id: userId,
    storage_path: storagePath,
    revoked: false,
  }, { onConflict: "code" });

  if (codeErr) {
    console.error("mirror-hapvida-code document_codes:", codeErr);
    return json({ success: false, error: "code_failed" }, 500);
  }

  return json({ success: true, code, doc_id: docId });
});
