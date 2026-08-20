import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import CidadeUfPicker from "@/components/CidadeUfPicker";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  GraduationCap, University, Loader2, FlaskConical, Trash2, User, FileSignature, Check, ChevronsUpDown,
  ArrowLeft, Sparkles, ShieldCheck, Eye, CreditCard, FileText, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadAnhangueraFieldPositions } from "@/lib/anhanguera-align";
import { MODALIDADES, type Modalidade, cursosPorModalidade, TOTAL_CURSOS } from "@/lib/diploma-cursos";
import templateP1Url from "@/assets/template-anhanguera-p1-hq.jpg";
import templateP2Url from "@/assets/template-anhanguera-p2-hq.jpg";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { pick, rnd } from "@/lib/random";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";

const ESTADOS = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo",
  "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba",
  "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul",
  "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
];

import { titleCase, dataExtenso } from "@/lib/text";

/** Título conferido com flexão de gênero conforme a modalidade do curso. */
const TITULO_CURSO: Record<Modalidade, (curso: string, fem: boolean) => string> = {
  bacharelado: (c, f) => `${f ? "Bacharela" : "Bacharel"} em ${c}`,
  licenciatura: (c, f) => `${f ? "Licenciada" : "Licenciado"} em ${c}`,
  tecnologo: (c, f) => `${f ? "Tecnóloga" : "Tecnólogo"} em ${c}`,
  tecnico: (c, f) => `${f ? "Técnica" : "Técnico"} em ${c}`,
};

interface AnhangueraForm {
  unidade: string;
  modalidade: Modalidade;
  curso: string;
  tituloManual: string;
  dataConclusao: string;
  dataColacao: string;
  aluno: string;
  sexo: string;
  naturalidade: string;
  nascimento: string;
  identidade: string;
  orgaoExpedidor: string;
  cidadeDiploma: string;
  ufDiploma: string;
  dataDiploma: string;
  registroNumero: string;
  registroLivro: string;
  processo: string;
  cidadeRegistro: string;
  ufRegistro: string;
  dataRegistro: string;
}

const initial: AnhangueraForm = {
  unidade: "Faculdade Anhanguera de Macapá",
  modalidade: "bacharelado",
  curso: "ENFERMAGEM",
  tituloManual: "",
  dataConclusao: "",
  dataColacao: "",
  aluno: "",
  sexo: "F",
  naturalidade: "Amapá",
  nascimento: "",
  identidade: "",
  orgaoExpedidor: "PTC/AP",
  cidadeDiploma: "Macapá",
  ufDiploma: "AP",
  dataDiploma: "",
  registroNumero: "",
  registroLivro: "25",
  processo: "",
  cidadeRegistro: "Campo Grande",
  ufRegistro: "MS",
  dataRegistro: "",
};

/** Textos institucionais fixos — mesmos em todos os diplomas Anhanguera, não editáveis pelo usuário. */
const ANHANGUERA_RECONHECIMENTO =
  "Renovação de Reconhecimento pela Portaria Ministerial nº 1899 de 07/12/2021 - publicada no D.O.U 234 , seção 1, pág. 57 de 14/12/2021.";
const ANHANGUERA_RECREDENCIAMENTO_IES =
  "Recredenciada pela Portaria Ministerial nº 336 de 08/02/2019 - publicada no D.O.U 29 , seção 1, pág. 40 de 11/02/2019.";
const ANHANGUERA_RECREDENCIAMENTO_UNIVERSIDADE =
  "Recredenciada pelo Decreto nº 123 de 18/12/1996 - publicada no D.O.U 246, seção 1, pág. 27624 de 19/12/1996.";

const NOMES = [
  "Jennifer Liziêr Farias Dias", "Ana Carolina Ferreira Lima", "Bruno Henrique Santos Costa",
  "Marina Duarte Albuquerque", "Vitor Emanuel Rocha Prado", "Luciana Almeida Nogueira",
];

const ROUTE_KEY = "/dashboard/documents/diploma-anhanguera";

export default function AnhangueraFormPage() {
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const [form, setForm] = useState<AnhangueraForm>(initial);
  const [cursoOpen, setCursoOpen] = useState(false);

  const cost = planCost(1, user?.plano);
  const cursos = cursosPorModalidade(form.modalidade);

  /* ---------------- estado do preview ao vivo ---------------- */
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoLive, setAutoLive] = useState(true);
  const previewSeq = useRef(0);
  const generatedSignature = useRef<string | null>(null);

  /* ---------------- estado do documento final ---------------- */
  const [finalPdf, setFinalPdf] = useState<string | null>(() => readFinalPdf(ROUTE_KEY));
  const [showReady, setShowReady] = useState(false);
  const [generating, setGenerating] = useState(false);

  const set = (field: keyof AnhangueraForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));
  const setMask = (field: keyof AnhangueraForm, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    const ano = 2018 + Math.floor(Math.random() * 6);
    setForm((p) => ({
      ...p,
      aluno: pick(NOMES),
      nascimento: `${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}/${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}/19${Math.floor(Math.random() * 30) + 70}`,
      identidade: rnd(6),
      dataConclusao: `31/12/${ano}`,
      dataColacao: `23/02/${ano + 1}`,
      dataDiploma: `02/04/${ano + 1}`,
      dataRegistro: `02/04/${ano + 1}`,
      registroNumero: `SRD_${rnd(4)}-${rnd(4)}`,
      processo: `${rnd(4)}/2773/${ano + 1}`,
      curso: pick(cursosPorModalidade(p.modalidade)),
    }));
    toast({ title: "Formulário preenchido com dados de teste!" });
  };

  const clearForm = () => {
    setForm({ ...initial });
    setPreviewPdf(null);
    toast({ title: "Formulário limpo!" });
  };

  const buildBody = useCallback(async () => {
    const [template_p1_base64, template_p2_base64] = await Promise.all([
      loadTemplateObjectUrl(templateP1Url),
      loadTemplateObjectUrl(templateP2Url),
    ]);

    const curso = titleCase(form.curso);
    const fem = form.sexo === "F";
    const tituloConferido = form.tituloManual.trim()
      ? titleCase(form.tituloManual)
      : TITULO_CURSO[form.modalidade](curso, fem);

    const corpo =
      `${fem ? "A Representante Legal" : "O Representante Legal"} da Mantenedora da ${form.unidade} no uso de suas\n` +
      `atribuições legais e tendo em vista a conclusão do curso ${curso} em ${form.dataConclusao} e\n` +
      `colação de grau em ${form.dataColacao}, confere o título de`;

    const dadosPessoais =
      `${fem ? "Brasileira" : "Brasileiro"}, natural do Estado ${form.naturalidade}, ${fem ? "nascida" : "nascido"} em ${dataExtenso(form.nascimento)}, RG ${form.identidade} -\n` +
      `${form.orgaoExpedidor}, e outorga-lhe o presente Diploma, a fim de que possa exercer todos os direitos e\n` +
      `prerrogativas legais dele decorrente.`;

    return {
      instituicao_titulo: form.unidade,
      corpo,
      titulo_conferido: `${tituloConferido} a`,
      aluno: form.aluno,
      dados_pessoais: dadosPessoais,
      cidade_data: `${form.cidadeDiploma} - ${form.ufDiploma}, ${dataExtenso(form.dataDiploma)}.`,
      assinante_nome: "Isadora Ferreira Costa Faria",
      assinante_cargo: "Diretora Processos Regulatórios",
      // ---------------- verso ----------------
      curso,
      reconhecimento: ANHANGUERA_RECONHECIMENTO,
      mantenedora: "Anhanguera Educacional Participações S.A.",
      cnpj: "04310392000146",
      universidade: "Universidade Anhanguera - Uniderp",
      recredenciamento_ies: ANHANGUERA_RECREDENCIAMENTO_IES,
      recredenciamento_universidade: ANHANGUERA_RECREDENCIAMENTO_UNIVERSIDADE,
      registro_texto:
        `Diploma registrado sob nº <b>${form.registroNumero}</b> Livro <b>${form.registroLivro}</b> Processo nº <b>${form.processo}</b>, nos termos da Lei 9394 de 20/12/1996 e Decreto nº 9.235 de\n15/12/2017.`,
      registro_cidade_data: `${form.cidadeRegistro} - ${form.ufRegistro}, ${dataExtenso(form.dataRegistro)}.`,
      registrador_nome: "Angela Cristina Granado Willamowius",
      registrador_cargo: "Gerente Documentação e Diplomas",
      // ---- dados crus ----
      modalidade: form.modalidade,
      sexo: form.sexo,
      naturalidade: form.naturalidade,
      nascimento: form.nascimento,
      data_conclusao: form.dataConclusao,
      data_diploma: form.dataDiploma,
      registro_numero: form.registroNumero,
      registro_livro: form.registroLivro,
      registro_data: form.dataRegistro,
      processo: form.processo,
      identidade: form.identidade,
      field_positions: loadAnhangueraFieldPositions() ?? undefined,
      template_p1_base64,
      template_p2_base64,
      __form: JSON.stringify(form),
    } as Record<string, unknown>;
  }, [form]);

  const signature = useMemo(() => JSON.stringify(form), [form]);

  const canPreview =
    form.aluno.trim().length > 2 &&
    form.nascimento.length === 10 &&
    form.dataConclusao.length === 10;

  const runPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const body = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-anhanguera-pdf", {
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
    if (!autoLive || !canPreview || generating || showReady) return;
    if (generatedSignature.current === signature) return;
    const id = window.setTimeout(() => { void runPreview(); }, 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, autoLive, canPreview, generating, showReady]);

  const handleGenerate = async () => {
    if (!user) return;

    if ((user.credits ?? 0) < cost) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de ${formatCredits(cost)} crédito(s) para gerar o documento.`,
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    saveFormDraft("anhanguera", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-anhanguera-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error(data?.error || "pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-diploma-anhanguera", creditRef("geracao-diploma-anhanguera", body));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        return;
      }

      setFinalPdf(pdfFinal);
      saveFinalPdf(ROUTE_KEY, pdfFinal);

      await addDocument({
        name: form.aluno || "",
        identification: form.identidade || "",
        date: form.dataColacao || "",
        description: `Diploma Anhanguera - ${form.curso || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "diploma-anhanguera",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      generatedSignature.current = signature;
      setShowReady(true);

      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });
    } catch (e) {
      console.error("Erro ao gerar PDF do Diploma Anhanguera:", e);
      toast({
        title: "Erro ao gerar documento",
        description: `Nenhum crédito foi descontado. ${describeError(e)}`,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
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

  /* ---------------- painel de preview (reutilizado em 2 posições) ---------------- */
  const previewPanel = (
    <div className="glass flex h-full flex-col overflow-hidden p-0 rounded-2xl">
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
              autoLive
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border bg-secondary text-muted-foreground"
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Diploma Anhanguera" />
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
              {previewError
                ? previewError
                : "Preencha nome do aluno, nascimento e data de conclusão — a prévia atualiza sozinha enquanto você digita."}
            </p>
          </div>
        )}
      </div>

      <p className="border-t border-border/50 px-5 py-2.5 text-center text-[11px] text-muted-foreground">
        A marca d'água sai apenas no PDF final gerado.
      </p>
    </div>
  );

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Aqui está o seu Diploma Anhanguera:\n\nCurso: ${form.curso}\nAluno: ${form.aluno}`;

  return (
    <div className="mx-auto w-full max-w-[1500px] pb-28 xl:pb-8">
      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <button
              onClick={() => navigate("/dashboard/documents")}
              className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Serviços
            </button>
            <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Diploma Anhanguera</h1>
            <p className="text-xs text-muted-foreground">Editor com prévia ao vivo · sem trocar de tela</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> Prévia em tempo real
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                <ShieldCheck className="h-3 w-3" /> Crédito só na geração final
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fillTest} className="gap-1.5 border-primary/30 text-xs text-primary hover:bg-primary/10">
              <FlaskConical className="h-3.5 w-3.5" /> Teste
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearForm} className="gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <form onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }} className="space-y-6">

          <FormDraftsPanel docType="anhanguera" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* CURSO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={GraduationCap} title="Curso" />

            <div className="space-y-1.5">
              <FieldLabel required>Unidade / Faculdade</FieldLabel>
              <Input value={form.unidade} onChange={set("unidade")} placeholder="Faculdade Anhanguera de Macapá" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Modalidade</FieldLabel>
                <Select value={form.modalidade} onValueChange={(v) => setForm((p) => ({ ...p, modalidade: v as Modalidade, curso: cursosPorModalidade(v as Modalidade)[0] }))}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Curso ({TOTAL_CURSOS} opções)</FieldLabel>
                <Popover open={cursoOpen} onOpenChange={setCursoOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" className={`w-full justify-between font-normal ${inputCls}`}>
                      <span className="truncate">{form.curso || "Selecione"}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar curso..." />
                      <CommandList>
                        <CommandEmpty>Nenhum curso encontrado.</CommandEmpty>
                        <CommandGroup>
                          {cursos.map((c) => (
                            <CommandItem key={c} value={c} onSelect={() => { setForm((p) => ({ ...p, curso: c })); setCursoOpen(false); }}>
                              <Check className={`mr-2 h-4 w-4 ${form.curso === c ? "opacity-100" : "opacity-0"}`} />
                              {c}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Título conferido (opcional — sobrescreve o automático)</FieldLabel>
              <Input value={form.tituloManual} onChange={set("tituloManual")} placeholder="Enfermeira" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Conclusão do curso</FieldLabel>
                <Input value={form.dataConclusao} onChange={setMask("dataConclusao", maskDate)} inputMode="numeric" placeholder="31/12/2021" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Colação de grau</FieldLabel>
                <Input value={form.dataColacao} onChange={setMask("dataColacao", maskDate)} inputMode="numeric" placeholder="23/02/2022" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* ALUNO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Aluno" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome completo</FieldLabel>
              <Input value={form.aluno} onChange={set("aluno")} placeholder="Jennifer Liziêr Farias Dias" className={inputCls} required />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Sexo</FieldLabel>
                <Select value={form.sexo} onValueChange={(v) => setForm((p) => ({ ...p, sexo: v }))}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="M">Masculino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Naturalidade (Estado)</FieldLabel>
                <Select value={form.naturalidade} onValueChange={(v) => setForm((p) => ({ ...p, naturalidade: v }))}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Nascimento</FieldLabel>
                <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="01/12/1998" className={inputCls} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>RG</FieldLabel>
                <Input value={form.identidade} onChange={setMask("identidade", maskDigits(12))} inputMode="numeric" placeholder="565202" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Órgão expedidor</FieldLabel>
                <Input value={form.orgaoExpedidor} onChange={set("orgaoExpedidor")} placeholder="PTC/AP" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* DIPLOMA E REGISTRO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={FileSignature} title="Diploma e registro" />

            <CidadeUfPicker
              uf={form.ufDiploma}
              cidade={form.cidadeDiploma}
              labelUf="UF do diploma"
              labelCidade="Cidade do diploma"
              onChange={({ uf, cidade }) =>
                setForm((p) => ({ ...p, ufDiploma: uf, cidadeDiploma: cidade }))
              }
            />

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Data do diploma</FieldLabel>
                <Input value={form.dataDiploma} onChange={setMask("dataDiploma", maskDate)} inputMode="numeric" placeholder="02/04/2022" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Nº do registro</FieldLabel>
                <Input value={form.registroNumero} onChange={set("registroNumero")} placeholder="SRD_1021-1642" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Livro</FieldLabel>
                <Input value={form.registroLivro} onChange={set("registroLivro")} placeholder="25" className={inputCls} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Processo nº</FieldLabel>
                <Input value={form.processo} onChange={set("processo")} placeholder="1642/2773/2022" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Data do registro</FieldLabel>
                <Input value={form.dataRegistro} onChange={setMask("dataRegistro", maskDate)} inputMode="numeric" placeholder="02/04/2022" className={inputCls} required />
              </div>
            </div>

            <CidadeUfPicker
              uf={form.ufRegistro}
              cidade={form.cidadeRegistro}
              labelUf="UF do registro"
              labelCidade="Cidade do registro"
              onChange={({ uf, cidade }) =>
                setForm((p) => ({ ...p, ufRegistro: uf, cidadeRegistro: cidade }))
              }
            />
          </div>

          {/* INSTITUIÇÃO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={University} title="Instituição" />
            <p className="text-xs text-muted-foreground">
              Mantenedora (Anhanguera Educacional Participações S.A.), CNPJ, assinaturas e os textos legais de
              reconhecimento/recredenciamento já vêm preenchidos conforme o padrão oficial.
            </p>
          </div>

          {/* PRÉVIA — só no mobile/tablet */}
          <div className="xl:hidden">{previewPanel}</div>

          {/* AÇÃO */}
          <div className="glass hidden p-6 xl:block">
            <div className="mb-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Custo: {cost > 0 ? `${formatCredits(cost)} crédito(s)` : "grátis pelo seu plano"}
                </p>
                <p className="text-xs text-muted-foreground">Saldo atual: {user?.credits ?? 0} crédito(s)</p>
              </div>
            </div>
            <Button type="submit" variant="gradient" className="h-14 w-full rounded-2xl text-base font-semibold" disabled={generating}>
              {generating ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando documento...</>
              ) : (
                <>Gerar PDF ({cost > 0 ? `${formatCredits(cost)} crédito` : "grátis"})</>
              )}
            </Button>
          </div>
        </form>

        {/* COLUNA — PRÉVIA STICKY (desktop) */}
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
            disabled={generating}
            onClick={() => void handleGenerate()}
          >
            {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : "Gerar PDF"}
          </Button>
        </div>
      </div>

      <PdfReadyDialog
        open={showReady}
        onOpenChange={setShowReady}
        pdfDataUrl={finalPdf || ""}
        fileName="diploma-anhanguera.pdf"
        title="Diploma Anhanguera"
        message={mensagem}
      />
    </div>
  );
}
