import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  School, Loader2, FlaskConical, Trash2, User, BookOpen, ClipboardList, PenLine,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADO_NOMES, ESTADOS_UF, loadBrasaoDataUrl } from "@/lib/brasoes-estados";
import { normalizeSignatureImage } from "@/lib/signature-image";
import { loadTemplateBase64 } from "@/lib/template-cache";
import assinaturaSecretarioAsset from "@/assets/ficha19-assinatura-secretario.png.asset.json";
import assinaturaDiretorAsset from "@/assets/ficha19-assinatura-diretor.png.asset.json";
import { pick, rnd } from "@/lib/random";

type Modo = "auto" | "manual";

interface Disciplina {
  nome: string;
  n1: string; c1: string;
  n2: string; c2: string;
  n3: string; c3: string;
}

const DISCIPLINAS_BASE: Disciplina[] = [
  { nome: "LINGUA PORTUGUESA", n1: "8,0", c1: "240", n2: "8,0", c2: "80", n3: "8,5", c3: "240" },
  { nome: "EDUCAÇÃO FÍSICA", n1: "8,0", c1: "80", n2: "8,0", c2: "40", n3: "10,0", c3: "80" },
  { nome: "ARTE", n1: "8,5", c1: "80", n2: "7,5", c2: "80", n3: "9,0", c3: "80" },
  { nome: "ENSINO RELIGIOSO", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
  { nome: "HISTÓRIA", n1: "9,0", c1: "80", n2: "9,0", c2: "80", n3: "9,5", c3: "80" },
  { nome: "GEOGRAFIA", n1: "9,0", c1: "80", n2: "9,5", c2: "120", n3: "9,5", c3: "80" },
  { nome: "BIOLOGIA", n1: "10,0", c1: "120", n2: "9,5", c2: "160", n3: "9,5", c3: "120" },
  { nome: "MATEMÁTICA", n1: "10,0", c1: "120", n2: "9,0", c2: "120", n3: "7,5", c3: "120" },
  { nome: "FÍSICA", n1: "7,5", c1: "120", n2: "8,5", c2: "240", n3: "8,0", c3: "120" },
  { nome: "QUÍMICA", n1: "7,0", c1: "240", n2: "8,5", c2: "40", n3: "10,0", c3: "240" },
  { nome: "FILOSOFIA", n1: "8,0", c1: "40", n2: "7,5", c2: "40", n3: "10,0", c3: "40" },
  { nome: "SOCIOLOGIA", n1: "9,0", c1: "40", n2: "7,0", c2: "240", n3: "9,0", c3: "40" },
  { nome: "EDUCAÇÃO ARTÍSTICA", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
  { nome: "LINGUA ESTRANGEIRA MODERNA (INGLÊS)", n1: "8,5", c1: "80", n2: "8,0", c2: "80", n3: "9,0", c3: "80" },
  { nome: "LINGUA ESTRANGEIRA MODERNA (ESPANHOL)", n1: "", c1: "", n2: "", c2: "", n3: "", c3: "" },
];

interface FormState {
  uf: string;
  govEstado: string;
  secretaria: string;
  escola: string;
  etapas: string;
  endereco: string;
  cidade: string;
  atoFuncionamento: string;
  diarioOficial: string;
  cadastroEscolar: string;

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

  alinea: string;
  eja: "SIM" | "NAO";
  progressaoParcial: "SIM" | "NAO";
  qtdDisciplinas: string;
  dispensaReligioso: "SIM" | "NAO";
  baseLegalReligioso: string;
  dispensaEdFisica: "SIM" | "NAO";
  baseLegalEdFisica: string;
  observacoes: string;

  ano1: string;
  ano2: string;
  ano3: string;
  estabelecimento: string;
  cidadeEstab: string;
  ufEstab: string;
  freq1: string;
  freq2: string;
  freq3: string;
  resultado1: string;
  resultado2: string;
  resultado3: string;
  localData: string;
}

const initial: FormState = {
  uf: "PE",
  govEstado: "GOVERNO DO ESTADO DE PERNAMBUCO",
  secretaria: "SECRETARIA DE EDUCAÇÃO E CULTURA",
  escola: "ESCOLA THEMISTOCLES DE ANDRADE",
  etapas: "Ensino Fundamental e Médio",
  endereco: "Barreira Do Rosario, SN - Rosario,",
  cidade: "Olinda",
  atoFuncionamento: "PORT.5704",
  diarioOficial: "15/09/1979",
  cadastroEscolar: "E.108.060",

  nomeAluno: "",
  mae: "",
  pai: "",
  sexo: "M",
  dataNasc: "",
  municipioNasc: "OLINDA",
  ufNasc: "PE",
  nacionalidade: "Brasileira",
  rg: "",
  orgaoExpedidor: "SDS",
  serieConclusao: "3ª",

  alinea: "",
  eja: "NAO",
  progressaoParcial: "SIM",
  qtdDisciplinas: "2",
  dispensaReligioso: "NAO",
  baseLegalReligioso: "",
  dispensaEdFisica: "SIM",
  baseLegalEdFisica: "",
  observacoes: "",

  ano1: "",
  ano2: "",
  ano3: "",
  estabelecimento: "ESCOLA THEMISTOCLES DE ANDRADE",
  cidadeEstab: "OLINDA",
  ufEstab: "PE",
  freq1: "99,43%",
  freq2: "99,52%",
  freq3: "99,6%",
  resultado1: "P.P.PLENA",
  resultado2: "P.P.PLENA",
  resultado3: "P.P.PLENA",
  localData: "",
};

const NOMES = ["WALDONMES DE QUEIROZ", "MATEUS LUCAS DA SILVA", "JOANA PEREIRA DOS SANTOS"];
const MAES = ["VÂNIA MARIA DE QUEIROZ", "ROSINETE MAURICIO DA SILVA", "MARIA JOSE PEREIRA"];

export default function Ficha19FormPage() {
  const location = useLocation();
  const navState = location.state as { editDocId?: string; modo?: Modo } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [modo, setModo] = useState<Modo>(navState?.modo === "manual" ? "manual" : "auto");
  const [form, setForm] = useState<FormState>(initial);
  const [discs, setDiscs] = useState<Disciplina[]>(DISCIPLINAS_BASE);
  const [notasAbertas, setNotasAbertas] = useState(false);
  const [assinaturaSecretario, setAssinaturaSecretario] = useState<string>("");
  const [assinaturaDiretor, setAssinaturaDiretor] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(navState?.editDocId);

  useEffect(() => {
    if (hydrated || !navState?.editDocId) return;
    let cancelled = false;
    (async () => {
      const docId = navState.editDocId!;
      const raw = getDocument(docId)?.additionalInfo || (await loadDocumentInfo(docId));
      if (cancelled || !raw) return;
      try {
        const b = JSON.parse(raw) as Record<string, unknown>;
        const s = (k: string, fb = "") => (typeof b[k] === "string" ? (b[k] as string) : fb);
        setModo(s("modo") === "manual" ? "manual" : "auto");
        setForm((p) => ({
          ...p,
          uf: s("uf", p.uf),
          govEstado: s("gov_estado", p.govEstado),
          secretaria: s("secretaria", p.secretaria),
          escola: s("escola", p.escola),
          etapas: s("etapas", p.etapas),
          endereco: s("endereco", p.endereco),
          cidade: s("cidade", p.cidade),
          atoFuncionamento: s("ato_funcionamento", p.atoFuncionamento),
          diarioOficial: s("diario_oficial", p.diarioOficial),
          cadastroEscolar: s("cadastro_escolar", p.cadastroEscolar),
          nomeAluno: s("nome_aluno"),
          mae: s("mae"),
          pai: s("pai"),
          sexo: s("sexo") === "F" ? "F" : "M",
          dataNasc: s("data_nasc"),
          municipioNasc: s("municipio_nasc", p.municipioNasc),
          ufNasc: s("uf_nasc", p.ufNasc),
          nacionalidade: s("nacionalidade", p.nacionalidade),
          rg: s("rg"),
          orgaoExpedidor: s("orgao_expedidor", p.orgaoExpedidor),
          serieConclusao: s("serie_conclusao", p.serieConclusao),
          alinea: s("alinea"),
          eja: s("eja") === "SIM" ? "SIM" : "NAO",
          progressaoParcial: s("progressao_parcial") === "SIM" ? "SIM" : "NAO",
          qtdDisciplinas: s("qtd_disciplinas", p.qtdDisciplinas),
          dispensaReligioso: s("dispensa_religioso") === "SIM" ? "SIM" : "NAO",
          baseLegalReligioso: s("base_legal_religioso"),
          dispensaEdFisica: s("dispensa_ed_fisica") === "SIM" ? "SIM" : "NAO",
          baseLegalEdFisica: s("base_legal_ed_fisica"),
          observacoes: s("observacoes"),
          ano1: s("ano1"),
          ano2: s("ano2"),
          ano3: s("ano3"),
          estabelecimento: s("estab1", p.estabelecimento),
          cidadeEstab: s("cidade1", p.cidadeEstab),
          ufEstab: s("uf1", p.ufEstab),
          freq1: s("freq1", p.freq1),
          freq2: s("freq2", p.freq2),
          freq3: s("freq3", p.freq3),
          resultado1: s("resultado1", p.resultado1),
          resultado2: s("resultado2", p.resultado2),
          resultado3: s("resultado3", p.resultado3),
          localData: s("local_data"),
        }));
        if (Array.isArray(b.disciplinas)) setDiscs(b.disciplinas as Disciplina[]);
        setAssinaturaSecretario(s("assinatura_secretario"));
        setAssinaturaDiretor(s("assinatura_diretor"));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, navState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setUf = (uf: string) =>
    setForm((p) => ({ ...p, uf, govEstado: `GOVERNO DO ESTADO DE ${ESTADO_NOMES[uf] || uf}` }));

  const setAno1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm((p) => {
      const n = Number(v);
      if (v.length === 4 && n > 1900) return { ...p, ano1: v, ano2: String(n + 1), ano3: String(n + 2) };
      return { ...p, ano1: v };
    });
  };

  const editDisc = (idx: number, campo: keyof Disciplina, valor: string) =>
    setDiscs((prev) => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));

  const uploadAssinatura = (alvo: "sec" | "dir") =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read_error"));
          reader.readAsDataURL(file);
        });
        const normalized = await normalizeSignatureImage(dataUrl);
        if (alvo === "sec") setAssinaturaSecretario(normalized);
        else setAssinaturaDiretor(normalized);
        toast({ title: "Assinatura carregada!" });
      } catch {
        toast({ title: "Não foi possível ler a imagem", variant: "destructive" });
      }
    };

  const fillTest = () => {
    const base = 2022;
    setForm({
      ...initial,
      nomeAluno: pick(NOMES),
      mae: pick(MAES),
      pai: "N/A",
      dataNasc: "09 DE DEZEMBRO DE 2004",
      rg: rnd(8),
      ano1: String(base),
      ano2: String(base + 1),
      ano3: String(base + 2),
      localData: "Olinda, 12 de JANEIRO DE 2024",
    });
    setDiscs(DISCIPLINAS_BASE);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setDiscs(DISCIPLINAS_BASE);
    setAssinaturaSecretario("");
    setAssinaturaDiretor("");
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (modo === "manual" && (!assinaturaSecretario || !assinaturaDiretor)) {
      toast({
        title: "Envie as duas assinaturas",
        description: "No modo manual é necessário enviar a assinatura do Secretário e a do Diretor.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const brasaoBase64 = await loadBrasaoDataUrl(form.uf);

      const [secAuto, dirAuto] = modo === "auto"
        ? await Promise.all([
            loadTemplateBase64(assinaturaSecretarioAsset.url),
            loadTemplateBase64(assinaturaDiretorAsset.url),
          ])
        : ["", ""];

      const bodyData = {
        modo,
        uf: form.uf,
        brasao_base64: brasaoBase64,
        gov_estado: form.govEstado,
        secretaria: form.secretaria,
        escola: form.escola,
        etapas: form.etapas,
        endereco: form.endereco,
        cidade: form.cidade,
        ato_funcionamento: form.atoFuncionamento,
        diario_oficial: form.diarioOficial,
        cadastro_escolar: form.cadastroEscolar,

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

        alinea: form.alinea,
        eja: form.eja,
        progressao_parcial: form.progressaoParcial,
        qtd_disciplinas: form.qtdDisciplinas,
        dispensa_religioso: form.dispensaReligioso,
        base_legal_religioso: form.baseLegalReligioso,
        dispensa_ed_fisica: form.dispensaEdFisica,
        base_legal_ed_fisica: form.baseLegalEdFisica,
        observacoes: form.observacoes,

        ano1: form.ano1,
        ano2: form.ano2,
        ano3: form.ano3,
        estab1: form.estabelecimento,
        estab2: form.estabelecimento,
        estab3: form.estabelecimento,
        cidade1: form.cidadeEstab,
        cidade2: form.cidadeEstab,
        cidade3: form.cidadeEstab,
        uf1: form.ufEstab,
        uf2: form.ufEstab,
        uf3: form.ufEstab,
        freq1: form.freq1,
        freq2: form.freq2,
        freq3: form.freq3,
        resultado1: form.resultado1,
        resultado2: form.resultado2,
        resultado3: form.resultado3,
        local_data: form.localData,

        disciplinas: discs,
        progressoes: [],

        assinatura_secretario: modo === "auto" ? secAuto : assinaturaSecretario,
        assinatura_diretor: modo === "auto" ? dirAuto : assinaturaDiretor,
      };

      const { data, error } = await invokeGeneratePdf("generate-ficha19-pdf", {
        body: { ...bodyData, preview: !isEditMode },
      });
      if (error) throw error;

      const pdfResult = data?.pdfBase64;
      if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");

      if (isEditMode && navState?.editDocId) {
        await updateDocument(navState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`,
        });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } else {
        const previewId = storePreviewPayload({ pdfBase64: pdfResult, formData: bodyData });
        navigate("/dashboard/documents/ficha19/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Ficha 19:", err);
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

  const SimNao = ({ value, onChange }: { value: "SIM" | "NAO"; onChange: (v: "SIM" | "NAO") => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value as "SIM" | "NAO")} className={selectCls}>
      <option value="SIM">SIM</option>
      <option value="NAO">NÃO</option>
    </select>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/dashboard/documents/ficha19")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
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

      <h1 className="font-display mb-1 text-2xl font-bold text-foreground">
        CERTIFICADO + HISTÓRICO (FICHA 19)
      </h1>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-primary">
        Assinatura {modo === "auto" ? "automática" : "manual"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ESCOLA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={School} title="Escola (cabeçalho)" />

          <div className="space-y-1.5">
            <FieldLabel required>Estado (brasão do documento)</FieldLabel>
            <select value={form.uf} onChange={(e) => setUf(e.target.value)} className={selectCls}>
              {ESTADOS_UF.map((uf) => (
                <option key={uf} value={uf}>{uf} — {ESTADO_NOMES[uf]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Governo do estado</FieldLabel>
            <Input value={form.govEstado} onChange={set("govEstado")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Secretaria</FieldLabel>
            <Input value={form.secretaria} onChange={set("secretaria")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Nome da escola</FieldLabel>
              <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Etapas de ensino</FieldLabel>
              <Input value={form.etapas} onChange={set("etapas")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Endereço</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel>Cidade</FieldLabel>
              <Input value={form.cidade} onChange={set("cidade")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ato de funcionamento</FieldLabel>
              <Input value={form.atoFuncionamento} onChange={set("atoFuncionamento")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Diário oficial de</FieldLabel>
              <Input value={form.diarioOficial} onChange={set("diarioOficial")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Cadastro escolar nº</FieldLabel>
            <Input value={form.cadastroEscolar} onChange={set("cadastroEscolar")} className={inputCls} />
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Nome da mãe</FieldLabel>
              <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nome do pai</FieldLabel>
              <Input value={form.pai} onChange={set("pai")} placeholder="N/A" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel>Sexo</FieldLabel>
              <select
                value={form.sexo}
                onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value as "M" | "F" }))}
                className={selectCls}
              >
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nascimento</FieldLabel>
              <Input value={form.dataNasc} onChange={set("dataNasc")} placeholder="09 DE DEZEMBRO DE 2004" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nacionalidade</FieldLabel>
              <Input value={form.nacionalidade} onChange={set("nacionalidade")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Cidade de nascimento</FieldLabel>
              <Input value={form.municipioNasc} onChange={set("municipioNasc")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>UF</FieldLabel>
              <select
                value={form.ufNasc}
                onChange={(e) => setForm((p) => ({ ...p, ufNasc: e.target.value }))}
                className={selectCls}
              >
                {ESTADOS_UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Série concluída</FieldLabel>
              <Input value={form.serieConclusao} onChange={set("serieConclusao")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>RG</FieldLabel>
              <Input value={form.rg} onChange={set("rg")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Órgão expedidor</FieldLabel>
              <Input value={form.orgaoExpedidor} onChange={set("orgaoExpedidor")} className={inputCls} />
            </div>
          </div>
        </div>

        {/* INFORMAÇÕES COMPLEMENTARES */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={ClipboardList} title="Informações complementares" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Alínea (classificação)</FieldLabel>
              <Input value={form.alinea} onChange={set("alinea")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>EJA (Jovens e Adultos)</FieldLabel>
              <SimNao value={form.eja} onChange={(v) => setForm((p) => ({ ...p, eja: v }))} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Progressão parcial</FieldLabel>
              <SimNao value={form.progressaoParcial} onChange={(v) => setForm((p) => ({ ...p, progressaoParcial: v }))} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nº de disciplinas</FieldLabel>
              <Input value={form.qtdDisciplinas} onChange={set("qtdDisciplinas")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Dispensa de ensino religioso</FieldLabel>
              <SimNao value={form.dispensaReligioso} onChange={(v) => setForm((p) => ({ ...p, dispensaReligioso: v }))} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Dispensa de educação física</FieldLabel>
              <SimNao value={form.dispensaEdFisica} onChange={(v) => setForm((p) => ({ ...p, dispensaEdFisica: v }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Base legal (ensino religioso)</FieldLabel>
            <Input value={form.baseLegalReligioso} onChange={set("baseLegalReligioso")} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Base legal (educação física)</FieldLabel>
            <Input value={form.baseLegalEdFisica} onChange={set("baseLegalEdFisica")} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Observações</FieldLabel>
            <Input value={form.observacoes} onChange={set("observacoes")} className={inputCls} />
          </div>
        </div>

        {/* HISTÓRICO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={BookOpen} title="Histórico escolar" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>Ano 1ª série</FieldLabel>
              <Input value={form.ano1} onChange={setAno1} inputMode="numeric" placeholder="2022" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ano 2ª série</FieldLabel>
              <Input value={form.ano2} onChange={set("ano2")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ano 3ª série</FieldLabel>
              <Input value={form.ano3} onChange={set("ano3")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Estabelecimento (coluna lateral)</FieldLabel>
              <Input value={form.estabelecimento} onChange={set("estabelecimento")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Cidade / UF</FieldLabel>
              <div className="flex gap-2">
                <Input value={form.cidadeEstab} onChange={set("cidadeEstab")} className={inputCls} />
                <Input value={form.ufEstab} onChange={set("ufEstab")} className={`w-16 ${inputCls}`} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input value={form.freq1} onChange={set("freq1")} placeholder="Freq. 1ª" className={cellCls} />
            <Input value={form.freq2} onChange={set("freq2")} placeholder="Freq. 2ª" className={cellCls} />
            <Input value={form.freq3} onChange={set("freq3")} placeholder="Freq. 3ª" className={cellCls} />
            <Input value={form.resultado1} onChange={set("resultado1")} placeholder="Result. 1ª" className={cellCls} />
            <Input value={form.resultado2} onChange={set("resultado2")} placeholder="Result. 2ª" className={cellCls} />
            <Input value={form.resultado3} onChange={set("resultado3")} placeholder="Result. 3ª" className={cellCls} />
          </div>

          <div className="space-y-2">
            <FieldLabel>Notas e carga horária por série</FieldLabel>
            {discs.map((l, i) => (
              <div key={l.nome || i} className="rounded-lg border border-border/60 bg-secondary/40 p-2">
                <Input
                  value={l.nome}
                  onChange={(e) => editDisc(i, "nome", e.target.value)}
                  className={`mb-1.5 h-8 text-xs font-bold ${inputCls}`}
                />
                <div className="grid grid-cols-6 gap-1.5">
                  <Input value={l.n1} onChange={(e) => editDisc(i, "n1", e.target.value)} placeholder="Nota 1ª" className={cellCls} />
                  <Input value={l.c1} onChange={(e) => editDisc(i, "c1", e.target.value)} placeholder="CH 1ª" className={cellCls} />
                  <Input value={l.n2} onChange={(e) => editDisc(i, "n2", e.target.value)} placeholder="Nota 2ª" className={cellCls} />
                  <Input value={l.c2} onChange={(e) => editDisc(i, "c2", e.target.value)} placeholder="CH 2ª" className={cellCls} />
                  <Input value={l.n3} onChange={(e) => editDisc(i, "n3", e.target.value)} placeholder="Nota 3ª" className={cellCls} />
                  <Input value={l.c3} onChange={(e) => editDisc(i, "c3", e.target.value)} placeholder="CH 3ª" className={cellCls} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Local e data</FieldLabel>
            <Input value={form.localData} onChange={set("localData")} placeholder="Olinda, 12 de JANEIRO DE 2024" className={inputCls} required />
          </div>
        </div>

        {/* ASSINATURAS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={PenLine} title="Assinaturas" />

          {modo === "auto" ? (
            <p className="text-xs text-muted-foreground">
              Modo automático: as assinaturas oficiais do Secretário e do Diretor já vêm aplicadas no documento.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {([
                ["Assinatura do Secretário", assinaturaSecretario, uploadAssinatura("sec")],
                ["Assinatura do Diretor", assinaturaDiretor, uploadAssinatura("dir")],
              ] as const).map(([label, valor, onChange]) => (
                <div key={label} className="space-y-1.5">
                  <FieldLabel required>{label}</FieldLabel>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onChange}
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary"
                  />
                  {valor && (
                    <div className="rounded-md border border-border/60 bg-white p-2">
                      <img src={valor} alt={label} className="mx-auto h-16 object-contain" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setModo((m) => (m === "auto" ? "manual" : "auto"))}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Trocar para assinatura {modo === "auto" ? "manual" : "automática"}
          </button>
        </div>

        <Button type="submit" disabled={loading} className="h-12 w-full text-base font-semibold">
          {loading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>) : "Gerar documento"}
        </Button>
      </form>
    </div>
  );
}
