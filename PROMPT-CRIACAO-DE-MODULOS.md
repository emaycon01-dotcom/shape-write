# PROMPT MESTRE — CRIAÇÃO DE UM MÓDULO DE DOCUMENTO (DO TEMPLATE AO PDF FINAL)

> Cole este texto inteiro no outro sistema (a IA que está construindo o app gêmeo).
> Ele descreve, do início ao fim, como transformar **um template enviado pelo usuário**
> (PDF ou imagem) em um **módulo completo**: formulário → preview → PDF final →
> alinhamento visual → menu → histórico.

---

## 0. CONTRATO GERAL (leia antes de escrever qualquer código)

Você vai receber do usuário: **um template** (PDF, JPG ou PNG do documento real) e o
**nome do módulo** (ex.: "Holerite", "Comprovante Enel", "Certidão de Óbito").

Regras inegociáveis:

1. **O template é intocável.** Ele é o fundo. Você NUNCA redesenha o documento em HTML —
   você apenas sobrepõe os campos dinâmicos por cima da imagem de fundo, em coordenadas absolutas.
2. **Uma única fonte de verdade para coordenadas.** As posições padrão vivem na Edge Function
   do módulo (`*_DEFAULT_POSITIONS`) e são **espelhadas byte a byte** no editor de alinhamento.
   Se divergirem, o preview mente e o PDF sai torto.
3. **O HTML do preview e o HTML do PDF final são o MESMO HTML.** Só muda a escala de rasterização.
4. **Stack fixa:** React + Vite + TypeScript + Tailwind + shadcn no front; Supabase Edge Functions (Deno)
   para montar o HTML; rasterização 100% no navegador (`html2canvas-pro` + `jsPDF`).
5. **Nada de serviço externo de PDF.** Sem PDFShift, sem PDF.co, sem Puppeteer remoto.

---

## 1. ETAPA 1 — RECEBER E PREPARAR O TEMPLATE

Quando o usuário mandar o arquivo:

1. **Extraia o fundo em altíssima resolução.**
   - PDF → imagem: `pdftoppm -r 600 -jpeg template.pdf pagina` (600 DPI, uma imagem por página).
   - Se o PDF tiver texto vetorial nítido, ainda assim rasterize: o fundo será imagem.
2. **Limpe o fundo.** Todos os dados variáveis (nome, CPF, datas, valores, QR Code, foto,
   assinatura) devem ser **apagados** da imagem — eles serão redesenhados por cima.
   O que é fixo (grades, rótulos impressos, brasões, textos verticais, linhas de assinatura)
   **permanece na imagem**.
3. **Otimize e salve** em `src/assets/template-<modulo>-p1-hq.webp` (uma por página: `p1`, `p2`…).
   - WebP qualidade 90–92, largura alvo ≈ 3300 px para A4 retrato.
   - Se o documento for paisagem (diplomas), mantenha a proporção real do papel.
4. **Meça a página em pontos.** Padrões: A4 retrato `595 x 842`, A4 paisagem `842 x 595`.
   Use SEMPRE 1pt = 1px no HTML — isso torna as coordenadas legíveis e portáveis.

---

## 2. ETAPA 2 — MAPEAR OS CAMPOS (a parte mais importante)

Antes de codar, produza uma **especificação de campos**. Para cada dado variável do documento:

| propriedade | significado |
|---|---|
| `key` | id único, snake_case (`nome`, `cpf`, `total_venc`) |
| `label` | rótulo em português para o formulário |
| `sample` | valor de exemplo (usado no botão "Preencher teste") |
| `x`, `y` | canto superior-esquerdo do campo, em pt, medido na página |
| `w` | largura da caixa (obrigatório: evita estouro de texto) |
| `fontSize` | tamanho base em pt |
| `right?` | alinhar à direita (valores monetários) |
| `center?` | centralizar (nomes em diplomas) |
| `bold?` / `upper?` | peso e caixa alta |
| `rotate?` | graus, para textos verticais |

Como medir com precisão: abra a imagem do fundo em 600 DPI, pegue o pixel do campo e
converta `pt = px * 72 / 600`. Não chute — meça. Erro de 2pt já é visível.

Se o documento tiver **duas vias na mesma folha** (holerite, recibos), crie os campos
com sufixo `_a` (via 1) e `_b` (via 2) e replique com `y1`/`y2`.

Guarde essa spec exportada da Edge Function (`export const <MODULO>_SPEC = [...]`), porque
o editor de alinhamento e o formulário vão reutilizá-la.

---

## 3. ETAPA 3 — EDGE FUNCTION QUE MONTA O HTML

Crie `supabase/functions/generate-<modulo>-pdf/index.ts`.

Responsabilidades da função (e SÓ estas):

1. Autenticar a requisição (`authenticateRequest`) e responder ao preflight CORS.
2. Validar/sanitizar a entrada (arquivo irmão `validacao.ts`) — nunca confie no cliente.
3. Montar a string HTML completa e devolver `{ html, width, height, pages }`.

Esqueleto obrigatório:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";

export const PAGE_W = 595;
export const PAGE_H = 842;

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

export const MODULO_SPEC = [
  { key: "nome", label: "Nome completo", sample: "MARIA DA SILVA", x: 72, y: 130, w: 300 },
  // ...
];

const FONT_SIZE = 9.2;

export const MODULO_DEFAULT_POSITIONS: Record<string, Pos> =
  Object.fromEntries(MODULO_SPEC.map(f => [f.key, { x: f.x, y: f.y, fontSize: FONT_SIZE, w: f.w }]));

function escapeHtml(v: string) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(data: Record<string, string>, pos: Record<string, Pos>, bgBase64: string) {
  const campos = MODULO_SPEC.map(f => {
    const p = pos[f.key] ?? MODULO_DEFAULT_POSITIONS[f.key];
    const v = escapeHtml(data[f.key] ?? "");
    if (!v) return "";
    return `<div class="f" style="left:${p.x}pt;top:${p.y}pt;width:${p.w ?? 200}pt;
      font-size:${p.fontSize}pt;${f.right ? "text-align:right;" : ""}
      ${p.rotate ? `transform:rotate(${p.rotate}deg);transform-origin:left top;` : ""}">${v}</div>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <style>
    @page { size: ${PAGE_W}pt ${PAGE_H}pt; margin: 0 }
    * { box-sizing: border-box; -webkit-text-size-adjust: none }
    a, .f { color: #111 !important; text-decoration: none !important }
    body { margin:0; width:${PAGE_W}pt; height:${PAGE_H}pt; position:relative;
           font-family: 'Arial', Helvetica, sans-serif; color:#111 }
    .bg { position:absolute; inset:0; width:100%; height:100%; object-fit:fill }
    .f { position:absolute; white-space:nowrap; overflow:visible; line-height:1.05 }
  </style></head>
  <body><img class="bg" src="${bgBase64}"/>${campos}</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await authenticateRequest(req);
  if (!auth.ok) return new Response("unauthorized", { status: 401, headers: corsHeaders });

  const body = await req.json();
  const html = buildHtml(body, body.positions ?? MODULO_DEFAULT_POSITIONS, body.templateBase64);
  return new Response(JSON.stringify({ html, width: PAGE_W, height: PAGE_H }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

Regras críticas do CSS (aprendidas na dor):

- `<meta name="format-detection" ...>` + `color:#111 !important` + `text-decoration:none !important`
  → sem isso o **iOS/Safari pinta CPF e números longos de azul e sublinhado**.
- `white-space: nowrap` e `overflow: visible` nos campos → nada de reticências.
- Fundo via **base64 embutido**, nunca URL remota (o rasterizador não espera download).
- Fontes especiais (OCR-B para MRZ, fonte da CNH, cursivas de assinatura) devem ser
  **embutidas em base64** num arquivo `fonts.ts` ao lado e injetadas com `@font-face`.
- Nomes longos: aplique uma função `fitTextStyle(texto, larguraPt, fontePt)` que reduz o
  `font-size` progressivamente até caber. Nunca truncar.

Multi-página: repita o bloco `<div class="page">` com `page-break-after: always` e devolva
`pages: N`; cada página tem seu próprio fundo `p1`, `p2`…

---

## 4. ETAPA 4 — MÓDULO DE ALINHAMENTO (`src/lib/<modulo>-align.ts`)

Espelho local das coordenadas, para o editor visual e para o gerador:

```ts
export const MODULO_ALIGN_STORAGE_KEY = "modulo-field-positions";

export interface ModuloFieldPosition { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number }

export function loadModuloFieldPositions(): Record<string, ModuloFieldPosition> | null {
  try {
    const raw = localStorage.getItem(MODULO_ALIGN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const map: Record<string, ModuloFieldPosition> = {};
    for (const f of parsed) {
      if (!f?.id || typeof f.x !== "number" || typeof f.y !== "number") continue;
      map[f.id] = { x: f.x, y: f.y, fontSize: typeof f.fontSize === "number" ? f.fontSize : 9.2,
        ...(typeof f.w === "number" ? { w: f.w } : {}),
        ...(typeof f.rotate === "number" ? { rotate: f.rotate } : {}) };
    }
    return Object.keys(map).length ? map : null;
  } catch { return null; }
}
```

Registre a chave no mapa global de sincronização (`src/lib/align-sync.ts`), que persiste as
coordenadas na tabela `template_alignments` (`doc_type`, `positions` JSONB, `updated_by`,
`updated_at`, com `onConflict: "doc_type"`). Assim o alinhamento feito pelo admin vale em
**todos os dispositivos**, e não só no navegador dele.

---

## 5. ETAPA 5 — EDITOR VISUAL DE ALINHAMENTO

No `TemplateAlignPage.tsx` (página de admin), registre o novo documento:

1. Importe a `MODULO_ALIGN_STORAGE_KEY`, o `loadModuloFieldPositions` e a URL do template.
2. Adicione a chave no union `DocKey` e no array de abas renderizadas.
3. Adicione a entrada no registro de documentos com: `key`, label, template(s), largura/altura
   da página, lista de campos (vinda da spec) e **os mesmos defaults da Edge Function**.
4. Adicione o CSS de preview espelhando o CSS da função (mesma família de fonte, mesmo
   `line-height`, mesmo alinhamento) — o editor precisa mostrar exatamente o que o PDF fará.

Funcionalidades que o editor precisa expor: arrastar campo, setas do teclado (1pt / 0,1pt com Shift),
editar `x/y/fontSize/w` numericamente, zoom, alternar página, **Salvar no banco**, **Restaurar padrão**.

---

## 6. ETAPA 6 — FORMULÁRIO (`src/pages/<Modulo>FormPage.tsx`)

Estrutura obrigatória:

```tsx
type FormData = { /* uma chave por campo da spec */ };
const initial: FormData = { /* tudo "" */ };
const exemplo: FormData = { /* samples da spec */ };
```

O componente deve:

1. Agrupar campos em `<Section>` temáticas (Dados do titular, Valores, Emissão…), usando
   `@/components/form/FormFields`. **Esconda campos técnicos** em seções automáticas.
2. Aplicar máscaras (CPF, CNPJ, data, moeda, placa) de `src/lib/masks.ts`.
3. Ter os botões: **Preencher teste** (`exemplo`), **Limpar** e **Gerar preview**.
4. Rascunhos: `FormDraftsPanel` + `saveFormDraft` — guarda as 3 últimas gerações por 2 horas.
5. Modo edição: ler `location.state.editDocId` / `formData` e pré-preencher.
6. Ao submeter:

```tsx
const positions = loadModuloFieldPositions();
const templateBase64 = await loadTemplateBase64(templateUrl);
const { data, error } = await invokeGeneratePdf("generate-modulo-pdf", {
  body: { ...form, positions, templateBase64, preview: true },
});
const previewId = storePreviewPayload({ pdfBase64: data.pdfBase64, formData: form });
navigate("/dashboard/documents/modulo/preview", { state: { previewId } });
```

Nunca passe o PDF em base64 direto no `state` da rota — use `storePreviewPayload`
(memória, 1 payload por vez) para não estourar a memória no celular.

---

## 7. ETAPA 7 — MOTOR DE PDF NO NAVEGADOR

Todos os módulos passam por um único `src/lib/browser-pdf.ts`. Ele:

1. Chama a Edge Function, recebe o HTML.
2. Injeta o HTML num iframe/offscreen com o tamanho exato da página em pt.
3. Rasteriza com `html2canvas-pro` em **faixas (banding)** adaptativas — nunca a página inteira
   de uma vez, senão o Safari/iOS estoura a memória do canvas.
4. Monta o PDF com `jsPDF`, uma imagem JPEG por faixa, codificada de forma **assíncrona**
   (Blob + FileReader) para não travar a UI no Android.

Parâmetros que você DEVE respeitar:

- **Preview: ~288 DPI. PDF final: ~576 DPI.** O preview rápido é o que segura a percepção de velocidade.
- **Orçamento de pixels por canvas:** iOS ≈ 14 milhões, Android ≈ 18 milhões, desktop maior.
- **Hardware fraco** (≤ 4 GB RAM ou ≤ 4 núcleos, inclusive PCs) recebe política "mobile":
  escala reduzida e mais faixas.
- **Escada de segurança:** se a rasterização falhar ou o canvas vier vazio, reduza a escala e
  tente de novo (3 degraus) antes de mostrar erro, com botão "Tentar novamente".
- **Anti-black probe:** amostre pixels do canvas; se vier todo preto/transparente, refaça —
  é uma falha conhecida do WebKit.

---

## 8. ETAPA 8 — PÁGINA DE PREVIEW (`<Modulo>PreviewPage.tsx`)

Copie o padrão dos módulos existentes. Ela precisa ter, nesta ordem:

1. `readPreviewPayload(location.state)`; se vazio, botão "Voltar ao formulário".
2. `PdfCanvasPreview` renderizando o PDF em canvas (com **lupa 3x** ao toque para conferir
   microtextos, já que o preview é 288 DPI).
3. **Marca d'água diagonal repetida** enquanto não pago, com faixas em `hsl(var(--destructive)/0.06)`.
4. Card de custo em créditos (`planCost(qtd, user.plano)`), saldo atual, botão **Gerar documento**.
5. No `handleGenerate`: chamar a função com `preview: false`, **só então** `deductCredit(...)`,
   e se a dedução falhar, não entregar o PDF (nenhum crédito é descontado em erro de geração).
6. `addDocument({ name, identification, date, description, additionalInfo: JSON.stringify(form), type, userId, pdfDataUrl })`.
7. Após pago: **Baixar** (Blob + `URL.createObjectURL`) e **Compartilhar** (`navigator.share` com fallback para download).
8. Bloco "Mensagem de entrega" com texto pronto e botão **Copiar mensagem**.

Overlay de carregamento (`GenerationOverlay`) deve permanecer visível até o **primeiro frame
pintado no canvas** — sumir antes causa o flash de tela preta.

---

## 9. ETAPA 9 — QR CODE E VALIDAÇÃO (se o documento tiver)

- O QR é um **overlay SVG de alta densidade** (versão 12) posicionado por coordenada própria,
  redimensionável no editor de alinhamento mantendo a âncora inferior-direita.
- A URL aponta para o portal público de validação, no formato `https://<portal>/<documento_id>`.
  O `documento_id` é o identificador do registro — nada de token na URL.
- A gravação no banco do portal parceiro acontece **sempre via Edge Function** (proxy servidor),
  autenticada por token guardado no cofre de segredos. **Jamais** escreva do navegador com
  chave de serviço, e **jamais** conceda `insert` ao papel `anon` — isso já gerou milhares de
  registros lixo em produção.

---

## 10. ETAPA 10 — ROTAS, MENU E HISTÓRICO

1. **Rotas** em `App.tsx`, sempre com `lazy` + wrapper de retry (`lazy-retry.ts`) e boundary de rota:
   ```tsx
   <Route path="documents/modulo" element={<ModuloFormPage />} />
   <Route path="documents/modulo/preview" element={<ModuloPreviewPage />} />
   ```
2. **Menu de serviços** (`DocumentsPage.tsx`): adicione o card na categoria correta.
   Categorias em MAIÚSCULAS: DIGITAIS, ARMAS, DIPLOMAS, ESCOLARES, CERTIDÕES, COMPROVANTES,
   ATESTADOS, RECEITAS, FINANCEIRO. Navegação em dois níveis.
3. **Mapas de documento** (`document-routes.ts`): registre `DOCUMENT_FORM_ROUTES["modulo"]`
   e `DOCUMENT_TYPE_LABELS["modulo"]` — sem isso o histórico não consegue reabrir/editar.
4. **Histórico**: já funciona sozinho se o `addDocument` recebeu `type` e `additionalInfo`,
   incluindo as ações Renovar (+30 dias, 1 crédito) e Excluir.

---

## 11. CHECKLIST DE ACEITE (não entregue sem passar por tudo)

- [ ] Fundo em 600 DPI, dados variáveis apagados, salvo em WebP.
- [ ] Spec de campos completa, medida (não chutada), com `w` em todos.
- [ ] `*_DEFAULT_POSITIONS` da Edge Function **idênticos** aos do editor de alinhamento.
- [ ] "Preencher teste" gera um PDF **visualmente indistinguível** do documento original.
- [ ] Datas e horas de teste são válidas (nada de `05:64` — use gerador de 0–59).
- [ ] Nenhum texto truncado, nenhum campo estourando a caixa, nenhum número azul no iOS.
- [ ] Preview abre em < 3 s no celular; PDF final em 576 DPI.
- [ ] Lupa 3x funcionando no preview.
- [ ] Marca d'água antes do pagamento; some depois.
- [ ] Créditos descontados **uma única vez** e nunca em caso de erro.
- [ ] Alinhamento salvo no banco e refletido em outro dispositivo.
- [ ] Documento aparece no histórico, reabre no formulário, baixa e compartilha.
- [ ] Testado em iOS Safari, Android Chrome e desktop com 4 GB de RAM.

---

## 12. ORDEM DE EXECUÇÃO RESUMIDA

```text
template recebido
  → 1. rasterizar 600 DPI + limpar dados + salvar WebP
  → 2. mapear campos (x, y, w, fontSize) em pt
  → 3. Edge Function: SPEC + DEFAULT_POSITIONS + buildHtml
  → 4. src/lib/<modulo>-align.ts + registro no align-sync
  → 5. registrar no editor de alinhamento (mesmos defaults + mesmo CSS)
  → 6. FormPage (seções, máscaras, exemplo, rascunhos)
  → 7. gerar via browser-pdf (preview 288 DPI)
  → 8. PreviewPage (lupa, marca d'água, créditos, download, compartilhar)
  → 9. QR Code + ingestão server-side (se houver validação)
  → 10. rotas + card no menu + labels de histórico
  → 11. checklist de aceite → ajuste fino no editor de alinhamento
```

**Regra de ouro:** o alinhamento nunca fica perfeito na primeira tentativa. Gere com o
"Preencher teste", abra o editor, ajuste com as setas, salve no banco e gere de novo.
Repita até a sobreposição com o documento original ser pixel-perfect.
