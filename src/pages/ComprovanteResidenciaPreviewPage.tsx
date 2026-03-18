import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Share2, CreditCard, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import templateUrl from "@/assets/template-comprovante-residencia.jpg";

const PAGE_W = 794;
const PAGE_H = 1123;

interface FieldPos {
  x: number;
  y: number;
  fontSize: number;
}

const DEFAULT_POSITIONS: Record<string, FieldPos> = {
  nome1: { x: 160, y: 6, fontSize: 12.5 },
  nome2: { x: 62, y: 1005, fontSize: 11 },
  endereco: { x: 163, y: 24, fontSize: 7.5 },
  cepCidadeEstado: { x: 163, y: 35, fontSize: 8 },
  cpf: { x: 380, y: 60, fontSize: 12 },
};

export default function ComprovanteResidenciaPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument, updateDocument } = useDocuments();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { formData, fieldPositions } = (location.state as {
    formData: Record<string, string>;
    fieldPositions: Record<string, FieldPos> | null;
  }) || {};

  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);

  const positions = fieldPositions || DEFAULT_POSITIONS;

  useEffect(() => {
    if (!formData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const scaleX = img.naturalWidth / PAGE_W;
      const scaleY = img.naturalHeight / PAGE_H;

      ctx.fillStyle = "#000";
      ctx.textBaseline = "top";

      const drawField = (key: string, text: string, bold = false) => {
        const pos = positions[key];
        if (!pos || !text) return;
        ctx.font = `${bold ? "bold " : ""}${pos.fontSize * scaleX}px Arial`;
        ctx.fillText(text.toUpperCase(), pos.x * scaleX, pos.y * scaleY);
      };

      // Nome aparece duas vezes em negrito
      drawField("nome1", formData.nomeCompleto, true);
      drawField("nome2", formData.nomeCompleto, true);

      // Endereço
      drawField("endereco", formData.endereco);

      // CEP CIDADE ESTADO
      const cepCidadeEstado = `${formData.cep} ${formData.cidade} ${formData.estado}`;
      drawField("cepCidadeEstado", cepCidadeEstado);

      // CPF em negrito
      drawField("cpf", formData.cpf, true);

      setRendered(true);
    };
    img.src = templateUrl;
  }, [formData, positions]);

  if (!formData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documents/comprovante-residencia")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao formulário
        </Button>
      </div>
    );
  }

  const generatePdfFromCanvas = (): string | null => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tmpCtx = tmp.getContext("2d");
    if (!tmpCtx) return null;
    tmpCtx.fillStyle = "#ffffff";
    tmpCtx.fillRect(0, 0, tmp.width, tmp.height);
    tmpCtx.drawImage(canvas, 0, 0);
    const imgData = tmp.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const pdfHeight = 297;
    const canvasRatio = canvas.height / canvas.width;
    const imgHeight = pdfWidth * canvasRatio;
    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, imgHeight);
    } else {
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    }
    return pdf.output("datauristring");
  };

  const handleGenerate = async () => {
    if (!user) return;
    if (user.credits < 1) {
      toast({ title: "Créditos insuficientes", description: "Você precisa de pelo menos 1 crédito.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const pdfUrl = generatePdfFromCanvas();
      if (!pdfUrl) throw new Error("Falha ao gerar PDF");
      setPdfDataUrl(pdfUrl);

      deductCredit();
      await addDocument({
        name: formData.nomeCompleto || "",
        identification: formData.cpf || "",
        date: new Date().toLocaleDateString("pt-BR"),
        description: "Comprovante de Residência",
        additionalInfo: JSON.stringify(formData),
        type: "comprovante-residencia",
        userId: user.id,
        pdfDataUrl: pdfUrl,
      });
      setPaid(true);
      toast({ title: "Documento gerado com sucesso!", description: "1 crédito foi descontado." });
    } catch {
      toast({ title: "Erro ao gerar documento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!pdfDataUrl) return;
    try {
      const blob = await fetch(pdfDataUrl).then((r) => r.blob());
      const file = new File([blob], "comprovante-residencia.pdf", { type: "application/pdf" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Comprovante de Residência" });
      } else {
        const link = document.createElement("a");
        link.download = "comprovante-residencia.pdf";
        link.href = pdfDataUrl;
        link.click();
        toast({ title: "PDF baixado com sucesso!" });
      }
    } catch {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  const handleDownload = async () => {
    if (!pdfDataUrl) return;
    try {
      const blob = await fetch(pdfDataUrl).then((r) => r.blob());
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "comprovante-residencia.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      toast({ title: "PDF baixado com sucesso!" });
    } catch {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/dashboard/documents/comprovante-residencia")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        {paid ? "Comprovante Gerado" : "Preview do Comprovante"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {paid
          ? "Seu comprovante está pronto para visualização e download."
          : "Confira o preview abaixo. Para gerar o documento final, clique em Gerar (1 crédito)."}
      </p>

      <div className="relative glass rounded-xl overflow-hidden mb-6">
        <canvas ref={canvasRef} className="w-full h-auto" />

        {!paid && rendered && (
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

      {!paid ? (
        <div className="space-y-3">
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Custo: 1 crédito</p>
              <p className="text-xs text-muted-foreground">Saldo atual: {user?.credits ?? 0} crédito(s)</p>
            </div>
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
          <Button variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold" onClick={handleGenerate} disabled={loading}>
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando...</> : <><CreditCard className="w-5 h-5 mr-2" /> Gerar Documento (1 crédito)</>}
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button variant="gradient" className="flex-1 h-12 rounded-xl font-semibold" onClick={handleDownload}>
            <Download className="w-5 h-5 mr-2" /> Baixar
          </Button>
          <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold" onClick={handleShare}>
            <Share2 className="w-5 h-5 mr-2" /> Compartilhar
          </Button>
        </div>
      )}
    </div>
  );
}
