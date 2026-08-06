import { useNavigate } from "react-router-dom";
import { PenLine, Upload, FileSignature } from "lucide-react";

const FORM_ROUTE = "/dashboard/documents/ficha19";

export default function Ficha19ModePage() {
  const navigate = useNavigate();

  const opcoes = [
    {
      id: "auto" as const,
      icon: FileSignature,
      titulo: "ASSINATURA AUTOMÁTICA",
      descricao:
        "Usa as assinaturas oficiais já cadastradas (Secretário e Diretor). Basta preencher os dados.",
    },
    {
      id: "manual" as const,
      icon: Upload,
      titulo: "ASSINATURA MANUAL",
      descricao:
        "Você envia as duas assinaturas (Secretário e Diretor) por upload dentro do formulário.",
    },
  ];

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate("/dashboard/documents")}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Voltar
      </button>

      <h1 className="font-display mb-1 text-2xl font-bold text-foreground">
        CERTIFICADO + HISTÓRICO (FICHA 19)
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Escolha como as assinaturas devem aparecer no documento.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            onClick={() => navigate(FORM_ROUTE, { state: { modo: o.id } })}
            className="glass group rounded-2xl border border-border/60 p-6 text-left transition hover:border-primary/60 hover:shadow-lg"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/20">
              <o.icon className="h-6 w-6" />
            </div>
            <h2 className="mb-1.5 text-base font-bold text-foreground">{o.titulo}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{o.descricao}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <PenLine className="h-3.5 w-3.5" /> Continuar
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
