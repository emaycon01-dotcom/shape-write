import { useState, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FlaskConical, Trash2, Building2, User, Calculator, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadHoleriteFieldPositions } from "@/lib/holerite-align";
import templateHoleriteUrl from "@/assets/template-holerite-p1-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";

type HoleriteFormData = {
  empresa: string;
  cnpj: string;
  competencia: string;

  codigo: string;
  nome: string;
  cargo: string;
  emp: string;
  local: string;
  depto: string;
  setor: string;
  secao: string;
  fl: string;

  r1_venc: string;
  r1_desc: string;
  r2_venc: string;
  r2_desc: string;
  r3_venc: string;
  r3_desc: string;

  total_venc: string;
  total_desc: string;
  liquido: string;

  base_salario: string;
  base_inss: string;
  base_fgts: string;
  fgts_mes: string;
  base_irrf: string;
  faixa_irrf: string;
};

const initial: HoleriteFormData = {
  empresa: "",
  cnpj: "",
  competencia: "",
  codigo: "",
  nome: "",
  cargo: "",
  emp: "",
  local: "",
  depto: "",
  setor: "",
  secao: "",
  fl: "",
  r1_venc: "",
  r1_desc: "",
  r2_venc: "",
  r2_desc: "",
  r3_venc: "",
  r3_desc: "",
  total_venc: "",
  total_desc: "",
  liquido: "",
  base_salario: "",
  base_inss: "",
  base_fgts: "",
  fgts_mes: "",
  base_irrf: "",
  faixa_irrf: "",
};

const exemplo: HoleriteFormData = {
  empresa: "JTI Brasil Ltda.",
  cnpj: "03.334.170/0001-09",
  competencia: "maio/2023",
  codigo: "014",
  nome: "MAIARA SANTOS SILVA",
  cargo: "3515-05 - Secretária",
  emp: "",
  local: "",
  depto: "",
  setor: "",
  secao: "",
  fl: "",
  r1_venc: "5.000,00",
  r1_desc: "",
  r2_venc: "",
  r2_desc: "537,00",
  r3_venc: "",
  r3_desc: "368,05",
  total_venc: "5.000,00",
  total_desc: "905,05",
  liquido: "4.094,95",
  base_salario: "5.000,00",
  base_inss: "5.000,00",
  base_fgts: "5.000,00",
  fgts_mes: "400,00",
  base_irrf: "4.603,37",
  faixa_irrf: "04",
};

import { Section, Field } from "@/components/form/FormFields";

/** Converte "1.234,56" em número. */
function toNumber(v: string): number {
  const n = parseFloat((v || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function toMoney(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HoleriteFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { updateDocument } = useDocuments();
  const { toast } = useToast();

  const editState = location.state as { editDocId?: string; formData?: Record<string, string> } | null;
  const isEditMode = Boolean(editState?.editDocId);

  const [form, setForm] = useState<HoleriteFormData>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const src = editState?.formData;
    if (!src) return;
    setForm((prev) => {
      const next = { ...prev };
      (Object.keys(prev) as Array<keyof HoleriteFormData>).forEach((k) => {
        if (typeof src[k] === "string") next[k] = src[k] as string;
      });
      return next;
    });
  }, [editState?.formData]);

  const set = (key: keyof HoleriteFormData) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const calcular = () => {
    setForm((prev) => {
      const venc = toNumber(prev.r1_venc) + toNumber(prev.r2_venc) + toNumber(prev.r3_venc);
      const desc = toNumber(prev.r1_desc) + toNumber(prev.r2_desc) + toNumber(prev.r3_desc);
      return {
        ...prev,
        total_venc: toMoney(venc),
        total_desc: toMoney(desc),
        liquido: toMoney(venc - desc),
      };
    });
    toast({ title: "Totais recalculados" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do funcionário", variant: "destructive" });
      return;
    }
    setLoading(true);
    saveFormDraft("holerite", form as unknown as Record<string, unknown>);

    try {
      const templateBase64 = await loadTemplateObjectUrl(templateHoleriteUrl);

      const bodyData: Record<string, string | undefined | unknown> = {
        ...form,
        template_base64: templateBase64,
        field_positions: loadHoleriteFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-holerite-pdf", {
        body: { ...bodyData, preview: !isEditMode },
      });

      if (error) throw error;

      const pdfResult = data?.pdfBase64;
      if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");

      const pdfBase64 = pdfResult.startsWith("data:") ? pdfResult : `data:application/pdf;base64,${pdfResult}`;

      if (isEditMode && editState?.editDocId) {
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(bodyData),
          pdfDataUrl: pdfBase64,
        });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
        return;
      }

      const token = storePreviewPayload({ pdfBase64, formData: bodyData as Record<string, string> });
      navigate("/dashboard/documents/holerite/preview", { state: { previewId: token } });
    } catch (err) {
      console.error("Erro ao gerar holerite:", err);
      toast({ title: "Erro ao gerar o preview", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">HOLERITE — RECIBO DE PAGAMENTO DE SALÁRIO</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Duas vias na mesma página A4. Somente os campos removidos do documento são preenchidos — grades, rótulos,
        códigos/descrições fixos e as linhas de assinatura do original são preservados.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setForm(exemplo)}>
          <FlaskConical className="mr-2 h-4 w-4" /> Preencher exemplo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setForm(initial)}>
          <Trash2 className="mr-2 h-4 w-4" /> Limpar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <FormDraftsPanel docType="holerite" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        <Section icon={Building2} title="Empregador">
          <Field label="Razão social" value={form.empresa} onChange={set("empresa")} full placeholder="JTI Brasil Ltda." />
          <Field label="CNPJ" value={form.cnpj} onChange={set("cnpj")} placeholder="03.334.170/0001-09" />
          <Field label="Mês/ano de referência" value={form.competencia} onChange={set("competencia")} placeholder="maio/2023" />
        </Section>

        <Section icon={User} title="Funcionário">
          <Field label="Código" value={form.codigo} onChange={set("codigo")} placeholder="014" />
          <Field label="CBO / cargo" value={form.cargo} onChange={set("cargo")} placeholder="3515-05 - Secretária" />
          <Field label="Nome" value={form.nome} onChange={set("nome")} full placeholder="MAIARA SANTOS SILVA" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Emp." value={form.emp} onChange={set("emp")} placeholder="01" />
            <Field label="Local" value={form.local} onChange={set("local")} placeholder="01" />
            <Field label="Depto." value={form.depto} onChange={set("depto")} placeholder="01" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Setor" value={form.setor} onChange={set("setor")} placeholder="01" />
            <Field label="Seção" value={form.secao} onChange={set("secao")} placeholder="01" />
            <Field label="Fl." value={form.fl} onChange={set("fl")} placeholder="1" />
          </div>
        </Section>

        <div className="glass space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Vencimentos e descontos</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            As descrições (101 SALÁRIO, 973 INSS, 987 IRRF S.SALÁRIO) e a coluna Referência já vêm impressas no
            documento original — preencha apenas os valores.
          </p>
          <div className="space-y-3">
            {[
              { n: 1, label: "101 — SALÁRIO (30 d)" },
              { n: 2, label: "973 — INSS (14,0%)" },
              { n: 3, label: "987 — IRRF S.SALÁRIO (22,5%)" },
            ].map(({ n, label }) => (
              <div key={n} className="rounded-lg border border-border/60 p-3">
                <p className="mb-2 text-xs font-semibold text-primary">{label}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Vencimentos"
                    value={form[`r${n}_venc` as keyof HoleriteFormData]}
                    onChange={set(`r${n}_venc` as keyof HoleriteFormData)}
                    placeholder="0,00"
                  />
                  <Field
                    label="Descontos"
                    value={form[`r${n}_desc` as keyof HoleriteFormData]}
                    onChange={set(`r${n}_desc` as keyof HoleriteFormData)}
                    placeholder="0,00"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={calcular}>
            <Calculator className="mr-2 h-4 w-4" /> Calcular totais
          </Button>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Total de vencimentos" value={form.total_venc} onChange={set("total_venc")} placeholder="5.000,00" />
            <Field label="Total de descontos" value={form.total_desc} onChange={set("total_desc")} placeholder="905,05" />
            <Field label="Valor líquido" value={form.liquido} onChange={set("liquido")} placeholder="4.094,95" />
          </div>
        </div>

        <Section icon={Calculator} title="Bases de cálculo">
          <Field label="Salário base" value={form.base_salario} onChange={set("base_salario")} placeholder="5.000,00" />
          <Field label="Sal. contr. INSS" value={form.base_inss} onChange={set("base_inss")} placeholder="5.000,00" />
          <Field label="Base cálc. FGTS" value={form.base_fgts} onChange={set("base_fgts")} placeholder="5.000,00" />
          <Field label="FGTS do mês" value={form.fgts_mes} onChange={set("fgts_mes")} placeholder="400,00" />
          <Field label="Base cálc. IRRF" value={form.base_irrf} onChange={set("base_irrf")} placeholder="4.603,37" />
          <Field label="Faixa IRRF" value={form.faixa_irrf} onChange={set("faixa_irrf")} placeholder="04" />
        </Section>

        <div className="flex justify-center pt-1">
          <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando preview...</>
            ) : (
              isEditMode ? "Salvar alterações" : "Gerar preview"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
