import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill, Loader2, FlaskConical, Trash2, FileText, User, Stethoscope, Plus, X, MapPin, Search } from "lucide-react";
import MedicamentoSearch from "@/components/MedicamentoSearch";
import { useToast } from "@/hooks/use-toast";
import { loadReceitaFieldPositions } from "@/lib/receita-align";
import templateReceitaUrl from "@/assets/template-receita-bg-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskCPF } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { CIDADES_UNIMED } from "@/lib/cidades-unimed";

interface Medicamento {
  nome: string;
  posologia: string;
  quantidade: string;
  farmaciaPopular: boolean;
}

interface ReceitaFormData {
  cidadeUnidade: string;
  paciente: string;
  cpf: string;
  nascimento: string;
  emissao: string;
  endereco: string;
  medico: string;
  crm: string;
  enderecoClinica: string;
  telefone: string;
}

const medVazio: Medicamento = { nome: "", posologia: "", quantidade: "1 caixa", farmaciaPopular: false };

const initial: ReceitaFormData = {
  cidadeUnidade: "Vitória",
  paciente: "",
  cpf: "",
  nascimento: "",
  emissao: "",
  endereco: "",
  medico: "Dr(a). Ana Flavia Resende Romanielo",
  crm: "CRM 31186 GO",
  enderecoClinica: "SCS Quadra 03 Bloco A, Numero 107, Sala 103 Ed Antônia Alves P de Sousa SCS - Brasília DF - CEP 70303907",
  telefone: "(61) 3221-5350",
};

export default function ReceitaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<ReceitaFormData>(initial);
  const [meds, setMeds] = useState<Medicamento[]>([{ ...medVazio }]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [searchTarget, setSearchTarget] = useState<number | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEditMode = Boolean(editState?.editDocId);

  useEffect(() => {
    if (hydrated || !editState?.editDocId) return;
    let cancelled = false;
    (async () => {
      const docId = editState.editDocId!;
      const raw = getDocument(docId)?.additionalInfo || (await loadDocumentInfo(docId));
      if (cancelled || !raw) return;
      try {
        const b = JSON.parse(raw) as Record<string, string>;
        setForm((p) => ({
          ...p,
          cidadeUnidade: b.cidade_unidade || p.cidadeUnidade,
          paciente: b.paciente || "",
          cpf: b.cpf || "",
          nascimento: b.nascimento || "",
          emissao: b.emissao || "",
          endereco: b.endereco || "",
          medico: b.medico || p.medico,
          crm: b.crm || p.crm,
          enderecoClinica: b.endereco_clinica || p.enderecoClinica,
          telefone: b.telefone || p.telefone,
        }));
        try {
          const parsed = JSON.parse((b.medicamentos as unknown as string) || "[]");
          if (Array.isArray(parsed) && parsed.length) {
            setMeds(parsed.map((m: Partial<Medicamento>) => ({ ...medVazio, ...m })));
          }
        } catch { /* lista inválida */ }
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof ReceitaFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof ReceitaFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const setMed = (i: number, patch: Partial<Medicamento>) =>
    setMeds((p) => p.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const addMed = () => setMeds((p) => [...p, { ...medVazio }]);
  const removeMed = (i: number) => setMeds((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const fillTest = () => {
    setForm({
      ...initial,
      cidadeUnidade: "Vitória",
      paciente: "TACILA CERQUEIRA LOPES",
      cpf: "074.660.925-60",
      nascimento: "05/08/1997",
      emissao: "30/03/2024 - 17:19:37",
      endereco: "- 99102312, -",
    });
    setMeds([
      { nome: "Budesonida (Spray) 32 mcg/Dose, Suspensão nasal (1un)", posologia: "Aplicar 1 jato nas narinas 3x ao dia", quantidade: "1 caixa", farmaciaPopular: true },
      { nome: "Hexomedine (Spray) 1 mg/mL + 0.5 mg/mL, Colutório (1un)", posologia: "bater em garganta 3x ao dia", quantidade: "1 caixa", farmaciaPopular: false },
      { nome: "Predinis 20 mg, Comprimido (10un)", posologia: "Tomar 1 comprimido via oral 12/12h por 5 dias", quantidade: "1 caixa", farmaciaPopular: false },
      { nome: "Ibuprofeno 600 mg, Cápsula mole (4un)", posologia: "Tomar 1 cápsula via oral 8/8h por 3 dias", quantidade: "1 caixa", farmaciaPopular: false },
    ]);
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setMeds([{ ...medVazio }]);
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validos = meds.filter((m) => m.nome.trim());
    if (!validos.length) {
      toast({ title: "Adicione ao menos um medicamento", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const templateBase64 = await loadTemplateBase64(templateReceitaUrl);

      const bodyData = {
        cidade_unidade: form.cidadeUnidade,
        paciente: form.paciente,
        cpf: form.cpf,
        nascimento: form.nascimento,
        emissao: form.emissao,
        endereco: form.endereco,
        medico: form.medico,
        crm: form.crm,
        endereco_clinica: form.enderecoClinica,
        telefone: form.telefone,
        medicamentos: JSON.stringify(validos),

        template_base64: templateBase64,
        field_positions: loadReceitaFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-receita-pdf", {
        body: { ...bodyData, preview: !isEditMode },
      });

      if (error) throw error;

      const pdfResult = data?.pdfBase64;
      if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");

      if (isEditMode && editState?.editDocId) {
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`,
        });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } else {
        navigate("/dashboard/documents/receita-medica/preview", {
          state: { pdfBase64: pdfResult, formData: bodyData },
        });
      }
    } catch (err) {
      console.error("Erro ao gerar Receita Médica:", err);
      toast({
        title: isEditMode ? "Erro ao atualizar documento" : "Erro ao gerar PDF",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "bg-secondary border-border text-foreground placeholder:text-muted-foreground";
  const selectCls = `h-10 w-full rounded-md border px-3 text-sm ${inputCls}`;

  const FieldLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-sm font-semibold text-primary">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div className="mb-2 flex items-center gap-3 border-b border-border/50 pb-2">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard/documents")} className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/10">
            <FlaskConical className="h-3.5 w-3.5" /> Teste
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </Button>
        </div>
      </div>

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Receita Médica</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* UNIDADE */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={MapPin} title="Unidade" />

          <div className="space-y-1.5">
            <FieldLabel required>Cidade da unidade (abaixo da logo)</FieldLabel>
            <select
              value={form.cidadeUnidade}
              onChange={(e) => setForm((p) => ({ ...p, cidadeUnidade: e.target.value }))}
              className={selectCls}
            >
              {CIDADES_UNIMED.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              A cidade é impressa em branco, centralizada logo abaixo da logo Unimed.
            </p>
          </div>
        </div>

        {/* PACIENTE */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do paciente" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do paciente</FieldLabel>
            <Input value={form.paciente} onChange={set("paciente")} placeholder="TACILA CERQUEIRA LOPES" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>CPF</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="074.660.925-60" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nascimento</FieldLabel>
              <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="05/08/1997" className={inputCls} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Emissão</FieldLabel>
            <Input value={form.emissao} onChange={set("emissao")} placeholder="30/03/2024 - 17:19:37" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Endereço</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} placeholder="- 99102312, -" className={inputCls} />
          </div>
        </div>

        {/* MEDICAMENTOS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Pill} title="Medicamentos" />

          <Button
            type="button"
            variant="gradient"
            onClick={() => setSearchTarget(meds.length - 1)}
            className="w-full gap-2"
          >
            <Search className="h-4 w-4" /> Pesquisar medicamento na base
          </Button>
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            Digite o nome e escolha dose, forma, apresentação, quantidade e posologia.
          </p>

          {meds.map((m, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border/60 bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Item {i + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSearchTarget(i)}
                    className="flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-xs text-primary hover:bg-primary/10"
                  >
                    <Search className="h-3 w-3" /> Buscar
                  </button>
                  {meds.length > 1 && (
                    <button type="button" onClick={() => removeMed(i)} className="text-destructive hover:opacity-80">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Medicamento</FieldLabel>
                <Input
                  value={m.nome}
                  onChange={(e) => setMed(i, { nome: e.target.value })}
                  placeholder="Ibuprofeno 600 mg, Cápsula mole (4un)"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Posologia</FieldLabel>
                <Input
                  value={m.posologia}
                  onChange={(e) => setMed(i, { posologia: e.target.value })}
                  placeholder="Tomar 1 cápsula via oral 8/8h por 3 dias"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Quantidade</FieldLabel>
                  <Input
                    value={m.quantidade}
                    onChange={(e) => setMed(i, { quantidade: e.target.value })}
                    placeholder="1 caixa"
                    className={inputCls}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={m.farmaciaPopular}
                    onChange={(e) => setMed(i, { farmaciaPopular: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  Farmácia Popular
                </label>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addMed} className="w-full gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
            <Plus className="h-4 w-4" /> Adicionar medicamento manualmente
          </Button>

        </div>

        {/* MÉDICO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Stethoscope} title="Médico e clínica" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Médico(a)</FieldLabel>
              <Input value={form.medico} onChange={set("medico")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>CRM</FieldLabel>
              <Input value={form.crm} onChange={set("crm")} className={inputCls} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Endereço da clínica</FieldLabel>
            <Input value={form.enderecoClinica} onChange={set("enderecoClinica")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Telefone</FieldLabel>
            <Input value={form.telefone} onChange={set("telefone")} className={inputCls} />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
          ) : isEditMode ? (
            <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
          ) : (
            <><Pill className="mr-2 h-5 w-5" /> Gerar preview</>
          )}
        </Button>
      </form>
    </div>
  );
}
