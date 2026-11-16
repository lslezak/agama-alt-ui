import { useCallback, useEffect, useRef, useState } from "react";
import { NetworkError } from "../api/client";

export const TRUST_POLL_INTERVAL_MS = 2000;

/**
 * Polls the server until it answers, i.e. until the user has accepted the (self-signed)
 * certificate in another tab.
 *
 * Only a {@link NetworkError} counts as a failure: if the server answers with an HTTP error
 * status then the TLS connection works.
 */
export function useTrustCheck(
  ping: () => Promise<unknown>,
  onTrusted: () => void,
  intervalMs = TRUST_POLL_INTERVAL_MS,
) {
  const [failures, setFailures] = useState(0);
  const [trusted, setTrusted] = useState(false);
  const [checking, setChecking] = useState(false);

  const pingRef = useRef(ping);
  const onTrustedRef = useRef(onTrusted);
  pingRef.current = ping;
  onTrustedRef.current = onTrusted;

  const busy = useRef(false);
  const done = useRef(false);

  /** Runs a single check, resolves to `true` if the server is reachable. */
  const check = useCallback(async (): Promise<boolean> => {
    if (busy.current || done.current) return done.current;
    busy.current = true;
    setChecking(true);
    try {
      let reachable = true;
      try {
        await pingRef.current();
      } catch (error) {
        if (error instanceof NetworkError) reachable = false;
      }
      if (reachable) {
        done.current = true;
        setTrusted(true);
        onTrustedRef.current();
      } else {
        setFailures((n) => n + 1);
      }
      return reachable;
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void check(), intervalMs);
    const onFocus = () => void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check, intervalMs]);

  return { failures, trusted, checking, checkNow: check };
}
