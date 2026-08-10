import { useState, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  University, GraduationCap, User, Loader2, FlaskConical, Trash2, Check, ChevronsUpDown,
  BookOpen, Plus, X, RefreshCw, ClipboardList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { pick, rnd } from "@/lib/random";
import { MODALIDADES, type Modalidade, cursosPorModalidade, TOTAL_CURSOS } from "@/lib/diploma-cursos";
import {
  gerarGrade, montarLinhas, cargaHorariaTotal, CURSOS_COM_GRADE_REAL,
  type LinhaHistorico,
} from "@/lib/grades-curriculares";
import logoAsset from "@/assets/anhanguera-logo.png.asset.json";
import { loadTemplateBase64 } from "@/lib/template-cache";

const TITULACOES = ["Bacharel", "Licenciado", "Tecnólogo", "Técnico"];

const ESTADOS = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo",
  "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba",
  "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul",
  "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
];

interface FormState {
  instituicaoModo: "auto" | "manual";
  faculdade: string;
  cidadeUf: string;
  enderecoFaculdade: string;

  nome: string;
  ra: string;
  naturalEstado: string;
  nascimento: string;
  docIdentidade: string;
  nacionalidade: string;

  modalidade: Modalidade;
  curso: string;
  titulacao: string;
  regime: string;
  semestres: number;
  anoInicial: string;
  comNotas: boolean;

  ingresso: string;
  classificacao: string;
  portaria: string;

  enadeTexto: string;
  dataColacao: string;
  dataExpedicao: string;
  localData: string;
  secretariaNome: string;
  secretariaCargo: string;
  codigoDocumento: string;
  siteValidacao: string;
}

const initial: FormState = {
  instituicaoModo: "auto",
  faculdade: "FACULDADE ANHANGUERA DE ANÁPOLIS",
  cidadeUf: "Anápolis/GO",
  enderecoFaculdade: "AV. Universitária, nº 683 - Centro, Anápolis - GO, CEP 75080-150 - Tel.: (62) 3098-3838",

  nome: "",
  ra: "",
  naturalEstado: "Goiás",
  nascimento: "",
  docIdentidade: "",
  nacionalidade: "brasileira",

  modalidade: "bacharelado",
  curso: "ENGENHARIA MECÂNICA",
  titulacao: "Bacharel",
  regime: "Semestral",
  semestres: 10,
  anoInicial: "2009",
  comNotas: true,

  ingresso: "Processo Seletivo/Vestibular Unificado - Conteúdo da Prova: ENEM-Historico do Ensino Médio-Prova Objetiva-Redação 11/2008 Faculdade Latino Americana",
  classificacao: "201",
  portaria: "Renovação de reconhecimento através da Portaria SERES nº 286, de 21/12/2012, publicada no D.O.U. de 27/12/2012.",

  enadeTexto: "Estudante dispensado de realização do ENADE, em razão do calendário trienal",
  dataColacao: "",
  dataExpedicao: "",
  localData: "",
  secretariaNome: "Liana Oliveira Dutra",
  secretariaCargo: "Secretaria",
  codigoDocumento: "",
  siteValidacao: "http://sada.anhanguera.com",
};

const NOMES = ["Marcos Feliciano Ramos", "Rafael Souza Andrade", "Juliana Ferreira Lima", "Pedro Henrique Barbosa"];

function codigoAleatorio() {
  const hex = "0123456789ABCDEF";
  let out = "";
  for (let i = 0; i < 32; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

/** Campos que o sistema preenche sozinho a partir dos dados principais. */
const AUTO_FIELDS = [
  "titulacao", "ingresso", "dataExpedicao", "localData", "codigoDocumento", "classificacao",
] as const;

export default function HistoricoSuperiorFormPage() {
  const [form, setForm] = useState<FormState>(initial);
  const [cursoOpen, setCursoOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gradeAberta, setGradeAberta] = useState(false);
  const [avancado, setAvancado] = useState(false);
  // campos que o usuário editou manualmente — deixam de ser recalculados
  const [manuais, setManuais] = useState<Record<string, boolean>>({});

  const [grupos, setGrupos] = useState<LinhaHistorico[][]>(() =>
    montarLinhas(gerarGrade(initial.curso, initial.semestres), Number(initial.anoInicial), true),
  );

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const cursos = useMemo(() => cursosPorModalidade(form.modalidade), [form.modalidade]);

  const chTotal = useMemo(
    () => grupos.reduce((a, g) => a + g.reduce((s, l) => s + (Number(l.ch) || 0), 0), 0),
    [grupos],
  );

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setManuais((m) => ({ ...m, [field]: true }));
      setForm((p) => ({ ...p, [field]: e.target.value }));
    };

  /** Deriva os campos repetidos nas 3 páginas a partir dos dados principais. */
  const derivar = (f: FormState): FormState => {
    const out = { ...f };
    const cidade = (f.cidadeUf.split("/")[0] || "").trim();
    const anoVest = (Number(f.anoInicial) || 2015) - 1;

    if (!manuais.titulacao) {
      out.titulacao =
        f.modalidade === "licenciatura" ? "Licenciado"
        : f.modalidade === "tecnologo" ? "Tecnólogo"
        : "Bacharel";
    }
    if (!manuais.ingresso) {
      out.ingresso = `Processo Seletivo/Vestibular Unificado - Conteúdo da Prova: ENEM-Historico do Ensino Médio-Prova Objetiva-Redação 11/${anoVest}`;
    }
    if (!manuais.dataExpedicao) out.dataExpedicao = f.dataColacao;
    if (!manuais.localData) {
      const d = out.dataExpedicao || f.dataColacao;
      out.localData = cidade && d ? `${cidade}, ${d}` : "";
    }
    if (!manuais.codigoDocumento || !out.codigoDocumento) {
      out.codigoDocumento = f.codigoDocumento || codigoAleatorio();
    }
    if (!manuais.classificacao) out.classificacao = f.classificacao || String(100 + Math.floor(Math.random() * 300));
    return out;
  };

  const previa = useMemo(() => derivar(form), [form, manuais]);

  const regerarGrade = (over?: Partial<FormState>) => {
    const f = { ...form, ...over };
    const grade = gerarGrade(f.curso, f.semestres);
    setGrupos(montarLinhas(grade, Number(f.anoInicial) || 2015, f.comNotas));
  };


  const escolherCurso = (c: string) => {
    setForm((p) => ({ ...p, curso: c }));
    setCursoOpen(false);
    const grade = gerarGrade(c, form.semestres);
    setGrupos(montarLinhas(grade, Number(form.anoInicial) || 2015, form.comNotas));
    toast({
      title: "Grade curricular carregada",
      description: `${grade.length} semestres · ${cargaHorariaTotal(grade)}h — edite o que quiser abaixo.`,
    });
  };

  const editLinha = (gi: number, li: number, campo: keyof LinhaHistorico, valor: string) =>
    setGrupos((prev) => prev.map((g, i) => (i === gi ? g.map((l, j) => (j === li ? { ...l, [campo]: valor } : l)) : g)));

  const addLinha = (gi: number) =>
    setGrupos((prev) =>
      prev.map((g, i) =>
        i === gi
          ? [...g, { ano: g[0]?.ano || "", serie: g[0]?.serie || "", disciplina: "", ch: "60", freq: "100", media: "8,00", situacao: "Aprovado" }]
          : g,
      ),
    );

  const removeLinha = (gi: number, li: number) =>
    setGrupos((prev) => prev.map((g, i) => (i === gi ? g.filter((_, j) => j !== li) : g)).filter((g) => g.length));

  const fillTest = () => {
    const ano = 2009;
    const next: FormState = {
      ...initial,
      nome: pick(NOMES),
      ra: rnd(10),
      nascimento: "22/01/1977",
      docIdentidade: `${rnd(2)}.${rnd(3)}.${rnd(2)} GO`,
      anoInicial: String(ano),
      dataColacao: "12/02/2014",
      dataExpedicao: "27/02/2014",
      localData: "Anápolis, 27/2/2014",
      codigoDocumento: codigoAleatorio(),
    };
    setForm(next);
    setGrupos(montarLinhas(gerarGrade(next.curso, next.semestres), ano, true));
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setGrupos(montarLinhas(gerarGrade(initial.curso, initial.semestres), Number(initial.anoInicial), true));
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    saveFormDraft("historico-superior", form as unknown as Record<string, unknown>);

    try {
      const logoBase64 = await loadTemplateBase64(logoAsset.url);

      const bodyData = {
        logo_base64: logoBase64,
        faculdade: form.faculdade,
        cidade_uf: form.cidadeUf,
        endereco_faculdade: form.enderecoFaculdade,

        nome: form.nome,
        ra: form.ra,
        natural_estado: form.naturalEstado,
        nascimento: form.nascimento,
        doc_identidade: form.docIdentidade,
        nacionalidade: form.nacionalidade,

        titulacao: form.titulacao,
        ingresso: form.ingresso,
        classificacao: form.classificacao,
        curso: form.curso,
        regime: form.regime,
        portaria: form.portaria,

        grupos,

        enade_texto: form.enadeTexto,
        diploma_curso: form.curso,
        carga_horaria: String(chTotal),
        data_colacao: form.dataColacao,
        data_expedicao: form.dataExpedicao,
        local_data: form.localData,
        secretaria_nome: form.secretariaNome,
        secretaria_cargo: form.secretariaCargo,
        codigo_documento: form.codigoDocumento || codigoAleatorio(),
        site_validacao: form.siteValidacao,
      };

      const { data, error } = await invokeGeneratePdf("generate-historico-superior-pdf", {
        body: { ...bodyData, preview: true },
      });
      if (error) throw error;

      const pdfResult = data?.pdfBase64;
      if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");

      const previewId = storePreviewPayload({ pdfBase64: pdfResult, formData: bodyData });
      navigate("/dashboard/documents/historico-superior/preview", { state: { previewId } });
    } catch (err) {
      console.error("Erro ao gerar Histórico Superior:", err);
      toast({
        title: "Erro ao gerar PDF",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";
  const cellCls = "h-8 px-1.5 text-xs " + inputCls;

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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">HISTÓRICO ESCOLAR SUPERIOR</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <FormDraftsPanel docType="historico-superior" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

        {/* INSTITUIÇÃO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={University} title="Instituição" />

          <div className="space-y-1.5">
            <FieldLabel>Nome da instituição</FieldLabel>
            <Select
              value={form.instituicaoModo}
              onValueChange={(v) =>
                setForm((p) => ({
                  ...p,
                  instituicaoModo: v as "auto" | "manual",
                  ...(v === "auto"
                    ? { faculdade: initial.faculdade, cidadeUf: initial.cidadeUf, enderecoFaculdade: initial.enderecoFaculdade }
                    : {}),
                }))
              }
            >
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático — Anhanguera</SelectItem>
                <SelectItem value="manual">Manual — digitar outra faculdade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Faculdade</FieldLabel>
            <Input value={form.faculdade} onChange={set("faculdade")} className={inputCls} required disabled={form.instituicaoModo === "auto"} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Cidade/UF (topo)</FieldLabel>
              <Input value={form.cidadeUf} onChange={set("cidadeUf")} placeholder="Anápolis/GO" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Código do documento</FieldLabel>
              <Input value={form.codigoDocumento} onChange={set("codigoDocumento")} placeholder="gerado automaticamente" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Endereço / contato</FieldLabel>
            <Input value={form.enderecoFaculdade} onChange={set("enderecoFaculdade")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Portaria de reconhecimento</FieldLabel>
            <Input value={form.portaria} onChange={set("portaria")} className={inputCls} />
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>RA</FieldLabel>
              <Input value={form.ra} onChange={(e) => setForm((p) => ({ ...p, ra: maskDigits(12)(e.target.value) }))} inputMode="numeric" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nascimento</FieldLabel>
              <Input value={form.nascimento} onChange={(e) => setForm((p) => ({ ...p, nascimento: maskDate(e.target.value) }))} inputMode="numeric" placeholder="22/01/1977" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Natural do Estado</FieldLabel>
              <Select value={form.naturalEstado} onValueChange={(v) => setForm((p) => ({ ...p, naturalEstado: v }))}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nacionalidade</FieldLabel>
              <Input value={form.nacionalidade} onChange={set("nacionalidade")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Doc. Identidade</FieldLabel>
            <Input value={form.docIdentidade} onChange={set("docIdentidade")} placeholder="37.976.40 GO" className={inputCls} />
          </div>
        </div>

        {/* CURSO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={GraduationCap} title="Curso" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Modalidade</FieldLabel>
              <Select
                value={form.modalidade}
                onValueChange={(v) => setForm((p) => ({ ...p, modalidade: v as Modalidade }))}
              >
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Titulação</FieldLabel>
              <Select value={form.titulacao} onValueChange={(v) => setForm((p) => ({ ...p, titulacao: v }))}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TITULACOES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Curso</FieldLabel>
            <Popover open={cursoOpen} onOpenChange={setCursoOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className={`w-full justify-between ${inputCls}`}>
                  <span className="truncate">{form.curso || "Selecione o curso"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar curso..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>Nenhum curso encontrado.</CommandEmpty>
                    <CommandGroup>
                      {cursos.map((c) => (
                        <CommandItem key={c} value={c} onSelect={() => escolherCurso(c)}>
                          <Check className={`mr-2 h-4 w-4 ${form.curso === c ? "opacity-100" : "opacity-0"}`} />
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              {cursos.length} cursos nesta modalidade · {TOTAL_CURSOS} no catálogo ·{" "}
              {CURSOS_COM_GRADE_REAL.length} com grade curricular real cadastrada. Ao trocar o curso as
              disciplinas mudam automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Ano de ingresso</FieldLabel>
              <Input
                value={form.anoInicial}
                onChange={(e) => {
                  const v = maskDigits(4)(e.target.value);
                  setForm((p) => ({ ...p, anoInicial: v }));
                  if (v.length === 4) regerarGrade({ anoInicial: v });
                }}
                inputMode="numeric"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Semestres</FieldLabel>
              <Select
                value={String(form.semestres)}
                onValueChange={(v) => {
                  setForm((p) => ({ ...p, semestres: Number(v) }));
                  regerarGrade({ semestres: Number(v) });
                }}
              >
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => <SelectItem key={n} value={String(n)}>{n} semestres</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Regime</FieldLabel>
              <Input value={form.regime} onChange={set("regime")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Forma de ingresso</FieldLabel>
            <Input value={form.ingresso} onChange={set("ingresso")} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Classificação</FieldLabel>
              <Input value={form.classificacao} onChange={set("classificacao")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Carga horária total</FieldLabel>
              <Input value={`${chTotal} h`} readOnly className={inputCls} />
            </div>
          </div>
        </div>

        {/* GRADE */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={BookOpen} title="Disciplinas (grade curricular)" />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setGradeAberta((v) => !v)} className="text-xs">
              {gradeAberta ? "Ocultar" : "Editar"} disciplinas ({grupos.reduce((a, g) => a + g.length, 0)})
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => regerarGrade()} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Regerar notas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const novo = !form.comNotas;
                setForm((p) => ({ ...p, comNotas: novo }));
                regerarGrade({ comNotas: novo });
              }}
              className="text-xs"
            >
              {form.comNotas ? "Deixar notas em branco" : "Preencher notas"}
            </Button>
          </div>

          {gradeAberta && (
            <div className="space-y-4">
              {grupos.map((g, gi) => (
                <div key={gi} className="rounded-lg border border-border/60 bg-secondary/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">
                      {g[0]?.serie || `${gi + 1}º semestre`} · {g[0]?.ano || ""}
                    </p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => addLinha(gi)} className="h-7 gap-1 text-xs text-primary">
                      <Plus className="h-3.5 w-3.5" /> Disciplina
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {g.map((l, li) => (
                      <div key={li} className="grid grid-cols-12 gap-1.5">
                        <Input value={l.disciplina} onChange={(e) => editLinha(gi, li, "disciplina", e.target.value)} placeholder="Disciplina" className={`col-span-5 ${cellCls}`} />
                        <Input value={l.ch} onChange={(e) => editLinha(gi, li, "ch", e.target.value)} placeholder="C.H." className={`col-span-1 text-center ${cellCls}`} />
                        <Input value={l.freq} onChange={(e) => editLinha(gi, li, "freq", e.target.value)} placeholder="%" className={`col-span-1 text-center ${cellCls}`} />
                        <Input value={l.media} onChange={(e) => editLinha(gi, li, "media", e.target.value)} placeholder="Média" className={`col-span-2 text-center ${cellCls}`} />
                        <Input value={l.situacao} onChange={(e) => editLinha(gi, li, "situacao", e.target.value)} placeholder="Situação" className={`col-span-2 ${cellCls}`} />
                        <button type="button" onClick={() => removeLinha(gi, li)} className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FECHAMENTO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={ClipboardList} title="Diploma e assinatura" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Data da colação de grau</FieldLabel>
              <Input value={form.dataColacao} onChange={(e) => setForm((p) => ({ ...p, dataColacao: maskDate(e.target.value) }))} inputMode="numeric" placeholder="12/02/2014" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data de expedição</FieldLabel>
              <Input value={form.dataExpedicao} onChange={(e) => setForm((p) => ({ ...p, dataExpedicao: maskDate(e.target.value) }))} inputMode="numeric" placeholder="27/02/2014" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Local e data</FieldLabel>
            <Input value={form.localData} onChange={set("localData")} placeholder="Anápolis, 27/2/2014" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Nome do(a) secretário(a)</FieldLabel>
              <Input value={form.secretariaNome} onChange={set("secretariaNome")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Cargo</FieldLabel>
              <Input value={form.secretariaCargo} onChange={set("secretariaCargo")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Observação ENADE</FieldLabel>
            <Input value={form.enadeTexto} onChange={set("enadeTexto")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Site de conferência (rodapé)</FieldLabel>
            <Input value={form.siteValidacao} onChange={set("siteValidacao")} className={inputCls} />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando preview...</>) : "Gerar preview do histórico"}
        </Button>
      </form>
    </div>
  );
}
