import { useState } from "react";
import { renderHtmlToPdfCanvas } from "@/lib/canvas-pdf";

const TEST_HTML = `
<!DOCTYPE html>
<html>
<head>
<style>
body { margin: 0; background: #fff; }
.page { width: 794px; height: 1123px; position: relative; font-family: Arial, sans-serif; }
.box { position: absolute; left: 50px; top: 50px; width: 200px; height: 100px; background: #eee; border: 2px solid #000; }
.text { position: absolute; left: 50px; top: 180px; font-size: 24px; font-weight: bold; text-decoration: underline; }
.rotated { position: absolute; left: 400px; top: 100px; width: 150px; height: 50px; background: #d00; color: #fff; transform: rotate(15deg); display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
<div class="page">
  <div class="box"></div>
  <div class="text">TESTE CANVAS PDF</div>
  <div class="rotated">ROTACIONADO</div>
</div>
</body>
</html>
`;

export default function TestCanvasPage() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const dataUrl = await renderHtmlToPdfCanvas(TEST_HTML, true);
      setResult(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Teste Canvas PDF</h1>
      <button onClick={run} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
        {loading ? "Gerando..." : "Gerar PDF de teste"}
      </button>
      {error && <div className="mt-4 p-4 bg-red-100 text-red-800">Erro: {error}</div>}
      {result && (
        <div className="mt-4">
          <p className="mb-2">OK! Tamanho: {Math.round((result.length * 0.75) / 1024)} KB</p>
          <iframe src={result} className="w-full h-[800px] border" />
        </div>
      )}
    </div>
  );
}
