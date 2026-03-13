import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Shield, QrCode, Zap } from "lucide-react";
import logo from "@/assets/logo.png";

const features = [
  {
    icon: FileText,
    title: "Documentos Digitais",
    description: "Gere documentos personalizados com templates profissionais em segundos.",
  },
  {
    icon: Shield,
    title: "Segurança Total",
    description: "Cada documento possui verificação única via QR Code e criptografia.",
  },
  {
    icon: QrCode,
    title: "Verificação Instantânea",
    description: "QR Code exclusivo para validação pública e imediata do documento.",
  },
  {
    icon: Zap,
    title: "Geração Automática",
    description: "PDFs gerados automaticamente a partir de formulários dinâmicos.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Bellarus" className="h-9 w-9" />
            <div>
              <span className="font-display font-bold text-lg tracking-wider text-foreground">
                BELLARUS
              </span>
              <span className="block text-[10px] tracking-[0.3em] text-muted-foreground -mt-1">
                SISTEMAS
              </span>
            </div>
          </Link>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button variant="gradient" asChild>
              <Link to="/register">Criar Conta</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 flex items-center justify-center min-h-[80vh]">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-glow-pulse" />

        <div className="container relative z-10 text-center max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-secondary/50 text-sm text-muted-foreground mb-8">
              <Shield className="w-4 h-4 text-primary" />
              Plataforma segura de documentos digitais
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-bold leading-tight mb-6 text-foreground">
              Documentos Digitais{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary">
                Inteligentes
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
              Crie, gerencie e verifique documentos digitais com segurança, 
              rapidez e tecnologia de ponta.
            </p>

            <div className="flex gap-4 justify-center">
              <Button variant="hero" asChild>
                <Link to="/register">Começar Agora</Link>
              </Button>
              <Button variant="hero-outline" asChild>
                <Link to="/login">Fazer Login</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Recursos da Plataforma
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Tudo que você precisa para gerenciar documentos digitais.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="glass rounded-xl p-6 hover:border-primary/30 transition-colors group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow">
                  <f.icon className="w-6 h-6 text-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2026 Bellarus Sistemas. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
