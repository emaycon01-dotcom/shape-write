import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Stethoscope, User, Building2, Loader2, FlaskConical, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadAtestadoFieldPositions } from "@/lib/atestado-align";
import templateAtestadoUrl from "@/assets/template-atestado-bg-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { splitEndereco } from "@/lib/atestado-endereco";


const MEDICO = "Dr. Abdo";
const CRM = "CRM/SP 123456";
const ESPECIALIDADE = "Clínico Geral";

interface AtestadoFormData {
  paciente: string;
  docTipo: "cpf" | "cns";
  docNumero: string;
  unidade: string;
  endereco: string;
  dataAtendimento: string;
  horaAtendimento: string;
  dias: string;
  cid: string;
  nascimento: string;
  uf: string;
}

const initial: AtestadoFormData = {
  paciente: "",
  docTipo: "cpf",
  docNumero: "",
  unidade: "UPA 24h Itaquera",
  endereco: "Av. Miguel Ignácio Curi, 41\nVila Carmosina - São Paulo – SP\nCEP: 08295-005",
  dataAtendimento: "",
  horaAtendimento: "",
  dias: "1",
  cid: "",
  nascimento: "",
  uf: "SP",
};

function rnd(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}





function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const NOMES = [
  "TATIANI RODRIGUES MOR",
  "CARLOS FERREIRA LIMA",
  "ANA PAULA COSTA SILVA",
  "MARCOS ANTONIO DE SOUZA",
];

export default function AtestadoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<AtestadoFormData>(initial);
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
        setForm({
          paciente: b.paciente || "",
          docTipo: b.cns ? "cns" : "cpf",
          docNumero: b.cns || b.cpf || "",
          unidade: b.unidade_curta || b.unidade || initial.unidade,
          endereco: [b.endereco1, b.endereco2, b.endereco3].filter(Boolean).join("\n"),
          dataAtendimento: b.data_atendimento || "",
          horaAtendimento: b.hora_atendimento || "",
          dias: b.dias || "1",
          cid: b.cid || "",
          nascimento: b.nascimento || "",
          uf: b.uf || initial.uf,
        });
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const imgToBase64 = (url: string) => loadTemplateBase64(url);

  const fillTest = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const data = `${dd}/${mm}/${hoje.getFullYear()}`;
    const hora = `0${Math.floor(Math.random() * 8) + 1}:${rnd(2)}:${rnd(2)}`;
    setForm({
      ...initial,
      paciente: pick(NOMES),
      docTipo: "cpf",
      docNumero: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      dataAtendimento: data,
      horaAtendimento: hora,
      dias: String(Math.floor(Math.random() * 3) + 1),
      cid: "J11",
      nascimento: "14/05/1990",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof AtestadoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const templateBase64 = await imgToBase64(templateAtestadoUrl);

      const [end1, end2, end3] = splitEndereco(form.endereco);
      const horaCurta = form.horaAtendimento.slice(0, 5);

      const bodyData = {
        paciente: form.paciente,
        cpf: form.docTipo === "cpf" ? form.docNumero : "",
        cns: form.docTipo === "cns" ? form.docNumero : "",
        unidade: form.unidade,
        unidade_curta: form.unidade,
        endereco1: end1,
        endereco2: end2,
        endereco3: end3,

        data_atendimento: form.dataAtendimento,
        hora_atendimento: form.horaAtendimento,
        dias: form.dias,
        motivo: "doença",
        cid: form.cid,
        nascimento: form.nascimento,
        uf: form.uf,
        medico: MEDICO,
        crm: CRM,
        especialidade: ESPECIALIDADE,
        data_emissao: form.dataAtendimento,
        emitido_em: `${form.dataAtendimento} ${form.horaAtendimento}`.trim(),
        liberado_data: form.dataAtendimento,
        liberado_hora: horaCurta,
        corpo: "",
        template_base64: templateBase64,
        field_positions: loadAtestadoFieldPositions() ?? undefined,
      };

      const { data, error } = await supabase.functions.invoke("generate-atestado-pdf", {
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
        navigate("/dashboard/documents/atestado/preview", {
          state: { pdfBase64: pdfResult, formData: bodyData },
        });
      }
    } catch (err) {
      console.error("Erro ao gerar PDF do atestado:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Atestado Médico Digital</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PACIENTE */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Paciente" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do Paciente</FieldLabel>
            <Input value={form.paciente} onChange={set("paciente")} placeholder="Ex: TATIANI RODRIGUES MOR" className={inputCls} required />
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
              <Input value={form.nascimento} onChange={set("nascimento")} placeholder="14/05/1990" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>UF</FieldLabel>
              <Input value={form.uf} onChange={set("uf")} placeholder="SP" maxLength={2} className={inputCls} />
            </div>
          </div>
        </div>

        {/* ATENDIMENTO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Stethoscope} title="Atendimento" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Data do Atendimento</FieldLabel>
              <Input value={form.dataAtendimento} onChange={set("dataAtendimento")} placeholder="08/11/2023" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Hora do Atendimento</FieldLabel>
              <Input value={form.horaAtendimento} onChange={set("horaAtendimento")} placeholder="05:53:23" className={inputCls} required />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A data e hora de emissão, o rodapé e a liberação eletrônica são preenchidos automaticamente com estes valores.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Dias de Repouso</FieldLabel>
              <Input type="number" min={1} max={30} value={form.dias} onChange={set("dias")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>CID</FieldLabel>
              <Input value={form.cid} onChange={set("cid")} placeholder="J11" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* UNIDADE */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Building2} title="Unidade" />

          <div className="space-y-1.5">
            <FieldLabel required>Unidade</FieldLabel>
            <Input value={form.unidade} onChange={set("unidade")} placeholder="UPA 24h Itaquera" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Endereço (cole o endereço completo)</FieldLabel>
            <Textarea
              value={form.endereco}
              onChange={set("endereco")}
              rows={3}
              placeholder={"Av. Miguel Ignácio Curi, 41\nVila Carmosina - São Paulo – SP\nCEP: 08295-005"}
              className={inputCls}
            />
            <p className="text-[11px] text-muted-foreground">As quebras de linha coladas são mantidas no documento.</p>
          </div>
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
