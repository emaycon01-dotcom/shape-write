import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, ShieldCheck } from "lucide-react";

interface HumanCheckProps {
  /** Chamado sempre que o estado de verificação muda */
  onChange: (verified: boolean) => void;
  className?: string;
}

function makeChallenge() {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  return { a, b, answer: a + b };
}

/**
 * Verificação anti-spam 100% local (sem scripts externos).
 * Nunca bloqueia o carregamento da página.
 */
export default function HumanCheck({ onChange, className }: HumanCheckProps) {
  const [challenge, setChallenge] = useState(makeChallenge);
  const [value, setValue] = useState("");
  const [verified, setVerified] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const reset = useCallback(() => {
    setChallenge(makeChallenge());
    setValue("");
    setVerified(false);
  }, []);

  useEffect(() => {
    onChange(verified);
  }, [verified, onChange]);

  const handleChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 3);
    setValue(clean);
    // Bots costumam responder instantaneamente: exige ao menos 1,2s de interação
    const humanTiming = Date.now() - startedAt > 1200;
    setVerified(Number(clean) === challenge.answer && humanTiming);
  };

  return (
    <div
      className={`rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 ${className ?? ""}`}
    >
      {/* honeypot invisível para bots */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 opacity-0 pointer-events-none"
        onChange={() => setVerified(false)}
      />

      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            verified ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
          }`}
        >
          {verified ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </div>

        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Verificação de segurança</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-medium text-foreground tabular-nums">
              {challenge.a} + {challenge.b} =
            </span>
            <input
              inputMode="numeric"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              aria-label="Resultado da verificação"
              className="h-8 w-16 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/60"
            />
            <button
              type="button"
              onClick={reset}
              aria-label="Gerar nova verificação"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
