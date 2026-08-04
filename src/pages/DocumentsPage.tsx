import { useNavigate } from "react-router-dom";
import { FileText, Car, IdCard, Stethoscope, QrCode, Smartphone, Lock, ArrowUpRight, Anchor, GraduationCap, School, Wrench, HeartPulse, ShieldPlus, ShieldAlert } from "lucide-react";
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

const MODULOS: { grupo: string; subtitulo: string; itens: Modulo[] }[] = [
  {
    grupo: "Digitais",
    subtitulo: "Documentos digitais com validação online",
    itens: [
      {
        id: "cnh",
        titulo: "CNH Digital",
        descricao: "CNH Digital 2026 com login, APK e validação",
        icon: FileText,
        rota: "/dashboard/documents/cnh",
        creditos: 1,
        qrcode: true,
        aplicativo: true,
      },
      {
        id: "crlv",
        titulo: "CRLV Digital",
        descricao: "Certificado de registro e licenciamento",
        icon: Car,
        rota: "/dashboard/documents/crlv",
        creditos: 1,
        qrcode: true,
      },

      {
        id: "rg",
        titulo: "RG Digital",
        descricao: "Nova identidade nacional digital (CIN)",
        icon: IdCard,
        qrcode: true,
        aplicativo: true,
        rota: "/dashboard/documents/rg",
        creditos: 1,
      },
      {
        id: "cha",
        titulo: "CNH Marítima (CHA)",
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
    grupo: "Acadêmicos",
    subtitulo: "Diplomas e documentos de ensino superior",
    itens: [
      {
        id: "diploma",
        titulo: "Diploma Superior",
        descricao: "Diploma de graduação com verso de registro e QR Code",
        icon: GraduationCap,
        rota: "/dashboard/documents/diploma",
        creditos: 1,
        qrcode: true,
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
    grupo: "Atestado",
    subtitulo: "Documentos médicos e declarações",
    itens: [
      {
        id: "atestado",
        titulo: "Atestado UPA24h",
        descricao: "Atestado digital com validação por QR Code",
        icon: Stethoscope,
        rota: "/dashboard/documents/atestado",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "hapvida",
        titulo: "Atestado HapVida",
        descricao: "Atestado HapVida / NotreDame com prescrição e QR Code",
        icon: HeartPulse,
        rota: "/dashboard/documents/hapvida",
        creditos: 1,
        qrcode: true,
      },
      {
        id: "unimed",
        titulo: "Atestado Unimed",
        descricao: "Atestado médico Unimed com assinatura ICP-Brasil e QR Code",
        icon: ShieldPlus,
        rota: "/dashboard/documents/unimed",
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Serviços</h1>
        <p className="text-sm text-muted-foreground">Módulos disponíveis na plataforma</p>
      </div>


      {MODULOS.map((mod) => (
        <section key={mod.grupo} className="space-y-3">
          <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-2">
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">{mod.grupo}</h2>
              <p className="text-[11px] text-muted-foreground">{mod.subtitulo}</p>
            </div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {mod.itens.length} {mod.itens.length === 1 ? "módulo" : "módulos"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mod.itens.map((m) => (
            <button
                key={m.id}
                onClick={() => abrir(m)}
                className={`group relative overflow-hidden rounded-xl border p-4 text-left backdrop-blur transition-all duration-300 hover:-translate-y-0.5 ${
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
                          {m.creditos} crédito{m.creditos > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="text-center text-[11px] text-muted-foreground">Novos módulos serão adicionados em breve.</p>
    </div>
  );
}
