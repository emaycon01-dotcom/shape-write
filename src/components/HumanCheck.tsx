import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, ShieldCheck } from "lucide-react";

interface HumanCheckProps {
  /** Chamado sempre que o estado de verificação muda */
  onChange: (verified: boolean) => void;
  className?: string;
}

type Challenge = { label: string; answer: number };

const rnd = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function makeChallenges(): Challenge[] {
  // Soma
  const a1 = rnd(2, 9);
  const b1 = rnd(2, 9);
  // Multiplicação
  const a2 = rnd(2, 9);
  const b2 = rnd(2, 9);
  // Divisão exata
  const b3 = rnd(2, 9);
  const r3 = rnd(2, 9);
  const a3 = b3 * r3;

  return [
    { label: `${a1} + ${b1} =`, answer: a1 + b1 },
    { label: `${a2} × ${b2} =`, answer: a2 * b2 },
    { label: `${a3} ÷ ${b3} =`, answer: r3 },
  ];
}

/**
 * Verificação anti-spam 100% local (sem scripts externos).
 * 3 desafios: soma, multiplicação e divisão.
 */
export default function HumanCheck({ onChange, className }: HumanCheckProps) {
  const [challenges, setChallenges] = useState<Challenge[]>(makeChallenges);
  const [values, setValues] = useState<string[]>(["", "", ""]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [honeypot, setHoneypot] = useState(false);

  const verified = useMemo(() => {
    if (honeypot) return false;
    if (Date.now() - startedAt < 1200) return false;
    return challenges.every((c, i) => values[i] !== "" && Number(values[i]) === c.answer);
  }, [challenges, values, startedAt, honeypot]);

  const reset = useCallback(() => {
    setChallenges(makeChallenges());
    setValues(["", "", ""]);
    setStartedAt(Date.now());
  }, []);

  useEffect(() => {
    onChange(verified);
  }, [verified, onChange]);

  const handleChange = (index: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 3);
    setValues((prev) => prev.map((p, i) => (i === index ? clean : p)));
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
        onChange={() => setHoneypot(true)}
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Verificação de segurança</p>
            <button
              type="button"
              onClick={reset}
              aria-label="Gerar nova verificação"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {challenges.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="min-w-[72px] text-sm font-medium text-foreground tabular-nums">
                  {c.label}
                </span>
                <input
                  inputMode="numeric"
                  value={values[i]}
                  onChange={(e) => handleChange(i, e.target.value)}
                  aria-label={`Resultado da verificação ${i + 1}`}
                  className="h-8 w-16 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/60"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
