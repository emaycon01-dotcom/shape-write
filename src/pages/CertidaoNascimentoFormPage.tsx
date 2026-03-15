import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, FileText, Sparkles, Trash2, FlaskConical, Users, Baby, Calendar, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import templateUrl from "@/assets/template-certidao-nascimento.jpg";

const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const CIDADES_POR_UF: Record<string, string[]> = {
  SP: ["São Paulo","Campinas","Santos","Guarulhos"],
  RJ: ["Rio de Janeiro","Niterói","Petrópolis"],
  MG: ["Belo Horizonte","Uberlândia","Juiz de Fora"],
  BA: ["Salvador","Feira de Santana","Ilhéus"],
  PR: ["Curitiba","Londrina","Maringá"],
  PE: ["Recife","Olinda","Caruaru"],
  RS: ["Porto Alegre","Caxias do Sul","Pelotas"],
  CE: ["Fortaleza","Juazeiro do Norte"],
  PA: ["Belém","Santarém"],
  GO: ["Goiânia","Anápolis"],
  SC: ["Florianópolis","Joinville","Blumenau"],
  AM: ["Manaus"],
  DF: ["Brasília"],
};

function formatMatricula(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 32);
  if (d.length < 32) return d;
  // XXXXXX XX XX XXXX X XXXXX XXX XXXXXXX XX
  return `${d.slice(0,6)} ${d.slice(6,8)} ${d.slice(8,10)} ${d.slice(10,14)} ${d.slice(14,15)} ${d.slice(15,20)} ${d.slice(20,23)} ${d.slice(23,30)} ${d.slice(30,32)}`;
}

function generateRandomMatricula(): string {
  const digits = Array.from({ length: 32 }, () => Math.floor(Math.random() * 10)).join("");
  return formatMatricula(digits);
}

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const ESPECIAIS = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function numberToWords(n: number): string {
  if (n === 0) return "zero";
  if (n === 100) return "cem";
  if (n < 10) return UNIDADES[n];
  if (n < 20) return ESPECIAIS[n - 10];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const rest = n % 100;
    if (rest === 0) return n === 100 ? "cem" : CENTENAS[c];
    return `${CENTENAS[c]} e ${numberToWords(rest)}`;
  }
  if (n < 1000000) {
    const mil = Math.floor(n / 1000);
    const rest = n % 1000;
    const milStr = mil === 1 ? "mil" : `${numberToWords(mil)} mil`;
    if (rest === 0) return milStr;
    return `${milStr} e ${numberToWords(rest)}`;
  }
  return String(n);
}

function dateToExtenso(dateStr: string): string {
  // expects DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length !== 3) return "";
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return "";
  return `${numberToWords(day)} de ${MESES[month - 1]} de ${numberToWords(year)}`;
}

interface CertidaoFormData {
  nomeCompleto: string;
  cpf: string;
  matricula: string;
  dataNascimento: string;
  dataNascimentoExtenso: string;
  horaNascimento: string;
  naturalidade: string;
  federacao: string;
  localNascimento: string;
  municipioNascimento: string;
  estadoNascimento: string;
  sexo: string;
  nomeMae: string;
  nomePai: string;
  avoMaterna: string;
  avoMaterno: string;
  avoPaterna: string;
  avoPaterno: string;
  gemeos: string;
  municipioRegistro: string;
  ufRegistro: string;
  dataRegistroExtenso: string;
}

const initial: CertidaoFormData = {
  nomeCompleto: "", cpf: "", matricula: "",
  dataNascimento: "", dataNascimentoExtenso: "",
  horaNascimento: "", naturalidade: "", federacao: "",
  localNascimento: "", municipioNascimento: "", estadoNascimento: "",
  sexo: "", nomeMae: "", nomePai: "",
  avoMaterna: "", avoMaterno: "", avoPaterna: "", avoPaterno: "",
  gemeos: "NÃO", dataRegistroExtenso: "",
};

const NOMES_TESTE = ["PEDRO DA SILVA GOMES","MARIA OLIVEIRA SANTOS","CARLOS FERREIRA LIMA","ANA PAULA COSTA"];
const PAIS_TESTE = ["JOSE DA SILVA","ANTONIO FERREIRA","MARCOS OLIVEIRA"];
const MAES_TESTE = ["MARIA DA SILVA","ANA FERREIRA","CLAUDIA OLIVEIRA"];
const AVOS_TESTE = ["FRANCISCO SILVA","ANTONIA FERREIRA","ROSA OLIVEIRA","MANUEL COSTA","HELENA SANTOS","JOAQUIM LIMA"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function randomDate(startYear: number, endYear: number) {
  const d = Math.floor(Math.random() * 28) + 1;
  const m = Math.floor(Math.random() * 12) + 1;
  const y = startYear + Math.floor(Math.random() * (endYear - startYear));
  return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
}

function generateCPF(): string {
  const d = () => Math.floor(Math.random() * 10);
  return `${d()}${d()}${d()}.${d()}${d()}${d()}.${d()}${d()}${d()}-${d()}${d()}`;
}

export default function CertidaoNascimentoFormPage() {
  const [form, setForm] = useState<CertidaoFormData>(initial);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const set = (field: keyof CertidaoFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const setSelect = (field: keyof CertidaoFormData) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const handleDataNascimentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm(p => ({
      ...p,
      dataNascimento: val,
      dataNascimentoExtenso: dateToExtenso(val),
    }));
  };

  const handleMatriculaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 32);
    setForm(p => ({ ...p, matricula: raw.length === 32 ? formatMatricula(raw) : raw }));
  };

  const generateMatricula = () => {
    setForm(p => ({ ...p, matricula: generateRandomMatricula() }));
  };

  const handleFederacaoChange = (uf: string) => {
    const cidades = CIDADES_POR_UF[uf];
    setForm(p => ({
      ...p,
      federacao: uf,
      estadoNascimento: uf,
      naturalidade: cidades ? cidades[0] : p.naturalidade,
      municipioNascimento: cidades ? cidades[0] : p.municipioNascimento,
    }));
  };

  const fillTest = () => {
    const uf = pick(UF_LIST);
    const cidade = (CIDADES_POR_UF[uf] || ["Cidade Teste"])[0];
    const dataNasc = randomDate(1990, 2020);
    const dataReg = randomDate(2020, 2024);
    setForm({
      nomeCompleto: pick(NOMES_TESTE),
      cpf: generateCPF(),
      matricula: generateRandomMatricula(),
      dataNascimento: dataNasc,
      dataNascimentoExtenso: dateToExtenso(dataNasc),
      horaNascimento: `${String(Math.floor(Math.random()*24)).padStart(2,"0")}:${String(Math.floor(Math.random()*60)).padStart(2,"0")}`,
      naturalidade: cidade,
      federacao: uf,
      localNascimento: pick(["Hospital Municipal","Maternidade Santa Casa","Hospital Regional"]),
      municipioNascimento: cidade,
      estadoNascimento: uf,
      sexo: pick(["MASCULINO","FEMININO"]),
      nomeMae: pick(MAES_TESTE),
      nomePai: pick(PAIS_TESTE),
      avoMaterna: pick(AVOS_TESTE),
      avoMaterno: pick(AVOS_TESTE),
      avoPaterna: pick(AVOS_TESTE),
      avoPaterno: pick(AVOS_TESTE),
      gemeos: "NÃO",
      dataRegistroExtenso: dateToExtenso(dataReg),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    // Get saved alignment positions
    const savedPositions = localStorage.getItem("certidao-field-positions");
    navigate("/dashboard/documents/certidao-nascimento/preview", {
      state: {
        formData: form,
        templateUrl,
        fieldPositions: savedPositions ? JSON.parse(savedPositions) : null,
      },
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

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Certidão de Nascimento</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar a certidão</p>

      <form onSubmit={handlePreview} className="space-y-6">
        {/* DADOS PESSOAIS */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados Pessoais" />

          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: PEDRO DA SILVA GOMES" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>CPF</FieldLabel>
            <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Matrícula (32 dígitos)</FieldLabel>
            <div className="flex gap-2">
              <Input value={form.matricula} onChange={handleMatriculaChange} placeholder="000000 00 00 0000 0 00000 000 0000000 00" className={`${inputCls} flex-1 font-mono`} required />
              <Button type="button" variant="outline" size="sm" onClick={generateMatricula} className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                <Sparkles className="w-3.5 h-3.5" /> Gerar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Formato: XXXXXX XX XX XXXX X XXXXX XXX XXXXXXX XX</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Sexo</FieldLabel>
              <Select value={form.sexo} onValueChange={setSelect("sexo")}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MASCULINO">Masculino</SelectItem>
                  <SelectItem value="FEMININO">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Gêmeos</FieldLabel>
              <Select value={form.gemeos} onValueChange={setSelect("gemeos")}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIM">Sim</SelectItem>
                  <SelectItem value="NÃO">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* NASCIMENTO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Calendar} title="Nascimento" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Data de Nascimento</FieldLabel>
              <Input value={form.dataNascimento} onChange={handleDataNascimentoChange} placeholder="DD/MM/AAAA" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Hora do Nascimento</FieldLabel>
              <Input value={form.horaNascimento} onChange={set("horaNascimento")} placeholder="HH:MM" className={inputCls} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Data de Nascimento (por extenso)</FieldLabel>
            <Input value={form.dataNascimentoExtenso} onChange={set("dataNascimentoExtenso")} placeholder="Preenchido automaticamente" className={`${inputCls} italic`} readOnly />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Naturalidade (Cidade)</FieldLabel>
              <Input value={form.naturalidade} onChange={set("naturalidade")} placeholder="Ex: Rio de Janeiro" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Federação (UF)</FieldLabel>
              <Select value={form.federacao} onValueChange={handleFederacaoChange}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Local de Nascimento (Hospital)</FieldLabel>
            <Input value={form.localNascimento} onChange={set("localNascimento")} placeholder="Ex: Hospital Municipal" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Município de Nascimento</FieldLabel>
              <Input value={form.municipioNascimento} onChange={set("municipioNascimento")} placeholder="Ex: Rio de Janeiro" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Estado de Nascimento</FieldLabel>
              <Select value={form.estadoNascimento} onValueChange={setSelect("estadoNascimento")}>
                <SelectTrigger className={inputCls}><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UF_LIST.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* FILIAÇÃO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Users} title="Filiação" />

          <div className="space-y-1.5">
            <FieldLabel>Nome da Mãe</FieldLabel>
            <Input value={form.nomeMae} onChange={set("nomeMae")} placeholder="Nome completo da mãe" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Nome do Pai</FieldLabel>
            <Input value={form.nomePai} onChange={set("nomePai")} placeholder="Nome completo do pai" className={inputCls} required />
          </div>
        </div>

        {/* AVÓS */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Baby} title="Avós" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Avó Materna</FieldLabel>
              <Input value={form.avoMaterna} onChange={set("avoMaterna")} placeholder="Nome da avó materna" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Avô Materno</FieldLabel>
              <Input value={form.avoMaterno} onChange={set("avoMaterno")} placeholder="Nome do avô materno" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Avó Paterna</FieldLabel>
              <Input value={form.avoPaterna} onChange={set("avoPaterna")} placeholder="Nome da avó paterna" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Avô Paterno</FieldLabel>
              <Input value={form.avoPaterno} onChange={set("avoPaterno")} placeholder="Nome do avô paterno" className={inputCls} />
            </div>
          </div>
        </div>

        {/* REGISTRO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={FileText} title="Registro" />

          <div className="space-y-1.5">
            <FieldLabel>Data do Registro (por extenso)</FieldLabel>
            <Input value={form.dataRegistroExtenso} onChange={set("dataRegistroExtenso")} placeholder="Ex: cinco de março de dois mil e vinte e quatro" className={inputCls} required />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          <Eye className="w-5 h-5" /> Pré-visualizar Certidão
        </Button>
      </form>
    </div>
  );
}
