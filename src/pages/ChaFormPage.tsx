import { useState, useRef, useEffect } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, User, Anchor, Ship, Loader2, FlaskConical, Trash2 } from "lucide-react";
import { ModuleNotice } from "@/components/ModuleNotice";
import { useToast } from "@/hooks/use-toast";
import { loadChaFieldPositions } from "@/lib/cha-align";
import testFotoUrl from "@/assets/test-foto.png";
import templateChaUrl from "@/assets/template-cha-bg-hq.webp";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskCPF, maskDate } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { syncChaToExternal } from "@/lib/cha-external-sync";
import { storePreviewPayload } from "@/lib/preview-payload";
import { pick, rnd } from "@/lib/random";

/** Categorias oficiais da CHA (Carteira de Habilitação de Amador) */
export const CHA_CATEGORIAS: { pt: string; en: string }[] = [
  { pt: "MOTONAUTA", en: "PERSONAL WATERCRAFT PILOT" },
  { pt: "VELEIRO", en: "SAILING BOAT PILOT" },
  { pt: "ARRAIS-AMADOR", en: "MOTORBOAT PILOT" },
  { pt: "MESTRE-AMADOR", en: "AMATEUR MASTER" },
  { pt: "CAPITÃO-AMADOR", en: "AMATEUR CAPTAIN" },
];

const LIMITES = [
  "INTERIOR. / INLAND WATERS.",
  "INTERIOR E COSTEIRA. / INLAND AND COASTAL WATERS.",
  "COSTEIRA. / COASTAL WATERS.",
  "MAR ABERTO. / OPEN SEA.",
];

interface ChaFormData {
  nome: string;
  cpf: string;
  nascimento: string;
  categoria: string;
  categoriaEn: string;
  validade: string;
  inscricao: string;
  limites: string;
  requisitos: string;
  orgao: string;
  dataEmissao: string;
  fotoData: string;
}

const initial: ChaFormData = {
  nome: "",
  cpf: "",
  nascimento: "",
  categoria: "MOTONAUTA",
  categoriaEn: "PERSONAL WATERCRAFT PILOT",
  validade: "",
  inscricao: "",
  limites: LIMITES[0],
  requisitos: "******** / ********",
  orgao: "MARINHA DO BRASIL",
  dataEmissao: "",
  fotoData: "",
};



const NOMES = ["ADEMAR SOUSA", "RICARDO ALVES MOREIRA", "PATRICIA NUNES DE LIMA", "FABIO SANTOS ROCHA"];

export default function ChaFormPage() {
  const location = useLocation();
  const editState = location.state as { editDocId?: string } | null;
  const { getDocument, loadDocumentInfo, updateDocument } = useDocuments();

  const [form, setForm] = useState<ChaFormData>(initial);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

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
          nome: b.nome || "",
          cpf: b.cpf || "",
          nascimento: b.nascimento || "",
          categoria: b.categoria || initial.categoria,
          categoriaEn: b.categoria_en || initial.categoriaEn,
          validade: b.validade || "",
          inscricao: b.inscricao || "",
          limites: b.limites || initial.limites,
          requisitos: b.requisitos || initial.requisitos,
          orgao: b.orgao || initial.orgao,
          dataEmissao: b.data_emissao || "",
          fotoData: b.foto_data || "",
        });
        setFotoPreview(b.foto_base64 || null);
        setHydrated(true);
      } catch { /* payload inválido */ }
    })();
    return () => { cancelled = true; };
  }, [hydrated, editState?.editDocId, getDocument, loadDocumentInfo]);

  const imgToBase64 = (url: string) => loadTemplateBase64(url);

  const fillTest = async () => {
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, "0");
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const emissao = `${dd}/${mm}/${hoje.getFullYear()}`;
    const validade = `${dd}/${mm}/${hoje.getFullYear() + 5}`;
    const cat = pick(CHA_CATEGORIAS);

    setFotoPreview(await imgToBase64(testFotoUrl));
    setForm({
      ...initial,
      nome: pick(NOMES),
      cpf: `${rnd(3)}.${rnd(3)}.${rnd(3)}-${rnd(2)}`,
      nascimento: `0${Math.floor(Math.random() * 9) + 1}/0${Math.floor(Math.random() * 9) + 1}/19${Math.floor(Math.random() * 40) + 60}`,
      categoria: cat.pt,
      categoriaEn: cat.en,
      validade,
      inscricao: `${rnd(3)}A${hoje.getFullYear() - 6}${rnd(6)}`,
      dataEmissao: emissao,
      fotoData: emissao,
    });
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm(initial);
    setFotoPreview(null);
    if (fotoRef.current) fotoRef.current.value = "";
    toast({ title: "Formulário limpo!" });
  };

  const set = (field: keyof ChaFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const setMask = (field: keyof ChaFormData, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    saveFormDraft("cha", form as unknown as Record<string, unknown>);

    try {
      const templateBase64 = await imgToBase64(templateChaUrl);

      const bodyData = {
        nome: form.nome,
        cpf: form.cpf,
        nascimento: form.nascimento,
        categoria: form.categoria,
        categoria_en: form.categoriaEn,
        validade: form.validade,
        inscricao: form.inscricao,
        limites: form.limites,
        requisitos: form.requisitos,
        orgao: form.orgao,
        data_emissao: form.dataEmissao,
        foto_data: form.fotoData || form.dataEmissao,
        foto_base64: fotoPreview || "",
        template_base64: templateBase64,
        field_positions: loadChaFieldPositions() ?? undefined,
      };

      const { data, error } = await invokeGeneratePdf("generate-cha-pdf", {
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
        toast({ title: "Documento atualizado", description: "Atualizando o registro do QR Code..." });
        const resync = await syncChaToExternal(pdfResult, bodyData as unknown as Record<string, string>);
        toast(
          resync.ok
            ? { title: "QR Code atualizado", description: `Registro ${resync.documentoId} sincronizado.` }
            : {
                title: "Falha ao atualizar o QR Code",
                description: "O PDF foi atualizado, mas o registro externo não foi sincronizado.",
                variant: "destructive" as const,
              }
        );
        navigate("/dashboard/history");
      } else {
        const previewId = storePreviewPayload({ pdfBase64: pdfResult, formData: bodyData });
        navigate("/dashboard/documents/cha/preview", { state: { previewId } });
      }
    } catch (err) {
      console.error("Erro ao gerar PDF da CNH Marítima:", err);
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
      <ModuleNotice />
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">CNH Marítima (CHA)</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        <FormDraftsPanel docType="cha" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        {/* AMADOR */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={User} title="Dados do Amador" />

          <div className="space-y-1.5">
            <FieldLabel required>Nome</FieldLabel>
            <Input value={form.nome} onChange={set("nome")} placeholder="Ex: ADEMAR SOUSA" className={inputCls} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Data de Nascimento</FieldLabel>
              <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="03/02/1998" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>CPF</FieldLabel>
              <Input value={form.cpf} onChange={setMask("cpf", maskCPF)} inputMode="numeric" placeholder="021.020.120-77" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Foto 3x4</FieldLabel>
              {fotoPreview ? (
                <div className="relative inline-block">
                  <img src={fotoPreview} alt="Foto do amador" className="h-32 w-24 rounded-lg border border-border object-cover" />
                  <button
                    type="button"
                    onClick={() => { setFotoPreview(null); if (fotoRef.current) fotoRef.current.value = ""; }}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fotoRef.current?.click()}
                  className="flex h-32 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-secondary/50 text-muted-foreground"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px]">Enviar</span>
                </button>
              )}
              <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Data na foto</FieldLabel>
              <Input value={form.fotoData} onChange={setMask("fotoData", maskDate)} inputMode="numeric" placeholder="09/07/2026" className={inputCls} />
              <p className="text-[11px] text-muted-foreground">Selo de data exibido no rodapé da foto.</p>
            </div>
          </div>
        </div>

        {/* HABILITAÇÃO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Anchor} title="Habilitação" />

          <div className="space-y-1.5">
            <FieldLabel required>Categoria</FieldLabel>
            <Select
              value={form.categoria}
              onValueChange={(v) => {
                const cat = CHA_CATEGORIAS.find((c) => c.pt === v);
                setForm((p) => ({ ...p, categoria: v, categoriaEn: cat?.en || p.categoriaEn }));
              }}
            >
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CHA_CATEGORIAS.map((c) => (
                  <SelectItem key={c.pt} value={c.pt}>{c.pt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Categoria (inglês)</FieldLabel>
            <Input value={form.categoriaEn} onChange={set("categoriaEn")} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel required>Data de Validade</FieldLabel>
              <Input value={form.validade} onChange={setMask("validade", maskDate)} inputMode="numeric" placeholder="07/07/2031" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Nº de Inscrição</FieldLabel>
              <Input value={form.inscricao} onChange={set("inscricao")} placeholder="085A2020066044" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={Ship} title="Navegação e Emissão" />

          <div className="space-y-1.5">
            <FieldLabel>Limites da Navegação</FieldLabel>
            <Select value={form.limites} onValueChange={(v) => setForm((p) => ({ ...p, limites: v }))}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {LIMITES.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Requisitos para conduzir a embarcação</FieldLabel>
            <Input value={form.requisitos} onChange={set("requisitos")} placeholder="******** / ********" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Órgão de Emissão</FieldLabel>
              <Input value={form.orgao} onChange={set("orgao")} placeholder="MARINHA DO BRASIL" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data de Emissão</FieldLabel>
              <Input value={form.dataEmissao} onChange={setMask("dataEmissao", maskDate)} inputMode="numeric" placeholder="07/07/2026" className={inputCls} required />
            </div>
          </div>
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
          ) : isEditMode ? (
            "Salvar alterações"
          ) : (
            "Gerar Preview"
          )}
        </Button>
      </form>
    </div>
  );
}
