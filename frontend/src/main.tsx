
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { installClientErrorReporting } from "./app/lib/client-errors.ts";
  import "./styles/index.css";

  installClientErrorReporting();
  createRoot(document.getElementById("root")!).render(<App />);
  
