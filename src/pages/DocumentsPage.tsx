import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Car, IdCard, Stethoscope, QrCode, Smartphone, Lock, ArrowUpRight, Anchor, GraduationCap, School, Wrench, HeartPulse, ShieldPlus, ShieldAlert, Pill, Crosshair, ArrowLeft, ChevronRight, Home, Zap, Wallet, Flame, MapPin, Sparkles, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";


type Modulo = {
  id: string;
  titulo: string;
  descricao: string;
  icon: React.ElementType;
  rota?: string;
  creditos?: number;
  qrcode?: boolean;
  aplicativo?: boolean;
  emBreve?: boolean;
  manutencao?: boolean;
  emDestaque?: boolean;
  badges?: { label: string; tone: "hot" | "estado" | "exclusivo" | "novo" }[];

};

type Categoria = {
  grupo: string;
  subtitulo: string;
  icon: React.ElementType;
  destaque: string;
  itens: Modulo[];
};

const MODULOS: Categoria[] = [
  {
    grupo: "DIGITAIS",
    destaque: "MAIS USADOS",
    subtitulo: "DOCUMENTOS DIGITAIS COM VALIDAÇÃO ONLINE",
    icon: IdCard,
    itens: [
      {
        id: "cnh",
        titulo: "CNH DIGITAL",
        descricao: "CNH Digital 2026 com login, APK e validação",
        icon: FileText,
        rota: "/dashboard/documents/cnh",
        creditos: 1,
        qrcode: true,
        aplicativo: true,
      },
      {
        id: "crlv",
        titulo: "CRLV DIGITAL",
        descricao: "Certificado de registro e licenciamento",
        icon: Car,
        rota: "/dashboard/documents/crlv",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "atpv",
        titulo: "ATPV-e",
        descricao: "Autorização para transferência de veículo",
        icon: Car,
        rota: "/dashboard/documents/atpv",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "rg",
        titulo: "RG DIGITAL",
        descricao: "Nova identidade nacional digital (CIN)",
        icon: IdCard,
        qrcode: true,
        aplicativo: true,
        rota: "/dashboard/documents/rg",
        creditos: 1,
        manutencao: true,
      },
      {
        id: "cha",
        titulo: "CNH MARÍTIMA (CHA)",
        descricao: "Carteira de Habilitação de Amador — Marinha do Brasil",
        icon: Anchor,
        rota: "/dashboard/documents/cha",
        creditos: 1,
        qrcode: true,
        aplicativo: true,
      },
    ],
  },
  {
    grupo: "ARMAS",
    destaque: "ALTA DEMANDA",
    subtitulo: "REGISTROS E CERTIFICADOS DE ARMA DE FOGO",
    icon: Crosshair,
    itens: [
      {
        id: "craf",
        titulo: "CRAF — REGISTRO DE ARMA",
        descricao: "Certificado de Registro de Arma de Fogo do Exército com QR Code",
        icon: Crosshair,
        rota: "/dashboard/documents/craf",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "porte",
        titulo: "PORTE FEDERAL DE ARMA",
        descricao: "Autorização de porte de arma de fogo (MJSP / Polícia Federal / SINARM)",
        icon: Crosshair,
        rota: "/dashboard/documents/porte",
        creditos: 1,
      },
    ],
  },
  {
    grupo: "DIPLOMAS",
    destaque: "TOP VENDAS",
    subtitulo: "DIPLOMAS DE ENSINO SUPERIOR",
    icon: GraduationCap,
    itens: [
      {
        id: "diploma",
        titulo: "ESTÁCIO",
        descricao: "Diploma de graduação com verso de registro e QR Code",
        icon: GraduationCap,
        rota: "/dashboard/documents/diploma",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "diploma-unip",
        titulo: "UNIP",
        descricao: "Diploma da Universidade Paulista com verso de registro e QR Code",
        icon: GraduationCap,
        rota: "/dashboard/documents/diploma-unip",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "diploma-anhanguera",
        titulo: "ANHANGUERA",
        descricao: "Diploma da Faculdade Anhanguera com verso de registro e QR Code",
        icon: GraduationCap,
        rota: "/dashboard/documents/diploma-anhanguera",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "historico-superior",
        titulo: "HISTÓRICO ESCOLAR SUPERIOR",
        descricao: "Histórico de graduação em 3 páginas com grade curricular automática por curso",
        icon: BookOpen,
        rota: "/dashboard/documents/historico-superior",
        creditos: 1,
        emDestaque: true,
        badges: [
          { label: "NOVO", tone: "novo" },
          { label: "3 PÁGINAS", tone: "hot" },
          { label: "TODOS OS CURSOS", tone: "exclusivo" },
          { label: "NOTAS AUTOMÁTICAS", tone: "estado" },
        ],
      },
    ],
  },

  {
    grupo: "ESCOLARES",
    destaque: "TODOS COM ESTADOS",
    subtitulo: "DECLARAÇÕES E HISTÓRICOS ESCOLARES",
    icon: School,
    itens: [
      {
        id: "declaracao-escolar",
        titulo: "DECLARAÇÃO DE CONCLUSÃO",
        descricao: "Declaração de conclusão com brasão do estado selecionado",
        icon: School,
        rota: "/dashboard/documents/declaracao-escolar",
        creditos: 1,
      },
      {
        id: "declaracao-pe",
        titulo: "DECLARAÇÃO ESCOLAR",
        descricao: "Papel timbrado da Secretaria de Educação, com assinaturas do secretário e do gestor",
        icon: School,
        rota: "/dashboard/documents/declaracao-pe",
        creditos: 1,
        badges: [{ label: "EXCLUSIVO PE", tone: "exclusivo" }],
      },
      {
        id: "declaracao-ete",
        titulo: "DECLARAÇÃO DE MATRÍCULA (ETE)",
        descricao: "Declaração de matrícula da Escola Técnica Estadual com carimbo e assinatura",
        icon: School,
        rota: "/dashboard/documents/declaracao-ete",
        creditos: 1,
      },
      {
        id: "historico-escolar",
        titulo: "HISTÓRICO + CERTIFICADO",
        descricao: "Histórico do Ensino Médio com certificado de conclusão e brasão do estado",
        icon: School,
        rota: "/dashboard/documents/historico-escolar",
        creditos: 1,
      },
      {
        id: "certificado-medio",
        titulo: "CERTIFICADO + HISTÓRICO (ENSINO MÉDIO)",
        descricao: "Certificado e histórico escolar em página única, com notas por série e brasão de todos os estados",
        icon: School,
        rota: "/dashboard/documents/certificado-medio",
        creditos: 1,
      },
      {
        id: "ficha19",
        titulo: "CERTIFICADO + HISTÓRICO (FICHA 19)",
        descricao: "Modelo Ficha 19 em duas páginas, com assinatura automática ou upload manual das duas assinaturas",
        icon: School,
        rota: "/dashboard/documents/ficha19",
        creditos: 1,
      },
      {
        id: "declaracao-escolaridade",
        titulo: "DECLARAÇÃO DE ESCOLARIDADE",
        descricao: "Declaração de conclusão com brasão de todos os estados e upload do carimbo/assinatura",
        icon: School,
        rota: "/dashboard/documents/declaracao-escolaridade",
        creditos: 1,
      },
      {
        id: "historico-medio-sp",
        titulo: "HISTÓRICO ESCOLAR (ENSINO MÉDIO)",
        descricao: "Histórico com brasão por estado, notas opcionais e turno (manhã, tarde, noite, integral)",
        icon: School,
        rota: "/dashboard/documents/historico-medio-sp",
        creditos: 1,
        badges: [
          { label: "TURNO", tone: "hot" },
          { label: "MAIS VENDAS", tone: "hot" },
        ],
      },
      {
        id: "historico-eja",
        titulo: "HISTÓRICO/CERTIFICADO EJA",
        descricao: "Histórico e certificado do EJA (Ensino Médio) com brasão por estado e notas opcionais",
        icon: School,
        rota: "/dashboard/documents/historico-eja",
        creditos: 1,
      },
      {
        id: "historico-fundamental",
        titulo: "HISTÓRICO ENSINO FUNDAMENTAL",
        descricao: "Histórico do Ensino Fundamental (1º ao 9º ano) com brasão por estado, notas opcionais e página de dependência de estudos",
        icon: School,
        rota: "/dashboard/documents/historico-fundamental",
        creditos: 1,
      },
    ],
  },
  {
    grupo: "CERTIDÕES",
    destaque: "NOVO",
    subtitulo: "CERTIDÕES DO REGISTRO CIVIL",
    icon: FileText,
    itens: [
      {
        id: "certidao-nascimento",
        titulo: "CERTIDÃO DE NASCIMENTO",
        descricao: "Certidão eletrônica do Registro Civil com dados por extenso",
        icon: FileText,
        rota: "/dashboard/documents/certidao-nascimento",
        creditos: 1,
      },
      {
        id: "certidao-obito",
        titulo: "CERTIDÃO DE ÓBITO",
        descricao: "Certidão eletrônica de óbito do Registro Civil com dados por extenso",
        icon: FileText,
        rota: "/dashboard/documents/certidao-obito",
        creditos: 1,
      },
    ],
  },
  {
    grupo: "COMPROVANTES",
    destaque: "MAIS PEDIDOS",
    subtitulo: "COMPROVANTES DE RESIDÊNCIA",
    icon: Home,
    itens: [
      {
        id: "comprovante-enel",
        titulo: "ENEL",
        descricao: "Fatura de energia Enel em 2 páginas, com código de barras",
        icon: Zap,
        rota: "/dashboard/documents/comprovante-enel",
        creditos: 1,
      },
      {
        id: "comprovante-coelba",
        titulo: "COELBA",
        descricao: "Fatura Neoenergia Coelba (DANFE NF3e) em 2 páginas, com chave de acesso e protocolo",
        icon: Zap,
        rota: "/dashboard/documents/comprovante-coelba",
        creditos: 1,
      },
      {
        id: "comprovante-equatorial",
        titulo: "EQUATORIAL",
        descricao: "Fatura Equatorial Goiás / CELG D (DANF3E NF3e) em 2 páginas, com ficha de compensação",
        icon: Zap,
        rota: "/dashboard/documents/comprovante-equatorial",
        creditos: 1,
      },

      {
        id: "comprovante-tim",
        titulo: "TIM",
        descricao: "Fatura TIM S.A. em A4, com resumo da conta, mensalidades e ficha de pagamento",
        icon: Smartphone,
        rota: "/dashboard/documents/comprovante-tim",
        creditos: 1,
      },
    ],
  },
  {
    grupo: "FINANCEIRO",
    destaque: "NOVO",
    subtitulo: "COMPROVANTES DE RENDA E FOLHA DE PAGAMENTO",
    icon: Wallet,
    itens: [
      {
        id: "holerite",
        titulo: "HOLERITE",
        descricao: "Recibo de pagamento de salário em 2 vias, com totais e bases de cálculo",
        icon: Wallet,
        rota: "/dashboard/documents/holerite",
        creditos: 1,
      },
    ],
  },
  {
    grupo: "ATESTADOS",
    destaque: "MAIS VENDAS",
    subtitulo: "ATESTADOS MÉDICOS COM VALIDAÇÃO",
    icon: Stethoscope,
    itens: [
      {
        id: "atestado",
        titulo: "UPA 24H",
        descricao: "Atestado digital com validação por QR Code",
        icon: Stethoscope,
        rota: "/dashboard/documents/atestado",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "hapvida",
        titulo: "HAPVIDA",
        descricao: "Atestado HapVida / NotreDame com prescrição e QR Code",
        icon: HeartPulse,
        rota: "/dashboard/documents/hapvida",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "unimed",
        titulo: "UNIMED",
        descricao: "Atestado médico Unimed com assinatura ICP-Brasil e QR Code",
        icon: ShieldPlus,
        rota: "/dashboard/documents/unimed",
        creditos: 1,
        qrcode: true,
      },
    ],
  },
  {
    grupo: "RECEITAS",
    destaque: "NOVO",
    subtitulo: "RECEITUÁRIOS E PRESCRIÇÕES MÉDICAS",
    icon: Pill,
    itens: [
      {
        id: "receita-medica",
        titulo: "RECEITA MÉDICA — UNIMED",
        descricao: "Receita Unimed com cidade da unidade, medicamentos e QR Code",
        icon: Pill,
        rota: "/dashboard/documents/receita-medica",
        creditos: 1,
        qrcode: true,
      },
    ],
  },
];


function Badge({ tone, icon: Icon, children }: { tone: "qr" | "app" | "soon" | "maintenance" | "hot" | "estado" | "exclusivo" | "novo"; icon: React.ElementType; children: React.ReactNode }) {
  const tones = {
    qr: "border-success/40 bg-success/15 text-success",
    app: "border-warning/40 bg-warning/15 text-warning",
    soon: "border-border/70 bg-muted/40 text-muted-foreground",
    maintenance: "border-destructive/40 bg-destructive/15 text-destructive",
    hot: "border-warning/60 bg-warning/25 text-warning shadow-[0_0_12px_-4px_hsl(var(--warning))]",
    estado: "border-success/60 bg-success/25 text-success shadow-[0_0_12px_-4px_hsl(var(--success))]",
    novo: "border-primary/70 bg-primary/25 text-primary shadow-[0_0_16px_-3px_hsl(var(--primary))] animate-pulse",
    exclusivo:
      "border-accent/60 bg-gradient-to-r from-accent/30 via-primary/25 to-accent/30 text-accent shadow-[0_0_16px_-4px_hsl(var(--accent))] ring-1 ring-inset ring-accent/30",
  } as const;

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      <Icon className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const verified = user?.verified !== false;
  const [categoria, setCategoria] = useState<string | null>(null);

  const abrir = (m: Modulo) => {
    if (m.manutencao) {
      toast.info(`${m.titulo} está temporariamente em manutenção.`);
      return;
    }
    if (m.rota) navigate(m.rota);
    else toast.info(`${m.titulo} estará disponível em breve.`);
  };

  if (!verified) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/70 ring-1 ring-border/60">
          <ShieldAlert className="h-8 w-8 text-warning" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Conta não verificada</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Sua conta ainda está aguardando a verificação de um administrador. Assim que ela for verificada, todos os
          módulos e a geração de documentos aparecerão aqui automaticamente.
        </p>
        <p className="rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-xs text-muted-foreground">
          Precisa de ajuda? Abra um chamado pelo suporte dentro do painel.
        </p>
      </div>
    );
  }

  const atual = MODULOS.find((m) => m.grupo === categoria) || null;

  // ---- Tela 1: seleção de categoria -------------------------------------
  if (!atual) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">SERVIÇOS</h1>
          <p className="text-sm text-muted-foreground">ESCOLHA UMA CATEGORIA PARA VER OS MÓDULOS</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((cat) => (
            <button
              key={cat.grupo}
              onClick={() => setCategoria(cat.grupo)}
              className="group relative overflow-hidden rounded-2xl border border-primary/40 bg-card/80 p-5 text-left backdrop-blur transition-all duration-300 hover:-translate-y-0.5 shadow-[0_18px_45px_-32px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.08)]"
            >
              <div className="absolute inset-0 gradient-primary opacity-[0.08]" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/80 ring-1 ring-border/60 transition-colors group-hover:ring-primary/50">
                  <cat.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold uppercase tracking-[0.14em] text-foreground">
                    {cat.grupo}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{cat.subtitulo}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex animate-pulse items-center gap-1 rounded-md border border-warning/60 bg-warning/25 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-warning shadow-[0_0_14px_-4px_hsl(var(--warning))]">
                      <Sparkles className="h-2.5 w-2.5" />
                      {cat.destaque}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                      {cat.itens.length} MÓDULOS
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">Novos módulos serão adicionados em breve.</p>
      </div>
    );
  }

  // ---- Tela 2: módulos da categoria (lista de cima para baixo) ----------
  return (
    <div className="space-y-5">
      <button
        onClick={() => setCategoria(null)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        TODAS AS CATEGORIAS
      </button>

      <div className="flex items-center gap-3 border-b border-border/60 pb-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/80 ring-1 ring-border/60">
          <atual.icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold uppercase tracking-[0.14em] text-foreground">{atual.grupo}</h1>
          <p className="text-[11px] text-muted-foreground">{atual.subtitulo}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {atual.itens.map((m) => (
          <button
            key={m.id}
            onClick={() => abrir(m)}
            className={`group relative w-full overflow-hidden rounded-xl border p-4 text-left backdrop-blur transition-all duration-300 hover:-translate-y-0.5 ${
              m.emBreve || m.manutencao
                ? "border-border/50 bg-card/40"
                : m.emDestaque
                  ? "border-accent/70 bg-card/90 ring-1 ring-accent/40 shadow-[0_24px_60px_-30px_hsl(var(--accent)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.12)]"
                  : "border-primary/40 bg-card/80 shadow-[0_18px_45px_-32px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.08)]"
            }`}
          >
            {!m.emBreve && !m.manutencao && (
              <div
                className={`absolute inset-0 ${m.emDestaque ? "bg-gradient-to-br from-accent/25 via-primary/10 to-transparent opacity-90" : "gradient-primary opacity-[0.08]"}`}
              />
            )}
            {m.emDestaque && (
              <span className="absolute right-0 top-0 rounded-bl-lg bg-gradient-to-r from-accent to-primary px-2 py-[3px] text-[9px] font-bold uppercase tracking-wider text-accent-foreground shadow-lg">
                Destaque
              </span>
            )}
            <div className="relative flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors ${m.emDestaque ? "bg-accent/20 ring-accent/50" : "bg-secondary/80 ring-border/60 group-hover:ring-primary/40"}`}>
                <m.icon className={`h-5 w-5 ${m.emBreve || m.manutencao ? "text-muted-foreground" : m.emDestaque ? "text-accent" : "text-primary"}`} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-foreground">{m.titulo}</p>
                  {!m.manutencao && (
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:text-primary" />
                  )}
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">{m.descricao}</p>
                <div className="flex flex-wrap items-center gap-1">
                  {m.badges?.map((b) => (
                    <Badge key={b.label} tone={b.tone} icon={b.tone === "hot" ? Flame : b.tone === "exclusivo" ? Sparkles : b.tone === "novo" ? Zap : MapPin}>{b.label}</Badge>
                  ))}

                  {atual.grupo === "ESCOLARES" && !m.manutencao && (
                    <Badge tone="estado" icon={MapPin}>ESTADOS</Badge>
                  )}
                  {m.qrcode && !m.manutencao && <Badge tone="qr" icon={QrCode}>QR Code</Badge>}
                  {m.aplicativo && !m.manutencao && <Badge tone="app" icon={Smartphone}>Aplicativo</Badge>}
                  {m.emBreve && <Badge tone="soon" icon={Lock}>Em breve</Badge>}
                  {m.manutencao && <Badge tone="maintenance" icon={Wrench}>Em manutenção</Badge>}
                  {!m.emBreve && !m.manutencao && m.creditos != null && (
                    <span className="text-[10px] font-semibold text-accent">
                      {m.creditos} CRÉDITO{m.creditos > 1 ? "S" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

