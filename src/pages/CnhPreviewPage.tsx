import { useState, useEffect } from "react";
import { syncCnhToExternal } from "@/lib/cnh-external-sync";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, Loader2, CreditCard, Lock, AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function CnhPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const { pdfBase64, formData } = (location.state as {
    pdfBase64: string;
    formData: Record<string, string>;
  }) || {};

  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pdfBase64) return;
    
    let url: string | null = null;
    
    try {
      // Convert base64 data URL directly to blob (more reliable than fetch)
      const blob = base64ToBlob(pdfBase64);
      if (blob && blob.size > 0) {
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setPdfError(false);
      } else {
        console.error("PDF blob is empty");
        setPdfError(true);
      }
    } catch (e) {
      console.error("Failed to create PDF blob URL:", e);
      setPdfError(true);
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pdfBase64]);

  if (!pdfBase64 || !formData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documents/cnh")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao formulário
        </Button>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!user) return;
    if (user.credits < 1) {
      toast({
        title: "Créditos insuficientes",
        description: "Você precisa de pelo menos 1 crédito para gerar o documento.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const deduction = await deductCredit(1, "geracao-cnh");
      if (!deduction.ok) {
        toast({
          title: "Não foi possível gerar",
          description: deduction.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }


      await addDocument({
        name: formData.nome_completo || "",
        identification: formData.cpf || "",
        date: formData.data_emissao || "",
        description: `CNH - Cat ${formData.categoria || ""}`,
        additionalInfo: JSON.stringify(formData),
        type: "cnh",
        userId: user.id,
        pdfDataUrl: pdfBase64,
      });

      // Sync CNH parts to external system
      const tipo = formData.tipo === "fisica" ? "fisica" : "digital";
      syncCnhToExternal(pdfBase64, formData, tipo as "digital" | "fisica")
        .then((ok) => {
          if (ok) console.log("CNH synced to external system");
          else console.warn("CNH external sync failed (non-blocking)");
        })
        .catch((err) => console.error("CNH external sync error:", err));

      setPaid(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: "1 crédito foi descontado. Você pode visualizar e compartilhar.",
      });
    } catch {
      toast({
        title: "Erro ao gerar documento",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPdfBlob = (): Blob | null => {
    return base64ToBlob(pdfBase64);
  };

  const handleShare = async () => {
    try {
      const blob = getPdfBlob();
      if (!blob) throw new Error("Failed to create PDF blob");
      const file = new File([blob], "documento-cnh.pdf", { type: "application/pdf" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Documento CNH" });
      } else {
        handleDownload();
      }
    } catch {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    try {
      const blob = getPdfBlob();
      if (!blob) throw new Error("Failed to create PDF blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "documento-cnh.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "PDF baixado com sucesso!" });
    } catch {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    }
  };

  const handleRetry = () => {
    navigate("/dashboard/documents/cnh");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/dashboard/documents/cnh")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        {paid ? "Documento Gerado" : "Preview do Documento"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {paid
          ? "Seu documento está pronto para visualização e compartilhamento."
          : "Confira o preview abaixo. Para gerar o documento final, clique em Gerar (1 crédito)."}
      </p>

      {/* PDF Preview area */}
      <div className="relative glass rounded-xl overflow-hidden mb-6" style={{ height: "70vh" }}>
        {pdfError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <p className="text-foreground font-semibold">Erro ao carregar o preview do PDF</p>
            <p className="text-muted-foreground text-sm">
              O PDF foi gerado mas não pôde ser exibido no navegador. 
              Você ainda pode gerar e baixar o documento.
            </p>
            <Button variant="outline" onClick={handleRetry} className="gap-1.5">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
          </div>
        ) : blobUrl ? (
          <iframe
            src={blobUrl}
            className="w-full h-full border-0 bg-white"
            title="PDF Preview"
            style={{ backgroundColor: "#ffffff" }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Watermark overlay - only when not paid */}
        {!paid && !pdfError && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none flex items-center justify-center">
            <div className="absolute inset-0" style={{
              background: "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsl(var(--destructive) / 0.06) 80px, hsl(var(--destructive) / 0.06) 82px)",
            }} />
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="absolute text-destructive/20 font-bold whitespace-nowrap select-none"
                style={{
                  fontSize: "18px",
                  transform: `rotate(-35deg)`,
                  top: `${10 + (i % 4) * 25}%`,
                  left: `${-10 + Math.floor(i / 4) * 40}%`,
                  letterSpacing: "2px",
                }}
              >
                PROPRIEDADE BELLARUS NÃO COPIE
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!paid ? (
        <div className="space-y-3">
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Custo: 1 crédito</p>
              <p className="text-xs text-muted-foreground">
                Saldo atual: {user?.credits ?? 0} crédito(s)
              </p>
            </div>
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>

          <Button
            variant="gradient"
            className="w-full h-14 text-base rounded-xl font-semibold"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando...</>
            ) : (
              <><CreditCard className="w-5 h-5 mr-2" /> Gerar Documento (1 crédito)</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button variant="gradient" className="flex-1 h-12 rounded-xl font-semibold" onClick={handleDownload}>
              <Download className="w-5 h-5 mr-2" /> Baixar
            </Button>
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold" onClick={handleShare}>
              <Share2 className="w-5 h-5 mr-2" /> Compartilhar
            </Button>
          </div>

          {/* Thank you message card */}
          {(() => {
            const cpf = formData.cpf?.replace(/\D/g, "") || "";
            const senha = cpf.slice(-6);
            const cpfFormatted = formData.cpf || cpf;
            const nomeUsuario = user?.name || "nosso sistema";

            const mensagem = `Olá! 👋 Obrigado por comprar com ${nomeUsuario}. Aqui estão seus dados de acesso para o App CNH:\n\nLogin: ${cpfFormatted}\nSenha: ${senha}\n\nAcesse nosso site ou aplicativo para visualizar sua CNH digital.`;

            const handleCopy = () => {
              navigator.clipboard.writeText(mensagem).then(() => {
                setCopied(true);
                toast({ title: "Mensagem copiada!" });
                setTimeout(() => setCopied(false), 2500);
              }).catch(() => {
                toast({ title: "Erro ao copiar", variant: "destructive" });
              });
            };

            return (
              <div className="glass rounded-xl p-5 space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Mensagem de entrega</p>
                <div className="bg-secondary/50 rounded-lg p-4 text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {mensagem}
                </div>
                <Button
                  variant="gradient"
                  className="w-full h-12 rounded-xl font-semibold text-sm"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <><Check className="w-5 h-5 mr-2" /> Copiado!</>
                  ) : (
                    <><Copy className="w-5 h-5 mr-2" /> Copiar mensagem para a área de transferência</>
                  )}
                </Button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
