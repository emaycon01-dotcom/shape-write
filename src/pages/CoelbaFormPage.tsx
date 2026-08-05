import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FlaskConical, Trash2, User, Home, Receipt, Gauge, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadCoelbaFieldPositions } from "@/lib/coelba-align";
import templateCoelbaP1Url from "@/assets/template-coelba-p1-hq.webp";
import templateCoelbaP2Url from "@/assets/template-coelba-p2-hq.webp";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskCPF, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";

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
  nome: "GLEIDSON GALO PEDREIRA",
  cpf: "062.145.695-06",
  endereco: "RUA 3 TRAVESSA SÃO JOSÉ DO EGITO N 03",
  bairro: "FEDERAÇÃO",
  cep: "40220-535",
  municipio: "SALVADOR",
  uf: "BA",

  notaFiscal: "790922648",
  serieNf: "000",
  dataEmissao: "22/11/2024",
  chaveAcesso: "29240615139629000194660007909226482033595373",
  protocolo: "3292400031937930",
  protocoloData: "22/11/2024",
  protocoloHora: "13:47:00",

  referencia: "12/2024",
  totalPagar: "597,80",
  vencimento: "01/01/2025",

  leituraAnterior: "23/10/2024",
  leituraAtual: "22/12/2024",
  dias: "30",
  proximaLeitura: "24/01/2025",

  medPostos: "Único",
  medLeituraAnterior: "11.312,00",
  medLeituraAtual: "11.778,00",
  medConstante: "1,00000",
  medConsumo: "466,00",

  avisoData: "08/12/2024",
  debVenc1: "31/08/24",
  debReaviso1: "22/09/24",
  debValor1: "619,09",
  debVenc2: "",
  debReaviso2: "",
  debValor2: "",
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

export default function CoelbaFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { updateDocument } = useDocuments();
  const { toast } = useToast();

  const editState = location.state as { editDocId?: string; formData?: Record<string, string> } | null;
  const isEditMode = Boolean(editState?.editDocId);

  const [form, setForm] = useState<CoelbaFormData>(initial);
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
        loadTemplateBase64(templateCoelbaP1Url),
        loadTemplateBase64(templateCoelbaP2Url),
      ]);

      const bodyData = {
        nome: form.nome,
        cpf: form.cpf,
        endereco: form.endereco,
        bairro: form.bairro,
        cep: form.cep,
        municipio: form.municipio,
        uf: form.uf,

        nota_fiscal: form.notaFiscal,
        serie_nf: form.serieNf,
        data_emissao: form.dataEmissao,
        chave_acesso: form.chaveAcesso,
        protocolo: form.protocolo,
        protocolo_data: form.protocoloData,
        protocolo_hora: form.protocoloHora,

        referencia: form.referencia,
        total_pagar: form.totalPagar,
        vencimento: form.vencimento,

        leitura_anterior: form.leituraAnterior,
        leitura_atual: form.leituraAtual,
        dias: form.dias,
        proxima_leitura: form.proximaLeitura,

        med_postos: form.medPostos,
        med_leitura_anterior: form.medLeituraAnterior,
        med_leitura_atual: form.medLeituraAtual,
        med_constante: form.medConstante,
        med_consumo: form.medConsumo,

        aviso_data: form.avisoData,
        deb_venc1: form.debVenc1,
        deb_reaviso1: form.debReaviso1,
        deb_valor1: form.debValor1,
        deb_venc2: form.debVenc2,
        deb_reaviso2: form.debReaviso2,
        deb_valor2: form.debValor2,

        template_base64: templateBase64,
        template_p2_base64: templateP2Base64,
        field_positions: loadCoelbaFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-coelba-pdf", {
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
      navigate("/dashboard/documents/comprovante-coelba/preview", { state: { previewId: token } });
    } catch (err) {
      console.error("Erro ao gerar comprovante Coelba:", err);
      toast({ title: "Erro ao gerar o preview", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <h1 className="font-display mb-1 text-2xl font-bold text-foreground">Comprovante de Residência — Coelba</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Fatura Neoenergia Coelba (DANFE NF3e). Somente os campos removidos do documento são preenchidos — todo o
        restante do original é preservado.
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

        <Section icon={Receipt} title="Nota fiscal eletrônica">
          <Field label="Nota fiscal nº" value={form.notaFiscal} onChange={set("notaFiscal")} placeholder="790922648" />
          <Field label="Série" value={form.serieNf} onChange={set("serieNf")} placeholder="000" />
          <Field label="Data de emissão" value={form.dataEmissao} onChange={(v) => set("dataEmissao")(maskDate(v))} placeholder="22/11/2024" />
          <Field label="Chave de acesso (44 dígitos)" value={form.chaveAcesso} onChange={(v) => set("chaveAcesso")(v.replace(/\D/g, "").slice(0, 44))} maxLength={44} full placeholder="29240615139629000194660007909226482033595373" />
          <Field label="Protocolo de autorização" value={form.protocolo} onChange={set("protocolo")} placeholder="3292400031937930" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data do protocolo" value={form.protocoloData} onChange={(v) => set("protocoloData")(maskDate(v))} placeholder="22/11/2024" />
            <Field label="Hora" value={form.protocoloHora} onChange={set("protocoloHora")} placeholder="13:47:00" />
          </div>
        </Section>

        <Section icon={Home} title="Referência, valor e vencimento">
          <Field label="Referência (mês/ano)" value={form.referencia} onChange={set("referencia")} placeholder="12/2024" />
          <Field label="Total a pagar (R$)" value={form.totalPagar} onChange={set("totalPagar")} placeholder="597,80" />
          <Field label="Vencimento" value={form.vencimento} onChange={(v) => set("vencimento")(maskDate(v))} placeholder="01/01/2025" />
        </Section>

        <Section icon={Gauge} title="Datas de leituras">
          <Field label="Leitura anterior" value={form.leituraAnterior} onChange={(v) => set("leituraAnterior")(maskDate(v))} placeholder="23/10/2024" />
          <Field label="Leitura atual" value={form.leituraAtual} onChange={(v) => set("leituraAtual")(maskDate(v))} placeholder="22/12/2024" />
          <Field label="Nº de dias" value={form.dias} onChange={set("dias")} placeholder="30" />
          <Field label="Próxima leitura" value={form.proximaLeitura} onChange={(v) => set("proximaLeitura")(maskDate(v))} placeholder="24/01/2025" />
        </Section>

        <Section icon={Gauge} title="Linha do medidor">
          <Field label="Postos horários" value={form.medPostos} onChange={set("medPostos")} placeholder="Único" />
          <Field label="Constante do medidor" value={form.medConstante} onChange={set("medConstante")} placeholder="1,00000" />
          <Field label="Leitura anterior" value={form.medLeituraAnterior} onChange={set("medLeituraAnterior")} placeholder="11.312,00" />
          <Field label="Leitura atual" value={form.medLeituraAtual} onChange={set("medLeituraAtual")} placeholder="11.778,00" />
          <Field label="Consumo kWh" value={form.medConsumo} onChange={set("medConsumo")} placeholder="466,00" />
        </Section>

        <Section icon={AlertTriangle} title="Aviso e débitos anteriores (opcional)">
          <Field label="Data do aviso de suspensão" value={form.avisoData} onChange={(v) => set("avisoData")(maskDate(v))} full placeholder="08/12/2024" />
          <Field label="Vencto (1)" value={form.debVenc1} onChange={set("debVenc1")} placeholder="31/08/24" />
          <Field label="Dt reaviso (1)" value={form.debReaviso1} onChange={set("debReaviso1")} placeholder="22/09/24" />
          <Field label="Valor (1)" value={form.debValor1} onChange={set("debValor1")} placeholder="619,09" />
          <div />
          <Field label="Vencto (2)" value={form.debVenc2} onChange={set("debVenc2")} placeholder="" />
          <Field label="Dt reaviso (2)" value={form.debReaviso2} onChange={set("debReaviso2")} placeholder="" />
          <Field label="Valor (2)" value={form.debValor2} onChange={set("debValor2")} placeholder="" />
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
