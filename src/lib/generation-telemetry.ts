/**
 * Diagnóstico das gerações (local, no próprio aparelho).
 *
 * Antes, um problema aparecia como "travou" e não havia como saber onde.
 * Aqui guardamos as últimas gerações com módulo, tempo gasto, memória do
 * aparelho e o motivo exato da falha. Nenhum dado do documento é registrado.
 */

const STORAGE_KEY = "mlab:gen-telemetry";
const MAX_EVENTS = 20;

export interface GenerationEvent {
  at: number;
  fn: string;
  preview: boolean;
  ms: number;
  ok: boolean;
  reason?: string;
  deviceMemoryGb?: number;
  heapMb?: number;
}

function deviceInfo() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
  return {
    deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    heapMb: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : undefined,
  };
}

export function recordGeneration(event: Omit<GenerationEvent, "at" | "deviceMemoryGb" | "heapMb">) {
  const full: GenerationEvent = { ...event, ...deviceInfo(), at: Date.now() };
  if (!full.ok) {
    console.warn(
      `[geração] falhou em ${full.fn} após ${full.ms}ms — ${full.reason ?? "motivo desconhecido"}`,
      full,
    );
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: GenerationEvent[] = raw ? JSON.parse(raw) : [];
    list.push(full);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_EVENTS)));
  } catch {
    /* armazenamento cheio: diagnóstico é best-effort */
  }
}

export function readGenerationEvents(): GenerationEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
