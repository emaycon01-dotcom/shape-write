import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BabyIcon, Loader2, FlaskConical, Trash2, FileText, User, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadCertidaoFieldPositions } from "@/lib/certidao-align";
import templateCertidaoUrl from "@/assets/template-certidao-bg-hq.webp";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskTime, maskCPF, maskPhone, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";

interface CertidaoFormData {
  nome: string;
  cpf: string;
  matricula: string;
  dataNasc: string;
  horaNasc: string;
  naturalidade: string;
  municipioRegistro: string;
  localNasc: string;
  sexo: string;
  filiacao: string;
  avos: string;
  gemeos: string;
  nomeGemeos: string;
  dataRegistro: string;
  dataEmissao: string;

  cartorioCidade: string;
  cartorioUf: string;
  oficial: string;
  escrevente: string;
  cartorioEndereco: string;
  cartorioCep: string;
  cartorioEmail: string;
  cartorioTelefone: string;
}

const initial: CertidaoFormData = {
  nome: "",
  cpf: "",
  matricula: "",
  dataNasc: "",
  horaNasc: "",
  naturalidade: "",
  municipioRegistro: "",
  localNasc: "",
  sexo: "FEMININO",
  filiacao: "",
  avos: "",
  gemeos: "NÃO",
  nomeGemeos: "",
  dataRegistro: "",
  dataEmissao: "",

  cartorioCidade: "São José dos Pinhais",
  cartorioUf: "PR",
  oficial: "Lidia Kruppizak",
  escrevente: "Valdinei Simões Custodio",
  cartorioEndereco: "Rua Doutor Motta Júnior, 1309 - Centro - CEP:",
  cartorioCep: "83005-170",
  cartorioEmail: "cartorioadmsjp@gmail.com",
  cartorioTelefone: "(41) 30811616",
};

function rnd(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}

export default function CertidaoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<CertidaoFormData>(initial);
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
        setForm((p) => ({
          ...p,
          nome: b.nome || "",
          cpf: b.cpf || "",
          matricula: b.matricula || "",
          dataNasc: b.data_nasc || "",
          horaNasc: b.hora_nasc || "",
          naturalidade: b.naturalidade || "",
          municipioRegistro: b.municipio_registro || "",
          localNasc: b.local_nasc || "",
          sexo: b.sexo || p.sexo,
          filiacao: b.filiacao || "",
          avos: b.avos || "",
          gemeos: b.gemeos || p.gemeos,
          nomeGemeos: b.nome_gemeos || "",
          dataRegistro: b.data_registro || "",
          dataEmissao: b.data_emissao || "",
          cartorioCidade: b.cartorio_cidade || p.cartorioCidade,
          cartorioUf: b.cartorio_uf || p.cartorioUf,
          oficial: b.oficial || p.oficial,
          escrevente: b.escrevente || p.escrevente,
          cartorioEndereco: b.cartorio_endereco || p.cartorioEndereco,
          cartorioCep: b.cartorio_cep || p.cartorioCep,
          cartorioEmail: b.cartorio_email || p.cartorioEmail,
          cartorioTelefone: b.cartorio_telefone || p.cartorioTelefone,
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const set = (field: keyof CertidaoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof CertidaoFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    setForm({
      ...initial,
      nome: "Caroline Coan Leal",
      cpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      matricula: `${rnd(6)} 01 55 1990 1 ${rnd(5)} ${rnd(3)} ${rnd(7)} ${rnd(2)}`,
      dataNasc: "27/02/1990",
      horaNasc: "23H 20MIN",
      naturalidade: "São José dos Pinhais-PR",
      municipioRegistro: "São José dos Pinhais-PR",
      localNasc: "Novaclínica Hospital e Maternidade, São José dos Pinhais-PR",
      filiacao: "Jorge Carlos Fernandes Leal e Edna Maria Coan",
      avos: "Antonio de Freitas Leal, Odete Fernandes Leal, Alfredo Domingo Coan e Erica Pacheco Coan",
      dataRegistro: "05/03/1990",
      dataEmissao: "01/02/2023",
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const templateBase64 = await loadTemplateBase64(templateCertidaoUrl);

      const bodyData = {
        nome: form.nome,
        cpf: form.cpf,
        matricula: form.matricula,
        data_nasc: form.dataNasc,
        hora_nasc: form.horaNasc,
        naturalidade: form.naturalidade,
        municipio_registro: form.municipioRegistro,
        local_nasc: form.localNasc,
        sexo: form.sexo,
        filiacao: form.filiacao,
        avos: form.avos,
        gemeos: form.gemeos,
        nome_gemeos: form.nomeGemeos,
        data_registro: form.dataRegistro,
        data_emissao: form.dataEmissao,

        cartorio_cidade: form.cartorioCidade,
        cartorio_uf: form.cartorioUf,
        oficial: form.oficial,
        escrevente: form.escrevente,
        cartorio_endereco: form.cartorioEndereco,
        cartorio_cep: form.cartorioCep,
        cartorio_email: form.cartorioEmail,
        cartorio_telefone: form.cartorioTelefone,

        template_base64: templateBase64,
        field_positions: loadCertidaoFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-certidao-pdf", {
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
        navigate("/dashboard/documents/certidao-nascimento/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Certidão de Nascimento:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Certidão de Nascimento</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* REGISTRADO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do registrado" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="Ex: Caroline Coan Leal" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>CPF</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="000.000.000-00" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Sexo</FieldLabel>
              <select value={form.sexo} onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value }))} className={selectCls}>
                <option value="FEMININO">FEMININO</option>
                <option value="MASCULINO">MASCULINO</option>
                <option value="IGNORADO">IGNORADO</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Matrícula</FieldLabel>
            <Input value={form.matricula} onChange={set("matricula")} placeholder="000687 01 55 1990 1 00031 189 0031464 43" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Data de nascimento</FieldLabel>
              <Input value={form.dataNasc} onChange={setMask("dataNasc", maskDate)} inputMode="numeric" placeholder="27/02/1990" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Hora de nascimento</FieldLabel>
              <Input value={form.horaNasc} onChange={set("horaNasc")} placeholder="23H 20MIN" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Naturalidade</FieldLabel>
            <Input value={form.naturalidade} onChange={set("naturalidade")} placeholder="São José dos Pinhais-PR" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Município de registro e UF</FieldLabel>
            <Input value={form.municipioRegistro} onChange={set("municipioRegistro")} placeholder="São José dos Pinhais-PR" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Local, município de nascimento e UF</FieldLabel>
            <Input value={form.localNasc} onChange={set("localNasc")} placeholder="Hospital e Maternidade, Cidade-UF" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Filiação</FieldLabel>
            <Input value={form.filiacao} onChange={set("filiacao")} placeholder="Pai e Mãe" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Avós</FieldLabel>
            <Input value={form.avos} onChange={set("avos")} placeholder="Avô paterno, avó paterna, avô materno e avó materna" className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Gêmeos</FieldLabel>
              <select value={form.gemeos} onChange={(e) => setForm((p) => ({ ...p, gemeos: e.target.value }))} className={selectCls}>
                <option value="NÃO">NÃO</option>
                <option value="SIM">SIM</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <FieldLabel>Nome e matrícula dos gêmeos</FieldLabel>
              <Input value={form.nomeGemeos} onChange={set("nomeGemeos")} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Data do registro</FieldLabel>
              <Input value={form.dataRegistro} onChange={setMask("dataRegistro", maskDate)} inputMode="numeric" placeholder="05/03/1990" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de emissão</FieldLabel>
              <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="01/02/2023" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* CARTÓRIO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Building2} title="Cartório" />

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel required>Cidade</FieldLabel>
              <Input value={form.cartorioCidade} onChange={set("cartorioCidade")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>UF</FieldLabel>
              <select value={form.cartorioUf} onChange={(e) => setForm((p) => ({ ...p, cartorioUf: e.target.value }))} className={selectCls}>
                {ESTADOS_UF.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Oficial</FieldLabel>
              <Input value={form.oficial} onChange={set("oficial")} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Escrevente</FieldLabel>
              <Input value={form.escrevente} onChange={set("escrevente")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Endereço</FieldLabel>
            <Input value={form.cartorioEndereco} onChange={set("cartorioEndereco")} className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>CEP</FieldLabel>
              <Input value={form.cartorioCep} onChange={setMask("cartorioCep", maskCEP)} inputMode="numeric" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Telefone</FieldLabel>
              <Input value={form.cartorioTelefone} onChange={setMask("cartorioTelefone", maskPhone)} inputMode="numeric" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>E-mail</FieldLabel>
              <Input value={form.cartorioEmail} onChange={set("cartorioEmail")} className={inputCls} />
            </div>
          </div>
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
          ) : isEditMode ? (
            <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
          ) : (
            <><BabyIcon className="mr-2 h-5 w-5" /> Gerar preview</>
          )}
        </Button>
      </form>
    </div>
  );
}
