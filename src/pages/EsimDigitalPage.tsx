import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Smartphone, Signal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const ESTADOS = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

type Operadora = "vivo" | "claro" | null;
type TipoDDD = "aleatorio" | "especifico";

export default function EsimDigitalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [operadora, setOperadora] = useState<Operadora>(null);
  const [termosAceitos, setTermosAceitos] = useState<"vivo" | "claro" | null>(null);
  const [tipoDDD, setTipoDDD] = useState<TipoDDD>("aleatorio");
  const [estado, setEstado] = useState("");

  const handleComprar = () => {
    const op = operadora === "vivo" ? "Vivo" : "Claro";
    const tipo = operadora === "claro" ? "Aleatório" : tipoDDD === "aleatorio" ? "Aleatório" : "Específico";
    const estadoLabel =
      tipoDDD === "especifico" && operadora === "vivo"
        ? ESTADOS.find((e) => e.value === estado)?.label || "Não selecionado"
        : "N/A";

    const msg = encodeURIComponent(
      `Olá, vim do painel Bellarus e fiz uma compra de E-SIM.\n\n` +
        `Meu pacote escolhido foi:\n` +
        `Operadora: ${op}\n` +
        `Tipo de DDD: ${tipo}\n` +
        `Estado selecionado: ${estadoLabel}\n\n` +
        `Usuário: ${user?.name || "—"}\n` +
        `Email: ${user?.email || "—"}`
    );

    window.open(`https://wa.me/5581992120805?text=${msg}`, "_blank");
  };

  // Seleção de operadora
  if (!operadora) {
    return (
      <div>
        <button onClick={() => navigate("/dashboard/documents")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">E-SIM Digital</h1>
        <p className="text-muted-foreground mb-8">Escolha a operadora desejada</p>

        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <button
            onClick={() => setOperadora("vivo")}
            className="glass rounded-xl p-8 text-left hover:border-primary/40 transition-all group"
          >
            <div className="w-14 h-14 rounded-lg bg-[hsl(280,80%,50%)]/10 flex items-center justify-center mb-4 group-hover:bg-[hsl(280,80%,50%)]/20 transition-colors">
              <Smartphone className="w-7 h-7 text-[hsl(280,80%,50%)]" />
            </div>
            <h3 className="font-display font-semibold text-foreground text-lg mb-1">E-SIM Vivo</h3>
            <p className="text-sm text-muted-foreground">DDD Aleatório ou Específico</p>
            <p className="text-xs text-muted-foreground mt-2">A partir de <span className="text-primary font-semibold">1.3 créditos</span></p>
          </button>

          <button
            onClick={() => setOperadora("claro")}
            className="glass rounded-xl p-8 text-left hover:border-primary/40 transition-all group"
          >
            <div className="w-14 h-14 rounded-lg bg-destructive/10 flex items-center justify-center mb-4 group-hover:bg-destructive/20 transition-colors">
              <Signal className="w-7 h-7 text-destructive" />
            </div>
            <h3 className="font-display font-semibold text-foreground text-lg mb-1">E-SIM Claro</h3>
            <p className="text-sm text-muted-foreground">DDD Aleatório · 110GB</p>
            <p className="text-xs text-muted-foreground mt-2">Preço: <span className="text-primary font-semibold">2.5 créditos</span></p>
          </button>
        </div>
      </div>
    );
  }

  // Claro — pacote único
  if (operadora === "claro") {
    return (
      <div>
        <button onClick={() => setOperadora(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">E-SIM Claro</h1>
        <p className="text-muted-foreground mb-8">Pacote disponível</p>

        <div className="glass rounded-xl p-6 max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Signal className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">ESIM CLARO – DDD ALEATÓRIO</h3>
              <p className="text-sm text-muted-foreground">Internet: 110GB</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Preço</span>
            <span className="text-lg font-bold text-primary">2.5 créditos</span>
          </div>
          <Button onClick={handleComprar} className="w-full" size="lg">
            COMPRAR
          </Button>
        </div>
      </div>
    );
  }

  // Vivo — seleção de tipo de DDD
  return (
    <div>
      <button onClick={() => setOperadora(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">E-SIM Vivo</h1>
      <p className="text-muted-foreground mb-8">Selecione o tipo de DDD</p>

      <RadioGroup
        value={tipoDDD}
        onValueChange={(v) => { setTipoDDD(v as TipoDDD); setEstado(""); }}
        className="grid sm:grid-cols-2 gap-4 max-w-2xl mb-6"
      >
        {/* DDD Aleatório */}
        <Label
          htmlFor="aleatorio"
          className={`glass rounded-xl p-6 cursor-pointer transition-all ${tipoDDD === "aleatorio" ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="aleatorio" id="aleatorio" className="mt-1" />
            <div>
              <h3 className="font-display font-semibold text-foreground">DDD ALEATÓRIO</h3>
              <p className="text-sm text-muted-foreground mt-1">DDD gerado automaticamente</p>
              <p className="text-primary font-bold mt-3">1.3 créditos</p>
            </div>
          </div>
        </Label>

        {/* DDD Específico */}
        <Label
          htmlFor="especifico"
          className={`glass rounded-xl p-6 cursor-pointer transition-all ${tipoDDD === "especifico" ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="especifico" id="especifico" className="mt-1" />
            <div>
              <h3 className="font-display font-semibold text-foreground">DDD ESPECÍFICO</h3>
              <p className="text-sm text-muted-foreground mt-1">Escolha o estado desejado</p>
              <p className="text-primary font-bold mt-3">1.5 créditos</p>
            </div>
          </div>
        </Label>
      </RadioGroup>

      {tipoDDD === "especifico" && (
        <div className="max-w-md mb-6">
          <Label className="text-sm text-muted-foreground mb-2 block">Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o estado" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        onClick={handleComprar}
        className="w-full max-w-md"
        size="lg"
        disabled={tipoDDD === "especifico" && !estado}
      >
        COMPRAR
      </Button>
    </div>
  );
}
