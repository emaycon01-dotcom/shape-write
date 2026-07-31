import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const RECOVERY_KEY = "monkeylab_recovery_attempted";

function hasRecoveryAttempt() {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === "true";
  } catch {
    return true;
  }
}

function markRecoveryAttempt() {
  try {
    sessionStorage.setItem(RECOVERY_KEY, "true");
  } catch {
    // Sem armazenamento, exibimos a recuperação manual em vez de recarregar em loop.
  }
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha ao renderizar o aplicativo", error, info);

    const isChunkFailure = /chunk|dynamically imported|module script/i.test(error.message);
    if (isChunkFailure && !hasRecoveryAttempt()) {
      markRecoveryAttempt();
      window.location.reload();
    }
  }

  private reload = () => {
    try {
      sessionStorage.removeItem(RECOVERY_KEY);
    } catch {
      // Navegadores com armazenamento bloqueado ainda podem recarregar.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-background px-5 flex items-center justify-center">
        <section className="w-full max-w-sm text-center" aria-live="assertive">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Não foi possível abrir o sistema</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O carregamento foi interrompido. Recarregue para restaurar a sessão.
          </p>
          <Button className="mt-6 w-full" onClick={this.reload}>
            <RefreshCw className="size-4" />
            Recarregar sistema
          </Button>
        </section>
      </main>
    );
  }
}