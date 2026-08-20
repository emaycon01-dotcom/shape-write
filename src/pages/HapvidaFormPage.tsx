import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Building2, Loader2, FlaskConical, Trash2, History, FileText, Stethoscope, Eye, CreditCard, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadHapvidaFieldPositions } from "@/lib/hapvida-align";
import templateHapvidaUrl from "@/assets/template-hapvida-bg-hq.jpg";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskCPF, maskDate, maskDigits, maskPhone, maskTime } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { invokeSecondaryFunction } from "@/lib/pdf-fallback";
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
    nome: "Hapvida - Fortaleza (Centro)",
    linha1: "Av. Heráclito Graça, 1001 - Centro, Fortaleza-CE,",
    linha2: "CEP: 60140-090 | Telefone: (85) 9 4002-3633",
  },
  {
    nome: "Hapvida - São Paulo (Paulista)",
    linha1: "Av. Paulista, 1450 - Bela Vista, São Paulo-SP,",
    linha2: "CEP: 01310-100 | Telefone: (11) 9 4002-3633",
  },
  {
    nome: "NotreDame Intermédica - Recife",
    linha1: "Av. Conselheiro Aguiar, 2333 - Boa Viagem, Recife-PE,",
    linha2: "CEP: 51020-020 | Telefone: (81) 9 4002-3633",
  },
];

const TIPOS_ATENDIMENTO = ["Urgência", "Emergência", "Eletivo", "Consulta"];

const ESPECIALIDADES = [
  "CLÍNICA MÉDICA",
  "ORTOPEDIA",
  "PEDIATRIA",
  "GINECOLOGIA",
  "CARDIOLOGIA",
  "OTORRINOLARINGOLOGIA",
];

interface HapvidaFormData {
  paciente: string;
  docTipo: "cpf" | "cns";
  docNumero: string;
  celular: string;
  nascimento: string;
  uf: string;
  tipoAtendimento: string;
  dataAtendimento: string;
  horaAtendimento: string;
  dias: string;
  cid: string;
  unidade: string;
  endereco1: string;
  endereco2: string;
  medico: string;
  crm: string;
  especialidade: string;
}

const initial: HapvidaFormData = {
  paciente: "",
  docTipo: "cpf",
  docNumero: "",
  celular: "",
  nascimento: "",
  uf: "CE",
  tipoAtendimento: "Urgência",
  dataAtendimento: "",
  horaAtendimento: "",
  dias: "1",
  cid: "",
  unidade: UNIDADES[0].nome,
  endereco1: UNIDADES[0].linha1,
  endereco2: UNIDADES[0].linha2,
  medico: "CARINE GONÇALVES LOPES PIETRZAKI",
  crm: "CRM 210827SP",
  especialidade: "CLÍNICA MÉDICA",
};

const ROUTE_KEY = "/dashboard/documents/hapvida";

const NOMES = [
  "PATRICK DE MOURA CARVALHO",
  "JULIANA ALVES BEZERRA",
  "RENATO SANTOS DE OLIVEIRA",
  "LARISSA MENDES DA COSTA",
];

const CIDS = ["M54", "J11", "A09", "K29", "R51"];

/** Código opaco, não sequencial e URL-safe (32 chars) para o QR de validação. */
function makeVerifyCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export default function HapvidaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "hapvida").slice(0, 6);

  const [form, setForm] = useState<HapvidaFormData>(initial);
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
          paciente: b.paciente || "",
          docTipo: b.cns ? "cns" : "cpf",
          docNumero: b.cns || b.cpf || "",
          celular: b.celular || "",
          nascimento: b.nascimento || "",
          unidade: b.unidade_curta || b.unidade || p.unidade,
          uf: b.uf || p.uf,
          tipoAtendimento: b.tipo_atendimento || p.tipoAtendimento,
          dataAtendimento: b.data_atendimento || "",
          horaAtendimento: b.hora_atendimento || "",
          dias: b.dias || "1",
          cid: b.cid || "",
          endereco1: b.endereco1 || p.endereco1,
          endereco2: b.endereco2 || p.endereco2,
          medico: b.medico || p.medico,
          crm: b.crm || p.crm,
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
      celular: `(${rnd(2)}) ${rnd(5)}-${rnd(4)}`,
      nascimento: "14/05/1990",
      dataAtendimento: `${dd}/${mm}/${hoje.getFullYear()}`,
      horaAtendimento: `0${Math.floor(Math.random() * 8) + 1}:${rnd60()}`,
      dias: String(Math.floor(Math.random() * 15) + 1),
      cid: pick(CIDS),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof HapvidaFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof HapvidaFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const setUnidade = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    const known = UNIDADES.find((u) => u.nome === nome);
    setForm((p) => ({
      ...p,
      unidade: nome,
      endereco1: known ? known.linha1 : p.endereco1,
      endereco2: known ? known.linha2 : p.endereco2,
    }));
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateHapvidaUrl);
    const horaCurta = form.horaAtendimento.slice(0, 5);
    const unidade = form.unidade.trim();

    return {
      paciente: form.paciente,
      cpf: form.docTipo === "cpf" ? form.docNumero : "",
      cns: form.docTipo === "cns" ? form.docNumero : "",
      celular: form.celular,
      tipo_atendimento: form.tipoAtendimento,
      unidade,
      unidade_curta: unidade,
      endereco1: form.endereco1,
      endereco2: form.endereco2,
      endereco3: "",
      data_atendimento: form.dataAtendimento,
      hora_atendimento: form.horaAtendimento,
      dias: form.dias,
      cid: form.cid,
      nascimento: form.nascimento,
      uf: form.uf,
      medico: form.medico,
      crm: form.crm,
      especialidade: form.especialidade,
      data_emissao: form.dataAtendimento,
      emitido_em: `${form.dataAtendimento} ${horaCurta}`.trim(),
      liberado_data: form.dataAtendimento,
      liberado_hora: horaCurta,
      template_base64: templateBase64,
      field_positions: loadHapvidaFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

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
      const { data, error } = await invokeGeneratePdf("generate-hapvida-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-hapvida-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("hapvida", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();
      const verifyCode = makeVerifyCode();

      const { data, error } = await invokeGeneratePdf("generate-hapvida-pdf", {
        body: { ...body, preview: false, verify_code: verifyCode },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-hapvida", creditRef("geracao-hapvida", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      const created = await addDocument({
        name: form.paciente || "",
        identification: form.docTipo === "cpf" ? form.docNumero : "",
        date: form.dataAtendimento || "",
        description: `Atestado HapVida - ${form.unidade || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "hapvida",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      try {
        await supabase.from("document_codes").insert({
          code: verifyCode,
          doc_id: created.id,
          doc_type: "hapvida",
          user_id: user.id,
          storage_path: `${user.id}/${created.id}.pdf`,
        });
      } catch (e) {
        console.error("Falha ao registrar código de validação:", e);
      }

      void invokeSecondaryFunction("mirror-hapvida-code", {
        code: verifyCode,
        doc_id: created.id,
        doc_type: "hapvida",
        pdf_base64: pdfFinal,
        name: form.paciente || "",
        identification: form.docTipo === "cpf" ? form.docNumero : "",
        date: form.dataAtendimento || "",
        description: `Atestado HapVida - ${form.unidade || ""}`,
      }).catch((e) => console.warn("Falha ao espelhar atestado no validador:", e));

      generatedSignature.current = signature;
      setShowReady(true);

      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });
    } catch (e) {
      console.error("Erro ao gerar PDF HapVida:", e);
      toast({
        title: "Erro ao gerar documento",
        description: `Nenhum crédito foi descontado. ${describeError(e)}`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu Atestado HapVida está pronto.\n\nPaciente: ${form.paciente}\nAtendimento: ${form.dataAtendimento} ${form.horaAtendimento}\n\nValide pelo QR Code do documento.`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Atestado HapVida" />
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
              {previewError || "Preencha nome, documento e data do atendimento — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Atestado HapVida / NotreDame</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="hapvida" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* PACIENTE */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Paciente" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome do Paciente</FieldLabel>
              <Input value={form.paciente} onChange={set("paciente")} placeholder="Ex: PATRICK DE MOURA CARVALHO" className={inputCls} required />
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
                onChange={setMask("docNumero", form.docTipo === "cpf" ? maskCPF : maskDigits(15))} inputMode="numeric"
                placeholder={form.docTipo === "cpf" ? "000.000.000-00" : "801440458570767"}
                className={inputCls}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Celular</FieldLabel>
                <Input value={form.celular} onChange={setMask("celular", maskPhone)} inputMode="numeric" placeholder="(34) 99649-7562" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Data de Nascimento</FieldLabel>
                <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="14/05/1990" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* ATENDIMENTO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Stethoscope} title="Atendimento" />

            <div className="space-y-1.5">
              <FieldLabel required>Tipo de atendimento</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {TIPOS_ATENDIMENTO.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, tipoAtendimento: t }))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      form.tipoAtendimento === t
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Data do Atendimento</FieldLabel>
                <Input value={form.dataAtendimento} onChange={setMask("dataAtendimento", maskDate)} inputMode="numeric" placeholder="27/01/2025" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Hora do Atendimento</FieldLabel>
                <Input value={form.horaAtendimento} onChange={setMask("horaAtendimento", maskTime)} inputMode="numeric" placeholder="09:46" className={inputCls} required />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A data de emissão, a validade do atestado e o rodapé são preenchidos automaticamente com estes valores.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Dias de afastamento</FieldLabel>
                <Input type="number" min={1} max={180} value={form.dias} onChange={set("dias")} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>CID</FieldLabel>
                <Input value={form.cid} onChange={set("cid")} placeholder="M54" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* UNIDADE E PROFISSIONAL */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Building2} title="Unidade e profissional" />

            <div className="space-y-1.5">
              <FieldLabel required>Unidade</FieldLabel>
              <Input
                value={form.unidade}
                onChange={setUnidade}
                list="hapvida-unidades"
                placeholder="Ex: Hapvida - Fortaleza (Centro)"
                className={inputCls}
                required
              />
              <datalist id="hapvida-unidades">
                {UNIDADES.map((u) => <option key={u.nome} value={u.nome} />)}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Digite livremente o nome da unidade. As sugestões preenchem o endereço automaticamente.
              </p>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Endereço - linha 1</FieldLabel>
              <Input value={form.endereco1} onChange={set("endereco1")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Endereço - linha 2 (CEP e telefone)</FieldLabel>
              <Input value={form.endereco2} onChange={set("endereco2")} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Médico(a)</FieldLabel>
              <Input value={form.medico} onChange={set("medico")} className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>CRM</FieldLabel>
                <Input value={form.crm} onChange={set("crm")} placeholder="CRM 210827SP" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Especialidade</FieldLabel>
                <Input
                  value={form.especialidade}
                  onChange={set("especialidade")}
                  list="hapvida-especialidades"
                  className={inputCls}
                  required
                />
                <datalist id="hapvida-especialidades">
                  {ESPECIALIDADES.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>
            </div>
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
              <p className="text-sm text-muted-foreground">Nenhum atestado HapVida gerado ainda.</p>
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
        fileName="atestado-hapvida.pdf"
        title="Atestado Hapvida"
        message={mensagem}
      />
    </div>
  );
}
