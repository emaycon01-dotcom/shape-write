import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import Turnstile, { verifyCaptchaToken } from "@/components/Turnstile";
import logo from "@/assets/logo.webp";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleVerify = useCallback((t: string) => setCaptchaToken(t), []);
  const handleExpire = useCallback(() => setCaptchaToken(""), []);
  const handleReady = useCallback((v: boolean) => setCaptchaEnabled(v), []);
  const human = !captchaEnabled || Boolean(captchaToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!human) {
      setError("Conclua a verificação de segurança.");
      return;
    }

    setLoading(true);

    try {
      if (captchaEnabled && captchaToken) {
        const ok = await verifyCaptchaToken(captchaToken);
        if (!ok) {
          setCaptchaToken("");
          setError("Verificação de segurança falhou. Tente novamente.");
          setLoading(false);
          return;
        }
      }

      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err?.message || "";
      const isEmailNotConfirmed =
        msg.toLowerCase().includes("email not confirmed") ||
        msg.toLowerCase().includes("email_not_confirmed");

      if (msg.includes("análise") || msg.includes("recusado")) {
        setError(msg);
      } else if (isEmailNotConfirmed) {
        setError("E-mail ainda não verificado.");
      } else {
        setError("E-mail ou senha inválidos.");
      }
    } finally {

      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-background">
        <div className="text-center">
          <img
            src={logo}
            alt="MonkeyLab"
            className="w-72 mx-auto object-contain drop-shadow-[0_20px_50px_hsl(var(--accent)/0.45)]"
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8">
        <img
          src={logo}
          alt="MonkeyLab"
          className="lg:hidden w-48 mb-6 object-contain drop-shadow-[0_16px_40px_hsl(var(--accent)/0.45)]"
        />
        <div className="w-full max-w-md relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-accent/50 via-primary/20 to-transparent opacity-60 blur-md transition-all duration-700 group-hover:opacity-90 group-focus-within:opacity-100" />

          <div className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-[0_20px_60px_-20px_hsl(var(--accent)/0.45),inset_0_1px_0_hsl(var(--foreground)/0.06)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_80px_-20px_hsl(var(--accent)/0.6),inset_0_1px_0_hsl(var(--foreground)/0.1)]">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
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

              <Turnstile
                onVerify={handleVerify}
                onExpire={handleExpire}
                onReady={handleReady}
                className="flex justify-center"
              />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full h-12 rounded-lg text-base bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-[0_10px_30px_-10px_hsl(var(--accent)/0.7)] transition-all duration-300 hover:-translate-y-0.5"
                disabled={loading || !human}
              >

                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              <Link to="/register" className="text-accent font-medium hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
