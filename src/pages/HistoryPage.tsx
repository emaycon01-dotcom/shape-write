import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Download, QrCode, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";

export default function HistoryPage() {
  const { user } = useAuth();
  const { documents } = useDocuments();
  const userDocs = documents.filter((d) => d.userId === user?.id);

  const generatePDF = (doc: typeof documents[0]) => {
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text("BELLARUS SISTEMAS", 105, 20, { align: "center" });
    pdf.setFontSize(12);
    pdf.text(`Documento: ${doc.type.toUpperCase()}`, 20, 40);
    pdf.text(`ID: ${doc.id}`, 20, 50);
    pdf.text(`Nome: ${doc.name}`, 20, 60);
    pdf.text(`Identificação: ${doc.identification}`, 20, 70);
    pdf.text(`Data: ${doc.date}`, 20, 80);
    pdf.text(`Descrição: ${doc.description}`, 20, 90);
    pdf.text(`Info Adicional: ${doc.additionalInfo}`, 20, 100);
    pdf.text(`Criado em: ${new Date(doc.createdAt).toLocaleString("pt-BR")}`, 20, 110);
    pdf.text(`Status: ${doc.status}`, 20, 120);
    pdf.text(`Verificação: ${window.location.origin}/verify/${doc.id}`, 20, 140);
    pdf.save(`documento-${doc.id}.pdf`);
  };

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
            <div key={doc.id} className="glass rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display font-semibold text-foreground">{doc.type.toUpperCase()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${doc.status === "ativo" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                    {doc.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{doc.name} · ID: {doc.id}</p>
                <p className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleString("pt-BR")}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => generatePDF(doc)}>
                  <Download className="w-4 h-4" /> PDF
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/verify/${doc.id}`} target="_blank">
                    <ExternalLink className="w-4 h-4" /> Verificar
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
