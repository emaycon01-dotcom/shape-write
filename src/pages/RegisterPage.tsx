import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Basic validation
    if (name.trim().length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      // Check rate limit server-side
      const { data: rateCheck } = await supabase.functions.invoke("rate-limit", {
        body: { action: "check", identifier: `register:${email}` },
      });

      if (rateCheck && !rateCheck.allowed) {
        setError("Muitos registros recentes. Aguarde 1 hora.");
        setLoading(false);
        return;
      }

      // Record the attempt
      await supabase.functions.invoke("rate-limit", {
        body: { action: "record", identifier: `register:${email}` },
      });

      await register(name.trim(), email.trim(), password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-secondary/30">
        <div className="text-center">
          <img src={logo} alt="Bellarus" className="w-40 h-40 mx-auto mb-6" />
          <h2 className="font-display text-3xl font-bold tracking-wider text-foreground">BELLARUS</h2>
          <p className="text-sm tracking-[0.3em] text-accent mt-1">SISTEMAS</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Criar Conta</h1>
          <p className="text-muted-foreground mb-8">Preencha os dados para começar</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-secondary border-border"
                required
                maxLength={100}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary border-border"
                required
                maxLength={255}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary border-border"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" variant="gradient" className="w-full h-12 rounded-lg text-base" disabled={loading}>
              {loading ? "Criando..." : "Criar Conta"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Já tem conta?{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">Entrar</Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Protegido por Bellarus Security</span>
          </div>
        </div>
      </div>
    </div>
  );
}
