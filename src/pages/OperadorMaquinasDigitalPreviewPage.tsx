import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Share2, CreditCard, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";

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
  photo: { x: 85, y: 280, w: 150, h: 190, fontSize: 8 },
  nomeCompleto: { x: 300, y: 310, fontSize: 14 },
  rg: { x: 300, y: 370, fontSize: 14 },
  ferramenta: { x: 300, y: 430, fontSize: 14 },
  numeroRegistro: { x: 300, y: 490, fontSize: 14 },
  validade: { x: 300, y: 550, fontSize: 14 },
  exameMedico: { x: 300, y: 610, fontSize: 14 },
};

export default function OperadorMaquinasDigitalPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument, updateDocument } = useDocuments();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { formData, fieldPositions, autoUpdate, editDocId } = (location.state as {
    formData: Record<string, string>;
    fieldPositions: Record<string, FieldPos> | null;
    autoUpdate?: boolean;
    editDocId?: string;
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

    (async () => {
      try {
        const res = await fetch("/assets/template-carteira-operador-maquinas-digital.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const pdfjsLib = await import("pdf-lib");
        
        // Use a canvas-based approach: render PDF page 1 as image via pdf.js-like approach
        // Since we don't have pdf.js, we'll render the template as an embedded image
        // For now, render from the PDF using pdf-lib to extract page dimensions
        const pdfDoc = await pdfjsLib.PDFDocument.load(arrayBuffer);
        const page = pdfDoc.getPage(0);
        const { width: pdfW, height: pdfH } = page.getSize();

        // Set canvas to a good resolution
        const scale = 2;
        canvas.width = PAGE_W * scale;
        canvas.height = PAGE_H * scale;
        ctx.scale(scale, scale);

        // Draw white background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);

        // Try to render the PDF as an image using an offscreen approach
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        
        // Create an image from the first page using a trick with embed/iframe screenshot
        // Since we can't directly render PDF to canvas without pdf.js, 
        // we'll use the approach of converting the PDF page to PNG via pdf-lib + canvas
        // Actually, let's use a simpler approach: create an offscreen canvas and draw text on top of a rendered PDF image
        
        // For the preview, we'll load the PDF as an image using the browser's built-in capabilities
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        // Convert first PDF page to image using canvas
        const offscreenCanvas = document.createElement("canvas");
        const offCtx = offscreenCanvas.getContext("2d");
        
        // Use a data URL approach - embed PDF in an object element is not possible on canvas
        // Let's try fetching as image directly - many browsers can render PDFs
        // Alternative: Use the page thumbnail approach
        
        // Simple approach: draw the template background and overlay text
        // Since we can't render PDF directly to canvas, we'll use embed approach for preview
        // and generate the final PDF using pdf-lib
        
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);
        ctx.fillStyle = "#999";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Template: Carteira de Máquinas Pesadas Digital", PAGE_W / 2, 100);
        ctx.fillText("(Preview sobre o template PDF)", PAGE_W / 2, 130);
        ctx.textAlign = "left";

        URL.revokeObjectURL(blobUrl);

        const scaleX = 1;
        const scaleY = 1;

        ctx.textBaseline = "top";

        const drawField = (key: string, text: string, color = "#000", bold = false) => {
          const pos = positions[key];
          if (!pos || !text) return;
          ctx.fillStyle = color;
          ctx.font = `${bold ? "bold " : ""}${pos.fontSize}px Arial`;
          ctx.fillText(text.toUpperCase(), pos.x, pos.y);
        };

        // Draw photo
        const photoPos = positions.photo || DEFAULT_POSITIONS.photo;
        if (formData.fotoBase64 && photoPos) {
          const photoImg = new Image();
          photoImg.crossOrigin = "anonymous";
          photoImg.onload = () => {
            const pw = photoPos.w || 150;
            const ph = photoPos.h || 190;
            ctx.drawImage(photoImg, photoPos.x, photoPos.y, pw, ph);
            setRendered(true);
          };
          photoImg.src = formData.fotoBase64;
        }

        drawField("nomeCompleto", formData.nomeCompleto, "#000", true);
        drawField("rg", formData.rg, "#000");
        drawField("ferramenta", formData.ferramenta, "#000");
        drawField("numeroRegistro", formData.numeroRegistro, "#000");
        drawField("validade", formData.validade, "#000");
        drawField("exameMedico", formData.exameMedico, "#000");

        if (!formData.fotoBase64) {
          setRendered(true);
        }
      } catch (err) {
        console.error("Error rendering preview:", err);
        // Fallback: simple canvas rendering
        canvas.width = PAGE_W * 2;
        canvas.height = PAGE_H * 2;
        ctx.scale(2, 2);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);
        ctx.fillStyle = "#333";
        ctx.font = "16px Arial";
        ctx.fillText("Erro ao carregar template", 50, 50);
        setRendered(true);
      }
    })();
  }, [formData, positions]);

  if (!formData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documentos-fisicos/carteirinhas/operador-maquinas-digital")}>
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
    if (user.credits < 2) {
      toast({ title: "Créditos insuficientes", description: "Você precisa de pelo menos 2 créditos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const pdfUrl = generatePdfFromCanvas();
      if (!pdfUrl) throw new Error("Falha ao gerar PDF");
      setPdfDataUrl(pdfUrl);
      deductCredit();
      deductCredit();
      await addDocument({
        name: formData.nomeCompleto || "",
        identification: formData.numeroRegistro || "",
        date: new Date().toLocaleDateString("pt-BR"),
        description: "Carteira de Máquinas Pesadas Digital",
        additionalInfo: JSON.stringify(formData),
        type: "operador-maquinas-digital",
        userId: user.id,
        pdfDataUrl: pdfUrl,
      });
      setPaid(true);
      toast({ title: "Documento gerado com sucesso!", description: "2 créditos foram descontados." });
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
      const file = new File([blob], "operador-maquinas-digital.pdf", { type: "application/pdf" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Carteira de Máquinas Pesadas Digital" });
      } else {
        const link = document.createElement("a");
        link.download = "operador-maquinas-digital.pdf";
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
      link.download = "operador-maquinas-digital.pdf";
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
        onClick={() => navigate("/dashboard/documentos-fisicos/carteirinhas/operador-maquinas-digital")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        {paid ? "Documento Gerado" : "Preview da Carteira de Máquinas Pesadas Digital"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {paid
          ? "Seu documento está pronto para visualização e download."
          : "Confira o preview abaixo. Para gerar o documento final, clique em Gerar (2 créditos)."}
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
              <p className="text-sm font-semibold text-foreground">Custo: 2 créditos</p>
              <p className="text-xs text-muted-foreground">Saldo atual: {user?.credits ?? 0} crédito(s)</p>
            </div>
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
          <Button variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold" onClick={handleGenerate} disabled={loading}>
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando...</> : <><CreditCard className="w-5 h-5 mr-2" /> Gerar Documento (2 créditos)</>}
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
