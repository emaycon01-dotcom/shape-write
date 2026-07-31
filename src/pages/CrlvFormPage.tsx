import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Car, User, Gauge, ShieldCheck, Loader2, FlaskConical, Trash2, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadCrlvFieldPositions } from "@/lib/crlv-align";
import templateCrlvUrl from "@/assets/template-crlv-bg-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";

interface CrlvFormData {
  uf: string;
  renavam: string;
  placa: string;
  exercicio: string;
  anoFabricacao: string;
  anoModelo: string;
  numeroCrv: string;
  codigoCla: string;
  cat: string;
  marcaModelo: string;
  especieTipo: string;
  placaAnterior: string;
  chassi: string;
  cor: string;
  combustivel: string;
  observacoes: string;
  categoria: string;
  capacidade: string;
  potencia: string;
  pesoBruto: string;
  motor: string;
  cmt: string;
  eixos: string;
  lotacao: string;
  carroceria: string;
  nome: string;
  cpfCnpj: string;
  local: string;
  data: string;
}

const initial: CrlvFormData = {
  uf: "PE",
  renavam: "",
  placa: "",
  exercicio: String(new Date().getFullYear()),
  anoFabricacao: "",
  anoModelo: "",
  numeroCrv: "",
  codigoCla: "",
  cat: "***",
  marcaModelo: "",
  especieTipo: "",
  placaAnterior: "",
  chassi: "",
  cor: "",
  combustivel: "",
  observacoes: "",
  categoria: "PARTICULAR",
  capacidade: "",
  potencia: "",
  pesoBruto: "",
  motor: "",
  cmt: "",
  eixos: "",
  lotacao: "",
  carroceria: "",
  nome: "",
  cpfCnpj: "",
  local: "",
  data: "",
};

function rnd(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

export default function CrlvFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<CrlvFormData>(initial);
  const [loading, setLoading] = useState(false);
  const [dpvatOpen, setDpvatOpen] = useState(false);
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
          exercicio: b.exercicio || "",
          anoFabricacao: b.ano_fabricacao || "",
          anoModelo: b.ano_modelo || "",
          numeroCrv: b.numero_crv || "",
          codigoCla: b.codigo_cla || "",
          cat: b.cat || "***",
          marcaModelo: b.marca_modelo || "",
          especieTipo: b.especie_tipo || "",
          placaAnterior: b.placa_anterior || "",
          chassi: b.chassi || "",
          cor: b.cor || "",
          combustivel: b.combustivel || "",
          observacoes: b.observacoes || "",
          categoria: b.categoria || "",
          capacidade: b.capacidade || "",
          potencia: b.potencia || "",
          pesoBruto: b.peso_bruto || "",
          motor: b.motor || "",
          cmt: b.cmt || "",
          eixos: b.eixos || "",
          lotacao: b.lotacao || "",
          carroceria: b.carroceria || "",
          nome: b.nome || "",
          cpfCnpj: b.cpf_cnpj || "",
          local: b.local || "",
          data: b.data || "",
        });
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const imgToBase64 = (url: string) => loadTemplateBase64(url);

  const fillTest = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const ano = hoje.getFullYear();
    setForm({
      ...initial,
      uf: "PE",
      renavam: rnd(11),
      placa: placaAleatoria(),
      exercicio: String(ano),
      anoFabricacao: "2011",
      anoModelo: "2011",
      numeroCrv: rnd(12),
      codigoCla: rnd(11),
      cat: "***",
      marcaModelo: "VW/8.120 EURO3",
      especieTipo: "CARGA CAMINHAO",
      placaAnterior: `${placaAleatoria()}/RN`,
      chassi: `9533452R8BR${rnd(6)}`,
      cor: "VERMELHA",
      combustivel: "DIESEL",
      observacoes: "CARGA,",
      categoria: "ALUGUEL",
      capacidade: "4.74",
      potencia: "115CV/4300",
      pesoBruto: "7.7",
      motor: "E2T03816 SUBSTITUIDO",
      cmt: "10.5",
      eixos: "2",
      lotacao: "03P",
      carroceria: "CARROCERIA FECHADA",
      nome: pick(NOMES),
      cpfCnpj: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      local: "JUREMA PE",
      data: `${dd}/${mm}/${ano}`,
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof CrlvFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const templateBase64 = await imgToBase64(templateCrlvUrl);

      const bodyData = {
        uf: form.uf,
        renavam: form.renavam,
        placa: form.placa,
        exercicio: form.exercicio,
        ano_fabricacao: form.anoFabricacao,
        ano_modelo: form.anoModelo,
        numero_crv: form.numeroCrv,
        codigo_cla: form.codigoCla,
        cat: form.cat,
        marca_modelo: form.marcaModelo,
        especie_tipo: form.especieTipo,
        placa_anterior: form.placaAnterior,
        chassi: form.chassi,
        cor: form.cor,
        combustivel: form.combustivel,
        observacoes: form.observacoes,
        categoria: form.categoria,
        capacidade: form.capacidade,
        potencia: form.potencia,
        peso_bruto: form.pesoBruto,
        motor: form.motor,
        cmt: form.cmt,
        eixos: form.eixos,
        lotacao: form.lotacao,
        carroceria: form.carroceria,
        nome: form.nome,
        cpf_cnpj: form.cpfCnpj,
        local: form.local,
        data: form.data,
        template_base64: templateBase64,
        field_positions: loadCrlvFieldPositions() ?? undefined,
      };

      const { data, error } = await supabase.functions.invoke("generate-crlv-pdf", {
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
        navigate("/dashboard/documents/crlv/preview", {
          state: { pdfBase64: pdfResult, formData: bodyData },
        });
      }
    } catch (err) {
      console.error("Erro ao gerar PDF do CRLV:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">CRLV Digital</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* IDENTIFICAÇÃO */}
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
              <FieldLabel required>Exercício</FieldLabel>
              <Input value={form.exercicio} onChange={set("exercicio")} placeholder="2023" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Código RENAVAM</FieldLabel>
              <Input value={form.renavam} onChange={set("renavam")} placeholder="00335436552" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Número do CRV</FieldLabel>
              <Input value={form.numeroCrv} onChange={set("numeroCrv")} placeholder="213012407278" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Ano de fabricação</FieldLabel>
              <Input value={form.anoFabricacao} onChange={set("anoFabricacao")} placeholder="2011" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Ano do modelo</FieldLabel>
              <Input value={form.anoModelo} onChange={set("anoModelo")} placeholder="2011" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Código de segurança do CLA</FieldLabel>
              <Input value={form.codigoCla} onChange={set("codigoCla")} placeholder="02775028150" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>CAT</FieldLabel>
              <Input value={form.cat} onChange={set("cat")} placeholder="***" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Marca / Modelo / Versão</FieldLabel>
            <Input value={form.marcaModelo} onChange={set("marcaModelo")} placeholder="VW/8.120 EURO3" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Espécie / Tipo</FieldLabel>
              <Input value={form.especieTipo} onChange={set("especieTipo")} placeholder="CARGA CAMINHAO" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Carroceria</FieldLabel>
              <Input value={form.carroceria} onChange={set("carroceria")} placeholder="CARROCERIA FECHADA" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Placa anterior / UF</FieldLabel>
              <Input value={form.placaAnterior} onChange={set("placaAnterior")} placeholder="NQK8874/RN" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Chassi</FieldLabel>
              <Input value={form.chassi} onChange={set("chassi")} placeholder="9533452R8BR155089" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Cor predominante</FieldLabel>
              <Input value={form.cor} onChange={set("cor")} placeholder="VERMELHA" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Combustível</FieldLabel>
              <Input value={form.combustivel} onChange={set("combustivel")} placeholder="DIESEL" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Observações do veículo</FieldLabel>
            <Input value={form.observacoes} onChange={set("observacoes")} placeholder="CARGA," className={inputCls} />
          </div>
        </div>

        {/* CARACTERÍSTICAS */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Gauge} title="Características técnicas" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Categoria</FieldLabel>
              <Input value={form.categoria} onChange={set("categoria")} placeholder="ALUGUEL" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Capacidade</FieldLabel>
              <Input value={form.capacidade} onChange={set("capacidade")} placeholder="4.74" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Potência / Cilindrada</FieldLabel>
              <Input value={form.potencia} onChange={set("potencia")} placeholder="115CV/4300" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Peso bruto total</FieldLabel>
              <Input value={form.pesoBruto} onChange={set("pesoBruto")} placeholder="7.7" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel>Motor</FieldLabel>
              <Input value={form.motor} onChange={set("motor")} placeholder="E2T03816" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>CMT</FieldLabel>
              <Input value={form.cmt} onChange={set("cmt")} placeholder="10.5" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Eixos</FieldLabel>
              <Input value={form.eixos} onChange={set("eixos")} placeholder="2" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Lotação</FieldLabel>
            <Input value={form.lotacao} onChange={set("lotacao")} placeholder="03P" className={inputCls} />
          </div>
        </div>

        {/* PROPRIETÁRIO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Proprietário e emissão" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="MARIA JOSE RODRIGUES XAVIER" className={inputCls} required />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>CPF / CNPJ</FieldLabel>
              <Input value={form.cpfCnpj} onChange={set("cpfCnpj")} placeholder="744.088.444-20" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Local</FieldLabel>
              <Input value={form.local} onChange={set("local")} placeholder="JUREMA PE" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Data</FieldLabel>
              <Input value={form.data} onChange={set("data")} placeholder="25/04/2023" className={inputCls} />
            </div>
          </div>
        </div>

        {/* DPVAT (opcional) */}
        <div className="glass rounded-xl p-6">
          <button
            type="button"
            onClick={() => setDpvatOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-bold text-foreground">Seguro DPVAT (opcional)</h2>
                <p className="text-[11px] text-muted-foreground">Deixe vazio para manter os asteriscos do padrão oficial</p>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${dpvatOpen ? "rotate-180" : ""}`} />
          </button>

          {dpvatOpen && (
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
              <p className="col-span-2 text-xs text-muted-foreground">
                O modelo oficial atual traz o bloco DPVAT preenchido com asteriscos. Esses campos são
                gerados automaticamente e não precisam de alteração.
              </p>
            </div>
          )}
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
