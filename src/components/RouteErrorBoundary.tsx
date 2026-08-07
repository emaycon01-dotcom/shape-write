import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { clearChunkRecovery, resetLazyModules } from "@/lib/lazy-retry";


interface Props {
  /** Muda a cada rota: reinicia o boundary automaticamente ao navegar. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  attempt: number;
}

/**
 * Falhas de geração/preview (memória, canvas, rede) ficam contidas na área do
 * conteúdo. Antes qualquer erro aqui derrubava o app inteiro e o usuário via a
 * tela "Não foi possível abrir o sistema", perdendo a navegação.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      resetLazyModules();
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha na tela atual", error, info);

    // Falha de carregamento de módulo: o React guarda a promessa rejeitada,
    // então descartamos o módulo e remontamos automaticamente uma vez.
    if (isChunkFailure(error) && !this.autoRetried) {
      this.autoRetried = true;
      setTimeout(() => this.retry(), 400);
    }
  }

  private autoRetried = false;

  private retry = () => {
    clearChunkRecovery();
    resetLazyModules();
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  private hardReload = () => {
    clearChunkRecovery();
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return <div key={this.state.attempt}>{this.props.children}</div>;

    const memoryIssue = /memor|allocation|canvas|quota/i.test(error.message ?? "");
    const chunkIssue = isChunkFailure(error);

    return (
      <section className="mx-auto flex w-full max-w-md flex-col items-center py-16 text-center" aria-live="assertive">
        <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Não foi possível concluir esta tela</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {memoryIssue
            ? "O documento ficou pesado demais para o navegador. Feche outras abas e tente gerar novamente."
            : chunkIssue
              ? "O sistema foi atualizado enquanto esta aba estava aberta. Atualize para carregar a versão nova."
              : "Ocorreu uma falha temporária ao carregar esta página. Tente novamente — sua sessão continua ativa."}
        </p>
        <Button className="mt-6 w-full" onClick={this.retry}>
          <RefreshCw className="size-4" />
          Tentar novamente
        </Button>
        <Button variant="outline" className="mt-2 w-full" onClick={this.hardReload}>
          <RotateCcw className="size-4" />
          Atualizar sistema
        </Button>
      </section>
    );
  }

}
