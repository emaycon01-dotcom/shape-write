import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Building2, FlaskConical, Trash2, Eye, Shuffle, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ExameFormData {
  clienteEmpresa: string;
  nomeCompleto: string;
  laudo: string;
  cnpj: string;
  cpf: string;
  dataColeta: string;
  dataRecebimento: string;
  dataResultado: string;
  dataValidade: string;
}

const initial: ExameFormData = {
  clienteEmpresa: "",
  nomeCompleto: "",
  laudo: "",
  cnpj: "",
  cpf: "",
  dataColeta: "",
  dataRecebimento: "",
  dataResultado: "",
  dataValidade: "",
};

const NOMES_TESTE = ["JOSE CARLOS DA SILVA", "MARIA OLIVEIRA SANTOS", "CARLOS FERREIRA LIMA", "ANA PAULA COSTA"];
const EMPRESAS_TESTE = ["TRANSPORTADORA NORTE LTDA", "LOGISTICA SUL S/A", "EXPRESSO BRASIL LTDA", "FRETES E CIA"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateCPF(): string {
  const d = () => Math.floor(Math.random() * 10);
  return `${d()}${d()}${d()}.${d()}${d()}${d()}.${d()}${d()}${d()}-${d()}${d()}`;
}

function generateCNPJ(): string {
  const d = () => Math.floor(Math.random() * 10);
  return `${d()}${d()}.${d()}${d()}${d()}.${d()}${d()}${d()}/000${d()}-${d()}${d()}`;
}

function generateLaudo(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  // Format: 00X0XXXX000000000 (e.g. 04T2RMMG210999969)
  const d = () => Math.floor(Math.random() * 10).toString();
  const c = () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  return `${d()}${d()}${c()}${d()}${c()}${c()}${c()}${c()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}`;
}

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
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

export default function ExameToxicologicoFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, string>; editDocId?: string } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const [form, setForm] = useState<ExameFormData>(() => {
    if (editState?.editFormData) return { ...initial, ...editState.editFormData } as ExameFormData;
    return initial;
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (field: keyof ExameFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (field === "cpf") value = formatCPF(value);
    if (field === "cnpj") value = formatCNPJ(value);
    setForm((p) => ({ ...p, [field]: value }));
  };

  const setDate = (field: keyof ExameFormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const fillTest = () => {
    const now = new Date();
    const coleta = new Date(now.getTime() - 5 * 86400000);
    const receb = new Date(now.getTime() - 3 * 86400000);
    const validade = new Date(now.getTime() + 60 * 86400000);
    setForm({
      clienteEmpresa: pick(EMPRESAS_TESTE),
      nomeCompleto: pick(NOMES_TESTE),
      laudo: generateLaudo(),
      cnpj: generateCNPJ(),
      cpf: generateCPF(),
      dataColeta: format(coleta, "dd/MM/yyyy"),
      dataRecebimento: format(receb, "dd/MM/yyyy"),
      dataResultado: format(now, "dd/MM/yyyy"),
      dataValidade: format(validade, "dd/MM/yyyy"),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const savedRaw = localStorage.getItem("exame-toxicologico-field-positions");
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
    navigate("/dashboard/documents/exame-toxicologico/preview", {
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
            <FlaskConical className="w-3.5 h-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Exame Toxicológico</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar o exame</p>

      <form onSubmit={handlePreview} className="space-y-6">
        {/* EMPRESA */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Building2} title="Dados da Empresa" />
          <div className="space-y-1.5">
            <FieldLabel>Cliente / Empresa</FieldLabel>
            <Input value={form.clienteEmpresa} onChange={set("clienteEmpresa")} placeholder="Ex: TRANSPORTADORA NORTE LTDA" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel required={false}>CNPJ (opcional)</FieldLabel>
            <Input value={form.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0000-00" className={inputCls} />
          </div>
        </div>

        {/* DADOS PESSOAIS */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />
          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: JOSE CARLOS DA SILVA" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>CPF</FieldLabel>
            <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel>Laudo Nº</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, laudo: generateLaudo() }))} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 h-7">
                <Shuffle className="w-3 h-3" /> Gerar Laudo Aleatório
              </Button>
            </div>
            <Input value={form.laudo} onChange={set("laudo")} placeholder="Ex: CNJ00494237" className={inputCls} required />
          </div>
        </div>

        {/* DATAS */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={CalendarIcon} title="Datas" />
          <div className="grid grid-cols-2 gap-4">
            <DateField label="Data de Coleta" value={form.dataColeta} onChange={setDate("dataColeta")} />
            <DateField label="Data de Recebimento" value={form.dataRecebimento} onChange={setDate("dataRecebimento")} />
            <DateField label="Data do Resultado" value={form.dataResultado} onChange={setDate("dataResultado")} />
            <DateField label="Data de Validade" value={form.dataValidade} onChange={setDate("dataValidade")} />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          <Eye className="w-5 h-5" /> Gerar Preview
        </Button>
      </form>
    </div>
  );
}
