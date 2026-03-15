import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tag, Sparkles, Gem, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

interface Pacote {
  credits: number;
  pricePerUnit: number;
  total: number;
  discount?: number;
  premium?: boolean;
}

const populares: Pacote[] = [
  { credits: 5, pricePerUnit: 14.0, total: 70.0 },
  { credits: 10, pricePerUnit: 14.0, total: 140.0 },
  { credits: 25, pricePerUnit: 13.5, total: 337.5, discount: 4 },
  { credits: 50, pricePerUnit: 13.0, total: 650.0, discount: 7 },
];

const intermediarios: Pacote[] = [
  { credits: 75, pricePerUnit: 12.5, total: 937.5, discount: 11 },
  { credits: 100, pricePerUnit: 12.0, total: 1200.0, discount: 14 },
  { credits: 150, pricePerUnit: 11.5, total: 1725.0, discount: 18 },
  { credits: 200, pricePerUnit: 11.0, total: 2200.0, discount: 21 },
];

const volumes: Pacote[] = [
  { credits: 250, pricePerUnit: 10.5, total: 2625.0, discount: 25 },
  { credits: 300, pricePerUnit: 10.2, total: 3060.0, discount: 27 },
  { credits: 400, pricePerUnit: 9.8, total: 3920.0, discount: 30 },
  { credits: 500, pricePerUnit: 9.65, total: 4825.0, discount: 31 },
  { credits: 1000, pricePerUnit: 9.0, total: 9000.0, discount: 36, premium: true },
];

function formatBRL(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function PacoteCard({ p, selected, onSelect }: { p: Pacote; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`relative glass rounded-xl p-5 text-left transition-all border ${
        selected ? "border-primary shadow-glow" : "border-border/50 hover:border-primary/30"
      } ${p.premium ? "border-yellow-500/50" : ""}`}
    >
      {p.discount && (
        <span className="absolute -top-2 -right-2 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
          -{p.discount}%
        </span>
      )}
      {p.premium && (
        <span className="absolute -top-2 right-8 bg-yellow-500 text-background text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Gem className="w-3 h-3" /> PREMIUM
        </span>
      )}
      <p className="text-2xl font-bold text-foreground">{p.credits}</p>
      <p className="text-xs text-muted-foreground">créditos</p>
      <span className="inline-block mt-2 text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded">
        R$ {p.pricePerUnit.toFixed(2)}/un
      </span>
      <p className="text-sm font-bold text-success mt-2">{formatBRL(p.total)}</p>
    </button>
  );
}

export default function RecarregarPage() {
  const { toast } = useToast();
  const [selectedPacote, setSelectedPacote] = useState<Pacote | null>(null);
  const [sliderValue, setSliderValue] = useState([5]);

  const sliderPrice = sliderValue[0] * 14;

  const handleBuy = () => {
    const credits = selectedPacote?.credits ?? sliderValue[0];
    toast({
      title: "Recarga solicitada",
      description: `Solicitação de ${credits} créditos enviada com sucesso.`,
    });
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-5 h-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Pacotes de Créditos</h1>
        </div>
        <p className="text-sm text-muted-foreground">Selecione um pacote para recarregar</p>
      </div>

      {/* Populares */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-yellow-400" />
          <h2 className="text-sm font-semibold text-foreground tracking-wider">Pacotes Populares</h2>
          <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">Mais vendidos</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {populares.map((p) => (
            <PacoteCard key={p.credits} p={p} selected={selectedPacote?.credits === p.credits} onSelect={() => setSelectedPacote(p)} />
          ))}
        </div>
      </div>

      {/* Intermediários */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-success" />
          <h2 className="text-sm font-semibold text-foreground tracking-wider">Pacotes Intermediários</h2>
          <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full">Melhor custo-benefício</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {intermediarios.map((p) => (
            <PacoteCard key={p.credits} p={p} selected={selectedPacote?.credits === p.credits} onSelect={() => setSelectedPacote(p)} />
          ))}
        </div>
      </div>

      {/* Volumes */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CreditCardIcon className="w-4 h-4 text-yellow-400" />
          <h2 className="text-sm font-semibold text-foreground tracking-wider">Grandes Volumes</h2>
          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Máximo desconto</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {volumes.map((p) => (
            <PacoteCard key={p.credits} p={p} selected={selectedPacote?.credits === p.credits} onSelect={() => setSelectedPacote(p)} />
          ))}
        </div>
      </div>

      {/* Slider */}
      <div className="glass rounded-xl p-6">
        <p className="text-sm text-muted-foreground mb-4">Ou arraste para selecionar:</p>
        <Slider
          value={sliderValue}
          onValueChange={(v) => {
            setSliderValue(v);
            setSelectedPacote(null);
          }}
          min={1}
          max={100}
          step={1}
          className="mb-4"
        />
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground font-semibold">{sliderValue[0]} créditos</span>
          <span className="text-sm text-success font-bold">{formatBRL(sliderPrice)}</span>
        </div>
      </div>

      <Button variant="gradient" className="w-full" onClick={handleBuy}>
        {selectedPacote
          ? `Comprar ${selectedPacote.credits} créditos por ${formatBRL(selectedPacote.total)}`
          : `Comprar ${sliderValue[0]} créditos por ${formatBRL(sliderPrice)}`}
      </Button>
    </div>
  );
}

function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
