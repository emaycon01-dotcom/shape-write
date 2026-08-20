import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, FlaskConical, Trash2, FileText, User, Shield, Upload, X, Eye, RefreshCw, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadCrafFieldPositions } from "@/lib/craf-align";
import templateCrafUrl from "@/assets/template-craf-bg-hq.webp";
import testFotoUrl from "@/assets/test-foto.png";

import { loadTemplateBase64, loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";

/** Redimensiona a foto 3x4 para ~600px de largura em JPEG (< 300 KB). */
function compressFoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.onload = () => {
        const maxW = 600;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível"));
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}


interface CrafFormData {
  validade: string;
  nome: string;
  cpf: string;
  rg: string;
  sfpc: string;
  amparo: string;
  registro: string;
  tipo: string;
  marca: string;
  calibre: string;
  numeroSerie: string;
  numeroSigma: string;
  dataExpedicao: string;
  assinante: string;
  cidade: string;
}

const initial: CrafFormData = {
  validade: "",
  nome: "",
  cpf: "",
  rg: "",
  sfpc: "Cmdo 4ª RM",
  amparo: "art. 3º da Lei 10.826/03 e art. 4 do Decreto 9.847/19.",
  registro: "",
  tipo: "CARABINA / FUZIL",
  marca: "",
  calibre: "",
  numeroSerie: "",
  numeroSigma: "",
  dataExpedicao: "",
  assinante: "SFPC - 4º GAAAe",
  cidade: "Sete Lagoas/MG",
};

const TIPOS = [
  "CARABINA / FUZIL",
  "PISTOLA",
  "REVÓLVER",
  "ESPINGARDA",
  "GARRUCHA",
  "SUBMETRALHADORA",
];

const ROUTE_KEY = "/dashboard/documents/craf";

export default function CrafFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<CrafFormData>(initial);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
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
          validade: b.validade || "",
          nome: b.nome || "",
          cpf: b.cpf || "",
          rg: b.rg || "",
          sfpc: b.sfpc || p.sfpc,
          amparo: b.amparo || p.amparo,
          registro: b.registro || "",
          tipo: b.tipo || p.tipo,
          marca: b.marca || "",
          calibre: b.calibre || "",
          numeroSerie: b.numero_serie || "",
          numeroSigma: b.numero_sigma || "",
          dataExpedicao: b.data_expedicao || "",
          assinante: b.assinante || p.assinante,
          cidade: b.cidade || p.cidade,
        }));
        if (b.foto_base64) setFotoPreview(b.foto_base64);
        setHydrated(true);

      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof CrafFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof CrafFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = async () => {
    setFotoPreview(await loadTemplateBase64(testFotoUrl).catch(() => ""));
    setForm({

      ...initial,
      validade: "30/03/2032",
      nome: "Bruno Henrique Couto Neves",
      cpf: "015.063.256-88",
      rg: "MG-10.617.978",
      registro: "ADT ELET SISFPC NR 72 DE 30/03/2022, 4º GAAAE",
      marca: "AMADEO ROSSI",
      calibre: "357 Magnum",
      numeroSerie: "NVH 4712721",
      numeroSigma: "1817992",
      dataExpedicao: "30/03/2022",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setFotoPreview(null);
    setPreviewPdf(null);
    if (fotoRef.current) fotoRef.current.value = "";
    toast({ title: "Formulário limpo!" });
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setFotoPreview(await compressFoto(file));
    } catch {
      toast({ title: "Não foi possível carregar a foto", variant: "destructive" });
    }
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateCrafUrl);
    return {
      validade: form.validade,
      nome: form.nome,
      cpf: form.cpf,
      rg: form.rg,
      sfpc: form.sfpc,
      amparo: form.amparo,
      registro: form.registro,
      tipo: form.tipo,
      marca: form.marca,
      calibre: form.calibre,
      numero_serie: form.numeroSerie,
      numero_sigma: form.numeroSigma,
      data_expedicao: form.dataExpedicao,
      assinante: form.assinante,
      cidade: form.cidade,
      foto_base64: fotoPreview || "",

      template_base64: templateBase64,
      field_positions: loadCrafFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form, fotoPreview]);

  const signature = useMemo(() => JSON.stringify({ form, fotoPreview }), [form, fotoPreview]);

  const canPreview =
    Boolean(fotoPreview) &&
    form.nome.trim().length > 2 &&
    form.cpf.trim().length > 5 &&
    form.registro.trim().length > 2 &&
    form.marca.trim().length > 1 &&
    form.calibre.trim().length > 1 &&
    form.numeroSerie.trim().length > 1 &&
    form.numeroSigma.trim().length > 1 &&
    form.dataExpedicao.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-craf-pdf", {
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
    if (!fotoPreview) {
      toast({
        title: "Foto 3x4 obrigatória",
        description: "A foto do titular é exibida na validação do QR Code.",
        variant: "destructive",
      });
      return;
    }

    if (isEditMode && editState?.editDocId) {
      setGenerating(true);
      try {
        const body = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-craf-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("craf", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      // 1) Gera o PDF final ANTES de cobrar: se falhar, nenhum crédito é descontado.
      const { data, error } = await invokeGeneratePdf("generate-craf-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      // 2) PDF pronto — agora sim cobra o crédito.
      const deduction = await deductCredit(1, "geracao-craf", creditRef("geracao-craf", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nome || "",
        identification: form.cpf || "",
        date: form.dataExpedicao || "",
        description: `CRAF - ${form.tipo || ""} ${form.marca || ""} ${form.calibre || ""}`.trim(),
        additionalInfo: JSON.stringify(body),
        type: "craf",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu CRAF está pronto.\n\nTitular: ${form.nome}\nArma: ${form.tipo} ${form.marca}\nCalibre: ${form.calibre}\nNº SIGMA: ${form.numeroSigma}`;

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

  /* ---------------- painel de preview (reutilizado em 2 posições) ---------------- */
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do CRAF" />
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
                : "Envie a foto e preencha nome, CPF e dados da arma — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">CRAF — Registro de Arma</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="craf" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* TITULAR */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Dados do titular" />

            <div className="space-y-1.5">
              <FieldLabel required>Foto 3x4 (validação do QR Code)</FieldLabel>
              {fotoPreview ? (
                <div className="relative inline-block">
                  <img src={fotoPreview} alt="Foto do titular" className="h-32 w-24 rounded-lg border border-border object-cover" />
                  <button
                    type="button"
                    onClick={() => { setFotoPreview(null); if (fotoRef.current) fotoRef.current.value = ""; }}
                    className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fotoRef.current?.click()}
                  className="flex h-32 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-secondary/50 text-muted-foreground"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-[11px]">Enviar</span>
                </button>
              )}
              <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Nome completo</FieldLabel>
              <Input value={form.nome} onChange={set("nome")} placeholder="Bruno Henrique Couto Neves" className={inputCls} required />
            </div>


            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>CPF</FieldLabel>
                <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="015.063.256-88" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>RG</FieldLabel>
                <Input value={form.rg} onChange={set("rg")} placeholder="MG-10.617.978" className={inputCls} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>SFPC de vinculação (RM)</FieldLabel>
                <Input value={form.sfpc} onChange={set("sfpc")} placeholder="Cmdo 4ª RM" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Validade</FieldLabel>
                <Input value={form.validade} onChange={setMask("validade", maskDate)} inputMode="numeric" placeholder="30/03/2032" className={inputCls} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Amparo legal</FieldLabel>
              <Input value={form.amparo} onChange={set("amparo")} className={inputCls} />
            </div>
          </div>

          {/* ARMA */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Crosshair} title="Dados da arma" />

            <div className="space-y-1.5">
              <FieldLabel required>Registro</FieldLabel>
              <Input value={form.registro} onChange={set("registro")} placeholder="ADT ELET SISFPC NR 72 DE 30/03/2022, 4º GAAAE" className={inputCls} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Tipo</FieldLabel>
                <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))} className={selectCls}>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Marca</FieldLabel>
                <Input value={form.marca} onChange={set("marca")} placeholder="AMADEO ROSSI" className={inputCls} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel required>Calibre</FieldLabel>
                <Input value={form.calibre} onChange={set("calibre")} placeholder="357 Magnum" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Nº de série</FieldLabel>
                <Input value={form.numeroSerie} onChange={set("numeroSerie")} placeholder="NVH 4712721" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Nº SIGMA</FieldLabel>
                <Input value={form.numeroSigma} onChange={set("numeroSigma")} placeholder="1817992" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* EXPEDIÇÃO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Shield} title="Expedição e assinatura" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <FieldLabel required>Data de expedição</FieldLabel>
                <Input value={form.dataExpedicao} onChange={setMask("dataExpedicao", maskDate)} inputMode="numeric" placeholder="30/03/2022" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Assinante</FieldLabel>
                <Input value={form.assinante} onChange={set("assinante")} placeholder="SFPC - 4º GAAAe" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Cidade</FieldLabel>
                <Input value={form.cidade} onChange={set("cidade")} placeholder="Sete Lagoas/MG" className={inputCls} required />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              O QR Code de autenticidade é gerado automaticamente a partir dos dados acima.
            </p>
          </div>

          {/* PRÉVIA — mobile/tablet */}
          <div className="xl:hidden">{previewPanel}</div>

          <div className="hidden justify-center pt-1 xl:flex">
            <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando documento...</>
              ) : isEditMode ? (
                <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
              ) : (
                <><CreditCard className="mr-2 h-5 w-5" /> Gerar PDF ({cost > 0 ? `${formatCredits(cost)} crédito` : "grátis"})</>
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
        fileName="craf.pdf"
        title="Craf"
        message={mensagem}
      />
    </div>
  );
}
