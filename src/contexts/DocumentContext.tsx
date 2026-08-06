import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Document {
  id: string;
  type: string;
  name: string;
  identification: string;
  date: string;
  description: string;
  additionalInfo: string;
  createdAt: string;
  expiresAt: string;
  status: "ativo" | "revogado" | "expirado";
  userId: string;
  pdfUrl?: string;
}

export function isDocumentExpired(doc: Document): boolean {
  return new Date(doc.expiresAt) <= new Date();
}

export function daysUntilExpiry(doc: Document): number {
  const diff = new Date(doc.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

interface DocumentContextType {
  documents: Document[];
  loading: boolean;
  addDocument: (doc: Omit<Document, "id" | "createdAt" | "status" | "expiresAt"> & { pdfDataUrl?: string }) => Promise<Document>;
  getDocument: (id: string) => Document | undefined;
  loadDocumentInfo: (id: string) => Promise<string>;
  renewDocument: (id: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  updateDocument: (id: string, updates: { additionalInfo?: string; pdfDataUrl?: string }) => Promise<void>;
  refreshDocuments: () => Promise<void>;
}


const DocumentContext = createContext<DocumentContextType | null>(null);

/**
 * Converte Data URL sem entregá-la ao fetch(). Safari/WebViews podem recusar
 * URLs de vários megabytes; decodificar em blocos também reduz o pico de
 * memória durante o salvamento no histórico.
 */
function pdfDataUrlToBlob(value: string): Blob {
  if (!value.startsWith("data:")) throw new Error("PDF inválido para armazenamento.");
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("PDF inválido para armazenamento.");
  const header = value.slice(0, comma);
  const mime = header.match(/^data:([^;,]+)/)?.[1] || "application/pdf";
  const encoded = value.slice(comma + 1);
  const parts: BlobPart[] = [];
  const chunkSize = 1_048_576; // múltiplo de 4, preserva blocos base64
  for (let offset = 0; offset < encoded.length; offset += chunkSize) {
    const binary = atob(encoded.slice(offset, offset + chunkSize));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    parts.push(bytes.buffer as ArrayBuffer);
  }
  return new Blob(parts, { type: mime });
}

async function uploadPdfToStorage(pdfDataUrl: string, docId: string, userId?: string): Promise<string | null> {
  try {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;

    const blob = pdfDataUrlToBlob(pdfDataUrl);
    // Caminho isolado por usuário: garante que ninguém acesse o PDF de outro
    const filePath = `${uid}/${docId}.pdf`;

    let uploadError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await supabase.storage
        .from("documents-pdf")
        .upload(filePath, blob, { contentType: "application/pdf", upsert: true });
      uploadError = error;
      if (!error) break;
      await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
    }

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from("documents-pdf")
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    return urlError ? null : urlData.signedUrl;
  } catch (err) {
    console.error("Failed to upload PDF:", err);
    return null;
  }
}

function mapRow(row: any): Document {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    identification: row.identification,
    date: row.date,
    description: row.description,
    additionalInfo: row.additional_info ?? "",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status as Document["status"],
    userId: row.user_id,
    pdfUrl: row.pdf_url || undefined,
  };
}

// Colunas leves: evita trazer `additional_info` (que contém fotos em base64)
const LIST_COLUMNS =
  "id,type,name,identification,date,description,created_at,expires_at,status,user_id,pdf_url";

const DOCS_CACHE_KEY = "documents_cache";

/**
 * O template já existe nos assets do app e o PDF final já é salvo no Storage.
 * Persisti-lo novamente dentro de `additional_info` criava uma terceira cópia
 * de vários MB por documento e tornava histórico/edição progressivamente mais
 * pesados. Fotos e assinaturas são preservadas porque ainda são necessárias ao
 * reabrir um formulário para edição.
 */
function stripEmbeddedTemplates(additionalInfo: string): string {
  if (!additionalInfo) return additionalInfo;
  try {
    const value = JSON.parse(additionalInfo) as Record<string, unknown>;
    delete value.template_base64;
    delete value.template_p1_base64;
    delete value.template_p2_base64;
    return JSON.stringify(value);
  } catch {
    return additionalInfo;
  }
}

function readCachedDocs(): Document[] {
  try {
    const raw = sessionStorage.getItem(DOCS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Document[]) : [];
  } catch {
    return [];
  }
}

function writeCachedDocs(docs: Document[]) {
  try {
    sessionStorage.setItem(DOCS_CACHE_KEY, JSON.stringify(docs));
  } catch {
    /* ignore */
  }
}

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  // Mostra imediatamente a última listagem conhecida e atualiza em segundo plano
  const [documents, setDocuments] = useState<Document[]>(() => readCachedDocs());
  const [loading, setLoading] = useState(() => readCachedDocs().length === 0);

  const fetchDocuments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select(LIST_COLUMNS)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching documents:", error);
        return;
      }

      const mapped = (data || []).map(mapRow);
      setDocuments(mapped);
      writeCachedDocs(mapped);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDocumentInfo = useCallback(async (id: string): Promise<string> => {
    const { data, error } = await supabase
      .from("documents")
      .select("additional_info")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return "";
    const info = data.additional_info ?? "";
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, additionalInfo: info } : d)));
    return info;
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      console.error("Error deleting document:", error);
      throw error;
    }
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      supabase.storage
        .from("documents-pdf")
        .remove([uid ? `${uid}/${id}.pdf` : `${id}.pdf`, `${id}.pdf`])
        .catch(() => {});
    });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);


  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const addDocument = useCallback(
    async (doc: Omit<Document, "id" | "createdAt" | "status" | "expiresAt"> & { pdfDataUrl?: string }): Promise<Document> => {
      const docId = crypto.randomUUID().split("-")[0].toUpperCase();

      let pdfUrl: string | null = null;
      if (doc.pdfDataUrl) {
        pdfUrl = await uploadPdfToStorage(doc.pdfDataUrl, docId, doc.userId);
      }

      const row = {
        id: docId,
        type: doc.type,
        name: doc.name,
        identification: doc.identification,
        date: doc.date,
        description: doc.description,
        additional_info: stripEmbeddedTemplates(doc.additionalInfo),
        status: "ativo",
        user_id: doc.userId,
        pdf_url: pdfUrl,
      };

      const { data, error } = await supabase
        .from("documents")
        .insert(row)
        .select()
        .single();

      if (error) {
        console.error("Error inserting document:", error);
        const fallback: Document = {
          ...doc,
          id: docId,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
          status: "ativo",
          pdfUrl: pdfUrl || undefined,
        };
        setDocuments((prev) => [fallback, ...prev]);
        return fallback;
      }

      const newDoc = mapRow(data);
      setDocuments((prev) => [newDoc, ...prev]);
      return newDoc;
    },
    []
  );

  const updateDocument = useCallback(async (id: string, updates: { additionalInfo?: string; pdfDataUrl?: string }) => {
    let pdfUrl: string | null = null;
    if (updates.pdfDataUrl) {
      pdfUrl = await uploadPdfToStorage(updates.pdfDataUrl, id);
    }

    const dbUpdates: Record<string, unknown> = {};
    if (updates.additionalInfo !== undefined) {
      dbUpdates.additional_info = stripEmbeddedTemplates(updates.additionalInfo);
    }
    if (pdfUrl) dbUpdates.pdf_url = pdfUrl;

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase
        .from("documents")
        .update(dbUpdates)
        .eq("id", id);

      if (error) {
        console.error("Error updating document:", error);
        throw error;
      }
    }

    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              ...(updates.additionalInfo !== undefined ? { additionalInfo: updates.additionalInfo } : {}),
              ...(pdfUrl ? { pdfUrl } : {}),
            }
          : d
      )
    );
  }, []);

  const renewDocument = useCallback(async (id: string) => {
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("documents")
      .update({ expires_at: newExpiresAt, status: "ativo" })
      .eq("id", id);

    if (error) {
      console.error("Error renewing document:", error);
      throw error;
    }

    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, expiresAt: newExpiresAt, status: "ativo" as const } : d))
    );
  }, []);

  const getDocument = useCallback(
    (id: string) => documents.find((d) => d.id === id),
    [documents]
  );

  return (
    <DocumentContext.Provider value={{ documents, loading, addDocument, getDocument, loadDocumentInfo, renewDocument, deleteDocument, updateDocument, refreshDocuments: fetchDocuments }}>

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
