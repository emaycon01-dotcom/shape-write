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

export function DeviceSecurityProvider({ children }: { children: React.ReactNode }) {
  const [isBanned, setIsBanned] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [checkingDevice, setCheckingDevice] = useState(true);

  useEffect(() => {
    const checkDevice = async () => {
      try {
        // Check localStorage ban flag first (instant block)
        const localBan = localStorage.getItem("device_banned");
        if (localBan === "true") {
          setIsBanned(true);
          setCheckingDevice(false);
          return;
        }

        const fp = getCachedFingerprint() || await generateDeviceFingerprint();
        setFingerprint(fp);

        // Check against server
        const { data } = await supabase.functions.invoke("device-security", {
          body: { action: "check", fingerprint: fp },
        });

        if (data?.banned) {
          setIsBanned(true);
          localStorage.setItem("device_banned", "true");
        }
      } catch {
        // If we can't check, allow access (fail open — server-side will still enforce)
      }
      setCheckingDevice(false);
    };

    checkDevice();
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
