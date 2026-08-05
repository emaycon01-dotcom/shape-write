import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Car, IdCard, Stethoscope, QrCode, Smartphone, Lock, ArrowUpRight, Anchor, GraduationCap, School, Wrench, HeartPulse, ShieldPlus, ShieldAlert, Pill, Crosshair, ArrowLeft, ChevronRight, Home, Zap } from "lucide-react";
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
};

type Categoria = {
  grupo: string;
  subtitulo: string;
  icon: React.ElementType;
  itens: Modulo[];
};

const MODULOS: Categoria[] = [
  {
    grupo: "DIGITAIS",
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
        id: "rg",
        titulo: "RG DIGITAL",
        descricao: "Nova identidade nacional digital (CIN)",
        icon: IdCard,
        qrcode: true,
        aplicativo: true,
        rota: "/dashboard/documents/rg",
        creditos: 1,
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
    ],
  },
  {
    grupo: "DIPLOMAS",
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
    ],
  },
  {
    grupo: "ESCOLARES",
    subtitulo: "DECLARAÇÕES E HISTÓRICOS ESCOLARES",
    icon: School,
    itens: [
      {
        id: "declaracao-escolar",
        titulo: "DECLARAÇÃO ESCOLAR",
        descricao: "Declaração de conclusão com brasão do estado selecionado",
        icon: School,
        rota: "/dashboard/documents/declaracao-escolar",
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
    ],
  },
  {
    grupo: "CERTIDÕES",
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
    subtitulo: "COMPROVANTES DE RESIDÊNCIA",
    icon: Home,
    itens: [
      {
        id: "comprovante-enel",
        titulo: "ENEL",
        descricao: "Fatura de energia Enel em 2 páginas, com código de barras e QR Code PIX",
        icon: Zap,
        rota: "/dashboard/documents/comprovante-enel",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "comprovante-coelba",
        titulo: "COELBA",
        descricao: "Fatura Neoenergia Coelba (DANFE NF3e) em 2 páginas, com chave de acesso e protocolo",
        icon: Zap,
        rota: "/dashboard/documents/comprovante-coelba",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "comprovante-equatorial",
        titulo: "EQUATORIAL",
        descricao: "Fatura Equatorial Goiás / CELG D (DANF3E NF3e) em 2 páginas, com ficha de compensação",
        icon: Zap,
        rota: "/dashboard/documents/comprovante-equatorial",
        creditos: 1,
        qrcode: true,
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
    grupo: "ATESTADOS",
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


function Badge({ tone, icon: Icon, children }: { tone: "qr" | "app" | "soon" | "maintenance"; icon: React.ElementType; children: React.ReactNode }) {
  const tones = {
    qr: "border-success/40 bg-success/15 text-success",
    app: "border-warning/40 bg-warning/15 text-warning",
    soon: "border-border/70 bg-muted/40 text-muted-foreground",
    maintenance: "border-destructive/40 bg-destructive/15 text-destructive",
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
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    {cat.itens.length} MÓDULOS
                  </p>
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
                : "border-primary/40 bg-card/80 shadow-[0_18px_45px_-32px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.08)]"
            }`}
          >
            {!m.emBreve && !m.manutencao && <div className="absolute inset-0 gradient-primary opacity-[0.08]" />}
            <div className="relative flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/80 ring-1 ring-border/60 transition-colors group-hover:ring-primary/40">
                <m.icon className={`h-5 w-5 ${m.emBreve || m.manutencao ? "text-muted-foreground" : "text-primary"}`} />
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

