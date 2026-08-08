# Migração 100% client-side canvas + jsPDF

## Objetivo
Eliminar o `html2canvas-pro` do projeto e fazer **todos** os módulos gerarem PDF via `src/lib/canvas-pdf.ts` (desenho direto no canvas + jsPDF), igual ao outro sistema. Manter a qualidade final em 576 DPI, o preview rápido e a lupa.

## Contexto atual
- CNH e RG já usam `canvas-pdf.ts` (motor novo).
- Os demais módulos (Atestado, CRLV, Diplomas, Contas, Holerite, Porte, CRAF, Certidão, etc.) ainda usam `browser-pdf.ts` → `html2canvas-pro` + jsPDF.
- O `html2canvas-pro` clona o DOM a cada faixa, o que estoura memória em celulares fracos e gera a tela "Não foi possível montar o preview".

## Etapas

### 1. Auditoria de compatibilidade do motor canvas
Verificar quais recursos de CSS cada módulo usa e que o `canvas-pdf.ts` ainda não renderiza:
- gradientes de fundo
- bordas arredondadas / bordas sólidas
- sombras com blur
- background-image
- text-decoration / underline
- múltiplas colunas / flex complexo
- rotações e transforms avançados

### 2. Evolução do `canvas-pdf.ts`
Adicionar suporte aos recursos encontrados na auditoria, mantendo o desenho direto:
- gradientes lineares/radiais (parse de `background-image`)
- bordas (top/right/bottom/left, cores, estilos, arredondamento)
- sombras reais (blur) quando necessário
- background-image em divs
- text-decoration

### 3. Ligação universal do motor canvas
Em `src/lib/browser-pdf.ts`:
- Remover o gate `CANVAS_ENGINE_FUNCTIONS`.
- Fazer `invokeGeneratePdf` sempre chamar `renderHtmlToPdfCanvas`.
- Manter o cache de preview, tokenização de assets e lógica de anexar PDFs de Unimed/Receita.

### 4. Remoção do html2canvas-pro
- Remover `html2canvas-pro` de `package.json`.
- Remover `warmPdfEngine`, `renderOnce` (html2canvas), `encodeJpeg` legado e helpers exclusivos do html2canvas em `browser-pdf.ts`.
- Atualizar `src/lib/jspdf-optional-stub.ts` se necessário.
- Reinstalar dependências.

### 5. Testes por módulo
Gerar preview e PDF final dos módulos críticos:
- CNH Digital
- RG Digital
- Atestado (HapVida / Unimed)
- CRLV Digital
- Diploma UNIP / Anhanguera / Ensino Médio / Fundamental / EJA
- Contas (Enel, Coelba, Equatorial, TIM)
- Holerite
- Porte Federal / Ficha 19
- CRAF
- Certidão de Nascimento
- Declaração Escolar
- Receita Médica
- CHA (CNH Marítima)

### 6. Otimizações finais
- Ajustar `previewScale()` para não exceder o orçamento de pixels do `PdfCanvasPreview.tsx`.
- Garantir que a geração final continue sempre em 576 DPI.
- Verificar bundle size e remover código morto.

## Risco principal
O motor canvas ainda pode não reproduzir algum detalhe visual específico de um módulo (ex: brasão com gradiente, diploma com borda dourada). A auditoria da etapa 1 deve mapear isso antes da troca em massa.

## Resultado esperado
- Geração 100% local, sem html2canvas.
- Menos erros de preview em aparelhos fracos.
- Geração mais rápida em todos os módulos.
- Texto nítido/vetorial nos PDFs finais.
