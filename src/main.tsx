import "@patternfly/react-core/dist/styles/base.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { SessionProvider } from "./context/SessionContext";
import { UiProvider } from "./context/UiContext";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UiProvider>
      <SessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </UiProvider>
  </StrictMode>,
);
