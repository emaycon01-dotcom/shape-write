import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Lock, ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

interface PinGateProps {
  mode: "setup" | "verify";
  onSuccess: () => void;
}

export default function PinGate({ mode, onSuccess }: PinGateProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = useCallback(async (value: string) => {
    if (value.length !== 4) return;
    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-pin", {
        body: { action: "verify", pin: value },
      });

      if (fnError) {
        const parsed = typeof fnError === "object" && "message" in fnError
          ? fnError.message
          : "Erro ao verificar PIN";
        setError(parsed);
        setPin("");
        setLoading(false);
        return;
      }

      if (data?.valid) {
        sessionStorage.setItem("pin_verified", Date.now().toString());
        onSuccess();
      } else {
        setError(data?.error || "PIN incorreto");
        setPin("");
      }
    } catch {
      setError("Erro de conexão");
      setPin("");
    }
    setLoading(false);
  }, [onSuccess]);

  const handleSetup = useCallback(async () => {
    if (step === "enter") {
      if (pin.length !== 4) return;
      setStep("confirm");
      return;
    }

    if (confirmPin !== pin) {
      setError("Os PINs não coincidem");
      setConfirmPin("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("manage-pin", {
        body: { action: "set", pin },
      });

      if (fnError || !data?.success) {
        setError("Falha ao salvar PIN");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("pin_verified", Date.now().toString());
      onSuccess();
    } catch {
      setError("Erro de conexão");
    }
    setLoading(false);
  }, [pin, confirmPin, step, onSuccess]);

  const isSetup = mode === "setup";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <img src={logo} alt="Bellarus" className="w-16 h-16" />
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {isSetup ? (
              <KeyRound className="w-8 h-8 text-primary" />
            ) : (
              <Lock className="w-8 h-8 text-primary" />
            )}
          </div>
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {isSetup
              ? step === "enter"
                ? "Criar PIN de Segurança"
                : "Confirmar PIN"
              : "Verificação de Segurança"}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {isSetup
              ? step === "enter"
                ? "Crie um PIN de 4 dígitos para proteger seu painel"
                : "Digite o PIN novamente para confirmar"
              : "Digite seu PIN de 4 dígitos para acessar o painel"}
          </p>
        </div>

        <div className="flex justify-center">
          <InputOTP
            maxLength={4}
            value={isSetup ? (step === "enter" ? pin : confirmPin) : pin}
            onChange={(value) => {
              if (isSetup) {
                if (step === "enter") setPin(value);
                else setConfirmPin(value);
              } else {
                setPin(value);
                if (value.length === 4) handleVerify(value);
              }
              setError("");
            }}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="w-14 h-14 text-2xl border-border bg-secondary" />
              <InputOTPSlot index={1} className="w-14 h-14 text-2xl border-border bg-secondary" />
              <InputOTPSlot index={2} className="w-14 h-14 text-2xl border-border bg-secondary" />
              <InputOTPSlot index={3} className="w-14 h-14 text-2xl border-border bg-secondary" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p className="text-sm text-destructive font-medium">{error}</p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Verificando...</span>
          </div>
        )}

        {isSetup && (
          <Button
            onClick={handleSetup}
            disabled={
              loading ||
              (step === "enter" && pin.length !== 4) ||
              (step === "confirm" && confirmPin.length !== 4)
            }
            className="w-full h-12"
            variant="default"
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            {step === "enter" ? "Continuar" : "Salvar PIN"}
          </Button>
        )}

        <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Protegido por Bellarus Security</span>
        </div>
      </div>
    </div>
  );
}
