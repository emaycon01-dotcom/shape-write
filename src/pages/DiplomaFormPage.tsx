import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import CidadeUfPicker from "@/components/CidadeUfPicker";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap, University, Loader2, FlaskConical, Trash2, User, FileSignature, Check, ChevronsUpDown,
  ArrowLeft, Sparkles, ShieldCheck, Eye, CreditCard, FileText, RefreshCw,
} from "lucide-react";
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
import { loadTemplateBase64, loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskDigits, maskCPF } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { pick, rnd } from "@/lib/random";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface DiplomaForm {
  instituicaoModo: "auto" | "manual";
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

/** Assinante fixo — mesmo em todos os diplomas deste modelo, não editável pelo usuário. */
const DIPLOMA_SECRETARIO = "ADRIANA SILVA ARAUJO";

const initial: DiplomaForm = {
  instituicaoModo: "auto",
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
  secretario: DIPLOMA_SECRETARIO,
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

/** "Fortaleza - CE" -> { cidade, uf } */
const splitCidadeUf = (valor: string): { cidade: string; uf: string } => {
  const m = (valor || "").match(/^(.*?)\s*-\s*([A-Za-z]{2})$/);
  return m ? { cidade: m[1].trim(), uf: m[2].toUpperCase() } : { cidade: valor || "", uf: "RJ" };
};
const juntaCidadeUf = (cidade: string, uf: string) => `${cidade} - ${uf}`;

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

const ROUTE_KEY = "/dashboard/documents/diploma";

export default function DiplomaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<DiplomaForm>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [cursoOpen, setCursoOpen] = useState(false);

  const { user, deductCredit } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(editState?.editDocId);
  const cost = planCost(1, user?.plano);
  const cursos = cursosPorModalidade(form.modalidade);

  /* ---------------- estado do preview ao vivo ---------------- */
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoLive, setAutoLive] = useState(true);
  const previewSeq = useRef(0);
  const generatedSignature = useRef<string | null>(null);

  /* ---------------- estado do documento final ---------------- */
  const [finalPdf, setFinalPdf] = useState<string | null>(() => readFinalPdf(ROUTE_KEY));
  const [showReady, setShowReady] = useState(false);
  const [generating, setGenerating] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const [template_p1_base64, template_p2_base64] = await Promise.all([
      loadTemplateObjectUrl(templateP1Url),
      loadTemplateObjectUrl(templateP2Url),
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
      secretario: DIPLOMA_SECRETARIO,
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
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.aluno.trim().length > 2 &&
    form.nascimento.length === 10 &&
    form.dataConclusao.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-diploma-pdf", {
        body: { ...body, preview: true },
      });
      if (seq !== previewSeq.current) return;
      if (error) throw error;
      const result = data?.pdfBase64;
      if (!result) throw new Error(data?.error || "Nenhum PDF retornado");
      // Nova prévia = documento novo: descarta o PDF final anterior
      // (senão o preview seguinte apareceria sem marca d'água).
      setFinalPdf(null);
      clearFinalPdf(ROUTE_KEY);
      setPreviewPdf(result.startsWith("data:") ? result : `data:application/pdf;base64,${result}`);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setPreviewError(describeError(e));
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }, [buildBody]);

  useEffect(() => {
    if (!autoLive || generating || showReady) return;
    if (generatedSignature.current === signature) return;
    const id = window.setTimeout(() => { void runPreview(); }, 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, autoLive, canPreview, generating, showReady]);

  /** Registra o diploma no portal de validação (QR Code) — best effort, não bloqueia a entrega. */
  const registrarNoPortal = useCallback(async (body: Record<string, unknown>, pdfFinal: string, documentoId?: string) => {
    try {
      const { template_p1_base64, template_p2_base64, field_positions, __form, ...form2 } = body;
      void template_p1_base64; void template_p2_base64; void field_positions; void __form;

      const { data, error } = await invokeGeneratePdf("generate-diploma-pdf", {
        body: {
          action: "register_portal",
          documento_id: documentoId,
          form: form2,
          pdf_base64: pdfFinal,
          pdf_preview_base64: undefined,
        },
      });
      if (error || !data?.success) {
        console.warn("Falha ao registrar no portal de validação:", error || data?.error);
      }
    } catch (e) {
      console.warn("Erro ao registrar no portal de validação:", e);
    }
  }, []);

  /* ---------------- documento final ---------------- */
  const handleGenerate = async () => {
    if (!user) return;

    if (isEditMode && editState?.editDocId) {
      setGenerating(true);
      try {
        const body = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-diploma-pdf", { body: { ...body, preview: false } });
        if (error) throw error;
        const generated = data?.pdfBase64;
        if (!generated) throw new Error("pdf_nao_gerado");
        const pdfFinal = generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`;
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(body),
          pdfDataUrl: pdfFinal,
        });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } catch (e) {
        toast({ title: "Erro ao atualizar documento", description: describeError(e), variant: "destructive" });
      } finally {
        setGenerating(false);
      }
      return;
    }

    if ((user.credits ?? 0) < cost) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de ${formatCredits(cost)} crédito(s) para gerar o documento.`,
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    saveFormDraft("diploma", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-diploma-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error(data?.error || "pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-diploma", creditRef("geracao-diploma", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.aluno || "",
        identification: form.identidade || "",
        date: form.dataColacao || "",
        description: `Diploma - ${form.curso || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "diploma",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      // Registra o diploma no portal de validação (QR Code) — best effort.
      void registrarNoPortal(body, pdfFinal, data?.documento_id);

      generatedSignature.current = signature;
      setShowReady(true);

      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });
    } catch (e) {
      console.error("Erro ao gerar PDF do Diploma:", e);
      toast({
        title: "Erro ao gerar documento",
        description: `Nenhum crédito foi descontado. ${describeError(e)}`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const codigo = form.codigoValidacao || "";
  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Aqui está o seu Diploma:\n\nCurso: ${nomeCursoCompleto(form.modalidade, form.curso)}\nTítulo: ${tituloConferido(form.modalidade)}\nCódigo de Validação: ${codigo}`;

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

  /* ---------------- painel de preview (reutilizado em 2 posições) ---------------- */
  const previewPanel = (
    <div className="glass flex h-full flex-col overflow-hidden p-0 rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Prévia do documento</span>
          {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoLive((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
              autoLive
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border bg-secondary text-muted-foreground"
            }`}
          >
            {autoLive ? "Ao vivo" : "Manual"}
          </button>
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={!canPreview || previewing}
            className="rounded-full border border-border bg-secondary p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            aria-label="Atualizar prévia"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${previewing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-b-2xl bg-secondary/30">
        {previewPdf ? (
          <>
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Diploma" />
            {!finalPdf && (
              <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsl(var(--destructive) / 0.05) 80px, hsl(var(--destructive) / 0.05) 82px)",
                  }}
                />
                {Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute whitespace-nowrap text-[17px] font-bold text-destructive/20"
                    style={{
                      transform: "rotate(-35deg)",
                      top: `${10 + (i % 4) * 25}%`,
                      left: `${-10 + Math.floor(i / 4) * 40}%`,
                      letterSpacing: "2px",
                    }}
                  >
                    MonkeyLab MonkeyLab
                  </span>
                ))}
              </div>
            )}
            {previewing && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
                <div className="h-full w-full animate-pulse bg-primary/70" />
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/20">
              {previewing ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <FileText className="h-6 w-6 text-primary" />}
            </span>
            <p className="text-sm font-semibold text-foreground">
              {previewing ? "Montando a prévia..." : "A prévia aparece aqui"}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {previewError
                ? previewError
                : "Preencha nome do aluno, nascimento e data de conclusão — a prévia atualiza sozinha enquanto você digita."}
            </p>
          </div>
        )}
      </div>

      <p className="border-t border-border/50 px-5 py-2.5 text-center text-[11px] text-muted-foreground">
        A marca d'água sai apenas no PDF final gerado.
      </p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-28 xl:pb-8">
      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              onClick={() => navigate("/dashboard/documents")}
              className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Serviços
            </button>
            <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Diploma de Ensino Superior</h1>
            <p className="text-xs text-muted-foreground">Editor com prévia ao vivo · sem trocar de tela</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> Prévia em tempo real
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                <ShieldCheck className="h-3 w-3" /> Crédito só na geração final
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/10">
              <FlaskConical className="h-3.5 w-3.5" /> Teste
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }} className="space-y-6">

          <FormDraftsPanel docType="diploma" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* CURSO */}
          <div className="glass space-y-4 p-6">
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
          <div className="glass space-y-4 p-6">
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
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={University} title="Instituição" />

            <div className="space-y-1.5">
              <FieldLabel>Nome da instituição</FieldLabel>
              <Select
                value={form.instituicaoModo}
                onValueChange={(v) => setForm((p) => ({ ...p, instituicaoModo: v as "auto" | "manual" }))}
              >
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (lista de unidades)</SelectItem>
                  <SelectItem value="manual">Manual (digitar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.instituicaoModo === "auto" ? (
              <div className="space-y-1.5">
                <FieldLabel>Instituição</FieldLabel>
                <Select value={form.instituicao} onValueChange={selectInstituicao}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSTITUICOES.map((i) => <SelectItem key={i.nome} value={i.nome}>{i.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Cabeçalho, mantenedora, CNPJ, reitor, secretário e portarias de credenciamento/reconhecimento são preenchidos automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <FieldLabel required>Instituição (manual)</FieldLabel>
                  <Input
                    value={form.instituicao}
                    onChange={(e) => {
                      const nome = e.target.value;
                      const { l1, l2 } = splitInstituicao(nome);
                      setForm((p) => ({ ...p, instituicao: nome, instituicaoL1: l1, instituicaoL2: l2 }));
                    }}
                    placeholder="CENTRO UNIVERSITÁRIO ESTÁCIO DO CEARÁ"
                    className={inputCls}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel>Linha 1 do cabeçalho</FieldLabel>
                    <Input value={form.instituicaoL1} onChange={set("instituicaoL1")} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Linha 2 do cabeçalho</FieldLabel>
                    <Input value={form.instituicaoL2} onChange={set("instituicaoL2")} className={inputCls} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  No modo manual, mantenedora, CNPJ e reitor continuam com os últimos valores selecionados.
                </p>
              </div>
            )}


          </div>

          {/* EXPEDIÇÃO E REGISTRO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={FileSignature} title="Expedição e Registro" />

            <CidadeUfPicker
              uf={splitCidadeUf(form.cidadeExpedicao).uf}
              cidade={splitCidadeUf(form.cidadeExpedicao).cidade}
              labelUf="UF de expedição"
              labelCidade="Cidade de expedição"
              onChange={({ uf, cidade }) =>
                setForm((p) => ({ ...p, cidadeExpedicao: juntaCidadeUf(cidade, uf) }))
              }
            />

            <div className="grid grid-cols-4 gap-3">
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


            <div className="space-y-1.5">
              <FieldLabel>Processo</FieldLabel>
              <Input value={form.processo} onChange={set("processo")} className={inputCls} />
            </div>

            <CidadeUfPicker
              uf={splitCidadeUf(form.registroCidade).uf}
              cidade={splitCidadeUf(form.registroCidade).cidade}
              labelUf="UF do registro"
              labelCidade="Cidade do registro"
              onChange={({ uf, cidade }) =>
                setForm((p) => ({ ...p, registroCidade: juntaCidadeUf(cidade, uf) }))
              }
            />

            <p className="text-xs text-muted-foreground">
              Reitor(a), resolução, livro, folha, nº de série e código de validação são gerados automaticamente.
            </p>

          </div>

          {/* PRÉVIA — só no mobile/tablet */}
          <div className="xl:hidden">{previewPanel}</div>

          {/* AÇÃO */}
          <div className="glass hidden p-6 xl:block">
            <div className="mb-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Custo: {cost > 0 ? `${formatCredits(cost)} crédito(s)` : "grátis pelo seu plano"}
                </p>
                <p className="text-xs text-muted-foreground">Saldo atual: {user?.credits ?? 0} crédito(s)</p>
              </div>
            </div>
            <Button type="submit" variant="gradient" className="h-14 w-full rounded-2xl text-base font-semibold" disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando documento...</>
              ) : isEditMode ? (
                "Salvar alterações"
              ) : (
                <>Gerar PDF ({cost > 0 ? `${formatCredits(cost)} crédito` : "grátis"})</>
              )}
            </Button>
          </div>
        </form>

        {/* COLUNA — PRÉVIA STICKY (desktop) */}
        <div className="hidden xl:block xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          {previewPanel}
        </div>
      </div>

      {/* BARRA DE AÇÃO FIXA (mobile/tablet) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
          <p className="flex items-center gap-1.5 truncate rounded-full border border-border/60 bg-secondary/50 px-2.5 py-0.5 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              {cost > 0 ? `${formatCredits(cost)} crédito(s)` : "Grátis pelo seu plano"}
            </span>
            <span aria-hidden>·</span>
            <span>Saldo: {user?.credits ?? 0}</span>
          </p>
          <Button
            type="button"
            variant="gradient"
            className="h-12 w-full max-w-md rounded-2xl text-sm font-semibold"
            disabled={generating}
            onClick={() => void handleGenerate()}
          >
            {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : isEditMode ? "Salvar" : "Gerar PDF"}
          </Button>
        </div>
      </div>

      <PdfReadyDialog
        open={showReady}
        onOpenChange={setShowReady}
        pdfDataUrl={finalPdf || ""}
        fileName="diploma.pdf"
        title="Diploma"
        message={mensagem}
      />
    </div>
  );
}
