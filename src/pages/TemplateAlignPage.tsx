import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Copy, RotateCcw, Save, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import templateBgUrl from "@/assets/template-cnh-bg.jpeg";

const PAGE_W = 794;
const PAGE_H = 1123;

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
}

const defaultFields: FieldDef[] = [
  { id: "photo", label: "Foto", sampleText: "[FOTO]", x: 98, y: 167, fontSize: 8, w: 82, h: 110, color: "#999" },
  { id: "signature", label: "Assinatura", sampleText: "[ASSINATURA]", x: 93, y: 276, fontSize: 7, w: 95, h: 32, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "MARIA OLIVEIRA SANTOS", x: 99, y: 148, fontSize: 6.5 },
  { id: "primeira_hab", label: "1ª Hab", sampleText: "27/09/2017", x: 309, y: 147, fontSize: 6.5 },
  { id: "nascimento", label: "Nascimento", sampleText: "11/03/1989, RIO DE JANEIRO, RJ", x: 190, y: 166, fontSize: 6.5 },
  { id: "emissao", label: "Emissão", sampleText: "14/03/2026", x: 194, y: 186, fontSize: 6.5 },
  { id: "validade", label: "Validade", sampleText: "14/03/2036", x: 250, y: 185, fontSize: 6.5, color: "#c00" },
  { id: "cat_big", label: "Cat. Grande", sampleText: "AB", x: 338, y: 183, fontSize: 10 },
  { id: "validade_cat_a", label: "Validade Cat. A", sampleText: "14/03/2036", x: 170, y: 353, fontSize: 4.5 },
  { id: "validade_cat_b", label: "Validade Cat. B", sampleText: "14/03/2036", x: 168, y: 375, fontSize: 4.5 },
  { id: "validade_cat_c", label: "Validade Cat. C", sampleText: "14/03/2036", x: 169, y: 397, fontSize: 4.5 },
  { id: "validade_cat_d", label: "Validade Cat. D", sampleText: "14/03/2036", x: 272, y: 342, fontSize: 4.5 },
  { id: "validade_cat_e", label: "Validade Cat. E", sampleText: "14/03/2036", x: 271, y: 375, fontSize: 4.5 },
  { id: "rg", label: "RG", sampleText: "3963221 SSP PR", x: 191, y: 205, fontSize: 6.5 },
  { id: "cpf", label: "CPF", sampleText: "997.038.350-25", x: 191, y: 224, fontSize: 6.5 },
  { id: "registro", label: "Registro", sampleText: "07915888995", x: 257, y: 224, fontSize: 6.5 },
  { id: "cat_hab", label: "Cat. Hab", sampleText: "AB", x: 318, y: 224, fontSize: 7 },
  { id: "nacionalidade", label: "Nacionalidade", sampleText: "BRASILEIRA", x: 190, y: 243, fontSize: 6.5 },
  { id: "pai", label: "Pai", sampleText: "JOSE DA SILVA", x: 190, y: 266, fontSize: 6.5 },
  { id: "mae", label: "Mãe", sampleText: "SANDRA COSTA", x: 190, y: 286, fontSize: 6.5 },
  { id: "obs", label: "Observações", sampleText: "EAR", x: 97, y: 427, fontSize: 5.5 },
  { id: "espelho", label: "Nº Espelho", sampleText: "77424319856", x: 264, y: 495, fontSize: 6.5 },
  { id: "renach", label: "RENACH", sampleText: "PB527125303", x: 263, y: 513, fontSize: 6.5 },
  { id: "local", label: "Local", sampleText: "RIO DE JANEIRO, RJ", x: 97, y: 505, fontSize: 6 },
  { id: "estado", label: "Estado", sampleText: "BAHIA", x: 147, y: 523, fontSize: 15 },
  { id: "mrz", label: "MRZ", sampleText: "I<BRA079158889PB927125303<<<<\n8903118M3603147BRA<<<<<<<<<<<4\nMARIA<<OLIVEIRA<<SANTOS<<<<<<<", x: 85, y: 704, fontSize: 10 },
  { id: "reg_vert_top", label: "Reg. Vertical (topo)", sampleText: "07915888995", x: 63, y: 311, fontSize: 12, rotate: -90 },
  { id: "reg_vert_bot", label: "Reg. Vertical (base)", sampleText: "07915888995", x: 59, y: 551, fontSize: 11.5, rotate: -90 },
];

function FieldPropertiesPanel({
  field,
  onUpdate,
}: {
  field: FieldDef;
  onUpdate: (updates: Partial<FieldDef>) => void;
}) {
  const isBox = field.id === "photo" || field.id === "signature";

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

export default function TemplateAlignPage() {
  const [fields, setFields] = useState<FieldDef[]>(() => {
    const saved = localStorage.getItem("cnh-field-positions");
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return defaultFields;
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        setScale(containerRef.current.clientWidth / PAGE_W);
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

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
        f.id === dragging.id ? { ...f, x: Math.max(0, x), y: Math.max(0, y) } : f
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
  }, [dragging, scale]);

  // Arrow key nudging
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
        f.id === selected ? { ...f, x: Math.max(0, f.x + dx), y: Math.max(0, f.y + dy) } : f
      ));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected]);

  const savePositions = () => {
    localStorage.setItem("cnh-field-positions", JSON.stringify(fields));
    toast({ title: "Posições salvas!", description: "As coordenadas foram salvas no navegador." });
  };

  const resetPositions = () => {
    setFields(defaultFields);
    localStorage.removeItem("cnh-field-positions");
    setSelected(null);
    toast({ title: "Posições resetadas!" });
  };

  const copyCode = () => {
    const obj = fields.reduce((acc, f) => {
      acc[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize, ...(f.w ? { w: f.w } : {}), ...(f.h ? { h: f.h } : {}), ...(f.rotate !== undefined ? { rotate: f.rotate } : {}) };
      return acc;
    }, {} as Record<string, any>);
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    toast({ title: "Coordenadas copiadas!", description: "Cole no chat para aplicar no edge function." });
  };

  const selectedField = fields.find(f => f.id === selected);

  // CNH uses Arial/Helvetica officially
  const getCnhFont = (fieldId: string) => {
    if (fieldId === "mrz") return "'Courier New', 'Courier', monospace";
    return "'Arial', 'Helvetica Neue', 'Helvetica', sans-serif";
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-foreground font-display">Editor de Alinhamento CNH</h1>
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

      {/* Properties panel for selected field */}
      {selectedField && (
        <FieldPropertiesPanel
          field={selectedField}
          onUpdate={(updates) => updateField(selectedField.id, updates)}
        />
      )}

      {/* Canvas */}
      <div className="overflow-auto border border-border rounded-xl bg-white">
        <div
          ref={containerRef}
          className="relative select-none"
          style={{
            width: "100%",
            aspectRatio: `${PAGE_W} / ${PAGE_H}`,
            maxWidth: PAGE_W,
          }}
          onClick={() => setSelected(null)}
        >
          <img
            src={templateBgUrl}
            alt="Template CNH"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "fill" }}
            draggable={false}
          />

          {fields.map((f) => {
            const isSelected = f.id === selected;
            const isBox = f.id === "photo" || f.id === "signature";

            return (
              <div
                key={f.id}
                onMouseDown={(e) => handleMouseDown(e, f.id)}
                onTouchStart={(e) => handleTouchStart(e, f.id)}
                className="absolute cursor-move touch-none"
                style={{
                  top: `${(f.y / PAGE_H) * 100}%`,
                  left: `${(f.x / PAGE_W) * 100}%`,
                  fontSize: `${f.fontSize * scale}px`,
                  fontWeight: "bold",
                  fontFamily: getCnhFont(f.id),
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
                    width: `${((f.w || 80) / PAGE_W) * 100}%`,
                    height: `${((f.h || 80) / PAGE_H) * 100}%`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isSelected ? "hsl(var(--primary) / 0.15)" : "rgba(200,200,200,0.3)",
                  } : {}),
                }}
                title={`${f.label}: x=${f.x}, y=${f.y}, font=${f.fontSize}`}
              >
                {isBox ? (
                  <span style={{ fontSize: `${10 * scale}px`, color: "#666" }}>{f.label}</span>
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
