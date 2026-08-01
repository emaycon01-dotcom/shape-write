import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Building2, Loader2, FlaskConical, Trash2, History, FileText, Stethoscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadUnimedFieldPositions } from "@/lib/unimed-align";
import templateUnimedUrl from "@/assets/template-unimed-bg-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskDigits, maskPhone, maskTime } from "@/lib/masks";

/* ------------------------------------------------------------ unidades */

const UNIDADES = [
  {
    nome: "TELESSAUDE - UNIMEDRJ",
    endereco: "AV ATLÂNTICA, 2440 - APT 1008, RIO DE JANEIRO - RJ, 22041-901",
    convenio: "UNIMED RJ",
    telefone: "(21) 2235-6931",
    crmUf: "CRM-RJ",
    uf: "RJ",
  },
  {
    nome: "TELESSAUDE - UNIMEDSP",
    endereco: "AV PAULISTA, 1450 - BELA VISTA, SÃO PAULO - SP, 01310-100",
    convenio: "UNIMED SP",
    telefone: "(11) 3265-9000",
    crmUf: "CRM-SP",
    uf: "SP",
  },
  {
    nome: "TELESSAUDE - UNIMEDBH",
    endereco: "AV FRANCISCO SALES, 1111 - SANTA EFIGÊNIA, BELO HORIZONTE - MG, 30150-221",
    convenio: "UNIMED BH",
    telefone: "(31) 3290-6000",
    crmUf: "CRM-MG",
    uf: "MG",
  },
];

/** Profissional automático por unidade (usado fora do modo manual). */
const MEDICOS_AUTO = [
  { medico: "MARIA CAROLINA CARIANO DA SILVA", crmNumero: "0121699", crmUf: "CRM-RJ", especialidade: "CLÍNICA MÉDICA" },
  { medico: "RICARDO ALMEIDA FONSECA", crmNumero: "0154872", crmUf: "CRM-SP", especialidade: "CLÍNICA MÉDICA" },
  { medico: "JULIANA PEREIRA RESENDE", crmNumero: "0098431", crmUf: "CRM-MG", especialidade: "CLÍNICA MÉDICA" },
];

const QUADROS = [
  "choque alérgico (anafilaxia)",
  "quadro gripal (síndrome gripal)",
  "lombalgia aguda",
  "gastroenterite aguda",
  "crise de enxaqueca",
  "infecção de vias aéreas superiores",
];

interface UnimedFormData {
  paciente: string;
  docTipo: "cpf" | "cns";
  docNumero: string;
  nascimento: string;
  mae: string;
  setor: string;
  leito: string;
  prontuario: string;
  numeroAtendimento: string;
  unidadeIdx: number;
  unidade: string;
  endereco: string;
  convenio: string;
  telefone: string;
  dataAtendimento: string;
  horaAtendimento: string;
  dias: string;
  cid: string;
  quadro: string;
  medico: string;
  crmNumero: string;
  crmUf: string;
  especialidade: string;
}

const initial: UnimedFormData = {
  paciente: "",
  docTipo: "cpf",
  docNumero: "",
  nascimento: "",
  mae: "",
  setor: "",
  leito: "",
  prontuario: "",
  numeroAtendimento: "",
  unidadeIdx: 0,
  unidade: UNIDADES[0].nome,
  endereco: UNIDADES[0].endereco,
  convenio: UNIDADES[0].convenio,
  telefone: UNIDADES[0].telefone,
  dataAtendimento: "",
  horaAtendimento: "",
  dias: "1",
  cid: "",
  quadro: QUADROS[0],
  medico: "MARIA CAROLINA CARIANO DA SILVA",
  crmNumero: "0121699",
  crmUf: "CRM-RJ",
  especialidade: "CLÍNICA MÉDICA",
};

function rnd(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Calcula a idade em anos a partir de "dd/mm/aaaa". */
export function calcIdade(nascimento: string, referencia?: string): string {
  const m = nascimento.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  const nasc = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const r = referencia?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const ref = r ? new Date(Number(r[3]), Number(r[2]) - 1, Number(r[1])) : new Date();
  let idade = ref.getFullYear() - nasc.getFullYear();
  const mesDiff = ref.getMonth() - nasc.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && ref.getDate() < nasc.getDate())) idade--;
  return idade >= 0 ? String(idade) : "";
}

const NOMES = [
  "VICTORIA GABRIELA COSTA PEREIRA",
  "RENATO SANTOS DE OLIVEIRA",
  "LARISSA MENDES DA COSTA",
  "PATRICK DE MOURA CARVALHO",
];

const MAES = ["DANIELE COSTA PEREIRA", "SANDRA MENDES DA COSTA", "ROSANA DE MOURA CARVALHO"];
const CIDS = ["T782", "M54", "J11", "A09", "R51"];

export default function UnimedFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "unimed").slice(0, 6);

  const [form, setForm] = useState<UnimedFormData>(initial);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(editState?.editDocId);
  const idade = useMemo(
    () => calcIdade(form.nascimento, form.dataAtendimento),
    [form.nascimento, form.dataAtendimento],
  );

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
          paciente: b.paciente || "",
          docTipo: b.cns ? "cns" : "cpf",
          docNumero: b.cns || b.cpf || "",
          nascimento: b.nascimento || "",
          mae: b.mae || "",
          setor: b.setor || "",
          leito: b.leito || "",
          prontuario: b.prontuario || "",
          numeroAtendimento: b.numero_atendimento || "",
          unidade: b.unidade || p.unidade,
          endereco: b.endereco || p.endereco,
          convenio: b.convenio || p.convenio,
          telefone: b.telefone || p.telefone,
          dataAtendimento: b.data_atendimento || "",
          horaAtendimento: b.hora_atendimento || "",
          dias: b.dias || "1",
          cid: b.cid || "",
          quadro: b.quadro || p.quadro,
          medico: b.medico || p.medico,
          crmNumero: b.crm_numero || p.crmNumero,
          crmUf: b.crm_uf || p.crmUf,
          especialidade: b.especialidade || p.especialidade,
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const fillTest = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    setForm({
      ...initial,
      paciente: pick(NOMES),
      docNumero: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      nascimento: "14/08/2000",
      mae: pick(MAES),
      dataAtendimento: `${dd}/${mm}/${hoje.getFullYear()}`,
      horaAtendimento: `1${Math.floor(Math.random() * 8)}:${rnd(2)}`,
      dias: String(Math.floor(Math.random() * 10) + 1),
      cid: pick(CIDS),
      quadro: pick(QUADROS),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof UnimedFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof UnimedFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const selecionarUnidade = (idx: number) => {
    setForm((p) => ({
      ...p,
      unidadeIdx: idx,
      unidade: UNIDADES[idx].nome,
      endereco: UNIDADES[idx].endereco,
      convenio: UNIDADES[idx].convenio,
      telefone: UNIDADES[idx].telefone,
      crmUf: UNIDADES[idx].crmUf,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const templateBase64 = await loadTemplateBase64(templateUnimedUrl);
      const horaCurta = form.horaAtendimento.slice(0, 5);
      const prontuario = form.prontuario || `00${rnd(7)}`;
      const numeroAtendimento = form.numeroAtendimento || rnd(7);

      const bodyData = {
        paciente: form.paciente,
        cpf: form.docTipo === "cpf" ? form.docNumero : "",
        cns: form.docTipo === "cns" ? form.docNumero : "",
        nascimento: form.nascimento,
        idade,
        mae: form.mae,
        setor: form.setor,
        leito: form.leito,
        prontuario,
        numero_atendimento: numeroAtendimento,
        convenio: form.convenio,
        unidade: form.unidade,
        unidade_curta: form.unidade,
        endereco: form.endereco,
        telefone: form.telefone,
        data_atendimento: form.dataAtendimento,
        hora_atendimento: horaCurta,
        hora_assinatura: `${horaCurta}:${rnd(2)}`,
        dias: form.dias,
        cid: form.cid,
        quadro: form.quadro,
        medico: form.medico,
        crm_numero: form.crmNumero,
        crm_uf: form.crmUf,
        crm: `${form.crmUf} ${form.crmNumero}`,
        especialidade: form.especialidade,
        uf: UNIDADES[form.unidadeIdx]?.uf || "RJ",
        template_base64: templateBase64,
        field_positions: loadUnimedFieldPositions() ?? undefined,
      };

      const { data, error } = await supabase.functions.invoke("generate-unimed-pdf", {
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
        navigate("/dashboard/documents/unimed/preview", {
          state: { pdfBase64: pdfResult, formData: bodyData },
        });
      }
    } catch (err) {
      console.error("Erro ao gerar PDF Unimed:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Atestado Médico Unimed</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PACIENTE */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Paciente" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do Paciente</FieldLabel>
            <Input value={form.paciente} onChange={set("paciente")} placeholder="Ex: VICTORIA GABRIELA COSTA PEREIRA" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Documento</FieldLabel>
            <div className="flex gap-2">
              {(["cpf", "cns"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, docTipo: t }))}
                  className={`rounded-lg border px-4 py-1.5 text-xs font-semibold uppercase transition ${
                    form.docTipo === t
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Input
              value={form.docNumero}
              onChange={set("docNumero")}
              placeholder={form.docTipo === "cpf" ? "000.000.000-00" : "801440458570767"}
              className={inputCls}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Data de Nascimento</FieldLabel>
              <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="14/08/2000" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Idade (automática)</FieldLabel>
              <Input value={idade ? `${idade} anos` : ""} readOnly disabled className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Nome da mãe</FieldLabel>
            <Input value={form.mae} onChange={set("mae")} placeholder="Ex: DANIELE COSTA PEREIRA" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Setor (opcional)</FieldLabel>
              <Input value={form.setor} onChange={set("setor")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Leito (opcional)</FieldLabel>
              <Input value={form.leito} onChange={set("leito")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Nº Prontuário (automático)</FieldLabel>
              <Input value={form.prontuario} onChange={set("prontuario")} placeholder="gerado automaticamente" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nº Atendimento (automático)</FieldLabel>
              <Input value={form.numeroAtendimento} onChange={set("numeroAtendimento")} placeholder="gerado automaticamente" className={inputCls} />
            </div>
          </div>
        </div>

        {/* ATENDIMENTO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Stethoscope} title="Atendimento" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Data do Atendimento</FieldLabel>
              <Input value={form.dataAtendimento} onChange={setMask("dataAtendimento", maskDate)} inputMode="numeric" placeholder="11/12/2024" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Hora do Atendimento</FieldLabel>
              <Input value={form.horaAtendimento} onChange={setMask("horaAtendimento", maskTime)} inputMode="numeric" placeholder="13:00" className={inputCls} required />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A data de assinatura, o rodapé "Impresso em" e a assinatura digital são preenchidos automaticamente com estes valores.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Dias de afastamento</FieldLabel>
              <Input type="number" min={1} max={180} value={form.dias} onChange={set("dias")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>CID</FieldLabel>
              <Input value={form.cid} onChange={set("cid")} placeholder="T782" className={inputCls} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Quadro apresentado</FieldLabel>
            <Input value={form.quadro} onChange={set("quadro")} list="unimed-quadros" className={inputCls} required />
            <datalist id="unimed-quadros">
              {QUADROS.map((q) => <option key={q} value={q} />)}
            </datalist>
            <p className="text-[11px] text-muted-foreground">
              Usado no texto: "…apresentando quadro de <strong>{form.quadro || "…"}</strong>."
            </p>
          </div>
        </div>

        {/* UNIDADE E PROFISSIONAL */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Building2} title="Unidade e profissional" />

          <div className="space-y-1.5">
            <FieldLabel required>Unidade</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {UNIDADES.map((u, i) => (
                <button
                  key={u.nome}
                  type="button"
                  onClick={() => selecionarUnidade(i)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    form.unidadeIdx === i
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {u.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Nome da unidade (cabeçalho)</FieldLabel>
            <Input value={form.unidade} onChange={set("unidade")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Endereço da unidade</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Convênio</FieldLabel>
              <Input value={form.convenio} onChange={set("convenio")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Telefone de contato</FieldLabel>
              <Input value={form.telefone} onChange={setMask("telefone", maskPhone)} inputMode="numeric" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Profissional</FieldLabel>
            <Input value={form.medico} onChange={set("medico")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>CRM (UF)</FieldLabel>
              <Input value={form.crmUf} onChange={set("crmUf")} placeholder="CRM-RJ" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nº do CRM</FieldLabel>
              <Input value={form.crmNumero} onChange={setMask("crmNumero", maskDigits(7))} inputMode="numeric" placeholder="0121699" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Especialidade</FieldLabel>
              <Input value={form.especialidade} onChange={set("especialidade")} className={inputCls} required />
            </div>
          </div>
        </div>

        {/* HISTÓRICO */}
        <div className="glass space-y-3 rounded-xl p-6">
          <SectionHeader icon={History} title="Histórico de Previews" />
          {previewHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atestado Unimed gerado ainda.</p>
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
