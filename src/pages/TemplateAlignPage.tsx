import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, RotateCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import templateBgUrl from "@/assets/template-cnh-bg.jpeg";

// These are the current coordinates from the edge function (A4 = 794x1123)
// The editor uses a scaled-down canvas. All positions are in the 794x1123 coordinate space.
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
  { id: "photo", label: "Foto", sampleText: "[FOTO]", x: 72, y: 140, fontSize: 8, w: 82, h: 110, color: "#999" },
  { id: "signature", label: "Assinatura", sampleText: "[ASSINATURA]", x: 68, y: 289, fontSize: 7, w: 95, h: 32, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "MARIA OLIVEIRA SANTOS", x: 165, y: 132, fontSize: 8.5 },
  { id: "primeira_hab", label: "1ª Hab", sampleText: "27/09/2017", x: 402, y: 132, fontSize: 7.5 },
  { id: "nascimento", label: "Nascimento", sampleText: "11/03/1989, RIO DE JANEIRO, RJ", x: 165, y: 159, fontSize: 7 },
  { id: "emissao", label: "Emissão", sampleText: "14/03/2026", x: 165, y: 184, fontSize: 7.5 },
  { id: "validade", label: "Validade", sampleText: "14/03/2036", x: 280, y: 184, fontSize: 7.5, color: "#c00" },
  { id: "cat_big", label: "Cat. Grande", sampleText: "AB", x: 430, y: 176, fontSize: 16 },
  { id: "rg", label: "RG", sampleText: "3963221 SSP PR", x: 165, y: 210, fontSize: 7 },
  { id: "cpf", label: "CPF", sampleText: "997.038.350-25", x: 165, y: 236, fontSize: 7.5 },
  { id: "registro", label: "Registro", sampleText: "07915888995", x: 300, y: 236, fontSize: 7.5 },
  { id: "cat_hab", label: "Cat. Hab", sampleText: "AB", x: 418, y: 236, fontSize: 8 },
  { id: "nacionalidade", label: "Nacionalidade", sampleText: "BRASILEIRA", x: 165, y: 262, fontSize: 7.5 },
  { id: "pai", label: "Pai", sampleText: "JOSE DA SILVA", x: 165, y: 282, fontSize: 7.5 },
  { id: "mae", label: "Mãe", sampleText: "SANDRA COSTA", x: 165, y: 300, fontSize: 7.5 },
  { id: "obs", label: "Observações", sampleText: "EAR", x: 72, y: 536, fontSize: 7 },
  { id: "espelho", label: "Nº Espelho", sampleText: "77424319", x: 350, y: 588, fontSize: 6.5 },
  { id: "renach", label: "RENACH", sampleText: "PB5271\n25303", x: 350, y: 602, fontSize: 6.5 },
  { id: "local", label: "Local", sampleText: "RIO DE JANEIRO, RJ", x: 72, y: 621, fontSize: 7 },
  { id: "estado", label: "Estado", sampleText: "BAHIA", x: 240, y: 662, fontSize: 15 },
  { id: "mrz", label: "MRZ", sampleText: "I<BRA079158889PB927125303<<<<\n8903118M3603147BRA<<<<<<<<<<<4\nMARIA<<OLIVEIRA<<SANTOS<<<<<<<", x: 58, y: 784, fontSize: 9 },
  { id: "reg_vert_top", label: "Reg. Vertical (topo)", sampleText: "07915888995", x: 52, y: 326, fontSize: 7, rotate: -90 },
  { id: "reg_vert_bot", label: "Reg. Vertical (base)", sampleText: "07915888995", x: 52, y: 646, fontSize: 7, rotate: -90 },
];

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

  // Compute scale based on container width
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerW = containerRef.current.clientWidth;
        setScale(containerW / PAGE_W);
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
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

    setDragging({
      id: fieldId,
      offsetX: mouseX - field.x,
      offsetY: mouseY - field.y,
    });
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

    setDragging({
      id: fieldId,
      offsetX: mouseX - field.x,
      offsetY: mouseY - field.y,
    });
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

  const copyCssCode = () => {
    const lines = fields.map(f => {
      if (f.id === "photo") return `  .photo-overlay { top: ${f.y}px; left: ${f.x}px; width: ${f.w}px; height: ${f.h}px; }`;
      if (f.id === "signature") return `  .sig-overlay { top: ${f.y}px; left: ${f.x}px; width: ${f.w}px; height: ${f.h}px; }`;
      if (f.id === "reg_vert_top") return `  .reg-vert-top { top: ${f.y}px; left: ${f.x}px; }`;
      if (f.id === "reg_vert_bot") return `  .reg-vert-bot { top: ${f.y}px; left: ${f.x}px; }`;
      if (f.id === "mrz") return `  .mrz-overlay { top: ${f.y}px; left: ${f.x}px; }`;

      const classMap: Record<string, string> = {
        nome: "f-nome", primeira_hab: "f-primeira-hab", nascimento: "f-nascimento",
        emissao: "f-emissao", validade: "f-validade", cat_big: "f-cat-big",
        rg: "f-rg", cpf: "f-cpf", registro: "f-registro", cat_hab: "f-cat-hab",
        nacionalidade: "f-nacionalidade", pai: "f-pai", mae: "f-mae",
        obs: "f-obs", espelho: "f-espelho", renach: "f-renach",
        local: "f-local", estado: "f-estado",
      };
      const cls = classMap[f.id] || f.id;
      return `  .${cls} { top: ${f.y}px; left: ${f.x}px; font-size: ${f.fontSize}px; }`;
    });

    navigator.clipboard.writeText(lines.join("\n"));
    toast({ title: "CSS copiado!", description: "Cole no edge function para aplicar." });
  };

  const selectedField = fields.find(f => f.id === selected);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-foreground">Editor de Alinhamento CNH</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={resetPositions} className="gap-1.5">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button size="sm" variant="outline" onClick={copyCssCode} className="gap-1.5">
            <Copy className="w-4 h-4" /> Copiar CSS
          </Button>
          <Button size="sm" onClick={savePositions} className="gap-1.5">
            <Save className="w-4 h-4" /> Salvar
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Arraste os campos para posicioná-los sobre o template. Use setas do teclado para ajuste fino (Shift = 5px).
        Clique em "Copiar CSS" para gerar o código e me envie para aplicar.
      </p>

      {/* Selected field info */}
      {selectedField && (
        <div className="glass rounded-lg p-3 flex items-center gap-4 text-sm">
          <span className="font-semibold text-primary">{selectedField.label}</span>
          <span className="text-muted-foreground">
            x: <span className="text-foreground font-mono">{selectedField.x}</span> &nbsp;
            y: <span className="text-foreground font-mono">{selectedField.y}</span>
          </span>
        </div>
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
          {/* Template background */}
          <img
            src={templateBgUrl}
            alt="Template CNH"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: "fill" }}
            draggable={false}
          />

          {/* Draggable fields */}
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
                  fontFamily: f.id === "mrz" ? "'Courier New', monospace" : "Arial, sans-serif",
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
                title={`${f.label}: x=${f.x}, y=${f.y}`}
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
