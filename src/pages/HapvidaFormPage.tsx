import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HeartPulse, User, Building2, Loader2, FlaskConical, Trash2, History, FileText, Stethoscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadHapvidaFieldPositions } from "@/lib/hapvida-align";
import templateHapvidaUrl from "@/assets/template-hapvida-bg-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskCPF, maskDate, maskDigits, maskPhone, maskTime } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { pick, rnd } from "@/lib/random";

/* ------------------------------------------------------------ unidades */

const UNIDADES = [
  {
    nome: "Hapvida - Fortaleza (Centro)",
    linha1: "Av. Heráclito Graça, 1001 - Centro, Fortaleza-CE,",
    linha2: "CEP: 60140-090 | Telefone: (85) 9 4002-3633",
  },
  {
    nome: "Hapvida - São Paulo (Paulista)",
    linha1: "Av. Paulista, 1450 - Bela Vista, São Paulo-SP,",
    linha2: "CEP: 01310-100 | Telefone: (11) 9 4002-3633",
  },
  {
    nome: "NotreDame Intermédica - Recife",
    linha1: "Av. Conselheiro Aguiar, 2333 - Boa Viagem, Recife-PE,",
    linha2: "CEP: 51020-020 | Telefone: (81) 9 4002-3633",
  },
];

const TIPOS_ATENDIMENTO = ["Urgência", "Emergência", "Eletivo", "Consulta"];

const ESPECIALIDADES = [
  "CLÍNICA MÉDICA",
  "ORTOPEDIA",
  "PEDIATRIA",
  "GINECOLOGIA",
  "CARDIOLOGIA",
  "OTORRINOLARINGOLOGIA",
];

interface HapvidaFormData {
  paciente: string;
  docTipo: "cpf" | "cns";
  docNumero: string;
  celular: string;
  nascimento: string;
  uf: string;
  tipoAtendimento: string;
  dataAtendimento: string;
  horaAtendimento: string;
  dias: string;
  cid: string;
  unidade: string;
  endereco1: string;
  endereco2: string;
  medico: string;
  crm: string;
  especialidade: string;
}

const initial: HapvidaFormData = {
  paciente: "",
  docTipo: "cpf",
  docNumero: "",
  celular: "",
  nascimento: "",
  uf: "CE",
  tipoAtendimento: "Urgência",
  dataAtendimento: "",
  horaAtendimento: "",
  dias: "1",
  cid: "",
  unidade: UNIDADES[0].nome,
  endereco1: UNIDADES[0].linha1,
  endereco2: UNIDADES[0].linha2,
  medico: "CARINE GONÇALVES LOPES PIETRZAKI",
  crm: "CRM 210827SP",
  especialidade: "CLÍNICA MÉDICA",
};



const NOMES = [
  "PATRICK DE MOURA CARVALHO",
  "JULIANA ALVES BEZERRA",
  "RENATO SANTOS DE OLIVEIRA",
  "LARISSA MENDES DA COSTA",
];

const CIDS = ["M54", "J11", "A09", "K29", "R51"];

export default function HapvidaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument, documents } = useDocuments();

  const previewHistory = documents.filter((d) => d.type === "hapvida").slice(0, 6);

  const [form, setForm] = useState<HapvidaFormData>(initial);
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
          paciente: b.paciente || "",
          docTipo: b.cns ? "cns" : "cpf",
          docNumero: b.cns || b.cpf || "",
          celular: b.celular || "",
          nascimento: b.nascimento || "",
          unidade: b.unidade_curta || b.unidade || p.unidade,
          uf: b.uf || p.uf,
          tipoAtendimento: b.tipo_atendimento || p.tipoAtendimento,
          dataAtendimento: b.data_atendimento || "",
          horaAtendimento: b.hora_atendimento || "",
          dias: b.dias || "1",
          cid: b.cid || "",
          endereco1: b.endereco1 || p.endereco1,
          endereco2: b.endereco2 || p.endereco2,
          medico: b.medico || p.medico,
          crm: b.crm || p.crm,
          especialidade: b.especialidade || p.especialidade,
        }));
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const fillTest = () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    setForm({
      ...initial,
      paciente: pick(NOMES),
      docNumero: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      celular: `(${rnd(2)}) ${rnd(5)}-${rnd(4)}`,
      nascimento: "14/05/1990",
      dataAtendimento: `${dd}/${mm}/${hoje.getFullYear()}`,
      horaAtendimento: `0${Math.floor(Math.random() * 8) + 1}:${rnd(2)}`,
      dias: String(Math.floor(Math.random() * 15) + 1),
      cid: pick(CIDS),
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof HapvidaFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof HapvidaFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const setUnidade = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    const known = UNIDADES.find((u) => u.nome === nome);
    setForm((p) => ({
      ...p,
      unidade: nome,
      endereco1: known ? known.linha1 : p.endereco1,
      endereco2: known ? known.linha2 : p.endereco2,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const templateBase64 = await loadTemplateBase64(templateHapvidaUrl);
      const horaCurta = form.horaAtendimento.slice(0, 5);
      const unidade = form.unidade.trim();

      const bodyData = {
        paciente: form.paciente,
        cpf: form.docTipo === "cpf" ? form.docNumero : "",
        cns: form.docTipo === "cns" ? form.docNumero : "",
        celular: form.celular,
        tipo_atendimento: form.tipoAtendimento,
        unidade,
        unidade_curta: unidade,
        endereco1: form.endereco1,
        endereco2: form.endereco2,
        endereco3: "",
        data_atendimento: form.dataAtendimento,
        hora_atendimento: form.horaAtendimento,
        dias: form.dias,
        cid: form.cid,
        nascimento: form.nascimento,
        uf: form.uf,
        medico: form.medico,
        crm: form.crm,
        especialidade: form.especialidade,
        data_emissao: form.dataAtendimento,
        emitido_em: `${form.dataAtendimento} ${horaCurta}`.trim(),
        liberado_data: form.dataAtendimento,
        liberado_hora: horaCurta,
        template_base64: templateBase64,
        field_positions: loadHapvidaFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-hapvida-pdf", {
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
        navigate("/dashboard/documents/hapvida/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar PDF HapVida:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Atestado HapVida / NotreDame</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PACIENTE */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Paciente" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome do Paciente</FieldLabel>
            <Input value={form.paciente} onChange={set("paciente")} placeholder="Ex: PATRICK DE MOURA CARVALHO" className={inputCls} required />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Documento</FieldLabel>
            <div className="flex gap-2">
              {(["cpf", "cns"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, docTipo: t }))}
                  className={`rounded-lg border px-4 py-1.5 text-xs font-semibold uppercase transition ${
                    form.docTipo === t
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Input
              value={form.docNumero}
              onChange={setMask("docNumero", form.docTipo === "cpf" ? maskCPF : maskDigits(15))} inputMode="numeric"
              placeholder={form.docTipo === "cpf" ? "000.000.000-00" : "801440458570767"}
              className={inputCls}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Celular</FieldLabel>
              <Input value={form.celular} onChange={setMask("celular", maskPhone)} inputMode="numeric" placeholder="(34) 99649-7562" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de Nascimento</FieldLabel>
              <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="14/05/1990" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* ATENDIMENTO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Stethoscope} title="Atendimento" />

          <div className="space-y-1.5">
            <FieldLabel required>Tipo de atendimento</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TIPOS_ATENDIMENTO.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tipoAtendimento: t }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    form.tipoAtendimento === t
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Data do Atendimento</FieldLabel>
              <Input value={form.dataAtendimento} onChange={setMask("dataAtendimento", maskDate)} inputMode="numeric" placeholder="27/01/2025" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Hora do Atendimento</FieldLabel>
              <Input value={form.horaAtendimento} onChange={setMask("horaAtendimento", maskTime)} inputMode="numeric" placeholder="09:46" className={inputCls} required />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A data de emissão, a validade do atestado e o rodapé são preenchidos automaticamente com estes valores.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Dias de afastamento</FieldLabel>
              <Input type="number" min={1} max={180} value={form.dias} onChange={set("dias")} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>CID</FieldLabel>
              <Input value={form.cid} onChange={set("cid")} placeholder="M54" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* UNIDADE E PROFISSIONAL */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Building2} title="Unidade e profissional" />

          <div className="space-y-1.5">
            <FieldLabel required>Unidade</FieldLabel>
            <Input
              value={form.unidade}
              onChange={setUnidade}
              list="hapvida-unidades"
              placeholder="Ex: Hapvida - Fortaleza (Centro)"
              className={inputCls}
              required
            />
            <datalist id="hapvida-unidades">
              {UNIDADES.map((u) => <option key={u.nome} value={u.nome} />)}
            </datalist>
            <p className="text-[11px] text-muted-foreground">
              Digite livremente o nome da unidade. As sugestões preenchem o endereço automaticamente.
            </p>
          </div>


          <div className="space-y-1.5">
            <FieldLabel>Endereço - linha 1</FieldLabel>
            <Input value={form.endereco1} onChange={set("endereco1")} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Endereço - linha 2 (CEP e telefone)</FieldLabel>
            <Input value={form.endereco2} onChange={set("endereco2")} className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel required>Médico(a)</FieldLabel>
            <Input value={form.medico} onChange={set("medico")} className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>CRM</FieldLabel>
              <Input value={form.crm} onChange={set("crm")} placeholder="CRM 210827SP" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Especialidade</FieldLabel>
              <Input
                value={form.especialidade}
                onChange={set("especialidade")}
                list="hapvida-especialidades"
                className={inputCls}
                required
              />
              <datalist id="hapvida-especialidades">
                {ESPECIALIDADES.map((e) => <option key={e} value={e} />)}
              </datalist>
            </div>
          </div>
        </div>

        {/* HISTÓRICO */}
        <div className="glass space-y-3 rounded-xl p-6">
          <SectionHeader icon={History} title="Histórico de Previews" />
          {previewHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atestado HapVida gerado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {previewHistory.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{d.name || "Sem nome"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {d.identification} · {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 text-xs"
                    onClick={() => navigate("/dashboard/history", { state: { focusDocId: d.id } })}
                  >
                    <FileText className="h-3.5 w-3.5" /> Abrir
                  </Button>
                </li>
              ))}
            </ul>
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
