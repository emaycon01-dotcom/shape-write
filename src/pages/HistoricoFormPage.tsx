import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GraduationCap, School, Loader2, FlaskConical, Trash2, History, FileText, User, CalendarRange,
  Eye, CreditCard, ShieldCheck, ArrowLeft, RefreshCw, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadHistoricoFieldPositions } from "@/lib/historico-align";
import templateHistoricoUrl from "@/assets/template-historico-bg-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskPhone } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { ESTADO_NOMES, ESTADOS_UF, loadBrasaoDataUrl } from "@/lib/brasoes-estados";
import { pick, rnd } from "@/lib/random";
interface HistoricoFormData {
  uf: string;
  govEstado: string;
  secretaria: string;
  diretoria: string;
  escola: string;
  atoLegal: string;
  endereco: string;
  numero: string;
  bairro: string;
  municipioEscola: string;
  cep: string;
  telefone: string;

  nomeAluno: string;
  rgRne: string;
  ra: string;
  municipioNasc: string;
  estadoNasc: string;
  pais: string;
  dataNasc: string;
  mae: string;

  ano1: string;
  ano2: string;
  ano3: string;

  efAno: string;
  efEstab: string;
  efMun: string;
  efUf: string;

  e1Estab: string;
  e1Mun: string;
  e1Uf: string;
  e2Estab: string;
  e2Mun: string;
  e2Uf: string;
  e3Estab: string;
  e3Mun: string;
  e3Uf: string;

  serieConclusao: string;
}

const initial: HistoricoFormData = {
  uf: "AL",
  govEstado: "GOVERNO DO ESTADO DE ALAGOAS",
  secretaria: "SECRETARIA DE ESTADO DA EDUCAÇÃO",
  diretoria: "DIRETORIA DE ENSINO – REGIÃO DE AL",
  escola: "Escola Estadual Professora Maria Avelina Do Carmo",
  atoLegal: "124.761.98 – ADR",
  endereco: "R. Isac Pereira Neto",
  numero: "395-441",
  bairro: "Centro",
  municipioEscola: "Traipu",
  cep: "57370-000",
  telefone: "(82) 3536-1361",

  nomeAluno: "",
  rgRne: "",
  ra: "",
  municipioNasc: "",
  estadoNasc: "AL",
  pais: "Brasil",
  dataNasc: "",
  mae: "",

  ano1: "",
  ano2: "",
  ano3: "",

  efAno: "",
  efEstab: "",
  efMun: "",
  efUf: "AL",

  e1Estab: "",
  e1Mun: "",
  e1Uf: "AL",
  e2Estab: "",
  e2Mun: "",
  e2Uf: "AL",
  e3Estab: "",
  e3Mun: "",
  e3Uf: "AL",

  serieConclusao: "3ª",
};

const NOMES = [
  "Claudeane Damásio Silva",
  "Jonatas Ferreira de Lima",
  "Maria Eduarda Rocha Santos",
  "Vinícius Barbosa Nogueira",
];
const MAES = ["Ana Paula santeiro da Silva", "Rita de Cássia Ferreira", "Josefa Rocha Santos"];


const ROUTE_KEY = "/dashboard/documents/historico-escolar";

export default function HistoricoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "historico-escolar").slice(0, 6);

  const [form, setForm] = useState<HistoricoFormData>(initial);
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
          uf: b.uf || p.uf,
          govEstado: b.gov_estado || p.govEstado,
          secretaria: b.secretaria || p.secretaria,
          diretoria: b.diretoria || p.diretoria,
          escola: b.escola || p.escola,
          atoLegal: b.ato_legal || p.atoLegal,
          endereco: b.endereco || p.endereco,
          numero: b.numero || p.numero,
          bairro: b.bairro || p.bairro,
          municipioEscola: b.municipio_escola || p.municipioEscola,
          cep: b.cep || p.cep,
          telefone: b.telefone || p.telefone,
          nomeAluno: b.nome_aluno || "",
          rgRne: b.rg_rne || "",
          ra: b.ra || "",
          municipioNasc: b.municipio_nasc || "",
          estadoNasc: b.estado_nasc || p.estadoNasc,
          pais: b.pais || p.pais,
          dataNasc: b.data_nasc || "",
          mae: b.mae || "",
          ano1: b.ano1 || "",
          ano2: b.ano2 || "",
          ano3: b.ano3 || "",
          efAno: b.ef_ano || "",
          efEstab: b.ef_estab || "",
          efMun: b.ef_mun || "",
          efUf: b.ef_uf || p.efUf,
          e1Estab: b.e1_estab || "",
          e1Mun: b.e1_mun || "",
          e1Uf: b.e1_uf || p.e1Uf,
          e2Estab: b.e2_estab || "",
          e2Mun: b.e2_mun || "",
          e2Uf: b.e2_uf || p.e2Uf,
          e3Estab: b.e3_estab || "",
          e3Mun: b.e3_mun || "",
          e3Uf: b.e3_uf || p.e3Uf,
          serieConclusao: b.serie_conclusao || p.serieConclusao,
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof HistoricoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof HistoricoFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  /** Os três anos do Ensino Médio são sequenciais a partir do 1º ano. */
  const setAno1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm((p) => {
      const n = Number(v);
      if (v.length === 4 && n > 1900) {
        return { ...p, ano1: v, ano2: String(n + 1), ano3: String(n + 2), efAno: String(n - 1) };
      }
      return { ...p, ano1: v };
    });
  };

  /** Trocar o estado atualiza cabeçalho, diretoria e o brasão do documento. */
  const setUf = (uf: string) =>
    setForm((p) => ({
      ...p,
      uf,
      govEstado: `GOVERNO DO ESTADO DE ${ESTADO_NOMES[uf] || uf}`,
      diretoria: `DIRETORIA DE ENSINO – REGIÃO DE ${uf}`,
    }));

  const fillTest = () => {
    const base = 2013;
    setForm({
      ...initial,
      nomeAluno: pick(NOMES),
      rgRne: `${rnd(2)}.${rnd(3)}.${rnd(3)}-${rnd(1)}`,
      ra: `${rnd(9)}-${rnd(1)}`,
      municipioNasc: "Batalha",
      dataNasc: "03/04/1995",
      mae: pick(MAES),
      ano1: String(base),
      ano2: String(base + 1),
      ano3: String(base + 2),
      efAno: String(base - 2),
      efEstab: "Escola municipal de educação básica Francisco Mangabeiras",
      efMun: "Traipu",
      e1Estab: "Escola estadual Professora Maria Avelina do Carmo.",
      e1Mun: "Traipu",
      e2Estab: "Escola estadual Professora Maria Avelina do Carmo.",
      e2Mun: "Traipu",
      e3Estab: "Escola estadual Professora Maria Avelina do Carmo.",
      e3Mun: "Traipu",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateHistoricoUrl);
    const brasaoBase64 = await loadBrasaoDataUrl(form.uf);
    return {
      uf: form.uf,
      brasao_base64: brasaoBase64,
      gov_estado: form.govEstado,
      secretaria: form.secretaria,
      diretoria: form.diretoria,
      escola: form.escola,
      ato_legal: form.atoLegal,
      endereco: form.endereco,
      numero: form.numero,
      bairro: form.bairro,
      municipio_escola: form.municipioEscola,
      cep: form.cep,
      telefone: form.telefone,

      nome_aluno: form.nomeAluno,
      rg_rne: form.rgRne,
      ra: form.ra,
      municipio_nasc: form.municipioNasc,
      estado_nasc: form.estadoNasc,
      pais: form.pais,
      data_nasc: form.dataNasc,
      mae: form.mae,

      ano1: form.ano1,
      ano2: form.ano2,
      ano3: form.ano3,

      ef_ano: form.efAno,
      ef_estab: form.efEstab,
      ef_mun: form.efMun,
      ef_uf: form.efUf,

      e1_ano: form.ano1,
      e1_estab: form.e1Estab,
      e1_mun: form.e1Mun,
      e1_uf: form.e1Uf,

      e2_ano: form.ano2,
      e2_estab: form.e2Estab,
      e2_mun: form.e2Mun,
      e2_uf: form.e2Uf,

      e3_ano: form.ano3,
      e3_estab: form.e3Estab,
      e3_mun: form.e3Mun,
      e3_uf: form.e3Uf,

      serie_conclusao: form.serieConclusao,
      ano_conclusao: form.ano3,

      template_base64: templateBase64,
      field_positions: loadHistoricoFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.nomeAluno.trim().length > 2 &&
    form.rgRne.trim().length > 3 &&
    form.ano1.length === 4;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-historico-pdf", {
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

  /* ---------------- documento final ---------------- */
  const handleGenerate = async () => {
    if (!user) return;

    if (isEditMode && editState?.editDocId) {
      setGenerating(true);
      try {
        const body = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-historico-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("historico", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-historico-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-historico", creditRef("geracao-historico", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nomeAluno || "",
        identification: form.rgRne || form.ra || "",
        date: form.ano3 || "",
        description: `HISTÓRICO + CERTIFICADO - ${form.escola || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "historico-escolar",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu HISTÓRICO + CERTIFICADO está pronto.\n\nAluno: ${form.nomeAluno}\nEscola: ${form.escola}\nConclusão: ${form.ano3}`;

  const inputCls = "h-11 rounded-xl bg-secondary/70 border-border/70 text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-primary/40";

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

  const LinhaEstudo = ({
    titulo,
    ano,
    estab,
    mun,
    uf,
    onEstab,
    onMun,
    onUf,
  }: {
    titulo: string;
    ano: string;
    estab: string;
    mun: string;
    uf: string;
    onEstab: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMun: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUf: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <div className="space-y-2 rounded-xl border border-border/60 bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground">{titulo}</p>
        <span className="text-[11px] text-muted-foreground">Ano: {ano || "—"}</span>
      </div>
      <Input value={estab} onChange={onEstab} placeholder="Estabelecimento de ensino" className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <Input value={mun} onChange={onMun} placeholder="Município" className={`col-span-2 ${inputCls}`} />
        <Input value={uf} onChange={onUf} placeholder="UF" maxLength={2} className={inputCls} />
      </div>
    </div>
  );

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do HISTÓRICO + CERTIFICADO" />
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
                : "Preencha nome do aluno, RG e 1ª série — a prévia atualiza sozinha enquanto você digita."}
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
                <GraduationCap className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight text-foreground">HISTÓRICO + CERTIFICADO — Ensino Médio</h1>
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
          <FormDraftsPanel docType="historico" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

          {/* ESCOLA */}
          <div className={card}>
            <SectionHeader icon={School} title="Escola (cabeçalho)" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Estado (brasão do documento)</FieldLabel>
                <select
                  value={form.uf}
                  onChange={(e) => setUf(e.target.value)}
                  className={`h-11 w-full rounded-xl border px-3 text-sm ${inputCls}`}
                >
                  {ESTADOS_UF.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf} — {ESTADO_NOMES[uf]}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  O brasão do estado aparece no canto superior esquerdo do preview e do PDF final.
                </p>
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Governo do estado</FieldLabel>
                <Input value={form.govEstado} onChange={set("govEstado")} className={inputCls} required />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel required>Secretaria</FieldLabel>
                  <Input value={form.secretaria} onChange={set("secretaria")} className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Diretoria de ensino</FieldLabel>
                  <Input value={form.diretoria} onChange={set("diretoria")} className={inputCls} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Nome da escola</FieldLabel>
                <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Ato legal de criação</FieldLabel>
                <Input value={form.atoLegal} onChange={set("atoLegal")} placeholder="124.761.98 – ADR" className={inputCls} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <FieldLabel>Endereço</FieldLabel>
                  <Input value={form.endereco} onChange={set("endereco")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Nº</FieldLabel>
                  <Input value={form.numero} onChange={set("numero")} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Bairro</FieldLabel>
                  <Input value={form.bairro} onChange={set("bairro")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Município</FieldLabel>
                  <Input value={form.municipioEscola} onChange={set("municipioEscola")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>CEP</FieldLabel>
                  <Input value={form.cep} onChange={set("cep")} className={inputCls} />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Telefone</FieldLabel>
                <Input value={form.telefone} onChange={setMask("telefone", maskPhone)} inputMode="numeric" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ALUNO */}
          <div className={card}>
            <SectionHeader icon={User} title="Aluno" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Nome do aluno</FieldLabel>
                <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="Ex: Claudeane Damásio Silva" className={inputCls} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel required>RG / RNE</FieldLabel>
                  <Input value={form.rgRne} onChange={set("rgRne")} placeholder="56.191.320-1" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>RA</FieldLabel>
                  <Input value={form.ra} onChange={set("ra")} placeholder="284193875-1" className={inputCls} required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel required>Município de nascimento</FieldLabel>
                  <Input value={form.municipioNasc} onChange={set("municipioNasc")} className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Estado</FieldLabel>
                  <Input value={form.estadoNasc} onChange={set("estadoNasc")} maxLength={2} className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>País</FieldLabel>
                  <Input value={form.pais} onChange={set("pais")} className={inputCls} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel required>Data de nascimento</FieldLabel>
                  <Input value={form.dataNasc} onChange={setMask("dataNasc", maskDate)} inputMode="numeric" placeholder="03/04/1995" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Mãe</FieldLabel>
                  <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
                </div>
              </div>
            </div>
          </div>

          {/* ANOS */}
          <div className={card}>
            <SectionHeader icon={CalendarRange} title="Anos letivos" />
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel required>1ª Série</FieldLabel>
                  <Input value={form.ano1} onChange={setAno1} inputMode="numeric" placeholder="2013" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>2ª Série</FieldLabel>
                  <Input value={form.ano2} onChange={set("ano2")} inputMode="numeric" placeholder="2014" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>3ª Série</FieldLabel>
                  <Input value={form.ano3} onChange={set("ano3")} inputMode="numeric" placeholder="2015" className={inputCls} required />
                </div>
              </div>
              <p className="rounded-xl bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Ao digitar o ano da 1ª série, os demais anos são preenchidos automaticamente. As notas e cargas horárias já
                fazem parte do modelo do documento.
              </p>

              <div className="space-y-1.5">
                <FieldLabel required>Série de conclusão</FieldLabel>
                <Input value={form.serieConclusao} onChange={set("serieConclusao")} placeholder="3ª" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* ESTUDOS REALIZADOS */}
          <div className={card}>
            <SectionHeader icon={GraduationCap} title="Estudos realizados" />
            <div className="space-y-3">
              <div className="space-y-2 rounded-xl border border-border/60 bg-secondary/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground">Ensino Fundamental — 8ª Série / 9º Ano</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input value={form.efAno} onChange={set("efAno")} inputMode="numeric" placeholder="Ano" className={inputCls} />
                  <Input value={form.efMun} onChange={set("efMun")} placeholder="Município" className={inputCls} />
                  <Input value={form.efUf} onChange={set("efUf")} placeholder="UF" maxLength={2} className={inputCls} />
                </div>
                <Input value={form.efEstab} onChange={set("efEstab")} placeholder="Estabelecimento de ensino" className={inputCls} />
              </div>

              <LinhaEstudo
                titulo="Ensino Médio — 1ª Série"
                ano={form.ano1}
                estab={form.e1Estab}
                mun={form.e1Mun}
                uf={form.e1Uf}
                onEstab={set("e1Estab")}
                onMun={set("e1Mun")}
                onUf={set("e1Uf")}
              />
              <LinhaEstudo
                titulo="Ensino Médio — 2ª Série"
                ano={form.ano2}
                estab={form.e2Estab}
                mun={form.e2Mun}
                uf={form.e2Uf}
                onEstab={set("e2Estab")}
                onMun={set("e2Mun")}
                onUf={set("e2Uf")}
              />
              <LinhaEstudo
                titulo="Ensino Médio — 3ª Série"
                ano={form.ano3}
                estab={form.e3Estab}
                mun={form.e3Mun}
                uf={form.e3Uf}
                onEstab={set("e3Estab")}
                onMun={set("e3Mun")}
                onUf={set("e3Uf")}
              />
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
              <p className="text-sm text-muted-foreground">Nenhum histórico escolar gerado ainda.</p>
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
        fileName="historico-escolar.pdf"
        title="Historico Escolar"
        message={mensagem}
      />
    </div>
  );
}
