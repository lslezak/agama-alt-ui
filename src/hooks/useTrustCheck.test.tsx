import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError } from "../api/client";
import { useTrustCheck } from "./useTrustCheck";

describe("useTrustCheck", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps polling while the server is unreachable and counts the failures", async () => {
    const ping = vi.fn().mockRejectedValue(new NetworkError("Failed to fetch"));
    const onTrusted = vi.fn();
    const { result } = renderHook(() => useTrustCheck(ping, onTrusted, 2000));

    await act(() => vi.advanceTimersByTimeAsync(6100));

    expect(ping).toHaveBeenCalledTimes(3);
    expect(result.current.failures).toBe(3);
    expect(result.current.trusted).toBe(false);
    expect(onTrusted).not.toHaveBeenCalled();
  });

  it("reports success once and stops polling when the server answers", async () => {
    const ping = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError("Failed to fetch"))
      .mockResolvedValue({});
    const onTrusted = vi.fn();
    const { result } = renderHook(() => useTrustCheck(ping, onTrusted, 2000));

    await act(() => vi.advanceTimersByTimeAsync(4100));
    expect(result.current.trusted).toBe(true);
    expect(onTrusted).toHaveBeenCalledTimes(1);

    const calls = ping.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(ping.mock.calls.length).toBe(calls);
    expect(onTrusted).toHaveBeenCalledTimes(1);
  });

  it("treats an HTTP error as a working TLS connection", async () => {
    const ping = vi.fn().mockRejectedValue(new ApiError(503, "Unavailable"));
    const onTrusted = vi.fn();
    const { result } = renderHook(() => useTrustCheck(ping, onTrusted, 2000));

    await act(() => vi.advanceTimersByTimeAsync(2100));
    expect(result.current.trusted).toBe(true);
    expect(onTrusted).toHaveBeenCalledTimes(1);
  });

  it("checks immediately when the window gets the focus", async () => {
    const ping = vi.fn().mockRejectedValue(new NetworkError("Failed to fetch"));
    renderHook(() => useTrustCheck(ping, vi.fn(), 60_000));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("checkNow resolves to the result of the check", async () => {
    const ping = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError("Failed to fetch"))
      .mockResolvedValue({});
    const { result } = renderHook(() => useTrustCheck(ping, vi.fn(), 60_000));

    let first = true;
    let second = false;
    await act(async () => {
      first = await result.current.checkNow();
    });
    await act(async () => {
      second = await result.current.checkNow();
    });
    expect(first).toBe(false);
    expect(second).toBe(true);
  });

  it("does not overlap checks", async () => {
    let resolve: () => void = () => {};
    const ping = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    renderHook(() => useTrustCheck(ping, vi.fn(), 1000));

    await act(() => vi.advanceTimersByTimeAsync(3500));
    expect(ping).toHaveBeenCalledTimes(1); // still waiting for the first answer
    resolve();
  });
});
