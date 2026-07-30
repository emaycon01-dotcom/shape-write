import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDeviceSecurity } from "@/contexts/DeviceSecurityContext";
import { supabase } from "@/integrations/supabase/client";
import { Tag, Sparkles, Gem, Star, AlertTriangle, Clock, QrCode, CheckCircle, XCircle, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
        <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
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
      <p className="text-sm font-bold text-accent mt-2">{formatBRL(p.total)}</p>
    </button>
  );
}

const PIX_COOLDOWN_MS = 60_000; // 1 minute
const MAX_WARNINGS = 4;

export default function RecarregarPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { reportViolation } = useDeviceSecurity();
  const [selectedPacote, setSelectedPacote] = useState<Pacote | null>(null);
  const [sliderValue, setSliderValue] = useState([5]);

  // PIX QR state
  const [showQr, setShowQr] = useState(false);
  const [qrId, setQrId] = useState("");
  const [qrAmount, setQrAmount] = useState(0);
  const [pixCode, setPixCode] = useState("");
  const [txId, setTxId] = useState("");
  const [paid, setPaid] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  // Cooldown state
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Warnings state
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [loadingWarnings, setLoadingWarnings] = useState(true);

  const sliderPrice = sliderValue[0] * 20;

  // Load warning count — only count warnings from the last 7 days
  useEffect(() => {
    if (!user) return;
    const loadWarnings = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("pix_warnings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "warning")
        .gte("resolved_at", sevenDaysAgo);
      setWarningCount(count ?? 0);
      setLoadingWarnings(false);
    };
    loadWarnings();
  }, [user]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownLeft(0);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  // Check stored cooldown
  useEffect(() => {
    const stored = localStorage.getItem("pix_cooldown_until");
    if (stored) {
      const ts = parseInt(stored, 10);
      if (ts > Date.now()) {
        setCooldownUntil(ts);
        setCooldownLeft(Math.ceil((ts - Date.now()) / 1000));
      }
    }
  }, []);

  const generateQrCode = useCallback(async () => {
    if (!user) return;

    // Check if banned (4+ warnings)
    if (warningCount >= MAX_WARNINGS) {
      toast({ title: "Conta suspensa", description: "Você atingiu o limite de advertências. Acesso revogado.", variant: "destructive" });
      reportViolation(user.id, user.email, "Tentou gerar PIX com 4+ advertências");
      return;
    }

    // Check cooldown
    if (cooldownUntil > Date.now()) {
      toast({ title: "Aguarde", description: `Você pode gerar outro QR Code em ${cooldownLeft}s.`, variant: "destructive" });
      return;
    }

    const credits = selectedPacote?.credits ?? sliderValue[0];
    const amount = selectedPacote?.total ?? sliderPrice;

    setGenerating(true);

    // Cria a cobrança real na Elite Pay
    const { data, error } = await supabase.functions.invoke("create-pix-charge", {
      body: { type: "credito", amount, credits_amount: credits },
    });

    if (error || !data?.pix_code) {
      setGenerating(false);
      toast({
        title: "Erro ao gerar PIX",
        description: (data as any)?.error || error?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }

    const newQrId = data.transaction_id as string;

    // Insert pending warning record
    await supabase.from("pix_warnings").insert({
      user_id: user.id,
      qr_code_id: newQrId,
      amount,
      status: "pending",
    });

    // Set cooldown
    const until = Date.now() + PIX_COOLDOWN_MS;
    setCooldownUntil(until);
    setCooldownLeft(60);
    localStorage.setItem("pix_cooldown_until", String(until));

    setQrId(newQrId);
    setTxId(newQrId);
    setPixCode(data.pix_code as string);
    setPaid(false);
    setQrAmount(amount);
    setShowQr(true);
    setGenerating(false);

    toast({ title: "QR Code gerado!", description: `Valor: ${formatBRL(amount)}. Pague em até 15 minutos.` });
  }, [user, selectedPacote, sliderValue, sliderPrice, cooldownUntil, cooldownLeft, warningCount, reportViolation, toast]);

  // Polling do status do pagamento
  useEffect(() => {
    if (!showQr || !txId || paid) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("financial_transactions")
        .select("status")
        .eq("id", txId)
        .maybeSingle();
      if (data?.status === "pago") {
        setPaid(true);
        clearInterval(interval);
        toast({ title: "Pagamento confirmado!", description: "Seus créditos já foram adicionados." });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [showQr, txId, paid, toast]);

  const handleConfirmPayment = useCallback(async () => {
    if (!user || !qrId) return;
    setConfirmingPayment(true);

    // Mark as paid
    await supabase
      .from("pix_warnings")
      .update({ status: "paid", resolved_at: new Date().toISOString() })
      .eq("qr_code_id", qrId)
      .eq("user_id", user.id);

    setShowQr(false);
    setConfirmingPayment(false);

    // Send WhatsApp message for admin to confirm
    const credits = selectedPacote?.credits ?? sliderValue[0];
    const msg = encodeURIComponent(
      `Olá 👋, vim do painel Bellarus e realizei um pagamento PIX.\n\n` +
      `Usuário: ${user.name}\nEmail: ${user.email}\n\n` +
      `Créditos: ${credits}\nValor: ${formatBRL(qrAmount)}\nID: ${qrId}`
    );
    const url = `https://wa.me/5581960002805?text=${msg}`;
    window.open(url, "_blank") || (window.location.href = url);

    toast({ title: "Pagamento registrado!", description: "Seus créditos serão adicionados após confirmação." });
  }, [user, qrId, qrAmount, selectedPacote, sliderValue, toast]);

  const handleCancelQr = useCallback(async () => {
    if (!user || !qrId) return;

    // Mark as warning (unpaid)
    await supabase
      .from("pix_warnings")
      .update({ status: "warning", resolved_at: new Date().toISOString() })
      .eq("qr_code_id", qrId)
      .eq("user_id", user.id);

    const newCount = warningCount + 1;
    setWarningCount(newCount);
    setShowQr(false);
    setShowWarningDialog(true);

    // If reached limit, auto-ban
    if (newCount >= MAX_WARNINGS) {
      await reportViolation(user.id, user.email, `Auto-ban: ${MAX_WARNINGS} QR codes PIX não pagos`);
      toast({ title: "Conta banida", description: "Você atingiu o limite de advertências.", variant: "destructive" });
    }
  }, [user, qrId, warningCount, reportViolation, toast]);

  const pixPayload = `00020126580014br.gov.bcb.pix0136bellarus-pix-${qrId.slice(0, 8)}5204000053039865404${qrAmount.toFixed(2)}5802BR6009SAO PAULO62070503***6304`;

  if (loadingWarnings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // If user hit max warnings — show blocked message
  if (warningCount >= MAX_WARNINGS) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="font-display text-xl font-bold text-foreground">Acesso Suspenso</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Você atingiu {MAX_WARNINGS} advertências por QR Codes PIX não pagos. 
          Seu acesso à recarga foi permanentemente revogado.
        </p>
      </div>
    );
  }

  // Show QR Code payment screen
  if (showQr) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <QrCode className="w-8 h-8 text-primary mx-auto mb-2" />
          <h1 className="font-display text-2xl font-bold text-foreground">Pagamento PIX</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escaneie o QR Code abaixo para pagar
          </p>
        </div>

        <div className="glass rounded-xl p-6 flex flex-col items-center gap-4">
          <div className="bg-white rounded-xl p-4">
            <QRCodeSVG value={pixPayload} size={200} />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatBRL(qrAmount)}</p>
          <p className="text-xs text-muted-foreground">ID: {qrId.slice(0, 8).toUpperCase()}</p>
        </div>

        {/* Warning notice */}
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground mb-1">Atenção!</p>
            <p className="text-muted-foreground">
              Cancelar sem pagar gera uma <span className="text-yellow-500 font-semibold">advertência</span>.
              Você possui <span className="text-foreground font-bold">{warningCount}/{MAX_WARNINGS}</span> advertências.
              Com {MAX_WARNINGS} advertências sua conta será <span className="text-destructive font-semibold">banida permanentemente</span>.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="gradient"
            className="flex-1 h-12 font-semibold"
            onClick={handleConfirmPayment}
            disabled={confirmingPayment}
          >
            {confirmingPayment ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirmando...</>
            ) : (
              <><CheckCircle className="w-4 h-4 mr-2" /> Já Paguei</>
            )}
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={handleCancelQr}
          >
            <XCircle className="w-4 h-4 mr-2" /> Cancelar
          </Button>
        </div>
      </div>
    );
  }

  const inGroup = (group: Pacote[]) =>
    Boolean(selectedPacote && group.some((p) => p.credits === selectedPacote.credits));

  const GenerateBar = (
    <div className="space-y-3 pt-4">
      {cooldownLeft > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            Próximo QR Code disponível em <span className="text-foreground font-bold">{cooldownLeft}s</span>
          </p>
        </div>
      )}
      <Button
        variant="gradient"
        className="w-full h-14 text-base font-semibold"
        onClick={generateQrCode}
        disabled={generating || cooldownLeft > 0}
      >
        {generating ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando QR Code...</>
        ) : cooldownLeft > 0 ? (
          <><Clock className="w-5 h-5 mr-2" /> Aguarde {cooldownLeft}s</>
        ) : (
          selectedPacote
            ? `Gerar PIX — ${selectedPacote.credits} créditos por ${formatBRL(selectedPacote.total)}`
            : `Gerar PIX — ${sliderValue[0]} créditos por ${formatBRL(sliderPrice)}`
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-5 h-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Pacotes de Créditos</h1>
        </div>
        <p className="text-sm text-muted-foreground">Arraste a barra ou escolha um pacote</p>
      </div>

      {/* Warning banner */}
      {warningCount > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Você possui <span className="text-yellow-500 font-bold">{warningCount}/{MAX_WARNINGS}</span> advertência(s).
            Gerar QR Code e não pagar resulta em advertência. Com {MAX_WARNINGS}, sua conta será banida.
          </p>
        </div>
      )}

      {/* Barra deslizante — sempre no topo */}
      <div>
        <div className="glass rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-4">Arraste para selecionar a quantidade:</p>
          <Slider
            value={sliderValue}
            onValueChange={(v) => {
              setSliderValue(v);
              setSelectedPacote(null);
            }}
            min={1}
            max={4}
            step={1}
            className="mb-4"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground font-semibold">{sliderValue[0]} créditos</span>
            <span className="text-sm text-accent font-bold">{formatBRL(sliderPrice)}</span>
          </div>
        </div>
        {!selectedPacote && GenerateBar}
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
        {inGroup(populares) && GenerateBar}
      </div>

      {/* Intermediários */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground tracking-wider">Pacotes Intermediários</h2>
          <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full">Melhor custo-benefício</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {intermediarios.map((p) => (
            <PacoteCard key={p.credits} p={p} selected={selectedPacote?.credits === p.credits} onSelect={() => setSelectedPacote(p)} />
          ))}
        </div>
        {inGroup(intermediarios) && GenerateBar}
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
        {inGroup(volumes) && GenerateBar}
      </div>


      {/* Warning dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Advertência Registrada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você cancelou um QR Code PIX sem pagar. Isso gerou uma advertência.
              <br /><br />
              <span className="font-semibold text-foreground">
                Advertências: {warningCount}/{MAX_WARNINGS}
              </span>
              <br />
              {warningCount >= MAX_WARNINGS - 1 && (
                <span className="text-destructive font-semibold">
                  ⚠️ Próxima advertência resultará em banimento permanente!
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
