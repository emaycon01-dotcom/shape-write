import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, Loader2, CreditCard, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import { readPreviewPayload } from "@/lib/preview-payload";

const FORM_ROUTE = "/dashboard/documents/ficha19/form";

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

type Payload = { pdfBase64: string; formData: Record<string, unknown> };

export default function Ficha19PreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const { pdfBase64: previewPdf, formData } = readPreviewPayload<Payload>(location.state) || {};

  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finalPdf, setFinalPdf] = useState<string | null>(null);
  const pdfBase64 = finalPdf || previewPdf;

  if (!pdfBase64 || !formData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate(FORM_ROUTE)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao formulário
        </Button>
      </div>
    );
  }

  const txt = (k: string) => String(formData[k] ?? "");
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
      const { data, error } = await invokeGeneratePdf("generate-ficha19-pdf", {
        body: { ...formData, preview: false },
      });
      if (error) throw error;
      const generated = data?.pdfBase64;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:")
        ? generated
        : `data:application/pdf;base64,${generated}`;

      const deduction = await deductCredit(1, "geracao-ficha19");
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        setLoading(false);
        return;
      }
      setFinalPdf(pdfFinal);

      await addDocument({
        name: txt("nome_aluno"),
        identification: txt("rg"),
        date: txt("ano3"),
        description: `CERTIFICADO + HISTÓRICO (FICHA 19) - ${txt("escola")}`,
        additionalInfo: JSON.stringify(formData),
        type: "ficha19",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      setPaid(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });
    } catch (e) {
      console.error("Falha na geração:", e);
      toast({
        title: "Erro ao gerar documento",
        description: "Nenhum crédito foi descontado. Tente novamente.",
        variant: "destructive",
      });
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
      link.download = "certificado-historico-ficha19.pdf";
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
      const file = new File([blob], "certificado-historico-ficha19.pdf", { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Certificado + Histórico" });
      } else {
        handleDownload();
      }
    } catch {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(FORM_ROUTE)} className="mb-4 text-sm text-muted-foreground hover:text-foreground">
        ← Voltar ao formulário
      </button>

      <h1 className="font-display mb-4 text-2xl font-bold text-foreground">
        Pré-visualização — Ficha 19
      </h1>

      <div className="glass overflow-hidden rounded-xl p-2">
        <PdfCanvasPreview pdfDataUrl={pdfBase64} title="Preview do CERTIFICADO + HISTÓRICO (FICHA 19)" />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {!paid ? (
          <Button onClick={handleGenerate} disabled={loading} className="h-12 flex-1 text-base font-semibold">
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando...</>
            ) : (
              <><CreditCard className="mr-2 h-5 w-5" /> Gerar documento ({formatCredits(cost)} crédito)</>
            )}
          </Button>
        ) : (
          <>
            <Button onClick={handleDownload} className="h-12 flex-1 text-base font-semibold">
              <Download className="mr-2 h-5 w-5" /> Baixar PDF
            </Button>
            <Button onClick={handleShare} variant="outline" className="h-12 flex-1 text-base font-semibold">
              <Share2 className="mr-2 h-5 w-5" /> Compartilhar
            </Button>
          </>
        )}
      </div>

      {!paid && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> A marca d'água é removida após a geração.
        </p>
      )}
    </div>
  );
}
