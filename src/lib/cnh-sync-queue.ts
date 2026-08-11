/**
 * Fila persistente de sincronização da CNH com a base consultada por CPF.
 *
 * Antes, quando o envio falhava (foto grande, memória do celular, rede caindo),
 * o registro simplesmente se perdia e o CPF nunca aparecia no validador.
 * Agora cada CNH gerada entra numa fila no próprio navegador e é reenviada em
 * segundo plano — ao voltar ao app, ao recuperar a conexão e periodicamente —
 * até o backend confirmar a gravação.
 */

const STORAGE_KEY = "cnh_sync_queue_v1";
const MAX_ITEMS = 20;

export interface CnhSyncItem {
  id: string;
  formData: Record<string, string>;
  tries: number;
  createdAt: number;
}

function read(): CnhSyncItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(items: CnhSyncItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    /* armazenamento cheio: a fila é best-effort */
  }
}

export function enqueueCnhSync(formData: Record<string, string>): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const items = read().filter((i) => i.formData?.cpf !== formData.cpf);
  items.push({ id, formData, tries: 0, createdAt: Date.now() });
  write(items);
  return id;
}

export function dequeueCnhSync(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function pendingCnhSyncCount(): number {
  return read().length;
}

let flushing = false;

/**
 * Reenvia os pendentes. Só os DADOS (sem foto) — é o que faz o CPF ser
 * encontrado no validador; a foto, quando disponível, já foi enviada na
 * geração e é preservada pelo upsert do servidor.
 */
export async function flushCnhSyncQueue(): Promise<void> {
  if (flushing) return;
  const items = read();
  if (!items.length) return;
  flushing = true;
  try {
    const { syncCnhDataOnly } = await import("@/lib/cnh-external-sync");
    for (const item of items) {
      // Desiste depois de muitas tentativas para não crescer indefinidamente.
      if (item.tries >= 25 || Date.now() - item.createdAt > 7 * 24 * 60 * 60 * 1000) {
        dequeueCnhSync(item.id);
        continue;
      }
      let ok = false;
      try {
        ok = await syncCnhDataOnly(item.formData);
      } catch {
        ok = false;
      }
      if (ok) {
        dequeueCnhSync(item.id);
      } else {
        const current = read();
        const found = current.find((i) => i.id === item.id);
        if (found) {
          found.tries += 1;
          write(current);
        }
      }
    }
  } finally {
    flushing = false;
  }
}

/** Liga os gatilhos automáticos (uma vez por sessão). */
let started = false;
export function startCnhSyncWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;
  const run = () => void flushCnhSyncQueue();
  window.setTimeout(run, 4000);
  window.setInterval(run, 60_000);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run();
  });
}
