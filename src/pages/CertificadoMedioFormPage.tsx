import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  School, Loader2, FlaskConical, Trash2, User, BookOpen, ClipboardList,
  ArrowLeft, Sparkles, ShieldCheck, Eye, CreditCard, FileText, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf, prefetchGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";
import { ESTADO_NOMES, ESTADOS_UF, loadBrasaoDataUrl } from "@/lib/brasoes-estados";
import { pick, rnd } from "@/lib/random";

interface Disciplina {
  nome: string;
  n1: string; c1: string;
  n2: string; c2: string;
  n3: string; c3: string;
}

const COMUM_BASE: Disciplina[] = [
  { nome: "Língua portuguesa e literatura", n1: "9.0", c1: "200", n2: "8.0", c2: "200", n3: "7.0", c3: "200" },
  { nome: "Educação física", n1: "7.0", c1: "40", n2: "6.0", c2: "40", n3: "8.0", c3: "40" },
  { nome: "Historia", n1: "8.0", c1: "80", n2: "7.0", c2: "80", n3: "8.0", c3: "80" },
  { nome: "Geografia", n1: "8.5", c1: "80", n2: "7.5", c2: "80", n3: "7.5", c3: "80" },
  { nome: "Matemática", n1: "7.5", c1: "160", n2: "6.5", c2: "160", n3: "8.0", c3: "160" },
  { nome: "Física", n1: "7.0", c1: "80", n2: "6.0", c2: "80", n3: "6.0", c3: "80" },
  { nome: "Química", n1: "7.0", c1: "80", n2: "8.5", c2: "80", n3: "7.0", c3: "80" },
  { nome: "Biologia e programa de saúde", n1: "8.0", c1: "80", n2: "7.5", c2: "80", n3: "7.0", c3: "120" },
  { nome: "Artes", n1: "8.0", c1: "40", n2: "9.5", c2: "40", n3: "", c3: "" },
  { nome: "Ensino religioso", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
];

const DIVERSIFICADA_BASE: Disciplina[] = [
  { nome: "Língua estrangeira inglês", n1: "8.0", c1: "80", n2: "6.0", c2: "80", n3: "6.0", c3: "80" },
  { nome: "Sociologia", n1: "9.5", c1: "40", n2: "8.5", c2: "40", n3: "6.5", c3: "40" },
  { nome: "Filosofia", n1: "7.0", c1: "40", n2: "7.5", c2: "40", n3: "6.0", c3: "40" },
  { nome: "Educação ambiental", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
  { nome: "Educação para o trabalho", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
];

interface Estab { serie: string; ano: string; estab: string; cidade: string; situacao: string }

interface FormState {
  uf: string;
  govEstado: string;
  secretaria: string;
  escola: string;
  endereco: string;
  contato: string;
  portaria: string;

  nomeAluno: string;
  mae: string;
  pai: string;
  sexo: "M" | "F";
  dataNasc: string;
  municipioNasc: string;
  ufNasc: string;
  nacionalidade: string;
  rg: string;
  orgaoExpedidor: string;
  serieConclusao: string;
  anoConclusao: string;

  turma1: string;
  turma2: string;
  turma3: string;

  ano1: string;
  ano2: string;
  ano3: string;

  dispensaEdFisica: "SIM" | "NAO";
  baseLegal: string;
  observacoes: string;
  localData: string;
}

const initial: FormState = {
  uf: "PE",
  govEstado: "GOVERNO DO ESTADO DE PERNAMBUCO",
  secretaria: "SECRETARIA DE EDUCAÇÃO, CULTURA E ESPORTES",
  escola: "ESCOLA SENADOR NOVAES FILHO",
  endereco: "Rua Maria Lacerda S/N – Várzea – Recife – CEP 51.010-410",
  contato: "Fone (81) 3271-9372 – CNPJ 10572071/0943-46",
  portaria: "Portaria de autorização N 9.288 de 26/04/1984 Cadastro Escolar E-050.108",

  nomeAluno: "",
  mae: "",
  pai: "",
  sexo: "M",
  dataNasc: "",
  municipioNasc: "",
  ufNasc: "PE",
  nacionalidade: "BRASILEIRA",
  rg: "",
  orgaoExpedidor: "SDS/PE",
  serieConclusao: "3º Ano",
  anoConclusao: "",

  turma1: "A",
  turma2: "C",
  turma3: "A",

  ano1: "",
  ano2: "",
  ano3: "",

  dispensaEdFisica: "NAO",
  baseLegal: "",
  observacoes: "",
  localData: "",
};

const NOMES = ["MATEUS LUCAS DA SILVA", "JOANA PEREIRA DOS SANTOS", "RAFAEL ALVES DE MOURA"];
const MAES = ["ROSINETE MAURICIO DA SILVA", "MARIA JOSE PEREIRA", "SANDRA ALVES DE MOURA"];
const PAIS = ["MARCELO DA SILVA", "ANTONIO PEREIRA", "JOSE DE MOURA"];

const ROUTE_KEY = "/dashboard/documents/certificado-medio";

export default function CertificadoMedioFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<FormState>(initial);
  const [comum, setComum] = useState<Disciplina[]>(COMUM_BASE);
  const [notasAbertas, setNotasAbertas] = useState(false);
  const [diversificada, setDiversificada] = useState<Disciplina[]>(DIVERSIFICADA_BASE);
  const [estabs, setEstabs] = useState<Estab[]>([
    { serie: "1º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
    { serie: "2º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
    { serie: "3º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
  ]);
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
        const b = JSON.parse(raw) as Record<string, unknown>;
        setForm((p) => ({
          ...p,
          uf: (b.uf as string) || p.uf,
          govEstado: (b.gov_estado as string) || p.govEstado,
          secretaria: (b.secretaria as string) || p.secretaria,
          escola: (b.escola as string) || p.escola,
          endereco: (b.endereco as string) || p.endereco,
          contato: (b.contato as string) || p.contato,
          portaria: (b.portaria as string) || p.portaria,
          nomeAluno: (b.nome_aluno as string) || "",
          mae: (b.mae as string) || "",
          pai: (b.pai as string) || "",
          sexo: ((b.sexo as string) === "F" ? "F" : "M"),
          dataNasc: (b.data_nasc as string) || "",
          municipioNasc: (b.municipio_nasc as string) || "",
          ufNasc: (b.uf_nasc as string) || p.ufNasc,
          nacionalidade: (b.nacionalidade as string) || p.nacionalidade,
          rg: (b.rg as string) || "",
          orgaoExpedidor: (b.orgao_expedidor as string) || p.orgaoExpedidor,
          serieConclusao: (b.serie_conclusao as string) || p.serieConclusao,
          anoConclusao: (b.ano_conclusao as string) || "",
          turma1: (b.turma1 as string) || p.turma1,
          turma2: (b.turma2 as string) || p.turma2,
          turma3: (b.turma3 as string) || p.turma3,
          dispensaEdFisica: ((b.dispensa_ed_fisica as string) === "SIM" ? "SIM" : "NAO"),
          baseLegal: (b.base_legal as string) || "",
          observacoes: (b.observacoes as string) || "",
          localData: (b.local_data as string) || "",
        }));
        if (Array.isArray(b.disciplinas_comum)) setComum(b.disciplinas_comum as Disciplina[]);
        if (Array.isArray(b.disciplinas_diversificada)) setDiversificada(b.disciplinas_diversificada as Disciplina[]);
        if (Array.isArray(b.estabelecimentos)) setEstabs(b.estabelecimentos as Estab[]);
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [field]: e.target.value }));

  /** Trocar o estado atualiza o cabeçalho e o brasão do documento. */
  const setUf = (uf: string) =>
    setForm((p) => ({ ...p, uf, govEstado: `GOVERNO DO ESTADO DE ${ESTADO_NOMES[uf] || uf}` }));

  /** Os anos das séries são sequenciais a partir do 1º ano. */
  const setAno1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm((p) => {
      const n = Number(v);
      if (v.length === 4 && n > 1900) {
        return { ...p, ano1: v, ano2: String(n + 1), ano3: String(n + 2), anoConclusao: String(n + 2) };
      }
      return { ...p, ano1: v };
    });
  };

  const editDisc = (
    grupo: "comum" | "div",
    idx: number,
    campo: keyof Disciplina,
    valor: string,
  ) => {
    const setter = grupo === "comum" ? setComum : setDiversificada;
    setter((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  };

  const editEstab = (idx: number, campo: keyof Estab, valor: string) =>
    setEstabs((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));

  const fillTest = () => {
    const base = 2016;
    setForm({
      ...initial,
      nomeAluno: pick(NOMES),
      mae: pick(MAES),
      pai: pick(PAIS),
      dataNasc: "16/08/2000",
      municipioNasc: "RECIFE",
      rg: `${rnd(1)}.${rnd(3)}.${rnd(3)}`,
      ano1: String(base),
      ano2: String(base + 1),
      ano3: String(base + 2),
      anoConclusao: String(base + 2),
      localData: "Recife-PE, 03 de Fevereiro de 2019",
    });
    setComum(COMUM_BASE);
    setDiversificada(DIVERSIFICADA_BASE);
    setEstabs([
      { serie: "1º", ano: String(base), estab: initial.escola, cidade: "RECIFE-PE", situacao: "PROGRESSÃO PLENA" },
      { serie: "2º", ano: String(base + 1), estab: initial.escola, cidade: "RECIFE-PE", situacao: "PROGRESSÃO PLENA" },
      { serie: "3º", ano: String(base + 2), estab: initial.escola, cidade: "RECIFE-PE", situacao: "PROGRESSÃO PLENA" },
    ]);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setComum(COMUM_BASE);
    setDiversificada(DIVERSIFICADA_BASE);
    setEstabs([
      { serie: "1º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
      { serie: "2º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
      { serie: "3º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
    ]);
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const brasaoBase64 = await loadBrasaoDataUrl(form.uf);
    return {
      uf: form.uf,
      brasao_base64: brasaoBase64,
      gov_estado: form.govEstado,
      secretaria: form.secretaria,
      escola: form.escola,
      endereco: form.endereco,
      contato: form.contato,
      portaria: form.portaria,

      nome_aluno: form.nomeAluno,
      mae: form.mae,
      pai: form.pai,
      sexo: form.sexo,
      data_nasc: form.dataNasc,
      municipio_nasc: form.municipioNasc,
      uf_nasc: form.ufNasc,
      nacionalidade: form.nacionalidade,
      rg: form.rg,
      orgao_expedidor: form.orgaoExpedidor,
      serie_conclusao: form.serieConclusao,
      ano_conclusao: form.anoConclusao,

      turma1: form.turma1,
      turma2: form.turma2,
      turma3: form.turma3,

      disciplinas_comum: comum,
      disciplinas_diversificada: diversificada,
      estabelecimentos: estabs,

      dispensa_ed_fisica: form.dispensaEdFisica,
      base_legal: form.baseLegal,
      observacoes: form.observacoes,
      local_data: form.localData,
    } as Record<string, unknown>;
  }, [form, comum, diversificada, estabs]);

  const signature = useMemo(
    () => JSON.stringify({ form, comum, diversificada, estabs }),
    [form, comum, diversificada, estabs],
  );

  const canPreview =
    form.nomeAluno.trim().length > 2 &&
    form.mae.trim().length > 2 &&
    form.dataNasc.length === 10 &&
    form.ano1.length === 4;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-certificado-medio-pdf", {
        body: { ...body, preview: true },
      });
      if (seq !== previewSeq.current) return;
      if (error) throw error;
      const result = data?.pdfBase64;
      if (!result) throw new Error(data?.error || "Nenhum PDF retornado");
      setPreviewPdf(result.startsWith("data:") ? result : `data:application/pdf;base64,${result}`);
      // Pré-registra o HTML da versão final (sem marca d'água) em segundo
      // plano, para a geração definitiva já sair do cache ao clicar em Gerar.
      prefetchGeneratePdf("generate-certificado-medio-pdf", { ...body, preview: false });
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setPreviewError(describeError(e));
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }, [buildBody]);

  /* Preview ao vivo com debounce — não navega, não gasta crédito. */
  useEffect(() => {
    if (!autoLive || !canPreview || generating || showReady) return;
    if (generatedSignature.current === signature) return;
    const id = window.setTimeout(() => { void runPreview(); }, 900);
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
        const { data, error } = await invokeGeneratePdf("generate-certificado-medio-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("certificado-medio", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      // 1) Gera o PDF final ANTES de cobrar (reaproveitando o prefetch, se pronto).
      const { data, error } = await invokeGeneratePdf("generate-certificado-medio-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error(data?.error || "pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      // 2) PDF pronto — agora sim cobra o crédito.
      const deduction = await deductCredit(1, "geracao-certificado-medio", creditRef("geracao-certificado-medio", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nomeAluno || "",
        identification: form.rg || "",
        date: form.anoConclusao || "",
        description: `CERTIFICADO + HISTÓRICO - ${form.escola || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "certificado-medio",
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
      console.error("Erro ao gerar Certificado + Histórico:", e);
      toast({
        title: "Erro ao gerar documento",
        description: `Nenhum crédito foi descontado. ${describeError(e)}`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu CERTIFICADO + HISTÓRICO está pronto.\n\nAluno: ${form.nomeAluno}\nEscola: ${form.escola}\nConclusão: ${form.anoConclusao}`;

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";
  const cellCls = "h-8 px-1 text-center text-xs " + inputCls;

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

  const TabelaDisciplinas = ({ grupo, linhas }: { grupo: "comum" | "div"; linhas: Disciplina[] }) => (
    <div className="space-y-2">
      {linhas.map((l, i) => (
        <div key={l.nome} className="rounded-lg border border-border/60 bg-secondary/40 p-2">
          <p className="mb-1.5 text-xs font-bold text-foreground">{l.nome}</p>
          <div className="grid grid-cols-6 gap-1.5">
            <Input value={l.n1} onChange={(e) => editDisc(grupo, i, "n1", e.target.value)} placeholder="Nota 1º" className={cellCls} />
            <Input value={l.c1} onChange={(e) => editDisc(grupo, i, "c1", e.target.value)} placeholder="CH 1º" className={cellCls} />
            <Input value={l.n2} onChange={(e) => editDisc(grupo, i, "n2", e.target.value)} placeholder="Nota 2º" className={cellCls} />
            <Input value={l.c2} onChange={(e) => editDisc(grupo, i, "c2", e.target.value)} placeholder="CH 2º" className={cellCls} />
            <Input value={l.n3} onChange={(e) => editDisc(grupo, i, "n3", e.target.value)} placeholder="Nota 3º" className={cellCls} />
            <Input value={l.c3} onChange={(e) => editDisc(grupo, i, "c3", e.target.value)} placeholder="CH 3º" className={cellCls} />
          </div>
        </div>
      ))}
    </div>
  );

  /* ---------------- painel de preview (reutilizado em 2 posições) ---------------- */
  const previewPanel = (
    <div className="glass flex h-full flex-col overflow-hidden rounded-2xl p-0">
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Certificado + Histórico" />
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
                : "Preencha aluno, mãe, nascimento e ano do 1º ano — a prévia atualiza sozinha enquanto você digita."}
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
            <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">CERTIFICADO + HISTÓRICO — Ensino Médio</h1>
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

          <FormDraftsPanel docType="certificado-medio" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* ESCOLA */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={School} title="Escola (cabeçalho)" />

            <div className="space-y-1.5">
              <FieldLabel required>Estado (brasão do documento)</FieldLabel>
              <select
                value={form.uf}
                onChange={(e) => setUf(e.target.value)}
                className={`h-10 w-full rounded-md border px-3 text-sm ${inputCls}`}
              >
                {ESTADOS_UF.map((uf) => (
                  <option key={uf} value={uf}>{uf} — {ESTADO_NOMES[uf]}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">O brasão do estado aparece no topo do documento.</p>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Governo do estado</FieldLabel>
              <Input value={form.govEstado} onChange={set("govEstado")} className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Secretaria</FieldLabel>
              <Input value={form.secretaria} onChange={set("secretaria")} className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Nome da escola</FieldLabel>
              <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Endereço completo</FieldLabel>
              <Input value={form.endereco} onChange={set("endereco")} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Fone / CNPJ</FieldLabel>
              <Input value={form.contato} onChange={set("contato")} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Portaria de autorização</FieldLabel>
              <Input value={form.portaria} onChange={set("portaria")} className={inputCls} />
            </div>
          </div>

          {/* ALUNO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Aluno" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome do aluno</FieldLabel>
              <Input value={form.nomeAluno} onChange={set("nomeAluno")} className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Mãe</FieldLabel>
                <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Pai</FieldLabel>
                <Input value={form.pai} onChange={set("pai")} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Sexo</FieldLabel>
                <select
                  value={form.sexo}
                  onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value as "M" | "F" }))}
                  className={`h-10 w-full rounded-md border px-3 text-sm ${inputCls}`}
                >
                  <option value="M">Masculino (filho)</option>
                  <option value="F">Feminino (filha)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Nascimento</FieldLabel>
                <Input value={form.dataNasc} onChange={(e) => setForm((p) => ({ ...p, dataNasc: maskDate(e.target.value) }))} placeholder="00/00/0000" inputMode="numeric" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Nacionalidade</FieldLabel>
                <Input value={form.nacionalidade} onChange={set("nacionalidade")} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <FieldLabel required>Natural de</FieldLabel>
                <Input value={form.municipioNasc} onChange={set("municipioNasc")} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>UF</FieldLabel>
                <select
                  value={form.ufNasc}
                  onChange={(e) => setForm((p) => ({ ...p, ufNasc: e.target.value }))}
                  className={`h-10 w-full rounded-md border px-3 text-sm ${inputCls}`}
                >
                  {ESTADOS_UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>RG</FieldLabel>
                <Input value={form.rg} onChange={set("rg")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Órgão expedidor</FieldLabel>
                <Input value={form.orgaoExpedidor} onChange={set("orgaoExpedidor")} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Série de conclusão</FieldLabel>
                <Input value={form.serieConclusao} onChange={set("serieConclusao")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Ano do 1º ano</FieldLabel>
                <Input value={form.ano1} onChange={setAno1} placeholder="2016" inputMode="numeric" className={inputCls} required />
                <p className="text-[11px] text-muted-foreground">2º, 3º e ano de conclusão preenchidos automaticamente.</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <FieldLabel>Turma 1º</FieldLabel>
                <Input value={form.turma1} onChange={set("turma1")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Turma 2º</FieldLabel>
                <Input value={form.turma2} onChange={set("turma2")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Turma 3º</FieldLabel>
                <Input value={form.turma3} onChange={set("turma3")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Conclusão</FieldLabel>
                <Input value={form.anoConclusao} onChange={set("anoConclusao")} className={inputCls} />
              </div>
            </div>
          </div>

          {/* NOTAS (opcional) */}
          <div className="glass space-y-4 p-6">
            <button
              type="button"
              onClick={() => setNotasAbertas((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-left"
            >
              <span className="text-sm font-semibold text-primary">
                Notas e carga horária <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <span className="text-xs text-muted-foreground">{notasAbertas ? "Ocultar" : "Preencher"}</span>
            </button>
            {notasAbertas && (
              <>
                <SectionHeader icon={BookOpen} title="Base Nacional Comum" />
                <TabelaDisciplinas grupo="comum" linhas={comum} />
                <SectionHeader icon={BookOpen} title="Base diversificada" />
                <TabelaDisciplinas grupo="div" linhas={diversificada} />
              </>
            )}
          </div>

          {/* ESTABELECIMENTOS */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={ClipboardList} title="Estabelecimentos de ensino" />
            {estabs.map((e, i) => (
              <div key={e.serie} className="space-y-2 rounded-lg border border-border/60 bg-secondary/40 p-3">
                <p className="text-xs font-bold uppercase text-foreground">{e.serie} Série</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={e.ano} onChange={(ev) => editEstab(i, "ano", ev.target.value)} placeholder="Ano" className={inputCls} />
                  <Input value={e.cidade} onChange={(ev) => editEstab(i, "cidade", ev.target.value)} placeholder="Cidade/Estado" className={inputCls} />
                  <Input value={e.situacao} onChange={(ev) => editEstab(i, "situacao", ev.target.value)} placeholder="Situação" className={inputCls} />
                </div>
                <Input value={e.estab} onChange={(ev) => editEstab(i, "estab", ev.target.value)} placeholder="Nome do estabelecimento" className={inputCls} />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Dispensa de Educação Física</FieldLabel>
                <select
                  value={form.dispensaEdFisica}
                  onChange={(e) => setForm((p) => ({ ...p, dispensaEdFisica: e.target.value as "SIM" | "NAO" }))}
                  className={`h-10 w-full rounded-md border px-3 text-sm ${inputCls}`}
                >
                  <option value="NAO">Não</option>
                  <option value="SIM">Sim</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Base legal</FieldLabel>
                <Input value={form.baseLegal} onChange={set("baseLegal")} className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Observações</FieldLabel>
              <Input value={form.observacoes} onChange={set("observacoes")} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Local e data</FieldLabel>
              <Input value={form.localData} onChange={set("localData")} placeholder="Recife-PE, 03 de Fevereiro de 2019" className={inputCls} />
            </div>
          </div>

          {/* PRÉVIA — só no mobile/tablet, entre o formulário e o botão */}
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
        fileName="certificado-historico.pdf"
        title="Certificado Historico"
        message={mensagem}
      />
    </div>
  );
}
