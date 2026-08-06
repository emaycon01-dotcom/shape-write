import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  School, Loader2, FlaskConical, Trash2, FileText, User, PenLine,
  ChevronDown, ChevronRight, ListChecks, CalendarClock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { normalizeSignatureImage } from "@/lib/signature-image";
import { ESTADOS_UF, ESTADO_NOMES, loadBrasaoDataUrl } from "@/lib/brasoes-estados";

type Nota = { area: string; componente: string; n1: string; n2: string; n3: string };
type Turma = { ano: string; serie: string; turno: string; unidade: string; municipio: string };

export const TURNOS = [
  "Matutino (manhã)",
  "Vespertino (tarde)",
  "Noturno (noite)",
  "Integral",
  "Intermediário",
  "EAD / Semipresencial",
];

const AREA_LING = "Linguagens, Códigos e suas Tecnologias";
const AREA_NAT = "Ciências da Natureza, Matemática e suas Tecnologias";
const AREA_HUM = "Ciências Humanas e suas Tecnologias";
const AREA_DIV = "Parte Diversificada";

const NOTAS_PADRAO: Nota[] = [
  { area: AREA_LING, componente: "Língua Portuguesa", n1: "", n2: "", n3: "" },
  { area: AREA_LING, componente: "Educação Física", n1: "", n2: "", n3: "" },
  { area: AREA_LING, componente: "Arte", n1: "", n2: "", n3: "" },
  { area: AREA_NAT, componente: "Física", n1: "", n2: "", n3: "" },
  { area: AREA_NAT, componente: "Química", n1: "", n2: "", n3: "" },
  { area: AREA_NAT, componente: "Biologia", n1: "", n2: "", n3: "" },
  { area: AREA_NAT, componente: "Matemática", n1: "", n2: "", n3: "" },
  { area: AREA_HUM, componente: "História", n1: "", n2: "", n3: "" },
  { area: AREA_HUM, componente: "Geografia", n1: "", n2: "", n3: "" },
  { area: AREA_HUM, componente: "Sociologia", n1: "", n2: "", n3: "" },
  { area: AREA_HUM, componente: "Filosofia", n1: "", n2: "", n3: "" },
  { area: AREA_DIV, componente: "Inglês", n1: "", n2: "", n3: "" },
  { area: AREA_DIV, componente: "Espanhol", n1: "", n2: "", n3: "" },
  { area: AREA_DIV, componente: "Juventude, Educação e Trabalho", n1: "", n2: "", n3: "" },
];

const NOTAS_TESTE = ["8.0/8.0/10", "10/8.5/7.5", "10/10/8.0", "7.5/9.0/9.5", "6.5/10/8.5",
  "9.3/6.5/7.0", "8.5/10/9.0", "9.0/8.0/10", "10/6.5/7.5", "10/8.5/10",
  "8.0/7.5/6.5", "6.0/9.5/8.5", "8.5/8.0/9.0", "10/10/10"];

interface FormState {
  estado: string;
  escola: string;
  endereco: string;
  atoCriacao: string;
  publicacaoCriacao: string;
  atoAprovacao: string;
  publicacaoAprovacao: string;
  nomeAluno: string;
  localNascimento: string;
  dataNascimento: string;
  pai: string;
  mae: string;
  periodoConclusao: string;
  nivelEnsino: string;
  ch1: string; ch2: string; ch3: string;
  dias1: string; dias2: string; dias3: string;
  faltas1: string; faltas2: string; faltas3: string;
  resultado1: string; resultado2: string; resultado3: string;
  secretarioNome: string; secretarioRg: string; secretarioCargo: string;
  diretorNome: string; diretorRg: string; diretorCargo: string;
}

const initial: FormState = {
  estado: "SP",
  escola: 'Escola Estadual de Ensino Fundamental e Médio "Casemiro de Abreu"',
  endereco: "Rua Cel. Jordão, nº 144, Vila Paiva, São Paulo",
  atoCriacao: 'Portaria "E" nº. 3353',
  publicacaoCriacao: "05/03/1998",
  atoAprovacao: "Resolução CEE 1063/2004",
  publicacaoAprovacao: "18/12/2018",
  nomeAluno: "",
  localNascimento: "",
  dataNascimento: "",
  pai: "",
  mae: "",
  periodoConclusao: "",
  nivelEnsino: "Ensino Fundamental e Médio",
  ch1: "405", ch2: "405", ch3: "405",
  dias1: "200", dias2: "200", dias3: "200",
  faltas1: "0", faltas2: "0", faltas3: "0",
  resultado1: "Aprov", resultado2: "Aprov", resultado3: "Aprov",
  secretarioNome: "MARLETE BARRIENTOS DE BARROS",
  secretarioRg: "12.143.804-1",
  secretarioCargo: "Gerente de Organização Escolar",
  diretorNome: "SILVA MARIA VILA RIOS",
  diretorRg: "12.740.744",
  diretorCargo: "Diretor de Escola",
};

const turmaVazia = (): Turma => ({ ano: "", serie: "", turno: TURNOS[0], unidade: "", municipio: "" });

export default function HistoricoMedioSpFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<FormState>(initial);
  const [notas, setNotas] = useState<Nota[]>(NOTAS_PADRAO);
  const [turmas, setTurmas] = useState<Turma[]>([turmaVazia(), turmaVazia(), turmaVazia()]);
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
          escola: b.escola || p.escola,
          endereco: b.endereco || p.endereco,
          atoCriacao: b.ato_criacao || p.atoCriacao,
          publicacaoCriacao: b.publicacao_criacao || p.publicacaoCriacao,
          atoAprovacao: b.ato_aprovacao || p.atoAprovacao,
          publicacaoAprovacao: b.publicacao_aprovacao || p.publicacaoAprovacao,
          nomeAluno: b.nome_aluno || "",
          localNascimento: b.local_nascimento || "",
          dataNascimento: b.data_nascimento || "",
          pai: b.pai || "",
          mae: b.mae || "",
          periodoConclusao: b.periodo_conclusao || "",
          nivelEnsino: b.nivel_ensino || p.nivelEnsino,
          ch1: b.ch1 || p.ch1, ch2: b.ch2 || p.ch2, ch3: b.ch3 || p.ch3,
          dias1: b.dias1 || p.dias1, dias2: b.dias2 || p.dias2, dias3: b.dias3 || p.dias3,
          faltas1: b.faltas1 ?? p.faltas1, faltas2: b.faltas2 ?? p.faltas2, faltas3: b.faltas3 ?? p.faltas3,
          resultado1: b.resultado1 || p.resultado1, resultado2: b.resultado2 || p.resultado2, resultado3: b.resultado3 || p.resultado3,
          secretarioNome: b.secretario_nome || p.secretarioNome,
          secretarioRg: b.secretario_rg || p.secretarioRg,
          secretarioCargo: b.secretario_cargo || p.secretarioCargo,
          diretorNome: b.diretor_nome || p.diretorNome,
          diretorRg: b.diretor_rg || p.diretorRg,
          diretorCargo: b.diretor_cargo || p.diretorCargo,
        }));
        try { const n = JSON.parse(b.notas_json || "[]"); if (Array.isArray(n) && n.length) setNotas(n); } catch { /* ignora */ }
        try { const t = JSON.parse(b.turmas_json || "[]"); if (Array.isArray(t) && t.length) setTurmas(t); } catch { /* ignora */ }
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

  const setTurma = (index: number, key: keyof Turma, value: string) =>
    setTurmas((p) => p.map((t, i) => (i === index ? { ...t, [key]: value } : t)));

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
      nomeAluno: "ANA VITÓRIA SANTOS GUEDES DA SILVA",
      localNascimento: "Santana do Ipanema-Alagoas",
      dataNascimento: "01/08/2000",
      pai: "Damião Guedes da Silva",
      mae: "Rita de Cassia Santos da Silva",
      periodoConclusao: "2016 a 2018",
      faltas1: "3",
    });
    setNotas(NOTAS_PADRAO.map((n, i) => {
      const [n1, n2, n3] = (NOTAS_TESTE[i] || "").split("/");
      return { ...n, n1: n1 || "", n2: n2 || "", n3: n3 || "" };
    }));
    setTurmas([
      { ano: "2016", serie: "1ºM04 - EM", turno: TURNOS[0], unidade: 'EEEM "CASEMIRO DE ABREU"', municipio: "São Paulo – São Paulo" },
      { ano: "2017", serie: "2ºM04 - EM", turno: TURNOS[0], unidade: 'EEEM "CASEMIRO DE ABREU"', municipio: "São Paulo – São Paulo" },
      { ano: "2018", serie: "3ºM04 - EM", turno: TURNOS[0], unidade: 'EEEM "CASEMIRO DE ABREU"', municipio: "São Paulo – São Paulo" },
    ]);
    setShowNotas(true);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setNotas(NOTAS_PADRAO);
    setTurmas([turmaVazia(), turmaVazia(), turmaVazia()]);
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
        escola: form.escola,
        endereco: form.endereco,
        ato_criacao: form.atoCriacao,
        publicacao_criacao: form.publicacaoCriacao,
        ato_aprovacao: form.atoAprovacao,
        publicacao_aprovacao: form.publicacaoAprovacao,
        nome_aluno: form.nomeAluno,
        local_nascimento: form.localNascimento,
        data_nascimento: form.dataNascimento,
        pai: form.pai,
        mae: form.mae,
        periodo_conclusao: form.periodoConclusao,
        nivel_ensino: form.nivelEnsino,
        nivel_ensino_grade: "ENSINO MÉDIO",
        ch1: form.ch1, ch2: form.ch2, ch3: form.ch3,
        dias1: form.dias1, dias2: form.dias2, dias3: form.dias3,
        faltas1: form.faltas1, faltas2: form.faltas2, faltas3: form.faltas3,
        resultado1: form.resultado1, resultado2: form.resultado2, resultado3: form.resultado3,
        secretario_nome: form.secretarioNome,
        secretario_rg: form.secretarioRg,
        secretario_cargo: form.secretarioCargo,
        diretor_nome: form.diretorNome,
        diretor_rg: form.diretorRg,
        diretor_cargo: form.diretorCargo,
        notas_json: JSON.stringify(notas),
        turmas_json: JSON.stringify(turmas.filter((t) => t.ano || t.serie || t.unidade)),
        template_brasao_base64: brasao,
        assinatura_base64: assinatura,
      };

      const { data, error } = await invokeGeneratePdf("generate-historico-medio-sp-pdf", {
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
        navigate("/dashboard/documents/historico-medio-sp/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Histórico Escolar (Ensino Médio):", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">HISTÓRICO ESCOLAR — ENSINO MÉDIO</h1>

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
            <FieldLabel required>Nome da unidade de ensino</FieldLabel>
            <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Endereço</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Ato de criação</FieldLabel>
              <Input value={form.atoCriacao} onChange={set("atoCriacao")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Publicação</FieldLabel>
              <Input value={form.publicacaoCriacao} onChange={setMask("publicacaoCriacao", maskDate)} inputMode="numeric" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ato de aprovação</FieldLabel>
              <Input value={form.atoAprovacao} onChange={set("atoAprovacao")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Publicação</FieldLabel>
              <Input value={form.publicacaoAprovacao} onChange={setMask("publicacaoAprovacao", maskDate)} inputMode="numeric" className={inputCls} />
            </div>
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do aluno (a)</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="ANA VITÓRIA SANTOS GUEDES DA SILVA" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Local de nascimento</FieldLabel>
              <Input value={form.localNascimento} onChange={set("localNascimento")} placeholder="Santana do Ipanema-Alagoas" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de nascimento</FieldLabel>
              <Input value={form.dataNascimento} onChange={setMask("dataNascimento", maskDate)} inputMode="numeric" placeholder="01/08/2000" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Pai</FieldLabel>
              <Input value={form.pai} onChange={set("pai")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Mãe</FieldLabel>
              <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Concluiu no ano de</FieldLabel>
              <Input value={form.periodoConclusao} onChange={set("periodoConclusao")} placeholder="2016 a 2018" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nível de ensino</FieldLabel>
              <Input value={form.nivelEnsino} onChange={set("nivelEnsino")} className={inputCls} />
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
                <span className="block text-lg font-bold text-foreground">Notas por série (opcional)</span>
                <span className="block text-xs text-muted-foreground">
                  Deixe em branco para o documento sair com traços (–) nas colunas de pontos.
                </span>
              </span>
            </span>
            {showNotas ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
          </button>

          {showNotas && (
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                {notas.map((nota, i) => (
                  <div key={`${nota.componente}-${i}`} className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2">
                    <Input
                      value={nota.componente}
                      onChange={(e) => setNota(i, "componente", e.target.value)}
                      className={`${inputCls} h-9 text-xs`}
                    />
                    <Input value={nota.n1} onChange={(e) => setNota(i, "n1", e.target.value)} placeholder="1ª" className={`${inputCls} h-9 text-center text-xs`} />
                    <Input value={nota.n2} onChange={(e) => setNota(i, "n2", e.target.value)} placeholder="2ª" className={`${inputCls} h-9 text-center text-xs`} />
                    <Input value={nota.n3} onChange={(e) => setNota(i, "n3", e.target.value)} placeholder="3ª" className={`${inputCls} h-9 text-center text-xs`} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2 border-t border-border/50 pt-3">
                <span className="text-xs font-semibold text-primary">Carga horária anual</span>
                <Input value={form.ch1} onChange={set("ch1")} className={`${inputCls} h-9 text-center text-xs`} />
                <Input value={form.ch2} onChange={set("ch2")} className={`${inputCls} h-9 text-center text-xs`} />
                <Input value={form.ch3} onChange={set("ch3")} className={`${inputCls} h-9 text-center text-xs`} />

                <span className="text-xs font-semibold text-primary">Dias letivos</span>
                <Input value={form.dias1} onChange={set("dias1")} className={`${inputCls} h-9 text-center text-xs`} />
                <Input value={form.dias2} onChange={set("dias2")} className={`${inputCls} h-9 text-center text-xs`} />
                <Input value={form.dias3} onChange={set("dias3")} className={`${inputCls} h-9 text-center text-xs`} />

                <span className="text-xs font-semibold text-primary">% de faltas</span>
                <Input value={form.faltas1} onChange={set("faltas1")} className={`${inputCls} h-9 text-center text-xs`} />
                <Input value={form.faltas2} onChange={set("faltas2")} className={`${inputCls} h-9 text-center text-xs`} />
                <Input value={form.faltas3} onChange={set("faltas3")} className={`${inputCls} h-9 text-center text-xs`} />

                <span className="text-xs font-semibold text-primary">Resultado final</span>
                <Input value={form.resultado1} onChange={set("resultado1")} className={`${inputCls} h-9 text-center text-xs`} />
                <Input value={form.resultado2} onChange={set("resultado2")} className={`${inputCls} h-9 text-center text-xs`} />
                <Input value={form.resultado3} onChange={set("resultado3")} className={`${inputCls} h-9 text-center text-xs`} />
              </div>
            </div>
          )}
        </div>

        {/* TURMAS / TURNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={CalendarClock} title="Anos cursados e turno" />

          {turmas.map((turma, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Linha {i + 1}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input value={turma.ano} onChange={(e) => setTurma(i, "ano", e.target.value)} placeholder="Ano (2016)" className={`${inputCls} h-9 text-xs`} />
                <Input value={turma.serie} onChange={(e) => setTurma(i, "serie", e.target.value)} placeholder="Série/Turma (1ºM04 - EM)" className={`${inputCls} h-9 text-xs`} />
                <select value={turma.turno} onChange={(e) => setTurma(i, "turno", e.target.value)} className={`${selectCls} h-9 text-xs`}>
                  {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input value={turma.unidade} onChange={(e) => setTurma(i, "unidade", e.target.value)} placeholder="Unidade de ensino" className={`${inputCls} h-9 text-xs`} />
                <Input value={turma.municipio} onChange={(e) => setTurma(i, "municipio", e.target.value)} placeholder="Município – Estado" className={`${inputCls} h-9 text-xs`} />
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setTurmas((p) => [...p, turmaVazia()])}>
              + Adicionar linha
            </Button>
            {turmas.length > 1 && (
              <Button type="button" variant="outline" size="sm" className="text-xs text-destructive" onClick={() => setTurmas((p) => p.slice(0, -1))}>
                Remover última
              </Button>
            )}
          </div>
        </div>

        {/* ASSINATURAS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={PenLine} title="Assinaturas do rodapé" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Nome (secretário)</FieldLabel>
              <Input value={form.secretarioNome} onChange={set("secretarioNome")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>RG (secretário)</FieldLabel>
              <Input value={form.secretarioRg} onChange={set("secretarioRg")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nome (diretor)</FieldLabel>
              <Input value={form.diretorNome} onChange={set("diretorNome")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>RG (diretor)</FieldLabel>
              <Input value={form.diretorRg} onChange={set("diretorRg")} className={inputCls} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Envie a imagem com as duas assinaturas/carimbo. Ela é aplicada sobre a caixa do rodapé, como no modelo oficial.
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
