import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Anchor, Trash2, Eye, Shuffle, Calendar as CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FormData {
  nomeCompleto: string;
  dataNascimento: string;
  rgOrgaoUf: string;
  cpf: string;
  inscricao: string;
  localEmissao: string;
  validade: string;
}

const initial: FormData = {
  nomeCompleto: "",
  dataNascimento: "",
  rgOrgaoUf: "",
  cpf: "",
  inscricao: "",
  localEmissao: "CAPITANIA DOS PORTOS DE SÃO PAULO",
  validade: "",
};

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function generateInscricao(): string {
  const d = () => Math.floor(Math.random() * 10);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  return `${d()}${d()}${d()}${pick()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}${d()}`;
}

function randomCpf(): string {
  const d = () => Math.floor(Math.random() * 10);
  const digits = Array.from({ length: 11 }, d).join("");
  return formatCpf(digits);
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

export default function CnhNauticaFormPage() {
  const [form, setForm] = useState<FormData>(initial);
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === "cpf" ? formatCpf(e.target.value) : e.target.value;
    setForm((p) => ({ ...p, [field]: value }));
  };

  const setDate = (field: keyof FormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));


  const fillTest = () => {
    const now = new Date();
    const nasc = new Date(1990, 0, 15);
    const validade = new Date(now.getTime() + 365 * 5 * 86400000);
    setForm({
      nomeCompleto: "CARLOS EDUARDO DA SILVA",
      dataNascimento: format(nasc, "dd/MM/yyyy"),
      rgOrgaoUf: "12345678 SSP/SP",
      cpf: randomCpf(),
      inscricao: generateInscricao(),
      localEmissao: "CAPITANIA DOS PORTOS DE SÃO PAULO",
      validade: format(validade, "dd/MM/yyyy"),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const savedRaw = localStorage.getItem("cnh-nautica-field-positions");
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
    navigate("/dashboard/documentos-fisicos/carteirinhas/cnh-nautica/preview", {
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
            <Anchor className="w-3.5 h-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Arrais Amador Físico</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar a Carteira de Arrais Amador</p>

      <form onSubmit={handlePreview} className="space-y-6">
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />
          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: CARLOS EDUARDO DA SILVA" className={inputCls} required />
          </div>
          <DateField label="Data de Nascimento" value={form.dataNascimento} onChange={setDate("dataNascimento")} />
          <div className="space-y-1.5">
            <FieldLabel>RG / Órgão Emissor / UF</FieldLabel>
            <Input value={form.rgOrgaoUf} onChange={set("rgOrgaoUf")} placeholder="Ex: 123456 SSP/SP" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>CPF</FieldLabel>
            <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" className={inputCls} required maxLength={14} />
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Anchor} title="Dados do Documento" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel>Inscrição</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, inscricao: generateInscricao() }))} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 h-7">
                <Shuffle className="w-3 h-3" /> Gerar Aleatório
              </Button>
            </div>
            <Input value={form.inscricao} onChange={set("inscricao")} placeholder="Ex: 215A2023852176" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Local da Emissão</FieldLabel>
            <Input value={form.localEmissao} onChange={set("localEmissao")} placeholder="Ex: CAPITANIA DOS PORTOS DE SÃO PAULO" className={inputCls} required />
          </div>
          <DateField label="Validade" value={form.validade} onChange={setDate("validade")} />
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          <Eye className="w-5 h-5" /> Gerar Preview
        </Button>
      </form>
    </div>
  );
}
