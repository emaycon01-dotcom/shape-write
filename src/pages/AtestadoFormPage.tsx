import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Stethoscope, User, Building2, Loader2, FlaskConical, Trash2, History, FileText,
  Sparkles, Eye, CreditCard, ShieldCheck, ArrowLeft, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadAtestadoFieldPositions } from "@/lib/atestado-align";
import templateAtestadoUrl from "@/assets/template-atestado-bg-hq.jpg";
import { loadTemplateBase64, loadTemplateObjectUrl } from "@/lib/template-cache";
import { splitEndereco } from "@/lib/atestado-endereco";
import { maskCPF, maskDate, maskDigits, maskTimeSec } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { pick, rnd, rnd60 } from "@/lib/random";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";

const MEDICO = "Dr. Abdo";
const CRM = "CRM/SP 123456";
const ESPECIALIDADE = "Clínico Geral";

interface AtestadoFormData {
  paciente: string;
  docTipo: "cpf" | "cns";
  docNumero: string;
  unidade: string;
  endereco: string;
  dataAtendimento: string;
  horaAtendimento: string;
  dias: string;
  cid: string;
  nascimento: string;
  uf: string;
}

const initial: AtestadoFormData = {
  paciente: "",
  docTipo: "cpf",
  docNumero: "",
  unidade: "UPA 24h Itaquera",
  endereco: "Av. Miguel Ignácio Curi, 41\nVila Carmosina - São Paulo – SP\nCEP: 08295-005",
  dataAtendimento: "",
  horaAtendimento: "",
  dias: "1",
  cid: "",
  nascimento: "",
  uf: "SP",
};

const NOMES = [
  "TATIANI RODRIGUES MOR",
  "CARLOS FERREIRA LIMA",
  "ANA PAULA COSTA SILVA",
  "MARCOS ANTONIO DE SOUZA",
];

const ROUTE_KEY = "/dashboard/documents/atestado";

export default function AtestadoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "atestado").slice(0, 6);

  const [form, setForm] = useState<AtestadoFormData>(initial);
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
        setForm({
          paciente: b.paciente || "",
          docTipo: b.cns ? "cns" : "cpf",
          docNumero: b.cns || b.cpf || "",
          unidade: b.unidade_curta || b.unidade || initial.unidade,
          endereco: [b.endereco1, b.endereco2, b.endereco3].filter(Boolean).join("\n"),
          dataAtendimento: b.data_atendimento || "",
          horaAtendimento: b.hora_atendimento || "",
          dias: b.dias || "1",
          cid: b.cid || "",
          nascimento: b.nascimento || "",
          uf: b.uf || initial.uf,
        });
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const fillTest = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const data = `${dd}/${mm}/${hoje.getFullYear()}`;
    const hora = `0${Math.floor(Math.random() * 8) + 1}:${rnd60()}:${rnd60()}`;
    setForm({
      ...initial,
      paciente: pick(NOMES),
      docTipo: "cpf",
      docNumero: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      dataAtendimento: data,
      horaAtendimento: hora,
      dias: String(Math.floor(Math.random() * 3) + 1),
      cid: "J11",
      nascimento: "14/05/1990",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof AtestadoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof AtestadoFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateAtestadoUrl);
    const [end1, end2, end3] = splitEndereco(form.endereco);
    const horaCurta = form.horaAtendimento.slice(0, 5);
    return {
      paciente: form.paciente,
      cpf: form.docTipo === "cpf" ? form.docNumero : "",
      cns: form.docTipo === "cns" ? form.docNumero : "",
      unidade: form.unidade,
      unidade_curta: form.unidade,
      endereco1: end1,
      endereco2: end2,
      endereco3: end3,
      data_atendimento: form.dataAtendimento,
      hora_atendimento: form.horaAtendimento,
      dias: form.dias,
      motivo: "doença",
      cid: form.cid,
      nascimento: form.nascimento,
      uf: form.uf,
      medico: MEDICO,
      crm: CRM,
      especialidade: ESPECIALIDADE,
      data_emissao: form.dataAtendimento,
      emitido_em: `${form.dataAtendimento} ${form.horaAtendimento}`.trim(),
      liberado_data: form.dataAtendimento,
      liberado_hora: horaCurta,
      corpo: "",
      template_base64: templateBase64,
      field_positions: loadAtestadoFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  /** Assinatura dos campos que realmente mudam o desenho do documento. */
  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.paciente.trim().length > 2 &&
    form.docNumero.trim().length > 5 &&
    form.dataAtendimento.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-atestado-pdf", {
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

  /* Preview ao vivo com debounce — não navega, não gasta crédito.
     Após a geração final não roda de novo (evitava a tela de carregando
     reaparecer por cima do diálogo de PDF pronto). */
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
        const { data, error } = await invokeGeneratePdf("generate-atestado-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("atestado", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      // 1) Gera o PDF final ANTES de cobrar: se falhar, nenhum crédito é descontado.
      const { data, error } = await invokeGeneratePdf("generate-atestado-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      // 2) PDF pronto — agora sim cobra o crédito.
      const deduction = await deductCredit(1, "geracao-atestado", creditRef("geracao-atestado", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.paciente || "",
        identification: form.docTipo === "cpf" ? form.docNumero : "",
        date: form.dataAtendimento || "",
        description: `Atestado UPA24h - ${form.unidade || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "atestado",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu Atestado UPA24h está pronto.\n\nPaciente: ${form.paciente}\nAtendimento: ${form.dataAtendimento} ${form.horaAtendimento}\n\nValide pelo QR Code do documento.`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Atestado UPA24h" />
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
                : "Preencha nome, documento e data do atendimento — a prévia atualiza sozinha enquanto você digita."}
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
                <Stethoscope className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight text-foreground">Atestado UPA 24h</h1>
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
          <FormDraftsPanel docType="atestado" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

          {/* PACIENTE */}
          <div className={card}>
            <SectionHeader icon={User} title="Paciente" hint="Dados de identificação" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Nome do paciente</FieldLabel>
                <Input value={form.paciente} onChange={set("paciente")} placeholder="Ex: TATIANI RODRIGUES MOR" className={inputCls} required />
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Documento</FieldLabel>
                <div className="inline-flex rounded-xl border border-border/70 bg-secondary/60 p-1">
                  {(["cpf", "cns"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, docTipo: t }))}
                      className={`rounded-lg px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                        form.docTipo === t
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <Input
                  value={form.docNumero}
                  onChange={setMask("docNumero", form.docTipo === "cpf" ? maskCPF : maskDigits(15))}
                  inputMode="numeric"
                  placeholder={form.docTipo === "cpf" ? "000.000.000-00" : "801440458570767"}
                  className={inputCls}
                  required
                />
              </div>

              <div className="grid grid-cols-[1fr_88px] gap-3">
                <div className="space-y-1.5">
                  <FieldLabel required>Data de nascimento</FieldLabel>
                  <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="14/05/1990" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>UF</FieldLabel>
                  <Input value={form.uf} onChange={set("uf")} placeholder="SP" maxLength={2} className={`${inputCls} text-center uppercase`} />
                </div>
              </div>
            </div>
          </div>

          {/* ATENDIMENTO */}
          <div className={card}>
            <SectionHeader icon={Stethoscope} title="Atendimento" hint="Data, hora, repouso e CID" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel required>Data do atendimento</FieldLabel>
                  <Input value={form.dataAtendimento} onChange={setMask("dataAtendimento", maskDate)} inputMode="numeric" placeholder="08/11/2023" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Hora do atendimento</FieldLabel>
                  <Input value={form.horaAtendimento} onChange={setMask("horaAtendimento", maskTimeSec)} inputMode="numeric" placeholder="05:53:23" className={inputCls} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel required>Dias de repouso</FieldLabel>
                  <Input type="number" min={1} max={30} value={form.dias} onChange={set("dias")} className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>CID</FieldLabel>
                  <Input value={form.cid} onChange={set("cid")} placeholder="J11" className={`${inputCls} uppercase`} required />
                </div>
              </div>

              <p className="rounded-xl bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                A emissão, o rodapé e a liberação eletrônica são preenchidos automaticamente com a data e a hora informadas.
              </p>
            </div>
          </div>

          {/* UNIDADE */}
          <div className={card}>
            <SectionHeader icon={Building2} title="Unidade" hint="Cabeçalho do documento" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Unidade</FieldLabel>
                <Input value={form.unidade} onChange={set("unidade")} placeholder="UPA 24h Itaquera" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Endereço completo</FieldLabel>
                <Textarea
                  value={form.endereco}
                  onChange={set("endereco")}
                  rows={3}
                  placeholder={"Av. Miguel Ignácio Curi, 41\nVila Carmosina - São Paulo – SP\nCEP: 08295-005"}
                  className="rounded-xl bg-secondary/70 border-border/70 text-foreground placeholder:text-muted-foreground/70"
                />
                <p className="text-[11px] text-muted-foreground">
                  Sempre dividido em 3 linhas: logradouro + número, bairro - cidade – UF e CEP.
                </p>
              </div>
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
            <SectionHeader icon={History} title="Últimos atestados" />
            {previewHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atestado gerado ainda.</p>
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
        fileName="atestado-medico.pdf"
        title="Atestado Medico"
        message={mensagem}
      />
    </div>
  );
}
