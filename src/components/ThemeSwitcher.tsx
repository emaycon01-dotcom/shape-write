import { useEffect, useState } from "react";
import { Moon, Sun, Sparkles } from "lucide-react";

const THEMES = [
  { id: "", label: "Padrão", icon: Sparkles },
  { id: "theme-dark-blue", label: "Escuro", icon: Moon },
  { id: "theme-light", label: "Claro", icon: Sun },
] as const;

const STORAGE_KEY = "app_theme";

export function applyStoredTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) ?? "";
  const root = document.documentElement;
  THEMES.forEach((t) => t.id && root.classList.remove(t.id));
  if (saved) root.classList.add(saved);
}

export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? "");

  useEffect(() => {
    const root = document.documentElement;
    THEMES.forEach((t) => t.id && root.classList.remove(t.id));
    if (theme) root.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
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
