import { useState, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FlaskConical, Trash2, FileText, User, Building2, Scroll } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadObitoFieldPositions } from "@/lib/obito-align";
import templateObitoUrl from "@/assets/template-obito-bg-hq.webp";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskCPF, maskPhone, maskCEP } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { ESTADOS_UF } from "@/lib/brasoes-estados";
import { rnd } from "@/lib/random";

interface ObitoFormData {
  nome: string;
  cpf: string;
  matricula: string;
  sexo: string;
  cor: string;
  estadoCivil: string;
  naturalidade: string;
  documentoId: string;
  eleitor: string;
  filiacao: string;
  dataFalecimento: string;
  horaFalecimento: string;
  localFalecimento: string;
  causaMorte: string;
  sepultamento: string;
  declarante: string;
  medico: string;
  averbacoes: string;
  anotacoes: string;
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

const initial: ObitoFormData = {
  nome: "",
  cpf: "SEM INFORMAÇÃO",
  matricula: "",
  sexo: "FEMININO",
  cor: "BRANCA",
  estadoCivil: "",
  naturalidade: "",
  documentoId: "SEM INFORMAÇÃO",
  eleitor: "SIM",
  filiacao: "",
  dataFalecimento: "",
  horaFalecimento: "",
  localFalecimento: "",
  causaMorte: "",
  sepultamento: "",
  declarante: "",
  medico: "",
  averbacoes: "",
  anotacoes: "",
  dataEmissao: "",

  cartorioCidade: "São Paulo - 20º Subdistrito - Jardim América",
  cartorioUf: "SP",
  oficial: "Liana Varzella Mimary",
  escrevente: "Amanda Silva Ferreira",
  cartorioEndereco: "Rua Henrique Schaumann, 518 - Pinheiros - CEP:",
  cartorioCep: "05413-010",
  cartorioEmail: "certidoes@cartoriojardimamerica.com.br",
  cartorioTelefone: "(11) 30819388",
};


export default function ObitoFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<ObitoFormData>(initial);
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
          cpf: b.cpf || p.cpf,
          matricula: b.matricula || "",
          sexo: b.sexo || p.sexo,
          cor: b.cor || p.cor,
          estadoCivil: b.estado_civil || "",
          naturalidade: b.naturalidade || "",
          documentoId: b.documento_id || p.documentoId,
          eleitor: b.eleitor || p.eleitor,
          filiacao: b.filiacao || "",
          dataFalecimento: b.data_falecimento || "",
          horaFalecimento: b.hora_falecimento || "",
          localFalecimento: b.local_falecimento || "",
          causaMorte: b.causa_morte || "",
          sepultamento: b.sepultamento || "",
          declarante: b.declarante || "",
          medico: b.medico || "",
          averbacoes: b.averbacoes || "",
          anotacoes: b.anotacoes || "",
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

  const set = (field: keyof ObitoFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof ObitoFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    setForm({
      ...initial,
      nome: "Elis Regina Carvalho Costa",
      matricula: `${rnd(6)} 01 55 1982 4 ${rnd(5)} ${rnd(3)} ${rnd(7)} ${rnd(2)}`,
      estadoCivil: "DESQUITADA - 36 ANOS DE IDADE",
      naturalidade: "DE PORTO ALEGRE, RIO GRANDE DO SUL",
      filiacao:
        "RESIDENTE NA RUA DR. MELO ALVES, N° 668, APARTAMENTO 52, SÃO PAULO *** FILIAÇÃO: ROMEU DE OLIVEIRA COSTA E ERCY CARVALHO COSTA. ***",
      dataFalecimento: "19/01/1982",
      horaFalecimento: "12:00 H",
      localFalecimento: "NO HOSPITAL DAS CLÍNICAS ***",
      causaMorte: "INDETERMINADA ***",
      sepultamento: "SEPULTAMENTO REALIZADO NO CEMITÉRIO DO MORUMBI.",
      declarante: "Rogerio Carvalho Costa",
      medico: "DR. JOSÉ LUIZ LOURENÇÃO CRM Nº 20011 ***",
      averbacoes:
        "ERA DESQUITADA DE RONALDO FERNANDES ESQUERDO BOSCOLI, DEIXANDO UM FILHO DE NOME: JOÃO MARCELO, COM ONZE ANOS. DEIXOU BENS. ERA ELEITORA. DEIXOU, DE OUTRA UNIÃO, DOIS FILHOS DE NOMES: PEDRO E MARIA RITA, COM SEIS E QUATRO ANOS, RESPECTIVAMENTE. ATO REGISTRADO NO LIVRO C-0154, ÀS FLS. 126, SOB Nº 70150, EM VINTE E UM DE JANEIRO DE MIL NOVECENTOS E OITENTA E DOIS (21/01/1982), CONFORME DECLARAÇÃO Nº 026010, EXPEDIDA PELO SERVIÇO FUNERÁRIO. NADA MAIS ME CUMPRE CERTIFICAR. ***",
      dataEmissao: "11/01/2022",
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
    saveFormDraft("obito", form as unknown as Record<string, unknown>);

    try {
      const templateBase64 = await loadTemplateObjectUrl(templateObitoUrl);

      const bodyData = {
        nome: form.nome,
        cpf: form.cpf,
        matricula: form.matricula,
        sexo: form.sexo,
        cor: form.cor,
        estado_civil: form.estadoCivil,
        naturalidade: form.naturalidade,
        documento_id: form.documentoId,
        eleitor: form.eleitor,
        filiacao: form.filiacao,
        data_falecimento: form.dataFalecimento,
        hora_falecimento: form.horaFalecimento,
        local_falecimento: form.localFalecimento,
        causa_morte: form.causaMorte,
        sepultamento: form.sepultamento,
        declarante: form.declarante,
        medico: form.medico,
        averbacoes: form.averbacoes,
        anotacoes: form.anotacoes,
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
        field_positions: loadObitoFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-obito-pdf", {
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
        navigate("/dashboard/documents/certidao-obito/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar Certidão de Óbito:", err);
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

      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Certidão de Óbito</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <FormDraftsPanel docType="obito" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        {/* FALECIDO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do falecido" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome completo</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="Ex: Elis Regina Carvalho Costa" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>CPF</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", (v) => (/\d/.test(v) ? maskCPF(v) : v))} placeholder="000.000.000-00 ou SEM INFORMAÇÃO" className={inputCls} />
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
            <Input value={form.matricula} onChange={set("matricula")} placeholder="122721 01 55 1982 4 00154 126 0070150 42" className={inputCls} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Cor</FieldLabel>
              <select value={form.cor} onChange={(e) => setForm((p) => ({ ...p, cor: e.target.value }))} className={selectCls}>
                {["BRANCA", "PARDA", "PRETA", "AMARELA", "INDÍGENA", "IGNORADA"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Eleitor</FieldLabel>
              <select value={form.eleitor} onChange={(e) => setForm((p) => ({ ...p, eleitor: e.target.value }))} className={selectCls}>
                <option value="SIM">SIM</option>
                <option value="NÃO">NÃO</option>
                <option value="SEM INFORMAÇÃO">SEM INFORMAÇÃO</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Estado civil e idade</FieldLabel>
            <Input value={form.estadoCivil} onChange={set("estadoCivil")} placeholder="DESQUITADA - 36 ANOS DE IDADE" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Naturalidade</FieldLabel>
              <Input value={form.naturalidade} onChange={set("naturalidade")} placeholder="DE PORTO ALEGRE, RIO GRANDE DO SUL" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Documento de identificação</FieldLabel>
              <Input value={form.documentoId} onChange={set("documentoId")} className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Filiação e residência</FieldLabel>
            <Textarea value={form.filiacao} onChange={set("filiacao")} rows={3} placeholder="RESIDENTE NA RUA... *** FILIAÇÃO: PAI E MÃE. ***" className={inputCls} required />
          </div>
        </div>

        {/* ÓBITO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Scroll} title="Dados do óbito" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel required>Data do falecimento</FieldLabel>
              <Input value={form.dataFalecimento} onChange={setMask("dataFalecimento", maskDate)} inputMode="numeric" placeholder="19/01/1982" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Hora do falecimento</FieldLabel>
              <Input value={form.horaFalecimento} onChange={set("horaFalecimento")} placeholder="12:00 H" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Local do falecimento</FieldLabel>
            <Input value={form.localFalecimento} onChange={set("localFalecimento")} placeholder="NO HOSPITAL DAS CLÍNICAS ***" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Causa da morte</FieldLabel>
            <Input value={form.causaMorte} onChange={set("causaMorte")} placeholder="INDETERMINADA ***" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Sepultamento / cremação</FieldLabel>
              <Input value={form.sepultamento} onChange={set("sepultamento")} placeholder="SEPULTAMENTO REALIZADO NO CEMITÉRIO..." className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Declarante</FieldLabel>
              <Input value={form.declarante} onChange={set("declarante")} placeholder="Nome do declarante" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Médico que atestou o óbito</FieldLabel>
            <Input value={form.medico} onChange={set("medico")} placeholder="DR. JOSÉ LUIZ LOURENÇÃO CRM Nº 20011 ***" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Averbações / anotações a acrescer</FieldLabel>
            <Textarea value={form.averbacoes} onChange={set("averbacoes")} rows={6} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Anotações de cadastro</FieldLabel>
            <Input value={form.anotacoes} onChange={set("anotacoes")} placeholder="Deixe vazio para manter SEM INFORMAÇÕES." className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Data de emissão</FieldLabel>
            <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="11/01/2022" className={inputCls} required />
          </div>
        </div>

        {/* CARTÓRIO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Building2} title="Cartório" />

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <FieldLabel required>Cidade / subdistrito</FieldLabel>
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

        <div className="flex justify-center pt-1">
          <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
            ) : isEditMode ? (
              <><FileText className="mr-2 h-5 w-5" /> Salvar alterações</>
            ) : (
              <><Scroll className="mr-2 h-5 w-5" /> Gerar preview</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
