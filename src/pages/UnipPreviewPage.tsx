import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Download, Share2, ArrowLeft, Loader2, CreditCard, Lock, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { describeError } from "@/lib/describe-error";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { readPreviewPayload } from "@/lib/preview-payload";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";

import { pdfDataUrlToBlob } from "@/lib/pdf-file";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";

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
  const [copied, setCopied] = useState(false);

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

      // Registra o diploma no validador oficial (é o que faz o QR Code funcionar)
      try {
        const { data: reg, error: regErr } = await withTimeout(
          supabase.functions.invoke("register-diploma-unip", {
            body: {
              documento_id: documentoId || codigoValidacao || formData.codigo_validacao || "",
              nome_aluno: formData.aluno || "",
              ra: formData.ra || "",
              curso_nome: formData.curso_completo || formData.curso || "",
              titulo_conferido: (formData.titulo_conferido || "").replace(/\s+a$/i, "").trim(),
              numero_registro: formData.registro_numero || "",
              livro: formData.registro_livro || "",
              fls: formData.registro_folha || "",
              processo: formData.processo || "",
              data_registro: formData.registro_data || "",
              dados_completos: formData.__form ? JSON.parse(formData.__form) : {},
              pdf_base64: pdfBase64,
            },
          }),
          40000,
          { data: null, error: new Error("tempo esgotado") } as never,
        );
        if (regErr || !reg?.success) throw new Error(regErr?.message || reg?.error || "falha no registro");

      } catch (e) {
        console.error("Falha ao registrar diploma no validador:", e);
        toast({
          title: "Documento gerado, mas o QR Code pode demorar",
          description: "Não foi possível registrar no validador agora. Tente reenviar mais tarde.",
          variant: "destructive",
        });
      }

      setPaid(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: cost > 0 ? `${formatCredits(cost)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
      });
    } catch (e) {
      toast({ title: "Erro ao gerar documento", description: `Nenhum crédito foi descontado. ${describeError(e)}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      const blob = pdfDataUrlToBlob(pdfBase64);
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
      const blob = pdfDataUrlToBlob(pdfBase64);
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
  const urlValidacao = validationUrl || `https://unipbrdiploma.site/validar?id=${encodeURIComponent(codigo)}`;
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
        <PdfCanvasPreview pdfDataUrl={pdfBase64} title="Preview do Diploma UNIP" />

        {!paid && (
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
