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

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
}
