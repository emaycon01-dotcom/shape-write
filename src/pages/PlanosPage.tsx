import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Rocket, Star, Gem, Check, Loader2, QrCode, Copy, CheckCircle, XCircle, Crown,
} from "lucide-react";

interface Plano {
  nome: "Dealer" | "Master" | "Diamond";
  preco: number;
  desconto: string;
  icon: typeof Rocket;
  gradient: string;
  beneficios: string[];
}

const PLANOS: Plano[] = [
  {
    nome: "Dealer",
    preco: 150,
    desconto: "25% de desconto",
    icon: Rocket,
    gradient: "gradient-dealer",
    beneficios: [
      "25% de desconto em todo o sistema",
      "Todos os módulos liberados",
      "Suporte prioritário no WhatsApp",
    ],
  },
  {
    nome: "Master",
    preco: 450,
    desconto: "50% de desconto",
    icon: Star,
    gradient: "gradient-master",
    beneficios: [
      "50% de desconto em todo o sistema",
      "Todos os módulos liberados",
      "Fila de geração prioritária",
    ],
  },
  {
    nome: "Diamond",
    preco: 999.99,
    desconto: "100% grátis",
    icon: Gem,
    gradient: "gradient-diamond",
    beneficios: [
      "100% de desconto — gerações ilimitadas",
      "Todos os módulos liberados",
      "Atendimento VIP e acesso antecipado",
    ],
  },
];

function formatBRL(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function PlanosPage() {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmPlano, setConfirmPlano] = useState<Plano | null>(null);

  // Abre direto o aviso quando vier do menu lateral (?plano=dealer)
  useEffect(() => {
    const alvo = searchParams.get("plano");
    if (!alvo) return;
    const encontrado = PLANOS.find((p) => p.nome.toLowerCase() === alvo.toLowerCase());
    if (encontrado) setConfirmPlano(encontrado);
    searchParams.delete("plano");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const [generating, setGenerating] = useState(false);

  const [showQr, setShowQr] = useState(false);
  const [pixCode, setPixCode] = useState("");
  const [txId, setTxId] = useState("");
  const [qrAmount, setQrAmount] = useState(0);
  const [qrPlano, setQrPlano] = useState("");
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);

  const gerarPix = useCallback(async (plano: Plano) => {
    if (!user) return;
    setGenerating(true);

    const { data, error } = await supabase.functions.invoke("create-pix-charge", {
      body: { type: "plano", amount: plano.preco, plan_name: plano.nome },
    });

    setGenerating(false);

    if (error || !data?.pix_code) {
      toast({
        title: "Erro ao gerar PIX",
        description: (data as { error?: string } | null)?.error || error?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }

    setTxId(data.transaction_id as string);
    setPixCode(data.pix_code as string);
    setQrAmount(plano.preco);
    setQrPlano(plano.nome);
    setPaid(false);
    setShowQr(true);

    toast({ title: "PIX gerado!", description: `Plano ${plano.nome} — ${formatBRL(plano.preco)}` });
  }, [user, toast]);

  // Polling do pagamento
  useEffect(() => {
    if (!showQr || !txId || paid) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke("check-pix-payment", {
        body: { transaction_id: txId },
      });
      if (data?.status === "pago") {
        setPaid(true);
        clearInterval(interval);
        await refreshUser?.();
        toast({ title: "Plano ativado!", description: `Seu plano ${qrPlano} já está valendo.` });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [showQr, txId, paid, qrPlano, refreshUser, toast]);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    const { data } = await supabase.functions.invoke("check-pix-payment", {
      body: { transaction_id: txId },
    });
    setChecking(false);
    if (data?.status === "pago") {
      setPaid(true);
      await refreshUser?.();
      toast({ title: "Plano ativado!", description: `Seu plano ${qrPlano} já está valendo.` });
      return;
    }
    toast({
      title: "Pagamento ainda não identificado",
      description: "Assim que o PIX for compensado o plano é ativado automaticamente.",
      variant: "destructive",
    });
  }, [txId, qrPlano, refreshUser, toast]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pixCode);
      toast({ title: "Código PIX copiado!", description: "Cole no app do seu banco para pagar." });
    } catch {
      toast({ title: "Não foi possível copiar", description: "Copie o código manualmente.", variant: "destructive" });
    }
  }, [pixCode, toast]);

  if (showQr) {
    return (
      <div className="max-w-md mx-auto space-y-6 w-full">
        <div className="text-center">
          <QrCode className="w-8 h-8 text-primary mx-auto mb-2" />
          <h1 className="font-display text-2xl font-bold text-foreground">Plano {qrPlano}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {paid ? "Pagamento confirmado com sucesso" : "Escaneie o QR Code ou copie o código PIX"}
          </p>
        </div>

        <div className="glass rounded-xl p-6 flex flex-col items-center gap-4">
          {paid ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="w-14 h-14 text-accent" />
              <p className="font-semibold text-foreground">Plano ativado!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4">
              <QRCodeSVG value={pixCode} size={200} />
            </div>
          )}
          <p className="text-2xl font-bold text-foreground">{formatBRL(qrAmount)}</p>
          {!paid && (
            <Button variant="outline" className="w-full h-11" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" /> Copiar código PIX
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          {!paid && (
            <Button variant="gradient" className="flex-1 h-12 font-semibold" onClick={handleCheck} disabled={checking}>
              {checking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</> : <><CheckCircle className="w-4 h-4 mr-2" /> Já Paguei</>}
            </Button>
          )}
          <Button variant="outline" className="flex-1 h-12 font-semibold" onClick={() => setShowQr(false)}>
            {paid ? "Voltar" : <><XCircle className="w-4 h-4 mr-2" /> Fechar</>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-5 h-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Planos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Escolha um plano e pague via PIX. Plano atual:{" "}
          <span className="text-foreground font-semibold uppercase">{user?.plano || "free"}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANOS.map((p) => (
          <div
            key={p.nome}
            className="relative overflow-hidden glass rounded-2xl border border-border/60 p-5 flex flex-col"
          >
            <div className={`absolute inset-x-0 top-0 h-[3px] ${p.gradient}`} />
            <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full ${p.gradient} opacity-20 blur-2xl`} />

            <div className="relative space-y-3 flex-1">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.gradient}`}>
                <p.icon className="h-5 w-5 text-primary-foreground" />
              </span>
              <div>
                <p className="text-lg font-bold uppercase tracking-wide text-foreground">{p.nome}</p>
                <p className="text-xs text-accent font-semibold">{p.desconto}</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatBRL(p.preco)}</p>
              <ul className="space-y-1.5 pt-1">
                {p.beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              variant="gradient"
              className="relative mt-5 h-11 w-full font-semibold"
              onClick={() => setConfirmPlano(p)}
              disabled={generating}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assinar"}
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirmPlano} onOpenChange={(open) => !open && setConfirmPlano(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Certeza que deseja continuar?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  Você está assinando o plano <strong className="text-foreground">{confirmPlano?.nome}</strong> por{" "}
                  <strong className="text-foreground">{confirmPlano ? formatBRL(confirmPlano.preco) : ""}</strong>.
                </p>
                <p>{confirmPlano?.desconto} em todas as gerações do sistema.</p>
                <ul className="list-disc pl-5 space-y-1">
                  {confirmPlano?.beneficios.map((b) => <li key={b}>{b}</li>)}
                </ul>
                <p className="text-xs">Ao confirmar, um PIX será gerado imediatamente.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const plano = confirmPlano;
                setConfirmPlano(null);
                if (plano) void gerarPix(plano);
              }}
            >
              Confirmar e gerar PIX
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>
    </div>
  );
}
