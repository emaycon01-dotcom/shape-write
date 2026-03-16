import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Copy, RotateCcw, Save, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import templateBgUrl from "@/assets/template-comprovante-residencia.jpg";

const PAGE_W = 794;
const PAGE_H = 1123;

interface FieldDef {
  id: string;
  label: string;
  sampleText: string;
  x: number;
  y: number;
  fontSize: number;
  bold?: boolean;
}

const defaultFields: FieldDef[] = [
  { id: "nome1", label: "Nome (1ª vez)", sampleText: "GREICE KELLY DA SILVA", x: 95, y: 108, fontSize: 11 },
  { id: "nome2", label: "Nome (2ª vez)", sampleText: "GREICE KELLY DA SILVA", x: 95, y: 920, fontSize: 11 },
  { id: "endereco", label: "Endereço", sampleText: "RUA DAS FLORES, 123", x: 95, y: 135, fontSize: 11 },
  { id: "cepCidadeEstado", label: "CEP/Cidade/Estado", sampleText: "01234-567 SAO PAULO SP", x: 95, y: 160, fontSize: 11 },
  { id: "cpf", label: "CPF (Negrito)", sampleText: "123.456.789-00", x: 380, y: 60, fontSize: 12, bold: true },
];

function FieldPropertiesPanel({ field, onUpdate }: { field: FieldDef; onUpdate: (u: Partial<FieldDef>) => void }) {
  return (
    <div className="glass rounded-lg p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary font-display">{field.label}</span>
        <span className="text-muted-foreground font-mono text-xs">x:{field.x} y:{field.y}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">X</Label>
          <Input type="number" value={field.x} onChange={(e) => onUpdate({ x: Math.max(0, Number(e.target.value)) })} className="h-7 text-xs font-mono bg-secondary/50" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Y</Label>
          <Input type="number" value={field.y} onChange={(e) => onUpdate({ y: Math.max(0, Number(e.target.value)) })} className="h-7 text-xs font-mono bg-secondary/50" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Tamanho da fonte</Label>
        <div className="flex items-center gap-2 mt-1">
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdate({ fontSize: Math.max(4, field.fontSize - 0.5) })}>
            <Minus className="w-3 h-3" />
          </Button>
          <Input type="number" step="0.5" min="4" max="40" value={field.fontSize} onChange={(e) => onUpdate({ fontSize: Math.max(4, Number(e.target.value)) })} className="h-7 text-xs font-mono text-center bg-secondary/50 w-16" />
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdate({ fontSize: Math.min(40, field.fontSize + 0.5) })}>
            <Plus className="w-3 h-3" />
          </Button>
          <Slider value={[field.fontSize]} min={4} max={40} step={0.5} onValueChange={([v]) => onUpdate({ fontSize: v })} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

export default function ComprovanteResidenciaAlignPage() {
  const [fields, setFields] = useState<FieldDef[]>(() => {
    const saved = localStorage.getItem("comprovante-residencia-field-positions");
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
    return defaultFields;
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) setScale(containerRef.current.clientWidth / PAGE_W);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const updateField = useCallback((id: string, updates: Partial<FieldDef>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault(); e.stopPropagation();
    setSelected(fieldId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    setDragging({ id: fieldId, offsetX: (e.clientX - rect.left) / scale - field.x, offsetY: (e.clientY - rect.top) / scale - field.y });
  }, [fields, scale]);

  const handleTouchStart = useCallback((e: React.TouchEvent, fieldId: string) => {
    e.stopPropagation();
    setSelected(fieldId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    const touch = e.touches[0];
    setDragging({ id: fieldId, offsetX: (touch.clientX - rect.left) / scale - field.x, offsetY: (touch.clientY - rect.top) / scale - field.y });
  }, [fields, scale]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (cx: number, cy: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.round((cx - rect.left) / scale - dragging.offsetX);
      const y = Math.round((cy - rect.top) / scale - dragging.offsetY);
      setFields(prev => prev.map(f => f.id === dragging.id ? { ...f, x: Math.max(0, x), y: Math.max(0, y) } : f));
    };
    const onMM = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTM = (e: TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onEnd = () => setDragging(null);
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTM, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => { window.removeEventListener("mousemove", onMM); window.removeEventListener("mouseup", onEnd); window.removeEventListener("touchmove", onTM); window.removeEventListener("touchend", onEnd); };
  }, [dragging, scale]);

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
      setFields(prev => prev.map(f => f.id === selected ? { ...f, x: Math.max(0, f.x + dx), y: Math.max(0, f.y + dy) } : f));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected]);

  const savePositions = () => {
    localStorage.setItem("comprovante-residencia-field-positions", JSON.stringify(fields));
    toast({ title: "Posições salvas!", description: "As coordenadas foram salvas no navegador." });
  };

  const resetPositions = () => {
    setFields(defaultFields);
    localStorage.removeItem("comprovante-residencia-field-positions");
    setSelected(null);
    toast({ title: "Posições resetadas!" });
  };

  const copyCode = () => {
    const obj = fields.reduce((acc, f) => {
      acc[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize };
      return acc;
    }, {} as Record<string, any>);
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    toast({ title: "Coordenadas copiadas!" });
  };

  const selectedField = fields.find(f => f.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-foreground font-display">Alinhamento - Comprovante de Residência</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={resetPositions} className="gap-1.5"><RotateCcw className="w-4 h-4" /> Reset</Button>
          <Button size="sm" variant="outline" onClick={copyCode} className="gap-1.5"><Copy className="w-4 h-4" /> Copiar</Button>
          <Button size="sm" onClick={savePositions} className="gap-1.5"><Save className="w-4 h-4" /> Salvar</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Arraste os campos para posicioná-los. Use setas (Shift = 5px).</p>

      {selectedField && <FieldPropertiesPanel field={selectedField} onUpdate={(u) => updateField(selectedField.id, u)} />}

      <div className="overflow-auto border border-border rounded-xl bg-white">
        <div ref={containerRef} className="relative select-none" style={{ width: "100%", aspectRatio: `${PAGE_W} / ${PAGE_H}`, maxWidth: PAGE_W }} onClick={() => setSelected(null)}>
          <img src={templateBgUrl} alt="Template Comprovante" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} draggable={false} />
          {fields.map((f) => {
            const isSelected = f.id === selected;
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
                  fontFamily: "'Arial', sans-serif",
                  fontWeight: f.bold ? "bold" : "normal",
                  color: "#000",
                  textTransform: "uppercase" as const,
                  whiteSpace: "pre-line",
                  border: isSelected ? "2px solid hsl(var(--primary))" : "1px dashed rgba(0,0,0,0.2)",
                  background: isSelected ? "hsl(var(--primary) / 0.1)" : "transparent",
                  borderRadius: "2px",
                  padding: "1px 2px",
                  zIndex: isSelected ? 50 : 10,
                }}
                title={`${f.label}: x=${f.x}, y=${f.y}, font=${f.fontSize}`}
              >
                {f.sampleText}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
