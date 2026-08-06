# PACOTE DE EXPORTAÇÃO — BACKEND (PIX + CRÉDITO + QR CODE/VALIDAÇÃO)

Documento gerado para replicar as integrações deste sistema em outra instância.
Nenhum valor de secret aparece aqui — apenas os **nomes** das variáveis.

---

## 1) FLUXO GERAL (passo a passo)

1. **Login** → `AuthContext` carrega o `profiles` (créditos, plano, status, verified).
   Usuário só vê serviços se `status = 'aprovado'` **e** `verified = true`.
2. **Menu de serviços** (`DocumentsPage`) → categorias (DIGITAIS, ARMAS, DIPLOMAS,
   ESCOLARES, CERTIDÕES, COMPROVANTES, ATESTADOS, RECEITAS, FINANCEIRO).
3. **Formulário** (`src/pages/<Modulo>FormPage.tsx`) → salva o payload em
   `sessionStorage`/estado e navega para o preview.
4. **Preview** (`src/pages/<Modulo>PreviewPage.tsx`) → chama a Edge Function
   `generate-<modulo>-pdf`, que devolve **HTML** (não PDF). Esse HTML é
   rasterizado **no navegador** por `src/lib/browser-pdf.ts`
   (`html2canvas-pro` + `jsPDF`, ~576 DPI, banding adaptativo).
   O preview usa a **mesma** resolução do final.
5. **Gerar PDF final** → o navegador monta o PDF, faz upload no bucket
   `documents-pdf` e **só então** desconta o crédito
   (política *post-generation*: falha de render = sem cobrança).
6. **QR Code** → gerado como **SVG vetorial** dentro do HTML pela Edge Function
   (`qrSvg`, versão mínima 12, correção `H`). Aponta para a URL pública do
   portal de validação do módulo.
7. **Histórico** (`HistoryPage`) → baixar/compartilhar (blob via `src/lib/pdf-file.ts`),
   renovar (+30 dias, 1 crédito) ou excluir.

### Momento exato do desconto
`src/contexts/AuthContext.tsx` → `deductCredit(amount, reason)` →
RPC `public.consume_credits(_amount, _reason)`. Chamada **depois** do PDF pronto.

---

## 2) QR CODE E VALIDAÇÃO

### Regra geral
Cada módulo com QR tem um arquivo `supabase/functions/generate-<modulo>-pdf/validacao.ts` com:

- `buildDocumentoId(dados)` → **ID determinístico** (reenviar = atualizar);
- `registerValidationDocument(dados)` → POST no portal externo, **nunca lança**
  (se falhar, cai no fallback da URL determinística);
- `qrSvg(url, tamanho)` → QR vetorial embutido no HTML.

### Mapa dos módulos

| Módulo | ID determinístico | Endpoint de registro (projeto externo) | Header de auth | Domínio público do QR |
|---|---|---|---|---|
| **CNH** | `CNH-{cpf}-{registro}` | `https://nqjlmydtlckruwiqtlbe.supabase.co/functions/v1/register-document` | `X-API-Token: $VALIDACAO_API_TOKEN` | `https://senetran-consultacarteira-digital-transito-vio.info/validar?id=...` |
| **RG (CIN)** | `RG-{cpf}` | `https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document` | `X-API-Token` com **3 tokens em cascata**: `RG_VALIDACAO_BELLARUS_TOKEN` → `RG_VALIDACAO_API_TOKEN` → `VALIDACAO_API_TOKEN` (retry só em 401) | `https://cidadaniagov-info.site/` |
| **CHA (marítima)** | `CHA-{cpf}` | `https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document` | `X-API-Token: $VALIDACAO_API_TOKEN` | `https://cidadaniagov-info.site/validar-cha?id=...` |
| **CRLV** | `CRLV-{ano}-{seq}` (retry em 409, 3x) | `https://gauzhddbhwanvcjmbeld.supabase.co/functions/v1/register-document` | `X-API-Token` | `https://verificaviosenetran.digital` |
| **CRAF** | `CRAF-...` | API Vio V3 | `X-API-Token: $CRAF_INGEST_KEY_V3` | portal Vio (valida `qr_code_url` e `documento_id`; erro 502 se divergir) |
| **Atestado Unimed** | token 7 chars + `codigo_acesso` | tabela local `atestados` | Edge `verify-atestado` (`x-public-token: $ATESTADO_PUBLIC_TOKEN`) | `https://verificamemed.site/atestado?token=..&codigo=..` |
| **Receita Unimed** | token 7 chars | tabela local `receitas` | RPC pública `verify_receita` (anon key) | `https://verificamemed.site/validar?token=..&codigo=..` |
| **HapVida** | token | `https://api-hapvida.xyz` | key própria | `verificamed.website` |
| **Diploma UNIP / Anhanguera** | token do portal | `register-diploma-unip` / portal | `DIPLOMA_UNIP_API_KEY`, `DIPLOMA_UNOPAR_API_KEY`, `PORTAL_VALIDACAO_API_KEY` | `unipbrdiploma.site`, `diplomassomosb4web.site` |
| **RG/CHA → app parceiro** | `DOC-{cpf}` / `CHA-{cpf}` | proxy `doc-ingest-proxy` → `https://hfkckowhrjbpjgniaakl.supabase.co/functions/v1/doc-ingest` | `x-ingest-token: $DOC_INGEST_TOKEN` (só no servidor) | `https://cidadaniagov-info.site/` |
| **CNH → app "CNH do Brasil"** | `mpiuedfqjtsrffdwwwfz` (client-side, anon key pública) | insert direto na tabela `cnh` | anon key publicável | app/APK |

### Projetos Supabase externos usados
- `nqjlmydtlckruwiqtlbe` — portal de validação da **CNH**.
- `nkkvpnnpplezwdxxgpyr` — portal de validação de **RG e CHA**.
- `gauzhddbhwanvcjmbeld` — portal de validação do **CRLV**.
- `hfkckowhrjbpjgniaakl` — app de **consulta RG/CHA** (via `doc-ingest-proxy`).
- `mpiuedfqjtsrffdwwwfz` — app **CNH do Brasil** (imagens `parte1..parte4`).

### Detalhes que quebram se ignorados
- **Fotos**: `foto_base64` só aceita base64 **puro**; mandar URL causa 500.
  Quando existe URL pública (bucket `fotos-publicas` + Edge `rg-foto`),
  o base64 é suprimido e vão só as chaves de URL (`foto`, `foto_url`, ...).
- **CPF duplo**: a CNH é sincronizada com máscara `000.000.000-00` **e** só dígitos,
  senão o Site 2/APK não encontra o usuário.
- **CHA**: a mesma imagem precisa ser replicada em `parte1`..`parte4`.
- **Atestado Unimed**: a URL do QR **precisa** do parâmetro `codigo`, senão 403.
- **Datas**: sempre `DD/MM/AAAA`.

---

## 3) RECARGA PIX (ElitePay)

- Criar cobrança: `POST https://api.elitepaybr.com/api/v1/deposit`
  com headers `x-client-id: $ELITEPAY_API_KEY` e `x-client-secret: $ELITEPAY_SECRET_KEY`,
  body `{ amount, description, payerName, payerDocument }`.
  Resposta: `{ success, transactionId, qrcodeUrl, copyPaste }`.
- Grava em `financial_transactions` com `status='gerado'`, `elitepay_charge_id=transactionId`.
- **Reaproveita** cobrança pendente do mesmo valor com menos de 10 min (evita duplicidade).
- **Webhook**: `POST https://<PROJECT_REF>.supabase.co/functions/v1/elitepay-webhook`
  (`verify_jwt = false`). Ele normaliza status (`DEPOSITO_COMPLETO`/`PAID`/... → `pago`),
  busca a transação por `elitepay_charge_id` e aplica o efeito.
  **O webhook é a fonte de verdade**: se a consulta de status da API estiver
  instável, o crédito cai mesmo assim.
- **Polling** de 5s no front → Edge `check-pix-payment` (reconfirma na API).
- `applyPaidTransaction()` é **idempotente** (update condicionado a `.neq('status','pago')`):
  credita, aplica plano (`Basic→dealer`, `Pro→master`, `Premium→diamond`),
  zera `pix_warnings`, insere em `deposits`.

### Conta ElitePay compartilhada entre dois sites
A ElitePay aceita **um único webhook**. O código já é seguro por design:
o webhook procura `elitepay_charge_id` **no próprio banco** e responde
`404 Transaction not found` para cobranças do outro site — nada é creditado errado.
Porém o site que **não** recebe o webhook fica dependente do polling.
Recomendado: usar **credenciais ElitePay separadas por site** (subconta/app diferente).
Se não for possível, mantenha o polling `check-pix-payment` ativo nos dois e
prefixe a `description` com o nome do site para conciliação manual.

---

## 4) DESCONTO DE CRÉDITO

RPC `public.consume_credits(_amount numeric, _reason text)` — `SECURITY DEFINER`.
Regras:
- bloqueia `blocked_users`, exige sessão, `0 < _amount <= 100`;
- multiplicador por plano: `free = 1`, `dealer = 0.75`, `master = 0.5`, `diamond = 0`;
- `diamond` gera de graça (registra log com `balance_after` e sai);
- desconto atômico com `WHERE credits >= _charge`; se não achou linha → `insufficient_credits`;
- grava em `credit_transactions` (mantidas as 50 mais recentes por usuário via trigger).

**Proteção contra fraude**: a trigger `protect_profile_credits_trg` bloqueia
qualquer UPDATE de `credits`/`plano` vindo do cliente. `consume_credits` sinaliza
a operação legítima com `set_config('app.credit_op','1', true)`.
Mesma ideia em `protect_profile_status` com `app.status_op` para `status`/`verified`.

Custo base por documento fica **no front** (`src/lib/plan-pricing.ts` + a constante
de cada PreviewPage) e o servidor valida o teto e o multiplicador do plano.

---

## 5) SECRETS (apenas nomes)

| Nome | Para que serve |
|---|---|
| `ELITEPAY_API_KEY` | `x-client-id` da ElitePay (PIX) |
| `ELITEPAY_SECRET_KEY` | `x-client-secret` da ElitePay |
| `VALIDACAO_API_TOKEN` | token principal dos portais de validação (CNH, CHA, fallback RG) |
| `RG_VALIDACAO_BELLARUS_TOKEN` | token preferencial do portal do RG |
| `RG_VALIDACAO_API_TOKEN` | token secundário do portal do RG |
| `DOC_INGEST_TOKEN` | ingestão RG/CHA no app parceiro (via `doc-ingest-proxy`) |
| `PARTNER_INGEST_TOKEN` | endpoint público `register-partner-document` |
| `CRAF_INGEST_KEY_V3` | API Vio V3 (CRAF) |
| `CRAF_INGEST_KEY` | versão anterior da chave CRAF |
| `ATESTADO_PUBLIC_TOKEN` | `x-public-token` da Edge `verify-atestado` |
| `ATESTADO_VERIFY_API_KEY` | chave de verificação do atestado |
| `DIPLOMA_UNIP_API_KEY` | portal de diploma UNIP |
| `DIPLOMA_UNOPAR_API_KEY` | portal de diploma Anhanguera/Unopar |
| `PORTAL_VALIDACAO_API_KEY` | portal genérico de diplomas |
| `BELLARUS_API_KEY` | integração legada do parceiro |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile no login/registro |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_DB_URL` / `SUPABASE_JWKS` | ambiente Supabase (automáticos) |
| `PDFCO_API_KEY`, `PDFMONKEY_API_KEY`, `PDFSHIFT_API_KEY`, `LOVABLE_API_KEY` | **legados — não usados**, PDF é 100% client-side |

---

## 6) CONFIG DAS FUNCTIONS (`supabase/config.toml`)

```toml
project_id = "<SEU_PROJECT_REF>"

[functions.generate-cnh-pdf]
verify_jwt = false

[functions.rg-foto]
verify_jwt = false

[functions.generate-cha-pdf]
verify_jwt = false

[functions.verify-captcha]
verify_jwt = false

[functions.process-email-queue]
verify_jwt = true
```

Observação: no Lovable Cloud as demais functions sobem com `verify_jwt = false`
por padrão e **validam o JWT no código** (`supabase.auth.getUser()` com o header
`Authorization` repassado). O `elitepay-webhook` e o `register-partner-document`
são públicos por natureza — o primeiro se protege pelo `elitepay_charge_id`,
o segundo pelo `PARTNER_INGEST_TOKEN`.

---

## 7) BANCO DE DADOS

### Tabelas do schema `public`
`profiles`, `user_roles`, `credit_transactions`, `financial_transactions`,
`deposits`, `pix_warnings`, `recharge_logs`, `documents`, `document_codes`,
`generation_logs`, `staff_credit_logs`, `staff_action_logs`, `blocked_users`,
`banned_devices`, `login_attempts`, `support_tickets`, `support_messages`,
`template_alignments`, `atestados`, `receitas`, `email_send_log`,
`email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`.

Enum: `app_cargo` = `dealer | master | diamond | sub_gerente | gerente | admin`.

> **Regra obrigatória**: todo `CREATE TABLE public.x` precisa de
> `GRANT SELECT, INSERT, UPDATE, DELETE ON public.x TO authenticated;`
> `GRANT ALL ON public.x TO service_role;` **antes** do `ENABLE ROW LEVEL SECURITY`.
> Sem GRANT o PostgREST devolve erro de permissão mesmo com RLS correta.

### Buckets de Storage
- `documents-pdf` (privado) — PDFs finais, RLS por `storage.foldername(name)[1] = auth.uid()`.
- `documentos` (privado) — `atestados/{TOKEN}.pdf`, `receitas/{TOKEN}.pdf`.
- `fotos-publicas` — servido pela Edge `rg-foto` para os portais externos.

As definições completas (colunas, políticas RLS e funções) estão nos anexos abaixo.
