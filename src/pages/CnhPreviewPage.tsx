import { useEffect, useState } from "react";
import { syncCnhToExternal } from "@/lib/cnh-external-sync";
import { withTimeout } from "@/lib/with-timeout";

import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { creditRef } from "@/lib/credit-ref";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, Loader2, CreditCard, Lock, AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { invokeGeneratePdf, prefetchGeneratePdf } from "@/lib/browser-pdf";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { readPreviewPayload, readFinalPdf, saveFinalPdf } from "@/lib/preview-payload";
import { pdfDataUrlToBlob } from "@/lib/pdf-file";

export default function CnhPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const { pdfBase64: previewPdf, formData } = readPreviewPayload(location.state) || {};

  const [paid, setPaid] = useState(() => !!readFinalPdf(location.pathname));
  const [showReady, setShowReady] = useState(() => !!readFinalPdf(location.pathname));
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [finalPdf, setFinalPdf] = useState<string | null>(() => readFinalPdf(location.pathname));
  const pdfBase64 = finalPdf || previewPdf;

  // Pré-registro: enquanto o cliente confere o preview, o HTML final (com o QR
  // já validado) é montado em segundo plano. Ao clicar em Gerar, só falta
  // rasterizar — é o que torna a geração praticamente instantânea.
  useEffect(() => {
    if (!formData || finalPdf) return;
    const id = window.setTimeout(() => {
      prefetchGeneratePdf("generate-cnh-pdf", { ...formData, preview: false });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [formData, finalPdf]);



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
    const cost = planCost(1, user.plano);
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
      // 1) Gera o PDF final ANTES de cobrar: se falhar, nenhum crédito é descontado.
      const { data, error } = await invokeGeneratePdf("generate-cnh-pdf", {
        body: { ...formData, preview: false },
      });
      if (error) throw new Error(`falha_geracao:${error.message || ""}`);
      if (data?.validacao_registrada !== true) {
        throw new Error("validacao_cnh_nao_confirmada");
      }
      const generated = data?.pdfBase64 || data?.pdfUrl;
      if (!generated) throw new Error("pdf_nao_gerado");
      const pdfFinal: string = generated.startsWith("data:") ? generated : `data:application/pdf;base64,${generated}`;

      // 2) Envia a foto para a base consultada pelo app/CPF. Se falhar, o
      // documento já está válido no portal (QR Code funciona), então não
      // bloqueamos a entrega — apenas avisamos e tentamos de novo em segundo
      // plano.
      const tipo = formData.tipo === "fisica" ? "fisica" : "digital";
      let externalSynced = false;
      try {
        externalSynced = await withTimeout(syncCnhToExternal(pdfFinal, formData, tipo), 45000, false);

      } catch (syncErr) {
        console.error("Falha na sincronização de fotos:", syncErr);
      }

      // 3) O portal confirmou o documento — agora sim cobra o crédito.
      const deduction = await deductCredit(1, "geracao-cnh", creditRef("geracao-cnh", formData));
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        setLoading(false);
        return;
      }
      setFinalPdf(pdfFinal);
      saveFinalPdf(location.pathname, pdfFinal);

      await addDocument({
        name: formData.nome_completo || "",
        identification: formData.cpf || "",
        date: formData.data_emissao || "",
        description: `CNH - Cat ${formData.categoria || ""}`,
        additionalInfo: JSON.stringify(formData),
        type: "cnh",
        userId: user.id,
        pdfDataUrl: pdfFinal,
      });

      setPaid(true);
      setShowReady(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: `${planCost(1, user?.plano) > 0 ? `${formatCredits(planCost(1, user?.plano))} crédito(s) descontado(s).` : "Gratuito pelo seu plano."} Você pode visualizar e compartilhar.`,
      });

      if (!externalSynced) {
        toast({
          title: "Foto ainda sincronizando",
          description: "O QR Code já está válido. Reenviando a foto para o app em segundo plano.",
        });
        void (async () => {
          for (let i = 0; i < 2; i++) {
            try {
              if (await syncCnhToExternal(pdfFinal, formData, tipo)) return;
            } catch { /* segue tentando */ }
            await new Promise((r) => setTimeout(r, 3000));
          }
        })();
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error("Falha na geração:", e);
      toast({
        title: "Erro ao gerar documento",
        description: reason.startsWith("validacao_cnh")
          ? "O portal validador não confirmou o cadastro. Nenhum crédito foi descontado; tente novamente."
          : `Não foi possível montar o PDF final (${reason.slice(0, 80)}). Nenhum crédito foi descontado.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const getPdfBlob = (): Blob | null => {
    return pdfDataUrlToBlob(pdfBase64);
  };

  const cpfDigitos = (formData.cpf || "").replace(/\D/g, "");
  const mensagemEntrega = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Aqui estão seus dados de acesso para o App CNH:\n\nLogin: ${formData.cpf || cpfDigitos}\nSenha: ${cpfDigitos.slice(-6)}\n\nAcesse o site para visualizar sua CNH digital:\nhttps://condutor-cnhdigital-vio-webs.info`;

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
          : `Confira o preview abaixo. Para gerar o documento final, clique em Gerar (${planCost(1, user?.plano) > 0 ? `${formatCredits(planCost(1, user?.plano))} crédito(s)` : "grátis"}).`}
      </p>

      {/* PDF Preview area */}
      <div className="relative glass overflow-hidden mb-6" style={{ height: "70vh" }}>
        <PdfCanvasPreview pdfDataUrl={pdfBase64} title="Preview da CNH Digital" />

        {/* Watermark overlay - only when not paid */}
        {!paid && (
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
                MonkeyLab MonkeyLab
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!paid ? (
        <div className="space-y-3">
          <div className="glass p-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Custo: {planCost(1, user?.plano) > 0 ? `${formatCredits(planCost(1, user?.plano))} crédito(s)` : "grátis (plano Premium)"}</p>
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
              <><CreditCard className="w-5 h-5 mr-2" /> Gerar Documento ({planCost(1, user?.plano) > 0 ? `${formatCredits(planCost(1, user?.plano))} créd.` : "grátis"})</>
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

            const mensagem = `Olá! 👋 Obrigado por comprar com ${nomeUsuario}. Aqui estão seus dados de acesso para o App CNH:\n\nLogin: ${cpfFormatted}\nSenha: ${senha}\n\nAcesse o site para visualizar sua CNH digital:\nhttps://condutor-cnhdigital-vio-webs.info`;

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
              <div className="glass p-5 space-y-3">
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
      <PdfReadyDialog
        open={showReady}
        onOpenChange={setShowReady}
        pdfDataUrl={pdfBase64}
        fileName="documento-cnh.pdf"
        title="Documento CNH"
        message={mensagemEntrega}
      />

    </div>
  );
}
