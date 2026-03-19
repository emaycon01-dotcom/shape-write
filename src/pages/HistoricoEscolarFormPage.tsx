import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, School, GraduationCap, Award, Wrench, Trash2, Eye, RefreshCw, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const ESTADO_NOMES: Record<string, string> = {
  AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MT:"Mato Grosso",MS:"Mato Grosso do Sul",MG:"Minas Gerais",PA:"Pará",PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",RR:"Roraima",SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins",
};

interface EnsinoMedioEntry {
  ano: string;
  escola: string;
  ufMunicipio: string;
}

export interface HistoricoFormData {
  // Sessão 1 - Escola
  estadoEscola: string;
  enderecoNumero: string;
  bairroMunicipioCep: string;
  telefone: string;
  // Sessão 2 - Aluno
  nomeAluno: string;
  dataNascimento: string;
  nomeMae: string;
  estadoAluno: string;
  rg: string;
  // Sessão 3 - Escolares
  anoEnsinoFundamental: string;
  escolaEnsinoFundamental: string;
  ufMunicipioFundamental: string;
  ensinoMedio: EnsinoMedioEntry[];
  // Sessão 4 - Conclusão
  escolaConclusao: string;
  nomeConcludente: string;
  anoFinalizacao: string;
}

const initialMedio: EnsinoMedioEntry = { ano: "", escola: "", ufMunicipio: "" };

const initial: HistoricoFormData = {
  estadoEscola: "",
  enderecoNumero: "",
  bairroMunicipioCep: "",
  telefone: "",
  nomeAluno: "",
  dataNascimento: "",
  nomeMae: "",
  estadoAluno: "",
  rg: "",
  anoEnsinoFundamental: "",
  escolaEnsinoFundamental: "",
  ufMunicipioFundamental: "",
  ensinoMedio: [{ ...initialMedio }],
  escolaConclusao: "",
  nomeConcludente: "",
  anoFinalizacao: "",
};

export default function HistoricoEscolarFormPage() {
  const location = useLocation();
  const editState = location.state as { editFormData?: Record<string, any>; editDocId?: string } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const [form, setForm] = useState<HistoricoFormData>(() => {
    if (editState?.editFormData) {
      const ed = editState.editFormData;
      return {
        ...initial,
        ...ed,
        ensinoMedio: ed.ensinoMedio || [{ ...initialMedio }],
      } as HistoricoFormData;
    }
    return initial;
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const set = (field: keyof HistoricoFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const setSelect = (field: keyof HistoricoFormData) => (value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const updateMedio = (idx: number, key: keyof EnsinoMedioEntry, value: string) => {
    setForm((p) => {
      const arr = [...p.ensinoMedio];
      arr[idx] = { ...arr[idx], [key]: value };
      return { ...p, ensinoMedio: arr };
    });
  };

  const addMedio = () => {
    if (form.ensinoMedio.length >= 3) return;
    setForm((p) => ({ ...p, ensinoMedio: [...p.ensinoMedio, { ...initialMedio }] }));
  };

  const removeMedio = (idx: number) => {
    if (form.ensinoMedio.length <= 1) return;
    setForm((p) => ({ ...p, ensinoMedio: p.ensinoMedio.filter((_, i) => i !== idx) }));
  };

  const fillTest = () => {
    setForm({
      estadoEscola: "AL",
      enderecoNumero: "Rua José Maria, 123",
      bairroMunicipioCep: "Centro / Batalha / 57420-000",
      telefone: "(82) 3234-5678",
      nomeAluno: "CARLOS EDUARDO DA SILVA",
      dataNascimento: "03/04/1995",
      nomeMae: "MARIA DA SILVA SANTOS",
      estadoAluno: "AL",
      rg: "69/4939",
      anoEnsinoFundamental: "9º ANO - 2019",
      escolaEnsinoFundamental: "Escola Municipal São José",
      ufMunicipioFundamental: "AL / Batalha",
      ensinoMedio: [
        { ano: "2020", escola: "Escola Estadual Prof. João Reis", ufMunicipio: "AL / Batalha" },
        { ano: "2021", escola: "Escola Estadual Prof. João Reis", ufMunicipio: "AL / Batalha" },
        { ano: "2022", escola: "Escola Estadual Prof. João Reis", ufMunicipio: "AL / Batalha" },
      ],
      escolaConclusao: "Escola Estadual Prof. João Reis",
      nomeConcludente: "CARLOS EDUARDO DA SILVA",
      anoFinalizacao: "2015",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const savedRaw = localStorage.getItem("historico-escolar-field-positions");
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
    navigate("/dashboard/documents/historico-escolar/preview", {
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

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Histórico Escolar</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados para gerar o histórico escolar</p>

      <form onSubmit={handlePreview} className="space-y-6">
        {/* SESSÃO 1 - DADOS DA ESCOLA */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={School} title="Dados da Escola" />
          <div className="space-y-1.5">
            <FieldLabel>Estado</FieldLabel>
            <Select value={form.estadoEscola} onValueChange={setSelect("estadoEscola")}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf} - {ESTADO_NOMES[uf]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.estadoEscola && (
              <p className="text-xs text-muted-foreground">Brasão de {ESTADO_NOMES[form.estadoEscola]} será adicionado automaticamente ao PDF</p>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Endereço / Número</FieldLabel>
            <Input value={form.enderecoNumero} onChange={set("enderecoNumero")} placeholder="Ex: Rua José Maria, 123" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Bairro / Município / CEP</FieldLabel>
            <Input value={form.bairroMunicipioCep} onChange={set("bairroMunicipioCep")} placeholder="Ex: Centro / Batalha / 57420-000" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Telefone</FieldLabel>
            <Input value={form.telefone} onChange={set("telefone")} placeholder="(82) 3234-5678" className={inputCls} required />
          </div>
        </div>

        {/* SESSÃO 2 - DADOS DO ALUNO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={User} title="Dados do Aluno" />
          <div className="space-y-1.5">
            <FieldLabel>Nome do Aluno</FieldLabel>
            <Input value={form.nomeAluno} onChange={set("nomeAluno")} placeholder="Ex: CARLOS EDUARDO DA SILVA" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Data de Nascimento</FieldLabel>
            <Input value={form.dataNascimento} onChange={set("dataNascimento")} placeholder="DD/MM/AAAA" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nome da Mãe</FieldLabel>
            <Input value={form.nomeMae} onChange={set("nomeMae")} placeholder="Ex: MARIA DA SILVA SANTOS" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Estado</FieldLabel>
            <Select value={form.estadoAluno} onValueChange={setSelect("estadoAluno")}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf} - {ESTADO_NOMES[uf]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>RG</FieldLabel>
            <Input value={form.rg} onChange={set("rg")} placeholder="Ex: 69/4939" className={inputCls} required />
          </div>
        </div>

        {/* SESSÃO 3 - DADOS ESCOLARES */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={GraduationCap} title="Dados Escolares" />

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ensino Fundamental</p>
          <div className="space-y-1.5">
            <FieldLabel>Ano do Ensino Fundamental</FieldLabel>
            <Input value={form.anoEnsinoFundamental} onChange={set("anoEnsinoFundamental")} placeholder="Ex: 9º ANO - 2019" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nome da Escola</FieldLabel>
            <Input value={form.escolaEnsinoFundamental} onChange={set("escolaEnsinoFundamental")} placeholder="Ex: Escola Municipal São José" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>UF / Município</FieldLabel>
            <Input value={form.ufMunicipioFundamental} onChange={set("ufMunicipioFundamental")} placeholder="Ex: AL / Batalha" className={inputCls} required />
          </div>

          <div className="border-t border-border/50 pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ensino Médio</p>
              {form.ensinoMedio.length < 3 && (
                <Button type="button" variant="outline" size="sm" onClick={addMedio} className="gap-1 text-xs h-7">
                  <Plus className="w-3 h-3" /> Escola
                </Button>
              )}
            </div>

            {form.ensinoMedio.map((entry, idx) => (
              <div key={idx} className="glass rounded-lg p-4 space-y-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">{idx + 1}ª Série</span>
                  {form.ensinoMedio.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeMedio(idx)} className="h-6 w-6 p-0 text-destructive">
                      <Minus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Ano</FieldLabel>
                  <Input value={entry.ano} onChange={(e) => updateMedio(idx, "ano", e.target.value)} placeholder="Ex: 2020" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Nome da Escola</FieldLabel>
                  <Input value={entry.escola} onChange={(e) => updateMedio(idx, "escola", e.target.value)} placeholder="Ex: Escola Estadual Prof. João Reis" className={inputCls} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>UF / Município</FieldLabel>
                  <Input value={entry.ufMunicipio} onChange={(e) => updateMedio(idx, "ufMunicipio", e.target.value)} placeholder="Ex: AL / Batalha" className={inputCls} required />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SESSÃO 4 - CONCLUSÃO */}
        <div className="glass rounded-xl p-6 space-y-4">
          <SectionHeader icon={Award} title="Conclusão" />
          <div className="space-y-1.5">
            <FieldLabel>Escola de Conclusão do Ensino Médio</FieldLabel>
            <Input value={form.escolaConclusao} onChange={set("escolaConclusao")} placeholder="Ex: Escola Estadual Prof. João Reis" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nome Completo do Concludente</FieldLabel>
            <Input value={form.nomeConcludente} onChange={set("nomeConcludente")} placeholder="Ex: CARLOS EDUARDO DA SILVA" className={inputCls} required />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Ano de Finalização</FieldLabel>
            <Input value={form.anoFinalizacao} onChange={set("anoFinalizacao")} placeholder="Ex: 2015" className={inputCls} required />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold gap-2">
          {isEditMode ? <><RefreshCw className="w-5 h-5" /> Atualizar</> : <><Eye className="w-5 h-5" /> Gerar Preview</>}
        </Button>
      </form>
    </div>
  );
}
