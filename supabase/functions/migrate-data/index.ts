import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

const TABLES = [
  "profiles",
  "user_roles",
  "template_alignments",
  "documents",
  "document_codes",
  "atestados",
  "receitas",
  "credit_transactions",
  "financial_transactions",
  "deposits",
  "generation_logs",
  "staff_action_logs",
  "staff_credit_logs",
  "blocked_users",
  "banned_devices",
  "support_tickets",
  "support_messages",
  "recharge_logs",
  "pix_warnings",
  "suppressed_emails",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== Deno.env.get("MIGRATION_TARGET_KEY")) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const targetUrl = Deno.env.get("MIGRATION_TARGET_URL")!;
  const targetKey = Deno.env.get("MIGRATION_TARGET_KEY")!;
  const body = await req.json().catch(() => ({}));
  const only: string[] | null = Array.isArray(body.tables) ? body.tables : null;
  const doUsers = body.users !== false;

  const client = new Client(Deno.env.get("SUPABASE_DB_URL")!);
  await client.connect();

  const report: Record<string, unknown> = {};

  try {
    if (body.storage) {
      const bucket = String(body.storage.bucket);
      const limit = Number(body.storage.limit ?? 10);
      const offset = Number(body.storage.offset ?? 0);
      const srcUrl = Deno.env.get("SUPABASE_URL")!;
      const srcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      await fetch(`${targetUrl}/storage/v1/bucket`, {
        method: "POST",
        headers: { apikey: targetKey, Authorization: `Bearer ${targetKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: bucket, name: bucket, public: false }),
      });

      const objs = await client.queryObject<{ name: string }>(
        `select name from storage.objects where bucket_id = '${bucket}' order by created_at limit ${limit} offset ${offset}`,
      );
      let ok = 0, failed = 0;
      const errors: string[] = [];
      for (const o of objs.rows) {
        const path = encodeURI(o.name);
        const dl = await fetch(`${srcUrl}/storage/v1/object/${bucket}/${path}`, {
          headers: { apikey: srcKey, Authorization: `Bearer ${srcKey}` },
        });
        if (!dl.ok) { failed++; if (errors.length < 3) errors.push(`dl ${o.name}: ${dl.status}`); continue; }
        const bytes = new Uint8Array(await dl.arrayBuffer());
        const up = await fetch(`${targetUrl}/storage/v1/object/${bucket}/${path}`, {
          method: "POST",
          headers: {
            apikey: targetKey,
            Authorization: `Bearer ${targetKey}`,
            "Content-Type": dl.headers.get("content-type") ?? "application/octet-stream",
            "x-upsert": "true",
          },
          body: bytes,
        });
        if (up.ok) ok++;
        else { failed++; const t = await up.text(); if (errors.length < 3) errors.push(`up ${o.name}: ${t.slice(0, 150)}`); }
      }
      report.storage = { bucket, total: objs.rows.length, ok, failed, errors };
      await client.end();
      return new Response(JSON.stringify(report, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (doUsers) {
      const limit = Number(body.usersLimit ?? 40);
      const offset = Number(body.usersOffset ?? 0);
      const res = await client.queryObject<Record<string, unknown>>(
        `select id::text, email, encrypted_password, phone, raw_user_meta_data, created_at
           from auth.users where email is not null order by created_at limit ${limit} offset ${offset}`,
      );
      let created = 0, existed = 0, failed = 0;
      const errors: string[] = [];
      for (const u of res.rows) {
        const payload = {
          id: u.id,
          email: u.email,
          password_hash: u.encrypted_password,
          email_confirm: true,
          user_metadata: u.raw_user_meta_data ?? {},
        };
        const r = await fetch(`${targetUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers: { apikey: targetKey, Authorization: `Bearer ${targetKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) created++;
        else {
          const t = await r.text();
          if (t.includes("already been registered") || t.includes("duplicate")) existed++;
          else { failed++; if (errors.length < 5) errors.push(t.slice(0, 200)); }
        }
      }
      report.users = { total: res.rows.length, created, existed, failed, errors };
    }

    for (const table of TABLES) {
      if (only && !only.includes(table)) continue;
      const rowLimit = Number(body.rowLimit ?? 100000);
      const rowOffset = Number(body.rowOffset ?? 0);
      const chunkSize = Number(body.chunkSize ?? 200);
      const res = await client.queryObject<Record<string, unknown>>(
        `select * from public.${table} limit ${rowLimit} offset ${rowOffset}`,
      );
      const rows = res.rows;
      let ok = 0, failed = 0;
      const errors: string[] = [];
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const r = await fetch(`${targetUrl}/rest/v1/${table}`, {
          method: "POST",
          headers: {
            apikey: targetKey,
            Authorization: `Bearer ${targetKey}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(chunk, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
        });
        if (r.ok) ok += chunk.length;
        else { failed += chunk.length; const t = await r.text(); if (errors.length < 3) errors.push(t.slice(0, 300)); }
      }
      report[table] = { total: rows.length, ok, failed, errors };
    }
  } catch (e) {
    report.fatal = String(e);
  } finally {
    await client.end();
  }

  return new Response(JSON.stringify(report, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
