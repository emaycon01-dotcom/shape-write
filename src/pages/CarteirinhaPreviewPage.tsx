import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Share2, ArrowLeft, Loader2, CreditCard, Lock, Download, IdCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CREDIT_COST = 1.5;

export default function CarteirinhaPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, deductCredit } = useAuth();
  const { addDocument } = useDocuments();
  const { toast } = useToast();

  const { formData } = (location.state as { formData: Record<string, string> }) || {};
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);

  const tipo = formData?.tipo || "bombeiro";
  const tipoLabel = formData?.tipoLabel || "Carteirinha";

  const fileName = useMemo(() => {
    const safeName = (formData?.nomeCompleto || tipo)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${safeName || "carteirinha"}.pdf`;
  }, [formData, tipo]);

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
      // Deduct 1.5 credits (deductCredit is called once for 1, we handle 1.5)
      deductCredit(CREDIT_COST);

      addDocument({
        name: formData.nomeCompleto || "",
        identification: formData.cpf || "",
        date: formData.dataFormacao || "",
        description: `${tipoLabel} - ${formData.cidade || ""}, ${formData.uf || ""}`,
        additionalInfo: JSON.stringify(formData),
        type: `carteirinha-${tipo}`,
        userId: user.id,
      });

      setPaid(true);
      toast({
        title: "Documento gerado com sucesso!",
        description: `${CREDIT_COST} créditos foram descontados.`,
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
    // PDF generation will be implemented when templates are provided
    toast({ title: "PDF será gerado quando o template estiver disponível", description: "Envie o PDF template para ativar a geração." });
  };

  const handleShare = async () => {
    toast({ title: "Compartilhamento será ativado com o template de PDF" });
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
          ? "Seu documento foi gerado e pode ser baixado ou compartilhado."
          : `Confira os dados abaixo. Para gerar o documento final, clique em Gerar (${CREDIT_COST} créditos).`}
      </p>

      {/* Preview Card */}
      <div className="glass rounded-xl overflow-hidden mb-6 p-6">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/50">
          <IdCard className="w-6 h-6 text-primary" />
          <h2 className="font-display font-bold text-foreground">{tipoLabel}</h2>
        </div>

        <div className="flex gap-6">
          {formData.foto_base64 && (
            <img
              src={formData.foto_base64}
              alt="Foto 3x4"
              className="w-24 h-32 object-cover rounded-lg border border-border shrink-0"
            />
          )}

          <div className="flex-1 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nº Registro:</span>{" "}
              <span className="font-semibold text-foreground">{formData.numeroRegistro}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Nome:</span>{" "}
              <span className="font-semibold text-foreground">{formData.nomeCompleto}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CPF:</span>{" "}
              <span className="font-semibold text-foreground">{formData.cpf}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Nascimento:</span>{" "}
              <span className="font-semibold text-foreground">{formData.dataNascimento}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Cidade/UF:</span>{" "}
              <span className="font-semibold text-foreground">{formData.cidade}, {formData.uf}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Formação:</span>{" "}
              <span className="font-semibold text-foreground">{formData.dataFormacao}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Emergência 1:</span>{" "}
              <span className="font-semibold text-foreground">{formData.contatoEmergencia1}</span>
            </div>
            {formData.contatoEmergencia2 && (
              <div>
                <span className="text-muted-foreground">Emergência 2:</span>{" "}
                <span className="font-semibold text-foreground">{formData.contatoEmergencia2}</span>
              </div>
            )}
          </div>
        </div>

        {!paid && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground italic">
              * O PDF final será gerado sobre o template oficial após confirmação do pagamento.
            </p>
          </div>
        )}
      </div>

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
