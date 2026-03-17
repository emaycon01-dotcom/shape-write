import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Phone, AlertTriangle, Clock, ShieldCheck, ShoppingCart, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Operadora = "Claro" | "Vivo" | "TIM";

const VALORES = [
  { label: "R$ 20,00 — 0.5 crédito", value: "20", creditos: 0.5 },
  { label: "R$ 40,00 — 1 crédito", value: "40", creditos: 1 },
  { label: "R$ 50,00 — 1.5 créditos", value: "50", creditos: 1.5 },
];

export default function RecargasPage() {
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { toast } = useToast();
  const [operadora, setOperadora] = useState<Operadora | null>(null);
  const [telefone, setTelefone] = useState("");
  const [valor, setValor] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedValor = VALORES.find((v) => v.value === valor);
  const cost = selectedValor?.creditos ?? 0;

  const handleAdquirir = () => {
    if (!operadora || !telefone || !valor) return;
    if (!user || user.credits < cost) {
      toast({ title: "Saldo insuficiente", description: `Você precisa de ${cost} créditos. Saldo atual: ${user?.credits ?? 0}`, variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmPurchase = () => {
    setConfirmOpen(false);
    setLoading(true);

    for (let i = 0; i < Math.ceil(cost); i++) {
      deductCredit();
    }

    const msg = encodeURIComponent(
      `Olá 👋, vim do painel Bellarus e adquiri uma recarga.\n\n` +
      `Usuário: ${user?.name ?? "—"}\nEmail: ${user?.email ?? "—"}\n\n` +
      `Operadora: ${operadora}\nNúmero: ${telefone}\nValor: R$${valor}`
    );

    toast({ title: "Compra realizada!", description: `${cost} crédito(s) descontado(s). Redirecionando...` });

    setTimeout(() => {
      setLoading(false);
      window.open(`https://wa.me/5581960002805?text=${msg}`, "_blank");
    }, 1000);
  };

  if (!operadora) {
    return (
      <div>
        <button onClick={() => navigate("/dashboard/documents")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Recargas</h1>
        <p className="text-muted-foreground mb-8">Escolha a operadora para fazer a recarga</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {(["Claro", "Vivo", "TIM"] as Operadora[]).map((op) => (
            <button key={op} onClick={() => setOperadora(op)} className="glass rounded-xl p-6 text-center hover:border-primary/40 transition-colors group">
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground">{op}</h3>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <button onClick={() => setOperadora(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Recarga {operadora}</h1>
      <p className="text-muted-foreground text-sm mb-6">Preencha os dados abaixo para solicitar sua recarga</p>

      <div className="glass rounded-xl p-6 space-y-5">
        <div className="space-y-2">
          <Label>Número de telefone</Label>
          <Input placeholder="Ex: 81999999999" value={telefone} onChange={(e) => setTelefone(e.target.value.replace(/\D/g, "").slice(0, 11))} />
        </div>
        <div className="space-y-2">
          <Label>Operadora</Label>
          <Select value={operadora} onValueChange={(v) => setOperadora(v as Operadora)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Claro">Claro</SelectItem>
              <SelectItem value="Vivo">Vivo</SelectItem>
              <SelectItem value="TIM">TIM</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valor da recarga</Label>
          <Select value={valor} onValueChange={setValor}>
            <SelectTrigger><SelectValue placeholder="Selecione o valor" /></SelectTrigger>
            <SelectContent>
              {VALORES.map((v) => (<SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>))}
            </SelectContent>
          </Select>
          {selectedValor && <p className="text-xs text-success">Custo: {selectedValor.creditos} crédito{selectedValor.creditos !== 1 ? "s" : ""}</p>}
        </div>

        <div className="rounded-lg bg-secondary/50 p-3 space-y-1 text-sm">
          <p className="text-muted-foreground"><span className="font-medium text-foreground">Usuário:</span> {user?.name ?? "—"}</p>
          <p className="text-muted-foreground"><span className="font-medium text-foreground">Email:</span> {user?.email ?? "—"}</p>
          <p className="text-muted-foreground"><span className="font-medium text-foreground">Saldo:</span> {user?.credits ?? 0} créditos</p>
        </div>

        <Button variant="gradient" className="w-full font-semibold" disabled={!telefone || !valor || loading} onClick={handleAdquirir}>
          {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processando...</> : <><ShoppingCart className="w-5 h-5 mr-2" /> ADQUIRIR</>}
        </Button>
      </div>

      <div className="mt-6 glass rounded-xl p-5 space-y-4 text-sm">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" /> Observações importantes
        </h3>
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
          <p className="text-muted-foreground">Recargas da <span className="text-foreground font-medium">Vivo</span> não precisam de código de confirmação.</p>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-muted-foreground">Recargas da <span className="text-foreground font-medium">Claro</span> e <span className="text-foreground font-medium">TIM</span> precisam de código de confirmação via SMS.</p>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-muted-foreground">Tempo médio: <span className="text-foreground font-medium">30 min a 1 hora</span>.</p>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar compra</AlertDialogTitle>
            <AlertDialogDescription>
              Serão descontados <span className="font-semibold text-foreground">{cost} crédito(s)</span> do seu saldo.
              <br />Saldo atual: <span className="font-semibold">{user?.credits ?? 0}</span> → Saldo após: <span className="font-semibold">{((user?.credits ?? 0) - cost).toFixed(1)}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPurchase}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
