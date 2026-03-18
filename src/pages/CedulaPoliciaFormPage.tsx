import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Wrench, Trash2, Eye, Shuffle, Upload, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormData {
  matricula: string;
  nomeCompleto: string;
  rgEstado: string;
  registroData: string;
  tipoSanguineo: string;
  cmCategoria: string;
  fotoBase64: string;
}

const initial: FormData = {
  matricula: "",
  nomeCompleto: "",
  rgEstado: "",
  registroData: "",
  tipoSanguineo: "",
  cmCategoria: "",
  fotoBase64: "",
};

function generateRegistroData(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${num}. ${day}/${month}/${year}`;
}

const NOMES = ["PEDRO DA SILVA GOMES", "MARIA OLIVEIRA SANTOS", "CARLOS FERREIRA LIMA", "ANA PAULA COSTA", "LUCAS RODRIGUES ALVES"];
const TIPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function CedulaPoliciaFormPage() {
  const [form, setForm] = useState<FormData>(initial);
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
    setForm({
      matricula: `${Math.floor(1000000 + Math.random() * 9000000)}`.replace(/(\d)(\d{3})(\d{3})/, "$1.$2.$3"),
      nomeCompleto: pick(NOMES),
      rgEstado: `${Math.floor(1000000 + Math.random() * 9000000)} SDS/PE`,
      registroData: generateRegistroData(),
      tipoSanguineo: pick(TIPOS_SANGUINEOS),
      cmCategoria: `${Math.floor(100000 + Math.random() * 900000)}, XXXXXXXXXXXX / A, B, AB, AD, AE`,
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
    const savedRaw = localStorage.getItem("cedula-policia-pe-field-positions");
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
    navigate("/dashboard/documentos-fisicos/carteirinhas/cedula-policia-pe/preview", {
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

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Cédula de Polícia Militar de Pernambuco</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar a cédula</p>

      <form onSubmit={handlePreview} className="space-y-6">
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />
          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: PEDRO DA SILVA GOMES" className={inputCls} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Matrícula</FieldLabel>
              <Input value={form.matricula} onChange={set("matricula")} placeholder="Ex: 7.878.786" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>RG e Estado</FieldLabel>
              <Input value={form.rgEstado} onChange={set("rgEstado")} placeholder="Ex: 1234567 SDS/PE" className={inputCls} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Tipo Sanguíneo</FieldLabel>
            <Select value={form.tipoSanguineo} onValueChange={(v) => setForm(p => ({ ...p, tipoSanguineo: v }))}>
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Selecione o tipo sanguíneo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_SANGUINEOS.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Shield} title="Dados do Documento" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel>Nº de Registro e Data</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, registroData: generateRegistroData() }))} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 h-7">
                <Shuffle className="w-3 h-3" /> Gerar Aleatório
              </Button>
            </div>
            <Input value={form.registroData} onChange={set("registroData")} placeholder="Ex: 8976. 24/02/2026" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>CM / Categoria</FieldLabel>
            <Input value={form.cmCategoria} onChange={set("cmCategoria")} placeholder="Ex: NÚMERO, XXXXXXXXXXXX / A, B, AB, AD, AE" className={inputCls} required />
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
