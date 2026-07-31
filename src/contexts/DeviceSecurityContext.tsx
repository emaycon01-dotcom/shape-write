import React, { createContext, useContext, useState, useCallback } from "react";
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

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // O bloqueio de storage não pode impedir o acesso ao sistema.
  }
}

export function DeviceSecurityProvider({ children }: { children: React.ReactNode }) {
  const [isBanned, setIsBanned] = useState(() => readStorage("device_banned") === "true");
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  // Nenhuma verificação ou chamada externa acontece durante a abertura do app.
  const [checkingDevice] = useState(false);

  const reportViolation = useCallback(async (userId?: string, email?: string, reason?: string) => {
    const fp = fingerprint || getCachedFingerprint() || (await generateDeviceFingerprint().catch(() => null));
    if (!fp) return false;
    setFingerprint(fp);

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
        writeStorage("device_banned", "true");
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
