import { useState, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FlaskConical, Trash2, User, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadTimFieldPositions } from "@/lib/tim-align";
import templateTimP1Url from "@/assets/template-tim-p1-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";
import { AutoSection } from "@/components/AutoSection";
import { autoTim, baseDatas, fmtDate, refMesAbrev, addDays } from "@/lib/fatura-auto";

interface TimLinha {
  desc: string;
  fran: string;
  cons: string;
  qtd: string;
  val: string;
}

interface TimFormData {
  nome: string;
  cpf: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;

  cliente: string;
  acesso: string;
  numFatura: string;

  dataEmissao: string;
  dataPostagem: string;
  vencimento: string;
  referencia: string;

  periodoConta: string;
  plano: string;
  total: string;

  periodoLinhas: string;
  diasLinhas: string;

  linhas: TimLinha[];
}

const linhaVazia: TimLinha = { desc: "", fran: "", cons: "", qtd: "", val: "" };

const initial: TimFormData = {
  nome: "",
  cpf: "",
  endereco: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "MS",

  cliente: "",
  acesso: "",
  numFatura: "",

  dataEmissao: "",
  dataPostagem: "",
  vencimento: "",
  referencia: "",

  periodoConta: "",
  plano: "",
  total: "",

  periodoLinhas: "",
  diasLinhas: "",

  linhas: Array.from({ length: 7 }, () => ({ ...linhaVazia })),
};

const exemplo: TimFormData = {
  ...initial,
  nome: "EVANDRO DA SILVA COUTO",
  cpf: "054.250.981-46",
  endereco: "RUA RENARIO, 54, ESQUINA",
  bairro: "JARDIM COLIBRI",
  cep: "79071-590",
  municipio: "CAMPO GRANDE",
  uf: "MS",
  total: "54,99",
  vencimento: "07/06/2021",
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Preenche automaticamente tudo que não é dado do cliente. */
function aplicarAuto(f: TimFormData, force: boolean): TimFormData {
  const d = baseDatas(f.vencimento);
  const fim = addDays(d.venc, -25);
  const ini = addDays(fim, -30);
  const periodoLinhas = `${pad2(ini.getDate())}/${pad2(ini.getMonth() + 1)} a ${pad2(fim.getDate())}/${pad2(fim.getMonth() + 1)}`;
  const a = autoTim(f.total);
  const keep = (cur: string, next: string) => (force || !String(cur ?? "").trim() ? next : cur);
  const linhasVazias = f.linhas.every((l) => !l.desc.trim() && !l.val.trim());

  return {
    ...f,
    vencimento: keep(f.vencimento, fmtDate(d.venc)),
    referencia: keep(f.referencia, refMesAbrev(fim)),
    dataEmissao: keep(f.dataEmissao, fmtDate(addDays(d.venc, -24))),
    dataPostagem: keep(f.dataPostagem, fmtDate(addDays(d.venc, -14))),

    cliente: keep(f.cliente, a.cliente),
    acesso: keep(f.acesso, a.acesso),
    numFatura: keep(f.numFatura, a.numFatura),
    plano: keep(f.plano, a.plano),
    periodoConta: keep(f.periodoConta, periodoLinhas.toUpperCase().replace(" A ", " A ")),
    periodoLinhas: keep(f.periodoLinhas, periodoLinhas),
    diasLinhas: keep(f.diasLinhas, "30"),

    linhas: force || linhasVazias ? a.linhas.map((l) => ({ ...l })) : f.linhas,
  };
}

import { Section, Field } from "@/components/form/FormFields";

export default function TimFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { updateDocument } = useDocuments();
  const { toast } = useToast();

  const editState = location.state as { editDocId?: string; formData?: Record<string, string> } | null;
  const isEditMode = Boolean(editState?.editDocId);

  const [form, setForm] = useState<TimFormData>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const src = editState?.formData;
    if (!src) return;
    setForm((prev) => ({
      ...prev,
      nome: src.nome ?? prev.nome,
      cpf: src.cpf ?? prev.cpf,
      endereco: src.endereco ?? prev.endereco,
      bairro: src.bairro ?? prev.bairro,
      cep: src.cep ?? prev.cep,
      municipio: src.municipio ?? prev.municipio,
      uf: src.uf ?? prev.uf,
      cliente: src.cliente ?? prev.cliente,
      acesso: src.acesso ?? prev.acesso,
      numFatura: src.num_fatura ?? prev.numFatura,
      dataEmissao: src.data_emissao ?? prev.dataEmissao,
      dataPostagem: src.data_postagem ?? prev.dataPostagem,
      vencimento: src.vencimento ?? prev.vencimento,
      referencia: src.referencia ?? prev.referencia,
      periodoConta: src.periodo_conta ?? prev.periodoConta,
      plano: src.plano ?? prev.plano,
      total: src.total ?? prev.total,
      periodoLinhas: src.l1_per ?? prev.periodoLinhas,
      diasLinhas: src.l1_dias ?? prev.diasLinhas,
      linhas: prev.linhas.map((l, i) => {
        // posição real na tabela: linha 4 é o subtotal automático, então
        // pulamos esse índice ao remapear as linhas editáveis (1,2,3,5,6,7,8).
        const n = i < 3 ? i + 1 : i + 2;
        return {
          desc: src[`l${n}_desc`] ?? l.desc,
          fran: src[`l${n}_fran`] ?? l.fran,
          cons: src[`l${n}_cons`] ?? l.cons,
          qtd: src[`l${n}_qtd`] ?? l.qtd,
          val: src[`l${n}_val`] ?? l.val,
        };
      }),
    }));
  }, [editState?.formData]);

  const set = <K extends keyof TimFormData>(key: K) => (value: TimFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setLinha = (index: number, key: keyof TimLinha) => (value: string) =>
    setForm((prev) => ({
      ...prev,
      linhas: prev.linhas.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    }));

  const randomizar = () => {
    setForm((prev) => aplicarAuto(prev, true));
    toast({ title: "Mensalidades e códigos gerados automaticamente" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do titular", variant: "destructive" });
      return;
    }
    if (!form.total.trim()) {
      toast({ title: "Informe o valor total da fatura", variant: "destructive" });
      return;
    }
    setLoading(true);
    saveFormDraft("tim", form as unknown as Record<string, unknown>);

    const f = aplicarAuto(form, false);
    setForm(f);

    try {
      const templateBase64 = await loadTemplateObjectUrl(templateTimP1Url);

      const bodyData: Record<string, string | undefined | unknown> = {
        nome: f.nome,
        cpf: f.cpf,
        endereco: f.endereco,
        bairro: f.bairro,
        cep: f.cep,
        municipio: f.municipio,
        uf: f.uf,

        cliente: f.cliente,
        acesso: f.acesso,
        num_fatura: f.numFatura,

        data_emissao: f.dataEmissao,
        data_postagem: f.dataPostagem,
        vencimento: f.vencimento,
        referencia: f.referencia,

        periodo_conta: f.periodoConta,
        plano: f.plano,
        total: f.total,

        template_base64: templateBase64,
        field_positions: loadTimFieldPositions() ?? undefined,
      };

      // As linhas 1, 2, 3, 5, 6, 7 e 8 são editáveis; a linha 4 (Subtotal) é
      // calculada automaticamente somando os valores numéricos das linhas 1-3.
      const parseValor = (v: string) => {
        const cleaned = (v || "").replace(/\./g, "").replace(",", ".").trim();
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : 0;
      };
      const subtotal = f.linhas.slice(0, 3).reduce((acc, l) => acc + parseValor(l.val), 0);
      const subtotalFmt = subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const linhasComSubtotal: TimLinha[] = [
        ...f.linhas.slice(0, 3),
        { desc: "Subtotal", fran: "", cons: "", qtd: "", val: subtotalFmt },
        ...f.linhas.slice(3),
      ];

      linhasComSubtotal.forEach((l, i) => {
        const n = i + 1;
        bodyData[`l${n}_desc`] = l.desc;
        bodyData[`l${n}_fran`] = l.fran;
        bodyData[`l${n}_cons`] = l.cons;
        bodyData[`l${n}_qtd`] = l.qtd;
        bodyData[`l${n}_dias`] = n === 4 ? "" : f.diasLinhas;
        bodyData[`l${n}_per`] = n === 4 ? "" : f.periodoLinhas;
        bodyData[`l${n}_val`] = l.val;
      });

      const { data, error } = await invokeGeneratePdf("generate-tim-pdf", {
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
      navigate("/dashboard/documents/comprovante-tim/preview", { state: { previewId: token } });
    } catch (err) {
      console.error("Erro ao gerar comprovante TIM:", err);
      toast({ title: "Erro ao gerar o preview", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Comprovante de Residência — TIM</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Informe apenas os dados do cliente e o valor total da fatura. Plano, descontos, subtotal, períodos e números
        de cliente/fatura são gerados automaticamente e fecham com o total.
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

        <FormDraftsPanel docType="tim" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        <Section icon={User} title="Titular e endereço">
          <Field label="Nome completo" value={form.nome} onChange={set("nome")} full placeholder="EVANDRO DA SILVA COUTO" />
          <Field label="CPF/CNPJ" value={form.cpf} onChange={(v) => set("cpf")(maskCPF(v))} placeholder="000.000.000-00" />
          <Field label="CEP" value={form.cep} onChange={(v) => set("cep")(maskCEP(v))} placeholder="00000-000" />
          <Field label="Endereço" value={form.endereco} onChange={set("endereco")} full placeholder="RUA RENARIO, 54, ESQUINA" />
          <Field label="Bairro" value={form.bairro} onChange={set("bairro")} placeholder="JARDIM COLIBRI" />
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <Field label="Município" value={form.municipio} onChange={set("municipio")} placeholder="CAMPO GRANDE" />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">UF</label>
              <select
                value={form.uf}
                onChange={(e) => set("uf")(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {ESTADOS_UF.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        <Section icon={Receipt} title="Fatura">
          <Field label="Valor total (R$)" value={form.total} onChange={set("total")} placeholder="54,99" />
          <Field label="Vencimento" value={form.vencimento} onChange={(v) => set("vencimento")(maskDate(v))} placeholder="07/06/2021" />
          <Field label="Acesso (linha) — opcional" value={form.acesso} onChange={set("acesso")} placeholder="automático" />
          <Field label="Mês de referência — opcional" value={form.referencia} onChange={set("referencia")} placeholder="automático" />
        </Section>

        <AutoSection
          title="Plano, descontos e códigos"
          onRandomize={randomizar}
          description="Plano, mensalidade, descontos, subtotal, períodos, nº de cliente e nº da fatura são gerados automaticamente somando exatamente o valor total informado."
        >
          <Field label="Cliente nº" value={form.cliente} onChange={set("cliente")} placeholder="automático" />
          <Field label="Fatura nº" value={form.numFatura} onChange={set("numFatura")} placeholder="automático" />
          <Field label="Emissão" value={form.dataEmissao} onChange={(v) => set("dataEmissao")(maskDate(v))} placeholder="automático" />
          <Field label="Postagem" value={form.dataPostagem} onChange={(v) => set("dataPostagem")(maskDate(v))} placeholder="automático" />
          <Field label="Plano" value={form.plano} onChange={set("plano")} placeholder="automático" />
          <Field label="Período da conta" value={form.periodoConta} onChange={set("periodoConta")} placeholder="automático" />
          <Field label="Período das linhas" value={form.periodoLinhas} onChange={set("periodoLinhas")} placeholder="automático" />
          <Field label="Nº dias das linhas" value={form.diasLinhas} onChange={set("diasLinhas")} placeholder="30" />

          <div className="space-y-3 sm:col-span-2">
            {form.linhas.map((linha, i) => {
              const posicao = i < 3 ? i + 1 : i + 2;
              return (
                <div key={i} className="rounded-lg border border-border/60 p-3">
                  <p className="mb-2 text-xs font-semibold text-primary">Linha {posicao}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</label>
                      <Input value={linha.desc} onChange={(e) => setLinha(i, "desc")(e.target.value)} className="h-10 rounded-lg" placeholder="automático" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Franquia</label>
                        <Input value={linha.fran} onChange={(e) => setLinha(i, "fran")(e.target.value)} className="h-10 rounded-lg" placeholder="-" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Consumo</label>
                        <Input value={linha.cons} onChange={(e) => setLinha(i, "cons")(e.target.value)} className="h-10 rounded-lg" placeholder="-" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Quantidade</label>
                      <Input value={linha.qtd} onChange={(e) => setLinha(i, "qtd")(e.target.value)} className="h-10 rounded-lg" placeholder="1" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Valor</label>
                      <Input value={linha.val} onChange={(e) => setLinha(i, "val")(e.target.value)} className="h-10 rounded-lg" placeholder="automático" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </AutoSection>

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
