const SIGNATURE_WIDTH = 760;
const SIGNATURE_HEIGHT = 256;
const SIGNATURE_PADDING = 12;

/**
 * Recorta margens transparentes/brancas e encaixa a assinatura em uma tela
 * fixa. Assim, mesmo rasterizadores com suporte incompleto a object-fit nunca
 * conseguem desenhar pixels fora da caixa definida no alinhamento.
 */
export async function normalizeSignatureImage(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;

  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;
  await image.decode();

  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext || source.width === 0 || source.height === 0) return dataUrl;
  sourceContext.drawImage(image, 0, 0);

  const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4;
      const alpha = pixels.data[offset + 3];
      const red = pixels.data[offset];
      const green = pixels.data[offset + 1];
      const blue = pixels.data[offset + 2];
      const isVisibleInk = alpha > 20 && (red < 245 || green < 245 || blue < 245);
      if (!isVisibleInk) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return dataUrl;

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const availableWidth = SIGNATURE_WIDTH - SIGNATURE_PADDING * 2;
  const availableHeight = SIGNATURE_HEIGHT - SIGNATURE_PADDING * 2;
  const scale = Math.min(availableWidth / cropWidth, availableHeight / cropHeight);
  const drawWidth = cropWidth * scale;
  const drawHeight = cropHeight * scale;

  const output = document.createElement("canvas");
  output.width = SIGNATURE_WIDTH;
  output.height = SIGNATURE_HEIGHT;
  const outputContext = output.getContext("2d");
  if (!outputContext) return dataUrl;
  outputContext.clearRect(0, 0, output.width, output.height);
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(
    source,
    left,
    top,
    cropWidth,
    cropHeight,
    (SIGNATURE_WIDTH - drawWidth) / 2,
    (SIGNATURE_HEIGHT - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  source.width = 0;
  source.height = 0;
  return output.toDataURL("image/png");
}