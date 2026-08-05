import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, FlaskConical, Trash2, FileText, User, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadCrafFieldPositions } from "@/lib/craf-align";
import templateCrafUrl from "@/assets/template-craf-bg-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskCPF } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";

interface CrafFormData {
  validade: string;
  nome: string;
  cpf: string;
  rg: string;
  sfpc: string;
  amparo: string;
  registro: string;
  tipo: string;
  marca: string;
  calibre: string;
  numeroSerie: string;
  numeroSigma: string;
  dataExpedicao: string;
  assinante: string;
  cidade: string;
}

const initial: CrafFormData = {
  validade: "",
  nome: "",
  cpf: "",
  rg: "",
  sfpc: "Cmdo 4ª RM",
  amparo: "art. 3º da Lei 10.826/03 e art. 4 do Decreto 9.847/19.",
  registro: "",
  tipo: "CARABINA / FUZIL",
  marca: "",
  calibre: "",
  numeroSerie: "",
  numeroSigma: "",
  dataExpedicao: "",
  assinante: "SFPC - 4º GAAAe",
  cidade: "Sete Lagoas/MG",
};

const TIPOS = [
  "CARABINA / FUZIL",
  "PISTOLA",
  "REVÓLVER",
  "ESPINGARDA",
  "GARRUCHA",
  "SUBMETRALHADORA",
];

export default function CrafFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<CrafFormData>(initial);
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
          validade: b.validade || "",
          nome: b.nome || "",
          cpf: b.cpf || "",
          rg: b.rg || "",
          sfpc: b.sfpc || p.sfpc,
          amparo: b.amparo || p.amparo,
          registro: b.registro || "",
          tipo: b.tipo || p.tipo,
          marca: b.marca || "",
          calibre: b.calibre || "",
          numeroSerie: b.numero_serie || "",
          numeroSigma: b.numero_sigma || "",
          dataExpedicao: b.data_expedicao || "",
          assinante: b.assinante || p.assinante,
          cidade: b.cidade || p.cidade,
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof CrafFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof CrafFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    setForm({
      ...initial,
      validade: "30/03/2032",
      nome: "Bruno Henrique Couto Neves",
      cpf: "015.063.256-88",
      rg: "MG-10.617.978",
      registro: "ADT ELET SISFPC NR 72 DE 30/03/2022, 4º GAAAE",
      marca: "AMADEO ROSSI",
      calibre: "357 Magnum",
      numeroSerie: "NVH 4712721",
      numeroSigma: "1817992",
      dataExpedicao: "30/03/2022",
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
      const templateBase64 = await loadTemplateBase64(templateCrafUrl);

      const bodyData = {
        validade: form.validade,
        nome: form.nome,
        cpf: form.cpf,
        rg: form.rg,
        sfpc: form.sfpc,
        amparo: form.amparo,
        registro: form.registro,
        tipo: form.tipo,
        marca: form.marca,
        calibre: form.calibre,
        numero_serie: form.numeroSerie,
        numero_sigma: form.numeroSigma,
        data_expedicao: form.dataExpedicao,
        assinante: form.assinante,
        cidade: form.cidade,

        template_base64: templateBase64,
        field_positions: loadCrafFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-craf-pdf", {
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
        navigate("/dashboard/documents/craf/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar CRAF:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">CRAF — Registro de Arma</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* TITULAR */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do titular" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="Bruno Henrique Couto Neves" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>CPF</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="015.063.256-88" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>RG</FieldLabel>
              <Input value={form.rg} onChange={set("rg")} placeholder="MG-10.617.978" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>SFPC de vinculação (RM)</FieldLabel>
              <Input value={form.sfpc} onChange={set("sfpc")} placeholder="Cmdo 4ª RM" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Validade</FieldLabel>
              <Input value={form.validade} onChange={setMask("validade", maskDate)} inputMode="numeric" placeholder="30/03/2032" className={inputCls} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Amparo legal</FieldLabel>
            <Input value={form.amparo} onChange={set("amparo")} className={inputCls} />
          </div>
        </div>

        {/* ARMA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Crosshair} title="Dados da arma" />

          <div className="space-y-1.5">
            <FieldLabel required>Registro</FieldLabel>
            <Input value={form.registro} onChange={set("registro")} placeholder="ADT ELET SISFPC NR 72 DE 30/03/2022, 4º GAAAE" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Tipo</FieldLabel>
              <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))} className={selectCls}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Marca</FieldLabel>
              <Input value={form.marca} onChange={set("marca")} placeholder="AMADEO ROSSI" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>Calibre</FieldLabel>
              <Input value={form.calibre} onChange={set("calibre")} placeholder="357 Magnum" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nº de série</FieldLabel>
              <Input value={form.numeroSerie} onChange={set("numeroSerie")} placeholder="NVH 4712721" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nº SIGMA</FieldLabel>
              <Input value={form.numeroSigma} onChange={set("numeroSigma")} placeholder="1817992" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* EXPEDIÇÃO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Shield} title="Expedição e assinatura" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>Data de expedição</FieldLabel>
              <Input value={form.dataExpedicao} onChange={setMask("dataExpedicao", maskDate)} inputMode="numeric" placeholder="30/03/2022" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Assinante</FieldLabel>
              <Input value={form.assinante} onChange={set("assinante")} placeholder="SFPC - 4º GAAAe" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Cidade</FieldLabel>
              <Input value={form.cidade} onChange={set("cidade")} placeholder="Sete Lagoas/MG" className={inputCls} required />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            O QR Code de autenticidade é gerado automaticamente a partir dos dados acima.
          </p>
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
