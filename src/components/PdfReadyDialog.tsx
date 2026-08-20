import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Share2, Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { pdfDataUrlToBlob } from "@/lib/pdf-file";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Data URL do PDF final (sem marca d'água). */
  pdfDataUrl: string;
  /** Nome do arquivo salvo no aparelho. */
  fileName: string;
  /** Título curto do documento (usado no compartilhamento). */
  title?: string;
  /** Mensagem de entrega mostrada no bloco de baixo. */
  message?: string;
};

/**
 * Diálogo padrão exibido logo após a geração do PDF final:
 * bloco 1 = ações do arquivo (baixar / abrir / compartilhar),
 * bloco 2 = mensagem de entrega pronta para copiar.
 *
 * O blob é criado uma única vez enquanto o diálogo está aberto para que
 * "Abrir PDF" funcione no Safari/iOS (data URL grande costuma falhar lá).
 */
export default function PdfReadyDialog({
  open,
  onOpenChange,
  pdfDataUrl,
  fileName,
  title = "Documento",
  message,
}: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    return () => {
      if (urlRef.current) {
        const url = urlRef.current;
        urlRef.current = null;
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    };
  }, [open]);

  const objectUrl = () => {
    if (urlRef.current) return urlRef.current;
    const blob = pdfDataUrlToBlob(pdfDataUrl);
    if (!blob) return null;
    urlRef.current = URL.createObjectURL(blob);
    return urlRef.current;
  };

  const handleDownload = () => {
    const url = objectUrl();
    if (!url) {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast({ title: "PDF baixado com sucesso!" });
  };

  const handleOpen = () => {
    const url = objectUrl();
    if (!url) {
      toast({ title: "Erro ao abrir PDF", variant: "destructive" });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    try {
      const blob = pdfDataUrlToBlob(pdfDataUrl);
      if (!blob) throw new Error("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        handleDownload();
      }
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  const handleCopy = () => {
    if (!message) return;
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      toast({ title: "Mensagem copiada!" });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-h-[90vh] max-w-lg overflow-y-auto gap-4 border-none bg-transparent p-0 shadow-none"
      >

        <div className="glass overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="flex items-start gap-3 border-b border-border/60 p-5">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-foreground">PDF final gerado</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sem marca d'água · protegido contra edição externa
              </p>
            </div>
          </div>

          <div className="space-y-2 p-5 text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Seu documento está pronto.</p>
            <p>
              Toque em <strong className="text-foreground">Baixar PDF</strong> para salvar no aparelho. Se o
              download não iniciar, use <strong className="text-foreground">Abrir PDF</strong> e salve pelo
              próprio visualizador.
            </p>
            <p className="text-xs">
              O arquivo também fica salvo no seu <strong className="text-foreground">Histórico</strong> — nenhum
              crédito é cobrado de novo para baixar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 p-4">
            <Button variant="gradient" className="h-11 flex-1 rounded-xl font-semibold" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
            <Button variant="outline" className="h-11 flex-1 rounded-xl font-semibold" onClick={handleOpen}>
              <ExternalLink className="mr-2 h-4 w-4" /> Abrir PDF
            </Button>
            <Button variant="outline" className="h-11 flex-1 rounded-xl font-semibold" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
            </Button>
          </div>
        </div>

        {message && (
          <div className="glass space-y-3 rounded-2xl border border-border/60 bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Mensagem de entrega</p>
            <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-lg bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
              {message}
            </div>
            <Button variant="gradient" className="h-11 w-full rounded-xl text-sm font-semibold" onClick={handleCopy}>
              {copied ? (
                <><Check className="mr-2 h-4 w-4" /> Copiado!</>
              ) : (
                <><Copy className="mr-2 h-4 w-4" /> Copiar mensagem</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
