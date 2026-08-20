import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Car, User, UserCheck, FileText, Loader2, FlaskConical, Trash2,
  Eye, Sparkles, ShieldCheck, CreditCard, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadAtpvFieldPositions } from "@/lib/atpv-align";
import templateAtpvUrl from "@/assets/template-atpv-bg-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskAlnumUpper, maskCpfCnpj, maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { pick, rnd } from "@/lib/random";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";

interface AtpvFormData {
  uf: string;
  renavam: string;
  placa: string;
  anoFabricacao: string;
  anoModelo: string;
  marcaModelo: string;
  cat: string;
  cor: string;
  chassi: string;
  numeroCrv: string;
  codigoSegurancaCrv: string;
  numeroAtpve: string;
  dataEmissaoCrv: string;
  hodometro: string;
  vendNome: string;
  vendCpf: string;
  vendEmail: string;
  vendMunicipio: string;
  vendUf: string;
  valorVenda: string;
  local: string;
  dataVenda: string;
  compNome: string;
  compCpf: string;
  compEmail: string;
  compMunicipio: string;
  compUf: string;
  compEndereco: string;
  mensagens: string;
}

const initial: AtpvFormData = {
  uf: "PE",
  renavam: "",
  placa: "",
  anoFabricacao: "",
  anoModelo: "",
  marcaModelo: "",
  cat: "***",
  cor: "",
  chassi: "",
  numeroCrv: "",
  codigoSegurancaCrv: "",
  numeroAtpve: "",
  dataEmissaoCrv: "",
  hodometro: "",
  vendNome: "",
  vendCpf: "",
  vendEmail: "",
  vendMunicipio: "",
  vendUf: "PE",
  valorVenda: "",
  local: "",
  dataVenda: "",
  compNome: "",
  compCpf: "",
  compEmail: "",
  compMunicipio: "",
  compUf: "PE",
  compEndereco: "",
  mensagens: "",
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

const ROUTE_KEY = "/dashboard/documents/atpv";
const VALIDACAO_SITE = "https://verificaviosenetran.digital";

export default function AtpvFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "atpv").slice(0, 6);

  const [form, setForm] = useState<AtpvFormData>(initial);
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
          anoFabricacao: b.ano_fabricacao || "",
          anoModelo: b.ano_modelo || "",
          marcaModelo: b.marca_modelo || "",
          cat: b.cat || "***",
          cor: b.cor || "",
          chassi: b.chassi || "",
          numeroCrv: b.numero_crv || "",
          codigoSegurancaCrv: b.codigo_seguranca_crv || "",
          numeroAtpve: b.numero_atpve || "",
          dataEmissaoCrv: b.data_emissao_crv || "",
          hodometro: b.hodometro || "",
          vendNome: b.vend_nome || "",
          vendCpf: b.vend_cpf || "",
          vendEmail: b.vend_email || "",
          vendMunicipio: b.vend_municipio || "",
          vendUf: b.vend_uf || "",
          valorVenda: b.valor_venda || "",
          local: b.local || "",
          dataVenda: b.data_venda || "",
          compNome: b.comp_nome || "",
          compCpf: b.comp_cpf || "",
          compEmail: b.comp_email || "",
          compMunicipio: b.comp_municipio || "",
          compUf: b.comp_uf || "",
          compEndereco: b.comp_endereco || "",
          mensagens: b.mensagens || "",
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
    const nomeVend = pick(NOMES);
    const nomeComp = pick(NOMES.filter((n) => n !== nomeVend));
    setForm({
      ...initial,
      uf: "PE",
      renavam: rnd(11),
      placa: placaAleatoria(),
      anoFabricacao: "2013",
      anoModelo: "2014",
      marcaModelo: "FIAT/PALIO ATTRACTIV 1.0",
      cat: "***",
      cor: "PRATA",
      chassi: `9BD1965${rnd(10)}`,
      numeroCrv: rnd(12),
      codigoSegurancaCrv: rnd(11),
      numeroAtpve: rnd(12),
      dataEmissaoCrv: `${dd}/${mm}/${ano - 1}`,
      hodometro: rnd(6),
      vendNome: nomeVend,
      vendCpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      vendEmail: "vendedor@email.com",
      vendMunicipio: "RECIFE",
      vendUf: "PE",
      valorVenda: "32.500,00",
      local: "RECIFE PE",
      dataVenda: `${dd}/${mm}/${ano}`,
      compNome: nomeComp,
      compCpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      compEmail: "comprador@email.com",
      compMunicipio: "JABOATAO DOS GUARARAPES",
      compUf: "PE",
      compEndereco: "RUA DAS FLORES, 250 - CENTRO - CEP 54000-000",
      mensagens: "",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof AtpvFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof AtpvFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateAtpvUrl);
    return {
      uf: form.uf,
      renavam: form.renavam,
      placa: form.placa,
      ano_fabricacao: form.anoFabricacao,
      ano_modelo: form.anoModelo,
      marca_modelo: form.marcaModelo,
      cat: form.cat,
      cor: form.cor,
      chassi: form.chassi,
      numero_crv: form.numeroCrv,
      codigo_seguranca_crv: form.codigoSegurancaCrv,
      numero_atpve: form.numeroAtpve,
      data_emissao_crv: form.dataEmissaoCrv,
      hodometro: form.hodometro,
      vend_nome: form.vendNome,
      vend_cpf: form.vendCpf,
      vend_email: form.vendEmail,
      vend_municipio: form.vendMunicipio,
      vend_uf: form.vendUf,
      valor_venda: form.valorVenda,
      local: form.local,
      data_venda: form.dataVenda,
      comp_nome: form.compNome,
      comp_cpf: form.compCpf,
      comp_email: form.compEmail,
      comp_municipio: form.compMunicipio,
      comp_uf: form.compUf,
      comp_endereco: form.compEndereco,
      mensagens: form.mensagens,
      template_base64: templateBase64,
      field_positions: loadAtpvFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.placa.trim().length > 4 &&
    form.renavam.trim().length > 5 &&
    form.marcaModelo.trim().length > 2 &&
    form.vendNome.trim().length > 2 &&
    form.vendCpf.trim().length > 5 &&
    form.compNome.trim().length > 2 &&
    form.compCpf.trim().length > 5 &&
    form.valorVenda.trim().length > 0;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-atpv-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-atpv-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("atpv", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      // 1) Gera o PDF final ANTES de cobrar: se falhar, nenhum crédito é descontado.
      const { data, error } = await invokeGeneratePdf("generate-atpv-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      // 2) PDF pronto — agora sim cobra o crédito.
      const deduction = await deductCredit(1, "geracao-atpv", creditRef("geracao-atpv", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.vendNome || "",
        identification: form.vendCpf || "",
        date: form.dataVenda || "",
        description: `ATPV-e - ${form.placa || ""} ${form.marcaModelo || ""}`.trim(),
        additionalInfo: JSON.stringify(body),
        type: "atpv",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Sua ATPV-e está pronta.\n\nVendedor: ${form.vendNome || ""}\nComprador: ${form.compNome || ""}\nPlaca: ${(form.placa || "").toUpperCase()}\nRENAVAM: ${form.renavam || ""}\nValor da venda: R$ ${form.valorVenda || ""}\n\nValidação pelo QR Code do documento: ${VALIDACAO_SITE}`;

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

  /* ---------------- painel de preview ---------------- */
  const previewPanel = (
    <div className="glass flex h-full flex-col overflow-hidden p-0">
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

      <div className="relative min-h-[420px] flex-1 overflow-hidden bg-secondary/30">
        {previewPdf || finalPdf ? (
          <>
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf!} title="Prévia do ATPV-e" />
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
              {previewError || "Preencha placa, RENAVAM, vendedor, comprador e valor — a prévia atualiza sozinha enquanto você digita."}
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
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">ATPV-e</h1>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              <Sparkles className="h-3 w-3" /> Prévia em tempo real
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Crédito só na geração final
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }} className="space-y-6">

          <FormDraftsPanel docType="atpv" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

          {/* VEÍCULO */}
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
                <FieldLabel required>Código RENAVAM</FieldLabel>
                <Input value={form.renavam} onChange={setMask("renavam", maskDigits(11))} inputMode="numeric" placeholder="00335436552" className={inputCls} required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Ano de fabricação</FieldLabel>
                <Input value={form.anoFabricacao} onChange={setMask("anoFabricacao", maskDigits(4))} inputMode="numeric" placeholder="2013" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Ano do modelo</FieldLabel>
                <Input value={form.anoModelo} onChange={setMask("anoModelo", maskDigits(4))} inputMode="numeric" placeholder="2014" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>CAT</FieldLabel>
                <Input value={form.cat} onChange={set("cat")} placeholder="***" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Marca / Modelo / Versão</FieldLabel>
              <Input value={form.marcaModelo} onChange={set("marcaModelo")} placeholder="FIAT/PALIO ATTRACTIV 1.0" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Cor predominante</FieldLabel>
                <Input value={form.cor} onChange={set("cor")} placeholder="PRATA" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Chassi</FieldLabel>
                <Input value={form.chassi} onChange={setMask("chassi", maskAlnumUpper(17))} placeholder="9BD19650012345678" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Número do CRV</FieldLabel>
                <Input value={form.numeroCrv} onChange={setMask("numeroCrv", maskDigits(12))} inputMode="numeric" placeholder="213012407278" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Código de segurança do CRV</FieldLabel>
                <Input value={form.codigoSegurancaCrv} onChange={setMask("codigoSegurancaCrv", maskDigits(11))} inputMode="numeric" placeholder="02775028150" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Número do ATPV-e</FieldLabel>
                <Input value={form.numeroAtpve} onChange={setMask("numeroAtpve", maskDigits(12))} inputMode="numeric" placeholder="542652688000" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Data de emissão do CRV</FieldLabel>
                <Input value={form.dataEmissaoCrv} onChange={setMask("dataEmissaoCrv", maskDate)} inputMode="numeric" placeholder="25/04/2023" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Hodômetro</FieldLabel>
                <Input value={form.hodometro} onChange={setMask("hodometro", maskDigits(7))} inputMode="numeric" placeholder="128450" className={inputCls} />
              </div>
            </div>
          </div>

          {/* VENDEDOR */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Vendedor" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome / Razão social</FieldLabel>
              <Input value={form.vendNome} onChange={set("vendNome")} placeholder="MARIA JOSE RODRIGUES XAVIER" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>CPF / CNPJ</FieldLabel>
                <Input value={form.vendCpf} onChange={setMask("vendCpf", maskCpfCnpj)} inputMode="numeric" placeholder="744.088.444-20" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>E-mail</FieldLabel>
                <Input value={form.vendEmail} onChange={set("vendEmail")} placeholder="vendedor@email.com" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <FieldLabel>Município</FieldLabel>
                <Input value={form.vendMunicipio} onChange={set("vendMunicipio")} placeholder="RECIFE" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>UF</FieldLabel>
                <Input value={form.vendUf} onChange={set("vendUf")} maxLength={2} placeholder="PE" className={inputCls} />
              </div>
            </div>
          </div>

          {/* VENDA */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={FileText} title="Dados da venda" />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Valor declarado (R$)</FieldLabel>
                <Input value={form.valorVenda} onChange={set("valorVenda")} placeholder="32.500,00" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Local</FieldLabel>
                <Input value={form.local} onChange={set("local")} placeholder="RECIFE PE" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Data</FieldLabel>
                <Input value={form.dataVenda} onChange={setMask("dataVenda", maskDate)} inputMode="numeric" placeholder="25/04/2023" className={inputCls} />
              </div>
            </div>
          </div>

          {/* COMPRADOR */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={UserCheck} title="Comprador" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome / Razão social</FieldLabel>
              <Input value={form.compNome} onChange={set("compNome")} placeholder="CARLOS FERREIRA LIMA" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>CPF / CNPJ</FieldLabel>
                <Input value={form.compCpf} onChange={setMask("compCpf", maskCpfCnpj)} inputMode="numeric" placeholder="744.088.444-20" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>E-mail</FieldLabel>
                <Input value={form.compEmail} onChange={set("compEmail")} placeholder="comprador@email.com" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <FieldLabel>Município</FieldLabel>
                <Input value={form.compMunicipio} onChange={set("compMunicipio")} placeholder="JABOATAO DOS GUARARAPES" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>UF</FieldLabel>
                <Input value={form.compUf} onChange={set("compUf")} maxLength={2} placeholder="PE" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Endereço completo</FieldLabel>
              <Input value={form.compEndereco} onChange={set("compEndereco")} placeholder="RUA DAS FLORES, 250 - CENTRO - CEP 54000-000" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Mensagens do DENATRAN (opcional)</FieldLabel>
              <Input value={form.mensagens} onChange={set("mensagens")} placeholder="Deixe vazio para manter o padrão do documento" className={inputCls} />
            </div>
          </div>

          {/* PRÉVIA — só no mobile/tablet, entre o formulário e o botão */}
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
          <div className="glass p-6">
            <SectionHeader icon={FileText} title="Últimas ATPV-e" />
            {previewHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ATPV-e gerada ainda.</p>
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
        fileName={`atpv-${(form.placa || "digital").toLowerCase()}.pdf`}
        title="ATPV-e"
        message={mensagem}
      />
    </div>
  );
}
