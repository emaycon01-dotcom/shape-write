import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Loader2, FlaskConical, Trash2, User, Home, Eye, FileText, RefreshCw, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadEquatorialFieldPositions } from "@/lib/equatorial-align";
import templateEquatorialP1Url from "@/assets/template-equatorial-p1-hq.webp";
import templateEquatorialP2Url from "@/assets/template-equatorial-p2-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";
import { AutoSection } from "@/components/AutoSection";
import { autoEquatorial, baseDatas, fmtDate, refMesAbrev } from "@/lib/fatura-auto";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";

// Textos fixos do próprio documento — não são preenchidos pelo usuário.
const INFO_L3_FIXED = "UNIDADE CONSUMIDORA CADASTRADA PARA AVISO PREFERENCIAL";
const FIN1_DESC_FIXED = "BONUS ITAIPU ART.21 LEI 10438/02(-)";
const FIN2_DESC_FIXED = "CONTRIB. ILUM. PÚBLICA - MUNICIPAL";

interface EquatorialFormData {
  nome: string;
  cpf: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  perdas: string;

  classificacao: string;
  tipoFornecimento: string;

  notaFiscal: string;
  serieNf: string;
  dataEmissao: string;
  horaEmissao: string;

  referencia: string;
  totalPagar: string;
  vencimento: string;

  leituraAnterior: string;
  leituraAtual: string;
  dias: string;
  proximaLeitura: string;

  infoL1: string;
  infoL2: string;
  infoL4: string;

  itUnid: string;
  itQuant: string;
  itPrecoUnit: string;
  itValor: string;
  itPis: string;
  itBaseIcms: string;
  itAliquota: string;
  itIcms: string;
  itTarifa: string;

  fin1Valor: string;
  fin2Valor: string;
  fin3Desc: string;
  fin3Valor: string;
  fin4Desc: string;
  fin4Valor: string;

  resAneel: string;

  unidadeConsumidora: string;
  numeroReferencia: string;
  especieDocumento: string;
  nossoNumero: string;
  carteira: string;
  especieMoeda: string;

  unidadeEntrega: string;
  sequencia: string;
  medidor: string;
}

const initial: EquatorialFormData = {
  nome: "",
  cpf: "",
  endereco: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "GO",
  perdas: "0%",

  classificacao: "B B1 RESIDENCIAL - RESIDENCIAL NORMAL CONVENCIONAL",
  tipoFornecimento: "MONOFÁSICO",

  notaFiscal: "",
  serieNf: "0",
  dataEmissao: "",
  horaEmissao: "",

  referencia: "",
  totalPagar: "",
  vencimento: "",

  leituraAnterior: "",
  leituraAtual: "",
  dias: "30",
  proximaLeitura: "",

  infoL1: "",
  infoL2: "",
  infoL4: "",

  itUnid: "kWh",
  itQuant: "",
  itPrecoUnit: "",
  itValor: "",
  itPis: "",
  itBaseIcms: "",
  itAliquota: "17%",
  itIcms: "",
  itTarifa: "",

  fin1Valor: "",
  fin2Valor: "",
  fin3Desc: "",
  fin3Valor: "",
  fin4Desc: "",
  fin4Valor: "",

  resAneel: "3130/22",

  unidadeConsumidora: "",
  numeroReferencia: "",
  especieDocumento: "MN",
  nossoNumero: "",
  carteira: "109",
  especieMoeda: "R$",

  unidadeEntrega: "",
  sequencia: "",
  medidor: "",
};

const exemplo: EquatorialFormData = {
  ...initial,
  nome: "LEONALDO RIBEIRO DE OLIVEIRA",
  cpf: "610.078.461-00",
  endereco: "RUA SEM NOME, Q. 106, L. 18, S/N",
  bairro: "JARDIM AMERICA IV",
  cep: "72910-000",
  municipio: "AGUAS LINDAS DE GOIAS",
  uf: "GO",
  totalPagar: "137,20",
  vencimento: "07/08/2023",
};

/** Preenche automaticamente tudo que não é dado do cliente. */
function aplicarAuto(f: EquatorialFormData, force: boolean): EquatorialFormData {
  const d = baseDatas(f.vencimento);
  const referencia = String(f.referencia ?? "").trim() || refMesAbrev(d.leituraAtual);
  const a = autoEquatorial(f.totalPagar, referencia);
  const keep = (cur: string, next: string) => (force || !String(cur ?? "").trim() ? next : cur);

  return {
    ...f,
    referencia,
    vencimento: keep(f.vencimento, fmtDate(d.venc)),

    notaFiscal: keep(f.notaFiscal, a.notaFiscal),
    dataEmissao: keep(f.dataEmissao, fmtDate(d.emissao)),
    horaEmissao: keep(f.horaEmissao, a.horaEmissao),

    leituraAnterior: keep(f.leituraAnterior, fmtDate(d.leituraAnterior)),
    leituraAtual: keep(f.leituraAtual, fmtDate(d.leituraAtual)),
    dias: keep(f.dias, String(d.dias)),
    proximaLeitura: keep(f.proximaLeitura, fmtDate(d.proximaLeitura)),

    infoL1: keep(f.infoL1, a.infoL1),
    infoL2: keep(f.infoL2, a.infoL2),

    itUnid: keep(f.itUnid, a.itUnid),
    itQuant: keep(f.itQuant, a.itQuant),
    itPrecoUnit: keep(f.itPrecoUnit, a.itPrecoUnit),
    itValor: keep(f.itValor, a.itValor),
    itPis: keep(f.itPis, a.itPis),
    itBaseIcms: keep(f.itBaseIcms, a.itBaseIcms),
    itAliquota: keep(f.itAliquota, a.itAliquota),
    itIcms: keep(f.itIcms, a.itIcms),
    itTarifa: keep(f.itTarifa, a.itTarifa),

    fin1Valor: keep(f.fin1Valor, a.fin1Valor),
    fin2Valor: keep(f.fin2Valor, a.fin2Valor),
    fin3Desc: keep(f.fin3Desc, a.fin3Desc),
    fin3Valor: keep(f.fin3Valor, a.fin3Valor),
    fin4Desc: keep(f.fin4Desc, a.fin4Desc),
    fin4Valor: keep(f.fin4Valor, a.fin4Valor),

    unidadeConsumidora: keep(f.unidadeConsumidora, a.unidadeConsumidora),
    numeroReferencia: keep(f.numeroReferencia, a.numeroReferencia),
    nossoNumero: keep(f.nossoNumero, a.nossoNumero),
    unidadeEntrega: keep(f.unidadeEntrega, a.unidadeEntrega),
    sequencia: keep(f.sequencia, a.sequencia),
    medidor: keep(f.medidor, a.medidor),
  };
}

import { Section, Field } from "@/components/form/FormFields";

const ROUTE_KEY = "/dashboard/documents/comprovante-equatorial";

export default function EquatorialFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, deductCredit } = useAuth();
  const { updateDocument, addDocument } = useDocuments();
  const { toast } = useToast();

  const editState = location.state as { editDocId?: string; formData?: Record<string, string> } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const cost = planCost(1, user?.plano);

  const [form, setForm] = useState<EquatorialFormData>(initial);
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
      perdas: src.perdas ?? prev.perdas,
      classificacao: src.classificacao ?? prev.classificacao,
      tipoFornecimento: src.tipo_fornecimento ?? prev.tipoFornecimento,
      notaFiscal: src.nota_fiscal ?? prev.notaFiscal,
      serieNf: src.serie_nf ?? prev.serieNf,
      dataEmissao: src.data_emissao ?? prev.dataEmissao,
      horaEmissao: src.hora_emissao ?? prev.horaEmissao,
      referencia: src.referencia ?? prev.referencia,
      totalPagar: src.total_pagar ?? prev.totalPagar,
      vencimento: src.vencimento ?? prev.vencimento,
      leituraAnterior: src.leitura_anterior ?? prev.leituraAnterior,
      leituraAtual: src.leitura_atual ?? prev.leituraAtual,
      dias: src.dias ?? prev.dias,
      proximaLeitura: src.proxima_leitura ?? prev.proximaLeitura,
      infoL1: src.info_l1 ?? prev.infoL1,
      infoL2: src.info_l2 ?? prev.infoL2,
      infoL4: src.info_l4 ?? prev.infoL4,
      itUnid: src.it_unid ?? prev.itUnid,
      itQuant: src.it_quant ?? prev.itQuant,
      itPrecoUnit: src.it_preco_unit ?? prev.itPrecoUnit,
      itValor: src.it_valor ?? prev.itValor,
      itPis: src.it_pis ?? prev.itPis,
      itBaseIcms: src.it_base_icms ?? prev.itBaseIcms,
      itAliquota: src.it_aliquota ?? prev.itAliquota,
      itIcms: src.it_icms ?? prev.itIcms,
      itTarifa: src.it_tarifa ?? prev.itTarifa,
      fin1Valor: src.fin1_valor ?? prev.fin1Valor,
      fin2Valor: src.fin2_valor ?? prev.fin2Valor,
      fin3Desc: src.fin3_desc ?? prev.fin3Desc,
      fin3Valor: src.fin3_valor ?? prev.fin3Valor,
      fin4Desc: src.fin4_desc ?? prev.fin4Desc,
      fin4Valor: src.fin4_valor ?? prev.fin4Valor,
      resAneel: src.res_aneel ?? prev.resAneel,
      unidadeConsumidora: src.unidade_consumidora ?? prev.unidadeConsumidora,
      numeroReferencia: src.numero_referencia ?? prev.numeroReferencia,
      especieDocumento: src.especie_documento ?? prev.especieDocumento,
      nossoNumero: src.nosso_numero ?? prev.nossoNumero,
      carteira: src.carteira ?? prev.carteira,
      especieMoeda: src.especie_moeda ?? prev.especieMoeda,
      unidadeEntrega: src.unidade_entrega ?? prev.unidadeEntrega,
      sequencia: src.sequencia ?? prev.sequencia,
      medidor: src.medidor ?? prev.medidor,
    }));
  }, [editState?.formData]);

  const set = <K extends keyof EquatorialFormData>(key: K) => (value: EquatorialFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const randomizar = () => {
    setForm((prev) => aplicarAuto(prev, true));
    toast({ title: "Valores e códigos gerados automaticamente" });
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const f = aplicarAuto(form, false);
    const [templateBase64, templateP2Base64] = await Promise.all([
      loadTemplateObjectUrl(templateEquatorialP1Url),
      loadTemplateObjectUrl(templateEquatorialP2Url),
    ]);

    return {
      nome: f.nome,
      cpf: f.cpf,
      endereco: f.endereco,
      bairro: f.bairro,
      cep: f.cep,
      municipio: f.municipio,
      uf: f.uf,
      perdas: f.perdas,

      classificacao: f.classificacao,
      tipo_fornecimento: f.tipoFornecimento,

      nota_fiscal: f.notaFiscal,
      serie_nf: f.serieNf,
      data_emissao: f.dataEmissao,
      hora_emissao: f.horaEmissao,

      referencia: f.referencia,
      total_pagar: f.totalPagar,
      vencimento: f.vencimento,

      leitura_anterior: f.leituraAnterior,
      leitura_atual: f.leituraAtual,
      dias: f.dias,
      proxima_leitura: f.proximaLeitura,

      info_l1: f.infoL1,
      info_l2: f.infoL2,
      info_l3: INFO_L3_FIXED,
      info_l4: f.infoL4,

      it_unid: f.itUnid,
      it_quant: f.itQuant,
      it_preco_unit: f.itPrecoUnit,
      it_valor: f.itValor,
      it_pis: f.itPis,
      it_base_icms: f.itBaseIcms,
      it_aliquota: f.itAliquota,
      it_icms: f.itIcms,
      it_tarifa: f.itTarifa,

      fin1_desc: FIN1_DESC_FIXED,
      fin1_valor: f.fin1Valor,
      fin2_desc: FIN2_DESC_FIXED,
      fin2_valor: f.fin2Valor,
      fin3_desc: f.fin3Desc,
      fin3_valor: f.fin3Valor,
      fin4_desc: f.fin4Desc,
      fin4_valor: f.fin4Valor,

      res_aneel: f.resAneel,
      res_apresentacao: f.dataEmissao,

      unidade_consumidora: f.unidadeConsumidora,
      data_documento: f.dataEmissao,
      numero_referencia: f.numeroReferencia,
      especie_documento: f.especieDocumento,
      data_processamento: f.dataEmissao,
      nosso_numero: f.nossoNumero,
      carteira: f.carteira,
      especie_moeda: f.especieMoeda,

      unidade_entrega: f.unidadeEntrega,
      sequencia: f.sequencia,
      medidor: f.medidor,

      template_base64: templateBase64,
      template_p2_base64: templateP2Base64,
      field_positions: loadEquatorialFieldPositions() ?? undefined,
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);
  const canPreview = form.nome.trim().length > 2 && form.totalPagar.trim().length > 0;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-equatorial-pdf", {
        body: { ...body, preview: true },
      });
      if (seq !== previewSeq.current) return;
      if (error) throw error;
      const result = data?.pdfBase64;
      if (!result) throw new Error(data?.error || "Nenhum PDF retornado");
      setPreviewPdf(result.startsWith("data:") ? result : `data:application/pdf;base64,${result}`);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setPreviewError(describeError(e));
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }, [buildBody]);

  useEffect(() => {
    if (!autoLive || !canPreview || loading || showReady) return;
    if (generatedSignature.current === signature) return;
    const id = window.setTimeout(() => { void runPreview(); }, 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, autoLive, canPreview, loading, showReady]);

  const handleGenerate = async () => {
    if (!user) return;
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do titular", variant: "destructive" });
      return;
    }
    if (!form.totalPagar.trim()) {
      toast({ title: "Informe o total da fatura", variant: "destructive" });
      return;
    }

    if (isEditMode && editState?.editDocId) {
      setLoading(true);
      try {
        const body = await buildBody();
        const { data, error } = await invokeGeneratePdf("generate-equatorial-pdf", { body: { ...body, preview: false } });
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
        console.error("Erro ao atualizar comprovante Equatorial:", err);
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
    saveFormDraft("equatorial", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-equatorial-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error(data?.error || "Nenhum PDF retornado");
      const pdfFinal: string = generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-comprovante-equatorial", creditRef("geracao-comprovante-equatorial", body));
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
        description: `Comprovante de Residência - Equatorial Goiás ${(body.municipio as string) || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "comprovante-equatorial",
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
      console.error("Erro ao gerar comprovante Equatorial:", err);
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Comprovante Equatorial" />
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
              {previewError ? previewError : "Preencha nome do titular e total da fatura — a prévia atualiza sozinha enquanto você digita."}
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Comprovante de Residência — Equatorial Goiás</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Informe apenas os dados do cliente e o total da fatura. Consumo, ICMS, PIS/COFINS, tarifas, bônus, multa e
        todos os códigos são calculados automaticamente para fechar com o total.
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
          <FormDraftsPanel docType="equatorial" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          <Section icon={User} title="Titular e endereço">
            <Field label="Nome completo" value={form.nome} onChange={set("nome")} full placeholder="LEONALDO RIBEIRO DE OLIVEIRA" />
            <Field label="CNPJ/CPF" value={form.cpf} onChange={(v) => set("cpf")(maskCPF(v))} placeholder="000.000.000-00" />
            <Field label="CEP" value={form.cep} onChange={(v) => set("cep")(maskCEP(v))} placeholder="00000-000" />
            <Field label="Endereço (rua, quadra, lote, nº)" value={form.endereco} onChange={set("endereco")} full placeholder="RUA SEM NOME, Q. 106, L. 18, S/N" />
            <Field label="Bairro" value={form.bairro} onChange={set("bairro")} placeholder="JARDIM AMERICA IV" />
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field label="Município" value={form.municipio} onChange={set("municipio")} placeholder="AGUAS LINDAS DE GOIAS" />
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

          <Section icon={Home} title="Fatura">
            <Field label="Total a pagar (R$)" value={form.totalPagar} onChange={set("totalPagar")} placeholder="137,20" />
            <Field label="Vencimento" value={form.vencimento} onChange={(v) => set("vencimento")(maskDate(v))} placeholder="07/08/2023" />
            <Field label="Conta mês (referência) — opcional" value={form.referencia} onChange={set("referencia")} placeholder="JUL/2023" />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipo de fornecimento</label>
              <select
                value={form.tipoFornecimento}
                onChange={(e) => set("tipoFornecimento")(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="MONOFÁSICO">MONOFÁSICO</option>
                <option value="BIFÁSICO">BIFÁSICO</option>
                <option value="TRIFÁSICO">TRIFÁSICO</option>
              </select>
            </div>
          </Section>

          <AutoSection
            title="Impostos, consumo e códigos"
            onRandomize={randomizar}
            description="Consumo, tarifas, ICMS, PIS/COFINS, bônus, juros, multa, unidade consumidora, nosso número e medidor são gerados automaticamente e somam exatamente o total informado."
          >
            <Field label="Quantidade (kWh)" value={form.itQuant} onChange={set("itQuant")} placeholder="automático" />
            <Field label="Preço unit. com tributos" value={form.itPrecoUnit} onChange={set("itPrecoUnit")} placeholder="automático" />
            <Field label="Valor do consumo (R$)" value={form.itValor} onChange={set("itValor")} placeholder="automático" />
            <Field label="PIS/COFINS" value={form.itPis} onChange={set("itPis")} placeholder="automático" />
            <Field label="Base cálc. ICMS" value={form.itBaseIcms} onChange={set("itBaseIcms")} placeholder="automático" />
            <Field label="Alíquota ICMS" value={form.itAliquota} onChange={set("itAliquota")} placeholder="17%" />
            <Field label="ICMS" value={form.itIcms} onChange={set("itIcms")} placeholder="automático" />
            <Field label="Tarifa unit." value={form.itTarifa} onChange={set("itTarifa")} placeholder="automático" />
            <Field label="Bônus Itaipu" value={form.fin1Valor} onChange={set("fin1Valor")} placeholder="automático" />
            <Field label="Contrib. ilum. pública" value={form.fin2Valor} onChange={set("fin2Valor")} placeholder="automático" />
            <Field label="Juros" value={form.fin3Valor} onChange={set("fin3Valor")} placeholder="automático" />
            <Field label="Multa" value={form.fin4Valor} onChange={set("fin4Valor")} placeholder="automático" />
            <Field label="Nota fiscal nº" value={form.notaFiscal} onChange={set("notaFiscal")} placeholder="automático" />
            <Field label="Data de emissão" value={form.dataEmissao} onChange={(v) => set("dataEmissao")(maskDate(v))} placeholder="automático" />
            <Field label="Leitura anterior (data)" value={form.leituraAnterior} onChange={(v) => set("leituraAnterior")(maskDate(v))} placeholder="automático" />
            <Field label="Leitura atual (data)" value={form.leituraAtual} onChange={(v) => set("leituraAtual")(maskDate(v))} placeholder="automático" />
            <Field label="Nº de dias" value={form.dias} onChange={set("dias")} placeholder="30" />
            <Field label="Próxima leitura" value={form.proximaLeitura} onChange={(v) => set("proximaLeitura")(maskDate(v))} placeholder="automático" />
            <Field label="Unidade consumidora" value={form.unidadeConsumidora} onChange={set("unidadeConsumidora")} placeholder="automático" />
            <Field label="Número de referência" value={form.numeroReferencia} onChange={set("numeroReferencia")} placeholder="automático" />
            <Field label="Nosso número" value={form.nossoNumero} onChange={set("nossoNumero")} placeholder="automático" />
            <Field label="Nº medidor" value={form.medidor} onChange={set("medidor")} placeholder="automático" />
            <Field label="Unid. de entrega (pág. 2)" value={form.unidadeEntrega} onChange={set("unidadeEntrega")} placeholder="automático" />
            <Field label="Sequência (pág. 2)" value={form.sequencia} onChange={set("sequencia")} placeholder="automático" />
            <Field label="Aviso adicional ao cliente (opcional)" value={form.infoL4} onChange={set("infoL4")} full placeholder="" />
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
        fileName="comprovante-residencia-equatorial.pdf"
        title="Comprovante Residencia Equatorial"
        message={mensagem}
      />
    </div>
  );
}
