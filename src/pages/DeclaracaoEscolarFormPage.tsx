import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, School, Wrench, Trash2, Eye, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const ESTADO_NOMES: Record<string, string> = {
  AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MT:"Mato Grosso",MS:"Mato Grosso do Sul",MG:"Minas Gerais",PA:"Pará",PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",RR:"Roraima",SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins",
};

export interface DeclaracaoEscolarFormData {
  nomeCompleto: string;
  rg: string;
  nomeEscola: string;
  dataNascimento: string;
  municipio: string;
  estado: string;
}

const initial: DeclaracaoEscolarFormData = {
  nomeCompleto: "",
  rg: "",
  nomeEscola: "",
  dataNascimento: "",
  municipio: "",
  estado: "",
};

export default function DeclaracaoEscolarFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, any>; editDocId?: string } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const [form, setForm] = useState<DeclaracaoEscolarFormData>(() => {
    if (editState?.editFormData) {
      return { ...initial, ...editState.editFormData } as DeclaracaoEscolarFormData;
    }
    return initial;
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (field: keyof DeclaracaoEscolarFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const setSelect = (field: keyof DeclaracaoEscolarFormData) => (value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const fillTest = () => {
    setForm({
      nomeCompleto: "CARLOS EDUARDO DA SILVA",
      rg: "12.345.678-9",
      nomeEscola: "ESCOLA ESTADUAL PROF. JOÃO REIS",
      dataNascimento: "03/04/1995",
      municipio: "RECIFE",
      estado: "PE",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const savedRaw = localStorage.getItem("declaracao-escolar-field-positions");
    let fieldPositions: Record<string, { x: number; y: number; fontSize: number }> | null = null;
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) {
          fieldPositions = parsed.reduce((acc: any, f: any) => { acc[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize }; return acc; }, {});
        } else {
          fieldPositions = parsed;
        }
      } catch { /* ignore */ }
    }
    navigate("/dashboard/documents/declaracao-escolar/preview", {
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
        <button onClick={() => navigate("/dashboard/documents")} className="text-sm text-muted-foreground hover:text-foreground">← Voltar</button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <Wrench className="w-3.5 h-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Declaração Escolar</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar a declaração de conclusão escolar</p>

      <form onSubmit={handlePreview} className="space-y-6">
        {/* DADOS DO ALUNO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados do Aluno" />
          <div className="space-y-1.5">
            <FieldLabel>Nome Completo</FieldLabel>
            <Input value={form.nomeCompleto} onChange={set("nomeCompleto")} placeholder="Ex: CARLOS EDUARDO DA SILVA" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>RG</FieldLabel>
            <Input value={form.rg} onChange={set("rg")} placeholder="Ex: 12.345.678-9" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Data de Nascimento</FieldLabel>
            <Input value={form.dataNascimento} onChange={set("dataNascimento")} placeholder="DD/MM/AAAA" className={inputCls} required />
          </div>
        </div>

        {/* DADOS DA ESCOLA */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={School} title="Dados da Escola / Local" />
          <div className="space-y-1.5">
            <FieldLabel>Nome da Escola</FieldLabel>
            <Input value={form.nomeEscola} onChange={set("nomeEscola")} placeholder="Ex: ESCOLA ESTADUAL PROF. JOÃO REIS" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Município</FieldLabel>
            <Input value={form.municipio} onChange={set("municipio")} placeholder="Ex: SÃO PAULO (em extenso)" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Estado</FieldLabel>
            <Select value={form.estado} onValueChange={setSelect("estado")}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf} - {ESTADO_NOMES[uf]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.estado && (
              <p className="text-xs text-muted-foreground">Será exibido como: {ESTADO_NOMES[form.estado]?.toUpperCase()}</p>
            )}
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          {isEditMode ? <><RefreshCw className="w-5 h-5" /> Atualizar</> : <><Eye className="w-5 h-5" /> Gerar Preview</>}
        </Button>
      </form>
    </div>
  );
}
