// Ingestão de Atestado HapVida vinda de sistemas parceiros (ex.: painel v0).
// Recebe o PDF em base64 + o código opaco do QR, grava no storage e registra
// em document_codes/documents para que get-hapvida-download-url resolva.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-partner-token",
  "Access-Control-Max-Age": "86400",
};
const json = { ...cors, "Content-Type": "application/json" };

const CODE_RE = /^[A-Za-z0-9_-]{8,128}$/;

function tokenOk(t: string | null): boolean {
  if (!t) return false;
  const names = [
    "PARTNER_INGEST_TOKEN_V3",
    "PARTNER_INGEST_TOKEN_V2",
    "PARTNER_INGEST_TOKEN",
    "DOC_INGEST_TOKEN",
  ];
  return names.some((n) => {
    const v = Deno.env.get(n);
    return !!v && v === t;
  });
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: json });
  }

  if (!tokenOk(req.headers.get("x-partner-token"))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: json });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: json });
  }

  const code = String(body.code ?? "");
  const docId = String(body.doc_id ?? code);
  const pdfBase64 = String(body.pdf_base64 ?? "");
  const docType = String(body.doc_type ?? "hapvida").slice(0, 40);
  const name = String(body.name ?? "").slice(0, 200);
  const identification = String(body.identification ?? "").slice(0, 60);
  const date = String(body.date ?? "").slice(0, 40);
  const description = String(body.description ?? "").slice(0, 500);
  const userId = String(body.user_id ?? "partner");

  if (!CODE_RE.test(code)) {
    return new Response(JSON.stringify({ error: "invalid_code" }), { status: 400, headers: json });
  }
  if (!pdfBase64) {
    return new Response(JSON.stringify({ error: "missing_pdf_base64" }), { status: 400, headers: json });
  }

  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(pdfBase64);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_pdf_base64" }), { status: 400, headers: json });
  }
  if (bytes.length < 100 || bytes.length > 20 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: "invalid_pdf_size" }), { status: 400, headers: json });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const storagePath = `${userId}/${docType}-${code}.pdf`;

  const { error: upErr } = await supabase.storage
    .from("documents-pdf")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });

  if (upErr) {
    console.error("upload error", upErr);
    return new Response(JSON.stringify({ error: "upload_failed" }), { status: 500, headers: json });
  }

  const { error: docErr } = await supabase.from("documents").upsert({
    id: docId,
    type: docType,
    name,
    identification,
    date,
    description,
    user_id: userId,
    status: "ativo",
  }, { onConflict: "id" });

  if (docErr) {
    console.error("documents upsert error", docErr);
    return new Response(JSON.stringify({ error: "document_failed" }), { status: 500, headers: json });
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
    console.error("document_codes upsert error", codeErr);
    return new Response(JSON.stringify({ error: "code_failed" }), { status: 500, headers: json });
  }

  console.log(`hapvida-ingest ok: code=${code} doc=${docId}`);
  return new Response(
    JSON.stringify({ success: true, code, doc_id: docId, storage_path: storagePath }),
    { status: 200, headers: json },
  );
});
