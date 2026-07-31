import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments, Document, isDocumentExpired, daysUntilExpiry } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Pencil,
  Share2,
  Download,
  QrCode,
  CreditCard,
  Loader2,
  RefreshCw,
  Clock,
  AlertTriangle,
  Trash2,
  User,
  IdCard,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { DOCUMENT_FORM_ROUTES, DOCUMENT_TYPE_LABELS } from "@/lib/document-routes";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { supabase } from "@/integrations/supabase/client";
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

const EDIT_COST_BASE = 0.3;
const RENEW_COST_BASE = 1;
const RENEW_DAYS = 30;

function formatCpf(value: string) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length !== 11) return value || "—";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function HistoryPage() {
  const { user, deductCredit } = useAuth();
  const { documents, loading, renewDocument, deleteDocument, loadDocumentInfo } = useDocuments();
  const navigate = useNavigate();
  const { toast } = useToast();

  const EDIT_COST = planCost(EDIT_COST_BASE, user?.plano);
  const RENEW_COST = planCost(RENEW_COST_BASE, user?.plano);

  const userDocs = useMemo(
    () => documents.filter((d) => d.userId === user?.id),
    [documents, user?.id]
  );

  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const requested = useRef<Set<string>>(new Set());

  // Carrega as fotos em segundo plano (payload pesado fica fora da listagem)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const doc of userDocs) {
        if (cancelled) return;
        if (requested.current.has(doc.id)) continue;
        requested.current.add(doc.id);
        try {
          const raw = doc.additionalInfo || (await loadDocumentInfo(doc.id));
          if (cancelled) return;
          const parsed = raw ? JSON.parse(raw) : {};
          const foto = parsed?.fotoBase64 || parsed?.foto_base64 || null;
          setPhotos((prev) => ({ ...prev, [doc.id]: typeof foto === "string" && foto ? foto : null }));
        } catch {
          setPhotos((prev) => ({ ...prev, [doc.id]: null }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userDocs, loadDocumentInfo]);

  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [renewDoc, setRenewDoc] = useState<Document | null>(null);
  const [renewLoading, setRenewLoading] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Busca o PDF direto do armazenamento (blob local) — nada de abrir link externo
  const fetchPdfBlob = async (doc: Document): Promise<Blob | null> => {
    const { data } = await supabase.storage.from("documents-pdf").download(`${doc.id}.pdf`);
    if (data) return data;
    if (doc.pdfUrl) {
      try {
        const res = await fetch(doc.pdfUrl);
        if (res.ok) return await res.blob();
      } catch {
        /* ignore */
      }
    }
    return null;
  };

  const handleView = async (doc: Document) => {
    const blob = await fetchPdfBlob(doc);
    if (!blob) {
      toast({ title: "Não foi possível abrir o PDF", variant: "destructive" });
      return;
    }
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const handleDownload = async (doc: Document) => {
    const blob = await fetchPdfBlob(doc);
    if (!blob) {
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
      return;
    }
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${doc.type}-${doc.id}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    toast({ title: "PDF baixado com sucesso!" });
  };

  const handleShare = async (doc: Document) => {
    const blob = await fetchPdfBlob(doc);
    if (!blob) {
      toast({ title: "Erro ao compartilhar", variant: "destructive" });
      return;
    }
    const file = new File([blob], `${doc.type}-${doc.id}.pdf`, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: DOCUMENT_TYPE_LABELS[doc.type] || doc.type });
    } else {
      handleDownload(doc);
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

  const handleEdit = async () => {
    if (!editDoc || !user) return;
    setEditLoading(true);

    const route = DOCUMENT_FORM_ROUTES[editDoc.type];
    if (!route) {
      toast({ title: "Tipo de documento não suporta edição", variant: "destructive" });
      setEditLoading(false);
      setEditDoc(null);
      return;
    }

    const deduction = await deductCredit(EDIT_COST_BASE, "edicao-documento");
    if (!deduction.ok) {
      toast({ title: "Não foi possível editar", description: deduction.error, variant: "destructive" });
      setEditLoading(false);
      setEditDoc(null);
      return;
    }
    toast({
      title: "Edição liberada!",
      description: EDIT_COST > 0 ? `${formatCredits(EDIT_COST)} crédito(s) descontado(s).` : "Gratuito pelo seu plano.",
    });

    const id = editDoc.id;
    setEditLoading(false);
    setEditDoc(null);
    navigate(route, { state: { editDocId: id } });
  };

  const confirmRenew = (doc: Document) => {
    if (!user) return;
    if (user.credits < RENEW_COST) {
      toast({
        title: "Créditos insuficientes",
        description: `Você precisa de pelo menos ${RENEW_COST} crédito(s) para renovar. Saldo atual: ${user.credits}`,
        variant: "destructive",
      });
      return;
    }
    setRenewDoc(doc);
  };

  const handleRenew = async () => {
    if (!renewDoc || !user) return;
    setRenewLoading(true);
    try {
      const deduction = await deductCredit(RENEW_COST, "renovacao-documento");
      if (!deduction.ok) {
        toast({ title: "Não foi possível renovar", description: deduction.error, variant: "destructive" });
        return;
      }
      await renewDocument(renewDoc.id);
      toast({
        title: "Documento renovado!",
        description: `${RENEW_COST} crédito descontado. Válido por mais ${RENEW_DAYS} dias.`,
      });
    } catch {
      toast({ title: "Erro ao renovar documento", variant: "destructive" });
    } finally {
      setRenewLoading(false);
      setRenewDoc(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setDeleteLoading(true);
    try {
      await deleteDocument(deleteDoc.id);
      toast({ title: "Documento removido" });
    } catch {
      toast({ title: "Erro ao remover documento", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteDoc(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
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
        <div className="grid gap-4">
          {userDocs.map((doc) => {
            const expired = isDocumentExpired(doc);
            const daysLeft = daysUntilExpiry(doc);
            const photo = photos[doc.id];

            return (
              <article
                key={doc.id}
                className={`glass rounded-2xl overflow-hidden border transition-colors ${
                  expired ? "border-destructive/40" : "border-border/60 hover:border-primary/40"
                }`}
              >
                <div className="flex gap-4 p-4">
                  {/* Foto 3x4 */}
                  <div className="shrink-0">
                    <div className="w-[72px] h-[96px] rounded-lg overflow-hidden bg-muted/40 border border-border/60 flex items-center justify-center">
                      {photo ? (
                        <img
                          src={photo}
                          alt={`Foto 3x4 de ${doc.name}`}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-7 h-7 text-muted-foreground/60" />
                      )}
                    </div>
                  </div>

                  {/* Dados */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-primary/15 text-primary">
                        {DOCUMENT_TYPE_LABELS[doc.type] || doc.type.toUpperCase()}
                      </span>
                      {expired ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-destructive/20 text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Expirado
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-success/20 text-success">Ativo</span>
                      )}
                    </div>

                    <h2 className="font-display font-semibold text-foreground truncate">{doc.name || "—"}</h2>

                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <IdCard className="w-3.5 h-3.5 shrink-0" />
                      CPF: {formatCpf(doc.identification)}
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      ID: {doc.id} · {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                    </p>

                    {!expired && daysLeft <= 10 && (
                      <p className="text-xs flex items-center gap-1 mt-1" style={{ color: "hsl(38, 92%, 50%)" }}>
                        <Clock className="w-3 h-3" /> Expira em {daysLeft} dia(s)
                      </p>
                    )}
                    {expired && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" /> Expirou em {new Date(doc.expiresAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2 px-4 pb-4 pt-1 border-t border-border/40 mt-1">
                  {!expired && doc.pdfUrl && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleView(doc)} className="gap-1.5">
                        <Eye className="w-4 h-4" /> Ver
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownload(doc)} className="gap-1.5">
                        <Download className="w-4 h-4" /> Baixar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleShare(doc)} className="gap-1.5">
                        <Share2 className="w-4 h-4" /> Compartilhar
                      </Button>
                    </>
                  )}

                  {!expired && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => confirmEdit(doc)}
                      className="gap-1.5"
                      disabled={!DOCUMENT_FORM_ROUTES[doc.type]}
                    >
                      <Pencil className="w-4 h-4" /> Editar
                      <span className="text-xs text-muted-foreground">({EDIT_COST})</span>
                    </Button>
                  )}

                  <Button variant="gradient" size="sm" onClick={() => confirmRenew(doc)} className="gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Renovar
                    <span className="text-xs opacity-80">({RENEW_COST} créd.)</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDoc(doc)}
                    className="gap-1.5 text-destructive hover:text-destructive border-destructive/40 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" /> Remover
                  </Button>
                </div>
              </article>
            );
          })}
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEdit} disabled={editLoading}>
              {editLoading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processando...</>
              ) : (
                <>Confirmar ({EDIT_COST} créd.)</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renew confirmation dialog */}
      <AlertDialog open={!!renewDoc} onOpenChange={(open) => !open && setRenewDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" /> Renovar Documento
            </AlertDialogTitle>
            <AlertDialogDescription>
              A renovação custará <strong>{RENEW_COST} crédito</strong> e o documento ficará mais{" "}
              <strong>{RENEW_DAYS} dias</strong> no sistema.
              <br />
              Seu saldo atual: <strong>{user?.credits ?? 0} crédito(s)</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenew} disabled={renewLoading}>
              {renewLoading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Renovando...</>
              ) : (
                <>Renovar ({RENEW_COST} créd.)</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Remover Documento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O documento <strong>{deleteDoc?.name}</strong> (ID: {deleteDoc?.id}) e seu PDF
              serão excluídos do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Removendo...</>
              ) : (
                <>Remover</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
