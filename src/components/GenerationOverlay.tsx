import { useEffect, useState } from "react";
import { subscribePdfLoading } from "@/lib/pdf-loading";
import logo from "@/assets/logo.webp";

/**
 * Tela cheia de carregamento (cor do painel) exibida durante o preview e a
 * geração final. Também esconde a remontagem do documento (troca do QR Code).
 */
export default function GenerationOverlay() {
  const [state, setState] = useState({ active: false, label: "" });

  useEffect(() => subscribePdfLoading(setState), []);

  if (!state.active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 35%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />
      <div className="relative flex h-32 w-32 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
        <img
          src={logo}
          alt="MonkeyLab"
          className="h-16 w-16 animate-pulse object-contain"
        />
      </div>
      <div className="relative text-center">
        <p className="text-base font-semibold text-foreground">{state.label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Isso pode levar alguns segundos. Não feche a tela.
        </p>
      </div>
    </div>
  );
}
