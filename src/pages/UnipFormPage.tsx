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
import { loadUnipFieldPositions } from "@/lib/unip-align";
import { MODALIDADES, type Modalidade, cursosPorModalidade, TOTAL_CURSOS } from "@/lib/diploma-cursos";
import templateP1Url from "@/assets/template-unip-p1-hq.webp";
import templateP2Url from "@/assets/template-unip-p2-hq.jpg";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload, clearFinalPdf } from "@/lib/preview-payload";
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

const PREFIXO_CURSO: Record<Modalidade, string> = {
  bacharelado: "Curso de",
  licenciatura: "Curso de Licenciatura em",
  tecnologo: "Curso Superior de Tecnologia em",
  tecnico: "Curso Técnico em",
};

const TITULO_CURSO: Record<Modalidade, string> = {
  bacharelado: "Bacharel em",
  licenciatura: "Licenciado em",
  tecnologo: "Tecnólogo em",
  tecnico: "Técnico em",
};

interface UnipForm {
  instituicaoModo: "auto" | "manual";
  instituicaoManual: string;
  modalidade: Modalidade;

  curso: string;
  cursoEmec: string;
  dataConclusao: string;
  dataColacao: string;
  aluno: string;
  sexo: string;
  naturalidade: string;
  nascimento: string;
  identidade: string;
  orgaoExpedidor: string;
  dataExpedicao: string;
  cidadeCampus: string;
  ufCampus: string;
  ra: string;
  lote: string;
  registroNumero: string;
  registroLivro: string;
  registroFolha: string;
  registroData: string;
  processo: string;
}

const initial: UnipForm = {
  instituicaoModo: "auto",
  instituicaoManual: "",
  modalidade: "tecnologo",

  curso: "GESTÃO FINANCEIRA",
  cursoEmec: "120717",
  dataConclusao: "",
  dataColacao: "",
  aluno: "",
  sexo: "M",
  naturalidade: "São Paulo",
  nascimento: "",
  identidade: "",
  orgaoExpedidor: "SSP/SP",
  dataExpedicao: "",
  cidadeCampus: "São Paulo",
  ufCampus: "SP",
  ra: "",
  lote: "",
  registroNumero: "",
  registroLivro: "22/2",
  registroFolha: "",
  registroData: "",
  processo: "",
};

/** Textos institucionais fixos — mesmos em todos os diplomas UNIP, não editáveis pelo usuário. */
const UNIP_RECONHECIMENTO =
  "Reconhecimento Renovado pela Portaria MEC nº 952 de 30/08/2021, publicada\nno DOU nº 165, Seção 1, pág. 72-74 de 31/08/2021.";
const UNIP_RECREDENCIAMENTO =
  "Recredenciada pela Portaria MEC nº 188 de 03.02.2017 publicada no DOU nº 26\nem 06.02.2017, Seção 1, página 17 a 22.";

const NOMES = [
  "Rogério Yoiti Hiramuki", "Ana Carolina Ferreira Lima", "Bruno Henrique Santos Costa",
  "Marina Duarte Albuquerque", "Vitor Emanuel Rocha Prado", "Luciana Almeida Nogueira",
];


const ROUTE_KEY = "/dashboard/documents/diploma-unip";

export default function UnipFormPage() {
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const [form, setForm] = useState<UnipForm>(initial);
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

  const set = (field: keyof UnipForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));
  const setMask = (field: keyof UnipForm, fn: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: fn(e.target.value) }));

  const fillTest = () => {
    const ano = 2018 + Math.floor(Math.random() * 6);
    setForm((p) => ({
      ...p,
      aluno: pick(NOMES),
      nascimento: `${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}/${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}/19${Math.floor(Math.random() * 30) + 70}`,
      identidade: rnd(9),
      dataConclusao: `30/06/${ano}`,
      dataColacao: `03/08/${ano}`,
      dataExpedicao: `18/08/${ano}`,
      registroData: `18/08/${ano}`,
      ra: rnd(7),
      lote: rnd(5),
      registroNumero: rnd(6),
      registroFolha: rnd(5),
      processo: `${ano}.2.${rnd(6)}`,
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
    const cursoCompleto = `${PREFIXO_CURSO[form.modalidade]} ${curso}`;
    const tituloConferido = `${TITULO_CURSO[form.modalidade]} ${curso}`;
    const fem = form.sexo === "F";
    const nomeInstituicao =
      form.instituicaoModo === "manual" && form.instituicaoManual.trim()
        ? form.instituicaoManual.trim()
        : "Universidade Paulista";

    const corpo =
      `A ${fem ? "Reitora" : "Reitora"} da ${nomeInstituicao}, no uso de suas atribuições\n` +
      `e tendo em vista a conclusão do ${cursoCompleto},\n` +
      `na data de ${form.dataConclusao}, e a Colação de Grau na data de ${form.dataColacao}, confere o título de`;

    const dadosPessoais =
      `${fem ? "brasileira" : "brasileiro"}, natural do Estado de ${form.naturalidade}, ` +
      `${fem ? "nascida" : "nascido"} a ${dataExtenso(form.nascimento)},\n` +
      `R.G. nº ${form.identidade} ${form.orgaoExpedidor}`;

    return {
      instituicao_titulo: nomeInstituicao,

      corpo,
      titulo_conferido: `${tituloConferido}  a`,
      aluno: form.aluno,
      dados_pessoais: dadosPessoais,
      outorga:
        "e outorga-lhe o presente Diploma,\na fim de que possa gozar de todos os direitos e prerrogativas legais.",
      cidade_data: `${form.cidadeCampus} - ${form.ufCampus}, ${dataExtenso(form.dataExpedicao)}.`,
      reitor: "Sandra Rejane Gomes Miessa",
      reitor_cargo: "Reitora",
      // ---------------- verso ----------------
      ra: form.ra,
      lote: form.lote,
      mantenedora: "ASSUPERO - ENSINO SUPERIOR LTDA",
      cnpj: "06.099.229/0001-01",
      ies_emec: "Universidade Paulista - UNIP e-MEC 322",
      ies_titulo: "UNIVERSIDADE PAULISTA - UNIP e-MEC 322",
      recredenciamento: UNIP_RECREDENCIAMENTO,
      curso_completo: cursoCompleto,
      curso_emec: form.cursoEmec,
      reconhecimento: UNIP_RECONHECIMENTO,
      registro_texto:
        `Diploma registrado sob nº <b>${form.registroNumero}</b>,\n` +
        `Livro <b>${form.registroLivro}</b>, Fls <b>${form.registroFolha}</b>, em <b>${form.registroData}</b>,\n` +
        `por delegação de competência do Ministério da Educação, nos termos\n` +
        `da Lei nº 9.394, de 20 de dezembro de 1996, e do Decreto nº 9.235, de\n15 de dezembro de 2017.`,
      processo: form.processo,
      registro_cidade_data: `${form.cidadeCampus} - ${form.ufCampus}, ${dataExtenso(form.registroData)}.`,
      assinatura_bloco:
        "<b>Original Assinado Segundo a Portaria 554/2019/MEC</b>\n<b>Prof. Edison Fernandes</b>\nCPF: 124.974.018-53\nSecretário Geral Adjunto",
      // ---- dados crus ----
      curso: form.curso,
      modalidade: form.modalidade,
      registro_numero: form.registroNumero,
      registro_livro: form.registroLivro,
      registro_folha: form.registroFolha,
      registro_data: form.registroData,
      identidade: form.identidade,
      field_positions: loadUnipFieldPositions() ?? undefined,
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
      const { data, error } = await invokeGeneratePdf("generate-unip-pdf", {
        body: { ...body, preview: true },
      });
      if (seq !== previewSeq.current) return;
      if (error) throw error;
      const result = data?.pdfBase64;
      if (!result) throw new Error(data?.error || "Nenhum PDF retornado");
      // Nova prévia = documento novo: descarta o PDF final anterior
      // (senão o preview seguinte apareceria sem marca d'água).
      setFinalPdf(null);
      clearFinalPdf(ROUTE_KEY);
      setPreviewPdf(result.startsWith("data:") ? result : `data:application/pdf;base64,${result}`);
    } catch (e) {
      if (seq !== previewSeq.current) return;
      setPreviewError(describeError(e));
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }, [buildBody]);

  useEffect(() => {
    if (!autoLive || generating || showReady) return;
    if (generatedSignature.current === signature) return;
    const id = window.setTimeout(() => { void runPreview(); }, 400);
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
    saveFormDraft("unip", form as unknown as Record<string, unknown>);
    try {
      const body = await buildBody();

      const { data, error } = await invokeGeneratePdf("generate-unip-pdf", {
        body: { ...body, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error(data?.error || "pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-diploma-unip", creditRef("geracao-diploma-unip", body));
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
        description: `Diploma UNIP - ${form.curso || ""}`,
        additionalInfo: JSON.stringify(body),
        type: "diploma-unip",
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
      console.error("Erro ao gerar PDF do Diploma UNIP:", e);
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
            <PdfCanvasPreview pdfDataUrl={finalPdf || previewPdf} title="Prévia do Diploma UNIP" />
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

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Aqui está o seu Diploma UNIP:\n\nCurso: ${form.curso}\nAluno: ${form.aluno}`;

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
            <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Diploma UNIP — Universidade Paulista</h1>
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

          <FormDraftsPanel docType="unip" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
          {/* CURSO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={GraduationCap} title="Curso e Titulação" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Modalidade</FieldLabel>
                <Select
                  value={form.modalidade}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, modalidade: v as Modalidade, curso: cursosPorModalidade(v as Modalidade)[0] }))
                  }
                >
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Código e-MEC do curso</FieldLabel>
                <Input value={form.cursoEmec} onChange={setMask("cursoEmec", maskDigits(8))} inputMode="numeric" className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel required>Curso</FieldLabel>
              <Popover open={cursoOpen} onOpenChange={setCursoOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className={`w-full justify-between ${inputCls}`}>
                    <span className="truncate">{form.curso || "Selecione o curso"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar curso..." />
                    <CommandList className="max-h-72">
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
              <p className="text-[11px] text-muted-foreground">
                {cursos.length} cursos nesta modalidade · {TOTAL_CURSOS} no catálogo. Texto no diploma:{" "}
                <span className="text-foreground">{PREFIXO_CURSO[form.modalidade]} {titleCase(form.curso)}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Data de conclusão</FieldLabel>
                <Input value={form.dataConclusao} onChange={setMask("dataConclusao", maskDate)} inputMode="numeric" placeholder="30/06/2022" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Colação de grau</FieldLabel>
                <Input value={form.dataColacao} onChange={setMask("dataColacao", maskDate)} inputMode="numeric" placeholder="03/08/2022" className={inputCls} required />
              </div>
            </div>
          </div>

          {/* ALUNO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={User} title="Dados do Diplomado" />

            <div className="space-y-1.5">
              <FieldLabel required>Nome completo</FieldLabel>
              <Input value={form.aluno} onChange={set("aluno")} placeholder="Rogério Yoiti Hiramuki" className={inputCls} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel>Sexo</FieldLabel>
                <Select value={form.sexo} onValueChange={(v) => setForm((p) => ({ ...p, sexo: v }))}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Natural do Estado de</FieldLabel>
                <Select value={form.naturalidade} onValueChange={(v) => setForm((p) => ({ ...p, naturalidade: v }))}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {ESTADOS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Nascimento</FieldLabel>
                <Input value={form.nascimento} onChange={setMask("nascimento", maskDate)} inputMode="numeric" placeholder="30/01/1980" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>R.G.</FieldLabel>
                <Input value={form.identidade} onChange={setMask("identidade", maskDigits(15))} inputMode="numeric" placeholder="289421196" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Órgão expedidor</FieldLabel>
                <Input value={form.orgaoExpedidor} onChange={set("orgaoExpedidor")} placeholder="SSP/SP" className={inputCls} />
              </div>
            </div>
          </div>

          {/* REGISTRO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={FileSignature} title="Expedição e Registro" />

            <CidadeUfPicker
              uf={form.ufCampus}
              cidade={form.cidadeCampus}
              labelUf="UF do campus"
              labelCidade="Cidade do campus / expedição"
              onChange={({ uf, cidade }) =>
                setForm((p) => ({ ...p, ufCampus: uf, cidadeCampus: cidade }))
              }
            />

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Data de expedição</FieldLabel>
                <Input value={form.dataExpedicao} onChange={setMask("dataExpedicao", maskDate)} inputMode="numeric" placeholder="18/08/2022" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>RA</FieldLabel>
                <Input value={form.ra} onChange={setMask("ra", maskDigits(10))} inputMode="numeric" placeholder="2024833" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Lote</FieldLabel>
                <Input value={form.lote} onChange={setMask("lote", maskDigits(8))} inputMode="numeric" placeholder="29775" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <FieldLabel required>Nº registro</FieldLabel>
                <Input value={form.registroNumero} onChange={setMask("registroNumero", maskDigits(10))} inputMode="numeric" placeholder="634598" className={inputCls} required />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Livro</FieldLabel>
                <Input value={form.registroLivro} onChange={set("registroLivro")} placeholder="22/2" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Fls</FieldLabel>
                <Input value={form.registroFolha} onChange={setMask("registroFolha", maskDigits(8))} inputMode="numeric" placeholder="68180" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Data do registro</FieldLabel>
                <Input value={form.registroData} onChange={setMask("registroData", maskDate)} inputMode="numeric" placeholder="18/08/2022" className={inputCls} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Processo</FieldLabel>
              <Input value={form.processo} onChange={set("processo")} placeholder="2022.2.626304" className={inputCls} />
            </div>
          </div>

          {/* INSTITUIÇÃO */}
          <div className="glass space-y-4 p-6">
            <SectionHeader icon={University} title="Instituição" />

            <div className="space-y-1.5">
              <FieldLabel>Nome da instituição</FieldLabel>
              <Select
                value={form.instituicaoModo}
                onValueChange={(v) => setForm((p) => ({ ...p, instituicaoModo: v as "auto" | "manual" }))}
              >
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (Universidade Paulista)</SelectItem>
                  <SelectItem value="manual">Manual (digitar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.instituicaoModo === "manual" && (
              <div className="space-y-1.5">
                <FieldLabel required>Instituição (manual)</FieldLabel>
                <Input
                  value={form.instituicaoManual}
                  onChange={set("instituicaoManual")}
                  placeholder="Universidade Paulista"
                  className={inputCls}
                  required
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Mantenedora (ASSUPERO), CNPJ, e-MEC 322, Reitora, Secretário Geral Adjunto e os textos de
              credenciamento/reconhecimento já vêm preenchidos conforme o padrão oficial da UNIP.
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
        fileName="diploma-unip.pdf"
        title="Diploma UNIP"
        message={mensagem}
      />
    </div>
  );
}
