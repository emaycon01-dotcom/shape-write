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

---

## ANEXO A — COLUNAS DAS TABELAS

```
atestados . id :: uuid NOT NULL DEFAULT gen_random_uuid()
atestados . token :: text NOT NULL
atestados . codigo_acesso :: text NOT NULL
atestados . emissao_atestado :: text NOT NULL
atestados . nome_paciente :: text NOT NULL
atestados . cpf :: text NOT NULL
atestados . data_nascimento :: text NOT NULL
atestados . endereco :: text
atestados . nome_medico :: text NOT NULL
atestados . genero_medico :: text NOT NULL
atestados . crm :: text NOT NULL
atestados . crm_uf :: text NOT NULL
atestados . endereco_clinica :: text
atestados . texto_atestado :: text NOT NULL
atestados . quantidade :: integer NOT NULL DEFAULT 1
atestados . pdf_url :: text
atestados . created_at :: timestamp with time zone NOT NULL DEFAULT now()
banned_devices . id :: uuid NOT NULL DEFAULT gen_random_uuid()
banned_devices . fingerprint :: text NOT NULL
banned_devices . user_id :: text
banned_devices . user_email :: text DEFAULT ''::text
banned_devices . reason :: text NOT NULL DEFAULT 'Tentativa de burlar segurança'::text
banned_devices . banned_at :: timestamp with time zone NOT NULL DEFAULT now()
banned_devices . banned_by :: text DEFAULT 'system'::text
blocked_users . id :: uuid NOT NULL DEFAULT gen_random_uuid()
blocked_users . user_id :: text NOT NULL
blocked_users . user_name :: text NOT NULL DEFAULT ''::text
blocked_users . user_email :: text NOT NULL DEFAULT ''::text
blocked_users . reason :: text NOT NULL DEFAULT ''::text
blocked_users . blocked_at :: timestamp with time zone NOT NULL DEFAULT now()
blocked_users . status :: text NOT NULL DEFAULT 'bloqueado'::text
credit_transactions . id :: uuid NOT NULL DEFAULT gen_random_uuid()
credit_transactions . user_id :: text NOT NULL
credit_transactions . actor_id :: text
credit_transactions . kind :: text NOT NULL DEFAULT 'debit'::text
credit_transactions . amount :: numeric NOT NULL DEFAULT 0
credit_transactions . balance_after :: numeric NOT NULL DEFAULT 0
credit_transactions . reason :: text NOT NULL DEFAULT ''::text
credit_transactions . created_at :: timestamp with time zone NOT NULL DEFAULT now()
deposits . id :: uuid NOT NULL DEFAULT gen_random_uuid()
deposits . user_id :: text NOT NULL
deposits . user_name :: text NOT NULL DEFAULT ''::text
deposits . user_email :: text NOT NULL DEFAULT ''::text
deposits . amount :: numeric NOT NULL DEFAULT 0
deposits . method :: text NOT NULL DEFAULT 'pix'::text
deposits . status :: text NOT NULL DEFAULT 'completed'::text
deposits . created_at :: timestamp with time zone NOT NULL DEFAULT now()
document_codes . code :: text NOT NULL
document_codes . doc_id :: text NOT NULL
document_codes . doc_type :: text NOT NULL DEFAULT 'hapvida'::text
document_codes . user_id :: text NOT NULL
document_codes . storage_path :: text NOT NULL
document_codes . revoked :: boolean NOT NULL DEFAULT false
document_codes . created_at :: timestamp with time zone NOT NULL DEFAULT now()
documents . id :: text NOT NULL
documents . type :: text NOT NULL
documents . name :: text NOT NULL DEFAULT ''::text
documents . identification :: text NOT NULL DEFAULT ''::text
documents . date :: text NOT NULL DEFAULT ''::text
documents . description :: text NOT NULL DEFAULT ''::text
documents . additional_info :: text NOT NULL DEFAULT '{}'::text
documents . created_at :: timestamp with time zone NOT NULL DEFAULT now()
documents . status :: text NOT NULL DEFAULT 'ativo'::text
documents . user_id :: text NOT NULL
documents . pdf_url :: text
documents . expires_at :: timestamp with time zone NOT NULL DEFAULT (now() + '45 days'::interval)
email_send_log . id :: uuid NOT NULL DEFAULT gen_random_uuid()
email_send_log . message_id :: text
email_send_log . template_name :: text NOT NULL
email_send_log . recipient_email :: text NOT NULL
email_send_log . status :: text NOT NULL
email_send_log . error_message :: text
email_send_log . metadata :: jsonb
email_send_log . created_at :: timestamp with time zone NOT NULL DEFAULT now()
email_send_state . id :: integer NOT NULL DEFAULT 1
email_send_state . retry_after_until :: timestamp with time zone
email_send_state . batch_size :: integer NOT NULL DEFAULT 10
email_send_state . send_delay_ms :: integer NOT NULL DEFAULT 200
email_send_state . auth_email_ttl_minutes :: integer NOT NULL DEFAULT 15
email_send_state . transactional_email_ttl_minutes :: integer NOT NULL DEFAULT 60
email_send_state . updated_at :: timestamp with time zone NOT NULL DEFAULT now()
email_unsubscribe_tokens . id :: uuid NOT NULL DEFAULT gen_random_uuid()
email_unsubscribe_tokens . token :: text NOT NULL
email_unsubscribe_tokens . email :: text NOT NULL
email_unsubscribe_tokens . created_at :: timestamp with time zone NOT NULL DEFAULT now()
email_unsubscribe_tokens . used_at :: timestamp with time zone
financial_transactions . id :: uuid NOT NULL DEFAULT gen_random_uuid()
financial_transactions . user_id :: text NOT NULL
financial_transactions . type :: text NOT NULL
financial_transactions . amount :: numeric NOT NULL DEFAULT 0
financial_transactions . credits_amount :: numeric NOT NULL DEFAULT 0
financial_transactions . plan_name :: text
financial_transactions . status :: text NOT NULL DEFAULT 'gerado'::text
financial_transactions . txid :: text
financial_transactions . elitepay_charge_id :: text
financial_transactions . pix_code :: text
financial_transactions . qr_code_base64 :: text
financial_transactions . paid_at :: timestamp with time zone
financial_transactions . created_at :: timestamp with time zone NOT NULL DEFAULT now()
generation_logs . id :: uuid NOT NULL DEFAULT gen_random_uuid()
generation_logs . user_id :: text NOT NULL
generation_logs . user_name :: text NOT NULL DEFAULT ''::text
generation_logs . user_email :: text NOT NULL DEFAULT ''::text
generation_logs . document_type :: text NOT NULL
generation_logs . stage :: text NOT NULL DEFAULT 'preview'::text
generation_logs . error_message :: text
generation_logs . created_at :: timestamp with time zone NOT NULL DEFAULT now()
login_attempts . id :: uuid NOT NULL DEFAULT gen_random_uuid()
login_attempts . identifier :: text NOT NULL
login_attempts . attempt_type :: text NOT NULL DEFAULT 'login'::text
login_attempts . created_at :: timestamp with time zone NOT NULL DEFAULT now()
pix_warnings . id :: uuid NOT NULL DEFAULT gen_random_uuid()
pix_warnings . user_id :: text NOT NULL
pix_warnings . qr_code_id :: text NOT NULL DEFAULT ''::text
pix_warnings . amount :: numeric NOT NULL DEFAULT 0
pix_warnings . status :: text NOT NULL DEFAULT 'pending'::text
pix_warnings . created_at :: timestamp with time zone NOT NULL DEFAULT now()
pix_warnings . resolved_at :: timestamp with time zone
pix_warnings . warning_cycle_start :: timestamp with time zone
profiles . id :: uuid NOT NULL DEFAULT gen_random_uuid()
profiles . user_id :: text NOT NULL
profiles . name :: text NOT NULL DEFAULT ''::text
profiles . email :: text NOT NULL DEFAULT ''::text
profiles . credits :: numeric NOT NULL DEFAULT 0
profiles . plano :: text NOT NULL DEFAULT 'free'::text
profiles . created_at :: timestamp with time zone NOT NULL DEFAULT now()
profiles . pin_hash :: text
profiles . status :: text NOT NULL DEFAULT 'pendente'::text
profiles . approved_at :: timestamp with time zone
profiles . approved_by :: text
profiles . verified :: boolean NOT NULL DEFAULT false
profiles . verified_at :: timestamp with time zone
profiles . verified_by :: text
receitas . id :: uuid NOT NULL DEFAULT gen_random_uuid()
receitas . token :: text NOT NULL
receitas . codigo_acesso :: text NOT NULL
receitas . emissao_receita :: text
receitas . nome_paciente :: text NOT NULL
receitas . cpf :: text
receitas . data_nascimento :: text
receitas . endereco :: text
receitas . nome_medico :: text NOT NULL
receitas . genero_medico :: text NOT NULL DEFAULT 'DR'::text
receitas . crm :: text
receitas . crm_uf :: text
receitas . endereco_clinica :: text
receitas . medicamentos :: jsonb NOT NULL DEFAULT '[]'::jsonb
receitas . pdf_url :: text
receitas . created_at :: timestamp with time zone NOT NULL DEFAULT now()
recharge_logs . id :: uuid NOT NULL DEFAULT gen_random_uuid()
recharge_logs . user_id :: text NOT NULL
recharge_logs . phone_number :: text NOT NULL DEFAULT ''::text
recharge_logs . amount :: numeric NOT NULL DEFAULT 0
recharge_logs . credits_used :: numeric NOT NULL DEFAULT 0
recharge_logs . created_at :: timestamp with time zone NOT NULL DEFAULT now()
staff_action_logs . id :: uuid NOT NULL DEFAULT gen_random_uuid()
staff_action_logs . actor_id :: text NOT NULL
staff_action_logs . actor_name :: text NOT NULL DEFAULT ''::text
staff_action_logs . actor_email :: text NOT NULL DEFAULT ''::text
staff_action_logs . actor_cargo :: text NOT NULL DEFAULT ''::text
staff_action_logs . target_user_id :: text NOT NULL
staff_action_logs . target_name :: text NOT NULL DEFAULT ''::text
staff_action_logs . target_email :: text NOT NULL DEFAULT ''::text
staff_action_logs . action :: text NOT NULL
staff_action_logs . details :: text NOT NULL DEFAULT ''::text
staff_action_logs . created_at :: timestamp with time zone NOT NULL DEFAULT now()
staff_credit_logs . id :: uuid NOT NULL DEFAULT gen_random_uuid()
staff_credit_logs . actor_id :: text NOT NULL
staff_credit_logs . actor_name :: text NOT NULL DEFAULT ''::text
staff_credit_logs . actor_email :: text NOT NULL DEFAULT ''::text
staff_credit_logs . actor_cargo :: text NOT NULL DEFAULT ''::text
staff_credit_logs . target_user_id :: text NOT NULL
staff_credit_logs . target_name :: text NOT NULL DEFAULT ''::text
staff_credit_logs . target_email :: text NOT NULL DEFAULT ''::text
staff_credit_logs . delta :: numeric NOT NULL
staff_credit_logs . balance_after :: numeric NOT NULL
staff_credit_logs . reason :: text NOT NULL DEFAULT ''::text
staff_credit_logs . created_at :: timestamp with time zone NOT NULL DEFAULT now()
support_messages . id :: uuid NOT NULL DEFAULT gen_random_uuid()
support_messages . ticket_id :: uuid NOT NULL
support_messages . author_id :: text NOT NULL
support_messages . author_name :: text NOT NULL DEFAULT ''::text
support_messages . is_admin :: boolean NOT NULL DEFAULT false
support_messages . body :: text NOT NULL
support_messages . created_at :: timestamp with time zone NOT NULL DEFAULT now()
support_tickets . id :: uuid NOT NULL DEFAULT gen_random_uuid()
support_tickets . user_id :: text NOT NULL
support_tickets . user_name :: text NOT NULL DEFAULT ''::text
support_tickets . user_email :: text NOT NULL DEFAULT ''::text
support_tickets . subject :: text NOT NULL DEFAULT ''::text
support_tickets . category :: text NOT NULL DEFAULT 'geral'::text
support_tickets . status :: text NOT NULL DEFAULT 'aberto'::text
support_tickets . closed_by :: text
support_tickets . closed_at :: timestamp with time zone
support_tickets . created_at :: timestamp with time zone NOT NULL DEFAULT now()
support_tickets . updated_at :: timestamp with time zone NOT NULL DEFAULT now()
suppressed_emails . id :: uuid NOT NULL DEFAULT gen_random_uuid()
suppressed_emails . email :: text NOT NULL
suppressed_emails . reason :: text NOT NULL
suppressed_emails . metadata :: jsonb
suppressed_emails . created_at :: timestamp with time zone NOT NULL DEFAULT now()
template_alignments . doc_type :: text NOT NULL
template_alignments . positions :: jsonb NOT NULL
template_alignments . updated_by :: uuid
template_alignments . updated_at :: timestamp with time zone NOT NULL DEFAULT now()
user_roles . id :: uuid NOT NULL DEFAULT gen_random_uuid()
user_roles . user_id :: text NOT NULL
user_roles . cargo :: USER-DEFINED NOT NULL
user_roles . assigned_at :: timestamp with time zone NOT NULL DEFAULT now()
user_roles . assigned_by :: text
```

## ANEXO B — POLÍTICAS RLS

```sql
CREATE POLICY "Admins can manage atestados" ON public.atestados AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Admin can manage banned devices" ON public.banned_devices AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Admin can manage blocked users" ON public.blocked_users AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Admin can manage credit transactions" ON public.credit_transactions AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can select own credit transactions" ON public.credit_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Admin can manage all deposits" ON public.deposits AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can insert own deposits" ON public.deposits AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can select own deposits" ON public.deposits AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Admin can manage codes" ON public.document_codes AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can insert own codes" ON public.document_codes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can revoke own codes" ON public.document_codes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid())::text = user_id))
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can select own codes" ON public.document_codes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Admin can select all documents" ON public.documents AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can delete documents" ON public.documents AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Owner can insert documents" ON public.documents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can select documents" ON public.documents AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Owner can update documents" ON public.documents AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid())::text = user_id))
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Service role can insert send log" ON public.email_send_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can read send log" ON public.email_send_log AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can update send log" ON public.email_send_log AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can manage send state" ON public.email_send_state AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Admin can manage all transactions" ON public.financial_transactions AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can select own transactions" ON public.financial_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Admin can select all logs" ON public.generation_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can insert own logs" ON public.generation_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can select own logs" ON public.generation_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Admin can manage all warnings" ON public.pix_warnings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can insert own warnings" ON public.pix_warnings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can select own warnings" ON public.pix_warnings AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Owner can update own warnings" ON public.pix_warnings AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid())::text = user_id))
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Admin can update all profiles" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can insert profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can select profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Owner can update own name and email" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid())::text = user_id))
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Staff can select non-admin profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_staff(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_cargo) OR (user_id = (auth.uid())::text) OR (NOT is_admin_user(user_id)))));
CREATE POLICY "Admins podem ver receitas" ON public.receitas AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can insert own recharge" ON public.recharge_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can select own recharge" ON public.recharge_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Admins can view staff action logs" ON public.staff_action_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Admins can view staff credit logs" ON public.staff_credit_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Participants can insert messages" ON public.support_messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((author_id = (auth.uid())::text) AND ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND (t.user_id = (auth.uid())::text) AND (t.status = 'aberto'::text)))) OR is_staff(auth.uid()))));
CREATE POLICY "Participants can select messages" ON public.support_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND ((t.user_id = (auth.uid())::text) OR (is_staff(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_cargo) OR (NOT is_admin_user(t.user_id)))))))));
CREATE POLICY "Owner can insert own tickets" ON public.support_tickets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Owner can select own tickets" ON public.support_tickets AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
CREATE POLICY "Owner can update own tickets" ON public.support_tickets AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid())::text = user_id))
  WITH CHECK (((auth.uid())::text = user_id));
CREATE POLICY "Staff can manage non-admin tickets" ON public.support_tickets AS PERMISSIVE FOR ALL TO authenticated
  USING ((is_staff(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_cargo) OR (user_id = (auth.uid())::text) OR (NOT is_admin_user(user_id)))))
  WITH CHECK ((is_staff(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_cargo) OR (user_id = (auth.uid())::text) OR (NOT is_admin_user(user_id)))));
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'service_role'::text));
CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails AS PERMISSIVE FOR SELECT TO public
  USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Admins manage alignments" ON public.template_alignments AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Logged users can read alignments" ON public.template_alignments AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Admin can manage all roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
CREATE POLICY "Owner can view own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id));
```

## ANEXO C — FUNÇÕES DO BANCO

```sql
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_target_user_id text, _delta numeric, _reason text DEFAULT ''::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor text := (auth.uid())::text;
  _new numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _delta IS NULL OR _delta = 0 OR abs(_delta) > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.profiles
     SET credits = GREATEST(0, credits + _delta)
   WHERE user_id = _target_user_id
  RETURNING credits INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  VALUES (_target_user_id, _actor,
          CASE WHEN _delta > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
          abs(_delta), _new, COALESCE(_reason, ''));

  RETURN _new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_ban_user(_target_user_id text, _reason text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _p record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _target_user_id = (auth.uid())::text THEN
    RAISE EXCEPTION 'cannot_ban_self';
  END IF;

  SELECT name, email INTO _p FROM public.profiles WHERE user_id = _target_user_id;

  INSERT INTO public.blocked_users(user_id, user_name, user_email, reason, status)
  VALUES (_target_user_id, COALESCE(_p.name,''), COALESCE(_p.email,''), COALESCE(_reason,''), 'bloqueado');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_clear_role(_target_user_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _target_user_id = (auth.uid())::text THEN
    RAISE EXCEPTION 'cannot_change_self';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(_target_user_id text, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo)
     AND public.is_admin_user(_target_user_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('pendente','aprovado','rejeitado') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  PERFORM set_config('app.status_op', '1', true);
  UPDATE public.profiles
     SET status = _status,
         approved_at = CASE WHEN _status = 'aprovado' THEN now() ELSE NULL END,
         approved_by = (auth.uid())::text
   WHERE user_id = _target_user_id;
  PERFORM set_config('app.status_op', '0', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_plan(_target_user_id text, _plan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _plan NOT IN ('free','dealer','master','diamond') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  UPDATE public.profiles SET plano = _plan WHERE user_id = _target_user_id;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  SELECT _target_user_id, (auth.uid())::text, 'plan', 0, credits, 'plano: ' || _plan
    FROM public.profiles WHERE user_id = _target_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_role(_target_user_id text, _cargo app_cargo)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  INSERT INTO public.user_roles(user_id, cargo, assigned_by)
  VALUES (_target_user_id, _cargo, (auth.uid())::text);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_verified(_target_user_id text, _verified boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo)
     AND public.is_admin_user(_target_user_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM set_config('app.status_op', '1', true);
  UPDATE public.profiles
     SET verified = _verified,
         verified_at = CASE WHEN _verified THEN now() ELSE NULL END,
         verified_by = CASE WHEN _verified THEN (auth.uid())::text ELSE NULL END
   WHERE user_id = _target_user_id;
  PERFORM set_config('app.status_op', '0', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_unban_user(_target_user_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.blocked_users WHERE user_id = _target_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  DELETE FROM public.login_attempts WHERE created_at < now() - interval '1 hour';
$function$
;

CREATE OR REPLACE FUNCTION public.consume_credits(_amount numeric, _reason text DEFAULT 'geracao'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid text := (auth.uid())::text;
  _new numeric;
  _plan text;
  _factor numeric := 1;
  _charge numeric;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users WHERE user_id = _uid AND status = 'bloqueado') THEN
    RAISE EXCEPTION 'user_blocked';
  END IF;

  SELECT plano INTO _plan FROM public.profiles WHERE user_id = _uid;
  IF _plan IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  _factor := CASE _plan
    WHEN 'dealer' THEN 0.75
    WHEN 'master' THEN 0.5
    WHEN 'diamond' THEN 0
    ELSE 1
  END;

  _charge := round(_amount * _factor, 2);

  IF _charge <= 0 THEN
    SELECT credits INTO _new FROM public.profiles WHERE user_id = _uid;
    INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
    VALUES (_uid, _uid, 'debit', 0, _new, COALESCE(_reason, 'geracao') || ' (plano ' || _plan || ' 100% off)');
    RETURN _new;
  END IF;

  PERFORM set_config('app.credit_op', '1', true);

  UPDATE public.profiles
     SET credits = credits - _charge
   WHERE user_id = _uid
     AND credits >= _charge
  RETURNING credits INTO _new;

  PERFORM set_config('app.credit_op', '0', true);

  IF _new IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  VALUES (_uid, _uid, 'debit', _charge, _new, COALESCE(_reason, 'geracao'));

  RETURN _new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.email_queue_dispatch()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
     AND NOT EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
    BEGIN
      -- Serialize disarm against email_queue_wake on a shared advisory lock, then
      -- re-read under it: an enqueue racing the unschedule either committed (we
      -- see its row and leave the cron) or waits and re-arms after we commit.
      PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
      IF EXISTS (SELECT 1 FROM pgmq.q_auth_emails)
         OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails) THEN
        RETURN;
      END IF;
      PERFORM cron.unschedule('process-email-queue');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_dispatch: cron unschedule failed: %', SQLERRM;
    END;
    RETURN;
  END IF;

  IF (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now() THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://doycwownddyxfqntifca.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.email_queue_wake()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Runs inside the enqueue transaction; the outer handler guarantees nothing
  -- below can roll back the customer's email. Shared advisory lock serializes
  -- arming against email_queue_dispatch's disarm.
  PERFORM pg_catalog.pg_advisory_xact_lock(7700000000000001);
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue') THEN
    BEGIN
      PERFORM cron.schedule('process-email-queue', '5 seconds', $cron$ SELECT public.email_queue_dispatch(); $cron$);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'email_queue_wake: cron schedule failed: %', SQLERRM;
    END;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://doycwownddyxfqntifca.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'email_queue_wake failed (enqueue preserved): %', SQLERRM;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _cargo app_cargo)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id::text
      AND cargo = _cargo
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND cargo = 'admin'::app_cargo
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id::text
      AND cargo IN ('admin'::app_cargo, 'gerente'::app_cargo)
  )
$function$
;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_profile_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.credit_op', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('role', true) = 'service_role'
     OR session_user = 'service_role'
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RETURN NEW;
  END IF;

  IF NEW.credits IS DISTINCT FROM OLD.credits THEN
    RAISE EXCEPTION 'Only administrators can modify credits';
  END IF;

  IF NEW.plano IS DISTINCT FROM OLD.plano THEN
    RAISE EXCEPTION 'Only administrators can modify plan';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_profile_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.status_op', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only administrators can modify account status';
  END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    RAISE EXCEPTION 'Only staff can modify account verification';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.staff_adjust_credits(_target_user_id text, _delta numeric, _reason text DEFAULT ''::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor text := (auth.uid())::text;
  _is_admin boolean := public.has_role(auth.uid(), 'admin'::app_cargo);
  _is_gerente boolean := public.has_role(auth.uid(), 'gerente'::app_cargo);
  _actor_p record;
  _target_p record;
  _new numeric;
BEGIN
  IF _actor IS NULL OR NOT (_is_admin OR _is_gerente) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _delta IS NULL OR _delta = 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _is_admin THEN
    IF abs(_delta) > 1000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  ELSE
    IF abs(_delta) > 5 THEN RAISE EXCEPTION 'limit_exceeded'; END IF;
    IF _target_user_id = _actor THEN RAISE EXCEPTION 'cannot_change_self'; END IF;
    IF public.is_admin_user(_target_user_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;

  SELECT name, email INTO _actor_p FROM public.profiles WHERE user_id = _actor;
  SELECT name, email INTO _target_p FROM public.profiles WHERE user_id = _target_user_id;
  IF _target_p IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  PERFORM set_config('app.credit_op', '1', true);
  UPDATE public.profiles
     SET credits = GREATEST(0, credits + _delta)
   WHERE user_id = _target_user_id
  RETURNING credits INTO _new;
  PERFORM set_config('app.credit_op', '0', true);

  IF _new IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  VALUES (_target_user_id, _actor,
          CASE WHEN _delta > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
          abs(_delta), _new, COALESCE(_reason, ''));

  INSERT INTO public.staff_credit_logs(
    actor_id, actor_name, actor_email, actor_cargo,
    target_user_id, target_name, target_email,
    delta, balance_after, reason)
  VALUES (_actor, COALESCE(_actor_p.name,''), COALESCE(_actor_p.email,''),
          CASE WHEN _is_admin THEN 'admin' ELSE 'gerente' END,
          _target_user_id, COALESCE(_target_p.name,''), COALESCE(_target_p.email,''),
          _delta, _new, COALESCE(_reason, ''));

  RETURN _new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trim_credit_transactions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.credit_transactions ct
  USING (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
    FROM public.credit_transactions
    WHERE user_id IN (SELECT DISTINCT user_id FROM new_rows)
  ) ranked
  WHERE ct.id = ranked.id AND ranked.rn > 50;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trim_generation_logs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.generation_logs gl
  USING (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
    FROM public.generation_logs
    WHERE user_id IN (SELECT DISTINCT user_id FROM new_rows)
  ) ranked
  WHERE gl.id = ranked.id AND ranked.rn > 50;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_atestado(_token text)
 RETURNS SETOF atestados
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select * from public.atestados where lower(token) = lower(_token) limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_receita(_token text)
 RETURNS SETOF receitas
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.receitas WHERE upper(token) = upper(_token) LIMIT 1;
$function$
;

```

## ANEXO D — TRIGGERS

```sql
CREATE TRIGGER trim_credit_transactions_trg AFTER INSERT ON public.credit_transactions REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION trim_credit_transactions();
CREATE TRIGGER trim_generation_logs_trg AFTER INSERT ON public.generation_logs REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION trim_generation_logs();
CREATE TRIGGER protect_profile_status_trg BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_status();
CREATE TRIGGER protect_profile_credits_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_credits();
CREATE TRIGGER protect_profile_credits_trg BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_credits();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## CÓDIGO — `supabase/functions/_shared/cors.ts`

```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

## CÓDIGO — `supabase/functions/_shared/elitepay.ts`

```ts
export const ELITEPAY_BASE_URL = "https://api.elitepaybr.com";

const PAID_STATES = [
  "aprovado",
  "aprovada",
  "completo",
  "completa",
  "concluido",
  "concluida",
  "pago",
  "paga",
  "completed",
  "approved",
  "paid",
  "success",
  "succeeded",
  "deposito_completo",
];

function creds() {
  return {
    clientId: Deno.env.get("ELITEPAY_API_KEY") || "",
    clientSecret: Deno.env.get("ELITEPAY_SECRET_KEY") || "",
  };
}

function isPaidStatus(value: unknown): boolean {
  const s = String(value ?? "").toLowerCase().replace(/\s/g, "_");
  return PAID_STATES.includes(s);
}

function matchesCharge(t: any, chargeId: string): boolean {
  if (!t || typeof t !== "object") return false;
  const ids = [t.id, t.ourId, t.transactionId, t.transaction_id, t.externalId, t.idTransaction];
  return ids.some((v) => v && String(v) === chargeId);
}

function extractList(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const key of ["transactions", "data", "items", "results", "records", "content"]) {
    const v = data[key];
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.transactions)) return v.transactions;
    if (v && Array.isArray(v.data)) return v.data;
  }
  return [];
}

function statusOf(t: any): unknown {
  return t?.status ?? t?.transactionState ?? t?.state ?? t?.situacao ?? t?.paymentStatus;
}

async function apiGet(path: string): Promise<{ ok: boolean; status: number; body: any }> {
  const { clientId, clientSecret } = creds();
  if (!clientId || !clientSecret) return { ok: false, status: 0, body: null };
  try {
    const res = await fetch(`${ELITEPAY_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        Accept: "application/json",
      },
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    console.error("ElitePay GET failed", path, e);
    return { ok: false, status: 0, body: null };
  }
}

/**
 * Confirma o pagamento de uma cobrança na Elite Pay.
 * Tenta o endpoint direto da transação e, em seguida, a listagem paginada.
 */
export async function confirmElitepayPayment(
  chargeId: string,
  debug?: { trace: unknown[] },
): Promise<boolean> {
  if (!chargeId) return false;

  // 1) Endpoints diretos
  const directPaths = [
    `/api/v1/transactions/${encodeURIComponent(chargeId)}`,
    `/api/v1/transaction/${encodeURIComponent(chargeId)}`,
    `/api/v1/deposit/${encodeURIComponent(chargeId)}`,
  ];
  for (const path of directPaths) {
    const r = await apiGet(path);
    debug?.trace.push({ path, status: r.status, body: r.body });
    if (!r.ok || !r.body) continue;
    const tx = r.body?.transaction || r.body?.data || r.body;
    if (tx && (matchesCharge(tx, chargeId) || tx.status || tx.transactionState)) {
      if (isPaidStatus(statusOf(tx))) return true;
    }
  }

  // 2) Listagem (com paginação simples)
  const listPaths = [
    `/api/v1/transactions?limit=100`,
    `/api/v1/transactions?page=1&limit=100`,
    `/api/v1/transactions`,
  ];
  for (const path of listPaths) {
    const r = await apiGet(path);
    debug?.trace.push({ path, status: r.status, count: extractList(r.body).length });
    if (!r.ok) continue;
    const list = extractList(r.body);
    const match = list.find((t) => matchesCharge(t, chargeId));
    if (match) {
      debug?.trace.push({ matched: match });
      return isPaidStatus(statusOf(match));
    }
  }

  return false;
}

/**
 * Aplica os efeitos de um pagamento confirmado: créditos, plano,
 * limpeza de advertências e registro do depósito. Idempotente.
 */
export async function applyPaidTransaction(supabaseAdmin: any, transaction: any): Promise<boolean> {
  if (!transaction || transaction.status === "pago") return false;

  const { data: updatedTx } = await supabaseAdmin
    .from("financial_transactions")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", transaction.id)
    .neq("status", "pago")
    .select("id")
    .maybeSingle();

  if (!updatedTx) return false;

  const userId = transaction.user_id;

  if (transaction.type === "credito" && Number(transaction.credits_amount) > 0) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile) {
      const { error: creditError } = await supabaseAdmin
        .from("profiles")
        .update({ credits: Number(profile.credits || 0) + Number(transaction.credits_amount) })
        .eq("user_id", userId);
      if (creditError) console.error("Falha ao creditar usuário:", creditError);
    }

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      actor_id: "system",
      kind: "credit",
      amount: Number(transaction.credits_amount),
      balance_after: 0,
      reason: `pix_elitepay ${transaction.elitepay_charge_id || ""}`.trim(),
    });
  } else if (transaction.type === "plano" && transaction.plan_name) {
    const planMap: Record<string, string> = { Basic: "dealer", Pro: "master", Premium: "diamond" };
    const planValue = planMap[transaction.plan_name] || String(transaction.plan_name).toLowerCase();

    const { error: planError } = await supabaseAdmin
      .from("profiles")
      .update({ plano: planValue })
      .eq("user_id", userId);
    if (planError) console.error("Falha ao aplicar plano:", planError);

    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, cargo: planValue, assigned_by: "system" },
      { onConflict: "user_id,cargo" },
    );
  }

  // Depósito confirmado: zera todas as advertências de PIX do usuário
  await supabaseAdmin
    .from("pix_warnings")
    .update({ status: "cleared", resolved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("status", ["warning", "pending"]);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name, email")
    .eq("user_id", userId)
    .maybeSingle();

  await supabaseAdmin.from("deposits").insert({
    user_id: userId,
    user_name: profile?.name || "",
    user_email: profile?.email || "",
    amount: transaction.amount,
    method: "pix_elitepay",
    status: "completed",
  });

  return true;
}
```

## CÓDIGO — `supabase/functions/create-pix-charge/index.ts`

```ts
// PIX charge (Elite Pay) — redeploy v2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { ELITEPAY_BASE_URL, applyPaidTransaction, confirmElitepayPayment } from "../_shared/elitepay.ts";

const PLAN_BASE_PRICES: Record<string, number> = { Basic: 150, Pro: 450, Premium: 999.99 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidPurchase(type: string, amount: number, creditsAmount?: number, planName?: string): boolean {
  if (type === "credito") {
    if (!Number.isInteger(creditsAmount) || (creditsAmount as number) <= 0 || (creditsAmount as number) > 1000) return false;
    if (amount < 1 || amount > 15000) return false;
    const perUnit = amount / (creditsAmount as number);
    return perUnit >= 8 && perUnit <= 25;
  }
  if (type === "plano") {
    if (!planName || !(planName in PLAN_BASE_PRICES)) return false;
    return Math.abs(amount - PLAN_BASE_PRICES[planName]) < 0.01;
  }
  return false;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authUser) {
      return json({ error: "Não autorizado" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { type, amount, credits_amount, plan_name } = body ?? {};

    if (!type || typeof amount !== "number" || amount <= 0) {
      return json({ error: "Dados inválidos" }, 400);
    }
    if (type !== "credito" && type !== "plano") {
      return json({ error: "Tipo inválido" }, 400);
    }
    if (!isValidPurchase(type, amount, credits_amount, plan_name)) {
      return json({ error: "Pacote inválido" }, 400);
    }

    const ELITEPAY_CLIENT_ID = Deno.env.get("ELITEPAY_API_KEY");
    const ELITEPAY_CLIENT_SECRET = Deno.env.get("ELITEPAY_SECRET_KEY");
    if (!ELITEPAY_CLIENT_ID || !ELITEPAY_CLIENT_SECRET) {
      console.error("Elitepay credentials not configured");
      return json({ error: "Gateway de pagamento não configurado" }, 500);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reuse a recent pending charge (< 10 min) to avoid duplicates
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: existingCharge } = await supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("user_id", authUser.id)
      .eq("type", type)
      .eq("amount", amount)
      .eq("status", "gerado")
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCharge?.pix_code) {
      if (existingCharge.elitepay_charge_id) {
        const confirmed = await confirmElitepayPayment(existingCharge.elitepay_charge_id);
        if (confirmed) {
          await applyPaidTransaction(supabaseAdmin, existingCharge);
          existingCharge.status = "pago";
        }
      }
      return json({
        transaction_id: existingCharge.id,
        pix_code: existingCharge.pix_code,
        qr_code_base64: existingCharge.qr_code_base64 || "",
        amount,
        status: existingCharge.status || "gerado",
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name, email")
      .eq("user_id", authUser.id)
      .maybeSingle();

    const description = type === "credito"
      ? `${credits_amount} creditos - Bellarus`
      : `Plano ${plan_name} - Bellarus`;

    const elitepayResponse = await fetch(`${ELITEPAY_BASE_URL}/api/v1/deposit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": ELITEPAY_CLIENT_ID,
        "x-client-secret": ELITEPAY_CLIENT_SECRET,
      },
      body: JSON.stringify({
        amount,
        description,
        payerName: profile?.name || "Cliente Bellarus",
        payerDocument: "00000000000",
      }),
    });

    if (!elitepayResponse.ok) {
      console.error("Elitepay API error:", elitepayResponse.status, await elitepayResponse.text());
      return json({ error: "Erro ao criar cobrança no gateway" }, 502);
    }

    const chargeData = await elitepayResponse.json();
    if (!chargeData?.success) {
      console.error("Elitepay charge failed:", JSON.stringify(chargeData));
      return json({ error: "Falha ao gerar cobrança PIX" }, 502);
    }

    const transactionId = chargeData.transactionId || "";
    const qrCodeBase64 = chargeData.qrcodeUrl || "";
    const pixCode = chargeData.copyPaste || "";

    const { data: transaction, error: insertError } = await supabaseAdmin
      .from("financial_transactions")
      .insert({
        user_id: authUser.id,
        type,
        amount,
        credits_amount: credits_amount || 0,
        plan_name: plan_name || null,
        status: "gerado",
        txid: transactionId,
        elitepay_charge_id: transactionId,
        pix_code: pixCode,
        qr_code_base64: qrCodeBase64,
      })
      .select()
      .single();

    if (insertError) {
      console.error("DB insert error:", insertError);
      return json({ error: "Erro ao registrar transação" }, 500);
    }

    return json({
      transaction_id: transaction.id,
      pix_code: pixCode,
      qr_code_base64: qrCodeBase64,
      amount,
      status: "gerado",
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
```

## CÓDIGO — `supabase/functions/elitepay-webhook/index.ts`

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { applyPaidTransaction, confirmElitepayPayment } from "../_shared/elitepay.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STATE_MAP: Record<string, string> = {
  COMPLETO: "pago", CONCLUIDO: "pago", APROVADO: "pago", COMPLETED: "pago", APPROVED: "pago", PAID: "pago",
  PENDENTE: "gerado", PENDING: "gerado",
  PROCESSANDO: "processando", PROCESSING: "processando",
  FALHOU: "falhou", FAILED: "falhou", ERRO: "falhou", ERROR: "falhou",
  CANCELADO: "cancelado", CANCELLED: "cancelado",
  EXPIRADO: "expirado", EXPIRED: "expirado",
};

const EVENT_MAP: Record<string, string> = {
  DEPOSITO_COMPLETO: "pago",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const chargeId = body.transactionId || body.transaction?.transactionId || body.data?.transactionId || "";
    const transactionType = String(body.transactionType || body.type || "").toLowerCase();
    const rawStatus = String(
      body.status || body.transactionState || body.transaction?.transactionState || body.data?.transactionState || "",
    ).toUpperCase().replace(/\s/g, "");
    const event = String(body.event || "").toUpperCase();

    if (transactionType === "saque") {
      return json({ ok: true, message: "Saque ignorado" });
    }
    if (!chargeId) {
      console.error("No transactionId in webhook payload");
      return json({ error: "Missing transactionId" }, 400);
    }

    const normalizedStatus = EVENT_MAP[event] || STATE_MAP[rawStatus] || "gerado";

    const { data: transaction, error: findError } = await supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("elitepay_charge_id", chargeId)
      .maybeSingle();

    if (findError || !transaction) {
      console.error("Transaction not found:", chargeId, findError);
      return json({ error: "Transaction not found" }, 404);
    }

    if (transaction.status === "pago") {
      return json({ ok: true, message: "Already processed" });
    }

    if (normalizedStatus === "pago") {
      // O webhook é a fonte oficial do gateway. A consulta é apenas uma checagem
      // extra: se a API estiver indisponível, o crédito não pode deixar de cair.
      const confirmed = await confirmElitepayPayment(chargeId);
      if (!confirmed) {
        console.warn("ElitePay lookup indisponível; aplicando pagamento pelo webhook:", chargeId);
      }
    }


    if (normalizedStatus !== "pago") {
      await supabaseAdmin
        .from("financial_transactions")
        .update({ status: normalizedStatus })
        .eq("id", transaction.id)
        .neq("status", "pago");
      return json({ ok: true, status: normalizedStatus });
    }

    const applied = await applyPaidTransaction(supabaseAdmin, transaction);
    return json({ ok: true, status: "pago", applied });

  } catch (err) {
    console.error("Webhook error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
```

## CÓDIGO — `supabase/functions/check-pix-payment/index.ts`

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { applyPaidTransaction, confirmElitepayPayment } from "../_shared/elitepay.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authUser) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const transactionId = String(body?.transaction_id || "");
    const wantDebug = body?.debug === true;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("user_id", authUser.id);

    query = transactionId
      ? query.eq("id", transactionId)
      : query.eq("status", "gerado").order("created_at", { ascending: false }).limit(1);

    const { data: transaction } = await query.maybeSingle();
    if (!transaction) return json({ error: "Transação não encontrada" }, 404);

    if (transaction.status === "pago") {
      return json({ status: "pago", applied: false });
    }

    // Só administradores podem inspecionar a resposta bruta do gateway
    let debug: { trace: unknown[] } | undefined;
    if (wantDebug) {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: authUser.id,
        _cargo: "admin",
      });
      if (isAdmin) debug = { trace: [] };
    }

    const confirmed = await confirmElitepayPayment(transaction.elitepay_charge_id || "", debug);
    if (!confirmed) {
      return json({ status: transaction.status, applied: false, ...(debug ? { debug: debug.trace } : {}) });
    }

    const applied = await applyPaidTransaction(supabaseAdmin, transaction);
    return json({ status: "pago", applied, ...(debug ? { debug: debug.trace } : {}) });
  } catch (err) {
    console.error("check-pix-payment error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
```

## CÓDIGO — `supabase/functions/doc-ingest-proxy/index.ts`

```ts
// Proxy seguro: encaminha documentos (rg/cha) para o app externo de consulta.
// O token de ingestão fica apenas no servidor, nunca no navegador.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TARGET_URL = "https://hfkckowhrjbpjgniaakl.supabase.co/functions/v1/doc-ingest";
const INGEST_TOKEN = Deno.env.get("DOC_INGEST_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!INGEST_TOKEN) return json({ error: "missing_ingest_token" }, 500);

  let payload: { tabela?: string; dados?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const tabela = payload?.tabela;
  const dados = payload?.dados;
  if (tabela !== "rg" && tabela !== "cha") return json({ error: "invalid_tabela" }, 400);
  if (!dados || typeof dados !== "object" || !dados.documento_id) {
    return json({ error: "invalid_dados" }, 400);
  }

  try {
    const upstream = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-token": INGEST_TOKEN,
      },
      body: JSON.stringify({ tabela, dados }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error(`doc-ingest upstream [${upstream.status}]:`, text.slice(0, 500));
      return json({ error: "upstream_error", status: upstream.status, detail: text.slice(0, 500) }, 502);
    }
    return json({ ok: true, upstream: text.slice(0, 500) });
  } catch (err) {
    console.error("doc-ingest proxy failed:", err);
    return json({ error: String(err) }, 500);
  }
});
```

## CÓDIGO — `supabase/functions/register-partner-document/index.ts`

```ts
// Endpoint público de registro para sites parceiros.
// Permite que um app hospedado em OUTRO projeto grave atestados/receitas Unimed
// no banco lido pelo validador https://verificamemed.site.
//
// Segurança: exige o header `x-partner-token` (secret PARTNER_INGEST_TOKEN).
// O parceiro só consegue INSERIR documentos — nunca ler ou apagar dados.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VALIDACAO_BASE_URL = "https://verificamemed.site";
const TOKEN_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: unknown): string {
  return s(v).replace(/\D/g, "");
}

function toBrDate(v: unknown): string {
  const raw = s(v).trim();
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[0];
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : raw;
}

function gerarToken(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

function gerarCodigo(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

function splitMedico(nome: unknown): { nome: string; genero: "DR" | "DRA" } {
  const raw = s(nome).trim();
  const genero: "DR" | "DRA" = /^dra\.?\s/i.test(raw) || /^dr\s*\(?\s*a\s*\)?\.?\s/i.test(raw)
    ? "DRA"
    : "DR";
  return { nome: raw.replace(/^dr\s*\(?\s*a?\s*\)?\.?\s+/i, "").trim(), genero };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

const TIPOS = ["comum", "generico", "controlado", "tarja_vermelha", "tarja_preta"];

interface MedIn {
  nome?: string;
  substancia?: string;
  prescricao?: string;
  posologia?: string;
  quantidade?: string;
  tipo?: string;
  farmaciaPopular?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Headers": "content-type, x-partner-token" },
    });
  }
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("PARTNER_INGEST_TOKEN") ?? "";
  const provided = req.headers.get("x-partner-token") ?? "";
  if (!expected || provided !== expected) {
    return json({ success: false, error: "Token de integração inválido." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "JSON inválido." }, 400);
  }

  const tipo = s(body.tipo).toLowerCase();
  const d = (body.dados ?? {}) as Record<string, unknown>;
  const supabase = serviceClient();

  const token = gerarToken(7);
  const codigo = gerarCodigo();

  try {
    if (tipo === "atestado") {
      const medico = splitMedico(d.medico ?? d.nome_medico);
      const dias = Math.min(14, Math.max(1, Number(d.dias ?? 1) || 1));
      const row = {
        token,
        codigo_acesso: codigo,
        emissao_atestado: s(d.emissao).trim() || toBrDate(d.data_emissao),
        nome_paciente: s(d.paciente ?? d.nome_paciente).trim(),
        cpf: s(d.cpf).trim(),
        data_nascimento: toBrDate(d.nascimento ?? d.data_nascimento),
        endereco: s(d.endereco).trim() || null,
        nome_medico: medico.nome,
        genero_medico: medico.genero,
        crm: onlyDigits(d.crm),
        crm_uf: (s(d.crm_uf).replace(/^CRM[-\s]?/i, "").trim() || "RJ").toUpperCase(),
        endereco_clinica: s(d.endereco_clinica).trim() || null,
        texto_atestado: s(d.texto_atestado).trim() ||
          (dias <= 1
            ? "atesto que o(a) paciente acima necessitou de repouso domiciliar por razões médicas no dia de hoje."
            : `atesto que o(a) paciente acima necessitou de afastamento de suas atividades por ${
              String(dias).padStart(2, "0")
            } dias por razões médicas.`),
        quantidade: dias,
        pdf_url: s(d.pdf_url).trim() || null,
      };

      const faltando: string[] = [];
      if (!row.nome_paciente) faltando.push("paciente");
      if (!row.cpf) faltando.push("cpf");
      if (!row.data_nascimento) faltando.push("nascimento");
      if (!row.nome_medico) faltando.push("medico");
      if (!row.crm) faltando.push("crm");
      if (faltando.length) {
        return json({ success: false, error: `Campos obrigatórios: ${faltando.join(", ")}` }, 400);
      }

      const { error } = await supabase.from("atestados").insert(row);
      if (error) return json({ success: false, error: error.message }, 500);

      return json({
        success: true,
        tipo: "atestado",
        token,
        codigo_acesso: codigo,
        validation_url: `${VALIDACAO_BASE_URL}/atestado?token=${token}&codigo=${codigo}`,
      });
    }

    if (tipo === "receita") {
      const medico = splitMedico(d.medico ?? d.nome_medico);
      const meds = Array.isArray(body.medicamentos) ? (body.medicamentos as MedIn[]) : [];
      const row = {
        token,
        codigo_acesso: codigo,
        emissao_receita: s(d.emissao).trim() || toBrDate(d.data_emissao),
        nome_paciente: s(d.paciente ?? d.nome_paciente).trim(),
        cpf: s(d.cpf).trim(),
        data_nascimento: toBrDate(d.nascimento ?? d.data_nascimento),
        endereco: s(d.endereco).trim() || null,
        nome_medico: medico.nome,
        genero_medico: medico.genero,
        crm: onlyDigits(d.crm),
        crm_uf: (s(d.crm_uf).replace(/^CRM[-\s]?/i, "").trim() || "").toUpperCase(),
        endereco_clinica: s(d.endereco_clinica).trim() || null,
        medicamentos: meds.map((m) => ({
          nome: s(m.nome),
          substancia: s(m.substancia) || s(m.nome).replace(/\s*\(.*?\)\s*/g, " ").trim(),
          prescricao: s(m.prescricao ?? m.posologia),
          quantidade: s(m.quantidade),
          tipo: TIPOS.includes(s(m.tipo)) ? s(m.tipo) : "comum",
          imagem: "",
          farmaciaPopular: Boolean(m.farmaciaPopular),
        })),
        pdf_url: s(d.pdf_url).trim() || null,
      };

      if (!row.nome_paciente || !row.nome_medico) {
        return json({ success: false, error: "Campos obrigatórios: paciente e medico." }, 400);
      }
      if (!row.medicamentos.length) {
        return json({ success: false, error: "Envie ao menos um medicamento." }, 400);
      }

      const { error } = await supabase.from("receitas").insert(row);
      if (error) return json({ success: false, error: error.message }, 500);

      return json({
        success: true,
        tipo: "receita",
        token,
        codigo_acesso: codigo,
        validation_url: `${VALIDACAO_BASE_URL}/validar?token=${token}&codigo=${codigo}`,
      });
    }

    return json({ success: false, error: 'Campo "tipo" deve ser "atestado" ou "receita".' }, 400);
  } catch (err) {
    console.error("register-partner-document:", err);
    return json({ success: false, error: "Erro interno ao registrar documento." }, 500);
  }
});
```

## CÓDIGO — `supabase/functions/verify-atestado/index.ts`

```ts
// Verificação de atestado (Unimed) para o portal externo.
// Aceita:
//   - x-api-key      : chave secreta (backend-a-backend)
//   - x-public-token : token público de leitura (pode ficar no frontend do validador)
// Não é mais uma RPC pública aberta.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key, x-public-token",
  "Access-Control-Max-Age": "86400",
};

const TOKEN_RE = /^[A-Za-z0-9-]{4,64}$/;

function maskCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
  }

  const apiKey = req.headers.get("x-api-key")
    ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const publicToken = req.headers.get("x-public-token") ?? "";

  const expectedApiKey = Deno.env.get("ATESTADO_VERIFY_API_KEY") ?? "";
  const expectedPublicToken = Deno.env.get("ATESTADO_PUBLIC_TOKEN") ?? "";

  const isApiKeyValid = expectedApiKey && apiKey && timingSafeEqual(apiKey, expectedApiKey);
  const isPublicTokenValid = expectedPublicToken && publicToken && timingSafeEqual(publicToken, expectedPublicToken);

  if (!isApiKeyValid && !isPublicTokenValid) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const codigo = typeof body.codigo === "string" ? body.codigo.trim() : "";

  if (!TOKEN_RE.test(token)) {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: row, error } = await supabase
    .from("atestados")
    .select(
      "token, codigo_acesso, emissao_atestado, nome_paciente, cpf, data_nascimento, endereco, nome_medico, genero_medico, crm, crm_uf, endereco_clinica, texto_atestado, quantidade, pdf_url, created_at",
    )
    .ilike("token", token)
    .maybeSingle();

  if (error) {
    console.error("lookup error", error.message);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers });
  }

  if (!row) {
    return new Response(JSON.stringify({ valid: false, error: "not_found" }), { status: 404, headers });
  }

  // Código de acesso é obrigatório quando o documento tem um
  if (row.codigo_acesso && row.codigo_acesso !== codigo) {
    return new Response(JSON.stringify({ valid: false, error: "codigo_invalido" }), { status: 403, headers });
  }

  return new Response(
    JSON.stringify({
      valid: true,
      atestado: {
        token: row.token,
        codigo_acesso: row.codigo_acesso,
        paciente: row.nome_paciente,
        cpf: maskCpf(row.cpf),
        data_nascimento: row.data_nascimento,
        endereco: row.endereco,
        profissional: row.nome_medico,
        genero_profissional: row.genero_medico,
        crm: `${row.crm}/${row.crm_uf}`,
        endereco_clinica: row.endereco_clinica,
        emissao: row.emissao_atestado,
        dias_afastamento: row.quantidade,
        texto: row.texto_atestado,
        pdf_url: row.pdf_url,
        registrado_em: row.created_at,
      },
    }),
    { status: 200, headers },
  );
});
```

## CÓDIGO — `supabase/functions/rg-foto/index.ts`

```ts
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
```

## CÓDIGO — `supabase/functions/generate-cnh-pdf/validacao.ts`

```ts
// Integração com o Site 2 (validação de CNH por QR Code)
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL =
  "https://senetran-consultacarteira-digital-transito-vio.info";

const REGISTER_ENDPOINT =
  "https://nqjlmydtlckruwiqtlbe.supabase.co/functions/v1/register-document";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function yesNo(v: string): "SIM" | "NAO" {
  const t = v.trim().toUpperCase();
  return t === "SIM" || t === "S" || t === "TRUE" ? "SIM" : "NAO";
}

function sexo(genero: string): string {
  const t = genero.trim().toUpperCase();
  if (t.startsWith("F")) return "F";
  if (t.startsWith("M")) return "M";
  return "";
}

/** Data estável no formato DD/MM/AAAA quando possível. */
function dateOnly(v: string): string {
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v.trim();
}

/** ID determinístico: reenviar o mesmo documento atualiza o registro. */
export function buildDocumentoId(d: Record<string, string>): string {
  const cpf = onlyDigits(s(d.cpf)) || "00000000000";
  const reg = onlyDigits(s(d.registro)) || "0";
  return `CNH-${cpf}-${reg}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

/**
 * Cadastra o documento no Site 2 e devolve a URL que deve virar QR Code.
 * Nunca lança: se a API falhar, cai no fallback determinístico da URL.
 */
export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;

  const nome = s(d.nome_completo).toUpperCase();
  const uf = (s(d.cidade_estado).split(",").pop() || "").trim().toUpperCase();
  const local = s(d.cidade_estado).split(",")[0].trim().toUpperCase();

  const payload: Record<string, string> = {
    documento_id: documentoId,
    nome,
    nome_civil: nome,
    doc_identidade: s(d.rg).toUpperCase(),
    cpf: s(d.cpf),
    data_nascimento: dateOnly(s(d.data_nascimento)),
    nacionalidade: s(d.nacionalidade).toUpperCase() || "BRASILEIRA",
    sexo: sexo(s(d.genero)),
    filiacao_pai: s(d.nome_pai).toUpperCase(),
    filiacao_mae: s(d.nome_mae).toUpperCase(),
    permissao: yesNo(s(d.cnh_definitiva)) === "SIM" ? "NAO" : "SIM",
    acc: s(d.observacoes).toUpperCase().includes("ACC") ? "SIM" : "NAO",
    cat_hab: s(d.categoria).toUpperCase(),
    n_registro: s(d.registro),
    validade: dateOnly(s(d.data_validade)),
    primeira_habilitacao: dateOnly(s(d.data_primeira_habilitacao) || s(d.data_primeira_hab)),
    observacoes: s(d.observacoes).toUpperCase(),
    local,
    uf,
    data_emissao: dateOnly(s(d.data_emissao)),
    numero_validacao_cnh: s(d.numero_espelho),
    codigo_validacao: s(d.codigo_seguranca),
    numero_formulario_renach: s(d.renach),
    status: "valido",
    foto: s(d.foto_base64) || s(d.foto),
  };

  const token = Deno.env.get("VALIDACAO_API_TOKEN") || "";
  if (!token) {
    console.warn("VALIDACAO_API_TOKEN ausente — QR gerado sem cadastro remoto");
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: "missing_token" };
  }

  try {
    // Não deixa o cadastro remoto travar a geração do PDF
    const res = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Token": token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`register-document falhou [${res.status}]: ${text}`);
      return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: text };
    }

    let json: { qr_code_url?: string; success?: boolean } = {};
    try {
      json = JSON.parse(text);
    } catch { /* resposta não-JSON */ }

    return {
      documentoId,
      qrCodeUrl: json.qr_code_url || fallbackUrl,
      registered: json.success !== false,
    };
  } catch (err) {
    console.error("register-document erro de rede:", err);
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: String(err) };
  }
}

/** QR Code vetorial (SVG) — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  // Força uma versão alta (módulos menores/mais densos, como no documento oficial)
  const MIN_TYPE = 12; // 65x65 módulos
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  const quiet = 0; // zona de silêncio (mesma moldura branca da referência)
  const total = count + quiet * 2;
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
```

## CÓDIGO — `supabase/functions/generate-rg-pdf/validacao.ts`

```ts
// Integração com o Site 2 (validação por QR Code) — RG Digital / CIN
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL = "https://certificado-qrcode-vio.info";

const REGISTER_ENDPOINT =
  "https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function sexo(genero: string): string {
  const t = genero.trim().toUpperCase();
  if (t.startsWith("F")) return "F";
  if (t.startsWith("M")) return "M";
  return "";
}

function dateOnly(v: string): string {
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v.trim();
}

/** ID determinístico: reenviar o mesmo documento atualiza o registro (upsert). */
export function buildDocumentoId(d: Record<string, string>): string {
  const cpf = onlyDigits(s(d.cpf)) || "00000000000";
  return `RG-${cpf}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

/**
 * Cadastra o RG no Site 2 e devolve a URL que vira QR Code.
 * Nunca lança: se a API falhar, cai no fallback determinístico.
 */
export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar-rg?id=${encodeURIComponent(documentoId)}`;

  const nome = s(d.nome_completo).toUpperCase();
  const doador = s(d.doador).trim().toUpperCase();

  // A foto precisa chegar como URL https pública (o portal usa direto em <img src>).
  // Quando a URL pública existe, NÃO repetimos o base64 gigante: o POST caía de
  // vários MB para poucos KB, que era o maior custo do documento final.
  const fotoRaw = s(d.foto) || s(d.foto_base64);
  const fotoDataUrl = fotoRaw
    ? (fotoRaw.startsWith("data:") ? fotoRaw : `data:image/png;base64,${fotoRaw}`)
    : "";
  const publicUrl = s(d.foto_public_url);
  const fotoUrl = publicUrl || fotoDataUrl;
  const fotoPura = publicUrl ? "" : (fotoDataUrl.includes(",") ? fotoDataUrl.split(",")[1] : "");



  const payload: Record<string, string> = {
    tipo: "rg-digital",
    documento_id: documentoId,
    nome,
    nome_completo: nome,
    cpf: s(d.cpf),
    rg: s(d.registro_geral).toUpperCase(),
    data_nascimento: dateOnly(s(d.data_nascimento)),
    naturalidade: s(d.naturalidade).toUpperCase(),
    sexo: sexo(s(d.sexo)),
    nacionalidade: s(d.nacionalidade).toUpperCase() || "BRASILEIRA",
    data_emissao: dateOnly(s(d.data_emissao)),
    data_validade: dateOnly(s(d.data_validade)),
    nome_pai: s(d.filiacao2).toUpperCase(),
    nome_mae: s(d.filiacao1).toUpperCase(),
    orgao_expedidor: s(d.orgao_expedidor).toUpperCase(),
    local_emissao: s(d.local_emissao).toUpperCase(),
    uf_orgao: s(d.uf_orgao).toUpperCase() || s(d.local_emissao).toUpperCase(),
    estado_civil: s(d.estado_civil).toUpperCase(),
    doador_orgaos: doador.startsWith("S") ? "SIM" : "NAO",
    codigo_seguranca: s(d.codigo_seguranca) || s(d.codigo_validacao),
    status: "valido",
    // --- dados complementares ---
    nome_social: s(d.nome_social).toUpperCase(),
    estado: s(d.estado).toUpperCase(),
    tipo_sanguineo: s(d.tipo_sanguineo).toUpperCase(),
    fator_rh: s(d.fator_rh).toUpperCase(),
    titulo_eleitor: s(d.titulo_eleitor),
    certidao: s(d.certidao).toUpperCase(),
    cnh: s(d.cnh),
    categoria_cnh: s(d.categoria).toUpperCase(),
    pis_pasep: s(d.pis_pasep),
    nis: s(d.nis),
    nit: s(d.nit),
    ctps: s(d.ctps).toUpperCase(),
    dni: s(d.dni),
    cns: s(d.cns),
    observacao_saude: s(d.observacao_saude).toUpperCase(),
    via: s(d.via),
    // enviado em vários formatos/chaves para cobrir o que o portal espera.
    // `foto_base64` só aceita base64 de verdade — mandar URL aí faz o portal
    // devolver 500 e bloqueia a geração do PDF.
    foto_base64: publicUrl ? "" : fotoDataUrl,
    foto: fotoUrl,
    foto_url: fotoUrl,
    foto_3x4: fotoUrl,
    photo_url: fotoUrl,
    imagem: fotoUrl,
    foto_raw: fotoPura,

  };



  // O portal já alternou entre a credencial exclusiva do RG e a credencial
  // principal desta mesma API. Mantemos ambas somente no servidor e, em caso
  // de 401, tentamos a segunda antes de interromper a geração. Isso evita que
  // uma rotação parcial do portal derrube o RG sem jamais expor os tokens.
  const tokens = Array.from(new Set([
    Deno.env.get("RG_VALIDACAO_BELLARUS_TOKEN") || "",
    Deno.env.get("RG_VALIDACAO_API_TOKEN") || "",
    Deno.env.get("VALIDACAO_API_TOKEN") || "",
  ].filter(Boolean)));

  if (tokens.length === 0) {
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: "Token de validação não configurado." };
  }

  try {
    let lastError = "Token de autenticação inválido.";
    for (const [index, token] of tokens.entries()) {
      const res = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Token": token },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const text = await res.text();
      if (!res.ok) {
        lastError = text;
        console.error(`register-document falhou [${res.status}] credencial=${index + 1}/${tokens.length}: ${text}`);
        if (res.status === 401 && index < tokens.length - 1) continue;
        return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: text };
      }

      let json: { qr_code_url?: string; success?: boolean } = {};
      try {
        json = JSON.parse(text);
      } catch { /* resposta não-JSON */ }

      if (json.success === false) {
        return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: text };
      }

      return {
        documentoId,
        // A API pode devolver um domínio placeholder — usamos sempre o oficial
        qrCodeUrl: fallbackUrl,
        registered: true,
      };
    }

    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: lastError };
  } catch (err) {
    console.error("register-document erro de rede:", err);
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: String(err) };
  }
}


/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12; // 65x65 módulos
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  const quiet = 0;
  const total = count + quiet * 2;
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
```

## CÓDIGO — `supabase/functions/generate-cha-pdf/validacao.ts`

```ts
// Integração com o portal de validação — CNH Marítima (CHA - Carteira de
// Habilitação de Amador). O domínio/endpoint podem ser trocados por variável
// de ambiente sem precisar alterar o código.
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL =
  Deno.env.get("CHA_VALIDACAO_BASE_URL") ||
  "https://cidadaniagov-info.site/";

const REGISTER_ENDPOINT =
  Deno.env.get("CHA_REGISTER_ENDPOINT") ||
  "https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function dateOnly(v: string): string {
  const m = s(v).match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : s(v).trim();
}

/** ID determinístico: reenviar o mesmo documento atualiza o registro. */
export function buildDocumentoId(d: Record<string, string>): string {
  const cpf = onlyDigits(s(d.cpf)) || "00000000000";
  return `CHA-${cpf}`;
}

async function buildHash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar-cha?id=${encodeURIComponent(documentoId)}`;

  const categoria = [s(d.categoria), s(d.categoria_en)]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const payload: Record<string, string> = {
    tipo: "cha",
    documento_id: documentoId,
    nome: s(d.nome).toUpperCase(),
    cpf: s(d.cpf),
    data_nascimento: dateOnly(d.nascimento),
    categoria,
    data_validade: dateOnly(d.validade),
    numero_inscricao: s(d.inscricao).toUpperCase(),
    limites_navegacao: s(d.limites).toUpperCase(),
    emissor: s(d.orgao).toUpperCase() || "MARINHA DO BRASIL",
    data_emissao: dateOnly(d.data_emissao),
    restricoes_fisicas: s(d.requisitos).toUpperCase(),
    status: "valido",
    hash: await buildHash(`${documentoId}|${s(d.nome)}|${s(d.inscricao)}`),
  };

  const foto = s(d.foto_base64) || s(d.foto);
  if (foto) payload.foto_base64 = foto;

  const token = Deno.env.get("VALIDACAO_API_TOKEN") || "site1";

  try {
    const res = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Token": token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`register-document (CHA) falhou [${res.status}]: ${text}`);
      return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: text };
    }

    let json: { qr_code_url?: string; success?: boolean } = {};
    try {
      json = JSON.parse(text);
    } catch { /* resposta não-JSON */ }

    return {
      documentoId,
      qrCodeUrl: json.qr_code_url || fallbackUrl,
      registered: json.success !== false,
    };
  } catch (err) {
    console.error("register-document (CHA) erro de rede:", err);
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: String(err) };
  }
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
```

## CÓDIGO — `supabase/functions/generate-crlv-pdf/validacao.ts`

```ts
// Integração com a plataforma de validação por QR Code — CRLV Digital
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL = "https://verificaviosenetran.digital";

const REGISTER_ENDPOINT =
  "https://gauzhddbhwanvcjmbeld.supabase.co/functions/v1/register-document";

const API_TOKEN = "bellarus-cnh-sync";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function rand(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** ID único exigido pela plataforma: CRLV-{ano}-{sequencial}. */
export function buildDocumentoId(d: Record<string, string>): string {
  const ano = s(d.exercicio).match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  return `CRLV-${ano}-${Date.now().toString(36).toUpperCase()}${rand(4)}`;
}

export function buildValidationUrl(documentoId: string): string {
  return `${VALIDACAO_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

function buildPayload(d: Record<string, string>, documentoId: string) {
  return {
    tipo: "crlv",
    documento_id: documentoId,
    nome: s(d.nome).toUpperCase(),
    cpf_cnpj: s(d.cpf_cnpj),
    placa: s(d.placa).toUpperCase(),
    codigo_renavam: s(d.renavam),
    numero_crv: s(d.numero_crv),
    chassi: s(d.chassi).toUpperCase(),
    marca_modelo: s(d.marca_modelo).toUpperCase(),
    cor: s(d.cor).toUpperCase(),
    ano_fabricacao: s(d.ano_fabricacao),
    ano_modelo: s(d.ano_modelo),
    combustivel: s(d.combustivel).toUpperCase(),
    categoria: s(d.categoria).toUpperCase(),
    especie_tipo: s(d.especie_tipo).toUpperCase(),
    estado_detran: s(d.uf).toUpperCase(),
    local: s(d.local).toUpperCase(),
    data_emissao: s(d.data),
    exercicio: s(d.exercicio),
    motor: s(d.motor).toUpperCase(),
    potencia_cilindrada: s(d.potencia).toUpperCase(),
    capacidade: s(d.capacidade),
    peso_bruto_total: s(d.peso_bruto),
    cmt: s(d.cmt),
    eixos: s(d.eixos),
    lotacao: s(d.lotacao),
    carroceria: s(d.carroceria).toUpperCase(),
    observacoes: s(d.observacoes),
    codigo_seguranca: s(d.codigo_cla),
    status: "valido",
  };
}

/** Cadastra o CRLV na plataforma; em 409 gera novo ID e tenta de novo. */
export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  let documentoId = buildDocumentoId(d);
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Token": API_TOKEN },
        body: JSON.stringify(buildPayload(d, documentoId)),
        signal: AbortSignal.timeout(10000),
      });

      const text = await res.text();

      if (res.status === 409) {
        lastError = text;
        documentoId = buildDocumentoId(d);
        continue;
      }

      if (!res.ok) {
        console.error(`register-document CRLV falhou [${res.status}]: ${text}`);
        return {
          documentoId,
          qrCodeUrl: buildValidationUrl(documentoId),
          registered: false,
          error: text,
        };
      }

      let json: { success?: boolean } = {};
      try {
        json = JSON.parse(text);
      } catch { /* resposta não-JSON */ }

      if (json.success === false) {
        return {
          documentoId,
          qrCodeUrl: buildValidationUrl(documentoId),
          registered: false,
          error: text,
        };
      }

      return { documentoId, qrCodeUrl: buildValidationUrl(documentoId), registered: true };
    } catch (err) {
      console.error("register-document CRLV erro de rede:", err);
      lastError = String(err);
      break;
    }
  }

  return {
    documentoId,
    qrCodeUrl: buildValidationUrl(documentoId),
    registered: false,
    error: lastError,
  };
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
```

## CÓDIGO — `supabase/functions/generate-craf-pdf/validacao.ts`

```ts
// QR Code do CRAF (Certificado de Registro de Arma de Fogo).
//
// O portal de validação ainda será integrado: por enquanto o QR aponta para o
// domínio oficial de validação com um código de autenticidade determinístico
// (mesmo padrão "A Autenticidade no SisGCorp <hash>" do documento real).
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const CRAF_VALIDACAO_BASE_URL =
  Deno.env.get("CRAF_VALIDACAO_BASE_URL") || "https://verificamed.website";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

/** Hash de autenticidade (32 caracteres), estável para o mesmo documento. */
export async function buildAutenticidade(d: Record<string, string>): Promise<string> {
  const base = [
    onlyDigits(s(d.cpf)),
    s(d.nome).toUpperCase(),
    s(d.numero_serie).toUpperCase(),
    s(d.numero_sigma).toUpperCase(),
    s(d.data_expedicao),
  ].join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** URL de validação — nunca usa domínio de desenvolvimento (lovable.app). */
export function buildValidacaoUrl(hash: string): string {
  const base = CRAF_VALIDACAO_BASE_URL.replace(/lovable\.app.*$/i, "").replace(/\/+$/, "") ||
    "https://verificamed.website";
  return `${base}/validar-craf?cod=${encodeURIComponent(hash)}`;
}

/* ------------------------------------------------ Validador Vio (externo) */

const CRAF_INGEST_URL = Deno.env.get("CRAF_INGEST_URL") ||
  "https://sbixggtneaplirjejejr.supabase.co/functions/v1/register-document";

/** UUID determinístico (v4-shaped) derivado dos dados — reenvio faz upsert. */
export async function buildDocumentoId(d: Record<string, string>): Promise<string> {
  const base = [
    onlyDigits(s(d.cpf)),
    s(d.numero_serie).toUpperCase(),
    s(d.numero_sigma).toUpperCase(),
  ].join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  const b = Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-4${b.slice(13, 16)}-a${b.slice(17, 20)}-${b.slice(20, 32)}`;
}

export interface CrafRegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

/** Cadastra o CRAF no validador e devolve a URL oficial do QR. */
export async function registerCrafDocument(
  d: Record<string, string>,
  fotoBase64: string,
): Promise<CrafRegisterResult> {
  const documentoId = await buildDocumentoId(d);
  const key = Deno.env.get("CRAF_INGEST_KEY_V3") || Deno.env.get("CRAF_INGEST_KEY") || "";

  if (!key) {
    return { documentoId, qrCodeUrl: "", registered: false, error: "CRAF_INGEST_KEY_V3 não configurada." };
  }
  if (!fotoBase64) {
    return { documentoId, qrCodeUrl: "", registered: false, error: "Foto 3x4 é obrigatória para a validação." };
  }

  const payload = {
    documento_id: documentoId,
    foto_base64: fotoBase64,
    nome: s(d.nome),
    cpf: s(d.cpf),
    rg: s(d.rg),
    sfpc: s(d.sfpc),
    amparo: s(d.amparo),
    validade: s(d.validade),
    registro: s(d.registro),
    tipo: s(d.tipo),
    marca: s(d.marca),
    calibre: s(d.calibre),
    serie: s(d.numero_serie),
    sigma: s(d.numero_sigma),
    data_expedicao: s(d.data_expedicao),
    assinado_por: s(d.assinante),
    cidade_uf: s(d.cidade),
    status: "valido",
  };

  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(CRAF_INGEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Token": key,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      if (!res.ok) {
        lastError = `[${res.status}] ${text}`;
        console.error(`register-document (CRAF) falhou (tentativa ${attempt}): ${lastError}`);
        if (res.status === 400 || res.status === 401) break;
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      const json = JSON.parse(text) as {
        success?: boolean;
        documento_id?: string;
        qr_code_url?: string;
        error?: string;
      };
      if (!json.success || !json.qr_code_url) {
        lastError = json.error || text;
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      // O portal deve confirmar o mesmo registro enviado. Aceitar uma URL sem
      // vínculo confirmado produz um QR válido visualmente, mas sem documento.
      if (json.documento_id && json.documento_id !== documentoId) {
        lastError = "O validador confirmou um documento diferente do enviado.";
        console.error("register-document (CRAF) documento_id divergente", {
          enviado: documentoId,
          recebido: json.documento_id,
        });
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      const qrCodeUrl = json.qr_code_url.trim();
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(qrCodeUrl);
      } catch {
        lastError = "O validador devolveu uma URL de QR inválida.";
        continue;
      }
      if (parsedUrl.protocol !== "https:" || !parsedUrl.search) {
        lastError = "O validador devolveu uma URL sem código de consulta.";
        continue;
      }

      console.log("CRAF registrado no Vio", {
        documentoId,
        host: parsedUrl.host,
        rota: parsedUrl.pathname,
      });
      return { documentoId, qrCodeUrl, registered: true };
    } catch (err) {
      lastError = String(err);
      console.error("register-document (CRAF) erro de rede:", err);
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }

  return { documentoId, qrCodeUrl: "", registered: false, error: lastError };
}


/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      /* capacidade insuficiente — tenta a próxima versão */
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
```

## CÓDIGO — `supabase/functions/generate-unimed-pdf/validacao.ts`

```ts
// Integração com o portal de validação — Atestado Unimed
// O site de validação (https://verificamemed.site) apenas LÊ os dados do nosso
// banco através da RPC pública `verify_atestado(_token)`.
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const VALIDACAO_BASE_URL = "https://verificamemed.site";

export const PDF_BUCKET = "documentos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 ano

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return s(v).replace(/\D/g, "");
}

function dateOnly(v: string): string {
  const m = s(v).match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : s(v).trim();
}

/** "05:53:23" -> "05:53" */
function toHm(v: string): string {
  const m = s(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** "2023-11-08" -> "08/11/2023" (mantém já formatado em BR) */
function toBrDate(v: string): string {
  const raw = s(v).trim();
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[0];
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : "";
}

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

function randomToken(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

function randomCodigoAcesso(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

/** ID local (fallback/log). */
export function buildDocumentoId(d: Record<string, string>): string {
  const key = onlyDigits(s(d.cpf)) || onlyDigits(s(d.cns)) || "00000000000";
  return `UNI-${key}`;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function splitMedico(nome: string): { nome: string; genero: "DR" | "DRA" } {
  const raw = s(nome).trim();
  const genero: "DR" | "DRA" = /^dra\.?\s/i.test(raw) ? "DRA" : "DR";
  return { nome: raw.replace(/^dra?\.?\s+/i, "").trim(), genero };
}

function buildTextoAtestado(dias: number): string {
  if (dias <= 1) {
    return "atesto que o(a) paciente acima necessitou de repouso domiciliar por razões médicas no dia de hoje.";
  }
  return `atesto que o(a) paciente acima necessitou de afastamento de suas atividades por ${
    String(dias).padStart(2, "0")
  } dias por razões médicas.`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  token?: string;
  registered: boolean;
  error?: string;
}

const REQUIRED: Array<[string, string]> = [
  ["nome_paciente", "Nome do paciente"],
  ["cpf", "CPF"],
  ["data_nascimento", "Data de nascimento"],
  ["nome_medico", "Nome do profissional"],
  ["crm", "CRM"],
];

export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);

  const dias = Math.min(14, Math.max(1, Number(d.dias || "1") || 1));
  const medico = splitMedico(d.medico);

  const emissaoData = toBrDate(d.emitido_em) || toBrDate(d.data_emissao) ||
    toBrDate(d.data_atendimento);
  const emissaoHora = toHm(d.emitido_em) || toHm(d.hora_assinatura) ||
    toHm(d.hora_atendimento) || "00:00";

  const enderecoClinica = [
    s(d.unidade_curta || d.unidade).trim(),
    s(d.endereco).trim(),
    s(d.telefone).trim() ? `Telefone: ${s(d.telefone).trim()}` : "",
  ].filter(Boolean).join(" - ");

  const row = {
    token: randomToken(7),
    codigo_acesso: randomCodigoAcesso(),
    emissao_atestado: `${emissaoData} - ${emissaoHora}`.trim(),
    nome_paciente: s(d.paciente).trim(),
    cpf: s(d.cpf).trim(),
    data_nascimento: toBrDate(d.nascimento) || dateOnly(d.nascimento),
    endereco: s(d.endereco_paciente || "").trim() || null,
    nome_medico: medico.nome,
    genero_medico: medico.genero,
    crm: onlyDigits(d.crm_numero || d.crm),
    crm_uf: (s(d.crm_uf).replace(/^CRM[-\s]?/i, "").trim() || "RJ").toUpperCase(),
    endereco_clinica: enderecoClinica || null,
    texto_atestado: buildTextoAtestado(dias),
    quantidade: dias,
    pdf_url: null as string | null,
  };

  const faltando = REQUIRED
    .filter(([k]) => !s((row as Record<string, unknown>)[k]))
    .map(([, label]) => label);

  if (faltando.length) {
    return {
      documentoId,
      qrCodeUrl: "",
      registered: false,
      error: `Campos obrigatórios para validação: ${faltando.join(", ")}`,
    };
  }

  try {
    const supabase = serviceClient();
    const { error } = await supabase.from("atestados").insert(row);
    if (error) {
      console.error("Falha ao registrar atestado Unimed:", error.message);
      return { documentoId, qrCodeUrl: "", registered: false, error: error.message };
    }
    return {
      documentoId,
      qrCodeUrl: `${VALIDACAO_BASE_URL}/atestado?token=${row.token}&codigo=${row.codigo_acesso}`,
      token: row.token,
      registered: true,
    };
  } catch (err) {
    console.error("Erro de rede ao registrar atestado Unimed:", err);
    return { documentoId, qrCodeUrl: "", registered: false, error: String(err) };
  }
}

/** Sobe o PDF final no Storage e grava a URL assinada em `atestados.pdf_url`. */
export async function attachPdf(token: string, pdf: Uint8Array): Promise<string | null> {
  try {
    const supabase = serviceClient();
    const path = `atestados/${token}.pdf`;

    const { error: upErr } = await supabase.storage.from(PDF_BUCKET).upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      console.error("Falha ao subir PDF do atestado:", upErr.message);
      return null;
    }

    const { data, error } = await supabase.storage
      .from(PDF_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) {
      console.error("Falha ao assinar URL do PDF:", error?.message);
      return null;
    }

    await supabase.from("atestados").update({ pdf_url: data.signedUrl }).eq("token", token);
    return data.signedUrl;
  } catch (err) {
    console.error("Erro ao anexar PDF do atestado:", err);
    return null;
  }
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

export { dateOnly };
```

## CÓDIGO — `supabase/functions/generate-receita-pdf/validacao.ts`

```ts
// Integração com o portal de validação — Receita Médica (Unimed)
// O validador (https://verificamemed.site) lê os dados pela RPC pública
// `verify_receita(_token)`. A rota da receita é /validar?token=...
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const VALIDACAO_BASE_URL = "https://verificamemed.site";
export const PDF_BUCKET = "documentos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 ano

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: unknown): string {
  return s(v).replace(/\D/g, "");
}

/** Token de 7 caracteres, mesmo padrão dos demais módulos Unimed. */
export function gerarToken(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

/** Código de acesso numérico de 4 dígitos. */
export function gerarCodigoAcesso(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

/** URL exigida pelo validador: /validar?token=XXXXXXX[&codigo=1234] */
export function linkValidacao(token: string, codigo?: string): string {
  const base = `${VALIDACAO_BASE_URL}/validar?token=${encodeURIComponent(token)}`;
  return codigo ? `${base}&codigo=${encodeURIComponent(codigo)}` : base;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** "Dr(a). Ana Flavia" -> { nome: "Ana Flavia", genero: "DRA" } */
function splitMedico(nome: string): { nome: string; genero: "DR" | "DRA" } {
  const raw = s(nome).trim();
  const genero: "DR" | "DRA" = /^dr\s*\(?\s*a\s*\)?\.?\s/i.test(raw) || /^dra\.?\s/i.test(raw)
    ? "DRA"
    : "DR";
  return { nome: raw.replace(/^dr\s*\(?\s*a?\s*\)?\.?\s+/i, "").trim(), genero };
}

/** "CRM 31186 GO" -> { numero: "31186", uf: "GO" } */
function splitCrm(raw: string): { numero: string; uf: string } {
  const txt = s(raw).toUpperCase();
  const uf = txt.match(/\b(A[CLPM]|BA|CE|DF|ES|GO|MA|M[GST]|P[ABEIR]|R[JNOSR]|S[CEP]|TO)\b/);
  return { numero: onlyDigits(txt), uf: uf ? uf[1] : "" };
}

const TIPOS = ["comum", "generico", "controlado", "tarja_vermelha", "tarja_preta"];

export interface MedicamentoIn {
  nome?: string;
  substancia?: string;
  posologia?: string;
  prescricao?: string;
  quantidade?: string;
  tipo?: string;
  farmaciaPopular?: boolean;
}

/** Converte os medicamentos do formulário para o formato do validador. */
export function medicamentosValidacao(meds: MedicamentoIn[]) {
  return (meds || []).map((m) => ({
    nome: s(m.nome),
    substancia: s(m.substancia) || s(m.nome).replace(/\s*\(.*?\)\s*/g, " ").trim(),
    prescricao: s(m.prescricao || m.posologia),
    quantidade: s(m.quantidade),
    tipo: TIPOS.includes(s(m.tipo)) ? s(m.tipo) : "comum",
    imagem: "",
    farmaciaPopular: Boolean(m.farmaciaPopular),
  }));
}

export interface RegisterResult {
  token: string;
  codigo_acesso: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

/** Grava a receita para o validador e devolve o link do QR Code. */
export async function registerReceita(
  d: Record<string, string>,
  medicamentos: MedicamentoIn[],
  opts: { token?: string; codigo_acesso?: string } = {},
): Promise<RegisterResult> {
  const token = (opts.token || gerarToken()).toUpperCase();
  const codigo = opts.codigo_acesso || gerarCodigoAcesso();
  const qrCodeUrl = linkValidacao(token, codigo);

  const medico = splitMedico(d.medico || "");
  const crm = splitCrm(d.crm || "");
  const enderecoClinica = [
    s(d.endereco_clinica).trim(),
    s(d.telefone).trim() ? `Telefone: ${s(d.telefone).trim()}` : "",
  ].filter(Boolean).join(" - ");

  const row = {
    token,
    codigo_acesso: codigo,
    emissao_receita: s(d.emissao).trim(),
    nome_paciente: s(d.paciente).trim(),
    cpf: s(d.cpf).trim(),
    data_nascimento: s(d.nascimento).trim(),
    endereco: s(d.endereco).trim() || null,
    nome_medico: medico.nome,
    genero_medico: medico.genero,
    crm: crm.numero,
    crm_uf: crm.uf,
    endereco_clinica: enderecoClinica || null,
    medicamentos: medicamentosValidacao(medicamentos),
    pdf_url: null as string | null,
  };

  if (!row.nome_paciente || !row.nome_medico) {
    return {
      token,
      codigo_acesso: codigo,
      qrCodeUrl,
      registered: false,
      error: "Campos obrigatórios para validação: paciente e médico.",
    };
  }

  try {
    const supabase = serviceClient();
    const { error } = await supabase.from("receitas").insert(row);
    if (error) {
      console.error("Falha ao registrar receita:", error.message);
      return { token, codigo_acesso: codigo, qrCodeUrl, registered: false, error: error.message };
    }
    return { token, codigo_acesso: codigo, qrCodeUrl, registered: true };
  } catch (err) {
    console.error("Erro de rede ao registrar receita:", err);
    return { token, codigo_acesso: codigo, qrCodeUrl, registered: false, error: String(err) };
  }
}

/** Sobe o PDF final no Storage e grava a URL assinada em `receitas.pdf_url`. */
export async function attachPdf(token: string, pdf: Uint8Array): Promise<string | null> {
  try {
    const supabase = serviceClient();
    const path = `receitas/${token}.pdf`;

    const { error: upErr } = await supabase.storage.from(PDF_BUCKET).upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      console.error("Falha ao subir PDF da receita:", upErr.message);
      return null;
    }

    const { data, error } = await supabase.storage
      .from(PDF_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) {
      console.error("Falha ao assinar URL do PDF:", error?.message);
      return null;
    }

    await supabase.from("receitas").update({ pdf_url: data.signedUrl })
      .eq("token", token.toUpperCase());
    return data.signedUrl;
  } catch (err) {
    console.error("Erro ao anexar PDF da receita:", err);
    return null;
  }
}

/** QR Code SVG de alta densidade (versão mínima 12), igual aos outros módulos. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
```

## CÓDIGO — `supabase/functions/generate-atestado-pdf/validacao.ts`

```ts
// Integração com o portal de validação (AtestaFácil) — Atestado Médico Digital
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL = "https://verificamed.website";

/**
 * Garante que o QR sempre aponte para o dominio oficial de validacao.
 * A API remota pode devolver verify_url com dominio interno (*.lovable.app),
 * entao reaproveitamos apenas o caminho/query e trocamos o host.
 */
function forceOfficialDomain(url: string, token: string): string {
  const fallback = `${VALIDACAO_BASE_URL}/verificar?id=${encodeURIComponent(token)}`;
  if (!url) return fallback;
  try {
    const u = new URL(url);
    const base = new URL(VALIDACAO_BASE_URL);
    if (u.host === base.host) return u.toString();
    return `${VALIDACAO_BASE_URL}${u.pathname}${u.search}`;
  } catch {
    return fallback;
  }
}

const REGISTER_ENDPOINT =
  "https://xrfbhiihyvqoajjcdcky.supabase.co/functions/v1/register-document";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function dateOnly(v: string): string {
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v.trim();
}

/** "08/11/2023" | "2023-11-08" -> "2023-11-08" */
function toIsoDate(v: string): string {
  const raw = s(v).trim();
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

/** "05:53:23" -> "05:53" */
function toHm(v: string): string {
  const m = s(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

function addDays(isoDate: string, days: number): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ID local (fallback/log) — o token oficial vem sempre da API. */
export function buildDocumentoId(d: Record<string, string>): string {
  const key = onlyDigits(s(d.cpf)) || onlyDigits(s(d.cns)) || "00000000000";
  return `ATM-${key}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  token?: string;
  registered: boolean;
  error?: string;
}

function buildPayload(d: Record<string, string>) {
  const start = toIsoDate(d.data_atendimento);
  const dias = Math.max(1, Number(d.dias || "1") || 1);
  const endereco = [s(d.endereco1), s(d.endereco2), s(d.endereco3)]
    .filter(Boolean)
    .join(" - ");

  const emitido = s(d.emitido_em);
  const issueDate = toIsoDate(emitido) || toIsoDate(d.data_emissao) || start;
  const issueTime = toHm(emitido) || toHm(d.liberado_hora) || toHm(d.hora_atendimento);

  return {
    patient_name: s(d.paciente).trim(),
    patient_cpf: s(d.cpf).trim(),
    patient_birth_date: toIsoDate(d.nascimento),
    patient_state: s(d.uf).trim().toUpperCase(),
    patient_cns: onlyDigits(s(d.cns)),
    professional_name: s(d.medico).trim(),
    professional_crm: s(d.crm).trim(),
    professional_specialty: s(d.especialidade).trim(),
    unit_name: s(d.unidade_curta || d.unidade).trim(),
    unit_address: endereco,
    start_date: start,
    end_date: addDays(start, dias - 1),
    cid: s(d.cid).trim(),
    days_off: dias,
    issue_date: issueDate,
    issue_time: issueTime,
    consultation_date: start,
    consultation_time: toHm(d.hora_atendimento),
  };
}

const REQUIRED: Array<[string, string]> = [
  ["patient_name", "Nome do paciente"],
  ["patient_cpf", "CPF"],
  ["patient_birth_date", "Data de nascimento"],
  ["professional_name", "Nome do profissional"],
  ["professional_crm", "CRM"],
  ["unit_name", "Unidade"],
  ["unit_address", "Endereço da unidade"],
  ["start_date", "Data do atendimento"],
  ["end_date", "Data final do afastamento"],
  ["cid", "CID"],
];

export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const payload = buildPayload(d) as Record<string, unknown>;

  const faltando = REQUIRED
    .filter(([k]) => !s(payload[k]))
    .map(([, label]) => label);

  if (faltando.length) {
    return {
      documentoId,
      qrCodeUrl: "",
      registered: false,
      error: `Campos obrigatórios para validação: ${faltando.join(", ")}`,
    };
  }

  const apiKey = Deno.env.get("BELLARUS_API_KEY") || "";
  if (!apiKey) {
    return {
      documentoId,
      qrCodeUrl: "",
      registered: false,
      error: "BELLARUS_API_KEY não configurada.",
    };
  }

  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const text = await res.text();

      if (!res.ok) {
        lastError = `[${res.status}] ${text}`;
        console.error(`register-document falhou (tentativa ${attempt}): ${lastError}`);
        if (res.status === 400 || res.status === 401) break; // não adianta repetir
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      const json = JSON.parse(text) as {
        success?: boolean;
        token?: string;
        verify_url?: string;
        document_id?: string;
      };

      if (json.success === false || !json.token) {
        lastError = text;
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      const verifyUrl = forceOfficialDomain(json.verify_url || "", json.token);

      return {
        documentoId: json.document_id || documentoId,
        qrCodeUrl: verifyUrl,
        token: json.token,
        registered: true,
      };
    } catch (err) {
      lastError = String(err);
      console.error(`register-document erro de rede (tentativa ${attempt}):`, err);
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }

  return { documentoId, qrCodeUrl: "", registered: false, error: lastError };
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

export { dateOnly };
```

## CÓDIGO — `supabase/functions/generate-diploma-pdf/validacao.ts`

```ts
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 8;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "M");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

/** Código de validação determinístico (mesmo aluno + curso = mesmo código). */
export async function buildCodigoValidacao(seed: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 4)}.${hex.slice(4, 7)}.${hex.slice(7, 19)}`;
}

/* ------------------------------------------------- portal de validação */

export const PORTAL_BASE_URL =
  Deno.env.get("PORTAL_VALIDACAO_BASE_URL") || "https://consultadiplomaestacio.digital";

const REGISTER_ENDPOINT = `${PORTAL_BASE_URL}/api/public/register-diploma`;

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function digits(v: string): string {
  return v.replace(/\D/g, "");
}

/** documento_id determinístico e estável: DIP-YYYYMMDD-NNNNNN */
export async function buildDocumentoId(seed: string, dataRef?: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const arr = new Uint8Array(buf);
  const num = ((arr[0] << 16) | (arr[1] << 8) | arr[2]) % 1000000;
  const d = toIsoDate(dataRef || "") || new Date().toISOString().slice(0, 10);
  return `DIP-${d.replace(/-/g, "")}-${String(num).padStart(6, "0")}`;
}

export function buildValidationUrl(documentoId: string): string {
  return `${PORTAL_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;
}

/** Converte dd/mm/aaaa (ou aaaa-mm-dd) para aaaa-mm-dd. */
export function toIsoDate(v: string): string {
  const t = s(v).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

/** CPF/RG mascarado conforme LGPD: ***.456.789-** */
export function maskCpf(v: string): string {
  const d = digits(v);
  if (d.length !== 11) return s(v);
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function maskCnpj(v: string): string {
  const d = digits(v);
  if (d.length !== 14) return s(v);
  return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
}

/** Flexiona o título conferido conforme o sexo. */
export function flexTitulo(titulo: string, sexo: string): string {
  const t = s(titulo).trim();
  if (!/^f/i.test(s(sexo))) return t;
  return t
    .replace(/Bacharel(?!a)/gi, "Bacharela")
    .replace(/Licenciado/gi, "Licenciada")
    .replace(/Tecnólogo/gi, "Tecnóloga");
}

export interface PortalResult {
  documentoId: string;
  validationUrl: string;
  registered: boolean;
  error?: string;
}

export async function registerDiplomaPortal(
  documentoId: string,
  payload: Record<string, unknown>,
): Promise<PortalResult> {
  const fallback = buildValidationUrl(documentoId);
  const apiKey = Deno.env.get("PORTAL_VALIDACAO_API_KEY");
  if (!apiKey) {
    return { documentoId, validationUrl: fallback, registered: false, error: "API key ausente" };
  }

  try {
    const res = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    const text = await res.text();
    let json: { success?: boolean; validation_url?: string; error?: string } = {};
    try {
      json = JSON.parse(text);
    } catch { /* resposta não-JSON */ }

    if (!res.ok || json.success === false) {
      console.error(`register-diploma falhou [${res.status}] ${documentoId}: ${text.slice(0, 500)}`);
      return {
        documentoId,
        validationUrl: fallback,
        registered: false,
        error: json.error || `HTTP ${res.status}`,
      };
    }

    return { documentoId, validationUrl: json.validation_url || fallback, registered: true };
  } catch (err) {
    console.error("register-diploma erro de rede:", err);
    return { documentoId, validationUrl: fallback, registered: false, error: String(err) };
  }
}
```

## CÓDIGO — `supabase/functions/generate-unip-pdf/validacao.ts`

```ts
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

/** Portal oficial de validação do diploma digital da UNIP. */
export const UNIP_VALIDACAO_URL = "https://unipbrdiploma.site/validar";

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 8;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "M");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

/**
 * Código de validação determinístico no padrão UNIP: 322.322.xxxxxxxxxxxx
 * (o mesmo aluno + curso + registro sempre gera o mesmo código).
 */
export async function buildCodigoValidacao(seed: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `322.322.${hex.slice(0, 12)}`;
}

/** URL final embutida no QR Code do verso. */
export function buildValidationUrl(codigo: string): string {
  return `${UNIP_VALIDACAO_URL}?id=${encodeURIComponent(codigo)}`;
}
```

## CÓDIGO — `supabase/functions/generate-anhanguera-pdf/validacao.ts`

```ts
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

/** Portal oficial impresso no diploma Anhanguera. */
export const ANHANGUERA_VALIDACAO_URL = "https://diplomas.somosb4.com.br";

/**
 * Código de validação determinístico no padrão do documento:
 * 2773.671.xxxxxxxxxxxx (mesmos dados geram sempre o mesmo código).
 */
export async function buildCodigoValidacao(seed: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `2773.671.${hex.slice(0, 12)}`;
}

/** URL final embutida no QR Code do verso. */
export function buildValidationUrl(codigo: string): string {
  return `${ANHANGUERA_VALIDACAO_URL}/validar?codigo=${encodeURIComponent(codigo)}`;
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 8;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "M");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

/* --------------------------------------------- validador B4 (Site 2) */

export const B4_BASE_URL = "https://diplomassomosb4web.site";
const B4_REGISTER_ENDPOINT =
  "https://project--cdcf9ace-fa19-46f9-b36a-bc20c1f2dfd7.lovable.app/api/public/register-diploma-unopar";

/** URL pública impressa no QR Code. */
export function buildB4ValidationUrl(documentoId: string): string {
  return `${B4_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;
}

export interface B4Result {
  registered: boolean;
  validationUrl: string;
  error?: string;
}

/** POST idempotente (upsert por documento_id) no validador B4. */
export async function registerDiplomaB4(
  documentoId: string,
  payload: Record<string, unknown>,
): Promise<B4Result> {
  const fallback = buildB4ValidationUrl(documentoId);
  const apiKey = Deno.env.get("DIPLOMA_UNOPAR_API_KEY") || "";
  if (!apiKey) {
    return { registered: false, validationUrl: fallback, error: "missing_api_key" };
  }

  try {
    const res = await fetch(B4_REGISTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...payload, documento_id: documentoId }),
      signal: AbortSignal.timeout(30000),
    });

    const text = await res.text();
    let json: { success?: boolean; validation_url?: string; error?: string } = {};
    try {
      json = JSON.parse(text);
    } catch { /* resposta não-JSON */ }

    if (!res.ok || json.success === false) {
      console.error(`register-diploma-unopar falhou [${res.status}] ${documentoId}: ${text.slice(0, 400)}`);
      return {
        registered: false,
        validationUrl: fallback,
        error: json.error || `HTTP ${res.status}`,
      };
    }

    // nunca imprimir domínio de desenvolvimento no QR
    const url = json.validation_url && !json.validation_url.includes("lovable.app")
      ? json.validation_url
      : fallback;
    return { registered: true, validationUrl: url };
  } catch (err) {
    console.error("register-diploma-unopar erro de rede:", err);
    return { registered: false, validationUrl: fallback, error: String(err) };
  }
}
```

## CÓDIGO — `supabase/functions/generate-hapvida-pdf/validacao.ts`

```ts
// Integração com o portal de validação (AtestaFácil) — Atestado Médico Digital
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL = "https://verificamed.website";

/**
 * Garante que o QR sempre aponte para o dominio oficial de validacao.
 * A API remota pode devolver verify_url com dominio interno (*.lovable.app),
 * entao reaproveitamos apenas o caminho/query e trocamos o host.
 */
function forceOfficialDomain(url: string, token: string): string {
  const fallback = `${VALIDACAO_BASE_URL}/verificar?id=${encodeURIComponent(token)}`;
  if (!url) return fallback;
  try {
    const u = new URL(url);
    const base = new URL(VALIDACAO_BASE_URL);
    if (u.host === base.host) return u.toString();
    return `${VALIDACAO_BASE_URL}${u.pathname}${u.search}`;
  } catch {
    return fallback;
  }
}

const REGISTER_ENDPOINT =
  "https://xrfbhiihyvqoajjcdcky.supabase.co/functions/v1/register-document";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function dateOnly(v: string): string {
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v.trim();
}

/** "08/11/2023" | "2023-11-08" -> "2023-11-08" */
function toIsoDate(v: string): string {
  const raw = s(v).trim();
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

/** "05:53:23" -> "05:53" */
function toHm(v: string): string {
  const m = s(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

function addDays(isoDate: string, days: number): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ID local (fallback/log) — o token oficial vem sempre da API. */
export function buildDocumentoId(d: Record<string, string>): string {
  const key = onlyDigits(s(d.cpf)) || onlyDigits(s(d.cns)) || "00000000000";
  return `HAP-${key}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  token?: string;
  registered: boolean;
  error?: string;
}

function buildPayload(d: Record<string, string>) {
  const start = toIsoDate(d.data_atendimento);
  const dias = Math.max(1, Number(d.dias || "1") || 1);
  const endereco = [s(d.endereco1), s(d.endereco2), s(d.endereco3)]
    .filter(Boolean)
    .join(" - ");

  const emitido = s(d.emitido_em);
  const issueDate = toIsoDate(emitido) || toIsoDate(d.data_emissao) || start;
  const issueTime = toHm(emitido) || toHm(d.liberado_hora) || toHm(d.hora_atendimento);

  return {
    patient_name: s(d.paciente).trim(),
    patient_cpf: s(d.cpf).trim(),
    patient_birth_date: toIsoDate(d.nascimento),
    patient_state: s(d.uf).trim().toUpperCase(),
    patient_cns: onlyDigits(s(d.cns)),
    professional_name: s(d.medico).trim(),
    professional_crm: s(d.crm).trim(),
    professional_specialty: s(d.especialidade).trim(),
    unit_name: s(d.unidade_curta || d.unidade).trim(),
    unit_address: endereco,
    start_date: start,
    end_date: addDays(start, dias - 1),
    cid: s(d.cid).trim(),
    days_off: dias,
    issue_date: issueDate,
    issue_time: issueTime,
    consultation_date: start,
    consultation_time: toHm(d.hora_atendimento),
  };
}

const REQUIRED: Array<[string, string]> = [
  ["patient_name", "Nome do paciente"],
  ["patient_cpf", "CPF"],
  ["patient_birth_date", "Data de nascimento"],
  ["professional_name", "Nome do profissional"],
  ["professional_crm", "CRM"],
  ["unit_name", "Unidade"],
  ["unit_address", "Endereço da unidade"],
  ["start_date", "Data do atendimento"],
  ["end_date", "Data final do afastamento"],
  ["cid", "CID"],
];

export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const payload = buildPayload(d) as Record<string, unknown>;

  const faltando = REQUIRED
    .filter(([k]) => !s(payload[k]))
    .map(([, label]) => label);

  if (faltando.length) {
    return {
      documentoId,
      qrCodeUrl: "",
      registered: false,
      error: `Campos obrigatórios para validação: ${faltando.join(", ")}`,
    };
  }

  const apiKey = Deno.env.get("BELLARUS_API_KEY") || "";
  if (!apiKey) {
    return {
      documentoId,
      qrCodeUrl: "",
      registered: false,
      error: "BELLARUS_API_KEY não configurada.",
    };
  }

  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const text = await res.text();

      if (!res.ok) {
        lastError = `[${res.status}] ${text}`;
        console.error(`register-document falhou (tentativa ${attempt}): ${lastError}`);
        if (res.status === 400 || res.status === 401) break; // não adianta repetir
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      const json = JSON.parse(text) as {
        success?: boolean;
        token?: string;
        verify_url?: string;
        document_id?: string;
      };

      if (json.success === false || !json.token) {
        lastError = text;
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      const verifyUrl = forceOfficialDomain(json.verify_url || "", json.token);

      return {
        documentoId: json.document_id || documentoId,
        qrCodeUrl: verifyUrl,
        token: json.token,
        registered: true,
      };
    } catch (err) {
      lastError = String(err);
      console.error(`register-document erro de rede (tentativa ${attempt}):`, err);
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }

  return { documentoId, qrCodeUrl: "", registered: false, error: lastError };
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

export { dateOnly };
```

## CÓDIGO — `supabase/functions/generate-comprovante-pdf/validacao.ts`

```ts
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

/** QR Code vetorial (SVG) — usado no bloco "Pague via PIX". */
export function qrSvg(value: string, sizePx: number): string {
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = 6; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "M");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      /* capacidade insuficiente — tenta a próxima versão */
    }
  }
  if (!qr) {
    qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

/* ------------------------------------------------- código de barras ITF */

const ITF: Record<string, string> = {
  "0": "nnwwn", "1": "wnnnw", "2": "nwnnw", "3": "wwnnn", "4": "nnwnw",
  "5": "wnwnn", "6": "nwwnn", "7": "nnnww", "8": "wnnwn", "9": "nwnwn",
};

/**
 * Código de barras "2 de 5 intercalado" (padrão da fatura/boleto) em SVG.
 * `digits` deve ter quantidade par de dígitos (44 no padrão bancário).
 */
export function itfBarcodeSvg(digits: string, widthPx: number, heightPx: number): string {
  const clean = (digits || "").replace(/\D/g, "");
  const even = clean.length % 2 === 0 ? clean : `0${clean}`;
  const NARROW = 1;
  const WIDE = 3;

  const bars: { w: number; dark: boolean }[] = [];
  // start: nnnn
  for (let i = 0; i < 4; i++) bars.push({ w: NARROW, dark: i % 2 === 0 });

  for (let i = 0; i < even.length; i += 2) {
    const a = ITF[even[i]] ?? ITF["0"];
    const b = ITF[even[i + 1]] ?? ITF["0"];
    for (let k = 0; k < 5; k++) {
      bars.push({ w: a[k] === "w" ? WIDE : NARROW, dark: true });
      bars.push({ w: b[k] === "w" ? WIDE : NARROW, dark: false });
    }
  }
  // stop: wnn
  bars.push({ w: WIDE, dark: true });
  bars.push({ w: NARROW, dark: false });
  bars.push({ w: NARROW, dark: true });

  const total = bars.reduce((s, b) => s + b.w, 0);
  let x = 0;
  let rects = "";
  for (const b of bars) {
    if (b.dark) rects += `<rect x="${x}" y="0" width="${b.w}" height="100"/>`;
    x += b.w;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${total} 100" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="${total}" height="100" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
```

## CÓDIGO — `src/lib/cnh-external-sync.ts`

```ts
import { getPdfJs } from "@/lib/pdfjs-loader";

/**
 * Integração com o app "CNH do Brasil" (Site 2 — fotos).
 * Grava um registro na tabela pública `cnh` do projeto externo.
 * Todo o processamento (render do PDF -> JPEG base64) acontece NO NAVEGADOR,
 * para não consumir recursos do backend.
 */
const EXTERNAL_SUPABASE_URL = "https://mpiuedfqjtsrffdwwwfz.supabase.co";
const EXTERNAL_SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1waXVlZGZxanRzcmZmZHd3d2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODU4MDAsImV4cCI6MjA4OTU2MTgwMH0._9TVZIsc6phpZtqGPipXURsJDsMcMIBhpfjdY2QuMa8";

/** largura mínima exigida pelo app (px) */
const MIN_WIDTH = 2400;
const TARGET_WIDTH = 3176; // ~300 DPI em A4
const JPEG_QUALITY = 0.92;

function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length !== 11) return (value || "").trim();
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function toBrDate(value: string): string {
  const v = (value || "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return v;
}

function normalizeSexo(value: string): string {
  const v = (value || "").trim().toUpperCase();
  if (v.startsWith("F")) return "FEMININO";
  return "MASCULINO";
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Renderiza a página inteira do PDF como JPEG base64 em ~300 DPI */
async function renderFullPageJpeg(pdfBytes: Uint8Array, pageIndex = 0): Promise<string> {
  // Reaproveita a instância única do app (worker local, já aquecido).
  const pdfjsLib = await getPdfJs();

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const page = await pdf.getPage(pageIndex + 1);

  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(TARGET_WIDTH / base.width, MIN_WIDTH / base.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

function buildPayload(formData: Record<string, string>, imagem: string) {
  const cpf = formatCpf(formData.cpf || "");
  const nascimento = toBrDate(formData.data_nascimento || "");
  const cidadeEstado = (formData.cidade_estado || "").toUpperCase();
  const estadoExtenso = (formData.estado_extenso || "").toUpperCase();

  const nascimentoCompleto = [nascimento, formData.naturalidade, cidadeEstado]
    .filter(Boolean)
    .join(", ");

  return {
    nome_completo: (formData.nome_completo || "").toUpperCase(),
    cpf,
    rg: formData.rg || "",
    registro: onlyDigits(formData.registro || ""),
    categoria: (formData.categoria || "").toUpperCase(),
    data_nascimento: nascimentoCompleto || nascimento,
    data_emissao: toBrDate(formData.data_emissao || ""),
    data_validade: toBrDate(formData.data_validade || ""),
    renach: (formData.renach || "").toUpperCase(),
    numero_espelho: formData.numero_espelho || "",
    cidade_estado: cidadeEstado,
    estado_extenso: estadoExtenso,
    sexo: normalizeSexo(formData.genero || formData.sexo || ""),
    parte1: imagem,
    parte2: imagem,
    parte3: imagem,
    parte4: imagem,
  };
}

async function postWithRetry(payload: Record<string, string>, attempts = 3): Promise<boolean> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(`${EXTERNAL_SUPABASE_URL}/rest/v1/cnh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EXTERNAL_SUPABASE_KEY,
          Authorization: `Bearer ${EXTERNAL_SUPABASE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return true;

      const errText = await response.text();
      console.error(`CNH sync tentativa ${i} falhou [${response.status}]:`, errText);
    } catch (err) {
      console.error(`CNH sync tentativa ${i} com erro de rede:`, err);
    }

    if (i < attempts) await new Promise((r) => setTimeout(r, 1200 * i));
  }
  return false;
}

/**
 * Renderiza o PDF gerado como imagem de página inteira e grava no app externo.
 * O registro é gravado em DUAS variações de CPF (com máscara e só dígitos),
 * porque o site e o APK consultam em formatos diferentes.
 */
export async function syncCnhToExternal(
  pdfBase64: string,
  formData: Record<string, string>,
  _tipo: "digital" | "fisica" = "digital"
): Promise<boolean> {
  try {
    const pdfBytes = base64ToBytes(pdfBase64);
    const imagem = await renderFullPageJpeg(pdfBytes, 0);
    if (!imagem.startsWith("data:image/jpeg;base64,")) return false;

    const payload = buildPayload(formData, imagem);
    const masked = payload.cpf;
    const digits = onlyDigits(formData.cpf || "");

    const okMasked = await postWithRetry(payload);
    let okDigits = true;
    if (digits && digits !== masked) {
      okDigits = await postWithRetry({ ...payload, cpf: digits });
    }

    return okMasked || okDigits;
  } catch (err) {
    console.error("CNH external sync failed:", err);
    return false;
  }
}

```

## CÓDIGO — `src/lib/rg-external-sync.ts`

```ts
import { supabase } from "@/integrations/supabase/client";
import { getPdfJs } from "@/lib/pdfjs-loader";


/**
 * Integração do RG Digital com o app externo de consulta (Site 2).
 * O render do PDF -> imagem base64 acontece NO NAVEGADOR e o envio é feito
 * pela edge function `doc-ingest-proxy` (o token de ingestão fica no servidor).
 */
const MIN_LONG_SIDE = 1500;
const TARGET_SCALE = 3;
const JPEG_QUALITY = 0.94;


function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function toBrDate(value: string): string {
  const v = (value || "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v;
}

function normalizeSexo(value: string): string {
  const v = (value || "").trim().toUpperCase();
  if (v.startsWith("F")) return "F";
  if (v.startsWith("M")) return "M";
  return "";
}

/** ID determinístico — reenviar o mesmo documento atualiza o registro. */
export function buildRgDocumentoId(cpf: string): string {
  const digits = onlyDigits(cpf) || "00000000000";
  return `DOC-${digits}`;
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Renderiza TODAS as páginas do PDF, sem recorte e sem rotação, em alta resolução. */
async function renderPages(pdfBytes: Uint8Array): Promise<string[]> {
  // Reaproveita a instância única do app (worker local, já aquecido) em vez de
  // baixar um segundo pdf.js da CDN a cada envio.
  const pdfjsLib = await getPdfJs();

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const longSide = Math.max(base.width, base.height);
    const scale = Math.max(TARGET_SCALE, MIN_LONG_SIDE / longSide);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY));

    canvas.width = 0;
    canvas.height = 0;
  }

  return pages;
}

function buildPayload(
  formData: Record<string, string>,
  pages: string[],
  documentoId: string,
) {
  const up = (v?: string) => (v || "").toUpperCase().trim();
  const p = (i: number) => pages[i] ?? pages[pages.length - 1] ?? "";

  return {
    documento_id: documentoId,
    nome_completo: up(formData.nome_completo),
    cpf: onlyDigits(formData.cpf),
    rg: up(formData.registro_geral || formData.rg),
    data_nascimento: toBrDate(formData.data_nascimento),
    naturalidade: up(formData.naturalidade),
    nacionalidade: up(formData.nacionalidade) || "BRASILEIRA",
    sexo: normalizeSexo(formData.sexo),
    data_emissao: toBrDate(formData.data_emissao),
    data_validade: toBrDate(formData.data_validade),
    nome_pai: up(formData.filiacao2 || formData.nome_pai),
    nome_mae: up(formData.filiacao1 || formData.nome_mae),
    orgao_expedidor: up(formData.orgao_expedidor),
    local_emissao: up(formData.local_emissao),
    uf_orgao: up(formData.uf_orgao || formData.estado),
    estado_civil: up(formData.estado_civil),
    doador_orgaos: up(formData.doador).startsWith("S") ? "SIM" : "NÃO",
    codigo_seguranca: formData.codigo_seguranca || formData.codigo_validacao || "",
    mrz: formData.mrz || "",
    parte1: p(0),
    parte2: p(1),
    parte3: p(2),
    parte4: p(3),
  };
}

async function upsertWithRetry(
  payload: Record<string, string>,
  attempts = 3,
): Promise<{ ok: boolean; error?: string }> {
  let lastError = "";
  for (let i = 1; i <= attempts; i++) {
    try {
      const { data, error } = await supabase.functions.invoke("doc-ingest-proxy", {
        body: { tabela: "rg", dados: payload },
      });
      if (error) throw new Error(error.message);
      if (data && (data as { error?: string }).error) throw new Error(JSON.stringify(data));
      return { ok: true };
    } catch (err) {
      lastError = String(err);
      console.error(`RG sync tentativa ${i} falhou:`, err);
    }

    if (i < attempts) await new Promise((r) => setTimeout(r, 1200 * i));
  }
  return { ok: false, error: lastError };
}


/** Renderiza o PDF final e grava/atualiza o registro no app externo de consulta. */
export async function syncRgToExternal(
  pdfBase64: string,
  formData: Record<string, string>,
): Promise<{ ok: boolean; documentoId: string; error?: string }> {
  const documentoId = buildRgDocumentoId(formData.cpf || "");
  try {
    const pages = await renderPages(base64ToBytes(pdfBase64));
    if (!pages.length) return { ok: false, documentoId, error: "PDF sem páginas" };

    const result = await upsertWithRetry(buildPayload(formData, pages, documentoId));
    return { ...result, documentoId };
  } catch (err) {
    console.error("RG external sync failed:", err);
    return { ok: false, documentoId, error: String(err) };
  }
}
```

## CÓDIGO — `src/lib/cha-external-sync.ts`

```ts
import { supabase } from "@/integrations/supabase/client";
import { getPdfJs } from "@/lib/pdfjs-loader";

/**
 * Integração da CNH Marítima (CHA) com o app externo de consulta.
 * O render do PDF -> imagem base64 acontece NO NAVEGADOR e o envio é feito
 * pela edge function `doc-ingest-proxy` (o token de ingestão fica no servidor).
 */
const MIN_LONG_SIDE = 1600;
const TARGET_SCALE = 3;
const JPEG_QUALITY = 0.94;


function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function toBrDate(value: string): string {
  const v = (value || "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v;
}

/** ID determinístico — reenviar o mesmo documento atualiza o registro. */
export function buildChaDocumentoId(cpf: string): string {
  const digits = onlyDigits(cpf) || "00000000000";
  return `CHA-${digits}`;
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Renderiza a página completa do PDF, sem recorte e sem rotação, em alta resolução. */
async function renderPages(pdfBytes: Uint8Array): Promise<string[]> {
  // Reaproveita a instância única do app (worker local, já aquecido).
  const pdfjsLib = await getPdfJs();

  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const longSide = Math.max(base.width, base.height);
    const scale = Math.max(TARGET_SCALE, MIN_LONG_SIDE / longSide);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY));

    canvas.width = 0;
    canvas.height = 0;
  }

  return pages;
}

function buildPayload(
  formData: Record<string, string>,
  imagemCompleta: string,
  documentoId: string,
) {
  const up = (v?: string) => (v || "").toUpperCase().trim();
  const categoria = [up(formData.categoria), up(formData.categoria_en)]
    .filter(Boolean)
    .join(" / ");

  return {
    documento_id: documentoId,
    nome_completo: up(formData.nome),
    cpf: onlyDigits(formData.cpf),
    data_nascimento: toBrDate(formData.nascimento),
    nacionalidade: up(formData.nacionalidade) || "BRASILEIRA",
    sexo: up(formData.sexo),
    categoria,
    numero_inscricao: up(formData.inscricao),
    data_emissao: toBrDate(formData.data_emissao),
    data_validade: toBrDate(formData.validade),
    orgao_emissao: up(formData.orgao) || "MARINHA DO BRASIL",
    limites_navegacao: up(formData.limites),
    requisitos: up(formData.requisitos),
    codigo_seguranca: formData.codigo_seguranca || "",
    observacoes: up(formData.observacoes),
    // As 4 partes recebem a MESMA imagem completa (recorte é feito no app de consulta).
    parte1: imagemCompleta,
    parte2: imagemCompleta,
    parte3: imagemCompleta,
    parte4: imagemCompleta,
  };
}

/** Envia via edge function segura (token de ingestão fica no servidor). */
async function saveRecord(payload: Record<string, string>): Promise<void> {
  const { data, error } = await supabase.functions.invoke("doc-ingest-proxy", {
    body: { tabela: "cha", dados: payload },
  });
  if (error) throw new Error(error.message);
  if (data && (data as { error?: string }).error) {
    throw new Error(JSON.stringify(data));
  }
}


async function upsertWithRetry(
  payload: Record<string, string>,
  attempts = 3,
): Promise<{ ok: boolean; error?: string }> {
  let lastError = "";
  for (let i = 1; i <= attempts; i++) {
    try {
      await saveRecord(payload);
      return { ok: true };
    } catch (err) {
      lastError = String(err);
      console.error(`CHA sync tentativa ${i} falhou:`, err);
    }

    if (i < attempts) await new Promise((r) => setTimeout(r, 1200 * i));
  }
  return { ok: false, error: lastError };
}


/** Renderiza o PDF final e grava/atualiza o registro no app externo de consulta. */
export async function syncChaToExternal(
  pdfBase64: string,
  formData: Record<string, string>,
): Promise<{ ok: boolean; documentoId: string; error?: string }> {
  const documentoId = buildChaDocumentoId(formData.cpf || "");
  try {
    const pages = await renderPages(base64ToBytes(pdfBase64));
    if (!pages.length) return { ok: false, documentoId, error: "PDF sem páginas" };

    const result = await upsertWithRetry(buildPayload(formData, pages[0], documentoId));
    return { ...result, documentoId };
  } catch (err) {
    console.error("CHA external sync failed:", err);
    return { ok: false, documentoId, error: String(err) };
  }
}
```

## CÓDIGO — `src/lib/plan-pricing.ts`

```ts
/** Descontos por plano aplicados em todo o sistema (também validados no servidor). */
export const PLAN_DISCOUNTS: Record<string, number> = {
  free: 0,
  dealer: 0.25,
  master: 0.5,
  diamond: 1,
};

export function planDiscount(plano?: string | null): number {
  return PLAN_DISCOUNTS[(plano || "free").toLowerCase()] ?? 0;
}

/** Preço final (em créditos) de uma operação para o plano do usuário. */
export function planCost(base: number, plano?: string | null): number {
  const value = base * (1 - planDiscount(plano));
  return Math.round(value * 100) / 100;
}

export function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}
```
