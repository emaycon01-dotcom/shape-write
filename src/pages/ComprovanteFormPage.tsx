import { useState, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FlaskConical, Trash2, User, Home, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadComprovanteFieldPositions } from "@/lib/comprovante-align";
import templateEnelP1Url from "@/assets/template-enel-p1-hq.webp";
import templateEnelP2Url from "@/assets/template-enel-p2-hq.webp";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskCPF, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";
import { AutoSection } from "@/components/AutoSection";
import { autoEnel, baseDatas, fmtDate, refMesAno } from "@/lib/fatura-auto";

interface ComprovanteFormData {
  nome: string;
  cpf: string;
  endereco: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;

  numeroConta: string;
  instalacao: string;
  numeroCliente: string;
  notaFiscal: string;
  serieNf: string;
  chaveNf: string;
  classificacao: string;
  fornecimento: string;

  referencia: string;
  vencimento: string;
  dataEmissao: string;
  dataLeituraAnterior: string;
  dataLeituraAtual: string;
  proximaLeitura: string;
  dias: string;

  consumoKwh: string;
  tarifaTusd: string;
  tarifaTe: string;
  aliquotaIcms: string;
  cosip: string;
  totalPagar: string;

  medidor: string;
  leituraAnteriorMedidor: string;
  leituraAtualMedidor: string;

  mensagens: string;
  codigoDebito: string;
  cb1: string;
  cb2: string;
  cb3: string;
  cb4: string;

  unidadeEntrega: string;
  sequencia: string;
}

const MENSAGENS_PADRAO =
  "Consulte suas faturas, informe leitura e acompanhe o consumo pelo aplicativo Enel.\nEm caso de falta de energia, ligue 0800 72 72 196.";

const initial: ComprovanteFormData = {
  nome: "",
  cpf: "",
  endereco: "",
  complemento: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "SP",

  numeroConta: "",
  instalacao: "",
  numeroCliente: "",
  notaFiscal: "",
  serieNf: "B",
  chaveNf: "",
  classificacao: "B - B1 - CONVENCIONAL - Residencial - Residencial",
  fornecimento: "Monofásico",

  referencia: "",
  vencimento: "",
  dataEmissao: "",
  dataLeituraAnterior: "",
  dataLeituraAtual: "",
  proximaLeitura: "",
  dias: "30",

  consumoKwh: "",
  tarifaTusd: "",
  tarifaTe: "",
  aliquotaIcms: "",
  cosip: "",
  totalPagar: "",

  medidor: "",
  leituraAnteriorMedidor: "",
  leituraAtualMedidor: "",

  mensagens: MENSAGENS_PADRAO,
  codigoDebito: "",
  cb1: "",
  cb2: "",
  cb3: "",
  cb4: "",

  unidadeEntrega: "",
  sequencia: "",
};

const exemplo: ComprovanteFormData = {
  ...initial,
  nome: "MARIA APARECIDA DOS SANTOS",
  cpf: "312.480.915-07",
  endereco: "RUA DAS ACACIAS, 128",
  complemento: "APTO 42 BL B",
  bairro: "JARDIM SAO PAULO",
  cep: "02040-030",
  municipio: "SÃO PAULO",
  uf: "SP",
  totalPagar: "184,90",
  vencimento: "20/04/2026",
};

/** Preenche automaticamente tudo que não é dado do cliente. */
function aplicarAuto(f: ComprovanteFormData, force: boolean): ComprovanteFormData {
  const a = autoEnel(f.totalPagar);
  const d = baseDatas(f.vencimento);
  const keep = (cur: string, next: string) => (force || !String(cur ?? "").trim() ? next : cur);

  return {
    ...f,
    vencimento: keep(f.vencimento, fmtDate(d.venc)),
    referencia: keep(f.referencia, refMesAno(d.leituraAtual)),
    dataEmissao: keep(f.dataEmissao, fmtDate(d.emissao)),
    dataLeituraAnterior: keep(f.dataLeituraAnterior, fmtDate(d.leituraAnterior)),
    dataLeituraAtual: keep(f.dataLeituraAtual, fmtDate(d.leituraAtual)),
    proximaLeitura: keep(f.proximaLeitura, fmtDate(d.proximaLeitura)),
    dias: keep(f.dias, String(d.dias)),

    consumoKwh: keep(f.consumoKwh, a.consumoKwh),
    tarifaTusd: keep(f.tarifaTusd, a.tarifaTusd),
    tarifaTe: keep(f.tarifaTe, a.tarifaTe),
    aliquotaIcms: keep(f.aliquotaIcms, a.aliquotaIcms),
    cosip: keep(f.cosip, a.cosip),

    medidor: keep(f.medidor, a.medidor),
    leituraAnteriorMedidor: keep(f.leituraAnteriorMedidor, a.leituraAnteriorMedidor),
    leituraAtualMedidor: keep(f.leituraAtualMedidor, a.leituraAtualMedidor),

    instalacao: keep(f.instalacao, a.instalacao),
    numeroCliente: keep(f.numeroCliente, a.numeroCliente),
    numeroConta: keep(f.numeroConta, a.numeroConta),
    notaFiscal: keep(f.notaFiscal, a.notaFiscal),
    chaveNf: keep(f.chaveNf, a.chaveNf),
    codigoDebito: keep(f.codigoDebito, a.codigoDebito),
    unidadeEntrega: keep(f.unidadeEntrega, a.unidadeEntrega),
    sequencia: keep(f.sequencia, a.sequencia),

    cb1: keep(f.cb1, a.cb1),
    cb2: keep(f.cb2, a.cb2),
    cb3: keep(f.cb3, a.cb3),
    cb4: keep(f.cb4, a.cb4),

    mensagens: keep(f.mensagens, MENSAGENS_PADRAO),
  };
}

export default function ComprovanteFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { updateDocument } = useDocuments();
  const { toast } = useToast();

  const editState = location.state as { editDocId?: string; formData?: Record<string, string> } | null;
  const isEditMode = Boolean(editState?.editDocId);

  const [form, setForm] = useState<ComprovanteFormData>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const d = editState?.formData;
    if (!d) return;
    setForm((p) => ({
      ...p,
      nome: d.nome ?? p.nome,
      cpf: d.cpf ?? p.cpf,
      endereco: d.endereco ?? p.endereco,
      complemento: d.complemento ?? p.complemento,
      bairro: d.bairro ?? p.bairro,
      cep: d.cep ?? p.cep,
      municipio: d.municipio ?? p.municipio,
      uf: d.uf ?? p.uf,
      numeroConta: d.numero_conta ?? p.numeroConta,
      instalacao: d.instalacao ?? p.instalacao,
      numeroCliente: d.numero_cliente ?? p.numeroCliente,
      notaFiscal: d.nota_fiscal ?? p.notaFiscal,
      serieNf: d.serie_nf ?? p.serieNf,
      chaveNf: d.chave_nf ?? p.chaveNf,
      classificacao: d.classificacao ?? p.classificacao,
      fornecimento: d.fornecimento ?? p.fornecimento,
      referencia: d.referencia ?? p.referencia,
      vencimento: d.vencimento ?? p.vencimento,
      dataEmissao: d.data_emissao ?? p.dataEmissao,
      dataLeituraAnterior: d.data_leitura_anterior ?? p.dataLeituraAnterior,
      dataLeituraAtual: d.data_leitura_atual ?? p.dataLeituraAtual,
      proximaLeitura: d.proxima_leitura ?? p.proximaLeitura,
      dias: d.dias ?? p.dias,
      consumoKwh: d.consumo_kwh ?? p.consumoKwh,
      tarifaTusd: d.tarifa_tusd ?? p.tarifaTusd,
      tarifaTe: d.tarifa_te ?? p.tarifaTe,
      aliquotaIcms: d.aliquota_icms ?? p.aliquotaIcms,
      cosip: d.cosip ?? p.cosip,
      totalPagar: d.total_pagar ?? p.totalPagar,
      medidor: d.medidor ?? p.medidor,
      leituraAnteriorMedidor: d.leitura_anterior_medidor ?? p.leituraAnteriorMedidor,
      leituraAtualMedidor: d.leitura_atual_medidor ?? p.leituraAtualMedidor,
      mensagens: d.mensagens ?? p.mensagens,
      codigoDebito: d.codigo_debito ?? p.codigoDebito,
      cb1: d.cb1 ?? p.cb1,
      cb2: d.cb2 ?? p.cb2,
      cb3: d.cb3 ?? p.cb3,
      cb4: d.cb4 ?? p.cb4,
      unidadeEntrega: d.unidade_entrega ?? p.unidadeEntrega,
      sequencia: d.sequencia ?? p.sequencia,
    }));
  }, [editState?.formData]);

  const set = (field: keyof ComprovanteFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof ComprovanteFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const randomizar = () => {
    setForm((p) => aplicarAuto(p, true));
    toast({ title: "Valores e códigos gerados automaticamente" });
  };

  const fillTest = () => {
    setForm(aplicarAuto(exemplo, true));
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.totalPagar.trim()) {
      toast({ title: "Informe o total da fatura", variant: "destructive" });
      return;
    }
    setLoading(true);
    saveFormDraft("comprovante", form as unknown as Record<string, unknown>);

    const f = aplicarAuto(form, false);
    setForm(f);

    try {
      const [templateBase64, templateP2Base64] = await Promise.all([
        loadTemplateBase64(templateEnelP1Url),
        loadTemplateBase64(templateEnelP2Url),
      ]);

      const bodyData = {
        nome: f.nome,
        cpf: f.cpf,
        endereco: f.endereco,
        complemento: f.complemento,
        bairro: f.bairro,
        cep: f.cep,
        municipio: f.municipio,
        uf: f.uf,

        numero_conta: f.numeroConta,
        instalacao: f.instalacao,
        numero_cliente: f.numeroCliente,
        nota_fiscal: f.notaFiscal,
        serie_nf: f.serieNf,
        chave_nf: f.chaveNf,
        classificacao: f.classificacao,
        fornecimento: f.fornecimento,

        referencia: f.referencia,
        vencimento: f.vencimento,
        data_emissao: f.dataEmissao,
        data_leitura_anterior: f.dataLeituraAnterior,
        data_leitura_atual: f.dataLeituraAtual,
        proxima_leitura: f.proximaLeitura,
        dias: f.dias,

        consumo_kwh: f.consumoKwh,
        tarifa_tusd: f.tarifaTusd,
        tarifa_te: f.tarifaTe,
        aliquota_icms: f.aliquotaIcms,
        cosip: f.cosip,
        total_pagar: f.totalPagar,

        medidor: f.medidor,
        leitura_anterior_medidor: f.leituraAnteriorMedidor,
        leitura_atual_medidor: f.leituraAtualMedidor,

        mensagens: f.mensagens,
        codigo_debito: f.codigoDebito,
        cb1: f.cb1,
        cb2: f.cb2,
        cb3: f.cb3,
        cb4: f.cb4,

        unidade_entrega: f.unidadeEntrega,
        sequencia: f.sequencia,

        template_base64: templateBase64,
        template_p2_base64: templateP2Base64,
        field_positions: loadComprovanteFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-comprovante-pdf", {
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
        const previewId = storePreviewPayload({ pdfBase64: pdfResult, formData: bodyData });
        navigate("/dashboard/documents/comprovante-enel/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Comprovante de Residência:", err);
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

      <h1 className="font-display mb-1 text-2xl font-bold text-foreground">Comprovante de Residência (Enel)</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Informe apenas os dados do cliente e o total da fatura. Consumo, tarifas, ICMS, COSIP, leituras, chave da
        NF-e e a linha digitável são calculados automaticamente.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">

        <FormDraftsPanel docType="comprovante" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        {/* TITULAR */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Titular da conta" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="Ex: MARIA APARECIDA DOS SANTOS" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>CPF / CNPJ</FieldLabel>
            <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="000.000.000-00" className={inputCls} />
          </div>
        </div>

        {/* ENDEREÇO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Home} title="Endereço de fornecimento" />

          <div className="space-y-1.5">
            <FieldLabel required>Logradouro e número</FieldLabel>
            <Input value={form.endereco} onChange={set("endereco")} placeholder="RUA DAS ACACIAS, 128" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Complemento</FieldLabel>
              <Input value={form.complemento} onChange={set("complemento")} placeholder="APTO 42 BL B" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Bairro</FieldLabel>
              <Input value={form.bairro} onChange={set("bairro")} placeholder="JARDIM SAO PAULO" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel>CEP</FieldLabel>
              <Input value={form.cep} onChange={setMask("cep", maskCEP)} inputMode="numeric" placeholder="00000-000" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Município</FieldLabel>
              <Input value={form.municipio} onChange={set("municipio")} placeholder="SÃO PAULO" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>UF</FieldLabel>
              <select value={form.uf} onChange={(e) => setForm((p) => ({ ...p, uf: e.target.value }))} className={selectCls}>
                {ESTADOS_UF.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* FATURA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Receipt} title="Fatura" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel required>Total a pagar (R$)</FieldLabel>
              <Input value={form.totalPagar} onChange={set("totalPagar")} placeholder="184,90" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Vencimento</FieldLabel>
              <Input value={form.vencimento} onChange={setMask("vencimento", maskDate)} inputMode="numeric" placeholder="20/04/2026" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Referência (opcional)</FieldLabel>
              <Input value={form.referencia} onChange={set("referencia")} placeholder="03/2026" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Fornecimento</FieldLabel>
              <select value={form.fornecimento} onChange={(e) => setForm((p) => ({ ...p, fornecimento: e.target.value }))} className={selectCls}>
                <option value="Monofásico">Monofásico</option>
                <option value="Bifásico">Bifásico</option>
                <option value="Trifásico">Trifásico</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Classificação</FieldLabel>
              <Input value={form.classificacao} onChange={set("classificacao")} className={inputCls} />
            </div>
          </div>
        </div>

        {/* AUTOMÁTICO */}
        <AutoSection
          title="Consumo, impostos e códigos"
          onRandomize={randomizar}
          description="Consumo em kWh, tarifas TUSD/TE, ICMS, COSIP, leituras do medidor, nº de instalação/cliente/conta, chave da NF-e e a linha digitável do código de barras são gerados automaticamente e fecham com o total informado."
        >
          <div className="space-y-1.5">
            <FieldLabel>Consumo (kWh)</FieldLabel>
            <Input value={form.consumoKwh} onChange={set("consumoKwh")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>COSIP (R$)</FieldLabel>
            <Input value={form.cosip} onChange={set("cosip")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Tarifa TUSD</FieldLabel>
            <Input value={form.tarifaTusd} onChange={set("tarifaTusd")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Tarifa TE</FieldLabel>
            <Input value={form.tarifaTe} onChange={set("tarifaTe")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>ICMS (%)</FieldLabel>
            <Input value={form.aliquotaIcms} onChange={set("aliquotaIcms")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Data de emissão</FieldLabel>
            <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Leitura anterior (data)</FieldLabel>
            <Input value={form.dataLeituraAnterior} onChange={setMask("dataLeituraAnterior", maskDate)} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Leitura atual (data)</FieldLabel>
            <Input value={form.dataLeituraAtual} onChange={setMask("dataLeituraAtual", maskDate)} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nº de dias</FieldLabel>
            <Input value={form.dias} onChange={set("dias")} placeholder="30" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Próxima leitura</FieldLabel>
            <Input value={form.proximaLeitura} onChange={setMask("proximaLeitura", maskDate)} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Leitura anterior (medidor)</FieldLabel>
            <Input value={form.leituraAnteriorMedidor} onChange={set("leituraAnteriorMedidor")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Leitura atual (medidor)</FieldLabel>
            <Input value={form.leituraAtualMedidor} onChange={set("leituraAtualMedidor")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nº da instalação</FieldLabel>
            <Input value={form.instalacao} onChange={set("instalacao")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nº do cliente</FieldLabel>
            <Input value={form.numeroCliente} onChange={set("numeroCliente")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nº da conta</FieldLabel>
            <Input value={form.numeroConta} onChange={set("numeroConta")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Nota fiscal nº</FieldLabel>
            <Input value={form.notaFiscal} onChange={set("notaFiscal")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Medidor</FieldLabel>
            <Input value={form.medidor} onChange={set("medidor")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Unidade de entrega</FieldLabel>
            <Input value={form.unidadeEntrega} onChange={set("unidadeEntrega")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel>Chave de acesso da NF-e</FieldLabel>
            <Input value={form.chaveNf} onChange={set("chaveNf")} placeholder="automático" className={inputCls} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel>Linha digitável (4 blocos)</FieldLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input value={form.cb1} onChange={set("cb1")} inputMode="numeric" placeholder="Bloco 1" className={inputCls} />
              <Input value={form.cb2} onChange={set("cb2")} inputMode="numeric" placeholder="Bloco 2" className={inputCls} />
              <Input value={form.cb3} onChange={set("cb3")} inputMode="numeric" placeholder="Bloco 3" className={inputCls} />
              <Input value={form.cb4} onChange={set("cb4")} inputMode="numeric" placeholder="Bloco 4" className={inputCls} />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel>Mensagens importantes</FieldLabel>
            <Textarea value={form.mensagens} onChange={set("mensagens")} rows={3} className={inputCls} />
          </div>
        </AutoSection>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
          ) : (
            isEditMode ? "Salvar alterações" : "Gerar Comprovante"
          )}
        </Button>
      </form>
    </div>
  );
}
