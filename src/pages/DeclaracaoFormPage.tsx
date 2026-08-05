import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Loader2, FlaskConical, Trash2, FileText, User, School } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadDeclaracaoFieldPositions } from "@/lib/declaracao-align";
import templateDeclaracaoUrl from "@/assets/template-declaracao-bg-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADOS_UF, ESTADO_NOMES, loadBrasaoDataUrl } from "@/lib/brasoes-estados";

interface DeclaracaoFormData {
  uf: string;
  cidade: string;
  escola: string;
  nomeAluno: string;
  naturalidade: string;
  dataNasc: string;
  mae: string;
  pai: string;
  serie: string;
  nivelEnsino: string;
  modalidade: string;
  anoLetivo: string;
  dataTermino: string;
  dataEmissao: string;
}

const initial: DeclaracaoFormData = {
  uf: "SP",
  cidade: "São Paulo",
  escola: "",
  nomeAluno: "",
  naturalidade: "",
  dataNasc: "",
  mae: "",
  pai: "",
  serie: "3º ano",
  nivelEnsino: "Ensino Médio",
  modalidade: "REGULAR",
  anoLetivo: "",
  dataTermino: "",
  dataEmissao: "",
};

export default function DeclaracaoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<DeclaracaoFormData>(initial);
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
          uf: b.uf || p.uf,
          cidade: b.cidade || p.cidade,
          escola: b.escola || "",
          nomeAluno: b.nome_aluno || "",
          naturalidade: b.naturalidade || "",
          dataNasc: b.data_nasc || "",
          mae: b.mae || "",
          pai: b.pai || "",
          serie: b.serie || p.serie,
          nivelEnsino: b.nivel_ensino || p.nivelEnsino,
          modalidade: b.modalidade || p.modalidade,
          anoLetivo: b.ano_letivo || "",
          dataTermino: b.data_termino || "",
          dataEmissao: b.data_emissao || "",
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof DeclaracaoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof DeclaracaoFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    setForm({
      ...initial,
      escola: "ESCOLA ESTADUAL ROBERTO FREITAS",
      nomeAluno: "Rafael Santos Silva de Matos",
      naturalidade: "São Paulo",
      dataNasc: "15/08/1998",
      mae: "Marcia Maria Santos Silva",
      pai: "José Carlos de Oliveira Matos",
      anoLetivo: "2015",
      dataTermino: "12/12/2015",
      dataEmissao: "04/12/2022",
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
      const templateBase64 = await loadTemplateBase64(templateDeclaracaoUrl);
      const brasaoBase64 = await loadBrasaoDataUrl(form.uf);

      const bodyData = {
        uf: form.uf,
        estado_nome: ESTADO_NOMES[form.uf] || "",
        gov_estado: `GOVERNO DO ESTADO DE ${ESTADO_NOMES[form.uf] || ""}`,
        secretaria: "SECRETARIA DE ESTADO DA EDUCAÇÃO",
        cidade: form.cidade,
        escola: form.escola,
        nome_aluno: form.nomeAluno,
        naturalidade: form.naturalidade,
        data_nasc: form.dataNasc,
        mae: form.mae,
        pai: form.pai,
        serie: form.serie,
        nivel_ensino: form.nivelEnsino,
        modalidade: form.modalidade,
        ano_letivo: form.anoLetivo,
        data_termino: form.dataTermino,
        data_emissao: form.dataEmissao,

        brasao_base64: brasaoBase64,
        template_base64: templateBase64,
        field_positions: loadDeclaracaoFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-declaracao-pdf", {
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
        navigate("/dashboard/documents/declaracao-escolar/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Declaração Escolar:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Declaração Escolar</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ESCOLA / ESTADO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={School} title="Estado e estabelecimento" />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Estado (brasão)</FieldLabel>
              <select value={form.uf} onChange={(e) => setForm((p) => ({ ...p, uf: e.target.value }))} className={selectCls}>
                {ESTADOS_UF.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <FieldLabel required>Cidade</FieldLabel>
              <Input value={form.cidade} onChange={set("cidade")} className={inputCls} required />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Cabeçalho: GOVERNO DO ESTADO DE {ESTADO_NOMES[form.uf] || ""} — o brasão do estado é inserido automaticamente.
          </p>

          <div className="space-y-1.5">
            <FieldLabel required>Escola</FieldLabel>
            <Input value={form.escola} onChange={set("escola")} placeholder="ESCOLA ESTADUAL ROBERTO FREITAS" className={inputCls} required />
          </div>
        </div>

        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="Ex: Rafael Santos Silva de Matos" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Natural de</FieldLabel>
              <Input value={form.naturalidade} onChange={set("naturalidade")} placeholder="São Paulo" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de nascimento</FieldLabel>
              <Input value={form.dataNasc} onChange={setMask("dataNasc", maskDate)} inputMode="numeric" placeholder="15/08/1998" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Mãe</FieldLabel>
              <Input value={form.mae} onChange={set("mae")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Pai</FieldLabel>
              <Input value={form.pai} onChange={set("pai")} className={inputCls} required />
            </div>
          </div>
        </div>

        {/* CONCLUSÃO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={GraduationCap} title="Conclusão" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>Série / ano</FieldLabel>
              <select value={form.serie} onChange={(e) => setForm((p) => ({ ...p, serie: e.target.value }))} className={selectCls}>
                {["1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano", "7º ano", "8º ano", "9º ano"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nível de ensino</FieldLabel>
              <select value={form.nivelEnsino} onChange={(e) => setForm((p) => ({ ...p, nivelEnsino: e.target.value }))} className={selectCls}>
                <option value="Ensino Médio">Ensino Médio</option>
                <option value="Ensino Fundamental">Ensino Fundamental</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Modalidade</FieldLabel>
              <select value={form.modalidade} onChange={(e) => setForm((p) => ({ ...p, modalidade: e.target.value }))} className={selectCls}>
                <option value="REGULAR">REGULAR</option>
                <option value="EJA">EJA</option>
                <option value="TÉCNICO">TÉCNICO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>Ano letivo</FieldLabel>
              <Input value={form.anoLetivo} onChange={set("anoLetivo")} inputMode="numeric" placeholder="2015" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Término do ano letivo</FieldLabel>
              <Input value={form.dataTermino} onChange={setMask("dataTermino", maskDate)} inputMode="numeric" placeholder="12/12/2015" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de emissão</FieldLabel>
              <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="04/12/2022" className={inputCls} required />
            </div>
          </div>
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
          ) : isEditMode ? (
            <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
          ) : (
            <><GraduationCap className="mr-2 h-5 w-5" /> Gerar preview</>
          )}
        </Button>
      </form>
    </div>
  );
}
