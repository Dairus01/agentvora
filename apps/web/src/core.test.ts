import { describe, it, expect } from "vitest";
import { money, num, pct, safeUrl } from "./format";
import { mergeEvent } from "./api";
import type { DeskEvent } from "./types";
describe("financial formatting", () => {
  it("distinguishes unavailable values from zero", () => {
    expect(money(0)).toBe("$0.00");
    expect(money(undefined)).toBe("\u2014");
    expect(pct(-1.125)).toBe("-1.13%");
    expect(num(100000)).toBe("100,000");
  });
  it("rejects executable source links", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("https://example.com")).toBe("https://example.com");
  });
});
describe("event feed", () => {
  const e: DeskEvent = {
    id: "1",
    type: "agent.report",
    timestamp: "2026-10-17T00:00:00Z",
    summary: "Explicit report",
  };
  it("deduplicates replayed events", () =>
    expect(mergeEvent([e], e)).toEqual([e]));
  it("ignores heartbeats", () =>
    expect(mergeEvent([], { ...e, type: "heartbeat" })).toEqual([]));
  it("bounds the feed", () =>
    expect(
      mergeEvent(
        Array.from({ length: 150 }, (_, i) => ({ ...e, id: String(i) })),
        { ...e, id: "new" },
      ),
    ).toHaveLength(150));
});
