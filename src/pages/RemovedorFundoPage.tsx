import { useState, useRef } from "react";
import { Upload, Download, Share2, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type BgOption = "white" | "black";

export default function RemovedorFundoPage() {
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [bgOption, setBgOption] = useState<BgOption>("white");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setOriginalPreview(base64);
      setProcessedImage(null);
      setFinalImage(null);
      await processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("remove-background", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;
      if (data?.image) {
        setProcessedImage(data.image);
        applyBackground(data.image, bgOption);
      } else {
        throw new Error("Nenhuma imagem retornada");
      }
    } catch (err: any) {
      toast({ title: "Erro ao remover fundo", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const applyBackground = (imgSrc: string, bg: BgOption) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = bg === "white" ? "#FFFFFF" : "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setFinalImage(canvas.toDataURL("image/png"));
    };
    img.src = imgSrc;
  };

  const handleBgChange = (value: string) => {
    const bg = value as BgOption;
    setBgOption(bg);
    if (processedImage) {
      applyBackground(processedImage, bg);
    }
  };

  const handleDownload = () => {
    if (!finalImage) return;
    const link = document.createElement("a");
    link.href = finalImage;
    link.download = `imagem-sem-fundo-${bgOption}.png`;
    link.click();
  };

  const handleShare = async () => {
    if (!finalImage) return;
    try {
      const res = await fetch(finalImage);
      const blob = await res.blob();
      const file = new File([blob], `imagem-sem-fundo-${bgOption}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Imagem sem fundo" });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">Removedor de Fundo</h1>
      <p className="text-muted-foreground mb-8">Envie uma imagem e remova o fundo automaticamente</p>

      {/* Upload Area */}
      <Card
        className="border-dashed border-2 border-border hover:border-primary/40 transition-colors cursor-pointer mb-6"
        onClick={() => fileRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Clique ou arraste uma imagem aqui
          </p>
          <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP</p>
        </CardContent>
      </Card>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Removendo fundo...</p>
        </div>
      )}

      {/* Results */}
      {processedImage && !loading && (
        <div className="space-y-6">
          {/* Background Options */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-foreground mb-3">Escolha o fundo:</p>
              <RadioGroup value={bgOption} onValueChange={handleBgChange} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="white" id="bg-white" />
                  <Label htmlFor="bg-white" className="flex items-center gap-2 cursor-pointer">
                    <span className="w-6 h-6 rounded-full border border-border bg-white" />
                    Fundo Branco
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="black" id="bg-black" />
                  <Label htmlFor="bg-black" className="flex items-center gap-2 cursor-pointer">
                    <span className="w-6 h-6 rounded-full border border-border bg-black" />
                    Fundo Preto
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Preview */}
          {finalImage && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-foreground mb-3">Pré-visualização:</p>
                <div
                  className="rounded-lg overflow-hidden border border-border flex items-center justify-center p-2"
                  style={{ background: bgOption === "white" ? "#fff" : "#000" }}
                >
                  <img
                    src={finalImage}
                    alt="Resultado"
                    className="max-h-80 object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {finalImage && (
            <div className="flex gap-3">
              <Button onClick={handleDownload} className="flex-1 gap-2">
                <Download className="w-4 h-4" />
                Baixar imagem
              </Button>
              <Button onClick={handleShare} variant="outline" className="flex-1 gap-2">
                <Share2 className="w-4 h-4" />
                Compartilhar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
