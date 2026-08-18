/**
 * Fila persistente de sincronização de RG/CHA com o app externo de consulta.
 *
 * Quando o envio falha (rede do celular, função sem token no momento), o
 * registro fica guardado no navegador e é reenviado sozinho ao reabrir o app,
 * ao voltar a conexão e periodicamente — até o app de consulta confirmar.
 * Só os dados são guardados (sem as imagens), que é o que faz o CPF ser
 * encontrado no validador.
 */
import { sendDocIngest, stripImages, type DocIngestTable } from "@/lib/doc-ingest";
import { isGenerationBusy } from "@/lib/generation-busy";

const STORAGE_KEY = "doc_sync_queue_v1";
const MAX_ITEMS = 20;

interface DocSyncItem {
  id: string;
  tabela: DocIngestTable;
  dados: Record<string, unknown>;
  tries: number;
  createdAt: number;
}

function read(): DocSyncItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(items: DocSyncItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    /* armazenamento cheio: a fila é best-effort */
  }
}

export function enqueueDocSync(tabela: DocIngestTable, dados: Record<string, unknown>) {
  const light = stripImages(dados);
  const items = read().filter(
    (i) => !(i.tabela === tabela && i.dados?.documento_id === light.documento_id),
  );
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tabela,
    dados: light,
    tries: 0,
    createdAt: Date.now(),
  });
  write(items);
}

export function pendingDocSyncCount(): number {
  return read().length;
}

let flushing = false;

export async function flushDocSyncQueue(): Promise<void> {
  if (flushing) return;
  // Nunca disputa memória/rede com uma geração em andamento.
  if (isGenerationBusy()) return;
  const items = read();
  if (!items.length) return;
  flushing = true;
  try {
    for (const item of items) {
      if (item.tries >= 25 || Date.now() - item.createdAt > 7 * 24 * 60 * 60 * 1000) {
        write(read().filter((i) => i.id !== item.id));
        continue;
      }
      let ok = false;
      try {
        ok = (await sendDocIngest(item.tabela, item.dados, 1)).ok;
      } catch {
        ok = false;
      }
      if (ok) {
        write(read().filter((i) => i.id !== item.id));
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

let started = false;
export function startDocSyncWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;
  const run = () => void flushDocSyncQueue();
  window.setTimeout(run, 6000);
  window.setInterval(run, 60_000);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run();
  });
}
