import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { SessionProvider } from "../context/SessionContext";
import { KEYS } from "../context/storage";
import { UiProvider } from "../context/UiContext";
import { Shell } from "./Shell";

function renderShell() {
  return render(
    <UiProvider>
      <SessionProvider>
        <MemoryRouter>
          <Shell>content</Shell>
        </MemoryRouter>
      </SessionProvider>
    </UiProvider>,
  );
}

describe("Shell header", () => {
  it("shows the server URL as a link opening in a new tab", () => {
    sessionStorage.setItem(KEYS.server, "https://agama.test");
    renderShell();

    const link = screen.getByRole("link", { name: "https://agama.test" });
    expect(link).toHaveAttribute("href", "https://agama.test");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("shows no server link before a server is chosen", () => {
    renderShell();
    expect(screen.queryByRole("link", { name: /https:/ })).not.toBeInTheDocument();
  });
});
