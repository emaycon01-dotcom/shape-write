import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, School, FileText, Eye, Wrench, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ESTADO_NOMES } from "@/lib/brasoes-estados";

const ESTADOS = Object.keys(ESTADO_NOMES);

export interface CertificadoEscolarFormData {
  estado: string;
  nomeEscola: string;
  enderecoEscola: string;
  nomeCompleto: string;
  rg: string;
  dataNascimento: string;
  estadoCidade: string;
  nomePai: string;
  nomeMae: string;
  anoFinalizacao: string;
}

const initial: CertificadoEscolarFormData = {
  estado: "",
  nomeEscola: "",
  enderecoEscola: "",
  nomeCompleto: "",
  rg: "",
  dataNascimento: "",
  estadoCidade: "",
  nomePai: "",
  nomeMae: "",
  anoFinalizacao: "",
};

export default function CertificadoEscolarFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, any>; editDocId?: string } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const [form, setForm] = useState<CertificadoEscolarFormData>(() => {
    if (editState?.editFormData) return { ...initial, ...editState.editFormData } as CertificadoEscolarFormData;
    return initial;
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (field: keyof CertificadoEscolarFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const setSelect = (field: keyof CertificadoEscolarFormData) => (value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const fillTest = () => {
    setForm({
      estado: "SP",
      nomeEscola: "ESCOLA ESTADUAL PROF. JOÃO REIS",
      enderecoEscola: "Rua das Flores, 123 - Centro, São Paulo - SP",
      nomeCompleto: "CARLOS EDUARDO DA SILVA",
      rg: "12.345.678-9",
      dataNascimento: "03/04/1995",
      estadoCidade: "SP/CAMPINAS",
      nomePai: "JOSE CARLOS DA SILVA",
      nomeMae: "MARIA SANTOS DA SILVA",
      anoFinalizacao: "2022",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const savedRaw = localStorage.getItem("certificado-escolar-field-positions");
    let fieldPositions: Record<string, { x: number; y: number; fontSize: number }> | null = null;
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) {
          fieldPositions = parsed.reduce((acc: any, f: any) => { acc[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize, w: f.w, h: f.h }; return acc; }, {});
        } else {
          fieldPositions = parsed;
        }
      } catch { /* ignore */ }
    }
    navigate("/dashboard/documents/certificado-escolar/preview", {
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

  const estadoExtenso = form.estado ? (ESTADO_NOMES[form.estado] || form.estado) : "";

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

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Certificado Escolar</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar o certificado escolar</p>

      <form onSubmit={handlePreview} className="space-y-6">
        {/* ESTADO + BRASÃO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={FileText} title="Estado" />
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
            {estadoExtenso && (
              <p className="text-xs text-muted-foreground">
                Brasão de <span className="font-semibold text-primary">{estadoExtenso}</span> será adicionado automaticamente. Aparecerá 2x no PDF.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Ano de Finalização</FieldLabel>
            <Input value={form.anoFinalizacao} onChange={set("anoFinalizacao")} placeholder="Ex: 2022" className={inputCls} required />
          </div>
        </div>

        {/* DADOS DA ESCOLA */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={School} title="Dados da Escola" />
          <div className="space-y-1.5">
            <FieldLabel>Nome da Escola</FieldLabel>
            <Input value={form.nomeEscola} onChange={set("nomeEscola")} placeholder="Ex: ESCOLA ESTADUAL PROF. JOÃO REIS" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Endereço da Escola</FieldLabel>
            <Input value={form.enderecoEscola} onChange={set("enderecoEscola")} placeholder="Ex: Rua das Flores, 123 - Centro" className={inputCls} required />
          </div>
        </div>

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
          <div className="space-y-1.5">
            <FieldLabel>Estado / Cidade</FieldLabel>
            <Input value={form.estadoCidade} onChange={set("estadoCidade")} placeholder="Ex: SP/CAMPINAS" className={inputCls} required />
          </div>
        </div>

        {/* FILIAÇÃO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Filiação" />
          <div className="space-y-1.5">
            <FieldLabel>Nome do Pai</FieldLabel>
            <Input value={form.nomePai} onChange={set("nomePai")} placeholder="Ex: JOSE CARLOS DA SILVA" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nome da Mãe</FieldLabel>
            <Input value={form.nomeMae} onChange={set("nomeMae")} placeholder="Ex: MARIA SANTOS DA SILVA" className={inputCls} required />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          {isEditMode ? <><RefreshCw className="w-5 h-5" /> Atualizar</> : <><Eye className="w-5 h-5" /> Gerar Preview</>}
        </Button>
      </form>
    </div>
  );
}
