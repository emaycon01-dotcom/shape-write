import { Download, ExternalLink, Smartphone } from "lucide-react";
import cnhApk from "@/assets/cnh_do_brasil.apk.asset.json";
import govApk from "@/assets/gov.apk.asset.json";

const APLICATIVOS = [
  {
    titulo: "Aplicativo da CNH",
    arquivo: "cnh_do_brasil.apk",
    descricao: "APK oficial usado para exibir a CNH Digital gerada.",
    url: cnhApk.url,
    tamanho: cnhApk.size,
    gradient: "gradient-dealer",
    links: [{ label: "Site da CNH", href: "https://condutor-cnhdigital-vio-webs.info" }],
  },
  {
    titulo: "Aplicativo do RG e CHA",
    arquivo: "gov.apk",
    descricao: "APK usado para o RG Digital (CIN) e a CNH Marítima (CHA).",
    url: govApk.url,
    tamanho: govApk.size,
    gradient: "gradient-master",
    links: [{ label: "Site do RG e CHA", href: "https://cidadaniagov-info.site/" }],
  },
];

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function AplicativosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Aplicativos</h1>
        <p className="text-sm text-muted-foreground">Baixe os APKs e acesse os sites de validação de cada módulo</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {APLICATIVOS.map((app) => (
          <div
            key={app.arquivo}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 p-5 backdrop-blur transition-all hover:-translate-y-0.5"
          >
            <div className={`absolute inset-x-0 top-0 h-[3px] ${app.gradient}`} />
            <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full ${app.gradient} opacity-20 blur-2xl`} />

            <div className="relative space-y-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${app.gradient}`}>
                <Smartphone className="h-5 w-5 text-primary-foreground" />
              </span>

              <div className="space-y-1">
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{app.titulo}</h2>
                <p className="text-[11px] leading-tight text-muted-foreground">{app.descricao}</p>
                <p className="text-[10px] text-muted-foreground">
                  {app.arquivo} · {mb(app.tamanho)}
                </p>
              </div>

              <a
                href={app.url}
                download={app.arquivo}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-primary-foreground transition-transform hover:scale-[1.02] ${app.gradient}`}
              >
                <Download className="h-4 w-4" />
                Baixar APK
              </a>

              <div className="space-y-1 border-t border-border/60 pt-3">
                {app.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{l.href.replace(/^https:\/\//, "")}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
