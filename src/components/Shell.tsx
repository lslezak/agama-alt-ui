import { Button, Label, ProgressStep, ProgressStepper } from "@patternfly/react-core";
import MagicIcon from "@patternfly/react-icons/dist/esm/icons/magic-icon";
import MoonIcon from "@patternfly/react-icons/dist/esm/icons/moon-icon";
import ServerIcon from "@patternfly/react-icons/dist/esm/icons/server-icon";
import SignOutAltIcon from "@patternfly/react-icons/dist/esm/icons/sign-out-alt-icon";
import SunIcon from "@patternfly/react-icons/dist/esm/icons/sun-icon";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { useSession } from "../context/SessionContext";
import { useUi } from "../context/UiContext";
import { Background } from "./Background";

const STEPS = [
  { path: "/", title: "Server" },
  { path: "/trust", title: "Certificate" },
  { path: "/login", title: "Login" },
  { path: "/products", title: "Product" },
  { path: "/summary", title: "Summary" },
];

function Header() {
  const { serverUrl, token, logout } = useSession();
  const { theme, animations, toggleTheme, toggleAnimations } = useUi();

  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__badge">A</span>
        <span className="header__name">Agama</span>
        <span className="header__tag">alternative UI</span>
      </div>
      <div className="header__actions">
        {serverUrl && (
          <Label
            icon={<ServerIcon />}
            color="teal"
            isCompact
            isClickable
            title="Open the server in a new tab"
            render={({ className, content }) => (
              <a className={className} href={serverUrl} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            )}
          >
            {serverUrl}
          </Label>
        )}
        <Button
          variant="plain"
          title={animations ? "Animations: on" : "Animations: off"}
          onClick={toggleAnimations}
          className={animations ? "header__toggle header__toggle--on" : "header__toggle"}
          icon={<MagicIcon />}
        />
        <Button
          variant="plain"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
          icon={theme === "dark" ? <SunIcon /> : <MoonIcon />}
        />
        {token && (
          <Button variant="secondary" icon={<SignOutAltIcon />} onClick={() => void logout()}>
            Log out
          </Button>
        )}
      </div>
    </header>
  );
}

function Steps() {
  const { pathname } = useLocation();
  const current = Math.max(
    0,
    STEPS.findIndex((s) => s.path === pathname),
  );

  return (
    <ProgressStepper isCenterAligned className="steps">
      {STEPS.map((step, i) => (
        <ProgressStep
          key={step.path}
          variant={i < current ? "success" : i === current ? "info" : "pending"}
          isCurrent={i === current}
          id={`step-${i}`}
          titleId={`step-${i}-title`}
          aria-label={step.title}
        >
          {step.title}
        </ProgressStep>
      ))}
    </ProgressStepper>
  );
}

/** Header, stepper and the animated "glass" panel hosting the current page. */
export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="shell">
      <Background />
      <Header />
      <main className="shell__main">
        <Steps />
        <div className="glass">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 80, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -80, filter: "blur(10px)" }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
