import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, School, Loader2, FlaskConical, Trash2, History, FileText, User, CalendarRange } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadHistoricoFieldPositions } from "@/lib/historico-align";
import templateHistoricoUrl from "@/assets/template-historico-bg-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskPhone } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";

interface HistoricoFormData {
  govEstado: string;
  secretaria: string;
  diretoria: string;
  escola: string;
  atoLegal: string;
  endereco: string;
  numero: string;
  bairro: string;
  municipioEscola: string;
  cep: string;
  telefone: string;

  nomeAluno: string;
  rgRne: string;
  ra: string;
  municipioNasc: string;
  estadoNasc: string;
  pais: string;
  dataNasc: string;
  mae: string;

  ano1: string;
  ano2: string;
  ano3: string;

  efAno: string;
  efEstab: string;
  efMun: string;
  efUf: string;

  e1Estab: string;
  e1Mun: string;
  e1Uf: string;
  e2Estab: string;
  e2Mun: string;
  e2Uf: string;
  e3Estab: string;
  e3Mun: string;
  e3Uf: string;

  serieConclusao: string;
}

const initial: HistoricoFormData = {
  govEstado: "GOVERNO DO ESTADO DE ALAGOAS",
  secretaria: "SECRETARIA DE ESTADO DA EDUCAÇÃO",
  diretoria: "DIRETORIA DE ENSINO – REGIÃO DE AL",
  escola: "Escola Estadual Professora Maria Avelina Do Carmo",
  atoLegal: "124.761.98 – ADR",
  endereco: "R. Isac Pereira Neto",
  numero: "395-441",
  bairro: "Centro",
  municipioEscola: "Traipu",
  cep: "57370-000",
  telefone: "(82) 3536-1361",

  nomeAluno: "",
  rgRne: "",
  ra: "",
  municipioNasc: "",
  estadoNasc: "AL",
  pais: "Brasil",
  dataNasc: "",
  mae: "",

  ano1: "",
  ano2: "",
  ano3: "",

  efAno: "",
  efEstab: "",
  efMun: "",
  efUf: "AL",

  e1Estab: "",
  e1Mun: "",
  e1Uf: "AL",
  e2Estab: "",
  e2Mun: "",
  e2Uf: "AL",
  e3Estab: "",
  e3Mun: "",
  e3Uf: "AL",

  serieConclusao: "3ª",
};

const NOMES = [
  "Claudeane Damásio Silva",
  "Jonatas Ferreira de Lima",
  "Maria Eduarda Rocha Santos",
  "Vinícius Barbosa Nogueira",
];
const MAES = ["Ana Paula santeiro da Silva", "Rita de Cássia Ferreira", "Josefa Rocha Santos"];

function rnd(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function HistoricoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "historico-escolar").slice(0, 6);

  const [form, setForm] = useState<HistoricoFormData>(initial);
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
          govEstado: b.gov_estado || p.govEstado,
          secretaria: b.secretaria || p.secretaria,
          diretoria: b.diretoria || p.diretoria,
          escola: b.escola || p.escola,
          atoLegal: b.ato_legal || p.atoLegal,
          endereco: b.endereco || p.endereco,
          numero: b.numero || p.numero,
          bairro: b.bairro || p.bairro,
          municipioEscola: b.municipio_escola || p.municipioEscola,
          cep: b.cep || p.cep,
          telefone: b.telefone || p.telefone,
          nomeAluno: b.nome_aluno || "",
          rgRne: b.rg_rne || "",
          ra: b.ra || "",
          municipioNasc: b.municipio_nasc || "",
          estadoNasc: b.estado_nasc || p.estadoNasc,
          pais: b.pais || p.pais,
          dataNasc: b.data_nasc || "",
          mae: b.mae || "",
          ano1: b.ano1 || "",
          ano2: b.ano2 || "",
          ano3: b.ano3 || "",
          efAno: b.ef_ano || "",
          efEstab: b.ef_estab || "",
          efMun: b.ef_mun || "",
          efUf: b.ef_uf || p.efUf,
          e1Estab: b.e1_estab || "",
          e1Mun: b.e1_mun || "",
          e1Uf: b.e1_uf || p.e1Uf,
          e2Estab: b.e2_estab || "",
          e2Mun: b.e2_mun || "",
          e2Uf: b.e2_uf || p.e2Uf,
          e3Estab: b.e3_estab || "",
          e3Mun: b.e3_mun || "",
          e3Uf: b.e3_uf || p.e3Uf,
          serieConclusao: b.serie_conclusao || p.serieConclusao,
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof HistoricoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof HistoricoFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  /** Os três anos do Ensino Médio são sequenciais a partir do 1º ano. */
  const setAno1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm((p) => {
      const n = Number(v);
      if (v.length === 4 && n > 1900) {
        return { ...p, ano1: v, ano2: String(n + 1), ano3: String(n + 2), efAno: String(n - 1) };
      }
      return { ...p, ano1: v };
    });
  };

  const fillTest = () => {
    const base = 2013;
    setForm({
      ...initial,
      nomeAluno: pick(NOMES),
      rgRne: `${rnd(2)}.${rnd(3)}.${rnd(3)}-${rnd(1)}`,
      ra: `${rnd(9)}-${rnd(1)}`,
      municipioNasc: "Batalha",
      dataNasc: "03/04/1995",
      mae: pick(MAES),
      ano1: String(base),
      ano2: String(base + 1),
      ano3: String(base + 2),
      efAno: String(base - 2),
      efEstab: "Escola municipal de educação básica Francisco Mangabeiras",
      efMun: "Traipu",
      e1Estab: "Escola estadual Professora Maria Avelina do Carmo.",
      e1Mun: "Traipu",
      e2Estab: "Escola estadual Professora Maria Avelina do Carmo.",
      e2Mun: "Traipu",
      e3Estab: "Escola estadual Professora Maria Avelina do Carmo.",
      e3Mun: "Traipu",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const templateBase64 = await loadTemplateBase64(templateHistoricoUrl);

      const bodyData = {
        gov_estado: form.govEstado,
        secretaria: form.secretaria,
        diretoria: form.diretoria,
        escola: form.escola,
        ato_legal: form.atoLegal,
        endereco: form.endereco,
        numero: form.numero,
        bairro: form.bairro,
        municipio_escola: form.municipioEscola,
        cep: form.cep,
        telefone: form.telefone,

        nome_aluno: form.nomeAluno,
        rg_rne: form.rgRne,
        ra: form.ra,
        municipio_nasc: form.municipioNasc,
        estado_nasc: form.estadoNasc,
        pais: form.pais,
        data_nasc: form.dataNasc,
        mae: form.mae,

        ano1: form.ano1,
        ano2: form.ano2,
        ano3: form.ano3,

        ef_ano: form.efAno,
        ef_estab: form.efEstab,
        ef_mun: form.efMun,
        ef_uf: form.efUf,

        e1_ano: form.ano1,
        e1_estab: form.e1Estab,
        e1_mun: form.e1Mun,
        e1_uf: form.e1Uf,

        e2_ano: form.ano2,
        e2_estab: form.e2Estab,
        e2_mun: form.e2Mun,
        e2_uf: form.e2Uf,

        e3_ano: form.ano3,
        e3_estab: form.e3Estab,
        e3_mun: form.e3Mun,
        e3_uf: form.e3Uf,

        serie_conclusao: form.serieConclusao,
        ano_conclusao: form.ano3,

        template_base64: templateBase64,
        field_positions: loadHistoricoFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-historico-pdf", {
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
        navigate("/dashboard/documents/historico-escolar/preview", {
          state: { pdfBase64: pdfResult, formData: bodyData },
        });
      }
    } catch (err) {
      console.error("Erro ao gerar Histórico Escolar:", err);
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

  const LinhaEstudo = ({
    titulo,
    ano,
    estab,
    mun,
    uf,
    onEstab,
    onMun,
    onUf,
  }: {
    titulo: string;
    ano: string;
    estab: string;
    mun: string;
    uf: string;
    onEstab: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMun: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUf: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <div className="space-y-2 rounded-lg border border-border/60 bg-secondary/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground">{titulo}</p>
        <span className="text-[11px] text-muted-foreground">Ano: {ano || "—"}</span>
      </div>
      <Input value={estab} onChange={onEstab} placeholder="Estabelecimento de ensino" className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <Input value={mun} onChange={onMun} placeholder="Município" className={`col-span-2 ${inputCls}`} />
        <Input value={uf} onChange={onUf} placeholder="UF" maxLength={2} className={inputCls} />
      </div>
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Histórico Escolar — Ensino Médio</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ESCOLA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={School} title="Escola (cabeçalho)" />

          <div className="space-y-1.5">
            <FieldLabel required>Governo do estado</FieldLabel>
            <Input value={form.govEstado} onChange={set("govEstado")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Secretaria</FieldLabel>
              <Input value={form.secretaria} onChange={set("secretaria")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Diretoria de ensino</FieldLabel>
              <Input value={form.diretoria} onChange={set("diretoria")} className={inputCls} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Nome da escola</FieldLabel>
            <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Ato legal de criação</FieldLabel>
            <Input value={form.atoLegal} onChange={set("atoLegal")} placeholder="124.761.98 – ADR" className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel>Endereço</FieldLabel>
              <Input value={form.endereco} onChange={set("endereco")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nº</FieldLabel>
              <Input value={form.numero} onChange={set("numero")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Bairro</FieldLabel>
              <Input value={form.bairro} onChange={set("bairro")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Município</FieldLabel>
              <Input value={form.municipioEscola} onChange={set("municipioEscola")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>CEP</FieldLabel>
              <Input value={form.cep} onChange={set("cep")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Telefone</FieldLabel>
            <Input value={form.telefone} onChange={setMask("telefone", maskPhone)} inputMode="numeric" className={inputCls} />
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do aluno</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="Ex: Claudeane Damásio Silva" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>RG / RNE</FieldLabel>
              <Input value={form.rgRne} onChange={set("rgRne")} placeholder="56.191.320-1" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>RA</FieldLabel>
              <Input value={form.ra} onChange={set("ra")} placeholder="284193875-1" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Município de nascimento</FieldLabel>
              <Input value={form.municipioNasc} onChange={set("municipioNasc")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Estado</FieldLabel>
              <Input value={form.estadoNasc} onChange={set("estadoNasc")} maxLength={2} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>País</FieldLabel>
              <Input value={form.pais} onChange={set("pais")} className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Data de nascimento</FieldLabel>
              <Input value={form.dataNasc} onChange={setMask("dataNasc", maskDate)} inputMode="numeric" placeholder="03/04/1995" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Mãe</FieldLabel>
              <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
            </div>
          </div>
        </div>

        {/* ANOS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={CalendarRange} title="Anos letivos" />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>1ª Série</FieldLabel>
              <Input value={form.ano1} onChange={setAno1} inputMode="numeric" placeholder="2013" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>2ª Série</FieldLabel>
              <Input value={form.ano2} onChange={set("ano2")} inputMode="numeric" placeholder="2014" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>3ª Série</FieldLabel>
              <Input value={form.ano3} onChange={set("ano3")} inputMode="numeric" placeholder="2015" className={inputCls} required />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ao digitar o ano da 1ª série, os demais anos são preenchidos automaticamente. As notas e cargas horárias já
            fazem parte do modelo do documento.
          </p>

          <div className="space-y-1.5">
            <FieldLabel required>Série de conclusão</FieldLabel>
            <Input value={form.serieConclusao} onChange={set("serieConclusao")} placeholder="3ª" className={inputCls} required />
          </div>
        </div>

        {/* ESTUDOS REALIZADOS */}
        <div className="glass space-y-3 rounded-xl p-6">
          <SectionHeader icon={GraduationCap} title="Estudos realizados" />

          <div className="space-y-2 rounded-lg border border-border/60 bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">Ensino Fundamental — 8ª Série / 9º Ano</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={form.efAno} onChange={set("efAno")} inputMode="numeric" placeholder="Ano" className={inputCls} />
              <Input value={form.efMun} onChange={set("efMun")} placeholder="Município" className={inputCls} />
              <Input value={form.efUf} onChange={set("efUf")} placeholder="UF" maxLength={2} className={inputCls} />
            </div>
            <Input value={form.efEstab} onChange={set("efEstab")} placeholder="Estabelecimento de ensino" className={inputCls} />
          </div>

          <LinhaEstudo
            titulo="Ensino Médio — 1ª Série"
            ano={form.ano1}
            estab={form.e1Estab}
            mun={form.e1Mun}
            uf={form.e1Uf}
            onEstab={set("e1Estab")}
            onMun={set("e1Mun")}
            onUf={set("e1Uf")}
          />
          <LinhaEstudo
            titulo="Ensino Médio — 2ª Série"
            ano={form.ano2}
            estab={form.e2Estab}
            mun={form.e2Mun}
            uf={form.e2Uf}
            onEstab={set("e2Estab")}
            onMun={set("e2Mun")}
            onUf={set("e2Uf")}
          />
          <LinhaEstudo
            titulo="Ensino Médio — 3ª Série"
            ano={form.ano3}
            estab={form.e3Estab}
            mun={form.e3Mun}
            uf={form.e3Uf}
            onEstab={set("e3Estab")}
            onMun={set("e3Mun")}
            onUf={set("e3Uf")}
          />
        </div>

        {/* HISTÓRICO */}
        <div className="glass space-y-3 rounded-xl p-6">
          <SectionHeader icon={History} title="Histórico de Previews" />
          {previewHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum histórico escolar gerado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {previewHistory.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{d.name || "Sem nome"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {d.identification} · {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 text-xs"
                    onClick={() => navigate("/dashboard/history", { state: { focusDocId: d.id } })}
                  >
                    <FileText className="h-3.5 w-3.5" /> Abrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando preview...</>
          ) : (
            isEditMode ? "Salvar alterações" : "Gerar Preview"
          )}
        </Button>
      </form>
    </div>
  );
}
