import { createElement, lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from "react";

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
    sessionStorage.removeItem("monkeylab_preload_reload");
  } catch {
    /* noop */
  }
}

/**
 * React.lazy guarda a promessa REJEITADA para sempre: depois de uma falha de
 * rede o mesmo componente nunca mais carrega, e todas as telas passam a exibir
 * a mensagem de erro até o usuário limpar o navegador.
 * A "geração" abaixo permite recriar os componentes lazy do zero ao tentar de
 * novo, descartando a promessa rejeitada.
 */
let generation = 0;
const listeners = new Set<() => void>();

export function resetLazyModules() {
  generation += 1;
  listeners.forEach((l) => l());
}

function useGeneration() {
  const [value, setValue] = useState(generation);
  useEffect(() => {
    const listener = () => setValue(generation);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return value;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Carrega uma página com tentativas automáticas.
 * Falhas de rede/deploy antigo são reprocessadas em silêncio e, ao tentar
 * novamente, o módulo é buscado outra vez (sem cache de erro).
 */
export function lazyRetry<T extends ComponentType<never>>(importer: Importer<T>) {
  const cache = new Map<number, LazyExoticComponent<T>>();

  const load = async () => {
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
  };

  const get = (gen: number) => {
    let component = cache.get(gen);
    if (!component) {
      component = lazy(load);
      cache.clear();
      cache.set(gen, component);
    }
    return component;
  };

  return function LazyRoute(props: Record<string, unknown>) {
    const gen = useGeneration();
    return createElement(get(gen) as unknown as ComponentType<Record<string, unknown>>, props);
  } as unknown as T;
}
