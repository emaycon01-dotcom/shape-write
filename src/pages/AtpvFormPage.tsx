import { useState, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Car, User, UserCheck, FileText, Loader2, FlaskConical, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadAtpvFieldPositions } from "@/lib/atpv-align";
import templateAtpvUrl from "@/assets/template-atpv-bg-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskAlnumUpper, maskCpfCnpj, maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { pick, rnd } from "@/lib/random";

interface AtpvFormData {
  uf: string;
  renavam: string;
  placa: string;
  anoFabricacao: string;
  anoModelo: string;
  marcaModelo: string;
  cat: string;
  cor: string;
  chassi: string;
  numeroCrv: string;
  codigoSegurancaCrv: string;
  numeroAtpve: string;
  dataEmissaoCrv: string;
  hodometro: string;
  vendNome: string;
  vendCpf: string;
  vendEmail: string;
  vendMunicipio: string;
  vendUf: string;
  valorVenda: string;
  local: string;
  dataVenda: string;
  compNome: string;
  compCpf: string;
  compEmail: string;
  compMunicipio: string;
  compUf: string;
  compEndereco: string;
  mensagens: string;
}

const initial: AtpvFormData = {
  uf: "PE",
  renavam: "",
  placa: "",
  anoFabricacao: "",
  anoModelo: "",
  marcaModelo: "",
  cat: "***",
  cor: "",
  chassi: "",
  numeroCrv: "",
  codigoSegurancaCrv: "",
  numeroAtpve: "",
  dataEmissaoCrv: "",
  hodometro: "",
  vendNome: "",
  vendCpf: "",
  vendEmail: "",
  vendMunicipio: "",
  vendUf: "PE",
  valorVenda: "",
  local: "",
  dataVenda: "",
  compNome: "",
  compCpf: "",
  compEmail: "",
  compMunicipio: "",
  compUf: "PE",
  compEndereco: "",
  mensagens: "",
};

const NOMES = [
  "MARIA JOSE RODRIGUES XAVIER",
  "CARLOS FERREIRA LIMA",
  "ANA PAULA COSTA SILVA",
  "MARCOS ANTONIO DE SOUZA",
];

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function placaAleatoria() {
  const l = () => LETRAS[Math.floor(Math.random() * 26)];
  return `${l()}${l()}${l()}${rnd(1)}${l()}${rnd(2)}`;
}

export default function AtpvFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<AtpvFormData>(initial);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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
        setForm({
          uf: b.uf || initial.uf,
          renavam: b.renavam || "",
          placa: b.placa || "",
          anoFabricacao: b.ano_fabricacao || "",
          anoModelo: b.ano_modelo || "",
          marcaModelo: b.marca_modelo || "",
          cat: b.cat || "***",
          cor: b.cor || "",
          chassi: b.chassi || "",
          numeroCrv: b.numero_crv || "",
          codigoSegurancaCrv: b.codigo_seguranca_crv || "",
          numeroAtpve: b.numero_atpve || "",
          dataEmissaoCrv: b.data_emissao_crv || "",
          hodometro: b.hodometro || "",
          vendNome: b.vend_nome || "",
          vendCpf: b.vend_cpf || "",
          vendEmail: b.vend_email || "",
          vendMunicipio: b.vend_municipio || "",
          vendUf: b.vend_uf || "",
          valorVenda: b.valor_venda || "",
          local: b.local || "",
          dataVenda: b.data_venda || "",
          compNome: b.comp_nome || "",
          compCpf: b.comp_cpf || "",
          compEmail: b.comp_email || "",
          compMunicipio: b.comp_municipio || "",
          compUf: b.comp_uf || "",
          compEndereco: b.comp_endereco || "",
          mensagens: b.mensagens || "",
        });
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const fillTest = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const ano = hoje.getFullYear();
    const nomeVend = pick(NOMES);
    const nomeComp = pick(NOMES.filter((n) => n !== nomeVend));
    setForm({
      ...initial,
      uf: "PE",
      renavam: rnd(11),
      placa: placaAleatoria(),
      anoFabricacao: "2013",
      anoModelo: "2014",
      marcaModelo: "FIAT/PALIO ATTRACTIV 1.0",
      cat: "***",
      cor: "PRATA",
      chassi: `9BD1965${rnd(10)}`,
      numeroCrv: rnd(12),
      codigoSegurancaCrv: rnd(11),
      numeroAtpve: rnd(12),
      dataEmissaoCrv: `${dd}/${mm}/${ano - 1}`,
      hodometro: rnd(6),
      vendNome: nomeVend,
      vendCpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      vendEmail: "vendedor@email.com",
      vendMunicipio: "RECIFE",
      vendUf: "PE",
      valorVenda: "32.500,00",
      local: "RECIFE PE",
      dataVenda: `${dd}/${mm}/${ano}`,
      compNome: nomeComp,
      compCpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      compEmail: "comprador@email.com",
      compMunicipio: "JABOATAO DOS GUARARAPES",
      compUf: "PE",
      compEndereco: "RUA DAS FLORES, 250 - CENTRO - CEP 54000-000",
      mensagens: "",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof AtpvFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof AtpvFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    saveFormDraft("atpv", form as unknown as Record<string, unknown>);

    try {
      const templateBase64 = await loadTemplateObjectUrl(templateAtpvUrl);

      const bodyData = {
        uf: form.uf,
        renavam: form.renavam,
        placa: form.placa,
        ano_fabricacao: form.anoFabricacao,
        ano_modelo: form.anoModelo,
        marca_modelo: form.marcaModelo,
        cat: form.cat,
        cor: form.cor,
        chassi: form.chassi,
        numero_crv: form.numeroCrv,
        codigo_seguranca_crv: form.codigoSegurancaCrv,
        numero_atpve: form.numeroAtpve,
        data_emissao_crv: form.dataEmissaoCrv,
        hodometro: form.hodometro,
        vend_nome: form.vendNome,
        vend_cpf: form.vendCpf,
        vend_email: form.vendEmail,
        vend_municipio: form.vendMunicipio,
        vend_uf: form.vendUf,
        valor_venda: form.valorVenda,
        local: form.local,
        data_venda: form.dataVenda,
        comp_nome: form.compNome,
        comp_cpf: form.compCpf,
        comp_email: form.compEmail,
        comp_municipio: form.compMunicipio,
        comp_uf: form.compUf,
        comp_endereco: form.compEndereco,
        mensagens: form.mensagens,
        template_base64: templateBase64,
        field_positions: loadAtpvFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-atpv-pdf", {
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
        navigate("/dashboard/documents/atpv/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar PDF do ATPV-e:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">ATPV-e</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        <FormDraftsPanel docType="atpv" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />

        {/* VEÍCULO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Car} title="Identificação do veículo" />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>UF (DETRAN)</FieldLabel>
              <Input value={form.uf} onChange={set("uf")} placeholder="PE" maxLength={2} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Placa</FieldLabel>
              <Input value={form.placa} onChange={set("placa")} placeholder="NQK8I74" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Código RENAVAM</FieldLabel>
              <Input value={form.renavam} onChange={setMask("renavam", maskDigits(11))} inputMode="numeric" placeholder="00335436552" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Ano de fabricação</FieldLabel>
              <Input value={form.anoFabricacao} onChange={setMask("anoFabricacao", maskDigits(4))} inputMode="numeric" placeholder="2013" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ano do modelo</FieldLabel>
              <Input value={form.anoModelo} onChange={setMask("anoModelo", maskDigits(4))} inputMode="numeric" placeholder="2014" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>CAT</FieldLabel>
              <Input value={form.cat} onChange={set("cat")} placeholder="***" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Marca / Modelo / Versão</FieldLabel>
            <Input value={form.marcaModelo} onChange={set("marcaModelo")} placeholder="FIAT/PALIO ATTRACTIV 1.0" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Cor predominante</FieldLabel>
              <Input value={form.cor} onChange={set("cor")} placeholder="PRATA" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Chassi</FieldLabel>
              <Input value={form.chassi} onChange={setMask("chassi", maskAlnumUpper(17))} placeholder="9BD19650012345678" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Número do CRV</FieldLabel>
              <Input value={form.numeroCrv} onChange={setMask("numeroCrv", maskDigits(12))} inputMode="numeric" placeholder="213012407278" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Código de segurança do CRV</FieldLabel>
              <Input value={form.codigoSegurancaCrv} onChange={setMask("codigoSegurancaCrv", maskDigits(11))} inputMode="numeric" placeholder="02775028150" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Número do ATPV-e</FieldLabel>
              <Input value={form.numeroAtpve} onChange={setMask("numeroAtpve", maskDigits(12))} inputMode="numeric" placeholder="542652688000" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data de emissão do CRV</FieldLabel>
              <Input value={form.dataEmissaoCrv} onChange={setMask("dataEmissaoCrv", maskDate)} inputMode="numeric" placeholder="25/04/2023" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Hodômetro</FieldLabel>
              <Input value={form.hodometro} onChange={setMask("hodometro", maskDigits(7))} inputMode="numeric" placeholder="128450" className={inputCls} />
            </div>
          </div>
        </div>

        {/* VENDEDOR */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Vendedor" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome / Razão social</FieldLabel>
            <Input value={form.vendNome} onChange={set("vendNome")} placeholder="MARIA JOSE RODRIGUES XAVIER" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>CPF / CNPJ</FieldLabel>
              <Input value={form.vendCpf} onChange={setMask("vendCpf", maskCpfCnpj)} inputMode="numeric" placeholder="744.088.444-20" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>E-mail</FieldLabel>
              <Input value={form.vendEmail} onChange={set("vendEmail")} placeholder="vendedor@email.com" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel>Município</FieldLabel>
              <Input value={form.vendMunicipio} onChange={set("vendMunicipio")} placeholder="RECIFE" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>UF</FieldLabel>
              <Input value={form.vendUf} onChange={set("vendUf")} maxLength={2} placeholder="PE" className={inputCls} />
            </div>
          </div>
        </div>

        {/* VENDA */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={FileText} title="Dados da venda" />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Valor declarado (R$)</FieldLabel>
              <Input value={form.valorVenda} onChange={set("valorVenda")} placeholder="32.500,00" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Local</FieldLabel>
              <Input value={form.local} onChange={set("local")} placeholder="RECIFE PE" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data</FieldLabel>
              <Input value={form.dataVenda} onChange={setMask("dataVenda", maskDate)} inputMode="numeric" placeholder="25/04/2023" className={inputCls} />
            </div>
          </div>
        </div>

        {/* COMPRADOR */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={UserCheck} title="Comprador" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome / Razão social</FieldLabel>
            <Input value={form.compNome} onChange={set("compNome")} placeholder="CARLOS FERREIRA LIMA" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>CPF / CNPJ</FieldLabel>
              <Input value={form.compCpf} onChange={setMask("compCpf", maskCpfCnpj)} inputMode="numeric" placeholder="744.088.444-20" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>E-mail</FieldLabel>
              <Input value={form.compEmail} onChange={set("compEmail")} placeholder="comprador@email.com" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel>Município</FieldLabel>
              <Input value={form.compMunicipio} onChange={set("compMunicipio")} placeholder="JABOATAO DOS GUARARAPES" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>UF</FieldLabel>
              <Input value={form.compUf} onChange={set("compUf")} maxLength={2} placeholder="PE" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Endereço completo</FieldLabel>
            <Input value={form.compEndereco} onChange={set("compEndereco")} placeholder="RUA DAS FLORES, 250 - CENTRO - CEP 54000-000" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Mensagens do DENATRAN (opcional)</FieldLabel>
            <Input value={form.mensagens} onChange={set("mensagens")} placeholder="Deixe vazio para manter o padrão do documento" className={inputCls} />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando preview...</>
          ) : (
            isEditMode ? "Salvar alterações" : "Gerar Preview"
          )}
        </Button>
      </form>
    </div>
  );
}
