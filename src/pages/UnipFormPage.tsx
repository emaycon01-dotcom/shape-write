import { useState } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import CidadeUfPicker from "@/components/CidadeUfPicker";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { GraduationCap, University, Loader2, FlaskConical, Trash2, User, FileSignature, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadUnipFieldPositions } from "@/lib/unip-align";
import { MODALIDADES, type Modalidade, cursosPorModalidade, TOTAL_CURSOS } from "@/lib/diploma-cursos";
import templateP1Url from "@/assets/template-unip-p1-hq.webp";
import templateP2Url from "@/assets/template-unip-p2-hq.jpg";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
import { pick, rnd } from "@/lib/random";

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


export default function UnipFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<UnipForm>(initial);
  const [loading, setLoading] = useState(false);
  const [cursoOpen, setCursoOpen] = useState(false);

  const cursos = cursosPorModalidade(form.modalidade);

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
    toast({ title: "Formulário limpo!" });
  };

  const buildBody = async () => {
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
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    saveFormDraft("unip", form as unknown as Record<string, unknown>);

    try {
      const bodyData = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-unip-pdf", { body: bodyData });
      if (error) throw error;

      const pdfResult = data?.pdfBase64;
      if (!pdfResult) throw new Error(data?.error || "Nenhum PDF retornado");

      const previewId = storePreviewPayload({
        pdfBase64: pdfResult,
        formData: bodyData,
        codigoValidacao: data?.codigo_validacao,
        documentoId: data?.documento_id,
        validationUrl: data?.validation_url,
      });
      navigate("/dashboard/documents/diploma-unip/preview", { state: { previewId } });
    } catch (err) {
      console.error("Erro ao gerar PDF do Diploma UNIP:", err);
      toast({
        title: "Erro ao gerar PDF",
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

      <div className="studio-hero relative mb-6 overflow-hidden rounded-3xl border border-border/60 p-6">
        <span aria-hidden className="studio-hero-glow" />
        <h1 className="font-display relative text-2xl font-bold leading-tight text-foreground">Diploma UNIP — Universidade Paulista</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <FormDraftsPanel docType="unip" onRestore={(d) => setForm((p) => ({ ...p, ...(d as Partial<typeof p>) }))} />
        {/* CURSO */}
        <div className="glass space-y-4 rounded-xl p-6">
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
        <div className="glass space-y-4 rounded-xl p-6">
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
        <div className="glass space-y-4 rounded-xl p-6">
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
        <div className="glass space-y-4 rounded-xl p-6">
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

        <div className="flex justify-center pt-1">
          <Button type="submit" variant="gradient" className="h-14 w-full max-w-md rounded-2xl text-base font-semibold" disabled={loading}>
            {loading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>) : "Gerar Preview"}
          </Button>
        </div>
      </form>
    </div>
  );
}
