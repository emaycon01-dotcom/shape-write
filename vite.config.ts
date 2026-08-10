import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Backend próprio (São Paulo). Fixado aqui porque o .env é regenerado
// automaticamente pela plataforma e voltaria a apontar para o projeto antigo.
const SUPABASE_OVERRIDE = {
  url: "https://tfelypvzmdokfcgupmls.supabase.co",
  projectId: "tfelypvzmdokfcgupmls",
  publishableKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZWx5cHZ6bWRva2ZjZ3VwbWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzODA0MTIsImV4cCI6MjEwMTk1NjQxMn0.Ipz2FoPU86qLbh9GMeh1Zt3H7qvJRCr5p6igv1-0rlk",
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_OVERRIDE.url),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(SUPABASE_OVERRIDE.projectId),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_OVERRIDE.publishableKey),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(SUPABASE_OVERRIDE.publishableKey),
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
