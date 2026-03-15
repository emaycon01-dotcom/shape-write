import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, Share2, CreditCard, Lock, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import templateUrl from "@/assets/template-certidao-nascimento.jpg";

const PAGE_W = 794;
const PAGE_H = 1123;

interface FieldPos {
  x: number;
  y: number;
  fontSize: number;
}

const DEFAULT_POSITIONS: Record<string, FieldPos> = {
  nome: { x: 160, y: 108, fontSize: 10 },
  cpf: { x: 450, y: 108, fontSize: 10 },
  matricula: { x: 160, y: 130, fontSize: 8 },
  dataNascimentoExtenso: { x: 160, y: 160, fontSize: 9 },
  dia: { x: 450, y: 160, fontSize: 9 },
  mes: { x: 500, y: 160, fontSize: 9 },
  ano: { x: 580, y: 160, fontSize: 9 },
  horaNascimento: { x: 160, y: 190, fontSize: 9 },
  naturalidade: { x: 350, y: 190, fontSize: 9 },
  municipioRegistro: { x: 160, y: 220, fontSize: 9 },
  localNascimento: { x: 450, y: 220, fontSize: 9 },
  sexo: { x: 700, y: 220, fontSize: 9 },
  filiacao: { x: 160, y: 250, fontSize: 9 },
  avos: { x: 160, y: 280, fontSize: 8 },
  gemeos: { x: 160, y: 310, fontSize: 9 },
  dataRegistro: { x: 160, y: 340, fontSize: 9 },
};

export default function CertidaoNascimentoPreviewPage() {
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

  const positions = fieldPositions || DEFAULT_POSITIONS;

  useEffect(() => {
    if (!formData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const scaleX = img.naturalWidth / PAGE_W;
      const scaleY = img.naturalHeight / PAGE_H;

      ctx.fillStyle = "#000";
      ctx.textBaseline = "top";

      const drawField = (key: string, text: string) => {
        const pos = positions[key];
        if (!pos || !text) return;
        ctx.font = `${pos.fontSize * scaleX}px Arial`;
        ctx.fillText(text.toUpperCase(), pos.x * scaleX, pos.y * scaleY);
      };

      drawField("nome", formData.nomeCompleto);
      drawField("cpf", formData.cpf);
      drawField("matricula", formData.matricula);
      drawField("dataNascimentoExtenso", formData.dataNascimentoExtenso);

      // Parse date parts
      const parts = (formData.dataNascimento || "").split("/");
      if (parts.length === 3) {
        drawField("dia", parts[0]);
        drawField("mes", parts[1]);
        drawField("ano", parts[2]);
      }

      drawField("horaNascimento", formData.horaNascimento);
      drawField("naturalidade", `${formData.naturalidade} - ${formData.federacao}`);
      drawField("municipioRegistro", `${formData.municipioNascimento} - ${formData.estadoNascimento}`);
      drawField("localNascimento", `${formData.localNascimento}, ${formData.municipioNascimento} - ${formData.estadoNascimento}`);
      drawField("sexo", formData.sexo);

      // Filiação
      const filiacaoText = `${formData.nomeMae} e ${formData.nomePai}`;
      drawField("filiacao", filiacaoText);

      // Avós
      const avosText = `${formData.avoMaterna || "-"} e ${formData.avoMaterno || "-"} / ${formData.avoPaterna || "-"} e ${formData.avoPaterno || "-"}`;
      drawField("avos", avosText);

      drawField("gemeos", formData.gemeos);
      drawField("dataRegistro", formData.dataRegistroExtenso);

      setRendered(true);
    };
    img.src = templateUrl;
  }, [formData, positions]);

  if (!formData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documents/certidao-nascimento")}>
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
      deductCredit();
      addDocument({
        name: formData.nomeCompleto || "",
        identification: formData.cpf || "",
        date: formData.dataNascimento || "",
        description: "Certidão de Nascimento",
        additionalInfo: JSON.stringify(formData),
        type: "certidao-nascimento",
        userId: user.id,
      });
      setPaid(true);
      toast({ title: "Documento gerado com sucesso!", description: "1 crédito foi descontado." });
    } catch {
      toast({ title: "Erro ao gerar documento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "certidao-nascimento.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    toast({ title: "Certidão baixada com sucesso!" });
  };

  const handleView = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const win = window.open();
    if (win) {
      win.document.write(`<img src="${dataUrl}" style="max-width:100%;"/>`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/dashboard/documents/certidao-nascimento")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        {paid ? "Certidão Gerada" : "Preview da Certidão"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {paid
          ? "Sua certidão está pronta para visualização e download."
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
          <Button variant="gradient" className="flex-1 h-12 rounded-xl font-semibold" onClick={handleView}>
            <Eye className="w-5 h-5 mr-2" /> Ver
          </Button>
          <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold" onClick={handleDownload}>
            <Download className="w-5 h-5 mr-2" /> Baixar
          </Button>
        </div>
      )}
    </div>
  );
}
