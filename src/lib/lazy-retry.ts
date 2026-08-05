import { lazy, type ComponentType } from "react";

type Importer<T> = () => Promise<{ default: T }>;

const RELOAD_KEY = "monkeylab_chunk_reloads";
const MAX_RELOADS = 2;

function isChunkError(error: unknown) {
  const msg = error instanceof Error ? `${error.message} ${error.name}` : String(error ?? "");
  return /chunk|dynamically imported|module script|failed to fetch|importing a module|network/i.test(msg);
}

function reloadCount() {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) ?? "0") || 0;
  } catch {
    return MAX_RELOADS;
  }
}

function bumpReload() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(reloadCount() + 1));
  } catch {
    /* armazenamento bloqueado */
  }
}

export function clearChunkRecovery() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* noop */
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Carrega uma página com tentativas automáticas.
 * Falhas de rede/deploy antigo são reprocessadas em silêncio, sem tela de erro.
 */
export function lazyRetry<T extends ComponentType<never>>(importer: Importer<T>) {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const mod = await importer();
        clearChunkRecovery();
        return mod;
      } catch (error) {
        lastError = error;
        if (!isChunkError(error)) throw error;
        await wait(350 * (attempt + 1));
      }
    }

    // Após as tentativas, provavelmente é um build novo: recarrega uma única vez.
    if (isChunkError(lastError) && reloadCount() < MAX_RELOADS) {
      bumpReload();
      window.location.reload();
      await wait(10_000);
    }
    throw lastError;
  });
}
