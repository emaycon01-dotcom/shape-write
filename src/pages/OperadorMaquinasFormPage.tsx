import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Upload, X, User, FileText, FlaskConical, Trash2, IdCard, Loader2, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import testFotoUrl from "@/assets/test-foto.png";

const CATEGORIA_OPTIONS = ["A", "B", "C", "D", "E", "AB", "AD", "AE"];
const NIVEL_OPTIONS = ["1", "2", "3"];

interface FormData {
  nome: string;
  rgOrgaoUf: string;
  cpf: string;
  dataNascimento: Date | undefined;
  categoria: string;
  filiacao: string;
  equipamento: string;
  nivel: string;
  dataEmissao: Date | undefined;
  atualizacao: Date | undefined;
}

const initial: FormData = {
  nome: "",
  rgOrgaoUf: "",
  cpf: "",
  dataNascimento: undefined,
  categoria: "",
  filiacao: "",
  equipamento: "",
  nivel: "",
  dataEmissao: undefined,
  atualizacao: undefined,
};

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function generateRandom(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

const NOMES = ["PEDRO DA SILVA GOMES", "MARIA OLIVEIRA SANTOS", "CARLOS FERREIRA LIMA", "ANA PAULA COSTA", "LUCAS RODRIGUES ALVES"];
const EQUIPAMENTOS = ["Retroescavadeira", "Pá Carregadeira", "Escavadeira Hidráulica", "Motoniveladora", "Rolo Compactador"];
const FILIACOES = ["SOUZA E SOUZINHA", "SILVA E OLIVEIRA", "COSTA E PEREIRA", "SANTOS E FERREIRA"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFutureDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + Math.floor(Math.random() * 5) + 1);
  d.setMonth(Math.floor(Math.random() * 12));
  d.setDate(Math.floor(Math.random() * 28) + 1);
  return d;
}

function randomPastDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - Math.floor(Math.random() * 5) - 1);
  d.setMonth(Math.floor(Math.random() * 12));
  d.setDate(Math.floor(Math.random() * 28) + 1);
  return d;
}

export default function OperadorMaquinasFormPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState<FormData>(initial);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, cpf: formatCPF(e.target.value) }));
  };

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

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
    setForm({
      nome: pick(NOMES),
      rgOrgaoUf: `${generateRandom(2)}.${generateRandom(3)}.${generateRandom(3)} SSP SP`,
      cpf: formatCPF(generateRandom(11)),
      dataNascimento: randomPastDate(),
      categoria: pick(CATEGORIA_OPTIONS),
      filiacao: pick(FILIACOES),
      equipamento: pick(EQUIPAMENTOS),
      nivel: pick(NIVEL_OPTIONS),
      dataEmissao: randomPastDate(),
      atualizacao: randomFutureDate(),
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

  const formatDateBR = (date: Date | undefined) => date ? format(date, "dd/MM/yyyy") : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const templateRes = await fetch("/assets/template-carteira-operador-maquinas.pdf");
      const templateBlob = await templateRes.blob();
      const templateBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(templateBlob);
      });

      const versoStorageKey = "carteirinha-operador-maquinas-verso-field-positions";

      let fieldPositions = null;
      const savedVerso = localStorage.getItem(versoStorageKey);

      try {
        fieldPositions = savedVerso
          ? { verso: JSON.parse(savedVerso) }
          : null;
      } catch {
        fieldPositions = null;
      }

      const bodyData = {
        tipo: "operador-maquinas",
        nome_completo: form.nome,
        rg_orgao_uf: form.rgOrgaoUf,
        cpf: form.cpf,
        data_nascimento: formatDateBR(form.dataNascimento),
        categoria: form.categoria,
        filiacao: form.filiacao,
        equipamento: form.equipamento,
        nivel: form.nivel,
        data_emissao: formatDateBR(form.dataEmissao),
        data_validade: formatDateBR(form.atualizacao),
        foto_base64: fotoPreview || "",
        template_pdf_base64: templateBase64,
        field_positions: fieldPositions,
      };

      const { data, error } = await supabase.functions.invoke("generate-carteirinha-pdf", {
        body: bodyData,
      });

      if (error) throw error;

      const pdfResult = data?.pdfBase64;
      if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");

      navigate("/dashboard/documentos-fisicos/carteirinhas/operador-maquinas/preview", {
        state: {
          pdfBase64: pdfResult,
          formData: {
            tipo: "operador-maquinas",
            tipoLabel: "Carteira de Operador de Máquinas Pesadas",
            nomeCompleto: form.nome,
            cpf: form.cpf,
            rgOrgaoUf: form.rgOrgaoUf,
            dataNascimento: formatDateBR(form.dataNascimento),
            categoria: form.categoria,
            filiacao: form.filiacao,
            equipamento: form.equipamento,
            nivel: form.nivel,
            dataEmissao: formatDateBR(form.dataEmissao),
            dataValidade: formatDateBR(form.atualizacao),
            foto_base64: fotoPreview || "",
          },
        },
      });
    } catch (err: any) {
      console.error("Erro ao gerar PDF:", err);
      toast({
        title: "Erro ao gerar PDF",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

  const DatePickerField = ({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) => (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", inputCls, !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy") : "DD/MM/AAAA"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
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

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Carteira de Operador de Máquinas Pesadas</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar a carteira</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />

          <div className="space-y-1.5">
            <FieldLabel>Nome</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="Ex: PEDRO DA SILVA GOMES" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>RG / Órgão Emissor / UF</FieldLabel>
            <Input value={form.rgOrgaoUf} onChange={set("rgOrgaoUf")} placeholder="Ex: 12.345.678 SSP SP" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>CPF</FieldLabel>
              <Input value={form.cpf} onChange={handleCpfChange} placeholder="000.000.000-00" className={inputCls} required maxLength={14} />
            </div>
            <DatePickerField
              label="Data de Nascimento"
              value={form.dataNascimento}
              onChange={(d) => setForm(p => ({ ...p, dataNascimento: d }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Categoria</FieldLabel>
              <Select value={form.categoria} onValueChange={(v) => setForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIA_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Nível</FieldLabel>
              <Select value={form.nivel} onValueChange={(v) => setForm(p => ({ ...p, nivel: v }))}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {NIVEL_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Filiação</FieldLabel>
            <Input value={form.filiacao} onChange={set("filiacao")} placeholder="Ex: SOUZA E SOUZINHA" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Equipamento</FieldLabel>
            <Input value={form.equipamento} onChange={set("equipamento")} placeholder="Ex: Retroescavadeira, Pá carregadeira" className={inputCls} required />
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={FileText} title="Datas" />

          <div className="grid grid-cols-2 gap-4">
            <DatePickerField
              label="Data de Emissão"
              value={form.dataEmissao}
              onChange={(d) => setForm(p => ({ ...p, dataEmissao: d }))}
            />
            <DatePickerField
              label="Atualização (Validade)"
              value={form.atualizacao}
              onChange={(d) => setForm(p => ({ ...p, atualizacao: d }))}
            />
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

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando PDF...</>
          ) : (
            <><FileText className="w-5 h-5 mr-2" /> Gerar Documento</>
          )}
        </Button>
      </form>
    </div>
  );
}
