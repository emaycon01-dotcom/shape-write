import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDeviceSecurity } from "@/contexts/DeviceSecurityContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

const MAX_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const { login } = useAuth();
  const { reportViolation } = useDeviceSecurity();
  const navigate = useNavigate();

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isLocked) {
      const remaining = Math.ceil(((lockedUntil ?? 0) - Date.now()) / 60000);
      setError(`Muitas tentativas. Aguarde ${remaining} minuto(s).`);
      return;
    }

    setLoading(true);

    try {
      // Rate limit: verifica e registra numa única chamada
      const { data: rateCheck } = await supabase.functions.invoke("rate-limit", {
        body: { action: "check_and_record", identifier: `login:${email}` },
      });

      if (rateCheck && !rateCheck.allowed) {
        setLockedUntil(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        setError(`Muitas tentativas. Aguarde ${LOCKOUT_MINUTES} minutos.`);
        // Report as violation (em background)
        void reportViolation(undefined, email, "Excesso de tentativas de login");
        setLoading(false);
        return;
      }

      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      const msg = err?.message || "";
      const isEmailNotConfirmed = msg.toLowerCase().includes("email not confirmed") || msg.toLowerCase().includes("email_not_confirmed");

      // Report violation after excessive attempts
      if (newAttempts >= 8) {
        await reportViolation(undefined, email, `Brute force login: ${newAttempts} tentativas`);
      }

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        setError(`Conta bloqueada temporariamente. Aguarde ${LOCKOUT_MINUTES} minutos.`);
      } else if (isEmailNotConfirmed) {
        setError("📧 Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada (e a pasta de spam) e clique no link de confirmação para ativar sua conta.");
      } else {
        setError(`E-mail ou senha inválidos (${MAX_ATTEMPTS - newAttempts} tentativas restantes)`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-background">
        <div className="text-center">
          <img src={logo} alt="MonkeyLab" className="w-72 mx-auto object-contain drop-shadow-[0_20px_50px_hsl(var(--accent)/0.45)]" />
        </div>


      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8">
        <img src={logo} alt="MonkeyLab" className="lg:hidden w-48 mb-6 object-contain drop-shadow-[0_16px_40px_hsl(var(--accent)/0.45)]" />
        <div className="w-full max-w-md relative group">

          {/* glow atrás do cartão */}
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-accent/50 via-primary/20 to-transparent opacity-60 blur-md transition-all duration-700 group-hover:opacity-90 group-focus-within:opacity-100" />

          <div className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-[0_20px_60px_-20px_hsl(var(--accent)/0.45),inset_0_1px_0_hsl(var(--foreground)/0.06)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_80px_-20px_hsl(var(--accent)/0.6),inset_0_1px_0_hsl(var(--foreground)/0.1)]">
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-muted-foreground mb-8">
              Acesse sua conta para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/70 border-border transition-all duration-300 focus-visible:ring-accent/60"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary/70 border-border pr-10 transition-all duration-300 focus-visible:ring-accent/60"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-lg text-base bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-[0_10px_30px_-10px_hsl(var(--accent)/0.7)] transition-all duration-300 hover:-translate-y-0.5"
                disabled={loading || isLocked}
              >
                {loading ? "Entrando..." : isLocked ? "Bloqueado temporariamente" : "Entrar"}
              </Button>
            </form>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-border" />
              <span className="text-sm text-muted-foreground">ou</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-border" />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Não tem conta?{" "}
              <Link to="/register" className="text-accent font-medium hover:underline">
                Criar agora
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
