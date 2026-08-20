import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, User, FileText, Info, Loader2, FlaskConical, Trash2, IdCard, ChevronDown, Eye, CreditCard, ShieldCheck, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadRgFieldPositions } from "@/lib/rg-align";
import testFotoUrl from "@/assets/test-foto.png";
import testAssUrl from "@/assets/test-assinatura.png";
import templateRgUrl from "@/assets/template-rg-bg-hq.webp";
import { loadTemplateBase64, loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskCPF, maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";
import { syncRgToExternal } from "@/lib/rg-external-sync";
import { pick, rnd } from "@/lib/random";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const UF_EXTENSO: Record<string, string> = {
  AC: "ACRE", AL: "ALAGOAS", AP: "AMAPÁ", AM: "AMAZONAS", BA: "BAHIA", CE: "CEARÁ",
  DF: "DISTRITO FEDERAL", ES: "ESPÍRITO SANTO", GO: "GOIÁS", MA: "MARANHÃO",
  MT: "MATO GROSSO", MS: "MATO GROSSO DO SUL", MG: "MINAS GERAIS", PA: "PARÁ",
  PB: "PARAÍBA", PR: "PARANÁ", PE: "PERNAMBUCO", PI: "PIAUÍ", RJ: "RIO DE JANEIRO",
  RN: "RIO GRANDE DO NORTE", RS: "RIO GRANDE DO SUL", RO: "RONDÔNIA", RR: "RORAIMA",
  SC: "SANTA CATARINA", SP: "SÃO PAULO", SE: "SERGIPE", TO: "TOCANTINS",
};

const TIPOS_SANGUINEOS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const ESTADOS_CIVIS = ["SOLTEIRO(A)","CASADO(A)","DIVORCIADO(A)","VIÚVO(A)","SEPARADO(A)"];

interface RgFormData {
  cpf: string;
  nomeCompleto: string;
  nomeSocial: string;
  uf: string;
  estado: string;
  sexo: string;
  nacionalidade: string;
  dataNascimento: string;
  naturalidade: string;
  dataValidade: string;
  registroGeral: string;
  filiacao1: string;
  filiacao2: string;
  orgaoExpedidor: string;
  localEmissao: string;
  dataEmissao: string;
  tituloEleitor: string;
  tipoSanguineo: string;
  estadoCivil: string;
  doador: string;
  certidao: string;
  cnh: string;
  categoria: string;
  pisPasep: string;
  nis: string;
  nit: string;
  ctps: string;
  dni: string;
  cns: string;
  observacaoSaude: string;
}

const initial: RgFormData = {
  cpf: "", nomeCompleto: "", nomeSocial: "", uf: "", estado: "", sexo: "",
  nacionalidade: "BRA", dataNascimento: "", naturalidade: "", dataValidade: "",
  registroGeral: "", filiacao1: "", filiacao2: "", orgaoExpedidor: "",
  localEmissao: "", dataEmissao: "", tituloEleitor: "", tipoSanguineo: "",
  estadoCivil: "", doador: "NÃO", certidao: "", cnh: "", categoria: "",
  pisPasep: "", nis: "", nit: "", ctps: "", dni: "", cns: "", observacaoSaude: "",
};

function randomDate(startYear: number, endYear: number) {
  const d = Math.floor(Math.random() * 28) + 1;
  const m = Math.floor(Math.random() * 12) + 1;
  const y = startYear + Math.floor(Math.random() * (endYear - startYear));
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

const NOMES = ["HUELLISON DOS SANTOS CASTRO","MARIA OLIVEIRA SANTOS","CARLOS FERREIRA LIMA","ANA PAULA COSTA"];
const MAES = ["MARIA RAIMUNDA DA COSTA DOS SANTOS","ANA FERREIRA DA SILVA","CLAUDIA OLIVEIRA LIMA"];
const PAIS = ["JOSE LUIZ DE SOUZA CASTRO","ANTONIO FERREIRA LIMA","MARCOS OLIVEIRA DIAS"];

const ROUTE_KEY = "/dashboard/documents/rg";

export default function RgFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, addDocument } = useDocuments();

  const [form, setForm] = useState<RgFormData>(initial);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [assPreview, setAssPreview] = useState<string | null>(null);
  const [outrasOpen, setOutrasOpen] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);
  const assRef = useRef<HTMLInputElement>(null);
  const { user, deductCredit } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(editState?.editDocId);
  const cost = planCost(1, user?.plano);

  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoLive, setAutoLive] = useState(true);
  const previewSeq = useRef(0);
  const generatedSignature = useRef<string | null>(null);

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
          cpf: b.cpf || "", nomeCompleto: b.nome_completo || "", nomeSocial: b.nome_social || "",
          uf: b.local_emissao || "", estado: b.estado || "", sexo: b.sexo || "",
          nacionalidade: b.nacionalidade || "BRA", dataNascimento: b.data_nascimento || "",
          naturalidade: b.naturalidade || "", dataValidade: b.data_validade || "",
          registroGeral: b.registro_geral || "", filiacao1: b.filiacao1 || "", filiacao2: b.filiacao2 || "",
          orgaoExpedidor: b.orgao_expedidor || "", localEmissao: b.local_emissao || "",
          dataEmissao: b.data_emissao || "", tituloEleitor: b.titulo_eleitor || "",
          tipoSanguineo: b.tipo_sanguineo || "", estadoCivil: b.estado_civil || "",
          doador: b.doador || "NÃO", certidao: b.certidao || "", cnh: b.cnh || "",
          categoria: b.categoria || "", pisPasep: b.pis_pasep || "", nis: b.nis || "",
          nit: b.nit || "", ctps: b.ctps || "", dni: b.dni || "", cns: b.cns || "",
          observacaoSaude: b.observacao_saude || "",
        });
        setFotoPreview(b.foto_base64 || null);
        setAssPreview(b.assinatura_base64 || null);
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const imgToBase64 = (url: string) => loadTemplateBase64(url);

  const fillTest = async () => {
    const uf = pick(UF_LIST);
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    setForm({
      cpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      nomeCompleto: pick(NOMES),
      nomeSocial: "",
      uf,
      estado: UF_EXTENSO[uf],
      sexo: pick(["M", "F"]),
      nacionalidade: "BRA",
      dataNascimento: randomDate(1975, 2005),
      naturalidade: `MANAUS - ${uf}`,
      dataValidade: `${dd}/${mm}/${today.getFullYear() + 10}`,
      registroGeral: rnd(11),
      filiacao1: pick(MAES),
      filiacao2: pick(PAIS),
      orgaoExpedidor: `SSP-${uf}`,
      localEmissao: uf,
      dataEmissao: `${dd}/${mm}/${today.getFullYear()}`,
      tituloEleitor: rnd(14),
      tipoSanguineo: pick(TIPOS_SANGUINEOS),
      estadoCivil: pick(ESTADOS_CIVIS),
      doador: pick(["SIM", "NÃO"]),
      certidao: `MANAUS - ${uf} 1.SUBD. CN:LV E672/FLS.180 /N°43474`,
      cnh: rnd(11),
      categoria: pick(["A", "B", "AB", "AD"]),
      pisPasep: rnd(11),
      nis: rnd(11),
      nit: rnd(11),
      ctps: rnd(13),
      dni: rnd(10),
      cns: rnd(15),
      observacaoSaude: "",
    });
    const [fotoB64, assB64] = await Promise.all([imgToBase64(testFotoUrl), imgToBase64(testAssUrl)]);
    setFotoPreview(fotoB64);
    setAssPreview(assB64);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setFotoPreview(null);
    setAssPreview(null);
    if (fotoRef.current) fotoRef.current.value = "";
    if (assRef.current) assRef.current.value = "";
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof RgFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof RgFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const setSelect = (field: keyof RgFormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setPreview: (s: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateRgUrl);
    return {
      nome_completo: form.nomeCompleto,
      nome_social: form.nomeSocial,
      cpf: form.cpf,
      registro_geral: form.registroGeral,
      sexo: form.sexo,
      data_nascimento: form.dataNascimento,
      nacionalidade: form.nacionalidade,
      naturalidade: form.naturalidade,
      data_validade: form.dataValidade,
      estado: form.estado || UF_EXTENSO[form.uf] || "",
      filiacao1: form.filiacao1,
      filiacao2: form.filiacao2,
      orgao_expedidor: form.orgaoExpedidor,
      local_emissao: form.localEmissao || form.uf,
      data_emissao: form.dataEmissao,
      titulo_eleitor: form.tituloEleitor,
      tipo_sanguineo: form.tipoSanguineo,
      estado_civil: form.estadoCivil,
      doador: form.doador,
      certidao: form.certidao,
      cnh: form.cnh,
      categoria: form.categoria,
      pis_pasep: form.pisPasep,
      nis: form.nis,
      nit: form.nit,
      ctps: form.ctps,
      dni: form.dni,
      cns: form.cns,
      observacao_saude: form.observacaoSaude,
      foto_base64: fotoPreview || "",
      assinatura_base64: assPreview || "",
      template_base64: templateBase64,
      field_positions: loadRgFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form, fotoPreview, assPreview]);

  const signature = useMemo(
    () => JSON.stringify(form) + "|" + (fotoPreview ? fotoPreview.length : 0) + "|" + (assPreview ? assPreview.length : 0),
    [form, fotoPreview, assPreview]
  );

  const canPreview = form.nomeCompleto.trim().length > 2 && form.cpf.trim().length > 5 && form.registroGeral.trim().length > 3;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-rg-pdf", { body: { ...body, preview: true } });
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

  const handleGenerate = async () => {
    if (!user) return;

    if (isEditMode && editState?.editDocId) {
      setGenerating(true);
      try {
        const bodyData = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-rg-pdf", { body: { ...bodyData, preview: false } });
        if (error) throw error;
        const pdfResult = data?.pdfBase64;
        if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`,
        });
        toast({ title: "Documento atualizado", description: "Atualizando o registro do QR Code..." });
        const resync = await syncRgToExternal(pdfResult, bodyData as unknown as Record<string, string>);
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
        console.error("Erro ao atualizar RG:", err);
        toast({
          title: "Erro ao atualizar documento",
          description: err instanceof Error ? err.message : "Tente novamente.",
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
    saveFormDraft("rg", form as unknown as Record<string, unknown>);
    try {
      const bodyData = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-rg-pdf", { body: { ...bodyData, preview: false } });
      if (error) throw new Error(`falha_geracao:${error.message || ""}`);
      if (data?.validacao_registrada !== true) {
        throw new Error("validacao_rg_nao_confirmada");
      }
      const generated = data?.pdfBase64 || data?.pdfUrl;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-rg", creditRef("geracao-rg", bodyData));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }
      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: (bodyData as Record<string, string>).nome_completo || "",
        identification: (bodyData as Record<string, string>).cpf || "",
        date: (bodyData as Record<string, string>).data_emissao || "",
        description: `RG Digital - ${(bodyData as Record<string, string>).orgao_expedidor || ""}`,
        additionalInfo: JSON.stringify(bodyData),
        type: "rg",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      generatedSignature.current = signature;
      setShowReady(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });

      syncRgToExternal(pdfFinal, bodyData as unknown as Record<string, string>).then((res) => {
        if (res.ok) {
          toast({ title: "Enviado para o app de consulta", description: `Registro ${res.documentoId} sincronizado.` });
        } else {
          toast({
            title: "Envio ao app de consulta pendente",
            description: `Vamos reenviar sozinho em segundo plano. Motivo: ${res.error ?? "desconhecido"}`,
            variant: "destructive",
          });
        }
      });
    } catch (e) {
      console.error("Falha na geração:", e);
      toast({ title: "Erro ao gerar documento", description: `Nenhum crédito foi descontado. ${describeError(e)}`, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";

  const FieldLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-sm font-semibold text-primary">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-3 pb-2 mb-2 border-b border-border/50">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );

  const UploadBox = ({
    label, preview, inputRef, onChange, onClear, aspect,
  }: {
    label: string; preview: string | null; inputRef: React.RefObject<HTMLInputElement>;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void; aspect: string;
  }) => (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt={label} className={`rounded-lg border border-border object-cover ${aspect}`} />
          <button type="button" onClick={onClear} className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-secondary/50 text-muted-foreground ${aspect}`}>
          <Upload className="h-5 w-5" />
          <span className="text-[10px]">Enviar</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );

  const cpf = form.cpf?.replace(/\D/g, "") || "";
  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Aqui estão seus dados de acesso ao RG Digital:\n\nLogin: ${form.cpf || cpf}\nSenha: ${cpf.slice(-6)}\n\nAcesse o site para visualizar seu documento:\nhttps://cidadaniagov-info.site/`;

  const previewPanel = (
    <div className="glass flex h-full flex-col p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Prévia do documento</span>
          {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAutoLive((v) => !v)} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${autoLive ? "border-primary/40 bg-primary/12 text-primary" : "border-border bg-secondary text-muted-foreground"}`}>
            {autoLive ? "Ao vivo" : "Manual"}
          </button>
          <button type="button" onClick={() => void runPreview()} disabled={!canPreview || previewing} className="rounded-full border border-border bg-secondary p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40" aria-label="Atualizar prévia">
            <RefreshCw className={`h-3.5 w-3.5 ${previewing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="relative min-h-[420px] flex-1 overflow-hidden bg-secondary/30">
        {previewPdf || finalPdf ? (
          <>
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf!} title="Prévia do RG Digital" />
            {!finalPdf && (
              <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
                <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsl(var(--destructive) / 0.05) 80px, hsl(var(--destructive) / 0.05) 82px)" }} />
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} className="absolute whitespace-nowrap text-[17px] font-bold text-destructive/20" style={{ transform: "rotate(-35deg)", top: `${10 + (i % 4) * 25}%`, left: `${-10 + Math.floor(i / 4) * 40}%`, letterSpacing: "2px" }}>
                    MonkeyLab MonkeyLab
                  </span>
                ))}
              </div>
            )}
            {previewing && <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden"><div className="h-full w-full animate-pulse bg-primary/70" /></div>}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/20">
              {previewing ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <FileText className="h-6 w-6 text-primary" />}
            </span>
            <p className="text-sm font-semibold text-foreground">{previewing ? "Montando a prévia..." : "A prévia aparece aqui"}</p>
            <p className="max-w-xs text-xs text-muted-foreground">{previewError || "Preencha nome, CPF e registro geral — a prévia atualiza sozinha enquanto você digita."}</p>
          </div>
        )}
      </div>
      <p className="border-t border-border/50 px-5 py-2.5 text-center text-[11px] text-muted-foreground">A marca d'água sai apenas no PDF final gerado.</p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-28 xl:pb-8">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard/documents")} className="text-sm text-muted-foreground hover:text-foreground">← Voltar</button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <FlaskConical className="h-3.5 w-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </Button>
        </div>
      </div>

      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">RG Digital (CIN)</h1>
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

          <FormDraftsPanel docType="rg" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Dados Pessoais" />
            <div className="space-y-1.5">
              <FieldLabel required>Nome Completo</FieldLabel>
              <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: HUELLISON DOS SANTOS CASTRO" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nome Social</FieldLabel>
              <Input value={form.nomeSocial} onChange={set("nomeSocial")} placeholder="Opcional" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>CPF</FieldLabel>
                <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="000.000.000-00" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Registro Geral (nº impresso)</FieldLabel>
                <Input value={form.registroGeral} onChange={setMask("registroGeral", maskDigits(12))} inputMode="numeric" placeholder="02770162233" className={inputCls} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Sexo</FieldLabel>
                <Select value={form.sexo} onValueChange={setSelect("sexo")}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Nacionalidade</FieldLabel>
                <Input value={form.nacionalidade} onChange={set("nacionalidade")} placeholder="BRA" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Data de Nascimento</FieldLabel>
                <Input value={form.dataNascimento} onChange={setMask("dataNascimento", maskDate)} inputMode="numeric" placeholder="23/10/1993" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Naturalidade</FieldLabel>
                <Input value={form.naturalidade} onChange={set("naturalidade")} placeholder="MANAUS - AM" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <UploadBox label="Foto 3x4" preview={fotoPreview} inputRef={fotoRef} onChange={(e) => handleFile(e, setFotoPreview)} onClear={() => { setFotoPreview(null); if (fotoRef.current) fotoRef.current.value = ""; }} aspect="h-32 w-24" />
              <UploadBox label="Assinatura" preview={assPreview} inputRef={assRef} onChange={(e) => handleFile(e, setAssPreview)} onClear={() => { setAssPreview(null); if (assRef.current) assRef.current.value = ""; }} aspect="h-20 w-40" />
            </div>
            <p className="text-[11px] text-muted-foreground">A foto e a assinatura são preenchidas uma única vez e aparecem duas vezes no documento (frente e verso).</p>
          </div>

          <div className="glass space-y-4 p-6">
            <SectionHeader icon={FileText} title="Emissão" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>UF de emissão</FieldLabel>
                <Select value={form.uf} onValueChange={(v) => setForm((p) => ({ ...p, uf: v, estado: UF_EXTENSO[v] || "", localEmissao: v, orgaoExpedidor: `SSP-${v}` }))}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Estado (cabeçalho)</FieldLabel>
                <Input value={form.estado} onChange={set("estado")} placeholder="AMAZONAS" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Órgão Expedidor</FieldLabel>
                <Input value={form.orgaoExpedidor} onChange={set("orgaoExpedidor")} placeholder="SSP-AM" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Local de emissão</FieldLabel>
                <Input value={form.localEmissao} onChange={set("localEmissao")} placeholder="AM" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Data de Emissão</FieldLabel>
                <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="23/05/2025" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Data de Validade</FieldLabel>
                <Input value={form.dataValidade} onChange={setMask("dataValidade", maskDate)} inputMode="numeric" placeholder="23/05/2035" className={inputCls} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Filiação 1 (mãe)</FieldLabel>
              <Input value={form.filiacao1} onChange={set("filiacao1")} placeholder="MARIA RAIMUNDA DA COSTA DOS SANTOS" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Filiação 2 (pai)</FieldLabel>
              <Input value={form.filiacao2} onChange={set("filiacao2")} placeholder="JOSE LUIZ DE SOUZA CASTRO" className={inputCls} />
            </div>
          </div>

          <div className="glass p-6">
            <button type="button" onClick={() => setOutrasOpen((v) => !v)} className="flex w-full items-center gap-3 text-left">
              <Info className="h-5 w-5 text-primary" />
              <span className="flex-1">
                <span className="block text-lg font-bold text-foreground">Outras Informações</span>
                <span className="block text-xs text-muted-foreground">Opcional — toque para {outrasOpen ? "fechar" : "selecionar e preencher"}</span>
              </span>
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Opcional</span>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${outrasOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={outrasOpen ? "mt-4 space-y-4 border-t border-border/50 pt-4" : "hidden"}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Título de eleitor</FieldLabel>
                  <Input value={form.tituloEleitor} onChange={set("tituloEleitor")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Tipo sanguíneo / Fator RH</FieldLabel>
                  <Select value={form.tipoSanguineo} onValueChange={setSelect("tipoSanguineo")}>
                    <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{TIPOS_SANGUINEOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Estado civil</FieldLabel>
                  <Select value={form.estadoCivil} onValueChange={setSelect("estadoCivil")}>
                    <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{ESTADOS_CIVIS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Doador de órgãos</FieldLabel>
                  <Select value={form.doador} onValueChange={setSelect("doador")}>
                    <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIM">SIM</SelectItem>
                      <SelectItem value="NÃO">NÃO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Certidão de Nasc./Casamento/Averb. Divórcio</FieldLabel>
                <Input value={form.certidao} onChange={set("certidao")} className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>CNH</FieldLabel>
                  <Input value={form.cnh} onChange={set("cnh")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Categoria</FieldLabel>
                  <Input value={form.categoria} onChange={set("categoria")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>PIS / PASEP</FieldLabel>
                  <Input value={form.pisPasep} onChange={set("pisPasep")} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>NIS</FieldLabel>
                  <Input value={form.nis} onChange={set("nis")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>NIT</FieldLabel>
                  <Input value={form.nit} onChange={set("nit")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Carteira de trabalho</FieldLabel>
                  <Input value={form.ctps} onChange={set("ctps")} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>DNI</FieldLabel>
                  <Input value={form.dni} onChange={set("dni")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>CNS</FieldLabel>
                  <Input value={form.cns} onChange={set("cns")} className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Observação de Saúde</FieldLabel>
                <Input value={form.observacaoSaude} onChange={set("observacaoSaude")} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="xl:hidden h-[420px]">{previewPanel}</div>

          <div className="glass hidden xl:block p-6">
            <div className="mb-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Custo: {cost > 0 ? `${formatCredits(cost)} crédito(s)` : "grátis pelo seu plano"}</p>
                <p className="text-xs text-muted-foreground">Saldo atual: {user?.credits ?? 0} crédito(s)</p>
              </div>
            </div>
            <Button type="submit" variant="gradient" className="h-14 w-full rounded-2xl text-base font-semibold" disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {isEditMode ? "Atualizando..." : "Gerando..."}</>
              ) : isEditMode ? (
                <><RefreshCw className="mr-2 h-5 w-5" /> Salvar alterações</>
              ) : (
                <><IdCard className="mr-2 h-5 w-5" /> Gerar PDF ({cost > 0 ? `${formatCredits(cost)} crédito` : "grátis"})</>
              )}
            </Button>
          </div>
        </form>

        <div className="hidden xl:block xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">{previewPanel}</div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
          <p className="flex items-center gap-1.5 truncate rounded-full border border-border/60 bg-secondary/50 px-2.5 py-0.5 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">{cost > 0 ? `${formatCredits(cost)} crédito(s)` : "Grátis pelo seu plano"}</span>
            <span aria-hidden>·</span>
            <span>Saldo: {user?.credits ?? 0}</span>
          </p>
          <Button type="button" variant="gradient" className="h-12 w-full max-w-md rounded-2xl text-sm font-semibold" disabled={generating} onClick={() => void handleGenerate()}>
            {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : isEditMode ? "Salvar" : "Gerar PDF"}
          </Button>
        </div>
      </div>

      <PdfReadyDialog open={showReady} onOpenChange={setShowReady} pdfDataUrl={finalPdf || ""} fileName="documento-rg.pdf" title="Documento Rg" message={mensagem} />
    </div>
  );
}
