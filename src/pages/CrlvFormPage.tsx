import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Car, User, Gauge, ShieldCheck, Loader2, FlaskConical, Trash2, ChevronDown,
  Eye, FileText, RefreshCw, CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadCrlvFieldPositions } from "@/lib/crlv-align";
import templateCrlvUrl from "@/assets/template-crlv-bg-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskAlnumUpper, maskCpfCnpj, maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { pick, rnd } from "@/lib/random";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";

interface CrlvFormData {
  uf: string;
  renavam: string;
  placa: string;
  exercicio: string;
  anoFabricacao: string;
  anoModelo: string;
  numeroCrv: string;
  codigoCla: string;
  cat: string;
  marcaModelo: string;
  especieTipo: string;
  placaAnterior: string;
  chassi: string;
  cor: string;
  combustivel: string;
  observacoes: string;
  categoria: string;
  capacidade: string;
  potencia: string;
  pesoBruto: string;
  motor: string;
  cmt: string;
  eixos: string;
  lotacao: string;
  carroceria: string;
  nome: string;
  cpfCnpj: string;
  local: string;
  data: string;
}

const initial: CrlvFormData = {
  uf: "PE",
  renavam: "",
  placa: "",
  exercicio: String(new Date().getFullYear()),
  anoFabricacao: "",
  anoModelo: "",
  numeroCrv: "",
  codigoCla: "",
  cat: "***",
  marcaModelo: "",
  especieTipo: "",
  placaAnterior: "",
  chassi: "",
  cor: "",
  combustivel: "",
  observacoes: "",
  categoria: "PARTICULAR",
  capacidade: "",
  potencia: "",
  pesoBruto: "",
  motor: "",
  cmt: "",
  eixos: "",
  lotacao: "",
  carroceria: "",
  nome: "",
  cpfCnpj: "",
  local: "",
  data: "",
};

const NOMES = [
  "MARIA JOSE RODRIGUES XAVIER",
  "CARLOS FERREIRA LIMA",
  "ANA PAULA COSTA SILVA",
  "MARCOS ANTONIO DE SOUZA",
];

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function placaAleatoria() {
  const l = () => LETRAS[Math.floor(Math.random() * 26)];
  return `${l()}${l()}${l()}${rnd(1)}${l()}${rnd(2)}`;
}

const ROUTE_KEY = "/dashboard/documents/crlv";

export default function CrlvFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<CrlvFormData>(initial);
  const [dpvatOpen, setDpvatOpen] = useState(false);
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
          uf: b.uf || initial.uf,
          renavam: b.renavam || "",
          placa: b.placa || "",
          exercicio: b.exercicio || "",
          anoFabricacao: b.ano_fabricacao || "",
          anoModelo: b.ano_modelo || "",
          numeroCrv: b.numero_crv || "",
          codigoCla: b.codigo_cla || "",
          cat: b.cat || "***",
          marcaModelo: b.marca_modelo || "",
          especieTipo: b.especie_tipo || "",
          placaAnterior: b.placa_anterior || "",
          chassi: b.chassi || "",
          cor: b.cor || "",
          combustivel: b.combustivel || "",
          observacoes: b.observacoes || "",
          categoria: b.categoria || "",
          capacidade: b.capacidade || "",
          potencia: b.potencia || "",
          pesoBruto: b.peso_bruto || "",
          motor: b.motor || "",
          cmt: b.cmt || "",
          eixos: b.eixos || "",
          lotacao: b.lotacao || "",
          carroceria: b.carroceria || "",
          nome: b.nome || "",
          cpfCnpj: b.cpf_cnpj || "",
          local: b.local || "",
          data: b.data || "",
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
    const ano = hoje.getFullYear();
    setForm({
      ...initial,
      uf: "PE",
      renavam: rnd(11),
      placa: placaAleatoria(),
      exercicio: String(ano),
      anoFabricacao: "2011",
      anoModelo: "2011",
      numeroCrv: rnd(12),
      codigoCla: rnd(11),
      cat: "***",
      marcaModelo: "VW/8.120 EURO3",
      especieTipo: "CARGA CAMINHAO",
      placaAnterior: `${placaAleatoria()}/RN`,
      chassi: `9533452R8BR${rnd(6)}`,
      cor: "VERMELHA",
      combustivel: "DIESEL",
      observacoes: "CARGA,",
      categoria: "ALUGUEL",
      capacidade: "4.74",
      potencia: "115CV/4300",
      pesoBruto: "7.7",
      motor: "E2T03816 SUBSTITUIDO",
      cmt: "10.5",
      eixos: "2",
      lotacao: "03P",
      carroceria: "CARROCERIA FECHADA",
      nome: pick(NOMES),
      cpfCnpj: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      local: "JUREMA PE",
      data: `${dd}/${mm}/${ano}`,
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof CrlvFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof CrlvFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateCrlvUrl);
    return {
      uf: form.uf,
      renavam: form.renavam,
      placa: form.placa,
      exercicio: form.exercicio,
      ano_fabricacao: form.anoFabricacao,
      ano_modelo: form.anoModelo,
      numero_crv: form.numeroCrv,
      codigo_cla: form.codigoCla,
      cat: form.cat,
      marca_modelo: form.marcaModelo,
      especie_tipo: form.especieTipo,
      placa_anterior: form.placaAnterior,
      chassi: form.chassi,
      cor: form.cor,
      combustivel: form.combustivel,
      observacoes: form.observacoes,
      categoria: form.categoria,
      capacidade: form.capacidade,
      potencia: form.potencia,
      peso_bruto: form.pesoBruto,
      motor: form.motor,
      cmt: form.cmt,
      eixos: form.eixos,
      lotacao: form.lotacao,
      carroceria: form.carroceria,
      nome: form.nome,
      cpf_cnpj: form.cpfCnpj,
      local: form.local,
      data: form.data,
      template_base64: templateBase64,
      field_positions: loadCrlvFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.uf.trim().length === 2 &&
    form.placa.trim().length >= 6 &&
    form.renavam.trim().length >= 9 &&
    form.marcaModelo.trim().length > 2 &&
    form.nome.trim().length > 2 &&
    form.cpfCnpj.trim().length > 5;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-crlv-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-crlv-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("crlv", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      // 1) Gera o PDF final ANTES de cobrar: se falhar, nenhum crédito é descontado.
      const { data, error } = await invokeGeneratePdf("generate-crlv-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      // 2) PDF pronto — agora sim cobra o crédito.
      const deduction = await deductCredit(1, "geracao-crlv", creditRef("geracao-crlv", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nome || "",
        identification: form.cpfCnpj || "",
        date: form.data || "",
        description: `CRLV Digital - ${form.placa || ""} ${form.marcaModelo || ""}`.trim(),
        additionalInfo: JSON.stringify(body),
        type: "crlv",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu CRLV Digital está pronto.\n\nProprietário: ${form.nome}\nPlaca: ${(form.placa || "").toUpperCase()}\nRENAVAM: ${form.renavam}\nExercício: ${form.exercicio}\n\nValide pelo QR Code do documento.`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do CRLV Digital" />
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
                : "Preencha UF, placa, RENAVAM, marca/modelo, nome e CPF/CNPJ — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">CRLV Digital</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="crlv" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* IDENTIFICAÇÃO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Car} title="Identificação do veículo" />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>UF (DETRAN)</FieldLabel>
                <Input value={form.uf} onChange={set("uf")} placeholder="PE" maxLength={2} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Placa</FieldLabel>
                <Input value={form.placa} onChange={set("placa")} placeholder="NQK8I74" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Exercício</FieldLabel>
                <Input value={form.exercicio} onChange={setMask("exercicio", maskDigits(4))} inputMode="numeric" placeholder="2023" className={inputCls} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Código RENAVAM</FieldLabel>
                <Input value={form.renavam} onChange={setMask("renavam", maskDigits(11))} inputMode="numeric" placeholder="00335436552" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Número do CRV</FieldLabel>
                <Input value={form.numeroCrv} onChange={setMask("numeroCrv", maskDigits(12))} inputMode="numeric" placeholder="213012407278" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Ano de fabricação</FieldLabel>
                <Input value={form.anoFabricacao} onChange={setMask("anoFabricacao", maskDigits(4))} inputMode="numeric" placeholder="2011" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Ano do modelo</FieldLabel>
                <Input value={form.anoModelo} onChange={setMask("anoModelo", maskDigits(4))} inputMode="numeric" placeholder="2011" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Código de segurança do CLA</FieldLabel>
                <Input value={form.codigoCla} onChange={setMask("codigoCla", maskDigits(11))} inputMode="numeric" placeholder="02775028150" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>CAT</FieldLabel>
                <Input value={form.cat} onChange={set("cat")} placeholder="***" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Marca / Modelo / Versão</FieldLabel>
              <Input value={form.marcaModelo} onChange={set("marcaModelo")} placeholder="VW/8.120 EURO3" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Espécie / Tipo</FieldLabel>
                <Input value={form.especieTipo} onChange={set("especieTipo")} placeholder="CARGA CAMINHAO" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Carroceria</FieldLabel>
                <Input value={form.carroceria} onChange={set("carroceria")} placeholder="CARROCERIA FECHADA" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Placa anterior / UF</FieldLabel>
                <Input value={form.placaAnterior} onChange={set("placaAnterior")} placeholder="NQK8874/RN" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Chassi</FieldLabel>
                <Input value={form.chassi} onChange={setMask("chassi", maskAlnumUpper(17))} inputMode="text" placeholder="9533452R8BR155089" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Cor predominante</FieldLabel>
                <Input value={form.cor} onChange={set("cor")} placeholder="VERMELHA" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Combustível</FieldLabel>
                <Input value={form.combustivel} onChange={set("combustivel")} placeholder="DIESEL" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Observações do veículo</FieldLabel>
              <Input value={form.observacoes} onChange={set("observacoes")} placeholder="CARGA," className={inputCls} />
            </div>
          </div>

          {/* CARACTERÍSTICAS */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Gauge} title="Características técnicas" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Categoria</FieldLabel>
                <Input value={form.categoria} onChange={set("categoria")} placeholder="ALUGUEL" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Capacidade</FieldLabel>
                <Input value={form.capacidade} onChange={set("capacidade")} placeholder="4.74" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Potência / Cilindrada</FieldLabel>
                <Input value={form.potencia} onChange={set("potencia")} placeholder="115CV/4300" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Peso bruto total</FieldLabel>
                <Input value={form.pesoBruto} onChange={set("pesoBruto")} placeholder="7.7" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2 space-y-1.5">
                <FieldLabel>Motor</FieldLabel>
                <Input value={form.motor} onChange={set("motor")} placeholder="E2T03816" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>CMT</FieldLabel>
                <Input value={form.cmt} onChange={set("cmt")} placeholder="10.5" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Eixos</FieldLabel>
                <Input value={form.eixos} onChange={set("eixos")} placeholder="2" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Lotação</FieldLabel>
              <Input value={form.lotacao} onChange={set("lotacao")} placeholder="03P" className={inputCls} />
            </div>
          </div>

          {/* PROPRIETÁRIO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Proprietário e emissão" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome</FieldLabel>
              <Input value={form.nome} onChange={set("nome")} placeholder="MARIA JOSE RODRIGUES XAVIER" className={inputCls} required />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>CPF / CNPJ</FieldLabel>
                <Input value={form.cpfCnpj} onChange={setMask("cpfCnpj", maskCpfCnpj)} inputMode="numeric" placeholder="744.088.444-20" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Local</FieldLabel>
                <Input value={form.local} onChange={set("local")} placeholder="JUREMA PE" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Data</FieldLabel>
                <Input value={form.data} onChange={setMask("data", maskDate)} inputMode="numeric" placeholder="25/04/2023" className={inputCls} />
              </div>
            </div>
          </div>

          {/* DPVAT (opcional) */}
          <div className="glass p-6">
            <button
              type="button"
              onClick={() => setDpvatOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-bold text-foreground">Seguro DPVAT (opcional)</h2>
                  <p className="text-[11px] text-muted-foreground">Deixe vazio para manter os asteriscos do padrão oficial</p>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${dpvatOpen ? "rotate-180" : ""}`} />
            </button>

            {dpvatOpen && (
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
                <p className="col-span-2 text-xs text-muted-foreground">
                  O modelo oficial atual traz o bloco DPVAT preenchido com asteriscos. Esses campos são
                  gerados automaticamente e não precisam de alteração.
                </p>
              </div>
            )}
          </div>

          {/* PRÉVIA — mobile/tablet */}
          <div className="xl:hidden">{previewPanel}</div>

          <div className="hidden justify-center pt-1 xl:flex">
            <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando documento...</>
              ) : isEditMode ? (
                "Salvar alterações"
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
        fileName={`crlv-${(form.placa || "digital").toLowerCase()}.pdf`}
        title="CRLV Digital"
        message={mensagem}
      />
    </div>
  );
}
