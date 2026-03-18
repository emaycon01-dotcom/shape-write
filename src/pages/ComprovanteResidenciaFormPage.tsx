import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, MapPin, FlaskConical, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

interface ComprovanteFormData {
  nomeCompleto: string;
  endereco: string;
  cidade: string;
  cep: string;
  estado: string;
  cpf: string;
}

const initial: ComprovanteFormData = {
  nomeCompleto: "",
  endereco: "",
  cidade: "",
  cep: "",
  estado: "",
  cpf: "",
};

const NOMES_TESTE = ["GREICE KELLY DA SILVA", "MARIA OLIVEIRA SANTOS", "CARLOS FERREIRA LIMA", "ANA PAULA COSTA"];
const ENDERECOS_TESTE = ["Rua das Flores, 123", "Av. Brasil, 456", "Rua São Paulo, 789", "Rua XV de Novembro, 321"];
const CIDADES_TESTE = ["SAO PAULO", "RIO DE JANEIRO", "BELO HORIZONTE", "CURITIBA", "SALVADOR"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateCPF(): string {
  const d = () => Math.floor(Math.random() * 10);
  return `${d()}${d()}${d()}.${d()}${d()}${d()}.${d()}${d()}${d()}-${d()}${d()}`;
}

function generateCEP(): string {
  const d = () => Math.floor(Math.random() * 10);
  return `${d()}${d()}${d()}${d()}${d()}-${d()}${d()}${d()}`;
}

export default function ComprovanteResidenciaFormPage() {
  const [form, setForm] = useState<ComprovanteFormData>(initial);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const set = (field: keyof ComprovanteFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const setSelect = (field: keyof ComprovanteFormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const fillTest = () => {
    const uf = pick(UF_LIST);
    setForm({
      nomeCompleto: pick(NOMES_TESTE),
      endereco: pick(ENDERECOS_TESTE),
      cidade: pick(CIDADES_TESTE),
      cep: generateCEP(),
      estado: uf,
      cpf: generateCPF(),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const savedRaw = localStorage.getItem("comprovante-residencia-field-positions");
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
    navigate("/dashboard/documents/comprovante-residencia/preview", {
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

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Comprovante de Residência</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar o comprovante</p>

      <form onSubmit={handlePreview} className="space-y-6">
        {/* DADOS PESSOAIS */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />

          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: GREICE KELLY DA SILVA" className={inputCls} required />
            <p className="text-[11px] text-muted-foreground">O nome aparecerá duas vezes no documento.</p>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>CPF</FieldLabel>
            <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" className={inputCls} required />
            <p className="text-[11px] text-muted-foreground">O CPF aparecerá em negrito no documento.</p>
          </div>
        </div>

        {/* ENDEREÇO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={MapPin} title="Endereço" />

          <div className="space-y-1.5">
            <FieldLabel>Endereço (Rua e Número)</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} placeholder="Ex: Rua Exemplo, 123" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Cidade</FieldLabel>
            <Input value={form.cidade} onChange={set("cidade")} placeholder="Ex: SAO PAULO" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>CEP</FieldLabel>
              <Input value={form.cep} onChange={set("cep")} placeholder="00000-000" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Estado</FieldLabel>
              <Select value={form.estado} onValueChange={setSelect("estado")}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="glass rounded-lg p-3 mt-2">
            <p className="text-xs text-muted-foreground mb-1">Preview do formato CEP/Cidade/Estado:</p>
            <p className="text-sm font-semibold text-foreground font-mono">
              {form.cep || "XXXXX-XXX"} {form.cidade || "CIDADE"} {form.estado || "UF"}
            </p>
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          <Eye className="w-5 h-5" /> Gerar Preview
        </Button>
      </form>
    </div>
  );
}
