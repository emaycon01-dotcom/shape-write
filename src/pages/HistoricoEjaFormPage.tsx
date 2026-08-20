import { useState, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  School, Loader2, FlaskConical, Trash2, FileText, User, PenLine,
  ChevronDown, ChevronRight, ListChecks, CalendarClock, Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { normalizeSignatureImage } from "@/lib/signature-image";
import { ESTADOS_UF, ESTADO_NOMES, loadBrasaoDataUrl } from "@/lib/brasoes-estados";

type Nota = { area: string; componente: string; n1: string; n2: string; n3: string; ch: string };
type Estudo = { nivel: string; termo: string; ano: string; unidade: string; municipio: string; uf: string };

const MODALIDADES = [
  "PRESENCIAL - NOTURNO",
  "PRESENCIAL - MATUTINO",
  "PRESENCIAL - VESPERTINO",
  "SEMIPRESENCIAL",
  "EAD - EDUCAÇÃO A DISTÂNCIA",
];

const AREA_LING = "Linguagens, Códigos e suas Tecnologias";
const AREA_NAT = "Ciências da Natureza, Matemática e suas Tecnologias";
const AREA_HUM = "Ciências Humanas e suas Tecnologias";

const NOTAS_PADRAO: Nota[] = [
  { area: AREA_LING, componente: "Língua Portuguesa e Literatura", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_LING, componente: "Arte", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_LING, componente: "Educação Física", n1: "", n2: "", n3: "", ch: "60" },
  { area: AREA_NAT, componente: "Matemática", n1: "", n2: "", n3: "", ch: "60" },
  { area: AREA_NAT, componente: "Física", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_NAT, componente: "Química", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_NAT, componente: "Biologia", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_HUM, componente: "História", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_HUM, componente: "Geografia", n1: "", n2: "", n3: "", ch: "40" },
  { area: AREA_HUM, componente: "Filosofia", n1: "", n2: "", n3: "", ch: "60" },
  { area: AREA_HUM, componente: "Sociologia", n1: "", n2: "", n3: "", ch: "40" },
];

const NOTAS_TESTE = ["7/6/6", "7/6/7", "DT/DT/DT", "6/6/7", "5/5/7", "6/7/5", "8/8/7", "9/7/8", "6/5/5", "5/8/7", "9/9/9"];

interface FormState {
  estado: string;
  coordenadoria: string;
  diretoria: string;
  escola: string;
  endereco: string;
  cep: string;
  telefone: string;
  modalidade: string;
  fundamentoLegal: string;
  nomeAluno: string;
  rg: string;
  municipioNascimento: string;
  ufNascimento: string;
  pais: string;
  dataNascimento: string;
  apoioCurricular: string;
  chBase: string;
  chDiversificada: string;
  chTotal: string;
  observacoes: string;
  gdae: string;
  anoConclusao: string;
  dataCertificado: string;
  secretarioNome: string;
  secretarioRg: string;
  diretorNome: string;
  diretorRg: string;
}

const initial: FormState = {
  estado: "SP",
  coordenadoria: "COORDENADORIA DE ENSINO DO ESTADO DE SÃO PAULO",
  diretoria: "",
  escola: 'E.E. "Profª. GEORGINA HELENA FORTAREL"',
  endereco: "Rua Flor de Melo nº 30 – Parque Internacional, Campo Limpo Paulista-SP",
  cep: "13232-524",
  telefone: "(11) 4039-3595",
  modalidade: MODALIDADES[0],
  fundamentoLegal:
    "Fundamento Legal: Lei Federal nº 9394/96, Artigo 37 e 38; Resoluções CNE/CEB nº 1/2000; Del. CEE/SP nº 9/2000 e Resolução SEE/SP nº 1/2001 e Resolução SEE nº 2/2006.",
  nomeAluno: "",
  rg: "",
  municipioNascimento: "",
  ufNascimento: "SP",
  pais: "BRASIL",
  dataNascimento: "",
  apoioCurricular: "Língua Portuguesa e Literatura",
  chBase: "320",
  chDiversificada: "",
  chTotal: "320",
  observacoes: "DT - DISPENSA POR LEI N° 10.793/2003",
  gdae: "",
  anoConclusao: "",
  dataCertificado: "",
  secretarioNome: "",
  secretarioRg: "",
  diretorNome: "",
  diretorRg: "",
};

const estudoVazio = (): Estudo => ({ nivel: "Ensino Médio", termo: "", ano: "", unidade: "", municipio: "", uf: "SP" });

export default function HistoricoEjaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<FormState>(initial);
  const [notas, setNotas] = useState<Nota[]>(NOTAS_PADRAO);
  const [estudos, setEstudos] = useState<Estudo[]>([
    { nivel: "Ensino Fundamental", termo: "8º", ano: "", unidade: "", municipio: "", uf: "SP" },
    { nivel: "Ensino Médio", termo: "1º TERMO", ano: "", unidade: "", municipio: "", uf: "SP" },
    { nivel: "Ensino Médio", termo: "2º TERMO", ano: "", unidade: "", municipio: "", uf: "SP" },
    { nivel: "Ensino Médio", termo: "3º TERMO", ano: "", unidade: "", municipio: "", uf: "SP" },
  ]);
  const [assinatura, setAssinatura] = useState("");
  const [showNotas, setShowNotas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(editState?.editDocId);

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
          estado: b.estado || p.estado,
          coordenadoria: b.coordenadoria || p.coordenadoria,
          diretoria: b.diretoria || p.diretoria,
          escola: b.escola || p.escola,
          endereco: b.endereco || p.endereco,
          cep: b.cep || p.cep,
          telefone: b.telefone || p.telefone,
          modalidade: b.modalidade || p.modalidade,
          fundamentoLegal: b.fundamento_legal || p.fundamentoLegal,
          nomeAluno: b.nome_aluno || "",
          rg: b.rg || "",
          municipioNascimento: b.municipio_nascimento || "",
          ufNascimento: b.uf_nascimento || p.ufNascimento,
          pais: b.pais || p.pais,
          dataNascimento: b.data_nascimento || "",
          apoioCurricular: b.apoio_curricular || p.apoioCurricular,
          chBase: b.ch_base || p.chBase,
          chDiversificada: b.ch_diversificada || p.chDiversificada,
          chTotal: b.ch_total || p.chTotal,
          observacoes: b.observacoes || p.observacoes,
          gdae: b.gdae || "",
          anoConclusao: b.ano_conclusao || "",
          dataCertificado: b.data_certificado || "",
          secretarioNome: b.secretario_nome || "",
          secretarioRg: b.secretario_rg || "",
          diretorNome: b.diretor_nome || "",
          diretorRg: b.diretor_rg || "",
        }));
        try { const n = JSON.parse(b.notas_json || "[]"); if (Array.isArray(n) && n.length) setNotas(n); } catch { /* ignora */ }
        try { const t = JSON.parse(b.estudos_json || "[]"); if (Array.isArray(t) && t.length) setEstudos(t); } catch { /* ignora */ }
        setAssinatura(b.assinatura_base64 || "");
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof FormState, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const setNota = (index: number, key: keyof Nota, value: string) =>
    setNotas((p) => p.map((n, i) => (i === index ? { ...n, [key]: value } : n)));

  const setEstudo = (index: number, key: keyof Estudo, value: string) =>
    setEstudos((p) => p.map((t, i) => (i === index ? { ...t, [key]: value } : t)));

  const uploadAssinatura = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read_error"));
        reader.readAsDataURL(file);
      });
      setAssinatura(await normalizeSignatureImage(dataUrl));
      toast({ title: "Carimbo/assinatura carregado!" });
    } catch {
      toast({ title: "Não foi possível ler a imagem", variant: "destructive" });
    }
  };

  const fillTest = () => {
    setForm({
      ...initial,
      nomeAluno: "MARIA ZILDA MANOEL",
      rg: "33.531.642-6/SP",
      municipioNascimento: "CAMPO LIMPO PAULISTA",
      dataNascimento: "07/07/1972",
      gdae: "40147122/2009",
      anoConclusao: "2009",
      dataCertificado: "14 de Novembro de 2009",
      secretarioNome: "ROSANA MARIA DA ROCHA",
      secretarioRg: "14.298.788-X",
      diretorNome: "ROSI DE CARDOSO CINTO",
      diretorRg: "33.198.331-X",
    });
    setNotas(NOTAS_PADRAO.map((n, i) => {
      const [n1, n2, n3] = (NOTAS_TESTE[i] || "").split("/");
      return { ...n, n1: n1 || "", n2: n2 || "", n3: n3 || "" };
    }));
    setEstudos([
      { nivel: "Ensino Fundamental", termo: "8º", ano: "2006", unidade: 'E.E. "Profª. Georgina Helena Fortarel"', municipio: "Campo Limpo Pta", uf: "SP" },
      { nivel: "Ensino Médio", termo: "1º TERMO", ano: "2007", unidade: 'E.E. "Profª. Georgina Helena Fortarel"', municipio: "Campo Limpo Pta", uf: "SP" },
      { nivel: "Ensino Médio", termo: "2º TERMO", ano: "2008", unidade: 'E.E. "Profª. Georgina Helena Fortarel"', municipio: "Campo Limpo Pta", uf: "SP" },
      { nivel: "Ensino Médio", termo: "3º TERMO", ano: "2009", unidade: 'E.E. "Profª. Georgina Helena Fortarel"', municipio: "Campo Limpo Pta", uf: "SP" },
    ]);
    setShowNotas(true);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setNotas(NOTAS_PADRAO);
    setEstudos([estudoVazio()]);
    setAssinatura("");
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    saveFormDraft("historico-eja", form as unknown as Record<string, unknown>);

    try {
      const brasao = await loadBrasaoDataUrl(form.estado);

      const bodyData = {
        estado: form.estado,
        estado_nome: ESTADO_NOMES[form.estado] || form.estado,
        coordenadoria: form.coordenadoria,
        diretoria: form.diretoria,
        escola: form.escola,
        endereco: form.endereco,
        cep: form.cep,
        telefone: form.telefone,
        modalidade: form.modalidade,
        fundamento_legal: form.fundamentoLegal,
        nome_aluno: form.nomeAluno,
        rg: form.rg,
        municipio_nascimento: form.municipioNascimento,
        uf_nascimento: form.ufNascimento,
        pais: form.pais,
        data_nascimento: form.dataNascimento,
        apoio_curricular: form.apoioCurricular,
        ch_base: form.chBase,
        ch_diversificada: form.chDiversificada,
        ch_total: form.chTotal,
        observacoes: form.observacoes,
        gdae: form.gdae,
        ano_conclusao: form.anoConclusao,
        data_certificado: form.dataCertificado,
        secretario_nome: form.secretarioNome,
        secretario_rg: form.secretarioRg,
        diretor_nome: form.diretorNome,
        diretor_rg: form.diretorRg,
        notas_json: JSON.stringify(notas),
        estudos_json: JSON.stringify(estudos.filter((t) => t.ano || t.termo || t.unidade)),
        template_brasao_base64: brasao,
        assinatura_base64: assinatura,
      };

      const { data, error } = await invokeGeneratePdf("generate-historico-eja-pdf", {
        body: { ...bodyData, preview: !isEditMode },
      });

      if (error) throw error;

      const pdfResult = data?.pdfBase64;
      if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");

      if (isEditMode && editState?.editDocId) {
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`,
        });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } else {
        const previewId = storePreviewPayload({ pdfBase64: pdfResult, formData: bodyData });
        navigate("/dashboard/documents/historico-eja/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Histórico/Certificado EJA:", err);
      toast({
        title: isEditMode ? "Erro ao atualizar documento" : "Erro ao gerar PDF",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";
  const selectCls = `h-10 w-full rounded-md border px-3 text-sm ${inputCls}`;

  const FieldLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-sm font-semibold text-primary">
      {children}{required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="mb-2 flex items-center gap-3 border-b border-border/50 pb-2">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );

  return (
    <div className="max-w-3xl">
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">HISTÓRICO/CERTIFICADO EJA</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <FormDraftsPanel docType="historico-eja" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        {/* ESCOLA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={School} title="Unidade de ensino" />

          <div className="space-y-1.5">
            <FieldLabel required>Estado (brasão)</FieldLabel>
            <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} className={selectCls}>
              {ESTADOS_UF.map((uf) => (
                <option key={uf} value={uf}>{uf} — {ESTADO_NOMES[uf]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Coordenadoria de ensino</FieldLabel>
            <Input value={form.coordenadoria} onChange={set("coordenadoria")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Diretoria de ensino</FieldLabel>
            <Input value={form.diretoria} onChange={set("diretoria")} placeholder="Jundiaí" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Nome da unidade de ensino</FieldLabel>
            <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Endereço</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>CEP</FieldLabel>
              <Input value={form.cep} onChange={set("cep")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Telefone</FieldLabel>
              <Input value={form.telefone} onChange={set("telefone")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Modalidade / turno</FieldLabel>
            <select value={form.modalidade} onChange={(e) => setForm((p) => ({ ...p, modalidade: e.target.value }))} className={selectCls}>
              {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do aluno (a)</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="MARIA ZILDA MANOEL" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>R.G.</FieldLabel>
              <Input value={form.rg} onChange={set("rg")} placeholder="33.531.642-6/SP" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de nascimento</FieldLabel>
              <Input value={form.dataNascimento} onChange={setMask("dataNascimento", maskDate)} inputMode="numeric" placeholder="07/07/1972" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Município de nascimento</FieldLabel>
              <Input value={form.municipioNascimento} onChange={set("municipioNascimento")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Estado (nascimento)</FieldLabel>
              <select value={form.ufNascimento} onChange={(e) => setForm((p) => ({ ...p, ufNascimento: e.target.value }))} className={selectCls}>
                {ESTADOS_UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>País</FieldLabel>
              <Input value={form.pais} onChange={set("pais")} className={inputCls} />
            </div>
          </div>
        </div>

        {/* NOTAS (OPCIONAL) */}
        <div className="glass rounded-xl p-6">
          <button
            type="button"
            onClick={() => setShowNotas((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-primary" />
              <span>
                <span className="block text-lg font-bold text-foreground">Notas por termo (opcional)</span>
                <span className="block text-xs text-muted-foreground">
                  Deixe em branco para o documento sair com traços (–). Use "DT" para dispensa.
                </span>
              </span>
            </span>
            {showNotas ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
          </button>

          {showNotas && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-[1fr_52px_52px_52px_56px] gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
                <span>Componente</span><span className="text-center">1º</span><span className="text-center">2º</span><span className="text-center">3º</span><span className="text-center">C.H.</span>
              </div>
              <div className="space-y-2">
                {notas.map((nota, i) => (
                  <div key={`${nota.componente}-${i}`} className="grid grid-cols-[1fr_52px_52px_52px_56px] items-center gap-2">
                    <Input value={nota.componente} onChange={(e) => setNota(i, "componente", e.target.value)} className={`${inputCls} h-9 text-xs`} />
                    <Input value={nota.n1} onChange={(e) => setNota(i, "n1", e.target.value)} className={`${inputCls} h-9 text-center text-xs`} />
                    <Input value={nota.n2} onChange={(e) => setNota(i, "n2", e.target.value)} className={`${inputCls} h-9 text-center text-xs`} />
                    <Input value={nota.n3} onChange={(e) => setNota(i, "n3", e.target.value)} className={`${inputCls} h-9 text-center text-xs`} />
                    <Input value={nota.ch} onChange={(e) => setNota(i, "ch", e.target.value)} className={`${inputCls} h-9 text-center text-xs`} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-border/50 pt-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <FieldLabel>C.H. Base Nacional Comum</FieldLabel>
                  <Input value={form.chBase} onChange={set("chBase")} className={`${inputCls} h-9 text-xs`} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>C.H. Parte Diversificada</FieldLabel>
                  <Input value={form.chDiversificada} onChange={set("chDiversificada")} className={`${inputCls} h-9 text-xs`} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>C.H. Total</FieldLabel>
                  <Input value={form.chTotal} onChange={set("chTotal")} className={`${inputCls} h-9 text-xs`} />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Disciplina de apoio curricular</FieldLabel>
                <Input value={form.apoioCurricular} onChange={set("apoioCurricular")} className={`${inputCls} h-9 text-xs`} />
              </div>
            </div>
          )}
        </div>

        {/* ESTUDOS REALIZADOS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={CalendarClock} title="Estudos realizados" />

          {estudos.map((estudo, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Linha {i + 1}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input value={estudo.nivel} onChange={(e) => setEstudo(i, "nivel", e.target.value)} placeholder="Ensino Médio" className={`${inputCls} h-9 text-xs`} />
                <Input value={estudo.termo} onChange={(e) => setEstudo(i, "termo", e.target.value)} placeholder="1º TERMO" className={`${inputCls} h-9 text-xs`} />
                <Input value={estudo.ano} onChange={(e) => setEstudo(i, "ano", e.target.value)} placeholder="2007" className={`${inputCls} h-9 text-xs`} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_60px]">
                <Input value={estudo.unidade} onChange={(e) => setEstudo(i, "unidade", e.target.value)} placeholder="Estabelecimento de ensino" className={`${inputCls} h-9 text-xs`} />
                <Input value={estudo.municipio} onChange={(e) => setEstudo(i, "municipio", e.target.value)} placeholder="Município" className={`${inputCls} h-9 text-xs`} />
                <select value={estudo.uf} onChange={(e) => setEstudo(i, "uf", e.target.value)} className={`${selectCls} h-9 text-xs`}>
                  {ESTADOS_UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setEstudos((p) => [...p, estudoVazio()])}>
              + Adicionar linha
            </Button>
            {estudos.length > 1 && (
              <Button type="button" variant="outline" size="sm" className="text-xs text-destructive" onClick={() => setEstudos((p) => p.slice(0, -1))}>
                Remover última
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Observações</FieldLabel>
            <Input value={form.observacoes} onChange={set("observacoes")} className={inputCls} />
          </div>
        </div>

        {/* CERTIFICADO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Award} title="Certificado de conclusão" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Nº de concluinte GDAE</FieldLabel>
              <Input value={form.gdae} onChange={set("gdae")} placeholder="40147122/2009" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Ano de conclusão</FieldLabel>
              <Input value={form.anoConclusao} onChange={set("anoConclusao")} placeholder="2009" className={inputCls} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Data do certificado (por extenso)</FieldLabel>
              <Input value={form.dataCertificado} onChange={set("dataCertificado")} placeholder="14 de Novembro de 2009" className={inputCls} />
            </div>
          </div>
        </div>

        {/* ASSINATURAS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={PenLine} title="Assinaturas do rodapé" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Nome do secretário</FieldLabel>
              <Input value={form.secretarioNome} onChange={set("secretarioNome")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>R.G. do secretário</FieldLabel>
              <Input value={form.secretarioRg} onChange={set("secretarioRg")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nome do diretor</FieldLabel>
              <Input value={form.diretorNome} onChange={set("diretorNome")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>R.G. do diretor</FieldLabel>
              <Input value={form.diretorRg} onChange={set("diretorRg")} className={inputCls} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Envie a imagem com as assinaturas/carimbo. Ela é aplicada sobre a faixa do rodapé, como no modelo oficial.
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={uploadAssinatura}
            className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary"
          />
          {assinatura && (
            <div className="rounded-md border border-border/60 bg-white p-2">
              <img src={assinatura} alt="Assinaturas" className="mx-auto h-24 object-contain" />
            </div>
          )}
        </div>

        <div className="flex justify-center pt-1">
          <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
            ) : isEditMode ? (
              <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
            ) : (
              <><School className="mr-2 h-5 w-5" /> Gerar preview</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
