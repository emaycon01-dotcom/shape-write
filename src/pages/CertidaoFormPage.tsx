import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BabyIcon, Loader2, FlaskConical, Trash2, FileText, User, Building2, Eye, CreditCard, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadCertidaoFieldPositions } from "@/lib/certidao-align";
import templateCertidaoUrl from "@/assets/template-certidao-bg-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskTime, maskCPF, maskPhone, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";
import { rnd } from "@/lib/random";

interface CertidaoFormData {
  nome: string;
  cpf: string;
  matricula: string;
  dataNasc: string;
  horaNasc: string;
  naturalidade: string;
  municipioRegistro: string;
  localNasc: string;
  sexo: string;
  filiacao: string;
  avos: string;
  gemeos: string;
  nomeGemeos: string;
  dataRegistro: string;
  dataEmissao: string;

  cartorioCidade: string;
  cartorioUf: string;
  oficial: string;
  escrevente: string;
  cartorioEndereco: string;
  cartorioCep: string;
  cartorioEmail: string;
  cartorioTelefone: string;
}

const initial: CertidaoFormData = {
  nome: "",
  cpf: "",
  matricula: "",
  dataNasc: "",
  horaNasc: "",
  naturalidade: "",
  municipioRegistro: "",
  localNasc: "",
  sexo: "FEMININO",
  filiacao: "",
  avos: "",
  gemeos: "NÃO",
  nomeGemeos: "",
  dataRegistro: "",
  dataEmissao: "",

  cartorioCidade: "São José dos Pinhais",
  cartorioUf: "PR",
  oficial: "Lidia Kruppizak",
  escrevente: "Valdinei Simões Custodio",
  cartorioEndereco: "Rua Doutor Motta Júnior, 1309 - Centro - CEP:",
  cartorioCep: "83005-170",
  cartorioEmail: "cartorioadmsjp@gmail.com",
  cartorioTelefone: "(41) 30811616",
};

const ROUTE_KEY = "/dashboard/documents/certidao-nascimento";

export default function CertidaoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<CertidaoFormData>(initial);
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
          nome: b.nome || "",
          cpf: b.cpf || "",
          matricula: b.matricula || "",
          dataNasc: b.data_nasc || "",
          horaNasc: b.hora_nasc || "",
          naturalidade: b.naturalidade || "",
          municipioRegistro: b.municipio_registro || "",
          localNasc: b.local_nasc || "",
          sexo: b.sexo || p.sexo,
          filiacao: b.filiacao || "",
          avos: b.avos || "",
          gemeos: b.gemeos || p.gemeos,
          nomeGemeos: b.nome_gemeos || "",
          dataRegistro: b.data_registro || "",
          dataEmissao: b.data_emissao || "",
          cartorioCidade: b.cartorio_cidade || p.cartorioCidade,
          cartorioUf: b.cartorio_uf || p.cartorioUf,
          oficial: b.oficial || p.oficial,
          escrevente: b.escrevente || p.escrevente,
          cartorioEndereco: b.cartorio_endereco || p.cartorioEndereco,
          cartorioCep: b.cartorio_cep || p.cartorioCep,
          cartorioEmail: b.cartorio_email || p.cartorioEmail,
          cartorioTelefone: b.cartorio_telefone || p.cartorioTelefone,
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof CertidaoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof CertidaoFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    setForm({
      ...initial,
      nome: "Caroline Coan Leal",
      cpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      matricula: `${rnd(6)} 01 55 1990 1 ${rnd(5)} ${rnd(3)} ${rnd(7)} ${rnd(2)}`,
      dataNasc: "27/02/1990",
      horaNasc: "23H 20MIN",
      naturalidade: "São José dos Pinhais-PR",
      municipioRegistro: "São José dos Pinhais-PR",
      localNasc: "Novaclínica Hospital e Maternidade, São José dos Pinhais-PR",
      filiacao: "Jorge Carlos Fernandes Leal e Edna Maria Coan",
      avos: "Antonio de Freitas Leal, Odete Fernandes Leal, Alfredo Domingo Coan e Erica Pacheco Coan",
      dataRegistro: "05/03/1990",
      dataEmissao: "01/02/2023",
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
    const templateBase64 = await loadTemplateObjectUrl(templateCertidaoUrl);
    return {
      nome: form.nome,
      cpf: form.cpf,
      matricula: form.matricula,
      data_nasc: form.dataNasc,
      hora_nasc: form.horaNasc,
      naturalidade: form.naturalidade,
      municipio_registro: form.municipioRegistro,
      local_nasc: form.localNasc,
      sexo: form.sexo,
      filiacao: form.filiacao,
      avos: form.avos,
      gemeos: form.gemeos,
      nome_gemeos: form.nomeGemeos,
      data_registro: form.dataRegistro,
      data_emissao: form.dataEmissao,

      cartorio_cidade: form.cartorioCidade,
      cartorio_uf: form.cartorioUf,
      oficial: form.oficial,
      escrevente: form.escrevente,
      cartorio_endereco: form.cartorioEndereco,
      cartorio_cep: form.cartorioCep,
      cartorio_email: form.cartorioEmail,
      cartorio_telefone: form.cartorioTelefone,

      template_base64: templateBase64,
      field_positions: loadCertidaoFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.nome.trim().length > 2 &&
    form.matricula.trim().length > 5 &&
    form.filiacao.trim().length > 2 &&
    form.dataNasc.length === 10 &&
    form.dataRegistro.length === 10 &&
    form.dataEmissao.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-certidao-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-certidao-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("certidao", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-certidao-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-certidao", creditRef("geracao-certidao", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nome || "",
        identification: form.cpf || form.matricula || "",
        date: form.dataNasc || "",
        description: `Certidão de Nascimento - ${form.cartorioCidade || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "certidao-nascimento",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Sua Certidão de Nascimento está pronta.\n\nNome: ${form.nome}\nMatrícula: ${form.matricula}\nNascimento: ${form.dataNasc}`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia da Certidão de Nascimento" />
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
              {previewError || "Preencha nome, matrícula, filiação e datas — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Certidão de Nascimento</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="certidao" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* REGISTRADO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Dados do registrado" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome completo</FieldLabel>
              <Input value={form.nome} onChange={set("nome")} placeholder="Ex: Caroline Coan Leal" className={inputCls} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>CPF</FieldLabel>
                <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="000.000.000-00" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Sexo</FieldLabel>
                <select value={form.sexo} onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value }))} className={selectCls}>
                  <option value="FEMININO">FEMININO</option>
                  <option value="MASCULINO">MASCULINO</option>
                  <option value="IGNORADO">IGNORADO</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Matrícula</FieldLabel>
              <Input value={form.matricula} onChange={set("matricula")} placeholder="000687 01 55 1990 1 00031 189 0031464 43" className={inputCls} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Data de nascimento</FieldLabel>
                <Input value={form.dataNasc} onChange={setMask("dataNasc", maskDate)} inputMode="numeric" placeholder="27/02/1990" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Hora de nascimento</FieldLabel>
                <Input value={form.horaNasc} onChange={set("horaNasc")} placeholder="23H 20MIN" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Naturalidade</FieldLabel>
              <Input value={form.naturalidade} onChange={set("naturalidade")} placeholder="São José dos Pinhais-PR" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Município de registro e UF</FieldLabel>
              <Input value={form.municipioRegistro} onChange={set("municipioRegistro")} placeholder="São José dos Pinhais-PR" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Local, município de nascimento e UF</FieldLabel>
              <Input value={form.localNasc} onChange={set("localNasc")} placeholder="Hospital e Maternidade, Cidade-UF" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Filiação</FieldLabel>
              <Input value={form.filiacao} onChange={set("filiacao")} placeholder="Pai e Mãe" className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Avós</FieldLabel>
              <Input value={form.avos} onChange={set("avos")} placeholder="Avô paterno, avó paterna, avô materno e avó materna" className={inputCls} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Gêmeos</FieldLabel>
                <select value={form.gemeos} onChange={(e) => setForm((p) => ({ ...p, gemeos: e.target.value }))} className={selectCls}>
                  <option value="NÃO">NÃO</option>
                  <option value="SIM">SIM</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <FieldLabel>Nome e matrícula dos gêmeos</FieldLabel>
                <Input value={form.nomeGemeos} onChange={set("nomeGemeos")} className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Data do registro</FieldLabel>
                <Input value={form.dataRegistro} onChange={setMask("dataRegistro", maskDate)} inputMode="numeric" placeholder="05/03/1990" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Data de emissão</FieldLabel>
                <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="01/02/2023" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* CARTÓRIO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Building2} title="Cartório" />

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <FieldLabel required>Cidade</FieldLabel>
                <Input value={form.cartorioCidade} onChange={set("cartorioCidade")} className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>UF</FieldLabel>
                <select value={form.cartorioUf} onChange={(e) => setForm((p) => ({ ...p, cartorioUf: e.target.value }))} className={selectCls}>
                  {ESTADOS_UF.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Oficial</FieldLabel>
                <Input value={form.oficial} onChange={set("oficial")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Escrevente</FieldLabel>
                <Input value={form.escrevente} onChange={set("escrevente")} className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Endereço</FieldLabel>
              <Input value={form.cartorioEndereco} onChange={set("cartorioEndereco")} className={inputCls} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>CEP</FieldLabel>
                <Input value={form.cartorioCep} onChange={setMask("cartorioCep", maskCEP)} inputMode="numeric" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Telefone</FieldLabel>
                <Input value={form.cartorioTelefone} onChange={setMask("cartorioTelefone", maskPhone)} inputMode="numeric" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>E-mail</FieldLabel>
                <Input value={form.cartorioEmail} onChange={set("cartorioEmail")} className={inputCls} />
              </div>
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
        fileName="certidao-nascimento.pdf"
        title="Certidao Nascimento"
        message={mensagem}
      />
    </div>
  );
}
