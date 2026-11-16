import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient, type ApiClient } from "../api/client";
import type { Product } from "../api/types";
import {
  KEYS,
  addRecentServer,
  loadRecentServers,
  local,
  session as sessionStorageApi,
} from "./storage";

interface SessionState {
  serverUrl: string | null;
  token: string | null;
  /** True while a stored session is being validated at startup. */
  restoring: boolean;
  /** One-shot message for the login page (e.g. "Session expired"). */
  notice: string | null;
  /** API client for the current server, `null` until a server is chosen. */
  client: ApiClient | null;
  recentServers: string[];
  /** The product chosen in the wizard (kept in memory only). */
  selectedProduct: Product | null;
  setServer: (url: string) => void;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSelectedProduct: (product: Product | null) => void;
  clearNotice: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [serverUrl, setServerUrl] = useState<string | null>(() =>
    sessionStorageApi.get(KEYS.server),
  );
  const [token, setToken] = useState<string | null>(() =>
    sessionStorageApi.get(KEYS.server) ? sessionStorageApi.get(KEYS.token) : null,
  );
  const [restoring, setRestoring] = useState<boolean>(() => !!token);
  const [notice, setNotice] = useState<string | null>(null);
  const [recentServers, setRecentServers] = useState<string[]>(loadRecentServers);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const expire = useCallback(() => {
    sessionStorageApi.remove(KEYS.token);
    setToken(null);
    setSelectedProduct(null);
    setNotice("Your session has expired, please log in again.");
  }, []);

  const client = useMemo(
    () => (serverUrl ? createClient({ baseUrl: serverUrl, token, onUnauthorized: expire }) : null),
    [serverUrl, token, expire],
  );

  // validate the stored session at startup (without the "session expired" side effects)
  useEffect(() => {
    if (!restoring || !serverUrl || !token) return;
    let cancelled = false;
    createClient({ baseUrl: serverUrl, token })
      .session()
      .catch(() => {
        // invalid or unreachable: start from scratch
        sessionStorageApi.remove(KEYS.token);
        sessionStorageApi.remove(KEYS.server);
        if (!cancelled) {
          setToken(null);
          setServerUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
    // only at startup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setServer = useCallback(
    (url: string) => {
      if (url !== serverUrl) {
        sessionStorageApi.remove(KEYS.token);
        setToken(null);
        setSelectedProduct(null);
      }
      sessionStorageApi.set(KEYS.server, url);
      setServerUrl(url);
      setRecentServers((list) => {
        const next = addRecentServer(list, url);
        local.set(KEYS.recentServers, JSON.stringify(next));
        return next;
      });
    },
    [serverUrl],
  );

  const login = useCallback(
    async (password: string) => {
      if (!serverUrl) throw new Error("No server selected");
      const newToken = await createClient({ baseUrl: serverUrl }).login(password);
      sessionStorageApi.set(KEYS.token, newToken);
      setNotice(null);
      setToken(newToken);
    },
    [serverUrl],
  );

  const logout = useCallback(async () => {
    try {
      await client?.logout();
    } catch {
      // the token is dropped anyway
    }
    sessionStorageApi.remove(KEYS.token);
    setToken(null);
    setSelectedProduct(null);
    setNotice(null);
  }, [client]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value: SessionState = {
    serverUrl,
    token,
    restoring,
    notice,
    client,
    recentServers,
    selectedProduct,
    setServer,
    login,
    logout,
    setSelectedProduct,
    clearNotice,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
