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

export function isPreviewHost() {
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.includes("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".sandbox.lovable.dev")
  );
}

/** Valida o token no servidor (Cloudflare siteverify). */
export async function verifyCaptchaToken(token: string): Promise<boolean> {
  if (isPreviewHost()) return true;
  try {
    const { data, error } = await supabase.functions.invoke("verify-captcha", {
      body: { action: "verify", token },
    });
    if (error) return false;
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

/** Chave de teste oficial da Cloudflare (sempre aprova) para hosts de preview */
const TEST_SITE_KEY = "1x00000000000000000000AA";

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
        // Em hosts de preview a Cloudflare rejeita o domínio real, então
        // usamos a chave de teste oficial: o widget aparece e sempre aprova.
        let siteKey = TEST_SITE_KEY;

        if (!isPreviewHost()) {
          const cfg = await getConfig();
          if (cancelled) return;
          if (!cfg.enabled || !cfg.siteKey) {
            setEnabled(false);
            onReady?.(false);
            return;
          }
          siteKey = cfg.siteKey;
        }

        setEnabled(true);
        onReady?.(true);

        await loadScript();
        if (cancelled || !ref.current || !window.turnstile) return;

        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme: "dark",
          action: "login",
          appearance: "always",
          retry: "auto",
          "retry-interval": 3000,
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
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
