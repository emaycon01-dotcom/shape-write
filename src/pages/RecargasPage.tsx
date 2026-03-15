import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Phone, AlertTriangle, Clock, ShieldCheck } from "lucide-react";

type Operadora = "Claro" | "Vivo" | "TIM";

const VALORES = [
  { label: "R$ 20,00 — 0.5 crédito", value: "20", creditos: 0.5 },
  { label: "R$ 40,00 — 1 crédito", value: "40", creditos: 1 },
  { label: "R$ 50,00 — 1.5 créditos", value: "50", creditos: 1.5 },
];

export default function RecargasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [operadora, setOperadora] = useState<Operadora | null>(null);
  const [telefone, setTelefone] = useState("");
  const [valor, setValor] = useState("");

  const handleComprar = () => {
    if (!operadora || !telefone || !valor) return;

    const msg = encodeURIComponent(
      `Olá 👋, vim do painel Bellarus e acabei de solicitar uma recarga.\n\n` +
        `Usuário: ${user?.name ?? "—"}\n` +
        `Email: ${user?.email ?? "—"}\n\n` +
        `Operadora: ${operadora}\n` +
        `Número: ${telefone}\n` +
        `Valor da Recarga: R$${valor}`
    );

    window.open(`https://wa.me/5581960002805?text=${msg}`, "_blank");
  };

  /* ── Tela de seleção de operadora ── */
  if (!operadora) {
    return (
      <div>
        <button
          onClick={() => navigate("/dashboard/documents")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Recargas</h1>
        <p className="text-muted-foreground mb-8">Escolha a operadora para fazer a recarga</p>

        <div className="grid sm:grid-cols-3 gap-4">
          {(["Claro", "Vivo", "TIM"] as Operadora[]).map((op) => (
            <button
              key={op}
              onClick={() => setOperadora(op)}
              className="glass rounded-xl p-6 text-center hover:border-primary/40 transition-colors group"
            >
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

  /* ── Formulário de recarga ── */
  const selectedValor = VALORES.find((v) => v.value === valor);

  return (
    <div className="max-w-lg">
      <button
        onClick={() => setOperadora(null)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        Recarga {operadora}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        Preencha os dados abaixo para solicitar sua recarga
      </p>

      <div className="glass rounded-xl p-6 space-y-5">
        {/* Número */}
        <div className="space-y-2">
          <Label>Número de telefone</Label>
          <Input
            placeholder="Ex: 81999999999"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />
        </div>

        {/* Operadora (pré-selecionada mas editável) */}
        <div className="space-y-2">
          <Label>Operadora</Label>
          <Select value={operadora} onValueChange={(v) => setOperadora(v as Operadora)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Claro">Claro</SelectItem>
              <SelectItem value="Vivo">Vivo</SelectItem>
              <SelectItem value="TIM">TIM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Valor */}
        <div className="space-y-2">
          <Label>Valor da recarga</Label>
          <Select value={valor} onValueChange={setValor}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o valor" />
            </SelectTrigger>
            <SelectContent>
              {VALORES.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedValor && (
            <p className="text-xs text-success">
              Custo: {selectedValor.creditos} crédito{selectedValor.creditos !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Dados do usuário (automáticos) */}
        <div className="rounded-lg bg-secondary/50 p-3 space-y-1 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Usuário:</span> {user?.name ?? "—"}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Email:</span> {user?.email ?? "—"}
          </p>
        </div>

        <Button
          variant="gradient"
          className="w-full"
          disabled={!telefone || !valor}
          onClick={handleComprar}
        >
          COMPRAR RECARGA
        </Button>
      </div>

      {/* Observações */}
      <div className="mt-6 glass rounded-xl p-5 space-y-4 text-sm">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          Observações importantes
        </h3>

        <div className="flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            Recargas da <span className="text-foreground font-medium">Vivo</span> não precisam de
            código de confirmação.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            Recargas da <span className="text-foreground font-medium">Claro</span> e{" "}
            <span className="text-foreground font-medium">TIM</span> precisam de código de
            confirmação. Esse código será enviado via SMS para o número recarregado e você deverá
            enviar no WhatsApp para finalizar a recarga.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            Tempo médio de processamento: <span className="text-foreground font-medium">30 minutos a 1 hora</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
