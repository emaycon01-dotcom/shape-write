import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  School, Loader2, FlaskConical, Trash2, FileText, User, PenLine,
  ChevronDown, ChevronRight, ListChecks, CalendarClock, BookOpenCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { normalizeSignatureImage } from "@/lib/signature-image";
import { ESTADOS_UF, ESTADO_NOMES, loadBrasaoDataUrl } from "@/lib/brasoes-estados";

type Nota = { componente: string; base: string; n: string[] };
type Etapa = { etapa: string; ano: string; unidade: string; cidade: string; uf: string };
type Dependencia = {
  serie: string; componente: string; ch: string; nota: string;
  freq: string; escola: string; cidade: string; ano: string;
};

const COLUNAS = ["1º", "2º/1ª", "3º/2ª", "4º/3ª", "5º/4ª", "6º/5ª", "7º/6ª", "8º/7ª", "9º/8ª"];
const ETAPAS_PADRAO = ["1º ANO", "2º Ano/1ª Série", "3º Ano/2ª Série", "4º Ano/3ª Série", "5º Ano/4ª Série", "6º Ano/5ª Série", "7º Ano/6ª Série", "8º Ano/7ª Série", "9º Ano/8ª Série"];
const TURNOS = ["MANHÃ", "TARDE", "NOITE", "INTEGRAL"];
const MODALIDADES = ["ENSINO REGULAR", "EDUCAÇÃO DE JOVENS E ADULTOS", "ENSINO FUNDAMENTAL DE 9 ANOS"];

const vazio9 = () => Array.from({ length: 9 }, () => "");

const NOTAS_PADRAO: Nota[] = [
  { componente: "Língua Portuguesa", base: "COMUM", n: vazio9() },
  { componente: "Ciências Físicas e Biológicas", base: "COMUM", n: vazio9() },
  { componente: "Ciências", base: "COMUM", n: vazio9() },
  { componente: "Matemática", base: "COMUM", n: vazio9() },
  { componente: "Ensino da História e Geografia", base: "COMUM", n: vazio9() },
  { componente: "História", base: "COMUM", n: vazio9() },
  { componente: "Geografia", base: "COMUM", n: vazio9() },
  { componente: "Artes", base: "COMUM", n: vazio9() },
  { componente: "Educação Física", base: "COMUM", n: vazio9() },
  { componente: "Ensino Religioso", base: "ART. 33 LDB", n: vazio9() },
  { componente: "Língua Estrangeira - Inglês", base: "DIVERSIFICADA", n: vazio9() },
  { componente: "Estudos Sociais/Sociologia", base: "DIVERSIFICADA", n: vazio9() },
];

interface FormState {
  estado: string;
  gerencia: string;
  escola: string;
  endereco: string;
  cep: string;
  telefone: string;
  inep: string;
  modalidade: string;
  turno: string;
  nomeAluno: string;
  rg: string;
  filiacao: string;
  municipioNascimento: string;
  ufNascimento: string;
  pais: string;
  dataNascimento: string;
  observacoes: string;
  observacaoPagina2: string;
  secretarioNome: string;
  secretarioPortaria: string;
  diretorNome: string;
  diretorPortaria: string;
  diretorRegistro: string;
}

const initial: FormState = {
  estado: "PE",
  gerencia: "GERÊNCIA REGIONAL DE EDUCAÇÃO",
  escola: "ESCOLA ESTADUAL",
  endereco: "",
  cep: "",
  telefone: "",
  inep: "",
  modalidade: MODALIDADES[0],
  turno: "MANHÃ",
  nomeAluno: "",
  rg: "",
  filiacao: "",
  municipioNascimento: "",
  ufNascimento: "PE",
  pais: "BRASIL",
  dataNascimento: "",
  observacoes: "AP - APROVADO / * - DISCIPLINA NÃO CURSADA NA SÉRIE.",
  observacaoPagina2: "Documento transcrito de acordo com o original arquivado na pasta do aluno neste Estabelecimento de Ensino.",
  secretarioNome: "",
  secretarioPortaria: "",
  diretorNome: "",
  diretorPortaria: "",
  diretorRegistro: "",
};

const etapaVazia = (etapa = ""): Etapa => ({ etapa, ano: "", unidade: "", cidade: "", uf: "PE" });
const dependenciaVazia = (): Dependencia => ({ serie: "", componente: "", ch: "", nota: "", freq: "", escola: "", cidade: "", ano: "" });

export default function HistoricoFundamentalFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<FormState>(initial);
  const [notas, setNotas] = useState<Nota[]>(NOTAS_PADRAO);
  const [frequencia, setFrequencia] = useState<string[]>(vazio9());
  const [cargaHoraria, setCargaHoraria] = useState<string[]>(vazio9());
  const [resultado, setResultado] = useState<string[]>(vazio9());
  const [etapas, setEtapas] = useState<Etapa[]>(ETAPAS_PADRAO.map((e) => etapaVazia(e)));
  const [dependencias, setDependencias] = useState<Dependencia[]>([
    { ...dependenciaVazia(), serie: "5ª" },
    { ...dependenciaVazia(), serie: "6ª" },
    { ...dependenciaVazia(), serie: "7ª" },
    { ...dependenciaVazia(), serie: "8ª" },
  ]);
  const [assinatura, setAssinatura] = useState("");
  const [showNotas, setShowNotas] = useState(false);
  const [showDependencias, setShowDependencias] = useState(false);
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
          gerencia: b.gerencia || p.gerencia,
          escola: b.escola || p.escola,
          endereco: b.endereco || p.endereco,
          cep: b.cep || p.cep,
          telefone: b.telefone || p.telefone,
          inep: b.inep || p.inep,
          modalidade: b.modalidade || p.modalidade,
          turno: b.turno || p.turno,
          nomeAluno: b.nome_aluno || "",
          rg: b.rg || "",
          filiacao: b.filiacao || "",
          municipioNascimento: b.municipio_nascimento || "",
          ufNascimento: b.uf_nascimento || p.ufNascimento,
          pais: b.pais || p.pais,
          dataNascimento: b.data_nascimento || "",
          observacoes: b.observacoes || p.observacoes,
          observacaoPagina2: b.observacao_pagina2 || p.observacaoPagina2,
          secretarioNome: b.secretario_nome || "",
          secretarioPortaria: b.secretario_portaria || "",
          diretorNome: b.diretor_nome || "",
          diretorPortaria: b.diretor_portaria || "",
          diretorRegistro: b.diretor_registro || "",
        }));
        const arr = (key: string) => {
          try { const v = JSON.parse(b[key] || "[]"); return Array.isArray(v) ? v : null; } catch { return null; }
        };
        const n = arr("notas_json"); if (n?.length) setNotas(n as Nota[]);
        const e = arr("etapas_json"); if (e?.length) setEtapas(e as Etapa[]);
        const dep = arr("dependencias_json"); if (dep?.length) setDependencias(dep as Dependencia[]);
        const f = arr("frequencia_json"); if (f?.length) setFrequencia(f as string[]);
        const ch = arr("carga_horaria_json"); if (ch?.length) setCargaHoraria(ch as string[]);
        const r = arr("resultado_json"); if (r?.length) setResultado(r as string[]);
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

  const setNotaCampo = (index: number, key: "componente" | "base", value: string) =>
    setNotas((p) => p.map((n, i) => (i === index ? { ...n, [key]: value } : n)));

  const setNotaValor = (index: number, col: number, value: string) =>
    setNotas((p) => p.map((n, i) => (i === index ? { ...n, n: n.n.map((v, c) => (c === col ? value : v)) } : n)));

  const setLinha = (setter: React.Dispatch<React.SetStateAction<string[]>>, col: number, value: string) =>
    setter((p) => p.map((v, i) => (i === col ? value : v)));

  const setEtapa = (index: number, key: keyof Etapa, value: string) =>
    setEtapas((p) => p.map((t, i) => (i === index ? { ...t, [key]: value } : t)));

  const setDependencia = (index: number, key: keyof Dependencia, value: string) =>
    setDependencias((p) => p.map((t, i) => (i === index ? { ...t, [key]: value } : t)));

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
      escola: "ESCOLA ESTADUAL PROFESSOR JOSÉ DA SILVA",
      endereco: "Rua das Flores, 120 – Centro, Recife-PE",
      cep: "50010-000",
      telefone: "(81) 3232-1010",
      inep: "26123456",
      nomeAluno: "JOÃO PEDRO SANTOS",
      rg: "8.123.456 SDS/PE",
      filiacao: "MARIA SANTOS e ANTÔNIO SANTOS",
      municipioNascimento: "RECIFE",
      dataNascimento: "12/03/2005",
      secretarioNome: "Marciana Cabral da Costa",
      secretarioPortaria: "Portaria nº 035/13",
      diretorNome: "José Evandro de S. Bezerra",
      diretorPortaria: "Portaria nº 3.010/2015",
      diretorRegistro: "Reg. MEC. 35.456",
    });
    const amostra = [
      ["*", "6,7", "7,5", "6,0", "8,6", "8,2", "8,2", "7,5", "8,1"],
      ["*", "*", "*", "*", "*", "*", "*", "8,4", "9,5"],
      ["*", "*", "*", "*", "*", "*", "*", "*", "*"],
      ["*", "9,2", "9,3", "8,3", "8,2", "6,4", "8,0", "8,2", "7,2"],
      ["*", "8,2", "*", "*", "*", "*", "*", "*", "*"],
      ["*", "*", "7,3", "6,3", "8,8", "8,5", "8,9", "7,3", "7,6"],
      ["*", "*", "7,3", "6,3", "8,6", "8,4", "6,8", "8,7", "7,7"],
      ["*", "9,2", "8,7", "8,8", "8,8", "8,4", "8,2", "9,8", "9,2"],
      ["*", "9,3", "9,0", "7,3", "8,5", "6,6", "7,6", "7,9", "8,7"],
      ["*", "*", "7,7", "8,4", "9,6", "8,1", "8,5", "9,3", "9,6"],
      ["*", "*", "7,4", "6,8", "8,8", "6,9", "6,6", "7,3", "7,7"],
      ["*", "*", "*", "*", "*", "8,7", "8,9", "*", "*"],
    ];
    setNotas(NOTAS_PADRAO.map((n, i) => ({ ...n, n: amostra[i] || vazio9() })));
    setFrequencia(["*", "96,7", "81", "99,5", "100", "96,6", "98,8", "99,91", "99,4"]);
    setCargaHoraria(["*", "800", "800", "800", "800", "1160", "1160", "1160", "1160"]);
    setResultado(["*", "AP", "AP", "AP", "AP", "AP", "AP", "AP", "AP"]);
    setEtapas(ETAPAS_PADRAO.map((e, i) => ({
      etapa: e,
      ano: String(2011 + i),
      unidade: "ESCOLA ESTADUAL PROFESSOR JOSÉ DA SILVA",
      cidade: "Recife",
      uf: "PE",
    })));
    setShowNotas(true);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setNotas(NOTAS_PADRAO);
    setFrequencia(vazio9());
    setCargaHoraria(vazio9());
    setResultado(vazio9());
    setEtapas(ETAPAS_PADRAO.map((e) => etapaVazia(e)));
    setDependencias([dependenciaVazia()]);
    setAssinatura("");
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const brasao = await loadBrasaoDataUrl(form.estado);

      const bodyData = {
        estado: form.estado,
        estado_nome: ESTADO_NOMES[form.estado] || form.estado,
        gerencia: form.gerencia,
        escola: form.escola,
        endereco: form.endereco,
        cep: form.cep,
        telefone: form.telefone,
        inep: form.inep,
        modalidade: form.modalidade,
        turno: form.turno,
        nome_aluno: form.nomeAluno,
        rg: form.rg,
        filiacao: form.filiacao,
        municipio_nascimento: form.municipioNascimento,
        uf_nascimento: form.ufNascimento,
        pais: form.pais,
        data_nascimento: form.dataNascimento,
        observacoes: form.observacoes,
        observacao_pagina2: form.observacaoPagina2,
        secretario_nome: form.secretarioNome,
        secretario_portaria: form.secretarioPortaria,
        diretor_nome: form.diretorNome,
        diretor_portaria: form.diretorPortaria,
        diretor_registro: form.diretorRegistro,
        notas_json: JSON.stringify(notas),
        etapas_json: JSON.stringify(etapas.filter((t) => t.etapa || t.ano || t.unidade)),
        dependencias_json: JSON.stringify(dependencias.filter((t) => t.serie || t.componente)),
        frequencia_json: JSON.stringify(frequencia),
        carga_horaria_json: JSON.stringify(cargaHoraria),
        resultado_json: JSON.stringify(resultado),
        template_brasao_base64: brasao,
        assinatura_base64: assinatura,
      };

      const { data, error } = await invokeGeneratePdf("generate-historico-fundamental-pdf", {
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
        navigate("/dashboard/documents/historico-fundamental/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Histórico Ensino Fundamental:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">HISTÓRICO ENSINO FUNDAMENTAL</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
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
            <FieldLabel>Gerência / diretoria regional</FieldLabel>
            <Input value={form.gerencia} onChange={set("gerencia")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Nome da unidade de ensino</FieldLabel>
            <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Endereço</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel>CEP</FieldLabel>
              <Input value={form.cep} onChange={set("cep")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Telefone</FieldLabel>
              <Input value={form.telefone} onChange={set("telefone")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Código INEP</FieldLabel>
              <Input value={form.inep} onChange={set("inep")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Modalidade</FieldLabel>
              <select value={form.modalidade} onChange={(e) => setForm((p) => ({ ...p, modalidade: e.target.value }))} className={selectCls}>
                {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Turno</FieldLabel>
              <select value={form.turno} onChange={(e) => setForm((p) => ({ ...p, turno: e.target.value }))} className={selectCls}>
                {TURNOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do aluno (a)</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Filiação</FieldLabel>
            <Input value={form.filiacao} onChange={set("filiacao")} placeholder="Nome da mãe e do pai" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>R.G.</FieldLabel>
              <Input value={form.rg} onChange={set("rg")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de nascimento</FieldLabel>
              <Input value={form.dataNascimento} onChange={setMask("dataNascimento", maskDate)} inputMode="numeric" placeholder="12/03/2005" className={inputCls} required />
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
                <span className="block text-lg font-bold text-foreground">Notas por ano/série (opcional)</span>
                <span className="block text-xs text-muted-foreground">
                  Deixe em branco para sair com asterisco (*), como no modelo oficial.
                </span>
              </span>
            </span>
            {showNotas ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
          </button>

          {showNotas && (
            <div className="mt-5 space-y-4 overflow-x-auto">
              <div className="min-w-[720px] space-y-2">
                <div className="grid grid-cols-[1fr_96px_repeat(9,46px)] gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  <span>Disciplina</span>
                  <span className="text-center">Base</span>
                  {COLUNAS.map((c) => <span key={c} className="text-center">{c}</span>)}
                </div>

                {notas.map((nota, i) => (
                  <div key={i} className="grid grid-cols-[1fr_96px_repeat(9,46px)] items-center gap-1">
                    <Input value={nota.componente} onChange={(e) => setNotaCampo(i, "componente", e.target.value)} className={`${inputCls} h-9 text-xs`} />
                    <Input value={nota.base} onChange={(e) => setNotaCampo(i, "base", e.target.value)} className={`${inputCls} h-9 text-center text-[10px]`} />
                    {nota.n.map((v, c) => (
                      <Input key={c} value={v} onChange={(e) => setNotaValor(i, c, e.target.value)} className={`${inputCls} h-9 px-1 text-center text-xs`} />
                    ))}
                  </div>
                ))}

                <div className="space-y-2 border-t border-border/50 pt-3">
                  {([
                    ["Frequência anual %", frequencia, setFrequencia],
                    ["Carga horária anual", cargaHoraria, setCargaHoraria],
                    ["Resultado final", resultado, setResultado],
                  ] as const).map(([rotulo, valores, setter]) => (
                    <div key={rotulo} className="grid grid-cols-[1fr_96px_repeat(9,46px)] items-center gap-1">
                      <span className="text-xs font-semibold text-primary">{rotulo}</span>
                      <span />
                      {valores.map((v, c) => (
                        <Input
                          key={c}
                          value={v}
                          onChange={(e) => setLinha(setter as React.Dispatch<React.SetStateAction<string[]>>, c, e.target.value)}
                          className={`${inputCls} h-9 px-1 text-center text-xs`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setNotas((p) => [...p, { componente: "", base: "COMUM", n: vazio9() }])}>
                  + Adicionar disciplina
                </Button>
                {notas.length > 1 && (
                  <Button type="button" variant="outline" size="sm" className="text-xs text-destructive" onClick={() => setNotas((p) => p.slice(0, -1))}>
                    Remover última
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ETAPAS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={CalendarClock} title="Etapas cursadas" />

          {etapas.map((etapa, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_80px]">
                <Input value={etapa.etapa} onChange={(e) => setEtapa(i, "etapa", e.target.value)} placeholder="Etapa" className={`${inputCls} h-9 text-xs`} />
                <Input value={etapa.ano} onChange={(e) => setEtapa(i, "ano", e.target.value)} placeholder="Ano" className={`${inputCls} h-9 text-xs`} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_60px]">
                <Input value={etapa.unidade} onChange={(e) => setEtapa(i, "unidade", e.target.value)} placeholder="Estabelecimento de ensino" className={`${inputCls} h-9 text-xs`} />
                <Input value={etapa.cidade} onChange={(e) => setEtapa(i, "cidade", e.target.value)} placeholder="Cidade" className={`${inputCls} h-9 text-xs`} />
                <select value={etapa.uf} onChange={(e) => setEtapa(i, "uf", e.target.value)} className={`${selectCls} h-9 text-xs`}>
                  {ESTADOS_UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setEtapas((p) => [...p, etapaVazia()])}>
              + Adicionar etapa
            </Button>
            {etapas.length > 1 && (
              <Button type="button" variant="outline" size="sm" className="text-xs text-destructive" onClick={() => setEtapas((p) => p.slice(0, -1))}>
                Remover última
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Observações (página 1)</FieldLabel>
            <Input value={form.observacoes} onChange={set("observacoes")} className={inputCls} />
          </div>
        </div>

        {/* DEPENDÊNCIA (OPCIONAL) */}
        <div className="glass rounded-xl p-6">
          <button
            type="button"
            onClick={() => setShowDependencias((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-3">
              <BookOpenCheck className="h-5 w-5 text-primary" />
              <span>
                <span className="block text-lg font-bold text-foreground">Dependência de estudos (opcional)</span>
                <span className="block text-xs text-muted-foreground">Página 2 do documento. Deixe vazio para sair com traços.</span>
              </span>
            </span>
            {showDependencias ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
          </button>

          {showDependencias && (
            <div className="mt-5 space-y-3">
              {dependencias.map((dep, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Input value={dep.serie} onChange={(e) => setDependencia(i, "serie", e.target.value)} placeholder="Série" className={`${inputCls} h-9 text-xs`} />
                    <Input value={dep.ch} onChange={(e) => setDependencia(i, "ch", e.target.value)} placeholder="CH" className={`${inputCls} h-9 text-xs`} />
                    <Input value={dep.nota} onChange={(e) => setDependencia(i, "nota", e.target.value)} placeholder="Nota" className={`${inputCls} h-9 text-xs`} />
                    <Input value={dep.freq} onChange={(e) => setDependencia(i, "freq", e.target.value)} placeholder="Freq %" className={`${inputCls} h-9 text-xs`} />
                  </div>
                  <Input value={dep.componente} onChange={(e) => setDependencia(i, "componente", e.target.value)} placeholder="Componente curricular" className={`${inputCls} h-9 text-xs`} />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_80px]">
                    <Input value={dep.escola} onChange={(e) => setDependencia(i, "escola", e.target.value)} placeholder="Escola" className={`${inputCls} h-9 text-xs`} />
                    <Input value={dep.cidade} onChange={(e) => setDependencia(i, "cidade", e.target.value)} placeholder="Cidade/UF" className={`${inputCls} h-9 text-xs`} />
                    <Input value={dep.ano} onChange={(e) => setDependencia(i, "ano", e.target.value)} placeholder="Ano" className={`${inputCls} h-9 text-xs`} />
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setDependencias((p) => [...p, dependenciaVazia()])}>
                  + Adicionar linha
                </Button>
                {dependencias.length > 1 && (
                  <Button type="button" variant="outline" size="sm" className="text-xs text-destructive" onClick={() => setDependencias((p) => p.slice(0, -1))}>
                    Remover última
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Observação (página 2)</FieldLabel>
                <Input value={form.observacaoPagina2} onChange={set("observacaoPagina2")} className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* ASSINATURAS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={PenLine} title="Assinaturas do rodapé" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Nome do secretário (a)</FieldLabel>
              <Input value={form.secretarioNome} onChange={set("secretarioNome")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Portaria do secretário</FieldLabel>
              <Input value={form.secretarioPortaria} onChange={set("secretarioPortaria")} placeholder="Portaria nº 035/13" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nome do diretor (a)</FieldLabel>
              <Input value={form.diretorNome} onChange={set("diretorNome")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Portaria do diretor</FieldLabel>
              <Input value={form.diretorPortaria} onChange={set("diretorPortaria")} placeholder="Portaria nº 3.010/2015" className={inputCls} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Registro MEC</FieldLabel>
              <Input value={form.diretorRegistro} onChange={set("diretorRegistro")} placeholder="Reg. MEC. 35.456" className={inputCls} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Envie a imagem com as assinaturas/carimbo. Ela é aplicada sobre a faixa do rodapé da primeira página.
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

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
          ) : isEditMode ? (
            <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
          ) : (
            <><School className="mr-2 h-5 w-5" /> Gerar preview</>
          )}
        </Button>
      </form>
    </div>
  );
}
