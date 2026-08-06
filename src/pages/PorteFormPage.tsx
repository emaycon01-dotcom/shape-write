import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, FlaskConical, Trash2, FileText, User, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadPorteFieldPositions } from "@/lib/porte-align";
import templatePorteUrl from "@/assets/template-porte-bg-hq.webp";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";

interface PorteFormData {
  certificado: string;
  expedicao: string;
  categoria: string;
  via: string;
  nome: string;
  abrangencia: string;
  armaNumero: string;
  especie: string;
  marca: string;
  calibre: string;
  fabricacao: string;
  dataExpedicao: string;
  validade: string;
  identidade: string;
  assinante: string;
  cargo: string;
  unidade: string;
  numeroPorte: string;
}

const initial: PorteFormData = {
  certificado: "",
  expedicao: "SR/PF/AM",
  categoria: "DEFESA PESSOAL",
  via: "1",
  nome: "",
  abrangencia: "VALIDO EM TODO TERRITÓRIO NACIONAL",
  armaNumero: "",
  especie: "PISTOLA",
  marca: "",
  calibre: "",
  fabricacao: "",
  dataExpedicao: "",
  validade: "",
  identidade: "",
  assinante: "",
  cargo: "DELEGADO DE POLICIA FEDERAL CLASSE ESPECIAL",
  unidade: "SR/PF/AM",
  numeroPorte: "",
};

const ESPECIES = ["PISTOLA", "REVÓLVER", "CARABINA", "FUZIL", "ESPINGARDA", "GARRUCHA"];

const CATEGORIAS = [
  "DEFESA PESSOAL",
  "CAÇADOR",
  "ATIRADOR DESPORTIVO",
  "COLECIONADOR",
  "VIGILANTE",
  "FUNCIONAL",
];

export default function PorteFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<PorteFormData>(initial);
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
          certificado: b.certificado || "",
          expedicao: b.expedicao || p.expedicao,
          categoria: b.categoria || p.categoria,
          via: b.via || p.via,
          nome: b.nome || "",
          abrangencia: b.abrangencia || p.abrangencia,
          armaNumero: b.arma_numero || "",
          especie: b.especie || p.especie,
          marca: b.marca || "",
          calibre: b.calibre || "",
          fabricacao: b.fabricacao || "",
          dataExpedicao: b.data_expedicao || "",
          validade: b.validade || "",
          identidade: b.identidade || "",
          assinante: b.assinante || "",
          cargo: b.cargo || p.cargo,
          unidade: b.unidade || p.unidade,
          numeroPorte: b.numero_porte || "",
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof PorteFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof PorteFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    setForm({
      ...initial,
      certificado: "438297892434",
      nome: "ELIAS DOS SANTOS LEÃO",
      armaNumero: "78167",
      especie: "PISTOLA",
      marca: "TAURUS",
      calibre: "380",
      fabricacao: "2008",
      dataExpedicao: "23/11/2023",
      validade: "21/11/2028",
      identidade: "3260848-9 SSP/AM",
      assinante: "FLAVIO MARCIO ALBERGEREGE SILVA",
      numeroPorte: "438297892434",
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
      const templateBase64 = await loadTemplateBase64(templatePorteUrl);

      const bodyData = {
        certificado: form.certificado,
        expedicao: form.expedicao,
        categoria: form.categoria,
        via: form.via,
        nome: form.nome,
        abrangencia: form.abrangencia,
        arma_numero: form.armaNumero,
        especie: form.especie,
        marca: form.marca,
        calibre: form.calibre,
        fabricacao: form.fabricacao,
        data_expedicao: form.dataExpedicao,
        validade: form.validade,
        identidade: form.identidade,
        assinante: form.assinante,
        cargo: form.cargo,
        unidade: form.unidade,
        numero_porte: form.numeroPorte,

        template_base64: templateBase64,
        field_positions: loadPorteFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-porte-pdf", {
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
        navigate("/dashboard/documents/porte/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar PORTE:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">PORTE FEDERAL DE ARMA</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CERTIFICADO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={FileText} title="Dados do certificado" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Certificado nº</FieldLabel>
              <Input value={form.certificado} onChange={set("certificado")} inputMode="numeric" placeholder="438297892434" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Expedição (unidade)</FieldLabel>
              <Input value={form.expedicao} onChange={set("expedicao")} placeholder="SR/PF/AM" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel required>Categoria</FieldLabel>
              <select value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} className={selectCls}>
                {CATEGORIAS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Via</FieldLabel>
              <Input value={form.via} onChange={set("via")} inputMode="numeric" placeholder="1" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* TITULAR */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do portador" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="ELIAS DOS SANTOS LEÃO" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Abrangência</FieldLabel>
            <Input value={form.abrangencia} onChange={set("abrangencia")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Identidade</FieldLabel>
            <Input value={form.identidade} onChange={set("identidade")} placeholder="3260848-9 SSP/AM" className={inputCls} required />
          </div>
        </div>

        {/* ARMA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Crosshair} title="Dados da arma" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Nº da arma</FieldLabel>
              <Input value={form.armaNumero} onChange={set("armaNumero")} placeholder="78167" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Espécie</FieldLabel>
              <select value={form.especie} onChange={(e) => setForm((p) => ({ ...p, especie: e.target.value }))} className={selectCls}>
                {ESPECIES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>Marca</FieldLabel>
              <Input value={form.marca} onChange={set("marca")} placeholder="TAURUS" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Calibre</FieldLabel>
              <Input value={form.calibre} onChange={set("calibre")} placeholder="380" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Fabricação</FieldLabel>
              <Input value={form.fabricacao} onChange={set("fabricacao")} inputMode="numeric" placeholder="2008" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* EXPEDIÇÃO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Shield} title="Expedição e assinatura" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Data de expedição</FieldLabel>
              <Input value={form.dataExpedicao} onChange={setMask("dataExpedicao", maskDate)} inputMode="numeric" placeholder="23/11/2023" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Validade</FieldLabel>
              <Input value={form.validade} onChange={setMask("validade", maskDate)} inputMode="numeric" placeholder="21/11/2028" className={inputCls} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Assinante</FieldLabel>
            <Input value={form.assinante} onChange={set("assinante")} placeholder="FLAVIO MARCIO ALBERGEREGE SILVA" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Cargo do assinante</FieldLabel>
              <Input value={form.cargo} onChange={set("cargo")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Unidade do assinante</FieldLabel>
              <Input value={form.unidade} onChange={set("unidade")} placeholder="SR/PF/AM" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Nº do porte (rodapé do verso)</FieldLabel>
            <Input value={form.numeroPorte} onChange={set("numeroPorte")} placeholder="438297892434" className={inputCls} />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
          ) : isEditMode ? (
            <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
          ) : (
            <><Crosshair className="mr-2 h-5 w-5" /> Gerar preview</>
          )}
        </Button>
      </form>
    </div>
  );
}
