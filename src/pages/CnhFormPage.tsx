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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eye, Upload, X, User, FileText, Info, Sparkles, Loader2, FlaskConical, Trash2, RefreshCw, Plus, CreditCard, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mapCnhEditPayload } from "@/lib/cnh-history-edit";
import { loadCnhFieldPositions } from "@/lib/cnh-align";
import { syncCnhToExternal } from "@/lib/cnh-external-sync";
import { withTimeout } from "@/lib/with-timeout";
import testFotoUrl from "@/assets/test-foto.png";
import testAssUrl from "@/assets/test-assinatura.png";
import templateCnhUrl from "@/assets/template-cnh-bg-hq.webp";
import { loadTemplateBase64, loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskCPF, maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { normalizeSignatureImage } from "@/lib/signature-image";
import { pick } from "@/lib/random";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const OBSERVACOES = ["EAR","MOPP","A","B","C","D","E","F","X","99","15","20","25","30","ESCOLAR","EMERGÊNCIA","COLETIVO","CARGA INDIVISÍVEL","PASSAGEIROS"];

function generateRandom(length: number, prefix = "") {
  const digits = Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
  return prefix + digits;
}

interface CnhFormData {
  cpf: string;
  nomeCompleto: string;
  uf: string;
  genero: string;
  nacionalidade: string;
  dataNascimentoLocal: string;
  registro: string;
  categoria: string;
  cnhDefinitiva: string;
  primeiraHab: string;
  dataEmissao: string;
  dataValidade: string;
  validadeCatACC: string;
  validadeCatA: string;
  validadeCatB: string;
  validadeCatC: string;
  validadeCatD: string;
  validadeCatE: string;
  validadeCatManual: boolean;
  cidadeEstado: string;
  estadoExtenso: string;
  rg: string;
  codigoSeguranca: string;
  renach: string;
  numeroEspelho: string;
  observacoes: string[];
  nomePai: string;
  nomeMae: string;
}

// Categorias oficiais do CONTRAN
const ALL_CATEGORIES = ["ACC","A","B","AB","C","AC","D","AD","E","AE"];

const AVAILABLE_CATEGORY_LETTERS = ["ACC", "A", "B", "C", "D", "E"];

function parseCategories(cat: string): string[] {
  const norm = cat.replace(/[\s;]+/g, "").toUpperCase();
  const out: string[] = [];
  let rest = norm;
  if (rest.includes("ACC")) {
    out.push("ACC");
    rest = rest.replace(/ACC/g, "");
  }
  for (const c of ["A","B","C","D","E"]) {
    if (rest.includes(c)) out.push(c);
  }
  return AVAILABLE_CATEGORY_LETTERS.filter((c) => out.includes(c));
}

function addCategory(current: string, letter: string): string {
  const set = new Set([...parseCategories(current), letter]);
  return AVAILABLE_CATEGORY_LETTERS.filter((c) => set.has(c)).join("");
}

function removeCategory(current: string, letter: string): string {
  return parseCategories(current).filter((c) => c !== letter).join("");
}

const initial: CnhFormData = {
  cpf: "", nomeCompleto: "", uf: "", genero: "", nacionalidade: "",
  dataNascimentoLocal: "", registro: "", categoria: "", cnhDefinitiva: "",
  primeiraHab: "", dataEmissao: "", dataValidade: "",
  validadeCatACC: "", validadeCatA: "", validadeCatB: "", validadeCatC: "", validadeCatD: "", validadeCatE: "",
  validadeCatManual: false,
  cidadeEstado: "", estadoExtenso: "", rg: "", codigoSeguranca: "", renach: "",
  numeroEspelho: "", observacoes: [], nomePai: "", nomeMae: "",
};

const NOMES_TESTE = ["PEDRO DA SILVA GOMES","MARIA OLIVEIRA SANTOS","CARLOS FERREIRA LIMA","ANA PAULA COSTA","LUCAS RODRIGUES ALVES"];
const PAIS_TESTE = ["JOSE DA SILVA","ANTONIO FERREIRA","MARCOS OLIVEIRA","ROBERTO COSTA","PAULO RODRIGUES"];
const MAES_TESTE = ["MARIA DA SILVA","ANA FERREIRA","CLAUDIA OLIVEIRA","SANDRA COSTA","LUCIA RODRIGUES"];
const CIDADES_TESTE = ["SAO PAULO, SP","RIO DE JANEIRO, RJ","BELO HORIZONTE, MG","CURITIBA, PR","SALVADOR, BA"];
const ESTADOS_TESTE = ["SÃO PAULO","RIO DE JANEIRO","MINAS GERAIS","PARANÁ","BAHIA"];

function randomDate(startYear: number, endYear: number) {
  const d = Math.floor(Math.random() * 28) + 1;
  const m = Math.floor(Math.random() * 12) + 1;
  const y = startYear + Math.floor(Math.random() * (endYear - startYear));
  return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
}

function addYears(dateStr: string, years: number) {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return "";
  return `${parts[0]}/${parts[1]}/${parseInt(parts[2]) + years}`;
}

const ROUTE_KEY = "/dashboard/documents/cnh";

export default function CnhFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, unknown>; editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents, addDocument } = useDocuments();

  const initialEditPayload = editState?.editFormData ? mapCnhEditPayload(editState.editFormData) : null;
  const [form, setForm] = useState<CnhFormData>(() => initialEditPayload?.formData ?? initial);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(initialEditPayload?.fotoPreview ?? null);
  const [assinatura, setAssinatura] = useState<File | null>(null);
  const [assPreview, setAssPreview] = useState<string | null>(initialEditPayload?.assPreview ?? null);
  const [autoFillDates, setAutoFillDates] = useState(!initialEditPayload);
  const [editHydrated, setEditHydrated] = useState(Boolean(initialEditPayload));
  const fotoRef = useRef<HTMLInputElement>(null);
  const assRef = useRef<HTMLInputElement>(null);
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
    if (editHydrated || editState?.editFormData || !editState?.editDocId) return;

    let cancelled = false;
    (async () => {
      const docId = editState.editDocId!;
      const raw = getDocument(docId)?.additionalInfo || (await loadDocumentInfo(docId));
      if (cancelled || !raw) return;

      let payload: ReturnType<typeof mapCnhEditPayload> | null = null;
      try {
        payload = mapCnhEditPayload(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        return;
      }
      if (!payload) return;

      setForm(payload.formData);
      setFotoPreview(payload.fotoPreview);
      setAssPreview(payload.assPreview);
      setAutoFillDates(false);
      setEditHydrated(true);
    })();

    return () => { cancelled = true; };
  }, [editHydrated, editState?.editDocId, editState?.editFormData, getDocument, loadDocumentInfo]);

  // Auto-fill emissão e validade quando preencher 1ª Habilitação
  useEffect(() => {
    if (!autoFillDates || !form.primeiraHab) return;
    const parts = form.primeiraHab.split("/");
    if (parts.length === 3 && parts[2].length === 4) {
      const today = new Date();
      const emissao = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
      const validade = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear() + 10}`;
      setForm(p => ({ ...p, dataEmissao: emissao, dataValidade: validade }));
    }
  }, [form.primeiraHab, autoFillDates]);

  // Auto-fill per-category validity dates when not manual
  useEffect(() => {
    if (form.validadeCatManual || !form.dataValidade) return;
    const cats = parseCategories(form.categoria);
    const updates: Record<string, string> = {};
    for (const c of AVAILABLE_CATEGORY_LETTERS) {
      const key = `validadeCat${c}`;
      updates[key] = cats.includes(c) ? form.dataValidade : "";
    }
    setForm(p => ({ ...p, ...updates } as CnhFormData));
  }, [form.dataValidade, form.categoria, form.validadeCatManual]);

  const imgToBase64 = (url: string) => loadTemplateBase64(url);

  const fillTest = async () => {
    const uf = pick(UF_LIST);
    const cidade = pick(CIDADES_TESTE);
    const estado = pick(ESTADOS_TESTE);
    const primeiraHab = randomDate(2015, 2023);
    const today = new Date();
    const emissao = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
    const validade = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear() + 10}`;

    const cat = pick(ALL_CATEGORIES);
    setForm({
      cpf: `${generateRandom(3)}.${generateRandom(3)}.${generateRandom(3)}-${generateRandom(2)}`,
      nomeCompleto: pick(NOMES_TESTE),
      uf,
      genero: pick(["M","F"]),
      nacionalidade: "BRASILEIRA",
      dataNascimentoLocal: `${randomDate(1980, 2002)}, ${cidade}`,
      registro: generateRandom(11),
      categoria: cat,
      cnhDefinitiva: pick(["SIM","NAO"]),
      primeiraHab,
      dataEmissao: emissao,
      dataValidade: validade,
      validadeCatACC: parseCategories(cat).includes("ACC") ? validade : "",
      validadeCatA: parseCategories(cat).includes("A") ? validade : "",
      validadeCatB: parseCategories(cat).includes("B") ? validade : "",
      validadeCatC: parseCategories(cat).includes("C") ? validade : "",
      validadeCatD: parseCategories(cat).includes("D") ? validade : "",
      validadeCatE: parseCategories(cat).includes("E") ? validade : "",
      validadeCatManual: false,
      cidadeEstado: cidade,
      estadoExtenso: estado,
      rg: generateRandom(7) + " SSP " + uf,
      codigoSeguranca: generateRandom(11),
      renach: uf + generateRandom(9),
      numeroEspelho: generateRandom(11),
      observacoes: [pick(OBSERVACOES)],
      nomePai: pick(PAIS_TESTE),
      nomeMae: pick(MAES_TESTE),
    });
    setAutoFillDates(false);
    // Load test images as base64
    const [fotoB64, assB64] = await Promise.all([
      imgToBase64(testFotoUrl),
      imgToBase64(testAssUrl),
    ]);
    setFotoPreview(fotoB64);
    setAssPreview(assB64);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setFoto(null); setFotoPreview(null);
    setAssinatura(null); setAssPreview(null);
    setAutoFillDates(true);
    if (fotoRef.current) fotoRef.current.value = "";
    if (assRef.current) assRef.current.value = "";
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof CnhFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof CnhFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const setSelect = (field: keyof CnhFormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const toggleObs = (obs: string) =>
    setForm((p) => ({
      ...p,
      observacoes: p.observacoes.includes(obs)
        ? p.observacoes.filter((o) => o !== obs)
        : [...p.observacoes, obs],
    }));

  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearFile = (
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void,
    ref: React.RefObject<HTMLInputElement>
  ) => {
    setFile(null);
    setPreview(null);
    if (ref.current) ref.current.value = "";
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const templateBase64 = await loadTemplateObjectUrl(templateCnhUrl);
    const assinaturaNormalizada = assPreview
      ? await normalizeSignatureImage(assPreview)
      : "";

    return {
      nome_completo: form.nomeCompleto,
      cpf: form.cpf,
      rg: form.rg,
      data_nascimento: form.dataNascimentoLocal,
      genero: form.genero,
      nacionalidade: form.nacionalidade,
      registro: form.registro,
      categoria: form.categoria,
      data_primeira_habilitacao: form.primeiraHab,
      data_emissao: form.dataEmissao,
      data_validade: form.dataValidade,
      validade_cat_acc: form.validadeCatACC,
      validade_cat_a: form.validadeCatA,
      validade_cat_b: form.validadeCatB,
      validade_cat_c: form.validadeCatC,
      validade_cat_d: form.validadeCatD,
      validade_cat_e: form.validadeCatE,
      renach: form.renach,
      codigo_seguranca: form.codigoSeguranca,
      numero_espelho: form.numeroEspelho,
      cidade_estado: form.cidadeEstado,
      estado_extenso: form.estadoExtenso,
      cnh_definitiva: form.cnhDefinitiva,
      nome_pai: form.nomePai,
      nome_mae: form.nomeMae,
      observacoes: form.observacoes.map((o) => `${o};`).join(" "),
      foto_base64: fotoPreview || "",
      assinatura_base64: assinaturaNormalizada,
      template_base64: templateBase64,
      field_positions: loadCnhFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form, fotoPreview, assPreview]);

  const signature = useMemo(
    () => JSON.stringify(form) + "|" + (fotoPreview ? fotoPreview.length : 0) + "|" + (assPreview ? assPreview.length : 0),
    [form, fotoPreview, assPreview]
  );

  const canPreview =
    form.nomeCompleto.trim().length > 2 &&
    form.cpf.trim().length > 5 &&
    form.registro.trim().length > 5 &&
    form.categoria.trim().length > 0;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-cnh-pdf", {
        body: { ...body, preview: true },
      });
      if (seq !== previewSeq.current) return;
      if (error) throw error;
      const result = data?.pdfBase64 || data?.pdfUrl;
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

  const isEditModeVal = isEditMode;

  const handleGenerate = async () => {
    if (!user) return;

    if (isEditModeVal && editState?.editDocId) {
      setGenerating(true);
      try {
        const bodyData = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-cnh-pdf", { body: { ...bodyData, preview: false } });
        if (error) throw error;
        const pdfResult = data?.pdfBase64 || data?.pdfUrl;
        if (!pdfResult) throw new Error(data?.error || "Nenhuma URL de PDF retornada");
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`,
        });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } catch (err) {
        console.error("Erro ao atualizar CNH:", err);
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
    saveFormDraft("cnh", form as unknown as Record<string, unknown>);
    try {
      const bodyData = await buildBody();

      // 1) Gera o PDF final ANTES de cobrar: se falhar, nenhum crédito é descontado.
      const { data, error } = await invokeGeneratePdf("generate-cnh-pdf", {
        body: { ...bodyData, preview: false },
      });
      if (error) throw new Error(`falha_geracao:${error.message || ""}`);
      if (data?.validacao_registrada !== true) {
        throw new Error("validacao_cnh_nao_confirmada");
      }
      const generated = data?.pdfBase64 || data?.pdfUrl;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`;

      // 2) Envia a foto para a base consultada pelo app/CPF. Se falhar, o
      // documento já está válido no portal (QR Code funciona), então não
      // bloqueamos a entrega — apenas avisamos e tentamos de novo em segundo
      // plano.
      const tipo = (bodyData as Record<string, unknown>).tipo === "fisica" ? "fisica" : "digital";
      let externalSynced = false;
      try {
        externalSynced = await withTimeout(syncCnhToExternal(pdfFinal, bodyData as Record<string, string>, tipo as "fisica" | "digital"), 45000, false);
      } catch (syncErr) {
        console.error("Falha na sincronização de fotos:", syncErr);
      }

      // 3) O portal confirmou o documento — agora sim cobra o crédito.
      const deduction = await deductCredit(1, "geracao-cnh", creditRef("geracao-cnh", bodyData));
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
        description: `CNH - Cat ${(bodyData as Record<string, string>).categoria || ""}`,
        additionalInfo: JSON.stringify(bodyData),
        type: "cnh",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      generatedSignature.current = signature;
      setShowReady(true);

      toast({
        title: "Documento gerado com sucesso!",
        description: `${cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano."} Você pode visualizar e compartilhar.`,
      });

      if (!externalSynced) {
        toast({
          title: "Foto ainda sincronizando",
          description: "O QR Code já está válido. Reenviando a foto para o app em segundo plano.",
        });
        void (async () => {
          for (let i = 0; i < 2; i++) {
            try {
              if (await syncCnhToExternal(pdfFinal, bodyData as Record<string, string>, tipo as "fisica" | "digital")) return;
            } catch { /* segue tentando */ }
            await new Promise((r) => setTimeout(r, 3000));
          }
        })();
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error("Falha na geração:", e);
      toast({
        title: "Erro ao gerar documento",
        description: reason.startsWith("validacao_cnh")
          ? "O portal validador não confirmou o cadastro. Nenhum crédito foi descontado; tente novamente."
          : `Não foi possível montar o PDF final (${reason.slice(0, 80)}). Nenhum crédito foi descontado.`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const cpfDigitos = (form.cpf || "").replace(/\D/g, "");
  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Aqui estão seus dados de acesso para o App CNH:\n\nLogin: ${form.cpf || cpfDigitos}\nSenha: ${cpfDigitos.slice(-6)}\n\nAcesse o site para visualizar sua CNH digital:\nhttps://condutor-cnhdigital-vio-webs.info`;

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";

  const FieldLabel = ({ children, required = true }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-sm font-semibold text-primary">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );

  const GenerateBtn = ({ onClick }: { onClick: () => void }) => (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
      <Sparkles className="w-3.5 h-3.5" /> Gerar
    </Button>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-3 pb-2 mb-2 border-b border-border/50">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );

  /* ---------------- painel de preview ---------------- */
  const previewPanel = (
    <div className="glass flex h-full flex-col p-0 overflow-hidden">
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

      <div className="relative min-h-[420px] flex-1 overflow-hidden bg-secondary/30">
        {previewPdf || finalPdf ? (
          <>
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf!} title="Prévia da CNH Digital" />
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
              {previewError || "Preencha nome, CPF, registro e categoria — a prévia atualiza sozinha enquanto você digita."}
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
          <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <FlaskConical className="w-3.5 h-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground">CNH Digital</h1>
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

          <FormDraftsPanel docType="cnh" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* DADOS PESSOAIS */}
          <div className="glass p-6 space-y-4">
            <SectionHeader icon={User} title="Dados Pessoais" />

            <div className="space-y-1.5">
              <FieldLabel>CPF</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="000.000.000-00" className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Nome Completo</FieldLabel>
              <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: PEDRO DA SILVA GOMES" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>UF</FieldLabel>
                <Select value={form.uf} onValueChange={setSelect("uf")}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Gênero</FieldLabel>
                <Select value={form.genero} onValueChange={setSelect("genero")}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Nacionalidade</FieldLabel>
              <Select value={form.nacionalidade} onValueChange={setSelect("nacionalidade")}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRASILEIRA">Brasileira</SelectItem>
                  <SelectItem value="ESTRANGEIRA">Estrangeira</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Data de Nascimento / Local</FieldLabel>
              <Input value={form.dataNascimentoLocal} onChange={set("dataNascimentoLocal")} placeholder="EX: 12/02/2000, RIO DE JANEIRO, RJ" className={inputCls} required />
            </div>

            {/* Foto 3x4 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Foto 3x4</label>
              {fotoPreview ? (
                <div className="relative w-32 h-40 rounded-lg overflow-hidden border border-border">
                  <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => clearFile(setFoto, setFotoPreview, fotoRef)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fotoRef.current?.click()} className="w-full h-28 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Clique para upload</span>
                </button>
              )}
              <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setFoto, setFotoPreview)} />
            </div>

            {/* Assinatura */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Assinatura Digital</label>
              {assPreview ? (
                <div className="relative w-56 h-20 rounded-lg overflow-hidden border border-border bg-secondary">
                  <img src={assPreview} alt="Assinatura" className="w-full h-full object-contain" />
                  <button type="button" onClick={() => clearFile(setAssinatura, setAssPreview, assRef)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => assRef.current?.click()} className="w-full h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Clique para upload</span>
                </button>
              )}
              <input ref={assRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setAssinatura, setAssPreview)} />
            </div>
          </div>

          {/* DADOS DO DOCUMENTO */}
          <div className="glass p-6 space-y-4">
            <SectionHeader icon={FileText} title="Dados do Documento" />

            <div className="space-y-1.5">
              <FieldLabel>Registro da CNH (11 dígitos)</FieldLabel>
              <div className="flex gap-2">
                <Input value={form.registro} onChange={setMask("registro", maskDigits(11))} inputMode="numeric" placeholder="00000000000" className={inputCls + " flex-1"} required />
                <GenerateBtn onClick={() => setForm((p) => ({ ...p, registro: generateRandom(11) }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Categoria</FieldLabel>
                <Select
                  value={ALL_CATEGORIES.includes(form.categoria) ? form.categoria : ""}
                  onValueChange={setSelect("categoria")}
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Selecione">{form.categoria || "Selecione"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {parseCategories(form.categoria).map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                    >
                      {c}
                      <button
                        type="button"
                        aria-label={`Remover categoria ${c}`}
                        onClick={() => setForm((p) => ({ ...p, categoria: removeCategory(p.categoria, c) }))}
                        className="text-primary/70 hover:text-primary"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {AVAILABLE_CATEGORY_LETTERS.some((c) => !parseCategories(form.categoria).includes(c)) && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Adicionar categoria"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="w-3 h-3" /> Categoria
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="start">
                        <div className="flex gap-1.5">
                          {AVAILABLE_CATEGORY_LETTERS.filter((c) => !parseCategories(form.categoria).includes(c)).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setForm((p) => ({ ...p, categoria: addCategory(p.categoria, c) }))}
                              className="w-8 h-8 rounded-md border border-border bg-secondary/50 text-xs font-bold hover:bg-primary/20 hover:text-primary"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>CNH Definitiva</FieldLabel>
                <Select value={form.cnhDefinitiva} onValueChange={setSelect("cnhDefinitiva")}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIM">Sim</SelectItem>
                    <SelectItem value="NAO">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <FieldLabel>1ª Habilitação</FieldLabel>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={autoFillDates} onChange={(e) => setAutoFillDates(e.target.checked)} className="rounded" />
                  Preencher datas automaticamente
                </label>
              </div>
              <Input value={form.primeiraHab} onChange={set("primeiraHab")} placeholder="DD/MM/AAAA" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Data de Emissão</FieldLabel>
                <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="DD/MM/AAAA" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Data de Validade</FieldLabel>
                <Input value={form.dataValidade} onChange={setMask("dataValidade", maskDate)} inputMode="numeric" placeholder="DD/MM/AAAA" className={inputCls} required />
              </div>
            </div>

            {/* Per-category validity dates */}
            {form.categoria && (
              <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center justify-between">
                  <FieldLabel required={false}>Validade por Categoria</FieldLabel>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.validadeCatManual}
                      onChange={(e) => setForm(p => ({ ...p, validadeCatManual: e.target.checked }))}
                      className="rounded"
                    />
                    Preencher manualmente
                  </label>
                </div>
                {!form.validadeCatManual && (
                  <p className="text-xs text-muted-foreground">
                    Todas as categorias usarão a mesma data de validade ({form.dataValidade || "—"}).
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {parseCategories(form.categoria).map((cat) => {
                    const key = `validadeCat${cat}` as keyof CnhFormData;
                    return (
                      <div key={cat} className="space-y-1">
                        <label className="text-xs font-semibold text-primary">Cat. {cat}</label>
                        <Input
                          value={form[key] as string}
                          onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                          placeholder="DD/MM/AAAA"
                          className={inputCls}
                          disabled={!form.validadeCatManual}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <FieldLabel>Cidade / Estado</FieldLabel>
              <Input value={form.cidadeEstado} onChange={set("cidadeEstado")} placeholder="SÃO PAULO, SP" className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Estado por Extenso</FieldLabel>
              <Input value={form.estadoExtenso} onChange={set("estadoExtenso")} placeholder="Ex: MINAS GERAIS" className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>RG</FieldLabel>
              <div className="flex gap-2">
                <Input value={form.rg} onChange={set("rg")} placeholder="Ex: 3674826 SSP AL" className={inputCls + " flex-1"} required />
                <GenerateBtn onClick={() => setForm((p) => ({ ...p, rg: generateRandom(7) + " SSP " + (p.uf || "SP") }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Código de Segurança</FieldLabel>
              <div className="flex gap-2">
                <Input value={form.codigoSeguranca} onChange={setMask("codigoSeguranca", maskDigits(11))} inputMode="numeric" placeholder="00000000000" className={inputCls + " flex-1"} required />
                <GenerateBtn onClick={() => setForm((p) => ({ ...p, codigoSeguranca: generateRandom(11) }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>RENACH</FieldLabel>
              <div className="flex gap-2">
                <Input value={form.renach} onChange={set("renach")} placeholder="XX000000000" className={inputCls + " flex-1"} required />
                <GenerateBtn onClick={() => setForm((p) => ({ ...p, renach: (p.uf || "SP") + generateRandom(9) }))} />
              </div>
            </div>
          </div>

          {/* INFORMAÇÕES ADICIONAIS */}
          <div className="glass p-6 space-y-4">
            <SectionHeader icon={Info} title="Informações Adicionais" />

            <div className="space-y-1.5">
              <FieldLabel>Nº Espelho</FieldLabel>
              <div className="flex gap-2">
                <Input value={form.numeroEspelho} onChange={setMask("numeroEspelho", maskDigits(11))} inputMode="numeric" placeholder="00000000000" className={inputCls + " flex-1"} required />
                <GenerateBtn onClick={() => setForm((p) => ({ ...p, numeroEspelho: generateRandom(11) }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Observações</label>
              <div className="grid grid-cols-2 gap-2">
                {OBSERVACOES.map((obs) => (
                  <button
                    key={obs}
                    type="button"
                    onClick={() => toggleObs(obs)}
                    className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded-md transition-colors ${
                      form.observacoes.includes(obs)
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      form.observacoes.includes(obs) ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {form.observacoes.includes(obs) && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    {obs}
                  </button>
                ))}
              </div>
              <Input
                value={form.observacoes.join(", ")}
                readOnly
                placeholder="Selecionadas aparecem aqui"
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Nome do Pai</label>
              <Input value={form.nomePai} onChange={set("nomePai")} placeholder="Ex: PEDRO DA SILVA" className={inputCls} required />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-foreground">Nome da Mãe</label>
              <Input value={form.nomeMae} onChange={set("nomeMae")} placeholder="Ex: MARIA DA SILVA" className={inputCls} required />
            </div>
          </div>

          {/* PRÉVIA — só no mobile/tablet */}
          <div className="xl:hidden h-[420px]">{previewPanel}</div>

          {/* AÇÃO */}
          <div className="glass hidden xl:block p-6">
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
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {isEditMode ? "Atualizando..." : "Gerando documento..."}</>
              ) : isEditMode ? (
                <><RefreshCw className="w-5 h-5 mr-2" /> Atualizar</>
              ) : (
                <><Eye className="w-5 h-5 mr-2" /> Gerar PDF ({cost > 0 ? `${formatCredits(cost)} crédito` : "grátis"})</>
              )}
            </Button>
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
        fileName="documento-cnh.pdf"
        title="Documento CNH"
        message={mensagem}
      />
    </div>
  );
}
