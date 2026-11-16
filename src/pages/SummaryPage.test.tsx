import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../context/SessionContext";
import { UiProvider } from "../context/UiContext";
import { KEYS } from "../context/storage";
import { SummaryPage } from "./SummaryPage";

const SYSTEM = {
  products: [
    {
      id: "Tumbleweed",
      name: "openSUSE Tumbleweed",
      description: "A rolling release",
      icon: "Tumbleweed.svg",
      registration: false,
      licenses: [],
      modes: [],
    },
  ],
  hardware: { model: "ACME 9000", memory: 8 * 1024 ** 3 },
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function mockServer(config: unknown) {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/api/config")) return json(config);
    if (url.endsWith("/api/system")) return json(SYSTEM);
    return new Response(null, { status: 200 }); // /api/auth
  });
}

function renderSummary() {
  sessionStorage.setItem(KEYS.server, "https://agama.test");
  sessionStorage.setItem(KEYS.token, "tok");
  return render(
    <UiProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={["/summary"]}>
          <Routes>
            <Route path="/summary" element={<SummaryPage />} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </UiProvider>,
  );
}

describe("SummaryPage", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("shows the product and the hardware read back from the server", async () => {
    vi.stubGlobal("fetch", mockServer({ product: { id: "Tumbleweed" } }));
    renderSummary();

    expect(await screen.findByText("openSUSE Tumbleweed")).toBeInTheDocument();
    expect(screen.getByText("A rolling release")).toBeInTheDocument();
    expect(screen.getByText("Confirmed by the server")).toBeInTheDocument();
    expect(screen.getByText("ACME 9000")).toBeInTheDocument();
    expect(screen.getByText("8.0 GiB")).toBeInTheDocument();
  });

  it("warns when the server config has no product", async () => {
    vi.stubGlobal("fetch", mockServer({}));
    renderSummary();

    expect(
      await screen.findByText("The server configuration has no product selected"),
    ).toBeInTheDocument();
  });
});
