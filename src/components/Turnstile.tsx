import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile_script_error"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

let cachedConfig: { siteKey: string; enabled: boolean } | null = null;

async function getConfig() {
  if (cachedConfig) return cachedConfig;
  const { data } = await supabase.functions.invoke("verify-captcha", {
    body: { action: "config" },
  });
  cachedConfig = {
    siteKey: data?.siteKey ?? "",
    enabled: Boolean(data?.enabled),
  };
  return cachedConfig;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  /** Informa ao pai se o captcha está ativo (chaves configuradas) */
  onReady?: (enabled: boolean) => void;
  className?: string;
}

export default function Turnstile({
  onVerify,
  onExpire,
  onReady,
  className,
}: TurnstileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cfg = await getConfig();
        if (cancelled) return;
        setEnabled(cfg.enabled);
        onReady?.(cfg.enabled);
        if (!cfg.enabled || !cfg.siteKey) return;

        await loadScript();
        if (cancelled || !ref.current || !window.turnstile) return;

        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: cfg.siteKey,
          theme: "dark",
          callback: (token: string) => onVerify(token),
          "expired-callback": () => onExpire?.(),
          "error-callback": () => onExpire?.(),
        });
      } catch {
        // Falha ao carregar: não bloqueia o login
        if (!cancelled) {
          setEnabled(false);
          onReady?.(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (enabled === false) return null;

  return <div ref={ref} className={className} />;
}
