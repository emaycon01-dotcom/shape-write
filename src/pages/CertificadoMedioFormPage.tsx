import { useState, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { School, Loader2, FlaskConical, Trash2, User, BookOpen, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADO_NOMES, ESTADOS_UF, loadBrasaoDataUrl } from "@/lib/brasoes-estados";
import { pick, rnd } from "@/lib/random";

interface Disciplina {
  nome: string;
  n1: string; c1: string;
  n2: string; c2: string;
  n3: string; c3: string;
}

const COMUM_BASE: Disciplina[] = [
  { nome: "Língua portuguesa e literatura", n1: "9.0", c1: "200", n2: "8.0", c2: "200", n3: "7.0", c3: "200" },
  { nome: "Educação física", n1: "7.0", c1: "40", n2: "6.0", c2: "40", n3: "8.0", c3: "40" },
  { nome: "Historia", n1: "8.0", c1: "80", n2: "7.0", c2: "80", n3: "8.0", c3: "80" },
  { nome: "Geografia", n1: "8.5", c1: "80", n2: "7.5", c2: "80", n3: "7.5", c3: "80" },
  { nome: "Matemática", n1: "7.5", c1: "160", n2: "6.5", c2: "160", n3: "8.0", c3: "160" },
  { nome: "Física", n1: "7.0", c1: "80", n2: "6.0", c2: "80", n3: "6.0", c3: "80" },
  { nome: "Química", n1: "7.0", c1: "80", n2: "8.5", c2: "80", n3: "7.0", c3: "80" },
  { nome: "Biologia e programa de saúde", n1: "8.0", c1: "80", n2: "7.5", c2: "80", n3: "7.0", c3: "120" },
  { nome: "Artes", n1: "8.0", c1: "40", n2: "9.5", c2: "40", n3: "", c3: "" },
  { nome: "Ensino religioso", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
];

const DIVERSIFICADA_BASE: Disciplina[] = [
  { nome: "Língua estrangeira inglês", n1: "8.0", c1: "80", n2: "6.0", c2: "80", n3: "6.0", c3: "80" },
  { nome: "Sociologia", n1: "9.5", c1: "40", n2: "8.5", c2: "40", n3: "6.5", c3: "40" },
  { nome: "Filosofia", n1: "7.0", c1: "40", n2: "7.5", c2: "40", n3: "6.0", c3: "40" },
  { nome: "Educação ambiental", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
  { nome: "Educação para o trabalho", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
];

interface Estab { serie: string; ano: string; estab: string; cidade: string; situacao: string }

interface FormState {
  uf: string;
  govEstado: string;
  secretaria: string;
  escola: string;
  endereco: string;
  contato: string;
  portaria: string;

  nomeAluno: string;
  mae: string;
  pai: string;
  sexo: "M" | "F";
  dataNasc: string;
  municipioNasc: string;
  ufNasc: string;
  nacionalidade: string;
  rg: string;
  orgaoExpedidor: string;
  serieConclusao: string;
  anoConclusao: string;

  turma1: string;
  turma2: string;
  turma3: string;

  ano1: string;
  ano2: string;
  ano3: string;

  dispensaEdFisica: "SIM" | "NAO";
  baseLegal: string;
  observacoes: string;
  localData: string;
}

const initial: FormState = {
  uf: "PE",
  govEstado: "GOVERNO DO ESTADO DE PERNAMBUCO",
  secretaria: "SECRETARIA DE EDUCAÇÃO, CULTURA E ESPORTES",
  escola: "ESCOLA SENADOR NOVAES FILHO",
  endereco: "Rua Maria Lacerda S/N – Várzea – Recife – CEP 51.010-410",
  contato: "Fone (81) 3271-9372 – CNPJ 10572071/0943-46",
  portaria: "Portaria de autorização N 9.288 de 26/04/1984 Cadastro Escolar E-050.108",

  nomeAluno: "",
  mae: "",
  pai: "",
  sexo: "M",
  dataNasc: "",
  municipioNasc: "",
  ufNasc: "PE",
  nacionalidade: "BRASILEIRA",
  rg: "",
  orgaoExpedidor: "SDS/PE",
  serieConclusao: "3º Ano",
  anoConclusao: "",

  turma1: "A",
  turma2: "C",
  turma3: "A",

  ano1: "",
  ano2: "",
  ano3: "",

  dispensaEdFisica: "NAO",
  baseLegal: "",
  observacoes: "",
  localData: "",
};

const NOMES = ["MATEUS LUCAS DA SILVA", "JOANA PEREIRA DOS SANTOS", "RAFAEL ALVES DE MOURA"];
const MAES = ["ROSINETE MAURICIO DA SILVA", "MARIA JOSE PEREIRA", "SANDRA ALVES DE MOURA"];
const PAIS = ["MARCELO DA SILVA", "ANTONIO PEREIRA", "JOSE DE MOURA"];

export default function CertificadoMedioFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<FormState>(initial);
  const [comum, setComum] = useState<Disciplina[]>(COMUM_BASE);
  const [notasAbertas, setNotasAbertas] = useState(false);
  const [diversificada, setDiversificada] = useState<Disciplina[]>(DIVERSIFICADA_BASE);
  const [estabs, setEstabs] = useState<Estab[]>([
    { serie: "1º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
    { serie: "2º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
    { serie: "3º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
  ]);
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
        const b = JSON.parse(raw) as Record<string, unknown>;
        setForm((p) => ({
          ...p,
          uf: (b.uf as string) || p.uf,
          govEstado: (b.gov_estado as string) || p.govEstado,
          secretaria: (b.secretaria as string) || p.secretaria,
          escola: (b.escola as string) || p.escola,
          endereco: (b.endereco as string) || p.endereco,
          contato: (b.contato as string) || p.contato,
          portaria: (b.portaria as string) || p.portaria,
          nomeAluno: (b.nome_aluno as string) || "",
          mae: (b.mae as string) || "",
          pai: (b.pai as string) || "",
          sexo: ((b.sexo as string) === "F" ? "F" : "M"),
          dataNasc: (b.data_nasc as string) || "",
          municipioNasc: (b.municipio_nasc as string) || "",
          ufNasc: (b.uf_nasc as string) || p.ufNasc,
          nacionalidade: (b.nacionalidade as string) || p.nacionalidade,
          rg: (b.rg as string) || "",
          orgaoExpedidor: (b.orgao_expedidor as string) || p.orgaoExpedidor,
          serieConclusao: (b.serie_conclusao as string) || p.serieConclusao,
          anoConclusao: (b.ano_conclusao as string) || "",
          turma1: (b.turma1 as string) || p.turma1,
          turma2: (b.turma2 as string) || p.turma2,
          turma3: (b.turma3 as string) || p.turma3,
          dispensaEdFisica: ((b.dispensa_ed_fisica as string) === "SIM" ? "SIM" : "NAO"),
          baseLegal: (b.base_legal as string) || "",
          observacoes: (b.observacoes as string) || "",
          localData: (b.local_data as string) || "",
        }));
        if (Array.isArray(b.disciplinas_comum)) setComum(b.disciplinas_comum as Disciplina[]);
        if (Array.isArray(b.disciplinas_diversificada)) setDiversificada(b.disciplinas_diversificada as Disciplina[]);
        if (Array.isArray(b.estabelecimentos)) setEstabs(b.estabelecimentos as Estab[]);
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [field]: e.target.value }));

  /** Trocar o estado atualiza o cabeçalho e o brasão do documento. */
  const setUf = (uf: string) =>
    setForm((p) => ({ ...p, uf, govEstado: `GOVERNO DO ESTADO DE ${ESTADO_NOMES[uf] || uf}` }));

  /** Os anos das séries são sequenciais a partir do 1º ano. */
  const setAno1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm((p) => {
      const n = Number(v);
      if (v.length === 4 && n > 1900) {
        return { ...p, ano1: v, ano2: String(n + 1), ano3: String(n + 2), anoConclusao: String(n + 2) };
      }
      return { ...p, ano1: v };
    });
  };

  const editDisc = (
    grupo: "comum" | "div",
    idx: number,
    campo: keyof Disciplina,
    valor: string,
  ) => {
    const setter = grupo === "comum" ? setComum : setDiversificada;
    setter((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  };

  const editEstab = (idx: number, campo: keyof Estab, valor: string) =>
    setEstabs((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));

  const fillTest = () => {
    const base = 2016;
    setForm({
      ...initial,
      nomeAluno: pick(NOMES),
      mae: pick(MAES),
      pai: pick(PAIS),
      dataNasc: "16/08/2000",
      municipioNasc: "RECIFE",
      rg: `${rnd(1)}.${rnd(3)}.${rnd(3)}`,
      ano1: String(base),
      ano2: String(base + 1),
      ano3: String(base + 2),
      anoConclusao: String(base + 2),
      localData: "Recife-PE, 03 de Fevereiro de 2019",
    });
    setComum(COMUM_BASE);
    setDiversificada(DIVERSIFICADA_BASE);
    setEstabs([
      { serie: "1º", ano: String(base), estab: initial.escola, cidade: "RECIFE-PE", situacao: "PROGRESSÃO PLENA" },
      { serie: "2º", ano: String(base + 1), estab: initial.escola, cidade: "RECIFE-PE", situacao: "PROGRESSÃO PLENA" },
      { serie: "3º", ano: String(base + 2), estab: initial.escola, cidade: "RECIFE-PE", situacao: "PROGRESSÃO PLENA" },
    ]);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setComum(COMUM_BASE);
    setDiversificada(DIVERSIFICADA_BASE);
    setEstabs([
      { serie: "1º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
      { serie: "2º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
      { serie: "3º", ano: "", estab: "", cidade: "", situacao: "PROGRESSÃO PLENA" },
    ]);
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    saveFormDraft("certificado-medio", form as unknown as Record<string, unknown>);

    try {
      const brasaoBase64 = await loadBrasaoDataUrl(form.uf);

      const bodyData = {
        uf: form.uf,
        brasao_base64: brasaoBase64,
        gov_estado: form.govEstado,
        secretaria: form.secretaria,
        escola: form.escola,
        endereco: form.endereco,
        contato: form.contato,
        portaria: form.portaria,

        nome_aluno: form.nomeAluno,
        mae: form.mae,
        pai: form.pai,
        sexo: form.sexo,
        data_nasc: form.dataNasc,
        municipio_nasc: form.municipioNasc,
        uf_nasc: form.ufNasc,
        nacionalidade: form.nacionalidade,
        rg: form.rg,
        orgao_expedidor: form.orgaoExpedidor,
        serie_conclusao: form.serieConclusao,
        ano_conclusao: form.anoConclusao,

        turma1: form.turma1,
        turma2: form.turma2,
        turma3: form.turma3,

        disciplinas_comum: comum,
        disciplinas_diversificada: diversificada,
        estabelecimentos: estabs,

        dispensa_ed_fisica: form.dispensaEdFisica,
        base_legal: form.baseLegal,
        observacoes: form.observacoes,
        local_data: form.localData,
      };

      const { data, error } = await invokeGeneratePdf("generate-certificado-medio-pdf", {
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
        navigate("/dashboard/documents/certificado-medio/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Certificado + Histórico:", err);
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
  const cellCls = "h-8 px-1 text-center text-xs " + inputCls;

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

  const TabelaDisciplinas = ({ grupo, linhas }: { grupo: "comum" | "div"; linhas: Disciplina[] }) => (
    <div className="space-y-2">
      {linhas.map((l, i) => (
        <div key={l.nome} className="rounded-lg border border-border/60 bg-secondary/40 p-2">
          <p className="mb-1.5 text-xs font-bold text-foreground">{l.nome}</p>
          <div className="grid grid-cols-6 gap-1.5">
            <Input value={l.n1} onChange={(e) => editDisc(grupo, i, "n1", e.target.value)} placeholder="Nota 1º" className={cellCls} />
            <Input value={l.c1} onChange={(e) => editDisc(grupo, i, "c1", e.target.value)} placeholder="CH 1º" className={cellCls} />
            <Input value={l.n2} onChange={(e) => editDisc(grupo, i, "n2", e.target.value)} placeholder="Nota 2º" className={cellCls} />
            <Input value={l.c2} onChange={(e) => editDisc(grupo, i, "c2", e.target.value)} placeholder="CH 2º" className={cellCls} />
            <Input value={l.n3} onChange={(e) => editDisc(grupo, i, "n3", e.target.value)} placeholder="Nota 3º" className={cellCls} />
            <Input value={l.c3} onChange={(e) => editDisc(grupo, i, "c3", e.target.value)} placeholder="CH 3º" className={cellCls} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl">
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">CERTIFICADO + HISTÓRICO — Ensino Médio</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <FormDraftsPanel docType="certificado-medio" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        {/* ESCOLA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={School} title="Escola (cabeçalho)" />

          <div className="space-y-1.5">
            <FieldLabel required>Estado (brasão do documento)</FieldLabel>
            <select
              value={form.uf}
              onChange={(e) => setUf(e.target.value)}
              className={`h-10 w-full rounded-md border px-3 text-sm ${inputCls}`}
            >
              {ESTADOS_UF.map((uf) => (
                <option key={uf} value={uf}>{uf} — {ESTADO_NOMES[uf]}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">O brasão do estado aparece no topo do documento.</p>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Governo do estado</FieldLabel>
            <Input value={form.govEstado} onChange={set("govEstado")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Secretaria</FieldLabel>
            <Input value={form.secretaria} onChange={set("secretaria")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Nome da escola</FieldLabel>
            <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Endereço completo</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Fone / CNPJ</FieldLabel>
            <Input value={form.contato} onChange={set("contato")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Portaria de autorização</FieldLabel>
            <Input value={form.portaria} onChange={set("portaria")} className={inputCls} />
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do aluno</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Mãe</FieldLabel>
              <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Pai</FieldLabel>
              <Input value={form.pai} onChange={set("pai")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Sexo</FieldLabel>
              <select
                value={form.sexo}
                onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value as "M" | "F" }))}
                className={`h-10 w-full rounded-md border px-3 text-sm ${inputCls}`}
              >
                <option value="M">Masculino (filho)</option>
                <option value="F">Feminino (filha)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nascimento</FieldLabel>
              <Input value={form.dataNasc} onChange={(e) => setForm((p) => ({ ...p, dataNasc: maskDate(e.target.value) }))} placeholder="00/00/0000" inputMode="numeric" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nacionalidade</FieldLabel>
              <Input value={form.nacionalidade} onChange={set("nacionalidade")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel required>Natural de</FieldLabel>
              <Input value={form.municipioNasc} onChange={set("municipioNasc")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>UF</FieldLabel>
              <select
                value={form.ufNasc}
                onChange={(e) => setForm((p) => ({ ...p, ufNasc: e.target.value }))}
                className={`h-10 w-full rounded-md border px-3 text-sm ${inputCls}`}
              >
                {ESTADOS_UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>RG</FieldLabel>
              <Input value={form.rg} onChange={set("rg")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Órgão expedidor</FieldLabel>
              <Input value={form.orgaoExpedidor} onChange={set("orgaoExpedidor")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Série de conclusão</FieldLabel>
              <Input value={form.serieConclusao} onChange={set("serieConclusao")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Ano do 1º ano</FieldLabel>
              <Input value={form.ano1} onChange={setAno1} placeholder="2016" inputMode="numeric" className={inputCls} required />
              <p className="text-[11px] text-muted-foreground">2º, 3º e ano de conclusão preenchidos automaticamente.</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <FieldLabel>Turma 1º</FieldLabel>
              <Input value={form.turma1} onChange={set("turma1")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Turma 2º</FieldLabel>
              <Input value={form.turma2} onChange={set("turma2")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Turma 3º</FieldLabel>
              <Input value={form.turma3} onChange={set("turma3")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Conclusão</FieldLabel>
              <Input value={form.anoConclusao} onChange={set("anoConclusao")} className={inputCls} />
            </div>
          </div>
        </div>

        {/* NOTAS (opcional) */}
        <div className="glass space-y-4 rounded-xl p-6">
          <button
            type="button"
            onClick={() => setNotasAbertas((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-left"
          >
            <span className="text-sm font-semibold text-primary">
              Notas e carga horária <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <span className="text-xs text-muted-foreground">{notasAbertas ? "Ocultar" : "Preencher"}</span>
          </button>
          {notasAbertas && (
            <>
              <SectionHeader icon={BookOpen} title="Base Nacional Comum" />
              <TabelaDisciplinas grupo="comum" linhas={comum} />
              <SectionHeader icon={BookOpen} title="Base diversificada" />
              <TabelaDisciplinas grupo="div" linhas={diversificada} />
            </>
          )}
        </div>


        {/* ESTABELECIMENTOS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={ClipboardList} title="Estabelecimentos de ensino" />
          {estabs.map((e, i) => (
            <div key={e.serie} className="space-y-2 rounded-lg border border-border/60 bg-secondary/40 p-3">
              <p className="text-xs font-bold uppercase text-foreground">{e.serie} Série</p>
              <div className="grid grid-cols-3 gap-2">
                <Input value={e.ano} onChange={(ev) => editEstab(i, "ano", ev.target.value)} placeholder="Ano" className={inputCls} />
                <Input value={e.cidade} onChange={(ev) => editEstab(i, "cidade", ev.target.value)} placeholder="Cidade/Estado" className={inputCls} />
                <Input value={e.situacao} onChange={(ev) => editEstab(i, "situacao", ev.target.value)} placeholder="Situação" className={inputCls} />
              </div>
              <Input value={e.estab} onChange={(ev) => editEstab(i, "estab", ev.target.value)} placeholder="Nome do estabelecimento" className={inputCls} />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Dispensa de Educação Física</FieldLabel>
              <select
                value={form.dispensaEdFisica}
                onChange={(e) => setForm((p) => ({ ...p, dispensaEdFisica: e.target.value as "SIM" | "NAO" }))}
                className={`h-10 w-full rounded-md border px-3 text-sm ${inputCls}`}
              >
                <option value="NAO">Não</option>
                <option value="SIM">Sim</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Base legal</FieldLabel>
              <Input value={form.baseLegal} onChange={set("baseLegal")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Observações</FieldLabel>
            <Input value={form.observacoes} onChange={set("observacoes")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Local e data</FieldLabel>
            <Input value={form.localData} onChange={set("localData")} placeholder="Recife-PE, 03 de Fevereiro de 2019" className={inputCls} />
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
            ) : (
              isEditMode ? "Salvar alterações" : "Gerar preview"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
