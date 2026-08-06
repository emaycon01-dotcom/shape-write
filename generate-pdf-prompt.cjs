const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  PageBreak, Header, Footer, PageNumber
} = require("docx");
const fs = require("fs");

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 22 },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1a1a1a" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2c2c2c" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "3d3d3d" },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [new TextRun({ text: "PROMPT MESTRE — GERAÇÃO DE PDF NO NAVEGADOR", bold: true, size: 18, color: "666666" })],
          alignment: AlignmentType.RIGHT,
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: "Página ", size: 18, color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" }),
          ],
          alignment: AlignmentType.CENTER,
        })],
      }),
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "PROMPT MESTRE", bold: true, size: 56, color: "111111" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "Geração de PDF no Navegador", size: 32, color: "444444" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: "Arquitetura técnica: Preview → PDF Final → Histórico → Dedução", size: 22, italics: true, color: "666666" })],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. Objetivo e Escopo")] }),
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun("Este documento descreve, de forma genérica e reutilizável, a arquitetura de geração de documentos digitais no próprio navegador do usuário. O foco é o pipeline técnico: como os dados do formulário se transformam em preview, como o preview evolui para o PDF final, como o documento é armazenado no histórico e como ocorre a cobrança de créditos. Não serão citados nomes de serviços, órgãos ou modelos específicos de documento.")],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. Arquitetura Geral")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: "Princípio fundamental: ", bold: true }), new TextRun("toda a rasterização acontece no cliente. O backend só executa funções de validação, auditoria e persistência de metadados. O motor é composto por:")],
      }),
      new Paragraph({ children: [new TextRun("• html2canvas-pro: rasteriza o DOM do template em imagens de alta fidelidade.")] }),
      new Paragraph({ children: [new TextRun("• jsPDF: monta o PDF final a partir das imagens rasterizadas, página a página.")] }),
      new Paragraph({ children: [new TextRun("• pdf.js: renderiza o preview em um canvas leve, sem depender de iframes pesadas.")] }),
      new Paragraph({ children: [new TextRun("• Cache de assets: templates e imagens pesadas são decodificadas uma única vez por sessão.")] }),
      new Paragraph({ children: [new TextRun("• Gerenciador de loading: centraliza estados de geração para evitar telas pretas/brancas entre transições.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. Fluxo de Geração: Preview")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 Entrada de dados")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("O usuário preenche um formulário. Cada campo é validado localmente (máscaras, obrigatoriedade, consistência). Ao concluir, o aplicativo monta um objeto payload contendo os dados do formulário, a imagem de fundo do template e quaisquer imagens adicionais (foto, assinatura, QR Code).")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 Montagem do HTML de preview")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("O preview é um HTML invisível no DOM, posicionado fora da viewport (fixed, left: -9999px). Ele contém: a imagem de fundo do template, campos de texto posicionados por coordenadas, imagens dinâmicas (foto, assinatura) e um QR Code de validação. O objetivo do preview é mostrar ao usuário uma versão aproximada do documento final, com baixo custo de memória.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.3 Rasterização do preview")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("O motor captura o HTML invisível usando html2canvas-pro com escala reduzida (geralmente 1.5x a 2x). A saída é uma imagem JPEG comprimida, leve o suficiente para ser exibida instantaneamente em um canvas. Durante a captura, uma marca d'água semitransparente é sobreposta para indicar que é apenas preview.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.4 Apresentação ao usuário")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("O preview é apresentado em um componente de canvas próprio. O componente cria um novo elemento canvas a cada renderização, descartando o anterior, para evitar corrupção de estado gráfico em navegadores móveis. O loading só some quando o primeiro frame do PDF já foi desenhado, garantindo que o usuário nunca veja uma tela em branco.")],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. Fluxo de Geração: PDF Final")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 Gatilho de geração")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Quando o usuário confirma o preview, o sistema verifica saldo de créditos. Se houver saldo, inicia a geração final. A dedução só ocorre APÓS o PDF ser gerado com sucesso, nunca antes. Isso evita cobranças por falhas técnicas.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 HTML de alta resolução")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("O mesmo HTML do preview é clonado, mas com escala muito maior (alta densidade de pixels, tipicamente ~576 DPI equivalente). O template de fundo é reutilizado do cache de assets para evitar reconversão. O QR Code é regenerado na resolução final, mantendo a mesma posição e dimensões do preview.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.3 Divisão em bandas adaptativa")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Para evitar travamentos em dispositivos com pouca memória, o documento é dividido em bandas horizontais. A altura da banda é adaptativa: se uma banda renderizar em menos de 1.5s, a próxima terá o dobro da altura; se falhar por falta de memória, a altura é reduzida e a renderização é repetida. Cada banda é convertida em JPEG assíncrono via Blob/FileReader para não bloquear a thread principal.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.4 Montagem do PDF")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("As bandas são inseridas no jsPDF uma a uma, com as dimensões exatas da página. O PDF resultante é convertido para base64/dataURL e entregue à página de resultado. A qualidade final é máxima, sem marca d'água e sem perda de fidelidade visual.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.5 Detecção de falhas")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Após cada renderização, o motor executa um 'anti-black probe': verifica se a banda ficou totalmente preta ou transparente (pixel alpha < 8). Se detectar, a banda é re-renderizada com menor escala ou maior fragmentação. Isso evita PDFs corrompidos ou em branco.")],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. Otimizações de Performance")] }),
      new Paragraph({ children: [new TextRun("• Warm-up: os módulos html2canvas-pro, jsPDF e pdf.js são pré-carregados assim que o usuário entra no formulário, não na hora da geração.")] }),
      new Paragraph({ children: [new TextRun("• Cache de templates: imagens de fundo pesadas (WebP) são mantidas em blob URLs durante toda a sessão.")] }),
      new Paragraph({ children: [new TextRun("• Cache de preview HTML: o payload do preview é hasheado; se o usuário voltar sem alterar dados, o preview anterior é reutilizado.")] }),
      new Paragraph({ children: [new TextRun("• Orçamento de pixels: o canvas do preview respeita um orçamento baseado na memória do dispositivo (3M/6M/12M pixels), evitando tela preta em iOS/Android.")] }),
      new Paragraph({ children: [new TextRun("• Descarte de payloads antigos: apenas o preview mais recente é mantido na memória, evitando duplicação de PDFs e fotos.")] }),
      new Paragraph({ children: [new TextRun("• Canvas novo por render: o componente de preview nunca reaproveita o mesmo elemento canvas, evitando transformações corrompidas no WebKit.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. Histórico e Armazenamento")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 Persistência do documento")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Após a geração bem-sucedida e a dedução de créditos, o PDF final é salvo no histórico do usuário. O registro contém: nome/identificação do documento, data de referência, tipo, informações adicionais serializadas em JSON, data de criação e o próprio PDF em base64 (ou referência a storage, dependendo da política de privacidade).")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.2 Ações do histórico")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("No histórico, o usuário pode: visualizar o documento novamente, baixar o PDF, compartilhar via Web Share API, renovar o documento (custo de 1 crédito, estende a validade em +30 dias) e excluir o registro. A exclusão remove o registro do banco e, se aplicável, o arquivo de storage.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.3 Auditoria e logs")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Toda ação sensível (geração, renovação, exclusão, alteração de créditos por staff) gera um log de auditoria. Os logs são enxugados automaticamente: a cada 50 novos registros de um usuário, os 50 mais antigos são removidos, mantendo o banco enxuto sem perder rastreabilidade recente.")],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. Dedução de Créditos e Segurança")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.1 Verificação de saldo")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Antes de iniciar a geração final, o frontend consulta o saldo do usuário. Se o saldo for insuficiente, a geração é bloqueada e uma mensagem orienta a recarga. O cálculo do custo respeita o plano ativo do usuário, aplicando descontos progressivos conforme a hierarquia do plano.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.2 Dedução atômica")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("A dedução é feita por uma RPC no banco (por exemplo, consume_credits), que decrementa o saldo e registra a transação em uma única operação atômica. Se a dedução falhar, o PDF gerado não é entregue ao usuário e nenhum crédito é perdido. Se a geração do PDF falhar, a dedução não é chamada.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.3 Controle de acesso")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("A geração só é permitida para usuários aprovados e verificados. Usuários recém-criados permanecem em estado 'não verificado' até que um administrador clique em 'Verificar conta'. Enquanto não verificados, podem fazer login, mas não conseguem acessar formulários nem gerar documentos.")],
      }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.4 Proteção de dados administrativos")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Contas administrativas nunca devem ter e-mail, UUID ou identificadores expostos em tabelas acessíveis por gerentes ou usuários comuns. As políticas de RLS devem filtrar linhas de administradores para qualquer role inferior. RPCs de gerenciamento devem rejeitar tentativas de alterar contas administrativas.")],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. Validação Pública")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Documentos que precisam de validação externa recebem um QR Code dinâmico. Ao escanear, o visitante é direcionado a uma página pública de validação. Essa página consulta uma Edge Function privada (com chave de API interna) e retorna apenas dados mascarados: nome parcial, tipo do documento, status de validade e data de expiração. Nenhum dado sensível completo é exposto no front público.")],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. UX e Estados de Loading")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("A experiência de geração deve ser fluida. O overlay de loading só aparece se a operação durar mais de 200ms e permanece no mínimo 500ms para evitar piscadas. A mensagem informa explicitamente que o processo pode levar alguns segundos e que a tela não deve ser fechada. Ao concluir, o usuário é levado automaticamente para a tela de resultado, já com o PDF renderizado.")],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("10. Estrutura de Dados Recomendada")] }),
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "Payload de geração:", bold: true })],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("{")],
      }),
      new Paragraph({ children: [new TextRun("  formData: { /* dados do formulário */ },")] }),
      new Paragraph({ children: [new TextRun("  templateUrl: 'url-do-template-webp',")] }),
      new Paragraph({ children: [new TextRun("  photoBase64: 'data:image/jpeg;base64,...',")] }),
      new Paragraph({ children: [new TextRun("  signatureBase64: 'data:image/png;base64,...',")] }),
      new Paragraph({ children: [new TextRun("  qrToken: 'uuid-de-validacao',")] }),
      new Paragraph({ children: [new TextRun("  preview: true | false")] }),
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun("}")],
      }),
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "Registro de histórico:", bold: true })],
      }),
      new Paragraph({ children: [new TextRun("{")] }),
      new Paragraph({ children: [new TextRun("  id, user_id, type, name, identification, date,")] }),
      new Paragraph({ children: [new TextRun("  description, additional_info (JSON),")] }),
      new Paragraph({ children: [new TextRun("  pdf_data_url, created_at, expires_at")] }),
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun("}")],
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("11. Checklist de Implementação")] }),
      new Paragraph({ children: [new TextRun("1. Formulário valida todos os campos antes de montar o payload.")] }),
      new Paragraph({ children: [new TextRun("2. Preview renderiza em resolução reduzida com marca d'água.")] }),
      new Paragraph({ children: [new TextRun("3. PDF final usa a mesma estrutura do preview, mas em alta resolução.")] }),
      new Paragraph({ children: [new TextRun("4. Dedução só ocorre após sucesso na geração.")] }),
      new Paragraph({ children: [new TextRun("5. Histórico salva metadados + PDF final.")] }),
      new Paragraph({ children: [new TextRun("6. Validação pública expõe apenas dados mascarados.")] }),
      new Paragraph({ children: [new TextRun("7. Cache de templates e preview evita reprocessamento.")] }),
      new Paragraph({ children: [new TextRun("8. Anti-black probe garante integridade visual.")] }),
      new Paragraph({ children: [new TextRun("9. Loading overlay sincronizado com o primeiro frame renderizado.")] }),
      new Paragraph({ children: [new TextRun("10. RLS e RPCs protegem contas administrativas e limitam ações de gerentes.")] }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. Considerações Finais")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("A geração no navegador elimina custos de APIs externas de PDF e permite fidelidade visual absoluta, pois o mesmo HTML usado no preview é reaproveitado no final. O desafio principal é o gerenciamento de memória em dispositivos móveis. Por isso, divisão em bandas, cache inteligente, orçamento de pixels e fallback automático são obrigatórios. Sempre que ajustar a qualidade do preview, isolar a mudança para não afetar o PDF final — e vice-versa.")],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("/dev-server/PROMPT-GERACAO-PDF-NAVEGADOR-v2.docx", buffer);
  console.log("DOCX criado em /dev-server/PROMPT-GERACAO-PDF-NAVEGADOR-v2.docx");
});
