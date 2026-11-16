import { describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError, UnauthorizedError, createClient } from "./client";

const BASE = "https://agama.test";

function jsonResponse(body: unknown, init: ResponseInit = {}, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": contentType },
    ...init,
  });
}

function setup(response: Response | Error, options: { token?: string } = {}) {
  const fetchImpl = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  const onUnauthorized = vi.fn();
  const client = createClient({
    baseUrl: BASE,
    token: options.token,
    onUnauthorized,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, fetchImpl, onUnauthorized };
}

function lastCall(fetchImpl: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe("api client", () => {
  it("logs in and returns the token without sending any Authorization header", async () => {
    const { client, fetchImpl } = setup(jsonResponse({ token: "abc" }), { token: "old" });
    await expect(client.login("secret")).resolves.toBe("abc");

    const { url, init, headers } = lastCall(fetchImpl);
    expect(url).toBe(`${BASE}/api/auth`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ password: "secret" }));
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("sends the Bearer token for authenticated requests", async () => {
    const { client, fetchImpl } = setup(jsonResponse({ products: [] }), { token: "tok" });
    await client.getSystem();
    expect(lastCall(fetchImpl).headers["Authorization"]).toBe("Bearer tok");
    expect(lastCall(fetchImpl).url).toBe(`${BASE}/api/system`);
  });

  it("does not send the token to /api/ping", async () => {
    const { client, fetchImpl } = setup(jsonResponse({}), { token: "tok" });
    await client.ping();
    expect(lastCall(fetchImpl).headers["Authorization"]).toBeUndefined();
  });

  it("selects a product with PATCH /api/config and accepts an empty body", async () => {
    const { client, fetchImpl } = setup(new Response(null, { status: 200 }), { token: "tok" });
    await expect(client.selectProduct("Tumbleweed")).resolves.toBeUndefined();

    const { url, init } = lastCall(fetchImpl);
    expect(url).toBe(`${BASE}/api/config`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      update: { product: { id: "Tumbleweed" } },
    });
  });

  it("maps a network failure to NetworkError", async () => {
    const { client } = setup(new TypeError("Failed to fetch"));
    await expect(client.ping()).rejects.toBeInstanceOf(NetworkError);
  });

  it("maps 401 to UnauthorizedError and calls the global handler when a token was sent", async () => {
    const { client, onUnauthorized } = setup(
      jsonResponse(
        { title: "Unauthorized", detail: "Invalid token" },
        { status: 401 },
        "application/problem+json",
      ),
      { token: "tok" },
    );
    const error = await client.getSystem().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).message).toBe("Invalid token");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not call the global handler for a wrong password", async () => {
    const { client, onUnauthorized } = setup(
      jsonResponse(
        { detail: "Authentication failed" },
        { status: 401 },
        "application/problem+json",
      ),
      { token: "tok" },
    );
    await expect(client.login("bad")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not call the global handler when there is no token", async () => {
    const { client, onUnauthorized } = setup(jsonResponse({}, { status: 401 }));
    await expect(client.getSystem()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("uses the problem details for other errors", async () => {
    const { client } = setup(
      jsonResponse(
        { title: "Bad Request", detail: "Invalid configuration" },
        { status: 400 },
        "application/problem+json",
      ),
      { token: "tok" },
    );
    const error = await client.selectProduct("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(UnauthorizedError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe("Invalid configuration");
  });

  it("falls back to the status line when the error is not JSON", async () => {
    const { client } = setup(
      new Response("boom", { status: 500, statusText: "Internal Server Error" }),
      { token: "tok" },
    );
    await expect(client.getConfig()).rejects.toThrow("500 Internal Server Error");
  });

  it("builds logo URLs, including the dark variant", () => {
    const { client } = setup(jsonResponse({}));
    expect(client.logoUrl("SUSE.svg")).toBe(`${BASE}/assets/logos/SUSE.svg`);
    expect(client.logoUrl("SUSE.svg", true)).toBe(`${BASE}/assets/logos/SUSE-dark.svg`);
    expect(client.logoUrl("noext", true)).toBe(`${BASE}/assets/logos/noext-dark`);
  });

  it("times out as a NetworkError", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      );
      const client = createClient({
        baseUrl: BASE,
        timeoutMs: 1000,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      const result = client.getSystem().catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(1001);
      const error = await result;
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).timedOut).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
