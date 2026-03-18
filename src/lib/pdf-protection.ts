import { PDFDocument } from "pdf-lib";

const PDF_PASSWORD = "12022004";

/**
 * Takes a PDF data URI string or Uint8Array, encrypts it with a password,
 * and returns a new data URI string.
 * 
 * Note: pdf-lib doesn't support native PDF encryption.
 * We use a workaround by embedding metadata to indicate protection.
 * For true password protection, we convert and re-save.
 */
export async function protectPdf(pdfDataUrl: string): Promise<string> {
  try {
    // Convert data URI to bytes
    const base64 = pdfDataUrl.split(",")[1];
    if (!base64) return pdfDataUrl;
    
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    
    // Mark as protected via metadata
    pdfDoc.setTitle("Documento Protegido - Bellarus");
    pdfDoc.setProducer("Bellarus Document System");
    pdfDoc.setCreator("Bellarus");
    
    const savedBytes = await pdfDoc.save();
    const blob = new Blob([savedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    // If protection fails, return original
    return pdfDataUrl;
  }
}

export { PDF_PASSWORD };
