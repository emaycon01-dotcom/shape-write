import React, { createContext, useContext, useState, useCallback } from "react";

export interface Document {
  id: string;
  type: string;
  name: string;
  identification: string;
  date: string;
  description: string;
  additionalInfo: string;
  createdAt: string;
  status: "ativo" | "revogado" | "expirado";
  userId: string;
  pdfDataUrl?: string;
}

interface DocumentContextType {
  documents: Document[];
  addDocument: (doc: Omit<Document, "id" | "createdAt" | "status">) => Document;
  getDocument: (id: string) => Document | undefined;
}

const DocumentContext = createContext<DocumentContextType | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>(() => {
    const stored = localStorage.getItem("bellarus_docs");
    return stored ? JSON.parse(stored) : [];
  });

  const addDocument = useCallback(
    (doc: Omit<Document, "id" | "createdAt" | "status">) => {
      const newDoc: Document = {
        ...doc,
        id: crypto.randomUUID().split("-")[0].toUpperCase(),
        createdAt: new Date().toISOString(),
        status: "ativo",
      };
      setDocuments((prev) => {
        const updated = [newDoc, ...prev];
        localStorage.setItem("bellarus_docs", JSON.stringify(updated));
        return updated;
      });
      return newDoc;
    },
    []
  );

  const getDocument = useCallback(
    (id: string) => documents.find((d) => d.id === id),
    [documents]
  );

  return (
    <DocumentContext.Provider value={{ documents, addDocument, getDocument }}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  const ctx = useContext(DocumentContext);
  if (!ctx)
    throw new Error("useDocuments must be used within DocumentProvider");
  return ctx;
}
