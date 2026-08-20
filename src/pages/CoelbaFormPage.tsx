import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FlaskConical, Trash2, User, Home, Gauge, Eye, FileText, RefreshCw, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadCoelbaFieldPositions } from "@/lib/coelba-align";
import templateCoelbaP1Url from "@/assets/template-coelba-p1-hq.webp";
import templateCoelbaP2Url from "@/assets/template-coelba-p2-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";
import { AutoSection } from "@/components/AutoSection";
import { autoCoelba, baseDatas, fmtDate, refMesAno } from "@/lib/fatura-auto";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";

interface CoelbaFormData {
  nome: string;
  cpf: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;

  notaFiscal: string;
  serieNf: string;
  dataEmissao: string;
  chaveAcesso: string;
  protocolo: string;
  protocoloData: string;
  protocoloHora: string;

  referencia: string;
  totalPagar: string;
  vencimento: string;

  leituraAnterior: string;
  leituraAtual: string;
  dias: string;
  proximaLeitura: string;

  medPostos: string;
  medLeituraAnterior: string;
  medLeituraAtual: string;
  medConstante: string;
  medConsumo: string;

  avisoData: string;
  debVenc1: string;
  debReaviso1: string;
  debValor1: string;
  debVenc2: string;
  debReaviso2: string;
  debValor2: string;
}

const initial: CoelbaFormData = {
  nome: "",
  cpf: "",
  endereco: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "BA",

  notaFiscal: "",
  serieNf: "000",
  dataEmissao: "",
  chaveAcesso: "",
  protocolo: "",
  protocoloData: "",
  protocoloHora: "",

  referencia: "",
  totalPagar: "",
  vencimento: "",

  leituraAnterior: "",
  leituraAtual: "",
  dias: "30",
  proximaLeitura: "",

  medPostos: "Único",
  medLeituraAnterior: "",
  medLeituraAtual: "",
  medConstante: "1,00000",
  medConsumo: "",

  avisoData: "",
  debVenc1: "",
  debReaviso1: "",
  debValor1: "",
  debVenc2: "",
  debReaviso2: "",
  debValor2: "",
};

const exemplo: CoelbaFormData = {
  ...initial,
  nome: "GLEIDSON GALO PEDREIRA",
  cpf: "062.145.695-06",
  endereco: "RUA 3 TRAVESSA SÃO JOSÉ DO EGITO N 03",
  bairro: "FEDERAÇÃO",
  cep: "40220-535",
  municipio: "SALVADOR",
  uf: "BA",
  totalPagar: "597,80",
  vencimento: "01/01/2025",
};

/** Preenche automaticamente tudo que não é dado do cliente. */
function aplicarAuto(f: CoelbaFormData, force: boolean): CoelbaFormData {
  const a = autoCoelba(f.totalPagar);
  const d = baseDatas(f.vencimento);
  const keep = (cur: string, next: string) => (force || !String(cur ?? "").trim() ? next : cur);

  return {
    ...f,
    referencia: keep(f.referencia, refMesAno(d.leituraAtual)),
    vencimento: keep(f.vencimento, fmtDate(d.venc)),

    notaFiscal: keep(f.notaFiscal, a.notaFiscal),
    serieNf: keep(f.serieNf, "000"),
    dataEmissao: keep(f.dataEmissao, fmtDate(d.emissao)),
    chaveAcesso: keep(f.chaveAcesso, a.chaveAcesso),
    protocolo: keep(f.protocolo, a.protocolo),
    protocoloData: keep(f.protocoloData, fmtDate(d.emissao)),
    protocoloHora: keep(f.protocoloHora, a.protocoloHora),

    leituraAnterior: keep(f.leituraAnterior, fmtDate(d.leituraAnterior)),
    leituraAtual: keep(f.leituraAtual, fmtDate(d.leituraAtual)),
    dias: keep(f.dias, String(d.dias)),
    proximaLeitura: keep(f.proximaLeitura, fmtDate(d.proximaLeitura)),

    medPostos: keep(f.medPostos, a.medPostos),
    medConstante: keep(f.medConstante, a.medConstante),
    medLeituraAnterior: keep(f.medLeituraAnterior, a.medLeituraAnterior),
    medLeituraAtual: keep(f.medLeituraAtual, a.medLeituraAtual),
    medConsumo: keep(f.medConsumo, a.medConsumo),
  };
}

import { Section, Field } from "@/components/form/FormFields";

const ROUTE_KEY = "/dashboard/documents/comprovante-coelba";

export default function CoelbaFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, deductCredit } = useAuth();
  const { updateDocument, addDocument } = useDocuments();
  const { toast } = useToast();

  const editState = location.state as { editDocId?: string; formData?: Record<string, string> } | null;
  const isEditMode = Boolean(editState?.editDocId);
  const cost = planCost(1, user?.plano);

  const [form, setForm] = useState<CoelbaFormData>(initial);
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
      notaFiscal: src.nota_fiscal ?? prev.notaFiscal,
      serieNf: src.serie_nf ?? prev.serieNf,
      dataEmissao: src.data_emissao ?? prev.dataEmissao,
      chaveAcesso: src.chave_acesso ?? prev.chaveAcesso,
      protocolo: src.protocolo ?? prev.protocolo,
      protocoloData: src.protocolo_data ?? prev.protocoloData,
      protocoloHora: src.protocolo_hora ?? prev.protocoloHora,
      referencia: src.referencia ?? prev.referencia,
      totalPagar: src.total_pagar ?? prev.totalPagar,
      vencimento: src.vencimento ?? prev.vencimento,
      leituraAnterior: src.leitura_anterior ?? prev.leituraAnterior,
      leituraAtual: src.leitura_atual ?? prev.leituraAtual,
      dias: src.dias ?? prev.dias,
      proximaLeitura: src.proxima_leitura ?? prev.proximaLeitura,
      medPostos: src.med_postos ?? prev.medPostos,
      medLeituraAnterior: src.med_leitura_anterior ?? prev.medLeituraAnterior,
      medLeituraAtual: src.med_leitura_atual ?? prev.medLeituraAtual,
      medConstante: src.med_constante ?? prev.medConstante,
      medConsumo: src.med_consumo ?? prev.medConsumo,
      avisoData: src.aviso_data ?? prev.avisoData,
      debVenc1: src.deb_venc1 ?? prev.debVenc1,
      debReaviso1: src.deb_reaviso1 ?? prev.debReaviso1,
      debValor1: src.deb_valor1 ?? prev.debValor1,
      debVenc2: src.deb_venc2 ?? prev.debVenc2,
      debReaviso2: src.deb_reaviso2 ?? prev.debReaviso2,
      debValor2: src.deb_valor2 ?? prev.debValor2,
    }));
  }, [editState?.formData]);

  const set = <K extends keyof CoelbaFormData>(key: K) => (value: CoelbaFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const randomizar = () => {
    setForm((prev) => aplicarAuto(prev, true));
    toast({ title: "Dados técnicos gerados automaticamente" });
  };

  /* ---------------- montagem do payload ---------------- */
  const buildBody = useCallback(async () => {
    const f = aplicarAuto(form, false);
    const [templateBase64, templateP2Base64] = await Promise.all([
      loadTemplateObjectUrl(templateCoelbaP1Url),
      loadTemplateObjectUrl(templateCoelbaP2Url),
    ]);

    return {
      nome: f.nome,
      cpf: f.cpf,
      endereco: f.endereco,
      bairro: f.bairro,
      cep: f.cep,
      municipio: f.municipio,
      uf: f.uf,

      nota_fiscal: f.notaFiscal,
      serie_nf: f.serieNf,
      data_emissao: f.dataEmissao,
      chave_acesso: f.chaveAcesso,
      protocolo: f.protocolo,
      protocolo_data: f.protocoloData,
      protocolo_hora: f.protocoloHora,

      referencia: f.referencia,
      total_pagar: f.totalPagar,
      vencimento: f.vencimento,

      leitura_anterior: f.leituraAnterior,
      leitura_atual: f.leituraAtual,
      dias: f.dias,
      proxima_leitura: f.proximaLeitura,

      med_postos: f.medPostos,
      med_leitura_anterior: f.medLeituraAnterior,
      med_leitura_atual: f.medLeituraAtual,
      med_constante: f.medConstante,
      med_consumo: f.medConsumo,

      aviso_data: f.avisoData,
      deb_venc1: f.debVenc1,
      deb_reaviso1: f.debReaviso1,
      deb_valor1: f.debValor1,
      deb_venc2: f.debVenc2,
      deb_reaviso2: f.debReaviso2,
      deb_valor2: f.debValor2,

      template_base64: templateBase64,
      template_p2_base64: templateP2Base64,
      field_positions: loadCoelbaFieldPositions() ?? undefined,
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
      const { data, error } = await invokeGeneratePdf("generate-coelba-pdf", {
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
        const { data, error } = await invokeGeneratePdf("generate-coelba-pdf", { body: { ...body, preview: false } });
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
        console.error("Erro ao atualizar comprovante Coelba:", err);
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
    saveFormDraft("coelba", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-coelba-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error(data?.error || "Nenhum PDF retornado");
      const pdfFinal: string = generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-comprovante-coelba", creditRef("geracao-comprovante-coelba", body));
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
        description: `Comprovante de Residência - Coelba ${(body.municipio as string) || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "comprovante-coelba",
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
      console.error("Erro ao gerar comprovante Coelba:", err);
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Comprovante Coelba" />
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
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Comprovante de Residência — Coelba</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Informe apenas os dados do cliente e o total da fatura. Consumo, leituras, impostos, chave da NF-e e
        protocolos são calculados automaticamente.
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
          <FormDraftsPanel docType="coelba" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          <Section icon={User} title="Titular">
            <Field label="Nome completo" value={form.nome} onChange={set("nome")} full placeholder="GLEIDSON GALO PEDREIRA" />
            <Field label="CPF" value={form.cpf} onChange={(v) => set("cpf")(maskCPF(v))} placeholder="000.000.000-00" />
            <Field label="CEP" value={form.cep} onChange={(v) => set("cep")(maskCEP(v))} placeholder="00000-000" />
            <Field label="Endereço (rua e número)" value={form.endereco} onChange={set("endereco")} full placeholder="RUA 3 TRAVESSA SÃO JOSÉ DO EGITO N 03" />
            <Field label="Bairro" value={form.bairro} onChange={set("bairro")} placeholder="FEDERAÇÃO" />
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field label="Município" value={form.municipio} onChange={set("municipio")} placeholder="SALVADOR" />
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
            <Field label="Total a pagar (R$)" value={form.totalPagar} onChange={set("totalPagar")} placeholder="597,80" />
            <Field label="Vencimento" value={form.vencimento} onChange={(v) => set("vencimento")(maskDate(v))} placeholder="01/01/2025" />
            <Field label="Referência (mês/ano) — opcional" value={form.referencia} onChange={set("referencia")} placeholder="12/2024" />
          </Section>

          <AutoSection
            title="Consumo, impostos e códigos"
            onRandomize={randomizar}
            description="Consumo, leituras do medidor, datas, chave da NF-e e protocolo são gerados a partir do total informado. Só abra se quiser conferir."
          >
            <Field label="Nota fiscal nº" value={form.notaFiscal} onChange={set("notaFiscal")} placeholder="automático" />
            <Field label="Série" value={form.serieNf} onChange={set("serieNf")} placeholder="000" />
            <Field label="Data de emissão" value={form.dataEmissao} onChange={(v) => set("dataEmissao")(maskDate(v))} placeholder="automático" />
            <Field label="Protocolo de autorização" value={form.protocolo} onChange={set("protocolo")} placeholder="automático" />
            <Field label="Chave de acesso (44 dígitos)" value={form.chaveAcesso} onChange={(v) => set("chaveAcesso")(v.replace(/\D/g, "").slice(0, 44))} maxLength={44} full placeholder="automático" />
            <Field label="Data do protocolo" value={form.protocoloData} onChange={(v) => set("protocoloData")(maskDate(v))} placeholder="automático" />
            <Field label="Hora do protocolo" value={form.protocoloHora} onChange={set("protocoloHora")} placeholder="automático" />
            <Field label="Leitura anterior (data)" value={form.leituraAnterior} onChange={(v) => set("leituraAnterior")(maskDate(v))} placeholder="automático" />
            <Field label="Leitura atual (data)" value={form.leituraAtual} onChange={(v) => set("leituraAtual")(maskDate(v))} placeholder="automático" />
            <Field label="Nº de dias" value={form.dias} onChange={set("dias")} placeholder="30" />
            <Field label="Próxima leitura" value={form.proximaLeitura} onChange={(v) => set("proximaLeitura")(maskDate(v))} placeholder="automático" />
            <Field label="Medidor — leitura anterior" value={form.medLeituraAnterior} onChange={set("medLeituraAnterior")} placeholder="automático" />
            <Field label="Medidor — leitura atual" value={form.medLeituraAtual} onChange={set("medLeituraAtual")} placeholder="automático" />
            <Field label="Consumo kWh" value={form.medConsumo} onChange={set("medConsumo")} placeholder="automático" />
          </AutoSection>

          <AutoSection
            title="Aviso e débitos anteriores (opcional)"
            description="Deixe vazio para não exibir nenhum débito anterior no documento."
          >
            <Field label="Data do aviso de suspensão" value={form.avisoData} onChange={(v) => set("avisoData")(maskDate(v))} full placeholder="" />
            <Field label="Vencto (1)" value={form.debVenc1} onChange={set("debVenc1")} placeholder="" />
            <Field label="Dt reaviso (1)" value={form.debReaviso1} onChange={set("debReaviso1")} placeholder="" />
            <Field label="Valor (1)" value={form.debValor1} onChange={set("debValor1")} placeholder="" />
            <div />
            <Field label="Vencto (2)" value={form.debVenc2} onChange={set("debVenc2")} placeholder="" />
            <Field label="Dt reaviso (2)" value={form.debReaviso2} onChange={set("debReaviso2")} placeholder="" />
            <Field label="Valor (2)" value={form.debValor2} onChange={set("debValor2")} placeholder="" />
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
        fileName="comprovante-residencia-coelba.pdf"
        title="Comprovante Residencia Coelba"
        message={mensagem}
      />
    </div>
  );
}
