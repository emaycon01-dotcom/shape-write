import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Anchor, Trash2, Eye, Shuffle, Calendar as CalendarIcon, Upload, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ChaFormData {
  nome: string;
  nascimento: string;
  validade: string;
  inscricao: string;
  emissao: string;
  fotoBase64: string;
}

const initial: ChaFormData = {
  nome: "",
  nascimento: "",
  validade: "",
  inscricao: "",
  emissao: "",
  fotoBase64: "",
};

function generateInscricao(): string {
  const d = () => Math.floor(Math.random() * 10);
  // Format like: 937W5283046218
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  return `${d()}${d()}${d()}${pick()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}`;
}

function DateField({ label, value, onChange, required = true }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const [date, setDate] = useState<Date | undefined>(value ? new Date(value.split("/").reverse().join("-")) : undefined);

  const handleSelect = (d: Date | undefined) => {
    setDate(d);
    onChange(d ? format(d, "dd/MM/yyyy") : "");
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-primary">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-secondary border-border", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value || "DD/MM/AAAA"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={handleSelect} initialFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function ChaAmadorFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, string>; editDocId?: string } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const [form, setForm] = useState<ChaFormData>(() => {
    if (editState?.editFormData) {
      return { ...initial, ...editState.editFormData };
    }
    return initial;
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (field: keyof ChaFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
  };

  const setDate = (field: keyof ChaFormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((p) => ({ ...p, fotoBase64: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const fillTest = () => {
    const now = new Date();
    const nasc = new Date(1990, 0, 15);
    const validade = new Date(now.getTime() + 365 * 5 * 86400000);
    setForm({
      nome: "CARLOS EDUARDO DA SILVA",
      nascimento: format(nasc, "dd/MM/yyyy"),
      validade: format(validade, "dd/MM/yyyy"),
      inscricao: generateInscricao(),
      emissao: format(now, "dd/MM/yyyy"),
      fotoBase64: form.fotoBase64,
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const savedRaw = localStorage.getItem("cha-amador-field-positions");
    let fieldPositions: Record<string, { x: number; y: number; fontSize: number }> | null = null;
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) {
          fieldPositions = parsed.reduce((acc: Record<string, { x: number; y: number; fontSize: number }>, f: any) => {
            acc[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize };
            return acc;
          }, {});
        } else {
          fieldPositions = parsed;
        }
      } catch { /* ignore */ }
    }
    navigate("/dashboard/documents/cha-amador/preview", {
      state: { formData: form, fieldPositions, ...(isEditMode ? { autoUpdate: true, editDocId: editState?.editDocId } : {}) },
    });
  };

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";

  const FieldLabel = ({ children, required = true }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-sm font-semibold text-primary">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="flex items-center gap-3 pb-2 mb-2 border-b border-border/50">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate("/dashboard/documents")} className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <Anchor className="w-3.5 h-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">CHÁ Amador Digital</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar a Carteira de Habilitação de Amador</p>

      <form onSubmit={handlePreview} className="space-y-6">
        {/* DADOS PESSOAIS */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />
          <div className="space-y-1.5">
            <FieldLabel>Nome</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="Ex: CARLOS EDUARDO DA SILVA" className={inputCls} required />
          </div>
          <DateField label="Data de Nascimento" value={form.nascimento} onChange={setDate("nascimento")} />
        </div>

        {/* DOCUMENTO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Anchor} title="Dados do Documento" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel>Número de Inscrição</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, inscricao: generateInscricao() }))} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 h-7">
                <Shuffle className="w-3 h-3" /> Gerar Número Aleatório
              </Button>
            </div>
            <Input value={form.inscricao} onChange={set("inscricao")} placeholder="Ex: 937W5283046218" className={inputCls} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DateField label="Data de Emissão" value={form.emissao} onChange={setDate("emissao")} />
            <DateField label="Data de Validade" value={form.validade} onChange={setDate("validade")} />
          </div>
        </div>

        {/* FOTO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Upload} title="Foto 3x4" />
          <div className="space-y-1.5">
            <FieldLabel>Upload da Foto</FieldLabel>
            <Input type="file" accept="image/*" onChange={handleFoto} className={inputCls} required />
          </div>
          {form.fotoBase64 && (
            <div className="flex justify-center">
              <img src={form.fotoBase64} alt="Preview" className="w-24 h-32 object-cover rounded-lg border border-border" />
            </div>
          )}
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          {isEditMode ? <><RefreshCw className="w-5 h-5" /> Atualizar</> : <><Eye className="w-5 h-5" /> Gerar Preview</>}
        </Button>
      </form>
    </div>
  );
}
