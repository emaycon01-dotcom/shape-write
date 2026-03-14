import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Sample data for preview
const sampleData = {
  nome_completo: "PEDRO DA SILVA GOMES",
  cpf: "123.456.789-00",
  rg: "3674826 SSP AL",
  data_nascimento: "12/02/2000",
  genero: "M",
  nacionalidade: "BRASILEIRA",
  nome_pai: "JOSÉ DA SILVA",
  nome_mae: "MARIA DA SILVA GOMES",
  registro: "00000000000",
  categoria: "AB",
  data_primeira_hab: "15/03/2018",
  data_emissao: "01/01/2024",
  data_validade: "01/01/2029",
  renach: "SP000000000",
  codigo_seguranca: "00000000000",
  numero_espelho: "00000000",
  cidade_estado: "SÃO PAULO, SP",
};

export function buildCnhHtml(data: Record<string, string>, templateUrl: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { margin: 0; font-family: Arial; }
.documento { position: relative; width: 900px; height: 550px; }
.background { position: absolute; width: 900px; height: 550px; top: 0; left: 0; }
.campo { position: absolute; font-size: 16px; font-weight: bold; color: #000; }
.foto { position: absolute; top: 140px; left: 60px; width: 120px; height: 140px; object-fit: cover; }
.assinatura { position: absolute; top: 420px; left: 200px; width: 200px; }
</style>
</head>
<body>
<div class="documento">
  <img class="background" src="${templateUrl}">
  ${data.foto ? `<img class="foto" src="${data.foto}">` : ""}
  <div class="campo" style="top:150px; left:220px;">${data.nome_completo || ""}</div>
  <div class="campo" style="top:180px; left:220px;">${data.cpf || ""}</div>
  <div class="campo" style="top:210px; left:220px;">${data.rg || ""}</div>
  <div class="campo" style="top:240px; left:220px;">${data.data_nascimento || ""}</div>
  <div class="campo" style="top:270px; left:220px;">${data.genero || ""}</div>
  <div class="campo" style="top:300px; left:220px;">${data.nacionalidade || ""}</div>
  <div class="campo" style="top:330px; left:220px;">${data.nome_pai || ""}</div>
  <div class="campo" style="top:360px; left:220px;">${data.nome_mae || ""}</div>
  <div class="campo" style="top:150px; left:520px;">${data.registro || ""}</div>
  <div class="campo" style="top:180px; left:520px;">${data.categoria || ""}</div>
  <div class="campo" style="top:210px; left:520px;">${data.data_primeira_hab || ""}</div>
  <div class="campo" style="top:240px; left:520px;">${data.data_emissao || ""}</div>
  <div class="campo" style="top:270px; left:520px;">${data.data_validade || ""}</div>
  <div class="campo" style="top:300px; left:520px;">${data.renach || ""}</div>
  <div class="campo" style="top:330px; left:520px;">${data.codigo_seguranca || ""}</div>
  <div class="campo" style="top:360px; left:520px;">${data.numero_espelho || ""}</div>
  <div class="campo" style="top:390px; left:520px;">${data.cidade_estado || ""}</div>
  ${data.assinatura ? `<img class="assinatura" src="${data.assinatura}">` : ""}
</div>
</body>
</html>`;
}

export default function TemplateCnhPage() {
  const [templateUrl, setTemplateUrl] = useState("/assets/template-cnh.png");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setTemplateUrl(dataUrl);
      setPreview(dataUrl);
      toast({ title: "Template carregado!", description: "A imagem será usada como fundo do documento." });
    };
    reader.readAsDataURL(file);
  };

  const clearTemplate = () => {
    setTemplateUrl("/assets/template-cnh.png");
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const html = buildCnhHtml(sampleData, templateUrl);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Template CNH</h1>
      <p className="text-muted-foreground text-sm">
        Faça upload da imagem PNG do template. Os campos do formulário serão posicionados sobre ela.
      </p>

      {/* Upload */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Imagem de Fundo</h2>
        {preview ? (
          <div className="relative inline-block">
            <img src={preview} alt="Template" className="max-w-full h-auto rounded-lg border border-border" style={{ maxHeight: 300 }} />
            <button type="button" onClick={clearTemplate} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
              <X className="w-4 h-4 text-destructive-foreground" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-32 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
            <Upload className="w-8 h-8" />
            <span>Clique para upload do template PNG</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleUpload} />
      </div>

      {/* Preview */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Preview do Template</h2>
        </div>
        <p className="text-xs text-muted-foreground">Os dados abaixo são de exemplo. No PDF real, serão substituídos pelos dados do formulário.</p>
        <div className="overflow-auto rounded-lg border border-border bg-white">
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ minWidth: 900 }}
          />
        </div>
      </div>
    </div>
  );
}
