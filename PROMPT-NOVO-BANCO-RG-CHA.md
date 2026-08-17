# PROMPT — CRIAR O BANCO DE CONSULTA DE RG DIGITAL (CIN) + CHA (CNH MARÍTIMA)

> Cole este documento inteiro no agente do site que vai **receber e exibir** os documentos.
> Ele descreve as tabelas, todos os campos, o endpoint de ingestão e as regras de imagem.

---

## 1. O QUE ESTE SISTEMA PRECISA FAZER

1. Receber, por HTTP, os dados de um RG Digital ou de um CHA + as imagens da folha do PDF.
2. Guardar tudo em duas tabelas (`rg` e `cha`), com **upsert por `documento_id`**.
3. Exibir o documento quando alguém escanear o QR Code e abrir
   `/validar-rg?id=DOC-{cpf}` ou `/validar-cha?id=CHA-{cpf}`.

O gerador **não** grava direto no banco. Ele só faz `POST` na Edge Function `doc-ingest`,
autenticada por um header secreto.

---

## 2. TABELAS (SQL)

```sql
-- ============ RG DIGITAL (CIN) ============
create table public.rg (
  id                uuid primary key default gen_random_uuid(),
  documento_id      text not null unique,          -- "DOC-{cpf somente dígitos}"
  nome_completo     text not null default '',
  cpf               text not null default '',      -- só dígitos
  rg                text not null default '',      -- "1234567 SSP"
  data_nascimento   text not null default '',      -- dd/mm/aaaa
  naturalidade      text not null default '',
  nacionalidade     text not null default 'BRASILEIRA',
  sexo              text not null default '',      -- 'M' | 'F'
  data_emissao      text not null default '',      -- dd/mm/aaaa
  data_validade     text not null default '',      -- dd/mm/aaaa
  nome_pai          text not null default '',
  nome_mae          text not null default '',
  orgao_expedidor   text not null default '',
  local_emissao     text not null default '',
  uf_orgao          text not null default '',
  estado_civil      text not null default '',
  doador_orgaos     text not null default 'NÃO',   -- 'SIM' | 'NÃO'
  codigo_seguranca  text not null default '',
  mrz               text not null default '',
  -- imagens: data URLs JPEG/PNG base64 da MESMA folha completa
  parte1            text,
  parte2            text,
  parte3            text,
  parte4            text,
  foto_url          text,                          -- foto 3x4 (URL pública, opcional)
  status            text not null default 'valido',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

grant select on public.rg to anon;                 -- leitura pública pelo validador
grant select, insert, update on public.rg to authenticated;
grant all on public.rg to service_role;

alter table public.rg enable row level security;

create policy "rg leitura publica" on public.rg
for select to anon, authenticated using (true);
-- escrita apenas pela Edge Function (service_role ignora RLS)

create index rg_cpf_idx on public.rg (cpf);


-- ============ CHA (CNH MARÍTIMA / AMADOR) ============
create table public.cha (
  id                uuid primary key default gen_random_uuid(),
  documento_id      text not null unique,          -- "CHA-{cpf somente dígitos}"
  nome_completo     text not null default '',
  cpf               text not null default '',
  data_nascimento   text not null default '',      -- dd/mm/aaaa
  nacionalidade     text not null default 'BRASILEIRA',
  sexo              text not null default '',
  categoria         text not null default '',      -- "MOTONAUTA / MOTORBOAT"
  numero_inscricao  text not null default '',
  data_emissao      text not null default '',
  data_validade     text not null default '',
  orgao_emissao     text not null default 'MARINHA DO BRASIL',
  limites_navegacao text not null default '',
  requisitos        text not null default '',
  codigo_seguranca  text not null default '',
  observacoes       text not null default '',
  parte1            text,
  parte2            text,
  parte3            text,
  parte4            text,
  status            text not null default 'valido',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

grant select on public.cha to anon;
grant select, insert, update on public.cha to authenticated;
grant all on public.cha to service_role;

alter table public.cha enable row level security;

create policy "cha leitura publica" on public.cha
for select to anon, authenticated using (true);

create index cha_cpf_idx on public.cha (cpf);
```

> Se preferir não deixar a leitura pública, exponha uma função
> `verify_rg(_id text)` / `verify_cha(_id text)` `security definer` e mantenha RLS fechado.

---

## 3. ENDPOINT DE INGESTÃO — `doc-ingest`

```
POST /functions/v1/doc-ingest
Content-Type: application/json
x-ingest-token: <DOC_INGEST_TOKEN>     ← segredo guardado no servidor
```

Body:
```json
{ "tabela": "rg" | "cha", "dados": { ...payload... } }
```

Regras da função:
- rejeitar (`401`) se `x-ingest-token` não bater com o segredo `DOC_INGEST_TOKEN`;
- validar `tabela ∈ {rg, cha}` e a presença de `dados.documento_id` → senão `400`;
- fazer **upsert por `documento_id`** (`onConflict: "documento_id"`), atualizando `updated_at`;
- responder `{ "ok": true }` em sucesso;
- aceitar `OPTIONS` com CORS liberado (`Access-Control-Allow-Headers: content-type, x-ingest-token`).

Esqueleto:
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN = Deno.env.get("DOC_INGEST_TOKEN")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-ingest-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("x-ingest-token") !== TOKEN)
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

  const { tabela, dados } = await req.json();
  if (tabela !== "rg" && tabela !== "cha")
    return new Response(JSON.stringify({ error: "invalid_tabela" }), { status: 400, headers: cors });
  if (!dados?.documento_id)
    return new Response(JSON.stringify({ error: "invalid_dados" }), { status: 400, headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin
    .from(tabela)
    .upsert({ ...dados, updated_at: new Date().toISOString() }, { onConflict: "documento_id" });

  if (error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
});
```

---

## 4. PAYLOADS EXATOS QUE VÃO CHEGAR

### `tabela: "rg"`
```json
{
  "documento_id": "DOC-12345678901",
  "nome_completo": "MARIA DA SILVA",
  "cpf": "12345678901",
  "rg": "1234567 SSP",
  "data_nascimento": "01/02/1990",
  "naturalidade": "RECIFE",
  "nacionalidade": "BRASILEIRA",
  "sexo": "F",
  "data_emissao": "10/01/2025",
  "data_validade": "10/01/2035",
  "nome_pai": "JOAO DA SILVA",
  "nome_mae": "ANA DA SILVA",
  "orgao_expedidor": "SSP",
  "local_emissao": "RECIFE",
  "uf_orgao": "PE",
  "estado_civil": "SOLTEIRO",
  "doador_orgaos": "SIM",
  "codigo_seguranca": "0000000000",
  "mrz": "IDBRA...<<<<",
  "parte1": "data:image/jpeg;base64,...",
  "parte2": "data:image/jpeg;base64,...",
  "parte3": "data:image/jpeg;base64,...",
  "parte4": "data:image/jpeg;base64,..."
}
```

### `tabela: "cha"`
```json
{
  "documento_id": "CHA-12345678901",
  "nome_completo": "MARIA DA SILVA",
  "cpf": "12345678901",
  "data_nascimento": "01/02/1990",
  "nacionalidade": "BRASILEIRA",
  "sexo": "F",
  "categoria": "MOTONAUTA / MOTORBOAT",
  "numero_inscricao": "1234567890",
  "data_emissao": "10/01/2025",
  "data_validade": "10/01/2035",
  "orgao_emissao": "MARINHA DO BRASIL",
  "limites_navegacao": "...",
  "requisitos": "...",
  "codigo_seguranca": "0000",
  "observacoes": "",
  "parte1": "data:image/jpeg;base64,...",
  "parte2": "<mesma imagem>",
  "parte3": "<mesma>",
  "parte4": "<mesma>"
}
```

Normalizações já aplicadas pelo gerador (não refazer): tudo em MAIÚSCULAS,
datas `dd/mm/aaaa`, `sexo` = `M`/`F`, `doador_orgaos` = `SIM`/`NÃO`, `cpf` só dígitos.

---

## 5. REGRA DAS IMAGENS (O QUE MAIS QUEBRA)

- Chegam **4 colunas sempre preenchidas** (`parte1..parte4`), com a **folha completa**
  do PDF em JPEG base64 (escala 3x, lado maior ≥ 1500px, qualidade 0.94).
- **O recorte é responsabilidade deste site**, não do gerador. Ex.: `parte1` = frente,
  `parte2` = verso, `parte3` = foto/zoom, `parte4` = QR — recortando via CSS
  (`object-fit`/`background-position`) da mesma imagem.
- Nunca rotacionar no armazenamento. Renderizar com fundo branco.
- Colunas `text` guardam data URL inteira; não truncar. Se preferir economizar banco,
  decodifique o base64 e salve em Storage, guardando só a URL pública nas colunas.

---

## 6. TELA DE CONSULTA

```
/validar-rg?id=DOC-{cpf}    →  select * from rg  where documento_id = $1
/validar-cha?id=CHA-{cpf}   →  select * from cha where documento_id = $1
```
Aceitar também busca por `cpf` (só dígitos) como alternativa.
Se não achar: mensagem "Documento não encontrado" (nunca erro 500).

Login opcional do portal: usuário = CPF (dígitos), senha = últimos 6 dígitos do CPF.

---

## 7. CHECKLIST FINAL

- [ ] Tabelas `rg` e `cha` criadas com `documento_id` **unique**
- [ ] GRANTs + RLS aplicados
- [ ] Segredo `DOC_INGEST_TOKEN` cadastrado no servidor
- [ ] Edge Function `doc-ingest` publicada, com CORS e upsert
- [ ] Rotas `/validar-rg` e `/validar-cha` lendo por `documento_id`
- [ ] Recorte das 4 partes feito na exibição
- [ ] Reenvio do mesmo CPF atualiza o registro (testar duas vezes)
