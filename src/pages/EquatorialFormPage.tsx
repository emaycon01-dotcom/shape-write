import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FlaskConical, Trash2, User, Home, Receipt, Gauge, Landmark, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadEquatorialFieldPositions } from "@/lib/equatorial-align";
import templateEquatorialP1Url from "@/assets/template-equatorial-p1-hq.webp";
import templateEquatorialP2Url from "@/assets/template-equatorial-p2-hq.webp";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskCPF, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";

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
  infoL3: string;
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

  fin1Desc: string;
  fin1Valor: string;
  fin2Desc: string;
  fin2Valor: string;
  fin3Desc: string;
  fin3Valor: string;
  fin4Desc: string;
  fin4Valor: string;

  resAneel: string;
  resApresentacao: string;

  unidadeConsumidora: string;
  dataDocumento: string;
  numeroReferencia: string;
  especieDocumento: string;
  dataProcessamento: string;
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
  infoL3: "UNIDADE CONSUMIDORA CADASTRADA PARA AVISO PREFERENCIAL",
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

  fin1Desc: "",
  fin1Valor: "",
  fin2Desc: "",
  fin2Valor: "",
  fin3Desc: "",
  fin3Valor: "",
  fin4Desc: "",
  fin4Valor: "",

  resAneel: "3130/22",
  resApresentacao: "",

  unidadeConsumidora: "",
  dataDocumento: "",
  numeroReferencia: "",
  especieDocumento: "MN",
  dataProcessamento: "",
  nossoNumero: "",
  carteira: "109",
  especieMoeda: "R$",

  unidadeEntrega: "",
  sequencia: "",
  medidor: "",
};

const exemplo: EquatorialFormData = {
  nome: "LEONALDO RIBEIRO DE OLIVEIRA",
  cpf: "610.078.461-00",
  endereco: "RUA SEM NOME, Q. 106, L. 18, S/N",
  bairro: "JARDIM AMERICA IV",
  cep: "72910-000",
  municipio: "AGUAS LINDAS DE GOIAS",
  uf: "GO",
  perdas: "0%",

  classificacao: "B B1 RESIDENCIAL - RESIDENCIAL NORMAL CONVENCIONAL",
  tipoFornecimento: "MONOFÁSICO",

  notaFiscal: "65789409",
  serieNf: "0",
  dataEmissao: "28/07/2023",
  horaEmissao: "17:26:04",

  referencia: "JUL/2023",
  totalPagar: "137,20",
  vencimento: "07/08/2023",

  leituraAnterior: "23/06/2023",
  leituraAtual: "25/07/2023",
  dias: "32",
  proximaLeitura: "24/08/2023",

  infoL1: "PARCELA : USO SISTEMA = R$ 59,93   FORNECIMENTO = R$ 52,34  USO TRANSMISSÃO = 7,0900  ENC. SETORIAL = 5,9000",
  infoL2: "PERÍODO DE REFERÊNCIA DA APURAÇÃO DOS INDICADORES DE CONTINUIDADE = 5/2023. VRC = R$ 24,09066",
  infoL3: "UNIDADE CONSUMIDORA CADASTRADA PARA AVISO PREFERENCIAL",
  infoL4:
    "VOCÊ SOLICITOU CADASTRO COMO CLIENTE VITAL/SOBREVIDA. A DOCUMENTAÇÃO PARA REVALIDAÇÃO NÃO FOI ENTREGUE. PRECISAMOS QUE VÁ ATÉ UMA DE NOSSAS LOJAS NO PRAZO DE 15 DIAS, OU SEU IMÓVEL SERÁ DESCADASTRADO. DÚVIDAS, PROCURE NOSSOS CANAIS DE ATENDIMENTO.",

  itUnid: "kWh",
  itQuant: "150,00",
  itPrecoUnit: "0,835099",
  itValor: "125,26",
  itPis: "3,32",
  itBaseIcms: "125,26",
  itAliquota: "17%",
  itIcms: "21,29",
  itTarifa: "0,670990",

  fin1Desc: "BONUS ITAIPU ART.21 LEI 10438/02(-)",
  fin1Valor: "-6,18",
  fin2Desc: "CONTRIB. ILUM. PÚBLICA - MUNICIPAL",
  fin2Valor: "15,56",
  fin3Desc: "JUROS MORATÓRIA.",
  fin3Valor: "0,12",
  fin4Desc: "MULTA - 06/2023.",
  fin4Valor: "2,44",

  resAneel: "3130/22",
  resApresentacao: "28/07/2023",

  unidadeConsumidora: "10009576124",
  dataDocumento: "28/07/2023",
  numeroReferencia: "2023067958196",
  especieDocumento: "MN",
  dataProcessamento: "28/07/2023",
  nossoNumero: "109/06353774-0",
  carteira: "109",
  especieMoeda: "R$",

  unidadeEntrega: "37 / 17",
  sequencia: "961100",
  medidor: "10780867-6",
};

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="glass space-y-4 rounded-xl p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  full,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  full?: boolean;
  maxLength?: number;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-11 rounded-lg"
      />
    </div>
  );
}

export default function EquatorialFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { updateDocument } = useDocuments();
  const { toast } = useToast();

  const editState = location.state as { editDocId?: string; formData?: Record<string, string> } | null;
  const isEditMode = Boolean(editState?.editDocId);

  const [form, setForm] = useState<EquatorialFormData>(initial);
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
      infoL3: src.info_l3 ?? prev.infoL3,
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
      fin1Desc: src.fin1_desc ?? prev.fin1Desc,
      fin1Valor: src.fin1_valor ?? prev.fin1Valor,
      fin2Desc: src.fin2_desc ?? prev.fin2Desc,
      fin2Valor: src.fin2_valor ?? prev.fin2Valor,
      fin3Desc: src.fin3_desc ?? prev.fin3Desc,
      fin3Valor: src.fin3_valor ?? prev.fin3Valor,
      fin4Desc: src.fin4_desc ?? prev.fin4Desc,
      fin4Valor: src.fin4_valor ?? prev.fin4Valor,
      resAneel: src.res_aneel ?? prev.resAneel,
      resApresentacao: src.res_apresentacao ?? prev.resApresentacao,
      unidadeConsumidora: src.unidade_consumidora ?? prev.unidadeConsumidora,
      dataDocumento: src.data_documento ?? prev.dataDocumento,
      numeroReferencia: src.numero_referencia ?? prev.numeroReferencia,
      especieDocumento: src.especie_documento ?? prev.especieDocumento,
      dataProcessamento: src.data_processamento ?? prev.dataProcessamento,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do titular", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      const [templateBase64, templateP2Base64] = await Promise.all([
        loadTemplateBase64(templateEquatorialP1Url),
        loadTemplateBase64(templateEquatorialP2Url),
      ]);

      const bodyData = {
        nome: form.nome,
        cpf: form.cpf,
        endereco: form.endereco,
        bairro: form.bairro,
        cep: form.cep,
        municipio: form.municipio,
        uf: form.uf,
        perdas: form.perdas,

        classificacao: form.classificacao,
        tipo_fornecimento: form.tipoFornecimento,

        nota_fiscal: form.notaFiscal,
        serie_nf: form.serieNf,
        data_emissao: form.dataEmissao,
        hora_emissao: form.horaEmissao,

        referencia: form.referencia,
        total_pagar: form.totalPagar,
        vencimento: form.vencimento,

        leitura_anterior: form.leituraAnterior,
        leitura_atual: form.leituraAtual,
        dias: form.dias,
        proxima_leitura: form.proximaLeitura,

        info_l1: form.infoL1,
        info_l2: form.infoL2,
        info_l3: form.infoL3,
        info_l4: form.infoL4,

        it_unid: form.itUnid,
        it_quant: form.itQuant,
        it_preco_unit: form.itPrecoUnit,
        it_valor: form.itValor,
        it_pis: form.itPis,
        it_base_icms: form.itBaseIcms,
        it_aliquota: form.itAliquota,
        it_icms: form.itIcms,
        it_tarifa: form.itTarifa,

        fin1_desc: form.fin1Desc,
        fin1_valor: form.fin1Valor,
        fin2_desc: form.fin2Desc,
        fin2_valor: form.fin2Valor,
        fin3_desc: form.fin3Desc,
        fin3_valor: form.fin3Valor,
        fin4_desc: form.fin4Desc,
        fin4_valor: form.fin4Valor,

        res_aneel: form.resAneel,
        res_apresentacao: form.resApresentacao,

        unidade_consumidora: form.unidadeConsumidora,
        data_documento: form.dataDocumento,
        numero_referencia: form.numeroReferencia,
        especie_documento: form.especieDocumento,
        data_processamento: form.dataProcessamento,
        nosso_numero: form.nossoNumero,
        carteira: form.carteira,
        especie_moeda: form.especieMoeda,

        unidade_entrega: form.unidadeEntrega,
        sequencia: form.sequencia,
        medidor: form.medidor,

        template_base64: templateBase64,
        template_p2_base64: templateP2Base64,
        field_positions: loadEquatorialFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-equatorial-pdf", {
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

      const token = storePreviewPayload({ pdfBase64, formData: bodyData });
      navigate("/dashboard/documents/comprovante-equatorial/preview", { state: token });
    } catch (err) {
      console.error("Erro ao gerar comprovante Equatorial:", err);
      toast({ title: "Erro ao gerar o preview", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <h1 className="font-display mb-1 text-2xl font-bold text-foreground">
        Comprovante de Residência — Equatorial Goiás
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Fatura Equatorial Goiás / CELG D (DANF3E NF3e) em 2 páginas. Somente os campos removidos do documento são
        preenchidos — todo o restante do original é preservado.
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
          <Field label="Perdas de transformação / ramal" value={form.perdas} onChange={set("perdas")} placeholder="0%" />
          <Field label="Classificação" value={form.classificacao} onChange={set("classificacao")} full placeholder="B B1 RESIDENCIAL - RESIDENCIAL NORMAL CONVENCIONAL" />
          <Field label="Tipo de fornecimento" value={form.tipoFornecimento} onChange={set("tipoFornecimento")} placeholder="MONOFÁSICO" />
          <Field label="Unidade consumidora" value={form.unidadeConsumidora} onChange={set("unidadeConsumidora")} placeholder="10009576124" />
        </Section>

        <Section icon={Receipt} title="Nota fiscal eletrônica">
          <Field label="Nota fiscal nº" value={form.notaFiscal} onChange={set("notaFiscal")} placeholder="65789409" />
          <Field label="Série" value={form.serieNf} onChange={set("serieNf")} placeholder="0" />
          <Field label="Data de emissão" value={form.dataEmissao} onChange={(v) => set("dataEmissao")(maskDate(v))} placeholder="28/07/2023" />
          <Field label="Hora de emissão" value={form.horaEmissao} onChange={set("horaEmissao")} placeholder="17:26:04" />
        </Section>

        <Section icon={Home} title="Conta mês, vencimento e total">
          <Field label="Conta mês (referência)" value={form.referencia} onChange={set("referencia")} placeholder="JUL/2023" />
          <Field label="Vencimento" value={form.vencimento} onChange={(v) => set("vencimento")(maskDate(v))} placeholder="07/08/2023" />
          <Field label="Total a pagar (R$)" value={form.totalPagar} onChange={set("totalPagar")} placeholder="137,20" />
        </Section>

        <Section icon={Gauge} title="Datas das leituras">
          <Field label="Leitura anterior" value={form.leituraAnterior} onChange={(v) => set("leituraAnterior")(maskDate(v))} placeholder="23/06/2023" />
          <Field label="Leitura atual" value={form.leituraAtual} onChange={(v) => set("leituraAtual")(maskDate(v))} placeholder="25/07/2023" />
          <Field label="Nº de dias" value={form.dias} onChange={set("dias")} placeholder="32" />
          <Field label="Próxima leitura" value={form.proximaLeitura} onChange={(v) => set("proximaLeitura")(maskDate(v))} placeholder="24/08/2023" />
        </Section>

        <Section icon={Info} title="Informações para o cliente">
          <Field label="Linha 1" value={form.infoL1} onChange={set("infoL1")} full placeholder="PARCELA : USO SISTEMA = R$ ..." />
          <Field label="Linha 2" value={form.infoL2} onChange={set("infoL2")} full placeholder="PERÍODO DE REFERÊNCIA ..." />
          <Field label="Linha 3" value={form.infoL3} onChange={set("infoL3")} full placeholder="UNIDADE CONSUMIDORA CADASTRADA PARA AVISO PREFERENCIAL" />
          <Field label="Linha 4" value={form.infoL4} onChange={set("infoL4")} full placeholder="Aviso adicional" />
        </Section>

        <Section icon={Gauge} title="Itens de fatura — consumo">
          <Field label="Unidade" value={form.itUnid} onChange={set("itUnid")} placeholder="kWh" />
          <Field label="Quantidade" value={form.itQuant} onChange={set("itQuant")} placeholder="150,00" />
          <Field label="Preço unit. com tributos" value={form.itPrecoUnit} onChange={set("itPrecoUnit")} placeholder="0,835099" />
          <Field label="Valor (R$)" value={form.itValor} onChange={set("itValor")} placeholder="125,26" />
          <Field label="PIS/COFINS" value={form.itPis} onChange={set("itPis")} placeholder="3,32" />
          <Field label="Base cálc. ICMS" value={form.itBaseIcms} onChange={set("itBaseIcms")} placeholder="125,26" />
          <Field label="Alíquota ICMS" value={form.itAliquota} onChange={set("itAliquota")} placeholder="17%" />
          <Field label="ICMS" value={form.itIcms} onChange={set("itIcms")} placeholder="21,29" />
          <Field label="Tarifa unit." value={form.itTarifa} onChange={set("itTarifa")} placeholder="0,670990" />
        </Section>

        <Section icon={Receipt} title="Itens financeiros (opcional)">
          <Field label="Descrição 1" value={form.fin1Desc} onChange={set("fin1Desc")} placeholder="BONUS ITAIPU ART.21 LEI 10438/02(-)" />
          <Field label="Valor 1" value={form.fin1Valor} onChange={set("fin1Valor")} placeholder="-6,18" />
          <Field label="Descrição 2" value={form.fin2Desc} onChange={set("fin2Desc")} placeholder="CONTRIB. ILUM. PÚBLICA - MUNICIPAL" />
          <Field label="Valor 2" value={form.fin2Valor} onChange={set("fin2Valor")} placeholder="15,56" />
          <Field label="Descrição 3" value={form.fin3Desc} onChange={set("fin3Desc")} placeholder="JUROS MORATÓRIA." />
          <Field label="Valor 3" value={form.fin3Valor} onChange={set("fin3Valor")} placeholder="0,12" />
          <Field label="Descrição 4" value={form.fin4Desc} onChange={set("fin4Desc")} placeholder="MULTA - 06/2023." />
          <Field label="Valor 4" value={form.fin4Valor} onChange={set("fin4Valor")} placeholder="2,44" />
        </Section>

        <Section icon={Landmark} title="Ficha de compensação e página 2">
          <Field label="Resolução ANEEL" value={form.resAneel} onChange={set("resAneel")} placeholder="3130/22" />
          <Field label="Apresentação" value={form.resApresentacao} onChange={(v) => set("resApresentacao")(maskDate(v))} placeholder="28/07/2023" />
          <Field label="Data do documento" value={form.dataDocumento} onChange={(v) => set("dataDocumento")(maskDate(v))} placeholder="28/07/2023" />
          <Field label="Número de referência" value={form.numeroReferencia} onChange={set("numeroReferencia")} placeholder="2023067958196" />
          <Field label="Espécie documento" value={form.especieDocumento} onChange={set("especieDocumento")} placeholder="MN" />
          <Field label="Data do processamento" value={form.dataProcessamento} onChange={(v) => set("dataProcessamento")(maskDate(v))} placeholder="28/07/2023" />
          <Field label="Nosso número" value={form.nossoNumero} onChange={set("nossoNumero")} placeholder="109/06353774-0" />
          <Field label="Carteira" value={form.carteira} onChange={set("carteira")} placeholder="109" />
          <Field label="Espécie moeda" value={form.especieMoeda} onChange={set("especieMoeda")} placeholder="R$" />
          <Field label="P2: Unid. de entrega" value={form.unidadeEntrega} onChange={set("unidadeEntrega")} placeholder="37 / 17" />
          <Field label="P2: Sequência" value={form.sequencia} onChange={set("sequencia")} placeholder="961100" />
          <Field label="P2: Nº medidor" value={form.medidor} onChange={set("medidor")} placeholder="10780867-6" />
        </Section>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando preview...</>
          ) : (
            isEditMode ? "Salvar alterações" : "Gerar preview"
          )}
        </Button>
      </form>
    </div>
  );
}
