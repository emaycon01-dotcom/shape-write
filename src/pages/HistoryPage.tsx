import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments, Document } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Share2, Download, QrCode, CreditCard, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { DOCUMENT_FORM_ROUTES, DOCUMENT_TYPE_LABELS } from "@/lib/document-routes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EDIT_COST = 0.3;

export default function HistoryPage() {
  const { user, deductCredit } = useAuth();
  const { documents, loading } = useDocuments();
  const navigate = useNavigate();
  const { toast } = useToast();
  const userDocs = documents.filter((d) => d.userId === user?.id);

  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const handleView = (doc: Document) => {
    if (doc.pdfUrl) {
      window.open(doc.pdfUrl, "_blank");
    }
  };

  const handleDownload = async (doc: Document) => {
    if (!doc.pdfUrl) return;
    try {
      const res = await fetch(doc.pdfUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${doc.type}-${doc.id}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      toast({ title: "PDF baixado com sucesso!" });
    } catch {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    }
  };

  const handleShare = async (doc: Document) => {
    if (!doc.pdfUrl) return;
    try {
      const res = await fetch(doc.pdfUrl);
      const blob = await res.blob();
      const fileName = `${doc.type}-${doc.id}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: DOCUMENT_TYPE_LABELS[doc.type] || doc.type });
      } else {
        // Fallback to download
        handleDownload(doc);
      }
    } catch {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
    }
  };

  const confirmEdit = (doc: Document) => {
    if (!user) return;
    if (user.credits < EDIT_COST) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de pelo menos ${EDIT_COST} crédito(s) para editar. Saldo atual: ${user.credits}`,
        variant: "destructive",
      });
      return;
    }
    setEditDoc(doc);
  };

  const handleEdit = () => {
    if (!editDoc || !user) return;
    setEditLoading(true);

    const route = DOCUMENT_FORM_ROUTES[editDoc.type];
    if (!route) {
      toast({ title: "Tipo de documento não suporta edição", variant: "destructive" });
      setEditLoading(false);
      setEditDoc(null);
      return;
    }

    deductCredit(EDIT_COST);
    toast({ title: "Edição liberada!", description: `${EDIT_COST} crédito(s) descontado(s).` });

    let formData: Record<string, string> = {};
    try {
      formData = JSON.parse(editDoc.additionalInfo || "{}");
    } catch { /* ignore */ }

    setEditLoading(false);
    setEditDoc(null);

    navigate(route, { state: { editFormData: formData, editDocId: editDoc.id } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">Histórico</h1>
      <p className="text-muted-foreground mb-8">{userDocs.length} documento(s) gerado(s)</p>

      {userDocs.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum documento gerado ainda.</p>
          <Button variant="gradient" className="mt-4" asChild>
            <Link to="/dashboard/documents">Criar Documento</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {userDocs.map((doc) => (
            <div key={doc.id} className="glass rounded-xl p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-display font-semibold text-foreground">
                      {DOCUMENT_TYPE_LABELS[doc.type] || doc.type.toUpperCase()}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        doc.status === "ativo"
                          ? "bg-success/20 text-success"
                          : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{doc.name} · ID: {doc.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {doc.pdfUrl ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleView(doc)} className="gap-1.5">
                      <Eye className="w-4 h-4" /> Ver PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownload(doc)} className="gap-1.5">
                      <Download className="w-4 h-4" /> Baixar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleShare(doc)} className="gap-1.5">
                      <Share2 className="w-4 h-4" /> Compartilhar
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" disabled className="gap-1.5">
                    <Eye className="w-4 h-4" /> Sem PDF
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => confirmEdit(doc)}
                  className="gap-1.5"
                  disabled={!DOCUMENT_FORM_ROUTES[doc.type]}
                >
                  <Pencil className="w-4 h-4" /> Editar
                  <span className="text-xs text-muted-foreground">({EDIT_COST} créd.)</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit confirmation dialog */}
      <AlertDialog open={!!editDoc} onOpenChange={(open) => !open && setEditDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Confirmar Edição
            </AlertDialogTitle>
            <AlertDialogDescription>
              A edição deste documento custará <strong>{EDIT_COST} crédito(s)</strong>.
              <br />
              Seu saldo atual: <strong>{user?.credits ?? 0} crédito(s)</strong>.
              <br /><br />
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEdit} disabled={editLoading}>
              {editLoading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processando...</>
              ) : (
                <>Confirmar Edição ({EDIT_COST} créd.)</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
