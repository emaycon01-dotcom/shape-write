import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Download, RotateCcw, ZoomIn, ZoomOut, Search, Check, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type SigFont = {
  name: string;
  family: string;
  google: string;
  weights: number[];
  group: "Caneta fina" | "Cursiva" | "Manuscrita";
};

const FONTS: SigFont[] = [
  // ---- Caneta fina (traço fino, escrita corrida) ----
  { name: "Caveat", family: "'Caveat', cursive", google: "Caveat:wght@400;500;600;700", weights: [400, 500, 600, 700], group: "Caneta fina" },
  { name: "Kalam", family: "'Kalam', cursive", google: "Kalam:wght@300;400;700", weights: [300, 400, 700], group: "Caneta fina" },
  { name: "Shadows Into Light", family: "'Shadows Into Light', cursive", google: "Shadows+Into+Light", weights: [400], group: "Caneta fina" },
  { name: "Indie Flower", family: "'Indie Flower', cursive", google: "Indie+Flower", weights: [400], group: "Caneta fina" },
  { name: "Architects Daughter", family: "'Architects Daughter', cursive", google: "Architects+Daughter", weights: [400], group: "Caneta fina" },
  { name: "Nothing You Could Do", family: "'Nothing You Could Do', cursive", google: "Nothing+You+Could+Do", weights: [400], group: "Caneta fina" },
  { name: "Homemade Apple", family: "'Homemade Apple', cursive", google: "Homemade+Apple", weights: [400], group: "Caneta fina" },
  { name: "Reenie Beanie", family: "'Reenie Beanie', cursive", google: "Reenie+Beanie", weights: [400], group: "Caneta fina" },
  { name: "La Belle Aurore", family: "'La Belle Aurore', cursive", google: "La+Belle+Aurore", weights: [400], group: "Caneta fina" },
  { name: "Zeyada", family: "'Zeyada', cursive", google: "Zeyada", weights: [400], group: "Caneta fina" },
  { name: "Give You Glory", family: "'Give You Glory', cursive", google: "Give+You+Glory", weights: [400], group: "Caneta fina" },
  { name: "Just Another Hand", family: "'Just Another Hand', cursive", google: "Just+Another+Hand", weights: [400], group: "Caneta fina" },
  { name: "Cedarville Cursive", family: "'Cedarville Cursive', cursive", google: "Cedarville+Cursive", weights: [400], group: "Caneta fina" },
  { name: "Dawning of a New Day", family: "'Dawning of a New Day', cursive", google: "Dawning+of+a+New+Day", weights: [400], group: "Caneta fina" },
  { name: "Grape Nuts", family: "'Grape Nuts', cursive", google: "Grape+Nuts", weights: [400], group: "Caneta fina" },
  { name: "Waiting for the Sunrise", family: "'Waiting for the Sunrise', cursive", google: "Waiting+for+the+Sunrise", weights: [400], group: "Caneta fina" },

  // ---- Cursiva (assinatura clássica) ----
  { name: "Great Vibes", family: "'Great Vibes', cursive", google: "Great+Vibes", weights: [400], group: "Cursiva" },
  { name: "Allura", family: "'Allura', cursive", google: "Allura", weights: [400], group: "Cursiva" },
  { name: "Alex Brush", family: "'Alex Brush', cursive", google: "Alex+Brush", weights: [400], group: "Cursiva" },
  { name: "Sacramento", family: "'Sacramento', cursive", google: "Sacramento", weights: [400], group: "Cursiva" },
  { name: "Pinyon Script", family: "'Pinyon Script', cursive", google: "Pinyon+Script", weights: [400], group: "Cursiva" },
  { name: "Dancing Script", family: "'Dancing Script', cursive", google: "Dancing+Script:wght@400;500;600;700", weights: [400, 500, 600, 700], group: "Cursiva" },
  { name: "Tangerine", family: "'Tangerine', cursive", google: "Tangerine:wght@400;700", weights: [400, 700], group: "Cursiva" },
  { name: "Parisienne", family: "'Parisienne', cursive", google: "Parisienne", weights: [400], group: "Cursiva" },
  { name: "Italianno", family: "'Italianno', cursive", google: "Italianno", weights: [400], group: "Cursiva" },
  { name: "Mrs Saint Delafield", family: "'Mrs Saint Delafield', cursive", google: "Mrs+Saint+Delafield", weights: [400], group: "Cursiva" },
  { name: "Herr Von Muellerhoff", family: "'Herr Von Muellerhoff', cursive", google: "Herr+Von+Muellerhoff", weights: [400], group: "Cursiva" },
  { name: "Petit Formal Script", family: "'Petit Formal Script', cursive", google: "Petit+Formal+Script", weights: [400], group: "Cursiva" },
  { name: "Arizonia", family: "'Arizonia', cursive", google: "Arizonia", weights: [400], group: "Cursiva" },
  { name: "Style Script", family: "'Style Script', cursive", google: "Style+Script", weights: [400], group: "Cursiva" },
  { name: "Ephesis", family: "'Ephesis', cursive", google: "Ephesis", weights: [400], group: "Cursiva" },
  { name: "Qwigley", family: "'Qwigley', cursive", google: "Qwigley", weights: [400], group: "Cursiva" },
  { name: "Marck Script", family: "'Marck Script', cursive", google: "Marck+Script", weights: [400], group: "Cursiva" },
  { name: "Meie Script", family: "'Meie Script', cursive", google: "Meie+Script", weights: [400], group: "Cursiva" },
  { name: "Yesteryear", family: "'Yesteryear', cursive", google: "Yesteryear", weights: [400], group: "Cursiva" },
  { name: "Mr De Haviland", family: "'Mr De Haviland', cursive", google: "Mr+De+Haviland", weights: [400], group: "Cursiva" },

  // ---- Manuscrita (mais encorpada) ----
  { name: "Satisfy", family: "'Satisfy', cursive", google: "Satisfy", weights: [400], group: "Manuscrita" },
  { name: "Yellowtail", family: "'Yellowtail', cursive", google: "Yellowtail", weights: [400], group: "Manuscrita" },
  { name: "Courgette", family: "'Courgette', cursive", google: "Courgette", weights: [400], group: "Manuscrita" },
  { name: "Damion", family: "'Damion', cursive", google: "Damion", weights: [400], group: "Manuscrita" },
  { name: "Norican", family: "'Norican', cursive", google: "Norican", weights: [400], group: "Manuscrita" },
  { name: "Niconne", family: "'Niconne', cursive", google: "Niconne", weights: [400], group: "Manuscrita" },
  { name: "Cookie", family: "'Cookie', cursive", google: "Cookie", weights: [400], group: "Manuscrita" },
  { name: "Pacifico", family: "'Pacifico', cursive", google: "Pacifico", weights: [400], group: "Manuscrita" },
];

const GROUPS = ["Todas", "Caneta fina", "Cursiva", "Manuscrita"] as const;

const COLORS = [
  { name: "Preto", value: "#000000" },
  { name: "Azul caneta", value: "#1B3FAE" },
  { name: "Azul royal", value: "#0B57D0" },
  { name: "Azul escuro", value: "#0A2A66" },
  { name: "Grafite", value: "#3A3A3A" },
  { name: "Vermelho", value: "#B00020" },
  { name: "Verde", value: "#0F6B3C" },
  { name: "Roxo", value: "#5B21B6" },
];

const GOOGLE_HREF =
  "https://fonts.googleapis.com/css2?" +
  FONTS.map((f) => `family=${f.google}`).join("&") +
  "&display=swap";

export default function SignatureGeneratorPage() {
  const [name, setName] = useState("");
  const [selectedFont, setSelectedFont] = useState(0);
  const [weight, setWeight] = useState(400);
  const [stroke, setStroke] = useState(0);
  const [size, setSize] = useState(64);
  const [color, setColor] = useState("#000000");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("Todas");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const font = FONTS[selectedFont];

  // Load Google Fonts once
  useEffect(() => {
    if (!document.querySelector("#sig-fonts")) {
      const link = document.createElement("link");
      link.id = "sig-fonts";
      link.rel = "stylesheet";
      link.href = GOOGLE_HREF;
      document.head.appendChild(link);
    }
    let cancelled = false;
    document.fonts.ready.then(() => !cancelled && setFontsReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // keep weight valid for the chosen font
  useEffect(() => {
    if (!font.weights.includes(weight)) setWeight(font.weights[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFont]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FONTS.map((f, i) => ({ f, i })).filter(
      ({ f }) => (group === "Todas" || f.group === group) && (!q || f.name.toLowerCase().includes(q)),
    );
  }, [group, query]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const W = 1200;
    const H = 400;
    canvas.width = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    const text = name.trim();
    if (!text) return;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let px = size * 2;
    ctx.font = `${weight} ${px}px ${font.family}`;
    // auto-shrink to fit
    while (ctx.measureText(text).width > W - 80 && px > 16) {
      px -= 2;
      ctx.font = `${weight} ${px}px ${font.family}`;
    }

    ctx.fillText(text, W / 2, H / 2);
    if (stroke > 0) {
      ctx.lineWidth = stroke;
      ctx.strokeText(text, W / 2, H / 2);
    }
  }, [name, selectedFont, weight, stroke, size, color, font.family]);

  useEffect(() => {
    draw();
  }, [draw, fontsReady]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `assinatura-${name.trim().replace(/\s+/g, "_") || "monkeylab"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast({ title: "Assinatura baixada!", description: "A imagem foi salva com sucesso." });
  };

  const handleReset = () => {
    setName("");
    setSelectedFont(0);
    setWeight(400);
    setStroke(0);
    setSize(64);
    setColor("#000000");
    setZoom(1);
    setQuery("");
    setGroup("Todas");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerador de Assinatura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {FONTS.length} fontes de caneta, espessuras ajustáveis, cores e zoom na pré-visualização.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ---------------- ESQUERDA: nome + fontes ---------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">1. Nome</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Digite seu nome completo..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-base"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">2. Escolha a fonte</CardTitle>
              <CardDescription>{filtered.length} estilos disponíveis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar fonte..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GROUPS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGroup(g)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        group === g
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid max-h-[460px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {filtered.map(({ f, i }) => (
                  <button
                    key={f.name}
                    onClick={() => setSelectedFont(i)}
                    className={`group relative rounded-xl border px-4 py-3 text-left transition-all ${
                      selectedFont === i
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
                    }`}
                  >
                    <span
                      className="block truncate text-2xl leading-tight text-foreground"
                      style={{ fontFamily: f.family, fontWeight: f.weights[0] }}
                    >
                      {name.trim() || "Assinatura"}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {f.name}
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] normal-case">
                        {f.group}
                      </span>
                    </span>
                    {selectedFont === i && (
                      <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- DIREITA: ajustes + preview ---------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">3. Ajustes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cor</Label>
                <div className="grid grid-cols-8 gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      title={c.name}
                      onClick={() => setColor(c.value)}
                      className={`h-8 w-full rounded-md border transition-all ${
                        color.toLowerCase() === c.value.toLowerCase()
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "border-border hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <span className="text-xs text-muted-foreground">Cor personalizada · {color}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Peso da fonte
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {font.weights.map((w) => (
                    <button
                      key={w}
                      onClick={() => setWeight(w)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        weight === w
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/50"
                      }`}
                    >
                      {w === 300 ? "Fina" : w === 400 ? "Normal" : w === 500 ? "Média" : w === 600 ? "Semi" : "Grossa"}
                    </button>
                  ))}
                  {font.weights.length === 1 && (
                    <span className="self-center text-[11px] text-muted-foreground">
                      use a espessura do traço abaixo
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Espessura do traço
                  </Label>
                  <span className="text-xs text-muted-foreground">{stroke.toFixed(1)}px</span>
                </div>
                <Slider value={[stroke]} min={0} max={6} step={0.5} onValueChange={(v) => setStroke(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tamanho
                  </Label>
                  <span className="text-xs text-muted-foreground">{size}px</span>
                </div>
                <Slider value={[size]} min={28} max={110} step={2} onValueChange={(v) => setSize(v[0])} />
              </div>

              <Button variant="outline" onClick={handleReset} className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" />
                Limpar tudo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg">Pré-visualização</CardTitle>
                <CardDescription>{font.name}</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center text-xs text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setFullscreen(true)}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex min-h-[140px] items-center overflow-auto rounded-lg border border-border bg-white p-3">
                <canvas
                  ref={canvasRef}
                  className="mx-auto h-auto"
                  style={{ width: `${Math.round(100 * zoom)}%`, minWidth: `${Math.round(100 * zoom)}%` }}
                />
              </div>
              <Button onClick={handleDownload} disabled={!name.trim()} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Baixar Assinatura (PNG)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Lupa · {font.name}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto rounded-lg bg-white p-6">
            <img
              alt={`Assinatura de ${name || "exemplo"} na fonte ${font.name}`}
              src={canvasRef.current?.toDataURL("image/png")}
              className="mx-auto w-full max-w-none"
              style={{ width: `${Math.round(100 * Math.max(zoom, 1.5))}%` }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
