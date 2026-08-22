import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, FlaskConical, Trash2, FileText, User, Stethoscope, Pill,
  Eye, CreditCard, RefreshCw, Hash,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadReceitaAzulFieldPositions } from "@/lib/receita-azul-align";
import templateReceitaAzulAsset from "@/assets/template-receita-azul-bg-hq.jpg.asset.json";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

interface ReceitaAzulFormData {
  uf: string;
  numero: string;
  serie: string;
  medico: string;
  crm: string;
  clinicaLinha1: string;
  clinicaLinha2: string;
  dia: string;
  mes: string;
  ano: string;
  paciente: string;
  enderecoLinha1: string;
  enderecoLinha2: string;
  medicamento: string;
  quantidade: string;
  dose: string;
  posologia: string;
  numeracao: string;
  autorizacaoData: string;
}

const initial: ReceitaAzulFormData = {
  uf: "SP",
  numero: "",
  serie: "K",
  medico: "",
  crm: "",
  clinicaLinha1: "",
  clinicaLinha2: "",
  dia: "",
  mes: "",
  ano: String(new Date().getFullYear()),
  paciente: "",
  enderecoLinha1: "",
  enderecoLinha2: "",
  medicamento: "",
  quantidade: "",
  dose: "",
  posologia: "",
  numeracao: "",
  autorizacaoData: "",
};

const ROUTE_KEY = "/dashboard/documents/receita-azul";

export default function ReceitaAzulFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<ReceitaAzulFormData>(initial);
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
          numero: b.numero || "",
          serie: b.serie || p.serie,
          medico: b.medico || "",
          crm: b.crm || "",
          clinicaLinha1: b.clinica_linha1 || "",
          clinicaLinha2: b.clinica_linha2 || "",
          dia: b.dia || "",
          mes: b.mes || "",
          ano: b.ano || p.ano,
          paciente: b.paciente || "",
          enderecoLinha1: b.endereco_linha1 || "",
          enderecoLinha2: b.endereco_linha2 || "",
          medicamento: b.medicamento || "",
          quantidade: b.quantidade || "",
          dose: b.dose || "",
          posologia: b.posologia || "",
          numeracao: b.numeracao || "",
          autorizacaoData: b.autorizacao_data || "",
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof ReceitaAzulFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const fillTest = () => {
    setForm({
      uf: "SP",
      numero: "02476237",
      serie: "K",
      medico: "Dra. Maria Cristina Cardeal Ramos",
      crm: "CRM-SP 30076",
      clinicaLinha1: "R. Conselheiro Saraiva, 306 - conj 162 - Santana",
      clinicaLinha2: "São Paulo - SP, 02037-020",
      dia: "30",
      mes: "Abril",
      ano: "2025",
      paciente: "Pedro Henrique Ferreira Lima",
      enderecoLinha1: "R. Henrique Gomes de Jesus, 280",
      enderecoLinha2: "Parque Jandaia, Carapicuíba - SP, 06333-140",
      medicamento: "Alprazolam",
      quantidade: "2 caixas (comprimidos de 30 unidades)",
      dose: "01 mg",
      posologia: "Tomar 1 comprimido a noite, antes de dormir.",
      numeracao: "Numeração de 02.476.237 até 02.476.400",
      autorizacaoData: "30/04/2025",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setPreviewPdf(null);
    setFinalPdf(null);
    clearFinalPdf(ROUTE_KEY);
    toast({ title: "Formulário limpo!" });
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateReceitaAzulAsset.url);
    return {
      uf: form.uf,
      numero: form.numero,
      serie: form.serie,
      medico: form.medico,
      crm: form.crm,
      clinica_linha1: form.clinicaLinha1,
      clinica_linha2: form.clinicaLinha2,
      dia: form.dia,
      mes: form.mes,
      ano: form.ano,
      paciente: form.paciente,
      endereco_linha1: form.enderecoLinha1,
      endereco_linha2: form.enderecoLinha2,
      medicamento: form.medicamento,
      quantidade: form.quantidade,
      dose: form.dose,
      posologia: form.posologia,
      numeracao: form.numeracao,
      autorizacao_data: form.autorizacaoData,
      template_base64: templateBase64,
      field_positions: loadReceitaAzulFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview = form.paciente.trim().length > 2 && form.medicamento.trim().length > 1;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-receita-azul-pdf", {
        body: { ...body, preview: true },
      });
      if (seq !== previewSeq.current) return;
      if (error) throw error;
      const result = data?.pdfBase64;
      if (!result) throw new Error(data?.error || "Nenhum PDF retornado");
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

    if (!form.paciente.trim() || !form.medicamento.trim()) {
      toast({ title: "Preencha o paciente e o medicamento", variant: "destructive" });
      return;
    }

    if (isEditMode && editState?.editDocId) {
      setGenerating(true);
      try {
        const body = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-receita-azul-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("receita-azul", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-receita-azul-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-receita-azul", creditRef("geracao-receita-azul", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.paciente || "",
        identification: form.numero || "",
        date: [form.dia, form.mes, form.ano].filter(Boolean).join("/"),
        description: `Notificação de Receita B (Azul) - ${form.medicamento || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "receita-azul",
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
      console.error("Erro ao gerar Receita Azul:", e);
      toast({
        title: "Erro ao gerar documento",
        description: `Nenhum crédito foi descontado. ${describeError(e)}`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Sua Notificação de Receita B (Azul) está pronta.\n\nPaciente: ${form.paciente}\nMedicamento: ${form.medicamento}`;

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";
  const selectCls = `h-10 w-full rounded-md border px-3 text-sm ${inputCls}`;

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

  /* ---------------- painel de preview ---------------- */
  const previewPanel = (
    <div className="glass flex h-full flex-col p-0">
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
              autoLive ? "border-primary/40 bg-primary/12 text-primary" : "border-border bg-secondary text-muted-foreground"
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia da Notificação de Receita B" />
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
              {previewError || "Preencha o paciente e o medicamento — a prévia atualiza sozinha enquanto você digita."}
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

      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">
          Receita Azul (Notificação B1)
        </h1>
        <p className="relative mt-1 text-sm text-muted-foreground">
          Notificação de Receita B — talonário azul, preenchimento manuscrito.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="receita-azul" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Hash} title="Notificação" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel required>UF</FieldLabel>
                <select value={form.uf} onChange={(e) => setForm((p) => ({ ...p, uf: e.target.value }))} className={selectCls}>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Número</FieldLabel>
                <Input value={form.numero} onChange={set("numero")} inputMode="numeric" placeholder="02476237" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Série</FieldLabel>
                <Input value={form.serie} onChange={set("serie")} placeholder="K" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel>Dia</FieldLabel>
                <Input value={form.dia} onChange={set("dia")} inputMode="numeric" placeholder="30" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Mês</FieldLabel>
                <select value={form.mes} onChange={(e) => setForm((p) => ({ ...p, mes: e.target.value }))} className={selectCls}>
                  <option value="">Selecione</option>
                  {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Ano</FieldLabel>
                <Input value={form.ano} onChange={set("ano")} inputMode="numeric" placeholder="2025" className={inputCls} />
              </div>
            </div>
          </div>

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Stethoscope} title="Identificação do emitente" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Médico(a)</FieldLabel>
                <Input value={form.medico} onChange={set("medico")} placeholder="Dra. Maria Cristina Cardeal Ramos" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>CRM</FieldLabel>
                <Input value={form.crm} onChange={set("crm")} placeholder="CRM-SP 30076" className={inputCls} />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Endereço (linha 1)</FieldLabel>
              <Input value={form.clinicaLinha1} onChange={set("clinicaLinha1")} placeholder="R. Conselheiro Saraiva, 306 - conj 162 - Santana" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Endereço (linha 2)</FieldLabel>
              <Input value={form.clinicaLinha2} onChange={set("clinicaLinha2")} placeholder="São Paulo - SP, 02037-020" className={inputCls} />
            </div>
          </div>

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Paciente" />
            <div className="space-y-1.5">
              <FieldLabel required>Nome do paciente</FieldLabel>
              <Input value={form.paciente} onChange={set("paciente")} placeholder="Pedro Henrique Ferreira Lima" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Endereço (linha 1)</FieldLabel>
              <Input value={form.enderecoLinha1} onChange={set("enderecoLinha1")} placeholder="R. Henrique Gomes de Jesus, 280" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Endereço (linha 2)</FieldLabel>
              <Input value={form.enderecoLinha2} onChange={set("enderecoLinha2")} placeholder="Parque Jandaia, Carapicuíba - SP, 06333-140" className={inputCls} />
            </div>
          </div>

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Pill} title="Medicamento" />
            <div className="space-y-1.5">
              <FieldLabel required>Medicamento ou substância</FieldLabel>
              <Input value={form.medicamento} onChange={set("medicamento")} placeholder="Alprazolam" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Quantidade e forma farmacêutica</FieldLabel>
              <Input value={form.quantidade} onChange={set("quantidade")} placeholder="2 caixas (comprimidos de 30 unidades)" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Dose por unidade posológica</FieldLabel>
              <Input value={form.dose} onChange={set("dose")} placeholder="01 mg" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Posologia</FieldLabel>
              <Input value={form.posologia} onChange={set("posologia")} placeholder="Tomar 1 comprimido a noite, antes de dormir." className={inputCls} />
            </div>
          </div>

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={FileText} title="Rodapé da gráfica" />
            <div className="space-y-1.5">
              <FieldLabel>Numeração</FieldLabel>
              <Input value={form.numeracao} onChange={set("numeracao")} placeholder="Numeração de 02.476.237 até 02.476.400" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data da autorização</FieldLabel>
              <Input value={form.autorizacaoData} onChange={set("autorizacaoData")} placeholder="30/04/2025" className={inputCls} />
            </div>
          </div>

          <div className="xl:hidden">{previewPanel}</div>

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

        <div className="hidden xl:block xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          {previewPanel}
        </div>
      </div>

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
        fileName="receita-azul.pdf"
        title="Receita Azul"
        message={mensagem}
      />
    </div>
  );
}
