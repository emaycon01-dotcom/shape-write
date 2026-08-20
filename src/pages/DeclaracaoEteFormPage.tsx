import { useState, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Loader2, FlaskConical, Trash2, FileText, User, School } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadDeclaracaoEteFieldPositions } from "@/lib/declaracao-ete-align";
import templateEteAsset from "@/assets/template-declaracao-ete-bg.jpg.asset.json";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";

const CURSOS = [
  "ADMINISTRAÇÃO",
  "CONTABILIDADE",
  "DESENVOLVIMENTO DE SISTEMAS",
  "EDIFICAÇÕES",
  "ELETROTÉCNICA",
  "ELETROELETRÔNICA",
  "ENFERMAGEM",
  "INFORMÁTICA",
  "INFORMÁTICA PARA INTERNET",
  "LOGÍSTICA",
  "MANUTENÇÃO AUTOMOTIVA",
  "MECÂNICA",
  "MEIO AMBIENTE",
  "NUTRIÇÃO E DIETÉTICA",
  "QUÍMICA",
  "RECURSOS HUMANOS",
  "REDES DE COMPUTADORES",
  "SEGURANÇA DO TRABALHO",
];

interface FormState {
  nomeAluno: string;
  rg: string;
  orgaoEmissor: string;
  cpf: string;
  pai: string;
  mae: string;
  serie: string;
  nivelEnsino: string;
  curso: string;
  modalidade: string;
  diasSemana: string;
  horario: string;
  cidade: string;
  dataEmissao: string;
}

const initial: FormState = {
  nomeAluno: "",
  rg: "",
  orgaoEmissor: "SDS/PE",
  cpf: "",
  pai: "",
  mae: "",
  serie: "3º ano",
  nivelEnsino: "ensino médio",
  curso: "ADMINISTRAÇÃO",
  modalidade: "Integrado ao Profissional",
  diasSemana: "segunda à sexta-feira",
  horario: "7h30 às 17h",
  cidade: "Paulista",
  dataEmissao: "",
};

export default function DeclaracaoEteFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<FormState>(initial);
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
          nomeAluno: b.nome_aluno || "",
          rg: b.rg || "",
          orgaoEmissor: b.orgao_emissor || p.orgaoEmissor,
          cpf: b.cpf || "",
          pai: b.pai || "",
          mae: b.mae || "",
          serie: b.serie || p.serie,
          nivelEnsino: b.nivel_ensino || p.nivelEnsino,
          curso: b.curso || p.curso,
          modalidade: b.modalidade || p.modalidade,
          diasSemana: b.dias_semana || p.diasSemana,
          horario: b.horario || p.horario,
          cidade: b.cidade || p.cidade,
          dataEmissao: b.data_emissao || "",
        }));
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

  const fillTest = () => {
    setForm({
      ...initial,
      nomeAluno: "RAQUEL SOUZA BARROS DA SILVA",
      rg: "11.020.359",
      cpf: "718.608.124-06",
      pai: "MARCÍLIO BARROS DA SILVA",
      mae: "CRISTIANE MARIA DE SOUZA SILVA",
      dataEmissao: "15/08/2022",
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
    saveFormDraft("declaracao-ete", form as unknown as Record<string, unknown>);

    try {
      const templateBase64 = await loadTemplateObjectUrl(templateEteAsset.url);

      const bodyData = {
        nome_aluno: form.nomeAluno,
        rg: form.rg,
        orgao_emissor: form.orgaoEmissor,
        cpf: form.cpf,
        pai: form.pai,
        mae: form.mae,
        serie: form.serie,
        nivel_ensino: form.nivelEnsino,
        curso: form.curso,
        modalidade: form.modalidade,
        dias_semana: form.diasSemana,
        horario: form.horario,
        cidade: form.cidade,
        data_emissao: form.dataEmissao,

        template_base64: templateBase64,
        field_positions: loadDeclaracaoEteFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-declaracao-ete-pdf", {
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
        navigate("/dashboard/documents/declaracao-ete/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Declaração de Matrícula:", err);
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

      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Declaração de Matrícula (ETE)</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <FormDraftsPanel docType="declaracao-ete" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="RAQUEL SOUZA BARROS DA SILVA" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>RG</FieldLabel>
              <Input value={form.rg} onChange={set("rg")} placeholder="11.020.359" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Órgão emissor</FieldLabel>
              <Input value={form.orgaoEmissor} onChange={set("orgaoEmissor")} placeholder="SDS/PE" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>CPF</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="718.608.124-06" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Pai</FieldLabel>
              <Input value={form.pai} onChange={set("pai")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Mãe</FieldLabel>
              <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
            </div>
          </div>
        </div>

        {/* MATRÍCULA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={School} title="Matrícula" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>Série / ano</FieldLabel>
              <select value={form.serie} onChange={(e) => setForm((p) => ({ ...p, serie: e.target.value }))} className={selectCls}>
                {["1º ano", "2º ano", "3º ano", "4º ano"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nível de ensino</FieldLabel>
              <select value={form.nivelEnsino} onChange={(e) => setForm((p) => ({ ...p, nivelEnsino: e.target.value }))} className={selectCls}>
                <option value="ensino médio">ensino médio</option>
                <option value="ensino fundamental">ensino fundamental</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Modalidade</FieldLabel>
              <select value={form.modalidade} onChange={(e) => setForm((p) => ({ ...p, modalidade: e.target.value }))} className={selectCls}>
                <option value="Integrado ao Profissional">Integrado ao Profissional</option>
                <option value="Subsequente">Subsequente</option>
                <option value="Concomitante">Concomitante</option>
                <option value="EJA">EJA</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Curso técnico</FieldLabel>
            <select value={form.curso} onChange={(e) => setForm((p) => ({ ...p, curso: e.target.value }))} className={selectCls}>
              {CURSOS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Dias de aula</FieldLabel>
              <Input value={form.diasSemana} onChange={set("diasSemana")} placeholder="segunda à sexta-feira" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Horário</FieldLabel>
              <Input value={form.horario} onChange={set("horario")} placeholder="7h30 às 17h" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Cidade</FieldLabel>
              <Input value={form.cidade} onChange={set("cidade")} placeholder="Paulista" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de emissão</FieldLabel>
              <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="15/08/2022" className={inputCls} required />
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
            ) : isEditMode ? (
              <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
            ) : (
              <><GraduationCap className="mr-2 h-5 w-5" /> Gerar preview</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
