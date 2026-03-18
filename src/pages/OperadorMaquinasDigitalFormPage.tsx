import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Wrench, Trash2, Eye, Shuffle, Calendar as CalendarIcon, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FormData {
  nomeCompleto: string;
  rg: string;
  ferramenta: string;
  numeroRegistro: string;
  validade: string;
  exameMedico: string;
  fotoBase64: string;
}

const initial: FormData = {
  nomeCompleto: "",
  rg: "",
  ferramenta: "",
  numeroRegistro: "",
  validade: "",
  exameMedico: "",
  fotoBase64: "",
};

function generateRegistro(): string {
  const digits = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letters = chars[Math.floor(Math.random() * 26)] + chars[Math.floor(Math.random() * 26)];
  return digits + letters;
}

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

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

export default function OperadorMaquinasDigitalFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, string> } | null;
  const [form, setForm] = useState<FormData>(() => {
    if (editState?.editFormData) return { ...initial, ...editState.editFormData } as FormData;
    return initial;
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
  };

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
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const mesIdx = futureDate.getMonth();
    setForm({
      nomeCompleto: "AGEU PEREIRA DA SILVA",
      rg: "12.345.678-9",
      ferramenta: "Retroescavadeira",
      numeroRegistro: generateRegistro(),
      validade: `${MESES[mesIdx]}/${futureDate.getFullYear()}`,
      exameMedico: "XR-11.1.6.1-ASO ANUAL",
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
    const savedRaw = localStorage.getItem("operador-maquinas-digital-field-positions");
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
    navigate("/dashboard/documentos-fisicos/carteirinhas/operador-maquinas-digital/preview", {
      state: { formData: form, fieldPositions },
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

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Carteira de Máquinas Pesadas Digital</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar a carteira digital</p>

      <form onSubmit={handlePreview} className="space-y-6">
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />
          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: AGEU PEREIRA DA SILVA" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>RG</FieldLabel>
            <Input value={form.rg} onChange={set("rg")} placeholder="Ex: 12.345.678-9" className={inputCls} required />
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Wrench} title="Dados do Documento" />
          <div className="space-y-1.5">
            <FieldLabel>Ferramenta</FieldLabel>
            <Input value={form.ferramenta} onChange={set("ferramenta")} placeholder="Ex: Retroescavadeira" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel>Número de Registro</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, numeroRegistro: generateRegistro() }))} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 h-7">
                <Shuffle className="w-3 h-3" /> Gerar Número Aleatório
              </Button>
            </div>
            <Input value={form.numeroRegistro} onChange={set("numeroRegistro")} placeholder="Ex: 12345678901AB" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Validade</FieldLabel>
            <Input value={form.validade} onChange={set("validade")} placeholder="Ex: FEVEREIRO/2027" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Exame Médico</FieldLabel>
            <Input value={form.exameMedico} onChange={set("exameMedico")} placeholder="Ex: XR-11.1.6.1-ASO ANUAL" className={inputCls} required />
          </div>
        </div>

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
          <Eye className="w-5 h-5" /> Gerar Preview
        </Button>
      </form>
    </div>
  );
}
