import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FlaskConical, Trash2, User, Receipt, Eye, FileText, RefreshCw, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadTimFieldPositions } from "@/lib/tim-align";
import templateTimP1Url from "@/assets/template-tim-p1-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { saveFinalPdf, readFinalPdf, clearFinalPdf } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";
import { AutoSection } from "@/components/AutoSection";
import { autoTim, baseDatas, fmtDate, refMesAbrev, addDays } from "@/lib/fatura-auto";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";

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

const ROUTE_KEY = "/dashboard/documents/comprovante-tim";

export default function TimFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, deductCredit } = useAuth();
  const { updateDocument, addDocument } = useDocuments();
  const { toast } = useToast();

  const editState = location.state as { editDocId?: string; formData?: Record<string, string> } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const cost = planCost(1, user?.plano);

  const [form, setForm] = useState<TimFormData>(initial);
  const [loading, setLoading] = useState(false);

  /* ---------------- preview ao vivo ---------------- */
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoLive, setAutoLive] = useState(true);
  const previewSeq = useRef(0);
  const generatedSignature = useRef<string | null>(null);

  const [finalPdf, setFinalPdf] = useState<string | null>(() => readFinalPdf(ROUTE_KEY));
  const [showReady, setShowReady] = useState(false);

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

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const f = aplicarAuto(form, false);
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

    return bodyData as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);
  const canPreview = form.nome.trim().length > 2 && form.total.trim().length > 0;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-tim-pdf", {
        body: { ...body, preview: true },
      });
      if (seq !== previewSeq.current) return;
      if (error) throw error;
      const result = data?.pdfBase64;
      if (!result) throw new Error(data?.error || "Nenhum PDF retornado");
      // Nova prévia = documento novo: descarta o PDF final anterior
      // (senão o preview seguinte apareceria sem marca d'água).
      setFinalPdf(null);
      clearFinalPdf(ROUTE_KEY);
      setPreviewPdf(result.startsWith("data:") ? result : `data:application/pdf;base64,${result}`);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setPreviewError(describeError(e));
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }, [buildBody]);

  useEffect(() => {
    if (!autoLive || loading || showReady) return;
    if (generatedSignature.current === signature) return;
    const id = window.setTimeout(() => { void runPreview(); }, 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, autoLive, canPreview, loading, showReady]);

  const handleGenerate = async () => {
    if (!user) return;
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do titular", variant: "destructive" });
      return;
    }
    if (!form.total.trim()) {
      toast({ title: "Informe o valor total da fatura", variant: "destructive" });
      return;
    }

    if (isEditMode && editState?.editDocId) {
      setLoading(true);
      try {
        const body = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-tim-pdf", { body: { ...body, preview: false } });
        if (error) throw error;
        const generated = data?.pdfBase64;
        if (!generated) throw new Error(data?.error || "Nenhum PDF retornado");
        await updateDocument(editState.editDocId, {
          additionalInfo: JSON.stringify(body),
          pdfDataUrl: generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`,
        });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } catch (err) {
        console.error("Erro ao atualizar comprovante TIM:", err);
        toast({ title: "Erro ao atualizar documento", description: describeError(err), variant: "destructive" });
      } finally {
        setLoading(false);
      }
      return;
    }

    if ((user.credits ?? 0) < cost) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de ${formatCredits(cost)} crédito(s) para gerar o documento.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    saveFormDraft("tim", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-tim-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error(data?.error || "Nenhum PDF retornado");
      const pdfFinal: string = generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-comprovante-tim", creditRef("geracao-comprovante-tim", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: (body.nome as string) || "",
        identification: (body.cpf as string) || "",
        date: (body.referencia as string) || "",
        description: `Comprovante de Residência - TIM ${(body.municipio as string) || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "comprovante-tim",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      generatedSignature.current = signature;
      setShowReady(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });
    } catch (err) {
      console.error("Erro ao gerar comprovante TIM:", err);
      toast({ title: "Erro ao gerar documento", description: `Nenhum crédito foi descontado. ${describeError(err)}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu Comprovante de Residência está pronto.\n\nTitular: ${form.nome}\nReferência: ${form.referencia}\nVencimento: ${form.vencimento}`;

  const card = "glass";

  const previewPanel = (
    <div className={`${card} flex h-full flex-col p-0`}>
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Prévia do documento</span>
          {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoLive((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
              autoLive ? "border-primary/40 bg-primary/12 text-primary" : "border-border bg-secondary text-muted-foreground"
            }`}
          >
            {autoLive ? "Ao vivo" : "Manual"}
          </button>
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={!canPreview || previewing}
            className="rounded-full border border-border bg-secondary p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            aria-label="Atualizar prévia"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${previewing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-b-2xl bg-secondary/30">
        {previewPdf ? (
          <>
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Comprovante TIM" />
            {!finalPdf && (
              <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsl(var(--destructive) / 0.05) 80px, hsl(var(--destructive) / 0.05) 82px)",
                  }}
                />
                {Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute whitespace-nowrap text-[17px] font-bold text-destructive/20"
                    style={{
                      transform: "rotate(-35deg)",
                      top: `${10 + (i % 4) * 25}%`,
                      left: `${-10 + Math.floor(i / 4) * 40}%`,
                      letterSpacing: "2px",
                    }}
                  >
                    MonkeyLab MonkeyLab
                  </span>
                ))}
              </div>
            )}
            {previewing && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
                <div className="h-full w-full animate-pulse bg-primary/70" />
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/20">
              {previewing ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <FileText className="h-6 w-6 text-primary" />}
            </span>
            <p className="text-sm font-semibold text-foreground">
              {previewing ? "Montando a prévia..." : "A prévia aparece aqui"}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {previewError ? previewError : "Preencha nome do titular e valor total — a prévia atualiza sozinha enquanto você digita."}
            </p>
          </div>
        )}
      </div>

      <p className="border-t border-border/50 px-5 py-2.5 text-center text-[11px] text-muted-foreground">
        A marca d'água sai apenas no PDF final gerado.
      </p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-28 xl:pb-10">
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }} className="space-y-5">
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

          {/* PRÉVIA — mobile/tablet */}
          <div className="xl:hidden">{previewPanel}</div>

          <div className="hidden justify-center pt-1 xl:flex">
            <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando documento...</>
              ) : isEditMode ? (
                "Salvar alterações"
              ) : (
                <><CreditCard className="mr-2 h-5 w-5" /> Gerar PDF ({cost > 0 ? `${formatCredits(cost)} crédito` : "grátis"})</>
              )}
            </Button>
          </div>
        </form>

        <div className="hidden xl:block xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          {previewPanel}
        </div>
      </div>

      {/* BARRA DE AÇÃO FIXA (mobile/tablet) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2">
          <p className="flex items-center gap-1.5 truncate rounded-full border border-border/60 bg-secondary/50 px-2.5 py-0.5 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              {cost > 0 ? `${formatCredits(cost)} crédito(s)` : "Grátis pelo seu plano"}
            </span>
            <span aria-hidden>·</span>
            <span>Saldo: {user?.credits ?? 0}</span>
          </p>
          <Button
            type="button"
            variant="gradient"
            className="h-12 w-full max-w-md rounded-2xl text-sm font-semibold"
            disabled={loading}
            onClick={() => void handleGenerate()}
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : isEditMode ? "Salvar" : "Gerar PDF"}
          </Button>
        </div>
      </div>

      <PdfReadyDialog
        open={showReady}
        onOpenChange={setShowReady}
        pdfDataUrl={finalPdf || ""}
        fileName="comprovante-residencia-tim.pdf"
        title="Comprovante Residencia Tim"
        message={mensagem}
      />
    </div>
  );
}
