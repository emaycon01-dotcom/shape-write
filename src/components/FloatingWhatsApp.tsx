import { useState } from "react";
import { MessageCircle, X, Headphones } from "lucide-react";

const CONTATOS = [
  {
    label: "Suporte Oficial",
    desc: "(81) 99212-0805",
    href: "https://wa.me/5581992120805",
    icon: Headphones,
    gradient: "from-emerald-500 to-green-600",
  },
];

export default function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-64 rounded-xl border border-border/70 bg-card/95 p-2 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-2">
          {CONTATOS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-secondary/60"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${c.gradient}`}>
                <c.icon className="h-4 w-4 text-primary-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">{c.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{c.desc}</span>
              </span>
            </a>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Suporte no WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 shadow-[0_10px_30px_-8px_rgba(16,185,129,0.8)] transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6 text-white" /> : <MessageCircle className="h-7 w-7 text-white" />}
      </button>
    </div>
  );
}
