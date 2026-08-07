/**
 * Histórico curto de formulários (rascunhos de geração).
 *
 * Guarda as ÚLTIMAS 3 gerações de cada módulo por 2 HORAS, no próprio
 * aparelho (localStorage). Serve para o cliente não precisar redigitar o
 * formulário inteiro quando quiser gerar de novo ou corrigir um detalhe.
 *
 * Campos muito pesados (fotos/assinaturas em base64) NÃO são guardados —
 * eles estourariam a cota do navegador. O usuário reenvia só a imagem.
 */

export const FORM_DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas
export const FORM_DRAFT_MAX = 3;

/** Acima disso o valor é considerado um anexo (base64) e não é persistido. */
const MAX_VALUE_CHARS = 8000;

export interface FormDraft {
  id: string;
  savedAt: number;
  label: string;
  data: Record<string, unknown>;
}

function key(docType: string): string {
  return `mlab:formdrafts:${docType}`;
}

/** Rótulo amigável: usa o primeiro campo "nome"/"paciente"/"titular" disponível. */
function draftLabel(data: Record<string, unknown>): string {
  const preferred = [
    "nome", "nomePaciente", "paciente", "nomeAluno", "aluno", "titular",
    "nomeCompleto", "nomeCliente", "nomeFuncionario", "cliente", "razaoSocial",
  ];
  for (const k of preferred) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const v of Object.values(data)) {
    if (typeof v === "string" && v.trim().length > 2 && v.trim().length < 60) return v.trim();
  }
  return "Sem nome";
}

/** Remove anexos pesados e valores não serializáveis. */
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string") {
      if (v.length > MAX_VALUE_CHARS || v.startsWith("data:")) continue;
      out[k] = v;
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else if (Array.isArray(v) || (v && typeof v === "object")) {
      try {
        const json = JSON.stringify(v);
        if (json.length <= MAX_VALUE_CHARS) out[k] = JSON.parse(json);
      } catch { /* ignora valores não serializáveis */ }
    }
  }
  return out;
}

function read(docType: string): FormDraft[] {
  try {
    const raw = localStorage.getItem(key(docType));
    if (!raw) return [];
    const list = JSON.parse(raw) as FormDraft[];
    if (!Array.isArray(list)) return [];
    const cut = Date.now() - FORM_DRAFT_TTL_MS;
    return list.filter((d) => d && typeof d.savedAt === "number" && d.savedAt > cut);
  } catch {
    return [];
  }
}

function write(docType: string, list: FormDraft[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(key(docType));
    else localStorage.setItem(key(docType), JSON.stringify(list));
  } catch { /* cota cheia: rascunho é opcional */ }
}

/** Lista os rascunhos válidos (mais recente primeiro), já expirando os antigos. */
export function listFormDrafts(docType: string): FormDraft[] {
  const list = read(docType).sort((a, b) => b.savedAt - a.savedAt).slice(0, FORM_DRAFT_MAX);
  write(docType, list);
  return list;
}

/** Salva o formulário atual como novo rascunho (chamado ao gerar). */
export function saveFormDraft(docType: string, data: Record<string, unknown>): void {
  try {
    const clean = sanitize(data);
    if (Object.keys(clean).length === 0) return;
    const draft: FormDraft = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: Date.now(),
      label: draftLabel(clean),
      data: clean,
    };
    const list = [draft, ...read(docType)].slice(0, FORM_DRAFT_MAX);
    write(docType, list);
  } catch { /* nunca deve quebrar a geração */ }
}

export function removeFormDraft(docType: string, id: string): FormDraft[] {
  const list = read(docType).filter((d) => d.id !== id);
  write(docType, list);
  return list;
}

export function clearFormDrafts(docType: string): void {
  write(docType, []);
}

/** "há 12 min" / "há 1 h 5 min" */
export function draftAgeLabel(savedAt: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - savedAt) / 60000));
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `há ${h} h ${m} min` : `há ${h} h`;
}

/** Minutos restantes até o rascunho expirar. */
export function draftExpiresInLabel(savedAt: number): string {
  const left = Math.max(0, FORM_DRAFT_TTL_MS - (Date.now() - savedAt));
  const mins = Math.ceil(left / 60000);
  if (mins >= 60) return `expira em ${Math.floor(mins / 60)} h ${mins % 60} min`;
  return `expira em ${mins} min`;
}
