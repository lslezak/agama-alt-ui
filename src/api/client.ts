import type { Config, ProblemDetails, SystemInfo } from "./types";

/** The request could not be completed: network, TLS, CORS or timeout (browsers do not tell). */
export class NetworkError extends Error {
  readonly timedOut: boolean;
  constructor(message: string, timedOut = false) {
    super(message);
    this.name = "NetworkError";
    this.timedOut = timedOut;
  }
}

/** The server answered with an error status. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem?: ProblemDetails;
  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

/** HTTP 401. */
export class UnauthorizedError extends ApiError {
  constructor(message: string, problem?: ProblemDetails) {
    super(401, message, problem);
    this.name = "UnauthorizedError";
  }
}

export interface ClientOptions {
  /** Server origin, e.g. `https://agama.local`. */
  baseUrl: string;
  /** Bearer token, if logged in. */
  token?: string | null;
  /** Called when a request that carried the token was rejected with 401. */
  onUnauthorized?: () => void;
  /** Default request timeout in milliseconds. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Send the Bearer token (default: true if there is a token). */
  auth?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const PING_TIMEOUT_MS = 5_000;

export function createClient(options: ClientOptions) {
  const { baseUrl, token, onUnauthorized, fetchImpl } = options;
  const defaultTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const sendToken = (opts.auth ?? true) && !!token;
    const headers: Record<string, string> = {};
    if (sendToken) headers["Authorization"] = `Bearer ${token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timeout = opts.timeoutMs ?? defaultTimeout;
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      const doFetch = fetchImpl ?? fetch;
      response = await doFetch(`${baseUrl}${path}`, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new NetworkError(`The server did not answer in ${timeout / 1000} seconds.`, true);
      }
      throw new NetworkError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text().catch(() => "");

    if (!response.ok) {
      const problem = parseProblem(response, text);
      const message =
        problem?.detail || problem?.title || `${response.status} ${response.statusText}`.trim();
      if (response.status === 401) {
        if (sendToken) onUnauthorized?.();
        throw new UnauthorizedError(message, problem);
      }
      throw new ApiError(response.status, message, problem);
    }

    if (text === "") return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  return {
    baseUrl,

    /** Connectivity check, public (no token). Resolves if the server answered at all. */
    ping: () => request<unknown>("/api/ping", { auth: false, timeoutMs: PING_TIMEOUT_MS }),

    /** Logs in, resolves to the Bearer token. A 401 here means a wrong password. */
    login: async (password: string): Promise<string> => {
      const response = await request<{ token: string }>("/api/auth", {
        method: "POST",
        body: { password },
        auth: false,
      });
      return response.token;
    },

    /** Validates the token. */
    session: () => request<void>("/api/auth"),

    logout: () => request<void>("/api/auth", { method: "DELETE" }),

    getSystem: () => request<SystemInfo>("/api/system"),

    getConfig: () => request<Config>("/api/config"),

    /** Selects the product (PATCH keeps the rest of the configuration untouched). */
    selectProduct: (id: string) =>
      request<void>("/api/config", { method: "PATCH", body: { update: { product: { id } } } }),

    /** URL of a product logo, `dark` selects the `-dark` variant. */
    logoUrl: (icon: string, dark = false) =>
      `${baseUrl}/assets/logos/${encodeURIComponent(logoFile(icon, dark))}`,
  };
}

export type ApiClient = ReturnType<typeof createClient>;

function logoFile(icon: string, dark: boolean): string {
  if (!dark) return icon;
  const dot = icon.lastIndexOf(".");
  return dot === -1 ? `${icon}-dark` : `${icon.slice(0, dot)}-dark${icon.slice(dot)}`;
}

function parseProblem(response: Response, text: string): ProblemDetails | undefined {
  if (!response.headers.get("content-type")?.includes("json")) return undefined;
  try {
    const data: unknown = JSON.parse(text);
    return typeof data === "object" && data !== null ? (data as ProblemDetails) : undefined;
  } catch {
    return undefined;
  }
}
