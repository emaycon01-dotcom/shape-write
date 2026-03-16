import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, Download, Share2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function MesclagemRostoPage() {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [mergedImage, setMergedImage] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(80);
  const [volume, setVolume] = useState(0);   // -100 to 100
  const [faceSize, setFaceSize] = useState(0); // -100 to 100
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"adjust" | "merge">("merge");
  const baseRef = useRef<HTMLInputElement>(null);
  const refRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleBase = async (file: File) => {
    const data = await readFile(file);
    setBaseImage(data);
    setMergedImage(null);
    setPreviewUrl(null);
  };

  const handleRef = async (file: File) => {
    const data = await readFile(file);
    setRefImage(data);
    setMergedImage(null);
    setPreviewUrl(null);
  };

  // Real-time canvas preview with transforms
  useEffect(() => {
    const sourceImg = mergedImage || baseImage;
    if (!sourceImg) { setPreviewUrl(null); return; }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgBase = new Image();
    imgBase.crossOrigin = "anonymous";

    if (mergedImage && baseImage) {
      // Blend base + merged by intensity, then apply transforms
      const imgOrig = new Image();
      imgOrig.crossOrigin = "anonymous";
      let loaded = 0;
      const onLoad = () => {
        loaded++;
        if (loaded < 2) return;
        const w = imgOrig.naturalWidth;
        const h = imgOrig.naturalHeight;
        canvas.width = w;
        canvas.height = h;

        // Draw base
        ctx.globalAlpha = 1;
        ctx.drawImage(imgOrig, 0, 0, w, h);
        // Overlay merged at intensity
        ctx.globalAlpha = intensity / 100;
        ctx.drawImage(imgBase, 0, 0, w, h);
        ctx.globalAlpha = 1;

        // Apply volume + size transforms
        applyFaceTransforms(canvas, ctx, volume, faceSize);
        setPreviewUrl(canvas.toDataURL("image/png"));
      };
      imgOrig.onload = onLoad;
      imgBase.onload = onLoad;
      imgOrig.src = baseImage;
      imgBase.src = mergedImage;
    } else {
      imgBase.onload = () => {
        const w = imgBase.naturalWidth;
        const h = imgBase.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(imgBase, 0, 0, w, h);
        applyFaceTransforms(canvas, ctx, volume, faceSize);
        setPreviewUrl(canvas.toDataURL("image/png"));
      };
      imgBase.src = sourceImg;
    }
  }, [baseImage, mergedImage, intensity, volume, faceSize]);

  const generate = useCallback(async () => {
    if (!baseImage) {
      toast({ title: "Envie a imagem principal", variant: "destructive" });
      return;
    }
    if (mode === "merge" && !refImage) {
      toast({ title: "Envie a imagem de referência", variant: "destructive" });
      return;
    }

    setLoading(true);
    setMergedImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("face-merge", {
        body: { baseImage, referenceImage: mode === "merge" ? refImage : null, intensity: 100, mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.image) {
        setMergedImage(data.image);
      } else {
        throw new Error("Nenhuma imagem retornada");
      }
    } catch (err: any) {
      toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [baseImage, refImage, mode, toast]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = `mesclagem-rosto.png`;
    link.click();
  };

  const handleShare = async () => {
    if (!previewUrl) return;
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const file = new File([blob], "mesclagem-rosto.png", { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mesclagem de Rosto" });
      } else { handleDownload(); }
    } catch { handleDownload(); }
  };

  const showSliders = !!baseImage;
  const showResult = !!previewUrl && !loading;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">Mesclagem de Rosto</h1>
      <p className="text-muted-foreground mb-6">Envie imagens, mescle rostos e ajuste volume e tamanho em tempo real</p>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setMergedImage(null); setPreviewUrl(null); }} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="adjust">Ajuste de Rosto</TabsTrigger>
          <TabsTrigger value="merge">Mesclagem</TabsTrigger>
        </TabsList>
        <TabsContent value="adjust" className="mt-4">
          <UploadArea label="Imagem principal" preview={baseImage} inputRef={baseRef} onFile={handleBase} />
        </TabsContent>
        <TabsContent value="merge" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UploadArea label="Imagem base (rosto principal)" preview={baseImage} inputRef={baseRef} onFile={handleBase} />
            <UploadArea label="Imagem de referência" preview={refImage} inputRef={refRef} onFile={handleRef} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Sliders */}
      {showSliders && (
        <div className="space-y-4 mb-6">
          {/* Merge intensity — only after AI generation */}
          {mergedImage && (
            <SliderControl
              label="Intensidade da mesclagem"
              value={intensity}
              onChange={setIntensity}
              min={0} max={100}
              leftLabel="Original" rightLabel="Máximo"
              displayValue={`${intensity}%`}
            />
          )}

          <SliderControl
            label="Volume do Rosto"
            value={volume}
            onChange={setVolume}
            min={-100} max={100}
            leftLabel="Magro" rightLabel="Gordo"
            displayValue={volume > 0 ? `+${volume}` : `${volume}`}
          />

          <SliderControl
            label="Tamanho do Rosto"
            value={faceSize}
            onChange={setFaceSize}
            min={-100} max={100}
            leftLabel="Menor" rightLabel="Maior"
            displayValue={faceSize > 0 ? `+${faceSize}` : `${faceSize}`}
          />
        </div>
      )}

      {/* Live Preview */}
      {showResult && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground mb-3">Pré-visualização ao vivo:</p>
            <div className="rounded-lg overflow-hidden border border-border flex items-center justify-center bg-muted p-2">
              <img src={previewUrl} alt="Preview" className="max-h-96 object-contain rounded" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate */}
      {baseImage && (
        <Button onClick={generate} disabled={loading} className="w-full mb-4 gap-2" size="lg">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
          ) : (
            <><Sparkles className="w-4 h-4" />{mergedImage ? "REGERAR COM IA" : "GERAR RESULTADO FINAL"}</>
          )}
        </Button>
      )}

      {/* Download / Share */}
      {showResult && (
        <div className="flex gap-3">
          <Button onClick={handleDownload} className="flex-1 gap-2">
            <Download className="w-4 h-4" />BAIXAR IMAGEM
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-1 gap-2">
            <Share2 className="w-4 h-4" />COMPARTILHAR
          </Button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

/* ── Helpers ── */

function applyFaceTransforms(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  volume: number,
  size: number
) {
  if (volume === 0 && size === 0) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const src = new ImageData(
    new Uint8ClampedArray(imageData.data),
    canvas.width,
    canvas.height
  );

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h * 0.4; // Face center estimate (upper 40%)
  const radius = Math.min(w, h) * 0.4;

  const dst = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let srcX = x;
      let srcY = y;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        const factor = 1 - (dist / radius);
        const smooth = factor * factor * (3 - 2 * factor); // smoothstep

        // Volume: stretch/compress horizontally
        if (volume !== 0) {
          const volStr = (volume / 100) * 0.3 * smooth;
          srcX = cx + dx * (1 - volStr);
        }

        // Size: scale from face center
        if (size !== 0) {
          const sizeStr = (size / 100) * 0.25 * smooth;
          const sdx = (srcX - cx);
          const sdy = (srcY - cy);
          srcX = cx + sdx * (1 - sizeStr);
          srcY = cy + sdy * (1 - sizeStr);
        }
      }

      // Bilinear sample
      const sx = Math.max(0, Math.min(w - 1.001, srcX));
      const sy = Math.max(0, Math.min(h - 1.001, srcY));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, w - 1);
      const y1 = Math.min(y0 + 1, h - 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const idx = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v00 = src.data[(y0 * w + x0) * 4 + c];
        const v10 = src.data[(y0 * w + x1) * 4 + c];
        const v01 = src.data[(y1 * w + x0) * 4 + c];
        const v11 = src.data[(y1 * w + x1) * 4 + c];
        dst.data[idx + c] = Math.round(
          v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) +
          v01 * (1 - fx) * fy + v11 * fx * fy
        );
      }
    }
  }

  ctx.putImageData(dst, 0, 0);
}

function SliderControl({ label, value, onChange, min, max, leftLabel, rightLabel, displayValue }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; leftLabel: string; rightLabel: string; displayValue: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">{label}</Label>
          <span className="text-sm font-bold text-primary">{displayValue}</span>
        </div>
        <Slider value={[value]} onValueChange={(v) => onChange(v[0])} min={min} max={max} step={1} className="w-full" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadArea({ label, preview, inputRef, onFile }: {
  label: string; preview: string | null;
  inputRef: React.RefObject<HTMLInputElement>; onFile: (f: File) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-2 block">{label}</Label>
      <Card className="border-dashed border-2 border-border hover:border-primary/40 transition-colors cursor-pointer" onClick={() => inputRef.current?.click()}>
        <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
          {preview ? (
            <img src={preview} alt={label} className="max-h-40 object-contain rounded" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground text-center">Clique para enviar</p>
            </>
          )}
        </CardContent>
      </Card>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}
