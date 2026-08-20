import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Building2, Loader2, FlaskConical, Trash2, History, FileText, Stethoscope, Eye, CreditCard, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadUnimedFieldPositions } from "@/lib/unimed-align";
import templateUnimedUrl from "@/assets/template-unimed-bg-hq.jpg";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskDigits, maskPhone, maskTime } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";
import { pick, rnd, rnd60 } from "@/lib/random";

/* ------------------------------------------------------------ unidades */

const UNIDADES = [
  {
    nome: "TELESSAUDE - UNIMEDRJ",
    endereco: "AV ATLÂNTICA, 2440 - APT 1008, RIO DE JANEIRO - RJ, 22041-901",
    convenio: "UNIMED RJ",
    telefone: "(21) 2235-6931",
    crmUf: "CRM-RJ",
    uf: "RJ",
  },
  {
    nome: "TELESSAUDE - UNIMEDSP",
    endereco: "AV PAULISTA, 1450 - BELA VISTA, SÃO PAULO - SP, 01310-100",
    convenio: "UNIMED SP",
    telefone: "(11) 3265-9000",
    crmUf: "CRM-SP",
    uf: "SP",
  },
  {
    nome: "TELESSAUDE - UNIMEDBH",
    endereco: "AV FRANCISCO SALES, 1111 - SANTA EFIGÊNIA, BELO HORIZONTE - MG, 30150-221",
    convenio: "UNIMED BH",
    telefone: "(31) 3290-6000",
    crmUf: "CRM-MG",
    uf: "MG",
  },
];

/** Profissional automático por unidade (usado fora do modo manual). */
const MEDICOS_AUTO = [
  { medico: "MARIA CAROLINA CARIANO DA SILVA", crmNumero: "0121699", crmUf: "CRM-RJ", especialidade: "CLÍNICA MÉDICA" },
  { medico: "RICARDO ALMEIDA FONSECA", crmNumero: "0154872", crmUf: "CRM-SP", especialidade: "CLÍNICA MÉDICA" },
  { medico: "JULIANA PEREIRA RESENDE", crmNumero: "0098431", crmUf: "CRM-MG", especialidade: "CLÍNICA MÉDICA" },
];

const QUADROS = [
  "choque alérgico (anafilaxia)",
  "quadro gripal (síndrome gripal)",
  "lombalgia aguda",
  "gastroenterite aguda",
  "crise de enxaqueca",
  "infecção de vias aéreas superiores",
];

interface UnimedFormData {
  paciente: string;
  docTipo: "cpf" | "cns";
  docNumero: string;
  nascimento: string;
  mae: string;
  setor: string;
  leito: string;
  prontuario: string;
  numeroAtendimento: string;
  unidadeIdx: number;
  unidade: string;
  endereco: string;
  convenio: string;
  telefone: string;
  dataAtendimento: string;
  horaAtendimento: string;
  dias: string;
  cid: string;
  quadro: string;
  medico: string;
  crmNumero: string;
  crmUf: string;
  especialidade: string;
  modoManual: boolean;
  assinaturaBase64: string;
}

const initial: UnimedFormData = {
  paciente: "",
  docTipo: "cpf",
  docNumero: "",
  nascimento: "",
  mae: "",
  setor: "",
  leito: "",
  prontuario: "",
  numeroAtendimento: "",
  unidadeIdx: 0,
  unidade: UNIDADES[0].nome,
  endereco: UNIDADES[0].endereco,
  convenio: UNIDADES[0].convenio,
  telefone: UNIDADES[0].telefone,
  dataAtendimento: "",
  horaAtendimento: "",
  dias: "1",
  cid: "",
  quadro: QUADROS[0],
  medico: "MARIA CAROLINA CARIANO DA SILVA",
  crmNumero: "0121699",
  crmUf: "CRM-RJ",
  especialidade: "CLÍNICA MÉDICA",
  modoManual: false,
  assinaturaBase64: "",
};

const ROUTE_KEY = "/dashboard/documents/unimed";

/** Calcula a idade em anos a partir de "dd/mm/aaaa". */
export function calcIdade(nascimento: string, referencia?: string): string {
  const m = nascimento.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  const nasc = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const r = referencia?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const ref = r ? new Date(Number(r[3]), Number(r[2]) - 1, Number(r[1])) : new Date();
  let idade = ref.getFullYear() - nasc.getFullYear();
  const mesDiff = ref.getMonth() - nasc.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && ref.getDate() < nasc.getDate())) idade--;
  return idade >= 0 ? String(idade) : "";
}

const NOMES = [
  "VICTORIA GABRIELA COSTA PEREIRA",
  "RENATO SANTOS DE OLIVEIRA",
  "LARISSA MENDES DA COSTA",
  "PATRICK DE MOURA CARVALHO",
];

const MAES = ["DANIELE COSTA PEREIRA", "SANDRA MENDES DA COSTA", "ROSANA DE MOURA CARVALHO"];
const CIDS = ["T782", "M54", "J11", "A09", "R51"];

export default function UnimedFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "unimed").slice(0, 6);

  const [form, setForm] = useState<UnimedFormData>(initial);
  const [hydrated, setHydrated] = useState(false);

  const { user, deductCredit } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(editState?.editDocId);
  const cost = planCost(1, user?.plano);
  const idade = useMemo(
    () => calcIdade(form.nascimento, form.dataAtendimento),
    [form.nascimento, form.dataAtendimento],
  );

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
          paciente: b.paciente || "",
          docTipo: b.cns ? "cns" : "cpf",
          docNumero: b.cns || b.cpf || "",
          nascimento: b.nascimento || "",
          mae: b.mae || "",
          setor: b.setor || "",
          leito: b.leito || "",
          prontuario: b.prontuario || "",
          numeroAtendimento: b.numero_atendimento || "",
          unidade: b.unidade || p.unidade,
          endereco: b.endereco || p.endereco,
          convenio: b.convenio || p.convenio,
          telefone: b.telefone || p.telefone,
          dataAtendimento: b.data_atendimento || "",
          horaAtendimento: b.hora_atendimento || "",
          dias: b.dias || "1",
          cid: b.cid || "",
          quadro: b.quadro || p.quadro,
          medico: b.medico || p.medico,
          crmNumero: b.crm_numero || p.crmNumero,
          crmUf: b.crm_uf || p.crmUf,
          especialidade: b.especialidade || p.especialidade,
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const fillTest = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    setForm({
      ...initial,
      paciente: pick(NOMES),
      docNumero: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      nascimento: "14/08/2000",
      mae: pick(MAES),
      dataAtendimento: `${dd}/${mm}/${hoje.getFullYear()}`,
      horaAtendimento: `1${Math.floor(Math.random() * 8)}:${rnd60()}`,
      dias: String(Math.floor(Math.random() * 10) + 1),
      cid: pick(CIDS),
      quadro: pick(QUADROS),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof UnimedFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof UnimedFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const selecionarUnidade = (idx: number) => {
    setForm((p) => ({
      ...p,
      unidadeIdx: idx,
      unidade: UNIDADES[idx].nome,
      endereco: UNIDADES[idx].endereco,
      convenio: UNIDADES[idx].convenio,
      telefone: UNIDADES[idx].telefone,
      crmUf: UNIDADES[idx].crmUf,
      ...(p.modoManual ? {} : {
        medico: MEDICOS_AUTO[idx].medico,
        crmNumero: MEDICOS_AUTO[idx].crmNumero,
        especialidade: MEDICOS_AUTO[idx].especialidade,
      }),
    }));
  };

  /** Profissional efetivo: automático fora do modo manual. */
  const autoMedico = MEDICOS_AUTO[form.unidadeIdx] ?? MEDICOS_AUTO[0];
  const prof = form.modoManual
    ? { medico: form.medico, crmNumero: form.crmNumero, crmUf: form.crmUf, especialidade: form.especialidade }
    : { ...autoMedico, crmUf: UNIDADES[form.unidadeIdx]?.crmUf || autoMedico.crmUf };

  const onUploadAssinatura = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem (PNG/JPG)", variant: "destructive" });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Imagem muito grande (máx. 3MB)", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((p) => ({ ...p, assinaturaBase64: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateUnimedUrl);
    const horaCurta = form.horaAtendimento.slice(0, 5);
    const prontuario = form.prontuario || `00${rnd(7)}`;
    const numeroAtendimento = form.numeroAtendimento || rnd(7);

    return {
      paciente: form.paciente,
      cpf: form.docTipo === "cpf" ? form.docNumero : "",
      cns: form.docTipo === "cns" ? form.docNumero : "",
      nascimento: form.nascimento,
      idade,
      mae: form.mae,
      setor: form.setor,
      leito: form.leito,
      prontuario,
      numero_atendimento: numeroAtendimento,
      convenio: form.convenio,
      unidade: form.unidade,
      unidade_curta: form.unidade,
      endereco: form.endereco,
      telefone: form.telefone,
      data_atendimento: form.dataAtendimento,
      hora_atendimento: horaCurta,
      hora_assinatura: `${horaCurta}:${rnd60()}`,
      dias: form.dias,
      cid: form.cid,
      quadro: form.quadro,
      medico: prof.medico,
      crm_numero: prof.crmNumero,
      crm_uf: prof.crmUf,
      crm: `${prof.crmUf} ${prof.crmNumero}`,
      especialidade: prof.especialidade,
      uf: UNIDADES[form.unidadeIdx]?.uf || "RJ",
      assinatura_base64: form.modoManual ? form.assinaturaBase64 : "",
      template_base64: templateBase64,
      field_positions: loadUnimedFieldPositions() ?? undefined,
    } as Record<string, unknown>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, idade, prof.medico, prof.crmNumero, prof.crmUf, prof.especialidade]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.paciente.trim().length > 2 &&
    form.docNumero.trim().length > 5 &&
    form.mae.trim().length > 2 &&
    form.dataAtendimento.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-unimed-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-unimed-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("unimed", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-unimed-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-unimed", creditRef("geracao-unimed", body));
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
        description: `Atestado Unimed - ${form.unidade || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "unimed",
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
      console.error("Erro ao gerar PDF Unimed:", e);
      toast({
        title: "Erro ao gerar documento",
        description: `Nenhum crédito foi descontado. ${describeError(e)}`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu Atestado Unimed está pronto.\n\nPaciente: ${form.paciente}\nAtendimento: ${form.dataAtendimento} ${form.horaAtendimento}\n\nValide pelo QR Code do documento.`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Atestado Unimed" />
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
              {previewError || "Preencha nome, documento, mãe e data do atendimento — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Atestado Médico Unimed</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="unimed" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* PACIENTE */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Paciente" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome do Paciente</FieldLabel>
              <Input value={form.paciente} onChange={set("paciente")} placeholder="Ex: VICTORIA GABRIELA COSTA PEREIRA" className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Documento</FieldLabel>
              <div className="flex gap-2">
                {(["cpf", "cns"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, docTipo: t }))}
                    className={`rounded-lg border px-4 py-1.5 text-xs font-semibold uppercase transition ${
                      form.docTipo === t
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Input
                value={form.docNumero}
                onChange={set("docNumero")}
                placeholder={form.docTipo === "cpf" ? "000.000.000-00" : "801440458570767"}
                className={inputCls}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Data de Nascimento</FieldLabel>
                <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="14/08/2000" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Idade (automática)</FieldLabel>
                <Input value={idade ? `${idade} anos` : ""} readOnly disabled className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Nome da mãe</FieldLabel>
              <Input value={form.mae} onChange={set("mae")} placeholder="Ex: DANIELE COSTA PEREIRA" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Setor (opcional)</FieldLabel>
                <Input value={form.setor} onChange={set("setor")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Leito (opcional)</FieldLabel>
                <Input value={form.leito} onChange={set("leito")} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Nº Prontuário (automático)</FieldLabel>
                <Input value={form.prontuario} onChange={set("prontuario")} placeholder="gerado automaticamente" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Nº Atendimento (automático)</FieldLabel>
                <Input value={form.numeroAtendimento} onChange={set("numeroAtendimento")} placeholder="gerado automaticamente" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ATENDIMENTO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Stethoscope} title="Atendimento" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Data do Atendimento</FieldLabel>
                <Input value={form.dataAtendimento} onChange={setMask("dataAtendimento", maskDate)} inputMode="numeric" placeholder="11/12/2024" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Hora do Atendimento</FieldLabel>
                <Input value={form.horaAtendimento} onChange={setMask("horaAtendimento", maskTime)} inputMode="numeric" placeholder="13:00" className={inputCls} required />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A data de assinatura, o rodapé "Impresso em" e a assinatura digital são preenchidos automaticamente com estes valores.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Dias de afastamento</FieldLabel>
                <Input type="number" min={1} max={180} value={form.dias} onChange={set("dias")} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>CID</FieldLabel>
                <Input value={form.cid} onChange={set("cid")} placeholder="T782" className={inputCls} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Quadro apresentado</FieldLabel>
              <Input value={form.quadro} onChange={set("quadro")} list="unimed-quadros" className={inputCls} required />
              <datalist id="unimed-quadros">
                {QUADROS.map((q) => <option key={q} value={q} />)}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Usado no texto: "…apresentando quadro de <strong>{form.quadro || "…"}</strong>."
              </p>
            </div>
          </div>

          {/* UNIDADE */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Building2} title="Unidade" />

            <div className="space-y-1.5">
              <FieldLabel required>Unidade</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {UNIDADES.map((u, i) => (
                  <button
                    key={u.nome}
                    type="button"
                    onClick={() => selecionarUnidade(i)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      form.unidadeIdx === i
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {u.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Nome da unidade (cabeçalho)</FieldLabel>
              <Input value={form.unidade} onChange={set("unidade")} className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Endereço da unidade</FieldLabel>
              <Input value={form.endereco} onChange={set("endereco")} className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Convênio</FieldLabel>
                <Input value={form.convenio} onChange={set("convenio")} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Telefone de contato</FieldLabel>
                <Input value={form.telefone} onChange={setMask("telefone", maskPhone)} inputMode="numeric" className={inputCls} />
              </div>
            </div>
          </div>

          {/* PROFISSIONAL */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Stethoscope} title="Profissional" />

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Modo manual</p>
                <p className="text-[11px] text-muted-foreground">
                  {form.modoManual
                    ? "Você escolhe o médico, CRM e a assinatura."
                    : "Médico, CRM e assinatura são preenchidos automaticamente."}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => {
                    const on = !p.modoManual;
                    const auto = MEDICOS_AUTO[p.unidadeIdx] ?? MEDICOS_AUTO[0];
                    return on
                      ? { ...p, modoManual: true }
                      : { ...p, modoManual: false, assinaturaBase64: "", ...auto };
                  })
                }
                className={`h-7 w-12 shrink-0 rounded-full border transition ${
                  form.modoManual ? "border-primary bg-primary/25" : "border-border bg-secondary"
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-primary transition-transform ${
                    form.modoManual ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {form.modoManual ? (
              <>
                <div className="space-y-1.5">
                  <FieldLabel required>Profissional</FieldLabel>
                  <Input value={form.medico} onChange={set("medico")} className={inputCls} required />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <FieldLabel required>CRM (UF)</FieldLabel>
                    <Input value={form.crmUf} onChange={set("crmUf")} placeholder="CRM-RJ" className={inputCls} required />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel required>Nº do CRM</FieldLabel>
                    <Input value={form.crmNumero} onChange={setMask("crmNumero", maskDigits(7))} inputMode="numeric" placeholder="0121699" className={inputCls} required />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel required>Especialidade</FieldLabel>
                    <Input value={form.especialidade} onChange={set("especialidade")} className={inputCls} required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Assinatura (upload)</FieldLabel>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onUploadAssinatura}
                    className="block w-full cursor-pointer rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    A imagem é aplicada exatamente sobre o local da assinatura no atestado. PNG com fundo transparente fica melhor.
                  </p>
                  {form.assinaturaBase64 && (
                    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-white p-2">
                      <img src={form.assinaturaBase64} alt="Assinatura carregada" className="h-16 object-contain" />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="ml-auto gap-1.5 text-xs"
                        onClick={() => setForm((p) => ({ ...p, assinaturaBase64: "" }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">{prof.medico}</p>
                <p className="text-[12px]">{prof.crmUf}: {prof.crmNumero} · {prof.especialidade}</p>
              </div>
            )}
          </div>

          {/* PRÉVIA — mobile/tablet */}
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

          {/* HISTÓRICO */}
          <div className="glass space-y-3 p-6">
            <SectionHeader icon={History} title="Histórico de Previews" />
            {previewHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atestado Unimed gerado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {previewHistory.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{d.name || "Sem nome"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {d.identification} · {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5 text-xs"
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
        fileName="atestado-unimed.pdf"
        title="Atestado Unimed"
        message={mensagem}
      />
    </div>
  );
}
