import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, FlaskConical, Trash2, FileText, User, Shield, Eye, CreditCard, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadPorteFieldPositions } from "@/lib/porte-align";
import templatePorteUrl from "@/assets/template-porte-bg-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";

interface PorteFormData {
  certificado: string;
  expedicao: string;
  categoria: string;
  via: string;
  nome: string;
  abrangencia: string;
  armaNumero: string;
  especie: string;
  marca: string;
  calibre: string;
  fabricacao: string;
  dataExpedicao: string;
  validade: string;
  identidade: string;
  assinante: string;
  cargo: string;
  unidade: string;
  numeroPorte: string;
}

const initial: PorteFormData = {
  certificado: "",
  expedicao: "SR/PF/AM",
  categoria: "DEFESA PESSOAL",
  via: "1",
  nome: "",
  abrangencia: "VALIDO EM TODO TERRITÓRIO NACIONAL",
  armaNumero: "",
  especie: "PISTOLA",
  marca: "",
  calibre: "",
  fabricacao: "",
  dataExpedicao: "",
  validade: "",
  identidade: "",
  assinante: "",
  cargo: "DELEGADO DE POLICIA FEDERAL CLASSE ESPECIAL",
  unidade: "SR/PF/AM",
  numeroPorte: "",
};

const ESPECIES = ["PISTOLA", "REVÓLVER", "CARABINA", "FUZIL", "ESPINGARDA", "GARRUCHA"];

const CATEGORIAS = [
  "DEFESA PESSOAL",
  "CAÇADOR",
  "ATIRADOR DESPORTIVO",
  "COLECIONADOR",
  "VIGILANTE",
  "FUNCIONAL",
];

const ROUTE_KEY = "/dashboard/documents/porte";

export default function PorteFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<PorteFormData>(initial);
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
          certificado: b.certificado || "",
          expedicao: b.expedicao || p.expedicao,
          categoria: b.categoria || p.categoria,
          via: b.via || p.via,
          nome: b.nome || "",
          abrangencia: b.abrangencia || p.abrangencia,
          armaNumero: b.arma_numero || "",
          especie: b.especie || p.especie,
          marca: b.marca || "",
          calibre: b.calibre || "",
          fabricacao: b.fabricacao || "",
          dataExpedicao: b.data_expedicao || "",
          validade: b.validade || "",
          identidade: b.identidade || "",
          assinante: b.assinante || "",
          cargo: b.cargo || p.cargo,
          unidade: b.unidade || p.unidade,
          numeroPorte: b.numero_porte || "",
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof PorteFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof PorteFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    setForm({
      ...initial,
      certificado: "438297892434",
      nome: "ELIAS DOS SANTOS LEÃO",
      armaNumero: "78167",
      especie: "PISTOLA",
      marca: "TAURUS",
      calibre: "380",
      fabricacao: "2008",
      dataExpedicao: "23/11/2023",
      validade: "21/11/2028",
      identidade: "3260848-9 SSP/AM",
      assinante: "FLAVIO MARCIO ALBERGEREGE SILVA",
      numeroPorte: "438297892434",
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
    const templateBase64 = await loadTemplateObjectUrl(templatePorteUrl);
    return {
      certificado: form.certificado,
      expedicao: form.expedicao,
      categoria: form.categoria,
      via: form.via,
      nome: form.nome,
      abrangencia: form.abrangencia,
      arma_numero: form.armaNumero,
      especie: form.especie,
      marca: form.marca,
      calibre: form.calibre,
      fabricacao: form.fabricacao,
      data_expedicao: form.dataExpedicao,
      validade: form.validade,
      identidade: form.identidade,
      assinante: form.assinante,
      cargo: form.cargo,
      unidade: form.unidade,
      numero_porte: form.numeroPorte,

      template_base64: templateBase64,
      field_positions: loadPorteFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.certificado.trim().length > 3 &&
    form.nome.trim().length > 2 &&
    form.armaNumero.trim().length > 2 &&
    form.marca.trim().length > 1 &&
    form.calibre.trim().length > 0 &&
    form.identidade.trim().length > 3 &&
    form.assinante.trim().length > 2 &&
    form.dataExpedicao.length === 10 &&
    form.validade.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-porte-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-porte-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("porte", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-porte-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-porte", creditRef("geracao-porte", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nome || "",
        identification: form.identidade || "",
        date: form.dataExpedicao || "",
        description: `Porte Federal de Arma - ${form.especie || ""} ${form.marca || ""} ${form.calibre || ""}`.trim(),
        additionalInfo: JSON.stringify(body),
        type: "porte",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu documento está pronto.\n\nPortador: ${form.nome}\nCertificado: ${form.certificado}\nArma: ${form.especie} ${form.marca}\nCalibre: ${form.calibre}`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Porte Federal de Arma" />
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
              {previewError || "Preencha certificado, portador, arma e datas — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">PORTE FEDERAL DE ARMA</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="porte" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* CERTIFICADO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={FileText} title="Dados do certificado" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Certificado nº</FieldLabel>
                <Input value={form.certificado} onChange={set("certificado")} inputMode="numeric" placeholder="438297892434" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Expedição (unidade)</FieldLabel>
                <Input value={form.expedicao} onChange={set("expedicao")} placeholder="SR/PF/AM" className={inputCls} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel required>Categoria</FieldLabel>
                <select value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} className={selectCls}>
                  {CATEGORIAS.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Via</FieldLabel>
                <Input value={form.via} onChange={set("via")} inputMode="numeric" placeholder="1" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* TITULAR */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Dados do portador" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome completo</FieldLabel>
              <Input value={form.nome} onChange={set("nome")} placeholder="ELIAS DOS SANTOS LEÃO" className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Abrangência</FieldLabel>
              <Input value={form.abrangencia} onChange={set("abrangencia")} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Identidade</FieldLabel>
              <Input value={form.identidade} onChange={set("identidade")} placeholder="3260848-9 SSP/AM" className={inputCls} required />
            </div>
          </div>

          {/* ARMA */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Crosshair} title="Dados da arma" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Nº da arma</FieldLabel>
                <Input value={form.armaNumero} onChange={set("armaNumero")} placeholder="78167" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Espécie</FieldLabel>
                <select value={form.especie} onChange={(e) => setForm((p) => ({ ...p, especie: e.target.value }))} className={selectCls}>
                  {ESPECIES.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel required>Marca</FieldLabel>
                <Input value={form.marca} onChange={set("marca")} placeholder="TAURUS" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Calibre</FieldLabel>
                <Input value={form.calibre} onChange={set("calibre")} placeholder="380" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Fabricação</FieldLabel>
                <Input value={form.fabricacao} onChange={set("fabricacao")} inputMode="numeric" placeholder="2008" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* EXPEDIÇÃO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Shield} title="Expedição e assinatura" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Data de expedição</FieldLabel>
                <Input value={form.dataExpedicao} onChange={setMask("dataExpedicao", maskDate)} inputMode="numeric" placeholder="23/11/2023" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Validade</FieldLabel>
                <Input value={form.validade} onChange={setMask("validade", maskDate)} inputMode="numeric" placeholder="21/11/2028" className={inputCls} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Assinante</FieldLabel>
              <Input value={form.assinante} onChange={set("assinante")} placeholder="FLAVIO MARCIO ALBERGEREGE SILVA" className={inputCls} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Cargo do assinante</FieldLabel>
                <Input value={form.cargo} onChange={set("cargo")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Unidade do assinante</FieldLabel>
                <Input value={form.unidade} onChange={set("unidade")} placeholder="SR/PF/AM" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Nº do porte (rodapé do verso)</FieldLabel>
              <Input value={form.numeroPorte} onChange={set("numeroPorte")} placeholder="438297892434" className={inputCls} />
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

      <PdfReadyDialog
        open={showReady}
        onOpenChange={setShowReady}
        pdfDataUrl={finalPdf || ""}
        fileName="porte-federal-arma.pdf"
        title="Porte Federal Arma"
        message={mensagem}
      />
    </div>
  );
}
