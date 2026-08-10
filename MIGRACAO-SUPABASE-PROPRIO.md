# MIGRAÇÃO PARA O SUPABASE PRÓPRIO — projeto `mpcepkwpzdzofnhdnjlu`

## ✅ O que JÁ foi criado no seu projeto novo

| Item | Status |
|---|---|
| 24 tabelas do schema `public` (com colunas, defaults, PK/FK/unique/checks e índices) | criado |
| Tipo enum `app_cargo` | criado |
| 27 funções (`has_role`, `is_staff`, `consume_credits`, `admin_*`, `staff_adjust_credits`, `verify_*`, filas de e-mail…) | criado |
| 6 triggers (proteção de créditos, proteção de status, trim de logs, updated_at) | criado |
| 55 policies de RLS + RLS habilitado em todas as tabelas | criado |
| GRANTs para `anon`, `authenticated`, `service_role` | criado |
| Buckets `documentos` e `documents-pdf` (privados) + 4 policies de storage | criado |
| Alinhamentos de template (15 módulos) copiados | criado |
| Contas admin `emayconvictor356@gmail.com` e `adimindobellarus@gmail.com` (senha `souzasou123`), perfis diamond + cargo admin | criado |
| Extensões `pgcrypto`, `pg_net`, `pg_cron` | criado |

## ⚠️ O que FALTA e depende de você

### 1. Rotacionar a service role key
Você colou a `service_role` no chat. Ela é chave de administrador total.
Vá em **Supabase → Settings → API → Rotate** e gere uma nova antes de publicar.

### 2. Deploy das Edge Functions — ✅ FEITO
As **48 funções** foram publicadas no projeto `mpcepkwpzdzofnhdnjlu` (todas ACTIVE, versão 1).
As públicas (`generate-cnh-pdf`, `generate-cha-pdf`, `rg-foto`, `verify-captcha`,
`elitepay-webhook`) foram publicadas com `--no-verify-jwt`.

Para republicar depois de mudanças:
```bash
supabase functions deploy --project-ref mpcepkwpzdzofnhdnjlu --use-api
```

### 3. Secrets das Edge Functions
Já cadastrados no projeto novo: `ELITEPAY_API_KEY`, `ELITEPAY_SECRET_KEY`,
`PARTNER_INGEST_TOKEN_V3`, `BELLARUS_API_KEY`.

Ainda faltam (valores write-only no projeto antigo — preciso que você me mande):

```bash
supabase secrets set --project-ref mpcepkwpzdzofnhdnjlu \
  ELITEPAY_WEBHOOK_SECRET=... \
  TURNSTILE_SECRET_KEY=... \
  TURNSTILE_SITE_KEY=... \
  DOC_INGEST_TOKEN=... \
  PARTNER_INGEST_TOKEN=... PARTNER_INGEST_TOKEN_V2=... \
  RG_VALIDACAO_BELLARUS_TOKEN=... RG_VALIDACAO_API_TOKEN=... VALIDACAO_API_TOKEN=... \
  ATESTADO_PUBLIC_TOKEN=... ATESTADO_VERIFY_API_KEY=... \
  CNH_EXTERNAL_SERVICE_KEY=... CNH_PARTNER_TOKEN=... \

  CRAF_INGEST_KEY=... CRAF_INGEST_KEY_V3=... \
  DIPLOMA_UNIP_API_KEY=... DIPLOMA_UNOPAR_API_KEY=... \
  PORTAL_VALIDACAO_API_KEY=... \
  PDFCO_API_KEY=... PDFMONKEY_API_KEY=... PDFSHIFT_API_KEY=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` o próprio Supabase
injeta automaticamente nas functions — não precisa cadastrar.

### 4. Variáveis do frontend (Vercel / build)
```
VITE_SUPABASE_URL=https://mpcepkwpzdzofnhdnjlu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do projeto novo>
VITE_SUPABASE_PROJECT_ID=mpcepkwpzdzofnhdnjlu
```
Enquanto o app rodar aqui na Lovable, o `.env` é gerenciado pela plataforma e
continua apontando para o backend atual. A troca vale quando o repositório for
buildado fora (Vercel/local).

### 5. Cron de reconciliação PIX
Depois do deploy das functions, rode uma vez no SQL Editor do seu projeto:
```sql
select cron.schedule('reconcile-pix','* * * * *', $$
  select net.http_post(
    url:='https://mpcepkwpzdzofnhdnjlu.supabase.co/functions/v1/reconcile-pix',
    headers:='{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
    body:='{}'::jsonb);
$$);
```

### 6. Webhook da Elite Pay
Atualizar a URL no painel da Elite Pay para:
`https://mpcepkwpzdzofnhdnjlu.supabase.co/functions/v1/elitepay-webhook`

### 7. Auth
Em **Authentication → URL Configuration**, definir Site URL e Redirect URLs
(`https://monkeylab.online`, domínio da Vercel e `http://localhost:8080`).

## Dados
As tabelas foram criadas **vazias** (exceto alinhamentos e admins). Se quiser levar
usuários, histórico e transações, exporte por Cloud → Advanced settings → Export data
e me avise que eu carrego os registros no projeto novo.
