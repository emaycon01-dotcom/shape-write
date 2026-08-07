import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    target: "es2020",
    cssCodeSplit: true,
    // O Rollup mantém automaticamente módulos que compartilham React no mesmo
    // grafo. Separá-los manualmente gerava ciclos entre Radix, ícones e React,
    // quebrando a publicação antes do primeiro render (forwardRef indefinido).
    chunkSizeWarningLimit: 1200,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "@supabase/supabase-js"],
    exclude: ["pdfjs-dist"],
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Dependências opcionais do jsPDF que nunca são executadas aqui.
      { find: /^html2canvas$/, replacement: path.resolve(__dirname, "./src/lib/jspdf-optional-stub.ts") },
      { find: /^canvg$/, replacement: path.resolve(__dirname, "./src/lib/jspdf-optional-stub.ts") },
      { find: /^dompurify$/, replacement: path.resolve(__dirname, "./src/lib/jspdf-optional-stub.ts") },
    ],
  },

}));
