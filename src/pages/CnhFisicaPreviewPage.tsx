import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Eye, Share2, ArrowLeft, Loader2, CreditCard, Lock, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CnhFisicaPreviewPage() {
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

  const fileName = useMemo(() => {
    const safeName = (formData?.nome_completo || "cnh-fisica")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${safeName || "cnh-fisica"}.pdf`;
  }, [formData]);

  if (!pdfBase64 || !formData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/cnh-fisica/todos")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao formulário
        </Button>
      </div>
    );
  }

  const getPdfBlob = async () => fetch(pdfBase64).then((r) => r.blob());

  const downloadPdf = async () => {
    const blob = await getPdfBlob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const openPdf = async () => {
    const blob = await getPdfBlob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

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
      deductCredit();

      addDocument({
        name: formData.nome_completo || "",
        identification: formData.cpf || "",
        date: formData.data_emissao || "",
        description: `CNH Física ${formData.estado_fisica || ""} - Cat ${formData.categoria || ""}`,
        additionalInfo: JSON.stringify(formData),
        type: "cnh-fisica",
        userId: user.id,
      });

      setPaid(true);
      await downloadPdf();
      toast({
        title: "Documento gerado com sucesso!",
        description: "1 crédito foi descontado e o PDF foi baixado no seu dispositivo.",
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

  const handleShare = async () => {
    try {
      const blob = await getPdfBlob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "CNH Física" });
      } else {
        await downloadPdf();
        toast({ title: "PDF baixado com sucesso!" });
      }
    } catch {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  const handleDownload = async () => {
    try {
      await downloadPdf();
      toast({ title: "PDF baixado com sucesso!" });
    } catch {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/dashboard/cnh-fisica/todos")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        {paid ? "Documento Gerado" : "Preview do Documento"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {paid
          ? "Seu documento foi baixado e também pode ser visualizado ou compartilhado novamente."
          : "Confira o preview abaixo. Para gerar o documento final, clique em Gerar (1 crédito)."}
      </p>

      <div className="relative glass rounded-xl overflow-hidden mb-6" style={{ height: "70vh" }}>
        <iframe
          src={pdfBase64}
          className="w-full h-full border-0"
          title="PDF Preview"
        />

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
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Button
              variant="gradient"
              className="flex-1 h-12 rounded-xl font-semibold"
              onClick={handleView}
            >
              <Eye className="w-5 h-5 mr-2" /> Ver PDF
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl font-semibold"
              onClick={handleShare}
            >
              <Share2 className="w-5 h-5 mr-2" /> Compartilhar
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl font-semibold"
            onClick={downloadPdf}
          >
            <Download className="w-5 h-5 mr-2" /> Baixar PDF
          </Button>
        </div>
      )}
    </div>
  );
}
