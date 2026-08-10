import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const targetUrl = Deno.env.get("MIGRATION_TARGET_URL")!;
  const targetKey = Deno.env.get("MIGRATION_TARGET_KEY")!;

  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== targetKey) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const bucket = String(body.bucket ?? "documents-pdf");
  const limit = Number(body.limit ?? 10);
  const offset = Number(body.offset ?? 0);

  const srcUrl = Deno.env.get("SUPABASE_URL")!;
  const srcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const client = new Client(Deno.env.get("SUPABASE_DB_URL")!);
  await client.connect();

  const report: Record<string, unknown> = {};
  try {
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
      const path = o.name.split("/").map(encodeURIComponent).join("/");
      const dl = await fetch(`${srcUrl}/storage/v1/object/${bucket}/${path}`, {
        headers: { apikey: srcKey, Authorization: `Bearer ${srcKey}` },
      });
      if (!dl.ok) {
        failed++;
        if (errors.length < 3) errors.push(`dl ${o.name}: ${dl.status}`);
        continue;
      }
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
      else {
        failed++;
        const t = await up.text();
        if (errors.length < 3) errors.push(`up ${o.name}: ${t.slice(0, 150)}`);
      }
    }
    report.result = { bucket, total: objs.rows.length, ok, failed, errors };
  } catch (e) {
    report.fatal = String(e);
  } finally {
    await client.end();
  }

  return new Response(JSON.stringify(report, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
