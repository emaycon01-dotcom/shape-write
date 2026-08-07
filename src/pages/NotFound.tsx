import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("Rota inexistente:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <section className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Compass className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido. Sua sessão continua ativa.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to="/dashboard">Voltar ao início</Link>
        </Button>
      </section>
    </main>
  );
};

export default NotFound;
