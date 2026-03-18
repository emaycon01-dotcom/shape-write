import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Wrench, Trash2, Eye, Upload, FileText, Clock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface FormData {
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string;
  data: string;
  hora: string;
}

const initial: FormData = {
  cpf: "",
  nomeCompleto: "",
  dataNascimento: "",
  data: "",
  hora: "",
};

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const NOMES = ["EMILY BARBOSA DO NASCIMENTO", "PEDRO DA SILVA GOMES", "MARIA OLIVEIRA SANTOS", "CARLOS FERREIRA LIMA", "ANA PAULA COSTA"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCpf(): string {
  const d = () => Math.floor(Math.random() * 10);
  const digits = Array.from({ length: 11 }, d).join("");
  return formatCpf(digits);
}

export default function CpfFisicoFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, string>; editDocId?: string } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const [form, setForm] = useState<FormData>(() => {
    if (editState?.editFormData) return { ...initial, ...editState.editFormData } as FormData;
    return initial;
  });
  const [nascDate, setNascDate] = useState<Date>();
  const [dataDate, setDataDate] = useState<Date>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === "cpf" ? formatCpf(e.target.value) : e.target.value;
    setForm((p) => ({ ...p, [field]: value }));
  };

  const fillTest = () => {
    const now = new Date();
    const nasc = new Date(1990, 0, 15);
    setNascDate(nasc);
    setDataDate(now);
    setForm({
      cpf: randomCpf(),
      nomeCompleto: pick(NOMES),
      dataNascimento: format(nasc, "dd/MM/yyyy"),
      data: format(now, "dd/MM/yyyy"),
      hora: format(now, "HH:mm"),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setNascDate(undefined);
    setDataDate(undefined);
    toast({ title: "Formulário limpo!" });
  };

  const setHoraAtual = () => {
    const now = format(new Date(), "HH:mm");
    setForm((p) => ({ ...p, hora: now }));
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const savedRaw = localStorage.getItem("cpf-fisico-field-positions");
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
    navigate("/dashboard/documentos-fisicos/carteirinhas/cpf-fisico/preview", {
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
        <button onClick={() => navigate("/dashboard/documentos-fisicos/carteirinhas")} className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <Wrench className="w-3.5 h-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">CPF Físico</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar o comprovante de CPF</p>

      <form onSubmit={handlePreview} className="space-y-6">
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />
          <div className="space-y-1.5">
            <FieldLabel>CPF</FieldLabel>
            <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" className={inputCls} required maxLength={14} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: EMILY BARBOSA DO NASCIMENTO" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Data de Nascimento</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", inputCls, !nascDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nascDate ? format(nascDate, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={nascDate}
                  onSelect={(d) => {
                    setNascDate(d);
                    if (d) setForm((p) => ({ ...p, dataNascimento: format(d, "dd/MM/yyyy") }));
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={FileText} title="Dados do Documento" />
          <div className="space-y-1.5">
            <FieldLabel>Data</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", inputCls, !dataDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataDate ? format(dataDate, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataDate}
                  onSelect={(d) => {
                    setDataDate(d);
                    if (d) setForm((p) => ({ ...p, data: format(d, "dd/MM/yyyy") }));
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel>Hora</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={setHoraAtual} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 h-7">
                <Clock className="w-3 h-3" /> Hora Atual
              </Button>
            </div>
            <Input type="time" value={form.hora} onChange={set("hora")} placeholder="14:35" className={inputCls} required />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          <Eye className="w-5 h-5" /> Gerar Preview
        </Button>
      </form>
    </div>
  );
}
