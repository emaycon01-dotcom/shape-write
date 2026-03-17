import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, User, FileText, FlaskConical, Trash2, IdCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import testFotoUrl from "@/assets/test-foto.png";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const TIPO_LABELS: Record<string, string> = {
  bombeiro: "Carteira de Bombeiro",
  porteiro: "Carteira de Porteiro / Vigia",
  "agente-financeiro": "Carteira de Agente Financeiro",
};

interface CarteirinhaFormData {
  numeroRegistro: string;
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  cidade: string;
  uf: string;
  dataFormacao: string;
  contatoEmergencia1: string;
  contatoEmergencia2: string;
}

const initial: CarteirinhaFormData = {
  numeroRegistro: "",
  nomeCompleto: "",
  cpf: "",
  dataNascimento: "",
  cidade: "",
  uf: "",
  dataFormacao: "",
  contatoEmergencia1: "",
  contatoEmergencia2: "",
};

function generateRandom(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function randomDate(startYear: number, endYear: number) {
  const d = Math.floor(Math.random() * 28) + 1;
  const m = Math.floor(Math.random() * 12) + 1;
  const y = startYear + Math.floor(Math.random() * (endYear - startYear));
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

const NOMES = ["PEDRO DA SILVA GOMES", "MARIA OLIVEIRA SANTOS", "CARLOS FERREIRA LIMA", "ANA PAULA COSTA", "LUCAS RODRIGUES ALVES"];
const CIDADES = ["SÃO PAULO", "RIO DE JANEIRO", "BELO HORIZONTE", "CURITIBA", "SALVADOR"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function CarteirinhaFormPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState<CarteirinhaFormData>(initial);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  const tipoLabel = TIPO_LABELS[tipo || ""] || "Carteirinha";

  const set = (field: keyof CarteirinhaFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setFoto(null);
    setFotoPreview(null);
    if (fotoRef.current) fotoRef.current.value = "";
  };

  const imgToBase64 = async (url: string): Promise<string> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const fillTest = async () => {
    const uf = pick(UF_LIST);
    setForm({
      numeroRegistro: `${generateRandom(2)}.${generateRandom(3)}.${generateRandom(3)}/${generateRandom(4)}-${generateRandom(2)}`,
      nomeCompleto: pick(NOMES),
      cpf: `${generateRandom(3)}.${generateRandom(3)}.${generateRandom(3)}-${generateRandom(2)}`,
      dataNascimento: randomDate(1980, 2002),
      cidade: pick(CIDADES),
      uf,
      dataFormacao: randomDate(2015, 2024),
      contatoEmergencia1: `(${generateRandom(2)}) ${generateRandom(5)}-${generateRandom(4)}`,
      contatoEmergencia2: `(${generateRandom(2)}) ${generateRandom(5)}-${generateRandom(4)}`,
    });
    const fotoB64 = await imgToBase64(testFotoUrl);
    setFotoPreview(fotoB64);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    clearFile();
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    navigate(`/dashboard/documentos-fisicos/carteirinhas/${tipo}/preview`, {
      state: {
        formData: {
          ...form,
          tipo: tipo || "",
          tipoLabel,
          foto_base64: fotoPreview || "",
        },
      },
    });
  };

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";

  const FieldLabel = ({ children, required = true }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-sm font-semibold text-primary">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
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
        <button
          onClick={() => navigate("/dashboard/documentos-fisicos/carteirinhas")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
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

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">{tipoLabel}</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar a carteira</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Pessoais */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />

          <div className="space-y-1.5">
            <FieldLabel>Número de Registro</FieldLabel>
            <Input value={form.numeroRegistro} onChange={set("numeroRegistro")} placeholder="45.737.175/0001-14" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: PEDRO DA SILVA GOMES" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>CPF</FieldLabel>
            <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Data de Nascimento</FieldLabel>
              <Input value={form.dataNascimento} onChange={set("dataNascimento")} placeholder="DD/MM/AAAA" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data de Formação</FieldLabel>
              <Input value={form.dataFormacao} onChange={set("dataFormacao")} placeholder="DD/MM/AAAA" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Cidade</FieldLabel>
              <Input value={form.cidade} onChange={set("cidade")} placeholder="Ex: SÃO PAULO" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>UF</FieldLabel>
              <Select value={form.uf} onValueChange={(v) => setForm((p) => ({ ...p, uf: v }))}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Foto 3x4 */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={IdCard} title="Foto 3x4" />

          <div className="flex items-start gap-4">
            {fotoPreview ? (
              <div className="relative">
                <img src={fotoPreview} alt="Foto" className="w-24 h-32 object-cover rounded-lg border border-border" />
                <button
                  type="button"
                  onClick={clearFile}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="w-24 h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Upload</span>
                <input
                  ref={fotoRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Faça upload de uma foto 3x4 para a carteira. A imagem será exibida no preview e no PDF final.
            </p>
          </div>
        </div>

        {/* Contatos de Emergência */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={FileText} title="Contatos de Emergência" />

          <div className="space-y-1.5">
            <FieldLabel>Contato de Emergência 1</FieldLabel>
            <Input value={form.contatoEmergencia1} onChange={set("contatoEmergencia1")} placeholder="(00) 00000-0000" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Contato de Emergência 2</FieldLabel>
            <Input value={form.contatoEmergencia2} onChange={set("contatoEmergencia2")} placeholder="(00) 00000-0000" className={inputCls} />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold">
          <FileText className="w-5 h-5 mr-2" /> Gerar Documento
        </Button>
      </form>
    </div>
  );
}
