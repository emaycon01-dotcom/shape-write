import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cidadesDaUf, CAPITAIS, UFS_BRASIL } from "@/lib/cidades-brasil";
import { ESTADO_NOMES } from "@/lib/brasoes-estados";

interface Props {
  uf: string;
  cidade: string;
  onChange: (next: { uf: string; cidade: string }) => void;
  /** Rótulos opcionais (padrão: "UF" e "Cidade"). */
  labelUf?: string;
  labelCidade?: string;
  className?: string;
}

const inputCls =
  "h-10 rounded-lg border-border/60 bg-background/60 text-sm focus-visible:ring-primary/40";

/** Seletor de estado + município (todos os 5.570 municípios do IBGE). */
export default function CidadeUfPicker({
  uf,
  cidade,
  onChange,
  labelUf = "UF",
  labelCidade = "Cidade",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const cidades = useMemo(() => cidadesDaUf(uf), [uf]);

  const trocarUf = (nova: string) =>
    onChange({ uf: nova, cidade: CAPITAIS[nova] || cidadesDaUf(nova)[0] || "" });

  return (
    <div className={`grid grid-cols-3 gap-3 ${className || ""}`}>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">{labelUf}</label>
        <Select value={uf} onValueChange={trocarUf}>
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {UFS_BRASIL.map((sigla) => (
              <SelectItem key={sigla} value={sigla}>
                {sigla} — {ESTADO_NOMES[sigla]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-2 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {labelCidade} <span className="opacity-60">({cidades.length})</span>
        </label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className={`${inputCls} w-full justify-between font-normal`}
            >
              <span className="truncate">{cidade || "Selecione a cidade"}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar município..." />
              <CommandList className="max-h-64">
                <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                <CommandGroup>
                  {cidades.map((c) => (
                    <CommandItem
                      key={c}
                      value={c}
                      onSelect={() => {
                        onChange({ uf, cidade: c });
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${c === cidade ? "opacity-100" : "opacity-0"}`}
                      />
                      {c}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
