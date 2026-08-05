import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { GraduationCap, University, Loader2, FlaskConical, Trash2, User, FileSignature, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadAnhangueraFieldPositions } from "@/lib/anhanguera-align";
import { MODALIDADES, type Modalidade, cursosPorModalidade, TOTAL_CURSOS } from "@/lib/diploma-cursos";
import templateP1Url from "@/assets/template-anhanguera-p1-hq.jpg";
import templateP2Url from "@/assets/template-anhanguera-p2-hq.jpg";
import { loadTemplateBase64 } from "@/lib/template-cache";
import { maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";

const ESTADOS = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo",
  "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba",
  "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul",
  "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "na", "no"]);

function titleCase(v: string) {
  return v
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join(" ");
}

function dataExtenso(v: string) {
  const [d, m, y] = v.split("/");
  const mes = MESES[Number(m) - 1];
  if (!d || !mes || !y) return v;
  return `${Number(d)} de ${mes} de ${y}`;
}

/** Título conferido com flexão de gênero conforme a modalidade do curso. */
const TITULO_CURSO: Record<Modalidade, (curso: string, fem: boolean) => string> = {
  bacharelado: (c, f) => `${f ? "Bacharela" : "Bacharel"} em ${c}`,
  licenciatura: (c, f) => `${f ? "Licenciada" : "Licenciado"} em ${c}`,
  tecnologo: (c, f) => `${f ? "Tecnóloga" : "Tecnólogo"} em ${c}`,
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
  cidadeRegistro: "Campo Grande - MS",
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

function rnd(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function AnhangueraFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<AnhangueraForm>(initial);
  const [loading, setLoading] = useState(false);
  const [cursoOpen, setCursoOpen] = useState(false);

  const cursos = cursosPorModalidade(form.modalidade);

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
    toast({ title: "Formulário limpo!" });
  };

  const buildBody = async () => {
    const [template_p1_base64, template_p2_base64] = await Promise.all([
      loadTemplateBase64(templateP1Url),
      loadTemplateBase64(templateP2Url),
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
      registro_cidade_data: `${form.cidadeRegistro} ${dataExtenso(form.dataRegistro)}.`,
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
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const bodyData = await buildBody();
      const { data, error } = await invokeGeneratePdf("generate-anhanguera-pdf", { body: bodyData });
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
      navigate("/dashboard/documents/diploma-anhanguera/preview", { state: { previewId } });
    } catch (err) {
      console.error("Erro ao gerar PDF do Diploma Anhanguera:", err);
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

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Diploma Anhanguera</h1>

      <form onSubmit={handleSubmit} className="space-y-6 pb-10">
        {/* CURSO */}
        <div className="glass space-y-4 rounded-xl p-6">
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
        <div className="glass space-y-4 rounded-xl p-6">
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
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={FileSignature} title="Diploma e registro" />

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <FieldLabel required>Cidade do diploma</FieldLabel>
              <Input value={form.cidadeDiploma} onChange={set("cidadeDiploma")} placeholder="Macapá" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>UF</FieldLabel>
              <Input value={form.ufDiploma} onChange={set("ufDiploma")} placeholder="AP" maxLength={2} className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data do diploma</FieldLabel>
              <Input value={form.dataDiploma} onChange={setMask("dataDiploma", maskDate)} inputMode="numeric" placeholder="02/04/2022" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <FieldLabel required>Nº do registro</FieldLabel>
              <Input value={form.registroNumero} onChange={set("registroNumero")} placeholder="SRD_1021-1642" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Livro</FieldLabel>
              <Input value={form.registroLivro} onChange={set("registroLivro")} placeholder="25" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Processo nº</FieldLabel>
              <Input value={form.processo} onChange={set("processo")} placeholder="1642/2773/2022" className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel required>Cidade do registro</FieldLabel>
              <Input value={form.cidadeRegistro} onChange={set("cidadeRegistro")} placeholder="Campo Grande - MS" className={inputCls} required />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>Data do registro</FieldLabel>
              <Input value={form.dataRegistro} onChange={setMask("dataRegistro", maskDate)} inputMode="numeric" placeholder="02/04/2022" className={inputCls} required />
            </div>
          </div>
        </div>

        {/* INSTITUIÇÃO */}
        <div className="glass space-y-4 rounded-xl p-6">
          <SectionHeader icon={University} title="Instituição" />
          <p className="text-xs text-muted-foreground">
            Mantenedora (Anhanguera Educacional Participações S.A.), CNPJ, assinaturas e os textos legais de
            reconhecimento/recredenciamento já vêm preenchidos conforme o padrão oficial.
          </p>
        </div>

        <Button type="submit" variant="gradient" className="h-14 w-full rounded-xl text-base font-semibold" disabled={loading}>
          {loading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>) : "Gerar Preview"}
        </Button>
      </form>
    </div>
  );
}
