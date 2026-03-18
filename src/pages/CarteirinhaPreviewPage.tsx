import { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Share2, ArrowLeft, Loader2, CreditCard, Lock, Download, IdCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";

const CREDIT_COST = 1.5;

async function splitPdfPages(pdfBase64: string): Promise<string[]> {
  const raw = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const srcDoc = await PDFDocument.load(bytes);
  const pageCount = srcDoc.getPageCount();
  const urls: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copied] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copied);
    const newBytes = await newDoc.save();
    const blob = new Blob([newBytes.buffer as ArrayBuffer], { type: "application/pdf" });
    urls.push(URL.createObjectURL(blob));
  }
  return urls;
}

export default function CarteirinhaPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const { pdfBase64, formData } = (location.state as {
    pdfBase64?: string;
    formData: Record<string, string>;
  }) || {};

  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);

  const tipo = formData?.tipo || "bombeiro";
  const tipoLabel = formData?.tipoLabel || "Carteirinha";
  const isMultiPage = tipo === "bombeiro-militar" || tipo === "operador-maquinas" || tipo === "seguranca-escolar";

  const fileName = useMemo(() => {
    const safeName = (formData?.nomeCompleto || tipo)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${safeName || "carteirinha"}.pdf`;
  }, [formData, tipo]);

  // Convert base64 to blob URL(s)
  useEffect(() => {
    if (!pdfBase64) return;

    if (isMultiPage) {
      splitPdfPages(pdfBase64).then((urls) => {
        setPageUrls(urls);
      });
    } else {
      fetch(pdfBase64)
        .then((r) => r.blob())
        .then((blob) => {
          setBlobUrl(URL.createObjectURL(blob));
        });
    }

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      pageUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [pdfBase64]);

  if (!formData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Nenhum preview disponível.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/documentos-fisicos/carteirinhas")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const getPdfBlob = async () => fetch(pdfBase64!).then((r) => r.blob());

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

  const handleGenerate = async () => {
    if (!user) return;
    if (user.credits < CREDIT_COST) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de pelo menos ${CREDIT_COST} créditos para gerar o documento.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      deductCredit(CREDIT_COST);

      await addDocument({
        name: formData.nomeCompleto || "",
        identification: formData.cpf || "",
        date: formData.dataFormacao || "",
        description: `${tipoLabel} - ${formData.cidade || ""}, ${formData.uf || ""}`,
        additionalInfo: JSON.stringify(formData),
        type: `carteirinha-${tipo}`,
        userId: user.id,
      });

      setPaid(true);
      await downloadPdf();
      toast({
        title: "Documento gerado com sucesso!",
        description: `${CREDIT_COST} créditos foram descontados e o PDF foi baixado.`,
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

  const handleDownload = async () => {
    try {
      await downloadPdf();
      toast({ title: "PDF baixado com sucesso!" });
    } catch {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    try {
      const blob = await getPdfBlob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: tipoLabel });
      } else {
        await downloadPdf();
        toast({ title: "PDF baixado com sucesso!" });
      }
    } catch {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(`/dashboard/documentos-fisicos/carteirinhas/${tipo}`)}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao formulário
      </button>

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">
        {paid ? "Documento Gerado" : "Preview do Documento"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        {paid
          ? "Seu documento foi baixado e pode ser visualizado ou compartilhado novamente."
          : `Confira o preview abaixo. Para gerar o documento final, clique em Gerar (${CREDIT_COST} créditos).`}
      </p>

      {/* PDF Preview - Bombeiro Militar (frente + verso) */}
      {isMultiPage && pageUrls.length > 0 && (
        <div className="space-y-4 mb-6">
          {pageUrls.map((url, idx) => (
            <div key={idx} className="relative glass rounded-xl overflow-hidden" style={{ height: "35vh" }}>
              <div className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm text-xs font-semibold text-foreground px-2 py-1 rounded">
                {tipo === "seguranca-escolar" ? (idx === 0 ? "Frente" : "Verso") : (idx === 0 ? "Verso" : "Frente")}
              </div>
              <iframe
                src={url}
                className="w-full h-full border-0"
                title={`PDF Preview - ${idx === 0 ? "Verso" : "Frente"}`}
              />
              {!paid && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none flex items-center justify-center">
                  <div className="absolute inset-0" style={{
                    background: "repeating-linear-gradient(-45deg, transparent, transparent 80px, hsl(var(--destructive) / 0.06) 80px, hsl(var(--destructive) / 0.06) 82px)",
                  }} />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute text-destructive/20 font-bold whitespace-nowrap select-none"
                      style={{
                        fontSize: "14px",
                        transform: `rotate(-35deg)`,
                        top: `${10 + (i % 3) * 30}%`,
                        left: `${-10 + Math.floor(i / 3) * 50}%`,
                        letterSpacing: "2px",
                      }}
                    >
                      PROPRIEDADE BELLARUS NÃO COPIE
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PDF Preview - outros tipos */}
      {!isMultiPage && blobUrl && (
        <div className="relative glass rounded-xl overflow-hidden mb-6" style={{ height: "70vh" }}>
          <iframe
            src={blobUrl}
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
      )}

      {!paid ? (
        <div className="space-y-3">
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Custo: {CREDIT_COST} créditos</p>
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
              <><CreditCard className="w-5 h-5 mr-2" /> Gerar Documento ({CREDIT_COST} créditos)</>
            )}
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
