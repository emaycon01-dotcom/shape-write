import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { clearChunkRecovery, resetLazyModules } from "@/lib/lazy-retry";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  retryKey: number;
}

const RECOVERY_KEY = "monkeylab_recovery_attempted";
const MAX_SOFT_RETRIES = 2;

function isChunkFailure(error: unknown) {
  const msg = error instanceof Error ? `${error.message} ${error.name}` : String(error ?? "");
  return /chunk|dynamically imported|module script|failed to fetch|importing a module/i.test(msg);
}

function recoveryAttempts() {
  try {
    return Number(sessionStorage.getItem(RECOVERY_KEY) ?? "0") || 0;
  } catch {
    return MAX_SOFT_RETRIES;
  }
}

function markRecoveryAttempt() {
  try {
    sessionStorage.setItem(RECOVERY_KEY, String(recoveryAttempts() + 1));
  } catch {
    // Sem armazenamento, exibimos a recuperação manual em vez de recarregar em loop.
  }
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };
  private softRetries = 0;

  static getDerivedStateFromError(error: Error): State {
    return { error, retryKey: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha ao renderizar o aplicativo", error, info);

    // Falha transitória de carregamento: tenta remontar em silêncio antes de mostrar erro.
    if (isChunkFailure(error) && this.softRetries < MAX_SOFT_RETRIES) {
      this.softRetries += 1;
      resetLazyModules();
      setTimeout(() => {
        this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }));
      }, 400 * this.softRetries);
      return;
    }

    if (isChunkFailure(error) && recoveryAttempts() < MAX_SOFT_RETRIES) {
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
    clearChunkRecovery();
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
    }

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
