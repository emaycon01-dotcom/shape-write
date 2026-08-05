import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, Loader2, CreditCard, Lock, AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { readPreviewPayload } from "@/lib/preview-payload";

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

export default function UnipPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const { pdfBase64, formData, codigoValidacao, documentoId, validationUrl } = readPreviewPayload<{
    pdfBase64: string;
    formData: Record<string, string>;
    codigoValidacao?: string;
    documentoId?: string;
    validationUrl?: string;
  }>(location.state) || {};

  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [pdfError, setPdfError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pdfBase64) return;
    let cancelled = false;

    (async () => {
      try {
        const blob = base64ToBlob(pdfBase64);
        if (!blob || blob.size === 0) throw new Error("PDF inválido");
        const bytes = new Uint8Array(await blob.arrayBuffer());

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

        const out: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          out.push(canvas.toDataURL("image/jpeg", 0.92));
        }
        if (!cancelled) {
          setPages(out);
          setPdfError(out.length === 0);
        }
      } catch {
        if (!cancelled) setPdfError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfBase64]);

  if (!pdfBase64 || !formData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documents/diploma-unip")}>
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
      const deduction = await deductCredit(1, "geracao-diploma-unip");
      if (!deduction.ok) {
        toast({ title: "Não foi possível gerar", description: deduction.error, variant: "destructive" });
        setLoading(false);
        return;
      }

      await addDocument({
        name: formData.aluno || "",
        identification: formData.identidade || "",
        date: formData.registro_data || "",
        description: `Diploma UNIP - ${formData.curso || ""}`,
        additionalInfo: JSON.stringify(formData),
        type: "diploma-unip",
        userId: user.id,
        pdfDataUrl: pdfBase64,
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
      link.download = "diploma-unip.pdf";
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
      const file = new File([blob], "diploma-unip.pdf", { type: "application/pdf" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Diploma UNIP" });
      } else {
        handleDownload();
      }
    } catch {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  const codigo = documentoId || codigoValidacao || formData.codigo_validacao || "";
  const urlValidacao = validationUrl || "https://www.unip.br/aluno/diploma-digital";
  const mensagem = `Olá! 👋 Obrigado por comprar com ${user?.name || "nosso sistema"}. Aqui está o seu Diploma UNIP:\n\nCurso: ${formData.curso_completo || ""}\nTítulo: ${formData.titulo_conferido || ""}\nCódigo de Validação: ${codigo}\n\nConsulte o diploma em:\n${urlValidacao}`;

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => navigate("/dashboard/documents/diploma-unip")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display mb-1 text-2xl font-bold text-foreground">
        {paid ? "Documento Gerado" : "Preview do Diploma UNIP"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {paid
          ? "Seu documento está pronto para visualização e compartilhamento."
          : `Confira o preview abaixo. Para gerar o documento final, clique em Gerar (${cost > 0 ? `${formatCredits(cost)} crédito(s)` : "grátis"}).`}
      </p>

      <div className="glass relative mb-6 overflow-hidden rounded-xl" style={{ height: "70vh" }}>
        {pdfError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <p className="font-semibold text-foreground">Erro ao carregar o preview do PDF</p>
            <Button variant="outline" onClick={() => navigate("/dashboard/documents/diploma-unip")} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        ) : pages.length ? (
          <div className="h-full w-full overflow-auto bg-white p-2">
            {pages.map((src, i) => (
              <img key={i} src={src} alt={`Diploma UNIP página ${i + 1}`} className="mb-3 w-full rounded shadow-sm last:mb-0" />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!paid && !pdfError && (
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
              {copied ? (<><Check className="mr-2 h-5 w-5" /> Copiado!</>) : (<><Copy className="mr-2 h-5 w-5" /> Copiar mensagem</>)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
