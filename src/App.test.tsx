import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { SessionProvider } from "./context/SessionContext";
import { KEYS, session } from "./context/storage";
import { UiProvider } from "./context/UiContext";

const SERVER = "https://agama.local";

const SYSTEM = {
  products: [
    {
      id: "Tumbleweed",
      name: "openSUSE Tumbleweed",
      description: "A rolling release <b>distribution</b>",
      icon: "Tumbleweed.svg",
      registration: false,
      licenses: [],
      modes: [],
    },
    {
      id: "SLES",
      name: "SUSE Linux Enterprise Server",
      description: "Enterprise server",
      icon: "SUSE.svg",
      registration: true,
      licenses: ["license.txt"],
      modes: [],
    },
  ],
  hardware: { model: "QEMU Standard PC", memory: 4 * 1024 ** 3 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderApp(path = "/") {
  return render(
    <UiProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </SessionProvider>
    </UiProvider>,
  );
}

describe("the wizard", () => {
  const fetchMock = vi.fn();
  const calls = () =>
    fetchMock.mock.calls.map(
      ([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${url}`,
    );

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("goes from the server selection to the summary", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === `${SERVER}/api/ping`) return Promise.resolve(json({}));
      if (url === `${SERVER}/api/auth` && method === "POST")
        return Promise.resolve(json({ token: "tok" }));
      if (url === `${SERVER}/api/system`) return Promise.resolve(json(SYSTEM));
      if (url === `${SERVER}/api/config` && method === "GET") return Promise.resolve(json({}));
      if (url === `${SERVER}/api/config` && method === "PATCH")
        return Promise.resolve(new Response(null));
      return Promise.resolve(json({}, 404));
    });
    renderApp();

    // step 1: the default server is prefilled
    const input = await screen.findByLabelText("Agama server");
    expect(input).toHaveValue(SERVER);
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));

    // step 3: log in
    await userEvent.type(await screen.findByLabelText("Password"), "agama{Enter}");

    // step 4: products
    expect(await screen.findByText("openSUSE Tumbleweed")).toBeInTheDocument();
    expect(screen.getByText("SUSE Linux Enterprise Server")).toBeInTheDocument();
    expect(screen.getByText("QEMU Standard PC")).toBeInTheDocument();
    // the description is rendered as text, not as HTML
    expect(screen.getByText("A rolling release <b>distribution</b>")).toBeInTheDocument();
    expect(screen.getByText("registration required")).toBeInTheDocument();

    const select = screen.getByRole("button", { name: "Select" });
    expect(select).toBeDisabled();
    await userEvent.click(screen.getByText("openSUSE Tumbleweed"));
    expect(select).toBeEnabled();
    await userEvent.click(select);

    // step 5: the selection is sent and the summary is shown
    expect(
      await screen.findByRole("heading", { name: "Summary" }, { timeout: 3000 }),
    ).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patch).toBeDefined();
    expect(JSON.parse((patch![1] as RequestInit).body as string)).toEqual({
      update: { product: { id: "Tumbleweed" } },
    });
    expect(calls().filter((c) => c.startsWith("PATCH"))).toHaveLength(1);
  });

  it("goes to the certificate step when the server is not reachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Connect" }));

    expect(await screen.findByText("The server certificate is not trusted")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open server in a new tab/ })).toHaveAttribute(
      "href",
      SERVER,
    );
  });

  it("shows validation errors for an invalid address", async () => {
    renderApp();
    const input = await screen.findByLabelText("Agama server");
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText("Please enter the server address.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("restores a stored session and skips to the products", async () => {
    session.set(KEYS.server, SERVER);
    session.set(KEYS.token, "stored");
    fetchMock.mockImplementation((url: string) => {
      if (url === `${SERVER}/api/auth`) return Promise.resolve(new Response(null));
      if (url === `${SERVER}/api/system`) return Promise.resolve(json(SYSTEM));
      if (url === `${SERVER}/api/config`) return Promise.resolve(json({ product: { id: "SLES" } }));
      return Promise.resolve(json({}, 404));
    });
    renderApp();

    expect(
      await screen.findByText("Choose your product", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    // the configured product is preselected
    expect(screen.getByText("Selected: SUSE Linux Enterprise Server")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeEnabled();
  });

  it("drops an invalid stored session", async () => {
    session.set(KEYS.server, SERVER);
    session.set(KEYS.token, "stale");
    fetchMock.mockResolvedValue(json({ detail: "Invalid token" }, 401));
    renderApp();

    expect(await screen.findByLabelText("Agama server")).toBeInTheDocument();
    expect(session.get(KEYS.token)).toBeNull();
  });

  it("sends the user back to the login with a notice when the session expires", async () => {
    session.set(KEYS.server, SERVER);
    session.set(KEYS.token, "tok");
    let authChecks = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === `${SERVER}/api/auth`) {
        authChecks++;
        return Promise.resolve(new Response(null));
      }
      // the token expires right after the startup check
      return Promise.resolve(json({ detail: "expired" }, 401));
    });
    renderApp();

    expect(await screen.findByText(/session has expired/)).toBeInTheDocument();
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(session.get(KEYS.token)).toBeNull();
    expect(authChecks).toBe(1);
  });
});
