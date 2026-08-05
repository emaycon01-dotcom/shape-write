import { Link } from "react-router-dom";
import logo from "@/assets/logo.webp";

const links = {
  ACESSO: [
    { label: "Início", to: "/dashboard" },
    { label: "Serviços", to: "/dashboard/documents" },
    { label: "Histórico", to: "/dashboard/history" },
    { label: "Aplicativos", to: "/dashboard/aplicativos" },
  ],
  "COMO FUNCIONA": [
    { label: "Planos", to: "/dashboard/planos" },
    { label: "Recarregar créditos", to: "/dashboard/recarregar" },
    { label: "Criador de Assinaturas", to: "/dashboard/ferramentas/assinaturas" },
  ],
};

export default function AppFooter() {
  return (
    <footer className="mt-10 border-t border-border/60 bg-card/40 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="MonkeyLab" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Plataforma MonkeyLab: geração de serviços digitais com qualidade, rapidez e
              segurança. Tudo em um só lugar, com suporte direto pelo painel.
            </p>
          </div>

          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h3 className="mb-4 text-xs font-semibold tracking-widest text-foreground">{title}</h3>
              <ul className="space-y-2.5">
                {items.map((i) => (
                  <li key={i.to}>
                    <Link
                      to={i.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border/60">
        <p className="mx-auto max-w-6xl px-6 py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} MonkeyLab — Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
