import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FONTS = [
  { name: "Clássica", family: "'Dancing Script', cursive" },
  { name: "Elegante", family: "'Great Vibes', cursive" },
  { name: "Moderna", family: "'Pacifico', cursive" },
  { name: "Formal", family: "'Allura', cursive" },
  { name: "Manuscrita", family: "'Sacramento', cursive" },
  { name: "Sofisticada", family: "'Pinyon Script', cursive" },
];

export default function SignatureGeneratorPage() {
  const [name, setName] = useState("");
  const [selectedFont, setSelectedFont] = useState(0);
  const [color, setColor] = useState("#000000");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const generateSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !name.trim()) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 200;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = color;
    ctx.font = `48px ${FONTS[selectedFont].family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  }, [name, selectedFont, color]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `assinatura-${name.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    toast({ title: "Assinatura baixada!", description: "A imagem foi salva com sucesso." });
  };

  const handleReset = () => {
    setName("");
    setSelectedFont(0);
    setColor("#000000");
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Load Google Fonts
  const fontLink = document.querySelector("#sig-fonts") as HTMLLinkElement;
  if (!fontLink) {
    const link = document.createElement("link");
    link.id = "sig-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&family=Allura&family=Sacramento&family=Pinyon+Script&display=swap";
    document.head.appendChild(link);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerador de Assinatura</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Digite seu nome e escolha um estilo para gerar sua assinatura digital.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              placeholder="Digite seu nome..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Estilo da fonte</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONTS.map((font, i) => (
                <button
                  key={font.name}
                  onClick={() => setSelectedFont(i)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    selectedFont === i
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <span
                    className="text-lg text-foreground block truncate"
                    style={{ fontFamily: font.family }}
                  >
                    {name || "Exemplo"}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {font.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor da assinatura</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded border border-border cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={generateSignature} disabled={!name.trim()} className="flex-1">
              Gerar Assinatura
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pré-visualização</CardTitle>
          <CardDescription>Sua assinatura aparecerá aqui</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-border rounded-lg bg-card p-4 flex items-center justify-center min-h-[120px]">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="max-w-full h-auto"
              style={{ imageRendering: "auto" }}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={!name.trim()}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar Assinatura (PNG)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
