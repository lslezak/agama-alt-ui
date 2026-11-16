export type NormalizedUrl = { ok: true; url: string } | { ok: false; error: string };

/**
 * Normalizes the server address typed by the user.
 *
 * - adds the `https://` scheme if it is missing,
 * - rewrites an explicit `http://` to `https://` (Agama redirects HTTP to HTTPS anyway and a
 *   redirect would break the CORS requests),
 * - strips any path, query, fragment and trailing slashes,
 * - keeps an optional port.
 */
export function normalizeServerUrl(input: string): NormalizedUrl {
  let text = input.trim();
  if (text === "") return { ok: false, error: "Please enter the server address." };

  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(text);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    if (name !== "http" && name !== "https") {
      return { ok: false, error: `Unsupported protocol "${scheme[1]}:", only https is supported.` };
    }
    text = text.slice(scheme[0].length);
  }

  let parsed: URL;
  try {
    parsed = new URL(`https://${text}`);
  } catch {
    return { ok: false, error: "This is not a valid server address." };
  }

  if (parsed.hostname === "") return { ok: false, error: "This is not a valid server address." };

  // `origin` drops the path/query/fragment and the default port
  return { ok: true, url: parsed.origin };
}
