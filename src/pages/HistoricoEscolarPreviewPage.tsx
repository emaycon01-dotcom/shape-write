import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Share2, CreditCard, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import type { HistoricoFormData } from "./HistoricoEscolarFormPage";
import { ESTADO_NOMES, loadBrasaoImage } from "@/lib/brasoes-estados";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface FieldPos {
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
}

const DEFAULT_POSITIONS: Record<string, FieldPos> = {
  estadoEscola1: { x: 260, y: 58, fontSize: 8 },
  estadoEscola2: { x: 410, y: 705, fontSize: 8 },
  endereco: { x: 90, y: 710, fontSize: 7 },
  numero: { x: 310, y: 710, fontSize: 7 },
  bairro: { x: 65, y: 722, fontSize: 7 },
  municipioEscola: { x: 165, y: 722, fontSize: 7 },
  cep: { x: 310, y: 722, fontSize: 7 },
  telefone: { x: 65, y: 734, fontSize: 7 },
  nomeAluno: { x: 120, y: 746, fontSize: 7 },
  dataNascimento: { x: 180, y: 634, fontSize: 7 },
  nomeMae: { x: 65, y: 758, fontSize: 7 },
  estadoAluno: { x: 65, y: 770, fontSize: 7 },
  rg: { x: 400, y: 746, fontSize: 7 },
  municipioCabecalho: { x: 90, y: 104, fontSize: 7 },
  anoFundamental: { x: 90, y: 782, fontSize: 6 },
  escolaFundamental: { x: 200, y: 782, fontSize: 6 },
  ufFundamental: { x: 430, y: 782, fontSize: 6 },
  municipioFundamental: { x: 370, y: 782, fontSize: 6 },
  medioAno1: { x: 90, y: 798, fontSize: 6 },
  medioEscola1: { x: 200, y: 798, fontSize: 6 },
  medioUf1: { x: 430, y: 798, fontSize: 6 },
  medioMunicipio1: { x: 370, y: 798, fontSize: 6 },
  medioAno2: { x: 90, y: 808, fontSize: 6 },
  medioEscola2: { x: 200, y: 808, fontSize: 6 },
  medioUf2: { x: 430, y: 808, fontSize: 6 },
  medioMunicipio2: { x: 370, y: 808, fontSize: 6 },
  medioAno3: { x: 90, y: 818, fontSize: 6 },
  medioEscola3: { x: 200, y: 818, fontSize: 6 },
  medioUf3: { x: 430, y: 818, fontSize: 6 },
  medioMunicipio3: { x: 370, y: 818, fontSize: 6 },
  escolaConclusao: { x: 195, y: 838, fontSize: 6 },
  nomeConcludente: { x: 350, y: 842, fontSize: 6 },
  anoFinalizacao: { x: 190, y: 848, fontSize: 6 },
};

function parseEnderecoNumero(val: string): { endereco: string; numero: string } {
  const parts = val.split(",").map((s) => s.trim());
  if (parts.length >= 2) return { endereco: parts.slice(0, -1).join(", "), numero: parts[parts.length - 1] };
  return { endereco: val, numero: "" };
}

function parseBairroMunicipioCep(val: string): { bairro: string; municipio: string; cep: string } {
  const parts = val.split("/").map((s) => s.trim());
  if (parts.length >= 3) return { bairro: parts[0], municipio: parts[1], cep: parts[2] };
  if (parts.length === 2) return { bairro: parts[0], municipio: parts[1], cep: "" };
  return { bairro: val, municipio: "", cep: "" };
}

function parseUfMunicipio(val: string): { uf: string; municipio: string } {
  const parts = val.split("/").map((s) => s.trim());
  if (parts.length >= 2) return { uf: parts[0], municipio: parts[1] };
  return { uf: val, municipio: "" };
}

export default function HistoricoEscolarPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument, updateDocument } = useDocuments();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { formData, fieldPositions, autoUpdate, editDocId } = (location.state as {
    formData: HistoricoFormData;
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
    if (!autoUpdate || !editDocId || !rendered || !canvasRef.current) return;
    const doUpdate = async () => {
      setLoading(true);
      try {
        const pdfUrl = generatePdfFromCanvas();
        if (!pdfUrl) throw new Error("fail");
        await updateDocument(editDocId, { additionalInfo: JSON.stringify(formData), pdfDataUrl: pdfUrl });
        toast({ title: "Documento atualizado com sucesso!" });
        navigate("/dashboard/history");
      } catch {
        toast({ title: "Erro ao atualizar documento", variant: "destructive" });
      } finally { setLoading(false); }
    };
    doUpdate();
  }, [autoUpdate, editDocId, rendered]);

  useEffect(() => {
    if (!formData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    (async () => {
      try {
        const res = await fetch("/assets/template-historico-escolar.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const scale = 2;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const pdfW = viewport.width / scale;
        const pdfH = viewport.height / scale;
        const scaleX = canvas.width / pdfW;
        const scaleY = canvas.height / pdfH;

        ctx.textBaseline = "top";

        const COLOR = "#111";
        const FONT = "'Arial', sans-serif";

        const drawField = (key: string, text: string, color = COLOR, bold = false) => {
          const pos = positions[key];
          if (!pos || !text) return;
          ctx.fillStyle = color;
          ctx.font = `${bold ? "bold " : ""}${pos.fontSize * scaleX}px ${FONT}`;
          ctx.fillText(text, pos.x * scaleX, pos.y * scaleY);
        };

        // Parse compound fields
        const { endereco, numero } = parseEnderecoNumero(formData.enderecoNumero);
        const { bairro, municipio: municipioEscola, cep } = parseBairroMunicipioCep(formData.bairroMunicipioCep);
        const { uf: ufFund, municipio: munFund } = parseUfMunicipio(formData.ufMunicipioFundamental);

        // Draw brasão image
        if (formData.estadoEscola) {
          const brasaoImg = await loadBrasaoImage(formData.estadoEscola);
          if (brasaoImg) {
            const bp = positions["brasao"] || DEFAULT_POSITIONS["brasao"];
            const bw = (bp.w || 40) * scaleX;
            const bh = (bp.h || 45) * scaleY;
            ctx.drawImage(brasaoImg, bp.x * scaleX, bp.y * scaleY, bw, bh);
          }
        }

        // Sessão 1 - estadoEscola1 in full name (e.g. "ALAGOAS"), estadoEscola2 as abbreviation
        const estadoExtenso = ESTADO_NOMES[formData.estadoEscola] || formData.estadoEscola;
        drawField("estadoEscola1", estadoExtenso);
        drawField("estadoEscola2", formData.estadoEscola);
        drawField("endereco", endereco);
        drawField("numero", numero);
        drawField("bairro", bairro);
        drawField("municipioEscola", municipioEscola);
        drawField("cep", cep);
        drawField("telefone", formData.telefone);
        drawField("municipioCabecalho", municipioEscola);

        // Sessão 2
        drawField("nomeAluno", formData.nomeAluno, COLOR, true);
        drawField("dataNascimento", formData.dataNascimento);
        drawField("nomeMae", formData.nomeMae);
        drawField("estadoAluno", formData.estadoAluno);
        drawField("rg", formData.rg);

        // Sessão 3 - Fundamental
        drawField("anoFundamental", formData.anoEnsinoFundamental);
        drawField("escolaFundamental", formData.escolaEnsinoFundamental);
        drawField("ufFundamental", ufFund);
        drawField("municipioFundamental", munFund);

        // Sessão 3 - Médio (até 3 entradas)
        formData.ensinoMedio.forEach((entry, idx) => {
          const n = idx + 1;
          const { uf, municipio } = parseUfMunicipio(entry.ufMunicipio);
          drawField(`medioAno${n}`, entry.ano);
          drawField(`medioEscola${n}`, entry.escola);
          drawField(`medioUf${n}`, uf);
          drawField(`medioMunicipio${n}`, municipio);
        });

        // Sessão 4
        drawField("escolaConclusao", formData.escolaConclusao);
        drawField("nomeConcludente", formData.nomeConcludente, COLOR, true);
        drawField("anoFinalizacao", formData.anoFinalizacao);

        setRendered(true);
      } catch (err) {
        console.error("Error rendering Histórico preview:", err);
        canvas.width = 1190; canvas.height = 1684;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#333";
        ctx.font = "16px Arial";
        ctx.fillText("Erro ao carregar template", 50, 50);
        setRendered(true);
      }
    })();
  }, [formData, positions]);

  const generatePdfFromCanvas = (): string | null => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tmpCtx = tmp.getContext("2d");
    if (!tmpCtx) return null;
    tmpCtx.fillStyle = "#ffffff";
    tmpCtx.fillRect(0, 0, tmp.width, tmp.height);
    tmpCtx.drawImage(canvas, 0, 0);
    const imgData = tmp.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210; const pdfHeight = 297;
    const canvasRatio = canvas.height / canvas.width;
    const imgHeight = pdfWidth * canvasRatio;
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, imgHeight <= pdfHeight ? imgHeight : pdfHeight);
    return pdf.output("datauristring");
  };

  if (!formData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documents/historico-escolar")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao formulário
        </Button>
      </div>
    );
  }

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
        name: formData.nomeAluno || "",
        identification: formData.rg || "",
        date: new Date().toLocaleDateString("pt-BR"),
        description: "Histórico Escolar",
        additionalInfo: JSON.stringify(formData),
        type: "historico-escolar",
        userId: user.id,
        pdfDataUrl: pdfUrl,
      });
      setPaid(true);
      toast({ title: "Documento gerado com sucesso!", description: "1 crédito foi descontado." });
    } catch {
      toast({ title: "Erro ao gerar documento", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (!pdfDataUrl) return;
    try {
      const blob = await fetch(pdfDataUrl).then((r) => r.blob());
      const file = new File([blob], "historico-escolar.pdf", { type: "application/pdf" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Histórico Escolar" });
      } else {
        const link = document.createElement("a");
        link.download = "historico-escolar.pdf";
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
      link.download = "historico-escolar.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      toast({ title: "PDF baixado com sucesso!" });
    } catch {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate("/dashboard/documents/historico-escolar")} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        {paid ? "Documento Gerado" : "Preview do Histórico Escolar"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {paid ? "Seu documento está pronto para visualização e download." : "Confira o preview abaixo. Para gerar o documento final, clique em Gerar (1 crédito)."}
      </p>

      <div className="relative glass rounded-xl overflow-hidden mb-6">
        <canvas ref={canvasRef} className="w-full h-auto" />
        {!paid && rendered && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none flex items-center justify-center">
            <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsl(var(--destructive) / 0.06) 80px, hsl(var(--destructive) / 0.06) 82px)" }} />
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
