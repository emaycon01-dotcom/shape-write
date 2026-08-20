import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  School, Loader2, FlaskConical, Trash2, FileText, User, PenLine,
  ChevronDown, ChevronRight, ListChecks, CalendarClock, History,
  Eye, CreditCard, ShieldCheck, ArrowLeft, RefreshCw, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { normalizeSignatureImage } from "@/lib/signature-image";
import { ESTADOS_UF, ESTADO_NOMES, loadBrasaoDataUrl } from "@/lib/brasoes-estados";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";

type Nota = { area: string; componente: string; n1: string; n2: string; n3: string };
type Turma = { ano: string; serie: string; turno: string; unidade: string; municipio: string };

export const TURNOS = [
  "Matutino (manhã)",
  "Vespertino (tarde)",
  "Noturno (noite)",
  "Integral",
  "Intermediário",
  "EAD / Semipresencial",
];

const AREA_LING = "Linguagens, Códigos e suas Tecnologias";
const AREA_NAT = "Ciências da Natureza, Matemática e suas Tecnologias";
const AREA_HUM = "Ciências Humanas e suas Tecnologias";
const AREA_DIV = "Parte Diversificada";

const NOTAS_PADRAO: Nota[] = [
  { area: AREA_LING, componente: "Língua Portuguesa", n1: "", n2: "", n3: "" },
  { area: AREA_LING, componente: "Educação Física", n1: "", n2: "", n3: "" },
  { area: AREA_LING, componente: "Arte", n1: "", n2: "", n3: "" },
  { area: AREA_NAT, componente: "Física", n1: "", n2: "", n3: "" },
  { area: AREA_NAT, componente: "Química", n1: "", n2: "", n3: "" },
  { area: AREA_NAT, componente: "Biologia", n1: "", n2: "", n3: "" },
  { area: AREA_NAT, componente: "Matemática", n1: "", n2: "", n3: "" },
  { area: AREA_HUM, componente: "História", n1: "", n2: "", n3: "" },
  { area: AREA_HUM, componente: "Geografia", n1: "", n2: "", n3: "" },
  { area: AREA_HUM, componente: "Sociologia", n1: "", n2: "", n3: "" },
  { area: AREA_HUM, componente: "Filosofia", n1: "", n2: "", n3: "" },
  { area: AREA_DIV, componente: "Inglês", n1: "", n2: "", n3: "" },
  { area: AREA_DIV, componente: "Espanhol", n1: "", n2: "", n3: "" },
  { area: AREA_DIV, componente: "Juventude, Educação e Trabalho", n1: "", n2: "", n3: "" },
];

const NOTAS_TESTE = ["8.0/8.0/10", "10/8.5/7.5", "10/10/8.0", "7.5/9.0/9.5", "6.5/10/8.5",
  "9.3/6.5/7.0", "8.5/10/9.0", "9.0/8.0/10", "10/6.5/7.5", "10/8.5/10",
  "8.0/7.5/6.5", "6.0/9.5/8.5", "8.5/8.0/9.0", "10/10/10"];

interface FormState {
  estado: string;
  escola: string;
  endereco: string;
  atoCriacao: string;
  publicacaoCriacao: string;
  atoAprovacao: string;
  publicacaoAprovacao: string;
  nomeAluno: string;
  localNascimento: string;
  dataNascimento: string;
  pai: string;
  mae: string;
  periodoConclusao: string;
  nivelEnsino: string;
  ch1: string; ch2: string; ch3: string;
  dias1: string; dias2: string; dias3: string;
  faltas1: string; faltas2: string; faltas3: string;
  resultado1: string; resultado2: string; resultado3: string;
  secretarioNome: string; secretarioRg: string; secretarioCargo: string;
  diretorNome: string; diretorRg: string; diretorCargo: string;
}

const initial: FormState = {
  estado: "SP",
  escola: 'Escola Estadual de Ensino Fundamental e Médio "Casemiro de Abreu"',
  endereco: "Rua Cel. Jordão, nº 144, Vila Paiva, São Paulo",
  atoCriacao: 'Portaria "E" nº. 3353',
  publicacaoCriacao: "05/03/1998",
  atoAprovacao: "Resolução CEE 1063/2004",
  publicacaoAprovacao: "18/12/2018",
  nomeAluno: "",
  localNascimento: "",
  dataNascimento: "",
  pai: "",
  mae: "",
  periodoConclusao: "",
  nivelEnsino: "Ensino Fundamental e Médio",
  ch1: "405", ch2: "405", ch3: "405",
  dias1: "200", dias2: "200", dias3: "200",
  faltas1: "0", faltas2: "0", faltas3: "0",
  resultado1: "Aprov", resultado2: "Aprov", resultado3: "Aprov",
  secretarioNome: "MARLETE BARRIENTOS DE BARROS",
  secretarioRg: "12.143.804-1",
  secretarioCargo: "Gerente de Organização Escolar",
  diretorNome: "SILVA MARIA VILA RIOS",
  diretorRg: "12.740.744",
  diretorCargo: "Diretor de Escola",
};

const turmaVazia = (): Turma => ({ ano: "", serie: "", turno: TURNOS[0], unidade: "", municipio: "" });

const ROUTE_KEY = "/dashboard/documents/historico-medio-sp";

export default function HistoricoMedioSpFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "historico-medio-sp").slice(0, 6);

  const [form, setForm] = useState<FormState>(initial);
  const [notas, setNotas] = useState<Nota[]>(NOTAS_PADRAO);
  const [turmas, setTurmas] = useState<Turma[]>([turmaVazia(), turmaVazia(), turmaVazia()]);
  const [assinatura, setAssinatura] = useState("");
  const [showNotas, setShowNotas] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { user, deductCredit } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(editState?.editDocId);
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

  useEffect(() => {
    if (hydrated || !editState?.editDocId) return;
    let cancelled = false;
    (async () => {
      const docId = editState.editDocId!;
      const raw = getDocument(docId)?.additionalInfo || (await loadDocumentInfo(docId));
      if (cancelled || !raw) return;
      try {
        const b = JSON.parse(raw) as Record<string, string>;
        setForm((p) => ({
          ...p,
          estado: b.estado || p.estado,
          escola: b.escola || p.escola,
          endereco: b.endereco || p.endereco,
          atoCriacao: b.ato_criacao || p.atoCriacao,
          publicacaoCriacao: b.publicacao_criacao || p.publicacaoCriacao,
          atoAprovacao: b.ato_aprovacao || p.atoAprovacao,
          publicacaoAprovacao: b.publicacao_aprovacao || p.publicacaoAprovacao,
          nomeAluno: b.nome_aluno || "",
          localNascimento: b.local_nascimento || "",
          dataNascimento: b.data_nascimento || "",
          pai: b.pai || "",
          mae: b.mae || "",
          periodoConclusao: b.periodo_conclusao || "",
          nivelEnsino: b.nivel_ensino || p.nivelEnsino,
          ch1: b.ch1 || p.ch1, ch2: b.ch2 || p.ch2, ch3: b.ch3 || p.ch3,
          dias1: b.dias1 || p.dias1, dias2: b.dias2 || p.dias2, dias3: b.dias3 || p.dias3,
          faltas1: b.faltas1 ?? p.faltas1, faltas2: b.faltas2 ?? p.faltas2, faltas3: b.faltas3 ?? p.faltas3,
          resultado1: b.resultado1 || p.resultado1, resultado2: b.resultado2 || p.resultado2, resultado3: b.resultado3 || p.resultado3,
          secretarioNome: b.secretario_nome || p.secretarioNome,
          secretarioRg: b.secretario_rg || p.secretarioRg,
          secretarioCargo: b.secretario_cargo || p.secretarioCargo,
          diretorNome: b.diretor_nome || p.diretorNome,
          diretorRg: b.diretor_rg || p.diretorRg,
          diretorCargo: b.diretor_cargo || p.diretorCargo,
        }));
        try { const n = JSON.parse(b.notas_json || "[]"); if (Array.isArray(n) && n.length) setNotas(n); } catch { /* ignora */ }
        try { const t = JSON.parse(b.turmas_json || "[]"); if (Array.isArray(t) && t.length) setTurmas(t); } catch { /* ignora */ }
        setAssinatura(b.assinatura_base64 || "");
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof FormState, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const setNota = (index: number, key: keyof Nota, value: string) =>
    setNotas((p) => p.map((n, i) => (i === index ? { ...n, [key]: value } : n)));

  const setTurma = (index: number, key: keyof Turma, value: string) =>
    setTurmas((p) => p.map((t, i) => (i === index ? { ...t, [key]: value } : t)));

  const uploadAssinatura = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read_error"));
        reader.readAsDataURL(file);
      });
      setAssinatura(await normalizeSignatureImage(dataUrl));
      toast({ title: "Carimbo/assinatura carregado!" });
    } catch {
      toast({ title: "Não foi possível ler a imagem", variant: "destructive" });
    }
  };

  const fillTest = () => {
    setForm({
      ...initial,
      nomeAluno: "ANA VITÓRIA SANTOS GUEDES DA SILVA",
      localNascimento: "Santana do Ipanema-Alagoas",
      dataNascimento: "01/08/2000",
      pai: "Damião Guedes da Silva",
      mae: "Rita de Cassia Santos da Silva",
      periodoConclusao: "2016 a 2018",
      faltas1: "3",
    });
    setNotas(NOTAS_PADRAO.map((n, i) => {
      const [n1, n2, n3] = (NOTAS_TESTE[i] || "").split("/");
      return { ...n, n1: n1 || "", n2: n2 || "", n3: n3 || "" };
    }));
    setTurmas([
      { ano: "2016", serie: "1ºM04 - EM", turno: TURNOS[0], unidade: 'EEEM "CASEMIRO DE ABREU"', municipio: "São Paulo – São Paulo" },
      { ano: "2017", serie: "2ºM04 - EM", turno: TURNOS[0], unidade: 'EEEM "CASEMIRO DE ABREU"', municipio: "São Paulo – São Paulo" },
      { ano: "2018", serie: "3ºM04 - EM", turno: TURNOS[0], unidade: 'EEEM "CASEMIRO DE ABREU"', municipio: "São Paulo – São Paulo" },
    ]);
    setShowNotas(true);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setNotas(NOTAS_PADRAO);
    setTurmas([turmaVazia(), turmaVazia(), turmaVazia()]);
    setAssinatura("");
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const brasao = await loadBrasaoDataUrl(form.estado);
    return {
      estado: form.estado,
      estado_nome: ESTADO_NOMES[form.estado] || form.estado,
      escola: form.escola,
      endereco: form.endereco,
      ato_criacao: form.atoCriacao,
      publicacao_criacao: form.publicacaoCriacao,
      ato_aprovacao: form.atoAprovacao,
      publicacao_aprovacao: form.publicacaoAprovacao,
      nome_aluno: form.nomeAluno,
      local_nascimento: form.localNascimento,
      data_nascimento: form.dataNascimento,
      pai: form.pai,
      mae: form.mae,
      periodo_conclusao: form.periodoConclusao,
      nivel_ensino: form.nivelEnsino,
      nivel_ensino_grade: "ENSINO MÉDIO",
      ch1: form.ch1, ch2: form.ch2, ch3: form.ch3,
      dias1: form.dias1, dias2: form.dias2, dias3: form.dias3,
      faltas1: form.faltas1, faltas2: form.faltas2, faltas3: form.faltas3,
      resultado1: form.resultado1, resultado2: form.resultado2, resultado3: form.resultado3,
      secretario_nome: form.secretarioNome,
      secretario_rg: form.secretarioRg,
      secretario_cargo: form.secretarioCargo,
      diretor_nome: form.diretorNome,
      diretor_rg: form.diretorRg,
      diretor_cargo: form.diretorCargo,
      notas_json: JSON.stringify(notas),
      turmas_json: JSON.stringify(turmas.filter((t) => t.ano || t.serie || t.unidade)),
      template_brasao_base64: brasao,
      assinatura_base64: assinatura,
    } as Record<string, unknown>;
  }, [form, notas, turmas, assinatura]);

  const signature = useMemo(
    () => JSON.stringify({ form, notas, turmas, assinatura }),
    [form, notas, turmas, assinatura],
  );

  const canPreview =
    form.nomeAluno.trim().length > 2 &&
    form.mae.trim().length > 2 &&
    form.escola.trim().length > 2;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-historico-medio-sp-pdf", {
        body: { ...body, preview: true },
      });
      if (seq !== previewSeq.current) return;
      if (error) throw error;
      const result = data?.pdfBase64;
      if (!result) throw new Error(data?.error || "Nenhum PDF retornado");
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

  /* ---------------- documento final ---------------- */
  const handleGenerate = async () => {
    if (!user) return;

    if (isEditMode && editState?.editDocId) {
      setGenerating(true);
      try {
        const body = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-historico-medio-sp-pdf", { body: { ...body, preview: false } });
        if (error) throw error;
        const generated = data?.pdfBase64;
        if (!generated) throw new Error("pdf_nao_gerado");
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(body),
          pdfDataUrl: generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`,
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
    saveFormDraft("historico-medio-sp", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-historico-medio-sp-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-historico-medio-sp", creditRef("geracao-historico-medio-sp", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nomeAluno || "",
        identification: form.periodoConclusao || "",
        date: form.dataNascimento || "",
        description: `HISTÓRICO ESCOLAR (ENSINO MÉDIO) - ${form.escola || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "historico-medio-sp",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu HISTÓRICO ESCOLAR (ENSINO MÉDIO) está pronto.\n\nAluno: ${form.nomeAluno}\nEscola: ${form.escola}\nConclusão: ${form.periodoConclusao}`;

  const inputCls = "h-11 rounded-xl bg-secondary/70 border-border/70 text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-primary/40";
  const selectCls = `h-11 w-full rounded-xl border px-3 text-sm ${inputCls}`;

  const FieldLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );

  const SectionHeader = ({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) => (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-inset ring-primary/25">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  const card = "relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 shadow-[0_1px_0_0_hsl(var(--foreground)/0.04)_inset,0_18px_40px_-28px_hsl(var(--foreground)/0.4)] backdrop-blur-xl";

  /* ---------------- painel de preview (reutilizado em 2 posições) ---------------- */
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do HISTÓRICO ESCOLAR — ENSINO MÉDIO" />
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
                : "Preencha nome do aluno, mãe e escola — a prévia atualiza sozinha enquanto você digita."}
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
      {/* HERO */}
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
                <School className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight text-foreground">HISTÓRICO ESCOLAR — ENSINO MÉDIO</h1>
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
        {/* COLUNA — FORMULÁRIO */}
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-5"
        >
          <FormDraftsPanel docType="historico-medio-sp" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

          {/* ESCOLA */}
          <div className={card}>
            <SectionHeader icon={School} title="Unidade de ensino" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Estado (brasão)</FieldLabel>
                <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} className={selectCls}>
                  {ESTADOS_UF.map((uf) => (
                    <option key={uf} value={uf}>{uf} — {ESTADO_NOMES[uf]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Nome da unidade de ensino</FieldLabel>
                <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Endereço</FieldLabel>
                <Input value={form.endereco} onChange={set("endereco")} className={inputCls} required />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Ato de criação</FieldLabel>
                  <Input value={form.atoCriacao} onChange={set("atoCriacao")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Publicação</FieldLabel>
                  <Input value={form.publicacaoCriacao} onChange={setMask("publicacaoCriacao", maskDate)} inputMode="numeric" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Ato de aprovação</FieldLabel>
                  <Input value={form.atoAprovacao} onChange={set("atoAprovacao")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Publicação</FieldLabel>
                  <Input value={form.publicacaoAprovacao} onChange={setMask("publicacaoAprovacao", maskDate)} inputMode="numeric" className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* ALUNO */}
          <div className={card}>
            <SectionHeader icon={User} title="Dados do aluno" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Nome do aluno (a)</FieldLabel>
                <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="ANA VITÓRIA SANTOS GUEDES DA SILVA" className={inputCls} required />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel required>Local de nascimento</FieldLabel>
                  <Input value={form.localNascimento} onChange={set("localNascimento")} placeholder="Santana do Ipanema-Alagoas" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Data de nascimento</FieldLabel>
                  <Input value={form.dataNascimento} onChange={setMask("dataNascimento", maskDate)} inputMode="numeric" placeholder="01/08/2000" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Pai</FieldLabel>
                  <Input value={form.pai} onChange={set("pai")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Mãe</FieldLabel>
                  <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Concluiu no ano de</FieldLabel>
                  <Input value={form.periodoConclusao} onChange={set("periodoConclusao")} placeholder="2016 a 2018" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Nível de ensino</FieldLabel>
                  <Input value={form.nivelEnsino} onChange={set("nivelEnsino")} className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* NOTAS (OPCIONAL) */}
          <div className={card}>
            <button
              type="button"
              onClick={() => setShowNotas((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-3">
                <ListChecks className="h-5 w-5 text-primary" />
                <span>
                  <span className="block text-sm font-bold uppercase tracking-wide text-foreground">Notas por série (opcional)</span>
                  <span className="block text-xs text-muted-foreground">
                    Deixe em branco para o documento sair com traços (–) nas colunas de pontos.
                  </span>
                </span>
              </span>
              {showNotas ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
            </button>

            {showNotas && (
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  {notas.map((nota, i) => (
                    <div key={`${nota.componente}-${i}`} className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2">
                      <Input
                        value={nota.componente}
                        onChange={(e) => setNota(i, "componente", e.target.value)}
                        className={`${inputCls} h-9 text-xs`}
                      />
                      <Input value={nota.n1} onChange={(e) => setNota(i, "n1", e.target.value)} placeholder="1ª" className={`${inputCls} h-9 text-center text-xs`} />
                      <Input value={nota.n2} onChange={(e) => setNota(i, "n2", e.target.value)} placeholder="2ª" className={`${inputCls} h-9 text-center text-xs`} />
                      <Input value={nota.n3} onChange={(e) => setNota(i, "n3", e.target.value)} placeholder="3ª" className={`${inputCls} h-9 text-center text-xs`} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2 border-t border-border/50 pt-3">
                  <span className="text-xs font-semibold text-primary">Carga horária anual</span>
                  <Input value={form.ch1} onChange={set("ch1")} className={`${inputCls} h-9 text-center text-xs`} />
                  <Input value={form.ch2} onChange={set("ch2")} className={`${inputCls} h-9 text-center text-xs`} />
                  <Input value={form.ch3} onChange={set("ch3")} className={`${inputCls} h-9 text-center text-xs`} />

                  <span className="text-xs font-semibold text-primary">Dias letivos</span>
                  <Input value={form.dias1} onChange={set("dias1")} className={`${inputCls} h-9 text-center text-xs`} />
                  <Input value={form.dias2} onChange={set("dias2")} className={`${inputCls} h-9 text-center text-xs`} />
                  <Input value={form.dias3} onChange={set("dias3")} className={`${inputCls} h-9 text-center text-xs`} />

                  <span className="text-xs font-semibold text-primary">% de faltas</span>
                  <Input value={form.faltas1} onChange={set("faltas1")} className={`${inputCls} h-9 text-center text-xs`} />
                  <Input value={form.faltas2} onChange={set("faltas2")} className={`${inputCls} h-9 text-center text-xs`} />
                  <Input value={form.faltas3} onChange={set("faltas3")} className={`${inputCls} h-9 text-center text-xs`} />

                  <span className="text-xs font-semibold text-primary">Resultado final</span>
                  <Input value={form.resultado1} onChange={set("resultado1")} className={`${inputCls} h-9 text-center text-xs`} />
                  <Input value={form.resultado2} onChange={set("resultado2")} className={`${inputCls} h-9 text-center text-xs`} />
                  <Input value={form.resultado3} onChange={set("resultado3")} className={`${inputCls} h-9 text-center text-xs`} />
                </div>
              </div>
            )}
          </div>

          {/* TURMAS / TURNO */}
          <div className={card}>
            <SectionHeader icon={CalendarClock} title="Anos cursados e turno" />
            <div className="space-y-4">
              {turmas.map((turma, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border/60 bg-secondary/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Linha {i + 1}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input value={turma.ano} onChange={(e) => setTurma(i, "ano", e.target.value)} placeholder="Ano (2016)" className={`${inputCls} h-9 text-xs`} />
                    <Input value={turma.serie} onChange={(e) => setTurma(i, "serie", e.target.value)} placeholder="Série/Turma (1ºM04 - EM)" className={`${inputCls} h-9 text-xs`} />
                    <select value={turma.turno} onChange={(e) => setTurma(i, "turno", e.target.value)} className={`${selectCls} h-9 text-xs`}>
                      {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input value={turma.unidade} onChange={(e) => setTurma(i, "unidade", e.target.value)} placeholder="Unidade de ensino" className={`${inputCls} h-9 text-xs`} />
                    <Input value={turma.municipio} onChange={(e) => setTurma(i, "municipio", e.target.value)} placeholder="Município – Estado" className={`${inputCls} h-9 text-xs`} />
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setTurmas((p) => [...p, turmaVazia()])}>
                  + Adicionar linha
                </Button>
                {turmas.length > 1 && (
                  <Button type="button" variant="outline" size="sm" className="text-xs text-destructive" onClick={() => setTurmas((p) => p.slice(0, -1))}>
                    Remover última
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ASSINATURAS */}
          <div className={card}>
            <SectionHeader icon={PenLine} title="Assinaturas do rodapé" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Nome (secretário)</FieldLabel>
                  <Input value={form.secretarioNome} onChange={set("secretarioNome")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>RG (secretário)</FieldLabel>
                  <Input value={form.secretarioRg} onChange={set("secretarioRg")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Nome (diretor)</FieldLabel>
                  <Input value={form.diretorNome} onChange={set("diretorNome")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>RG (diretor)</FieldLabel>
                  <Input value={form.diretorRg} onChange={set("diretorRg")} className={inputCls} />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Envie a imagem com as duas assinaturas/carimbo. Ela é aplicada sobre a caixa do rodapé, como no modelo oficial.
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadAssinatura}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary"
              />
              {assinatura && (
                <div className="rounded-md border border-border/60 bg-white p-2">
                  <img src={assinatura} alt="Assinaturas" className="mx-auto h-24 object-contain" />
                </div>
              )}
            </div>
          </div>

          {/* PRÉVIA — só no mobile/tablet, entre o formulário e o botão */}
          <div className="xl:hidden">{previewPanel}</div>

          {/* AÇÃO */}
          <div className={`${card} hidden xl:block`}>
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

          {/* HISTÓRICO */}
          <div className={card}>
            <SectionHeader icon={History} title="Histórico de gerações" />
            {previewHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum documento gerado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {previewHistory.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{d.name || "Sem nome"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {d.identification} · {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      type="button" size="sm" variant="outline"
                      className="shrink-0 gap-1.5 rounded-lg text-xs"
                      onClick={() => navigate("/dashboard/history", { state: { focusDocId: d.id } })}
                    >
                      <FileText className="h-3.5 w-3.5" /> Abrir
                    </Button>
                  </li>
                ))}
              </ul>
            )}
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
        fileName="historico-escolar-ensino-medio.pdf"
        title="Historico Escolar Ensino Medio"
        message={mensagem}
      />
    </div>
  );
}
