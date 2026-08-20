import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FlaskConical, Trash2, FileText, User, Building2, Scroll, Eye, CreditCard, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadObitoFieldPositions } from "@/lib/obito-align";
import templateObitoUrl from "@/assets/template-obito-bg-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF, maskPhone, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";
import { rnd } from "@/lib/random";

interface ObitoFormData {
  nome: string;
  cpf: string;
  matricula: string;
  sexo: string;
  cor: string;
  estadoCivil: string;
  naturalidade: string;
  documentoId: string;
  eleitor: string;
  filiacao: string;
  dataFalecimento: string;
  horaFalecimento: string;
  localFalecimento: string;
  causaMorte: string;
  sepultamento: string;
  declarante: string;
  medico: string;
  averbacoes: string;
  anotacoes: string;
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

const initial: ObitoFormData = {
  nome: "",
  cpf: "SEM INFORMAÇÃO",
  matricula: "",
  sexo: "FEMININO",
  cor: "BRANCA",
  estadoCivil: "",
  naturalidade: "",
  documentoId: "SEM INFORMAÇÃO",
  eleitor: "SIM",
  filiacao: "",
  dataFalecimento: "",
  horaFalecimento: "",
  localFalecimento: "",
  causaMorte: "",
  sepultamento: "",
  declarante: "",
  medico: "",
  averbacoes: "",
  anotacoes: "",
  dataEmissao: "",

  cartorioCidade: "São Paulo - 20º Subdistrito - Jardim América",
  cartorioUf: "SP",
  oficial: "Liana Varzella Mimary",
  escrevente: "Amanda Silva Ferreira",
  cartorioEndereco: "Rua Henrique Schaumann, 518 - Pinheiros - CEP:",
  cartorioCep: "05413-010",
  cartorioEmail: "certidoes@cartoriojardimamerica.com.br",
  cartorioTelefone: "(11) 30819388",
};

const ROUTE_KEY = "/dashboard/documents/certidao-obito";

export default function ObitoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<ObitoFormData>(initial);
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
          cpf: b.cpf || p.cpf,
          matricula: b.matricula || "",
          sexo: b.sexo || p.sexo,
          cor: b.cor || p.cor,
          estadoCivil: b.estado_civil || "",
          naturalidade: b.naturalidade || "",
          documentoId: b.documento_id || p.documentoId,
          eleitor: b.eleitor || p.eleitor,
          filiacao: b.filiacao || "",
          dataFalecimento: b.data_falecimento || "",
          horaFalecimento: b.hora_falecimento || "",
          localFalecimento: b.local_falecimento || "",
          causaMorte: b.causa_morte || "",
          sepultamento: b.sepultamento || "",
          declarante: b.declarante || "",
          medico: b.medico || "",
          averbacoes: b.averbacoes || "",
          anotacoes: b.anotacoes || "",
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

  const set = (field: keyof ObitoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof ObitoFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    setForm({
      ...initial,
      nome: "Elis Regina Carvalho Costa",
      matricula: `${rnd(6)} 01 55 1982 4 ${rnd(5)} ${rnd(3)} ${rnd(7)} ${rnd(2)}`,
      estadoCivil: "DESQUITADA - 36 ANOS DE IDADE",
      naturalidade: "DE PORTO ALEGRE, RIO GRANDE DO SUL",
      filiacao:
        "RESIDENTE NA RUA DR. MELO ALVES, N° 668, APARTAMENTO 52, SÃO PAULO *** FILIAÇÃO: ROMEU DE OLIVEIRA COSTA E ERCY CARVALHO COSTA. ***",
      dataFalecimento: "19/01/1982",
      horaFalecimento: "12:00 H",
      localFalecimento: "NO HOSPITAL DAS CLÍNICAS ***",
      causaMorte: "INDETERMINADA ***",
      sepultamento: "SEPULTAMENTO REALIZADO NO CEMITÉRIO DO MORUMBI.",
      declarante: "Rogerio Carvalho Costa",
      medico: "DR. JOSÉ LUIZ LOURENÇÃO CRM Nº 20011 ***",
      averbacoes:
        "ERA DESQUITADA DE RONALDO FERNANDES ESQUERDO BOSCOLI, DEIXANDO UM FILHO DE NOME: JOÃO MARCELO, COM ONZE ANOS. DEIXOU BENS. ERA ELEITORA. DEIXOU, DE OUTRA UNIÃO, DOIS FILHOS DE NOMES: PEDRO E MARIA RITA, COM SEIS E QUATRO ANOS, RESPECTIVAMENTE. ATO REGISTRADO NO LIVRO C-0154, ÀS FLS. 126, SOB Nº 70150, EM VINTE E UM DE JANEIRO DE MIL NOVECENTOS E OITENTA E DOIS (21/01/1982), CONFORME DECLARAÇÃO Nº 026010, EXPEDIDA PELO SERVIÇO FUNERÁRIO. NADA MAIS ME CUMPRE CERTIFICAR. ***",
      dataEmissao: "11/01/2022",
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
    const templateBase64 = await loadTemplateObjectUrl(templateObitoUrl);
    return {
      nome: form.nome,
      cpf: form.cpf,
      matricula: form.matricula,
      sexo: form.sexo,
      cor: form.cor,
      estado_civil: form.estadoCivil,
      naturalidade: form.naturalidade,
      documento_id: form.documentoId,
      eleitor: form.eleitor,
      filiacao: form.filiacao,
      data_falecimento: form.dataFalecimento,
      hora_falecimento: form.horaFalecimento,
      local_falecimento: form.localFalecimento,
      causa_morte: form.causaMorte,
      sepultamento: form.sepultamento,
      declarante: form.declarante,
      medico: form.medico,
      averbacoes: form.averbacoes,
      anotacoes: form.anotacoes,
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
      field_positions: loadObitoFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.nome.trim().length > 2 &&
    form.matricula.trim().length > 5 &&
    form.dataFalecimento.length === 10 &&
    form.filiacao.trim().length > 5 &&
    form.dataEmissao.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-obito-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-obito-pdf", { body: { ...body, preview: false } });
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
    saveFormDraft("obito", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-obito-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-obito", creditRef("geracao-obito", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.nome || "",
        identification: form.cpf || form.matricula || "",
        date: form.dataFalecimento || "",
        description: `Certidão de Óbito - ${form.cartorioCidade || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "certidao-obito",
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Sua Certidão de Óbito está pronta.\n\nNome: ${form.nome}\nMatrícula: ${form.matricula}\nFalecimento: ${form.dataFalecimento}`;

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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia da Certidão de Óbito" />
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
              {previewError || "Preencha nome, matrícula, filiação, data de falecimento e de emissão — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Certidão de Óbito</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <form
          onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }}
          className="space-y-6"
        >
          <FormDraftsPanel docType="obito" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* FALECIDO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Dados do falecido" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome completo</FieldLabel>
              <Input value={form.nome} onChange={set("nome")} placeholder="Ex: Elis Regina Carvalho Costa" className={inputCls} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>CPF</FieldLabel>
                <Input value={form.cpf} onChange={setMask("cpf", (v) => (/\d/.test(v) ? maskCPF(v) : v))} placeholder="000.000.000-00 ou SEM INFORMAÇÃO" className={inputCls} />
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
              <Input value={form.matricula} onChange={set("matricula")} placeholder="122721 01 55 1982 4 00154 126 0070150 42" className={inputCls} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Cor</FieldLabel>
                <select value={form.cor} onChange={(e) => setForm((p) => ({ ...p, cor: e.target.value }))} className={selectCls}>
                  {["BRANCA", "PARDA", "PRETA", "AMARELA", "INDÍGENA", "IGNORADA"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Eleitor</FieldLabel>
                <select value={form.eleitor} onChange={(e) => setForm((p) => ({ ...p, eleitor: e.target.value }))} className={selectCls}>
                  <option value="SIM">SIM</option>
                  <option value="NÃO">NÃO</option>
                  <option value="SEM INFORMAÇÃO">SEM INFORMAÇÃO</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Estado civil e idade</FieldLabel>
              <Input value={form.estadoCivil} onChange={set("estadoCivil")} placeholder="DESQUITADA - 36 ANOS DE IDADE" className={inputCls} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Naturalidade</FieldLabel>
                <Input value={form.naturalidade} onChange={set("naturalidade")} placeholder="DE PORTO ALEGRE, RIO GRANDE DO SUL" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Documento de identificação</FieldLabel>
                <Input value={form.documentoId} onChange={set("documentoId")} className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Filiação e residência</FieldLabel>
              <Textarea value={form.filiacao} onChange={set("filiacao")} rows={3} placeholder="RESIDENTE NA RUA... *** FILIAÇÃO: PAI E MÃE. ***" className={inputCls} required />
            </div>
          </div>

          {/* ÓBITO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Scroll} title="Dados do óbito" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>Data do falecimento</FieldLabel>
                <Input value={form.dataFalecimento} onChange={setMask("dataFalecimento", maskDate)} inputMode="numeric" placeholder="19/01/1982" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Hora do falecimento</FieldLabel>
                <Input value={form.horaFalecimento} onChange={set("horaFalecimento")} placeholder="12:00 H" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Local do falecimento</FieldLabel>
              <Input value={form.localFalecimento} onChange={set("localFalecimento")} placeholder="NO HOSPITAL DAS CLÍNICAS ***" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Causa da morte</FieldLabel>
              <Input value={form.causaMorte} onChange={set("causaMorte")} placeholder="INDETERMINADA ***" className={inputCls} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Sepultamento / cremação</FieldLabel>
                <Input value={form.sepultamento} onChange={set("sepultamento")} placeholder="SEPULTAMENTO REALIZADO NO CEMITÉRIO..." className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Declarante</FieldLabel>
                <Input value={form.declarante} onChange={set("declarante")} placeholder="Nome do declarante" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Médico que atestou o óbito</FieldLabel>
              <Input value={form.medico} onChange={set("medico")} placeholder="DR. JOSÉ LUIZ LOURENÇÃO CRM Nº 20011 ***" className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Averbações / anotações a acrescer</FieldLabel>
              <Textarea value={form.averbacoes} onChange={set("averbacoes")} rows={6} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Anotações de cadastro</FieldLabel>
              <Input value={form.anotacoes} onChange={set("anotacoes")} placeholder="Deixe vazio para manter SEM INFORMAÇÕES." className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Data de emissão</FieldLabel>
              <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="11/01/2022" className={inputCls} required />
            </div>
          </div>

          {/* CARTÓRIO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={Building2} title="Cartório" />

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <FieldLabel required>Cidade / subdistrito</FieldLabel>
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
        fileName="certidao-obito.pdf"
        title="Certidao Obito"
        message={mensagem}
      />
    </div>
  );
}
