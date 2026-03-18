import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Share2, CreditCard, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import templateBg from "@/assets/template-cha-amador.jpg";

const PAGE_W = 794;
const PAGE_H = 1123;

interface FieldPos {
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
}

const DEFAULT_POSITIONS: Record<string, FieldPos> = {
  nomeCompleto: { x: 94, y: 221, fontSize: 28 },
  dataNascimento: { x: 90, y: 296, fontSize: 28 },
  rgOrgaoUf: { x: 259, y: 296, fontSize: 28 },
  cpf: { x: 518, y: 297, fontSize: 26 },
  inscricao: { x: 95, y: 434, fontSize: 28 },
  localEmissao: { x: 94, y: 717, fontSize: 20 },
  validade: { x: 542, y: 715, fontSize: 27 },
};

export default function CnhNauticaPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
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

    const bg = new Image();
    bg.crossOrigin = "anonymous";
    bg.onload = () => {
      canvas.width = bg.width;
      canvas.height = bg.height;

      const scaleX = bg.width / PAGE_W;
      const scaleY = bg.height / PAGE_H;

      // Draw template background
      ctx.drawImage(bg, 0, 0, bg.width, bg.height);

      ctx.textBaseline = "top";

      const drawField = (key: string, text: string, color = "#000", bold = false) => {
        const pos = positions[key];
        if (!pos || !text) return;
        ctx.fillStyle = color;
        ctx.font = `${bold ? "bold " : ""}${pos.fontSize * scaleX}px Arial`;
        ctx.fillText(text.toUpperCase(), pos.x * scaleX, pos.y * scaleY);
      };

      drawField("nomeCompleto", formData.nomeCompleto, "#000", true);
      drawField("dataNascimento", formData.dataNascimento, "#000");
      drawField("rgOrgaoUf", formData.rgOrgaoUf, "#000");
      drawField("cpf", formData.cpf, "#000");
      drawField("inscricao", formData.inscricao, "#000");
      drawField("localEmissao", formData.localEmissao, "#000");
      drawField("validade", formData.validade, "#000");

      setRendered(true);
    };
    bg.onerror = () => {
      // Fallback: plain canvas
      canvas.width = PAGE_W;
      canvas.height = PAGE_H;
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      ctx.fillStyle = "#999";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Template: Arrais Amador Físico", PAGE_W / 2, 100);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      const drawField = (key: string, text: string, color = "#000", bold = false) => {
        const pos = positions[key];
        if (!pos || !text) return;
        ctx.fillStyle = color;
        ctx.font = `${bold ? "bold " : ""}${pos.fontSize}px Arial`;
        ctx.fillText(text.toUpperCase(), pos.x, pos.y);
      };

      drawField("nomeCompleto", formData.nomeCompleto, "#000", true);
      drawField("dataNascimento", formData.dataNascimento, "#000");
      drawField("rgOrgaoUf", formData.rgOrgaoUf, "#000");
      drawField("cpf", formData.cpf, "#000");
      drawField("inscricao", formData.inscricao, "#000");
      drawField("localEmissao", formData.localEmissao, "#000");
      drawField("validade", formData.validade, "#000");

      setRendered(true);
    };
    bg.src = templateBg;
  }, [formData, positions]);

  if (!formData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documentos-fisicos/carteirinhas/cnh-nautica")}>
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
    if (user.credits < 1.5) {
      toast({ title: "Créditos insuficientes", description: "Você precisa de pelo menos 1.5 créditos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const pdfUrl = generatePdfFromCanvas();
      if (!pdfUrl) throw new Error("Falha ao gerar PDF");
      setPdfDataUrl(pdfUrl);
      deductCredit(1.5);
      await addDocument({
        name: formData.nomeCompleto || "",
        identification: formData.inscricao || "",
        date: new Date().toLocaleDateString("pt-BR"),
        description: "Arrais Amador Físico",
        additionalInfo: JSON.stringify(formData),
        type: "cnh-nautica",
        userId: user.id,
        pdfDataUrl: pdfUrl,
      });
      setPaid(true);
      toast({ title: "Documento gerado com sucesso!", description: "1.5 créditos foram descontados." });
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
      const file = new File([blob], "arrais-amador.pdf", { type: "application/pdf" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Arrais Amador Físico" });
      } else {
        const link = document.createElement("a");
        link.download = "arrais-amador.pdf";
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
      link.download = "arrais-amador.pdf";
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
        onClick={() => navigate("/dashboard/documentos-fisicos/carteirinhas/cnh-nautica")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        {paid ? "Documento Gerado" : "Preview do Arrais Amador Físico"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {paid
          ? "Seu documento está pronto para visualização e download."
          : "Confira o preview abaixo. Para gerar o documento final, clique em Gerar (1.5 créditos)."}
      </p>

      <div className="relative glass rounded-xl overflow-hidden mb-6">
        <canvas ref={canvasRef} className="w-full h-auto" />
        {!paid && rendered && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none flex items-center justify-center">
            <div className="absolute inset-0" style={{
              background: "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsl(var(--destructive) / 0.06) 80px, hsl(var(--destructive) / 0.06) 82px)",
            }} />
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="absolute text-destructive/20 font-bold whitespace-nowrap select-none" style={{
                fontSize: "18px", transform: "rotate(-35deg)",
                top: `${10 + (i % 4) * 25}%`, left: `${-10 + Math.floor(i / 4) * 40}%`, letterSpacing: "2px",
              }}>
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
              <p className="text-sm font-semibold text-foreground">Custo: 1.5 créditos</p>
              <p className="text-xs text-muted-foreground">Saldo atual: {user?.credits ?? 0} crédito(s)</p>
            </div>
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
          <Button variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold" onClick={handleGenerate} disabled={loading}>
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando...</> : <><CreditCard className="w-5 h-5 mr-2" /> Gerar Documento (1.5 créditos)</>}
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
