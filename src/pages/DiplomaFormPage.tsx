import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, University, Loader2, FlaskConical, Trash2, User, FileSignature, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { loadDiplomaFieldPositions } from "@/lib/diploma-align";
import {
  MODALIDADES,
  type Modalidade,
  cursosPorModalidade,
  nomeCursoCompleto,
  tituloConferido,
  TOTAL_CURSOS,
} from "@/lib/diploma-cursos";
import templateP1Url from "@/assets/template-diploma-p1-hq.jpg";
import templateP2Url from "@/assets/template-diploma-p2-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskDigits, maskCPF } from "@/lib/masks";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface DiplomaForm {
  instituicao: string;
  instituicaoL1: string;
  instituicaoL2: string;
  mantenedora: string;
  cnpj: string;
  credenciamento: string;
  recredenciamento: string;
  recredenciamentoUniversidade: string;
  reconhecimento: string;
  renovacao: string;
  modalidade: Modalidade;
  curso: string;
  aluno: string;
  cpf: string;
  sexo: string;
  nacionalidade: string;
  naturalidade: string;
  nascimento: string;
  identidade: string;
  orgaoExpedidor: string;
  dataConclusao: string;
  dataColacao: string;
  cidadeExpedicao: string;
  diaExpedicao: string;
  mesExpedicao: string;
  anoExpedicao: string;
  reitor: string;
  secretario: string;
  resolucaoNumero: string;
  resolucaoAno: string;
  registroNumero: string;
  registroLivro: string;
  registroFolha: string;
  registroData: string;
  processo: string;
  registroCidade: string;
  serial: string;
  codigoValidacao: string;
}

const initial: DiplomaForm = {
  instituicao: "CENTRO UNIVERSITÁRIO ESTÁCIO DO CEARÁ",
  instituicaoL1: "CENTRO UNIVERSITÁRIO",
  instituicaoL2: "ESTÁCIO DO CEARÁ",
  mantenedora: "SOCIEDADE DE ENSINO SUPERIOR, MÉDIO E FUNDAMENTAL LTDA",
  cnpj: "02608755000107",
  credenciamento: "Credenciamento: Portaria nº 1097, de 31/8/2012, DOU nº 172, Seção 1, Pág. 97, de 4/9/2012.",
  recredenciamento: "Recredenciamento: Portaria nº 684, de 16/7/2018, DOU nº 136, Seção 1, Pág. 12, de 17/7/2018.",
  recredenciamentoUniversidade:
    "Recredenciamento: Portaria nº 1095, de 31/8/2012, DOU nº 172, Seção 1, Pág. 97, de 4/9/2012.",
  reconhecimento: "Reconhecimento: Portaria MEC n° 13, de 02/03/2012, DOU n° 45,\nSeção 1, Pág. 55, de 06/03/2012.",
  renovacao: "Renovação: Portaria MEC n° 948, de 30/08/2021, DOU n° 165,\nSeção 1, Pág. 36, de 31/08/2021.",
  modalidade: "tecnologo",
  curso: "DESIGN DE MODA",
  aluno: "",
  cpf: "",
  sexo: "M",
  nacionalidade: "BRASILEIRO(A)",
  naturalidade: "CEARÁ",
  nascimento: "",
  identidade: "",
  orgaoExpedidor: "SSPDS/CE",
  dataConclusao: "",
  dataColacao: "",
  cidadeExpedicao: "Fortaleza - CE",
  diaExpedicao: "14",
  mesExpedicao: "Junho",
  anoExpedicao: "2023",
  reitor: "JOSUÉ VIANA DE OLIVEIRA NETO",
  secretario: "ADRIANA SILVA ARAUJO",
  resolucaoNumero: "092/GR",
  resolucaoAno: "2016",
  registroNumero: "11897",
  registroLivro: "1",
  registroFolha: "2084",
  registroData: "14/06/2023",
  processo: "SRD/6351166-IP/2023",
  registroCidade: "Rio de Janeiro - RJ",
  serial: "6070002386077",
  codigoValidacao: "",
};

function rnd(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Divide o nome da instituição em duas linhas de cabeçalho automaticamente. */
function splitInstituicao(nome: string): { l1: string; l2: string } {
  const limpo = nome.trim().replace(/\s+/g, " ").toUpperCase();
  const marca = limpo.indexOf("ESTÁCIO");
  if (marca > 0) {
    return { l1: limpo.slice(0, marca).trim(), l2: limpo.slice(marca).trim() };
  }
  const palavras = limpo.split(" ");
  if (palavras.length < 2) return { l1: limpo, l2: "" };
  const meio = Math.ceil(palavras.length / 2);
  return { l1: palavras.slice(0, meio).join(" "), l2: palavras.slice(meio).join(" ") };
}

interface InstituicaoPreset {
  nome: string;
  mantenedora: string;
  cnpj: string;
  reitor: string;
  cidade: string;
}

/** Unidades disponíveis — ao selecionar, cabeçalho/mantenedora/CNPJ/reitor são preenchidos sozinhos. */
const MANTENEDORA_PADRAO = "SOCIEDADE DE ENSINO SUPERIOR, MÉDIO E FUNDAMENTAL LTDA";
const CNPJ_PADRAO = "02608755000107";
const REITOR_PADRAO = "JOSUÉ VIANA DE OLIVEIRA NETO";

/** [nome da unidade, capital, UF] — cobre os 27 estados/DF. */
const UNIDADES_UF: [string, string, string][] = [
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO ACRE", "Rio Branco", "AC"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE ALAGOAS", "Maceió", "AL"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO AMAPÁ", "Macapá", "AP"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO AMAZONAS", "Manaus", "AM"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DA BAHIA", "Salvador", "BA"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO CEARÁ", "Fortaleza", "CE"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE BRASÍLIA", "Brasília", "DF"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO ESPÍRITO SANTO", "Vitória", "ES"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE GOIÁS", "Goiânia", "GO"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO MARANHÃO", "São Luís", "MA"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE MATO GROSSO", "Cuiabá", "MT"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE MATO GROSSO DO SUL", "Campo Grande", "MS"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE MINAS GERAIS", "Belo Horizonte", "MG"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO PARÁ", "Belém", "PA"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DA PARAÍBA", "João Pessoa", "PB"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO PARANÁ", "Curitiba", "PR"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE PERNAMBUCO", "Recife", "PE"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO PIAUÍ", "Teresina", "PI"],
  ["UNIVERSIDADE ESTÁCIO DE SÁ", "Rio de Janeiro", "RJ"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO RIO GRANDE DO NORTE", "Natal", "RN"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO RIO GRANDE DO SUL", "Porto Alegre", "RS"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE RONDÔNIA", "Porto Velho", "RO"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE RORAIMA", "Boa Vista", "RR"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE SANTA CATARINA", "Florianópolis", "SC"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE SÃO PAULO", "São Paulo", "SP"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DE SERGIPE", "Aracaju", "SE"],
  ["CENTRO UNIVERSITÁRIO ESTÁCIO DO TOCANTINS", "Palmas", "TO"],
];

const INSTITUICOES: InstituicaoPreset[] = UNIDADES_UF.map(([nome, capital, uf]) => ({
  nome,
  mantenedora:
    uf === "RJ" ? "SOCIEDADE DE ENSINO SUPERIOR ESTÁCIO DE SÁ LTDA" : MANTENEDORA_PADRAO,
  cnpj: uf === "RJ" ? "34075739000148" : CNPJ_PADRAO,
  reitor: REITOR_PADRAO,
  cidade: `${capital} - ${uf}`,
}));



const NOMES = [
  "GUSTAVO AUGUSTO RODRIGUES DA SILVA",
  "MARIANA COSTA DE ALMEIDA",
  "RAFAEL PEREIRA DOS SANTOS",
  "JULIANA MENDES BARBOSA",
];

export default function DiplomaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<DiplomaForm>(initial);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [cursoOpen, setCursoOpen] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(editState?.editDocId);
  const cursos = cursosPorModalidade(form.modalidade);

  useEffect(() => {
    if (hydrated || !editState?.editDocId) return;
    let cancelled = false;
    (async () => {
      const docId = editState.editDocId!;
      const raw = getDocument(docId)?.additionalInfo || (await loadDocumentInfo(docId));
      if (cancelled || !raw) return;
      try {
        const b = JSON.parse(raw) as Record<string, string>;
        if (b.__form) {
          setForm({ ...initial, ...(JSON.parse(b.__form) as DiplomaForm) });
          setHydrated(true);
        }
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const imgToBase64 = (url: string) => loadTemplateBase64(url);

  const set = (field: keyof DiplomaForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof DiplomaForm, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  /** Seleção da instituição → preenche cabeçalho, mantenedora, CNPJ e reitor automaticamente. */
  const selectInstituicao = (nome: string) => {
    const preset = INSTITUICOES.find((i) => i.nome === nome);
    const { l1, l2 } = splitInstituicao(nome);
    setForm((p) => ({
      ...p,
      instituicao: nome,
      instituicaoL1: l1,
      instituicaoL2: l2,
      mantenedora: preset?.mantenedora ?? p.mantenedora,
      cnpj: preset?.cnpj ?? p.cnpj,
      reitor: preset?.reitor ?? p.reitor,
      cidadeExpedicao: preset?.cidade ?? p.cidadeExpedicao,
    }));
  };

  /** Números internos (livro, folha e nº de série) são gerados sozinhos. */
  useEffect(() => {
    if (isEditMode) return;
    setForm((p) => ({
      ...p,
      registroLivro: "1",
      registroFolha: rnd(4),
      serial: rnd(13),
      codigoValidacao: "",
    }));
  }, [isEditMode]);


  const fillTest = () => {
    const ano = 2015 + Math.floor(Math.random() * 8);
    setForm((p) => ({
      ...p,
      aluno: pick(NOMES),
      nascimento: `${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}/${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}/19${Math.floor(Math.random() * 30) + 70}`,
      identidade: rnd(13),
      dataConclusao: `10/07/${ano}`,
      dataColacao: `31/08/${ano}`,
      registroNumero: rnd(5),
      registroFolha: rnd(4),
      serial: rnd(13),
      curso: pick(cursosPorModalidade(p.modalidade)),
    }));
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm({ ...initial, aluno: "", nascimento: "", identidade: "", dataConclusao: "", dataColacao: "" });
    toast({ title: "Formulário limpo!" });
  };

  const buildBody = async () => {
    const [template_p1_base64, template_p2_base64] = await Promise.all([
      imgToBase64(templateP1Url),
      imgToBase64(templateP2Url),
    ]);

    return {
      instituicao: form.instituicao,
      instituicao_l1: form.instituicaoL1,
      instituicao_l2: form.instituicaoL2,
      curso: form.curso,
      curso_completo: nomeCursoCompleto(form.modalidade, form.curso),
      titulo: tituloConferido(form.modalidade),
      aluno: form.aluno,
      nacionalidade: form.nacionalidade,
      naturalidade: form.naturalidade,
      nascimento: form.nascimento,
      identidade: form.identidade,
      orgao_expedidor: form.orgaoExpedidor,
      data_conclusao: form.dataConclusao,
      data_colacao: form.dataColacao,
      cidade_data: `${form.cidadeExpedicao}, ${form.diaExpedicao} de ${form.mesExpedicao} de ${form.anoExpedicao}.`,
      reitor: form.reitor,
      secretario: form.secretario,
      resolucao: `Resolução ${form.resolucaoNumero}/${form.resolucaoAno}`,
      mantenedora: form.mantenedora,
      cnpj: form.cnpj,
      credenciamento: form.credenciamento,
      recredenciamento: form.recredenciamento,
      recredenciamento_universidade: form.recredenciamentoUniversidade,
      reconhecimento: form.reconhecimento,
      renovacao: form.renovacao,
      registro_texto:
        `Diploma registrado sob o n° ${form.registroNumero}, Livro ${form.registroLivro}, fls ${form.registroFolha}, em ${form.registroData}, por delegação de competência do Ministério da Educação, nos termos da Lei nº 9.394 de 20 de dezembro de 1996, e do Decreto nº 9.235, de 15 de dezembro de 2017.`,
      processo: `Processo n° ${form.processo}.`,
      registro_cidade_data: `${form.registroCidade}, ${form.registroData}`,
      serial: form.serial,
      // ---- campos crus p/ o portal de validação ----
      cpf: form.cpf,
      sexo: form.sexo,
      modalidade: form.modalidade,
      cidade_expedicao: form.cidadeExpedicao,
      registro_numero: form.registroNumero,
      registro_livro: form.registroLivro,
      registro_folha: form.registroFolha,
      registro_data: form.registroData,
      registro_cidade: form.registroCidade,
      processo_numero: form.processo,
      ...(form.codigoValidacao ? { codigo_validacao: form.codigoValidacao } : {}),
      field_positions: loadDiplomaFieldPositions() ?? undefined,
      template_p1_base64,
      template_p2_base64,
      __form: JSON.stringify(form),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const bodyData = await buildBody();
      const { data, error } = await supabase.functions.invoke("generate-diploma-pdf", { body: bodyData });
      if (error) throw error;

      const pdfResult = data?.pdfBase64;
      if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");

      if (isEditMode && editState?.editDocId) {
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`,
        });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } else {
        navigate("/dashboard/documents/diploma/preview", {
          state: {
            pdfBase64: pdfResult,
            formData: bodyData,
            codigoValidacao: data?.codigo_validacao,
            documentoId: data?.documento_id,
            validationUrl: data?.validation_url,
          },
        });
      }
    } catch (err) {
      console.error("Erro ao gerar PDF do Diploma:", err);
      toast({
        title: isEditMode ? "Erro ao atualizar documento" : "Erro ao gerar PDF",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";

  const FieldLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-sm font-semibold text-primary">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="mb-2 flex items-center gap-3 border-b border-border/50 pb-2">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard/documents")} className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/10">
            <FlaskConical className="h-3.5 w-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </Button>
        </div>
      </div>

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Diploma de Ensino Superior</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CURSO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={GraduationCap} title="Curso e Titulação" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Modalidade</FieldLabel>
              <Select
                value={form.modalidade}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, modalidade: v as Modalidade, curso: cursosPorModalidade(v as Modalidade)[0] }))
                }
              >
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Título conferido</FieldLabel>
              <Input value={tituloConferido(form.modalidade)} readOnly className={`${inputCls} opacity-70`} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Curso</FieldLabel>
            <Popover open={cursoOpen} onOpenChange={setCursoOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className={`w-full justify-between ${inputCls}`}>
                  <span className="truncate">{form.curso || "Selecione o curso"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar curso..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>Nenhum curso encontrado.</CommandEmpty>
                    <CommandGroup>
                      {cursos.map((c) => (
                        <CommandItem
                          key={c}
                          value={c}
                          onSelect={() => { setForm((p) => ({ ...p, curso: c })); setCursoOpen(false); }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${form.curso === c ? "opacity-100" : "opacity-0"}`} />
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              {cursos.length} cursos nesta modalidade · {TOTAL_CURSOS} no catálogo. Texto no diploma:{" "}
              <span className="text-foreground">{nomeCursoCompleto(form.modalidade, form.curso)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Data de conclusão</FieldLabel>
              <Input value={form.dataConclusao} onChange={setMask("dataConclusao", maskDate)} inputMode="numeric" placeholder="10/07/2015" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data da colação de grau</FieldLabel>
              <Input value={form.dataColacao} onChange={setMask("dataColacao", maskDate)} inputMode="numeric" placeholder="31/08/2015" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do Diplomado" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.aluno} onChange={set("aluno")} placeholder="GUSTAVO AUGUSTO RODRIGUES DA SILVA" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>CPF (portal de validação)</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="123.456.789-00" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Sexo</FieldLabel>
              <Select value={form.sexo} onValueChange={(v) => setForm((p) => ({ ...p, sexo: v }))}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Nacionalidade</FieldLabel>
              <Input value={form.nacionalidade} onChange={set("nacionalidade")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Natural de</FieldLabel>
              <Input value={form.naturalidade} onChange={set("naturalidade")} placeholder="CEARÁ" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Nascimento</FieldLabel>
              <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="31/10/1992" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Identidade</FieldLabel>
              <Input value={form.identidade} onChange={setMask("identidade", maskDigits(15))} inputMode="numeric" placeholder="2009010328577" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Órgão expedidor</FieldLabel>
              <Input value={form.orgaoExpedidor} onChange={set("orgaoExpedidor")} placeholder="SSPDS/CE" className={inputCls} />
            </div>
          </div>
        </div>

        {/* INSTITUIÇÃO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={University} title="Instituição" />

          <div className="space-y-1.5">
            <FieldLabel>Instituição</FieldLabel>
            <Select value={form.instituicao} onValueChange={selectInstituicao}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                {INSTITUICOES.map((i) => <SelectItem key={i.nome} value={i.nome}>{i.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cabeçalho, mantenedora, CNPJ, reitor e portarias de credenciamento/reconhecimento são preenchidos automaticamente.
            </p>
          </div>

        </div>

        {/* EXPEDIÇÃO E REGISTRO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={FileSignature} title="Expedição e Registro" />

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel>Cidade de expedição</FieldLabel>
              <Input value={form.cidadeExpedicao} onChange={set("cidadeExpedicao")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Dia</FieldLabel>
              <Input value={form.diaExpedicao} onChange={set("diaExpedicao")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ano</FieldLabel>
              <Input value={form.anoExpedicao} onChange={set("anoExpedicao")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Mês de expedição</FieldLabel>
            <Select value={form.mesExpedicao} onValueChange={(v) => setForm((p) => ({ ...p, mesExpedicao: v }))}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Secretário(a) de Registro</FieldLabel>
            <Input value={form.secretario} onChange={set("secretario")} className={inputCls} />
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Nº registro</FieldLabel>
              <Input value={form.registroNumero} onChange={set("registroNumero")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data do registro</FieldLabel>
              <Input value={form.registroData} onChange={setMask("registroData", maskDate)} inputMode="numeric" placeholder="14/06/2023" className={inputCls} />
            </div>
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Processo</FieldLabel>
              <Input value={form.processo} onChange={set("processo")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Cidade do registro</FieldLabel>
              <Input value={form.registroCidade} onChange={set("registroCidade")} className={inputCls} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Reitor(a), resolução, livro, folha, nº de série e código de validação são gerados automaticamente.
          </p>

        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
          ) : isEditMode ? (
            "Salvar alterações"
          ) : (
            "Gerar Preview"
          )}
        </Button>
      </form>
    </div>
  );
}
