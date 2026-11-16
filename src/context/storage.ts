// Thin wrappers around the web storage that never throw (e.g. storage disabled by the browser).

export const KEYS = {
  server: "agama.server", // sessionStorage
  token: "agama.token", // sessionStorage, never use localStorage for the token!
  recentServers: "agama.servers", // localStorage
  theme: "agama.theme", // localStorage
  animations: "agama.animations", // localStorage
} as const;

export const DEFAULT_SERVER = "https://agama.local";
export const MAX_RECENT_SERVERS = 5;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const session = {
  get: (key: string) => safe(() => sessionStorage.getItem(key), null),
  set: (key: string, value: string) => safe(() => sessionStorage.setItem(key, value), undefined),
  remove: (key: string) => safe(() => sessionStorage.removeItem(key), undefined),
};

export const local = {
  get: (key: string) => safe(() => localStorage.getItem(key), null),
  set: (key: string, value: string) => safe(() => localStorage.setItem(key, value), undefined),
};

export function loadRecentServers(): string[] {
  const raw = local.get(KEYS.recentServers);
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Puts the server at the front of the list, without duplicates, limited in size. */
export function addRecentServer(list: string[], url: string): string[] {
  return [url, ...list.filter((s) => s !== url)].slice(0, MAX_RECENT_SERVERS);
}
