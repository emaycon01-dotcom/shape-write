import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyStoredTheme } from "./components/ThemeSwitcher";
import AppErrorBoundary from "./components/AppErrorBoundary";

applyStoredTheme();

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>,
  );
}
