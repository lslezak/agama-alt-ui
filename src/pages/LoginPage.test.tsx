import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../context/SessionContext";
import { KEYS, session } from "../context/storage";
import { UiProvider } from "../context/UiContext";
import { LoginPage } from "./LoginPage";

const SERVER = "https://agama.test";

function renderLogin() {
  session.set(KEYS.server, SERVER);
  return render(
    <UiProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/products" element={<p>products page</p>} />
            <Route path="/" element={<p>server page</p>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </UiProvider>,
  );
}

describe("LoginPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows an error and stays on the page for a wrong password", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Authentication failed" }), {
        status: 401,
        headers: { "content-type": "application/problem+json" },
      }),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText("Password"), "wrong{Enter}");

    expect(await screen.findByText("Wrong password.")).toBeInTheDocument();
    expect(screen.queryByText("products page")).not.toBeInTheDocument();
    expect(session.get(KEYS.token)).toBeNull();
  });

  it("stores the token in sessionStorage only and continues to the products", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token: "jwt-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText("Password"), "agama{Enter}");

    await waitFor(() => expect(screen.getByText("products page")).toBeInTheDocument());
    expect(session.get(KEYS.token)).toBe("jwt-token");
    expect(localStorage.getItem(KEYS.token)).toBeNull();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SERVER}/api/auth`);
    expect(JSON.parse(init.body as string)).toEqual({ password: "agama" });
  });

  it("shows a message when the server cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderLogin();

    await userEvent.type(screen.getByLabelText("Password"), "agama{Enter}");

    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
  });

  it("toggles the password visibility", async () => {
    renderLogin();
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByTitle("Show password"));
    expect(input).toHaveAttribute("type", "text");
  });
});
