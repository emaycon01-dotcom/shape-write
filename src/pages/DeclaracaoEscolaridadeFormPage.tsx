import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { School, Loader2, FlaskConical, Trash2, FileText, User, PenLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { maskDate, maskCPF } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { normalizeSignatureImage } from "@/lib/signature-image";
import { ESTADOS_UF, ESTADO_NOMES, loadBrasaoDataUrl } from "@/lib/brasoes-estados";

interface FormState {
  nomeAluno: string;
  rg: string;
  cpf: string;
  nivelEnsino: string;
  anoConclusao: string;
  escola: string;
  escolaCurta: string;
  endereco: string;
  estado: string;
  cidade: string;
  dataEmissao: string;
}

const initial: FormState = {
  nomeAluno: "",
  rg: "",
  cpf: "",
  nivelEnsino: "ensino médio",
  anoConclusao: "",
  escola: "Escola Estadual - Professor João Ferreira dos Santos",
  escolaCurta: "E.E Prof. João Ferreira dos Santos",
  endereco: "R. Quinze de Outubro, 80 – Jardim das Cerejeiras, São José dos Campos – SP, 12225-500",
  estado: "SP",
  cidade: "São Paulo",
  dataEmissao: "",
};

export default function DeclaracaoEscolaridadeFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<FormState>(initial);
  const [assinatura, setAssinatura] = useState<string>("");
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
          cpf: b.cpf || "",
          nivelEnsino: b.nivel_ensino || p.nivelEnsino,
          anoConclusao: b.ano_conclusao || "",
          escola: b.escola || p.escola,
          escolaCurta: b.escola_curta || p.escolaCurta,
          endereco: b.endereco || p.endereco,
          estado: b.estado || p.estado,
          cidade: b.cidade || p.cidade,
          dataEmissao: b.data_emissao || "",
        }));
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
      nomeAluno: "RAFAEL DE LIMA MACHADO",
      rg: "45.729.719-0",
      cpf: "382.904.298-19",
      anoConclusao: "2017",
      dataEmissao: "01/12/2021",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
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
        nome_aluno: form.nomeAluno,
        rg: form.rg,
        cpf: form.cpf,
        nivel_ensino: form.nivelEnsino,
        ano_conclusao: form.anoConclusao,
        escola: form.escola,
        escola_curta: form.escolaCurta || form.escola,
        endereco: form.endereco,
        estado: form.estado,
        estado_nome: ESTADO_NOMES[form.estado] || form.estado,
        cidade: form.cidade,
        data_emissao: form.dataEmissao,
        template_brasao_base64: brasao,
        assinatura_base64: assinatura,
      };

      const { data, error } = await invokeGeneratePdf("generate-declaracao-escolaridade-pdf", {
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
        navigate("/dashboard/documents/declaracao-escolaridade/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Declaração de Escolaridade:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">DECLARAÇÃO DE ESCOLARIDADE</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ALUNO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do aluno" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="RAFAEL DE LIMA MACHADO" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>RG</FieldLabel>
              <Input value={form.rg} onChange={set("rg")} placeholder="45.729.719-0" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>CPF</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="382.904.298-19" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Nível de ensino</FieldLabel>
              <select value={form.nivelEnsino} onChange={(e) => setForm((p) => ({ ...p, nivelEnsino: e.target.value }))} className={selectCls}>
                <option value="ensino médio">ensino médio</option>
                <option value="ensino fundamental">ensino fundamental</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Ano de conclusão</FieldLabel>
              <Input value={form.anoConclusao} onChange={set("anoConclusao")} inputMode="numeric" placeholder="2017" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* ESCOLA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={School} title="Instituição de ensino" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Estado (brasão)</FieldLabel>
              <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} className={selectCls}>
                {ESTADOS_UF.map((uf) => (
                  <option key={uf} value={uf}>{uf} — {ESTADO_NOMES[uf]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Cidade (assinatura)</FieldLabel>
              <Input value={form.cidade} onChange={set("cidade")} placeholder="São Paulo" className={inputCls} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Nome da escola (cabeçalho)</FieldLabel>
            <Input value={form.escola} onChange={set("escola")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Nome abreviado (usado no texto)</FieldLabel>
            <Input value={form.escolaCurta} onChange={set("escolaCurta")} placeholder="E.E Prof. João Ferreira dos Santos" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Endereço</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Data de emissão</FieldLabel>
            <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="01/12/2021" className={inputCls} required />
          </div>
        </div>

        {/* CARIMBO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={PenLine} title="Carimbo / assinatura" />
          <p className="text-xs text-muted-foreground">
            Envie a imagem do carimbo com a assinatura. Ela é aplicada no rodapé do documento, no mesmo lugar do modelo oficial.
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={uploadAssinatura}
            className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary"
          />
          {assinatura && (
            <div className="rounded-md border border-border/60 bg-white p-2">
              <img src={assinatura} alt="Carimbo e assinatura" className="mx-auto h-24 object-contain" />
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
