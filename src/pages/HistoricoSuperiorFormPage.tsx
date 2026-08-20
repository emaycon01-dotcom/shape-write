import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useDocuments } from "@/contexts/DocumentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  University, GraduationCap, User, Loader2, FlaskConical, Trash2, Check, ChevronsUpDown,
  BookOpen, Plus, X, RefreshCw, ClipboardList, History, FileText,
  Eye, CreditCard, ShieldCheck, ArrowLeft, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { pick, rnd } from "@/lib/random";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { MODALIDADES, type Modalidade, cursosPorModalidade, TOTAL_CURSOS } from "@/lib/diploma-cursos";
import {
  gerarGrade, montarLinhas, cargaHorariaTotal, CURSOS_COM_GRADE_REAL,
  type LinhaHistorico,
} from "@/lib/grades-curriculares";
import logoAsset from "@/assets/anhanguera-logo.png.asset.json";
import { loadTemplateObjectUrl } from "@/lib/template-cache";

const TITULACOES = ["Bacharel", "Licenciado", "Tecnólogo", "Técnico"];

const ESTADOS = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo",
  "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba",
  "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul",
  "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
];

interface FormState {
  instituicaoModo: "auto" | "manual";
  faculdade: string;
  cidadeUf: string;
  enderecoFaculdade: string;

  nome: string;
  ra: string;
  naturalEstado: string;
  nascimento: string;
  docIdentidade: string;
  nacionalidade: string;

  modalidade: Modalidade;
  curso: string;
  titulacao: string;
  regime: string;
  semestres: number;
  anoInicial: string;
  comNotas: boolean;

  ingresso: string;
  classificacao: string;
  portaria: string;

  enadeTexto: string;
  dataColacao: string;
  dataExpedicao: string;
  localData: string;
  secretariaNome: string;
  secretariaCargo: string;
  codigoDocumento: string;
  siteValidacao: string;
}

const initial: FormState = {
  instituicaoModo: "auto",
  faculdade: "FACULDADE ANHANGUERA DE ANÁPOLIS",
  cidadeUf: "Anápolis/GO",
  enderecoFaculdade: "AV. Universitária, nº 683 - Centro, Anápolis - GO, CEP 75080-150 - Tel.: (62) 3098-3838",

  nome: "",
  ra: "",
  naturalEstado: "Goiás",
  nascimento: "",
  docIdentidade: "",
  nacionalidade: "brasileira",

  modalidade: "bacharelado",
  curso: "ENGENHARIA MECÂNICA",
  titulacao: "Bacharel",
  regime: "Semestral",
  semestres: 10,
  anoInicial: "2009",
  comNotas: true,

  ingresso: "Processo Seletivo/Vestibular Unificado - Conteúdo da Prova: ENEM-Historico do Ensino Médio-Prova Objetiva-Redação 11/2008 Faculdade Latino Americana",
  classificacao: "201",
  portaria: "Renovação de reconhecimento através da Portaria SERES nº 286, de 21/12/2012, publicada no D.O.U. de 27/12/2012.",

  enadeTexto: "Estudante dispensado de realização do ENADE, em razão do calendário trienal",
  dataColacao: "",
  dataExpedicao: "",
  localData: "",
  secretariaNome: "Liana Oliveira Dutra",
  secretariaCargo: "Secretaria",
  codigoDocumento: "",
  siteValidacao: "http://sada.anhanguera.com",
};

const NOMES = ["Marcos Feliciano Ramos", "Rafael Souza Andrade", "Juliana Ferreira Lima", "Pedro Henrique Barbosa"];

function codigoAleatorio() {
  const hex = "0123456789ABCDEF";
  let out = "";
  for (let i = 0; i < 32; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

const ROUTE_KEY = "/dashboard/documents/historico-superior";

export default function HistoricoSuperiorFormPage() {
  const location = useLocation();
  const { documents, addDocument } = useDocuments();
  const previewHistory = documents.filter((d) => d.type === "historico-superior").slice(0, 6);

  const [form, setForm] = useState<FormState>(initial);
  const [cursoOpen, setCursoOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gradeAberta, setGradeAberta] = useState(false);
  const [avancado, setAvancado] = useState(false);
  // campos que o usuário editou manualmente — deixam de ser recalculados
  const [manuais, setManuais] = useState<Record<string, boolean>>({});

  const [grupos, setGrupos] = useState<LinhaHistorico[][]>(() =>
    montarLinhas(gerarGrade(initial.curso, initial.semestres), Number(initial.anoInicial), true),
  );

  const { user, deductCredit } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const cost = planCost(1, user?.plano);

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

  const cursos = useMemo(() => cursosPorModalidade(form.modalidade), [form.modalidade]);

  const chTotal = useMemo(
    () => grupos.reduce((a, g) => a + g.reduce((s, l) => s + (Number(l.ch) || 0), 0), 0),
    [grupos],
  );

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setManuais((m) => ({ ...m, [field]: true }));
      setForm((p) => ({ ...p, [field]: e.target.value }));
    };

  /** Deriva os campos repetidos nas 3 páginas a partir dos dados principais. */
  const derivar = (f: FormState): FormState => {
    const out = { ...f };
    const cidade = (f.cidadeUf.split("/")[0] || "").trim();
    const anoVest = (Number(f.anoInicial) || 2015) - 1;

    if (!manuais.titulacao) {
      out.titulacao =
        f.modalidade === "licenciatura" ? "Licenciado"
        : f.modalidade === "tecnologo" ? "Tecnólogo"
        : "Bacharel";
    }
    if (!manuais.ingresso) {
      out.ingresso = `Processo Seletivo/Vestibular Unificado - Conteúdo da Prova: ENEM-Historico do Ensino Médio-Prova Objetiva-Redação 11/${anoVest}`;
    }
    if (!manuais.dataExpedicao) out.dataExpedicao = f.dataColacao;
    if (!manuais.localData) {
      const d = out.dataExpedicao || f.dataColacao;
      out.localData = cidade && d ? `${cidade}, ${d}` : "";
    }
    if (!manuais.codigoDocumento || !out.codigoDocumento) {
      out.codigoDocumento = f.codigoDocumento || codigoAleatorio();
    }
    if (!manuais.classificacao) out.classificacao = f.classificacao || String(100 + Math.floor(Math.random() * 300));
    return out;
  };

  const previa = useMemo(() => derivar(form), [form, manuais]);

  const regerarGrade = (over?: Partial<FormState>) => {
    const f = { ...form, ...over };
    const grade = gerarGrade(f.curso, f.semestres);
    setGrupos(montarLinhas(grade, Number(f.anoInicial) || 2015, f.comNotas));
  };


  const escolherCurso = (c: string) => {
    setForm((p) => ({ ...p, curso: c }));
    setCursoOpen(false);
    const grade = gerarGrade(c, form.semestres);
    setGrupos(montarLinhas(grade, Number(form.anoInicial) || 2015, form.comNotas));
    toast({
      title: "Grade curricular carregada",
      description: `${grade.length} semestres · ${cargaHorariaTotal(grade)}h — edite o que quiser abaixo.`,
    });
  };

  const editLinha = (gi: number, li: number, campo: keyof LinhaHistorico, valor: string) =>
    setGrupos((prev) => prev.map((g, i) => (i === gi ? g.map((l, j) => (j === li ? { ...l, [campo]: valor } : l)) : g)));

  const addLinha = (gi: number) =>
    setGrupos((prev) =>
      prev.map((g, i) =>
        i === gi
          ? [...g, { ano: g[0]?.ano || "", serie: g[0]?.serie || "", disciplina: "", ch: "60", freq: "100", media: "8,00", situacao: "Aprovado" }]
          : g,
      ),
    );

  const removeLinha = (gi: number, li: number) =>
    setGrupos((prev) => prev.map((g, i) => (i === gi ? g.filter((_, j) => j !== li) : g)).filter((g) => g.length));

  const fillTest = () => {
    const ano = 2009;
    const next: FormState = {
      ...initial,
      nome: pick(NOMES),
      ra: rnd(10),
      nascimento: "22/01/1977",
      docIdentidade: `${rnd(2)}.${rnd(3)}.${rnd(2)} GO`,
      anoInicial: String(ano),
      dataColacao: "12/02/2014",
      codigoDocumento: codigoAleatorio(),
    };
    setManuais({});
    setForm(next);
    setGrupos(montarLinhas(gerarGrade(next.curso, next.semestres), ano, true));
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setManuais({});
    setGrupos(montarLinhas(gerarGrade(initial.curso, initial.semestres), Number(initial.anoInicial), true));
    toast({ title: "Formulário limpo!" });
  };

  const buildBody = useCallback(async () => {
    const d = derivar(form);
    const logoBase64 = await loadTemplateObjectUrl(logoAsset.url);
    return {
      logo_base64: logoBase64,
      faculdade: d.faculdade,
      cidade_uf: d.cidadeUf,
      endereco_faculdade: d.enderecoFaculdade,

      nome: d.nome,
      ra: d.ra,
      natural_estado: d.naturalEstado,
      nascimento: d.nascimento,
      doc_identidade: d.docIdentidade,
      nacionalidade: d.nacionalidade,

      titulacao: d.titulacao,
      ingresso: d.ingresso,
      classificacao: d.classificacao,
      curso: d.curso,
      regime: d.regime,
      portaria: d.portaria,

      grupos,

      enade_texto: d.enadeTexto,
      diploma_curso: d.curso,
      carga_horaria: String(chTotal),
      data_colacao: d.dataColacao,
      data_expedicao: d.dataExpedicao,
      local_data: d.localData,
      secretaria_nome: d.secretariaNome,
      secretaria_cargo: d.secretariaCargo,
      codigo_documento: d.codigoDocumento || codigoAleatorio(),
      site_validacao: d.siteValidacao,
    } as Record<string, unknown>;
  }, [form, grupos, chTotal, manuais]);

  const signature = useMemo(
    () => JSON.stringify({ form, grupos }),
    [form, grupos],
  );

  const canPreview = form.nome.trim().length > 2 && form.ra.trim().length > 2 && form.curso.trim().length > 2;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-historico-superior-pdf", {
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

  const handleGenerate = async () => {
    if (!user) return;

    if ((user.credits ?? 0) < cost) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de ${formatCredits(cost)} crédito(s) para gerar o documento.`,
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    const d = derivar(form);
    saveFormDraft("historico-superior", d as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-historico-superior-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-historico-superior", creditRef("geracao-historico-superior", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: d.nome || "",
        identification: d.ra || "",
        date: d.dataExpedicao || "",
        description: `HISTÓRICO ESCOLAR SUPERIOR - ${d.curso || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "historico-superior",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      generatedSignature.current = signature;
      setShowReady(true);

      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });
    } catch (e) {
      console.error("Falha na geração:", e);
      toast({
        title: "Erro ao gerar documento",
        description: `Nenhum crédito foi descontado. ${describeError(e)}`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu HISTÓRICO ESCOLAR está pronto.\n\nAluno: ${form.nome}\nCurso: ${form.curso}\nInstituição: ${form.faculdade}`;

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";
  const cellCls = "h-8 px-1.5 text-xs " + inputCls;

  const FieldLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-sm font-semibold text-primary">
      {children}{required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="mb-2 flex items-center gap-3 border-b border-border/50 pb-2">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );

  const card = "relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 shadow-[0_1px_0_0_hsl(var(--foreground)/0.04)_inset,0_18px_40px_-28px_hsl(var(--foreground)/0.4)] backdrop-blur-xl";

  const previewPanel = (
    <div className={`${card} flex h-full flex-col p-0`}>
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do HISTÓRICO ESCOLAR SUPERIOR" />
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
                : "Preencha nome, RA e curso — a prévia atualiza sozinha enquanto você digita."}
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
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              onClick={() => navigate("/dashboard/documents")}
              className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Serviços
            </button>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-inset ring-primary/30">
                <University className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight text-foreground">HISTÓRICO ESCOLAR SUPERIOR</h1>
                <p className="text-xs text-muted-foreground">Editor com prévia ao vivo · sem trocar de tela</p>
              </div>
            </div>
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
            <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 rounded-xl border-primary/30 text-xs text-primary hover:bg-primary/10">
              <FlaskConical className="h-3.5 w-3.5" /> Teste
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 rounded-xl border-destructive/30 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }} className="space-y-6">
          <FormDraftsPanel docType="historico-superior" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

        {/* ALUNO */}
        <div className="glass space-y-4 p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>RA</FieldLabel>
              <Input value={form.ra} onChange={(e) => setForm((p) => ({ ...p, ra: maskDigits(12)(e.target.value) }))} inputMode="numeric" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nascimento</FieldLabel>
              <Input value={form.nascimento} onChange={(e) => setForm((p) => ({ ...p, nascimento: maskDate(e.target.value) }))} inputMode="numeric" placeholder="22/01/1977" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Natural do Estado</FieldLabel>
              <Select value={form.naturalEstado} onValueChange={(v) => setForm((p) => ({ ...p, naturalEstado: v }))}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Doc. Identidade</FieldLabel>
              <Input value={form.docIdentidade} onChange={set("docIdentidade")} placeholder="37.976.40 GO" className={inputCls} />
            </div>
          </div>
        </div>

        {/* CURSO */}
        <div className="glass space-y-4 p-6">
          <SectionHeader icon={GraduationCap} title="Curso e conclusão" />

          <div className="space-y-1.5">
            <FieldLabel>Modalidade</FieldLabel>
            <Select
              value={form.modalidade}
              onValueChange={(v) => setForm((p) => ({ ...p, modalidade: v as Modalidade }))}
            >
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODALIDADES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
                        <CommandItem key={c} value={c} onSelect={() => escolherCurso(c)}>
                          <Check className={`mr-2 h-4 w-4 ${form.curso === c ? "opacity-100" : "opacity-0"}`} />
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Ano de ingresso</FieldLabel>
              <Input
                value={form.anoInicial}
                onChange={(e) => {
                  const v = maskDigits(4)(e.target.value);
                  setForm((p) => ({ ...p, anoInicial: v }));
                  if (v.length === 4) regerarGrade({ anoInicial: v });
                }}
                inputMode="numeric"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Semestres</FieldLabel>
              <Select
                value={String(form.semestres)}
                onValueChange={(v) => {
                  setForm((p) => ({ ...p, semestres: Number(v) }));
                  regerarGrade({ semestres: Number(v) });
                }}
              >
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => <SelectItem key={n} value={String(n)}>{n} semestres</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Colação de grau</FieldLabel>
              <Input value={form.dataColacao} onChange={(e) => setForm((p) => ({ ...p, dataColacao: maskDate(e.target.value) }))} inputMode="numeric" placeholder="12/02/2014" className={inputCls} />
            </div>
          </div>

          {/* resumo do que o sistema preenche sozinho */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="mb-1 font-semibold text-primary">Preenchido automaticamente nas 3 páginas</p>
            <p>
              {grupos.length} semestres · {grupos.reduce((a, g) => a + g.length, 0)} disciplinas ·{" "}
              {chTotal}h · notas e frequências geradas · titulação <b>{previa.titulacao}</b> ·
              expedição <b>{previa.dataExpedicao || "—"}</b> · local <b>{previa.localData || "—"}</b> ·
              código do documento gerado no envio.
            </p>
          </div>
        </div>

        {/* AVANÇADO */}
        <div className="glass space-y-4 p-6">
          <button
            type="button"
            onClick={() => setAvancado((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold text-foreground">Ajustes avançados</span>
            </span>
            <span className="text-xs text-muted-foreground">{avancado ? "ocultar" : "abrir"}</span>
          </button>
          <p className="text-[11px] text-muted-foreground">
            Instituição, textos legais, assinatura e disciplinas. Só abra se precisar mudar algo — tudo já
            vem preenchido.
          </p>

          {avancado && (
            <div className="space-y-6 border-t border-border/50 pt-4">
              {/* instituição */}
              <div className="space-y-4">
                <SectionHeader icon={University} title="Instituição" />

                <div className="space-y-1.5">
                  <FieldLabel>Nome da instituição</FieldLabel>
                  <Select
                    value={form.instituicaoModo}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        instituicaoModo: v as "auto" | "manual",
                        ...(v === "auto"
                          ? { faculdade: initial.faculdade, cidadeUf: initial.cidadeUf, enderecoFaculdade: initial.enderecoFaculdade }
                          : {}),
                      }))
                    }
                  >
                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático — Anhanguera</SelectItem>
                      <SelectItem value="manual">Manual — digitar outra faculdade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel required>Faculdade</FieldLabel>
                  <Input value={form.faculdade} onChange={set("faculdade")} className={inputCls} required disabled={form.instituicaoModo === "auto"} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel>Cidade/UF (topo)</FieldLabel>
                    <Input value={form.cidadeUf} onChange={set("cidadeUf")} placeholder="Anápolis/GO" className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Regime</FieldLabel>
                    <Input value={form.regime} onChange={set("regime")} className={inputCls} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Endereço / contato</FieldLabel>
                  <Input value={form.enderecoFaculdade} onChange={set("enderecoFaculdade")} className={inputCls} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Portaria de reconhecimento</FieldLabel>
                  <Input value={form.portaria} onChange={set("portaria")} className={inputCls} />
                </div>
              </div>

              {/* textos automáticos */}
              <div className="space-y-4">
                <SectionHeader icon={GraduationCap} title="Textos automáticos" />

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel>Titulação</FieldLabel>
                    <Select
                      value={previa.titulacao}
                      onValueChange={(v) => {
                        setManuais((m) => ({ ...m, titulacao: true }));
                        setForm((p) => ({ ...p, titulacao: v }));
                      }}
                    >
                      <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TITULACOES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Classificação</FieldLabel>
                    <Input value={previa.classificacao} onChange={set("classificacao")} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Carga horária total</FieldLabel>
                    <Input value={`${chTotal} h`} readOnly className={inputCls} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Forma de ingresso</FieldLabel>
                  <Input value={previa.ingresso} onChange={set("ingresso")} className={inputCls} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel>Data de expedição</FieldLabel>
                    <Input value={previa.dataExpedicao} onChange={(e) => { setManuais((m) => ({ ...m, dataExpedicao: true })); setForm((p) => ({ ...p, dataExpedicao: maskDate(e.target.value) })); }} inputMode="numeric" className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Local e data</FieldLabel>
                    <Input value={previa.localData} onChange={set("localData")} className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel>Nome do(a) secretário(a)</FieldLabel>
                    <Input value={form.secretariaNome} onChange={set("secretariaNome")} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Cargo</FieldLabel>
                    <Input value={form.secretariaCargo} onChange={set("secretariaCargo")} className={inputCls} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Observação ENADE</FieldLabel>
                  <Input value={form.enadeTexto} onChange={set("enadeTexto")} className={inputCls} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel>Site de conferência (rodapé)</FieldLabel>
                    <Input value={form.siteValidacao} onChange={set("siteValidacao")} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Código do documento</FieldLabel>
                    <Input value={form.codigoDocumento} onChange={set("codigoDocumento")} placeholder="gerado automaticamente" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* disciplinas */}
              <div className="space-y-4">
                <SectionHeader icon={BookOpen} title="Disciplinas e notas" />

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setGradeAberta((v) => !v)} className="text-xs">
                    {gradeAberta ? "Ocultar" : "Editar"} disciplinas ({grupos.reduce((a, g) => a + g.length, 0)})
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => regerarGrade()} className="gap-1.5 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" /> Regerar notas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const novo = !form.comNotas;
                      setForm((p) => ({ ...p, comNotas: novo }));
                      regerarGrade({ comNotas: novo });
                    }}
                    className="text-xs"
                  >
                    {form.comNotas ? "Deixar notas em branco" : "Preencher notas"}
                  </Button>
                </div>

                {gradeAberta && (
                  <div className="space-y-4">
                    {grupos.map((g, gi) => (
                      <div key={gi} className="rounded-lg border border-border/60 bg-secondary/40 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground">
                            {g[0]?.serie || `${gi + 1}º semestre`} · {g[0]?.ano || ""}
                          </p>
                          <Button type="button" variant="ghost" size="sm" onClick={() => addLinha(gi)} className="h-7 gap-1 text-xs text-primary">
                            <Plus className="h-3.5 w-3.5" /> Disciplina
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {g.map((l, li) => (
                            <div key={li} className="grid grid-cols-12 gap-1.5">
                              <Input value={l.disciplina} onChange={(e) => editLinha(gi, li, "disciplina", e.target.value)} placeholder="Disciplina" className={`col-span-5 ${cellCls}`} />
                              <Input value={l.ch} onChange={(e) => editLinha(gi, li, "ch", e.target.value)} placeholder="C.H." className={`col-span-1 text-center ${cellCls}`} />
                              <Input value={l.freq} onChange={(e) => editLinha(gi, li, "freq", e.target.value)} placeholder="%" className={`col-span-1 text-center ${cellCls}`} />
                              <Input value={l.media} onChange={(e) => editLinha(gi, li, "media", e.target.value)} placeholder="Média" className={`col-span-2 text-center ${cellCls}`} />
                              <Input value={l.situacao} onChange={(e) => editLinha(gi, li, "situacao", e.target.value)} placeholder="Situação" className={`col-span-2 ${cellCls}`} />
                              <button type="button" onClick={() => removeLinha(gi, li)} className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-destructive">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>


        <div className="hidden justify-center pt-1 xl:flex">
          <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={generating}>
            {generating ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>) : "Gerar PDF"}
          </Button>
        </div>
      </form>

        {/* COLUNA — PRÉVIA STICKY (desktop) */}
        <div className="hidden xl:block xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          {previewPanel}
        </div>
      </div>

      {/* PRÉVIA (mobile/tablet) */}
      <div className="mt-6 xl:hidden">{previewPanel}</div>

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
            {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : "Gerar PDF"}
          </Button>
        </div>
      </div>

      <PdfReadyDialog
        open={showReady}
        onOpenChange={setShowReady}
        pdfDataUrl={finalPdf || ""}
        fileName="historico-escolar-superior.pdf"
        title="Historico Escolar Superior"
        message={mensagem}
      />
    </div>
  );
}
