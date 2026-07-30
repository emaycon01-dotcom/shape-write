import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Copy, RotateCcw, Save, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import templateBgUrl from "@/assets/template-cnh-bg-hq.jpg";
import { CNH_ALIGN_STORAGE_KEY, loadCnhFieldPositions } from "@/lib/cnh-align";

const PAGE_W = 794;
const PAGE_H = 1123;

const CNH_FONT = "'CNHDigital', Arial, Helvetica, sans-serif";

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
  bold?: boolean;
}

export const defaultCnhFields: FieldDef[] = [
  { id: "photo", label: "Foto", sampleText: "[FOTO]", x: 98, y: 167, fontSize: 8, w: 82, h: 110, color: "#999" },
  { id: "signature", label: "Assinatura", sampleText: "[ASSINATURA]", x: 93, y: 276, fontSize: 7, w: 95, h: 32, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "MARIA OLIVEIRA SANTOS", x: 100, y: 149, fontSize: 6.5 },
  { id: "primeira_hab", label: "1ª Hab", sampleText: "27/09/2017", x: 308, y: 149, fontSize: 6.5 },
  { id: "nascimento", label: "Nascimento", sampleText: "11/03/1989, RIO DE JANEIRO, RJ", x: 192, y: 168, fontSize: 6.5 },
  { id: "emissao", label: "Emissão", sampleText: "14/03/2026", x: 191, y: 187, fontSize: 6.5 },
  { id: "validade", label: "Validade", sampleText: "14/03/2036", x: 253, y: 187, fontSize: 6.5, color: "#c00" },
  { id: "cat_big", label: "Cat. Grande (D/P)", sampleText: "D", x: 338, y: 184, fontSize: 11 },
  { id: "validade_cat_a", label: "Validade Cat. A", sampleText: "14/03/2036", x: 171, y: 353, fontSize: 4.5 },
  { id: "validade_cat_b", label: "Validade Cat. B", sampleText: "14/03/2036", x: 171, y: 375, fontSize: 4.5 },
  { id: "validade_cat_c", label: "Validade Cat. C", sampleText: "14/03/2036", x: 171, y: 397, fontSize: 4.5 },
  { id: "validade_cat_d", label: "Validade Cat. D", sampleText: "14/03/2036", x: 275, y: 342, fontSize: 4.5 },
  { id: "validade_cat_e", label: "Validade Cat. E", sampleText: "14/03/2036", x: 274, y: 375, fontSize: 4.5 },
  { id: "rg", label: "RG", sampleText: "3963221 SSP PR", x: 190, y: 207, fontSize: 6.5 },
  { id: "cpf", label: "CPF", sampleText: "997.038.350-25", x: 190, y: 226, fontSize: 6.5 },
  { id: "registro", label: "Registro", sampleText: "07915888995", x: 256, y: 226, fontSize: 6.5, color: "#c00" },
  { id: "cat_hab", label: "Cat. Hab", sampleText: "AB", x: 319, y: 226, fontSize: 7, color: "#c00" },
  { id: "nacionalidade", label: "Nacionalidade", sampleText: "BRASILEIRA", x: 190, y: 246, fontSize: 6.5 },
  { id: "pai", label: "Pai", sampleText: "JOSE DA SILVA", x: 190, y: 266, fontSize: 6.5 },
  { id: "mae", label: "Mãe", sampleText: "SANDRA COSTA", x: 190, y: 286, fontSize: 6.5 },
  { id: "obs", label: "Observações", sampleText: "EAR", x: 97, y: 427, fontSize: 5.5 },
  { id: "espelho", label: "Nº Espelho", sampleText: "77424319856", x: 281, y: 495, fontSize: 6.5 },
  { id: "renach", label: "RENACH", sampleText: "PB527125303", x: 280, y: 509, fontSize: 6.5 },
  { id: "local", label: "Local", sampleText: "RIO DE JANEIRO, RJ", x: 100, y: 505, fontSize: 6 },
  { id: "estado", label: "Estado", sampleText: "BAHIA", x: 163, y: 531, fontSize: 15 },
  {
    id: "mrz",
    label: "MRZ",
    sampleText: "I<BRA81008622604<002<<<<<<<<<<\n9610286M3604270BRA<<<<<<<<<<1<\nMARIA<<OLIVEIRA<SANTOS<<<<<<<<",
    x: 80,
    y: 694,
    fontSize: 9.5,
  },
  { id: "reg_vert_top", label: "Reg. Vertical (topo)", sampleText: "07915888995", x: 65, y: 315, fontSize: 12, rotate: -90 },
  { id: "reg_vert_bot", label: "Reg. Vertical (base)", sampleText: "07915888995", x: 64, y: 558, fontSize: 11.5, rotate: -90 },
];

function FieldPropertiesPanel({ field, onUpdate }: { field: FieldDef; onUpdate: (updates: Partial<FieldDef>) => void }) {
  const isBox = field.id === "photo" || field.id === "signature";

  return (
    <div className="glass rounded-lg p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary font-display">{field.label}</span>
        <span className="text-muted-foreground font-mono text-xs">
          x:{field.x} y:{field.y}
        </span>
      </div>

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

      <div>
        <Label className="text-xs text-muted-foreground">Tamanho da fonte</Label>
        <div className="flex items-center gap-2 mt-1">
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdate({ fontSize: Math.max(4, field.fontSize - 0.5) })}>
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
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdate({ fontSize: Math.min(40, field.fontSize + 0.5) })}>
            <Plus className="w-3 h-3" />
          </Button>
          <Slider value={[field.fontSize]} min={4} max={40} step={0.5} onValueChange={([v]) => onUpdate({ fontSize: v })} className="flex-1" />
        </div>
      </div>

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

function CnhAlignEditor() {
  const [fields, setFields] = useState<FieldDef[]>(() => {
    const saved = localStorage.getItem(CNH_ALIGN_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === defaultCnhFields.length) {
          // merge to keep new metadata (labels/colors) while using saved geometry
          return defaultCnhFields.map((def) => {
            const s = parsed.find((p: FieldDef) => p.id === def.id);
            return s ? { ...def, x: s.x, y: s.y, fontSize: s.fontSize, w: s.w ?? def.w, h: s.h ?? def.h, rotate: s.rotate ?? def.rotate } : def;
          });
        }
      } catch {
        /* ignore */
      }
    }
    return defaultCnhFields;
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

  // Auto-persist so the PDF always uses the latest alignment (real-time)
  useEffect(() => {
    localStorage.setItem(CNH_ALIGN_STORAGE_KEY, JSON.stringify(fields));
    window.dispatchEvent(new CustomEvent("cnh-align-updated"));
  }, [fields]);

  const updateField = useCallback((id: string, updates: Partial<FieldDef>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const startDrag = useCallback(
    (clientX: number, clientY: number, fieldId: string) => {
      setSelected(fieldId);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;
      setDragging({
        id: fieldId,
        offsetX: (clientX - rect.left) / scale - field.x,
        offsetY: (clientY - rect.top) / scale - field.y,
      });
    },
    [fields, scale]
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.round((clientX - rect.left) / scale - dragging.offsetX);
      const y = Math.round((clientY - rect.top) / scale - dragging.offsetY);
      setFields((prev) =>
        prev.map((f) => (f.id === dragging.id ? { ...f, x: Math.max(0, Math.min(PAGE_W, x)), y: Math.max(0, Math.min(PAGE_H, y)) } : f))
      );
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
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

  useEffect(() => {
    if (!selected) return;
    const handleKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      setFields((prev) =>
        prev.map((f) => (f.id === selected ? { ...f, x: Math.max(0, Math.min(PAGE_W, f.x + dx)), y: Math.max(0, Math.min(PAGE_H, f.y + dy)) } : f))
      );
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected]);

  const savePositions = () => {
    localStorage.setItem(CNH_ALIGN_STORAGE_KEY, JSON.stringify(fields));
    toast({ title: "Alinhamento salvo!", description: "O PDF da CNH vai usar exatamente estas posições." });
  };

  const resetPositions = () => {
    setFields(defaultCnhFields);
    setSelected(null);
    toast({ title: "Posições resetadas!" });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(JSON.stringify(loadCnhFieldPositions() ?? {}, null, 2));
    toast({ title: "Coordenadas copiadas!" });
  };

  const selectedField = fields.find((f) => f.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-foreground font-display">Alinhamento - CNH Digital</h2>
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
        Arraste os campos para posicioná-los. Use as setas do teclado (Shift = 5px). As alterações são aplicadas na geração do PDF em tempo real.
      </p>

      {selectedField && <FieldPropertiesPanel field={selectedField} onUpdate={(u) => updateField(selectedField.id, u)} />}

      <div className="overflow-auto border border-border rounded-xl bg-white">
        <div
          ref={containerRef}
          className="relative select-none w-full"
          style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, maxWidth: PAGE_W }}
          onClick={() => setSelected(null)}
        >
          <img src={templateBgUrl} alt="Template CNH" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} draggable={false} />

          {fields.map((f) => {
            const isSelected = f.id === selected;
            const isBox = f.id === "photo" || f.id === "signature";
            const isEstado = f.id === "estado";
            const estadoSize = isEstado
              ? f.sampleText.length > 9
                ? Math.max(f.fontSize * (9 / f.sampleText.length), f.fontSize * 0.55)
                : f.fontSize
              : f.fontSize;


            return (
              <div
                key={f.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startDrag(e.clientX, e.clientY, f.id);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  startDrag(e.touches[0].clientX, e.touches[0].clientY, f.id);
                }}
                className="absolute cursor-move touch-none"
                style={{
                  top: `${(f.y / PAGE_H) * 100}%`,
                  left: `${(f.x / PAGE_W) * 100}%`,
                  fontSize: `${estadoSize * scale}px`,
                  fontWeight: f.bold ? "bold" : "normal",
                  fontFamily: f.id === "mrz" ? "'OCR B','OCRB','Courier New',Courier,monospace" : isEstado ? "Arial, Helvetica, sans-serif" : CNH_FONT,
                  color: f.color || "#111",
                  whiteSpace: isEstado ? "nowrap" : "pre-line",
                  outline: isSelected ? "2px solid hsl(var(--primary))" : "1px dashed rgba(0,0,0,0.15)",
                  background: isSelected ? "hsl(var(--primary) / 0.1)" : "transparent",
                  zIndex: isSelected ? 50 : 10,
                  transform: f.rotate ? `rotate(${f.rotate}deg)` : undefined,
                  transformOrigin: f.rotate ? "left top" : undefined,
                  letterSpacing: f.id === "mrz" ? `${1.6 * scale}px` : f.rotate ? `${1.2 * scale}px` : undefined,
                  lineHeight: f.id === "mrz" ? 1.6 : 1,
                  ...(isEstado ? { width: `${((170 / PAGE_W) * 100).toFixed(4)}%`, textAlign: "center" as const } : {}),
                  ...(isBox
                    ? {
                        width: `${(((f.w || 80) / PAGE_W) * 100).toFixed(4)}%`,
                        height: `${(((f.h || 80) / PAGE_H) * 100).toFixed(4)}%`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isSelected ? "hsl(var(--primary) / 0.15)" : "rgba(200,200,200,0.3)",
                      }
                    : {}),
                }}
                title={`${f.label}: x=${f.x}, y=${f.y}, font=${f.fontSize}`}
              >
                {isBox ? <span style={{ fontSize: `${10 * scale}px`, color: "#666" }}>{f.label}</span> : f.sampleText}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TemplateAlignPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-foreground font-display">Editor de Alinhamento</h1>
      <CnhAlignEditor />
    </div>
  );
}
