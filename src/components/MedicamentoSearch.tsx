import { useMemo, useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Pill, ChevronLeft, Check, Star } from "lucide-react";
import {
  MEDICAMENTOS,
  FORMAS,
  APRESENTACOES,
  APRESENTACAO_PADRAO,
  EMBALAGENS,
  QUANTIDADES,
  VIAS,
  UNIDADES_DOSE,
  INTERVALOS,
  DURACOES,
  buscarMedicamentos,
  montarNomeMedicamento,
  montarPosologia,
  type MedBase,
} from "@/lib/medicamentos";

export interface MedicamentoEscolhido {
  nome: string;
  posologia: string;
  quantidade: string;
  farmaciaPopular: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (m: MedicamentoEscolhido) => void;
}

const chip =
  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap";
const chipOn = "border-primary bg-primary/15 text-primary";
const chipOff = "border-border bg-secondary/60 text-muted-foreground hover:border-primary/40";

export default function MedicamentoSearch({ open, onOpenChange, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<MedBase | null>(null);

  const [dose, setDose] = useState("");
  const [forma, setForma] = useState("");
  const [apres, setApres] = useState("");
  const [qtdNum, setQtdNum] = useState("1");
  const [embalagem, setEmbalagem] = useState("caixa");
  const [unidade, setUnidade] = useState("1 comprimido");
  const [via, setVia] = useState("via oral");
  const [intervalo, setIntervalo] = useState("de 8/8h");
  const [duracao, setDuracao] = useState("por 5 dias");
  const [fp, setFp] = useState(false);
  const [posologiaManual, setPosologiaManual] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSel(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const resultados = useMemo(() => buscarMedicamentos(query, 80), [query]);

  const abrirMed = (m: MedBase) => {
    setSel(m);
    setDose(m.d[0] ?? "");
    const f = FORMAS[m.f[0]] ?? m.f[0];
    setForma(f);
    const lista = APRESENTACOES[f] ?? APRESENTACAO_PADRAO;
    setApres(lista[Math.min(2, lista.length - 1)]);
    setVia(VIAS[f] ?? "via oral");
    setUnidade(unidadePadrao(f));
    setQtdNum("1");
    setEmbalagem("caixa");
    setFp(Boolean(m.p));
    setPosologiaManual("");
  };

  const trocarForma = (f: string) => {
    setForma(f);
    const lista = APRESENTACOES[f] ?? APRESENTACAO_PADRAO;
    setApres(lista[Math.min(2, lista.length - 1)]);
    setVia(VIAS[f] ?? "via oral");
    setUnidade(unidadePadrao(f));
  };

  const nomeFinal = sel ? montarNomeMedicamento({ base: sel, dose, forma, apresentacao: apres }) : "";
  const posologiaFinal = posologiaManual.trim() || montarPosologia(unidade, via, intervalo, duracao);
  const quantidadeFinal = `${qtdNum} ${embalagem}`;

  const confirmar = () => {
    if (!sel) return;
    onSelect({ nome: nomeFinal, posologia: posologiaFinal, quantidade: quantidadeFinal, farmaciaPopular: fp });
    onOpenChange(false);
  };

  const apresLista = APRESENTACOES[forma] ?? APRESENTACAO_PADRAO;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            {sel ? (
              <>
                <button
                  type="button"
                  onClick={() => setSel(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Voltar para a busca"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <Pill className="h-4 w-4 text-primary" /> {sel.n}
              </>
            ) : (
              <>
                <Search className="h-4 w-4 text-primary" /> Pesquisar medicamento
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {!sel ? (
          <>
            <div className="border-b border-border/60 px-5 py-3">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite o nome, a dose ou a forma (ex: dipirona, 600 mg, xarope)"
                className="bg-secondary"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {MEDICAMENTOS.length} medicamentos na base · {resultados.length} resultado(s)
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {resultados.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum medicamento encontrado. Você pode digitar manualmente no formulário.
                </p>
              )}
              {resultados.map((m) => (
                <button
                  key={m.n}
                  type="button"
                  onClick={() => abrirMed(m)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-secondary/70"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {m.n}
                    {m.p === 1 && (
                      <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        <Star className="h-2.5 w-2.5" /> Farmácia Popular
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.d.slice(0, 5).join(" · ")}
                    {m.d.length > 5 ? " · ..." : ""}
                  </span>
                  <span className="text-[11px] text-muted-foreground/80">
                    {m.f.map((f) => FORMAS[f] ?? f).join(", ")}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <Bloco titulo="Dosagem">
                <div className="flex flex-wrap gap-2">
                  {sel.d.map((d) => (
                    <button key={d} type="button" onClick={() => setDose(d)} className={`${chip} ${dose === d ? chipOn : chipOff}`}>
                      {d}
                    </button>
                  ))}
                </div>
                <Input
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="Outra dosagem"
                  className="mt-2 h-9 bg-secondary text-sm"
                />
              </Bloco>

              <Bloco titulo="Forma farmacêutica">
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set([...sel.f.map((f) => FORMAS[f] ?? f), ...Object.values(FORMAS)])).map((f) => (
                    <button key={f} type="button" onClick={() => trocarForma(f)} className={`${chip} ${forma === f ? chipOn : chipOff}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </Bloco>

              <Bloco titulo="Apresentação (conteúdo da embalagem)">
                <div className="flex flex-wrap gap-2">
                  {apresLista.map((a) => (
                    <button key={a} type="button" onClick={() => setApres(a)} className={`${chip} ${apres === a ? chipOn : chipOff}`}>
                      {a}
                    </button>
                  ))}
                </div>
                <Input
                  value={apres}
                  onChange={(e) => setApres(e.target.value)}
                  placeholder="Ex: 30un, 100 mL"
                  className="mt-2 h-9 bg-secondary text-sm"
                />
              </Bloco>

              <Bloco titulo="Quantidade a dispensar">
                <div className="grid grid-cols-2 gap-3">
                  <select value={qtdNum} onChange={(e) => setQtdNum(e.target.value)} className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
                    {QUANTIDADES.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <select value={embalagem} onChange={(e) => setEmbalagem(e.target.value)} className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
                    {EMBALAGENS.map((e2) => (
                      <option key={e2} value={e2}>{e2}</option>
                    ))}
                  </select>
                </div>
              </Bloco>

              <Bloco titulo="Posologia">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
                    {UNIDADES_DOSE.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <select value={via} onChange={(e) => setVia(e.target.value)} className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
                    {Array.from(new Set(Object.values(VIAS))).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <select value={intervalo} onChange={(e) => setIntervalo(e.target.value)} className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
                    {INTERVALOS.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                  <select value={duracao} onChange={(e) => setDuracao(e.target.value)} className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
                    {DURACOES.map((d) => (
                      <option key={d || "sem"} value={d}>{d || "sem duração definida"}</option>
                    ))}
                  </select>
                </div>
                <Input
                  value={posologiaManual}
                  onChange={(e) => setPosologiaManual(e.target.value)}
                  placeholder="Posologia personalizada (opcional — substitui a montada acima)"
                  className="mt-2 h-9 bg-secondary text-sm"
                />
              </Bloco>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={fp} onChange={(e) => setFp(e.target.checked)} className="h-4 w-4 accent-primary" />
                Marcar selo <span className="font-semibold text-destructive">Farmácia Popular</span>
              </label>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pré-visualização</p>
                <p className="mt-1 text-sm font-bold text-foreground">{nomeFinal}</p>
                <p className="text-sm text-muted-foreground">{posologiaFinal}</p>
                <p className="text-xs text-muted-foreground">Quantidade: {quantidadeFinal}</p>
              </div>
            </div>

            <div className="border-t border-border/60 px-5 py-3">
              <Button type="button" onClick={confirmar} variant="gradient" className="h-11 w-full gap-2">
                <Check className="h-4 w-4" /> Usar este medicamento
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{titulo}</p>
      {children}
    </div>
  );
}

function unidadePadrao(forma: string): string {
  if (/gotas/i.test(forma)) return "20 gotas";
  if (/Xarope|Suspensão|Solução oral/i.test(forma)) return "10 mL";
  if (/Cápsula/i.test(forma)) return "1 cápsula";
  if (/Spray|Aerossol/i.test(forma)) return "1 jato";
  if (/Colírio/i.test(forma)) return "1 gota";
  if (/Pomada|Creme|Gel|Loção|Shampoo/i.test(forma)) return "1 aplicação";
  if (/Sachê/i.test(forma)) return "1 sachê";
  if (/injetável/i.test(forma)) return "1 ampola";
  if (/Supositório/i.test(forma)) return "1 supositório";
  if (/Adesivo/i.test(forma)) return "1 adesivo";
  return "1 comprimido";
}
