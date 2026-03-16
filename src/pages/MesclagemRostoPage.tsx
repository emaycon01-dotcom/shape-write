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
  const [blendedPreview, setBlendedPreview] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(80);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"adjust" | "merge">("merge");
  const baseRef = useRef<HTMLInputElement>(null);
  const refRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    setBlendedPreview(null);
  };

  const handleRef = async (file: File) => {
    const data = await readFile(file);
    setRefImage(data);
    setMergedImage(null);
    setBlendedPreview(null);
  };

  // Blend base and merged images on canvas based on intensity
  useEffect(() => {
    if (!baseImage || !mergedImage) {
      setBlendedPreview(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgBase = new Image();
    const imgMerged = new Image();
    imgBase.crossOrigin = "anonymous";
    imgMerged.crossOrigin = "anonymous";

    let loaded = 0;
    const onBothLoaded = () => {
      loaded++;
      if (loaded < 2) return;

      const w = imgBase.naturalWidth;
      const h = imgBase.naturalHeight;
      canvas.width = w;
      canvas.height = h;

      // Draw base image
      ctx.globalAlpha = 1;
      ctx.drawImage(imgBase, 0, 0, w, h);

      // Overlay merged image with intensity as opacity
      ctx.globalAlpha = intensity / 100;
      ctx.drawImage(imgMerged, 0, 0, w, h);
      ctx.globalAlpha = 1;

      setBlendedPreview(canvas.toDataURL("image/png"));
    };

    imgBase.onload = onBothLoaded;
    imgMerged.onload = onBothLoaded;
    imgBase.src = baseImage;
    imgMerged.src = mergedImage;
  }, [baseImage, mergedImage, intensity]);

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
    setBlendedPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("face-merge", {
        body: {
          baseImage,
          referenceImage: mode === "merge" ? refImage : null,
          intensity: 100, // Always generate at max, blend client-side
          mode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.image) {
        setMergedImage(data.image);
      } else {
        throw new Error("Nenhuma imagem retornada");
      }
    } catch (err: any) {
      toast({
        title: "Erro ao processar imagem",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [baseImage, refImage, mode, toast]);

  const displayImage = blendedPreview || mergedImage;

  const handleDownload = () => {
    if (!displayImage) return;
    const link = document.createElement("a");
    link.href = displayImage;
    link.download = `mesclagem-rosto-${intensity}pct.png`;
    link.click();
  };

  const handleShare = async () => {
    if (!displayImage) return;
    try {
      const res = await fetch(displayImage);
      const blob = await res.blob();
      const file = new File([blob], `mesclagem-rosto-${intensity}pct.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mesclagem de Rosto" });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">
        Mesclagem de Rosto
      </h1>
      <p className="text-muted-foreground mb-6">
        Envie imagens e mescle ou ajuste rostos — use o slider para controlar a intensidade ao vivo
      </p>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as "adjust" | "merge"); setMergedImage(null); setBlendedPreview(null); }} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="adjust">Ajuste de Rosto</TabsTrigger>
          <TabsTrigger value="merge">Mesclagem</TabsTrigger>
        </TabsList>

        <TabsContent value="adjust" className="mt-4 space-y-4">
          <UploadArea label="Imagem principal" preview={baseImage} inputRef={baseRef} onFile={handleBase} />
        </TabsContent>

        <TabsContent value="merge" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UploadArea label="Imagem base (rosto principal)" preview={baseImage} inputRef={baseRef} onFile={handleBase} />
            <UploadArea label="Imagem de referência" preview={refImage} inputRef={refRef} onFile={handleRef} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Generate Button */}
      {baseImage && (
        <Button onClick={generate} disabled={loading} className="w-full mb-6 gap-2" size="lg">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
          ) : (
            <><Sparkles className="w-4 h-4" />{mergedImage ? "REGERAR RESULTADO" : "GERAR RESULTADO"}</>
          )}
        </Button>
      )}

      {/* Live Intensity Slider — only after generation */}
      {mergedImage && (
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                Intensidade da mesclagem
              </Label>
              <span className="text-sm font-bold text-primary">{intensity}%</span>
            </div>
            <Slider
              value={[intensity]}
              onValueChange={(v) => setIntensity(v[0])}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Original</span>
              <span>Máximo</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Preview */}
      {displayImage && !loading && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-foreground mb-3">Resultado:</p>
              <div className="rounded-lg overflow-hidden border border-border flex items-center justify-center bg-muted p-2">
                <img src={displayImage} alt="Resultado da mesclagem" className="max-h-96 object-contain rounded" />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleDownload} className="flex-1 gap-2">
              <Download className="w-4 h-4" />BAIXAR IMAGEM
            </Button>
            <Button onClick={handleShare} variant="outline" className="flex-1 gap-2">
              <Share2 className="w-4 h-4" />COMPARTILHAR
            </Button>
          </div>
        </div>
      )}

      {/* Hidden canvas for blending */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function UploadArea({ label, preview, inputRef, onFile }: {
  label: string;
  preview: string | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-2 block">{label}</Label>
      <Card
        className="border-dashed border-2 border-border hover:border-primary/40 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
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
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}
