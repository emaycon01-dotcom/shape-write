# Deixar o sistema leve — sem perder qualidade de geração

O travamento não vem da qualidade do PDF. Vem de **como os arquivos gigantes circulam dentro do navegador** e de quanto peso cada tela carrega antes mesmo de você gerar algo. Dá para cortar o peso pela metade mantendo os mesmos 576/600 DPI, os mesmos templates e o mesmo resultado final.

## O que está pesando hoje

1. **Templates viram texto base64.** Cada template de 3–6 MB é convertido em uma string base64 (+33% de tamanho) e essa string é copiada várias vezes: no cache, no formulário, no HTML e no motor de PDF. Um único documento chega a ocupar 40–60 MB de memória só de texto. No iPhone/iPad isso é o que fecha a aba.
2. **O cache guarda 4 templates ao mesmo tempo** e nunca libera ao trocar de módulo.
3. **Formulários carregam tabelões junto.** Listas de cursos (7.000 linhas), medicamentos, cidades e grades entram no mesmo pacote da tela, mesmo quando não são usadas.
4. **Rascunho salvo a cada tecla** em telas com 60+ campos, provocando gravação em disco e re-render a cada letra.
5. **Nada é liberado ao sair da tela**: preview, bitmaps e payloads ficam presos na memória enquanto o cliente navega entre módulos.
6. **Filas de sincronização rodam durante a geração**, disputando memória e rede justamente no pior momento.

## O que será feito

**1. Fim do base64 no caminho pesado**
Trocar as strings `data:` por `blob:` (URL de objeto). O navegador passa a apontar para o arquivo em vez de copiar texto. Mesma imagem, mesmos pixels, memória caindo de ~4x para ~1x. Mantém `data:` só onde é obrigatório (envio ao validador).

**2. Cache de template com liberação real**
Guardar apenas o template em uso, revogar os blobs anteriores ao trocar de módulo ou sair da tela.

**3. Divisão dos pacotes pesados**
Cursos, medicamentos, cidades e grades passam a ser carregados sob demanda (import dinâmico), tirando megabytes do carregamento inicial de cada formulário.

**4. Formulários mais leves**
Rascunho com atraso de 800 ms em vez de a cada tecla, campos isolados para não re-renderizar a tela inteira, e trava única de "gerar" para impedir duas gerações simultâneas por toque duplo.

**5. Limpeza ao sair da tela**
Preview, canvas e payloads liberados ao navegar; filas de sincronização pausadas enquanto um documento está sendo gerado e retomadas depois.

**6. Diagnóstico real, não achismo**
Registrar no log de geração: módulo, memória do aparelho, tempo gasto e motivo exato da falha. Assim os próximos problemas aparecem com nome e sobrenome em vez de "travou".

## Como vou validar

- Teste real no navegador (Playwright) gerando CNH, Comprovante e Histórico Superior, medindo memória antes/depois e confirmando o PDF final.
- Relatório de tamanho dos pacotes antes e depois.
- Comparação visual do PDF gerado para garantir que nada mudou na qualidade.

## Detalhes técnicos

- `src/lib/template-cache.ts`: nova API `loadTemplateObjectUrl()` com `revokeAll()`; `loadTemplateBase64` mantida apenas para os fluxos de sincronização.
- `src/lib/browser-pdf.ts` / `src/lib/canvas-pdf.ts`: aceitar `blob:`/`http:` nos campos de template e liberar `ImageBitmap`/canvas após cada banda.
- Formulários: `saveFormDraft` com debounce; `React.memo` nos blocos de campos.
- Imports dinâmicos em `diploma-cursos-mega.ts`, `medicamentos.ts`, `cidades-brasil.ts`, `grades-curriculares.ts`.
- `cnh-sync-queue` / `doc-sync-queue`: flag global de geração em andamento.
- Nada muda em DPI, coordenadas de alinhamento, templates ou integrações de validador.
