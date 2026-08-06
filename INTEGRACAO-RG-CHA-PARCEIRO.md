# PROMPT DE INTEGRAÇÃO — RG DIGITAL (CIN) + CHA (CNH MARÍTIMA)

> Cole este documento inteiro no agente do site parceiro (v0 / Lovable / Cursor).
> Ele descreve **onde enviar**, **onde consultar**, **quais chaves usar**, **como tratar fotos**
> e **qual banco é o correto**. Nenhuma credencial de administrador é usada.

---

## 1. ARQUITETURA — QUEM É QUEM

Existem **três** peças. Não confundir:

| Peça | Papel | Projeto / Domínio |
|---|---|---|
| **Gerador (MonkeyLab)** | Cria o PDF do RG/CHA e dispara o registro | projeto central (este) |
| **Proxy de ingestão** | Recebe os dados + imagens e grava no banco de consulta | Edge Function `doc-ingest-proxy` → `https://hfkckowhrjbpjgniaakl.supabase.co/functions/v1/doc-ingest` |
| **Portal de validação** | Lê o registro quando o QR Code é escaneado | `https://cidadaniagov-info.site/` |

**Regra de ouro:** o site parceiro **NÃO** grava direto em nenhum banco.
Ele sempre chama uma Edge Function que já tem o token no servidor.

### Bancos corretos
- **Banco de consulta do RG/CHA (imagens `parte1..parte4` + campos):** projeto `hfkckowhrjbpjgniaakl`, tabelas `rg` e `cha`, via `doc-ingest`.
- **Banco de metadados/QR do RG:** portal externo `https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document`.
- Se o seu app está em **outro projeto Supabase**, ele NUNCA vai achar o documento lendo o próprio banco. Tem que escrever no banco acima.

---

## 2. CHAVES E TOKENS

| Nome do segredo | Onde vive | Para que serve |
|---|---|---|
| `DOC_INGEST_TOKEN` | servidor (Edge Function) | header `x-ingest-token` do `doc-ingest` |
| `RG_VALIDACAO_BELLARUS_TOKEN` | servidor | header `X-API-Token` do `register-document` (1ª tentativa) |
| `RG_VALIDACAO_API_TOKEN` | servidor | fallback do anterior |
| `VALIDACAO_API_TOKEN` | servidor | fallback final / usado também pelo CHA |

⚠️ **Nunca** colocar esses tokens no frontend, em `.env` do cliente, ou em query string.
O navegador só fala com a sua Edge Function; ela é quem carrega o token.

Ordem de tentativa dos tokens do RG (implementada no servidor):
`BELLARUS → RG_VALIDACAO_API_TOKEN → VALIDACAO_API_TOKEN`. Em `401`, tenta a próxima.

---

## 3. IDENTIFICADORES (DETERMINÍSTICOS)

Reenviar o mesmo CPF **atualiza** o registro (comportamento de upsert).

```
RG  → banco de consulta : DOC-{cpf_somente_digitos}     ex.: DOC-12345678901
RG  → portal de QR      : RG-{cpf_somente_digitos}      ex.: RG-12345678901
CHA → banco de consulta : CHA-{cpf_somente_digitos}     ex.: CHA-12345678901
```

Sempre `cpf.replace(/\D/g, "")`. Se vazio, usar `00000000000`.

---

## 4. ENVIO DAS IMAGENS (O QUE MAIS QUEBRA)

O PDF final é renderizado **no navegador** (pdf.js) e vira JPEG base64.
Só depois é enviado. Parâmetros exatos usados hoje:

```
TARGET_SCALE   = 3          // escala mínima do viewport
MIN_LONG_SIDE  = 1500 (RG) / 1600 (CHA)
JPEG_QUALITY   = 0.94
formato        = data:image/jpeg;base64,...
```

Regras:
- **RG:** envia até 4 páginas → `parte1..parte4`. Se houver menos páginas, repete a última.
- **CHA:** é 1 página só → **a mesma imagem completa** vai em `parte1`, `parte2`, `parte3` e `parte4`
  (o recorte é feito pelo app de consulta, não pelo gerador).
- Nunca rotacionar, nunca recortar antes de enviar. Fundo branco preenchido no canvas.

### Foto 3x4 do titular (RG)
A foto **não** deve ir como base64 gigante quando existir URL pública — o POST cai de MB para KB.

- Foto salva em `documents-pdf/fotos-rg/{documento_id}.png`.
- Servida publicamente por: `GET https://<projeto>.functions.supabase.co/rg-foto?id={documento_id}`
- No payload do portal: se houver `foto_public_url`, mandar essa URL em `foto`, `foto_url`,
  `foto_3x4`, `photo_url`, `imagem` e deixar `foto_base64` **vazio**.
  Mandar URL dentro de `foto_base64` faz o portal responder **500**.
- Só quando não existe URL pública: `foto_base64 = data:image/png;base64,...`.

---

## 5. ENDPOINT 1 — GRAVAR NO BANCO DE CONSULTA

```
POST https://<seu-projeto>.functions.supabase.co/doc-ingest-proxy
Content-Type: application/json
```

Body:
```json
{ "tabela": "rg" | "cha", "dados": { ...payload... } }
```

A função valida `tabela` e a presença de `dados.documento_id`, e encaminha para
`https://hfkckowhrjbpjgniaakl.supabase.co/functions/v1/doc-ingest` com o header
`x-ingest-token: <DOC_INGEST_TOKEN>`.

Respostas: `{ "ok": true }` · `400 invalid_tabela|invalid_dados` · `502 upstream_error`.

### Payload `tabela: "rg"`
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
  "parte2": "...", "parte3": "...", "parte4": "..."
}
```
Normalizações obrigatórias: tudo em MAIÚSCULAS; datas em `dd/mm/aaaa`
(aceitar `aaaa-mm-dd` e converter); `sexo` reduzido a `M`/`F`;
`doador_orgaos` só `"SIM"`/`"NÃO"`; `cpf` só dígitos.

### Payload `tabela: "cha"`
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
  "parte2": "<mesma imagem>", "parte3": "<mesma>", "parte4": "<mesma>"
}
```
`categoria` = português + inglês unidos por `" / "`.

### Reenvio / resiliência
Fazer **3 tentativas** com backoff `1200ms × tentativa`. O upstream não tem chave única,
então a estratégia é *select → patch/post*: o registro mais recente por CPF é atualizado.

---

## 6. ENDPOINT 2 — REGISTRAR O QR CODE (RG)

```
POST https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document
Content-Type: application/json
X-API-Token: <RG_VALIDACAO_BELLARUS_TOKEN>
timeout: 10s
```

Campos além dos do item 5: `tipo: "rg-digital"`, `nome`, `status: "valido"`,
e os complementares `nome_social`, `estado`, `tipo_sanguineo`, `fator_rh`,
`titulo_eleitor`, `certidao`, `cnh`, `categoria_cnh`, `pis_pasep`, `nis`, `nit`,
`ctps`, `dni`, `cns`, `observacao_saude`, `via`.

Resposta esperada: `{ "success": true, "qr_code_url": "https://..." }`.
Se falhar, usar o **fallback determinístico** e nunca abortar a geração do PDF:
```
https://cidadaniagov-info.site/validar-rg?id=RG-{cpf}
```

### CHA
```
POST https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document
X-API-Token: <VALIDACAO_API_TOKEN>
{ "tipo": "cha", "documento_id": "CHA-{cpf}", "nome", "cpf", "data_nascimento",
  "categoria", "data_validade", "numero_inscricao", "limites_navegacao",
  "emissor": "MARINHA DO BRASIL", "data_emissao", "restricoes_fisicas",
  "status": "valido", "hash": "<sha256(documento_id|nome|inscricao) 32 chars>" }
```
Fallback: `https://cidadaniagov-info.site/validar-cha?id=CHA-{cpf}`.

---

## 7. ONDE CONSULTAR (LADO VALIDADOR)

Portal único: **https://cidadaniagov-info.site/**

```
RG  : /validar-rg?id=DOC-{cpf}   (ou o qr_code_url devolvido pelo register-document)
CHA : /validar-cha?id=CHA-{cpf}
```

Credenciais entregues ao cliente junto com o PDF:
```
Link  : https://cidadaniagov-info.site/
Login : CPF (somente dígitos)
Senha : últimos 6 dígitos do CPF
```

---

## 8. QR CODE — GERAÇÃO

Biblioteca `qrcode-generator@1.4.4`, saída **SVG vetorial** (nítido em qualquer DPI):
- versão mínima **12**, subindo até 40 se faltar capacidade;
- correção de erro **"H"**;
- `shape-rendering="crispEdges"`, fundo branco, módulos pretos;
- respeitar quiet zone (não encostar na borda do template).

---

## 9. CHECKLIST DE ERROS CONHECIDOS

| Sintoma | Causa | Correção |
|---|---|---|
| `401 Token de autenticação inválido` | token do portal rotacionado | tentar os 3 tokens na ordem; se todos falharem, renovar credencial |
| `500` no register-document | URL enviada dentro de `foto_base64` | mandar URL só nos campos de URL |
| QR abre "documento não encontrado" | app gravou em outro projeto Supabase | gravar via `doc-ingest-proxy` no projeto `hfkckowhrjbpjgniaakl` |
| POST de vários MB / timeout | base64 da foto repetido | usar `foto_public_url` via função `rg-foto` |
| Imagem cortada no validador | recorte feito no gerador | enviar a página completa; o recorte é do validador |

---

## 10. ORDEM DE EXECUÇÃO NO GERADOR

1. Montar o formulário e validar CPF/datas.
2. Gerar o PDF final (escala 3x).
3. `registerValidationDocument()` → obtém `qr_code_url` (ou fallback).
4. Desenhar o QR no PDF.
5. Renderizar as páginas para JPEG base64.
6. `doc-ingest-proxy` com `tabela` + `dados` (3 tentativas).
7. Entregar PDF + link/login/senha ao cliente.

O passo 6 **nunca** deve bloquear a entrega do PDF: falhou, loga e segue.
