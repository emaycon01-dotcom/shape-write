import { useEffect, useState } from "react";
import { Moon, Sun, Sparkles } from "lucide-react";

const THEMES = [
  { id: "", label: "Padrão", icon: Sparkles },
  { id: "theme-dark-blue", label: "Escuro", icon: Moon },
  { id: "theme-light", label: "Claro", icon: Sun },
] as const;

const STORAGE_KEY = "app_theme";

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function applyStoredTheme() {
  try {
    const saved = readStoredTheme();
    const root = document.documentElement;
    THEMES.forEach((t) => t.id && root.classList.remove(t.id));
    if (saved) root.classList.add(saved);
  } catch {
    // O tema nunca deve impedir a inicialização do aplicativo.
  }
}

export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<string>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach((t) => t.id && root.classList.remove(t.id));
    if (theme) root.classList.add(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Navegação privada pode bloquear o armazenamento local.
    }
  }, [theme]);

  return (
    <div className="space-y-1.5">
      {!compact && (
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Cores</p>
      )}
      <div className="flex items-center gap-1">
        {THEMES.map((t) => (
          <button
            key={t.id || "default"}
            onClick={() => setTheme(t.id)}
            title={t.label}
            aria-label={`Tema ${t.label}`}
            className={`flex h-7 flex-1 items-center justify-center rounded-md border text-[10px] transition-colors ${
              theme === t.id
                ? "border-primary/60 bg-secondary text-primary"
                : "border-border/60 text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
