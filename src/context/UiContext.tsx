import { MotionGlobalConfig } from "framer-motion";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { KEYS, local } from "./storage";

type Theme = "dark" | "light";

interface UiState {
  theme: Theme;
  animations: boolean;
  toggleTheme: () => void;
  toggleAnimations: () => void;
}

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    local.get(KEYS.theme) === "light" ? "light" : "dark",
  );
  const [animations, setAnimations] = useState<boolean>(() => local.get(KEYS.animations) !== "off");

  useEffect(() => {
    document.documentElement.classList.toggle("pf-v6-theme-dark", theme === "dark");
    local.set(KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("no-anim", !animations);
    MotionGlobalConfig.skipAnimations = !animations;
    local.set(KEYS.animations, animations ? "on" : "off");
  }, [animations]);

  const value: UiState = {
    theme,
    animations,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    toggleAnimations: () => setAnimations((a) => !a),
  };

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside <UiProvider>");
  return ctx;
}
