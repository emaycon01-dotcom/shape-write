import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload, X, User, Anchor, Ship, Loader2, FlaskConical, Trash2, Eye, CreditCard,
  ShieldCheck, Sparkles, RefreshCw, FileText, ArrowLeft, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadChaFieldPositions } from "@/lib/cha-align";
import testFotoUrl from "@/assets/test-foto.png";
import templateChaUrl from "@/assets/template-cha-bg-hq.webp";
import { loadTemplateBase64, loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskCPF, maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { syncChaToExternal } from "@/lib/cha-external-sync";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { pick, rnd } from "@/lib/random";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";

/** Categorias oficiais da CHA (Carteira de Habilitação de Amador) */
export const CHA_CATEGORIAS: { pt: string; en: string }[] = [
  { pt: "MOTONAUTA", en: "PERSONAL WATERCRAFT PILOT" },
  { pt: "VELEIRO", en: "SAILING BOAT PILOT" },
  { pt: "ARRAIS-AMADOR", en: "MOTORBOAT PILOT" },
  { pt: "MESTRE-AMADOR", en: "AMATEUR MASTER" },
  { pt: "CAPITÃO-AMADOR", en: "AMATEUR CAPTAIN" },
];

const LIMITES = [
  "INTERIOR. / INLAND WATERS.",
  "INTERIOR E COSTEIRA. / INLAND AND COASTAL WATERS.",
  "COSTEIRA. / COASTAL WATERS.",
  "MAR ABERTO. / OPEN SEA.",
];

interface ChaFormData {
  nome: string;
  cpf: string;
  nascimento: string;
  categoria: string;
  categoriaEn: string;
  validade: string;
  inscricao: string;
  limites: string;
  requisitos: string;
  orgao: string;
  dataEmissao: string;
  fotoData: string;
}

const initial: ChaFormData = {
  nome: "",
  cpf: "",
  nascimento: "",
  categoria: "MOTONAUTA",
  categoriaEn: "PERSONAL WATERCRAFT PILOT",
  validade: "",
  inscricao: "",
  limites: LIMITES[0],
  requisitos: "******** / ********",
  orgao: "MARINHA DO BRASIL",
  dataEmissao: "",
  fotoData: "",
};

const NOMES = ["ADEMAR SOUSA", "RICARDO ALVES MOREIRA", "PATRICIA NUNES DE LIMA", "FABIO SANTOS ROCHA"];

const ROUTE_KEY = "/dashboard/documents/cha";

export default function ChaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "cha").slice(0, 6);

  const [form, setForm] = useState<ChaFormData>(initial);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

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
          nome: b.nome || "",
          cpf: b.cpf || "",
          nascimento: b.nascimento || "",
          categoria: b.categoria || initial.categoria,
          categoriaEn: b.categoria_en || initial.categoriaEn,
          validade: b.validade || "",
          inscricao: b.inscricao || "",
          limites: b.limites || initial.limites,
          requisitos: b.requisitos || initial.requisitos,
          orgao: b.orgao || initial.orgao,
          dataEmissao: b.data_emissao || "",
          fotoData: b.foto_data || "",
        });
        setFotoPreview(b.foto_base64 || null);
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const imgToBase64 = (url: string) => loadTemplateBase64(url);

  const fillTest = async () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const emissao = `${dd}/${mm}/${hoje.getFullYear()}`;
    const validade = `${dd}/${mm}/${hoje.getFullYear() + 5}`;
    const cat = pick(CHA_CATEGORIAS);

    setFotoPreview(await imgToBase64(testFotoUrl));
    setForm({
      ...initial,
      nome: pick(NOMES),
      cpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      nascimento: `0${Math.floor(Math.random() * 9) + 1}/0${Math.floor(Math.random() * 9) + 1}/19${Math.floor(Math.random() * 40) + 60}`,
      categoria: cat.pt,
      categoriaEn: cat.en,
      validade,
      inscricao: `${rnd(3)}A${hoje.getFullYear() - 6}${rnd(6)}`,
      dataEmissao: emissao,
      fotoData: emissao,
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setFotoPreview(null);
    if (fotoRef.current) fotoRef.current.value = "";
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof ChaFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof ChaFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateChaUrl);
    return {
      nome: form.nome,
      cpf: form.cpf,
      nascimento: form.nascimento,
      categoria: form.categoria,
      categoria_en: form.categoriaEn,
      validade: form.validade,
      inscricao: form.inscricao,
      limites: form.limites,
      requisitos: form.requisitos,
      orgao: form.orgao,
      data_emissao: form.dataEmissao,
      foto_data: form.fotoData || form.dataEmissao,
      foto_base64: fotoPreview || "",
      template_base64: templateBase64,
      field_positions: loadChaFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form, fotoPreview]);

  const signature = useMemo(
    () => JSON.stringify(form) + "|" + (fotoPreview ? fotoPreview.length : 0),
    [form, fotoPreview]
  );

  const canPreview =
    form.nome.trim().length > 2 &&
    form.cpf.trim().length > 5 &&
    form.inscricao.trim().length > 2 &&
    form.dataEmissao.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-cha-pdf", {
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
        const bodyData = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-cha-pdf", { body: { ...bodyData, preview: false } });
        if (error) throw error;
        const pdfResult = data?.pdfBase64;
        if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`,
        });
        toast({ title: "Documento atualizado", description: "Atualizando o registro do QR Code..." });
        const resync = await syncChaToExternal(pdfResult, bodyData as unknown as Record<string, string>);
        toast(
          resync.ok
            ? { title: "QR Code atualizado", description: `Registro ${resync.documentoId} sincronizado.` }
            : {
                title: "Falha ao atualizar o QR Code",
                description: "O PDF foi atualizado, mas o registro externo não foi sincronizado.",
                variant: "destructive" as const,
              }
        );
        navigate("/dashboard/history");
      } catch (err) {
        console.error("Erro ao atualizar CHA:", err);
        toast({
          title: "Erro ao atualizar documento",
          description: describeError(err),
          variant: "destructive",
        });
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
    saveFormDraft("cha", form as unknown as Record<string, unknown>);
    try {
      const bodyData = await buildBody();

      // 1) Gera o PDF final ANTES de cobrar: se falhar, nenhum crédito é descontado.
      const { data, error } = await invokeGeneratePdf("generate-cha-pdf", {
        body: { ...bodyData, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`;

      // 2) PDF pronto — agora sim cobra o crédito.
      const deduction = await deductCredit(1, "geracao-cha", creditRef("geracao-cha", bodyData));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }
      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: (bodyData as Record<string, string>).nome || "",
        identification: (bodyData as Record<string, string>).cpf || "",
        date: (bodyData as Record<string, string>).data_emissao || "",
        description: `CNH Marítima (CHA) - ${(bodyData as Record<string, string>).categoria || ""}`,
        additionalInfo: JSON.stringify(bodyData),
        type: "cha",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      generatedSignature.current = signature;
      setShowReady(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });

      // Envio das fotos (4 partes) para o app externo de consulta
      syncChaToExternal(pdfFinal, bodyData as unknown as Record<string, string>).then((res) => {
        if (res.ok) {
          toast({
            title: "Fotos enviadas ao app de consulta",
            description: `Registro ${res.documentoId} sincronizado.`,
          });
        } else {
          console.error("Erro ao enviar CHA:", res.error);
          toast({
            title: "Envio ao app de consulta pendente",
            description: `Vamos reenviar sozinho em segundo plano. Motivo: ${res.error ?? "desconhecido"}`,
            variant: "destructive",
          });
        }
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

  const chaCpf = (form.cpf || "").replace(/\D/g, "");
  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Aqui estão seus dados de acesso à CNH Marítima (CHA):\n\nLogin: ${form.cpf || ""}\nSenha: ${chaCpf.slice(-6)}\n\nAcesse o site para visualizar seu documento:\nhttps://cidadaniagov-info.site/`;

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
        {previewPdf || finalPdf ? (
          <>
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf!} title="Prévia da CNH Marítima (CHA)" />
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
                : "Preencha nome, CPF, inscrição e data de emissão — a prévia atualiza sozinha enquanto você digita."}
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
                <Anchor className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold leading-tight text-foreground">CNH Marítima (CHA)</h1>
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
          <FormDraftsPanel docType="cha" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

          {/* AMADOR */}
          <div className={card}>
            <SectionHeader icon={User} title="Dados do Amador" hint="Identificação e foto" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Nome</FieldLabel>
                <Input value={form.nome} onChange={set("nome")} placeholder="Ex: ADEMAR SOUSA" className={inputCls} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel required>Data de Nascimento</FieldLabel>
                  <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="03/02/1998" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>CPF</FieldLabel>
                  <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="021.020.120-77" className={inputCls} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Foto 3x4</FieldLabel>
                  {fotoPreview ? (
                    <div className="relative inline-block">
                      <img src={fotoPreview} alt="Foto do amador" className="h-32 w-24 rounded-lg border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => { setFotoPreview(null); if (fotoRef.current) fotoRef.current.value = ""; }}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
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
                      <span className="text-[10px]">Enviar</span>
                    </button>
                  )}
                  <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Data na foto</FieldLabel>
                  <Input value={form.fotoData} onChange={setMask("fotoData", maskDate)} inputMode="numeric" placeholder="09/07/2026" className={inputCls} />
                  <p className="text-[11px] text-muted-foreground">Selo de data exibido no rodapé da foto.</p>
                </div>
              </div>
            </div>
          </div>

          {/* HABILITAÇÃO */}
          <div className={card}>
            <SectionHeader icon={Anchor} title="Habilitação" hint="Categoria e validade" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel required>Categoria</FieldLabel>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => {
                    const cat = CHA_CATEGORIAS.find((c) => c.pt === v);
                    setForm((p) => ({ ...p, categoria: v, categoriaEn: cat?.en || p.categoriaEn }));
                  }}
                >
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CHA_CATEGORIAS.map((c) => (
                      <SelectItem key={c.pt} value={c.pt}>{c.pt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Categoria (inglês)</FieldLabel>
                <Input value={form.categoriaEn} onChange={set("categoriaEn")} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel required>Data de Validade</FieldLabel>
                  <Input value={form.validade} onChange={setMask("validade", maskDate)} inputMode="numeric" placeholder="07/07/2031" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Nº de Inscrição</FieldLabel>
                  <Input value={form.inscricao} onChange={set("inscricao")} placeholder="085A2020066044" className={inputCls} required />
                </div>
              </div>
            </div>
          </div>

          {/* NAVEGAÇÃO */}
          <div className={card}>
            <SectionHeader icon={Ship} title="Navegação e Emissão" hint="Limites, requisitos e órgão" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <FieldLabel>Limites da Navegação</FieldLabel>
                <Select value={form.limites} onValueChange={(v) => setForm((p) => ({ ...p, limites: v }))}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {LIMITES.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Requisitos para conduzir a embarcação</FieldLabel>
                <Input value={form.requisitos} onChange={set("requisitos")} placeholder="******** / ********" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Órgão de Emissão</FieldLabel>
                  <Input value={form.orgao} onChange={set("orgao")} placeholder="MARINHA DO BRASIL" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel required>Data de Emissão</FieldLabel>
                  <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="07/07/2026" className={inputCls} required />
                </div>
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
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {isEditMode ? "Atualizando..." : "Gerando documento..."}</>
              ) : isEditMode ? (
                "Salvar alterações"
              ) : (
                <>Gerar PDF ({cost > 0 ? `${formatCredits(cost)} crédito` : "grátis"})</>
              )}
            </Button>
          </div>

          {/* HISTÓRICO */}
          <div className={card}>
            <SectionHeader icon={History} title="Últimas CHAs" />
            {previewHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma CHA gerada ainda.</p>
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
        fileName="cnh-maritima-cha.pdf"
        title="Cnh Maritima Cha"
        message={mensagem}
      />
    </div>
  );
}
