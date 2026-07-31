import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eye, Upload, X, User, FileText, Info, Sparkles, Loader2, FlaskConical, Trash2, RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mapCnhEditPayload } from "@/lib/cnh-history-edit";
import { loadCnhFieldPositions } from "@/lib/cnh-align";
import testFotoUrl from "@/assets/test-foto.png";
import testAssUrl from "@/assets/test-assinatura.png";
import templateCnhUrl from "@/assets/template-cnh-bg-hq.jpg";

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

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export default function CnhFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, unknown>; editDocId?: string } | null;
  const { getDocument, updateDocument } = useDocuments();

  const getEditPayload = useCallback(() => {
    if (editState?.editFormData) {
      return mapCnhEditPayload(editState.editFormData);
    }

    if (!editState?.editDocId) {
      return null;
    }

    const editDocument = getDocument(editState.editDocId);
    if (!editDocument?.additionalInfo) {
      return null;
    }

    try {
      return mapCnhEditPayload(JSON.parse(editDocument.additionalInfo) as Record<string, unknown>);
    } catch {
      return null;
    }
  }, [editState?.editDocId, editState?.editFormData, getDocument]);

  const initialEditPayload = getEditPayload();
  const [form, setForm] = useState<CnhFormData>(() => initialEditPayload?.formData ?? initial);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(initialEditPayload?.fotoPreview ?? null);
  const [assinatura, setAssinatura] = useState<File | null>(null);
  const [assPreview, setAssPreview] = useState<string | null>(initialEditPayload?.assPreview ?? null);
  const [loading, setLoading] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [autoFillDates, setAutoFillDates] = useState(!initialEditPayload);
  const [editHydrated, setEditHydrated] = useState(Boolean(initialEditPayload));
  const fotoRef = useRef<HTMLInputElement>(null);
  const assRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (editHydrated || editState?.editFormData || !editState?.editDocId) return;

    const payload = getEditPayload();
    if (!payload) return;

    setForm(payload.formData);
    setFotoPreview(payload.fotoPreview);
    setAssPreview(payload.assPreview);
    setAutoFillDates(false);
    setEditHydrated(true);
  }, [editHydrated, editState?.editDocId, editState?.editFormData, getEditPayload]);

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

  const imgToBase64 = async (url: string): Promise<string> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

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
    setPdfPreviewUrl(null);
    setAutoFillDates(true);
    if (fotoRef.current) fotoRef.current.value = "";
    if (assRef.current) assRef.current.value = "";
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof CnhFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

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

  const isEditMode = Boolean(editState?.editDocId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Convert template to base64
      const templateBase64 = await imgToBase64(templateCnhUrl);

        const bodyData = {
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
        assinatura_base64: assPreview || "",
        template_base64: templateBase64,
        field_positions: loadCnhFieldPositions() ?? undefined,
      };

      const { data, error } = await supabase.functions.invoke("generate-cnh-pdf", {
        // preview: QR Code NÃO é registrado (só funciona no PDF final)
        body: { ...bodyData, preview: !isEditMode },
      });

      if (error) throw error;

      const pdfResult = data?.pdfBase64 || data?.pdfUrl;
      if (!pdfResult) throw new Error(data?.error || "Nenhuma URL de PDF retornada");

      if (isEditMode && editState?.editDocId) {
        // Update mode: save directly without preview
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`,
        });

        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } else {
        // Normal mode: navigate to preview
        navigate("/dashboard/documents/cnh/preview", {
          state: {
            pdfBase64: pdfResult,
            formData: bodyData,
          },
        });
      }
    } catch (err: any) {
      console.error("Erro ao gerar PDF:", err);
      toast({
        title: isEditMode ? "Erro ao atualizar documento" : "Erro ao gerar PDF",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* DADOS PESSOAIS */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />

          <div className="space-y-1.5">
            <FieldLabel>CPF</FieldLabel>
            <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" className={inputCls} required />
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
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={FileText} title="Dados do Documento" />

          <div className="space-y-1.5">
            <FieldLabel>Registro da CNH (11 dígitos)</FieldLabel>
            <div className="flex gap-2">
              <Input value={form.registro} onChange={set("registro")} placeholder="00000000000" className={inputCls + " flex-1"} required />
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
              <Input value={form.dataEmissao} onChange={set("dataEmissao")} placeholder="DD/MM/AAAA" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data de Validade</FieldLabel>
              <Input value={form.dataValidade} onChange={set("dataValidade")} placeholder="DD/MM/AAAA" className={inputCls} required />
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
              <Input value={form.codigoSeguranca} onChange={set("codigoSeguranca")} placeholder="00000000000" className={inputCls + " flex-1"} required />
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
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Info} title="Informações Adicionais" />

          <div className="space-y-1.5">
            <FieldLabel>Nº Espelho</FieldLabel>
            <div className="flex gap-2">
              <Input value={form.numeroEspelho} onChange={set("numeroEspelho")} placeholder="00000000000" className={inputCls + " flex-1"} required />
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

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {isEditMode ? "Atualizando..." : "Gerando PDF..."}</>
          ) : isEditMode ? (
            <><RefreshCw className="w-5 h-5 mr-2" /> Atualizar</>
          ) : (
            <><Eye className="w-5 h-5 mr-2" /> Gerar Preview</>
          )}
        </Button>
      </form>

    </div>
  );
}
