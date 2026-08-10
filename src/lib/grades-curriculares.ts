/**
 * Grades curriculares para o HISTÓRICO ESCOLAR (superior).
 *
 * Estratégia:
 *  1) GRADES_REAIS  -> grades reais dos cursos mais pedidos (disciplina|carga horária).
 *  2) Gerador       -> para qualquer outro dos milhares de cursos do catálogo,
 *                      monta uma grade coerente = núcleo comum + banco temático da área.
 *
 * Em ambos os casos o cliente pode editar tudo no formulário.
 */

export interface DisciplinaGrade {
  nome: string;
  ch: number;
}

export interface SemestreGrade {
  /** 1º, 2º, 3º ... (posição na sequência) */
  indice: number;
  disciplinas: DisciplinaGrade[];
}

/* ------------------------------------------------------------------ utils */

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

function parse(list: string[]): DisciplinaGrade[] {
  return list.map((raw) => {
    const [nome, ch] = raw.split("|");
    return { nome: nome.trim(), ch: Number(ch) || 60 };
  });
}

/* ------------------------------------------------------------ grades reais */

/** Cada item é um semestre; cada string é "Disciplina|CargaHorária". */
const REAIS: Record<string, string[][]> = {
  "ENGENHARIA MECANICA": [
    ["Álgebra Linear|40", "Desenvolvimento Pessoal e Profissional|40", "Física I|80", "Matemática I|80", "Pesquisa e Atividades Complementares I|60", "Química|80"],
    ["Administração|40", "Estatística|80", "Física II|80", "Matemática II|80", "Pesquisa e Atividades Complementares II|60", "Responsabilidade Social e Meio Ambiente|40"],
    ["Algoritmos e Programação|40", "Direito e Legislação|40", "Física III|80", "Matemática III|80", "Mecânica Geral|80", "Pesquisa e Atividades Complementares III|60"],
    ["Desenho Técnico|80", "Direitos Humanos|40", "Eletricidade Aplicada|80", "Engenharia Econômica|40", "Fenômenos de Transporte I|80", "Pesquisa e Atividades Complementares IV|60"],
    ["Desenho Técnico-Mecânico|40", "Fenômenos de Transporte II|80", "Materiais|80", "Metrologia Industrial|60", "Pesquisa e Atividades Complementares V|60", "Resistência dos Materiais|80"],
    ["Mecânica Aplicada|80", "Pesquisa e Atividades Complementares VI|60", "Processos Metalúrgicos|60", "Resistência dos Materiais II|80", "Seleção de Materiais|40", "Sistemas Fluidomecânicos|80"],
    ["Dinâmica das Máquinas e Vibrações|60", "Elementos de Máquinas I|80", "Eletrônica e Instrumentação|80", "Engenharia do Produto|40", "Estágio Supervisionado I|90", "Termodinâmica Aplicada|80"],
    ["Elementos de Máquinas II|80", "Ergonomia e Segurança do Trabalho|40", "Estágio Supervisionado II|90", "Máquinas Térmicas I|80", "Planejamento, Programação e Controle da Produção|60", "Processos de Fabricação I|80"],
    ["Fabricação Assistida por Computador|80", "Máquinas Térmicas II|60", "Processos de Fabricação II|80", "Projeto de Máquinas|80", "Projetos de Engenharia Mecânica|40", "Trabalho de Conclusão de Curso I|90"],
    ["Controle e Automação de Processos|80", "Engenharia Automotiva|80", "Engenharia de Manutenção|60", "Máquinas de Elevação e Transporte|80", "Tópicos Complementares de Engenharia Mecânica|40", "Trabalho de Conclusão de Curso II|90", "Tubulações Industriais e Vasos de Pressão|60"],
  ],
  "ENGENHARIA CIVIL": [
    ["Álgebra Linear|40", "Desenvolvimento Pessoal e Profissional|40", "Física I|80", "Matemática I|80", "Pesquisa e Atividades Complementares I|60", "Química|80"],
    ["Administração|40", "Desenho Técnico|80", "Estatística|80", "Física II|80", "Matemática II|80", "Responsabilidade Social e Meio Ambiente|40"],
    ["Algoritmos e Programação|40", "Direito e Legislação|40", "Física III|80", "Matemática III|80", "Mecânica Geral|80", "Topografia I|60"],
    ["Direitos Humanos|40", "Engenharia Econômica|40", "Fenômenos de Transporte|80", "Materiais de Construção Civil I|80", "Resistência dos Materiais I|80", "Topografia II|60"],
    ["Geologia Aplicada à Engenharia|60", "Hidráulica|80", "Materiais de Construção Civil II|80", "Mecânica dos Solos I|80", "Resistência dos Materiais II|80", "Teoria das Estruturas I|80"],
    ["Hidrologia Aplicada|60", "Instalações Hidrossanitárias|80", "Mecânica dos Solos II|80", "Saneamento Ambiental|60", "Teoria das Estruturas II|80", "Tecnologia do Concreto|60"],
    ["Concreto Armado I|80", "Estágio Supervisionado I|90", "Estradas e Pavimentação|80", "Fundações|80", "Instalações Elétricas Prediais|80", "Sistemas Estruturais|60"],
    ["Concreto Armado II|80", "Estágio Supervisionado II|90", "Estruturas de Aço e Madeira|80", "Gerenciamento de Obras|60", "Planejamento e Orçamento de Obras|80", "Segurança do Trabalho na Construção|40"],
    ["Barragens e Obras de Terra|60", "Estruturas de Concreto Protendido|60", "Patologia das Construções|60", "Portos, Rios e Canais|60", "Projetos de Engenharia Civil|40", "Trabalho de Conclusão de Curso I|90"],
    ["Construção Civil Sustentável|60", "Engenharia de Tráfego|60", "Manutenção Predial|60", "Tópicos Complementares de Engenharia Civil|40", "Trabalho de Conclusão de Curso II|90"],
  ],
  "ENGENHARIA ELETRICA": [
    ["Álgebra Linear|40", "Desenvolvimento Pessoal e Profissional|40", "Física I|80", "Matemática I|80", "Pesquisa e Atividades Complementares I|60", "Química|80"],
    ["Administração|40", "Desenho Técnico|80", "Estatística|80", "Física II|80", "Matemática II|80", "Responsabilidade Social e Meio Ambiente|40"],
    ["Algoritmos e Programação|40", "Circuitos Elétricos I|80", "Direito e Legislação|40", "Física III|80", "Matemática III|80", "Mecânica Geral|80"],
    ["Circuitos Elétricos II|80", "Direitos Humanos|40", "Eletromagnetismo|80", "Engenharia Econômica|40", "Materiais Elétricos|60", "Sinais e Sistemas|60"],
    ["Conversão Eletromecânica de Energia|80", "Eletrônica Analógica I|80", "Eletrônica Digital|80", "Instrumentação e Medidas Elétricas|60", "Máquinas Elétricas I|80", "Sistemas de Controle I|60"],
    ["Eletrônica Analógica II|80", "Eletrônica de Potência|80", "Máquinas Elétricas II|80", "Microcontroladores|80", "Sistemas de Controle II|60", "Sistemas Elétricos de Potência I|80"],
    ["Acionamentos Elétricos|80", "Estágio Supervisionado I|90", "Instalações Elétricas Industriais|80", "Proteção de Sistemas Elétricos|60", "Sistemas Elétricos de Potência II|80", "Subestações|60"],
    ["Automação Industrial|80", "Estágio Supervisionado II|90", "Eficiência Energética|60", "Geração de Energia Elétrica|80", "Qualidade de Energia|60", "Redes de Distribuição|80"],
    ["Energias Renováveis|60", "Projetos Elétricos|80", "Redes Industriais|60", "Segurança em Instalações Elétricas (NR-10)|40", "Trabalho de Conclusão de Curso I|90"],
    ["Manutenção Elétrica Industrial|60", "Sistemas Embarcados|60", "Smart Grids|60", "Tópicos Complementares de Engenharia Elétrica|40", "Trabalho de Conclusão de Curso II|90"],
  ],
  "ENGENHARIA DE PRODUCAO": [
    ["Álgebra Linear|40", "Desenvolvimento Pessoal e Profissional|40", "Física I|80", "Matemática I|80", "Pesquisa e Atividades Complementares I|60", "Química|80"],
    ["Administração|40", "Desenho Técnico|80", "Estatística|80", "Física II|80", "Matemática II|80", "Responsabilidade Social e Meio Ambiente|40"],
    ["Algoritmos e Programação|40", "Contabilidade e Custos|60", "Direito e Legislação|40", "Física III|80", "Matemática III|80", "Mecânica Geral|80"],
    ["Direitos Humanos|40", "Engenharia Econômica|60", "Fenômenos de Transporte|80", "Gestão da Qualidade|60", "Materiais|80", "Resistência dos Materiais|80"],
    ["Engenharia de Métodos|60", "Ergonomia e Segurança do Trabalho|60", "Pesquisa Operacional I|60", "Processos de Fabricação|80", "Sistemas de Informação Gerencial|60", "Estatística Aplicada|60"],
    ["Controle Estatístico de Processos|60", "Gestão de Estoques|60", "Logística Empresarial|60", "Pesquisa Operacional II|60", "Planejamento e Controle da Produção I|80", "Projeto de Fábrica e Layout|60"],
    ["Estágio Supervisionado I|90", "Gestão da Cadeia de Suprimentos|60", "Gestão de Projetos|60", "Manutenção Industrial|60", "Planejamento e Controle da Produção II|80", "Automação da Produção|60"],
    ["Estágio Supervisionado II|90", "Gestão Ambiental|40", "Gestão de Pessoas|60", "Simulação de Sistemas Produtivos|60", "Sistemas Integrados de Gestão (ERP)|60", "Produção Enxuta|60"],
    ["Empreendedorismo|40", "Engenharia da Confiabilidade|60", "Estratégia e Competitividade|60", "Gestão de Custos Industriais|60", "Trabalho de Conclusão de Curso I|90"],
    ["Indústria 4.0|60", "Inovação Tecnológica|40", "Qualidade Seis Sigma|60", "Tópicos Complementares de Engenharia de Produção|40", "Trabalho de Conclusão de Curso II|90"],
  ],
  "ENGENHARIA DE COMPUTACAO": [
    ["Álgebra Linear|40", "Algoritmos e Programação|80", "Desenvolvimento Pessoal e Profissional|40", "Física I|80", "Matemática I|80", "Química|80"],
    ["Arquitetura de Computadores|80", "Estatística|80", "Estrutura de Dados|80", "Física II|80", "Matemática II|80", "Responsabilidade Social e Meio Ambiente|40"],
    ["Circuitos Elétricos|80", "Direito e Legislação|40", "Eletrônica Digital|80", "Física III|80", "Matemática III|80", "Programação Orientada a Objetos|80"],
    ["Banco de Dados|80", "Direitos Humanos|40", "Eletrônica Analógica|80", "Engenharia de Software|60", "Microprocessadores|80", "Sistemas Operacionais|80"],
    ["Compiladores|60", "Inteligência Artificial|60", "Microcontroladores|80", "Redes de Computadores|80", "Sinais e Sistemas|60", "Sistemas Digitais|80"],
    ["Computação Gráfica|60", "Processamento Digital de Sinais|60", "Redes Industriais|60", "Segurança da Informação|60", "Sistemas Distribuídos|60", "Sistemas Embarcados|80"],
    ["Estágio Supervisionado I|90", "Interface Homem-Máquina|60", "Robótica|60", "Sistemas de Controle|60", "Computação em Nuvem|60", "Automação Industrial|80"],
    ["Estágio Supervisionado II|90", "Aprendizado de Máquina|60", "Internet das Coisas|60", "Gestão de Projetos de TI|60", "Visão Computacional|60", "Empreendedorismo|40"],
    ["Projeto Integrado de Computação|80", "Sistemas Ciberfísicos|60", "Tópicos Avançados em Redes|60", "Trabalho de Conclusão de Curso I|90"],
    ["Ética e Legislação em Informática|40", "Qualidade de Software|60", "Tópicos Complementares de Engenharia de Computação|40", "Trabalho de Conclusão de Curso II|90"],
  ],
  "ADMINISTRACAO": [
    ["Desenvolvimento Pessoal e Profissional|40", "Fundamentos da Administração|80", "Matemática Aplicada|80", "Metodologia Científica|40", "Sociologia|40", "Teoria Geral da Administração|80"],
    ["Contabilidade Geral|80", "Direito e Legislação|40", "Economia|80", "Estatística Aplicada|80", "Psicologia Organizacional|40", "Responsabilidade Social e Meio Ambiente|40"],
    ["Comportamento Organizacional|60", "Contabilidade de Custos|60", "Direitos Humanos|40", "Gestão de Pessoas I|60", "Matemática Financeira|80", "Sistemas de Informação Gerencial|60"],
    ["Administração Financeira I|80", "Administração de Materiais|60", "Gestão de Pessoas II|60", "Marketing I|60", "Métodos Quantitativos|60", "Pesquisa e Atividades Complementares I|60"],
    ["Administração Financeira II|80", "Administração da Produção|80", "Gestão da Qualidade|60", "Legislação Trabalhista e Tributária|60", "Marketing II|60", "Pesquisa e Atividades Complementares II|60"],
    ["Administração Pública|60", "Análise de Investimentos|60", "Empreendedorismo|40", "Logística Empresarial|60", "Mercado de Capitais|60", "Planejamento Estratégico|60"],
    ["Comércio Exterior|60", "Estágio Supervisionado I|90", "Gestão de Projetos|60", "Governança Corporativa|40", "Negociação e Liderança|60", "Orçamento Empresarial|60"],
    ["Consultoria Empresarial|60", "Estágio Supervisionado II|90", "Ética Profissional|40", "Gestão da Inovação|60", "Jogos de Empresas|60", "Trabalho de Conclusão de Curso I|90"],
    ["Business Intelligence|60", "Gestão de Serviços|60", "Sustentabilidade nos Negócios|40", "Tópicos Complementares de Administração|40", "Trabalho de Conclusão de Curso II|90"],
  ],
  "CIENCIAS CONTABEIS": [
    ["Contabilidade Geral I|80", "Desenvolvimento Pessoal e Profissional|40", "Matemática Aplicada|80", "Metodologia Científica|40", "Teoria Geral da Administração|80", "Economia|80"],
    ["Contabilidade Geral II|80", "Direito Civil e Empresarial|60", "Estatística Aplicada|80", "Matemática Financeira|80", "Responsabilidade Social e Meio Ambiente|40", "Sociologia|40"],
    ["Contabilidade de Custos|80", "Direito Tributário|60", "Direitos Humanos|40", "Estrutura das Demonstrações Contábeis|80", "Legislação Trabalhista|60", "Sistemas Contábeis Informatizados|60"],
    ["Análise das Demonstrações Contábeis|80", "Contabilidade Gerencial|80", "Contabilidade Pública|60", "Planejamento Tributário|60", "Teoria da Contabilidade|60", "Pesquisa e Atividades Complementares I|60"],
    ["Auditoria Contábil|80", "Contabilidade Societária|80", "Controladoria|60", "Perícia Contábil|60", "Contabilidade Internacional (IFRS)|60", "Pesquisa e Atividades Complementares II|60"],
    ["Administração Financeira|80", "Contabilidade Atuarial|60", "Estágio Supervisionado I|90", "Ética Profissional|40", "Mercado de Capitais|60", "Orçamento Empresarial|60"],
    ["Contabilidade Bancária|60", "Estágio Supervisionado II|90", "Gestão de Custos|60", "Governança e Compliance|40", "Trabalho de Conclusão de Curso I|90", "Tópicos Contábeis Avançados|60"],
    ["Contabilidade Ambiental|60", "Escrituração Fiscal Digital|60", "Laboratório Contábil|80", "Trabalho de Conclusão de Curso II|90"],
  ],
  "DIREITO": [
    ["Ciência Política e Teoria do Estado|60", "Desenvolvimento Pessoal e Profissional|40", "Filosofia do Direito|60", "Introdução ao Estudo do Direito|80", "Metodologia Científica|40", "Sociologia Jurídica|60"],
    ["Direito Civil I - Parte Geral|80", "Direito Constitucional I|80", "Direito Penal I|80", "Economia Política|60", "Hermenêutica Jurídica|60", "Responsabilidade Social e Meio Ambiente|40"],
    ["Direito Civil II - Obrigações|80", "Direito Constitucional II|80", "Direito Penal II|80", "Direitos Humanos|40", "Teoria Geral do Processo|60", "História do Direito|40"],
    ["Direito Administrativo I|80", "Direito Civil III - Contratos|80", "Direito Penal III|80", "Direito Processual Civil I|80", "Direito Empresarial I|60", "Psicologia Jurídica|40"],
    ["Direito Administrativo II|80", "Direito Civil IV - Coisas|80", "Direito Empresarial II|60", "Direito Penal IV|80", "Direito Processual Civil II|80", "Direito Processual Penal I|80"],
    ["Direito Civil V - Família|80", "Direito do Trabalho I|80", "Direito Processual Civil III|80", "Direito Processual Penal II|80", "Direito Tributário I|60", "Prática Jurídica I|90"],
    ["Direito Civil VI - Sucessões|60", "Direito do Consumidor|60", "Direito do Trabalho II|80", "Direito Processual do Trabalho|60", "Direito Tributário II|60", "Prática Jurídica II|90"],
    ["Direito Ambiental|60", "Direito Internacional|60", "Direito Previdenciário|60", "Prática Jurídica III|90", "Trabalho de Conclusão de Curso I|90", "Ética Profissional|40"],
    ["Direito Eleitoral|40", "Mediação e Arbitragem|60", "Prática Jurídica IV|90", "Trabalho de Conclusão de Curso II|90", "Tópicos Avançados de Direito|60"],
  ],
  "ENFERMAGEM": [
    ["Anatomia Humana|80", "Biologia Celular e Molecular|60", "Desenvolvimento Pessoal e Profissional|40", "Fundamentos de Enfermagem|80", "Histologia e Embriologia|60", "Metodologia Científica|40"],
    ["Bioquímica|60", "Fisiologia Humana|80", "Microbiologia e Imunologia|60", "Parasitologia|60", "Responsabilidade Social e Meio Ambiente|40", "Semiologia e Semiotécnica de Enfermagem|80"],
    ["Direitos Humanos|40", "Farmacologia|60", "Patologia Geral|60", "Nutrição e Dietética|40", "Saúde Coletiva I|60", "Sistematização da Assistência de Enfermagem|60"],
    ["Enfermagem em Clínica Médica|80", "Epidemiologia|60", "Ética e Legislação em Enfermagem|40", "Saúde Coletiva II|60", "Bioestatística|60", "Enfermagem em Centro Cirúrgico|60"],
    ["Enfermagem em Clínica Cirúrgica|80", "Enfermagem em Saúde da Mulher|80", "Enfermagem em Urgência e Emergência|80", "Psicologia Aplicada à Saúde|40", "Pesquisa e Atividades Complementares I|60"],
    ["Enfermagem em Saúde da Criança e do Adolescente|80", "Enfermagem em Saúde Mental|60", "Enfermagem em Terapia Intensiva|80", "Gestão em Saúde|60", "Pesquisa e Atividades Complementares II|60"],
    ["Administração em Enfermagem|60", "Enfermagem em Saúde do Idoso|60", "Estágio Supervisionado I|180", "Enfermagem do Trabalho|60", "Trabalho de Conclusão de Curso I|90"],
    ["Cuidados Paliativos|40", "Enfermagem em Doenças Transmissíveis|60", "Estágio Supervisionado II|180", "Trabalho de Conclusão de Curso II|90"],
  ],
  "PSICOLOGIA": [
    ["Anatomia e Neuroanatomia|60", "Desenvolvimento Pessoal e Profissional|40", "História da Psicologia|60", "Metodologia Científica|40", "Psicologia Geral|80", "Sociologia|40"],
    ["Filosofia|40", "Fisiologia Humana|60", "Psicologia do Desenvolvimento I|80", "Psicologia Experimental|60", "Responsabilidade Social e Meio Ambiente|40", "Teorias da Personalidade|60"],
    ["Direitos Humanos|40", "Estatística Aplicada|60", "Psicanálise I|60", "Psicologia do Desenvolvimento II|80", "Psicologia Social I|60", "Psicopatologia I|60"],
    ["Avaliação Psicológica I|80", "Behaviorismo|60", "Psicanálise II|60", "Psicologia Social II|60", "Psicopatologia II|60", "Neuropsicologia|60"],
    ["Avaliação Psicológica II|80", "Psicologia Escolar e Educacional|60", "Psicologia Organizacional e do Trabalho|60", "Terapia Cognitivo-Comportamental|60", "Psicologia Comunitária|60"],
    ["Ética Profissional|40", "Psicologia Hospitalar|60", "Psicologia Jurídica|60", "Psicoterapia Breve|60", "Técnicas de Entrevista Psicológica|60"],
    ["Estágio Básico I|120", "Psicofarmacologia|40", "Psicologia da Saúde|60", "Trabalho de Conclusão de Curso I|90", "Grupos e Instituições|60"],
    ["Estágio Básico II|120", "Práticas Integrativas em Psicologia|60", "Trabalho de Conclusão de Curso II|90", "Tópicos Avançados em Psicologia|60"],
  ],
  "PEDAGOGIA": [
    ["Desenvolvimento Pessoal e Profissional|40", "Filosofia da Educação|60", "História da Educação|60", "Metodologia Científica|40", "Psicologia da Educação|60", "Sociologia da Educação|60"],
    ["Didática|80", "Educação Inclusiva|60", "Estrutura e Funcionamento da Educação Básica|60", "Língua Portuguesa e Produção de Texto|60", "Responsabilidade Social e Meio Ambiente|40"],
    ["Alfabetização e Letramento|80", "Currículo e Avaliação|60", "Direitos Humanos|40", "Educação Infantil|60", "Literatura Infantojuvenil|40", "Políticas Públicas da Educação|60"],
    ["Fundamentos e Metodologia de Matemática|60", "Fundamentos e Metodologia de Ciências|60", "Gestão Escolar|60", "Ludicidade e Educação|40", "Tecnologias na Educação|60"],
    ["Fundamentos e Metodologia de História e Geografia|60", "Educação de Jovens e Adultos|60", "Estágio Supervisionado I|100", "Libras|40", "Psicomotricidade|40"],
    ["Coordenação Pedagógica|60", "Educação do Campo|40", "Estágio Supervisionado II|100", "Projeto Político-Pedagógico|60", "Trabalho de Conclusão de Curso I|90"],
    ["Educação Especial|60", "Estágio Supervisionado III|100", "Pesquisa em Educação|60", "Trabalho de Conclusão de Curso II|90"],
  ],
  "EDUCACAO FISICA": [
    ["Anatomia Humana|80", "Desenvolvimento Pessoal e Profissional|40", "História da Educação Física|40", "Metodologia Científica|40", "Fundamentos da Educação Física|60", "Sociologia|40"],
    ["Bioquímica|60", "Cinesiologia|60", "Fisiologia Humana|80", "Ginástica Geral|60", "Responsabilidade Social e Meio Ambiente|40", "Psicologia do Desenvolvimento|60"],
    ["Biomecânica|60", "Direitos Humanos|40", "Esportes Coletivos I|80", "Fisiologia do Exercício|80", "Aprendizagem Motora|60", "Recreação e Lazer|40"],
    ["Esportes Coletivos II|80", "Atletismo|60", "Medidas e Avaliação em Educação Física|60", "Natação|60", "Treinamento Esportivo|60", "Nutrição Aplicada|40"],
    ["Atividade Física e Saúde|60", "Esportes Individuais|60", "Ginástica Rítmica e Artística|60", "Lutas|60", "Primeiros Socorros|40", "Estágio Supervisionado I|100"],
    ["Musculação e Condicionamento Físico|80", "Educação Física Adaptada|60", "Dança|60", "Gestão do Esporte|40", "Estágio Supervisionado II|100", "Trabalho de Conclusão de Curso I|90"],
    ["Fisiologia do Envelhecimento|40", "Personal Training|60", "Prescrição de Exercícios|60", "Trabalho de Conclusão de Curso II|90"],
  ],
  "NUTRICAO": [
    ["Anatomia Humana|80", "Biologia Celular|60", "Desenvolvimento Pessoal e Profissional|40", "Fundamentos de Nutrição|60", "Metodologia Científica|40", "Química Geral|60"],
    ["Bioquímica|80", "Fisiologia Humana|80", "Microbiologia de Alimentos|60", "Nutrição Básica|80", "Responsabilidade Social e Meio Ambiente|40", "Bromatologia|60"],
    ["Avaliação Nutricional|80", "Direitos Humanos|40", "Técnica Dietética I|80", "Nutrição e Saúde Coletiva|60", "Higiene e Vigilância Sanitária|60", "Patologia|60"],
    ["Dietoterapia I|80", "Nutrição Materno-Infantil|60", "Técnica Dietética II|80", "Tecnologia de Alimentos|60", "Epidemiologia Nutricional|60"],
    ["Dietoterapia II|80", "Nutrição Esportiva|60", "Administração de Unidades de Alimentação|80", "Nutrição do Idoso|40", "Educação Alimentar e Nutricional|60"],
    ["Estágio Supervisionado I|150", "Nutrição Clínica Avançada|60", "Marketing em Alimentos|40", "Trabalho de Conclusão de Curso I|90", "Ética Profissional|40"],
    ["Estágio Supervisionado II|150", "Nutrição Funcional|60", "Trabalho de Conclusão de Curso II|90"],
  ],
  "FISIOTERAPIA": [
    ["Anatomia Humana I|80", "Biologia Celular|60", "Desenvolvimento Pessoal e Profissional|40", "Fundamentos de Fisioterapia|60", "Metodologia Científica|40", "Histologia|60"],
    ["Anatomia Humana II|80", "Bioquímica|60", "Cinesiologia|80", "Fisiologia Humana|80", "Responsabilidade Social e Meio Ambiente|40", "Patologia Geral|60"],
    ["Biomecânica|80", "Direitos Humanos|40", "Cinesioterapia|80", "Fisiologia do Exercício|60", "Recursos Terapêuticos Manuais|60", "Semiologia|60"],
    ["Eletrotermofototerapia|80", "Fisioterapia Ortopédica e Traumatológica|80", "Neuroanatomia|60", "Avaliação Cinético-Funcional|80", "Farmacologia|40"],
    ["Fisioterapia Neurofuncional|80", "Fisioterapia Cardiorrespiratória|80", "Fisioterapia em Reumatologia|60", "Órteses e Próteses|40", "Fisioterapia Desportiva|60"],
    ["Fisioterapia em Saúde da Mulher|60", "Fisioterapia em Terapia Intensiva|60", "Fisioterapia Pediátrica|60", "Fisioterapia Geriátrica|60", "Estágio Supervisionado I|150"],
    ["Estágio Supervisionado II|150", "Fisioterapia do Trabalho|60", "Ética Profissional|40", "Trabalho de Conclusão de Curso I|90"],
    ["Estágio Supervisionado III|150", "Fisioterapia Dermatofuncional|60", "Trabalho de Conclusão de Curso II|90"],
  ],
  "FARMACIA": [
    ["Anatomia Humana|80", "Biologia Celular|60", "Desenvolvimento Pessoal e Profissional|40", "Química Geral|80", "Metodologia Científica|40", "Introdução à Farmácia|40"],
    ["Bioquímica|80", "Fisiologia Humana|80", "Química Orgânica|80", "Microbiologia|60", "Responsabilidade Social e Meio Ambiente|40", "Botânica Farmacêutica|60"],
    ["Direitos Humanos|40", "Farmacognosia|80", "Físico-Química|60", "Imunologia|60", "Patologia|60", "Química Analítica|80"],
    ["Farmacologia I|80", "Farmacotécnica I|80", "Parasitologia Clínica|60", "Bromatologia|60", "Hematologia Clínica|60"],
    ["Farmacologia II|80", "Farmacotécnica II|80", "Bioquímica Clínica|80", "Controle de Qualidade de Medicamentos|60", "Toxicologia|60"],
    ["Atenção Farmacêutica|60", "Farmácia Hospitalar|60", "Tecnologia Farmacêutica|80", "Microbiologia Clínica|60", "Deontologia e Legislação Farmacêutica|40"],
    ["Estágio Supervisionado I|150", "Farmácia Clínica|60", "Cosmetologia|60", "Trabalho de Conclusão de Curso I|90", "Gestão Farmacêutica|40"],
    ["Estágio Supervisionado II|150", "Homeopatia|40", "Trabalho de Conclusão de Curso II|90"],
  ],
  "BIOMEDICINA": [
    ["Anatomia Humana|80", "Biologia Celular e Molecular|80", "Desenvolvimento Pessoal e Profissional|40", "Química Geral|60", "Metodologia Científica|40", "Histologia e Embriologia|60"],
    ["Bioquímica|80", "Fisiologia Humana|80", "Genética|60", "Microbiologia|80", "Responsabilidade Social e Meio Ambiente|40", "Biofísica|60"],
    ["Direitos Humanos|40", "Imunologia|80", "Parasitologia|80", "Patologia Geral|60", "Bioestatística|60", "Biologia Molecular Aplicada|60"],
    ["Bioquímica Clínica|80", "Hematologia Clínica|80", "Farmacologia|60", "Citologia Clínica|60", "Virologia|60"],
    ["Imunologia Clínica|80", "Microbiologia Clínica|80", "Parasitologia Clínica|60", "Biologia Molecular Diagnóstica|60", "Toxicologia|60"],
    ["Banco de Sangue|60", "Análise de Água e Alimentos|60", "Gestão de Laboratório Clínico|60", "Ética e Legislação Profissional|40", "Estágio Supervisionado I|150"],
    ["Estágio Supervisionado II|150", "Biomedicina Estética|60", "Trabalho de Conclusão de Curso I|90"],
    ["Reprodução Humana Assistida|60", "Trabalho de Conclusão de Curso II|90"],
  ],
  "SERVICO SOCIAL": [
    ["Desenvolvimento Pessoal e Profissional|40", "Fundamentos Históricos do Serviço Social|80", "Filosofia|40", "Metodologia Científica|40", "Sociologia|60", "Antropologia|40"],
    ["Ciência Política|60", "Economia Política|60", "Fundamentos Teórico-Metodológicos do Serviço Social|80", "Psicologia Social|60", "Responsabilidade Social e Meio Ambiente|40"],
    ["Direitos Humanos|40", "Política Social I|80", "Legislação Social|60", "Pesquisa em Serviço Social|60", "Serviço Social e Movimentos Sociais|60"],
    ["Política Social II|80", "Seguridade Social|60", "Serviço Social e Família|60", "Ética Profissional|40", "Planejamento em Serviço Social|60"],
    ["Estágio Supervisionado I|120", "Serviço Social na Saúde|60", "Serviço Social e Trabalho|60", "Gestão de Políticas Públicas|60"],
    ["Estágio Supervisionado II|120", "Serviço Social na Educação|60", "Terceiro Setor|40", "Trabalho de Conclusão de Curso I|90"],
    ["Estágio Supervisionado III|120", "Serviço Social Sociojurídico|60", "Trabalho de Conclusão de Curso II|90"],
  ],
  "ANALISE E DESENVOLVIMENTO DE SISTEMAS": [
    ["Algoritmos e Programação|80", "Desenvolvimento Pessoal e Profissional|40", "Fundamentos de Sistemas de Informação|60", "Matemática Aplicada|80", "Metodologia Científica|40", "Arquitetura de Computadores|60"],
    ["Banco de Dados I|80", "Engenharia de Software I|60", "Estrutura de Dados|80", "Programação Orientada a Objetos|80", "Responsabilidade Social e Meio Ambiente|40", "Sistemas Operacionais|60"],
    ["Banco de Dados II|80", "Desenvolvimento Web I|80", "Direitos Humanos|40", "Engenharia de Software II|60", "Redes de Computadores|60", "Programação para Dispositivos Móveis|80"],
    ["Desenvolvimento Web II|80", "Gestão de Projetos de TI|60", "Qualidade e Teste de Software|60", "Segurança da Informação|60", "Computação em Nuvem|60"],
    ["Business Intelligence|60", "Empreendedorismo em TI|40", "Inteligência Artificial Aplicada|60", "Projeto Integrador|80", "Trabalho de Conclusão de Curso|90"],
  ],
  "GESTAO DE RECURSOS HUMANOS": [
    ["Desenvolvimento Pessoal e Profissional|40", "Fundamentos da Administração|80", "Comportamento Organizacional|60", "Metodologia Científica|40", "Psicologia Organizacional|60", "Sociologia|40"],
    ["Legislação Trabalhista|80", "Recrutamento e Seleção|60", "Cargos, Salários e Benefícios|60", "Responsabilidade Social e Meio Ambiente|40", "Comunicação Empresarial|40"],
    ["Direitos Humanos|40", "Treinamento e Desenvolvimento|60", "Avaliação de Desempenho|60", "Rotinas Trabalhistas e Departamento Pessoal|80", "Saúde e Segurança do Trabalho|60"],
    ["Gestão por Competências|60", "Gestão Estratégica de Pessoas|60", "Negociação e Gestão de Conflitos|60", "Projeto Integrador|80", "Trabalho de Conclusão de Curso|90"],
  ],
  "LOGISTICA": [
    ["Desenvolvimento Pessoal e Profissional|40", "Fundamentos da Administração|80", "Introdução à Logística|60", "Matemática Aplicada|80", "Metodologia Científica|40", "Economia|60"],
    ["Gestão de Estoques|60", "Gestão de Compras e Suprimentos|60", "Custos Logísticos|60", "Responsabilidade Social e Meio Ambiente|40", "Transporte e Distribuição|80"],
    ["Armazenagem e Movimentação|60", "Direitos Humanos|40", "Comércio Exterior|60", "Logística Reversa|40", "Sistemas de Informação Logística|60"],
    ["Cadeia de Suprimentos|80", "Gestão da Qualidade|60", "Planejamento Logístico|60", "Projeto Integrador|80", "Trabalho de Conclusão de Curso|90"],
  ],
  "GESTAO FINANCEIRA": [
    ["Contabilidade Geral|80", "Desenvolvimento Pessoal e Profissional|40", "Fundamentos da Administração|80", "Matemática Financeira|80", "Metodologia Científica|40", "Economia|60"],
    ["Administração Financeira|80", "Análise de Custos|60", "Estatística Aplicada|60", "Responsabilidade Social e Meio Ambiente|40", "Legislação Tributária|60"],
    ["Análise das Demonstrações Financeiras|80", "Direitos Humanos|40", "Mercado de Capitais|60", "Orçamento Empresarial|60", "Análise de Investimentos|60"],
    ["Controladoria|60", "Gestão de Riscos|60", "Planejamento Financeiro|60", "Projeto Integrador|80", "Trabalho de Conclusão de Curso|90"],
  ],
  "MARKETING": [
    ["Desenvolvimento Pessoal e Profissional|40", "Fundamentos de Marketing|80", "Comportamento do Consumidor|60", "Metodologia Científica|40", "Comunicação Empresarial|40", "Economia|60"],
    ["Pesquisa de Mercado|60", "Marketing Digital|80", "Gestão de Produtos e Marcas|60", "Responsabilidade Social e Meio Ambiente|40", "Estatística Aplicada|60"],
    ["Direitos Humanos|40", "Planejamento de Marketing|80", "Marketing de Serviços|60", "Gestão de Vendas|60", "Redação Publicitária|60"],
    ["Branding|60", "Métricas e Analytics|60", "Marketing Estratégico|60", "Projeto Integrador|80", "Trabalho de Conclusão de Curso|90"],
  ],
  "ARQUITETURA E URBANISMO": [
    ["Desenho Arquitetônico|80", "Desenvolvimento Pessoal e Profissional|40", "História da Arte e Arquitetura I|60", "Matemática Aplicada|60", "Metodologia Científica|40", "Geometria Descritiva|60"],
    ["Estética e Teoria da Arquitetura|60", "História da Arte e Arquitetura II|60", "Materiais de Construção|80", "Projeto Arquitetônico I|80", "Responsabilidade Social e Meio Ambiente|40"],
    ["Conforto Ambiental I|60", "Direitos Humanos|40", "Projeto Arquitetônico II|80", "Sistemas Estruturais I|60", "Topografia|60", "Computação Gráfica Aplicada|60"],
    ["Conforto Ambiental II|60", "Instalações Prediais|60", "Paisagismo|60", "Projeto Arquitetônico III|80", "Sistemas Estruturais II|60"],
    ["Patrimônio Histórico|40", "Planejamento Urbano I|80", "Projeto Arquitetônico IV|80", "Tecnologia da Construção|60", "Legislação e Ética Profissional|40"],
    ["Planejamento Urbano II|80", "Projeto Arquitetônico V|80", "Conforto Acústico|40", "Gestão de Obras|60", "Trabalho de Conclusão de Curso I|90"],
    ["Arquitetura Sustentável|60", "Projeto Arquitetônico VI|80", "Urbanismo Contemporâneo|60", "Trabalho de Conclusão de Curso II|90"],
  ],
};

export const GRADES_REAIS: Record<string, DisciplinaGrade[][]> = Object.fromEntries(
  Object.entries(REAIS).map(([k, v]) => [k, v.map(parse)]),
);

/** Cursos que possuem grade real cadastrada (para exibição no formulário). */
export const CURSOS_COM_GRADE_REAL = Object.keys(GRADES_REAIS).sort();

/* ---------------------------------------------------------------- gerador */

type Area =
  | "engenharia" | "saude" | "gestao" | "ti" | "direito"
  | "educacao" | "humanas" | "agrarias" | "comunicacao" | "exatas";

const AREA_KEYWORDS: [Area, string[]][] = [
  ["engenharia", ["ENGENHARIA", "MECANIC", "ELETRIC", "ELETRON", "AUTOMACAO", "MECATRON", "INDUSTRIAL", "PETROLEO", "SOLDA", "METALURG", "EDIFICA", "CONSTRU", "MANUTENCAO", "REFRIGERACAO", "OPERADOR", "USINAGEM"]],
  ["saude", ["ENFERM", "MEDIC", "SAUDE", "FISIOTERAPIA", "NUTRI", "FARMAC", "ODONTO", "BIOMED", "RADIOLOG", "ESTETICA", "VETERIN", "PSICO", "FONOAUDIO", "TERAPIA", "OPTICA", "PROTESE", "SEGURANCA DO TRABALHO"]],
  ["ti", ["SISTEMAS", "INFORMATICA", "COMPUTAC", "SOFTWARE", "REDES", "DADOS", "DIGITAL", "CIBER", "INTERNET", "JOGOS", "PROGRAMA"]],
  ["direito", ["DIREITO", "JURIDIC", "SEGURANCA PUBLICA", "CRIMIN"]],
  ["educacao", ["PEDAGOG", "LICENCIATURA", "EDUCACAO", "LETRAS", "ENSINO", "MAGISTERIO"]],
  ["agrarias", ["AGRO", "AGRIC", "ZOOTEC", "FLOREST", "AMBIENT", "PESCA", "ALIMENTOS", "RURAL"]],
  ["comunicacao", ["JORNAL", "PUBLICIDADE", "MARKETING", "DESIGN", "MODA", "AUDIOVISUAL", "COMUNICA", "PRODUCAO CULTURAL", "FOTOGRAF"]],
  ["gestao", ["ADMINISTRA", "GESTAO", "CONTAB", "RECURSOS HUMANOS", "LOGISTIC", "FINANC", "COMERC", "NEGOCIO", "EMPREEND", "SECRETARIADO", "TURISMO", "HOTELARIA", "EVENTOS"]],
  ["humanas", ["HISTORIA", "GEOGRAFIA", "FILOSOFIA", "SOCIOLOG", "SERVICO SOCIAL", "ANTROPOLOG", "TEOLOG", "RELACOES"]],
  ["exatas", ["MATEMATICA", "FISICA", "QUIMICA", "ESTATISTICA", "BIOLOG", "CIENCIA"]],
];

function detectarArea(curso: string): Area {
  const c = norm(curso);
  for (const [area, keys] of AREA_KEYWORDS) {
    if (keys.some((k) => c.includes(k))) return area;
  }
  return "gestao";
}

/** Disciplinas presentes em praticamente todos os cursos superiores. */
const NUCLEO_COMUM: string[] = [
  "Desenvolvimento Pessoal e Profissional|40",
  "Metodologia Científica|40",
  "Língua Portuguesa e Produção de Texto|60",
  "Responsabilidade Social e Meio Ambiente|40",
  "Direitos Humanos|40",
  "Estatística Aplicada|60",
  "Direito e Legislação|40",
  "Sistemas de Informação|60",
  "Ética Profissional|40",
  "Empreendedorismo|40",
];

const BANCOS: Record<Area, string[]> = {
  engenharia: [
    "Matemática I|80", "Matemática II|80", "Matemática III|80", "Física I|80", "Física II|80", "Física III|80",
    "Química|80", "Álgebra Linear|40", "Desenho Técnico|80", "Mecânica Geral|80", "Resistência dos Materiais|80",
    "Materiais|80", "Fenômenos de Transporte|80", "Eletricidade Aplicada|80", "Metrologia|60", "Termodinâmica|80",
    "Processos de Fabricação|80", "Manutenção Industrial|60", "Automação e Controle|80", "Segurança do Trabalho|40",
    "Engenharia Econômica|40", "Planejamento e Controle da Produção|80", "Gestão da Qualidade|60", "Instrumentação|60",
    "Projeto Assistido por Computador (CAD)|80", "Hidráulica e Pneumática|60", "Ergonomia|40", "Sistemas Mecânicos|80",
  ],
  saude: [
    "Anatomia Humana|80", "Fisiologia Humana|80", "Bioquímica|60", "Biologia Celular|60", "Histologia|60",
    "Microbiologia|60", "Imunologia|60", "Parasitologia|60", "Patologia Geral|60", "Farmacologia|60",
    "Saúde Coletiva|60", "Epidemiologia|60", "Bioestatística|60", "Psicologia Aplicada à Saúde|40",
    "Primeiros Socorros|40", "Nutrição e Dietética|40", "Semiologia|60", "Gestão em Saúde|60",
    "Biossegurança|40", "Saúde do Trabalhador|40", "Estágio Supervisionado I|150", "Estágio Supervisionado II|150",
  ],
  gestao: [
    "Fundamentos da Administração|80", "Teoria Geral da Administração|80", "Contabilidade Geral|80", "Economia|80",
    "Matemática Financeira|80", "Matemática Aplicada|80", "Comportamento Organizacional|60", "Gestão de Pessoas|60",
    "Marketing|60", "Administração Financeira|80", "Gestão de Processos|60", "Logística|60", "Gestão da Qualidade|60",
    "Planejamento Estratégico|60", "Legislação Trabalhista e Tributária|60", "Gestão de Projetos|60",
    "Análise de Custos|60", "Negociação e Liderança|60", "Comércio Exterior|60", "Governança Corporativa|40",
  ],
  ti: [
    "Algoritmos e Programação|80", "Estrutura de Dados|80", "Programação Orientada a Objetos|80", "Banco de Dados|80",
    "Arquitetura de Computadores|60", "Sistemas Operacionais|60", "Redes de Computadores|80", "Engenharia de Software|60",
    "Desenvolvimento Web|80", "Programação para Dispositivos Móveis|80", "Segurança da Informação|60",
    "Computação em Nuvem|60", "Inteligência Artificial Aplicada|60", "Qualidade e Teste de Software|60",
    "Business Intelligence|60", "Gestão de Projetos de TI|60", "Interface e Experiência do Usuário|60",
  ],
  direito: [
    "Introdução ao Estudo do Direito|80", "Direito Constitucional|80", "Direito Civil|80", "Direito Penal|80",
    "Direito Administrativo|80", "Direito do Trabalho|80", "Direito Tributário|60", "Direito Empresarial|60",
    "Teoria Geral do Processo|60", "Direito Processual Civil|80", "Direito Processual Penal|80",
    "Filosofia do Direito|60", "Sociologia Jurídica|60", "Hermenêutica Jurídica|60", "Prática Jurídica|90",
    "Direito do Consumidor|60", "Direito Ambiental|60", "Direito Previdenciário|60",
  ],
  educacao: [
    "Filosofia da Educação|60", "História da Educação|60", "Sociologia da Educação|60", "Psicologia da Educação|60",
    "Didática|80", "Currículo e Avaliação|60", "Políticas Públicas da Educação|60", "Educação Inclusiva|60",
    "Tecnologias na Educação|60", "Gestão Escolar|60", "Libras|40", "Alfabetização e Letramento|80",
    "Literatura|60", "Estágio Supervisionado I|100", "Estágio Supervisionado II|100", "Pesquisa em Educação|60",
  ],
  humanas: [
    "Filosofia|60", "Sociologia|60", "Antropologia|60", "História Geral|60", "História do Brasil|60",
    "Ciência Política|60", "Teoria Social|60", "Metodologia de Pesquisa Social|60", "Cultura Brasileira|40",
    "Geografia Humana|60", "Psicologia Social|60", "Políticas Públicas|60", "Movimentos Sociais|60",
  ],
  agrarias: [
    "Biologia Geral|60", "Química Geral|60", "Solos|80", "Botânica|60", "Fisiologia Vegetal|60", "Zoologia|60",
    "Climatologia|40", "Irrigação e Drenagem|60", "Fitopatologia|60", "Entomologia|60", "Nutrição de Plantas|60",
    "Mecanização Agrícola|60", "Gestão do Agronegócio|60", "Manejo Ambiental|60", "Tecnologia de Alimentos|60",
    "Extensão Rural|40", "Topografia|60",
  ],
  comunicacao: [
    "Teoria da Comunicação|60", "História da Arte|60", "Redação Publicitária|60", "Fotografia|60",
    "Design Gráfico|80", "Produção Audiovisual|80", "Marketing Digital|80", "Comportamento do Consumidor|60",
    "Planejamento de Campanhas|60", "Mídias Sociais|60", "Semiótica|40", "Direção de Arte|60",
    "Projeto Experimental|80", "Comunicação Integrada|60",
  ],
  exatas: [
    "Cálculo Diferencial e Integral I|80", "Cálculo Diferencial e Integral II|80", "Álgebra Linear|60",
    "Geometria Analítica|60", "Física Geral I|80", "Física Geral II|80", "Química Geral|80",
    "Probabilidade e Estatística|60", "Análise Matemática|60", "Métodos Numéricos|60", "Cálculo Numérico|60",
    "Laboratório de Física|40", "Biologia Geral|60", "Modelagem Matemática|60",
  ],
};

/** Ajusta as últimas disciplinas do curso (TCC/estágio) de acordo com a duração. */
function fechamento(semestres: number): string[][] {
  if (semestres >= 8) {
    return [
      ["Estágio Supervisionado I|90", "Trabalho de Conclusão de Curso I|90"],
      ["Estágio Supervisionado II|90", "Trabalho de Conclusão de Curso II|90"],
    ];
  }
  return [["Projeto Integrador|80"], ["Trabalho de Conclusão de Curso|90"]];
}

/**
 * Monta uma grade coerente para qualquer curso do catálogo.
 * Determinística: o mesmo curso sempre gera a mesma grade.
 */
export function gerarGrade(curso: string, semestres = 8): DisciplinaGrade[][] {
  const chave = norm(curso);
  const real = GRADES_REAIS[chave];
  if (real) return real.slice(0, Math.max(semestres, real.length));

  const area = detectarArea(curso);
  const banco = [...BANCOS[area]];
  const comum = [...NUCLEO_COMUM];
  const especificas = banco.map((d) => {
    const [nome, ch] = d.split("|");
    return `${nome}|${ch}`;
  });

  // Disciplinas próprias do curso (nome do curso vira eixo temático)
  const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o"]);
  const eixo = curso
    .replace(/^(TECNOLOGIA EM|GESTÃO EM|CURSO SUPERIOR DE TECNOLOGIA EM)\s+/i, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1),
    )
    .join(" ");
  const proprias = [
    `Fundamentos de ${eixo}|60`,
    `Introdução a ${eixo}|60`,
    `Tópicos Especiais em ${eixo}|60`,
    `Práticas de ${eixo}|80`,
    `Laboratório de ${eixo}|60`,
    `Gestão Aplicada a ${eixo}|60`,
  ];

  const fim = fechamento(semestres);
  const uteis = semestres - fim.length;
  const grade: string[][] = [];

  let ic = 0;
  let ie = 0;
  let ip = 0;

  for (let s = 0; s < uteis; s++) {
    const linhas: string[] = [];
    // 2 do núcleo comum nos primeiros semestres, 1 depois
    const qtdComum = s < 3 ? 2 : 1;
    for (let i = 0; i < qtdComum && ic < comum.length; i++) linhas.push(comum[ic++]);
    // 1 disciplina "própria" do curso a cada dois semestres
    if (s % 2 === 0 && ip < proprias.length) linhas.push(proprias[ip++]);
    // completa com o banco temático da área (6 linhas por semestre)
    while (linhas.length < 6) {
      if (ie >= especificas.length) ie = 0;
      const item = especificas[ie++];
      if (!linhas.includes(item)) linhas.push(item);
      else break;
    }
    grade.push(linhas);
  }

  for (const f of fim) {
    const extra: string[] = [...f];
    while (extra.length < 4) {
      if (ie >= especificas.length) ie = 0;
      const item = especificas[ie++];
      if (!extra.includes(item)) extra.push(item);
      else break;
    }
    grade.push(extra);
  }

  return grade.map(parse);
}

/* ------------------------------------------------------------------ notas */

export interface LinhaHistorico {
  ano: string;
  serie: string;
  disciplina: string;
  ch: string;
  freq: string;
  media: string;
  situacao: string;
}

const NOTAS = ["6,00", "6,50", "7,00", "7,50", "8,00", "8,50", "9,00", "9,50", "10,00"];
const FREQS = ["85", "90", "95", "96", "97", "98", "100", "100", "100"];

/** Disciplinas que aparecem como "Suficiente" (sem nota) no histórico real. */
const SEM_NOTA = /(PESQUISA E ATIVIDADES|ESTAGIO SUPERVISIONADO|ATIVIDADES COMPLEMENTARES)/;

/**
 * Converte a grade em linhas do histórico, distribuindo anos letivos
 * (2 semestres por ano) e gerando notas/frequências realistas.
 */
export function montarLinhas(
  grade: DisciplinaGrade[][],
  anoInicial: number,
  comNotas = true,
): LinhaHistorico[][] {
  let seed = anoInicial * 7919;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  return grade.map((semestre, i) => {
    const ano = String(anoInicial + Math.floor(i / 2));
    const serie = `${i + 1}ª/${(i % 2) + 1}º Sem`;
    return semestre.map((d) => {
      const suficiente = SEM_NOTA.test(norm(d.nome));
      return {
        ano,
        serie,
        disciplina: d.nome,
        ch: String(d.ch),
        freq: comNotas ? FREQS[Math.floor(rnd() * FREQS.length)] : "",
        media: comNotas ? (suficiente ? "--" : NOTAS[Math.floor(rnd() * NOTAS.length)]) : "",
        situacao: comNotas ? (suficiente ? "Suficiente" : "Aprovado") : "",
      };
    });
  });
}

/** Carga horária total do curso. */
export function cargaHorariaTotal(grade: DisciplinaGrade[][]): number {
  return grade.reduce((acc, s) => acc + s.reduce((a, d) => a + d.ch, 0), 0);
}
