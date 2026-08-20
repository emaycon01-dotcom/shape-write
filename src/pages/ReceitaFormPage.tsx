import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill, Loader2, FlaskConical, Trash2, FileText, User, Stethoscope, Plus, X, MapPin, Search, Eye, CreditCard, RefreshCw } from "lucide-react";
import MedicamentoSearch from "@/components/MedicamentoSearch";
import { useToast } from "@/hooks/use-toast";
import { loadReceitaFieldPositions } from "@/lib/receita-align";
import templateReceitaUrl from "@/assets/template-receita-bg-hq.jpg";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { CIDADES_UNIMED } from "@/lib/cidades-unimed";

interface Medicamento {
  nome: string;
  posologia: string;
  quantidade: string;
  farmaciaPopular: boolean;
}

interface ReceitaFormData {
  cidadeUnidade: string;
  paciente: string;
  cpf: string;
  nascimento: string;
  emissao: string;
  endereco: string;
  medico: string;
  crm: string;
  enderecoClinica: string;
  telefone: string;
}

const medVazio: Medicamento = { nome: "", posologia: "", quantidade: "1 caixa", farmaciaPopular: false };

const initial: ReceitaFormData = {
  cidadeUnidade: "Vitória",
  paciente: "",
  cpf: "",
  nascimento: "",
  emissao: "",
  endereco: "",
  medico: "Dr(a). Ana Flavia Resende Romanielo",
  crm: "CRM 31186 GO",
  enderecoClinica: "SCS Quadra 03 Bloco A, Numero 107, Sala 103 Ed Antônia Alves P de Sousa SCS - Brasília DF - CEP 70303907",
  telefone: "(61) 3221-5350",
};

const ROUTE_KEY = "/dashboard/documents/receita-medica";

export default function ReceitaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<ReceitaFormData>(initial);
  const [meds, setMeds] = useState<Medicamento[]>([{ ...medVazio }]);
  const [hydrated, setHydrated] = useState(false);
  const [searchTarget, setSearchTarget] = useState<number | null>(null);

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
          cidadeUnidade: b.cidade_unidade || p.cidadeUnidade,
          paciente: b.paciente || "",
          cpf: b.cpf || "",
          nascimento: b.nascimento || "",
          emissao: b.emissao || "",
          endereco: b.endereco || "",
          medico: b.medico || p.medico,
          crm: b.crm || p.crm,
          enderecoClinica: b.endereco_clinica || p.enderecoClinica,
          telefone: b.telefone || p.telefone,
        }));
        try {
          const parsed = JSON.parse((b.medicamentos as unknown as string) || "[]");
          if (Array.isArray(parsed) && parsed.length) {
            setMeds(parsed.map((m: Partial<Medicamento>) => ({ ...medVazio, ...m })));
          }
        } catch { /* lista inválida */ }
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof ReceitaFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof ReceitaFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const setMed = (i: number, patch: Partial<Medicamento>) =>
    setMeds((p) => p.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const addMed = () => setMeds((p) => [...p, { ...medVazio }]);
  const removeMed = (i: number) => setMeds((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const fillTest = () => {
    setForm({
      ...initial,
      cidadeUnidade: "Vitória",
      paciente: "TACILA CERQUEIRA LOPES",
      cpf: "074.660.925-60",
      nascimento: "05/08/1997",
      emissao: "30/03/2024 - 17:19:37",
      endereco: "- 99102312, -",
    });
    setMeds([
      { nome: "Budesonida (Spray) 32 mcg/Dose, Suspensão nasal (1un)", posologia: "Aplicar 1 jato nas narinas 3x ao dia", quantidade: "1 caixa", farmaciaPopular: true },
      { nome: "Hexomedine (Spray) 1 mg/mL + 0.5 mg/mL, Colutório (1un)", posologia: "bater em garganta 3x ao dia", quantidade: "1 caixa", farmaciaPopular: false },
      { nome: "Predinis 20 mg, Comprimido (10un)", posologia: "Tomar 1 comprimido via oral 12/12h por 5 dias", quantidade: "1 caixa", farmaciaPopular: false },
      { nome: "Ibuprofeno 600 mg, Cápsula mole (4un)", posologia: "Tomar 1 cápsula via oral 8/8h por 3 dias", quantidade: "1 caixa", farmaciaPopular: false },
    ]);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setMeds([{ ...medVazio }]);
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateReceitaUrl);
    const validos = meds.filter((m) => m.nome.trim());
    return {
      cidade_unidade: form.cidadeUnidade,
      paciente: form.paciente,
      cpf: form.cpf,
      nascimento: form.nascimento,
      emissao: form.emissao,
      endereco: form.endereco,
      medico: form.medico,
      crm: form.crm,
      endereco_clinica: form.enderecoClinica,
      telefone: form.telefone,
      medicamentos: JSON.stringify(validos),
      template_base64: templateBase64,
      field_positions: loadReceitaFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form, meds]);

  const signature = useMemo(() => JSON.stringify({ form, meds }), [form, meds]);

  const canPreview =
    form.paciente.trim().length > 2 &&
    form.cpf.trim().length > 5 &&
    meds.some((m) => m.nome.trim().length > 2);

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-receita-pdf", {
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

    const validos = meds.filter((m) => m.nome.trim());
    if (!validos.length) {
      toast({ title: "Adicione ao menos um medicamento", variant: "destructive" });
      return;
    }

    if (isEditMode && editState?.editDocId) {
      setGenerating(true);
      try {
        const body = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-receita-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("receita", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-receita-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-receita", creditRef("geracao-receita", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.paciente || "",
        identification: form.cpf || "",
        date: form.emissao || "",
        description: `Receita Médica - ${form.cidadeUnidade || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "receita-medica",
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
      console.error("Erro ao gerar Receita Médica:", e);
      toast({
        title: "Erro ao gerar documento",
        description: `Nenhum crédito foi descontado. ${describeError(e)}`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Sua Receita Médica está pronta.\n\nPaciente: ${form.paciente}\nCPF: ${form.cpf}\nUnidade: ${form.cidadeUnidade}`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia da Receita Médica" />
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
              {previewError || "Preencha paciente, CPF e ao menos um medicamento — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Receita Médica</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="receita" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={MapPin} title="Unidade" />
            <div className="space-y-1.5">
              <FieldLabel required>Cidade da unidade (abaixo da logo)</FieldLabel>
              <select
                value={form.cidadeUnidade}
                onChange={(e) => setForm((p) => ({ ...p, cidadeUnidade: e.target.value }))}
                className={selectCls}
              >
                {CIDADES_UNIMED.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                A cidade é impressa em branco, centralizada logo abaixo da logo Unimed.
              </p>
            </div>
          </div>

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Dados do paciente" />
            <div className="space-y-1.5">
              <FieldLabel required>Nome do paciente</FieldLabel>
              <Input value={form.paciente} onChange={set("paciente")} placeholder="TACILA CERQUEIRA LOPES" className={inputCls} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>CPF</FieldLabel>
                <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="074.660.925-60" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Nascimento</FieldLabel>
                <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="05/08/1997" className={inputCls} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Emissão</FieldLabel>
              <Input value={form.emissao} onChange={set("emissao")} placeholder="30/03/2024 - 17:19:37" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Endereço</FieldLabel>
              <Input value={form.endereco} onChange={set("endereco")} placeholder="- 99102312, -" className={inputCls} />
            </div>
          </div>

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Pill} title="Medicamentos" />
            <Button
              type="button"
              variant="gradient"
              onClick={() => setSearchTarget(meds.length - 1)}
              className="w-full gap-2"
            >
              <Search className="h-4 w-4" /> Pesquisar medicamento na base
            </Button>
            <p className="-mt-2 text-center text-xs text-muted-foreground">
              Digite o nome e escolha dose, forma, apresentação, quantidade e posologia.
            </p>

            {meds.map((m, i) => (
              <div key={i} className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Item {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSearchTarget(i)}
                      className="flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                    >
                      <Search className="h-3 w-3" /> Buscar
                    </button>
                    {meds.length > 1 && (
                      <button type="button" onClick={() => removeMed(i)} className="text-destructive hover:opacity-80">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <FieldLabel required>Medicamento</FieldLabel>
                  <Input
                    value={m.nome}
                    onChange={(e) => setMed(i, { nome: e.target.value })}
                    placeholder="Ibuprofeno 600 mg, Cápsula mole (4un)"
                    className={inputCls}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Posologia</FieldLabel>
                  <Input
                    value={m.posologia}
                    onChange={(e) => setMed(i, { posologia: e.target.value })}
                    placeholder="Tomar 1 cápsula via oral 8/8h por 3 dias"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel>Quantidade</FieldLabel>
                    <Input
                      value={m.quantidade}
                      onChange={(e) => setMed(i, { quantidade: e.target.value })}
                      placeholder="1 caixa"
                      className={inputCls}
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={m.farmaciaPopular}
                      onChange={(e) => setMed(i, { farmaciaPopular: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    Farmácia Popular
                  </label>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addMed} className="w-full gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
              <Plus className="h-4 w-4" /> Adicionar medicamento manualmente
            </Button>
          </div>

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Stethoscope} title="Médico e clínica" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Médico(a)</FieldLabel>
                <Input value={form.medico} onChange={set("medico")} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>CRM</FieldLabel>
                <Input value={form.crm} onChange={set("crm")} className={inputCls} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Endereço da clínica</FieldLabel>
              <Input value={form.enderecoClinica} onChange={set("enderecoClinica")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Telefone</FieldLabel>
              <Input value={form.telefone} onChange={set("telefone")} className={inputCls} />
            </div>
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

      <MedicamentoSearch
        open={searchTarget !== null}
        onOpenChange={(v) => !v && setSearchTarget(null)}
        onSelect={(m) => {
          setMeds((p) => {
            const idx = searchTarget ?? p.length - 1;
            const alvoVazio = !p[idx]?.nome?.trim();
            if (alvoVazio) return p.map((old, i) => (i === idx ? m : old));
            return [...p, m];
          });
          setSearchTarget(null);
          toast({ title: "Medicamento adicionado!" });
        }}
      />

      <PdfReadyDialog
        open={showReady}
        onOpenChange={setShowReady}
        pdfDataUrl={finalPdf || ""}
        fileName="receita-medica.pdf"
        title="Receita Medica"
        message={mensagem}
      />
    </div>
  );
}
