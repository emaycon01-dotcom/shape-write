import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyStoredTheme } from "./components/ThemeSwitcher";
import AppErrorBoundary from "./components/AppErrorBoundary";

try {
  applyStoredTheme();
} catch (error) {
  console.error("Falha ao aplicar o tema inicial", error);
}

// Erros de rede em scripts/assets não devem derrubar a interface.
window.addEventListener("unhandledrejection", (event) => {
  const msg = String((event.reason as Error)?.message ?? event.reason ?? "");
  if (/chunk|dynamically imported|module script|failed to fetch/i.test(msg)) {
    console.warn("Recurso não carregado, seguindo sem interromper:", msg);
    event.preventDefault();
  }
});

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
}
