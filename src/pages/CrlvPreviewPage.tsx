import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, Loader2, CreditCard, Lock, AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";

const VALIDACAO_SITE = "https://verificaviosenetran.digital";

function base64ToBlob(base64DataUrl: string): Blob | null {
  try {
    const parts = base64DataUrl.split(",");
    const mime = parts[0]?.match(/:(.*?);/)?.[1] || "application/pdf";
    const raw = atob(parts[1]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch (e) {
    console.error("Failed to convert base64 to blob:", e);
    return null;
  }
}

export default function CrlvPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const { pdfBase64: previewPdf, formData } = (location.state as {
    pdfBase64: string;
    formData: Record<string, string>;
  }) || {};

  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [finalPdf, setFinalPdf] = useState<string | null>(null);
  const pdfBase64 = finalPdf || previewPdf;

  if (!pdfBase64 || !formData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documents/crlv")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao formulário
        </Button>
      </div>
    );
  }

  const cost = planCost(1, user?.plano);

  const handleGenerate = async () => {
    if (!user) return;
    if (user.credits < cost) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de ${cost} crédito(s) para gerar o documento.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const deduction = await deductCredit(1, "geracao-crlv");
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        setLoading(false);
        return;
      }

      // Gera novamente o PDF final — agora com o QR Code registrado/válido
      let pdfFinal = previewPdf;
      try {
        const { data, error } = await invokeGeneratePdf("generate-crlv-pdf", {
          body: { ...formData, preview: false },
        });
        if (error) throw error;
        const result = data?.pdfBase64;
        if (result) {
          pdfFinal = result.startsWith("data:") ? result : `data:application/pdf;base64,${result}`;
          setFinalPdf(pdfFinal);
        }
      } catch (e) {
        console.error("Falha ao gerar PDF final com QR válido:", e);
      }

      await addDocument({
        name: formData.nome || "",
        identification: formData.cpf_cnpj || "",
        date: formData.data || "",
        description: `CRLV Digital - ${formData.placa || ""} ${formData.marca_modelo || ""}`.trim(),
        additionalInfo: JSON.stringify(formData),
        type: "crlv",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      setPaid(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });
    } catch {
      toast({ title: "Erro ao gerar documento", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      const blob = base64ToBlob(pdfBase64);
      if (!blob) throw new Error("Failed to create PDF blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `crlv-${(formData.placa || "digital").toLowerCase()}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "PDF baixado com sucesso!" });
    } catch {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    try {
      const blob = base64ToBlob(pdfBase64);
      if (!blob) throw new Error("Failed to create PDF blob");
      const file = new File([blob], "crlv-digital.pdf", { type: "application/pdf" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "CRLV Digital" });
      } else {
        handleDownload();
      }
    } catch {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Seu CRLV Digital está pronto.\n\nProprietário: ${formData.nome || ""}\nPlaca: ${(formData.placa || "").toUpperCase()}\nRENAVAM: ${formData.renavam || ""}\nExercício: ${formData.exercicio || ""}\n\nValidação pelo QR Code do documento: ${VALIDACAO_SITE}`;

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate("/dashboard/documents/crlv")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display mb-1 text-2xl font-bold text-foreground">
        {paid ? "Documento Gerado" : "Preview do CRLV Digital"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {paid
          ? "Seu documento está pronto para visualização e compartilhamento."
          : `Confira o preview abaixo. Para gerar o documento final, clique em Gerar (${cost > 0 ? `${formatCredits(cost)} crédito(s)` : "grátis"}).`}
      </p>

      <div className="glass relative mb-6 overflow-hidden rounded-xl" style={{ height: "70vh" }}>
        <PdfCanvasPreview pdfDataUrl={pdfBase64} title="Preview do CRLV Digital" />

        {!paid && (
          <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsl(var(--destructive) / 0.06) 80px, hsl(var(--destructive) / 0.06) 82px)",
              }}
            />
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="absolute select-none whitespace-nowrap font-bold text-destructive/20"
                style={{
                  fontSize: "18px",
                  transform: "rotate(-35deg)",
                  top: `${10 + (i % 4) * 25}%`,
                  left: `${-10 + Math.floor(i / 4) * 40}%`,
                  letterSpacing: "2px",
                }}
              >
                MonkeyLab MonkeyLab
              </span>
            ))}
          </div>
        )}
      </div>

      {!paid ? (
        <div className="space-y-3">
          <div className="glass flex items-center gap-3 rounded-xl p-4">
            <CreditCard className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Custo: {cost > 0 ? `${formatCredits(cost)} crédito(s)` : "grátis (plano Premium)"}
              </p>
              <p className="text-xs text-muted-foreground">Saldo atual: {user?.credits ?? 0} crédito(s)</p>
            </div>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>

          <Button
            variant="gradient"
            className="h-14 w-full rounded-xl text-base font-semibold"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
            ) : (
              <><CreditCard className="mr-2 h-5 w-5" /> Gerar Documento ({cost > 0 ? `${formatCredits(cost)} créd.` : "grátis"})</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button variant="gradient" className="h-12 flex-1 rounded-xl font-semibold" onClick={handleDownload}>
              <Download className="mr-2 h-5 w-5" /> Baixar
            </Button>
            <Button variant="outline" className="h-12 flex-1 rounded-xl font-semibold" onClick={handleShare}>
              <Share2 className="mr-2 h-5 w-5" /> Compartilhar
            </Button>
          </div>

          <div className="glass space-y-3 rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Mensagem de entrega</p>
            <div className="whitespace-pre-line rounded-lg bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
              {mensagem}
            </div>
            <Button
              variant="gradient"
              className="h-12 w-full rounded-xl text-sm font-semibold"
              onClick={() => {
                navigator.clipboard.writeText(mensagem).then(() => {
                  setCopied(true);
                  toast({ title: "Mensagem copiada!" });
                  setTimeout(() => setCopied(false), 2500);
                });
              }}
            >
              {copied ? (
                <><Check className="mr-2 h-5 w-5" /> Copiado!</>
              ) : (
                <><Copy className="mr-2 h-5 w-5" /> Copiar mensagem</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
