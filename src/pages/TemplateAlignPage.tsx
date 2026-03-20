import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, RotateCcw, Save, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";
import templateBgUrl from "@/assets/template-cnh-bg.jpeg";
import templateFisicaBgUrl from "@/assets/template-cnh-fisica-bg.jpg";
import templateFisicaVersoBgUrl from "@/assets/template-cnh-fisica-verso.jpg";
import templateBombeiroUrl from "@/assets/template-carteira-bombeiro.jpg";
import templatePorteiroUrl from "@/assets/template-carteira-porteiro.jpg";
import templateAgenteUrl from "@/assets/template-carteira-agente-financeiro.jpg";
import templateBombeiroMilitarFrenteUrl from "@/assets/template-carteira-bombeiro-militar-frente.jpg";
import templateBombeiroMilitarVersoUrl from "@/assets/template-carteira-bombeiro-militar-verso.jpg";
import templateSegurancaEscolarFrenteUrl from "@/assets/template-carteira-seguranca-escolar-frente.jpg";
import templateSegurancaEscolarVersoUrl from "@/assets/template-carteira-seguranca-escolar-verso.jpg";
import templateChaAmadorUrl from "@/assets/template-cha-amador.jpg";
import templateCpfFisicoUrl from "@/assets/template-cpf-fisico.jpg";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

const CertidaoAlignPage = lazy(() => import("./CertidaoAlignPage"));
const ComprovanteResidenciaAlignPage = lazy(() => import("./ComprovanteResidenciaAlignPage"));
const ExameToxicologicoAlignPage = lazy(() => import("./ExameToxicologicoAlignPage"));

const PAGE_W = 794;
const PAGE_H = 1123;
const BOMBEIRO_MILITAR_W = 242.88;
const BOMBEIRO_MILITAR_H = 153;

interface FieldDef {
  id: string;
  label: string;
  sampleText: string;
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
  color?: string;
  rotate?: number;
  imageUrl?: string;
  fontFamily?: string;
  isBox?: boolean;
}

const FONT_OPTIONS = [
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Georgia", label: "Georgia" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Tahoma", label: "Tahoma" },
  { value: "Lucida Console", label: "Lucida Console" },
  { value: "Impact", label: "Impact" },
  { value: "Comic Sans MS", label: "Comic Sans MS" },
];

const defaultFields: FieldDef[] = [
  { id: "photo", label: "Foto", sampleText: "[FOTO]", x: 98, y: 167, fontSize: 8, w: 82, h: 110, color: "#999" },
  { id: "signature", label: "Assinatura", sampleText: "[ASSINATURA]", x: 93, y: 276, fontSize: 7, w: 95, h: 32, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "MARIA OLIVEIRA SANTOS", x: 100, y: 149, fontSize: 6.5 },
  { id: "primeira_hab", label: "1ª Hab", sampleText: "27/09/2017", x: 308, y: 149, fontSize: 6.5 },
  { id: "nascimento", label: "Nascimento", sampleText: "11/03/1989, RIO DE JANEIRO, RJ", x: 192, y: 168, fontSize: 6.5 },
  { id: "emissao", label: "Emissão", sampleText: "14/03/2026", x: 191, y: 187, fontSize: 6.5 },
  { id: "validade", label: "Validade", sampleText: "14/03/2036", x: 253, y: 187, fontSize: 6.5, color: "#c00" },
  { id: "cat_big", label: "Cat. Grande", sampleText: "AB", x: 338, y: 184, fontSize: 11 },
  { id: "validade_cat_a", label: "Validade Cat. A", sampleText: "14/03/2036", x: 171, y: 353, fontSize: 4.5 },
  { id: "validade_cat_b", label: "Validade Cat. B", sampleText: "14/03/2036", x: 171, y: 375, fontSize: 4.5 },
  { id: "validade_cat_c", label: "Validade Cat. C", sampleText: "14/03/2036", x: 171, y: 397, fontSize: 4.5 },
  { id: "validade_cat_d", label: "Validade Cat. D", sampleText: "14/03/2036", x: 275, y: 342, fontSize: 4.5 },
  { id: "validade_cat_e", label: "Validade Cat. E", sampleText: "14/03/2036", x: 274, y: 375, fontSize: 4.5 },
  { id: "rg", label: "RG", sampleText: "3963221 SSP PR", x: 190, y: 207, fontSize: 6.5 },
  { id: "cpf", label: "CPF", sampleText: "997.038.350-25", x: 190, y: 226, fontSize: 6.5 },
  { id: "registro", label: "Registro", sampleText: "07915888995", x: 256, y: 226, fontSize: 6.5 },
  { id: "cat_hab", label: "Cat. Hab", sampleText: "AB", x: 319, y: 226, fontSize: 7 },
  { id: "nacionalidade", label: "Nacionalidade", sampleText: "BRASILEIRA", x: 190, y: 246, fontSize: 6.5 },
  { id: "pai", label: "Pai", sampleText: "JOSE DA SILVA", x: 190, y: 266, fontSize: 6.5 },
  { id: "mae", label: "Mãe", sampleText: "SANDRA COSTA", x: 190, y: 286, fontSize: 6.5 },
  { id: "obs", label: "Observações", sampleText: "EAR", x: 97, y: 427, fontSize: 5.5 },
  { id: "espelho", label: "Nº Espelho", sampleText: "77424319856", x: 281, y: 495, fontSize: 6.5 },
  { id: "renach", label: "RENACH", sampleText: "PB527125303", x: 280, y: 509, fontSize: 6.5 },
  { id: "local", label: "Local", sampleText: "RIO DE JANEIRO, RJ", x: 100, y: 505, fontSize: 6 },
  { id: "estado", label: "Estado", sampleText: "BAHIA", x: 163, y: 531, fontSize: 15 },
  { id: "mrz", label: "MRZ", sampleText: "I<BRA079158889PB927125303<<<<\n8903118M3603147BRA<<<<<<<<<<<4\nMARIA<<OLIVEIRA<<SANTOS<<<<<<<", x: 80, y: 694, fontSize: 9.5 },
  { id: "reg_vert_top", label: "Reg. Vertical (topo)", sampleText: "07915888995", x: 65, y: 315, fontSize: 12, rotate: -90 },
  { id: "reg_vert_bot", label: "Reg. Vertical (base)", sampleText: "07915888995", x: 64, y: 558, fontSize: 11.5, rotate: -90 },
];

function FieldPropertiesPanel({
  field,
  onUpdate,
}: {
  field: FieldDef;
  onUpdate: (updates: Partial<FieldDef>) => void;
}) {
  const isBox = field.isBox || field.id === "photo" || field.id === "signature" || field.id === "brasao";

  return (
    <div className="glass rounded-lg p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary font-display">{field.label}</span>
        <span className="text-muted-foreground font-mono text-xs">
          x:{field.x} y:{field.y}
        </span>
      </div>

      {/* Position controls */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">X</Label>
          <Input
            type="number"
            value={field.x}
            onChange={(e) => onUpdate({ x: Math.max(0, Number(e.target.value)) })}
            className="h-7 text-xs font-mono bg-secondary/50"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Y</Label>
          <Input
            type="number"
            value={field.y}
            onChange={(e) => onUpdate({ y: Math.max(0, Number(e.target.value)) })}
            className="h-7 text-xs font-mono bg-secondary/50"
          />
        </div>
      </div>

      {/* Font size control */}
      <div>
        <Label className="text-xs text-muted-foreground">Tamanho da fonte</Label>
        <div className="flex items-center gap-2 mt-1">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => onUpdate({ fontSize: Math.max(4, field.fontSize - 0.5) })}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <Input
            type="number"
            step="0.5"
            min="4"
            max="40"
            value={field.fontSize}
            onChange={(e) => onUpdate({ fontSize: Math.max(4, Number(e.target.value)) })}
            className="h-7 text-xs font-mono text-center bg-secondary/50 w-16"
          />
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => onUpdate({ fontSize: Math.min(40, field.fontSize + 0.5) })}
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Slider
            value={[field.fontSize]}
            min={4}
            max={40}
            step={0.5}
            onValueChange={([v]) => onUpdate({ fontSize: v })}
            className="flex-1"
          />
        </div>
      </div>

      {/* Size controls for boxes */}
      {isBox && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Largura</Label>
            <Input
              type="number"
              value={field.w || 80}
              onChange={(e) => onUpdate({ w: Math.max(10, Number(e.target.value)) })}
              className="h-7 text-xs font-mono bg-secondary/50"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Altura</Label>
            <Input
              type="number"
              value={field.h || 80}
              onChange={(e) => onUpdate({ h: Math.max(10, Number(e.target.value)) })}
              className="h-7 text-xs font-mono bg-secondary/50"
            />
          </div>
        </div>
      )}

      {/* Font family selector */}
      {!isBox && (
        <div>
          <Label className="text-xs text-muted-foreground">Fonte</Label>
          <select
            value={field.fontFamily || "Arial"}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            className="w-full h-7 text-xs rounded-md border border-border bg-secondary/50 px-2 mt-1"
          >
            {FONT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rotation for rotated fields */}
      {field.rotate !== undefined && (
        <div>
          <Label className="text-xs text-muted-foreground">Rotação (graus)</Label>
          <Input
            type="number"
            value={field.rotate}
            onChange={(e) => onUpdate({ rotate: Number(e.target.value) })}
            className="h-7 text-xs font-mono bg-secondary/50"
          />
        </div>
      )}
    </div>
  );
}

function GenericAlignContent({
  templateUrl,
  templateIsPdf = false,
  storageKey,
  title,
  fields: defaultFieldsProp,
  pageWidth = PAGE_W,
  pageHeight = PAGE_H,
}: {
  templateUrl: string;
  templateIsPdf?: boolean;
  storageKey: string;
  title: string;
  fields: FieldDef[];
  pageWidth?: number;
  pageHeight?: number;
}) {
  const sanitizeFields = useCallback((savedFields: FieldDef[]) => {
    if (!Array.isArray(savedFields) || savedFields.length !== defaultFieldsProp.length) {
      return defaultFieldsProp;
    }

    const valid = savedFields.every((field) => {
      const withinBounds = field.x >= 0 && field.y >= 0 && field.x <= pageWidth && field.y <= pageHeight;
      const validSize = (field.w === undefined || field.w <= pageWidth) && (field.h === undefined || field.h <= pageHeight);
      return withinBounds && validSize;
    });

    return valid ? savedFields : defaultFieldsProp;
  }, [defaultFieldsProp, pageHeight, pageWidth]);

  const [fields, setFields] = useState<FieldDef[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return sanitizeFields(JSON.parse(saved));
      } catch {
        return defaultFieldsProp;
      }
    }
    return defaultFieldsProp;
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [renderedPdfUrl, setRenderedPdfUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        setScale(containerRef.current.clientWidth / pageWidth);
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [pageWidth]);

  useEffect(() => {
    setFields((prev) => sanitizeFields(prev));
  }, [sanitizeFields]);

  useEffect(() => {
    if (!templateIsPdf) {
      setRenderedPdfUrl(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument(templateUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob || !active) return;

        objectUrl = URL.createObjectURL(blob);
        setRenderedPdfUrl(objectUrl);
      } catch (error) {
        console.error("Error rendering PDF background for alignment:", error);
        if (active) setRenderedPdfUrl(null);
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [templateIsPdf, templateUrl]);

  const updateField = useCallback((id: string, updates: Partial<FieldDef>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(fieldId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;
    setDragging({ id: fieldId, offsetX: mouseX - field.x, offsetY: mouseY - field.y });
  }, [fields, scale]);

  const handleTouchStart = useCallback((e: React.TouchEvent, fieldId: string) => {
    e.stopPropagation();
    setSelected(fieldId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    const touch = e.touches[0];
    const mouseX = (touch.clientX - rect.left) / scale;
    const mouseY = (touch.clientY - rect.top) / scale;
    setDragging({ id: fieldId, offsetX: mouseX - field.x, offsetY: mouseY - field.y });
  }, [fields, scale]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.round((clientX - rect.left) / scale - dragging.offsetX);
      const y = Math.round((clientY - rect.top) / scale - dragging.offsetY);
      setFields(prev => prev.map(f =>
        f.id === dragging.id ? { ...f, x: Math.max(0, Math.min(pageWidth, x)), y: Math.max(0, Math.min(pageHeight, y)) } : f
      ));
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onEnd = () => setDragging(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dragging, pageHeight, pageWidth, scale]);

  useEffect(() => {
    if (!selected) return;
    const handleKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      let dx = 0, dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      setFields(prev => prev.map(f =>
        f.id === selected ? { ...f, x: Math.max(0, Math.min(pageWidth, f.x + dx)), y: Math.max(0, Math.min(pageHeight, f.y + dy)) } : f
      ));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pageHeight, pageWidth, selected]);

  const savePositions = () => {
    localStorage.setItem(storageKey, JSON.stringify(fields));
    toast({ title: "Posições salvas!", description: "As coordenadas foram salvas no navegador." });
  };

  const resetPositions = () => {
    setFields(defaultFieldsProp);
    localStorage.removeItem(storageKey);
    setSelected(null);
    toast({ title: "Posições resetadas!" });
  };

  const copyCode = () => {
    const obj = fields.reduce((acc, f) => {
      acc[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize, ...(f.w ? { w: f.w } : {}), ...(f.h ? { h: f.h } : {}), ...(f.rotate !== undefined ? { rotate: f.rotate } : {}), ...(f.fontFamily && f.fontFamily !== "Arial" ? { fontFamily: f.fontFamily } : {}) };
      return acc;
    }, {} as Record<string, any>);
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    toast({ title: "Coordenadas copiadas!", description: "Cole no chat para aplicar no PDF." });
  };

  const selectedField = fields.find(f => f.id === selected);

  const getCnhFont = (fieldId: string) => {
    if (fieldId === "mrz") return "'Courier New', 'Courier', monospace";
    return "'Arial', 'Helvetica Neue', 'Helvetica', sans-serif";
  };

  const backgroundUrl = templateIsPdf ? renderedPdfUrl : templateUrl;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-foreground font-display">{title}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={resetPositions} className="gap-1.5">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button size="sm" variant="outline" onClick={copyCode} className="gap-1.5">
            <Copy className="w-4 h-4" /> Copiar Coords
          </Button>
          <Button size="sm" onClick={savePositions} className="gap-1.5">
            <Save className="w-4 h-4" /> Salvar
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Arraste os campos para posicioná-los. Use setas do teclado (Shift = 5px). Clique num campo para ajustar tamanho da fonte e posição.
      </p>

      {selectedField && (
        <FieldPropertiesPanel
          field={selectedField}
          onUpdate={(updates) => updateField(selectedField.id, updates)}
        />
      )}

      <div className="overflow-auto border border-border rounded-xl bg-white">
        <div
          ref={containerRef}
          className="relative select-none w-full"
          style={{
            aspectRatio: `${pageWidth} / ${pageHeight}`,
            maxWidth: pageWidth,
          }}
          onClick={() => setSelected(null)}
        >
          {backgroundUrl ? (
            <img
              src={backgroundUrl}
              alt="Template"
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "fill" }}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-sm">
              Carregando template...
            </div>
          )}

          {fields.map((f) => {
            const isSelected = f.id === selected;
            const isBox = f.isBox || f.id === "photo" || f.id === "signature" || f.id === "brasao";

            return (
              <div
                key={f.id}
                onMouseDown={(e) => handleMouseDown(e, f.id)}
                onTouchStart={(e) => handleTouchStart(e, f.id)}
                className="absolute cursor-move touch-none"
                style={{
                  top: `${(f.y / pageHeight) * 100}%`,
                  left: `${(f.x / pageWidth) * 100}%`,
                  fontSize: `${f.fontSize * scale}px`,
                  fontWeight: "bold",
                  fontFamily: f.fontFamily || getCnhFont(f.id),
                  color: f.color || "#111",
                  whiteSpace: "pre-line",
                  border: isSelected ? "2px solid hsl(var(--primary))" : "1px dashed rgba(0,0,0,0.2)",
                  background: isSelected ? "hsl(var(--primary) / 0.1)" : "transparent",
                  borderRadius: "2px",
                  padding: "1px 2px",
                  zIndex: isSelected ? 50 : 10,
                  transform: f.rotate ? `rotate(${f.rotate}deg)` : undefined,
                  transformOrigin: f.rotate ? "left top" : undefined,
                  letterSpacing: f.id === "mrz" ? `${1.6 * scale}px` : f.rotate ? `${1.2 * scale}px` : undefined,
                  lineHeight: f.id === "mrz" ? 1.6 : undefined,
                  ...(isBox ? {
                    width: `${(((f.w || 80) / pageWidth) * 100).toFixed(4)}%`,
                    height: `${(((f.h || 80) / pageHeight) * 100).toFixed(4)}%`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isSelected ? "hsl(var(--primary) / 0.15)" : "rgba(200,200,200,0.3)",
                  } : {}),
                }}
                title={`${f.label}: x=${f.x}, y=${f.y}, font=${f.fontSize}`}
              >
                {isBox ? (
                  f.imageUrl ? (
                    <img src={f.imageUrl} alt={f.label} className="w-full h-full object-contain" draggable={false} />
                  ) : (
                    <span style={{ fontSize: `${10 * scale}px`, color: "#666" }}>{f.label}</span>
                  )
                ) : (
                  f.sampleText
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CnhAlignContent() {
  return <GenericAlignContent templateUrl={templateBgUrl} storageKey="cnh-field-positions" title="Alinhamento - CNH" fields={defaultFields} />;
}

// CNH Física frente: coordenadas reais da edge function (sem MRZ)
const defaultFisicaFrenteFields: FieldDef[] = [
  { id: "photo", label: "Foto", sampleText: "[FOTO]", x: 88, y: 106, fontSize: 8, w: 82, h: 110, color: "#999" },
  { id: "signature", label: "Assinatura", sampleText: "[ASSINATURA]", x: 85, y: 216, fontSize: 7, w: 95, h: 32, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "MARIA OLIVEIRA SANTOS", x: 95, y: 86, fontSize: 6.5 },
  { id: "primeira_hab", label: "1ª Hab", sampleText: "27/09/2017", x: 300, y: 86, fontSize: 6.5 },
  { id: "nascimento", label: "Nascimento", sampleText: "11/03/1989, RIO DE JANEIRO, RJ", x: 185, y: 106, fontSize: 6.5 },
  { id: "emissao", label: "Emissão", sampleText: "14/03/2026", x: 189, y: 123, fontSize: 6.5 },
  { id: "validade", label: "Validade", sampleText: "14/03/2036", x: 248, y: 124, fontSize: 6.5, color: "#c00" },
  { id: "cat_big", label: "Cat. Grande", sampleText: "AB", x: 331, y: 121, fontSize: 11 },
  { id: "rg", label: "RG", sampleText: "3963221 SSP PR", x: 184, y: 143, fontSize: 6.5 },
  { id: "cpf", label: "CPF", sampleText: "997.038.350-25", x: 185, y: 161, fontSize: 6.5 },
  { id: "registro", label: "Registro", sampleText: "07915888995", x: 250, y: 161, fontSize: 6.5, color: "#c00" },
  { id: "cat_hab", label: "Cat. Hab", sampleText: "AB", x: 312, y: 162, fontSize: 7, color: "#c00" },
  { id: "nacionalidade", label: "Nacionalidade", sampleText: "BRASILEIRA", x: 184, y: 180, fontSize: 6.5 },
  { id: "pai", label: "Pai", sampleText: "JOSE DA SILVA", x: 184, y: 200, fontSize: 6.5 },
  { id: "mae", label: "Mãe", sampleText: "SANDRA COSTA", x: 184, y: 217, fontSize: 6.5 },
  { id: "validade_cat_a", label: "Validade Cat. A", sampleText: "14/03/2036", x: 169, y: 280, fontSize: 4.5 },
  { id: "validade_cat_b", label: "Validade Cat. B", sampleText: "14/03/2036", x: 169, y: 302, fontSize: 4.5 },
  { id: "validade_cat_c", label: "Validade Cat. C", sampleText: "14/03/2036", x: 169, y: 323, fontSize: 4.5 },
  { id: "validade_cat_d", label: "Validade Cat. D", sampleText: "14/03/2036", x: 271, y: 268, fontSize: 4.5 },
  { id: "validade_cat_e", label: "Validade Cat. E", sampleText: "14/03/2036", x: 271, y: 291, fontSize: 4.5 },
  { id: "obs", label: "Observações", sampleText: "EAR", x: 95, y: 359, fontSize: 5.5 },
  { id: "espelho", label: "Nº Espelho", sampleText: "77424319856", x: 279, y: 416, fontSize: 6.5 },
  { id: "renach", label: "RENACH", sampleText: "PB527125303", x: 281, y: 428, fontSize: 6.5 },
  { id: "local", label: "Local", sampleText: "RIO DE JANEIRO, RJ", x: 91, y: 434, fontSize: 6 },
  { id: "estado", label: "Estado", sampleText: "RIO GRANDE DO SUL", x: 161, y: 451, fontSize: 6, color: "#1a5c2a" },
  { id: "reg_vert_top", label: "Reg. Vertical (topo)", sampleText: "07915888995", x: 60, y: 243, fontSize: 15, rotate: -90 },
  { id: "reg_vert_bot", label: "Reg. Vertical (base)", sampleText: "07915888995", x: 66, y: 468, fontSize: 15, rotate: -90 },
];

function CnhFisicaAlignContent() {
  return <GenericAlignContent templateUrl={templateFisicaBgUrl} storageKey="cnh-fisica-field-positions" title="Alinhamento - CNH Física (Frente)" fields={defaultFisicaFrenteFields} />;
}

const defaultVersoFields: FieldDef[] = [
  { id: "mrz_verso", label: "MRZ (Verso)", sampleText: "I<BRA079158889PB927125303<<<<\n8903118M3603147BRA<<<<<<<<<<<4\nMARIA<<OLIVEIRA<<SANTOS<<<<<<<", x: 472, y: 425, fontSize: 15 },
];

function CnhFisicaVersoAlignContent() {
  return <GenericAlignContent templateUrl={templateFisicaVersoBgUrl} storageKey="cnh-fisica-verso-field-positions" title="Alinhamento - CNH Física (Verso)" fields={defaultVersoFields} />;
}

function CnhFisicaFullContent() {
  const { toast } = useToast();

  const copyFullCode = () => {
    const frenteSaved = localStorage.getItem("cnh-fisica-field-positions");
    const versoSaved = localStorage.getItem("cnh-fisica-verso-field-positions");

    const frenteFields: FieldDef[] = frenteSaved ? JSON.parse(frenteSaved) : defaultFisicaFrenteFields;
    const versoFields: FieldDef[] = versoSaved ? JSON.parse(versoSaved) : defaultVersoFields;

    const toObj = (fields: FieldDef[]) =>
      fields.reduce((acc, f) => {
        acc[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize, ...(f.w ? { w: f.w } : {}), ...(f.h ? { h: f.h } : {}), ...(f.rotate !== undefined ? { rotate: f.rotate } : {}) };
        return acc;
      }, {} as Record<string, any>);

    const result = {
      frente: toObj(frenteFields),
      verso: toObj(versoFields),
    };

    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast({ title: "Coordenadas completas copiadas!", description: "Frente + Verso copiados para aplicar na edge function." });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={copyFullCode} className="gap-1.5">
          <Copy className="w-4 h-4" /> Copiar Coords (Frente + Verso)
        </Button>
      </div>
      <CnhFisicaAlignContent />
      <div className="border-t border-border pt-6">
        <CnhFisicaVersoAlignContent />
      </div>
    </div>
  );
}

const commonCarteirinhaFields: Omit<FieldDef, 'x' | 'y' | 'w' | 'h'>[] = [
  { id: "numero_registro", label: "Nº Registro", sampleText: "45.737.175/0001-14", fontSize: 25 },
  { id: "nome", label: "Nome", sampleText: "PEDRO DA SILVA GOMES", fontSize: 25 },
  { id: "cpf", label: "CPF", sampleText: "000.000.000-00", fontSize: 25 },
  { id: "nascimento", label: "Nascimento", sampleText: "01/01/1990", fontSize: 25 },
  { id: "cidade_uf", label: "Cidade/UF", sampleText: "SÃO PAULO, SP", fontSize: 25 },
  { id: "formacao", label: "Formação", sampleText: "01/06/2020", fontSize: 25 },
  { id: "validade", label: "Validade", sampleText: "01/06/2030", fontSize: 25 },
  { id: "emergencia1", label: "Emergência 1", sampleText: "(11) 99999-0000", fontSize: 25 },
  { id: "emergencia2", label: "Emergência 2", sampleText: "(11) 88888-0000", fontSize: 25 },
];

const sharedTextPositions = {
  numero_registro: { x: 287, y: 124 },
  nome: { x: 76, y: 281 },
  cpf: { x: 80, y: 357 },
  nascimento: { x: 77, y: 437 },
  cidade_uf: { x: 210, y: 436 },
  formacao: { x: 72, y: 630 },
  validade: { x: 580, y: 202 },
  emergencia1: { x: 78, y: 789 },
  emergencia2: { x: 429, y: 789 },
};

const agenteFinanceiroTextPositions = {
  numero_registro: { x: 294, y: 112 },
  nome: { x: 76, y: 281 },
  cpf: { x: 134, y: 351 },
  nascimento: { x: 77, y: 437 },
  cidade_uf: { x: 210, y: 436 },
  formacao: { x: 72, y: 630 },
  validade: { x: 580, y: 202 },
  emergencia1: { x: 78, y: 789 },
  emergencia2: { x: 429, y: 789 },
};

const bombeiroMilitarVersoFields: FieldDef[] = [
  { id: "cpf", label: "CPF", sampleText: "000.000.000-00", x: 42, y: 20, fontSize: 8 },
  { id: "tipo_sanguineo", label: "Tipo Sanguíneo", sampleText: "O+", x: 163, y: 25, fontSize: 8 },
  { id: "rg", label: "RG", sampleText: "00.000.000", x: 42, y: 47, fontSize: 8 },
  { id: "data_expedicao_1", label: "Data de Expedição", sampleText: "01/06/2024", x: 147, y: 51, fontSize: 8 },
];

const bombeiroMilitarFrenteFields: FieldDef[] = [
  { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 20, y: 79, fontSize: 4, w: 45, h: 50, color: "#999" },
  { id: "numero_registro", label: "Nº Registro", sampleText: "000.000.000", x: 81, y: 37, fontSize: 8 },
  { id: "data_expedicao_2", label: "Data de Expedição", sampleText: "01/06/2024", x: 161, y: 37, fontSize: 8 },
  { id: "validade", label: "Validade", sampleText: "01/06/2030", x: 169, y: 53, fontSize: 5.2 },
  { id: "nome", label: "Nome", sampleText: "PEDRO DA SILVA GOMES", x: 97, y: 118, fontSize: 8 },
];

const operadorMaquinasVersoFields: FieldDef[] = [
  { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 15, y: 40, fontSize: 4, w: 50, h: 60, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "PEDRO DA SILVA GOMES", x: 80, y: 50, fontSize: 8 },
  { id: "rg_orgao_uf", label: "RG/Órgão/UF", sampleText: "12.345.678 SSP SP", x: 80, y: 65, fontSize: 7 },
  { id: "cpf", label: "CPF", sampleText: "000.000.000-00", x: 80, y: 80, fontSize: 7 },
  { id: "nascimento", label: "Nascimento", sampleText: "01/01/1990", x: 80, y: 95, fontSize: 7 },
  { id: "categoria", label: "Categoria", sampleText: "D", x: 80, y: 110, fontSize: 8 },
  { id: "filiacao", label: "Filiação", sampleText: "SOUZA E SOUZINHA", x: 80, y: 125, fontSize: 7 },
  { id: "equipamento", label: "Equipamento", sampleText: "Retroescavadeira", x: 30, y: 30, fontSize: 7 },
  { id: "nivel", label: "Nível", sampleText: "2", x: 30, y: 50, fontSize: 7 },
  { id: "emissao", label: "Emissão", sampleText: "01/06/2024", x: 30, y: 70, fontSize: 7 },
  { id: "validade", label: "Validade", sampleText: "01/06/2030", x: 30, y: 90, fontSize: 7 },
];

const carteirinhaFieldsByTipo: Record<string, FieldDef[]> = {
  bombeiro: [
    { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 54, y: 50, fontSize: 4, w: 142, h: 189, color: "#999" },
    ...commonCarteirinhaFields.map(f => ({ ...f, ...sharedTextPositions[f.id as keyof typeof sharedTextPositions] }) as FieldDef),
  ],
  porteiro: [
    { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 73, y: 38, fontSize: 4, w: 159, h: 189, color: "#999" },
    ...commonCarteirinhaFields.map(f => ({ ...f, ...sharedTextPositions[f.id as keyof typeof sharedTextPositions] }) as FieldDef),
  ],
  "agente-financeiro": [
    { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 68, y: 41, fontSize: 4, w: 159, h: 189, color: "#999" },
    ...commonCarteirinhaFields.map(f => ({ ...f, ...agenteFinanceiroTextPositions[f.id as keyof typeof agenteFinanceiroTextPositions] }) as FieldDef),
  ],
};

const CARTEIRINHA_TEMPLATES: Record<string, string> = {
  bombeiro: templateBombeiroUrl,
  porteiro: templatePorteiroUrl,
  "agente-financeiro": templateAgenteUrl,
};

function CarteirinhaAlignContent({ tipo, tipoLabel, storageKey }: { tipo: string; tipoLabel: string; storageKey: string }) {
  return (
    <GenericAlignContent
      templateUrl={CARTEIRINHA_TEMPLATES[tipo] || ""}
      storageKey={storageKey}
      title={`Alinhamento — Carteira de ${tipoLabel}`}
      fields={carteirinhaFieldsByTipo[tipo] || carteirinhaFieldsByTipo["bombeiro"]}
    />
  );
}

function BombeiroMilitarAlignContent() {
  const { toast } = useToast();

  const handleCopyBoth = () => {
    const frenteRaw = localStorage.getItem("carteirinha-bombeiro-militar-frente-field-positions");
    const versoRaw = localStorage.getItem("carteirinha-bombeiro-militar-verso-field-positions");
    const combined = {
      frente: frenteRaw ? JSON.parse(frenteRaw) : null,
      verso: versoRaw ? JSON.parse(versoRaw) : null,
    };
    navigator.clipboard.writeText(JSON.stringify(combined, null, 2));
    toast({ title: "Coordenadas copiadas", description: "Frente e verso copiados para a área de transferência." });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleCopyBoth}>
          <Copy className="w-4 h-4 mr-2" /> Copiar Frente + Verso
        </Button>
      </div>
      <Tabs defaultValue="frente" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="frente">FRENTE</TabsTrigger>
          <TabsTrigger value="verso">VERSO</TabsTrigger>
        </TabsList>
        <TabsContent value="frente">
          <GenericAlignContent
            templateUrl={templateBombeiroMilitarFrenteUrl}
            storageKey="carteirinha-bombeiro-militar-frente-field-positions"
            title="Alinhamento — Carteira de Bombeiro Militar (Frente)"
            fields={bombeiroMilitarFrenteFields}
            pageWidth={BOMBEIRO_MILITAR_W}
            pageHeight={BOMBEIRO_MILITAR_H}
          />
        </TabsContent>
        <TabsContent value="verso">
          <GenericAlignContent
            templateUrl={templateBombeiroMilitarVersoUrl}
            storageKey="carteirinha-bombeiro-militar-verso-field-positions"
            title="Alinhamento — Carteira de Bombeiro Militar (Verso)"
            fields={bombeiroMilitarVersoFields}
            pageWidth={BOMBEIRO_MILITAR_W}
            pageHeight={BOMBEIRO_MILITAR_H}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const OPERADOR_MAQUINAS_W = 595;
const OPERADOR_MAQUINAS_H = 842;

function OperadorMaquinasAlignContent() {
  const [versoUrl, setVersoUrl] = useState<string | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ w: number; h: number }>({ w: OPERADOR_MAQUINAS_W, h: OPERADOR_MAQUINAS_H });

  useEffect(() => {
    let objectUrl: string | null = null;

    (async () => {
      try {
        const res = await fetch("/assets/template-carteira-operador-maquinas.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const { PDFDocument } = await import("pdf-lib");
        const srcDoc = await PDFDocument.load(arrayBuffer);
        const page = srcDoc.getPage(0);
        const { width, height } = page.getSize();

        setPdfPageSize({ w: Math.round(width), h: Math.round(height) });

        const newDoc = await PDFDocument.create();
        const [copied] = await newDoc.copyPages(srcDoc, [0]);
        newDoc.addPage(copied);
        const pdfBytes = await newDoc.save();
        const blob = new Blob([(pdfBytes as Uint8Array).buffer as ArrayBuffer], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        setVersoUrl(objectUrl);
      } catch (e) {
        console.error("Error loading operador maquinas template:", e);
      }
    })();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return (
    <div className="space-y-4">
      {versoUrl ? (
        <GenericAlignContent
          templateUrl={versoUrl}
          templateIsPdf
          storageKey="carteirinha-operador-maquinas-verso-field-positions"
          title="Alinhamento — Operador de Máquinas (Verso)"
          fields={operadorMaquinasVersoFields}
          pageWidth={pdfPageSize.w}
          pageHeight={pdfPageSize.h}
        />
      ) : (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// Actual PDF page dimensions from the template (landscape card)
const SEGURANCA_ESCOLAR_W = 241;
const SEGURANCA_ESCOLAR_H = 142;

const segurancaEscolarFrenteFields: FieldDef[] = [
  { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 12, y: 9, fontSize: 4, w: 40, h: 50, color: "#999" },
  { id: "nome", label: "Nome Completo", sampleText: "PEDRO DA SILVA GOMES", x: 12, y: 64, fontSize: 6 },
  { id: "cpf", label: "CPF", sampleText: "000.000.000-00", x: 11, y: 88, fontSize: 5 },
  { id: "numero_registro", label: "Nº Registro", sampleText: "1031/26", x: 61, y: 32, fontSize: 6 },
  { id: "data_expedicao", label: "Data de Expedição", sampleText: "01/06/2024", x: 182, y: 33, fontSize: 5 },
  { id: "nascimento", label: "Data de Nascimento", sampleText: "01/01/1990", x: 19, y: 114, fontSize: 5 },
  { id: "termino_curso", label: "Término do Curso", sampleText: "01/06/2024", x: 113, y: 114, fontSize: 5 },
];

const segurancaEscolarVersoFields: FieldDef[] = [
  { id: "rg", label: "RG", sampleText: "00.000.000", x: 178, y: 20, fontSize: 6 },
];

function SegurancaEscolarAlignContent() {
  const { toast } = useToast();

  const handleCopyBoth = () => {
    const frenteRaw = localStorage.getItem("carteirinha-seguranca-escolar-frente-field-positions");
    const versoRaw = localStorage.getItem("carteirinha-seguranca-escolar-verso-field-positions");
    const combined = {
      frente: frenteRaw ? JSON.parse(frenteRaw) : null,
      verso: versoRaw ? JSON.parse(versoRaw) : null,
    };
    navigator.clipboard.writeText(JSON.stringify(combined, null, 2));
    toast({ title: "Coordenadas copiadas", description: "Frente e verso copiados para a área de transferência." });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleCopyBoth}>
          <Copy className="w-4 h-4 mr-2" /> Copiar Frente + Verso
        </Button>
      </div>
      <Tabs defaultValue="frente" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="frente">FRENTE</TabsTrigger>
          <TabsTrigger value="verso">VERSO</TabsTrigger>
        </TabsList>
        <TabsContent value="frente">
          <GenericAlignContent
            templateUrl={templateSegurancaEscolarFrenteUrl}
            storageKey="carteirinha-seguranca-escolar-frente-field-positions"
            title="Alinhamento — Segurança Escolar (Frente)"
            fields={segurancaEscolarFrenteFields}
            pageWidth={SEGURANCA_ESCOLAR_W}
            pageHeight={SEGURANCA_ESCOLAR_H}
          />
        </TabsContent>
        <TabsContent value="verso">
          <GenericAlignContent
            templateUrl={templateSegurancaEscolarVersoUrl}
            storageKey="carteirinha-seguranca-escolar-verso-field-positions"
            title="Alinhamento — Segurança Escolar (Verso)"
            fields={segurancaEscolarVersoFields}
            pageWidth={SEGURANCA_ESCOLAR_W}
            pageHeight={SEGURANCA_ESCOLAR_H}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const chaAmadorFields: FieldDef[] = [
  { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 595, y: 269, fontSize: 8, w: 170, h: 220, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "CARLOS EDUARDO DA SILVA", x: 94, y: 221, fontSize: 28 },
  { id: "nascimento", label: "Nascimento", sampleText: "15/01/1990", x: 90, y: 296, fontSize: 28 },
  { id: "cpf", label: "CPF", sampleText: "123.456.789-00", x: 544, y: 294, fontSize: 26 },
  { id: "inscricao", label: "Nº Inscrição", sampleText: "937W5283046218", x: 95, y: 434, fontSize: 28 },
  { id: "validade", label: "Validade", sampleText: "15/01/2031", x: 544, y: 722, fontSize: 27 },
  { id: "emissao", label: "Data de Emissão", sampleText: "18/03/2026", x: 100, y: 730, fontSize: 20 },
];

function ChaAmadorAlignContent() {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = templateChaAmadorUrl;
  }, []);

  if (!imgSize) return <p className="text-muted-foreground text-sm p-4">Carregando template...</p>;

  return (
    <GenericAlignContent
      templateUrl={templateChaAmadorUrl}
      storageKey="cha-amador-field-positions"
      title="Alinhamento — CHÁ Amador Digital"
      fields={chaAmadorFields}
      pageWidth={imgSize.w}
      pageHeight={imgSize.h}
    />
  );
}

const cedulaPoliciaFields: FieldDef[] = [
  { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 70, y: 207, fontSize: 8, w: 180, h: 220, color: "#999" },
  { id: "matricula", label: "Matrícula", sampleText: "7.878.786", x: 336, y: 483, fontSize: 14 },
  { id: "nomeCompleto", label: "Nome Completo", sampleText: "PEDRO DA SILVA GOMES", x: 74, y: 548, fontSize: 14 },
  { id: "rgEstado", label: "RG e Estado", sampleText: "1234567 SDS/PE", x: 76, y: 618, fontSize: 14 },
  { id: "registroData", label: "Nº Registro e Data", sampleText: "8976. 24/02/2026", x: 81, y: 686, fontSize: 14 },
  { id: "tipoSanguineo", label: "Tipo Sanguíneo", sampleText: "O+", x: 352, y: 617, fontSize: 14 },
  { id: "cmCategoria", label: "CM / Categoria", sampleText: "NÚMERO, XXXXXXXXXXXX / A, B", x: 267, y: 688, fontSize: 12 },
];

function CedulaPoliciaAlignContent() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ w: number; h: number }>({ w: PAGE_W, h: PAGE_H });

  useEffect(() => {
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await fetch("/assets/template-cedula-policia-pe.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const { PDFDocument } = await import("pdf-lib");
        const srcDoc = await PDFDocument.load(arrayBuffer);
        const page = srcDoc.getPage(0);
        const { width, height } = page.getSize();
        setPdfPageSize({ w: Math.round(width), h: Math.round(height) });

        const newDoc = await PDFDocument.create();
        const [copied] = await newDoc.copyPages(srcDoc, [0]);
        newDoc.addPage(copied);
        const pdfBytes = await newDoc.save();
        const blob = new Blob([(pdfBytes as Uint8Array).buffer as ArrayBuffer], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (e) {
        console.error("Error loading cedula policia template:", e);
      }
    })();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, []);

  return (
    <div className="space-y-4">
      {pdfUrl ? (
        <GenericAlignContent
          templateUrl={pdfUrl}
          templateIsPdf
          storageKey="cedula-policia-pe-field-positions"
          title="Alinhamento — Cédula de Polícia Militar PE"
          fields={cedulaPoliciaFields}
          pageWidth={pdfPageSize.w}
          pageHeight={pdfPageSize.h}
        />
      ) : (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

const operadorMaquinasDigitalFields: FieldDef[] = [
  { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 55, y: 72, fontSize: 8, w: 70, h: 85, color: "#999" },
  { id: "nomeCompleto", label: "Nome Completo", sampleText: "AGEU PEREIRA DA SILVA", x: 56, y: 59, fontSize: 7.5 },
  { id: "rg", label: "RG", sampleText: "12.345.678-9", x: 134, y: 78, fontSize: 7.5 },
  { id: "ferramenta", label: "Ferramenta", sampleText: "Retroescavadeira", x: 131, y: 98, fontSize: 7.5 },
  { id: "numeroRegistro", label: "Nº Registro", sampleText: "12345678901AB", x: 63, y: 164, fontSize: 6 },
  { id: "validade", label: "Validade", sampleText: "FEVEREIRO/2027", x: 141, y: 165, fontSize: 5 },
  { id: "exameMedico", label: "Exame Médico", sampleText: "XR-11.1.6.1-ASO ANUAL", x: 195, y: 165, fontSize: 6 },
];

function OperadorMaquinasDigitalAlignContent() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ w: number; h: number }>({ w: PAGE_W, h: PAGE_H });

  useEffect(() => {
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await fetch("/assets/template-carteira-operador-maquinas-digital.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const { PDFDocument } = await import("pdf-lib");
        const srcDoc = await PDFDocument.load(arrayBuffer);
        const page = srcDoc.getPage(0);
        const { width, height } = page.getSize();
        setPdfPageSize({ w: Math.round(width), h: Math.round(height) });

        const newDoc = await PDFDocument.create();
        const [copied] = await newDoc.copyPages(srcDoc, [0]);
        newDoc.addPage(copied);
        const pdfBytes = await newDoc.save();
        const blob = new Blob([(pdfBytes as Uint8Array).buffer as ArrayBuffer], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (e) {
        console.error("Error loading operador maquinas digital template:", e);
      }
    })();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, []);

  return (
    <div className="space-y-4">
      {pdfUrl ? (
        <GenericAlignContent
          templateUrl={pdfUrl}
          templateIsPdf
          storageKey="operador-maquinas-digital-field-positions"
          title="Alinhamento — Operador de Máquinas Digital"
          fields={operadorMaquinasDigitalFields}
          pageWidth={pdfPageSize.w}
          pageHeight={pdfPageSize.h}
        />
      ) : (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

const cpfFisicoFields: FieldDef[] = [
  { id: "cpf", label: "CPF", sampleText: "000.000.000-00", x: 117, y: 109, fontSize: 13 },
  { id: "nomeCompleto", label: "Nome Completo", sampleText: "EMILY BARBOSA DO NASCIMENTO", x: 85, y: 146, fontSize: 11 },
  { id: "dataNascimento", label: "Data de Nascimento", sampleText: "15/01/1990", x: 134, y: 190, fontSize: 12 },
  { id: "data", label: "Data", sampleText: "24/02/2026", x: 121, y: 345, fontSize: 5 },
  { id: "hora", label: "Hora", sampleText: "14:35", x: 68, y: 345, fontSize: 7 },
];

function CpfFisicoAlignContent() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ w: number; h: number }>({ w: PAGE_W, h: PAGE_H });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/assets/template-cpf-fisico.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        setPdfPageSize({ w: viewport.width, h: viewport.height });

        const canvas = document.createElement("canvas");
        const scale = 2;
        const sv = page.getViewport({ scale });
        canvas.width = sv.width;
        canvas.height = sv.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: sv }).promise;
        setPdfUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Error loading CPF PDF template:", err);
      }
    })();
  }, []);

  if (!pdfUrl) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando template...</div>;

  return (
    <GenericAlignContent
      templateUrl={pdfUrl}
      storageKey="cpf-fisico-field-positions"
      title="Alinhamento — CPF Físico"
      fields={cpfFisicoFields}
      pageWidth={pdfPageSize.w}
      pageHeight={pdfPageSize.h}
    />
  );
}

const cnhNauticaFields: FieldDef[] = [
  { id: "nomeCompleto", label: "Nome Completo", sampleText: "CARLOS EDUARDO DA SILVA", x: 94, y: 221, fontSize: 28 },
  { id: "dataNascimento", label: "Nascimento", sampleText: "15/01/1990", x: 90, y: 296, fontSize: 28 },
  { id: "rgOrgaoUf", label: "RG/Órgão/UF", sampleText: "12345678 SSP/SP", x: 259, y: 296, fontSize: 28 },
  { id: "cpf", label: "CPF", sampleText: "000.000.000-00", x: 529, y: 297, fontSize: 26 },
  { id: "inscricao", label: "Inscrição", sampleText: "215A2023852176", x: 95, y: 434, fontSize: 28 },
  { id: "dataEmissao", label: "Data de Emissão", sampleText: "15/03/2026", x: 558, y: 731, fontSize: 23.5 },
  { id: "localEmissao", label: "Local da Emissão", sampleText: "CAPITANIA DOS PORTOS DE SÃO PAULO", x: 100, y: 730, fontSize: 20 },
  { id: "validade", label: "Validade", sampleText: "12/02/2028", x: 552, y: 437, fontSize: 24.5 },
];

function CnhNauticaAlignContent() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ w: number; h: number }>({ w: PAGE_W, h: PAGE_H });

  useEffect(() => {
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await fetch("/assets/template-cha-amador.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const { PDFDocument } = await import("pdf-lib");
        const srcDoc = await PDFDocument.load(arrayBuffer);
        const page = srcDoc.getPage(0);
        const { width, height } = page.getSize();
        setPdfPageSize({ w: Math.round(width), h: Math.round(height) });

        const newDoc = await PDFDocument.create();
        const [copied] = await newDoc.copyPages(srcDoc, [0]);
        newDoc.addPage(copied);
        const pdfBytes = await newDoc.save();
        const blob = new Blob([(pdfBytes as Uint8Array).buffer as ArrayBuffer], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (e) {
        console.error("Error loading cnh nautica template:", e);
      }
    })();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, []);

  return (
    <div className="space-y-4">
      {pdfUrl ? (
        <GenericAlignContent
          templateUrl={pdfUrl}
          templateIsPdf
          storageKey="cnh-nautica-field-positions"
          title="Alinhamento — Arrais Amador Físico"
          fields={cnhNauticaFields}
          pageWidth={pdfPageSize.w}
          pageHeight={pdfPageSize.h}
        />
      ) : (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

const historicoEscolarFields: FieldDef[] = [
  { id: "brasao", label: "Brasão do Estado", sampleText: "[BRASÃO]", x: 65, y: 56, fontSize: 9, w: 55, h: 65, color: "#999", isBox: true },
  { id: "estadoEscola1", label: "Estado Extenso (cabeçalho)", sampleText: "PERNAMBUCO", x: 321, y: 24, fontSize: 13 },
  { id: "estadoEscola2", label: "Estado (rodapé)", sampleText: "PE", x: 525, y: 554, fontSize: 8 },
  { id: "endereco", label: "Endereço", sampleText: "RUA FIRMEZA", x: 195, y: 94, fontSize: 7 },
  { id: "numero", label: "Número", sampleText: "1000", x: 493, y: 94, fontSize: 7 },
  { id: "bairro", label: "Bairro", sampleText: "JAGUARIBE", x: 178, y: 104, fontSize: 7 },
  { id: "municipioEscola", label: "Município Escola", sampleText: "ESCADA", x: 453, y: 554, fontSize: 8 },
  { id: "cep", label: "CEP", sampleText: "55500000", x: 478, y: 106, fontSize: 7 },
  { id: "telefone", label: "Telefone", sampleText: "(81) 992120805", x: 186, y: 120, fontSize: 7 },
  { id: "nomeAluno", label: "Nome do Aluno", sampleText: "ALUNO SOUZA", x: 114, y: 166, fontSize: 7 },
  { id: "dataNascimento", label: "Data Nascimento", sampleText: "12/02/2004", x: 117, y: 182, fontSize: 8.5 },
  { id: "nomeMae", label: "Nome da Mãe", sampleText: "MÃE DO SOUZA", x: 366, y: 191, fontSize: 7 },
  { id: "estadoAluno", label: "Estado Aluno", sampleText: "PE", x: 378, y: 176, fontSize: 8 },
  { id: "rg", label: "RG", sampleText: "39.284.859-0", x: 360, y: 165, fontSize: 7 },
  { id: "municipioCabecalho", label: "Município (cabeçalho)", sampleText: "ESCADA", x: 316, y: 104, fontSize: 7 },
  { id: "anoFundamental", label: "Ano Fundamental", sampleText: "8ª Série / 9º Ano", x: 240, y: 727, fontSize: 6 },
  { id: "escolaFundamental", label: "Escola Fundamental", sampleText: "ERNESTO FILHO", x: 291, y: 552, fontSize: 6 },
  { id: "ufFundamental", label: "UF Fundamental", sampleText: "PE", x: 525, y: 576, fontSize: 6 },
  { id: "municipioFundamental", label: "Município Fundamental", sampleText: "ESCADA", x: 454, y: 576, fontSize: 6 },
  { id: "medioAno1", label: "1ª Série Ano", sampleText: "2000", x: 192, y: 557, fontSize: 6 },
  { id: "medioEscola1", label: "1ª Série Escola", sampleText: "COSTA E SILVA", x: 290, y: 600, fontSize: 6 },
  { id: "medioUf1", label: "1ª Série UF", sampleText: "PE", x: 525, y: 587, fontSize: 6 },
  { id: "medioMunicipio1", label: "1ª Série Município", sampleText: "ESCADA", x: 455, y: 587, fontSize: 6 },
  { id: "medioAno2", label: "2ª Série Ano", sampleText: "2001", x: 189, y: 578, fontSize: 6 },
  { id: "medioEscola2", label: "2ª Série Escola", sampleText: "VIGÁRIO PEDROSA", x: 288, y: 578, fontSize: 6 },
  { id: "medioUf2", label: "2ª Série UF", sampleText: "PE", x: 524, y: 598, fontSize: 6 },
  { id: "medioMunicipio2", label: "2ª Série Município", sampleText: "ESCADA", x: 455, y: 598, fontSize: 6 },
  { id: "medioAno3", label: "3ª Série Ano", sampleText: "2002", x: 90, y: 818, fontSize: 6 },
  { id: "medioEscola3", label: "3ª Série Escola", sampleText: "ESCOLA TRÊS", x: 200, y: 818, fontSize: 6 },
  { id: "medioUf3", label: "3ª Série UF", sampleText: "PE", x: 430, y: 818, fontSize: 6 },
  { id: "medioMunicipio3", label: "3ª Série Município", sampleText: "ESCADA", x: 370, y: 818, fontSize: 6 },
  { id: "escolaConclusao", label: "Escola Conclusão", sampleText: "PROF. JOÃO REIS", x: 291, y: 590, fontSize: 6 },
  { id: "nomeConcludente", label: "Nome Concludente", sampleText: "ALUNO SOUZA", x: 248, y: 276, fontSize: 6 },
  { id: "anoFinalizacao", label: "Ano Finalização", sampleText: "2004", x: 135, y: 665, fontSize: 10.5 },
];

function HistoricoEscolarAlignContent() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ w: number; h: number }>({ w: 595, h: 842 });
  const [fieldsWithBrasao, setFieldsWithBrasao] = useState<FieldDef[]>(historicoEscolarFields);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/assets/template-historico-escolar.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        setPdfPageSize({ w: Math.round(vp.width), h: Math.round(vp.height) });

        const canvas = document.createElement("canvas");
        const scale = 2;
        const sv = page.getViewport({ scale });
        canvas.width = sv.width;
        canvas.height = sv.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: sv }).promise;
        setPdfUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Error loading Histórico Escolar PDF template:", err);
      }
    })();
  }, []);

  // Load brasão image for PE
  useEffect(() => {
    (async () => {
      try {
        const { loadBrasaoImage } = await import("@/lib/brasoes-estados");
        const img = await loadBrasaoImage("PE");
        if (img) {
          // Convert to data URL
          const c = document.createElement("canvas");
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          const ctx = c.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = c.toDataURL("image/png");
            setFieldsWithBrasao(prev => prev.map(f =>
              f.id === "brasao" ? { ...f, imageUrl: dataUrl } : f
            ));
          }
        }
      } catch (err) {
        console.error("Error loading brasão for alignment:", err);
      }
    })();
  }, []);

  if (!pdfUrl) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando template...</div>;

  return (
    <GenericAlignContent
      templateUrl={pdfUrl}
      storageKey="historico-escolar-field-positions"
      title="Alinhamento — Histórico Escolar"
      fields={fieldsWithBrasao}
      pageWidth={pdfPageSize.w}
      pageHeight={pdfPageSize.h}
    />
  );
}

const declaracaoEscolarFields: FieldDef[] = [
  { id: "nomeEscola", label: "Nome da Escola", sampleText: "ESCOLA ESTADUAL PROF. JOÃO REIS", x: 160, y: 260, fontSize: 11 },
  { id: "nomeCompleto", label: "Nome Completo", sampleText: "CARLOS EDUARDO DA SILVA", x: 185, y: 290, fontSize: 11 },
  { id: "rg", label: "RG", sampleText: "12.345.678-9", x: 340, y: 320, fontSize: 11 },
  { id: "dataNascimento", label: "Data de Nascimento", sampleText: "03/04/1995", x: 200, y: 350, fontSize: 11 },
  { id: "municipio", label: "Município", sampleText: "RECIFE", x: 250, y: 380, fontSize: 11 },
  { id: "estado", label: "Estado", sampleText: "PERNAMBUCO", x: 400, y: 380, fontSize: 11 },
];

function DeclaracaoEscolarAlignContent() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ w: number; h: number }>({ w: 595, h: 842 });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/assets/template-declaracao-escolar.pdf");
        const arrayBuffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        setPdfPageSize({ w: Math.round(vp.width), h: Math.round(vp.height) });

        const canvas = document.createElement("canvas");
        const scale = 2;
        const sv = page.getViewport({ scale });
        canvas.width = sv.width;
        canvas.height = sv.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: sv }).promise;
        setPdfUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Error loading Declaração Escolar PDF template:", err);
      }
    })();
  }, []);

  if (!pdfUrl) return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando template...</div>;

  return (
    <GenericAlignContent
      templateUrl={pdfUrl}
      storageKey="declaracao-escolar-field-positions"
      title="Alinhamento — Declaração Escolar"
      fields={declaracaoEscolarFields}
      pageWidth={pdfPageSize.w}
      pageHeight={pdfPageSize.h}
    />
  );
}

export default function TemplateAlignPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-foreground font-display">Editor de Alinhamento</h1>
      <Tabs defaultValue="digitais" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="digitais">SERVIÇOS DIGITAIS</TabsTrigger>
          <TabsTrigger value="fisicos">SERVIÇOS FÍSICOS</TabsTrigger>
        </TabsList>

        <TabsContent value="digitais">
          <Tabs defaultValue="cnh" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="cnh">CNH</TabsTrigger>
              <TabsTrigger value="certidao">CERT NASCIMENTO</TabsTrigger>
              <TabsTrigger value="comprovante">COMPROVANTE RES.</TabsTrigger>
              <TabsTrigger value="exame-toxico">EXAME TOXICO.</TabsTrigger>
              <TabsTrigger value="cha-amador">CHÁ AMADOR</TabsTrigger>
              <TabsTrigger value="historico-escolar">HIST. ESCOLAR</TabsTrigger>
            </TabsList>
            <TabsContent value="cnh">
              <CnhAlignContent />
            </TabsContent>
            <TabsContent value="certidao">
              <Suspense fallback={<div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <CertidaoAlignPage />
              </Suspense>
            </TabsContent>
            <TabsContent value="comprovante">
              <Suspense fallback={<div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <ComprovanteResidenciaAlignPage />
              </Suspense>
            </TabsContent>
            <TabsContent value="exame-toxico">
              <Suspense fallback={<div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <ExameToxicologicoAlignPage />
              </Suspense>
            </TabsContent>
            <TabsContent value="cha-amador">
              <ChaAmadorAlignContent />
            </TabsContent>
            <TabsContent value="historico-escolar">
              <HistoricoEscolarAlignContent />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="fisicos">
          <Tabs defaultValue="cnh-fisica-completa" className="w-full">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="cnh-fisica-completa" className="text-xs">CNH COMPLETA</TabsTrigger>
              <TabsTrigger value="cnh-fisica-frente" className="text-xs">FRENTE</TabsTrigger>
              <TabsTrigger value="cnh-fisica-verso" className="text-xs">VERSO</TabsTrigger>
              <TabsTrigger value="cart-bombeiro" className="text-xs">BOMBEIRO</TabsTrigger>
              <TabsTrigger value="cart-porteiro" className="text-xs">PORTEIRO</TabsTrigger>
              <TabsTrigger value="cart-agente" className="text-xs">AGENTE</TabsTrigger>
              <TabsTrigger value="cart-bombeiro-militar" className="text-xs">BOMB. MIL.</TabsTrigger>
              <TabsTrigger value="cart-operador-maquinas" className="text-xs">OPER. MÁQ.</TabsTrigger>
              <TabsTrigger value="cart-operador-maquinas-digital" className="text-xs">OPER. MÁQ. DIG.</TabsTrigger>
              <TabsTrigger value="cart-seguranca-escolar" className="text-xs">SEG. ESC.</TabsTrigger>
              <TabsTrigger value="cart-cedula-policia-pe" className="text-xs">CÉD. POL. PE</TabsTrigger>
              <TabsTrigger value="cart-cpf-fisico" className="text-xs">CPF FÍSICO</TabsTrigger>
              <TabsTrigger value="cart-cnh-nautica" className="text-xs">ARRAIS AMADOR</TabsTrigger>
            </TabsList>
            <TabsContent value="cnh-fisica-completa">
              <CnhFisicaFullContent />
            </TabsContent>
            <TabsContent value="cnh-fisica-frente">
              <CnhFisicaAlignContent />
            </TabsContent>
            <TabsContent value="cnh-fisica-verso">
              <CnhFisicaVersoAlignContent />
            </TabsContent>
            <TabsContent value="cart-bombeiro">
              <CarteirinhaAlignContent tipo="bombeiro" tipoLabel="Bombeiro" storageKey="carteirinha-bombeiro-field-positions" />
            </TabsContent>
            <TabsContent value="cart-porteiro">
              <CarteirinhaAlignContent tipo="porteiro" tipoLabel="Porteiro / Vigia" storageKey="carteirinha-porteiro-field-positions" />
            </TabsContent>
            <TabsContent value="cart-agente">
              <CarteirinhaAlignContent tipo="agente-financeiro" tipoLabel="Agente Financeiro" storageKey="carteirinha-agente-field-positions" />
            </TabsContent>
            <TabsContent value="cart-bombeiro-militar">
              <BombeiroMilitarAlignContent />
            </TabsContent>
            <TabsContent value="cart-operador-maquinas">
              <OperadorMaquinasAlignContent />
            </TabsContent>
            <TabsContent value="cart-operador-maquinas-digital">
              <OperadorMaquinasDigitalAlignContent />
            </TabsContent>
            <TabsContent value="cart-seguranca-escolar">
              <SegurancaEscolarAlignContent />
            </TabsContent>
            <TabsContent value="cart-cedula-policia-pe">
              <CedulaPoliciaAlignContent />
            </TabsContent>
            <TabsContent value="cart-cpf-fisico">
              <CpfFisicoAlignContent />
            </TabsContent>
            <TabsContent value="cart-cnh-nautica">
              <CnhNauticaAlignContent />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
