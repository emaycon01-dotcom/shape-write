/** Converte um PDF Data URL em Blob sem usar fetch(dataUrl), instável no Safari. */
export function pdfDataUrlToBlob(value: string): Blob | null {
  try {
    const comma = value.indexOf(",");
    if (comma < 0) return null;
    const mime = value.slice(0, comma).match(/^data:([^;,]+)/)?.[1] || "application/pdf";
    const encoded = value.slice(comma + 1);
    const chunks: Uint8Array[] = [];
    const chunkSize = 1_048_576;
    for (let offset = 0; offset < encoded.length; offset += chunkSize) {
      const binary = atob(encoded.slice(offset, offset + chunkSize));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      chunks.push(bytes);
    }
    return new Blob(chunks, { type: mime });
  } catch {
    return null;
  }
}