import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateDeviceFingerprint, getCachedFingerprint } from "@/lib/device-fingerprint";

interface DeviceSecurityContextType {
  isBanned: boolean;
  fingerprint: string | null;
  checkingDevice: boolean;
  reportViolation: (userId?: string, email?: string, reason?: string) => Promise<boolean>;
}

const DeviceSecurityContext = createContext<DeviceSecurityContextType>({
  isBanned: false,
  fingerprint: null,
  checkingDevice: true,
  reportViolation: async () => false,
});

const DEVICE_OK_KEY = "device_check_ok_until";
const DEVICE_OK_TTL = 12 * 60 * 60 * 1000; // 12h

export function DeviceSecurityProvider({ children }: { children: React.ReactNode }) {
  const [isBanned, setIsBanned] = useState(() => localStorage.getItem("device_banned") === "true");
  const [fingerprint, setFingerprint] = useState<string | null>(() => getCachedFingerprint());
  // Não bloqueia a renderização: o app abre na hora e a checagem roda em background.
  const [checkingDevice] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("device_banned") === "true") return;

    // Resultado recente em cache — evita chamar a edge function a cada carregamento
    const okUntil = Number(localStorage.getItem(DEVICE_OK_KEY) || 0);
    if (Date.now() < okUntil) return;

    const checkDevice = async () => {
      try {
        const fp = getCachedFingerprint() || (await generateDeviceFingerprint());
        setFingerprint(fp);

        const { data } = await supabase.functions.invoke("device-security", {
          body: { action: "check", fingerprint: fp },
        });

        if (data?.banned) {
          setIsBanned(true);
          localStorage.setItem("device_banned", "true");
        } else {
          localStorage.setItem(DEVICE_OK_KEY, String(Date.now() + DEVICE_OK_TTL));
        }
      } catch {
        // If we can't check, allow access (fail open — server-side will still enforce)
      }
    };

    // roda depois do primeiro paint
    const id = window.setTimeout(checkDevice, 0);
    return () => window.clearTimeout(id);
  }, []);

  const reportViolation = useCallback(async (userId?: string, email?: string, reason?: string) => {
    const fp = fingerprint || getCachedFingerprint();
    if (!fp) return false;

    try {
      const { data } = await supabase.functions.invoke("device-security", {
        body: {
          action: "report_violation",
          fingerprint: fp,
          user_id: userId,
          user_email: email,
          reason,
        },
      });

      if (data?.banned) {
        setIsBanned(true);
        localStorage.setItem("device_banned", "true");
        return true; // device was banned
      }
      return false;
    } catch {
      return false;
    }
  }, [fingerprint]);

  return (
    <DeviceSecurityContext.Provider value={{ isBanned, fingerprint, checkingDevice, reportViolation }}>
      {children}
    </DeviceSecurityContext.Provider>
  );
}

export function useDeviceSecurity() {
  return useContext(DeviceSecurityContext);
}
