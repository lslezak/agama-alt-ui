import { describe, expect, it } from "vitest";
import { normalizeServerUrl } from "./url";

const ok = (input: string) => {
  const r = normalizeServerUrl(input);
  if (!r.ok) throw new Error(`expected success for "${input}": ${r.error}`);
  return r.url;
};

describe("normalizeServerUrl", () => {
  it("keeps a plain https URL", () => {
    expect(ok("https://agama.local")).toBe("https://agama.local");
  });

  it("adds the https scheme when it is missing", () => {
    expect(ok("agama.local")).toBe("https://agama.local");
  });

  it("rewrites http to https", () => {
    expect(ok("http://agama.local")).toBe("https://agama.local");
    expect(ok("HTTP://agama.local")).toBe("https://agama.local");
  });

  it("strips trailing slash, path, query and fragment", () => {
    expect(ok("https://agama.local/")).toBe("https://agama.local");
    expect(ok("https://agama.local/some/path?x=1#top")).toBe("https://agama.local");
  });

  it("keeps a custom port", () => {
    expect(ok("agama.local:8443")).toBe("https://agama.local:8443");
  });

  it("drops the default HTTPS port", () => {
    expect(ok("https://agama.local:443")).toBe("https://agama.local");
  });

  it("trims whitespace", () => {
    expect(ok("  agama.local \n")).toBe("https://agama.local");
  });

  it("supports IP addresses", () => {
    expect(ok("192.168.1.10")).toBe("https://192.168.1.10");
    expect(ok("[::1]:8443")).toBe("https://[::1]:8443");
  });

  it("rejects an empty input", () => {
    expect(normalizeServerUrl("   ").ok).toBe(false);
  });

  it("rejects other protocols", () => {
    const r = normalizeServerUrl("ftp://agama.local");
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid host", () => {
    expect(normalizeServerUrl("http://").ok).toBe(false);
    expect(normalizeServerUrl("exa mple.com").ok).toBe(false);
  });
});
