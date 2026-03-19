import { PDFDocument } from "pdf-lib";

/**
 * Takes a PDF data URI string, adds metadata markers,
 * and returns a new data URI string.
 * 
 * Note: pdf-lib doesn't support native PDF encryption.
 * This function adds metadata to indicate the document origin.
 */
export async function protectPdf(pdfDataUrl: string): Promise<string> {
  try {
    const base64 = pdfDataUrl.split(",")[1];
    if (!base64) return pdfDataUrl;
    
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    
    pdfDoc.setTitle("Documento - Bellarus");
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
    return pdfDataUrl;
  }
}
