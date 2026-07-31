import { useParams } from "react-router-dom";
import { useDocuments } from "@/contexts/DocumentContext";
import { QRCodeSVG } from "qrcode.react";
import { Shield, CheckCircle, XCircle } from "lucide-react";
import logo from "@/assets/logo.webp";

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const { getDocument } = useDocuments();
  const doc = id ? getDocument(id) : undefined;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
        <img src={logo} alt="Bellarus" className="w-16 h-16 mx-auto mb-4" />

        {doc ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/20 text-success text-sm mb-4">
              <CheckCircle className="w-4 h-4" />
              Documento Verificado
            </div>

            <div className="bg-foreground rounded-xl p-4 inline-block mb-6">
              <QRCodeSVG
                value={`${window.location.origin}/verify/${doc.id}`}
                size={160}
                bgColor="#ffffff"
                fgColor="#0A0F1C"
              />
            </div>

            <div className="space-y-3 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ID do Documento</span>
                <span className="text-foreground font-mono">{doc.id}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tipo</span>
                <span className="text-foreground">{doc.type.toUpperCase()}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nome</span>
                <span className="text-foreground">{doc.name}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data de Criação</span>
                <span className="text-foreground">{new Date(doc.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="text-success font-medium">{doc.status}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/20 text-destructive text-sm mb-4">
              <XCircle className="w-4 h-4" />
              Documento Não Encontrado
            </div>
            <p className="text-muted-foreground text-sm">
              O documento com ID <span className="font-mono text-foreground">{id}</span> não foi encontrado no sistema.
            </p>
          </>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3 h-3" />
          Verificado por Bellarus Sistemas
        </div>
      </div>
    </div>
  );
}
