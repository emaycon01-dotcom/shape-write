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
  ChevronDown, ChevronRight, ListChecks, CalendarClock, Award, History,
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

type Nota = { area: string; componente: string; n1: string; n2: string; n3: string; ch: string };
type Estudo = { nivel: string; termo: string; ano: string; unidade: string; municipio: string; uf: string };

const MODALIDADES = [
  "PRESENCIAL - NOTURNO",
  "PRESENCIAL - MATUTINO",
  "PRESENCIAL - VESPERTINO",
  "SEMIPRESENCIAL",
  "EAD - EDUCAÇÃO A DISTÂNCIA",
];

const AREA_LING = "Linguagens, Códigos e suas Tecnologias";
const AREA_NAT = "Ciências da Natureza, Matemática e suas Tecnologias";
const AREA_HUM = "Ciências Humanas e suas Tecnologias";

const NOTAS_PADRAO: Nota[] = [
  { area: AREA_LING, componente: "Língua Portuguesa e Literatura", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_LING, componente: "Arte", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_LING, componente: "Educação Física", n1: "", n2: "", n3: "", ch: "60" },
  { area: AREA_NAT, componente: "Matemática", n1: "", n2: "", n3: "", ch: "60" },
  { area: AREA_NAT, componente: "Física", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_NAT, componente: "Química", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_NAT, componente: "Biologia", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_HUM, componente: "História", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_HUM, componente: "Geografia", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_HUM, componente: "Filosofia", n1: "", n2: "", n3: "", ch: "60" },
  { area: AREA_HUM, componente: "Sociologia", n1: "", n2: "", n3: "", ch: "40" },
];

const NOTAS_TESTE = ["7/6/6", "7/6/7", "DT/DT/DT", "6/6/7", "5/5/7", "6/7/5", "8/8/7", "9/7/8", "6/5/5", "5/8/7", "9/9/9"];

interface FormState {
  estado: string;
  coordenadoria: string;
  diretoria: string;
  escola: string;
  endereco: string;
  cep: string;
  telefone: string;
  modalidade: string;
  fundamentoLegal: string;
  nomeAluno: string;
  rg: string;
  municipioNascimento: string;
  ufNascimento: string;
  pais: string;
  dataNascimento: string;
  apoioCurricular: string;
  chBase: string;
  chDiversificada: string;
  chTotal: string;
  observacoes: string;
  gdae: string;
  anoConclusao: string;
  dataCertificado: string;
  secretarioNome: string;
  secretarioRg: string;
  diretorNome: string;
  diretorRg: string;
}

const initial: FormState = {
  estado: "SP",
  coordenadoria: "COORDENADORIA DE ENSINO DO ESTADO DE SÃO PAULO",
  diretoria: "",
  escola: 'E.E. "Profª. GEORGINA HELENA FORTAREL"',
  endereco: "Rua Flor de Melo nº 30 – Parque Internacional, Campo Limpo Paulista-SP",
  cep: "13232-524",
  telefone: "(11) 4039-3595",
  modalidade: MODALIDADES[0],
  fundamentoLegal:
    "Fundamento Legal: Lei Federal nº 9394/96, Artigo 37 e 38; Resoluções CNE/CEB nº 1/2000; Del. CEE/SP nº 9/2000 e Resolução SEE/SP nº 1/2001 e Resolução SEE nº 2/2006.",
  nomeAluno: "",
  rg: "",
  municipioNascimento: "",
  ufNascimento: "SP",
  pais: "BRASIL",
  dataNascimento: "",
  apoioCurricular: "Língua Portuguesa e Literatura",
  chBase: "320",
  chDiversificada: "",
  chTotal: "320",
  observacoes: "DT - DISPENSA POR LEI N° 10.793/2003",
  gdae: "",
  anoConclusao: "",
  dataCertificado: "",
  secretarioNome: "",
  secretarioRg: "",
  diretorNome: "",
  diretorRg: "",
};

const estudoVazio = (): Estudo => ({ nivel: "Ensino Médio", termo: "", ano: "", unidade: "", municipio: "", uf: "SP" });

const ROUTE_KEY = "/dashboard/documents/historico-eja";

export default function HistoricoEjaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "historico-eja").slice(0, 6);

  const [form, setForm] = useState<FormState>(initial);
  const [notas, setNotas] = useState<Nota[]>(NOTAS_PADRAO);
  const [estudos, setEstudos] = useState<Estudo[]>([
    { nivel: "Ensino Fundamental", termo: "8º", ano: "", unidade: "", municipio: "", uf: "SP" },
    { nivel: "Ensino Médio", termo: "1º TERMO", ano: "", unidade: "", municipio: "", uf: "SP" },
    { nivel: "Ensino Médio", termo: "2º TERMO", ano: "", unidade: "", municipio: "", uf: "SP" },
    { nivel: "Ensino Médio", termo: "3º TERMO", ano: "", unidade: "", municipio: "", uf: "SP" },
  ]);
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
          coordenadoria: b.coordenadoria || p.coordenadoria,
          diretoria: b.diretoria || p.diretoria,
          escola: b.escola || p.escola,
          endereco: b.endereco || p.endereco,
          cep: b.cep || p.cep,
          telefone: b.telefone || p.telefone,
          modalidade: b.modalidade || p.modalidade,
          fundamentoLegal: b.fundamento_legal || p.fundamentoLegal,
          nomeAluno: b.nome_aluno || "",
          rg: b.rg || "",
          municipioNascimento: b.municipio_nascimento || "",
          ufNascimento: b.uf_nascimento || p.ufNascimento,
          pais: b.pais || p.pais,
          dataNascimento: b.data_nascimento || "",
          apoioCurricular: b.apoio_curricular || p.apoioCurricular,
          chBase: b.ch_base || p.chBase,
          chDiversificada: b.ch_diversificada || p.chDiversificada,
          chTotal: b.ch_total || p.chTotal,
          observacoes: b.observacoes || p.observacoes,
          gdae: b.gdae || "",
          anoConclusao: b.ano_conclusao || "",
          dataCertificado: b.data_certificado || "",
          secretarioNome: b.secretario_nome || "",
          secretarioRg: b.secretario_rg || "",
          diretorNome: b.diretor_nome || "",
          diretorRg: b.diretor_rg || "",
        }));
        try { const n = JSON.parse(b.notas_json || "[]"); if (Array.isArray(n) && n.length) setNotas(n); } catch { /* ignora */ }
        try { const t = JSON.parse(b.estudos_json || "[]"); if (Array.isArray(t) && t.length) setEstudos(t); } catch { /* ignora */ }
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

  const setEstudo = (index: number, key: keyof Estudo, value: string) =>
    setEstudos((p) => p.map((t, i) => (i === index ? { ...t, [key]: value } : t)));

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
      nomeAluno: "MARIA ZILDA MANOEL",
      rg: "33.531.642-6/SP",
      municipioNascimento: "CAMPO LIMPO PAULISTA",
      dataNascimento: "07/07/1972",
      gdae: "40147122/2009",
      anoConclusao: "2009",
      dataCertificado: "14 de Novembro de 2009",
      secretarioNome: "ROSANA MARIA DA ROCHA",
      secretarioRg: "14.298.788-X",
      diretorNome: "ROSI DE CARDOSO CINTO",
      diretorRg: "33.198.331-X",
    });
    setNotas(NOTAS_PADRAO.map((n, i) => {
      const [n1, n2, n3] = (NOTAS_TESTE[i] || "").split("/");
      return { ...n, n1: n1 || "", n2: n2 || "", n3: n3 || "" };
    }));
    setEstudos([
      { nivel: "Ensino Fundamental", termo: "8º", ano: "2006", unidade: 'E.E. "Profª. Georgina Helena Fortarel"', municipio: "Campo Limpo Pta", uf: "SP" },
      { nivel: "Ensino Médio", termo: "1º TERMO", ano: "2007", unidade: 'E.E. "Profª. Georgina Helena Fortarel"', municipio: "Campo Limpo Pta", uf: "SP" },
      { nivel: "Ensino Médio", termo: "2º TERMO", ano: "2008", unidade: 'E.E. "Profª. Georgina Helena Fortarel"', municipio: "Campo Limpo Pta", uf: "SP" },
      { nivel: "Ensino Médio", termo: "3º TERMO", ano: "2009", unidade: 'E.E. "Profª. Georgina Helena Fortarel"', municipio: "Campo Limpo Pta", uf: "SP" },
    ]);
    setShowNotas(true);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setNotas(NOTAS_PADRAO);
    setEstudos([estudoVazio()]);
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
      coordenadoria: form.coordenadoria,
      diretoria: form.diretoria,
      escola: form.escola,
      endereco: form.endereco,
      cep: form.cep,
      telefone: form.telefone,
      modalidade: form.modalidade,
      fundamento_legal: form.fundamentoLegal,
      nome_aluno: form.nomeAluno,
      rg: form.rg,
      municipio_nascimento: form.municipioNascimento,
      uf_nascimento: form.ufNascimento,
      pais: form.pais,
      data_nascimento: form.dataNascimento,
      apoio_curricular: form.apoioCurricular,
      ch_base: form.chBase,
      ch_diversificada: form.chDiversificada,
      ch_total: form.chTotal,
      observacoes: form.observacoes,
      gdae: form.gdae,
      ano_conclusao: form.anoConclusao,
      data_certificado: form.dataCertificado,
      secretario_nome: form.secretarioNome,
      secretario_rg: form.secretarioRg,
      diretor_nome: form.diretorNome,
      diretor_rg: form.diretorRg,
      notas_json: JSON.stringify(notas),
      estudos_json: JSON.stringify(estudos.filter((t) => t.ano || t.termo || t.unidade)),
      template_brasao_base64: brasao,
      assinatura_base64: assinatura,
    } as Record<string, unknown>;
  }, [form, notas, estudos, assinatura]);

  const signature = useMemo(
    () => JSON.stringify({ form, notas, estudos, assinatura }),
    [form, notas, estudos, assinatura],
  );

  const canPreview =
    form.nomeAluno.trim().length > 2 &&
    form.rg.trim().length > 3 &&
    form.anoConclusao.trim().length === 4;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-historico-eja-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-historico-eja-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("historico-eja", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-historico-eja-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-historico-eja", creditRef("geracao-historico-eja", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nomeAluno || "",
        identification: form.rg || "",
        date: form.dataNascimento || "",
        description: `HISTÓRICO/CERTIFICADO EJA - ${form.escola || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "historico-eja",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu HISTÓRICO/CERTIFICADO EJA está pronto.\n\nAluno: ${form.nomeAluno}\nEscola: ${form.escola}\nConclusão: ${form.anoConclusao}`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do HISTÓRICO/CERTIFICADO EJA" />
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
                : "Preencha nome do aluno, RG e ano de conclusão — a prévia atualiza sozinha enquanto você digita."}
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
                <h1 className="font-display text-2xl font-bold leading-tight text-foreground">HISTÓRICO/CERTIFICADO EJA</h1>
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
          <FormDraftsPanel docType="historico-eja" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

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
                <FieldLabel>Coordenadoria de ensino</FieldLabel>
                <Input value={form.coordenadoria} onChange={set("coordenadoria")} className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Diretoria de ensino</FieldLabel>
                <Input value={form.diretoria} onChange={set("diretoria")} placeholder="Jundiaí" className={inputCls} />
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
                  <FieldLabel>CEP</FieldLabel>
                  <Input value={form.cep} onChange={set("cep")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Telefone</FieldLabel>
                  <Input value={form.telefone} onChange={set("telefone")} className={inputCls} />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Modalidade / turno</FieldLabel>
                <select value={form.modalidade} onChange={(e) => setForm((p) => ({ ...p, modalidade: e.target.value }))} className={selectCls}>
                  {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ALUNO */}
          <div className={card}>
            <SectionHeader icon={User} title="Dados do aluno" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Nome do aluno (a)</FieldLabel>
                <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="MARIA ZILDA MANOEL" className={inputCls} required />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel required>R.G.</FieldLabel>
                  <Input value={form.rg} onChange={set("rg")} placeholder="33.531.642-6/SP" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Data de nascimento</FieldLabel>
                  <Input value={form.dataNascimento} onChange={setMask("dataNascimento", maskDate)} inputMode="numeric" placeholder="07/07/1972" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Município de nascimento</FieldLabel>
                  <Input value={form.municipioNascimento} onChange={set("municipioNascimento")} className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Estado (nascimento)</FieldLabel>
                  <select value={form.ufNascimento} onChange={(e) => setForm((p) => ({ ...p, ufNascimento: e.target.value }))} className={selectCls}>
                    {ESTADOS_UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>País</FieldLabel>
                  <Input value={form.pais} onChange={set("pais")} className={inputCls} />
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
                  <span className="block text-sm font-bold uppercase tracking-wide text-foreground">Notas por termo (opcional)</span>
                  <span className="block text-xs text-muted-foreground">
                    Deixe em branco para o documento sair com traços (–). Use "DT" para dispensa.
                  </span>
                </span>
              </span>
              {showNotas ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
            </button>

            {showNotas && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-[1fr_52px_52px_52px_56px] gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
                  <span>Componente</span><span className="text-center">1º</span><span className="text-center">2º</span><span className="text-center">3º</span><span className="text-center">C.H.</span>
                </div>
                <div className="space-y-2">
                  {notas.map((nota, i) => (
                    <div key={`${nota.componente}-${i}`} className="grid grid-cols-[1fr_52px_52px_52px_56px] items-center gap-2">
                      <Input value={nota.componente} onChange={(e) => setNota(i, "componente", e.target.value)} className={`${inputCls} h-9 text-xs`} />
                      <Input value={nota.n1} onChange={(e) => setNota(i, "n1", e.target.value)} className={`${inputCls} h-9 text-center text-xs`} />
                      <Input value={nota.n2} onChange={(e) => setNota(i, "n2", e.target.value)} className={`${inputCls} h-9 text-center text-xs`} />
                      <Input value={nota.n3} onChange={(e) => setNota(i, "n3", e.target.value)} className={`${inputCls} h-9 text-center text-xs`} />
                      <Input value={nota.ch} onChange={(e) => setNota(i, "ch", e.target.value)} className={`${inputCls} h-9 text-center text-xs`} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-border/50 pt-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <FieldLabel>C.H. Base Nacional Comum</FieldLabel>
                    <Input value={form.chBase} onChange={set("chBase")} className={`${inputCls} h-9 text-xs`} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>C.H. Parte Diversificada</FieldLabel>
                    <Input value={form.chDiversificada} onChange={set("chDiversificada")} className={`${inputCls} h-9 text-xs`} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>C.H. Total</FieldLabel>
                    <Input value={form.chTotal} onChange={set("chTotal")} className={`${inputCls} h-9 text-xs`} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Disciplina de apoio curricular</FieldLabel>
                  <Input value={form.apoioCurricular} onChange={set("apoioCurricular")} className={`${inputCls} h-9 text-xs`} />
                </div>
              </div>
            )}
          </div>

          {/* ESTUDOS REALIZADOS */}
          <div className={card}>
            <SectionHeader icon={CalendarClock} title="Estudos realizados" />
            <div className="space-y-3">
              {estudos.map((estudo, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border/60 bg-secondary/40 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground">Linha {i + 1}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input value={estudo.nivel} onChange={(e) => setEstudo(i, "nivel", e.target.value)} placeholder="Ensino Médio" className={`${inputCls} h-9 text-xs`} />
                    <Input value={estudo.termo} onChange={(e) => setEstudo(i, "termo", e.target.value)} placeholder="1º TERMO" className={`${inputCls} h-9 text-xs`} />
                    <Input value={estudo.ano} onChange={(e) => setEstudo(i, "ano", e.target.value)} placeholder="2007" className={`${inputCls} h-9 text-xs`} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_60px]">
                    <Input value={estudo.unidade} onChange={(e) => setEstudo(i, "unidade", e.target.value)} placeholder="Estabelecimento de ensino" className={`${inputCls} h-9 text-xs`} />
                    <Input value={estudo.municipio} onChange={(e) => setEstudo(i, "municipio", e.target.value)} placeholder="Município" className={`${inputCls} h-9 text-xs`} />
                    <select value={estudo.uf} onChange={(e) => setEstudo(i, "uf", e.target.value)} className={`${selectCls} h-9 text-xs`}>
                      {ESTADOS_UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setEstudos((p) => [...p, estudoVazio()])}>
                  + Adicionar linha
                </Button>
                {estudos.length > 1 && (
                  <Button type="button" variant="outline" size="sm" className="text-xs text-destructive" onClick={() => setEstudos((p) => p.slice(0, -1))}>
                    Remover última
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Observações</FieldLabel>
                <Input value={form.observacoes} onChange={set("observacoes")} className={inputCls} />
              </div>
            </div>
          </div>

          {/* CERTIFICADO */}
          <div className={card}>
            <SectionHeader icon={Award} title="Certificado de conclusão" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Nº de concluinte GDAE</FieldLabel>
                <Input value={form.gdae} onChange={set("gdae")} placeholder="40147122/2009" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Ano de conclusão</FieldLabel>
                <Input value={form.anoConclusao} onChange={set("anoConclusao")} placeholder="2009" className={inputCls} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel>Data do certificado (por extenso)</FieldLabel>
                <Input value={form.dataCertificado} onChange={set("dataCertificado")} placeholder="14 de Novembro de 2009" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ASSINATURAS */}
          <div className={card}>
            <SectionHeader icon={PenLine} title="Assinaturas do rodapé" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Nome do secretário</FieldLabel>
                  <Input value={form.secretarioNome} onChange={set("secretarioNome")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>R.G. do secretário</FieldLabel>
                  <Input value={form.secretarioRg} onChange={set("secretarioRg")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Nome do diretor</FieldLabel>
                  <Input value={form.diretorNome} onChange={set("diretorNome")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>R.G. do diretor</FieldLabel>
                  <Input value={form.diretorRg} onChange={set("diretorRg")} className={inputCls} />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Envie a imagem com as assinaturas/carimbo. Ela é aplicada sobre a faixa do rodapé, como no modelo oficial.
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
        fileName="historico-certificado-eja.pdf"
        title="Historico Certificado Eja"
        message={mensagem}
      />
    </div>
  );
}
